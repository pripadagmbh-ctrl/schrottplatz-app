# Entscheidungslog v2

Jede Architektur- oder Design-Entscheidung mit Datum und Begründung, damit nichts zweimal diskutiert wird (CLAUDE.md). Neueste oben.

## 2026-09-07 — M0: Gerüst `v2/web`

| # | Entscheidung | Begründung | Alternative (verworfen) |
|---|---|---|---|
| E-007 | Deploy: Root-Workflow baut Prototyp (Root-URL) **und** v2 (`/v2/`) in ein Pages-Artefakt | Eine URL fürs iPad, Prototyp-Link bleibt gültig, kein zweites Repo (Rückfrage M0-1) | Eigenes Repo für v2 |
| E-006 | Sortierboxen im Bogen (Radius 8,5 m) um den Bagger statt in einer Nordreihe | Der Test `data.test.ts` hat gezeigt: 5 Mulden à 6 m in einer Reihe sind vom Zentrum nicht erreichbar (Reichweite ≈ 9,75 m). Mulden jetzt 4 × 2,4 m. Briefing Kap. 12 wird angepasst | Bagger fährt zwischen Boxen (widerspricht „alle Boxen ohne Fahren erreichbar") |
| E-005 | `@dimforge/rapier3d-compat` 0.20 für Browser **und** Node | Ein Paket, läuft in Vitest ohne WASM-Loader-Sonderfall; kostet ~0,6 MB JS (base64-WASM). Wechsel auf `rapier3d` + `vite-plugin-wasm` ist in M2 möglich, wenn die Sim-Tests stehen. Rapier 0.20 kennt `numAdditionalFrictionIterations` nicht mehr → `internalPgsIterations` | `rapier3d` (non-compat) sofort |
| E-004 | Playwright im Gerüst, aber nur Rauchtest (Seite lädt, Overlay zeigt fps, keine Konsolenfehler, ≤ 400 Draw Calls) | Werkzeugkette steht ab Tag 1; Layout-/Draw-Call-Tests kommen mit den Inhalten in M2/M3 (Rückfrage M0-2) | Playwright erst in M3 |
| E-003 | Alias `@/` → `src/`, `@data/` → `data/`; ESLint-Boundaries mit TypeScript-Resolver | Ohne Resolver sah das Boundaries-Plugin Alias-Importe nicht — der Schichtenverstoß `sim → view` blieb unerkannt. Bewiesen mit `_Verstoss.ts` (4 Fehler: three, sim→view, sim→app, window) | Relative Importe überall |
| E-002 | Alle Balancing-Zahlen in `data/balancing.json` mit `_src`-Herkunft; Systeme lesen nur daraus | CLAUDE.md Regel 3 („jede Zahl hat eine Herkunft") wird damit prüfbar; Lint warnt bei Nachkommazahlen in `sim/systems/` | Konstanten im Code |
| E-001 | Vier Schichten `data → sim → app → view/ui/audio`, Scheduler mit Phasen, ControlFrame, EventBus — wie `02_Architektur_v2.md` | Befund A1: `main.ts` mit 30 Callbacks war der Grund, warum jedes Feature Bestehendes brach | Prototyp-Struktur weiterführen |

**Offen für M1:** Kollisionsgruppen-Layout (Bitmasken) festlegen, bevor der Spawner Körper anlegt; Body-Registry handle→ItemId im PhysicsWorld oder im ScrapSystem?
