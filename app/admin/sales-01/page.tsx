"use client";

import { useMemo, useState } from "react";

import ProtectedRoute from "../../../components/ProtectedRoute";
import { auth } from "../../../lib/firebase";
import type { SalesResearchResult } from "../../../lib/agents/sales-01/research-types";
import type { GrowthSalesExportV1, SalesIntakeResult } from "../../../lib/agents/sales-01/types";

export default function SalesIntakePage() {
  const [rawExport, setRawExport] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [approved, setApproved] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<(SalesIntakeResult & { error?: string; code?: string }) | null>(null);
  const [salesMonthSpend, setSalesMonthSpend] = useState("0");
  const [departmentMonthSpend, setDepartmentMonthSpend] = useState("0");
  const [researchAuthorized, setResearchAuthorized] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<(SalesResearchResult & { error?: string; code?: string; providerExecution?: unknown }) | null>(null);

  const parsed = useMemo(() => {
    if (!rawExport.trim()) return { value: null as GrowthSalesExportV1 | null, error: "" };
    try {
      return { value: JSON.parse(rawExport) as GrowthSalesExportV1, error: "" };
    } catch {
      return { value: null, error: "The export is not valid JSON." };
    }
  }, [rawExport]);
  const candidates = parsed.value?.validatedRun?.candidates || [];

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setRawExport(await file.text());
    setCandidateId("");
    setResult(null);
  }

  async function validateIntake() {
    if (!parsed.value || !candidateId || !approved) return;
    setRunning(true);
    setResult(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Your Admin session is unavailable.");
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/agents/sales-01/intake", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          export: parsed.value,
          candidateId,
          founderApproval: { approved: true, scope: "sales_preparation_only" },
        }),
      });
      setResult(await response.json());
    } catch (error) {
      setResult({ status: "validation_failed", findings: [], envelope: null, summaryMarkdown: "", error: error instanceof Error ? error.message : "SALES intake failed." });
    } finally {
      setRunning(false);
    }
  }

  async function runSalesResearch() {
    if (!result?.envelope || !researchAuthorized) return;
    setResearching(true); setResearchResult(null);
    try {
      const user = auth.currentUser; if (!user) throw new Error("Your Admin session is unavailable.");
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/agents/sales-01/research", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ envelope: result.envelope, founderAuthorization: { authorized: true, scope: "one_sales_research_run" }, budgetAuthority: { confirmedByFounder: true, salesMonthSpendUsd: Number(salesMonthSpend), commercialDepartmentMonthSpendUsd: Number(departmentMonthSpend) } }) });
      setResearchResult(await response.json());
    } catch (error) {
      setResearchResult({ error: error instanceof Error ? error.message : "SALES research failed." } as SalesResearchResult & { error: string });
    } finally { setResearching(false); }
  }

  return (
    <ProtectedRoute allowedRole="admin">
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Founder-triggered · Admin-only · Session-only · No AI</p>
            <h1 className="text-3xl font-bold">SALES-01 Phase 1A Intake</h1>
            <p className="max-w-4xl text-slate-300">Validate one complete GROWTH export without changing its score, evidence, claims, rights uncertainty, or known unknowns. This workspace performs no contact research, messaging, persistence, or downstream invocation.</p>
          </header>

          <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <label className="block font-semibold">Complete GROWTH → SALES export
              <input type="file" accept="application/json,.json" onChange={(event) => void loadFile(event.target.files?.[0])} className="mt-2 block w-full text-sm" />
              <textarea value={rawExport} onChange={(event) => { setRawExport(event.target.value); setResult(null); }} className="mt-3 min-h-64 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs" placeholder="Paste the complete growth-sales-export-v1 JSON here." />
            </label>
            {parsed.error && <p className="text-red-300">{parsed.error}</p>}
            {parsed.value && (
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm">
                <p>Export: {parsed.value.exportVersion}</p>
                <p>Growth run: {parsed.value.validatedRun?.run?.id || "missing"} · {parsed.value.validatedRun?.run?.status || "missing"}</p>
                <p>Contract: {parsed.value.validatedRun?.contract?.sha256 || "missing"}</p>
                <p>Projection: {parsed.value.providerProjection?.version || "not supplied"}</p>
              </div>
            )}
            <label className="block">Qualified opportunity
              <select value={candidateId} onChange={(event) => { setCandidateId(event.target.value); setResult(null); }} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3">
                <option value="">Select one candidate</option>
                {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.brand} — {candidate.productOrEvent} — {candidate.computed?.finalScore}/100</option>)}
              </select>
            </label>
            {candidateId && (() => {
              const candidate = candidates.find((item) => item.id === candidateId);
              if (!candidate) return null;
              return <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm sm:grid-cols-2">
                <p>Score/Band: {candidate.computed.finalScore}/100 · {candidate.computed.band}</p>
                <p>Confidence/Feasibility: {candidate.confidence} · {candidate.founderStagePursuitFeasibility}</p>
                <p className="sm:col-span-2">Wedge: {candidate.goshshaWedge}</p>
                <p>Retailer posture: {candidate.retailerAssessment.posture}</p>
                <p>Rights: preserved for deterministic review</p>
                <p>Free First: {candidate.freeFirst.recommendation} · $0 proof only</p>
                <p>Paid hypothesis: {candidate.fastestRevenuePath}</p>
                <p className="sm:col-span-2">Known unknowns: {candidate.knownUnknowns.join("; ") || "None supplied"}</p>
              </div>;
            })()}
            <label className="flex items-start gap-3 rounded-xl border border-amber-700 bg-amber-950/30 p-4">
              <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} className="mt-1" />
              <span>I approve this exact candidate for SALES preparation only.</span>
            </label>
            <button type="button" disabled={running || !parsed.value || !candidateId || !approved} onClick={validateIntake} className="w-full rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
              {running ? "Validating intake…" : "Run deterministic SALES intake"}
            </button>
          </section>

          {result && <section className={`space-y-3 rounded-2xl border p-5 ${result.status === "valid" ? "border-emerald-700 bg-emerald-950/20" : "border-red-800 bg-red-950/40"}`}>
            <h2 className="text-xl font-bold">{result.status === "valid" ? "SALES intake valid" : "SALES intake rejected"}</h2>
            {result.error && <p>{result.error}{result.code ? ` (${result.code})` : ""}</p>}
            {!!result.findings?.length && <ul className="list-disc space-y-1 pl-6 text-sm">{result.findings.map((item, index) => <li key={`${item.code}-${index}`}>{item.code}: {item.message}</li>)}</ul>}
            {result.summaryMarkdown && <pre className="max-h-[40rem] overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-sm text-slate-900">{result.summaryMarkdown}</pre>}
            {result.envelope && <details><summary className="cursor-pointer font-semibold">Validated immutable envelope</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs">{JSON.stringify(result.envelope, null, 2)}</pre></details>}
          </section>}

          {result?.status === "valid" && result.envelope && <section className="space-y-4 rounded-2xl border border-violet-700 bg-violet-950/20 p-5">
            <h2 className="text-xl font-bold">Phase 1B public-web Sales intelligence</h2>
            <p className="text-sm text-slate-300">One synchronous provider request for this exact validated envelope. Results are session-only, untrusted until deterministic validation completes, non-sending, and not written to CRM.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>Current SALES spend this calendar month ($)<input type="number" min="0" step="0.01" value={salesMonthSpend} onChange={(event) => setSalesMonthSpend(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
              <label>Current Commercial AI department spend this calendar month ($)<input type="number" min="0" step="0.01" value={departmentMonthSpend} onChange={(event) => setDepartmentMonthSpend(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
            </div>
            <p className="text-xs text-amber-200">Founder-supplied, nonpersistent accounting. Full profile requires $1 remaining under both the $20 SALES and $50 department monthly ceilings. This does not guarantee an exact provider-dollar cutoff.</p>
            <label className="flex items-start gap-3 rounded-xl border border-violet-700 bg-slate-950 p-4"><input type="checkbox" checked={researchAuthorized} onChange={(event) => setResearchAuthorized(event.target.checked)} className="mt-1" /><span>I separately authorize one SALES-01 provider research run for this exact Phase 1A envelope. This does not authorize sending or CRM writes.</span></label>
            <button type="button" onClick={runSalesResearch} disabled={!researchAuthorized || researching} className="w-full rounded-xl bg-violet-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">{researching ? "Researching public Sales intelligence…" : "Run one SALES-01 research request"}</button>
          </section>}

          {researchResult && <section className={`space-y-3 rounded-2xl border p-5 ${researchResult.outcome === "accepted" ? "border-emerald-700 bg-emerald-950/20" : "border-red-800 bg-red-950/40"}`}>
            <h2 className="text-xl font-bold">{researchResult.outcome === "accepted" ? "Sales Playbook ready for Founder review" : "SALES research did not complete"}</h2>
            {researchResult.error && <p>{researchResult.error}{researchResult.code ? ` (${researchResult.code})` : ""}</p>}
            {researchResult.proposal && <>
              <div className="grid gap-2 text-sm sm:grid-cols-2"><p>Decision: {researchResult.proposal.playbook.salesPursuitDecision}</p><p>Contacts: {researchResult.proposal.playbook.contacts.length}</p><p>Sources: {researchResult.proposal.normalizedSourceCount}</p><p>Web searches: {researchResult.proposal.execution.usage.webSearchCalls}</p><p>Total tokens: {researchResult.proposal.execution.usage.totalTokens ?? "Unavailable"}</p><p>Sending/CRM: Not authorized</p></div>
              <details open><summary className="cursor-pointer font-semibold">Session-only Sales Playbook and CRM-ready preview</summary><pre className="mt-3 max-h-[50rem] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs">{JSON.stringify(researchResult.proposal.playbook, null, 2)}</pre></details>
            </>}
            {researchResult.providerExecution && <details><summary className="cursor-pointer font-semibold">Safe provider execution metadata</summary><pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs">{JSON.stringify(researchResult.providerExecution, null, 2)}</pre></details>}
          </section>}
        </div>
      </main>
    </ProtectedRoute>
  );
}
