# Rollen, Aufgaben und Zeitplan

Technik steht in `CLAUDE.md`. Diese Datei sagt nur: **wer, was, bis wann.**

**Grundprinzip: Jeder arbeitet allein.** Niemand wartet auf jemand anderen. Das geht, weil die Schnittstellen in `CLAUDE.md` Abschnitt 5 fest sind und jeder einen eigenen Testweg hat:
- **Emil** testet seinen Server mit curl-Befehlen, Anrufe im Testmodus (`CALLS_DRY_RUN=true`).
- **Philipp** baut alle Bildschirme mit Testdaten (`NEXT_PUBLIC_MOCK=true`, spielt `fixtures/demo-events.json` ab).
- **Julian** baut und testet die Agents direkt im ElevenLabs-Dashboard.

Zusammengesteckt wird nur zu festen Zeiten: **19:00, 22:00, 24:00.**
Jeder ändert nur Dateien in seinem Bereich (CLAUDE.md Abschnitt 4).

---

## Gemeinsamer Zeitplan

| Zeit | Was |
|---|---|
| 15:30 bis 16:00 | Setup (unten pro Person) |
| 16:00 bis 19:00 | **Allein bauen** |
| **19:00 bis 19:45** | **Zusammenstecken 1:** Daniel spricht → Fall → Dirigent → Dashboard (Anrufe noch im Testmodus) |
| 19:45 bis 22:00 | Allein bauen |
| **22:00 bis 22:30** | **Zusammenstecken 2:** echter Anruf auf Emils Handy, Freigabe durch die Hausverwaltung, Installateur, "fertig, 340 €" |
| 22:30 bis 24:00 | Allein bauen + Lücken schließen |
| **24:00** | **Gate 1:** ganzer Ablauf 3-mal fehlerfrei auf dem Demo-Laptop. Prüfen: Installateur sieht vor der Freigabe nichts, doppeltes Klicken gibt nur einmal frei |
| 00:00 bis 03:00 | Wow-Teile (Stufe 2), einstecken, sobald ein Teil fertig ist |
| **03:00** | **Feature Freeze**, 03:00 bis 03:30 letzte Fehler, alles in `main` |
| 03:30 bis 05:00 | Emil und Philipp schlafen, Julian ist wach (hat 01:30 bis 03:00 geschlafen) |
| 05:00 bis 07:30 | Dreh auf dem Demo-Laptop |
| 07:30 bis 09:30 | Schnitt, README, Zip |
| **bis 10:00** | **Hochgeladen** (Deadline 10:30) |

Team-Checks (je max. 10 Minuten) zusätzlich um **16:00 und 03:00**: Was läuft? Was hängt? Wer länger als 45 Minuten an einem Fehler hängt, meldet sich sofort.

**Demo-Laptop:** Wird um 16:00 festgelegt (der mit dem meisten Arbeitsspeicher). Darauf laufen Zusammenstecken, Gate 1 und der Dreh.

---

## Julian: Agents, Twilio, Daten, Video

**15:30 bis 16:00 Setup**
- [ ] Alle Keys in den Gruppenchat: OpenAI, ElevenLabs (erledigt), Twilio folgt
- [ ] BuilderBase: alle drei im selben Team, Login mit der Luma-E-Mail
- [ ] reltix-Mentor (10 Minuten): Wie viel Arbeitszeit kostet ein Schadensfall heute wirklich?

**16:00 bis 19:00 allein**
- [ ] **Twilio:** upgraden (ca. 20 $), US-Nummer kaufen, Geo-Permissions NL und DE, in ElevenLabs importieren. Phone-Number-ID in den Gruppenchat
- [ ] **Markenstimme** mit Voice Design, in Englisch, Deutsch, Französisch anhören
- [ ] **3 Agents** anlegen, genau wie in CLAUDE.md 5.4 und 7.3 (Namen, Variablen, Client-Tools, Sprachen, Overrides, öffentlich, KI-Hinweis). Prompts als Kopie in `prompts/`
- [ ] Jeden Agent im ElevenLabs-Testfenster durchsprechen
- [ ] Agent-IDs in den Gruppenchat (spätestens 19:00)
- [ ] Schadensfoto besorgen (selbst fotografieren oder mit GPT-Image erzeugen)

**19:00 bis 19:45 Zusammenstecken 1** (Daniel spielen)

**19:45 bis 22:00 allein**
- [ ] `docs/connector-spec.md` (Pflichtabgabe B): die 4 Blöcke, beide Beispiele (Installateur und RheinNet liegen schon im Repo), "was bekommt der Partner, was bekommen wir zurück"
- [ ] `docs/rheinnet_website.txt`: kurze Webseite des fiktiven Anbieters (Tarife, was sie für eine Bestellung brauchen)
- [ ] **Drehbuch** mit Text jeder Szene (inklusive Freigabe durch die Hausverwaltung) und Antwort-Notizen für Emil (Herr Krüger) und Philipp (Installateur)

**22:00 bis 24:00** Zusammenstecken 2, danach Gate 1 abnehmen, funktionierende Teile als Rohaufnahme sichern

**00:00 bis 01:30**
- [ ] Lucas' Anruf auf Französisch testen (dein Handy)
- [ ] Kostenrechnung mit echten Zahlen: pro Fall, pro Wohnung und Monat, 100.000 Wohnungen
- [ ] **Schlafen 01:30 bis 03:00**

**03:00 bis 05:00**
- [ ] Freeze abnehmen
- [ ] Schnitt vorbereiten: Titel- und Kapitelkarten (die 4 reltix-Schritte), Labels, Untertitel-Texte
- [ ] README-Text "Was ist Dirigent"

**05:00 bis 10:00**
- [ ] Regie beim Dreh, Daniel (Laptop) und Lucas (Handy) spielen
- [ ] 07:30 bis 09:30 Video schneiden, unter 2:30
- [ ] 09:30 bis 10:00 hochladen: Video + Zip von Emil + GitHub-Link

---

## Emil: Server

**15:30 bis 16:00 Setup**
- [ ] Next.js-Projekt anlegen: `npx create-next-app@latest dirigent --ts --app --eslint` (Standardantworten)
- [ ] **Inhalt des Teampakets** hineinkopieren (bei doppelten Dateien gewinnt unsere, bei `.gitignore` unsere Zeilen anhängen)
- [ ] Alle Pakete auf einmal: `npm install openai ajv @elevenlabs/react`
- [ ] GitHub-Repo `dirigent` (privat), pushen, Julian und Philipp einladen
- [ ] `.env.example` kopieren nach `.env.local`, Keys eintragen, `CALLS_DRY_RUN=true`

**16:00 bis 19:00 allein** (Test: curl-Befehle aus `docs/LOKAL_TESTEN.md`)
- [ ] `lib/store.ts`, `GET /api/state`, `POST /api/reset`
- [ ] `lib/building.ts` mit `findAffectedUnits`
- [ ] `POST /api/cases` + `lib/dirigent.ts` (Responses API, Tools aus CLAUDE.md 7.1)
- [ ] `lib/calls.ts` im Testmodus
- [ ] `POST /api/cases/[id]/photo` + `GET /api/uploads/[file]`
- [ ] Bis 19:00 in `main` mergen

**19:00 bis 19:45 Zusammenstecken 1**

**19:45 bis 22:00 allein**
- [ ] `lib/calls.ts` echt: ElevenLabs-Outbound über Twilio, Gespräch alle 5 s abfragen, `call_ended`
- [ ] `lib/contextPass.ts`, Vorschlag `partner_job_proposed` + Status `pending_approval`
- [ ] `POST /api/cases/[id]/approve` (gibt den Auftrag genau einmal frei) + `GET /api/partner-job` (vor der Freigabe Fehler)
- [ ] `POST /api/cases/[id]/slot` und `POST /api/cases/[id]/result` (Wartungsprotokoll, Status, Nachrichten)

**22:00 bis 24:00** Zusammenstecken 2 (Herrn Krüger am Handy spielen), Gate 1

**00:00 bis 03:00 allein**
- [ ] `lib/connectors.ts` + `POST /api/events` (Einzug → `order` + Anruf an Lucas)
- [ ] `POST /api/connectors/draft` (gegen `connectors/schema.json` prüfen) + `POST /api/connectors/activate`
- [ ] `lib/cost.ts` → `cost`-Event
- [ ] 03:00 bis 03:30 Fehler beheben, alles in `main`
- [ ] **Schlafen 03:30 bis 05:00**

**05:00 bis 09:15**
- [ ] Dreh: Herrn Krüger spielen, Fehler sofort beheben
- [ ] README Technikteil, Key-Check, **Zip bis 09:15 an Julian** (CLAUDE.md 12)

---

## Philipp: Bildschirme

**15:30 bis 16:00 Setup**
- [ ] Programme installieren nach `docs/LOKAL_TESTEN.md` Teil 1
- [ ] Apple Design Resources: iOS-Design-Vorlage als Referenz öffnen (Farben und Regeln in CLAUDE.md 6)
- [ ] Sobald Emil das Repo hat: klonen, eigener Branch, `.env.local` mit `NEXT_PUBLIC_MOCK=true`

**16:00 bis 19:00 allein** (Test: Mock-Modus spielt die ganze Demo ab)
- [ ] `client/state.ts`: Mock-Abspieler für `fixtures/demo-events.json` + echtes Abfragen von `GET /api/state`
- [ ] `/dashboard`: Haus-SVG, Farben nach Ereignissen, Seitenleiste mit Dirigent-Schritten, Outbox, Knopf "Reset demo"
- [ ] Freigabe-Karte der Hausverwaltung: Installateur, Umfang, geteilte Felder, Knopf **"Approve and send"** (Mock hält dort an)
- [ ] `/tenant/[unit]`: Gespräch mit `tenant_intake` (`@elevenlabs/react`, Client-Tool `create_case`), im Mock-Modus Knopf "Simulate call", Foto-Knopf
- [ ] Bis 19:00 in `main` mergen

**19:00 bis 19:45 Zusammenstecken 1** (Mock aus)

**19:45 bis 22:00 allein**
- [ ] Wasser-Animation die Steigleitung hinunter
- [ ] `/partner/[case]`: Auftragskarte, Knöpfe "Incoming job" und "Report done" (`partner_call` mit Client-Tools `confirm_slot`, `report_result`)
- [ ] `/track/[case]`: Timeline im iPhone-Stil

**22:00 bis 24:00** Zusammenstecken 2 (Installateur spielen), Gate 1

**00:00 bis 03:00 allein**
- [ ] Connector-Bildschirm: Textfeld → Draft → JSON → Activate → Knopf "Lucas zieht in 4.2 ein"
- [ ] Kostenzähler
- [ ] Kontext-Panel: geteilt und zurückgehalten nebeneinander, zurückgehalten verschwommen
- [ ] 03:00 bis 03:30 Fehler beheben, alles in `main`
- [ ] **Schlafen 03:30 bis 05:00**

**05:00 bis 09:30**
- [ ] Bildschirmaufnahmen aller Szenen, Installateur spielen, Rohaufnahmen bis 07:30 an Julian
- [ ] Screenshots für die README, Julian beim Untertiteln helfen

---

## Das Einzige, was zwischen euch fließen muss

| Was | Von | An | Wann |
|---|---|---|---|
| Repo-Einladung | Emil | Julian, Philipp | 16:00 |
| Keys, Twilio-Phone-Number-ID, Agent-IDs | Julian | alle (Gruppenchat) | IDs spätestens 19:00 |
| Code in `main` | Emil, Philipp | alle | 19:00 |
| Drehbuch + Antwort-Notizen | Julian | Emil, Philipp | 22:00 |
| Rohaufnahmen | Philipp | Julian | 07:30 |
| Code-Zip | Emil | Julian | 09:15 |

Alles andere läuft über die festen Schnittstellen. Wenn jemand meint, eine Schnittstelle ändern zu müssen: 2 Minuten mit allen abstimmen, zuerst in `CLAUDE.md` ändern, dann im Code.
