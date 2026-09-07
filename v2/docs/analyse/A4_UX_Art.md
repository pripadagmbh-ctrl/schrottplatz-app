# Review: Art Direction / UX (Touch, HUD, Lesbarkeit, Onboarding)

Rolle: Art-Director / UX · Stand: 2026-09-02 · Code READ-ONLY unter `/home/claude/sp/proto`

**Was ich geprüft habe:** vollständig gelesen `prototype/src/core/touch.ts`, `core/input.ts`, `core/controlConfig.ts`, `excavator/orbitCamera.ts`, `excavator/driver.ts`, `ui/hud.ts`, `ui/tutorial.ts`, `main.ts`, `world/scrapItems.ts`, `materials/catalog.ts`, `prototype/index.html`; auszugsweise `excavator/excavator.ts` (Eingabe-Verarbeitung Z. 987–1110, Kamera-Ziel Z. 1576–1588), `world/containers.ts` (Labels/Ampel Z. 334–398), `world/yard.ts`, `delivery/vehicles.ts`, `delivery/routes.ts`, `economy/shift.ts`, `economy/account.ts`, `physics/gripSystem.ts` (nur Konstanten); dazu `docs/02_Briefing.md` Kap. 3, 5, 14, 16, 20 und `docs/Pruefung/02_Schwachstellen.md`. Farbabstände habe ich rechnerisch bestimmt (CIE-Lab, ΔE76) – kein Screenshot-Test.

**Was ich NICHT prüfen konnte:** Ich hatte kein Gerät und keinen laufenden Browser. Alles zu Daumenreichweite, tatsächlicher Bildwirkung, Bildrate und Haptik ist aus Code und CSS-Maßen **abgeleitet**, nicht erlebt. Jede Aussage ist unten als BELEGT (im Code gesehen) oder VERMUTUNG (fachliche Einschätzung) markiert.

Kurz erklärt, weil es öfter vorkommt: *Achse* = ein stufenloser Steuerbefehl (z. B. „Ausleger heben/senken"); *Stick* = das virtuelle Steuerkreuz auf dem Bildschirm; *Safe-Area* = der Bereich des Handy-Displays, der nicht von Kamera-Loch/Rundung/Geste-Balken verdeckt wird; *Tippziel* = die berührbare Fläche eines Knopfes; *ΔE* = Maß für Farbunterschied, unter ~10 sehen Laien zwei Farben aus der Distanz als „gleich".

---

## 0. Zusammenfassung (Top-Befunde, nach Auswirkung auf den Store-Release)

| # | Befund | Schwere | Status |
|---|---|---|---|
| 1 | **Auf Touch gibt es keine Kamerasteuerung.** Orbit-Kamera dreht nur mit mittlerer Maustaste; Ansichtswechsel nur per Doppeltipp. Die Kamera folgt weder dem Oberwagen noch dem Greifer. Wer den Oberwagen zur Kamera dreht, arbeitet blind hinter der Kabine. | hoch | BELEGT |
| 2 | **Sieben simultane Achsen + 17 Funktionen** auf zwei Sticks, einem 4-Tasten-Kreuz, zwei Rotator-Tasten und einer 11-Einträge-Drehwalze. Fahren belegt bis zu drei zusätzliche Finger. Für einen „Feierabend-Sortierer" (GDD Kap. 3) zu viel; die im GDD geplanten Assistenzen (Auto-Nivellierung, IK-Zielmodus, Kamera-Nachschwenken) fehlen alle. | hoch | BELEGT (Achsen) / VERMUTUNG (Überforderung) |
| 3 | **Materialfarben sind auf dem Handy nicht in 1 s unterscheidbar.** Stahl ↔ Störstoff ΔE 9, Alu ↔ Edelstahl ΔE 10,5, Kupfer ↔ Kabel ΔE 13; Stahl liegt farblich auf dem Boden (ΔE 6 zur Fahrspur). Kein Outline, kein Icon, Highlight nur als kaum sichtbares Emissive 0x2a2a1a. | hoch | BELEGT (Werte) / VERMUTUNG (Wirkung) |
| 4 | **Tippziele unter 44 px:** Fahrkreuz 46×42 px (Handy: 40×36), Walzeneinträge 30 px hoch (Handy: 26 px, Schrift 10 px), Tutorial-„überspringen" ≈ 20 px hoch. Pause liegt in der Walze und muss erst „hingescrollt" werden. | mittel–hoch | BELEGT |
| 5 | **Kein Landscape-Lock, keine Safe-Area, Manifest und Icon fehlen im Repo.** `viewport-fit=cover` ist gesetzt, aber kein einziges `env(safe-area-inset-*)`; `manifest.webmanifest`/`icon-192.png` werden referenziert, existieren aber nicht. | mittel | BELEGT |
| 6 | **Dialoge (Verhandeln/Abholung/Ausbau) sind jetzt gestylt** – der Punkt 7 aus `02_Schwachstellen.md` ist behoben. Aber: Verhandlung läuft ohne Pause, hat keinen Abbrechen-Knopf und schließt sich per Timeout von selbst. | niedrig (behoben) / mittel (Rest) | BELEGT |
| 7 | **Erste 60 Sekunden ohne Erfolgsmoment:** Startkapital 5000 € *sinkt* zuerst (Ankauf), Geld kommt erst nach V → Fraktion wählen → beladen → V → LKW-Abfahrt. Tutorial-Karte nennt Tastaturtasten (B, V, „Taste G"), die es auf Touch nicht gibt und die zum Teil falsch sind (Ausbau liegt auf Z). Schritt 1 („dreh den Oberwagen herum") prüft nichts, sondern läuft nach 12 s einfach weiter. | hoch | BELEGT |
| 8 | **Look ist konsistent prozedural, aber ohne Stilentscheidung:** Standard-PBR, keine Outline, kein Tone-Mapping, kein Post-Processing, Systemschrift Consolas im HUD, kein einziges Bild/Modell/Sound-Asset im Repo (`assets/` enthält nur eine README). Für einen Store-Auftritt (Screenshots, Icon, Feature-Grafik) fehlt schlicht das Material. | mittel | BELEGT |

Fazit vorab: Die Touch-Steuerung ist **technisch sauber gebaut** (Pointer-Capture, Deadzones, Haptik, Zoom-Sperren – `touch.ts` ist gute Arbeit), aber sie bildet das **Desktop-Schema 1:1 auf das Handy ab**, statt das Spiel für den Daumen umzudenken. Das ist der eigentliche UX-Befund.

---

## 1. Touch-Steuerung

### 1.1 Achsen-Inventar (BELEGT)

Was der Spieler *gleichzeitig* stufenlos steuern kann, `touch.ts:15–25` (`TouchAxes`) und `excavator.ts:1033–1099`:

| Achse | Touch-Belegung (Werkseinstellung) | Quelle |
|---|---|---|
| Fahren vor/zurück | Fahrkreuz ▲▼ (Halten) oder Kippsensor | `touch.ts:83–84, 491–492` |
| Lenken | Fahrkreuz ◀▶ (Halten) oder Kippsensor | `touch.ts:85–86, 493–494` |
| Oberwagen drehen | linker Stick X | `controlConfig.ts:48` |
| Hauptarm heben/senken | linker Stick Y | `controlConfig.ts:47` |
| Stiel (hier „Ausleger") heran/weg | rechter Stick Y | `controlConfig.ts:49` |
| Spinne öffnen/schließen | rechter Stick X (Deadzone 0,38, quergedämpft) | `controlConfig.ts:50`, `touch.ts:42, 468–479` |
| Rotator drehen | Tasten ↺ ↻ (Halten) | `touch.ts:87–88, 488–490` |
| Greifen (Alternative) | Druckstärke ≥ 0,55 auf der Leinwand – nur auf Geräten mit Kraftsensor | `touch.ts:38, 407–430` |
| Kamera drehen/zoomen | **nicht möglich** auf Touch (nur MMB/Shift+Rad, `input.ts:43–62`) | `orbitCamera.ts:76–80` |
| Ansicht wechseln | Doppeltipp auf die Leinwand (4 Modi zyklisch) | `touch.ts:414–423`, `orbitCamera.ts:37–46` |

Dazu **11 diskrete Funktionen** in der Drehwalze `#fnbar` (`index.html:339–351`): Kabine, Stützen, Schere, Abholen, Kippen, Schilder, Schild, Vorfahren, Ausbau, Musik, Pause.

**Zählung:** 7 stufenlose Achsen + Greifen + Rotator + 11 Funktionen + Kamera-Modus = **21 Bedienelemente**. Zum Vergleich: ein Xbox-Controller hat 4 Stick-Achsen, 2 Trigger, 2 Bumper, 4 Face-Buttons, D-Pad – und das ist bereits das obere Ende dessen, was Gelegenheitsspieler akzeptieren.

### 1.2 Ist das auf 6 Zoll quer mit zwei Daumen bedienbar? (VERMUTUNG, aus Maßen abgeleitet)

Layout auf einem Handy (Media Query `max-height: 430px`, `index.html:120–146`; das greift bei praktisch jedem Handy quer, z. B. Pixel 7 = 412 CSS-px hoch):

- Linker Stick: 108 px Ø, links unten (`:121–123`).
- Fahrkreuz: vier Tasten 40×36 px, **rechts neben dem linken Stick** bei x = 128…256 px (`:125–129`). Das heißt: Fahren und Lenken erfordern den **linken Daumen**, der gleichzeitig Oberwagen + Hauptarm hält – oder einen dritten Finger (Zeigefinger von oben über das Display). Beim Fahren mit Kurve (▲ + ◀) sind es zwei Finger allein für das Kreuz.
- Rechter Stick: 108 px Ø, rechts unten; Rotator-Tasten 46×40 px **links neben** dem rechten Stick (`:131–133`). Gleiches Problem gespiegelt: Rotator drehen *während* man Stiel/Spinne führt braucht einen dritten Finger.
- Walze: 88×176 px am rechten Rand, vertikal zentriert (`:135`). Sie liegt direkt über dem rechten Stick; ein Wischen nach unten, das minimal zu tief ansetzt, trifft den Stick.

**Ergonomie-Einschätzung:** Die zwei Sticks selbst sind gut erreichbar. Aber alles, was *zusätzlich* zu den Sticks gehalten werden muss (Fahren, Lenken, Rotator), liegt in der Mitte des Displays, wo die Daumen im Landscape-Griff nicht sind. Auf einem 6-Zoll-Gerät (≈ 13 cm breit) sind 128–256 px vom linken Rand knapp außerhalb des bequemen Daumenbogens, wenn der Daumen gleichzeitig den Stick am Rand hält.

Der Kippsensor (`touch.ts:366–401`) ist die Antwort des Codes darauf – Fahren durch Neigen. Das ist ein bekannter Kompromiss, aber: er muss erst in der Walze aktiviert werden, kippt das Gerät um den Sichtwinkel (Kalibrierung auf β = 45°, `:398` fest verdrahtet, nicht auf die Haltung beim Einschalten), und in einer Bagger-Sim, in der man 90 % der Zeit *nicht* fährt, stört ein dauerhaft aktiver Neigungssensor eher.

### 1.3 Vergleich mit etablierten Mobile-Steuerungen (VERMUTUNG, Branchenwissen)

| Titel / Muster | Wie sie das Problem lösen |
|---|---|
| **Construction Simulator (astragon, Mobile)** | Zwei Sticks für die Arbeitsachsen, **Moduswechsel Fahren ↔ Arbeiten** über einen großen Knopf; im Fahrmodus werden dieselben Sticks zu Gas/Lenkung. Kamera: freies Wischen auf der leeren Fläche. Nie mehr als zwei Daumen gleichzeitig. |
| **Heavy Excavator Simulator / Excavator Sim 2023 (diverse)** | Meist links Fahren, rechts Arm, Greifer als **großer runder Knopf** über dem rechten Stick (Halten oder Toggle). Rotator selten als Achse; wenn, dann zwei Buttons neben dem Greif-Knopf. |
| **Hydroneer, PowerWash, Sortier-Casuals** | Kamera folgt automatisch dem Werkzeug; Ziel-Snap („der Greifer fängt, wenn nah genug"). |
| **Ihr eigenes GDD Kap. 5.1** | Sah genau das vor: „Fahr-Modus-Toggle + linker Stick" und „Großer Greif-Button rechts unten", Rotator als „zwei kleine Pfeil-Buttons über Greif-Button". Der Code ist davon abgewichen (Design 29.08., `touch.ts:2–11`): Greifen auf die Stick-X-Achse, Fahren aufs Kreuz. |

Die GDD-Fassung war ergonomisch die bessere. Greifen auf einer Stick-Querachse ist der riskanteste Punkt: Die Deadzone von 0,38 und die 50 %-Querdämpfung (`touch.ts:474–477`) zeigen, dass Fehlauslösungen ein reales Problem waren – man hat das Symptom behandelt statt die Belegung. Nebenwirkung: Wer den Stiel voll auszieht, kann die Spinne nur noch halb so schnell schließen.

### 1.4 Wo Überforderung droht, wo Assistenz fehlt

| Stelle | Befund | Beleg |
|---|---|---|
| **Kamera** | Kein Wischen zum Drehen, kein Zoom, kein Nachführen auf den Greifer. Kameraziel ist der Unterwagen + 2,6 m (`excavator.ts:1577`), Yaw fest π. Dreht der Oberwagen um 180°, steht die Kabine zwischen Kamera und Greifer. GDD 5.2 verspricht „rechter Touch-Wisch dreht" und „automatisches Nachschwenken auf den Greifer" – beides fehlt. | `orbitCamera.ts:76–77`, `input.ts:48–53` |
| **Tiefenwahrnehmung** | Aus der Standard-Orbit-Sicht von hinten ist der Abstand Greifer→Boden schwer zu schätzen. Ein Bodenschatten hilft (Shadows an, `main.ts:55`), aber es gibt keinen Zielkreis/Bodenmarker unter der Spinne. Die Seitenansicht (`orbitCamera.ts:89–97`) ist die Krücke dafür – 4 Doppeltipps entfernt. | – |
| **Auto-Nivellierung** | Nicht vorhanden; im GDD 5.3 als [V1]. Da die Spinne ohnehin lotrecht hängt (`excavator.ts:88` „hängt lotrecht"), ist das hier weniger dringend als beim Löffelbagger. OK. | – |
| **Griff-Hilfe** | Vorhanden: Highlight + HUD-Text ab 1,2 m (`main.ts:802–804`), aber das Highlight ist ein Emissive von 0x2a2a1a (`scrapItems.ts:650`) – auf einem hellen, sonnigen Handy-Display faktisch unsichtbar (VERMUTUNG). Kein Outline, kein Bodenring. | `scrapItems.ts:646–652` |
| **Snap auf Ziele / IK-Modus** | Nicht vorhanden. GDD 5.3 [V1] „Einsteiger-Modus: nur Zielpunkt bewegen, Arm folgt per IK". Für Touch wäre das die *wichtigste* Assistenz, weil sie 3 Achsen auf einen Stick reduziert. | – |
| **Greif-Toggle** | GDD Kap. 5/20 sieht Halten ODER Toggle vor (Barrierefreiheit). Touch-Stick-Modus ist de facto ein Toggle (neutral = halten, `excavator.ts:1090–1091`), Tastatur ist Halten. Keine Einstellung dafür. | `excavator.ts:1083–1095` |
| **Steuerungsmenü** | Vier Achsen frei belegbar mit Invertierung – gut. Aber keine Stick-Größe, keine Position (links-/rechtshändig), keine Empfindlichkeit, kein Deadzone-Regler. | `index.html:366–394`, `main.ts:272–319` |
| **Belastung beim Beladen** | Der Kernloop (greifen → schwenken → über Mulde → öffnen) braucht linker Stick X+Y, rechter Stick Y und rechter Stick X nacheinander: machbar. Der Loop „Abholung": Walze scrollen → ABHOLEN tippen → Dialog → beladen → Walze scrollen → ABHOLEN. Zwei Walzen-Fahrten für einen Vorgang. | `main.ts:719–728` |

---

## 2. HUD / UI

### 2.1 Lesbarkeit auf kleinem Display (BELEGT aus CSS)

- Grundschrift 13 px Consolas (`index.html:38`), auf dem Handy 11–12 px (`:142–145`). Consolas ist eine Windows-Schrift; auf Android fällt sie auf `monospace` (Droid Sans Mono) zurück – die Optik ändert sich zwischen Dev-Rechner und Gerät. 11 px Monospace auf 412 px Bildhöhe ist unter der Lesbarkeitsschwelle für Gelegenheitsspieler (Faustregel Android: ≥ 12 sp für Nebentext, ≥ 14 sp für Inhalte).
- Die Griff-Info (`#gripinfo`) ist die wichtigste Zeile im Spiel („▼ Aluminium · 12 kg · €€"), steht unten mittig, 12 px, `white-space` nicht gesetzt → beim Tragen mehrerer Fraktionen wird sie mehrzeilig (`hud.ts:33–41`) und rückt vor die Sticks.
- Kontostand und Schicht oben links, 12/11 px, mit `Konto: 5000 € · Haufen ≈ 1234 €` – zwei Zahlen ohne Hierarchie. Der Ticker (`hud.ts:60–64`) ist ein weicher Lerp, aber ohne Farbblitz/Plus-Anzeige beim Zuwachs – das „Geld-Feedback" aus GDD 14.1 ist nur ein sich ändernder Text.
- Toasts (`hud.ts:100–106`) stapeln nicht: Ein neuer Toast überschreibt den alten sofort. In der Anlieferungs-Sequenz feuern in kurzer Folge Begrüßung, Waage, Verhandlungs-Antwort, Fahrspur-Warnung (`main.ts:546–606, 829`) – der Spieler liest davon vermutlich zwei.
- Container-Labels sind Canvas-Sprites 256×128 px mit 24–30 px Schrift (`containers.ts:341, 385–392`), Skalierung 2,3 m Weltbreite, ausgeblendet unter 4,5 m und über 38 m (`:358–365`). Aus der Draufsicht (25 m Höhe) sind sie bei 2,3 m Weltbreite auf einem Handy ~35 px breit – die Aufschrift „KUPFER/MS" ist dann nicht mehr lesbar (VERMUTUNG, Rechnung: 55° FOV, 25 m Abstand → ~0,9 Weltmeter/… ≈ 15 px/m auf 412 px Höhe).

### 2.2 Tippziele ≥ 44 px? (BELEGT)

| Element | Maß Desktop-Touch | Maß Handy (≤ 430 px) | Urteil |
|---|---|---|---|
| Stick-Pad | 138 Ø | 108 Ø | gut |
| Fahrkreuz-Taste | 46 × 42 | 40 × 36 | zu klein, und Halten-Taste |
| Rotator ↺ ↻ | 56 × 46 | 46 × 40 | grenzwertig |
| Walzen-Eintrag | 96 × 30 (nur der mittlere tippbar) | 80 × 26, Schrift 10 px | zu klein |
| Tutorial „überspringen" | ~60 × 20 (11 px Schrift, 3 px Padding) | gleich | zu klein |
| Dialog-Buttons | 100 % × ~44 | gleich | gut |
| Pause-Buttons | 100 % × ~46 | ~38 | knapp |
| Steuerungsmenü `select` | ~32 hoch | ~26 | zu klein; native `<select>` auf Android öffnet zudem ein System-Popup, das das Spiel verdeckt |

Die Walze (`touch.ts:237–364`) ist handwerklich schön (Schwung, Rasten, Haptik), aber als **Primärnavigation für 11 Funktionen inkl. Pause** ungeeignet: Nur ein Eintrag ist tippbar (`index.html:113–117`), die anderen sind `pointer-events: none`. Pause ist der 11. Eintrag – auf einem klingelnden Handy will man *sofort* pausieren.

### 2.3 Safe-Area, Notch, Landscape-Lock (BELEGT)

- `viewport-fit=cover` ist gesetzt (`index.html:7`), aber im ganzen Dokument kommt **kein** `env(safe-area-inset-*)` vor. Der linke Stick sitzt bei `left: 10px` (`:123`) – genau dort, wo bei vielen Android-Geräten quer das Kamera-Loch liegt, bei iPhones die Notch/Dynamic Island. Der Kontostand bei `top: 8px; left: 8px` (`:142`) ebenso.
- **Kein Landscape-Lock:** GDD Kap. 3 verlangt „Landscape-only, Sperre in Capacitor-Config". `capacitor.config.json` enthält nichts dazu (das gehört ohnehin ins `AndroidManifest.xml` als `android:screenOrientation="sensorLandscape"`, das im Repo nicht existiert). Im Web gibt es keinen `screen.orientation.lock()`-Aufruf (Suche über `src/`: kein Treffer). Im Hochformat würde das Layout mit absoluten Pixelpositionen (Fahrkreuz bei `left: 214px`) auf 360 px Breite kollidieren.
- `manifest.webmanifest` und `icon-192.png` werden referenziert (`index.html:11, 18–19`), existieren aber nirgends im Repo (`find`: keine PNG/Webmanifest-Dateien). „Zum Startbildschirm hinzufügen" liefert also ein generisches Icon; der Capacitor-Build braucht ohnehin eigene Icons.

### 2.4 Dialoge Verhandlung / Abholung / Ausbau (BELEGT)

Punkt 7 aus `docs/Pruefung/02_Schwachstellen.md:127–131` („Dialoge unsichtbar, weil kein CSS existierte") ist **behoben**: `index.html:256–300` definiert `#pickup, #haggle, #shop` mit `display:none` / `.open { display:flex }`, z-index 22, Panel 300–460 px, Buttons in voller Breite. Aufbau in `main.ts:322–357` (Abholung), `:461–495` (Ausbau), `:508–543` (Verhandlung).

Verbleibende UX-Punkte:
- **Verhandlung pausiert das Spiel nicht** (`paused` bleibt false; `main.ts:542` öffnet nur die Klasse). Die Physik und der Bagger laufen weiter; auf Touch liegen die Sticks unter dem Overlay (z 5 < 22), also ist die Maschine wenigstens „eingefroren", aber ein ausgelenkter Stick beim Öffnen bleibt ausgelenkt (kein `pointercancel`-Reset – VERMUTUNG, hängt vom Browser ab).
- **Kein Abbrechen/Zurück** im Verhandlungsdialog (`index.html:411–417`); er verschwindet per Timeout (`main.ts:573–577`) mit einem Toast, den man leicht verpasst.
- **Panel-Maße auf Handy:** `min-width: 300px; padding: 22px 26px; max-height: 86vh` ohne Handy-Media-Query (die `max-height:430`-Regeln gelten nur für `#pause`/`#controls-menu`). Bei 4 Fraktionen + „Gemischt" + „Abbrechen" (je ~44 px + 7 px Rand) ≈ 320 px Inhalt + Titel + Untertitel ≈ 420 px > 86 vh von 412 px = 354 px → scrollt. Funktioniert, ist aber kein Handy-Dialog.
- Ausbau-Dialog: Buttons mit `float: right` für den Preis (`:290–292`) – auf 300 px Breite brechen lange Namen unter den Preis.

---

## 3. Visuelle Lesbarkeit der Materialklassen

### 3.1 Wie es dargestellt wird (BELEGT)

Farbe je Fraktion aus `catalog.ts:20–33`, Formen aus `scrapItems.ts:117–195`, Materialparameter `scrapItems.ts:313–317`:

| Fraktion | Hex | Formen | Oberfläche |
|---|---|---|---|
| Stahlschrott | `#6e5a4e` (Rostbraun) | Balken, Rohr, Blech, Heizkörper, Motorblock, Drahtknäuel (Wireframe) | roughness 0,75, metalness 0,4 |
| Edelstahl VA | `#dfe6ea` (fast Weiß) | Spülbecken, Behälter, Geländerrohr | 0,75 / 0,4 |
| Aluminium | `#c4c8cc` (Hellgrau) | Felge, Profil, Tafel | 0,35 / 0,4 |
| Kupfer/Messing | `#c7622b` (Orange) | Rohr, **Torus** (Bund), Armaturen-Box | 0,35 / 0,4 |
| Kabel | `#b0682a` / `#71646a` / `#315e75` | **Torus-Coil** (eigene Geometrie) und Trommel-Zylinder | 0,75 / 0 |
| Störstoff | `#7a6a52` (Graubraun) | Latte (Box), Platte (Box), Kiste, Betonblock | 0,75 / 0 |
| Holz / Reifen / Baumisch | `#8a6a42` / `#2e2c2b` / `#9a9083` | (nur Container-Farben, im Spawn-Katalog keine eigenen Teile) | – |

Kein Outline-Shader, kein Post-Processing, kein Tone-Mapping (Suche nach `Outline`, `EffectComposer`, `toneMapping`: keine Treffer). Highlight = Emissive `0x2a2a1a` (`scrapItems.ts:650`). Container tragen ein Farbband der Fraktion (`containers.ts:102, 114`) und ein Canvas-Label mit Text, aber **kein Piktogramm** (GDD 16 und 20 verlangen Piktogramme).

### 3.2 Reicht das? (BELEGT: Zahlen · VERMUTUNG: Wirkung)

Farbabstand ΔE76 in CIE-Lab (unter ~10 aus der Distanz „gleiche Farbe", unter ~20 „gleiche Familie"):

| Paar | ΔE | Konsequenz |
|---|---|---|
| Stahl ↔ Fahrspur-Boden `#6b6357` | **6,1** | Stahlteile verschwinden optisch auf dem Boden. |
| Stahl ↔ Störstoff | **9,1** | Die zwei Fraktionen mit gegensätzlichem Wert (Ertrag vs. Kosten) sind farbgleich. |
| Edelstahl ↔ Aluminium | **10,5** | Unterscheidung nur über roughness (Glanz) – auf einem Handy ohne Umgebungsreflexion (kein envMap gesetzt) praktisch nicht sichtbar. Preisunterschied 1,4 vs 1,5 €/kg klein, aber falsche Mulde = Reinheitsverlust. |
| Kupfer ↔ Kabel (Hauptfarbe) | **13,2** | Beide orange-braun, beide gibt es als Torus. Kupfer ist die wertvollste Fraktion (7,2 €/kg) – ausgerechnet die muss man am sichersten erkennen. |
| Störstoff ↔ Holz | 12,6 | Störstoff-Latte ist faktisch Holz, Farbe fast identisch, aber es sind *unterschiedliche Container*. |

Positive Seite: Die **Formsprache** ist gut differenziert und trägt mehr als die Farbe – Kabel-Coil (`scrapItems.ts:35–63`) ist als Silhouette eindeutig, Felge/Blech/Träger lesen sich. Das ist die richtige Richtung für Low-Poly.

Aber der GDD-Abnahmetest (Kap. 16: „aus 15 m 8 von 10 Teilen richtig zuordnen ohne HUD") ist nach diesen Werten auf dem Handy **nicht zu bestehen** (VERMUTUNG). Das Spiel kompensiert über die Griff-Info-Zeile (Klartext), also über *Lesen* statt *Sehen* – und die steht in 12 px am unteren Rand.

### 3.3 Vorschläge (Priorität absteigend)

1. **Palette auseinanderziehen** – ΔE ≥ 25 zwischen allen Fraktionen und ≥ 20 zu Boden/Bagger. Konkreter Vorschlag (bewusst „Toy"-übersättigt, die Welt bleibt grau):
   - Stahl: kaltes Dunkelgrau-Blau `#4a5563` statt Braun (Rost als *Decal*, nicht als Grundfarbe) → hebt sich vom Sandboden ab.
   - Edelstahl: `#f2f6f8` + metalness 0,9 + kleines envMap (RoomEnvironment aus three, kostet nichts) → wirklich spiegelnd.
   - Alu: `#a9b6c2` mattblau-grau, roughness 0,6 → bewusst *stumpf* gegen VA.
   - Kupfer: `#d9742e` satt orange, Messing `#c9a227` als Zweitfarbe (steht so im GDD).
   - Kabel: **immer** Mantelfarbe schwarz/blau/rot `#1d1f22 / #2f5f9e / #b2332b` mit sichtbarem Kupfer-Kern an den Enden; nie orange-braun.
   - Störstoff: `#8b5a2b` Holz-Ocker *mit Maserungs-Streifen* (Vertex-Color-Streifen), Beton `#b9b6ad`, Reifen `#1a1a1a` – und diese drei nicht als „Störstoff"-Box, sondern sichtbar als Holz/Beton/Reifen.
2. **Silhouetten-Regel je Fraktion:** Stahl = eckig/dick, Alu = flach/dünn/rund (Felge, Tafel, Profil), VA = Gefäß (Becken, Tank), Kupfer = Rohr/Rolle, Kabel = Coil/Trommel, Störstoff = organisch/klobig. Ist zu 70 % schon so – nur Kupfer-Torus vs. Kabel-Coil und Stahl-Box vs. Störstoff-Box aufräumen.
3. **Outline/Highlight für das Zielobjekt:** Statt Emissive einen echten Umriss (three `OutlinePass` ist teuer; günstiger: zweites Mesh mit `BackSide` und Skalierung 1,04 in Signalfarbe, oder ein Bodenring-Decal unter dem Sensor). Zusätzlich Farbring in der Fraktionsfarbe – dann liest der Spieler die Fraktion am Ring, nicht am Teil.
4. **Icons:** 8 Piktogramme (Träger, Becken, Felge, Rohr, Kabelrolle, Holz, Reifen, Beton) als SVG – im Container-Label, in der Griff-Info, im Abhol-Dialog, in der Ampel. Farbenblind-sicher (GDD 20 verlangt es).
5. **Abwurf-Ampel größer:** Aktuell ein 12 px Rahmen im Sprite (`containers.ts:380`). Auf dem Handy sollte die ganze Mulde kurz in Grün/Rot „pulsen" (Emissive am Container-Body) plus Bodenprojektion.

---

## 4. Art Direction & Assets

### 4.1 Was jetzt da ist (BELEGT)

- 100 % prozedurale Three.js-Primitive (Box, Cylinder, Capsule, Torus, Tube, Icosahedron), Vertex-Farben über `MeshStandardMaterial`, teils `flatShading` (Hügel, Bäume, Karossen). Bagger in Sennebogen-Grün `#5bbf46` (`excavator.ts:308`, Variable heißt noch `machineBlue`), Himmel/Nebel `#b8c4cc` (`main.ts:60–61`), Tageslauf mit Flutlicht (`daylight.ts`).
- `assets/` enthält nur eine README; keine Textur, kein Modell, kein Sound-File (Audio ist synthetisiert, `audio/*.ts`), keine Schrift, kein Icon.
- Kein Tone-Mapping, kein Post-Processing, keine Umgebungsreflexion. Standard-PBR ohne envMap sieht auf Mobil „plastikig-flach" aus (VERMUTUNG, Erfahrungswert).

### 4.2 Bewertung für den Store-Auftritt (VERMUTUNG, fachlich)

Prozedural ist **nicht** das Problem – „Teardown", „Poly Bridge", „Mini Motorways", Kenney-basierte Spiele beweisen, dass Primitive + gute Palette + gutes Licht ein Store-fähiger Look sind. Das Problem ist, dass hier **keine Stilentscheidung** getroffen wurde: Die Formen sind Low-Poly, die Materialien sind PBR-Realismus, das HUD ist Terminal-Monospace, der Himmel ist Nebelgrau. Drei Stile, kein Stil. Das GDD Kap. 16 hat einen Stil beschrieben („stilisiertes Low-Poly, Flat-Shading-Tendenz, Toy-Lesbarkeit"), der Code setzt ihn nur in den Hügeln um.

**Mit prozeduraler Geometrie erreichbar** (und ich würde dabei bleiben, weil es zum Web-Stack passt und Ladezeit/Größe klein hält):
- Schrottteile, Container, Boden, Zaun, Büro, Bäume, Presse: ja – mit Palette, Bevel-Fake (leichtes `flatShading` + 2–3 Farbtöne je Objekt statt einer), Kanten-Abdunklung per Vertex-Color, Outline.
- Der Bagger: Er ist das **Hero-Asset** und der einzige Ort, wo ein echtes Modell einen sichtbaren Sprung bringt (Kabinenglas, Hydraulikschläuche, Rotator, Schriftzug). Aktuell ~1600 Zeilen Handaufbau in `excavator.ts` – das ist teurer in der Pflege als ein glTF.
- Fahrzeuge (Kipper, Pritsche, Tieflader, Pkw-Wracks): guter Kandidat für fertige Low-Poly-Packs.
- Menschen (`people.ts`, 674 Zeilen Kapsel-Figuren): entweder bewusst „Playmobil"-stilisiert lassen oder durch ein Pack ersetzen; Zwischenlösung ist die schlechteste.

**Was Assets braucht und was es kostet (Größenordnung, VERMUTUNG):**

| Bedarf | Quelle | Kosten | Aufwand |
|---|---|---|---|
| Fahrzeuge, Container, Props, Zaun, Paletten | **Kenney** (CC0: „City Kit Industrial", „Car Kit", „Construction Kit") | 0 € | 2–3 Tage Integration (glTF-Loader, Skalierung, Kollider) |
| Umschlagbagger mit Greifer, riggbar | Sketchfab / CGTrader Low-Poly (Sennebogen-/Fuchs-artige Modelle, 20–80 €); oder **Auftragsarbeit** (Low-Poly-Artist, 15k Tris, riggbar mit Ausleger/Stiel/Rotator/5 Zinken) | 60 € Kauf / 400–1200 € Auftrag | Kauf: 1–2 Tage Rig-Anpassung; Auftrag: 2–4 Wochen Durchlauf |
| Schrottteile (20–30 Stück lesbar) | Prozedural behalten + 5–8 Hero-Teile (Waschmaschine, Fahrrad, Heizkörper, Motorblock, Kabeltrommel) aus Packs/Sketchfab | 0–100 € | 2 Tage |
| UI-Icons (8 Fraktionen, 12 Funktionen, Ampel) | Selbst als SVG, oder Icon-Set (Lucide/Tabler CC0) + 8 eigene Fraktions-Piktogramme | 0 € / 150–300 € Illustrator | 1–2 Tage |
| Schrift | Google Fonts (z. B. „Barlow Condensed" für Displays, „Inter" für Text) | 0 € | ½ Tag |
| Store-Grafik: Icon 512, Feature-Grafik 1024×500, 6–8 Screenshots, 30-s-Video | Screenshots aus dem Spiel *nach* Stilpass; Icon/Feature-Grafik: Illustrator oder KI-gestützt + Nacharbeit | 150–500 € | 3–5 Tage |
| KI-generierte 3D-Modelle (Meshy, Tripo o. ä.) | für Props brauchbar, für den Bagger mit Rig **nicht** (Topologie/Gelenke); Lizenzlage für den Store prüfen | 20–50 €/Monat | – |

Realistisches Gesamtbudget für einen store-tauglichen Look ohne Auftrags-Bagger: **300–600 €** und **3–4 Wochen** eines Entwicklers, davon die Hälfte für den Stilpass am bestehenden prozeduralen Material (Palette, Licht, Outline, HUD-Redesign).

### 4.3 Stilguide-Vorschlag (1 Seite)

**Leitidee:** „Ordnung im Chaos." Der Platz ist grau und ruhig, das Material leuchtet. Alles, was Geld ist, hat Farbe; alles, was Arbeit ist, hat keine. Spielzeughaft-solide, nicht comichaft, nicht realistisch. Referenzen: Teardown (Lesbarkeit), Kenney-Kits (Formen), „Mini Motorways" (Ruhe), Sennebogen-Prospektfotos (Bagger-Stolz).

**Palette**
- Welt (entsättigt): Sandboden `#b8ad9a`, Beton `#9c9a92`, Asphalt/Spuren `#5f5d58`, Himmel `#cfd9e0` → `#f0e6cf` am Horizont (Verlauf statt Nebelgrau), Büro/Zaun `#6f7378`.
- Bagger: Signalgrün `#4fbf3f` mit Schwarz `#1e2124` und Warngelb `#f2b632` an Greifer/Stützen. Der Bagger ist der einzige grüne Gegenstand auf dem Platz.
- Fraktionen (siehe 3.3): Stahl `#4a5563`, VA `#f2f6f8`, Alu `#a9b6c2`, Kupfer `#d9742e`, Messing `#c9a227`, Kabel schwarz/blau/rot, Holz `#8b5a2b`, Beton `#b9b6ad`, Reifen `#1a1a1a`.
- UI: Hintergrund `rgba(20,22,24,.85)`, Text `#eef0ec`, Akzent Warngelb `#f2b632`, Erfolg `#3fc463`, Warnung `#e0483a`. Nur diese fünf.

**Formsprache**
- Alles hat eine Fase (sichtbar ab 3 m): bei Primitiven über `flatShading` + zweiten Farbton auf Deckflächen (Vertex-Color) faken.
- Keine Texturen außer: Rost-Decals, Container-Nummern, Bagger-Schriftzug (ein 2k-Atlas).
- Schrott: pro Teil maximal 2 Farben (Grundfarbe + 15 % dunkler an Kanten/Unterseite). Jede Fraktion hat eine *Signatur-Silhouette*.
- Menschen: bewusst „Figuren" (Kapsel + Kugel, ohne Gesicht), nicht „Menschen". Dann sind sie Stil, nicht Mangel.

**Kamera**
- Standard: Schulter-Orbit hinter der *Kabine* (nicht hinter dem Unterwagen), Kamera dreht mit dem Oberwagen, weiches Nachführen (0,3 s) auf den Greifer. Wischen auf freier Fläche dreht, Pinch zoomt (3–18 m). FOV 50° auf dem Handy (weniger Verzerrung als 55°).
- Zwei weitere Modi reichen: Draufsicht (Sortieren) und Kabine (Immersion). Seitenansicht wird durch Kamera-Nachführen überflüssig.
- Ein Bodenring unter der Spinne, immer sichtbar – das ist das „Fadenkreuz" des Spiels.

**Licht**
- Fester Spätvormittag als Standard (der Tageslauf kann bleiben, aber mit begrenztem Bereich: nie nachts, Flutlicht als Stimmung, nicht als Notwendigkeit).
- `ACESFilmicToneMapping`, Exposure 1,1; `RoomEnvironment` als envMap für Metallglanz (VA/Alu/Kupfer werden erst damit unterscheidbar).
- Schatten weich, 2048 reicht; auf dem Handy Cascade auf 40 m begrenzen.
- Kontaktschatten (dunkler Fleck) unter jedem Teil – billig, riesiger Effekt für die Tiefenwahrnehmung.

**UI-Stil**
- Schrift: Barlow Condensed (Ziffern, Titel), Inter (Text). Mindestens 14 px auf dem Handy, Zahlen 20 px+.
- HUD wie ein Maschinen-Display: Konto groß oben links, darunter kleiner „Haufen ≈"; Griff-Info als Chip mit Fraktions-Icon + Farbe + kg; Ampel als großes Symbol (✓ ! ✕) über der Mulde in der Welt, nicht nur im Label.
- Touch: zwei Sticks + **ein großer Greif-Knopf** (Ø 72 px) über dem rechten Stick + **ein Fahr-Modus-Knopf** (Ø 56 px) über dem linken Stick; alle anderen Funktionen in ein Radial-/Sheet-Menü hinter *einem* Knopf oben rechts; Pause immer oben links sichtbar.
- Dialoge als Bottom-Sheet (von unten hochfahrend, halbe Höhe), nicht als zentrierte Karte; Spiel dahinter pausiert.

---

## 5. Onboarding – die ersten 60 Sekunden (BELEGT aus Code, Wirkung VERMUTUNG)

**Was passiert:**
- 0 s: „Lade Physik …" (`index.html:426`), dann Bild: Bagger von hinten, Orbit-Kamera, links ein 150-Teile-Berg (`main.ts:126`), zwei Wracks, 6 Hügel mit je 5 Teilen. Tutorial-Karte unten links: „Willkommen auf dem Platz … dreh den Oberwagen einmal herum." Auf dem Handy sitzt die Karte (`#tutorial left:8px bottom:8px`, `index.html:253`) **genau auf dem linken Stick** (`#touch-left left:10px bottom:10px`) – z-index 12 über 5. Die Karte hat `pointer-events: auto` (`:236`). Der erste Stick ist also während des ersten Tutorial-Schritts verdeckt (BELEGT aus CSS; ob die Karte 260 px breit wirklich bis über den Stick reicht: ja, Stick endet bei x = 118).
- 12 s: Schritt 1 schaltet **zeitgesteuert** weiter (`tutorial.ts:49, 123`) – ob der Spieler gedreht hat, prüft niemand. Gleichzeitig kommt der erste Kunde (`routes.ts:108`: `FIRST_DELAY_S = 12`).
- ~20–40 s: Kunde fährt ein, Toast „Begrüßung", Waage-Toast, **Verhandlungs-Dialog** geht ohne Vorwarnung über das Bild (`main.ts:578`). Der Spieler hat den Bagger noch nicht bewegt und muss schon einen Preis nennen. Drei Knöpfe ohne Erklärung, was „leicht drücken" bedeutet (Text kommt aus `haggle.ts`, nicht geprüft).
- ~40–60 s: Kipper lädt ab, Kunde wird bezahlt – **das Konto sinkt** (`account.payDelivery`, `main.ts:582`). Das erste Geld-Feedback ist ein Verlust.
- Erster Erfolgsmoment „richtig einsortiert": `playCorrect` + `noteSorted` (`main.ts:399–404`) – ein Ton, kein Geld, kein Toast, kein Ticker. Geld gibt es erst beim LKW-Abfahren (`:593–606`), was ABHOLEN (Walze) → Fraktion → beladen → ABHOLEN → LKW fährt raus erfordert. Realistisch 5–10 Minuten nach Start (VERMUTUNG).

**Tutorial-Texte auf Touch** (`tutorial.ts:41–95`):
- Schritt 4: „Mit B schließt du die Klappen" – auf Touch heißt es SCHERE in der Walze.
- Schritt 5: „Mit V rufst du einen Abholer" – Touch: ABHOLEN.
- Schritt 6: „baust du den Platz aus (Taste G)" – **falsch**, Ausbau liegt auf Z (`main.ts:736`) bzw. AUSBAU in der Walze; G ist Stiel heran.
- Schritt 1 sagt „rechter Stick: Ausleger und Greifer", Schritt-Texte danach benutzen keine Stick-Begriffe mehr.

**Urteil:** Der Weg zum ersten Erfolgsmoment ist **nicht klar**. Das GDD 14.3 hatte es richtig: „Ein einzelner Stahlträger liegt vor dem Bagger → greif ihn → wirf ihn in den grauen Container → Ampel erklärt" – innerhalb 3 Minuten ein kompletter Mini-Loop mit Ton, Ampel und Ticker. Der Code startet stattdessen in den Vollbetrieb (150 Teile, Kunde nach 12 s, Verhandlung vor der ersten Bewegung).

---

## 6. Vorschläge für v2 (priorisiert)

**P0 – ohne das kein Touch-Release**
1. Touch-Layout nach GDD 5.1 zurückbauen: Greif-Knopf (groß, rechts unten über dem Stick, Halten *oder* Toggle einstellbar), Fahr-Modus-Toggle (links; im Fahrmodus wird der linke Stick zu Gas/Lenkung), Rotator als zwei Tasten *am* Greif-Knopf. Fahrkreuz und Kippsteuerung streichen.
2. Kamera: Wischen auf freier Fläche dreht, Pinch zoomt, Kamera folgt dem Oberwagen (Yaw = heading + cabYaw + Offset), weiches Nachführen auf den Greifer. Ein Bodenring unter der Spinne.
3. Walze durch ein Menü mit einem Knopf ersetzen (Radial oder Bottom-Sheet); Pause als eigener, immer sichtbarer Knopf oben.
4. Safe-Area (`padding: env(safe-area-inset-left)` usw.), Landscape-Lock (`screen.orientation.lock("landscape")` im Web + `sensorLandscape` im Android-Manifest), Manifest + Icons ins Repo.
5. Alle Tippziele ≥ 44 px, HUD-Schrift ≥ 14 px, Konto ≥ 20 px.

**P1 – Lesbarkeit**
6. Palette nach 3.3 (ΔE ≥ 25), envMap + ACES, Kontaktschatten, Outline/Farbring am Zielobjekt.
7. 8 Fraktions-Piktogramme in Label, Griff-Info, Dialoge; Ampel als Weltsymbol über der Mulde.
8. Toast-Stapel (max. 3, gestaffelt) statt Überschreiben; Geld-Ticker mit „+123 €"-Aufsteiger in Grün.

**P2 – Onboarding**
9. Kalter Start nach GDD 14.3: leerer Platz, ein Träger, ein Container, erster Kunde erst nach dem ersten richtigen Abwurf. Tutorial-Schritte an *Aktionen* binden (Oberwagen wirklich gedreht? Greifer wirklich geschlossen?), Texte je nach Eingabegerät (Tastenname vs. Knopfname aus einer Tabelle).
10. Ersten Erfolgsmoment vorziehen: Sortierprämie *sofort* sichtbar (Ticker + Toast + Ton), auch wenn das echte Geld erst beim Abholen kommt.
11. Verhandlung: Spiel pausieren, „Später"-Knopf, Erklärungssatz beim ersten Mal.

**P3 – Assistenz (Einsteigermodus)**
12. IK-Zielmodus für Touch: rechter Stick bewegt einen Zielpunkt am Boden, Arm folgt; Profi-Modus bleibt. Snap: Spinne ab 0,5 m über einem Teil sanft zentrieren (Magnet-Effekt), Auto-Öffnen über der Ampel-grünen Mulde als Option.

**Zur offenen Technik-Frage (Web vs. Unity/Godot) aus UX-Sicht:** Keiner der obigen Punkte *braucht* eine andere Engine. Kamera, Palette, Layout, Onboarding sind Design-, nicht Stack-Entscheidungen; Three.js kann Outline, envMap, Tone-Mapping und glTF. Was eine Engine mitbrächte – fertige Touch-Joysticks, Safe-Area-Handling, UI-Skalierung, Store-Build-Pipeline – kostet im Web ca. 1–2 Wochen Handarbeit, die oben eingepreist sind. Der Wechsel lohnt sich nur, wenn Physik/Performance ihn erzwingen (das bewerten die anderen Rollen).
