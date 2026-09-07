# Schrottplatz-App v2

Neuaufbau der Schrottplatz-App nach der Analyse vom 02.09.2026. Der Prototyp unter `../prototype/` bleibt unverändert und dient als Referenz.

| Ordner / Datei | Inhalt |
|---|---|
| `CLAUDE.md` | Projektregeln — liest Claude in jeder Sitzung |
| `docs/00_Analysebericht.md` | **Hier anfangen.** Zusammenfassung der vier Reviews, Befunde, Entscheidungen |
| `docs/01_GDD_v2.md` | Schlankes Game Design Document (Ziel, Tage, Aufträge, Ausbau, Wirtschaft, MVP) |
| `docs/02_Architektur_v2.md` | Bauanleitung: Schichten, Systeme, Events, Level-JSON, Tests, Migrationsstufen, Unity-Spur |
| `docs/03_Roadmap.md` | Phasen, Meilensteine, Go/No-Go-Tor Web vs. Unity |
| `docs/04_Stilguide_und_Touch.md` | Palette, Formsprache, Kamera, Touch-Layout, Assets, iPhone-Safari |
| `docs/05_Portierungsliste.md` | Was aus dem Prototyp übernommen, neu geschnitten oder neu gebaut wird |
| `docs/06_Prompt-Vorlagen.md` | Wie man die Agents anspricht |
| `docs/analyse/` | Die vier vollständigen Einzelbefunde (Architect, QA, Game Design, UX/Art) |
| `docs/messungen/` | Jede Messung mit Datum, Gerät, Zahlen |
| `docs/spezifikationen/` | Feature-Spezifikationen des game-designer |
| `docs/entscheidungen.md` | Entscheidungslog (wird mit dem ersten Architekturschritt angelegt) |
| `.claude/agents/` | Sechs Agent-Rollen |
| `tools/qa/` | Messskripte des QA-Reviews (Playwright/Node), wiederverwendbar |
| `web/` | Spur A — Neustrukturierung in TypeScript/Three.js/Rapier (noch leer) |
| `unity/` | Spur B — Unity-Vergleichsprototyp, Timebox 2 Wochen (noch leer) |

Erster Schritt: `docs/03_Roadmap.md` Phase 0 — den Prototyp auf dem iPhone in Safari messen. Dann `docs/06_Prompt-Vorlagen.md` Vorlage 1.
