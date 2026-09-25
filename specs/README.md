# Specifications

This folder holds the behavior contracts of the server. The project follows spec-driven
development (see `AGENTS.md`, section 3).

| File | Covers |
| --- | --- |
| [`tools.md`](tools.md) | The inputs, behavior, errors, and limits of each MCP tool. |

## Rules

1. Change the spec first. Then change the tests. Then change the code.
2. A spec describes behavior that a user can see. It does not name functions or files.
3. Every number and rule in a spec must match the code. A test must cover each rule.
4. A refactor that does not change behavior does not change a spec.
