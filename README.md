# Flakewatch

Self-hosted flaky-test detection for CI.

Flakewatch collects JUnit XML test results from any CI system and identifies flaky tests
from concrete evidence. It ranks them by impact and lets teams quarantine them without
disabling them.

> **Status: design phase.** There is no usable release yet. The product specification and
> architecture are written, and implementation starts with
> [Milestone 1](ROADMAP.md#m1--foundation-and-parsing-core) of the roadmap.

## Why

Flaky tests pass and fail on the same code. They erode trust in CI: people re-run
pipelines by reflex, real regressions get dismissed as noise, and without history nobody
can say which tests are worst or whether things are improving. Existing tools are mostly
commercial SaaS that require sending test names and failure output to a third party.

## How it will work

- **One CI step.** Upload the JUnit XML your test runner already produces. Jest, Vitest,
  pytest, Go, Maven, Gradle and Playwright are verified with real reports. On GitHub
  Actions, the run metadata is detected automatically.
- **Evidence, not guesses.** A test is labeled flaky only when it failed and then passed on
  a retry within the same run, or when it both passed and failed on the same commit in the
  same environment. Every label links to the runs that prove it.
- **Quarantine without deleting.** A quarantined test keeps running and reporting.
  `flakewatch check` stops its failures from blocking merges and never excuses anything
  else.
- **Self-hosted.** One Docker image plus PostgreSQL. No telemetry.

## Documentation

- [Product specification](docs/product-spec.md): problem, users, requirements
- [Architecture](docs/architecture.md): design, data model, algorithms, tradeoffs
- [Repository structure](docs/repository-structure.md): where everything lives
- [Roadmap](ROADMAP.md): milestones and tasks

## Planned stack

TypeScript, Node.js, Fastify, React, PostgreSQL, Docker, GitHub Actions.

## License

Flakewatch is open source under the [MIT License](LICENSE).
