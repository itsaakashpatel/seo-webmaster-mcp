## Description

<!-- Provide a brief, clear summary of what this pull request does and why. -->

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 🛠️ Refactoring / Code improvement (no behavioral changes)
- [ ] 📝 Documentation update (README, docs, comments)
- [ ] 🧪 Testing (adding missing tests or updating existing tests)
- [ ] ⚙️ Tooling / CI / Infrastructure

## Related Issues / Context

<!-- Link any related issues or provide context (e.g., Fixes #123, Closes #456). -->

## Architectural & Provider Impact

- [ ] Google Search Console Provider
- [ ] Google Indexing API
- [ ] Bing Webmaster Provider
- [ ] IndexNow Protocol
- [ ] Core layer (`src/core/`)
- [ ] MCP Tools (`src/tools/`)

## Verification & Testing

Please describe the tests you ran to verify your changes:

- [ ] `npm run build` completed successfully (`tsc`).
- [ ] `npm test` passed with 0 failures (`node:test`).
- [ ] `npm run lint` passed with 0 errors and 0 warnings (`oxlint`).
- [ ] `npm run format:check` passed cleanly (`oxfmt`).
- [ ] Smoke-tested tools with invalid input (bad date, bad regex, empty list).

## Checklist

- [ ] My code strictly adheres to the coding standards in `AGENTS.md` (strict TypeScript, no `any`, proper error handling).
- [ ] I have not hardcoded secrets, API keys, or leaked sensitive filesystem paths.
- [ ] Exported functions have explicit return and parameter types.
- [ ] New tools or configuration variables are documented in `README.md` and `server.json`.
