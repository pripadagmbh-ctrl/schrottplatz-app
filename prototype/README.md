# Prototyp — Schrottplatz-App

Stand: **M3 abgeschlossen** (Anlieferung + Konto + Presse, siehe `docs/02_Briefing.md` Kap. 22).

## Starten

```bash
npm install
npm run dev
```

Dann http://localhost:5173 im Browser öffnen. `npm run build` erzeugt den Produktions-Build in `dist/`.

## Steuerung (M0)

| Eingabe | Funktion |
|---|---|
| W/S | Fahren vor/zurück |
| A/D | Lenken |
| Q/E | Oberwagen drehen |
| R/F | Ausleger heben/senken |
| T/G | Stiel weg/ran |
| LMB halten (oder Leertaste) | Greifspinne schließen |
| Mausrad | Rotator drehen |
| Shift+Mausrad | Kamera-Zoom |
| MMB ziehen | Kamera drehen |
| C | Ansicht: Orbit → Draufsicht → Kabine |
| X | Fahrerkabine hoch/runter (2,6 m Hub) |
| V | Abholung rufen bzw. beladenen Container abfahren lassen |
| B | Schere/Paketierpresse |
| H | Hilfe ein/aus · F3 Debug-Overlay |

## Platzanordnung & Wirtschaft (Stand 2026-08-29)

Der Bagger steht mittig auf (0, −1); alle Sortierziele liegen im Schwenkbereich
(5,8–9,2 m), Fahren ist nur für Presse und Verladung nötig.

```
                    Brückenwaage (0, 15)
                    Abkippplatz  (0, 7)
  STAHLSCHROTT ····· [BAGGER] ····· GUSS · ALU · KUPFER · KABEL
   (-9, 1), riesig    (0, -1)        Boxenreihe x = 5,4
  STÖRSTOFF (-5,-8)      |
                 SCHERE (0, -10.5)   VERLADEPLATZ (8, -13)
```

**Geldkreislauf:** Anlieferer werden auf der Brückenwaage voll und nach dem
Abladen leer gewogen — für die Nettomenge bekommt der Kunde 0,16 €/kg (Ausgabe).
Jedes korrekt einsortierte Teil bringt sofort 0,05 €/kg Sortierprämie. Verkauft
wird über den Abhol-LKW: **V** ruft ihn, der Spieler belädt den Container mit der
Spinne, **V** schickt ihn los — bezahlt wird Materialwert × Sortenreinheit², eine
sortenreine Ladung bringt also ein Vielfaches.

## M3-Umfang (verifiziert 2026-08-29)

- **Anlieferungen** (`delivery/vehicles.ts`): Kundenfahrzeuge fahren vorwärts ein,
  rangieren und setzen **rückwärts** an. Drei Typen: Kipper (Mulde hebt sich um 58°,
  Ladung rutscht physisch ab), Pritsche (Spieler lädt selbst mit der Spinne ab),
  Tieflader mit Wrack. Händler-Ladungen: 16–20 Teile, halb davon Großteile
  (Träger, Blechtafeln, Maschinenblöcke bis 420 kg). Ladung wird überlappungsfrei
  gestapelt, setzt sich physisch, fährt kinematisch verriegelt mit und wird am
  Abladepunkt freigegeben. Takt: erste nach ~20 s, dann alle 35–60 s.
- **Konto + Verkauf (V):** Abnehmer holt alle Haufen/Boxen, Erlös nach Reinheitsformel
  aufs Konto (Start 5.000 €). Kern-Sound „Münz-Dreiklang", Toast-Anzeige.
- **Schere / Paketierpresse (B)** (`world/press.ts`): oben offene Containermulde hinter
  dem Startplatz. Zyklus: zwei dicke Eisenplatten schließen von beiden Seiten von oben
  (drücken teilweise ins Material) → Pressstempel läuft von **rechts nach links** durch
  die Mulde → Paket. Teile werden plattgedrückt (Mesh + Kollider), Karossen auf
  Quetschstufe 2. Stempelweg ergibt sich aus der Materialmenge (Klemmschutz).
- **Anlieferungs-Fahrspur:** eigene Ostspur als Sackgasse, markiert am Boden — sie
  kreuzt weder Haufen-Zonen noch Bagger-Standplatz. Fahrer warten vor dem Bagger
  und hupen nach 10 s, statt hindurchzufahren.
- **Physik-Härtung** (`clampSpeeds`): globale Geschwindigkeitsbremse (28 m/s) plus
  Rückholung von Ausreißern. Verhindert, dass Klemmsituationen Material vom Platz
  schleudern.
- **Platz-Ausbau:** Betonlego-Boxen (gestapelte Noppensteine) für Guss + Alu,
  permanente Schrottberge hinter dem Bagger, Zaunreihe an der Ostseite,
  Maschendraht-Bündel (Drahtknäuel) als Kehr-Werkzeug zum Freischieben.
- **Save/Load:** K speichert (localStorage, Schema v1 mit Migrationspfad), L lädt,
  N startet neu. Boot rekonstruiert Items (inkl. plattgedrückt), Karossen
  (Quetschstufe, gerissene Teile, Scheiben) und Zaunzustand. Vitest-geprüft.

## M2-Umfang „Wrack-Slice" (verifiziert 2026-08-27)

- **Auto als Verbundobjekt** (`dismantle/`): datengetrieben (CarDef), 950 kg greifbar,
  Achsen spürbar träger. Aufprall-Erkennung über Δv: Scheiben bersten einzeln,
  **3 Quetschstufen** (Squash + Kollidertausch), Stufe 2 sprengt bis zu 2 Räder ab.
- **Abreißen:** Spinne nahe Motor/Rad fasst die Baugruppe statt des Rumpfs;
  geschlossen halten reißt sie heraus (Motor 2 s, Rad 1,2 s) → eigenständiges,
  sortierbares Teil, direkt im Greifer. HUD zeigt Reiß-Fortschritt.
- **Haufen-Zonen statt Container** für Stahl/Guss/Alu/Störstoff (Schrott draufwerfen),
  Kupfer/Kabel bleiben Kleinboxen. Reinheits-/Erlöslogik unverändert.
- **Zerstörbare Zaunfelder:** Griff reißt sie aus der Verankerung, schnelle Objekte
  (auch weggesprengte Räder!) schlagen sie um — danach ganz normaler Stahlschrott.
- Neue Sounds: Blech-Crash, Glasbersten, Metall-Kreischen (Abriss), Zaun-Scheppern.
- Physik-Kosten mit allem: 0,13 ms/Step.

## M1-Umfang (verifiziert 2026-08-27)

- 6 Materialklassen (Stahl, Guss, Alu, Kupfer, Kabel, Störstoff) mit materialtypischen
  Formen und Farbleitsystem; 20-Objekte-Misch-Haufen auf der Annahmefläche.
- 4 große Container + 2 Kleinboxen mit **Reinheitssystem**: Erlös = Inhalt × Preis × Reinheit²,
  Nachsortieren senkt die Kontamination wieder. World-Space-Labels (kg / % / €).
- Griff-Info-HUD (Material, Gewicht, €-Indikator), Objekt-Highlight, **Abwurf-Ampel**
  (Grün/Gelb/Rot am Container), Sortierwert-Ticker.
- Prozedurale Kern-Sounds (WebAudio, keine Assets): Diesel-Loop, Hydraulik, Greif-Thump,
  Abwurfklang je Material, Richtig-/Falsch-Feedback.
- Wirtschaftsrechnung Vitest-geprüft: `npm test` (11 Tests).

## M0-Abnahme (verifiziert 2026-08-27)

- 20 Zyklen Greifen → Heben → 5 m Tragen → Ablegen in Folge: **bestanden**, max. Griff-Schlupf 2 mm, keine NaNs/Explosionen.
- Mehrfachgriff: 3 Objekte / 115 kg in einem Griff.
- Last-Trägheit: Oberwagen dreht unter Last messbar langsamer.
- Physik-Kosten: 0,07 ms pro 60-Hz-Step (16 Bodies).

## Architektur-Notizen

- Arm ist **kinematisch** (animierte Winkel), nur Chassis + Greifer-Palm haben Kollider.
- Greifen = Sensorkugel-Abfrage beim Schließen + **Fixed Joint** pro Objekt (Briefing Kap. 6.2).
- Greifspinne: 5 Schalen-Zacken (Kugelsegmente), schließen ohne Durchsicht; Kollider der
  Zacken folgen später.
- Module kommunizieren über den typisierten **EventBus** (`core/events.ts`) — itemEntered/
  itemLeft/grabbed/released; Audio und HUD hängen nur an Events.
- Container-Zuordnung per **Zonen-Zählung** alle 10 Steps (gegriffene Items zählen nicht);
  Herausgreifen macht die Zählung rückgängig → Nachsortieren funktioniert ohne Extra-Code.
- Dev-only: `window.__game` (excavator, grip, physics, input, items, containers, bus,
  THREE, `step(n)`) für automatisierte Smoke-Tests.
- Bodenkollider ist größer als der sichtbare Platz — nichts kann ins Leere fallen.
