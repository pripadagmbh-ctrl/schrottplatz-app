# Schrottplatz-App v2 — Projektregeln

Dieses Dokument liest Claude bei jeder Sitzung in diesem Ordner. Es gilt vor allem anderen.

## Was das ist

Neuaufbau der Schrottplatz-App (Fuchsbagger mit Greifspinne). Zwei Spuren:
- **Spur A (Prio 1):** `web/` — TypeScript, Vite, Three.js, Rapier, Vitest. Neustrukturierung nach `docs/02_Architektur_v2.md`.
- **Spur B (Prio 2, Timebox 2 Wochen):** `unity/` — Unity 6 LTS, URP Mobile, C#. Vergleichsprototyp nach `docs/02_Architektur_v2.md` Kapitel "Unity-Testspur".

Zielplattform: Android zuerst (Windows-PC, kein Mac), iOS später per Cloud-Build. Testgerät: iPhone (Safari) für Spur A.
Monetarisierung: Gratis bis Ende Tag 3, dann einmaliger Premium-Unlock. Keine Werbung, kein Tracking.

## Unverrückbar

1. **Der Prototyp unter `../prototype/` und `../docs/` wird niemals verändert.** Er ist Referenz und Steinbruch. Lesen ja, schreiben nein. Wer etwas daraus braucht, kopiert es hierher.
2. **Das Milieu entsteht aus Beruf, Familie und Geschäft — nie aus Herkunft oder Ethnie.** Keine Gruppe wird als kriminell markiert. Das gilt für Namen, Texte, Sprüche, Grafiken. Vorrang vor allem Technischen.
3. **Jede Zahl im GDD hat eine Herkunft** (Datei:Zeile aus dem Prototyp) **oder ein Playtest-Ziel** ("Fertig, wenn …"). Sonst gehört sie nicht hinein.
4. **Erst Plan, dann Code.** Bei jeder Aufgabe über ~50 Zeilen: erst einen kurzen Plan zeigen (welche Dateien, welche Tests), Rückfragen stellen, dann bauen.
5. **Patrick lernt mit.** Erkläre Entscheidungen in zwei, drei Sätzen für einen technisch interessierten Laien. Fachbegriffe beim ersten Auftreten kurz erklären. Lieber einmal mehr fragen als raten.

## Architektur-Regeln (Spur A)

- Vier Schichten: `data/` → `sim/` → `app/` → `view/`. Abhängigkeiten zeigen nur nach unten. `sim/` importiert **nie** `three` oder `document`. Das erzwingt ESLint (`no-restricted-imports`); ein Verstoß ist ein Build-Fehler, kein Stilproblem.
- Neues Feature = neues System (`sim/systems/<name>.ts`) + Events + ggf. JSON in `data/`. **Nicht** in `main.ts`, keine Callback-Felder, keine direkten Zugriffe auf fremde Interna.
- Eingabe nur über `ControlFrame`. Keine Tastencodes in der Simulation.
- Jedes System liefert `save()/load()`. Save-Daten werden beim Laden validiert; ein kaputter Spielstand führt zu "Neues Spiel", nie zu einem Schwarzbild.
- Physik-Körper: Zugriff nur über den Manager, jeder Zugriff prüft `isValid()`. Entfernen löst `onRemoved` aus, das Greifer und Zähler entkoppelt.
- Greifen: Gegriffenes wird **kinematisch mitgeführt**, kein Fixed Joint zwischen kinematischem Arm und dynamischem Teil.
- Keine Allokationen (`new Vector3()` usw.) in Update-Schleifen. Geometrien und Materialien werden geteilt und bei Entfernung `dispose()`d.
- Balancing-Werte ausschließlich aus `data/*.json`, nie als Literale im Code.

## Tests

- `npm test` muss vor jedem Commit grün sein. Zwei Ebenen: Formel-Tests (wie im Prototyp) und **kopflose Simulationstests** mit echter Rapier-Welt in Vitest.
- Jedes System bekommt mindestens einen Szenario-Test ("spawne X, tue Y, erwarte Event Z innerhalb N Schritten").
- Performance-Wächter: ein Test, der Physikzeit pro Schritt bei 150 schlafenden Teilen unter 0,3 ms hält, und einer, der nach 600 Schritten alle Teile schlafend erwartet.

## Befehle (Spur A)

```
cd web
npm run dev        # Dev-Server, im WLAN erreichbar mit --host (iPhone-Test)
npm run check      # tsc --noEmit
npm run lint       # ESLint inkl. Schichten-Gate
npm test           # Vitest
npm run build      # dist/
```

## Agents

Rollen liegen in `.claude/agents/`. Der Orchestrator (Patrick im Chat) verteilt; jeder Agent bleibt in seiner Rolle:
`game-designer` (Spezifikation, kein Code) · `architect` (Struktur, entscheidet *wie*) · `gameplay-dev` (baut nach Spezifikation) · `art-director` (Stilguide, Touch-Layout, Assets) · `qa-tester` (Tests, Messungen, Reviews) · `release-engineer` (Builds, Store, IAP). Prompt-Vorlagen: `docs/06_Prompt-Vorlagen.md`.

## Dokumente

`docs/00_Analysebericht.md` (warum v2) · `01_GDD_v2.md` (was gebaut wird) · `02_Architektur_v2.md` (wie) · `03_Roadmap.md` (wann) · `04_Stilguide_und_Touch.md` (wie es aussieht und sich anfühlt) · `05_Portierungsliste.md` (was aus dem Prototyp kommt) · `docs/analyse/` (die vier Einzelbefunde) · `docs/messungen/` (jede Messung mit Datum, Gerät, Zahlen) · `docs/entscheidungen.md` (jede Architektur- oder Design-Entscheidung mit Datum und Begründung, damit nichts zweimal diskutiert wird).
