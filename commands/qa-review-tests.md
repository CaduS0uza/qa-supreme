---
description: Audit an existing test suite for tests that pass whether or not the code works
argument-hint: [path or diff]
---

Run `false-positive-hunter` over: $ARGUMENTS

For every test, answer: what change to production code would make this fail? Report only the
tests that have no answer. Verify P0 findings empirically by breaking the covered line and
confirming the test stays green. Then run `mutation-proof` on the survivors and close with the
suite trust level and the single highest-value fix.
