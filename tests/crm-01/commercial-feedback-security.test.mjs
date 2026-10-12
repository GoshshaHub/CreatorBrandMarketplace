import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route=await readFile("app/api/admin/agents/crm-01/commercial-feedback/route.ts","utf8"),ui=await readFile("app/admin/crm-01/CommercialFeedbackPanel.tsx","utf8");

test("production feedback execution is independently gated, bounded, Admin-only and no-store",()=>{for(const value of["authorizeCrmAdmin","CRM_COMMERCIAL_FEEDBACK_READ_ENABLED","CRM_COMMERCIAL_FEEDBACK_RECORDING_ENABLED","CRM_COMMERCIAL_FEEDBACK_SPECIALIST_ENABLED","CRM_COMMERCIAL_FEEDBACK_CHANGE_ENABLED","MAX_REQUEST_BYTES","no-store"])assert.match(route,new RegExp(value));assert.match(route,/COMMERCIAL_FEEDBACK_PRODUCTION_DEFAULT_ENABLED=false/)});
test("server reconstructs evidence Playbook and Revenue context before signed review",()=>{for(const value of["reconstructAuthenticObservation","resolveCurrentSalesPlaybook","getCrmRevenueSnapshot","createDeterministicRevenueRecommendation","commercial_feedback_request_stale","commercial_feedback_source_stale"])assert.match(route,new RegExp(value))});
test("one Founder request does not apply changes or continue CLOSER",()=>{assert.match(route,/automaticInvocation:false/);assert.match(route,/closerContinuation:false/);assert.match(ui,/Every step is Founder-triggered/);assert.match(ui,/Changes applied: No/);assert.doesNotMatch(route,/sendMessage|scheduleMessage|stripe|dispatchWorkforce/)});
test("Founder UI requires separate request findings and later exact disposition",()=>{for(const value of["preview_request","record_request","execute_specialist","preview_disposition","record_disposition","explicitFounderRequest","explicitFounderApproval"])assert.match(ui,new RegExp(value))});
