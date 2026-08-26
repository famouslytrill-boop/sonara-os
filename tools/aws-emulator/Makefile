# make test    run the suite
# make run     start it on 4566 without Docker
# make check   lint and test, which is what to run before pushing

.PHONY: help test run lint check

help:
	@echo "make test   run the suite"
	@echo "make run    start it on localhost:4566 (no Docker needed)"
	@echo "make check  lint and test"

test:
	node --test "tests/*.test.js"

run:
	node src/server.js

lint:
	cd ../.. && npx eslint --max-warnings=0 tools/aws-emulator --ignore-pattern "**/node_modules/**"

check: lint test
