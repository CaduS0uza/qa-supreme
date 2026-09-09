---
name: load-and-stress
description: Design and run load, stress, soak and spike tests with k6 or Artillery, with thresholds that fail the build, realistic traffic shapes, and analysis that names the bottleneck. Use when asked about load testing, scalability, capacity, or "can we handle launch".
---

# Load & Stress

## Pick the right shape

| Test | Shape | Answers |
|---|---|---|
| **Load** | expected peak, held 10-30 min | does it meet SLO at normal peak |
| **Stress** | ramp until it breaks | where is the ceiling, and how does it fail |
| **Spike** | 0 -> peak in seconds | can it absorb a launch/campaign |
| **Soak** | moderate load, 2-12h | memory leaks, connection exhaustion, log disk |
| **Breakpoint** | slow linear ramp, no cap | the exact concurrency where p95 crosses the SLO |

Run load before launch, soak before a long weekend, stress before you promise a number.

## k6 with thresholds that gate

```js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [ { duration: '2m', target: 100 }, { duration: '10m', target: 100 }, { duration: '2m', target: 0 } ],
  thresholds: {
    http_req_failed: ['rate<0.01'],                  // < 1% errors
    http_req_duration: ['p(95)<800', 'p(99)<2000'],  // latency SLO
    checks: ['rate>0.99'],
  },
}

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/api/products`, { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } })
  check(res, { 'status 200': r => r.status === 200, 'has rows': r => r.json('items').length > 0 })
  sleep(Math.random() * 2 + 1)          // think time — back-to-back requests are not users
}
```

`thresholds` is what turns a load script into a test: k6 exits non-zero when they breach.

## Realism rules (skip these and the numbers are fiction)

- **Think time and pacing.** Real users pause. Zero think time measures your load generator.
- **Traffic mix by real proportion**: 80% browse, 15% search, 5% checkout — take it from analytics.
- **Cache-realistic data**: random ids across the real key space, not the same row 100k times.
- **Auth per virtual user**, from a pool. One shared token measures one session's cache.
- **Test the environment you will ship**, or scale results explicitly and label them as estimates.
- **Warm up** before measuring, and discard the ramp from the analysis window.

## Reading results

Report percentiles, never averages — the average hides the users who left. Correlate the client
metrics with server metrics at the same timestamps: CPU, memory, connection pool saturation,
database locks, GC pauses. The bottleneck is where the queue forms, and it is usually the pool,
not the CPU.

## Output

```
LOAD 100 VU / 10 min  BASE=staging
  http_req_failed   0.4%   threshold <1%    PASS
  p95 latency       740ms  threshold <800   PASS
  p99 latency       3.1s   threshold <2000  FAIL
  bottleneck: db connection pool saturated at 92 VU (pool=20, avg wait 1.4s)
VERDICT: fails p99 SLO from ~90 concurrent users. Raise pool or add a read replica.
```
