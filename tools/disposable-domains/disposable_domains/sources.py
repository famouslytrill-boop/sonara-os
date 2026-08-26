"""Fetching the list from upstream, and refusing to save a bad download.

The failure this is built against is not a network error -- those are loud. It
is a *successful* fetch of something wrong: a truncated response, an HTML error
page served with status 200, or an upstream list that has been emptied. Any of
those, written straight over the blocklist, silently turns the protection off,
and nothing tells anybody until the spam arrives.

So a fetch is never written directly. It is parsed, counted, validated and
compared against what is already there, and it is only saved if it survives all
four.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen

# CC0 1.0 Universal -- a public domain dedication, verified from LICENSE.txt in
# that repository. No attribution condition, nothing to keep.
DEFAULT_SOURCES: tuple[str, ...] = (
    "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf",
)

# A real list has tens of thousands of entries. Anything under this is a
# truncated body or an error page, whatever status code came with it.
MINIMUM_PLAUSIBLE = 1000

# How much the list is allowed to shrink in one update before a person has to
# look. Lists do shrink -- domains die and get pruned -- but not by half.
MAX_SHRINK_FRACTION = 0.5


@dataclass
class FetchResult:
    domains: list[str]
    per_source: dict[str, int]
    errors: list[str]


def fetch(sources: tuple[str, ...] = DEFAULT_SOURCES, *, opener=None, timeout: int = 60) -> FetchResult:
    """Read every source. A source that fails is recorded, not fatal.

    One source of several being down is a reason to carry on with the rest and
    say so; it is not a reason to leave the list unupdated. Whether the merged
    result is good enough to save is decided afterwards, by size, not here.
    """
    fetch_one = opener or _default_opener
    merged: set[str] = set()
    per_source: dict[str, int] = {}
    errors: list[str] = []

    for url in sources:
        try:
            body = fetch_one(url, timeout)
        except Exception as error:  # noqa: BLE001 - every failure is reported the same way
            errors.append(f"{url}: {error}")
            per_source[url] = 0
            continue

        found = _parse(body)
        per_source[url] = len(found)
        merged.update(found)

    return FetchResult(sorted(merged), per_source, errors)


def _default_opener(url: str, timeout: int) -> str:
    request = Request(url, headers={"User-Agent": "disposable-domains/1.0"})
    with urlopen(request, timeout=timeout) as response:  # noqa: S310 - https URLs from a fixed list
        return response.read().decode("utf-8", errors="replace")


def _parse(body: str) -> list[str]:
    """One domain per line, ignoring comments and blanks. Nothing else is assumed."""
    out = []
    for raw in body.splitlines():
        line = raw.strip().lower().strip(".")
        if not line or line.startswith("#") or line.startswith("//"):
            continue
        # A source that hands back HTML looks like this. Do not try to be clever
        # about it -- just do not treat it as a domain.
        if "<" in line or " " in line:
            continue
        out.append(line)
    return out


def safe_to_replace(new: list[str], current: list[str]) -> str | None:
    """Why this download must not be saved, or None if it may be.

    Returns a sentence for a person, because every one of these is a decision
    somebody has to make rather than a condition to retry through.
    """
    if len(new) < MINIMUM_PLAUSIBLE:
        return (
            f"the fetched list has only {len(new)} domains, which is below the "
            f"{MINIMUM_PLAUSIBLE} a real list always has -- this is a truncated "
            "download or an error page, not a list"
        )
    if current and len(new) < len(current) * MAX_SHRINK_FRACTION:
        return (
            f"the fetched list has {len(new)} domains and the current one has "
            f"{len(current)}; a drop of more than half is not a normal prune"
        )
    return None
