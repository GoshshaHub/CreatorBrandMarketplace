"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import { auth } from "../../../../lib/firebase";
import type { CrmAccountListItem, CrmPage } from "../../../../lib/agents/crm-01/read-types";

async function fetchAccounts(search: string, dnc: string, cursor?: string): Promise<CrmPage<CrmAccountListItem>> {
  const user = auth.currentUser;
  if (!user) throw new Error("Admin session unavailable.");
  const query = new URLSearchParams({ limit: "25" });
  if (search) query.set("search", search);
  if (dnc) query.set("dnc", dnc);
  if (cursor) query.set("cursor", cursor);
  const response = await fetch(`/api/admin/agents/crm-01/accounts?${query}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || body.code || "Account query failed.");
  return body;
}

export default function CrmAccountsPage() {
  const [search, setSearch] = useState(""); const [dnc, setDnc] = useState("");
  const [data, setData] = useState<CrmPage<CrmAccountListItem> | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function load(cursor?: string) { setBusy(true); setError(""); try { setData(await fetchAccounts(search.trim(), dnc, cursor)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Account query failed."); } finally { setBusy(false); } }
  useEffect(() => { void load(); }, []); // Initial bounded page only; filters run explicitly.
  function submit(event: FormEvent) { event.preventDefault(); void load(); }
  return <ProtectedRoute allowedRole="admin"><main className="min-h-screen bg-slate-950 px-4 py-10 text-white"><div className="mx-auto max-w-6xl space-y-6"><header><Link href="/admin/crm-01" className="text-cyan-300">← Control Room</Link><h1 className="mt-3 text-3xl font-bold">CRM Accounts</h1><p className="text-slate-300">Bounded, read-only canonical Account projections. Missing or conflicting facts remain visible.</p></header>
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:grid-cols-[1fr_14rem_auto]"><input aria-label="Search accounts" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Search account name" className="rounded-xl bg-slate-950 px-4 py-3"/><select aria-label="DNC evaluation filter" value={dnc} onChange={(event) => setDnc(event.target.value)} className="rounded-xl bg-slate-950 px-4 py-3"><option value="">All DNC evaluations</option><option value="blocked">Blocked</option><option value="allowed">Allowed</option><option value="review_required">Review required</option></select><button disabled={busy} className="rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">Filter</button></form>
    {error && <p className="rounded-xl border border-red-700 bg-red-950 p-4 text-red-200">{error}</p>}{!data && !error && <p>Loading…</p>}{data && <section className="space-y-3">{data.items.length === 0 ? <p className="rounded-xl bg-slate-900 p-5 text-slate-400">No matching Accounts in this bounded page.</p> : data.items.map((account) => <Link key={account.id} href={`/admin/crm-01/accounts/${encodeURIComponent(account.id)}`} className="block rounded-2xl border border-slate-700 bg-slate-900 p-5 hover:border-cyan-400"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{account.displayName ?? "Account name unavailable"}</h2><span className="text-sm text-slate-400">Revision {account.revision ?? "unknown"}</span></div><p className="mt-2 text-sm">Relationship: {account.relationshipStatus ?? "Unknown"} · DNC: {account.dnc.state} / {account.dnc.evaluation}</p>{account.warnings.map((warning) => <p key={`${warning.field}-${warning.message}`} className="mt-2 text-xs text-amber-300">{warning.message}</p>)}</Link>)}{data.nextCursor && <button disabled={busy} onClick={() => void load(data.nextCursor ?? undefined)} className="rounded-xl border border-cyan-500 px-5 py-3 text-cyan-200 disabled:opacity-50">Next bounded page</button>}</section>}
  </div></main></ProtectedRoute>;
}
