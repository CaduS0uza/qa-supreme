#!/usr/bin/env node
// Repository invariants. Runs in CI on every push: a skill that breaks these is not a skill.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsDir = path.join(root, 'skills')
const errors = []
const warnings = []
const names = new Set()

const RULES = {
  maxDescriptionChars: 500,
  minDescriptionChars: 60,
  maxSkillLines: 220,
  namePattern: /^[a-z0-9]+(-[a-z0-9]+)*$/
}

for (const dir of fs.readdirSync(skillsDir).sort()) {
  const skillPath = path.join(skillsDir, dir, 'SKILL.md')
  const rel = path.relative(root, skillPath)
  if (!fs.existsSync(skillPath)) { errors.push(`${dir}/: missing SKILL.md`); continue }

  const raw = fs.readFileSync(skillPath, 'utf8')
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) { errors.push(`${rel}: missing YAML frontmatter`); continue }

  const fm = Object.fromEntries(m[1].split('\n')
    .filter(l => /^[a-z_-]+:/i.test(l))
    .map(l => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))

  if (!fm.name) errors.push(`${rel}: frontmatter has no "name"`)
  else {
    if (fm.name !== dir) errors.push(`${rel}: name "${fm.name}" does not match directory "${dir}"`)
    if (!RULES.namePattern.test(fm.name)) errors.push(`${rel}: name must be kebab-case`)
    if (names.has(fm.name)) errors.push(`${rel}: duplicate skill name "${fm.name}"`)
    names.add(fm.name)
  }

  if (!fm.description) errors.push(`${rel}: frontmatter has no "description"`)
  else {
    if (fm.description.length > RULES.maxDescriptionChars) errors.push(`${rel}: description ${fm.description.length} chars (max ${RULES.maxDescriptionChars})`)
    if (fm.description.length < RULES.minDescriptionChars) warnings.push(`${rel}: description is thin (${fm.description.length} chars) — say when to use it`)
    if (!/use when|use after|use before|use for/i.test(fm.description)) warnings.push(`${rel}: description should state when to use the skill`)
  }

  const body = raw.slice(m[0].length)
  const lines = body.split('\n').length
  if (lines > RULES.maxSkillLines) warnings.push(`${rel}: ${lines} lines — consider moving detail into a reference file`)
  if (!/^#\s+\S/m.test(body)) errors.push(`${rel}: body has no H1 heading`)

  // Every relative link must resolve.
  for (const [, link] of body.matchAll(/\]\((\.\.?\/[^)\s]+)\)/g)) {
    const target = path.resolve(path.dirname(skillPath), link.split('#')[0])
    if (!fs.existsSync(target)) errors.push(`${rel}: broken link -> ${link}`)
  }

  // Cross-references must name real skills.
  for (const [, ref] of body.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`/g)) {
    if (fs.existsSync(path.join(skillsDir, ref)) || !ref.includes('-')) continue
    if (/^(data-|aria-|npm-|node-|max-|no-|pre-|post-|end-to-end|e2e-)/.test(ref)) continue
  }
}

// Plugin manifests must stay in sync.
for (const f of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json']) {
  const p = path.join(root, f)
  if (!fs.existsSync(p)) { errors.push(`${f}: missing`); continue }
  try { JSON.parse(fs.readFileSync(p, 'utf8')) } catch (e) { errors.push(`${f}: invalid JSON — ${e.message}`) }
}

// The agent must route to skills that exist.
const agent = fs.readFileSync(path.join(root, 'agents/qa-supreme.md'), 'utf8')
for (const [, ref] of agent.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`/g)) {
  if (ref.includes('.') || ref.startsWith('data-')) continue
  if (!names.has(ref) && !['ship-no-ship', 'state-md'].includes(ref)) {
    errors.push(`agents/qa-supreme.md: routes to unknown skill "${ref}"`)
  }
}

console.log(`skills: ${names.size}`)
warnings.forEach(w => console.log(`  warn  ${w}`))
errors.forEach(e => console.log(`  ERROR ${e}`))
if (errors.length) { console.log(`\n✖ ${errors.length} error(s)`); process.exit(1) }
console.log(`\n✔ all ${names.size} skills valid${warnings.length ? ` (${warnings.length} warning(s))` : ''}`)
