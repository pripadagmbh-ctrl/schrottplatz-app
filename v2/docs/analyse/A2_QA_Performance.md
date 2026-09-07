# QA-Befund: Tests, Performance, Absturzrisiken

Rolle: qa-tester · Stand 02.09.2026 · Arbeitskopie: `/home/claude/sp/qa-work` (Original unangetastet)

Alle Pfade unten beziehen sich auf `prototype/` (identisch in `/home/claude/sp/proto/prototype/` und der Kopie). Messskripte liegen unter `/home/claude/sp/qa-work/qa/*.mjs` und sind wiederholbar.

**Legende:** BELEGT = selbst im Code gelesen oder im Lauf gemessen · VERMUTUNG = begründete Schlussfolgerung, nicht gemessen.

---

## 0. Kurzfassung (die fünf Dinge, die zählen)

1. **HOCH — Reproduzierbarer Totalabsturz der Physik:** Wird ein Teil entfernt, während es in der Spinne hängt (Presse, Verkauf per Abhol-LKW, automatische Bündelung), stürzt die Physik beim nächsten Loslassen ab (`RuntimeError: unreachable`), und **jede** weitere Physikabfrage wirft „recursive use of an object". Das Spiel steht dann für immer. Reproduziert im Browser.
2. **HOCH — Kaputter Spielstand = schwarzer Bildschirm für immer:** Ein Save mit fehlendem `shape` oder `null`-Position lässt `main()` abstürzen, *bevor* die Oberfläche steht; der Nutzer sieht nichts und kann auch nicht „Neues Spiel" wählen. Reproduziert.
3. **HOCH (Mobil) — 3 100 Meshes, 1 300 Schattenwerfer, kein Instancing:** Allein die Betonlego-Umrandung sind ~1 500 einzelne Meshes. Auf dem Handy ist das die Bildrate, nicht die Physik. Gezählt.
4. **HOCH (Mobil) — Der Schrotthaufen schläft nicht ein:** In 2 von 5 Läufen sind nach 50 s Simulation noch 76–98 von ~120 Teilen wach (Zittern mit 0,01 mm/s). Ein schlafender Haufen kostet 0,05 ms/Schritt, ein wacher 2,7–3,6 ms. Gemessen.
5. **MITTEL — Tests prüfen Rechnen, nicht Spielen:** 97 Tests grün, aber 9,6 % Zeilenabdeckung; Physik, Bagger, Greifer, Fahrzeuge, Welt (zusammen ~8 000 Zeilen) haben 0 %. Gemessen.

Die Zahl „2,78 ms/Physikschritt" aus `docs/Pruefung` konnte ich bestätigen (2,63–2,87 ms) — sie ist aber die Zahl eines Desktop-Prozessors mit wachem Haufen; siehe Abschnitt 3 für das, was daraus auf dem Handy wird.

---

## 1. Tests: Was `npm test` wirklich prüft

### BELEGT
- `npm install` und `npm test` laufen durch: **8 Dateien, 97 Tests, alle grün** in ~4 s (Vitest 2.1.9). Die Behauptung stimmt.
- Zeilenabdeckung mit `@vitest/coverage-v8` (nur in der Kopie installiert), alle `src/**`-Dateien einbezogen:

| Bereich | Zeilen | Abdeckung |
|---|---|---|
| `src/economy/*` (Konto, Ruf, Verhandeln, Schicht, Ausbau) | ~620 | **86 %** |
| `src/materials/*`, `src/delivery/customers.ts`, `routes.ts`, `ui/tutorial.ts`, `world/obstacles.ts`, `excavator/clawGeometry.ts` | ~600 | 96–100 % |
| `src/core/save.ts` | 99 | 56 % (nur `migrate`) |
| `src/main.ts` | 917 | **0 %** |
| `src/excavator/excavator.ts`, `collision.ts`, `driver.ts`, `instruments.ts`, `orbitCamera.ts` | ~2 170 | **0 %** |
| `src/physics/*` (Rapier-Welt, Greifsystem) | 283 | **0 %** |
| `src/delivery/vehicles.ts`, `vehicleModel.ts`, `laneWatch.ts` | ~1 500 | **0 %** |
| `src/world/*` außer obstacles (Yard, Items, Container, Presse, Personal, Zaun, Licht …) | ~3 900 | **0–1 %** |
| `src/dismantle/*`, `src/audio/*`, `src/core/touch.ts`, `ui/hud.ts` | ~1 400 | **0 %** |
| **Gesamt** | 13 228 | **9,6 %** |

- Die Aussage aus `docs/Pruefung` („world/ ~4 000 Zeilen ohne Tests") stimmt und ist eher untertrieben: Es sind nicht nur `world/`, sondern **alles, was Physik, Three.js oder das DOM berührt**. Die Testdateien importieren ausschließlich reine Rechenmodule (`test/*.ts`, Import-Liste geprüft) — kein Test erzeugt eine Rapier-Welt, keiner einen Bagger, keiner ein Fahrzeug.
- Was die Tests inhaltlich sind (Namen der `describe`-Blöcke): Feste Bauten/Reichweite (Geometrie-Rechnung), Greifergeometrie (Kurvenformeln), Kundschaft, Ruf, Verhandeln, Reinheit/Containerwert, Spielstand-Migration, Betrieb (Schichtlogik), Geführter Einstieg, Ausbau, Zahlungsdruck. Das sind **Einheitentests für Formeln und Zustandsautomaten**. Für „neue Features brechen Bestehendes" (Patricks Punkt 1) fangen sie fast nichts ab, weil das Brechen in `main.ts`, `excavator.ts`, `vehicles.ts` passiert.
- `test/save.test.ts` „kaputte Daten werden abgelehnt (kein Absturz)" prüft nur die oberste Ebene (`schemaVersion`, Arrays vorhanden). Die Einzelteile werden nicht geprüft — siehe Befund H2.

### Was fehlt (Gegenmaßnahme)
- **Headless-Integrationstests sind möglich und billig:** Rapier-compat läuft in Node ohne Browser (habe ich benutzt, `qa/rapier_node.mjs`). `GripSystem`, `ExcavatorCollision`, `ItemManager.clampSpeeds/consolidate`, `PressManager.stamp` ließen sich mit einer echten `RAPIER.World` testen, sobald man Three.js-Szene und DOM per Parameter statt global hereinreicht. Die Scene-Abhängigkeit ist der Blocker: `ItemManager` will eine `THREE.Scene`, das geht in Node zwar (Three ist DOM-frei), aber `containers.ts`/`yard.ts` erzeugen `document.createElement("canvas")`.
- **Ein Smoke-Test wie mein `qa/fuzz.mjs`** (Playwright, 6 000 Schritte Zufallseingabe, Fehler/NaN/Ausreißer zählen) sollte vor jedem Commit laufen. Er hat in 100 s Spielzeit keinen Fehler geworfen, aber 12 Physik-Explosionen (>20 m/s, max. 55 m/s ≈ 200 km/h) entdeckt, die `clampSpeeds` wegbügelt.

---

## 2. Build

### BELEGT
- `npm run build` (`tsc --noEmit && vite build`) läuft fehlerfrei in 8,5 s.
- Ergebnis exakt wie dokumentiert: `dist/assets/index-*.js` **2 741 kB (gzip 949 kB)**, `dist/index.html` 22 kB. Ein Chunk, keine Aufteilung, keine Sourcemaps.
- Einzige Warnung: Vite „chunk larger than 500 kB". Kein TypeScript-Fehler, keine Lint-Stufe vorhanden (kein ESLint/Prettier im Projekt).
- Ladezeit bis „Spiel bereit" (Loading-Element entfernt): **2,8 s** im Preview-Build, 2,5 s im Dev-Server — auf diesem Rechner via localhost. Die „20 Sekunden" aus `03_Messanleitung.md` sind nicht reproduzierbar; vermutlich Windows-Dateisystem plus kalter Vite-Cache.
- `capacitor.config.json` ist vorhanden, Capacitor selbst ist **nicht** in `package.json` (weder `@capacitor/core` noch `cli`). `npm run android:add` würde `npx cap` erst herunterladen. Ein Android-Build wurde also noch nie gemacht (VERMUTUNG, aber die fehlende Abhängigkeit ist BELEGT).

### Einordnung
949 kB gzip sind für einen Store-Download tragbar, für eine Web-Demo grenzwertig. Die WASM-Datei von Rapier (~2 MB) ist als Base64 im JS eingebettet (`rapier3d-compat`), was den Chunk um ~30 % aufbläht; die Nicht-compat-Variante würde die WASM separat laden, braucht aber Vite-WASM-Konfiguration.

---

## 3. Physik-Kosten: selbst nachgemessen

### Aufbau (BELEGT)
Headless Chromium 141 (Playwright, SwiftShader-Software-GPU) gegen den Dev-Server, `window.__game.step(n)` wie in `03_Messanleitung.md`, jeweils Median aus drei Läufen nach Aufwärmen. Zusätzlich Rapier direkt in Node (`qa/rapier_node.mjs`, `qa/rapier_sleep.mjs`). Prozessor dieser Sandbox ≈ Desktop-Klasse. **Rendering ist mit SwiftShader nicht bewertbar** (0,2 fps, reine CPU-Emulation) — dafür habe ich Objektzahlen gezählt (Abschnitt 5).

### Welt zu Spielbeginn (gezählt über `world.bodies/colliders`)
- 153 Körper: 130 dynamisch (Schrott, 2 Karossen, Zaunfelder), 8 kinematisch (Bagger-Teile), 15 fest. Nach 10 s: 160 Körper (Fahrzeug angekommen: +7 kinematisch).
- 189–198 Kollider, **nur Primitive**: 139–147 Quader, 31 Kapseln, 10 Zylinder, 7–8 Kugeln, 2 Kegel. **Kein Trimesh, kein Convex-Hull** — das ist gut.
- 0 Sensoren, 0 Joints im Leerlauf (Joints entstehen nur beim Greifen, max. 5).
- Formabfragen pro Schritt: `plowMassKg` 1× (`collision.ts:106`), `grappleHitsBody` 1–2× (`:159`), `armHitsVehicle` 0–4× (`:210`, nur bei Fahrzeug auf dem Platz), Greifer-Sensor 1× im Greiffenster (`gripSystem.ts:165`). Dazu `contactPairsWith` je intaktes Zaunfeld (`fence.ts:83`, ~26 Felder) pro Schritt.

### Messwerte

| Messung | Wert | Bemerkung |
|---|---|---|
| Reiner Rapier-Schritt, Spielstart | **2,87 ms** | 153 Körper, alle wach |
| Reiner Rapier-Schritt, nach 10 s | **2,68 ms** | 112 von 160 wach |
| Reiner Rapier-Schritt, alle 160 zwangsgeweckt | **3,61 ms** | |
| Schritt mit Spiellogik (`__game.step`) | **3,3–3,7 ms** | vgl. Doku 4,42 ms |
| davon `excavator.update` | 0,13 ms | inkl. bis zu 7 Formabfragen |
| davon `clampSpeeds` / `syncMeshes` | je 0,12 ms | |
| davon `vehicles.update` | 0,07 ms | |
| davon `containers.recount` (alle 10 Schritte) | 0,08 ms | |
| Nach +150 gespawnten Teilen (272 Teile, 237 wach) | **6,8 ms rein / 9,2 ms mit Logik** | |
| Nach Bündelung (256 Teile) | 7,6 / 9,0 ms | Bündelung sparte 16 Teile, aber nichts an Zeit |
| Fuzz-Lauf 6 000 Schritte mit Eingabe | Ø 2,9 ms, **Spitze 48 ms** | Spitzen = Fahrzeug-Spawn / GC (VERMUTUNG) |

**Rapier isoliert (Node, 12 Iterationen + 6 Reibungsdurchläufe wie im Spiel):**

| Körper | alle wach | alle schlafend |
|---|---|---|
| 130 | 3,2–4,9 ms | **0,05 ms** |
| 260 | 8,5 ms | 0,10 ms |
| 400 | 14,3 ms | 0,20 ms |

Die Solver-Einstellungen in `physicsWorld.ts:15-19` (12 statt 4 Iterationen, 6 Reibungsdurchläufe) kosten **+32 %** (4,51 vs. 3,41 ms bei 300 Körpern). CCD (`setCcdEnabled(true)` auf jedem Schrottteil, `scrapItems.ts:389, 525`) kostet im ruhigen Zustand nichts Messbares (3,51 vs. 3,54 ms).

### Der Haufen schläft nicht ein (BELEGT, `qa/measure4.mjs`)
Fünf frische Seitenladungen, danach 3 000 reine Physikschritte (50 s) ohne jede Spiellogik, wache dynamische Körper alle 600 Schritte:

```
Lauf 1:  98/137 → 98 → 97 → 97 → 97   (schläft nie ein)
Lauf 2:  76/117 → 76 → 76 → 76 → 76   (schläft nie ein)
Lauf 3:   3/126 →  3 →  3 →  3 →  2
Lauf 4:  77/132 → 87 → 87 →  0 →  0   (nach ~40 s)
Lauf 5:  71/125 →  1 →  0 →  0 →  0
```

Die wachen Teile haben Geschwindigkeiten von 0,0001–0,03 m/s — sie zittern. Ursache (VERMUTUNG, gut gestützt): `spawnPile` (`scrapItems.ts:419-460`) setzt 150 zufällig verdrehte Teile mit nur 4 cm Abstand übereinander; dazu die sehr steifen Kontakte (`contact_natural_frequency = 40`, `normalizedAllowedLinearError = 0.001`). Ein verkanteter Haufen findet so keine Ruhe. **Konsequenz:** Die 2,7 ms sind fast vollständig der zitternde Haufen. Ein schlafender Haufen würde ~0,1 ms kosten. Das ist der größte einzelne Hebel.

### Hochrechnung aufs Handy (VERMUTUNG)
Handy-Prozessoren (Mittelklasse, Single-Thread) liegen bei WASM-Last erfahrungsgemäß beim 3- bis 5-fachen dieser Sandbox. Damit: 9–18 ms pro Schritt mit Logik bei ~130 Teilen, 27–45 ms bei 270 Teilen. Die Hauptschleife (`main.ts:757-762`) macht bis zu 5 Schritte pro Bild und setzt dann den Akkumulator auf null. Auf dem Handy heißt das: **Das Spiel läuft nicht ruckelnd, sondern in Zeitlupe** — 5 × 15 ms = 75 ms pro Bild sind 13 fps mit nur 5/6 der Spielzeit. Das deckt sich mit Patricks Punkt 3.

---

## 4. Absturz- und Stabilitätsrisiken

### H1 — Entferntes Teil in der Spinne → Physik-Welt dauerhaft kaputt (HOCH, BELEGT, reproduziert)

**Ablauf:** `GripSystem.releaseAll()` (`physics/gripSystem.ts:227-235`) ruft `item.body.wakeUp()` für jeden gegriffenen Körper — **ohne `isValid()`-Prüfung**. Wurde der Körper zwischenzeitlich aus der Welt entfernt, antwortet Rapier mit `RuntimeError: unreachable` (WASM-Panik). Danach bleibt Rapiers interne Sperre gesetzt: **jeder** folgende Aufruf — auch `world.step()` — wirft „recursive use of an object detected". Die Schleife in `main.ts` wirft dann in jedem Bild; das Bild friert ein.

**Reproduktion** (`qa/crash_repro.mjs`, Browser): `grip.attachBody(it.body)` → `items.remove(it)` → `grip.releaseAll()` = `unreachable` → `step()` = „recursive use". Identisch in Node nachgestellt (`qa/rapier_stale.mjs`): `wakeUp()`, `translation()`, `mass()` auf entferntem Körper, danach `step()` — alles kaputt.

**Drei Spielwege, die genau das tun (Code gelesen):**
1. **Presse:** `press.ts:433-454` `stamp()` sammelt alles, dessen Schwerpunkt in der Kammer liegt, und entfernt es — auch ein gegriffenes Teil, das der Spieler gerade hineinhält. Kein Gegriffen-Check.
2. **Abholung:** V-Taste bei wartendem Abholer → `requestPickup` → `onPickupDepart` → `account.sellContainer` (`account.ts:120-121`) entfernt alles, was `containedItems()` (`vehicles.ts:470-485`) geometrisch auf der Ladefläche findet — auch ein Teil, das noch in der Spinne über der Pritsche hängt.
3. **Bündelung:** `items.consolidate()` (`scrapItems.ts:580-613`, alle 4 s ab 260 Teilen) filtert nur `isDynamic && massKg ≤ 45` — gegriffene Teile sind dynamisch. `containers.recount` bekommt die gegriffenen Handles (`main.ts:634`), `consolidate` nicht.

**Gegenmaßnahme:** (a) in `releaseAll` und `updateCrush` jedes `body` mit `isValid()` prüfen, ungültige Einträge still verwerfen; (b) `ItemManager.remove()` ein Callback `onRemoved(body)` geben, das das Greifsystem entkoppelt (`items = items.filter(...)`) — ein Aufrufer, alle drei Wege abgedeckt; (c) ein Hilfsmodul `safeBody(b)`, das bei ungültigem Handle `null` liefert, als einzige Zugriffsart auf Körper außerhalb des Managers. Test dazu in Node mit echter Rapier-Welt (5 Zeilen).

**Nebenbefund:** Die Aussage in `docs/Pruefung/03_Messanleitung.md` („`return false` im Query-Callback lässt den Borrow offen") ist **falsch für Rapier 0.14.0** — in Node geprüft: `intersectionsWithShape` mit sofortigem `return false`, danach `setLinvel`, `step`, `removeRigidBody`: alles fehlerfrei. Ebenso unschädlich: `projectPoint` und `setLinvel` *innerhalb* des Callbacks, Exceptions im Callback. Die vielen „nie vorzeitig abbrechen"-Kommentare (`collision.ts:107, 161-163, 212`) schützen vor einem Phantom; die echte Ursache des damals beobachteten Fehlers war mit hoher Wahrscheinlichkeit H1 (Zugriff auf einen entfernten Körper). Das ist wichtig, weil man sonst am falschen Ort weitersucht.

### H2 — Kaputter Spielstand blockiert den Start dauerhaft (HOCH, BELEGT, reproduziert)

`main.ts:49` entfernt das Loading-Element **vor** dem Weltaufbau; `main.ts:103-121` baut die Welt aus dem Save; `save.ts:migrate()` prüft Items und Karossen nicht. Zwei Test-Saves (`qa/measure5.mjs`):
- Item ohne `shape` → `TypeError: Cannot read properties of undefined (reading 'color')` in `spawnScrap` (`scrapItems.ts:217`).
- Item mit `pos: [null,null,null]` → Rapier `The translation components must be numbers`.

In beiden Fällen: `main().catch` (`main.ts:913-917`) will ins Loading-Element schreiben — das ist schon weg. **Ergebnis: schwarzer Bildschirm, keine Meldung, kein Weg zu „Neues Spiel"**, bei jedem weiteren Start wieder, bis jemand den Browser-Speicher löscht. In einer Store-App ist das ein 1-Stern-Fall („App startet nicht mehr").

Woher kaputte Saves kommen können: eine spätere Codeänderung an `ScrapShape` (jede Änderung der Item-Form ist automatisch ein Schemabruch, `CURRENT_SCHEMA` bleibt aber 1); Teile ohne `shape` werden beim Speichern gefiltert (`main.ts:176`) — abgerissene Karossenteile und Zaunfelder verlieren also ihren Zustand; in Zukunft NaN-Positionen (heute abgefangen durch `clampSpeeds` `scrapItems.ts:688-698`).

**Gegenmaßnahme:** `migrate` je Item validieren (Zahlen endlich, `shape.kind` bekannt, `dims` Länge); Weltaufbau in `try/catch` — bei Fehler Save sichern (`schrottplatz_save_broken`), Toast „Spielstand beschädigt, neues Spiel", weiterlaufen. Loading-Element erst nach der ersten gezeichneten Szene entfernen. Außerdem: **kein Autosave** existiert (nur K-Taste/Pausenmenü; kein `visibilitychange`/`pagehide`-Handler in `main.ts` gefunden) — auf Android wird die App im Hintergrund beendet, der Fortschritt ist weg.

### M1 — GPU-Speicher wird nie freigegeben (MITTEL, BELEGT im Code, nicht gemessen)

Im gesamten `src/` gibt es **einen** `dispose()`-Aufruf (`excavator.ts:195`). Jedes Schrottteil bekommt eigene `MeshStandardMaterial` und eigene Geometrie (`scrapItems.ts:313-330`), jedes Fahrzeug eigene Lack-/Glasmaterialien (`vehicleModel.ts:39-44`) und ~48 Geometrien. `ItemManager.remove()` (`scrapItems.ts:615-625`) und `DeliveryVehicle.despawn()` (`vehicles.ts:840-861`) rufen nur `removeFromParent()`. Three.js hält Geometrien/Materialien im Renderer-Cache, bis `dispose()` kommt — nach 200 Anlieferungen und 500 verkauften Teilen liegen Tausende toter Buffer im GPU-Speicher. Auf Desktop unsichtbar, auf dem Handy (geteilter RAM, WebView wird bei Speicherdruck gekillt) ein Langzeitrisiko. Zum Spielstart: 847 Geometrien, 314 Materialien in der Szene (gezählt).

**Gegenmaßnahme:** Geometrie und Material je `ScrapShape`-Typ cachen (identische Box-Maße teilen), Farbe per `mesh.material = shared; mesh.color`-Instanz oder `InstancedMesh`; in `remove()`/`despawn()` `geometry.dispose(); material.dispose()` für Unikate.

### M2 — Physik-Explosionen werden versteckt, nicht verhindert (MITTEL, BELEGT)

Fuzz-Lauf: 12 Mal Teile über 20 m/s, Spitze **54,8 m/s** vor dem Deckeln durch `clampSpeeds` (`scrapItems.ts:663-700`). Die Deckelung greift *nach* dem Physikschritt — der Impuls ist im Solver bereits an Nachbarn weitergegeben. Ursache ist die Kinematik-gegen-Dynamik-Kopplung (Abschnitt 6). Sichtbare Folge: Teile „zucken" oder springen, dann bremst der Deckel sie hart. Sicherheitsnetz gegen Verlassen des Platzes (Rücksetzen auf die Annahmefläche) hat im Fuzz **0 Mal** ausgelöst — das Netz funktioniert.

### M3 — Unbegrenztes Wachstum ist gedeckelt, aber der Deckel hilft nicht (MITTEL, BELEGT)

- Items: `consolidate()` fasst ab 260 Teilen nur ≤45 kg zusammen. Schwere Teile (Motoren, Träger, Karossen) wachsen unbegrenzt, bis `JAM_KG = 16 000 kg` loser Schrott die Anlieferung stoppt (`shift.ts:19`). Das sind grob 150–250 schwere Teile zusätzlich. Meine Messung: 272 Teile = 9,2 ms/Schritt auf Desktop — das Handy wäre da längst in Zeitlupe (Abschnitt 3).
- Partikel: fester Puffer (`particles.ts:12-21`), gut.
- Fahrzeuge: 1 aktiv + Parkplätze begrenzt (`vehicles.ts:959-968`), gut.
- Timer: nur Toast (`hud.ts:104`) und 120-ms-Knopfrückmeldung (`touch.ts:224`), unkritisch. Event-Listener werden einmal beim Aufbau registriert und nie entfernt — unkritisch für eine Single-Page-App, wird zum Leak, sobald jemand „Neues Spiel ohne Reload" baut.

### N1 — Kleinigkeiten (NIEDRIG, BELEGT)
- `physics.counts()` (`main.ts:899`) iteriert jeden Frame alle Körper fürs Debug-Overlay, auch wenn es aus ist.
- Allokationen pro Schritt: `new THREE.Vector3()` in `syncMeshes` (`excavator.ts:1277`), `new THREE.Quaternion()` ×3 in `syncBodies`/`integratePendulum` (`:1349-1350, 1381`), `new RAPIER.Cuboid` je Armglied (`collision.ts:209`), `carPos.push(new Vector3)` (`main.ts:161`). Verursacht GC-Pausen (die 48-ms-Spitze im Fuzz ist VERMUTUNG dafür).
- `AudioContext` wird korrekt erst bei Geste erzeugt und bei jeder Geste wieder geweckt (`audioManager.ts:53-63`) — mobiltauglich.
- `index.html` hat `viewport-fit=cover`, `touch-action: none`, `user-scalable=no` — richtig für Capacitor.

---

## 5. Mobile-Rendering — statisch gezählt (SwiftShader lässt keine fps-Messung zu)

Alle Zahlen per Szenen-Traversierung im laufenden Spiel (`qa/measure.mjs`, `measure5.mjs`), Spielstart:

| Größe | Wert | Bewertung fürs Handy |
|---|---|---|
| Meshes gesamt | **3 139–3 155** | Jeder Mesh = 1 Draw Call; Handy-Komfortzone: 100–300 |
| davon Betonlego-Umrandung | **~1 530** (510 Blöcke + 1 020 Noppen; `yard.ts:587-612`: 3 Reihen × ~172 Positionen × 3 Meshes) | statisch → 3 zusammengeführte Meshes wären genug |
| davon Bagger | 111 | ok |
| Schattenwerfer (`castShadow`) | **1 281–1 290** | Schattenpass verdoppelt die Draw Calls |
| Vertices in der Szene | 162 603 | harmlos — das Problem ist die Anzahl, nicht die Größe |
| Geometrien / Materialien | 847 / 314 | kein Sharing, kein `InstancedMesh` (0 gefunden) |
| Lichter | 1 Hemisphere + 1 Directional (Schatten 2048², `PCFSoftShadowMap`, `main.ts:55-68`) + **6 SpotLights** (`main.ts:81-88`, `daylight.ts:140`) | 6 Spots bleiben tagsüber mit Intensität 0 in der Szene → jeder Fragment-Shader rechnet 8 Lichter |
| Transparente Meshes / `MeshPhysicalMaterial` | 62 / 8 | Glas per Physical-Material ist der teuerste Three-Shader |
| Pixel-Ratio | `min(devicePixelRatio, 2)` (`main.ts:54`) | Handy mit dpr 3 rendert 2× → ~1,5 Mio Pixel + Schattenkarte 4 Mio Texel |
| Postprocessing | keins | gut |
| Render-Scale-Regler / Qualitätsstufen | keine | fehlt |
| Physik-Takt vs. Bild-Takt | 60 Hz fest, Akkumulator, **keine Interpolation** (`main.ts:755-764`) | auf 90/120-Hz-Handys wechseln sich Bilder mit 0 und 1 Physikschritt ab → sichtbares Ruckeln aller bewegten Teile (VERMUTUNG, aber mechanisch zwingend) |

**Einordnung (VERMUTUNG):** Mit ~3 000 Draw Calls plus ~1 300 im Schattenpass und PCF-Soft-Schatten wird ein Mittelklasse-Android nicht über 15–25 fps kommen, unabhängig von der Physik. Die Umrandung allein ist ein halber Tag Arbeit (`BufferGeometryUtils.mergeGeometries` oder `InstancedMesh` für Blöcke und Noppen) und halbiert die Szene.

**Gegenmaßnahmen, priorisiert:** (1) statische Geometrie zusammenführen; (2) Items nach Form-Typ als `InstancedMesh` oder mindestens geteilte Geometrie/Material; (3) Spots bei Tag `visible=false` (Three baut dann den Shader ohne sie); (4) Schatten auf 1024², `PCFShadowMap`, `castShadow` nur für Bagger, Fahrzeuge, Karossen; (5) Pixel-Ratio auf 1,5 deckeln plus Qualitätsschalter; (6) Render-Interpolation oder Physik-Schritt an die Bildrate koppeln.

---

## 6. Steuerung/Physik „unrund" — Ursachen im Code

Alle Punkte BELEGT im Code; die Wirkung auf das Spielgefühl ist Interpretation.

1. **Fixed Joint zwischen kinematischer Spinne und dynamischem Teil** (`gripSystem.ts:213-222`). Ein kinematischer Körper hat unendliche Masse; das gegriffene Teil wird mit unendlicher Kraft in Pose gehalten. Berührt es dabei Boden, Haufen oder Mulde, kämpft der Solver zwischen „Pose halten" und „nicht durchdringen" — Ergebnis: Zittern, Impulsexplosionen (M2), durchgeschobene Nachbarn. Das ist die Kernursache für „Greifer unrund". Die Fahrzeuge machen es richtig: Ladung wird während der Fahrt **kinematisch** (`vehicles.ts:511-521` `setBodyType(KinematicPositionBased)`) und beim Ablegen wieder dynamisch. Dasselbe Muster für die Spinne (Teil beim Greifen kinematisch mitführen, beim Loslassen mit Spinnengeschwindigkeit freigeben) wäre stabil und billiger.
2. **Arm-Rückrollen pro Schritt** (`excavator.ts:1147-1164`): Bei Kontakt mit Fahrzeug/Karosse/Personal werden Ausleger, Stiel und Oberwagen auf den Vorzustand gesetzt und alle Geschwindigkeiten genullt. Das ist ein harter Stopp ohne Gleiten — „Hängen". Der Fluchtweg (`armFree`) schaltet zwischen „blockiert" und „frei" um, wodurch der Arm an Kanten flackern kann.
3. **Bodenanschlag als Iterationsschleife** (`excavator.ts:1197-1235`): bis zu 80 Nachjustierungen à 0,004 rad pro Schritt — ein Rastereffekt, wenn die Spinne über den Boden zieht.
4. **`clampSpeeds` als Massen-Ersatz** (`scrapItems.ts:663-684`, `maxSpeedFor`: 1 000 kg → 0,6 m/s): Ein angestoßenes schweres Teil darf sich nie schneller als 0,6 m/s bewegen, egal wie hart die Spinne schlägt. Das erzeugt das „Rutschen"/„Kleben": Teile bewegen sich mit konstanter Deckelgeschwindigkeit statt physikalisch.
5. **Krallen-Kollider werden jeden Schritt umgebaut** (`excavator.ts:964-985`: `setHalfHeight`, `setTranslationWrtParent`, `setRotationWrtParent`, `setEnabled` auf 12 Kolldern), auch im Stillstand; beim Tragen werden sie **ganz abgeschaltet** (`:970`) — dann fahren andere Teile durch die Krallen hindurch.
6. **Pendel ist rein visuell-kinematisch** (`excavator.ts:1314-1352`): Die Spinne schwingt, der Kollider schwingt mit — und schiebt dabei mit unendlicher Kraft. Kein Feedback vom Haufen zurück aufs Pendel außer dem Faktor `plowFactor`.
7. **Solver-Parameter** (`physicsWorld.ts:15-19`): 12 Iterationen, 6 Reibungsdurchläufe, Kontaktfrequenz 40 Hz, erlaubter Fehler 0,001 — sehr steif. Zusammen mit dem eng gepackten Spawn führt das zum nie einschlafenden Haufen (Abschnitt 3). Keine Substeps; CCD auf allem.
8. **Dämpfung** (`scrapItems.ts:81-86`): linear 0,02–0,45, angular 0,05–0,9 je nach Masse — unauffällig. Karosse: angular 0,8, linear 0,05 (`composites.ts:63-64`) — plausibel.
9. **Taktung** (Abschnitt 5, letzte Zeile): ohne Render-Interpolation ruckelt jede Bewegung auf Bildschirmen ≠ 60 Hz.

---

## 7. Priorisierte Risikoliste

| Prio | Befund | Beleg | Gegenmaßnahme | Aufwand |
|---|---|---|---|---|
| **HOCH** | H1 Physik-Welt stirbt, wenn ein gegriffenes Teil entfernt wird (Presse, Abholer, Bündelung) | reproduziert (`qa/crash_repro.mjs`), `gripSystem.ts:229`, `press.ts:452`, `account.ts:120`, `scrapItems.ts:581` | `isValid()` in `releaseAll`/`updateCrush`; `onRemoved`-Hook im ItemManager; Node-Test | 0,5 Tag |
| **HOCH** | H2 Beschädigter Spielstand = dauerhaft schwarzer Bildschirm | reproduziert (`qa/measure5.mjs`), `main.ts:49, 103-121`, `save.ts:55-72` | Item-Validierung in `migrate`, try/catch um Weltaufbau, Fallback „Neues Spiel", Loading erst nach erstem Frame weg; Autosave bei `visibilitychange` | 0,5 Tag |
| **HOCH (Mobil)** | Draw Calls: 3 100 Meshes, 1 300 Schattenwerfer, kein Instancing, 8 Lichter, PCF-Soft 2048² | gezählt, `yard.ts:587-612`, `main.ts:55-88` | Statik zusammenführen, Items instanzieren, Spots ausblenden, Schatten sparen, Pixel-Ratio deckeln | 2–3 Tage |
| **HOCH (Mobil)** | Haufen schläft nicht ein → Physik 2,7 ms statt 0,1 ms; Wachstum auf 9 ms bei 270 Teilen; Zeitlupe auf dem Handy | gemessen (`qa/measure4.mjs`, `rapier_sleep.mjs`), `spawnPile`, `physicsWorld.ts:15-19` | Spawn mit Abstand + Vor-Setzen (Haufen vor dem ersten Bild N Schritte simulieren, dann `sleep()`), weichere Kontakte, Iterationen 6–8, harte Obergrenze für Körperzahl | 1 Tag |
| **MITTEL** | Kinematik↔Dynamik-Kopplung: Fixed Joint, Rückrollen, `clampSpeeds`; 55 m/s-Explosionen im Fuzz | Fuzz (`qa/fuzz.mjs`), `gripSystem.ts:213`, `excavator.ts:1147`, `scrapItems.ts:663` | Gegriffenes kinematisch mitführen (Fahrzeug-Muster), Deckel nur als Notnagel, Arm gleitend statt hart stoppen | 2–4 Tage, gehört zur Physik-Neukonzeption |
| **MITTEL** | Kein Test berührt Physik/Bagger/Fahrzeuge/Welt (0 % auf ~8 000 Zeilen); Feature-Regressionen unsichtbar | Coverage 9,6 % | Rapier-Node-Tests für Grip/Collision/Press/Consolidate; Playwright-Smoke im CI | 2 Tage Grundstock |
| **MITTEL** | GPU-Leak: nur 1 `dispose()` im Projekt; Items und Fahrzeuge lassen Geometrien/Materialien liegen | Code (`scrapItems.ts:615`, `vehicles.ts:840`) | Shared Geometry/Material + `dispose()` in `remove`/`despawn` | 0,5 Tag |
| **MITTEL** | 60-Hz-Physik ohne Interpolation → Ruckeln auf 90/120-Hz-Displays | `main.ts:755-764` | Interpolation mit `accumulator/FIXED_DT` oder variabler Schritt | 0,5 Tag |
| **MITTEL** | Falsche Doku-Annahme („`return false` bricht Rapier") lenkt künftige Fehlersuche fehl | Node-Test | Doku korrigieren: Ursache sind Zugriffe auf entfernte Körper | 10 Minuten |
| **NIEDRIG** | Capacitor nicht installiert, nie gebaut; Bundle 949 kB gzip mit eingebettetem WASM | `package.json` | `@capacitor/*` als devDependency, einmal `cap add android` durchziehen, Rapier ohne `-compat` | 0,5 Tag |
| **NIEDRIG** | Per-Schritt-Allokationen, Debug-Zählung jeden Frame | Code | Tmp-Objekte wiederverwenden | Stunden |
| **NIEDRIG (Hinweis an Store/Recht)** | Graffiti „FC AARAU 1902" als Texturtext (`yard.ts:436-444`) — echter Vereinsname in einer kommerziellen App | Code | Vor dem Release durch Fantasienamen ersetzen | Minuten |

---

## 8. Was ich nicht prüfen konnte

- **Bildrate und GPU-Last auf echter Hardware.** SwiftShader ist Software-Rendering; die 0,2 fps sagen nichts. Die Draw-Call-Zahlen sind belastbar, die daraus abgeleiteten fps nicht.
- **Speicherverlauf über Stunden.** Heap nach 100 s Fuzz: 54–58 MB (JS-Heap, ohne GPU). Der GPU-Leak (M1) ist aus dem Code abgeleitet, nicht gemessen.
- **Touch-Bedienung.** Playwright kann Touch simulieren, aber ohne echtes Gerät ist die Aussagekraft gering; ich habe die Touch-Achsen direkt gesetzt (Fuzz), nicht die Gesten.
- **Android-Build.** Capacitor fehlt im Projekt; ohne SDK in der Sandbox nicht nachholbar.
- **Handy-Prozessorfaktor.** „3–5×" ist Erfahrungswert, keine Messung.

## 9. Fazit für die Technik-Entscheidung (aus QA-Sicht)

Die beiden HOCH-Abstürze sind je einen halben Tag Arbeit und **kein Argument gegen den Web-Stack** — das passiert in Unity genauso, wenn man auf zerstörte Objekte zugreift. Das eigentliche Argument liegt in Abschnitt 3 und 5: Die Physik ist auf dem Handy nur tragbar, wenn der Haufen schläft und die Körperzahl hart gedeckelt bleibt, und das Rendering braucht eine Überarbeitung, die in Unity/Godot durch Static Batching und Instancing weitgehend gratis wäre, in Three.js aber Handarbeit ist. Beides ist im Web-Stack **machbar** (geschätzt 1–2 Wochen), aber es ist genau die Art Arbeit, bei der Patricks Punkt 1 („neue Features brechen Bestehendes") ohne Tests zuschlägt. Wer beim Web-Stack bleibt, sollte deshalb zuerst die Node-Physiktests und den Playwright-Smoke aufsetzen — sonst wird die Performance-Überarbeitung zur nächsten Bug-Quelle.
