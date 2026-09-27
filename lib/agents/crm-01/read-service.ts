import type { Firestore } from "firebase-admin/firestore";
import { readCrmAccountRecord, readCrmRecentRecords, readCrmRecordPage, readCrmRelatedRecords } from "./read-repository";
import { toAccountListItem, toAttentionListItem, toCommercialReadModel, toContactReadModel, toGrowthOpportunityReadModel, toPursuitListItem, toRevisionTimelineItems, toTimelineItem } from "./read-model";
import type { CrmAccountDetailReadModel, CrmAccountListItem, CrmAttentionListItem, CrmDashboardReadModel, CrmPage, CrmPursuitListItem } from "./read-types";

export class CrmReadNotFoundError extends Error { constructor(message: string) { super(message); this.name = "CrmReadNotFoundError"; } }
const byDateDesc = <T extends { updatedAt?: string | null; recordedAt?: string | null; effectiveAt?: string | null }>(a: T, b: T) => String(b.updatedAt ?? b.effectiveAt ?? b.recordedAt ?? "").localeCompare(String(a.updatedAt ?? a.effectiveAt ?? a.recordedAt ?? ""));

export async function getAccountsPage(params: { db: Firestore; limit: number; filters: Record<string, string>; cursor: string | null; now: string }): Promise<CrmPage<CrmAccountListItem>> {
  const page = await readCrmRecordPage({ ...params, collection: "accounts", resource: "accounts", cursorValue: params.cursor });
  return { schemaVersion: "crm-read-page-v1", items: page.records.map(toAccountListItem), nextCursor: page.nextCursor, limit: params.limit, filters: params.filters, generatedAt: params.now, cache: "no-store" };
}

export async function getPursuitsPage(params: { db: Firestore; limit: number; filters: Record<string, string>; cursor: string | null; now: string }): Promise<CrmPage<CrmPursuitListItem>> {
  const page = await readCrmRecordPage({ ...params, collection: "salesPursuits", resource: "pursuits", cursorValue: params.cursor });
  return { schemaVersion: "crm-read-page-v1", items: page.records.map(toPursuitListItem), nextCursor: page.nextCursor, limit: params.limit, filters: params.filters, generatedAt: params.now, cache: "no-store" };
}

export async function getAttentionPage(params: { db: Firestore; limit: number; filters: Record<string, string>; cursor: string | null; now: string }): Promise<CrmPage<CrmAttentionListItem>> {
  const page = await readCrmRecordPage({ ...params, collection: "attentionItems", resource: "attention", cursorValue: params.cursor });
  return { schemaVersion: "crm-read-page-v1", items: page.records.map(toAttentionListItem), nextCursor: page.nextCursor, limit: params.limit, filters: params.filters, generatedAt: params.now, cache: "no-store" };
}

export async function getCrmDashboard(db: Firestore, now: string): Promise<CrmDashboardReadModel> {
  const [accounts, pursuits, attention] = await Promise.all([readCrmRecentRecords(db, "accounts"), readCrmRecentRecords(db, "salesPursuits"), readCrmRecentRecords(db, "attentionItems")]);
  const accountModels = accounts.map(toAccountListItem); const pursuitModels = pursuits.map(toPursuitListItem); const attentionModels = attention.map(toAttentionListItem);
  const warnings = [...accountModels, ...pursuitModels, ...attentionModels].flatMap((item) => item.warnings.map((warning) => `${item.id}: ${warning.message}`)).slice(0, 25);
  return { schemaVersion: "crm-dashboard-v1", generatedAt: now, boundedTo: 100, counts: { accounts: accountModels.length, activePursuits: pursuitModels.filter((item) => item.disposition === "Active").length, founderReview: pursuitModels.filter((item) => item.stage === "Founder Review").length, openAttention: attentionModels.filter((item) => item.status === "open").length, dncBlocked: accountModels.filter((item) => item.dnc.evaluation === "blocked").length, dncReviewRequired: accountModels.filter((item) => item.dnc.evaluation === "review_required").length }, needsFounderAttention: attentionModels.filter((item) => item.status === "open").sort(byDateDesc).slice(0, 25), priorityAccounts: accountModels.sort(byDateDesc).slice(0, 25), recentPursuits: pursuitModels.sort(byDateDesc).slice(0, 25), dataQualityWarnings: warnings, cache: "no-store" };
}

export async function getCrmAccountDetail(db: Firestore, accountId: string, now: string): Promise<CrmAccountDetailReadModel> {
  const accountRecord = await readCrmAccountRecord(db, accountId); if (!accountRecord) throw new CrmReadNotFoundError("CRM Account not found.");
  const [contacts, opportunities, pursuits, interactions, decisions, milestones, attention] = await Promise.all([
    readCrmRelatedRecords(db, "contacts", accountId), readCrmRelatedRecords(db, "growthOpportunities", accountId), readCrmRelatedRecords(db, "salesPursuits", accountId), readCrmRelatedRecords(db, "interactions", accountId), readCrmRelatedRecords(db, "decisions", accountId), readCrmRelatedRecords(db, "milestones", accountId), readCrmRelatedRecords(db, "attentionItems", accountId),
  ]);
  const allRecords = [accountRecord, ...contacts.records, ...opportunities.records, ...pursuits.records, ...interactions.records, ...decisions.records, ...milestones.records, ...attention.records];
  const timeline = [...interactions.records, ...decisions.records, ...milestones.records, ...attention.records].map(toTimelineItem).concat(allRecords.flatMap(toRevisionTimelineItems)).sort(byDateDesc);
  const relations = { Contacts: contacts, Opportunities: opportunities, Pursuits: pursuits, Interactions: interactions, Decisions: decisions, Milestones: milestones, Attention: attention };
  return { schemaVersion: "crm-account-detail-v1", generatedAt: now, account: toAccountListItem(accountRecord), contacts: contacts.records.map(toContactReadModel), growthOpportunities: opportunities.records.map(toGrowthOpportunityReadModel), pursuits: pursuits.records.map(toPursuitListItem), attentionItems: attention.records.map(toAttentionListItem), timeline, commercial: milestones.records.map(toCommercialReadModel), relationLimit: 100, truncationWarnings: Object.entries(relations).filter(([, value]) => value.truncated).map(([name]) => `${name} exceeded the bounded detail limit and was truncated.`), cache: "no-store" };
}
