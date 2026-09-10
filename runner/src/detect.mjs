import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { log } from './logger.mjs'

// "Point it at my app" should not require knowing the port. This detects how the project in the
// current directory starts, starts it, waits for it to answer, and shuts it down afterwards.
const RECIPES = [
  { id: 'next',    detect: (p) => p.deps.next,                     cmd: 'dev', port: 3000 },
  { id: 'nuxt',    detect: (p) => p.deps.nuxt,                     cmd: 'dev', port: 3000 },
  { id: 'remix',   detect: (p) => p.deps['@remix-run/dev'],        cmd: 'dev', port: 3000 },
  { id: 'astro',   detect: (p) => p.deps.astro,                    cmd: 'dev', port: 4321 },
  { id: 'vite',    detect: (p) => p.deps.vite,                     cmd: 'dev', port: 5173 },
  { id: 'cra',     detect: (p) => p.deps['react-scripts'],         cmd: 'start', port: 3000 },
  { id: 'angular', detect: (p) => p.deps['@angular/core'],         cmd: 'start', port: 4200 },
  { id: 'node',    detect: (p) => p.scripts.dev || p.scripts.start, cmd: null,  port: 3000 }
]

const NON_NODE = [
  { id: 'django',  file: 'manage.py',      cmd: ['python3', ['manage.py', 'runserver']], port: 8000 },
  { id: 'rails',   file: 'Gemfile',        cmd: ['bin/rails', ['server']],               port: 3000 },
  { id: 'laravel', file: 'artisan',        cmd: ['php', ['artisan', 'serve']],           port: 8000 },
  { id: 'static',  file: 'index.html',     cmd: ['python3', ['-m', 'http.server', '4173']], port: 4173 }
]

export function detectProject(dir = process.cwd()) {
  const pkgPath = path.join(dir, 'package.json')
  if (fs.existsSync(pkgPath)) {
    let pkg = {}
    try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) } catch {}
    const p = { deps: { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }, scripts: pkg.scripts || {} }
    for (const r of RECIPES) {
      if (!r.detect(p)) continue
      const script = r.cmd && p.scripts[r.cmd] ? r.cmd : (p.scripts.dev ? 'dev' : p.scripts.start ? 'start' : null)
      if (!script) continue
      const runner = fs.existsSync(path.join(dir, 'pnpm-lock.yaml')) ? 'pnpm'
        : fs.existsSync(path.join(dir, 'yarn.lock')) ? 'yarn'
        : fs.existsSync(path.join(dir, 'bun.lockb')) ? 'bun' : 'npm'
      return { id: r.id, command: runner, args: runner === 'npm' ? ['run', script] : [script], port: r.port, dir }
    }
  }
  for (const n of NON_NODE) {
    if (fs.existsSync(path.join(dir, n.file))) {
      return { id: n.id, command: n.cmd[0], args: n.cmd[1], port: n.port, dir }
    }
  }
  return null
}

export async function waitForServer(url, timeoutMs = 90000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.status < 500) return true
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

/** Starts the detected app and returns a stop() that always terminates the process tree. */
export async function startProject(project, url) {
  log.step(`detected ${project.id} — starting with \`${project.command} ${project.args.join(' ')}\``)
  const child = spawn(project.command, project.args, {
    cwd: project.dir, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    env: { ...process.env, BROWSER: 'none', PORT: String(project.port) }
  })
  const tail = []
  const keep = (b) => { tail.push(String(b)); if (tail.length > 40) tail.shift() }
  child.stdout.on('data', keep)
  child.stderr.on('data', keep)

  const stop = () => { try { process.kill(-child.pid, 'SIGTERM') } catch {} }
  process.on('exit', stop)

  const ok = await waitForServer(url)
  if (!ok) {
    stop()
    throw new Error(`the app did not answer at ${url} within 90s. Last output:\n${tail.slice(-12).join('')}`)
  }
  log.ok(`app is up at ${url}`)
  return { stop }
}
