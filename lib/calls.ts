import { setTimeout as sleep } from "node:timers/promises";
import { addEvent, getState, type NewEvent } from "./store";

const apiBase = "https://api.elevenlabs.io/v1/convai";
const greetings: Record<string, string> = {
  de: "Guten Tag, hier ist die digitale Assistenz Ihrer Hausverwaltung. Über Ihrer Wohnung wurde ein Wasserschaden gemeldet.",
  en: "Hello, this is the digital assistant for your property manager. A water leak was reported above your apartment.",
  fr: "Bonjour, je suis l’assistant numérique de votre gestionnaire immobilier. Une fuite a été signalée au-dessus de votre logement.",
};

export type ResidentCall = {
  caseId: string;
  tenantId: string;
  name: string;
  language: string;
  phoneEnv: string | null;
  purpose: string;
};

export function isCallDryRun() {
  return process.env.CALLS_DRY_RUN?.trim().toLowerCase() !== "false";
}

function callStarted(call: ResidentCall, dryRun: boolean): NewEvent {
  return {
    case_id: call.caseId,
    actor: "dirigent",
    kind: "call_started",
    payload: {
      to_tenant_id: call.tenantId,
      language: call.language,
      purpose: call.purpose,
      dry_run: dryRun,
    },
  };
}

function callEnded(call: ResidentCall, duration: number, summary: string): NewEvent {
  return {
    case_id: call.caseId,
    actor: "dirigent",
    kind: "call_ended",
    payload: { to_tenant_id: call.tenantId, duration_s: duration, summary },
  };
}

export function simulatedCallEvents(call: ResidentCall): NewEvent[] {
  return [
    callStarted(call, true),
    callEnded(call, 0, "Simulated warning about water from the apartment above."),
  ];
}

export async function startResidentCall(call: ResidentCall) {
  const caseExists = () => getState().cases.some(({ id }) => id === call.caseId);
  const record = (event: NewEvent) => {
    if (caseExists()) addEvent(event);
  };
  const explain = (text: string) => record({
    case_id: call.caseId,
    actor: "dirigent",
    kind: "reasoning",
    payload: { text },
  });

  if (!caseExists()) return;
  if (isCallDryRun()) {
    simulatedCallEvents(call).forEach(record);
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const agentId = process.env.ELEVENLABS_AGENT_RESIDENT_CALL?.trim();
  const phoneId = process.env.ELEVENLABS_PHONE_NUMBER_ID?.trim();
  const number = call.phoneEnv ? process.env[call.phoneEnv]?.trim() : undefined;
  const greeting = Object.hasOwn(greetings, call.language) ? greetings[call.language] : undefined;
  if (!apiKey || !agentId || !phoneId || !number || !/^\+[1-9]\d{6,14}$/.test(number) || !greeting) {
    explain("Live resident call skipped. Check the resident’s configured demo number, agent language and ElevenLabs settings.");
    return;
  }

  const headers = { "xi-api-key": apiKey, "Content-Type": "application/json" };
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
          dynamic_variables: {
            resident_name: call.name,
            purpose: "Warn the resident about possible water intrusion.",
            details: call.purpose,
            language: call.language,
          },
          conversation_config_override: {
            agent: { language: call.language, first_message: greeting },
          },
        },
      }),
    });
    if (!response.ok) throw new Error("Outbound call request failed.");
    const outbound = await response.json() as { success?: boolean; conversation_id?: string | null };
    if (!outbound.success) throw new Error("Outbound call was rejected.");

    record(callStarted(call, false));
    if (!outbound.conversation_id) {
      explain("ElevenLabs accepted the call without a conversation ID. Completion could not be verified.");
      return;
    }

    for (let poll = 0; poll < 36; poll++) {
      await sleep(5_000);
      if (!caseExists()) return;

      const result = await fetch(
        `${apiBase}/conversations/${encodeURIComponent(outbound.conversation_id)}`,
        { headers, signal: AbortSignal.timeout(10_000) },
      );
      if (result.status === 404 || result.status === 429 || result.status >= 500) continue;
      if (!result.ok) throw new Error("Conversation lookup failed.");
      const conversation = await result.json() as {
        status?: string;
        metadata?: { call_duration_secs?: number };
        analysis?: { transcript_summary?: string };
      };
      if (conversation.status !== "done" && conversation.status !== "failed") continue;

      const summary = conversation.analysis?.transcript_summary ||
        (conversation.status === "failed" ? "ElevenLabs reported that the call failed." : "Resident call completed.");
      record(callEnded(call, conversation.metadata?.call_duration_secs ?? 0, summary));
      return;
    }
    explain("Stopped polling ElevenLabs before it reported the call’s outcome.");
  } catch {
    explain("ElevenLabs could not confirm the resident call or its outcome. No automatic redial was attempted.");
  }
}
