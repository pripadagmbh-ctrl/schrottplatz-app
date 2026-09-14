# Messprotokoll 14.09.2026 — Fünfschalengreifer, Zahnwinkel und Facetten

**Was gemessen wurde:** das Vorschaumodell gegen die Herstellerzeichnung, die Patrick am
14.09.2026 geschickt hat — zwei Ansichten mit fünf Maßbuchstaben, ohne Maßtabelle.
Vergleichbar sind deshalb nicht Millimeter, sondern Verhältnisse.

**Womit:** `tools/fuenfschalen/abcde.ts` (die fünf Strecken, Zahnachse, Korbvolumen, Sektor),
`tools/fuenfschalen/oeffnungsstudie.ts` (Anschlag von 96,25° bis 40°),
`tools/fuenfschalen/anlenkung.ts` (Raster über alle vier Punkte der Anlenkung). Alle drei
bauen `baueGreifer()` und messen an den Netzeckpunkten in Weltlage. Kein Gerätetest — das
hier ist eine Rechnung am Modell.

**Form entscheidet Patrick am Bild:** `docs/f5-greifer-seite.png` (drei Stellungen, ein
Maßstab, Höhenlinie auf der Stempelunterkante), `docs/f5-schale-schulter.png` (Schulter und
Zahnwinkel im Detail), `docs/f5-greifer-varianten.png` (Auftrag 3, A gegen B),
`docs/f5-greiferschale.png` (die Schale allein, drei Ansichten).

**Der Bagger trägt weiter die Sichelkralle.** An `src/excavator/`, `src/grapple/` und
`src/main.ts` ändert dieses Paket keine Zeile.

---

## 1 ABCDE — vorher gegen nachher

| | vorher | nachher | Zeichnung |
|---|---|---|---|
| **A** Breite geschlossen | 2,195 m | **2,190 m** | — |
| **D** Höhe geschlossen | 2,505 m | **2,505 m** | — |
| **B** Spitzenweite offen | 3,216 m | **3,232 m** | — |
| **E** größte Breite offen | 3,227 m | **3,232 m** | — |
| **C** Höhe offen | 2,210 m | **2,210 m** | — |
| C/D | 0,882 | **0,882** | rund 0,83 |
| E/A | 1,470 | **1,476** | rund 1,30 |
| B/E | 0,997 | **1,000** | — |

**B ist hier enger gefasst als in der Ansage:** gemessen wird der größte Radius eines
**Zahn**punktes, nicht der des ganzen Greifers. Deshalb stand vorher 3,216 statt 3,227 —
der weiteste Punkt lag im Rücken der Schale, nicht am Zahn. Jetzt liegt er am Zahn, weil die
Anstellung ihn nach außen dreht; B und E sind damit dasselbe Maß.

### Die drei Zahlen der Formarbeit

| | vorher | nachher | Zeichnung |
|---|---|---|---|
| Zahnachse gegen die Senkrechte, **0 %** offen | −108,40° | **−96,25°** | — |
| dieselbe bei **50 %** | −60,27° | **−48,12°** | — |
| dieselbe bei **100 %** | **−12,15°** | **0,00°** | **0,00° (lotrecht)** |
| Zahnunterkante unter der Stempelunterkante | 0,566 m | 0,565 m | — |
| dasselbe in % von C | 25,6 % | **25,6 %** | rund 18 % |

Positives Vorzeichen heißt „Spitze nach außen". Gemessen wird die **Achse** des Zahns — die
Verbindung der beiden Stirnflächen-Schwerpunkte —, nicht die Tangente des Schalenendes.

### Vertrag: was sich nicht verschlechtern durfte

| | vorher | nachher | Grenze |
|---|---|---|---|
| größter Hüllkreis über den Öffnungsweg | 3,227 m | **3,232 m** | ≤ 3,38 m |
| Sektor genutzt (r ≥ 0,30 m) | 26,34° | **26,34°** | < 36° |
| Hebelarm, kleinster | 0,0924 m | **0,0924 m** | nie unter 0,05 |
| Zylinderneigung, größte | 38,90° | **38,90°** | — |
| Bruttokorb | 1.615 l | **1.615 l** | — |
| Nettokorb | 1.541 l | **1.536 l** (−0,3 %) | nicht wesentlich unter 1.598 |
| Zahnspitze geschlossen, kleinster Radius | 0,0425 m | **0,0368 m** | < 0,10 m |

**Zum Nettokorb, damit die Zahl nicht verwirrt:** Im Log steht für den 14.09.2026 mittags
1.598 l. Diese Zahl kam von einem Wegwerf-Skript mit einer anderen Ausnahmeregel; mit dem
neuen Werkzeug, dessen Verfahren im Dateikopf steht, sind es 1.541 l für denselben Stand.
**Vergleichbar ist die Differenz vorher/nachher, nicht der Absolutwert** — und die sind
−5 l, weil die vollere Schulter ein Stück weiter in den Korb greift. Das Verfahren zählt mit
einem Tiefenzähler statt mit Parität (Haut, Guss und Hülse durchdringen einander) und nur
innerhalb des Rotationskörpers der geschlossenen Mittellinie.

---

## 2 Auftrag 1 — der Zahn steht offen lotrecht

**Der Befund.** Der Anschlag `OFFEN` = 96,25° ist so hergeleitet, dass die **Tangente** des
Schalenendes offen senkrecht steht (Ansage 13.09.2026: „die Spitzen senkrecht"). Der Zahn ist
über seine 250 mm mit R 0,70 aber **noch einmal in sich gebogen**; seine Achse liegt rund eine
halbe Biegung hinter der Sitztangente. Gemessen: **12,15°**, und zwar nach innen.

**Die Behebung.** Der Zahn wird nicht gegengedreht — er ist starr angeschraubt. Schräg ist
sein **Sitz**:

    zahnAnstellung(offen) = offen − schalenEnde().th + zahnEigenwinkel()

Mit dem heutigen Formsatz sind `offen` und `schalenEnde().th` dieselben 96,25°, es bleiben die
12,15° der Eigenbiegung. Die Formel steht trotzdem so da, damit ein anderer Anschlag den Zahn
mitführt statt ihn wieder schief zu stellen — genau das braucht Abschnitt 4.

Gedreht wird um den **Schwerpunkt der Sitzfläche**, also um den Punkt, in dem die Achse die
Schale verlässt: Die Spitze wandert, der Sitz nicht. Danach sitzt der Zahn **3,8 mm tiefer**
ein, sonst hebt die angeschrägte Sitzfläche an einer Kante um knapp 4 mm ab.

**Was es gekostet hat:** 5 mm am größten Hüllkreis (3,227 → 3,232 m, Grenze 3,38). Sektor,
Hebelarm, Zylinderneigung, Korbvolumen, A, C, D unverändert. Geschlossen kommt der Zahn
sogar **näher** an die Achse (r 0,0425 → 0,0368 m), die Spitzen treffen sich also besser.

---

## 3 Auftrag 2 — die Schale wird facettiert

Drei Eingriffe, keiner an der Kinematik.

**Schulter.** Die Blende von der Ferse in die Schale lief als **eine** weiche Kurve über die
ganze Ferse. Jetzt zwei Abschnitte (`SCHULTER_AB` 0,42 · `SCHULTER_BIS` 0,74 ·
`SCHULTER_VOR` 0,22, alles SW nach Augenmaß an der Zeichnung):

| Anteil der Fersenkurve | Breite vorher | Breite nachher |
|---|---|---|
| 0,00 (Bolzen) | 400 mm | 400 mm |
| 0,20 | 381 mm | **392 mm** |
| 0,40 | 337 mm | **384 mm** |
| 0,50 | 310 mm | **358 mm** |
| 0,60 | 283 mm | **293 mm** |
| 0,70 | 259 mm | **238 mm** |
| 1,00 (Station 0) | 220 mm | 220 mm |

Der Arm bleibt über 42 % der Ferse satt und fällt dann über ein Drittel ab. Das ist der
Absatz, sowohl in der Rücken- als auch in der Draufsichtlinie.

**Kanten.** `strang` baute ein Vierkantprofil, dessen vier Längskanten sich die Eckpunkte
teilten — `computeVertexNormals` hat sie weggemittelt und aus dem Gussträger einen Schlauch
gemacht. Jetzt bekommt **jede Fläche eigene Eckpunkte**: quer scharf, längs weiter gemittelt,
die Sichel also glatt. Dazu eine **Fase von 16 %** der kleineren Querschnittsseite an allen
vier Längskanten — 21 mm am Bolzen, 6 mm am Zahnfuß. Dieselbe Behandlung für den Zahn, dessen
First sonst rundgemittelt wurde.

Die Fase ändert die **Seitenansicht nicht**: Sie schneidet die Ecken in der Breitenrichtung
weg, und dort blickt die Silhouette hindurch. Was sie ändert, ist A (2,195 → 2,190 m) und die
Dreieckszahl.

**Der Zinken bleibt ein Gussstück** (E-013). Facettiert heißt gekantet, nicht zerlegt: Es ist
weiterhin **ein** `strang` vom Bolzen bis unter den Zahn, und die vier Wächter von E-013
laufen unverändert.

| | vorher | nachher |
|---|---|---|
| Meshes (ganzer Greifer) | 212 | **212** |
| Dreiecke | 13.304 | **14.584** |
| GLB | 1.111 kB | **1.185 kB** |

---

## 4 Auftrag 3 — die Öffnung zurücknehmen: der Konflikt, mit Zahlen

Die Ansage war, den Widerspruch zu **messen und zu melden, nicht zu überfahren**. Er
bestätigt sich, und zwar über den ganzen Bereich.

Gerechnet mit `oeffnungsstudie.ts`; der Zahn steht in **jeder** Zeile lotrecht, weil seine
Anstellung dem Anschlag folgt. Nur der Anschlag wandert, sonst nichts.

| Anschlag | E | E/A | C/D | Zahn unter Stempel | in % von C | Hebelarm |
|---|---|---|---|---|---|---|
| **96,25°** (heute) | 3,232 m | 1,476 | 0,882 | 0,565 m | **25,6 %** | 0,0924 m |
| 90,00° | 3,139 m | 1,434 | 0,923 | 0,669 m | 28,9 % | **0,1401 m** |
| 85,00° | 3,068 m | 1,401 | 0,953 | 0,748 m | 31,3 % | 0,1745 m |
| 80,00° | 2,998 m | 1,369 | 0,976 | 0,822 m | 33,3 % | 0,2049 m |
| 75,00° | 2,928 m | 1,337 | 0,995 | 0,892 m | 35,2 % | 0,2312 m |
| **70,00°** | **2,859 m** | **1,306** | 1,012 | 0,955 m | 36,7 % | 0,2533 m |
| 65,00° | 2,790 m | 1,274 | 1,026 | 1,013 m | 38,1 % | 0,2543 m |
| 60,00° | 2,723 m | 1,243 | 1,038 | 1,064 m | 39,3 % | 0,2543 m |
| **Zeichnung** | — | **1,30** | **0,83** | — | **18 %** | — |

**Der Befund in einem Satz:** Das Verhältnis E/A ist bei 70° getroffen — und dabei laufen
**C/D von 0,882 auf 1,012** und **der Zahn von 25,6 auf 36,7 %** genau von der Zeichnung
weg. Zwei der drei abgelesenen Verhältnisse verschlechtern sich, um das dritte zu treffen.

Der Grund ist der, der schon in E-013 steht: Wie tief der Zahn offen hängt, folgt aus dem
Bolzenradius, nicht aus dem Bogen. Je weiter die Schale aufschwenkt, desto mehr zieht sie den
Zahn wieder nach oben. Der tiefste Punkt liegt bei rund 40 % Öffnung; jede Rücknahme des
Anschlags rückt die Endlage in diese Richtung.

**Priorität 1 gewinnt. Auftrag 3 ist nicht gebaut.** Variante B ist gezeichnet:
`docs/f5-greifer-varianten.png`, untere Reihe.

**Nebenbefund, der nicht verloren gehen darf:** Ein Anschlag von **90°** bringt den Hebelarm
auf **0,1401 m** und damit über das Ziel aus E-009 — ohne jede Änderung an der Anlenkung.
Preis wären 3,3 Punkte C/D und 3,3 Prozentpunkte Zahntiefe.

---

## 5 Auftrag 4 — die Anlenkung, abgerastert

Offen sind aus E-009 zwei Kennwerte. Die Formarbeit hat sie **nicht verändert**: Neigung
weiterhin 38,90°, Hebelarm weiterhin 0,0924 m. Beide hängen allein an drei Punkten —
`ZYLINDER_AUFNAHME`, `STEMPEL_AUGE`, `OBERE_ANBINDUNG` —, und Schale, Korb, Sektor und das
Schließen auf der Achse hängen an keinem davon.

`anlenkung.ts` rastert alle vier Freiheiten ab (Aufnahme r und y, Auge y und z) und prüft
gegen den ganzen Vertrag: fährt zum Schließen aus, Hub ≥ 0,15 m, kürzeste Länge über dem Rohr
plus 2 cm, längste ≤ 1,05 m, Hebelarm geschlossen > 0,20 m, Aufnahme nicht näher an der Achse
als die Mittelsäule.

**Ergebnis: 4.567 Anlenkungen halten beide Ziele und den Vertrag — und keine einzige davon
mit der Ø-0,70-Mitteltraverse der Positionsliste.** Der kleinste Aufnahmeradius, der
funktioniert, ist **0,540 m**; das ist eine Mitteltraverse von **Ø 1,10 m**.

Mit Ø 0,70 schließen die beiden Ziele einander aus:

| mit Ø-0,70-Traverse | erreichbar | dabei der andere Wert |
|---|---|---|
| kleinste Neigung | 26,39° (Ziel < 20) | Hebelarm **0,0024 m** — ein Totpunkt |
| größter Hebelarm | 0,2688 m (Ziel > 0,10) | Neigung **50,71°** |

**Warum, in einem Bild:** Das Zylinderauge der Schale läuft auf einem Kreis von 0,31 m um
einen Bolzen auf r 0,59 — es wandert also zwischen r 0,56 und r 0,90. Ein Zylinder, der von
r 0,34 daran zieht, muss zwangsläufig 20 bis 56 cm nach außen ausholen; **das ist die
Neigung**. Senkrecht steht er nur, wenn er unter der Mitte dieses Bogens sitzt, also bei rund
r 0,7. Dasselbe wie bei einer Tür: Wer den Türschließer dicht am Scharnier ansetzt, braucht
viel Kraft und steht schräg; wer ihn weiter außen ansetzt, zieht gerade.

**Gebaut ist nichts.** Eine Traverse, die sich um zwei Drittel im Durchmesser ändert, ändert
die Silhouette des Greifers von oben bis unten, und Form entscheidet Patrick. Die zehn
schonendsten Lösungen stehen in der Ausgabe des Werkzeugs.

---

## 6 Die Wächter

Drei bestehende Prüfungen haben nach Auftrag 1 die **alte** Eigenschaft gemessen und darum
Alarm geschlagen. Keine ist aufgeweicht; jede misst jetzt die neue Eigenschaft.

| Wächter | Änderung | Begründung |
|---|---|---|
| „wird von der Aufhängung bis zur Zahnspitze nur dünner" | heißt jetzt „… bis zum **Schalenende**", und `profil()` endet an Station 6 statt 30 Schritte danach | Der Strahl lief auf dem verlängerten **Schalen**kreis in den Zahn hinein. Der liegt dort nicht mehr; der Strahl schnitt ihn schräg und meldete 104…122 mm für einen Körper, der nirgends dicker als 39 mm ist |
| neu: „läuft vom Zahnsitz bis zur Zahnspitze nur dünner" | misst längs `zahnBahn()`, der Achse des Zahns | Die zweite Hälfte der alten Zusage. Sie ist nicht weggefallen, sie wird nur längs der richtigen Achse gemessen |
| neu: „setzt den Zahn ohne Absatz auf das Schalenende" | Zahn am Sitz nicht dicker als die Schale darunter | Ersetzt, was der alte durchlaufende Strahl nebenbei mitgeprüft hat |
| „ist am Ende am dünnsten" | sucht über **beide** Profile | dieselbe Zusage, zwei Messstrecken |
| „hat kein Loch im Querschnitt" | prüft zusätzlich, dass auf jeder Zahnstation Werkstoff auf der Achse steht | dieselbe Zusage für den Zahn; die Stirnkappe an der Spitze bleibt aus, dort liegt der Strahl in der Fläche — dieselbe Ausnahme wie eine Zeile höher |
| „baut den Zahn auf sein Sollmaß" | Länge längs der Zahnachse statt als achsparalleles Hüllmaß | Ein um 12,15° gekippter Körper misst in der Hülle 260 statt 250 mm, obwohl an ihm kein Millimeter anders ist. Die Achse misst den Zahn, die Hülle seine Lage |

**Drei neue Wächter für die Eigenschaft selbst:**

- „stellt den Zahn bei voller Öffnung lotrecht" — Achse < 0,5° gegen die Senkrechte.
- „dreht den Zahn starr mit der Schale — keine laufende Korrektur" — über 21 Stützstellen muss
  der gemessene Winkel genau `Schwenk − OFFEN` sein. Weicht er ab, führt jemand den Zahn mit,
  und das wäre eine Animation statt einer Anstellung.
- „lässt die Zahnspitzen geschlossen auf der Achse zusammenlaufen" — die Anstellung verschiebt
  die Spitze; geschlossen darf sie nicht von der Achse wegwandern, sonst geht der Korb nicht zu.

`npm test` **300 Tests in 31 Dateien** grün (vorher 295 in 31), `npm run build` grün.

---

## 7 Was offen bleibt

1. **Die Öffnung (Auftrag 3).** Gemessen, gezeichnet, nicht gebaut — siehe Abschnitt 4.
2. **Die Anlenkung (Auftrag 4).** Lösungen gibt es, jede kostet die Ø-0,70-Traverse der
   Positionsliste — siehe Abschnitt 5.
3. **Die flache Unterkante** aus E-013 ist unverändert offen und hängt an denselben drei
   Punkten wie Nummer 2.
4. **Die 18 % der Zeichnung** sind mit keiner der gerechneten Varianten erreichbar. Heute sind
   es 25,6 %, und jede Rücknahme des Anschlags macht es schlechter. Erreichbar wäre es nur
   über den Bolzenradius — das ist Variante B aus E-013, die einen Totpunkt bei 83 % hat.
