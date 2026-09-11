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

### Ergebnis (iPad, Safari, ruhender Haufen)

Aus dem Gerätetest am 11.09.2026, abgelesen an der Anzeige im Labor:

| | iPad | Rechner |
|---|---|---|
| FPS | **60** | — |
| Spinne + Greifzone | 0,49 ms (19 %) | 0,28 ms |
| Physik | 0,36 ms (14 %) | 0,15 ms |
| Rest + Bild | 1,77 ms (68 %) | — |
| Summe je Bild | **2,62 ms** | 0,43 ms |
| Spitzen | Spinne 3,00 · Physik 2,00 ms | — |
| Zeichenrufe | 254 · 16k Dreiecke | 532 · 25k |

Bei 60 fps stehen 16,7 ms je Bild zur Verfügung; belegt sind 2,62 ms, also
16 Prozent. Die Spinne skaliert gut: Auf dem Gerät kostet sie nur das
1,8-fache des Rechners. Der größte Posten ist mit 68 Prozent das Zeichnen,
nicht die Physik.

### Ergebnis (iPad, Messläufe über je 300 Schritte)

Die laufende Anzeige taugt auf dem Gerät nur zum Überblick: Safari rundet die
Stoppuhr auf ganze Millisekunden, Einzelwerte je Bild sind dadurch grob. Die
Messläufe mitteln über 300 Schritte und sind die belastbare Zahl.

| Lage | Spinne + Greifzone | Physik | Summe je Schritt |
|---|---|---|---|
| 67 Teile, alle schlafend | 0,09 ms | 0,09 ms | **0,18 ms** |
| 27 Teile, alle wach | 0,06 ms | 0,31 ms | **0,37 ms** |

Zum Vergleich derselbe Fall auf dem Rechner (27 wach): 0,26 + 0,55 = 0,81 ms.
Das iPad ist hier also nicht langsamer, sondern schneller — Apple-Silizium
rechnet die Physik zügig, und der Rechnerwert stammt aus einem Browserfenster
mit Softwarezeichnung.

Hochgerechnet auf 67 wache Teile (Physik wächst annähernd linear mit der Zahl
wacher Körper): rund 0,77 ms Physik, macht mit der Spinne knapp **0,9 ms je
Schritt**. Das Budget für 60 fps sind 16,7 ms.

### Was daraus folgt

1. **Die Spinne ist nicht das Problem.** Sie kostet 0,26 bis 0,51 ms je
   Schritt, und zwar unabhängig davon, wie viel Schrott herumliegt. Selbst im
   teuersten gemessenen Zustand — geschlossen und schwenkend — bleibt sie
   unter einem Drittel dessen, was der wache Haufen kostet.
2. **Der Haufen ist es.** Die Physik wächst mit der Zahl wacher Teile:
   0,15 ms bei null, 0,55 ms bei 27, 1,41 ms bei 67. Das ist ungefähr linear,
   rund **0,02 ms je wachem Teil**.
3. **Die Fokus-Zone aus 1.3 wird nicht gebraucht — jedenfalls nicht, um zu
   sparen.** Sie sollte Rechenzeit einsparen, indem weiter entfernte Teile
   vereinfacht werden. Auf dem Gerät kostet die gesamte Physik mit 27 wachen
   Teilen 0,31 ms und hochgerechnet mit 67 wachen 0,77 ms; zu sparen ist da
   nichts, was sich lohnt. Vorschlag: Die Zone kommt trotzdem, aber andersherum
   — als **Qualitätszone**. Näher an der Spinne feinere Kollisionsformen und
   mehr Rechenschritte, weil das Budget dafür da ist.
4. Der teuerste Posten ist das **Zeichnen** (1,7 bis 2,0 ms, 68 bis 71 Prozent
   des Bildes), und es wächst mit der Teilezahl: 254 Zeichenrufe bei 27
   Teilen, 294 bei 67 — also grob ein Zeichenruf je Teil. Wer Luft schaffen
   will, schafft sie dort, nicht in der Physik.
5. Gemessenes Fazit für den Auftrag: **Bei 60 fps auf dem iPad sind rund
   16 Prozent des Bildbudgets belegt.** Für den Greifmoment ist reichlich
   Platz — die Spinne dürfte das Zehnfache ihrer heutigen Rechenzeit kosten,
   ohne dass die Bildrate darunter litte.
