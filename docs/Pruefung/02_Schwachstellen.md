# Schwachstellen — meine eigene Einschätzung

Ungeschönt, damit der prüfende Agent weiß, wo er zuerst graben sollte. Das
sind keine bekannten Fehler, sondern Stellen, an denen ich **nicht belegen
kann**, dass es richtig ist.

Sortiert nach Risiko für das Vorhaben, nicht nach Aufwand.

---

## 1. Die Handy-Tauglichkeit ist unbelegt — Risiko: hoch

Das Spiel soll in den Play Store. Gemessen wurde ausschließlich im
Desktop-Browser auf einem Windows-Rechner.

**Was ich weiß:** 2,78 ms reiner Physikschritt bei 218 Körpern, 4,42 ms mit
Spiellogik, von einem 16,7-ms-Budget.

**Was ich nicht weiß:** wie sich das auf einem echten Android-Mittelklassegerät
verhält. Ich rechne mit Faktor drei bis vier — das ist eine **Faustregel ohne
jeden Beleg in diesem Projekt**. Träfe sie zu, läge der Physikschritt allein
bei 8 bis 11 ms, und mit Zeichnen wäre das Budget gerissen.

**Verschärfend:** Die Last ist gegenüber dem letzten Bericht um 56 % gestiegen
(1,78 → 2,78 ms), obwohl die Bündelung die Teilezahl inzwischen deckelt. Die
Ursache liegt in schwereren Kontakten und zusätzlichen Kollisionsprüfungen —
also genau in den Verbesserungen, die der Auftraggeber verlangt hat. Weitere
Verbesserungen dieser Art werden weiter kosten.

**Was zu tun wäre:** Auf echter Hardware messen, bevor noch etwas gebaut wird.
Alles andere ist geraten.

---

## 2. Die Tests prüfen Rechnen, nicht Spielen — Risiko: hoch

97 Tests klingen solide. Sie decken ab: Verhandlungsarithmetik, Ruf, Ausbau,
Sortenreinheit, Kundenprofile, Hindernisgeometrie, Führung, Speichern.

Sie decken **nicht** ab:

- ob sich der Bagger gut steuern lässt
- ob das Material sich schwer anfühlt (die Kernbeschwerde des Auftraggebers!)
- ob Lambert nützlich wirkt
- ob die Verhandlung Spaß macht
- ob irgendetwas auf dem Bildschirm richtig aussieht

Die fünf Physikwerte in `01_Behauptungen.md` Abschnitt 9 — Flugweiten,
Bodenhärte, Pflügwiderstand — sind die Begründung dafür, dass die
Materialphysik jetzt stimmt. **Für keinen dieser Werte gibt es einen Test.**
Wenn jemand an der Dämpfung dreht, merkt es niemand.

**Was zu tun wäre:** Für die fünf Werte Tests bauen. Sie sind messbar: Teil
fallen lassen, Impuls geben, Flugweite messen. Das ist kein Spielgefühl,
sondern Physik, und Physik lässt sich festhalten.

---

## 3. `world/` ist ein blinder Fleck — Risiko: mittel

4 021 Zeilen in 12 Dateien, **null eigene Tests**. Darin: der Platz, die
Schrottteile, die Container, die Presse, das Gebäude, die Leute, der Radlader,
der Zaun, das Tageslicht.

Der Grund ist real — das meiste braucht eine laufende Rapier-Welt und eine
Three.js-Szene, beides schwer im Testlauf aufzubauen. `collision.test.ts`
zeigt aber, dass es geht: Die Hindernisliste ist reine Geometrie und ohne
Szene testbar. Dasselbe ließe sich für mehr Teile von `world/` herausziehen.

**Was zu tun wäre:** Prüfen, welche Teile von `world/` sich wie `obstacles.ts`
als reine Rechenlogik herauslösen lassen.

---

## 4. Ich habe meine eigene Arbeit abgenommen — Risiko: mittel

Jede Messung, jeder Test, jede Einschätzung in dieser Mappe stammt von mir.
Ich habe den Code geschrieben, die Tests dazu geschrieben und dann festgestellt,
dass sie grün sind. Das ist die schwächste Form von Beleg.

Besonders anfällig dafür:

- **Die vier Verhandlungstests** habe ich geschrieben, *nachdem* ich das
  Briefing-Kapitel verfasst hatte — sie bestätigen also meine eigene
  Beschreibung, nicht die Absicht des Auftraggebers.
- **Die Zahlen im Werkstattbericht** habe ich selbst erhoben und selbst
  interpretiert.

**Was zu tun wäre:** Genau das, wofür diese Mappe angelegt wurde.

---

## 5. Zwei Stellen, an denen ich Zahlen für zufällig halte

**Die Privatleute-Grenze liegt exakt auf der Kante.** Bei voller Sortenreinheit
ist die Toleranz 0,50 − 0,18 = 0,32 und der harte Abschlag ebenfalls 0,32.
Angenommen wird über `≤`. Ändert jemand `OFFER_FACTOR.hart` von 0,68 auf 0,67,
lehnen Privatleute plötzlich ab — ein Verhalten, das dem Briefing widerspricht
(„kennen die Preise nicht, nehmen fast alles hin"). Das ist ein Test wert, der
die *Absicht* festhält statt der Zahl.

**Händler-Toleranz 0,31 gegen Gewerbe 0,30.** Diese beiden Werte liegen so
dicht beieinander, dass der Unterschied zwischen den Gruppen praktisch
ausschließlich über die Familienhärte entsteht. Das funktioniert, wirkt aber
wie ein Zufall statt wie eine Entscheidung. Wenn es Absicht ist, gehört es
kommentiert; wenn nicht, gehört es sortiert.

---

## 6. Der Ausbau hat eine merkwürdige Reihenfolge — Risiko: klein

Der Radlader kostet 12 000 € und ist ab 0 t verfügbar. Das Büro kostet
9 000 € und erst ab 15 t. Das billigere Teil kommt also später. Ob das eine
sinnvolle Progression ergibt, weiß ich nicht — ich habe das Spiel nicht bis
dahin gespielt.

Ungeprüft ist auch, ob die Umschlagschwellen (15 t bis 160 t) überhaupt
erreichbar sind, ohne dass es zäh wird. Dafür bräuchte es einen
Durchlauf über mehrere Spieltage, den es nie gegeben hat.

---

## 7. Was der Auftraggeber zuletzt bemängelt hat

Zur Einordnung, weil es zeigt, welche Art Fehler hier durchrutscht:

- **Dialoge waren unsichtbar.** Verhandlung und Abholung öffneten sich nicht,
  weil für die drei Fenster **überhaupt keine Gestaltungsregeln existierten**.
  Der Code lief korrekt, die Fenster standen im Baum, nur unsichtbar. Gefunden
  über berechnete Stile im Browser. → Wenn etwas nicht erscheint, obwohl die
  Logik stimmt: zuerst prüfen, ob es Regeln zum Anzeigen gibt.
- **Rapier-Abstürze durch vorzeitigen Abbruch.** Die Physik-Engine hält ihre
  Welt während einer Abfrage geborgt. Bricht ein Callback vorzeitig mit
  `return false` ab, bleibt der Borrow offen und der nächste schreibende
  Zugriff stürzt mit „recursive use of an object" ab. → Abfragen laufen
  überall bis zum Ende durch. **Prüfe, ob das wirklich überall gilt.**
- **Ein Kunde kam im falschen Fahrzeug**, weil `rollCustomer()` zweimal
  gewürfelt wurde — einmal fürs Fahrzeug, einmal fürs Profil. → Prüfe, ob es
  weitere Stellen gibt, an denen zufällige Werte doppelt gezogen werden.
