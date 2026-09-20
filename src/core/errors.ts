import { isRecord } from "./guards.js";

export function getErrorCode(err: unknown): number | undefined {
  if (!isRecord(err)) {
    return undefined;
  }
  const candidates: unknown[] = [err["code"], err["status"], err["statusCode"]];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isInteger(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string" && /^\d{3}$/.test(candidate.trim())) {
      return Number(candidate.trim());
    }
  }
  const response: unknown = err["response"];
  if (isRecord(response)) {
    const status: unknown = response["status"];
    if (typeof status === "number" && Number.isInteger(status)) {
      return status;
    }
    const data: unknown = response["data"];
    if (isRecord(data)) {
      const errorField: unknown = data["error"];
      if (isRecord(errorField)) {
        const nested: unknown = errorField["code"];
        if (typeof nested === "number" && Number.isInteger(nested)) {
          return nested;
        }
      }
    }
  }
  return getErrorCode(err["cause"]);
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export function withCode(err: Error, code: number): Error & { code: number } {
  const extended: Error & { code?: number } = err;
  extended.code = code;
  return extended as Error & { code: number };
}
