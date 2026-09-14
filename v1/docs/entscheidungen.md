# Entscheidungslog v1

Jede Architektur- oder Design-Entscheidung mit Datum und Begründung, damit nichts zweimal diskutiert wird. Neueste oben. Sechs Felder je Eintrag: Nummer, Entscheidung, Begründung, verworfene Alternative, Abnahmekriterium, „Auf dem Gerät zu prüfen".

Das Log des verworfenen v2-Aufbaus liegt unter `v2/docs/entscheidungen.md` (E-001–E-061 dort). Es wird nicht fortgeführt; technische Lehren daraus stehen in `CLAUDE.md`.

## 2026-09-14 — Neustart: v1 als Nachfolger des Prototyps

| # | Entscheidung | Begründung | Alternative (verworfen) |
|---|---|---|---|
| E-001 | **Arbeitsordner ist `v1/`, eine Kopie von `prototype/` (Stand 13.09.2026, Commit `f3c3c52`, ohne `node_modules/` und `dist/`).** `prototype/` bleibt eingefroren als Referenz, `v2/` bleibt eingefroren als Nachschlagewerk | Patrick 14.09.: „Ich fand den Prototyp besser gelungen, Spinne war anders, Greifen war mit Saugen etc. v2 würde ich nur noch zum Nachschlagen nutzen, Prototyp liegen lassen und v1 als Nachfolgeversion des Prototyps öffnen und damit weiterarbeiten." | Im Prototyp selbst weiterbauen (dann geht die Referenz verloren); v2 weiterführen; **vom Stand 09.09. kopieren** — so stand es zuerst hier, und so stand auch der Hauptcheckout, der 174 Commits zurücklag. Patrick hat am 14.09. den aktuellen Stand gewählt: Die 132 Prototyp-Commits vom 10.–13.09. (Platzumbau, Ostmulden, Lego-Mulden, Lambert auf Befehl, Rückbau auf die Sichelkralle) sollen mit. |
| E-002 | **Spielgefühl des Prototyps ist Maßstab:** Spinne (Sensorkugel + Fixed Joint), Pendel, Kamera bleiben; Änderungen nur auf ausdrücklichen Wunsch, in kleinen, einzeln auf dem iPad abgenommenen Schritten | Die v2-Spinne (kinematisches Mitführen mit Interpolation in die Korbmitte, später dynamischer Körper an Feder) fühlte sich schlechter an und wurde zweimal zurückgenommen | Griff-Kern „modernisieren" |
| E-003 | **Agenten nach Themenordnern** (`orchestrator`, `bagger`, `welt`, `ui`, `qa`) statt nach Schichten wie in v2 | Der Prototyp ist nach Themen geordnet; eine Schichtenteilung gäbe es nur nach einem Umbau, den niemand will | sim/art/ui aus v2 übernehmen |
| E-004 | **Technische Rapier- und Safari-Lehren aus v2 gelten weiter** (Startpose, Treffer sammeln, Impuls statt setLinvel, gemeinsames Schlafen, Achtkant, touch-action none, Geister-Zeiger-Sicherung) — Liste in `CLAUDE.md` | Sie beschreiben Eigenschaften von Rapier und Safari, nicht der v2-Architektur; jede davon hat im v2-Test einen konkreten Fehler behoben | Bei null anfangen |

| E-005 | **v1 wird auf GitHub Pages unter `/v1/` veröffentlicht** (`pripadagmbh-ctrl.github.io/schrottplatz-app/v1/`); die Root-URL zeigt weiter den Prototyp, `/v2/` bleibt bestehen. Vite-`base` in `v1/vite.config.ts` auf `/schrottplatz-app/v1/`, Root-Workflow baut drei Ziele | Patrick 14.09.: „v1 einen eigenen Pfad." Der Prototyp bleibt so als spielbare Referenz auf dem iPad, und ein v1-Stand kann nie versehentlich die bewährte Version überschreiben | v1 ersetzt die Root-URL |

Abnahmekriterium: `v1/` läuft mit `npm run dev`, `npm test` ist grün (9 Tests des Prototyps), die fünf Agenten werden von Claude Code aufgelistet, nach Push auf `main` ist `/v1/` erreichbar und die Root-URL unverändert.

Auf dem Gerät zu prüfen: `/v1/` auf dem iPad öffnen — spielt es sich exakt wie der Prototyp auf der Root-URL?

## 2026-09-14 — Platz und Spinne

Ab hier bekommt jeder Eintrag einen eigenen Abschnitt statt einer Zeile in der Tabelle.
Grund: Abnahmekriterium und „Auf dem Gerät zu prüfen" gehören zum einzelnen Eintrag und
nicht gesammelt ans Ende eines Tages — sonst weiß man ein halbes Jahr später nicht mehr,
welche Prüfung zu welcher Entscheidung gehörte. E-001 bis E-005 bleiben, wie sie sind.

### E-006 — Rückwände raus, nur Seitenwände (13.09.2026, nachgetragen 14.09.2026)

**Entscheidung.** Die vier Sortiermulden haben nur Seitenwände, keine Rückwand.
`shareEast: true` an `r_alu`, `r_va`, `r_cable` und `r_copper`
(`src/world/containers.ts:320–327`). Der eine Schalter wirkt an zwei Stellen: Die
Betonlego-Steine der Rückwand werden gar nicht erst gesetzt
(`src/world/containers.ts:763–768`), und `bayObstacles` lässt den Hinderniseintrag
`„<Mulde> Stirn"` weg (`src/world/obstacles.ts:171–183`). Drei der vier tragen zusätzlich
`shareSouth`: Nachbarmulden teilen sich die Trennwand, zwischen zwei Fraktionen steht also
eine Wand und nicht zwei.

**Begründung.** Ansage Patricks vom 13.09.2026 zum Bild: „Rückwände raus, nur
Seitenwände." Was das im Spiel bewirkt: Die Wand, die verschwindet, war die höchste an der
Mulde — 3,00 m, nämlich 2,00 m Wandhöhe plus die zwei Zusatzlagen aus `RUECKWAND_PLUS`
(`src/world/obstacles.ts:64`) —, und sie stand genau zwischen dem Bagger und der Mulde.
Aus dem Sitz sah man auf Beton statt in die Mulde: Wie voll sie ist, war nicht zu
erkennen, und eingefüllt wurde blind über die Kante. Jetzt liegt der Füllstand offen, und
die Spinne kann von der Seite einfahren, statt nur senkrecht von oben über eine
3-m-Kante. Weil derselbe Schalter auch den Hinderniseintrag zieht, bleibt keine
unsichtbare Wand stehen — der Fehler, der am 13.09. an der Presse einen halben Tag
gekostet hat (`test/collision.test.ts:369`). Die Flanken bleiben stehen; sie sind es, die
die Fraktionen trennen, und mehr braucht es nicht.

**Verworfene Alternative.** Rückwände stehen lassen und weiter blind über die Kante
einfüllen; oder die Rückwand nur auf Flankenhöhe kürzen — das halbiert das Sichtproblem
und lässt das Hindernis stehen. Bewusst in Kauf genommen: Was beim Einfüllen über die
hintere Kante geht, fällt jetzt auf den Platz. Gemessen ist 0,5 m hinter der
Rückwandlinie freie Fläche, keine Nachbarreihe — der frühere Grund für die zwei
Zusatzlagen entfällt damit nicht, sondern wird gegen die Sicht eingetauscht. Der Preis
ist der kleinere: Was auf dem Platz liegt, sieht man und kann es aufnehmen.

**Abnahmekriterium.** Messung `docs/messungen/2026-09-14_sortiermulden-rueckwaende.md`:
Bei allen vier Mulden meldet `hitsObstacle` auf der Rückwandlinie und 0,5 m dahinter
„frei", beide Flanken sperren, der Innenraum ist frei. Dazu `npm test` grün (26 Dateien,
251 Tests), `npm run build` grün, darunter `test/lambert.test.ts:145` („räumt die Box leer
und fährt das Material in die Mulde an der Ostwand"). **Noch kein eigener Wächter:** Dass
die Rückwand fehlt, hält bisher nur die Messung fest, kein Test — offener Auftrag an
`welt`/`qa`, Wächter „die vier Sortiermulden haben nur Seitenwände". Kein Widerspruch zu
den Silos an der Ostwand: Die behalten ihre Stirnwand samt Zusatzlagen, und
`test/collision.test.ts` wacht darüber weiter („lässt die Silos zum Platz hin offen", „die
Ruecknwand ist hoeher als die Flanken").

**Auf dem Gerät zu prüfen.** Vom Sitz aus über die vier Mulden schauen: Ist von jeder der
Füllstand zu sehen, ohne den Oberwagen zu drehen? Lässt sich die Spinne von der Seite
hineinführen, ohne irgendwo an Luft hängenzubleiben? Und holt Lambert die Mulden noch
leer, oder stört ihn die offene Rückseite?

### E-007 — Zapfen statt breiter Ring an der Spinne (14.09.2026)

**Entscheidung.** Die Zähne hängen am Zapfen statt am Gelenkring: Zapfenradius 0,40 m
statt 0,757 m, Aufhängung auf −1,05 m statt −0,90 m, acht Segmente statt sechs; „zu" ist
die Spreizung 0,5495 statt 0, „offen" 1,555 statt 1,25. Die Traverse endet bei −0,80 m
statt −0,95 m. Die Zylinderanlenkung ist dafür neu abgetastet: Anlenkkreis 0,68 m, Bock
auf −0,40 m, Lasche 0,22 m unter dem Bolzen und 0,20 m heraus.

**Begründung.** Ansage 13.09.2026: „mich stört, dass die Zähne so weit oben angeordnet
sind und der Stempel/Traverse so weit unten rausschaut und das Ladevolumen bei geöffneter
Spinne verkleinert bzw. die Spinne dadurch nicht richtig eintauchen kann", und tags
darauf: „ich hätte die Zähne gerne eher unten am Zapfen verortet." Gemessen
(Ring → Zapfen): Eintauchtiefe der offenen Spinne **1,06 m → 1,54 m**, Korbtiefe
geschlossen **1,24 m → 1,78 m**, tiefster Punkt **2,14 m → 2,83 m**. Die Öffnungsweite
bleibt bei **3,38 m** — an ihr hängen Presskammer und Muldenbreiten, sie war die
Nebenbedingung der Suche und nicht ihr Ergebnis. Der alte Ringradius war übrigens keine
Wahl, sondern ein Zwang: Sechs Segmente krümmen sich um genau 0,757 m nach innen, und nur
dort trafen sich die Spitzen. Ein schlankerer Zapfen verlangt deshalb mehr Krümmung, also
mehr Segmente — und „zu" ist nicht mehr die Spreizung 0.

**Verworfene Alternativen.** Nur die Traverse kürzen: ändert das Eintauchen um 15 cm und
die Korbtiefe gar nicht. Die Öffnung auf den vollen Weg von 1,25 rad ab „zu" stellen:
gäbe 3,93 m, und die Presse nimmt sie dann nicht mehr auf. Anlenkung aus der stärksten
gefundenen Familie nehmen (Schließmoment 2,7-fach): braucht Anlenkkreis 0,99 m und eine
Lasche von 0,45 m — also genau den breiten Schirm über dem Korb, der weg sollte.

**Der Fehler, der dabei aufgefallen ist.** Das Rig und der Bagger drehten den Gelenkpunkt
um `-(Spreizung − ZU)` statt um `-Spreizung`. Solange „zu" die Spreizung 0 war, war
beides dasselbe, und der Abzug stand unbemerkt im Code. Am Zapfen ist „zu" 0,5495: Die
gezeichnete Kralle stand damit **31 Grad weiter zu als die gerechnete**, schoss
geschlossen 76 cm über die Achse und griff im Spiel neben ihrem eigenen Kollider. Dagegen
steht jetzt ein eigener Wächter in `test/greifer.test.ts`, der Szenengraph und
`clawPoint` über den ganzen Weg vergleicht; mit dem alten Abzug meldet er 895 mm
Abweichung.

**Wie die Anlenkung gefunden wurde.** Die Werte vom 13.09. waren für den breiten Ring und
den Schwenkbereich 0…1,25 gesucht worden; am Zapfen brach der Hebelarm auf 3 mm ein — ein
Totpunkt, an dem die Schale feststeht, gleich wie viel Druck anliegt. Neu abgetastet
(`tools/anlenkung-abtastung.ts`) unter denselben vier Bedingungen wie beim ersten Mal
(frei am Gussblock vorbei, steil, kein Totpunkt, größter Hebelarm geschlossen) und zwei
Schranken aus der Bauform: Der Anlenkbock darf nicht breiter werden als der alte Ring,
und die Lasche muss auf dem Rücken des ersten Segments Platz haben. Ergebnis: Hub
0,2761 m, Neigung höchstens 7,15°, Hebelarm nirgends unter 0,1969 m, Schließmoment
1,446-fach — und der Zylinder fährt zum Schließen aus, also in der starken Richtung.

**Abnahmekriterium.** Die vier Wächter in `test/greifer.test.ts`, die der Zapfen gerissen
hatte, stehen unverändert und sind grün — gefordert / gemessen am 14.09.2026:

| Wächter (Testname) | gefordert | gemessen |
|---|---|---|
| „bleibt in jeder Stellung im eigenen Sektor" | Luft > 0 | 0,0716 rad (statt −2,5133) |
| „fährt zum SCHLIESSEN aus — die Kraft liegt beim Zugreifen" | Hub > 0,15 m | 0,2761 m (statt 0,1529) |
| „steht steil, statt quer über dem Kopf zu liegen" | < 20° | 7,148° (statt 31,432°) |
| „hat einen Hebelarm, der über den ganzen Weg trägt" | > 0,10 m | 0,1969 m (statt 0,0033) |

Die Vergleichswerte in Klammern sind die der alten Anlenkung **nach** dem Vorzeichenfix.
Das ist wichtig: Davor sahen drei der vier Wächter gut aus, weil derselbe Vorzeichenfehler
auch die Lasche in einem falschen Bezugsrahmen einfror. Erst danach war zu sehen, dass der
Hebelarm bei 90 % Öffnung auf 3 mm einbrach.

Dazu `npm test` in `v1/` grün (26 Dateien, 251 Tests, 17,05 s), `npm run build` grün, GLB
neu exportiert. Kein Wächter wurde aufgeweicht, übersprungen oder in seiner Erwartung
geändert. Vollständige Zahlen und drei Vergleichsspalten im Messprotokoll
`docs/messungen/2026-09-14_greifer-anlenkung.md`.

**Auf dem Gerät zu prüfen.** Taucht die offene Spinne jetzt wirklich in den Haufen ein,
statt oben aufzusitzen? Hält sie beim Zufassen, was sie vorher danebengegriffen hat? Sieht
die geschlossene Spinne sauber aus — Spitzen auf der Achse, keine Kralle, die durch ihre
Nachbarin ragt? Passt sie offen noch in die Presskammer und zwischen die Muldenwände — die
3,38 m sind gerechnet, nicht gefahren? Und wirkt der schlanke Zapfen aus dem Sitz heraus
richtig, oder sieht die Aufhängung jetzt zu dünn aus für das, was daran hängt?
