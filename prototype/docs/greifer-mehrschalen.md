# Fünfzinken-Mehrschalengreifer — modulares, animierbares Modell

Hydraulischer Greifer mit fünf Sichelkrallen am Gelenkring. Game-ready, mit
Hierarchie, Pivots, PBR-Materialien, UVs und Animationen.

**Es ist dieselbe Spinne wie im Spiel.** Die Form kommt aus
`src/excavator/clawGeometry.ts` — dieselbe Datei, aus der der Bagger seinen
Greifer baut. Zwischen dem 12. und 13.09.2026 gab es zeitweise zwei Greifer
nebeneinander, und sie liefen auseinander, sobald an einem von beiden etwas
geändert wurde. `test/greifer.test.ts` prüft jetzt, dass Schalenzahl,
Gelenkring, Segmentzahl und Öffnungsweite übereinstimmen.

| | |
|---|---|
| **Datei** | `docs/greifer-mehrschalen.glb` (glTF 2.0, binär) |
| **Größe** | 278 kB · 105 Meshes · 2548 Dreiecke |
| **Einheit** | Meter, Y oben, rechtshändig (glTF-Standard) |
| **Abmessungen** | geschlossen 1,87 × 2,02 m · offen 3,40 × 2,23 m |
| **Ursprung** | Kardangelenk oben, also der Punkt, an dem der Greifer am Stiel hängt |
| **Quelle** | `src/grapple/` — `form.ts` (Maße) · `parts.ts` (Bauteile) · `rig.ts` (Rig) |
| **Neu erzeugen** | `npx vite-node tools/greifer-export.ts` |
| **Ansehen** | `npm run dev`, dann `http://localhost:5173/greifer.html` |

---

## 1. Hierarchie

Die Nummern sind die der Positionsliste aus der Explosionszeichnung.

```
GRAPPLE_ROOT                       Ursprung = Aufhängepunkt am Stiel
├── ADAPTER                     01 Aufhängung / Anschraubplatte, dreht NICHT mit
│   ├── ADAPTER_OHR_L / _R
│   ├── ADAPTER_BOLZEN          02 Aufnahmebolzen
│   └── ADAPTER_PLATTE
└── ROTATOR                     03 Drehwerk           ◀── Drehachse Y
    ├── ROTATOR_GEHAEUSE
    ├── ROTATOR_DREHKRANZ
    ├── ROTATOR_DURCHFUEHRUNG
    └── GRAPPLE_HEAD            07 Mittelstück
        ├── HEAD_MITTELSTUECK
        ├── HEAD_SCHUTZABDECKUNG   06
        ├── HEAD_GELENKRING
        ├── PIVOT_PIN_01…05        11 Gelenkbolzen
        ├── HYDRAULIC_LINES        05 Hydraulikschläuche
        │   └── HYDRAULIC_LINE_01…05
        ├── CYLINDER_01…05         04                 ◀── Drehachse X
        │   ├── CYL_BARREL_0n      15 Zylindergehäuse
        │   └── CYL_ROD_0n         18 Kolbenstange, fährt aus
        └── SHELL_01…05            08 Greiferschale   ◀── Drehachse X
            ├── SHELL_LAGERBOCK_0n
            ├── SHELL_LUG_0n
            ├── SHELL_SEG_0n_1…6      Segmentkette, fest verbaut
            │   ├── SHELL_BODY_0n_k
            │   └── WEAR_PLATE_0n_k   09 Verschleißblech
            └── SHELL_TIP_0n          10 Greiferspitze
```

**Nicht als eigene Netze gebaut:** 12 Buchse, 13 Sicherungsring, 14
Verschraubung, 16 Kolben, 17 Dichtungen. In einer Spielkamera ist davon nichts
zu sehen, und der Auftrag sagt ausdrücklich, unnötig winzige Details
wegzulassen. Sie sind an den Bolzen mitgedacht — dort sitzt der Absatz, auf dem
sie liefen.

**Abweichung von der Wunschliste, mit Absicht.** Dort standen `ROTATOR`,
`GRAPPLE_HEAD`, `CYLINDER_*` und `SHELL_*` nebeneinander unter der Wurzel.
Mechanisch geht das nicht: Dreht der Rotator, muss alles unter ihm mitdrehen,
sonst steht der Greifer still, während sich nur sein Motorgehäuse dreht. Der
`ADAPTER` hängt dagegen bewusst **neben** dem Rotator — er ist mit dem Stiel
verschraubt und dreht nicht mit. Genau das ist der Sinn eines Rotators.

---

## 2. Welcher Knoten macht welche Bewegung

| Bewegung | Knoten | Kanal | Bereich |
|---|---|---|---|
| Schalen öffnen/schließen | `SHELL_01…05` | `rotation.x` (im glTF: `quaternion`) | 0 rad (zu) … −1,25 rad (offen), alle fünf synchron |
| Zylinder folgt | `CYLINDER_01…05` | `rotation.x` | wird aus der Schalenstellung gerechnet |
| Kolbenstange fährt | `CYL_ROD_01…05` | `position.y` + `scale.y` | 0,57 m zu … 0,34 m offen |
| Greifer drehen | `ROTATOR` | `rotation.y` | frei, unabhängig von den Schalen |
| Heben | `GRAPPLE_ROOT` | `position` | nur als Vorlage; am Bagger übernimmt das der Arm |

**Je Schale genau eine Rotationsspur.** Die Sichelkralle ist eine Kette aus
sechs Segmenten, aber die Segmente stehen fest zueinander — nur der Drehpunkt
am Gelenkring wird animiert. Ein Test hält das fest, sonst bräuchte eine Schale
sechs Spuren statt einer.

**Bones gibt es keine** und es braucht auch keine: Ein Greifer ist eine
Starrkörperkette, kein verformbares Netz. Jedes bewegliche Teil ist ein eigener
Knoten mit eigenem Pivot, und Engines animieren solche Knoten direkt.

**Die Pivots liegen auf den Bolzen.** `SHELL_0n` sitzt exakt auf `PIVOT_PIN_0n`.
Wer die Schale in der Engine anfasst und um ihre lokale X-Achse dreht, dreht sie
um den echten Gelenkbolzen — ohne Korrekturwerte.

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
stehen. Zylinder und Schalen können dadurch gar nicht auseinanderlaufen.

---

## 4. Die Zylinderanlenkung wurde korrigiert

Die Form ist die vom 12.09.2026 mittags, unverändert. Die **Anlenkung** nicht —
sie war mechanisch unbrauchbar, was im Spiel nie aufgefallen ist, weil die
Kralle dort kinematisch geführt wird und der Zylinder nur mitläuft.

Nachgerechnet, alter Stand:

| Öffnung | 0,0 | 0,2 | 0,5 | 1,0 |
|---|---|---|---|---|
| Hebelarm | 0,044 m | **0,007 m** | 0,083 m | 0,201 m |

Bei 20 % Öffnung lief der Hebelarm durch einen **Totpunkt**: Dort hätte kein
Öldruck der Welt die Schale bewegt. Das Schließmoment betrug ein Fünftel des
Öffnungsmoments, und die Zylinder liefen durch den Gussblock hindurch.

Über alle Lagen abgetastet unter vier Bedingungen — frei am Gussblock vorbei,
steil, kein Totpunkt, größter Hebelarm im geschlossenen Zustand — bleibt diese
Anlenkung übrig:

| | alt | neu |
|---|---|---|
| Anlenkbock | r 0,42 m, y −0,56 m | r 0,84 m, y −0,38 m |
| Lasche am Gelenk | y −0,30, z +0,19 | y −0,04, z +0,20 |
| Länge zu / offen | 0,83 / 0,73 m | 0,57 / 0,34 m |
| Hub | 0,10 m | 0,23 m |
| kleinster Hebelarm | 0,007 m | 0,110 m |
| Schließmoment / Öffnungsmoment | 0,22 | **1,70** |

Der Zylinder fährt zum **Schließen aus** — die starke Richtung, volle
Kolbenfläche. Das ist die Richtung, für die ein Greifer Kraft braucht.

---

## 5. Geprüft wird, nicht geschätzt

`test/greifer.test.ts`, 14 Prüfungen. Die wichtigen:

- **Dieselbe Spinne wie im Spiel.** Schalenzahl, Gelenkring, Segmentzahl und
  Öffnungsweite werden gegen `src/excavator/clawGeometry.ts` gehalten.
- **Bewegungsfreiheit.** Über 21 Stellungen werden alle Eckpunkte aller
  Schalenteile in Weltkoordinaten gerechnet und geprüft, ob jede Schale in ihrem
  72°-Sektor bleibt. Ausgenommen sind die innersten 30 cm: Dort laufen die fünf
  Spitzen im geschlossenen Zustand zusammen und überlappen sich — bei fünf
  Zinken endlicher Breite geht es nicht anders, und am Gerät schieben sie sich
  dort aneinander vorbei.
- **Zylinder.** Fährt zum Schließen aus, Hub über 15 cm, immer länger als sein
  Rohr, Neigung unter 20°, nirgends weniger als 11 cm Hebelarm.
- **Pivots.** Jeder Schalenknoten sitzt exakt auf seinem Gelenkbolzen.
- **Eine Spur je Schale.** Die Segmentkette bleibt beim Öffnen unverändert.

Der Export prüft sich zusätzlich selbst: Nach dem Schreiben wird das GLB wieder
geladen, die Hierarchie gegengelesen und die Animation abgespielt. Gemeldet
wird, um wie viel Grad die Schale schwenkt und wie weit die Stange fährt.

---

## 6. Materialien

Sechs PBR-Materialien, metallic/roughness, ohne Texturen — die Farbe steckt im
`baseColorFactor`. Dieselbe Farbgebung wie im Spiel.

| Material | Farbe | Rauheit / Metall | Wo |
|---|---|---|---|
| `Hardox_Guss` | `#40474b` | 0,50 / 0,55 | Schalensegmente, Mittelstück, Drehkranz |
| `Stahl_dunkel` | `#23282b` | 0,45 / 0,70 | Verschleißbleche, Lagerböcke, Gelenkring, Spitzen |
| `Stahl_blank` | `#b9c0c6` | 0,25 / 0,90 | alle Bolzen |
| `Lack_gruen` | `#62c94b` | 0,40 / 0,35 | Zylinderrohre |
| `Kolbenstange_chrom` | `#b8bec4` | 0,22 / 0,85 | Kolbenstangen |
| `Hydraulikschlauch` | `#15181a` | 0,85 / 0,05 | Leitungen |

Das Grün sitzt ausschließlich auf den Zylindern — genau diese Sparsamkeit macht
das Gerät industriell statt bunt.

---

## 7. Import

**Web / three.js**

```js
const gltf = await new GLTFLoader().loadAsync("greifer-mehrschalen.glb");
scene.add(gltf.scene);
const mixer = new THREE.AnimationMixer(gltf.scene);
mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "OEFFNEN")).play();
```

**Unity** — glTF über UnityGLTF oder glTFast. Achtung: Unity ist linkshändig und
importiert glTF mit gespiegelter Z-Achse; die Drehrichtung der Schalen kehrt
sich dabei um. Das betrifft nur das Vorzeichen, nicht die Mechanik.

**Godot** — `.glb` direkt in den Projektordner legen. Die Clips landen in einem
`AnimationPlayer` unter der Wurzel.

**Blender** — `Datei ▸ Importieren ▸ glTF 2.0`. Die Knoten kommen als Empties
mit den Meshes darunter; die Pivots sitzen dort, wo sie hier sitzen.
