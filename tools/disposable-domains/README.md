# disposable-domains

A plain text list of disposable email domains, and the tooling to keep it
correct.

```
blocklist.txt      one domain per line, lowercase, sorted, deduplicated
```

That is the deliverable. Everything else here exists to stop that file going
wrong, because a blocklist is exactly the kind of file nobody looks at until it
has been broken for a month.

## Use it

No install, no dependency, no import needed — it is a text file:

```bash
grep -Fxq "mailinator.com" blocklist.txt && echo blocked
```

From Python, if you want subdomain matching handled for you:

```python
from disposable_domains import is_disposable, blocked_by

is_disposable("someone@mailinator.com")   # True
is_disposable("foo.mailinator.com")       # True  -- subdomains count
is_disposable("someone@gmail.com")        # False
blocked_by("x@a.b.mailinator.com")        # "mailinator.com"
```

Matching walks up the labels, which matters more than it looks: a provider that
hands out `yourname.theirdomain.com` defeats any list that only compares whole
strings. It matches on label boundaries, so `notmailinator.com` is **not**
caught by an entry for `mailinator.com`.

## Maintain it

```bash
make check     # validate; exits non-zero if anything is wrong. This is the CI command.
make fix       # rewrite into canonical form
make update    # fetch upstream, verify, and only then save
make test      # run the tests
```

`make` builds the virtual environment on first run, so there is no setup step to
forget. The tool itself uses **only the standard library** — pytest is the sole
dependency and only for the tests. A maintenance script that stops running
because a dependency moved is a list that stops being maintained.

Without `make`:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m disposable_domains check
```

## The two rules that do the real work

**A public suffix must never be in the list.** `co.uk` is not a domain anybody
registers — it is the boundary under which every British company registers — so
an entry for it blocks a whole country. There are about ten thousand of these
and most do not look like suffixes: `github.io`, `s3.amazonaws.com`,
`blogspot.com`. `check` refuses any of them, and `fix` will **not** quietly
delete one: removing an entry somebody deliberately added is a destructive
change, so it takes `--drop-public-suffixes` and names each removal.

This is why the tool downloads Mozilla's Public Suffix List. If there is no
cached copy, the suffix rules are reported as **unchecked** rather than passed:

```
PUBLIC SUFFIX RULES WERE NOT CHECKED: no cached list.
```

A validator that answers "clean" about the one rule that matters most, having
never looked, is the exact failure this tool exists to catch in other people's
blocklists. Run `make update` once, or pass `--allow-unchecked-suffixes` to
proceed knowingly.

**An entry covered by another entry is redundant.** If `mailinator.com` is
listed, `foo.mailinator.com` is already blocked, so the second line is noise.
That one *is* safe to fix automatically, because removing it changes nothing
about which addresses are blocked.

## What `update` refuses to do

The failure worth designing against is not a network error — those are loud. It
is a *successful* fetch of something wrong: a truncated body, an HTML error page
served with status 200, an upstream list that has been emptied. Written straight
over the blocklist, any of those silently turns the protection off.

So a download is never written directly. It is parsed, counted, validated and
compared against what is already there, and it is refused if:

* it has fewer than 1,000 domains (a real list has tens of thousands);
* it is less than half the size of the current list;
* it does not pass `check` after being written — in which case the previous
  list is put back.

One source of several being unreachable is reported and is not fatal. Whether
the merged result is good enough to save is decided by size, afterwards.

## Sources

`blocklist.txt` is assembled from
[disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains),
which is **CC0 1.0** — a public domain dedication, verified from its
`LICENSE.txt`. Point `--source` at anything else, or repeat it, to use your own.

## Layout

```
blocklist.txt                    the list
disposable_domains/
  __init__.py                    is_disposable / blocked_by -- the whole public interface
  publicsuffix.py                PSL parsing, and the suffix / registrable-domain rules
  validate.py                    check and fix
  sources.py                     fetching, and refusing a bad download
  cli.py                         the command line
tests/test_blocklist.py          named after the failures, not the functions
```

MIT licensed. See `LICENSE`.
