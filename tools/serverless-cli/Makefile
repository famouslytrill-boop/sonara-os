# One command to check, one to run the tests.
#
#   make test    run the test suite
#   make lint    check style, from the repository's own eslint config
#   make check   both, which is what to run before pushing
#
# There is no install step. This tool has no runtime dependencies, so there is
# nothing to fetch before it will run.

.PHONY: help test lint check demo clean

help:
	@echo "make test    run the test suite"
	@echo "make lint    check style"
	@echo "make check   both"
	@echo "make demo    scaffold a project into ./.demo and serve it"

test:
	node --test "tests/*.test.js"

lint:
	cd ../.. && npx eslint --max-warnings=0 tools/serverless-cli --ignore-pattern "**/node_modules/**"

check: lint test

# A throwaway project, for looking at rather than for keeping.
demo:
	rm -rf .demo
	mkdir -p .demo
	node bin/sonara-serverless.js init .demo --typescript --name demo-app
	@echo ""
	@echo "Now: node bin/sonara-serverless.js dev --path .demo"

clean:
	rm -rf .demo
