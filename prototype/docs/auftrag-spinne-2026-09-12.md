# Auftrag: Spinne neu — Briefing vom 12.09.2026

> „Lass das Spinnenkonzept überarbeiten, das ist aus dem Gleichgewicht geraten."

Gebaut wird im **Prüfstand** (`labor.html`), nicht im laufenden Spiel. Genau
dafür wurde er am 11.09.2026 angelegt. Erst wenn sie dort steht, kommt sie
hinüber.

---

## 1. Leitsatz

**Eine Spinne ist ein hydraulisches Werkzeug mit enormer Kraft.** Alles, was
sie aufhält, muss aus dem Material kommen — aus einem massiven Träger, einer
Betonwand, einem Motorblock. Nichts darf sie aufhalten, weil eine Regel im
Code es so vorsieht.

Der Satz, an dem sich jede Entscheidung messen lässt (O-Ton):

> „Grundsätzlich sollte die Spinne natürlich massiv sein und funktioniert über
> Hydraulik und enorme Kraft, und es muss schon ein sehr massives Teil zwischen
> einem Zahn liegen, dass die Spinne nicht zugreift. … Sie hat enorm Griffkraft,
> das sollte eigentlich nie das Problem sein."

---

## 2. Befunde — was heute falsch ist

### 2.1 Sie schwebt über der Ladung

> „Wenn man über Ladung ist, dann schwebt sie da drüber. Man kann nicht weiter
> runtergehen … ich gehe davon aus, sie wird gebremst."

**Ursache gefunden, keine Vermutung.** In `excavator.ts` sitzt eine
Abwärtssperre (`eindringtiefe` → `eindringGrenze`). Sie rechnet aus, wie tief
die Krallen in einen Körper eindringen würden, und stoppt den Arm, sobald es
mehr als `EINDRING_OK = 0,18 m` wären — aber nur bei Körpern ab
`EINDRING_SCHWER_KG = 350 kg`.

Das ist keine Physik, das ist eine Regel. Und die Schwelle ist niedrig: Ein
großer Teil des Schrotts wiegt mehr als 350 kg, also greift sie ständig.

**Soll:** Sie darf sich in Haufen hineinwühlen und -quetschen. Gebremst wird
sie dort, wo das Material wirklich nicht nachgibt — nicht vorher.

> „Sie kann sich natürlich in Schrottberge reinwühlen, wirklich reinquetschen,
> und das ist dann auch irgendwo gebremst, ist auch alles fein — aber wir
> sollten verhindern, dass es vorher gebremst wird."

### 2.2 Sie bleibt offen, wenn etwas dazwischen liegt

> „Wenn man mehrere Sachen packt und da sind zwei Sachen, bleibt sie ja offen.
> Also das sollte schon mal gar nicht sein."

**Ursache.** `clawBlockedBy` stuft alles als blockierend ein, was nicht
pressbar ist (`isCrushable`). Das trifft auf sehr viel zu. Jeder Zahn bleibt
dann stehen, und die Spinne schließt nicht mehr.

Seit dem 12.09.2026 hat zusätzlich jeder Zahn ein Weggeld — 0,12 rad an
massivem Stahl, 0,40 rad an Nachgiebigem. Das war als Antwort auf
„die Zähne tauchen durch die Objekte" gedacht und ist im Prinzip richtig, aber
die Einstufung darunter stimmt nicht.

**Soll:** Einzelne Zähne dürfen stehenbleiben — aber nur an wirklich massiven
Teilen, einem Stahlträger etwa. Der Regelfall ist: Sie schließt.

> „Es war natürlich gedacht, dass Zähne auch mal einzeln stehenbleiben können,
> gerade wenn du einen Stahlträger packst."

### 2.3 Sie greift durch Wände

**Ursache.** `clawBlocked` überspringt alles, was nicht dynamisch ist
(`if (!b.isDynamic()) return true`). Betonwände, Containerwände, Muldenwände
halten die Zähne also überhaupt nicht auf.

Damit steht es genau verkehrt herum zu dem, was es sein soll: Ein 350-kg-Teil
stoppt den ganzen Arm, eine Containerwand aber keinen einzigen Zahn.

> „Eine Spinne kann auch nicht durch Wände gehen. Containerwände etc."

### 2.4 Sie greift, was nicht unter ihr liegt

**Soll:** Nur, was **genau** im Greifbereich liegt.

> „Insgesamt sollte sie halt auch nur das greifen, was genau präzise in der
> Spinnenreichweite liegt und nicht mehr."

Heute: `SENSOR_RADIUS = 1,05 m` als Kugel um die Spinnenmitte, dazu
`MIN_KRALLEN = 2` Kontakte. Der Bereich ist eine Kugel, die Schale aber ein
Korb — das passt nicht zusammen.

### 2.5 Zu wenig Bewegung

> „Sie sollte auch mehr schwenken. Man sollte sie auch umschmeißen können, das
> heißt, wenn ich sie auf die Seite lege, das sollte möglich sein — wenn der
> Arm drückt und sie irgendwo hängt, oder auf dem Boden zur Seite zu legen, das
> sollte alles gehen."

Heute hängt sie am Kardangelenk mit `GELENK_STEIFE = 1,0` und einem
Ausschlagdeckel von 17°. Sie pendelt also, aber sie lässt sich nicht ablegen
und nicht gegen etwas drücken.

---

## 3. Entschieden

| Frage | Entscheidung |
|---|---|
| **Kapazität** | Nach **Volumen**, nicht nach Stückzahl. Was zwischen die geschlossenen Schalen passt, kommt mit. Die Grenze von 5 Stück fällt weg; das Gewicht bleibt als Hubgrenze. |
| **Größe** | Darf gern **etwas größer** werden. Maßgabe ist nicht das Datenblatt, sondern: „dass man jedes Teil auch gut packen kann, auch größere Tanks, und dass sie fast alle Objekte greifen kann". |
| **Schalenform** | Die ovale Form darf bleiben. Gern **oben breiter als unten**. **Wichtig: Sie müssen komplett abschließen.** |
| **Vorgehen** | Alles neu, **im Labor**. |
| **Schalen** | **Fünf**, wie bisher. Bewährte Zahl bei Umschlaggreifern: dicht genug für einen Korb, grob genug, dass man die einzelne Schale noch sieht. |
| **Hubkraft** | **Vom Ausladen abhängig** — nah am Bagger hebt sie schwer, weit draußen wird es leicht. Das gibt dem Ausfahren Gewicht und macht Heranfahren zu einer Entscheidung. Braucht eine Anzeige, sonst wirkt es willkürlich. |
| **Umschmeißen** | Sie soll sich **selbst ablegen** können: Wenn der Arm drückt, kippt sie am Kardangelenk zur Seite und legt sich hin. **Kein Rammbock** — Dinge umstoßen und Haufen zusammenschieben gehört ausdrücklich nicht dazu. |
| **Widerstand** | Ein Zahn bleibt **nur an massivem Vollmaterial** stehen: Träger, Motorblock, Schiene, Betonwand. Gemessen an der Hüllendichte — dieselbe Rechnung, die schon entscheidet, was pressbar ist (E-067: unter 260 kg/m³ pressbar, Träger liegt bei 792, Profilstahl bei 2051). Alles andere wird beiseitegeschoben oder eingedrückt. |

---

## 4. Was das für den Bau heißt

1. **Bremsen raus.** Die Abwärtssperre gegen Brocken (`eindringtiefe`,
   `EINDRING_SCHWER_KG`) fällt weg. Der Bodenanschlag gegen den Beton bleibt —
   durch den Boden soll sie nicht.
2. **Blockierung umdrehen.** Feste Bauwerke halten die Zähne auf; heute werden
   sie übersprungen. Bewegliches hält nur auf, wenn die Hüllendichte es als
   Vollmaterial ausweist — die Schwelle liegt weit über „nicht pressbar".
3. **Greifbereich ist ein Korb, keine Kugel.** Gegriffen wird, was zwischen den
   Schalen liegt, wenn sie sich schließen. `SENSOR_RADIUS` als Kugel fällt weg.
4. **Kapazität nach Volumen.** Was zwischen die geschlossenen Schalen passt,
   kommt mit. `MAX_ITEMS = 5` fällt weg, das Gewicht bleibt als Hubgrenze.
5. **Schalen schließen dicht** und dürfen oben breiter sein als unten. Heute
   sind es fünf gekrümmte Finger mit Lücken dazwischen.
6. **Hubkraft über dem Ausladen**, mit einer Anzeige im Instrument.
7. **Kardangelenk weicher**, damit sie sich ablegen lässt. Heute ist der
   Ausschlag auf 17° gedeckelt und federt immer zurück.

---

## 5. Reihenfolge

Gebaut wird im Prüfstand (`labor.html`). Er hat keinen Platz, keine LKW und
keine Wirtschaft — nur die Spinne, Prüfkörper und Messwerte. Genau dafür wurde
er am 11.09.2026 angelegt: die Spinne nicht im laufenden Spiel umzubauen.

1. Schalenform und Schließen — der Korb muss dicht sein.
2. Widerstand und Blockierung — Hüllendichte statt Massenschwelle, Bauwerke
   halten auf.
3. Greifbereich und Volumen — was zwischen den Schalen liegt, kommt mit.
4. Aufhängung — ablegen, andrücken.
5. Hubkraft über dem Ausladen.
6. Erst dann ins Spiel, und dort gegen die vorhandenen Maße prüfen: Presskammer
   4,20 m licht, Absetzcontainer 4,08 m (`test/spinnenmass.test.ts`). Wird die
   Spinne breiter, müssen beide mitwachsen.

---

## 6. Noch offen

- **Anzeige der Hubkraft.** Wo und wie — Balken im Instrument, Farbe am
  Greifer, Warnton? Entscheidet sich, wenn die Kurve steht.
- **Wie weich die Aufhängung beim Ablegen wird.** Das lässt sich nur im
  Prüfstand erfühlen, nicht vorher festlegen.
