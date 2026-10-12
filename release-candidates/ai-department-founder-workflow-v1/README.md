# AI Department Founder Workflow v1 release candidate

Baseline: `d17734ee80e4069a32ccf255208e69c0a7644a5a`

The reviewed archive initially verified as an exact 106-file application/test
delta. Clean Next.js 16 validation then exposed a pre-existing Postmark default-
import incompatibility in the existing campaign-approval route, so the final
dependency-complete manifest contains 107 application/test files: the original
106 plus the narrow `lib/postmark.ts` compatibility correction. It covers
canonical commercial positioning, SALES V1.3, canonical objection evidence and
feedback, immutable Playbook revision, session-only REVENUE approval binding,
and one-use non-sending CLOSER preparation.

Production recording, specialist execution, Playbook application, and CLOSER preparation gates remain disabled by default. Local-demo paths require a `demo-*` Firebase project, explicit loopback Auth and Firestore emulators, non-production runtime, an ephemeral signing secret, and an approved deterministic/mock generator.

## Reproduce

1. Create a clean checkout at the baseline revision.
2. Extract `candidate-files.tar.gz` at the checkout root.
3. Extract `dependency-overlay.tar.gz` at the checkout root. This explicitly supplies the release-only `package.json`, `package-lock.json`, and `tsconfig.json` without touching the unrelated working-tree lockfile.
4. Confirm the 107 application/test paths equal `manifest.txt` and verify both archive checksums.
5. Run `npm ci`.
6. Run the validation commands recorded in `validation.md` with inert required build configuration.

The pre-existing working-tree `package-lock.json` and `firestore-debug.log` are intentionally excluded. The separately validated release lockfile is carried only in `dependency-overlay.tar.gz`. Both archives contain complete file contents, not references to temporary files.

## Security posture

- No generated draft can be sent, scheduled, dispatched, persisted to CRM, or treated as approved.
- The session-only REVENUE Approved Action Package is supplied explicitly, its canonical identity is verified, and its objective remains eligible against freshly reconstructed server state before CLOSER authority or preparation.
- Applied Sales Playbooks are immutable artifacts; currentness changes atomically through the pursuit reference and preserves lineage.
- Durable CLOSER consumption receipts enforce one use; draft output remains nonpersistent.
- Prospect text remains untrusted evidence.

## Deployment boundary

The release target is the existing Vercel production application connected to
`GoshshaHub/CreatorBrandMarketplace`. This candidate does not change Firebase
Rules, indexes, Functions, Storage configuration, or Hosting and therefore does
not authorize a Firebase deployment.

Deploy with every new production gate disabled:

- `CRM_AUTHENTIC_OBSERVATION_RECORDING_ENABLED=false`
- `CRM_OBJECTION_PATTERN_READ_ENABLED=false`
- `CRM_OBJECTION_PATTERN_RECORDING_ENABLED=false`
- `CRM_COMMERCIAL_FEEDBACK_READ_ENABLED=false`
- `CRM_COMMERCIAL_FEEDBACK_RECORDING_ENABLED=false`
- `CRM_COMMERCIAL_FEEDBACK_SPECIALIST_ENABLED=false`
- `CRM_COMMERCIAL_FEEDBACK_CHANGE_ENABLED=false`
- `CLOSER_PRODUCTION_PREPARATION_ENABLED=false`

Local-demo variables must be absent in deployment: `CLOSER_LOCAL_DEMO_ENABLED`,
`NEXT_PUBLIC_CLOSER_LOCAL_DEMO_ENABLED`, `CLOSER_LOCAL_DEMO_LOCAL_BUILD`, and
`CLOSER_LOCAL_DEMO_GENERATOR`. The server rejects demo reconstruction on Vercel,
Cloud Run, and Lambda even if a demo flag is accidentally configured.

Required configuration names (never values) are the existing Firebase browser
and Admin credentials plus the new signing/provider names:
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`,
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
`FIREBASE_STORAGE_BUCKET`, `CRM_OBSERVATION_PREVIEW_SECRET`,
`CRM_OBJECTION_PATTERN_PREVIEW_SECRET`, `CRM_COMMERCIAL_FEEDBACK_SIGNING_SECRET`,
`CLOSER_SIMULATION_AUTHORITY_SIGNING_SECRET`, `OPENAI_API_KEY`,
`SALES_OBJECTION_REVIEW_MODEL`, and `CLOSER_OPENAI_MODEL`.

See `deployment-handoff.md` for the gate sequence, read-only smoke checks,
rollback, residual dependency assessment, and the separately approvable live
validation plan.
