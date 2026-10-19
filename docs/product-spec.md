# Flakewatch — Product Specification

| | |
|---|---|
| **Status** | Draft v0.2 |
| **Last updated** | 2026-10-19 |
| **Related** | [`docs/architecture.md`](architecture.md), [`ROADMAP.md`](../ROADMAP.md) |

This document defines what Flakewatch is, who it is for, and what the first usable
version (the MVP) must do. It deliberately says *what* and *why*, not *how*;
implementation decisions belong in the architecture document.

---

## 1. Problem statement

A **flaky test** is a test that both passes and fails on the same code. Almost every
non-trivial test suite has some. Common causes include timing assumptions, shared state
between tests, dependence on test order, network calls, and resource contention on CI
machines.

The cost of flaky tests is mostly indirect:

- **Trust erodes.** When a red build is often "just flaky", developers re-run pipelines
  by reflex, and genuine regressions get dismissed as noise.
- **Time is wasted.** Every re-run costs CI minutes and, more expensively, developer
  attention and context switches.
- **Nobody can prioritize.** CI systems show one run at a time. Without history there is
  no answer to *which tests are flaky, how often, since when, and is it getting better?*
  So flaky tests are rarely fixed until they become unbearable.

Existing solutions are mostly commercial SaaS products, which require sending test names,
file paths and failure output to a third party, or large test-management platforms
that are expensive for a small team to run.

**Flakewatch** is a self-hosted service that collects test results from any CI system,
identifies flaky tests from concrete evidence, ranks them by impact, and lets teams
quarantine them without disabling them.

### Product principles

1. **Evidence over guesswork.** A test is labeled flaky only when there is concrete
   evidence, such as passing and failing on the same commit. Every label links to that
   evidence, and detection is deterministic and explainable.
2. **Never become a new source of CI flakiness.** If Flakewatch is down or slow, CI
   behaves as if Flakewatch were not there. Uploads do not fail builds by default, and
   gating fails closed (no failures are excused if quarantine data is unavailable).
3. **Your data stays yours.** Self-hosted, a single PostgreSQL dependency, and no
   telemetry.
4. **Low adoption cost.** One CI step and standard JUnit XML. No test-runner plugins
   required.
5. **Quarantine, don't delete.** Quarantined tests keep running and reporting, so the
   team can see when they have been fixed.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Instance** | One deployment of Flakewatch, typically serving one team or organization. |
| **Project** | A test suite being tracked, usually one repository. |
| **Run** | The test results of one CI job execution, delivered in one upload (one or more report files). |
| **Variant** | A label for the environment a run executed in, e.g. `ubuntu-node22`. Results are only compared for flakiness within the same variant. |
| **Test** | A uniquely identified test case within a project. Its identity is derived from its suite/class name and test name. |
| **Result** | The outcome of one test in one run: `passed`, `failed`, `errored`, or `skipped`. |
| **Attempt** | One execution of a test within a run. A run may contain several attempts of the same test when the test runner retries it. |
| **Flaky event** | A piece of evidence that a test is flaky, linked to the run(s) that show it. |
| **Quarantine** | A recorded team decision that a test's failures should not fail CI, with a reason and an optional expiry. |
| **Failure signature** | A normalized form of a failure message, used to group failures that likely share a cause. |
| **Analysis window** | The time span over which flakiness status and metrics are computed (default 14 days). |

---

## 3. Users

| Persona | Goal | Key need |
|---|---|---|
| **Developer** | Get their change merged. | Know quickly whether a failure was caused by their change or by a known-flaky test. |
| **Tech lead / maintainer** | Keep the test suite trustworthy. | A ranked, evidence-backed list of flaky tests, and a trend that shows progress. |
| **Instance administrator** | Run Flakewatch reliably. | Simple deployment, safe upgrades, modest resource usage, access control. |
| **Open-source maintainer** *(post-MVP)* | Same as tech lead, in public. | Public read-only dashboards and status badges. |

---

## 4. Core use cases

**UC-1 — Set up a project.** An administrator deploys Flakewatch with Docker Compose,
signs in, creates a project, generates an API token, and adds an upload step to the CI
workflow using the snippet shown in the empty project view. Results appear after the
next CI run.

**UC-2 — Upload results.** After tests run, CI calls `flakewatch upload` with the paths of
the JUnit XML reports. On GitHub Actions, the CLI detects run metadata automatically
(commit, branch, pull request, run URL, attempt, job). Elsewhere, it takes the metadata
from flags. A failed upload never fails the build by default.

**UC-3 — Triage a red build.** A developer opens the run from the link printed in the CI
log. The run page lists the failed tests and marks which ones are known flaky or
quarantined, with links to the evidence.

**UC-4 — Gate only on real failures.** When the test command fails, CI runs
`flakewatch check` with the command's exit code. `check` turns the failure into a pass only
when every failing test is quarantined and nothing suggests a crash or an incomplete run.
Quarantined flaky tests therefore no longer block merges, but they are still tracked.

**UC-5 — Prioritize reliability work.** A tech lead opens the project overview. It shows
the number of flaky tests, the share of runs affected by flakiness over time, and the
flaky tests ranked by impact.

**UC-6 — Investigate a flaky test.** The test detail page shows the evidence (which runs
and commits showed the test passing and failing), recent results per variant, failure
signatures with example messages, when flakiness was first and last seen, and links to
the CI runs.

**UC-7 — Quarantine and release.** A team member quarantines a test with a reason and an
optional expiry date. When the test is fixed, they release it. Every quarantine change
is recorded with who did it and when.

**UC-8 — Administer.** Owners manage project members, API tokens (create, revoke, see last
use) and project settings (default branch, analysis window, retention). Instance admins
manage who can sign in.

---

## 5. MVP scope

The MVP is the smallest version that a real team can rely on day to day. The first such
team is Flakewatch itself: its own CI will upload results to a Flakewatch instance.

### 5.1 In scope

- Self-hosted deployment with Docker Compose (application + PostgreSQL)
- Sign-in with GitHub OAuth; closed sign-in by default; instance admins
- Projects with members (owner and member roles)
- Project-scoped API tokens
- CLI with `upload` and `check` commands, automatic GitHub Actions metadata detection, and
  flags for any other CI system
- JUnit XML ingestion, verified against fixture reports from common test runners
- Asynchronous processing with visible status and errors
- Test identity, variants, result storage
- Flakiness detection from retry evidence and same-commit evidence
- Per-test and per-project flakiness metrics, with deterministic ranking by impact
- Failure signatures on the test detail page
- Quarantine with reason, expiry, history, and a quarantine-list API
- Dashboard: projects, project overview, tests, test detail, runs, run detail, settings
- Automatic data retention
- Documentation: README, self-hosting guide, CI setup guide, flakiness-detection design
  note

### 5.2 Planned after the MVP

These are deliberately excluded from the MVP and will be tracked in `ROADMAP.md`:

- GitHub App: pull request comments, Checks annotations, automatically created issues
- Native reporters for specific test runners (richer retry and metadata capture)
- First-class GitLab CI, CircleCI and Buildkite metadata detection
- Notifications (Slack, email, generic webhooks) and weekly digests
- Public projects and status badges
- Detection of tests that got slower
- Heuristic flakiness signals across *different* commits (e.g. flip rate on the default
  branch)
- Test rename tracking and grouping of parameterized tests
- Long-term aggregated history beyond the raw-data retention period
- Email/password sign-in and generic OIDC/SSO
- Tokenless uploads using GitHub Actions OIDC; uploads from fork pull requests

---

## 6. Non-goals

These are out of scope permanently unless this document is revised:

- **Running tests or orchestrating CI.** Flakewatch does not execute tests or trigger
  automatic re-runs.
- **Test case management.** No manual test plans, test documentation, or QA workflows.
- **Code coverage, build logs, or artifact storage.**
- **Multi-tenant hosted SaaS.** One instance serves one team or organization. There is no
  billing and no isolation between unrelated customers.
- **Machine-learning-based classification.** Detection stays deterministic and explainable
  (principle 1).
- **Benchmarking the code under test.**

---

## 7. Functional requirements

Priority: **M** = required for the MVP. **S** = should be in the MVP, but may slip to the
following milestone without making the product unusable.

### 7.1 Accounts and access

| ID | Requirement | Pri |
|---|---|---|
| FR-1 | Users sign in with GitHub OAuth. Only the GitHub login, display name and avatar URL are stored. | M |
| FR-2 | Sign-in is closed by default. Only GitHub accounts listed as admins in the instance configuration, or added by an admin, can sign in. | M |
| FR-3 | Instance admins can add and remove users and grant or revoke admin rights. The configuration-listed admins cannot be demoted from the UI. | M |
| FR-4 | Project roles: **owner** (manage settings, members and tokens; delete the project) and **member** (view data; quarantine and release tests). Instance admins have owner rights on every project. | M |
| FR-5 | Users can see only the projects they are members of. Admins can see all projects. | M |
| FR-6 | Sessions expire after a configurable period of inactivity (default 7 days) or after an absolute maximum of 30 days, whichever comes first. They also end on sign-out. | M |

### 7.2 Projects and tokens

| ID | Requirement | Pri |
|---|---|---|
| FR-10 | Any signed-in user can create a project and becomes its owner. Owners can rename and delete projects. Deletion removes all project data and requires typing the project name to confirm. | M |
| FR-11 | Project settings: default branch (default `main`), analysis window (1–90 days, default 14), raw-result retention (7–365 days, default 30, never shorter than the analysis window). | M |
| FR-12 | Owners create API tokens with a name and one or more scopes (`results:write`, `quarantine:read`). The token secret is shown exactly once. | M |
| FR-13 | Tokens can be revoked. The token list shows name, scopes, creator, creation time and last-used time. | M |
| FR-14 | Tokens have a fixed, documented prefix so that secret scanners can recognize leaked tokens. | M |

### 7.3 Ingestion

| ID | Requirement | Pri |
|---|---|---|
| FR-20 | An HTTP API accepts an upload of one or more JUnit XML files (optionally gzip-compressed) plus run metadata, authenticated by a project token with the `results:write` scope. | M |
| FR-21 | Run metadata: commit SHA (required), branch, pull request number, CI provider, CI run ID, attempt number, job name, variant (default `default`), CI run URL, start time. | M |
| FR-22 | Uploads are idempotent. Repeating an upload with the same idempotency key returns the original run and creates no duplicate data. | M |
| FR-23 | An upload is stored durably and acknowledged (run ID and run URL) before processing starts. Processing is asynchronous. | M |
| FR-24 | Each run shows its processing status (`queued`, `processing`, `completed`, `failed`) and a human-readable error when processing failed. | M |
| FR-25 | If some files in an upload are invalid, the valid files are processed and the run lists a warning for each invalid file. A run fails only when none of its files are valid. | M |
| FR-26 | The parser supports `<testsuites>` and `<testsuite>` roots, nested suites, and `<testcase>` with `<failure>`, `<error>` and `<skipped>`. It also supports Surefire-style retry elements (`<flakyFailure>`, `<flakyError>`, `<rerunFailure>`, `<rerunError>`) and repeated `<testcase>` entries for the same test within one report. | M |
| FR-27 | Parser behavior is verified against fixture reports from Jest (`jest-junit`), Vitest, pytest, Go (`gotestsum`), Maven Surefire, Gradle and Playwright. How each one encodes retries is verified and documented. | M |
| FR-28 | Configurable limits, with defaults: compressed upload ≤ 20 MB; decompressed total ≤ 200 MB; ≤ 100,000 results and ≤ 500,000 test-case entries per run; failure text ≤ 16 KB per failed attempt (longer text is truncated and marked), stored for at most 3 failed attempts per result and at most 1,000 failing results per run. A limit that can be checked at upload time rejects the upload with an HTTP error. A limit that can only be checked while parsing makes the run fail, with an explanatory error. | M |
| FR-29 | Before storage, failure text goes through best-effort redaction of common secret formats (bearer tokens, private key blocks, well-known token prefixes, `password=`-style pairs). `<system-out>` and `<system-err>` are not stored. | M |

### 7.4 Test identity and variants

| ID | Requirement | Pri |
|---|---|---|
| FR-30 | A test's identity is its normalized suite/class name plus its normalized test name. The CLI and server use the same normalization so that their results always match. | M |
| FR-31 | For each test, Flakewatch records its display name, its file path (when reported) and when it was first and last seen. | M |
| FR-32 | A run shows how many previously unseen tests it introduced. A warning appears when a run on an established project introduces unusually many, which usually means test names contain dynamic values. | S |

### 7.5 Flakiness detection

| ID | Requirement | Pri |
|---|---|---|
| FR-40 | **Retry evidence.** Within one run, a test with at least one failed attempt and at least one passing attempt produces a `retry` flaky event. Attempts come from explicit retry elements, or from repeated entries within the same test suite. Repeated entries in different test suites or files are **ambiguous duplicates**, for example the same test run in several browser projects. They produce no retry event, count as failed if any copy failed, and add a warning to the run. | M |
| FR-41 | **Same-commit evidence.** Within one project, commit SHA and variant, a test with at least one passing and one failing result in different runs produces a `same_commit` flaky event that references the runs involved. | M |
| FR-42 | Results from different variants are never compared. Results from uploads that share the same CI run ID *and* attempt number are treated as parallel executions (e.g. a matrix build with no variant set), not as re-runs. They never produce same-commit evidence, and the run shows a warning suggesting a variant configuration. A missing attempt number counts as attempt 1. If a test is reported by two or more such parallel runs within a commit group, it is excluded from same-commit comparisons for every attempt of that CI run, because its results may come from different environments. | M |
| FR-43 | Skipped results are ignored for flakiness. Failed and errored results both count as failures. | M |
| FR-44 | Detection is deterministic. The same set of results always produces the same flaky events, regardless of upload order or late-arriving uploads. | M |
| FR-45 | Each test has a status over the analysis window, in this precedence order: **failing** (its 3 most recent non-skipped results within the analysis window, from runs on the default branch that are not pull requests, all failed), **flaky** (at least one flaky event), **healthy**, or **no recent data**. Quarantine is shown separately from status. | M |
| FR-46 | Per-test metrics over the analysis window: runs, failures, flaky events, **affected runs** (distinct runs in which the test failed as part of flaky evidence), and flake rate (affected runs ÷ runs). Default ranking is by affected runs, then flake rate, then test name, so it is deterministic. Exact formulas are documented in the flakiness-detection design note. | M |
| FR-47 | Per-project metrics over the analysis window: number of flaky tests, share of runs with at least one flaky failure, and the daily trend of both. | M |

### 7.6 Failure signatures

| ID | Requirement | Pri |
|---|---|---|
| FR-50 | Failure messages are normalized into signatures by removing volatile parts such as numbers in known volatile positions, timestamps, hexadecimal addresses, UUIDs and temporary paths. The test detail page groups failures by signature, with counts, first and last occurrence, and an example message. | S |

### 7.7 Quarantine

| ID | Requirement | Pri |
|---|---|---|
| FR-60 | Members can quarantine a test with a required reason and an optional expiry date, and can release it. | M |
| FR-61 | Quarantines stop applying automatically at their expiry time, and the history shows them as expired. | M |
| FR-62 | Every quarantine change is recorded in the test's history: who, when, action, reason. | M |
| FR-63 | Quarantine-list API: a token with the `quarantine:read` scope can fetch the project's currently quarantined tests as JSON. | M |
| FR-64 | The quarantine-list API supports conditional requests (ETag). | S |
| FR-65 | Quarantined tests continue to be ingested and analyzed. The UI highlights quarantined tests with at least 10 runs and no failures since they were quarantined, as candidates for release. | S |

### 7.8 Command-line interface

| ID | Requirement | Pri |
|---|---|---|
| FR-70 | `flakewatch upload <paths or globs>` collects run metadata (detected automatically on GitHub Actions; flags and environment variables override), compresses the reports, uploads them with bounded retries and backoff, and prints the run URL. | M |
| FR-71 | By default, `upload` exits with code 0 and prints a warning if the server is unreachable or rejects the upload. `--strict` makes these errors fatal. | M |
| FR-72 | `flakewatch check <paths or globs> --test-exit-code <code>` runs after the test command and receives its exit code. It exits 0 only when all of the following hold: the test command failed with an excusable exit code (default `1`; signal exits are never excusable); the local reports are present, recent and parseable; they contain at least one failing test and no suite-level failures; and every failing test is quarantined. Otherwise it exits with the test command's original code. Either way it prints what was excused and what was not. If the quarantine list cannot be fetched, no failures are excused (fail closed). | M |
| FR-73 | The server URL and token are configurable by flags or environment variables (`FLAKEWATCH_URL`, `FLAKEWATCH_TOKEN`). The token is never printed. | M |
| FR-74 | The CLI runs with `npx` and has no native dependencies. | M |
| FR-75 | A GitHub Action wraps the CLI for simpler workflow setup. | S |

### 7.9 Dashboard

| ID | Requirement | Pri |
|---|---|---|
| FR-80 | A projects list with headline numbers for each project. | M |
| FR-81 | Project overview: flaky test count, share of runs affected, trend chart over the analysis window, top 10 flaky tests, recent runs. | M |
| FR-82 | Tests list: search by name; filter by status and quarantine; sort by affected runs, flake rate or last flaky event; paginated. | M |
| FR-83 | Test detail: status, metrics, evidence list linking to runs, CI and commits, recent results per variant, failure signatures, quarantine controls and history. | M |
| FR-84 | Runs list (filter by branch and status) and run detail (metadata, result counts, failed tests annotated as known flaky or quarantined, processing warnings). | M |
| FR-85 | Settings pages: project settings, members and tokens for owners; user management for instance admins. | M |
| FR-86 | URLs are stable and shareable. Filters and sorting are kept in the query string. | M |
| FR-87 | Empty states guide setup. A project with no runs shows a ready-to-copy CI snippet for that project. | M |

### 7.10 Data lifecycle

| ID | Requirement | Pri |
|---|---|---|
| FR-90 | A daily job deletes runs, results and flaky events older than the project's retention period. Evidence that depended on deleted runs is re-evaluated. Quarantine history is kept for as long as the project exists. | M |
| FR-91 | Deleting a project removes all of its data. | M |
| FR-92 | Instance admins can reprocess a run from its stored upload, e.g. after a parser fix, as long as the upload is within the retention period. | S |

---

## 8. Non-functional requirements

### 8.1 Reliability

- An acknowledged upload is never lost: the raw upload is stored durably before the
  acknowledgement is sent.
- Processing jobs retry transient errors with backoff. Permanent failures appear on the
  run page, and the raw upload is kept so the run can be reprocessed.
- Shutdown is graceful: in-flight jobs either finish or are safely returned to the queue.
- Liveness and readiness health endpoints are available. Readiness includes database
  connectivity.
- Database schema changes are versioned migrations, applied by an explicit, documented
  step.

### 8.2 Usability and accessibility

- **Time to first value:** following the README, a new user can go from cloning the
  repository to seeing their first uploaded run in under 15 minutes.
- The dashboard targets **WCAG 2.2 AA**: full keyboard navigation, visible focus, sufficient
  contrast, semantic markup.
- **Status is never conveyed by color alone.** Pass, fail and flaky states always have an
  icon and text label, and charts use a colorblind-safe palette.
- Read-only views work on screens down to 360 px wide (triage from a phone). Settings
  pages may be desktop-first.
- Timestamps are stored in UTC and displayed in the viewer's time zone, with the exact
  time available on hover.
- Light and dark themes *(S)*.

### 8.3 Maintainability

- TypeScript in strict mode throughout. Types and test-identity logic are shared between
  the CLI and the server.
- Automated unit, integration (against a real PostgreSQL) and end-to-end tests run in CI on
  every pull request.
- Linting and formatting are enforced in CI.
- Parser behavior is pinned by fixture-based ("golden file") tests.
- The public HTTP API is versioned (`/api/v1`). Breaking changes require a new version.

### 8.4 Operability

- Configuration comes from environment variables and is validated at startup, with clear
  error messages.
- Logs are structured JSON with request IDs. Logs never contain tokens, session secrets
  or report contents.
- The only external dependency is PostgreSQL 16 or newer.
- Docker images are published for `linux/amd64`, and `linux/arm64` *(S)*.
- Backup and restore rely on standard PostgreSQL tooling, and the procedure is documented.

### 8.5 Compatibility

- The CLI runs on Linux, macOS and Windows CI runners with Node.js 22 or newer.
- The dashboard supports the latest two versions of evergreen browsers.

---

## 9. Performance expectations

**Reference hardware:** a single host with 2 vCPUs, 4 GB RAM and SSD storage, running both
Flakewatch and PostgreSQL.

**Reference workload:** 3 projects, 5,000 tests per project, 50 runs per day per project,
30-day retention. That is about 22.5 million stored results.

| Area | Target |
|---|---|
| Upload acknowledgement | p95 < 1 s for a 5 MB compressed upload |
| Processing | A run of 10,000 results is fully processed (parsed, stored, analyzed) within 15 s of acknowledgement, p95 |
| Dashboard | p95 server response < 300 ms for project overview, tests list and test detail at the reference workload |
| Quarantine-list API | p95 < 100 ms |
| CLI overhead | `upload` normally adds < 10 s to a CI job. Its total time is bounded by a timeout (default 60 s) |
| Burst ingestion | Sustains 1 upload/s for 5 minutes without rejecting uploads (excess work is queued) |
| Memory | Reports are parsed as a stream, so a 200 MB report is never loaded fully into memory. Application memory stays under 512 MB at the reference workload |

These targets will be checked by a reproducible benchmark that uses a synthetic data
generator. Any deviation will be documented in the benchmark results, not hidden.

---

## 10. Security considerations

### 10.1 Assets and threats

- **Assets:** test metadata (test names, file paths and failure output, which may contain
  internal hostnames or accidentally logged secrets), API tokens, and user sessions.
- **Actors:** authenticated users with different roles; CI jobs holding tokens; anyone who
  can get code into CI (e.g. a pull request author, who controls test names and failure
  messages); and unauthenticated internet users if the instance is publicly reachable.

### 10.2 Controls

| Area | Control |
|---|---|
| Authentication | GitHub OAuth with `state`, plus PKCE where GitHub supports it. No OAuth scopes are requested. Sign-in is closed by default (FR-2). Session cookies are `Secure`, `HttpOnly` and `SameSite=Lax`. Sessions are stored server-side, revocable, and renewed at sign-in. |
| Authorization | All data access is scoped by project membership and enforced in one service layer. Automated tests check every endpoint for cross-project access (IDOR). |
| API tokens | At least 256 bits from a cryptographically secure random generator. Stored only as a SHA-256 hash, prefixed (FR-14), scoped, revocable, and tracked for last use. |
| Untrusted reports | The XML parser has DTDs, external entities and entity expansion disabled (preventing XXE and "billion laughs" attacks), plus depth and size limits and streaming parsing. Decompression is capped by an absolute size, enforced while streaming (zip bombs). Processing has timeouts. |
| Untrusted display data | Test names, messages and branch names are always rendered as text, never as HTML. ANSI escape sequences are stripped or safely converted. CI URLs from run metadata are shown as links only when they use `http`/`https`, which prevents `javascript:` links. |
| Sensitive failure output | Best-effort redaction (FR-29), truncation (FR-28), no storage of stdout/stderr. The documentation warns that redaction is best-effort, not a guarantee. |
| CSRF | `SameSite` cookies plus Origin checks or CSRF tokens on every state-changing request. |
| HTTP headers | Content Security Policy with no inline scripts, HSTS when served over TLS, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, a strict `Referrer-Policy`. |
| Abuse | Rate limits on sign-in and ingestion endpoints, per token and per IP. |
| Fork pull requests | GitHub does not give workflows triggered by forked pull requests access to secrets, and tokens must never be exposed to untrusted code. The MVP documents skipping uploads for forks and warns against running untrusted code with secrets via `pull_request_target`. Safe patterns for forks are on the roadmap. |
| Supply chain | Lockfile committed. Third-party GitHub Actions pinned to commit SHAs. Automated dependency updates and static analysis (CodeQL) in CI. Package provenance when publishing. |
| Secrets | No secrets in the repository; `.env.example` contains placeholders only. In production mode, the application refuses to start with a missing or weak session secret. |
| Privacy | Personal data is limited to GitHub login, display name and avatar URL. Email addresses are not stored. Commit authors are not collected in the MVP. There is no telemetry. |
| Audit | Quarantine history is required (FR-62). An audit log of token, membership and user changes *(S)*. |
| Vulnerability reporting | `SECURITY.md` describes private reporting through GitHub Security Advisories. |

---

## 11. MVP success criteria

1. Flakewatch's own CI uploads its test results to a running Flakewatch instance on every
   push.
2. A new user can go from a fresh clone to their first uploaded run in under 15 minutes
   using the README.
3. Every **M** requirement is implemented and covered by automated tests, and CI passes.
4. Every flaky label links to evidence that a user can verify.
5. The reference-workload benchmark meets the targets in §9, or the deviations are
   documented.

---

## 12. Decisions on former open questions

Accepted by the project owner on 2026-10-19.

| # | Question | Decision |
|---|---|---|
| Q1 | Sign-in method for the MVP? | GitHub OAuth only. Every deployed instance needs a GitHub OAuth app, which takes about two minutes to register. Local development uses a mock GitHub, so contributors need no OAuth app. Email/password is post-MVP. |
| Q2 | Default analysis window and retention? | 14 days of analysis, 30 days of raw results. |
| Q3 | Should `check` be able to excuse failures of tests that are known flaky but not quarantined? | No. Quarantine is the team's explicit decision. Silently excusing every flaky test could hide a real regression in that test. |
| Q4 | Should run metadata include commit author and message? | Not in the MVP. It adds personal data and isn't needed for detection. |

---

## Revision history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-19 | Initial draft. |
| 0.2 | 2026-10-19 | Aligned with the architecture (see architecture §23). Changed UC-4, FR-6, FR-10, FR-28, FR-40, FR-42, FR-45, FR-61, FR-65, FR-72, FR-90 and §10.2. Open questions recorded as decisions. |
