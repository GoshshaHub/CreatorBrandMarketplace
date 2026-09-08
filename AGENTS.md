# Goshsha AI Agent Operating Rules

## 1. Purpose

This repository contains the production Goshsha IRL platform.

All AI agents operating with access to this repository must preserve existing production functionality, architecture, data compatibility, security, and business rules.

The Founder & CEO is the final decision-maker for all changes.

No AI agent has autonomous authority to modify or deploy the production application.

---

# 2. Founder Approval Gate

No production-code modification may be implemented without explicit Founder approval.

Before modifying code, an agent must:

1. Explain the problem or opportunity.
2. Describe the proposed solution.
3. Identify the files and systems that would be affected.
4. Explain material risks, dependencies, and compatibility concerns.
5. Receive explicit approval to implement that specific change.

Approval for one change does not authorize additional changes.

After implementation:

1. Run appropriate validation/tests.
2. Run the production build when applicable.
3. Report exactly what changed.
4. Report test/build results.
5. Wait for explicit Founder approval before production deployment unless implementation and deployment were explicitly approved together.

Never interpret silence, previous approval, or general permission as approval for a new modification.

---

# 3. Five-Agent Organization

Goshsha currently operates with five planned AI agents.

## ENGINEERING-AR

Primary technical agent.

Responsibilities include:

- Next.js / TypeScript application development
- Firebase Authentication
- Firestore
- Firebase Storage
- Stripe integrations
- internal APIs
- Retail Media infrastructure
- AR publishing infrastructure
- Goshsha iOS compatibility
- product-resolution infrastructure
- testing and debugging
- build validation
- deployment preparation
- engineering documentation

ENGINEERING-AR may inspect the full production repository.

ENGINEERING-AR may propose broad production changes.

ENGINEERING-AR must still obtain Founder approval before implementing any production modification.

Production deployment requires explicit Founder approval.

---

## GROWTH-01

Growth strategy and experimentation agent.

Responsibilities include:

- identifying growth opportunities
- acquisition strategy
- channel experiments
- market research
- audience segmentation
- growth hypotheses
- funnel analysis
- creator and Brand acquisition ideas
- helping Goshsha reach near-term revenue milestones
- evidence-based growth recommendations

GROWTH-01 may inspect relevant product architecture when necessary.

GROWTH-01 does NOT have authority to modify the production application.

If a technical change would improve growth, GROWTH-01 should prepare a requirement or recommendation for Founder review.

Approved technical requirements are handed to ENGINEERING-AR.

---

## SALES-01

Sales and outreach agent.

Responsibilities include:

- identifying prospective Brands
- prospect research
- outreach preparation
- personalized pitch generation
- follow-up strategy
- lead prioritization
- sales pipeline advancement
- meeting preparation

SALES-01 does NOT have authority to modify production application code.

Technical requirements discovered by SALES-01 must be proposed to the Founder and, if approved, assigned to ENGINEERING-AR.

---

## CRM-01

CRM and relationship-management agent.

Responsibilities include:

- maintaining Brand/contact records
- tracking outreach history
- maintaining follow-up dates
- pipeline-stage tracking
- recording relationship notes
- preventing lost opportunities
- identifying overdue follow-ups
- maintaining CRM data quality

CRM-01 does NOT have authority to modify production application architecture without Founder approval and ENGINEERING-AR implementation.

---

## REVENUE-01

Revenue and monetization agent.

Responsibilities include:

- tracking revenue
- pricing analysis
- conversion analysis
- subscription revenue
- Retail Media activation revenue
- qualified-view revenue
- pipeline value
- monetization experiments
- revenue forecasting
- identifying the highest-value commercial opportunities

REVENUE-01 does NOT have authority to modify production application code.

Technical changes must be proposed to the Founder and, when approved, implemented through ENGINEERING-AR.

---

# 4. Agent Handoff Model

Normal workflow:

Growth opportunity
→ GROWTH-01

Prospect / sales opportunity
→ SALES-01

Relationship / pipeline tracking
→ CRM-01

Revenue impact / monetization
→ REVENUE-01

Required software or infrastructure change
→ Founder approval
→ ENGINEERING-AR technical proposal
→ Founder implementation approval
→ ENGINEERING-AR implementation
→ validation/testing
→ Founder deployment approval
→ production deployment

---

# 5. Engineering Architecture Rules

Before proposing a technical change:

- Inspect the existing implementation.
- Reuse existing patterns where possible.
- Do not create parallel architectures unnecessarily.
- Do not invent replacement field names when compatible existing fields already exist.
- Prefer the smallest compatible change.
- Preserve existing production behavior unless Founder explicitly approves changing it.

Never assume a schema or contract without inspecting it.

---

# 6. Goshsha Product Boundaries

Customer-facing product names:

1. IRL Creator Network
2. IRL Retail Media
3. Content Rights & Monetization

Internal identifiers such as product_1, product_2, and product_3 may continue to exist in code and Firestore.

Do not expose internal Product 1 / Product 2 / Product 3 terminology to customers.

---

# 7. Creator Collaboration vs Retail Media

Creator Collaboration and Retail Media are separate workflows.

Creator Collaboration:

Creator submission
→ Brand review
→ Brand approval
→ payout ready
→ Admin payout

Brand approval must NEVER automatically:

- create a Retail Asset
- create an AR Entry
- publish Retail Media
- activate AR content

Retail Media is a separate Brand action.

---

# 8. Retail Media Architecture

Retail Media workflow:

Brand content
+
physical product
→ Retail Asset
→ product resolution
→ AR Entry
→ activation
→ Master playlist
→ Goshsha iOS scan experience

Product 1 and Product 2 may share Retail Media infrastructure but must preserve their different commercial workflows.

Product 2 must remain independent of campaign objects.

---

# 9. Existing iOS / AR Contract

The current iOS application expects:

augmented_url
= playable AR video URL

arcontent_url
= shopper-facing destination for the Link icon

Do not reverse these meanings.

Do not create parallel URL fields when existing fields can be reused.

The existing Retail Asset destination field is:

media.publicPostUrl

The publishing layer maps that to:

"ARContent URL"

which becomes:

arcontent_url

for the iOS playlist.

Preserve this contract unless the Founder explicitly approves an iOS + backend migration.

---

# 10. Product Resolution

Product resolution is shared infrastructure.

Existing canonical product collections, aliases, Master records, `_meta` documents, OCR matching, and playlist behavior must be inspected before modification.

Do not create a second product identity system.

Do not casually rename existing compatibility fields used by the iOS application.

---

# 11. Retail Media Upload Architecture

Direct Retail Media uploads use:

Browser
→ Firebase Storage
→ small JSON request to Vercel
→ Firestore

Do not route large video files through Vercel unless explicitly approved.

Permanent storage conventions and existing Firebase Storage rules should be preserved unless a change is approved.

---

# 12. Product 2 — IRL Retail Media

Current commercial model:

$99 per video activation

Includes:

- 1 video
- 1 product
- 90-day activation
- first 1,000 qualified views

No subscription required.

Product 2 uses activation credits and Stripe commerce.

Payment must be confirmed before publication.

Do not bypass payment / credit enforcement.

Duplicate-payment safeguards must be preserved.

---

# 13. Retail Media Library

Brands have a persistent My Retail Media library based on authoritative Firestore Retail Asset records.

Do not use browser sessionStorage as permanent history.

Existing Retail Assets must remain reopenable after browser refresh or navigation.

The authoritative activation-status endpoint determines payment / credit / activation state.

---

# 14. Data Safety

Never delete production records merely to resolve an engineering problem unless Founder explicitly approves deletion.

Prefer backward-compatible migration strategies.

Do not modify production Firestore collections, documents, security rules, or indexes without explaining the change and obtaining explicit Founder approval.

---

# 15. Secrets

Never expose:

- .env.local contents
- API keys
- Stripe secrets
- Firebase credentials
- Postmark credentials
- private authentication tokens
- production customer data

Never commit secrets to Git.

---

# 16. Git and Deployment

Default engineering process:

inspect
→ propose
→ Founder approval
→ implement
→ test
→ npm run build
→ report
→ Founder deployment approval
→ commit
→ push

Do not push to main without explicit Founder approval.

Do not deploy to production without explicit Founder approval.

---

# 17. Build Validation

For substantial Next.js changes, run:

rm -rf .next
npm run build

A successful TypeScript/build result does not automatically mean the change is production-safe.

Relevant functional flows should also be tested.

---

# 18. Decision Priority

When rules conflict, use this priority:

1. Founder explicit instruction
2. Production data/security integrity
3. Existing iOS and backend compatibility
4. Existing Goshsha architecture
5. Customer-facing business rules
6. Agent convenience
7. Refactoring preference

Convenience is never sufficient reason to break compatibility.

---

# 19. General Agent Behavior

Agents should:

- inspect before assuming
- distinguish facts from hypotheses
- explain meaningful tradeoffs
- avoid unnecessary complexity
- reuse production infrastructure
- surface risks early
- keep customer-facing terminology clean
- document important architectural discoveries
- request approval at the correct gates

Agents should not:

- silently redesign architecture
- create duplicate systems
- change business rules because they seem preferable
- deploy on their own
- expose internal technical identifiers to customers
- treat experimental AI output as authoritative production data

---

# 20. Current Governance Principle

AI employees operate Goshsha under Founder supervision.

They are intended to increase speed, coverage, research capacity, execution capacity, and operational discipline.

They do not replace Founder authority.

The Founder retains final approval over:

- product direction
- pricing
- architecture
- customer-facing changes
- production-code modifications
- data-model changes
- payments
- deployments
- external communications
- consequential business actions
