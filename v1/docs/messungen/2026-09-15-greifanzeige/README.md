# Griff-Info und Ladeanzeige — Vermessung 15.09.2026

Anlass (Patrick, iPhone mini): „Bei iPhone Mini wird auch durch die Greifanzeige,
also was gegriffen worden ist, die Sicht verdeckt."

## Was hier NICHT vorliegt

**Keine Bildschirmfotos.** Für diese Arbeit stand kein Browser zur Verfügung.
Die Bilder in diesem Ordner (`*.png`, `*.svg`) sind **gerechnet**: `bild.mjs`
liest das CSS aus `v1/index.html`, baut die Kästen daraus auf und zeichnet sie.
Sie zeigen Lage und Größe der Kästen — **nicht**, wie die Schrift wirklich
umbricht und nicht, was hinter dem HUD zu sehen ist. Das entscheidet das Gerät.

Dieselbe Rechnung läuft bei jedem Testlauf in `v1/test/greifanzeige.test.ts` und
schlägt fehl, sobald sich zwei Kästen berühren.

Neu zeichnen: `node docs/messungen/2026-09-15-greifanzeige/bild.mjs` (aus `v1/`).

Farben in den Bildern: **gelb** = Fahrpedale · **blaugrau** = Drehtasten ·
**schwarz** = Griff-Info · **dunkelrot** = Ladeanzeige.

## Der Befund (Stand vor der Änderung)

Beide Zeilen waren mittig zentriert (`left: 50%` + `translateX(-50%)`) und ohne
Breitengrenze, dazu angehoben (`bottom: 118 px` bzw. `163 px`).

* Die Anhebung stammte vom 14.09., als die **Fahrpedale unten in der Bildmitte**
  standen. Seit sie unten links sitzen, war sie nur noch übrig.
* Im **Hochformat** (375 × 812) ist ein fixiertes Element mit `left: 50%` höchstens
  188 px breit. Die Griff-Info brach damit auf fünf bis sieben Zeilen um — eine
  schmale, hohe Textsäule genau dort, wo man beim Greifen hinsieht.
* Die Ladeanzeige stand auf `white-space: nowrap` und lief statt dessen nach
  **beiden** Seiten aus dem Bild, bis auf die Pedale.
* Das Hochformat lief überhaupt mit den Tablet-Regeln: `@media (max-height: 430px)`
  fängt nur das Querformat der Telefone.

## Die Kästen nach der Änderung

Gerechnet mit dem **längstmöglichen Text**: volle Spinne (drei benannte Brocken
samt Materialangabe, zwei Fraktionen, Rest) über der falschen Mulde, dazu ein
wartender Abholer, also beide Zeilen gleichzeitig und beide am längsten.
`y` zählt von der Unterkante des Bildes nach oben.

| Fassung | Kasten | x | y (von unten) | Größe | Abstand zum Nachbarn |
|---|---|---|---|---|---|
| iPad quer 1024 × 768 | Pedale | 12 – 186 | 10 – 106 | 174 × 96 | — |
| | Griff-Info | 198 – 942 | 10 – 66 | 744 × 56 | 12 px zu den Pedalen |
| | Ladeanzeige | 198 – 942 | 72 – 109 | 744 × 37 | 6 px zur Griff-Info |
| | Drehtaste unten | 954 – 1012 | 180 – 234 | 58 × 54 | 12 px zum Block |
| | Drehtaste oben | 954 – 1012 | 238 – 292 | 58 × 54 | — |
| | **Block endet bei 109 px von 768 px = 14,2 % des Bildes** | | | | |
| iPhone mini quer 812 × 375 | Pedale | 8 – 148 | 6 – 80 | 140 × 74 | — |
| | Griff-Info | 156 – 560 | 6 – 50 | 404 × 44 | 8 px zu den Pedalen |
| | Ladeanzeige | 156 – 560 | 56 – 83 | 404 × 27 | 6 px zur Griff-Info |
| | Drehtaste links | 572 – 622 | 14 – 58 | 50 × 44 | 12 px zum Block |
| | Drehtaste rechts | 630 – 680 | 14 – 58 | 50 × 44 | — |
| | **Block endet bei 83 px von 375 px = 22,1 % des Bildes** | | | | |
| iPhone mini hoch 375 × 812 | Pedale | 12 – 186 | 10 – 106 | 174 × 96 | — |
| | Griff-Info | 12 – 293 | 118 – 193 | 281 × 75 | 12 px über den Pedalen |
| | Ladeanzeige | 12 – 293 | 199 – 255 | 281 × 56 | 6 px zur Griff-Info |
| | Drehtaste unten | 305 – 363 | 180 – 234 | 58 × 54 | 12 px zum Block |
| | Drehtaste oben | 305 – 363 | 238 – 292 | 58 × 54 | — |
| | **Block endet bei 255 px von 812 px = 31,4 % des Bildes** | | | | |

Alle Größen sind **Außenmaße** — Rahmen und Innenrand zählen mit. Die Drehtasten
stehen auf `content-box`: ihre 54 px Breite sind ohne den 2-px-Rahmen gemessen,
in Wahrheit sind sie 58 px breit. Genau diese 4 px hat eine frühere Fassung
vergessen (Messung 14.09.2026).

## Was bei der längsten Zeile passiert

Die Griff-Info hat seit heute zwei Zeilen:

* **Kopf** — Zustand, Gewicht, Preis, Ampelurteil. Darf umbrechen, wird nie
  abgeschnitten. Längste Form: `Greifer: 1.5 t › über KUPFER + MESSING: ✕ falsche Zone`
  (56 Zeichen) → eine Zeile auf dem iPad, zwei auf dem iPhone mini hoch.
* **Liste** — was in der Spinne liegt. Genau eine Zeile; passt sie nicht, endet
  sie mit „…". Längste Form rund 200 Zeichen; auf dem iPhone mini hoch bleiben
  davon 33 sichtbar, also der erste benannte Brocken.

**Verloren geht damit nur der Schwanz der Aufzählung.** Gesamtgewicht, Preis,
Materialangabe des anvisierten Stücks und das Ampelurteil stehen im Kopf und
brechen um, statt zu verschwinden. Dass es mehr ist, als dasteht, sagt schon die
Aufzählung selbst („+3 weitere").

Der längste Name im Spiel ist heute „Unfallfahrzeug (Front eingedrückt)"
(35 Zeichen), die längste Muldenaufschrift „KUPFER + MESSING" (16). Kommt ein
längerer dazu, fällt der erste Test in `test/greifanzeige.test.ts`.
