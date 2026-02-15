import chalk from 'chalk';
import Table from 'cli-table3';
import type { LoadTestStats } from '../types.js';

export function printTerminalReport(stats: LoadTestStats, url: string): void {
  console.log();
  console.log(chalk.bold.cyan('  Load Test Results'));
  console.log(chalk.dim(`  Target: ${url}`));
  console.log();

  // Summary
  const summary = new Table({
    head: [
      chalk.white('Metric'),
      chalk.white('Value'),
    ],
    style: { head: [], border: [] },
  });

  summary.push(
    ['Total Requests', stats.totalRequests.toString()],
    ['Successful', chalk.green(stats.successfulRequests.toString())],
    ['Failed', stats.failedRequests > 0
      ? chalk.red(stats.failedRequests.toString())
      : chalk.dim('0')],
    ['Duration', `${(stats.totalDuration / 1000).toFixed(2)}s`],
    ['Requests/sec', chalk.yellow(stats.requestsPerSecond.toFixed(1))],
  );

  console.log(summary.toString());
  console.log();

  // Latency
  const latency = new Table({
    head: [
      chalk.white('Percentile'),
      chalk.white('Latency'),
    ],
    style: { head: [], border: [] },
  });

  latency.push(
    ['Min', formatMs(stats.latency.min)],
    ['Mean', formatMs(stats.latency.mean)],
    ['p50', formatMs(stats.latency.p50)],
    ['p95', chalk.yellow(formatMs(stats.latency.p95))],
    ['p99', chalk.red(formatMs(stats.latency.p99))],
    ['Max', formatMs(stats.latency.max)],
  );

  console.log(chalk.bold('  Latency Distribution'));
  console.log(latency.toString());
  console.log();

  // Status codes
  if (Object.keys(stats.statusCodes).length > 0) {
    const statusTable = new Table({
      head: [chalk.white('Status'), chalk.white('Count')],
      style: { head: [], border: [] },
    });

    for (const [code, count] of Object.entries(stats.statusCodes).sort()) {
      const color = Number(code) < 400 ? chalk.green : chalk.red;
      statusTable.push([color(code), count.toString()]);
    }

    console.log(chalk.bold('  Status Codes'));
    console.log(statusTable.toString());
    console.log();
  }
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
