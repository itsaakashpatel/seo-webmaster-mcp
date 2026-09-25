import { isRecord } from "./guards.js";

const HTTP_STATUS_RE = /^\d{3}$/;

/** An error that carries the HTTP status of a failed response. */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "HttpError";
  }
}

function toStatus(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && HTTP_STATUS_RE.test(value.trim())) {
    return Number(value.trim());
  }
  return undefined;
}

/**
 * Finds the HTTP status code of an error. It reads `code`, `status`, and `statusCode`, then the
 * Axios/Gaxios `response`, then the `cause` chain.
 */
export function getErrorCode(err: unknown): number | undefined {
  if (!isRecord(err)) {
    return undefined;
  }
  const response = isRecord(err.response) ? err.response : {};
  const data = isRecord(response.data) ? response.data : {};
  const apiError = isRecord(data.error) ? data.error : {};
  const candidates: unknown[] = [
    err.code,
    err.status,
    err.statusCode,
    response.status,
    apiError.code,
  ];
  return candidates.map(toStatus).find((code) => code !== undefined) ?? getErrorCode(err.cause);
}

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
