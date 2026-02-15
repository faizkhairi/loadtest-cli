#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runLoadTest } from './runner.js';
import { printTerminalReport } from './reporter/terminal.js';
import { formatJsonReport } from './reporter/json.js';
import { writeHtmlReport } from './reporter/html.js';
import type { OutputFormat } from './types.js';

const program = new Command();

program
  .name('loadtest')
  .description('Benchmark HTTP endpoints with concurrent requests')
  .version('1.0.0')
  .argument('<url>', 'Target URL to test')
  .option('-n, --requests <number>', 'Total number of requests', '100')
  .option('-c, --concurrency <number>', 'Concurrent connections', '10')
  .option('-m, --method <method>', 'HTTP method', 'GET')
  .option('-H, --header <header...>', 'Custom headers (key:value)')
  .option('-b, --body <body>', 'Request body (JSON string)')
  .option('-t, --timeout <ms>', 'Request timeout in ms', '10000')
  .option('-o, --output <file>', 'Output file (.json or .html)')
  .action(async (url: string, opts) => {
    const headers: Record<string, string> = {};
    if (opts.header) {
      for (const h of opts.header as string[]) {
        const [key, ...rest] = h.split(':');
        headers[key.trim()] = rest.join(':').trim();
      }
    }

    const options = {
      url,
      requests: parseInt(opts.requests, 10),
      concurrency: parseInt(opts.concurrency, 10),
      method: opts.method.toUpperCase(),
      headers,
      body: opts.body,
      timeout: parseInt(opts.timeout, 10),
    };

    console.log();
    console.log(chalk.bold(`  Loadtest → ${chalk.cyan(url)}`));
    console.log(
      chalk.dim(`  ${options.requests} requests, ${options.concurrency} concurrent, ${options.method}`)
    );

    const spinner = ora({
      text: `Running 0/${options.requests}`,
      spinner: 'dots',
    }).start();

    const stats = await runLoadTest(options, {
      onProgress(completed, total) {
        const pct = Math.round((completed / total) * 100);
        spinner.text = `Running ${completed}/${total} (${pct}%)`;
      },
    });

    spinner.succeed(
      `Completed ${stats.totalRequests} requests in ${(stats.totalDuration / 1000).toFixed(2)}s`
    );

    // Determine output format
    const outputFile = opts.output as string | undefined;
    let format: OutputFormat = 'terminal';
    if (outputFile?.endsWith('.json')) format = 'json';
    else if (outputFile?.endsWith('.html')) format = 'html';

    if (format === 'json' && outputFile) {
      const json = formatJsonReport(stats, url);
      const { writeFileSync } = await import('node:fs');
      writeFileSync(outputFile, json, 'utf-8');
      console.log(chalk.green(`  Report saved to ${outputFile}`));
    } else if (format === 'html' && outputFile) {
      writeHtmlReport(stats, url, outputFile);
      console.log(chalk.green(`  Report saved to ${outputFile}`));
    }

    // Always print terminal report
    printTerminalReport(stats, url);
  });

program.parse();
