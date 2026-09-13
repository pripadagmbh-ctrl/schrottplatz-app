# Fünfschalengreifer — modulares, animierbares Modell

Hydraulischer Mehrschalengreifer nach der Explosionszeichnung
„5-Schalen-Mehrschalengreifer, 1.200 Liter". Jede Position der Zeichnung ist
ein eigenes Objekt mit eigenem Pivot; die Bewegung ist gerechnet, nicht
gesetzt.

| | |
|---|---|
| **Datei** | `prototype/src/greifer/greifer-mehrschalen.glb` (glTF 2.0, binär)<br>ausgeliefert als `assets/greifer-mehrschalen-<hash>.glb` |
| **Größe** | 1.230 kB · 263 Meshes · 12.864 Dreiecke |
| **Einheit** | Meter, Y oben, rechtshändig (glTF-Standard) |
| **Abmessungen** | geschlossen 1,78 × 2,40 m · offen 2,30 m Spitzenweite (2,52 m Hüllkreis) |
| **Ursprung** | Aufhängepunkt am Stiel |
| **Quelle** | `src/grapple/teile.ts` (Positionen + Kinematik) · `src/grapple/rig.ts` (Zusammenbau) |
| **Neu erzeugen** | `npx vite-node tools/greifer-export.ts` |
| **Ansehen** | `npm run dev`, dann `http://localhost:5173/greifer.html` |

---

## 1. Woher die Form kommt

Nichts daran ist geschätzt. Die Positionsliste nennt für die Schale ein
Hüllmaß von 1.200 × 300 mm. Als Bogenlänge gelesen geht die Rechnung nicht
auf; als Hüllmaß entlang der eigenen Sehne — so misst man ein gebogenes Blech —
bleibt genau eine Lösung übrig: **sechs Abschnitte à 230 mm, 17,5° Krümmung je
Abschnitt**, Krümmungsradius 753 mm. Hüllmaß daraus: 1,199 × 0,296 m.

Dieser Bogen hebt über seine sechs Abschnitte **0,8295 m nach außen** und
0,8665 m nach unten. Sitzt der Drehpunkt am OBEREN Ende der Schale, liegt im
geschlossenen Zustand genau dieser Bogen zwischen dem Äquator und der Spitze
auf der Achse — die fünf Schalen bilden eine Halbkugel von 0,83 m Radius.

> Deren Inhalt: **1.195 Liter.** Die Positionsliste führt den Greifer mit
> 1.200 Liter.

Das ist die Probe, die die ganze Form trägt: Aus einem Maß der Schale folgt
das Volumen des Greifers, und es trifft. `test/greifer.test.ts` rechnet es bei
jedem Lauf nach.

Daraus wiederum folgt alles Übrige — nicht hineingerechnet, sondern
herausgekommen:

| | gerechnet | Positionsliste |
|---|---|---|
| Gesamthöhe | 2,400 m | 2.400 mm |
| Spitzenweite offen | 2,30 m | 2.300 mm |
| Schalenbreite oben | 0,400 m | 400 mm |
| Inhalt geschlossen | 1.195 l | 1.200 l |

## 2. Die Form der Schale

Zwei Regeln, beide geprüft:

1. **Der Radius wächst nach unten nirgends.** Er fällt von Station zu Station
   um `ABSCHNITT · sin(θ − Schwenk)`. Nicht-positiv ist das genau dann, wenn
   der geschlossene Anschlag den Anstellwinkel der obersten Station nicht
   übersteigt — deshalb ist der Anschlag `ZU = 0°`. Geschlossen ist die
   Silhouette damit eine Glocke, aus der unten der Kegel des Stempels als
   halbe Abrissbirne herausschaut.

2. **Die Breite wächst nach unten nirgends.** Oben die vollen 400 mm der
   Positionsliste, dann stetig fallend bis 112 mm an der Spitze:

   | Station | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
   |---|---|---|---|---|---|---|---|
   | Breite (m) | 0,400 | 0,384 | 0,350 | 0,305 | 0,249 | 0,185 | 0,112 |

   Zwei Grenzen wirken zusammen: die Form und der Platz (fünf Schalen teilen
   sich den Kreis, jede hat 72°). Der Platzdeckel ist für sich genommen NICHT
   monoton — nahe der Achse beißt er, weiter unten geht er wieder auf. Darum
   nimmt `schalenHalbbreite` das **laufende Minimum** über alle Stationen bis
   k. Das ist die Zusage, dass die Kontur nur schmaler wird.

   Die Greiferspitze leitet ihre Breite aus derselben Funktion ab und kann
   deshalb nicht über die Schale hinausstehen. Sie ist EIN Gussteil mit
   durchgehend 112 mm Breite — nur die Dicke fällt von 99 auf 54 mm, die
   Formschräge eines Gussteils. Unten läuft sie stumpf aus: drei flache Wellen
   von 10 mm als Kantenschutz, keine Schneide.

## 3. Hierarchie

Die Nummern sind die der Positionsliste.

```
GRAPPLE_ROOT                        Ursprung = Aufhängepunkt am Stiel
├── 01_AUFHAENGUNG              01  Adapter, dreht NICHT mit
└── ROTATOR                         ◀── Drehachse Y
    ├── 02_ROTATOR              02  Drehwerk mit Motor
    ├── 03_DREHWERKSGEHAEUSE    03
    ├── GRAPPLE_HEAD            04  Mitteltraverse, trägt 04_ZYLINDERAUFNAHME_01..05
    ├── 09_STEMPEL              09  zentrale untere Gelenkeinheit
    │                               trägt 10_AUSLEGER_nn + 10_SCHALENANBINDUNG_nn
    ├── SHELL_01 … SHELL_05         ◀── Pivot = Stempelauge, Achse X
    │   ├── SHELL_BODY_nn       06  Greiferschale (Haut, Wangen, Naben)
    │   └── SHELL_TIP_nn        07  Greiferspitze (ein Gussteil, 07_ZAHN)
    └── CYLINDER_01 … _05           ◀── Pivot = oberer Zylinderanschluss, Achse X
        ├── CYL_BARREL_nn       05  Gehäuse
        └── CYL_ROD_nn              Kolbenstange
            ├── CYL_ROD_SHAFT_nn    Stab — wird gedehnt
            └── CYL_ROD_EYE_nn      Auge — sitzt auf dem Bolzen der Schale
```

## 4. Welches Objekt welche Bewegung führt

| Objekt | Kanal | Bewegung |
|---|---|---|
| `ROTATOR` | `rotation.y` | Endlosdrehung des ganzen Greifers |
| `SHELL_01..05` | `rotation.x` | Öffnen und Schließen, 0° … 65° |
| `CYLINDER_01..05` | `rotation.x` | Neigung des Zylinders, folgt der Schale |
| `CYL_ROD_SHAFT_nn` | `scale.y`, `position.y` | Auszug der Kolbenstange |
| `CYL_ROD_EYE_nn` | `position.y` | Stangenauge, bleibt auf dem Bolzen |

Alles andere ist starr. `01_AUFHAENGUNG` hängt bewusst an der Wurzel und NICHT
am Rotator — der Adapter bleibt am Stiel stehen, während sich der Greifer
darunter dreht.

**Clips:** `OEFFNEN`, `SCHLIESSEN`, `GREIFEN`, `HEBEN`, `DREHEN` sowie die drei
Standbilder `POSE_ZU`, `POSE_HALB`, `POSE_OFFEN`.

## 5. Mechanik

Das Verbindungsprinzip der Zeichnung, Stück für Stück:

```
Oberer Zylinderanschluss   an der Mitteltraverse      r 0,35 m, y −0,86 m
Hydraulikzylinder          dazwischen                 0,48 … 0,75 m
Obere Schalenanbindung     am Zylinder                Drehpunktframe y +0,10, z +0,24
Greiferschale
Untere Schalenanbindung    am Stempel                 r 0,59 m, y −1,5335 m
Greiferspitze              an der Schale
```

Jede Schale hat damit genau EINEN Drehpunkt — oben am Äquator, am Stempel —
und wird vom Zylinder geschoben. Ein Winkelhebel.

| | |
|---|---|
| Hub | 264 mm |
| Kleinster Hebelarm | 144 mm — kein Totpunkt über den ganzen Weg |
| Neigung | höchstens 41° gegen die Senkrechte |
| Kraftrichtung | fährt zum **Schließen aus**, also mit voller Kolbenfläche |
| Schließmoment | 1,7-mal das Öffnungsmoment |

## 6. Was geprüft wird

`test/greifer.test.ts`, 19 Prüfungen. Die, auf die es ankommt:

- **Sektorfreiheit:** Jede Schale hat 72°. An 21 Stellungen wird für JEDEN
  Eckpunkt aller Schalenteile geprüft, dass er im eigenen Sektor bleibt — dann
  können sich die Schalen nicht durchdringen. Diese Prüfung hat die meisten
  Fehler gefunden, und keiner davon war im Bild zu sehen.
- **Kontur:** Breite und Radius wachsen nach unten nirgends; die Spitze steht
  nicht über die Schale hinaus.
- **Inhalt:** 1.200 Liter aus der Bogengeometrie.
- **Zylinder:** Hub, Länge, Neigung, Hebelarm, Kraftrichtung, und dass das
  Stangenauge über den ganzen Weg auf seinem Bolzen sitzt.
- **Export:** Das GLB wird nach dem Schreiben neu geladen, die Animation
  abgespielt und nachgemessen. Ein Clip, dessen Spuren sich nicht bewegen,
  lässt den Lauf fehlschlagen.

## 7. Im Spiel

Seit dem 13.09.2026 trägt der Bagger diesen Greifer. `src/excavator/clawGeometry.ts`
leitet Mittellinie, Anschläge und Bolzenkreis aus `src/grapple/teile.ts` ab, statt
eigene Zahlen zu führen; `src/excavator/grappleParts.ts` setzt die Bauteile für das
Spiel zusammen. Die frühere Sichelkralle liegt unter `docs/archiv/spinne-sichel/`.

Was sich damit im Spiel ändert:

| | Sichel (alt) | Fünfschalen (neu) |
|---|---|---|
| Spitzenweite offen | 3,38 m | 2,30 m |
| Breite geschlossen | 1,51 m | 1,78 m |
| Bauhöhe | 2,14 m | 2,49 m |

Der Greifer nimmt einen kleineren Biss. Nachgemessen an den 44 Schrottsorten
passt jede noch zwischen die Spitzen: die sperrigste hat 1,90 m in der mittleren
Kante (Waggon-Drehgestell, LKW-Fahrerhaus).

## 8. Bilder

| Datei | Inhalt |
|---|---|
| `docs/greifer.png` | Gesamtansicht geschlossen / halb / offen |
| `docs/greiferschale.png` | die Schale allein, Seite / vorn / schräg |
| `docs/greifer-teile.svg` | Positionsblatt, alle acht Teile |
| `docs/greifer-mehrschalen.svg` | Zusammenbau mit Hüllmaßen |
| `docs/greifer-silhouette.svg` | Silhouetten über den Öffnungsweg |
