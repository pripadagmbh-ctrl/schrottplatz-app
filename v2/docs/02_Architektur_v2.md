# Architektur v2 — Bauanleitung

Stand 2026-09-02 · Gilt für `v2/web` (Three.js r169 + Rapier 0.14, primär) und die Unity-Testspur (Kap. 12). Design-Quelle: `01_GDD_v2.md`. Befunde, auf die sich diese Anleitung stützt: `review/architect.md` (Struktur), `review/qa-tester.md` (Abstürze H1/H2, Sleep, Draw Calls, Interpolation).

**Für wen:** technisch interessierte Laien und die Agenten, die v2 bauen. Fachbegriffe werden beim ersten Auftreten kurz erklärt. Jede Regel hat ein „Warum" mit Verweis auf den Prototyp, damit sie nicht wie Dogma wirkt.

---

## 1. Die drei Grundregeln (alles andere folgt daraus)

1. **Simulation kennt keine Darstellung.** Alles unter `sim/` importiert weder Three.js noch `document`. Nur Rapier (läuft auch in Node) und reine Daten. → Simulation ist ohne Browser testbar (QA-Befund: 0 % Abdeckung auf 8 000 Zeilen, weil alles am Renderer hängt).
2. **Systeme sind registriert, nicht verdrahtet.** Ein Feature = eine Datei, die sich mit Phase und Reihenfolge beim Scheduler anmeldet. Kein `main.ts`, in dem 30 Callbacks gesetzt werden (Prototyp `main.ts:367–606`).
3. **Zahlen und Layout sind Daten.** Materialien, Kunden, Karossen, Routen, Platz-Geometrie, Aufträge, Balancing liegen in JSON unter `data/` mit Schema-Prüfung. Kein `const BAY_X = 4.6` in drei Dateien (Prototyp `obstacles.ts:36`, `containers.ts:54`, `yard.ts`).

Diese drei Regeln werden nicht durch Disziplin, sondern durch Werkzeuge gehalten: Lint-Gate (Kap. 8), Scheduler-Snapshot-Test (Kap. 9), JSON-Schema-Validierung beim Laden (Kap. 6).

---

## 2. Schichten

```
┌──────────────────────────────────────────────────────────────────────┐
│ 4  app/         Bootstrap, GameLoop, Scheduler, SaveService, InputMapper,      │
│                 Plattform-Adapter (Web/Capacitor), Qualitätsstufen             │
├──────────────────────────────────────────────────────────────────────┤
│ 3  view/        Renderer-Adapter (Three), ViewRegistry (id → Object3D),        │
│                 Modelle, Partikel, Kamera, Tageslicht                          │
│    ui/          HUD, Menüs, Morgen-Karte, Abend-Bilanz (DOM)                   │
│    audio/       prozedurale Sounds, Radio                                      │
├──────────────────────────────────────────────────────────────────────┤
│ 2  sim/         World-State (reine Daten) + Systeme (Bagger, Greifer, Schrott, │
│                 Container, LKW, Presse, Platzwart, Betrieb/Tag, Aufträge,      │
│                 Wirtschaft, Ruf, Ausbau, Tutorial). Rapier ja. Three/DOM nein. │
├──────────────────────────────────────────────────────────────────────┤
│ 1  data/        JSON + Schemas: materials, customers, cars, level, routes,     │
│                 upgrades, missions, balancing, controls                        │
│    shared/      Typen, EventBus, Math-Helfer, Ids — abhängigkeitsfrei           │
└──────────────────────────────────────────────────────────────────────┘
```

**Abhängigkeitsregel:** Pfeile zeigen nur nach unten. `view`/`ui`/`audio` lesen `sim` (Snapshots) und hören Events; `sim` weiß nicht, dass es eine Ansicht gibt. `app` kennt alle, ist aber dünn (< 300 Zeilen) — nur Zusammenstecken, keine Spiellogik.

**Begriffe:**
- *Snapshot* = Nur-Lese-Sicht auf den Simulationszustand, den die Ansicht pro Bild abfragt (Position, Zustand), statt selbst in Objekte zu greifen.
- *Event* = Nachricht „etwas ist passiert" (Teil im Container gelandet). Sender wissen nicht, wer zuhört.
- *System* = eine Einheit Spiellogik mit `update(dt)`, die sich beim Scheduler anmeldet.

---

## 3. Ordnerstruktur `v2/web`

```
v2/web/
  package.json            three, @dimforge/rapier3d (ohne -compat), vite, vitest, eslint, ajv, capacitor
  vite.config.ts          vite-plugin-wasm (WASM separat, nicht base64 → ~0,6 MB weniger JS)
  eslint.config.js        Lint-Gate (Kap. 8)
  index.html
  data/
    materials.json  customers.json  cars.json  upgrades.json  missions.json
    level_yard.json routes.json     balancing.json  controls.json
    schema/*.schema.json          JSON-Schema je Datei
  src/
    shared/
      ids.ts              Id-Typen (ItemId, ContainerId, TruckId …), branded strings
      events.ts           GameEvents-Typen + EventBus (on/off/emit/once, Frame-Queue)
      math.ts             Vec3-Helfer ohne Three (Interfaces {x,y,z})
      rng.ts              seedbarer Zufall (deterministische Tests)
    data/
      loadData.ts         lädt + validiert JSON (ajv), liefert typisierte Kataloge
      types.ts            MaterialDef, CustomerDef, CarDef, LevelDef, MissionDef …
    sim/
      world/
        WorldState.ts     alle Entitäten als Records/Maps (Items, Trucks, Containers, Excavator …)
        PhysicsWorld.ts   Rapier-Wrapper: step, Sleep-Parameter, Body-Registry (handle→id), safeBody()
        Level.ts          baut aus level_yard.json Kollider, Zonen, Hindernis-Query, Routen
      systems/
        System.ts         Interface + Scheduler (Kap. 4)
        ExcavatorSystem.ts   Kinematik (Rampen, Lastfaktor, Bodenklemme, Pendel) — aus Prototyp-Kern
        ExcavatorColliders.ts kinematische Körper nachführen, Arm-Kollision per Shape-Cast
        GripSystem.ts     Greifen kinematisch (Kap. 10.2), Reißen, Quetschen
        ScrapSystem.ts    Spawn, Bündeln, Deckel, Sleep-Hilfen, Entfernen mit onRemoved
        ContainerSystem.ts Zonen-Zählung, Reinheit, Ampel-Zustand
        CompositeSystem.ts Karossen: Quetschstufen, Scheiben, Abreißen
        TruckSystem.ts    datengetriebener Phasen-Automat, Ladung mitführen, Waage
        PressSystem.ts
        StaffSystem.ts    Lambert + Radlader
        LaneSystem.ts     Fahrspur frei?
        DaySystem.ts      Morgen/Betrieb/Feierabend/Bilanz (GDD Kap. 5)
        MissionSystem.ts  Tagesaufträge aus missions.json (GDD Kap. 6)
        EconomySystem.ts  Konto, Ankauf, Verkauf, Fixkosten
        ReputationSystem.ts  UpgradeSystem.ts  TutorialSystem.ts  EntitlementSystem.ts (Premium-Unlock)
      control/
        ControlFrame.ts   Eingabe-Datensatz (Kap. 5)
      snapshot/
        Snapshot.ts       Nur-Lese-Sichten für view/ui
    view/
      Renderer.ts         WebGLRenderer, Qualitätsstufen, Pixel-Ratio-Deckel
      ViewRegistry.ts     id → Object3D, erzeugt/entsorgt Sichten auf Events (dispose!)
      Interpolation.ts    Pose(prev, curr, alpha)
      models/             ExcavatorView, TruckView, ScrapView (InstancedMesh je Form), YardView (gemergt), PersonView …
      CameraRig.ts  Daylight.ts  Particles.ts
    ui/
      Hud.ts  Menus.ts  MorningCard.ts  EveningReport.ts  Toasts.ts  Settings.ts
    audio/
      AudioSystem.ts  Music.ts
    app/
      main.ts             < 150 Zeilen: Daten laden → Welt → Systeme registrieren → Loop
      GameLoop.ts         Fixed-Step-Akkumulator, Interpolations-Alpha, Pausenzustand
      InputMapper.ts      Tastatur/Touch/Gamepad → ControlFrame; Belegung aus controls.json
      touch/              virtuelle Sticks (aus Prototyp-touch.ts, ohne Tastencode-Emulation)
      SaveService.ts      Kap. 7
      platform/           StorageAdapter (Web IndexedDB | Capacitor Filesystem), Haptik, Lifecycle
      GameStateMachine.ts boot | playing | paused | menu(...) | dayTransition
  test/
    unit/                 Formeln (übernommen aus prototype/test)
    sim/                  Headless-Szenarien mit echter Rapier-Welt (Kap. 9)
    smoke/                Playwright-Fuzz (aus qa/fuzz.mjs)
```

---

## 4. System-Interface und Scheduler

```ts
// src/sim/systems/System.ts
export type Phase = "input" | "preStep" | "postStep" | "slow";
//  input    : ControlFrame anwenden (Bagger)
//  preStep  : kinematische Körper setzen (Bagger-Kollider, LKW, Greifer-Ladung)
//  postStep : nach Rapier.step — Zählen, Ereignisse, Zustandsautomaten
//  slow     : alle N Steps (Container-Zählung, Bündeln, Fahrspur) — statt Timer in main

export interface SimContext {
  readonly world: WorldState;
  readonly physics: PhysicsWorld;
  readonly level: Level;
  readonly data: GameData;          // validierte Kataloge
  readonly bus: EventBus;
  readonly control: ControlFrame;   // aktueller Eingabe-Datensatz
  readonly step: number;            // fortlaufender Physik-Step
  get<T extends System>(ctor: new (...a: any[]) => T): T;  // Abfrage nach unten, nur lesend
}

export interface System {
  readonly name: string;
  readonly phase: Phase;
  readonly order: number;                 // klein = früher innerhalb der Phase
  readonly every?: number;                // nur Phase "slow": alle N Steps
  init?(ctx: SimContext): void;
  update(ctx: SimContext, dt: number): void;
  save?(): unknown;                       // eigener Zustand, JSON-fähig
  load?(data: unknown, ctx: SimContext): void;
  dispose?(): void;
}

export class Scheduler {
  private systems: System[] = [];
  register(s: System): void { this.systems.push(s); this.systems.sort(byPhaseThenOrder); }
  describe(): string[] { return this.systems.map(s => `${s.phase}:${s.order}:${s.name}`); } // für Snapshot-Test
  step(ctx, dt) {
    run("input"); run("preStep");
    ctx.physics.step();
    run("postStep");
    for (const s of slow) if (ctx.step % (s.every ?? 10) === 0) s.update(ctx, dt * s.every);
  }
}
```

**Feste Reihenfolge (aus Prototyp `main.ts:610–637` abgeleitet, jetzt explizit):**

| Phase | order | System | Warum an dieser Stelle |
|---|---|---|---|
| input | 10 | ExcavatorSystem | verarbeitet ControlFrame, setzt Sollwinkel |
| preStep | 10 | ExcavatorColliders | kinematische Körper auf neue Pose |
| preStep | 20 | GripSystem | gegriffene Teile mit der Spinne mitführen (kinematisch) |
| preStep | 30 | TruckSystem | LKW + Ladung kinematisch nachführen |
| preStep | 40 | StaffSystem | Lambert/Radlader |
| — | — | `physics.step()` | |
| postStep | 10 | ScrapSystem | Deckel (nur Notnagel), Sleep-Hilfen, Entfernungen anwenden |
| postStep | 20 | CompositeSystem | Δv-Erkennung → Scheiben/Quetschen |
| postStep | 30 | PressSystem | |
| postStep | 40 | TruckSystem.phaseLogic | Phasenwechsel, Waage → Events |
| postStep | 50 | DaySystem, EconomySystem, MissionSystem, TutorialSystem | reagieren auf Events des Steps |
| slow ×10 | 10 | ContainerSystem.recount | Zonen-Zählung |
| slow ×60 | 20 | LaneSystem | Fahrspur |
| slow ×240 | 30 | ScrapSystem.consolidate | Bündeln |

Ein Test friert `scheduler.describe()` als Snapshot ein: Wer ein System einfügt, sieht die Reihenfolge im Diff und muss sie bewusst bestätigen.

**Entfernen von Körpern (Pflicht, QA H1):** Kein System ruft `world.removeRigidBody` direkt. `ScrapSystem.requestRemove(id)` sammelt; am Ende von `postStep` wird `bus.emit("itemRemoving", {id, bodyHandle})` gefeuert — GripSystem, ContainerSystem, TruckSystem, ViewRegistry lösen ihre Referenzen — dann erst wird der Körper entfernt. `PhysicsWorld.safeBody(handle)` liefert `null` bei ungültigem Handle und ist die einzige Zugriffsart außerhalb des Owners. Ein Node-Test deckt „Teil in der Spinne wird gepresst/verkauft/gebündelt" ab.

---

## 5. ControlFrame (Eingabe als Datensatz)

Die Simulation kennt keine Tasten. Der `InputMapper` (app-Schicht) erzeugt pro Bild einen `ControlFrame`; Tastatur, Touch-Sticks, Gamepad und später ein Replay-Recorder schreiben in dasselbe Format.

```ts
export interface ControlFrame {
  // Achsen −1..+1 (schon mit Invertierung und Deadzone aus controls.json)
  drive: number; steer: number;
  cab: number; boom: number; stick: number;
  grapple: number;        // +1 schließen … −1 öffnen; 0 = halten (Touch) — Tastatur-Verhalten mappt der Mapper
  rotator: number;        // Dauerdrehung
  // Diskrete Aktionen, gelten genau einen Frame
  actions: ReadonlySet<Action>;
  // Kamera-Eingaben (gehen an view, nicht an sim — hier nur transportiert)
  camOrbit: { dx: number; dy: number }; camZoom: number;
}
export type Action =
  | "grabHold" | "grabRelease" | "toggleCabLift" | "toggleOutriggers" | "toggleBlade"
  | "press" | "orderPickup" | "makeRoom" | "shop" | "toggleLabels" | "toggleMusic"
  | "pause" | "cycleCamera" | "endDay" | "confirm" | "cancel";
```

`controls.json` beschreibt die Belegung (übernimmt die Idee aus `core/controlConfig.ts`: vier Stickachsen frei belegbar, invertierbar) und zusätzlich Tastatur/Gamepad. Belegungsänderungen berühren nie `sim/`.

---

## 6. Daten und Level-JSON

Alle Dateien unter `data/` werden beim Start mit **ajv** gegen `data/schema/*.schema.json` geprüft; ein Fehler bricht den Start mit Klartext ab (in Entwicklung) bzw. lädt Defaults (im Release). *JSON-Schema* = maschinenlesbare Beschreibung, welche Felder erlaubt sind und welche Typen sie haben.

### 6.1 `level_yard.json` (Beispiel, gekürzt)

Aus dieser einen Datei werden **generiert**: Rapier-Kollider (statisch), die Hindernis-Abfrage für kinematische Akteure (LKW, Lambert, Baggerarm), Container-Zonen, Routen-Prüfung und die zusammengeführte Sichtgeometrie. Damit sterben die drei Wahrheiten des Prototyps.

```json
{
  "$schema": "./schema/level.schema.json",
  "id": "yard_v2", "size": { "w": 80, "d": 58 },
  "ground": { "material": "concrete" },
  "walls": [
    { "id": "south", "from": [-40, -29], "to": [40, -29], "height": 1.8, "thickness": 0.6, "style": "betonlego" },
    { "id": "north_w", "from": [-40, 29], "to": [-12, 29], "height": 1.8, "thickness": 0.6, "style": "betonlego" },
    { "id": "north_e", "from": [-3, 29], "to": [40, 29], "height": 1.8, "thickness": 0.6, "style": "betonlego" }
  ],
  "gate": { "x": -7.5, "z": 29, "halfWidth": 4.5 },
  "buildings": [
    { "id": "office", "rect": { "x": -7, "z": 20, "hw": 3, "hd": 2 }, "height": 3.2, "model": "office" }
  ],
  "containers": [
    { "id": "c_steel", "fraction": "steel", "kind": "pile", "rect": { "x": -9, "z": 1, "hw": 7, "hd": 6 } },
    { "id": "c_alu",   "fraction": "alu",   "kind": "bay",  "rect": { "x": 4.6, "z": -1.9, "hw": 1.8, "hd": 2.0 }, "wallHeight": 2.5, "openSide": "west" }
  ],
  "zones": [
    { "id": "intake", "rect": { "x": 0, "z": 12, "hw": 8, "hd": 5 } },
    { "id": "press", "rect": { "x": 20, "z": -14, "hw": 3, "hd": 3 } }
  ],
  "weighbridge": { "x": -7.5, "z": 22, "length": 12 },
  "routes": {
    "deliver_in":  [[-7.5, 34], [-7.5, 22], [-7.5, 14], [0, 12]],
    "deliver_out": [[0, 12], [-7.5, 14], [-7.5, 34]],
    "pickup_in":   [[-7.5, 34], [-7.5, 22], [10, 10]]
  },
  "spawns": { "excavator": { "x": 0, "z": -1, "heading": 0 }, "piles": [{ "x": -9, "z": 1, "count": 150 }] },
  "parkSlots": [[-20, 20], [-24, 20]],
  "props": [{ "model": "floodlight", "at": [[-37, 26], [37, 26], [-37, -26], [37, -26]] }]
}
```

Ein Test (aus `test/collision.test.ts` übernommen) prüft: jede Route hält 1,4 m Abstand zu Wänden/Gebäuden/Boxen — jetzt gegen die generierte Hindernisliste, nie mehr gegen eine Handliste.

### 6.2 Weitere Datendateien

| Datei | Inhalt | Quelle im Prototyp |
|---|---|---|
| materials.json | id, name, Dichte, Kauf/Verkauf €/kg, Zielcontainer, Farbe | `materials/catalog.ts` |
| customers.json | Gruppen, Familien, Toleranz, Härte, Fahrzeug, Mengen | `delivery/customers.ts` |
| cars.json | Rumpf, Teile (Anker, Masse, tearSeconds), Scheiben, Quetschstufen | `dismantle/carDef.ts` |
| upgrades.json | Stufen, Preis, Freischaltung, Wirkung als benannte Modifikatoren (`boomSpeed: 1.35`) | `economy/upgrades.ts` + Zahlen aus `main.ts:456–459` |
| missions.json | Auftragstypen, Parameter-Bereiche je Tag, Bonus | GDD v2 Kap. 6 (neu) |
| balancing.json | Greifer (maxItems, maxKg, Fenster), Presse, Betrieb (BUSY/JAM kg), LKW-Zeiten, Solver-Parameter, Tag-Längen | verstreute `const` (129 Stück) |
| controls.json | Achsbelegung, Deadzones, Tastatur, Gamepad | `core/controlConfig.ts` |
| truck_phases.json | Phasen mit Dauer/Bedingung/Folgephase je Fahrzeugtyp | `delivery/vehicles.ts:637–838` |

---

## 7. Save-Service

**Prinzip:** Jedes System besitzt seinen Zustand und liefert ihn per `save()`; der Service fügt Kopf und Versionsnummer hinzu. Kein `buildSaveData` in main (Prototyp `main.ts:166–190`).

```ts
interface SaveFile {
  schemaVersion: number;      // CURRENT_SCHEMA in SaveService
  appVersion: string;         // aus package.json, für Fehlerberichte
  savedAt: string;
  day: number;                // für Slot-Anzeige
  systems: Record<string, unknown>;   // name → System.save()
  physics: { items: PoseRecord[]; cars: PoseRecord[] };   // Posen der dynamischen Körper
}
```

Pflichten (QA H2 + GDD Autosave):
1. **Validierung je Eintrag**: jedes Item braucht endliche Zahlen, bekannte `shape.kind`, bekannte `materialId`; ungültige Einträge werden **einzeln verworfen** (mit Zähler im Log), nicht das ganze Save.
2. **Fehlertoleranter Boot**: Weltaufbau aus Save in `try/catch`; bei Fehler: Save unter `…_broken_<timestamp>` sichern, Toast „Spielstand beschädigt — neues Spiel gestartet", weiterlaufen. Ladebildschirm verschwindet erst nach dem ersten gezeichneten Bild.
3. **Migrationen als Kette** `v1→v2→v3` in `migrations/`, jede mit Test (Fixture alt → erwartet neu). Jede Änderung an `ScrapShape`/`SaveFile` erhöht die Version — Lint-Regel: `CURRENT_SCHEMA` und `migrations/index.ts` müssen im selben Commit geändert werden (Pre-Commit-Hook prüft Diff).
4. **Autosave**: bei `visibilitychange`→hidden, `pagehide`, Capacitor `appStateChange`, Tageswechsel, und alle 60 s im Betrieb (Ringpuffer 3 Stände). Speichern läuft in einem `requestIdleCallback`-Fenster, JSON-Aufbau < 5 ms bei 300 Items (Test).
5. **Speicherort per Adapter**: Web = IndexedDB (localStorage-Limit 5 MB und synchron), Android = Capacitor Filesystem (`Directory.Data`), plus Export/Import als Datei für Support.
6. **Vollständigkeit**: Bagger-Pose, Greifer-Inhalt (Ids), LKW-Phase inkl. Ladung, Presse, Lambert-Ziel, Container-Zuordnung, Tag/Phase, Aufträge, Konto inkl. Statistik, Entitlement-Flag (Premium — zusätzlich in nativem Store-Receipt-Check, nicht nur im Save).

---

## 8. Lint-Gate

*ESLint* prüft Code-Regeln beim Speichern/Commit. Die eine Regel, die die Architektur trägt, ist das Importverbot je Schicht.

```js
// eslint.config.js (Flat Config, ESLint 9)
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "shared", pattern: "src/shared/*" },
        { type: "data",   pattern: "src/data/*" },
        { type: "sim",    pattern: "src/sim/**" },
        { type: "view",   pattern: "src/view/**" },
        { type: "ui",     pattern: "src/ui/**" },
        { type: "audio",  pattern: "src/audio/**" },
        { type: "app",    pattern: "src/app/**" },
      ],
    },
    rules: {
      "boundaries/element-types": ["error", {
        default: "disallow",
        rules: [
          { from: "shared", allow: [] },
          { from: "data",   allow: ["shared"] },
          { from: "sim",    allow: ["shared", "data"] },
          { from: "view",   allow: ["shared", "data", "sim"] },
          { from: "ui",     allow: ["shared", "data", "sim"] },
          { from: "audio",  allow: ["shared", "sim"] },
          { from: "app",    allow: ["shared", "data", "sim", "view", "ui", "audio"] },
        ],
      }],
      // Simulation darf weder Three noch DOM sehen
      "no-restricted-imports": ["error", { paths: [{ name: "three", message: "Nicht in sim/ — nutze shared/math" }] }],
      "no-restricted-globals": ["error", "document", "window", "localStorage", "navigator"],
      // Allokationen im Step sichtbar machen (QA N1): new THREE.* in update() verboten (eigene Regel oder Review-Checkliste)
    },
  },
  { files: ["src/view/**", "src/ui/**", "src/app/**", "src/audio/**"],
    rules: { "no-restricted-imports": "off", "no-restricted-globals": "off" } },
  { files: ["src/sim/**"], rules: { "no-restricted-syntax": ["error",
      { selector: "NewExpression[callee.object.name='THREE']", message: "Kein Three in sim/" } ] } }
);
```

Dazu `tsconfig` mit `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Pre-Commit: `eslint`, `tsc --noEmit`, `vitest run` (unit + sim).

---

## 9. Test-Ebenen

| Ebene | Werkzeug | Was | Laufzeit | Wann |
|---|---|---|---|---|
| 1 Unit | Vitest | Formeln, Automaten, Migrationen (aus Prototyp übernommen: 97 Tests) | < 5 s | jeder Commit |
| 2 Sim-Szenario | Vitest + echte Rapier-Welt in Node, **kein Three, kein DOM** | Greifen, Absetzen, Container-Zählung, Presse, LKW-Ablauf, Entfernen-in-der-Spinne (H1), Sleep-Verhalten, Save-Roundtrip | 10–60 s | jeder Commit |
| 3 Scheduler-Snapshot | Vitest | `scheduler.describe()` gegen Snapshot | ms | jeder Commit |
| 4 Smoke/Fuzz | Playwright headless, Dev-Server | 6 000 Steps Zufalls-ControlFrames; Fehler, NaN, Geschwindigkeits-Ausreißer, Draw-Call-Zähler, Heap | 2–3 min | Nightly / vor Release |
| 5 Gerät | iPhone-Safari (itch.io/Dev-Server), Android-Build (Windows) | Frame-Zeit, Physik-Step, Touch, Wärme, Speicher | manuell | jede Stufe (Kap. 11) |

### 9.1 Beispiel Sim-Szenario-Test (Ebene 2)

```ts
// test/sim/grip_remove.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import RAPIER from "@dimforge/rapier3d";          // läuft in Node
import { createHeadlessSim } from "./helpers/headlessSim";

beforeAll(async () => { await RAPIER.init(); });

describe("Greifer und Entfernen (QA H1)", () => {
  it("überlebt, wenn ein gegriffenes Teil gepresst wird, und die Welt steppt weiter", async () => {
    const sim = await createHeadlessSim({ level: "yard_v2", seed: 42, spawnPile: false });
    const item = sim.scrap.spawn({ materialId: "steel", massKg: 40, shape: "beam", at: { x: 0, y: 0.5, z: 3 } });

    sim.excavator.teleportGrappleOver(item.id);        // Test-Helfer, nur in sim/testing
    sim.control.grapple = 1;                            // schließen
    sim.run(60);                                        // 1 s
    expect(sim.grip.heldIds).toContain(item.id);

    sim.scrap.requestRemove(item.id, "press");          // wie Presse/Verkauf/Bündeln
    sim.run(1);
    expect(sim.grip.heldIds).not.toContain(item.id);    // Greifer hat losgelassen (itemRemoving-Event)
    expect(sim.physics.safeBody(item.bodyHandle)).toBeNull();

    sim.control.grapple = -1;                           // öffnen — hier stürzte der Prototyp ab
    expect(() => sim.run(120)).not.toThrow();
    expect(sim.physics.world.bodies.len()).toBeGreaterThan(0);
  });

  it("Haufen schläft innerhalb von 10 s ein (QA Sleep)", async () => {
    const sim = await createHeadlessSim({ level: "yard_v2", seed: 1, spawnPile: true });
    sim.run(600);
    const awake = sim.scrap.items.filter(i => !sim.physics.safeBody(i.bodyHandle)!.isSleeping()).length;
    expect(awake).toBeLessThanOrEqual(5);
  });
});
```

`createHeadlessSim` baut `WorldState`, `PhysicsWorld`, `Level` aus JSON und registriert alle Systeme — ohne `view/`, `ui/`, `audio/`. Genau das ist im Prototyp unmöglich, weil `ItemManager` eine `THREE.Scene` verlangt.

---

## 10. Pflichtpunkte für neue Module (aus QA-Befund)

| Pflicht | Regel in v2 | Prüfung |
|---|---|---|
| **H1 isValid/onRemoved** | Entfernen nur über `requestRemove` → `itemRemoving`-Event → Owner löschen. `safeBody()` statt roher Handles. | Sim-Test 9.1, Lint: `removeRigidBody` nur in `PhysicsWorld.ts` |
| **H2 Save-Validierung, Autosave** | Kap. 7 Punkte 1–4 | Fixture-Tests mit kaputten Saves; Smoke-Test lädt jedes Fixture |
| **Sleep-Haufen** | Spawn mit Mindestabstand + Vor-Setzen: Haufen beim Start N=300 Steps kopflos simulieren, dann `sleep()` erzwingen; Solver 6 Iter/2 Reibung, `contact_natural_frequency` 30, `allowedLinearError` 0,005 (Werte in balancing.json, per Test gegen Einschlafzeit) ; harte Obergrenze Körper (Deckel 220, danach Bündeln erzwungen) | Sim-Test „awake ≤ 5 nach 10 s"; Fuzz zählt wache Körper |
| **Instancing/Merge** | `YardView` mergt Statik (`mergeGeometries`) → ≤ 20 Draw Calls; `ScrapView` = `InstancedMesh` je Form (Box, Beam, Coil …) mit Farbe per Instanz; Ziel ≤ 300 Draw Calls, ≤ 150 Schattenwerfer; Spots bei Tag `visible=false`; Schatten 1024², `castShadow` nur Bagger/LKW/Karossen | Smoke zählt `renderer.info.render.calls` |
| **dispose** | `ViewRegistry` ist der einzige Ort, der Meshes erzeugt/entfernt; entfernt → `geometry.dispose()`/`material.dispose()` für Unikate; geteilte Ressourcen in `AssetCache` mit Referenzzählung | Smoke: `renderer.info.memory.geometries` nach 200 Spawn/Remove-Zyklen konstant |
| **Interpolation** | GameLoop liefert `alpha = accumulator/FIXED_DT`; `Interpolation.ts` hält `prev/curr` je Pose; ViewSync mischt. Physik-Rate aus `balancing.json` (60 Hz Desktop, 30–50 Hz Mobil per Qualitätsstufe) | Sim-Test: Pose zwischen Steps monoton; Gerät: 120-Hz-iPhone ohne Doppelbild |
| **Greifen ohne Fixed Joint** | Kap. 10.2 | Sim-Test „gegriffenes Teil zittert nicht (Δpos < 1 mm/Step) und bleibt beim Öffnen mit Spinnen-Geschwindigkeit frei" |
| **Keine Allokation im Step** | Tmp-Vektoren als Modulfelder; Lint-Regel `no-restricted-syntax` für `new` in `update()` (Warnung) | Fuzz: GC-Spitzen < 10 ms |

### 10.2 Greifen kinematisch (Fahrzeug-Muster statt Fixed Joint)

Prototyp: Fixed Joint zwischen kinematischer Spinne (unendliche Masse) und dynamischem Teil → Solver kämpft, zittert, Impulsexplosionen (`qa-tester.md` Kap. 6.1). Die LKW-Ladung macht es im Prototyp bereits richtig (`vehicles.ts:511–521`).

v2-Ablauf:
1. Schließen erreicht Greif-Fenster → Sensor-Abfrage (Kugel) → Kandidaten, die im Schalenkorb liegen.
2. Für jedes gefasste Teil: `body.setBodyType(KinematicPositionBased)`, lokale Pose relativ zur Spinne merken, Kollider-Gruppe auf „Ladung" (kollidiert mit Boden/Haufen nur als Sensor, nicht als Kraft — Layer-Maske).
3. preStep: Pose = Spinnen-Pose × lokale Pose (`setNextKinematicTranslation/Rotation`) → Rapier interpoliert die Geschwindigkeit korrekt.
4. Masse-Gefühl kommt aus der Kinematik des Baggers (Lastfaktor, Pendel-Dämpfung), nicht aus dem Solver.
5. Öffnen: `setBodyType(Dynamic)`, Geschwindigkeit = Spinnen-Geschwindigkeit (aus Pose-Differenz), Kollider-Gruppe zurück → Werfen funktioniert physikalisch.
6. „Abrutschen" unter Last = Zeitfunktion in der Simulation (GDD), nicht Solver.
7. Reißen (Karossenteile) bleibt wie im Prototyp eine Zeit-/Gewalt-Funktion.

---

## 11. Migrationsreihenfolge mit „Fertig, wenn"

Jede Stufe hinterlässt ein spielbares Spiel im neuen Ordner. Reine Logik-Module werden in Stufe 0 kopiert und bleiben danach unangetastet.

| Stufe | Inhalt | Fertig, wenn … |
|---|---|---|
| **0 Gerüst** (2–3 Tage) | `v2/web` anlegen, Lint-Gate, tsconfig strict, Vitest, Playwright; `shared/`, `data/` mit Schemas; 97 Unit-Tests kopiert; Rapier ohne -compat via WASM-Plugin; Capacitor als devDependency, `cap add android` einmal auf Windows durchgezogen | `npm run lint && npm test` grün; Bundle < 1,2 MB JS + WASM separat; leere Szene läuft auf iPhone-Safari und als Android-APK |
| **1 Kern-Sim** (1 Woche) | `WorldState`, `PhysicsWorld` (safeBody, Sleep-Parameter aus balancing.json), `Level` aus `level_yard.json`, Scheduler, `ControlFrame`, `ScrapSystem` (Spawn/Remove/Deckel), `ExcavatorSystem` (Kinematik aus Prototyp-`update()` ohne Meshes), `ExcavatorColliders`, `GripSystem` kinematisch, `ContainerSystem` | Sim-Tests 9.1 grün; Haufen schläft ≤ 10 s; Greifen/Absetzen 100 Zyklen im Fuzz ohne Explosion (> 20 m/s = 0); Scheduler-Snapshot vorhanden |
| **2 Sicht** (1 Woche) | `Renderer` mit Qualitätsstufen, `ViewRegistry` + dispose, `Interpolation`, `YardView` gemergt, `ScrapView` instanziert, `ExcavatorView` (Modellbau aus Prototyp portiert), `CameraRig`, `InputMapper` + Touch | **Go/No-Go-Messung:** iPhone-Safari und Mittelklasse-Android ≥ 30 fps bei 220 Körpern mit wachem Haufen, ≤ 300 Draw Calls, Frame-Zeit p95 < 30 ms; Touch: zwei Sticks + Griff gleichzeitig ohne Fingerverlust |
| **3 Betrieb** (1–2 Wochen) | `TruckSystem` datengetrieben (truck_phases.json), Waage, `EconomySystem`, `CustomerSystem`, `StaffSystem`, `LaneSystem`, `PressSystem`, `CompositeSystem`; HUD, Toasts | Eine Privat-Fuhre in < 5 min spielbar (GDD Loop „Minuten"); Sim-Test „LKW-Ablauf von Einfahrt bis Ausfahrt in N Steps" grün; H1-Wege (Presse/Verkauf/Bündeln in der Spinne) im Fuzz 0 Fehler |
| **4 Tag & Aufträge** (1 Woche) | `DaySystem`, `MissionSystem` (missions.json), Morgen-Karte, Abend-Bilanz, Sterne, `UpgradeSystem` (upgrades.json), `TutorialSystem` (Tag 0) | Tag 1 spielbar 12–20 min; Tester erfüllt 2/3 Aufträge ohne Hilfe; Aufträge sind Daten (neuer Auftragstyp ohne Code außer Bedingungs-Funktion) |
| **5 Persistenz** (3 Tage) | `SaveService` mit Validierung, Migration, Autosave, Adapter Web/Capacitor, Broken-Save-Fallback | Kaputte Fixture-Saves starten mit Meldung statt Schwarzbild; App-Kill auf Android → Fortschritt max. 60 s alt; Save-Roundtrip-Test (save → load → identischer Snapshot) |
| **6 Politur & Store** (1–2 Wochen) | Audio auf Events, Radio, Partikel, Daylight, `EntitlementSystem` (Premium-Unlock Tag 3 mit Play-Billing-Receipt), Einstellungen, Qualitätsschalter automatisch, Store-Assets | Store-Checkliste (`docs/10_Store_Veroeffentlichung.md`) abgehakt; 30-Minuten-Session auf Mittelklasse-Android ohne Absturz, Speicher stabil (±10 %), Wärme ok |

Gesamt: ~7–9 Wochen bis Store-Kandidat, bei einer Person plus Agent. Stufe 2 ist das Tor: fällt die Messung durch, greift die Unity-Testspur (Kap. 12) als Hauptspur — und die Daten/Formeln aus Stufe 0–1 sind bereits engine-neutral.

---

## 12. Unity-Testspur (Prio 2)

Ziel: mit einem kleinen Vergleichsprototyp prüfen, ob Unity bei Physikgefühl und Mobil-Leistung so viel besser ist, dass der Wechsel den kompletten Neubau rechtfertigt. Dieselbe Architektur, andere Werkzeuge:

### 12.1 Abbildung der Schichten

| v2-Web | Unity | Hinweis |
|---|---|---|
| `data/*.json` + Schema | **ScriptableObjects** (`MaterialCatalog`, `CustomerSet`, `CarDef`, `Balancing`, `MissionSet`) — im Editor editierbar, versionierbar | JSON-Import per Editor-Skript möglich, damit Web und Unity dieselbe Quelle nutzen |
| `level_yard.json` | Szene mit Prefabs + `LevelDef`-ScriptableObject für Zonen/Routen; Kollider kommen aus der Szene (kein zweites Hindernis-Modell nötig: kinematische Akteure nutzen `Physics.OverlapBox`/`NavMesh`) | Vorteil Unity: „drei Wahrheiten"-Problem verschwindet von selbst |
| `sim/` (reine Klassen) | **reine C#-Klassen** (`ExcavatorModel`, `GripLogic`, `Economy`, `DaySystem`, `Missions`) ohne `MonoBehaviour`, in einer Assembly `Sim.asmdef`, die **nicht** auf `UnityEngine.UI`/Rendering verweist | testbar mit NUnit im Edit-Mode; `UnityEngine.Physics` ist erlaubt (Pendant zu Rapier) |
| Scheduler | ein `GameLoop : MonoBehaviour` mit `FixedUpdate` (Physik-Systeme) und `Update` (Sicht), das eine geordnete Liste `ISystem` aufruft — **nicht** 20 MonoBehaviours mit eigener Update-Reihenfolge | Reihenfolge explizit halten; Script Execution Order nicht als Ersatz nutzen |
| EventBus | C#-`event`/`Action<T>` in einer `GameEvents`-Klasse oder leichtes Message-System | keine `SendMessage`/`FindObjectOfType` |
| `view/ViewRegistry` | `Presenter`-MonoBehaviours je Entitätstyp, die Sim-Ids auf GameObjects abbilden; Pool statt Instantiate/Destroy | GPU-Instancing + Static Batching sind eingebaut |
| ControlFrame | dieselbe Struktur, gefüllt aus dem **Input System** (Actions-Asset = controls.json) | On-Screen-Sticks aus dem Input System |
| SaveService | JSON via `System.Text.Json` oder Newtonsoft, `Application.persistentDataPath`, gleiche Versionierung | Saves können im Format mit Web kompatibel bleiben |

### 12.2 Physik-Bausteine

- **Bagger-Arm:** kinematische Kette aus `Rigidbody.isKinematic = true` mit `Rigidbody.MovePosition/MoveRotation` in `FixedUpdate` (nie `transform` direkt — sonst keine korrekte Kontakt-Geschwindigkeit). `Collision Detection: Continuous Speculative` für Spinne. Interpolation `Rigidbody.interpolation = Interpolate`.
- **Greifen ohne Fixed Joint:** gefasstes Teil wird zum Kind des Greifers **und** `isKinematic = true` (Pendant zu Kap. 10.2); Öffnen: parent lösen, `isKinematic = false`, `velocity = Greifergeschwindigkeit`. Alternativ `ConfigurableJoint` mit Feder — für den Vergleich beides bauen und messen.
- **Physics Layers:** `Scrap`, `HeldScrap`, `Excavator`, `Truck`, `Static`, `Sensor`; Matrix: `HeldScrap` ↔ `Scrap` aus, `HeldScrap` ↔ `Static` aus (Sensor-Only), `Excavator` ↔ `Scrap` an. Damit schiebt die Spinne Material, die Ladung aber nicht.
- **Sleep:** `Physics.sleepThreshold` (Projekt-Setting, Energie) hochsetzen, Haufen mit `Rigidbody.Sleep()` nach dem Vor-Setzen; `Physics.defaultSolverIterations` 6 / `defaultSolverVelocityIterations` 1; `Fixed Timestep` 0,02 (50 Hz) mit `Maximum Allowed Timestep` 0,1.
- **Kollider:** nur Primitive (Box/Capsule/Sphere) wie im Prototyp; keine MeshCollider auf Schrott.
- **Renderer:** URP, Forward, ein Directional-Light mit Cascaded Shadows 1024, SRP Batcher an, Static Batching für Platz, GPU Instancing auf Schrott-Material.

### 12.3 Der 2-Wochen-Vergleichsprototyp

**Umfang (bewusst klein):** Platz als Ebene mit vier Wänden, Bagger als kinematische Kette (Fahrwerk, Oberwagen, Ausleger, Stiel, Spinne mit 4 Schalen), 150-Teile-Haufen aus 5 Formen und 3 Materialien, zwei Zielzonen (Stahl-Haufen, Alu-Box), Touch-Steuerung mit zwei Sticks + Griff-Button, HUD mit Griff-Info. Kein LKW, keine Wirtschaft, kein Tag.

**Woche 1:** Szene, Bagger-Kinematik (Rampen/Lastfaktor 1:1 aus `excavator.ts:1015–1176` als C#), Greifen kinematisch, Haufen-Spawn mit Vor-Setzen, Zonen-Zählung mit Events.
**Woche 2:** Touch (Input System On-Screen), Android-Build (Windows), Messungen, iPhone entfällt (kein Mac) — Vergleich läuft auf demselben Android-Gerät wie Web-Stufe 2.

**Gemessen wird (identisch für Web-Stufe 2, gleiches Gerät, gleicher Haufen, gleiches Skript „100 Greifzyklen"):**

| Messgröße | Web-Ziel (Stufe 2) | Unity-Erwartung | Werkzeug |
|---|---|---|---|
| Frame-Zeit p50/p95 bei 220 Körpern, Haufen wach | < 25 / < 33 ms | < 16 / < 25 ms | Web: Debug-Overlay + Performance API; Unity: Profiler auf Gerät |
| Physik-Step | < 8 ms | < 4 ms | ebd. |
| Draw Calls / SetPass | ≤ 300 | ≤ 150 | `renderer.info` / Frame Debugger |
| Zeit bis Haufen schläft | ≤ 10 s | ≤ 5 s | Zähler wacher Körper |
| Explosionen (> 20 m/s) in 100 Greifzyklen | 0 | 0 | Fuzz-Skript |
| Zittern gehaltenes Teil | < 1 mm/Step | < 1 mm/Step | Pose-Δ loggen |
| Touch: Fingerverlust bei 3 gleichzeitigen Berührungen | 0 in 5 min | 0 in 5 min | manuell + Log |
| Kaltstart bis spielbar | < 4 s | < 3 s | Stoppuhr/Log |
| Speicher nach 30 min | stabil ±10 % | stabil ±10 % | Chrome-Remote-Devtools / Profiler |
| APK-Größe | < 15 MB | < 40 MB | Build |

**Abnahmekriterien für „Unity wird Hauptspur":** Unity erfüllt alle Zeilen **und** Web-Stufe 2 verfehlt mindestens eine der drei fett zu nehmenden Zeilen (Frame-Zeit p95, Explosionen, Fingerverlust) auch nach einer Woche Optimierung. Ansonsten bleibt Web Hauptspur und die Unity-Erkenntnisse (Layer-Matrix, Greif-Variante, Sleep-Werte) fließen als Zahlen in `balancing.json`.

**Was der Vergleich NICHT beantwortet:** Wirtschaft, Aufträge, Story, Save — das ist engine-neutral und liegt bereits in Daten/Formeln vor.

---

## 13. Events (vollständige Liste v2)

Typisiert in `shared/events.ts`. Konvention: Vergangenheitsform, Payload nur Ids und Zahlen (keine Objekte, keine Three-Typen). `itemRemoving` ist das einzige „vorher"-Event (Kap. 4).

| Event | Payload | Sender → typische Hörer |
|---|---|---|
| `itemSpawned` | id, materialId, massKg, shape | Scrap → View, Container |
| `itemRemoving` | id, bodyHandle, reason (`press`\|`sold`\|`merged`\|`despawn`) | Scrap → Grip, Container, Truck, View, Audio |
| `itemRemoved` | id | Scrap → Mission-Statistik |
| `itemEntered` / `itemLeft` | itemId, containerId, correct, massKg | Container → Economy (Prämie), Audio, HUD, Tutorial, Mission |
| `itemsMerged` | ids[], newId | Scrap → View |
| `itemFlattened` | id | Grip/Scrap → View, Audio |
| `grabbed` / `released` | ids[], totalKg, releaseVelocity | Grip → Audio, HUD, Tutorial |
| `tearStarted` / `tearProgress` / `partTorn` | carId, partId, progress01 | Grip/Composite → HUD, Audio, Mission |
| `glassShattered` / `carCrushed` | carId, pos, stage | Composite → Audio, Particles |
| `groundContact` | intensity, pos | Excavator → Audio, Particles |
| `armBlocked` / `outriggersChanged` / `bladeChanged` | state | Excavator → HUD |
| `truckSpawned` / `truckPhaseChanged` / `truckDeparted` | truckId, kind, customerId, phase | Truck → View, HUD, Mission |
| `customerArrived` | customerId, greeting | Truck → HUD |
| `weighedIn` / `weighedOut` | truckId, kg, sortedMaterial | Truck → Economy, HUD, Mission |
| `purchaseSettled` | truckId, netKg, eur, factor | Economy → HUD, Reputation, Mission |
| `pickupOrdered` / `pickupLoaded` | material, kg, purity | Truck/Container → HUD |
| `saleCompleted` | materialId, kg, purity, eur | Economy → HUD, Audio, Mission, Day |
| `honked` / `laneBlocked` / `laneCleared` | truckId / itemId, pos | Truck/Lane → HUD, Audio |
| `pressStarted` / `pressLidsClosed` / `pressStamped` | count, pos | Press → Audio, Particles, HUD |
| `fenceBroken` | id, pos | Scrap → Audio, Particles |
| `moneyChanged` | eur, delta, reason | Economy → HUD |
| `creditStateChanged` | insolvent: boolean | Economy → HUD, Truck (Lieferstopp) |
| `reputationChanged` | group, value, cause | Reputation → HUD |
| `upgradePurchased` | id | Upgrade → View, HUD, Systems (Modifikatoren lesen aus Snapshot) |
| `dayPhaseChanged` | day, phase (`morning`\|`operating`\|`closing`\|`evening`) | Day → UI, Truck (Tor zu), Audio |
| `missionsIssued` / `missionProgress` / `missionCompleted` / `missionFailed` | missionId, progress01, bonus | Mission → HUD, Day |
| `dayReport` | day, income, expenses, stars, missions[] | Day → UI, Save |
| `tutorialStep` / `tutorialFinished` | index | Tutorial → UI |
| `entitlementChanged` | premium: boolean | Entitlement → UI, Day (Tag-3-Sperre) |
| `saveRequested` / `saved` / `saveFailed` | reason | App/Day → SaveService → HUD |
| `qualityChanged` | level | App → View |

Regel: Ein Event ohne Hörer oder ohne Sender ist ein Lint-Fehler (kleines Skript zählt `emit("x")` und `on("x")` — verhindert den Prototyp-Zustand „grabbed nie gefeuert, itemLeft nie gehört").

---

## 14. Offene Entscheidungen (mit Vorschlag)

| Frage | Vorschlag | Bis wann |
|---|---|---|
| Physik-Rate Mobil 30 vs. 50 Hz | Stufe 2 messen; Standard 50 Hz, Fallback 30 Hz per Qualitätsstufe | Stufe 2 |
| UI DOM vs. Canvas | DOM bleibt (schnell, lokalisierbar); Weltbeschriftung als Sprites | fest |
| Rapier SIMD-Build | prüfen, ob `rapier3d-simd` in iOS-Safari läuft (WASM-SIMD ab iOS 16.4) — sonst Standard | Stufe 0 |
| Modelle prozedural vs. glTF | Bagger/LKW bleiben prozedural (kein Blender-Workflow ohne Mac ist ok), aber als eigene `view/models`-Module ohne Sim-Bezug | fest |
