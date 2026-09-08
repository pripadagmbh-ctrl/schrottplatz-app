# Bagerana — Entwicklungs-Briefing v2 (Game Design Document)

Stand: 07.09.2026 · Version 2.0 · Arbeitstitel **Bagerana** (vormals „Schrottplatz-App") · Ordner `v2/`

**Was dieses Dokument ist:** Die einzige verbindliche Design- und Umsetzungsquelle für v2. Es konsolidiert das Briefing v1 (`../docs/02_Briefing.md`, 27.08.), das schlanke GDD v2 (`01_GDD_v2.md`, 02.09.), die vier Analysebefunde (`analyse/A1–A4`), die Messungen vom 02.09. und die Rückfragen-Runden vom 07.09. Wo es diesen Dokumenten widerspricht, gilt dieses Dokument. `02_Architektur_v2.md` und `04_Stilguide_und_Touch.md` bleiben als Detail-Anhänge gültig, soweit sie hier nicht überschrieben werden (Abweichungen sind in Kap. 23 aufgelistet).

**Was dieses Dokument nicht ist:** Kein Ersatz für den Prototyp als Referenz. Der Prototyp unter `../prototype/` wird nicht verändert (Projektregel 1 in `CLAUDE.md`).

**Lesehilfe:**

| Markierung | Bedeutung |
|---|---|
| `[MVP]` | Im ersten spielbaren Stand (Vertical Slice = Tag 0 bis Ende Tag 3, siehe Kap. 21) |
| `[V1]` | Im ersten Store-Release (Google Play), nach dem Vertical Slice |
| `[Später]` | Nach dem Store-Release; wird nicht eingeplant |
| **(SW)** | Startwert zum Austesten — bewusst gesetzt, damit gebaut werden kann; wird im Playtest angepasst |
| `datei.ts:zeile` | Herkunft aus dem Prototyp (`../prototype/src/`) |
| **Annahme** | Entscheidung ohne ausdrückliche Antwort des Auftraggebers; vollständige Liste in Kap. 23.4 |
| *Fertig, wenn …* | Abnahmekriterium — ohne Diskussion prüfbar |

---

## 1. Kurzfassung

**Elevator Pitch:** Du bist Daniel, Baggerfahrer und halber Eigentümer eines kleinen Schrottplatzes. Lkw und Anhänger kippen Altmetall ab; mit der Greifspinne deines Umschlagbaggers erkennst du Stahl, Alu, Edelstahl, Kupfer und Kabel, wirfst jedes Teil in die richtige Box und reißt aus Altautos Motor, Batterie und Räder heraus, bevor die Presse zuschlägt. Sauberes Trennen bringt Geld, Fehlwürfe kosten — und in 30 Tagen musst du deinem Schwager Willi beweisen, dass der Platz sich rechnet.

| Feld | Festlegung |
|---|---|
| Genre | Arbeits-Simulation mit Physik-Kern („Sim-Lite"), leichtes Wirtschafts-Metagame, strikt Einzelspieler |
| Plattform | Web-Stack (TypeScript, Three.js, Rapier). `[MVP]` PWA über GitHub Pages, Leitgerät iPad (Querformat), Kompaktlayout iPhone mini, Desktop-Browser für Entwicklung. `[V1]` Google Play über Capacitor. `[Später]` App Store über Cloud-Build |
| Zielgruppe | Feierabend-Spieler 16–45, die „satisfying jobs" mögen (PowerWash-Simulator-Publikum); zweite Gruppe: Baumaschinen-Fans |
| Session | Ein Spieltag = 6–10 Minuten Echtzeit; Autosave nach jedem Tag |
| Monetarisierung | Gratis bis Ende Tag 3, dann einmaliger Premium-Unlock 4,99 € **(SW)**. Keine Werbung, kein Abo, kein Tracking |
| USP | Echte Mehrachsen-Baggersteuerung mit Physik-Greifer, die sich per Touch mit zwei Daumen bedienen lässt, plus Materialkunde als Spielmechanik: Wer Kupfer von Kabel und Alu von Edelstahl unterscheiden lernt, verdient sichtbar mehr |
| Ton-Leitplanke (verbindlich) | Milieu entsteht aus Beruf, Familie und Geschäft — nie aus Herkunft oder Ethnie. Keine Gruppe wird als kriminell markiert. Gilt für Namen, Texte, Sprüche, Grafiken |

---

## 2. Vision & Spielgefühl

**Tragende Emotion: Kompetenz.** Das Gefühl, eine schwere Maschine sicher zu führen, mit einem Blick zu wissen, was da liegt, und am Abend zu sehen, was man geschafft hat. Zerstörung (Wrack fallen lassen, Scheiben bersten, Karosse quetschen) ist Würze, nicht Ziel. Ordnung ist das Ziel, aber leichtgewichtig: Ein Teil in die richtige Box werfen bringt Geld, mehr Sortier-Bürokratie gibt es nicht.

**Spielgefühl-Einordnung (Rückfrage 2, bestätigt): „glaubwürdig, aber verzeihend".** Echte Physik für Greifen, Fallen, Stapeln, Werfen. Keine Hydrauliksimulation, kein Kippen des Baggers, kein Kraftstoff, kein Verschleiß. Der Greifer verliert Last nur bei klar erkennbaren Fehlern (Kap. 6.3).

### 2.1 Was sich gut anfühlen muss

| Gefühl | Konkret | Fertig, wenn … |
|---|---|---|
| Greifen ist satt `[MVP]` | Spinne schließt in 0,4 s, öffnet in 0,3 s (`excavator.ts:55-56`). Gegriffenes Teil wandert in 0,15 s **(SW)** in eine definierte Haltepose (Kap. 6.2) und wird kinematisch mitgeführt — nichts schwebt, keine Zacke steckt im Teil | Tester greift 10 verschiedene Objekte; keines zittert, clippt, schwebt oder teleportiert (Gerätetest 02.09., Befund 6 behoben) |
| Masse ist spürbar `[MVP]` | Anlauf-/Auslauframpe 0,2 s (`excavator.ts:57`). Lastfaktor: Oberwagen-Drehrate sinkt linear mit Last, bei 1 000 kg auf 75 % **(SW)**, bei Maximallast 3 500 kg auf 50 % **(SW)** | Blindtest: Tester erkennt am Drehverhalten, ob die Spinne leer, halb oder voll ist |
| Werfen belohnt `[MVP]` | Beim Öffnen im Schwenk übernimmt das Teil die Spinnengeschwindigkeit (Kap. 6.2); richtiger Abwurf → Materialklang + Ampel grün + „+0,05 €/kg"-Ticker (`account.ts:18`) | Tester trifft nach 5 min Übung aus 5 m gezielt den Stahlhaufen (8 von 10 Würfen) |
| Der Bagger bremst nur, wenn er pflügt `[MVP]` | Widerstand nur aus tatsächlichem Kontakt in Bewegungsrichtung (Kap. 6.4), nicht aus einer Kugel unter der Spinne (Prototyp-Fehler `collision.ts:102-125`) | Tester senkt die offene Spinne über einen Haufen: keine Verlangsamung bis zum Kontakt; Schwenken durch den Haufen verlangsamt spürbar |
| Kein Stress als Default `[MVP]` | Freies Spiel ohne Timer; Fuhren warten geduldig (Kap. 13) | Tester lässt eine Fuhre 10 min liegen — nur der Auftragsbonus entgeht, nichts geht kaputt |
| Ziel ist klar `[MVP]` | Morgen-Karte mit 3 Aufträgen, Abend-Bilanz mit Sternen | Tester sagt nach Tag 1 ohne Nachfrage, was er heute tun soll, warum, und was er dafür bekommt |
| Zerstören wirkt `[V1]` | Scheiben bersten ab Δv 4,5 m/s, Quetschstufe ab Δv 7 m/s (`carDef.ts:41-42`); Partikel + Klang je Materialtreffer | Tester lässt freiwillig 3 Wracks fallen, nur um zuzuschauen |

### 2.2 Referenztitel

| Titel | Das übernehmen wir | Das machen wir bewusst anders |
|---|---|---|
| PowerWash Simulator | Entspannter Flow, sichtbarer Vorher/Nachher-Fortschritt, Abhaken ohne Zeitdruck | Bei uns gibt es ein Falsch: Man kann fehlsortieren. Das ist die Spannung, die PowerWash nicht hat |
| Teardown | Lesbare, stilisierte Materialwelt; Freude an Physik-Interaktion | Keine Voxel, keine freie Zerstörung — Zerlegung folgt einem Regelsystem (Kap. 8) |
| Construction Simulator / Bagger-Simulatoren | Achsweise Maschinensteuerung, Kabinengefühl, Stolz auf die Maschine | Kein Simulator-Ballast: kein Tanken, keine 1:1-Hydraulik, keine Kippgefahr; Touch-tauglich |
| Unpacking | Die stille Befriedigung, Dinge an den richtigen Ort zu legen | Mit Geld-Feedback und Physik statt Rasterlogik |
| Mini Motorways | Visuelle Ruhe: graue Welt, farbige Nutzinformation | Bei uns 3D und Maschinensteuerung statt Linienziehen |

---

## 3. Zielgruppe & Plattform

| Aspekt | Festlegung |
|---|---|
| Spielertyp | „Feierabend-Sortierer": will 6–10 min pro Tag kompetent sein, mehrere Tage am Stück möglich. Sekundär: Baumaschinen-Fans, die Steuerungstiefe suchen (Profi-Achsmodus) |
| Vorwissen | Keins. Materialkunde wird im Spiel beigebracht (Kap. 14.3); reale Begriffe im Glossar und in Tooltips |
| Eingabegeräte | `[MVP]` Touch (2 Sticks + Greif-Knopf, Kap. 5) und Tastatur + Maus. `[V1]` Gamepad (Standard-Mapping). `[Später]` echte USB-Joysticks |
| Orientierung | Querformat. Hochformat zeigt einen Sperrbildschirm „Bitte Gerät drehen" (Web); Lock im Capacitor-Wrapper `[V1]` |
| Leitgerät (Entwicklung/Test) | iPad (Safari, PWA vom Home-Screen). Kompaktlayout: iPhone mini (375 × 812 CSS-px quer, Safe-Area 47–59 px) |
| Unterste unterstützte Konfiguration Mobile | **Annahme:** Android-Mittelklasse ab 2022 — Snapdragon 695 / Dimensity 700, 4 GB RAM, Android 11 (API 30); iOS: iPhone 12 mini (A14), iOS 17. Auf dieser Klasse: stabil ≥ 30 fps bei den Budgets aus Kap. 19. Läuft es dort nicht, wird Inhalt gekürzt (Teile pro Fuhre), nicht das Gerät fallen gelassen |
| Android-Testgerät | Vor dem Store-Release wird ein Gerät der untersten Konfiguration (~150 €) beschafft; bis dahin gilt iPad/iPhone als Stellvertreter (Safari ist bei WebGL/WASM konservativer als Android-Chrome, Roadmap-Argument) |
| Desktop | Jeder Browser mit WebGL2. Referenz Entwicklung: der vorhandene Windows-PC (Intel HD 5500) muss **30 fps** mit vollem Platz schaffen (Messung 02.09.: 18–28 fps im Prototyp); Intel Iris Xe **60 fps** |
| Sprachen | `[MVP]` Deutsch. `[V1]` Englisch. Alle Texte von Anfang an in `data/i18n/*.json`, keine Literale im Code |

---

## 4. Gameplay-Loops

### 4.1 Sekunden-Loop — ein Griff (8–15 s) `[MVP]`

1. **Erkennen:** Teil auf dem Haufen nach Farbe, Silhouette und Bodenring identifizieren (Kap. 16.2). Der Griff-Info-Chip zeigt Fraktion, kg und €-Stufe des Teils, über dem die Spinne steht.
2. **Anfahren:** Oberwagen drehen, Ausleger/Stiel führen, bis der Bodenring das Teil deckt.
3. **Greifen:** Spinne schließen (0,4 s). Haltepose stellt sich ein (0,15 s). Griff-Info wechselt zu „gegriffen".
4. **Heben und Schwenken:** Lastfaktor bremst spürbar. Ziel-Container-Ampel am Bodenring zeigt grün (richtig) / rot (falsch) / neutral (Boden).
5. **Ablegen oder Werfen:** Spinne öffnen. Richtiger Container → Materialklang, Ampel grün, Sortierprämie-Ticker. Falscher Container → stumpfer Klang, Ampel rot, Reinheit des Containers sinkt (Kap. 9.4).

*Fertig, wenn:* Ein geübter Spieler schafft einen kompletten Zyklus in 8–15 s; jeder der fünf Schritte hat mindestens einen hörbaren und einen sichtbaren Rückkanal.

### 4.2 Minuten-Loop — eine Fuhre (3–5 min) `[MVP]`

Fahrzeug fährt ein → Waage (Kap. 9.1) → Ankauf zum Tageskurs → Fahrzeug fährt zur Annahmefläche und kippt ab → Spieler sortiert (Sekunden-Loop × 5–20) → Störstoffe in die Störstoffbox → optional Verbundobjekt zerlegen (Kap. 8) → Abholer laden, wenn eine Box voll genug ist (Kap. 9.5).

*Fertig, wenn:* Eine Privat-Fuhre (≤ 800 kg, `customers.ts:251`) ist in unter 5 min abgearbeitet; eine Gewerbe-Fuhre (≤ 3 000 kg) in unter 8 min.

### 4.3 Session-Loop — ein Arbeitstag (6–10 min) `[MVP]`

| Phase | Was passiert | Dauer |
|---|---|---|
| Morgen-Karte | Tag n/30 · Konto · 3 Aufträge · Tageskurse · ein Lambert-Satz | bis Klick |
| Betrieb | Fuhren kommen im Abstand 60–90 s **(SW)**: Tag 0: 1 (Tutorial) · Tag 1–3: 2 · Tag 4–10: 3 · ab Ausbaustufe 2: 4 · ab Stufe 3: 5. Nach der letzten Fuhre: Tor zu, Schild „Feierabend" | 4–7 min |
| Feierabend | Kein Nachschub, kein Timer. Restsortierung, Pressen, Abholer laden. Spieler beendet den Tag per Button „Tag beenden" | offen, typisch 1–3 min |
| Abend-Bilanz | Einnahmen (Verkäufe + Sortierprämie) − Ausgaben (Ankauf + Fixkosten) = Tagesgewinn · Aufträge ✓/✗ mit Bonus · Sterne 0–3 · Ausbau-Fortschritt · Autosave | bis Klick |

Was am Abend lose liegt, bleibt liegen — der Platz ist persistent. Kein Game Over: Konto unter −1 500 € (`account.ts:32`) heißt „Willi streckt vor", Fixkosten +20 % bis getilgt.

**Abweichung zum GDD v2:** Dort 12–20 min pro Tag mit 2–4 Fuhren. Rückfrage 3 hat 6–10 min bestätigt; deshalb weniger Fuhren pro Tag und dichterer Abstand. Die 30-Tage-Kampagne dauert damit 3–5 Stunden Spielzeit.

*Fertig, wenn:* Drei Tester brauchen für Tag 2 jeweils zwischen 6 und 10 min (Morgen-Karte bis Abend-Bilanz); Bilanz zeigt alle vier Posten.

### 4.4 Meta-Loop — 30 Tage (3–5 h) `[MVP]` Tag 0–3, `[V1]` Tag 4–30

Sterne und Geld schalten drei sichtbare Ausbaustufen frei (Kap. 10.4). Tag 30 = Abschlusskarte (Willi bleibt Partner oder verkauft seinen Anteil an Daniel — abhängig von Sternen). Danach freies Spiel ohne Frist.

*Fertig, wenn:* Drei Tester erreichen Ausbaustufe 2 zwischen Tag 6 und Tag 12; Stufe 3 zwischen Tag 18 und 28.

---

## 5. Baggersteuerung

Die Maschine ist ein Umschlagbagger (Vorbild Sennebogen-Klasse, `clawGeometry.ts`) mit Mobilfahrwerk, Abstützung, Oberwagen, Hauptarm („Ausleger"), Stiel, Rotator und fünfzinkiger Greifspinne. Kinematik-Kern aus dem Prototyp (`excavator.ts:1015-1176`, ~300 Zeilen) wird übernommen; alle Zahlen sind Startwerte.

### 5.1 Achsen und Grenzwerte

| Achse | Bereich | Geschwindigkeit | Rampe | Herkunft | Prio |
|---|---|---|---|---|---|
| Fahrwerk vor/zurück | — | 2,2 m/s ≈ 8 km/h **(SW, erhöht)** | 0,2 s | `excavator.ts:49` hatte 1,4 m/s — Gerätetest 02.09.: „fährt zu langsam" | `[MVP]` |
| Lenkung | ±35° | 0,7 rad/s, skaliert mit Fahrgeschwindigkeit (min 0,35) | — | `excavator.ts:50, 1043` | `[MVP]` |
| Oberwagen drehen | endlos | 40°/s leer, × Lastfaktor | 0,2 s | `excavator.ts:51` | `[MVP]` |
| Hauptarm heben/senken | 5°–62° | 25°/s | 0,2 s | `excavator.ts:43-44, 52` | `[MVP]` |
| Stiel heran/weg | −140°–−25° | 30°/s | 0,2 s | `excavator.ts:45-46, 53` | `[MVP]` |
| Spinne öffnen/schließen | 0–100 % | schließt 0,4 s, öffnet 0,3 s | — | `excavator.ts:55-56` | `[MVP]` |
| Rotator | endlos | 15°/Raste (diskret) oder 45°/s (gehalten) | — | `excavator.ts:54` | `[MVP]` |
| Kabinenhub | 0–2,6 m | 0,75 m/s | — | `excavator.ts:58-59` | `[V1]` |
| Abstützung aus/ein | 2 Zustände | 1,4 s | — | `excavator.ts:36` (Schild-Analogie) | `[V1]` |
| Räumschild | hoch/runter | 1,4 s | — | `excavator.ts:33-36` | `[Später]` |

Lastfaktor auf Oberwagen und Hauptarm: `1 − 0,5 × (Last / 3 500 kg)` **(SW)**, Untergrenze 0,5. Der Ausbau „Halle + Radlader" (Kap. 10.4) hebt Tempo × 1,35 und Traglast × 1,5 (`main.ts:456-457`).

### 5.2 Tastenbelegung

Tastenbelegung ist Daten (`data/controls.json`) und im Menü frei änderbar; die Achsbelegung der Sticks folgt dem Prototyp (`controlConfig.ts:47-54`).

| Funktion | Tastatur + Maus `[MVP]` | Touch `[MVP]` | Gamepad `[V1]` |
|---|---|---|---|
| Oberwagen drehen | Q / E | Stick L ↔ | Stick L ↔ |
| Hauptarm heben/senken | R / F | Stick L ↕ | Stick L ↕ |
| Stiel heran/weg | T / G | Stick R ↕ | Stick R ↕ |
| Spinne schließen | Linke Maustaste halten (Toggle-Option) | GREIFEN-Knopf Ø 76 px halten (Toggle-Option) | RT halten |
| Rotator links/rechts | Mausrad | ↺ ↻ Knöpfe Ø 48 px über GREIFEN | LB / RB |
| Fahren vor/zurück | W / S | Fahr-Modus-Toggle Ø 56 px, dann Stick L ↕ | LT (zurück) / A-Taste hält Fahr-Modus, Stick L |
| Lenken | A / D | Fahr-Modus, Stick L ↔ | Stick L ↔ im Fahr-Modus |
| Kamera drehen/neigen | Mittlere Maustaste ziehen oder Rechtsklick ziehen | Ein Finger auf freier Fläche wischen | Stick R ↔ (leer) |
| Zoom | Shift + Mausrad | Pinch | D-Pad ↑↓ |
| Ansicht wechseln | C | Kamera-Knopf 48 × 48 oben rechts oder Doppeltipp | Y |
| Menü / Pause | Esc | `II` 48 × 48 oben links, `≡` oben rechts | Start / Select |
| Abholer rufen | H | im `≡`-Bottom-Sheet | im Menü |
| Tag beenden | Enter (nur im Feierabend) | Button erscheint im Feierabend | A im Feierabend |

**Wichtig aus der Analyse:** Der Prototyp nannte in Tutorial-Texten drei verschiedene Tasten für den Ausbau (A3). In v2 werden Tastennamen im Text aus `controls.json` generiert, nie hart geschrieben.

**Touch-Layout** verbindlich nach `04_Stilguide_und_Touch.md` Kap. 2 (Positionen relativ zur Safe-Area, alle Tippziele ≥ 44 px, Sticks Ø 120 px „floating" in den äußeren 40 %-Zonen, Pointer-Capture). Kompaktlayout iPhone mini: gleiche Elemente, Sticks Ø 100 px, Griff-Info-Chip einzeilig, keine Überlappung — geprüft per automatisiertem `getBoundingClientRect()`-Test bei 375 × 812 und 390 × 844.

*Fertig, wenn:* Automatischer Layout-Test findet bei 3 Viewport-Größen (iPhone mini, iPhone 15, iPad 11") keine Überlappung zweier eingabefähiger Elemente; ein fremder Tester bedient den Bagger auf dem iPhone mini 3 min lang, ohne einen dritten Finger zu brauchen.

### 5.3 Kamerasystem `[MVP]`

| Modus | Beschreibung | Werte |
|---|---|---|
| Orbit (Standard) | Schulterkamera hinter der Kabine, dreht mit dem Oberwagen mit; Ziel = Greiferposition, weich nachgeführt | Zeitkonstante 0,3 s; Abstand 3–18 m, Start 11 m; Pitch 5°–75°, Start 24°; FOV 50° Handy / 55° Desktop |
| Draufsicht | Fast senkrecht von oben, folgt dem Bagger | 25 m, 60° Pitch |
| Kabine `[V1]` | Aus der Kabine, Kopf dreht mit Stick R ↔ | FOV 80° |
| Wechsel | weicher Blend | < 0,3 s |
| Verdeckung | Kamera weicht nach oben aus, wenn Greifer verdeckt | nie > 1 s verdeckt (Log-Messung) |

Die Seitenansicht des Prototyps entfällt (A4: verwirrend, nie genutzt).

### 5.4 Assistenzfunktionen

| Assistent | Spezifikation | Abschaltbar | Prio | Fertig, wenn … |
|---|---|---|---|---|
| Bodenring | Ring unter der Spinne, Ø = aktuelle Greiferöffnung, projiziert auf oberstes Objekt/Boden. Weiß neutral, Fraktionsfarbe über greifbarem Teil, Ampelfarbe über Container | nein | `[MVP]` | Tester nennt aus der Orbit-Sicht ohne HUD, ob die Spinne über dem Zielteil steht (8/10) |
| Griff-Info-Chip | Fraktion + Piktogramm + kg + €-Stufe des Teils unter dem Sensor bzw. des gegriffenen Teils | nein | `[MVP]` | Chip aktualisiert in < 100 ms nach Sensorwechsel |
| Snap (Greif-Magnet) | Liegt genau ein greifbares Teil ≤ 0,5 m **(SW)** seitlich vom Sensor und GREIFEN wird gedrückt, gleiten Oberwagen/Stiel in 0,25 s auf das Teil, bevor die Spinne schließt. Kein Snap bei Verbundteilen | ja (Standard an) | `[MVP]` | Erstspieler greift 5 einzelne Teile ≤ 60 s nach Tutorial-Start |
| Auto-Öffnen über grüner Ampel | Bei losgelassenem GREIFEN öffnet die Spinne erst, wenn sie ≤ 1,5 m über dem Füllstand des Containers ist | ja (Standard aus) | `[V1]` | keine Fehlwürfe über den Muldenrand in 20 Abwürfen |
| IK-Zielmodus („Einsteiger") | Stick R bewegt einen Zielpunkt am Boden, Stick L ↕ = Höhe; Hauptarm, Stiel und Oberwagen folgen per inverser Kinematik mit den normalen Geschwindigkeitsgrenzen | ja (Profi-Modus) | `[V1]` | 3 von 4 Erst-Testern sortieren 10 Teile richtig ohne Hilfe; Umschalten ohne Neustart |
| Fahr-Modus-Auto-Exit | Fahr-Modus endet, wenn 4 s kein Fahrbefehl und ein Arm-Befehl kommt | nein | `[MVP]` | Tester wechselt Fahren → Greifen ohne bewussten Toggle in 8/10 Fällen |

**Begründung IK als `[V1]`:** Der Achsmodus muss zuerst allein bestehen (er ist der USP). IK ist das Sicherheitsnetz, wenn der Achsmodus Erst-Tester überfordert — das entscheidet die Abnahme von M5, nicht die Planung.

---

## 6. Physik & Simulation

Physik-Engine: Rapier 3D (WASM), fester Schritt 60 Hz, Render-Interpolation zwischen Schritten (fehlte im Prototyp → Ruckeln auf 90/120-Hz-Displays, A2). Maximal 2 Nachholschritte pro Bild **(SW)**; danach wird Simulationszeit verworfen (kein Zeitlupen-Effekt wie im Prototyp mit 5 Nachholschritten).

### 6.1 Echt simuliert vs. gefaked

| Verhalten | Echt | Gefaked / vereinfacht | Prio |
|---|---|---|---|
| Fallen, Rollen, Stapeln, Rutschen loser Teile | ✔ Rigid Bodies mit Konvex-Kollidern (Box, Zylinder, Kugel, Konvex-Hülle ≤ 32 Ecken) | — | `[MVP]` |
| Bagger-Kinematik | — | ✔ Rein kinematische Kette (Winkel, Rampen, Lastfaktor). Kein Kippen, kein Federweg | `[MVP]` |
| Bagger-Kollider | ✔ Kinematische Körper für Unterwagen, Oberwagen, Arm, Stiel, Spinne (folgen der Kinematik) | Arm stoppt nicht hart, sondern gleitet mit Widerstand (Kap. 6.4) | `[MVP]` |
| Greifen | ✔ Kontaktprüfung mit den Zinken-Kollidern | ✔ Gehaltenes Teil wird kinematisch mitgeführt (Kap. 6.2) | `[MVP]` |
| Werfen | ✔ Teil erhält Spinnengeschwindigkeit beim Loslassen | — | `[MVP]` |
| Masse/Gewicht | ✔ Masse aus Materialdichte × Volumen (Kap. 7) | Lastfaktor auf Achsen ist Formel, nicht Hydraulik | `[MVP]` |
| Pendeln der Spinne | — | ✔ Ein-Achs-Pendel mit Dämpfung (`excavator.ts:1329-1336`, Kappung 15 m/s², Pendellänge 1,5 m) | `[MVP]` |
| Container-Füllstand | — | ✔ Sortierte Teile werden nach 3 s Ruhe im Container zu Masse+Reinheit verbucht und als Mesh entfernt (Kap. 19.3) | `[MVP]` |
| Zerlegung | ✔ Abreiß-Timer aus Zugrichtung und Haltezeit (Kap. 8) | ✔ Teil trennt sich per Regel, keine Bruchmechanik | `[MVP]` |
| Karosse quetschen | — | ✔ 3 Quetschstufen als Mesh-Skalierung (`carDef.ts:40`) | `[MVP]` Presse, `[V1]` Aufprall |
| Scheiben bersten | — | ✔ Partikel + Klang ab Δv-Schwelle | `[V1]` |
| Fahrzeuge (Lkw, Anhänger) | — | ✔ Kinematische Fahrt auf Splines; Ladung während der Fahrt kinematisch, beim Kippen dynamisch (`vehicles.ts:511-521`) | `[MVP]` |
| Kippgefahr Bagger, Bodenverformung, Reifenphysik, Hydraulikdruck, Wetterphysik | — | bewusst **nicht** simuliert | — |

### 6.2 Greifen technisch `[MVP]`

1. **Sensor:** Kugel, Radius 1,05 m (`gripSystem.ts:20`), Mittelpunkt in der Korbmitte (0,75 m unter dem Palm, `excavator.ts:40`). Kandidaten: alle dynamischen Körper, deren Kollider die Kugel schneidet, sortiert nach Abstand zur Korbachse.
2. **Greiffenster:** Zupacken gilt, wenn der Schließgrad zwischen 60 % und 98 % liegt (`gripSystem.ts:18-19`) und mindestens 2 Zinken-Kollider **(SW)** den Kandidaten berühren (Kontakt-Events). Der Prototyp griff, sobald der nächste Oberflächenpunkt im Korb lag — das erzeugte die schiefen Halteposen.
3. **Kapazität:** max. 5 Teile, max. 3 500 kg (`gripSystem.ts:14-15`), × Traglast-Bonus. Ein zu schweres Teil wird nicht gegriffen: Spinne schließt, rutscht ab (Klang + Chip „zu schwer").
4. **Haltepose:** Nach dem Zupacken wird das Teil über 0,15 s **(SW)** interpoliert: nächster Oberflächenpunkt → Korbmitte; längste Objektachse → parallel zur Zinkenebene bei Stangen/Trägern, sonst unverändert. Danach wird der Körper auf `KinematicPositionBased` gesetzt und jedem Schritt an die Spinnen-Transformation gebunden.
5. **Kollisionsgruppen:** Gehaltene Teile verlassen die Gruppe „lose" und kollidieren weiter mit Boden, Containern und anderen losen Teilen, aber nicht mit der Spinne. Zinken-Kollider bleiben aktiv (Prototyp schaltete sie ab, `excavator.ts:964-985`).
6. **Loslassen:** Körper wird wieder `Dynamic`, erhält Linear- und Winkelgeschwindigkeit der Spinne (aus den letzten 3 Schritten gemittelt) plus 0,2 m/s nach unten **(SW)**.
7. **Sicherheit:** Jeder Body-Zugriff über den Manager mit `isValid()`; Entfernen eines gehaltenen Teils (Presse, Verkauf, Bündelung) löst `onRemoved` aus, das den Griff löst — der H1-Absturz des Prototyps (`gripSystem.ts:229`).

*Fertig, wenn:* Kopfloser Sim-Test „greife Träger, hebe 3 m, schwenke 180°, trage 5 m, lege ab" läuft 100 × mit zufälligen Startlagen ohne Ausreißer > 5 m/s und ohne Körper-Durchdringung > 5 cm; Gerätetest: keine sichtbar falsche Haltepose bei 10 verschiedenen Teilen.

### 6.3 Abrutschen (die „verzeihende" Regel) `[MVP]`

Ein gehaltenes Teil rutscht **nur** in drei Fällen ab — alle für den Spieler vorhersehbar:

| Auslöser | Regel **(SW)** | Rückmeldung |
|---|---|---|
| Überlast | Last > 100 % Kapazität: Griff kommt nicht zustande | Klang „Rutschen", Chip „zu schwer (3 800 / 3 500 kg)" |
| Schwungwurf | Oberwagen-Winkelgeschwindigkeit > 90 % Maximum **und** Last > 60 % Kapazität für > 1,5 s | Spinne vibriert (Klang + Haptik) 0,5 s vor dem Verlust |
| Kollision | Gehaltenes Teil prallt mit Δv > 3 m/s an Hindernis (Container-Wand, Fahrzeug) | Klang „Aufprall", Teil fällt |

Keine zufällige Abrutsch-Wahrscheinlichkeit pro Sekunde (v1-Briefing) — Zufall ohne Vorwarnung fühlt sich auf Touch wie ein Bug an.

### 6.4 Arm-Kollision und Pflügwiderstand `[MVP]`

- Pro Schritt Shape-Cast der Spinnen- und Stiel-Kollider **entlang des Bewegungsvektors** (Rapier `castShape`). Nur Kontakte in Bewegungsrichtung zählen.
- Widerstand = Σ Masse der getroffenen dynamischen Körper / 800 kg **(SW)**, geklemmt auf Faktor 0,3–1,0 auf die betroffene Achse — nicht auf alle Achsen (Prototyp-Fehler `excavator.ts:1022-1023`).
- Getroffene Körper erhalten Impuls in Bewegungsrichtung (Verdrängung), skaliert mit der Achsgeschwindigkeit. Statische Hindernisse (Boden, Container, Gebäude) stoppen die Achse weich (Rampe 0,1 s), kein Rückrollen auf den Vorzustand.
- Sondenradius wird aus `clawGeometry` abgeleitet (Krallenspitzen), nicht frei gesetzt (Messung 4, 02.09.: Sonde reichte 79 cm tiefer als die Krallen).

*Fertig, wenn:* Sim-Test: offene Spinne sinkt senkrecht auf einen ruhenden Haufen — Achsgeschwindigkeit bleibt bis zum ersten Kontakt bei 100 %; beim Durchschwenken durch 500 kg Haufen fällt sie auf 40–70 %.

### 6.5 Stapelverhalten, Schwerpunkt, Haufen

- Schwerpunkt = geometrischer Mittelpunkt des Kolliders (keine exzentrischen Massen) `[MVP]`.
- Haufen beim Spawn mit ≥ 8 cm Abstand **(SW)** setzen, vor dem ersten Bild 120 Schritte vorsimulieren und schlafen legen (A2: Prototyp-Haufen schlief nie; 4 cm Abstand).
- Solver: 6 Iterationen, 2 Reibungsiterationen **(SW)**, `contact_natural_frequency` 30 **(SW)** — Werte in `data/balancing.json`, nicht im Code (Prototyp: 12 / 6 / 40, `physicsWorld.ts:16-21`).
- Sleep: linear 0,02 m/s, angular 0,05 rad/s **(SW)**; Wächter-Test „150 Teile, 600 Schritte, alle schlafen, Physikzeit < 0,3 ms/Schritt".

### 6.6 Bewusst nicht simuliert

Kippen des Baggers · Hydraulikdruck und -geschwindigkeit als Funktion der Last (nur Lastfaktor-Formel) · Kraftstoff, Verschleiß, Wartung · Bodenverformung, Schlamm · Bruchmechanik (Teile brechen nur per Regel in Kap. 8) · Weiche Körper (Kabel sind starre Coils) · Wind · Reifendruck · Kollisionen zwischen Kundenfahrzeugen.

---
## 7. Material- und Schrottkatalog

Preise in €/kg. Ankaufs- und Verkaufspreise aus `materials/catalog.ts:24-36`, dort als **(SW)** markiert; Dichten sind Realwerte (Handbuch), Gewichte ergeben sich aus Volumen × Dichte × Füllgrad (Hohlkörper 0,15–0,4). Farben nach v2-Palette (`04_Stilguide_und_Touch.md` 1.1, ΔE ≥ 25 zwischen Fraktionen). Negativer Verkaufspreis = Entsorgungskosten.

| Fraktion | Prio | Dichte kg/m³ | Typ. Teilgewicht | Ankauf €/kg | Verkauf €/kg | Zielcontainer | Typische Fehlsortierung | Visuelle Erkennung (Farbe · Silhouette · Piktogramm) |
|---|---|---|---|---|---|---|---|---|
| Stahlschrott (inkl. Guss) | `[MVP]` | 7 850 | 15–600 kg | 0,18 | 0,25 | **Stahlhaufen** (offen, groß) | Edelstahl im Stahl (sieht ähnlich, 5× wertvoller); Motorblock als Störstoff | `#4a5563` kalt blaugrau, Rost nur als Decal · eckig, dick, lang: Träger, Rohr, Blech, Heizkörper, Motorblock · Doppel-T-Querschnitt |
| Edelstahl VA | `[MVP]` | 7 900 | 5–80 kg | 1,00 | 1,40 | Box VA | VA in den Stahlhaufen (häufigster Fehler, kostet 1,15 €/kg) | `#f2f6f8` spiegelnd (metalness 0,9) · Gefäß: Spülbecken, Tank, Geländer · Spülbecken |
| Aluminium | `[MVP]` | 2 700 | 2–40 kg | 1,10 | 1,50 | Box Alu | Alu und VA verwechselt (beide hell) — Gewicht entscheidet: Alu ist leicht | `#a9b6c2` matt (roughness 0,6) · flach, dünn, rund: Felge, Tafel, Profil, Fensterrahmen · Felge |
| Kupfer/Messing | `[MVP]` | 8 900 / 8 500 | 1–60 kg | 6,00 | 7,20 | Box Kupfer | Kupferrohr als Kabel; Kabel als Kupfer (Kabel hat Mantel!) | `#d9742e` satt orange, Messing `#c9a227` · Rohr, Boiler, Rohrbund als Spirale (nie Torus), Armaturen · gebogenes Rohr |
| Kabel | `[MVP]` | 3 500 (Bündel) | 3–50 kg | 1,60 | 2,20 | Box Kabel | Kabel in Kupfer-Box (Mantelanteil verunreinigt) | Mantel `#1d1f22` / `#2f5f9e` / `#b2332b`, Kupferkern an den Enden · unregelmäßiger Coil, Trommel · Kabelrolle |
| Störstoff (Holz, Baumisch, Kunststoff, Reifen mit Felge) | `[MVP]` | 400–2 400 | 5–60 kg | 0,00 | −0,08 (Holz −0,02, Baumisch −0,04, Reifen −0,05, `catalog.ts:32-35`) | Störstoffbox | Störstoff in Metallbox → Reinheitsverlust | Holz `#8b5a2b` gestreift · Beton `#b9b6ad` kantig · Reifen `#1a1a1a` Torus (einziger Torus im Spiel) · Ziegel mit Riss |
| Starterbatterie | `[MVP]` als Zerlegeteil | 1 100 (Blockwert) | 15–20 kg | 0,00 | 0,40 **(SW)** | `[MVP]` Störstoffbox mit Sonderklang „Gefahrgut", `[V1]` eigene Batteriebox | Batterie in Stahl (Säure → Reinheitsverlust −5 % pauschal) | schwarzer Block mit zwei Polen, gelbes Warnsymbol · Batterie-Piktogramm |
| Reifen (ohne Felge) | `[V1]` | 1 100 | 8–12 kg | 0,00 | −0,05 | Reifenbox | in Störstoff (nur leichter Verlust) | `#1a1a1a` Torus mit Profil |
| Elektroschrott (Waschmaschine, Herd, Kabelbaum) | `[V1]` | 800 (Gerät) | 30–90 kg | 0,20 | 0,35 | Box E-Schrott | als Stahl (Gerätehülle ist Stahl, aber E-Schrott gilt gesetzlich getrennt) | weiße/graue Gehäuse mit Bedienfeld · Waschmaschine |
| Katalysator | `[V1]` | — | 3–5 kg | — | 40,00 **(SW)** pro Stück | Kupfer-Box (Edelmetall-Abnehmer) | in Stahl (200 € Verlust — der teuerste Fehler im Spiel) | Edelstahl-Zylinder mit zwei Rohren, kleiner als er wirkt |
| Akkus (Li-Ion, E-Bike) | `[Später]` | — | 2–5 kg | 0,00 | −0,50 | Gefahrgutbox | in Presse → Brand-Ereignis | orange Warnstreifen |
| Blei, Zink, Bronze | `[Später]` | 11 300 / 7 100 / 8 800 | — | — | — | — | — | — |

**Reinheit:** `1 − Fremdmasse / Gesamtmasse` (`purity.ts:8-11`). Verkaufserlös = kg × Verkaufspreis × Reinheit² (`purity.ts:26`). HUD-Prognose und Auszahlung nutzen **dieselbe** Funktion (Prototyp: HUD ² vs. Verkauf ³, `account.ts:119` — behoben).

*Fertig, wenn:* Screenshot aus 15 m mit 10 Zufallsteilen: Tester ordnet auf dem iPhone ohne HUD ≥ 8 richtig zu (Stilguide Kap. 3). ΔE-Prüfskript (`tools/qa/palette_check.mjs`) meldet keine Fraktionspaarung < 25.

---

## 8. Zerlegungs-Mechanik

### 8.1 Das System: Verbundobjekte (`Composite`) `[MVP]`

Ein Verbundobjekt besteht aus einem **Rumpf** (ein Rigid Body) und **Baugruppen** (`PartDef`, `carDef.ts:7-22`), die am Rumpf verankert sind. Baugruppen haben keinen eigenen Körper, bis sie abgerissen sind — dann werden sie zu normalen Schrottteilen ihrer Fraktion. Die Definition liegt in `data/composites.json`; ein neues Wrack (Waschmaschine, Motorrad, Transporter) braucht nur einen neuen Eintrag, keinen Code.

| Feld je Baugruppe | Bedeutung | Beispiel Motor |
|---|---|---|
| `materialId` | Fraktion nach dem Abriss | steel |
| `massKg` | Masse; wird beim Abriss vom Rumpf abgezogen | 210 |
| `anchor` | Position am Rumpf | [0, 0.62, 1.45] |
| `grabRadius` | Greift die Spinne in diesem Radius um den Anker, fasst sie die Baugruppe statt des Rumpfs | 1,0 m |
| `tearSeconds` | Sekunden Zug über der Lösekraft bis zum Abriss | 2,6 s |
| `tool` | Werkzeug, das den Abriss erlaubt | `grapple` |
| `requires` | Baugruppen, die vorher entfernt sein müssen | — |
| `blocksPress` | Solange vorhanden, verweigert die Presse | true |
| `unlockDay` | Ab welchem Spieltag diese Baugruppe im Auftragspool auftaucht | 2 |

**Ablauf eines Abrisses:**

1. Spinne fasst im `grabRadius` einer Baugruppe → Rumpf und Baugruppe werden gemeinsam gehalten, HUD-Chip zeigt „Motor · 210 kg · hält". Bodenring wird gelb.
2. Spieler zieht (Hauptarm heben oder Oberwagen drehen, während Rumpf durch Eigengewicht oder Bodenkontakt hält) oder dreht den Rotator. Zugkraft-Schätzung 0–1 aus Achsgeschwindigkeit × Lastfaktor (`excavator.ts:1432`). Rotator-Drehung zählt × 1,8 **(SW)** („mit gedrehter Spinne geht es schneller", `carDef.ts:76-78`).
3. Timer läuft, solange Zugkraft > 0,5 **(SW)**; Chip-Balken füllt sich, Klang „Knirschen" steigt an.
4. Bei `tearSeconds` erreicht: Baugruppe löst sich (Klang „Reißen", Partikel), wird eigener Körper in der Spinne; Rumpf fällt zurück, verliert die Masse. Event `partTorn`.
5. Falsche Reihenfolge (`requires` nicht erfüllt): Timer läuft nicht, Chip zeigt „erst Räder ab" — keine Strafe, nur Information. **Annahme:** Kein Schaden durch falsche Reihenfolge im MVP; das Spiel ist verzeihend.

*Fertig, wenn:* Sim-Test: Motor wird in 2,4–3,0 s bei Zugkraft 1,0 gelöst und erscheint als Stahl-Teil mit 210 kg; Rumpf-Körper wiegt danach 210 kg weniger als beim Spawn (Körpermasse = Rumpf 600 kg + noch angebaute Baugruppen).

### 8.2 Werkzeuge

| Werkzeug | Was es löst | Prio |
|---|---|---|
| Greifspinne | Alles mit `tool: grapple` — Motor, Räder, Batterie, Türen | `[MVP]` |
| Presse (Station) | Rumpf quetschen, wenn nichts mehr `blocksPress` | `[MVP]` |
| Schrottschere (Anbaugerät) | Kabelbaum, Tank aufschneiden, Karosse teilen | `[V1]` |
| Magnet (Anbaugerät) | Stahl aus Mischhaufen ziehen (Sortierhilfe, keine Zerlegung) | `[V1]` |
| Shredder (Station) | Störstoff-Abbau, E-Schrott | `[Später]` |

### 8.3 Beispiel Auto vollständig (`composites.json` → `car_compact`)

Rumpf 600 kg Stahl, Gesamt 950 kg (`carDef.ts:33-34`), 4 Scheiben, 3 Quetschstufen (Y-Skalierung 1 / 0,76 / 0,55, `carDef.ts:40`).

| Stufe | Baugruppe | Masse | Fraktion | Werkzeug | `tearSeconds` | `requires` | `blocksPress` | Prio |
|---|---|---|---|---|---|---|---|---|
| 1 | Räder × 4 | 25 kg je | Störstoff (Reifen mit Felge) | Spinne | 1,2 | — | nein | `[MVP]` |
| 2 | Starterbatterie | 18 kg | Batterie (Störstoffbox `[MVP]`, eigene Box `[V1]`) | Spinne (Motorhaube ist offen) | 0,8 | — | **ja** (Säure in der Presse = Umweltstrafe 200 €) | `[MVP]` |
| 3 | Motor | 210 kg | Stahl | Spinne | 2,6 | Batterie | **ja** | `[MVP]` |
| 4 | Katalysator | 4 kg | Kupfer-Box (Edelmetall) | Spinne, `grabRadius` 0,4 | 1,0 | — | nein (aber 40 € verschenkt) | `[V1]` |
| 5 | Tank | 12 kg | Störstoff (Kunststoff) | Schere | 1,5 | — | **ja** (Restkraftstoff) | `[V1]` |
| 6 | Kabelbaum | 15 kg | Kabel | Schere | 2,0 | Motor | nein | `[V1]` |
| 7 | Türen × 4 | 30 kg je | Stahl | Spinne | 1,0 | — | nein | `[V1]` |
| — | Scheiben × 4 | — | zerfallen zu Partikeln bei Δv 4,5 m/s oder in der Presse | — | — | — | — | `[V1]` |
| Ende | Rumpf | 600 kg (`hullMassKg`, ohne Baugruppen; Körpermasse beim Spawn 600 + 210 + 18 + 4 × 25 = 928 kg ≈ `totalMassKg` 950) | Stahl | Presse → Paket 1,6 × 0,8 × 0,6 m | — | — | — | `[MVP]` |

**Wann darf gepresst werden:** Wenn keine Baugruppe mit `blocksPress` mehr am Rumpf hängt. Die Presse verweigert sonst mit Warnlampe und Lambert-Satz („Da ist noch die Batterie drin!"). `[V1]`: Pressen mit Batterie ist möglich, kostet 200 € Umweltstrafe und −1 Stern-Kandidat („Sauber gearbeitet").

**Reihenfolge-Freiheit:** Räder zuerst ist Konvention, nicht Pflicht. Nur Motor braucht Batterie (Zugang), Kabelbaum braucht Motor.

**Auto-Ertrag MVP:** Rumpf 600 kg + Motor 210 kg = 810 kg Stahl × 0,25 € = 202,50 € + Batterie 18 kg × 0,40 € = 7,20 € − Räder 100 kg × 0,05 € = −5 €. Ankauf Auto pauschal 120 € **(SW)** → Marge ≈ 85 € für ~4 min Arbeit, plus Auftrag „Zerlegen" 200 € Bonus `[V1]`. Wer den Motor nicht ausbaut und das Wrack samt Batterie presst, zahlt `[V1]` 200 € Umweltstrafe — die Marge ist dann negativ. Absicht: Zerlegen lohnt, Pfusch kostet; das Auto ist kein Farm-Objekt (max. 1 Tieflader pro Tag).

*Fertig, wenn:* Tester zerlegt ab Tag 5 ein Auto ohne Textanleitung in < 4 min (Räder, Batterie, Motor, Presse) und die Bilanz zeigt den Auftragsbonus.

---

## 9. Annahme, Wiegen & Sortierung

### 9.1 Ablauf einer Anlieferung `[MVP]`

| Schritt | Ort | Was passiert | Spieleraktion | Dauer |
|---|---|---|---|---|
| 1 Anfahrt | Einfahrt → Waage | Fahrzeug erscheint am Tor (Spline), fährt auf die Waage | keine | 8–12 s |
| 2 Wiegen voll | Waage | Bruttogewicht wird angezeigt (Chip über der Waage + HUD) | keine | 2 s |
| 3 Sichtprüfung | Waage | Kartenausschnitt: Ladungsart (Privat-Mix / Gewerbe sortenrein / Fahrzeug), geschätzte Zusammensetzung als Balken (`[MVP]` grob: 3 Klassen „Stahl-lastig / Buntmetall-lastig / Auto"; `[V1]` mit Ausbaustufe 2 exakt), sichtbarer Störstoffanteil | Annehmen / Ablehnen (Ablehnen kostet Ruf `[V1]`, im MVP nur Auftragsbonus) | bis Klick, max. 10 s dann Auto-Annahme |
| 4 Ankaufspreis | Waage | Mischfuhre: 0,16 €/kg pauschal (`account.ts:16`). Sortenreine Gewerbefuhre: Ankaufspreis der Fraktion (Kap. 7). Fahrzeug: 120 € pauschal **(SW)** | keine (kein Verhandeln im MVP) | 1 s |
| 5 Abkippen | Annahmefläche | Fahrzeug fährt rückwärts an, kippt; Ladung wird dynamisch (`vehicles.ts:511-521`) | keine | 6–10 s |
| 6 Wiegen leer | Waage | Tara, Nettogewicht = Zahlbetrag; Geld geht ab, Toast „−128 €" | keine | 2 s |
| 7 Abfahrt | Waage → Tor | Fahrzeug verlässt den Platz | keine | 8 s |
| 8 Sortieren | Annahmefläche → Boxen | Sekunden-Loop | Hauptarbeit | 2–5 min |
| 9 Verkauf | Boxen → Abholer | Kap. 9.5 | Abholer rufen, laden | 1–2 min |

Die 16-Phasen-Zustandsmaschine des Prototyps (`vehicles.ts`) wird als datengetriebene Zustandsmaschine (`data/routes.json`, `sim/systems/VehicleSystem.ts`) neu geschnitten, das Verhalten bleibt.

### 9.2 Verunreinigungsgrad und Reinheit

- Jeder Container führt `contentKg` und `contaminationKg`. Ein Teil zählt als Verunreinigung, wenn seine Fraktion ≠ Containerfraktion.
- Reinheit wird als Prozent am Container (Schild) und in der HUD-Ampel gezeigt. Schwellen: ≥ 95 % grün · 80–94 % gelb · < 80 % rot **(SW)**.
- **Korrigieren:** Fehlwürfe lassen sich herausgreifen, solange das Teil noch nicht verbucht ist (3 s Ruhe, Kap. 19.3). Danach ist es Masse im Container — der Fehler kostet beim Verkauf. `[V1]`: „Container umsortieren"-Aktion (Container leert sich als Haufen, 60 s Arbeit).

### 9.3 Reklamation `[V1]`

Abholer prüft beim Laden die Reinheit. Unter 80 %: Reklamation — Abnehmer zahlt Reinheit² und zusätzlich −0,10 €/kg Aufbereitungspauschale **(SW)**; Toast mit Begründung. Unter 60 %: Abnehmer lehnt ab, Container bleibt voll. Im MVP zahlt der Abholer immer Reinheit² ohne Zusatzabzug.

### 9.4 Betrugsversuche durch Kunden `[V1]`

Bewusst zurückhaltend, wegen der Ton-Leitplanke: Betrug ist Verhalten einzelner Figuren, keine Gruppeneigenschaft, und immer ökonomisch, nie kriminell-dramatisch.

| Versuch | Erkennung | Folge bei Erkennen | Folge bei Übersehen |
|---|---|---|---|
| Sortenrein deklariert, Mischschrott geliefert | Sichtprüfung zeigt Balken mit > 15 % Fremdanteil | Ankauf zum Mischpreis 0,16 statt Fraktionspreis | Überzahlung, Reinheitsverlust |
| Wasser/Sand im Hohlkörper | Gewicht/Volumen-Verhältnis liegt > 1,5 × über Fraktion → Waage-Chip blinkt gelb | Ablehnen oder −30 % Ankauf | Überzahlung |
| Störstoff unter Metall versteckt | erst beim Sortieren sichtbar | — | Störstoffkosten; Auftrag „Kunde" gibt Ruf-Malus für den Kunden, er kommt seltener |

Händlerfamilien und Gewerbekunden aus `customers.ts:59-170` werden auf 3 Familien und 3 Branchen gekürzt (GDD v2 Kap. 13). Härtegrad 1–5 (`customers.ts:35`) steuert nur, wie oft ein Kunde eine Deklaration „schönt" — nie Namen, Aussehen oder Sprache.

### 9.5 Verkauf / Abholung `[MVP]`

Spieler ruft per Menü den Abholer (Abrollkipper) für eine Box; Abholer kommt in 45 s **(SW)**, lädt die Box (Mulde wird angehoben — Animation 6 s), zahlt kg × Preis × Reinheit², fährt ab, Box ist leer. Stahlhaufen wird per Abholer-Lkw mit eigenem Greifer geladen (Animation, 12 s). Pro Tag maximal ein Abholer gleichzeitig `[MVP]`, zwei ab Ausbaustufe 2.

*Fertig, wenn:* Ein Tester versteht nach Tag 0, dass Geld erst beim Abholen fließt (Frage im Fragebogen); der Zahlbetrag entspricht der HUD-Prognose auf den Cent.

---

## 10. Wirtschaftssystem & Progression

### 10.1 Startwerte

| Posten | Wert | Herkunft |
|---|---|---|
| Startkapital | 5 000 € | `account.ts:34` |
| Kreditlinie | −1 500 € („Willi streckt vor", danach Fixkosten +20 %) | `account.ts:32` |
| Fixkosten | 150 €/Tag (Pacht, Diesel, Willis Anteil) | neu; Playtest-Ziel Tagesgewinn Tag 1–3: +300 bis +900 € |
| Ankauf Mischfuhre | 0,16 €/kg | `account.ts:16` |
| Ankauf sortenrein | Fraktionspreis (Kap. 7) | `catalog.ts:24-28` |
| Ankauf Fahrzeug | 120 € pauschal **(SW)** | neu |
| Sortierprämie | 0,05 €/kg beim richtigen Abwurf, sofort | `account.ts:18` (im Prototyp ungenutzt) |
| Verkauf | kg × Preis × Reinheit² | `purity.ts:26` |
| Preisschwankung | **keine** im MVP und V1 — feste Tageskurse. `[Später]`: ±15 % Wochenkurve | GDD v2 „NIE für 1.0" |
| Verhandeln | entfällt als Dialog; Formel (`haggle.ts`) bleibt für Auftragstyp „Kunde" `[V1]` | — |
| Ruf | stumm; Zahlen laufen mit (`reputation.ts`), Anzeige `[V1]` | — |

### 10.2 Einnahmen und Kosten pro Tag (Modellrechnung Tag 2)

2 Fuhren: Privat-Mix 600 kg (Ankauf 96 €) + Gewerbe Stahl 2 000 kg sortenrein (Ankauf 360 €). Sortierprämie 2 600 kg × 0,05 = 130 €. Verkauf bei 95 % Reinheit: Stahl 2 300 kg × 0,25 × 0,9025 = 519 €; Kupfer 40 kg × 7,20 × 0,9025 = 260 €; Alu 80 kg × 1,50 × 0,9025 = 108 €; Störstoff 100 kg × −0,08 = −8 €. Fixkosten 150 €. **Tagesgewinn ≈ 403 €** plus Auftragsboni 0–450 €. Liegt im Zielkorridor.

### 10.3 Aufträge als Progressionsmotor

Siehe Kap. 11.2. Boni sollen 25–60 % des Tagesgewinns ausmachen — sonst nachbalancieren.

### 10.4 Ausbau: drei sichtbare Stufen (ersetzt die 8 Upgrades des Prototyps)

Bedingung ist **Sterne UND Geld**. Die Gebäude-Modelle existieren (`world/office.ts`, Stufen hut/office/hall — im Prototyp nie eingebunden, `Pruefung/02_Schwachstellen.md` §0).

| Stufe | Bedingung | Sichtbar | Spielwirkung | Prio |
|---|---|---|---|---|
| 1 Wiegehäuschen | Start | Hütte an der Waage | — | `[MVP]` |
| 2 Büro | ≥ 10 Sterne + 9 000 € (`upgrades.ts:40`) | Flachbau mit Notierungstafel | Exakte Ladungszusammensetzung an der Waage; 4 Fuhren/Tag; zweiter Abholer gleichzeitig | `[MVP]` sichtbar als Ziel, `[V1]` kaufbar |
| 3 Halle + Radlader | ≥ 25 Sterne + 20 000 € | Halle, Lambert im Radlader (`people.ts:218`) | Lambert räumt Fahrspuren selbst; Bagger Tempo × 1,35, Traglast × 1,5 (`main.ts:456-457`); 5 Fuhren/Tag | `[V1]` |

Anbaugeräte als eigener kleiner Baum `[V1]`: Schrottschere 6 000 € **(SW)** (ab Stufe 2) · Magnet 8 000 € **(SW)** (ab Stufe 2) · Presse groß 12 000 € **(SW)** (ab Stufe 3). Werkzeugwechsel am Wechselplatz neben der Presse, 5 s Animation. Dozer, Stapler, Mitarbeiter, Genehmigungen, Platzfläche: `[Später]`.

### 10.5 Balancing-Kurve erste 5 Spielstunden (≈ Tag 0–30)

| Spielzeit | Tag | Konto (Ziel) | Sterne (Ziel) | Was der Spieler neu kann |
|---|---|---|---|---|
| 0:00–0:10 | 0 | 5 000 → 5 050 | 0 | Greifen, Sortieren, Abholer (Tutorial) |
| 0:10–0:40 | 1–3 | → 6 500 | 4–7 | Aufträge Liefern/Räumen/Kunde; erstes Auto greifen und fallen lassen; Presse als Auftrag Tag 3 |
| 0:40 | Ende Tag 3 | — | — | **Premium-Unlock-Karte** |
| 0:40–1:40 | 4–10 | → 12 000–15 000 | 15–22 | Zerlegen-Aufträge (Tag 5), 3 Fuhren/Tag, Stufe 2 erreichbar ab Tag 6 |
| 1:40–3:00 | 11–18 | → 20 000–25 000 | 30–45 | Büro aktiv, 4 Fuhren, Schere, Kat-Zerlegung |
| 3:00–4:30 | 19–28 | → 30 000+ | 50–70 | Halle + Radlader, 5 Fuhren, Magnet |
| 4:30–5:00 | 29–30 | — | — | Abschlusskarte; freies Spiel |

*Fertig, wenn:* Drei Tester liegen an Tag 10 zwischen 12 000 und 25 000 € Konto; keine einzelne Fuhre bringt mehr als das Dreifache des Tagesgewinns; Stufe 2 fällt bei mittelguten Testern auf Tag 6–12.

---

## 11. Aufträge & Spielmodi

### 11.1 Modi

| Modus | Beschreibung | Prio |
|---|---|---|
| Kampagne (30 Tage) | Standard. Tag 0 Tutorial → Tag 30 Abschluss. Willi/Lambert-Textblasen (2–8 Wörter, 10–15 Sätze je Figur) | `[MVP]` Tag 0–3, `[V1]` Tag 4–30 |
| Freies Spiel | Nach Tag 30 oder direkt wählbar: Tagesstruktur bleibt, keine Frist, keine Willi-Karten | `[V1]` |
| Tutorial | = Tag 0, blockierend (Kap. 14.3) | `[MVP]` |
| Zeitdruck-Modus („Schicht") | 5 Minuten, so viel wie möglich sortieren, Bestenliste lokal | `[Später]` — widerspricht „kein Stress"; nur als Bonus nach Store-Release |

### 11.2 Die drei Tagesaufträge `[MVP]`

Pro Tag drei Aufträge aus `data/missions.json`, Schwierigkeit skaliert mit dem Tag. Verfehlen kostet nur den Bonus.

| Typ | Beispiel | Messgröße | Bonus | ab Tag | Prio |
|---|---|---|---|---|---|
| Liefern | „Abholer mit 800 kg Alu, ≥ 90 % rein" | Verkaufs-Event: Fraktion, kg, Reinheit | 100–300 € | 1 | `[MVP]` |
| Räumen | „Annahmefläche am Abend < 500 kg lose" | lose Masse in Zone | 100 € | 1 | `[MVP]` |
| Kunde | „Fertige Gießerei Hallmann in < 3 min ab" | Waage-rein bis Waage-raus | 150 € | 2 | `[MVP]` |
| Zerlegen | „Reiß den Motor aus dem Wrack, verkauf ihn als Stahl" | `partTorn`-Event + Verkauf | 200 € | 5 | `[V1]` (im Slice als Tag-3-Vorschau „Auto fallen lassen" ohne Bonus) |
| Sauber | „Kein Fehlwurf heute" | Zähler falscher Abwürfe = 0 | 150 € | 3 | `[V1]` |

**Erfolg:** Sterne = erfüllte Aufträge (0–3). **Misserfolg:** Keinen. Ein Tag ohne Stern ist erlaubt; Konto unter Kreditlinie kostet Fixkosten-Aufschlag. Kein Game Over.

*Fertig, wenn:* Tester erfüllt an Tag 1 mindestens 2 von 3 Aufträgen ohne Hilfe; Bonus-Summe je Tag liegt zwischen 25 % und 60 % des Tagesgewinns.

---

## 12. Weltaufbau & Level

Ein Platz, definiert in `data/level_yard.json` (eine Wahrheit für Kollider, Zonen, Hindernisliste, Spawnpunkte — im Prototyp dreimal parallel: `yard.ts`, `obstacles.ts`, `containers.ts`).

### 12.1 Zonen (Stufe 1, Grundfläche 60 × 45 m **(SW)**)

| Zone | Position (Nord = +Z) | Maße | Funktion |
|---|---|---|---|
| Einfahrt/Tor | Süd, Mitte | 8 m breit | Spawn/Despawn Fahrzeuge; Schild „Feierabend" |
| Waage | 7,5 m hinter dem Tor (z = −15) | 10 × 3,5 m Plattform | Wiegen, Sichtprüfungs-Karte; Wiegehäuschen (Ausbaustufe 1) daneben |
| Annahmefläche | Süd, zwischen Waage und Bagger (z = −5) | 12 × 6 m Beton | Abkippfläche; „Räumen"-Zone |
| Bagger-Standort | Zentrum | Ø 6 m | Startposition; Bagger kann frei fahren, aber die Sortierboxen sind vom Zentrum aus alle erreichbar (Reichweite Hauptarm+Stiel ≈ 9,2 m, `excavator.ts:27-28`) |
| Stahlhaufen | Ost (x = 13) | 8 × 8 m offen, Betonlego-Umrandung 3 Seiten | Offener Haufen, Abholer-Lkw lädt selbst |
| Sortierboxen | Nord, im Bogen (Radius 8,5 m um den Bagger, −60° … +60°) | 5 Mulden 4 × 2,4 × 1,6 m: VA, Alu, Kupfer, Kabel, Störstoff | Farbige Schilder + Piktogramm. Bogen statt Reihe, weil eine Reihe von 5 Mulden vom Zentrum nicht erreichbar ist (Entscheidung E-006, geprüft durch `data.test.ts`) |
| Zerlegebereich | West | 8 × 6 m | Wracks werden hier abgestellt (Tieflader); Boden mit Ölfleck-Decal |
| Presse | West, neben Zerlegebereich | 4 × 3 m | Station; Rumpf hineinlegen, Knopf (Menü) → Paket |
| Werkzeugwechsel `[V1]` | neben Presse | 3 × 3 m | Ablage Schere/Magnet |
| Abholung | Nord-West, Fahrspur | Spur 4 m | Abrollkipper hält hier, hebt Mulden an |
| Fahrspur | Ring um Annahmefläche | 4 m | Lkw-Route; Teile auf der Spur lösen Störfall aus `[V1]` |
| Büro (Stufe 2) / Halle (Stufe 3) | Süd-West | Fußabdrücke aus `office.ts` | Erscheinen beim Ausbau |

### 12.2 Laufwege

Fahrzeuge: Tor → Waage → Annahmefläche (rückwärts) → Waage → Tor; Tieflader: Tor → Waage → Zerlegebereich → Tor; Abholer: Tor → Abholung → Tor. Alle als Splines in `routes.json`. Lambert (Platzwart) läuft zwischen Häuschen und Annahmefläche und räumt Kleinteile < 45 kg von der Fahrspur (`people.ts`).

### 12.3 Wachstum beim Ausbau

Der Platz wächst nicht in der Fläche (`[Später]`), sondern in Dichte: Stufe 2 setzt das Büro auf den vorbereiteten Fußabdruck, Stufe 3 die Halle. Zusätzliche Boxen (Reifen, E-Schrott, Batterie `[V1]`) setzen den Bogen nach Westen fort (x = −8,5).

*Fertig, wenn:* Aus dem Bagger-Standort sind alle 5 Boxen und der Stahlhaufen ohne Fahren erreichbar (Sim-Test: Zielpunkt jeder Box innerhalb Reichweite); ein Lkw fährt seine Route ohne Kollision mit statischer Geometrie.

---

## 13. NPCs & KI

### 13.1 Kundenfahrzeuge `[MVP]`

| Typ | Kundenart | Ladung | Prio |
|---|---|---|---|
| Pkw mit Anhänger | Privat | 100–800 kg Mix, 5–15 Teile | `[MVP]` |
| Kipper (3-Achser) | Gewerbe | 1 500–3 000 kg, sortenrein oder Mix, 15–30 Teile | `[MVP]` |
| Tieflader | Kfz-Werkstatt / Händler | 1 Fahrzeugwrack | `[MVP]` |
| Pritsche | Händler | 500–2 000 kg Buntmetall-lastig | `[V1]` |
| Abrollkipper (Abholer) | eigener Abnehmer | — | `[MVP]` |

### 13.2 Anfahrt und Wegfindung

Kein Pathfinding: Fahrzeuge folgen Splines aus `routes.json` mit Geschwindigkeitsprofil (Kurven langsamer). Vor dem Rückwärtsansetzen prüft das Fahrzeug einen Blockier-Kasten (5 × 3 m vor der Annahmefläche): liegt dort > 45 kg loses Material oder steht der Bagger drin, wartet der Lkw (Hupe nach 10 s) und Lambert räumt Kleinteile. `[V1]` Störfall „Fahrspur blockiert": Lkw wartet, Auftragsbonus „Kunde" verfällt.

### 13.3 Wartezeit und Geduld

| Kunde | Geduld bis Hupe | Geduld bis Abfahrt | Folge |
|---|---|---|---|
| Privat | 60 s | nie im MVP (fährt nicht weg) | nur Auftragsbonus „Kunde" |
| Gewerbe | 45 s | `[V1]` 180 s, fährt mit Ladung weg | Fuhre entgeht, Ruf −5 `[V1]` |

**Annahme:** Im MVP fährt kein Kunde unverrichtet weg — „kein Stress"-Regel. Geduld wirkt nur auf Auftragsboni.

### 13.4 Zufriedenheit und Ruf `[V1]`

Ruf −100 bis 100 (`reputation.ts:36-37`), Startwert 0. +2 je Fuhre unter 3 min, −5 je Abfahrt ohne Annahme. Wirkung: Ruf steuert Anteil Gewerbe-/Buntmetall-Fuhren (mehr Marge), nicht die Fuhrenzahl (die kommt aus der Ausbaustufe). Anzeige als Balken auf der Morgen-Karte.

### 13.5 Figuren

Lambert (Platzwart, Vater, Mentor) räumt, kommentiert in Blasen; Willi Bäring (Schwager, Händler, Härte 5) erscheint auf Karten (Tag 0, 3, 10, 20, 30); Mario (Waage) und Janine (Kaffee) sind Kulisse. Figuren als Kapsel + Kugel ohne Gesicht (Stilguide 1.2). Kein Sprachaudio.

*Fertig, wenn:* 10 Fuhren in Folge laufen ohne Steckenbleiben eines Fahrzeugs durch; Lambert räumt ein Teil von der Spur in < 20 s.

---
## 14. UI, HUD & Steuerungs-Feedback

### 14.1 HUD-Elemente `[MVP]`

| Element | Position | Zweck | Verhalten |
|---|---|---|---|
| Konto | oben links, 22 px Ziffern | Geldstand | grüner „+85 €"-Aufsteiger bei Einnahme, roter bei Ausgabe |
| Pause `II` | oben links, 48 × 48 | Pause-Menü | pausiert Simulation |
| Tages-Chip | oben Mitte | „Tag 2/30 · 10:42 · Annahme" — Spieltag, Uhr (kosmetisch), Phase | Phase wechselt zu „Feierabend" mit Farbwechsel |
| Auftragsliste | oben rechts, 3 Zeilen | Die 3 Tagesaufträge mit Haken/Fortschritt („640 / 800 kg") | Zeile blinkt grün bei Erfüllung |
| Kamera / Menü `≡` | oben rechts | Ansicht wechseln / Bottom-Sheet | — |
| Griff-Info-Chip | unten Mitte über GREIFEN, 44 px hoch | Piktogramm + Fraktion + kg + €-Stufe (`purity.ts:31-35`: €–€€€€ oder „Gebühr") des Teils unter dem Sensor bzw. in der Spinne; bei Verbundteil: Baugruppe + Abriss-Balken | aktualisiert < 100 ms |
| Bodenring | in der Szene | Zielhilfe, Ampel | Weiß / Fraktionsfarbe / grün / rot / gelb (Abriss) |
| Container-Schilder | in der Szene, an jeder Box | Piktogramm + Name + Reinheit % + kg | Farbe = Reinheitsampel |
| Toasts | rechts unten, max. 3 gestapelt | Ereignisse („Gießerei Hallmann angenommen · 2 100 kg") | 4 s, dann fade |
| Sticks/Knöpfe (Touch) | Kap. 5.2 | Steuerung | — |
| Debug-Overlay | F3 / 5-Finger-Tipp | fps, Physik-ms, Bodies wach/gesamt, Draw Calls | nur Dev-Build und per Einstellung |

### 14.2 Menüstruktur

```
Start-Screen („Tippen zum Start" — Audio-Unlock)
├─ Weiterspielen (Tag n)
├─ Neues Spiel (Kampagne) · Freies Spiel [V1]
├─ Einstellungen
│   ├─ Steuerung: Achsbelegung + Invertierung, Greifen Halten/Toggle, Stick-Größe S/M/L,
│   │  Links-/Rechtshänder, Kamera-Empfindlichkeit/Invertierung, Vibration, Snap an/aus, IK-Modus [V1]
│   ├─ Grafik: Qualitätsstufe Auto/Niedrig/Mittel/Hoch, Schatten an/aus, Pixel-Ratio-Deckel
│   ├─ Audio: Musik, Effekte, Radio [V1]
│   ├─ Barrierefreiheit: Textgröße, Farbfehlsicht-Muster, Reduzierte Bewegung
│   └─ Sprache: Deutsch · English [V1]
├─ Spielstand exportieren/importieren (JSON-Datei)
└─ Info/Credits
Im Spiel: Pause (Weiter · Steuerung · Speichern · Zum Start-Screen)
          Bottom-Sheet ≡ (Abholer rufen · Presse auslösen · Werkzeug wechseln [V1] · Tag beenden · Einstellungen)
          Morgen-Karte · Abend-Bilanz · Willi-Karte · Unlock-Karte (Tag 3)
```

Dialoge als Bottom-Sheet (halbe Höhe), Spiel dahinter pausiert, immer ein Schließen-Knopf. Jedes Dialog-Element hat geprüfte CSS-Regeln (Prototyp-Fehler „unsichtbare Dialoge", `Pruefung/02_Schwachstellen.md` §7) — Abnahme per Playwright-Sichtbarkeitstest.

### 14.3 Onboarding — Tag 0 (blockierend, ~6 min) `[MVP]`

Jeder Schritt geht erst weiter, wenn die Aktion erledigt ist (Prototyp lief nach 12 s ohne Aktion weiter, A3). Tastennamen aus `controls.json`, je Eingabegerät.

| Schritt | Minute | Was der Spieler tut | Lambert-Blase (Touch-Variante) | Vermittelt | Weiter, wenn |
|---|---|---|---|---|---|
| 1 | 0–1 | Leerer Platz, ein Stahlträger vor dem Bagger. Kamera zeigt Bagger und Träger | „Linker Stick: drehen und heben." | Oberwagen, Hauptarm | Bodenring liegt 2 s über dem Träger |
| 2 | 1–2 | Spinne schließen, Träger heben | „GREIFEN halten. Und hoch damit." | Greifen, Haltepose | Träger 1 m über Boden |
| 3 | 2–3 | Zum Stahlhaufen schwenken, loslassen | „Zum Haufen. Loslassen." | Ampel grün, Sortierprämie-Ticker | Träger auf dem Haufen, Ticker „+0,75 €" |
| 4 | 3–5 | Pkw-Anhänger kippt 5 Teile: 3 Stahl, 1 Kupferrohr, 1 Holzlatte. Griff-Info erklärt sich beim ersten Hover: „orange + schwer = Kupfer" | „Kupfer in die orange Box. Holz zum Störstoff." | Materialerkennung: Farbe, Gewicht, Chip, Schilder | Alle 5 Teile richtig verbucht (Fehlwurf: Lambert „Das war Kupfer — nochmal raus damit.") |
| 5 | 5–6 | Abholer rufen (Menü blinkt), Kupfer-Box laden | „Menü → Abholer. Der zahlt." | Verkauf = Geld | Toast „+51 €" |
| 6 | 6 | Abend-Bilanz Tag 0, Willi-Karte: „30 Tage, Daniel. Dann reden wir." | — | Ziel und Frist | Klick |

Pressen (Tag 3) und Zerlegen (Tag 5) werden über Aufträge mit Lambert-Blase eingeführt, nicht im Tutorial. Fahren wird erst gebraucht, wenn der Spieler es will (Fahr-Modus-Knopf zeigt Tooltip beim ersten Antippen).

*Fertig, wenn:* 3 von 4 Erst-Testern schließen Tag 0 ohne verbale Hilfe in ≤ 8 min ab und nennen danach, woran man Kupfer erkennt.

### 14.4 Woran der Spieler erkennt, was er greift und ob er richtig liegt

Vier Kanäle, nie nur Farbe: **Bodenring** (Farbe + Größe), **Griff-Info-Chip** (Piktogramm + Text + kg), **Container-Schild** (Piktogramm + Reinheit), **Klang** (Kap. 15). Über einer Box wechselt der Bodenring auf Ampel: grün = Fraktion passt, rot = passt nicht, gelb = Störstoffbox für ein Metallteil (erlaubt, aber Verlust).

---

## 15. Audio

Alle Sounds prozedural per Web Audio (Prototyp `audio/*`, 578 Zeilen, GEMA-frei — übernommen und an Events gehängt). Audio-Unlock auf erster Geste, `AudioContext.resume()` bei `visibilitychange` (Safari).

### 15.1 Kategorien und wichtigste Einzelsounds

| Kategorie | Sounds | Prio |
|---|---|---|
| Maschine | Diesel-Leerlauf (Loop, Tonhöhe steigt mit Achsaktivität), Hydraulik-Zischen je Achse, Schwenk-Surren, Rückfahr-Piepser, Rotator-Klicken | `[MVP]` |
| Greifen | Zinken schließen (Metall-Klack), Griff sitzt (dumpfer Schlag), Rutschen (Kratzen), Überlast (Knarren) | `[MVP]` |
| Material-Aufprall (je Fraktion eigener Klang) | Stahl: tiefes Dröhnen · VA: heller Klang · Alu: blechern hoch · Kupfer: warm, kurz · Kabel: dumpfes Plumpsen · Holz: hölzernes Klappern · Beton: Bruch · Reifen: Gummi-Bounce | `[MVP]` |
| Belohnung | Ampel grün + Sortierprämie: kurzer heller Ton („Ka-ching" dezent, nie schrill) · Auftrag erfüllt: Dreiklang · Abholer zahlt: Kassenlade | `[MVP]` |
| Fehler | Fehlwurf: stumpfer, tiefer Ton (nie Buzzer) · Überlast · Presse verweigert (Warnhupe kurz) | `[MVP]` |
| Zerlegung | Knirschen (steigend mit Timer), Reißen, Scheiben bersten `[V1]`, Presse (Hydraulik + Blechknicken) | `[MVP]` |
| Fahrzeuge | Lkw-Motor, Kippen (Hydraulik + Schüttgeräusch), Hupe, Abholer-Haken | `[MVP]` |
| Umgebung | Wind, entfernter Verkehr, Vögel (leise) | `[V1]` |
| UI | Tipp, Karte auf/zu, Bilanz-Zähler | `[MVP]` |

### 15.2 Musikkonzept

`[MVP]` keine Musik im Betrieb — der Platz klingt nach Arbeit. Morgen-Karte und Abend-Bilanz: kurzes prozedurales Motiv (Marimba-artig, 4 Takte). `[V1]` „Radio in der Kabine": ein Kanal mit 3–4 generativen Loops (Ambient/Lo-Fi), abschaltbar. Keine lizenzierten Stücke.

### 15.3 Audio als Feedback

Blindtest-Regel: Der Spieler soll mit geschlossenen Augen hören, ob ein Wurf richtig war (Ampelton) und ob Stahl, Kabel oder Kupfer gelandet ist.

*Fertig, wenn:* Blindtest — Tester ordnet 8 von 10 Abwürfen nur nach Klang der richtigen Fraktion und dem Ergebnis (richtig/falsch) zu.

---

## 16. Art Direction

Verbindlich: `04_Stilguide_und_Touch.md` Kap. 1 und 3. Hier die Kurzfassung und die Ergänzungen. Rückfrage 5: „erstmal stilisiert, später Upgrade denkbar" — deshalb ist die Pipeline so gebaut, dass ein späterer Materialpass (PBR-Texturen) die Geometrie nicht anfasst.

### 16.1 Stilrichtung

„Ordnung im Chaos": Die Welt ist grau und ruhig, das Material leuchtet. Alles, was Geld ist, hat Farbe; alles, was Arbeit ist, hat keine. Stilisiertes Low-Poly, Flat-Shading mit Fasen-Fake, max. 2 Farbtöne pro Objekt, Vertex-Farben statt Texturen (Ausnahmen: Rost-Decals, Container-Nummern, Bagger-Schriftzug — ein 2k-Atlas). Menschen als Kapsel + Kugel ohne Gesicht.

### 16.2 Farbleitsystem

Palette aus Stilguide 1.1 (Welt: `#b8ad9a` Sand, `#9c9a92` Beton, `#5f5d58` Asphalt · Bagger: `#4fbf3f` Grün, `#1e2124` Schwarz, `#f2b632` Warngelb · Fraktionen Kap. 7). Regeln: Fraktion↔Fraktion ΔE ≥ 25, Fraktion↔Welt ≥ 20. Nur der Bagger ist grün, nur UI-Akzente sind gelb. Kein Torus außer Reifen. Stahl nie braun. Prüfskript im Build.

### 16.3 Detailgrad

| Objektklasse | Tris-Budget je Objekt | Anmerkung |
|---|---|---|
| Bagger (Hero-Asset) | ≤ 15 000 | Einziges Asset mit Auftrag/Kauf; riggbar (Ausleger, Stiel, Rotator, 5 Zinken) |
| Fahrzeuge | ≤ 3 000 | Kenney CC0 Kits, glTF |
| Schrott-Teile (prozedural) | 24–200 | Primitive + Verformung; 5–8 Hero-Teile ≤ 800 (Waschmaschine, Fahrrad, Heizkörper, Motorblock, Kabeltrommel) |
| Wrack | ≤ 2 500 | Karosse mit 3 Quetschstufen als Morph/Skalierung |
| Gebäude, Boxen, Zaun | ≤ 1 500 gesamt je Stück | statisch, gemergt |

### 16.4 Tageszeit und Wetter

Fester Spätvormittag als Standard; Tageslauf nur als Stimmung über den Spieltag (Sonnenstand wandert 30°, Farbtemperatur wärmer zum Feierabend), **nie Nacht** (Tag endet vor Dunkelheit). Kein Wetter im MVP/V1; `[Später]` Regen als Decal + Partikel ohne Physikwirkung. Tone-Mapping ACES Filmic, Exposure 1,1, Room-Environment für Metallreflexe (ohne sie sind VA/Alu/Kupfer nicht unterscheidbar). Kontaktschatten unter jedem Teil.

### 16.5 Referenzbild-Beschreibungen

1. **Übersicht:** Leicht erhöhte Schulterperspektive; grüner Bagger mittig, davor die graue Annahmefläche mit einem bunten Haufen (orange Rohre, blaugraue Träger, ein weißes Spülbecken); im Hintergrund die Nordreihe mit fünf Mulden, jedes Schild als farbiger Balken mit Piktogramm; heller Himmel mit sandfarbenem Horizont.
2. **Griffmoment:** Nahaufnahme der gelben Spinne, fünf Zinken um ein Kupferrohr geschlossen, Rohr sitzt mittig, Bodenring orange auf dem Boden darunter, Griff-Info-Chip „Kupfer · 14 kg · €€€€".
3. **Feierabend:** Wärmeres Licht, Tor geschlossen mit Schild, leerer Platz, geordnete Boxen, Lambert lehnt am Häuschen; Abend-Bilanz als dunkles Bottom-Sheet mit grünen Zahlen.

*Fertig, wenn:* Drei Screenshots (Übersicht, Griff, Feierabend) werden von 5 Fremden ohne Erklärung als „aufgeräumt, stilisiert, industriell" beschrieben (freie Nennung, ≥ 3 von 5 treffen zwei der drei Begriffe).

---

## 17. Technische Architektur

Verbindlich im Detail: `02_Architektur_v2.md`. Hier die Entscheidungen mit Begründung und Alternative sowie die Abweichungen.

### 17.1 Technologieentscheidungen

| Entscheidung | Wahl | Begründung (ein Satz) | Alternative |
|---|---|---|---|
| Sprache | TypeScript 5.x strict | Typen sind die billigste Absicherung für einen KI-Agenten, der Code schreibt, den der Auftraggeber nicht liest | JavaScript (kein Gewinn), C# (nur mit Unity) |
| Build | Vite 5 + `vite-plugin-wasm` | Sofortiger Dev-Reload im WLAN auf iPad/iPhone, WASM als eigene Datei (−0,6 MB JS) | Webpack (langsamer), esbuild pur (keine Dev-Server-Features) |
| Renderer | Three.js r169+ (WebGL2) | ~50 % des Prototyps sind Three-Wissen; WebGPU ist auf iOS Safari noch nicht verlässlich | Babylon.js (gleichwertig, kein Wiederverwendungsvorteil), PlayCanvas (Editor-gebunden) |
| Physik | Rapier 3D 0.14 (WASM, ohne `-compat`) | Läuft identisch in Node (kopflose Tests) und Browser, deterministisch, Sleep und Kollisionsgruppen eingebaut | Ammo.js/Bullet (größer, schlechter typisiert), Cannon-es (zu ungenau für Stapel), Unity PhysX (nur mit Engine-Wechsel) |
| Tests | Vitest + Playwright | Vitest teilt die Vite-Konfiguration; Playwright misst Draw Calls und Layout-Überlappungen im echten Chromium (Skripte aus `tools/qa/` vorhanden) | Jest (zweite Konfiguration), Cypress (kein WebGL-Zugriff) |
| Lint | ESLint flat config mit `no-restricted-imports` je Schicht | Die Schichtenregel ist ein Build-Fehler, kein Stilhinweis | Dependency-Cruiser (zusätzliches Werkzeug, gleiche Wirkung) |
| Daten | JSON + JSON-Schema (ajv) | Balancing ohne Code-Änderung, Schema fängt Tippfehler vor dem Start | YAML (kein Gewinn), TS-Konstanten (nicht ohne Build änderbar) |
| Speicherstand | `localStorage` (Web) / Capacitor Preferences + Datei (App), JSON mit `schemaVersion`, Export/Import | iOS löscht PWA-Speicher nach 7 Tagen Inaktivität — Export ist Pflicht; im Wrapper nativer Speicher | IndexedDB (mehr Code, kein Vorteil bei < 200 kB) |
| Mobile-Wrapper | Capacitor 6 | Ein Codebestand, Web-Build wird eingebettet, Plugins für Haptik, IAP, Orientation | Cordova (veraltet), Tauri Mobile (unreif), native Neuentwicklung (nein) |
| IAP `[V1]` | `@capacitor-community/in-app-purchases` bzw. RevenueCat-Plugin | Ein Nicht-Verbrauchsartikel „Premium", Wiederherstellung über Store-Konto | Eigene Server (nein — kein Backend) |
| Hosting Web | GitHub Pages (wie Prototyp), später itch.io für die Demo | Bereits eingerichtet, kostenlos, HTTPS für PWA | Netlify/Vercel (gleichwertig) |
| Unity | Testspur, Timebox 2 Wochen, nicht Teil dieses Briefings | Rückfrage 1: Web-Stack ist die Basis; Unity nur als Go/No-Go-Alternative laut Roadmap | — |

### 17.2 Schichten und Modulschnitt

Vier Schichten mit Abhängigkeit nur nach unten: `data/` (JSON + Schemas) → `sim/` (WorldState, PhysicsWorld, Systeme; importiert nie Three oder DOM) → `app/` (Bootstrap, GameLoop, Scheduler, SaveService, InputMapper, Plattform-Adapter; < 300 Zeilen) → `view/` + `ui/` + `audio/` (lesen Snapshots, hören Events).

**Systeme (`sim/systems/`, Reihenfolge im Scheduler deklariert):** Input → Excavator → ExcavatorColliders → Grip → Composite → Vehicle → Scrap (Spawn/Bündeln/Sleep) → Container → Press → Worker (Lambert) → Day (Tag/Phasen) → Mission → Economy → Upgrade → Tutorial → Save. Jedes System hat `update(dt)`, `save()/load()`, mindestens einen Szenario-Test.

**Eingabe:** Nur über `ControlFrame` (`{cab, boom, stick, grapple, rotator, drive, steer, camera…}` als Zahlen −1…1 und Bool-Flags). Tastatur, Touch, Gamepad sind Adapter in `app/input/`; die Simulation kennt keine Tastencodes.

**Events (Auszug, vollständig in Architektur Kap. 13):** `itemGrabbed`, `itemReleased`, `itemSorted {itemId, containerId, correct, kg}`, `partTorn`, `containerSold`, `vehicleArrived/Weighed/Dumped/Left`, `dayPhaseChanged`, `missionCompleted`, `moneyChanged`, `pressUsed`, `upgradeBought`.

### 17.3 Ordnerstruktur `v2/web`

```
v2/web/
  package.json  vite.config.ts  eslint.config.js  vitest.config.ts  playwright.config.ts
  index.html    public/ (manifest, icons)
  data/         materials.json customers.json composites.json upgrades.json missions.json
                level_yard.json routes.json balancing.json controls.json i18n/de.json i18n/en.json
                schema/*.schema.json
  src/
    shared/     ids.ts events.ts math.ts rng.ts
    data/       loadData.ts types.ts
    sim/        world/{WorldState,PhysicsWorld,Level}.ts  systems/*.ts  snapshot.ts
    app/        main.ts GameLoop.ts Scheduler.ts SaveService.ts input/{keyboard,touch,gamepad}.ts platform/{web,capacitor}.ts quality.ts
    view/       Renderer.ts ViewRegistry.ts models/*.ts particles.ts camera.ts daylight.ts instancing.ts
    ui/         hud.ts sheets/*.ts cards/{morning,evening,willi,unlock}.ts layout.ts
    audio/      engine.ts sfx/*.ts music.ts
  test/         unit/ sim/ (kopflos, Rapier in Node) e2e/ (Playwright: Layout, Draw Calls, Sichtbarkeit)
  tools/        qa/ (measure, fuzz, palette_check, layout_check)  build/ (icons, capacitor sync)
```

### 17.4 Datenfluss pro Bild

Input-Adapter → `ControlFrame` → Scheduler ruft Systeme in fester Reihenfolge mit festem `dt` (60 Hz, max. 2 Nachholschritte) → PhysicsWorld.step → Systeme emittieren Events → Render-Schritt: `view` liest Snapshot (Positionen, Zustände) mit Interpolationsfaktor, `ui` aktualisiert nur bei Events oder Chip-Änderung, `audio` reagiert auf Events.

### 17.5 Speicherstände

- Autosave bei `dayPhaseChanged → evening` und bei `visibilitychange → hidden` (Prototyp hatte kein Autosave; Android beendet Hintergrund-Apps).
- Format: `{schemaVersion, day, money, stars, upgrades[], containers[], looseItems[] (pos, rot, materialId, shapeId, kg), composites[], missionsToday[], settings}`; ~50–200 kB.
- Laden validiert gegen Schema; ungültig → „Spielstand beschädigt — Neues Spiel / Importieren", nie Schwarzbild (H2-Absturz des Prototyps `main.ts:49`).
- Export/Import als JSON-Datei über Menü (Pflicht wegen iOS-PWA-Speicherlöschung).

### 17.6 Build und Deploy

| Ziel | Befehl | Ergebnis |
|---|---|---|
| Dev | `npm run dev -- --host` | Dev-Server im WLAN, iPad/iPhone öffnen `http://<pc-ip>:5173` |
| Prüfung | `npm run check && npm run lint && npm test` | tsc, ESLint-Schichten-Gate, Vitest; Pflicht vor jedem Commit |
| E2E | `npm run e2e` | Playwright: Layout-Überlappung 3 Viewports, Draw-Call-Zähler, Dialog-Sichtbarkeit |
| Web-Build | `npm run build` | `dist/` mit Hash-Dateinamen, WASM separat, PWA-Manifest |
| Deploy PWA | GitHub Action bei Push auf `main` → GitHub Pages `/bagerana/` | Live-URL für Gerätetests; Prototyp-URL bleibt unberührt |
| Android `[V1]` | `npx cap sync android && npx cap open android` → Android Studio → AAB | Play Console: interner Test → geschlossener Test (14 Tage, 20 Tester) → Produktion |
| iOS `[Später]` | Codemagic/Unity-unabhängiger Cloud-Build aus dem Capacitor-Projekt → TestFlight | kein Mac nötig |

**Windows-Hinweis:** Alle Skripte müssen unter Windows-PowerShell laufen (kein `&&` in npm-Skripten unter alten PowerShell-Versionen → `npm-run-all` oder Node-Skripte verwenden).

---

## 18. Datenmodell

TypeScript-Typdefinitionen (`src/data/types.ts`); JSON-Schemas in `data/schema/` spiegeln sie 1:1. Kommentare erklären Bedeutung und Herkunft.

```ts
/** Materialklasse — data/materials.json (Kap. 7) */
interface MaterialDef {
  id: string;                 // "steel" | "va" | "alu" | "copper" | "cable" | "contaminant" | "battery" | ...
  name: Record<Lang, string>; // i18n
  densityKgM3: number;        // Realwert, für Masse = Volumen × Dichte × fill
  buyPricePerKg: number;      // Ankauf sortenrein (catalog.ts:24-28)
  sellPricePerKg: number;     // Verkauf; negativ = Entsorgungskosten
  color: string;              // Hex aus v2-Palette (ΔE-geprüft)
  secondaryColor?: string;    // z. B. Messing bei Kupfer, Mantelfarben bei Kabel
  icon: string;               // Piktogramm-Id (24 px SVG)
  containerId: string | null; // Zielcontainer; null = Stahlhaufen (offen)
  tier: "MVP" | "V1" | "LATER";
}

/** Formvorlage für prozedurale Schrottteile — data/materials.json → shapes[] */
interface ShapeDef {
  id: string;                 // "beam" | "pipe" | "sheet" | "sink" | "coil" | "block" | "wheel" | ...
  collider: "box" | "cylinder" | "sphere" | "convex";
  sizeMin: [number, number, number]; sizeMax: [number, number, number]; // m, zufällig dazwischen
  fill: number;               // 0..1 Füllgrad (Hohlkörper ~0.2, Vollmaterial 1)
  materialIds: string[];      // welche Fraktionen diese Form haben dürfen
  tris: number;               // Budget-Hinweis für den Mesh-Generator
}

/** Ein loses Schrott-Item im WorldState (Laufzeit + Spielstand) */
interface ScrapItem {
  id: ItemId;
  materialId: string;
  shapeId: string;
  size: [number, number, number];
  massKg: number;
  pos: Vec3; rot: Quat;       // beim Speichern; zur Laufzeit im Rapier-Body
  bodyHandle?: number;        // nur Laufzeit; Zugriff nur über PhysicsWorld.safeBody()
  state: "loose" | "held" | "settling" | "booked"; // booked = in Container verbucht, Mesh entfernt
  compositeId?: CompositeId;  // falls Teil eines Verbundobjekts (abgerissene Baugruppe behält Referenz für Missions-Events)
  origin: "delivery" | "torn" | "tutorial";
}

/** Container / Box — data/level_yard.json → containers[] + Laufzeit */
interface ContainerDef {
  id: string;                 // "box_va" | "box_alu" | "box_copper" | "box_cable" | "box_contaminant" | "pile_steel"
  materialId: string;         // akzeptierte Fraktion
  kind: "mulde" | "pile";
  pos: Vec3; rotY: number; size: [number, number, number];
  capacityKg: number;         // Mulde 6 000 (SW), Haufen 20 000 (SW)
  unlockStage: 1 | 2 | 3;     // Ausbaustufe, ab der der Container existiert
}
interface ContainerState {
  id: string;
  contentKg: number;          // Fraktionsmasse
  contaminationKg: number;    // Fremdmasse → Reinheit = 1 − cont/content (purity.ts:8-11)
  pendingItemIds: ItemId[];   // liegen drin, noch nicht verbucht (3 s Ruhe)
}

/** Verbundobjekt — data/composites.json (Kap. 8) */
interface CompositeDef {
  id: string;                 // "car_compact"
  hull: { materialId: string; massKg: number; collider: "box"; half: Vec3; yOffset: number; };
  crushScales: [number, number, number];  // Y-Skalierung je Quetschstufe (carDef.ts:40)
  glassImpactDv: number; crushImpactDv: number; // m/s (carDef.ts:41-42) [V1]
  parts: PartDef[];
  windows?: { id: string; anchor: Vec3; size: [number, number]; rotY: number }[]; // [V1]
  buyPriceEur: number;        // Ankauf pauschal (120, SW)
}
interface PartDef {
  id: string; name: Record<Lang, string>;
  materialId: string; massKg: number;
  anchor: Vec3; grabRadius: number;
  tearSeconds: number;        // bei Zugkraft 1.0
  tool: "grapple" | "shear";
  requires: string[];         // Part-Ids, die vorher weg sein müssen
  blocksPress: boolean;
  unlockDay: number;
  shape: { kind: "box" | "wheel" | "cylinder"; size: number[] }; color: string;
}
interface CompositeState {
  id: CompositeId; defId: string;
  pos: Vec3; rot: Quat; crushStage: 0 | 1 | 2;
  remainingParts: string[];   // Part-Ids noch am Rumpf
  hullMassKg: number;         // Rumpf ohne Baugruppen (konstant); Körpermasse = hull + Σ remainingParts
}

/** Kundenfahrzeug und Anlieferung — data/customers.json, routes.json */
interface VehicleDef {
  id: "trailer" | "tipper" | "lowloader" | "flatbed" | "rolloff";
  routeId: string;            // Spline in routes.json
  speedMs: number; dumpSeconds: number;
  loadKgMin: number; loadKgMax: number;
}
interface CustomerDef {
  id: string; displayName: string;     // Person oder Firma; Milieu aus Beruf/Geschäft
  kind: "private" | "trade" | "dealer";
  hardness: 1 | 2 | 3 | 4 | 5;         // wie oft eine Deklaration „geschönt" wird (customers.ts:35) [V1]
  vehicleIds: string[];
  loadProfile: { materialId: string; share: number }[]; // Summe 1
  sortedProbability: number;  // Wahrscheinlichkeit sortenreiner Fuhre
  patienceSeconds: number;    // bis Hupe
}
interface Delivery {          // Laufzeit-Instanz einer Fuhre
  id: DeliveryId; customerId: string; vehicleId: string;
  phase: "approach" | "weighIn" | "inspect" | "toDump" | "dumping" | "weighOut" | "leave" | "done";
  grossKg: number; tareKg: number;
  declared: "mixed" | "sorted:<materialId>" | "vehicle";
  items: Omit<ScrapItem, "id" | "pos" | "rot" | "state">[]; // wird beim Kippen instanziert
  compositeDefId?: string;    // bei Tieflader
  priceEur: number;           // berechneter Ankauf
  tStart: number;             // Spielzeit, für Auftrag „Kunde"
}

/** Auftrag — data/missions.json */
interface MissionDef {
  id: string; type: "deliver" | "clear" | "customer" | "dismantle" | "clean";
  text: Record<Lang, string>;           // mit Platzhaltern {kg} {material} {customer} {minutes}
  params: Record<string, number | string>;
  bonusEur: number; fromDay: number; toDay?: number;
  weight: number;             // Auswahlgewicht im Pool
}
interface MissionState { defId: string; progress: number; target: number; done: boolean; }

/** Ausbau — data/upgrades.json (Kap. 10.4) */
interface UpgradeDef {
  id: "stage2_office" | "stage3_hall" | "tool_shear" | "tool_magnet" | "press_large";
  name: Record<Lang, string>; effect: Record<Lang, string>;
  priceEur: number; requiresStars: number; requires?: string;
  effects: { fuhrenPerDay?: number; speedFactor?: number; capacityFactor?: number; showComposition?: boolean; pickupsParallel?: number };
}

/** Spielstand — SaveService, schemaVersion 2 */
interface SaveGame {
  schemaVersion: 2;
  savedAt: string;            // ISO
  mode: "campaign" | "free";
  day: number; phase: "morning" | "work" | "evening" | "ended";
  moneyEur: number; starsTotal: number; premiumUnlocked: boolean;
  upgrades: string[];
  containers: ContainerState[];
  looseItems: ScrapItem[];    // nur state "loose" | "settling"; max. 400 (SW), Rest gebündelt
  composites: CompositeState[];
  missionsToday: MissionState[];
  excavator: { pos: Vec3; heading: number; cab: number; boom: number; stick: number; rotator: number };
  reputation: number;         // [V1]
  stats: { turnoverKg: number; correctSorts: number; wrongSorts: number; daysPlayed: number };
  settings: SettingsState;    // Steuerung, Grafik, Audio, Sprache, Barrierefreiheit
}
```

*Fertig, wenn:* Jede JSON-Datei in `data/` validiert beim Laden gegen ihr Schema (ein Test je Datei); ein absichtlich beschädigter Spielstand führt zum Dialog, nicht zum Absturz (E2E-Test).

---
## 19. Performance-Budgets

Messgrundlage: Prototyp am 02.09. — 3 139 Meshes, 1 781–3 795 Draw Calls/Bild, 18–28 fps auf Intel HD 5500, 2,7 ms Physik bei nie schlafendem Haufen (A2, Messung 1–2). Die Budgets unterschreiten das um eine Größenordnung.

| Budget | Zielgerät Mobile (Snapdragon 695 / iPhone 12 mini) | iPad / Desktop Iris Xe | Dev-PC (HD 5500) |
|---|---|---|---|
| Bildrate | ≥ 30 fps stabil, Frame < 25 ms (Reserve) | 60 fps | ≥ 30 fps |
| Draw Calls / Bild | ≤ 250 **(SW)** | ≤ 400 | ≤ 400 |
| Physik-Zeit / Schritt | ≤ 4 ms bei 250 Körpern, ≤ 0,5 ms bei schlafendem Platz | ≤ 3 ms | ≤ 6 ms |
| Gleichzeitig wache Rigid Bodies | ≤ 80 **(SW)** (Fuhre kippt: kurzzeitig 120) | ≤ 120 | ≤ 120 |
| Lose Teile gesamt (wach + schlafend) | ≤ 300 **(SW)**; darüber Bündelung | ≤ 400 | ≤ 400 |
| Tris sichtbar | ≤ 300 k | ≤ 600 k | ≤ 600 k |
| Texturspeicher | ≤ 32 MB (ein 2k-Atlas + Icons + envMap 256²) | gleich | gleich |
| Lichter | 1 Sonne (Schatten) + 1 Hemisphäre; Spots nur bei Feierabend-Stimmung, max. 2 | gleich | gleich |
| Schatten | 1 Cascade 2048², Werfer nur Bagger, Fahrzeuge, Wracks, Gebäude; Radius 40 m | 2 Cascades | 1 Cascade |
| Pixel-Ratio | Deckel 2,0 | 2,0 | 1,0–1,5 |
| Ladezeit bis spielbar | ≤ 4 s auf LTE (Bundle ≤ 2,5 MB gzip inkl. WASM 1,2 MB), ≤ 1,5 s aus Cache | — | — |
| Speicher (JS-Heap + GPU) | ≤ 300 MB; 20 min ohne Wachstum > 10 % | — | — |

### 19.1 Strategien, wenn das Budget reißt (in dieser Reihenfolge)

1. **Statik mergen `[MVP]`:** Betonlego-Umrandung, Boxen, Zaun, Gebäude → je ein Mesh pro Material (Prototyp: 1 530 Meshes allein Betonlego, `yard.ts:587-612`).
2. **Instancing `[MVP]`:** Schrottteile je `ShapeDef` als `InstancedMesh` mit Instanz-Farbe; ein Draw Call pro Form statt pro Teil.
3. **Schlafen legen `[MVP]`:** Spawn mit ≥ 8 cm Abstand, Vorsimulation, Sleep-Schwellen aus `balancing.json`; Wächter-Test.
4. **Verbuchen sortierter Teile `[MVP]`:** 3 s Ruhe in einem Container → Masse/Reinheit in `ContainerState`, Körper und Mesh weg; Füllstand als eine skalierte Box mit Fraktionsfarbe. Nur die letzten 6 Teile bleiben 20 s sichtbar (Korrigierbarkeit).
5. **Bündeln loser Teile `[MVP]`:** Über 300 lose Teile: die ältesten 20 auf dem Stahlhaufen werden zu einem „Bündel"-Körper mit Summenmasse; Prototyp-Bündelung (≤ 45 kg) wird auf alle Fraktionen erweitert.
6. **`dispose()` `[MVP]`:** Geteilte Geometrien/Materialien; jedes `remove()` gibt Instanz-Slots frei; Leak-Test 20 min.
7. **Qualitätsstufen `[MVP]`:** Auto-Erkennung über die ersten 120 Bilder: < 28 fps → Stufe „Niedrig" (Schatten aus, Pixel-Ratio 1,0, envMap 128², Partikel halbiert).
8. **LOD `[V1]`:** Fahrzeuge und Wracks ab 30 m auf 30 % Tris; Teile ab 40 m als Impostor-Box.
9. **Teile pro Fuhre kürzen `[MVP]` (letzter Hebel):** `balancing.json` → `itemsPerLoadFactor` 0,7 auf Stufe „Niedrig".

### 19.2 Messpflicht

Debug-Overlay (F3 / 5-Finger-Tipp) zeigt fps, Frame-ms, Physik-ms, Bodies wach/gesamt, Draw Calls, Tris, Heap. Jede Messung auf Gerät wird als `docs/messungen/<datum>_<gerät>.md` abgelegt (Regel aus `CLAUDE.md`). Playwright-E2E-Test „voller Platz, 250 Teile" muss ≤ 400 Draw Calls liefern, sonst Build-Fehler.

*Fertig, wenn:* Auf dem iPad mit vollem Tag (4 Fuhren, 250 Teile) zeigt das Overlay ≥ 55 fps und ≤ 250 Draw Calls; auf dem iPhone mini ≥ 30 fps über 20 Minuten ohne Absturz; das iPad wird nicht mehr spürbar warm (subjektiv, im Messprotokoll notiert).

---

## 20. Barrierefreiheit & Lokalisierung

| Bereich | Maßnahme | Prio |
|---|---|---|
| Farbfehlsichtigkeit | Farbe ist nie einziger Kanal: Piktogramm + Text + Ampel-Symbol (✓ / ✗ / !) am Bodenring. Option „Muster auf Fraktionen" legt Schraffuren auf Boxen und Schilder. Palette gegen Deuteranopie/Protanopie simuliert (Prüfskript) | `[MVP]` |
| Textgrößen | Mindestens 14 px Text, 12 px Nebentext, 22 px Konto (Handy). Option Textgröße 100/125/150 % skaliert HUD und Karten | `[MVP]` |
| Tippziele | ≥ 44 × 44 px überall; Sticks Ø 100–120 px | `[MVP]` |
| Halten vs. Toggle | Greifen als Toggle wählbar (Halten strengt an) | `[MVP]` |
| Einhändig / Spiegelung | Links-/Rechtshänder-Spiegelung des Touch-Layouts | `[MVP]` |
| Reduzierte Bewegung | Kamera-Blends und Wackeln ausschaltbar; Partikel reduziert | `[V1]` |
| Kein Zeitdruck | Standardmodus hat keine Timer; Aufträge „Kunde" mit Zeit sind optional und nur Bonus | `[MVP]` |
| IK-Einsteigermodus | Reduziert die Achsenkoordination auf „Zielpunkt + Höhe" | `[V1]` |
| Untertitel | Alle Figuren-Texte sind Text; kein Sprachaudio | `[MVP]` |
| Screenreader | Menüs als semantisches HTML mit ARIA-Labels; Spielfläche nicht screenreader-tauglich (bewusst) | `[V1]` |
| Sprachen | Deutsch `[MVP]`, Englisch `[V1]` (Store-Pflicht). Alle Texte in `data/i18n/*.json`, Platzhalter für Zahlen/Einheiten, Tastennamen aus `controls.json`. Zahlen- und Währungsformat über `Intl`. `[Später]`: Französisch, Spanisch, Polnisch — Textumfang ≈ 400 Strings |

*Fertig, wenn:* Deuteranopie-Simulation (Prüfskript) hält ΔE ≥ 15 zwischen allen MVP-Fraktionen; Textgröße 150 % erzeugt keine Überlappung im Layout-Test; alle UI-Strings kommen aus `i18n/de.json` (Lint-Regel gegen Literale in `ui/`).

---

## 21. MVP-Abgrenzung

**Der erste spielbare Stand („Vertical Slice") = Tag 0 bis Ende Tag 3 der Kampagne**, spielbar auf iPad, iPhone mini und Desktop-Browser, veröffentlicht als PWA auf GitHub Pages.

### 21.1 Im ersten spielbaren Stand enthalten `[MVP]`

1. Ein Platz (Stufe 1) aus `level_yard.json`: Tor, Waage, Annahmefläche, Stahlhaufen, 5 Boxen, Zerlegebereich, Presse.
2. Bagger mit Fahrwerk, Oberwagen, Hauptarm, Stiel, Rotator, Spinne; Rampen, Lastfaktor, Pendel.
3. Greifen kinematisch mitgeführt mit Haltepose, Kapazität, drei Abrutsch-Regeln.
4. Arm-Kollision per Shape-Cast mit Widerstand nur in Bewegungsrichtung.
5. 6 Fraktionen (Stahl, VA, Alu, Kupfer/Messing, Kabel, Störstoff) + Batterie als Zerlegeteil; ~12 Formvorlagen.
6. Touch-Layout v2 (2 Sticks, GREIFEN, Rotator-Knöpfe, Fahr-Modus, Kamera-Gesten) mit Safe-Area und Kompaktlayout iPhone mini; Tastatur + Maus.
7. Kamera Orbit (folgt Oberwagen) + Draufsicht; Bodenring; Griff-Info-Chip; Snap.
8. Drei Fahrzeugtypen (Anhänger, Kipper, Tieflader) + Abholer auf Splines; Waage, Sichtprüfung grob, Ankauf fest, Kippen, Verkauf Reinheit².
9. Ein Verbundobjekt (Auto): Räder, Batterie, Motor abreißen; Presse mit `blocksPress`-Regel und Paket.
10. Tag-Struktur: Morgen-Karte, Betrieb (2 Fuhren), Feierabend, Abend-Bilanz mit Sternen; Tage 0–3; Willi-Karte Tag 0 und Tag 3 (Unlock-Karte als Attrappe ohne Kauf).
11. Aufträge Liefern, Räumen, Kunde aus `missions.json`.
12. Wirtschaft nach Kap. 10.1 inkl. Fixkosten und Sortierprämie; Ausbaustufen 2–3 sichtbar als „noch nicht erreichbar".
13. Onboarding Tag 0 blockierend.
14. Prozedurales Audio an Events; Material-Aufprallklänge; Belohnungs-/Fehlerton.
15. Autosave (Abend + `visibilitychange`), Schema-Validierung, Export/Import.
16. Performance-Paket: Statik gemergt, Instancing, Sleep, Verbuchen, Bündeln, dispose, Qualitätsstufen, Debug-Overlay.
17. Testgerüst: Lint-Gate, kopflose Sim-Tests, Playwright Layout/Draw-Call/Sichtbarkeit.
18. Deutsch; Stilpass-Grundlage (Palette, Licht, Flat-Shading) — prozedurale Assets, kein gekaufter Bagger.

### 21.2 Bewusst nicht enthalten (`[V1]` oder `[Später]`)

1. Tage 4–30, Abschlusskarte, freies Spiel `[V1]`
2. Echter Premium-Unlock / IAP, Capacitor-Wrapper, Store-Einreichung `[V1]`
3. Gamepad `[V1]`
4. Kabinen-Kamera, Kabinenhub, Abstützung `[V1]`
5. IK-Einsteigermodus, Auto-Öffnen `[V1]`
6. Ausbaustufe 2 und 3 kaufbar und wirksam (Büro, Halle, Radlader) `[V1]`
7. Anbaugeräte Schere, Magnet, große Presse; Werkzeugwechsel `[V1]`
8. Zerlegung Katalysator, Tank, Kabelbaum, Türen; Scheiben bersten; Quetschen durch Aufprall `[V1]`
9. Fraktionen Reifen, E-Schrott, eigene Batteriebox; Katalysator-Wert `[V1]`
10. Auftragstypen Zerlegen (mit Bonus) und Sauber `[V1]`
11. Reklamation, Betrugsversuche, Ruf-Anzeige, Kunden fahren unverrichtet weg `[V1]`
12. Störfall „Fahrspur blockiert", Pritsche als viertes Fahrzeug `[V1]`
13. Container umsortieren `[V1]`
14. Englisch, Screenreader-Menüs, Reduzierte Bewegung `[V1]`
15. Hero-Assets (gekaufter Bagger, Kenney-Fahrzeuge), Store-Grafik, LOD `[V1]`
16. Radio/Musik im Betrieb, Umgebungsgeräusche `[V1]`
17. Preisschwankung, Marktkurve `[Später]`
18. Platzfläche erweitern, Mitarbeiter, Genehmigungen, Dozer, Stapler, Shredder `[Später]`
19. Akkus/Li-Ion, Blei, Zink, Bronze `[Später]`
20. Nacht/Flutlicht, Wetter `[Später]`
21. Zeitdruck-Modus „Schicht", Bestenlisten `[Später]`
22. Weitere Sprachen `[Später]`
23. Mehrspieler, Online, Accounts, Cloud-Save — **nie**
24. Werbung, Abo, weitere In-App-Käufe — **nie**
25. Unity-Spur — nicht Teil dieses Briefings (Roadmap Phase 2, Timebox)

**Realitätscheck Umfang (ehrlich):** Rückfrage 7 nennt 5–8 Stunden pro Woche und 10–12 Wochen, also 50–100 Arbeitsstunden. Der Slice nach 21.1 kostet nach meiner Schätzung **120–160 Stunden** Agentenarbeit plus Testzeit (Kap. 22) — er ist für das Budget zu groß. Empfehlung: Meilensteine M0–M4 (≈ 75–100 h) sind der harte Kern und ergeben einen „Slice light" (Tag 0–1, Sortieren, Touch, Tag-Struktur, ohne Auto und Presse), der bereits mit Fremden testbar ist. M5 (Auto + Presse) und M6 (Tag 2–3 + Stilpass) folgen, wenn M4 auf dem iPad abgenommen ist. Wer stattdessen alles auf einmal will, verlängert auf 16–20 Wochen — nicht den Umfang der Wochenstunden schätzen, sondern die Wochen.

---

## 22. Meilensteinplan

Aufwand in Agentenstunden (Claude Code baut, Patrick testet und entscheidet); Kalenderwochen bei 5–8 h/Woche. Jede Stufe hinterlässt etwas Spielbares. Kein Meilenstein gilt als fertig, ohne dass Patrick das Abnahmekriterium auf dem iPad geprüft hat.

| M | Name | Inhalt | Fertig, wenn … | Aufwand | Kalender |
|---|---|---|---|---|---|
| M0 | Gerüst und Messbasis | `v2/web` anlegen (Vite, TS strict, Vitest, ESLint-Schichten-Gate, Playwright), `data/*.json` + Schemas mit Prototyp-Werten, GitHub-Pages-Deploy auf eigenem Pfad, Debug-Overlay, `docs/entscheidungen.md` angelegt | `npm run check/lint/test/e2e` grün auf leerem Gerüst; leere Szene läuft auf iPad über die neue URL; Overlay zeigt fps | 8–12 h | Woche 1 |
| M1 | Kopflose Simulation | Scheduler, EventBus, WorldState, PhysicsWorld (Sleep-Parameter, safeBody, onRemoved), Level aus JSON, Scrap-Spawner mit Vorsimulation; Wächter-Tests | Sim-Test „150 Teile, 600 Schritte, alle schlafen, < 0,3 ms/Schritt" grün; Fuzz-Test 10 000 Schritte ohne Ausreißer > 20 m/s | 12–16 h | Woche 2–3 |
| M2 | Bagger und Greifen (kopflos + sichtbar) | Kinematik-Kern portiert, ControlFrame + Tastatur-Adapter, kinematische Kollider, Shape-Cast-Widerstand, Grip-System mit Haltepose, Loslassen mit Spinnengeschwindigkeit; Renderer mit Interpolation, Instancing, gemergter Statik, shared Materials + dispose | Sim-Test Kap. 6.2 (100 × greifen/tragen/ablegen) grün; auf dem Dev-PC ≥ 30 fps mit 250 Teilen und ≤ 400 Draw Calls; Patrick greift 10 Teile auf dem Desktop ohne falsche Haltepose | 20–26 h | Woche 3–5 |
| M3 | Touch und Kamera | Touch-Layout v2 mit Safe-Area, Kompaktlayout, Fahr-Modus, Kamera-Gesten, Orbit folgt Oberwagen, Bodenring, Griff-Info-Chip, Snap; Layout-E2E-Test 3 Viewports; PWA-Manifest, Hochformat-Sperre, Audio-Unlock | Layout-Test ohne Überlappung; Patrick sortiert auf dem iPhone mini 20 Teile in 5 Boxen ohne dritten Finger; Gerätetest-Protokoll zeigt: „bremst nur bei Kontakt", ≥ 30 fps iPhone, ≥ 55 fps iPad | 16–20 h | Woche 5–7 |
| M4 | Tag-Struktur und Wirtschaft („Slice light") | Fahrzeuge auf Splines (Anhänger, Kipper, Abholer), Waage, Ankauf, Kippen, Verkauf Reinheit², Container-Verbuchung, Sortierprämie; Day-System mit Karten, Missionen Liefern/Räumen/Kunde, Sterne, Fixkosten; Onboarding Tag 0; Autosave + Export; Audio an Events; Willi-Karte Tag 0 | Patrick spielt Tag 0 und Tag 1 durch (6–10 min für Tag 1), Bilanz stimmt auf den Cent mit HUD-Prognose; ein fremder Tester schließt Tag 0 ohne Hilfe ab; kaputter Spielstand → Dialog | 22–28 h | Woche 7–10 |
| — | **Abnahme-Tor Slice light** | Gerätetest iPad + iPhone, 2 Fremde spielen Tag 0–1, Fragebogen 5 Fragen | Go: ≥ 30 fps iPhone, Fremde verstehen Kupfer-Erkennung; No-Go: zurück zu M2/M3 statt weiterbauen | Testzeit Patrick | Woche 10 |
| M5 | Auto und Presse | Composite-System aus JSON, Auto mit Rädern/Batterie/Motor, Tieflader, Abriss-Timer + Chip-Balken, Presse mit `blocksPress` und Paket, Quetschstufen | Sim-Test Kap. 8.1 grün; Patrick zerlegt ein Auto auf dem iPad in < 4 min ohne Anleitung; Presse verweigert mit Batterie | 16–20 h | Woche 11–13 |
| M6 | Vertical Slice Tag 0–3 | Tage 2–3 mit Kipper-Fuhren, Auftrag „Kunde", Presse-Auftrag Tag 3, Auto-Vorschau, Unlock-Karte (Attrappe), Stilpass 1 (Palette ΔE-geprüft, ACES, envMap, Kontaktschatten, Piktogramme, Schriften), Qualitätsstufen, Balancing-Runde | Drei Tester spielen Tag 0–3 in 25–40 min; Konto Ende Tag 3 zwischen 5 500 und 7 500 €; iPad ≥ 55 fps, nicht warm; ΔE-Skript grün; Screenshot-Test Kap. 7 (≥ 8/10) | 20–26 h | Woche 13–16 |
| V1 (Ausblick) | Store-Release | Tage 4–30, Ausbaustufen wirksam, Anbaugeräte, Zerlegen-Aufträge, Gamepad, Englisch, Capacitor + IAP, Android-Testgerät, Hero-Assets, itch.io-Demo mit 20 Testern, Play-Console-Test 14 Tage | Geschlossener Test bestanden, Konversion messbar | 120–180 h | +4–6 Monate |

**Summe M0–M6: 114–148 h**, bei 5–8 h/Woche 14–18 Wochen (vgl. Realitätscheck Kap. 21.2). M0–M4 allein: 78–102 h ≈ 10–13 Wochen.

---

## 23. Risiken & offene Punkte

### 23.1 Technische Risiken

| Risiko | Wahrscheinlichkeit / Wirkung | Gegenmaßnahme |
|---|---|---|
| Kinematisches Mitführen erzeugt neue Artefakte (gehaltenes Teil schiebt Haufen „unendlich stark") | mittel / hoch — trifft den Kern | Gehaltene Teile kollidieren nur mit Boden/Statik und losen Teilen über eine gedämpfte Kontaktgruppe (Restitution 0, Reibung 0,3); Alternative im Ärmel: Motor-Joint mit begrenzter Kraft statt Kinematik. Entscheidung in M2 per Sim- und Gerätetest, nicht vorher |
| Mobile-Bildrate trotz Performance-Paket zu knapp | mittel / hoch | Budgets Kap. 19 sind Build-Gates; Qualitätsstufe „Niedrig"; Teile pro Fuhre kürzen; Go/No-Go-Tor nach M3 — Unity-Spur bleibt als Roadmap-Alternative |
| Safari-Eigenheiten (Audio-Unlock, 100vh, PWA-Speicherlöschung, pointercancel) | hoch / mittel | Checkliste Stilguide 4.1 als M3-Abnahmepunkte; Export/Import Pflicht |
| Rapier-WASM-Panik bei ungültigem Body (H1) taucht in neuer Form auf | niedrig / hoch | `safeBody()` + `onRemoved` als einzige Zugriffswege (Lint-Regel gegen direkten `world.getRigidBody`); Fuzz-Test als Wächter |
| Windows-Toolchain (PowerShell, Pfade, Android Studio) kostet Stunden | mittel / niedrig | Node-Skripte statt Shell-Ketten; Android erst in V1 |

### 23.2 Gestalterische Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Achsmodus überfordert Erst-Tester trotz Snap und Bodenring | Abnahme-Tor nach M4 mit Fremden; IK-Modus als V1-Netz vorbereitet (ControlFrame ist dafür schon abstrakt) |
| 6–10-Minuten-Tag fühlt sich gehetzt an (2 Fuhren) oder leer | `balancing.json`: Fuhren-Abstand und -Anzahl je Tag sind Daten; Playtest-Ziel 6–10 min ist das Kriterium, nicht die Zahl 2 |
| Zerstörung kommt zu kurz („Würze") und das Spiel wirkt brav | Auto darf ab Tag 1 gegriffen und fallen gelassen werden, auch ohne Auftrag; Scheiben/Quetschen in V1 zuerst |
| Materialfarben auf kleinem Display doch nicht lesbar | ΔE-Skript + Screenshot-Test (≥ 8/10) als M6-Gate; Piktogramm und Chip als zweiter/dritter Kanal |
| Willi/Lambert-Texte wirken aufgesetzt | Textbudget 10–15 Sätze je Figur, 2–8 Wörter je Blase; Fremd-Lektorat vor V1 |

### 23.3 Umfangsrisiken

| Risiko | Gegenmaßnahme |
|---|---|
| Slice zu groß für 50–100 h (Kap. 21.2) | Abnahme-Tor nach M4 („Slice light"); M5/M6 nur nach Go |
| Scope wächst wieder (Prototyp-GDD: 1 020 Zeilen in drei Fassungen) | Scope-Regel: Neues kommt nur gegen Streichung aus 21.1; jede Änderung an Zahlen in Kap. 5–10 braucht einen Playtest-Befund und einen Eintrag in `docs/entscheidungen.md` |
| Zwei Spuren (Web + Unity) fressen sich die Zeit | Unity ist nicht Teil dieses Briefings; Timebox 2 Wochen laut Roadmap, erst nach M3 |
| Prototyp wird doch angefasst | Regel 1 `CLAUDE.md`; Kopieren statt Verweisen; Git-Hook, der Änderungen unter `../prototype/` und `../docs/` ablehnt |

### 23.4 Annahmen (ohne ausdrückliche Antwort getroffen)

| # | Annahme | Wo | Wenn falsch, dann … |
|---|---|---|---|
| A1 | Unterste Mobil-Konfiguration: Snapdragon 695 / Dimensity 700, 4 GB, Android 11; iPhone 12 mini / iOS 17 | Kap. 3, 19 | Budgets in Kap. 19 verschieben sich; Messung auf Testgerät entscheidet |
| A2 | Premium-Preis 4,99 €, Unlock-Punkt Ende Tag 3 | Kap. 1, 10.5 | Nur Zahl in `balancing.json` und Kartentext |
| A3 | Ankauf Fahrzeug pauschal 120 €; Batterie-Verkauf 0,40 €/kg; Katalysator 40 €/Stück | Kap. 7, 8.3 | Zahlen in `materials.json`/`composites.json` |
| A4 | Keine Strafe bei falscher Zerlege-Reihenfolge im MVP; Presse mit Batterie erst V1 möglich (mit Strafe) | Kap. 8 | Ein Flag `punishWrongOrder` in `balancing.json` |
| A5 | Kunden fahren im MVP nie unverrichtet weg; Geduld wirkt nur auf Boni | Kap. 13.3 | V1-Regel (180 s Gewerbe) vorziehen |
| A6 | Fuhren-Abstand 60–90 s, 2 Fuhren an Tag 1–3, um 6–10 min zu treffen | Kap. 4.3 | `balancing.json`; Playtest-Ziel bleibt 6–10 min |
| A7 | Abrutsch-Regeln deterministisch (keine Zufallswahrscheinlichkeit) | Kap. 6.3 | Optionaler Zufallsanteil als Flag; Standard aus |
| A8 | Bündelungsgrenze 300 lose Teile, Container-Verbuchung nach 3 s Ruhe, 6 Teile bleiben 20 s korrigierbar | Kap. 19.1 | Zahlen in `balancing.json` |
| A9 | IK-Einsteigermodus ist V1, nicht MVP | Kap. 5.4 | Vorziehen nach M4-Abnahme, wenn Fremde scheitern |
| A10 | Fahrgeschwindigkeit 2,2 m/s (statt 1,4) behebt „fährt zu langsam" | Kap. 5.1 | Zahl in `balancing.json`; Gerätetest |
| A11 | Kein gekauftes Bagger-Modell im Slice; prozedurales Modell aus dem Prototyp (`clawGeometry.ts` als eine Wahrheit für Mesh und Kollider) | Kap. 16.3, 21 | Hero-Asset in V1 |
| A12 | Deutsch allein reicht für den Slice; Englisch erst V1 | Kap. 3, 20 | i18n-Struktur steht ab M0, Übersetzung ist Fleißarbeit |
| A13 | Der Auftraggeber programmiert nicht selbst; alle Aufwände sind Agentenstunden plus seine Testzeit | Kap. 22 | Bei eigener Mitarbeit verschieben sich Schätzungen nach unten |
| A14 | Solver 6/2 Iterationen und `contact_natural_frequency` 30 halten Stapel ruhig genug | Kap. 6.5 | Werte in `balancing.json`; Wächter-Test entscheidet |
| A15 | Maximal 2 Nachholschritte pro Bild statt 5 | Kap. 6 | Zahl im GameLoop |

### 23.5 Abweichungen von den v2-Dokumenten vom 02.09.

| Dokument | Dort | Hier | Grund |
|---|---|---|---|
| `01_GDD_v2.md` Kap. 3, 5 | Tag 12–20 min, 2–4 Fuhren | Tag 6–10 min, 1–5 Fuhren nach Stufe | Rückfrage 3 |
| `01_GDD_v2.md` Kap. 13 | Kat/Batterie-Zerlegung „NIE für 1.0" | Batterie `[MVP]` (Presse-Blocker), Kat `[V1]` | Rückfrage 6: Batterie ist billig (ein Part-Eintrag) und gibt der Presse eine Regel |
| `01_GDD_v2.md` Kap. 1, `CLAUDE.md` | Android zuerst, iPhone-Test | iPad Leitgerät, iPhone mini Kompakt, Google Play als erster Store | Rückfrage 3 (Runde 2) |
| `03_Roadmap.md` | Phasen 0–5 mit Unity-Spur in Phase 2 | Meilensteine M0–M6 nur Web; Unity ausgeklammert | Rückfrage 1 |
| `04_Stilguide_und_Touch.md` 2.1 | IK-Modus ohne Prio | IK `[V1]` | A9 |
| Briefing v1 Kap. 6 | Abrutschen mit Wahrscheinlichkeit/s | Deterministische Regeln | A7 |
| Briefing v1 Kap. 3 | Tastatur+Maus `[MVP]`, Touch `[V1]` | Touch `[MVP]` gleichrangig | Rückfrage 4 |

---

## 24. Glossar

| Begriff | Erklärung |
|---|---|
| Umschlagbagger / Fuchsbagger | Bagger mit langem Ausleger und Greifer zum Umschlagen von Schüttgut und Schrott; „Fuchs" ist ein bekannter Hersteller, der Name wird umgangssprachlich für die Gattung benutzt |
| Oberwagen | Drehbarer Aufbau des Baggers mit Kabine und Motor; dreht endlos auf dem Unterwagen |
| Unterwagen / Fahrwerk | Fahrbarer Teil mit Rädern (Mobilbagger) oder Ketten |
| Hauptarm / Ausleger (Boom) | Erstes Armglied am Oberwagen; hebt und senkt |
| Stiel (Stick) | Zweites Armglied; holt heran oder streckt weg |
| Rotator | Drehmotor zwischen Stiel und Greifer; dreht die Spinne um die eigene Achse |
| Greifspinne / Schalenkorbgreifer / Mehrschalengreifer | Greifer mit 4–5 Zinken („Schalen"), der sich wie eine Hand um Schrott schließt |
| Zinke / Kralle | Einzelner Finger der Greifspinne |
| Abstützung / Pratzen | Ausfahrbare Stützen am Unterwagen für Standsicherheit bei schwerer Last |
| Kabinenhub | Hydraulisch anhebbare Kabine für bessere Sicht in Container |
| Fraktion | Eine sortenreine Materialklasse im Recycling (Stahl, Alu, Kupfer …) |
| Sortenrein | Nur eine Fraktion, ohne Fremdanteile |
| Reinheit | Anteil der Zielfraktion an der Gesamtmasse eines Containers |
| Störstoff | Alles, was nicht in die Metallfraktion gehört: Holz, Kunststoff, Beton, Reifen; kostet Entsorgung |
| Buntmetall / NE-Metall | Nichteisenmetalle: Kupfer, Messing, Aluminium, Zink, Blei — deutlich wertvoller als Stahl |
| VA / Edelstahl | Rostfreier Stahl (Chrom-Nickel); nicht magnetisch, spiegelnd; „VA" = Kurzform aus der Werkstattsprache |
| Guss | Gusseisen (Motorblöcke, Heizkörper); im Spiel Teil der Stahlfraktion |
| Mischschrott | Unsortierte Anlieferung; wird zum niedrigen Pauschalpreis angekauft |
| Ankauf / Verkauf | Ankauf = der Platz zahlt dem Anlieferer; Verkauf = der Abnehmer zahlt dem Platz |
| Waage / Brutto / Tara / Netto | Fahrzeug wird voll (brutto) und leer (tara) gewogen; Differenz = netto = bezahlte Masse |
| Abrollkipper / Mulde | Lkw, der Container (Mulden) mit einem Haken aufzieht und abtransportiert |
| Tieflader | Anhänger mit niedriger Ladefläche für Fahrzeuge und Maschinen |
| Katalysator (Kat) | Abgasreiniger im Auto mit Edelmetallen (Platin, Palladium); klein, sehr wertvoll |
| Starterbatterie | Bleiakku im Auto; Gefahrgut (Säure, Blei), darf nicht in die Presse |
| Kabelbaum | Gesamtheit der elektrischen Leitungen im Auto; Kupfer im Kunststoffmantel |
| Schrottschere | Hydraulisches Anbaugerät, das Metall schneidet |
| Presse / Paketierpresse | Station, die Blech und Karossen zu kompakten Paketen presst |
| Betonlego | Große Betonblöcke mit Nut und Feder als Wände für Schüttgutboxen |
| Rigid Body | Starrer Körper in der Physik-Engine; hat Masse, Position, Geschwindigkeit |
| Kinematischer Körper | Physikkörper, der bewegt wird, aber selbst nicht von Kräften beeinflusst wird (unendliche Masse) — der Bagger und gehaltene Teile |
| Kollider | Form, mit der ein Körper Kontakte berechnet (Box, Zylinder, Konvexhülle) |
| Kollisionsgruppe | Filter, welche Kollider miteinander Kontakte bilden dürfen |
| Shape-Cast | Abfrage: „Wenn diese Form sich entlang dieses Vektors bewegt, was trifft sie zuerst?" |
| Fixed Joint | Physikverbindung, die zwei Körper starr koppelt; im Prototyp Ursache falscher Halteposen |
| Sleep / Schlafen | Physikkörper in Ruhe werden nicht mehr gerechnet, bis etwas sie anstößt |
| Solver-Iterationen | Wie oft die Physik pro Schritt Kontakte nachrechnet; mehr = stabiler, aber teurer |
| Interpolation | Zwischenbilder zwischen zwei Physikschritten, damit 60-Hz-Physik auf 120-Hz-Displays glatt aussieht |
| Draw Call | Ein Zeichenbefehl an die Grafikkarte; Hauptkostenfaktor auf Mobilgeräten |
| Instancing | Viele gleiche Formen in einem Draw Call zeichnen |
| LOD | Level of Detail — entfernte Objekte mit weniger Polygonen darstellen |
| ΔE (Delta E) | Farbabstand im CIE-Lab-Raum; ≥ 25 wirkt für Laien als klar unterschiedliche Farbe |
| ACES Filmic | Tone-Mapping-Kurve, die helle und dunkle Bereiche filmähnlich zusammenführt |
| envMap / Room-Environment | Umgebungsreflexion, die Metalle spiegelnd erscheinen lässt |
| Safe-Area | Bildschirmbereiche ohne Notch, Kameraloch oder Home-Indikator |
| PWA | Progressive Web App — Website, die vom Home-Screen wie eine App startet |
| Capacitor | Werkzeug, das eine Web-App in eine native Android/iOS-App verpackt |
| IAP | In-App Purchase — Kauf innerhalb der App über den Store |
| ControlFrame | Im Projekt: Datensatz mit allen Eingabewerten eines Schritts, unabhängig vom Gerät |
| Scheduler | Im Projekt: Reihenfolge, in der die Spielsysteme pro Schritt aktualisiert werden |
| EventBus | Nachrichtenkanal; Systeme melden „etwas ist passiert", ohne den Empfänger zu kennen |
| Snapshot | Nur-Lese-Kopie des Simulationszustands für Darstellung und UI |
| Vertical Slice | Ein schmaler, aber in allen Schichten fertiger Ausschnitt des Spiels (hier Tag 0–3) |
| Playtest-Ziel / „Fertig, wenn" | Messbares Kriterium, an dem eine Zahl oder ein Feature abgenommen wird |
