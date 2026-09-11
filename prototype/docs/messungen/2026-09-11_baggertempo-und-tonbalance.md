# Baggertempo und Tonbalance (11.09.2026)

Zwei Befunde vom Auftraggeber: „der Bagger ist gerade zu wild, denke es liegt
an der Geschwindigkeit" und „die Tonkulisse ist auch nicht authentisch, und
klingt wie unter Wasser". Beides nachgemessen, statt nach Gehör gedreht.

## 1 Bagger — wo das Tempo herkam

Gemessen im laufenden Spiel über `__game.step(1)` bei abgeschalteter
Bildschleife. Jede Achse einzeln aus dem Stand, Position der Spinne je
Schritt.

| | vorher | nachher |
|---|---|---|
| Spinne beim Schwenken (8,1 m Radius) | **9,24 m/s = 33 km/h** | **6,35 m/s = 22,9 km/h** |
| Drehwerk | **60,8 °/s** | **45,0 °/s** |
| Rotator | 160 °/s | 105 °/s |
| Stielspitze | 2,17 m/s | 1,40 m/s |
| Auslegerspitze | 0,79 m/s | 0,79 m/s |
| Anlauf / Auslauf Drehwerk | 0,52 / 0,50 s, linear | 0,47 / 0,47 s, mit weichen Ecken |
| Nachlauf nach dem Loslassen | — | 8,7° |

### Die Ursache war nicht die Einstellung, sondern der Ausbau

`CAB_MAX` stand auf 45 °/s, und der Test in `reach.test.ts` hält den Wert
zwischen 42 und 54 — dem Bereich, den ein Umschlagbagger dieser Klasse
tatsächlich dreht (7 bis 9 Umdrehungen je Minute). Gefahren wurden trotzdem
60,8 °/s: Der Baggerausbau (`getSpeedBonus`, 1,35) ging aufs **Endtempo**
aller Achsen. Die Maschine drehte also ein Drittel schneller als jede echte.

Umgestellt: Der Bonus verkürzt jetzt die **Rampe** (`anlaufZeit / ausbau`).
Die ausgebaute Maschine spricht schneller an, dreht aber nicht schneller —
siehe E-048.

### Rampe mit weichen Ecken

Die Rampe war eine Gerade: volle Beschleunigung bis zum Endtempo, dann von
einem Schritt auf den nächsten null. Genau dieser Knick liest sich als Ruck.
Jetzt wird die Schrittweite nahe am Ziel kleiner. Gemessene Kurve beim
Loslassen (°/s, jeder vierte Schritt):

```
vorher:  43 · 35 · 27 · 19 · 11 · 3 · 0
nachher: 43 · 35 · 27 · 19 · 12,6 · 7,4 · 3,3 · 0
```

## 2 Ton — was „unter Wasser" gemessen heißt

Gemessen mit `OfflineAudioContext` über dieselbe Klangwelt, die auch im Spiel
läuft; verglichen wird der Effektivwert oberhalb einer Grenzfrequenz gegen den
Effektivwert des ganzen Ereignisses.

### Ausgangslage

Ein Aufschlag auf die Ladefläche, Energieanteil je Band:

| Band | Anteil |
|---|---|
| 60–150 Hz | 87,6 % |
| 150–400 Hz | 12,0 % |
| 400–1000 Hz | 0,4 % |
| über 1 kHz | **0,0 %** |

Schwerpunkt 115 Hz. Über 2 kHz lag der Anteil bei **−49 dB**, also praktisch
nichts. Drei Ursachen, alle hausgemacht:

1. Ein Tiefpass bei **1600 Hz** vor allen Geräuschen (aus dem Wunsch „Ton
   dumpfer").
2. Die Klänge selbst endeten oben: Die höchste Eigenfrequenz des Blechschlags
   lag bei **651 Hz**.
3. Darunter ein Bass-Sweep („Wumms") mit mehr Pegel als der Schlag, dazu
   +6,5 dB bei 110 Hz und ein Kompressor mit 7:1 und langem Loslassen, der die
   Anrisse in einen Brei gezogen hat.

Stahl auf Stahl lebt zwischen 700 Hz und 6 kHz. Es war nichts davon da.

### Zielwerte aus echten Aufnahmen

Der Auftraggeber hat fünf Aufnahmen geliefert. Mit derselben Routine gemessen:

| Aufnahme | über 700 Hz | über 2 kHz | Spitze/Effektivwert |
|---|---|---|---|
| nematoki metal hit 287907 | −3,4 dB | −18,8 dB | 17,8 dB |
| nematoki metal hit 2287908 | −1,8 dB | −18,8 dB | 18,2 dB |
| soumage heavy metal crush | −10,4 dB | −13,1 dB | 12,7 dB |
| freesound metal moving | −10,0 dB | −14,0 dB | 14,5 dB |
| freesound grúa recicladora (Feld, 154 s) | −2,4 dB | −14,3 dB | 28,7 dB |

Die beiden „metal hit" sind kleine, helle Einzelteile fast ohne Bass; die
anderen drei sind schweres Material. Für Schrott auf einer LKW-Pritsche zählen
die schweren: rund **−10 dB über 700 Hz** und **−13 dB über 2 kHz**.

### Was geändert wurde

- **Tiefpass 1600 → 5500 Hz**, dafür eine Höhenabsenkung von −7 dB ab 3,5 kHz.
  Entfernung ist ein Hang, keine Mauer.
- **Anriss (`knall`)**: Jeder Schlag bekommt 14 ms helles Rauschen um
  700 + f_max·0,6 Hz. Das ist die Härte, die vorher komplett fehlte.
- **Eigenfrequenzen nach oben verlängert**: Blechschlag 651 → 1760 Hz,
  Greiferprofile um zwei bis drei Teiltöne.
- **Mittenbetonung der Teiltöne** um 1150 Hz, statt nur nach oben abzufallen.
- **Bassbetonung 110 Hz von +6,5 auf +1,5 dB**, Wumms um rund 40 Prozent
  zurück, Greifer-Wumms um ein Drittel.
- **Kompressor 7:1 / 0,2 s → 4:1 / 0,12 s**, **Hall 0,28 → 0,15** und von
  0,55 auf 0,4 s.
- Blechdonner als **Band um 1500 Hz** statt Tiefpass bei 300 Hz.

### Ergebnis

| | vorher | nachher | Ziel (schwere Aufnahmen) |
|---|---|---|---|
| Aufprall Ladefläche, über 700 Hz | −29,2 dB | **−10,3 dB** | −10,2 dB |
| Aufprall Ladefläche, über 2 kHz | −49,2 dB | **−11,4 dB** | −13,4 dB |
| Aufprall Beton, über 700 Hz | −28,2 dB | **−12,6 dB** | −10,2 dB |
| Aufprall Beton, über 2 kHz | −47,3 dB | **−13,9 dB** | −13,4 dB |
| Spinne schnappt zu, über 2 kHz | −48,0 dB | −17,3 dB | — |
| Holz auf Blech, über 2 kHz | −48,6 dB | −24,8 dB | — |

Holz bleibt dumpf, Metall nicht mehr — der Unterschied zwischen den
Materialien ist jetzt messbar 14 dB statt 0,6 dB.

Die Aufnahmen selbst wurden **nicht** eingebaut, nur als Zielwert benutzt
(E-049). Wer nachjustieren will: Ein Wert, `SFX_FERNE_DB` in
`audio/audioManager.ts`, verschiebt die ganze Balance zwischen dumpf und hell.
