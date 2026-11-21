# Drehbuch Demo-Video (max. 2:30)

Stand 00:45. Englisches Video, deutsche Gespräche mit englischen Untertiteln. Kapitel = reltix' 4 Schritte. Nur echtes System, nichts nachgestellt.

## Rollen

| Figur | Wer | Wo |
|---|---|---|
| Daniel Brooks, Mieter 3.1 (Englisch) | Julian | Mieter-Seite im Browser, Philipps Laptop |
| Herr Krüger, Nachbar 2.1 (Deutsch) | Emil | echter Anruf auf Emils Handy |
| Klempner Krause (Deutsch) | Philipp | echter Anruf auf Philipps Handy |
| Hausverwalter | wer gerade frei ist | Dashboard, nur Klicks |
| Voice-over (Englisch) | Julian | wird am Ende drübergelegt |

## Vor jedem Take

- Philipps Laptop: `npm run build && npm start`, `.env.local` mit `DEMO_NOW=2026-11-20T13:40:00+01:00`, `CALLS_DRY_RUN=false`, Retry 10 Sekunden
- Dashboard: **Reset demo**
- Laptop: Mitteilungen aus (Fokus "Nicht stören"), Browser-Zoom 110 %, keine Tabs mit Keys, Twilio oder `.env.local` sichtbar
- Handys von Emil und Philipp: "Nicht stören" **aus**, laut, Mailbox bei Emil aus
- **Kontakt anlegen**, damit beim Klingeln ein Name statt einer echten Nummer erscheint: bei Emil Philipps Nummer als "Hausverwaltung Kaiserswerther Str.", bei Philipp Julians Nummer als "Hausverwaltung Kaiserswerther Str."
- Ton der Anrufe: ElevenLabs speichert jedes Gespräch als Audio (Konversationen → Gespräch → Download). Das ist der saubere Ton für den Schnitt. Zusätzlich filmt ein zweites Handy das klingelnde Handy (nur Bild).

## Szenen

| Zeit | Kapitel | Bild | Ton / Text |
|---|---|---|---|
| 0:00 bis 0:08 | Hook | Karte Düsseldorf, 8 Häuser ruhig, Kaiserswerther Str. 12 wird rot und pulsiert | Titel: **"1 report instead of 12 calls."** |
| 0:08 bis 0:28 | 1. DETECT THE MOMENT | Mieter-Seite, Daniel spricht (gekürzt), dann Foto-Upload. Schnitt auf Querschnitt: 3.1 rot, 4.1 gelb, 2.1 orange, Keller grau, Reasoning-Chips | Daniel (siehe unten). Label: "ElevenLabs Agent", "GPT-6 Sol reads the building" |
| 0:28 bis 0:55 | Kernmoment | Emils Handy klingelt, er lehnt ab → Outbox: Nachricht an Krüger → Timeline "Retry at 13:42" → Handy klingelt wieder, Emil geht ran, Split-Screen | Einblendung: **"Herr Krüger never called us. We called him."** Gespräch auf Deutsch, englische Untertitel. 2.1 wird rot |
| 0:55 bis 1:15 | 2. HAND OVER CONTEXT | Freigabe-Karte: geteilte Felder, Miete und Tresor-Code verschwommen, Zeile "Caretaker: shut off water in 3.1, 2.1". Klick **Approve and send** | Voice-over: "The plumber gets what he needs. Nothing else." |
| 1:15 bis 1:40 | 3. HOLD THE CONVERSATION | Philipps Handy klingelt, Split-Screen. Danach Dashboard: Termin "tomorrow 14:00", Outbox: Nachrichten an Daniel, Krüger, Hausmeister | Gespräch auf Deutsch, Untertitel. Label: "Twilio call, ElevenLabs Agent" |
| 1:40 bis 1:55 | Stufe 2 (nur wenn fertig) | Foto zeigt Lampe → "No electrician connected yet" → Website-Text von Elektro Schmitz einfügen → Connector → **Activate** | Voice-over: "Every new partner is a config, not a project." |
| 1:55 bis 2:10 | 4. CLOSE THE LOOP | Report-Anruf (kurz), "340 EUR", Fall wird grün, Wartungsbuch, Tracking-Seite auf dem Handy, Nachricht "water is back on" | Untertitel für den Anruf |
| 2:10 bis 2:22 | Wirkung | Zähler: ca. 20 Touchpoints, 3 Klicks. Kosten: ca. 1 EUR statt 5 Stunden / 235 EUR | Voice-over: "About one euro instead of five hours. Across 100,000 flats, that is 750,000 staff hours a year." |
| 2:22 bis 2:30 | Outro | Logo-Karte "Dirigent for centrix", "Built with OpenAI and ElevenLabs", Namen | Roadmap-Zeile: "Next: WhatsApp, more partners." |

Ohne Stufe 2 (Elektriker) verschiebt sich alles ab 1:40 um 15 Sekunden nach vorn. Echte Gespräche dauern 1 bis 2 Minuten: Schlüsselsätze zeigen, den Rest schneiden oder beschleunigen.

## Sätze

### Julian als Daniel (Englisch, Mieter-Seite)
1. "Hi, I have a water leak in my flat, unfortunately."
2. (Wo?) "It's coming through the living room ceiling, right next to the lamp."
3. (Elektrik?) "Yes, it's right next to the ceiling lamp."
4. (nach "caretaker shuts off the water, a tradesperson is being arranged", Foto-Bitte) "Okay, I'll upload a photo now."
5. (Noch etwas?) "No, that's all. Thank you!" → "Bye!" → **End call** klicken, Foto hochladen

### Emil als Herr Krüger (Deutsch, Handy)
- 1. Anruf: **ablehnen**
- 2. Anruf: rangehen, "Hallo, Krüger?"
- (Wasserschaden oben, sehen Sie etwas?) "Moment, ich schaue kurz nach." … "Ja, tatsächlich, an der Decke im Wohnzimmer ist ein nasser Fleck."
- (Wo genau?) "Über der Lampe, in der Ecke."
- (Hausmeister stellt auch bei Ihnen ab, Installateur wird organisiert, noch etwas?) "Nein, danke."
- "Tschüss." (Agent legt auf)
- Extra-Take, 3 Sekunden, für "And if he says no?": "Nein, bei mir ist alles trocken." → 2.1 wird grün

### Philipp als Klempner Krause (Deutsch, Handy)
Termin-Anruf:
- "Ja, hallo, Krause hier."
- (Agent erklärt) "Okay, verstehe."
- (Wann frühestens, heute?) "Heute schaffe ich es leider nicht mehr. Morgen um 14 Uhr könnte ich kommen."
- (Hausmeister öffnet) "Alles klar, passt." → "Tschüss."

Report-Anruf:
- "Ja, hallo, Krause hier."
- (Was gemacht?) "Die Leitung im Bad war undicht, die habe ich abgedichtet. Bei der Wohnung drunter habe ich auch geschaut, alles wieder dicht."
- (Kosten?) "340 Euro." → "Tschüss."

Elektriker (nur Stufe 2), gleicher Ablauf: "Schmitz hier." … "Ich komme morgen um 14 Uhr mit dem Installateur." … Report: "Lampe geprüft, getrocknet, alles sicher. 120 Euro."

## Einblendungen und Untertitel

- Kapitelkarten: "1. Detect the moment", "2. Hand over context", "3. Hold the conversation", "4. Close the loop"
- Technik-Labels, wenn etwas passiert: "ElevenLabs Agent (voice)", "Twilio outbound call", "GPT-6 Sol decides", "GPT-6 Luna reads the transcript", "GPT vision: water next to lamp"
- Retry-Label: "Retry after 60 min in production, 10 s for this demo"
- Untertitel nur für die deutschen Gespräche, englisch, maximal zwei Zeilen

## Nicht im Bild

API-Keys, `.env.local`, Twilio-Konsole, echte Handynummern, Julians Adresse aus dem Twilio-Profil.

## Ablauf der Nacht

| Zeit | Was |
|---|---|
| bis zum Dreh | neue Features erlaubt; Dreh startet, wenn der ganze Fall auf `main` 3-mal hintereinander durchläuft |
| 05:00 bis 07:30 | Dreh: jede Szene einzeln, nach jedem Take "Reset demo". Lieber 3 gute Takes pro Szene als ein langer |
| 07:30 bis 09:30 | Schnitt, Untertitel, Voice-over |
| bis 10:00 | Upload auf BuilderBase (Video + Zip + GitHub-Link) |
