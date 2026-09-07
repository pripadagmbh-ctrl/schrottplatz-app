# Schrottplatz-App — Analysebericht und Bauplan für v2

Stand: 02.09.2026 · Erstellt von einem Vierer-Team aus Claude-Agents (Architect, QA-Tester, Game-Designer, Art-Director/UX) im Auftrag von Patrick · Prüfgegenstand: `Schrottplatz-App/prototype` (Stand M3, 12.309 Zeilen TypeScript) und `docs/`

Dieses Dokument ist die Zusammenfassung. Die vier vollständigen Einzelbefunde (zusammen ~1.170 Zeilen, jeder Befund mit Datei und Zeilennummer belegt) liegen unter `docs/analyse/`.

**Legende:** BELEGT = im Code gesehen oder im Lauf reproduziert · VERMUTUNG = fachliche Einschätzung ohne Messung in diesem Projekt.

---

## 1. Das Wichtigste in fünf Sätzen

1. Der Prototyp hat einen guten Kern: keine zirkulären Abhängigkeiten, strenges TypeScript, ~1.700 Zeilen saubere, getestete Spiellogik (Wirtschaft, Materialien, Kunden, Tutorial), eine durchdachte Greif- und Zerlegemechanik und ein handwerklich sauberes Touch-Modul.
2. Die vier Schmerzpunkte (Bugs beim Erweitern, unrunde Physik, Handy-Performance, überladene Touch-Bedienung) sind **Struktur- und Design-Probleme, keine Engine-Probleme** — sie würden bei einem 1:1-Umzug nach Unity mitreisen.
3. Es gibt **kein Spielziel im Code**: keine Tage, keine Bilanz, keine Aufträge; das Ausbau-System ist zur Hälfte Attrappe, die Wirtschaft ist unschlüssig (Kupfer für 250 € kaufen, für 11.000 € verkaufen). Patricks Gefühl "Missionen unklar" ist belegter Ist-Zustand.
4. Zwei harte Abstürze wurden reproduziert (gegriffenes Teil wird gepresst/verkauft → Physik friert für immer ein; beschädigter Spielstand → dauerhaft schwarzer Bildschirm), dazu drei Performance-Fresser mit konkreten Zahlen (3.139 Meshes, nie einschlafender Haufen, nur ein `dispose()` im ganzen Projekt).
5. **Entscheidung:** v2 entsteht in einem neuen Ordner als Neustrukturierung im Web-Stack (rund die Hälfte der Logik bleibt), Unity läuft parallel als zeitlich begrenzte Testspur. Monetarisierung: Gratis bis Ende Tag 3, dann einmaliger Premium-Unlock.

---

## 2. Was der Prototyp ist

Ein Einzelspieler-Simulationsspiel: Umschlagbagger mit Greifspinne auf einem Schrottplatz. Anlieferungen annehmen, verhandeln, sortenrein sortieren, pressen, abholen lassen. Technik: TypeScript, Vite, Three.js r169 (3D-Rendering im Browser), Rapier 0.14 (Physik in WebAssembly), Vitest (97 Tests). Ziel laut altem GDD: Google Play, Premium 4,99 €.

**Modulkarte** (Zeilen / Bewertung 1–5 durch den Architect):

| Modul | Zeilen | Was es tut | Qualität | Für v2 |
|---|---|---|---|---|
| `main.ts` | 917 | Bootstrap, Spielschleife, **alle** Verdrahtung, drei Menüs, Spielzustand als lokale Variablen | 1 | neu |
| `excavator/excavator.ts` | 1.604 | Bagger-Kinematik + 660 Zeilen Modellbau + Tastenbelegung + Kollider-Sync + Pendel | 2 | Kinematik-Kern (~300 Z.) übernehmen, Rest neu |
| `delivery/vehicles.ts` | 1.100 | LKW-Zustandsautomat mit 16 Phasen, hart codierte Zeiten | 2 | Ablauf übernehmen, Code neu (datengetrieben) |
| `world/scrapItems.ts` | 719 | Schrottteile: Daten + Mesh + Physik-Körper in einer Klasse (Nabe des Graphen, 11 Abhängige) | 2 | Spawner-Daten übernehmen, Klasse neu geschnitten |
| `world/yard.ts`, `obstacles.ts`, `containers.ts` | 671 / 151 / 514 | Platzgeometrie — **dreimal** (Kollider, Hindernisliste, Box-Koordinaten) | 2–3 | eine Level-Definition (JSON), Rest generiert |
| `world/press.ts`, `people.ts`, `fence.ts`, `daylight.ts` | 474 / 674 / 114 / 159 | Presse, Platzwart Lambert, Zaun, Tageslauf | 3 | Verhalten übernehmen |
| `physics/gripSystem.ts` | 241 | Greifen per Fixed Joint, Reißen, Quetschen | 3 | Design übernehmen, Joint-Ansatz ändern |
| `dismantle/composites.ts`, `carDef.ts` | 427 / 100 | Karosse: Quetschstufen, Scheiben, Abreißen — datengetrieben | 3–4 | übernehmen |
| `economy/*` (Konto, Verhandeln, Ruf, Betrieb, Ausbau) | ~620 | Reine Logik, 86 % Testabdeckung | 4 | übernehmen (Formeln korrigieren) |
| `materials/*`, `delivery/customers.ts`, `routes.ts`, `ui/tutorial.ts` | ~600 | Daten und reine Formeln, 96–100 % getestet | 4 | übernehmen |
| `core/touch.ts`, `input.ts`, `controlConfig.ts` | 503 / 91 / 83 | Virtuelle Sticks, Tastatur, freie Belegung | 3–4 | Technik übernehmen, Layout neu |
| `audio/*` | 578 | Prozedurale Sounds ohne Asset-Dateien (GEMA-frei — klug) | 3 | übernehmen, an Events hängen |

**Bilanz:** ~19 % direkt übernehmbar, ~52 % als Logik übernehmbar und neu geschnitten, ~29 % neu (Details in `05_Portierungsliste.md`).

---

## 3. Befund A — Warum neue Features Bestehendes brechen

Der strukturelle Grund ist `main.ts`. Es ist kein Startcode, sondern der Motor des Spiels: 24 Objekte werden von Hand erzeugt, 30 Callback-Haken gesetzt (`grip.crusher = …`, `vehicles.onWeighIn = …`), 35 HTML-Elemente gegriffen, drei Menüs mit Spiellogik gefüllt. Der Spielzustand (`preisFaktor`, `paused`, `tutSortiertKg` …) lebt als lokale Variablen in einer 900-Zeilen-Funktion. BELEGT.

Ein neues Feature muss heute an bis zu **neun Stellen** angeflanscht werden: Klasse anlegen, in `main()` konstruieren, Callbacks setzen, an der richtigen Stelle der Update-Reihenfolge einhängen (die nirgends deklariert ist), HUD/Toast in main schreiben, Save-Schema erweitern, Boot-Pfad erweitern, Hindernisliste pflegen, Tastencode an drei Orten eintragen. Keine dieser Stellen ist durch Typen oder Tests abgesichert.

Zwei Verstärker: Der im GDD vorgesehene EventBus existiert (8 Events), wird aber kaum genutzt — 2 Events sind komplett verdrahtet, `grabbed`/`released` werden nie gefeuert. Und Simulation und Darstellung sind nicht getrennt: 24 von 44 Dateien importieren Three.js, deshalb ist nur das getestet, was ohne Browser läuft (9,6 % Zeilenabdeckung; Physik, Bagger, Greifer, Fahrzeuge, Welt: 0 %).

**Für Laien:** Stell dir eine Werkstatt vor, in der jedes Werkzeug mit Kabeln an jedem anderen hängt. Ein neues Werkzeug aufzuhängen heißt, zwanzig Kabel umzustecken — und wenn eines vergessen wird, läuft die Maschine "stumm falsch" weiter (die Callback-Felder sind alle optional und werden mit `?.()` aufgerufen).

**Lösung in v2** (`02_Architektur_v2.md`): vier Schichten (Daten → Simulation → Anwendung → Darstellung), Abhängigkeiten nur nach unten, per ESLint-Regel erzwungen. Systeme mit deklarierter Reihenfolge. Ein Spielzustandsmodell. Eingabe als abstraktes `ControlFrame`. EventBus als einzige Aufwärtsrichtung. Level als JSON. Kopflose Simulationstests in Vitest (Rapier läuft in Node — das hat der QA-Agent benutzt).

---

## 4. Befund B — Zwei Abstürze, reproduziert

**H1 — Physik-Welt stirbt** (QA, `docs/analyse/A2` Abschnitt 4): Wird ein Teil entfernt, während es in der Spinne hängt, ruft `releaseAll()` (`gripSystem.ts:229`) `wakeUp()` auf einem bereits gelöschten Körper. Rapier antwortet mit einer WASM-Panik, danach wirft **jeder** weitere Aufruf "recursive use of an object". Das Bild friert für immer ein. Drei Spielwege lösen das aus: Presse (`press.ts:452`), Verkauf per Abholer (`account.ts:120`), automatische Bündelung (`scrapItems.ts:581`). Gegenmaßnahme: `isValid()`-Prüfung plus ein `onRemoved`-Hook im ItemManager. Ein halber Tag.

Wichtig: Die Erklärung in der alten Prüfmappe ("`return false` im Callback lässt den Borrow offen") ist **falsch** — in Node widerlegt. Wer danach sucht, sucht am falschen Ort.

**H2 — Kaputter Spielstand = schwarzer Bildschirm** (reproduziert): Ein Save mit fehlendem `shape` oder `null`-Position stürzt `main()` ab, nachdem das Lade-Element schon entfernt ist (`main.ts:49`). Kein Fehlertext, kein Weg zu "Neues Spiel", bei jedem Start wieder. In einer Store-App ein 1-Stern-Fall. Es gibt außerdem **kein Autosave** — auf Android ist der Fortschritt weg, wenn das System die App im Hintergrund beendet.

---

## 5. Befund C — Performance: drei konkrete Fresser

Alle Zahlen vom QA-Agent gezählt bzw. gemessen (Headless Chromium, Rapier in Node).

| Fresser | Zahl | Was das heißt | Hebel |
|---|---|---|---|
| **Meshes** | 3.139 Meshes, davon ~1.530 allein die Betonlego-Umrandung (`yard.ts:587–612`); 1.281 Schattenwerfer; kein Instancing; 8 Lichter; Schatten 2048² PCF-Soft | Jeder Mesh ist ein Draw Call. Handy-Komfortzone: 100–300. VERMUTUNG: 15–25 fps auf Mittelklasse, unabhängig von der Physik | Statik zusammenführen, Items instanzieren, Spots bei Tag aus, Schatten sparen. 2–3 Tage |
| **Der Haufen schläft nicht** | 2,7 ms Physik pro Schritt — schlafend kostet dieselbe Welt 0,05 ms. In 2 von 5 Läufen sind nach 50 s noch 76–98 von ~120 Teilen wach (Zittern mit 0,01 mm/s) | Fast die gesamte Physiklast ist ein zitternder Haufen. Ursache: Spawn mit 4 cm Abstand, sehr steife Kontakte, 12 statt 4 Solver-Iterationen (+32 %) | Spawn mit Abstand, Haufen vor dem ersten Bild vorsimulieren und schlafen legen, Iterationen 6–8, harte Obergrenze für Körper. 1 Tag |
| **GPU-Leak** | Ein einziges `dispose()` im Projekt; jedes Teil und Fahrzeug bekommt eigene Geometrie und Material und wird nie freigegeben | Nach Hunderten Teilen Tausende tote Buffer im Grafikspeicher; auf dem Handy wird die App irgendwann vom System beendet | Geometrie/Material teilen, `dispose()` in `remove()`. Halber Tag |

Dazu: 60-Hz-Physik ohne Render-Interpolation → sichtbares Ruckeln auf 90/120-Hz-Displays. Und der Akkumulator holt bis zu 5 Schritte pro Bild nach — auf einem langsamen Handy läuft das Spiel nicht ruckelnd, sondern **in Zeitlupe**.

**Warum das für die Engine-Frage wichtig ist:** Unity erledigt Static Batching, Instancing und Sleep-Handling weitgehend automatisch; in Three.js ist es 1–2 Wochen Handarbeit. Das ist der eine echte Vorteil der Unity-Spur — und der Grund, warum sie als Testspur mitläuft.

---

## 6. Befund D — Physik "unrund": die Kernursache

Der Greifer hält Teile per **Fixed Joint zwischen kinematischer Spinne und dynamischem Teil** (`gripSystem.ts:213–222`). Ein kinematischer Körper hat unendliche Masse — das gegriffene Teil wird mit unendlicher Kraft in Position gezwungen. Berührt es Boden, Haufen oder Mulde, kämpft der Solver zwischen "Position halten" und "nicht durchdringen": Zittern, Impuls-Explosionen (im Fuzz-Test 12 Mal über 20 m/s, Spitze 55 m/s ≈ 200 km/h), durchgeschobene Nachbarn. `clampSpeeds` deckelt das nachträglich — versteckt es also, statt es zu verhindern — und erzeugt dabei das "Kleben": ein 1.000-kg-Teil darf sich nie schneller als 0,6 m/s bewegen, egal wie hart es geschlagen wird.

Die Fahrzeuge machen es richtig: Ladung wird während der Fahrt kinematisch mitgeführt und beim Ablegen wieder dynamisch (`vehicles.ts:511–521`). Dasselbe Muster für die Spinne wäre stabil und billiger. Dazu: harter Arm-Stopp bei Kontakt statt Gleiten ("Hängen"), Bodenanschlag als 80-fache Iterationsschleife ("Rastern"), Krallen-Kollider beim Tragen komplett abgeschaltet (andere Teile fahren durch die Krallen).

**Für v2 (beide Spuren):** Gegriffenes kinematisch mitführen, beim Loslassen mit Spinnengeschwindigkeit freigeben; Arm gleitend statt stoppend; Kollider nie abschalten; Solver-Werte in eine Konfigurationsdatei; Physik-Fuzz-Test als Wächter.

---

## 7. Befund E — Kein Spielziel, unschlüssige Wirtschaft

Der Game-Designer hat GDD (1.020 Zeilen in drei sich widersprechenden Schichten: "Ordnung" → Pivot "Zerstörung" 27.08. → "Umschlag" 29.08./02.09.) gegen den Code gehalten:

- **Kein Tag, keine Bilanz, keine Aufträge, keine Fixkosten, kein Ende.** `Shift` zählt nur Tonnen (`shift.ts:31`), das Tageslicht ist Kosmetik (`daylight.ts:16`). Das Spiel ist ein Endlos-Umschlag ohne Abschluss. Der Satz aus `10_Store_Veroeffentlichung.md`: "Ohne Ziel ist es eine Sandkiste, keine Kauf-App" — der richtigste Satz im Projekt.
- **Ausbau halb Attrappe.** `world/office.ts` (Wiegehäuschen → Büro → Halle, laut GDD der "rote Faden") wird **nirgends importiert**. Büro, Halle, Magnet kosten 9.000–28.000 € und tun nichts. `Reputation.decay()`/`frequencyFactor()` werden nie aufgerufen — die GDD-Behauptung "Ruf steuert Anlieferfrequenz" ist falsch.
- **Wirtschaft:** Ankauf pauschal 0,16 €/kg für alles (`account.ts:16`), Verkauf bis 7,20 €/kg (Kupfer). Eine sortenreine Kupfer-Fuhre: ~250 € rein, ~11.200 € raus. Verhandeln (138 Zeilen, 15 Tests) bewegt daneben zweistellige Beträge — ökonomisch irrelevant. HUD rechnet Reinheit², der Verkauf Reinheit³ (`account.ts:119` vs. `purity.ts:26`): der Spieler sieht "≈ 1.000 €" und bekommt 512 €. Anfänger können in den ersten 8 Minuten zahlungsunfähig werden, bevor das Tutorial das Verkaufen erklärt.
- **Zerstörung zahlt auf nichts ein.** Wrack greifen, fallen lassen, Motor herausreißen ist gebaut — bringt aber kein Geld, keinen Auftrag, keinen Ruf. Spaß-Kern und Wirtschafts-Kern sind nicht verbunden. Das ist exakt das "nicht schlüssig".
- **Onboarding erklärt keinen einzigen Griff.** Karte 1 läuft nach 12 s ohne Aktion weiter; erster LKW nach 12 s; Verhandlungsdialog, bevor der Spieler den Bagger bewegt hat; Karte 6 nennt "Taste G" für den Ausbau — tatsächlich ist es `KeyZ`, physisch **Y** auf einer deutschen Tastatur. Drei Angaben, drei Tasten.

**Lösung:** `01_GDD_v2.md` (124 Zeilen statt 1.020): 30-Tage-Rahmen (Willi als Schwager/Antagonist, Lambert als Mentor), Tag = Morgen-Karte → 4 Fuhren → Feierabend → Bilanz mit 3 Aufträgen und 3 Sternen, 3 sichtbare Ausbaustufen statt 8 Upgrades, vier Wirtschaftskorrekturen je eine Zeile, Onboarding an Aktionen gebunden.

---

## 8. Befund F — Touch und Lesbarkeit

- **21 Bedienelemente** (7 stufenlose Achsen, Greifen, Rotator, 11 Walzen-Funktionen, Kamera-Modus). Fahrkreuz und Rotator liegen in der Display-Mitte, wo im Querformat kein Daumen ist → dritter Finger nötig. Greifen liegt auf der Stick-Querachse mit Deadzone 0,38 und 50 % Querdämpfung (`touch.ts:468–479`) — Symptombehandlung für Fehlauslösungen. Das GDD Kap. 5.1 (Fahr-Modus-Toggle + großer Greif-Knopf) war ergonomisch besser; der Code ist davon abgewichen.
- **Keine Kamerasteuerung auf Touch.** Orbit dreht nur per mittlerer Maustaste (`input.ts:48–53`). Die Kamera folgt weder Oberwagen noch Greifer — wer zur Kamera hin schwenkt, arbeitet blind.
- **Materialfarben nicht in 1 s unterscheidbar** (rechnerisch, ΔE in CIE-Lab): Stahl ↔ Boden 6, Stahl ↔ Störstoff 9, Alu ↔ Edelstahl 10,5, Kupfer ↔ Kabel 13. Unter 10 sehen Laien "gleiche Farbe". Ausgerechnet Kupfer (7,20 €/kg) ist am schlechtesten erkennbar. Kein Outline, kein Icon, Highlight praktisch unsichtbar.
- **Tippziele unter 44 px** (Fahrkreuz 40×36, Walzeneinträge 26 px mit 10-px-Schrift, Tutorial-Skip ~20 px). Pause ist der 11. Walzeneintrag. Kein Landscape-Lock, keine Safe-Area, Manifest und Icon fehlen im Repo. HUD in 11-px-Consolas — die Schrift gibt es auf Android nicht.
- **Positiv:** Die Dialoge-CSS-Lücke aus der alten Prüfmappe ist behoben. `touch.ts` selbst (Pointer-Capture, Deadzones, Haptik, Zoom-Sperren) ist gute Arbeit — sie bildet nur das Desktop-Schema 1:1 aufs Handy ab, statt fürs Daumen-Spiel umzudenken.
- **Look:** 100 % prozedural, das ist kein Problem (Teardown, Poly Bridge beweisen es) — aber ohne Stilentscheidung: Low-Poly-Formen + PBR-Realismus + Terminal-HUD + Nebelgrau. Drei Stile, kein Stil. `assets/` ist leer.

**Lösung:** `04_Stilguide_und_Touch.md`: Zwei Sticks + ein großer Greif-Knopf + Fahr-Modus-Toggle, Kamera folgt dem Oberwagen und wischt/pincht, Bodenring unter der Spinne, Palette mit ΔE ≥ 25, Piktogramme, alle Tippziele ≥ 44 px, Onboarding nach GDD 14.3 (ein Träger, ein Container, dann der erste Kunde). Asset-Budget: 300–600 € und 3–4 Wochen, Bagger als einziges "Hero-Asset".

---

## 9. Monetarisierung

Premium 4,99 € ohne Publisher, ohne Community, ohne Presse bedeutet realistisch **zwei- bis niedrige dreistellige Verkäufe im ersten Jahr** (VERMUTUNG, Erfahrungswert). Das größte Kaufhindernis ist projektspezifisch: Niemand zahlt für eine 5-Achsen-Steuerung, von der er nicht weiß, ob er sie bedienen kann. Selbst die Genre-Referenz PowerWash Simulator ging auf Mobile nicht Premium. Rewarded Ads würden ein Belohnungs-Design erzwingen, das dem "kein Stress"-Kern widerspricht.

**Entscheidung (Patrick, 02.09.):** Gratis + einmaliger Premium-Unlock, keine Werbung. Der Gratis-Teil endet an einem sichtbaren Punkt — Ende Tag 3, Bilanz-Karte "Willi bietet dir den Platz an". Store-technisch ist das reversibel (paid → free geht, free → paid nicht). Vorher: kostenlose Desktop-Demo auf itch.io, um die eine Frage zu beantworten, die kein Test im Projekt beantwortet — macht es Spaß, und versteht ein Fremder die Steuerung?

---

## 10. Die Technik-Entscheidung

Alle vier Agents kamen unabhängig zum selben Schluss: Kein Befund *erzwingt* einen Engine-Wechsel. Schmerz 1 (Architektur), 2 (Physik-Gefühl) und 5 (Ziel) sind stack-unabhängig. Nur Performance und Touch hängen an der WebView — und dort fehlt die Messung.

| | Web (Three.js + Rapier + Capacitor) | Unity |
|---|---|---|
| Wiederverwendung | ~70 % der Substanz (Code + Logik) | 0 Zeilen Code; Formeln, Daten, Design |
| Bis Prototyp-Parität | ~2–3 Wochen | ~4–6 Wochen (Kern nach ~2) |
| Test-Schleife | Browser neu laden, iPhone-Safari sofort | Build → Gerät; iOS nur per Cloud-Build (kein Mac) |
| Performance auf dem Handy | die eine Unbekannte; Instancing/Sleep sind Handarbeit | nativ; Batching/Sleep weitgehend gratis; Profiler auf Gerät |
| Store-Funktionen (IAP) | Capacitor-Plugin, nachgerüstet | eingebaut (Unity IAP) |
| Editor für Platz-Layout | keiner → JSON + Generatoren | Szenen-Editor (die "drei Wahrheiten" verschwinden) |
| Agentengetriebene Entwicklung | sehr gut (alles ist Code) | schlechter (Szenen/Prefabs sind Editor-Dateien) |

**Entscheidung (Patrick, 02.09.): Beides.** Spur A (Prio 1): v2 als Neustrukturierung im Web-Stack. Spur B (Prio 2): ein zeitlich begrenzter Unity-Vergleichsprototyp (Bagger greift, hebt, sortiert; 150 Teile; Messung auf dem Handy). Das Go/No-Go-Tor: Wenn Spur A auf dem iPhone in Safari nach den Performance-Maßnahmen nicht stabil ≥ 30 fps mit Reserve schafft, oder Touch Finger verliert, wird Spur B zur Hauptspur — mit demselben GDD, denselben Daten und derselben Architektur. Details: `03_Roadmap.md`.

---

## 11. Priorisierte Maßnahmen (Kurzliste)

| Prio | Maßnahme | Beleg | Aufwand |
|---|---|---|---|
| **P0** | Neuer Ordner, Schichten-Architektur, Scheduler, ControlFrame, Lint-Gate, kopflose Sim-Tests | A1 §5 | Woche 1–2 |
| **P0** | H1/H2 als Pflichtmuster in den neuen Modulen (`isValid`, `onRemoved`, Save-Validierung, Autosave bei `visibilitychange`) | A2 §4 | je ½ Tag |
| **P0** | Tages-Gerüst: Morgen → 4 Fuhren → Feierabend → Bilanz, 3 Aufträge, 3 Sterne | A3 §5 | ~1 Woche |
| **P0** | Wirtschaftskorrekturen (Ankauf je Fraktion, Reinheit², Fixkosten, Sortierprämie) | A3 §5.6 | je 1 Zeile |
| **P0** | Touch-Layout v2 (Greif-Knopf, Fahr-Modus, Kamera-Gesten, Safe-Area, ≥ 44 px) | A4 §6 P0 | ~1 Woche |
| **P1** | Performance-Paket: Statik mergen, Instancing, Sleep-Haufen, dispose, Spots aus, Interpolation | A2 §5/§7 | ~1 Woche |
| **P1** | Greifen ohne Fixed Joint (kinematisch mitführen), Arm gleitend, Fuzz-Test | A2 §6 | 2–4 Tage |
| **P1** | Palette ΔE ≥ 25, envMap + ACES, Outline/Bodenring, Piktogramme, HUD ≥ 14 px | A4 §3 | ~1 Woche |
| **P1** | Onboarding Tag 0 (ein Träger, ein Container, dann erster Kunde) | A3 §5.5 / A4 §5 | 2–3 Tage |
| **P2** | Unity-Vergleichsprototyp (2 Wochen Timebox) | A1 §4 | 2 Wochen |
| **P2** | itch.io-Desktop-Demo + 20 Tester mit 5 Fragen | A3 §4.3 | 1 Tag + Wartezeit |
| **P2** | Assets (Kenney-Kits, Hero-Bagger), Store-Grafik | A4 §4.2 | 3–4 Wochen, 300–600 € |
| **P3** | IAP-Plugin (Google Play Billing), Free-Teil bis Tag 3 | A3 §4 | 2–3 Tage |
| **P3** | Graffiti "FC AARAU 1902" (`yard.ts:436`) durch Fantasienamen ersetzen — Vereinsname in kommerzieller App | A2 §7 | Minuten |

---

## 12. Was nicht geprüft wurde

Kein Agent hatte ein Handy oder eine echte GPU: Bildrate, Touch-Haptik und Bildwirkung sind aus Code, CSS und Zählungen abgeleitet. Kein Android-Build wurde gemacht (Capacitor ist im Prototyp nicht einmal installiert). Marktdaten zur Monetarisierung sind Erfahrungswerte, nicht recherchiert. Der Handy-Prozessorfaktor "3–5×" ist ein Erfahrungswert. Die erste Handlung von v2 ist deshalb die Messung, nicht der Code.

---

## 13. Wie es weitergeht

1. `03_Roadmap.md` lesen — Phasen, Meilensteine, Go/No-Go-Tor.
2. `CLAUDE.md` und `.claude/agents/` sind eingerichtet; `06_Prompt-Vorlagen.md` zeigt, wie die Agents angesprochen werden.
3. Erster Prompt an den Architect: Projektgerüst `v2/web` nach `02_Architektur_v2.md` Stufe 0 anlegen.
4. Parallel: Prototyp-Build auf dem iPhone in Safari öffnen und die Debug-Zahlen (F3-Overlay) notieren — die erste echte Messung des Projekts.
