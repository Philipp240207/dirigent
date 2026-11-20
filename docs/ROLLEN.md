# Rollen, Aufgaben und Zeitplan (Stand 20:00)

Technik steht in `CLAUDE.md`. Hier steht nur: **wer, was, bis wann.**

**Neu nach dem Gespräch mit reltix: weniger ist mehr.** Wir zeigen nur EINEN Fall, den Wasserschaden, und den perfekt mit allen Szenarien (Nachbar geht nicht ran → Nachricht → zweiter Anruf, Elektriker wird live angebunden, Freigabe, Hausmeister öffnet). Der Einzug mit Internet ist nur noch Stufe 3.

**Jeder arbeitet allein**, gegen die festen Schnittstellen in `CLAUDE.md` Abschnitt 5. Zusammengesteckt wird um **22:00** und **24:00**, danach immer, wenn ein Teil fertig ist.

---

## Zeitplan

| Zeit | Was |
|---|---|
| 19:20 bis 22:00 | Allein bauen (Listen unten) |
| **22:00 bis 22:30** | **Zusammenstecken auf dem Demo-Laptop:** echter Anruf auf Emils Handy (1. Mal nicht rangehen, 2. Mal rangehen), Freigabe, Installateur, "fertig, 340 €" |
| 22:30 bis 24:00 | Lücken schließen, jede Zeile der Szenario-Tabelle (CLAUDE.md Abschnitt 2) einmal testen |
| **24:00** | **Gate 1:** der ganze Fall ohne Elektriker 3-mal fehlerfrei |
| 00:00 bis 03:00 | Stufe 2: Elektriker live anbinden, Karte + Liste, Kostenzähler, Kontext-Panel |
| **03:00** | **Feature Freeze**, bis 03:30 Fehler beheben, alles in `main` |
| 01:30 bis 03:00 | Julian schläft |
| 03:30 bis 05:00 | Emil und Philipp schlafen, Julian ist wach |
| 05:00 bis 07:30 | Dreh auf dem Demo-Laptop (`RETRY_DELAY_MINUTES=1`) |
| 07:30 bis 09:30 | Schnitt, README, Zip |
| **bis 10:00** | **Hochgeladen** (Deadline 10:30) |

Team-Checks (max. 10 Minuten): **22:00, 24:00, 03:00, 07:30**. Wer 45 Minuten an einem Fehler hängt, meldet sich sofort.

---

## Julian

**bis 20:00**
- [ ] Die 3 Agents fertig einrichten (Dateien in `prompts/`), System-Tools: **Anruf beenden** bei allen, **Spracherkennung** bei `tenant_intake`, **Mailbox-Erkennung** (Voicemail detection) bei `resident_call`
- [ ] Agent-IDs und die IDs der 3 Stimmen in den Gruppenchat
- [ ] Prompts committen (Branch `julian/prompts`)
- [ ] Geänderten Text aus `prompts/tenant_intake.md` in den Agent im ElevenLabs-Dashboard kopieren (Schritt 3 neu: das Wasser am Strang wird abgestellt; zwei neue Regeln unten: Fallback bei Tool-Fehler, Sprachwechsel)

**bis 22:00**
- [ ] `docs/connector-spec.md` (Pflichtabgabe B): die 4 Blöcke, Beispiele Installateur und Elektriker, dazu der ISP als drittes Beispiel (`mode: sell`), "was bekommt der Partner, was bekommen wir zurück", ein Satz zu `detect.conditions` (das Modell prüft die Bedingung und schreibt das Ergebnis ins Reasoning)
- [ ] `docs/elektro_schmitz_website.txt`: kurze Webseite des fiktiven Elektrikers (Leistungen, Notdienst, was sie für einen Auftrag brauchen)
- [ ] `data/portfolio.json` und den Hausmeister in `data/building.json` prüfen; `data/building.json` ist korrigiert (Elektriker darf Daniels und Krügers Verfügbarkeit sehen, Elektro Schmitz ist aus `providers` raus, neue Regel "Wasser abstellen")
- [ ] **Drehbuch** mit allen Szenen aus CLAUDE.md Abschnitt 10, Antwort-Notizen für Emil (1. Anruf: ablehnen; 2. Anruf: "Ja, ich sehe einen nassen Fleck an der Decke im Wohnzimmer"; Extra-Take: "Nein, hier ist alles trocken") und Philipp (Installateur und Elektriker). Kernsatz im Video: **"Herr Krueger never called us. We called him."**, dazu der 3-Sekunden-Take **"And if he says no?"** (2.1 wird grün)
- [ ] Schadensfoto: Wasserfleck an der Decke **neben einer Deckenlampe** (selbst fotografieren oder GPT-Image)

**22:00 bis 01:30:** Zusammenstecken (du spielst Daniel), Gate 1 abnehmen, Rohaufnahmen sichern, Kostenrechnung mit echten Zahlen. **Schlafen 01:30 bis 03:00.**
**03:00 bis 05:00:** Freeze abnehmen, Titel- und Kapitelkarten, Untertitel-Texte, README-Text mit kleiner Tabelle "echt / simuliert" (CLAUDE.md Abschnitt 12). Demo-Laptop: `DEMO_NOW=2026-11-20T13:40:00+01:00` in `.env.local`, Dreh mit `npm run build && npm start`.
**05:00 bis 10:00:** Regie beim Dreh, Schnitt (unter 2:30), hochladen.

---

## Emil

**bis 22:00**
- [ ] Zustand und Timer an `globalThis` hängen (`lib/store.ts`), sonst fällt der zweite Anruf nach jedem Speichern weg
- [ ] `lib/clock.ts` mit `now()` (Demo-Uhr `DEMO_NOW`), überall für `at` und `created_at` benutzen
- [ ] `findAffectedUnits`: 4.1 = `source`, 2.1 = `high`, 1.1 und Keller = `check` (deine Logik "Nachricht an 4.1" passt genau); gibt auch den Strang zurück (`id`, `main_valve`, `units`)
- [ ] **Wasser abstellen:** Nachricht an den Hausmeister (Ventil Strang A, Ort aus `main_valve`) und an alle vier Wohnungen am Strang; nach dem Ergebnis des Installateurs "Wasser läuft wieder". Wenn es zeitlich eng wird: erst nach Gate 1
- [ ] Anruf-Ergebnis: Transkript abfragen, GPT-6 Luna liest `damage_found`, `affected` `confirmed` oder `clear`
- [ ] **Nicht rangegangen / Mailbox** → Nachricht, `call_retry_scheduled` (`at` immer als ISO-Zeit), zweiter Versuch nach `RETRY_DELAY_MINUTES`, nach dem letzten Fehlversuch Nachricht an den Hausmeister. Im Testmodus: 1. Versuch nicht rangegangen, 2. Versuch rangegangen mit Schaden
- [ ] Freigabe **pro Partner**: `POST /api/cases/[id]/approve` mit `partner_id`, `partner-job`, `slot` und `result` ebenfalls mit `partner_id`. `partner_job_proposed` neu schreiben, wenn Foto oder bestätigte Wohnung dazukommt (nach der Freigabe stattdessen `message` an den Partner)
- [ ] Hausmeister-Kontakt im Kontext-Pass, Schlüsseltresor-Code nie. Kontext-Pass als Positivliste (nur was erlaubt ist, geht raus); das Modell bekommt das Gebäude ohne `providers`
- [ ] curl-Tests in `docs/LOKAL_TESTEN.md` laufen alle

**22:00 bis 03:00:** Zusammenstecken (Herrn Krüger spielen: 1. Anruf **ablehnen** statt klingeln lassen und prüfen, welchen Status die API dann meldet; 2. Anruf rangehen), Gate 1, dann Stufe 2: Elektriker (Foto mit `electrics: true` → Vorschlag Rolle `electrician`, `connectors/activate` mit `case_id`), `lib/cost.ts`, `tool` im `reasoning`-Ereignis mitschicken. **Schlafen 03:30 bis 05:00.**
**05:00 bis 09:15:** Dreh, Fehler beheben, README Technikteil, Key-Check, **Zip bis 09:15**.

---

## Philipp

**bis 22:00**
- [ ] Haus-Querschnitt mit den neuen Farben: gemeldet / bestätigt rot, `high` orange, `source` gelb, `check` grau umrandet (jetzt auch 1.1), `clear` grün
- [ ] Timeline mit Anrufversuchen: "nicht erreicht", "erneuter Anruf um ..." (aus der ISO-Zeit in `at`), Antwort des Nachbarn. Alle Uhrzeiten aus den Ereignissen, nie aus der Browser-Uhr (Mock-Modus: 13:40:00 + `at_s`)
- [ ] **Freigabe-Karte pro Partner** (Umfang, geteilte Felder, zurückgehaltene verschwommen, **Approve and send**); zeigt pro Partner immer den **neuesten** `partner_job_proposed`
- [ ] `/partner/[case]?partner=...` für Installateur und Elektriker, `/track/[case]` im Paketverfolgungs-Stil
- [ ] Mock-Modus mit den neuen Testdaten (`fixtures/demo-events.json`: jetzt mit Ventil-Nachrichten, 1.1 und zweitem Installateur-Vorschlag)

**22:00 bis 03:00:** Zusammenstecken (Installateur spielen), Gate 1, dann Stufe 2: **Karte von Düsseldorf + Häuserliste** (`data/portfolio.json`, gezeichnete SVG-Karte, kein Kartendienst), Connector-Bildschirm "Elektriker anbinden" (drei Prüfhaken nach "Draft", drei Connector-Karten: Installateur, Elektriker, ISP), Kostenzähler mit Zähler "Touchpoints handled / Manager clicks", Kontext-Panel, Tool-Chips im Reasoning-Stream. **Schlafen 03:30 bis 05:00.**
**05:00 bis 09:30:** Bildschirmaufnahmen, Installateur und Elektriker spielen, Screenshots für die README.

---

## Was zwischen euch fließen muss

| Was | Von | An | Wann |
|---|---|---|---|
| Agent-IDs + Stimmen-IDs | Julian | alle | 20:00 |
| Code in `main` | Emil, Philipp | alle | 22:00 |
| Drehbuch + Antwort-Notizen | Julian | Emil, Philipp | 22:00 |
| Elektriker-Webseitentext | Julian | Emil, Philipp | 22:00 |
| Rohaufnahmen | Philipp | Julian | 07:30 |
| Code-Zip | Emil | Julian | 09:15 |
