# Bagger: Bodenanschlag, Positionsliste, Räder — 14.09.2026

Drei Schritte am Bagger, je ein Commit. Gemessen kopflos mit
`npx vite-node tools/baggerteile.ts` und `tools/zahnlage-spinne.ts`; die
Geräteangaben stammen aus Patricks Overlay vom 14.09.2026
(FPS 48 · Frame 21,0 ms · Zeichenrufe 1322 · 240k Dreiecke · Physik 0,5 ms ·
Bild 5,9 ms).

## 1 — Der Noppen-Fehler

`CLAW_MAX_DEPTH` lief über `clawPoint`, also über die Segmentkette, und endete
an Station 8. Darunter wird aber noch der Zahnkegel gezeichnet (`tineTip`,
`CylinderGeometry(0.03, 0.075, 0.14, 8)` auf `y = −CLAW_SEG_LEN − 0.03`).

Abgetastet über den ganzen Öffnungsweg (`tools/zahnlage-spinne.ts`):

| Spreizung | Kette (alt) | gezeichnet | Fehlbetrag |
|---|---|---|---|
| 0,0000 | 2,3605 | 2,4385 | 0,0780 |
| 0,4665 | 2,7920 | 2,9056 | 0,1136 |
| 0,7775 | 2,8754 | 2,9995 | **0,1241** |
| 0,9330 | 2,8512 | 2,9761 | 0,1249 |
| 1,5550 | 2,3413 | 2,4424 | 0,1011 |

Der Fehlbetrag ist nicht konstant 0,10 m, wie die reine Achsrechnung
(`versatz + hoehe/2`) nahelegt: Die Unterkante des Kegels ist eine Scheibe von
0,075 m Radius und neigt sich mit dem letzten Segment mit. In der Senkrechten
kommen dadurch bis zu 2,5 cm dazu.

**Nachher:** `CLAW_MAX_DEPTH` 2,8754 m → **2,9995 m**. Der Fehlbetrag ist
0,0000 m an jeder der 41 Stützstellen — `clawToothDepth` rechnet den
gezeichneten Punkt exakt nach.

Abtastfehler der Stufung (21 Stützstellen gegen 2001): 0,00 mm. Die grobe
Stufung bleibt.

### Was die Wächter gemeldet haben

Beide maßen gegen dasselbe unvollständige Modell:

- `test/spinnenmodell.test.ts` tastete die STATIONEN der Kette ab — also die
  Quelle von `CLAW_MAX_DEPTH` selbst. Er misst jetzt die ECKPUNKTE der
  gebauten Meshes und sucht den Zahn über seinen Knotennamen.
- `test/collision.test.ts` verlangte `clawTipDepth === tiefste Station`, ein
  Gleichheitszeichen gegen die eigene Quelle. Er verlangt jetzt beides:
  Kettenbauch UND Zahn müssen im Anschlag stecken.

### Offen

`test/collision.test.ts` verlangt `CLAW_MAX_DEPTH < 3.0`. Der neue Wert ist
2,99949 m — die Schranke hält, aber nur noch mit **0,51 mm** Luft. Sie wurde
nicht angerührt (kein Wächter wird aufgeweicht), ist damit aber praktisch
wirkungslos und stolpert beim nächsten Formschritt. Entscheidung offen.

## 2 — Positionsliste

| | vorher | nachher |
|---|---|---|
| Meshes unter `root` | 117 | 117 |
| davon ohne Namen | **117** | **0** |
| Meshes lose in der Szene | 12 | 12 |
| Dreiecke (root) | 9 980 | 9 980 |
| Zeichenrufe (root) | 167 | 167 |

Reine Benennung. Keine Geometrie, keine Farbe, kein Verhalten geändert.

Aufteilung nach den acht Baugruppen:

```
01_UNTERWAGEN        1 Mesh   + 01_RAEUMSCHILD  10 Meshes
02_RAD_VL/VR/HL/HR   je 1 Mesh
03_PRATZE_VL/VR/HL/HR  je 4 Meshes (Ausleger, Kasten, Stempel, Teller)
04_DREHKRANZ         1 Mesh
05_OBERWAGEN         Motorhaube, 8 Lüftungsgitter, Gegengewicht
06_KABINE            Dach, Scheiben, Säulen, Sitz, 2 Joysticks, Fahrer, Display
07_AUSLEGER/STIEL    Kästen, Schläuche, Greiferhalter, 5 Zylinder
08_KLEINTEILE        Namensschild, 2 Auslegerlogos
```

Die 12 losen Meshes sind die Hydraulikzylinder (5 × Rohr + Stange) und die
2 Kabinenlenker. Sie rechnen in Weltkoordinaten und hängen deshalb nicht unter
`root` — im Szenengraph waren sie von Platzobjekten nicht zu unterscheiden.

Die Spinne (`grappleGroup`) ist bewusst außen vor; sie hat ihre eigene
Teileliste in `grappleParts.ts` und ihren eigenen Wächter.

### Vorn, hinten, links, rechts

+Z ist vorn (dorthin zeigt der Ausleger, dort sitzt das Schild). −X ist
RECHTS — das folgt aus dem Rechtssystem von three.js und stand schon im
Kabinenbau: „er blickt in +Z, seine rechte Seite ist −X". Ein älterer Kommentar
an der Kabine („deutlich weiter nach links gesetzt" bei cx = −1,05) widerspricht
dem; die Regel aus der Geometrie gilt.

## 3 — Die Räder

| | vorher | nachher |
|---|---|---|
| Bauteile je Rad | 1 | 3 (Reifen, Felge, Nabe) |
| Umfangssegmente | 20 | 32 |
| Dreiecke je Rad | 80 | 1 344 |
| davon Reifen | 80 | **768** (Grenze 800) |
| davon Felge | — | 480 |
| davon Nabe | — | 96 |
| Zeichenrufe je Rad | 2 | 4 |
| Durchmesser | 1,24 m | **1,24 m** |
| Breite | 0,50 m | **0,50 m** |
| Kollider | keiner | keiner |

Ganzer Bagger: 117 → **125** Meshes unter `root`, 9 980 → **15 036** Dreiecke,
167 → **175** Zeichenrufe. Mit den losen 12: 129 → **137** Bauteile.

Nur der Reifen wirft Schatten. Felge und Nabe liegen vollständig in seiner
Silhouette; ihr Schatten wäre nicht zu sehen, würde aber acht Zeichenrufe
kosten. Ohne diese Entscheidung wären es 183 statt 175.

Bild zum Beurteilen der Form: `docs/messungen/2026-09-14_rad.png`
(alt · neu schräg · neu von der Seite · Lauffläche, alle im selben Maßstab).

### Zwei Befunde beim Bauen

1. **Der Zylinder verschluckte die Felge.** Das Felgenbett war zuerst ein
   geschlossener Zylinder; die Felgenscheibe lag vollständig darin und nach
   außen zeigte sein flacher Deckel. Jetzt ist das Bett ein offener Ring mit
   eingezogener Scheibe — man sieht in die Schüssel hinein, und dieser Einzug
   ist die Tiefe, die ein Rad aus der Nähe plastisch macht. Der offene Ring
   braucht ein beidseitiges Material (kostet keinen Zeichenruf).

2. **Flache Klötze auf einer runden Lauffläche stehen mit ihren ECKEN
   heraus.** Mit der Deckfläche auf RAD_R hatte das Rad in Wirklichkeit
   1,2478 m statt 1,24 m. Der neue Wächter hat das gemeldet; die Deckfläche
   liegt jetzt auf √(RAD_R² − Eckenausschlag²) = 0,6161 m, damit die äußerste
   Ecke genau auf 0,62 m fällt.

### Kurzprobe zur Laufzeit

600 Physikschritte nach dem Aufbau: Aufbau 182 ms · Physik 0,296 ms/Schritt ·
5 Bodies · max v 0,000 m/s · keine NaN.

### Werkzeugbefund (nicht geändert)

Der Rasterer in `tools/fuenfschalen/rasterbild.ts` paart die baryzentrischen
Gewichte mit den falschen Ecken (`z[1]*w0 + z[2]*w1 + z[0]*w2`, richtig wäre
`z[2]*w0 + z[0]*w1 + z[1]*w2`). Die Tiefe im Inneren großer Dreiecke ist damit
falsch; bei schräger Sicht schlägt das als Splitter durch. In
`tools/radbild.ts` ist es richtiggestellt, in `rasterbild.ts` NICHT — das ist
das Werkzeug des Greiferpakets.
