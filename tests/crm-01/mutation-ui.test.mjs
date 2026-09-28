import assert from "node:assert/strict";import {readFileSync} from "node:fs";import test from "node:test";
const source=readFileSync("app/admin/crm-01/accounts/[accountId]/MutationPanel.tsx","utf8");
test("Control Room exposes two-step exact preview and approval",()=>{assert.match(source,/Build exact preview/);assert.match(source,/exact before\/after/i);assert.match(source,/Approve this exact packet and plan/);assert.match(source,/Commit canonical mutation/);});
test("all approved core mutation kinds are represented",()=>{for(const kind of ["correct_record","add_evidence","record_interaction","record_founder_decision","transition_pursuit","update_dnc","set_next_action","create_attention_item","transition_attention_item","record_milestone"])assert.match(source,new RegExp(kind));});
