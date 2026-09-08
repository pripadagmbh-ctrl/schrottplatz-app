# Entscheidungslog v2

Jede Architektur- oder Design-Entscheidung mit Datum und Begründung, damit nichts zweimal diskutiert wird (CLAUDE.md). Neueste oben.

## 2026-09-08 — M3: Touch und Kamera

| # | Entscheidung | Begründung | Alternative (verworfen) |
|---|---|---|---|
| E-018 | Losgelassene Teile kollidieren `releaseGraceSeconds` (0,6 s **SW**) lang nicht mit dem Bagger (Gruppe `released`) | Im 100er-Griff-Test schossen Teile beim Loslassen mit bis zu 6,8 m/s weg: Die Krallen sind beim Loslassen noch fast zu und die Spinne kann noch sinken, die kinematischen Krallen quetschen das Teil gegen den Boden. Mit Schonfrist: kein Ausreißer > 3 m/s. Sehr wahrscheinlich die Ursache für „Teile fliegen umher" (Playtest M2) | Krallen-Kollider beim Öffnen abschalten (dann fällt auch nichts mehr *aus* dem Korb); Loslassen erst bei voll geöffneter Spinne (fühlt sich träge an) |
| E-017 | Bodenanschlag berücksichtigt die Unterkante der Ladung (`carriedBottomM`, Welt-AABB der gehaltenen Teile) — Ladung kann nicht in den Boden gedrückt werden | Mit dem Pendel hängt die Ladung schräg; ein Trägerende lag sonst unter den Spitzen und wurde vom kinematischen Teil in den Beton gezogen | Ladung wie im Prototyp ignorieren |
| E-016 | Greif-Magnet misst `snapRadiusM` (0,5 m) **ab Korbrand** (Korb bei Schließgrad 0,6, leer ≈ 1,2 m) statt ab Sensor; Auslösung nur bei genau einem losen Einzelteil außerhalb und keinem im Korb | Briefing sagt „≤ 0,5 m seitlich vom Sensor" — aber 0,5 m ab Sensor liegt vollständig im Korb, dort greift die Spinne ohnehin. Wirksam ist der Ring 1,2–1,7 m, wo Anfänger knapp danebenliegen | Wörtlich nach Briefing (Snap ohne Wirkung) |
| — | Pendel als reine Zustandsgröße im `sim` (nicht in der Ansicht wie im Prototyp): kippt Spinne, Krallen-Kollider, Sensor und Ladung gemeinsam; Werte aus `balancing.assist` (Prototyp `excavator.ts:1314-1346`, Kappung 15 m/s², Pendellänge 1,5 m, max. 0,45 rad) | Sonst greift der Sensor lotrecht, während die Spinne sichtbar schräg hängt — das Teil würde „neben" den Krallen gegriffen | Pendel nur im View (Prototyp) |
| — | Rückfragen M3: Greifen auf Touch über den **rechten Stick** (rechts = schließen ab 0,3, links = öffnen ab 0,6, Mitte = halten), kein GREIFEN-Knopf (M3-1) · Rotator auf **Y/X** (M3-2) · zweite Ansicht = **Draufsicht** 25 m / 60° hinter dem Oberwagen, Kabine [V1] (M3-3) | Patricks Antworten 08.09.: Knopf-Variante „kaum bedienbar"; Öffnen braucht mehr Toleranz als Schließen | Halten-Knopf; Toggle-Knopf; Kabinenkamera |
| — | Bodenring: Strahl vom Sensor senkrecht nach unten (nur STATIC/LOOSE), Ø = Spitzenkreis; Farben wählt die Ansicht aus `verdict` + Materialfarbe; Chip zeigt zusätzlich ✓ / ! / ✗ (Kap. 20, nie nur Farbe) | Simulation kennt keine Farben (Schichtenregel); ein Urteil, zwei Kanäle | Farbwahl in der Simulation |
| — | Nach Gerätetest 08.09. (iPad/iPhone): Kabinenansicht aus V1 vorgezogen (Orbit → Draufsicht → Kabine per ⌖/Doppeltipp); Greif-Magnet standardmäßig **aus** (`snapEnabled: false`, Code und Tests bleiben); Pendel-Kappung 0,3 rad, schwere Dämpfung 1,3; Doppeltipp mit Ortsprüfung (`TapDetector`); Kamera-Gesten nur im Mittelstreifen; `touch-action: none` auf allen Elementen gegen Safari-Seitenzoom | Patrick: „ohne Kabinenansicht ist Sortieren echt schwierig" (Teile aus 11 m zu klein), Snap „spüre ich nicht, nicht einbauen", Pendel „schlägt bis zum Ende an", Safari zoomte bei Doppeltipp die Seite | Größere Teile (verworfen — siehe Diskussion: Maßstab bleibt, Kamera näher) |
| — | Layout-Test auf 4 Viewports (iPad quer, iPhone mini quer, 844×390, iPhone mini hoch) per CDP-Touch-Events; flache Querformate (< 500 px hoch) bekommen eine kompakte Debug-Box | Der Test fand die Überlappung FAHREN/Debug-Box bei 375 px Höhe sofort | Sichtprüfung auf dem Gerät allein |

**Vorgemerkt für M4a (Patrick 08.09.):** sechs große Einzelformen in `materials.json` — Drahtballen (Kabel/Stahl), Tank (Stahl), Waschmaschine (vorerst Stahl, ab V1 Elektroschrott), Motorblock, Gussteil, Rad mit Reifen — etwa jedes zehnte Teil im Start-Haufen groß. Auto, Traktor, alter Lkw als Verbundteile in M5 (Kap. 8). Orbit-Standardabstand 11 → 8 m prüfen.

Messungen M3 (Node/Headless): 37 Sim-/Unit-Tests, 5 E2E; Snap-Test: Abstand 1,6 m → < 0,3 m in 0,25 s, Teil gegriffen. Offen nach M3: Gerätetest iPad/iPhone (Stick-Größen, Totzonen 0,3/0,6, Pendelstärke, Ring-Sichtbarkeit auf Beton), Aufprall-Abrutschregel (Kontakt-Events), Draw Calls des Baggermodells (M6), Snap-Schalter in den Einstellungen [V1].

## 2026-09-08 — M2: Bagger und Greifen

| # | Entscheidung | Begründung | Alternative (verworfen) |
|---|---|---|---|
| E-015 | Haltepose = Teilmitte in der Korbmitte, Ausrichtung relativ zur Spinne beibehalten; Übergang 0,15 s weich | Einfach, stabil, sieht für Träger und Bleche richtig aus („liegt im Korb"). Prototyp fror die zufällige Zupack-Lage ein → schwebender Schrott (Gerätetest Befund 6) | „nächster Oberflächenpunkt → Korbmitte" (aufwendiger, kaum sichtbarer Gewinn) |
| E-014 | Pflügsonde sitzt an den Krallenspitzen (Unterkante = Spitzen, Radius = Spitzenkreis) und wird nur in Bewegungsrichtung 0,3 m vorausgeschoben | Prototyp-Sonde lag 79 cm tiefer als die Spitzen und bremste alle Achsen beim Annähern (Messung 4, 02.09.). Test „Absenken über Haufen bremst nicht, Durchschwenken bremst" ist grün | Shape-Cast je Achse (genauer, ~3× teurer; bei Bedarf in M3) |
| E-013 | Bodenanschlag: Spinne setzt auf und wird am Kardan senkrecht hochgeschoben (bis 0,6 m); erst darüber wird der Arm geklemmt | Prototyp klemmte über den Stielwinkel — beim Schließen auf dem Boden wanderte die Spinne bis 1,3 m zur Seite und verlor das Teil (14 % Fehlgriffe im 100er-Test → 0 %) | Prototyp-Klemme; Spitzen im Boden versinken lassen |
| — | Greifen kinematisch mitführen (Rückfrage M2-1), Modell prozedural aus dem Prototyp (M2-2), nur Achsmodus (M2-3) | Rückfragen 08.09. | Motor-Joint; Hero-Asset; IK |
| — | Pendel der Spinne und Kabinen-/Draufsicht-Kamera nach M3 verschoben | M2 ist ohne sie testbar; das Pendel braucht die Interpolation der Spinne, die mit Touch/Kamera zusammen kommt | — |

Offen nach M2: Aufprall-Abrutschregel braucht Kontakt-Events (M3) · Bagger-Modell hat ~190 Meshes → Draw Calls 207 (Budget mobil 250, Desktop 400) — Statik des Modells in M6 mergen · Bodenanschlag-Verhalten auf dem Gerät prüfen (fühlt sich das Aufsetzen richtig an?).

## 2026-09-08 — M1: Kopflose Simulation

| # | Entscheidung | Begründung | Alternative (verworfen) |
|---|---|---|---|
| E-012 | Schlafhilfe legt lose Körper nur **gemeinsam** schlafen (alle drei Prüfungen lang unter den Schwellen 0,06 m/s / 0,12 rad/s), nie einzeln | Test-Befund: ein einzeln schlafen gelegter Körper unter Last verliert den Kontakt zum Boden — Bleche und Klötze sanken durch den Platz (bis −1 000 m). Rapiers eigene Schwellen (0,4 m/s) sind nicht einstellbar; Inseln schlafen nur, wenn alles ruht | Per-Körper-Sleep (Prototyp-Idee); Rapier-Defaults allein (Haufen blieb 40 s wach) |
| E-011 | Runde Formen (Rohr, Coil, Felge, Reifen) sind **Achtkant-Prismen** (Konvexhülle), keine Zylinder; Dämpfung 0,3/1,0 | Rapier hat keinen Rollwiderstand: perfekte Zylinder rollten endlos (0,45 m/s nach 40 s), auch mit Dämpfung 4,0 kriechten sie. Kanten entsprechen verbeulten Rohren — glaubwürdig und billig. Mesh bleibt 14-seitig | Hohe Dämpfung allein; eigener Rollwiderstand pro Schritt (teurer, ungenauer) |
| E-010 | Haufen-Spawn als **Regalpackung** ohne Überlappung (Gieren nur 0°/90°, Lagen mit `spawnGapM`), statt Rasterzellen | Überlappende Spawns erzeugten Dauer-Zittern und Explosionen (maxV 110 m/s) — genau der Prototyp-Fehler (A2 §5, 4 cm Abstand) | Zufällige Lagen mit Abstandsraster |
| E-009 | Body-Registry `handle ↔ ItemId` lebt im `PhysicsWorld` | Greifer-Sensor und Shape-Casts liefern nur Handles; eine Rückübersetzung an einem Ort; Entfernen räumt die Registry im selben `flushRemovals()` auf | Registry im ScrapSystem (dann kennt der Greifer das ScrapSystem) |
| E-008 | Kollisionsgruppen: STATIC, LOOSE, EXCAVATOR, HELD, VEHICLE; HELD kollidiert nicht mit EXCAVATOR und nicht untereinander | Briefing Kap. 6.2 Punkt 5; Prototyp schaltete stattdessen die Krallen-Kollider ab | Kollider abschalten beim Tragen |
| — | Vorsimulation `settle()` endet, sobald es ruhig ist (max. 600 Schritte) | 120 feste Schritte reichten nicht (Haufen aus 3 m Höhe braucht ~300); Abbruch bei Ruhe spart Ladezeit | feste Schrittzahl |
| — | Bleche mit CCD und Mindestdicke 3 cm | 2-cm-Bleche tunnelten bei 60 Hz durch den Boden | dickere Bleche allein |

Messungen M1 (Node, Vitest): 150 Teile schlafen nach ~300 Schritten; schlafend 0,04 ms/Schritt; wach mit 300 Teilen ~3,9 ms/Schritt (Headless Chromium, siehe Screenshot `m1_haufen_kippen.png`). Ausstehend: iPad-Messung mit „Haufen kippen".

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
