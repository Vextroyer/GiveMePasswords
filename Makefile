.PHONY: test cross-check check

test:
	node --test test/

cross-check:
	python3 tools/reference.py

check: test cross-check
