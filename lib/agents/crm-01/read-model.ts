import type { CrmStoredRecord } from "./types";
import type { CrmAccountListItem, CrmAttentionListItem, CrmCommercialReadModel, CrmContactReadModel, CrmDncReadModel, CrmGrowthOpportunityReadModel, CrmPursuitListItem, CrmReadWarning, CrmTimelineItem } from "./read-types";

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const boolean = (value: unknown): boolean => value === true;
const provenance = (record: CrmStoredRecord): string[] => Array.isArray(record.provenance) ? strings(record.provenance) : [];
const revision = (record: CrmStoredRecord): number | null => Number.isInteger(record.revision) && record.revision > 0 ? record.revision : null;
const timestamp = (value: unknown): string | null => { const text = string(value); return text && !Number.isNaN(Date.parse(text)) ? text : null; };
function warning(field: string, message: string, code: CrmReadWarning["code"] = "missing_field"): CrmReadWarning { return { code, field, message }; }

export function toDncReadModel(data: Record<string, unknown>, scope: CrmDncReadModel["scope"]): CrmDncReadModel {
  const structured = object(data.dnc);
  const rawState = string(structured.status) ?? string(data.dnc);
  const state: CrmDncReadModel["state"] = rawState === "active" || rawState === "inactive" || rawState === "conflicting" ? rawState : "unknown";
  const rawEvaluation = string(data.dncEvaluation);
  const evaluation: CrmDncReadModel["evaluation"] = rawEvaluation === "allowed" || rawEvaluation === "blocked" ? rawEvaluation : "review_required";
  return { state, evaluation, scope, reason: string(structured.reason), evidenceRefs: strings(structured.evidenceRefs), effectiveAt: timestamp(structured.effectiveAt), expiresAt: timestamp(structured.expiresAt) };
}

export function toAccountListItem(record: CrmStoredRecord): CrmAccountListItem {
  const data = object(record.data); const displayName = string(data.displayName); const warnings: CrmReadWarning[] = [];
  if (!displayName) warnings.push(warning("displayName", "Account name is unavailable."));
  const dnc = toDncReadModel(data, "account"); if (dnc.state === "unknown") warnings.push(warning("dnc", "Account DNC state is unknown.", "unknown_state"));
  return { id: record.id, revision: revision(record), displayName, relationshipStatus: string(data.relationshipStatus), dnc, updatedAt: timestamp(record.updatedAt), provenance: provenance(record), warnings };
}

export function toContactReadModel(record: CrmStoredRecord): CrmContactReadModel {
  const data = object(record.data); const roles = strings(data.strategicRoles); const rationale = string(data.strategicRoleRationale); const route = object(data.contactRoute); const warnings: CrmReadWarning[] = [];
  if (!string(data.name)) warnings.push(warning("name", "Contact name is unavailable."));
  const explicitSalesRecommendation = roles.includes("Best First Contact") && Boolean(rationale) && provenance(record).includes("sales_strategic_inference");
  if (!explicitSalesRecommendation) warnings.push(warning("bestFirstContact", "Best First Contact is unavailable; CRM did not manufacture a recommendation.", "unknown_state"));
  const buyingAuthority = data.buyingAuthority === "supported" ? "supported" : "unknown";
  return { id: record.id, revision: revision(record), accountId: string(data.accountId), name: string(data.name), currentTitle: string(data.currentTitle), strategicRoles: roles, strategicRoleRationale: rationale, recommendedAsBestFirstContact: explicitSalesRecommendation, recommendationClassification: explicitSalesRecommendation ? "sales_inference" : "unavailable", buyingAuthority, contactRoute: { type: string(route.type) ?? "unknown", value: string(route.value) }, dnc: toDncReadModel(data, "contact"), updatedAt: timestamp(record.updatedAt), provenance: provenance(record), warnings };
}

export function toPursuitListItem(record: CrmStoredRecord): CrmPursuitListItem {
  const data = object(record.data); const next = object(data.nextAction); const rights = object(data.rights); const retailer = object(data.retailerIndependence); const warnings: CrmReadWarning[] = [];
  const nextDescription = string(next.description) ?? string(data.nextAction); if (!nextDescription) warnings.push(warning("nextAction", "No current Next Action is recorded.", "unknown_state"));
  const evaluation = data.dncEvaluation === "allowed" || data.dncEvaluation === "blocked" ? data.dncEvaluation : "review_required";
  const unknowns = Array.isArray(data.unknowns) ? data.unknowns.map((item) => typeof item === "string" ? { text: item, status: null } : { text: string(object(item).originalText) ?? "Unknown item", status: string(object(item).status) }) : [];
  return { id: record.id, revision: revision(record), accountId: string(data.accountId), opportunityId: string(data.opportunityId), stage: string(data.stage), disposition: string(data.disposition), salesPursuitDecision: string(data.salesPursuitDecision), rationale: string(data.rationale), nextAction: { description: nextDescription, owner: string(next.owner), status: string(next.status), dueAt: timestamp(next.dueAt), executionAuthorized: false }, dncEvaluation: evaluation, unknowns, rights: { status: string(rights.status), conditionalRequirement: string(rights.conditionalRequirement) }, retailerIndependence: { posture: string(retailer.posture), description: string(retailer.description) }, updatedAt: timestamp(record.updatedAt), provenance: provenance(record), warnings };
}

export function toAttentionListItem(record: CrmStoredRecord): CrmAttentionListItem {
  const data = object(record.data); const rawType = string(data.type); const rawPriority = string(data.priority); const rawStatus = string(data.status); const warnings: CrmReadWarning[] = [];
  const type = rawType === "reminder" || rawType === "condition_alert" ? rawType : "unknown";
  const priority = ["low", "normal", "medium", "high", "critical"].includes(rawPriority ?? "") ? rawPriority as CrmAttentionListItem["priority"] : "unknown";
  const status = ["open", "snoozed", "resolved", "dismissed"].includes(rawStatus ?? "") ? rawStatus as CrmAttentionListItem["status"] : "unknown";
  if (type === "unknown") warnings.push(warning("type", "Attention type is unknown.", "unknown_state"));
  return { id: record.id, revision: revision(record), accountId: string(data.accountId), pursuitId: string(data.pursuitId), contactId: string(data.contactId), type, reason: string(data.reason), priority, status, dueAt: timestamp(data.dueAt), owner: string(data.owner), source: string(data.source), triggeringCondition: string(data.triggeringCondition), updatedAt: timestamp(record.updatedAt), provenance: provenance(record), warnings };
}

export function toGrowthOpportunityReadModel(record: CrmStoredRecord): CrmGrowthOpportunityReadModel {
  const data = object(record.data); const candidate = object(data.candidateSnapshot); const complete = object(candidate.completeCandidate); const qualification = object(data.qualificationSnapshot); const opportunity = object(complete); const warnings: CrmReadWarning[] = [];
  const candidateId = string(candidate.candidateId) ?? string(opportunity.id); if (!candidateId) warnings.push(warning("candidateId", "Growth candidate identity is unavailable."));
  return { id: record.id, revision: revision(record), candidateId, brand: string(opportunity.brand), productOrEvent: string(opportunity.productOrEvent), score: number(qualification.score) ?? number(object(opportunity.computed).finalScore), band: string(qualification.band) ?? string(object(opportunity.computed).band), confidence: string(qualification.confidence) ?? string(opportunity.confidence), feasibility: string(qualification.founderStagePursuitFeasibility) ?? string(opportunity.founderStagePursuitFeasibility), wedge: string(opportunity.goshshaWedge), retailerAssessment: opportunity.retailerAssessment ?? null, freeFirst: opportunity.freeFirst ?? null, fastestRevenuePath: string(opportunity.fastestRevenuePath), immutable: boolean(data.immutable), provenance: provenance(record), warnings };
}

export function toTimelineItem(record: CrmStoredRecord): CrmTimelineItem {
  const data = object(record.data); const type = record.entityType === "attentionItem" ? "attentionItem" : record.entityType === "interaction" || record.entityType === "decision" || record.entityType === "milestone" ? record.entityType : "revision";
  return { id: record.id, entityType: type, revision: revision(record), effectiveAt: timestamp(data.effectiveAt) ?? timestamp(data.occurredAt) ?? timestamp(record.updatedAt), recordedAt: timestamp(data.recordedAt) ?? timestamp(record.createdAt), title: string(data.type) ?? string(data.event) ?? type, summary: string(data.summary) ?? string(data.reason) ?? string(data.status), classification: string(data.classification), provenance: provenance(record), correctionOf: string(data.correctionOf), supersededBy: string(data.supersededBy), warnings: [] };
}

export function toRevisionTimelineItems(record: CrmStoredRecord): CrmTimelineItem[] {
  return Array.isArray(record.history) ? record.history.map((entry) => ({
    id: `${record.id}:revision:${entry.revision}`,
    entityType: "revision",
    revision: Number.isInteger(entry.revision) ? entry.revision : null,
    effectiveAt: timestamp(entry.at),
    recordedAt: timestamp(entry.at),
    title: string(entry.event) ?? "CRM revision",
    summary: `Revision event for ${record.entityType}.`,
    classification: "system_generated_state",
    provenance: [...provenance(record), `artifact:${entry.artifactSha256}`],
    correctionOf: null,
    supersededBy: null,
    warnings: [],
  })) : [];
}

export function toCommercialReadModel(record: CrmStoredRecord): CrmCommercialReadModel {
  const data = object(record.data); const free = object(data.freeFirst); const p2 = object(data.product2); const network = object(data.creatorNetwork); const truth = object(data.commercialTruth);
  const revenue = number(free.revenueUsd); const warnings: CrmReadWarning[] = [];
  if (revenue !== null && revenue !== 0) warnings.push(warning("freeFirst.revenueUsd", "Free First must remain $0; stored value is conflicting.", "conflicting_state"));
  return { freeFirst: { state: string(free.state), revenueUsd: 0, live: boolean(free.live), scanVerified: boolean(free.scanVerified) }, product2: { state: string(p2.state), amountUsd: number(p2.amountUsd), paymentReference: string(p2.paymentReference) }, creatorNetwork: { state: string(network.state), amountUsd: number(network.amountUsd), paymentReference: string(network.paymentReference) }, revenueStates: { hypothesisOpportunity: string(truth.hypothesisOpportunity), proposed: string(truth.proposedRevenue), expected: string(truth.expectedRevenue), committed: string(truth.committedRevenue), collected: string(truth.collectedRevenue), refundedReversed: string(truth.refundedOrReversed) }, warnings };
}
