# One command to get set up, one to check, one to fix.
#
#   make check     validate the blocklist (this is what CI runs)
#   make fix       rewrite it into canonical form
#   make update    fetch upstream, verify, and only then save
#   make test      run the test suite
#
# Every target builds the virtual environment first if it is not there, so
# there is no separate setup step to forget.

VENV := .venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

.PHONY: check fix update test clean help

help:
	@echo "make check   validate the blocklist"
	@echo "make fix     rewrite it into canonical form"
	@echo "make update  fetch upstream, verify, then save"
	@echo "make test    run the tests"

$(VENV)/bin/activate: requirements.txt
	python3 -m venv $(VENV)
	$(PIP) install --quiet --upgrade pip
	$(PIP) install --quiet -r requirements.txt
	@touch $(VENV)/bin/activate

check: $(VENV)/bin/activate
	$(PY) -m disposable_domains check

fix: $(VENV)/bin/activate
	$(PY) -m disposable_domains fix

update: $(VENV)/bin/activate
	$(PY) -m disposable_domains update

test: $(VENV)/bin/activate
	$(PY) -m pytest tests/ -q

clean:
	rm -rf $(VENV) .cache .pytest_cache **/__pycache__
