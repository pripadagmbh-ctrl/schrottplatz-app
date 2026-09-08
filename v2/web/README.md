# Bagerana v2 — Spur A (Web)

Neuaufbau nach `../docs/02_Briefing.md` (Kap. 17 Architektur, Kap. 22 Meilensteine). Stand: **M0 — Gerüst und Messbasis**.

## Befehle

```
npm install                 # einmalig; dazu: npx playwright install chromium
npm run dev                 # Dev-Server im WLAN (--host); iPad: http://<pc-ip>:5174
npm run check               # tsc --noEmit
npm run lint                # ESLint inkl. Schichten-Gate
npm test                    # Vitest (unit + kopflose Sim-Tests mit Rapier)
npm run verify              # check + lint + test nacheinander (Pflicht vor jedem Commit)
npm run e2e                 # Playwright-Rauchtest gegen den Dev-Server
npm run build               # dist/ (tsc + vite build)
npm run preview             # dist/ im WLAN ansehen
```

Debug-Overlay: **F3** (Desktop) oder **5-Finger-Tipp** (Touch). Im Dev-Build standardmäßig an.

## Schichten (Lint erzwingt sie)

```
data/   JSON + Schemas              → src/data/   (lädt, validiert, prüft Querbezüge)
src/shared/  Ids, Events, Math, Rng — abhängigkeitsfrei
src/sim/     Simulation: WorldState, PhysicsWorld (Rapier), Scheduler, Systeme, ControlFrame — kein Three, kein DOM
src/view/ ui/ audio/  Darstellung — lesen Snapshots, hören Events
src/app/     Bootstrap, GameLoop (fixed step, max. 2 Nachholschritte)
test/unit/ test/sim/ test/e2e/
```

Ein Import von `three` oder `window` in `src/sim/` ist ein Lint-Fehler. Ein Import von `view/` oder `app/` aus `sim/` ebenfalls (`eslint-plugin-boundaries`).

## Was M0 enthält

- Alle Datenkataloge aus dem Briefing als JSON mit Schema-Validierung und Querbezugs-Prüfung (`data/`, 9 Dateien, 11 Tests).
- Scheduler mit Phasen (input → preStep → physics.step → postStep → slow) und Snapshot-Test der Reihenfolge.
- PhysicsWorld-Wrapper mit `safeBody()` und gesammeltem Entfernen (Muster gegen QA-Absturz H1) — bewiesen im Sim-Test.
- Leere Szene: Boden, Zonen und Stufe-1-Boxen aus `level_yard.json`, ACES-Tone-Mapping, Debug-Overlay.
- GameLoop mit Akkumulator und Interpolationsfaktor.
- Playwright-Rauchtest: Seite lädt, Overlay zeigt fps, keine Konsolenfehler, ≤ 400 Draw Calls.

## Nächster Meilenstein

**M1 — Kopflose Simulation** (Briefing Kap. 22): ScrapSystem mit Spawner, Vorsimulation, Sleep-Wächter-Test „150 Teile, 600 Schritte, alle schlafen, < 0,3 ms/Schritt", Fuzz-Test.
