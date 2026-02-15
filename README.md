# loadtest-cli

A fast CLI tool to benchmark HTTP endpoints with concurrent requests, latency percentiles, and HTML reports.

## Features

- **Configurable concurrency** — Set total requests and concurrent connections
- **Latency percentiles** — p50, p95, p99, min, max, mean
- **Status code breakdown** — 2xx/3xx/4xx/5xx distribution
- **Progress bar** — Real-time progress with spinner
- **Multiple output formats** — Terminal (default), JSON, HTML report with Chart.js
- **Custom requests** — HTTP methods, headers, and JSON body support

## Install

```bash
npm install -g @faizkhairi/loadtest-cli
```

## Usage

```bash
# Basic — 100 requests, 10 concurrent (defaults)
loadtest https://api.example.com/users

# Custom concurrency and total
loadtest https://api.example.com/health -n 500 -c 50

# POST with body
loadtest https://api.example.com/users -m POST -b '{"name":"test"}' -n 200

# Custom headers
loadtest https://api.example.com/data -H "Authorization:Bearer token123"

# Save HTML report
loadtest https://api.example.com/users -n 1000 -c 100 -o report.html

# Save JSON report
loadtest https://api.example.com/users -o results.json
```

## Options

| Flag | Description | Default |
|---|---|---|
| `-n, --requests <number>` | Total requests | 100 |
| `-c, --concurrency <number>` | Concurrent connections | 10 |
| `-m, --method <method>` | HTTP method | GET |
| `-H, --header <header...>` | Custom headers (key:value) | — |
| `-b, --body <body>` | Request body (JSON) | — |
| `-t, --timeout <ms>` | Request timeout | 10000 |
| `-o, --output <file>` | Output file (.json or .html) | — |

## Output Example

```
  Loadtest → https://api.example.com/users
  500 requests, 50 concurrent, GET

  ✔ Completed 500 requests in 3.24s

  ┌──────────────────┬───────────┐
  │ Metric           │ Value     │
  ├──────────────────┼───────────┤
  │ Total Requests   │ 500       │
  │ Successful       │ 498       │
  │ Failed           │ 2         │
  │ Duration         │ 3.24s     │
  │ Requests/sec     │ 154.3     │
  └──────────────────┴───────────┘

  Latency Distribution
  ┌──────────────────┬───────────┐
  │ Percentile       │ Latency   │
  ├──────────────────┼───────────┤
  │ Min              │ 12.3ms    │
  │ Mean             │ 45.2ms    │
  │ p50              │ 38.1ms    │
  │ p95              │ 112.4ms   │
  │ p99              │ 234.7ms   │
  │ Max              │ 589.2ms   │
  └──────────────────┴───────────┘
```

## Project Structure

```
loadtest-cli/
├── src/
│   ├── index.ts              # CLI entry (Commander.js)
│   ├── runner.ts             # Load test orchestrator
│   ├── worker.ts             # HTTP request worker
│   ├── stats.ts              # Percentiles, RPS calculator
│   ├── types.ts              # TypeScript interfaces
│   └── reporter/
│       ├── terminal.ts       # Colorized terminal output
│       ├── json.ts           # JSON output
│       └── html.ts           # HTML report with Chart.js
└── tests/
    ├── stats.test.ts         # Percentile & stats tests
    └── reporter.test.ts      # JSON reporter tests
```

## License

MIT
