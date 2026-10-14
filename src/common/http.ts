import type { ApiErrorBody, ApiErrorDetail } from '../shared';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: ApiErrorDetail[] = [],
    public requestId?: string,
  ) {
    super(message);
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export function buildQuery(query: Record<string, QueryValue> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function http<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path + buildQuery(opts.query), {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new HttpError(0, 'NETWORK_ERROR', 'Unable to reach the server. Please check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const body = data as Partial<ApiErrorBody> | null;
    throw new HttpError(
      res.status,
      body?.error?.code ?? `HTTP_${res.status}`,
      body?.error?.message ?? `The request failed (HTTP ${res.status}).`,
      body?.error?.details ?? [],
      body?.requestId,
    );
  }
  return data as T;
}

export function detailsToFields(details: ApiErrorDetail[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of details) if (!out[d.field]) out[d.field] = d.message;
  return out;
}

export function isAbort(err: unknown): boolean {
  return (err as Error)?.name === 'AbortError';
}
