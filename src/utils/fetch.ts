import { HttpError } from "@/utils/errors";

interface FetchJsonOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/**
 * Fetch JSON with a timeout and an optional caller-owned abort signal.
 * Throws HttpError for non-2xx responses so callers can present useful copy.
 */
export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { signal, timeoutMs = 20_000, headers = {} } = options;
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("The request timed out.", "TimeoutError"));
  }, timeoutMs);

  const forwardAbort = () => {
    controller.abort(signal?.reason);
  };

  if (signal) {
    if (signal.aborted) forwardAbort();
    else signal.addEventListener("abort", forwardAbort, { once: true });
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...headers,
      },
      credentials: "omit",
      mode: "cors",
    });

    if (!response.ok) {
      throw new HttpError(
        response.status,
        `${url} returned HTTP ${response.status}`,
      );
    }

    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error("The server returned an invalid JSON response.");
    }
  } catch (error) {
    if (timedOut) {
      throw new DOMException("The request timed out.", "TimeoutError");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

/** Small fetch helper for image bytes (used by the preloader and tile protocol). */
export async function fetchArrayBuffer(
  url: string,
  timeoutMs = 25_000,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("The request timed out.", "TimeoutError")),
    timeoutMs,
  );

  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) forwardAbort();
    else signal.addEventListener("abort", forwardAbort, { once: true });
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      mode: "cors",
    });
    if (!response.ok) {
      throw new HttpError(
        response.status,
        `${url} returned HTTP ${response.status}`,
      );
    }
    return await response.arrayBuffer();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}
