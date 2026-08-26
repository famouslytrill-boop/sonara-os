"""A run that cannot afford another step stops instead of overdrawing."""

import datetime
import unittest

from agentkit import (
    Agent,
    Budget,
    InsufficientCredits,
    Ledger,
    ModelPrice,
    PriceList,
    Runner,
    ScriptedClient,
    credits,
    to_credits,
)
from agentkit.errors import ProviderError
from agentkit.models import FunctionCall, LlmResponse


UTC = datetime.timezone.utc


def at(day, hour=0):
    return datetime.datetime(2026, 8, day, hour, tzinfo=UTC)


class MoneyIsIntegers(unittest.TestCase):
    def test_a_tenth_plus_two_tenths_is_exactly_three_tenths(self):
        # The oldest bug in money software. In floats this is 0.30000000000000004
        # and a balance drifts by a fraction per call.
        self.assertEqual(credits(0.1) + credits(0.2), credits(0.3))

    def test_rounds_half_away_from_zero_rather_than_to_even(self):
        # round() is banker's rounding: round(0.5) is 0. Correct for statistics,
        # surprising for money, and the surprise is always in the vendor's
        # favour or the customer's, never neither.
        self.assertEqual(credits(0.0000005), 1)
        self.assertEqual(credits(-0.0000005), -1)

    def test_display_conversion_round_trips(self):
        self.assertEqual(to_credits(credits(12.5)), 12.5)


class PriceListRefusesToInvent(unittest.TestCase):
    def test_an_unknown_model_raises_rather_than_defaulting(self):
        prices = PriceList({"known": ModelPrice(1, 1)})
        with self.assertRaises(KeyError) as caught:
            prices.for_model("never-costed")
        self.assertIn("never-costed", str(caught.exception))

    def test_a_default_is_available_but_has_to_be_asked_for(self):
        prices = PriceList({}, default=ModelPrice(2, 4))
        self.assertEqual(prices.for_model("anything").input_per_million, 2)

    def test_missing_usage_costs_None_and_not_zero(self):
        # The distinction the whole module turns on. A provider that reported
        # nothing has told us nothing, and zero is an answer.
        prices = PriceList({"m": ModelPrice(1_000_000, 1_000_000)})
        self.assertIsNone(prices.cost("m", None))
        self.assertIsNone(prices.cost("m", {}))
        self.assertIsNone(prices.cost("m", {"input_tokens": 10}))
        self.assertIsNone(prices.cost("m", {"input_tokens": "lots", "output_tokens": 3}))
        self.assertEqual(prices.cost("m", {"input_tokens": 10, "output_tokens": 5}), 15)

    def test_reads_the_other_common_key_names(self):
        prices = PriceList({"m": ModelPrice(1_000_000, 1_000_000)})
        self.assertEqual(prices.cost("m", {"prompt_tokens": 4, "completion_tokens": 6}), 10)

    def test_a_per_call_charge_applies_to_a_call_with_no_tokens(self):
        prices = PriceList({"m": ModelPrice(0, 0, per_call=credits(0.5))})
        self.assertEqual(prices.cost("m", {"input_tokens": 0, "output_tokens": 0}), credits(0.5))


class CreditsExpire(unittest.TestCase):
    def test_the_balance_is_a_function_of_time(self):
        ledger = Ledger()
        ledger.grant(credits(10), expires_at=at(10), now=at(1))
        self.assertEqual(ledger.balance_at(at(9)), credits(10))
        self.assertEqual(ledger.balance_at(at(11)), 0)

    def test_an_already_expired_grant_is_refused_rather_than_swallowed(self):
        # Accepting it would show as credits given in the history and nothing in
        # the balance, which is the shape of a support ticket.
        ledger = Ledger()
        with self.assertRaises(ValueError):
            ledger.grant(credits(5), expires_at=at(1), now=at(2))

    def test_spends_the_soonest_expiring_grant_first(self):
        # The order is the point. Spending the newest first lets an older grant
        # expire unused, which is somebody's money thrown away by an
        # implementation detail.
        ledger = Ledger()
        ledger.grant(credits(10), expires_at=at(20), reason="later", now=at(1))
        ledger.grant(credits(10), expires_at=at(10), reason="sooner", now=at(1))

        ledger.spend(credits(10), now=at(2))

        # The sooner one is gone, the later one is untouched, so nothing is lost
        # when day 10 passes.
        self.assertEqual(ledger.balance_at(at(11)), credits(10))

    def test_a_never_expiring_grant_is_spent_last(self):
        ledger = Ledger()
        ledger.grant(credits(10), reason="forever", now=at(1))
        ledger.grant(credits(10), expires_at=at(10), reason="sooner", now=at(1))
        ledger.spend(credits(10), now=at(2))
        self.assertEqual(ledger.balance_at(at(11)), credits(10))

    def test_can_warn_about_what_is_about_to_be_lost(self):
        ledger = Ledger()
        ledger.grant(credits(7), expires_at=at(10), now=at(1))
        ledger.grant(credits(3), expires_at=at(30), now=at(1))
        self.assertEqual(ledger.expiring_before(at(15), now=at(2)), credits(7))


class ReservingBeforeSpending(unittest.TestCase):
    def test_reserved_credits_are_not_available_to_anybody_else(self):
        ledger = Ledger()
        ledger.grant(credits(10), now=at(1))
        ledger.reserve(credits(6), now=at(1))
        self.assertEqual(ledger.balance_at(at(1)), credits(10))
        self.assertEqual(ledger.available_at(at(1)), credits(4))

    def test_reserving_more_than_is_there_raises_with_both_numbers(self):
        ledger = Ledger()
        ledger.grant(credits(2), now=at(1))
        with self.assertRaises(InsufficientCredits) as caught:
            ledger.reserve(credits(5), now=at(1))
        self.assertEqual(caught.exception.needed, credits(5))
        self.assertEqual(caught.exception.available, credits(2))

    def test_the_context_manager_releases_even_when_the_body_raises(self):
        # A leaked reservation looks exactly like a customer who has run out:
        # available_at falls with no matching spend in history.
        ledger = Ledger()
        ledger.grant(credits(10), now=at(1))
        with self.assertRaises(RuntimeError):
            with ledger.reserve(credits(6), now=at(1)):
                raise RuntimeError("the call blew up")
        self.assertEqual(ledger.available_at(at(1)), credits(10))

    def test_settling_with_a_real_cost_charges_that_and_not_the_estimate(self):
        ledger = Ledger()
        ledger.grant(credits(10), now=at(1))
        reservation = ledger.reserve(credits(5), now=at(1))
        outcome = ledger.settle(reservation, actual=credits(2), now=at(1))
        self.assertEqual(outcome["charged"], credits(2))
        self.assertFalse(outcome["estimated"])
        self.assertEqual(ledger.balance_at(at(1)), credits(8))
        self.assertEqual(ledger.available_at(at(1)), credits(8))

    def test_settling_with_no_reported_usage_charges_the_estimate(self):
        # Charging nothing would make a provider that reports nothing the
        # cheapest one available, which is the wrong incentive to build in.
        ledger = Ledger()
        ledger.grant(credits(10), now=at(1))
        reservation = ledger.reserve(credits(5), now=at(1))
        outcome = ledger.settle(reservation, actual=None, now=at(1))
        self.assertEqual(outcome["charged"], credits(5))
        self.assertTrue(outcome["estimated"])

    def test_settlement_may_overdraw_because_the_work_already_happened(self):
        # Refusing to record a call that really happened would leave the ledger
        # claiming a balance the provider has already billed against.
        ledger = Ledger()
        ledger.grant(credits(1), now=at(1))
        reservation = ledger.reserve(credits(1), now=at(1))
        outcome = ledger.settle(reservation, actual=credits(9), now=at(1))
        self.assertEqual(outcome["requested"], credits(9))
        self.assertEqual(outcome["charged"], credits(1))
        self.assertEqual(ledger.history()[-1]["unfunded"], credits(8))

    def test_spending_more_than_is_there_raises_unless_overdraft_is_asked_for(self):
        ledger = Ledger()
        ledger.grant(credits(1), now=at(1))
        with self.assertRaises(InsufficientCredits):
            ledger.spend(credits(5), now=at(1))


class BudgetRefusesAZeroEstimate(unittest.TestCase):
    def test_a_zero_estimate_is_refused_because_it_reserves_nothing(self):
        # A zero reservation always succeeds, so the check before each call
        # becomes one that always passes -- a budget that cannot refuse.
        with self.assertRaises(ValueError):
            Budget(Ledger(), PriceList(), estimate_per_step=0)


class RunnerStopsBeforeItOverdraws(unittest.TestCase):
    def _agent(self):
        return Agent(name="assistant", instruction="Answer briefly.", model="m")

    def _prices(self):
        return PriceList({"m": ModelPrice(1_000_000, 1_000_000)})

    def test_a_run_with_enough_credit_finishes_and_is_charged_the_real_cost(self):
        ledger = Ledger()
        ledger.grant(credits(100))
        budget = Budget(ledger, self._prices(), estimate_per_step=credits(10))
        client = ScriptedClient([LlmResponse(text="done", usage={"input_tokens": 3, "output_tokens": 4})])

        result = Runner(self._agent(), client=client, budget=budget).run("hello")

        self.assertEqual(result.stop_reason, "final")
        self.assertTrue(result.finished)
        self.assertEqual(ledger.spent_total(), 7)
        # And the reservation did not linger.
        self.assertEqual(ledger.available_at(), ledger.balance_at())

    def test_a_run_that_cannot_afford_a_step_stops_and_says_so(self):
        ledger = Ledger()
        ledger.grant(credits(5))
        budget = Budget(ledger, self._prices(), estimate_per_step=credits(10))
        client = ScriptedClient([LlmResponse(text="never reached", usage={"input_tokens": 1, "output_tokens": 1})])

        result = Runner(self._agent(), client=client, budget=budget).run("hello")

        self.assertEqual(result.stop_reason, "budget_exhausted")
        self.assertFalse(result.finished)
        self.assertEqual(result.steps, 0)
        # The point of checking first: nothing was spent, because nothing was
        # called.
        self.assertEqual(ledger.spent_total(), 0)
        self.assertEqual(ledger.balance_at(), credits(5))

    def test_the_refusal_is_recorded_in_the_session_log(self):
        ledger = Ledger()
        ledger.grant(credits(1))
        budget = Budget(ledger, self._prices(), estimate_per_step=credits(10))
        result = Runner(self._agent(), client=ScriptedClient([LlmResponse(text="x")]), budget=budget).run("hi")
        kinds = [event.kind for event in result.session.events]
        self.assertIn("budget", kinds)

    def test_a_provider_error_releases_the_reservation_rather_than_leaking_it(self):
        class Exploding(ScriptedClient):
            def generate(self, **_kwargs):
                raise ProviderError("upstream fell over", status=500)

        ledger = Ledger()
        ledger.grant(credits(50))
        budget = Budget(ledger, self._prices(), estimate_per_step=credits(10))

        with self.assertRaises(ProviderError):
            Runner(self._agent(), client=Exploding([]), budget=budget).run("hello")

        # Released, not charged: the call failed and nobody got an answer.
        self.assertEqual(ledger.available_at(), credits(50))
        self.assertEqual(ledger.spent_total(), 0)

    def test_a_per_run_cap_stops_a_run_the_ledger_could_still_afford(self):
        # The two limits are different questions: "can this customer pay" and
        # "should this one run be allowed to cost that much".
        ledger = Ledger()
        ledger.grant(credits(1000))
        budget = Budget(
            ledger, self._prices(), estimate_per_step=credits(10), max_per_run=credits(15)
        )
        client = ScriptedClient(
            [
                LlmResponse(
                    calls=[FunctionCall(name="nothing", arguments={})],
                    usage={"input_tokens": 6_000_000, "output_tokens": 6_000_000},
                ),
                LlmResponse(text="second", usage={"input_tokens": 1, "output_tokens": 1}),
            ]
        )
        result = Runner(self._agent(), client=client, budget=budget).run("hello")
        self.assertEqual(result.stop_reason, "budget_exhausted")
        # The ledger is nowhere near empty; the run's own cap is what stopped it.
        self.assertGreater(ledger.balance_at(), credits(900))

    def test_a_run_with_no_budget_is_unchanged(self):
        # The budget is optional and must stay optional: every existing caller
        # constructs a Runner without one.
        client = ScriptedClient([LlmResponse(text="fine", usage={"input_tokens": 1, "output_tokens": 1})])
        result = Runner(self._agent(), client=client).run("hello")
        self.assertEqual(result.stop_reason, "final")

    def test_an_unreported_usage_charge_is_marked_estimated_in_the_log(self):
        ledger = Ledger()
        ledger.grant(credits(100))
        budget = Budget(ledger, self._prices(), estimate_per_step=credits(10))
        client = ScriptedClient([LlmResponse(text="done")])  # no usage at all

        result = Runner(self._agent(), client=client, budget=budget).run("hello")

        charged = [e for e in result.session.events if e.kind == "budget"]
        self.assertTrue(charged)
        self.assertTrue(charged[-1].data.get("estimated"))
        self.assertEqual(ledger.spent_total(), credits(10))


if __name__ == "__main__":
    unittest.main()
