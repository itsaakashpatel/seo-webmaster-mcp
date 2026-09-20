# AGENTS.md — Coding Standards (TypeScript + JavaScript)

Sources:
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/intro.html (static typechecking, narrowing, modules, classes, generics)
- MDN JavaScript Guide: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide (grammar/types, control flow, functions, promises, modules, classes)

These standards are mandatory for all code in this repo. They align with official docs, not personal preference.

## 1. TypeScript (per Handbook)

1. Enable `strict: true` in `tsconfig.json`. Do not use `any` for new code. Prefer `unknown` + narrowing.
2. Give every exported function an explicit return type and explicit parameter types.
3. Use `narrowing` (discriminated unions, `typeof`/`instanceof` guards, `Array.isArray`) before touching `unknown` or union values. Never cast with `as` to silence a check.
4. Model domain shapes with `interface`/`type`, `readonly` where mutation is not needed, and string-literal unions instead of bare `string` for enums (e.g. `"google" | "bing"`).
5. Use ES modules (`import`/`export`) with Node16 resolution. Keep `.js` extension on relative imports for ESM output.
6. Prefer `unknown` in `catch (err: unknown)`, then narrow to `Error`. Do not assume `err.message` exists.
7. Avoid non-null assertion (`!`). Use explicit checks and early throws.
8. Keep `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`, target ES2022 or later.

## 2. JavaScript (per MDN Guide)

1. Use `const` by default, `let` only for reassignment. Never use `var` (hoisting, scope bugs).
2. Use strict equality (`===`/`!==`). No `==` coercion.
3. Validate all external input at module boundaries (MCP tool args, env vars, HTTP bodies, `JSON.parse` results). Fail fast with clear `Error` messages.
4. Handle promises with `async`/`await` + `try`/`catch`. Every `fetch` must have `AbortSignal.timeout()` and check `res.ok` before `res.json()`. Guard `res.json()` in try/catch — servers return HTML on failure.
5. Construct `RegExp` from user input only inside try/catch, with length cap (≤200 chars). Reject invalid patterns with a validation error, never crash.
6. Use `URL` and `URLSearchParams` for URL building/parsing. Never concatenate query strings manually. Never log full URLs containing API keys.
7. Normalize user strings (`trim()`) before validation. Compare hosts/paths case-insensitively after normalization (lowercase host, strip trailing slash).
8. Use `Number.isInteger`, range checks, and `toFixed` only after proving finite numbers. Clamp pagination (`rowLimit`, `startRow`) explicitly and report effective values.
9. Prefer pure functions, small modules, single responsibility. Shared logic (validation, fetch-with-timeout, error formatting) lives in `src/core/`.
10. Follow MDN control-flow guidance: early returns, exhaustive `switch` with `default`, no fall-through bugs, no empty `catch {}` that hides failures (log or comment why ignored).

## 3. Error handling

1. Throw `Error` with actionable message. Include status code and truncated body (≤500 chars) for HTTP failures.
2. Check structured fields first (`err.code`, `err.status`, `res.status`), then substring match as fallback. Do not match `"403"` alone in a free-text message.
3. Tool handlers must catch and return `{ isError: true, content: [{ type: "text", text }] }`. Never leak secrets (API keys, service-account JSON) in messages. Redact paths to basename where possible.
4. Do not fabricate data. If a provider cannot supply a field (e.g. Bing URL-level inspection), return `"UNKNOWN"` + explanatory note, not `"PASS"`.

## 4. Security

1. Secrets only from env (`BING_WEBMASTER_API_KEY`, `GOOGLE_*`, `INDEXNOW_KEY`). Never hardcode. Never log secrets or full request URLs with `apikey`.
2. Validate hosts/URLs belong to claimed property before submission. Enforce IndexNow max 10,000 URLs and Google Indexing max 200 URLs per call/day, dedupe, require `http(s)://` URLs.
3. File reads (`GOOGLE_APPLICATION_CREDENTIALS`) must check existence, catch `JSON.parse` errors, and never print key material.

## 5. Style (minimal, to support above)

1. 2-space indent, semicolons, double quotes, trailing commas where multiline — match existing files.
2. One tool per file in `src/tools/`, one provider per folder in `src/providers/`.
3. No new dependencies without justification. Zod for tool schemas, `googleapis` for Google, native `fetch` otherwise.

## 6. Verification

1. Run `npm run build` (tsc) after every change. Fix all type errors, no `// @ts-ignore`.
2. Smoke-test tools with invalid input (bad date, bad regex, empty filter, oversized URL list) and confirm clean error, not crash.
