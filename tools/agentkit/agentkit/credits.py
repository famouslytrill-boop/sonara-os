"""Credits: what a run is allowed to spend, and what it actually spent.

An agent that can call a model can spend money. Nothing in this package could
say how much, refuse a run that would cost too much, or answer "what did that
cost" afterwards -- and a toolkit whose runs have unbounded cost is one nobody
can put in front of a customer.

This is the accounting half. There is no billing here, no payment, no provider
integration: a `Ledger` holds grants, a `PriceList` says what tokens cost, and
`Runner` refuses a step it cannot afford.

## Four decisions worth arguing with

**Integers, never floats.** Everything is in *micro-credits* -- millionths of
one credit. `0.1 + 0.2 != 0.3` is the oldest bug in money software, and a
balance that drifts by a fraction per call is one nobody notices until a
reconciliation. Convert at the edges with `credits()` and `to_credits()`.

**Refuse before spending, not after.** A budget checked after the call has
already been paid for. `Runner` asks `can_afford()` before each model call
using a reservation, and stops the loop with `stop_reason="budget_exhausted"`
rather than making the call and reporting an overdraft. That means the estimate
has to exist, and it is deliberately pessimistic: it is better to stop a run one
step early than to hand somebody a bill they did not agree to.

**Missing usage is not free usage.** A provider that reports no token counts has
told us nothing, and `int(None)` and `dict.get(k, 0)` both turn that into zero.
A settlement with no usage charges the reservation instead, and says so. The
alternative -- treating an unreported call as costless -- makes the cheapest
possible provider the one that reports nothing.

**A balance is a function of time.** Credits expire, which is how prepaid packs
work everywhere they are sold. So there is no `balance` attribute; there is
`balance_at(now)`. An attribute would be read once, cached, and wrong by the
time it was shown. Spending draws from the *soonest-expiring* grant first, which
is the only order that does not quietly waste somebody's credits.
"""

from __future__ import annotations

import dataclasses
import datetime as _datetime
import threading

MICRO = 1_000_000
"""Micro-credits in one credit. Every amount in this module is an int of these."""


def credits(amount: float | int) -> int:
    """Credits in, micro-credits out.

    Rounds half away from zero rather than using `round()`, whose banker's
    rounding turns 0.5 into 0 -- correct for statistics and surprising for
    money.
    """
    scaled = amount * MICRO
    return int(scaled + (0.5 if scaled >= 0 else -0.5))


def to_credits(micro: int) -> float:
    """Micro-credits out, credits in. For display only -- never store this."""
    return micro / MICRO


def _utc(now: _datetime.datetime | None) -> _datetime.datetime:
    """Whatever was passed, as an aware UTC datetime.

    A naive datetime is assumed to be UTC rather than rejected: expiry
    comparisons between naive and aware datetimes raise TypeError, and a run
    dying on a timezone is a worse outcome than an assumption stated here.
    """
    if now is None:
        return _datetime.datetime.now(_datetime.timezone.utc)
    if now.tzinfo is None:
        return now.replace(tzinfo=_datetime.timezone.utc)
    return now.astimezone(_datetime.timezone.utc)


class InsufficientCredits(Exception):
    """A run needed more than the ledger could cover.

    Carries both numbers, because "insufficient credits" without them tells the
    reader nothing about whether they are short by one call or by a thousand.
    """

    def __init__(self, needed: int, available: int) -> None:
        self.needed = needed
        self.available = available
        super().__init__(
            f"needed {to_credits(needed):.6g} credits, {to_credits(available):.6g} available"
        )


@dataclasses.dataclass(frozen=True)
class ModelPrice:
    """What one model charges, per million tokens, in micro-credits.

    Per *million* because that is the unit every provider publishes, and
    converting their number by hand is where a factor of a thousand gets lost.
    """

    input_per_million: int
    output_per_million: int
    #: Charged once per call regardless of tokens. Some providers price
    #: image or search calls this way, and folding it into a token rate
    #: would make a one-token call look free.
    per_call: int = 0

    def cost(self, *, input_tokens: int, output_tokens: int) -> int:
        return (
            self.per_call
            + (int(input_tokens) * self.input_per_million) // 1_000_000
            + (int(output_tokens) * self.output_per_million) // 1_000_000
        )


class PriceList:
    """Model name to price.

    **Unknown models raise rather than defaulting.** A default price is a number
    somebody invented, applied silently to a model nobody costed -- and the
    first time it matters is the first time it is wrong. `default` may be set
    explicitly, which is a decision recorded in the caller rather than a
    behaviour assumed here.
    """

    def __init__(
        self,
        prices: "dict[str, ModelPrice] | None" = None,
        *,
        default: ModelPrice | None = None,
    ) -> None:
        self._prices = dict(prices or {})
        self._default = default

    def add(self, model: str, price: ModelPrice) -> "PriceList":
        self._prices[model] = price
        return self

    def known(self, model: str) -> bool:
        return model in self._prices

    def for_model(self, model: str) -> ModelPrice:
        price = self._prices.get(model)
        if price is not None:
            return price
        if self._default is not None:
            return self._default
        raise KeyError(
            f"no price for model {model!r}. Add one with PriceList.add(), or pass "
            "default= if an assumed price is genuinely what you want."
        )

    def cost(self, model: str, usage: dict | None) -> "int | None":
        """What one call cost, or None when the provider did not say.

        None is the important return. A caller that treats it as 0 has decided
        that a provider reporting nothing is a provider charging nothing, and
        `Ledger.settle` refuses to do that.
        """
        if not usage:
            return None
        input_tokens = usage.get("input_tokens", usage.get("prompt_tokens"))
        output_tokens = usage.get("output_tokens", usage.get("completion_tokens"))
        if not isinstance(input_tokens, (int, float)) or not isinstance(output_tokens, (int, float)):
            return None
        return self.for_model(model).cost(
            input_tokens=int(input_tokens), output_tokens=int(output_tokens)
        )


@dataclasses.dataclass
class Grant:
    """One pack of credits, with the moment it stops being worth anything."""

    amount: int
    expires_at: _datetime.datetime | None = None
    reason: str = ""
    granted_at: _datetime.datetime | None = None
    spent: int = 0

    def remaining(self) -> int:
        return max(0, self.amount - self.spent)

    def live_at(self, now: _datetime.datetime) -> bool:
        return self.expires_at is None or self.expires_at > now


class Ledger:
    """Grants in, spending out, and what is left at a given moment.

    Thread-safe: the dev UI serves concurrent requests, and two runs settling at
    once against an unlocked balance is a double-spend that appears only under
    load.
    """

    def __init__(self) -> None:
        self._grants: list[Grant] = []
        self._entries: list[dict] = []
        self._reserved: int = 0
        self._lock = threading.RLock()

    # --- putting credits in ----------------------------------------------

    def grant(
        self,
        amount: int,
        *,
        expires_at: _datetime.datetime | None = None,
        reason: str = "",
        now: _datetime.datetime | None = None,
    ) -> Grant:
        """Add credits. `amount` is micro-credits; use `credits()` to convert."""
        if amount <= 0:
            raise ValueError("a grant must be a positive number of micro-credits")
        moment = _utc(now)
        expiry = _utc(expires_at) if expires_at is not None else None
        # An already-expired grant is refused rather than accepted and ignored.
        # Accepting it would show in the history as credits given, and in the
        # balance as nothing, which is the shape of a support ticket.
        if expiry is not None and expiry <= moment:
            raise ValueError("that grant has already expired; it would add nothing")
        record = Grant(amount=amount, expires_at=expiry, reason=reason, granted_at=moment)
        with self._lock:
            self._grants.append(record)
            self._entries.append(
                {"kind": "grant", "amount": amount, "reason": reason, "at": moment, "expires_at": expiry}
            )
        return record

    # --- what is there ----------------------------------------------------

    def balance_at(self, now: _datetime.datetime | None = None) -> int:
        """Unspent, unexpired credits at this moment.

        Deliberately a method. Credits expire, so a cached attribute is a number
        that was true when it was read.
        """
        moment = _utc(now)
        with self._lock:
            return sum(g.remaining() for g in self._grants if g.live_at(moment))

    def available_at(self, now: _datetime.datetime | None = None) -> int:
        """Balance minus what in-flight runs have reserved.

        This is the number to check before starting work. `balance_at` is what
        somebody has; this is what they can still commit.
        """
        with self._lock:
            return max(0, self.balance_at(now) - self._reserved)

    def expiring_before(
        self, when: _datetime.datetime, *, now: _datetime.datetime | None = None
    ) -> int:
        """Credits that will be lost by `when` if unspent. For warning people."""
        moment = _utc(now)
        edge = _utc(when)
        with self._lock:
            return sum(
                g.remaining()
                for g in self._grants
                if g.live_at(moment) and g.expires_at is not None and g.expires_at <= edge
            )

    # --- spending ---------------------------------------------------------

    def can_afford(self, amount: int, *, now: _datetime.datetime | None = None) -> bool:
        return self.available_at(now) >= amount

    def reserve(self, amount: int, *, now: _datetime.datetime | None = None) -> "Reservation":
        """Set aside credits before doing the work that will spend them.

        Raises `InsufficientCredits` rather than returning a falsy value: a
        reservation that silently fails is one a caller proceeds past, which is
        the overdraft this whole module exists to prevent.
        """
        if amount < 0:
            raise ValueError("cannot reserve a negative amount")
        with self._lock:
            available = self.available_at(now)
            if available < amount:
                raise InsufficientCredits(needed=amount, available=available)
            self._reserved += amount
        return Reservation(ledger=self, amount=amount)

    def _release(self, amount: int) -> None:
        with self._lock:
            self._reserved = max(0, self._reserved - amount)

    def spend(
        self,
        amount: int,
        *,
        reason: str = "",
        now: _datetime.datetime | None = None,
        allow_overdraft: bool = False,
    ) -> int:
        """Draw down credits, soonest-expiring first.

        Returns what was actually taken. The expiry order is the whole point: a
        ledger that spends the newest grant first lets an older one expire
        unused, which is somebody's money thrown away by an implementation
        detail.

        `allow_overdraft` exists for settlement, where the work has already
        happened and refusing to record it would lose the fact that it did.
        """
        if amount <= 0:
            return 0
        moment = _utc(now)
        with self._lock:
            live = [g for g in self._grants if g.live_at(moment) and g.remaining() > 0]
            # None sorts last: an expiring grant is always spent before one that
            # never expires, because the never-expiring one will still be there.
            live.sort(key=lambda g: (g.expires_at is None, g.expires_at or moment))
            balance = sum(g.remaining() for g in live)
            if balance < amount and not allow_overdraft:
                raise InsufficientCredits(needed=amount, available=balance)

            left = amount
            for grant in live:
                if left <= 0:
                    break
                take = min(grant.remaining(), left)
                grant.spent += take
                left -= take

            taken = amount - left
            self._entries.append(
                {
                    "kind": "spend",
                    "amount": taken,
                    "unfunded": left,
                    "reason": reason,
                    "at": moment,
                }
            )
            return taken

    def settle(
        self,
        reservation: "Reservation",
        *,
        actual: int | None,
        reason: str = "",
        now: _datetime.datetime | None = None,
    ) -> dict:
        """Turn a reservation into a spend, using the real cost when there is one.

        `actual=None` means the provider reported no usage. That charges the
        reservation in full and marks the entry `estimated`, because the
        alternative -- charging nothing -- makes a provider that reports nothing
        the cheapest one available.
        """
        estimated = actual is None
        amount = reservation.amount if estimated else max(0, int(actual))
        reservation.release()
        # allow_overdraft because the work is already done. Refusing to record a
        # call that really happened would leave the ledger claiming a balance
        # that the provider has already billed against.
        taken = self.spend(amount, reason=reason, now=now, allow_overdraft=True)
        with self._lock:
            self._entries[-1]["estimated"] = estimated
        return {"charged": taken, "requested": amount, "estimated": estimated}

    # --- reading back -----------------------------------------------------

    def history(self) -> list[dict]:
        """Every grant and spend, oldest first. Copied, so a caller cannot edit it."""
        with self._lock:
            return [dict(entry) for entry in self._entries]

    def spent_total(self) -> int:
        with self._lock:
            return sum(g.spent for g in self._grants)


@dataclasses.dataclass
class Reservation:
    """Credits set aside for work that has not happened yet."""

    ledger: Ledger
    amount: int
    released: bool = False

    def release(self) -> None:
        """Give the credits back. Idempotent -- settling then releasing is common."""
        if self.released:
            return
        self.released = True
        self.ledger._release(self.amount)

    def __enter__(self) -> "Reservation":
        return self

    def __exit__(self, *_exc) -> None:
        # Released on any exit, including an exception. A run that raises
        # mid-call must not leave credits reserved for ever -- that is a leak
        # that looks exactly like a customer who has run out.
        self.release()


class Budget:
    """What one run may spend, and the estimate it is checked against.

    Holds a ledger, a price list, and a per-step reservation. `Runner` takes one
    and refuses a step it cannot cover.

    `estimate_per_step` is pessimistic on purpose. It is the amount reserved
    before each model call, and being generous with it means stopping a run one
    step early; being stingy means letting a run overdraw. The first is
    recoverable and the second is a bill.
    """

    def __init__(
        self,
        ledger: Ledger,
        prices: PriceList,
        *,
        estimate_per_step: int,
        max_per_run: int | None = None,
    ) -> None:
        if estimate_per_step <= 0:
            raise ValueError(
                "estimate_per_step must be positive; a zero estimate reserves nothing "
                "and turns the check before each call into one that always passes"
            )
        self.ledger = ledger
        self.prices = prices
        self.estimate_per_step = estimate_per_step
        self.max_per_run = max_per_run
        self.spent_this_run = 0

    def start_run(self) -> None:
        self.spent_this_run = 0

    def room_left_in_run(self) -> int | None:
        if self.max_per_run is None:
            return None
        return max(0, self.max_per_run - self.spent_this_run)

    def reserve_step(self, *, now: _datetime.datetime | None = None) -> Reservation:
        room = self.room_left_in_run()
        if room is not None and room < self.estimate_per_step:
            raise InsufficientCredits(needed=self.estimate_per_step, available=room)
        return self.ledger.reserve(self.estimate_per_step, now=now)

    def settle_step(
        self,
        reservation: Reservation,
        *,
        model: str,
        usage: dict | None,
        now: _datetime.datetime | None = None,
    ) -> dict:
        actual = self.prices.cost(model, usage)
        outcome = self.ledger.settle(reservation, actual=actual, reason=f"model:{model}", now=now)
        self.spent_this_run += outcome["charged"]
        return outcome
