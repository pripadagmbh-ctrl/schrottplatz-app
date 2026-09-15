# Was Stahlschrott ist — die Regel

**Stand 15.09.2026 · Vorschlag, noch kein Umbau · alle Zahlen aus dem Katalog gerechnet**

Anlass, Patrick am 15.09.2026:

> „Stahlschrott sind selten Verbundmaterialien. Natürlich hast du mal Tanks, wo
> dann noch was dran ist. Aber zum Beispiel ein Elektroherd, das ist vor allem
> Blechschrott. Das ist nicht massiv, es sind einzelne Materialien, es ist ja
> auf Leichtigkeit auch noch gebaut, Kunststoffe sind da dran. … Ich möchte ein
> bisschen strenger werden, was Stahlschrott ist. Das ist halt so das Premium.
> Es geht da eher so um Bahnschwellen, Bremsscheiben, Träger — das ist so
> wirklich ganz gutes Material. Auch bei so Gitterboxen bin ich mir nicht
> sicher, ob das dann wirklich Stahlschrott ist im Premium-Segment."

Entschieden ist: **es bleibt bei zwei Fraktionen.** Eine dritte („Blechschrott")
ist ausdrücklich abgelehnt. Stahlschrott ist das Massive; alles andere geht zu
Mischschrott, auch sortenreines Dünnblech.

Blatt fürs Telefon: `docs/stahlschrott-2026-09-15.svg`, in der Planmappe unter
`/v1/plaene/`. Bestandsaufnahme des heutigen Zustands: `docs/fraktionen.md`.

---

## Die Regel in einem Absatz

> Man nimmt das Gewicht eines Stücks und verteilt es gleichmäßig als Blech über
> seine eigene Außenfläche. Kommt dabei eine Wand von **mindestens 6 Millimetern**
> heraus, ist es **Stahlschrott**. Kommt weniger heraus, ist es dünnes Blech über
> Luft, egal wie schwer das ganze Ding ist — dann ist es **Mischschrott**. Dazu
> eine zweite Bedingung: Höchstens ein Zehntel der Masse darf etwas anderes sein
> als Stahl. Eine Schraube, eine Dichtung, ein Schauglas stören nicht; ein
> Kupferwickel, ein Reifen oder eine Kunststoffverkleidung schon.

Das ist keine neue Erfindung, sondern die Zahl, nach der ein Platz wirklich
abrechnet: In der europäischen Sortenliste trennen **6 mm Wanddicke** den
schweren Altschrott (Sorten E1/E3) vom Blechschrott. Genau diese Grenze meint
Patrick, wenn er Bahnschwellen und Träger gegen einen Elektroherd stellt.

**Die Gegenprobe, dass das Maß trifft:** Ein Elektroherd von 30 kg hat 3,03 m²
Außenfläche — die Rechnung ergibt **1,3 mm**, und so dick ist Herdblech
tatsächlich. Ein Doppel-T-Träger von 180 kg hat 3,40 m² — die Rechnung ergibt
**6,7 mm**, und so dick ist der Steg eines IPE 280 tatsächlich. Die Formel rät
nicht, sie trifft.

---

## Die Merkmale, einzeln

### M-1 · Massiv statt dünnwandig: rechnerische Wandstärke ≥ 6 mm

```
Wandstärke  =  Masse  ÷  (7850 kg/m³ × Außenfläche)
```

**Woher die Zahlen:** 7850 kg/m³ ist die Dichte von Stahl (Physik, keine
Setzung). Die 6 mm sind die Grenze der europäischen Sortenliste zwischen
Schwerschrott und Blechschrott — **Branchenwissen, im Projekt bisher nirgends
belegt**; `docs/02_Briefing.md` Kap. 7 nennt Preise, keine Sortenliste. Im Code
steht sie deshalb mit Vorbehalt: `WAND_AB_MM = 6` in `tools/stahlschrott.ts`.

**Warum nicht die Schüttdichte (kg je m³ Hüllraum), die es seit E-033 gibt?**
Weil sie große Stücke doppelt bestraft. Ein 20-Fuß-Seecontainer und ein
Kühlschrank sind beide Blech über Luft; der Hohlraum wächst aber mit der dritten
Potenz der Größe und das Blech nur mit der zweiten. Nach Hüllwichte liegt der
Container bei 73 kg/m³ und ein Doppel-T-Träger bei 792 — dazwischen liegt aber
auch der Radsatz einer Eisenbahn (516), der massiv ist, und das
Traktor-Frontgewicht (457), das ein Gussklotz ist. Die Wandstärke rechnet den
Größeneffekt heraus: Ein kleiner Klotz und ein großer Klotz werden gleich
einsortiert. Genau das tut ein Schrottplatz auch.

**Was das Merkmal leistet:** Es ist das einzige, das ohne jede neue Eingabe
funktioniert. Masse und Maße stehen an **allen** 308 Katalogeinträgen — die
Stückliste dagegen nur an 58. Damit fällt der Grund weg, aus dem heute ein
*Elektroherd* Stahlschrott und ein *Einbauherd mit Umluftofen* Mischschrott ist
(`docs/fraktionen.md`, 1.1): Beide rechnen sich zu 1,3 bzw. 1,7 mm, beide sind
Mischschrott.

### M-2 · Kein Verbund: höchstens 10 % Fremdstoff

Heute steht die Schwelle bei 5 % (`SORTENREIN_AB = 0.95`, `purity.ts:110`).
Vorschlag: **10 %** — also **weicher**, nicht schärfer.

**Begründung:** „Natürlich hast du mal Tanks, wo dann noch was dran ist." Eine
Regel, die an einer Dichtung scheitert, bildet den Platz falsch ab. Bei 5 %
rutscht ein Baggerlöffel mit Gumminoppen (3 % Fremdes) gerade so durch, ein Tank
mit Schauglas und Dichtungen (8 %) nicht mehr. Bei 10 % bleibt das Stück
Premium, an dem noch etwas dranhängt, und der *Motorblock-Rest* (18 % Alu und
Kupfer) fällt heraus — der ist wirklich Verbund.

Die Regel wird trotzdem strenger, weil M-1 davor greift. Dass die
Verbundschwelle die Sortierung heute **allein** trägt, ist der eigentliche
Fehler: Sie kann es nicht, weil 250 von 308 Einträgen keine Stückliste haben.

**Gemessen: die Lockerung ändert heute gar nichts.** Kein einziger Eintrag hat
einen Leitstoffanteil zwischen 90 % und 95 %. Die 10 % sind eine Regel für
künftige Einträge, keine Umsortierung.

### M-3 · Was ausdrücklich NICHT im Vorschlag steht

Ich habe eine Liste „Bauarten, die nie Premium sind" (weiße Ware, Karosserie,
Möbel, Kabine, Gitterrahmen) gebaut und wieder verworfen. **Sie war überflüssig:**
Jedes einzelne Stück dieser Bauarten fällt schon an M-1 durch — Waschmaschine
2,2 mm, Kleinwagen-Karosserie 3,6 mm, Kühlschrank 1,5 mm, Gitterbox 3,0 mm. Eine
Regel, die man nicht braucht, gehört nicht ins Spiel; jede Handliste veraltet in
dem Moment, in dem jemand einen Eintrag hinzufügt.

Zweiter verworfener Gedanke: `bau` als Verbund-Kennzeichen zu lesen („eine
*Maschine* ist immer eine Baugruppe"). Geht nicht, weil `bau` eine **Zeichenform**
ist und keine Materialaussage: `bau: "motor"` trägt sowohl der Motorblock als
auch das Traktor-Frontgewicht, das ein Gussklotz ohne bewegliches Teil ist.

---

## Was sich ändert — die Zahlen

| Ausschnitt | Einträge | Stahlschrott heute | nach der Regel | wechseln |
|---|---:|---:|---:|---:|
| wie `docs/fraktionen.md` (nur exportierte Listen) | 271 | 139 | **48** | 91 |
| vollständig (mit `BIG_SPECS`, `HUGE_SPECS`) | 308 | 156 | **56** | 100 |

> **Nebenbefund:** Die „271 erreichbaren Einträge" aus `docs/fraktionen.md` sind
> nicht der ganze Katalog. `BIG_SPECS` und `HUGE_SPECS` in `scrapItems.ts:685`
> und `:703` sind **nicht exportiert** — und genau dort stehen Patricks
> Premium-Beispiele (Doppel-T-Träger, Maschinenblock, Schwungrad). Wer nur die
> Exporte liest, misst am Interessantesten vorbei. `tools/stahlschrott.ts` liest
> die beiden Listen deshalb aus dem Quelltext.

**Alle 100 Wechsel gehen in dieselbe Richtung: Stahlschrott → Mischschrott.**
Kein einziger Eintrag wandert in die Gegenrichtung.

### Was Stahlschrott bleibt — alle 56, nach Wandstärke

| mm | Stück | | mm | Stück |
|---:|---|---|---:|---|
| 22,7 | Kettenlaufwerk | | 8,5 | Turbinengehäuse |
| 18,2 | Häcksler-Trommel | | 8,5 | Rohr |
| 17,8 | Vibrationswalze (Bandage) | | 8,5 | CNC-Fräsmaschine |
| 16,5 | Waggon-Drehgestell | | 8,4 | Kachelofen-Einsatz |
| 16,2 | Aufzugs-Gegengewicht | | 8,3 | Güterwaggon-Boden |
| 15,3 | U-Bahn-Drehgestell | | 8,3 | Schul-Heizkesselanlage |
| 13,3 | Eisenbahn-Puffer (Paar) | | 8,2 | Gusseiserner Badeofen |
| 13,1 | Pressenrahmen | | 7,9 | Traktor-Hinterachse |
| 12,5 | Raupenlaufwerk-Ketten (Bund) | | 7,9 | Kreiselegge |
| 12,4 | Maschinenblock | | 7,9 | Prellbock |
| 12,1 | Drehmaschine mit Bett | | 7,7 | Dampfkessel |
| 12,1 | Futtermischwagen-Mischschnecke | | 7,5 | Schrottschere-Abschnitte |
| 11,9 | Radsatz (Eisenbahn) | | 7,5 | Flugzeug-Fahrwerksbein |
| 11,7 | Poller | | 7,5 | Betonmischer-Trommel |
| 11,3 | LKW-Achse | | 7,4 | Sattelauflieger-Chassis |
| 10,8 | Heizkörper (früher Guss) | | 7,4 | Güllefass |
| 10,4 | Stahlquader (namenlos) | | 7,3 | Kesselwagen-Kessel |
| 10,1 | Großgetriebe (Industrie) | | 7,3 | Mähdrescher-Schneidwerk |
| 9,7 | Stahlquader (namenlos) | | 7,2 | Weichenzunge |
| 9,3 | Profilstahl | | 7,1 | Kesselwagen-Segment |
| 9,1 | Metallpaket (gepresst) | | 7,0 | Güllefass-Pumpwerk |
| 9,1 | Presskammerwalzen (Bund) | | 6,9 | Hinterachse mit Differenzial |
| 9,0 | Mähdrescher-Dreschtrommel | | 6,9 | Rolltreppen-Segment |
| 9,0 | Spritzgussmaschine | | 6,9 | Traktor-Vorderachse |
| 8,8 | Rotorkopf | | 6,8 | Schwungrad |
| 8,6 | Förderband-Antriebsstation | | 6,7 | Doppel-T-Träger |
| | | | 6,7 | Schienenbündel |
| | | | 6,3 | Tankstellen-Erdtank |
| | | | 6,2 | Traktor-Frontgewicht |
| | | | 6,2 | Scheibenegge |

Patricks drei Beispiele stehen alle darin: **Träger** (Doppel-T-Träger 6,7 mm,
Profilstahl 9,3 mm), **Bahn** (Schienenbündel 6,7 mm, Radsatz 11,9 mm,
Eisenbahn-Puffer 13,3 mm, Weichenzunge 7,2 mm). **Bremsscheiben gibt es im
Katalog nicht** — dazu unten unter „Was fehlt".

### Was wechselt — die 100, nach Gruppen

**Knapp darunter (5,0 bis 6,0 mm) — die strittigen 23.** Hier entscheidet die
Schwelle, nicht der Augenschein. Wer eine davon anders haben will, muss nur
sagen welche:

Miststreuer-Streuwerk 6,0 · Ballenpresse (Rundballen) 5,9 ·
Parkhaus-Schrankenanlage 5,8 · Häcksler-Auswurfkrümmer 5,8 ·
Palettenregal-Traversen (Bund) 5,8 · Futtermischwagen-Behälter 5,7 · Grubber mit
Zinkenfeld 5,6 · Stahlstützen-Bund 5,6 · LKW-Felge 5,6 · Lagertank 5,5 ·
LKW-Kühler 5,5 · Ruderblatt 5,5 · Betonfertigteil-Wand 5,4 · Maispflücker-Vorsatz
5,3 · Autotransporter-Rampen 5,3 · Exzenterpresse 5,3 · dickes Rohr 5,2 ·
Mähwerk-Scheibenbalken 5,2 · Reachstacker-Spreader 5,1 · Felgenstapel (Stahl) 5,0
· Schiebewand-Waggon-Seitenteil 5,0 · Turmdrehkran-Ausleger 5,0 · LKW-Fahrerhaus
5,0

**Eindeutig Blech (unter 5,0 mm) — die anderen 77.** Die auffälligsten, weil sie
heute Stahlschrott sind und jeder sie für Blech hält:

*Blech* 4,8 · *Blechtafel* 4,5 · *Seecontainer 20 Fuß* 4,6 · *Gitterbox* 3,0 ·
*Gitterbox-Stapel* 4,6 · *Baggerlöffel* 4,7 · *Stahltür/Tor* 4,9 · *Stahlschrank*
4,4 · *Badewanne* 1,3 · *Elektroherd* 1,3 · *Warmwasserspeicher*
2,2 · *Silo-Blechsegment* 2,0 · *Kessel* 3,4 · *Öltank/Boiler* 2,4 ·
*Schuttcontainer (Absetzmulde)* 2,4 · *Kipper-Mulde* 2,7 · *Bootsrumpf (Stahl)*
2,6 · *Motorradrahmen* 0,5 · *Mopedrahmen* 0,4 · *Doppelbett-Gestell* 0,6 ·
*Drahtballen* 1,1 · *Industrie-Rolltor* 2,3 · *Absperrgitter (Bund)* 2,7 ·
*Bauzaun-Felder (Stapel)* 3,3 · *Pflugschar* 4,5 · *Frontlader-Schaufel* 3,6 ·
*Radlader-Schaufel* 4,6 · *LKW-Getriebe* 4,3 · *Hallenkran-Laufkatze* 4,6 ·
*Oberleitungsmast* 4,6 · *Signalmast mit Schirm* 2,8 · *Ankerkette (Haufen)* 4,2 ·
*Stockanker* 4,6

Die vollständige Liste, Zeile für Zeile mit Masse, Maß und Grund:

```
npx vite-node tools/stahlschrott-liste.ts md > /tmp/liste.md
npx vite-node tools/stahlschrott-liste.ts graubereich
```

---

## Die Gitterbox, ausdrücklich beantwortet

> **Mischschrott. Die Zahl ist 3,0 mm.**

Die Gitterbox im Katalog (`objektkatalog.ts`, 120 kg, 1,20 × 0,80 × 0,80 m) hat
**5,12 m² Außenfläche**. 120 kg Stahl darüber verteilt ergeben eine Wand von
**3,0 mm** — die halbe Schwelle. Der *Gitterbox-Stapel* (470 kg, 1,25 × 2,60 ×
0,85 m, 13,06 m²) kommt auf **4,6 mm** und liegt ebenfalls darunter.

Fachlich ist das richtig, und zwar aus genau dem Grund, den Patrick selbst nennt:
Eine Gitterbox ist ein **Rahmen mit Luft dazwischen**. Sie besteht aus dünnem
Draht und kaltgeformtem Blech, nicht aus Vollmaterial; in der Sortenliste läuft
so etwas als leichter Altschrott, nicht als E1/E3. „Mischschrott heißt ja eben,
dass da halt was gemischt ist" — hier ist Stahl mit Luft gemischt, und der Preis
je Kubikmeter Ladefläche ist genau deshalb der von Mischschrott.

---

## Was es an Umschlag und Verdienst verschiebt

**Kurz: fast nichts. Zwischen +1 % und +4 % — nach oben.**

Der Grund ist eine Eigenheit, die man kennen muss: `randomCargo`
(`scrapItems.ts:788-800`) würfelt **zuerst die Fraktion** — 42 % Stahl, 22 %
Misch, 16 % Alu, Rest verteilt — und sucht sich **dann** ein passendes Stück.
Die Umsortierung ändert also nicht, wie oft Stahlschrott kommt. Sie ändert nur,
**welche Stücke** im Stahltopf liegen. Und weil die dünnen herausfallen, sind
die verbliebenen im Mittel schwerer.

Gerechnet mit `tools/stahlschrott-wirkung.ts`, Reinheit 1, Preise aus
`catalog.ts` (Stahl 250 €/t, Misch 160 €/t) und Ankauf 160 €/t
(`account.ts:16`):

| Ladungsliste | ø kg heute | ø € heute | ø kg neu | ø € neu | Verdienst |
|---|---:|---:|---:|---:|---:|
| Kleinteile (`SPECS`) | 95 | 31,18 | 109 | 32,28 | **+4 %** |
| Großteile (`BIG_SPECS` + `KATALOG_BIG`) | 316 | 71,97 | 336 | 72,67 | **+1 %** |
| Schwergewichte (`HUGE_SPECS` + `KATALOG_HUGE`) | 1473 | 239,48 | 1513 | 243,37 | **+2 %** |

Sollte die Fraktionsverteilung der Anlieferungen jemals aus dem Katalog statt aus
dieser festen Tabelle kommen, kehrt sich das um: Dann fiele der Stahlanteil von
73 % auf 26 % der Sorten, und der Verdienst mit ihm. **Wer die Tabelle in
`randomCargo` anfasst, muss diese Rechnung erneut machen.**

### Die beiden Halden am Bagger — nur gemeldet, nicht umgebaut

| | STAHLSCHROTT | MISCHSCHROTT |
|---|---:|---:|
| Sorten heute | 156 | 57 |
| Sorten neu | **56** | **157** |
| Zulauf heute, je 100 Kleinteile | 5093 kg | 2241 kg |
| Zulauf neu, je 100 Kleinteile | **6388 kg** | 2327 kg |

Zwei Befunde:

1. **Die Stahlhalde wird voller, nicht leerer.** Das Verhältnis der Massen
   verschiebt sich von 2,27 : 1 auf **2,75 : 1**, weil die verbliebenen
   Stahlstücke schwerer sind. Beide Halden sind heute baugleich (6,8 × 6,0 m,
   `containers.ts:242` und `:257`). Wenn eine zu klein wird, ist es die
   Stahlhalde. **Empfehlung: erst am Gerät beobachten, dann entscheiden.**
2. **Die Vielfalt im Stahltopf schrumpft stark.** Bei den Kleinteilen bleiben
   von 63 Stahlsorten noch **19**. Wer eine sortenreine Stahlfuhre bestellt,
   sieht dieselben neunzehn Stücke immer wieder. Das ist kein Fehler der Regel,
   sondern ein Hinweis: Dem Katalog fehlen kleine massive Stahlteile — Achsen,
   Wellen, Zahnkränze, Bremsscheiben, Kettenglieder, Schwellenplatten.

---

## Erkennbarkeit: woran man die Fraktion sehen soll

Patrick: „Das muss schon irgendwie ersichtlich werden." Gemessen wurde am
15.09.2026 (`docs/fraktionen.md`, 2.3): Elektroherd gegen Waschmaschine
**ΔE 0,18**, Seecontainer gegen Baustellencontainer **ΔE 0,00** — und zwei Teile
derselben Mulde bis **29,8** auseinander. Die Farbe trägt heute die gegenteilige
Information.

**Der größte Gewinn dieser Regel ist, dass sie überhaupt sichtbar ist.** Die
heutige Regel ist per Bauart unsichtbar: Ob eine Stückliste eingetragen wurde,
sieht man einem Stück nicht an. Die neue Regel dagegen ist eine Aussage über
**Form und Gewicht** — und beides ist im Bild. Ein Klotz sieht aus wie ein Klotz.

Deshalb der Vorschlag, in dieser Reihenfolge:

1. **Erster Kanal: die Form selbst.** Nichts bauen — nur nicht mehr dagegen
   arbeiten. Die beiden Paare, die heute identisch aussehen und in verschiedene
   Mulden gehören (Seecontainer/Baustellencontainer, Elektroherd/Waschmaschine),
   **landen nach der Regel in derselben Mulde**. Der Widerspruch löst sich von
   allein auf. Das ist der eigentliche Grund, diese Regel zu nehmen.
2. **Zweiter Kanal: die Zahl im Griff-Info-HUD.** Wenn die Spinne ein Stück
   hält, steht dort heute Name, Masse und €-Indikator (Briefing Kap. 14).
   Vorschlag: eine Zeile mehr — `6,7 mm · massiv → STAHLSCHROTT` bzw.
   `3,0 mm · Blech → MISCHSCHROTT`. Eine Zahl lehrt die Regel, eine Farbe nie.
   Nach drei Fuhren weiß der Spieler, wonach er greift. *(Paket `ui`, klein.)*
3. **Dritter Kanal: der Sortierblick** (V-3a aus `docs/fraktionen.md`) — eine
   zuschaltbare Ansicht, in der alle losen Teile in Fraktionsfarbe leuchten.
   Ein Materialtausch, kein Eingriff in die Geometrie. Das schont die
   Entscheidung „Farbe nach Zweck" vom 12.09.2026 vollständig, weil sie im
   Normalbild weiter gilt.
4. **Vierter Kanal: die beiden Halden auseinanderhalten** (V-4 aus
   `docs/fraktionen.md`). Heute trägt das Schild alles — und wird unter 4,5 m
   Kameraabstand ausgeblendet, also genau dann, wenn man davorsteht. Gepinselte
   Großbuchstaben auf der Trennsteinmauer, auf Augenhöhe der abgesenkten Kabine.

**Was ich nicht vorschlage:** Farbe als einzigen Kanal (Briefing Kap. 20 verbietet
es), Bodeneinfärbung (Patrick hat sie am 12.09.2026 abgelehnt), und eine
Umfärbung der Teile nach Fraktion (widerspricht „Farbe nach Zweck", `objektbau.ts:22`).

---

## Was die Regel NICHT entscheiden kann

Hier fehlt dem Katalog eine Angabe. Ich habe keine Werte erfunden.

### L-1 · Die Wandstärke ist gerechnet, nicht gemessen

Die Formel erbt jeden Fehler in Masse und Maß. Wo eine Masse aus Spielgründen
kleiner gesetzt wurde, als das Stück in Wirklichkeit wiegt, rutscht es unter die
Schwelle. Betroffen und von Hand zu prüfen:

* **Baggerlöffel 4,7 mm.** Ein echter Löffel ist 15 bis 20 mm Verschleißblech.
  Der Katalogeintrag ist zu leicht.
* **LKW-Felge 5,6 mm.** Eine Stahlfelge vom Lkw wiegt real 40 bis 60 kg und ist
  gutes Material. Hier ist es knapp.
* **Schwungrad 6,8 mm.** Kommt gerade so durch — ein echtes Schwungrad wäre
  Vollmaterial und läge bei 100 mm. Der Eintrag wiegt 300 kg, wo 8000 stünden.
* **„dickes Rohr" 5,2 mm.** Der Name sagt dick, die Zahl sagt Blech.

**Kleinstmögliche Ergänzung:** ein einzelnes optionales Feld an `PileSpec` —
`massiv?: boolean` — als Übersteuerung, gesetzt nur dort, wo Rechnung und
Augenschein auseinandergehen. Das sind heute **rund zehn Einträge**, nicht 271.
Wer es setzt, schreibt eine Begründung daneben; wer es nicht setzt, bekommt die
Rechnung. Ein Feld `wandstaerkeMm` für alle 308 Einträge wäre dagegen 308 neue
erfundene Zahlen — davon rate ich ab.

### L-2 · Bündel und Stapel: die Regel misst das Bündel, nicht das Stück

Ein Bund Schienen ist in Wirklichkeit E1, auch wenn zwischen den Schienen Luft
ist. Die Regel sieht nur die Hülle. Betroffen: *Palettenregal-Traversen (Bund)*
5,8 · *Stahlstützen-Bund* 5,6 · *Felgenstapel* 5,0 · *Absperrgitter (Bund)* 2,7 ·
*Bauzaun-Felder (Stapel)* 3,3.

Bei den Regalteilen ist das Ergebnis **zufällig richtig** (Regaltraversen und
-stützen sind kaltgeformtes 2-mm-Blech, also tatsächlich Blechschrott), beim
Schienenbündel geht es gerade noch gut (6,7 mm). Verlassen kann man sich darauf
nicht. Fehlende Angabe: **wie viele Stücke im Bund liegen.** Vorschlag, falls es
je gebraucht wird: `stueckzahl?: number`; die Regel würde dann die Hülle durch
die Stückzahl teilen. **Empfehlung: vorerst nicht bauen** — die fünf Fälle von
Hand über `massiv?` zu klären ist billiger.

### L-3 · Guss ist im Spiel kein eigener Stoff mehr

Bremsscheiben, Motorblöcke, Heizkörper, Badeöfen sind **Guss**, und Guss ist auf
einem echten Platz eine eigene, gut bezahlte Sorte. `catalog.ts:72` bildet
`cast` seit jeher auf `steel` ab. Die Regel kann Guss von Stahl nicht
unterscheiden und muss es nicht — solange es bei zwei Fraktionen bleibt. Nur:
Sollte je eine Sorte „Guss" dazukommen, ist das eine Fraktionsentscheidung, keine
Regelfrage.

### L-4 · Patricks eigene Beispiele fehlen im Katalog

* **Bremsscheibe** — gibt es nicht. Das Musterstück für „Premium" ist nicht
  spielbar.
* **Bahnschwelle aus Stahl** — es gibt nur *Bahnschwellen (Betonstapel)* und
  *Bahnschwellen (Holzstapel)*, beide in anderen Fraktionen.

**Kleinstmögliche Ergänzung:** zwei bis vier Datensätze im Katalog, keine Zeile
Code (Regel 3 des Rollenauftrags: „ein neues Fahrzeug ist ein neuer Datensatz").
Zusammen mit dem Befund aus dem Halden-Abschnitt (19 kleine Stahlsorten
verbleiben) wäre eine kleine Serie massiver Kleinteile das sinnvollste
Folgepaket.

### L-5 · Maschinen ohne Stückliste rutschen als Premium durch

*Spritzgussmaschine* 9,0 · *CNC-Fräsmaschine* 8,5 · *Drehmaschine mit Bett* 12,1
· *Förderband-Antriebsstation* 8,6 · *Schul-Heizkesselanlage* 8,3. Das sind
Baugruppen mit Motor, Kabel und Hydraulik; nach Wandstärke sind sie Klötze, weil
das Gussbett schwer ist. Fachlich ist das vertretbar (ein Maschinenbett **ist**
gutes Material), sauber wäre es mit einer Stückliste an diesen fünf Einträgen.
**Empfehlung: Stückliste eintragen, nicht die Regel verbiegen.**

---

## Die Werkzeuge

| Datei | Was sie tut |
|---|---|
| `tools/stahlschrott.ts` | Die Regel als reine Funktion, plus der vollständige Katalog (auch die nicht exportierten Listen). |
| `tools/stahlschrott-liste.ts` | Die Einsortierung. `alle` = jede Zeile, `md` = Markdown-Tabelle, `graubereich` = was von Hand zu prüfen ist, `271` = Vergleich mit `docs/fraktionen.md`. |
| `tools/stahlschrott-wirkung.ts` | Was es an Umschlag und Verdienst verschiebt. |
| `tools/stahlschrott-blatt.ts` | Das Blatt fürs Telefon. Schreiben mit `tools/stahlschrott-blatt-schreiben.ts`. |
| `test/stahlschrott.test.ts` | 15 Wächter: die Formel, Patricks Beispiele, die Gitterbox, die beiden aufgelösten Widersprüche. |

Der Umbau später muss die Einsortierung nicht abschreiben — er ruft
`urteile(spec)` auf. Wenn die Regel nach `src/materials/` zieht, geht der
Katalog-Leser aus `tools/stahlschrott.ts` nicht mit: Der liest den Quelltext und
gehört ins Werkzeug, nicht ins Spiel.

---

## Empfehlung fürs nächste Paket

1. `WAND_AB_MM`, `VERBUND_BIS` und `wandstaerkeMm` nach `src/materials/purity.ts`
   holen, `fraktionAus` um die Maßangaben erweitern. Die Wächter aus
   `test/stahlschrott.test.ts` ziehen mit.
2. Die zehn Einträge aus L-1 mit `massiv?` versehen — mit Begründung je Zeile.
3. Die fünf Maschinen aus L-5 mit Stückliste versehen.
4. Erst danach an die Erkennbarkeit (die HUD-Zeile aus Vorschlag 2).

**Nicht** im selben Paket: die Halden umbauen. Erst am Gerät sehen, ob die
Stahlhalde wirklich überläuft.
