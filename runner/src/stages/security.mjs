import { log } from '../logger.mjs'
import { uniqueStates } from './a11y.mjs'

// Stage 8. QA-side security regressions: the checks a senior tester owns without a pentest
// engagement — headers, transport, secret leakage, dangerous sinks, cookie flags.
export async function security(session, cfg, prior) {
  const { page, context } = session
  const findings = []

  let headers = {}
  try {
    const resp = await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
    headers = resp ? resp.headers() : {}
  } catch {}

  const isHttp = cfg.url.startsWith('http')
  const expect = [
    ['content-security-policy', 'high', 'no CSP: any injected script executes freely'],
    ['x-content-type-options', 'medium', 'MIME sniffing allowed'],
    ['referrer-policy', 'low', 'full URLs leak to third parties'],
    ['x-frame-options|content-security-policy', 'high', 'clickjacking: page can be framed']
  ]
  if (isHttp) {
    if (cfg.url.startsWith('https')) expect.push(['strict-transport-security', 'high', 'no HSTS: downgrade to http possible'])
    for (const [key, severity, impact] of expect) {
      const present = key.split('|').some(k => headers[k])
      if (!present) findings.push({ check: `header:${key.split('|')[0]}`, severity, detail: impact })
    }
    if (headers['server'] || headers['x-powered-by']) {
      findings.push({ check: 'version disclosure', severity: 'low', detail: `${headers['server'] || ''} ${headers['x-powered-by'] || ''}`.trim() })
    }
  }

  // Cookie flags
  const cookies = await context.cookies().catch(() => [])
  cookies.forEach(ck => {
    const flags = []
    if (!ck.httpOnly) flags.push('not HttpOnly')
    if (!ck.secure && cfg.url.startsWith('https')) flags.push('not Secure')
    if (!ck.sameSite || ck.sameSite === 'None') flags.push('SameSite=None')
    if (flags.length) findings.push({ check: `cookie:${ck.name}`, severity: ck.name.match(/sess|auth|token|jwt/i) ? 'high' : 'medium', detail: flags.join(', ') })
  })

  // Client-side secrets and dangerous sinks, across every discovered state
  for (const url of uniqueStates(cfg, prior).slice(0, 8)) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
      const probe = await page.evaluate(() => {
        const html = document.documentElement.innerHTML
        const patterns = [
          [/sk_live_[A-Za-z0-9]{8,}/, 'stripe live secret key'],
          [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
          [/AIza[0-9A-Za-z\-_]{30,}/, 'Google API key'],
          [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, 'JWT in markup'],
          [/(service_role|SUPABASE_SERVICE)/, 'Supabase service role reference'],
          [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key']
        ]
        const secrets = patterns.filter(([re]) => re.test(html)).map(([, label]) => label)
        const storage = []
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (/token|jwt|secret|password|auth/i.test(k)) storage.push(k)
          }
        } catch {}
        const targets = [...document.querySelectorAll('a[target=_blank]')]
          .filter(a => !(a.rel || '').includes('noopener')).length
        return { secrets, storage, targets, forms: [...document.querySelectorAll('form')].filter(f => (f.action || '').startsWith('http://')).length }
      })
      probe.secrets.forEach(s => findings.push({ check: 'secret in client', severity: 'critical', detail: `${s} at ${url}` }))
      probe.storage.forEach(k => findings.push({ check: 'credential in localStorage', severity: 'medium', detail: `key "${k}" at ${url}` }))
      if (probe.targets) findings.push({ check: 'target=_blank without noopener', severity: 'low', detail: `${probe.targets} link(s) at ${url}` })
      if (probe.forms) findings.push({ check: 'form posts over http', severity: 'high', detail: `${probe.forms} form(s) at ${url}` })
    } catch {}
  }

  const rank = { critical: 0, high: 1, medium: 2, low: 3 }
  findings.sort((a, b) => rank[a.severity] - rank[b.severity])
  log.table(findings.length ? findings.slice(0, 20) : [{ check: 'none', severity: '-', detail: 'no issues in scope' }])

  const blocking = findings.filter(f => f.severity === 'critical' || f.severity === 'high').length
  return {
    status: blocking ? 'fail' : findings.length ? 'warn' : 'pass',
    summary: `${findings.length} finding(s) · ${blocking} critical/high`,
    data: { findings, headers }
  }
}
