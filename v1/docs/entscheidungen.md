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

### E-008 — Messwerte im Kommentar nennen ihre Messung; widerlegte Altwerte bleiben stehen (14.09.2026)

**Entscheidung.** Ein Kommentar, der eine gemessene Zahl behauptet, nennt das Protokoll
unter `docs/messungen/`, aus dem sie stammt. Wird eine solche Zahl später widerlegt, wird
sie **nicht gelöscht**, sondern mit Datum und Grund als widerlegt markiert und stehen
gelassen. Umgesetzt in `src/grapple/form.ts:83–99` und
`src/excavator/grappleParts.ts:104–113`.

**Begründung.** Beim Zapfen-Umbau (E-007) standen in genau diesen beiden Dateien
Messwerte, die die Prüfung widerlegte: „Hub 0,26 m, Neigung bis 7,1 Grad, Hebelarm
nirgends unter 0,19 m" und „bis 14° steil, nirgends weniger als 11 cm Hebelarm, Faktor
1,70". Gemessen wurden zu diesem Zeitpunkt 0,1529 m Hub, 31,4° und 3 mm Hebelarm. Die
Kommentare waren also nicht ungenau, sondern falsch — und zwar auf die gefährlichste Art:
Sie beschrieben eine Lösung, die jemand einmal gefunden, aber nie in die Konstanten
übernommen hatte. Wer sie las, hielt das Problem für gelöst. Ein Kommentar, der eine Zahl
ohne Herkunft behauptet, ist damit schlimmer als gar kein Kommentar; Regel 3 („jede Zahl
hat eine Herkunft") gilt ausdrücklich auch für Prosa, nicht nur für Konstanten.

Dass die widerlegten Werte stehen bleiben, hat einen eigenen Grund: Der Faktor 1,70 tauchte
zweimal auf, an zwei Stellen, mit zwei verschiedenen Nachbarzahlen. Gelöscht wäre er beim
dritten Mal wieder aufgetaucht, weil niemand mehr wüsste, dass er schon einmal verworfen
wurde. Als markierter Altwert kostet er drei Zeilen und spart die Diskussion.

**Verworfene Alternative.** Die falschen Kommentare ersatzlos streichen — kürzer, aber die
Zahl kommt wieder. Oder die Werte nur im Messprotokoll führen und die Kommentare ganz
zahlenfrei halten — dann steht die Zahl nicht mehr dort, wo sie gebraucht wird, nämlich
neben der Konstante, die jemand gerade ändern will. Ebenfalls verworfen: den
Kolbenflächen-Faktor weiter zu führen. Das Modell kennt nur Außenradien, kein
Bohrungsmaß; jede Angabe dazu wäre geraten. Ersatzlos gestrichen statt geschätzt.

**Abnahmekriterium.** In `src/grapple/form.ts` und `src/excavator/grappleParts.ts` steht
keine Messzahl mehr ohne Verweis auf `docs/messungen/2026-09-14_greifer-anlenkung.md`, und
die beiden widerlegten Blöcke sind als solche gekennzeichnet. `npm test` grün (27 Dateien,
255 Tests), `npm run build` grün.

**Auf dem Gerät zu prüfen.** Nichts — diese Entscheidung ändert keine Zeile, die das Spiel
ausführt. Sie steht hier, weil sie beim nächsten Greifer-Umbau die halbe Sucharbeit spart.

## 2026-09-14 — M2 Phase A: die zweite Greiferform

### E-009 — Der Fünfschalengreifer kommt in die Vorschau, nicht an den Bagger (14.09.2026)

**Entscheidung.** Die am 13.09.2026 mit Commit `f3c3c52` abgelegte Form — Bauart eines
Fünfschalen-Mehrschalengreifers, Schalenform HO — kehrt zurück, aber **nur als
Vorschaumodell**. Sie lebt in einem neuen Ordner `src/fuenfschalen/` (`teile.ts`, `rig.ts`),
wird über `tools/fuenfschalen/export.ts` nach `src/greifer/fuenfschalen.glb` exportiert und
ist über die Seite `greifer.html` mit Schieberegler und Touch zu drehen und zu öffnen. **Der
Bagger trägt unverändert die Sichelkralle am Zapfen; am gespielten Spiel ändert dieses Paket
keine Zeile.** Drei Dinge wurden an der Form gerichtet, bevor sie gezeigt wird: der Zahn auf
sein Sollmaß 120 × 250 × 80 mm, die Mitteltraverse auf ihr Listenmaß Ø 0,70 × 0,45, der
Stempel auf Ø 0,46 × 0,26.

**Begründung.** Ansage 14.09.2026, nach dem iPad-Test der Sichelkralle am Zapfen: Der
Greifer vom Wochenende war oben besser gebaut, nur unten war Traverse/Stempel zu tief und hat
das Ladevolumen gefressen; und „die Zacken sind spitzer als beim Original." Dazu die Auflage,
unter der Phase A freigegeben wurde: **„erst in die Vorschau, dann ins Spiel."** Der Rückbau
am 13.09. hatte einen Grund, und ein zweiter Greiferwechsel ohne Ansicht wäre der dritte
Umbau derselben Woche.

Was die drei Korrekturen bewirken, ist gemessen
(`docs/messungen/2026-09-14_fuenfschalen-vorschau.md`):

- **Der Zahn war 72 mm breit statt 120.** Dahinter lagen zwei Fehler übereinander: Der
  Sektordeckel rechnete mit `sin(0,9 · 36°) = 0,536`, wo die Geometrie `tan(36°) = 0,727`
  verlangt — ein Punkt mit Abstand r von der Achse und b quer zur Schalenmitte belegt
  `atan(b/r)`, nicht den Sinus. Und er wurde im **geschlossenen** Zustand angewandt, wo die
  Bahn an der Spitze nur 68 mm von der Achse steht, also in genau der achsnahen Zone, die
  schon der Sektortest der Sichelkralle ausnimmt (`if (r < 0.3) continue`, „am Gerät schieben
  sie sich dort aneinander vorbei"). Dieselbe Grenze heißt jetzt `SEKTOR_AB`. Richtig
  gerechnet lässt der Sektor am Zahnfuß **436 mm** zu; der 120-mm-Zahn nutzt davon **11,2°
  von 36°** (vorher 6,9°), Luft 24,8°. Die 120 mm sind also nicht das kollisionsfreie
  Maximum, sondern das Sollmaß der Liste — mehr ginge. Preis sind 6 mm: Die
  Überlappungszone der fünf Zinken wächst von r 0,188 auf r 0,194 m.
- **Patricks Eindruck zur Mittelsäule stimmt — aber nicht für den Korb.** Gemessen nahm sie
  dem Korb 26,4 l von 1.615 l weg, denn unter die Bolzenebene ragen nur Ausleger und Gabeln.
  Sie verengte den **Schlund**: In der Ebene 5 cm über den Bolzen standen 0,464 m² von
  2,488 m² auf Eisen, knapp ein Fünftel dessen, was oben hineinfällt. Das ist jetzt um **18 %**
  gekürzt (0,382 m²), der Nettokorb steigt von 1.588 auf 1.598 l. Weiter geht es nicht ohne
  die Anlenkung: Was noch im Schlund steht, sind zu zwei Dritteln die fünf Ausleger, und die
  müssen bis `STEMPEL_AUGE.r = 0,59` hinaus.
- **Zwei Zahlen des Archivstands waren falsch.** Der Dateikopf nannte 1.195 l Bruttokorb —
  das ist der Inhalt einer Halbkugel von 0,83 m (1.197 l), aber der Korb ist keine: Am
  Äquator steht die Bahn auf r 0,890, und der Kreisbogen wölbt sich über die Kugel hinaus.
  Gemessen sind es **1.615 l**; die 1.200 l der Positionsliste sind der Nenninhalt, weil fünf
  Schalen von 400 mm am Äquator nur gut ein Drittel des Umfangs abdecken. Und die Traverse
  stand im Code mit 0,75 × 0,55 × 0,40, während die Positionsliste derselben Datei Ø 0,70 ×
  0,45 nannte.

**Der Name des Ordners** ist eine Entscheidung für sich: `src/grapple/` ist vom Exportmodell
der Sichelkralle belegt, `src/greifer/` von Vorschau und GLB. `src/fuenfschalen/` heißt nach
dem Ding und ist mit der gespielten Spinne nicht zu verwechseln — genau die Verwechslung, die
am 12./13.09. zwei Greifer nebeneinander hat entstehen lassen.

**Was die Vorzeichenfrage aus E-007 angeht:** In dieser Form steckt der Fehler nicht.
`rig.setOeffnung` dreht um `−schwenk`, `mittellinie` und `anbindungspunkt` rechnen mit
`cos(−schwenk)/sin(−schwenk)`, und mit `rotation.order = "YXZ"` bildet der Szenengraph
denselben Punkt ab wie die Rechnung. Der Wächter steht trotzdem, und zwar weil `ZU = 0` ist:
Genau dann sind `−schwenk` und `−(schwenk − ZU)` dasselbe, der Fehler wäre also unsichtbar —
bis jemand `ZU` anfasst.

**Und die Platzfrage:** Maßgeblich ist der **größte Durchmesser über den ganzen Öffnungsweg**
(3,227 m), nicht die Spitzenweite (2,94 m) — bei Schalen, die sich beim Öffnen nach außen
wickeln, liegt der weiteste Punkt im Bogen und nicht am Ende. Gegen die gebauten Kollider
gehalten ist der Fünfschalengreifer damit **an jeder Stelle des Platzes schmaler als die
heutige Sichelkralle** (3,3805 m) und passt überall dorthin, wo sie heute passt, mit rund 8 cm
mehr Luft je Seite. Kein Behälter und keine Presse muss für ihn geändert werden.

**Verworfene Alternativen.**

- **Die Form gleich an den Bagger hängen.** Verworfen durch Patricks Auflage „erst in die
  Vorschau, dann ins Spiel". Der Rückbau am 13.09. hatte einen Grund, und die Form verfehlt
  bei Zylinderneigung und Hebelarm noch die Zielwerte der Sichelkralle (siehe unten).
- **`clawGeometry.ts` und `grappleParts.ts` mit zurückholen.** Verworfen — das ist die
  gespielte Spinne. Aus dem Archiv kamen nur `teile.ts` und `rig.ts`.
- **Das Modell nach `src/grapple/` legen.** Verworfen, dort liegt das Exportmodell der
  Sichelkralle; die Namen hätten kollidiert.
- **Die Sektorgrenze verletzen, um auf 120 mm zu kommen.** Nicht nötig — rechnerisch passten
  436 mm. Der Deckel war falsch gerechnet, nicht zu eng.
- **Den Wächter `schalenform.test.ts` aufweichen, als der Zahn breiter wurde.** Nicht nötig,
  er kam unverändert aus dem Archiv und blieb grün.
- **Das Urteil „passt auf den Platz" allein gegen die Spitzenweite fällen.** Verworfen;
  maßgeblich ist der größte Durchmesser über den ganzen Weg. Wer nur die Spitzen misst, misst
  2,94 statt 3,227 m — 29 cm zu wenig.

**Abnahmekriterium.** `npm test` in `v1/` grün: **29 Dateien, 272 Tests, 25,07 s** (255
bestehende unverändert, dazu 3 aus `test/schalenform.test.ts` und 14 aus
`test/fuenfschalen.test.ts`). `npm run build` grün. Kein Wächter aufgeweicht, übersprungen
oder in seiner Erwartung geändert.

| Wächter (Testname in `test/fuenfschalen.test.ts`) | gefordert | gemessen 14.09.2026 |
|---|---|---|
| „zeichnet die Schale dort, wo mittellinie sie rechnet" | < 2 mm | < 0,1 mm |
| „bleibt in jeder Stellung im eigenen Sektor" | Luft > 0 | 21,8° von 36° genutzt |
| „baut den Zahn auf sein Sollmaß 120 × 250 × 80 mm" | 120 / 250 mm ± 5 mm | 120,0 / 251,8 mm |
| „fährt zum SCHLIESSEN aus" | Hub > 0,15 m | 0,4389 m |
| „bleibt länger als sein Rohr" | > 0,42 m | 0,5405 m (offen) |
| „steht nicht quer über dem Kopf" | < 39° | 38,90° (bei 40 % Öffnung) |
| „hat einen Hebelarm, der über den ganzen Weg trägt" | > 0,09 m | 0,0924 m (ganz offen) |

Der Vorzeichen-Wächter ist **gegengeprobt**: `−schwenk` testweise durch
`−(schwenk − ZU) − 0.3` ersetzt → rot mit „303,5 mm daneben bei Schale 2, Station 6, Öffnung
0.95"; danach zurückgenommen, alle 14 Tests wieder grün. Ein Wächter, von dem niemand weiß,
ob er fängt, ist keiner.

Alle Zahlen, die zweite Messung der QA und die Befunde stehen in
`docs/messungen/2026-09-14_fuenfschalen-vorschau.md`.

**Was dieser Eintrag ausdrücklich NICHT entscheidet.** Die Form verfehlt zwei Zielwerte der
Sichelkralle: **38,90° Zylinderneigung bei 40 % Öffnung** (Ziel < 20°) und **0,0924 m
Hebelarm ganz offen** (Ziel > 0,10 m). Das ist **vor wie nach dem Umbau identisch**,
gegengerechnet an der Archivfassung, und folgt allein aus der Anlenkung
(`ZYLINDER_AUFNAHME`, `STEMPEL_AUGE`, `OBERE_ANBINDUNG`) — also aus dem Formvertrag, der in
diesem Paket nicht angefasst wurde. Die beiden Wächter stehen deshalb auf dem **gemessenen**
Stand: Sie halten fest, dass nichts schlechter wird, sie behaupten nicht, dass es gut ist.
**Ob die Zylinderaufnahme nach außen rücken soll, entscheidet Patrick** — das wäre eine
Änderung am Formvertrag mit eigener Abnahme. Ebenfalls offen und jeweils eigener Auftrag: die
nicht ausräumbare Presskammer (`src/world/obstacles.ts:247–254` trägt die Presse als volles
Rechteck ein, `top: 2.2` — mit **keinem** Greifer erreicht man den Boden), die vier
unsichtbaren Wände (Kollider folgen den Steinen nicht) und die Größe des GLB (1.273 kB gegen
320 kB der Sichelkralle).

**Auf dem Gerät zu prüfen.** `/greifer.html` auf dem iPad und dem iPhone mini öffnen:

- Sieht der Zahn jetzt aus wie beim Vorbild — kurzer breiter Keil statt Nadel? Er ist von 72
  auf 120 mm gewachsen; ist das genug, oder darf er auf die rechnerisch möglichen 436 mm zu?
- Laufen die fünf Schalen über den ganzen Weg sauber aneinander vorbei, ohne dass sich
  irgendwo zwei Zinken schneiden?
- Schaut unten noch etwas heraus, das den Korb frisst — oder ist der Eindruck vom Wochenende
  („Traverse/Stempel zu tief") weg?
- Lässt sich der Regler mit dem Daumen bedienen, während die andere Hand das Gerät hält, und
  dreht die Ansicht ohne Ruckeln? Das GLB ist knapp viermal so groß wie das der Sichelkralle.
- Und die Frage, an der alles Weitere hängt: **Soll diese Form an den Bagger?** Sie passt
  überall dorthin, wo die Sichelkralle heute passt. Sie ist aber eine andere Mechanik, und
  zwei ihrer Kennwerte sind schlechter als die der Sichelkralle.

Ins Spiel geht nichts, bevor diese Frage beantwortet ist. Bis dahin bleibt der Bagger, wie er
ist.

### E-010 — Der Platz bekommt eine Ausbuchtung, Hallen und einen Verladeplatz (14.09.2026)

**Entscheidung.** Der Platz wird nach `docs/platzkonzept-2026-09-14.svg` neu geordnet. Fünf
Teile:

1. **Die Ausbuchtung.** Hinter dem Bagger wölbt sich die Platzgrenze nach Süden aus, rund
   14 m breit und 9,5 m tief, rundum mit hoher Wand. Darin liegen die beiden Halden —
   Mischschrott und Stahlschrott — voneinander nur durch niedrige Betonlego-Steine
   getrennt, die in der Mitte am höchsten stehen (2,4 m) und zu beiden Seiten auf 0,6 m
   ablaufen. Der Zugriff von einer Halde zur anderen bleibt damit flüssig.
2. **Die Westflanke** trägt drei Mulden: von der Platzmauer nach vorn Alu+Zink, Kabel,
   Kupfer+Messing. Die erste steht mit ihrer Südseite an der Außenmauer und braucht dort
   keine eigene Wand, nur eine Erhöhung.
3. **Die Ostseite** trägt Presse, Müllcontainer und Reifencontainer.
4. **Drei Hallen** an der Nordwand hinter dem Tor, dazu die Brückenwaage direkt neben dem
   Büro. Händler fahren über die Waage in ihre Halle und laden selbst ab.
5. **Die Silo-Reihe** an der Westwand, neun statt acht: E-Motoren, Batterien, Alu, Kabel,
   Kupfer, VA, Holz, Baumisch, Kunststoff. **Stahl entfällt** — Stahlschrott wird direkt
   an der Halde verladen. Zwischen Silo-Reihe und LKW-Spur liegt der **Verladeplatz** mit
   einem zweiten Baggerstand.

Dazu: **Baggertempo von 1,4 auf 3,0–3,5 m/s** (5 auf 11–13 km/h).

**Begründung.** Ansage vom 14.09.2026: Misch- und Stahlschrott hinter den Bagger, die
Presse beim Mischschrott, beides mit hohen Wänden als Ausbuchtung der Platzgrenze. Die
Südmauer ist hinter dem Bagger ohnehin schon auf 4,8 m erhöht (`src/world/yard.ts:44`) —
die Ausbuchtung setzt also dort an, wo die hohe Wand steht, statt eine neue zu erfinden.

Der eigentliche Gewinn ist ein Perspektivwechsel. Die acht Lager-Silos lagen 32 bis 38 m
vom Bagger weg und waren damit totes Gewicht, gemessen mit `tools/platz.ts`. **Diese
Entfernung ist nur ein Problem, solange der Spieler hinfahren muss.** Seit die Händler
selbst in die Hallen fahren und Lambert von dort in die Silos räumt, ist sie richtig: Der
Schwenkkreis muss nur fassen, was durch die Hände des Spielers geht.

Das Tempo folgt daraus. 1,4 m/s sind 5 km/h, also Kettenbagger-Tempo; der Fuchs ist ein
Radbagger und fährt auf dem Platz real 10 bis 15 km/h. Eine Fahrt zum Verladeplatz und
zurück dauert heute rund 50 Sekunden, bei 3,0–3,5 m/s gut 20.

*Nachgemessen am 14.09.2026 (E-012):* Die Schätzung „unter 20" war zu knapp —
bei 35 m je Richtung braucht selbst ein Tempo ohne jede Anlauframpe 21,9 s.
Gemessen sind 22,6 s. Der Wert ist hier richtiggestellt statt das Tempo an eine
grobe Schätzung anzupassen (E-008).

**Verworfene Alternativen.** *Alles in den Schwenkkreis* (Entwurf A, acht Ziele im Kreis
von 8 m): geht geometrisch auf, lässt aber keine zwei Meter zwischen den Zielen — Kipper
und Radlader müssten sich durchfädeln. *Den Platz verkleinern*, um die Wege zu kürzen:
falsch, seit der große Platz seinen Zweck hat. *Die Silo-Reihe näher heranholen*: gemessen
kommen die Mulden dann auf 11 bis 13 m statt 14 bis 17 — besser, aber immer noch Fahrweg,
und es kostet die Hallenzufahrt. *Stahl im Silo lassen*: Stahlschrott ist der größte
Mengenstrom und wird ohnehin an der Halde verladen; ein Silo dafür wäre ein Umweg.

**Zwei Maße, die beim Rechnen aufgefallen sind.** Der Bagger hat nicht nur eine äußere
Grenze, sondern auch eine innere: Unter rund 5,8 m bekommt er den Arm nicht mehr eng genug
zusammen. Reifencontainer (zuerst 4,8 m) und zweiter Baggerstand (zuerst 3,5 m vom Silo)
standen beide zu **nah** und mussten heraus. Und bei einer Halde zählt die **vordere
Kante**, nicht die Mitte — man gräbt sich von vorn hinein. Deshalb dürfen Halden tief sein
und Mulden nicht.

**Abnahmekriterium.** Gerechnet aus dem Konzeptplan, Schwenkband 5,8 bis 9,2 m:

| Ziel | Abstand |
|---|---|
| Halde Mischschrott (vordere Kante) | 8,1 m |
| Halde Stahlschrott (vordere Kante) | 7,2 m |
| Presse | 8,5 m |
| Müllcontainer | 8,8 m |
| Reifencontainer | 7,3 m |
| Mulde Alu+Zink | 8,9 m |
| Mulde Kabel | 7,5 m |
| Mulde Kupfer+Messing | 8,4 m |
| Verladeplatz: Silo-Vorderkante / LKW-Spur | 7,5 m / 7,5 m |

Acht von acht Zielen im Schwenkband, der Verladeplatz symmetrisch zwischen Silo und LKW.
Gezeichnet mit `tools/platzkonzept.mjs`; wer am Platz dreht, rechnet damit nach.

**Auf dem Gerät zu prüfen.** Reicht die Spinne aus dem Sitz an alle acht Ziele, ohne zu
fahren? Läuft der Übergang von Mischschrott zu Stahlschrott über die Trennsteine wirklich
flüssig, oder hakt die Kralle an der 2,4-m-Mitte? Kommst du am Verladeplatz aus dem Silo in
den Container, ohne umzusetzen? Und fühlt sich das höhere Fahrtempo nach Maschine an oder
nach Auto — eine Zahl allein entscheidet das nicht.

### E-011 — Der Weg des Materials: Hallen, Einweisung per Funk, Abholung auf Abruf (14.09.2026)

**Entscheidung.** Material nimmt künftig einen von drei Wegen, und der Spieler entscheidet
mit:

- **Kleinteile, sortenrein** — der Händler fährt selbst in eine Halle und lädt selbst ab.
  Der Spieler weist ihn per Funk ein. Die Hallen sind trocken, die Mulden stehen darin.
- **Halle zu Silo** — **Lambert.** Er ist der Einzige, der in die Halle kommt: Der Bagger
  passt wegen der Deckenhöhe nicht hinein.
- **Silo zu Abholer** — der Spieler mit dem Bagger am Verladeplatz.
- **Großteile und Mischschrott** — immer beim Bagger. Kein Fahrer stapelt einen Träger in
  eine Halle.

Dazu zwei Auslöser für eine Abholung: **Lambert funkt, wenn eine Mulde bei rund 90 % ist**,
und der Spieler kann eine Abholung **jederzeit selbst beauftragen**, auch halb voll.

**Begründung.** Beschreibung des echten Betriebs vom 14.09.2026: Der Mischschrott ist der
Mengenstrom, Metalle sind der kleinere Anteil; es gibt Händler, die sammeln und selten
sortenrein kommen, und solche, die gemischt anliefern; die Metalle lädt man nicht beim
Bagger ab, sondern sie fahren in die Sortierhallen.

Daraus ergibt sich ein Gefälle, das trägt: Der Alltag ist Handarbeit am Mischschrott, und
der sortenreine Händler ist der, bei dem **richtiges Einweisen allein** das große Geld
bringt. Die Belohnung fürs Ausbauen ist damit nicht mehr Umsatz, sondern **weniger Arbeit
bei mehr Ertrag** — und jede gekaufte Halle macht einen Händlertyp bedienbar, den man
vorher von Hand abarbeiten musste. Das gibt dem heute abgeschalteten Ausbau-System
(`src/main.ts:622`, `ALLES_FREI = true`) zum ersten Mal einen Zweck.

Die selbst beauftragte Abholung ist der kaufmännische Zug: wenn viel Geld im Silo liegt und
Geld gebraucht wird, soll man abrufen können, ohne auf Lamberts Meldung zu warten. Das ist
genau die tägliche Entscheidung, die Briefing Kap. 10 verlangt (Kupfercontainer heute
verkaufen?) und die im Spiel bisher fehlt. Damit sie eine Entscheidung bleibt und nicht zur
Gewohnheit wird, braucht sie zwei Gegengewichte: **Teilladungen kosten** — der Abnehmer
rechnet je Fahrt, nicht je Tonne — und **der Preis schwankt** (Briefing Kap. 10.1). Ohne
beides ruft man immer sofort ab.

**Verworfene Alternativen.** *Einweisung über ein Menü in mehreren Ebenen*: zu langsam für
einen Spieler, der gerade einen Träger in der Luft hat. Stattdessen zwei, drei große
Schaltflächen, die nur mögliche Ziele zeigen und den gemeinten Ort im Bild aufleuchten
lassen. *Den LKW warten lassen, bis geantwortet wird*: nach rund 20 Sekunden entscheidet
der Fahrer selbst und brummt — ein kleiner Ruf-Abzug, aber das Spiel steht nie still.
*Ein Silo je Fraktion in der Einweisung anbieten*: bei acht Zielen je LKW ermüdet die
Auswahl; drei Hallen reichen, die Feinsortierung in die neun Silos ist Lamberts Arbeit.
*Freie Navigation für Lambert*: daran ist er schon einmal gescheitert. Er bekommt
stattdessen **eine eigene Fahrspur am Westrand, die den Arbeitsbereich des Baggers nie
kreuzt** — berechenbar statt klug, und der Platz wird um seine Spur herum entworfen.

**Neue Fraktionen.** `battery` steht schon im Katalog (`src/materials/catalog.ts:41`,
0,55 €/kg) und bekommt hier nur ein Ziel. **Elektromotoren fehlen noch** — Material, Preis,
Form und Herkunft sind offen. Die Zerlegung reißt heute bereits Motor und Getriebe aus
Wracks (`src/dismantle/carDef.ts`), ohne dass diese Teile ein eigenes Ziel hätten; ob
Verbrennungs- und Elektromotor dasselbe Silo teilen, ist noch zu entscheiden.

**Abnahmekriterium.** Ein sortenreiner Händler wird per Funk eingewiesen, fährt selbst in
die genannte Halle, lädt ab, und der Spieler hat das Material nie berührt. Lambert räumt
die Halle in das zugehörige Silo. Bei rund 90 % kommt sein Funkspruch. Eine selbst
beauftragte Abholung bei halber Füllung bringt messbar weniger je Kilo als eine volle.
Ohne diese drei Nachweise ist der Meilenstein nicht fertig.

**Auf dem Gerät zu prüfen.** Reicht die Zeit, um einen Funkspruch zu beantworten, während
du greifst — oder verpasst du ihn ständig? Ist auf dem iPhone mini zu erkennen, welcher Ort
zu welcher Schaltfläche gehört? Und sieht man Lambert bei der Arbeit, oder sucht man ihn?

**Reihenfolge der Umsetzung.** Lambert zuerst, nicht die Hallen: Er ist der Flaschenhals.
Vier Hallen, die niemand leeren kann, sind wertlos.

### E-012 — Fahrtempo 1,4 → 3,2 m/s, das Fahrwerk bekommt eine eigene Anlauframpe (14.09.2026)

**Entscheidung.** Endtempo des Baggers auf **3,2 m/s** (11,5 km/h), Mitte des in E-010
freigegebenen Bandes (`src/excavator/excavator.ts:116`). Das Fahrwerk löst sich von der
gemeinsamen `RAMP_TIME` und bekommt eine eigene Anlauf- und Auslauframpe
`DRIVE_RAMP_TIME = 0,7 s` (`:130`, angewandt `:1359`). `STEER_RATE` bleibt bei 0,7 rad/s
(`:151`).

**Begründung.** 5 km/h ist Kettenbagger-Tempo; der Fuchs ist ein Radbagger und fährt auf
dem Platz real 10 bis 15 km/h. Eine Fahrt zum Verladeplatz und zurück dauerte 50,3 s und
dauert jetzt 22,6 s.

Die eigene Rampe ist der eigentliche Fund. **Eine Rampe ist eine Zeit, keine
Beschleunigung.** Hätte man nur `DRIVE_MAX` angehoben, wäre die Beschleunigung von
4,67 auf **10,67 m/s² = 1,09 g** gesprungen — Sportwagenwerte für eine 20-Tonnen-Maschine,
und vermutlich genau die Zahl, an der der Gerätetest „Maschine oder Auto" gekippt wäre. Da
`RAMP_TIME` auch Ausleger, Stiel und Oberwagen speist, durfte sie nicht wandern; daher die
eigene Konstante. Kosten: 0,4 s über die Platzquerung.

**Der Wendekreis wächst, und das ist richtig so.** Die Lenkung arbeitet mit fester
Gierrate, der Radius ist damit schlicht `DRIVE_MAX / STEER_RATE`: 2,00 m vorher, **4,57 m**
jetzt. Erst damit stimmt die Geometrie — 2,8 m Radstand bei 32° Einschlag ergeben 4,5 m;
für die alten 2,00 m hätte die Achse 54° einschlagen müssen, was keine gelenkte Achse
kann. Das war ein Panzerbogen.

*Anmerkung zur Herkunft dieser Zahl:* Im Auftrag stand die Annahme, der Bogen werde bei
höherem Tempo **enger**. Das ist falsch — er wird weiter. Die Annahme ist hier
richtiggestellt, damit sie nicht wiederkommt (Regel aus E-008).

**Verworfene Alternativen.** Nur `DRIVE_MAX` anheben (verdreifacht still die
Beschleunigung). `STEER_RATE` auf 1,6 rad/s mitziehen, um die alten 2 m Radius zu halten
(92 °/s — ein Kreisel, und genau das Auto-Gefühl, das vermieden werden sollte).
Rückwärtstempo trennen: hydrostatische Fahrantriebe sind symmetrisch, und bei drehbarer
Kabine ist „rückwärts" für den Spieler kein greifbarer Begriff — eigener Auftrag, falls
gewünscht.

**Nebenwirkungen, gemessen und bewusst gelassen.** Der Ausrollweg wächst von 0,21 m auf
1,11 m — vor einer Mauer muss man deutlich früher loslassen; das ist gewollt und macht die
Maschine schwer. Der Fahrschritt je Bild wächst auf 10,7 cm gegen eine Kollisionsschürze
von 1,3 m, Tunneln ist damit rechnerisch ausgeschlossen. Der Kratzton bei aufliegender
Spinne geht auf Anschlag, weil er mit einem absoluten Gewicht rechnet — mit 11 km/h über
Beton zu schleifen darf lauter sein als mit 5. Am Touch-Stick beginnt der enge Lenkbereich
erst bei rund einem Drittel Stickweg; Drehen auf der Stelle ist mit 14 °/s unverändert.

**Abnahmekriterium.** Sieben Wächter in `test/fahrtempo.test.ts`: Tempo im Band 3,0–3,5;
50 m aus dem Stand unter 20 s und über 14 s; Wenderadius zwischen 3 und 6 m;
**Beschleunigung unter 6 m/s²** — der Wächter gegen die stille Nebenwirkung oben;
Bremsweg unter 2 m; Tempo unabhängig von der Bildrate; Fahrschritt kleiner als die halbe
Kollisionsschürze. Kein bestehender Test hing am alten Tempo.

**Auf dem Gerät zu prüfen.** Einmal quer über den Platz und zurück, Gas durchgedrückt:
**Die Frage ist nicht, ob es schneller ist, sondern ob es dabei noch schwer wirkt.** Zieht
sie an wie etwas Schweres, das in Bewegung kommt, oder schnellt sie los? Dann ein Bogen bei
voller Fahrt — fühlt sich der doppelt so weite Radius nach gelenkter Achse an, oder
vermisst du die alte Wendigkeit? Und das Bremsen vor der Südmauer, auch auf dem iPhone
mini, wo die Bildrate niedriger und der Fahrschritt doppelt so groß ist.

### E-013 — Der Zinken des Fünfschalengreifers wird ein Gussstück (14.09.2026)

**Entscheidung.** Lagerhülse, Zylinderauge und Sichel sind **ein Körper**, kein Klotz mit
angehängter Klinge. Neu ist die Fersenkurve `fersenStationen()`
(`src/fuenfschalen/teile.ts:446–511`): eine kubische Bézier vom Bolzen zur Station 0, die
ihre Tangente von −90° — am Bolzen zeigt der Körper radial nach außen — auf die −8,75°
dreht, mit denen die Schale beginnt. Kein Kreisbogen, weil Punkt und Tangente an beiden
Enden vier Bedingungen sind und ein Kreis nur drei Freiheiten hat. Gebaut wird daraus **ein**
Strang über Ferse und Schale (`:1291–1345`) statt 18 Strebenstücken plus zwei Quadern; die
drei Kehlnähte entfallen, weil ein Gussstück keine hat.

**Begründung.** Patrick am 14.09.2026 vor der Vorschau: „Man sieht, dass der Zinken aus zwei
Elementen besteht. Von der Traverse gehen Metallblöcke weg, und daran ist der Zinken
befestigt. Wahrscheinlich ist aber direkt an der Traverse eine Hülse, wo der Zahn
festgemacht ist — der Zinken und dieser Metallblock, das ist eigentlich ein Gusselement."
Vorbild ist der SENNEBOGEN MG4.1, Schalenform HO, bei dem jede Schale ein durchgehendes
Gussstück ist.

**Was es gekostet hat: nichts.** Kinematik Zahl für Zahl unverändert, Nettokorb 1.598 l
(−0,5 l), größter Durchmesser 3,227 m, Sektorluft sogar 9,66° statt 7,3° durch die längere
Lagerhülse. Und das Modell wurde **schlanker**: 322 → **212 Bauteile**, GLB 1.273 → 1.111 kB.
Ein durchgehender Körper braucht weniger Teile als eine Stückelung.

**Die flache Unterkante bleibt offen — und der Grund ist rechnerisch.** Patricks zweiter
Wunsch war, dass bei offenem Greifer Zinken und Stempel eine Linie bilden. Das ist mit der
Krümmung **nicht** zu erreichen: Wie tief der Zahn offen hängt, folgt aus dem Bolzenradius,
nicht aus dem Bogen — der kürzt sich heraus. Gemessen bleiben 0,566 m Unterschied
(Zahn −2,217 m, Stempel −1,652 m).

Eine Variante B, die es erreicht (3 mm), ist gezeichnet und **nicht eingebaut**: Sie kostet
die Sektorluft (9,7° → 0,7°), die Zylinderreserve (12 → 2 cm) und erzeugt **einen Totpunkt
bei 83 % Öffnung** (Hebelarm 11 mm). Der Totpunkt ist kein Zufall dieser Zahlen: Solange
die Zylinderaufnahme über der Bolzenebene sitzt, liegt er für jede Lösung bei 102–107°
Schwenk, während die flache Unterkante mindestens 113° verlangt. **Die flache Unterkante
ist also erst nach einer neuen Anlenkung zu haben** — was ohnehin offen ist (E-009,
Zylinderneigung 38,9° gegen Ziel 20°, Hebelarm 0,0924 m gegen Ziel 0,10 m).

**Verworfene Alternative.** Variante B sofort einbauen. Ein Totpunkt bei 83 % ist derselbe
Fehler, der am 14.09. an der Sichelkralle behoben wurde (E-007): Die Schale steht fest,
gleich wie viel Druck anliegt. Eine Form, die gut aussieht und nicht greift, ist keine
Verbesserung.

**Abnahmekriterium.** Zwei neue Wächter in `test/schalenform.test.ts`: „läuft von der
Lagerhülse ohne Fuge in die Schale" und „ist am Bolzen am dicksten". Beide haben vor der
Behebung echte Kerben gemeldet — eine Schulterkerbe von 50 mm und eine in der Bolzenmitte
abgeschnittene Nabe, die dem Auge entgangen waren. Die drei alten Prüfungen sind wörtlich
unverändert. `npm test` grün (281 Tests in 30 Dateien), `npm run build` grün.

**Auf dem Gerät zu prüfen.** In der Vorschau (`/greifer.html`) den Greifer einmal ganz zu
und ganz auf fahren: Liest sich jeder Zinken als **ein** Gussstück — Hülse, Auge, Bogen,
Zahn — oder sieht man noch eine Trennung? Von schräg unten: Sitzt die Lagerhülse plausibel
im Material oder wirkt sie aufgesetzt? Und die beiden Bilder nebeneinander
(`docs/f5-greifer-seite.png` gegen `docs/f5-greifer-seite-flach.png`): Ist die flache
Unterkante den Preis wert?

### E-014 — Der Tonkanal wird aus drei Richtungen geweckt, das Overlay meldet nur noch Hörbares (14.09.2026)

**Entscheidung.** Der `AudioContext` wird geweckt bei jeder Nutzergeste, bei
`visibilitychange`/`pageshow`/`focus` und über `ctx.onstatechange` am Kanal selbst
(`src/audio/audioManager.ts:62–69`, `:202`). Nach jedem `resume()` wird nach 250 ms und
1200 ms **nachgesehen** statt vertraut und notfalls nachgeschoben. Kommt der Kanal zurück,
werden die Dauertöne ersetzt. Nach drei vergeblichen Weckrufen wird der Kanal beim nächsten
Antippen neu gebaut. **Hörbar gilt ausschließlich `running`** — geprüft wird nicht gegen
eine Liste stummer Zustände, sondern umgekehrt, damit auch ein künftiger unbekannter
Zustand als weckbar gilt (`src/audio/tonzustand.ts:22–38`). Die Overlay-Zeile ist eine
eigene, prüfbare Funktion (`src/core/debugOverlay.ts:12`).

**Begründung.** Patrick fotografierte am 14.09.2026 auf dem iPad das Debug-Overlay:
`Ton: interrupted · Musik an (laeuft)`. Der Kanal war unterbrochen, das Spiel meinte, es
spiele. Drei Ursachen lagen übereinander:

1. **Der `visibilitychange`-Handler für den Ton fehlte vollständig.** In v1 gab es genau
   zwei solche Handler — einer lässt die Touch-Sticks los, einer sitzt in der
   Greifer-Vorschau. Keiner fasste den Ton an. Die v2-Lehre aus `CLAUDE.md`
   („`AudioContext.resume()` bei `visibilitychange`") war in v1 nie umgesetzt.
2. **Der einzige Weckruf hing an einer Nutzergeste** und wurde nie nachgeprüft. Fällt der
   Ton mitten im Spiel aus, gibt es keine Geste, an der man sich festhalten könnte. Und
   `resume()` wurde einmal angestoßen, der Fehlerfall mit `.catch(() => {})` verschluckt —
   auf iOS meldet `resume()` auch dann Erfolg, wenn der Kanal gleich wieder stumm wird.
3. **Warum die Anzeige log:** `Music.start()` steigt bei `if (this.running) return;` sofort
   aus. Nach der Unterbrechung stand das Flag weiter auf `true`, also half selbst die Geste
   der Musik nicht, und die Diagnose meldete stur „laeuft".

*Nebenbefund zur Vermutung im Auftrag:* `interrupted` fiel formal **nicht** durchs Raster,
`!== "running"` deckte es mit ab. Die Lücke lag nicht im Vergleich, sondern darin, dass
niemand ihn auslöste.

**Verworfene Alternativen.** Nur auf `visibilitychange` reagieren — deckt den Ausfall mitten
im Spiel nicht ab, weil Anruf und Kontrollzentrum die Sichtbarkeit der Seite nicht
zuverlässig ändern. Bei jeder Unterbrechung sofort einen neuen Kanal bauen — das reißt die
Musik jedes Mal an den Anfang zurück; der Neuaufbau ist die letzte Rettung, nicht der erste
Griff.

**Abnahmekriterium — auf dem Gerät bestanden, 14.09.2026.** Alle drei Fälle auf iPad und
iPhone mini geprüft: Bildschirm sperren und entsperren ✓ · App wechseln und zurück ✓ ·
**Kontrollzentrum herunterziehen, ohne die Seite zu verlassen** ✓ (der schwerste Fall, bei
dem der Kanal sich selbst melden muss — der Ton blieb durchgehend da). Das Overlay meldete
danach `Ton: running`, und korrekt `Musik aus`, weil Patrick die Musik selbst abgeschaltet
hatte. Genau dort hätte der alte Stand „laeuft" behauptet. Dazu 13 Wächter in
`test/ton.test.ts`, darunter der Kern: `brauchtWeckruf("interrupted")` muss dasselbe
liefern wie `brauchtWeckruf("suspended")`.

**Der zweite Befund desselben Tages, der nichts mit dem Code zu tun hat.** Auf dem iPhone
mini kam **gar kein** Ton — auch nicht nach dieser Änderung. Ursache war der **physische
Stummschalter** an der Gehäuseseite. In Safari gehorcht ein nackter `AudioContext` diesem
Schalter; das iPad hat keinen solchen Schalter, das iPhone schon. Schalter umgelegt, Ton da.

Das steht hier, damit es beim nächsten Mal niemand im Audiosystem sucht. Offen bleibt die
Frage, ob das Spiel den Schalter **übergehen** soll — technisch geht das über ein stummes
HTML-Audio-Element, das die Tonausgabe in eine andere Kategorie hebt. Das wäre ein Eingriff
in eine bewusste Entscheidung des Spielers und ist deshalb keine reine Technikfrage.

**Auf dem Gerät zu prüfen.** Erledigt, siehe oben. Beim nächsten Gerätetest nebenbei
mitnehmen: Steht in der Tonzeile eine Zahl bei „Weckrufe", war `resume()` mindestens einmal
vergeblich — dann sind die Fristen 250/1200 ms zu knapp und gehören verlängert.

### E-015 — Ziel ist eine mobile App, der Browser ist Zwischenlösung (14.09.2026)

**Entscheidung.** Patrick am 14.09.2026: „Die Browser-Lösung ist nur Zwischenlösung, Ziel
ist Mobile App." Damit gilt ab sofort: **Browser-Krücken werden nicht mehr gebaut**, wenn
die App dieselbe Sache sauber löst. Der Browser bleibt die Arbeits- und Testumgebung, nicht
das Ziel.

**Der Anlass.** Auf dem iPhone kam kein Ton, Ursache war der physische Stummschalter
(E-014). Im Browser ließe sich das nur über eine Krücke übergehen — ein stummes
HTML-Audio-Element, das die Tonausgabe in eine andere Kategorie hebt. In einer App ist es
keine Krücke, sondern eine Einstellung: Die Audio-Session wird auf *Playback* gesetzt, und
damit spielt das Spiel legitim weiter, auch wenn das Gerät stumm gestellt ist. **Die Krücke
wird deshalb nicht gebaut.**

**Der Stand, gemessen am 14.09.2026.** `capacitor.config.json` existiert (App-ID
`de.pripada.schrottplatz`, Name „PRIPADA Schrottplatz", `webDir: dist`), und `package.json`
kennt `android:add`, `android:sync`, `android:open`. Aber: **keine Capacitor-Pakete in den
Abhängigkeiten**, **keine Plattformordner** `android/` oder `ios/`, und die Konfiguration
deckt **nur Android** ab. Die Skripte würden heute ins Leere laufen. Es ist ein Platzhalter,
kein Gerüst.

**Das Hindernis bei iOS.** Patrick testet auf iPad und iPhone mini, arbeitet aber auf
Windows. **Eine iOS-App lässt sich auf Windows nicht bauen** — Xcode gibt es nur auf macOS,
und das Signieren führt ebenfalls dort vorbei. Drei Wege: ein Mac (gekauft oder gemietet);
macOS-Läufer in der CI, wofür es bei GitHub Actions schon einen Workflow im Projekt gibt;
oder ein Bezahldienst. In jedem Fall ein Apple-Entwicklerkonto, ohne das die App nur sieben
Tage auf dem eigenen Gerät bleibt. **Android baut dagegen direkt auf dem Windows-Rechner.**

**Was die App nicht bringt, damit die Erwartung stimmt.** Capacitor macht das Spiel **nicht
schneller** — es ist dieselbe WebKit-Engine wie in Safari, nur ohne Adressleiste. Die
14,6 ms je Bild, die am 14.09. weder Physik noch Grafik zugeordnet werden konnten, wandern
unverändert mit. Wer Bildrate sucht, sucht sie nicht in der Verpackung.

**Was sie bringt.** Audio-Session statt Stummschalter-Krücke; volle Bildfläche ohne
Browser-Rahmen und ohne versehentliche Safari-Gesten; Offline-Betrieb und ein Symbol auf dem
Startbildschirm; ein Speicherstand, der nicht verschwindet, wenn Safari aufräumt.

**Verworfene Alternative.** Das stumme HTML-Audio-Element jetzt bauen, um den Stummschalter
im Browser zu übergehen. Es wäre ein Eingriff in eine bewusste Entscheidung des Spielers,
und es wäre Arbeit an einer Umgebung, die verlassen werden soll. Stattdessen steht in
`docs/` der Hinweis, dass am iPhone der Schalter zu prüfen ist.

**Abnahmekriterium.** Keines für diesen Eintrag — er hält eine Richtung fest, kein Bauwerk.
Wann die Verpackung angegangen wird, ist offen; der Stand oben ist der Ausgangspunkt.

**Auf dem Gerät zu prüfen.** Nichts. Sobald ein erstes Paket gebaut ist, gehört an diese
Stelle: startet die App ohne Browser-Rahmen, spielt der Ton bei stumm gestelltem Gerät, und
überlebt der Speicherstand einen Neustart.

### E-016 — Erst die Welt, dann der Kreislauf, dann die App (14.09.2026)

**Entscheidung.** Die Arbeit läuft in drei Abschnitten, in dieser Reihenfolge:

**Abschnitt 1 — Die Welt.** Platz und Anordnung · Bagger · Schrott · Maschinen. Das ist
das Wichtigste und kommt zuerst. Patrick am 14.09.2026: „Erstmal ist der Platz, die
Anordnung, Bagger, Schrott und Maschinen das Wichtigste."

**Abschnitt 2 — Der Kreislauf.** Vier Punkte, an denen sich messen lässt, wann das Spiel
„fertig" genug für eine App ist. Die Messlatte: *Eine Schicht lässt sich von Anfang bis
Ende spielen, und jede Zahl stimmt.*

| | warum es zählt |
|---|---|
| Die Zahlen stimmen | Das Container-Schild rechnet mit Reinheit², ausgezahlt wird mit ³ (`materials/purity.ts:26` gegen `economy/account.ts:138`). Wer das einmal merkt, glaubt keiner Anzeige mehr — auch den richtigen nicht |
| Der Kipper kippt sauber | Bis zu 141 km/h Ladung quer über den Platz, an der **ersten** Station des Kreislaufs |
| Der Tag hat ein Ende | Die Uhr läuft endlos im Kreis (`world/daylight.ts:52`). Keine Bilanz, keine Pacht, kein Ziel |
| Geld hat einen Zweck | `ALLES_FREI = true` (`main.ts:622`) — alle acht Ausbauten ab dem ersten Bild gekauft. Der Kontostand ist eine Zahl ohne Folgen |

**Abschnitt 3 — Die Verpackung.** Erst Android als Probelauf (geht ohne Mac und ohne
Entwicklerkonto direkt auf dem Windows-Rechner), dann iOS. Stand und Hindernisse in E-015.

**Begründung.** Der Platz und die Maschinen sind das, was in jedem einzelnen Bild zu sehen
ist. Ein Spielsystem lässt sich nachrüsten, ohne dass jemand das Vertrauen verliert; eine
Welt, die nach Bauklötzen aussieht, prägt den Eindruck ab der ersten Sekunde. Dazu kommt
ein praktischer Grund: Platz, Bagger und Greifer sind gerade in Arbeit und offen — sie
jetzt fertigzumachen ist billiger, als sie liegenzulassen und später wieder hineinzudenken.

**Verworfene Alternative — und sie ist gut begründet, deshalb steht sie hier.** Die
Bestandsaufnahme vom 14.09.2026 empfahl die umgekehrte Reihenfolge: **erst die Zahlen**,
weil sich Balancing nicht beurteilen lässt, solange die Anzeige lügt, und weil jede spätere
Arbeit an der Wirtschaft auf falschen Werten aufsetzt. Das Argument bleibt richtig. Patrick
hat anders entschieden, weil die Welt das ist, was man ansieht, und die Zahlen das, was man
nachrechnet. **Die Folge, bewusst in Kauf genommen:** Wer in Abschnitt 1 etwas über Erlöse
oder Reinheit misst, misst gegen eine Anzeige, von der wir wissen, dass sie um bis zu 24 %
danebenliegt. Solche Messungen taugen bis dahin nur zum Vergleich mit sich selbst, nicht als
absolute Zahl.

**Was in Abschnitt 1 offen ist, Stand 14.09.2026.**

*Platz und Anordnung:* der Umbau nach E-010 läuft — Ausbuchtung, Trennsteine, drei Mulden,
Silo-Reihe auf neun, Verladeplatz, drei Hallen, Waage ans Büro.
*Bagger:* Positionsliste und Namen (heute **0 von 117 Bauteilen** benannt), Räder als erste
Baugruppe, danach die sieben weiteren aus dem Baggerkonzept. Budget: von 117 auf rund 250
Bauteile, von 9.980 auf rund 40.000 Dreiecke — gemessen am Gerät, siehe E-010 und das
Baggerkonzept.
*Greifer:* Zahnwinkel, Facetten und Anlenkung laufen in einem eigenen Arbeitsbaum.
*Schrott:* Teile liegen beim Start ineinander; die Ballen aus der Presse sehen „zu sauber"
aus; die Formen der Schrottteile sind seit dem Prototyp unverändert.
*Maschinen:* Presse, Radlader und die Kundenfahrzeuge. Ein Kunden-LKW hat heute **mehr
Geometrie als der Bagger** — das Verhältnis stimmt nicht.

**Drei Dinge, die jetzt billig sind und später teuer.** Sie gehören in Abschnitt 1
mitgedacht, auch wenn sie nicht zur Welt zählen:

1. **Das Speicherformat.** Solange niemand spielt, kostet eine Änderung nichts. Danach
   kostet sie Fortschritt und Vertrauen. Ein Schema mit Migrationspfad existiert bereits.
2. **Die Touch-Bedienung.** In der App ist sie die einzige Eingabe. Was am Tablet hakt,
   hakt dort dauerhaft — der enge Lenkbereich hat sich mit E-012 bereits verschoben.
3. **Die 14,6 ms je Bild**, die weder Physik noch Grafik sind (gemessen am 14.09.: Frame
   21,0 ms gegen 6,4 ms Arbeit). In Safari lässt sich das dem Browser zuschieben, in der
   App nicht — es ist dieselbe Engine.

**Abnahmekriterium.** Keines für diesen Eintrag; er hält eine Reihenfolge fest. Abschnitt 1
gilt als abgeschlossen, wenn Platz, Bagger, Greifer, Schrott und Maschinen je einen
Gerätetest durch Patrick bestanden haben. Abschnitt 2 gilt als abgeschlossen, wenn die vier
Punkte oben nachweisbar erfüllt sind.

**Auf dem Gerät zu prüfen.** Laufend, je Paket — dieser Eintrag ersetzt keinen Gerätetest,
er ordnet sie nur.

---

### E-017 — Fahren schaltet über zwei Pedale unten in der Bildmitte (14.09.2026)

**Entscheidung.** Unten in der Bildmitte stehen zwei gleich große Pedale. Sie sind
Umschalter und Anzeige in einem — Gas geben sie nicht. Ein Tipp macht den **linken
Stick** zu Gas und Lenkung; noch ein Tipp gibt ihm Hauptarm und Oberwagen zurück.
Eingeschaltet leuchten beide Pedale bernsteinfarben und ihre Trittplatten stehen
unten, wie durchgetreten. Kein Zeitablauf, kein Rückfall von selbst, immer sichtbar.

**Begründung.** Zwei Vorgänger sind an genau zwei Dingen gescheitert, und dieser
Entwurf heilt beide:

- Der **Fahrmodus per Doppeltipp** (bis zum 14.09. vormittags) fiel nach vier
  Sekunden Untätigkeit von allein zurück und war nirgends im Bild zu sehen. Man
  wusste nie, woran man war.
- Die **Fahrfläche unten links** (14.09. mittags) kostete dauerhaft ein Fünftel des
  Bildes und einen dritten Stick. Patrick am Gerät: „das ist nicht so cool für den
  User."

Der Zustand steht jetzt im Bild, und er ändert sich nur von Hand.

**Warum die Bildmitte geht, obwohl der Daumen dort nicht hinreicht.** Gemessen am
14.09. reicht der Daumen von der unteren Ecke 478 Punkte weit; die Mitte des iPad
quer liegt bei 590 — ohne Umgreifen unerreichbar. Das Pedal wird aber **einmal
angetippt, nicht gehalten**; dafür darf man umgreifen. Halten müsste man es nur,
wenn es selbst das Gas gäbe — und genau das tut es nicht. Patrick hatte das vorher
so entschieden: „Die beiden Pedale sind nur visuell, gefahren wird das Ding
weiterhin mit dem Dommel."

**Verworfene Alternativen.**

- Eigene Fahrfläche unten links, 400 × 200 px — kostete zu viel Bild (abgelehnt am Gerät).
- Fahrmodus per Doppeltipp mit Vier-Sekunden-Ablauf — unsichtbar, fiel von selbst zurück.
- Gas und Lenken als fünfte und sechste Achse im Steuerungsmenü — dann könnte man
  sich das Fahren versehentlich wegstellen.
- Beschriftung auf den Pedalen — der Zustand soll ohne Wort lesbar sein, an Farbe
  **und** Form. Die Tests bewachen beides.

**Wie die Überlagerung gelöst ist.** Nicht seitlich ausgewichen, sondern gestapelt:
Die Pedale bekommen den untersten Streifen, Griff-Info und Ladeanzeige rücken auf
Touchgeräten darüber (`index.html:44–52`). Auf der Maus-Fassung bleibt alles, wo es
war. Beide Pedale sind 44 px in jede Richtung groß, mit `box-sizing: border-box`,
damit die Zahl auch das Sichtbare meint.

**Abnahmekriterium.** Patrick schaltet auf dem iPad ein und aus, ohne zu zögern, und
weiß in jedem Moment am Bild, ob er fährt oder arbeitet. Auf dem iPhone mini
überdeckt nichts die Griff-Info.

**Auf dem Gerät zu prüfen.**

1. Tipp auf ein Pedal — leuchten beide sofort, stehen die Trittplatten unten?
2. Linken Daumen irgendwo links aufsetzen und ziehen: fährt sie an, ohne Ruck?
   Lenkt sie in die erwartete Richtung?
3. Pedal antippen, **während** der linke Daumen liegt: fühlt sich das Loslassen des
   Sticks wie „einmal neu aufsetzen" an oder hakelig?
4. Zwei, drei Minuten normal arbeiten: fragst du dich irgendwann, ob Fahren an ist?
5. iPhone mini quer: verdecken die Pedale „Greifer: offen" oder die Reinheitsanzeige?

**Offen.** Größe und Ort der Pedale sind Startwerte nach der 44-px-Regel, keine
Messung — „größer / weiter oben / weiter auseinander" ist je eine Zeile CSS. Und
falls das Umschalten sich zu leise anfühlt: Ein und Aus könnten zwei unterschiedliche
Töne bekommen, dann hört man den Zustand, ohne hinzusehen.

---

### E-018 — Mauerreihen enden bündig, der letzte Stein wird gekürzt (14.09.2026)

**Entscheidung.** Jede Reihe Betonlego wird von Kante zu Kante ausgelegt
(`src/world/legoreihe.ts`, `reihenstuecke()`). Der letzte Stein ist kürzer als
die anderen und trägt **eine** Noppe. Wird der Rest kleiner als 0,25 m, teilen
sich die beiden letzten Steine die Strecke gleichmäßig — einen Splitter gibt es
nicht. Bau, Kollider und Wächter lesen dieselben Zahlen aus derselben Funktion.

**Begründung.** Patrick am Gerät: „Bei jeder Mulde werden immer vollständige
Legosteine gebaut. Das führt dazu, dass die Ausländer immer abstehen." Gemessen
am 14.09.: 0,75 m Überstand vorn an der Muldenflanke, 1,05 m hinten, 0,40 m an
der Rückwand der Ausbuchtung — und an den Platzecken umgekehrt Lücken von 0,4
bis 0,9 m. Ursache: Die Schleifen liefen in ganzen Steinlängen mit 0,4 m Zugabe
und hörten erst auf, wenn die **Mitte** des nächsten Steins schon hinter der
Kante lag.

**Nebenbei behoben.** Der Flanken-Kollider der Mulden stand 0,55 m länger als
die sichtbare Wand — vorn mitten in der Einfüllöffnung.

**Preis.** 1.400 → 1.480 Steine, dafür 2.800 → 2.668 Noppen. Zeichenrufe
unverändert, weil alle Steine einer Gruppe in einem Netz stecken.

**Abnahmekriterium.** Kein Stein steht über eine Kante hinaus, keine Ecke hat
eine Lücke, die Einfahrt misst 9,0 m und endet bündig am Pfosten.

**Auf dem Gerät zu prüfen.** Sehen die Muldenwände an **beiden** Enden bündig
aus?

---

### E-019 — Das Firmenschild wird kleiner und rückt ins Einfahrtsfenster (14.09.2026)

**Entscheidung.** Die Tafel „Rust'n'Reibach" steht auf **(−27,9 | 6,8 | 32)** und
misst **8,0 × 4,0 m** statt 14 × 7 (`src/world/yard.ts:226`).

**Begründung.** Patrick: „Aktuell wird das Firmenschild durch Halle verdeckt",
und davor: „das Firmenschild sollte immer zu sehen sein." Aus der Startansicht
(Orbit, 11 m, 24° geneigt, 55°) waren von 91 abgetasteten Punkten der Tafel nur
**69 % frei und 60 % zugleich im Bild**. Das Fenster zwischen Büro (bis x −30,6)
und Halle 1 (ab −17,75) ist auf der Tafelebene 9,4 m breit; davon braucht der
einfahrende LKW 1,55 m. Eine 8 m breite Tafel passt hinein — gemessen **100 %
frei, 100 % im Bild**, auf iPad (4:3) wie iPhone mini (2,16:1).

**Verworfene Alternativen, beide gemessen.** Höher hängen: höchstens 71 % im
Bild, weil die Tafel dann über den oberen Bildrand steht. Nordostecke in voller
Größe: 100 % frei von Bauten, aber 18 % hinter drei Bäumen.

**Offen.** Wenn Patrick die Größe wichtiger ist als die freie Sicht, wandert sie
in die Nordostecke und drei Bäume weichen.

**Auf dem Gerät zu prüfen.** Steht der Schriftzug im Startbild **ganz** im Bild,
ohne zu fahren?

---

### E-020 — Die Scheinwerfermasten stehen in der Mauer, nicht auf dem Platz (14.09.2026)

**Entscheidung.** `einmauern()` (`src/world/daylight.ts:107`) legt jeden Masten
auf die nächste Mauerlinie. Statt einer Fundamentplatte auf der Fahrfläche steckt
er in einem Betonklotz in der Mauerflucht und kommt mit einem Stahlkragen heraus.
Die Lichtstärke steigt von 380 auf **400**.

**Begründung.** Patrick: „Die Scheinwerfer müssen nicht unbedingt auf dem Platz
stehen." Fundamente mitten auf der Arbeitsfläche sind Hindernisse, die niemand
braucht. Nachgerechnet über 14 Arbeitspunkte: Nach dem Versetzen waren noch 95 %
ausgeleuchtet; mit 400 statt 380 sind es wieder **100 %**, ohne dass ein einziger
Punkt heller wird als vorher (`docs/messungen/2026-09-14_flutlicht.md`). Zwei
bisher dunkle Stellen — Waage und VA-Silo — gewinnen sogar.

**Preis.** Sechs Netze mehr (Sockel und Kragen statt einer Platte).

**Auf dem Gerät zu prüfen.** Abends, wenn das Flutlicht angeht: Ist die
Arbeitsfläche so hell wie vorher, und schauen die Masten sauber aus der Mauer?

---

### E-021 — Schneemobile bekommen Kufen und eine Raupe (14.09.2026)

**Entscheidung.** Neue Bauform `kufenRaupe` (`src/world/objektbau.ts:606`,
Katalog `objektkatalog.ts:118`): vorn zwei Kufen auf ±0,40 · Breite mit Federbein
und hochgezogener Spitze, hinten ein Gummiband über zwei Rollen auf der
Mittellinie. Kein Rad.

**Begründung.** Das Schneemobil lief bis heute über `kleinfahrzeug()` und kam
deshalb mit **vier Gummirädern** an — dieselbe Familie von Fehlern wie die
Motorräder („Motorräder kommen aktuell mit vier Reifen an", 14.09.). Ein
Schneemobil hat weder vier Räder noch zwei; es hat Kufen und eine Raupe.

**Reifen bleiben in der Zusammensetzung** — die Raupe *ist* Gummi.

**Abnahmekriterium.** `test/kufenRaupe.test.ts` grün; kein Schneemobil trägt
mehr eine Radgeometrie.

**Auf dem Gerät zu prüfen.** Sieht das Schneemobil auf dem Haufen richtig aus?

---

### E-022 — Der LKW lädt von der Seite, an der alten Stelle der Presse (14.09.2026)

**Entscheidung.** Der Abladeplatz liegt auf **(6,3 | −24,0)**; der LKW setzt von
Norden rückwärts hinein und steht mit der **Längsseite** zum Bagger
(`src/delivery/routes.ts:72`).

**Begründung.** Patrick: „Was wichtig wäre, dass ich LKWs nicht mehr von hinten,
sondern von der Seite ablade. … weil der Weg ist auch einfach immer viel zu lang,
wenn ich eine hundertachtzig Grad Drehung machen muss." Nachgemessen:

| | vorher, Heck zum Sitz | jetzt, Längsseite |
|---|---|---|
| Ecken der Ladefläche | 8,03 · 8,26 · 13,42 · 13,56 m | **5,65 · 6,70 · 8,29 · 9,04 m** |
| im Greifband (3,0–9,5 m) | nur die vordere Hälfte | **alles** |
| Schwenk zum Mischschrott | 149° = 10,6 s je Griff | **65° = 4,7 s** |

Die hintere Ecke war vorher 13,56 m entfernt — mehr als vier Meter außerhalb der
Reichweite. Man musste umsetzen, um den eigenen Anlieferer leerzuräumen.

**Zehn Probefuhren**, alle zehn halten auf (6,30 | −24,00) mit Gierwinkel 0°,
je 25,2 s (`test/fahrstrecke.test.ts`, `test/abladeplatz.test.ts`).

**Auf dem Gerät zu prüfen.** Bekommst du das **hinterste** Teil der Ladefläche,
ohne zu fahren?

---

### E-023 — Die Presse zieht an die Westflanke und wird kleiner (14.09.2026)

**Entscheidung.** Die Presse steht auf **(−8,0 | −26,0)**, um 90° gedreht, mit
einer Kammer von **4,20 × 4,05 m** statt 5,95 × 4,05 (−29 % Fläche). Abstand zum
Sitz: **8,28 m**.

**Begründung.** Zwei Gründe fielen zusammen. Erstens versperrte sie den
Anfahrtsweg: Sie saß direkt nördlich der Mischschrott-Halde, zwischen ihr und der
Stahlschrott-Halde blieben **2,9 m**, ein LKW ist 2,5 m breit. Zweitens braucht
der Abladeplatz aus E-022 genau ihren alten Platz. Patrick: „Die Presse, die muss
weg, da, wo sie grade steht. Und da kommt der LKW hin", und: „Die Presse ist,
glaub ich, auch ’n bisschen zu groß, die kann verkleinert werden. Eher wie so ’n
Rechteck, wie ein Quader."

**Warum 90° gedreht.** Die Deckelklappe schwingt 3,85 m. Ungedreht fiele sie in
die Südmauer; gedreht fällt sie nach Westen ins Freie.

**Warum −26,0 und nicht −26,5.** Bei −26,5 hätte der Rahmen 25 cm in der Mauer
gestanden. Gemessen, nicht geschätzt.

**Die Kammergröße ist ein Vorschlag.** Die harte Grenze liegt bei **3,98 m** —
das ist die offene Spinne plus 30 cm je Seite. Alles zwischen 3,98 und 5,95 ist
eine Zeile in `press.ts:165`. Blatt: `docs/messungen/2026-09-14_presse.svg`.

**Noch offen (aus der Warteschlange).** Die Presse steht als **voller Klotz** in
der Hindernisliste, 2,2 m hoch über die ganze Kammer — der Greifer kommt nicht
auf den Kammerboden. Sie muss wie die Sortiermulden gebaut werden: Wände ja,
Deckel nein. Das ist ein eigenes Paket.

**Auf dem Gerät zu prüfen.** Erreichst du die Presse vom Sitz aus, ohne
umzusetzen? Stört die offene Klappe nach Westen irgendwo?

---

### E-024 — Die Ausbuchtung wird flacher, der Reifencontainer entfällt (14.09.2026)

**Entscheidung.** Die Ausbuchtung hinter dem Bagger ist **6,5 statt 9,5 m** tief
(`src/world/yard.ts:105`). Die Trennstein-Pyramide steht jetzt 1–4–4–1 über vier
Säulen. Der Reifencontainer entfällt ersatzlos; Reifen zählen über
`mitFraktionen` zum Müll. Die Müllmulde liegt auf **(7,0 | −27,0)** und ist 2,40
statt 3,00 m tief — **8,75 m** vom Sitz.

**Begründung.** Patrick: „Ich glaub, die Ausbuchtung ist vielleicht ’n bisschen
zu tief noch, die vielleicht ’n bisschen verkürzen." Die Erreichbarkeit ändert
sich dadurch **nicht** — die vordere Kante der Halden bleibt bei z −29, und
gemessen wird an der vorderen Kante. Was sich ändert, ist der Aushub: **40,8
statt 61,2 m² je Halde.**

Der Reifencontainer stand genau in der neuen Rückfahrspur aus E-022. Patrick
hatte ihn ohnehin freigegeben: „Das mit den Reifencontainern, die Container der
Container kann auch weg. … dann machen wir da einfach eine Mulde mit jeglichem
Abfall."

**Warum die Müllmulde flacher wurde.** Gerechnet, nicht gegriffen: Bei 3,00 m
Tiefe müsste der LKW 60 cm vorrücken, und dann fällt seine hintere Ecke mit 9,4 m
aus der Reichweite.

**Die vier Pflichtziele stehen im Band (5,8–9,2 m):** Mischschrott 7,91 ·
Stahlschrott 6,96 · Presse 8,28 · Müll 8,75. Dazu der Abladeplatz mit 6,91.

**Offen.** Von den drei Metallmulden ist **Kupfer+Messing mit 12,26 m nicht
erreichbar** (Alu+Zink 7,28 ✓, Kabel 9,17 am Rand). Drei Wege: stehenlassen und
hinfahren · Kupfer+Messing mit Alu+Zink zu einer Buntmetall-Mulde zusammenlegen ·
eine Mulde streichen. Empfehlung: zusammenlegen, wie E-010 es zweimal getan hat.

**Auf dem Gerät zu prüfen.** Erreichst du Mischschrott, Stahlschrott, Presse und
Müll alle vier vom Sitz aus?

---

### E-025 — Der Bagger bekommt Detailtiefe durch Verschmelzen, nicht durch mehr Netze (14.09.2026)

**Entscheidung.** Der Bagger wird nach `docs/baggerkonzept-2026-09-14.svg` und
`docs/baggerkonzept.md` umgebaut: **157 → 309 Einzelteile**, dabei **137 → 57
Netze** und rund 194 → 82 Zeichenrufe. Regel: **ein Netz je Starrkörper und
Werkstoff**, zusammengeführt mit `mergeGeometries` wie in `wheelParts.ts`. Je
Baugruppe ein eigenes Modul. Acht Pakete, einzeln auf dem iPad abgenommen, in der
Reihenfolge Fahrer · Unterwagen/Räder · Oberwagen · Drehkranz · Zylinder ·
Ausleger/Stiel · Kabine · Kabinenhub.

**Begründung.** Patrick: „Der Bagger soll als zentrales Element auch mehr
Detailtiefe bekommen. Jetzt aktuell ist es auch Playmobil like samt Fahrer. …
Also die LKW sind manchmal besser detailliert als der Bagger selbst." Gemessen am
14.09. stimmt das Gefühl, aber nicht die Ursache: Der Bagger hat mit 137 Netzen
und 15.420 Dreiecken **mehr** als ein Kipper (79 / 2.460) — aber **51 % seiner
Dreiecke sitzen im Fahrer samt Joysticks**, während Ausleger, Stiel, Motorhaube
und Gegengewicht je **12** haben. Es ist falsch verteilt, nicht zu wenig.

Und auf dem Gerät (1.322 Zeichenrufe, 240k Dreiecke, Bild 5,9 ms von 21,0 ms)
sind Dreiecke praktisch gratis, Netze aber der Engpass — der Schattendurchlauf
verdoppelt sie. Verschmelzen löst beides auf einmal: mehr zu sehen bei weniger
Aufwand.

**Verworfene Alternativen.** Detail als neue Einzelnetze anhängen (125 Teile =
250 zusätzliche Zeichenrufe; hätte die Bildglättung von heute zunichtegemacht).
Den Bagger als Datei laden (der ganze Rest des Spiels ist Quelltextgeometrie).
Die Räder anfassen — sie sind am 14.09. abgenommen („räder in ordnung") und
bleiben unverändert in Form, Größe und Material; neu wäre nur, dass sie sich
drehen und lenken, und das kostet kein Netz.

**Drei Befunde aus der Vermessung, die eigene Arbeit nach sich ziehen.**

1. **Die Reifen stecken im Kasten.** Rahmen y 0,70–1,60 (`excavator.ts:667`), Rad
   y 0,00–1,24 (`:686`) — die obersten **54 cm** des Rades sind verdeckt, in der
   Breite 20 cm. Kein Kotflügel, keine Achsbrücke. Und **keine Zeile im
   Quelltext dreht jemals ein Rad**: Bei 3,2 m/s rutscht die Maschine auf vier
   Klötzen. Das ist die Antwort auf „die Reifen sind nicht so richtig
   erkennbar" — es liegt nicht am Rad, es liegt am Einbau.
2. **Der Kabinenhub ist mechanisch unmöglich.** Er verlangt ein Hubverhältnis von
   **5,18 : 1** (Ankerabstand 0,650 → 3,368 m); das Rohr des Zylinders ist mit
   1,10 m in der untersten Stellung **länger als der 0,65-m-Spalt** und steht
   durch den Kabinenboden. Fällt heute nicht auf, weil die „Kolbenstange" per
   `scale.y` gestreckt wird — am Hubzylinder um +128 %. Eigenes, **letztes**
   Paket.
3. **Der Unterwagen-Kollider war noch nie deckungsgleich** mit dem sichtbaren
   Kasten (Kollider y 0,40–1,90, Kasten 0,70–1,60). Nicht angerührt. Wenn Schrott
   „neben" der Maschine weggeschoben wird, ist das die Ursache.

**Was der Preis des Verschmelzens ist.** Auffindbarkeit im Szenengraph: Ein
Befund wie „das kleine Teil unten am Rad flimmert" lässt sich danach nicht mehr
auf ein einzelnes Netz zeigen. Gegenmittel: je Baugruppe ein Modul wie
`wheelParts.ts` mit einer benannten Funktion je Teil, dann steht die
Positionsliste im Quelltext statt im Szenengraph.

**Abnahmekriterium.** Nach jedem Paket: Die Netzzahl der Baugruppe stimmt mit dem
Konzept überein, alle Netze tragen `NN_…`-Namen, **Reichweite, Grabtiefe und
Kollider sind unverändert**, `npm test` grün.

**Am Bild zu entscheiden** (Fragen 1–4 in `docs/baggerkonzept.md`): Silhouette
des Unterwagens · Geländer auf dem Oberwagen · Kabinenhub als Parallelogramm oder
Hubsäule · Aussehen des Fahrers.
