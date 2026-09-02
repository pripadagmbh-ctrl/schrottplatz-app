# Schrottplatz-App — Entwicklungs-Briefing (Game Design Document)

Stand: 2026-08-27 · Version 1.0 · Ergebnis aus `01_Briefing-Prompt.md` + Rückfragen-Runden 1 und 2.

Alle Zahlenwerte, die mit **(SW)** markiert sind, sind **Startwerte zum Austesten** — sie sind bewusst gesetzt, damit ein Entwickler sofort bauen kann, und werden im Playtest angepasst.

Prioritäten: `[MVP]` = erster spielbarer Stand · `[V1]` = erster Store-Release (Google Play) · `[Später]` = danach, ausdrücklich nicht einplanen.

---

## 1. Kurzfassung

**Elevator Pitch:** Du sitzt im Fuchsbagger eines kleinen Schrottplatzes: Kunden liefern Altmetall an, du greifst dich mit der Greifspinne durch den Haufen, erkennst Kupfer, Alu und Störstoffe, sortierst alles in die richtigen Container und reißt aus Altautos Motor, Kat und Batterie heraus, bevor die Presse zuschlägt. Sauberes Trennen bringt Geld, Pfusch kostet — und mit dem Gewinn baust du Platz, Werkzeuge und Ruf aus. Kein Zeitdruck-Stress, sondern das befriedigende Gefühl, aus Chaos sortenreine Haufen zu machen.

| Feld | Inhalt |
|---|---|
| Genre | Sim-Lite / Arbeits-Simulation mit Physik-Kern und Wirtschafts-Metagame |
| Plattform | Google Play (Android) zuerst; Entwicklung/Test im Desktop-Browser; iOS `[Später]` |
| Monetarisierung | Premium, einmalig 4,99 € (SW), keine Werbung, keine In-App-Käufe |
| Zielgruppe | Casual-bis-Core-Spieler 16–45, die „satisfying jobs" mögen (PowerWash-Simulator-Publikum), Technik-/Baumaschinen-Affine |
| USP | Echte Mehrachsen-Baggersteuerung mit Physik-Greifer **plus** satte Zerstörung (Autos packen, fallen lassen, quetschen, zerlegen — Scheiben bersten, Teile reißen ab). Materialkunde light: Schrott auf den richtigen Haufen werfen bringt Geld |
| Einzel-/Mehrspieler | Strikt Einzelspieler. Mehrspieler ist bewusst ausgeschlossen, auch als Fernziel. |

---

## 2. Vision & Spielgefühl

**Tragende Emotion** *(Design-Pivot 2026-08-27)***:** Kompetenz und kathartische Zerstörung. Der Kernmoment: ein Auto packen und **spüren, wie schwer es ist**, es aufs Dach fallen lassen — Scheiben bersten, das Blech knickt —, den Motor herausreißen und den Rest mit Schwung auf den Stahlhaufen werfen. Ordnung ist die zweite Ebene, bewusst leichtgewichtig: Schrott auf den **richtigen Haufen** werfen bringt Geld, mehr Sortier-Bürokratie gibt es im Kern-Loop nicht. Die frühere Fassung („Ordnung zuerst, Container-Reinheit im Fokus") ist damit ersetzt; Reinheit bleibt als einfacher Bonus/Malus pro Haufen erhalten.

**Was sich gut anfühlen muss (mit Abnahmekriterium):**

| Gefühl | Konkret | Fertig, wenn … |
|---|---|---|
| Greifen ist „satt" | Spinne schließt in 0,4 s (SW), Objekte ruckeln nicht in der Zange, schwere Teile heben den Ausleger spürbar träger | Ein Tester greift 10 verschiedene Objekte und keines zittert, clippt oder teleportiert sichtbar |
| Masse ist spürbar | Hydraulik hat Anlauf-/Auslauframpe (0,15 s / 0,25 s, SW); ein 300-kg-Motor senkt die Drehgeschwindigkeit des Oberwagens um 25 % (SW) | Blindtest: Tester erkennt am Verhalten, ob der Greifer leer, halb oder voll beladen ist |
| Zerstören wirkt | Scheiben bersten ab Aufprallenergie-Schwelle (SW), Karosse hat 3 Quetschstufen, Späne-/Funkenpartikel + eigener Klang je Materialtreffer; Zäune/Props knicken um | Tester lässt freiwillig 3 Autos fallen, nur um zuzuschauen |
| Werfen/Sortieren belohnt | Abwurf auf den richtigen Haufen gibt sofort Sound + Geldticker; Schwungwürfe (Ladung im Schwenk loslassen) funktionieren | Tester wirft aus 5 m Distanz gezielt auf Haufen und trifft nach kurzer Übung |
| Kein Stress als Default | Freies Spiel hat keine Timer; Geduld der Kunden ist großzügig | Ein Tester kann eine Anlieferung 10 Minuten liegen lassen, ohne Spielverlust — nur mit sanftem Malus |

**Referenztitel:**

| Titel | Das übernehmen wir | Das machen wir bewusst anders |
|---|---|---|
| PowerWash Simulator | Entspannter Flow, sichtbarer Vorher/Nachher-Fortschritt, Checklisten-Befriedigung | Wir haben Physik und Fehlermöglichkeiten — man kann falsch sortieren, PowerWash kennt kein Falsch |
| Teardown | Lesbare, stilisierte Materialwelt; Freude an Physik-Interaktion | Keine Voxel, keine freie Zerstörung — Zerlegung folgt einem Regelsystem (Kap. 8) |
| Bau-Simulator / Bagger-Simulatoren | Achsweise Maschinensteuerung, Kabinengefühl | Wir kürzen den Simulator-Ballast: kein Tanken-Minispiel, keine 1:1-Hydraulikphysik, Sim-Lite |
| Unpacking | Die stille Befriedigung, Dinge an den richtigen Ort zu legen | Bei uns mit Geld-Feedback und Physik statt Rasterlogik |
| Gas Station Simulator | Wirtschafts-Loop „Kunde kommt → Service → Geld → Ausbau" | Kein Chaos-/Trash-Humor; unser Ton ist bodenständig-echt |

---

## 3. Zielgruppe & Plattform

| Aspekt | Festlegung |
|---|---|
| Spielertyp | „Feierabend-Sortierer": will 15–30 min entspannt kompetent sein. Sekundär: Baumaschinen-Fans, die Steuerungstiefe suchen (Profi-Achsmodus, Kap. 5) |
| Vorwissen | Keins nötig. Materialkunde wird im Spiel beigebracht (Onboarding Kap. 14); reale Schrott-Begriffe im Glossar/Tooltips |
| Eingabegeräte | `[MVP]` Tastatur + Maus (Desktop-Browser). `[V1]` Touch (virtuelle Sticks) und Gamepad. `[Später]` echte Joysticks |
| Orientierung Mobile | Landscape-only. Portrait wird nicht unterstützt (Sperre in Capacitor-Config) |
| Ziel-Hardware Mobile | Mittelklasse-Android ab 2022: Snapdragon 695 / Dimensity 700-Klasse, 4 GB RAM, Android 11+ (SW für minSdk: API 30) |
| Unterste Konfiguration | Auf dem Referenz-Minimalgerät (Snapdragon 695): stabil ≥ 30 fps bei den Budgets aus Kap. 19. Läuft es dort nicht, wird Inhalt gekürzt, nicht das Gerät fallen gelassen |
| Desktop (Entwicklung) | Jeder Browser mit WebGL2; integrierte GPU (Intel Iris Xe) muss 60 fps schaffen |

---

## 4. Gameplay-Loops

**Sekunden-Loop — Greifen, Heben, Ablegen (5–20 s):** `[MVP]`
Zielobjekt visuell erkennen (Farbe/Form, Kap. 7) → Oberwagen drehen, Ausleger/Stiel positionieren → Spinne öffnen, absenken, schließen → Grip-Feedback (Sound + HUD zeigt Material + Gewicht) → über Zielcontainer schwenken → öffnen, Abwurf → sofortiges Feedback: richtig (Geld-Ticker, Klang) oder falsch (Warnton, Kontaminations-Anzeige des Containers steigt).
*Fertig, wenn:* Der komplette Zyklus dauert für ein geübtes Einzelobjekt 8–15 s und jeder Schritt hat hörbares + sichtbares Feedback.

**Minuten-Loop — eine Anlieferung (3–8 min):** `[MVP]`
Kunde fährt ein → Erstwiegung auf Brückenwaage → Abladen auf Annahmefläche → Spieler sortiert den Haufen in Container, zieht Störstoffe heraus → Zweitwiegung leer → Abrechnung: Ankaufspreis minus Störstoff-/Verunreinigungsabzüge → Kunde fährt ab, Zufriedenheit wird verbucht.
*Fertig, wenn:* Eine Misch-Anlieferung von 400 kg (SW) ist in unter 8 min vollständig abwickelbar inkl. Bezahlung.

**Session-Loop — ein Arbeitstag (15–30 min):** `[MVP]`
Tagesbeginn: Tagesziel + Marktpreise einsehen → 2–4 Anlieferungen abarbeiten, dazwischen frei umsortieren/zerlegen → optional: vollen Container an Abnehmer verkaufen (Abholung) → Tagesende: Bilanz (Einnahmen, Kosten, Sortierquote) → Speichern.
*Fertig, wenn:* Ein Tag endet automatisch nach Abarbeitung ODER auf Spielerwunsch, und die Bilanz zeigt mindestens: Umsatz, Kosten, Sortierfehler, Tagesgewinn.

**Meta-Loop — Ausbau (viele Tage):** `[V1]` (Grundgerüst `[MVP]`: Geld persistiert, 2 kaufbare Upgrades)
Gewinn investieren in: Anbauwerkzeuge, Container, Platzfläche, Genehmigungen (schaltet Materialannahmen frei, z. B. Akkus), Mitarbeiter `[Später]` → mehr/wertigere Anlieferungen → größere Tage.
*Fertig, wenn:* Nach 5 Spielstunden hat der Spieler laut Balancing-Kurve (Kap. 10) 3–4 Upgrades gekauft und es ist mindestens ein Wunsch-Upgrade sichtbar unerreichbar (Zugpferd).

---

## 5. Baggersteuerung

Das Gerät: **Umschlagbagger („Fuchsbagger") mit Hochkabine und 5-Finger-Greifspinne (Polypgreifer) am endlos drehbaren Rotator.** Mobil auf Rädern, im MVP fährt er langsam (Schrittgeschwindigkeit), Abstützung wird nicht simuliert (siehe Kap. 6, bewusste Grenzen).

### 5.1 Achsen und Belegung

| Achse | Verhalten | Tastatur+Maus `[MVP]` | Gamepad `[V1]` | Touch `[V1]` |
|---|---|---|---|---|
| Fahrwerk vor/zurück | max 5 km/h (SW), Anfahrrampe 0,4 s | W / S | D-Pad ↑ / ↓ | Fahr-Modus-Toggle + linker Stick vertikal |
| Lenkung | Achsschenkellenkung, Wendekreis 7 m (SW) | A / D | D-Pad ← / → | Fahr-Modus + linker Stick horizontal |
| Oberwagen drehen | max 40 °/s leer (SW), lastabhängig (Kap. 6) | Q / E | Linker Stick X (ISO) | Linker virtueller Stick X |
| Ausleger heben/senken | Winkelgeschwindigkeit 25 °/s (SW) | Maus Y (bei gehaltener RMB) oder R / F | Rechter Stick Y | Rechter virtueller Stick Y |
| Stiel an/weg | 30 °/s (SW) | Maus Y (ohne RMB) oder T / G | Linker Stick Y | Linker virtueller Stick Y |
| Spinne schließen | Schließzeit 0,4 s (SW), hält solange gedrückt bzw. Toggle (Option) | Linke Maustaste (halten) | Rechter Trigger | Großer Greif-Button rechts unten |
| Spinne öffnen | Öffnungszeit 0,3 s (SW) | LMB loslassen (bzw. Toggle-Klick) | Linker Trigger | Greif-Button loslassen |
| Rotator drehen | endlos, 60 °/s (SW) | Mausrad | Bumper L/R | Zwei kleine Pfeil-Buttons über Greif-Button |

Anmerkungen:
- Standard-Greifmodus ist **Halten** (LMB gedrückt = zu). **Toggle** ist eine Option in den Einstellungen `[MVP]` — wichtig für Barrierefreiheit (Kap. 20).
- Alle Tasten frei belegbar `[V1]`, im `[MVP]` fest.
- Gamepad folgt dem ISO-Baggerschema (links: Stiel/Drehen, rechts: Ausleger/Löffel), weil Baumaschinen-Fans das erwarten; Greifer liegt abweichend auf den Triggern, da die Spinne kein Löffel ist.

### 5.2 Kamerasystem

| Kamera | Beschreibung | Priorität |
|---|---|---|
| Orbit-Kamera (Standard) | Folgt dem Oberwagen, Maus-bewegung bei gehaltener mittlerer Maustaste / rechter Touch-Wisch dreht, Mausrad+Modifikator zoomt (3–18 m Abstand, SW). Automatisches leichtes Nachschwenken auf den Greifer | `[MVP]` |
| Sortier-Draufsicht | Taste C: Kamera fährt auf 25 m Höhe (SW), 60° Neigung — Überblick über Annahmefläche + Container | `[MVP]` |
| Kabinenkamera | Ego-Sicht aus der Hochkabine, Kopf frei umschaubar | `[V1]` |
| Foto-/Freikamera | Freies Umherfliegen, UI ausblendbar | `[Später]` |

*Fertig, wenn:* Kamerawechsel dauert < 0,3 s mit weichem Blend und der Greifer ist in Orbit- und Draufsicht nie länger als 1 s verdeckt (Auto-Ausweichen der Kamera bei Verdeckung durch Containerwände).

### 5.3 Assistenzfunktionen

| Assistent | Funktion | Priorität |
|---|---|---|
| Greif-Hilfe | Bei Spinne ≤ 0,5 m (SW) über greifbarem Objekt: dezentes Outline-Highlight + HUD zeigt Material und Gewicht | `[MVP]` |
| Abwurf-Hilfe | Schwebt Ladung über einem Container, zeigt der Container Grün (richtig) / Rot (falsch) / Gelb (bringt Geld, aber nicht optimal) | `[MVP]` |
| Auto-Nivellierung | Option: Greifer bleibt beim Ausleger-/Stiel-Bewegen automatisch senkrecht | `[V1]` |
| IK-Zielsteuerung („Einsteiger-Modus") | Spieler bewegt nur einen Zielpunkt mit der Maus/dem Stick, Ausleger+Stiel folgen per IK. Achsmodus bleibt als „Profi-Modus" erhalten | `[V1]` |
| Fahr-Autopilot | Klick auf Bodenmarkierung, Bagger fährt selbst hin | `[Später]` |

---

## 6. Physik & Simulation

Physik-Engine: **Rapier 3D (WASM)**, Fixed Timestep 60 Hz (SW), Substeps 1.

### 6.1 Echt simuliert vs. gefaked

| Verhalten | Echt / Fake | Wie |
|---|---|---|
| Schrottteile als Starrkörper | Echt | Jedes lose Teil ist ein Rigidbody mit Convex-Hull- oder Compound-Collider; Masse aus Materialdichte × Volumen (Kap. 7) |
| Baggerarm | Fake (kinematisch) | Arm ist eine kinematische Kette (animierte Gelenkwinkel mit Rampen), KEINE simulierten Hydraulik-Joints. Kollisionen des Arms schieben Objekte weg, der Arm selbst wird nie von Physik bewegt. Grund: Stabilität und Mobile-Performance |
| Greifen | Hybrid | Siehe 6.2 |
| Stapeln in Containern/Haufen | Echt | Rigidbodies stapeln physisch; nach 3 s Ruhe (SW) → Sleep; sortenreine Container-Inhalte werden ab 20 Objekten (SW) zu statischem „Füllstand-Mesh" zusammengefasst (Kap. 19) |
| Lastträgheit | Fake (Parameter) | Zuladung skaliert Dreh-/Hubgeschwindigkeit: Faktor = 1 − 0,5 × (Last / Maxlast 2.000 kg) (SW). Kein echtes Drehmoment |
| Bodenkontakt des Greifers | Fake (Achs-Klemmung) | Der Boden ist immer harter Widerstand: Ausleger-/Stiel-Bewegung wird geklemmt, sobald die Zackenspitzen den Boden erreichen — die Spinne versinkt nie. Kontakt bei gleichzeitiger Dreh-/Fahrbewegung erzeugt Kratzgeräusch + Staub-/Funkenpartikel |
| Kippen des Baggers | Fake (Grenzwert) | Statikprüfung: Lastmoment = Last × Ausladung. Über 80 % des Grenzwerts (SW): Warnton + HUD-Symbol + Kamera-Wackeln; über 100 %: Arm senkt sich zwangsweise ab. Der Bagger fällt nie um |
| Fahrzeuge der Kunden | Fake | Kinematisch auf Splines (Kap. 13), keine Fahrphysik |
| Verformung/Pressen | Fake | Modell-Swap + Partikel (Kap. 8) |

### 6.2 Greifen technisch

1. **Kollisionsabfrage:** Jeder der 5 Finger hat einen Kontaktsensor. Beim Schließen wird geprüft, welche Rigidbodies von ≥ 2 Fingern aus gegenüberliegenden Richtungen (Winkel > 90° zwischen Kontaktnormalen, SW) berührt werden.
2. **Joint:** Für jedes gegriffene Objekt wird ein **Fixed Joint** zwischen Objekt und Greiferbasis erzeugt. Kein Reibungs-Greifen — zu instabil.
3. **Haltekraft & Kapazität:** Greifer hält max. **2.000 kg gesamt (SW)**, max. **5 Objekte gleichzeitig (SW)**. Schwerere Einzelobjekte (Motor 300 kg ok, gepresstes Auto 900 kg ok) sind greifbar, solange die Summe passt.
4. **Abrutschen:** Objekte über 60 % der Maxlast (SW) rutschen mit **8 % Wahrscheinlichkeit pro Sekunde (SW)** ab, wenn der Greifer gleichzeitig gedreht + geschwenkt wird; ruhiges Führen rutscht nicht. Abrutschen = Joint lösen + Sound + Objekt fällt. Sperrige Objekte (Bounding-Box-Kante > 2,5 m, SW) rutschen zusätzlich, wenn weniger als 3 Finger Kontakt hatten.
5. **Schüttgut-Griff:** Greift die Spinne in einen Haufen Kleinteile (< 15 kg/Objekt, SW), werden bis zu 12 Kleinteile (SW) in einem Rutsch als eine Sammelladung gegriffen (Joints), damit Kabelberge nicht Stück für Stück gehoben werden müssen.

*Fertig, wenn:* 100 aufeinanderfolgende Greifvorgänge im Test: kein Objekt clippt durch den Greifer, keine Physik-Explosion, Abrutschen tritt nur unter den definierten Bedingungen auf.

### 6.3 Bewusst NICHT simuliert

Seilphysik, Hydraulikdruck, Reifen-/Fahrwerksfederung des Baggers, Abstützpratzen, Materialverbiegung, Flüssigkeiten (auslaufendes Öl ist nur ein Decal + Malus-Event), Brand/Explosion (Akku-Fehlwurf gibt Strafe + Rauch-Partikel, kein Feuer-System), Wetter-Physik (Wind), Schäden am Bagger.

---

## 7. Material- und Schrottkatalog

Preise in €/kg, **alle Werte (SW)** — Marktpreisschwankung siehe Kap. 10. „Ankauf" zahlt der Spieler dem Kunden, „Verkauf" bekommt der Spieler vom Abnehmer bei Containerabholung.

| Materialklasse | Prio | Dichte (kg/dm³) | Typ. Stückgewicht | Ankauf €/kg | Verkauf €/kg | Zielcontainer | Typische Fehlsortierung | Visuelle Erkennung |
|---|---|---|---|---|---|---|---|---|
| Stahlschrott (Mischschrott E3) | `[MVP]` | 7,9 | 5–200 kg | 0,18 | 0,25 | Großcontainer STAHL (grau) | Guss dazwischen; verzinkte Teile | Rostbraun-graue Träger, Bleche, Rohre; matte Oberfläche |
| Guss (Grauguss) | `[MVP]` | 7,2 | 20–300 kg | 0,20 | 0,28 | Container GUSS (dunkelgrau) | Landet im Stahl (kostet Verkaufsbonus) | Klobige, dickwandige Blöcke: Motorblöcke, Kanaldeckel, Heizkörper; körnige Bruchkante |
| Aluminium | `[MVP]` | 2,7 | 1–40 kg | 1,10 | 1,50 | Container ALU (silber) | Edelstahl wird für Alu gehalten (Alu ist viel leichter!) | Hellsilbern, matt, Felgen, Profile, Bleche; auffällig leicht beim Heben (HUD-Gewicht nutzen) |
| Kupfer | `[MVP]` | 8,9 | 0,5–25 kg | 6,00 | 7,20 | Box KUPFER (orange, klein + abschließbar) | Messing als Kupfer abgegeben (Kundenbetrug, Kap. 9) | Orange-rötlich glänzend: Rohre, Drähte, Anker; sehr schwer für die Größe |
| Messing | `[V1]` | 8,5 | 0,2–15 kg | 3,80 | 4,60 | Box MESSING (gelb) | Mit Kupfer verwechselt (Farbe!) | Gelb-goldene Armaturen, Ventile, Fittings |
| Edelstahl (V2A) | `[V1]` | 7,9 | 1–60 kg | 1,00 | 1,40 | Container VA (blank-silber) | Landet im Alu (VA ist 3× schwerer) oder Stahl (Wertverlust) | Blank glänzend, rostfrei: Spülen, Geländer, Behälter; kein Rost trotz Alter |
| Elektroschrott | `[V1]` | ~2,0 (Mix) | 2–35 kg | 0,25 | 0,50 | Gitterbox E-SCHROTT (grün) | In Stahl geworfen (Umweltstrafe, Kap. 9) | Gehäuse mit Platinen, Waschmaschinen, Motoren mit Wicklung; Kabelanschlüsse sichtbar |
| Kabel (Cu-Anteil) | `[MVP]` | ~3,0 (Mix) | 0,1–10 kg | 1,60 | 2,20 | Gitterbox KABEL (orange gestreift) | Als Störstoff/Plastik verkannt | Bunte Ummantelung, Kupfer blitzt an Schnittenden; liegt in Bergen/Bündeln |
| Blei-Starterbatterie | `[V1]` | 3,5 | 12–25 kg/Stück | 0,45 | 0,60 | Säurefeste Box BATTERIE (rot, Deckel) | Bleibt im Auto beim Pressen → schwere Strafe (Kap. 8) | Schwarzer Quader mit zwei Polkappen |
| Lithium-Akku (E-Bike/Werkzeug) | `[Später]` | 2,5 | 1–8 kg/Stück | 0,00 (Annahmegebühr +1,50 €/kg vom Kunden) | Entsorgung −0,80 €/kg | Brandschutzbox AKKU (rot-weiß) | In E-Schrott geworfen → höchste Strafe im Spiel | Kompakte Kunststoffblöcke mit Ladekontakten, Warnsymbol |
| Reifen | `[V1]` | — | 8–12 kg/Stück | 0,00 (Gebühr +3,00 €/Stück vom Kunden) | Entsorgung −2,50 €/Stück | Sammelfläche REIFEN | In Stahlcontainer (Kontamination) | Schwarz, rund, unverwechselbar — Absichtstest fürs Sortier-Tutorial |
| Störstoffe (Holz, Plastik, Beton, Restmüll) | `[MVP]` | 0,5–2,4 | 1–80 kg | 0,00 (Gebühr +0,05 €/kg vom Kunden) | Entsorgung −0,08 €/kg | Mulde STÖRSTOFF (braun) | Wird „mitgewogen" übersehen → kontaminiert Metallcontainer | Holzbalken, Plastikeimer, Betonbrocken — bewusst kontrastarm „unmetallisch" |

**Kontaminationsregel `[MVP]`:** Jeder Container hat einen Reinheitsgrad (100 % = sortenrein). Falscher Abwurf senkt ihn um (Fremdgewicht / Containergewicht). Verkaufspreis des Containers = Basispreis × Reinheit². Unter 80 % Reinheit (SW) verweigert der Abnehmer die Abholung, bis der Spieler den Container manuell nachsortiert (Fehlteile wieder herausgreifen — sie bleiben echte Objekte, solange der Container nicht zum Füllstand-Mesh zusammengefasst wurde; danach kostet Nachsortieren pauschal −50 € (SW) „Handverlesung").
*Fertig, wenn:* Reinheit wird pro Container live im HUD angezeigt und ein absichtlicher Fehlwurf ändert Reinheit und prognostizierten Erlös sofort sichtbar.

---

## 8. Zerlegungs-Mechanik

### 8.1 Das System: Verbundobjekte (wiederverwendbar)

Ein **Verbundobjekt** ist ein Objekt aus **Baugruppen (Parts)**, beschrieben als Daten (JSON, Kap. 18) — kein Sondercode pro Objekttyp:

- Jede Part hat: Materialklasse, Gewicht, Ankerpunkt, **Lösewerkzeug** (Greifspinne / Schrottschere / Magnet / „Hand" = Klick-Interaktion `[V1]`), **Lösekraft-Schwelle**, optionale **Voraussetzungen** (andere Parts, die vorher entfernt sein müssen) und **Gefahren-Flag** (was passiert, wenn sie beim Pressen/Schreddern noch drin ist).
- **Herausreißen mit der Spinne `[MVP]`:** Spieler greift die Part (Highlight zeigt „greifbar als Baugruppe"), zieht dagegen; hält er die Zugrichtung 1,5 s (SW) über der Lösekraft-Schwelle, reißt die Part mit Ruck, Partikeln und Sound heraus und ist ab dann ein normales loses Schrottteil.
- **Voraussetzungen verletzt:** Die Part löst sich trotzdem (nach 3 s statt 1,5 s, SW), aber es gibt die definierte Konsequenz (Malus-Event, z. B. „Tank gerissen: Ölfleck, −80 €, SW").
- **Pressfreigabe:** Ein Verbundobjekt darf gepresst werden, sobald alle Parts mit Gefahren-Flag „Pressverbot" entfernt sind. Die Presse `[V1]` verweigert sonst mit Warnhinweis — wer per Einstellungs-Option „Warnungen aus" trotzdem presst, kassiert die volle Strafe.
- **Pressen:** Modell-Swap zu „Paket"-Modell (1 Objekt, Materialklasse = dominantes Material, Gewicht = Summe der Restparts), 1,5 s Pressanimation (SW).

*Fertig, wenn:* Ein neues Verbundobjekt (z. B. Waschmaschine) ist ausschließlich durch eine neue JSON-Definition + Modelle ins Spiel bringbar, ohne Codeänderung.

### 8.2 Beispiel Auto, vollständig durchdekliniert `[V1]`

Anlieferung „Altauto" (Karosse ~950 kg gesamt, SW). Empfohlene Reihenfolge = Reihenfolge der Tabelle; erlaubt ist jede, aber Verstöße kosten.

| Schritt | Baugruppe | Werkzeug | Voraussetzung | Erlös/Material | Bei falscher Reihenfolge / Fehlbehandlung |
|---|---|---|---|---|---|
| 1 | Starterbatterie (18 kg) | Spinne, Feingriff (Rotator senkrecht, nur 2 Finger-Animation) | Motorhaube ist bereits offen angeliefert (keine Öffnen-Mechanik im V1) | Blei-Batterie-Box, 0,45 €/kg | Beim Pressen noch drin: Säure-Event, −150 € (SW) + Container-Reinheit −20 % |
| 2 | Räder 4× (je 25 kg: Reifen + Alufelge) | Spinne: Abreißen je Rad | keine | Nach Trennung `[Später]` Felge=Alu; im V1 zählt das Rad als „Reifen mit Felge", Sammelfläche, ±0 € | Beim Pressen dran: Paket gilt als kontaminiert, Verkaufspreis −30 % (SW) |
| 3 | Tank (15 kg, Kunststoff) | Spinne, Herausreißen unter dem Heck | keine | Störstoff-Mulde | Reißt beim Motorziehen oder Pressen: „Kraftstoff-Leck", Ölfleck-Decal, −80 € (SW) |
| 4 | Katalysator (12 kg) | Schrottschere (Anbauwechsel, Kap. 10) | Fahrzeug aufgebockt (steht auf Zerlege-Podest, Zone Kap. 12) | Eigene Kat-Box, Festpreis 90 €/Stück (SW) — wertvollstes Einzelteil | Mit Spinne gerissen statt geschnitten: Kat beschädigt, nur 30 € |
| 5 | Kabelbaum (9 kg) | Spinne, Schüttgut-Griff nach Motorentnahme | Motor entfernt | Kabel-Box 1,60 €/kg | Vor Motorentnahme: nicht greifbar (verdeckt) |
| 6 | Motorblock (210 kg, Guss) mit Anbauteilen | Spinne, Herausreißen nach oben, Lösekraft hoch (2 s Ziehen, SW) | Batterie entfernt (sonst Funken-Event −40 €, SW) | Guss-Container; `[Später]` weiter zerlegbar (Alu-Anbauteile, Anlasser=E-Motor) | Beim Pressen noch drin: Paket unverkäuflich als Stahl, zählt als Mischschrott −40 % Erlös |
| 7 | Rest-Karosse (~650 kg) | Presse `[V1]` | Schritte 1, 3, 6 zwingend (Pressverbot-Flags); 2, 4, 5 nur wirtschaftlich sinnvoll | Gepresstes Paket → Stahl-Container, 0,18 €/kg Verkaufsbonus +20 % gegenüber loser Karosse (SW), weil Transport dicht | — |

*Fertig, wenn:* Ein Tester ohne Anleitung erkennt an Highlights + Tooltips die Zerlegereihenfolge, ein komplettes Auto dauert geübt 4–6 min und bringt korrekt zerlegt ca. 280–350 € (SW) mehr als sofortiges (verbotswidriges) Pressen.

---

## 9. Annahme, Wiegen & Sortierung

Ablauf einer Anlieferung `[MVP]` (Schritte mit ⛭ sind im MVP automatisiert, `[V1]` interaktiv):

1. **Ankündigung:** HUD-Hinweis „Anlieferung in 60 s" (SW) mit Kundentyp (Privat / Händler) und grober Ladungsangabe („Mischschrott, ca. 400 kg").
2. **Einfahrt & Erstwiegung:** Fahrzeug fährt auf die Brückenwaage, HUD zeigt Bruttogewicht. ⛭
3. **Abladen:** Kunde kippt/lädt auf die markierte Annahmefläche ab. Bei Anhängerkippern automatisch; `[V1]`: manche Kunden laden nicht selbst ab — der Spieler hebt die Ladung mit der Spinne von der Pritsche.
4. **Zweitwiegung:** Leergewicht → Netto-Anliefergewicht steht fest. ⛭
5. **Sichtprüfung & Sortierung:** Der Spieler sortiert den Haufen. **Erst durch korrektes Einsortieren wird Material „anerkannt"** — die Abrechnung basiert auf dem, was tatsächlich in Containern landet, nicht auf einer abstrakten Bewertung. Störstoffe in die Mulde = dem Kunden wird die Gebühr berechnet.
6. **Abrechnung:** Sobald die Annahmefläche leer ist (oder der Spieler „Abrechnen" drückt), erscheint der Beleg: Positionen je Material × Ankaufspreis, minus Störstoffgebühr. Spieler bestätigt, Geld fließt, Kunde fährt ab.
7. **Offene Reste:** Drückt der Spieler „Abrechnen" mit Restmaterial auf der Fläche, wird der Rest pauschal als Mischschrott zum niedrigsten Preis angekauft — schnell, aber unwirtschaftlich. Bewusster Trade-off.

**Verunreinigungsgrad `[V1]`:** Händler-Anlieferungen haben einen versteckten Störstoffanteil von 5–25 % (SW). Der Beleg weist ihn nach der Sortierung aus; ab 15 % (SW) kann der Spieler eine **Reklamation** auslösen: Pauschalabzug 10 % auf den Ankaufspreis (SW), kostet aber 1 Punkt Kundenzufriedenheit (Kap. 13).

**Betrugsversuche `[V1]`:** Selten (8 % der Händler-Anlieferungen, SW): wassergefüllte Hohlkörper (Gewicht passt nicht zur Größe — HUD-Gewicht beim Greifen entlarvt es), Messing als „Kupfer" deklariert, Beton im Gusskern (erkennbar erst beim `[Später]`-Shreddern, im V1 per Zufalls-Aufdeckung bei der Abrechnung mit Hinweistext). Aufgedeckter Betrug: Spieler wählt „durchgehen lassen" (Verlust) oder „konfrontieren" (voller Abzug, Kunde kommt nie wieder).

*Fertig, wenn:* Der komplette Ablauf 1–6 läuft ohne Menü-Zwischenschritt außer dem Beleg; die Belegsumme entspricht exakt der Summe der einsortierten Materialien laut Katalogpreisen.

---

## 10. Wirtschaftssystem & Progression

### 10.1 Rahmen `[MVP]`

| Posten | Wert (alle SW) |
|---|---|
| Startkapital | 5.000 € |
| Fixkosten je Spieltag | 150 € (Pacht, Strom, Diesel pauschal) |
| Anlieferungen je Tag | Tag 1–3: 2 · danach 3–4, skaliert mit Ausbaustufe |
| Ø Rohertrag je Misch-Anlieferung (400 kg), sauber sortiert | 60–120 € Marge (Verkauf minus Ankauf), plus Störstoffgebühren |
| Containerabholung | Spieler ruft Abnehmer, Abholung am Folgetag, Erlös = Inhalt × Verkaufspreis × Reinheit² |
| Marktpreise | Schwanken je Material ±15 % um den Basispreis: Sinus mit 7-Tage-Periode + Tagesrauschen ±5 %. Anzeige als Tagespreis-Tafel. Kupferpreis schwankt doppelt so stark — „heute Kupfercontainer verkaufen?" ist die tägliche Entscheidung |

### 10.2 Upgrade-Baum

| Upgrade | Preis (SW) | Effekt | Prio |
|---|---|---|---|
| 2. Container (Wahl der Fraktion) | 800 € | +1 Sortierziel | `[MVP]` |
| Sortiergreifer (schmale Spinne) | 1.500 € | Kleinteile-Griff +6 Objekte, Feingriff-Bonus: Kupfer/Kabel 15 % schneller greifbar | `[MVP]` |
| Waagen-Software | 900 € | HUD zeigt Materialverdacht schon beim Highlight (statt erst im Griff) | `[V1]` |
| Lasthebemagnet (Anbauwechsel) | 4.000 € | Hebt nur Eisenmetalle → Stahl/Guss aus Mischhaufen „herausmagnetisieren"; NE-Metalle bleiben liegen | `[V1]` |
| Zerlege-Podest | 2.500 € | Schaltet Auto-Annahme + Zerlegezone frei | `[V1]` |
| Schrottschere (Anbau) | 9.000 € | Kat-Ausbau, Karossen teilen, Träger ablängen | `[V1]` |
| Pkw-Presse (stationär) | 15.000 € | Pressen von Karossen/Weißware → +20 % Stahlerlös, Platz sparen | `[V1]` |
| Platzerweiterung Ost | 12.000 € | +40 % Fläche, +2 Containerplätze, Zerlegezone größer (Kap. 12) | `[V1]` |
| Genehmigung Gefahrstoffe | 6.000 € | Annahme Batterien/Akkus (hohe Margen, hohe Strafen) | `[V1]`/`[Später]` |
| Shredder | 40.000 € | Verbund-Kleinteile automatisch trennen | `[Später]` |
| Mitarbeiter (Sortierhelfer) | 80 €/Tag | Sortiert Kleinteile langsam automatisch | `[Später]` |
| 2. Bagger / größerer Bagger | 35.000 € | Mehr Traglast, schnellere Achsen | `[Später]` |

### 10.3 Balancing-Kurve — erste 5 Spielstunden (SW)

| Spielstunde | Spieltage | Ø Kontostand Ende | Erwartete Käufe | Neu erlebbar |
|---|---|---|---|---|
| 1 (Tutorial + Tag 1) | 1–2 | 5.300 € | — | Greifen, Sortieren, erste Abrechnung |
| 2 | 3–4 | 6.200 € | 2. Container, Sortiergreifer | Vier Fraktionen parallel, erste Containerabholung |
| 3 | 5–7 | 8.000 € | Waagen-Software oder Zerlege-Podest | Erste Händler-Anlieferung mit Störstoff-Trick |
| 4 | 8–10 | 10.500 € | Magnet ODER Podest (das jeweils andere) | Erstes Auto (falls Podest) bzw. Misch-Großlieferung (falls Magnet) |
| 5 | 11–13 | 13.000 € | Sparen auf Schere (9.000) sichtbar | Marktpreis-Spekulation mit vollem Kupfercontainer |

*Fertig, wenn:* Drei Testspieler landen nach 5 h jeweils zwischen 10.000 und 16.000 € — außerhalb wird nachbalanciert.

---

## 11. Aufträge & Spielmodi

| Modus | Beschreibung | Erfolg / Misserfolg | Prio |
|---|---|---|---|
| Tutorial | Geskriptete erste 10 min (Kap. 14): eine Mini-Anlieferung (3 Objekte), geführte Achsen-Einführung | Abgeschlossen, wenn alle 3 Objekte korrekt einsortiert; kein Scheitern möglich | `[MVP]` |
| Freies Spiel | Endloser Tagesrhythmus, Meta-Loop, keine Timer | Kein Game Over. Kontostand < 0 zwei Tage in Folge: „Kredit"-Event, Fixkosten +20 % bis getilgt (SW) | `[MVP]` |
| Tagesziele | Optionale Ziele je Tag („Heute 200 kg Alu sortenrein", „Reinheit aller Container ≥ 95 %"), Bonus 50–150 € (SW) | Ziel verfehlt = nur Bonus entgangen | `[V1]` |
| Kampagne | Kette von 15 Tagen (SW) mit Story-Häppchen (Platz vom Onkel geerbt), führt Mechaniken nacheinander ein, endet mit erstem Auto | Meilenstein-Sterne 1–3 je Tag nach Gewinn + Sortierquote | `[V1]` |
| Zeitdruck („Feierabend-Rush") | 10-min-Modus: maximaler Gewinn bis Ladenschluss, Highscore | Score = Gewinn; Bestenliste nur lokal | `[Später]` |

**Erfolgsmessung global:** Nach jedem Tag: Sortierquote (% korrekt einsortierte Masse), Gewinn, ø Kundenzufriedenheit. Diese drei Zahlen sind die KPI-Sprache des ganzen Spiels — jedes Feature zahlt auf mindestens eine ein.

---

## 12. Weltaufbau & Level

Ein einziger, persistenter Platz (kein Levelwechsel). Grundfläche Ausbaustufe A: **60 × 40 m (SW)**.

```
   ┌────────────────────────────────────────────────┐
   │  EINFAHRT → BRÜCKENWAAGE → ANNAHMEFLÄCHE       │   Kundenspur (Einbahn,
   │                     │                          │   Spline von Tor zu Tor)
   │   BÜRO/KASSE        ▼                          │
   │                CONTAINERZEILE                  │
   │   STAHL · GUSS · ALU · STÖRSTOFF · (Slots)     │
   │                                                │
   │   [Stufe B: ZERLEGE-PODEST + KAT/BATT-BOXEN]   │
   │   [Stufe B: PRESSE]     [Stufe C: OSTFLÄCHE]   │
   │  AUSFAHRT ← ABHOLZONE (Abnehmer-Lkw)           │
   └────────────────────────────────────────────────┘
```

| Zone | Funktion | Prio |
|---|---|---|
| Einfahrt/Tor + Kundenspur | Spawnpunkt Kundenfahrzeuge, Einbahn-Spline | `[MVP]` |
| Brückenwaage | Wiegen (Kap. 9), Anzeigetafel physisch in der Welt | `[MVP]` |
| Annahmefläche | 8 × 8 m markierte Fläche, hier landet Schüttung | `[MVP]` |
| Containerzeile | 4 Slots Stufe A (SW), je Slot 1 Container/Mulde/Box, Slots per Menü umwidmbar | `[MVP]` |
| Büro/Kasse | Statisches Gebäude; Abrechnungs-UI ist daran verankert (kein Innenraum) | `[MVP]` |
| Abholzone | Abnehmer-Lkw holt verkaufte Container | `[MVP]` (Lkw-Animation `[V1]`, MVP: Container blendet über Nacht aus) |
| Zerlege-Podest + Kleinboxen | Autos/Weißware aufgebockt zerlegen | `[V1]` |
| Presse | Stationäre Pkw-Presse | `[V1]` |
| Ostfläche (Stufe C) | +40 % Fläche, +2 Containerslots, Lagerhaufen erlaubt | `[V1]` |

**Laufwege/Fahrwege:** Der Bagger erreicht jede Zone; zwischen Containerzeile und Annahmefläche max. 15 m (SW), damit der Sekunden-Loop dicht bleibt. Ausbau verändert nie die gelernte Grundgeometrie — neue Zonen docken außen an.
*Fertig, wenn:* Vom Zentrum der Annahmefläche aus sind alle 4 Stufe-A-Container ohne Umsetzen des Fahrwerks erreichbar (nur Oberwagendrehung + Auslegerreichweite 9 m, SW).

---

## 13. NPCs & KI

| Element | Verhalten | Prio |
|---|---|---|
| Kundenfahrzeuge | 3 Typen: Pkw mit Anhänger (Privat, 100–300 kg), Transporter (Privat/Händler, 300–600 kg), Lkw-Kipper (Händler, 1–3 t, `[V1]`). Kinematisch auf Splines, keine Fahrphysik; ein Fahrzeug gleichzeitig auf dem Platz `[MVP]`, Warteschlange vor dem Tor `[V1]` (max 2 sichtbar) | `[MVP]` |
| Wegfindung | Keine echte — feste Spline-Routen Tor → Waage → Annahme → Waage → Tor. Bagger blockiert Route: Fahrzeug wartet, Hupe nach 10 s (SW) | `[MVP]` |
| Geduld | Geduldsbudget je Kunde: Privat 6 min, Händler 10 min (SW), läuft ab Abladen bis Abrechnung. Ablauf: Kunde nimmt „Pauschal-Abrechnung" (wie Kap. 9 Schritt 7, unwirtschaftlich für den Spieler) und fährt; kein harter Fail | `[MVP]` |
| Zufriedenheit | 1–5 Sterne je Kunde: schnelle Abrechnung +, faire Reklamation ±0, unnötige Reklamation −, Geduld abgelaufen −−. Platz-Ruf = gleitender Schnitt der letzten 10 Kunden | `[V1]` |
| Auswirkung Ruf | Ruf ≥ 4: +1 Anlieferung/Tag und bessere Ladungsqualität (weniger Störstoffe). Ruf ≤ 2: mehr Betrugsversuche, kleinere Ladungen | `[V1]` |
| Fußgänger-NPCs (Fahrer steigt aus, schaut zu) | Reine Deko, keine Interaktion, Kollisionskapsel damit die Spinne sie nicht greifen kann | `[Später]` |

*Fertig, wenn:* 20 Anlieferungen in Folge ohne Steckenbleiben eines Fahrzeugs; Geduldsablauf führt nachweislich zur Pauschal-Abrechnung statt zu einem Fehlerzustand.

---

## 14. UI, HUD & Steuerungs-Feedback

### 14.1 HUD-Elemente (In-Game)

| Element | Zweck | Position | Prio |
|---|---|---|---|
| Griff-Info | Beim Highlight/Griff: Materialname, Gewicht, Preis-Indikator (€-Symbole 1–4) | Mittig unter Fadenkreuz/Greifer | `[MVP]` |
| Container-Status | Je Container beim Anvisieren: Fraktion, Füllstand %, Reinheit % | Am Container (World-Space-Label) | `[MVP]` |
| Abwurf-Ampel | Grün/Gelb/Rot über anvisiertem Container (Kap. 5.3) | Am Container | `[MVP]` |
| Kontostand + Tagesgewinn-Ticker | Geldfeedback; Ticker zählt sichtbar hoch/runter | Oben rechts | `[MVP]` |
| Lastanzeige | Aktuelle Zuladung / Maxlast + Kipp-Warnsymbol ab 80 % Lastmoment | Unten links | `[MVP]` |
| Anlieferungs-Panel | Aktueller Kunde: Ladung, Restgeduld (dezenter Ring, kein Countdown-Stress), Beleg-Button | Oben links, einklappbar | `[MVP]` |
| Tagespreis-Tafel | Marktpreise, Abweichung vom Basispreis (▲▼) | Menü + physische Tafel am Büro | `[V1]` |
| Zerlege-Overlay | Bei Verbundobjekt im Fokus: Part-Highlights + Werkzeug-Icon + Reihenfolge-Hinweis | World-Space am Objekt | `[V1]` |
| Ziel-Tracker | Aktive Tagesziele mit Fortschritt | Rechts, einklappbar | `[V1]` |

### 14.2 Menüstruktur

Hauptmenü: Weiterspielen · Neues Spiel · (Kampagne `[V1]`) · Einstellungen · Beenden.
Pause/Platz-Menü (Tab): Übersicht (KPIs) · Upgrades kaufen · Container verwalten/verkaufen · Preistafel `[V1]` · Einstellungen.
Einstellungen `[MVP]`: Audio-Lautstärken (3 Slider), Greifmodus Halten/Toggle, Kameraempfindlichkeit, Sprache, Grafikstufe (2 Stufen: Normal/Sparsam).

### 14.3 Onboarding — die ersten 10 Minuten `[MVP]`

| Minute | Schritt | Vermittelt |
|---|---|---|
| 0–1 | Kalter Start in der Kabine, ein einzelner Stahlträger liegt vor dem Bagger. Prompt: „Q/E drehen, Maus senkt den Arm" | Oberwagen + Arm |
| 1–3 | „Greif den Träger" (LMB halten) → „Wirf ihn in den grauen Container" — Abwurf-Ampel wird erklärt | Sekunden-Loop komplett |
| 3–5 | Erste Mini-Anlieferung: Pkw-Anhänger kippt 5 Objekte (3 Stahl, 1 Kupferrohr, 1 Holzbalken). Griff-Info erklärt Materialerkennung: „Orange + schwer = Kupfer" | Materialdreiklang: sehen, wiegen, zuordnen |
| 5–8 | Störstoff: Holz in die Mulde → Beleg erscheint, Gebühr wird gezeigt: „Der Kunde zahlt DIR für Störstoffe" | Abrechnung + Gebührenlogik |
| 8–10 | Beleg bestätigen, Geld-Ticker, Tagesende-Bilanz. Ausblick-Karte: „Morgen: 2 Anlieferungen. Spare auf den 2. Container (800 €)" | Session- + Meta-Loop angeteasert |

*Fertig, wenn:* 3 von 4 Erst-Testern schließen das Onboarding ohne verbale Hilfe ab und können danach benennen, woran man Kupfer erkennt.

### 14.4 „Woran erkenne ich, was ich greife und ob ich richtig liege?"

Dreifach redundant `[MVP]`: (1) Farbe/Form des Objekts (Kap. 7/16), (2) Griff-Info mit Klartext-Materialnamen, (3) Abwurf-Ampel am Container. Farbe ist nie der einzige Kanal (Kap. 20).

---

## 15. Audio

| Kategorie | Inhalte | Prio |
|---|---|---|
| Bagger | Diesel-Loop (Last-abhängige Tonhöhe ±15 %, SW), Hydraulikzischen je Achse, Warnpiepser Rückwärtsfahrt, Kabinen-Dämpfung in Ego-Cam `[V1]` | `[MVP]` |
| Greifer/Material | Metallisches Greifen (3 Varianten nach Gewicht), Abwurf-Sounds je Materialklasse in Container (Blech-Scheppern, Guss-Wumms, Kabel-Rascheln, Kupfer-Klimpern) — der Abwurfsound ist Teil der Materialerkennung | `[MVP]` |
| Feedback/UI | Richtig-Sortiert-„Kaching" (dezent, SW: −6 dB unter Weltklang), Fehlwurf-Missklang, Beleg-Drucker, Geld-Ticker | `[MVP]` |
| Zerlegung | Reiß-Metallkreischen, Batterie-Klonk, Scheren-Schnitt, Pressen-Hydraulikstampf | `[V1]` |
| NPC/Welt | Motorgeräusche Kundenfahrzeuge, Hupe, Vogel-/Wind-Ambience (dünn, damit der Bagger Raum hat) | `[V1]` |
| Musik | Kein durchgehender Score. Ruhige Lo-Fi-/Country-blues-artige Loops nur im Menü + Tagesbilanz; In-Game default AUS, zuschaltbar | `[V1]` |

**Prinzip:** Audio ist der primäre Belohnungskanal. Jede korrekte Aktion hat einen eigenen, angenehmen Klang; Fehler klingen stumpf, nie schrill-bestrafend.
*Fertig, wenn:* Blindtest: Tester erkennt mit geschlossenen Augen am Abwurfsound, ob Stahl, Kabel oder Kupfer abgeworfen wurde.

---

## 16. Art Direction

| Aspekt | Festlegung |
|---|---|
| Stil | Stilisiertes Low-Poly mit Flat-Shading-Tendenz, weiche Kanten-Bevels an Hero-Objekten (Bagger). Keine Fotorealistik, keine Comic-Outlines. Vorbild-Lesbarkeit: Teardown/„tiny props"-Assets |
| Farbleitsystem | Die Welt (Boden, Gebäude, Himmel) ist bewusst entsättigt (Grau-, Sand-, Betontöne), damit **Materialfarben leuchten**: Kupfer #C7622B, Messing #C9A227, Alu #C4C8CC, Edelstahl #E8ECEF (mit Glanz-Highlight), Stahl/Rost #6E5A4E, Guss #3E4247, Kabel-Bunt, Störstoff-Braun #7A6A52, Gefahr-Rot #C0392B nur für Batterien/Akkus und Warnungen. Container tragen die Farbe ihrer Fraktion als breites Farbband + Piktogramm |
| Detailgrad | Bagger: ~15k Tris (SW), Hero-Asset mit beweglichen Teilen. Schrottteile: 50–800 Tris. Texturen fast nur Vertex-Colors + ein 2k-Atlas für Details (Rost-Decals, Aufkleber) |
| Tageszeit/Wetter | `[MVP]`: fester Spätvormittag, leicht bewölkt (weiches Licht, klare Farben). `[V1]`: Tagesverlauf (Morgen→Abend als Lichtstimmung, rein kosmetisch). `[Später]`: Regen |
| Referenzbild-Beschreibungen (für Asset-Erstellung) | (1) „Kleiner deutscher Schrottplatz, Sandboden mit Ölflecken, Betonwände mit Farbresten, blauer Fuchsbagger MHL-Klasse mit orangem Greifer" · (2) „Abrollcontainer in kräftigem Grau/Silber/Orange, seitlich großes Piktogramm, Low-Poly, sonnig" · (3) „Haufen Mischschrott: erkennbar Heizkörper, Fahrradrahmen, Rohre, Kabelknäuel — jedes Teil einzeln lesbar, keine Detailsoße" |

*Fertig, wenn:* Screenshot-Test aus 15 m Kameradistanz: 10 zufällige Schrottteile, Tester ordnet ≥ 8 davon der richtigen Fraktion zu, ohne HUD.

---

## 17. Technische Architektur

| Entscheidung | Wahl | Begründung (1 Satz) | Alternative |
|---|---|---|---|
| Sprache/Build | TypeScript + Vite | Typsicherheit für die Datenmodelle (Kap. 18) und schnelle Iteration im Browser, ideal für KI-Agent-Workflow | Plain JS (schneller, aber fehleranfälliger) |
| Engine/Renderer | Three.js (WebGL2) | Reine Code-Pipeline ohne Editor-Zwang, riesiges Ökosystem, läuft in Browser und WebView identisch | Godot 4 (stärkerer Editor, aber schlechterer Fit für agentengetriebene Entwicklung) |
| Physik | Rapier 3D (WASM) via `@dimforge/rapier3d-compat` | Schnellste stabile WASM-Physik mit Joints und Sleep-Kontrolle, deterministischer Fixed-Step | cannon-es (einfacher, aber langsamer und schlechter gewartet) |
| App-Verpackung | Capacitor 6 | Eine Codebasis für Web-Dev und Android-Store-Build, Zugriff auf native APIs (Datei, Haptik) | Tauri Mobile (leichter, aber Android-Support unreifer) |
| State | Eigene, klar geschnittene TS-Module + Event-Bus (typisierte Events) | Kein Framework-Ballast; Spiel-State ist ohnehin nicht React-förmig | Zustand/Redux (nur sinnvoll, falls UI in React — UI ist aber plain DOM) |
| UI | HTML/CSS-Overlay (plain DOM) über dem Canvas | HUD/Menüs in DOM sind schneller gebaut, lokalisierbar und barrierefreier als In-Canvas-UI | three-mesh-ui (nur für World-Space-Labels erwägen) |
| Persistenz | JSON-Savegame, `localStorage` (Web) / Capacitor Preferences+Filesystem (Android), Schema-Version im Save | Simpel, debugbar, migrierbar | IndexedDB (nötig erst bei Saves > 5 MB) |
| Assets | glTF (.glb) aus Blender, ein Ladepaket beim Start | Standardformat, Kompression via Meshopt | — |

### Projekt-/Ordnerstruktur (`prototype/`)

```
prototype/
  index.html
  src/
    main.ts              // Bootstrap, GameLoop (fixed physics step, render step)
    core/                // EventBus, Zeit, Save/Load, Settings, i18n
    physics/             // Rapier-Welt, GripSystem, Sleep-/Merge-Manager
    excavator/           // Achsen-Controller, Eingabe-Mapping, Kamerasystem
    world/               // Platz-Layout, Zonen, Container, Ausbaustufen
    materials/           // Materialkatalog (lädt data/), Reinheitslogik
    delivery/            // Kunden-Spawner, Splines, Waage, Abrechnung
    dismantle/           // Verbundobjekt-System (Kap. 8)
    economy/             // Konto, Marktpreise, Upgrades, Tagesbilanz
    ui/                  // DOM-HUD, Menüs, Onboarding-Sequencer
  data/                  // JSON: materials.json, composites/*.json, upgrades.json, prices.json
  assets/               -> ../assets (Symlink/Copy im Build)
  test/                 // Vitest: Ökonomie-Rechnungen, Reinheitsformel, Save-Migration
```

**Modulschnitt/Datenfluss:** Eingabe → `excavator` (setzt Achs-Sollwerte) → `physics` (Fixed Step, GripSystem erzeugt/löst Joints, meldet `ItemDropped(container, item)` auf den Event-Bus) → `materials` (Reinheit) & `economy` (Geld) reagieren nur auf Events → `ui` rendert aus State-Snapshots. Kein Modul greift in ein anderes hinein; Events sind die einzige Querverbindung.

**Build/Deploy:** `npm run dev` (Browser) · `npm run build && npx cap sync android && Gradle-Build` → signierte AAB für Google Play. GitHub-Repo + Actions-Build `[V1]`.

*Fertig, wenn:* `npm run dev` startet auf frischem Klon in < 2 min zum spielbaren Stand; der Android-Build-Prozess ist als Schrittliste in `docs/` dokumentiert und einmal erfolgreich durchlaufen.

---

## 18. Datenmodell

Zentrale Entitäten als kommentierte TypeScript-Typen (Quelle der Wahrheit; JSON in `data/` folgt diesen Formen):

```ts
/** Materialklasse — statische Katalogdaten (data/materials.json) */
interface MaterialClass {
  id: string;                 // "copper", "steel_mixed", ...
  name: LocalizedString;      // { de: "Kupfer", en: "Copper" }
  density: number;            // kg/dm³ — Masse = density × Volumen des Colliders
  buyPricePerKg: number;      // Basis-Ankauf €/kg (negativ = Spieler kassiert Gebühr)
  sellPricePerKg: number;     // Basis-Verkauf €/kg (negativ = Entsorgungskosten)
  priceVolatility: number;    // 0..1, Multiplikator auf die Marktschwankung (Kupfer: 1.0, Stahl: 0.4)
  targetContainerType: string;// Container-Typ-ID
  hazard: "none" | "acid" | "fire";  // steuert Fehlwurf-Strafen
  colorKey: string;           // Farbleitsystem-Schlüssel (Kap. 16)
}

/** Ein loses Schrottteil in der Welt */
interface ScrapItem {
  id: string;                 // Laufzeit-UUID
  materialId: string;         // -> MaterialClass
  massKg: number;
  meshId: string;             // Asset-Referenz
  state: "loose" | "gripped" | "contained" | "merged"; // merged = im Füllstand-Mesh aufgegangen
  containerId?: string;
}

/** Verbundobjekt-Definition (data/composites/car_sedan.json) */
interface CompositeDef {
  id: string;                 // "car_sedan"
  name: LocalizedString;
  baseMassKg: number;         // Restkörper nach Entfernen aller Parts
  baseMaterialId: string;     // Material des Restkörpers (z. B. "steel_mixed")
  pressable: boolean;
  parts: CompositePart[];
}
interface CompositePart {
  id: string;                 // "engine", "battery", ...
  materialId: string;
  massKg: number;
  tool: "grapple" | "shear" | "magnet" | "hand";
  tearHoldSeconds: number;    // wie lange über Schwellkraft ziehen (SW 1.5)
  requires: string[];         // Part-IDs, die vorher entfernt sein müssen
  pressBlock: boolean;        // true = Pressen verboten solange verbaut
  violation?: { penaltyEur: number; eventText: LocalizedString }; // Konsequenz bei Regelverstoß
}

/** Container/Box/Mulde auf dem Platz */
interface Container {
  id: string;
  typeId: string;             // "roll_off_large", "grid_box", ...
  slotId: string;             // Platz-Slot (Kap. 12)
  fractionMaterialIds: string[]; // akzeptierte Materialien (meist 1)
  capacityKg: number;
  contentKg: number;
  contaminationKg: number;    // Fremdmasse -> Reinheit = 1 - contaminationKg/contentKg
  mergedMeshLevel: number;    // Füllstand-Mesh-Stufe (0 = alles noch echte Items)
}

/** Kundenfahrzeug + Anlieferung */
interface Delivery {
  id: string;
  customerType: "private" | "dealer";
  vehicleType: "car_trailer" | "van" | "truck";
  declaredText: LocalizedString;      // "Mischschrott, ca. 400 kg"
  cargo: Array<{ materialId?: string; compositeId?: string; massKg: number; fraudFlag?: "waterfill" | "mislabel" | "hidden_core" }>;
  patienceSeconds: number;
  state: "announced" | "arriving" | "weigh_in" | "unloading" | "sorting" | "settled" | "departed";
  grossKg: number; tareKg: number;    // Wiegedaten
}

/** Auftrag/Tagesziel */
interface Contract {
  id: string;
  kind: "daily_goal" | "campaign_step";
  conditionText: LocalizedString;
  metric: "sorted_kg" | "purity_min" | "profit" | "dismantle_count";
  materialId?: string;
  targetValue: number;
  rewardEur: number;
  state: "active" | "done" | "missed";
}

/** Upgrade-Definition (data/upgrades.json) */
interface UpgradeDef {
  id: string;
  name: LocalizedString;
  priceEur: number;
  requires: string[];         // Upgrade-IDs als Voraussetzung
  effects: Record<string, number | boolean>; // z. B. { "grip.maxItems": 11, "zone.dismantle": true }
}

/** Spielstand — wird als JSON serialisiert, Schema-Version zwingend */
interface SaveGame {
  schemaVersion: number;      // Migrationspfad bei Updates
  createdAt: string; playedSeconds: number;
  day: number; moneyEur: number; reputation: number;   // 1..5
  ownedUpgrades: string[];
  containers: Container[];
  yardLevel: "A" | "B" | "C";
  marketSeed: number;         // deterministische Preis-Kurven
  looseItems: ScrapItem[];    // inkl. Transform (pos/rot), gedeckelt via Merge (Kap. 19)
  activeContracts: Contract[];
  stats: { totalSortedKg: number; sortAccuracy: number; customersServed: number };
}
```

*Fertig, wenn:* Ein Save aus Version N lädt in Version N+1 über eine Migrationsfunktion mit Test (Vitest) — von Anfang an, damit Store-Updates nie Spielstände fressen.

---

## 19. Performance-Budgets

| Budget | Desktop (Dev) | Android-Minimalgerät | Maßnahme bei Riss |
|---|---|---|---|
| Bildrate | 60 fps | ≥ 30 fps stabil (Ziel 60 auf Mittelklasse) | Grafikstufe „Sparsam": Schatten aus, Partikel halbiert, Pixel-Ratio 0,75 |
| Aktive (wache) Physikkörper | ≤ 120 | ≤ 60 (SW) | Aggressiveres Sleep (1,5 s statt 3 s Ruhe); Spawn-Drossel bei Anlieferungen |
| Rigidbodies gesamt in Szene | ≤ 400 | ≤ 250 (SW) | **Merge-Regel:** sortenreiner Containerinhalt ab 20 Objekten → statisches Füllstand-Mesh (nur oberste Lage bleibt echt); Störstoff-Mulde merged ab 10 |
| Dreiecke sichtbar | ≤ 500k | ≤ 250k | LOD ab 20 m (Schrottteile → Impostor-Low-Poly), Instancing für gleiche Kleinteile |
| Draw Calls | ≤ 300 | ≤ 150 | Material-Atlas, gemergte statische Platz-Geometrie |
| Texturspeicher | ≤ 256 MB | ≤ 128 MB | Ein 2k-Atlas + Vertex-Colors; keine 4k-Texturen im Projekt zulässig |
| Ladezeit Kaltstart | < 3 s | < 5 s | Ein gebündeltes glTF-Paket, Meshopt-Kompression, Preload-Screen mit Tipps |
| Save-Größe | < 1 MB | < 1 MB | Merge reduziert `looseItems`; Items in Containern nur als Aggregat gespeichert |

**Messpflicht:** FPS-/Body-Counter als Debug-Overlay (Taste F3) ab Meilenstein M0. Jeder Meilenstein wird auf dem Android-Minimalgerät gegengetestet, sobald der Capacitor-Build steht (M5), vorher via Chrome-CPU-Throttling 4×.

---

## 20. Barrierefreiheit & Lokalisierung

| Bereich | Maßnahme | Prio |
|---|---|---|
| Greifmodus | Halten ODER Toggle (Kap. 5) — motorische Entlastung | `[MVP]` |
| Farbfehlsichtigkeit | Farbe ist nie einziger Kanal: Container tragen Piktogramme + Text, Abwurf-Ampel hat Symbole (✓/!/✕), Griff-Info nennt Material im Klartext | `[MVP]` |
| Textgröße | UI-Skalierung 100/125/150 % | `[V1]` |
| Kamera | Empfindlichkeit + Achseninversion einstellbar; kein erzwungenes Kamera-Shake (Kipp-Warnung auch ohne Shake ablesbar), Shake abschaltbar | `[MVP]` |
| Zeitdruck | Kern-Spiel ohne Timer; Geduldssystem endet nie im Fail (Kap. 13) | `[MVP]` |
| Belegbare Tasten | Vollständiges Remapping | `[V1]` |
| Untertitel/Audio-Cues | Alle Audio-Feedbacks haben visuelles Pendant (Ticker, Ampel, HUD-Blitz) | `[MVP]` |
| Sprachen | i18n-Keys ab erster Codezeile (`LocalizedString`, Kap. 18). Deutsch `[MVP]`, Englisch `[V1]`, weitere `[Später]` | `[MVP]` |

*Fertig, wenn:* Ein kompletter Spieltag ist ohne Ton UND (separat) mit simulierter Deuteranopie (Chrome-DevTools-Filter) fehlerfrei spielbar.

---

## 21. MVP-Abgrenzung

*(Design-Pivot 2026-08-27: Zerstörung/Wrack-Handling rückt in den MVP, Wiege-/Beleg-Bürokratie rückt heraus. Container werden zu offenen Haufen-Zonen.)*

**Im ersten spielbaren Stand enthalten (Desktop-Browser, Tastatur+Maus):**

1. Bagger mit allen Achsen (Kap. 5.1), Orbit-, Draufsicht- + Kabinenkamera
2. Greifsystem inkl. Schüttgut-Griff, Fang-Griff (Auffangen im Fallen), Lastträgheit
3. **1 Auto-Wrack als Verbundobjekt:** greifbar (schwer!), Scheiben bersten, 3 Quetschstufen beim Aufprall, Räder/Motor abreißbar
4. Zerstörbare Props: Zaunfelder knicken um, Späne-/Funkenpartikel, Impact-Sounds je Material
5. 6 Materialklassen; **Haufen-Zonen statt Container** (+ 2 Kleinboxen für Kupfer/Kabel), vereinfachtes Reinheits-Bonus/Malus-System
6. Anlieferung light: Fahrzeug bringt Wrack/Mischschrott und kippt ab — ohne Waage/Beleg
7. Kontostand + Haufen-Verkauf (ein Knopf), Speichern/Laden
8. Onboarding-Sequenz (Kap. 14.3, angepasst: erstes Auto im Tutorial), HUD-Kernumfang
9. Audio-Kern: Bagger-Loop, Greif-/Abwurf-/Zerstörungs-Sounds, Feedback-Sounds
10. Debug-Overlay (F3) mit FPS/Body-Counter

**Bewusst NICHT enthalten (mit Ziel-Priorität):**

1. Brückenwaage, Beleg-Abrechnung, Verunreinigungs-Reklamation, Betrug `[V1]` — die Wirtschafts-Tiefe kommt nach dem Spaß-Kern
2. Touch-Steuerung und Android-Build `[V1]`
3. Gamepad `[V1]`
4. Messing, Edelstahl, E-Schrott, Batterien, Reifen `[V1]`; Akkus `[Später]`
5. Presse, Schere, Magnet, Zerlege-Podest als Anbaugeräte `[V1]` (MVP-Quetschen passiert über Aufprall/Fallenlassen)
6. Marktpreisschwankung (MVP: feste Preise) `[V1]`
7. Kundenzufriedenheit/Ruf, Geduldssystem `[V1]`
8. Kampagne, Tagesziele, Zeitdruck-Modus `[V1]`/`[Später]`
9. Upgrade-Baum voll (MVP: max. 2 Käufe), Platzerweiterung `[V1]`
10. Tagesrhythmus mit Fixkosten/Bilanz (MVP: nur Konto) `[V1]`
11. IK-Einsteigermodus, Auto-Nivellierung `[V1]`
12. Tagesverlauf/Wetter, Musik im Spiel `[V1]`/`[Später]`
13. Englisch + Remapping + UI-Skalierung `[V1]`
14. Freie Verformung à la Teardown — **nie**: Zerstörung ist stufen-/event-basiert (Quetschstufen, Modell-Swap, Partikel), keine Voxel-/Soft-Body-Simulation
15. Mehrspieler — **nie** (bewusster Ausschluss)
16. iOS-Release `[Später]` (abhängig von Mac-Verfügbarkeit)
17. Shredder, Mitarbeiter, 2. Bagger, Fußgänger-NPCs `[Später]`

---

## 22. Meilensteinplan

Annahme: 5–10 h/Woche, Umsetzung primär durch KI-Coding-Agent, du testest. Aufwände sind Netto-Arbeitsstunden (SW).

| # | Meilenstein | Inhalt | Fertig, wenn … | Aufwand |
|---|---|---|---|---|
| M0 | Technischer Prototyp | Vite+TS+Three+Rapier-Gerüst, Platz-Grundfläche, Bagger fährt/dreht/hebt, greift Testwürfel, Debug-Overlay | Ein Würfel kann gegriffen, 5 m getragen und abgelegt werden — 20× hintereinander ohne Physik-Fehler bei 60 fps Desktop | 25–35 h |
| M1 | Greif-&-Sortier-Kern | 6 Materialien mit Modellen, 4 Container, Reinheit, Griff-Info, Abwurf-Ampel, Kern-Sounds | 20-Objekte-Misch-Haufen ist in < 6 min sortierbar; Reinheits-/Geldanzeige rechnet korrekt (Vitest-geprüft) | 25–35 h |
| M2 | **Wrack-Slice** *(Design-Pivot)* | Auto-Verbundobjekt: greifbar mit spürbarem Gewicht, Scheiben bersten, 3 Quetschstufen bei hartem Aufprall, Räder/Motor abreißbar; **Haufen-Zonen ersetzen Container**; zerstörbare Props (Zaunfelder); Partikelsystem (Staub, Funken, Glas, Späne); Impact-/Kratz-Sounds; harter Bodenkontakt (Greifer versinkt nie) | Tester greift ein Auto (Achsen deutlich träger), lässt es aufs Dach fallen → Scheiben bersten + Quetschstufe sichtbar/hörbar, reißt den Motor heraus, wirft den Rest auf den Stahlhaufen — bei 60 fps Desktop | 30–45 h |
| M3 | Anlieferung light + Konto | Kundenfahrzeuge fahren **rückwärts** an (Kipper kippt physisch ab; **Pritsche/Tieflader: Spieler lädt selbst ab**, auch Wracks); Haufen-Verkauf schreibt Konto; **stationäre Presse mit Hubplatte** (drückt Teile + Karossen platt); Betonlego-Boxen für Guss/Alu; Schrottberge als Kulisse; Maschendraht-Bündel als Kehr-Werkzeug; Save/Load mit Migrationstest | Drei Anlieferungstypen in Folge fehlerfrei; Verkauf rechnet nach Katalogpreisen; Presse zerstört nichts (kein Physik-Explodieren); Speichern → Laden = identischer Zustand inkl. gepresster Teile | 15–25 h |
| M4 | MVP-Polish | Onboarding (erstes Auto im Tutorial), Einstellungen, Merge-/LOD-System, Audio-Vervollständigung, Balancing-Pass | Onboarding-Kriterium (Kap. 14.3) erfüllt; 30-min-Session ohne Absturz, ohne fps-Einbruch unter Budget | 20–30 h |
| **= MVP** | | | **Gesamt MVP** | **115–170 h ≈ 4–6 Monate** |
| M5 | Mobile-Slice | Touch-Steuerung (virtuelle Sticks), Capacitor-Android-Build, Grafikstufe Sparsam, Test auf Minimalgerät | Kompletter Spieltag auf dem Minimalgerät bei ≥ 30 fps per Touch spielbar; AAB baut reproduzierbar | 25–40 h |
| M6 | Wirtschafts-Tiefe | Brückenwaage, Beleg-Abrechnung, Geduld/Zufriedenheit, Marktpreise, Tagesziele, Upgrade-Baum, Zerlege-Podest/Presse/Schere als Anbaugeräte | Kap.-9-Ablauf komplett; Abnahmekriterium Kap. 8.2 (Zerlege-Reihenfolge wirtschaftlich relevant) erfüllt | 30–50 h |
| M7 | Store-Release V1 | Restlicher V1-Umfang (Kap. 21 Liste 2, Punkte 3–13), Play-Store-Listing, Datenschutz, Closed Test | Google-Play-Closed-Track mit 12 Testern, Crash-Rate < 1 %, danach Produktion | 30–50 h |

**Realitätscheck Umfang (ehrlich):** Der volle V1 aus diesem Dokument sind grob **190–295 Stunden** — bei 7–8 h/Woche also **8–12 Monate bis zum Store-Release**. Das ist für den beschriebenen Umfang realistisch, aber nur, weil das Auto-Zerlegen NICHT im MVP steckt und Mehrspieler/Wetter/Shredder konsequent draußen sind. Wächst der Wunschzettel, muss zuerst Liste 2 in Kap. 21 wachsen, nicht der Zeitplan.

---

## 23. Risiken & offene Punkte

| Risiko | Typ | Wahrscheinlichkeit | Gegenmaßnahme |
|---|---|---|---|
| Greif-Physik fühlt sich zittrig/instabil an | Technik | Mittel | Fixed-Joint-Ansatz (kein Reibungsgreifen), kinematischer Arm, M0-Abnahmekriterium erzwingt Stabilität vor allem weiteren Content |
| Mobile-Performance reißt Budget | Technik | Mittel-Hoch | Budgets ab Tag 1 (Kap. 19), Merge-System früh (M4, vor Mobile), Test auf echtem Minimalgerät in M5 statt am Ende |
| WebView-(Capacitor)-WebGL langsamer als Chrome | Technik | Mittel | Früher Capacitor-Testbuild in M5; Fallback: Grafikstufe Sparsam als Default auf Android |
| Sortieren trägt allein nicht genug Spielspaß bis das Auto kommt | Design | Mittel | M1-Testkriterium „5 min freiwillig weitersortieren" (Kap. 2); falls es scheitert: Zerlege-Slice vorziehen, Anlieferungsvielfalt kürzen |
| Steuerung überfordert Einsteiger | Design | Mittel | Onboarding-Abnahmetest mit echten Erst-Testern; IK-Einsteigermodus als V1-Sicherheitsnetz eingeplant |
| Scope Creep (Shredder, Wetter, 2. Bagger …) | Umfang | Hoch | Kap.-21-Regel: Neues kommt nur gegen Streichung; `[Später]`-Liste ist die einzige Tür |
| Solo-Entwickler-Ausfall/Motivationsloch | Umfang | Mittel | Meilensteine sind einzeln spielbar/vorzeigbar (jeder endet in etwas Testbarem), kein monatelanger Blindflug |
| Google-Play-Anforderungen (Data Safety, Target-API) ändern sich | Extern | Niedrig | Premium ohne Tracking minimiert die Angriffsfläche; Target-API-Check als fester Punkt in M7 |

**Getroffene Annahmen (ohne explizite Antwort des Auftraggebers):**

1. Kein Mac vorhanden → iOS ist `[Später]`; alle Store-Planung gilt Google Play.
2. Premium-Preis 4,99 € (SW) — bestätigt wurde nur „Premium", der Preis ist meine Setzung.
3. Technisches Vorwissen: wenig bis mittel; Umsetzung primär durch KI-Coding-Agent, Auftraggeber testet und entscheidet (aus Runde 1 „ok" übernommen).
4. Zeitbudget 5–10 h/Woche (aus Runde 1 „ok" übernommen).
5. Landscape-only auf Mobile; Portrait wird nicht unterstützt.
6. Deutsch zuerst, Englisch zum Store-Release — Zielmarkt-Priorität DACH.
7. Alle mit (SW) markierten Zahlen (Preise, Zeiten, Kräfte, Budgets) sind Startwerte meiner Wahl.
8. Der Bagger ist ein mobiler Umschlagbagger auf Rädern ohne Abstützungs-Simulation.
9. „Google App Store" wurde als Google Play Store interpretiert.
10. Keine echten Markennamen (Fuchs/Terex etc.) im Spiel — generisches Design, um Markenrechtsfragen zu vermeiden.
11. **Design-Pivot 2026-08-27** (Auftraggeber-Entscheidung nach M1-Playtest): Zerstörungs-Spaß und Masse-Gefühl vor Sortier-/Wirtschafts-Tiefe. Wracks + Haufen-Werfen in den MVP, Waage/Beleg/Geduld nach `[V1]` verschoben. Zerstörung bleibt stufen-/event-basiert (Quetschstufen, Partikel, Modell-Swap) — keine freie Verformung.

---

## 24. Glossar

| Begriff | Erklärung |
|---|---|
| Fuchsbagger | Umgangssprachlich für Umschlagbagger (nach Hersteller Fuchs): Bagger mit Hochkabine und weitem Ausleger, gebaut zum Material-Umschlagen statt Graben |
| Greifspinne / Polypgreifer | Mehrfinger-Greifwerkzeug (hier 5 Finger) für Schrott und Schüttgut |
| Rotator | Drehmotor zwischen Stiel und Greifer; lässt den Greifer endlos um die Hochachse drehen |
| Ausleger / Stiel | Die zwei Hauptarme des Baggers: Ausleger sitzt am Oberwagen, Stiel am Ausleger, Greifer am Stiel |
| Oberwagen | Drehbarer Aufbau des Baggers mit Kabine und Motor |
| NE-Metalle | Nichteisenmetalle (Alu, Kupfer, Messing …) — nicht magnetisch, deutlich wertvoller als Eisenschrott |
| Sortenrein | Eine Fraktion ohne Fremdanteile — Voraussetzung für den besten Verkaufspreis |
| Fraktion | Eine sortierte Materialgruppe (z. B. „Kupfer") |
| Störstoffe | Nicht verwertbare Fremdstoffe in der Anlieferung (Holz, Plastik, Beton) — kosten Entsorgung |
| Mischschrott (E3) | Unsortierter Eisen-Sammelschrott, niedrigste Stahlschrott-Güte |
| Guss | Gegossenes Eisen (Motorblöcke, Heizkörper); spröde, eigene Handelsklasse |
| V2A / Edelstahl | Rostfreier Stahl; wertvoller als normaler Stahl, magnetisch kaum/nicht |
| Kat / Katalysator | Abgasreiniger im Auto; enthält Edelmetalle, wertvollstes Einzelteil beim Auto |
| Brückenwaage | Fahrzeugwaage im Boden; Anlieferung = Bruttowiegung voll, Tarawiegung leer |
| Brutto / Tara / Netto | Gesamtgewicht / Leergewicht / Ladungsgewicht (Brutto − Tara) |
| Abrollcontainer / Mulde | Große Wechselbehälter für Schrottfraktionen bzw. offene Wanne für Störstoffe |
| Gitterbox | Kleiner Gitterbehälter für Kleinteile (Kabel, E-Schrott) |
| Verbundobjekt | (Spielbegriff, Kap. 8) Objekt aus zerlegbaren Baugruppen, datengetrieben definiert |
| Reinheit | (Spielbegriff) Anteil korrekten Materials in einem Container; bestimmt den Verkaufspreis |
| IK (Inverse Kinematik) | Technik, bei der Gelenkwinkel automatisch aus einer Zielposition berechnet werden (Einsteiger-Steuerung) |
| Fixed Joint | Physik-Verbindung, die zwei Körper starr aneinander koppelt (unser Greif-Mechanismus) |
| Sleep (Physik) | Ruhende Körper werden von der Simulation ausgenommen, bis sie berührt werden — spart Rechenzeit |
| AAB | Android App Bundle — das Dateiformat, das bei Google Play eingereicht wird |

---

## 25. Spielablauf und Wirtschaft (Fassung 29.08.2026)

Diese Fassung ersetzt die frühere Annahme, der Spieler sortiere durchgehend
mit. Der Rhythmus des Spiels entsteht stattdessen aus dem Wechsel von vollem
Platz und befriedigendem Leerräumen.

### 25.1 Der Zyklus

1. **Annahme.** LKW kommen, werden bei Mario gewogen und kippen auf dem
   Sammelplatz ab. Sortiert wird hier nicht — der Schrott darf fallen, wo er
   fällt. Nach der Leerwiegung bekommt der Kunde sein Geld.
2. **Feierabend an der Einfahrt.** Liegen rund 4,5 t lose auf dem Platz (oder
   sind fünf Fuhren durch), macht die Einfahrt zu. Bis zu zehn Minuten Ruhe.
3. **Sortieren.** Jetzt wird auf die Haufen und in die Boxen geworfen,
   Mischschrott und Alu gehen in die Schere und werden gepresst.
4. **Abholung.** Der Spieler ruft den Abhol-LKW und verlädt. Gepresste Pakete
   passen deutlich besser hinein. Erst wenn der LKW abgefahren ist, gibt es
   Geld — und zwar nach Sortenreinheit.
5. Sinkt der lose Schrott unter etwa 1,2 t, öffnet die Einfahrt wieder.

Die Buntmetallboxen (Alu, Kupfer, VA, Kabel) werden über zwei bis drei Zyklen
gefüllt. Erst dann lohnt der eigene, kleinere Sortenrein-LKW.

### 25.2 Upgrades

Verdientes Geld fließt in den Platz. Das Be- und Entladen selbst muss den Spaß
tragen; Upgrades sind das Sahnehäubchen, nicht der Antrieb.

| Upgrade | Wirkung |
| --- | --- |
| Bulldozer | Lambert schiebt loses Material zusammen und kehrt den Platz |
| Stapler | Lambert stapelt Karossen und räumt Kleinteile schneller |
| Magnet | Stahl lässt sich sauber vom Rest trennen, höhere Reinheit |
| Bagger-Ausbau | größere Spinne, schnellere Hydraulik, mehr Reichweite |
| Zweite Box | mehr Fraktionen parallel sammeln |
| Größere Presse | schwerere Pakete, mehr Ladung pro Abholung |

### 25.3 Kundschaft

Drei Gruppen, die sich im Auftreten und beim Verhandeln unterscheiden:

- **Privatleute** — PKW mit Anhänger, kleine Mengen, kennen die Preise nicht.
  Lassen sich drücken, nehmen es aber übel, wenn man es übertreibt.
- **Gewerbekunden** — feste Pritschen, regelmäßig. Der Preis ist zweitrangig,
  entscheidend ist, dass es reibungslos läuft: kurze Standzeit, keine
  Wartezeit an der Waage. Sachlicher Ton.
- **Schrotthändler** — ein Familienclan im Reisegewerbe, die Namen Boxbücher,
  Schmitz, Hart, Zölzer und Prison. Kennen die Tagespreise genau, verhandeln
  hart und lautstark, lassen sich nicht drücken. Gelegentlich ist ein Auto
  dabei, das schnell weg soll — wer zugreift, verdient gut und geht ein
  Risiko ein.

Jede Gruppe bekommt eigene Sprachbausteine bei Ankunft, Verhandlung und
Abfahrt. Der Ton macht die Persönlichkeit, nicht der Umfang des Textes.

### 25.4 MVP für den Store

Für die erste Fassung im Play Store reicht: der Zyklus aus 25.1, drei bis vier
Upgrades, die drei Kundengruppen mit Textsprüchen (noch ohne Sprachausgabe),
Speichern, Pausenmenü und eine geführte erste Viertelstunde. Alles Weitere ist
Nachschub für spätere Fassungen.

---

## 26. Kundschaft und Persönlichkeit (Fassung 02.09.2026)

### 26.1 Der Spieler: Daniel

Sohn von Lambert und Margarete, beide aus den Händlerfamilien Bähring und
Prieser. Baggerfahrer und Platzchef in einer Person: charmant, ruhig, etwas
verschlafen, kennt jeden Preis und jeden Trick. Lässt sich nicht drängen,
trinkt gern Kaffee und hört Musik. Im Spiel kommentiert er Ereignisse in
kurzen Textblasen von zwei bis acht Wörtern.

Stufen: stumm im MVP · Textblasen in V1 · Sprachausgabe später.

### 26.2 Die drei Kundengruppen

| | Privatleute | Schrotthändler | Gewerbe |
| --- | --- | --- | --- |
| Auftreten | wechselnd, generiert | Stammfiguren mit Namen | Stammkunden (Betriebe) |
| Menge | 50–800 kg | 3–20 t | 1–15 t |
| Material | Mischschrott, Haushaltsauflösung | alles | sortenrein je Branche |
| Fahrzeug | PKW mit Anhänger, Kombi | Kipper, Pritsche, Abschlepper | Kipper, Mulde, Sattelzug |
| Preiswissen | keins — vertrauen dir | kennen jeden Preis | kennen Marktnotierungen |
| Verhandlung | akzeptieren fast alles | drücken hart zurück | sachlich, wenig Spielraum |
| Gedächtnis | grob (fair / unfair) | lang und nachtragend | Zuverlässigkeits-Score |
| Besonderheit | bringen unwissentlich Störstoff | gelegentlich graue Ware | verlangen korrekte Wiegescheine |

### 26.3 Die Händlerfamilien

Wiederkehrende Stammfiguren, die sich untereinander kennen: **Bäring,
Lorsbach, Prieser, Hardwig, Boxmann, Zöllner, Adorf, Schmikatz.**

Je Figur zu briefen: Vorname, Alter, Fahrzeug, typisches Material,
Verhandlungsstil (1–5 hart), Marotte, Verhältnis zu den anderen Familien,
Standardsätze und Beziehung zu Daniel. Gesetzt sind bisher die Familiennamen;
Vornamen und Sprüche in `customers.ts` sind eine Erstfassung zum Überschreiben.

### 26.4 Gewerbekunden nach Branche

| Branche | Material | Besonderheit |
| --- | --- | --- |
| Gießerei | Guss, Schlacke | Schlacke ist geringwertiger Beifang |
| Fräserei/Dreherei | Späne (Stahl, Alu) | ölig, hohe Schüttdichte, sortenrein |
| Maschinenbau | Stahl, Elektromotoren | große, sperrige Teile |
| Kfz-Werkstatt | Katalysatoren, Alufelgen, Akkus | kleine Menge, hoher Wert |
| Autohändler | Unfallwagen | Stückgeschäft, Papiere sauber |
| Elektrobetrieb | Kabel, Schaltschränke | Kupferanteil variiert stark |
| Schlosserei | Edelstahl V2A, Baustahl | sauber getrennt, guter Kunde |
| Abriss | Mischschrott, Heizkörper, Rohre | große Mengen, viel Störstoff |

### 26.5 Ruf

| Verhalten | Privat | Händler | Gewerbe |
| --- | --- | --- | --- |
| Faire Preise zahlen | ++ | + | 0 |
| Hart drücken | −− | − | 0 |
| Graue Ware annehmen | 0 | ++ | −− (falls bekannt) |
| Graue Ware ablehnen | 0 | − | + |
| Kontrolle mit Fund | − | + | −− |
| Pünktlich, saubere Papiere | + | 0 | ++ |

Der Ruf steuert Anlieferfrequenz, Materialqualität und Verhandlungsspielraum —
nie, ob man gewinnt. Er versiegt nie ganz, sonst spielt sich das Spiel in eine
Sackgasse.

### 26.6 Graue Geschäfte [V1]

Ware mit unklarer Herkunft wird nie offen angesprochen; der Kunde signalisiert
sie über den Wortlaut, und der Spieler muss zuhören — „Das Kupfer ist noch
warm", „Ohne Zettel, ja?", „Der Onkel schaut nachher vorbei". Annehmen bringt
Marge und Ansehen bei den Händlern, dazu Timer und Kontrollrisiko. Ablehnen ist
sicher, aber die Händler merken es sich. **Beide Wege sind gültig — das Spiel
urteilt nicht.**

**Ton-Leitplanke (verbindlich):** Das Milieu entsteht aus Beruf, Familien und
Geschäft — nie aus Herkunft oder Ethnie. Keine Gruppe wird als kriminell
markiert. Das hält den Ton glaubwürdig und jede Store-Prüfung sauber.

### 26.7 Offen für das Charakter-Briefing

Vornamen, Alter und Persönlichkeit je Familienmitglied · Fehden der Familien
untereinander · Willis Vorgeschichte und Sprechstil · drei bis fünf
Standardsätze je Figur · Namen der Gewerbe-Stammkunden · Erweiterung der
Geheimsprache auf zwölf bis fünfzehn Wendungen · Startbestand (Empfehlung:
sieben Händler, sechs Gewerbe, generierte Privatleute).
