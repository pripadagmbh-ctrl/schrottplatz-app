# HUD-Aufräumen — Vermessung 15.09.2026 (E-032)

Drei offene Punkte aus E-027, dazu Patricks Ansage zur Ruhezeile.

## Was hier NICHT vorliegt

**Keine Bildschirmfotos.** Für diese Arbeit stand kein Browser zur Verfügung.
Die Bilder in diesem Ordner sind **gerechnet**: `mass.mjs` liest das CSS aus
`v1/index.html`, löst `max()`, `calc()` und `env(safe-area-inset-*)` je Gerät
auf, baut die Kästen mit Rahmen und Fassung und zeichnet sie. Sie zeigen Lage
und Größe der Kästen — **nicht**, wie die Schrift wirklich umbricht, nicht, wie
groß 14 px auf dem Glas wirken, und nicht, was hinter dem HUD zu sehen ist. Das
entscheidet das Gerät.

Dieselbe Rechnung läuft bei jedem Testlauf in `v1/test/greifanzeige.test.ts`,
`v1/test/hudplatz.test.ts` und `v1/test/sichererand.test.ts` (gemeinsame
Rechnung in `v1/test/cssmass.ts`).

Neu zeichnen, aus `v1/`:

```
node docs/messungen/2026-09-15-hud/mass.mjs
```

Farben in den Bildern: **rotbraun am Rand** = sicherer Rand (Notch, abgerundete
Ecken, Home-Indicator) · **gelb** = Fahrpedale · **blaugrau** = Dreh- und
Menüknopf · **schwarz** = Griff-Info · **dunkelrot** = Ladeanzeige ·
**dunkelgrün** = Konto und Tagesablauf.

`vorher-*` = Stand vom Morgen des 15.09. · `nachher-*` = dieser Stand ·
`*-ruhe` = nichts gegriffen, kein Abholer · `*-voll` = längstmöglicher Text.

## Die sicheren Ränder, mit denen gerechnet wird

| Gerät | links | rechts | oben | unten |
|---|---|---|---|---|
| iPad quer | 0 | 0 | 0 | 0 |
| iPhone 13 mini quer | 50 | 50 | 0 | 21 |
| iPhone 13 mini hoch | 0 | 0 | 50 | 34 |

Im Querformat meldet WebKit den seitlichen Rand auf **beiden** Seiten gleich,
damit sich beim Drehen des Geräts nichts verschiebt — 50 px ist der
ungünstigste Fall und wird deshalb gerechnet.

## Punkt 1: Was 14 px im Querformat kosten

Unterer Block, gemessen ab Bildunterkante, iPhone mini quer (812 × 375):

| Fall | 12 px (alt) | 12 px + sichere Ränder | **14 px + sichere Ränder** |
|---|---|---|---|
| Ruhe (nichts gegriffen) | 33 px (8,8 %) | 33 px | **0 px (0,0 %)** |
| Alltag (ein Stück anvisiert) | 33 px (8,8 %) | 52 px (13,9 %) | **73 px (19,5 %)** |
| schlimmster Fall | 83 px (22,1 %) | 126 px (33,6 %) | **141 px (37,6 %)** |

Der große Sprung kommt **nicht** von der Schrift, sondern von den sicheren
Rändern: Sie nehmen im Querformat 100 px Bildbreite weg, und derselbe Text
braucht dadurch eine Umbruchzeile mehr (+43 px). Die Schrift kostet 15 px.

**Wo die 15 px wieder herkommen** (alle drei zusammen ≈ 11 px, dazu der
Ruhezustand):

| Maßnahme | gespart |
|---|---|
| Zeilenabstand 1,25 statt 1,35 (5 Zeilen × 1 px) | 5 px |
| Innenrand 4/8 statt 4/10 (2 Kästen × 2 px, dazu 4 px mehr Textbreite) | 4 px |
| Zwischenraum 4 statt 6 | 2 px |
| Ruhezeile „Greifer: offen" fällt ganz weg | **33 px, fast immer** |

`alternative-12px-iphone-mini-quer-voll.png` zeigt dieselbe Lage mit 12 px, für
den Fall, dass Patrick am Bild anders entscheidet. Es ist eine Zahl im CSS
(`#gripinfo, #load { font-size: … }` in der flachen Fassung).

## Die Kästen nach der Änderung

`y` zählt von der Unterkante des Bildes nach oben; gerechnet mit dem
längstmöglichen Text und mit sicheren Rändern.

| Fassung | Kasten | x | y (von unten) |
|---|---|---|---|
| **iPad quer** 1024 × 768 | Pedale | 12 – 186 | 10 – 106 |
| | Ladeanzeige | 198 – 942 | 10 – 42 |
| | Griff-Info | 198 – 942 | 46 – 96 |
| | Drehtasten | 954 – 1012 | 180 – 292 |
| | Konto | 674 – 956 | 715 – 756 |
| | Tagesablauf | 687 – 956 | 671 – 709 |
| | Menüknopf | 962 – 1012 | 706 – 756 |
| | **Block endet bei 96 px von 768 = 12,5 %** | | |
| **iPhone mini quer** 812 × 375 | Pedale | 58 – 198 | 27 – 101 |
| | Ladeanzeige | 206 – 560 | 27 – 73 |
| | Griff-Info | 206 – 560 | 77 – 141 |
| | Drehtasten | 572 – 680 | 29 – 73 |
| | Konto | 58 – 281 | 339 – 367 |
| | Tagesablauf | 58 – 282 | 308 – 335 |
| | Menüknopf | 710 – 754 | 323 – 367 |
| | **Block endet bei 141 px von 375 = 37,6 %** | | |
| **iPhone mini hoch** 375 × 812 | Pedale | 12 – 186 | 42 – 138 |
| | Ladeanzeige | 12 – 293 | 152 – 202 |
| | Griff-Info | 12 – 293 | 206 – 292 |
| | Drehtasten | 305 – 363 | 180 – 292 |
| | Konto | 25 – 307 | 713 – 754 |
| | Tagesablauf | 38 – 307 | 669 – 707 |
| | Menüknopf | 313 – 363 | 704 – 754 |
| | **Block endet bei 292 px von 812 = 36,0 %** | | |

Kein Kasten ragt in einen sicheren Rand; kein Kasten berührt ein Bedienelement
(mindestens 8 px Luft, zum Menüknopf mindestens 6 px).

Zum Vergleich der Stand vom Morgen: Im Querformat lagen **sieben** Elemente
teilweise im sicheren Rand (Pedale, beide Drehtasten, Menüknopf, Ladeanzeige,
Konto, Tagesablauf), im Hochformat vier. Zu sehen in `vorher-*.png` als die
rotbraunen Streifen, über die die Kästen hinauslaufen.

## Punkt 2: Konto und Tagesablauf

`#money` stand auf `top: 12px` und ist mit 15 px Schrift, Zeilenabstand 1,5,
8 px Innenrand und 1 px Rahmen **41 px** hoch — es reichte also bis 53, während
`#shift` bei 46 begann: **7 px Überlappung**. Der Debugblock bei `top: 80` wäre
der nächste Fall gewesen, sobald der Tagesablauf zweizeilig wird.

Alle drei stehen jetzt in `#hudoben`, einer Flex-Spalte mit 6 px Zwischenraum
(flache Fassung: 4 px). Keiner trägt mehr einen eigenen Abstand zum Rand. Der
Debugblock ist mit im Stapel — ausgeblendet nimmt ein Flex-Kind keinen Platz
ein, mit F3 erscheint er genau unter dem Tagesablauf.
