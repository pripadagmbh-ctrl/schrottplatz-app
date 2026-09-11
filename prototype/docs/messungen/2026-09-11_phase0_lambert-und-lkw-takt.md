# Phase 0 — Messung: Lambert und LKW-Takt (11.09.2026)

Auftrag vom 11.09.2026, Punkte 0.2 (Debug-Overlay vorher/nachher) und 0.3
(LKW-Takt messen, noch nichts ändern). Gemessen im laufenden Spiel über
`__game.step()` bei abgeschalteter Bildschleife, damit die Schrittzahl exakt
ist und nicht von der Bildwiederholrate abhängt.

## 0.2 Aufgeweckte Körper durch Lambert

Gezählt wird, was im Umkreis von 4 m um Lambert von schlafend auf wach
springt; schlafende Teile werden schon ab 12 m vorgemerkt, sonst entgeht
genau das Aufwachen der Teile, auf die er zufährt. Fenster: eine Minute.

| Minute | vorher (pflügt quer durch) | nachher (Wegprüfung an) |
|---|---|---|
| 1 | 73 | 17 |
| 2 | 6 | 0 |
| 3 | 5 | 0 |
| 4 | 1 | 0 |

Die erste Minute ist die aussagekräftige: Dort steht der frische Haufen, und
dort fuhr er vorher hinein. Danach ist in beiden Fällen wenig los, weil der
Haufen ohne Spieler liegen bleibt.

Zwei Nebenbefunde aus derselben Messung:

- Er stieg aus dem Radlader aus, auch wenn es zu Fuß ebenfalls nichts zu tun
  gab. Jetzt wird erst gesucht, dann abgestiegen.
- Die Kaffeepause greift: 52 s → 105 s in der Probe, also 53 s Pause
  innerhalb der vorgegebenen 30–90 s, danach zurück zur Maschine.

## 0.2 Nachtrag: Lambert stand in der Abladestelle

Befund vom Gerät: "Lambert fährt immer noch durch die Abladestelle." Nachgemessen,
Position viermal je Sekunde über 5 Minuten:

| | vorher | nachher |
|---|---|---|
| Zeit im Abkippplatz (0/7, 8 × 8 m) | **92,6 %** | **2,4 %** |

Zwei Ursachen, beide behoben:

1. **Er steckte fest.** Ein LKW parkte über ihm; jeder Schritt landete in
   dessen Standfläche und wurde verworfen — auch der Schritt, der ihn
   herausgeführt hätte. Er stand reglos bei (3, 5). Jetzt gilt: War der alte
   Platz ebenfalls belegt, wird nicht zurückgesetzt, sondern nach draußen
   gesteuert und zurückgestoßen, wie es ein Fahrer täte.
2. **Seine Standplätze lagen mitten im Abkippplatz.** Der Einweisplatz war
   (3,6 / 8,5), also mittendrin. Patrouille und Einweisplatz liegen jetzt
   außerhalb, bei z ≈ 13 und (6 / 11,5).

Dazu die Regel aus dem Wunsch: Mit der Maschine fährt er nicht mehr durch
Abkippplatz, Stahlhaufen oder Ballenlager — geprüft wird die Strecke gegen
die Zonen (um 1 m geschrumpft, damit Arbeit an der Kante möglich bleibt). Und
er holt nur, was frei liegt: Mehr als zwei Nachbarn im Umkreis von 1,8 m, und
das Teil gilt als vergraben.

## 0.3 LKW-Takt

### Wo er eingestellt wird

- `delivery/routes.ts`: `FIRST_DELAY_S = 12`, `NEXT_DELAY_S = [7, 15]`.
- `economy/shift.ts`: `intervalFactor(looseKg) = clamp(0,6 + looseKg/6000 ×
  0,9 ; 0,6 ; 2,2)` — auf vollem Platz lassen sie mehr Luft.
- `economy/shift.ts`: `BUSY_KG = 6000`, `JAM_KG = 16000`,
  `JAM_CLEAR_KG = 11000` — über 16 t macht die Einfahrt zu, unter 11 t wieder
  auf.
- `delivery/vehicles.ts`: Es ist **immer nur ein Fahrzeug aktiv**. Der
  nächste Termin wird erst gesetzt, wenn das aktive Fahrzeug den Abladeplatz
  verlässt (Warteplatz oder Ausfahrt).

### Ist der Takt fest oder hängt er an Tag/Level?

Weder noch. Er hängt am **Platzzustand** und vor allem daran, **wie schnell
der Spieler ablädt**. Tag und Ausbaustufe gehen nirgends ein.

### Gemessen

**Ohne Spieler** (niemand lädt ab): Nach der ersten Anlieferung steht alles.
Ein Wrack-LKW wartete in `waitUnload` nach 242 s immer noch — für diese Phase
gibt es keine Zeitgrenze. In 300 s kam genau **eine** Fuhre.

**Mit simuliertem Spieler** (Ladung nach 5 s von der Fläche genommen):

| Größe | Wert |
|---|---|
| Anlieferungen in 301 s | 6 |
| Abstand zwischen Ankünften | 7,5 s · 66,1 s · 75,6 s · 65,1 s · 71,6 s |
| loser Schrott nach 301 s | 12 676 kg, 121 Teile (alle schlafend) |
| Körper gesamt / wach | 161 / 30 (bewegliche: 127, davon wach 0) |

Der Takt wird also **nicht** von `NEXT_DELAY_S` bestimmt: 7–15 s Wartezeit
stehen rund 60 s Fahr- und Rangierzeit gegenüber. Hochgerechnet auf einen
Arbeitstag von 900 s sind das etwa **12 bis 13 Fuhren am Tag**, wenn sofort
abgeladen wird — und 1 Fuhre, wenn nicht.

### Was daraus folgt (Vorschlag für Phase 3, noch nicht umgesetzt)

1. Die Schraube „Wartezeit zwischen zwei Fuhren" ist stumpf, solange nur ein
   Fahrzeug gleichzeitig auf den Platz darf. Wer den Takt erhöhen will, muss
   zulassen, dass ein zweites Fahrzeug wartet, während das erste noch ablädt.
2. `waitUnload` braucht eine Zeitgrenze, sonst legt ein einziges schwer zu
   greifendes Wrack den ganzen Betrieb still.
3. Die Auslastung über `looseKg` zu steuern greift erst spät: Bei 12,7 t nach
   fünf Minuten steht der Platz kurz vor `JAM_KG`, ohne dass ein Spieler je
   etwas sortiert hätte.
