export interface SetupOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface LoadTestOptions {
  url: string;
  requests: number;
  concurrency: number;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeout: number;
  // Feature 1: Duration mode
  duration?: number;
  // Feature 2: RPS rate limiting
  rps?: number;
  // Feature 3: Payload templates
  payloadFile?: string;
  // Feature 4: Response assertions
  assertStatus?: number;
  assertBody?: string;
  // Feature 5: Setup phase
  setup?: SetupOptions;
}

export interface RequestResult {
  status: number;
  latency: number;
  error?: string;
  // Feature 4: Assertion tracking
  assertionFailed?: boolean;
  assertionError?: string;
}

export interface RequestContext {
  index: number;
  payloads?: object[];
  setupResponse?: unknown;
}

export interface LoadTestContext {
  payloads?: object[];
  setupResponse?: unknown;
}

export interface LoadTestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  assertionFailures: number;
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
