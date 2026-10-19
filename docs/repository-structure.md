# Flakewatch — Repository Structure

| | |
|---|---|
| **Status** | Draft v0.1 |
| **Last updated** | 2026-10-19 |
| **Implements** | [Architecture](architecture.md) v0.3, §4 |
| **Related** | [Roadmap](../ROADMAP.md) |

This document defines the target layout of the repository, the purpose of every workspace
package, the root files, and the conventions that keep the codebase consistent. The
architecture remains the source of truth for *how components behave*; this document is the
source of truth for *where things live*.

**Nothing is created ahead of need.** Each directory and file is created by the roadmap
task that first requires it. The milestone is shown next to each entry.

---

## 1. Principles

1. **A new package needs a real boundary**: a separate deployable, a separately published
   artifact, or a different runtime (browser versus Node.js). Organizing code alone is a
   job for folders, not packages.
2. **`apps/` holds deployables; `packages/` holds libraries and published tools.**
3. **Internal packages are consumed as TypeScript source.** Only the server and the CLI
   are bundled (tsup); the web app is built by Vite. No per-library build step exists.
4. **One of each tool**: one TypeScript base config, one ESLint config, one Prettier
   config, and one Vitest setup.
5. **Tests live next to the code** they test, except integration and end-to-end tests,
   which need their own harnesses.

---

## 2. Target tree

```text
flakewatch/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # lint, typecheck, unit and integration tests      M1, grows
│   │   ├── codeql.yml                # static security analysis                         M1
│   │   └── release.yml               # image and npm publishing on version tags         M8
│   └── dependabot.yml                # npm and GitHub Actions updates                   M1
├── apps/
│   ├── server/                       # @flakewatch/server                               M2
│   │   ├── src/                      #   layout: architecture §4.2
│   │   ├── test/
│   │   │   ├── integration/          #   API and pipeline tests against PostgreSQL
│   │   │   └── support/              #   DB harness, data factories, mock GitHub (M5)
│   │   ├── bench/                    #   workload generator and benchmarks              M7
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                          # @flakewatch/web                                  M6
│       ├── src/                      #   layout: architecture §4.3
│       ├── index.html
│       ├── vite.config.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── core/                         # @flakewatch/core                                 M1
│   │   ├── src/
│   │   │   ├── input/                #   gunzip, decoding, decompressed-size cap
│   │   │   ├── junit/                #   XML guard, streaming JUnit visitor
│   │   │   ├── identity/             #   normalization v1, identity hash
│   │   │   ├── aggregate/            #   attempts, ambiguous duplicates, storage/check views
│   │   │   ├── text/                 #   sanitizeText, truncation, redaction, signatures
│   │   │   ├── parse-run.ts          #   pipeline entry point used by worker and CLI
│   │   │   ├── detection/            #   same-commit detection                          M3
│   │   │   ├── metrics/              #   status, metrics, ranking                       M3
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── contracts/                    # @flakewatch/contracts                            M2
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── cli/                          # flakewatch (published to npm)                    M4
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── e2e/                              # @flakewatch/e2e — Playwright E2E + accessibility  M7
├── fixtures/
│   ├── README.md                     # provenance and regeneration commands             M1
│   ├── producers/<producer>/         # sample suite, generate script, generated reports M1
│   └── hostile/                      # small hostile samples                            M1
├── docs/
│   ├── product-spec.md
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── reporters.md                  # how each test runner encodes results             M1
│   ├── api.md                        # public API reference                             M2
│   ├── flakiness-detection.md        # rules, formulas, worked examples                 M3
│   ├── ci-setup.md                   # CI integration guide                             M4
│   ├── benchmarks.md                 # measured performance                             M7
│   └── self-hosting.md               # deployment and operations                        M8
├── .editorconfig                                                                       # M1
├── .gitattributes                    # byte-exact fixtures                              M1
├── .gitignore                                                                          # M1
├── .nvmrc                            # Node.js Active LTS used for development           M1
├── .prettierrc.json                                                                    # M1
├── eslint.config.js                                                                    # M1
├── package.json                      # private root: workspace scripts and tooling only M1
├── pnpm-lock.yaml                                                                      # M1
├── pnpm-workspace.yaml                                                                 # M1
├── tsconfig.base.json                                                                  # M1
├── vitest.config.ts                  # root config; one Vitest project per package      M1
├── .env.example                      # every server setting, placeholders only          M2
├── docker-compose.dev.yml            # PostgreSQL for development and tests             M2
├── Dockerfile                        # single multi-stage image                         M8
├── .dockerignore                                                                       # M8
├── docker-compose.yml                # reference self-hosted deployment                 M8
├── CHANGELOG.md                                                                        # M8
├── CONTRIBUTING.md                                                                     # M1
├── LICENSE                                                                             # M1
├── README.md
├── ROADMAP.md
└── SECURITY.md                       # private vulnerability reporting                  M7
```

---

## 3. Workspace packages

| Path | Package name | Purpose | Internal deps | Distribution | Created |
|---|---|---|---|---|---|
| `packages/core` | `@flakewatch/core` | Pure domain logic: report input stage, XML guard, JUnit parser, test identity, attempt aggregation, text handling, detection, metrics | — | TypeScript source; bundled into server and CLI | M1 |
| `packages/contracts` | `@flakewatch/contracts` | Zod schemas, API types and error codes shared by server, web and CLI | — | TypeScript source | M2 |
| `apps/server` | `@flakewatch/server` | API server, worker and migrations; serves the built web app | core, contracts | Docker image | M2 |
| `packages/cli` | `flakewatch` | The CI-facing command-line tool: `upload`, `check` | core, contracts | npm, as one bundled file with no runtime dependencies | M4 |
| `apps/web` | `@flakewatch/web` | The dashboard SPA | contracts | Static assets inside the Docker image | M6 |
| `e2e` | `@flakewatch/e2e` | Playwright end-to-end and accessibility tests | none (drives server, web and CLI as processes) | Not distributed | M7 |

The npm name `flakewatch` must be confirmed as available before the first release (M8.4).
All other packages are `private: true`.

### 3.1 `packages/core`

- **Responsibilities:** the rules that decide correctness. These are turning uploaded
  bytes into normalized, aggregated results, computing identities, sanitizing and
  redacting text, detecting flaky evidence and computing status and metrics
  (architecture §5, §9.2–9.4, §10).
- **Must not:** access the database, the network, the filesystem, environment variables
  or the console. Callers pass in byte streams and configuration; `core` returns plain
  data. This makes everything in it deterministic and unit-testable.
- **Runtime:** Node.js only (it uses `node:crypto`, `node:zlib` and `node:stream`), which
  is one reason `web` never imports it.
- **External dependencies:** `saxes`. Anything else needs a justification in the pull
  request.

### 3.2 `packages/contracts`

- **Responsibilities:** request and response schemas, shared enums (outcomes, statuses,
  error codes) and the TypeScript types derived from them.
- **Must not:** contain logic beyond validation, or import Node.js built-ins, because it
  must stay browser-safe.
- **External dependencies:** `zod`.

### 3.3 `apps/server`

- **Responsibilities:** everything that runs on the server, in one image with three roles
  (`api`, `worker`, `migrate`). Source layout as in architecture §4.2.
- **`test/integration/`:** tests that need PostgreSQL, run through `fastify.inject` and
  the real worker pipeline.
- **`test/support/`:** the template-database harness, data factories and the mock GitHub
  (architecture §17). None of it is bundled into the production image.
- **`bench/`:** the synthetic workload generator and benchmark scripts (M7). They live
  here because they need the server's schema and services.

### 3.4 `packages/cli`

- **Responsibilities:** metadata detection, `upload`, `check` (architecture §8).
- **Must not:** import server code or require native modules. The published package is a
  single bundled file (FR-74).

### 3.5 `apps/web`

- **Responsibilities:** the dashboard (architecture §4.3). It talks to the server only
  through the internal API, typed by `contracts`.

### 3.6 `e2e`

- **Responsibilities:** browser-level tests of the core use cases and automated
  accessibility checks (architecture §17). Playwright starts the API, worker and mock
  GitHub itself, against a PostgreSQL service, so no container image is needed.

---

## 4. Top-level directories

| Directory | Contents |
|---|---|
| `fixtures/producers/` | Real reports from each supported test runner. Each producer directory holds the tiny sample suite, the command (run in a pinned Docker image) that regenerates the reports, and the reports themselves. `fixtures/README.md` records tool versions. |
| `fixtures/hostile/` | Small hostile samples (XXE, entity expansion, deep nesting, illegal characters, invalid UTF-8). **Large hostile inputs** (gzip bombs, multi-megabyte tokens) are generated by the tests at run time and never committed. |
| `docs/` | Specification, architecture, this document, and user- and operator-facing guides. |
| `.github/` | CI, security analysis, dependency updates, release automation. |

---

## 5. Conventions

| Topic | Convention |
|---|---|
| Modules | ESM only (`"type": "module"`). TypeScript `strict`, `NodeNext` resolution for Node packages, `Bundler` resolution for `web`. |
| Type checking | Each package runs `tsc --noEmit` against its own `tsconfig.json`, which extends `tsconfig.base.json`. No project references are needed, because internal packages are consumed as source. |
| Package scripts | Every package uses the same script names where they apply: `dev`, `build`, `test`, `lint`, `typecheck`. The root scripts run them across the workspace with `pnpm -r`. |
| Unit tests | Colocated as `*.test.ts` next to the code under test. |
| Integration tests | `apps/server/test/integration/`. Each test file gets its own cloned database. |
| E2E tests | `e2e/`. |
| Fixtures | Read through a small helper that resolves paths from the repository root. `.gitattributes` marks `fixtures/**` as `-text`, so Windows checkouts never change their bytes. |
| Dependencies | Declared in the package that uses them. The root `package.json` holds only workspace tooling (TypeScript, ESLint, Prettier, Vitest). Versions are locked by `pnpm-lock.yaml` and kept current by Dependabot. |
| Naming | Files in kebab-case; named exports; one concept per module. |
| Configuration | Server settings come only from environment variables, documented in `.env.example` with placeholder values. No real secrets ever appear in the repository. |
| Commits | [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, with an optional scope such as `feat(core): …`. |

---

## 6. Deliberately not included

| Not included | Why not now | Reconsider when |
|---|---|---|
| A separate `junit` parser package | It has no consumers outside `core`'s users; a folder boundary is enough (architecture ADR-12) | The parser becomes worth publishing on its own |
| A separate mock-GitHub package or container | Only server tests, E2E tests and `pnpm dev` use it | Another package needs to import it |
| Turborepo or Nx | Five packages build and test quickly with `pnpm -r` | CI takes long enough that task caching pays off |
| Changesets | Only one package is published; `CHANGELOG.md` is maintained by hand | Several packages are published independently |
| Husky / lint-staged | CI enforces linting, without local hook friction | Lint failures in pushed commits become a recurring problem |
| Storybook | The component set is small | The UI component library grows substantially |
| Containers for application development | Only PostgreSQL needs a container | — |

---

## Revision history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-19 | Initial layout, derived from architecture v0.3. |
