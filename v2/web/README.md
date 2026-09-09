# Bagerana v2 — Spur A (Web)

Neuaufbau nach `../docs/02_Briefing.md` (Kap. 17 Architektur, Kap. 22 Meilensteine). Stand: **M5b — Presse** (E-048–E-050), auf Basis M5a und Spinne Schritt 1 (E-043–E-046). Spinne 2.0 (E-038) wurde am 09.09. zurückgenommen (E-042); die Steuerung bleibt kinematisch, Physik kommt nur als Wirkung dazu, in einzeln abgenommenen Schritten.

**Presse (M5b):** Rumpf in die Presse legen, im Menü ☰ „Presse auslösen“ — drei Quetschstufen, dann ein Stahlpaket. Sie verweigert, solange Batterie oder Motor dranhängen, und sagt welches Teil im Weg ist. Sie steht in Reichweite des Baggers (E-048), nicht im Westen wie im Briefing.

**Zuletzt behoben (E-047):** Das Wrack lag 20,8 m vom Bagger entfernt im Zerlegebereich und war bei 9,2 m Reichweite unerreichbar. Der Tieflader hält jetzt an der Annahme und setzt es 7,2 m neben dem Bagger ab. Der Zerlegebereich steht dafür vorerst leer.

**Offen:** Die Spinne ruht nach der Abnahme von Schritt 1; Schritt 2 (Aufsetzen per Strahlen gegen das Eintauchen) sowie Funken, Staub und Geräusche bleiben geplant, aber ohne Termin. Der Auftrag „Motor ausbauen" ist als V1 eingestuft und wird im MVP nicht ausgespielt — das Wrack liegt also ohne zugehörigen Auftrag auf dem Platz.

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

## Was M1 enthält

- `sim/world/Level.ts`: statische Kollider (Boden, 5 Wände, Muldenwände) und Zonen aus `level_yard.json` — dieselben Kästen zeichnet die Ansicht.
- `sim/world/collisionGroups.ts`: Bitmasken für Statik, lose Teile, Bagger, gehaltene Teile, Fahrzeuge.
- `PhysicsWorld`: Body-Registry `handle ↔ ItemId`, gesammeltes Entfernen nach `itemRemoving`.
- `sim/systems/ScrapSystem.ts`: Spawner (Formen aus `materials.json`, Masse = Volumen × Dichte × Füllgrad), Regalpackung ohne Überlappung, Deckel 300, Schlafhilfe (gemeinsam, nie einzeln), Save/Load mit Prüfung je Eintrag.
- `Simulation.settle()`: Vorsimulation bis Ruhe, dann schlafen — kein Bild beginnt mit 150 wachen Körpern.
- `view/ScrapView.ts`: ein `InstancedMesh` je Form, Farbe je Fraktion, Interpolation zwischen Physikschritten.
- Debug-Knopf „Haufen kippen" (Taste P): 150 weitere Teile fallen live — Physik-ms auf dem Gerät messen.
- Wächter-Tests: 150 Teile schlafen in 600 Schritten bei < 0,3 ms/Schritt · Fuzz 6 000 Schritte ohne Ausreißer > 20 m/s · Entfernen über Registry · Save-Roundtrip mit kaputten Einträgen · Level-Geometrie.

Physik-Erkenntnisse aus M1 (Details in `../docs/entscheidungen.md` E-010–E-012): überlappende Spawns und perfekte Zylinder waren die Ursachen für nie schlafende Haufen; Körper einzeln schlafen zu legen drückt Teile durch den Boden.

## Was M2 enthält

- `sim/systems/ExcavatorSystem.ts` (Phase input): Fahrwerk, Lenkung, Oberwagen, Hauptarm, Stiel, Rotator, Spinne — Rampen, Lastfaktor, Bodenanschlag; Vorwärtskinematik liefert `pose` (Stielspitze, Spinne, Sensor). Zahlen aus `balancing.excavator`.
- `sim/systems/ExcavatorColliders.ts` (preStep 10): kinematische Körper für Unterwagen, Hauptarm, Stiel, Spinne (Traverse + 10 Krallen-Kapseln aus `shared/clawGeometry.ts`); Pflügsonde an den Krallenspitzen in Bewegungsrichtung → `plowFactor`.
- `sim/systems/GripSystem.ts` (preStep 20): Sensor + Korbgeometrie, Greiffenster 0,6–0,98, gehaltene Teile kinematisch in Gruppe HELD, Haltepose in 0,15 s, Loslassen mit Spinnengeschwindigkeit, Überlast- und Schwungwurf-Regel, `itemRemoving` löst den Griff.
- `app/input/KeyboardMouseAdapter.ts`: Q/E R/F T/G W/S A/D, LMB greifen, Rad Rotator, MMB/RMB Orbit, Shift+Rad Zoom — Belegung aus `controls.json`.
- `view/ExcavatorModel.ts` (aus dem Prototyp portiert, nur Darstellung), `view/CameraRig.ts` (Orbit hinter der Kabine, folgt dem Oberwagen), Schatten für Bagger.
- Tests: 100× greifen/heben/schwenken/ablegen ohne Ausreißer · Bodenanschlag · Widerstand nur bei Kontakt · Überlast + H1 · Spreizung.

Steuerung im Browser: **Q/E** Oberwagen · **R/F** Hauptarm · **T/G** Stiel · **W/S A/D** fahren · **linke Maustaste halten** greifen · **Mausrad** Rotator (Rasten) · **Y/X** Rotator (Dauer) · **V** Fahrmodus · **C** Ansicht (Orbit/Draufsicht) · **rechte/mittlere Maustaste ziehen** Kamera · **Shift+Rad** Zoom · **P** Haufen kippen · **K** Kunde rufen · **F3** Overlay.

## Was M3 enthält

- `app/input/TouchAdapter.ts` + `InputMapper.ts`: zwei floating Sticks (links: Oberwagen/Hauptarm, rechts: Stiel/Spinne — rechts = schließen, links = öffnen, asymmetrische Totzonen 0,3/0,6), FAHREN-Toggle (Auto-Ende nach 4 s), ↺ ↻ Rotator halten, ⌖ Ansicht; freie Fläche: Wischen = Orbit, Pinch = Zoom, Doppeltipp = Ansicht. Safe-Area über `env()`, Kompaktlayout < 700 px. Alle Werte in `controls.touch`.
- `sim/systems/AimSystem.ts` (postStep 20): Strahl unter dem Sensor → Teil/Container, Urteil `neutral | item | ok | tolerated | wrong`, Ladungsinfo. `view/AimRing.ts` zeichnet den Bodenring, `ui/GripChip.ts` den Chip (Fraktion · kg · €-Stufe · ✓/!/✗).
- Greif-Magnet (Snap) in `GripSystem.trySnap` + `ExcavatorSystem.applySnap`: Ein-Freiheitsgrad-IK für Gieren und Reichweite, 0,25 s, `balancing.assist`.
- Pendel in `ExcavatorSystem.integratePendulum`: neigt Spinne, Kollider, Sensor und Ladung; Bodenkontakt beruhigt.
- `view/CameraRig.ts`: Orbit ↔ Draufsicht (25 m, 60°), weiche Überblendung.
- Schonfrist nach dem Loslassen (Gruppe `released`, 0,6 s) — behebt wegschießende Teile (E-018).
- Tests: `test/sim/assist.test.ts` (Pendel, Snap, Zielhilfe) · `test/e2e/layout.spec.ts` (4 Viewports, Tippziele ≥ 44 px, keine Überlappung, Stick + Greifen per Touch).

## Was M4a enthält

- `sim/systems/VehicleSystem.ts` (preStep 15): Kundenfahrzeuge auf Routen aus `level_yard.json` (rein → Waage → rückwärts andocken → kippen → **gekippt losfahren** → Waage → raus), Ladung echt auf der Mulde (kinematisch, ab 22° dynamisch), Ankauf (Mischpreis / Fraktionspreis), Abholer (`requestPickup`) mit Verkauf kg × Preis × Reinheit². Werte in `balancing.vehicles`, Fahrzeuge in `customers.json` (`body`, `routeDock`, `tips`).
- `sim/systems/ContainerSystem.ts` (slow ×6): Verbuchung nach 3 s Ruhe, Reinheit, **Sortierpunkte** statt Geld (E-021), verbuchte Teile bleiben kurz sichtbar.
- Große Einzelformen (Drahtballen, Tank, Waschmaschine, Gussteil) mit Auswahlgewicht in `materials.json`.
- `view/VehicleView.ts`, `view/ContainerFillView.ts`, `ui/Hud.ts` (Konto · Punkte · Verkaufen-Liste · Toasts).
- Tasten: **K** Kunde rufen (Debug). Automatische Anlieferungen laufen im Arbeitsteil des Tages (`deliveriesPerDay`).
- Test: `test/sim/delivery.test.ts`.

## Was M4b enthält

- `sim/systems/DaySystem.ts` (slow ×6): Morgen → Betrieb → Feierabend → nächster Tag; `startDay()/endDay()/nextDay()` von der UI; Fixkosten, Zinsen auf Minus, Pleite unter der Kreditlinie, Kampagnenende nach `campaignDays`; Tagesbilanz in `world.day.report`. Sichert Tag, Konto und Bagger-Pose (E-028, E-030).
- `sim/systems/MissionSystem.ts` (slow ×6): 3 Aufträge/Tag ab Tag 1 aus `missions.json` (Seed = Tag), Typen deliver/clear/customer, Bonus + Stern (E-031).
- `sim/systems/TutorialSystem.ts` (slow ×6): Einweisung an Tag 0 in drei Lektionen mit blockierenden Schritten (E-026), neutrale Texte (E-027), `skip()`. Werte in `balancing.tutorial`.
- `app/SaveService.ts` + `app/Persistence.ts`: Autosave in IndexedDB (Tagesende, Seite versteckt, alle 60 s), Export/Import als JSON, Dialog bei kaputtem Stand.
- `ui/DaySheet.ts` (Morgen-Karte, Abend-Bilanz, Spielende), `ui/TutorialBanner.ts`, `ui/BrokenSaveDialog.ts`, HUD mit Tag, **Tag beenden**, Auftragszeile.
- `view/audio/AudioSystem.ts`: synthetische Sounds an Events, Freigabe nach erster Geste, **M** stumm.
- Neues Spiel startet leer (E-029); `?pile` in der URL legt den 40er-Haufen (Dev), **P** kippt 150 weitere.
- Test: `test/sim/day.test.ts`; Rauchtest prüft Morgen-Karte, Feierabend, Autosave über Neuladen.

## Was M5a enthält

- `sim/systems/CompositeSystem.ts` (preStep 18): Wrack = Rumpf-Schrottteil (`hull_car`) + Anker-Baugruppen aus `composites.json`; Fassen im `grabRadius`, Arm-Sperre, Zugkraft aus Achseingaben, Abriss nach `tearSeconds`, Reihenfolge über `requires` (E-033–E-035). Werte in `balancing.composites`.
- Tieflader (Kunde Rehm, ab Tag 1): bringt den Pkw, setzt ihn seitlich im Zerlegebereich ab, fährt rückwärts hinaus (E-036); Pauschale 120 €.
- `view/CompositeView.ts` (Baugruppen am Rumpf), Chip „Motor · 210 kg · reißt 60 %" bzw. „erst Batterie ab", Reiß-Sound.
- Test: `test/sim/composite.test.ts` (Motor 2,4–3,0 s, Massen auf 210 kg genau, Reihenfolge, Tieflader Tor-zu-Tor).

## Nächster Meilenstein

**M5b — Presse und Zerlege-Auftrag**: Pkw/Traktor/Lkw als zerlegbare Objekte (Motor, Kat, Batterie, Reifen, Tank, Kabelbaum), Presse, Auftragstyp dismantle.
