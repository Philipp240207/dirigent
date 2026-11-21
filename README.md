# Dirigent

**One report instead of twelve calls. Dirigent is an AI conductor for centrix that turns a single tenant report into a finished repair: it finds everyone affected, calls them, briefs the right partner and closes the loop.**

Built in 24 hours at the MAIN AI Hackathon & Summit 2026 in Maastricht, track reltix: "Plug a Partner into centrix".

---

## The problem

Every service around a building lives in its own silo. When a tenant reports a water leak, the property manager has to find out where the water comes from, warn the neighbours, find a plumber, pass on the details, agree on a time, get the water shut off and back on, and tell everyone what happened. That is around **12 calls and emails** and hours of manual work before a single leak is fixed.

## Our solution

Dirigent is a module for centrix. It reads the **building graph** (units, risers, residents, caretaker, owner) and orchestrates the whole case with voice agents. The property manager only clicks to approve.

We follow reltix's four steps and show them on one case, a water leak in Kaiserswerther Strasse 12:

### 1. Detect the moment
- The tenant Daniel (flat 3.1) talks to our **ElevenLabs voice agent** in the browser, in his own language, and uploads a photo of the ceiling.
- **GPT vision** assesses the damage from the photo.
- Dirigent walks the water riser in the building graph: the flat above is the **possible source**, the flat below is at **high risk**, the ground floor and cellar are flagged for a check. The building lights up on the map and in a live cross-section.

### 2. Hand over context
- Dirigent **calls the neighbour below** on his real phone (ElevenLabs agent over Twilio). If he does not pick up, it sends a message right away and **schedules a retry**. When he answers and confirms a wet spot, his flat is added to the job automatically.
- The property manager sees a **review card** for the plumber: exactly which fields are shared (address, affected flats, photo, assessment, caretaker contact) and which are **withheld** (e.g. rent arrears, key safe code). One click on **Approve and send** releases the job. The caretaker is asked to shut off the water in the affected flats.

### 3. Hold the conversation
- Dirigent **calls the plumber** on his phone, briefs him and agrees on an appointment. The manager confirms the slot, and all affected tenants and the caretaker are informed.

### 4. Close the loop
- After the repair, Dirigent calls the plumber again to collect the **report and the cost**. The case is resolved, the work is written to the **maintenance log**, tenants are told the water is back on, and the owner is informed (owner approval only above 500 EUR).
- Tenants can follow every step on a **tracking page**, like a parcel tracker.

## What it costs

Today, a single repair case takes a property manager **about 5 hours** (taking the report, getting quotes, assigning the craftsman, chasing him, confirming, invoicing). At about 47 EUR per hour, that is **about 235 EUR per case** (numbers from reltix).

With Dirigent, the same case costs **about 1 EUR** in AI and phone costs (voice agent minutes, phone minutes and OpenAI tokens at production prices). About 20 touchpoints are handled automatically, and the manager only clicks to approve.

| | Today (manual) | With Dirigent |
|---|---|---|
| Cost per case | ~235 EUR | **~1 EUR** |
| Staff time per case | ~5 hours | a few clicks |
| Calls and emails by the manager | ~12 | 0 |

That is **more than 99% cheaper per case**. The manager still approves every job, so Dirigent saves most of the 5 hours, not all of them.

**At scale:** a portfolio of 100,000 flats has about 150,000 repair cases per year. Today that means about **750,000 staff hours (around 35 million EUR)**. With Dirigent, the AI and phone cost is about **150,000 EUR**. Per flat and month, that is about **0.13 EUR instead of 29 EUR**.

## Plug in any partner (connector spec)

Every partner plugs in through a short **connector file** instead of custom code, built on the same four blocks: `detect`, `handover`, `conversation`, `close_loop`. See `connectors/plumber_krause.json`, the schema in `connectors/schema.json` and the full spec in `docs/connector-spec.md` (with an electrician and an internet provider as further examples).

## How we use OpenAI and ElevenLabs

- **OpenAI:** GPT-6 Sol makes the Dirigent decisions and reads the damage photo (vision). GPT-6 Luna writes partner briefings and messages and reads the call transcripts to decide whether a neighbour found damage. Codex helped us build the app.
- **ElevenLabs:** three voice agents with our own brand voices: the tenant intake agent in the browser, the outbound resident call agent and the outbound plumber call agent (phone calls via Twilio), with language detection and voicemail detection.

## Tech stack

- **App:** Next.js, React, TypeScript, Tailwind CSS
- **Map:** Leaflet / MapLibre with our own portfolio data
- **AI:** OpenAI API, ElevenLabs Conversational AI
- **Phone:** Twilio (outbound calls through ElevenLabs)
- Runs fully locally, no hosting or database needed

## Getting started

```bash
git clone https://github.com/Philipp240207/dirigent.git
cd dirigent
npm install
cp .env.example .env.local   # add your OpenAI and ElevenLabs keys
npm run dev
```

Open `http://localhost:3000`. With `CALLS_DRY_RUN=true` (default) no real phone calls are made, so the whole case can be tested without phones. With `NEXT_PUBLIC_MOCK=true` the screens replay the full demo case from `fixtures/demo-events.json` without any API keys.
