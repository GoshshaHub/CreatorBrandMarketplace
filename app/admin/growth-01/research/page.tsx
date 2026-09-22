"use client";

import { useState } from "react";

import ProtectedRoute from "../../../../components/ProtectedRoute";
import { auth } from "../../../../lib/firebase";

type ResearchResponse = {
  error?: string;
  code?: string;
  outcome?: "provider_failed" | "provider_completed_local_rejection" | "accepted";
  findings?: string[];
  providerExecution?: ProviderExecutionMetadata | null;
  researchRun?: { requestedAt: string; providerTimeoutMs: number; maximumWebSearchCalls: number };
  contract?: { path: string; sha256: string };
  providerProjection?: { version: string; sha256: string; pairedFrozenContractVersion: string; pairedFrozenContractSha256: string };
  spendingAuthority?: { effectiveRunAuthorityUsd: number; cumulativeAccounting: string; providerDollarCutoffGuaranteed: false };
  proposal?: {
    provider: string;
    requestedModel: string;
    returnedModel: string;
    providerRequestId: string;
    completedAt: string;
    status: string;
    limitations: string[];
    usage: ProviderExecutionMetadata["usage"];
    execution: ProviderExecutionMetadata;
    normalizedSourceCount: number;
    sources: Array<{ id: string; rawUrl: string; canonicalUrl: string; title: string; publicationDate: string | null }>;
    proposedRun: unknown;
    authority: Record<string, unknown>;
  };
};

type ProviderExecutionMetadata = {
  provider: "openai";
  outcome: "provider_completed_local_rejection" | "accepted";
  requestedModel: string;
  returnedModel: string | null;
  providerResponseId: string | null;
  providerStatus: string | null;
  providerCreatedAt: string | null;
  providerCompletedAt: string | null;
  serverReceivedAt: string;
  usage: {
    inputTokens: number | null;
    cachedInputTokens: number | null;
    cacheWriteTokens: number | null;
    outputTokens: number | null;
    reasoningTokens: number | null;
    totalTokens: number | null;
    webSearchCalls: number;
  };
};

function UsageDetails({ execution }: { execution: ProviderExecutionMetadata }) {
  const usage = execution.usage;
  return (
    <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
      <p>Execution outcome: {execution.outcome}</p>
      <p>Provider/model: {execution.provider} · {execution.requestedModel} → {execution.returnedModel ?? "unavailable"}</p>
      <p>Provider status: {execution.providerStatus ?? "unavailable"}</p>
      <p>Response ID: {execution.providerResponseId ?? "unavailable"}</p>
      <p>Server received: {execution.serverReceivedAt}</p>
      <p>Input tokens: {usage.inputTokens ?? "unavailable"}</p>
      <p>Cached input tokens: {usage.cachedInputTokens ?? "unavailable"}</p>
      <p>Cache-write tokens: {usage.cacheWriteTokens ?? "unavailable"}</p>
      <p>Output tokens: {usage.outputTokens ?? "unavailable"}</p>
      <p>Reasoning tokens: {usage.reasoningTokens ?? "unavailable"}</p>
      <p>Total tokens: {usage.totalTokens ?? "unavailable"}</p>
      <p>Web searches: {usage.webSearchCalls}</p>
      <p>Provider created/completed: {execution.providerCreatedAt ?? "unavailable"} / {execution.providerCompletedAt ?? "unavailable"}</p>
    </div>
  );
}

type ValidationResponse = {
  error?: string;
  run?: { status: string; candidateCount: number; qualifiedCount: number };
  contract?: { path: string; sha256: string };
  findings?: Array<{ severity: string; message: string }>;
  dailyBriefMarkdown?: string;
};

export default function GrowthLiveResearchPage() {
  const [focus, setFocus] = useState("");
  const [growthSpend, setGrowthSpend] = useState("");
  const [departmentSpend, setDepartmentSpend] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [research, setResearch] = useState<ResearchResponse | null>(null);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);

  async function startResearch() {
    setRunning(true);
    setResearch(null);
    setValidation(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Your Admin session is unavailable.");
      const token = await user.getIdToken();
      const body = {
        asOfDate: new Date().toISOString().slice(0, 10),
        marketFocus: ["beauty", "skincare", "haircare"],
        founderResearchFocus: focus,
        maximumCandidates: 10,
        maximumQualified: 5,
        budgetAuthority: {
          confirmedByFounder: confirmed,
          growthMonthSpendUsd: Number(growthSpend),
          commercialDepartmentMonthSpendUsd: Number(departmentSpend),
        },
      };
      const researchResponse = await fetch("/api/admin/agents/growth-01/research", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const researchPayload = await researchResponse.json() as ResearchResponse;
      setResearch(researchPayload);
      if (!researchResponse.ok || !researchPayload.proposal) return;

      const validationResponse = await fetch("/api/admin/agents/growth-01/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(researchPayload.proposal.proposedRun),
      });
      setValidation(await validationResponse.json() as ValidationResponse);
    } catch (error) {
      setResearch({ error: error instanceof Error ? error.message : "Research failed." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <ProtectedRoute allowedRole="admin">
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Founder-triggered · Admin-only · Session-only</p>
            <h1 className="text-3xl font-bold">GROWTH-01 Live Public-Web Research</h1>
            <p className="max-w-4xl text-slate-300">The provider produces an untrusted proposal. Phase 1A separately calculates and validates the Daily Brief. Nothing is saved, scheduled, messaged, approved, or handed to SALES/CRM.</p>
          </header>

          <section className="rounded-2xl border border-amber-700/60 bg-amber-950/30 p-5 text-sm text-amber-100">
            <h2 className="font-bold">Founder spending authority</h2>
            <p className="mt-2">Maximum authorized per-run spending ceiling: $1, always subject to the lower remaining $20/month GROWTH-01 budget and $50/month commercial AI department budget. These limits are cumulative and hierarchical, not additive.</p>
            <p className="mt-2">Phase 1B does not persist or independently know cumulative monthly spend and cannot guarantee a precise provider-side dollar cutoff. Enter the current Founder-tracked totals before every run. If less than the full $1 ceiling remains under either monthly limit, this full-profile run will not start.</p>
          </section>

          <section className="grid gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:grid-cols-2">
            <label className="sm:col-span-2">Research focus (optional)
              <textarea value={focus} maxLength={1000} onChange={(event) => setFocus(event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Example: current beauty retail launches with product-specific creator activity" />
              <span className="mt-2 block text-sm text-slate-400">Public-web research instructions only. Do not enter private Founder, customer, Creator, CRM, payment, or relationship information.</span>
            </label>
            <label>GROWTH-01 AI spend this calendar month ($)
              <input type="number" min="0" step="0.01" value={growthSpend} onChange={(event) => setGrowthSpend(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" />
            </label>
            <label>Total commercial AI spend this calendar month ($)
              <input type="number" min="0" step="0.01" value={departmentSpend} onChange={(event) => setDepartmentSpend(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" />
            </label>
            <label className="flex items-start gap-3 sm:col-span-2">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
              <span>I confirm this Founder-triggered run is authorized within the $1 → $20 → $50 hierarchy. I understand the application does not persist cumulative accounting.</span>
            </label>
            <button type="button" onClick={startResearch} disabled={running || !confirmed || growthSpend === "" || departmentSpend === ""} className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">
              {running ? "Researching current public sources…" : "Start one live research run"}
            </button>
          </section>

          {research?.error && <section className="rounded-2xl border border-red-800 bg-red-950/50 p-5 text-red-100"><strong>{research.outcome === "provider_completed_local_rejection" ? "Provider completed, but GROWTH-01 deterministic validation rejected the proposal." : "Research did not complete."}</strong><p>{research.error}</p>{research.code && <p>Code: {research.code}</p>}{research.providerExecution && <UsageDetails execution={research.providerExecution} />}{research.findings?.map((item) => <p key={item}>{item}</p>)}</section>}

          {research?.proposal && (
            <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-xl font-bold">Untrusted provider proposal</h2>
              <p className="text-sm text-slate-300">Source presence establishes provenance, not truth. Founder review is still required.</p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p>Provider/model: {research.proposal.provider} · {research.proposal.requestedModel} → {research.proposal.returnedModel}</p>
                <p>Status: {research.proposal.status}</p>
                <p>Request ID: {research.proposal.providerRequestId}</p>
                <p>Completed: {research.proposal.completedAt}</p>
                <p>Normalized sources: {research.proposal.normalizedSourceCount}</p>
                <p className="break-all sm:col-span-2">Contract: {research.contract?.path} · {research.contract?.sha256}</p>
                <p className="break-all sm:col-span-2">Provider projection: {research.providerProjection?.version} · {research.providerProjection?.sha256}</p>
                <p className="break-all sm:col-span-2">Projection pairing: {research.providerProjection?.pairedFrozenContractVersion} · {research.providerProjection?.pairedFrozenContractSha256}</p>
              </div>
              <UsageDetails execution={research.proposal.execution} />
              {!!research.proposal.limitations.length && <ul className="list-disc pl-6 text-amber-200">{research.proposal.limitations.map((item) => <li key={item}>{item}</li>)}</ul>}
              <details><summary className="cursor-pointer font-semibold">Native source provenance</summary><ul className="mt-3 space-y-2 text-sm">{research.proposal.sources.map((source) => <li key={source.id}><a href={source.rawUrl} target="_blank" rel="noreferrer" className="text-emerald-300 underline">{source.title}</a> · {source.publicationDate || "publication date unknown"}<br /><span className="break-all text-slate-400">{source.canonicalUrl}</span></li>)}</ul></details>
              <details><summary className="cursor-pointer font-semibold">Raw untrusted proposal</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs">{JSON.stringify(research.proposal.proposedRun, null, 2)}</pre></details>
            </section>
          )}

          {validation && (
            <section className="space-y-4 rounded-2xl border border-emerald-700 bg-emerald-950/20 p-5">
              <h2 className="text-xl font-bold">Phase 1A deterministic validation</h2>
              {validation.error && <p className="text-red-200">{validation.error}</p>}
              {validation.run && <p>Status: <strong>{validation.run.status}</strong> · {validation.run.candidateCount} candidates · {validation.run.qualifiedCount} qualified</p>}
              {!!validation.findings?.length && <ul className="space-y-2 text-sm">{validation.findings.map((finding, index) => <li key={index}>{finding.severity.toUpperCase()}: {finding.message}</li>)}</ul>}
              {validation.dailyBriefMarkdown && <pre className="max-h-[48rem] overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-sm text-slate-900">{validation.dailyBriefMarkdown}</pre>}
              <p className="text-sm text-emerald-100">A validated brief is not Founder approval and does not authorize SALES, CRM, messaging, or any downstream action.</p>
            </section>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
