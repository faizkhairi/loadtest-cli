import { readFileSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { LoadTestStats } from '../types.js';

export function writeHtmlReport(
  stats: LoadTestStats,
  url: string,
  outputPath: string
): void {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const templatePath = join(__dirname, '..', '..', 'templates', 'report.html');

  let template: string;
  try {
    template = readFileSync(templatePath, 'utf-8');
  } catch {
    // Fallback: generate inline HTML if template not found
    template = getInlineTemplate();
  }

  const html = template
    .replace('{{URL}}', escapeHtml(url))
    .replace('{{TIMESTAMP}}', new Date().toISOString())
    .replace('{{DATA}}', JSON.stringify(stats));

  writeFileSync(outputPath, html, 'utf-8');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getInlineTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Load Test Report — {{URL}}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #fafafa; color: #18181b; padding: 2rem; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .meta { color: #71717a; font-size: 0.875rem; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card { background: white; border: 1px solid #e4e4e7; border-radius: 12px; padding: 1.25rem; }
    .card-label { font-size: 0.75rem; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; }
    .card-value { font-size: 1.5rem; font-weight: 600; margin-top: 0.25rem; }
    .chart-container { background: white; border: 1px solid #e4e4e7; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .chart-title { font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Load Test Report</h1>
    <p class="meta">Target: {{URL}} &mdash; {{TIMESTAMP}}</p>
    <div class="grid" id="summary"></div>
    <div class="chart-container">
      <p class="chart-title">Latency Distribution</p>
      <canvas id="latencyChart" height="200"></canvas>
    </div>
    <div class="chart-container">
      <p class="chart-title">Status Codes</p>
      <canvas id="statusChart" height="200"></canvas>
    </div>
  </div>
  <script>
    const data = {{DATA}};
    const summary = document.getElementById('summary');
    const cards = [
      { label: 'Total Requests', value: data.totalRequests },
      { label: 'Successful', value: data.successfulRequests },
      { label: 'Failed', value: data.failedRequests },
      { label: 'Duration', value: (data.totalDuration / 1000).toFixed(2) + 's' },
      { label: 'Req/sec', value: data.requestsPerSecond.toFixed(1) },
      { label: 'Mean Latency', value: data.latency.mean.toFixed(1) + 'ms' },
    ];
    cards.forEach(c => {
      summary.innerHTML += '<div class="card"><p class="card-label">' + c.label + '</p><p class="card-value">' + c.value + '</p></div>';
    });
    new Chart(document.getElementById('latencyChart'), {
      type: 'bar',
      data: {
        labels: ['Min', 'p50', 'Mean', 'p95', 'p99', 'Max'],
        datasets: [{ label: 'Latency (ms)', data: [data.latency.min, data.latency.p50, data.latency.mean, data.latency.p95, data.latency.p99, data.latency.max], backgroundColor: ['#22c55e', '#3b82f6', '#3b82f6', '#eab308', '#ef4444', '#ef4444'] }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'ms' } } } }
    });
    const statusLabels = Object.keys(data.statusCodes);
    const statusValues = Object.values(data.statusCodes);
    const statusColors = statusLabels.map(s => Number(s) < 400 ? '#22c55e' : '#ef4444');
    new Chart(document.getElementById('statusChart'), {
      type: 'doughnut',
      data: { labels: statusLabels, datasets: [{ data: statusValues, backgroundColor: statusColors }] },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  </script>
</body>
</html>`;
}
