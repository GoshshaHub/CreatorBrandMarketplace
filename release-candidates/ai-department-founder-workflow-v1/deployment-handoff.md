# AI Department Founder Workflow v1 deployment handoff

## Release and target

- Baseline: `d17734ee80e4069a32ccf255208e69c0a7644a5a`
- Branch: `release/ai-department-founder-workflow-v1`
- Deployment target: the existing Vercel production application connected to
  `GoshshaHub/CreatorBrandMarketplace`
- Firebase deployment: none; rules, indexes, Functions, Storage configuration,
  and Firebase Hosting are outside this release

The local release commit SHA is recorded in the final freeze report after the
commit is created.

## Disabled-gate deployment

All new gates remain false for the initial deployment:

1. `CRM_AUTHENTIC_OBSERVATION_RECORDING_ENABLED=false`
2. `CRM_OBJECTION_PATTERN_READ_ENABLED=false`
3. `CRM_OBJECTION_PATTERN_RECORDING_ENABLED=false`
4. `CRM_COMMERCIAL_FEEDBACK_READ_ENABLED=false`
5. `CRM_COMMERCIAL_FEEDBACK_RECORDING_ENABLED=false`
6. `CRM_COMMERCIAL_FEEDBACK_SPECIALIST_ENABLED=false`
7. `CRM_COMMERCIAL_FEEDBACK_CHANGE_ENABLED=false`
8. `CLOSER_PRODUCTION_PREPARATION_ENABLED=false`

The specialist gate must be enabled before a Founder-requested SALES specialist
operation. The supported-change gate must be enabled before exact Playbook
preview/application. Neither recording nor read access implies either authority.

Production must not define any local-demo variable listed in `README.md`.

## Authenticated read-only smoke check

1. Confirm unauthenticated Admin routes still require authentication.
2. With an existing legitimate Admin session, load the GROWTH, SALES, CRM,
   REVENUE, and CLOSER/Founder surfaces without submitting a form.
3. Confirm existing CRM lists/detail views remain readable and `Cache-Control`
   remains `no-store` on CRM APIs.
4. Confirm each newly gated capability reports disabled or refuses its write or
   provider operation.
5. Confirm no CRM record, consumption receipt, provider request, message,
   schedule, payment, or external action was created by the smoke check.

## Rollback

1. Keep all eight gates false.
2. Roll Vercel back to the immediately preceding known-good deployment (the
   deployment built from baseline/current production predecessor).
3. Do not delete canonical CRM history or immutable Playbook artifacts. Disabling
   gates stops new operations and intentionally preserves existing audit records.
4. Re-run unauthenticated protection and authenticated read-only smoke checks.
5. Do not roll back Firebase resources because this release deploys none.

## Proposed controlled live validation (not authorized)

One-use authority consumption prevents replay of one exact CLOSER authority. It
is not an overall request counter, monthly spending control, or department-wide
budget: a new exact approval could otherwise create a new authority.

The proposed validation is therefore separately bounded as follows:

- Provider-request allowance: at most two provider entries total—one SALES
  objection specialist request and one CLOSER draft-preparation request.
- Automatic retries: zero at both application operations.
- Proposed incremental spending ceiling: USD 2.00 total, subject to a separate
  explicit Founder spending approval. Until that approval exists, the operative
  ceiling is USD 0 and no live request may start.
- Preconditions: an authentic canonical Interaction, exact assessment/pattern
  approval, current session-only REVENUE Approved Action Package, safe DNC state,
  intact contracts/hashes, current immutable Playbook, and explicit Founder
  approval at every preview boundary.
- Gate sequence: enable read/record gates only for the reviewed workflow; enable
  `CRM_COMMERCIAL_FEEDBACK_SPECIALIST_ENABLED` immediately before the single
  SALES request and disable it immediately after its response or failure; enable
  `CRM_COMMERCIAL_FEEDBACK_CHANGE_ENABLED` only for the separately approved
  supported Playbook change and disable it immediately after application or
  failure; enable `CLOSER_PRODUCTION_PREPARATION_ENABLED` immediately before the
  single preparation request and disable it immediately after response or
  failure. Disable all remaining temporary gates when the validation ends.
- Stop immediately on: any stale/mismatched identity, DNC or rights ambiguity,
  missing evidence, integrity/authentication failure, provider error or timeout,
  invalid structured output, prohibited/unsupported claim, unknown usage when a
  dollar ceiling cannot be safely enforced, first unexpected mutation or effect,
  either provider entry completing/failing, two total provider entries, or the
  separately approved dollar ceiling being reached.
- No retry after a provider entry. A consumed CLOSER authority remains consumed
  after timeout, provider failure, or invalid output.
- Outputs remain Founder-review-only and unsent. No draft approval is inherited
  from authority approval.

This plan proposes bounds; it does not grant spending authority or authorize a
live provider request.

## Residual dependency risk

The clean release currently reports 15 production dependency advisories: four
high and eleven moderate. The high chain is Firebase browser Firestore to
`@grpc/grpc-js@1.9.16`; the advisories concern gRPC server certificate-auth
context and server-handler error disclosure. The application broadly uses the
Firebase browser SDK, but repository inspection found no application-created
gRPC server and no direct `@grpc/grpc-js` API use, so the vulnerable server-only
behaviors are not concretely reachable in the deployed application.

Firebase Admin is widely reachable in existing server routes, including
Firestore and Storage. Its moderate advisory chains include Google client retry/
auth packages and `uuid@9.0.1`; repository code does not directly invoke UUID
v3/v5/v6 with a caller-supplied output buffer, the condition in that advisory.
These findings are whole-application maintenance risks, not mitigated merely by
the new gates. The audit offers only incompatible top-level changes/downgrades,
so a Firebase compatibility upgrade and full existing-route regression should be
a separately reviewed remediation. No concretely reachable exploit condition was
identified that blocks this disabled-gate release.
