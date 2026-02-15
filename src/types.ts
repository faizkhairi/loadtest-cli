export interface LoadTestOptions {
  url: string;
  requests: number;
  concurrency: number;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeout: number;
}

export interface RequestResult {
  status: number;
  latency: number;
  error?: string;
}

export interface LoadTestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  requestsPerSecond: number;
  latency: {
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  };
  statusCodes: Record<number, number>;
}

export type OutputFormat = 'terminal' | 'json' | 'html';
