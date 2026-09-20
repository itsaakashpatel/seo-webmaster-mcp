import { getErrorMessage } from "./errors.js";

export { getErrorCode, getErrorMessage, withCode } from "./errors.js";

const FETCH_TIMEOUT_MS = 15000;
const MAX_BODY_CHARS = 500;

export function getFetchTimeoutMs(): number {
  return FETCH_TIMEOUT_MS;
}

export function truncateBody(body: string, maxChars: number = MAX_BODY_CHARS): string {
  const trimmed: string = body.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return trimmed.slice(0, maxChars) + "…(truncated)";
}

export async function readBodyText(res: Response): Promise<string> {
  try {
    const text: string = await res.text();
    return truncateBody(text);
  } catch {
    return res.statusText || "";
  }
}

export async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    const json: unknown = await res.json();
    return json;
  } catch (err: unknown) {
    const body: string = await readBodyText(res);
    throw new Error(`Invalid JSON response (status ${res.status}): ${getErrorMessage(err)}. Body: ${body}`);
  }
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const timeoutMs: number = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const res: Response = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.headers,
    body: options.body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}
