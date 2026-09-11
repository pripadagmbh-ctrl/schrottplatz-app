# Tonkonzept (Stand 11.09.2026)

Anlass: „das gesamte Tonkonzept müssen wir überarbeiten" und „Wind und
Rauschen und so, alles gut, aber nichts davon klingt nach Schrottplatz".

Bisher wurde an einzelnen Klängen gedreht. Das greift zu kurz, weil das
Problem nicht in einem einzelnen Klang steckt, sondern in dem, was fehlt und
wie das Vorhandene zusammengesetzt ist. Dieses Papier legt die Struktur fest,
bevor wieder an Frequenzen gedreht wird.

## 1 Was ein Schrottplatz akustisch ist

Ein Schrottplatz ist **keine Geräuschkulisse mit Wind**. Er ist:

1. **Eine Maschine, in der man sitzt.** Sie läuft immer. Diesel im Stand,
   Diesel unter Last, Hydraulik beim Bedienen, das Drehwerk, das Klappern des
   Unterwagens. Das sind neunzig Prozent der Spielzeit.
2. **Stahl, der bewegt wird.** Nicht einzelne Aufschläge, sondern: ein
   schwerer Schlag und danach ein langes, unregelmäßiges Rieseln, Rutschen,
   Nachrutschen. Wer eine Fuhre abkippt, hört *einen* Krach und danach
   fünf Sekunden Geröll.
3. **Ein großer, offener Raum.** Alles hat eine Richtung und eine Entfernung.
   Die Presse steht hinten, der LKW an der Waage, die Halle links. Was weiter
   weg ist, ist nicht nur leiser, sondern dumpfer und kommt später.
4. **Betrieb.** Rückfahrwarner, Druckluft, Türen, Funk, eine zweite Maschine
   irgendwo, ein Radio aus dem Container.

Wind und Krähen sind die *Pause* zwischen alldem. Sie tragen den Platz nicht.

## 2 Was heute fehlt — Bestandsaufnahme

| | Stand vor dem Umbau |
|---|---|
| Motor | **Ein Sägezahn-Oszillator bei 48 Hz** hinter einem Tiefpass |
| Hydraulik | **Ein Dreieck bei 118 Hz** mit langsamem Zittern |
| Raum | **Kein einziger Panner.** Alles mono, keine Entfernung, keine Richtung |
| Material | Aufschlag, Fallen, Greifen — als Einzelereignisse, ohne Geröll danach |
| Mischung | Alles auf einem Bus, ein Kompressor über allem |
| Perspektive | Kabine und Außenansicht klingen identisch |

Der Motor ist der wichtigste Punkt: Man hört ihn immer. Solange er ein
Oszillator ist, klingt der Platz nach Synthesizer, egal wie gut ein
einzelner Aufschlag getroffen ist.

## 3 Die vier Schichten

Jede Schicht bekommt einen eigenen Bus mit eigenem Pegel. Das ist die
Voraussetzung dafür, dass man überhaupt mischen kann, statt an zwanzig Stellen
einzeln zu drehen.

**A — Maschine** (dauernd, folgt dem Zustand)
Diesel, Hydraulikpumpe, Drehwerk, Unterwagen, Lüfter, Turbo.
*Lauteste Schicht, und die einzige, die nie aufhört.*

**B — Material** (Ereignisse plus Bett)
Aufschläge, Kratzen, Greifen, Quetschen — und darunter ein **Rasselbett**:
ein durchgehendes Geröllgeräusch, dessen Lautstärke der Stoßenergie im Haufen
folgt. Es ist die Antwort auf das Maschinengewehr: Was nicht als einzelner
Schlag durchkommt, verschwindet nicht, sondern geht ins Rasseln. So klingt
eine kippende Fuhre — ein Krach und dann Geröll.

**C — Platz** (dauernd, leise)
Wind, entfernter Verkehr, Halle, Krähen, eine zweite Maschine. Trägt nicht,
darf aber nie ganz verschwinden: Stille wirkt wie ein Fehler.

**D — Betrieb und Bedienung** (Ereignisse)
Waage, Geld, Funk, Hinweise. Eigener Bus, **nicht** von der Dumpfheit des
Platzes betroffen — diese Klänge kommen aus der Kabine, nicht vom Hof.

## 4 Die fünf Regeln

**R1 — Raum.** Jedes Ereignis hat eine Position. Entfernung macht leiser,
dumpfer und halliger; der Zuhörer ist die Kamera. Ohne das bleibt jeder Platz
eine Tonspur.

**R2 — Ereignisbudget statt Sperre.** Heute wird alles verworfen, was nicht
ins Zeitfenster passt. Richtig ist: höchstens drei bis vier *Schläge* je
Sekunde, und alles darüber hinaus erhöht das Rasselbett. Nichts geht
verloren, nichts wird zur Salve.

**R3 — Kein Ton ohne Anriss, kein Anriss ohne Körper.** Ein Metallgeräusch
braucht beides: die harte erste Millisekunde und den Körper darunter. Fehlt
das eine, klingt es nach Spielzeug; fehlt das andere, nach Wasser. Beides ist
gemessen nachprüfbar (Anteil über 700 Hz und über 2 kHz).

**R4 — Nichts klingt zweimal gleich.** Tonhöhe, Dämpfung und Timing streuen
bei jedem Ereignis. Eine Maschine dagegen klingt *immer gleich* — ihre
Unruhe ist fest, nicht zufällig.

**R5 — Innen ist nicht außen.** In der Kabine: Maschine laut, Hof gedämpft
durch Glas. Draußen umgekehrt. Der Umschalter existiert schon im Spiel.

## 5 Reihenfolge

| Schritt | Inhalt | Stand |
|---|---|---|
| 1 | **Diesel aus Zündungen** statt Oszillator | **fertig** |
| 2 | Hydraulik, Drehwerk, Unterwagen als echte Maschinenklänge | offen |
| 3 | Raum: Panner, Entfernungsdämpfung, entfernungsabhängiger Hall | offen |
| 4 | Rasselbett und Ereignisbudget | offen |
| 5 | Vier Busse mit festen Pegeln, Begrenzer statt Kompressor über allem | offen |
| 6 | Kabine gegen Außenansicht | offen |
| 7 | Platzschicht: zweite Maschine, Verkehr, Halle, Druckluft | offen |

Schritt 1 ist gemacht, weil er den größten Anteil an der Spielzeit hat.
Schritt 3 ist der zweitgrößte Hebel: Ohne Raum bleibt es eine Tonspur, egal
wie gut die Einzelklänge sind.

## 6 Schritt 1: der Diesel

Umgesetzt in `audio/diesel.ts` — reine Rechnung, kein WebAudio, in Node
testbar (9 Tests).

Ein Diesel klingt nicht, weil er eine Tonhöhe hat, sondern weil er **schlägt**.
Ein Sechszylinder-Viertakter zündet bei 900/min 45-mal je Sekunde. Gebaut
wird deshalb kein Ton, sondern eine Schleife über einen ganzen Arbeitszyklus
(zwei Umdrehungen), in der jede Zündung einzeln steht:

- **Auspuffstoß** — ein kurzer Druckberg. Seine Tonhöhe steht nirgends im
  Code: Sie entsteht daraus, dass er sich im Zündtakt wiederholt, und steigt
  darum von selbst mit der Drehzahl. Erst als feste Frequenz modelliert, war
  er bei hoher Drehzahl ein Brummen, das den Takt zudeckte — vom Test
  gefunden.
- **Block** — vier Eigenschwingungen zwischen 92 und 420 Hz, kurz abklingend.
- **Nageln** — vier kurze, hohe Resonanzen zwischen 1,1 und 3,9 kHz, plus ein
  Einspritzknack. Eigener Weg, damit es mit der Last eingeblendet werden kann:
  Das ist der Unterschied zwischen Leerlauf und Arbeit.
- **Unruhe** — jeder Zylinder hat eine eigene Stärke und liegt ein paar
  Tausendstel neben dem Raster. Fest, nicht zufällig: Ein Motor bollert immer
  gleich. Ohne das klingt es nach Maschine im Werbefilm.

Dazu Lüfter (Rauschband, folgt der Drehzahl) und Turbolader (steigt mit Last).

Gemessen im fertigen Klangweg:

| | Drehzahl | Schläge je Sekunde | erwartet |
|---|---|---|---|
| Leerlauf | 720/min | **36,0** | 36,0 |
| Halblast | 1184/min | **59,0** | 59,2 |
| Volllast | 1720/min | **86,0** | 86,0 |

Pegel gegen den alten Sägezahn gemessen, damit der Motor den Platz nicht
zudeckt: Leerlauf 0,060 gegen 0,054 Effektivwert, Volllast 0,129 gegen 0,130,
Spanne 6,6 gegen 7,6 dB.

Kosten: Die Schleifen werden einmal beim Start gerechnet. Im Betrieb kostet
der Motor sechs dauerhaft laufende Abspielknoten — unabhängig von der
Drehzahl, statt fünfzig neuer Knoten je Sekunde.

### Was dabei auffiel und in Schritt 5 gehört

Der Kompressor über allem drückt die Spanne des Motors von 7,6 auf 6,6 dB
zusammen: Ein durchgehender Klang gehört nicht auf denselben Kompressor wie
ein Schlag. Deshalb steht in Schritt 5 „Begrenzer statt Kompressor über
allem".
