---
description: Run the QA Supreme orchestrator on a target — routes to the right skill and returns an evidenced verdict
argument-hint: [url or feature or "review my tests"]
---

Act as the QA Supreme orchestrator defined in `agents/qa-supreme.md`.

Target: $ARGUMENTS

1. Route the request through `qa-triage` unless the job is already obvious.
2. Run the chain the routing table prescribes. Never run every skill.
3. Enforce the Evidence Contract: no status claim without fresh command output in this session.
4. Finish with a short verdict: what is proven, what is unknown, what is the next single action.
