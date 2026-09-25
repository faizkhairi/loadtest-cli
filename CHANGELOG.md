# Changelog

All notable changes to this project are documented in this file.

## 2.1.1

### Fixed

- `sendRequest()` in `src/worker.ts` leaked a pending timeout timer on every
  failed request (network error, abort). `clearTimeout(timeoutId)` only ran
  on the success path; the `catch` block returned without clearing it. Under
  sustained request volume with failures, this accumulated one pending timer
  per failed request. The timer is now cleared in a `finally` block so it
  runs on both the success and failure paths.

## 2.1.0 and earlier

No changelog was kept prior to 2.1.1. See git history for details.
