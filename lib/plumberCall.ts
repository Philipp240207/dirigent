import { setTimeout as sleep } from "node:timers/promises";
import { isCallDryRun } from "./calls";
import { addEvent, getState, updatePartnerJob } from "./store";

const partnerId = "plumber_krause";
const apiBase = "https://api.elevenlabs.io/v1/convai";

export async function callPlumber(caseId: string) {
  const state = getState();
  const job = state.events.findLast((event) => event.case_id === caseId &&
    event.kind === "partner_job" && event.payload.partner_id === partnerId);
  if (!job) return;

  const note = (text: string) => {
    if (getState().cases.some(({ id }) => id === caseId)) {
      addEvent({ case_id: caseId, kind: "reasoning", actor: "dirigent", payload: { text } });
    }
  };
  if (isCallDryRun()) {
    note("Dry run: the released plumber job would trigger an outbound appointment call.");
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
  const briefing = [job.payload.briefing, shared?.problem_description, shared?.address,
    shared?.caretaker_contact].filter((value) => typeof value === "string").join(" ");
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
          dynamic_variables: { case_id: caseId, mode: "dispatch", briefing },
        },
      }),
    });
    if (!response.ok) throw new Error("Outbound call failed");
    const call = await response.json() as { success?: boolean; conversation_id?: string };
    if (!call.success || !call.conversation_id) throw new Error("Missing conversation ID");
    note("Outbound appointment call started for the plumber.");

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
        analysis?: { data_collection_results?: { slot?: { value?: unknown } } };
      };
      if (conversation.status === "failed") break;
      if (conversation.status !== "done") continue;
      const slot = conversation.analysis?.data_collection_results?.slot?.value;
      if (typeof slot === "string" && slot.trim() &&
          updatePartnerJob(caseId, partnerId, { kind: "slot_confirmed", payload: { slot: slot.trim() } }) === "ok") {
        return;
      }
      break;
    }
    note("The plumber call did not save a confirmed appointment. The job is available for manual scheduling.");
  } catch {
    note("The plumber call or its outcome could not be verified.");
  }
}
