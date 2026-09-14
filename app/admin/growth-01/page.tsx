"use client";

import { useState } from "react";

import ProtectedRoute from "../../../components/ProtectedRoute";
import { auth } from "../../../lib/firebase";

type PreviewResult = {
  run?: { status: string; candidateCount: number; qualifiedCount: number };
  contract?: { sha256: string; path: string; repositoryCommit: string | null };
  findings?: Array<{ severity: string; candidateId?: string; message: string }>;
  dailyBriefMarkdown?: string;
  error?: string;
};

const starterInput = JSON.stringify(
  {
    asOfDate: new Date().toISOString().slice(0, 10),
    marketFocus: ["beauty"],
    maximumQualified: 5,
    marketPattern: "Founder-supplied evidence only; no live research provider is connected.",
    candidates: [],
  },
  null,
  2
);

export default function GrowthFounderPreviewPage() {
  const [input, setInput] = useState(starterInput);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [running, setRunning] = useState(false);

  async function runPreview() {
    setRunning(true);
    setResult(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Your Admin session is not available.");
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/agents/growth-01/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: input,
      });
      const payload = (await response.json()) as PreviewResult;
      setResult(payload);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Preview failed." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <ProtectedRoute allowedRole="admin">
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Founder-supervised preview</p>
            <h1 className="text-3xl font-bold">GROWTH-01 Phase 1A</h1>
            <p className="max-w-3xl text-slate-300">
              Paste a Founder-supplied evidence packet to validate scoring and preview a Daily Brief. Nothing is researched,
              saved, sent, scheduled, or handed to another agent.
            </p>
          </header>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <label className="mb-3 block font-semibold" htmlFor="growth-input">Evidence packet (JSON)</label>
              <textarea
                id="growth-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="min-h-[36rem] w-full rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-xs text-slate-100 outline-none focus:border-emerald-400"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={runPreview}
                disabled={running}
                className="mt-4 rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? "Validating…" : "Run supervised preview"}
              </button>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-xl font-bold">Preview result</h2>
              {!result && <p className="text-slate-400">No preview has run in this browser session.</p>}
              {result?.error && <p className="rounded-xl bg-red-950 p-4 text-red-200">{result.error}</p>}
              {result?.run && (
                <div className="rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
                  <p>Status: <strong className="text-white">{result.run.status}</strong></p>
                  <p>Candidates: {result.run.candidateCount}; qualified: {result.run.qualifiedCount}</p>
                  <p className="break-all">Contract: {result.contract?.path} · {result.contract?.sha256}</p>
                  <p>Repository commit: {result.contract?.repositoryCommit || "not supplied by environment"}</p>
                </div>
              )}
              {!!result?.findings?.length && (
                <ul className="space-y-2 text-sm">
                  {result.findings.map((finding, index) => (
                    <li key={`${finding.candidateId || "run"}-${index}`} className="rounded-lg border border-amber-700/50 bg-amber-950/40 p-3">
                      {finding.severity.toUpperCase()}: {finding.message}
                    </li>
                  ))}
                </ul>
              )}
              {result?.dailyBriefMarkdown && (
                <pre className="max-h-[44rem] overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-sm text-slate-900">
                  {result.dailyBriefMarkdown}
                </pre>
              )}
            </div>
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}
