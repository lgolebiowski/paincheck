# CLAUDE.md

## Working Style

Before making changes, inspect the relevant code and existing patterns.

Prefer the repository's current conventions over introducing new abstractions, libraries, or architectural patterns.

Keep changes narrowly scoped to the task. Do not refactor unrelated code, rename modules, upgrade dependencies, or change public APIs unless required.

Do not invent APIs, environment variables, database fields, configuration, or existing behaviour. If something important cannot be verified from the repository, say so.

If an ambiguity has a safe, conventional interpretation, make a reasonable choice and document it. If it affects architecture, security, data integrity, or public API behaviour, ask before proceeding.

## TypeScript

- Prefer strong types over `any`.
- Reuse existing shared types and interfaces where appropriate.
- Keep types close to the domain they represent.
- Avoid unnecessary type assertions.
- Preserve strict type safety.

## React

- Follow existing component, hook, and state-management patterns.
- Keep components focused and composable.
- Avoid unnecessary state and effects.
- Prefer derived values over duplicated state.
- Do not introduce new state-management libraries unless required.
- Preserve accessibility and existing UX behaviour.

## Node.js

- Follow existing routing, service, repository, validation, and error-handling patterns.
- Keep business logic out of controllers/routes where the codebase already separates concerns.
- Handle asynchronous failures explicitly.
- Avoid global mutable state.
- Preserve existing API contracts unless the task requires a change.

## Testing

For behavioural changes or bug fixes:

- Add or update relevant tests.
- Cover the main path and important edge cases.
- Add a regression test when fixing a bug.
- Prefer existing testing patterns and helpers.

Before finishing, run the relevant available checks:

- tests
- TypeScript type checking
- linting

Do not claim checks passed unless they were actually run.

## Review Before Finishing

Review the diff for:

- correctness
- unintended behaviour changes
- security issues
- error handling
- unnecessary complexity
- backwards compatibility
- missing tests
- unrelated changes

## Final Response

Keep the summary concise. Include:

1. What changed
2. Important implementation decisions
3. Tests/checks run
4. Any remaining risks or unresolved issues
