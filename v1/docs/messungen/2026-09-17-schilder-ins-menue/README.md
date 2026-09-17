# SCHILDER aus dem Kranz ins Pausenmenü — nachgemessen (17.09.2026, E-093)

**Das sind keine Bildschirmfotos.** Hier lief kein Browser. Alle Kästen sind aus
`v1/index.html` und `v1/src/core/touch.ts` gerechnet — dieselbe Rechnung, die
`v1/test/funktionskranz.test.ts` und `v1/test/menue-markierungen.test.ts` bei
jedem Testlauf prüfen. Wie Safari die Schrift wirklich setzt und wie sich das
Ziehen anfühlt, zeigt nur Patricks Gerät.

Neu zeichnen: `node docs/messungen/2026-09-17-schilder-ins-menue/bild.mjs`
(aus `v1/`).

## Der Funktionskranz, jetzt mit acht Einträgen

| Fassung | Kasten | R | engste Stelle | Schranke |
|---|---|---|---|---|
| iPad quer 1024 × 768 | 62 × 34 | 112 | **14,1 px** | 6 px |
| iPhone mini quer 812 × 375 | 58 × 30 | 112 | **18,3 px** | 6 px |

Zum Vergleich, iPad, gleiche Geometrie:

| Einträge | Luft (iPad) | Luft (mini quer) |
|---|---|---|
| **acht (heute)** | **14,1** | **18,3** |
| neun | 6,9 | 11,1 |
| zehn | 0,7 | 4,9 |
| elf | −4,5 | −0,3 |

**Ein Platz ist frei.** Ein neunter Eintrag ginge, ohne dass sich etwas
berührt. Er wird hier **nicht gefüllt** — was in den Kranz kommt, entscheidet
Patrick.

**`RADIAL_R` bleibt 112.** Rechnerisch reichte für acht Einträge **R = 101**.
Kleiner gemacht wird trotzdem nichts: Der Halbmesser ist reine Ansicht —
gewählt wird über die *Richtung* des Daumenzugs, nicht über den Weg
(`RADIAL_MIN_PX = 34`) — und 112 hält den neunten Platz offen. Der Rückweg auf
die alte 104 wäre ohnehin kein Rückweg: Die 104 gehörten zur kaputten
Geometrie vor E-088 und ergaben schon mit acht Einträgen **−6,1 px**, also
Überlappung.

Bilder: `ipad-quer-kranz.png`, `iphone-mini-quer-kranz.png`.

## Das Pausenmenü mit dem neuen Knopf

| Fassung | Knöpfe | Feld | Grenze (max-height) | Ergebnis |
|---|---|---|---|---|
| iPad quer | 9 → **10** | 769 → **833 px** | 676 px | scrollte vorher, scrollt nachher |
| iPhone mini quer | 9 → **10** | **334 px (unverändert)** | 353 px | passt ohne Scrollen |

Zwei Befunde:

1. **Auf dem iPhone mini kostet der neue Knopf null Pixel.** Das Feld steht dort
   zweispaltig; neun Knöpfe brauchten fünf Reihen und ließen eine halbe Zelle
   leer. Der zehnte füllt genau die.
2. **Auf dem iPad war das Pausenfeld schon vorher zu hoch fürs Bild** (769 px
   gegen 676 px Grenze) — es scrollt seit längerem, unbemerkt. Der neue Knopf
   macht daraus 833 px. Deshalb steht er an **dritter Stelle**, direkt unter
   „Steuerung": dort ist er ohne Scrollen zu sehen. Dass das Feld überhaupt
   scrollt, ist eine eigene Frage und gehört nicht in diesen Umzug.

Bilder: `ipad-quer-menue.png`, `iphone-mini-quer-menue.png`. Der gelbe Balken
unter „Zonenmarkierungen an/aus" heißt *ist an* — dieselbe Darstellung, die der
Kranz für KIPPEN benutzt, aus derselben CSS-Regel.
