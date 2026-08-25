"""Public suffix rules, and the one mistake this whole tool exists to prevent.

A blocklist that contains a public suffix is a catastrophe rather than a bug.
``co.uk`` is not a domain anybody registers -- it is the boundary under which
every British company registers -- so an entry for it blocks every customer in
the country. The same goes for ``com``, ``github.io``, ``s3.amazonaws.com`` and
around ten thousand others, most of which do not look like suffixes at a glance.

The list of them is Mozilla's Public Suffix List. It is a data file under
MPL-2.0, which is file-level copyleft: the obligation attaches to that file and
not to anything that reads it.

Nothing here silently degrades. If no cached copy of the list is available, the
suffix rules are reported as UNCHECKED rather than passed -- a validator that
answers "fine" because it could not look is the failure mode this tool is
supposed to catch in other people's blocklists.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

PUBLIC_SUFFIX_URL = "https://publicsuffix.org/list/public_suffix_list.dat"

DEFAULT_CACHE = Path(
    os.environ.get("DISPOSABLE_DOMAINS_CACHE", Path(__file__).resolve().parent.parent / ".cache")
)


@dataclass(frozen=True)
class PublicSuffixList:
    """Exact rules, wildcard rules and exceptions, as the PSL format defines them."""

    exact: frozenset[str]
    wildcard: frozenset[str]
    exception: frozenset[str]

    @classmethod
    def parse(cls, text: str) -> "PublicSuffixList":
        exact: set[str] = set()
        wildcard: set[str] = set()
        exception: set[str] = set()
        for raw in text.splitlines():
            line = raw.strip()
            # "//" is a comment in this format, and a blank line is nothing.
            if not line or line.startswith("//"):
                continue
            if line.startswith("!"):
                exception.add(line[1:].lower())
            elif line.startswith("*."):
                wildcard.add(line[2:].lower())
            else:
                exact.add(line.lower())
        return cls(frozenset(exact), frozenset(wildcard), frozenset(exception))

    def is_public_suffix(self, domain: str) -> bool:
        """Is this name itself a suffix, rather than something registered under one?"""
        domain = domain.lower().strip(".")
        if not domain:
            return False
        if domain in self.exception:
            return False
        if domain in self.exact:
            return True
        # A wildcard rule makes every direct child a suffix: "*.ck" means
        # "anything.ck" is a suffix, so a domain is only registrable one level
        # below that.
        parent = domain.split(".", 1)[1] if "." in domain else ""
        return bool(parent) and parent in self.wildcard

    def registrable_domain(self, domain: str) -> str | None:
        """The name somebody actually registered: the public suffix plus one label.

        Returns None when the input *is* a suffix, or is otherwise not something
        that can be registered. None is not an error -- it is the answer that
        stops a suffix being written into a blocklist.
        """
        domain = domain.lower().strip(".")
        if not domain:
            return None
        labels = domain.split(".")
        for i in range(len(labels)):
            candidate = ".".join(labels[i:])
            if self.is_public_suffix(candidate):
                # The registrable name is one label further left. If there is no
                # label further left, the input was the suffix itself.
                if i == 0:
                    return None
                return ".".join(labels[i - 1 :])
        # No rule matched at all. The PSL's own default is that an unknown TLD
        # behaves like "*", so the registrable name is the last two labels.
        return ".".join(labels[-2:]) if len(labels) >= 2 else None


def cache_path(cache_dir: Path | None = None) -> Path:
    return (cache_dir or DEFAULT_CACHE) / "public_suffix_list.dat"


def load_cached(cache_dir: Path | None = None) -> PublicSuffixList | None:
    """The cached list, or None. None means unchecked, never 'nothing to check'."""
    path = cache_path(cache_dir)
    if not path.is_file():
        return None
    try:
        return PublicSuffixList.parse(path.read_text(encoding="utf-8"))
    except OSError:
        return None


def download(cache_dir: Path | None = None, *, opener=None) -> PublicSuffixList:
    """Fetch and cache the list. Network is only ever touched from here."""
    from urllib.request import urlopen

    fetch = opener or urlopen
    with fetch(PUBLIC_SUFFIX_URL, timeout=30) as response:  # noqa: S310 - fixed https URL
        text = response.read().decode("utf-8")

    parsed = PublicSuffixList.parse(text)
    # Refuse to cache something that is not the list. A truncated download that
    # parses to twelve rules would quietly make every domain look registrable.
    if len(parsed.exact) < 1000:
        raise ValueError(
            f"the downloaded public suffix list has only {len(parsed.exact)} exact rules, "
            "which means it is truncated or is not the list; refusing to cache it"
        )

    path = cache_path(cache_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return parsed


def covering_entry(domain: str, blocked: Iterable[str]) -> str | None:
    """Which blocklist entry, if any, already covers this domain.

    A blocklist works by suffix: an entry for ``mailinator.com`` must catch
    ``foo.mailinator.com`` too, or every provider defeats it by handing out a
    subdomain. This is the function that decides that, and it matches on label
    boundaries -- ``notmailinator.com`` must not be caught by ``mailinator.com``.
    """
    domain = domain.lower().strip(".")
    blocked_set = {b.lower().strip(".") for b in blocked}
    labels = domain.split(".")
    for i in range(len(labels)):
        candidate = ".".join(labels[i:])
        if candidate in blocked_set:
            return candidate
    return None
