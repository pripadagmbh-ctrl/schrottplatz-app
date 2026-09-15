# Was Stahlschrott ist — die Regel

**Stand 15.09.2026 · gebaut (E-042) · alle Zahlen aus dem Katalog gerechnet**

Anlass, Patrick am 15.09.2026:

> „Stahlschrott sind selten Verbundmaterialien. Natürlich hast du mal Tanks, wo
> dann noch was dran ist. Aber zum Beispiel ein Elektroherd, das ist vor allem
> Blechschrott. Das ist nicht massiv, es sind einzelne Materialien, es ist ja
> auf Leichtigkeit auch noch gebaut, Kunststoffe sind da dran. … Ich möchte ein
> bisschen strenger werden, was Stahlschrott ist. Das ist halt so das Premium.
> Es geht da eher so um Bahnschwellen, Bremsscheiben, Träger — das ist so
> wirklich ganz gutes Material. Auch bei so Gitterboxen bin ich mir nicht
> sicher, ob das dann wirklich Stahlschrott ist im Premium-Segment."

Und nach dem Blick aufs erste Blatt:

> „LKW-Felge, sind gehärteter Stahl und daher auf massiv setzen. Dicke
> Übersee-Container haben auch viel Masse, auch wenn es dünnes Blech ist. Drum
> Stahl."

Entschieden: **es bleibt bei zwei Fraktionen.** Eine dritte („Blechschrott")
ist abgelehnt. Stahlschrott ist das Massive; alles andere geht zu Mischschrott,
auch sortenreines Dünnblech.

Blatt fürs Telefon: `docs/stahlschrott-2026-09-15.svg`, in der Planmappe unter
`/v1/plaene/`. Bestandsaufnahme des Zustands davor: `docs/fraktionen.md`.

---

## Die Regel in einem Absatz

> Man nimmt das Gewicht eines Stücks und verteilt es gleichmäßig als Blech über
> seine eigene Außenfläche. Kommt dabei eine Wand von **mindestens 6 Millimetern**
> heraus, ist es **Stahlschrott**. Kommt weniger heraus, ist es dünnes Blech über
> Luft, egal wie schwer das ganze Ding ist — dann ist es **Mischschrott**. Dazu
> eine zweite Bedingung: Höchstens ein Zehntel der Masse darf etwas anderes sein
> als Stahl. Eine Schraube, eine Dichtung, ein Schauglas stören nicht; ein
> Kupferwickel, ein Reifen oder eine Kunststoffverkleidung schon.

Das ist keine Erfindung, sondern die Zahl, nach der ein Platz wirklich
abrechnet: In der europäischen Sortenliste trennen **6 mm Wanddicke** den
schweren Altschrott (E1/E3) vom Blechschrott.

**Die Gegenprobe, dass das Maß trifft:** Ein Elektroherd von 30 kg hat 3,03 m²
Außenfläche — die Rechnung ergibt **1,3 mm**, und so dick ist Herdblech
tatsächlich. Ein Doppel-T-Träger von 180 kg hat 3,40 m² — die Rechnung ergibt
**6,7 mm**, und so dick ist der Steg eines IPE 280 tatsächlich.

Wo sie steht: `src/materials/purity.ts` (`wandstaerkeMm`, `WAND_AB_MM`,
`VERBUND_BIS`, `fraktionVonTeil`). Angewendet beim Laden in
`world/scrapItems.ts` und `world/objektkatalog.ts`.

---

## Die Merkmale, einzeln

### M-1 · Massiv statt dünnwandig: Wandstärke ≥ 6 mm

```
Wandstärke  =  Masse  ÷  (7850 kg/m³ × Außenfläche)
```

**Woher die Zahlen:** 7850 kg/m³ ist die Dichte von Stahl (Physik). Die 6 mm
sind die Grenze der europäischen Sortenliste zwischen Schwerschrott und
Blechschrott — **Branchenwissen, im Projekt sonst nirgends belegt**;
`docs/02_Briefing.md` Kap. 7 nennt Preise, keine Sortenliste. Im Code steht
sie mit diesem Vorbehalt.

**Warum nicht die Schüttdichte (kg je m³ Hüllraum) aus E-033?** Weil sie große
Stücke doppelt bestraft: Der Hohlraum wächst mit der dritten Potenz der Größe,
das Blech nur mit der zweiten. Nach Hüllwichte liegt ein Seecontainer bei
73 kg/m³ und ein Doppel-T-Träger bei 792 — dazwischen aber auch der Radsatz
einer Eisenbahn (516), der massiv ist. Die Wandstärke rechnet den Größeneffekt
heraus.

**Was das Merkmal leistet:** Es braucht keine neue Eingabe. Masse und Maß
stehen an **allen 317** Katalogeinträgen, eine Stückliste nur an 56. Damit
fällt der Grund weg, aus dem ein *Elektroherd* Stahlschrott und ein
*Einbauherd mit Umluftofen* Mischschrott war (`docs/fraktionen.md`, 1.1):
1,3 und 1,7 mm, beide Mischschrott.

### M-2 · Kein Verbund: höchstens 10 % Fremdstoff

Vorher 5 % (`SORTENREIN_AB`, gilt weiter für Presspakete und für alle
Nicht-Stahl-Fraktionen). Jetzt **10 %** für Stahl — also **weicher**.

„Natürlich hast du mal Tanks, wo dann noch was dran ist." Eine Regel, die an
einer Dichtung scheitert, bildet den Platz falsch ab. Die Regel wird trotzdem
strenger, weil M-1 davor greift; dass die Verbundschwelle die Sortierung vorher
**allein** trug, war der eigentliche Fehler — 250 von 317 Einträgen haben keine
Stückliste.

**Gemessen: die Lockerung allein ändert nichts.** Kein Eintrag hat einen
Leitstoffanteil zwischen 90 % und 95 %.

### M-3 · Die Massenschwelle — geprüft und verworfen

Patricks Begründung für den Seecontainer war **nicht** „der ist dicker",
sondern „viel Masse, obwohl dünnes Blech". Das ist eine andere Aussage, und die
Frage war, ob daraus ein zweites Merkmal wird. **Antwort: nein.** Gerechnet
(`npx vite-node tools/stahlschrott-liste.ts brocken`):

| Rang | dünnwandig, stahlgeführt, kein Verbund | kg | Wand |
|---:|---|---:|---:|
| 1 | **Seecontainer 20 Fuß** | **2200** | 4,6 mm |
| 2 | Ballenpresse (Rundballen) | 1900 | 5,9 mm |
| 3 | Futtermischwagen-Behälter | 1700 | 5,7 mm |
| 4 | Lagertank | 1400 | 5,5 mm |
| 5 | Turmdrehkran-Ausleger | 1200 | 5,0 mm |

Der Seecontainer ist **das schwerste dünnwandige Stück ohne Verbund im ganzen
Katalog**. Jede Schwelle zwischen 1901 und 2200 kg nimmt genau ein Stück mit:
das, für das sie gemacht wurde. Das ist keine Regel, das ist eine Ausnahme mit
einer Zahl davor.

Und wer tiefer geht, zahlt drauf: Um den *Lagertank* mitzunehmen (1400 kg, ein
nackter Stahlbehälter — vertretbar), muss man vorher die *Ballenpresse* (voller
Gummibänder und Ketten) und den *Futtermischwagen-Behälter* (dünnes Trogblech)
hereinlassen. **Zwei falsche für einen richtigen.**

Drei weitere Gründe, warum die Masse als Merkmal nicht taugt:

1. **Sie ist nicht maßstabsfrei.** Verdoppelt man einen Container in jeder
   Kante, verachtfacht sich die Masse, die Wand bleibt gleich. Ein 40-Fuß-
   Container wäre Premium, ein 10-Fuß-Container nicht — derselbe Gegenstand,
   zwei Mulden. Genau diese Willkür sollte E-042 beseitigen.
2. **Sie kann Brocken nicht von Stapeln unterscheiden.** Ein Stapel Blechtafeln
   hat auch viel Masse. Dafür bräuchte der Katalog eine Stückzahl, die er nicht
   hat.
3. **Der Katalog kann sie heute gar nicht tragen.** Bei 250 Einträgen ohne
   Stückliste ist „schwerer nackter Stahlkörper" von „schwere Maschine" nicht
   zu trennen.

**Also: Übersteuerung statt Regel** — offen, gezählt und begründet (unten).
Ein Wächter hält den Befund fest (`test/stahlschrott.test.ts`): Kommt je ein
schwereres dünnwandiges Stück dazu, wird er rot, und dann gehört die Frage neu
gestellt.

### M-4 · Was NICHT in der Regel steht

Eine Handliste „Bauarten, die nie Premium sind" (weiße Ware, Karosserie, Möbel,
Gitterrahmen) war gebaut und wurde verworfen: **überflüssig**, weil jedes Stück
dieser Bauarten schon an M-1 durchfällt — Waschmaschine 2,2 mm,
Kleinwagen-Karosserie 3,6 mm, Kühlschrank 1,5 mm, Gitterbox 3,0 mm. Ebenso
verworfen: `bau` als Verbundkennzeichen. `bau` ist eine **Zeichenform**, keine
Materialaussage — `bau: "motor"` trägt der Motorblock genauso wie das
Traktor-Frontgewicht, ein Gussklotz ohne bewegliches Teil.

---

## Die acht Übersteuerungen, einzeln

`massiv?: boolean` an `PileSpec`. Jede Setzung steht mit ihrer Begründung in
derselben Zeile im Katalog. **Das ist der Ort für Produktwissen — nicht für
Bequemlichkeit.** Ein Wächter hält die Zahl unter einem Zwanzigstel des
Katalogs.

| Stück | gerechnet | warum trotzdem massiv |
|---|---:|---|
| **LKW-Felge** | 5,6 mm | Patrick wörtlich: „gehärteter Stahl". Eine Stahlfelge vom Lkw ist 10–14 mm Scheibe. |
| **Felgenstapel (Stahl)** | 5,0 mm | Dieselben Felgen, gestapelt. Wäre die eine Premium und der Stapel nicht, wäre die Regel Geschmackssache. |
| **Seecontainer 20 Fuß** | 4,6 mm | Patrick wörtlich: „viel Masse, auch wenn es dünnes Blech ist". 2,2 t nackter Stahlkörper ohne Innenausbau, geht ungeschnitten in die Schere. Siehe M-3. |
| **Baggerlöffel** | 4,7 mm | Verschleißblech 15–20 mm; die Katalogmasse (205 kg) ist zu klein für einen Löffel dieser Größe. |
| **Radlader-Schaufel** | 4,6 mm | Dieselbe Bauweise, größer. |
| **Frontlader-Schaufel** | 3,6 mm | Dieselbe Bauweise, kleiner. Die am weitesten von der Schwelle entfernte Setzung — hier bitte ausdrücklich hinsehen. |
| **Pflugschar** | 4,5 mm | Die Schar ist gehärtetes Verschleißblech, sonst wäre sie nach einem Acker rund. |
| **dickes Rohr** | 5,2 mm | Der Name sagt dick; die Wand eines 440-mm-Rohres ist 8–12 mm. Entweder die Übersteuerung oder eine größere Masse im Katalog. |

**Zum Streichen, falls Patrick sie nicht will:** Frontlader-Schaufel (am
weitesten entfernt), dickes Rohr (wäre auch über die Masse zu heilen).

---

## Neun neue Stücke — Patricks Beispiele gab es nicht

Von seinen drei Premium-Beispielen war nur **Träger** im Katalog.
**Bremsscheiben** fehlten ganz, **Bahnschwellen** gab es nur aus Beton und Holz.
Dazu der Befund: Nach der Regel wären im Stahltopf der Kleinteile nur 19 Sorten
geblieben, und jede sortenreine Stahlfuhre hätte dieselben Stücke gezeigt.

| Stück | kg | Wand | woher die Zahl |
|---|---:|---:|---|
| Bremsscheibe (LKW) | 38 | 10,7 mm | 430 mm Durchmesser, belüftet |
| Bremsscheiben (Palette) | 400 | 10,5 mm | rund zehn davon |
| Bahnschwelle (Stahl, Y-Form) | 105 | 6,2 mm | Y-Stahlschwelle, 2,2 m |
| Schienenabschnitt | 60 | 10,8 mm | Schiene S49, 49,4 kg/m, 1,2 m |
| Kurbelwelle (LKW) | 90 | 14,0 mm | Sechszylinder, geschmiedet |
| Großzahnrad | 85 | 15,4 mm | 560 mm Durchmesser, mit Nabe |
| Amboss | 120 | 21,8 mm | Schmiedeamboss |
| Stapler-Gegengewicht | 450 | 30,5 mm | Gussblock |
| Grobblech-Zuschnitt (20 mm) | 150 | 8,8 mm | 7850 × 0,02 × 0,96 m³ = 151 kg |

Das **Grobblech** ist mit Absicht dabei: gleiche Bauform (`platte`) und fast
gleiches Maß wie das *Blech* (55 kg, 4,8 mm, Mischschrott) — nur dreimal so
schwer, und deshalb in der anderen Mulde. Daran kann ein Spieler die Regel
lernen, ohne dass sie ihm jemand erklärt.

> **Rapier-Lehre am Rande.** Bremsscheibe und Großzahnrad standen zuerst mit
> ihrem echten Reibring- bzw. Zahnbreitenmaß da (0,045 und 0,09 m). Der
> Katapult-Wächter des Kippers ging sofort auf **146 km/h** (Schranke 140):
> So dünne Achtkant-Kollider verhaken sich in der Ladung und werden
> herausgeschossen. Mit dem Hüllmaß **0,12 m** — Topf und Nabe mitgerechnet,
> und gleich `DUENN_M` aus `purity.ts` — war der Wert wieder in der Schranke.
> **Runde Teile nicht dünner als 0,12 m.**

---

## Was sich geändert hat — die Zahlen

| Ausschnitt | Einträge | Stahlschrott vorher | jetzt | wechseln |
|---|---:|---:|---:|---:|
| wie `docs/fraktionen.md` (exportierte Listen) | 280 | 148 | **64** | 84 |
| vollständig (mit `BIG_SPECS`, `HUGE_SPECS`) | 317 | 165 | **73** | 92 |

Aufgeschlüsselt: 65 Stücke holt die Regel über die Wandstärke, 8 kommen über
die Übersteuerung; 92 fallen als dünnwandig heraus, 44 als Verbund, 108 sind
gar kein Stahl. **Alle 92 Wechsel gehen Richtung Mischschrott** — kein Eintrag
wandert in die Gegenrichtung.

In Masse: **85,5 t → 54,5 t** Stahlschrott über den ganzen Katalog.

> **Nebenbefund:** Die „271 erreichbaren Einträge" aus `docs/fraktionen.md`
> waren nicht der ganze Katalog. `BIG_SPECS` und `HUGE_SPECS` in
> `scrapItems.ts` sind **nicht exportiert** — und dort stehen Patricks
> Premium-Beispiele (Doppel-T-Träger, Maschinenblock, Schwungrad).
> `tools/stahlschrott.ts` liest deshalb alle sechs Listen aus dem Quelltext.

### Die auffälligsten Wechsel

*Blech* 4,8 · *Blechtafel* 4,5 · *Gitterbox* 3,0 · *Gitterbox-Stapel* 4,6 ·
*Stahltür/Tor* 4,9 · *Stahlschrank* 4,4 · *Badewanne* 1,3 · *Elektroherd* 1,3 ·
*Warmwasserspeicher* 2,2 · *Kessel* 3,4 · *Öltank/Boiler* 2,4 ·
*Schuttcontainer (Absetzmulde)* 2,4 · *Kipper-Mulde* 2,7 · *Silo-Blechsegment*
2,0 · *Motorradrahmen* 0,5 · *Mopedrahmen* 0,4 · *Doppelbett-Gestell* 0,6 ·
*Drahtballen* 1,1 · *Industrie-Rolltor* 2,3 · *Palettenregal-Traversen (Bund)*
5,8 · *Stahlstützen-Bund* 5,6 · *Lagertank* 5,5 · *LKW-Kühler* 5,5 ·
*Oberleitungsmast* 4,6 · *LKW-Getriebe* 4,3 · *Hallenkran-Laufkatze* 4,6.

Vollständig:

```
npx vite-node tools/stahlschrott-liste.ts md          # jede Zeile als Tabelle
npx vite-node tools/stahlschrott-liste.ts graubereich # was von Hand zu prüfen ist
npx vite-node tools/stahlschrott-liste.ts brocken     # die Massenschwelle-Frage
```

---

## Die Gitterbox, ausdrücklich beantwortet

> **Mischschrott. Die Zahl ist 3,0 mm.**

120 kg auf **5,12 m² Außenfläche** — die halbe Schwelle. Der *Gitterbox-Stapel*
(470 kg, 13,04 m²) kommt auf **4,6 mm** und liegt ebenfalls darunter.

Fachlich richtig, und zwar aus genau Patricks Grund: Eine Gitterbox ist ein
**Rahmen mit Luft dazwischen**, dünner Draht und kaltgeformtes Blech. „Misch-
schrott heißt ja eben, dass da halt was gemischt ist" — hier ist Stahl mit Luft
gemischt.

---

## Was es an Umschlag und Verdienst verschiebt

**Kurz: zwischen −0 % und +2 %.** Der Grund: `randomCargo`
(`scrapItems.ts:788-800`) würfelt **zuerst die Fraktion** — 42 % Stahl, 22 %
Misch, 16 % Alu, Rest verteilt — und sucht **dann** ein passendes Stück. Die
Umsortierung ändert nicht, wie oft Stahlschrott kommt, sondern nur, welche
Stücke im Stahltopf liegen.

Gerechnet mit `tools/stahlschrott-wirkung.ts`, Reinheit 1, Preise aus
`catalog.ts` (Stahl 250 €/t, Misch 160 €/t), Ankauf 160 €/t (`account.ts:16`):

| Ladungsliste | ø kg vorher | ø € vorher | ø kg jetzt | ø € jetzt | Verdienst |
|---|---:|---:|---:|---:|---:|
| Kleinteile (`SPECS`) | 94 | 31,05 | 101 | 31,57 | **+2 %** |
| Großteile (`BIG_SPECS`) | 317 | 71,99 | 328 | 71,81 | **−0 %** |
| Schwergewichte (`HUGE_SPECS`) | 1473 | 239,48 | 1516 | 244,53 | **+2 %** |

**Wer die Mischtabelle in `randomCargo` anfasst, muss diese Rechnung erneut
machen.** Käme die Verteilung aus dem Katalog statt aus der festen Tabelle,
fiele der Stahlanteil von 74 % auf 33 % der Sorten — und der Verdienst mit ihm.

### Die beiden Halden am Bagger — gemeldet, nicht umgebaut

| | STAHLSCHROTT | MISCHSCHROTT |
|---|---:|---:|
| Sorten vorher | 165 | 57 |
| Sorten jetzt | **73** | **149** |
| Zulauf vorher, je 100 Kleinteile | 4973 kg | 2241 kg |
| Zulauf jetzt, je 100 Kleinteile | **5606 kg** | 2312 kg |

**Die Stahlhalde wird voller, nicht leerer**: 2,22 : 1 → **2,42 : 1**, weil die
verbliebenen Stahlstücke schwerer sind. Beide Halden sind baugleich (6,8 × 6,0 m,
`containers.ts:242`/`:257`). Wenn eine zu klein wird, ist es die Stahlhalde.
**Empfehlung: erst am Gerät beobachten.**

### Was der Spieler sonst merkt

* **Weniger, größere Stücke je Fuhre.** Die Ladefläche ist volumenbegrenzt
  (`vehicles.ts`, `packeLadung`); der Stahltopf besteht jetzt aus den massiven
  Brocken. Gemessen am Bezugsfall des Kipper-Wächters: **9 → 8 Stücke**.
  Nebenwirkung: ein Physikkörper weniger je Fuhre.
* **Kleinteil-Vielfalt im Stahl:** 70 → **30** Sorten (ohne die neun neuen
  Stücke wären es 21 gewesen).

---

## Aluminium ist grau geworden

Patrick am selben Tag: „Aluminium ist in den meisten Fällen grau."

**Zuerst die Gegenfrage: Sieht er die Fraktionsfarbe überhaupt?** Gemessen mit
`tools/alufarbe.ts`: Von 30 Alu-Einträgen tragen **drei** die Fraktionsfarbe —
Felge (12 kg), Profil (8 kg) und ein namenloser Zylinder (11 kg). Die anderen
27 werden in `objektbau.ts` nach Zweck gefärbt, und die flächigsten davon (drei
`fensterflaeche` — Duschkabine, Wohnwagen-Wandelement) trugen exakt
`ALU = 0xa8adb2`.

**Also beides geändert**, auf denselben Ton `0x928d85` — mattes, warmes
Mittelgrau statt hellem Blauweiß:

| Paar | vorher | jetzt | Mittag | Abend | Flutlicht | warum es zählt |
|---|---:|---:|---:|---:|---:|---|
| alu ↔ **va** | **6,98** | **24,63** | 23,65 | 17,53 | 23,73 | verschiedene Silos (ALU-/VA-LAGER) |
| alu ↔ zinc | 10,23 | 12,25 | 11,11 | 4,93 | 10,32 | teilen sich jeden Behälter |
| alu ↔ mixed | 37,90 | 20,25 | 19,29 | 9,74 | 15,30 | bleibt klar getrennt |
| alu ↔ steel | 37,88 | 20,44 | 19,38 | 8,40 | 15,76 | bleibt klar getrennt |
| zinc ↔ va | 16,57 | 16,57 | 16,93 | 14,50 | 16,87 | unverändert |

Die **6,98** waren der eigentliche Fehler: Unter ΔE 10 ist es dieselbe Farbe,
und bei Abendsonne lagen Alu und Edelstahl bei **6,54**. Dass Alu dafür näher
an Zink rückt (bei Abendsonne 4,93), kostet nichts: ALU-LAGER nimmt Zink mit,
die beiden müssen nie getrennt werden. **Diese Reihenfolge ist kein
Kompromiss, sondern die richtige Priorität.**

`CHROM = 0xc2c7cb` bleibt hell — Verchromtes ist hell, das war nie der Befund.

> **Messfehler, der dabei auffiel:** Die erste Messung gab für jedes gebaute
> Teil fast Schwarz (`#1d1510` statt `#a8adb2`). Grund: `THREE.Color.set(hex)`
> rechnet seit three r152 nach Linear-sRGB um; wer die Vertexfarbe ohne
> Rückrechnung als Byte liest, misst das Quadrat. Steht jetzt als Warnung in
> `tools/alufarbe.ts`.

---

## Erkennbarkeit: woran man die Fraktion sehen soll

Gemessen am 15.09.2026 (`docs/fraktionen.md`, 2.3): Elektroherd gegen
Waschmaschine **ΔE 0,18**, Seecontainer gegen Baustellencontainer **ΔE 0,00** —
und zwei Teile derselben Mulde bis **29,8** auseinander.

**Der größte Gewinn dieser Regel ist, dass sie sichtbar ist.** Die alte Regel
war per Bauart unsichtbar: Ob eine Stückliste eingetragen wurde, sieht man
einem Stück nicht an. Die neue ist eine Aussage über **Form und Gewicht**, und
beides ist im Bild.

1. **Erster Kanal: die Form selbst.** Elektroherd und Waschmaschine (ΔE 0,18)
   liegen jetzt in **derselben** Mulde. Nichts zu bauen — der Widerspruch löst
   sich auf.
2. **Zweiter Kanal: die Zahl im Griff-Info-HUD.** `6,7 mm · massiv →
   STAHLSCHROTT` bzw. `3,0 mm · Blech → MISCHSCHROTT`. Eine Zahl lehrt die
   Regel, eine Farbe nie. *(Paket `ui`, klein. Empfehlung als nächstes.)*
3. **Dritter Kanal: der Sortierblick** (V-3a aus `docs/fraktionen.md`).
4. **Vierter Kanal: die beiden Halden** (V-4) — gepinselte Großbuchstaben auf
   der Trennsteinmauer, weil das Schild unter 4,5 m Kameraabstand ausgeblendet
   wird.

### Eine Verschlechterung, die dabei entsteht — offen gemeldet

**Seecontainer (jetzt Stahlschrott) und Baustellencontainer (Mischschrott)
haben ΔE 0,00.** Beide sind `[2,4 × 2,6 × 4,8]`, also gleicher Maß-Hashwert,
also gleicher Lackton (`objektbau.ts:188`) — und sie gehen ab jetzt in
verschiedene Mulden. Vorher taten sie das auch, aber mit vertauschten Rollen.

Der kleinste Weg dahin: den **Baustellencontainer auf 3 m kürzen** (`[2,4, 2,6,
3,0]`, rund 1200 kg). Das ist die zweite gängige Baugröße, es ändert den Hash
und damit die Farbe, und an der Fraktion ändert es nichts (3,6 mm, weiterhin
Verbund). **Gestalterische Entscheidung — nicht ohne Patrick gemacht.**

---

## Was die Regel NICHT entscheiden kann

### L-1 · Die Wandstärke ist gerechnet, nicht gemessen

Sie erbt jeden Fehler in Masse und Maß. Acht Fälle sind mit `massiv`
übersteuert (oben). Weitere Kandidaten, heute **nicht** gesetzt:

* **Schwungrad 6,8 mm** — kommt gerade so durch; ein echtes Schwungrad wäre
  Vollmaterial und läge bei 100 mm. Der Eintrag wiegt 300 kg, wo 8000 stünden.
* **Stahltür/Tor 4,9 mm** und **Palettenregal-Traversen 5,8 mm** — die Regel
  hat hier **recht**: Regaltraversen sind 2-mm-Kaltprofil, also Blechschrott.
  Sie sehen nur nach Träger aus.

### L-2 · Bündel und Stapel: die Regel misst das Bündel, nicht das Stück

Ein Bund Schienen ist real E1, auch wenn Luft dazwischen ist. Betroffen:
*Stahlstützen-Bund* 5,6 · *Absperrgitter (Bund)* 2,7 · *Bauzaun-Felder
(Stapel)* 3,3. Fehlende Angabe: **wie viele Stücke im Bund liegen.**
**Empfehlung: nicht bauen** — Einzelfälle über `massiv` sind billiger.

### L-3 · Guss ist im Spiel kein eigener Stoff

`catalog.ts:72` bildet `cast` auf `steel` ab. Bremsscheiben, Motorblöcke,
Badeöfen sind Guss und wären real eine eigene, gut bezahlte Sorte. Solange es
bei zwei Fraktionen bleibt, ist das keine Regelfrage.

### L-4 · Fünf Maschinen ohne Stückliste rutschen als Premium durch

*Spritzgussmaschine* 9,0 · *CNC-Fräsmaschine* 8,5 · *Drehmaschine mit Bett*
12,1 · *Förderband-Antriebsstation* 8,6 · *Schul-Heizkesselanlage* 8,3. Nach
Wandstärke sind das Klötze, weil das Gussbett schwer ist — fachlich
vertretbar (ein Maschinenbett **ist** gutes Material), sauber wäre eine
Stückliste an diesen fünf. **Bewusst nicht mitgemacht**, weil es fünf weitere
Stücke ohne Patricks Auftrag umsortiert hätte.

---

## Die Werkzeuge

| Datei | Was sie tut |
|---|---|
| `src/materials/purity.ts` | **Die Regel selbst.** `wandstaerkeMm`, `aussenflaeche`, `WAND_AB_MM`, `VERBUND_BIS`, `fraktionVonTeil`. |
| `tools/stahlschrott.ts` | Ruft die Regel auf und stellt sie der alten gegenüber; liest alle sechs Kataloglisten aus dem Quelltext. |
| `tools/stahlschrott-liste.ts` | `alle` · `md` · `graubereich` · `brocken` · `271`. |
| `tools/stahlschrott-wirkung.ts` | Umschlag und Verdienst. |
| `tools/stahlschrott-blatt.ts` | Das Blatt fürs Telefon. |
| `tools/alufarbe.ts` | Wo Aluminium sichtbar ist und welchen Abstand es zu VA, Zink und Mischschrott hat. |
| `test/stahlschrott.test.ts` | 21 Wächter: Formel, Patricks Beispiele, Gitterbox, Übersteuerungen, Massenschwelle-Befund. |
