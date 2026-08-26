"""Reading the blocklist, saying what is wrong with it, and fixing what is safe to fix.

The file format is deliberately the dullest thing that works: one domain per
line, lowercase, ASCII, sorted, no comments, no blank lines, trailing newline.
Anything can read it -- grep, a shell loop, a Postgres COPY, twelve lines of
whatever language somebody actually uses -- and nothing has to be parsed.

Two rules do the real work.

**A public suffix must never appear.** ``co.uk`` is not a domain anybody
registers; it is the boundary under which every British company registers, so an
entry for it blocks a whole country. This is not a formatting problem and
``fix`` will not quietly delete it: removing an entry somebody deliberately
added is a destructive change, so it takes ``--drop-public-suffixes`` and says
exactly what it removed.

**An entry covered by another entry is redundant.** If ``mailinator.com`` is
listed then ``foo.mailinator.com`` is already blocked -- matching walks up the
labels -- so the second line is noise that makes the file bigger and the diffs
worse. That one is safe to fix, because deleting it changes nothing about which
addresses are blocked.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from .publicsuffix import PublicSuffixList, covering_entry

# Letters, digits and hyphens, not starting or ending with a hyphen, 1 to 63
# characters. Underscores are legal in DNS but never in a registrable hostname,
# and allowing them here would admit typos that can never match anything.
LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")

MAX_DOMAIN_LENGTH = 253


@dataclass
class Problem:
    line: int          # 1-based; 0 when the problem is about the file as a whole
    code: str
    domain: str
    message: str
    fixable: bool

    def __str__(self) -> str:
        where = f"line {self.line}" if self.line else "file"
        return f"{where}: {self.code}: {self.message}"


@dataclass
class Report:
    problems: list[Problem] = field(default_factory=list)
    domains: list[str] = field(default_factory=list)
    suffix_rules_checked: bool = False

    @property
    def ok(self) -> bool:
        return not self.problems

    @property
    def fixable(self) -> bool:
        return bool(self.problems) and all(p.fixable for p in self.problems)

    def summary(self) -> str:
        lines = [f"{len(self.domains)} domains, {len(self.problems)} problem(s)."]
        if not self.suffix_rules_checked:
            # Loud, because the alternative is a validator that answers "fine"
            # about the one rule that matters most, having never looked.
            lines.append(
                "PUBLIC SUFFIX RULES WERE NOT CHECKED: no cached list. "
                "Run `update --suffixes-only` first, or pass --allow-unchecked-suffixes "
                "if you accept that a whole-TLD entry could pass unnoticed."
            )
        return "\n".join(lines)


def normalise(raw: str) -> tuple[str | None, str | None]:
    """One line as it should be stored, plus a note about what was changed.

    Returns (domain, note). A domain of None means the line cannot be repaired
    into something that could ever match an address.
    """
    text = raw.strip().strip(".")
    if not text:
        return None, "blank"

    notes = []
    if text != raw.strip():
        notes.append("stripped a trailing dot")
    lowered = text.lower()
    if lowered != text:
        notes.append("lowercased")
    text = lowered

    if not text.isascii():
        # An internationalised name has exactly one storable form, and it is the
        # punycode one. Storing the Unicode spelling means the list never
        # matches the address a mail server actually sees.
        try:
            text = text.encode("idna").decode("ascii")
            notes.append("converted to punycode")
        except (UnicodeError, ValueError):
            return None, "not a domain name this can encode"

    return text, ", ".join(notes) or None


def domain_problems(domain: str) -> str | None:
    """Why this string could never be a registrable domain, or None if it could."""
    if len(domain) > MAX_DOMAIN_LENGTH:
        return f"longer than {MAX_DOMAIN_LENGTH} characters"
    labels = domain.split(".")
    if len(labels) < 2:
        return "has no dot, so it is a bare label rather than a domain"
    for label in labels:
        if not label:
            return "has an empty label"
        if not LABEL.match(label):
            return f"label {label!r} is not letters, digits and inner hyphens"
    return None


def check(
    path: Path,
    suffixes: PublicSuffixList | None = None,
    *,
    allow_unchecked_suffixes: bool = False,
) -> Report:
    """Read the file and report everything wrong with it, in file order."""
    report = Report()
    text = path.read_text(encoding="utf-8")
    raw_lines = text.split("\n")

    # A file that does not end in exactly one newline is a diff that touches the
    # last line every time somebody appends.
    if text and not text.endswith("\n"):
        report.problems.append(Problem(0, "no_trailing_newline", "", "the file does not end with a newline", True))
    if text.endswith("\n\n"):
        report.problems.append(Problem(0, "trailing_blank_line", "", "the file ends with a blank line", True))
    if raw_lines and raw_lines[-1] == "":
        raw_lines = raw_lines[:-1]

    seen: dict[str, int] = {}
    kept: list[str] = []
    for index, raw in enumerate(raw_lines, start=1):
        if raw.strip() == "":
            report.problems.append(Problem(index, "blank_line", "", "blank line", True))
            continue
        if raw.lstrip().startswith("#") or raw.lstrip().startswith("//"):
            report.problems.append(Problem(index, "comment", raw.strip(), "the format carries no comments", True))
            continue

        domain, note = normalise(raw)
        if domain is None:
            report.problems.append(Problem(index, "unusable", raw.strip(), f"cannot be stored: {note}", False))
            continue
        if note:
            report.problems.append(Problem(index, "formatting", domain, note, True))

        why = domain_problems(domain)
        if why:
            report.problems.append(Problem(index, "not_a_domain", domain, why, False))
            continue

        if domain in seen:
            report.problems.append(
                Problem(index, "duplicate", domain, f"already listed on line {seen[domain]}", True)
            )
            continue
        seen[domain] = index
        kept.append(domain)

    if suffixes is not None:
        report.suffix_rules_checked = True
        for domain in kept:
            if suffixes.is_public_suffix(domain):
                report.problems.append(
                    Problem(
                        seen[domain],
                        "public_suffix",
                        domain,
                        "this is a public suffix, not a registrable domain -- blocking it blocks "
                        "everyone who registers under it",
                        False,
                    )
                )
    elif not allow_unchecked_suffixes:
        report.problems.append(
            Problem(
                0,
                "suffixes_unchecked",
                "",
                "no cached public suffix list, so the most dangerous rule was not checked",
                False,
            )
        )

    # Redundancy, checked against every other entry rather than against the
    # whole file including itself.
    kept_set = set(kept)
    for domain in kept:
        cover = covering_entry(domain, kept_set - {domain})
        if cover:
            report.problems.append(
                Problem(seen[domain], "redundant", domain, f"already covered by {cover}", True)
            )

    ordered = sorted(kept)
    if kept != ordered:
        report.problems.append(Problem(0, "unsorted", "", "the file is not in sorted order", True))

    report.domains = ordered
    return report


def fix(
    path: Path,
    suffixes: PublicSuffixList | None = None,
    *,
    drop_public_suffixes: bool = False,
    allow_unchecked_suffixes: bool = False,
) -> tuple[Report, list[str]]:
    """Rewrite the file into the canonical form. Returns the report and what was removed.

    Refuses when a problem is not fixable -- an unparseable line or a public
    suffix entry is a decision for a person, and writing the file anyway would
    silently drop it.
    """
    report = check(path, suffixes, allow_unchecked_suffixes=allow_unchecked_suffixes)

    blocking = [p for p in report.problems if not p.fixable]
    removed: list[str] = []
    domains = list(report.domains)

    if drop_public_suffixes and suffixes is not None:
        suffix_entries = [p.domain for p in blocking if p.code == "public_suffix"]
        if suffix_entries:
            domains = [d for d in domains if d not in set(suffix_entries)]
            removed.extend(sorted(suffix_entries))
            blocking = [p for p in blocking if p.code != "public_suffix"]

    if blocking:
        return report, removed

    # Redundant entries are dropped, which changes nothing about what is
    # blocked: the covering entry already catches every address they would.
    if suffixes is not None or True:
        pruned = []
        as_set = set(domains)
        for domain in domains:
            if covering_entry(domain, as_set - {domain}):
                removed.append(domain)
                continue
            pruned.append(domain)
        domains = pruned

    write(path, domains)
    return report, sorted(set(removed))


def write(path: Path, domains: list[str]) -> None:
    """One domain per line, sorted, deduplicated, one trailing newline."""
    unique = sorted(set(domains))
    path.write_text("\n".join(unique) + "\n" if unique else "", encoding="utf-8")


def load(path: Path) -> list[str]:
    """The domains, for anybody who just wants the list."""
    if not path.is_file():
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
