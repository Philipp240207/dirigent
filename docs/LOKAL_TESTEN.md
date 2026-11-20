# Lokal testen: Anleitung für Einsteiger

Die App läuft nur auf unseren Laptops, ohne Hosting. Jeder kann sie auf seinem eigenen Laptop starten und seinen Teil allein testen.
Geschrieben für Mac. Windows-Unterschiede stehen dabei.

---

## Teil 1: Einmalig einrichten (ca. 20 Minuten)

| Was | Wofür | Wie |
|---|---|---|
| **Node.js (LTS)** | lässt die App laufen | nodejs.org → Button "LTS" → Installer |
| **Git** | Versionen | Mac: Terminal → `xcode-select --install`. Windows: git-scm.com |
| **GitHub Desktop** | Branch, Commit, Push per Klick | desktop.github.com, mit GitHub-Account anmelden |
| **VS Code** | Dateien ansehen | code.visualstudio.com |
| **Codex oder Claude Code** | baut und testet für uns | liest automatisch `AGENTS.md` bzw. `CLAUDE.md` im Repo |

Prüfen im Terminal (Mac: Cmd + Leertaste → "Terminal"):
```
node -v
git --version
```
Beide zeigen eine Versionsnummer. Sonst Terminal neu öffnen.

**Repo holen:** GitHub Desktop → File → Clone Repository → `dirigent` → Clone. Dann **Repository → Open in Terminal**. Alle Befehle unten in dieses Fenster.

**Keys eintragen:**
```
cp .env.example .env.local
```
(Windows: `copy .env.example .env.local`). `.env.local` in VS Code öffnen, Werte aus dem Gruppenchat eintragen, speichern.
- **Philipp** am Anfang: `NEXT_PUBLIC_MOCK=true`
- **Alle** außer auf dem Demo-Laptop: `CALLS_DRY_RUN=true`

`.env.local` darf **nie** in GitHub Desktop als Änderung auftauchen. Wenn doch: sofort Bescheid sagen.

**Pakete installieren:**
```
npm install
```
Wiederholen, wenn jemand neue Pakete hinzugefügt hat oder "Cannot find module" erscheint.

---

## Teil 2: Starten

```
npm run dev
```
Warten auf `Ready` und `http://localhost:3000`. Fenster offen lassen. Beenden mit **Ctrl + C**.

| Adresse | Was |
|---|---|
| http://localhost:3000/dashboard | Haus, Dirigent-Schritte, Outbox, Kosten, Connector-Bildschirm |
| http://localhost:3000/tenant/3.1 | Daniel meldet den Schaden (Mikrofon erlauben) |
| http://localhost:3000/partner/CASE_ID?partner=plumber_krause | Installateur-Ansicht (Link im Dashboard) |
| http://localhost:3000/track/CASE_ID | Tracking-Seite (Link im Dashboard) |

**Immer `localhost` benutzen**, sonst blockiert der Browser das Mikrofon.

---

## Teil 3: Wer testet wie

| Person | Einstellung | Test |
|---|---|---|
| Philipp | `NEXT_PUBLIC_MOCK=true` | Dashboard öffnen: der ganze Wasserschaden-Fall spielt sich mit Testdaten ab und hält bei der Freigabe an, bis du "Approve and send" klickst. Keine Keys, kein Server nötig |
| Emil | `CALLS_DRY_RUN=true` | curl-Befehle aus Teil 4, Ergebnis mit `curl http://localhost:3000/api/state` prüfen |
| Julian | keine | Agents im ElevenLabs-Testfenster. Client-Tools funktionieren erst beim Zusammenstecken |
| Alle zusammen (22:00, 24:00) | Demo-Laptop, `NEXT_PUBLIC_MOCK=false`, ab 22:00 `CALLS_DRY_RUN=false` | ganzer Ablauf mit echten Stimmen |

**Tracking-Seite auf einem echten Handy:** Handy im selben WLAN, im Browser `http://IP-DES-LAPTOPS:3000/track/CASE_ID` öffnen (IP am Mac: Systemeinstellungen → WLAN → Details). Wenn das Hackathon-WLAN das blockiert: in Chrome auf dem Laptop Rechtsklick → Untersuchen → Handy-Symbol (iPhone-Rahmen) und so aufnehmen.

---

## Teil 4: curl-Tests (Emil, und alle zur Kontrolle)

Zweites Terminal-Fenster öffnen (die App läuft im ersten weiter). Windows: in **Git Bash**. Für schnelle Tests in `.env.local`: `RETRY_DELAY_MINUTES=1`, `CALLS_DRY_RUN=true`.

**0. Alles zurücksetzen**
```
curl -X POST http://localhost:3000/api/reset
```

**1. Wasserschaden in 3.1 melden**
```
curl -X POST http://localhost:3000/api/cases \
  -H "Content-Type: application/json" \
  -d '{"unit_id":"3.1","description":"Water is dripping from the living-room ceiling next to the ceiling lamp","tenant_language":"en"}'
```
Erwartet: sofort `{"case_id":"..."}` (kopieren). In `/api/state` nach wenigen Sekunden: `affected` 4.1 `source`, 2.1 `high`, cellar `check`; `message` an t41; `call_started` an t21 (attempt 1); `call_ended` mit `outcome: "no_answer"`; `message` an t21; `call_retry_scheduled`; `partner_job_proposed` für `plumber_krause`; Status `pending_approval`.

**2. Zweiter Anruf** (nach `RETRY_DELAY_MINUTES`, also 1 Minute warten)
```
curl http://localhost:3000/api/state
```
Erwartet: `call_started` attempt 2, `call_ended` mit `outcome: "answered"` und `damage_found: true`, `affected` 2.1 `confirmed`.

**3. Foto hochladen** (Pfad anpassen)
```
curl -X POST http://localhost:3000/api/cases/CASE_ID/photo -F "file=@/Users/NAME/Desktop/ceiling.jpg"
```
Erwartet: `assessment` mit `severity`. Wenn das Foto eine Lampe neben dem Wasser zeigt: `electrics: true` und ein `reasoning` "No electrician connected yet".

**3b. Hausmeister hat das Ventil geschlossen** (Wasser aus)
```
curl -X POST http://localhost:3000/api/cases/CASE_ID/water-status \
  -H "Content-Type: application/json" -d '{"status":"off"}'
```
Erwartet: `water_status_confirmed` mit `status: "off"` und eine Nachricht an jede Wohnung am Strang A (t41, t31, t21, t11). Noch einmal `restored` an dieser Stelle schicken: `409`, weil der Installateur noch nicht fertig ist.

**4. Vor der Freigabe sieht der Installateur nichts**
```
curl -i "http://localhost:3000/api/partner-job?case_id=CASE_ID&partner_id=plumber_krause"
```
Erwartet: Fehler (z. B. `403`).

**5. Freigabe ("Approve and send")**
```
curl -X POST http://localhost:3000/api/cases/CASE_ID/approve \
  -H "Content-Type: application/json" -d '{"partner_id":"plumber_krause"}'
```
Erwartet: `partner_job_approved`, `partner_job`, Status `dispatched`. Ein zweites Mal ausführen: **kein** zweites `partner_job`.

**6. Auftrag für den Installateur**
```
curl "http://localhost:3000/api/partner-job?case_id=CASE_ID&partner_id=plumber_krause"
```
Erwartet: `shared` mit Adresse, Hausmeister-Kontakt, betroffenen Wohnungen (2.1 bestätigt). `withheld` enthält `rent_arrears_eur` und `key_safe`.

**7. Termin bestätigen**
```
curl -X POST http://localhost:3000/api/cases/CASE_ID/slot \
  -H "Content-Type: application/json" -d '{"partner_id":"plumber_krause","slot":"16:00"}'
```
Erwartet: Nachrichten an t31, t21 und `caretaker`.

**8. "Fertig, 340 €"**
```
curl -X POST http://localhost:3000/api/cases/CASE_ID/result \
  -H "Content-Type: application/json" \
  -d '{"partner_id":"plumber_krause","cost_eur":340,"work_description":"Replaced a leaking pipe joint on riser A. 2.1 ceiling dried, cellar dry."}'
```
Erwartet: `maintenance_log`. Wenn kein weiterer Partner offen ist: Status `resolved`, Nachricht an `owner`, `cost`.

**8b. Wasser wieder an**
```
curl -X POST http://localhost:3000/api/cases/CASE_ID/water-status \
  -H "Content-Type: application/json" -d '{"status":"restored"}'
```
Erwartet: `water_status_confirmed` mit `status: "restored"` und "The water on your riser is back on." an jede Wohnung am Strang A.

**9. Elektriker live anbinden (Stufe 2)**
```
curl -X POST http://localhost:3000/api/connectors/draft \
  -H "Content-Type: application/json" \
  -d '{"partner_text":"Elektro Schmitz, Duesseldorf. Electrical repairs and emergency service. For a job we need the address, the flat, a photo of the problem and who opens the door."}'
```
Erwartet: `connector` mit `role: "electrician"`, gültig gegen `connectors/schema.json`. Dann aktivieren, mit dem Fall:
```
curl -X POST http://localhost:3000/api/connectors/activate \
  -H "Content-Type: application/json" -d '{"connector": HIER_DAS_JSON_VON_OBEN, "case_id":"CASE_ID"}'
```
Erwartet: `connector_activated` und `partner_job_proposed` für den Elektriker. Danach Schritte 5 bis 8 mit dessen `partner_id`.

Regel für Codex und Claude: Jede neue API-Route bekommt hier einen Test.

---

## Teil 5: Von deinem Laptop nach GitHub (GitHub Desktop)

1. Oben "Current Branch" → **New Branch** → z. B. `philipp/dashboard`. Nie direkt auf `main`.
2. Codex/Claude ändert und testet (`npm run build` ohne Fehler, `npm run dev`, durchklicken, curl-Tests).
3. Selbst kurz durchklicken.
4. Unten links kurze Beschreibung → **Commit**.
5. **Push origin**.
6. **Create Pull Request** → auf GitHub schaut ein anderer kurz drauf → **Merge**.
7. Die anderen holen sich den neuen Stand: **Fetch origin** → **Pull**, auf dem eigenen Branch **Branch → Update from main**, dann `npm install`.

---

## Teil 6: Wenn etwas nicht geht

| Problem | Lösung |
|---|---|
| `Cannot find module` | `npm install` |
| `Port 3000 is in use` | anderes Terminal mit `npm run dev` schließen |
| Key fehlt, `401`, `undefined` | `.env.local` prüfen, dann `npm run dev` mit Ctrl + C stoppen und neu starten |
| Variable im Browser leer | Sie braucht den Präfix `NEXT_PUBLIC_` |
| Agent hört mich nicht | Adresse muss `localhost` sein. Chrome: Schloss links neben der Adresse → Mikrofon erlauben. Zoom/FaceTime schließen |
| Agent ruft ein Tool auf, nichts passiert | Name und Parameter im ElevenLabs-Dashboard müssen genau wie in CLAUDE.md 5.4 sein, Typ "Client" |
| Kein echter Anruf | `CALLS_DRY_RUN=false`? Twilio-Nummer in ElevenLabs dem Agent `resident_call` zugewiesen? Geo-Permissions NL/DE an? |
| Zweiter Anruf kommt nie, oder Seiten zeigen verschiedene Stände | Zustand und Timer müssen an `globalThis` hängen (CLAUDE.md 7.1). Für den Dreh: `npm run build`, dann `npm start` statt `npm run dev` |
| Uhrzeiten auf dem Bildschirm stimmen nicht | `DEMO_NOW` in `.env.local` gesetzt? Neu starten, dann "Reset demo" |
| Alte Daten im Dashboard | Knopf "Reset demo" oder curl-Test 0 |
| Merge-Konflikt | Codex/Claude: "Erklär mir diesen Konflikt und löse ihn so, dass beide Änderungen erhalten bleiben" |

Bei jedem Fehler: kompletten Text aus Terminal oder Browser-Konsole (Rechtsklick → Untersuchen → Console) an Codex/Claude geben: "Erklär mir in einfachen Worten, was kaputt ist, und behebe es." Nach zwei gescheiterten Versuchen: stoppen, Team Bescheid sagen.
