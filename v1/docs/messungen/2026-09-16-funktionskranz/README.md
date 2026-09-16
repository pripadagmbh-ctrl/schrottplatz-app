# Funktionskranz: passt ein neunter Eintrag? (16.09.2026, E-088)

Anlass: KIPPEN musste in den Kranz (E-085 lag nur auf Taste K, und Patrick
spielt auf dem iPad). Damit wird aus acht Eintraegen der neunte — und jeder
neue Eintrag rueckt alle anderen zusammen: acht stehen 45 Grad auseinander,
neun 40, zehn 36.

**Das sind keine Bildschirmfotos.** Hier lief kein Browser. Gerechnet aus
`index.html` (Kastenmass, Vergroesserung des scharfgestellten Eintrags) und
`src/core/touch.ts` (Halbmesser `RADIAL_R`). Dieselbe Rechnung prueft
`test/funktionskranz.test.ts` bei jedem Testlauf.

    node docs/messungen/2026-09-16-funktionskranz/bild.mjs

## Der Befund, mit dem niemand gerechnet hat

Schon die **acht** Eintraege von gestern haben sich ueberlappt:

| Fassung | acht Eintraege, Stand 15.09. | neun Eintraege, neu |
|---|---|---|
| iPad quer (1024 x 768) | **−6,1 px** (Ueberlappung) | **+6,9 px** Luft |
| iPhone mini quer (812 x 375) | **−1,7 px** (Ueberlappung) | **+11,1 px** Luft |

Zwei Ursachen, beide nie mitgerechnet:

1. **`box-sizing`.** `width: 76px` war die Breite des INHALTS; der 2 px starke
   Rahmen kam obendrauf. Der Kasten war also 80 px breit, und der negative
   Rand (`-38px`) traf nicht seine Mitte, sondern lag 2 px daneben.
2. **`transform: scale(1.15)`.** Der scharfgestellte Eintrag waechst um 15 %
   und frisst dabei die Luft zum Nachbarn auf.

Auf dem Bild links (rote Rahmen) sieht man es: oben und unten stossen die
Kaesten aneinander. Rechts (gruene Rahmen) der neue Stand mit neun.

## Was geaendert wurde

| | vorher | nachher | warum |
|---|---|---|---|
| `box-sizing` | content-box | **border-box** | damit der negative Rand die Mitte trifft |
| Kasten iPad | 76 x 30 (+ Rahmen) | **62 x 34** | 9 Zeichen Consolas 11 px = 54,5 px + Rahmen |
| Kasten mini | 66 x 26 (+ Rahmen) | **58 x 30** | 9 Zeichen Consolas 10 px = 49,5 px + Rahmen |
| Halbmesser | 104 px | **112 px** | 6,9 px Luft bei neun Eintraegen |
| scharfgestellt | x 1,15 | **x 1,10** | 1,15 kostete 4 px Luft, ohne mehr zu zeigen |
| Zustand | — | **Balken unten** | KIPPEN ist ein Umschalter und zeigt jetzt, ob er an ist |

Die 4 px Hoehe, die dazugekommen sind, sind der Zustandsbalken: Er liegt unter
der Textzeile und kostet keine Textbreite. Ein Zustand als Text im Kasten
(`KIPPEN ✓`) haette den Kasten um zwei Zeichen verbreitert und damit den ganzen
Kranz aufgeblasen.

## Und der zehnte Eintrag?

**Passt nicht mehr.** Mit denselben Massen bleiben bei zehn Eintraegen auf dem
iPad **0,7 px** — die Rahmen zweier Nachbarn stossen aneinander und werden zu
einem Strich. Der Waechter faellt ab 6 px.

Wer einen zehnten will, aendert nicht die Zahl, sondern die Gliederung: ein
Eintrag wandert ins Menue (SCHILDER ist eine Anzeigeeinstellung, keine
Maschinenfunktion), oder der Kranz bekommt zwei Ringe. Das ist eine Frage an
Patrick, keine Rechenaufgabe.

## Was auf dem Geraet zu pruefen bleibt

Der Kranz erscheint dort, wo der Daumen liegt, und wird **nicht** an den
Bildrand gerueckt. Vollstaendig sichtbar ist er nur, wenn der Daumen weit genug
innen aufsetzt:

| Fassung | Ring reicht ueber/unter den Daumen | Streifen, in dem er ganz sichtbar ist |
|---|---|---|
| iPad quer | 131 px | 507 px hoch, 366 px breit |
| iPhone mini quer | 129 px | **97 px hoch**, 212 px breit |
| iPhone mini hoch | 131 px | 467 px hoch, **41 px breit** |

Auf dem iPhone mini quer ist das ein schmales Band in der Mitte. Setzt der
Daumen tiefer auf, haengt der unterste Eintrag unter dem Bildrand — **waehlen
laesst er sich trotzdem** (es zaehlt die Zugrichtung, nicht der Ort), nur lesen
nicht. Ob das stoert, entscheidet der Gerätetest; die Gegenmassnahme waere, den
Kranz beim Aufklappen ins Bild zu ruecken.
