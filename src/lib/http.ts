export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message?: string,
  ) {
    super(message ?? `Request to ${url} failed with ${status}`);
    this.name = "HttpError";
  }
}

type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
  /** Passed straight to Next's extended fetch — controls ISR for upstream calls. */
  next?: { revalidate?: number; tags?: string[] };
};

/**
 * fetch + JSON + an abort timeout, because a hanging upstream should fail the
 * request rather than hold a route handler open.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 8000, signal, ...init } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  const composed = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const res = await fetch(url, {
    ...init,
    signal: composed,
    headers: {
      Accept: "application/json",
      "User-Agent": "GTabsTerm/0.1 (+https://github.com)",
      ...init.headers,
    },
  });

  if (!res.ok) throw new HttpError(res.status, url);
  return (await res.json()) as T;
}
