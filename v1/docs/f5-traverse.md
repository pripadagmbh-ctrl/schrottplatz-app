# Welche Mitteltraverse bekommt der Fünfschalengreifer?

**Zum Ansehen:** `docs/f5-traverse-2026-09-15.svg` — in der Planmappe unter `/v1/plaene/`.
Drei Spalten nebeneinander, jede offen und geschlossen, alle im selben Maßstab.

**Status:** Entscheidungsvorlage. Es ist nichts gebaut. Der Fünfschalengreifer sitzt
weiter in der Vorschau (`/greifer.html`), am Bagger hängt unverändert die Sichelkralle
(E-009). Diese Seite ändert keine Zeile am gespielten Spiel.

**Was offen ist:** E-009 hat zwei Kennwerte ausdrücklich nicht entschieden — die
Zylinderneigung (heute 38,90°, Ziel unter 20°) und den Hebelarm (heute 0,0924 m, Ziel
über 0,10 m). Beide hängen an drei Punkten: `ZYLINDER_AUFNAHME`, `STEMPEL_AUGE`,
`OBERE_ANBINDUNG`. Die Zylinderaufnahme sitzt am Rand der Mitteltraverse — ihr Radius
**ist** der halbe Traversendurchmesser. Deshalb ist die Traverse die Tür zu beiden
Zahlen, und deshalb steht sie seit dem 14.09. als Punkt 10 in `docs/offene-punkte.md`.

---

## Die 4.567 Lösungen

**Gefunden, nicht neu gerechnet.** Sie kommen aus `tools/fuenfschalen/anlenkung.ts` vom
14.09.2026; das Werkzeug läuft unverändert und meldet dieselbe Zahl wie im Protokoll
`docs/messungen/2026-09-14_fuenfschalen-zahnwinkel.md`, Abschnitt 5:

```
4567 Anlenkungen halten BEIDE Ziele und den Vertrag.
KEINE davon kommt ohne grössere Mitteltraverse aus.
  Kleinster Aufnahmeradius über alle Lösungen: 0.540 m — das ist eine
  Mitteltraverse von Ø 1.10 m statt der Ø 0,70 der Positionsliste.
```

Was dort **nicht** stand, ist die Zwischenfrage, an der Patrick entscheidet: Was
bekommt man für Ø 0,80, Ø 0,95, Ø 1,00 — und was kostet es am Korb? Dafür sind zwei
Werkzeuge dazugekommen (`traverse-rechnen.ts` / `traverse.ts` für die Kennwerte,
`traverse-messen.ts` / `traverse-korb.ts` für die Messung am gebauten Modell). Das ist
**neu gerechnet und neu gemessen**, und es widerspricht dem Bestand an keiner Stelle.

---

## Der Befund, der alles andere ordnet

**Die Traverse allein zu vergrößern macht es schlechter, nicht besser.** Wenn nur der
Durchmesser wächst und sonst nichts (`traverse.ts`, Tabelle 2):

| Ø | Neigung größte | Hebelarm kleinster |
|---|---|---|
| 0,70 (heute) | 38,90° | 0,0924 m |
| 0,90 | 32,86° | **0,0376 m** |
| 1,10 | 26,21° | **0,0046 m** — Totpunkt |

Der Zylinder steht zwar steiler, aber die Wirkungslinie läuft durch den Bolzen: Die
Schale steht fest, gleich wie viel Druck anliegt. Wer die Traverse anfasst, muss
**gleichzeitig** das Schalenauge versetzen und die Aufnahme anheben. Genau das tun die
Varianten B und C.

---

## Die drei Varianten

Gerechnet nach **einer** Regel für alle: flachster Zylinder unter allen Anlenkungen, die
den Vertrag aus `anlenkung.ts` halten und einen Hebelarm über dem E-009-Ziel 0,10 m
tragen; unter den gleich flachen der stärkste Hebel. Variante A ist davon ausgenommen —
sie ist der **gebaute** Stand, nicht das Beste, was Ø 0,70 hergäbe.

| | **A — Ø 0,70** | **B — Ø 0,95** | **C — Ø 1,10** |
|---|---|---|---|
| | wie heute gebaut | die mittlere | Vorschlag aus E-009 |
| Zylinderaufnahme r / y | 0,340 / −0,730 | 0,465 / −0,635 | 0,540 / −0,625 |
| Schalenauge (Ay / Az) | 0,000 / 0,310 | −0,080 / 0,245 | −0,100 / 0,240 |
| **Neigung offen** | 23,6° | 15,4° | **10,6°** |
| **Neigung geschlossen** | 34,9° | 20,7° | **16,0°** |
| **Neigung größte** (Ziel < 20°) | 38,9° ✗ | 24,4° ✗ | **19,8° ✓** |
| **Hebelarm geschlossen** | 0,254 m | 0,201 m | 0,203 m |
| **Hebelarm offen** (schwächste Stelle, Ziel > 0,10) | 0,092 m ✗ | **0,118 m ✓** | **0,118 m ✓** |
| **Schließkraft gegen heute** | ±0 % | **+28 %** | **+28 %** |
| Zylinder zu / offen (Hub) | 0,979 / 0,540 m (0,439) | 1,046 / 0,670 m (0,376) | 1,049 / 0,670 m (0,379) |
| **Nettokorb** | 1.524 l | 1.529 l | 1.527 l |
| **gegen heute** | ±0 l | **+5 l** | **+3 l** |
| **Mündung zugebaut** | 52 % | 61 % | **66 %** |
| davon die Traverse | 0,404 m² | 0,714 m² | 0,942 m² |
| Kopf gegen Korbweite (2,19 m) | 32 % | 43 % | 50 % |
| Kopf wirkt | schlank | kräftig | wuchtig |
| Traverse rückt hoch um | 0 cm | 10 cm | 10 cm |
| Zylinderauge im Guss (E-013) | ja | Konsole 26 mm | Konsole 36 mm |

**Fußnote A\*:** Ø 0,70 mit der besten Anlenkung, die dieser Durchmesser hergibt, käme auf
**32,0°** und **0,109 m**. Der Hebelarm wäre damit erreicht, die Neigung nicht — und auch
dort verlässt das Zylinderauge den Gusskörper (Konsole 8 mm). Der Gewinn an Schließkraft
ist also **nicht** der dickeren Traverse zuzuschreiben, sondern dem Nachstellen. Was die
Traverse kauft, ist allein die Neigung: 32,0° → 24,4° → 19,8°.

---

## Die harten Bedingungen — alle drei halten sie

Gemessen am gebauten Modell, über die **Knotennamen**, nicht über Extrempunkte
(`test/traverse.test.ts`, sieben Wächter):

| | A | B | C |
|---|---|---|---|
| Grabtiefe (Knoten `07_ZAHN`, tiefster Punkt über den ganzen Weg) | 2,7511 m | 2,7511 m | 2,7511 m |
| Bauhöhe geschlossen | 2,505 m | 2,505 m | 2,505 m |
| Breite geschlossen | 2,190 m | 2,190 m | 2,190 m |
| Hüllkreis über den Weg (Platzmaß, Grenze 3,3805 m) | 3,232 m | 3,232 m | 3,232 m |
| Fünf Spitzen treffen sich (Abstand von der Achse, zu) | 142,3 mm | 142,3 mm | 142,3 mm |
| Sektor genutzt (von 36°) | 26,34° | 26,34° | 26,34° |
| Bruttokorb | 1.615 l | 1.615 l | 1.615 l |

Alle drei Zahlen sind **auf die vierte Stelle gleich**, und das ist kein Zufall: Der
Bolzen (`STEMPEL_AUGE`), der Schalenversatz und der Anschlag `OFFEN` werden von keiner
Variante angefasst. Die Traverse sitzt 57 cm über der Bolzenebene; alles, was den Korb,
die Tiefe und das Schließen bestimmt, liegt darunter.

**Zur Grabtiefe des Baggers:** `CLAW_MAX_DEPTH` = 2,9995 m gehört zur **Sichelkralle**
(`src/excavator/clawGeometry.ts`) und damit zum gespielten Bagger. Der
Fünfschalengreifer hängt nicht daran. Diese Seite kann den Bodenanschlag nicht bewegen.

**Zum Zahn (E-013):** Keine Variante rührt ihn an. Zeichnung wie Modell zeigen weiterhin
**einen** durchgehenden Gusskörper von der Lagerhülse bis zur Spitze; es guckt kein
Stempel heraus. Die Wächter aus E-013 laufen unverändert.

---

## Nimmt die dickere Traverse Ladevolumen weg?

**Nein — sie nimmt keinen Liter.** Der Korb ist der Raum unter der Bolzenebene
(y = −1,5335 m); die Traverse steht bei −0,96 bis −0,855 m, also 57 cm darüber. Gemessen
ändert sich der Nettokorb um **+5 l bzw. +3 l** von 1.524 l — und das nicht wegen der
Traverse, sondern weil das Schalenauge von Az 0,31 auf 0,245 nach innen rückt und dabei
ein wenig Werkstoff aus dem Korb nimmt.

**Was sie nimmt, ist die Mündung.** Schüttgut fällt senkrecht ein, und senkrecht über der
Korbmündung (2,488 m²) steht Eisen:

| | A | B | C |
|---|---|---|---|
| Traverse | 0,404 m² | 0,714 m² | 0,942 m² |
| Stempel + Säule + Ausleger | 0,432 m² | 0,432 m² | 0,432 m² |
| Zylinder | 0,309 m² | **0,225 m²** | **0,191 m²** |
| Schalenköpfe | 0,797 m² | 0,792 m² | 0,790 m² |
| **zusammen (ohne Doppelzählung)** | **1,291 m² = 52 %** | **1,514 m² = 61 %** | **1,646 m² = 66 %** |

Bemerkenswert ist die dritte Zeile: Die Zylinder verdecken **weniger**, je dicker die
Traverse wird — sie stehen steiler und werfen einen schmaleren Schatten. Je 10 cm
Durchmesser nimmt die Traverse 0,134 m² dazu, die Zylinder geben 0,030 m² zurück; rund
ein Fünftel kommt also wieder herein.

Patricks ursprüngliche Klage („Traverse und Stempel nehmen das Volumen des Greifers für
das Material") betraf den **Schlund**, und dort ändert sich fast nichts: 0,670 → 0,690 m²
in der Ebene 5 cm über den Bolzen. Die Mündung eine Etage höher ist die Stelle, an der es
wirklich enger wird.

---

## Empfehlung: **B, Ø 0,95**

**Warum nicht A.** Der gebaute Stand verfehlt beide Ziele, und der Hebelarm ist die
gefährlichere der beiden Zahlen: 0,092 m an der **schwächsten** Stelle, und diese Stelle
ist die offene — also genau die, in der man in den Haufen einsticht und zudrückt. Ein
Greifer, der beim Zubeißen am wenigsten Kraft hat, ist an einem Schrottplatz das falsche
Werkzeug. Das gilt unabhängig davon, wie die Traversenfrage ausgeht.

**Warum nicht C.** Ø 1,10 ist die **Schwelle**, nicht ein guter Wert. Bei Ø 1,05 gibt es
keine einzige Lösung, die beide Ziele hält; bei Ø 1,10 gibt es sie mit 19,75° — 0,25°
unter dem Ziel. Wer dort zusätzlich Reserve auf den Hebelarm legen will (0,12 m statt
0,10), steht sofort wieder bei 20,6°. Dafür wird der Kopf halb so breit wie der ganze
geschlossene Korb, und zwei Drittel der Mündung sind zugebaut. Das ist viel Aussehen für
0,25° Vorsprung.

**Warum B.** Ø 0,95 ist der kleinste Durchmesser, dessen flachster Arbeitspunkt noch
**denselben Hebelarm trägt wie die Ø-1,10-Lösung** (0,1179 m gegen 0,1179 m). Ø 0,90
kommt dort nur auf 0,1003 m — es steht auf dem Ziel, nicht darüber. B kauft damit **drei
Viertel des Neigungsgewinns** (38,9° → 24,4° von möglichen 19,8°) für **knapp zwei Drittel
des Zuwachses** (25 cm von 40 cm), bei gleicher Schließkraft wie C und 5 Prozentpunkten
weniger zugebauter Mündung.

**Was Patrick gewinnt:**

- **+28 % Schließkraft an der schwächsten Stelle** (0,092 → 0,118 m). Das ist die Zahl,
  die man beim Zubeißen im Haufen merkt.
- **14,5° weniger Zylinderneigung** (38,9 → 24,4). Der Zylinder zieht gerader, statt quer
  über den Kopf zu stehen; die Seitenkraft auf Gabel und Auge fällt entsprechend.
- **Keinen Liter Korb.** Der Nettokorb steigt sogar um 5 l.
- Grabtiefe, Bauhöhe, Hüllkreis, Sektor und das Zusammenlaufen der fünf Spitzen bleiben
  auf die vierte Stelle gleich.

**Was er verliert:**

- **Der Kopf wird kräftig.** Ø 0,95 statt Ø 0,70 — 43 % der geschlossenen Korbweite statt
  32 %. Das sieht man sofort und über den ganzen Öffnungsweg.
- **Die Mündung wird enger:** 52 % → 61 % zugebaut. Große Brocken finden von oben
  schlechter hinein; feines Material fällt ohnehin außen an den Schalen vorbei.
- **Das 20°-Ziel bleibt verfehlt** (24,4°). Wer es haben will, muss auf C gehen.
- **Die Konsole am Zylinderauge kommt zurück** — 26 mm, ein kurzer angeschweißter Sockel.
  E-013 hat sie am 14.09. abgeschafft, weil der Zinken sich als Metallblock mit
  angehängtem Zahn las. Der Zahn selbst bleibt unangetastet; betroffen ist allein das Auge
  am oberen Ende. Trotzdem: Das ist ein halber Schritt zurück, und er steht auf jeder
  Variante außer A — auch auf A\*.
- **Die Traverse rückt 10 cm höher**, unter das Drehwerksgehäuse. Wie die beiden
  ineinandergreifen, ist gezeichnet, aber nicht konstruiert.

**Wenn Patrick das Aussehen von B nicht mag**, ist die nächstbeste Antwort nicht C,
sondern **A\***: Ø 0,70 behalten, nur die Anlenkung nachstellen. Das bringt den Hebelarm
über das Ziel (0,109 m, +18 %) und lässt den Kopf, wie er ist. Der Preis ist, dass die
Neigung bei 32° bleibt — sichtbar schräg.

---

## Wie gemessen wurde

Am 14.09.2026 ist an dieser Baugruppe ein Messwerkzeug weggeworfen worden, weil es
„äußerster Punkt = Spitze" annahm. Bei einer nach innen gekrümmten Sichel ist der
äußerste Punkt die **Rückseite**; das Werkzeug meldete 34 cm in die falsche Richtung.
Hier wird deshalb über Knotennamen gemessen:

| Was | Wie |
|---|---|
| Grabtiefe | tiefster Netzpunkt des Knotens `07_ZAHN` unter `SHELL_TIP_xx`, über 41 Stellungen |
| Spitzen auf der Achse | Schwerpunkt des Spitzenrings (letzte fünf Punkte, so legt `baueGreiferspitze` sie ab), nicht der äußerste Punkt |
| Korbvolumen | Rotationskörper der geschlossenen Mittellinie unter der Bolzenebene, 4.000 Scheiben, minus Werkstoff im Raster 10 mm mit **Tiefenzähler** statt Parität |
| Schlund | Eisenfläche in der Ebene 5 cm über den Bolzen, dasselbe Verfahren in einer Scheibe |
| Einwurfschatten | senkrechte Projektion alles Eisens über der Bolzenebene auf die Mündungsscheibe, Raster 10 mm |
| Zylinderauge im Guss | Strahl mit Tiefenzähler durch `06_ZINKEN`; liegt das Auge außerhalb, wird der Abstand in 72 Richtungen der Radialebene in 2-mm-Schritten abgeschritten |
| Neigung, Hebelarm, Zylinderlänge | Zeile für Zeile dieselbe Rechnung wie `src/fuenfschalen/rig.ts`, im Wächter gegen das Original gehalten |

Die Varianten entstehen, indem das Messwerkzeug `ZYLINDER_AUFNAHME`, `OBERE_ANBINDUNG`
und `MASS.traverse` **vor** dem Bauen setzt und danach zurückstellt. `src/` bleibt
unberührt; ein eigener Wächter prüft, dass nach dem Messen jeder dieser Werte wieder auf
dem gebauten Stand steht.

**Was nicht gemessen ist:**

1. **Ob Traverse und Drehwerksgehäuse sich vertragen**, wenn die Traverse 10 cm steigt.
   Gezeichnet ist es; ob der Flansch im Gehäuse sitzt oder das Gehäuse in der Traverse
   steckt, ist eine Konstruktionsfrage und gehört in den Umbau, nicht auf dieses Blatt.
2. **Wie sich der Greifer mit größerer Traverse anfühlt.** Er hängt nicht am Bagger, es
   gibt keine Physik dazu, und diese Seite schlägt nicht vor, das zu ändern.
3. **Der Materialfluss durch die engere Mündung.** Die 52 / 61 / 66 % sind Geometrie. Ob
   ein Träger, der heute hineinfällt, morgen hängen bleibt, sagt nur ein Versuch.
4. **Das Gewicht.** Eine Traverse von Ø 1,10 wiegt gut das Zweieinhalbfache einer von
   Ø 0,70. Am Spiel hängt daran nichts, an einem echten Gerät sehr viel.

---

## Auf dem Gerät zu prüfen

1. **`docs/f5-traverse-2026-09-15.svg` auf dem iPhone öffnen** (Planmappe `/v1/plaene/`):
   Sind die drei Spalten ohne Zoomen zu unterscheiden, und ist zu sehen, welcher Kopf
   welcher ist?
2. **Die drei geschlossenen Ansichten nebeneinander halten:** Wo kippt der Kopf vom
   „kräftig" ins „wuchtig" — bei B oder erst bei C?
3. **Die Fußnote lesen:** Wäre A\* — gleiche Traverse, nur nachgestellte Anlenkung — die
   ruhigere Antwort?

Ins Spiel geht nichts, bevor diese Frage beantwortet ist.
