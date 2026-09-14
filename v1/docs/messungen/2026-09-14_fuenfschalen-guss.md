# Messprotokoll 14.09.2026 — Fünfschalengreifer, der Zinken als ein Gussstück

**Was gemessen wurde:** die Schale des Vorschaumodells, nachdem Zinken und Anlenkklotz zu
einem Körper zusammengelegt wurden, und daneben eine Studie zur zweiten Aufgabe („offen
sollen die Unterkanten der fünf Zinken und die des Stempels in einer Ebene liegen").

**Womit:** eigene Wegwerf-Skripte über `baueGreifer()` aus `src/fuenfschalen/rig.ts`, 21
Stützstellen Öffnung 0,00 … 1,00, alle Mesh-Eckpunkte in Weltlage; Volumen als
Rotationskörper der geschlossenen Mittellinie in 4.000 Scheiben plus 5-mm-Raster mit
Strahlparität für den Schalenkopf. Kein Gerätetest — das hier ist eine Rechnung am Modell.

**Kein Gerätetest, keine Entscheidung.** Die Form entscheidet Patrick am Bild:
`docs/f5-greifer-seite.png` (Variante A, geliefert), `docs/f5-greifer-seite-flach.png`
(Variante B, Studie), `docs/f5-greiferschale.png` (die Schale allein).

---

## 1 Der Befund, der die Arbeit ausgelöst hat

Patrick, 14.09.2026: „dass direkt an der Traverse eine Hülse ist, wo der Zahn als solches
festgemacht ist. Das heißt, der Zinken und dieser Metallblock, wo auch der Hubzylinder
angeht, das ist eigentlich EIN Gusselement. Das sind nicht zwei Elemente."

Gebaut war es als zwei: ein Quader `06_UNTERE_ANBINDUNG` (0,33 × 0,20 × 0,43 m) vom Bolzen
bis an den Schalenanfang, darauf ein zweiter Quader `06_OBERE_ANBINDUNG` (0,33 × 0,18 ×
0,16 m) für das Zylinderauge, und daran die Sichel aus `06_HAUT` und achtzehn
`06_STREBE_xx`.

**Der Formwächter hat davon nie etwas gesehen.** `test/schalenform.test.ts` nahm in seiner
Silhouette alles aus, was `AUGE`, `ANBINDUNG` oder `NAHT` im Namen trug — also genau die
beiden Quader. Geprüft wurde die Sichel ab Station 0; der Kopf lag außerhalb des Blickfelds
des Wächters. Das ist der Grund, warum die Trennung durch alle Prüfungen gekommen ist.

---

## 2 Was gebaut wurde

| | vorher | nachher |
|---|---|---|
| Kopf | zwei Quader + 18 Strebenstücke | **ein Strang** `06_ZINKEN` vom Bolzen bis unter den Zahn |
| Kurve vom Bolzen an Station 0 | gab es nicht (Quader) | `fersenStationen` — kubische Bézier, Tangente dreht von −90° auf −8,75° |
| Querschnitt am Bolzen | 0,33 × 0,20 m (Quader) | **0,40 × 0,28 m**, rund auslaufend 90 mm hinter dem Bolzen |
| Querschnitt an Station 0 | Sprung auf 0,22 × 0,13 | 0,22 × 0,1975 m, stetig |
| Lagerhülse | Ø 0,17 × 0,40 m, im Quader | Ø 0,17 × **0,50 m**, im Guss, 50 mm je Seite vorstehend |
| Zylinderauge | Ø 0,11 in einer Konsole | Ø **0,17** Nabenauge am selben Körper, keine Konsole |
| Kehlnähte an der Schale | drei | **null** — ein Gussstück hat keine |
| Meshes / Dreiecke (ganzer Greifer) | 322 / 13.424 | **212 / 13.304** |
| GLB | 1.273 kB | **1.111 kB** (−13 %) |

`OBERE_ANBINDUNG`, `ZYLINDER_AUFNAHME`, `DREHPUNKT`, `STEMPEL_AUGE`, `ZU`, `OFFEN`,
`ABSCHNITT`, `SCHALEN_BOGEN` sind **unverändert** — der Formvertrag ist nicht angefasst.

### Zwei Kerben, die dabei gefunden und geschlossen wurden

Beide hat der erweiterte Wächter gemeldet, nicht das Auge:

1. **Schulterkerbe, bis 50 mm.** Zwischen Ferse und Strebe klaffte auf der Trogseite ein
   Keil: Die Ferse lief auf die Mittellinie zu, die Strebe sitzt aber 67 mm darüber auf dem
   Blech, und das Blech fängt erst an Station 0 an. Behoben, indem Innen- und Außenfläche
   der Ferse einzeln überblendet werden und der Guss über den ersten Abschnitt bis auf die
   Trogfläche durchreicht (`teile.ts`, `baueGreiferschale`).
2. **Abgeschnittene Nabe.** Der Körper endete in der Bolzenmitte; die Hülse stand zur
   Hälfte frei. Behoben mit drei Stationen hinter dem Bolzen, deren Querschnitt mit
   `sqrt(1 − t²)` rund ausläuft.

---

## 3 Der Wächter prüft jetzt eine Eigenschaft mehr

`test/schalenform.test.ts`, geänderte Zeilen und warum:

| Zeile | Änderung | Begründung |
|---|---|---|
| Silhouette, Ausnahmeregel | `/AUGE|ANBINDUNG|NAHT/` → `/AUGE/` | `ANBINDUNG` und `NAHT` trafen die beiden Quader und die Kehlnähte. Die gibt es nicht mehr; die Ausnahme hätte den neuen Gusskörper genauso unsichtbar gemacht wie vorher den Klotz. Augen bleiben draußen — eine Hülse ist hohl, ihr Loch ist kein Formfehler |
| neu: `fersenProfil()` | misst Dicke längs der Aussennormalen über die Fersenkurve, gezählt wird nur der Materialstreifen, durch den die Mittellinie läuft | Am Übergang zur Schale zeigt die Normale fast senkrecht; ein Strahl von −60 bis +320 mm trifft dort die gegenüberliegende Seite der Sichel und meldete 390 mm Dicke, wo 190 mm stehen |
| neu: „läuft von der Lagerhülse ohne Fuge in die Schale" | keine Station im Leeren, nirgends unter 100 mm | Das ist die Eigenschaft aus Patricks Befund: EIN Körper |
| neu: „ist am Bolzen am dicksten" | Bolzen dicker als jede Stelle der Sichel, keine Fersenstation dicker als der Bolzen, Ende der Ferse < 80 % davon | „dick am Drehpunkt, schlanker zur Spitze" |

Die drei alten Prüfungen sind **wörtlich unverändert** geblieben und grün. Kein Wächter
wurde aufgeweicht.

**Probe, dass die neuen fangen:** Sie haben beide oben genannten Kerben gemeldet, bevor sie
behoben waren — „t=0,67 … 1,00 im Leeren" und, mit dem ersten Strahlverfahren, „390 mm
Dicke mit Lücke". Danach grün.

---

## 4 Die Zahlen

### Variante A — Guss, Kinematik unverändert (das, was geliefert ist)

| Größe | vorher | nachher |
|---|---|---|
| Zahn-Unterkante offen (100 %) | −2,217 m | **−2,217 m** |
| Zahn-Unterkante halb (50 %) | −2,700 m | **−2,700 m** |
| Zahn-Unterkante zu (0 %) | −2,498 m | **−2,498 m** |
| Stempel-Unterkante | −1,652 m | −1,652 m |
| **Differenz offen** | 0,565 m | **0,566 m** |
| größter Durchmesser über den Öffnungsweg | 3,227 m | **3,227 m** (Grenze 3,38) |
| Sektor genutzt (r ≥ 0,30 m) | 23,96° von 36° | **26,34° von 36°**, Luft 9,66° |
| Bruttokorb | 1.615 l | 1.615 l |
| Schalenköpfe unter der Bolzenebene, fünf Stück | 54,1 l (gerechnet) | **53,6 l (gemessen)** |
| **Nettokorb** | 1.598 l | **1.598 l** (−0,5 l, 0,03 %) |
| Zylinder zu / offen / Hub | 0,979 / 0,540 / 0,439 m | unverändert |
| Hebelarm, kleinster über den Weg | 0,092 m | unverändert |

Die Kinematik ist Zahl für Zahl dieselbe — das war Absicht: Die Bauform ändert sich, die
Bewegung nicht. Die 2,4° mehr Sektor kommen von der längeren Lagerhülse (0,40 → 0,50 m);
sie stehen geschlossen am Bolzenkreis und liegen weiterhin fast 10° innerhalb der Grenze.

**Die flache Unterkante erreicht Variante A nicht.** Sie kann es nicht, und das ist kein
Versäumnis an der Krümmung — siehe Abschnitt 5.

### Variante B — Guss + flache Unterkante (Studie, NICHT geliefert)

| Größe | Variante A | Variante B |
|---|---|---|
| Bolzenradius `STEMPEL_AUGE.r` | 0,590 m | **0,516 m** |
| Schalenversatz `DREHPUNKT.versatz` | 0,300 m | **0,374 m** |
| Summe (= Äquator geschlossen) | 0,890 m | 0,890 m — **gleich** |
| Schwenk offen `OFFEN` | 96,25° | **123°** |
| Zahn-Unterkante zu / halb / offen | −2,498 / −2,700 / −2,217 | −2,498 / −2,574 / **−1,655** |
| **Differenz offen** | 0,566 m | **0,003 m** (Ziel ±0,05) |
| größter Durchmesser | 3,227 m | **3,270 m** (Grenze 3,38) |
| Korbvolumen | 1.598 l | **1.598 l** — die geschlossene Form ist Punkt für Punkt dieselbe |
| Sektorluft | 9,66° | **0,69°** |
| Zylinder, kürzeste Länge (Rohr 0,42 m) | 0,5405 m | **0,4386 m** |
| Hebelarm, kleinster über den Weg | 0,0924 m | **0,0111 m** |

---

## 5 Warum die Krümmung die flache Unterkante nicht kann

Die Höhe der Zahnunterkante in der offenen Stellung ist

    Y = Y_Bolzen + y_e · cos S + z_e · sin S

mit (y_e, z_e) der Lage der Zahnunterkante im Schalenrahmen und S dem Schwenk. Gemessen
liegt sie bei (−0,874; −0,783) m.

Geschlossen müssen sich die Spitzen auf der Achse treffen. Damit ist `z_e` = (Spitzenradius
zu) − (Bolzenradius) ≈ 0,05 − 0,59 festgenagelt. Bei S = 96,25° ist sin S = 0,994: Der Zahn
fällt praktisch um den ganzen Bolzenradius durch, 0,78 m, während der Stempel nur 0,12 m
unter der Bolzenebene endet. **Wie die Schale zwischen Bolzen und Spitze gekrümmt ist, steht
in dieser Gleichung nicht — es kürzt sich heraus.** Eine andere Biegung verschiebt den Bauch
der Sichel, nicht ihr Ende.

Es bleiben zwei Stellschrauben, und beide gehören zum Formvertrag:

- **Der Bolzen wandert nach innen.** Solange `STEMPEL_AUGE.r + DREHPUNKT.versatz` = 0,890 m
  bleibt, ändert sich an der geschlossenen Form kein Punkt — nur der Drehpunkt liegt woanders
  im selben Korb.
- **Der Schwenk geht über 96,25° hinaus.** Die Zähne stehen offen dann nicht mehr senkrecht,
  sondern zeigen schräg nach außen.

Beide zusammen ergeben eine ganze Familie von Lösungen; abgetastet:

| Schwenk | Bolzen r | Versatz | Ø offen | Sektor | Hebelarm min | Zyl. kürzeste |
|---|---|---|---|---|---|---|
| 105° | 0,164 | 0,726 | 2,298 | 159,9° ✗ | 0,134 | 0,088 ✗ |
| 110° | 0,251 | 0,639 | 2,476 | 47,1° ✗ | 0,068 | 0,160 ✗ |
| 115° | 0,345 | 0,545 | 2,739 | 41,4° ✗ | 0,039 | 0,249 ✗ |
| 118° | 0,406 | 0,484 | 2,920 | 41,8° ✗ | 0,007 | 0,312 ✗ |
| 120° | 0,448 | 0,442 | 3,052 | 41,3° ✗ | 0,023 | 0,360 ✗ |
| **123°** | **0,516** | **0,374** | **3,270** | **35,3°** ✓ | 0,011 | **0,439** ✓ |
| 126° | 0,588 | 0,302 | 3,510 ✗ | 30,1° | 0,007 | 0,498 |

Alle treffen die flache Unterkante auf wenige Millimeter. Genau **einer** hält gleichzeitig
den Sektor (< 36°) und die Zylinderlänge (> 0,42 m Rohr): 123°. Er ist Variante B.

### Der Totpunkt — der Grund, warum Variante B nicht einfach eingebaut werden kann

Bei Variante B fällt der Hebelarm des Zylinders bei 83 % Öffnung auf **11 mm**. Dort stehen
Bolzen, Zylinderaufnahme und Schalenauge auf einer Geraden: Die Schale ließe sich mit keinem
Druck weiterdrehen.

Das ist keine Eigenheit dieses Zahlenpaars. Die Zylinderaufnahme sitzt über der Bolzenebene,
das Schalenauge dreht auf einem Kreis um den Bolzen — und die Richtung vom Bolzen zur
Aufnahme liegt damit bei **102…107° Schwenk**, egal wo der Bolzen steht. Der heutige
Anschlag bei 96,25° hört elf Grad davor auf; genau deshalb fällt der Hebelarm schon heute
ganz offen auf 0,0924 m (offener Punkt 1 des Protokolls vom 14.09.). Die flache Unterkante
verlangt mindestens 113°. **Jeder Weg dorthin führt durch den Totpunkt**, solange
`OBERE_ANBINDUNG` radial am Schalenkopf sitzt.

Wer die flache Unterkante will, muss also drittens `OBERE_ANBINDUNG` von der Bolzengeraden
wegsetzen (ein Anlenkauge, das vom Rücken absteht, statt eines, das in der Fersenlinie
liegt) oder `ZYLINDER_AUFNAHME` versetzen. Das ist ein eigener Schritt mit eigener Abnahme.

---

## 6 Prüfkette

- `npm test`: **30 Dateien, 281 Tests grün** (279 vorher, dazu zwei neue in
  `test/schalenform.test.ts`). Keine bestehende Erwartung geändert.
- `npm run build`: grün (`tsc --noEmit` und `vite build`).
- `src/greifer/fuenfschalen.glb` neu exportiert — 1.111 kB, 212 Meshes, 13.304 Dreiecke,
  8 Clips. Ohne den Export zeigte die Vorschauseite weiter die alte Form.
- `src/excavator/`, `src/grapple/`, `src/main.ts` **nicht angefasst**. Der Bagger trägt
  weiter die Sichelkralle.

---

## 7 Offen

1. **Variante A oder B?** Die Form (ein Guss) steckt in beiden. Der Unterschied ist die
   flache Unterkante und ihr Preis: Sektorluft von 9,7° auf 0,7°, Zylinderreserve von 12 cm
   auf 2 cm, und ein Totpunkt, der zusätzlich das Anlenkauge verlangt. **Empfehlung:**
   Variante A abnehmen, Variante B als eigenen Auftrag „Anlenkung neu" führen — dort gehört
   der offene Punkt 1 vom 14.09. ohnehin hin.
2. **Die Bolzenbohrung ist in der reinen Seitenansicht nicht zu sehen**, weil hinter ihr
   Werkstoff steht und der Riss keine Bohrungen ausschneidet. In der Vorderansicht und im
   Dreiviertelblick steht die Hülse 50 mm je Seite vor und liest sich als Lager.
3. **Nicht neu gemessen:** Einfüllquerschnitt (0,382 m²) und freie Maulfläche (0,605 m²) aus
   dem Protokoll vom 14.09. Am Schlund hat sich nichts geändert, was oberhalb der
   Bolzenebene liegt; der Schalenkopf ist dort 0,5 l kleiner geworden.
