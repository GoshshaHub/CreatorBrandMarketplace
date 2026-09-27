"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { auth } from "../../../lib/firebase";
import type { CrmDashboardReadModel } from "../../../lib/agents/crm-01/read-types";

async function loadDashboard(): Promise<CrmDashboardReadModel> {
  const user = auth.currentUser;
  if (!user) throw new Error("Admin session unavailable.");
  const response = await fetch("/api/admin/agents/crm-01/dashboard", { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || body.code || "CRM dashboard failed.");
  return body;
}

export default function CrmDashboardPage() {
  const [data, setData] = useState<CrmDashboardReadModel | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void loadDashboard().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "CRM dashboard failed.")); }, []);
  return <ProtectedRoute allowedRole="admin"><main className="min-h-screen bg-slate-950 px-4 py-10 text-white"><div className="mx-auto max-w-7xl space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">Admin-only · Read-only control room</p><h1 className="text-3xl font-bold">CRM-01 Founder Control Room</h1><p className="mt-2 max-w-3xl text-slate-300">Canonical commercial memory with provenance, uncertainty and execution boundaries intact. Viewing a next action does not authorize it.</p></div><nav className="flex gap-3"><Link href="/admin/crm-01/accounts" className="rounded-xl bg-cyan-300 px-4 py-2 font-bold text-slate-950">Accounts</Link><Link href="/admin/crm-01/import" className="rounded-xl border border-slate-600 px-4 py-2">Import workspace</Link></nav></header>
    {error && <p className="rounded-xl border border-red-700 bg-red-950 p-4 text-red-200">{error}</p>}
    {!data && !error && <p className="text-slate-300">Loading canonical CRM state…</p>}
    {data && <><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{Object.entries(data.counts).map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><p className="text-2xl font-bold">{value}</p><p className="text-xs uppercase tracking-wide text-slate-400">{label.replace(/([A-Z])/g, " $1")}</p></div>)}</section>
      <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-amber-700 bg-amber-950/20 p-5"><h2 className="text-xl font-bold">Needs Founder Attention</h2><div className="mt-4 space-y-3">{data.needsFounderAttention.length === 0 ? <p className="text-slate-400">No open Attention Items in the bounded view.</p> : data.needsFounderAttention.map((item) => <article key={item.id} className="rounded-xl bg-slate-950 p-4"><p className="font-semibold">{item.reason ?? "Reason unavailable"}</p><p className="text-sm text-slate-400">{item.type} · {item.priority} · {item.status}{item.dueAt ? ` · due ${item.dueAt}` : ""}</p><p className="mt-1 text-xs text-amber-200">Attention does not authorize execution.</p></article>)}</div></section>
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5"><h2 className="text-xl font-bold">Recent Pursuits</h2><div className="mt-4 space-y-3">{data.recentPursuits.length === 0 ? <p className="text-slate-400">No pursuits in the bounded view.</p> : data.recentPursuits.map((item) => <article key={item.id} className="rounded-xl bg-slate-950 p-4"><p className="font-semibold">{item.stage ?? "Stage unknown"} · {item.disposition ?? "Disposition unknown"}</p><p className="text-sm text-slate-400">Sales decision: {item.salesPursuitDecision ?? "Unknown"}</p><p className="mt-2 text-sm">Next action: {item.nextAction.description ?? "Unknown"} <span className="text-amber-300">(not execution-authorized)</span></p></article>)}</div></section></div>
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5"><h2 className="text-xl font-bold">Accounts</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{data.priorityAccounts.map((account) => <Link key={account.id} href={`/admin/crm-01/accounts/${encodeURIComponent(account.id)}`} className="rounded-xl bg-slate-950 p-4 hover:ring-1 hover:ring-cyan-400"><p className="font-semibold">{account.displayName ?? "Account name unavailable"}</p><p className="text-sm text-slate-400">{account.relationshipStatus ?? "Relationship state unknown"} · DNC {account.dnc.evaluation}</p></Link>)}</div></section>
      {data.dataQualityWarnings.length > 0 && <section className="rounded-2xl border border-violet-700 bg-violet-950/20 p-5"><h2 className="font-bold">Data quality / uncertainty</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-violet-100">{data.dataQualityWarnings.map((item) => <li key={item}>{item}</li>)}</ul></section>}</>}
  </div></main></ProtectedRoute>;
}
