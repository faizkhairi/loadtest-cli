# loadtest-cli

![CI](https://github.com/faizkhairi/loadtest-cli/actions/workflows/ci.yml/badge.svg)
![npm](https://img.shields.io/npm/v/@faizkhairi/loadtest-cli)

A fast CLI tool to benchmark HTTP endpoints with concurrent requests, latency percentiles, and HTML reports.

## Features

- **Configurable concurrency** -- Set total requests and concurrent connections
- **Duration mode** -- Run tests for a fixed time period instead of fixed request count
- **RPS rate limiting** -- Cap requests-per-second to simulate realistic traffic
- **Payload templates** -- Vary request bodies using a JSON file (round-robin)
- **Response assertions** -- Validate status codes and response body content
- **Setup phase** -- Login or authenticate before running the load test
- **Ramp-up patterns** -- Gradually increase concurrency over time
- **File upload** -- Multipart/form-data uploads for stress-testing upload endpoints
- **Latency percentiles** -- p50, p95, p99, min, max, mean
- **Status code breakdown** -- 2xx/3xx/4xx/5xx distribution
- **Progress bar** -- Real-time progress with spinner
- **Multiple output formats** -- Terminal (default), JSON, HTML report with Chart.js

## Install

```bash
npm install -g @faizkhairi/loadtest-cli
```

## Usage

```bash
# Basic -- 100 requests, 10 concurrent (defaults)
loadtest https://api.example.com/users

# Custom concurrency and total
loadtest https://api.example.com/health -n 500 -c 50

# Run for 30 seconds instead of fixed request count
loadtest https://api.example.com/health -d 30 -c 50

# Rate-limited: 20 requests/second
loadtest https://api.example.com/users -n 200 --rps 20

# POST with varied payloads from file
loadtest https://api.example.com/users -m POST --payload-file payloads.json -n 100

# Assert all responses return 200 and contain "success"
loadtest https://api.example.com/health -n 50 --assert-status 200 --assert-body "success"

# Login first, then test authenticated endpoint
loadtest https://api.example.com/data \
  --setup https://api.example.com/login \
  --setup-method POST \
  --setup-body '{"user":"admin","pass":"secret"}' \
  -H "Authorization:Bearer {{SETUP_RESPONSE.token}}"

# Ramp up from 10 to 100 workers over 30 seconds
loadtest https://api.example.com/health -d 120 -c 10 --ramp-to 100 --ramp-over 30

# Upload a file
loadtest https://api.example.com/upload -m POST --file ./data.csv -n 50

# File upload with custom field name and extra form data
loadtest https://api.example.com/upload -m POST --file ./data.csv \
  --file-field "document" --form "userId:123" --form "batch:A" -n 50

# Custom headers + save HTML report
loadtest https://api.example.com/data \
  -H "Authorization:Bearer token123" \
  -n 1000 -c 100 -o report.html
```

## Options

| Flag | Description | Default |
|---|---|---|
| `-n, --requests <number>` | Total requests | 100 |
| `-c, --concurrency <number>` | Concurrent connections | 10 |
| `-d, --duration <seconds>` | Run for fixed duration (mutually exclusive with -n) | -- |
| `-m, --method <method>` | HTTP method | GET |
| `-H, --header <header...>` | Custom headers (key:value) | -- |
| `-b, --body <body>` | Request body (JSON) | -- |
| `-t, --timeout <ms>` | Request timeout | 10000 |
| `-o, --output <file>` | Output file (.json or .html) | -- |
| `--rps <number>` | Max requests per second | -- |
| `--payload-file <path>` | JSON file with array of payloads | -- |
| `--assert-status <code>` | Assert response status code | -- |
| `--assert-body <substring>` | Assert response body contains substring | -- |
| `--setup <url>` | Setup URL (fires once before test) | -- |
| `--setup-method <method>` | HTTP method for setup request | POST |
| `--setup-body <body>` | Request body for setup request | -- |
| `--ramp-to <number>` | Target concurrency for ramp-up | -- |
| `--ramp-over <seconds>` | Seconds to ramp from -c to --ramp-to | -- |
| `--file <path>` | File to upload (multipart/form-data) | -- |
| `--file-field <name>` | Form field name for the file | file |
| `--form <fields...>` | Additional form fields (key:value) | -- |

## Payload File Format

Create a JSON file with an array of objects. Each request picks the next payload round-robin:

```json
[
  { "name": "Alice", "amount": 100 },
  { "name": "Bob", "amount": 200 },
  { "name": "Charlie", "amount": 300 }
]
```

## Setup Phase

The `--setup` option fires a single HTTP request before the load test begins. The response is captured and available as template variables in your headers and body:

- `{{SETUP_RESPONSE}}` -- The full response (JSON stringified)
- `{{SETUP_RESPONSE.key}}` -- A specific field from the response
- `{{SETUP_RESPONSE.data.token}}` -- Nested field access

This enables login-then-test workflows where you need an auth token.

## Ramp-Up Patterns

Use `--ramp-to` and `--ramp-over` to gradually increase concurrency. The `-c` flag sets the starting concurrency, and workers are added incrementally until the target is reached:

```bash
# Start with 10 workers, ramp to 100 over 30 seconds
loadtest https://api.example.com -d 120 -c 10 --ramp-to 100 --ramp-over 30
```

Both flags are required together. `--ramp-to` must be greater than `-c`. Ramp-up works with both duration mode (`-d`) and request count mode (`-n`).

## File Upload

Use `--file` to send multipart/form-data requests for stress-testing upload endpoints:

```bash
# Basic file upload
loadtest https://api.example.com/upload -m POST --file ./data.csv -n 100

# Custom field name + extra form fields
loadtest https://api.example.com/upload -m POST \
  --file ./report.pdf --file-field "document" \
  --form "userId:123" --form "category:reports" -n 50
```

- `--file` is mutually exclusive with `--body` and `--payload-file`
- `--form` fields support `{{SETUP_RESPONSE.key}}` interpolation
- The file is read once at startup and reused across all requests

## Output Example

```
  Loadtest -> https://api.example.com/users
  500 requests, 50 concurrent, GET

  v Completed 500 requests in 3.24s

  +-----------------+-----------+
  | Metric          | Value     |
  +-----------------+-----------+
  | Total Requests  | 500       |
  | Successful      | 498       |
  | Failed          | 2         |
  | Duration        | 3.24s     |
  | Requests/sec    | 154.3     |
  +-----------------+-----------+

  Latency Distribution
  +-----------------+-----------+
  | Percentile      | Latency   |
  +-----------------+-----------+
  | Min             | 12.3ms    |
  | Mean            | 45.2ms    |
  | p50             | 38.1ms    |
  | p95             | 112.4ms   |
  | p99             | 234.7ms   |
  | Max             | 589.2ms   |
  +-----------------+-----------+
```

## Project Structure

```
loadtest-cli/
├── src/
│   ├── index.ts              # CLI entry (Commander.js)
│   ├── runner.ts             # Load test orchestrator
│   ├── worker.ts             # HTTP request worker
│   ├── setup.ts              # Setup phase runner
│   ├── stats.ts              # Percentiles, RPS calculator
│   ├── types.ts              # TypeScript interfaces
│   └── reporter/
│       ├── terminal.ts       # Colorized terminal output
│       ├── json.ts           # JSON output
│       └── html.ts           # HTML report with Chart.js
└── tests/
    ├── stats.test.ts         # Percentile & stats tests
    ├── reporter.test.ts      # JSON reporter tests
    ├── runner.test.ts        # Runner integration tests
    ├── worker.test.ts        # Worker & assertions tests
    └── setup.test.ts         # Setup phase tests
```

## License

MIT
