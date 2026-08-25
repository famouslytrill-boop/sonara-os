"""The command line.

    blocklist check     say what is wrong, change nothing, exit non-zero if anything is
    blocklist fix       rewrite the file into canonical form
    blocklist update    fetch upstream, verify, and only then save
    blocklist match     ask whether one address or domain is blocked

`check` is what a CI job runs and `fix` is what a person runs. They share the
same validator, so a file that `fix` produced always passes `check` -- if that
ever stops being true, one of them is wrong and the test says which.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import blocked_by
from .publicsuffix import download, load_cached
from .sources import DEFAULT_SOURCES, fetch, safe_to_replace
from .validate import check, fix, load, write

DEFAULT_BLOCKLIST = Path(__file__).resolve().parent.parent / "blocklist.txt"


def _suffixes(args) -> object | None:
    cached = load_cached(Path(args.cache) if args.cache else None)
    if cached is None and not args.allow_unchecked_suffixes:
        print(
            "No cached public suffix list. Run `blocklist update --suffixes-only` first,\n"
            "or pass --allow-unchecked-suffixes to accept that a whole-TLD entry could\n"
            "pass unnoticed. This is not a warning that can be ignored safely: an entry\n"
            "for something like co.uk would block every customer in a country.",
            file=sys.stderr,
        )
    return cached


def cmd_check(args) -> int:
    path = Path(args.blocklist)
    if not path.is_file():
        print(f"No blocklist at {path}", file=sys.stderr)
        return 2
    report = check(path, _suffixes(args), allow_unchecked_suffixes=args.allow_unchecked_suffixes)
    for problem in report.problems:
        print(problem)
    print(report.summary())
    if report.ok:
        print("The blocklist is clean.")
        return 0
    if report.fixable:
        print("Every problem above is fixable: run `blocklist fix`.")
    return 1


def cmd_fix(args) -> int:
    path = Path(args.blocklist)
    if not path.is_file():
        print(f"No blocklist at {path}", file=sys.stderr)
        return 2
    before = load(path)
    report, removed = fix(
        path,
        _suffixes(args),
        drop_public_suffixes=args.drop_public_suffixes,
        allow_unchecked_suffixes=args.allow_unchecked_suffixes,
    )
    blocking = [p for p in report.problems if not p.fixable]
    if args.drop_public_suffixes:
        blocking = [p for p in blocking if p.code != "public_suffix"]
    if blocking:
        for problem in blocking:
            print(problem)
        print(
            "\nNot fixed, and nothing was written. Each of these is a decision for a person:\n"
            "an unusable line has to be corrected or deleted by hand, and a public suffix\n"
            "entry is removed only with --drop-public-suffixes so the removal is deliberate.",
            file=sys.stderr,
        )
        return 1

    after = load(path)
    for domain in removed:
        print(f"removed {domain}")
    print(f"{len(before)} domains in, {len(after)} out.")
    # A file fix() wrote must pass check(). If it does not, fix is wrong, and
    # saying so here is better than a CI job finding it tomorrow.
    again = check(path, _suffixes(args), allow_unchecked_suffixes=args.allow_unchecked_suffixes)
    if not again.ok:
        for problem in again.problems:
            print(problem, file=sys.stderr)
        print("fix produced a file that does not pass check; this is a bug in fix", file=sys.stderr)
        return 3
    print("The blocklist is clean.")
    return 0


def cmd_update(args) -> int:
    cache = Path(args.cache) if args.cache else None
    if args.suffixes_only or not args.skip_suffixes:
        try:
            suffixes = download(cache)
            print(f"public suffix list: {len(suffixes.exact)} exact rules cached")
        except Exception as error:  # noqa: BLE001
            print(f"could not refresh the public suffix list: {error}", file=sys.stderr)
            if args.suffixes_only:
                return 1
    if args.suffixes_only:
        return 0

    path = Path(args.blocklist)
    current = load(path)
    result = fetch(tuple(args.source) if args.source else DEFAULT_SOURCES)
    for url, count in result.per_source.items():
        print(f"{count:>7} from {url}")
    for error in result.errors:
        print(f"source failed: {error}", file=sys.stderr)

    refusal = safe_to_replace(result.domains, current)
    if refusal:
        print(f"\nNot saved: {refusal}", file=sys.stderr)
        print("The existing blocklist is untouched.", file=sys.stderr)
        return 1

    # Written to the real path, then validated, then rolled back if it does not
    # hold up. Validating first would mean validating something other than what
    # ends up on disk.
    backup = path.read_text(encoding="utf-8") if path.is_file() else None
    write(path, result.domains)
    report, removed = fix(
        path,
        load_cached(cache),
        drop_public_suffixes=args.drop_public_suffixes,
        allow_unchecked_suffixes=args.allow_unchecked_suffixes,
    )
    blocking = [p for p in report.problems if not p.fixable]
    if args.drop_public_suffixes:
        blocking = [p for p in blocking if p.code != "public_suffix"]
    if blocking:
        if backup is not None:
            path.write_text(backup, encoding="utf-8")
        for problem in blocking:
            print(problem, file=sys.stderr)
        print("\nNot saved: the fetched list does not validate. The previous one is back in place.", file=sys.stderr)
        return 1

    for domain in removed[:20]:
        print(f"removed {domain}")
    if len(removed) > 20:
        print(f"... and {len(removed) - 20} more")
    print(f"{len(current)} domains before, {len(load(path))} after.")
    return 0


def cmd_match(args) -> int:
    path = Path(args.blocklist)
    hit = blocked_by(args.value, path)
    if hit:
        print(f"blocked by {hit}")
        return 0
    print("not blocked")
    return 1


def _shared_parser() -> argparse.ArgumentParser:
    """The options that apply to every subcommand.

    These are parsed out of argv wherever they appear, before the subcommand is
    looked at, so `blocklist --cache X check` and `blocklist check --cache X`
    both work and mean the same thing.

    The obvious argparse approach -- declaring them on the top-level parser and
    again on each subparser via parents= -- looks like it works and does not: a
    shared option is then parsed twice, and the subcommand's copy lands last
    with its default, silently wiping out a value given before the subcommand.
    A flag that is accepted, ignored and reported as absent is worse than one
    that is rejected.
    """
    shared = argparse.ArgumentParser(add_help=False)
    shared.add_argument("--blocklist", default=None, help="path to the blocklist file")
    shared.add_argument("--cache", default=None, help="where the public suffix list is cached")
    shared.add_argument(
        "--allow-unchecked-suffixes",
        action="store_true",
        help="proceed without a public suffix list, accepting that a whole-TLD entry could pass",
    )
    return shared


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="blocklist",
        description="Keep a disposable email domain blocklist clean and valid.",
        epilog="--blocklist, --cache and --allow-unchecked-suffixes may go before or after the subcommand.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("check", help="report problems and change nothing").set_defaults(func=cmd_check)

    fix_parser = sub.add_parser("fix", help="rewrite the file into canonical form")
    fix_parser.add_argument(
        "--drop-public-suffixes",
        action="store_true",
        help="remove entries that are public suffixes, naming each one as it goes",
    )
    fix_parser.set_defaults(func=cmd_fix)

    update_parser = sub.add_parser("update", help="fetch upstream, verify, then save")
    update_parser.add_argument("--source", action="append", help="a source URL; repeatable, replaces the defaults")
    update_parser.add_argument("--suffixes-only", action="store_true", help="refresh only the public suffix list")
    update_parser.add_argument("--skip-suffixes", action="store_true", help="do not refresh the public suffix list")
    update_parser.add_argument("--drop-public-suffixes", action="store_true")
    update_parser.set_defaults(func=cmd_update)

    match_parser = sub.add_parser("match", help="ask whether one address or domain is blocked")
    match_parser.add_argument("value")
    match_parser.set_defaults(func=cmd_match)

    return parser


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    shared, rest = _shared_parser().parse_known_args(argv)
    args = build_parser().parse_args(rest)

    args.blocklist = shared.blocklist or str(DEFAULT_BLOCKLIST)
    args.cache = shared.cache
    args.allow_unchecked_suffixes = shared.allow_unchecked_suffixes
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
