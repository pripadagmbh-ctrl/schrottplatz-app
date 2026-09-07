# Portierungsliste Prototyp → v2

Stand 2026-09-02 · Quelle: `prototype/src/**` (44 Dateien, 12 309 Zeilen). Ziel: `v2/web/src/**` (Struktur in `02_Architektur_v2.md` Kap. 3) und Unity-Testspur (Kap. 12).

**Kategorien:**
- **Ü** = 1:1 übernehmen (kopieren, ggf. Importpfade und Typen anpassen; Verhalten unverändert; vorhandene Tests mitnehmen).
- **T** = Logik/Algorithmus übernehmen, neu geschnitten (Klasse auseinandernehmen, Three/DOM raus, in System-Interface einpassen).
- **R** = neu schreiben (Design und Zahlen dienen als Vorlage, Code nicht).

**Pflichtpunkte** (aus `review/qa-tester.md`), die für die betroffenen neuen Module gelten und in der Spalte „Pflicht" abgekürzt sind:
- **H1** = Entfernen nur über `requestRemove` → `itemRemoving`-Event; `safeBody()`; nie `wakeUp()`/`translation()` auf ungeprüftem Handle.
- **H2** = Save-Validierung je Eintrag, fehlertoleranter Boot, Autosave.
- **SLP** = Haufen muss einschlafen (Spawn-Abstand, Vor-Setzen, Solver-Werte aus balancing.json, Körper-Deckel).
- **INS** = Instancing/Merge: statische Geometrie zusammenführen, Schrott als `InstancedMesh`, Schattenwerfer begrenzen.
- **DSP** = `dispose()` für Geometrie/Material beim Entfernen; geteilte Ressourcen mit Referenzzählung.
- **INT** = Render-Interpolation zwischen Physik-Steps (prev/curr-Pose, alpha).
- **ALC** = keine Allokationen im Step (Tmp-Objekte als Felder).

---

## 1. core/

| Quelle | Kat. | Ziel v2 (Web) | Was ändert sich | Pflicht | Unity |
|---|---|---|---|---|---|
| `core/events.ts` — EventBus | **T** | `shared/events.ts` | `off()`, `once()`, Frame-Queue (Events werden gesammelt und nach `postStep` ausgeliefert), vollständige Eventliste (Arch. Kap. 13); Lint-Skript „jedes Event hat Sender und Hörer" | — | `GameEvents`-Klasse mit C#-`event Action<T>`; kein `SendMessage` |
| `core/input.ts` — Tastatur/Maus, `axis()`, `wasPressed()` | **T** | `app/InputMapper.ts` (Tastatur-Quelle) | Ausgabe ist ein `ControlFrame`, keine Tastencodes mehr in der Simulation | — | Input System Actions-Asset; `ControlFrame` als C#-Struct |
| `core/touch.ts` — Sticks, Buttons, Druckgriff, Neigung, Zoom-Sperre (503 Z.) | **T** | `app/touch/VirtualSticks.ts`, `app/touch/TouchButtons.ts`, `app/touch/BrowserGuards.ts` | Pointer-Capture, Zoom-/Doppeltipp-/Kontextmenü-Sperre, Druck-Erkennung und Neigung übernehmen; **Tastencode-Emulation** (`bindTap("btn-cab","KeyX")`, Z. 86–96) entfällt: Buttons erzeugen `Action`-Einträge im ControlFrame | — | On-Screen-Stick/-Button des Input Systems; Layout aus dem Prototyp übernehmen |
| `core/controlConfig.ts` — Achsbelegung, Invertierung, localStorage | **Ü** (Logik) / **T** (Speicher) | `data/controls.json` (Defaults) + `app/InputMapper.ts` (Anwenden) + `app/platform/StorageAdapter` (Persistenz) | Datenmodell und `FUNCTION_LABELS` 1:1; Speichern über Adapter statt `localStorage` direkt | — | Input System Rebinding + PlayerPrefs |
| `core/save.ts` — Schema, `migrate()`, localStorage | **T** | `app/SaveService.ts`, `app/save/migrations/v1.ts`, `app/save/validate.ts` | Versionierungsgerüst übernehmen; Inhalt neu: jedes System liefert `save()/load()`; Validierung **je Item** (endliche Zahlen, bekannte `shape`, `materialId`); Broken-Save-Fallback; Autosave (`visibilitychange`, `pagehide`, Capacitor `appStateChange`, Tageswechsel, 60 s); IndexedDB/Filesystem statt localStorage | **H2** | JSON (`System.Text.Json`), `Application.persistentDataPath`, gleiche Versionierung; `OnApplicationPause` → Autosave |
| `core/debugOverlay.ts` | **T** | `ui/DebugOverlay.ts` | Zählung nur, wenn sichtbar (QA N1); zusätzlich Draw Calls, wache Körper, Step-Zeit p95 | — | Unity Profiler / eigenes Overlay |

## 2. physics/

| Quelle | Kat. | Ziel v2 (Web) | Was ändert sich | Pflicht | Unity |
|---|---|---|---|---|---|
| `physics/physicsWorld.ts` — Rapier-Wrapper, Solver-Parameter (Z. 15–19) | **T** | `sim/world/PhysicsWorld.ts` | Solver-Werte aus `balancing.json` (Start: 6 Iterationen, 2 Reibung, `contact_natural_frequency` 30, `allowedLinearError` 0,005 — per Sleep-Test gegenprüfen); **Body-Registry** handle→EntityId; `safeBody(handle)`; `removeRigidBody` nur hier; `counts()` nur bei Bedarf | **H1, SLP, ALC** | Physics-Settings (Solver 6/1, Sleep-Threshold, Fixed Timestep 0,02) |
| `physics/gripSystem.ts` — Greif-Fenster, Sensor, Reißen, Quetschen (241 Z.) | **T** | `sim/systems/GripSystem.ts` | **Fixed Joint raus**: gefasste Teile werden kinematisch mitgeführt (Arch. Kap. 10.2); Greif-Fenster 0,6–0,98, `MAX_ITEMS`, `MAX_TOTAL_KG`, `CRUSH_TIME` nach balancing.json; die 8 Callback-Felder (`getViolence`, `partResolver`, `crusher`, `insideGrapple` …) werden Abfragen über `ctx.get(ExcavatorSystem)`/`ctx.get(CompositeSystem)` bzw. Events; `releaseAll()`/`updateCrush()` nur über `safeBody`; hört `itemRemoving` | **H1, ALC** | `GripLogic` (reine C#-Klasse) + `GrapplePresenter`; Kind-Objekt + `isKinematic`, Layer `HeldScrap` |

## 3. excavator/

| Quelle | Kat. | Ziel v2 (Web) | Was ändert sich | Pflicht | Unity |
|---|---|---|---|---|---|
| `excavator/excavator.ts` `update()` Z. 1015–1176 — Rampen, Lastfaktor, Kabinenhub, Stützen, Schild, Rotator-Geschwindigkeit | **T** | `sim/systems/ExcavatorSystem.ts` (~300 Z.) | Eingabe aus `ControlFrame` statt `input.axis("KeyS","KeyW")`/`this.touch`; Konstanten (`DRIVE_MAX`, `BOOM_RATE`, `RAMP_TIME` … Z. 27–59) nach balancing.json; Modifikatoren (`getSpeedBonus`) aus Upgrade-Snapshot; Kollisions-Rückstellung (Z. 1131–1164) ersetzt durch gleitende Begrenzung (Shape-Cast vor Bewegung, Bewegung bis Kontakt) | ALC | `ExcavatorModel` (reine C#), Werte aus `Balancing`-ScriptableObject |
| `excavator.ts` `resolveGroundClamp()` Z. 1197–1235 (80-fach-Iteration) | **T** | `ExcavatorSystem.groundClamp()` | analytisch statt iterativ: Höhe der Zackenspitzen als Funktion von Boom/Stick berechnen und einmal klemmen (QA 6.3) | — | dito |
| `excavator.ts` `integratePendulum()` Z. 1314–1352 | **T** | `ExcavatorSystem.pendulum()` | Algorithmus übernehmen; Tmp-Quaternionen als Felder; Rückkopplung vom Haufen über `plowFactor` beibehalten | ALC | dito |
| `excavator.ts` `syncBodies()`/`updateClawColliders()` Z. 964–985, 1380–1473 | **T** | `sim/systems/ExcavatorColliders.ts` | Kollider nur bei Änderung der Spreizung umbauen (nicht jeden Step); beim Tragen **nicht** abschalten, sondern Layer-Maske „Ladung nicht mit Krallen" | ALC | kinematische `Rigidbody.MovePosition` in `FixedUpdate`; Layer-Matrix |
| `excavator.ts` `buildMeshes/buildCabin/buildOutriggers/buildNamePlate/buildBoomLogo/buildBlade/buildHydraulics` (~660 Z.) | **T** | `view/models/ExcavatorView.ts` (+ `HydraulicsView.ts`) | Meshbau 1:1 portieren, aber ohne Zugriff auf Sim-Felder: liest `ExcavatorSnapshot` (Winkel, Hub, Stützen, Schild, Spreizung) und interpoliert | INT, DSP | Prefab aus prozeduralem Editor-Skript oder einfache Blender-freie Primitive; Presenter liest `ExcavatorModel` |
| `excavator/collision.ts` — Arm/Fahrwerk gegen Hindernisliste, `plowFactor` (219 Z.) | **T** | `sim/systems/ExcavatorColliders.ts` (Kollision), `sim/world/Level.ts` (Hindernis-Query) | Hindernisliste kommt aus `level_yard.json`; Prüfung per Rapier-Shape-Cast statt AABB-Liste; die „nie vorzeitig abbrechen"-Kommentare (Z. 107, 161–163, 212) sind hinfällig (QA: Phantom) | H1 | `Physics.OverlapBox/CapsuleCast`; Kollider aus der Szene |
| `excavator/clawGeometry.ts` — Spinnen-Maße als eine Wahrheit | **Ü** | `sim/geometry/clawGeometry.ts` (Sim nutzt es für Kollider, View für Mesh) | keine Änderung; Tests mitnehmen | — | statische C#-Klasse `ClawGeometry` |
| `excavator/instruments.ts` — Kabinen-Display | **Ü** | `view/models/InstrumentsView.ts` | liest Snapshot statt `readout()` der Excavator-Klasse | DSP | Canvas-Textur → `RenderTexture` + UI Toolkit |
| `excavator/driver.ts` — Fahrerarme Ego-Sicht | **Ü** | `view/models/DriverView.ts` | unverändert | — | Prefab |
| `excavator/orbitCamera.ts` — drei Kameramodi | **T** | `view/CameraRig.ts` | Eingabe aus `ControlFrame.camOrbit/camZoom`; Ziel/Augpunkt aus Snapshot; Modi und Zahlen (3–18 m, 25 m Draufsicht, ±120°) übernehmen | — | Cinemachine oder eigenes Rig |

## 4. world/

| Quelle | Kat. | Ziel v2 (Web) | Was ändert sich | Pflicht | Unity |
|---|---|---|---|---|---|
| `world/yard.ts` — Platz-Geometrie + Kollider (671 Z.) | **R** | `data/level_yard.json` + `sim/world/Level.ts` (Kollider, Zonen, Routen-Prüfung) + `view/models/YardView.ts` (gemergte Geometrie) | Maße und Anordnung (80×58 m, Betonlego-Umrandung, Boxen bei x = 4,6, Berge bei (−22,−10)/(23,6)) übernehmen — als Daten; Betonlego (~1 530 Meshes) → 3 gemergte Meshes oder `InstancedMesh`; Graffiti „FC AARAU 1902" (Z. 436–444) durch Fantasienamen ersetzen | **INS, DSP** | Szene + Prefabs; Static Batching; `LevelDef`-ScriptableObject für Zonen/Routen |
| `world/obstacles.ts` — Hindernis-AABBs, `hitsObstacle`, `slideAround` | **T** (Funktionen) / **R** (Liste) | `sim/world/Level.ts` `obstacleQuery` | Funktionen `hitsObstacle`/`slideAround` und Test übernehmen; **Liste wird aus level_yard.json generiert** | — | entfällt (Szenen-Kollider + OverlapBox) |
| `world/scrapItems.ts` — `ScrapItem`, Spawner, Formen, Bündeln, Deckel, Highlight, Mesh-Sync (719 Z.) | **R** (Klasse) / **Ü** (Daten) | `sim/systems/ScrapSystem.ts` (Daten + Physik), `view/models/ScrapView.ts` (InstancedMesh je Form), `data/scrap_shapes.json` | `ScrapItem` ohne `mesh`; `PileSpec`, `randomCargo`, `maxSpeedFor/dampLin/dampAng`, Formen-Maße als Daten übernehmen; `spawnPile` mit Mindestabstand und Vor-Setzen (N Steps kopflos, dann `sleep()`); `consolidate` schließt gegriffene Teile aus und läuft ereignisgesteuert (ab Deckel), nicht per 4-s-Timer; `clampSpeeds` nur noch Notnagel mit Zähler (Event `speedClamped` → Fuzz-Metrik); `remove()` → `requestRemove()` + `itemRemoving` | **H1, SLP, INS, DSP, ALC** | `ScrapSpawner` (C#), Pool + GPU-Instancing, `Rigidbody.Sleep()` nach Vor-Setzen |
| `world/containers.ts` — Zonen-Zählung, Reinheit, Ampel, Labels (514 Z.) | **T** | `sim/systems/ContainerSystem.ts` (Zählung, Ampel-Zustand), `view/models/ContainerLabels.ts` | `CONFIGS` → level_yard.json `containers`; `recount()` mit gegriffenen Ids aus GripSystem und Hörer auf `itemRemoving`; Labels (Canvas-Sprites) in View; `document.createElement("canvas")` verlässt die Sim | H1 | Trigger-Volumen + `OnTriggerEnter/Exit` oder Zählung wie im Prototyp; Labels als TextMeshPro |
| `world/fence.ts` — zerstörbare Zaunfelder | **T** | `sim/systems/ScrapSystem.ts` (Zaun als besondere Items) + Level-Daten | Logik übernehmen (gelockte Dynamik, Losreißen bei Griff/Treffer); `contactPairsWith` je Feld pro Step (26×) → nur bei Kontakt-Event | ALC | Rigidbody `constraints` bis zum Bruch |
| `world/press.ts` — Schere/Presse (474 Z.) | **T** | `sim/systems/PressSystem.ts` + `view/models/PressView.ts` | Ablauf (Klappen, Stempel, Paket) übernehmen; `stamp()` darf gegriffene Teile **nicht** einsammeln (H1-Weg 1) → fragt GripSystem; Callbacks `onStart/onLidsClosed/onStamp` → Events `pressStarted/…` | **H1** | Animator-freie Kinematik in `FixedUpdate`; Trigger-Volumen |
| `world/people.ts` — Lambert-KI, Wiegehäuschen, Figur-Modellbau (674 Z.) | **T** | `sim/systems/StaffSystem.ts` (KI, Wegfindung), `view/models/PersonView.ts`, `view/models/OfficeView.ts` | 5 Callback-Felder (`getExcavatorPos`, `getBlockingItem` …) → Snapshot-Abfragen; Modellbau in View; Wegfindung gegen `Level.obstacleQuery` | ALC | NavMesh-Agent; Presenter |
| `world/loader.ts` — Radlader-Modell | **Ü** | `view/models/LoaderView.ts` | — | DSP | Prefab |
| `world/office.ts`, `world/signage.ts` | **Ü** | `view/models/OfficeView.ts`, `view/Signage.ts` | Positionen aus level_yard.json | INS | Prefab |
| `world/daylight.ts` — Tageslauf, Flutlicht | **T** | `view/Daylight.ts` | Zeitquelle ist `DaySystem` (Snapshot), nicht eigener Timer; Spots bei Tag `visible=false` (QA Draw Calls) | — | Light-Animation aus `DaySystem`-Zeit |
| `world/particles.ts` — fester Puffer | **Ü** | `view/Particles.ts` | Auslöser sind Events (`groundContact`, `glassShattered` …) | — | Particle System |

## 5. delivery/

| Quelle | Kat. | Ziel v2 (Web) | Was ändert sich | Pflicht | Unity |
|---|---|---|---|---|---|
| `delivery/customers.ts` — Gruppen, Familien, Fahrzeugwahl, Mengen (303 Z.) | **Ü** (Logik) + **T** (Daten) | `data/customers.json` + `sim/customers/rollCustomer.ts` | Tabellen in JSON, Funktionen `rollCustomer`, `vehicleForCustomer` bleiben; Tests mitnehmen; GDD-v2-Ton-Leitplanke beim Übertragen prüfen | — | `CustomerSet`-ScriptableObject + C#-Funktion |
| `delivery/routes.ts` — Wegpunkte, Zeiten, Konstanten (130 Z.) | **T** | `data/level_yard.json` `routes` + `data/balancing.json` (`SPEED`, `PARK_TIME_S`, `HONK_AFTER_S`, `BLOCK_GIVEUP_S`, Abstände 60–120 s nach GDD) | Punkte werden Daten; Test „Routen frei" gegen generierte Hindernisse | — | Waypoints in `LevelDef` oder NavMesh |
| `delivery/vehicles.ts` — 16-Phasen-Automat, Ladung, Waage, Manager (1100 Z.) | **R** | `sim/systems/TruckSystem.ts` + `data/truck_phases.json` | Phasenfolge und Zeiten als Daten (`{ "weighIn": { "minSeconds": 2.5, "next": "approach", "waitFor": "dealSettled", "timeoutSeconds": 32 } }`); Ladung-Mitführen (`lockToBed`, Z. 511–521) als `RidingCargo`-Helfer übernehmen (ist das Vorbild für den Greifer); 7 Callbacks → Events; `containedItems()` fragt GripSystem aus (H1-Weg 2); keine `new Quaternion()` im Step (Z. 805–835) | **H1, ALC, INT** | `TruckLogic` (C#-Zustandsautomat aus ScriptableObject-Phasen) + `TruckPresenter`; Ladung als Kind + kinematisch |
| `delivery/vehicleModel.ts` — LKW/PKW-Geometrie | **Ü** | `view/models/TruckView.ts` | Klappen-/Kipp-Animation liest Snapshot (`tip`, `sideOpen`); Materialien geteilt, `dispose` bei Despawn | DSP, INT | Prefabs je Fahrzeugtyp |
| `delivery/laneWatch.ts` — Fahrspur blockiert | **T** | `sim/systems/LaneSystem.ts` (slow ×60) | Routen aus Level; Events `laneBlocked/laneCleared` statt Polling in main | — | Trigger-Volumen entlang der Route |

## 6. dismantle/

| Quelle | Kat. | Ziel v2 (Web) | Was ändert sich | Pflicht | Unity |
|---|---|---|---|---|---|
| `dismantle/carDef.ts` — Karossen-Daten (100 Z.) | **Ü** → JSON | `data/cars.json` + `data/types.ts` (`CarDef`, `PartDef`, `WindowDef`) | 1:1 als Daten; Schema | — | `CarDef`-ScriptableObject |
| `dismantle/composites.ts` — Δv-Erkennung, Quetschstufen, Scheiben, Abreißen, `saveState/restoreState` (427 Z.) | **T** | `sim/systems/CompositeSystem.ts` + `view/models/CarView.ts` | Mechanik (Δv-Schwellen, Stufen-Kollidertausch, `findPartNear`, Reißzeit) übernehmen; Modell-Squash in View; `save/load` als System-Methoden; Teile-Abriss erzeugt Items über `ScrapSystem.spawn` | H1, DSP | `CarLogic` + Presenter; Kollidertausch per aktivierten Child-Collidern |

## 7. economy/ und materials/

| Quelle | Kat. | Ziel v2 (Web) | Was ändert sich | Pflicht | Unity |
|---|---|---|---|---|---|
| `economy/haggle.ts` — Verhandlungsformel | **Ü** | `sim/economy/haggle.ts` | unverändert; **Achtung GDD v2 Kap. 7**: fester Kurs statt Verhandlung im MVP — Modul bleibt für V1.1, wird nicht verdrahtet | — | statische C#-Klasse |
| `economy/reputation.ts` | **Ü** | `sim/systems/ReputationSystem.ts` (dünner System-Wrapper um die Klasse) | `save/load` statt `toJSON/load` | — | C#-Klasse |
| `economy/shift.ts` — Betrieb, BUSY/JAM | **T** | `sim/systems/DaySystem.ts` | GDD v2 Tagesstruktur (Morgen/Betrieb/Feierabend/Bilanz) ersetzt Dauerbetrieb; `intervalFactor`, `JAM_KG` als Zahlen in balancing.json; Tests anpassen | — | C#-Klasse `DayState` |
| `economy/upgrades.ts` — Stufen, Freischaltung | **Ü** (Logik) + **T** (Daten) | `data/upgrades.json` + `sim/systems/UpgradeSystem.ts` | Wirkungen als benannte Modifikatoren im Snapshot (`boomSpeed 1.35`, `gripCapacity 1.5`, `baleBonus 1.6`, `staffSpeed 1.4` — heute in `main.ts:456–459`) statt Abfragen `ausbau.has("boom")` in fremden Modulen; GDD v2: drei sichtbare Stufen | — | `UpgradeSet`-ScriptableObject |
| `economy/account.ts` — Konto, Ankauf, Sortierprämie, `sellContainer` (125 Z.) | **T** | `sim/systems/EconomySystem.ts` | Preislogik (Reinheit², dominante Fraktion, Kreditlimit) übernehmen; **`sellContainer` entfernt keine Items mehr** — es berechnet den Erlös aus einer Liste und feuert `saleCompleted`; das Entfernen macht `ScrapSystem` auf `truckDeparted`; Fixkosten je Tag (GDD) neu | H1 | C#-Klasse `Economy` |
| `materials/catalog.ts`, `materials/purity.ts` | **Ü** → JSON + Funktionen | `data/materials.json`, `sim/economy/purity.ts` | `normalizeMaterialId` in Save-Migration v1; Tests mitnehmen | — | `MaterialCatalog`-ScriptableObject; `Purity` statisch |

## 8. ui/, audio/, main.ts

| Quelle | Kat. | Ziel v2 (Web) | Was ändert sich | Pflicht | Unity |
|---|---|---|---|---|---|
| `ui/tutorial.ts` — Sequencer mit Kontext (147 Z.) | **Ü** (Muster) + **T** (Inhalt) | `sim/systems/TutorialSystem.ts`; dasselbe Muster für `MissionSystem.ts` | Kontext wird aus Snapshot/Events gefüllt statt aus main-Variablen (`tutSortiertKg` …); Inhalt nach GDD v2 Kap. 9 (Tag 0) | — | C#-Sequencer, Schritte als ScriptableObject |
| `ui/hud.ts` — Griff-Info, Geld, Ladung, Toast | **R** | `ui/Hud.ts`, `ui/Toasts.ts`, `ui/LoadIndicator.ts` | liest `HudSnapshot` (vom App-Layer gebaut) und Events; keine Physik-Typen; Element-Referenzen über ein `UiRoot`-Template statt 35 `getElementById` | — | UI Toolkit (UXML/USS) |
| Menüs in `main.ts` (Pause 251–319, Abholung 321–358, Shop 445–495, Verhandlung 497–543) | **R** | `ui/Menus.ts`, `ui/PickupDialog.ts`, `ui/ShopDialog.ts`; Verhandlung entfällt im MVP | Dialoge senden Actions/Kommandos (`orderPickup(material)`, `buyUpgrade(id)`) an Systeme; kein Spielzustand in UI | — | UI Toolkit |
| GDD-v2-neu: Morgen-Karte, Abend-Bilanz, Aufträge-Anzeige, Premium-Unlock | **R** | `ui/MorningCard.ts`, `ui/EveningReport.ts`, `ui/MissionPanel.ts`, `ui/UnlockDialog.ts` | aus `dayPhaseChanged`, `dayReport`, `mission*`, `entitlementChanged` | — | UI Toolkit; Unity IAP für Unlock |
| `audio/audioManager.ts` — prozedurale Sounds, Motor, Kratzen | **T** | `audio/AudioSystem.ts` | Klangerzeugung 1:1; Auslösung über Events (`itemEntered`, `grabbed`, `groundContact` …) statt 15 Aufrufe aus main; Autoplay-Handling behalten | — | AudioSource + prozedural per `OnAudioFilterRead` oder gebackene Clips |
| `audio/music.ts` — prozedurales Radio | **Ü** | `audio/Music.ts` | — | — | dito |
| `main.ts` `stepOnce()` Z. 610–637, Frame-Loop 683–909 | **R** | `app/GameLoop.ts` + `sim/systems/System.ts` (Scheduler) | Reihenfolge wird zur Registrierung; Akkumulator mit Interpolations-Alpha; Physik-Rate aus balancing.json; Nachhol-Deckel ohne „Akkumulator auf 0" (stattdessen Zeitlupen-Flag + Qualitätsstufe runter) | **INT** | `GameLoop : MonoBehaviour` (FixedUpdate/Update) |
| `main.ts` Boot aus Save Z. 103–145 | **R** | `app/main.ts` + `app/SaveService.ts` | try/catch, Fallback, Ladebild bis erstes Frame; Replay-Problem (Events beim Laden) gelöst: `ContainerSystem.load()` setzt Zuordnung ohne `itemEntered` | **H2** | `Bootstrap.cs` |
| `main.ts` Event-/Callback-Verdrahtung Z. 366–606 | **R** (entfällt) | — | wird durch Registrierung + Events ersetzt; die darin enthaltenen **Regeln** wandern in Systeme: Zahlungsdruck (845–855) → EconomySystem; Ladungs-Reinheitsanzeige (861–881) → `HudSnapshot`; Lose-Masse (240–249) → ScrapSystem.slow; Störfall-Meldung (825–830) → LaneSystem-Events | — | — |
| `main.ts` `window.__game` Dev-Handle | **T** | `app/devtools.ts` (nur DEV) | exponiert `sim`, `scheduler.describe()`, `fuzz(n)`; Playwright-Smoke nutzt es | — | Editor-Testfenster |
| `index.html` (429 Z., 63 IDs) | **R** | `index.html` (Canvas + `<div id="ui-root">`), UI-Templates in `ui/templates/*.html` | — | — | — |

## 9. Tests

| Quelle | Kat. | Ziel v2 | Hinweis |
|---|---|---|---|
| `test/haggle`, `customers`, `purity`, `upgrades`, `tutorial`, `save` (migrate) | **Ü** | `test/unit/` | Importpfade; save-Test um Fixtures mit kaputten Items erweitern (H2) |
| `test/shift.test.ts` | **T** | `test/unit/day.test.ts` | an DaySystem anpassen |
| `test/collision.test.ts` (Routen frei, Reichweite, clawGeometry) | **T** | `test/unit/level.test.ts`, `test/unit/claw.test.ts` | gegen generierte Hindernisliste aus level_yard.json |
| `v2/tools/qa/fuzz.mjs`, `crash_repro.mjs`, `rapier_stale.mjs`, `rapier_sleep.mjs`, `measure*.mjs` | **T** | `test/smoke/fuzz.spec.ts`, `test/sim/grip_remove.test.ts`, `test/sim/sleep.test.ts`, `test/smoke/metrics.spec.ts` | Aus Messskripten werden dauerhafte Tests mit Schwellen (Explosionen = 0, wach ≤ 5, Draw Calls ≤ 300, Geometrien konstant) |
| neu | — | `test/sim/scheduler.snapshot.test.ts`, `test/sim/truck_flow.test.ts`, `test/sim/save_roundtrip.test.ts`, `test/unit/events_wired.test.ts` | Arch. Kap. 9 |

---

## 10. Zusammenfassung nach Kategorie

| Kat. | Dateien/Teile | Zeilen (ca.) | Anteil |
|---|---|---|---|
| **Ü** | clawGeometry, instruments, driver, loader, office, signage, particles, vehicleModel, carDef, haggle, reputation, upgrades-Logik, catalog, purity, customers-Logik, tutorial-Muster, music, controlConfig-Logik, 6 Testdateien | ~2 300 | 19 % |
| **T** | events, input, touch, save, debugOverlay, physicsWorld, gripSystem, excavator-Kinematik/-Meshbau/-Kollider, collision, orbitCamera, obstacles-Funktionen, containers, fence, press, people, daylight, routes, laneWatch, composites, shift, account, audioManager, tutorial-Inhalt, 2 Testdateien, QA-Skripte | ~6 400 | 52 % |
| **R** | yard, scrapItems-Klasse, vehicles, hud, main.ts, index.html, Menüs, neue GDD-v2-UI | ~3 600 | 29 % |

**Unity-Kurzfassung:** Alles unter Ü/T mit reiner Logik (Wirtschaft, Kunden, Karosse, Tutorial/Aufträge, Bagger-Kinematik, Greif-Logik, LKW-Phasen, Reinheit, Save-Versionierung) wird 1:1 nach C# übersetzt — Zeilen sind neu, Verhalten und Zahlen identisch. Daten-Dateien werden ScriptableObjects (per Import-Skript aus denselben JSON, damit beide Spuren eine Quelle haben). Meshbau, Kollider-Sync, Touch, HUD und die Hindernisliste werden durch Unity-Bordmittel ersetzt (Prefabs, Rigidbody kinematisch, Input System, UI Toolkit, Szenen-Kollider). Der Vergleichsprototyp (Arch. Kap. 12.3) braucht davon nur: ClawGeometry, Bagger-Kinematik, Greif-Logik, Scrap-Spawner-Daten, Zonen-Zählung.
