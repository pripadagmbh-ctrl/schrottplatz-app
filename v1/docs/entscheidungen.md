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

---

### E-026 — Hallen zurück ans Büro, Silo-Reihe an die Ostwand, der Müll aus der Rückfahrspur (15.09.2026)

**Entscheidung.** Drei Umzüge in einem Paket, weil sie sich gegenseitig schieben.

1. Die **Silo-Reihe** zieht von der Wand bei x −36 an die Wand bei x +10,5
   (Mitte x +6,5) und wird von neun auf **sechs** gekürzt: Abfall, Batterien, VA,
   Alu+Zink, Kupfer+Messing, Kabel — Mitten z 23,8 bis 0,8.
2. Die **drei Hallen** gehen zurück an die Wand neben das Büro, bündig südlich
   angebaut, **Tor nach Osten**. Sie sperren nur ihre Wände, nicht ihre
   Grundfläche.
3. Die **Müllmulde** wird auf (7,0 | −27,0) abgebaut und auf **(−3,2 | −14,6)**
   neu gesetzt.

Dazu wandert der **Verladeplatz** auf (−4,0 | 5,4) und der **Abladeplatz** von
z −24,0 auf **−23,0**.

**Begründung.** Patrick: „Die Hallen sind falsch gebaut. Die dürfen nicht bei
Janin stehen. Die müssen wieder zur Ostwand, da wo die Silos sind" und „Die
Müllmulde muss weg. Die LKWs fahren in die Müllmulde und ich kann noch nicht mal
die LKWs vollständig abladen, weil ich in die Wand greife."

Der Grund, der die Hallen mit E-010 an die Nordwand geschickt hatte, war allein
die Überschneidung mit der Silo-Reihe — die zieht ja gerade weg. Zur Zufahrt, auf
meinen Einwand hin: „Erstmal ist ja ein super großer Mittelplatz da. … Die können
ja von der Waage rechts abbiegen und dann sind sie ja auch in der Halle." Der
Einwand war hinfällig, die eigene Fahrspur entfällt.

**Was die Messung ergeben hat — Patricks Befund war wörtlich richtig.**

| gemessen am alten Abladeplatz (6,3 \| −24,0) | Wert |
|---|---|
| Ladefläche **in** der Nordwand der Müllmulde | **2,45 × 0,70 m** |
| Standfläche **über** der ganzen Mulde | **2,65 × 2,85 m** |
| äußerste Ladeflächenecke → Stirnwand der Mulde | **0,80 m** (offene Spinne braucht 1,69 m) |
| **nächste** Ladeflächenecke → Sitz | **5,58 m** — unter der inneren Grenze 5,80 |

„Durch die Wand, halb durch die Mulde" und „ich greife in die Wand" — beides
nachgemessen bestätigt.

**Warum drei grüne Tests das nicht gesehen haben.** Sie nahmen an, die Ladefläche
liege **nördlich** des Haltepunkts. Tatsächlich liegt der Ursprung eines
Fahrzeugs in der **Mitte** der Ladefläche (`vehicleModel.ts`). `platz.test.ts`,
`reach.test.ts` und `abladeplatz.test.ts` haben also die falsche Stelle vermessen
und dabei grün gemeldet. Sie sind korrigiert.

**Der Abladeplatz war nicht falsch, nur einen Meter zu weit südlich.** Bei z −23,0
liegen alle vier Ladeflächenecken im Band (5,88 · 6,32 · 8,44 · 8,76 m), bis zur
Südmauer sind es 3,00 m statt 2,00, und die Standfläche des längsten Wagens
bleibt 1,10 m vor der Mauer statt 0,10.

**Der zweite Befund: die Hallentore zeigten nach außen.** Patrick am Bild: „Die
Halleneingänge sind ja falsch rum. Die sind ja zu den Außengrenzen gedreht."
Nachgerechnet: Das Tor war lokal auf +x gebaut und die Gruppe mit
`rotation.y = −π/2` gedreht; bei θ = −π/2 gilt `welt_z = +lokal_x`. Das Tor lag
also in der Nordmauer.

**Schlimmer war der Kollider.** Er und die Hindernisliste setzten die Rückwand im
**Norden** an — genau dort, wo das sichtbare Tor stand. Im Ergebnis stand eine
unsichtbare Wand im Tor, und durch die sichtbare Rückwand konnte man hindurch.
Dieselbe Fehlerklasse wie die „unsichtbare Barriere" vom 12.09. Dazu war die
Halle in `STATIC_OBSTACLES` ein **Vollrechteck**: Selbst mit richtig herum
zeigendem Tor wäre kein LKW hineingekommen, weil er 1,40 m vor jedem Hindernis
hält.

Die Richtung steht jetzt als **`TOR_RICHTUNG`** im Quelltext, und Bau, Kollider,
Hindernisliste und Wächter lesen diese **eine** Angabe — statt sie je für sich aus
einer Drehung abzuleiten.

**Welche Silos entfallen und wohin ihre Fraktion geht.**

| Silo | Grund | geht nach |
|---|---|---|
| E-MOTOREN | leere Hülle, die Fraktion gibt es nicht (E-011) | — |
| HOLZ | zusammengelegt | ABFALL |
| KUNSTSTOFF | zusammengelegt | ABFALL |
| BAUMISCH | heißt jetzt ABFALL | ABFALL |

Alle vier Abfallsätze sind negativ (−0,02 bis −0,06 €/kg): Sie werden entsorgt,
nie bestellt, und die Abfallsortierung ist mit E-024 ausdrücklich vertagt.
Abgerechnet wird nach `rubble` — dieselbe Vereinfachung wie bei Kupfer+Messing.
Die Müllmulde am Bagger führt jetzt genau dieselben vier Fraktionen, damit Lambert
eins zu eins weitertragen kann. `test/silos.test.ts` prüft für **jede** Fraktion
im Katalog, dass sie ein Lagerziel findet; erlaubt sind nur zwei Ausnahmen, Stahl
und Mischschrott, die an der Halde verladen werden.

**Wo der Müll jetzt steht und warum genau dort.** (−3,2 | −14,6), Öffnung nach
Osten, 8,35 m vom Sitz. Das Schwenkband wurde sektorweise abgesucht; frei ist
**genau ein** Streifen — zwischen Kabelmulde (Ostkante x −5,5) und Kipperspur
(Wagenflanke x 0,45), 5,95 m breit. Ost sperrt die Rückfahrspur, Südost die
Ostmauer, Süd die Öffnung der Ausbuchtung, Südwest die 0,65 m zwischen
Pressenrahmen und Alu-Mulde, West die beiden Mulden. Auch das z ist gerechnet:
Bei −14,6 stehen die Flanken vor **keiner** der beiden Muldenöffnungen.

**Fünf weitere Durchdringungen gefunden und behoben**, alle vorher unbemerkt:
Silo-Rangieren in die Stirnwand (0,70 m), Silo-Ausfahrt in die Platzmauer
(0,50 m), nördlichstes Silo in die Nordmauer (0,60 m), Anlieferung in die
Ostmauer (0,49 m), Kipper-Einfahrt in eine Silo-Flanke (0,05 m).

**Verworfene Alternativen.** Müll in der Südostecke lassen und den Abladeplatz
nach Westen ziehen (dann fällt die Mitte der Ladefläche auf 5,63 m). Müll an die
Ostmauer (schon in x allein 9,6 m). Neun Silos auf zwei Wände verteilen (es
bräuchte zwei Verladeplätze oder einer erreichte die halbe Reihe nicht). Die
Abfallfraktionen getrennt lassen.

**Abnahmekriterium.** Die vier Pflichtziele im Band: Mischschrott 7,91 ·
Stahlschrott 6,96 · Presse 8,28 · Müll 8,35, dazu der Abladeplatz mit 6,82. Jede
Fraktion findet ein Lagersilo. **Kein Fahrzeugumriss schneidet auf seinen Routen
ein festes Bauwerk** — vorher 28 Paare, jetzt null (`test/fahrumriss.test.ts`,
27 Strecken × 6 Fahrzeuglagen gegen 60 Bauwerke). Diese Prüfung gab es bisher
nicht: Getestet wurde, **dass** ein LKW ankommt, nie **wo er durchfährt**.

**Offen.**

1. **Kupfer+Messing liegt weiter bei 12,26 m**, außerhalb des Bandes — der offene
   Punkt aus E-024. Empfehlung: mit Alu+Zink zu einer Buntmetall-Mulde
   zusammenlegen, dann sind alle Sortiermulden im Band und eine wird frei.
2. **Janine sitzt auf (−9,5 | 15,5)** und ist nach dem Umzug der engste Punkt der
   vorderen Hälfte. Sie hat die Abholer-Spur gedreht und einen Warteplatz
   vertrieben. Sie vor die Hallen zu ziehen liegt nahe — aber nur auf Patricks
   Wort; sie ist gestalterisch und hat eine Messgeschichte.
3. **Die Hallen sind leer.** Es gibt keine Route hinein und keine Funk-Einweisung
   aus E-011. Eigenes Paket, zusammen mit „Lambert räumt die Halle ins Silo".
4. **Zehn Fuhren in Folge sind nicht simuliert** — heute läuft **eine**
   vollständige Fuhre in der echten Physik, der Rest ist geometrisch geprüft.

**Auf dem Gerät zu prüfen.**

1. Aus dem Sitz nach vorn schauen: Stehen die drei Hallen links an der Wand
   hinter Büro und Waage, und zeigen ihre Tore auf den Platz — nicht in die Mauer?
2. Mit dem Bagger in eine Halle hineinfahren: Kommst du durch das Tor, oder hält
   dich etwas Unsichtbares auf?
3. Einen Anlieferer ganz leerräumen: Bekommst du die hinterste Ecke, ohne
   umzusetzen — und fasst die Spinne dabei irgendwo in eine Wand?
4. Abfall in die Müllmulde kippen, die jetzt links vorn neben der Kabelmulde
   steht: Reicht der Arm bequem hinein?
5. Mit V den Abholer rufen und zum Verladeplatz fahren (rechts vorn, vor der
   Silo-Reihe): Erreichst du Silo und Container, ohne den Bagger zu versetzen?

---

### E-027 — Griff-Info und Ladeanzeige stehen als Stapel am freien Rand (15.09.2026)

**Entscheidung.** Beide Zeilen stehen in einem gemeinsamen Halter `#hudunten`
(Flex-Spalte, 6 px Zwischenraum), **linksbündig im freien Streifen zwischen
Fahrpedalen und Drehtasten** — in drei statt zwei Fassungen: iPad quer
`left 198 / right 82 / bottom 10`, iPhone quer `156 / 252 / 6`, iPhone hoch
`12 / 82 / 118`. Ohne Berührungseingabe bleibt alles, wo es war.

Die Griff-Info hat jetzt **zwei Zeilen**: ein Kopf mit Zustand, Gewicht, Preis
und Ampelurteil, der umbrechen darf, und darunter die Aufzählung auf genau einer
Zeile, die am Ende mit „…" gekappt wird.

**Begründung.** Patrick am iPhone mini: „Bei iPhone Mini wird auch durch die
Greifanzeige, also was gegriffen worden ist, die Sicht verdeckt." Drei Ursachen
lagen übereinander:

1. **Beide Zeilen waren mittig zentriert und ohne Breitengrenze.** Im Hochformat
   ist ein `left: 50%`-Kasten höchstens 188 px breit — die Ladungszeile brach auf
   fünf bis sieben Zeilen um und stand als Textsäule genau dort, wo man beim
   Greifen hinsieht.
2. **Jede hing einzeln am Rand** (118 und 163 px). Wurde die untere zweizeilig,
   schob sie sich unter die obere.
3. **Die Anhebung auf 118 px stammte vom 14.09.**, als die Fahrpedale noch unten
   in der Bildmitte standen. Nach ihrem Umzug nach links war sie übrig.

Dazu kam ein vierter Punkt, der keinem aufgefallen war: **Das Hochformat lief mit
den Tablet-Regeln.** `@media (max-height: 430px)` fasst nur das Querformat der
Telefone; ein iPhone mini hochkant ist 375 × 812 und fiel durch jede Sonderregel
hindurch.

**Was es jetzt kostet.** Beim **längstmöglichen** Text — volle Spinne über der
falschen Mulde *und* wartender Abholer — 14,2 % der Bildhöhe auf dem iPad, 22,1 %
im Querformat, 31,4 % im Hochformat. Im Ruhezustand („Greifer: offen") sind es
134 × 37 px in einem blassen Kasten am Rand.

**Was beim Kappen verlorengeht.** Nur der Schwanz der Aufzählung — also bei einer
randvollen Spinne die hinteren Fraktionszählungen, und die sagen von sich aus
schon, dass mehr da ist („+3 weitere"). **Gewicht, Preis, Materialangabe und
Ampelurteil stehen im Kopf und brechen um, statt zu verschwinden.** Das war die
Bedingung: Patrick hat sich Material und Ladungsliste am 12.09. ausdrücklich
gewünscht; ein Kürzen, das den Preis frisst, wäre keine Lösung gewesen.

**Verworfene Alternativen.**

- Nur `bottom` zurücksetzen — tauscht den Fehler: Die zentrierte Zeile reicht bei
  langem Text bis in die Pedalecke.
- Nach oben unter den Tagesablauf — dort sitzt im Hochformat die Tutorialkarte,
  und der Blick müsste bei jedem Griff 600 px weit springen.
- Die Zeile im Ruhezustand ganz ausblenden — der Greiferzustand muss ablesbar
  bleiben, und auf Touch gibt es dafür keinen zweiten dauerhaften Kanal.
  Stattdessen tritt der Kasten optisch zurück.
- Die Drehtasten im Hochformat nach unten rechts verlegen, um die volle Breite zu
  gewinnen — dort liegt der Home-Indicator.

**Abnahmekriterium.** `test/greifanzeige.test.ts` rechnet die Kästen **mit Rahmen
und Fassung** aus dem CSS und prüft in allen drei Fassungen mit dem
längstmöglichen Text: keine Überlappung, mindestens 8 px Luft, Block im unteren
Drittel. Messung unter `docs/messungen/2026-09-15-greifanzeige/`.

**Offen, jeweils eigenes kleines Paket.**

1. **Schriftgröße im Querformat des Telefons.** Die Griff-Info steht dort auf
   12 px, die Ladeanzeige wurde ihr angeglichen (vorher 14). Briefing Kap. 20
   verlangt ≥ 14 px. Am Gerät zu entscheiden: Sind 12 px lesbar, bleibt es so und
   die Ausnahme kommt ins Log; sonst beide auf 14, das kostet quer rund 40 px.
2. **Sichere Ränder.** `viewport-fit=cover` ist gesetzt, `env(safe-area-inset-*)`
   wird nirgends benutzt. Im Querformat sitzt der Block 6 px über der Unterkante,
   wo die Balkenanzeige liegt. Gehört für **alle** unteren Elemente gemeinsam
   gelöst — Pedale, Drehtasten, HUD-Block —, nicht für eines allein.
3. **Konto und Tagesablauf überlappen sich um rund 6 px.** `#money` steht auf
   top 12 und ist wegen Zeilenabstand 1,5 tatsächlich 40,5 px hoch; `#shift`
   beginnt bei 46. Nicht angefasst, weil ein Verschieben nach unten den
   Debugblock bei 80 trifft. Derselbe Stapel-Trick wie hier löst es.

**Auf dem Gerät zu prüfen.**

1. **iPhone mini hochkant:** Großes Teil greifen — steht die Anzeige links über
   den Pedalen statt mitten im Bild, und bleibt sie beim Drehen dort?
2. **iPhone mini hochkant:** Spinne offen, nichts anvisiert — ist der blasse
   kleine Kasten „Greifer: offen" lesbar genug, oder soll er ganz verschwinden?
3. **iPhone mini quer:** Volle Spinne über die falsche Mulde — steht
   „✕ falsche Zone" vollständig da, und endet die Aufzählung sauber mit „…",
   ohne Pedale oder Drehtasten zu berühren?
4. **iPad quer:** Abholer rufen und gleichzeitig greifen — stehen beide Zeilen
   getrennt übereinander, ohne sich zu überdecken?

---

### E-028 — Silos als L an Westwand und Südwand, eine Mulde „BUNT + VA", Janine ans Tor (15.09.2026)

**Entscheidung.** Drei Umzüge, die zusammengehören, plus zwei Befunde, die beim
Nachrechnen aufgefallen sind.

1. **Die Silo-Reihe wird ein L.** Drei Silos an der Westwand neben den Hallen
   (x −36,0; z −3,4 · −8,0 · −12,6, Öffnung nach Osten), drei um die
   Südwestecke an der Südmauer (z −25,0; x −30,0 · −25,4 · −20,8, Öffnung nach
   Norden). Die Gasse ist ebenfalls ein L: x −28,0 und z −17,0, Ecke bei
   (−28,0 | −17,0). Der Verladeplatz zieht mit auf (−25,5 | −8,0), die
   Abholer-Spur auf x −18,0.
2. **Aus drei Metallmulden wird eine** auf (−7,6 | −19,2), 4,2 × 6,0 m, mit
   Alu, Zink, Kupfer, Messing, Kabel **und Edelstahl**. Sie ist ein **Puffer**,
   kein Abrechnungsort (Ansage: „erstmal alles rausfischen in die Mulde tun und
   dann später entweder ich oder Lambert das sortieren").
3. **Janines Kaffeewagen steht wieder an der Nordmauer**, auf (−9,5 | 26,8),
   östlich der Einfahrt neben den beiden Warteplätzen.

**Begründung.** Ansagen Patricks vom 15.09.2026: „Das mit der Buntmetallmulde
ist in Ordnung. Das heißt, du kannst da die Mulden alle wegmachen und machst
nur noch eine Buntmetallmulde. Die Silos, die da links stehen, die sollen neben
den Hallen stehen und dann ums Eck über die Südseite weitergehen, damit links
die Seite erstmal frei ist. Janine kommt wieder an die Außengrenze, links neben
dem Tor, da wo auch die LKWs parkieren."

**Links ist +x.** Der Bagger schaut nach +z. Wer mit +y oben nach +z blickt,
hat rechts = vorn × oben = z × y = −x, also **+x links**. Die Reihe stand am
Vormittag auf x +6,5 — das ist die Seite, die Patrick „links" nennt, und die
wird frei. Der Quelltext sagt dasselbe (`containers.ts`, Kopf von `CONFIGS`:
„rechts vom Sitz = −x, links vom Sitz = +x"), und die Bezeichner lügen weiter:
Behälter an der Westwand tragen `facing: "east"`, weil das die Richtung ihrer
Öffnung ist, nicht ihr Standort. **Gelesen werden Koordinaten, nie Namen.**

**Warum die Mulde „BUNT + VA" heißt.** Edelstahl hatte am Bagger bis heute
überhaupt kein Ziel: Wer ihn aus einem Wrack fischte, bekam überall „falsche
Zone" — offener Punkt seit dem 14.09. Patrick hat entschieden, ihn dazuzulegen.
Fachlich ist VA aber kein Buntmetall, sondern legierter Stahl; eine Mulde
namens „BUNTMETALL", in der Edelstahl richtig liegt, wäre eine Unwahrheit auf
einem Schild. „BUNT + VA" sind zwei Abkürzungen, die auf einem Platz wirklich
gesagt werden, passen in dieselbe Zeile wie „VA-LAGER" daneben und bleiben auch
im Griff-HUD des iPhone mini lesbar. Verworfen: „NE-METALLE" (VA ist Eisen,
also gerade kein NE), „BUNTMETALL + VA" (zu lang fürs Schild).

**Was die eine Mulde im Geldkreislauf kostet: null Euro.** Verdient wird nicht
an der Mulde, sondern beim Verkauf aus dem Container des Abholers
(`economy/account.ts`, `sellContainer`) — dort zählt **jedes Stück mit seiner
eigenen Fraktion**, und Lambert trägt jedes Stück einzeln in das Silo seiner
Fraktion (`people.ts`, `muldeFuer` liest `item.materialId`, nicht die Mulde).
Gerechnet an einer Fuhre von je 100 kg Alu, Zink, Kupfer, Messing und Kabel
(`test/buntmetall.test.ts`, auf den Cent):

| Weg | Erlös |
|---|---|
| Silos getrennt (gebaut) — drei Fuhren: 37,50 + 180,00 + 220,00 € | **437,50 €** |
| Silos ebenfalls zusammengelegt — eine Fuhre, Reinheit 0,20³ | **28,80 €** |

Ein gemeinsames **Lager**silo kostete also 408,70 € je 500 kg, **93 %**. Eine
gemeinsame **Mulde am Bagger** kostet nichts. Deshalb: Mulde zusammen, Silos
getrennt.

**Was das Zusammenlegen wirklich ändert, ist die Ampel.** Wer Kupfer neben
Kabel legt, bekommt kein „falsche Zone" mehr — und das ist jetzt richtig so:
Die Mulde soll nicht tadeln, dass gemischt wird. Fremdstoff drückt weiterhin
quadratisch: 100 kg Stahl unter 400 kg Nichteisen lassen vom Schildwert 64 %
übrig. Eine **Sortierprämie** wird nirgends ausgezahlt — `SORTING_BONUS_PER_KG`
steht in `account.ts`, wird aber von keiner Stelle gelesen; `noteSorted` zählt
nur Kilogramm fürs Tutorial. Die Mulde tadelt also nichts und belohnt nichts;
sie ist genau der Puffer, der sie sein soll.

**Das Schild rechnet jetzt je Stoff** (`containerValueGemischt`). Vorher stand
der ganze Inhalt zum Preis der Leitfraktion da — Messing zum Kupferpreis, Zink
zum Alupreis; an der Beispielfuhre 1960 statt 1602 €, also **22 % zu viel**.
Bei sechs Fraktionen in einem Behälter wäre daraus ein Sprung geworden:
derselbe Inhalt zwischen 410 € (Leitfraktion Zink) und 3600 € (Kupfer). Die
neue Rechnung ist gegen das Zusammenlegen unempfindlich — dieselben Stücke auf
eine oder auf sechs Mulden verteilt ergeben dieselbe Summe.

**Warum drei und drei, und nicht vier und zwei.** Auf der Westwand allein
passten **sechs** (Mitten −2,725 bis −25,725) — die L-Form ist Patricks Bild,
nicht Platznot. Die Aufteilung hängt an einer einzigen Zahl: Die Gasse des
Südschenkels muss 5,0 m vor dessen Öffnungen liegen, also auf z −17,0, und ein
LKW ist dort 3,10 m breit. Mit vier Westsilos reichte das unterste bis z
−19,575 hinunter — der Wagen führe mitten hindurch. Mit drei endet es auf
−14,975 und lässt 0,475 m Luft.

**Die Südwestecke bleibt frei, und das ist gerechnet.** Ein Kipper, der in der
Südgasse nach Westen fährt und hält, steht mit der Kabine 4,90 m vor seinem
Haltepunkt. Ein Silo auf x −36,0 hätte ihn 1,20 m in die Westmauer geschickt;
beim Zurückstoßen hätte er 4,90 m nach Norden in die Flanke des untersten
Westsilos geragt. Die Südreihe beginnt deshalb erst auf x −30,0. In der Ecke
**wendet die Gasse** — sie ist kein verlorener Platz, sondern die Kurve. Nach
Osten ist Luft bis zur Presse (Rahmen ab x −10,375, offene Deckelklappe bis
−11,85): dort passen noch zwei weitere Silos, ohne dass etwas umgebaut wird.

**Zwei Fehler, die erst beim Drehen der halben Reihe sichtbar wurden.**

1. **Die Muldenkörper drehten nicht mit.** Die sichtbaren Steine steckten in
   einer gedrehten Gruppe, die Rapier-Kollider hingen an einem ungedrehten
   Körper. Bei `facing: "east"` lag die physische Rückwand damit genau dort, wo
   die sichtbare Öffnung war: **An der Müllmulde (−3,2 | −14,6) stand seit
   heute Vormittag eine 2,2 m hohe unsichtbare Wand quer vor dem Einwurf.**
   Dieselbe Klasse Fehler wie die „unsichtbare Barriere" vom 12.09.2026, nur
   diesmal zwischen Bau und Physik statt zwischen Bau und Hindernisliste. Die
   Zählzone (`containsPoint`) und Lamberts Halteplatz hatten denselben Fehler.
   Behoben, indem Drehung, Umriss, Vorderkante und Rücken ab jetzt aus **einer**
   Quelle kommen (`bayDrehung`, `bayHalb`, `bayVorderkante`, `bayRuecken`).
2. **`test/fahrumriss.test.ts` war zwei Stunden lang grün, weil die Silo-Routen
   `NaN` enthielten.** `bayApproach` bekommt seit dem Umbau einen Datensatz
   statt einer z-Koordinate; der Test übergab weiter `c.z`, und jeder Vergleich
   mit NaN ist falsch — die Trennachsenprüfung fand nie eine Überschneidung.
   Die Tests laufen ohne `tsc` (`tsconfig.json` sammelt nur `src`), deshalb
   fängt das kein Typ ab. Der Wächter prüft jetzt zuerst, ob jede Strecke aus
   Zahlen besteht.

**Die Mulde bekommt vorn eine Schwelle von 0,50 m — eine Lage Betonlego.**
Wunsch Patrick vom 14.09.2026, heute bestätigt: vorn niedrig zumauern, damit
nichts über die Vorderkante zurückrollt, „aber bei abgesenkter Kabine muss man
noch hineinsehen können". Das ist eine Sichtlinie, keine Geschmacksfrage, und
sie ist gerechnet. Augpunkt bei **abgesenkter** Kabine: **3,28 m**
(`excavator.ts`: `cabGroup.position.y = 1,60` plus Augpunkt lokal 1,68 —
dieselbe Zahl in `docs/baggerkonzept.md`, Tabelle „Augpunkt Kabine"). Der Blick
streift die Wandkrone und trifft den Boden erst dahinter:

    blind = h × D / (H − h)

Die Baggerseite der Mulde läuft von (−5,5 | −22,2) bis (−5,5 | −16,2), also
5,01 bis 8,04 m vom Sitz. Bei 4,20 m Muldentiefe:

| Wandhöhe | toter Streifen | Boden sichtbar |
|---|---|---|
| **0,50 m (eine Lage)** | 0,90 … 1,45 m | **65 … 79 %** |
| 1,00 m (zwei Lagen) | 2,20 … 3,53 m | 16 … 48 % |

Ab **1,13 m** sieht man vom hinteren Ende der Mulde überhaupt keinen Boden
mehr. Es wird deshalb **eine** Lage gebaut, nicht zwei. Die Schwelle steht an
derselben Stelle wie die volle Stirnwand, ersetzt sie aber nicht:
`shareEast` bleibt gesetzt, der Greifer fährt weiter frei darüber hinweg
(`hitsObstacle` lässt alles über `top` passieren). Gebaut aus derselben
`reihenstuecke()`-Quelle wie jede andere Reihe seit E-018, damit der letzte
Stein bündig endet. Kollider und Hindernisliste führen sie mit — was gebaut und
nicht verzeichnet ist, fällt Lambert und den LKW nicht auf.

**Verworfene Alternativen.**

- **Zwei Lagen (1,00 m) an der Mulde**: nimmt 52 bis 84 % des Bodens aus dem
  Blick, siehe Tabelle.
- **Die Lagersilos mitzusammenlegen**: kostet 93 % des Erlöses, siehe Tabelle.
- **Vier Westsilos und zwei Südsilos**: Die Südgasse führte durch das vierte.
- **Ein Silo in der Südwestecke** (x −36,0 oder −34,6): Kabine in der Mauer.
- **Zwei Verladestände** (ein zweiter auf (−30,0 | −14,5) mit LKW-Spur auf
  z −7,0 ist gerechnet): Der Abholer hält an genau einem Ort; das zu ändern ist
  ein eigenes Paket.
- **Die Gasse auf x −27,0** (6,0 statt 5,0 m vor den Öffnungen), um den geraden
  Weg von der Waage zu bekommen: Sie läge dann 1,5 m neben dem Verladeplatz,
  und jeder sortenreine Kipper bliebe stehen, solange der Spieler dort lädt.
  Mit −28,0 sind es 2,5 m — dasselbe Maß wie vorher an der Ostwand.

**Abnahmekriterium.** 548 Prüfungen in 51 Dateien grün, darunter:

- `test/fahrumriss.test.ts`: 27 Strecken × 6 Fahrzeuglagen gegen 51 Bauwerke,
  **null Durchdringungen** — und jeder Wegpunkt ist eine Zahl.
- `test/platz.test.ts`: die vier Pflichtziele im Band (Mischschrott 7,91 ·
  Stahlschrott 6,96 · Presse 8,28 · Müll 8,35), Abladeplatz 6,82, und **93 %
  der Muldenachse von BUNT + VA** vom Sitz aus erreichbar (Mitte 7,83 m).
- `test/silos.test.ts`: jede Fraktion findet ihr Lager; beide Schenkel in einer
  Flucht mit 4,60 m Achsabstand; kein Silo in einer Mauer; die Ecke frei;
  Lambert hält 2,20 m vor jeder Öffnung.
- `test/janine.test.ts` (neu): der Kaffeewagen liegt auf keiner Sehne der vier
  Anfahrten, verdrängt keinen Warteplatz und ist von der Waage aus zu Fuß
  erreichbar, ohne den Arbeitsbereich zu queren.
- `test/buntmetall.test.ts` (neu): die Euro-Zahlen oben, auf den Cent — und
  die Schwelle vorn mit der Sichtrechnung, samt Gegenprobe, dass eine Lage mehr
  durchfiele.

Grundriss vorher/nachher: `docs/messungen/2026-09-15_silos-l-form.svg`.

**Offen.**

1. **Die Kipper fahren weiter die Silo-Gasse.** Patricks Ansage vom selben Tag
   („Kipper fahren die falsche Spur. Die sollen auch, wie die anderen LKWs,
   seitlich von mir abgeladen werden") ist **nicht** Teil dieses Pakets — sie
   berührt die Zustandsmaschine in `vehicles.ts` und die Kippmechanik mit ihrer
   eigenen Messgeschichte. Eigenes Paket.
2. **Batterien haben ein Silo, aber keine Mulde am Bagger.** Dasselbe, was VA
   bis heute fehlte. Sie gehören nicht in „BUNT + VA" (Gefahrgut, und der
   Bleiakku im Kupfer drückt die Reinheit) — entweder eine eigene kleine Mulde
   am Bagger oder ausdrücklich „fährt der Spieler hin".
3. **Der Spieler kann nicht sortenrein aus der Mulde ins Silo** — dafür müsste
   er 28 m fahren. Lambert kann es heute schon: Er greift ein Stück aus der
   Mulde und trägt es in das Silo **seiner** Fraktion, unabhängig davon, in
   welcher Mulde es lag. Ein Paket „Lambert räumt die Mulde auf Zuruf leer"
   würde daraus den zweiten Sortierschritt machen, den Patrick beschreibt.
4. **Drei von sechs Silos sind vom Verladeplatz aus erreichbar** (Kupfer,
   Kabel, Alu — 8,80 · 7,50 · 8,80 m). Die drei Südsilos sind 15 bis 20 m weg.
   Unverändert gegenüber der Ostwand, wo es dieselben drei waren.
5. **Zehn Fuhren in Folge sind nicht simuliert.** Alle Strecken sind
   geometrisch geprüft, keine in der echten Physik gefahren.
6. **Bodies, Physik-ms und Haufenruhe sind ungemessen** — dafür braucht es
   einen Lauf auf dem Gerät. Zählbar ist: 51 feste Bauwerke (vorher 53),
   8 Mulden statt 10, also **sechs Netze weniger** (je Mulde zwei
   InstancedMesh und ein Schild).

**Auf dem Gerät zu prüfen.**

1. **Aus dem Sitz nach vorn schauen, Kabine ganz unten:** Steht rechts nur noch
   **eine** Mulde („BUNT + VA"), ist die Aufschrift lesbar — und siehst du über
   die neue niedrige Schwelle hinweg auf den Muldenboden, oder verdeckt sie ihn?
   Gerechnet sind 65 bis 79 % sichtbarer Boden.
2. **In die Müllmulde greifen** (links vorn, Öffnung nach Osten): Kommt die
   Spinne jetzt bis auf den Boden, oder stößt sie noch an etwas Unsichtbares?
   Das war bis heute Vormittag eine unsichtbare Wand.
3. **Mit V den Abholer rufen** und zum Verladeplatz fahren — er liegt jetzt
   **rechts hinten** vor den Hallen, nicht mehr links: Erreichst du Silo und
   Container, ohne umzusetzen, und stimmt der Betrag am Container mit dem
   Schild am Silo überein?
4. **Einen sortenreinen Kipper kommen lassen** (z. B. Batterien): Fährt er die
   Gasse an der Westwand hinunter, um die Ecke und rückwärts in sein Silo —
   oder bleibt er irgendwo stehen und hupt?
5. **Zum Tor schauen:** Steht Janines Wagen an der Nordmauer neben den
   Warteplätzen, und laufen die wartenden Fahrer zu ihr, ohne über den
   Arbeitsbereich zu müssen?


---

### E-029 — Der Kipper verliert seine eigene Spur, Batterien bekommen ein Ziel, die Presse einen Deckel weniger (15.09.2026)

**Entscheidung.** Drei Dinge:

1. **Kipper mit gemischter oder lagerloser Ladung** fahren die Strecke der
   Pritschen und kippen am Abladeplatz **(6,3 | −23,0)** quer aus.
   **Sortenreine** Fuhren mit Lagersilo fahren unverändert die Gasse zum Silo.
   Der Rangierpunkt wandert von z −10,0 auf **−17,5**.
2. **Batterien liegen in „BUNT + VA".** Ihr Lagersilo bleibt getrennt.
3. **Die Presse steht als Wandring in der Hindernisliste**, nicht mehr als
   Vollklotz.

**Begründung.** Patrick am Gerät: „Kipper fahren die falsche Spur. Die sollen
auch, wie die anderen LKWs, seitlich von mir abgeladen werden." Und: „Es war
auch nicht möglich, ein zusammengepresstes Auto wieder aus der Presse zu holen."

**Es waren drei Wege, nicht zwei.** Im Quelltext stand: sortenrein **mit**
Lagersilo → Gasse · Kipper **ohne** Lagerziel → eigene Spur auf x 2,0 mitten im
Schwenkband · alles andere → Abladeplatz. Patricks Klage galt dem zweiten Weg,
seine zweite Antwort („sortenreine Kipper fahren weiter zum Silo") schützt den
ersten. Gebaut wurde also **kein Umbau der Zuordnung, sondern ein Zweig
weniger.** Die Regel steht jetzt als `faehrtInsSilo()` in `routes.ts` und ist
kopflos prüfbar.

**Der Befund, der das Paket fast gekippt hätte.** Mit dem Umzug wurde der
Rückwärtsweg von 5,5 auf 13,0 m länger — und der **Ladungs-Katapult messbar
schlimmer**. Während des Rückwärtssetzens ist die Fuhre verriegelt; je länger der
Weg, desto tiefer arbeiten sich Stücke in den Schlitz am Kipplager. 16 Ladungen
je Variante, feste Zufallssaaten:

| Rückweg | Mittel | Höchstwert | über 130 km/h |
|---|---|---|---|
| 13,0 m (naiver Umzug) | 154 | 424 km/h | 8 von 16 |
| 9,5 m | 146 | 298 km/h | 7 von 16 |
| **5,5 m (gebaut)** | **109** | **255 km/h** | **3 von 16** |
| alte Kipperspur | 117 | 305 km/h | 6 von 16 |

Der Rangierpunkt auf −17,5 macht den offenen Punkt damit **besser** als vorher,
statt ihn zu verschlimmern — und zwar ohne die Kippmechanik anzufassen.

**Dabei aufgefallen:** Der Wächter „schleudert die Ladung nicht davon" maß
**eine** Zufallssaat und war grün, weil er einen ruhigen Wurf erwischt hatte.
Dieselbe Klasse Selbsttäuschung wie die NaN-Routen vom selben Tag. Er misst jetzt
acht.

**Wo die gekippte Ladung landet.** Abwurfkante (6,3 | −26,0) = **7,65 m** vom
Sitz, nach dem Anziehen 7,12 m — beides mitten im Band. Nach Süden bleiben
2,56 m bis zur Mauer: genug Auslauf, zu wenig, um in die Ausbuchtung zu rollen.
Alle vier Ecken der Ladefläche im Band (5,88 · 6,32 · 8,44 · 8,76 m).

**Die Presse war physisch die ganze Zeit richtig gebaut — nur die Hindernisliste
log.** `pressWaende()` rechnet die vier Wände aus denselben Zahlen wie die
Rapier-Kollider. Lichte Kammer 4,05 × 4,20 m, offene Spinne 3,38 m: **34 bzw.
41 cm Luft je Seite.** Das Paket liegt 7,40 bis 9,15 m vom Sitz, der Arm erreicht
den Boden von 3,0 bis 9,5 m. **Es reicht — knapp, aber gerechnet.** Für
Fahrzeuge bleibt sie dicht: Der Ring ist lückenlos, ein 8,04-m-Wagen ragt in
jeder Lage über mindestens eine Wand.

**Der Preis der Batterien in der Mulde.** Gemessen: Eine Kupferfuhre von 200 kg
bringt 180,00 €; dieselbe Fuhre mit 100 kg Akku dabei nur **80,00 €** — 100 kg
*mehr* in der Fuhre, 100 € *weniger* heraus, weil die Kasse Reinheit hoch drei
rechnet. Getrennt verkauft wären es 235,00 €. **In der Mulde kostet es null
Euro**, solange Lambert sie räumt; er liest die Fraktion des Stücks, nicht die
der Mulde.

**Der eigentliche Preis ist kein Geldbetrag: Das Schild warnt nicht mehr.**
Vorher drückte ein Akku 500 kg Buntmetall von 1602,00 € auf 1112,50 €; jetzt
stehen 1657,00 € da. Der Spieler bekommt kein Signal mehr, dass Gefahrgut
zwischen dem Kupfer liegt.

**Verworfene Alternativen.** Kipper leergreifen lassen statt kippen (Patrick: das
Kippen bleibt, es ist der einzige Weg, auf dem Material ohne Spielerarbeit auf
den Platz kommt). Eigene kleine Batteriemulde (empfohlen, Patrick entschied
dagegen — beide Folgen lagen ihm vor). Naiver Umzug mit 13 m Rückweg.

**Abnahmekriterium.** 566 Prüfungen in 54 Dateien grün · `fahrumriss` null
Durchdringungen auf allen Routen **auch mit dem 6,00-m-Kipper** · beide neuen
Wächter beim Rückbau des Fehlers nachweislich rot (`ABLADE_HALT_Z` auf −26,0 →
Kipper wird früher gefangen als die Pritsche; altes Presserechteck → 3 von 7 rot).

**Was frei geworden ist.** Die alte Kipperspur, x 2,0 von z −6,5 bis −16,5, rund
3 × 10 m. Im Schwenkband liegt davon der Streifen z −17,27 bis −13,65, also
**3,62 m** — die beste freie Fläche, die der Hof hat.

**Offen.** Der Ladungs-Katapult ist nicht behoben, nur nicht mehr gefüttert: 3
von 16 Ladungen gehen weiter über 130 km/h, Spitze 255. Ursache bleibt der
Schlitz am Kipplager. Und bei **geschlossener** Deckelklappe hält die
Hindernisliste den Greifer nicht mehr auf — die Klappe ist kinematisch und steht
in keiner Liste.

**Auf dem Gerät zu prüfen.**

1. Kommt ein gemischter Kipper rechts an dir vorbei zum Abladeplatz — und
   bekommst du **jedes** Stück des Haufens, ohne umzusetzen?
2. Fährt ein sortenreiner Kipper weiter die Gasse hinunter ins Silo? Er soll es.
3. Akku aus einem Wrack fischen und über „BUNT + VA" halten: **grün?**
4. **Ein Auto pressen und das Paket wieder herausholen.** Fühlen sich 34 bis
   41 cm Luft je Seite eng an oder passt es?
5. Die alte Kipperspur links vom Sitz ist jetzt leer — gehört dort etwas hin?

---

### E-033 — Eine Anlieferung entsteht aus dem Füllgrad der Ladefläche, nicht aus einer gewürfelten Tonnage (15.09.2026)

**Entscheidung.** Die Menge wird nicht mehr gewürfelt, sondern gerechnet:

> **Masse = Füllgrad × Laderaum × Schüttdichte**

Zuerst steht das Fahrzeug fest, dann der Aufbau, dann der Füllgrad — und daraus
folgt das Gewicht. Reicht die Nutzlast nicht, **sinkt der Füllgrad**, statt nur
die Zahl auf der Waage zu kappen.

**Begründung.** Patrick: „Es ist halt bei Händlern halt auch nicht immer das
Gewicht, sondern eher das Volumen auf der Ladefläche. Und da sollte in der Regel
immer ein vollgepackter LKW ankommen. Halb voll, mittelvoll, dreiviertel voll,
voll voll. Aber so ein Viertel voll ist schon eher selten bis schwierig."

Im ganzen Projekt gab es **keine Schüttdichte** — weder im Katalog noch in der
Anlieferung. Die Folge: 2,5 t Aluminium und 2,5 t Stahlguss sahen gleich aus,
obwohl das Alu sich in Wirklichkeit über die Bordwände türmt und der Guss als
flacher Fleck auf dem Boden liegt.

**Die vier Füllklassen sind Patricks Worte**, die Gewichte schief nach oben.
Gemessen an 60.000 Würfen, **nach** Nutzlastkappung:

| Klasse | gesamt | Händler | Gewerbe | Privat |
|---|---|---|---|---|
| viertel | **3,0 %** | 0,8 % | 3,1 % | 10,0 % |
| halb | 14,0 % | 11,2 % | 13,4 % | 23,8 % |
| dreiviertel | 34,9 % | 37,1 % | 33,6 % | 29,3 % |
| randvoll | **48,2 %** | 50,9 % | 50,0 % | 36,9 % |

Gewürfelt ist der Händler zu 68 % randvoll; übrig bleiben 50,9 %, weil bei
schwerem Material die Nutzlast vor dem Platz ausgeht (28 % aller Fuhren). Das
ist kein Fehler, sondern genau der Effekt: **Der Stahlguss liegt flach.**

**Die 600-kg-Regel von heute Vormittag (E-030) gilt nur noch für LKW.** Für
jeden Kipper und jede Pritsche hält sie — in 60.000 Würfen keine Fuhre darunter,
leichteste 680 kg. Für den **Privatmann mit Anhänger** hält sie nicht: Sein
Anhänger fasst 2,40 m³; ein Viertel davon voll Haushaltsschrott mit 35 % Holz und
Kunststoff sind rechnerisch 280 kg. **Der Füllgrad gewinnt** — das ist Patricks
Ansage. Betroffen sind 4,15 % aller Anlieferungen. Eine Notbremse bei 300 kg
greift in 0,28 % der Fälle.

Der Wächter ist **nicht heimlich gelockert**: `test/lademenge.test.ts` trägt
beide Fassungen im Kopf und bewacht jetzt drei Dinge — kein LKW unter 600 kg ·
niemand unter der Notbremse · der leichte Fall bleibt selten (unter 8 %) und
bleibt beim Privatmann mit höchstens halb vollem Anhänger.

**Was sich am Umschlag ändert: 4.503 → 5.544 kg je Fuhre, also +23 %.** Bei
0,16 €/kg Ankauf sind das im Mittel 887 € statt 720 € je Fuhre. Einkauf wie Erlös
steigen um knapp ein Viertel; der Kreislauf selbst ist unberührt (Patrick hat ihn
zurückgestellt).

**Verworfene Alternativen.** Schüttdichte als Korrekturfaktor auf die alte
Zufallsmasse — hätte das Bild nicht verändert. Eine stetige Schiefverteilung —
nicht erzählbar und nicht abnehmbar; die vier Klassen sind es.

**Abnahmekriterium.** 588 Prüfungen in 54 Dateien grün. Vier Mutationen gesehen:
Feststoff- statt Schüttdichte (4 Prüfungen rot) · Händlerverteilung gleichverteilt
(4 rot) · Ladeflächenlänge gegen `vehicles.ts` verschoben (2 rot) · Nutzlast kappt
nur die Masse statt auch den Füllgrad (2 rot).

**Der Prüfstein fehlt noch: Man sieht den Füllgrad nicht.** `vehicles.ts` würfelt
seine eigene Zielfüllung und weiß nichts vom gerechneten Füllgrad. Das ist **eine
Zeile**, die in diesem Paket nicht gesetzt werden durfte, weil dieselbe Datei
gerade für E-029 umgebaut wurde. Bis sie gesetzt ist, ist die Wirkung nur auf der
Waage zu sehen, nicht auf der Ladefläche.

**Auf dem Gerät zu prüfen.**

1. Sechs Fuhren nacheinander, nur auf die Waage schauen: Ist die Streuung größer
   als vorher — mal 1,2 t, mal 9 t, obwohl beide Wagen gleich aussehen?
2. Auf einen Privatmann mit Anhänger warten: Steht gelegentlich eine Zahl unter
   600 kg da — und **stört sie dich?**
3. Zwei Gewerbefuhren vergleichen, eine mit Alu, eine mit Stahl: Der Alu-Wagen
   muss deutlich leichter sein, obwohl beide dieselbe Pritsche fahren.

---

### E-032 — HUD in zwei Stapeln, sichere Ränder überall, die Ruhezeile fällt weg (15.09.2026)

**Entscheidung.** Vier Dinge in einem Paket, weil sie alle dieselbe Ursache
haben: HUD-Kästen, die einzeln an einer geschätzten Zahl am Bildrand hängen.

1. **Oben ein Stapel.** `#money`, `#shift` **und** `#debug` liegen in
   `#hudoben` (Flex-Spalte, 6 px, flach 4 px). Keiner trägt mehr einen eigenen
   Abstand zum Rand.
2. **Sichere Ränder.** `env(safe-area-inset-*)` wird erstmals benutzt — vier
   Variablen in `:root`, überall nach der Regel
   `max(Grundabstand, Rand + 8 px)`; nur wo ein Element auf einem anderen
   aufsitzt, steht `calc(Rand + Grundabstand)`.
3. **14 px im Querformat** für Griff-Info und Ladeanzeige (vorher 12).
4. **„Greifer: offen" verschwindet ganz** — mit 400 ms Nachlauf, damit es beim
   Schwenken nicht flackert. „Greifer: geschlossen (leer)" bleibt.

Dazu zwei Reihenfolgen getauscht: Im unteren Stapel steht die **Griff-Info
oben** und die Ladeanzeige unten, und die Einblendung (`#toast`) hat ihre Werte
aus dem Stilattribut ins CSS bekommen.

**Begründung.**

*Zu 1.* `#money` stand auf `top: 12` und ist mit 15 px Schrift, Zeilenabstand
1,5, 8 px Innenrand und 1 px Rahmen **41 px** hoch — es reichte bis 53, während
`#shift` bei 46 begann: **7 px Überlappung**, sichtbar seit dem 14.09. Die
Zahlen 12 / 46 / 80 waren geschätzte Kastenhöhen, und eine geschätzte
Kastenhöhe ist genau das, was nie stimmt. Der Debugblock bei 80 wäre der
nächste Fall gewesen, sobald der Tagesablauf zweizeilig wird — er ist deshalb
mit im Stapel. Ausgeblendet nimmt ein Flex-Kind keinen Platz ein; mit F3
erscheint er unter dem Tagesablauf, ohne dass irgendwo eine Zahl nachgezogen
werden muss.

*Zu 2.* `viewport-fit=cover` stand seit jeher im Dokument, `env()` wurde
**nirgends** benutzt. Nachgerechnet lagen im Querformat **sieben** Elemente
teilweise im Rand (Pedale, beide Drehtasten, Menüknopf, Ladeanzeige, Konto,
Tagesablauf), im Hochformat vier. Die Ladeanzeige saß 6 px über der Unterkante,
also auf dem weißen Balken.

Die Regel `max(Grundabstand, Rand + 8 px)` statt `Rand + Grundabstand` ist der
Kern: Eine Drehtaste, die ohnehin 132 px vom Bildrand weg sitzt, steht längst
außerhalb der 50 px breiten Notch-Zone. Hätte sie noch einmal 50 px eingerückt,
wäre der freie Streifen für den unteren Block um 50 px schmaler geworden —
ohne dass eine einzige Taste besser erreichbar würde. **Auf dem iPad, wo env()
null liefert, fällt jedes max() auf den alten Wert zurück: Die Fassung ist dort
Pixel für Pixel dieselbe wie vorher** (`test/sichererand.test.ts`).

*Zu 3.* Briefing Kap. 20 verlangt mindestens 14 px. Was es kostet, steht unten.

*Zu 4.* Patrick: „Ich weiß nicht, wofür wir ‚Greifer offen' überhaupt brauchen.
Also kann ganz verschwinden." Der Vorgänger hatte den blassen Kasten behalten,
weil der Greiferzustand ablesbar bleiben müsse — aber der Greifer selbst ist im
Bild zu sehen. `display: none` und nicht `opacity: 0`: Ein durchsichtiger
Kasten hält seine Fläche und schöbe die Ladeanzeige weiter nach oben.

**„Greifer: geschlossen (leer)" bleibt** — das ist keine Zustandsmeldung,
sondern die Antwort auf einen Handgriff. Wer zupackt und nichts bekommt, sieht
sonst nur eine geschlossene Spinne und weiß nicht, ob sie leer ist oder ob das
Teil hinter der Schale steckt. Patrick hat nur „offen" genannt, und er hat
gerade gemeldet, dass sich mittlere Teile schwer fassen lassen.

*Zur getauschten Reihenfolge.* Der Halter hängt am unteren Bildrand und wächst
nach oben: Was unten steht, liegt fest. Die Griff-Info wechselt mehrmals je
Sekunde ihre Zeilenzahl und verschwindet jetzt ganz — stünde sie unten, spränge
die Ladeanzeige bei jedem Griff auf und ab.

**Was 14 px kosten und wo sie herkommen.** Unterer Block, iPhone mini quer,
gemessen ab Bildunterkante:

| Fall | 12 px (alt) | 12 px + sichere Ränder | 14 px + sichere Ränder |
|---|---|---|---|
| Ruhe | 33 px (8,8 %) | 33 px | **0 px** |
| Alltag (ein Stück anvisiert) | 33 px (8,8 %) | 52 px (13,9 %) | 73 px (19,5 %) |
| schlimmster Fall | 83 px (22,1 %) | 126 px (33,6 %) | 141 px (37,6 %) |

Der große Sprung kommt **nicht von der Schrift**, sondern von den sicheren
Rändern: Sie nehmen im Querformat 100 px Bildbreite weg, derselbe Text braucht
dadurch eine Umbruchzeile mehr — **+43 px**. Die Schrift kostet **15 px**.

Zurückgeholt: Zeilenabstand 1,25 statt 1,35 (5 px), Innenrand 4/8 statt 4/10
(4 px, dazu 4 px mehr Textbreite), Zwischenraum 4 statt 6 (2 px) — zusammen
11 px. Und im Ruhezustand, also fast immer, die vollen 33 px.

**Verworfene Alternativen.**

- **`#touch` selbst einrücken** statt jedes Element einzeln. Wäre die kürzeste
  Fassung — alle Knöpfe darin sind absolut positioniert und wanderten mit. Sie
  ist falsch: Die schwebenden Sticks bekommen ihre Lage aus `clientX/clientY`,
  und die zählen ab dem Polsterkasten von `#touch`. Eingerückt läge **jeder
  Stick um die Randbreite neben dem Daumen**.
- **`Rand + Grundabstand`** statt `max(...)`. Hätte im Querformat 100 px
  Bildbreite gekostet, ohne dass ein einziges Element dadurch besser stünde.
- **Bei 12 px bleiben** und die Ausnahme ins Log schreiben. Spart 15 px im
  seltenen schlimmsten Fall und 21 px im Alltag; kostet die Lesbarkeit genau
  der Zeile, nach der man den Abwurf entscheidet. Das Bild dazu liegt bereit
  (`alternative-12px-iphone-mini-quer-voll.png`) — es ist **eine Zahl im CSS**,
  falls Patrick am Gerät anders entscheidet.
- **Die Aufzählung im Querformat ganz ausblenden.** Hätte nichts gebracht: Der
  schlimmste Fall ist nicht die volle Spinne, sondern das **anvisierte** Stück
  mit langem Namen und Materialangabe — und das hat gar keine Aufzählung.
- **Die Drehtasten im Querformat verschieben**, um den freien Streifen zu
  verbreitern. Das ist Steuerung, nicht Anzeige; nur auf Patricks Wort.

**Abnahmekriterium.** `test/sichererand.test.ts` (neu) prüft in allen drei
Fassungen, dass **kein** Bedienelement und keine Anzeige in einen sicheren Rand
ragt, dass jedes `env()` einen Ersatzwert `0px` hat (ältere Safari-Fassungen
verwerfen sonst die ganze Deklaration), dass `#touch` selbst nicht eingerückt
ist — und dass die iPad-Fassung Pixel für Pixel dieselbe bleibt.
`test/hudplatz.test.ts` prüft den oberen Stapel in allen drei Fassungen, mit
und ohne F3-Zahlen. `test/greifanzeige.test.ts` hat einen zweiten, engeren
Deckel für den **Alltagsfall** bekommen (27 %), und der Deckel für den
schlimmsten Fall ist von 35 auf 40 % gestiegen — mit der Begründung im Test.
Die gemeinsame Rechnung steht jetzt einmal in `test/cssmass.ts` statt zweimal.

Jeder der neuen Wächter wurde **einmal absichtlich zum Fallen gebracht**, bevor
ihm geglaubt wurde (Lehre vom 15.09.: ein Wächter war zwei Stunden grün, weil
seine Eingaben NaN waren). `loese()` wirft deshalb bei jedem Wert, den es nicht
versteht, statt NaN weiterzureichen.

**Nebenbefund, mit behoben.** Die Einblendung `#toast` trug ihre Werte im
Stilattribut (`style="top: 56px; …"`). Ein Stilattribut schlägt jeden Selektor
— die Regel `#toast { top: 60px; font-size: 12px; }` in der flachen Fassung hat
**nie gewirkt**. Alles Ruhende steht jetzt im CSS; das Skript setzt nur noch
`opacity`.

**Offen.**

1. **Konto (12 px), Tagesablauf (11 px), Tutorialtext (11 px) und Einblendung
   (12 px) liegen im Querformat weiter unter 14 px.** Sie waren nicht Teil des
   Auftrags. Konto und Tagesablauf auf 14 zu heben kostet oben links rund
   14 px und schiebt die Tutorialkarte entsprechend nach unten — beides
   unkritisch, weil dort Himmel steht. Empfehlung: im nächsten kleinen Paket
   nachziehen, zusammen mit einer Sichtung des Tutorialtexts.
2. **Der Nachlauf von 400 ms ist ein Startwert.** Am Gerät zu bestätigen: Wenn
   die Zeile beim Schwenken über eine Halde noch flackert, muss er hoch; wenn
   sie zu lange etwas Falsches zeigt, runter.
3. **Die 50 px Seitenrand im Querformat sind der ungünstigste angenommene
   Wert.** Meldet Safari auf Patricks iPhone weniger, wird alles nur
   großzügiger — nie enger.

**Auf dem Gerät zu prüfen.**

1. **iPhone mini quer:** Spinne offen über nichts — steht unten links wirklich
   **nichts** mehr, kein blasser Kasten? Und danach über eine Halde schwenken:
   Flackert die Zeile beim Überstreichen, oder erscheint sie ruhig?
2. **iPhone mini quer:** Ein großes Teil greifen und über die falsche Mulde
   halten. Ist die Schrift jetzt bequem lesbar — und verdeckt der Block dabei
   zu viel? Wenn er zu viel verdeckt, sag es: 12 px sind eine Zahl im CSS.
3. **iPhone mini hoch:** Oben rechts schauen — stehen Konto und Tagesablauf
   **unter** der Notch und **neben** dem Menüknopf, ohne dass eine Ziffer
   angeschnitten ist?
4. **Beide Geräte, quer und hoch:** Sind die Fahrpedale unten links und die
   Drehtasten rechts **über** dem weißen Balken erreichbar, ohne dass ein Tipp
   ins Leere geht oder iOS nach Hause wischt?
5. **iPad quer:** Sieht das HUD aus wie gestern? Dort soll sich **nichts**
   geändert haben außer der verschwundenen Ruhezeile.

---

### E-034 — Eine Mulde neben der Presse, der Müll wird ein versetzbarer Container (15.09.2026)

**Entscheidung.** Rechts vom Bagger (−x) steht nur noch **ein** Behälter: die
Buntmetall-Mulde, gerückt an die Presse auf **(−7,6 | −19,8)**, mit einem
**Sockel aus zwei Lagen Betonlego (1,00 m)** auf der Baggerseite. Die
Müllmulde ist abgerissen; der Müll geht ab jetzt in einen **frei platzierbaren
Absetzcontainer**, der morgens auf (−2,8 | −15,4) steht und dem Spieler
gehört, sobald er ihn einmal angefasst hat.

Ansage Patrick: „Ich würde die Mulden da rechts vom Bagger nochmal alle
abreißen und dann direkt eine Mulde neben der Presse platzieren, eben mit
Sockel, aber aus zwei Elementen und zur Ostseite offen. Und den Rest erstmal
wegmachen." Und: „Nein, den Müll nehmen wir in einen frei platzierbaren
Container."

---

**Wo die Mulde steht, und warum genau dort.** „Neben der Presse" ist eine
Rechnung, kein Gefühl. Die Presse sitzt auf (−8,0 | −26,0); ihr Rahmen endet
nach Norden auf z −23,55, und ihre Deckelklappe schwingt 3,85 m nach **Westen**
— nach Norden schwingt nichts. Der Streifen nördlich der Maschine ist damit der
einzige, der zugleich frei ist und im Schwenkband liegt.

| | |
|---|---|
| Mitte (−7,6 \| −19,8) | **7,60 m** vom Sitz (−0,5 \| −22,5) |
| Muldenachse z −22,8 … −16,8 | 7,11 … 8,98 m — **100 %** im Band 5,8–9,2 (vorher 93 %) |
| Südflanke (Hindernisliste) bis z −23,15 | **0,40 m** vor dem Pressenrahmen |
| Ostkante der Schwelle x −4,95 | 0,35 m bis zum Müllcontainer |

Die 0,60 m nach Süden sind der ganze Gewinn: Vorher lagen 7 % der Mulde
außerhalb der Reichweite, jetzt keiner.

**Der Sockel wird zwei Lagen hoch — und die Rechnung von heute Vormittag
bleibt trotzdem stehen.** Am Vormittag wurde eine Lage gebaut, und zwar
begründet: Bei Augpunkt 3,28 m (abgesenkte Kabine) streift der Blick die
Wandkrone, `blind = h × D / (H − h)`. **Am neuen Standort** (Schwelle auf
x −5,5, also 5,01 m vom Sitz am vorderen und 7,58 m am hinteren Ende) sieht das
so aus:

| Sockel | vorderes Ende | Mitte | hinteres Ende |
|---|---|---|---|
| 0,50 m (eine Lage) | 79 % | 76 % | 68 % |
| **1,00 m (zwei Lagen, gebaut)** | **48 %** | **41 %** | **21 %** |

Patrick hat die eine Lage am Gerät gesehen und entschieden: „da kommt einfach
noch 'ne Lage drüber, damit die Anhäufung etwas höher ist." Das gilt. Die Zahl
steht hier als **Messung**, nicht als Einwand — und sie ist am neuen Standort
besser als am alten (dort wären es 16–48 % gewesen), weil die Mulde näher am
Sitz liegt und der tote Streifen mit dem Abstand wächst. Die harte Grenze liegt
bei **1,17 m**: Darüber sieht man vom hinteren Ende überhaupt keinen Boden
mehr. Eine dritte Lage geht also nicht, und der Wächter in
`test/buntmetall.test.ts` sagt das jetzt genau so — er hält die Entscheidung
fest (zwei ganze Lagen) und die Messung daneben, statt die alte Schranke zu
verteidigen.

**Warum `facing` weiter „west" heißt, obwohl die Mulde nach Osten offen ist.**
Sie IST zum Bagger hin offen: Dort steht nur die Schwelle, keine Wand
(`shareEast`, E-006). Das Feld `facing` sagt aber nicht, wo eine Mulde steht,
sondern wo **Lambert und ein sortenreiner Kipper anfahren** und wo das Schild
hängt. Auf „east" gedreht wanderte Lamberts Halteplatz von (−11,9 | −19,8) auf
(−3,3 | −19,8) — mitten in den Arbeitsbereich des Baggers (`imBaggerrevier`),
und das Schild stünde dem Fahrer im Bild. Gebaut ist, was Patrick beschreibt;
der Bezeichner behält seine eigene Bedeutung. **Im Zweifel die Koordinaten
lesen, nie die Namen.**

---

**Der Müllcontainer.** Er ist ein `rolloff` — die Bauform stand seit dem
12.09. im Quelltext und wurde seit dem Umbau auf Trennsteine von keinem
Behälter mehr benutzt. Sein Maß ist an zwei Schranken gerechnet, nicht
gewählt:

- **3,60 m quer** — das Breiteste, was zwischen die Schwelle der
  Buntmetall-Mulde (x −4,95) und die Kipperspur (Wagenflanke x 0,45, Tastrand
  1,40 m) passt. Es bleiben 3,70 m, der Container nimmt 3,60. Lichte Weite
  3,42 m, die offene Sichelkralle misst 3,38 — man kommt hinein.
- **4,30 m längs** — **einen Dezimeter länger als die Presskammer** (licht
  4,20 × 4,05 m). Er passt in keiner Lage hinein. Das ist die Sperre gegen
  „Container in der Presse", und sie ist Geometrie statt Abfrage. Ansage
  Patrick: „Der Container kann nicht gepresst werden. Dann gibt es die
  Fehlermeldung der Presse." Die Fehlermeldung selbst gehört in `press.ts`
  (fremdes Paket); `ContainerManager.platzinventarIn()` steht dafür bereit.
- **0,80 m Wandhöhe** (SW) — bei 6,72 m Abstand zur Vorderkante bleiben 40 %
  des Bodens sichtbar. Bei 1,00 m wären es 18 %, bei 1,20 m gar nichts.

**Leer wiegt er 1781 kg** (Bodenplatte 3,60 × 0,31 × 4,30 m und vier Wände auf
Dichte 300 kg/m³, Bestand seit dem 12.09.). Der Greifer trägt 3500 kg — leer
geht er also hoch, ab rund 1,7 t Müll darin nicht mehr. Dafür braucht es keine
Abfrage: Das Ladegewicht hängt als Zusatzmasse am Körper. Kippen kann er nicht,
nur die Hochachse ist freigegeben.

**Er hat kein Zuhause.** Ansage: „Der Container soll erstmal frei bleiben,
damit ich auch testen kann, wo der am besten steht." Also: kein Zurückschnappen,
keine Sollposition, kein Wächter, der ihm folgt. Die Koordinate im Datensatz
ist sein **Startplatz**, und der ist begründet — im Band (7,46 m), 1,45 m neben
der Kipperspur, 0,35 m neben der Schwelle, 82 % seiner Grundfläche in
Reichweite. Mehr geht nicht: Der Ring ist 3,40 m breit, der Container 3,60 m.

**Platzinventar — eine Gattung, kein Sonderfall.** „Also wie auch der Besen ist
es ein fester Bestandteil des Platzes." Das Kennzeichen `platzinventar` steht
deshalb im Datensatz, die gemeinsamen Regeln in `world/platzinventar.ts` —
der Besen aus dem Nachbarpaket kann dieselbe Fassung tragen. Es sagt zwei
Dinge: **unverkäuflich** und **sein Inhalt ist nicht seine Sache**.

Unverkäuflich ist er an **einer** Stelle, nicht an fünf: Die Hülle ist kein
`ScrapItem`, und `Account.sellContainer` rechnet ausschließlich über die Liste
des `ItemManager`. Es gibt gar keinen Weg in eine Geldformel — weder leer noch
voll, weder über den Abholer noch über die Presse. Was auf seinem Schild steht,
ist der **Inhalt**, wie bei jeder anderen Mulde.

**Nachts wandert der Inhalt ins ABFALL-Silo, die leere Hülle bleibt stehen.**
Ansage: „Wenn mal Müll verschwindet, dann verschwindet er über Nacht nicht,
sondern landet in dem Müllsilo. Da wird er dann gelagert. Und der Container
stünde wieder bei mir." Dieselbe Regel gilt, wenn ein Abholer den Container
mitnimmt — „Mit ohne Müll in dem Fall" —, und deshalb ist es **eine** Funktion
mit zwei Auslösern (`inhaltInsLager`), nicht zweimal dasselbe. Es ist kein
Verkauf: Kein Euro wechselt den Besitzer, nichts wird gelöscht, die Stücke
werden **versetzt** und liegen danach dort, wo Lambert sie hingetragen hätte.
Der Müll hat damit zum ersten Mal einen ganzen Weg: Wrack → Container → Silo.

**Woran der Tageswechsel hängt.** `economy/shift.ts` führt **keinen**
Tagesablauf und keine Phasen — es zählt Sekunden, Umschlag und Fuhren und macht
die Einfahrt zu, wenn der Platz zusteht. Einen Morgen gibt es dort nicht. Der
einzige Tageswechsel des Spiels ist die Uhr in `world/daylight.ts`: `time`
läuft modulo 1, ein Tag dauert 900 s. Daran hängt die Nachtschicht und an
nichts sonst; ein zweiter, erfundener Tagesanfang wäre eine zweite Wahrheit
über dieselbe Sache. Gemeldet wird er nicht per Rückruf, sondern **abgeholt**
(`platzwache.tagGewechselt("…")`) — so braucht es keine Verdrahtung in
`main.ts` und keine feste Reihenfolge.

**Lamberts Sperrgebiet hing am Müll und hängt jetzt am Bagger.** Die Nordgrenze
seines Reviers stand als `max(z + Länge/2)` über die Sortierbox **und die
Müllmulde**. Mit einem versetzbaren Container wäre das Sperrgebiet mit ihm
gewandert: Wer ihn in die Ecke schiebt, gäbe die Fläche vor dem Bagger frei.
Ein Sperrgebiet, das man wegtragen kann, ist keines. Jetzt: 9,2 m Reichweite
plus 1,4 m, damit der Halteplatz des Kippers (z −12,5) mit drin liegt — das
ergibt −11,9, genau den Wert, der vorher zufällig herauskam.

**Verworfene Alternativen.**

- **`facing: "east"` für die Mulde** (wörtlich „zur Ostseite offen"): stellt
  Lambert in den Arbeitsbereich des Baggers und das Schild ins Bild. Gebaut ist
  dasselbe, nur ohne den Nebenschaden.
- **Der Container 4,2 m breit** (das Maß aller anderen Behälter): Zwischen
  Schwelle und Kipperspur bleiben 3,70 m. Er hätte entweder in der Fahrspur
  gestanden oder an der Muldenwand geklemmt.
- **Der Container kürzer als 4,20 m**: dann passt er in die Presskammer, und
  „kann nicht gepresst werden" bräuchte eine Abfrage in fremdem Quelltext.
- **„Erscheint am nächsten Tag wieder, falls er weg ist"**: hinfällig, seit die
  beiden Verlustwege zugemauert sind (Presse zu klein, Abholer bringt ihn
  zurück). Eine Rettung für einen Fall, den es nicht gibt, wäre Ballast.
- **Eine Standardstelle „in der Stahlschrott-Fraktion an der Wand"**: von
  Patrick ausdrücklich zurückgezogen — er will die beste Stelle selbst finden.

**Abnahmekriterium.** 564 Prüfungen in 53 Dateien grün, darunter:

- `test/buntmetall.test.ts`: zwei ganze Lagen, die Sichtbarkeit am neuen
  Standort auf zwei Stellen (48 · 41 · 21 %), die harte Grenze bei der dritten
  Lage, und die Lücke zur Presse zwischen 0 und 1,5 m.
- `test/platzinventar.test.ts` (neu, 11 Prüfungen): Leergewicht 1781 kg unter
  der Greifgrenze, lichte Weite über der offenen Spinne, Startplatz im Band und
  1,45 m neben der Kipperspur, jedes Kilo kommt im Silo an, nichts wird
  ineinander abgesetzt, der Tageswechsel meldet sich genau einmal je Frager.
- `test/silos.test.ts`: der Container passt nicht in die Presskammer, steht auf
  keinem festen Bauwerk und nicht in der Schwelle der Mulde.
- `test/fahrumriss.test.ts`: 27 Strecken × 6 Fahrzeuglagen gegen die
  Bauwerksliste, **null Durchdringungen**.

Grundriss vorher/nachher: `docs/messungen/2026-09-15_eine-mulde.svg`.

**Offen.**

1. **Die Fehlermeldung der Presse gibt es noch nicht.** Der Container kann
   nicht hinein (Geometrie), aber wer es versucht, bekommt kein Wort. Dafür
   braucht es drei Zeilen in fremdem Quelltext: ein Ereignis in
   `core/events.ts`, eine Abfrage in `press.start()` und einen Zuhörer im HUD.
2. **Der Abholer weiß noch nichts vom Container.** `leereBehaelter()` steht
   bereit; die Zustandsmaschine in `delivery/vehicles.ts` (fremdes Paket) muss
   sie beim Losfahren rufen und die Hülle beim Bagger abkippen.
3. **Batterien haben weiter kein Ziel am Bagger.** Sie liegen ausdrücklich
   nicht in „BUNT + VA" (Gefahrgut, und der Bleiakku drückt die Reinheit) —
   offener Punkt seit E-028, unverändert.
4. **Das Silo kennt keine Kapazität in Kilogramm, nur in Plätzen.** Die
   Nachtschicht setzt rasterweise ab: 4 × 5 Plätze je Lage, drei Lagen, also
   60 Stück im ABFALL-Silo. Was darüber hinausgeht, **bleibt im Container
   liegen** und wird gemeldet (`LagerBericht.rest`) — keine erfundene Regel,
   aber auch noch keine Anzeige dafür.
5. **Bodies, Physik-ms und Haufenruhe sind ungemessen.** Zählbar: zwei
   Betonlego-Mulden weniger, ein Absetzcontainer mehr — unter dem Strich vier
   InstancedMesh und ein Schild weniger, dafür ein dynamischer Körper mehr.

**Auf dem Gerät zu prüfen.**

1. **Kabine ganz runter, nach vorn rechts schauen:** Steht dort nur noch die
   eine Mulde, direkt an der Presse — und siehst du über den doppelten Sockel
   noch genug vom Boden, um zu sehen, was drinliegt? Gerechnet sind 48 % vorn
   und 21 % hinten.
2. **Presse einmal ganz durchlaufen lassen:** Schlägt die Deckelklappe irgendwo
   an die neue Mulde? Zwischen beiden liegen 0,40 m, und die Klappe schwingt
   nach der anderen Seite.
3. **Den Müllcontainer greifen und umsetzen:** Bekommt die Spinne ihn leer
   hoch, oder schleift sie ihn nur? Und bleibt er dort stehen, wo du ihn
   absetzt?
4. **Etwas Müll hineinwerfen und eine Nacht abwarten** (ein Tag dauert
   15 Minuten): Steht der Container morgens leer da, und liegt der Müll im
   ABFALL-Silo an der Südmauer?
---

---

---
### E-035 — Die Sortierregel bekommt einen Wächter; der Abstand zwischen Schild und Kasse wird gemessen, nicht geschlossen (15.09.2026)

**Entscheidung.** Drei Dinge, alle in `test/`, `tools/` und `docs/` — **kein
Produktivcode angefasst**:

1. `test/fraktionen.test.ts` (22 Prüfungen) wacht ab sofort über
   `fraktionAus`/`SORTENREIN_AB`, über die abgeleiteten Fraktionen aller 271
   erreichbaren Katalogeinträge und über die Frage, ob jede Fraktion ein Ziel
   hat.
2. `tools/farbabstand.ts` misst Farbabstände in ΔE2000 statt in RGB und prüft
   sich dabei selbst gegen die Prüfdaten von Sharma/Wu/Dalal (2005).
   `tools/fraktionsblatt.ts` zeichnet daraus `docs/fraktionen-2026-09-15.svg`.
3. Der Abstand zwischen **Muldenschild** und **Kasse** wird als Befund
   festgehalten (W-1 bis W-10 in `docs/fraktionen.md`), **nicht behoben**. Die
   Wächter dazu sind grün und im Text mit „BEFUND" gekennzeichnet.

**Begründung.** Patrick, 15.09.2026 nach dem Gerätetest: „Es ist nicht wirklich
erkennbar, was Stahlschrott ist und was Mischschrott ist. Auch die
Kategorisierung ist mir nicht ganz bewusst." Die Bestandsaufnahme dazu hat zwei
Löcher gefunden:

- `fraktionAus` entscheidet für **jedes** Teil im Spiel über die Fraktion und
  hatte **keinen einzigen Test**. Gesucht am 15.09.2026 in allen 51
  Testdateien: null Treffer für `fraktionAus`, `SORTENREIN_AB`, `istPressbar`.
- Schild und Kasse rechnen verschieden, gemessen um Faktor **87** bei der Mulde
  „BUNT + VA" (Schild 1742 €, Kasse 20 €) und um Faktor **6** bei KUPFER-LAGER
  und ALU-LAGER. Das beantwortet zugleich Prüfpunkt 3 aus E-028 („stimmt der
  Betrag am Container mit dem Schild am Silo überein?") — nein, und nicht knapp.

Warum nicht behoben: Es gibt zwei Wege (die Kasse lernt `mitFraktionen`, oder
das Schild zeigt den echten Erlös), und beide verändern das Spiel verschieden
stark. Der eine nimmt die Entscheidung Kupfer/Messing aus dem Spiel, der andere
lässt die HUD-Zahl „Sortierwert" deutlich fallen. Das ist Patricks Entscheidung,
nicht meine (V-2 in `docs/fraktionen.md`).

**Verworfene Alternative.** (a) Die Kasse gleich auf die Schild-Rechnung
umstellen — die naheliegende Reparatur; sie nimmt zugleich den Anreiz, Kupfer von
Messing zu trennen, und genau dieser Anreiz ist laut `materials/catalog.ts:19-23`
der Sinn der eigenen Mulde. (b) Die Befunde nur in den Bericht schreiben und
nicht in Tests gießen — dann wandern die Zahlen beim nächsten Umbau
stillschweigend, und in vier Wochen misst sie jemand neu. (c) Die Farben in RGB
vergleichen — RGB lügt: Stahl und Misch liegen dort in Grün 0 und in Blau 4
Einheiten auseinander, und genau dort sieht das Auge am schärfsten.

**Abnahmekriterium.** `npm test` grün: 570 Tests in 52 Dateien (vorher 548 in
51), darunter `test/fraktionen.test.ts`. `npm run build` grün. Das Werkzeug
prüft sich selbst: `pruefeDeltaE()` meldet größte Abweichung 0,000042 bei 16
Prüfpaaren. Die Wächter `collision`, `customers`, `haggle`, `purity`, `save`,
`shift`, `tutorial`, `upgradeEffects`, `upgrades` bleiben grün.

**Widerspruch zu älteren Einträgen, benannt und nicht aufgelöst.** Der Kopf
dieses Logs sagt „Neueste oben"; tatsächlich steht die neueste Entscheidung seit
E-006 unten. Dieser Eintrag folgt der gelebten Reihenfolge, nicht dem Kopf.
Zweitens: `src/world/containers.ts:96-99` beschreibt eine Abrechnungsregel
(„wer Kupfer und Messing zusammen abgibt, bekommt für alles den Kupferpreis"),
die `src/economy/account.ts` nicht hat — dort gewinnt die schwerste Fraktion in
der Ladung, und bei Gleichstand die zuerst geladene.

**Auf dem Gerät zu prüfen.**

1. **Zwei weiße Geräte nebeneinander greifen** — Elektroherd und Waschmaschine:
   Siehst du ohne die Greifanzeige einen Unterschied? Gemessen ΔE 0,18, also
   nach der Farbmetrik keinen.
2. **Vor die Trennsteine zwischen den beiden Halden fahren:** Weißt du ohne
   Schild, auf welcher Seite du stehst? Das Schild blendet sich unter 4,5 m
   Kameraabstand vollständig aus.
3. **`docs/fraktionen-2026-09-15.svg` auf dem iPhone** unter `/v1/plaene/`
   öffnen: ohne Zoom lesbar? Und stimmt, was daraufsteht, mit dem überein, was
   du im Spiel erlebst?

---
---

### E-041 — Der Müllcontainer steht morgens neben der Buntmetall-Mulde (15.09.2026)

**Entscheidung.** Der Startplatz des Müllcontainers wandert von
**(−2,8 | −15,4)** auf **(−3,79 | −14,11)**. Maße, Gewicht, Kennzeichen
`platzinventar` und die Regel „kein Zuhause, kein Zurückschnappen" bleiben
unverändert.

Ansage Patrick auf die Frage, ob ihn der Container fünf Meter geradeaus vor
dem Bagger stört: **„Direkt neben Buntmetall-Mulde."**

**Begründung — die Koordinate ist gerechnet, nicht gegriffen.** Vier Schranken
gelten gleichzeitig:

| | |
|---|---|
| 1 Mitte im Schwenkband | 5,80 … 9,20 m vom Sitz (−0,5 \| −22,5) |
| 2 kein Kontakt zur Mulde | Wände, Sockel (2 Lagen, 1,00 m), Schwellensteine bis x −4,95 |
| 3 Fahrlinie nach vorn frei | \|x + 0,5\| ≥ 1,80 + 1,30 (`CHASSIS_PAD`) = 3,10 |
| 4 Rückfahrspur frei | x + 1,80 ≤ 6,30 − 1,55 − 1,40 = 3,35 |

Aus 3 und 4 zusammen folgt **x ≤ −3,60**: Nach Osten auszuweichen verlangte
x ≥ 2,60, und das verbietet 4. Damit liegt die Westkante des Containers bei
x ≤ −5,40, also hinter der Schwelle der Mulde (Außenkante −4,95). **Östlich
der Mulde — dort, wo er stand — gibt es überhaupt keinen Platz mehr, der nicht
in der Fahrlinie liegt.** Bleibt der Streifen nördlich von ihr; ihre Nordwand
endet auf z −16,45.

Im 5-cm-Raster über den ganzen Platz abgesucht (x −14 … 8, z −34 … −6, Umriss
gegen Umriss statt Punktprobe) bleibt genau **eine** freie Tasche übrig:
**x −4,67 … −3,60, z −14,30 … −13,84** (1,07 × 0,46 m). „Direkt neben der
Mulde" ist damit keine Vorliebe, sondern das Einzige, was die vier Schranken
zusammen noch zulassen.

Genommen wird der **Mittelpunkt dieser Tasche** — der eine Punkt, der von
allen drei engen Grenzen gleich weit weg ist. Mit s als diesem Abstand:
x = −3,60 − s, z = −14,30 + s, hypot(3,10 + s; 8,20 + s) = 9,20 − s, also
s² + 41 s − 7,79 = 0 → **s = 0,189 m**.

| | |
|---|---|
| Mitte (−3,79 \| −14,11) | **9,01 m** vom Sitz (Band bis 9,20) |
| Grundfläche | x −5,59 … −1,99, z −16,26 … −11,96 |
| zur Mulde (Nordwand) | **0,19 m** — vorher 0,35 m zur Schwelle |
| zur Fahrlinie | **0,19 m** — vorher **−0,80 m**, also mittendrin |
| zur Rückfahrspur | **5,34 m** |
| zum nächsten Fahrzeugumriss | **3,62 m** (Kipper auf der Anfahrt) |

**Was es kostet, als Messung und nicht als Einwand.** Vom Sitz aus liegen noch
**53 %** seiner Grundfläche im Schwenkband; vorher waren es 82 %. Erreichbar
ist die **Südhälfte**, die zur Mulde hin — die Nordkante ist 11,04 m weg. Mehr
geht an dieser Stelle nicht: Die Tasche ist nur 0,19 m „dick". Jeder
Zentimeter nach Süden geht in die Mulde, jeder nach Osten in die Fahrlinie,
jeder nach Norden aus dem Band. Der Container bleibt frei versetzbar; wer ihn
lieber ganz in Reichweite hat, schiebt ihn und lebt damit, dass die Maschine
nicht mehr geradeaus fahren kann.

**Verworfene Alternativen.**

- **Ihn östlich der Mulde lassen und nur nach Norden schieben** (näher an
  Patricks Wortlaut): geht nicht, siehe oben — östlich der Mulde ist jeder
  Platz in der Fahrlinie.
- **Ihn quer stellen** (4,30 m in x, 3,60 m in z): bringt 58 % statt 53 % im
  Band und eine größere Tasche, dreht aber beide Maße gegeneinander, deren
  Herleitung im Datensatz steht. Vorschlag, keine stille Änderung — siehe
  „Offen".
- **Ihn dicht an die Mulde setzen, ohne Luft:** Er ist ein dynamischer Körper.
  Wer ihn in eine Wand stellt, lässt ihn im ersten Physikschritt wegspringen
  (v2 E-010).

**Nebenbefunde, beide beim Nachrechnen aufgefallen.**

1. **Die Punktprobe in `test/silos.test.ts` hat nie geprüft, was sie
   behauptete.** Sie stach neun Stellen im Raster 0,5 m ab und fragte
   `hitsObstacle`. Gegengerechnet: Ein Startplatz **mitten in der
   Presskammer** kommt da glatt durch, weil die Kammer innen offen ist und
   keine der neun Stellen in einer Wand liegt. Ersetzt durch Rechteck gegen
   Rechteck über die ganze Hindernisliste, Schranke 0,15 m.
2. **`test/fahrwerk.test.ts` war grün aus dem falschen Grund.** Er maß seit
   gestern Abend rückwärts, mit dem Container als Begründung — jetzt wieder
   vorwärts. Dabei kam heraus: Das Rad zeigt immer den Stand des **vorigen
   Bildes**, weil `Excavator.update` erst `syncMeshes()` ruft und danach die
   gefahrene Strecke auf `wheelSpin` rechnet. Bei 3,2 m/s sind das 5,3 cm oder
   0,086 rad — das Vierfache der Toleranz. Rückwärts fiel es nicht auf, weil
   die Maschine nach 5,30 m am ersten Trennstein steht und auf den letzten
   Bildern gar nicht mehr fährt: Wer stillsteht, hat keinen Rückstand.

**Abnahmekriterium.** 776 Prüfungen in 69 Dateien grün, darunter drei neue
Wächter, jeder einmal absichtlich zum Scheitern gebracht:

- `test/silos.test.ts` „steht nicht in der Fahrlinie des Baggers nach vorn" —
  am alten Platz: „nur 2.30 m neben der Fahrlinie, nötig sind 3.10 m".
- `test/silos.test.ts` „berührt die Buntmetall-Mulde nicht, auch den Sockel
  nicht" — 2D statt nur x, mit Ober- UND Untergrenze („das ist nicht mehr
  daneben" ab 2,00 m).
- `test/fahrumriss.test.ts` „keiner fährt durch den Startplatz des
  Müllcontainers" — 27 Strecken × echte Wagenumrisse gegen den Grundriss;
  vorher stand der Container in keiner Liste und wurde von diesem Wächter nie
  angesehen.

Grundriss nachgezogen: `docs/messungen/2026-09-15_eine-mulde.svg`.

**Offen.**

1. **Die 53 % Reichweite.** Soll der Container quer gestellt werden (58 %)?
   Das dreht die Maße 3,60/4,30 gegeneinander; die Sperre gegen die Presse
   (4,30 > 4,20) und die lichte Weite (3,42 > 3,38 m Sichelkralle) halten
   beide Lagen aus. Empfehlung: erst am Gerät ansehen, dann entscheiden.
2. **`docs/entscheidungen.md` enthält seit dem Zusammenführen am 15.09. abends
   echte Konfliktmarken** (`` Zeile 1540, `=======` 1950,
   `>>>>>>>` 2158). Beide Seiten tragen Inhalt. Nicht mein Paket, aber es
   gehört aufgelöst, bevor jemand den Stand liest.
3. **Der eine Rahmen-Befund aus Nebenbefund 2** — Rad und Maschine ein Bild
   auseinander — gehört in `excavator/excavator.ts` und damit nicht in dieses
   Paket. Sichtbar ist es nicht; der Test rechnet es jetzt sauber mit.

**Auf dem Gerät zu prüfen.**

1. **Einfach losfahren, ohne zu lenken:** Kommt die Maschine jetzt an dem
   Container vorbei, oder schrammt sie ihn? Gerechnet sind 0,19 m zwischen
   Container und Tastrand — an der Blechkante rund 0,3 m.
2. **Vom Sitz aus Müll in den Container werfen:** Erreichst du seine vordere
   Hälfte bequem? Die hintere Kante ist mit Absicht außer Reichweite (11,04 m),
   das ist der Preis dafür, dass er neben der Mulde steht.
3. **Den Container greifen und woandershin stellen:** Bleibt er dort stehen,
   und ist der Weg nach vorn danach wieder zu?

---

### E-036 — Der Bagger ist gebaut: sieben Pakete, 137 → 59 Netze (15.09.2026)

**Entscheidung.** E-025 ist umgesetzt, Paket für Paket und Commit für Commit:
Zylinder · Drehkranz · Ausleger/Stiel · Fahrer · Fahrwerk · Oberwagen ·
Räumschild/Pratzen · Kabine. Je Baugruppe ein eigenes Modul nach dem Muster von
`wheelParts.ts`; neu ist `bauteile.ts`, das mehrere Farben über Eckfarben in
**ein** Netz legt — so kostet der Fahrer mit fünf Farben zwei Netze statt fünf.

| | vorher | nachher |
|---|---|---|
| Einzelteile | 157 | **rund 330** |
| Netze | 137 | **59** |
| Zeichenrufe | 194 | **89** |
| Dreiecke | 15.420 | 20.144 |

**Doppelt so viele Teile bei 105 Zeichenrufen weniger.** Dreiecke sind auf dem
Gerät fast gratis, Netze sind der Engpass — das ist der ganze Kern von E-025.

**Drei Zahlen, an denen man es sieht.**

1. **Die Kolbenstange wurde um +128 % gedehnt** (0,97 → 2,21 m) und wird jetzt
   geschoben: Das Rohr behält seine 2,298 m, nur die Stange fährt aus. Von außen
   erkennt man es am Führungskopf, der immer an derselben Stelle des Rohrs
   sitzt, und am Gabelkopf, der seine Größe behält.
2. **Die obersten 54 cm jedes Rades steckten im Rahmenkasten**, 20 cm in der
   Breite. Die Wange setzt jetzt auf 1,24 m auf, also auf der Radoberkante.
3. **Kein Rad hat sich je gedreht.** Sie rollen jetzt aus der wirklich
   gefahrenen Strecke, die vorderen lenken bis 33,3° — gerechnet aus Radstand
   und Wenderadius, nicht gesetzt.

**Fünf Stellen, an denen das Konzept nicht aufging** und die der Bau korrigiert
hat: Der Achsschenkel kann nicht „beweglich" sein, ohne zwei Netze zu kosten
(fest ins Stahlnetz gelegt, sichtbar lenkt das Rad trotzdem). Das Geländer passt
nicht an die Deckkante — zwischen Haube und Kante bleiben 20 cm, darauf geht
niemand; es steht jetzt auf der Schulter der gestuften Haube, und erst dadurch
bekommt die Stufe einen Sinn. Spur ist 2,50 m, nicht 3,00 wie im Konzept
genannt. Und die Schätzung der Dreiecke war zu großzügig: +4.700 statt +18.600.

**Unangetastet:** Reichweite (`BOOM_LEN` 5,20 / `STICK_LEN` 4,00), `BOOM_PIVOT`,
Grabtiefe, **alle Kollider** — `test/fahrwerk.test.ts` misst den
Unterwagen-Kollider direkt in der Rapier-Welt nach. Spinne, Greifen, Pendel,
Kameramodi, `gripSystem.ts`, `clawGeometry.ts`, `collision.ts`, `orbitCamera.ts`.
Die Räder bleiben in Form, Größe und Material genau so, wie Patrick sie am
14.09. abgenommen hat.

**Offen.** Der **Kabinenhub** ist das achte Paket und kommt allein (E-040) — er
ist die einzige Änderung, die den Augpunkt der Kabinenkamera berührt. Und der
**Pratzenausleger läuft durch das Vorderrad**: Er liegt bei z ±1,35, das Rad
füllt dort y 0,02…1,22, der Ausleger y 0,50…0,90. Das ist seit dem 12.09. so und
fällt erst jetzt auf, weil das Rad frei steht.

**Auf dem Gerät zu prüfen.**

1. Hauptarm langsam heben und senken: Bleibt das Rohr gleich lang und nur die
   Stange wächst heraus?
2. Oberwagen herumdrehen: Wandert das Zahnmuster des Drehkranzes, während die
   Räder stehen?
3. Geradeaus fahren, dann voll einlenken: Drehen sich alle vier Räder, schlagen
   die vorderen ein, stehen sie frei unter der Maschine?
4. In die Kabine wechseln: Sitzt alles noch da, wo es war?

---

### E-037 — Aus dem Kehrbesen wird ein getretener Ballen (15.09.2026)

**Entscheidung.** Der Trichter von E-031 wird durch einen **Ballen** ersetzt:
unten am breitesten und platt (die Schleppkante, Superellipse mit Exponent 4 —
lange gerade Flanken), nach oben in eine gedrückte, beulige Kuppe auslaufend
(Exponent 2,2), mit drei Dellen dort, wo die Schalen aufgesessen haben.
**2,40 × 1,10 × 1,30 m, 680 kg, 1,98 m³**, eine konvexe Hülle statt zweier. Er
wird nicht mehr auf die Flanke gekippt, weil seine Bauform schon die Liegelage
ist. Neuer Platz: **(3,5 | −16,0)**.

**Begründung.** Patrick am Gerät: „Der ist viel zu klein. Er soll fast so breit
sein wie eine Pritsche und viel voluminöser. Die Proportionen passen auch nicht
— das Breite ist eigentlich das am meisten Volumen einnehmende. Stell dir vor,
da werden sehr viele Maschendrähte zusammengepresst, und oben ist das durch das
Greifergewicht wie eine Kugel geformt, aber auch nicht so sauber. Vor allem wird
der Maschendraht immer wieder zwischen Spinne, Birne und Boden gedrückt, und so
würde es die Form annehmen. Also ein bisschen wie ein Tee-Ei."

**Jede Zahl aus dieser Geschichte gerechnet, nicht gewählt:** Die Breite aus der
Ladefläche (2 × `BED_HALF_W` = 2,70 m, minus 0,15 m Luft je Seite). Die Tiefe aus
`clawWidth(CLAW_CLOSED_SPLAY)` = 1,297 m — **der Spur, die die geschlossene
Spinne hinterlässt**. Die Masse aus acht Rollen Maschendraht (250 m² × 2,72
kg/m²). Die Höhe aus dem Rauminhalt, den diese Drahtmenge braucht.

Alt zu neu: **doppelte Breite, 3,4-fache Tiefe, 9,7-facher Rauminhalt,
13-fache Masse.**

**Die Spinne umfasst ihn nicht — sie drückt ihn.** Offen spannt sie 3,38 m gegen
2,40 m Breite, kommt also von oben über ihn. Im Greiffenster ist der Korb nur
noch 1,46 m weit. Gemessen in der echten Rapier-Welt: **gefasst bei Schließgrad
0,60 mit fünf Schalen, 2,96 m angehoben.** Genau das Bild, aus dem die Form
kommt.

**Er kehrt besser**: in keiner Zelle der Tabelle schlechter als der Trichter, in
fünf deutlich besser. Auf der Ladefläche fallen **vier von sechs Teilen in der
ersten Bahn** herunter; der Trichter brauchte drei Bahnen für fünf.

**Zwei Befunde nebenbei.** Der alte Fleck (5,0 | −27,0) war seit E-029 keiner
mehr: Der Selbstabkipper kippt seitdem auf (6,3 | −26,0) ab — **1,64 m
daneben**, und der Wächter vom Vormittag hat die Abkippstelle nicht geprüft. Und
bei 680 kg wird der Ballen erstmals zum **Hindernis** für Fahrer
(`BLOCKING_MASS_KG` 120 kg); er muss deshalb in einer Arbeitszone liegen.

**Verworfene Alternativen.** Breite 2,70 m wie die Ladefläche — dann passt er
nicht mehr hinein und kann sie nicht kehren. Eckigere Ecken (Exponent 6) — räumt
die Bordwandecke auch nicht und sieht nicht mehr nach Draht aus. Zwei Hüllen
beibehalten — gemessen unnötig, ein Ballen hat keine Taille (Hülle steht 0,16 m
vom Draht ab, bei einer Sanduhrform wären es 0,49 m).

**Offen.** Ein Teil im 15-cm-Streifen zwischen Ballenflanke und Bordwand wird
nicht erwischt — die gerundeten Ecken schieben es dorthin. Der alte Besen konnte
es auch nicht; wer es lösen will, braucht ein Werkzeug mit eckiger Kante.

**Auf dem Gerät zu prüfen.**

1. Sieht er aus, als hätte jemand hundertmal draufgetreten — oder wie ein
   sauberer Ballen? Und ist er groß genug?
2. Greif ihn von oben auf der Kuppe und heb ihn an. Setz ihn ab: bleibt er
   liegen oder zittert er?
3. Zieh ihn quer über den Vorplatz und dann über eine Ladefläche. Passt er
   zwischen die Bordwände? (0,15 m Luft je Seite — knapp.)

---

### E-038 — `tsc` sieht ab jetzt auch `test/` und `tools/` an (15.09.2026)

**Entscheidung.** Drei Dinge, alle in `test/`, `tools/`, `docs/` und den
Konfigurationsdateien — **kein Produktivcode angefasst**:

1. **Neue Datei `v1/tsconfig.test.json`** prüft `test/` und `tools/`. Sie erbt
   `tsconfig.json` und ergänzt nur die Node-Typen (`"types": ["vite/client",
   "node"]`), die Tests und Werkzeuge für `node:fs` und `__dirname` brauchen.
   Neue Abhängigkeit: `@types/node` (devDependency).
2. **Sie läuft bei `npm test` mit**, über das npm-Skript `pretest`. Schlägt die
   Typprüfung fehl, startet Vitest gar nicht erst. Nachgewiesen: Der
   ursprüngliche Fehler `bayApproach(c.z)` wieder eingesetzt, `npm test`
   gestartet — der Lauf bricht vor dem ersten Test ab mit
   `test/fahrumriss.test.ts(147,61): error TS2345: Argument of type 'number' is
   not assignable to parameter of type 'ContainerConfig'.`
3. **Neue Helferdatei `test/zahl.ts`** mit zwei Funktionen: `endlich(...)`
   prüft, dass Eingaben endliche Zahlen sind; `mindestens(...)` prüft, dass ein
   Wächter überhaupt Fälle geprüft hat. Im Einsatz in `test/fahrumriss.test.ts`
   und `test/fahrstrecke.test.ts` — genau den beiden Dateien, in denen der
   Fehler saß.

**Begründung.** `tsconfig.json` sammelte nur `"include": ["src"]`, und Vitest
prüft keine Typen — es wirft sie mit esbuild weg. `test/` und `tools/` hat
deshalb **nie jemand** angesehen. Am 15.09.2026 hat das an einem einzigen Tag
dreimal zugeschlagen, jedes Mal nach demselben Muster: Ein Wächter war grün,
weil seine Eingaben `NaN` waren — und **jeder Vergleich mit `NaN` ist falsch**,
also meldet `expect(x).toBeLessThan(y)` nichts.

| # | Datei | Was | Folge |
|---|---|---|---|
| 1 | `test/fahrumriss.test.ts` | `bayApproach(c.z)` statt `bayApproach(c)` | Zwei Stunden lang „null Durchdringungen" — von null geprüften Strecken. Genau der Wächter, der LKW davon abhält, durch Mauern zu fahren. |
| 2 | `test/fahrstrecke.test.ts` | derselbe Aufruf ein zweites Mal | dieselbe stille Blindheit |
| 3 | `test/platzinventar.test.ts` | rechnete gegen `KIPP_SPUR_X`, am selben Abend gelöscht | dieselbe stille Blindheit |

Alle drei wären in einer Sekunde aufgefallen. Beim ersten Hinsehen fielen
**221 Fehler** heraus; 166 davon waren „Node-Typen nicht eingerichtet", also
kein Befund, sondern eine fehlende Zeile Konfiguration. Es blieben **55 echte
Fehler**, darunter **fünf Aufrufe mit zu wenigen Argumenten**, **neun Zugriffe
auf gelöschte Exporte** und **drei unvollständige Prüfdatensätze**. Vier
Werkzeuge ließen sich überhaupt nicht mehr starten.

**Warum getrennte Datei und nicht `"include": ["src","test","tools"]`.** Zwei
Gründe:

- **Der Bau bleibt schnell.** `npm run build` ist `tsc --noEmit && vite build`;
  Patrick wartet bei jedem Livegang darauf. Der Umfang von `tsconfig.json`
  ändert sich mit dieser Entscheidung **nicht**, also kann der Bau nicht
  langsamer geworden sein. Gemessen auf dem Dev-PC am 15.09.2026, ruhige
  Maschine: `tsc` über `src` 8,0 / 8,1 s, `vite build` 6,7 s, `npm run build`
  im Ganzen 16,3 / 18,9 s. Die neue Prüfung über `test`+`tools` kostet 13,2 s
  unter denselben Bedingungen und hängt an `npm test` (44,9 s), nicht am Bau.
  Der Gegenversuch — alles in **eine** Prüfung — wurde später am Tag gemessen,
  als fünf weitere Agentenprozesse liefen; die Zahlen schwanken deshalb stark
  und taugen nur als Richtung, aber die Richtung war in jeder der drei Runden
  dieselbe: `src` allein 29,4 / 58,5 / 38,6 s gegen `src+test+tools` 56,5 /
  62,9 / 54,3 s.
- **`src/` soll Node nicht kennen.** `src/` ist Browsercode. Stünden die
  Node-Typen in `tsconfig.json`, ginge ein versehentliches `process.env` in
  `src/` durch und fiele erst auf dem iPad auf. Getrennte Dateien halten diese
  Grenze.

**Warum `tools/` mitgeprüft wird, obwohl dort datierte Einmal-Werkzeuge
liegen.** Weil ein Werkzeug, das nicht mehr läuft, ein Befund ist und keine
Ausnahme rechtfertigt. Die Prüfung hat genau das gefunden: **vier Werkzeuge
brachen beim Start ab** — `tools/platzplan.ts` (in
`docs/messungen/2026-09-14_platzumbau.md` als laufendes Werkzeug geführt, das
`docs/platz.svg` erzeugt), `tools/grundriss-abend.ts`,
`tools/plan-2026-09-15.ts` und `tools/befunde-2026-09-14.ts`. Alle vier laufen
wieder; die drei erstgenannten sind nachgeführt auf E-028/E-029 (eigene
Kipperspur entfallen, `bayApproach` nimmt den Datensatz), das vierte auf E-028
(`HALLEN_X` ist heute EINE Zahl und `HALLEN_Z` DREI — vorher war es umgekehrt).

**Nebenbefund, der zum selben Muster gehört.** Zwei der vier Werkzeugabstürze
kamen nicht vom Typ, sondern vom Ausrufezeichen:
`CONFIGS.find((c) => c.id === "r_cable")!` sagt dem Prüfer „ist bestimmt da",
und genau dort war nichts. Ein `!` schaltet die Prüfung ab, die wir gerade
eingeschaltet haben.

**Verworfene Alternative.** (a) `"include": ["src","test","tools"]` in
`tsconfig.json` — der einfachste Weg, aber er verlängert jeden Bau und nimmt
`src/` die Trennung von Node. (b) Ein zweiter `tsc`-Schritt in `build` — gleiche
Verlangsamung, und Regel 9 (keine `&&`-Ketten in Skripten) wird dabei noch
länger gebrochen. (c) `tools/` per `exclude` aussparen — hätte genau die vier
kaputten Werkzeuge weiter verdeckt. (d) Die Typprüfung nur in den
Pages-Workflow hängen — der ruft für v1 nur `npm run build` und nie `npm test`;
sie liefe dann nie auf dem Rechner, auf dem jemand den Fehler auch beheben kann.

**Widerspruch zu älteren Einträgen, benannt und nicht aufgelöst.** Das Log ist
am 15.09.2026 mit unaufgelösten Konfliktmarken (``, `=======`,
`>>>>>>> worktree-agent-a7711447ab574db2a`) eingecheckt worden (Commit
`f20900b`). Beide Seiten sind erhalten, E-034 steht jetzt vor E-035 — aber:
**Die Nummern E-036 und E-037 fehlen im Log.** Commit `bbeeb44` nennt E-036 im
Betreff, ein Eintrag dazu steht nirgends. Das gehört gesichtet, bevor jemand
eine Nummer zweimal vergibt; hier wird es nur benannt.

**Abnahmekriterium.** `npm test` grün: **774 Tests in 69 Dateien**, unverändert
zum Stand davor (kein Wächter ist weggefallen). `npm run build` grün.
`npx tsc -p tsconfig.test.json --noEmit` meldet **0 Fehler** (vorher 221, ohne
die fehlenden Node-Typen 55). Die Wächter `collision`, `customers`, `haggle`,
`purity`, `save`, `shift`, `tutorial`, `upgradeEffects`, `upgrades` bleiben
grün. Die beiden neuen Helfer sind **scheitern gesehen worden**, nicht nur
eingebaut:

| Eingriff | Meldung |
|---|---|
| `bayApproach(c)` → `bayApproach(c.z)` | `npm test` bricht im `pretest` ab, `error TS2345` |
| Route zur Laufzeit mit `NaN` versehen | `Silo KUPFER-LAGER Anfahrt: keine endliche Zahl … Jeder Vergleich damit ist falsch, der Waechter prueft also nichts.` |
| Silo-Liste auf null Einträge gekürzt | `Fahrstrecken im Umrissbild: nur 14 Faelle geprueft, erwartet mindestens 20.` |
| Silo-Anfahrt auf einen Punkt gekürzt | `Anfahrt KUPFER-LAGER: Wegpunkte: nur 1 Faelle geprueft, erwartet mindestens 2.` |

Danach jeweils zurückgestellt und wieder grün.

**Auf dem Gerät zu prüfen.** Nichts am Spiel: Dieses Paket ändert keine Zeile,
die auf dem iPad läuft — `src/` ist unberührt. Zwei Dinge gehören trotzdem auf
den Schirm:

1. **`docs/platz.svg` auf dem iPhone** unter `/v1/plaene/` öffnen. Das Blatt ist
   zum ersten Mal seit E-034 wieder aus dem gebauten Platz erzeugt worden
   (vorher lief das Werkzeug nicht). Stimmt, was daraufsteht, mit dem überein,
   was du auf dem Hof siehst — vor allem die vier Ziele MISCHSCHROTT
   (7,91 m), STAHLSCHROTT (6,96 m), BUNT + VA (7,60 m) und MUELL (7,46 m),
   alle im Schwenkband 5,8–9,2 m?
2. **Die datierten Zeichnungen unter `docs/messungen/`** wurden **nicht** neu
   erzeugt, obwohl die Werkzeuge wieder laufen. Sie halten den Stand ihres
   Datums fest; neu gezeichnet wären sie eine Fälschung des Protokolls. Wer ein
   aktuelles Blatt braucht, erzeugt es unter neuem Datum.

---

### E-040 — Der Kabinenhub wird ein Schwenkwerk mit Mast hinter der Kabine (15.09.2026)

**Entscheidung.** Der Kabinenhub wird als **Mast hinter der Kabine** gebaut:
Drehpunkt (y 2,213 | z −0,894), 1,858 m über dem Deck, zwei Lenker von 1,88 m
auf einer gemeinsamen Welle, und **ein** echter Zylinder, der über einen
0,42-m-Hebel auf dieselbe Welle drückt. Die Motorhaube bekommt dafür eine nach
vorn offene Aussparung (7,4 % ihres Rauminhalts); Hydrauliktank und Ölkühler
rücken hinter den Mast. Damit ist das achte und letzte Paket von E-025 gebaut.

**Begründung.** Der bisherige Hub war **mechanisch unmöglich** (E-025, Befund 2):
Hubverhältnis 5,18 : 1, ein 1,10-m-Rohr in einem 0,65-m-Spalt, und zwei
„Parallelogramm-Lenker", die um Faktor 4,8 gedehnt wurden. Patrick hat die
Bauform am 15.09.2026 am Bild entschieden, gegen die Alternative „Lenker vor der
Kabine".

**Der Drehpunkt ist nicht gewählt, er folgt.** Aus Lenkerlänge 1,88 m, Hub
2,60 m, Vorlauf 0,34 und dem **unveränderten** Anlenkpunkt (y 0,50 | z −0,12)
ergeben sich genau zwei Lösungen; die hintere ist diese. Über den Hebel fällt
das Hubverhältnis von 5,18 : 1 auf **1,47 : 1** — dieselbe Größenordnung wie
beim Hubzylinder des Auslegers (1,49). Aus zwei unmöglichen Zylindern ist einer
geworden, der es kann.

**Die Bahn des Augpunkts.** Senkrecht ist sie in jeder Stellung identisch
(3,28 m + Hub). Waagerecht weicht sie ab — immer nach vorn, nie nach hinten:

| Hub | heute z | neu z | Δ |
|---|---|---|---|
| 0,00 | 0,200 | **0,200** | **0,000** |
| 0,60 | 0,404 | 0,941 | 0,537 |
| **1,20** | 0,608 | 1,235 | **0,627** ← größte |
| 1,80 | 0,812 | 1,304 | 0,492 |
| 2,60 | 1,084 | **1,084** | **0,000** |

**Unten und oben stimmt es auf unter einen Millimeter.** Dazwischen schiebt es
auf halbem Weg 0,63 m nach vorn — das ist die „0,60 m", die im Konzept stand,
und der einzige Punkt, an dem dieses Paket das Spielgefühl berührt.

**Null Durchdringungen des Kabineninnenraums**, über 861 abgetastete Stellungen
nachgewiesen. Zum Beleg, dass der Prüfer wirklich prüft, wurde die verworfene
Variante durchgerechnet: **186 von 861**. Die härtere Probe mit den echten
Eckpunkten aller bewegten Netze gegen Haube, Tank, Geländer und Auspuff findet
ebenfalls keine — engste Stelle **17 mm** zwischen Lenker und Kabinenbodenblech
in der untersten Stellung.

**Zwei Erwartungen trafen nicht ein, beide zugunsten der Sache.**

1. **Das Geländer braucht keine Umleitung.** Die Aussparung endet bei x −0,80,
   die Fußplatte des Geländerpfostens beginnt bei −1,03 — 23 cm Blech
   dazwischen. Der Mast kreuzt das Geländer nur oberhalb des Handlaufs (14 cm
   Luft). Die Zahl steht jetzt als Wächter im Test: Wer die Aussparung breiter
   schneidet, fällt auf.
2. **Die Aussparung ist keine Eckausnehmung geworden.** „Vordere linke Ecke"
   hätte 0,61 m³ gekostet (15,6 % statt 7,4 %), drei Lüftungslamellen in der
   Luft hängen lassen und **dem vorderen Geländerpfosten den Boden weggenommen**.
   Gebaut ist die kleinere Nische. Bei abgesenkter Kabine ist sie von außen
   vollständig verdeckt.

**Das Netzziel aus E-025 ist erreicht: 59 → 57.** Zeichenrufe 89 → 86. Die
Hubwerksrechnung kostet dabei **18 % weniger** als vorher (0,868 → 0,714 ms je
Bild), weil nichts mehr gedehnt wird.

**`test/zylinder.test.ts` führt den Kabinenhub nicht mehr als Ausnahme.** Er war
bis heute die einzige benannte Ausnahme von der Regel „kein `scale` auf Rohr oder
Stange". Die Ausnahme ist weg.

**Verworfene Alternativen.** Drehpunkt **vor** der Kabine (186 von 861
Durchdringungen, und der Zylinder lässt sich gar nicht erst bauen — die
Bauteilfunktion wirft „Rohr hat die Länge −0,054 m"). Aussparung als echte
Eckausnehmung. Zylinder direkt am Lenker statt am Hebel (über 2 : 1, wieder
nichts für einen einstufigen Zylinder). Zweites Lenkerpaar — siehe offen.

**Offen.**

1. **Ein Lenkerpaar, nicht zwei.** Das Konzept nannte zwei; gebaut ist eines —
   genau das, was auf dem Bild stand, das Patrick entschieden hat. Die Kabine
   bleibt waagerecht, weil der Quelltext sie waagerecht hält, nicht weil die
   Mechanik es erzwingt. Das war vorher genauso.
2. **Die äußere Mastsäule ragt 8,5 cm über die Deckkante.** Sie bleibt 20 cm
   innerhalb der Radaußenkanten und wird nie das breiteste Teil der Maschine.
   Ob sie stört, entscheidet das Bild.
3. **Nachbarbefund, nicht von diesem Paket:** Bei angehobener Kabine und
   aufgerichtetem Ausleger schneidet die Achse der **Hubzylinder des Auslegers**
   den Umriss der Kabine. Gemessen ist der Wert auf der alten geraden und auf
   der neuen Bogenbahn **exakt gleich** — dieses Paket macht es weder besser
   noch schlechter.

**Auf dem Gerät zu prüfen — ausdrücklich in der Kabine (Taste C).**

1. Kabine unten, durch die Fußscheibe auf den Greifer schauen: Sieht es aus wie
   gestern? Daran darf sich nichts geändert haben.
2. In der Kabine bleiben und hochfahren, geradeaus schauen. Auf halbem Weg
   schiebt es dich 0,63 m nach vorn und wieder zurück. **Nach Maschine oder nach
   Schaukel?** Hier gilt „so" oder „zurück".
3. Oben stehen bleiben und einen Träger sortieren: Steht das Bild da, wo du es
   kennst?
4. In der Außenansicht die Kabine hoch- und runterfahren: Stört der Pfosten an
   der Deckkante? Sieht man die Aussparung in der Haube, wenn die Kabine oben
   ist?

---

### E-039 — Die Mitteltraverse des Fünfschalengreifers wird Ø 0,95 (15.09.2026)

**Entscheidung.** Variante B des Blattes `docs/f5-traverse-2026-09-15.svg` ist
gebaut: `MASS.traverse` Ø 0,70 → **Ø 0,95**, `ZYLINDER_AUFNAHME`
(0,34 / −0,730) → (0,465 / −0,635), `OBERE_ANBINDUNG` (0 / 0,310) →
(−0,08 / 0,245), `TRAVERSE_Y` −0,96 → −0,865. Das Zylinderauge bekommt dabei
einen **Steg** zur Lagerhülse (`06_AUGENKONSOLE`). Patrick hat am Bild
entschieden.

**Begründung.** E-009 hatte zwei Kennwerte offen gelassen: Zylinderneigung
(38,9° gegen Ziel 20°) und Hebelarm (0,092 m gegen Ziel 0,10 m). **Der Hebelarm
ist die gefährlichere Zahl, weil seine schwächste Stelle die offene ist** — die,
in der man in den Haufen sticht.

| | vorher | gemessen |
|---|---|---|
| Zylinderneigung offen / geschlossen / größte | 23,6 / 34,9 / 38,9° | **15,4 / 20,7 / 24,4°** |
| Hebelarm zu / offen | 0,254 / 0,092 m | **0,201 / 0,118 m** |
| Schließkraft | — | **+28 %** |
| Mündung von oben zugebaut | 52 % | 60,8 % |

Die Traverse **allein** zu vergrößern hätte es schlechter gemacht — bei Ø 1,10
fällt der Hebelarm auf 0,005 m, ein Totpunkt. Erst Traverse **und** Schalenauge
zusammen lösen es.

**Die fünf Unveränderlichen, nachgemessen und jetzt als absolute Zahlen im
Wächter:** Grabtiefe **2,7511 m** · Bauhöhe 2,505 · Hüllkreis 3,232 ·
Spitzenabstand 142,3 mm · Sektor 26,34°. Vorher prüfte der Wächter nur „alle drei
Varianten gleich" und „zwischen 2,7 und 2,8" — das hätte 4 cm durchgelassen.

**Bricht der Steg E-013?** Das war die Frage, weil E-013 hart erkämpft ist: Der
Zinken ist **ein** Gussstück, offen entsteht eine flache Fläche, kein Stempel
guckt heraus. Gemessen (2-mm-Raster über die Silhouette, offene Schale):

| Ansicht | Silhouette | davon Steg |
|---|---|---|
| von der Seite | 3.898 cm² | **14,5 cm² = 0,37 %** |
| von außen-oben (die flache Fläche) | 5.010 cm² | **0,00 %** |
| von vorn | 3.052 cm² | **0,00 %** |

**Sichtbar bricht er E-013 nicht.** Die flache Fläche ist auf das Rasterfeld
genau unverändert. In der Seitenansicht füllt er eine kleine Kerbe zwischen Nabe
und Ferse — **ohne** ihn hängt das Auge an einem Hals und liest sich eher als
angesetztes Teil als mit ihm. Blatt: `docs/f5-augenkonsole.png`, links mit,
rechts ohne.

**Offengelegt:** Im Modellbaum ist es ein eigener Knoten. Wer die Bauteilliste
liest, sieht ein Teil mehr an der Schale, auch wenn man es im Bild nicht findet.

**Der Nettokorb verliert nichts.** Gleich gemessen: vorher 1.520 l, jetzt
1.523 l — **+3 l**. Der Steg nimmt 6 l, die Form gibt 9 zurück. Das war
Patricks ursprüngliche Klage am Fünfschalengreifer (Traverse und Stempel nehmen
dem Material den Platz); sie trifft hier nicht zu.

**Zwei Befunde kamen aus dem Scheitern, nicht aus dem Nachdenken.** Die erste
Fassung des Stegs war **ein Loch statt eines Klotzes**, weil die Bahn gegen die
Hausregel lief — die Messsonde meldete es sofort. Und der erste Wächter „lässt
beide Bohrungen frei" war grün, während der Steg beide Löcher zur Hälfte
verschloss: Er prüfte **Eckpunkte**, und der Querschnitt ist ein gefastes
Achteck, dessen Ecken neben den Bohrungen liegen. Er prüft jetzt Flächen.

**Verworfene Alternativen.** C (Ø 1,10) hält beide Ziele, aber nur mit 0,25°
Reserve, und der Kopf wird halb so breit wie der Korb. A\* (Ø 0,70 nachgestellt)
lässt den Kopf schlank, bleibt aber bei 32° — und braucht den Steg auch.

**Offen.** Traverse und Drehwerksgehäuse überdecken sich jetzt 0,19 m statt
0,10 m. Von außen sieht man nichts davon, aber ob der Flansch im Gehäuse sitzt
oder umgekehrt, ist gezeichnet und nicht konstruiert.

**Auf dem Gerät zu prüfen.**

1. Greifer in der Vorschau ganz zu und ganz auf fahren: Der Kopf ist jetzt 43 %
   der Korbweite statt 32 %. **Kräftig oder wuchtig?** Stehen die Zylinder
   sichtbar gerader?
2. Von schräg unten an einen Zinken heranfahren, dort wo der Zylinder ankommt:
   Liest sich das immer noch als **ein** Gussstück — Hülse, Auge, Bogen, Zahn?
3. `docs/f5-augenkonsole.png` daneben halten: Siehst du überhaupt einen
   Unterschied? Wenn ja, welche Seite ist besser?

---

### E-043 — Wie viele Schalen anliegen müssen, hängt an der Größe des Teils (15.09.2026)

**Entscheidung.** `gripSystem.tryGrab` verlangt nicht mehr fest **zwei**
anliegende Schalen, sondern `min(2, floor(Größe / 0,629 m))` — **je angefangener
Schalenlücke eine Schale**. Die Lücke ist aus `clawGeometry` gerechnet, die Größe
am Kollider abgetastet.

**Begründung.** Patrick, auch nach der ersten Reparatur (E-030): „Kleinteile sind
sehr schwer zu greifen." Zwei Schalen waren für alles unter 0,63 m
**unerfüllbar**: Im Greiffenster stehen benachbarte Schalen 0,63 bis 1,30 m
auseinander. Gemessen an 63 Griffen über drei Zufallssaaten meldet
`krallenKontakte` für Teile bis 0,40 m höchstens 0, 1 oder 2 — meist **0**. Die
Prüfung fiel praktisch immer auf die Ausnahme „Schwerpunkt mittig" zurück, einen
Punkttest gegen einen Kegel mit 0,14 m Radius am Boden. **61 Bilder**, in denen
ein Teil nachweislich im Korb lag und trotzdem abgelehnt wurde.

| Haufen-Treffer | vorher | nachher |
|---|---|---|
| gesamt | 53 von 63 | **59 von 63** |
| am Korbrand, kleine Teile | 6 von 12 | **11 von 12** |

**Im Klartext:** Von etwas, das zwischen zwei geschlossene Schalen passt, Kontakt
zu verlangen, ist eine Bedingung, die es nie erfüllen kann. Unter 0,63 m
entscheidet jetzt allein, ob es im Korb liegt. **Ab 1,26 m bleibt es bei zwei** —
und damit bleibt die Kiste draußen, die nur mit einer Ecke hineinragt.

**Ein Vorschlag aus dem Vorbericht wurde gemessen und verworfen:** „alle neun
Stationen abtasten statt zweier" ändert **nichts** (dieselben Zahlen; nur der
Betonblock steigt von 3 auf 5), auch nicht mit doppelter Toleranz. Der Grund ist
physikalisch: Das Greiffenster öffnet bei Schließgrad 0,60, da stehen die Schalen
noch 1,3 m auseinander — **sie liegen zum Zeitpunkt der Entscheidung schlicht
noch nicht an.**

**Die beiden alten Fehler sind nachweislich nicht zurückgekommen.** Am Griff-Kern
wurde nichts angefasst. Die Gegenprobe „Kiste mit nur einer Ecke im Korb" ist
**vorher wie nachher grün** — die Lockerung hat sie nicht durchlässig gemacht.
Ein gefasstes Teil wandert 0,016 m (Schwelle 0,05); kein Saugen in die Korbmitte.
Mit zurückgesetztem Stand sind 4 der 7 neuen Prüfungen rot.

**Offen, und vermutlich der Rest des Problems.** Im **dichten** Haufen verdrängen
schwere Nachbarn das Zielteil, weil `candidates.sort` das Schwerste zuerst nimmt
und `MAX_ITEMS` 5 ist. Gemessen bei 30 Nachbarn, Ziel genau unter der Achse und
in allen neun Bildern nachweislich im Korb:

| Ziel | gegriffen |
|---|---|
| Kleinteil 0,10 m, 8 kg | **0 von 5** |
| Messingarmatur 0,30 m, 15 kg | **0 von 5** |
| Motorblock 0,40 m, 110 kg | 4 von 5 |

Der Korb ist bei **jedem** Griff voll (5 von 5 in allen 63 Versuchen). Ein
8-kg-Teil hat dort keine Chance. **Das ist mit hoher Wahrscheinlichkeit der Rest
dessen, was Patrick erlebt** — und diese Entscheidung ist seine: Soll das
anvisierte Teil zuerst genommen werden statt des schwersten? Dann bekommt man,
worauf man zielt; dafür bekommt man beim blinden Hineinlangen nicht mehr sicher
das große Teil.

**Zweiter offener Punkt:** Die Spinne steigt beim Zupacken um **0,548 m**, weil
der Bodenanschlag mit der Momentanstellung rechnet — sie zieht sich in genau den
Bildern unter dem Teil weg, in denen sie greifen soll. Am Korbrand ist das die
Ursache der verbleibenden Fehlgriffe.

**Auf dem Gerät zu prüfen — im Haufen, nicht auf dem Beton.**

1. Spinne so absetzen, dass ein kleines Teil **am Rand** des Korbs liegt, dann
   zupacken. Kommt es mit? Genau dort blieb es vorher liegen.
2. Ein Kleinteil aus einer **dichten** Stelle greifen. Kommt es weiterhin nicht
   mit, obwohl es mitten unter der Spinne lag, ist es die Verdrängung — dann
   liegen zwei Wege bereit.
3. Gegenprobe: nur an die **Kante** einer großen Kiste fahren und zupacken. Sie
   darf **nicht** mitkommen.

### E-045 — Worauf du zielst, das bekommst du: die Auswahl geht nicht mehr nach Gewicht (15.09.2026)

**Entscheidung.** `candidates.sort((a, b) => b.mass() - a.mass())` fällt weg. Es
kommt **alles** mit, was die Greifbedingung erfüllt — was im Korb liegt, was von
den Schalen gefasst ist, was verkantet ist. `MAX_ITEMS` steigt von **5 auf 24**
und ist damit kein Auswahlmittel mehr, sondern ein Notnagel. Sortiert wird nur
noch danach, **wie sicher ein Teil gehalten wird** (Schwerpunkt im Korb schlägt
„nur gefasst", Feinunterschied: Abstand zur Sensormitte); das entscheidet nichts
darüber, *was* mitkommt, sondern nur, wen die Traglastgrenze abschneidet, wenn
sie greift. `MAX_TOTAL_KG` (3.500 kg) bleibt unangetastet — das ist
Tragfähigkeit, keine Auswahl.

**Begründung.** Ansage Patrick 15.09.2026: „Worauf du zielst, das bekommst du:
Alles mitnehmen, was in der Spinne liegt und wo der Greifer sich festkrallt oder
was verkantet ist. **Nicht nach Gewicht gehen.**" Der offene Punkt aus E-043 ist
damit entschieden, und die Messung dazu war eindeutig: Im dichten Nest erfüllten
**7 bis 12** Körper je Griff die Bedingung, fünf hatten Platz, die fünf
schwersten bekamen ihn.

| Zielteil, dichtes Nest (30 Nachbarn je 20–50 kg) | vorher | nachher |
|---|---|---|
| Kleinteil 0,10 m, 8 kg | 0 von 5 | **5 von 5** |
| Messingarmatur 0,30 m, 15 kg | 0 von 5 | **5 von 5** |
| Motorblock 0,40 m, 110 kg | 4 von 5 | **5 von 5** |
| Kleinteil im normalen Haufen, 0,40 m daneben | 2 von 5 | **5 von 5** |

**Der Kommentar „wer in einen Haufen greift, bekommt das große Teil sicher" ist
damit überholt** und steht nicht mehr im Code. Wer blind hineinlangt, bekommt
jetzt, was wirklich zwischen den Schalen liegt — auch das Kleine.

**Woher die 24 kommt.** Gemessen, nicht gegriffen: Im **echten** Starthaufen
(`spawnPile`, 150 gewürfelte Teile mit den Formen des Objektkatalogs, drei
Saaten) erfüllen je Griff nur **2 bis 4** Körper die Bedingung — es kommen 2 bis
4 Teile mit, 160 bis 250 kg. Echter Schrott ist größer als ein 25-cm-Würfel, es
passt schlicht weniger in den Korb. Nur im künstlich dichten Nest aus lauter
Kleinteilen waren es bis zu 12. 24 ist das Doppelte des je Gemessenen: hoch
genug, dass der Deckel nie auswählt, niedrig genug, dass ein künftiger Fehler
nicht unbemerkt den halben Platz anhängt.

**Verworfene Alternative.** Den Deckel ganz streichen (dann gäbe es gegen einen
Fehler in der Sensorkugel keine Bremse mehr); den Deckel bei 5 lassen und nur
das anvisierte Teil vorziehen (wäre wieder eine Auswahl, nur eine andere — und
Patricks Ansage sagt ausdrücklich „alles mitnehmen").

**Abnahmekriterium.** `npm test` grün: **74 Dateien, 840 Tests**, darunter drei
neue Wächter in `test/greifhaufen.test.ts` („nimmt das leichte Teil mit",
„der Deckel wählt nicht mehr aus", „die Physik bleibt ruhig") und einer am
echten Starthaufen („es kommt kein halber Haufen mit": höchstens 8 Teile je
Griff, gemessen 2 bis 4). Mit zurückgesetzter Auswahl sind alle drei rot.
Gemessen bleibt der schnellste lose Körper bei 6–7,5 m/s (Spieldeckel 28),
keiner sackt durch den Beton, ein gefasstes Teil wandert höchstens 0,030 m
(Saug-Schwelle 0,05).

**Auf dem Gerät zu prüfen.**

1. In eine **dichte** Stelle greifen, in der ein kleines Teil zwischen großen
   liegt: Kommt das Kleine jetzt mit?
2. Wie voll fühlt sich ein Griff an? Es hängt **mehr** in der Spinne als vorher
   — ist das die Handvoll, die man erwartet, oder zu viel?
3. Gegenprobe: nur an die **Kante** einer großen Kiste fahren. Sie darf weiter
   **nicht** mitkommen.

### E-046 — Der Bodenanschlag rechnet über den ganzen Schließweg (15.09.2026)

**Entscheidung.** `resolveGroundClamp` nimmt nicht mehr die Spitzentiefe der
**Momentanstellung** (`clawTipDepth(currentSplay())`), sondern die größte Tiefe
über den **ganzen** Schließweg (`CLAW_MAX_DEPTH`). Eine Zeile zum Zurückdrehen:
`BODEN_UEBER_SCHLIESSWEG` in `excavator.ts`.

**Begründung.** Die geschlossene Kralle reicht 2,95 m tief, die offene nur
2,44 m. Wer gegen die Momentanstellung rechnet, setzt die offene Spinne so tief
ab, dass sie beim Zudrücken in den Beton geriete — also **hob der Anschlag den
Arm während des Schließens nach**. Gemessen am kopflosen Bagger:

| beim Zupacken | vorher | nachher |
|---|---|---|
| Spinne steigt | **0,548 m** | **0,000 m** |
| Spinne wandert zur Seite | **0,513 m** | **0,000 m** |
| Höhe der Spinnenmitte beim Absetzen | 2,461 m | 3,012 m |
| Spitzen der **offenen** Spinne über dem Beton | 0,018 m | **0,570 m** |
| tiefster Punkt einer Spitze **während** des Griffs | 0,008 m | 0,013 m |

Der Arm zog sich in genau den Bildern unter dem Teil weg, in denen er zufassen
soll. Jetzt steht er still.

**Der Preis, und er ist sichtbar.** Die **offene** Spinne hängt beim „Aufsetzen"
gut einen halben Meter über dem Beton — genau den Unterschied zwischen offener
und tiefster Stellung (0,557 m, gerechnet). Beim Schließen fahren die Schalen
weiter bis 1,3 cm an den Beton heran, vom Boden aufgenommen wird also
unverändert alles (`test/greiffenster.test.ts`, sieben Größen von 0,10 m bis
1,10 m, grün). Aber wer die offene Spinne absetzt, sieht eine Lücke, wo vorher
die Zähne auflagen. Das ist Patricks Urteil am Gerät; deshalb die eine Zeile.

**Was die Änderung ausdrücklich NICHT bringt.** Die Vermutung aus dem
E-043-Bericht — das Anheben sei die Ursache der verbleibenden Fehlgriffe am
Korbrand — ist **gemessen und widerlegt**: über vier Größen und sechs
Zufallssaaten am Korbrand (0,80 m neben der Achse) **22 von 24 vorher, 21 von 24
nachher**, also gleich innerhalb der Streuung. Die letzten Fehlgriffe kommen
nicht vom steigenden Arm, sondern davon, dass die schließende Schale ein
leichtes Teil am Rand auch mal aus dem Korb schiebt, bevor sie es fasst. Wer
daran etwas ändern will, muss an der Schale ansetzen, nicht am Anschlag — und
das wäre ein eigener Schritt.

**Verworfene Alternative.** Den vollen Anschlag nur während des Schließens
gelten lassen (dann steht die offene Spinne wieder am Boden — aber der Arm
springt im Moment des Zupackens um dieselben 0,55 m, also genau der Fehler);
`surfaceUnderClaws` ebenfalls auf die tiefste Stellung umstellen (unnötig, der
Messkreis unter den Krallen hat mit der Tiefe nichts zu tun).

**Abnahmekriterium.** `npm test` grün: **75 Dateien, 843 Tests**, darunter
`test/bodenanschlag.test.ts` mit drei Prüfungen (Hub < 0,05 m; die Spitzen
kommen beim Schließen trotzdem bis 5 cm an den Beton; der halbe Meter
Absetzhöhe steht als Zahl im Wächter). Mit `BODEN_UEBER_SCHLIESSWEG = false`
sind zwei davon rot, mit den gemessenen Zahlen 0,548 m und 0,018 m.

**Auf dem Gerät zu prüfen.**

1. Arm absetzen und zupacken: Bleibt die Spinne jetzt **stehen**, statt beim
   Zudrücken hochzugehen? Das ist die eigentliche Frage.
2. Offene Spinne auf den Beton absetzen und hinsehen: Der halbe Meter Luft
   unter den Zähnen — stört er, oder fällt er nicht auf?
3. Ein flaches Teil (Blech) vom Beton aufnehmen: Kommt es weiter mit?

---

### E-042 — Stahlschrott ist, was massiv ist: 6 mm rechnerische Wandstärke (15.09.2026)

**Entscheidung.** Die Fraktion eines Teils hängt nicht mehr allein an seiner
Stückliste, sondern an Masse und Maß: `Wandstärke = Masse ÷ (7850 kg/m³ ×
Außenfläche)`. **Ab 6 mm ist es Stahlschrott, darunter Mischschrott**, dazu
höchstens 10 % Fremdstoff. Acht Einträge sind mit `massiv: true`
übersteuert — jeder mit Begründung in derselben Zeile. Es bleibt bei **zwei**
Fraktionen; eine dritte („Blechschrott") hat Patrick abgelehnt.

**Begründung.** Patrick: „Ich möchte ein bisschen strenger werden, was
Stahlschrott ist. Das ist halt so das Premium. Es geht da eher so um
Bahnschwellen, Bremsscheiben, Träger. … Ein Elektroherd, das ist vor allem
Blechschrott. Das ist nicht massiv."

Der messbare Kern des alten Fehlers (`docs/fraktionen.md`): Von 317
Katalogeinträgen haben **250 keine Stückliste** und galten deshalb ungeprüft als
sortenrein — nicht weil sie es sind, sondern weil niemand sie eingetragen hat.
Ein *Elektroherd* war damit Stahlschrott und ein *Einbauherd mit Umluftofen*
(78 % Stahl) Mischschrott: derselbe Küchenherd, dieselbe Bauart, dieselbe Farbe.
Die neue Regel braucht keine neue Eingabe, weil Masse und Maß an jedem Eintrag
stehen — und sie trifft die Wirklichkeit: Elektroherd **1,3 mm** (Herdblech ist
1 mm), Doppel-T-Träger **6,7 mm** (der Steg eines IPE 280 ist 6,5 mm). Die 6 mm
sind die Grenze der europäischen Sortenliste zwischen E1/E3 und Blechschrott —
Branchenwissen, im Projekt sonst unbelegt, im Code mit diesem Vorbehalt.

| | Einträge | Stahlschrott vorher | jetzt |
|---|---:|---:|---:|
| ganzer Katalog | 317 | 165 | **73** |
| Masse | | 85,5 t | **54,5 t** |

Alle **92 Wechsel** gehen Richtung Mischschrott. Die Gitterbox, nach der Patrick
ausdrücklich gefragt hatte: **3,0 mm — Mischschrott**, halbe Schwelle.

**Verworfene Alternativen.**

1. **Dritte Fraktion „Blechschrott"** — von Patrick abgelehnt.
2. **Schüttdichte (kg je m³ Hüllraum, E-033)** — bestraft große Stücke doppelt:
   Der Hohlraum wächst mit der dritten Potenz, das Blech nur mit der zweiten.
   Ein Eisenbahn-Radsatz läge bei 516 kg/m³ neben einem Kühlschrank bei 90.
3. **Massenschwelle als zweites Merkmal** („Übersee-Container haben viel Masse,
   auch wenn es dünnes Blech ist") — **geprüft und verworfen.** Der Seecontainer
   ist mit 2200 kg das schwerste dünnwandige Stück ohne Verbund im ganzen
   Katalog; der nächste ist eine Rundballenpresse mit 1900 kg. Jede Schwelle
   dazwischen nimmt genau ein Stück mit — das, für das sie gemacht wurde. Wer
   tiefer geht, um den *Lagertank* (1400 kg, nackter Stahlbehälter) zu fassen,
   lässt vorher zwei falsche herein. Dazu: Masse ist nicht maßstabsfrei — ein
   40-Fuß-Container wäre Premium, ein 10-Fuß-Container nicht, derselbe
   Gegenstand in zwei Mulden. **Also Übersteuerung statt Regel**, offen gezählt
   und begründet; ein Wächter meldet, wenn je ein schwereres dünnwandiges Stück
   dazukommt.
4. **Handliste „Bauarten, die nie Premium sind"** — gebaut und verworfen, weil
   überflüssig: Waschmaschine 2,2 mm, Karosserie 3,6 mm, Kühlschrank 1,5 mm
   fallen schon an der Wandstärke durch.
5. **`bau` als Verbundkennzeichen** — geht nicht, `bau` ist eine Zeichenform:
   `bau: "motor"` trägt der Motorblock genauso wie das Traktor-Frontgewicht,
   ein Gussklotz ohne bewegliches Teil.

**Neun neue Stücke.** Von Patricks drei Beispielen war nur *Träger* im Katalog;
Bremsscheiben fehlten ganz, Bahnschwellen gab es nur aus Beton und Holz. Dazu
wären im Stahltopf der Kleinteile nur 19 Sorten geblieben. Neu: Bremsscheibe
(LKW), Bremsscheiben (Palette), Bahnschwelle (Stahl, Y-Form), Schienenabschnitt,
Kurbelwelle (LKW), Großzahnrad, Amboss, Stapler-Gegengewicht,
Grobblech-Zuschnitt (20 mm). Alle Massen gerechnet, nicht geschätzt. Der
Grobblech-Zuschnitt ist mit Absicht dabei: gleiche Bauform wie das *Blech*
(4,8 mm, Mischschrott), dreimal die Masse, andere Mulde — daran kann man die
Regel sehen, ohne dass sie jemand erklärt.

**Aluminium ist grau geworden.** Patrick am selben Tag: „Aluminium ist in den
meisten Fällen grau." Zuerst die Gegenfrage, ob er die Fraktionsfarbe überhaupt
sieht: Von 30 Alu-Einträgen tragen **drei** sie; die anderen 27 werden in
`objektbau.ts` gefärbt, die flächigsten davon mit `ALU = 0xa8adb2`. **Beide**
Stellen stehen jetzt auf `0x928d85`, mattes warmes Mittelgrau.

| Paar | vorher | jetzt | warum es zählt |
|---|---:|---:|---|
| alu ↔ **va** | **6,98** | **24,63** | verschiedene Silos (ALU-/VA-LAGER) |
| alu ↔ zinc | 10,23 | 12,25 | teilen sich jeden Behälter, egal |
| alu ↔ mixed | 37,90 | 20,25 | bleibt klar getrennt |

Die 6,98 waren der Fehler: Unter ΔE 10 ist es dieselbe Farbe, bei Abendsonne
lagen Alu und Edelstahl bei 6,54. `CHROM` bleibt hell — Verchromtes ist hell.

**Zwei Lehren, die teuer hätten werden können.**

* **Runde Teile nicht dünner als 0,12 m.** Bremsscheibe und Großzahnrad standen
  zuerst mit ihrem echten Reibring- und Zahnbreitenmaß da (0,045 und 0,09 m).
  Der Katapult-Wächter des Kippers sprang sofort auf **146 km/h** (Schranke
  140): So dünne Achtkant-Kollider verhaken sich in der Ladung und werden
  herausgeschossen. Mit Hüllmaß 0,12 m — Topf und Nabe mitgerechnet, und gleich
  `DUENN_M` — war der Wert wieder in der Schranke.
* **`THREE.Color.set(hex)` rechnet seit three r152 nach Linear-sRGB um.** Die
  erste Farbmessung gab für jedes gebaute Teil fast Schwarz (`#1d1510` statt
  `#a8adb2`), weil die Vertexfarbe ohne Rückrechnung als Byte gelesen wurde.
  Steht als Warnung in `tools/alufarbe.ts`.

**Was es kostet.** Zwischen **−0 % und +2 %** je Anlieferung. `randomCargo`
würfelt zuerst die Fraktion (42 % Stahl, 22 % Misch, 16 % Alu) und sucht dann
ein Stück — die Umsortierung ändert nicht, wie oft Stahl kommt, nur welche
Stücke im Topf liegen. **Wer die Mischtabelle anfasst, muss neu rechnen:** Käme
die Verteilung aus dem Katalog, fiele der Stahlanteil von 74 % auf 33 % der
Sorten. Der Zulauf der **Stahlhalde** steigt (2,22 : 1 → **2,42 : 1**), weil die
verbliebenen Stücke schwerer sind — wenn eine Halde zu klein wird, ist es die
Stahlhalde. Je Fuhre liegen **8 statt 9** Stücke auf dem Kipper, weil die
Ladefläche volumenbegrenzt ist und die Brocken größer sind.

**Drei Wächter sind dabei absichtlich rot geworden** und wurden umgeschrieben:
„derselbe Küchenherd, zwei Fraktionen" (jetzt: eine), „271 Einträge" (jetzt 280
in den exportierten Listen), „16 von 271 tragen die Fraktionsfarbe" (jetzt 18).

**Abnahmekriterium.** 73 von 317 Katalogstücken sind Stahlschrott. Gitterbox,
Elektroherd, Blech, Badewanne sind Mischschrott; Doppel-T-Träger,
Schienenbündel, Bremsscheibe, Bahnschwelle, LKW-Felge und Seecontainer sind
Stahlschrott. Der Verdienst je Anlieferung ändert sich um höchstens 5 %.

**Offen.** (1) Fünf Maschinen ohne Stückliste rutschen als Premium durch
(Spritzguss-, CNC-, Drehmaschine, Förderband-Antriebsstation,
Schul-Heizkesselanlage) — bewusst nicht mitgemacht, weil es fünf weitere Stücke
ohne Auftrag umsortiert hätte. (2) Seecontainer (Stahl) und
Baustellencontainer (Misch) haben denselben Maß-Hash und damit **ΔE 0,00** —
der kleinste Weg wäre, den Baustellencontainer auf 3 m zu kürzen. (3) Die
Wandstärke gehört ins Griff-Info-HUD, damit man die Regel am Teil ablesen kann.

**Auf dem Gerät zu prüfen.**

1. `/v1/plaene/` → `stahlschrott-2026-09-15.svg`: Stimmt die Grenze? Besonders
   die **Frontlader-Schaufel** (3,6 mm, von Hand auf massiv) — die ist am
   weitesten von der Schwelle entfernt.
2. Eine **Felge** und ein **Alu-Profil** in die Hand nehmen und neben ein
   VA-Teil legen: Ist Aluminium jetzt erkennbar stumpfer als Edelstahl?
3. Eine **Gitterbox** und einen **Doppel-T-Träger** greifen: Ist ohne Zahl zu
   ahnen, dass sie in verschiedene Mulden gehören? Davon hängt ab, ob die
   HUD-Zeile gebaut wird.

### E-052 — Kein Stückzahl-Deckel mehr; ein Wächter statt einer stillen Grenze (15.09.2026)

**Entscheidung.** `MAX_ITEMS` fällt ersatzlos. Was gehalten wird, kommt mit —
ohne Obergrenze. Einzige Grenze bleibt die Traglast `MAX_TOTAL_KG` (3.500 kg);
die ist Tragfähigkeit, keine Auswahl. An die Stelle des Deckels tritt ein
**Wächter**, der misst, wie viele Körper im echten Starthaufen gleichzeitig die
Greifbedingung erfüllen.

**Begründung.** Ansage Patrick 15.09.2026 auf die Frage, ob 11 bis 14 hängende
Teile im dichten Nest zu viel sind: **„Deckel ganz weg."** Mit E-045 war der
Deckel schon kein Auswahlmittel mehr, sondern ein Notnagel von 24 gegen einen
künftigen Fehler in der Greifbedingung. Der Einwand war richtig, die Antwort
falsch: **Ein Deckel verdeckt so einen Fehler, statt ihn zu zeigen** — die
Maschine greift dann 24 Teile statt 200, und niemand merkt, dass die Bedingung
kaputt ist. Ein Test, der rot wird, ist mehr wert als eine Grenze, die stumm
abschneidet.

**Der Wächter, der den Deckel ersetzt.** `test/greifhaufen.test.ts`, „ein Griff
in den gewürfelten Starthaufen nimmt eine Handvoll": echter Starthaufen
(`spawnPile`, 150 Teile mit den Formen des Objektkatalogs), drei Saaten.
Gemessen **2 bis 4 Kandidaten je Griff, 2 bis 4 Teile im Korb, 160 bis 250 kg**,
aus 105 bis 123 Teilen. Die Schwellen liegen beim Doppelten (8 Stück, 600 kg).
Gegenprobe gesehen: Mit absichtlich ausgehängter Greifbedingung meldet er
**„22 Körper erfüllten gleichzeitig die Greifbedingung — gemessen sind 2 bis 4.
Das riecht nach einem Fehler in der Bedingung, nicht nach einem fehlenden
Deckel."**

**Der ungedeckelte Extremfall, gemessen** (dichtestes Nest, das sich bauen
lässt — im Spiel kommt es so nicht vor):

| Nest | Kandidaten | im Korb | Masse | Physik je Schritt | schnellster loser Körper | unter dem Beton |
|---|---|---|---|---|---|---|
| 40 Teile à 0,15–0,30 m | 29–33 | **31–35** | 438–579 kg | 2,8–4,4 ms | 8,4 m/s | 0 |
| 60 Teile à 0,12–0,22 m | 33–39 | **34–40** | 248–323 kg | 2,8–3,9 ms | 10,7 m/s | 0 |
| 20 Brocken à 200–400 kg | 14–17 | 11 | **3.371–3.395 kg** | 1,7–3,0 ms | 7,9 m/s | 0 |

Zum Vergleich: Der echte Starthaufen kostet beim Setzen 5,7 bis 14,8 ms je
Schritt — vierzig hängende Teile sind billiger als ein Haufen, der sich legt.
**Zeichenrufe ändern sich nicht:** Greifen erzeugt keine Netze, es bewegt nur
vorhandene. Nichts kippt, also bleibt es beim Deckel-weg.

**Die Traglast ist jetzt der einzige Abschneider — und sie schneidet das
Lockerste ab.** Die dritte Zeile oben zeigt sie bei der Arbeit: 17 Körper
erfüllen die Bedingung, 11 passen an den Haken, bei 3.395 von 3.500 kg ist
Schluss. Welche das sind, entscheidet die Sortierung nach Haltwert aus E-045.
Eigener Wächter mit zwei gleich schweren 2.000-kg-Brocken (zusammen 4.000 kg,
einer bleibt liegen): Mitkommen muss der, der **tiefer im Korb** liegt. Mit
verdrehter Sortierung ist er rot.

**Verworfene Alternative.** Deckel bei 24 lassen (verdeckt Fehler, siehe oben);
einen Deckel aus der Traglast ableiten (dieselbe stille Grenze, nur mit mehr
Rechnerei).

**Abnahmekriterium.** `npm test` grün, zwei neue Wächter darunter, beide einmal
rot gesehen. Die beiden alten Fehler bleiben ausgeschlossen: kein Saugen
(gefasste Teile wandern ≤ 0,030 m, Schwelle 0,05) und die Kiste mit nur einer
Ecke im Korb bleibt liegen — auf dem Beton wie im Haufen.

**Auf dem Gerät zu prüfen.**

1. In eine **dichte** Stelle greifen: Wie viel hängt jetzt in der Spinne, und
   fühlt sich das nach einem Biss an — oder nach Klettverschluss?
2. Eine **schwere** Ladung greifen (Traktor-Frontgewicht, LKW-Achse, mehrere
   Brocken): Merkt man die Traglastgrenze, wenn sie greift, oder wirkt es, als
   ginge einfach etwas nicht?
3. Gegenprobe wie immer: nur an die **Kante** einer großen Kiste fahren — sie
   darf nicht mitkommen.

---

### E-050 — Der Auslegerbock: der Arm hängt jetzt sichtbar am Oberwagen (15.09.2026)

**Entscheidung.** Auf der Deckplatte steht ein Auslegerbock: zwei Lagerwangen
aus 60-mm-Blech, dazwischen der Auslegerfuß, ein durchgehender Bolzen r 0,10 mit
Sicherungsblech, zwei Schrauben und Schmiernippel, dazu zwei Querbleche und zwei
Fußflansche. 17 Bauteile im Stahl-Netz des Oberwagens.

**Begründung.** Patrick am Gerät: „Keine Verbindung des Arms am Turm."

**Nachgemessen war es kein Eindruck, sondern ein Loch.** Der Auslegerfuß endete
auf y 2,641, die Deckplatte begann auf y 1,955 — **0,686 m nichts**, über die
ganze Breite und über den ganzen Schwenkbereich. Neun senkrechte Strahlen trafen
alle als erstes die Deckplatte. Der Arm hing 69 cm über dem Aufbau, gehalten von
nichts.

Die **Lagerböcke der Hubzylinder** gab es dagegen schon und sie sitzen richtig —
ihre Konsolenbleche reichen 6 cm in die Deckplatte hinein, also verschweißt statt
danebengestellt. Unangetastet.

**Der Drehpunkt ist nicht gewandert.** `BOOM_PIVOT`, `BOOM_LEN` 5,20 und
`STICK_LEN` 4,00 sind unverändert; der ganze Platz bleibt um das Schwenkband
5,80–9,20 m gebaut. Die Achse des Bocks wird **aus `BOOM_PIVOT` abgeleitet**,
damit es keine zweite Zahl gibt.

**Gemessen, nicht geschätzt.** 594 Armstellungen (66 Ausleger- × 9 Stielwinkel),
der Bock exakt gerechnet, der Arm im 3-cm-Raster abgetastet — 432.824 Punkte.
Kleinster Freigang **0,027 m** (Rohr des Hubzylinders am Fußflansch bei 70°), zur
Kabine 0,047 m, zum Auslegerfuß 0,030 m. Keine Berührung.

**Zwei Entwürfe sind an dieser Messung gescheitert, nicht am Nachdenken:** ein
1,20 m langer Fußflansch stand bei 47° und 70° **9 mm im Rohr des
Hubzylinders**; und ein Hals so breit wie das Lagerauge ergab im Riss eine glatte
Kuppe, an der die Lagerstelle nicht mehr zu finden war.

**Kosten: null.** Der Bock bewegt sich nicht gegen den Oberwagen und liegt
deshalb in dessen Stahl-Netz. **57 Netze vorher, 57 nachher**, +448 Dreiecke.
Kollider, Reichweite, Gelenkpunkte, Grabtiefe unverändert.

**Abnahmekriterium.** Aus der Außenansicht ist von der Deckplatte bis zum
Auslegerfuß auf jeder Höhe Material zu sehen. Die Gegenprobe steht **dauerhaft**
im Wächter: Ein Oberwagen wird ausdrücklich ohne Bock gebaut, und derselbe Strahl
muss dort ins Leere gehen.

**Auf dem Gerät zu prüfen.**

1. Um die Maschine herumdrehen, bis der Ausleger quer steht: Sitzt der Arm
   sichtbar in zwei Wangen — erkennt man die Lagerstelle als runden Kopf mit
   Bolzen?
2. Ausleger langsam ganz ablegen und ganz aufrichten: Läuft der Fuß sauber
   zwischen den Wangen durch, besonders dort, wo die Hubzylinder vorbeigehen?
3. In der Kabine einmal voll durchschwenken: Verdeckt der Bock etwas, das man
   zum Sortieren braucht?

---

### E-055 — Der erste Tag beginnt ohne Schrott (15.09.2026)

**Entscheidung.** Beim Neuen Spiel liegt **kein loser Schrott** auf dem Platz:
kein Starthaufen, kein Streugut. `LEERER_START` in `src/world/startplatz.ts`
steht auf `true`, und daraus folgen beide Zahlen.

**Begründung.** Patrick, 15.09.2026: „Erster Tag ohne Schrott anfangen als Test."

Es ist ausdrücklich ein Versuch, und deshalb ist es **eine** Zahl. Wer den vollen
Start zurückwill, setzt `false` und bekommt Haufen (85 Teile) und Streugut (10)
in den Größen zurück, die begründet danebenstehen.

**Was das prüfbar macht:** Alles, was auf dem Platz liegt, ist dann angeliefert
worden. Man sieht dem Platz am Abend an, wie der Tag gelaufen ist — und man sieht
sofort, wenn der Nachschub klemmt. Das ist heute kein theoretischer Fall: Am
selben Tag hat sich gezeigt, dass beim Beladen bis zu 96 % einer Fuhre
verschwanden (E-044), und **auf einem vollen Platz fällt so etwas nicht auf.**

**Nicht betroffen: die beiden Altfahrzeuge** (`START_AUTOS`). Sie sind kein loser
Schrott, sondern das, woran Schere und Ausschlachten hängen — ohne sie wäre der
erste Tag nicht nur leer, sondern leer **und** ohne Beschäftigung, bis der erste
Händler kommt.

**Ein Nebeneffekt, der zu prüfen ist.** Der Starthaufen kam nur in einem von vier
Läufen ganz zur Ruhe (dokumentiert seit dem 14.09., ein eigener offener Punkt).
Ohne ihn beginnt der Platz zum ersten Mal **still**. Falls die Bilder je Sekunde
am Anfang spürbar besser sind, ist das ein Messwert für genau diesen offenen
Punkt — und kein Verdienst dieses Eintrags.

**Auf dem Gerät zu prüfen.**

1. Neues Spiel: Ist der Platz wirklich leer — und wirkt er dadurch groß und
   ordentlich, oder tot?
2. Den ersten Händler abwarten und ihn ganz ausräumen: Reicht **eine** Fuhre für
   ein Gefühl von Betrieb, oder fehlt zu lange etwas zu tun?
3. Am Abend hinsehen: Erkennt man dem Platz an, was an dem Tag passiert ist?

---

---

### E-047 — Die Pratzen gehen vor und hinter die Räder, nicht mehr hindurch (15.09.2026)

**Entscheidung.** Die vier Abstützpratzen wandern aus dem Rad heraus nach vorn
und hinten: Fußmitte **x ±1,90 / z ±2,45** statt x ±1,80 / z ±1,35. Der
Ausleger, der bisher als Querbalken aus der Rahmenmitte kam, wird zum **Knie**:
ein waagerechter Kragarm aus der Seitenwange (y 1,40) und ein senkrechter Stiel,
der davor auf den Fuß herunterläuft. Die Stützbasis wächst von 3,60 × 2,70 m auf
**3,80 × 4,90 m**.

**Warum.** Gemeldet in E-036 und bewusst liegengelassen: Der Pratzenausleger lag
bei z ±1,35 mitten im Vorderrad. Gemessen mit `tools/pratzenfreigang.ts` waren
es **25,2 cm** Durchdringung beim Balken und **22,2 cm** bei der Bodenplatte —
seit dem 12.09.2026, sichtbar aber erst, seit die Räder frei unter der Maschine
stehen. Patricks Richtung war „nach vorn und hinten, auf z ±2,30".

**Patricks Zahl ging nicht, und das ist gemessen, nicht geschätzt.** Bei
z ±2,30 steht die 0,62 m tiefe Bodenplatte immer noch **8,3 cm** im Reifen, und
zwar an der Flanke bei eingeschlagenem Vorderrad. Der Grund ist einfach: Die
Platte reicht 31 cm nach hinten, der Reifen über die Stollen 62 cm nach vorn.
Erst ab z 2,45 ist Luft.

| Fußlage | zum Rad | zur Schildwange |
|---|---|---|
| x 1,80 / z 1,35 (alt) | **−22,2 cm** | 23,4 cm |
| x 1,80 / z 2,30 (Ansage) | **−8,3 cm** | **kreuzt** |
| x 1,80 / z 2,40 | −0,5 cm | **kreuzt** |
| x 1,80 / z 2,50 | +8,6 cm | **kreuzt** |
| **x 1,90 / z 2,45 (gebaut)** | **+8,0 cm** | **+7,0 cm** |

**Der Fuß musste auch 10 cm nach aussen** — das war nicht vorgesehen und hat
einen Nachbarn zur Ursache, den der Auftrag nicht nennt: das **Räumschild**. Es
steht bei z 2,55, ist 2,90 m breit, und seine Seitenwange belegt x 1,38 … 1,52
ab z 2,52. Bei x ±1,80 beginnt die Bodenplatte bei x 1,49 — drei Zentimeter
davor. Bei x ±1,90 sind es 7 cm Luft.

**Und der Ausleger musste eine andere Form bekommen.** Vor dem Rahmen ist kein
Platz: Er endet bei z ±2,20, und den Raum davor füllen Streben und Zylinder des
Räumschilds — sie überstreichen bei x ±0,62 … ±0,78 alles zwischen y 0,42 und
1,33. Ein Querträger aus der Mitte führte mitten hindurch. Die erste Lösung, eine
durchgehende Schrägstrebe von der Wange zum Fuß, schnitt mit ihrer **unteren
Hinterkante** in die Kotflügelspitze — ein schräg gestelltes Kastenprofil greift
weiter um sich, als seine Mittellinie vermuten lässt. Im Knie ist beides gerade
und beides frei, und es ist zugleich die Form, die ein Umschlagbagger an dieser
Stelle wirklich hat.

**Gemessen wurde in JEDER bewegten Stellung**, nicht nur in der Ruhelage: 67
Lenkstellungen von Anschlag zu Anschlag (±33,3°) über den ganzen Ausfahrweg des
Fußes, 11 × 11 Stellungen von Räumschild und Pratze, und der Oberwagen als
überstrichener Drehkörper.

| Freigang | gemessen |
|---|---|
| Rad, jede Lenkstellung, ganzer Ausfahrweg | **8,0 cm** |
| Räumschild, ganzer Schildhub | **7,0 cm** |
| Kotflügelbogen | **5,6 cm** |
| Gegengewicht, Auspuff, Deckplatte beim Schwenken | **8,0 cm** |

**Verworfene Alternative.** „Nach innen zwischen die Räder" hat Patrick selbst
abgelehnt (Stützbasis wird schmal). Verworfen wurde ausserdem, bei x ±1,80 zu
bleiben und die Durchdringung mit der Schildwange hinzunehmen — genau das war der
Fehler, den dieses Paket behebt.

**Unangetastet.** **Alle Kollider**, besonders der Unterwagen-Quader 2,4 × 1,5 ×
4,4 — `test/fahrwerk.test.ts` misst ihn weiter direkt in der Rapier-Welt nach.
Reichweite, Gelenkpunkte, Grabtiefe. Räder in Form, Größe, Material. Form von
Pratzenfuß, Teller und Stempel (Patricks Ansage vom 12.09.). Spinne, Greifen,
Pendel, Kamera. **Netzzahl 57, unverändert** — die vier Ausleger sind acht Balken
geworden, aber sie liegen alle im selben Netz `01_UNTERWAGEN_STAHL` (+48
Dreiecke, kein Zeichenruf).

**Der Wächter hat sich umgedreht.** In `test/fahrwerk.test.ts` stand bis heute
ein Test, der den Befund FESTHIELT („die Pratzenausleger stehen weiter im Rad —
bekannter, alter Befund"). Er ist durch zwei ersetzt: einen, der den Freigang in
jeder Lenkstellung verlangt, und einen, der dieselbe Messung auf die alte Lage
anwendet und rot wäre, wenn sie zurückkäme. Die Messung selbst liegt in
`tools/radraum.ts`, damit Wächter und Werkzeug nicht auseinanderlaufen. Zur
Probe wurde die alte Lage einmal zurückgesetzt: Der Wächter meldet −22,3 cm und
schlägt fehl.

**Offen — und es ist älter als dieses Paket.** Die **Bodenplatte steht
ausgefahren 34 cm über dem Boden.** Der Fuß fährt 0,72 m relativ zur Maschine
aus, die Maschine hebt sich dabei aber um dieselben 0,34 m (`JACK_UP_M`) — unter
dem Strich sinkt die Platte nur 0,38 m und erreicht den Boden nie. Die Maschine
steht abgestützt auf nichts. Behoben ist das nicht mit einer längeren
Ausfahrstrecke allein: Bei 1,06 m Weg rutscht der Fußkasten unten aus dem Stiel
heraus, und der Fuß hinge frei. Das ist ein eigenes kleines Paket (Stiel länger,
Kasten teleskopiert) und gehört einzeln abgenommen.

**Auf dem Gerät zu prüfen.**

1. Von der Seite auf ein Vorderrad schauen und **voll einlenken** (A oder D
   halten): Bleibt der Reifen frei — kein Stahl im Rad, auch nicht am Anschlag?
2. **O drücken** und zusehen: Fahren alle vier Füße aus den Stielen heraus, ohne
   dass etwas durch den Reifen oder durch das Räumschild wandert?
3. **Oberwagen einmal ganz herumdrehen**, Pratzen eingefahren: Streift das
   Gegengewicht irgendwo an einem Kragarm?

---

### E-062 — Zwei Messgeräte, ein Vorgang, Faktor zwei: es war die Fuhre (15.09.2026)

**Entscheidung.** Von den zwei Geräten, die den Kipper-Katapult gemessen haben,
behält **`test/kipper.test.ts` recht**; das zweite (`test/zz-mess.test.ts` im
Arbeitsbaum `agent-a2b4fd9faf32d7293`, inzwischen gelöscht) ist **verworfen**,
samt aller vier Zahlen, die es in Entscheidungen geschrieben hat. Jede
Prüf-Kundschaft geht ab sofort durch **eine** Quelle, `test/pruefkunde.ts`, die
Füllgrad **oder** Masse entgegennimmt und die jeweils andere Zahl rechnet.
Bewacht von `test/kundenprofil.test.ts`. Das Messgerät selbst steht als
`tools/kipper-messreihe.ts` und führt vor jeder Reihe eine **Nullprobe**.

**Begründung — was wirklich verschieden war.** Beide Geräte waren
deterministisch, benutzten dieselben 24 Saaten, denselben Zufallsgenerator und
dasselbe Kundenprofil dem Namen nach. Nachgemessen mit **einem** Laufapparat,
bei dem immer nur **ein** Schalter umgelegt wurde und alles andere Zeichen für
Zeichen gleich blieb (8 Saaten je Zeile):

| Schalter | Mittel | Höchst |
|---|---|---|
| Grundstand (= `kipper.test.ts`) | 147 | 328 |
| nur Messfenster lang (bis zur Abfahrt statt 5,2 s) | **147** | **328** |
| nur Filter auf dynamische Körper | **147** | **328** |
| nur Solver-Werte wie im Spiel | 138 | 358 |
| **nur die Fuhre des zweiten Geräts** | **117** | **157** |
| alle drei Schalter des zweiten Geräts zusammen | 117 | 157 |

Messfenster und Körperfilter ändern die Reihe **auf die letzte Stelle gar
nicht** — die drei vom Vorgänger ausgeschlossenen Verdächtigen sind damit
belegt ausgeschlossen, nicht vermutet. Der Solver verschiebt die Bahn, nicht die
Höhe. Die letzten beiden Zeilen sind identisch: Die Fuhre war der **einzige**
wirksame Unterschied.

**Warum die Fuhre des zweiten Geräts falsch ist.** Es setzte von Hand
`fuellgrad: 0.85`, `dichte: 500` **und** `massKg: 5000`. Seit E-033 gilt aber
eine Regel (`fuellgrad.baueFuhre`): *Masse = Füllgrad × Laderaum ×
Schüttdichte*. Der flache Kipper fasst 14,08 m³, Mischschrott mit 6 % Störstoff
wiegt 594,65 kg/m³ — 0,85 voll sind **7.118 kg**, nicht 5.000. `dichte: 500`
gehört zu keinem Material. `vehicles.ts` liest die beiden Zahlen an zwei
getrennten Stellen: `c.fuellgrad` bestimmt Zahl und Größe der Brocken
(`buildCargo`, Zielfüllung und Rundengröße), `c.massKg` bestimmt das Gewicht je
Stück. Das Gerät packte den Wagen also 0,85 voll und schrieb die Ladung danach
auf 5.000 kg herunter: mehr Stücke, jedes um 42 % zu leicht. `c.dichte` wird von
`vehicles.ts` überhaupt nie gelesen — deshalb fiel nichts auf.

**Die wahren Zahlen.** Derselbe Apparat, dieselben 24 Saaten, dieselbe Ladung
Stück für Stück (die Bodendicke wird am fertigen Kollider gestellt, nicht im
Quelltext — ein Quelltexteingriff verschiebt den Zufallsstrom und vergleicht
Rauschen):

| Fuhre | Boden 0,60 m | Boden 0,16 m | paarweise |
|---|---|---|---|
| **Prüfladung 5.000 kg, Füllgrad 0,60 (gebaut)** | **149 / 463** | **94 / 226** | −55 ± 19, besser in 18 von 24 |
| Fuhre des verworfenen Geräts | 122 / 228 | 112 / 449 | −10 ± 19, besser in 17 von 24 |
| wie das Spiel würfelt (Händler, 0,74 / 6.229 kg) | 159 / 585 | 112 / 337 | −46 ± 27, besser in 15 von 24 |

Die Umkehrung, an der sich der Streit entzündet hat, steckt **nur im
Höchstwert** — der schwächsten Zahl der Reihe. Im Mittel und im Median sagen
alle drei Fuhren dasselbe: Der dünne Boden ist besser. Beim verworfenen Gerät
ging der Höchstwert bei 0,16 auf einen einzigen Ausreißer zurück (449 km/h bei
einer von 24 Ladungen); sein Median fiel von 119 auf 87.

**Und ein zweiter Fund aus derselben Klasse, beim Umbau aufgedeckt.** Die alte
`kunde()`-Funktion in `kipper.test.ts` deckelte den Füllgrad mit
`Math.min(1, …)`. Für den sortenreinen Fall hieß das: 5.000 kg Alu sind bei
246,85 kg/m³ rund 20,3 m³ und passen nicht in 14,08 — der Deckel machte daraus
`fuellgrad: 1` neben `massKg: 5000`, **44 % auseinander**. Dieselbe
Unvereinbarkeit, wegen der das andere Gerät weggeworfen wurde, nur von der
anderen Seite. Der sortenreine Fall wird jetzt über den Füllgrad bestellt
(0,85 → 2.954 kg Alu); die drei Schranken dieses Tests bleiben grün.

**Verworfene Alternative.** *Beide Reihen stehen lassen und je nach Frage die
passende zitieren* — genau das, was Patrick vor der nächsten Kipper-Änderung
abgestellt haben wollte. *Die Schranken auf die Zahlen des zweiten Geräts
senken*: hätte die Prüfung an die Messung angepasst, statt die Messung zu
prüfen. *Das zweite Gerät spurlos löschen*: Seine Zahlen stehen in
`ladeflaeche.test.ts` und damit in E-051 — sie mussten ersetzt, nicht
verschwiegen werden.

**Was mit E-051 passiert.** Die Begründung dort („Kollider 2 cm dicker treibt
den Katapult von 122/228 auf 160/492") stammte von dem verworfenen Gerät und ist
**falsch**. Nachgemessen mit stimmiger Fuhre: 0,60 m / Oberkante +0,04 ergibt
149 / 463, der 2 cm dickere Quader 135 / 354 — paarweise **+14 ± 24 km/h**, also
nicht messbar schlechter, eher unauffällig besser. Die **Entscheidung** von
E-051 (Blech senken statt Kollider heben) **bleibt**, aber aus dem richtigen
Grund: Sie kostet keine Physikänderung. Der Absatz in
`test/ladeflaeche.test.ts` ist entsprechend berichtigt.

**Das Muster, das dahintersteckt.** Fünf Fälle an einem Tag, alle mit derselben
Gestalt — grün, und prüft nicht, was es zu prüfen vorgibt:

1. `bayApproach(c.z)` statt `bayApproach(c)` → `NaN`, jeder Vergleich falsch
2. dasselbe ein zweites Mal in `fahrstrecke.test.ts`
3. Katapult-Wächter mit **einer** Zufallssaat
4. Fahrumriss-Wächter prüft ein Rechteck, die Fahrt einen Punkt mit 1,4 m Radius
5. dieser hier: zwei Geräte, zwei erfundene Fuhren

Gemeinsam ist allen **nicht** die Sorglosigkeit, sondern die Bauform: Ein
Prüfstück **schreibt eine Zahl ab**, die im Spiel schon steht, und die beiden
laufen auseinander, ohne dass jemand etwas merkt. Die Typprüfung (E-038) fängt
die Klasse, in der die Abschrift *nicht mehr übersetzt* (1, 2, 4). Diese
Entscheidung fängt die Klasse, in der die Abschrift *noch übersetzt, aber nicht
mehr stimmt*: Die Fuhre kann nicht mehr abgeschrieben werden, weil `pruefKunde`
genau eine der beiden Zahlen entgegennimmt und die andere rechnet.

**Abnahmekriterium.** `test/kundenprofil.test.ts`, sechs Prüfungen:

- `pruefKunde` erfüllt *Masse = Füllgrad × Laderaum × Schüttdichte* auf 1 %,
  egal welche der beiden Zahlen vorgegeben ist, und Hin- und Rückrechnung
  treffen sich
- die Dichte im Profil ist die des Materials, nie die gegriffene 500
- beide Zahlen zusammen anzugeben **wirft** — der Fehler lässt sich nicht mehr
  formulieren
- `rollCustomer()` erfüllt dieselbe Regel über 400 Würfe, alle Gruppen,
  Fahrzeuge und Aufbauten (Ausnahmen mit Namen: Wrack, `MINDEST_FUHRE_KG`)
- die Nutzlastgrenze senkt den Füllgrad, statt die Masse zu kappen
- **Gegenprobe:** dieselbe Prüfung, auf das Profil des verworfenen Geräts
  angesetzt, meldet 42 % Abweichung. Ohne diese Zeile wüsste niemand, ob der
  Wächter überhaupt etwas merkt.

Dazu: `tools/kipper-messreihe.ts` besteht seine Nullprobe (Eingriff auf den
gebauten Wert = kein Eingriff, Zeichen für Zeichen), und `test/kipper.test.ts`
liefert nach dem Umbau dieselbe Reihe wie vorher — `dichte`, `fuellgrad` und
`massKg` sind bitgleich nachgerechnet. 931 Tests in 84 Dateien grün (409 s),
`npm run build` grün.

**Auf dem Gerät zu prüfen.** Nichts. Diese Entscheidung ändert keine Zeile
Produktivcode — sie ändert, welchen Zahlen man glauben darf. Was am Gerät offen
**bleibt** und in `docs/offene-punkte.md` gehört: Der Katapult des **Spiels**
(Mittel 159, Höchst 585 km/h mit der gewürfelten Händlerfuhre) ist schlimmer als
der der Prüfladung und liegt **über** der Schranke von 500, die `kipper.test.ts`
hält. Der Wächter hält einen Rückschritt an einer festen Fuhre fest; er sagt
nicht, dass im Spiel nichts fliegt. Ob er auf die gewürfelte Fuhre umgestellt
wird — und die Schranken damit auf einen schlechteren, aber wahren Stand —
gehört ins Kipper-Paket und ist bewusst **nicht** hier entschieden.
### E-063 — Der Abholer hält vor der bestellten Mulde, nicht vor der Schenkelmitte (15.09.2026)

**Entscheidung.** Wer eine sortenreine Abholung ausruft, bekommt den Lastwagen
**vor genau dieses Silo** — Halteplatz und Baggerstand wandern mit der
Bestellung die Silo-Reihe entlang. Gerechnet wird weiter nach derselben Regel
(7,5 m Silo → Stand, noch einmal 7,5 m Stand → LKW-Spur), nur nicht mehr von der
Mitte des Schenkels aus. `leitSilo()` in `src/delivery/routes.ts` heißt jetzt
`schenkelMitte()` und dient nur noch den Arbeitszonen.

**Begründung.** Patrick am Gerät, 15.09.2026: „abholung fährt immer noch
falsch." E-056 hatte den Halteplatz schon einmal umgebaut, und die Wächter dazu
waren grün — sie prüften die alte Regel.

Gemessen wurde mit einem neuen Werkzeug, `v1/tools/abholfahrt.ts`: Es **fährt**
einen echten Abholer kopflos über `DeliveryVehicle.update()`, bis er steht,
statt seine Route auszurechnen. Nullprobe zuerst (Bestellung ohne Fraktion muss
am Abladeplatz 6,30 | −23,00 enden — 0,000 m Abweichung), dann jede bestellbare
Fraktion. Befund vorher:

| Bestellung | Halt | am nächsten liegt |
|---|---|---|
| Kupfer, Messing | (−18,00 \| −8,00) | KABEL-LAGER, **4,60 m daneben** |
| Kabel | (−18,00 \| −8,00) | KABEL-LAGER (richtig) |
| Alu, Zink | (−18,00 \| −8,00) | KABEL-LAGER, **4,60 m daneben** |
| VA | (−25,40 \| −7,00) | BATTERIEN, **4,60 m daneben** |
| Batterien | (−25,40 \| −7,00) | BATTERIEN (richtig) |
| Abfall (4 Fraktionen) | (−25,40 \| −7,00) | BATTERIEN, **4,60 m daneben** |

**10 von 12** Fraktionen hielten vor der falschen Mulde. Nachher: alle zwölf auf
0,00 m, Nullprobe unverändert bestanden.

**Warum die alte Begründung nicht trägt.** `leitSilo` stand für die Reichweite:
Von der Schenkelmitte erreicht der Arm alle drei Silos (8,80 · 7,50 · 8,80 m),
vom Rand nur zwei. Aber Halt und Stand hängen starr aneinander — wandern beide
gemeinsam, bleiben die **vier Ladeflächenecken auf exakt denselben 6,72 · 6,72 ·
9,25 · 9,25 m** wie vorher (gemessen, alle zwölf Fälle). Verloren geht nur, dass
man aus drei Silos auf einmal laden könnte; bestellt wird aber immer **eine**
Fraktion. Die 9,25 m sind unverändert die aus E-056 offengelegten 5 cm über dem
bequemen Band (9,20 m) und innerhalb der harten Bodengrenze von 9,50 m — dieses
Paket macht sie weder besser noch schlechter.

**Verworfene Alternative.** `leitSilo` stehen lassen und Patrick einen zweiten
Halt „neben" der Mulde erklären. Verworfen, weil die Ansage zweimal dieselbe
war.

**Die Strecken sind nachgemessen, nicht angenommen.** `test/fahrumriss.test.ts`
fährt jede der neuen Anfahrten, Rangierstrecken und Ausfahrten mit dem echten
Umriss gegen alle Bauwerke ab: keine Durchdringung. `tools/fuhren.ts`: 18 von 18
Fuhren durchgelaufen, jede Abholung mit eigener Fahrzeit (vorher hatten drei
Fraktionen dieselbe — dasselbe Ziel).

**Offen, gemessen und NICHT von mir entschieden.** Der Halt für **Edelstahl**
(−30,00 | −7,00) hat mit dem Heck nur noch **0,16 m Luft** zur Südwand des
Kupfer-Lagers; er steht damit in der Mündung der Silo-Gasse. Keine
Durchdringung, die Fahrt läuft — aber es ist die engste Stelle des Platzes. Wenn
das auf dem Gerät eng aussieht, sind die beiden Auswege: Südschenkel-Spur um
1,0 m nach Osten (dann steht der Wagen nicht mehr mittig vor seiner Mulde) oder
das VA-Lager an das andere Ende des Schenkels tauschen. Beides ist eine
Gestaltungsfrage.

**Auf dem Gerät zu prüfen.**

1. **Kupfer** zur Abholung ausrufen: Hält der Wagen vor dem KUPFER-Silo — dem
   nördlichsten des Westschenkels — und nicht davor oder dahinter?
2. **Edelstahl** ausrufen und von hinten hinsehen: Wie nah steht sein Heck an der
   Ecke des Kupfer-Lagers? (Gemessen 0,16 m — sieht das noch aus wie Rangieren
   oder schon wie ein Unfall?)
3. **Abfall** ausrufen: Er hält am östlichen Ende des Südschenkels. Kommt man von
   dort mit dem Bagger an die Mulde **und** an die Ladefläche, ohne umzusetzen?

---

### E-064 — Auch der Abholer wiegt: leer herein, voll hinaus (15.09.2026)

**Entscheidung.** Der Abholer hält bei der Einfahrt auf der Brückenwaage wie
jeder andere und wird **leer gewogen (Tara)**; beim Hinausfahren wird er **voll
gewogen (Brutto)**, und die HUD-Meldung nennt die **Differenz** als abgeholte
Menge. Die Tara eines leeren Abholers ist das Leergewicht seines
Abrollcontainers, `ABHOLER_CONTAINER_KG = 1.800 kg` (SW, aus dem Maß der Mulde:
5,40 × 2,70 × 1,25 m ≈ 18 m³, ein offener 18-m³-Container aus 3-mm-Blech wiegt
1,6–1,9 t).

**Begründung.** Patrick am Gerät, 15.09.2026: „ausserdem muss auch abholer leer
wiegen." Bis dahin stand im Quelltext ausdrücklich das Gegenteil: „der Abholer
kommt leer und faehrt durch" — er übersprang `weighIn`.

**Was ausdrücklich NICHT passiert ist.** Kein Geld, kein Konto, keine
Preisänderung: „Kreislaufsachen noch nicht." Bezahlt wird die Fuhre weiterhin
beim Losfahren vom Verladeplatz (`onPickupDepart`). Die beiden Wiegungen gehen
deshalb über **eigene** Meldungen (`onAbholerTara`, `onAbholerBrutto`) und nicht
über `onWeighIn`/`onWeighOut` — an denen hängen Preisverhandlung und Auszahlung
des Anlieferers. Ein leerer Wagen verhandelt nicht: Ohne diese Trennung stünde
der Abholer 32 Sekunden auf der Brücke und wartete auf eine Antwort, die niemand
gibt.

**Warum überhaupt eine Tara über null.** Die Waage dieses Spiels wiegt, was auf
der Ladefläche liegt, nicht den Lastwagen darunter — daran wird nichts geändert,
der Ankaufspreis der Anlieferer hängt an genau dieser Zahl. Der Container aber
**liegt** auf der Fläche und wiegt etwas. So bleiben beide Wiegungen dieselbe
Rechnung, und auf dem Lieferschein steht nicht „Tara 0 kg".

**Ein zweiter Fehler, den dieselbe Arbeit gefunden hat.** Die Ausfahrtswiegung
eines vollen Abholers hätte mit der vorhandenen Rechnung **0 kg** ergeben:
`cargoMassKg()` kennt nur die Fuhre, mit der ein Wagen hereinkommt. Was der
Spieler auflädt, wird beim Losfahren an die Fläche gekoppelt (`riding`) und
stand dort nirgends. Neu ist `ladeflaecheKg()` — dieselbe Quelle, aus der auch
die Federung ihre Last misst.

**Verworfene Alternative.** Ein Leergewicht für den ganzen Lastwagen (12 t) auf
beiden Waagen. Verworfen: Dann stünde in der Preisverhandlung des Anlieferers
eine andere Zahl als die, nach der bezahlt wird — zwei Wahrheiten an einer
Waage.

**Wächter.** `test/abholerwaage.test.ts` (neu, 4 Fälle): Er meldet seine Tara,
während er in der Phase `weighIn` auf der Brücke steht (Lage gegen `WEIGH_X` und
`WAAGE_HALT` geprüft); `onWeighIn`/`onWeighOut` werden für ihn **nie** gerufen;
Brutto − Tara ist genau die aufgeladene Masse; und die Gegenprobe — ein leer
wieder hinausfahrender Abholer meldet 0 kg. Dazu zwei Fälle in
`test/platzinventar-verdrahtung.test.ts`: Beide Hälften müssen in `main.ts`
verdrahtet sein und im HUD landen (mit Gegenprobe auf einen absichtlich
zerschnittenen Quelltext), und im Block der Wiegung darf `account.`,
`preisFaktor` oder `shift.` nicht vorkommen.

**Nachgezogen.** `test/federungAmWagen.test.ts` maß die Ruhelage des leeren
Wagens nach fester Zeit — seit dem Halt auf der Waage fährt er zu diesem
Zeitpunkt gerade wieder an, und die Feder nickt beim Anfahren (2,0025 mm gegen
eine Schranke von 2,00 mm). Gemessen wird jetzt, wenn er an seinem Platz steht.

**Auf dem Gerät zu prüfen.**

1. Abholung rufen und an der Waage zusehen: Hält er dort kurz an, kommt Mario
   heraus, und steht in der Einblendung eine **Tara**?
2. Ihn beladen, mit **V** losschicken und an der Ausfahrt hinsehen: Nennt die
   Waagen-Meldung Brutto, Tara und die Differenz — und passt die Differenz zu
   dem, was vorher als verkaufte Menge gemeldet wurde?
3. Einen Abholer **leer** wieder wegschicken: Steht dann „0 kg abgeholt" da,
   ohne dass sich am Geld etwas rührt?
### E-065 — Der Fünfschalengreifer kommt nicht herunter: es ist nicht die Traverse, es ist die Anlenkung (15.09.2026)

**Entscheidung.** Gemessen statt gebaut. Zwei Messwerkzeuge kommen dazu
(`tools/fuenfschalen-tiefgang.ts`, `tools/greifer-kippen.ts`) und ein Wächter
(`test/tiefgang.test.ts`). **Am Spielcode ist keine Zeile geändert.** Die
Formfrage geht als Auswahl an Patrick zurück, weil Gestalterisches am Bild
entschieden wird und nicht am Messwert (Projektregel 6).

**Anlass.** Patrick am Gerät: „der neue greifer fühlt sich zäh, falsch
konstruiert an und senkt nicht weit genug runter, weil die traverse stört."

**Das Symptom stimmt. Die Ursache stimmt nicht.**

Gemessen am kopflos gebauten Bagger, in einer echten Rapier-Welt, aus derselben
Armstellung für beide Formen:

| aufgesetzt, Arm 28–30° / Stiel −69,5° | Sichelkralle | Fünfschalen |
|---|---|---|
| Aufhängung steht auf | y 3,016 m | y 2,766 m |
| OFFEN, tiefster Punkt über Beton | 57,3 cm | 54,9 cm |
| **ZU, tiefster Punkt über Beton** | **6,7 cm** | **25,4 cm** |

**Der Arm wird nicht zurückgehalten — er kommt mit dem Fünfschalengreifer sogar
25 cm TIEFER.** Was oben bleibt, sind die Schalen.

**Die Traverse ist freigesprochen, und zwar mit einer Zahl.** Welche Bauteile
„nicht mitschwenken" wird gemessen, nicht am Namen erkannt: Das Modell wird zu
und offen gestellt, und nur Netze zählen, deren Weltmatrix sich dabei nicht
rührt (15 von 65). Ihr tiefster Punkt ist `GRAPPLE_HEAD_SCHWEISSNAHT` auf
**1,6518 m** unter der Aufhängung. Aufgesetzt sind das **1,10 m Luft zum
Beton**. Die Traverse berührt den Boden nie, in keiner Stellung.

*Die erste Fassung dieser Messung sagte das Gegenteil* — sie sortierte die
Bauteile am Namen aus, kannte „SCHALE" und nicht „SHELL", hielt damit alle fünf
Schalen für Traverse und meldete eine Traverse auf 2,90 m. Deshalb steht die
Bewegungsprobe jetzt an ihrer Stelle, im Werkzeug **und** im Wächter.

**Woran es wirklich hängt: die Schale schwenkt, statt sich einzurollen.**

Die Schale ist EIN starrer Körper an EINEM Bolzen (`STEMPEL_AUGE`, r 0,59 /
y −1,5335). Ihr Zahn sitzt im Bolzenrahmen auf (−A / −B), also gilt für die
Tiefe beim Schwenk `s`

    T(s) = |y_Bolzen| + A·cos s + B·sin s

Eine Sinuswelle: Scheitel bei `sqrt(A² + B²)`, Randwert `A` bei geschlossen.
Der Greifer schwebt also um **sqrt(A² + B²) − A**. Zurückgerechnet aus der
gebauten Form: A = 0,9653 m, B = 0,7422 m, Scheitel bei 39 % des Schließweges.
**Probe: 25,2 cm gerechnet gegen 25,2 cm gemessen.**

Der Bodenanschlag rechnet seit E-046 über den ganzen Schließweg und muss den
Scheitel respektieren — sonst pflügt der Greifer auf halbem Schließweg
25 cm in den Beton. Die 25 cm sind also **keine Fehlrechnung, sondern die
Anlenkung selbst.** B ist der Weg, den der Zahn vom Bolzen bis auf die Achse
zurücklegen muss; er liegt zwangsläufig in der Größenordnung des Bolzenkreises.

**Die Sichelkralle hat das Problem nicht**, weil ihre Kralle kein starrer Körper
an einem Bolzen ist, sondern eine Kette aus acht Segmenten: Sie **rollt sich
ein**, statt zu schwenken, und ihre Spitze bleibt dabei unten — 5,1 cm.

**Was eine Formänderung bringen würde** (gerechnet, nicht gebaut):

| Bolzenkreis B | schwebt | Stempelauge r |
|---|---|---|
| 0,742 m (heute) | 25,2 cm | 0,59 m |
| 0,550 m | 14,6 cm | 0,44 m |
| 0,450 m | 10,0 cm | 0,36 m |
| 0,350 m | 6,1 cm | 0,28 m |

Die Schale länger zu machen wirkt viel schwächer: 1,20 m → 21,1 cm,
2,50 m → 10,8 cm. **Der Bolzenkreis ist der Hebel, nicht die Schalenlänge.**

**Zu „zäh": am Schließen liegt es nicht.** Beide Formen haben denselben
Spielraum zwischen Befehl und Schalenrate (**1,591**), dieselbe Schließzeit
(0,4 s), praktisch dieselbe Schalenlücke (0,6293 gegen 0,5954 m) und damit
dieselben Schwellen von E-043. Der einzige Unterschied, der im Spiel ankommt,
sind die 25 cm: Was flach auf dem Beton liegt, ist beim Zupacken außerhalb des
Korbbodens.

**Zum Seitwärtskippen (Wunsch „komplett zur Seite kippen, zum Kehren und
Schleudern") — gemessen, nicht gebaut.** Heute kippt der Greifer **gar nicht
gesteuert**; es gibt nur das Pendel, gedeckelt auf 17° je Achse (`PENDEL_MAX`),
hart geschwenkt erreicht wurden **20,7°** (beide Achsen zugleich, rechnerischer
Anschlag 23,9°). Begrenzt wird es von dieser einen Konstante — nicht von einem
Gelenk und nicht von einer Kollision.

Bei 90° liefern die drei bekannten Stellen Unsinn, und zwar messbar: Die
wirkliche senkrechte Ausladung fällt von 3,00 m auf **1,77 m** — der Arm bliebe
also **1,23 m zu hoch** stehen, Kehren wäre unmöglich. Der Messstrahl von
`surfaceUnderClaws` geht senkrecht aus der Greifermitte nach unten; die Schalen
lägen dann **2,44 m** daneben. (Fünfschalengreifer: 1,62 m statt 2,75 m,
Strahl 2,05 m daneben.)

**Die Kollisionsfrage ist NICHT beantwortet, und das ist ein Befund über die
Messung, nicht über den Bagger.** Gerechnet wurden 30 Armstellungen × 19
Kippwinkel × 13 Rotatorstellungen × 6.677 Greiferpunkte = 192,9 Mio. Abstände,
gegen die Kästen von Ausleger- und Stielkasten. Die **Nullgrad-Zeile ist die
Eichung**: Dort hängt der Greifer nachweislich frei, die Messung meldet aber
**−0,071 m**. Das ist ihr Eigenfehler — Kästen um verschmolzene Netze sind
größer als die Netze (der Stielkasten enthält den seitlich abstehenden
Zylinderkopf). Absolute Zahlen sind damit unbrauchbar. *Die erste Fassung hatte
das nicht gesehen und 47 cm Durchdringung ins Räumschild gemeldet — bei
Kippwinkel 0.*

Verwendbar ist allein der **Zuwachs gegenüber lotrecht**: 30° → 0,153 m,
45° → 0,172 m, 60° → 0,168 m, 75° → 0,242 m, **90° → 0,267 m**. So viel näher
kommt der gekippte Greifer dem Arm. Ob das reicht, um ihn zu berühren, kann nur
ein Test auf Dreiecksebene sagen. Das ist ein eigenes Paket und muss vor dem
Kippen kommen.

**Der Besen passt.** 2,70 × 0,80 × 1,12 m, 680 kg. Der geschlossene Korb misst
1,297 m im größten Durchmesser, die Rolle ragt also 0,70 m je Seite heraus —
gefasst wird ihre Mitte. Deren kleinste Kante (0,80 m) ist größer als die
Schalenlücke (0,629 m), zwei Schalen können sie also berühren und das
Greiffenster von E-043 ist offen. Patricks „breite so lassen, ich kann die
spinne ja drehen damit es passt" trägt.

**Verworfene Alternative.** Den Bodenanschlag für den Fünfschalengreifer auf die
Momentanstellung umstellen. Das ist genau die Krankheit von E-046: Beim
Schließen von offen auf den Scheitel würde der Arm um 53 cm nach oben
nachgeregelt — er zöge sich in den Bildern weg, in denen er zufassen soll.

**Unangetastet.** Die Sichelkralle in Form und Verhalten — es ist keine Zeile
Spielcode geändert, also ist der Abdruck aus `tools/greifer-abdruck.ts`
trivialerweise derselbe. Griff-Kern (Sensorkugel + Fixed Joint), Pendel,
Rotator, Kamera, Bodenanschlagshöhe beider Formen.

**Abnahmekriterium.** `test/tiefgang.test.ts`, 6 Prüfungen, **jede
Zahlenschranke mit Gegenprobe**: Die Sichelkralle schließt unter 8 cm (Gegenprobe:
eine um 30 cm angehobene Kralle meldet); die Traverse hält über 0,50 m Luft
(Gegenprobe: eine um 1,20 m abgesenkte Traverse meldet); die Schwebeformel
trifft die Messung auf 1 mm (Gegenprobe: ein um 44 cm falscher Bolzenkreis
meldet). 1.004 bestehende Prüfungen bleiben grün.

**Offen — Patrick entscheidet, weil es Gestaltung ist.** Soll der
Fünfschalengreifer den Bolzenkreis von 0,59 auf etwa 0,36 m einziehen (dann
schließt er auf 10 cm statt 25 cm, sieht aber schlanker und anders aus)? Oder
bleibt die Form, wie sie gezeichnet ist, und die 25 cm sind der Preis dieser
Bauart — dann ist der Fünfschalengreifer der Greifer für den Haufen und die
Sichelkralle der fürs Kehren vom Beton?

**Offen — technisch, kommt vor dem Kippen.** Ein Freigangstest auf
Dreiecksebene. Ohne ihn lässt sich nicht sagen, ob der Greifer 90° zur Seite
kann, ohne in Stiel oder Ausleger zu fahren; der Kastentest hier kann es
nachweislich nicht (er meldet schon bei 0° eine Berührung, die es nicht gibt).

**Auf dem Gerät zu prüfen.**

1. Mit dem **Fünfschalengreifer** ein flaches Teil vom Beton nehmen und dabei
   **von der Seite** zusehen: Setzt der Greifer auf der Traverse auf — oder
   fahren die Schalen bis auf den Boden hinunter und kommen beim letzten Stück
   des Schließens wieder hoch? Gemessen ist das Zweite.
2. Dasselbe Teil mit der **Sichelkralle**: Kommt sie sichtbar tiefer herunter?
   Wenn ja, ist das der Unterschied 6,7 gegen 25,4 cm.
3. Mit dem Fünfschalengreifer in einen **Haufen** greifen statt auf den Beton:
   Fühlt er sich dort auch zäh an, oder nur auf der flachen Fläche? Die Antwort
   sagt, ob die 25 cm die ganze Beanstandung erklären.

---

### E-066 — Der Abholer bekommt einen Namen: Achim Kurtenbach (15.09.2026)

**Entscheidung.** Aus der Rolle „Abholer" wird **ein wiederkehrender Fahrer mit
Namen**: **Achim Kurtenbach**, 54, Abrollkipper einer Spedition aus Wickrath.
Er meldet sich am Funk mit „Achim" und hat eigene Sätze für die fünf Lagen, die
es auf diesem Hof wirklich gibt: ankommen und melden wo (E-056), warten während
beladen wird, beladen losfahren, **leer** losfahren (E-064) und die
Müllcontainer-Wanne leer zurückgeben (E-034).

**Begründung.** Patrick, 15.09.2026, auf die Frage nach der Besetzung: ein
wiederkehrender Fahrer. Ausdrücklich verworfen: „mehrere, wechselnd". Auf einem
Hof, der jeden Tag denselben Container abholen lässt, kommt auch jeden Tag
derselbe Mann — und eine Rolle, die spricht, ist keine Figur. Lambert und
Janine haben Namen und Familien; der Abholer war der letzte, der seine Stimme
von einem Funktionsnamen geliehen hatte.

**Woher der Name kommt.** Aus der Nachbarschaft, die schon im Quelltext steht:
Die Ortsliste dieser Datei ist Mönchengladbach (Neuwerk, Odenkirchen, Lürrip,
Wickrath, …). Achim ist der Jahrgang der übrigen Stammfiguren (Willi, Kurt,
Heiner, Rudi, Ewald, Fritz), Kurtenbach ein niederrheinischer Name ohne
Beiklang. **Ton-Leitplanke (Projektregel 7):** Sein Milieu kommt aus **Beruf,
Familie, Geschäft** — Standzeit, Lieferschein, Kaffeebecher, Tochter Lena, die
Abitur macht und Fahrstunden nimmt, Dauerbaustelle auf der A61 (nicht A1: die
liegt 100 km weg, die A61 führt an Mönchengladbach vorbei). Nie aus Herkunft,
nie eine Andeutung übers Geschäftsgebaren. Er drängelt auch nicht: Seine
Wartezeile ist eine Entwarnung („Lass dir Zeit, ich hab noch Standzeit."),
keine Aufforderung, und eine Leerfahrt ist ihm Berufsrisiko, kein Vorwurf.

**Was ausdrücklich NICHT passiert ist.** Kein Geld, kein Kreislauf: kein Preis,
kein Ruf-Wert, keine Verhandlung, kein Konto. „Kreislaufsachen noch nicht."
Der Abschnitt in `customers.ts` enthält kein Eurozeichen. Ebenso wenig gibt es
eine **Figur am Steuer** — sichtbar wird er nicht, das ist Gestaltung und
gehört ans Bild.

**Die Kopplung an das Schild bleibt (E-056).** Der Ort im Ankunftsspruch kommt
weiter aus dem `label` des Behälters, an dem er hält — derselben Quelle, aus
der auch sein Halteplatz gerechnet wird. Deshalb stehen seine drei
Ankunftssätze als **Vorlagen** (`amSchild`) im Datensatz und nicht als fertige
Zeilen. Die drei Sätze von E-056 sind Wort für Wort geblieben; sie sind am
Gerät abgenommen, neu ist nur, wer sie sagt.

**Gebaut wie die Händlerfamilien, nicht daneben.** Ein Datensatz `ABHOLFAHRER`
(Name, Funkname, Milieu, Sprüche je Lage), aus dem `pick()` zieht — dieselbe
Bauweise wie `FAMILIES` in derselben Datei. Am Fahrzeug steht nur noch die
**Lage**: `onAngekommen` (kannte nur die Ankunft) ist zu `onFahrerlage(lage)`
geworden, ein Kanal statt fünf Rückrufe. Was gesagt wird, entscheidet
`customers.ts`; wo es erscheint, das HUD (`onPickupFunk`, unverändert
verdrahtet).

**Neue Zahl.** `WARTE_FUNK_S = 25` (SW): Standzeit bis zur ersten Wartezeile,
einmal je Fuhre. Kürzer wirkt es wie Drängeln, länger hört man es nie — die
Standzeit des Wagens läuft erst nach 240 s ab. Die Schranke „voll oder leer"
beim Losfahren ist **1 kg** und stammt aus derselben Quelle wie das Brutto der
Ausfahrtswiegung (`ladeflaecheKg()`, E-064); so können Fahrer und Waage nicht
Verschiedenes sagen.

**Verworfene Alternative.** Eine eigene Datei `delivery/abholfahrer.ts`.
Verworfen: Die Stimmen des Platzes stehen in `customers.ts`, dort stand auch
schon der Funkspruch, und eine zweite Wohnung für dieselbe Bauweise wäre genau
der Bruch, der beim nächsten Umbau vergessen wird.

**Wächter.** `test/abholfahrer.test.ts` (neu, 14 Fälle) in drei Teilen: die
Figur (ein Name statt einer Rolle, Funkname im vollen Namen enthalten, ≥ 3
Sätze je Lage, keine Dopplung, keine Zeile ≥ 45 Zeichen — dieselbe Schranke,
die `abholplatz.test.ts` seit E-056 hält), die **Ton-Leitplanke** (Wortliste
gegen Herkunft und Halbseidenes, dazu „er drängelt nicht") und der
**Verdrahtungs-Wächter**: Eine ganze Abholung wird gefahren und der Funkverkehr
mitgeschrieben — ankommen, warten (genau einmal), beladen losfahren. Jede
Schranke hat ihre **Gegenprobe**: ein absichtlich kaputter Fahrer (doppelter,
zu langer, fehlender Satz) muss gemeldet werden; ein Spruch über Herkunft muss
auffallen; die Leerfahrt muss „abfahrtLeer" ergeben **und** dieselbe 0 kg wie
die Waage; eine Wanne, die 12 m neben dem Wagen steht, darf keine Rückgabe
melden.

**Offen.** Ob die Wanne, wie E-034 sie beschreibt, „am nächsten Tag" statt
sofort zurückkommt, ist unverändert: Gebaut ist weiter das sofortige Absetzen
am Abladeplatz. Achims Satz passt auf beides.

**Auf dem Gerät zu prüfen.**

1. Abholung rufen und hinhören: Steht jetzt **„Achim: …"** in der Einblendung
   statt „Abholer: …", und stimmt der genannte Ort noch mit dem Schild überein,
   an dem er hält?
2. Ihn nach der Ankunft eine halbe Minute stehen lassen, ohne etwas zu laden:
   Kommt **eine** Wartezeile — und bleibt es danach still?
3. Ihn einmal **beladen** und einmal **leer** mit **V** losschicken: Sagt er
   beide Male etwas anderes, und passt sein Abschied zu dem, was die Waage zwei
   Meter weiter meldet („… kg abgeholt")?

---

### E-067 — Ein Gegenstand ist, wonach er aussieht; und keine Mulde ist mehr zu dünn (15.09.2026)

**Entscheidung.** Zwei Dinge in einem Zug, weil sie dieselben Dateien anfassen.

*Teil A — Aussehen und Name in Deckung.* Der Polsterzweig von `moebel` hing an
den **Abmessungen** (`h < w*0,75 && d > h*0,7`). Diese Zeile ist **ersatzlos
gestrichen**. Polstermöbel tragen jetzt `bau: "polster"`, und nur sie. Dazu
sieben weitere Bauten, damit die Gegenstände, die bisher fremdgingen, ihren
eigenen bekommen: `kiste`, `klotz`, `batterie`, `boot`, `armatur`, `propeller`,
`anker`. **36 Katalogeinträge** sind auf einen anderen Bauzweig umgehängt
(nachgezählt am Diff, nicht geschätzt); zwei weitere — Stahlschrank und
Küchenzeile — ändern ihr Aussehen, ohne dass ihr Eintrag angefasst wurde: Sie
hingen am gestrichenen Massenzweig.
Zusätzlich holen blanke Bauteile ihren Grundton jetzt aus der Fraktion, wenn es
**Buntmetall** ist (`metallton()` in `objektbau.ts`) — ein Kupferkessel ist
kupfern, ein Stahltank bleibt grau.

*Teil B — dünne Fraktionen auffüllen.* **33 neue Einträge**: je sechs Kupfer,
Messing und VA, fünf Kabel, vier Zink, vier Batterien, zwei Polstermöbel. Die
Zielgröße „mindestens acht je Fraktion" gilt für die **Größenklasse der
Kleinteile**, nicht für den Gesamtkatalog — `randomCargo` wählt erst die Klasse
und zieht dann die Fraktion daraus, eine sortenreine Kleinteil-Fuhre sieht also
nur die Kleinteile ihrer Fraktion.

*Nebenbei behoben.* `baueGeometrie` las bei `kind: "wire"` die Felder `dims[1]`
und `dims[2]`, die es dort nicht gibt. Drei Haufen (Ankerkette, Reifenhaufen,
Stahlteile-Haufen) bekamen dadurch ein Netz aus NaN — BEFUND B-3 in
`test/fraktionen.test.ts`, seit dem 15.09. bekannt. Bei `wire` ist die
Kantenlänge jetzt der Durchmesser.

**Begründung.** Patrick, 15.09.2026: „Ich habe jetzt eben eine Couch gehabt, da
hat mir einer gesagt, das wäre VA … dann brauchen wir wahrscheinlich eine
größere Liste, dass wenn etwas wie eine Couch aussieht, dass es auch eine Couch
ist. Und dann ist es Müll."

E-061 hat den Einzelfall geheilt (der Gastro-Spültisch ist keine Couch mehr) und
dabei die **Ursache** stehen lassen: Solange die Maße entscheiden, wird der
nächste Eintrag in den falschen Maßen wieder zur Couch. Gemessen am Katalog vom
15.09. traf es vier — Stahlschrank, Holzkiste, Küchenzeile, Fahrzeug-Sitzbank.
Die Durchsicht des ganzen Katalogs (`tools/katalog-aussehen.ts bau`) fand
**weitere 26** derselben Art: elf Gegenstände im Motorblock-Zweig, die kein
Motor sind (Amboss, Poller, Gegengewichte, Anker, Prellbock, Getriebe, zwei
Trommeln, Rotorkopf, Pressenrahmen), fünf Boote als liegende Kessel mit
Domdeckel, drei Autobatterien als Gitterrahmen, zwei Propeller als Blech,
Ölradiator als Seecontainer, Aufsitzmäher als Werkzeugmaschine, Kassentheke als
Gittergestell, Mischschnecke und Ballenpresse als Tank. Eine Couch, zu der die
Waage „sortenrein Edelstahl" sagt, ist der sichtbarste Fall — der Rest wirkt
leiser und genauso.

Teil B hat denselben Grund von der anderen Seite: In der Kleinteil-Klasse standen
Kupfer 2 Sorten, Messing 2, Kabel 3, Zink 4, Batterien 4, VA 6. Eine sortenreine
Kupferfuhre bestand aus **zwei verschiedenen Dingen**, hundertmal gelegt. Die
Namen sind Sachen, die auf einem Platz wirklich anfallen (Stromschiene,
Erdungsband, Absperrschieber, Lagerschale, Opferanode, USV-Block); jede Masse
ist aus Volumen × Feststoffdichte des richtigen Werkstoffs **gerechnet**, die
Rechnung steht an jeder Zeile.

**Verworfene Alternativen.**

1. *Nur die Couchen reparieren.* Patrick auf die Frage: „In einem Zug
   aufräumen." Ein zweiter Durchgang hätte denselben Katalog ein zweites Mal
   durchgesehen.
2. *`moebel` einen dritten Zweig geben, der Holz von Stahl unterscheidet.* Wäre
   wieder eine Regel, die rät. Die Auswahl darf nicht mehr an Eigenschaften
   hängen, die man dem Eintrag nicht ansieht — das war der Fehler.
3. *Den Grundton ALLER Bauten aus der Fraktion holen.* Gemessen
   (`tools/metallton.ts`) liegt die Stahl-Fraktionsfarbe ΔE2000 = 8,8 neben dem
   bisherigen Bauton: ein sichtbarer Unterschied an rund zweihundert
   Gegenständen, den niemand bestellt hat. Nur Buntmetall wird umgestellt.
4. *Auch Reifen, Holz und Baumischabfall auffüllen.* Das sind
   Abfallfraktionen — niemand bestellt eine sortenreine Reifenfuhre, und jede
   Änderung an der Mischung in `randomCargo` verschiebt den Verdienst. Bleibt
   als BEFUND stehen (`test/gewicht.test.ts`), ausdrücklich nicht entschieden.

**Abnahmekriterium.**

- `test/bauart.test.ts`: Die alte Massenbedingung steht nicht mehr im Quelltext;
  jeder Träger von `polster` heißt nach einem Polstermöbel **und** landet in
  einer Fraktion, die Geld **kostet**; umgekehrt trägt jedes Stück, das Couch,
  Sofa, Sessel oder Sitzbank heißt, diesen Bau (Ausnahme mit Namen:
  Matratzenstapel). Acht weitere Bau↔Name-Regeln (motor, batterie, boot,
  armatur, propeller, kiste, anker, beton), jede mit Gegenprobe.
- `test/gewicht.test.ts` (neu, 17 Prüfungen): Der ganze Katalog hält die
  Feststoffdichte seines Werkstoffs ein, und die daraus folgende Wandstärke
  liegt zwischen 0,5 und 60 mm. **Vier Gegenproben**, alle mit demselben
  Prüfcode: Patricks Alu-Klotz von 1,8 t (möglich wären 65 kg), die
  Messingarmatur von 900 kg, ein Blech von 0,05 mm, ein Klotz von 300 mm — jede
  muss melden, und ein echtes Stück daneben darf es nicht. Dazu: acht Sorten je
  Fraktion in der Kleinteil-Klasse, mit einer Gegenprobe, dass die Zählung
  wirklich nur eine Klasse sieht.
- `test/fraktionen.test.ts`: 313 erreichbare Einträge (vorher 280), kein Bau
  liefert mehr ein Netz mit NaN-Ecken.
- 1041 Tests in 90 Dateien grün, `npm run build` grün.
- Kosten gemessen (`tools/katalog-aussehen.ts ecken`): Die acht neuen Bauten
  liegen bei 236–684 Eckpunkten und damit **innerhalb** des Bestands (Platte
  144, Tank 764, Gitterbox bis 1464). Ein Gegenstand bleibt ein Zeichenruf;
  kein neuer Körper, keine neue Physik.

**Auf dem Gerät zu prüfen.**

1. **Sortieren wie immer und auf die Couch achten.** Wenn ein Polstermöbel im
   Greifer hängt, muss es aussehen wie eins (Sitz, Lehne, zwei Armlehnen,
   Kissenfugen) — und die Griff-Info darf keine Metallklasse nennen. Kommt ein
   Stahlschrank oder eine Küchenzeile, stehen sie jetzt als Korpus mit
   Türfronten da, nicht mehr in Stoff bezogen.
2. **Einmal eine sortenreine Kupfer- oder Messingfuhre kommen lassen** und die
   Pritsche ansehen: Es müssen mindestens fünf verschiedene Dinge draufliegen,
   und sie müssen **kupfern bzw. messingfarben** sein — nicht grau wie bisher.
   Stimmt der Anblick mit dem Namen im Greifer überein?
3. **Eine Autobatterie greifen.** Sie war bis heute ein Gitterrahmen, durch den
   man hindurchsah; jetzt ist es ein schwarzer Kasten mit hellem Deckel und zwei
   Polen. Und: Liegt das Gewicht im Greifer plausibel — die Motorradbatterie bei
   4 kg, die Staplerbatterie bei 320?
### E-068 — Der Knick im Zahn: er ist da, er kostet 4,4 cm, und er ist nicht umsonst wegzunehmen (15.09.2026)

**Entscheidung.** Gemessen und gezeichnet, **nicht gebaut**. `src/` ist Zeile für
Zeile unverändert. Neu sind ein Messwerkzeug (`tools/fuenfschalen/zahnknick.ts`)
und ein Blatt (`docs/f5-zahnknick-2026-09-15.svg`) mit drei Formen. Patrick
entscheidet am Bild, weil die Wahl zwischen zwei seiner eigenen Ansagen liegt
und nicht zwischen zwei Messwerten.

**Anlass.** Patrick am 15.09.2026, vor `docs/f5-greiferschale.png` und vor einem
Vorbildfoto (`docs/f5-vorbild-aufnahme-patrick-2026-09-15.jpg`, gelber Kringel
auf dem Übergang Schale → Lager):

> „dieser harte Knick im Zahn, den gibt es nicht. Das ist nicht so."
> „das Problem ist ja die Aufnahme an dem Zahn. Der Zahn ist falsch gebogen,
> weshalb du diese Abstände zur Traverse brauchst."

**Der Knick ist eine Zahl, und sie steht seit dem 14.09.2026 im Quelltext.**
`zahnAnstellung(offen) = offen − schalenEnde().th + zahnEigenwinkel()`
(`teile.ts:1856`). Mit `OFFEN` = `schalenEnde().th` bleiben davon **−12,15°**
übrig: um genau diesen Winkel ist der Zahn gegen das Schalenende verdreht.
Eingebaut wurde er, damit der Zahn bei OFFENEM Greifer lotrecht steht (Ansage
13.09.2026, Messprotokoll `docs/messungen/2026-09-14_fuenfschalen-zahnwinkel.md`
Abschnitt 2). Patrick sieht heute die Folge davon. **Beide Ansagen sind seine,
und mit diesem Anschlag schließen sie einander aus.**

**Was der Knick wirklich kostet — die Zerlegung von A und B aus E-065.** Im
Bolzenrahmen hat jeder Netzpunkt (a, b) = (tief unter dem Bolzen, weit nach
innen), und beim Schwenk `s` liegt er `|y| + a·cos s + b·sin s` unter der
Aufhängung. Damit ist `tiefe(zu)` = max a und `maxTiefe` = max hypot(a, b) —
gemessen an 1.296 Netzpunkten der Schale 0:

| | a | b | an welchem Bauteil |
|---|---|---|---|
| tiefster Punkt **geschlossen** | 0,9792 | 0,4535 | `06_ZINKEN` |
| tiefster Punkt **über den Weg** | 0,9273 | 0,7891 | `07_ZAHN`, Scheitel bei 40,4 % |

**B ist kein Punkt, sondern ein Rechenwert** — `sqrt(R² − A²)` aus zwei
VERSCHIEDENEN Punkten. Und: **der Zahn bringt 0,0 cm Tiefe und 11,2 cm
Scheitel.** Ohne ihn schwebte der Greifer 12,7 cm, mit ihm 23,8 cm. Patricks
Lesart trifft also zu — aber nur zur Hälfte: Die andere Hälfte sitzt in der
Schale selbst und ist mit keiner Zahnform zu holen.

*Nebenbefund:* `FUENFSCHALEN.tiefe()` misst nur `07_ZAHN`
(`greiferFuenfschalen.ts`). Der Rücken des Zinken reicht geschlossen 1,4 cm
tiefer. Die im Spiel gerechneten 25,2 cm sind also 23,8 cm wirkliche
Schwebehöhe. Nicht angefasst, hier notiert.

**Die drei Formen, gemessen am gebauten Netz.**

| | **A** heute | **B** Zahn tangential | **C** Zahn tangential, Anschlag folgt |
|---|---|---|---|
| Anschlag offen | 96,25° | 96,25° | **108,40°** |
| Zahn gegen Schalenende | **−12,15°** | 0,00° | 0,00° |
| **Schwebehöhe geschlossen** | 23,8 cm | **19,4 cm** | **19,4 cm** |
| **Maulweite offen** | 3,176 m | 3,095 m | 3,313 m |
| **Korbtiefe geschlossen** | 0,9792 m | 0,9792 m | 0,9792 m |
| **Zahnwinkel bei Bodenkontakt** | 34,2° | 23,5° | 23,3° |
| Zahn offen gegen die Senkrechte | **0,00°** | **12,15°** | 0,00° |
| Hebelarm offen (Ziel > 100 mm) | **118 mm** | **118 mm** | **47 mm** |
| Hüllkreis (Grenze 3,38 m) | 3,232 | 3,226 | 3,369 |
| Sektor (Grenze 36°) | 26,34° | 26,34° | 26,34° |

**Die Wahl in einem Satz:** **B** nimmt den Knick weg und lässt jeden Kennwert
stehen — der Preis ist, dass der Zahn offen 12° schief steht. **C** hält beides,
und der Hebelarm ganz offen fällt von 118 auf 47 mm — **genau das, was E-039
erkämpft hat**, und an der Stelle, die E-039 die gefährlichste nennt („die, in
der man in den Haufen sticht").

**C ist mit der heutigen Traverse nicht zu retten.** Abgerastert bei festem
Aufnahmeradius 0,465 und fester Höhe −0,635: **null** Anlenkungen halten
Vertrag und Hebelarm > 0,115 m. Erst wenn die Aufnahme auf −0,730 zurückgeht
(die Höhe VOR E-039), findet sich mit Ay −0,12 / Az 0,270 wieder 0,1178 m. Auch
Ø 0,70 trägt dann (Ay −0,08 / Az 0,285 → 0,1172 m) — das wäre Patricks „A, wenn
die Traverse kürzer ist", aber mit 37,9° Zylinderneigung statt 24,4°.

**Der Winkelhebel ist schon gebaut.** Patrick beschreibt eine Schale, die mit
EINEM Bolzen direkt am Kopf sitzt und über den Bolzen hinaus den Zylinder
aufnimmt. Nachgesehen: Genau so ist es. Die Schale hängt an `STEMPEL_AUGE`
(`teile.ts:328`, `rig.ts:307`), der Zylinder greift direkt an `06_ZYLINDERAUGE`
an (`rig.ts:421`) — **kein Lenker, kein Zwischenglied.** Der Unterschied liegt
woanders: `OBERE_ANBINDUNG` (`teile.ts:371`) sitzt bei (−0,08 / 0,245), also
8 cm **unter** und 24,5 cm **außerhalb** des Bolzens. Beim Vorbild reicht der
Hebel nach **oben innen**. Das umzudrehen kehrt die Wirkrichtung des Zylinders
um (heute fährt er zum Schließen AUS) und wirft die ganze Anlenkung aus E-039
neu auf — ein eigenes Paket, keine Nebenarbeit.

**Was am Übergang außer dem Knick noch steht.** Die Sichtprobe zeigt bei B eine
verbleibende **Querschnittsstufe** am Sitz: Der Zahn sitzt auf der Außenhaut
(`zahnZ0()` = Wölbung + Blech), die innere Strebe endet davor. Dazu der
**Schulterabsatz** am Arm, der am 14.09.2026 absichtlich gebaut wurde
(`SCHULTER_AB` 0,42 · `SCHULTER_BIS` 0,74 · `SCHULTER_VOR` 0,22; Messprotokoll
Abschnitt 3: „Der Arm bleibt über 42 % der Ferse satt und fällt dann über ein
Drittel ab. Das ist der Absatz, sowohl in der Rücken- als auch in der
Draufsichtlinie"). **Patricks Kringel auf dem Vorbildfoto liegt genau dort.**
Beides ist gemessen und nicht angefasst — es ist das nächste Paket.

**Verworfene Alternative.** C bauen und die beiden Wächter „Neigung bleibt unter
25°" und „Hebelarm über den ganzen Weg > 0,115" auf den neuen Stand nachziehen.
Das ist genau der Fehler, vor dem diese Wächter selbst warnen: „Weit gesetzte
Grenzen hätten den Umbau nicht bemerkt." Ein Wächter, der nachgibt, sobald er
meldet, ist keiner.

**Ebenfalls verworfen (Rechnung liegt bei, falls sie wiederkommt).** Der
Bolzenkreis als Hebel für die Schwebehöhe (E-065). Gerechnet am gebauten Netz,
mit `drehpunktR + versatz = 0,89` konstant, damit die geschlossene Form Punkt
für Punkt dieselbe bleibt:

| Bolzenkreis B | Bolzen r | schwebt | Maulweite offen | Sektor (Grenze 36°) | Hebelarm kleinster |
|---|---|---|---|---|---|
| 0,742 (heute) | 0,590 | 25,2 cm | 3,18 m | 26,3° | 118 mm |
| 0,550 | 0,413 | 14,6 cm | 2,78 m | **39,8°** | **17 mm** |
| 0,450 | 0,325 | 10,0 cm | 2,59 m | **46,2°** | **1 mm** |
| 0,350 | 0,242 | 6,1 cm | 2,40 m | **56,4°** | **0 mm** |

**Alle drei verkleinerten Varianten scheitern zweifach:** Die fünf Schalen
überschneiden sich (fünf Körper von 0,40 m Breite passen erst ab r 0,318 m
nebeneinander), und der Zylinder bekommt einen Totpunkt. Geschlossene Form,
Korbtiefe und Korbvolumen blieben dabei rechnerisch unverändert — die
Mittellinie ist in allen vier Zahl für Zahl dieselbe. *Die Spalte „Stempelauge r"
in E-065 (0,44 / 0,36 / 0,28) ist zu groß: Sie skaliert r proportional zu B, die
gebaute Kinematik verlangt aber `r = B − 0,152`.*

**Abnahmekriterium.** `npm test` grün (**1023 Tests in 91 Dateien**, unverändert),
`npm run build` grün. **Sichelkralle nachweislich unangetastet:** `git diff`
über `src/` ist leer — es ist keine Zeile Spielcode geändert, an keinem Greifer.

**Auf dem Gerät zu prüfen.** Nichts am Spiel — es hat sich nichts geändert. Am
Bild `docs/f5-zahnknick-2026-09-15.svg`:

1. Zeile 1, die drei Übergänge Schale → Zahn nebeneinander: Ist der Absatz bei
   **A** das, was du gemeint hast — und ist **B** das, was du willst?
2. Zeile 2, Greifer offen: Stört es, dass der Zahn bei **B** 12° nach innen
   hängt statt lotrecht zu stehen? Das ist der ganze Preis von B.
3. Zeile 3, geschlossen auf der Betonkante: Der graue Schatten ist die tiefste
   Stellung auf dem Schließweg. **Sie** hält den Arm oben, nicht die Traverse.

### E-069 — Der Zahn sitzt jetzt tangential: Variante B ist gebaut (15.09.2026)

**Entscheidung.** Patrick hat am Blatt `docs/f5-zahnknick-2026-09-15.svg` **Variante
B** gewählt. Gebaut: `zahnAnstellung()` von **−12,15° auf 0,00°**, der Anschlag
bleibt bei 96,25°. Der Zahn setzt das Schalenende tangential fort — am Übergang
gibt es keinen Richtungssprung mehr. Dazu behoben: `FUENFSCHALEN.tiefe()` maß
nur den Knoten `07_ZAHN` und lag damit 1,4 cm daneben.

**Anlass.** Patrick am 15.09.2026, vor `docs/f5-greiferschale.png` und einem
Vorbildfoto (`docs/f5-vorbild-aufnahme-patrick-2026-09-15.jpg`): „dieser harte
Knick im Zahn, den gibt es nicht. Das ist nicht so." Und zur zweiten Frage:
„Reicht, wenn der Zahn stimmt."

**Der Preis, und er ist bewusst.** Bei voll geöffnetem Greifer hängt der Zahn
jetzt **12,15° nach innen** statt lotrecht zu stehen. Das ist eine Entscheidung
**gegen** Patricks eigene Ansage vom **13.09.2026** („wenn die Spinne offen ist,
sollten die Schalen weiter offen gehen, sodass die Spitzen senkrecht stehen"),
getroffen von ihm selbst am **15.09.2026** am Bild. **Bitte nicht reparieren.**
Beide Daten stehen im Quelltext an `zahnAnstellung` und im Wächter
`test/fuenfschalen.test.ts` („hängt bei voller Öffnung genau um seine
Eigenbiegung nach innen").

Die Alternative C hätte beides gehalten — für den Preis, dass der Hebelarm des
Zylinders ganz offen von 118 auf 47 mm fällt. Das ist genau die Zahl, für die
E-039 die Traverse umgebaut hat.

**Vorhersage gegen Messung am gebauten Stand.** Vier Maße, vorher aus E-068
gerechnet, jetzt am gebauten Netz nachgemessen:

| | vorher (A) | vorhergesagt | **gemessen** |
|---|---|---|---|
| **Schwebehöhe geschlossen** | 23,8 cm | 19,4 cm | **19,4 cm** |
| **Maulweite offen** | 3,176 m | 3,095 m | **3,095 m** |
| **Korbtiefe geschlossen** | 0,9792 m | 0,9792 m | **0,9792 m** |
| **Zahnwinkel bei Bodenkontakt** | 34,2° | 23,5° | **23,5°** |

**Die Vorhersage trifft auf die letzte gedruckte Stelle.** Das ist kein Zufall:
Beide Zahlenreihen kommen aus demselben Werkzeug
(`tools/fuenfschalen/zahnknick.ts`), das vorher eine ausgetauschte Greiferspitze
und jetzt den gebauten Stand vermisst.

**Die beiden Wächter, an denen C gescheitert ist, sind NICHT nachgezogen** und
laufen unverändert: Zylinderneigung offen **15,4°** / geschlossen 20,7° / größte
24,4°, Hebelarm offen **118 mm** und über den ganzen Weg über 115 mm. B kostet
davon nichts.

**Was sich nebenbei verbessert hat** — beides, weil die Zahnspitze nicht mehr
nach außen gedreht wird: Hüllkreis **3,232 → 3,226 m** (Grenze 3,3805), und die
fünf Spitzen treffen sich geschlossen **142,3 → 137,6 mm** von der Achse, also
näher. Sektor 26,34°, Bauhöhe 2,505 m, Breite 2,190 m, Nettokorb 1.525 l — alle
unverändert.

**Der Messfehler ist behoben, und er wirkt in dieselbe Richtung.**
`FUENFSCHALEN.tiefe()` griff nur `07_ZAHN` ab; gemessen reicht der **Rücken des
Zinken geschlossen 1,4 cm tiefer** als der Zahn. Jetzt zählt jedes Netz der
Schale. Am Bodenanschlag ändert das zusammen mit der neuen Form:

| | vorher | nachher |
|---|---|---|
| `tiefe(zu)` | 2,4988 m | **2,5127 m** (+1,4 cm) |
| `maxTiefe` — daran setzt der Arm ab | 2,7511 m | **2,7071 m** (−4,4 cm) |
| `sensorRadius` | 1,2511 m | **1,2289 m** |

Der Arm setzt also **4,4 cm tiefer** ab, und der Korbboden von `imKorb` liegt
geschlossen **1,4 cm tiefer**. Beides hilft beim selben: flach auf dem Beton
Liegendes. Der Sensorradius fällt dabei zurück auf die Mittellinienrechnung aus
E-048 (2,5489 + 0,18 − 1,50), weil 2,7071 − 1,50 = 1,2071 kleiner ist — die
Formel nimmt das Maximum der beiden und folgt damit der Form, statt eine Zahl
festzuhalten.

**Und es kostet keine Rechenzeit.** `tiefe()` läuft in `imKorb` je Kandidat und
Bild. Von „nur der Zahn" auf „die ganze Schale" wären das 1.296 statt rund 100
Punkte gewesen; `tiefstenRand` kürzt sie vorher auf die, die überhaupt einmal
der tiefste sein können — der Sieger über 2.000 Schwenkstellungen, doppelte
weggelassen.

**Die Schulter am Arm bleibt stehen — gemessen, ausgelaufen, zurückgenommen.**
Patricks gelber Kringel auf dem Vorbildfoto liegt auf dem Übergang Schale →
Lager, und dort sitzt seit dem 14.09.2026 ein absichtlicher Absatz
(`SCHULTER_AB` 0,42 · `SCHULTER_BIS` 0,74 · `SCHULTER_VOR` 0,22). Er ist auch
nach dem Zahnumbau da: Im stärksten Zehntel verliert der Arm das **3,79-fache**
seines mittleren Dickenabfalls (`tools/fuenfschalen/kontur.ts`).

Ihn auszulaufen ist gebaut, gemessen und **wieder zurückgenommen**. Eine einzige
Glättung über die ganze Ferse (`w = t²·(3−2t)`) bringt den Absatz auf **1,68** —
und kostet dem **Zylinderauge seinen Sitz im Guss**: Es steht danach **60 statt
26 mm** vor dem `06_ZINKEN`. Genau diese Eigenschaft hat E-013 erkämpft, als die
Konsole abgeschafft wurde („der Zinken und dieser Metallblock, das ist
eigentlich EIN Gusselement"). Eine Entscheidung vom 14.09. aufzuheben und dabei
eine vom 14.09. zu brechen ist kein Fortschritt. Die Schulter gehört in ein
Paket mit der Anlenkung; beide Zahlen stehen jetzt im Quelltext.

**Die Querschnittsstufe am Zahnsitz bleibt auch — und sie ist kein Knick.**
Gemessen an der Aussenkontur über dem Schalenkreis läuft die Linie am Sitz mit
**0,94°** durch; das ist das Eigenrauschen des Verfahrens. Die Stufe sitzt
INNEN: Die Schale endet mit 98,5 mm (Blech plus Strebe), der Zahn beginnt mit
38 mm. Das ist die Trennfuge eines auswechselbaren Verschleißteils, und E-013
beschreibt sie selbst so („der Zahn wird abgeschraubt und ersetzt, wenn er
runter ist"). Den Zahn auf den vollen Querschnitt zu setzen hieße, seine Spitze
von 20 auf 51 mm zu verdicken — das widerspräche der Ansage vom 13.09.
(„Kantenschutz, keine Schneide"). **Das ist eine Formfrage für Patrick, keine
Reparatur.**

**Der Wächter gegen den Knick.** Neu: `test/zahnkontur.test.ts`, 7 Prüfungen auf
zwei Ebenen — an der Zahl (`zahnAnstellung()` ist null) und am gebauten Netz
(Aussenkontur über dem Schalenkreis, Ausgleichsgeraden vor und hinter dem Sitz).
Jede Schranke hat eine Gegenprobe, die MELDEN muss:

| | gemessen |
|---|---|
| gebaut (tangential) | **0,94°** |
| GEGENPROBE: Stand vor E-069 (−12,15°) | **11,90°** |
| GEGENPROBE: doppelt gegengedreht (−24,29°) | **24,62°** |

Die Schranke steht auf **4°**. Sie lässt den gebauten Stand mit gut dem
Doppelten seines Rauschens durch und meldet den alten dreifach sicher. Und die
Gegenprobe wächst MIT dem Knick, statt nur anzuschlagen — beide gemessenen Werte
treffen den eingestellten Winkel auf ein Grad. *Die erste Fassung der Messung
hat den Knick VERKEHRT HERUM gemeldet (8,46° für die glatte Form, 3,44° für die
geknickte), weil sie längs der Zahnbahn maß — und die dreht sich mit. Der
Schalenkreis steht fest; das ist der Bezug.*

**Verworfene Alternative.** Variante C bauen und die beiden Wächter „Neigung
unter 25°" und „Hebelarm > 0,115 über den ganzen Weg" nachziehen. Das ist der
Fehler, vor dem diese Wächter selbst warnen: „Weit gesetzte Grenzen hätten den
Umbau nicht bemerkt."

**Abnahmekriterium.** `npm test` grün — **1.075 Tests in 94 Dateien** (vorher
1.068 in 93). `npm run build` grün. **Die Sichelkralle ist nachweislich
unangetastet:** Abdruck vor und nach dem Umbau, `tools/greifer-abdruck.ts` gegen
`greifer-abdruck-vergleich.ts` — 112 Netze in gleicher Reihenfolge, **10.330
Werte** (5.020 Bewegung, 110 Kollider, 5.200 Korb), **größter Unterschied
0,000e+0**.

**Auf dem Gerät zu prüfen.**

1. Mit dem Fünfschalengreifer ein **flaches Blech vom Beton** aufnehmen. Er
   setzt jetzt 4,4 cm tiefer ab und schließt 19,4 statt 25,2 cm über dem Boden,
   und sein Korbboden reicht 1,4 cm weiter herunter. Geht es leichter als
   heute Nachmittag — oder stört es immer noch?
2. Den Greifer **ganz aufmachen** und von der Seite ansehen: Der Zahn hängt
   jetzt 12° nach innen statt lotrecht. Stört das beim **Einstechen in den
   Haufen**? Das ist der ganze Preis von B.
3. Den Übergang **Schale → Zahn** ansehen (Vorschau `/greifer.html`, Greifer
   offen): Ist der harte Knick weg? Die Kontur läuft jetzt durch; die
   verbleibende Stufe innen ist die Trennfuge des auswechselbaren Zahns.
---

### E-070 — Was mitfährt, wird gewogen und bezahlt: ein Fenster statt drei (15.09.2026)

**Entscheidung.** Die Frage „liegt dieses Stück auf der Ladefläche?" wird in
`src/delivery/vehicles.ts` nur noch **einmal** beantwortet
(`aufDerFlaeche()`). Verriegeln für die Fahrt, Ausfahrtswiegung und Verkauf
fragen dieselbe Stelle; maßgeblich ist das Fenster des Verriegelns
(|x| ≤ 1,70 m · z −0,40 … L+0,40 m · y −0,40 … 3,00 m über dem Blech).

**Anlass.** Patrick am Gerät, 15.09.2026: „Also ich habe gerade einen Abholer
kommen lassen mit Stahlschrott, der ist auch abgefahren, aber es hat sich weder
am Kontostand noch was geändert, noch sind danach noch Händler gekommen und es
stand auch 0 Tonnen umgeschlagen."

**Was gemessen wurde, bevor etwas gebaut wurde.** Neu ist
`v1/tools/abholung-abrechnung.ts`: Es **fährt** eine ganze Abholung kopflos —
Wagen für Stahlschrott rufen, Stahl über die Physik auf die Fläche fallen
lassen, mit V losschicken — und schreibt in jedem Schritt mit, was
`containedItems()`, `ladeflaecheKg()` und `sellContainer()` sagen. Nullprobe
zuerst: ein Abholer ohne Ladung muss 0 kg, 0 € und „Container war leer"
bringen; sonst bricht das Werkzeug ab.

**Befund 1 — die gemeldete Kette ist heil.** Vier vollständige Abholungen, auf
dem nackten Platz und auf dem Platz wie beim Neuen Spiel (Behälter,
Starthaufen, Altautos, Platzinventar), dazu eine mitten im laufenden
Anlieferbetrieb:

| Fall | auf der Fläche | verkauft | Konto | Umschlag |
|---|---|---|---|---|
| Nullprobe, leer | 0 kg | 0 kg / 0,00 € | 5000,00 → 5000,00 | 0 kg |
| 3 Teile | 455 kg | 455 kg / 113,75 € | 5000,00 → 5113,75 | 455 kg |
| 6 Teile | 1500 kg | 1500 kg / 375,00 € | 5000,00 → 5375,00 | 1500 kg |
| 6 Teile, voller Platz | 1500 kg | 1500 kg / 375,00 € | 5000,00 → 5375,00 | 1500 kg |
| 6 Teile, im Betrieb | 1500 kg | 1500 kg / 375,00 € | 1050,08 → 1425,08 | 1500 kg |

`containedItems()` und `ladeflaecheKg()` sind in allen Fällen auf das Kilogramm
gleich — der blinde Fleck aus E-064 ist hier **nicht**.

**Befund 2 — dafür ein anderer, und es ist dieselbe Fehlerklasse.** Drei
Stellen beantworteten dieselbe Frage, und zwar verschieden:

```
verriegeleLadeflaeche()  |x| < 1,70   z −0,40 … L+0,40   y −0,40 … 3,00
ladeflaecheKg()          |x| < 1,85   z −0,50 … L+0,50   y −0,40 … 5,00
containedItems()         |x| < 1,60   z −0,30 … L+0,30   y −0,40 … 2,60
```

Punktprobe an neun Stellen der Mulde, gemessen mit dem Werkzeug; **fünf davon
bekamen zwei verschiedene Antworten**:

| Lage (im System der Fläche) | fährt mit | gewogen | bezahlt |
|---|---|---|---|
| mitten drin | ja | ja | ja |
| auf der Bordwand, x 1,50 | ja | ja | ja |
| **auf der Bordwand, x 1,65** | **ja** | **ja** | **nein** |
| auf der Bordwand, x 1,80 | nein | **ja** | nein |
| **auf der Heckklappe, z −0,35** | **ja** | **ja** | **nein** |
| **an der Stirnwand, z L+0,35** | **ja** | **ja** | **nein** |
| **oben auf dem Haufen, y 2,80** | **ja** | **ja** | **nein** |
| turmhoch, y 4,00 | nein | **ja** | nein |

Ein Blech auf der Bordwandkante wurde also an die Fläche gekoppelt, fuhr mit,
stand auf dem Lieferschein der Ausfahrtswiegung — **und war beim Verkauf nicht
dabei**. Es verließ den Hof, ohne bezahlt zu werden. Das ist die Klasse von
E-044 („`loadCargo` überschrieb statt zu füllen") und E-064 („zwei Rechnungen
über dieselbe Ladung, nur eine repariert"), zum dritten Mal an einem Tag.

**Die Regel dahinter ist jetzt ein Satz: Was mitfährt, wird gewogen und
bezahlt.** Maßgeblich ist deshalb das Verriegelungsfenster und nicht das
weiteste: Ein Stück, das nicht gekoppelt wird, bleibt beim Anfahren liegen — es
darf folglich weder auf die Waage noch auf die Rechnung. Nach dem Umbau
antworten alle neun Punkte dreimal dasselbe. Nebenbei wird die Weltmatrix der
Fläche vor jeder Abfrage frisch gerechnet; im Spiel besorgt das sonst der
Renderer, beim Messen und im Test niemand.

**Verworfene Alternative.** Nur `containedItems()` auf die Maße von
`ladeflaecheKg()` bringen. Verworfen: Dann würde verkauft, was gar nicht
mitfährt (der Fall „turmhoch" — gewogen und bezahlt, liegt danach noch auf dem
Hof). Drei Zahlenpaare nebeneinander stehen zu lassen und zu pflegen, war die
Ursache; mehr davon ist keine Lösung.

**Wächter.** `test/abholungAbrechnung.test.ts` (neu, 5 Fälle): die Nullprobe;
eine **vollständige Abholung mit Geld** (1500 kg → Konto + 375,00 € auf den
Cent, Umschlag + 1500 kg, `pickups` 1, alle sechs Teile vom Platz verschwunden);
die Punktprobe an den neun Stellen; und zwei Gegenproben — eine absichtlich
falsch gezählte Ladefläche (ein Teil unterschlagen) **muss** an den Schranken
auffallen, und die Punktliste muss beide Antworten treffen, nicht nur eine.
Nachgewiesen: Setzt man allein `containedItems()` auf sein altes Fenster
zurück, wird der Wächter rot mit „auf der Bordwand, halb drüber: fährt mit
true, gewogen true, bezahlt false".

**Zahlen und ihre Herkunft.** Die drei Maße sind die bisherigen des
Verriegelns (`vehicles.ts`, seit E-034); 0,25 €/kg Stahl aus
`materials/catalog.ts`; 0,16 €/kg Ankauf und 5.000 € Start aus
`economy/account.ts` (Briefing Kap. 10). Keine Zahl der Wirtschaft ist
angefasst.

**Abnahmekriterium.** `npm test` grün (**1073 Tests in 94 Dateien**),
`npm run build` grün.

**Auf dem Gerät zu prüfen.**

1. Eine Abholung für **Stahlschrott** rufen, die Mulde **bis über die
   Bordwandkante** vollladen und mit **V** wegschicken: Stimmt der Betrag in
   der Verkaufsmeldung mit dem überein, was die Waage zwei Meter weiter als
   „abgeholt" nennt?
2. Ein Blech **quer auf die Heckklappe** legen und losschicken: Fährt es mit —
   und steht es im Erlös?
3. Einen Abholer **leer** wegschicken: Kommt „Container war leer — der LKW
   fährt umsonst", und bleibt das Konto stehen?

---

### Befund zur Sackgasse — ohne Eingriff, nur Zahlen (15.09.2026)

Kein Entscheid, sondern eine Messung zum zweiten Teil derselben Ansage („noch
sind danach noch Händler gekommen"). **Am Kreislauf wurde nichts geändert**
(Ansage Patrick: „Kreislaufsachen noch nicht"); Startkapital, Preise und
Grenzen stehen unverändert.

**Zwei Tore, und ein drittes, das keines sein will.** Anlieferer kommen nur,
wenn `shift.acceptsDeliveries` (Platz nicht dicht) **und** `account.canBuy`
(über −1.500 €) — und wenn gerade **kein Fahrzeug** auf dem Platz steht: Der
Platz ist einspurig (E-029), `VehicleManager.update` startet niemanden, solange
`active` gesetzt ist. Gemessen (`tools/hofstille.ts`): Auf freiem Hof mit
offenem Tor steht der nächste Wagen **34,4 s** nach der Abfahrt des Abholers
vor der Waage — Stille danach ist also nie normal.

**Wie weit ist es bis zur Sackgasse?** Gemessen im laufenden Betrieb
(`tools/abholung-abrechnung.ts`, zwei Läufe zu je drei Fuhren): eine
Anlieferung wiegt im Mittel **8.260 kg** und kostet bei 0,16 €/kg **1.321,60 €**.

| Marke | Rechnung | Fuhren | Spielzeit |
|---|---|---|---|
| Konto auf 0 € | 5.000 / 1.321,60 | **3,8** | ~8 min |
| Konto auf −1.500 € (Tor zu) | 6.500 / 1.321,60 | **4,9** | ~10 min |
| Platz dicht (16.000 kg lose) | 16.458 kg gemessen | **2** | ~4 min |

**Das erste Tor, das zufällt, ist nicht das Konto, sondern der Platz.** Nach
zwei Fuhren lagen 16.458 kg lose — über `JAM_KG` (16.000 kg). Wieder auf geht
es unter `JAM_CLEAR_KG` (11.000 kg), also nach 5.458 kg. In eine Abholmulde
gehen gemessen **20.000 kg** (80 Stück à 250 kg, alle blieben liegen und alle
wurden bezahlt) — **eine einzige gut gefüllte Abholung räumt den Stau.** Beim
Konto war in denselben Läufen nie Schluss: 1.018 € bis 1.425 €, `canBuy` immer
wahr.

**Kommt der Spieler wieder heraus?** `moneyEur` wächst an genau einer Stelle
(`Account.sellContainer`, account.ts:158) — es gibt keine zweite Einnahme.
Solange etwas Verkäufliches herumliegt, ist die Rettung also immer da, und die
Bestell-Liste zeigt genau das an (`main.ts`, nur Fraktionen mit kg > 0).
**Endgültig wird es nur auf einem Weg: schlecht verkaufen.** Der Erlös ist
kg × Preis × Reinheit³, der Ankauf 0,16 €/kg — der Gewinnpunkt für Stahl liegt
bei ∛(0,16 / 0,25) = **86,2 % Sortenreinheit**. Darunter ist jede Fuhre ein
Verlust: bei 50 % bringen 8.260 kg nur 258,13 € statt 2.065,00 €, macht
−1.063,47 € je Fuhre. Nach **6,1 solchen Fuhren** steht das Konto bei −1.500 €
**und der Platz ist leer** — ab da kommt niemand mehr, und es gibt nichts mehr
zu verkaufen. Das ist die einzige echte Sackgasse, und sie ist erarbeitet, nicht
zufällig.

**Erscheint die Warnung zuverlässig?** Ja, die Flanke stimmt:
`zahlungsUnfaehig` wird vor der Bildschleife auf `false` gesetzt (main.ts:777),
der Kontostand kommt schon beim Aufbau aus dem Spielstand (main.ts:143) — beim
**ersten Bild nach dem Laden** feuert die Meldung. Einen Schichtwechsel gibt es
nicht; `Shift` kennt keinen Tag (siehe `world/platzinventar.ts`). **Die
Schwäche liegt woanders:** „Konto leer" ist ein **Toast**, also flüchtig,
während der Zustand dauerhaft ist. Für „Platz dicht" gibt es eine stehende
Zeile im HUD (`shift.statusText`), für die Zahlungsunfähigkeit nichts;
`Account.lowOnCash` (< 800 €) ist gebaut und wird nirgends benutzt.

**Was ich NICHT entschieden habe** (Vorlage, kein Eingriff):
1. Ob die Zahlungsunfähigkeit eine stehende HUD-Zeile bekommt wie der Stau.
2. Ob `JAM_KG`/`JAM_CLEAR_KG` zu den gemessenen 8,3 t je Fuhre passen — zwei
   Fuhren bis dicht ist eng.
3. Ob ein Anlieferer, der nie abgeladen wird, nach einer Standzeit selbst
   abfährt. `waitUnload` hat keine Frist; im kopflosen Lauf stand eine Pritsche
   10 Minuten und hielt eine vorgemerkte Abholung auf.

---

### E-071 — Das gelbe Anbauteil war nicht gelb und nicht sichtbar; und Ballen zeigen jetzt, was in ihnen steckt (15.09.2026)

**Auftrag.** Zwei Punkte aus Patricks Gerätetests (`docs/offene-punkte.md`):
„Gelbes Anbauteil der Presse verdeckt die Ballen und stört beim Greifen" und
„Ballen sehen zu sauber aus — Fransen, Reste der Ursprungsform,
unterschiedliche Farben." Erst messen, dann entscheiden.

#### Teil A — was das gelbe Teil ist

**Es gibt es nicht mehr.** Die Presse hatte drei grosse gelbe Stücke: den
Warnbalken auf der Muldenkante, das durchgehende Scharnierrohr und den
Stempelbock am Kammerende. Alle drei sind am **12.09.2026** auf Patricks
eigene Ansage hin entfernt worden („der gelbe Balken da, der kann sowieso
weg"); die Kommentare dazu stehen in `press.ts`. Der Eintrag in
`offene-punkte.md` stammt vom **11.09.** und ist beim Anlegen von `v1/` am
14.09. unverändert mitkopiert worden — niemand hat ihn abgehakt. Nachgesehen:
Auch im eingefrorenen `prototype/` ist kein gelbes Teil mehr an der Maschine.
An der ganzen Presse ist heute kein Farbwert gelb.

**Im Weg stand trotzdem etwas — und zwar etwas Unsichtbares.** Kopflos
gemessen (Presse aufgebaut, alle Netze und alle Rapier-Kollider ausgelesen):

| | Netze | Kollider |
|---|---|---|
| vorher | 32, davon **4 unsichtbar** | 8 |
| nachher | 28 | 7 |

Der eine Kollider zu viel war die **zweite Deckelklappe**. Seit dem 12.09.
baute `makeLid` sie als Attrappe: Platte auf 1 mm geschrumpft, alle vier Netze
auf `visible = false`. Der **Kollider** aber wurde unverändert in voller Grösse
angelegt — 4,45 × 0,30 × 2,16 m. Im Ruhezustand (Klappe offen, also genau
dann, wenn der Spieler das Paket herausholen will) hing er auf

    x −6,88 … −4,83 · y 1,46 … 2,74 · z −28,23 … −23,77

und ragte damit **0,905 m weit in die Kammermündung** (die reicht von x −10,025
bis −5,975), auf der Seite, von der die Spinne kommt, und **0,74 m unter die
Wandkrone** hinab. Ein Hindernis, das man nicht sieht, kann der Spieler nicht
einmal beschreiben — er merkt nur, dass „irgendwas stört".

**Wie sehr es störte, in einer Zahl.** Die grösste freie Quadratkante in der
Kammermündung, gemessen am geparkten Stempel vorbei:

| | freie Kante | offene Sichelkralle 3,381 m | Freigang je Seite |
|---|---|---|---|
| vorher | **3,14 m** | passt nicht | **−0,12 m** |
| nachher | **3,62 m** | passt | **+0,12 m** |

Die offene Kralle kam also nicht in die Kammer, ohne die Geisterklappe zu
berühren; sie fehlte um 24 cm. Ohne den geparkten Stempel gerechnet sind es
4,04 m, also 0,33 m je Seite.

**Was es NICHT war.** Die Sicht auf die Ballen nimmt nicht das Anbauteil,
sondern die Wand. Vom Sitz (−0,5 | −22,5) mit abgesenkter Kabine
(Augpunkt 3,28 m, `containers.ts`) sind vom Kammerboden **0,0 %** zu sehen,
auf 0,90 m Höhe **0,0 %**, auf 1,50 m **6,4 %**, erst auf Höhe der Wandkrone
97,5 %. Nimmt man **alles** weg, was über die Wandkrone ragt — Klappe, Hebel,
Zylinder —, ändern sich die unteren drei Zahlen um **keinen Punkt**; nur auf
Kronenhöhe geht es von 97,5 auf 100 %. Das Anbauteil verdeckt also 2,5 % der
Mündung, die 1,90 m hohe Kammerwand verdeckt den Rest. Wer die Ballen sehen
will, muss die Kabine heben oder die Kammer niedriger bauen — das ist eine
Gestaltungsfrage, keine Reparatur, und sie gehört Patrick.

**Zweiter Befund derselben Messung: vier schwebende Riegel.** Die
Quer-Versteifungen der Klappe standen als feste Liste `[−4,2 … 4,2]` im Code —
aus der Zeit, als die Klappe 10 m lang war. Seit dem 14.09. misst sie 4,45 m.
Vier der sechs Riegel standen deshalb **neben** der Platte in der Luft: auf
z −21,80 und −30,20 (2,00 m daneben) und auf z −23,50 und −28,50 (0,28 m
daneben), alle auf 1,94 bis 2,93 m Höhe. Zwei dunkle Balken schwebten frei
hinter der Presse. Sie sitzen jetzt gerechnet auf der Platte (±0,371, ±1,113,
±1,854 m).

**Gebaut, in der verlangten Rangfolge.** Schmaler machen ging nicht — das Teil
hatte keine Breite, die man hätte kürzen können, es hatte gar kein Aussehen.
Versetzen ging nicht — es gehörte zu einer Klappe, die es seit dem 12.09. nicht
mehr gibt. Also **ganz weg**: kein Körper, kein Kollider, keine unsichtbaren
Netze. „Nur bei Bedarf einblenden" kam damit nicht in Frage.

**Nebenbei mitgenommen:** Der Klappenkörper entsteht jetzt an seiner Startpose
statt im Ursprung (v2 E-058) — vorher lag sein Kollider einen Rechenschritt
lang auf (0|0|0), also mitten unter dem Bagger.

**Nicht angerührt** (gemessen, gemeldet, nicht entschieden): Die drei
Winkelhebel der echten Klappe ragen bei offener Klappe 0,315 m über die
Kammerkante, das Scharnierrohr 0,075 m — beide auf der **baggerabgewandten**
Westseite und **ohne Kollider**, sie halten also nichts auf. Zusammen sind das
die erwähnten 2,5 %.

#### Teil B — wie Ballen jetzt gebaut werden

**Farben und Fransen waren schon da** (12.09.). Nachgeprüft und mit Wächtern
festgenagelt: Ein Kupferballen trägt genau `0xc7622b` aus
`materials/catalog.ts`, ein Alupaket `0x928d85` — dieselben Werte, die
`metallton()` in `objektbau.ts` benutzt (E-067), es gibt hier also keine zweite
Wahrheit. Ein gemischt gepresstes Paket wird **nicht** einfarbig: Seine Flecken
kommen aus `composition`, nach Masse gewichtet, nicht aus dem Zufall.

**Gefehlt hat die Ursprungsform.** Neu: Jede Fraktion mit mindestens **einem
Sechstel** der Paketmasse zeigt ein Stück von sich, höchstens zwei Fraktionen
je Paket (`resteFuerPaket`). Vier Formen decken alles ab, was der Platz kennt:

- `blech` — Karosserie- oder Gehäuseblech, einmal geknickt (32 Ecken)
- `rohr` — Rohrstummel, offener Achtkant (18 Ecken)
- `felge` — Ring: Felge, Trommel, Riemenscheibe (18 Ecken)
- `profil` — Kantstück: Winkel, Vierkantrohr, Latte (24 Ecken)

Welche Form eine Fraktion zeigt, steht datengetrieben in ihrem `Pressprofil`:
Kupfer zeigt Rohre, Stahl Bleche und Winkel, Alu Felgen. Kabel, Reifen,
Batterien und Bauschutt zeigen **nichts** — an einem Kabelknäuel oder einem
Reifenballen ist keine Form mehr zu erkennen, und eine zu behaupten wäre
gelogen. Die Farbe des Rests ist die Farbe seiner Fraktion, nicht die des
Pakets: Ein Mischpaket aus Stahl und Kupfer zeigt ein graues Blech **und** ein
kupfernes Rohr.

**Der Preis, gemessen.** Alles wandert in dieselbe verschmolzene Geometrie wie
Körper und Fransen (E-025) — Fransen und Reste als eigene Körper wären
verboten, und sie sind auch keine.

| je Ballen | vorher | nachher |
|---|---|---|
| Netze (= Zeichenrufe) | **1** | **1** |
| Eckpunkte, Schnitt über 6 Fraktionen × 40 Würfe | 384 | **408** |
| Dreiecke | 287 | **304** |
| Überstand über den Kollider-Quader | nur Fransen | 10 bis 22 % der längsten Kante |

Zehn Ballen auf dem Platz: **10 Zeichenrufe** (unverändert), 3 830 → 4 081
Eckpunkte, 2 870 → 3 044 Dreiecke. Gegen die gemessenen 1 322 Zeichenrufe und
240 000 Dreiecke je Bild sind das 0,8 % der Zeichenrufe und 1,3 % der Dreiecke;
der Zuwachs beträgt 174 Dreiecke, also **0,07 % eines Bildes**. A/B am selben
Code-Pfad gemessen (sieben gleich starke Anteile liegen je bei 14,3 % und damit
unter der Schwelle — dasselbe Paket, nur ohne Reste): +21 bis +30 Ecken je
Paket, bei einem Mischpaket mit zwei Resten +50.

**Verworfene Alternative.** Die Reste als eigene Meshes an die Ballen zu
hängen wäre einfacher gewesen und hätte aus einem Zeichenruf drei gemacht —
bei zehn Ballen dreissig. Netze sind der Engpass, nicht Dreiecke.

#### Wächter, jeder mit Gegenprobe

`test/presseKammer.test.ts` (4 Prüfungen)
- Kein Kollider ragt unsichtbar in die Kammermündung.
  **Gegenprobe:** derselbe Prüfcode bekommt die gemessene Geisterklappe von
  vorher vorgelegt und meldet sie.
- Die offene Sichelkralle passt am geparkten Stempel vorbei in die Kammer.
  **Gegenprobe:** mit der Geisterklappe fällt die freie Kante unter die
  Krallenspanne, der Wächter schlägt an.

`test/ballen.test.ts` (8 Prüfungen)
- Ein Paket ist EIN Netz und bleibt unter 750 Eckpunkten (gemessen höchstens
  658 über 200 Würfe). **Gegenprobe:** der Zähler meldet ein Paket aus zwei
  Netzen und ein Netz mit 3 362 Ecken.
- Ein sortenreines Paket trägt genau die Katalogfarbe seiner Fraktion; ein
  gemischtes trägt die Farben seiner Zusammensetzung und ist nicht einfarbig.
  **Gegenprobe:** der Farbprüfer meldet Einfarbigkeit, eine fremde Farbe und
  ein farbloses Netz.
- Welche Reste erscheinen, folgt der Masse. **Gegenprobe:** die Schwelle greift
  genau am Sechstel — 17,0 % zeigt sich, 16,0 % nicht; vier gleich starke
  Fraktionen ergeben zwei Reste, nicht vier.
- Der Rest ragt sichtbar heraus, aber bleibt am Paket (gemessen 10 bis 22 %
  der längsten Kante).

#### Zahlen und ihre Herkunft

- Kammermündung x −10,025 … −5,975, z −28,10 … −23,90, Wandkrone 2,20 m —
  gerechnet aus `PRESS_CENTER`, `PRESS_KAMMER`, `WALL_H` in `press.ts`.
- Augpunkt 3,28 m bei abgesenkter Kabine — `AUGPUNKT_UNTEN`, `containers.ts`
  (Quelle: `excavator.ts`, `cabGroup.y` 1,60 + Augpunkt lokal 1,68).
- Offene Sichelkralle 3,381 m — `clawSpan(CLAW_OPEN_SPLAY)`.
- Riegelabstände ±0,371, ±1,113, ±1,854 m — `lidLen` 4,45 m in sechs gleiche
  Felder geteilt, Riegel auf den Feldmitten.
- Rest-Schwelle ein Sechstel und höchstens zwei Reste je Paket — **SW,
  15.09.2026**; begründet im Quelltext: Bei sechs gleich starken Fraktionen
  liegt jede bei 16,7 %, die Schwelle markiert also die Stelle, an der eine
  Fraktion aufhört, Beimischung zu sein.
- Rest-Maße (Rohr Ø 0,20 × 0,62 der Würfelkante, Felge Ø 0,54 × 0,13, Profil
  0,11 × 0,11 × 0,72, Blech 0,52 × 0,035 × 0,40 mit 0,14 Knick) — **SW,
  15.09.2026**, am Netz nachgemessen in `test/ballen.test.ts`.
- Eckendeckel 750 je Paket — gemessen 658 im teuersten Fall (Kabelpaket),
  15 % Luft darüber.

#### Abnahmekriterium

`npm test` 1 092 Prüfungen in 97 Dateien grün, `npm run build` grün.

#### Auf dem Gerät zu prüfen

1. **Presse leerräumen.** Eine Fuhre pressen, dann mit offener Spinne von oben
   in die Kammer und das Paket herausholen — von der Baggerseite her. Bleibt
   die Kralle noch irgendwo an etwas hängen, das man nicht sieht?
2. **Hinter die Presse schauen** (Ansicht mit C auf Orbit, um die Maschine
   herum): Schweben dort noch dunkle Balken frei in der Luft?
3. **Zwei Ballen vergleichen** — einen sortenreinen Kupferballen und einen aus
   gemischter Fuhre. Sieht man dem gemischten an, was drin war? Sind die Reste
   zu gross, zu klein, zu viele?
### E-072 — Zwei Blätter statt einer Behauptung: was E-069 gebaut hat, und was die Mittelsäule kostet (15.09.2026)

**Entscheidung.** Zwei Zeichnungen und ein Wächter. **Am Spielcode ist keine
Zeile geändert** — `src/` ist unberührt, der Fünfschalengreifer und die
Sichelkralle stehen, wie sie standen. Die Mittelsäule wird **nicht** weggebaut;
was ihr Wegfall kostet, steht als Zahl auf dem zweiten Blatt und geht als
Entscheidung an Patrick zurück.

    docs/f5-zahn-vorher-nachher-2026-09-15.svg   was E-069 wirklich gebaut hat
    docs/f5-mittelsaeule-2026-09-15.svg          was es kostet, die Säule wegzunehmen

**Anlass, wörtlich.** Patrick am Gerät, 15.09.2026: „Also, wir sind uns doch
einig, dass die Zacken direkt an der Traverse sein sollen. Und das ist aktuell
nicht der Fall. Deshalb weiß ich überhaupt nicht, woran der Agent gearbeitet
hat. Zeigt mir einen Vorher-Nachher-Vergleich."

**Er hat in beiden Punkten recht, und beide Punkte sind verschiedene Dinge.**

---

#### 1. Was E-069 gebaut hat — und warum man es kaum sieht

Gebaut wurde **eine Zahl**: In `zahnAnstellung` ist der Term
`+ zahnEigenwinkel()` weggefallen. Der Zahn sitzt seither tangential auf dem
Schalenende. Das ist richtig gebaut, es ist gemessen, und es ist **klein**:

| gemessen am gebauten Netz | vorher | nachher |
|---|---|---|
| Zahn gegen das Schalenende | −12,15° | **0,00°** |
| Schwebehöhe geschlossen | 23,8 cm | **19,4 cm** |
| Maulweite offen | 3,176 m | 3,095 m |
| Korbtiefe geschlossen | 0,9792 m | 0,9792 m (unverändert) |
| Zahnwinkel bei Bodenkontakt | 34,2° | 23,5° |

**Die ehrliche Größe des Unterschieds**, und sie steht so auf dem Blatt: Die
**Zahnspitze wandert 41 mm**. Vom ganzen Greifer sind **98,5 % deckungsgleich**
mit vorher (offen; geschlossen 99,9 %). **Vom Zahn allein nur 21,5 %** — dort
ist es ein großer Unterschied, nur ist der Zahn 25 cm an einem 3,2-m-Gerät.

Das Blatt zeigt deshalb drei Spalten: VORHER, NACHHER und **ÜBEREINANDER**. In
der dritten liegt das Gemeinsame hell im Hintergrund, und nur was sich
unterscheidet, ist dunkel bzw. blau. Der erste Entwurf legte die beiden Risse
halbdurchsichtig übereinander — die später gezeichnete Form deckte die frühere
zu, und der Unterschied **verschwand**. Genau das wäre das geschönte Blatt
gewesen, das den Verdacht bestätigt statt ihn auszuräumen.

---

#### 2. Die Mittelsäule — gerechnet, nicht gebaut

**Das Maß, um das es geht:** `TRAVERSE_Y` = −0,865, `STEMPEL_AUGE.y` = −1,5335,
dazwischen **66,9 cm**. Davon sind **26 cm der Stempelkörper** (er trägt die
fünf Ausleger, `MASS.stempel.hoehe`) und **40,9 cm das Säulenrohr `09_SAEULE`**.

**Der Korb ändert sich NICHT.** Er hängt am Bolzen und geht mit ihm mit —
gemessen, nicht behauptet, am gebauten Netz mit angehobenem Schalengelenk:

| unter dem Bolzen gemessen | heute | ohne Säule |
|---|---|---|
| Tiefe geschlossen | 0,9792 m | 0,9792 m |
| Schwebehöhe | 0,1943 m | 0,1943 m |
| Maulweite offen | 3,0946 m | 3,0946 m |
| Hüllkreis | 3,2262 m | 3,2262 m |

**Die Bauhöhe fällt von 2,707 auf 2,039 m** — der Greifer wird 66,9 cm kürzer.
**Die Reichweite kostet das nichts:** Am kopflos gebauten Bagger abgetastet
(Ausleger 5…70°, Stiel −140…−25°, je 0,5°) kommt der Zahn in beiden Fällen
zwischen **2,9 und 9,5 m** auf den Beton.

**Was bricht, ist die ANLENKUNG.** Der Zylinder greift von der Traverse aus an
der Schale an; rückt der Bolzen zur Traverse, sitzen Angriffspunkt und
Drehpunkt praktisch auf derselben Höhe:

| Bolzen steigt um | Neigung max | Hebelarm min | Zylinder zu → offen | Wächter |
|---|---|---|---|---|
| 0 cm (heute) | 24,42° | 118 mm | 1,046 → 0,670 m | hält |
| 2 cm | 24,98° | 120 mm | — | hält |
| 3 cm | 25,27° | 121 mm | — | **reißt** |
| 66,9 cm (an der Traverse) | **89,7°** | 96 mm | 0,483 → **0,179 m** | reißt |

**Der Bolzen darf 2,0 cm steigen — 3 % der Säule.** Dann reißt „Neigung unter
25°", der engere der beiden Wächter, die E-039 erkämpft hat. **Die Wächter sind
nicht nachgezogen worden**; sie stehen unverändert auf 25° und 0,115 m. Ganz
oben wäre der Zylinder offen **0,179 m** lang — sein Rohr allein misst 0,420 m.
So ein Zylinder lässt sich nicht bauen.

**Zwei weitere Kosten, gemessen:**

- **Der Schlund wird zugebaut.** In der Ebene 5 cm über den Bolzen versperrt
  der Kopf heute **3.822 cm²** (Stempelkörper Ø 0,46 + fünf Ausleger); mit dem
  Bolzen an der Traverse **5.265 cm²**, weil dort dann die Traverse Ø 0,95
  steht — das 1,38-fache. **Genau dieses Maß war am 14.09.2026 der Grund, die
  Säule zu KÜRZEN.** Der Umbau macht es wieder größer.
- **Die Schalen kommen der Traverse auf 6 mm nahe** statt auf 86 mm
  (3-cm-Punktraster, engste Stelle bei 95 % Öffnung — Größenordnung, nicht
  Millimeter). **Untereinander** ändert sich dagegen **nichts**: Alle fünf
  steigen um denselben Betrag, ihr Sektor bleibt 26,3° von 36°.

**Die offene Frage, die nur Patrick beantworten kann.** Soll statt des Bolzens
die **Traverse zum Bolzen herunter**? Dann bleibt die Anlenkung, wie sie ist,
der Greifer wird trotzdem kürzer — und der Kopf wandert in den Korb hinein. Das
ist ein eigenes Blatt und eine eigene Rechnung.

---

**Verworfene Alternative.** Die Säule wegnehmen und die Wächter nachziehen. Das
ist der Weg, auf dem eine erkämpfte Zahl still verschwindet: E-039 hat die
Traverse umgebaut, um 0,118 m Hebelarm und 24,4° zu bekommen; ein nachgezogener
Wächter hätte den Verlust nicht gemeldet, sondern zugedeckt.

**Werkzeuge.** `tools/schattenriss.ts` (Riss, Flächenvergleich, Dreiteilung in
„nur A / nur B / beides") und `tools/fuenfschalen/zahnformen.ts` (die drei
Formen A/B/C und ihre Messung) sind aus `zahnknick.ts` **herausgelöst**, damit
das neue Blatt aus derselben Quelle rechnet. **Gegenprobe zur Herauslösung:**
`zahnknick.ts` erzeugt danach eine **Byte für Byte identische** Datei (390.417
Zeichen, verglichen).

**Abnahmekriterium.** `test/mittelsaeule.test.ts`, 7 Prüfungen, **jede
Zahlenschranke mit Gegenprobe, die meldet** (nachgestellt):

- Zahnspitze wandert 41 mm (Fenster 35…47 mm). Gegenprobe: ein halber Knick
  liefert 20,2 mm und fällt durch; dieselbe Form gegen sich selbst liefert 0.
- Die Anlenkungsrechnung trifft `rig.ts` auf 5,6e−17. Gegenprobe: 1 mm
  Bolzenversatz ergibt 9,1e−5 — die Prüfung ist nicht blind.
- Heute halten beide E-039-Wächter; an der Traverse reißen sie (89,7° > 25°,
  Zylinder kürzer als sein Rohr).
- Der Bolzen darf zwischen 1,5 und 3,0 cm steigen (gemessen 2,0).
- Der Korb ist unter dem Bolzen unverändert. Gegenprobe: die **Welthöhe** muss
  sich um genau 0,6685 m ändern — sonst hätte das Heben gar nicht gewirkt und
  die fünf Zeilen darüber wären trivial gleich.

1.080 bestehende Prüfungen bleiben grün (jetzt **1.087 in 96 Dateien**).
`npm run build` sauber.

**Unangetastet.** `src/` vollständig. Sichelkralle und Fünfschalengreifer in
Form und Verhalten, Griff-Kern (Sensorkugel + Fixed Joint), Pendel, Rotator,
Kamera, Bodenanschlag. Die Mittelsäule steht.

**Zurückgestellt.** Das Seitwärtskippen des Greifers („zum Kehren und
Schleudern", E-065) — die Freigangmessung auf Dreiecksebene muss neu gemacht
werden, falls die Säule doch fällt.

**Auf dem Gerät zu prüfen.**

1. `docs/f5-zahn-vorher-nachher-2026-09-15.svg` aufrufen, **die dritte Spalte
   ansehen**: Erkennst du, was sich bewegt hat — und ist es wenig genug, dass
   der Eindruck „da ist nichts passiert" verständlich war?
2. `docs/f5-mittelsaeule-2026-09-15.svg`, die beiden Seitenrisse nebeneinander:
   Sieht der rechte (Bolzen an der Traverse) **richtiger** aus als der linke —
   obwohl Zylinder und Säule darin nachweislich falsch stehen?
3. Antwort auf die eine Frage: Bolzen hinauf zur Traverse (dann muss die ganze
   Anlenkung neu gerechnet werden) oder **Traverse herunter zum Bolzen** (dann
   bleibt die Anlenkung und der Kopf wandert in den Korb)?
### E-073 — Der Kipper-Katapult: die Fuhre fiel durch die Brücke, und der Löser schoss sie heraus (15.09.2026)

**Der Fehler, den Patrick seit dem 13.09. meldet, ist gefunden und behoben.**
Seine drei Sätze dazu waren alle wörtlich richtig und beschrieben denselben
Vorgang: „Teile fallen beim Kippen durch die Ladefläche", „das Material bleibt
auf dem Chassis und taucht unter der Ladefläche", „beim Kippen sind Teile ganz
woanders auf dem Platz gelandet, nicht mal in der Nähe vom LKW".

**Der Auftrag war eine keilförmige Brücke. Die war es nicht.** Patrick hat den
Auftrag verworfen, und das war richtig: „Der Kipper macht ja eigentlich nur was
relativ Einfaches, der kippt die flache Fläche so, und da müsste die Schwerkraft
einfach einsetzen … Und wenn der Kipper dazu führt, dass Teile einfach
eintauchen — und so schnell ist der Kipper gar nicht —, dann stimmt da ja was
grundlegend nicht."

**DIE ENERGIERECHNUNG, die das entscheidet, bevor man irgendetwas baut.** Die
Brücke braucht 4,2 s für 58°. Ihre Oberfläche bewegt sich dabei mit höchstens
0,241 rad/s × 6,0 m = 1,45 m/s; ganz aufgerichtet liegt ihr höchster Punkt
1,05 + 6,0 × sin 58° = 6,14 m über dem Boden. Mehr als
√(2 · 9,81 · 6,14) + 1,45 = 12,4 m/s — 45 km/h, 60 Joule je Kilogramm — kann ein
Stück aus diesem Vorgang nicht mitnehmen. Gemessen waren 585 km/h: 162 m/s,
13.200 Joule je Kilogramm. **Faktor 220.** Wo eine Bewegung das Zweihundertfache
ihres eigenen Energieinhalts abgibt, ist nicht die Form schuld.

**WAS BILD FÜR BILD ZU SEHEN IST.** Ein Stück liegt ruhig auf der Brücke
(Weltlage y 1,163, Oberkante des Kolliders 1,051, Geschwindigkeit 0,01 m/s). In
dem Bild, in dem `tipping` beginnt, fällt es los — und zwar im **freien Fall**,
Bild für Bild genau 9,81 m/s², durch den 0,60 m dicken Muldenboden hindurch.
Eine Strahlprobe nach unten trifft dabei den Muldenkollider in 0,000 m Abstand:
Das Stück ist mitten IM Kollider, und der Kollider ist eingeschaltet, kein
Sensor, an seinem Platz. Nach 0,45 s liegt die ganze Fuhre — alle vierzehn
Stücke — unter dem LKW auf dem Hof. Was auf dem Weg nach unten wieder gefasst
wird, drückt der Löser mit einem einzigen Stoß heraus: gemessen −65,7 m/s an
einem Stück, das 0,37 m tief steckte. **Das ist der Katapult: nicht das Kippen,
sondern die Entdurchdringung.**

**WORAN ES LIEGT — mit einem Schalter nach dem anderen eingegrenzt, jeder
gepaart über dieselben Ladungen:**

| Schalter | Wirkung |
|---|---|
| CCD an/aus (Mulde, Ladung) | keine |
| Rahmen weg, Bordwände weg | keine |
| ein Stück statt vierzehn | keine |
| Quader statt Bruchstück-Hülle, Reibung 0,5 statt 2,2, Dämpfung | keine |
| ein **frischer Ladungskörper** | keine |
| `m.update` überspringen, Mulde selbst drehen | keine |
| Kippen **zehnmal langsamer** | hält |
| **irgendeinen Kollider der Mulde anfassen** (`setEnabled`, `setHalfExtents`, `setTranslationWrtParent`) | **hält** |

Es ist also die **Paarung zwischen Muldenkollider und Ladung**, und sie ist
genau dann kaputt, wenn sie entstanden ist, während beide Körper kinematisch
waren. Auf der Fahrt ist die Fuhre an die Mulde verriegelt (`lockToBed`) —
kinematisch gegen kinematisch, dafür rechnet Rapier keine Berührungen. Wird die
Ladung am Halt wieder dynamisch, trägt die Mulde sie zwar (sie liegt ruhig),
aber sobald sich die Mulde **bewegt**, ist die Paarung weg. Einen Kollider
anzufassen setzt in Rapier sein Änderungskennzeichen: Er wird aus der Grobsuche
genommen und neu eingetragen, und die Paarung entsteht sauber neu.

**Nachweis, dass es genau daran liegt und nicht am Zeitpunkt:** Der Eingriff
gleich nach dem Erzeugen wirkt **nicht** (die Fuhre ist dann noch kinematisch),
beim Übergang nach `reverseIn` **nicht**, beim Freigeben der Ladung **ja**, beim
Übergang nach `tipping` wieder **nicht** — ein frisch eingetragener Kollider
braucht ein paar Schritte, bis die Berührung steht. Und eine synthetische
Nachstellung (kinematische Platte, dynamischer Klotz, gleiche Maße, gleicher
Ort, 1.400 Schritte Vorlauf, Typwechsel nachgespielt) erzeugt den Fehler
**nicht** — er hängt an der Vorgeschichte dieses Kolliders, nicht an der
Geometrie.

**DIE REPARATUR SIND ZEHN ZEILEN** (`vehicles.meldeMuldeNeuAn`, gerufen aus
`releaseCargo`): Beim Freigeben der Ladung werden die Kollider der Mulde einmal
ab- und wieder angeschaltet. Bis zum Kippen liegen 1,2 s; das reicht mit großem
Abstand. Kosten: zwei Kollider-Einträge je Fuhre.

**GEMESSEN, gewürfelte Händlerfuhre aus `rollCustomer()`, 24 Saaten, ganzer
Zyklus, nur dynamische Körper:**

| | Mittel | Median | Höchst | fällt durch | bleibt liegen | Endlage Mittel/Max |
|---|---|---|---|---|---|---|
| vorher | 147 | 123 | 430 km/h | 86 % | 4 % | 2,7 / **27,0 m** |
| nachher | **29** | **19** | **106 km/h** | **0 %** | 31 % | 3,1 / **5,8 m** |

Über 10 m vom LKW entfernt lagen vorher 8 von 265 Stücken, jetzt **keines**.
Damit ist auch Patricks „Teile sind ganz woanders gelandet" beantwortet: Sie
sind nicht versetzt worden, sie sind geflogen — 430 km/h sind 119 m/s, der Platz
ist 70 m lang.

**DER KEIL IST TROTZDEM GEBAUT — und er bringt nichts gegen den Katapult.**
Über 24 Saaten gepaart gegen den alten Quader: +6 ± 13 km/h bei der Prüfladung,
−37 ± 31 bei der Händlerfuhre, besser in 14 bzw. 12 von 24. **Das ist Rauschen.**
Er steht aus einem anderen, eigenen Grund da: Der alte Quader war 0,60 m dick
unter einem 0,12 m dünnen Blech — die Kollisionsfläche lag einen halben Meter
tiefer als das, was das Auge sieht. Am Heck folgt der Keil jetzt genau dem Blech
(0,12 m), vorn bleibt er bei 0,60 m, damit der Spalt zum Rahmen zu bleibt
(Unterkante −0,56, Rahmen −0,60). Nebenbei schwenkt seine Hinterkante beim
Kippen nur noch 0,12 × sin 58° = 0,102 m statt 0,509 m nach vorn, und der Sektor,
den sie unter sich überstreicht, schrumpft von 0,182 auf 0,0073 m². Herleitung
steht bei `brueckenKeilEcken` in `vehicleModel.ts`. **Wenn er stört, kann er
zurück** — die Reparatur hängt nicht an ihm.

**DER WÄCHTER IST UMGESTELLT** (offener Punkt 12, erledigt). `test/kipper.test.ts`
fuhr eine milde feste Prüfladung (5.000 kg, Füllgrad 0,60) und hielt 155/500
km/h, während derselbe Apparat mit der gewürfelten Händlerfuhre 159/585 maß —
über der eigenen Schranke. Er war grün und das Spiel kaputt. Jetzt fährt er die
Fuhre, die das Spiel würfelt (`spielFuhre()` über `rollCustomer()`), prüft vier
Eigenschaften statt einer (nicht durchfallen, nicht schleudern, in der Nähe
liegen bleiben, Brücke wird frei) und **jede Schranke hat eine Gegenprobe**:
Drei davon werfen denselben Prüfcode auf eine von Hand verbogene Reihe, die
vierte fährt dieselben Fuhren mit körperlos geschalteter Brücke und verlangt,
dass der Durchfall gemeldet wird. Der Laufapparat steht jetzt einmal da
(`test/kipperlauf.ts`), Wächter und `tools/kipper-messreihe.ts` benutzen ihn —
das war die Lehre aus E-062.

**WAS NICHT BEHOBEN IST, ZWEI DINGE, BEIDE GEMESSEN:**

1. **31 % der Fuhre bleiben auf der Brücke liegen** (vorher 4 %, aber nur, weil
   86 % vorher durchfielen). Das ist kein Physikfehler, sondern eine Rechnung:
   Schrott hat Reibung 2,2 (Regel MAX, „Schrott verhakt sich", `scrapItems.ts`),
   der Kipper hebt auf 58°, und tan 58° = 1,60 < 2,2. **Eine ruhende Fuhre
   rutscht auf dieser Neigung rechnerisch überhaupt nicht.** Was herunterkommt,
   kommt durch Kollern, Nachrutschen und das gekippte Anziehen herunter. Zwei
   Hebel, beide Gestaltungsfragen: steiler kippen (über 65,6° rutscht es von
   selbst) oder die Reibung senken (trifft den ganzen Haufen).
2. **Der LKW legt seine Ausrichtung in EINEM Schritt um bis zu 168,7° um**
   (gemessen am Wechsel `shiftPause` → `reverseIn`; an jeder Ecke der
   Fahrstrecke sind es 45–65°). `placeAt` setzt `group.rotation.y` hart auf die
   Streckenrichtung. Ein an die Mulde verriegeltes Stück in 3 m Abstand legt
   dabei rund 6 m in einem Bild zurück; Rapier leitet daraus über 1.000 km/h ab.
   Solange nichts im Weg liegt, ist das folgenlos. Liegt aber schon Schrott da,
   wird er getroffen: Ein zweiter Kipper über die Fuhre des ersten gefahren,
   12 Saaten — **6.596 km/h Höchstwert und bis zu 9,3 m Verschiebung an Material,
   das ruhig dalag**, Spitze in `reverseIn` (7 von 12) und `settleCargo` (5 von
   12). Das ist ein eigenes Paket und eine Gestaltungsfrage (der Wagen müsste
   einlenken statt zu knicken), deshalb hier nur gemessen und eingetragen.

**Verworfene Alternative.** Die keilförmige Brücke als *Lösung* — sie mildert
nichts Messbares (siehe oben) und hätte den Fehler stehen lassen. Ebenfalls
verworfen: den Quader dünner zu machen (E-062 hatte dafür −55 ± 19 km/h
gemessen); nachgerechnet war auch das nur eine andere Ziehung derselben
chaotischen Größe — mit der Händlerfuhre war der dünne Quader sogar schlechter
(−10 ± 29 km/h, besser in 15 von 24).

**Abnahmekriterium.** `npm test` grün; `test/kipper.test.ts` fährt die gewürfelte
Händlerfuhre über 24 Saaten und hält Mittel < 55, Median < 40, Höchst < 200 km/h,
Durchfall ≤ 10 %, Rest ≤ 45 %, weitestes Stück < 12 m vom LKW.

**Auf dem Gerät zu prüfen.**
1. Einen Kipper abkippen lassen und zusehen: Rutscht die Fuhre über die Heckkante
   nach unten, statt im LKW zu versinken?
2. Nach dem Abkippen den Platz absuchen: Liegt noch irgendwo ein Stück, das
   nicht in der Nähe des LKW gelandet ist?
3. Zwei Fuhren hintereinander an dieselbe Stelle: Wird der erste Haufen beim
   Rangieren des zweiten LKW verschoben? (Das ist der Befund, der NICHT behoben
   ist — ich möchte wissen, wie stark er auffällt.)
