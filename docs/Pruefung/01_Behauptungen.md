# Behauptungen mit Prüfbefehl

Jede Zeile im Werkstattbericht und im Briefing Kap. 27, die eine Zahl oder
eine Tatsache behauptet — hier mit dem Befehl, der sie widerlegt oder
bestätigt. Alle Befehle laufen aus `prototype/`, sofern nicht anders vermerkt.

**Legende der Herkunft:**
- **[gemessen 02.09.]** — an diesem Tag von mir neu gemessen
- **[übernommen]** — aus einer früheren Sitzung, **nicht** neu belegt.
  Diese Werte sind mit Vorsicht zu behandeln.

---

## 1. Umfang und Tests

| Behauptung | Wert | Prüfbefehl (Bash) |
| --- | --- | --- |
| Quellzeilen | 12 309 | `find src -name "*.ts" -exec cat {} + \| wc -l` |
| Quellmodule | 45 | `find src -name "*.ts" \| wc -l` |
| Testzeilen | 919 | `find test -name "*.ts" -exec cat {} + \| wc -l` |
| Tests grün | 97 in 8 Dateien | `npm test` |
| Größte Datei | `excavator.ts`, 1 604 | `find src -name "*.ts" -exec wc -l {} + \| sort -rn \| head -5` |
| Zweitgrößte | `vehicles.ts`, 1 100 | dito |

Auf diesem Rechner ist PowerShell die Standardschale. Entsprechung:

```powershell
$src = Get-ChildItem src -Recurse -Filter *.ts
"Module: $($src.Count)  Zeilen: $(($src | Get-Content).Count)"
```

> **Falle:** `Measure-Object -Line` zählt **Leerzeilen nicht mit** und liefert
> hier 11 476 statt 12 309. Wer damit misst, glaubt, die Mappe lüge. Für einen
> Wert, der `wc -l` entspricht, `(… | Get-Content).Count` benutzen.

**[gemessen 02.09.]** Testaufteilung, muss exakt so herauskommen:

```
collision.test.ts   18     customers.test.ts   17
upgrades.test.ts    16     haggle.test.ts      15
purity.test.ts      11     tutorial.test.ts     9
shift.test.ts        8     save.test.ts         3
                                        Summe: 97
```

**Zeilen je Bereich** — zeigt, wo Code ohne Test liegt:

| Bereich | Dateien | Zeilen | eigene Tests |
| --- | --- | --- | --- |
| `world/` | 12 | 4 021 | **keine** |
| `excavator/` | 6 | 2 240 | collision (18) |
| `delivery/` | 5 | 1 936 | customers (17) |
| `core/` | 6 | 850 | **keine** |
| `economy/` | 5 | 621 | haggle, upgrades, shift, purity (50) |
| `audio/` | 2 | 578 | **keine** |
| `dismantle/` | 2 | 527 | **keine** |
| `physics/` | 2 | 283 | **keine** |
| `ui/` | 2 | 255 | tutorial (9) |
| `materials/` | 2 | 81 | mittelbar über purity |

> **Prüfhinweis:** Das Verhältnis ist schief. `world/` und `excavator/` machen
> zusammen die Hälfte des Codes aus und tragen 18 Tests. Der Grund ist, dass
> beides ohne laufende Rapier-Welt und Three.js-Szene schwer zu testen ist —
> das ist eine Erklärung, keine Rechtfertigung.

---

## 2. Verhandeln (`src/economy/haggle.ts`)

Die Formel, wie sie im Code steht:

```
Grenze = max(0,05 ; Toleranz[Gruppe] − Reinheit × 0,18 − (Härte − 1) × 0,035 + Ruf × 0,1)
Angenommen, wenn Abschlag ≤ Grenze
```

| Größe | Wert | Fundstelle |
| --- | --- | --- |
| Marktpreis / leicht / hart | 1,0 / 0,85 / 0,68 | `OFFER_FACTOR` |
| Toleranz privat | 0,50 | `TOLERANZ` |
| Toleranz gewerbe | 0,30 | `TOLERANZ` |
| Toleranz haendler | 0,31 | `TOLERANZ` |
| Reinheitsmalus | × 0,18 | `reinheitsMalus` |
| Härtemalus | (h−1) × 0,035 | `haerteMalus` |
| Händler fahren bei Ablehnung ab | ja, nur Händler | `leavesOnRefusal` |

**[gemessen 02.09.]** Vier Folgerungen daraus stehen als Tests in
`test/haggle.test.ts`, Block `describe("Briefing 27.1")`:

1. Privatleute nehmen selbst hartes Drücken hin — auch bei Reinheit 1,0.
2. Härte 5 plus Reinheit 1,0 lässt nur noch den Marktpreis zu.
3. Gewerbe akzeptiert leichtes Drücken, hartes nicht.
4. Mischschrott (Reinheit 0) gibt Spielraum, den sortenreine Ware nicht gibt.

```bash
npx vitest run haggle
```

> **Prüfauftrag:** Rechne Fall 1 von Hand nach. Bei Reinheit 1,0 ist die Grenze
> 0,50 − 0,18 = 0,32, und der harte Abschlag ist **exakt** 0,32. Die Annahme
> hängt also am `≤` statt `<`. Das ist gewollt, aber knapp — prüfe, ob das
> beabsichtigt sein sollte oder ein Zufall ist, der bei der nächsten
> Zahlenänderung kippt.

---

## 3. Ruf (`src/economy/reputation.ts`)

| Ereignis | privat | haendler | gewerbe |
| --- | --- | --- | --- |
| `fairBezahlt` | +6 | +3 | 0 |
| `hartGedrueckt` | −8 | −4 | 0 |
| `kurzeStandzeit` | +1 | +2 | +7 |
| `langeWartenLassen` | −2 | −3 | −9 |
| `sauberVerwogen` | +2 | 0 | +5 |

Grenzen −100 bis +100. Vergessen pro Tag: privat 6, gewerbe 3, haendler 1,5.
Anlieferfrequenz sinkt nie unter Faktor 0,2 (`frequencyFactor`).

```bash
npx vitest run customers    # enthält den Ruf-Block
```

---

## 4. Ausbaustufen (`src/economy/upgrades.ts`)

| Ausbau | Preis | ab Umschlag | Voraussetzung |
| --- | --- | --- | --- |
| Radlader | 12 000 € | — | — |
| Büro | 9 000 € | 15 t | — |
| Bulldozer | 18 000 € | 30 t | Halle |
| Halle am Büro | 28 000 € | 50 t | Büro |
| Stapler | 22 000 € | 60 t | Halle |
| Magnet | 26 000 € | 90 t | Halle |
| Baggerausbau | 34 000 € | 120 t | — |
| Größere Presse | 42 000 € | 160 t | — |

Kontountergrenze: **−1 500 €** (`CREDIT_LIMIT_EUR` in `account.ts`). Darunter
liefert niemand mehr.

> **Prüfauftrag:** Die Reihenfolge im Bericht ist nach Preis sortiert, die
> Freischaltung aber nach Umschlag. Der Radlader kostet 12 000 € und ist ab
> 0 t verfügbar, das Büro kostet 9 000 € und erst ab 15 t. Prüfe, ob das eine
> sinnvolle Progression ergibt oder ob der Spieler den Radlader kauft, bevor
> er weiß, wofür.

---

## 5. Kundschaft (`src/delivery/customers.ts`)

| Behauptung | Wert |
| --- | --- |
| Händlerfamilien | 8 (Bäring, Lorsbach, Prieser, Hardwig, Boxmann, Zöllner, Adorf, Schmikatz) |
| Gewerbebranchen | 7 |
| Ortsnamen für Privatleute | 25, alle aus MG und Umgebung |
| Mischung beim Würfeln | 34 % privat, 40 % Händler, 26 % Gewerbe |
| Menge privat | 50–800 kg |
| Menge Händler | 2 500–9 000 kg |
| Menge Gewerbe | 1 200–6 500 kg |
| Privat fährt PKW/Wrack, **nie** LKW | `vehicleForCustomer` |

```bash
npx vitest run customers
```

> **Prüfauftrag Ton-Leitplanke:** Lies **alle** Zeichenketten in dieser Datei
> durch — Familiennamen, Vornamen, Sprüche, Ortsnamen, Branchennamen. Prüfe
> gegen die Leitplanke in `00_Start_hier.md`. Das ist wichtiger als jede
> Zahl in dieser Mappe.

---

## 6. Fahrspurüberwachung (`src/delivery/laneWatch.ts`, `routes.ts`)

| Größe | Wert |
| --- | --- |
| Halbe Spurbreite | 2,6 m |
| Ein Teil blockiert ab | 120 kg |
| Nur unterhalb von | 1,3 m Höhe |
| Fahrer hupt nach | 10 s |
| Fahrer gibt auf nach | 35 s |
| Verhandlung Notausstieg | 32 s, dann Marktpreis |

Die Routen selbst sind getestet: `test/collision.test.ts`, Fall *„hält jeden
Punkt der echten Fahrspuren frei"*. Der Test liest die zehn Routen aus
`routes.ts` — keine abgeschriebenen Werte — und prüft jeden Stützpunkt mit
1,4 m Sicherheitsabstand gegen die Hindernisliste. Er hat zwei echte
Blockaden gefangen (Wiegehäuschen über dem Bogen, zusammengerückte Mulden
über dem Verladeplatz).

> **Prüfauftrag:** Für `laneWatch.ts` selbst — also das Erkennen von Schrott,
> der *nachträglich* auf eine freie Spur fällt — gibt es **keinen Test**.
> Getestet ist nur, dass die Spuren von fest gebauten Hindernissen frei sind.
> Der Störfall im Spielbetrieb ist ungeprüft.

---

## 7. Bündelung (`src/world/scrapItems.ts`)

| Größe | Wert |
| --- | --- |
| Bündelung greift ab | 260 lose Teile (`consolidate`, Vorgabewert) |
| Zusammengefasst wird | Kleinkram unter 45 kg |
| Mindestens | 6 Teile je Bündel |

**[übernommen, nicht neu gemessen]** Eine volle Sitzung ging von 443 auf
256 Teile zurück. Diese Zahl stammt aus einer früheren Sitzung.

---

## 8. Laufzeit — die kritischen Werte

**[gemessen 02.09., Desktop-Browser]** Vorgehen in `03_Messanleitung.md`.

| Größe | Wert |
| --- | --- |
| Reiner Physikschritt | **2,78 ms** von 16,7 ms |
| Schritt mit Spiellogik | 4,42 ms |
| Körper in der Welt | 218 |
| davon wach | 108 |
| Bündelgröße gebaut | 2 741,05 kB (948,76 kB gzip) |

**[übernommen]** Der Vergleichswert 1,78 ms bei 197 Körpern stammt aus dem
vorigen Bericht und wurde nicht neu erhoben.

> **Prüfauftrag, der wichtigste der Mappe:** Miss selbst nach, auf deiner
> Hardware, und miss danach auf einem echten Android-Mittelklassegerät. Alle
> Aussagen zur Handy-Tauglichkeit sind **hochgerechnet, nicht gemessen**.
> Der Faktor drei bis vier, mit dem ich rechne, ist eine Faustregel ohne
> Beleg in diesem Projekt.

---

## 9. Physikverhalten

**[übernommen, alle nicht neu gemessen]** Diese Werte stammen aus der Sitzung,
in der die Materialphysik gebaut wurde. Sie sind plausibel, aber ungeprüft:

| Behauptung | Wert |
| --- | --- |
| Flugweite 20-kg-Teil beim Anschlagen | 1,79 m |
| Flugweite 2 000-kg-Brocken | 0,27 m |
| Boden hält Aufprall bis | 80 m/s |
| Pflügen durch einen Haufen bremst | −26 % |
| Weiteste Mulde vom Bagger | 8,8 m bei 9,8 m Reichweite |

> **Prüfauftrag:** Diese fünf Werte sind die Begründung dafür, dass sich das
> Material „schwer genug" anfühlt — die zentrale Beschwerde des Auftraggebers,
> die den Umbau ausgelöst hat. Es gibt **keinen Test**, der sie festhält. Bau
> einen, oder widerlege sie.

---

## 10. Was das Projekt *nicht* hat

Damit niemand danach sucht:

- **Keine Linter-Konfiguration**, kein ESLint, kein Prettier. Der einzige
  statische Prüfschritt ist `tsc --noEmit` im Build.
- **Keine Tests für** `world/`, `core/`, `audio/`, `dismantle/`, `physics/`.
- **Keine End-to-End-Tests**, keine Bildvergleiche.
- **Kein Android-Projekt.** `capacitor.config.json` liegt bereit,
  `npm run android:add` ist nie gelaufen.
- **Keine Fehlerberichterstattung**, keine Telemetrie, keine Analytik.
- **Keine Lokalisierung.** Alles ist deutsch, fest verdrahtet.
- **Kein Mehrspielerbetrieb**, keine Netzwerkanbindung, keine Konten.
