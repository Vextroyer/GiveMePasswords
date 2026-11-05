.PHONY: test cross-check check build verify-build

test:
	node --test test/

cross-check:
	python3 tools/reference.py

check: test cross-check

build:
	node scripts/build.mjs

verify-build:
	rm -rf .build/verify
	node scripts/build.mjs --out .build/verify
	diff -r .build/verify dist
	rm -rf .build/verify
