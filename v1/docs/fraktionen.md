# Wie die Sortierung heute funktioniert — Bestandsaufnahme

**Stand 15.09.2026 · Bestandsaufnahme, kein Umbau · alle Zahlen aus dem Quelltext gemessen**

Anlass, Patrick nach dem Gerätetest am 15.09.2026:

> „Es ist nicht wirklich erkennbar, was Stahlschrott ist und was Mischschrott ist.
> Auch die Kategorisierung ist mir nicht ganz bewusst. Das müssen wir noch angehen."

Der zweite Satz ist der eigentliche Befund. Bevor etwas umgefärbt wird, steht hier,
was die Regeln **heute sind**.

Zeichnung dazu (fürs Telefon): `docs/fraktionen-2026-09-15.svg`, in der Planmappe
unter `/v1/plaene/`.

---

## Der Unterschied in zwei Sätzen

> **Stahlschrott** ist ein Teil, das zu mindestens 95 % seiner Masse aus einem
> einzigen Stoff besteht, und dieser Stoff ist Stahl — ein Träger, ein Rohr, ein
> Blech, eine Achse, ein Seecontainer.
>
> **Mischschrott** ist alles Zusammengebaute, bei dem kein Stoff die 95 %
> erreicht — eine Waschmaschine, ein Kühlschrank, ein Autowrack —, **auch wenn
> drei Viertel davon Stahl sind.**

Es ist keine Eigenschaft des Materials, sondern eine **Schwelle über der
Stückliste**. Zwei Teile aus demselben Blech gehören in zwei verschiedene Mulden,
wenn an einem noch ein Kunststoffgriff hängt.

Quelle: `src/materials/purity.ts:110` (`SORTENREIN_AB = 0.95`) und
`src/materials/purity.ts:119-128` (`fraktionAus`).

---

## Teil 1 — Was gilt heute

### 1.1 Die Regel, Zeile für Zeile

```ts
// src/materials/purity.ts:110
export const SORTENREIN_AB = 0.95;

// src/materials/purity.ts:123-128
export function fraktionAus(zusammensetzung: Anteil[], vorgabe = "steel"): string {
  if (zusammensetzung.length === 0) return vorgabe;
  let groesster = zusammensetzung[0];
  for (const a of zusammensetzung) if (a.anteil > groesster.anteil) groesster = a;
  return groesster.anteil >= SORTENREIN_AB ? groesster.materialId : "mixed";
}
```

Angewendet wird sie beim Laden des Moduls, einmal über alle Katalogeinträge:
`src/world/scrapItems.ts:560-564` und `src/world/objektkatalog.ts:373-377`.

**Wichtig fürs Lesen des Katalogs:** Das `materialId`, das im Quelltext an einem
Eintrag steht, ist **nicht** die Fraktion, die im Spiel gilt. Hat der Eintrag eine
`zusammensetzung`, wird `materialId` überschrieben. Ein Kühlschrank steht als
`materialId: "steel"` in der Datei (`objektkatalog.ts:87`) und ist im Spiel
Mischschrott.

Zwei Wege, wie ein Teil sortenrein wird:

| Weg | Bedingung | Beispiele |
|---|---|---|
| **A — nichts angegeben** | Der Eintrag hat gar keine `zusammensetzung`. Er gilt ungeprüft als 100 % sortenrein. | Profilstahl, Blech, Badewanne, Elektroherd, LKW-Achse, Gitterbox, alle 6 VA-Teile bis auf eines |
| **B — ≥ 95 % gemessen** | Die größte Zahl in der `zusammensetzung` erreicht 0,95. | Baggerlöffel (97 % Stahl), Seecontainer 20 Fuß (95 % Stahl) |

Gemessen: von 271 erreichbaren Katalogeinträgen haben **56 eine
`zusammensetzung`**. Davon werden **54 zu Mischschrott** und **genau 2** bleiben
sortenrein (Baggerlöffel und Seecontainer, die beiden aus Weg B). Die übrigen
**215 Einträge sind sortenrein, weil niemand ihre Stückliste aufgeschrieben hat**
— bis auf einen einzigen, der von Hand auf `mixed` gesetzt ist
(„Mischschrott-Haufen", `objektkatalog.ts:183`).

> Das ist der zweite Teil der Antwort auf „die Kategorisierung ist mir nicht ganz
> bewusst": Ob ein Teil Stahlschrott ist, hängt heute weniger davon ab, woraus es
> besteht, als davon, **ob jemand die Stückliste eingetragen hat**. Ein
> *Elektroherd* (`scrapItems.ts:475`, keine Zusammensetzung) ist Stahlschrott.
> Ein *Einbauherd mit Umluftofen* (`objektkatalog.ts:90`, 78 % Stahl) ist
> Mischschrott. Beide sind derselbe Küchenherd, beide werden mit demselben Bau
> `weisseWare` gezeichnet.

### 1.2 Die 13 Fraktionen

Aus `src/materials/catalog.ts:25-65`. Preise sind Startwerte (SW), Verkaufspreis
je Tonne.

| ID | Name | Farbe | €/t | Erlaubte Behälter |
|---|---|---|---:|---|
| `steel` | Stahlschrott | `#6e5a4e` | 250 | STAHLSCHROTT |
| `mixed` | Mischschrott | `#5f5a52` | 160 | MISCHSCHROTT |
| `va` | Edelstahl VA | `#dfe6ea` | 1400 | BUNT + VA · VA-LAGER |
| `alu` | Aluminium | `#c4c8cc` | 1500 | BUNT + VA · ALU-LAGER |
| `zinc` | Zink | `#9aa6ad` | 820 | BUNT + VA · ALU-LAGER |
| `copper` | Kupfer | `#c7622b` | 7200 | BUNT + VA · KUPFER-LAGER |
| `brass` | Messing | `#c9a227` | 4300 | BUNT + VA · KUPFER-LAGER |
| `cable` | Kabel | `#b0682a` | 2200 | BUNT + VA · KABEL-LAGER |
| `battery` | Batterien | `#3d4b57` | 550 | BATTERIEN *(nur im Lager, 20 m weg)* |
| `wood` | Holz | `#8a6a42` | −20 | MUELL · ABFALL |
| `tires` | Reifen | `#2e2c2b` | −50 | MUELL · ABFALL |
| `rubble` | Baumischabfall | `#9a9083` | −40 | MUELL · ABFALL |
| `plastic` | Kunststoff | `#3f6d8a` | −60 | MUELL · ABFALL |

Alte Spielstände: `cast` → `steel`, `contaminant` → `rubble`
(`catalog.ts:72`).

### 1.3 Wohin darf es — die Behälter

Aus `src/world/containers.ts:199-466`. Zehn Behälter, zwei Arten: `halde` (die
beiden Haufen in der Ausbuchtung hinter dem Bagger) und `bay` (Betonlego-Mulden).

| Behälter | Zeile | `fractionId` | `mitFraktionen` | Lage |
|---|---|---|---|---|
| MISCHSCHROTT | 242 | `mixed` | — | Halde, hinter dem Bagger |
| STAHLSCHROTT | 257 | `steel` | — | Halde, daneben |
| BUNT + VA | 315 | `copper` | brass, alu, zinc, cable, va | Mulde am Bagger |
| MUELL | 378 | `rubble` | tires, wood, plastic | Mulde am Bagger |
| KUPFER-LAGER | 451 | `copper` | brass | Silo, 36 m westlich |
| KABEL-LAGER | 454 | `cable` | — | Silo |
| ALU-LAGER | 456 | `alu` | zinc | Silo |
| VA-LAGER | 459 | `va` | — | Silo |
| BATTERIEN | 461 | `battery` | — | Silo |
| ABFALL | 463 | `rubble` | tires, wood, plastic | Silo |

„Richtig" heißt `gehoertHierhin` (`containers.ts:140-142`): die eigene Fraktion
oder eine aus `mitFraktionen`. Alles andere zählt als Fremdmasse und drückt die
Reinheit (`containers.ts:1575`).

Die **Abwurf-Ampel** (`containers.ts:1602-1626`) urteilt nach derselben Funktion:
grün = alles Getragene gehört hinein, gelb = teils, rot = nichts.

### 1.4 Was es wert ist — und die zwei Rechnungen

Es gibt **zwei verschiedene Rechnungen** für denselben Haufen:

**(A) Das Schild an der Mulde** — `containers.ts:1385-1396` →
`purity.ts:50-71` (`containerValueGemischt`):

```
Wert = Σ (kg × Preis_dieses_Stoffes)  ×  Reinheit²
Reinheit = passende Masse / Gesamtmasse      ← mitFraktionen zählen als passend
```

**(B) Die Kasse** — `economy/account.ts:131-135` (`sellContainer`), ausgelöst
beim Abfahren des Abholers (`main.ts:838`):

```
Wert = Gesamtmasse × Preis_der_EINEN_dominanten_Fraktion  ×  Reinheit³
Reinheit = Masse der dominanten Fraktion / Gesamtmasse    ← nur EIN Stoff zählt
```

Für einen Behälter mit **einer** erlaubten Fraktion sind beide Rechnungen
algebraisch identisch, **solange die erlaubte Fraktion die schwerste ist**
(nachgerechnet: `passend × r² = gesamt × r³`, weil `r = passend/gesamt`).
Sobald der Fremdstoff überwiegt oder der Behälter mehrere Fraktionen zulässt,
laufen sie auseinander — siehe 1.5.

Weiter am Geld hängen:

* **Ankauf** `PURCHASE_PRICE_PER_KG = 0,16 €/kg` für alles, unsortiert
  (`account.ts:16`). Der Mischpreis ist dabei genau der Verkaufspreis von
  Mischschrott — wer nur Mischschrott macht, arbeitet für null.
* **Sortierprämie**: gibt es nicht mehr, nur noch Statistik (`account.ts:55-62`).
* **Magnet** (Ausbau): zieht Stahl aus einer Buntladung heraus und vergütet ihn
  separat (`account.ts:114-130`).
* **HUD „Sortierwert"**: Summe aller Schild-Werte (`main.ts:1286` →
  `containers.ts:1656`), also Rechnung (A) über den ganzen Platz.

### 1.5 Wo Regel und Anzeige sich widersprechen

**Zuerst zu den zwei schon bekannten Fällen:**

* *„Containerschild rechnete Reinheit², ausgezahlt wird Reinheit³ — bei 76 %
  Reinheit 24 % weniger als angeschrieben."*
  **Gilt so nicht mehr.** Nachgerechnet mit dem heutigen Stand
  (760 kg Stahl + 240 kg Fremdes in der Stahlhalde): Schild **109,74 €**,
  Auszahlung **109,74 €** — Abweichung 0,0 %. Mit der alten Funktion
  `containerValue` (`purity.ts:18-27`, heute nur noch von den Tests benutzt)
  stünden 144,40 € auf dem Schild, und das wären genau die 24 %. Die Umstellung
  auf `containerValueGemischt` (E-028) hat den Fehler als Nebenwirkung
  mitbeseitigt — aber **nur für Behälter mit einer einzigen Fraktion**.
* *„Muldenschild rechnete den ganzen Inhalt zum Preis der Leitfraktion, 22 % zu
  viel."* **Behoben, bestätigt.** `containers.ts:1391` ruft
  `containerValueGemischt`.

**Die noch offenen Fälle, neu gemessen:**

| Nr. | Wo | Was steht auf dem Schild | Was kommt in die Kasse | Faktor |
|---|---|---:|---:|---|
| W-1 | BUNT + VA, je 100 kg alu, zinc, copper, brass, cable, va | **1742 €** · „100 %" | **20,00 €** (in einem Zug geladen, Kupfer zuerst) | 87× zu viel |
| W-2 | BUNT + VA, dieselbe Fuhre ohne VA, ordentlich über die drei Silos ausgelagert | **1602 €** | **437,50 €** | 3,7× zu viel |
| W-3 | KUPFER-LAGER, 100 kg Kupfer + 100 kg Messing | **1150 €** · „100 %" | **180 €** | 6,4× zu viel |
| W-4 | ALU-LAGER, 100 kg Alu + 100 kg Zink | **232 €** · „100 %" | **37,50 €** | 6,2× zu viel |
| W-5 | MUELL, je 100 kg rubble, tires, wood, plastic | **−17,00 €** | **−0,25 €** | 68× zu wenig Gebühr |
| W-6 | STAHLSCHROTT-Halde, 400 kg Stahl + 600 kg Mischschrott | **16,00 €** | **34,56 €** | Kasse zahlt *mehr* als das Schild verspricht |

Die Zahlen aus W-2 und W-3/W-4 stehen bereits — unbemerkt nebeneinander — im
eigenen Wächter des Projekts: `test/buntmetall.test.ts:128` sichert die 437,50 €
der Kasse, `test/buntmetall.test.ts:164` die 1602 € des Schilds. Beide Zahlen
gelten für **dieselbe Fuhre**.

**Warum das passiert.** Das Schild zählt jede Fraktion aus `mitFraktionen` als
„gehört hierhin" und rechnet sie zu ihrem eigenen Preis. Die Kasse kennt
`mitFraktionen` überhaupt nicht: Sie sucht die **eine** schwerste Fraktion in der
Ladung, zahlt den ganzen Rest zu deren Preis und bestraft jedes Kilo, das nicht
dazugehört, mit Reinheit³. Eine Mulde, in die der Spieler sechs Fraktionen werfen
soll und die ihm dafür „100 % sortenrein" anzeigt, wird an der Kasse als zu
einem Sechstel rein abgerechnet.

Dazu kommen drei weitere Widersprüche derselben Familie:

* **W-7 — Der Kommentar beschreibt eine Regel, die es nicht gibt.**
  `containers.ts:96-99` sagt: „Abgerechnet wird nach `fractionId`: Wer Kupfer und
  Messing zusammen abgibt, bekommt für alles den Kupferpreis." Das tut
  `sellContainer` nicht. Es nimmt die *schwerste Fraktion in der Ladung*, und
  wenn das Messing ist, bekommt der Spieler für alles den Messingpreis — und dazu
  Reinheit³ obendrauf. Der Kommentar beschreibt die freundlichere Hälfte einer
  Regel, die so nirgends steht.
* **W-8 — Zwei Reinheiten auf demselben Bildschirm.** Das Muldenschild zeigt
  `passend/gesamt` mit `mitFraktionen` (`containers.ts:1425`), die Ladeanzeige
  des wartenden Abholers zeigt `bestellte Fraktion/gesamt` (`main.ts:1274-1277`).
  Für dieselben 200 kg Kupfer + Messing steht links 100 % und rechts 50 %.
* **W-10 — Bei Gleichstand entscheidet die Reihenfolge des Beladens.**
  `sellContainer` sucht die schwerste Fraktion mit `if (kg > dominantKg)`
  (`account.ts:107-112`) über eine `Map`, die in der Reihenfolge der geladenen
  Stücke gefüllt wird. Wiegen zwei Fraktionen gleich viel, gewinnt die, deren
  erstes Stück zuerst in den Container fiel. Gemessen an derselben Fuhre
  (je 100 kg alu, zinc, copper, brass, cable): **28,80 €**, wenn das Kupfer
  zuerst geladen wurde, **6,00 €**, wenn das Alu zuerst kam — Faktor 4,8 für
  dieselbe Ladung. (Die 28,80 € sind genau die Zahl, die
  `test/buntmetall.test.ts:145` als „Weg B" sichert; sie gilt nur für eine
  bestimmte Ladereihenfolge.)
* **W-9 — Abfall lohnt sich gemischt.** `containerValue` und
  `containerValueGemischt` fangen negative Preise ausdrücklich ab (Reinheit darf
  Gebühren nicht drücken, `purity.ts:24` und `purity.ts:68`); `sellContainer`
  tut das nicht (`account.ts:135`). Vier Abfallsorten gemischt kosten 0,25 € statt
  17,00 € Entsorgung. Wer sauber trennt, zahlt mehr — genau andersherum als
  gewollt (`catalog.ts:54-60`).

---

## Teil 2 — Kann man es am Bild erkennen?

### 2.1 Das Messwerkzeug

`tools/farbabstand.ts`: sRGB → CIELAB (D65) → ΔE2000 nach CIE 142:2001.
Gegen die Prüfdaten von Sharma/Wu/Dalal (2005) geprüft, **größte Abweichung
0,000042 bei 16 Prüfpaaren** (`pruefeDeltaE()`). In RGB zu messen wäre sinnlos:
Stahl und Misch liegen dort in Grün 0 und in Blau 4 Einheiten auseinander, und
genau dort sieht das Auge am schärfsten.

Maßstab: ΔE < 1 gilt als nicht unterscheidbar, 1–2 nur Kante an Kante, 2–10
erkennbarer Unterschied, > 10 andere Farbe.

### 2.2 Der Farbabstand der beiden Fraktionen

| Bedingung | Stahlschrott | Mischschrott | ΔE2000 |
|---|---|---|---:|
| Grundfarbe im Katalog | `#6e5a4e` | `#5f5a52` | **7,58** |
| Mittagssonne (`#fff4e0`, voll) | `#6e5643` | `#5f5647` | 7,42 |
| **Abendsonne** (`#ffb066`, 45 %) | `#4b270e` | `#402710` | **4,22** |
| Flutlicht (`#fff2d0`, 70 %) | `#5d4733` | `#504736` | 6,86 |
| Nacht ohne Mast (Hemi, 12 %) | `#1f1915` | `#191917` | 4,28 |

Lichtfarben aus `world/daylight.ts:22-26` und `daylight.ts:204`. Gerechnet wird
Grundfarbe × Lichtfarbe im **linearen** Raum — genau das, was der Shader für
diffuses Licht tut; der Renderer läuft ohne Tonwertabbildung (`main.ts:70-76`
setzt weder `toneMapping` noch `outputColorSpace`).

7,6 ist ein Unterschied, den man bei zwei Farbfeldern nebeneinander sieht. Bei
Abendlicht halbiert er sich fast. **Aber das ist nicht das eigentliche Problem.**

### 2.3 Das eigentliche Problem: die Teile tragen diese Farbe nicht

`src/world/objektbau.ts:22-30` sagt es selbst:

> „**Farbe nach Zweck, nicht nach Fraktion.** … Unlackiertes bleibt unlackiert …
> Weiße Ware ist weiß. Maschinen sind lackiert, und zwar so, wie ihre Branche
> lackiert … Ein Katalogeintrag **ohne Bau** bekommt weiterhin die
> Fraktionsfarbe."

Gemessen: von 271 erreichbaren Katalogeinträgen haben **255 einen Bau**. Nur
**16 Teile im ganzen Spiel tragen überhaupt die Fraktionsfarbe** — und von denen
sind neun namenlose Kleinteile (drei Kabelringe, zwei Stahlquader, ein
Alu-Zylinder, ein Holzbalken, eine Kunststoffplatte, ein Drahtknäuel).

| Fraktion | Einträge | davon mit Bau (Zweckfarbe) |
|---|---:|---:|
| steel | 139 | 134 |
| mixed | 55 | 54 |
| alu | 30 | 27 |
| wood / plastic | je 8 | je 7 |
| va / rubble | je 6 | je 6 |
| tires | 4 | 3 |
| zinc / battery | je 4 | je 4 |
| cable | 3 | 0 |
| copper | 2 | 1 |
| brass | 2 | 2 |

**Die Farbe, die ein Teil wirklich hat**, gemessen als flächengewichtete
Mittelfarbe seiner gebauten Geometrie (Dreiecksflächen im linearen Raum
gewichtet, dann nach sRGB):

| Teil A | Fraktion | Farbe | Teil B | Fraktion | Farbe | ΔE2000 |
|---|---|---|---|---|---|---:|
| Elektroherd | **Stahlschrott** | `#c8c6c1` | Waschmaschine | **Mischschrott** | `#c7c5c0` | **0,18** |
| Elektroherd | **Stahlschrott** | `#c8c6c1` | Kühlschrank | **Mischschrott** | `#cccac4` | **0,88** |
| Seecontainer 20 Fuß | **Stahlschrott** | `#34577e` | Baustellencontainer | **Mischschrott** | `#34577e` | **0,00** |
| Gitterbox | **Stahlschrott** | `#34577f` | Baustellencontainer | **Mischschrott** | `#34577e` | **0,24** |
| Blech | **Stahlschrott** | `#67625c` | Motorblock V8 | **Mischschrott** | `#696563` | 2,55 |
| Profilstahl | **Stahlschrott** | `#6e5d52` | Mischschrott-Haufen | **Mischschrott** | `#65544a` | 3,26 |
| Spülbecken | **Edelstahl VA** | `#bebcb7` | Kühlschrank | **Mischschrott** | `#cccac4` | 3,40 |

Und innerhalb **einer** Fraktion liegen die Farben weit auseinander:
Ausgebranntes Fahrzeug `#6b4530` gegen Kleinwagen-Karosserie `#345173` —
beide Mischschrott, **ΔE 29,77**.

> **Die Antwort auf Patricks ersten Satz, als Zahl:** Zwei Teile, die in
> verschiedene Mulden gehören, unterscheiden sich in der Farbe um bis zu **0,00**.
> Zwei Teile, die in dieselbe Mulde gehören, um bis zu **29,8**. Die Farbe trägt
> die Information nicht — sie trägt die gegenteilige.

Der Grund ist kein Fehler, sondern eine Entscheidung vom 12.09.2026: „Farbe nach
Zweck". Die Entscheidung ist gut fürs Bild und schlecht fürs Sortieren, und es
gibt bis heute keinen zweiten Kanal, der die Lücke schließt.

### 2.4 Rost, Schmutz, Alterung

**Gibt es nicht.** Gesucht in `world/scrapItems.ts` nach Rost, Patina, Schmutz,
Tönungen, Zufallsvariation je Stück: null Treffer. Jedes Teil derselben Sorte hat
exakt dieselbe Farbe. Variation gibt es an genau zwei Stellen:

* Kabel bekommt eine von drei Farben nach Zählnummer (`scrapItems.ts:566`).
* Lackierte Bauten würfeln aus den Maßen einen Farbton (`objektbau.ts:188`) —
  **nicht** aus der Fraktion. Deshalb sind Seecontainer (Stahl) und
  Baustellencontainer (Misch) identisch: Sie haben dieselben Maße
  `[2.4, 2.6, 4.8]`, also denselben Hashwert, also denselben Lackton.

Rost und Schmutz können die Unterscheidung heute also weder retten noch
verschlechtern — sie sind nicht da. (`ROST = 0x7a4a2c` in `objektbau.ts:169` ist
ein Lackton in der Palette, keine Alterung; `objektbau.ts:170`.)

### 2.5 Die zwei Halden nebeneinander

Beide Halden (`containers.ts:242` und `:257`) sind baugleich: 6,8 × 6,0 m, 5 m
Wandhöhe, **alle vier Wände abgeschaltet** (`haldeWaende` alles `false`). Was sie
trennt, sind die Trennsteine aus `yard.ts:138` — vier Säulen mit 1, 4, 4, 1 Lagen
à 0,60 m (`yard.ts:126`), also 2,40 m in der Mitte und 0,60 m an den Enden, in
Betongrau wie jede andere Mauer.

Unterschieden werden sie heute an **genau einem** Merkmal: dem Schild.

* Beide Schilder stehen auf **6,4 m Höhe**, 1,0 m vor der Vorderkante:
  MISCHSCHROTT auf (4,0 | −28,0), STAHLSCHROTT auf (−3,0 | −28,0).
* Das Schild trägt 4 px Rahmen in der Fraktionsfarbe auf 256 px Leinwand
  (`containers.ts:1476-1480`) — beim Überschweben wird dieser Rahmen durch die
  Ampelfarbe ersetzt. Der farbige Wandstreifen `band` (`containers.ts:602`) wird
  nur für Behälter der Art `box` gebaut (`containers.ts:1246`), und davon gibt es
  in `CONFIGS` **keinen einzigen**. Er ist toter Code.
* **Sichtbarkeit** (`containers.ts:1457-1464`): unter 4,5 m Kameraabstand
  vollständig **ausgeblendet**, volle Deckkraft erst ab 9 m, Ausblenden wieder
  ab 38 m.

Gerechnet für die Standardkamera (`orbitCamera.ts:17`, `dist = 11`, Kamera
11 m hinter dem Sitz auf rund 6 m Höhe, Bagger auf (−0,5 | −22,5)): Abstand zu den
Haldenschildern **16,7 bzw. 17,1 m** — die Schilder sind also bei normaler
Kameraeinstellung sichtbar. Fährt der Spieler an die Halde heran oder zoomt er auf
den kleinsten Abstand (3 m, `orbitCamera.ts:79`), verschwinden sie.

Das ist der Zustand: **Steht man davor, ist das einzige Unterscheidungsmerkmal
ausgeblendet.**

---

## Teil 3 — Vorschläge

Nach Wirkung geordnet. Keiner davon ist gebaut; jeder nennt Aufwand und Risiko.

### V-1 · Eine Tafel im Spiel, die sagt, was wohin gehört

**Wirkung: hoch. Aufwand: klein (1 Paket `ui`).**
Heute gibt es **keine einzige Stelle im Spiel**, an der die Zuordnung steht. Der
Tutorialschritt „Sortieren bringt das Geld" (`ui/tutorial.ts:63-71`) sagt „wirf
ihn in die passende Mulde", ohne je zu sagen, welche passt. Vorschlag: eine
aufrufbare Seite (Taste, Touch-Knopf) mit genau dem Inhalt des beiliegenden
Blattes — Farbfeld, Name, Preis, Ziel, drei Beispiele. Der Inhalt wird aus
`MATERIALS` und `CONFIGS` erzeugt, nicht abgeschrieben, damit er nicht veraltet.

*Kaputtgehen kann:* nichts an der Spiellogik; nur eine weitere Anzeige, die auf
dem iPhone mini Platz braucht (dort war die Greifanzeige schon zu groß, E-027).

### V-2 · Die Abrechnung und das Schild auf eine Regel bringen

**Wirkung: hoch. Aufwand: klein im Code, groß im Balancing (Paket `welt` + Patrick).**
Sechs gemessene Fälle (W-1 bis W-6), in denen der Spieler etwas anderes bekommt,
als angeschrieben steht — bis Faktor 87. Zwei Wege, und das ist eine
Gestaltungsfrage, keine technische:

* **(a) Die Kasse lernt `mitFraktionen`**, rechnet je Stoff und Reinheit², wie das
  Schild. Dann stimmt, was dasteht; die Buntmetall-Mulde wird zu einem echten
  Sammelbehälter, und das Sortieren zwischen Kupfer und Messing verliert seinen
  Sinn.
* **(b) Das Schild lernt die Kasse**, zeigt also den Erlös, den man wirklich
  bekäme, wenn man diesen Behälter jetzt in einem Zug verlädt. Dann ist die
  Buntmetall-Mulde sichtbar ein Puffer und kein Lager, und der Weg über die Silos
  lohnt sich sichtbar — das ist die Absicht aus E-028.

**Empfehlung: (b).** Sie erhält die Spielentscheidung, die (a) wegnimmt.
Gegenprobe zuerst als reine Funktion mit Wächter, ohne Zahlen anzufassen.

*Kaputtgehen kann:* Die HUD-Zahl „Sortierwert" fällt deutlich; Spielstände, die
auf die alte Zahl gespart haben, wirken plötzlich ärmer. Wächter `purity`,
`buntmetall`, `upgradeEffects` hängen an den Formeln.

### V-3 · Ein zweiter Kanal am Teil, der nicht Farbe ist

**Wirkung: hoch. Aufwand: mittel (`welt` + `ui`). Briefing Kap. 20 verlangt es ohnehin.**
Farbe allein darf nie der einzige Kanal sein, und hier trägt sie nicht einmal
etwas. Drei Möglichkeiten, von billig nach teuer:

* **(a) Sortierblick** — eine zuschaltbare Ansicht, in der alle losen Teile in
  ihrer Fraktionsfarbe leuchten. Ein Materialtausch, kein Eingriff in die
  Geometrie, im Normalbild unsichtbar. Das schont die Entscheidung „Farbe nach
  Zweck" vollständig, weil sie im Normalbild gilt.
* **(b) Sprühmarke** — ein kleines Quadrat in Fraktionsfarbe plus **Zeichen**
  (Balken, Kreuz, Punkt) auf jedem Teil, wie es auf einem Platz mit Kreide und
  Spray wirklich gemacht wird. Zusätzlicher Bauteil je Objekt, ein Zeichenruf mehr
  bei Objekten ohne Bau.
* **(c) Umriss beim Anvisieren** — der schon vorhandene Zielring bekommt die
  Fraktionsfarbe und einen Kurznamen. Billigste Variante, wirkt aber nur für ein
  Teil zur Zeit.

*Kaputtgehen kann:* (b) widerspricht „Unlackiertes bleibt unlackiert" und braucht
Patricks Zustimmung; (a) kostet einen Umschaltknopf mehr auf dem Telefon.

### V-4 · Die zwei Halden ohne Schild unterscheidbar machen

**Wirkung: mittel. Aufwand: klein (`welt`).**
Heute trägt das Schild alles — und genau dann, wenn man davorsteht, ist es
ausgeblendet (2.5). Vorschläge, ohne Bodeneinfärbung (die Patrick am 12.09.2026
ausdrücklich abgelehnt hat: „das kann gerne durch Dreck und Verschmutzung
ersichtlich sein"):

* Aufschrift **auf die Trennsteinmauer** — gepinselte Großbuchstaben auf Beton,
  auf Augenhöhe der abgesenkten Kabine (3,28 m, `containers.ts:502`
  `AUGPUNKT_UNTEN`), also immer im Bild.
* Untere Ausblendschwelle des Schilds von 4,5 m auf etwa 2 m senken und das
  Schild dabei schrumpfen statt ausblenden (`containers.ts:1459`).
* Die Trennsteine der beiden Halden verschieden hoch oder verschieden lang
  stapeln, damit die Silhouette allein die Seiten trennt.

*Kaputtgehen kann:* Eine Aufschrift auf der Mauer ist ein weiterer Zeichenruf und
muss zum Kollider passen (Lehre 12.09.2026: gebaut und verzeichnet müssen
dasselbe sagen).

### V-5 · Die Stückliste dort eintragen, wo sie fehlt

**Wirkung: mittel. Aufwand: mittel (`welt`, reine Datenarbeit).**
191 von 271 Einträgen sind sortenrein, weil niemand ihre Zusammensetzung
aufgeschrieben hat (1.1). Daraus kommen die Widersprüche, die ein Spieler als
Willkür erlebt: Elektroherd = Stahl, Einbauherd = Misch. Vorschlag: für jede
**Bauart** eine Standard-Zusammensetzung hinterlegen (alle `weisseWare` gleich,
alle `karosserie` gleich), und nur begründete Abweichungen einzeln eintragen.
Dann folgt die Fraktion aus dem, was man sieht.

*Kaputtgehen kann:* Der Mischschrott-Anteil im Spiel steigt sprunghaft — heute
sind 55 von 271 Einträgen Mischschrott, danach womöglich das Doppelte. Das ist
eine Balancingfrage und gehört gemessen, bevor es eingetragen wird.

### V-6 · Batterien haben am Bagger kein Ziel

**Wirkung: klein, aber es ist ein Loch. Aufwand: klein (`welt`).**
Gemessen: `battery` ist die einzige Fraktion ohne Behälter im Arbeitsbereich. Wer
eine Starterbatterie aus einem Wrack fischt, bekommt an jeder erreichbaren Mulde
„falsche Zone"; das Silo BATTERIEN steht 20 m weiter (`containers.ts:461`). Das
ist genau der offene Punkt, den VA bis zum 15.09.2026 hatte und der mit
`mitFraktionen` in BUNT + VA geschlossen wurde. Entscheidung nötig: eigene kleine
Mulde, oder `battery` mit in MUELL/BUNT (fachlich falsch — Altbatterien sind
Gefahrgut und genau deshalb eine eigene Mulde, `catalog.ts:32-38`).

---

## Nebenbefunde aus dieser Bestandsaufnahme

| # | Schwere | Ort | Was | Reproduktion | Vorschlag | Zuständig |
|---|---|---|---|---|---|---|
| B-1 | **Wichtig** | `account.ts:135` | Auszahlung kennt `mitFraktionen` nicht, Schild schon → W-1 bis W-6 | `tools/`-Messung 15.09., Tabelle 1.5 | V-2 | welt |
| B-2 | **Wichtig** | `account.ts:135` | Negative Preise werden mit Reinheit³ multipliziert; gemischter Abfall kostet 68× weniger als sortenreiner | 4 × 100 kg Abfall: −0,25 € statt −17,00 € | Schutz wie `purity.ts:24`/`:68` übernehmen | welt |
| B-2b | **Wichtig** | `account.ts:107-112` | Bei gleich schweren Fraktionen entscheidet die Ladereihenfolge über den Erlös (W-10) | Dieselbe Fuhre: 28,80 € oder 6,00 € | Gleichstand deterministisch brechen (z. B. höchster Warenwert) oder mit V-2 ganz auflösen | welt |
| B-3 | **Wichtig** | `objektbau.ts:719-723` | `baueGeometrie` liest `dims[1]`/`dims[2]`; bei `kind: "wire"` hat `dims` nur einen Wert → **NaN im Netz** | 3 von 255 gebauten Einträgen: Ankerkette (`objektkatalog.ts:176`), Stahlteile-Haufen (`:184`), Reifenhaufen (`:186`); nach Bauart betroffen auch Drahtballen (`scrapItems.ts:534`, nicht messbar, weil `BIG_SPECS` nicht exportiert ist) | `haufen` für `wire` einen Ersatzwert aus `dims[0]` geben | welt |
| B-4 | **Hinweis** | `containers.ts:602`, `:1246` | Der fraktionsfarbene Wandstreifen `band` wird nur für `kind: "box"` gebaut — in `CONFIGS` gibt es keinen. Toter Code, und zugleich der einzige Ort, an dem die Fraktionsfarbe je an einem Behälter erschienen wäre | `CONFIGS` enthält 2 × `halde`, 8 × `bay` | entweder auf `bay`/`halde` ziehen (V-4) oder entfernen | welt |
| B-5 | **Hinweis** | `containers.ts:96-99` | Kommentar beschreibt eine Abrechnungsregel, die `sellContainer` nicht hat (W-7) | Lesen | Kommentar nachziehen, wenn V-2 entschieden ist | welt |
| B-6 | **Hinweis** | `containers.ts:232-234` | Kommentar nennt die Vorderkante der Halden „z −29,2" und „8,1 m vom Sitz"; gerechnet aus `size` sind es **−29,0** und 6,5 m vom Sitz (−0,5 \| −22,5) | `c_mixed.z + size[1]/2` | Zahl im Kommentar nachziehen | welt |
| B-7 | **Wichtig** | `tsconfig.json` (`"include": ["src"]`) | `test/` und `tools/` werden **nie typgeprüft**. `npm run build` ruft `tsc --noEmit`, und der sieht diese Ordner nicht. Am 15.09.2026 war deshalb ein Wächter zwei Stunden grün, obwohl seine Eingaben `NaN` waren — jeder Vergleich mit `NaN` ist falsch, und `expect(NaN).toBeLessThan(x)` schlägt still fehl bzw. läuft durch, je nach Matcher | `tsc --noEmit` meldet in `test/` nichts, auch bei offensichtlichen Typfehlern | `"include": ["src", "test", "tools"]` — oder ein zweites `tsconfig.test.json`, das die beiden mitnimmt, und ein Schritt mehr in `build`. Zusätzlich: Wächter, die Zahlen vergleichen, mit `expect(Number.isFinite(x)).toBe(true)` beginnen lassen | qa (nach Freigabe) |

---

## Was ich **nicht** herausgefunden habe

* **37 Katalogeinträge habe ich nicht gemessen.** `BIG_SPECS` und `HUGE_SPECS` in
  `scrapItems.ts:505` und `:523` sind nicht exportiert; erreichbar sind nur
  `SPECS` (144), `KATALOG_BIG` (75) und `KATALOG_HUGE` (52) = 271. Von den
  fehlenden 37 habe ich zwei mit Zusammensetzung von Hand gelesen (Waschmaschine
  95 kg, Kabeltrommel — beide Mischschrott). Die Aussagen „16 von 271" und
  „3 NaN-Bauten" beziehen sich auf die 271, nicht auf den vollen Bestand.
* **Ob das NaN-Netz auf dem Gerät wirklich unsichtbar ist**, ist nicht geprüft.
  Die Vermutung (Umkugelradius NaN → Frustum-Test schlägt fehl → nicht gezeichnet)
  ist plausibel, aber es ist eine Vermutung. Auf dem Gerät zu prüfen: Liegt ein
  „Stahlteile-Haufen" sichtbar auf dem Platz?
* **Wie stark Glanz und Metallanteil die Farbabstände im laufenden Bild
  verschieben**, ist nicht gemessen. `metalness: 0.4` gibt 40 % der diffusen
  Rückstrahlung an die blickwinkelabhängige Spiegelung ab (`scrapItems.ts:937`).
  Die Abstände oben sind damit **Obergrenzen** — im Bild sind sie eher kleiner.
  Das ehrlich zu messen bräuchte einen Screenshot vom iPad, keine Rechnung.
* **Ob der Spieler die Buntmetall-Mulde je in einem Zug verlädt.** W-1 (Faktor 87)
  setzt das voraus. Ob es im Spiel vorkommt, hängt am Verhalten — nicht beobachtet.
* **Was Patrick genau meinte.** „Nicht erkennbar, was Stahlschrott ist und was
  Mischschrott" kann die einzelnen Teile meinen (2.3) oder die beiden Halden (2.5).
  Beide Befunde stehen hier; welcher ihn gestört hat, weiß ich nicht.
* **Wie es sich anfühlt, wenn die Zahl auf dem Schild fällt** (V-2b). Das ist eine
  Frage für den Sitz, nicht für den Rechner.

---

## Auf dem Gerät zu prüfen

1. Zwei Teile nebeneinander greifen — Elektroherd und Waschmaschine —, und
   sagen, ob man ohne die Greifanzeige einen Unterschied sieht.
2. Vor die Trennsteine zwischen den beiden Halden fahren und sagen, ob man ohne
   Schild weiß, auf welcher Seite man steht.
3. `docs/fraktionen-2026-09-15.svg` auf dem iPhone unter `/v1/plaene/` öffnen:
   Ist es ohne Zoom lesbar, und sagt es das Richtige?

---

## Anhang — alle 271 erreichbaren Katalogeinträge

Erzeugt am 15.09.2026 aus `SPECS`, `KATALOG_BIG` und `KATALOG_HUGE`. Die Spalte
**Fraktion** zeigt den Wert **nach** der Ableitung aus der Zusammensetzung, also
das, was im Spiel gilt — nicht das `materialId`, das im Quelltext steht.

### SPECS (Starthaufen + gewöhnliche Ladungen) — 144 Einträge

| Teil | Fraktion | Zusammensetzung | kg | €/t | Ziel | Farbe |
|---|---|---|---:|---:|---|---|
| Profilstahl | Stahlschrott | — (gilt als sortenrein) | 60 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Rohr | Stahlschrott | — (gilt als sortenrein) | 45 | 250 | STAHLSCHROTT | Bau `rohrFlansch` (Zweckfarbe) |
| *(ohne Namen)* | Stahlschrott | — (gilt als sortenrein) | 35 | 250 | STAHLSCHROTT | Fraktionsfarbe |
| Blech | Stahlschrott | — (gilt als sortenrein) | 55 | 250 | STAHLSCHROTT | Bau `platte` (Zweckfarbe) |
| Heizkörper (früher Guss) | Stahlschrott | — (gilt als sortenrein) | 90 | 250 | STAHLSCHROTT | Bau `platte` (Zweckfarbe) |
| Motorblock-Rest | Mischschrott | Stahlschrott 82 %, Aluminium 14 %, Kupfer 4 % | 110 | 160 | MISCHSCHROTT | Bau `motor` (Zweckfarbe) |
| *(ohne Namen)* | Stahlschrott | — (gilt als sortenrein) | 70 | 250 | STAHLSCHROTT | Fraktionsfarbe |
| Spülbecken | Edelstahl VA | — (gilt als sortenrein) | 26 | 1400 | BUNT + VA / VA-LAGER | Bau `weisseWare` (Zweckfarbe) |
| VA-Behälter | Edelstahl VA | — (gilt als sortenrein) | 34 | 1400 | BUNT + VA / VA-LAGER | Bau `tank` (Zweckfarbe) |
| VA-Geländerrohr | Edelstahl VA | — (gilt als sortenrein) | 18 | 1400 | BUNT + VA / VA-LAGER | Bau `buendel` (Zweckfarbe) |
| Felge | Aluminium | — (gilt als sortenrein) | 12 | 1500 | BUNT + VA / ALU-LAGER | Fraktionsfarbe |
| Profil | Aluminium | — (gilt als sortenrein) | 8 | 1500 | BUNT + VA / ALU-LAGER | Fraktionsfarbe |
| Tafel | Aluminium | — (gilt als sortenrein) | 10 | 1500 | BUNT + VA / ALU-LAGER | Bau `platte` (Zweckfarbe) |
| *(ohne Namen)* | Aluminium | — (gilt als sortenrein) | 11 | 1500 | BUNT + VA / ALU-LAGER | Fraktionsfarbe |
| Kupferrohr | Kupfer | — (gilt als sortenrein) | 12 | 7200 | BUNT + VA / KUPFER-LAGER | Bau `buendel` (Zweckfarbe) |
| Kupferbund | Kupfer | — (gilt als sortenrein) | 18 | 7200 | BUNT + VA / KUPFER-LAGER | Fraktionsfarbe |
| Messingarmaturen | Messing | — (gilt als sortenrein) | 15 | 4300 | BUNT + VA / KUPFER-LAGER | Bau `maschine` (Zweckfarbe) |
| *(ohne Namen)* | Kabel | — (gilt als sortenrein) | 9 | 2200 | BUNT + VA / KABEL-LAGER | Fraktionsfarbe |
| *(ohne Namen)* | Kabel | — (gilt als sortenrein) | 7 | 2200 | BUNT + VA / KABEL-LAGER | Fraktionsfarbe |
| *(ohne Namen)* | Kabel | — (gilt als sortenrein) | 12 | 2200 | BUNT + VA / KABEL-LAGER | Fraktionsfarbe |
| *(ohne Namen)* | Holz | — (gilt als sortenrein) | 14 | -20 | MUELL / ABFALL | Fraktionsfarbe |
| *(ohne Namen)* | Kunststoff | — (gilt als sortenrein) | 8 | -60 | MUELL / ABFALL | Fraktionsfarbe |
| *(ohne Namen)* | Stahlschrott | — (gilt als sortenrein) | 22 | 250 | STAHLSCHROTT | Fraktionsfarbe |
| Waschmaschine | Mischschrott | Stahlschrott 62 %, Baumischabfall 18 %, Kupfer 8 %, Kunststoff 12 % | 42 | 160 | MISCHSCHROTT | Bau `weisseWare` (Zweckfarbe) |
| Spuelmaschine | Mischschrott | Stahlschrott 60 %, Kunststoff 28 %, Kupfer 6 %, Aluminium 6 % | 38 | 160 | MISCHSCHROTT | Bau `weisseWare` (Zweckfarbe) |
| Elektroherd | Stahlschrott | — (gilt als sortenrein) | 30 | 250 | STAHLSCHROTT | Bau `weisseWare` (Zweckfarbe) |
| Warmwasserspeicher | Stahlschrott | — (gilt als sortenrein) | 52 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Badewanne | Stahlschrott | — (gilt als sortenrein) | 48 | 250 | STAHLSCHROTT | Fraktionsfarbe |
| Motorradrahmen | Stahlschrott | — (gilt als sortenrein) | 26 | 250 | STAHLSCHROTT | Bau `einspurig` (Zweckfarbe) |
| Mopedrahmen | Stahlschrott | — (gilt als sortenrein) | 14 | 250 | STAHLSCHROTT | Bau `einspurig` (Zweckfarbe) |
| Pflugschar | Stahlschrott | — (gilt als sortenrein) | 120 | 250 | STAHLSCHROTT | Bau `schaufel` (Zweckfarbe) |
| Eggenwalze | Stahlschrott | — (gilt als sortenrein) | 85 | 250 | STAHLSCHROTT | Bau `trommel` (Zweckfarbe) |
| Traktor-Frontgewicht | Stahlschrott | — (gilt als sortenrein) | 160 | 250 | STAHLSCHROTT | Bau `motor` (Zweckfarbe) |
| Heuwender-Ausleger | Stahlschrott | — (gilt als sortenrein) | 95 | 250 | STAHLSCHROTT | Bau `ausleger` (Zweckfarbe) |
| LKW-Achse | Stahlschrott | — (gilt als sortenrein) | 210 | 250 | STAHLSCHROTT | Bau `achse` (Zweckfarbe) |
| LKW-Getriebe | Stahlschrott | — (gilt als sortenrein) | 130 | 250 | STAHLSCHROTT | Bau `motor` (Zweckfarbe) |
| LKW-Kuehler | Stahlschrott | — (gilt als sortenrein) | 75 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| LKW-Felge | Stahlschrott | — (gilt als sortenrein) | 46 | 250 | STAHLSCHROTT | Fraktionsfarbe |
| Motorradmotor | Aluminium | — (gilt als sortenrein) | 16 | 1500 | BUNT + VA / ALU-LAGER | Bau `motor` (Zweckfarbe) |
| Elektromotor | Mischschrott | Stahlschrott 58 %, Kupfer 38 %, Aluminium 4 % | 22 | 160 | MISCHSCHROTT | Bau `elektromotor` (Zweckfarbe) |
| Traktorreifen | Reifen | — (gilt als sortenrein) | 11 | -50 | MUELL / ABFALL | Fraktionsfarbe |
| Zink-Dachrinne | Zink | — (gilt als sortenrein) | 14 | 820 | BUNT + VA / ALU-LAGER | Bau `buendel` (Zweckfarbe) |
| Zinkblech-Tafel | Zink | — (gilt als sortenrein) | 22 | 820 | BUNT + VA / ALU-LAGER | Bau `platte` (Zweckfarbe) |
| Fallrohr-Bund | Zink | — (gilt als sortenrein) | 31 | 820 | BUNT + VA / ALU-LAGER | Bau `buendel` (Zweckfarbe) |
| Verzinkte Gitterroste | Zink | — (gilt als sortenrein) | 58 | 820 | BUNT + VA / ALU-LAGER | Bau `stapel` (Zweckfarbe) |
| Starterbatterie | Batterien | — (gilt als sortenrein) | 19 | 550 | BATTERIEN | Bau `rahmenbox` (Zweckfarbe) |
| LKW-Batterie | Batterien | — (gilt als sortenrein) | 46 | 550 | BATTERIEN | Bau `rahmenbox` (Zweckfarbe) |
| Batteriepalette | Batterien | — (gilt als sortenrein) | 180 | 550 | BATTERIEN | Bau `stapel` (Zweckfarbe) |
| Staplerbatterie | Batterien | — (gilt als sortenrein) | 320 | 550 | BATTERIEN | Bau `rahmenbox` (Zweckfarbe) |
| Silo-Blechsegment | Stahlschrott | — (gilt als sortenrein) | 95 | 250 | STAHLSCHROTT | Bau `stapel` (Zweckfarbe) |
| Melkstand-Gitterwerk | Stahlschrott | — (gilt als sortenrein) | 140 | 250 | STAHLSCHROTT | Bau `rahmenbox` (Zweckfarbe) |
| Häcksler-Auswurfkrümmer | Stahlschrott | — (gilt als sortenrein) | 180 | 250 | STAHLSCHROTT | Bau `rohrFlansch` (Zweckfarbe) |
| Kartoffelroder-Siebkette | Stahlschrott | — (gilt als sortenrein) | 150 | 250 | STAHLSCHROTT | Bau `platte` (Zweckfarbe) |
| Gitterbox | Stahlschrott | — (gilt als sortenrein) | 120 | 250 | STAHLSCHROTT | Bau `rahmenbox` (Zweckfarbe) |
| Kreiselpumpe mit Grundplatte | Mischschrott | Stahlschrott 72 %, Kupfer 20 %, Aluminium 8 % | 165 | 160 | MISCHSCHROTT | Bau `elektromotor` (Zweckfarbe) |
| Großgetriebe (Industrie) | Stahlschrott | — (gilt als sortenrein) | 200 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Schraubenkompressor | Stahlschrott | — (gilt als sortenrein) | 190 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Wärmetauscher-Bündel | Stahlschrott | — (gilt als sortenrein) | 130 | 250 | STAHLSCHROTT | Bau `rohrFlansch` (Zweckfarbe) |
| Lüftungskanäle (Bündel) | Stahlschrott | — (gilt als sortenrein) | 75 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Späneförderer | Stahlschrott | — (gilt als sortenrein) | 160 | 250 | STAHLSCHROTT | Bau `ausleger` (Zweckfarbe) |
| Hallenkran-Laufkatze | Stahlschrott | — (gilt als sortenrein) | 145 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Palettenregal-Traversen (Bund) | Stahlschrott | — (gilt als sortenrein) | 105 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Kühlschrank | Mischschrott | Stahlschrott 52 %, Aluminium 10 %, Kupfer 6 %, Kunststoff 32 % | 55 | 160 | MISCHSCHROTT | Bau `weisseWare` (Zweckfarbe) |
| Gefriertruhe | Mischschrott | Stahlschrott 55 %, Aluminium 8 %, Kupfer 5 %, Kunststoff 32 % | 62 | 160 | MISCHSCHROTT | Bau `weisseWare` (Zweckfarbe) |
| Wäschetrockner | Mischschrott | Stahlschrott 62 %, Aluminium 6 %, Kupfer 10 %, Kunststoff 22 % | 33 | 160 | MISCHSCHROTT | Bau `weisseWare` (Zweckfarbe) |
| Einbauherd mit Umluftofen | Mischschrott | Stahlschrott 78 %, Aluminium 4 %, Kupfer 5 %, Kunststoff 13 % | 28 | 160 | MISCHSCHROTT | Bau `weisseWare` (Zweckfarbe) |
| Dunstabzugshaube | Edelstahl VA | — (gilt als sortenrein) | 14 | 1400 | BUNT + VA / VA-LAGER | Bau `weisseWare` (Zweckfarbe) |
| Gastherme | Mischschrott | Stahlschrott 55 %, Kupfer 28 %, Aluminium 7 %, Kunststoff 10 % | 36 | 160 | MISCHSCHROTT | Bau `maschine` (Zweckfarbe) |
| Öltank (Keller, Kunststoff) | Kunststoff | — (gilt als sortenrein) | 45 | -60 | MUELL / ABFALL | Bau `tank` (Zweckfarbe) |
| Split-Klimagerät | Mischschrott | Stahlschrott 45 %, Kupfer 30 %, Aluminium 15 %, Kunststoff 10 % | 34 | 160 | MISCHSCHROTT | Bau `maschine` (Zweckfarbe) |
| Ölradiator | Stahlschrott | — (gilt als sortenrein) | 24 | 250 | STAHLSCHROTT | Bau `container` (Zweckfarbe) |
| Gusseiserner Badeofen | Stahlschrott | — (gilt als sortenrein) | 130 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Kachelofen-Einsatz | Stahlschrott | — (gilt als sortenrein) | 165 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Doppelbett-Gestell | Stahlschrott | — (gilt als sortenrein) | 40 | 250 | STAHLSCHROTT | Bau `rahmenbox` (Zweckfarbe) |
| Lattenrost-Stapel | Holz | — (gilt als sortenrein) | 48 | -20 | MUELL / ABFALL | Bau `stapel` (Zweckfarbe) |
| Matratzenstapel | Kunststoff | — (gilt als sortenrein) | 55 | -60 | MUELL / ABFALL | Bau `stapel` (Zweckfarbe) |
| Sofa (Dreisitzer) | Mischschrott | Kunststoff 55 %, Holz 30 %, Stahlschrott 15 % | 70 | 160 | MISCHSCHROTT | Bau `moebel` (Zweckfarbe) |
| Schrankwand-Segment | Mischschrott | Holz 88 %, Stahlschrott 8 %, Kunststoff 4 % | 65 | 160 | MISCHSCHROTT | Bau `moebel` (Zweckfarbe) |
| Duschkabine | Aluminium | — (gilt als sortenrein) | 26 | 1500 | BUNT + VA / ALU-LAGER | Bau `fensterflaeche` (Zweckfarbe) |
| Rollladenpanzer (aufgerollt) | Aluminium | — (gilt als sortenrein) | 42 | 1500 | BUNT + VA / ALU-LAGER | Bau `rohrFlansch` (Zweckfarbe) |
| Gartenhaus-Wandelement | Holz | — (gilt als sortenrein) | 85 | -20 | MUELL / ABFALL | Bau `fensterflaeche` (Zweckfarbe) |
| Aufsitzmäher | Mischschrott | Stahlschrott 70 %, Kunststoff 14 %, Aluminium 6 %, Reifen 6 %, Kupfer 4 % | 180 | 160 | MISCHSCHROTT | Bau `maschine` (Zweckfarbe) |
| Wohnwagen-Achse | Stahlschrott | — (gilt als sortenrein) | 95 | 250 | STAHLSCHROTT | Bau `achse` (Zweckfarbe) |
| Wohnwagen-Wandelement | Aluminium | — (gilt als sortenrein) | 60 | 1500 | BUNT + VA / ALU-LAGER | Bau `fensterflaeche` (Zweckfarbe) |
| Vorzelt-Gestänge (Bund) | Aluminium | — (gilt als sortenrein) | 24 | 1500 | BUNT + VA / ALU-LAGER | Bau `buendel` (Zweckfarbe) |
| Wohnwagen-Kühlschrank (Absorber) | Mischschrott | Stahlschrott 52 %, Aluminium 10 %, Kupfer 6 %, Kunststoff 32 % | 38 | 160 | MISCHSCHROTT | Bau `weisseWare` (Zweckfarbe) |
| Jetski | Mischschrott | Kunststoff 58 %, Stahlschrott 24 %, Aluminium 10 %, Kupfer 8 % | 160 | 160 | MISCHSCHROTT | Bau `wasserfahrzeug` (Zweckfarbe) |
| Quad | Mischschrott | Stahlschrott 62 %, Kunststoff 16 %, Aluminium 10 %, Reifen 8 %, Kupfer 4 % | 210 | 160 | MISCHSCHROTT | Bau `kleinfahrzeug` (Zweckfarbe) |
| Golfwagen | Mischschrott | Stahlschrott 55 %, Kunststoff 20 %, Aluminium 10 %, Reifen 8 %, Kupfer 7 % | 175 | 160 | MISCHSCHROTT | Bau `kabine` (Zweckfarbe) |
| Motorroller (komplett) | Mischschrott | Stahlschrott 58 %, Kunststoff 20 %, Aluminium 12 %, Reifen 6 %, Kupfer 4 % | 95 | 160 | MISCHSCHROTT | Bau `einspurig` (Zweckfarbe) |
| Schneemobil | Mischschrott | Stahlschrott 55 %, Kunststoff 22 %, Aluminium 12 %, Reifen 7 %, Kupfer 4 % | 205 | 160 | MISCHSCHROTT | Bau `kufenRaupe` (Zweckfarbe) |
| Ruderboot (Alu) | Aluminium | — (gilt als sortenrein) | 55 | 1500 | BUNT + VA / ALU-LAGER | Bau `tank` (Zweckfarbe) |
| Reifenstapel (Pkw) | Reifen | — (gilt als sortenrein) | 45 | -50 | MUELL / ABFALL | Bau `stapel` (Zweckfarbe) |
| Reifenstapel (LKW) | Reifen | — (gilt als sortenrein) | 120 | -50 | MUELL / ABFALL | Bau `stapel` (Zweckfarbe) |
| Rad mit Alufelge | Mischschrott | Reifen 58 %, Aluminium 42 % | 24 | 160 | MISCHSCHROTT | Fraktionsfarbe |
| Felgenstapel (Stahl) | Stahlschrott | — (gilt als sortenrein) | 95 | 250 | STAHLSCHROTT | Bau `stapel` (Zweckfarbe) |
| Motorblock (V8, ausgebaut) | Mischschrott | Stahlschrott 82 %, Aluminium 14 %, Kupfer 4 % | 190 | 160 | MISCHSCHROTT | Bau `motor` (Zweckfarbe) |
| Automatikgetriebe | Aluminium | — (gilt als sortenrein) | 85 | 1500 | BUNT + VA / ALU-LAGER | Bau `maschine` (Zweckfarbe) |
| Hinterachse mit Differenzial | Stahlschrott | — (gilt als sortenrein) | 185 | 250 | STAHLSCHROTT | Bau `achse` (Zweckfarbe) |
| Katalysator-Bündel | Edelstahl VA | — (gilt als sortenrein) | 38 | 1400 | BUNT + VA / VA-LAGER | Bau `buendel` (Zweckfarbe) |
| Stoßfänger-Stapel | Kunststoff | — (gilt als sortenrein) | 32 | -60 | MUELL / ABFALL | Bau `stapel` (Zweckfarbe) |
| Motorhauben-Stapel | Stahlschrott | — (gilt als sortenrein) | 88 | 250 | STAHLSCHROTT | Bau `stapel` (Zweckfarbe) |
| Fahrzeugtüren-Bund | Stahlschrott | — (gilt als sortenrein) | 110 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Fahrzeug-Sitzbank | Kunststoff | — (gilt als sortenrein) | 30 | -60 | MUELL / ABFALL | Bau `moebel` (Zweckfarbe) |
| Baggerlöffel | Stahlschrott | Stahlschrott 97 %, Reifen 3 % | 205 | 250 | STAHLSCHROTT | Bau `schaufel` (Zweckfarbe) |
| Gerüstrahmen (Bund) | Aluminium | — (gilt als sortenrein) | 70 | 1500 | BUNT + VA / ALU-LAGER | Bau `buendel` (Zweckfarbe) |
| Gerüstbohlen (Stapel) | Holz | — (gilt als sortenrein) | 110 | -20 | MUELL / ABFALL | Bau `stapel` (Zweckfarbe) |
| Stahlstützen-Bund | Stahlschrott | — (gilt als sortenrein) | 145 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Bauzaun-Felder (Stapel) | Stahlschrott | — (gilt als sortenrein) | 120 | 250 | STAHLSCHROTT | Bau `rahmenbox` (Zweckfarbe) |
| Absperrgitter (Bund) | Stahlschrott | — (gilt als sortenrein) | 85 | 250 | STAHLSCHROTT | Bau `rahmenbox` (Zweckfarbe) |
| Aufzugs-Antriebsmaschine | Mischschrott | Stahlschrott 70 %, Kupfer 26 %, Aluminium 4 % | 190 | 160 | MISCHSCHROTT | Bau `maschine` (Zweckfarbe) |
| Fassadenelement (Metall) | Aluminium | — (gilt als sortenrein) | 48 | 1500 | BUNT + VA / ALU-LAGER | Bau `platte` (Zweckfarbe) |
| Tankstellen-Zapfsäule | Stahlschrott | — (gilt als sortenrein) | 115 | 250 | STAHLSCHROTT | Bau `kabine` (Zweckfarbe) |
| Krankenhaus-Sterilisator | Edelstahl VA | — (gilt als sortenrein) | 160 | 1400 | BUNT + VA / VA-LAGER | Bau `weisseWare` (Zweckfarbe) |
| Parkhaus-Schrankenanlage | Stahlschrott | — (gilt als sortenrein) | 95 | 250 | STAHLSCHROTT | Bau `kabine` (Zweckfarbe) |
| Supermarkt-Kühlregal | Mischschrott | Edelstahl VA 45 %, Stahlschrott 30 %, Kupfer 12 %, Kunststoff 13 % | 145 | 160 | MISCHSCHROTT | Bau `weisseWare` (Zweckfarbe) |
| Supermarkt-Kassentheke | Stahlschrott | — (gilt als sortenrein) | 70 | 250 | STAHLSCHROTT | Bau `rahmenbox` (Zweckfarbe) |
| Flugzeug-Seitenleitwerk | Aluminium | — (gilt als sortenrein) | 80 | 1500 | BUNT + VA / ALU-LAGER | Bau `platte` (Zweckfarbe) |
| Flugzeug-Höhenleitwerk | Aluminium | — (gilt als sortenrein) | 110 | 1500 | BUNT + VA / ALU-LAGER | Bau `platte` (Zweckfarbe) |
| Flugzeug-Fahrwerksbein | Stahlschrott | — (gilt als sortenrein) | 195 | 250 | STAHLSCHROTT | Bau `achse` (Zweckfarbe) |
| Triebwerksverkleidung | Aluminium | — (gilt als sortenrein) | 65 | 1500 | BUNT + VA / ALU-LAGER | Bau `tank` (Zweckfarbe) |
| Propeller (Metall) | Aluminium | — (gilt als sortenrein) | 90 | 1500 | BUNT + VA / ALU-LAGER | Bau `platte` (Zweckfarbe) |
| Rotorkopf | Stahlschrott | — (gilt als sortenrein) | 205 | 250 | STAHLSCHROTT | Bau `motor` (Zweckfarbe) |
| Rotorblätter (Bund) | Aluminium | — (gilt als sortenrein) | 75 | 1500 | BUNT + VA / ALU-LAGER | Bau `buendel` (Zweckfarbe) |
| Flughafen-Gepäckwagen | Aluminium | — (gilt als sortenrein) | 85 | 1500 | BUNT + VA / ALU-LAGER | Bau `rahmenbox` (Zweckfarbe) |
| Luftfracht-Container (ULD) | Aluminium | — (gilt als sortenrein) | 130 | 1500 | BUNT + VA / ALU-LAGER | Bau `container` (Zweckfarbe) |
| Eisenbahn-Puffer (Paar) | Stahlschrott | — (gilt als sortenrein) | 200 | 250 | STAHLSCHROTT | Bau `achse` (Zweckfarbe) |
| Schienenbündel | Stahlschrott | — (gilt als sortenrein) | 175 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Weichenzunge | Stahlschrott | — (gilt als sortenrein) | 160 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Oberleitungsmast | Stahlschrott | — (gilt als sortenrein) | 140 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Signalmast mit Schirm | Stahlschrott | — (gilt als sortenrein) | 105 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Bahnschwellen (Holzstapel) | Holz | — (gilt als sortenrein) | 190 | -20 | MUELL / ABFALL | Bau `stapel` (Zweckfarbe) |
| Schiffsschraube | Messing | — (gilt als sortenrein) | 180 | 4300 | BUNT + VA / KUPFER-LAGER | Bau `platte` (Zweckfarbe) |
| Ruderblatt | Stahlschrott | — (gilt als sortenrein) | 175 | 250 | STAHLSCHROTT | Bau `platte` (Zweckfarbe) |
| Ankerkette (Haufen) | Stahlschrott | — (gilt als sortenrein) | 205 | 250 | STAHLSCHROTT | Bau `haufen` (Zweckfarbe) |
| Stockanker | Stahlschrott | — (gilt als sortenrein) | 195 | 250 | STAHLSCHROTT | Bau `motor` (Zweckfarbe) |
| Poller | Stahlschrott | — (gilt als sortenrein) | 190 | 250 | STAHLSCHROTT | Bau `motor` (Zweckfarbe) |
| Schiffsluke (Deckel) | Stahlschrott | — (gilt als sortenrein) | 165 | 250 | STAHLSCHROTT | Bau `platte` (Zweckfarbe) |
| Holzbruch-Haufen | Holz | — (gilt als sortenrein) | 120 | -20 | MUELL / ABFALL | Bau `haufen` (Zweckfarbe) |
| Mischschrott-Haufen | Mischschrott | — (gilt als sortenrein) | 175 | 160 | MISCHSCHROTT | Bau `haufen` (Zweckfarbe) |
| Stahlteile-Haufen | Stahlschrott | — (gilt als sortenrein) | 190 | 250 | STAHLSCHROTT | Bau `haufen` (Zweckfarbe) |
| Metallpaket (gepresst) | Stahlschrott | — (gilt als sortenrein) | 210 | 250 | STAHLSCHROTT | Bau `stapel` (Zweckfarbe) |
| Reifenhaufen | Reifen | — (gilt als sortenrein) | 95 | -50 | MUELL / ABFALL | Bau `haufen` (Zweckfarbe) |
| Schrottschere-Abschnitte | Stahlschrott | — (gilt als sortenrein) | 205 | 250 | STAHLSCHROTT | Bau `stapel` (Zweckfarbe) |

### KATALOG_BIG (Großteile) — 75 Einträge

| Teil | Fraktion | Zusammensetzung | kg | €/t | Ziel | Farbe |
|---|---|---|---:|---:|---|---|
| Traktorkabine | Mischschrott | Stahlschrott 80 %, Baumischabfall 6 %, Kunststoff 10 %, Aluminium 4 % | 320 | 160 | MISCHSCHROTT | Bau `kabine` (Zweckfarbe) |
| Traktor-Hinterachse | Stahlschrott | — (gilt als sortenrein) | 480 | 250 | STAHLSCHROTT | Bau `achse` (Zweckfarbe) |
| Traktor-Vorderachse | Stahlschrott | — (gilt als sortenrein) | 260 | 250 | STAHLSCHROTT | Bau `achse` (Zweckfarbe) |
| Frontlader-Schwinge | Stahlschrott | — (gilt als sortenrein) | 380 | 250 | STAHLSCHROTT | Bau `ausleger` (Zweckfarbe) |
| Frontlader-Schaufel | Stahlschrott | — (gilt als sortenrein) | 240 | 250 | STAHLSCHROTT | Bau `schaufel` (Zweckfarbe) |
| Häcksler-Trommel | Stahlschrott | — (gilt als sortenrein) | 480 | 250 | STAHLSCHROTT | Bau `motor` (Zweckfarbe) |
| Güllefass-Pumpwerk | Stahlschrott | — (gilt als sortenrein) | 210 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Presskammerwalzen (Bund) | Stahlschrott | — (gilt als sortenrein) | 340 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Sämaschine mit Saatkasten | Stahlschrott | — (gilt als sortenrein) | 420 | 250 | STAHLSCHROTT | Bau `gitterturm` (Zweckfarbe) |
| Mähwerk-Scheibenbalken | Stahlschrott | — (gilt als sortenrein) | 260 | 250 | STAHLSCHROTT | Bau `platte` (Zweckfarbe) |
| Feldspritze-Gestänge | Aluminium | — (gilt als sortenrein) | 190 | 1500 | BUNT + VA / ALU-LAGER | Bau `buendel` (Zweckfarbe) |
| Exzenterpresse | Stahlschrott | — (gilt als sortenrein) | 560 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Förderband-Segment | Stahlschrott | — (gilt als sortenrein) | 280 | 250 | STAHLSCHROTT | Bau `ausleger` (Zweckfarbe) |
| Förderband-Antriebsstation | Stahlschrott | — (gilt als sortenrein) | 390 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Druckluftbehälter | Stahlschrott | — (gilt als sortenrein) | 310 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Notstromaggregat | Mischschrott | Stahlschrott 74 %, Kupfer 18 %, Aluminium 8 % | 580 | 160 | MISCHSCHROTT | Bau `maschine` (Zweckfarbe) |
| Industrieofen-Kammer | Stahlschrott | — (gilt als sortenrein) | 430 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Lüftungsaggregat (Dachgerät) | Stahlschrott | — (gilt als sortenrein) | 240 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Zyklonabscheider | Stahlschrott | — (gilt als sortenrein) | 300 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Rohrbrücke-Segment | Stahlschrott | — (gilt als sortenrein) | 470 | 250 | STAHLSCHROTT | Bau `gitterturm` (Zweckfarbe) |
| Gitterbox-Stapel | Stahlschrott | — (gilt als sortenrein) | 470 | 250 | STAHLSCHROTT | Bau `rahmenbox` (Zweckfarbe) |
| Palettenregal-Rahmen | Stahlschrott | — (gilt als sortenrein) | 350 | 250 | STAHLSCHROTT | Bau `rahmenbox` (Zweckfarbe) |
| Industrie-Rolltor | Stahlschrott | — (gilt als sortenrein) | 260 | 250 | STAHLSCHROTT | Bau `platte` (Zweckfarbe) |
| Sektionaltor-Panele (Bund) | Stahlschrott | — (gilt als sortenrein) | 330 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Kühlturm-Zelle | Kunststoff | — (gilt als sortenrein) | 210 | -60 | MUELL / ABFALL | Bau `tank` (Zweckfarbe) |
| Heizöltank (Stahl, liegend) | Stahlschrott | — (gilt als sortenrein) | 230 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Küchenzeile (Segment) | Mischschrott | Holz 74 %, Stahlschrott 16 %, Kunststoff 10 % | 240 | 160 | MISCHSCHROTT | Bau `moebel` (Zweckfarbe) |
| Wohnwagen-Chassis | Stahlschrott | — (gilt als sortenrein) | 420 | 250 | STAHLSCHROTT | Bau `fahrgestell` (Zweckfarbe) |
| Bootsanhänger | Stahlschrott | — (gilt als sortenrein) | 260 | 250 | STAHLSCHROTT | Bau `fahrgestell` (Zweckfarbe) |
| Sportboot-Rumpf (GFK) | Kunststoff | — (gilt als sortenrein) | 340 | -60 | MUELL / ABFALL | Bau `tank` (Zweckfarbe) |
| Kajütboot-Aufbau | Kunststoff | — (gilt als sortenrein) | 280 | -60 | MUELL / ABFALL | Bau `tank` (Zweckfarbe) |
| Campinganhänger (Faltcaravan) | Mischschrott | Stahlschrott 48 %, Aluminium 20 %, Kunststoff 22 %, Holz 10 % | 380 | 160 | MISCHSCHROTT | Bau `fahrgestell` (Zweckfarbe) |
| Pritschenwagen-Fahrgestell | Stahlschrott | — (gilt als sortenrein) | 520 | 250 | STAHLSCHROTT | Bau `fahrgestell` (Zweckfarbe) |
| Kipper-Mulde | Stahlschrott | — (gilt als sortenrein) | 560 | 250 | STAHLSCHROTT | Bau `container` (Zweckfarbe) |
| Tankauflieger-Segment | Aluminium | — (gilt als sortenrein) | 300 | 1500 | BUNT + VA / ALU-LAGER | Bau `tank` (Zweckfarbe) |
| Autotransporter-Rampen | Stahlschrott | — (gilt als sortenrein) | 240 | 250 | STAHLSCHROTT | Bau `stapel` (Zweckfarbe) |
| Anhänger (Einachs, Plane) | Stahlschrott | — (gilt als sortenrein) | 260 | 250 | STAHLSCHROTT | Bau `fahrgestell` (Zweckfarbe) |
| Kofferauflieger-Seitenwand | Aluminium | — (gilt als sortenrein) | 190 | 1500 | BUNT + VA / ALU-LAGER | Bau `platte` (Zweckfarbe) |
| Baggerausleger | Stahlschrott | — (gilt als sortenrein) | 590 | 250 | STAHLSCHROTT | Bau `ausleger` (Zweckfarbe) |
| Radlader-Schaufel | Stahlschrott | — (gilt als sortenrein) | 420 | 250 | STAHLSCHROTT | Bau `schaufel` (Zweckfarbe) |
| Raupenlaufwerk-Ketten (Bund) | Stahlschrott | — (gilt als sortenrein) | 560 | 250 | STAHLSCHROTT | Bau `buendel` (Zweckfarbe) |
| Turmdrehkran-Mastschuss | Stahlschrott | — (gilt als sortenrein) | 430 | 250 | STAHLSCHROTT | Bau `gitterturm` (Zweckfarbe) |
| Betonfertigteil-Wand | Stahlschrott | — (gilt als sortenrein) | 390 | 250 | STAHLSCHROTT | Bau `platte` (Zweckfarbe) |
| Betontreppenlauf | Baumischabfall | — (gilt als sortenrein) | 520 | -40 | MUELL / ABFALL | Bau `beton` (Zweckfarbe) |
| Betonrohr (Kanal) | Baumischabfall | — (gilt als sortenrein) | 380 | -40 | MUELL / ABFALL | Bau `beton` (Zweckfarbe) |
| Schachtring | Baumischabfall | — (gilt als sortenrein) | 340 | -40 | MUELL / ABFALL | Bau `beton` (Zweckfarbe) |
| Dachstuhl-Binder | Holz | — (gilt als sortenrein) | 220 | -20 | MUELL / ABFALL | Bau `gitterturm` (Zweckfarbe) |
| Fensterfront (Pfosten-Riegel) | Aluminium | — (gilt als sortenrein) | 280 | 1500 | BUNT + VA / ALU-LAGER | Bau `fensterflaeche` (Zweckfarbe) |
| Schuttcontainer (Absetzmulde) | Stahlschrott | — (gilt als sortenrein) | 520 | 250 | STAHLSCHROTT | Bau `container` (Zweckfarbe) |
| Bauwagen (alt, Holz) | Holz | — (gilt als sortenrein) | 340 | -20 | MUELL / ABFALL | Bau `kabine` (Zweckfarbe) |
| Aufzugskabine | Stahlschrott | — (gilt als sortenrein) | 520 | 250 | STAHLSCHROTT | Bau `container` (Zweckfarbe) |
| Aufzugs-Gegengewicht | Stahlschrott | — (gilt als sortenrein) | 580 | 250 | STAHLSCHROTT | Bau `motor` (Zweckfarbe) |
| Rolltreppen-Stufenband | Aluminium | — (gilt als sortenrein) | 260 | 1500 | BUNT + VA / ALU-LAGER | Bau `ausleger` (Zweckfarbe) |
| Großklimagerät (Dach) | Stahlschrott | — (gilt als sortenrein) | 430 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Rückkühler (Dachaufbau) | Stahlschrott | — (gilt als sortenrein) | 380 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Glasfassaden-Element | Aluminium | — (gilt als sortenrein) | 250 | 1500 | BUNT + VA / ALU-LAGER | Bau `fensterflaeche` (Zweckfarbe) |
| Werkstatt-Hebebühne | Stahlschrott | — (gilt als sortenrein) | 560 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Autohaus-Schaufensterrahmen | Aluminium | — (gilt als sortenrein) | 210 | 1500 | BUNT + VA / ALU-LAGER | Bau `fensterflaeche` (Zweckfarbe) |
| Schul-Heizkesselanlage | Stahlschrott | — (gilt als sortenrein) | 590 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Kühlhaus-Paneele (Stapel) | Stahlschrott | — (gilt als sortenrein) | 240 | 250 | STAHLSCHROTT | Bau `stapel` (Zweckfarbe) |
| Tankstellen-Dachkonstruktion | Stahlschrott | — (gilt als sortenrein) | 300 | 250 | STAHLSCHROTT | Bau `platte` (Zweckfarbe) |
| Flughafen-Schleppfahrzeug | Mischschrott | Stahlschrott 80 %, Kunststoff 8 %, Kupfer 6 %, Reifen 6 % | 560 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Fluggasttreppe | Aluminium | — (gilt als sortenrein) | 260 | 1500 | BUNT + VA / ALU-LAGER | Bau `gitterturm` (Zweckfarbe) |
| Cateringwagen-Aufbau | Aluminium | — (gilt als sortenrein) | 300 | 1500 | BUNT + VA / ALU-LAGER | Bau `elektromotor` (Zweckfarbe) |
| Hubschrauber-Zelle | Mischschrott | Aluminium 68 %, Baumischabfall 8 %, Kunststoff 16 %, Stahlschrott 8 % | 420 | 160 | MISCHSCHROTT | Bau `kabine` (Zweckfarbe) |
| Hubschrauber-Heckausleger | Aluminium | — (gilt als sortenrein) | 230 | 1500 | BUNT + VA / ALU-LAGER | Bau `rohrFlansch` (Zweckfarbe) |
| Prellbock | Stahlschrott | — (gilt als sortenrein) | 580 | 250 | STAHLSCHROTT | Bau `motor` (Zweckfarbe) |
| Radsatz (Eisenbahn) | Stahlschrott | — (gilt als sortenrein) | 560 | 250 | STAHLSCHROTT | Bau `achse` (Zweckfarbe) |
| Lokomotiv-Führerstand | Mischschrott | Stahlschrott 86 %, Baumischabfall 6 %, Kunststoff 8 % | 520 | 160 | MISCHSCHROTT | Bau `kabine` (Zweckfarbe) |
| Bahnschwellen (Betonstapel) | Baumischabfall | — (gilt als sortenrein) | 590 | -40 | MUELL / ABFALL | Bau `stapel` (Zweckfarbe) |
| Schiebewand-Waggon-Seitenteil | Stahlschrott | — (gilt als sortenrein) | 470 | 250 | STAHLSCHROTT | Bau `platte` (Zweckfarbe) |
| Ponton-Segment | Stahlschrott | — (gilt als sortenrein) | 520 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Reachstacker-Spreader | Stahlschrott | — (gilt als sortenrein) | 580 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Bootsrumpf (Stahl) | Stahlschrott | — (gilt als sortenrein) | 490 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Hafenkran-Ausleger | Stahlschrott | — (gilt als sortenrein) | 430 | 250 | STAHLSCHROTT | Bau `ausleger` (Zweckfarbe) |

### KATALOG_HUGE (Schwergewichte) — 52 Einträge

| Teil | Fraktion | Zusammensetzung | kg | €/t | Ziel | Farbe |
|---|---|---|---:|---:|---|---|
| Mähdrescher-Schneidwerk | Stahlschrott | — (gilt als sortenrein) | 1300 | 250 | STAHLSCHROTT | Bau `schaufel` (Zweckfarbe) |
| Mähdrescher-Dreschtrommel | Stahlschrott | — (gilt als sortenrein) | 620 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Mähdrescher-Korntank | Stahlschrott | — (gilt als sortenrein) | 640 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Güllefass | Stahlschrott | — (gilt als sortenrein) | 1500 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Ballenpresse (Rundballen) | Stahlschrott | — (gilt als sortenrein) | 1900 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Grubber mit Zinkenfeld | Stahlschrott | — (gilt als sortenrein) | 760 | 250 | STAHLSCHROTT | Bau `gitterturm` (Zweckfarbe) |
| Scheibenegge | Stahlschrott | — (gilt als sortenrein) | 840 | 250 | STAHLSCHROTT | Bau `gitterturm` (Zweckfarbe) |
| Kreiselegge | Stahlschrott | — (gilt als sortenrein) | 720 | 250 | STAHLSCHROTT | Bau `gitterturm` (Zweckfarbe) |
| Maispflücker-Vorsatz | Stahlschrott | — (gilt als sortenrein) | 880 | 250 | STAHLSCHROTT | Bau `schaufel` (Zweckfarbe) |
| Ladewagen-Aufbau | Stahlschrott | — (gilt als sortenrein) | 830 | 250 | STAHLSCHROTT | Bau `rahmenbox` (Zweckfarbe) |
| Miststreuer-Streuwerk | Stahlschrott | — (gilt als sortenrein) | 920 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Futtermischwagen-Behälter | Stahlschrott | — (gilt als sortenrein) | 1700 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Futtermischwagen-Mischschnecke | Stahlschrott | — (gilt als sortenrein) | 900 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| CNC-Fräsmaschine | Stahlschrott | — (gilt als sortenrein) | 2300 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Drehmaschine mit Bett | Stahlschrott | — (gilt als sortenrein) | 2100 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Spritzgussmaschine | Stahlschrott | — (gilt als sortenrein) | 2600 | 250 | STAHLSCHROTT | Bau `maschine` (Zweckfarbe) |
| Dampfkessel | Stahlschrott | — (gilt als sortenrein) | 1600 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Wohnwagen (komplett) | Mischschrott | Aluminium 38 %, Holz 24 %, Kunststoff 30 %, Stahlschrott 8 % | 950 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Wohnmobil-Aufbau | Mischschrott | Aluminium 44 %, Kunststoff 30 %, Holz 20 %, Stahlschrott 6 % | 1100 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Wohnmobil-Alkoven | Mischschrott | Aluminium 40 %, Kunststoff 34 %, Holz 22 %, Stahlschrott 4 % | 620 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Kleinwagen-Karosserie | Mischschrott | Stahlschrott 74 %, Kunststoff 14 %, Aluminium 5 %, Baumischabfall 4 %, Kupfer 3 % | 700 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Kombi-Karosserie | Mischschrott | Stahlschrott 74 %, Kunststoff 14 %, Aluminium 5 %, Baumischabfall 4 %, Kupfer 3 % | 980 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| SUV-Karosserie | Mischschrott | Stahlschrott 73 %, Kunststoff 15 %, Aluminium 5 %, Baumischabfall 4 %, Kupfer 3 % | 1250 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Transporter-Kastenwagen | Mischschrott | Stahlschrott 78 %, Kunststoff 12 %, Aluminium 5 %, Baumischabfall 3 %, Kupfer 2 % | 1400 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Ausgebranntes Fahrzeug | Mischschrott | Stahlschrott 88 %, Baumischabfall 6 %, Aluminium 6 % | 620 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Unfallfahrzeug (Front eingedrückt) | Mischschrott | Stahlschrott 74 %, Kunststoff 14 %, Aluminium 5 %, Baumischabfall 4 %, Kupfer 3 % | 1050 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Kleinbus | Mischschrott | Stahlschrott 74 %, Kunststoff 14 %, Aluminium 5 %, Baumischabfall 4 %, Kupfer 3 % | 1800 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Reisebus-Heckteil | Mischschrott | Stahlschrott 72 %, Kunststoff 14 %, Aluminium 7 %, Baumischabfall 4 %, Kupfer 3 % | 2100 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Sattelauflieger-Chassis | Stahlschrott | — (gilt als sortenrein) | 2400 | 250 | STAHLSCHROTT | Bau `fahrgestell` (Zweckfarbe) |
| Minibagger (ausgeschlachtet) | Mischschrott | Stahlschrott 86 %, Kunststoff 6 %, Kupfer 4 %, Baumischabfall 4 % | 2500 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Vibrationswalze (Bandage) | Stahlschrott | — (gilt als sortenrein) | 2200 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Turmdrehkran-Ausleger | Stahlschrott | — (gilt als sortenrein) | 1200 | 250 | STAHLSCHROTT | Bau `gitterturm` (Zweckfarbe) |
| Kranballast-Platten | Baumischabfall | — (gilt als sortenrein) | 2400 | -40 | MUELL / ABFALL | Bau `beton` (Zweckfarbe) |
| Betonmischer-Trommel | Stahlschrott | — (gilt als sortenrein) | 1500 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Baustellencontainer | Mischschrott | Stahlschrott 68 %, Kunststoff 16 %, Holz 12 %, Aluminium 4 % | 1900 | 160 | MISCHSCHROTT | Bau `container` (Zweckfarbe) |
| Hohlkammerdecke (Element) | Baumischabfall | — (gilt als sortenrein) | 2500 | -40 | MUELL / ABFALL | Bau `beton` (Zweckfarbe) |
| Rolltreppen-Segment | Stahlschrott | — (gilt als sortenrein) | 2400 | 250 | STAHLSCHROTT | Bau `gitterturm` (Zweckfarbe) |
| Tankstellen-Erdtank | Stahlschrott | — (gilt als sortenrein) | 1800 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Kleinflugzeug (komplett) | Mischschrott | Aluminium 72 %, Stahlschrott 14 %, Kunststoff 8 %, Baumischabfall 6 % | 900 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Strahltriebwerk (ausgebaut) | Mischschrott | Stahlschrott 58 %, Aluminium 34 %, Edelstahl VA 8 % | 1900 | 160 | MISCHSCHROTT | Bau `tank` (Zweckfarbe) |
| Rangierlok (ausgeschlachtet) | Mischschrott | Stahlschrott 84 %, Kupfer 8 %, Aluminium 4 %, Kunststoff 4 % | 2600 | 160 | MISCHSCHROTT | Bau `karosserie` (Zweckfarbe) |
| Diesellok-Motorblock | Mischschrott | Stahlschrott 82 %, Aluminium 14 %, Kupfer 4 % | 2500 | 160 | MISCHSCHROTT | Bau `motor` (Zweckfarbe) |
| Personenwaggon-Kasten | Mischschrott | Stahlschrott 76 %, Aluminium 8 %, Kunststoff 10 %, Baumischabfall 6 % | 2300 | 160 | MISCHSCHROTT | Bau `container` (Zweckfarbe) |
| Güterwaggon-Boden | Stahlschrott | — (gilt als sortenrein) | 2200 | 250 | STAHLSCHROTT | Bau `fahrgestell` (Zweckfarbe) |
| Kesselwagen-Kessel | Stahlschrott | — (gilt als sortenrein) | 2000 | 250 | STAHLSCHROTT | Bau `tank` (Zweckfarbe) |
| Straßenbahn-Wagenkasten | Mischschrott | Stahlschrott 70 %, Aluminium 12 %, Kunststoff 12 %, Baumischabfall 6 % | 2100 | 160 | MISCHSCHROTT | Bau `container` (Zweckfarbe) |
| U-Bahn-Drehgestell (angetrieben) | Stahlschrott | — (gilt als sortenrein) | 2600 | 250 | STAHLSCHROTT | Bau `achse` (Zweckfarbe) |
| Seecontainer 20 Fuß | Stahlschrott | Stahlschrott 95 %, Holz 5 % | 2200 | 250 | STAHLSCHROTT | Bau `container` (Zweckfarbe) |
| Kühlcontainer | Mischschrott | Stahlschrott 72 %, Kunststoff 18 %, Kupfer 6 %, Aluminium 4 % | 2500 | 160 | MISCHSCHROTT | Bau `container` (Zweckfarbe) |
| Bürocontainer | Mischschrott | Stahlschrott 70 %, Kunststoff 15 %, Holz 10 %, Aluminium 5 % | 2400 | 160 | MISCHSCHROTT | Bau `container` (Zweckfarbe) |
| Werkstattcontainer | Mischschrott | Stahlschrott 74 %, Kunststoff 12 %, Holz 10 %, Aluminium 4 % | 2500 | 160 | MISCHSCHROTT | Bau `container` (Zweckfarbe) |
| Schiffsmotor (Diesel) | Mischschrott | Stahlschrott 84 %, Aluminium 10 %, Kupfer 6 % | 2600 | 160 | MISCHSCHROTT | Bau `motor` (Zweckfarbe) |


---

## Nachtrag 16.09.2026 — „Störstoff" ist aufgelöst (E-077)

Diese Bestandsaufnahme ist vom 15.09.2026. Drei ihrer Zahlen sind seither
absichtlich überholt; sie stehen hier nachgetragen, damit niemand aus der
Tabelle oben einen falschen Schluss zieht.

1. **Der Katalog ist von 313 auf 327 Einträge gewachsen.** Vierzehn neue
   Gegenstände: acht Baumischabfall, vier Reifen, zwei Holz — alle in der
   **Kleinteil-Klasse**, weil nur aus ihr eine gewöhnliche Anlieferung zieht.
   Baumischabfall hatte dort **null** Gegenstände, obwohl die Tabelle sieben
   Betonteile zeigt: die stehen alle in den Groß- und Riesenklassen.

2. **Die Farbe trägt die Fraktion jetzt auch bei Abfall.** Abschnitt „Die Farbe
   trägt die Fraktion nicht" gilt weiter für Stahl und Mischschrott (ΔE 8,8
   und 6,0 zum Bauton — dieselbe Farbe). Für Holz (14,2), Baumischabfall
   (15,2), Kunststoff (20,0) und Reifen (21,5) gilt er nicht mehr: `metallton`
   führt die vier seit dem 16.09. Ein Lattenrost-Stapel ist braun, ein
   Reifenstapel schwarz.

3. **Reifen konnten bis dahin nicht angeliefert werden.** Der Fraktionsmix in
   `randomCargo` kannte nur `wood`, `plastic` und `rubble`. Das war eine dritte
   getippte Fassung derselben Vierergruppe, die es auch in `catalog.ts` und in
   `schuettdichte.ts` gab — genau die Fehlerklasse aus Abschnitt W. Jetzt gibt
   es **eine** Liste (`ABFALLFRAKTIONEN` in `catalog.ts`), und
   `test/abfall.test.ts` hält sie mit allen anderen Stellen zusammen.

**Nicht angefasst:** Die Befunde W-1 bis W-10 (Schild und Kasse rechnen
verschieden), insbesondere **W-9** — gemischter Abfall kostet weiter weniger
Gebühr als sortenreiner. Das ist Geldrechnung, und die steht in
`docs/offene-punkte.md` als eigener, noch nicht freigegebener Punkt.

---

## Nachtrag 17.09.2026 — der Kreislauf ist aufgemacht, W-1 bis W-10 nachgemessen (E-094)

Patrick hat am 17.09.2026 die Wirtschaft freigegeben ("Kreislauf ganz aufmachen").
Damit ist E-016 in seinem zweiten Teil erfuellt. Zuerst wurden alle zehn
Befunde gegen den heutigen Stand nachgemessen (`tools/kassensturz.ts`), erst
danach geaendert.

### Was von den zehn Befunden noch stimmte

| Nr. | Stand 17.09. vor der Reparatur | nach E-094 |
|---|---|---|
| W-1 | **bestaetigt** — BUNT+VA in einem Zug: Schild 1742,00 EUR, Kasse 20,00 EUR (Faktor 87) | Kasse 127,78 EUR; die Mulde ist Durchgang, ihr Schild nennt den SORTIERTEN Wert, und der ist ueber die vier Silos auf den Cent erreichbar (1742,00 EUR) |
| W-2 | **bestaetigt** — dieselbe Fuhre ohne VA: Schild 1602,00 EUR, ueber drei Silos 437,50 EUR, in einem Zug 28,80 EUR | ueber die Silos 1602,00 EUR = Schild; in einem Zug 184,00 EUR |
| W-3 | **bestaetigt** — KUPFER-LAGER: Schild 1150,00 EUR, Kasse 180,00 EUR | beide 1150,00 EUR |
| W-4 | **bestaetigt** — ALU-LAGER: Schild 232,00 EUR, Kasse 37,50 EUR | beide 232,00 EUR |
| W-5 | **bestaetigt** — MUELL: Schild -17,00 EUR, Kasse -0,25 EUR | beide -17,00 EUR |
| W-6 | **bestaetigt** — Stahlhalde: Schild 16,00 EUR, Kasse 34,56 EUR | mit Bestellung "Stahl" beide 16,00 EUR; ohne Bestellung kauft der Abnehmer Mischschrott, und 34,56 EUR sind dafuer der richtige Preis. Bleibt als Unterschied stehen, absichtlich |
| W-7 | **bestaetigt, und der Kommentar ist weiter falsch** — er verspricht den Kupferpreis fuer alles; die Kasse nahm die schwerste Fraktion | Jede Fraktion zu ihrem eigenen Preis. Der Kommentar in `containers.ts:96-99` beschreibt jetzt die Sache von der anderen Seite falsch und gehoert nachgezogen (offener Punkt) |
| W-8 | **bestaetigt** — Muldenschild 100 %, Ladeanzeige 50 % fuer dieselben 200 kg | Die Kasse meldet jetzt 100 %. Die Ladeanzeige in `main.ts:1439-1441` zaehlt weiter nur die bestellte Fraktion — offener Punkt, eine Zeile |
| W-9 | **bestaetigt** — vier Abfallsorten gemischt: -0,25 EUR statt -17,00 EUR | behoben, gemischt kostet dasselbe wie getrennt |
| W-10 | **bestaetigt** — dieselbe Fuhre 28,80 EUR oder 6,00 EUR, je nach Greifreihenfolge | behoben, in beiden Faellen 184,00 EUR |

Alle zehn galten also noch. Sechs sind zu, zwei bleiben absichtlich stehen
(W-1/W-2 und W-6), zwei sind Anzeige- und Kommentararbeit ausserhalb dieses
Pakets (W-7, W-8).

### Welche Rechnung die massgebliche wurde — und warum

**Das Schild.** Nicht, weil es freundlicher ist, sondern weil drei Quellen es
sagen:

1. `docs/02_Briefing.md` Kap. 9/10: "Erloes = Inhalt x Verkaufspreis x
   **Reinheit²**". Das rechnet das Schild. Die Kasse rechnete Reinheit hoch
   drei — ein Kommentar ohne Quelle ("Hoch drei spreizt das deutlicher").
2. **E-091 hat dieselbe Frage an der Presse schon entschieden**, und zwar
   zugunsten der Fraktionen: "Der Unterschied ist der zwischen 'woraus ist das
   gemacht' und 'wohin gehoert das'. ... danach sortiert der Spieler, danach
   rechnet das Muldenschild, danach bestellt der Abholer." Die Kasse war die
   letzte Stelle, die noch die Rohstoffe las.
3. **Der Ankaufspreis haengt daran.** 0,16 EUR/kg Ankauf ist genau der
   Verkaufspreis von Mischschrott — "wer nur Mischschrott macht, arbeitet fuer
   null" (Abschnitt 1.4). Das geht nur auf, wenn ein Kuehlschrank als 55 kg
   Mischschrott abgerechnet wird (8,80 EUR). Ueber die Rohstoffe brachte er
   1,93 EUR, also 0,035 EUR/kg: Der Spieler machte bei jedem Verbundteil
   Verlust, ohne dass das je jemand entschieden haette.

Die Behauptung "die Kasse ist ehrlicher, weil ein Kuehlschrank wirklich aus
Blech, Kupfer und Kunststoff besteht" haelt dem Code nicht stand: Die Kasse
rechnete **nicht** je Stoff zum eigenen Preis. Sie nahm die schwerste Fraktion
und zahlte alles zu DEREN Preis — Kupfer zum Messingpreis, wenn mehr Messing
dabei war. Ehrlich je Stoff rechnet nur das Schild
(`containerValueGemischt`).

### Die Sammelmulden

Was zusammen abgerechnet wird, steht in **der Silo-Reihe** (`lager: true` +
`mitFraktionen` in `containers.ts`) — keine zweite Liste,
`economy/fraktionsgruppen.ts` fragt nur nach. Gruppen heute: KUPFER-LAGER
{Kupfer, Messing}, ALU-LAGER {Alu, Zink}, KABEL {Kabel}, VA {VA}, BATTERIEN
{Batterien}, ABFALL {Baumischabfall, Reifen, Holz, Kunststoff}. Stahl und
Mischschrott haben kein Silo und stehen fuer sich.

**Warum die Silos und nicht die Mulden am Bagger:** Die BUNT+VA-Mulde fasst
sieben Fraktionen, ist aber ausdruecklich "Durchgang, nicht Abrechnung"
(E-028) — Lambert traegt jedes Stueck in das Silo seiner Fraktion. Wuerde die
Abrechnung auch sie lesen, haenge alles Nichteisen in einer Gruppe, und eine in
einem Zug gekippte Buntmulde braechte 1742 statt 127,78 EUR.

### Was das am Verdienst verschiebt

Gemessen ueber **96 Tage a 12 Fuhren** (`tools/kassensturz.ts`), dieselben
Ladungen fuer beide Rechnungen, 21,3 t Umschlag je Tag:

| | alt | neu |
|---|---:|---:|
| Erloes, je Mulde sortiert verladen | 8378 EUR/Tag | 9178 EUR/Tag |
| Erloes, je Fraktion einzeln verladen | 8785 EUR/Tag | 9178 EUR/Tag |
| Erloes, gar nicht sortiert | 1333 EUR/Tag | 1154 EUR/Tag |
| Ankauf | -3410 EUR/Tag | -3410 EUR/Tag |
| **Verdienst (sortiert)** | **4968 EUR/Tag** | **5768 EUR/Tag** |

Drei Wiederholungen: +14 % bis +16 % beim sortierenden Spieler, -11 % bis
-13 % beim unsortierten. Der Abstand zwischen sauber und schlampig waechst von
Faktor 6,3 auf 8,0. **Kein Preis, kein Reinheitsexponent und kein Startkapital
wurde geaendert** — das ist allein die Folge der richtigen Buchfuehrung.

Neu ist ausserdem eine Eigenschaft, die vorher fehlte: Es ist jetzt **gleich,
ob man je Fraktion oder je Mulde verlaedt** (beide 9178 EUR/Tag). Vorher
kostete das Zusammenlegen 407 EUR am Tag.

### getBaleBonus: verdrahtet, nicht geloescht

`press.getBaleBonus` wurde in `main.ts:713` auf 1,6 gesetzt und **nirgends
gelesen** — der Ausbau "Groessere Presse" (42.000 EUR) tat nachweislich
nichts. Loeschen ging nicht ohne eine Aenderung in `main.ts`; verdrahtet ist er
deshalb als das, was im Kaufmenue steht: **"Schwerere Pakete, mehr Ladung je
Abholung"**, also auf die **Pressdichte** und nicht aufs Geld.

1,6 auf die Dichte macht dasselbe Paket 37,5 % kleiner (jede Kante -14,5 %),
also passt rund die 1,6-fache Masse auf denselben Abholer. Ein Geldfaktor waere
eine Preisaenderung ohne Quelle gewesen und haette ausserdem dem Kaufmenue
widersprochen. **Am Erloes je Kilogramm aendert sich nichts**, und weil der
Ausbau erst ab 160 t Umschlag angeboten wird, aendert sich an einem fruehen Tag
gar nichts.

### Ein Nebenbefund, der dabei herauskam

Die Umstellung haette **E-091 wieder aufgemacht**, wenn sie fuer sich geblieben
waere: Ein Presspaket aus 64 kg Kupfer und 217 kg Messing heisst "Mischschrott"
(keine Fraktion hat 95 %) und waere auf 44,96 EUR statt 1393,90 EUR gefallen —
Pressen haette wieder Sortierarbeit vernichtet. Ein Paket ist eben kein Stueck,
sondern ein **Buendel**. Es traegt darum seit E-094 zwei Listen:

* `composition` — woraus es gemacht ist (Farbflecken, wirtschaftliche Masse),
* `fraktionsmix` — welche Fraktionen hineingingen (das Geld).

Beide haengen an der FORM und ueberstehen damit den Spielstand (dieselbe
Loesung wie E-092). Der Erloes ist vor und nach dem Zuschlagen wieder auf den
Cent derselbe (`test/presspaket.test.ts`).

### Was NICHT entschieden wurde

* **Ob der +16-%-Sprung bleiben soll.** Das ist Balancing und damit Patricks
  Entscheidung. Hier ist nur die Buchfuehrung repariert; kein Preis wurde
  angefasst.
* **Was das Schild einer Durchgangsmulde zeigen soll** — den sortierten Wert
  (heute 1742 EUR) oder den, den ein Abkippen in einem Zug braechte
  (127,78 EUR). Beides ist vertretbar; heute steht der sortierte Wert da.
* **W-7 und W-8**: der Kommentar in `containers.ts:96-99` und die Ladeanzeige
  in `main.ts:1439-1441`. Beide Dateien gehoeren anderen.
