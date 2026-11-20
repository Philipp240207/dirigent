# CLAUDE.md: Dirigent (MAIN AI Hackathon Maastricht, 20 to 21 Nov 2026)

Project instructions for every coding agent in this repo (Claude Code reads this file, Codex reads `AGENTS.md`, which points here). Read the whole file before doing anything.
Team: **Julian** (agents, data, video), **Emil** (server), **Philipp** (screens). German task list with times: `docs/ROLLEN.md`. Beginner guide: `docs/LOKAL_TESTEN.md`.

---

## 1. Challenge and submission

**Track reltix: "Plug a Partner into centrix".** centrix is reltix's operating system for AI-native property management. Problem: every service around a building is its own silo, providers don't know when residents need them, **12 calls and emails before a broken heater gets fixed**. Task: plug one partner into centrix and turn a simple interaction into a finished outcome.

reltix's 4 steps of a winning solution (use these exact words in video and README):
1. **Detect the moment:** spot who needs a service, and when it matters.
2. **Hand over context:** pre-fill everything the partner needs from centrix.
3. **Hold the conversation:** make the interaction easy and efficient for everyone.
4. **Close the loop:** link what happened back to the property, keep people informed.

Rules: any partner around a property, at least one channel reaches the resident, we bring our own data.
reltix deliverables: **A. Working demo** (event → resident → partner → result), **B. Connector spec** (the next partner plugs in the same way).

**MAIN submission, Saturday, deadline 10:30, BuilderBase:** code as a zip file + demo video file of **max 2:30** + optional GitHub link. No slides. The jury judges the video; the top 2 per track get a live pitch. OpenAI and ElevenLabs give cross-track prizes, so both must be clearly visible.

---

## 2. Product and demo story

**Dirigent** is a conductor module for centrix. One event triggers a chain of actions that the AI derives from a **building graph** (`data/building.json`: units, water risers, heating loops) instead of hard-coded flows.

1. **Daniel Brooks (3.1, English)** tells the tenant agent that water drips from his ceiling and uploads a photo.
2. Dirigent walks riser A: **2.1 below = high risk → real phone call** to Herr Krueger in German. **1.1 = low risk → message.** Cellar → checked during the plumber visit.
3. Dirigent prepares the job. The property manager reviews the proposed plumber, scope, and information to be shared, then clicks **Approve and send**. The **plumber** (Sanitaer Krause) then gets a job with a **context pass**: only what his role may see (address, access, photo, assessment, availability, affected units). Rent arrears are withheld.
4. The plumber confirms a slot, later reports **"done, 340 EUR"** → case resolved, **maintenance log** entry, messages to tenants and owner, tracking page updated.
5. **Live partner plug-in:** paste the website text of **RheinNet Glasfaser** (fictional ISP) → GPT drafts its connector → activate → event "**Lucas Laurent moves into 4.2 on 1 Dec**" → pre-filled order to RheinNet + **real phone call to Lucas in French**. "Every new partner is a config, not a project."
6. **Cost counter:** this case about 1 EUR versus about 45 EUR of manual work.

Cast: Julian = Daniel (English, laptop) and Lucas (French, his phone). Emil = Herr Krueger (German, his phone). Philipp = plumber (German, partner page).

---

## 3. Tools we use (nothing else)

| Tool | For what |
|---|---|
| **GitHub** | one repo, branches, pull requests, code zip |
| **OpenAI** | API as the brain (GPT-6 Sol for decisions and vision, GPT-6 Luna for the rest) + Codex as coding agent |
| **ElevenLabs** | 3 voice agents, brand voice (Voice Design), outbound calls |
| **Twilio** | the phone line for the 2 real calls (US number, imported into ElevenLabs) |
| **Apple Design Resources** | look and feel of all screens (Human Interface Guidelines, iOS UI kit as reference) |

Software on our laptops (not services): Node.js, Next.js, Git. **No hosting, no database service.** The app runs locally with `npm run dev` on each laptop. The video is recorded on one **demo laptop**.

Why this works without hosting: the two browser agents use **client tools** (the browser calls our local API), and outbound calls are started by our local server (outgoing requests only). Nothing on the internet has to reach our laptop.

---

## 4. Working independently

Every person owns one area and can build and test it **alone**, against the contracts in section 5:

| Owner | Area (folders) | Works alone with |
|---|---|---|
| **Emil** | `app/api/**`, `lib/**`, `data/state.json` (generated) | curl tests from `docs/LOKAL_TESTEN.md`, `CALLS_DRY_RUN=true` (no agents or screens needed) |
| **Philipp** | `app/(screens)/**`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/**`, `client/**`, `public/mock/**` | **mock mode** `NEXT_PUBLIC_MOCK=true`: screens replay `fixtures/demo-events.json`, no server logic needed |
| **Julian** | ElevenLabs dashboard, Twilio, `prompts/**`, `connectors/**`, `docs/**`, `data/building.json` | ElevenLabs "test agent" in the dashboard, connector files checked against `connectors/schema.json` |

Setup (Emil, once): create the Next.js project first (`npx create-next-app@latest dirigent --ts --app --eslint`), then copy the team package into it. If a file exists twice, ours wins, except `.gitignore`: append our lines. Then install every package we need in one go, so nobody fights over `package.json` later: `npm install openai ajv @elevenlabs/react`. Pages may read `data/building.json` directly (read only).

Rules:
- Never edit another person's area. If you need a change there, tell the owner.
- **Contracts (section 5) are fixed.** Changing one needs a 2-minute agreement of all three, then the change goes into this file first.
- Integration happens only at the fixed times: **19:00, 22:00, 24:00** (section 8).

---

## 5. Contracts (fixed)

### 5.1 State
Emil's server keeps all state in memory and writes it to `data/state.json` (git-ignored). `GET /api/state` returns:
```json
{ "cases": [ { "id": "c1", "type": "water_leak", "unit_id": "3.1", "status": "open", "created_at": "2026-11-20T21:00:00Z" } ],
  "events": [ { "id": "e1", "case_id": "c1", "at": "2026-11-20T21:00:01Z", "kind": "reasoning", "actor": "dirigent", "payload": { "text": "..." } } ],
  "connectors": [ { "partner_id": "plumber_krause", "role": "plumber", "active": true } ] }
```
`status` values: `open`, `pending_approval`, `dispatched`, `scheduled`, `resolved`. `case_id` is `null` for events without a case (connector events).

### 5.2 Event kinds and payloads
| kind | payload |
|---|---|
| `case_created` | `{type, unit_id, tenant_id, description}` |
| `reasoning` | `{text}` |
| `affected` | `{unit_id, risk}` with risk `high`, `low` or `check` |
| `call_started` | `{to_tenant_id, language, purpose, dry_run}` |
| `call_ended` | `{to_tenant_id, duration_s, summary}` |
| `message` | `{to, text}` (to = tenant ID, `owner` or partner ID; shown in the outbox) |
| `photo` | `{url, assessment: {damage, severity, urgent, electrics}}` |
| `partner_job_proposed` | Same fields as partner_job, visible only to the property manager |
| `partner_job_approved` | `{partner_id}` with the approving manager as actor |
| `partner_job` | `{partner_id, role, shared: {...}, withheld: [field names], briefing}` |
| `slot_confirmed` | `{slot}` |
| `result` | `{cost_eur, work_description}` |
| `maintenance_log` | `{unit_id, partner_id, work_description, cost_eur}` |
| `status_change` | `{status}` |
| `connector_drafted` | `{connector}` |
| `connector_activated` | `{partner_id}` |
| `order` | `{partner_id, fields: {...}}` (pre-filled order, shown in the outbox) |
| `cost` | `{total_eur, breakdown: {voice_eur, phone_eur, openai_eur}}` |

### 5.3 API (Emil builds, Philipp's screens and the client tools call it)
| Method and path | Body | Response |
|---|---|---|
| `GET /api/state` | | state (5.1) |
| `POST /api/cases` | `{unit_id, description, tenant_language}` | `{case_id}` immediately; the Dirigent runs afterwards |
| `POST /api/cases/[id]/photo` | multipart field `file` | `{url, assessment}` |
| `GET /api/uploads/[file]` | | the image |
| `POST /api/cases/[id]/approve` | | `{ok: true}` (property manager only) |
| `GET /api/partner-job?case_id=` | | `{case, partner_id, role, shared, withheld, briefing}` |
| `POST /api/cases/[id]/slot` | `{slot}` | `{ok: true}` |
| `POST /api/cases/[id]/result` | `{cost_eur, work_description}` | `{ok: true}` |
| `POST /api/events` | `{type: "move_in", unit_id, tenant_id, date}` | `{case_id}` |
| `POST /api/connectors/draft` | `{partner_text}` | `{connector}` |
| `POST /api/connectors/activate` | `{connector}` | `{ok: true}` |
| `POST /api/reset` | | `{ok: true}` (empties the state; used before every video take) |

### 5.4 Agents (Julian builds in ElevenLabs)
| Agent | Runs in | Dynamic variables | Client tools (name: parameters → what the browser does) |
|---|---|---|---|
| `tenant_intake` | `/tenant/[unit]` | `unit_id, tenant_name, language` | `create_case: {description}` → `POST /api/cases`, returns `case_id` to the agent |
| `partner_call` | `/partner/[case]` | `case_id, mode, briefing` (mode `dispatch` or `report`) | `confirm_slot: {slot}` → `POST /api/cases/[id]/slot`; `report_result: {cost_eur, work_description}` → `POST /api/cases/[id]/result` |
| `resident_call` | phone (Twilio), started by the server | `resident_name, purpose, details, language` | none |

Client tools are set in the ElevenLabs dashboard as type **Client**, with exactly these names and parameters, "wait for response" on.

### 5.5 Data files
- `data/building.json`: the building (centrix data). `share_with` lists **roles**, never partner IDs.
- `connectors/*.json`: one file per partner, format in 7.4. `connectors/schema.json` validates them.
- `fixtures/demo-events.json`: the full demo (`cases`, `connectors`, `events`), each event with `at_s` (seconds from start) instead of `at`. Mock mode replays it. The `status_change` to `pending_approval` carries `"pause_until_approved": true`: the replay stops there until **Approve and send** is clicked. It uses only the event kinds of 5.2, so screens built on it work unchanged with the real server.

---

## 6. Design (Apple Design Resources)

All screens follow Apple's Human Interface Guidelines, using the iOS UI kit from Apple Design Resources as visual reference:
- Font: system font stack `-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif` (shows SF Pro on Mac and iPhone; do not bundle Apple font files).
- Colours: iOS system colours. Blue `#007AFF`, red `#FF3B30`, orange `#FF9500`, yellow `#FFCC00`, green `#34C759`, grey background `#F2F2F7`, cards white with 12 to 16 px radius.
- Icons: simple own SVGs (SF Symbols may only be used in mockups, not in our web app).
- Tracking and partner pages are designed as iPhone screens (390 px wide).
- House colours: open/affected high = red, high risk neighbour = orange, low risk = yellow, resolved = green.

---

## 7. Module specs

### 7.1 Emil: server
- `lib/store.ts`: in-memory state + write to `data/state.json`, `addEvent()`, `reset()`.
- `lib/building.ts`: load `data/building.json`, `findAffectedUnits(unitId, incidentType)` returns `[{unit_id, risk}]` by the riser rule (below = high, two or more below = low, cellar = check).
- `lib/dirigent.ts`: OpenAI **Responses API** with function calling. Tools: `find_affected_units`, `call_resident(tenant_id, purpose)`, `message_resident(tenant_id, text)`, `propose_partner_job(role)`, `message_owner(text)`, `log_reasoning(text)`. Code executes, every call writes an event. The model may explain but never invent parties.
- The proposed job moves the case to `pending_approval`. Only the property manager can view and approve the proposal. The property manager is whoever uses `/dashboard` (no logins, see section 9): "manager only" means the partner page and the partner routes never show or return a proposal. The approving actor is written as `property_manager`. Approval records the manager, releases the reviewed job once, emits `partner_job`, and moves the case to `dispatched`. Partner lookup, booking and result routes reject requests before approval. Resident notifications can run while approval is pending. The optional owner spending approval in Stage 3 is separate.
- `lib/contextPass.ts`: shared/withheld fields by code from `share_with` and the connector's role; the model only writes the briefing text.
- `lib/calls.ts`: `startResidentCall()`. If `CALLS_DRY_RUN=true`: only `call_started` and a fake `call_ended` event. Else: ElevenLabs Twilio outbound call (agent `resident_call`, `ELEVENLABS_PHONE_NUMBER_ID`, number from env, dynamic variables, overrides for language and first message). Then poll the conversation in the ElevenLabs API every 5 s until it is done, write `call_ended` with duration and summary.
- `lib/connectors.ts`: loads `connectors/*.json` + activated connectors from the state. Runner: event type → matching connectors (`detect.events`) → context pass → conversation and resident_contact.
- `lib/cost.ts`: OpenAI token usage from each response + call minutes, at production prices (7.6) → `cost` event.
- Photos: saved to `data/uploads/`, served by `GET /api/uploads/[file]`, vision via the main model.
- `POST /api/cases` answers immediately and runs the Dirigent in the background (no `await` before the response). Locally this is fine because the dev server keeps running.
- **Solo test:** all curl tests in `docs/LOKAL_TESTEN.md` pass with `CALLS_DRY_RUN=true`.

### 7.2 Philipp: screens
- `/dashboard`: house cross-section as SVG (cellar, 4 floors × 2 units, riser A left, riser B right), water animation down riser A, colours by events, reasoning stream, outbox (`message` + `order`), cost counter, context pass panel (shared vs withheld, withheld blurred), connector screen (textarea → draft → JSON → Activate → button "Lucas moves into 4.2"), button "Reset demo", manager review card with the plumber, scope, shared fields and **Approve and send** button, plus tracking and post-approval partner links.
- `/tenant/[unit]`: start `tenant_intake` with the ElevenLabs React SDK (`@elevenlabs/react`, `useConversation` with `clientTools`), photo upload button once a case exists.
- `/partner/[case]`: job card from `GET /api/partner-job`, buttons "Incoming job" (mode `dispatch`) and "Report done" (mode `report`) start `partner_call`.
- `/track/[case]`: iPhone-style timeline for residents.
- Data: `client/state.ts` polls `GET /api/state` every 1 s. In **mock mode** it instead replays `fixtures/demo-events.json` by `at_s` (case status = latest `status_change`), Pause replay at the proposal until the manager clicks **Approve and send**, then replay approval and dispatch. "Simulate call" buttons replace the agents, and the photo is `public/mock/demo-ceiling.jpg` (any picture of a wet ceiling).
- **Solo test:** with `NEXT_PUBLIC_MOCK=true` the whole demo plays on screen without server logic, agents or keys.

### 7.3 Julian: agents, Twilio, data, docs
- Brand voice with Voice Design. 3 agents exactly as in 5.4. For every agent: LLM = an OpenAI model from the dropdown (GPT-6 Luna if listed, else the cheapest OpenAI model; note the name for the video labels), TTS = a low-latency model that speaks en, de, fr, **additional languages en, de, fr**, **overrides for language and first message allowed** (Security tab), `tenant_intake` and `partner_call` **public** (no auth). First message always says it is the digital assistant of the property management (AI disclosure, EU AI Act).
- Twilio: upgrade (small top-up), buy a US number (a German number needs a regulatory review that takes days), geo permissions NL and DE, import into ElevenLabs, assign to `resident_call`.
- Copies of all prompts in `prompts/`. Already in the repo and valid against the schema: `connectors/schema.json`, `connectors/plumber_krause.json`, `docs/examples/isp_rheinnet.json` (Julian reviews them). Julian writes `docs/connector-spec.md` and the RheinNet website text `docs/rheinnet_website.txt`.
- **Solo test:** each agent works in the ElevenLabs test widget (client tools are tested at integration), both connector files validate against `connectors/schema.json`.

### 7.4 Connector format (deliverable B)
Real JSON files have no comments. `connectors/plumber_krause.json`:
```json
{
  "partner_id": "plumber_krause",
  "role": "plumber",
  "category": "repairs",
  "mode": "deliver",
  "detect": { "events": ["water_leak", "drain_blocked"], "conditions": "severity >= 2" },
  "handover": {
    "required": ["address", "unit_id", "access_info", "damage_photo", "damage_assessment", "tenant_availability", "affected_units"],
    "never": ["rent_arrears_eur"]
  },
  "conversation": { "channel": "browser", "agent": "partner_call", "language": "de",
                    "goal": "confirm the earliest slot that fits the affected tenants, get a cost estimate" },
  "close_loop": { "result_fields": ["slot", "cost_eur", "work_description"], "write_to_property": "maintenance_log",
                  "notify": ["tenant", "affected_tenants", "owner"], "approval_over_eur": 500 },
  "cost_rule": "voice only if urgent, language barrier or new resident without portal; otherwise message"
}
```
The 4 blocks are reltix's 4 steps: `detect`, `handover` (what the partner gets from us), `conversation`, `close_loop` (what we get back).
Optional `resident_contact` block when the resident must be contacted too. ISP example: `"conversation": {"channel": "message", "goal": "send the pre-filled order"}` (lands in the outbox as `order`) + `"resident_contact": {"channel": "phone", "agent": "resident_call", "goal": "confirm tariff and activation date"}`.
`schema.json` allows only roles from `roles_for_share_with` in building.json, agents `partner_call` and `resident_call`, channels `browser`, `phone`, `message`. `/api/connectors/draft` passes these lists to the model and validates the result. A live ISP connector must get role `isp`.

### 7.5 Models
`OPENAI_MODEL_MAIN=gpt-6-sol` for Dirigent decisions and photo vision. `OPENAI_MODEL_FAST=gpt-6-luna` for briefings, messages and connector drafts. Check the exact IDs in the OpenAI dashboard first. Static prompt parts first, changing parts last (prompt caching).

### 7.6 Cost
Prices checked Nov 2026: ElevenLabs Agents 0.08 USD per call minute. GPT-6 Sol 2 / 10 USD, GPT-6 Luna 0.10 / 0.50 USD per million tokens in/out. Telephony at production price (German number): about 0.04 USD per minute to German mobiles. Target about 1 EUR per water-leak case versus about 45 EUR manual (12 calls and emails, assumed 45 min at 60 EUR/h; ask the reltix mentor for the real number). Use 1 USD = 0.92 EUR.

---

## 8. Timeline and integration

| Time | What |
|---|---|
| 15:30 to 19:00 | Everyone builds **alone** (Emil: curl + dry run, Philipp: mock mode, Julian: agents in the dashboard) |
| **19:00 Integration 1 (45 min, all three)** | Emil merges to `main`. Philipp switches mock off. Julian's agent IDs into `.env.local`. Goal: Daniel speaks → case → Dirigent → dashboard (calls still dry run) |
| 19:45 to 22:00 | alone again: Emil real calls + partner flow, Philipp partner + tracking page, Julian connector spec |
| **22:00 Integration 2 (30 min)** | real call to Emil's phone, plumber flow, "done, 340 EUR" |
| **24:00 Gate 1** | the full flow runs 3 times in a row without errors on the demo laptop. Check that the partner cannot access the job before approval and that repeated approval releases it only once |
| 00:00 to 03:00 | stage 2 (section 9), integration whenever a part is ready |
| **03:00 Feature freeze** | after that only bug fixes and recording |
| 05:00 to 07:30 | recording on the demo laptop |
| 07:30 to 09:30 | edit, README, zip |
| **by 10:00** | uploaded on BuilderBase (deadline 10:30) |

---

## 9. Scope

**Stage 1, MUSS (Gate 1 at 24:00):** building data + plumber connector, tenant page + `tenant_intake`, Dirigent with graph walk, real call to 2.1 + message to 1.1, photo + vision, manager approval before plumber dispatch, partner page with slot and result → maintenance log + messages, dashboard (house, reasoning, outbox), tracking page, `POST /api/reset`, connector spec doc.
**Stage 2, SOLL (00:00 to 03:00), in this order:** live partner plug-in with Lucas' French call, cost counter, context pass panel.
**Stage 3, only if all done before 02:00:** owner approval by voice above 500 EUR, storm night with 100 simulated cases, heating scenario.
**Do NOT build:** hosting, a database service, WhatsApp, logins, a real centrix API, payments, a building editor, a mobile app.

---

## 10. Video (max 2:30)

Recorded on the demo laptop: screen recording + a second phone filming the real phone. English video, English subtitles for German and French. Labels when a technology acts ("ElevenLabs Agent, brand voice", "GPT-6 Sol decides", real model names). Chapter titles = reltix's 4 steps. `POST /api/reset` (button "Reset demo") before every take.

| Time | Scene |
|---|---|
| 0:00 to 0:10 | Black screen, a phone rings. Brand voice in German: "Herr Krueger, hier ist die digitale Assistenz Ihrer Hausverwaltung. Ueber Ihrer Wohnung gibt es einen Wasserschaden, die Hausverwaltung prueft gerade den Einsatz eines Installateurs." Title: "1 call instead of 12." |
| 0:10 to 0:20 | Problem: "12 calls and emails before a broken heater gets fixed." |
| 0:20 to 0:45 | DETECT THE MOMENT: Daniel reports in English, uploads photo. 3.1 red, water down riser A, 2.1 orange, 1.1 yellow, reasoning stream. |
| 0:45 to 1:10 | HAND OVER CONTEXT + HOLD THE CONVERSATION: call to Herr Krueger (split screen), message to 1.1 in the outbox, manager reviews the job and context pass (rent withheld), clicks **Approve and send**, then the plumber confirms a slot. |
| 1:10 to 1:25 | CLOSE THE LOOP: "done, 340 EUR", case resolved, maintenance log, tracking page as iPhone screen. |
| 1:25 to 1:55 | CONNECTOR: paste RheinNet text → connector JSON → activate → Lucas moves into 4.2 → French call + order in the outbox. |
| 1:55 to 2:15 | COST AND SCALE: this case about 1 EUR vs about 45 EUR, per flat per month, 100,000 flats. |
| 2:15 to 2:30 | "Dirigent for centrix", built with OpenAI and ElevenLabs, team names. |

- Real calls take 1 to 2 minutes: show 1 or 2 key sentences, fast-forward the rest with the transcript visible.
- Record every part as soon as it works.
- Real system only, several takes and cuts are fine.
- Fallbacks if stage 2 is missing: context pass as two JSON objects side by side, cost from the events on a title card, connector = the hand-written example file and its effect.

---

## 11. Working rules

- Branches `julian/...`, `emil/...`, `philipp/...`. Never commit directly to `main`. Pull request → another person merges.
- Before coding, the agent says in 2 to 3 sentences what it will change and in which files, and only touches the owner's area (section 4).
- **The agent tests before it says "done":** `npm run build` passes, `npm run dev` runs, the changed part is clicked through, every changed API route passes its curl test in `docs/LOKAL_TESTEN.md`. Every new route gets a curl test there.
- Locally `CALLS_DRY_RUN=true` except on the demo laptop during integration and recording.
- `main` must always run. If it breaks: "Revert" on the last pull request.
- Secrets only in `.env.local` (git-ignored). Never in the repo.
- New package needed later: install it, tell the team. Merge conflict in `package.json` or `package-lock.json`: keep both sides' dependencies, then run `npm install`.
- Two failed fix attempts → stop, tell the team, build it simpler.

Known traps:
- Browser-side env vars need the `NEXT_PUBLIC_` prefix.
- Changing `.env.local` needs a restart of `npm run dev`.
- The microphone only works on `localhost` (or https). On the demo laptop always open `http://localhost:3000`.
- The tracking page on a real phone: open `http://<laptop-IP>:3000/track/<id>` in the same Wi-Fi (no microphone needed). If the hackathon Wi-Fi blocks this, use Chrome's device toolbar (iPhone frame) on the laptop for the video.
- `data/state.json` and `data/uploads/` are git-ignored. Each laptop has its own state.

---

## 12. Upload checklist (Saturday)
- `README.md`: what Dirigent does (reltix's 4 steps), screenshot, how to run, where the connector spec is, which OpenAI and ElevenLabs features are used where.
- No key in the git history: `git log -p | grep -iE "sk-|xi-"` shows nothing.
- Zip from an up-to-date main: `git checkout main && git pull && git archive --format=zip -o dirigent.zip HEAD`.
- Video under 2:30. Upload **by 10:00**. GitHub repo public only right before the upload.

---

## 13. Env vars (`.env.local`, same keys on every laptop)
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
DEMO_PHONE_NEWTENANT=        # Julian's mobile, plays Lucas Laurent
CALLS_DRY_RUN=true           # false only on the demo laptop for real calls
NEXT_PUBLIC_MOCK=false       # true = screens replay fixtures/demo-events.json
```
