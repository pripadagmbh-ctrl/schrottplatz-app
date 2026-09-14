# Messprotokoll 14.09.2026 — Fünfschalengreifer als Vorschaumodell

**Was gemessen wurde:** die Form, die am 13.09.2026 mit Commit `f3c3c52` abgelegt und am
14.09. in die Vorschauseite zurückgeholt wurde — Bauart eines Fünfschalen-Mehrschalengreifers,
Schalenform HO. Vier Fragen standen an: Ist der Zahn auf sein Sollmaß 120 × 250 × 80 mm
gekommen? Was hat das Kürzen von Mitteltraverse und Stempel in Litern gebracht? Steckt der
Vorzeichenfehler der Sichelkralle (E-007) auch in dieser Form? Und passt der Greifer
überhaupt zwischen die Wände des Platzes?

**Womit:** zwei unabhängige Durchgänge über `baueGreifer()` aus `src/fuenfschalen/rig.ts`.
Der erste vom Fachagenten und vom Orchestrator während des Baus, der zweite von der QA am
14.09. mit einem eigenen Wegwerf-Skript — 21 Stützstellen Öffnung 0,00 … 1,00 in Schritten
von 0,05, alle Mesh-Eckpunkte in Weltlage, dazu eine eigene Volumenrechnung. Die Zahlen des
Platzes stammen aus den gebauten Kollidern in `src/world/containers.ts` und
`src/world/press.ts`, nicht aus dem Feld `size` der Konfiguration — das ist der Unterschied,
auf den es hier ankommt.

**Kein Gerätetest.** Das hier ist eine Rechnung am Modell. Wie sich der Greifer auf dem Glas
dreht und ob die Form Patrick gefällt, steht weiter offen — siehe unten.

**Wer, wo, womit.** Gerechnet auf dem Entwicklungsrechner (Windows, Node, Vitest 2.1.9),
headless, ohne Browser. Zweig `v1/start`, Basis-Commit `d252de0` („Doku auf den M1-Stand:
E-008 nachgetragen, README von Prototyp auf v1") plus Arbeitsstand im Baum. Die QA hat die
fett gesetzten Zahlen selbst nachgerechnet; wo ihr Ergebnis abweicht, stehen unten **beide**
Werte, nicht der glattere.

**Was hier nicht gemessen wurde:** fps, Frame-Zeiten, Physik-Zeiten, Draw Calls, Heap,
Verhalten auf iPad oder iPhone mini. Ebenfalls nicht von der QA gegengerechnet sind
Nettokorb, Einfüllquerschnitt und freie Maulfläche (Netz-gegen-Netz-Rechnungen des
Fachagenten, Abschnitt 2) sowie die Reichweitenzahlen an der Presskammer in Abschnitt 8
(Greiferursprung y 3,40, Spitzen 1,06 m über Grund) — diese Zahlen stehen auf einem
Durchgang und tragen die Handschrift dessen, der sie gemessen hat.

---

## 1 Der Zahn — Aufgabe „120 × 250 × 80 mm"

| Maß | vorher | nachher | Soll | von der QA nachgemessen |
|---|---|---|---|---|
| Breite | 72 mm | **120 mm** | 120 | 120,0 mm ✓ |
| Länge | 249 mm | **252 mm** | 250 | 251,8 mm ✓ |
| Tiefe (Hüllmaß) | 71 mm | **83 mm** | 80 | 83,2 mm ✓ |
| Endquerschnitt | 41 × 11 mm | 74 × 20 mm | — | nicht einzeln gemessen |
| Breite des Schalenendes | 84 mm | 120 mm | — | 120,0 mm ✓ |

Gemessen ist das Hüllmaß von `07_GREIFERSPITZE` im eigenen Frame (`THREE.Box3` über das
gebaute Netz).

**Die Tiefe ist ein Hüllmaß, kein Querschnitt.** Von den 83,2 mm sind 44,2 mm Biegepfeilhöhe
— der Zahn ist 250 mm lang und auf Biegeradius 0,70 m gebogen, also fällt sein Ende um
`R · (1 − cos(L/R))` von der Tangente weg — und 39,0 mm sind die wirkliche Querschnittshöhe
(vorher 27 mm). Wer die 83 mm für einen Querschnitt hält, hält den Zahn für doppelt so dick,
wie er ist.

### Warum er vorher 72 mm breit war — zwei Fehler übereinander

1. **Sinus statt Tangens.** Der Sektordeckel in `schalenHalbbreite` rechnete mit
   `sin(0,9 · 36°) = 0,536`, wo die Geometrie `tan(36°) = 0,727` verlangt. Ein Punkt mit
   Abstand r von der Drehachse und b quer zur Schalenmitte belegt `atan(b/r)` des Sektors,
   nicht `asin(b/r)`. Das ist ein Viertel zu wenig.
2. **Am falschen Ort angewandt.** Der Deckel wurde im **geschlossenen** Zustand gezogen, wo
   die Bahn an der Spitze nur 68 mm von der Achse steht — genau die achsnahe Zone, die schon
   der Sektortest der Sichelkralle ausnimmt (`test/greifer.test.ts`, „bleibt in jeder
   Stellung im eigenen Sektor": `if (r < 0.3) continue`, mit der Begründung „am Gerät
   schieben sie sich dort aneinander vorbei"). Dieselbe Grenze heißt in
   `src/fuenfschalen/teile.ts` jetzt `SEKTOR_AB` und gilt aus demselben Grund.

### Die Messung, die die 120 mm trägt

| Größe | Wert | QA |
|---|---|---|
| Sektor je Schale (halb) | 36,0° | ✓ |
| Zahnfuß, engster Abstand zur Achse außerhalb der Zone | r = 0,308 m | ✓ |
| dort rechnerisch zulässige Breite `2 · 0,30 · tan 36°` | 436 mm | 435,9 mm ✓ |
| vom Zahn wirklich genutzt | **11,2° von 36°** (vorher 6,9°) | 11,24° ✓ |
| Luft bis zur Sektorgrenze | 24,8° | 24,76° ✓ |
| von der Schale ohne Zahn genutzt | **21,8° von 36°** | 21,77° ✓ |
| engste Stelle der Schale | Station 0, r = 0,445 (`06_UNTERE_ANBINDUNG`) | ✓ |

Die engste Zahnstelle liegt bei Öffnung 0,15, r = 0,308 m. **Die 120 mm sind also nicht das
kollisionsfreie Maximum, sondern das Sollmaß der Positionsliste** — rechnerisch passten
436 mm. Der Deckel war falsch gerechnet, nicht zu eng. Und weil die Schale selbst 21,8°
belegt, bindet dort ihre Breite und nicht der Sektor.

**Preis:** Die Zone, in der sich die fünf Zinken geschlossen überlappen, reicht von r = 0,188
auf **r = 0,194 m** hinaus. Sechs Millimeter, und sie liegen innerhalb von `SEKTOR_AB`.
QA: 0,1936 m ✓.

---

## 2 Mitteltraverse und Stempel — „belege es in Litern"

**Methode.** Bruttokorb = Rotationskörper der geschlossenen Schalen-Mittellinie unterhalb der
Bolzenebene y = −1,5335, in 4.000 waagerechten Scheiben integriert; r läuft von 0,890 m am
Äquator auf 0,061 m an der Spitze bei y = −2,400. Die Abzüge Netz gegen Netz: 2-cm-Raster
über denselben Raum, Strahlparität gegen die Dreiecke von Stempel und Traverse.
Einfüllquerschnitt und Maulfläche mit demselben Paritätstest in einer Ebene bzw. als
Schattenwurf nach unten.

| Größe | vorher | nachher |
|---|---|---|
| Bruttokorb | 1.615 l | 1.615 l (die Bahn ist unverändert) |
| Mittelsäule **im Korb** | 26,4 l (1,6 %) | **16,8 l (1,0 %)** |
| **Nettokorb** | 1.588 l | **1.598 l** |
| Einfüllquerschnitt Äquator +5 cm (engste Stelle), fest | 0,464 m² | **0,382 m² (−18 %)** |
| dito frei (von 2,488 m²) | 2,022 m² | 2,105 m² |
| Einfüllquerschnitt Äquator +1 cm, fest | 0,436 m² | 0,355 m² |
| freie Maulfläche offen (Schattenwurf) | 0,655 m² (8,3 %) | 0,605 m² (7,5 %) |
| Mitteltraverse | 0,75 × 0,55 × 0,40 (gebaut 0,488 hoch) | **Ø 0,70 × 0,40** (gebaut 0,448; Liste 0,45) |
| Stempel | 0,60 × 0,50 × 0,35 | **Ø 0,46 × 0,26** |
| Zylinderhub / Länge zu / Länge offen | 0,439 / 0,979 / 0,540 m | unverändert |

QA-Gegenrechnung: Äquatorradius 0,8900 m, Spitze 0,0605 m bei y = −2,4000, Bolzenebene
y = −1,5335 — alle drei zeichengleich. Zylinder 0,9794 m zu, 0,5405 m offen, Hub 0,4389 m ✓.
Nettokorb, Einfüllquerschnitt und Maulfläche sind **nicht** gegengerechnet.

### Der Befund, der die Überschrift verdient

Patricks Eindruck stimmt — aber nicht für den Korb. **Die Mittelsäule nahm dem Korb fast
nichts weg:** 26 l von 1.615, denn unter die Bolzenebene ragen nur Ausleger und Gabeln. Sie
verengte den **Schlund**. Knapp ein Fünftel dessen, was oben hineinfällt, stand auf Eisen;
das ist jetzt um 18 % gekürzt.

Weiter geht es nicht ohne die Anlenkung. Was jetzt noch im Schlund steht, sind zu zwei
Dritteln die fünf Ausleger, und die müssen bis `STEMPEL_AUGE.r = 0,59` hinaus, weil dort die
Schalen drehen.

### Zwei Korrekturen am Archivstand

**Der Dateikopf nannte 1.195 l Bruttokorb — falsch, es sind 1.615 l.** Der Korb ist keine
Halbkugel von 0,83 m Radius: Am Äquator steht die Bahn auf r = 0,890 (die 0,8295 sind der Hub
nach außen, der Spitzenradius kommt dazu), und der Kreisbogen wölbt sich über die Kugel
hinaus. Zum Vergleich: Eine Halbkugel von 0,83 m fasst 1.197,5 l — das ist die Zahl, die im
Kopf stand. Die 1.200 l der Positionsliste sind der **Nenninhalt**; fünf Schalen von 400 mm
decken am Äquator nur gut ein Drittel des Umfangs ab, der Rest ist offen.

**Die Traverse stand im Code anders als in der Positionsliste derselben Datei** — 0,75 × 0,55
× 0,40 gegen Ø 0,70 × 0,45. Jetzt steht sie auf ihrem Listenmaß.

### Der zweite Durchgang widerspricht hier um 31 Liter

Die QA kommt auf **1.614,7 l**, wenn sie die sieben groben Stationen von `mittellinie(ZU)`
als Sehnenzug integriert — das bestätigt die 1.615 l auf zwei Stellen. Integriert sie
dieselbe Bahn als den **Kreisbogen**, auf dem das Netz wirklich sitzt (`feineStationen`,
2.401 Stützstellen), kommt sie auf **1.646,1 l**, also 31 l oder 1,9 % mehr.

Beide Zahlen sind richtig, sie messen zwei verschiedene Körper: Der Sehnenzug ist das
einbeschriebene Vieleck, der Bogen die gebaute Schale. Wo 1.615 l steht, ist deshalb
„Sehnenzug über die sieben Stationen" gemeint. Die Größenordnung des Befunds ändert das
nicht — 26 l Säule sind auch von 1.646 l nur 1,6 %.

Unangetastet sind `ZYLINDER_AUFNAHME`, `STEMPEL_AUGE`, `OBERE_ANBINDUNG`, `DREHPUNKT`, `ZU`,
`OFFEN`, `ABSCHNITT` und `SCHALEN_BOGEN` — der Formvertrag.

---

## 3 Das Vorzeichen aus dem Zapfen-Umbau

Am 14.09. kam an der Sichelkralle heraus, dass Rig und Bagger den Gelenkpunkt um
`−(Spreizung − ZU)` statt um `−Spreizung` drehten (`docs/messungen/2026-09-14_greifer-anlenkung.md`,
E-007).

**In dieser Form steckt der Fehler nicht.** `rig.setOeffnung` dreht um `−schwenk`,
`mittellinie` und `anbindungspunkt` rechnen mit `cos(−schwenk)/sin(−schwenk)`, und mit
`rotation.order = "YXZ"` bildet der Szenengraph denselben Punkt ab wie die Rechnung. Nichts
zu beheben.

Der Wächter steht trotzdem — `test/fuenfschalen.test.ts`, „zeichnet die Schale dort, wo
mittellinie sie rechnet": 21 Öffnungsgrade × 5 Schalen × 7 Stationen, Weltlage gegen
`mittellinie(schwenkFuer(t))`, Schranke 2 mm, größte Abweichung heute **unter 0,1 mm**.

**Die Probe, dass er fängt.** `−schwenk` wurde testweise durch `−(schwenk − ZU) − 0.3`
ersetzt; der Wächter meldete „303,5 mm daneben bei Schale 2, Station 6, Öffnung 0.95". Danach
zurückgenommen, alle 14 Tests wieder grün.

Der Grund, warum er hier gebraucht wird, obwohl nichts kaputt ist: Diese Form hat `ZU = 0`.
Genau dann sind `−schwenk` und `−(schwenk − ZU)` dasselbe, der Fehler wäre also unsichtbar —
bis jemand `ZU` anfasst. Der Wächter vergleicht deshalb nicht Winkel mit Winkel, sondern die
Weltlage mit der Bahn, auf der Hüllmaß, Wölbung und Volumen gerechnet werden.

---

## 4 Hüllmaße am fertigen Modell

| Maß | Fünfschalengreifer | QA | Sichelkralle (im Spiel) |
|---|---|---|---|
| Spitzenweite offen | **2,94 m** | 2,9365 m ✓ | 3,3805 m |
| **größter Durchmesser über den ganzen Öffnungsweg** | **3,227 m** (Öffnung 1,00, y = −1,878) | 3,2265 m ✓ | 3,3805 m |
| Hüllkreis geschlossen | 2,20 m | **2,1945 m** | 1,2967 m |
| Bauhöhe geschlossen / offen | 2,51 / 2,21 m | 2,5054 / 2,2099 m ✓ | Spitzentiefe 2,3413 m |
| Spitzenweite geschlossen | 0,10 m | 0,0995 m ✓ | < 0,05 m (0,0015 m) |

Der größte Durchmesser wächst streng monoton: 2,195 m geschlossen → 3,227 m offen, geprüft an
allen 21 Stützstellen. QA: bestätigt, kein Rücklauf.

**Maßgeblich für „passt er in die Mulde" ist der größte Durchmesser über den ganzen Weg,
nicht die Spitzenweite.** Bei der Sichelkralle sind beide Zahlen dieselbe, weil ihr weitester
Punkt die Spitze ist; bei Schalen, die sich beim Öffnen nach außen wickeln, liegt der
weiteste Punkt im Bogen und nicht am Ende. Wer nur die Spitzen misst, misst 2,94 statt
3,227 m — 29 cm zu wenig.

### Zwei Zahlen, bei denen die QA genauer hinsieht

**„Spitzenweite" heißt in den beiden Spalten nicht dasselbe.** Die 2,94 m sind der größte
Abstand zweier der fünf Zahnspitzen zueinander — bei fünf Zinken stehen sich keine zwei
gegenüber, die weiteste Verbindung überspannt 144°, also `2 · r · sin 72°`. Die 3,3805 m der
Sichelkralle kommen aus `clawSpan` (`src/excavator/clawGeometry.ts:123`) und sind `2 · r`,
ein Durchmesser. Gleich gemessen wären es:

| Konvention | Fünfschalen | Sichelkralle |
|---|---|---|
| Durchmesser `2 · r` der Spitze, offen | 3,088 m | 3,3805 m |
| größter Spitzenabstand (Sehne über 144°) | 2,937 m | 3,215 m |

Die Rangfolge kippt dadurch nicht, das Urteil bleibt. Aber die Zeile „2,94 gegen 3,38" liest
sich um 15 cm günstiger, als sie ist, und sollte nicht ohne diese Fußnote weitergereicht
werden.

**Der Hüllkreis geschlossen ist 2,1945 m, nicht 2,20 m.** Nach oben gerundet, wo sonst
abgeschnitten wird — hier ohne Folgen, weil kein Behälter daran hängt.

---

## 5 Der Platz, gemessen an den gebauten Kollidern

| Behälter | lichte Gasse | Luft je Seite bei 3,227 m | Luft je Seite bei 3,3805 m | Datei:Zeile |
|---|---|---|---|---|
| Presskammer (Z, das engere Maß) | 4,05 m | 41 cm | 33,5 cm | `src/world/press.ts:94, 120, 123` |
| `r_alu`, `r_copper` | 4,05 m | 41 cm | 33,5 cm | `src/world/containers.ts:320–321, 326–327` |
| `r_va`, `r_cable` | **3,50 m** | **13,7 cm** | **6 cm** | `src/world/containers.ts:322–325` |
| `r_rubble` (Schutt) | 4,00 m | 38,7 cm | 31 cm | `src/world/containers.ts:188–189` |
| Lagermulden, die beiden Reihenenden | 4,05 m | 41 cm | 33,5 cm | `src/world/containers.ts:358–359, 372–373` |
| Lagermulden, die sechs mittleren | 3,90 m | 33,7 cm | 26 cm | `src/world/containers.ts:360–371` |
| Presskammer Länge X (frei, Stempel in Ruhe) | 5,39 m | bindet nicht | bindet nicht | `src/world/press.ts:129, 358` |

Presskammer weiter: lichte Höhe 1,90 m (`WALL_H`), Wandoberkante 2,20 m über Grund,
**kein Trichter** — die Kammer ist oben offen, die Einwurffläche ist die volle 5,95 × 4,05 m.

Die QA hat diese Tabelle nicht mit Rapier nachgestellt, sondern die Kollidergeometrie aus dem
Quelltext nachgerechnet: Betonlegostein `BLOCK_T = 0,55 m` (`containers.ts:705`), Flanken- und
Rückwandkollider bei `±(d/2 + BLOCK_T/2)` mit halber Dicke `BLOCK_T/2`, Achsabstand der
Sortierboxen 4,60 m, der Lagermulden 4,60 m bei 4,20 m Front. Ergebnis 4,05 / 3,50 / 3,50 /
4,05 für die vier Sortierboxen und 4,05 / 3,90 für die Lagermulden — zeichengleich. Der freie
Pressweg: `RAM_HOME_X = 2,625`, Stempeldicke `0,3 · 1,4 = 0,42`, Stempelfläche damit bei
2,415, Westwand bei −2,975 → 5,39 m.

### Das Urteil

**Der Fünfschalengreifer ist an jeder Stelle des Platzes schmaler als die heutige
Sichelkralle.** Er passt überall dorthin, wo sie heute passt, mit rund 8 cm mehr Luft je
Seite. Kein Behälter und keine Presse muss für ihn geändert werden.

Die Hausregel „30 cm Luft je Seite" (`test/spinnenmass.test.ts:23`) wird in `r_va` und
`r_cable` von **beiden** Greifern verfehlt — von der Sichelkralle deutlicher (6 cm gegen
13,7 cm). Das ist ein Platzbefund, kein Greiferbefund.

### Warum `r_va` und `r_cable` enger sind, als `CONFIGS` sagt

Jede Steinreihe steht **außerhalb** des Nennmaßes: `placeBlock(..., ±(d/2 + BLOCK_T/2))`
(`src/world/containers.ts:759–760`), der Stein spannt also von `d/2` nach außen bis
`d/2 + 0,55`. Der Achsabstand der Reihe ist aber genau `d`. Damit steht die Wand des Nachbarn
0,55 m **in** der Mulde.

`shareSouth` nimmt zwar die Steine heraus, **nicht aber den Kollider** (`:799–808`, siehe
Befund 3 unten) — gerechnet wird deshalb gegen die Kollider. Jede geteilte Seite kostet
0,55 m; bei zwei geteilten Seiten sind es 1,10 m, und aus 4,60 m Nennmaß werden 3,50 m real.
`shareEast` (E-006) ändert dagegen nur Steine und Hinderniseintrag, nicht die nutzbare
Breite. `test/spinnenmass.test.ts` rechnet mit dem Nennmaß und merkt davon nichts.

---

## 6 Prüfkette

- `npm test` in `v1/`: **29 Dateien, 272 Tests grün, 25,07 s** (255 bestehende unverändert,
  dazu 3 aus `test/schalenform.test.ts` und 14 aus `test/fuenfschalen.test.ts`).
- `npm run build`: grün (`tsc --noEmit` und `vite build`, 8,93 s).
- `test/schalenform.test.ts` kam **unverändert** aus dem Archiv zurück und blieb grün, auch
  als der Zahn von 72 auf 120 mm wuchs. Kein Wächter wurde aufgeweicht, übersprungen oder in
  seiner Erwartung geändert.
- Aus dem Archiv kamen **nur** `teile.ts` und `rig.ts` zurück. `clawGeometry.ts` und
  `grappleParts.ts` — die gespielte Spinne — bleiben liegen.
- Netzgröße des Vorschaumodells: **322 Meshes, 13.424 Dreiecke** (QA nachgezählt ✓).
- GLB: `src/greifer/fuenfschalen.glb`, im Build `dist/assets/fuenfschalen-8uJHWn9F.glb`.

---

## 7 Befunde der QA aus diesem Durchgang

Kein Blocker. Die Wächter sind grün, Build und Tests laufen, kein Test wurde aufgeweicht, das
gespielte Spiel ist unverändert. Vier Stellen bleiben offen.

| # | Schwere | Ort | Was | Vorschlag | Zuständig |
|---|---|---|---|---|---|
| 1 | Wichtig | `src/greifer/fuenfschalen.glb` | Die Übergabe nennt das GLB mit **1.161,63 kB**. Gemessen sind **1.273.176 Bytes**, der Build meldet 1.273,18 kB. Gegen die Sichelkralle (320.212 Bytes) ist das Faktor **3,98**, nicht 3,5. Die Datei wurde am 14.09. um 17:58 neu exportiert; die kleinere Zahl stammt aus einem früheren Export | Die Zahl in der Übergabe auf 1.273 kB ziehen und den Faktor als „knapp viermal" führen. Am Urteil ändert sich nichts: für eine Vorschauseite auf dem iPad geht das, für den Dauerbetrieb im Spiel nicht | `orchestrator` |
| 2 | Wichtig | Übergabetabelle „Hüllmaße", Zeile „Spitzenweite offen" | Die 2,94 m (Fünfschalen) sind der größte **Spitzenabstand** über 144°, die 3,3805 m (Sichelkralle) sind `clawSpan` = **2 · r**. Zwei Konventionen in einer Zeile; gleich gemessen wären es 3,088 gegen 3,3805 bzw. 2,937 gegen 3,215 | Zeile mit der Konvention beschriften oder streichen — maßgeblich ist ohnehin der größte Durchmesser, und der ist in beiden Spalten `2 · r` | `orchestrator` |
| 3 | Wichtig (Testlücke) | `src/world/containers.ts:799–808, 811–819`; `src/world/obstacles.ts:166–169` | Die Kollider folgen den Steinen nicht: Flankenkollider entstehen trotz `shareSouth`/`shareNorth`, der Rückwandkollider trotz `shareEast` (3,00 m hoch, steinlos, bei x −7,75 … −7,20 zwischen Bagger und Mulde), und `bayObstacles` trägt die Nordwand des Schuttcontainers ein, obwohl dort keine Steine stehen. Kein Test merkt das — genau dieser Fehlertyp hat am 13.09. an der Presse einen halben Tag gekostet | Eigener Auftrag „Kollider den Steinen nachziehen" samt Wächter „wo kein Stein steht, sperrt auch nichts". **Nicht in diesem Paket** | `welt`, Wächter durch `qa` |
| 4 | Hinweis | `src/fuenfschalen/teile.ts:259` | „in 4.000 Scheiben: 1.615 Liter" ist der **Sehnenzug** über die sieben Stationen. Der Kreisbogen, auf dem das Netz sitzt, fasst 1.646,1 l — 31 l oder 1,9 % mehr. Beide Zahlen sind richtig, die Herkunft steht aber nicht dabei (Regel 3) | Halbsatz ergänzen: „als Sehnenzug über die sieben Stationen; über den Kreisbogen 1.646 l" | `bagger` |

Zusätzlich nicht gegengerechnet und daher auf **einem** Durchgang stehend: Nettokorb
(1.598 l), Einfüllquerschnitt (0,382 m²), freie Maulfläche (0,605 m²). Wer an Stempel,
Traverse oder Auslegern dreht, muss diese drei neu messen.

---

## 8 Was offen bleibt

**1 — Zylinderneigung und Hebelarm verfehlen die Zielwerte der Sichelkralle.** Gemessen
**38,90° bei 40 % Öffnung** (Ziel < 20°) und **0,0924 m Hebelarm ganz offen** (Ziel > 0,10 m);
QA bestätigt beide auf vier Stellen. Das ist **vor wie nach dem Umbau identisch**,
gegengerechnet an der Archivfassung — Ursache ist allein die Anlenkung
(`ZYLINDER_AUFNAHME` r 0,34 / y −0,73, `STEMPEL_AUGE` r 0,59, `OBERE_ANBINDUNG` z 0,31), also
der Formvertrag. Die beiden Wächter in `test/fuenfschalen.test.ts` stehen deshalb auf dem
**gemessenen** Stand (< 39°, > 0,09 m) mit der Begründung im Test: Sie halten fest, dass
nichts schlechter wird, sie behaupten nicht, dass es gut ist. Erfüllt sind: Ausfahren zum
Schließen, Hub 0,4389 m (> 0,15), Länge immer größer als das Rohr (0,42 m).
**Patrick entscheidet**, ob die Zylinderaufnahme nach außen rücken soll — das wäre eine
Änderung am Formvertrag mit eigener Abnahme.

**2 — Die Presse ist heute nicht ausräumbar.** Sie steht als **ein volles Rechteck** in der
Hindernisliste (`src/world/obstacles.ts:247–254`, `top: 2.2`), anders als die Mulden, die dort
nur ihre Wände eintragen. Der Greiferursprung wird über der ganzen Kammer bei y 3,40
gestoppt; die offenen Spitzen kommen auf 1,06 m über Grund, also 0,76 m über dem
Kammerboden. **Mit keinem Greifer, egal welcher Breite, erreicht man den Pressenboden.** Der
Befund vom 12.09. („bei der Presse kam ich nicht an den Boden") wurde damals mit einer
breiteren Kammer beantwortet; die Ursache sitzt hier. Eigener Auftrag.

**3 — Vier unsichtbare Wände.** Siehe Befund 3 oben.

**4 — Das GLB ist knapp viermal so groß wie das der Sichelkralle** (1.273 kB gegen 320 kB),
322 Meshes, 13.424 Dreiecke. Für eine Vorschauseite auf dem iPad geht das; für den
Dauerbetrieb im Spiel wäre es zu viel. Falls der Bagger die Form je tragen soll, vorher Nähte
und Hülsen ausdünnen.

**5 — Nicht in diesem Paket:** der Bodenanschlag der Sichelkralle. `CLAW_MAX_DEPTH` misst bis
zum Ende der Krallenkette, der gezeichnete Zahnkegel in `src/excavator/grappleParts.ts:248`
reicht 10 cm tiefer, die äußersten Noppen verschwinden im Beton. Eigener Schritt.

---

## 9 Auf dem Gerät zu prüfen

Offen. Diese Messung ist eine Rechnung, kein Gerätetest. Die Handgriffe für iPad und
iPhone mini stehen bei E-009 im Log; ihr Ergebnis gehört als eigenes Protokoll hierher,
sobald Patrick den Greifer gedreht hat.
