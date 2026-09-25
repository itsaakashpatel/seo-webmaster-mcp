# AGENTS.md — Engineering Guide

This file is the contract for every human and AI agent that changes this repository. Read it
before you write code. When this file and your habits disagree, this file wins.

## 1. What this project is

`seo-webmaster-mcp` is a Model Context Protocol (MCP) server that runs over stdio. It gives AI
clients one set of tools for four search-engine back ends.

| Back end | Access | Used for |
| --- | --- | --- |
| Google Search Console API (v1) | Service account JSON or ADC | Sites, search analytics, URL inspection, sitemaps |
| Google Indexing API (v3) | Same credentials as Search Console | `URL_UPDATED` / `URL_DELETED` notifications |
| Bing Webmaster API (JSON) | `BING_WEBMASTER_API_KEY` | Sites, search analytics, crawl context, sitemaps |
| IndexNow | `INDEXNOW_KEY` | Instant URL submission to Bing, Yandex, Seznam, Naver |

The server exposes 8 tools: `engine_status`, `list_sites`, `search_analytics`, `inspect_url`,
`list_sitemaps`, `get_sitemap`, `submit_urls_indexnow`, and `submit_urls_google`. The contract of
each tool is in [`specs/`](specs/).

Every back end is optional. A tool must work, or fail with a clear setup guide, whatever
combination of credentials the user has.

## 2. Developer principles

- Prefer clarity over cleverness.
- Keep MVP scope narrow and single-project unless a documented decision expands it.
- Optimize for reliability and operability before abstraction.
- Make state transitions explicit and auditable.
- Preserve idempotency for asynchronous and scheduled workflows.
- Write code that a second engineer can modify quickly without hidden assumptions.
- Favor boring, well-understood primitives over novelty when the trade-off is unclear.
- Follow `YAGNI`: avoid over-engineering and do not build speculative capabilities before they are
  needed.
- Follow `KISS`: prefer simple, direct solutions over clever or layered ones.
- Follow `DRY`: eliminate duplication in code, types, validation rules, and documentation where
  practical.
- Always use Context7 when you need library or API documentation, code generation, setup or
  configuration steps, without the user having to ask. The whole project follows spec driven
  development.

## 3. Spec-driven development

1. Start every behavior change with the spec. Update or add a file in `specs/` first.
2. A spec states the inputs, the outputs, the errors, and the limits. It does not describe code.
3. Write or update the tests from the spec. Then write the code.
4. A pull request that changes behavior must change a spec in the same pull request.
5. A refactor that does not change behavior must not change a spec. The tests must pass
   unchanged, except for imports and renamed internal functions.

## 4. Architecture

```
src/
  index.ts            Entry point. Creates the server, registers tools, connects stdio.
  core/               Pure, engine-agnostic building blocks. No imports from providers or tools.
  providers/          One adapter per back end. Talks to the network. Returns domain types.
    index.ts          The static `providers` map: QueryEngineType -> SearchEngineProvider.
    google/ bing/ indexnow/
  tools/              One MCP tool per file. Validates input, calls a provider, renders Markdown.
    shared.ts         Shared zod schemas, tool annotations, render helpers, and the error boundary.
    index.ts          `registerAllTools(server)`.
```

Dependency rules:

- `tools` → `providers` → `core`. Never import in the other direction.
- `core` has no network calls and no `process.env` reads.
- A provider never returns Markdown. A tool never calls `fetch` or `googleapis`.
- A back-end response type (Bing JSON, `googleapis` schema) never leaves its provider folder.
  Map it to a domain type from `core/types.ts` at the edge.

## 5. Design patterns we use

Use these patterns. Do not add others without a documented reason.

| Pattern | Where | Why |
| --- | --- | --- |
| Adapter | `SearchEngineProvider` with one class per engine | Tools stay engine-agnostic. |
| Static map (not a registry) | `providers/index.ts` | `providers[engine]` is typed and never `undefined`. |
| Lookup table over `if`/`switch` chains | Status messages, filter prefixes, error tips | Adding a case is one line of data, not a new branch. |
| Pure mapper | `toSitemapInfo()`, `toAnalyticsRow()` | API → domain mapping is easy to test with fixtures. |
| Pure renderer | `renderX()` in each tool file | Domain → Markdown is easy to test without a server. |
| Error boundary | `withErrorBoundary()` in `tools/shared.ts` | One `try`/`catch` for all tools. |
| Lazy singleton | Google API clients | Credentials load on first use, not at import time. |
| Parse at the boundary | zod schemas, `core/guards.ts` | Inside the boundary, types are trusted. |

## 6. TypeScript standards

Sources: [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) and the
[TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html).

### Types

1. Keep `strict` and the extra flags in `tsconfig.json` on.
2. Do not use `any`. Use `unknown`, then narrow with a type guard from `core/guards.ts`.
3. Do not use `as` to silence the compiler. The only allowed use is a documented interop cast
   at a library boundary.
4. Do not use non-null assertions (`x!`). Check the value, or throw a clear error.
5. Use `interface` for object shapes. Use `type` for unions, tuples, and aliases.
6. Use string-literal unions, not `enum`, for closed sets (for example `"google" | "bing"`).
   Derive the union from a `const` array when code also needs the list at run time.
7. Mark fields and parameters `readonly` when code does not change them.
8. Give every exported function an explicit return type. Let TypeScript infer local types.
9. Use `import type` for imports that are only types.

### Naming and modules

1. `lowerCamelCase` for values and functions. `UpperCamelCase` for types and classes.
   `CONSTANT_CASE` for module-level constants.
2. Treat acronyms as words: `parseBingDate`, `HttpError`, not `parseBINGDate`, `HTTPError`.
3. Use named exports only. No default exports.
4. Use relative imports with the `.js` extension (Node16 ESM).
5. Do not re-export a module from another module. Import from the file that owns the symbol.
6. Do not create classes that hold only static methods. Export functions.

### Functions and control flow

1. Keep a function short and at one level of abstraction. The linter limits are in section 8.
2. Return early. Put guard clauses at the top. Avoid `else` after `return`.
3. Replace an `if`/`else if` chain of three or more branches with a lookup table
   (`Record<Key, Value>`) or a list of `[condition, value]` pairs.
4. Transform collections with `map`, `filter`, `flatMap`, and `reduce`. Use `for...of` only for
   side effects or sequential `await`. Do not use `forEach` or index-based `for` loops.
5. Do not nest ternaries.
6. Always use braces for `if` blocks.
7. Always use `===` and `!==`.
8. A `switch` must have a `default` branch. Each branch must end in `return`, `throw`, or `break`.
9. Run independent async calls with `Promise.all` or `Promise.allSettled`, not one by one.

### Errors

1. Throw only `Error` or a subclass (`HttpError` in `core/errors.ts`). Always use `new`.
2. Name the value and the fix in the message: `Invalid countryFilter "US". Use ISO 3166-1
   alpha-3 (e.g. USA, GBR).`
3. When you rethrow, keep the original: `throw new Error(message, { cause: err })`.
4. Read status codes with `getErrorCode()`. Do not search free text for `"403"`.
5. Every empty `catch` must have a comment that explains why the error is ignored.
6. Tools do not catch errors themselves. `withErrorBoundary()` turns any thrown error into an MCP
   `isError` result.

### Comments

1. Use `/** JSDoc */` on exported functions whose purpose the name does not make clear.
2. Use `//` comments to explain *why*, not *what*.
3. Do not leave commented-out code.

## 7. Domain rules

1. Do not fabricate data. When a back end cannot supply a value (for example Bing URL-level
   inspection or Bing indexed counts), return `undefined` or `"UNKNOWN"` and add a note.
2. Validate every external input at the boundary: tool arguments (zod), environment variables,
   HTTP bodies, and `JSON.parse` results.
3. Compile user regex patterns only with `buildSafeRegExp()` (RE2, linear time).
4. Every network call goes through `fetchWithTimeout()` (15 s default) or a `googleapis` client.
5. Check `res.ok` before you read a body. Read JSON with `readJsonSafe()`.
6. Enforce the API limits in the provider: IndexNow 10,000 URLs per request, Google Indexing
   200 URLs per call. Deduplicate URLs before you submit them.

## 8. Enforced limits

`npm run lint` (oxlint, `.oxlintrc.json`) enforces these limits in `src/`.

| Rule | Limit |
| --- | --- |
| `complexity` | 10 per function |
| `max-depth` | 3 nested blocks |
| `max-lines-per-function` | 60 lines, not counting blank lines and comments |
| `max-params` | 4 (use an options object for more) |
| `max-lines` | 300 per file |
| `no-nested-ternary`, `curly`, `no-else-return`, `no-param-reassign` | error |
| `typescript/consistent-type-imports`, `import/no-default-export` | error |
| `unicorn/no-array-for-each`, `unicorn/no-lonely-if` | error |

Do not disable a rule for a whole file. To disable a rule for one line, add a reason:
`// oxlint-disable-next-line no-await-in-loop -- batches must run in sequence to cap concurrency.`

## 9. Security

1. Read secrets only from environment variables. Never hard-code them.
2. Never log or return a secret, a service-account key, or a URL that contains `apikey`.
   `fetchWithTimeout()` reports only the host of a failed request.
3. Show only the base name of a credentials file path in error messages.
4. Check that each submitted URL belongs to the claimed host before an IndexNow submission.

## 10. Testing

1. Tests live in `tests/*.test.ts` and use `node:test` and `node:assert/strict`.
2. Test pure functions directly. Test providers with recorded fixtures and a stubbed
   `globalThis.fetch`. Restore every stub in a `finally` block.
3. Every bug fix adds a test that fails before the fix.
4. Do not call real back ends from tests.

## 11. Before you commit

Run all four commands. All must pass.

```bash
npm run build
npm run lint
npm run format:check
npm test
```

Commit rules:

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
  `refactor:`, `docs:`, `test:`, `chore:`.
- Keep one logical change per commit.
- Commit under the human author's git identity. Do not add AI co-author trailers or
  "generated by" lines.
