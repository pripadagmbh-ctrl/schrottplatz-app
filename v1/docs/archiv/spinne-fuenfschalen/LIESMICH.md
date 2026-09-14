# Fünfschalengreifer — zur Seite gelegt am 13.09.2026

Ansage: „bitte wieder Spinne von gestern Mittag nehmen, die andere müssen wir
noch verbessern."

Im Spiel läuft wieder die Sichelkralle vom 12.09. mittags. Diese Form hier ist
nicht verworfen, sondern abgelegt — mit allem, was an ihr gemessen und
korrigiert wurde.

## Was drin steckt

| Datei | war | 
|---|---|
| `teile.ts` | die Einzelteile nach der Explosionszeichnung, dreizehn Positionen |
| `rig.ts` | der zusammengebaute, animierbare Greifer |
| `clawGeometry.ts` | Kralle für Spiel und Kollision, aus `teile.ts` abgeleitet |
| `grappleParts.ts` | die Spinne, wie der Bagger sie trägt |
| `schalenform.test.ts` | der Wächter für die Sichelform |
| `tool-*.ts` | die Messwerkzeuge (Silhouette, Bandstärke, Zahnbild …) |

## Der Stand, auf dem sie liegt

Zuletzt behoben (13.09., Commit „Schale: Aussennormale hatte das falsche
Vorzeichen"): Wölbung, Strebe und Zahn wurden um `(+sin θ, cos θ)` von der
Bahn abgetragen, die Aussennormale des Bogens ist aber `(−sin θ, cos θ)`. Bei
θ = 0 dasselbe, danach um 2 θ verdreht. Gemessen in der winkelfreien
Seitenansicht:

| Station | vorher | danach |
|---|---|---|
| k = 0,17 | 148 mm | 195 mm |
| k = 2,83 | **20 mm** | 150 mm |
| k = 6,00 | **137 mm** | 78 mm |

Danach fiel die Dicke von 196 mm gleichmässig auf 56 mm an der Zahnspitze,
ohne Rücksprung und ohne Loch.

## Was noch offen war

Nichts Gemessenes. Die Form war an dem Punkt, an dem sie gemessen stimmte —
die Ansage „die andere müssen wir noch verbessern" kam aus dem Auge, nicht aus
einer Messung. Wer hier weitermacht, fängt also nicht bei einem bekannten
Fehler an, sondern bei einem Eindruck, der erst noch in eine Zahl zu
übersetzen ist.

## Zurückholen

Die vier Quelldateien an ihre Plätze kopieren (`src/grapple/`,
`src/excavator/`), die Werkzeuge ohne das `tool-`-Präfix nach `tools/`, den
Test nach `test/`. Dann `npx vite-node tools/greifer-export.ts` — das GLB für
die Vorschau baut sich daraus neu und prüft sich selbst.
