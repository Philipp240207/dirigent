# Dirigent: Start hier

Hey Emil, hey Philipp, das ist unser komplettes Paket. **Jeder arbeitet allein**, zusammengesteckt wird nur um 19:00, 22:00 und 24:00.

## Was drin ist
| Datei | Wofür |
|---|---|
| `CLAUDE.md` | Der ganze Plan: Challenge, Produkt, feste Schnittstellen, Technik, Video, Regeln. Claude Code liest ihn automatisch |
| `AGENTS.md` | Verweist Codex auf `CLAUDE.md` |
| `docs/ROLLEN.md` | **Wer macht was bis wann** |
| `docs/LOKAL_TESTEN.md` | Installieren, starten, testen, nach GitHub bringen |
| `data/building.json` | Unser Gebäude (spielt centrix) |
| `connectors/` | Schema + fertiger Installateur-Connector |
| `docs/examples/isp_rheinnet.json` | Beispiel für den Live-Connector |
| `fixtures/demo-events.json` | Die ganze Demo als Testdaten (für Philipps Mock-Modus) |
| `.env.example` | Liste aller Keys, wird zu `.env.local` kopiert |
| `.gitignore` | Sorgt dafür, dass Keys und lokale Daten nie auf GitHub landen |

## Jetzt (15:30)
1. **Alle:** `docs/ROLLEN.md` lesen: eure eigene Liste und die Tabelle ganz unten.
2. **Emil:** Zuerst das Next.js-Projekt anlegen, dann den **kompletten Inhalt dieses Zips** hineinkopieren (Ordner so lassen), Pakete installieren, als privates Repo `dirigent` pushen, Julian und Philipp einladen. Genaue Schritte in `docs/ROLLEN.md`.
3. **Philipp:** Programme installieren (`docs/LOKAL_TESTEN.md` Teil 1), Apple-Design-Vorlage öffnen, dann im Mock-Modus loslegen.
4. **Julian:** Twilio, Markenstimme, Agents.

## Drei Regeln
- Nur Dateien in deinem eigenen Bereich ändern (`CLAUDE.md` Abschnitt 4).
- **24:00 Gate 1**, **03:00 Feature Freeze**.
- **Samstag bis 10:00 hochladen** (Video max. 2:30 + Code-Zip). Deadline 10:30.

Erster Satz an Codex oder Claude Code im Repo: "Lies CLAUDE.md und docs/ROLLEN.md. Ich bin [Name]. Was ist meine nächste Aufgabe?"
