# make run      start the app on http://127.0.0.1:8000
# make test     run the tests
# make openvoice  install the real engine (large; see requirements-openvoice.txt)

VENV := .venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

.PHONY: run test openvoice clean help

help:
	@echo "make run        start the app on http://127.0.0.1:8000"
	@echo "make test       run the tests"
	@echo "make openvoice  install the real engine (large)"

$(VENV)/bin/activate: requirements.txt
	python3 -m venv $(VENV)
	$(PIP) install --quiet --upgrade pip
	$(PIP) install --quiet -r requirements.txt
	@touch $(VENV)/bin/activate

run: $(VENV)/bin/activate
	$(PY) -m uvicorn voiceclone.app:app --host 127.0.0.1 --port 8000

test: $(VENV)/bin/activate
	$(PY) -m pytest tests/ -q

openvoice: $(VENV)/bin/activate
	$(PIP) install -r requirements-openvoice.txt
	@echo
	@echo "Now follow the rest of the instructions at the top of requirements-openvoice.txt:"
	@echo "  OpenVoice itself, MeloTTS, unidic, and the V2 checkpoints."

clean:
	rm -rf $(VENV) .pytest_cache **/__pycache__
