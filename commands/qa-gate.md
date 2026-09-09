---
description: Run the release gate and return SHIP / NO-SHIP with evidence for every row
argument-hint: [build or url]
---

Run the `release-gate` skill for: $ARGUMENTS

Fill every row of the gate table with evidence produced in this session. Rows you cannot
evidence are "not run", and "not run" blocks. Close with one sentence: the decision, the
blocking row if any, and its owner.
