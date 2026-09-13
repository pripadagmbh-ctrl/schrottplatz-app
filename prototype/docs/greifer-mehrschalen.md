# Mehrschalengreifer — modulares, animierbares Modell

Hydraulischer Fünfschalengreifer, halboffene Bauform (HO), nach SENNEBOGEN
MG4.1. Game-ready, mit Hierarchie, Pivots, PBR-Materialien, UVs und
Animationen.

| | |
|---|---|
| **Datei** | `docs/greifer-mehrschalen.glb` (glTF 2.0, binär) |
| **Größe** | 277 kB · 75 Meshes · 4720 Dreiecke |
| **Einheit** | Meter, Y oben, rechtshändig (glTF-Standard) |
| **Abmessungen** | geschlossen 2,06 × 2,65 m · offen 3,02 × 3,11 m |
| **Ursprung** | Kardangelenk oben, also der Punkt, an dem der Greifer am Stiel hängt |
| **Quelle** | `src/grapple/` — `form.ts` (Maße) · `parts.ts` (Bauteile) · `rig.ts` (Rig) |
| **Neu erzeugen** | `npx vite-node tools/greifer-export.ts` |
| **Ansehen** | `npm run dev`, dann `http://localhost:5173/greifer.html` |

---

## 1. Hierarchie

```
GRAPPLE_ROOT                       Ursprung = Aufhängepunkt am Stiel
├── ADAPTER                        Adapterplatte + Gabel, dreht NICHT mit
│   ├── ADAPTER_OHR_L / _R
│   ├── ADAPTER_BOLZEN
│   └── ADAPTER_PLATTE
└── ROTATOR                     ◀── Drehachse Y
    ├── ROTATOR_GEHAEUSE
    ├── ROTATOR_DREHKRANZ
    ├── ROTATOR_DURCHFUEHRUNG
    └── GRAPPLE_HEAD               Mitteltraverse, ein Gussteil
        ├── HEAD_GRUNDKOERPER       Gussblock mit Frästaschen + Zapfen, ein Netz
        ├── HEAD_ZAPFEN_DECKEL
        ├── HEAD_VENTILBLOCK        Ölverteiler unter dem Zapfen
        ├── HEAD_ZYLINDERBOLZEN_01…05
        ├── HEAD_LAGERBOCK_01…05    am untersten Ende des Zapfens
        ├── PIVOT_PIN_01…05         Gelenkbolzen (sichtbar, nicht beweglich)
        ├── HYDRAULIC_LINES
        │   └── HYDRAULIC_LINE_01…05
        ├── CYLINDER_01…05       ◀── Drehachse X (Zylinderaufnahme)
        │   ├── CYL_BARREL_0n       Rohr, fest am Gelenk
        │   └── CYL_ROD_0n       ◀── fährt aus: position.y + scale.y
        └── SHELL_01…05          ◀── Drehachse X (Gelenkbolzen)
            ├── SHELL_BODY_0n       Haut innen und außen
            ├── SHELL_FLANGE_0n_L / _R
            ├── WEAR_PLATE_0n       Verschleißmesser
            ├── SHELL_TIP_0n        Schmiedespitze
            └── SHELL_LUG_0n        Lasche + Laschenbolzen
```

**Abweichung von der Wunschliste, mit Absicht.** Dort standen `ROTATOR`,
`GRAPPLE_HEAD`, `CYLINDER_*` und `SHELL_*` nebeneinander unter der Wurzel.
Mechanisch geht das nicht: Dreht der Rotator, muss alles unter ihm mitdrehen,
sonst steht der Greifer still, während sich nur sein Motorgehäuse dreht. Die
Namen sind unverändert geblieben, nur die Verschachtelung ist mechanisch
richtig.

Der `ADAPTER` hängt bewusst **neben** dem Rotator, nicht darunter: Er ist mit
dem Stiel verschraubt und dreht nicht mit. Genau das ist der Sinn eines
Rotators.

---

## 2. Welcher Knoten macht welche Bewegung

| Bewegung | Knoten | Kanal | Bereich |
|---|---|---|---|
| Schalen öffnen/schließen | `SHELL_01…05` | `rotation.x` (im glTF: `quaternion`) | 0 rad (zu) … −0,913 rad (offen), alle fünf synchron |
| Zylinder folgt | `CYLINDER_01…05` | `rotation.x` | wird aus der Schalenstellung gerechnet |
| Kolbenstange fährt | `CYL_ROD_01…05` | `position.y` + `scale.y` | 0,80 m zu … 1,09 m offen |
| Greifer drehen | `ROTATOR` | `rotation.y` | frei, unabhängig von den Schalen |
| Heben | `GRAPPLE_ROOT` | `position` | nur als Vorlage; am Bagger übernimmt das der Arm |

**Bones gibt es keine** und es braucht auch keine: Ein Greifer ist eine
Starrkörperkette, kein verformbares Netz. Jedes bewegliche Teil ist ein eigener
Knoten mit eigenem Pivot, und Engines animieren solche Knoten direkt. Das ist
billiger als Skinning und lässt sich in der Engine auch per Code ansteuern,
ohne die Clips zu benutzen.

**Die Pivots liegen auf den Bolzen.** `SHELL_0n` sitzt exakt auf
`PIVOT_PIN_0n`; `test/greifer.test.ts` rechnet das nach. Wer die Schale in der
Engine anfasst und um ihre lokale X-Achse dreht, dreht sie um den echten
Gelenkbolzen — ohne Korrekturwerte.

---

## 3. Animationen

| Clip | Dauer | Was passiert |
|---|---|---|
| `OEFFNEN` | 1,6 s | zu → offen, weich an- und auslaufend |
| `SCHLIESSEN` | 1,3 s | offen → zu |
| `GREIFEN` | 2,4 s | offen → zügig zu, kurz vor dem Anschlag langsamer, dann nachdrücken |
| `HEBEN` | 2,6 s | geschlossen, Wurzel steigt 1,8 m |
| `DREHEN` | 4,0 s | Rotator eine volle Umdrehung, Schalen geschlossen |
| `POSE_ZU` / `POSE_HALB` / `POSE_OFFEN` | 0,04 s | stehende Stellungen zum Prüfen |

`OEFFNEN`/`SCHLIESSEN` und `DREHEN` fassen verschiedene Knoten an und lassen
sich deshalb **gleichzeitig** abspielen. `HEBEN` bewegt zusätzlich die Wurzel —
wer den Greifer an einen Arm hängt, lässt diesen Clip weg.

Die Clips sind nicht von Hand gekeyt, sondern aus dem Rig abgetastet: Für jeden
Zeitpunkt wird `setOeffnung()` gerufen und danach abgelesen, wo die Knoten
stehen. Zylinder und Schalen können dadurch gar nicht auseinanderlaufen, auch
wenn später jemand an der Anlenkung dreht.

**In der Engine ohne Clips:** Wer lieber selbst steuert, braucht nur
`SHELL_0n.rotation.x = −0,913 · t` zu setzen und den Zylinder nachzuführen. Die
Rechnung dafür steht in `src/grapple/rig.ts` (`setOeffnung`) und ist zwanzig
Zeilen lang.

---

## 4. Materialien

Sieben PBR-Materialien, metallic/roughness, ohne Texturen — die Farbe steckt im
`baseColorFactor`. Alle Meshes haben UVs (u über die Breite, v vom Bolzen zur
Spitze), eine Verschleiß- oder Rostmaske liegt damit später in Laufrichtung der
Schale.

| Material | Farbe | Rauheit / Metall | Wo |
|---|---|---|---|
| `Stahl_lackiert` | `#3c4246` | 0,55 / 0,35 | Grundkörper, Drehkranz, Adapterplatte |
| `Stahl_dunkel` | `#23282b` | 0,48 / 0,72 | Lagerböcke, Zylinderaufnahmen, Wangen |
| `Stahl_blank` | `#c2c8ce` | 0,22 / 0,94 | alle Bolzen |
| `Lack_gruen` | `#6db33f` | 0,42 / 0,30 | Zylinderrohre |
| `Kolbenstange_chrom` | `#d7dce1` | 0,11 / 0,95 | Kolbenstangen |
| `Hydraulikschlauch` | `#15181a` | 0,85 / 0,05 | Leitungen |
| `Verschleissflaeche` | `#8b9299` | 0,35 / 0,85 | Messer und Spitzen |

Drei Farben, nicht zehn. Das Grün sitzt ausschließlich auf den Zylindern —
genau diese Sparsamkeit macht das Gerät industriell statt bunt.

---

## 4a. Der Kopf ist ein Gussblock mit Frästaschen

Er war zwei Anläufe lang ein glatter Kegelstumpf, an dem die Zylinder außen an
Ohren hingen. Befund dazu im Klartext: *„Der Greiferkopf ist kein Vollklotz, wo
die Hülsen angeschweißt bzw. die Hydraulikzylinder außen angebracht sind. Die
Zylinder laufen nach innen, weil es entsprechende Fräsungen für die Zylinder
gibt."*

Jetzt ist je Schale eine senkrechte Tasche in den Block gefräst, in der der
Zylinder liegt; dazwischen stehen die Rippen. Deshalb ist der Kopf von oben
gezahnt und nicht rund, und deshalb sieht man von außen die Zylinder in ihren
Nischen statt davor.

Das hat drei Dinge nach sich gezogen, die alle nachgerechnet sind:

1. **Die Zylinderachse rückt nach innen**, von 0,92 auf 0,66 Bolzenkreisradien.
   Die ganze Anlenkung wurde deshalb neu abgetastet.
2. **Das Rohr wird dünner**, von 30 auf 24 cm. Am 12.09. war es absichtlich dick
   gemacht worden, weil dünne Zylinder außen am Kopf im Bild untergingen.
   Versenkt dreht sich das um: Ein dickes Rohr zwingt die Fräsung nach außen und
   den Kopf auf 1,81 m Durchmesser — fast so breit wie der geschlossene Greifer.
3. **Unter dem Block sitzt der Gusszapfen**, der nach unten aufweitet und an
   seinem untersten Ende die Lagerböcke der Schalen trägt — *„man sieht da auch
   gut, wo die Zähne befestigt sind, am untersten Ende vom Zapfen."* Darunter
   der gelbe Ölverteiler, das einzige Gelb am Gerät.

---

## 4b. Die Kraft liegt beim Schließen

*„Die Kraft wird für das Schließen benötigt, nicht das Öffnen."* Nachgerechnet
war es vorher genau verkehrt herum — das Schließmoment betrug **57 %** des
Öffnungsmoments, aus zwei Gründen gleichzeitig:

- Geschlossen wird durch **Einfahren**, und einfahrend drückt der Zylinder nur
  auf die Ringfläche: 84 % der Kolbenfläche bei dieser Stange.
- Der **Hebelarm** am Drehbolzen war geschlossen am kleinsten (0,26 m gegen
  0,35 m offen). Die Kraft fehlte dort, wo sie gebraucht wird.

**Am Einfahren lässt sich nichts ändern.** Bei versenkten Zylindern ist es
geometrisch zwingend: Damit Ausfahren schließt, müsste die Lasche nach außen
über die geschlossene Schalenkontur hinausstehen — abgetastet bis 1,4
Bolzenkreisradien, also Hörner, die es an der Maschine nicht gibt. Auf den
Fotos ist es auch genau so: offen stehen die Kolbenstangen weit heraus.

**Am Hebelarm dagegen sehr wohl.** Die Lasche zeigt jetzt als Ausleger nach
innen statt nach oben. Damit steht der Zylinder im geschlossenen Zustand fast
senkrecht auf ihr, und der Hebelarm ist dort am größten:

| Öffnung | 0,0 | 0,25 | 0,5 | 0,75 | 1,0 |
|---|---|---|---|---|---|
| Hebelarm | 0,38 m | 0,34 m | 0,30 m | 0,27 m | 0,24 m |

Schließmoment zu Öffnungsmoment: **1,30**. `test/greifer.test.ts` rechnet es
nach und verlangt zusätzlich, dass der Hebelarm über den ganzen Weg monoton
fällt — wer an der Lasche dreht, erfährt es dort.

---

## 5. Woher die Maße kommen

Aus dem Datenblatt der MG4.1-800-HO5, und zwar aus **allen sechs Maßen
gleichzeitig**:

```
ØC = 1514 mm   Durchmesser geschlossen
ØD = 2409 mm   größter Durchmesser offen
d  = 2225 mm   Spitzenweite offen
A  = 2363 mm   Gesamthöhe offen
B  = 1966 mm   Gesamthöhe geschlossen
```

Mit nur zwei Maßen ist die Aufgabe unterbestimmt; ein früherer Versuch lieferte
einen Haken von 170°, der sich beim Öffnen fast waagerecht aufklappte. Gegen
alle sechs bleibt genau ein Bogen übrig, und der ist gleichmäßig: **86° auf
acht Abschnitten**, Bolzenkreis 0,731 m, Abschnitt 0,172 m.

Wichtig war dabei, A und B richtig herum zuzuordnen: **A gehört zur offenen
Stellung.** Andersherum geht es geometrisch nicht — geschlossen müssen die
Spitzen den Bolzenkreis nach innen überbrücken, und dieser Weg fehlt ihnen nach
unten. Eine Faust ist kürzer als eine ausgestreckte Hand.

Im Spiel ist alles mit **1,25** multipliziert (`MASSSTAB` in `form.ts`), weil
hier Autos und Tanks dichter beieinanderliegen als auf einem echten Platz. Das
Datenblatt bleibt dadurch im Quelltext nachprüfbar.

### Bewusste Abweichung

Der geschlossene Anschlag liegt bei 8°, nicht bei den 4,6°, die aus dem
Datenblatt folgen würden. Grund: Die Spitzen dürfen die Drehachse nicht
überfahren, sonst laufen sie in den Sektor ihres Gegenübers. Es bleibt ein Loch
von 8 cm in der Mitte — das hat ein echter HO-Greifer auch, und deshalb steht
im Prospekt: „Je kleinteiliger das Material, desto geschlossener wird die
Schalenform gewählt."

---

## 6. Geprüft wird, nicht geschätzt

`test/greifer.test.ts`, 16 Prüfungen. Die wichtigen:

- **Bewegungsfreiheit.** Über 21 Stellungen werden alle Eckpunkte aller
  Schalenteile in Weltkoordinaten gerechnet und geprüft, ob jede Schale in
  ihrem 72°-Sektor bleibt. Bleibt sie das, können die Schalen sich nicht
  durchdringen — die Sektoren sind disjunkt. Das hat zwei echte Fehler
  gefangen: eine Spitze, die über die Achse hinausschoss, und eine Seitenwange,
  deren Winkel zur Spitze hin ins Unermessliche wuchs (bei 6 cm Radius ergaben
  10 cm Wange 96°).
- **Zylinder.** Länger als sein Rohr in jeder Stellung, Hub über 15 cm, Neigung
  unter 25°, die Achse überall innerhalb ihrer Frästasche, die Tasche selbst
  ohne Anschnitt am Kern des Kopfes, und die Rippen an jeder Höhe weiter außen
  als die Rohraußenkante — sonst sieht man den Zylinder nicht in der Nische,
  sondern davor.
- **Kraftrichtung.** Hebelarm geschlossen größer als offen, über den ganzen Weg
  monoton fallend, Schließmoment mindestens 1,2-mal Öffnungsmoment.
- **Pivots.** Jeder Schalenknoten sitzt exakt auf seinem Gelenkbolzen.
- **Maße** gegen das Datenblatt, mit 14 cm Toleranz.

Der Export prüft sich zusätzlich selbst: Nach dem Schreiben wird das GLB wieder
geladen, die Hierarchie gegengelesen und die Animation abgespielt. Gemeldet
wird, um wie viel Grad die Schale schwenkt und wie weit die Stange ausfährt.
Ein GLB, das sich schreiben lässt, muss sich nämlich nicht laden lassen — und
Spuren auf Knoten, die der Exporter nicht kennt, fallen stillschweigend weg.

---

## 7. Import

**Web / three.js**

```js
const gltf = await new GLTFLoader().loadAsync("greifer-mehrschalen.glb");
scene.add(gltf.scene);
const mixer = new THREE.AnimationMixer(gltf.scene);
mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "OEFFNEN")).play();
```

**Unity** — glTF über UnityGLTF oder glTFast. Achtung: Unity ist linkshändig
und importiert glTF mit gespiegelter Z-Achse; die Drehrichtung der Schalen
kehrt sich dabei um. Das betrifft nur das Vorzeichen, nicht die Mechanik.

**Godot** — `.glb` direkt in den Projektordner legen. Die Clips landen in einem
`AnimationPlayer` unter der Wurzel.

**Blender** — `Datei ▸ Importieren ▸ glTF 2.0`. Die Knoten kommen als Empties
mit den Meshes darunter; die Pivots sitzen dort, wo sie hier sitzen.
