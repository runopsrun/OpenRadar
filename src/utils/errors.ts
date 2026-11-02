export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function isTimeoutError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "TimeoutError") ||
    (error instanceof Error && error.name === "TimeoutError")
  );
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong.",
): string {
  if (isAbortError(error)) return "Request cancelled.";
  if (isTimeoutError(error)) return "The request timed out.";
  if (error instanceof HttpError) {
    if (error.status === 503) return "This data is disabled on the server.";
    if (error.status === 404) return "The data endpoint was not found.";
    if (error.status === 429) return "Too many requests — try again in a moment.";
    if (error.status >= 500) return "The weather service is temporarily unavailable.";
    return `The server returned HTTP ${error.status}.`;
  }
  if (error instanceof TypeError) {
    return "Network request failed. Check your connection or the data source URL.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
