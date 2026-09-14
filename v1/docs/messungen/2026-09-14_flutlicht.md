# Ausleuchtung nach dem Einmauern der Scheinwerfer (14.09.2026)

Befund Patrick, auf dem Gerät: „Die Scheinwerfer müssen nicht unbedingt auf dem
Platz stehen. Die können auch quasi eingemauert sein mit dem Legostein."

Die sechs Masten sind aus der Fläche in die Umrandung gerückt (`einmauern` in
`src/world/daylight.ts`). Sie stehen damit 1,5 bis 3,0 m weiter außen. Die
Frage war: Bleibt die Arbeitsfläche gleich hell?

## Was gerechnet wurde

Nachgerechnet ist das Beleuchtungsmodell von three.js für einen `SpotLight`
mit physikalischem Abfall — dieselben Werte wie im Spiel: Masthöhe 12 m,
Lichtstärke 380 (alt), Reichweite 130 m, `decay` 1,35, Kegel π/5,2 mit
`penumbra` 0,45, Ziel auf 12 % der Strecke zur Platzmitte. Dazu der
Einfallswinkel auf den Boden (Lambert). Die Zahlen sind relative
Beleuchtungsstärken, nicht Lux — verglichen wird alt gegen neu.

| Standorte | alt | neu |
|---|---|---|
| Masten | (−37\|26) (−37\|−26) (−37\|2) (9\|26) (9\|8) (0\|26) | (−40\|26) (−40\|−26) (−40\|2) (10,5\|26) (10,5\|8) (0\|29) |

## Ergebnis (Lichtstärke unverändert 380)

| Arbeitspunkt | alt | neu | neu/alt |
|---|---:|---:|---:|
| Baggerstand (−0,5 \| −22,5) | 1,69 | 1,70 | 101 % |
| Mulde ALU+ZINK | 0,86 | 0,88 | 102 % |
| Mulde KABEL | 1,91 | 1,89 | 99 % |
| Mulde KUPFER+MESSING | 3,21 | 3,10 | 96 % |
| Halde MISCHSCHROTT, Vorderkante | 0,83 | 0,80 | 97 % |
| Halde STAHLSCHROTT, Vorderkante | 0,81 | 0,76 | 93 % |
| Müllcontainer | 1,87 | 1,76 | 95 % |
| Presse | 1,07 | 1,07 | 101 % |
| Abkippzone | 5,25 | 4,90 | 93 % |
| Verladeplatz | 3,43 | 3,25 | 95 % |
| Silo VA | 0,08 | 0,15 | 192 % |
| Waage | 0,00 | 0,25 | — (vorher dunkel) |
| Platzmitte | 6,44 | 6,14 | 95 % |
| Hallenvorfeld | 8,66 | 7,71 | 89 % |
| **Mittel** | **2,58** | **2,45** | **95 %** |

## Was daraus folgt

Fünf Prozent im Mittel, im schlechtesten Punkt elf. Zwei Stellen werden
heller, weil die Masten näher an sie heranrücken: die Waage, die vorher gar
kein Flutlicht abbekam, und das VA-Silo.

Die Lichtstärke steigt deshalb von **380 auf 400** (`Floodlights.update`). Das
sind 5,3 % mehr und hebt das Mittel genau auf den alten Wert; kein einzelner
Punkt wird dabei heller, als er vorher war (hellster Punkt vorher 8,66, mit
400 jetzt 8,12).

Zeichnung: `2026-09-14_flutlicht.svg` — Grundriss mit alten und neuen
Standorten, dazu ein Schnitt durch die Mauer mit dem eingelassenen Mast.
