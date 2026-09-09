import { log } from '../logger.mjs'

// Stage 3. Every form is exercised three ways: empty submit (validation must speak),
// junk input (must not 500 or crash), and a plausible fill (happy path must respond).
const JUNK = {
  email: 'not-an-email',
  number: '-999999999',
  tel: 'abc',
  url: 'javascript:void(0)',
  text: "<script>alert('qa')</script>' OR 1=1 --",
  password: 'a',
  date: '9999-99-99'
}
const PLAUSIBLE = {
  email: 'qa.supreme@example.com',
  number: '7',
  tel: '+5511999998888',
  url: 'https://example.com',
  text: 'QA Supreme probe',
  password: 'Str0ng-Passw0rd!23',
  date: '2026-01-15',
  search: 'probe'
}

export async function forms(session, cfg) {
  const { page } = session
  const results = []
  await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs }).catch(() => {})

  const formCount = await page.locator('form').count().catch(() => 0)
  const looseInputs = await page.locator('input:not(form input), textarea:not(form textarea)').count().catch(() => 0)
  if (!formCount && !looseInputs) {
    log.info('no forms on the entry page')
    return { status: 'pass', summary: 'no forms found', data: { results } }
  }

  for (let i = 0; i < Math.min(formCount, 10); i++) {
    const form = page.locator('form').nth(i)
    const name = (await form.getAttribute('name')) || (await form.getAttribute('id')) || `form#${i + 1}`
    const fields = await form.locator('input:not([type=hidden]), textarea, select').count()
    const submit = form.locator('button[type=submit], input[type=submit], button:not([type])').first()

    for (const mode of ['empty', 'junk', 'plausible']) {
      const errorsBefore = session.findings.pageErrors.length + session.findings.network.filter(n => n.status >= 500).length
      try {
        await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
        const f = page.locator('form').nth(i)
        if (mode !== 'empty') {
          const inputs = f.locator('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea')
          const n = await inputs.count()
          for (let k = 0; k < n; k++) {
            const inp = inputs.nth(k)
            const type = (await inp.getAttribute('type')) || 'text'
            const bank = mode === 'junk' ? JUNK : PLAUSIBLE
            const value = bank[type] || bank.text
            if (['checkbox', 'radio'].includes(type)) { await inp.check({ timeout: 2000 }).catch(() => {}) }
            else await inp.fill(String(value), { timeout: 2000 }).catch(() => {})
          }
          const selects = f.locator('select')
          const sc = await selects.count()
          for (let k = 0; k < sc; k++) await selects.nth(k).selectOption({ index: 1 }).catch(() => {})
        }
        if (await submit.count()) await submit.click({ timeout: cfg.timeoutMs }).catch(() => {})
        await page.waitForTimeout(400)

        const errorsAfter = session.findings.pageErrors.length + session.findings.network.filter(n => n.status >= 500).length
        const crashed = errorsAfter > errorsBefore
        const visibleError = await page.locator('[role=alert], .error, [aria-invalid=true], [data-error]').count().catch(() => 0)
        const validationSpoke = visibleError > 0 || await page.evaluate(() => {
          const el = document.querySelector('form :invalid')
          return !!el
        }).catch(() => false)

        let verdict = 'PASS'
        let detail = ''
        if (crashed) { verdict = 'FAIL'; detail = 'server error or uncaught exception on submit' }
        else if (mode === 'empty' && fields > 0 && !validationSpoke) { verdict = 'WARN'; detail = 'empty submit produced no visible validation' }
        else if (mode === 'junk' && !validationSpoke) { verdict = 'WARN'; detail = 'invalid input accepted without feedback' }
        else detail = mode === 'plausible' ? 'accepted' : 'rejected as expected'

        results.push({ form: name, mode, verdict, detail })
      } catch (e) {
        results.push({ form: name, mode, verdict: 'FAIL', detail: e.message.split('\n')[0].slice(0, 120) })
      }
    }
  }

  log.table(results)
  const fails = results.filter(r => r.verdict === 'FAIL').length
  const warns = results.filter(r => r.verdict === 'WARN').length
  return {
    status: fails ? 'fail' : warns ? 'warn' : 'pass',
    summary: `${results.length} probes · ${fails} fail · ${warns} warn`,
    data: { results }
  }
}
