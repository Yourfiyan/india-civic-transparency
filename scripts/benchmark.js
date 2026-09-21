/**
 * API Performance and latency benchmarking script.
 * Measures response times across critical endpoints.
 */

const http = require('http');

const ENDPOINTS = [
  '/api/health',
  '/api/cases?limit=10',
  '/api/districts',
  '/api/districts/topojson',
  '/api/crime/geo',
  '/api/infrastructure/geo',
  '/api/analytics/district-score',
];

function fetchEndpoint(path) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const req = http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        resolve({
          path,
          status: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
          bytes: Buffer.byteLength(data),
        });
      });
    });
    req.on('error', reject);
  });
}

async function runBenchmark() {
  console.log('=== Performance Benchmarking (Target: < 100ms) ===\n');
  const results = [];

  for (const endpoint of ENDPOINTS) {
    // Warmup request
    await fetchEndpoint(endpoint).catch(() => null);

    // 3 measurement runs
    const times = [];
    for (let i = 0; i < 3; i++) {
      const res = await fetchEndpoint(endpoint);
      times.push(res.durationMs);
    }
    const avgMs = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 100) / 100;
    const passed = avgMs < 100;

    console.log(
      `${endpoint.padEnd(35)} | Avg: ${String(avgMs + 'ms').padEnd(10)} | Status: ${passed ? '✓ PASS (<100ms)' : '⚠ ' + avgMs + 'ms'}`
    );
    results.push({ endpoint, avgMs, passed });
  }

  const allPassed = results.every((r) => r.passed);
  console.log(`\nBenchmark Result: ${allPassed ? 'ALL PASSED' : 'COMPLETED'}`);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err.message);
});
