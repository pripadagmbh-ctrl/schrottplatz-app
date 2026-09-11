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

## 3 Nachtrag: das Maschinengewehr

Rueckmeldung nach dem Umbau: „aktuell ists grausam mit dem Maschinengewehr".
Das war kein Klangproblem, sondern ein Mengenproblem — solange alles dumpf
war, verschmierten die vielen Einzelschlaege zu einem Rollen; mit dem Anriss
wurde jeder einzelne hoerbar.

Gezaehlt wurden die Ausloeser, nicht geschaetzt:

| | vorher | nachher |
|---|---|---|
| laute Anrisse je Sekunde, Ladeflaeche | **47,1** | **5,3** |
| laute Anrisse je Sekunde, Beton | 27,1 | 3,3 |
| Schlaege je Aufprall (Kaskade) | 4 bis 9 | 3 bis 5 |
| Klangausloeser bei zehn Teilen zugleich in der Mulde | 10 | **1** |
| Quittungstoene dabei | 20 | **2** |

Zum Vergleich: Ein echtes Maschinengewehr schafft 10 bis 13 Schuss je
Sekunde. Drei Aenderungen:

1. **Der Anriss sitzt nur noch auf dem ersten Kontakt.** Was danach kommt,
   ist Klappern, kein Schlag — die Huepfer bekommen ein Achtel.
2. **Das Aufprallfenster** ist von 0,14 auf 0,3 s verlaengert: hoechstens gut
   drei hoerbare Aufschlaege je Sekunde statt sieben.
3. **Fallklaenge und Quittungstoene werden zusammengefasst.** Beim Abkippen
   meldete sich jedes Teil einzeln; jetzt sperrt eine Frist von 0,11 s
   (Fallklang) bzw. 0,6 s (Quittung) die Salve weg. Eine Fuhre ist ein
   Treffer, nicht zwanzig.

Weil weniger Schlaege kommen, ist jeder einzelne lauter — sonst kippt die
Balance zurueck ins Dumpfe. Gegengemessen nach dem Ausduennen:

| Aufprall Ladeflaeche | Wert | Ziel |
|---|---|---|
| ueber 700 Hz | −12,3 dB | −10,2 dB |
| ueber 2 kHz | −12,9 dB | −13,4 dB |

Die Aufnahmen selbst wurden **nicht** eingebaut, nur als Zielwert benutzt
(E-049). Wer nachjustieren will: Ein Wert, `SFX_FERNE_DB` in
`audio/audioManager.ts`, verschiebt die ganze Balance zwischen dumpf und hell.

## 4 Nachtrag: das Pendel der Spinne

Rückmeldung nach dem Tempo-Umbau: „der Bagger ist zu wild" — trotz 45 statt
61 °/s. Das Tempo war also nicht die Ursache. Gemessen wurde stattdessen die
Neigung der Spinne gegen die Senkrechte während eines Schwenks.

| | vorher | nachher |
|---|---|---|
| Beharrungsneigung im Schwenk | **27,4°** | **14,2°** |
| Spitze | 32,7° | 17,5° |
| **Zittern im gleichmäßigen Schwenk** | **±3,5°** | **±0,73°** |
| Nachpendeln bis unter 2° (leer) | 2,48 s | 0,62 s |
| Nachpendeln mit 4 t | — | 2,1 s |

Zwei Befunde:

1. **Das Zittern war Zahlenrauschen.** Die Beschleunigung, die das Pendel
   antreibt, wird zweimal aus Positionsdifferenzen gebildet. Ein gedämpftes
   Pendel unter gleichbleibender Fliehkraft muss ruhig stehen; es zitterte um
   ±3,5°. Die Beschleunigung wird jetzt geglättet (0,09 s).
2. **27,4° sind rechnerisch richtig und trotzdem falsch.** Bei 45 °/s und 8 m
   Radius wirken 4,9 m/s² Fliehkraft; ein frei hängendes Pendel stellt sich
   dann auf 26,7° schräg. Eine echte Spinne hängt aber nicht frei: Im
   Kardangelenk sitzt Reibung, der Schlauchbaum zieht zurück. Das ist jetzt
   als zusätzliche Rückstellung modelliert (`GELENK_STEIFE`), sie halbiert
   den Ausschlag. Dazu ein Anschlag bei 17° je Achse.

Die Dämpfung bleibt lastabhängig: leer beruhigt sie sich in 0,6 s, mit vier
Tonnen pendelt sie 2,1 s nach. Das soll man sehen.

## 5 Was am Schrott gemessen wurde — und warum nichts geändert wurde

Zweiter Teil der Rückmeldung: „die Spinne und der Schrott verhalten sich zu
wenig realistisch". Vermutung war: Alle Kollisionskörper der Schrottteile sind
Quader (`cuboid`), und Quader können sich nicht verhaken — daher flache,
aufgeräumte Haufen.

Der erste Messwert schien das zu bestätigen: Der gewachsene Haufen auf dem
Platz schüttet mit **14,5°** (122 Teile, 9,2 m Radius, 2,38 m hoch). Echter
Schrott schüttet mit 45 bis 60°.

**Die Vermutung hielt der Nachprüfung nicht stand.** Im kontrollierten Versuch
— 40 gleiche Profile aus 3,2 m auf freie Fläche geschüttet — ergab dieselbe,
unveränderte Fassung:

| Lauf | Schüttwinkel |
|---|---|
| A | 38,8° |
| B | 24,1° |

Die Streuung zwischen zwei Läufen derselben Fassung ist größer als jeder
Effekt, den die Änderung hätte haben können. Die Physik schüttet also mit
24 bis 39°, nicht mit 14,5. Die 14,5° des Platzhaufens kommen nicht von den
Kollisionskörpern, sondern davon, **wo** abgeladen wird und dass der Radlader
den Haufen flachschiebt.

Eine gebaute Änderung (Querstück am Ende langer Teile, sichtbar und im
Kollisionskörper) wurde deshalb **nicht übernommen**: Sie ließ sich nicht als
Verbesserung belegen, und eine Änderung ohne Beleg gehört nicht in den Stand.

Was daraus folgt: Der Schrott braucht denselben Aufbau wie die Spinne — ein
Labor mit wiederholbaren Läufen, in dem ein Schüttwinkel über zehn Versuche
gemittelt wird, statt einmal zu messen und sich zu freuen. Vorher lohnt es
nicht, an Formen oder Reibung zu drehen.

## 6 Drehwerk-Endtempo und Pflügen

Zwei Rückmeldungen nach dem Pendel-Umbau: „der Turm ist zu schnell" und „es
fliegt wie nichts durch den Schrott, obwohl die Masse den Kran abbremsen
sollte".

### Endtempo

45 °/s waren zu viel. Der Wert lag bewusst im Datenblattbereich (7 bis 9
Umdrehungen je Minute = 42 bis 54 °/s) — nur ist das das **Höchste, was die
Maschine kann**, und ein Fahrer benutzt es fast nie. Im Spiel kennt die Taste
kein Halbgas, also fährt der Spieler dauernd Anschlag. Das Endtempo muss darum
ein Arbeitstempo sein: **36 °/s, sechs Umdrehungen je Minute.**

Das frühere „zu langsam" galt nicht dem Grundtempo, sondern der Last („alles
bis vier, fünf Tonnen sollte kein Problem sein") — dafür sorgt `tempoFaktor`,
nicht `CAB_MAX`. Der Test in `reach.test.ts` prüft jetzt 30 bis 42 °/s statt
42 bis 54, mit dieser Begründung.

### Pflügen durch den Haufen

Der Widerstand war vorhanden und griff auch — er war nur zu schwach:

| | vorher | nachher |
|---|---|---|
| verdrängte Masse in der Prüfkugel (1,15 m) | 800–1260 kg | unverändert |
| Faktor daraus | 0,43–0,54 | **0,41 bei 800 kg** |
| Schwenk im Haufen | 15,6–19 °/s | **12,6 °/s** |
| Schwenk in freier Luft | 45 °/s | 36 °/s |
| Beschleunigung im Haufen | wie in freier Luft | **halb so groß** |

Zwei Änderungen:

1. `PLOW_HALF_KG` von 900 auf **500**, Untergrenze von 0,35 auf **0,2**. Der
   Arm ist kinematisch — er kann durch Kontakt gar nicht gebremst werden.
   Dieser Faktor ist der einzige Ersatz für die Kraft, die eine Tonne
   verhakter Stahl einem Ausleger entgegensetzt, und eine Tonne hält einen
   Ausleger fast auf.
2. Das Pflügen bremst jetzt auch den **Anlauf** (`PFLUG_TRAEGHEIT`). Vorher
   sprang der Arm im Material genauso munter an wie in der Luft und war bloß
   früher fertig — das las sich wie ein Spielzeug, das durch Watte fährt.

Im Haufen bleibt damit rund ein Drittel des freien Tempos übrig.
