# Validation record

Validated in the source workspace before archive generation:

- GROWTH: 61/61 passed.
- SALES: 40/40 passed.
- CRM: 108/108 passed.
- REVENUE: 66/66 passed.
- CLOSER: 100/100 passed.
- TypeScript: passed (`npx tsc --noEmit`).
- Production build: passed; 73/73 pages generated, both before and after the isolated Next.js remediation.
- `git diff --check`: passed.

Clean reconstruction completed from baseline `d17734ee80e4069a32ccf255208e69c0a7644a5a`, the 106-file candidate archive, and the isolated dependency overlay. `npm ci` succeeded with the release-only lockfile; all five operative suites, TypeScript, and the 73-page optimized production build passed on Next.js 16.3.8.

Release preparation first reverified both published checksums and the exact
106-file reviewed manifest. The final clean build found two route-local constants
exported from Next route modules and a Postmark default import that compiles to an
undefined runtime export under the release dependency set. The route constants
were made module-private without changing gate behavior, and Postmark now uses
its supported named `ServerClient` export. The final archive therefore contains
107 paths. Focused gate/provider tests and TypeScript passed after the correction;
the optimized 73-page webpack production build passed without the Postmark import
warning. Turbopack could not be used in this sandbox because its CSS worker was
denied local-port binding; this is an environment restriction, not a source
failure.

Dependency triage at release preparation time: the source workspace remains untouched at its pre-existing lockfile state. The release-only overlay uses Next.js and `eslint-config-next` 16.3.8, Firebase 12.19.0, Firebase Admin 13.10.0, and modern TypeScript module resolution. The current clean `npm audit --omit=dev` result is 15 findings: 0 critical, 4 high, 11 moderate, 0 low. The high findings are the Firebase browser Firestore → `@grpc/grpc-js` advisory chain; the moderate findings are Firebase Admin Google Cloud storage/Firestore/auth/retry and `uuid` transitive chains. Whole-application reachability and mitigation are recorded in `deployment-handoff.md`; disabled new gates are not claimed as a general mitigation. npm offers only incompatible top-level remedies, so a separate Firebase compatibility upgrade remains required maintenance. No Postmark/Resend finding remains in the release audit.

On this host, npm 11.6.2 twice terminated `npm ci` with its internal `Exit handler never called` error. The identical committed release lockfile installed successfully with npm 10.9.4 through Corepack. This is recorded as a toolchain compatibility observation rather than a dependency or source mismatch.

Build validation used only inert required values: a test-format Stripe key and syntactically valid, nonproduction Firebase browser identifiers. No `.env.local` or real credentials were copied into the candidate.

## Rendered application evidence

The optimized application was run locally in production mode against Auth and Firestore emulators for `demo-launch-workflow`. A synthetic Admin authenticated through the Auth emulator and the rendered Founder simulation UI completed exact preview, explicit approval, and a separate one-use deterministic request. The covered audience objection produced one unsent next-action/message pair. Replay returned `authority_consumed`. The unsupported custom-implementation/guaranteed-ROI/discount objection returned `REVIEW_REQUIRED_NO_SIMULATION` with SALES, REVENUE, and Founder review all required and no fabricated message. The UI explicitly displayed: simulation output persisted `No`, durable consumption receipt `Yes`, CRM write-back `No`, and sent `No`.

The rendered Founder UI and production-capable handlers were then exercised against the same isolated emulators. The UI completed canonical pattern selection, explicit SALES/REVENUE review requests, separate Founder disposition, exact Playbook revision preview, and atomic application. Emulator inspection confirmed the original and revised immutable artifacts both remained stored, the current reference advanced to revision 2, and supersession history retained the prior artifact. The production-capable Revenue/Closer UI completed fresh recommendation, package creation, exact authority preview, and explicit authority approval.

The actual production-capable `/recommend`, `/approve`, `/simulation-authority`, and `/simulate` handlers then completed the separate one-use preparation request using the revised Playbook. The deterministic result was `SIMULATED_FOR_FOUNDER_REVIEW`; its message was the exact Founder-approved standard-scope response, its observation referenced `launch-interaction`, all effect flags were false, and replay returned `authority_consumed`. No local-demo handler was used for this final handler sequence.

Concrete integration defects corrected during this run: timestamp-bearing reconstruction no longer invalidates an otherwise current session package; exact authority preview/approval/preparation reuse the original server reconstruction timestamp; the authority request limit accommodates the bounded revised Playbook; stored finding telemetry is excluded from semantic integrity hashing; and duplicate Playbook application returns its existing receipt before current-reference reconstruction.
