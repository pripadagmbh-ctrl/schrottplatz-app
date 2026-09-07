# Schrottplatz — GDD v2 (schlank)

Stand 2026-09-02 · Version 2.0 · Gilt engine-neutral (Web/Three.js primär, Unity als Testspur). Ersetzt `02_Briefing.md` als Design-Quelle; Technik steht im Tech-Doc, Umsetzungsstand im Statusbericht.
**Regel:** Jede Zahl trägt entweder ihre Herkunft aus dem Prototyp (`Datei:Zeile` in `prototype/src/`) oder ist ein Playtest-Ziel mit „Fertig, wenn". Zahlen ohne beides sind verboten.

## 1. Pitch und Rahmen
Du bist **Daniel**, Baggerfahrer und Platzchef eines kleinen Schrottplatzes. LKW kippen Altmetall ab, du greifst dich mit der Spinne durch den Haufen, wirfst Stahl auf den Haufen, Alu, VA, Kupfer und Kabel in die Boxen und lässt sortenrein abholen. Sauberes Trennen bringt Geld, mit dem Geld wächst der Platz. Kein Zeitdruck — das Gefühl, schwere Dinge sicher zu bewegen und am Abend zu sehen, was man geschafft hat.

| Feld | Festlegung |
|---|---|
| Genre | Arbeits-Simulation mit Physik-Kern und leichtem Wirtschafts-Metagame, strikt Einzelspieler |
| Plattform | Android (Google Play) zuerst; iPhone-Test über Safari-Web-Build; Desktop-Browser = Entwicklung + Gratis-Demo |
| Zielgruppe | Feierabend-Spieler 16–45, die „satisfying jobs" mögen; Baumaschinen-Fans als zweite Gruppe |
| Monetarisierung | **Gratis bis Ende Tag 3, dann einmaliger Premium-Unlock 4,99 €.** Keine Werbung, kein Abo, keine weiteren Käufe |
| Orientierung | Landscape-only |
| Ton-Leitplanke (verbindlich) | Das Milieu entsteht aus Beruf, Familien und Geschäft — nie aus Herkunft oder Ethnie. Keine Gruppe wird als kriminell markiert |

## 2. Tragende Emotion und Abnahme
**Kompetenz.** Zerstörung (Wrack fallen lassen, Scheiben, Quetschstufen) ist Würze, kein Ziel.

| Gefühl | Fertig, wenn … |
|---|---|
| Greifen ist satt | Tester greift 10 verschiedene Objekte; keines zittert, clippt oder teleportiert |
| Masse ist spürbar | Blindtest: Tester erkennt am Drehverhalten, ob die Spinne leer oder voll ist |
| Werfen belohnt | Tester trifft nach 5 min Übung aus 5 m gezielt den Stahlhaufen |
| Kein Stress | Tester lässt eine Fuhre 10 min liegen — nur Bonus entgeht, nichts geht kaputt |
| Ziel ist klar | Tester kann nach Tag 1 ohne Nachfrage sagen: was er heute tun soll, warum, und was er dafür bekommt |

## 3. Die vier Loops
| Loop | Ablauf | Fertig, wenn … |
|---|---|---|
| **Sekunden** (ein Griff) | Objekt erkennen → greifen → über Ziel schwenken → abwerfen → Sound + Ampel + **Sortierprämie-Ticker** | Zyklus geübt 8–15 s; jeder Schritt hörbar und sichtbar |
| **Minuten** (eine Fuhre) | LKW an der Waage → Ankauf (fester Kurs, s. Kap. 7) → abkippen → sortieren → Abholer laden | Eine Privat-Fuhre (≤ 800 kg, `delivery/customers.ts:251`) ist in < 5 min abgearbeitet |
| **Session** (ein Tag) | Morgen-Karte mit 3 Aufträgen → 2–4 Fuhren → Feierabend → Abend-Bilanz mit Sternen → Autosave | Ein Tag dauert 12–20 min; Bilanz zeigt Einnahmen, Ausgaben, Aufträge, Sterne |
| **Meta** (30 Tage) | Sterne + Geld schalten 3 Ausbaustufen frei; Tag 30 = Abschluss | Drei Tester erreichen Stufe 2 zwischen Tag 6 und Tag 12 |

## 4. Story-light (der ganze Plot)
Der Platz gehört zur Hälfte **Willi Bäring** (`delivery/customers.ts:59-65`, Händler, Härte 5), Daniels Schwager. Willi will verkaufen, wenn Daniel den Platz nicht in **30 Tagen** rentabel macht. **Lambert** (Vater, Platzarbeiter) erklärt in kurzen Textblasen (2–8 Wörter) und ermutigt. Mario (Waage) und Janine (Kaffee) bleiben Kulisse. Nach Tag 30: Freies Spiel ohne Frist. Textumfang MVP: 10–15 Sätze Willi, 10–15 Sätze Lambert.

## 5. Tagesstruktur
| Phase | Was passiert | Dauer |
|---|---|---|
| **Morgen-Karte** | Tag n/30 · Konto · 3 Aufträge · Tagespreise (fest) · Lambert-Satz | bis Klick |
| **Betrieb** | Fuhren kommen: Tag 1–3: 2 · Tag 4–10: 3 · ab Stufe 2: 4 · ab Stufe 3: 5. Abstand 60–120 s (Playtest-Ziel; Prototyp 7–15 s war zu dicht, `delivery/routes.ts:109`). Nach der letzten Fuhre: Tor zu, Schild „Feierabend" | ~8–12 min |
| **Feierabend** | Kein Nachschub, kein Timer. Sortieren, pressen, Abholer laden. Spieler beendet den Tag per Button | offen |
| **Abend-Bilanz** | Einnahmen (Verkäufe + Sortierprämie) − Ausgaben (Ankauf + Fixkosten) = Tagesgewinn · Aufträge ✓/✗ mit Bonus · **Sterne 0–3** (= erfüllte Aufträge) · Ausbau-Fortschritt · Autosave | bis Klick |
Was am Abend lose liegt, bleibt liegen — der Platz ist persistent. Kein Game Over: Konto unter −1 500 € (`economy/account.ts:33`) heißt „Willi streckt vor", Fixkosten +20 % bis getilgt.

## 6. Die drei Tagesaufträge
Pro Tag drei Aufträge aus einem Pool, Schwierigkeit skaliert mit dem Tag. Verfehlen kostet nur den Bonus. Anzeige rechts oben, drei Zeilen mit Haken.

| Typ | Beispiel | Messgröße (im Prototyp vorhanden) | Bonus | ab Tag |
|---|---|---|---|---|
| **Liefern** | „Abholer mit 800 kg Alu, ≥ 90 % rein" | Verkauf: Fraktion, kg, Reinheit (`economy/account.ts:83-125`) | 100–300 € | 1 |
| **Räumen** | „Annahmefläche am Abend < 500 kg lose" | lose Masse (`main.ts:240-249`) | 100 € | 1 |
| **Kunde** | „Fertige Gießerei Hallmann in < 3 min ab" / „Nimm Hardwigs Fuhre zum Marktpreis" | Waage rein/raus, Preisfaktor (`main.ts:555-591`) | 150 € + Ruf | 2 |
| **Zerlegen** | „Reiß den Motor aus dem Wrack, verkauf ihn als Stahl" | Abriss-Ereignis (`dismantle/`, `main.ts:792-795`) | 200 € | 5 |
Fertig, wenn: Tester erfüllt an Tag 1 mindestens 2 von 3 Aufträgen ohne Hilfe; Bonus-Summe je Tag liegt zwischen 25 % und 60 % des Tagesgewinns (sonst nachbalancieren).

## 7. Wirtschaft (korrigiert)
| Posten | Regel | Herkunft |
|---|---|---|
| Startkapital | 5 000 € | `economy/account.ts:34` |
| Fixkosten | 150 €/Tag (Pacht, Diesel, Willis Anteil) | neu; Playtest-Ziel: Tagesgewinn Tag 1–3 zwischen +300 und +900 € |
| Ankauf Mischfuhre | 0,16 €/kg pauschal — der bewusste „Mischschrott-Rabatt", der Sortieren lohnt | `economy/account.ts:16` |
| Ankauf sortenreine Fuhre | Ankaufspreis der Fraktion: Stahl 0,18 · VA 1,00 · Alu 1,10 · Kupfer 6,00 · Kabel 1,60 €/kg | `materials/catalog.ts:24-28` (`buyPricePerKg`, im Prototyp ungenutzt) |
| Verkauf | kg × Verkaufspreis (Stahl 0,25 · VA 1,40 · Alu 1,50 · Kupfer 7,20 · Kabel 2,20 · Störstoff −0,08) × **Reinheit²** — HUD-Prognose und Auszahlung nutzen dieselbe Formel | `materials/catalog.ts:24-30`, `materials/purity.ts:26`; Prototyp-Verkauf nutzte ³ (`account.ts:119`) — Fehler |
| Sortierprämie | 0,05 €/kg sofort beim richtigen Abwurf, sichtbar als Ticker | `economy/account.ts:18` (im Prototyp ungenutzt) |
| Verhandeln | Entfällt als Dialog. Formel bleibt im Code (`economy/haggle.ts`) für den Auftragstyp „Kunde"; Gewerbe fester Kurs 1,06 (`main.ts:506`) | — |
| Ruf | Stumm geschaltet; Zahlen bleiben (`economy/reputation.ts`), keine Anzeige im MVP | — |
Materialien MVP: Stahl, VA, Alu, Kupfer/Messing, Kabel, Störstoff (`materials/catalog.ts`). Holz/Reifen/Bauschutt bleiben als Störstoff-Varianten ohne eigene Box.
Fertig, wenn: Drei Tester landen an Tag 10 zwischen 12 000 und 25 000 € Konto; keine einzelne Fuhre bringt mehr als das Dreifache des Tagesgewinns.

## 8. Ausbau: drei sichtbare Stufen
Bedingung ist **Sterne UND Geld** — der Platz wächst auch bei schwacher Wirtschaft, aber nie ohne Leistung. Stufen ersetzen die 8 Upgrades des Prototyps (`economy/upgrades.ts`); die Gebäude-Modelle existieren (`world/office.ts`, Stufen hut/office/hall, im Prototyp nicht eingebunden).

| Stufe | Bedingung | Sichtbar | Spielwirkung |
|---|---|---|---|
| 1 Wiegehäuschen | Start | Hütte an der Waage | — |
| 2 Büro | ≥ 10 Sterne + 9 000 € (`upgrades.ts:40`) | Flachbau mit Notierungstafel | Ladungszusammensetzung an der Waage sichtbar; 4 Fuhren/Tag |
| 3 Halle + Radlader | ≥ 25 Sterne + 20 000 € | Halle, Lambert im Radlader (`world/people.ts:218`) | Lambert räumt Fahrspuren selbst; Bagger: Tempo ×1,35, Traglast ×1,5 (`main.ts:456-457`); 5 Fuhren/Tag |
Fertig, wenn: Stufe 2 an Tag 6–12, Stufe 3 an Tag 18–28 bei mittelguten Testern; Stufe 3 ist ab Tag 10 sichtbar „noch nicht erreichbar" (Zugpferd).

## 9. Onboarding — Tag 0 (blockierend, ~6 min)
| Schritt | Was der Spieler tut | Vermittelt |
|---|---|---|
| 1 | Leerer Platz, ein Träger. Lambert: „Q/E dreht, R/F hebt" (Touch: linker Stick/rechter Stick). Träger greifen → auf den Stahlhaufen; Ampel grün. **Weiter erst, wenn erledigt** | Achsen, Griff, Abwurf |
| 2 | PKW-Anhänger kippt 5 Teile: 3 Stahl, 1 Kupferrohr, 1 Holz. Griff-Info: „orange + schwer = Kupfer". Jedes Teil richtig ablegen | Materialerkennung (Farbe, Gewicht, Klartext) |
| 3 | Abholer rufen, Kupfer laden, abfahren → Geld-Toast | Verkauf = Geld |
| 4 | Bilanz Tag 0. Willi tritt auf: „30 Tage, Daniel." | Ziel und Frist |
Pressen (Tag 4) und Kundenaufträge (Tag 2) werden über Aufträge eingeführt, nicht im Tutorial.
Fertig, wenn: 3 von 4 Erst-Testern schließen Tag 0 ohne verbale Hilfe ab und nennen danach, woran man Kupfer erkennt.

## 10. Gratis-Teil und Premium-Unlock
- **Gratis:** Tag 0 bis Ende Tag 3 — vollständige Steuerung, alle Achsen, alle Materialien, Aufträge Liefern/Räumen/Kunde, Abholer, Presse (Tag 3 als Auftrag), Wrack greifen und fallen lassen. Nichts ist abgeschaltet; der Kernloop ist komplett erlebbar.
- **Unlock-Moment:** Bilanz-Karte Tag 3: „Willi bietet dir den Platz an — 4,99 €." Darunter: Konto, Sterne bisher, Vorschau Stufe 2. Ablehnen = Bilanz bleibt offen, Spielstand bleibt erhalten; jederzeit später freischaltbar.
- **Premium:** Tag 4–30, Ausbaustufen 2–3, Auftragstyp Zerlegen, Freies Spiel danach.
- Fertig, wenn: Ein Tester, der die Steuerung nicht mag, weiß das vor Tag 3 (Demo-Zweck erfüllt); Konversions-Ziel Free→Paid ≥ 2 % (Store-Messung nach Release).

## 11. Steuerung und Kamera (Kurzfassung)
| Achse | Tastatur | Touch |
|---|---|---|
| Oberwagen / Hauptarm | Q/E · R/F | linker Stick X/Y |
| Stiel | T/G | rechter Stick Y |
| Greifer | LMB halten | Greif-Knopf Ø 76 px (Halten oder Toggle) |
| Rotator | Mausrad | zwei Pfeil-Buttons am Greif-Knopf |
| Fahren / Lenken | W/S · A/D | Fahr-Modus-Toggle + linker Stick |
| Kamera | MMB ziehen · Shift+Rad | Wischen auf freier Fläche · Pinch |
Kameras: Orbit hinter der Kabine, folgt dem Oberwagen (Standard), Draufsicht, Kabine. Bodenring unter der Spinne immer sichtbar. Farbe ist nie der einzige Kanal (Piktogramm + Klartext + Ampel-Symbol). Deutsch zuerst, Englisch zum Store-Release. Verbindliche Details (Positionen, Größen, Gesten, Einsteiger-IK-Modus): `04_Stilguide_und_Touch.md`.

## 12. Audio und Art (Kurzfassung)
Audio ist der primäre Belohnungskanal: eigener Abwurfklang je Material, „Kaching" dezent, Fehler stumpf, nie schrill. Blindtest: Tester erkennt Stahl/Kabel/Kupfer am Klang. Stil: stilisiertes Low-Poly, entsättigte Welt, Materialfarben leuchten. Die Prototyp-Palette (`materials/catalog.ts:24-30`) ist rechnerisch zu eng (ΔE Kupfer↔Kabel 13, Stahl↔Störstoff 9) — verbindlich ist die v2-Palette mit ΔE ≥ 25 aus `04_Stilguide_und_Touch.md`.

## 13. MVP-Schnitt für Store 1.0
**MUSS:** Tag-Struktur (Kap. 5) · 3 Aufträge/3 Sterne, Typen Liefern/Räumen/Kunde (Kap. 6) · Abend-Bilanz · Onboarding Tag 0 (Kap. 9) · 3 Ausbaustufen sichtbar (Kap. 8) · Wirtschaft nach Kap. 7 · Willi/Lambert-Textblasen · Tag-30-Abschlusskarte · Autosave je Tag mit Schema-Version · Premium-Unlock (Kap. 10) · Touch-Steuerung · Deutsch + Englisch.
**KANN WEG (v2.x):** Verhandlungsdialog · Ruf-Anzeige · Dozer/Stapler/Magnet/größere Presse · Fahrspur-Störfall · Nacht/Flutlicht (Tag endet vor Dunkelheit) · Händlerfamilien auf 3 kürzen (Bäring, Hardwig, Zöllner), Branchen auf 3 · Auftragstyp Zerlegen, falls Zeit fehlt.
**NIE für 1.0:** Graue Geschäfte · Marktpreisschwankung · Kat/Batterie-Zerlegung · Mehrspieler · Werbung.
**Scope-Regel:** Neues kommt nur gegen Streichung aus MUSS. Jede Änderung an einer Zahl in Kap. 5–8 braucht einen Playtest-Befund.

## 14. Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| Mobile-Bildrate auf Mittelklasse-Android ungemessen | Erster Capacitor-Build vor Tag-Struktur; Ziel ≥ 30 fps stabil, sonst Teilezahl je Fuhre kürzen |
| Steuerung überfordert Einsteiger | Tag 0 blockierend + Erst-Tester-Abnahme (Kap. 9); IK-Einsteigermodus als v2.x-Netz |
| Spaß nie mit Fremden getestet | Gratis-Desktop-Demo (Web-Build auf itch.io) vor dem Store, 20 Tester, 5-Fragen-Bogen |
| Scope wächst wieder auf 1 000 Zeilen | Kap. 13 Scope-Regel; dieses Dokument bleibt unter 150 Zeilen |
