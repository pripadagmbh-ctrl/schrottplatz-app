# Rust'n'Reibach — v1

**`v1/` ist der Arbeitsordner.** Nachfolger des Prototyps, kopiert am 14.09.2026 vom Stand
`f3c3c52`. `prototype/` und `v2/` bleiben eingefroren und werden nie geändert — die Regeln
stehen in `../CLAUDE.md`, die Entscheidungen in `docs/entscheidungen.md` (ab E-001).

Stand: **M1 gebaut, Gerätetest offen. M2 Phase A gebaut, Gerätetest offen.** Zapfen statt
breiter Ring an der Spinne (E-007), Rückwände raus an den vier Sortiermulden (E-006),
Kommentar-Regel für Messwerte (E-008), der Fünfschalengreifer als Vorschaumodell (E-009).
Prüfkette grün: `npm test` 272 Tests in 29 Dateien, `npm run build` sauber. Abgenommen ist
nichts davon vor Patricks Gerätetest — die Handgriffe stehen bei E-006, E-007 und E-009 im
Log.

Der Spielinhalt (M0–M3 weiter unten) ist vom Prototyp geerbt und unverändert gültig; diese
Abschnitte beschreiben, was v1 mitbringt, nicht was in v1 entstanden ist.

## Starten

```bash
npm install
npm run dev
```

Dann http://localhost:5173 im Browser öffnen.

Für den Gerätetest auf iPad oder iPhone im selben WLAN:

```bash
npm run dev -- --host
```

Vite nennt dann eine Adresse der Form `http://<PC-IP>:5173` — die im Safari des Geräts
öffnen. `npm run build` erzeugt den Produktions-Build in `dist/`, `npm test` fährt die
Wächter. Beide müssen vor jeder Übergabe grün sein (Regel 8).

Veröffentlicht wird v1 nach einem Merge auf `main` unter
`pripadagmbh-ctrl.github.io/schrottplatz-app/v1/` (E-005). Der Merge braucht Patricks
Freigabe und ist nach rund 70 Sekunden live.

## Die zweite Greiferform ansehen

```bash
npm run dev -- --host
```

Dann auf dem Gerät `/greifer.html` öffnen — dort liegt der Fünfschalengreifer zum Drehen und
Öffnen, mit Schieberegler und Touch. **Der Bagger trägt ihn nicht:** Im Spiel hängt
unverändert die Sichelkralle am Zapfen (E-007). Die Vorschau ist die Auflage aus E-009 —
erst ansehen, dann entscheiden, ob die Form ins Spiel geht.

Das Modell wird nicht von Hand gepflegt, sondern aus `src/fuenfschalen/` exportiert. Neu
bauen nach einer Änderung an Teilen oder Rig:

```bash
npx vite-node tools/fuenfschalen/export.ts
```

Das schreibt `src/greifer/fuenfschalen.glb` neu; Maße und Befunde stehen in
`docs/messungen/2026-09-14_fuenfschalen-vorschau.md`.

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

Auf dem Touchgerät (Stand 14.09.2026): linke Bildhälfte = Armstick, rechte
Hälfte = Auslegerstick (beide schweben, beide frei belegbar), **unten links ein
eigenes Feld FAHREN** — hoch/runter gibt Gas, seitlich lenkt. Es ist immer
scharf; den früheren Fahrmodus per Doppeltipp gibt es nicht mehr. Doppeltipp
rechts wechselt die Ansicht, rechten Daumen stillhalten öffnet den
Funktionskranz.

## Der Platz (Stand 14.09.2026, E-010)

Der Bagger steht auf **(−0,5 | −22,5)** und schaut nach Norden, zur Waage und zur
Einfahrt. Sein Standplatz kommt aus `src/world/baggerstand.ts` — dieselbe Quelle,
aus der auch die Abnahmemessung rechnet. Wer ihn verschiebt, verschiebt ihn dort
und nirgendwo sonst.

```
                          EINFAHRT (x −22, Nordwand)
   BÜRO   WAAGE      HALLE 1   HALLE 2   HALLE 3        (Nordwand, z 22)
 ┌──────────────────────────────────────────────────────┐
 │ E-MOTOREN                                            │
 │ BATTERIEN                                            │
 │ ALU · KABEL · KUPFER                                 │
 │ VA · HOLZ · BAUMISCH      KUPFER+MSG                 │
 │ KUNSTSTOFF                    KABEL         REIFEN   │
 │   Silo-Reihe    [B2]        ALU+ZINK   [B]   MÜLL    │
 │   x −36      Verladen                        PRESSE  │
 └──────────────────────┬──────────────────┬────────────┘
                        │  STAHL │ MISCH   │   Ausbuchtung
                        └────────┴─────────┘   (z −29 … −38,5)
```

**Acht Ziele im Schwenkbereich**, alle gemessen von `(−0,5 | −22,5)` — bei Halden
zur vorderen Kante, bei Mulden und Containern zur Mitte:

| Ziel | Abstand |
|---|---|
| Halde Mischschrott | 8,07 m |
| Halde Stahlschrott | 7,15 m |
| Presse | 7,40 m |
| Müllcontainer | 8,81 m |
| Reifencontainer | 6,72 m |
| Mulde Alu + Zink | 8,55 m |
| Mulde Kabel | 7,50 m |
| Mulde Kupfer + Messing | 8,65 m |

**Die Ausbuchtung** hinter dem Bagger wölbt sich nach Süden aus der Platzgrenze
heraus, rundum mit 4,8 m hoher Wand. Darin die beiden Halden, getrennt durch eine
Pyramide aus Betonlego — Lagen 1·2·4·4·2·1, also 0,6 bis 2,4 m hoch. Niedrig
genug, dass der Zugriff von einer Halde zur anderen durchläuft.

**Die Silo-Reihe** an der Westwand, neun Stück: E-Motoren, Batterien, Alu, Kabel,
Kupfer, VA, Holz, Baumisch, Kunststoff. Stahl entfällt — Stahlschrott wird direkt
an der Halde verladen. Das E-Motoren-Silo steht als Hülle, die Fraktion fehlt noch.

**Der Verladeplatz** liegt zwischen Silo-Reihe und LKW-Spur: 7,5 m zur einen,
7,5 m zur anderen Seite. Der Bagger steht dazwischen und greift aus dem Silo in
den Container, ohne umzusetzen.

**Die Hallen** an der Nordwand sind leere Hüllen. Was in ihnen passieren soll —
Händler fahren selbst hinein, Lambert räumt sie in die Silos — steht in E-011 und
ist noch nicht gebaut.

### Geldkreislauf

Anlieferer werden auf der Brückenwaage voll und nach dem Abladen leer gewogen —
für die Nettomenge bekommt der Kunde 0,16 €/kg (Ausgabe). Verkauft wird über den
Abhol-LKW: **V** ruft ihn, der Spieler belädt den Container mit der Spinne, **V**
schickt ihn los.

> **Zwei bekannte Fehler in dieser Rechnung**, festgehalten in der Bestandsaufnahme
> vom 14.09.2026: Das Schild am Container rechnet mit Reinheit **hoch zwei**
> (`materials/purity.ts:26`), ausgezahlt wird mit Reinheit **hoch drei**
> (`economy/account.ts:138`) — bei 76 % Reinheit sind das 24 % weniger als
> angeschrieben. Und die Sortierprämie von 0,05 €/kg steht zwar in
> `account.ts:18`, wird aber nirgends benutzt. Beides gehört zu Abschnitt 2 in
> E-016 und ist noch offen.


## Geerbt vom Prototyp — Spielinhalt M0 bis M3

Die vier folgenden Abschnitte stammen unverändert aus dem Prototyp (Stand 29.08.2026)
und beschreiben, was v1 an Spielinhalt mitbringt. Sie gelten weiter. Was seither **in
v1** entschieden oder geändert wurde, steht ausschließlich in `docs/entscheidungen.md`
und in den Messprotokollen unter `docs/messungen/` — dort und nicht hier nachschlagen,
wenn die Beschreibung unten von dem abweicht, was das Spiel tut.

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
- Greifspinne: 5 Schalen-Zacken, seit E-007 am schlanken Zapfen statt am breiten Ring,
  je acht Segmente. Die Kollider der Zacken folgen der Zeichnung (`updateClawColliders`) —
  dass beide deckungsgleich sind, hält ein eigener Wächter in `test/greifer.test.ts` fest.
- Module kommunizieren über den typisierten **EventBus** (`core/events.ts`) — itemEntered/
  itemLeft/grabbed/released; Audio und HUD hängen nur an Events.
- Container-Zuordnung per **Zonen-Zählung** alle 10 Steps (gegriffene Items zählen nicht);
  Herausgreifen macht die Zählung rückgängig → Nachsortieren funktioniert ohne Extra-Code.
- Dev-only: `window.__game` (excavator, grip, physics, input, items, containers, bus,
  THREE, `step(n)`) für automatisierte Smoke-Tests.
- Bodenkollider ist größer als der sichtbare Platz — nichts kann ins Leere fallen.
