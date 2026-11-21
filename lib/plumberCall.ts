import { setTimeout as sleep } from "node:timers/promises";
import { isCallDryRun } from "./calls";
import { addEvent, getState, proposePartnerSlot, updatePartnerJob } from "./store";

const apiBase = "https://api.elevenlabs.io/v1/convai";

const calls = globalThis as typeof globalThis & { activePartnerCalls?: Set<string> };
const activeCalls = calls.activePartnerCalls ??= new Set<string>();

export async function startPartnerCall(caseId: string, partnerId: string, mode: "dispatch" | "report") {
  if (partnerId !== "plumber_krause") return;
  const callKey = `${caseId}:${partnerId}`;
  if (activeCalls.has(callKey)) return;
  const state = getState();
  const job = state.events.findLast((event) => event.case_id === caseId &&
    event.kind === "partner_job" && event.payload.partner_id === partnerId);
  if (!job) return;

  const note = (text: string) => {
    if (getState().cases.some(({ id }) => id === caseId)) {
      addEvent({ case_id: caseId, kind: "reasoning", actor: "dirigent", payload: { text } });
    }
  };
  if (isCallDryRun("partner")) {
    note(`Dry run: the released plumber job would trigger an outbound ${mode} call.`);
    return;
  }
  const number = process.env.DEMO_PHONE_PLUMBER?.trim();
  const agentId = process.env.ELEVENLABS_AGENT_PARTNER_PHONE?.trim();
  const phoneId = process.env.ELEVENLABS_PARTNER_PHONE_NUMBER_ID?.trim();
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!number || !/^\+[1-9]\d{6,14}$/.test(number) || !agentId || !phoneId || !apiKey) {
    note("Plumber call skipped. Check the outbound plumber agent, phone number and ElevenLabs settings.");
    return;
  }

  const headers = { "xi-api-key": apiKey, "Content-Type": "application/json" };
  const shared = job.payload.shared as Record<string, unknown> | undefined;
  const briefing = [...new Set([job.payload.briefing, shared?.problem_description, shared?.address,
    shared?.caretaker_contact].filter((value) => typeof value === "string"))].join(" ");
  activeCalls.add(callKey);
  try {
    const response = await fetch(`${apiBase}/twilio/outbound-call`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phoneId,
        to_number: number,
        conversation_initiation_client_data: {
          dynamic_variables: { case_id: caseId, mode, briefing },
          conversation_config_override: { agent: { language: "en" } },
        },
      }),
    });
    if (!response.ok) throw new Error("Outbound call failed");
    const call = await response.json() as { success?: boolean; conversation_id?: string };
    if (!call.success || !call.conversation_id) throw new Error("Missing conversation ID");
    note(`Outbound ${mode} call started for the plumber.`);

    // After "done" the analysis can arrive a few seconds later: keep polling up to ~30 s for it.
    let waitsAfterDone = 0;
    for (let poll = 0; poll < 36; poll++) {
      await sleep(5_000);
      if (!getState().cases.some(({ id }) => id === caseId)) return;
      const result = await fetch(`${apiBase}/conversations/${encodeURIComponent(call.conversation_id)}`, {
        headers, signal: AbortSignal.timeout(10_000),
      });
      if (result.status === 404 || result.status === 429 || result.status >= 500) continue;
      if (!result.ok) throw new Error("Conversation lookup failed");
      const conversation = await result.json() as {
        status?: string;
        analysis?: { data_collection_results?: Record<string, { name?: unknown; value?: unknown }> };
      };
      if (conversation.status === "failed") break;
      if (conversation.status !== "done") continue;
      const collected = conversation.analysis?.data_collection_results;
      // ElevenLabs keys the results by item ID (aitem_…); the field name is in entry.name.
      const field = (name: string) => Object.values(collected ?? {}).find((entry) => entry?.name === name)?.value ??
        collected?.[name]?.value;
      const slot = field("slot");
      if (mode === "dispatch" && typeof slot === "string" && slot.trim() &&
          proposePartnerSlot(caseId, partnerId, slot) === "ok") return;

      const costValue = field("cost_eur");
      const cost = typeof costValue === "string" && /^\d+(?:[.,]\d{1,2})?$/.test(costValue.trim())
        ? Number(costValue.trim().replace(",", ".")) : costValue;
      const work = field("work_description");
      if (mode === "report" && typeof work === "string" && work.trim() &&
          typeof cost === "number" && Number.isFinite(cost) && cost >= 0 &&
          updatePartnerJob(caseId, partnerId, {
            kind: "result", payload: { cost_eur: cost, work_description: work.trim() },
          }) === "ok") return;
      const missing = mode === "dispatch" ? !(typeof slot === "string" && slot.trim())
        : !(typeof work === "string" && work.trim()) || costValue === undefined || costValue === null;
      if (missing && waitsAfterDone < 6) {
        waitsAfterDone++;
        continue;
      }
      break;
    }
    note("The plumber call did not save a confirmed update. Use the partner page to enter it manually.");
  } catch {
    note("The plumber call or its outcome could not be verified. Use the partner page to enter the update manually.");
  } finally {
    activeCalls.delete(callKey);
  }
}
