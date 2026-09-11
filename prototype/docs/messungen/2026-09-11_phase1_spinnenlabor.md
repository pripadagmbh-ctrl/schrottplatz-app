# Phase 1 — Spinnen-Labor: Aufbau und erste Messung (11.09.2026)

Auftrag vom 11.09.2026, Punkte 1.1 (Aufbau) und 1.2 (Leistung pro Bild
aufschlüsseln). Das Labor läuft als eigene Seite neben dem Spiel:
`labor.html`, Quelle `src/labor/main.ts`.

## 1.1 Aufbau

Boden, eine Mulde (3,0 × 3,3 m, Wände 3,0 m — wie eine Sortiermulde im
Spiel), ein Pkw, 26 lose Teile, die Spinne. Sonst nichts: keine LKW, kein
Personal, keine Presse, kein Tageslicht, keine Wirtschaft. Bedienung
absichtlich wie im Spiel, damit nicht ein anderes Gerät gemessen wird als
das, das gespielt wird — inklusive der schwebenden Sticks fürs iPad.

Tasten im Labor: `1` legt acht Teile nach, `2` setzt einen Pkw dazu,
`M` startet einen Messlauf über 300 Schritte, `0` setzt die Spitzen zurück.

## 1.2 Aufteilung der Rechenzeit

Gemessen wird in zwei Töpfen je Schritt:

- **Spinne + Greifzone** — Armgeometrie, Krallen-Kollider, Greifsystem: alles,
  was nur wegen der Spinne gerechnet wird.
- **Physik** — der Rapier-Schritt selbst.

Dazu im laufenden Bild ein dritter Topf (Meshes nachführen und Zeichnen).

### Warum nicht über die Bildschleife gemessen wird

Der erste Versuch las die Werte aus der laufenden Bildschleife. Das ergab
8 fps und 1400 ms „Rest", während ein Schritt tatsächlich 1,07 ms kostete:
Der Browser drosselt die Bildschleife, sobald das Fenster nicht angezeigt
wird, und das erste Bild kostet allein 2,3 s für Shader und Schattenkarten.
Der Messlauf läuft deshalb über eine feste Schrittzahl, unabhängig von der
Bildwiederholrate, und die ersten 40 Bilder zählen nicht in den Mittelwert.

### Ergebnis (Rechner, Chrome; je 300 Schritte)

| Lage | Spinne + Greifzone | Physik | Summe | bewegliche Körper (wach) |
|---|---|---|---|---|
| Haufen schläft | 0,28 ms | 0,15 ms | **0,43 ms** | 27 (0) |
| Haufen wach | 0,26 ms | 0,55 ms | **0,81 ms** | 27 (27) |
| 67 Teile, alle wach | 0,29 ms | 1,41 ms | **1,70 ms** | 67 (67) |

Und die Spinne selbst, bei wachem Haufen:

| Zustand | Spinne + Greifzone | Physik |
|---|---|---|
| Spinne offen, ruhig | 0,29 ms | 1,38 ms |
| Spinne schließt | 0,42 ms | 1,31 ms |
| Spinne zu, Oberwagen schwenkt | 0,51 ms | 1,31 ms |

### Was daraus folgt

1. **Die Spinne ist nicht das Problem.** Sie kostet 0,26 bis 0,51 ms je
   Schritt, und zwar unabhängig davon, wie viel Schrott herumliegt. Selbst im
   teuersten gemessenen Zustand — geschlossen und schwenkend — bleibt sie
   unter einem Drittel dessen, was der wache Haufen kostet.
2. **Der Haufen ist es.** Die Physik wächst mit der Zahl wacher Teile:
   0,15 ms bei null, 0,55 ms bei 27, 1,41 ms bei 67. Das ist ungefähr linear,
   rund **0,02 ms je wachem Teil**.
3. Für die Fokus-Zone (1.3) heißt das: Sie muss beim **Haufen** ansetzen —
   weiter weg vereinfachen und schlafen legen —, nicht bei der Spinne. Die
   Spinne darf im Gegenteil teurer werden, wenn der Greifmoment dadurch
   besser wird; das ist genau das Budget, das der Auftrag ihr einräumt.
4. Auf dem Rechner sind 1,70 ms bei 67 wachen Teilen weit unter dem Budget
   von 16,7 ms für 60 fps. **Die Zahl, die zählt, kommt vom iPad** — dort
   erwarte ich grob das Drei- bis Fünffache. Das ist der nächste Schritt
   (1.7).
