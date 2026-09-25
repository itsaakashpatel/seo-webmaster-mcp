import { FETCH_TIMEOUT_MS, MAX_ERROR_BODY_CHARS } from "./constants.js";
import { HttpError, getErrorMessage } from "./errors.js";

export interface FetchOptions {
  readonly method?: "GET" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs?: number;
}

export function truncateBody(body: string, maxChars: number = MAX_ERROR_BODY_CHARS): string {
  const trimmed = body.trim();
  return trimmed.length <= maxChars ? trimmed : `${trimmed.slice(0, maxChars)}…(truncated)`;
}

export async function readBodyText(res: Response): Promise<string> {
  try {
    return truncateBody(await res.text());
  } catch {
    // The body stream failed or was already read. The status text is the best detail left.
    return res.statusText;
  }
}

/** Reads a JSON body. Throws a clear error when the server sent HTML or broken JSON. */
export async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    const json: unknown = JSON.parse(text);
    return json;
  } catch (err: unknown) {
    throw new Error(
      `Invalid JSON response (status ${res.status}): ${getErrorMessage(err)}. Body: ${truncateBody(text)}`,
      { cause: err },
    );
  }
}

/**
 * Sends a request with a timeout. A network failure reports only the host, so a secret in the
 * query string (for example `apikey`) never reaches an error message.
 */
export async function fetchWithTimeout(url: URL, options: FetchOptions = {}): Promise<Response> {
  try {
    return await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    throw new Error(`Request to ${url.host} failed: ${getErrorMessage(err)}`, { cause: err });
  }
}

/** Throws an `HttpError` with the status and a truncated body when the response is not 2xx. */
export async function ensureOk(res: Response, label: string): Promise<Response> {
  if (res.ok) {
    return res;
  }
  const body = await readBodyText(res);
  throw new HttpError(`${label} error (${res.status}): ${body || res.statusText}`, res.status);
}
