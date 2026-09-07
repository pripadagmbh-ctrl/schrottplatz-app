# Prompt-Vorlagen — so sprichst du die Agents an

Ein guter Prompt hat fünf Teile: **Rolle**, **Ziel**, **Kontext** (welche Dateien lesen), **Einschränkungen**, **Ergebnis + Fertig-Kriterium**. Und immer: "Stell mir maximal 3 Rückfragen, bevor du anfängst." Eine Aufgabe pro Prompt.

Die Agents liegen in `.claude/agents/`. Im Chat sprichst du sie an mit "Du bist der architect" oder lässt Claude sie als Sub-Agent starten ("Starte den qa-tester mit folgender Aufgabe …").

---

## 1. Projektgerüst anlegen (erster Prompt für Spur A)

```
Du bist der architect. Lies CLAUDE.md und docs/02_Architektur_v2.md.

Ziel: Lege das Projektgerüst web/ nach Migrationsstufe 0 an.

Kontext: Der Prototyp liegt read-only unter ../prototype/. Werte für
data/materials.json kommen aus ../prototype/src/materials/catalog.ts.

Einschränkungen: Noch kein Gameplay, noch kein Three.js-Rendering.
Nur: Vite + TypeScript strict + Vitest + ESLint mit dem Schichten-Gate,
Ordnerstruktur data/ sim/ app/ view/, EventBus, Scheduler, GameState,
ControlFrame als Typen, ein leerer Test pro Schicht.

Ergebnis: Das Gerüst plus eine Datei docs/entscheidungen.md mit dem
ersten Eintrag (Ordnerstruktur, Begründung).

Fertig, wenn: npm run check, npm run lint, npm test grün sind und
ein absichtlicher Import von 'three' in sim/ den Lint bricht (zeig mir den Fehler).

Stell mir maximal 3 Rückfragen, bevor du anfängst.
```

## 2. Ein Feature spezifizieren lassen

```
Du bist der game-designer. Lies CLAUDE.md und docs/01_GDD_v2.md Abschnitt "Aufträge".

Ziel: Spezifiziere den Auftragstyp "Liefern" so, dass der gameplay-dev
ihn bauen kann.

Ergebnis: docs/spezifikationen/auftrag-liefern.md mit: Regeln, Felder für
data/missions.json (mit 3 Beispielaufträgen für Tag 1, 5, 20), Events,
die das System hört und feuert, HUD-Anzeige, Bonus-Formel mit Herkunft,
"Fertig, wenn"-Kriterien für den Playtest.

Einschränkungen: Max. 60 Zeilen. Keine neuen Mechaniken, nur was
vorhandene Zähler (Verkauf, Reinheit, Masse) hergeben.

Bevor du schreibst: Nenn mir 2 Stellen, an denen du eine
Geschmacksentscheidung von mir brauchst, mit deiner Empfehlung.
```

## 3. Ein Feature bauen lassen

```
Du bist der gameplay-dev. Lies CLAUDE.md, dann
docs/spezifikationen/auftrag-liefern.md und docs/entscheidungen.md.

Ziel: Implementiere das System sim/systems/missions.ts für den
Auftragstyp "Liefern" nach der Spezifikation.

Kontext: Events kommen vom EventBus (sim/core/events.ts), Verkäufe
feuern 'saleCompleted' (siehe sim/systems/economy.ts).

Einschränkungen: Nur dieses System plus data/missions.json plus Tests.
Keine Änderungen an anderen Systemen — wenn du eine brauchst, stopp
und sag es. Keine Literale für Beträge.

Ergebnis: System, JSON, kopfloser Szenario-Test ("Auftrag 800 kg Alu
≥ 90 %, verkaufe 850 kg Alu mit 92 % → Event missionCompleted mit
Bonus X"), Eintrag im Scheduler.

Fertig, wenn: check/lint/test grün + du nennst mir 3 Fälle, die du
bewusst nicht abgedeckt hast.

Zeig mir erst deinen 5-Zeilen-Plan.
```

## 4. Prüfen und messen lassen

```
Du bist der qa-tester. Lies CLAUDE.md.

Ziel: Nimm die Änderung im letzten Commit ab (git diff HEAD~1).

Prüfe: Schichtenregel eingehalten? Werte aus JSON? isValid/dispose
wo nötig? Szenario-Test vorhanden und sinnvoll? Wächter-Tests noch grün?

Ergebnis: "blockiert" oder "ok mit Anmerkungen", mit Datei:Zeile je Befund.
Was du nicht prüfen konntest, sagst du ausdrücklich.
```

```
Du bist der qa-tester.

Ziel: Miss die Physikzeit pro Schritt in web/ bei 150 und 300 Teilen,
jeweils wach und schlafend, mit tools/qa/rapier_sleep.mjs als Vorlage.

Ergebnis: docs/messungen/<heute>_sandbox_physik.md mit Befehl, Zahlen,
Vergleich zum Prototyp (A2_QA_Performance.md Abschnitt 3), Einordnung
für Patrick in 3 Sätzen.
```

## 5. Visuelles Review

```
Du bist der art-director. Lies docs/04_Stilguide_und_Touch.md.

Ziel: Reviewe view/hud/ und web/index.html gegen den Stilguide.

Ergebnis: Tabelle Befund | verletzte Regel | Fix, sortiert nach
Auswirkung auf die Handy-Lesbarkeit. Danach die 3 wichtigsten Fixes
als konkrete CSS-/Code-Änderung beschrieben (nicht umgesetzt).
```

## 6. Unity-Spur starten

```
Du bist der architect. Lies CLAUDE.md und docs/02_Architektur_v2.md,
Kapitel "Unity-Testspur".

Ziel: Schreib mir eine Schritt-für-Schritt-Anleitung für die ersten
zwei Stunden in Unity 6: Projekt anlegen (URP Mobile), Ordnerstruktur
Assets/_Project/{Data,Sim,App,View}, ScriptableObject MaterialCatalog
aus data/materials.json importieren, Szene mit Plane + 150 Rigidbody-Würfeln,
Sleep-Threshold setzen, Profiler öffnen.

Einschränkungen: Ich habe Unity noch nie benutzt. Jeder Schritt mit
Menüpfad. Was ich im Editor klicken muss, trennst du von dem, was du
als C#-Datei liefern kannst.

Fertig, wenn: Ich am Ende die Physik-ms für 150 schlafende und 150
wache Würfel im Profiler ablesen kann.
```

## 7. Entscheidung festhalten

```
Du bist der architect. Wir haben gerade entschieden: <Entscheidung>.

Trag das in docs/entscheidungen.md ein: Datum, Entscheidung, Alternativen,
die wir verworfen haben, Begründung in 3 Sätzen, was sich dadurch in
der Architektur ändert. Frag nach, wenn dir die Begründung fehlt.
```

---

## Was ein schlechter Prompt ist

"Mach mal, dass Aufträge funktionieren." — Claude weiß nicht, welche Rolle, welche Dateien, was tabu ist, wann Schluss ist. Ergebnis: ein großer Wurf in main.ts, genau das, was den Prototyp kaputt gemacht hat.

## Wenn du dazulernen willst

Häng an jeden Prompt an: "Erklär mir in 3 Sätzen, warum du es so und nicht anders gebaut hast." Die Agents sind darauf eingestellt. Und lies `docs/entscheidungen.md` alle paar Tage — das ist das Gedächtnis des Projekts.
