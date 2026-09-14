# Messprotokoll zum Platzumbau (E-010), 14.09.2026

Gemessen am gebauten Platz, nicht am Konzeptplan. Alle Werkzeuge liegen in
`tools/` und lassen sich jederzeit wiederholen.

| Werkzeug | Aufruf | Was es misst |
|---|---|---|
| `tools/platzplan.ts` | `npx vite-node tools/platzplan.ts` | zeichnet `docs/platz.svg` aus dem gebauten Platz und rechnet die Abnahmetabelle nach |
| `tools/platzkonzept.mjs` | `node tools/platzkonzept.mjs` | zeichnet `docs/platzkonzept-2026-09-14.svg` aus dem Plan |
| `tools/fuhren.ts` | `npx vite-node tools/fuhren.ts` | zwölf Fuhren in Folge: kommt jedes Fahrzeug wieder vom Platz? |
| `tools/platzlast.ts` | `npx vite-node tools/platzlast.ts` | Körper, Physik-ms je Schritt, kommt der Haufen zur Ruhe? |

## 1. Die Abnahmetabelle aus E-010, gemessen

Standplatz `world/baggerstand.ts` → (−0,5 | −22,5). Bei einer **Halde** zählt
die vordere Kante, bei allem anderen die Mitte (E-010).

| Ziel | Plan | gebaut | im Band 5,8–9,2 m |
|---|---|---|---|
| Halde Mischschrott (vordere Kante) | 8,1 m | **8,07 m** | ja |
| Halde Stahlschrott (vordere Kante) | 7,2 m | **7,15 m** | ja |
| Presse | 8,5 m | **7,40 m** | ja |
| Müllcontainer | 8,8 m | **8,81 m** | ja |
| Reifencontainer | 7,3 m | **6,72 m** | ja |
| Mulde Alu+Zink | 8,9 m | **8,55 m** | ja |
| Mulde Kabel | 7,5 m | **7,50 m** | ja |
| Mulde Kupfer+Messing | 8,4 m | **8,65 m** | ja |
| Verladeplatz: Silo-Vorderkante / LKW-Spur | 7,5 / 7,5 m | **7,50 / 7,50 m** | — |

**Acht von acht Zielen im Schwenkband.** `test/platz.test.ts` hält das fest und
prüft dazu die Gegenprobe: Keines der neun Silos darf im Band liegen.

Die drei Abweichungen vom Plan sind gemessen entstanden, nicht gegriffen:

* **Presse 7,40 statt 8,5 m.** Auf (7,3 | −26,0) stünde ihr Rahmen 43 cm in der
  Ostmauer und ihre Deckelklappe 1,15 m in der Südmauer (die Klappe schwingt
  3,85 m über die Mitte hinaus). Auf (6,6 | −24,6) bleiben 27 cm bzw. 25 cm
  Luft.
* **Reifencontainer 6,72 statt 7,3 m.** Auf (5,6 | −18,5) überschnitt er sich
  mit dem Müllcontainer (0,4 × 0,8 m). Er ist auf (4,1 | −17,6) gerückt und
  dabei vom Behälter zum Absetzcontainer geworden: Mit 2,6 m Front käme die
  offene Spinne (3,38 m) nicht hinein — als Mulde wäre er eine Sackgasse.
* **Mulden 4,0 statt 3,2 m tief**, Reihe 0,6 m nach Norden. Dasselbe Maß: Eine
  Mulde, in die der Greifer nicht passt, lässt sich nicht ausräumen
  (`test/spinnenmass.test.ts`).

## 2. Zwölf Fuhren in Folge

`npx vite-node tools/fuhren.ts`, dreimal wiederholt, jedes Mal gleich:

```
Kipper gemischt, Bagger steht     durch      45,7 s
Kipper gemischt, Platz frei       durch      30,4 s
Kipper Batterien sortenrein       durch      32,9 s
Kipper Kunststoff sortenrein      durch      30,5 s
Kipper Alu sortenrein             durch      24,5 s
Kipper Kupfer sortenrein          durch      26,4 s
Kipper Holz sortenrein            durch      28,3 s
Kipper Stahl (kein Silo mehr)     durch      30,8 s
Pritsche mit Kran                 wartet    (auf den Bagger)
Wrackanlieferung                  wartet    (auf den Bagger)
Privat-PKW                        wartet    (auf den Bagger)
Abholer am Verladeplatz           durch     273,3 s
```

12 von 12 ohne Steckenbleiben. Die drei „wartet" sind kein Fehler: Sie werden
vom Bagger ausgeräumt, und in dieser Messung arbeitet niemand.

**Zwei Fahrzeuge blieben unterwegs wirklich stecken, beide gefunden und
behoben:**

1. **Janines Kaffeewagen.** Auf seinem ersten neuen Platz (−22,5 | 19,5) stand
   er 3,9 m neben der Sehne, mit der ein LKW vier Meter vorausschaut. Der erste
   Kipper blieb **292 Sekunden** hinter der Waage stehen. Feste Bauten kennen
   keine Aufgeben-Regel — was sie versperren, bleibt versperrt. Der Wagen steht
   jetzt auf (−9,5 | 15,5).
2. **Die Silo-Gasse.** Mit x −30 blieb jeder dritte sortenreine Kipper beim
   Ausfahren stehen, gemessen 275 s ohne einen Meter Fortschritt. 2,8 m nach
   dem Silo lag der Vorausschaupunkt schon hinter der Ecke; die Sehne schnitt
   sie ab und kam der Flanke des Nachbarsilos auf **1,74 m** nahe — die
   Schranke liegt bei 1,75 m. Ein Zentimeter. Mit der Gasse auf x −28 ist die
   gerade Strecke aus dem Silo 7,6 m lang, und die Sehne läuft gerade heraus.

## 3. Physik-Budget

`npx vite-node tools/platzlast.ts` — ganzer Platz mit Umrandung, Ausbuchtung,
Trennsteinen, neun Silos, drei Hallen, Büro, Presse, Starthaufen und zwei
Wracks. Gerechnet mit den Kontaktwerten des Spiels (`PhysicsWorld`), nicht mit
Rapier-Standardwerten.

| Größe | Wert |
|---|---|
| Kollider der festen Welt | 85 |
| Körper gesamt nach dem Starthaufen | 79–87 |
| davon dynamisch | 50–63 |
| Physik je Schritt (ohne die ersten 60) | **1,1–7,2 ms** im Mittel, 6–67 ms Spitze |
| Aufbauzeit | 270–750 ms |

**Der Starthaufen kommt nicht zuverlässig zur Ruhe.** Über vier Läufe liegt er
in einem von vier Fällen still (nach 14,7 s), sonst bleiben 30 bis 50 von rund
55 dynamischen Körpern wach. Die wachen Körper kriechen dabei mit **unter
0,05 m/s** — es ist Nachsacken, keine Bewegung.

**Das ist keine Folge des Umbaus.** Zur Gegenprobe wurde derselbe Haufen auf
seiner alten Stelle (6,2 | −19,0) auf freier Fläche gemessen: **drei von drei
Läufen blieben ebenfalls wach.** Es ist ein Einschlaf-Problem des Haufens, kein
Platzproblem, und gehört in ein eigenes Paket.

Was dabei aufgefallen ist und hier schon feststeht: Die **Streuung** des
Haufens ist keine Geschmacksfrage. Mit 2,3 m (erster Entwurf, damit er sicher
in die Halde passt) blieben 42 von 56 Körpern wach, mit den ursprünglichen
2,9 m in derselben Messung keiner. Der Wert steht deshalb mit seiner Messung
in `src/world/startplatz.ts`.

## 4. Prüfkette

* `npx tsc --noEmit` — sauber
* `npm test` — **386 Tests in 37 Dateien grün** (vorher 281 in 30; dazwischen
  liegen auch die Tests der parallel laufenden Pakete)
* `npm run build` — grün, 6,9 s
