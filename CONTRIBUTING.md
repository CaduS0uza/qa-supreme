# Contributing

## The bar for a new skill

A skill earns its place when an agent following it produces work a senior QA engineer would sign.
Concretely:

1. **One job.** If the description needs "and", it is two skills.
2. **Decisions, not descriptions.** "Assert the whole response shape" beats "response testing is
   important". Anything an agent already knows is noise that pushes out what it does not.
3. **A procedure that terminates.** Numbered steps, an explicit output format, and a stated
   done-condition that requires evidence.
4. **Rules that forbid.** Every good skill names the failure it exists to prevent. A skill with no
   prohibitions is a blog post.
5. **Under ~200 lines.** Longer belongs in `references/` next to the SKILL.md, loaded on demand.
6. **Original text.** Do not paste other repositories' skills. Credit prior art in `README.md`.

## Frontmatter

```yaml
---
name: kebab-case-matching-the-directory
description: What it does, then "Use when ..." with the phrases a user would actually type.
---
```

The description is the routing table for every agent runtime. Write it for retrieval: name the
trigger phrases, not the philosophy.

## Before opening a PR

```bash
node scripts/validate-skills.mjs                    # must be clean
cd runner && npm install
node bin/qa-supreme.mjs run --url http://localhost:8099/index.html --out ../.qa-out
node ../evals/assert-demo-findings.mjs ../.qa-out/run.json    # 18/18
```

Changing the runner? Add the expectation that covers your change to
`evals/assert-demo-findings.mjs`, and seed the fixture in `examples/demo-app/` if the behavior
does not exist there yet. A runner change with no new expectation is a change nobody can verify.

Adding a skill to the agent's routing table? `scripts/validate-skills.mjs` fails if the agent
routes to a skill that does not exist — keep them in sync.

## Style

Short sentences. Tables over paragraphs. Real commands, real output shapes. No emoji in skill
bodies. Second person, imperative: the reader is an agent about to act.
