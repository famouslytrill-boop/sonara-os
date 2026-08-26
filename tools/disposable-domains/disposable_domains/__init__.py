"""A disposable email domain blocklist, kept clean and valid.

    from disposable_domains import is_disposable

    is_disposable("someone@mailinator.com")   -> True
    is_disposable("foo.mailinator.com")       -> True   (subdomains count)
    is_disposable("someone@gmail.com")        -> False

That is the whole interface most callers need. Everything else in this package
is about keeping the file behind it correct.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from .publicsuffix import covering_entry
from .validate import load

# One copy, and it lives under lib/ rather than beside this tool.
#
# vercel.json bundles only {public/**,routes/**,lib/**} into the deployed
# function, so a list kept here would be present locally, absent in production,
# and the runtime check would quietly find nothing to flag -- passing every
# throwaway address while every test still went green. That is the exact defect
# this repository is organised against, so the data sits where it deploys and
# this tool reaches across to it.
#
# Used standalone, outside this repository, pass --blocklist.
BLOCKLIST = Path(__file__).resolve().parents[3] / "lib" / "sonara-disposable-domains.txt"

__all__ = ["is_disposable", "blocked_by", "domains", "BLOCKLIST"]


@lru_cache(maxsize=1)
def domains(path: Path | None = None) -> frozenset[str]:
    return frozenset(load(path or BLOCKLIST))


def blocked_by(value: str, path: Path | None = None) -> str | None:
    """Which entry blocks this address or domain, or None.

    Takes an email address or a bare domain, because callers have both and
    making them split it themselves is where the bugs go. Matching walks up the
    labels, so an entry for a provider covers every subdomain it hands out --
    which is the entire reason a provider hands them out.
    """
    text = (value or "").strip().lower().strip(".")
    if not text:
        return None
    if "@" in text:
        text = text.rsplit("@", 1)[-1]
    if not text:
        return None
    return covering_entry(text, domains(path))


def is_disposable(value: str, path: Path | None = None) -> bool:
    return blocked_by(value, path) is not None
