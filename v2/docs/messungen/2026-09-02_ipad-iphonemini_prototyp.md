# Gerätetest Prototyp — iPad und iPhone mini

Datum: 02.09.2026 · Tester: Patrick · Build: GitHub-Pages-Fassung des Prototyps (Stand M3)
Methode: freies Spielen, subjektive Beobachtung. Keine Zahlenmessung (kein Overlay auf Touch erreichbar).

Dies ist die **erste Beobachtung auf echter Hardware** im ganzen Projekt. Alle bisherigen
Aussagen zur Mobil-Tauglichkeit waren aus dem Code abgeleitet.

---

## Beobachtungen

| # | Beobachtung | Bewertung |
|---|---|---|
| 1 | Bagger bewegt sich **generell flüssig** | Entwarnung: keine Zeitlupe, keine Ruckelkatastrophe |
| 2 | Bagger **fährt/rollt zu langsam** | Balancing, kein technisches Problem |
| 3 | **Spinne bremst an falschen Stellen** — sinnvoll beim Schwenken durch einen Schrottberg, unsinnig beim Absenken von oben ohne Materialkontakt | Kernbefund, siehe unten |
| 4 | Touch auf **iPad in Ordnung**, auf **iPhone mini eng — Schaltflächen überlappen** | bestätigt A4 §2.2/2.3 |
| 5 | **iPad wird beim Spielen warm**; spielbar, "könnte flüssiger laufen" | bestätigt A2 §5 (Draw Calls) |
| 6 | **Kein Zittern.** Aber visuell falsch: Schrott hängt in der Luft, eine Zacke steckt im Teil, Schrott schwebt unter der Spinne | Kernbefund, korrigiert A2 §6 |

---

## Deutung mit Codestelle

### Befund 3 — Warum die Spinne zu früh bremst (BELEGT)

`excavator/collision.ts:102-125`: Der Pflügwiderstand summiert die Masse aller dynamischen
Körper in einer **Kugel mit Radius 1,45 m** (`PLOW_R`), deren Mittelpunkt 1,35 m unter dem
Greiferknoten liegt. Der Schalenkorb selbst ist deutlich kleiner. Die Kugel enthält also
Material, **lange bevor die Spinne es berührt**.

`excavator.ts:1022-1023`: Der daraus errechnete `plowFactor` (bis herunter auf 0,14) wird als
`loadFactor` auf **alle Achsgeschwindigkeiten** multipliziert — unabhängig davon, in welche
Richtung sich der Arm bewegt. Beim Absenken von oben auf einen Haufen bremst also Material,
das gar nicht verdrängt wird.

Zweite Bremse: `armHits()` (`collision.ts:134-141`) prüft unter anderem `grappleHitsBody()` mit
einer Kugel von 0,62 m (`PROBE_R`) und stoppt den Arm **hart** (`excavator.ts:1147-1164`,
Rückrollen auf den Vorzustand plus Nullen aller Geschwindigkeiten). Kein Gleiten, kein
Nachgeben — ein Ein/Aus-Schalter.

**Für v2:** Widerstand nur aus tatsächlichen Kontakten und nur in Bewegungsrichtung
(Shape-Cast entlang des Bewegungsvektors statt Kugel um den Greifer); Sondenradius an die
echte Schalenkorb-Geometrie binden (`clawGeometry.ts` ist dafür schon die eine Wahrheit);
Widerstand proportional zur Eindringtiefe statt binär; harten Stopp durch Gleiten ersetzen.

### Befund 6 — Warum Schrott falsch in der Spinne hängt (BELEGT)

`physics/gripSystem.ts:208-228`: Beim Greifen wird ein Fixed Joint mit **genau der
Relativlage erzeugt, die das Teil im Moment des Zupackens zufällig hatte** — der Kommentar im
Code sagt es wörtlich: „Joint hält die aktuelle Lage exakt fest."

Gefasst wird aber schon, wenn der **nächstgelegene Oberflächenpunkt** des Teils im
Schalenkorb liegt (`gripSystem.ts:176-184`, `projectPoint`). Bei einem langen Träger oder
einer Karosse ist das ein Zipfel — der Rest bleibt weit außerhalb und wird in dieser
schiefen Lage eingefroren. Ergebnis: schwebender Schrott, Zacken, die im Material stecken.

Verstärkend: `excavator.ts:964-985` schaltet die Krallen-Kollider beim Tragen **ganz ab**,
damit sie nicht mit der Ladung kämpfen — dann fährt aber alles sichtbar durcheinander.

**Für v2:** Nach dem Zupacken das Teil über ~0,15 s in eine definierte Haltepose ziehen
(nächster Oberflächenpunkt wandert in die Korbmitte, Ausrichtung an der Greiferachse);
Ladung kinematisch mitführen statt per Fixed Joint (Muster der Fahrzeuge,
`delivery/vehicles.ts:511-521`); Krallen-Kollider aktiv lassen und stattdessen die Ladung
aus deren Kollisionsgruppe nehmen.

### Befund 5 — Wärme auf dem iPad

Ein iPad ist deutlich stärker als das Zielgerät (Android-Mittelklasse). Wenn es dort schon
warm wird und "flüssiger laufen könnte", ist das Renderbudget auf dem Zielgerät gerissen.
Das deckt sich mit A2 §5: 3 139 Meshes, 1 281 Schattenwerfer, kein Instancing, 8 Lichter.
Das Performance-Paket ist damit **nicht optional**, unabhängig von der Engine-Entscheidung.

---

## Was das für die Entscheidung bedeutet

- **Kein No-Go.** Die Physik ist auf echter Hardware nicht der Flaschenhals, den die
  Hochrechnung (3–5× langsamer als Desktop) befürchtet hat. Das entlastet den Web-Stack.
- **Die Vermutung "Zittern durch Fixed Joint" war falsch** — es zittert nicht. Der Fixed
  Joint macht stattdessen etwas anderes kaputt: die Haltepose. Die Gegenmaßnahme bleibt
  dieselbe (kinematisch mitführen), die Begründung ändert sich.
- **Das, was sich "unrund" anfühlt, ist jetzt benannt:** zu früh bremsende Assistenz und
  falsche Haltepose. Beides sind Tuning- und Logikfehler, keine Engine-Grenzen — sie würden
  bei einem Umzug nach Unity unverändert mitreisen, wenn man sie nicht versteht.
- **Touch muss neu gedacht werden**, nicht nachgebessert: Auf dem iPad geht es, auf dem
  iPhone mini überlappen die Flächen. Das Layout mit absoluten Pixelpositionen
  (`index.html:120-146`) skaliert nicht.

## Offen

- Keine Zahlen (fps, ms). Ein Build mit sichtbarem Zähler wäre der nächste Schritt, wenn
  belastbare Werte gebraucht werden.
- Kein Test auf Android-Mittelklasse — das bleibt die eigentliche Zielhardware.
- Punkt 4 (Verhalten nach 5 Minuten mit vollem Platz) nur teilweise geprüft: es kamen
  Privatleute ohne Schrott, der Platz war nicht voll.
