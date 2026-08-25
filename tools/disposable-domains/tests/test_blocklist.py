"""Tests for the parts where being subtly wrong is invisible.

The dangerous failures in a blocklist tool are not crashes. They are:

* a public suffix getting into the list, which blocks a whole country;
* a subdomain not matching its parent, which lets every provider defeat the
  list by handing out ``anything.theirdomain.com``;
* a bad download overwriting a good list, which turns the protection off
  silently;
* a validator reporting "clean" about a rule it never checked.

Each has a test named after it.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from disposable_domains import blocked_by, is_disposable  # noqa: E402
from disposable_domains.publicsuffix import PublicSuffixList, covering_entry  # noqa: E402
from disposable_domains.sources import _parse, safe_to_replace  # noqa: E402
from disposable_domains.validate import check, fix, load, normalise, write  # noqa: E402

PSL = PublicSuffixList.parse(
    """
// a small but structurally complete list
com
net
uk
co.uk
io
github.io
ck
*.ck
!www.ck
"""
)


def blocklist(tmp_path: Path, *lines: str) -> Path:
    path = tmp_path / "blocklist.txt"
    path.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")
    return path


class TestPublicSuffix:
    def test_the_fixture_is_capable_of_failing(self):
        assert len(PSL.exact) >= 6, "the fixture list is nearly empty; every check below is vacuous"

    @pytest.mark.parametrize("suffix", ["com", "co.uk", "github.io", "uk"])
    def test_recognises_a_suffix(self, suffix):
        assert PSL.is_public_suffix(suffix)

    @pytest.mark.parametrize("domain", ["example.com", "example.co.uk", "someone.github.io"])
    def test_a_registrable_domain_is_not_a_suffix(self, domain):
        assert not PSL.is_public_suffix(domain)

    def test_wildcard_and_exception_rules(self):
        # "*.ck" makes every direct child a suffix, and "!www.ck" carves one out.
        assert PSL.is_public_suffix("anything.ck")
        assert not PSL.is_public_suffix("www.ck")

    def test_registrable_domain_walks_to_the_boundary(self):
        assert PSL.registrable_domain("a.b.example.co.uk") == "example.co.uk"
        assert PSL.registrable_domain("example.com") == "example.com"

    def test_a_suffix_has_no_registrable_form(self):
        assert PSL.registrable_domain("co.uk") is None
        assert PSL.registrable_domain("com") is None


class TestMatching:
    def test_a_subdomain_is_caught_by_its_parent(self):
        # The whole reason providers hand out subdomains.
        assert covering_entry("foo.mailinator.com", {"mailinator.com"}) == "mailinator.com"
        assert covering_entry("a.b.c.mailinator.com", {"mailinator.com"}) == "mailinator.com"

    def test_a_lookalike_is_not_caught(self):
        # Matching on a string suffix rather than on label boundaries would
        # block this, and it is somebody else's domain.
        assert covering_entry("notmailinator.com", {"mailinator.com"}) is None
        assert covering_entry("mailinator.com.example.org", {"mailinator.com"}) is None

    def test_takes_an_address_or_a_domain(self, tmp_path):
        path = blocklist(tmp_path, "mailinator.com")
        assert is_disposable("someone@mailinator.com", path)
        assert is_disposable("MAILINATOR.COM", path)
        assert is_disposable("foo.mailinator.com", path)
        assert not is_disposable("someone@gmail.com", path)
        assert blocked_by("x@foo.mailinator.com", path) == "mailinator.com"

    @pytest.mark.parametrize("value", ["", "   ", "@", "someone@", None])
    def test_nonsense_is_not_blocked_and_does_not_raise(self, value, tmp_path):
        path = blocklist(tmp_path, "mailinator.com")
        assert blocked_by(value, path) is None


class TestValidation:
    def test_a_clean_file_has_no_problems(self, tmp_path):
        path = blocklist(tmp_path, "aaa.com", "bbb.com")
        report = check(path, PSL)
        assert report.problems == []
        assert report.ok

    def test_refuses_a_public_suffix_and_says_why(self, tmp_path):
        path = blocklist(tmp_path, "co.uk", "mailinator.com")
        report = check(path, PSL)
        codes = [p.code for p in report.problems]
        assert "public_suffix" in codes
        problem = next(p for p in report.problems if p.code == "public_suffix")
        assert not problem.fixable, "a public suffix must never be silently fixable"
        assert "blocks everyone" in problem.message

    def test_reports_unchecked_rather_than_clean_without_a_suffix_list(self, tmp_path):
        path = blocklist(tmp_path, "co.uk")
        report = check(path, None)
        assert not report.ok, "a file with a public suffix passed because nothing looked"
        assert report.suffix_rules_checked is False
        assert "suffixes_unchecked" in [p.code for p in report.problems]
        assert "NOT CHECKED" in report.summary()

    def test_finds_case_duplicates_blanks_and_disorder(self, tmp_path):
        path = blocklist(tmp_path, "BBB.com", "aaa.com", "", "aaa.com")
        codes = {p.code for p in check(path, PSL).problems}
        assert {"formatting", "blank_line", "duplicate", "unsorted"} <= codes

    def test_finds_an_entry_covered_by_another(self, tmp_path):
        path = blocklist(tmp_path, "foo.mailinator.com", "mailinator.com")
        problem = next(p for p in check(path, PSL).problems if p.code == "redundant")
        assert problem.domain == "foo.mailinator.com"
        assert problem.fixable, "removing a redundant entry changes nothing about what is blocked"

    @pytest.mark.parametrize("bad", ["nodot", "has space.com", "-lead.com", "trail-.com", "a..b.com"])
    def test_rejects_what_could_never_match(self, bad, tmp_path):
        path = blocklist(tmp_path, bad)
        codes = {p.code for p in check(path, PSL).problems}
        assert codes & {"not_a_domain", "unusable"}, f"{bad!r} was accepted"

    def test_normalises_an_internationalised_name_to_punycode(self):
        domain, note = normalise("MÜLL.example")
        assert domain is not None
        assert domain.startswith("xn--"), "a Unicode spelling never matches what a mail server sees"
        assert "punycode" in note


class TestFix:
    def test_produces_a_file_that_passes_check(self, tmp_path):
        path = blocklist(tmp_path, "BBB.com", "aaa.com", "", "aaa.com", "foo.bbb.com")
        fix(path, PSL)
        after = check(path, PSL)
        assert after.ok, [str(p) for p in after.problems]
        assert load(path) == ["aaa.com", "bbb.com"]

    def test_will_not_write_while_a_public_suffix_is_present(self, tmp_path):
        path = blocklist(tmp_path, "co.uk", "BBB.com")
        before = path.read_text(encoding="utf-8")
        fix(path, PSL)
        assert path.read_text(encoding="utf-8") == before, "fix wrote the file despite an unfixable problem"

    def test_removes_a_public_suffix_only_when_told_to_and_names_it(self, tmp_path):
        path = blocklist(tmp_path, "co.uk", "bbb.com")
        _, removed = fix(path, PSL, drop_public_suffixes=True)
        assert "co.uk" in removed
        assert load(path) == ["bbb.com"]

    def test_is_idempotent(self, tmp_path):
        path = blocklist(tmp_path, "BBB.com", "aaa.com", "foo.aaa.com")
        fix(path, PSL)
        once = path.read_text(encoding="utf-8")
        fix(path, PSL)
        assert path.read_text(encoding="utf-8") == once

    def test_writes_one_trailing_newline(self, tmp_path):
        path = tmp_path / "b.txt"
        write(path, ["b.com", "a.com"])
        text = path.read_text(encoding="utf-8")
        assert text == "a.com\nb.com\n"


class TestSources:
    def test_ignores_comments_blanks_and_html(self):
        parsed = _parse("# a comment\n\nmailinator.com\n<html>\nfoo bar\nYOPMAIL.com\n")
        assert parsed == ["mailinator.com", "yopmail.com"]

    def test_refuses_a_truncated_download(self):
        reason = safe_to_replace(["a.com"], ["a.com"] * 5000)
        assert reason is not None
        assert "truncated" in reason

    def test_refuses_a_download_that_halves_the_list(self):
        current = [f"d{i}.com" for i in range(5000)]
        new = [f"d{i}.com" for i in range(2000)]
        reason = safe_to_replace(new, current)
        assert reason is not None
        assert "half" in reason

    def test_accepts_a_normal_update(self):
        current = [f"d{i}.com" for i in range(5000)]
        new = [f"d{i}.com" for i in range(5200)]
        assert safe_to_replace(new, current) is None

    def test_accepts_a_first_run_against_an_empty_list(self):
        assert safe_to_replace([f"d{i}.com" for i in range(2000)], []) is None


class TestShippedList:
    """The file people actually get."""

    path = Path(__file__).resolve().parent.parent / "blocklist.txt"

    def test_exists_and_is_substantial(self):
        assert self.path.is_file(), "the shipped blocklist is missing"
        assert len(load(self.path)) > 1000, "the shipped blocklist is too small to be a real one"

    def test_is_sorted_lowercase_and_unique(self):
        domains = load(self.path)
        assert domains == sorted(domains), "the shipped list is not sorted"
        assert len(domains) == len(set(domains)), "the shipped list has duplicates"
        assert all(d == d.lower() for d in domains), "the shipped list is not all lowercase"

    def test_blocks_providers_everybody_knows(self):
        for known in ["mailinator.com", "yopmail.com"]:
            assert is_disposable(known, self.path), f"{known} is not in the shipped list"

    def test_does_not_block_real_mail_providers(self):
        # The single worst thing this file could do.
        for real in ["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "protonmail.com"]:
            assert not is_disposable(f"someone@{real}", self.path), f"the shipped list blocks {real}"
