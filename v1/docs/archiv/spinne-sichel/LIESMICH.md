# Archiv: die Sichelspinne

Diese beiden Dateien waren bis zum 13.09.2026 der Greifer **im Spiel**. Sie
liegen hier, weil sie am 13.09.2026 auf Ansage ersetzt wurden („stell live und
archiviere die alte Sichelform"), nicht weil sie falsch waren.

| Datei | war |
|---|---|
| `clawGeometry.ts` | Maße und Mittellinie der Sichelkralle |
| `grappleParts.ts` | Bauteile und Zusammenbau dazu |

Sie werden **nicht mehr gebaut**: Sie liegen außerhalb von `src/`, also sieht
sie weder TypeScript noch Vite. Wer sie wieder in Betrieb nehmen will, schiebt
sie zurück nach `src/excavator/` — sie sind in sich vollständig.

## Was sie war

Eine um ein Viertel vergrößerte Sennebogen MG4.1-800-HO5: fünf Sichelkrallen an
einem Gelenkring von Ø 1,51 m, sechs Abschnitte à 0,26 m, 0,22 rad Krümmung je
Abschnitt.

|  | Sichel (alt) | Fünfschalen (neu) |
|---|---|---|
| Spitzenweite offen | 3,38 m | 2,30 m |
| Breite geschlossen | 1,51 m | 1,78 m |
| Bauhöhe | 2,14 m | 2,49 m |
| Bolzenkreis | Ø 1,51 m | Ø 1,18 m |
| Spreizung | 0 … 72° | 0 … 65° |

## Warum sie ersetzt wurde

Nicht wegen der Form, sondern wegen der doppelten Buchführung. Ab dem
13.09.2026 stand in `src/grapple/` ein zweiter, nach der Explosionszeichnung
gebauter Greifer, den nur die Vorschauseite zu sehen bekam — im Spiel lief
weiter die Sichel. Genau davor warnt E-154: Zwei Modelle laufen auseinander,
sobald man an einem von beiden etwas ändert. Jetzt liefert `src/grapple/` die
Form, und `src/excavator/clawGeometry.ts` leitet nur noch daraus ab.
