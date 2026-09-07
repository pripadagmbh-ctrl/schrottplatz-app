# Roadmap v2 — zwei Spuren, ein Tor

Stand: 02.09.2026 · Entscheidung: Spur A (Web, Prio 1) und Spur B (Unity, Prio 2 zum Antesten). Rahmenbedingungen: Windows-PC, kein Mac, iPhone als Testgerät, Solo-Entwicklung mit Claude-Agents, Abend-/Wochenend-Rhythmus.

Die Zeitangaben sind Größenordnungen für "ein paar Stunden pro Tag, mit Claude". Bei Vollzeit halbieren sie sich grob.

---

## Phase 0 — Messen, bevor gebaut wird (Woche 1)

Ziel: Die eine Frage beantworten, die kein Test im Projekt beantwortet hat — wie langsam ist die Physik wirklich auf einem Handy?

| Schritt | Was | Fertig, wenn |
|---|---|---|
| 0.1 | Prototyp-Build (`npm run build`) auf einem lokalen Server (`npx vite preview --host`) im selben WLAN, auf dem iPhone in Safari öffnen | Spiel läuft auf dem iPhone, F3-Overlay zeigt Zahlen |
| 0.2 | Notieren: ms pro Physikschritt, fps, nach 0 s / 60 s / 5 min. Zwei Sticks + Greifen gleichzeitig testen | Zahlen liegen in `docs/messungen/0_iphone_prototyp.md` |
| 0.3 | Dasselbe mit den drei billigen QA-Maßnahmen im *Prototyp-Klon* (nicht im Original!): Betonlego-Meshes gemergt, Spots aus, Solver 6/2 Iterationen | Zweite Zahlenreihe daneben |
| 0.4 | Unity Hub + Unity 6 LTS installieren, Android Build Support, ein leeres URP-Mobile-Projekt einmal als APK bauen (Android-Emulator oder später echtes Gerät) | APK existiert; die Werkzeugkette steht |

**Warum iPhone-Safari reicht:** Safari ist bei WebGL und WebAssembly eher konservativer als Android-Chrome. Läuft es dort mit Reserve, läuft es auf Android-Mittelklasse. Die Umkehrung gilt nicht ganz — deshalb ein Android-Testgerät (~150 €) einplanen, bevor es in den Play Store geht.

---

## Phase 1 — Fundament Spur A (Woche 2–3)

Nach `02_Architektur_v2.md`, Migrationsstufen 0–2.

| Schritt | Was | Fertig, wenn |
|---|---|---|
| 1.1 | `v2/web` anlegen: Vite + TS strict + Vitest + ESLint mit Import-Verboten je Schicht | `npm run check` und `npm run lint` grün auf leerem Gerüst |
| 1.2 | Daten-Schicht: `materials.json`, `customers.json`, `cars.json`, `upgrades.json`, `level.json` — Werte aus dem Prototyp übernommen (Portierungsliste Ü) | Schema-Validierung beim Laden; ein Test pro Datei |
| 1.3 | Simulation ohne Renderer: Scheduler, EventBus, GameState, ControlFrame, Rapier-Welt; erster kopfloser Test: "150 Teile spawnen, 600 Schritte, alle schlafen" | Test grün, Physikzeit pro Schritt im Test protokolliert |
| 1.4 | Bagger-Kinematik als reines Modell (~300 Zeilen aus `excavator.ts:1015–1176`), Greifen **kinematisch mitgeführt** (kein Fixed Joint) | Test: "greife Teil, hebe 3 m, trage 5 m, lege ab — kein Ausreißer > 5 m/s" |
| 1.5 | Darstellungsschicht: ViewRegistry, Mesh-Sync mit Interpolation, geteilte Geometrien/Materialien, `dispose()` | Spiel sichtbar; Draw-Call-Zähler < 300 mit 150 Teilen |

**Regel ab hier:** Jede Stufe hinterlässt etwas Spielbares. Kein Feature ohne Test auf Simulationsebene.

---

## Phase 2 — Spur B: Unity-Vergleichsprototyp (Woche 3–4, Timebox 2 Wochen)

Läuft parallel zu Phase 1/3, bekommt aber **maximal zwei Wochen**. Ziel ist nicht ein zweites Spiel, sondern eine Zahl und ein Gefühl.

| Schritt | Was | Fertig, wenn |
|---|---|---|
| 2.1 | Unity 6, URP Mobile-Template, Landscape, ein Platz (Plane + 3 Mulden), 150 Rigidbody-Teile aus `materials.json` (per ScriptableObject importiert) | Szene läuft im Editor |
| 2.2 | Bagger als kinematische Kette (Unterwagen → Oberwagen → Ausleger → Stiel → Spinne), dieselben Rampen/Lastfaktoren wie Spur A, Greifen kinematisch mitgeführt | Greifen → Heben → Ablegen 20× ohne Explosion |
| 2.3 | Zwei virtuelle Sticks + Greif-Knopf nach `04_Stilguide_und_Touch.md` | Bedienbar auf dem Android-Emulator und – wenn vorhanden – Gerät |
| 2.4 | Messung: Physik-ms und fps mit 150 / 300 Teilen (Unity Profiler), Sleep-Verhalten, Ladezeit | Tabelle in `docs/messungen/1_unity_vergleich.md` neben den Web-Zahlen |

**Bewertung nach 2 Wochen** (gemeinsam mit Patrick): Fühlt sich der Greifer besser an? Wie viel schneller ist die Physik wirklich? Wie viel Editor-Handarbeit war nötig, die Claude nicht erledigen konnte?

---

## Phase 3 — Spur A: Spielziel und Steuerung (Woche 4–7)

Nach `01_GDD_v2.md`.

| Schritt | Was | Fertig, wenn |
|---|---|---|
| 3.1 | Tages-System: Morgen-Karte, 4 Fuhren, Feierabend, Abend-Bilanz, Autosave | Ein Tag ist in 12–15 min spielbar und endet mit Bilanz |
| 3.2 | Aufträge (3 Typen Liefern/Räumen/Kunde) + Sterne, aus `missions.json` | Drei Aufträge werden angezeigt, geprüft, belohnt |
| 3.3 | Wirtschaftskorrekturen (4 Zeilen) + Anlieferung/Abholung als datengetriebene Zustandsmaschine | Kupfer-Fuhre bringt ~20–30 % Marge, nicht 45× |
| 3.4 | Touch-Layout v2, Kamera folgt Oberwagen, Bodenring, Safe-Area, ≥ 44 px | Ein fremder Tester bedient das Spiel ohne Erklärung 3 min lang |
| 3.5 | Onboarding Tag 0 (ein Träger → ein Container → erster Kunde), Texte je Eingabegerät | Tester erreicht den ersten Geld-Moment in < 3 min |
| 3.6 | Presse, Zerlegung, Ausbaustufe 1–3 sichtbar (office.ts endlich einbinden) | Büro und Halle erscheinen auf dem Platz |

---

## Go/No-Go-Tor (Ende Woche 7)

Auf dem iPhone in Safari, mit einem vollen Tag (150–250 Teile, 4 Fuhren):

| Kriterium | Go | No-Go |
|---|---|---|
| Bildrate | stabil ≥ 30 fps, Frame < 25 ms (Reserve) | < 25 fps oder Zeitlupe |
| Physik | < 8 ms pro Schritt bei 250 Teilen | > 12 ms |
| Touch | zwei Sticks + Greif-Knopf gleichzeitig ohne Fingerverlust | Finger gehen verloren, Systemgesten stören |
| Speicher | 20 min ohne Absturz | WebView wird beendet |

**Go:** Spur A bleibt Hauptspur, Spur B wird eingefroren (Erkenntnisse ins Backlog).
**No-Go:** Spur B wird Hauptspur. GDD, Daten-JSONs, Stilguide, Touch-Spezifikation und Architektur gelten unverändert; Spur A bleibt als Desktop-/itch.io-Demo erhalten.

---

## Phase 4 — Look, Demo, Feedback (Woche 8–11)

| Schritt | Was |
|---|---|
| 4.1 | Stilpass: Palette ΔE ≥ 25, envMap + ACES, Outline/Bodenring, Piktogramme, HUD-Redesign, Schriften |
| 4.2 | Assets: Kenney-Kits (Fahrzeuge, Props), Hero-Bagger (Kauf oder Auftrag), 5–8 Hero-Schrottteile |
| 4.3 | Desktop-Demo auf itch.io (Web-Build, Tastatur + Maus) + Fragebogen mit 5 Fragen an 20 Tester |
| 4.4 | Auswertung mit dem Game-Designer-Agent → Balancing-Runde, Tutorial-Nachbesserung |

---

## Phase 5 — Store (Woche 12+)

| Schritt | Was |
|---|---|
| 5.1 | Android-Testgerät besorgen; Capacitor (Spur A) bzw. Unity-Android-Build (Spur B); `sensorLandscape`, Icons, Manifest |
| 5.2 | IAP: Free bis Ende Tag 3 → Premium-Unlock 4,99 € (Google Play Billing; Spur A per Capacitor-Plugin, Spur B per Unity IAP) |
| 5.3 | Data-Safety-Formular, Datenschutzerklärung (keine Ads, kein Tracking → schlank), Altersfreigabe |
| 5.4 | Store-Grafik: Icon 512, Feature-Grafik 1024×500, 6–8 Screenshots nach Stilpass, 30-s-Video |
| 5.5 | Interner Test → geschlossener Test (20 Tester, 14 Tage — Google-Pflicht für neue Entwicklerkonten) → Produktion |
| 5.6 | iOS später: Cloud-Build (Unity Build Automation / Codemagic / Capacitor + Codemagic), TestFlight über das iPhone |

---

## Was bewusst nicht in v2 ist

Marktpreisschwankung · Kampagne über Tag 30 hinaus · Kat/Batterie-Zerlegung · Graue Geschäfte · Mehrspieler · 8 Händlerfamilien (→ 3) · Dozer/Stapler/Magnet/große Presse · Fahrspur-Störfall · Nacht/Flutlicht als Notwendigkeit.

---

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Handy-Performance bleibt trotz Maßnahmen zu knapp | Go/No-Go-Tor ist verbindlich; Spur B liegt bereit |
| Zwei Spuren fressen sich gegenseitig die Zeit | Spur B hat eine harte 2-Wochen-Timebox und ein einziges Ziel (Messung + Greif-Gefühl) |
| Scope wächst wieder (1.020-Zeilen-GDD-Reflex) | GDD v2 ist auf 150 Zeilen gedeckelt; jede Zahl braucht Herkunft oder "Fertig, wenn" |
| Spaß ist ungetestet | itch.io-Demo mit 20 Fremden vor jeder Store-Investition |
| Kein Mac | Android zuerst; iOS ausschließlich über Cloud-Build, erst nach Android-Release |
