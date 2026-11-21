# CLAUDE.md: Dirigent (MAIN AI Hackathon Maastricht, 20 to 21 Nov 2026)

Project instructions for every coding agent in this repo (Claude Code reads this file, Codex reads `AGENTS.md`, which points here). Read the whole file before doing anything.
Team: **Julian** (agents, data, video), **Emil** (server), **Philipp** (screens). German task list with times: `docs/ROLLEN.md`. Beginner guide: `docs/LOKAL_TESTEN.md`.

**Guiding rule from reltix (call with the co-founder, 20 Nov): less is more.** We show ONE case, the water leak, and we play it through perfectly with all its scenarios. No second use case in the video. The live partner plug-in happens inside the same case (an electrician joins).

---

## 1. Challenge and submission

**Track reltix: "Plug a Partner into centrix".** centrix is reltix's operating system for AI-native property management (properties, units, people, contracts, cases, communication). Problem: every service around a building is its own silo, providers don't know when residents need them, **12 calls and emails before a broken heater gets fixed**. Task: plug one partner into centrix and turn a simple interaction into a finished outcome.

reltix's 4 steps of a winning solution (use these exact words in video and README):
1. **Detect the moment:** spot who needs a service, and when it matters.
2. **Hand over context:** pre-fill everything the partner needs from centrix.
3. **Hold the conversation:** make the interaction easy and efficient for everyone.
4. **Close the loop:** link what happened back to the property, keep people informed.

Rules: any partner around a property, at least one channel reaches the resident, we bring our own data.
reltix deliverables: **A. Working demo** (event → resident → partner → result), **B. Connector spec** (the next partner plugs in the same way).

**MAIN submission, Saturday, deadline 10:30, BuilderBase:** code as a zip file + demo video file of **max 2:30** + optional GitHub link. No slides. The jury judges the video; the top 2 per track get a live pitch. OpenAI and ElevenLabs give cross-track prizes, so both must be clearly visible.

---

## 2. Product and the one case

**Dirigent** is a module for centrix. Any service around a building plugs in as a **connector** (a short config file, no programming). When something happens, Dirigent derives from the **building graph** (`data/building.json`) who is affected, talks to everyone in their language, gets the property manager's approval, dispatches the partners and closes the loop.

### The water leak, scene by scene
1. **Overview:** `/dashboard` shows a stylised map of Duesseldorf with our 8 buildings and a list next to it. Everything is calm.
2. **Report:** Daniel Brooks (3.1, English) talks to the tenant agent and uploads a photo: water drips from the living-room ceiling, next to the ceiling lamp.
3. **Detect the moment:** Kaiserswerther Strasse 12 lights up red on the map and jumps to the top of the list. Click → the building cross-section opens. 3.1 red. Dirigent walks riser A: **4.1 above = possible source** (message: please check sinks, bath, washing machine), **2.1 below = high risk** (phone call), **1.1 and cellar = check**. The plumber proposal lists the reported flat for water shutoff. Approval requests closure at the listed flats’ own shutoff valves.
4. **Call to 2.1, scenario "no answer":** Herr Krueger does not pick up (Emil **declines** the call, that is faster than letting it ring). Dirigent sends him a message right away and schedules a **retry**. Timeline: "Retry at 13:42".
5. **Retry, scenario "answered":** Herr Krueger picks up, confirms a wet spot on his ceiling → 2.1 turns red ("confirmed"), 2.1 is added to the plumber's job.
6. **Photo:** GPT vision sees water near the ceiling lamp → the job also needs an **electrician**. Reasoning: "No electrician connected yet."
7. **Live partner plug-in (deliverable B):** the property manager pastes the website text of Elektro Schmitz → GPT drafts the connector → **Activate** → the electrician is now part of this case.
8. **Hand over context + approval:** the manager sees a review card per partner (scope, shared fields, withheld fields such as rent arrears and the key safe code) and clicks **Approve and send**. Only now do the partners see their jobs.
9. **Hold the conversation:** plumber and electrician (partner page, browser) each confirm a slot, ideally the same time. Access is through the caretaker, who has keys. Tenants and the caretaker get the appointment as a message.
10. **Close the loop:** plumber reports "done, 340 EUR", electrician "checked, dried, safe, 120 EUR". Case resolved, two maintenance log entries, messages to tenants ("water is back on") and owner (below the 500 EUR limit). The **tracking page** (like a parcel tracker) shows every step.
11. **Touchpoints and cost:** the counter shows about 20 touchpoints handled and 3 manager clicks (2 approvals, 1 connector activation) (reltix: "12 calls and emails"). This case about 1 EUR versus about 5 hours / 235 EUR of manual work (reltix numbers).

Cast: Julian = Daniel (English, laptop). Emil = Herr Krueger (German, real phone: first call he does not pick up, second call he does). Philipp = plumber and electrician (German, partner page).

### Scenarios the system must handle (and test)
| Scenario | Expected behaviour |
|---|---|
| Leak on a riser | approval requests closure at the listed flats’ shutoff valves; only those flats receive shutoff and restoration notices after the respective confirmations |
| Neighbour answers, damage found | `affected` risk `confirmed`, unit red, added to the plumber job (the proposal is written again, or, if already approved, the plumber gets a `message`) |
| Neighbour answers, no damage | risk `clear`, unit green |
| No answer or voicemail | `message` right away, `call_retry_scheduled`, retry after `RETRY_DELAY_MINUTES`, at most 2 retries; after the last one a message to the caretaker to check the flat |
| Photo shows electrics | electrician needed; if no electrician connector is active: reasoning says so, manager can plug one in |
| Manager has not approved yet | partner routes return an error, partner pages show nothing; residents are still informed |
| Approve clicked twice | the job is released exactly once |
| Tenant not home at the slot | caretaker opens (his contact is in the job, the key safe code never is) |
| Cost above 500 EUR | stage 3: owner approval. Below: message to the owner |

---

## 3. Tools we use (nothing else)

| Tool | For what |
|---|---|
| **GitHub** | one repo, branches, pull requests, code zip |
| **OpenAI** | API as the brain (GPT-6 Sol for decisions and vision, GPT-6 Luna for the rest) + Codex as coding agent |
| **ElevenLabs** | 3 voice agents, brand voices (Voice Design: Dirigent EN, DE, FR), outbound calls |
| **Twilio** | the phone line for the real calls to 2.1 (Philipp's mobile as verified caller ID, imported into ElevenLabs; outgoing only) |
| **Apple Design Resources** | look and feel of all screens (Human Interface Guidelines, iOS UI kit as reference) |

Software on our laptops (not services): Node.js, Next.js, Git. **No hosting, no database service, no map service.** The app runs locally with `npm run dev` while building. The video is recorded on one **demo laptop** with `npm run build && npm start` (stable, no reloads, no dev overlay).
Why this works without hosting: the browser agents use **client tools** (the browser calls our local API), and outbound calls are started by our local server and checked by polling the ElevenLabs API (outgoing requests only).

**Not possible until tomorrow, so not built:** photos via WhatsApp or email (needs a verified business number and a public server; in the video: "WhatsApp next"), tenants calling in by phone (we have no number that can receive calls; Daniel talks in the browser), calling partners by phone (partners use the partner page).

---

## 4. Working independently

| Owner | Area (folders) | Works alone with |
|---|---|---|
| **Emil** | `app/api/**`, `lib/**`, `data/state.json` (generated) | curl tests from `docs/LOKAL_TESTEN.md`, `CALLS_DRY_RUN=true` |
| **Philipp** | `app/(screens)/**`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/**`, `client/**`, `public/mock/**` | **mock mode** `NEXT_PUBLIC_MOCK=true`: screens replay `fixtures/demo-events.json` |
| **Julian** | ElevenLabs dashboard, Twilio, `prompts/**`, `connectors/**`, `docs/**`, `data/building.json`, `data/portfolio.json` | ElevenLabs test widget, connector files checked against `connectors/schema.json` |

Rules: never edit another person's area. Contracts (section 5) are fixed; changing one needs a 2-minute agreement of all three and goes into this file first. Integration at fixed times: **22:00, 24:00**, then whenever a stage 2 part is ready.
Pages may read `data/building.json` and `data/portfolio.json` directly (read only).

---

## 5. Contracts (fixed)

### 5.1 State
Emil's server keeps all state in memory and writes it to `data/state.json` (git-ignored). `GET /api/state` returns:
```json
{ "cases": [ { "id": "c1", "type": "water_leak", "building_id": "ksw-12", "unit_id": "3.1", "status": "open", "created_at": "2026-11-20T21:00:00Z" } ],
  "events": [ { "id": "e1", "case_id": "c1", "at": "2026-11-20T21:00:01Z", "kind": "reasoning", "actor": "dirigent", "payload": { "text": "..." } } ],
  "connectors": [ { "partner_id": "plumber_krause", "role": "plumber", "active": true } ] }
```
`status`: `open`, `pending_approval`, `dispatched`, `scheduled`, `resolved`. `case_id` is `null` for events without a case.
**Demo clock:** every `at` and `created_at` comes from the server's `now()` (7.1): `DEMO_NOW` plus the real time since the last reset. With `DEMO_NOW=2026-11-20T13:40:00+01:00` a case reported during the 05:00 recording shows "Friday 13:40". Screens show times only from event fields, formatted in `Europe/Berlin`, never from the browser clock.

### 5.2 Event kinds and payloads
| kind | payload |
|---|---|
| `case_created` | `{type, unit_id, tenant_id, description}` |
| `reasoning` | `{text, tool?}`; optional `tool` (stage 2) is the tool call behind it, for example `find_affected_units(3.1)`, shown as a chip |
| `affected` | `{unit_id, risk}`; risk `source`, `high`, `check`, `confirmed`, `clear` (a later event for the same unit overrides an earlier one) |
| `call_started` | `{to_tenant_id, language, purpose, attempt, dry_run}` |
| `call_ended` | `{to_tenant_id, attempt, outcome, damage_found, duration_s, summary}`; outcome `answered` or `no_answer` (voicemail counts as no_answer); damage_found `true`, `false` or `null` |
| `call_retry_scheduled` | `{to_tenant_id, attempt, at}`; `at` is always an ISO timestamp (demo clock). The screen formats it as "Retry at HH:MM" |
| `message` | `{to, text}` (to = tenant ID, `owner`, `caretaker` or partner ID; shown in the outbox) |
| `photo` | `{url, assessment: {damage, severity, urgent, electrics}}` |
| `partner_job_proposed` | same fields as `partner_job`, plus `water_shutoff_units` for the plumber; visible only on `/dashboard` (the property manager). **May be written again for the same `partner_id`** while it is not approved (the photo arrived, a unit was confirmed): the latest one per `partner_id` wins, older ones are ignored |
| `partner_job_approved` | `{partner_id}`, actor `property_manager` |
| `partner_job` | `{partner_id, role, shared: {...}, withheld: [field names], briefing}` |
| `slot_proposed` | `{partner_id, slot}`; appointment collected by the plumber phone agent, awaiting manager confirmation |
| `slot_confirmed` | `{partner_id, slot}` |
| `result` | `{partner_id, cost_eur, work_description}`; also written when the plumber phone agent collects a valid report |
| `maintenance_log` | `{unit_id, partner_id, work_description, cost_eur}` |
| `status_change` | `{status}` |
| `connector_drafted` | `{connector}` |
| `connector_activated` | `{partner_id}` |
| `cost` | `{total_eur, breakdown: {voice_eur, phone_eur, openai_eur}}` |
| `water_shutoff_requested` | `{riser_id, units}`; plumber approval requested closure at the listed flats’ own shutoff valves |
| `water_status_confirmed` | `{riser_id, units, status}`; status `off` or `restored`, actor `caretaker` |

A case has one or more partner jobs (plumber, electrician). The case is `resolved` when every approved partner has reported a result.

### 5.3 API (Emil builds, screens and client tools call it)
| Method and path | Body | Response |
|---|---|---|
| `GET /api/state` | | state (5.1) |
| `POST /api/cases` | `{unit_id, description, tenant_language}` | `{case_id}` immediately; the Dirigent runs afterwards |
| `POST /api/cases/[id]/photo` | multipart field `file` | `{url, assessment}` |
| `GET /api/uploads/[file]` | | the image |
| `POST /api/cases/[id]/approve` | `{partner_id}` | `{ok: true}`; releases that partner's job exactly once and starts an outbound dispatch call for the plumber |
| `GET /api/partner-job?case_id=&partner_id=` | | `{case, partner_id, role, shared, withheld, briefing}`; error before approval |
| `POST /api/cases/[id]/slot` | `{partner_id, slot}` | `{ok: true}`; manual fallback |
| `POST /api/cases/[id]/confirm-slot` | `{partner_id}` | `{ok: true}`; confirms the latest phone proposal and sends appointment notices once |
| `POST /api/cases/[id]/partner-call` | `{partner_id, mode: "report"}` | `{ok: true}`; starts the outbound report call for the approved plumber job in the background |
| `POST /api/cases/[id]/result` | `{partner_id, cost_eur, work_description}` | `{ok: true}` |
| `POST /api/cases/[id]/water-status` | `{status}`: `off` or `restored` | `{ok: true}`; the manager clicks it after the caretaker confirms the requested flats’ valves were closed or reopened. Writes `water_status_confirmed` and messages only those flats. `restored` only after the plumber's result; otherwise `409` |
| `POST /api/connectors/draft` | `{partner_text}` | `{connector}` |
| `POST /api/connectors/activate` | `{connector, case_id}` | `{ok: true}`; if `case_id` is given, the new partner is proposed for that case right away |
| `POST /api/events` | `{type: "move_in", unit_id, tenant_id, date}` | `{case_id}` (stage 3 only) |
| `POST /api/reset` | | `{ok: true}` (before every video take) |

### 5.4 Agents (Julian builds in ElevenLabs; prompts in `prompts/`)
| Agent | Runs in | Dynamic variables | Client tools |
|---|---|---|---|
| `tenant_intake` | `/tenant/[unit]` | `unit_id, tenant_name, language` | `create_case: {description}` → `POST /api/cases`, returns `case_id` |
| `partner_call` | `/partner/[case]?partner=` | `case_id, mode, briefing` (mode `dispatch` or `report`) | `confirm_slot: {slot}` → `POST /api/cases/[id]/slot`; `report_result: {cost_eur, work_description}` → `POST /api/cases/[id]/result` (the page adds `partner_id`) |
| `resident_call` | phone (Twilio), started by the server | `resident_name, purpose, details, language` | none |

Client tools are type **Client**, exactly these names and parameters, "wait for response" on. System tools: **End call** on for all three, **Language detection** on for `tenant_intake`, **Voicemail detection** on for `resident_call` (the agent hangs up at a mailbox, the server counts it as `no_answer`).

### 5.5 Data files
- `data/building.json`: the building (centrix data), including the caretaker. `share_with` lists **roles**, never partner IDs.
- `data/portfolio.json`: 8 buildings with positions on the map. Only `ksw-12` has real data.
- `connectors/*.json`: active connectors (plumber). `connectors/schema.json` validates them. `docs/examples/electrician_schmitz.json` is the worked example of the connector that is generated live.
- `fixtures/demo-events.json`: the whole case as events with `at_s` (mock clock = 13:40:00 + `at_s`), including the valve messages and a second plumber proposal. The event marked `"pause_until_approved": true` stops the replay until **Approve and send** is clicked. Uses only event kinds of 5.2.

---

## 6. Design (Apple Design Resources)

All screens follow Apple's Human Interface Guidelines, with the iOS UI kit from Apple Design Resources as visual reference.
- Font: `-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif` (no bundled Apple fonts). Icons: simple own SVGs.
- Colours: blue `#007AFF`, red `#FF3B30`, orange `#FF9500`, yellow `#FFCC00`, green `#34C759`, grey background `#F2F2F7`, white cards with 12 to 16 px radius.
- **Map:** a stylised SVG of Duesseldorf drawn by us (Rhine as a blue band, a few district names, light grey streets). No map service. Buildings are dots at `x`, `y` from `data/portfolio.json`: grey when calm, **red and pulsing** when a case is open, orange while waiting for approval, green when resolved.
- **List** next to the map: building name, district, units, status. A building with an open case jumps to the top in red. "View building" opens the cross-section.
- **Building cross-section:** cellar, 4 floors × 2 units, riser A left, riser B right, water animation down riser A. Unit colours by risk: reported unit red, `confirmed` red, `high` orange, `source` yellow, `check` light grey outline, `clear` green.
- Partner and tracking pages are iPhone screens (390 px wide).

---

## 7. Module specs

### 7.1 Emil: server
- `lib/store.ts`: state in memory + `data/state.json`, `addEvent()`, `reset()`. **The state object and all retry timers live on `globalThis`** (`globalThis.__dirigent ??= {...}`). Without this, Next.js gives every API route its own copy and throws timers away on every code reload, so the retry call never happens. `reset()` clears the timers.
- `lib/clock.ts`: `now()` = `DEMO_NOW` + real time since the last reset; real time if `DEMO_NOW` is empty. Every `at`, `created_at` and retry `at` uses it.
- `lib/building.ts`: `findAffectedUnits(unitId, incidentType)` by the rule in `data/building.json` (above = source, below = high, further down the riser and cellar = check). It also returns the riser: `{id, main_valve, units}`.
- **Water off:** the plumber proposal starts with `water_shutoff_units` containing the reporting flat and adds any neighbouring flat with confirmed damage before approval. Approving the plumber job records `water_shutoff_requested` with the riser ID and approved flats and asks the caretaker to close each flat’s own valve. The operator confirms shutoff before the outbox notifies those flats. The plumber result requests reopening, and the operator confirms restoration before the same flats are notified.
- `lib/dirigent.ts`: OpenAI **Responses API** with function calling. Tools: `find_affected_units`, `call_resident(tenant_id, purpose)`, `message_resident(tenant_id, text)`, `propose_partner_job(role)`, `message_owner(text)`, `message_caretaker(text)`, `log_reasoning(text)`. Code executes, every call writes an event. The model may explain but never invent parties. The model gets the building without `providers`: partners exist for it only as **active connectors**.
- **Approval:** `propose_partner_job` writes `partner_job_proposed` and sets the case to `pending_approval`. `POST /api/cases/[id]/approve` releases that partner's job once (`partner_job_approved`, `partner_job`, status `dispatched`). Partner routes reject requests before approval. Resident calls and messages run while approval is pending. **Updating a job:** when the photo assessment arrives or a unit is confirmed and the job is not approved yet, write `partner_job_proposed` again with the new fields. If it is already approved, send the partner a `message` instead and add the unit to the stored job.
- **Electrician:** if the photo assessment says `electrics: true`, the Dirigent proposes role `electrician`. If no active connector has that role, it writes a reasoning event ("No electrician connected yet") and waits. `POST /api/connectors/activate` with `case_id` then proposes the new partner for that case.
- `lib/contextPass.ts`: shared/withheld fields by code from `share_with` and the connector's role; the model only writes the briefing and gets only the `shared` fields for it. **Allowlist:** a field is shared only if the connector's `handover.required` names it and the role is allowed; everything else is withheld, also fields without a `share_with` (for example `main_door_code`). The caretaker's name and phone are shared, the key safe code never.
- `lib/calls.ts`: `startResidentCall(tenantId, purpose, attempt)`. Dry run: `call_started` + fake `call_ended` (attempt 1 `no_answer`, attempt 2 `answered` with `damage_found: true`, so the whole scenario can be tested without phones). Real: ElevenLabs Twilio outbound call (agent `resident_call`, `ELEVENLABS_PHONE_NUMBER_ID`, number from env, dynamic variables, a language override while the agent supplies its greeting), then poll the conversation every 5 s until done. Not picked up, failed, or ended by voicemail detection → `no_answer`. Answered → GPT-6 Luna reads the transcript and sets `damage_found` and `summary`. The `details` variable explains that the caretaker will shut off water in the flat above and in the called flat only if damage is found. On retries it also mentions the previous message.
- **Retry:** on `no_answer`: `message` to the tenant right away, `call_retry_scheduled` with `at` = now + `RETRY_DELAY_MINUTES`, then `setTimeout` for the next attempt (max 2 retries). After the last failed attempt: `message` to the caretaker. On `damage_found: true`: `affected` `confirmed` and the unit goes into the plumber's `affected_units`. On `false`: `affected` `clear`.
- `lib/connectors.ts`: loads `connectors/*.json` + activated connectors from the state; `/api/connectors/draft` gives the model the allowed roles, agents and channels and validates against `connectors/schema.json` (ajv).
- `lib/cost.ts`: OpenAI tokens + call minutes at production prices (7.6) → `cost` event when the case is resolved.
- Photos: saved in `data/uploads/`, served by `GET /api/uploads/[file]`, vision by the main model.
- `POST /api/cases` answers immediately and runs the Dirigent in the background (no `await` before the response; the local dev server keeps running).
- **Solo test:** every curl test in `docs/LOKAL_TESTEN.md` passes with `CALLS_DRY_RUN=true`, including the full retry scenario. Extra check: edit and save any file in `lib/` while a retry is waiting; the retry must still happen.

### 7.2 Philipp: screens
- `/dashboard`: map + list (section 6), building cross-section with the reasoning stream and the timeline, outbox (`message`), **manager review card per proposed partner** (scope, shared fields, withheld fields blurred, **Approve and send**), connector screen (textarea → Draft → JSON → Activate for this case), cost counter, button "Reset demo", links to the partner pages and the tracking page.
- **Review card:** show the latest `partner_job_proposed` per `partner_id` (a later one replaces an earlier one), until `partner_job_approved` for that partner arrives.
- Timeline shows calls with attempt number, "no answer", "retry at HH:MM" (from the ISO `at`), and the answer of the neighbour. **All times come from event fields (`Europe/Berlin`), never from `new Date()`.** Mock mode: 13:40:00 + `at_s`.
- **Touchpoint counter** (stage 2, next to the cost counter): "Touchpoints handled" = number of events of kind `message`, `call_started`, `partner_job`, `slot_confirmed`, `result`. "Manager clicks" = number of `partner_job_approved` + `connector_activated`. Counts up live.
- **Connector screen extras** (stage 2): after Draft show three checks (schema valid, handover fields available in centrix, fields blocked by policy) before Activate. Below: three connector cards (plumber, electrician, ISP example from `docs/examples/isp_rheinnet.json`) with the line "Repairs and sales, same 4 blocks".
- **Tool chips** (stage 2): if a `reasoning` event has `tool`, show it as a small chip above the text.
- `/tenant/[unit]`: `tenant_intake` with `@elevenlabs/react` (`useConversation` with `clientTools`), photo upload button once the case exists.
- `/partner/[case]?partner=plumber_krause` and `?partner=electrician_schmitz`: job card from `GET /api/partner-job`, buttons "Incoming job" (mode `dispatch`) and "Report done" (mode `report`) start `partner_call`; the page adds `partner_id` to the tool calls.
- `/track/[case]`: iPhone-style timeline for residents (like a parcel tracker): reported, neighbours checked, approved, appointment, done.
- Data: `client/state.ts` polls `GET /api/state` every 1 s; in mock mode it replays `fixtures/demo-events.json` (pause at approval, "Simulate call" buttons, photo `public/mock/demo-ceiling.jpg`).
- **Solo test:** with `NEXT_PUBLIC_MOCK=true` the whole case plays on screen.

### 7.3 Julian: agents, Twilio, data, docs
- Voices: Dirigent EN, Dirigent DE, Dirigent FR (male, Voice Design). 3 agents exactly as in 5.4 and `prompts/`. OpenAI model from the dropdown (note the name for video labels), additional languages, overrides for language and first message, browser agents public, AI disclosure in the first message, system tools as in 5.4.
- Twilio (done): Philipp's mobile as verified caller ID, imported into ElevenLabs, assigned to `resident_call`. Philipp is never called.
- Files: `docs/connector-spec.md` (deliverable B, with the plumber and the electrician as examples, the ISP as third example for `mode: sell`, and one sentence on `detect.conditions`: the model evaluates the condition against the case and logs the result as reasoning), `docs/elektro_schmitz_website.txt` (website text for the live plug-in), checks `data/portfolio.json` and the caretaker in `data/building.json`.

### 7.4 Connector format (deliverable B)
Real JSON files have no comments. Blocks = reltix's 4 steps: `detect`, `handover` (what the partner gets from us), `conversation`, `close_loop` (what we get back), plus `role`, `mode`, `cost_rule`, optional `resident_contact`. See `connectors/plumber_krause.json` and `docs/examples/electrician_schmitz.json`. `schema.json` allows only roles from `roles_for_share_with`, agents `partner_call` and `resident_call`, channels `browser`, `phone`, `message`.

### 7.5 Models
`OPENAI_MODEL_MAIN=gpt-6-sol` for Dirigent decisions and photo vision. `OPENAI_MODEL_FAST=gpt-6-luna` for briefings, messages, transcript reading and connector drafts. Check the exact IDs in the OpenAI dashboard first. Static prompt parts first (prompt caching).

### 7.6 Cost
Prices checked Nov 2026: ElevenLabs Agents 0.08 USD per call minute. GPT-6 Sol 2 / 10 USD, GPT-6 Luna 0.10 / 0.50 USD per million tokens in/out. Telephony at production price (German number): about 0.04 USD per minute to German mobiles. 1 USD = 0.92 EUR.
**Source: Vincent (reltix), 20 Nov:** a repair case takes about 5 hours of staff time (report, quotes, compare, assign, chase the craftsman, confirm, invoice). A property manager costs about 80,000 EUR per year all-in, about 47 EUR/h, so 5 h = about 235 EUR. About 1.5 cases per flat per year. Order value about 5,000 EUR on average.
Scale for the video: 100,000 flats → 150,000 cases → 750,000 staff hours per year (about 440 full-time managers, about 35 million EUR) versus about 150,000 EUR of AI and phone cost. Per flat and month: about 29 EUR versus about 0.13 EUR. The manager still approves each job, so say "most of the 5 hours", not all.

---

## 8. Timeline

| Time | What |
|---|---|
| until 22:00 | Emil: retry, outcome reading, approval per partner. Philipp: map + list, cross-section, review card, partner + tracking page. Julian: agents done, connector spec, Elektro Schmitz text, video script |
| **22:00 Integration (30 min)** | real calls on the demo laptop: first call not answered, retry answered; approval; plumber flow; "done, 340 EUR" |
| **24:00 Gate 1** | the whole case (section 2, without the electrician) runs 3 times in a row; every row of the scenario table checked once |
| 00:00 to 03:00 | Stage 2 |
| **03:00 Feature freeze** | bug fixes and recording only |
| 05:00 to 07:30 | recording on the demo laptop |
| 07:30 to 09:30 | edit, README, zip |
| **by 10:00** | uploaded (deadline 10:30) |

## 9. Scope

**Stage 1, MUSS (Gate 1):** tenant page + `tenant_intake`, Dirigent with graph walk (source, high, check), call to 2.1 with no-answer → message → retry → answered → confirmed, photo + vision, manager approval, plumber partner page with slot and result, maintenance log, messages, building cross-section + reasoning + outbox, tracking page, reset, connector spec doc, apartment-level shutoff and restoration after operator confirmation, store and timers on `globalThis`, demo clock, ISO retry time, latest proposal per partner on the review card.
**Stage 2, SOLL (00:00 to 03:00), in this order:** live electrician plug-in in the same case (deliverable B), map + list overview, touchpoint counter + cost counter, connector checks + three connector cards, context pass panel with blurring, tool chips.
**Stage 3, only if all done before 02:00:** owner approval above 500 EUR, move-in with internet (ISP example), storm night.
**Do NOT build:** hosting, database service, map service, WhatsApp, inbound phone calls, logins, a real centrix API, payments, a building editor, a mobile app.

---

## 10. Video (max 2:30), one case, all scenarios

Recorded on the demo laptop with `npm run build && npm start` and `DEMO_NOW` set: screen recording + a second phone filming Emil's phone (Do Not Disturb off; he **declines** the first call). English video, English subtitles for German. Labels when a technology acts ("ElevenLabs Agent", "GPT-6 Sol decides", real model names). Chapter titles = reltix's 4 steps. "Reset demo" before every take. Set `RETRY_DELAY_MINUTES=1` for recording; the timeline label says the real value ("retry in 60 min") is a setting.

| Time | Scene |
|---|---|
| 0:00 to 0:10 | Map of Duesseldorf, 8 calm buildings. One turns red and pulses. Title: "1 report instead of 12 calls." |
| 0:10 to 0:32 | DETECT THE MOMENT: Daniel reports in English, photo. Cross-section: 3.1 red, water down riser A, 4.1 yellow (possible source), 2.1 orange. Show the affected flats that will be included in the shutoff request at approval. |
| 0:32 to 1:00 | **The headline moment.** On screen: "Herr Krueger never called us. We called him." No answer → message → retry (6 seconds, fast). Retry: he picks up (split screen, German, subtitles), confirms a wet spot → 2.1 red, added to the job. Picture in picture, 3 seconds: "And if he says no?" → he answers that everything is dry → 2.1 green. |
| 1:00 to 1:25 | Photo shows the lamp → "No electrician connected yet" → paste Elektro Schmitz text → connector → Activate. "Every new partner is a config, not a project." |
| 1:25 to 1:45 | HAND OVER CONTEXT: review card, rent and key safe code blurred, **Approve and send**. HOLD THE CONVERSATION: plumber and electrician confirm 16:00, caretaker opens. |
| 1:45 to 2:05 | CLOSE THE LOOP: "done, 340 EUR", "checked, 120 EUR", case green on the map, maintenance log, tracking page on a phone. |
| 2:05 to 2:20 | Touchpoint counter: "About 20 touchpoints handled, 3 manager clicks." Cost: this case about 1 EUR vs about 5 hours / 235 EUR (reltix numbers). One line for scale: 100,000 flats, 750,000 staff hours per year. |
| 2:20 to 2:30 | "Dirigent for centrix", built with OpenAI and ElevenLabs, team names. Roadmap line: WhatsApp, more partners. |

Real calls take 1 to 2 minutes: show the key sentences, fast-forward the rest. Record every part as soon as it works. Real system only.

---

## 11. Working rules

- Branches `julian/...`, `emil/...`, `philipp/...`. Never commit to `main` directly. Pull request → another person merges ("Create a merge commit").
- Before coding, the agent says in 2 to 3 sentences what it will change and where, and only touches the owner's area.
- **Test before "done":** `npm run build` passes, `npm run dev` runs, the changed part is clicked through, changed API routes pass their curl tests in `docs/LOKAL_TESTEN.md` (every new route gets one).
- Locally `CALLS_DRY_RUN=true` except on the demo laptop from 22:00.
- `main` must always run. If it breaks: "Revert" on the last pull request.
- Secrets only in `.env.local`. New package: install, tell the team; on a `package.json` conflict keep both sides and run `npm install`.
- Two failed fix attempts → stop, tell the team, build it simpler.

Known traps: in-memory state and `setTimeout` must hang on `globalThis` (7.1), or routes see different state and retries vanish after a reload; browser env vars need `NEXT_PUBLIC_`; changing `.env.local` needs a restart; the microphone only works on `localhost`; tracking page on a phone via `http://<laptop-IP>:3000/track/<id>` or Chrome's device toolbar; `data/state.json` and `data/uploads/` are git-ignored.

## 12. Upload checklist (Saturday)
README (reltix's 4 steps, screenshot, how to run, where the connector spec is, which OpenAI and ElevenLabs features are used where, and a short honest table **"real vs simulated"**: real = voice agents, the phone call, photo vision, connector drafting, context pass by code; simulated = centrix data, partners on a browser page instead of their phone, messages shown in an outbox instead of sent by SMS or WhatsApp). No key in the git history (`git log -p | grep -iE "sk-|xi-"`). Zip from an up-to-date main: `git checkout main && git pull && git archive --format=zip -o dirigent.zip HEAD`. Video under 2:30. Upload **by 10:00**. Repo public only right before the upload.

## 13. Env vars (`.env.local`)
```
OPENAI_API_KEY=
OPENAI_MODEL_MAIN=gpt-6-sol
OPENAI_MODEL_FAST=gpt-6-luna
ELEVENLABS_API_KEY=
NEXT_PUBLIC_ELEVENLABS_AGENT_TENANT=
NEXT_PUBLIC_ELEVENLABS_AGENT_PARTNER=
ELEVENLABS_AGENT_RESIDENT_CALL=
ELEVENLABS_PHONE_NUMBER_ID=
DEMO_PHONE_NEIGHBOUR=        # Emil's mobile, plays Herr Krueger (2.1)
DEMO_PHONE_NEWTENANT=        # stage 3 only (move-in)
CALLS_DRY_RUN=true           # false only on the demo laptop for real calls
RETRY_DELAY_MINUTES=60       # 1 for testing and recording
DEMO_NOW=2026-11-20T13:40:00+01:00   # demo clock: every time on screen starts here after a reset. Empty = real time
NEXT_PUBLIC_MOCK=false       # true = screens replay fixtures/demo-events.json
```
