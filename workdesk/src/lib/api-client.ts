import type { ApiResponse } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// Typed browser API client.
//
// Every WorkDesk route returns the ApiResponse<T> envelope ({ success, data, error }).
// This client unwraps it: on success it returns `data`; on failure it throws an
// ApiError carrying the server's code/message/details + HTTP status, so callers
// (and TanStack Query) get a normal rejected promise to handle.
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  /** Query-string params; undefined/null values are skipped. */
  params?: Record<string, string | number | boolean | null | undefined>;
  /** JSON body for POST/PUT/PATCH. */
  body?: unknown;
  signal?: AbortSignal;
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.params), {
      method,
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: "same-origin",
    });
  } catch (err) {
    // Network/abort failures never reach the envelope.
    throw new ApiError(
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "Network request failed.",
      0
    );
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    // Non-JSON response (shouldn't happen for our routes).
  }

  if (!res.ok || !payload || payload.success === false) {
    const error = payload?.error;
    throw new ApiError(
      error?.code ?? "UNKNOWN_ERROR",
      error?.message ?? `Request failed with status ${res.status}.`,
      res.status,
      error?.details
    );
  }

  return payload.data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options),
  deleteWithBody: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>("DELETE", path, { ...options, body }),
};
