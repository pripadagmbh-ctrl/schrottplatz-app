# Baggerkonzept — Teileliste zur Zeichnung vom 14.09.2026

Zeichnung: `docs/baggerkonzept-2026-09-14.svg` (erzeugt mit `node tools/baggerkonzept.mjs`).
Vorbild: **SENNEBOGEN 840 E**, Umschlagbagger auf Rädern, Vierpunkt-Abstützung,
hochfahrbare Kabine, Zweiteiler-Ausleger.

Anlass — Patrick am 14.09.2026:

> „Der Bagger soll als zentrales Element auch mehr Detailtiefe bekommen. Jetzt
> aktuell ist es auch Playmobil like samt Fahrer. Auch da die Zylinder, wie man
> das aufbauen könnte, die Reifen, die sind nicht so richtig erkennbar. Also die
> LKW sind manchmal besser detailliert als der Bagger selbst."

**Hier wird nichts gebaut.** Das ist der Entwurf zum Abnicken am Bild (E-016:
erst zeichnen, dann bauen). Die vier Entscheidungen stehen ganz unten.

---

## 1 — Der überraschende Befund: der Bagger hat schon mehr Teile als ein LKW

Gemessen am 14.09.2026, kopflos:

| | Netze | Dreiecke | Zeichenrufe |
|---|---|---|---|
| **Bagger** (ohne Spinne), `npx vite-node tools/baggerteile.ts` | **137** | 15 420 | rund 194 |
| Kipper, `npx vite-node tools/lkw-teile.ts` | 79 | 2 460 | 102 |
| Pritsche mit Rungen | 88 | 2 568 | 120 |
| Pritsche mit Ladekran | 102 | 2 816 | 138 |
| PKW mit Anhänger | 55 | 1 928 | 71 |

Der Bagger hat also **1,3- bis 2,5-mal so viele Teile wie ein LKW und sechsmal
so viele Dreiecke** — und wirkt trotzdem ärmer. Das Problem ist nicht die Menge,
sondern **wo die Teile sitzen**:

- **4 648 Dreiecke** (30 % der ganzen Maschine) stecken im **Fahrer**, weitere
  **3 192** in Joysticks und Unterarmen. Zusammen **51 % der Dreiecke** in einer
  Figur, die in der Außenansicht so groß ist wie eine Hand.
- Die **tragenden Teile** dagegen sind nackte Quader mit je **12 Dreiecken**:
  Unterwagen 12, Ausleger 12, Stiel 12, Motorhaube 12, Gegengewicht 12,
  Räumschildblatt 12. Der ganze Oberwagen kommt auf **120 Dreiecke** — weniger
  als ein einzelner Fingernagel des Fahrers.
- Der LKW hat dagegen Stoßstange, Kühlergrill mit Lamellen, Scheinwerfer,
  **Außenspiegel auf Auslegern**, Türfuge und Griff, Tritte, Auspuffrohr,
  Dachleuchten, Tank, Werkzeugkasten, **Kotflügel mit Spritzlappen**,
  Unterfahrschutz, Rückleuchten (`src/delivery/vehicleModel.ts`). Der Bagger hat
  **nichts davon** — kein Licht, keinen Spiegel, keinen Auspuff, keinen
  Handlauf, keinen Aufstieg, keinen Kotflügel.

Daraus folgt der ganze Entwurf: **Detail dorthin, wo die Maschine groß im Bild
steht, und die Netze dort einsparen, wo heute Teile verschwendet werden.**

## 2 — Die Budgetregel, und warum sie hier nichts kostet

Gemessen auf Patricks Gerät am 14.09.2026:
`FPS 48 · Frame 21,0 ms · Zeichenrufe 1322 · 240k Dreiecke · Physik 0,5 ms · Bild 5,9 ms`

> **Dreiecke sind fast gratis, NETZE sind teuer.** Jedes schattenwerfende Netz
> wird zweimal gezeichnet und kostet zwei Zeichenrufe.

Die Machart dafür steht schon im Haus — in `src/excavator/wheelParts.ts`
(Räder, 14.09.2026, von Patrick abgenommen: „räder in ordnung"). Sie wird hier
eins zu eins übernommen:

> **EIN NETZ JE STARRKÖRPER UND WERKSTOFF.**
> Was sich nicht gegeneinander bewegt und dieselbe Farbe hat, wird mit
> `mergeGeometries` zu EINER Geometrie verschmolzen.

Genau so ist der Reifen gebaut: Karkasse **plus 32 Stollen** = **ein** Netz mit
768 Dreiecken. Als 33 Einzelteile wären es 33 Netze gewesen.

Die Folge ist die eigentliche Nachricht dieses Konzepts:

| | heute | morgen | Differenz |
|---|---|---|---|
| Einzelteile | 157 | **309** | **+152** |
| **Netze** | 137 | **57** | **−80** |
| Zeichenrufe | rund 194 | **rund 82** | **−112** |
| Dreiecke | 15 420 | rund 34 000 | +18 600 (+8 % des Gerätebildes) |

**Der Bagger bekommt doppelt so viele Teile und kostet dabei 112 Zeichenrufe
weniger.** Der Richtwert des Auftrags („höchstens 12 zusätzliche Netze") wird
nicht ausgereizt, sondern in die andere Richtung unterschritten.

Die 80 gesparten Netze sind kein Trick, sondern das Aufräumen von etwas, das nie
absichtlich so gebaut wurde: 16 Netze für einen Fahrer, der sich nie bewegt;
8 Netze für acht Lüftungsschlitze in einer Haube; 16 Netze für vier
Abstützpratzen, deren Teile immer gemeinsam ausfahren.

---

## 3 — Teileliste nach Baugruppen

Spalten: **Teile** = benannte Einzelstücke (gleichartige Wiederholungen wie „32
Stollen" zählen als eins). **Netze** = Meshes und damit Zeichenrufe.
„beweglich" heißt: hat eine eigene Bewegung gegen sein Elternteil.

### 01 — Unterwagen (Baugruppe 01) · 25 Teile · **2 Netze**

| Nr | Teil | Bauform | beweglich |
|---|---|---|---|
| 01.1 | Hauptrahmen, Kastenträger 1,50 × 0,60 × 4,40, y 1,00–1,60 | Quader, an den Enden verjüngt | nein |
| 01.1 | Seitenwangen links/rechts, x ±1,14…1,20, **y 1,24–1,60** | zwei Platten | nein |
| 01.1 | Rahmensicken (3 Längssicken je Wange) | flache Quader | nein |
| 01.2 | Achsbrücke vorn und hinten, 2,20 × 0,30 × 0,42, Mitte y 0,72 | Quader | nein |
| 01.3 | Achsschenkel/Lenkkopf vorn (2 ×), 0,24 × 0,34 × 0,24 bei x ±1,00 | Quader | **ja** (dreht mit der Lenkung) |
| 01.4 | Kotflügel (4 ×), Innenradius 0,70 um die Radmitte, 0,58 breit, 25°–155° | Bogenband, 12 Segmente | nein |
| 01.5 | Aufstieg rechts vorn: 3 Stufen 0,28 × 0,05 | Quader | nein |
| 01.5 | Handlauf vom Trittblech zum Deck | Rohr, 8 Segmente | nein |
| 01.6 | Kraftstofftank links unter dem Rahmen, 0,95 × 0,42 × 1,20 | Quader mit Fase | nein |
| 01.6 | Tankstutzen mit Deckel | Zylinder | nein |
| 01.7 | Werkzeugkasten rechts, 0,72 × 0,40 × 0,60, mit Deckel und Verschluss | Quader | nein |
| 01.8 | Abschleppösen vorn und hinten | Platte mit Bohrung | nein |
| 01.9 | Unterfahrschutz hinten | Quader | nein |
| 04.1 | Drehkranzring d 1,70, h 0,18, y 1,60–1,78 | Zylinderring, 24 Segmente | nein |
| 04.2 | Zahnkranz (36 Zähne) am Drehkranz | 36 kleine Quader, verschmolzen | nein |
| 04.3 | Schraubenkreis (24 Köpfe) | Sechskant-Zylinder | nein |
| 03.1 | Pratzenausleger (4 ×), quer heraus bis x ±1,80 | Quader | nein |

**2 Netze:** `01_UNTERWAGEN_LACK` (grün: Rahmen, Wangen, Kotflügel, Tank) und
`01_UNTERWAGEN_STAHL` (anthrazit: Achsbrücken, Drehkranz, Zahnkranz, Aufstieg,
Handlauf, Werkzeugkasten, Ösen, Pratzenausleger).
*Heute: 1 Netz (ein Quader 2,4 × 0,9 × 4,4).*

### 01x — Räumschild (bewegliche Gruppe) · 16 Teile · **2 Netze**

Blatt, Schneide, zwei Seitenwangen, zwei Streben, zwei Zylinderrohre, zwei
Kolbenstangen, vier Augen, zwei Bolzen. Alles ohne Relativbewegung
untereinander → ein Netz anthrazit, ein Netz blanker Stahl (die Schneide).
*Heute: 10 Netze.*

### 02 — Räder (4 ×) · 32 Teile · **12 Netze** — unverändert

Reifen (Karkasse + 32 Stollen), Felge (Bett, Innendeckel, Scheibe, 10 Muttern),
Nabe (Flansch, Kappe). **Form, Größe, Material und Kollider bleiben, wie sie
sind** — sie wurden am 14.09. abgenommen.

**Neu ist nur die Bewegung, und sie kostet kein Netz:**
- Alle vier Räder **rollen** beim Fahren (Winkel = Fahrstrecke ÷ 0,62 m).
- Die **Vorderräder lenken mit** (Ausschlag proportional zur Gierrate,
  gedeckelt auf 32° — der Wert, aus dem in `excavator.ts` der Wenderadius von
  4,57 m gerechnet wird).

### 03 — Abstützung (4 Pratzen) · 28 Teile · **8 Netze**

Je Pratze: Kasten, Stempel, Tellerfuß, zwei Lagerböcke, Bolzen, zwei
Schlauchstücke. Der Fuß fährt als Gruppe aus, die Teile bewegen sich nicht
gegeneinander → **je Fuß 2 Netze** (anthrazit + blanker Stempel).
Die Pratzenausleger sind fest und wandern in das Unterwagen-Netz.
*Heute: 16 Netze (4 Ausleger + 4 × 3).*

### 04 — Drehkranz · 4 Teile · **0 eigene Netze**

Ring, Zahnkranz, Schraubenkreis, Deckel. Der Ring gehört zum Unterwagen, der
Deckel zum Oberwagen — beide verschmelzen dort hinein.
Heute ist „`04_DREHKRANZ`" in Wahrheit die Deckplatte des Oberwagens; ein
sichtbarer Drehkranz existiert nicht. **Er ist am Vorbild das, woran man einen
Bagger erkennt, wenn er sich dreht.**
*Heute: 1 Netz.*

### 05 — Oberwagen · 29 Teile · **3 Netze**

| Nr | Teil | Bauform | beweglich |
|---|---|---|---|
| 05.1 | Oberwagenrahmen mit Laufblech und Sicken | Quader + flache Rippen | nein |
| 05.2 | Motorhaube, **gestuft** (unten 0,72 hoch, oben 1,00), mit Wartungsklappe, Scharnieren, Verschluss | Quader | nein |
| 05.2 | Lüftungsgitter (2 Felder à 5 Lamellen), Kühlergitter hinten | dünne Quader, verschmolzen | nein |
| 05.3 | Gegengewicht, gegossen, mit Fase und Griffleiste, Typenschild | Polyeder | nein |
| 05.4 | **Umlaufendes Geländer** um das Heckdeck: Handlauf 0,90 hoch, Knieleiste, 6 Pfosten | Rohre, 8 Segmente | nein |
| 05.5 | Auspuffrohr mit Regenkappe | Zylinder | nein |
| 05.6 | Hydrauliktank und Ölkühler seitlich | Quader | nein |
| 05.7 | Arbeitsscheinwerfer hinten (2 ×), Rückleuchten (2 ×) | Quader, leuchtendes Material | nein |

**3 Netze:** Lack (grün), Stahl (anthrazit, inkl. Geländer und Auspuff),
Leuchten. *Heute: 10 Netze (Haube, 8 Schlitze, Gegengewicht).*

Das **Geländer** ist der teuerste Einzelposten in Dreiecken (rund 3 000) und der
billigste in Netzen (null — es liegt im Stahl-Netz). Es ist zugleich das, was
eine Umschlagmaschine von einem Spielzeugbagger unterscheidet.

### 06 — Kabine und Fahrer · 76 Teile · **11 Netze**

**Kabinenhubwerk (2 Netze, beweglich):**
06.1 Zwei Lenkerpaare (unten, oben) aus Kastenprofil mit Augen — jedes Paar
dreht gemeinsam, also ein Netz je Paar.

**Kabine (5 Netze, hebt mit):**

| Nr | Teil | Bauform |
|---|---|---|
| 06.3 | Bodenblech, Dach, 4 Säulen, Dachstrebe, Regenrinne | Quader |
| 06.3 | Türrahmen, 2 Scharniere, Türgriff, Trittstufe | Quader |
| 06.3 | 2 Spiegelarme mit Spiegeln, Scheibenwischer mit Blatt, Sonnenblende | Rohre + Platten |
| 06.3 | Konsolen links und rechts | Quader |
| 06.4 | Verglasung: Front, Heck, 2 Seiten, Fußscheibe, Dachscheibe | Quader, durchsichtig |
| 06.5 | Sitz, Lehne, Kopfstütze, 2 Armlehnen, Gurt | Quader/Kapsel |
| 06.6 | Bordinstrument: Rahmen (im Gerüst) + Bild (eigene Leinwand) | Platte mit Textur |

→ Netze: Gerüst-Lack, Gerüst-Stahl, Glas, Sitz, Displaybild.

**Joysticks (2 Netze, beweglich):** je Seite Faltenbalg (3 Wülste), Schaft,
Griff, Daumentaste, Wippe → **ein** Netz je Seite.
*Heute: 7 Netze je Seite.*

**Fahrerarme (2 Netze, hängen am Joystick):** Unterarm, Faust, Daumen,
Handschuhbund → ein Netz je Seite. *Heute: 3 je Seite.*

**06.10 Fahrer Daniel (2 Netze, fest im Sitz), 25 Teile:**
Kopf, Hals, Haar, **Mütze**, Rumpf, **Warnjacke mit zwei Reflexstreifen**,
Kragen, 2 Schultern, 2 Oberarme, Hüfte, 2 Oberschenkel, 2 Unterschenkel,
2 Stiefel → ein Netz Haut, ein Netz Kleidung.
*Heute: 16 Netze, 4 648 Dreiecke.*

`setFirstPerson` blendet heute eine Liste von Körperteilen aus. Mit zwei Netzen
wird daraus eine Liste von zwei Einträgen; die Unterarme an den Joysticks
bleiben sichtbar wie bisher. **Die Kabinenansicht ändert sich dadurch nicht.**

### 07 — Ausleger, Stiel, Zylinder · 87 Teile · **16 Netze**

**Ausleger (5 Netze, schwenkt), 23 Teile:** Kasten (verjüngt von 0,62 auf
0,44 m Höhe), 2 Aussteifungsrippen, 2 Fußlaschen mit Bolzen, 2 Kopflaschen mit
Bolzen, 2 Lagerböcke für den Stielzylinder, 2 Schläuche mit 4 Klemmschellen und
Bogen, 2 Logos, 2 Arbeitsscheinwerfer am Fuß.
→ Lack, Stahl, Schlauch, Logo, Leuchte. *Heute: 5 Netze (Kasten, 2 Logos,
2 Schläuche) — gleiche Zahl, sechsmal so viel Inhalt.*

**Stiel (3 Netze, schwenkt), 16 Teile:** Kasten (0,45 → 0,30), 2 Rippen,
2 Fußlaschen mit Bolzen, Greiferhalter (Gusskopf, 2 Laschen, Bolzen,
2 Scheiben, Anschlagpuffer), Schlauch mit 2 Schellen.
→ Lack, Stahl, Schlauch. *Heute: 8 Netze.*

**Hydraulikzylinder (8 Netze), 4 Stück à 12 Teile:**
2 × Hubzylinder, 1 × Stielzylinder, 1 × Kabinenhubzylinder.
Je Zylinder **zwei** Netze — Rohr und Stange, weil sie sich gegeneinander
bewegen. Aufbau siehe Tafel 3 der Zeichnung:

| | Teil | gehört zu |
|---|---|---|
| a | Bodenauge mit Kugelbuchse | Rohr-Netz |
| b | Zylinderrohr, 14 Umfangssegmente | Rohr-Netz |
| c | Führungskopf mit 6 Schraubenköpfen | Rohr-Netz |
| f | 2 Anschlussstutzen mit Kurzschläuchen | Rohr-Netz |
| d | Kolbenstange, blank | Stangen-Netz |
| e | Gabelkopf, Bolzen, Sicherungsblech | Stangen-Netz |
| | Lagerbock am Trägerteil | Netz des Trägerteils |

*Heute: 5 Zylinder à 2 Netze = 10.*

### 08 — Kleinteile · 2 Teile · **1 Netz**

Namensschild „BAGGERFAHRER — DANIEL" mit Rahmen (Leinwandtextur).
Die zwei Auslegerlogos wandern in ein gemeinsames Logo-Netz unter 07.

---

## 4 — Summe

| Baugruppe | Teile h. | Teile m. | Netze h. | Netze m. | Δ |
|---|---|---|---|---|---|
| 01 Unterwagen | 1 | 25 | 1 | 2 | +1 |
| 01 Räumschild | 10 | 16 | 10 | 2 | −8 |
| 02 Räder | 32 | 32 | 12 | 12 | 0 |
| 03 Abstützung | 16 | 28 | 16 | 8 | −8 |
| 04 Drehkranz | 1 | 4 | 1 | 0 | −1 |
| 05 Oberwagen | 10 | 29 | 10 | 3 | −7 |
| 06 Kabine | 27 | 51 | 27 | 7 | −20 |
| 06 Joysticks + Arme | 20 | 10 | 20 | 4 | −16 |
| 06 Fahrer | 16 | 25 | 16 | 2 | −14 |
| 07 Ausleger | 5 | 23 | 5 | 5 | 0 |
| 07 Stiel | 8 | 16 | 8 | 3 | −5 |
| 07 Zylinder | 10 | 48 | 10 | 8 | −2 |
| 08 Kleinteile | 1 | 2 | 1 | 1 | 0 |
| **Summe** | **157** | **309** | **137** | **57** | **−80** |

**Dreiecke:** 15 420 → geschätzt rund 34 000.
**Zeichenrufe:** rund 194 → rund 82.

Die Spalte „Dreiecke morgen" in der Zeichnung ist eine **Schätzung nach
Bauform**, keine Messung — sie wird beim Bau je Baugruppe nachgemessen und
zurückgemeldet.

---

## 5 — Was sich NICHT ändert

Nachgeschlagen, nicht vermutet:

| Maß | Wert | Quelle |
|---|---|---|
| Ausleger / Stiel | 5,20 / 4,00 m | `excavator.ts` `BOOM_LEN`, `STICK_LEN` |
| Auslegerdrehpunkt | y 2,95 · z 0,55 | `excavator.ts` `BOOM_PIVOT` |
| Schwenkband | innen 5,80 · außen 9,20 m | `world/baggerstand.ts:46` |
| Standplatz | (−0,5 \| −22,5) | `world/baggerstand.ts:27` |
| Größte Grabtiefe | 2,9995 m | `clawGeometry.ts` `CLAW_MAX_DEPTH` |
| Raddurchmesser / Breite | 1,24 / 0,50 m | `wheelParts.ts:40/42` |
| Radstand / Spur | 3,00 / 3,00 m | `RAD_ECKEN` |
| Unterwagen-Kollider | Quader 2,4 × 1,5 × 4,4, Mitte y 1,15 | `excavator.ts:1280` |
| Augpunkt Kabine | y 3,28, z 0,20 (Kabine unten) | `excavator.ts:1110` |
| Achsgrenzen | Ausleger 5°–70°, Stiel −140°…−25° | `excavator.ts` |
| Kabinenhub | 2,60 m, Vorlauf 0,34 × Hub | `excavator.ts:369`, `:2136` |

Auch **Spinne, Greifen, Pendel und Kamera** bleiben unberührt (Projektregel 2).
Die Spinne, der Fünfschalengreifer und das Kardangelenk zwischen Stielspitze und
Spinne gehören zu E-009/E-013 und stehen in diesem Konzept nur als Umriss.

---

## 6 — Die drei Dinge, die Patrick genannt hat

### a) „Die Zylinder, wie man das aufbauen könnte"

**Befund, gemessen** mit `npx vite-node tools/zylinderhub.ts` (neu):

| Zylinder | kürzester Ankerabstand | längster | Hub | Verhältnis |
|---|---|---|---|---|
| Hubzylinder R/L | 2,518 m | 3,757 m | 1,239 m | 1,49 |
| Stielzylinder | 1,809 m | 2,235 m | 0,426 m | 1,24 |
| **Kabinenhub A/B** | **0,650 m** | **3,368 m** | 2,718 m | **5,18** |

Drei Dinge fallen auf:

1. **Heute wird gestreckt statt geschoben.** `updateHydraulics` setzt
   `rod.scale.y`. Am Hubzylinder wächst die „Kolbenstange" damit von 0,97 auf
   2,21 m — **um 128 %**. Eine echte Kolbenstange hat eine feste Länge und taucht
   ins Rohr ein. Solange die Stange ein glattes Rohr ist, sieht man das kaum;
   sobald sie einen Gabelkopf bekommt, wird der Gabelkopf mitgestreckt und die
   Sache fällt auf.
   **Lösung, ohne ein Netz mehr:** Rohr und Stange behalten ihre Länge, die
   Stange wird nur **verschoben**. Rohr 2,30 m, Stange 1,81 m; bei kürzestem
   Abstand steht sie 0,11 m heraus, bei längstem 1,35 m — der Rest steckt im
   Rohr. Die Rechnung geht auf: 0,11 (Auge) + 2,30 (Rohr) + 0,11 = 2,52 m,
   genau der gemessene kürzeste Ankerabstand.
2. **Der Kabinenhub ist mechanisch nicht darstellbar.** Ein Verhältnis von
   5,18 : 1 kann kein einstufiger Zylinder. Heute ist das Rohr mit 1,10 m sogar
   **länger als der Abstand** (0,65 m) in der untersten Stellung — es steht durch
   den Kabinenboden. Auch die beiden „Parallelogramm-Lenker" sind heute keine:
   Ihr Abstand wächst von 0,65 auf 3,14 m, sie werden also gedehnt wie ein
   Gummiband.
   **Lösung:** ein echtes Parallelogramm (siehe Frage 3).
3. Der **Stielzylinder** ist unauffällig (1,24 : 1) und bleibt, wie er ist.

### b) „Die Reifen, die sind nicht so richtig erkennbar"

**Nicht das Rad ist schuld — der Einbau ist es.** Gemessen:

- Der Rahmen ist ein Quader 2,4 × 0,9 × 4,4 bei y 1,15 (`excavator.ts:667`),
  spannt also **y 0,70 bis 1,60** und **x −1,20 bis +1,20**.
- Ein Rad sitzt bei x ±1,25, Radius 0,62 (`excavator.ts:686`), spannt also
  **y 0,00 bis 1,24** und **x 1,00 bis 1,50**.
- Überschneidung: **die obersten 54 cm des 124 cm hohen Rades stecken im
  Rahmenkasten**, in der Breite 20 cm. Über 40 % der Radhöhe sind in einer Kiste
  versenkt, in die das Rad hineinragt wie ein Nagel in ein Brett.
- Es gibt **keinen Kotflügel, keine Achse, keinen Achsschenkel** — nichts, was
  das Rad mit der Maschine verbindet.
- Und: **kein Rad dreht sich jemals.** Im ganzen Quelltext gibt es keine Zeile,
  die eine Radgruppe rotiert. Bei 3,2 m/s Fahrtempo (E-012) rutscht die Maschine
  auf vier stillstehenden Rädern über den Platz.

**Lösung:** Die Seitenwange des Rahmens setzt mit ihrer Unterkante auf
**y 1,24** auf, also genau auf der Radoberkante; darunter tragen Achsbrücken
(y 0,47–0,77) den Rahmen zu den Rädern; darüber sitzt in der Wange der
Kotflügelbogen. Danach steckt kein Rad mehr im Rahmen. Die Räder rollen, die
vorderen lenken.
**Der Kollider bleibt unverändert** — er ist ohnehin größer als der sichtbare
Kasten (y 0,40–1,90) und war noch nie deckungsgleich mit ihm.

### c) „Playmobil like samt Fahrer"

Warum er wie eine Spielfigur wirkt — vier Gründe, alle in `driver.ts` ablesbar:

1. **Alles ist Kapsel oder Kugel.** Rumpf `CapsuleGeometry`, Schultern
   `SphereGeometry`, Hüfte, Ober- und Unterschenkel, Hals: Kapseln. Keine einzige
   Kante bricht die Silhouette.
2. **Der Kopf ist eine Kugel**, das Haar eine zweite Kugel darüber
   (`SphereGeometry(0.122)` mit `scale.y = 0.95`), dazu eine dritte im Nacken.
3. **Weißes Hemd (`0xf4f3ee`) und Jeans (`0x3d4b5c`)** — Freizeitkleidung. Wer
   eine Umschlagmaschine fährt, trägt Warnkleidung; die ist zugleich das einzige
   Farbsignal, das auf 15 m Entfernung noch lesbar ist.
4. Eine **Torus-Halskette**. Das ist Charakter, aber es ist auch das Detail, das
   ein Spielfigürchen ausmacht.

**Die kleinste Änderung, die das behebt** (in dieser Reihenfolge; jede einzeln
sichtbar):

- **a)** Warnjacke in Orange mit zwei weißen Reflexstreifen statt des Hemdes.
- **b)** Eckige Schultern und ein Kragen statt der Kapsel — ein Sechseck-Profil
  genügt, es bricht die Silhouette.
- **c)** Mütze statt Haarkugel, Lederband entfällt.

Das sind **drei Formen statt sechzehn**, und danach kostet er **2 Netze statt
16**. Der Rest (Beine, Stiefel, Arme) bleibt, wie er ist — von außen sieht man
ihn durch getöntes Glas.

---

## 7 — Bauweg, falls das Bild abgenommen wird

Acht Pakete, jedes einzeln auf dem iPad abzunehmen, jedes mit Messung vorher und
nachher (`tools/baggerteile.ts`). Reihenfolge nach Sichtbarkeit:

1. **Fahrer** (2 Netze) — die kleinste Änderung mit der größten Wirkung, und die
   einzige, die gar nichts an der Mechanik berührt.
2. **Unterwagen und Räder-Einbau** (Wange auf 1,24, Achsbrücken, Kotflügel,
   Aufstieg, Tank, Werkzeugkasten) + rollende und lenkende Räder.
3. **Oberwagen** (gestufte Haube, Geländer, Auspuff, Gegengewicht, Leuchten).
4. **Drehkranz** sichtbar machen.
5. **Zylinder** auf feste Längen umbauen, mit Augen, Führungskopf, Anschlüssen.
6. **Ausleger und Stiel** (verjüngt, Laschen, Schlauchpaket mit Schellen).
7. **Kabine** (Tür, Spiegel, Wischer, Glas als ein Netz).
8. **Kabinenhub** als echtes Parallelogramm — zuletzt, weil es als einziges
   Paket am Augpunkt der Kabinenkamera rührt.

Je Baugruppe entsteht ein eigenes Modul nach dem Vorbild von `wheelParts.ts`
(`unterwagenParts.ts`, `oberwagenParts.ts`, `kabinenParts.ts`, `armParts.ts`,
`zylinderParts.ts`) — eine benannte Funktion je Teil, am Ende ein
`mergeGeometries`. Damit bleibt jedes Teil im Quelltext auffindbar, obwohl im
Szenengraph nur noch das verschmolzene Netz steht. `test/baggerteile.test.ts`
bleibt grün: Die verschmolzenen Netze heißen weiter `NN_…`.

**`excavator.ts` wird dabei kleiner, nicht größer** — heute stehen rund 800 der
2 632 Zeilen im Modellbau.

---

## 8 — Am Bild zu entscheiden

Vier Fragen. Bei jeder steht die Empfehlung dabei, damit ein „ja" genügt.

### Frage 1 — Die Silhouette des Unterwagens

Heute ein glatter Kasten von 2,40 m Breite, in dem die Räder zur Hälfte
verschwinden. Vorschlag: schmaler Mittelträger (1,50 m), Seitenwangen mit
Kotflügelbogen ab 1,24 m Höhe, dazwischen sichtbare Achsbrücken — so, wie es
Tafel 4 rechts zeigt.

**Empfehlung: ja.** Das ist der Kern von „die Reifen sind nicht erkennbar", und
es kostet ein einziges zusätzliches Netz. Die Maschine wirkt dadurch höher und
schwerer, weil man unter ihr hindurchsieht.

### Frage 2 — Das umlaufende Geländer auf dem Oberwagen

Ein Handlauf 0,90 m hoch mit Knieleiste rund um das Heckdeck, dazu der Aufstieg
am Unterwagen. Am Vorbild ist das das auffälligste Merkmal; im Bild wird die
Maschine dadurch deutlich „technischer" und ein Stück unruhiger.

**Empfehlung: ja.** Es kostet **null zusätzliche Netze** (es liegt im
Stahl-Netz des Oberwagens) und rund 3 000 Dreiecke, also nichts. Wenn es Patrick
am Bild zu unruhig ist, lässt sich die Knieleiste streichen.

### Frage 3 — Der Kabinenhub: Parallelogramm oder schräge Hubsäule?

Heute werden Lenker und Zylinder gedehnt (Abstand 0,65 → 3,14 m). Zwei ehrliche
Bauformen:

- **A — Parallelogramm** wie bei der echten Maxcab: zwei Lenkerpaare von
  **1,88 m** Länge, Schwenkbereich −28° bis +66°. Endstellungen stimmen mit heute
  auf **rund 1 cm** überein; **auf halbem Weg** schwingt die Kabine aber bis zu
  **0,60 m** von der heutigen geraden Bahn ab (sie beschreibt einen Bogen).
- **B — Schräge Hubsäule**, 18,8° nach vorn geneigt, zweistufig ausfahrend:
  reproduziert die heutige gerade Bahn **exakt**, auch auf halbem Weg. Sieht aber
  eher nach Hochregalstapler aus als nach Sennebogen.

**Empfehlung: A (Parallelogramm).** Der Augpunkt der Kabinenkamera ist unten und
ganz oben unverändert; nur während des Hebens läuft die Kabine einen Bogen. Das
ist die Bewegung, die man an der echten Maschine sieht, und sie fühlt sich
schwerer an. **Ausdrücklicher Hinweis nach Regel 3: Das ist die einzige
Änderung im ganzen Konzept, die die Kabinenansicht berührt** — deshalb steht
sie als letztes Paket und wird allein abgenommen.

### Frage 4 — Der Fahrer: Warnjacke oder bleibt er privat?

Vorschlag: orange Warnjacke mit zwei Reflexstreifen, eckige Schultern, Mütze,
Lederband weg.

**Empfehlung: ja zu Jacke und Schultern, Mütze und Lederband nach Geschmack.**
Die Warnjacke ist das einzige, was auf Entfernung überhaupt zu sehen ist. Falls
Daniel als Figur ein Erkennungszeichen behalten soll, ist das Lederband
billiger zu behalten als die Haarkugel — es ist ein Ring, keine zweite Kugel.

---

## 9 — Zum Vorbild, ehrlich gesagt

Die **Form** kommt von der SENNEBOGEN 840 E: Radfahrwerk, Vierpunkt-Abstützung,
hochfahrbare Kabine, Zweiteiler-Ausleger mit Knick, hochgesetzter Oberwagen.

Das **Datenblatt** wird hier bewusst **nicht** zitiert. Unsere Maschine langt
9,2 m weit (`SCHWENK_AUSSEN`), eine echte 840 E deutlich weiter; unser Bagger
ist also eine verkürzte Fassung im Spielmaßstab. Alle Maße in dieser Liste
stammen daher **aus dem Bestand**, nicht aus einem Prospekt. Wo eine Zahl neu
ist (Kotflügelradius 0,70, Geländerhöhe 0,90, Drehkranzdurchmesser 1,70), ist
sie ein **Startwert nach Augenmaß am gezeichneten Riss** und im Quelltext später
mit `// SW:` zu kennzeichnen. **Ungemessen und daher nirgends behauptet:**
Betriebsgewicht, Motorleistung, Reifengröße und Reichweite des echten Vorbilds.
