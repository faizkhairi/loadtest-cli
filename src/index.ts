#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { runLoadTest } from './runner.js';
import { runSetup } from './setup.js';
import { printTerminalReport } from './reporter/terminal.js';
import { formatJsonReport } from './reporter/json.js';
import { writeHtmlReport } from './reporter/html.js';
import type { LoadTestOptions, OutputFormat } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as { version: string };

const program = new Command();

program
  .name('loadtest')
  .description('Benchmark HTTP endpoints with concurrent requests')
  .version(pkg.version)
  .argument('<url>', 'Target URL to test')
  .option('-n, --requests <number>', 'Total number of requests', '100')
  .option('-c, --concurrency <number>', 'Concurrent connections', '10')
  .option('-m, --method <method>', 'HTTP method', 'GET')
  .option('-H, --header <header...>', 'Custom headers (key:value)')
  .option('-b, --body <body>', 'Request body (JSON string)')
  .option('-t, --timeout <ms>', 'Request timeout in ms', '10000')
  .option('-o, --output <file>', 'Output file (.json or .html)')
  // v2.0.0 options
  .option('-d, --duration <seconds>', 'Run for a fixed duration (mutually exclusive with -n)')
  .option('--rps <number>', 'Max requests per second (rate limiting)')
  .option('--payload-file <path>', 'JSON file with array of payloads (round-robin)')
  .option('--assert-status <code>', 'Assert response status code')
  .option('--assert-body <substring>', 'Assert response body contains substring')
  .option('--setup <url>', 'Setup URL — fire once before test, response available as {{SETUP_RESPONSE}}')
  .option('--setup-method <method>', 'HTTP method for setup request', 'POST')
  .option('--setup-body <body>', 'Request body for setup request (JSON string)')
  // v2.1.0 options
  .option('--ramp-to <number>', 'Target concurrency for ramp-up (starts from -c)')
  .option('--ramp-over <seconds>', 'Seconds to ramp from -c to --ramp-to')
  .option('--file <path>', 'File to upload (multipart/form-data)')
  .option('--file-field <name>', 'Form field name for the file', 'file')
  .option('--form <fields...>', 'Additional form fields (key:value, requires --file)')
  .action(async (url: string, opts) => {
    // Parse headers
    const headers: Record<string, string> = {};
    if (opts.header) {
      for (const h of opts.header as string[]) {
        const [key, ...rest] = h.split(':');
        headers[key.trim()] = rest.join(':').trim();
      }
    }

    // Validate -n and -d mutual exclusivity
    const hasDuration = opts.duration != null;
    const hasRequests = opts.requests !== '100' || !hasDuration; // default is '100'
    if (hasDuration && opts.requests !== '100') {
      console.error(chalk.red('  Error: -n and -d are mutually exclusive. Use one or the other.'));
      process.exit(1);
    }

    // Validate ramp-up options
    if (opts.rampTo && !opts.rampOver) {
      console.error(chalk.red('  Error: --ramp-over is required when --ramp-to is provided.'));
      process.exit(1);
    }
    if (opts.rampOver && !opts.rampTo) {
      console.error(chalk.red('  Error: --ramp-to is required when --ramp-over is provided.'));
      process.exit(1);
    }
    if (opts.rampTo && parseInt(opts.rampTo, 10) <= parseInt(opts.concurrency, 10)) {
      console.error(chalk.red('  Error: --ramp-to must be greater than -c (starting concurrency).'));
      process.exit(1);
    }

    // Validate file upload mutual exclusivity
    if (opts.file && (opts.body || opts.payloadFile)) {
      console.error(chalk.red('  Error: --file is mutually exclusive with --body and --payload-file.'));
      process.exit(1);
    }
    if (opts.form && !opts.file) {
      console.error(chalk.red('  Error: --form requires --file (form fields are only used in multipart mode).'));
      process.exit(1);
    }

    const options: LoadTestOptions = {
      url,
      requests: hasDuration ? Infinity : parseInt(opts.requests, 10),
      concurrency: parseInt(opts.concurrency, 10),
      method: opts.method.toUpperCase(),
      headers,
      body: opts.body,
      timeout: parseInt(opts.timeout, 10),
      duration: hasDuration ? parseFloat(opts.duration) : undefined,
      rps: opts.rps ? parseInt(opts.rps, 10) : undefined,
      payloadFile: opts.payloadFile,
      assertStatus: opts.assertStatus ? parseInt(opts.assertStatus, 10) : undefined,
      assertBody: opts.assertBody,
      setup: opts.setup
        ? {
            url: opts.setup,
            method: opts.setupMethod?.toUpperCase() || 'POST',
            body: opts.setupBody,
          }
        : undefined,
      rampTo: opts.rampTo ? parseInt(opts.rampTo, 10) : undefined,
      rampOver: opts.rampOver ? parseFloat(opts.rampOver) : undefined,
      fileField: opts.fileField,
    };

    // Load payload file
    let payloads: object[] | undefined;
    if (options.payloadFile) {
      try {
        const raw = readFileSync(resolve(options.payloadFile), 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          console.error(chalk.red('  Error: Payload file must contain a JSON array.'));
          process.exit(1);
        }
        payloads = parsed;
      } catch (err) {
        console.error(chalk.red(`  Error reading payload file: ${(err as Error).message}`));
        process.exit(1);
      }
    }

    // Load file for multipart upload
    if (opts.file) {
      try {
        const filePath = resolve(opts.file);
        options.file = readFileSync(filePath);
        options.fileName = filePath.split(/[\\/]/).pop();
      } catch (err) {
        console.error(chalk.red(`  Error reading file: ${(err as Error).message}`));
        process.exit(1);
      }
    }

    // Parse form fields
    if (opts.form) {
      options.formFields = {};
      for (const f of opts.form as string[]) {
        const [key, ...rest] = f.split(':');
        options.formFields[key.trim()] = rest.join(':').trim();
      }
    }

    // Run setup phase
    let setupResponse: unknown;
    if (options.setup) {
      const setupSpinner = ora({ text: 'Running setup request...', spinner: 'dots' }).start();
      try {
        setupResponse = await runSetup(options.setup);
        setupSpinner.succeed('Setup complete');
      } catch (err) {
        setupSpinner.fail(`Setup failed: ${(err as Error).message}`);
        process.exit(1);
      }
    }

    // Display test info
    console.log();
    console.log(chalk.bold(`  Loadtest → ${chalk.cyan(url)}`));
    const modeLabel = options.duration
      ? `${options.duration}s duration`
      : `${options.requests} requests`;
    const rpsLabel = options.rps ? `, ${options.rps} rps cap` : '';
    const rampLabel = options.rampTo
      ? `, ramp ${options.concurrency} -> ${options.rampTo} over ${options.rampOver}s`
      : '';
    const fileLabel = options.file ? `, file upload (${options.fileName})` : '';
    console.log(
      chalk.dim(`  ${modeLabel}, ${options.concurrency} concurrent, ${options.method}${rpsLabel}${rampLabel}${fileLabel}`)
    );

    const testStart = Date.now();
    const spinner = ora({
      text: options.duration
        ? `Running 0 requests (0s / ${options.duration}s)`
        : `Running 0/${options.requests}`,
      spinner: 'dots',
    }).start();

    const stats = await runLoadTest(
      options,
      {
        onProgress(completed, total) {
          if (options.duration) {
            const elapsed = ((Date.now() - testStart) / 1000).toFixed(1);
            spinner.text = `Running ${completed} requests (${elapsed}s / ${options.duration}s)`;
          } else {
            const pct = Math.round((completed / total) * 100);
            spinner.text = `Running ${completed}/${total} (${pct}%)`;
          }
        },
      },
      { payloads, setupResponse }
    );

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

    // Exit with non-zero if assertions failed
    if (stats.assertionFailures > 0) {
      process.exit(1);
    }
  });

program.parse();
