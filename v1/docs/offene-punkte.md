# Offene Punkte (Stand 11.09.2026)

Gesammelt aus den Gerätetests. Abgearbeitet wird von oben nach unten; was
erledigt ist, bekommt den Commit dazu.

## Erledigt

- [x] **Keine Fahrzeuge ineinander** — Bagger und Radlader fuhren durch
      stehende LKW. Gedrehte Standflächen in `world/boxen.ts`. (`d7a05f8`)
- [x] **Ladehöhe und Ladeform** — gepackt wird wie in eine Kiste
      (`delivery/ladung.ts`), Oberkante knapp über der Bordwand.
- [x] **Abholer verliert Schrott** — was auf der Fläche liegt, wird beim
      Losfahren verriegelt und fährt mit.
- [x] **"Vorfahren" ersetzt** durch "Zur Waage", **"Kippen" entfernt**.
- [x] **Janine ist im Kaffeewagen zu sehen** — sie hing in Weltkoordinaten
      hinter der Aussenwand.
- [x] **Schnappgeräusch** beim Zusammenschlagen der Zähne.

## Physik und Ladung

- [x] **Nichts schwebt, nichts fällt vom Himmel** — der Vorlauf legte am Ende
      *alles* schlafen, auch was noch in der Luft war. Gemessen hing ein
      75-kg-Stück in 7,01 m Höhe und fiel 6,66 m, sobald es geweckt wurde.
      Jetzt wird nach dem Setzen noch einmal alles geweckt und weitergerechnet,
      bis nichts mehr fällt. Danach: höchstes Teil 2,38 m statt 7,01, und von
      den zwölf höchsten sackt noch eines um 41 cm.
- [ ] **Teile liegen beim Start ineinander** — beim Wecken drückt der Löser
      einzelne um bis zu 55 cm nach oben. Kein Schweben, aber unsauber: Der
      Haufen wird beim Setzen zu dicht gepackt.

## Presse und Schere

- [x] **Gelbes Anbauteil der Presse** verdeckt die Ballen und stört beim
      Greifen — weg, schmaler oder nur bei Bedarf. **Nachgemessen 15.09.2026
      (E-071):** Gelb war an der Maschine nichts mehr — die drei gelben Stücke
      sind am 12.09. auf deine Ansage hin entfernt worden, der Punkt stand nur
      noch aus Versehen hier. Im Weg stand etwas anderes, und zwar etwas, das
      man **gar nicht sehen konnte**: die zweite Deckelklappe. Ihre Netze waren
      unsichtbar gestellt, ihr Kollider aber blieb 4,45 × 2,16 m gross und
      stand 0,905 m weit in der Kammermündung — auf genau der Seite, von der
      die Spinne kommt. Sie ist weg. Dazu vier Versteifungsriegel, die frei in
      der Luft hinter der Presse schwebten (bis 2,00 m neben der Platte).
- [x] **Ballen sehen zu sauber aus** — Fransen, Reste der Ursprungsform,
      unterschiedliche Farben. **Stand 15.09.2026 (E-071):** Fransen und Farben
      waren am 12.09. gebaut worden; ein Kupferballen ist kupfern, ein
      gemischter trägt die Farben seiner Zusammensetzung. Gefehlt hat die
      **Ursprungsform** — jetzt zeigt jede Fraktion mit mindestens einem
      Sechstel der Masse ein Stück von sich: Blech, Rohr, Felge oder
      Kantstück, in derselben verschmolzenen Geometrie, also weiter ein
      Zeichenruf je Ballen.
- [ ] **Schere trennt nicht sortenrein** — was in die Presse geht, kommt als
      Mischschrott heraus.
- [ ] **Misch- und Stahlschrott unterscheiden** — getrennt verkaufen, Stahl
      erzielt den besseren Preis.

## Abfall

- [ ] **"Störstoff" auflösen** in Holz, Baumischabfall, Reifen und
      Kunststoffe — Störstoff sagt niemandem etwas.
- [ ] **Abfall-Anlieferung** — ein LKW kommt nur mit Abfällen, fährt von
      hinten an die Mulde bzw. auf deren Vorplatz und kippt dort ab.
- [ ] **Lambert sortiert den Abfall** mit dem Radlader in die Mulden.
- [ ] **Geld** — Abfallannahme bringt Geld, Abholung/Entsorgung kostet
      weniger als der Erlös.

## Radlader

- [ ] **Mulden befüllen, solange Platz ist**; sonst andere Arbeit aufnehmen —
      z. B. Schrott von der Büroseite an den Bagger heranschieben.

- [ ] **Wurfrichtung beim Loslassen** — beschleunigte Teile sollen seitlich
      wegfliegen, nicht senkrecht fallen.

## Leute und Stimmung

- [ ] **Schrotthändler sehen verschieden aus** — gepflegt bis ölig, klein und
      dick bis lang und dünn, Wiedererkennungsmerkmale (Goldkette, dicke Uhr,
      Schäferhund). Insgesamt mehr Detailtiefe als Playmobil.
- [ ] **Musik nach Fasson** — Techno, Rap, Schlager, Pop; Radio im Führerhaus
      zum Umschalten.
- [ ] **Funkgerät im Führerhaus** — Funksprüche von Mario (misstrauisch, was
      da geladen ist), Janine (Gossip der Händler), Lambert (Unordnung, fragt
      nach der nächsten Aufgabe). Lambert nimmt Anweisungen an: Alu rauspicken,
      Kupfer holen, Schrott zusammenschieben, Baumisch abladen.

## Handel

- [ ] **Heisse Ware** — Händler mit heissem Haufen wollen schnellen Umschlag:
      direkt verladen, Autos direkt in die Presse. Volle Ladungen, sonst
      lohnt es nicht; zu durchmischt drückt den Preis.

## Wirtschaft

- [ ] **Mischschrott wird pauschal bepreist, nicht nach Inhalt** — gemessen
      12.09.2026: Ein Rad (Reifen 70 %, Felge 30 %) bringt ungetrennt 4,00 €,
      zerlegt nur 1,00 €, weil Reifen Entsorgungskosten verursachen. Damit
      lohnt es sich, Reifen **nicht** zu trennen — das Gegenteil der Absicht.
      Vorschlag: Der Wert eines Mischschrott-Teils ist die Summe seiner
      Bestandteile, vermindert um einen Abschlag fürs Unsortierte. Dann ist
      Zerlegen nie ein Verlust, nur manchmal wenig Gewinn.

## Personal

- [x] **Lambert trennt mit Werkzeug** — zwei neue Zustände `werkzeug`
      (hinlaufen) und `trennt` (neun Sekunden arbeiten, mit Funken). Danach
      liegen die Fraktionen getrennt da, und er sortiert sie im nächsten
      Arbeitsgang selbst in die Mulden. Gemessen: patrol → werkzeug → trennt →
      patrol → carry.
- [ ] **Heinz als Hilfsarbeiter** — zweiter Mann, damit zwei Arbeitsgänge
      parallel laufen. Ausbaustufe wie Radlader und Bulldozer.

## Platz

- [ ] **Absetzcontainer stehen außerhalb des Schwenkkranzes** — Kabel, Kupfer
      und Messing sind 11,6 bis 17,9 m entfernt abgestellt, weil der Ring
      zwischen 4,0 und 9,5 m mit Stahl, Alu und VA voll ist. Gedacht ist es so:
      Lambert trägt Buntmetall hin (er bevorzugt jetzt Container vor Mulden),
      und wer selbst hinein sortieren will, zieht sich den Behälter heran. Ob
      das im Spiel trägt, muss sich zeigen — sonst müsste die VA-Mulde weichen.
- [ ] **Bewegliche Container sind für Fußgänger und LKW unsichtbar** — sie
      stehen nicht in `obstacles.ts` (die Liste ist für Feststehendes), also
      laufen Lambert und die Fahrer dagegen und schieben sie an. Bisher steht
      keiner in einer Fahrspur; sobald der Spieler einen dorthin zieht, fällt es
      auf.
- [ ] **Hortmulden für Kupfer und Messing sind 21 bzw. 25 m entfernt** — an der
      Südwand, wie besprochen zum Horten großer Teile. Dorthin muss gefahren
      werden; ob sich das lohnt, entscheidet sich erst, wenn es wirklich
      sperriges Buntmetall gibt (bisher nur die Schiffsschraube mit 180 kg).

## Notizen 14.09.2026

- [ ] **Federnde LKW beim Abladen** — Wenn der Bagger etwas Schweres in eine
      Mulde legt oder fallen lässt, soll das Fahrzeug auf seinen Federn
      einsacken und ausschwingen, je nach eingeleiteter Kraft. Heute passiert
      gar nichts: Die Fahrzeugkörper sind kinematisch (`delivery/vehicles.ts`),
      also für die Physik unendlich schwer — ein 400-kg-Maschinenblock landet
      so weich wie eine Feder.

      *Warum es zählt:* Es ist die einzige Stelle, an der man dem Spiel ansieht,
      wie schwer das Teil war, das man gerade getragen hat. Gewicht ist sonst
      nur eine Zahl im HUD.

      *Wie es gehen könnte, ohne die Fahrzeuge dynamisch zu machen:* Die
      Fahrzeuge müssen kinematisch bleiben, sonst laufen ihre Routen nicht mehr.
      Ein **rein optisches Federn** reicht aber: Beim Aufschlag auf der
      Ladefläche die eingeleitete Energie messen (Masse mal Geschwindigkeit
      beim Kontakt), daraus einen gedämpften Höhenversatz auf das Fahrzeug-Mesh
      legen und ausschwingen lassen. Der Kollider bleibt, wo er ist. Kostet
      keine Physik und keinen Zeichenruf.

      Sinnvoll auch am Kipper, wenn die Mulde hochgeht und die Ladung
      abrutscht — und am Bagger selbst, wenn er mit voller Spinne absetzt.

      Gehört in Abschnitt 1 („die Welt", E-016), aber erst nach Platz, Bagger
      und Maschinen.

- [ ] **Unterschiedliche Kranfarben und -typen** — Die Händler kommen „mit
      Aufbau, mit Ladekran" (Patrick, 14.09.2026, zum echten Betrieb). Heute
      sehen sie alle gleich aus. Sie sollen sich in **Farbe** und **Bauart** des
      Krans unterscheiden — und damit auch die Fahrzeuge selbst.

      *Warum es zählt:* Die Kunden haben schon Namen und Eigenheiten (Manni,
      Toni, Ewald, Kfz-Werkstatt Rehm — `delivery/customers.ts`). Wenn jeder
      sein eigenes Fahrzeug hat, erkennt man ihn **an der Einfahrt**, bevor man
      den Namen liest: „Der rote mit dem kurzen Kran, der bringt immer Alu."
      Aus einer Liste von Namen werden Stammkunden. Der Punkt „Händler sehen
      verschieden aus" steht seit dem 11.09. auf dieser Liste — das hier ist
      die konkrete Form davon.

      *Wie es gehen könnte, ohne Mehraufwand je Fahrzeug:* Farbe und Krantyp
      **fest je Kunde**, nicht zufällig je Anlieferung — sonst kommt Manni
      jedes Mal in einem anderen Wagen und man kann sich nichts merken.
      Ableitbar aus dem Kundennamen mit festem Zufallsstartwert, dann braucht es
      keine Datenpflege. Krantypen: kurzer Heckkran, langer Kran hinter dem
      Haus, Abrollkipper ohne Kran.

      Gehört zu „Maschinen" in Abschnitt 1 (E-016).

- [ ] **Wracks kommen in verschiedenen Zuständen an** — fehlende Türen, fehlende
      Reifen, Motor schon ausgeschlachtet (Patrick, 14.09.2026). Heute ist jedes
      Auto identisch: `dismantle/carDef.ts` hat **genau einen Datensatz**, und
      jedes Wrack bringt vollständig Motor, Getriebe und vier Räder mit.

      *Warum es zählt:* Es macht aus dem Abladen eine **Einschätzung**. Heute
      weiß man vorher, was drin ist, und arbeitet es ab. Mit wechselnden
      Zuständen muss man hinsehen: Ist an dem noch was dran, oder ist das ein
      leergeräumter Rumpf? Genau das ist die eigentliche Arbeit auf einem
      Schrottplatz — und es gibt dem Verhandeln über den Ankaufspreis zum ersten
      Mal einen Grund, denn ein ausgeschlachtetes Wrack ist weniger wert.

      *Wie es gehen könnte, ohne neuen Code:* `CarDef` ist datengetrieben
      angelegt (`dismantle/composites.ts:538`), die Baugruppen stehen einzeln in
      `carDef.ts:88–149`. Es braucht also keine neue Mechanik, sondern nur die
      Möglichkeit, **Teile beim Erzeugen wegzulassen** — plus sichtbare Spuren
      dort, wo etwas fehlt: offene Radnabe statt Rad, leerer Türrahmen, offene
      Motorhaube mit leerem Raum.

      Der Zustand gehört an die **Anlieferung**, nicht ans Wrack: Welcher Händler
      bringt gute Wracks und welcher nur Reste, ist eine Eigenschaft des Kunden
      — wie Farbe und Krantyp eine Zeile weiter oben. Wer immer Ausgeschlachtetes
      liefert, muss im Preis heruntergehen.

      Gehört zu „Schrott" in Abschnitt 1 (E-016), und es ist der natürliche
      erste Schritt zu Briefing Kap. 8.2 (sieben Zerlegeschritte mit
      Reihenfolge), das bisher ganz offen ist.

- [ ] **Motorräder sind einspurige Fahrzeuge** (Patrick, 14.09.2026). Im Spiel
      gibt es sie noch nicht; die Notiz hält die Eigenschaft fest, auf die es
      ankommt, wenn sie kommen.

      *Was daraus folgt:* Ein einspuriges Fahrzeug **steht nicht von selbst**.
      Ein Autowrack sitzt auf vier Rädern und bleibt, wo es liegt; ein Motorrad
      fällt um, sobald man es loslässt. Auf dem Platz liegt es also auf der
      Seite, im Stapel verkeilt, oder es lehnt an etwas. Aufrecht steht es nur
      auf einem Ständer — und den hat ein Schrottmotorrad meistens nicht mehr.

      Für die Physik heißt das: kein aufrechter Ruhezustand. Wer es hinstellt,
      muss damit rechnen, dass es umkippt, und das ist richtig so.

      Als Schrott ist es interessant, weil fast alles daran Buntmetall ist —
      Motorblock aus Aluminium, Kabelbaum, Auspuff aus Edelstahl. Ein Motorrad
      ist leicht, aber nicht billig.

      *Offen:* Ob du sie als **Wrack zum Zerlegen** meinst (wie die Autos), als
      **Schrottteil** (ein Stück, das man greift und einsortiert) oder als
      **Anlieferfahrzeug**. Die Eigenschaft „einspurig" gilt für alle drei, der
      Aufwand unterscheidet sich stark. Frag mich beim nächsten Mal danach, oder
      schreib es dazu.

      Gehört zu „Schrott" in Abschnitt 1 (E-016).

- [ ] **Velos fehlen auch** (Patrick, 14.09.2026). Ebenfalls einspurig, siehe
      die Notiz darüber — ein Fahrrad steht nicht von selbst, es liegt oder
      lehnt.

      *Warum ein Fahrrad als Schrottteil besonders ist:* Es ist der
      Musterfall für „lohnt sich der Aufwand?". Ein einzelnes Rad wiegt kaum
      etwas und bringt fast nichts. Ein **Haufen** alter Räder dagegen ist eine
      Anlieferung, wie sie jeder Platz kennt — sie kommen nie einzeln.

      Und es ist gemischt gebaut: Stahlrahmen oder Alurahmen, Alufelgen,
      **Gummireifen als Störstoff**, Plastik am Sattel und an den Griffen. Damit
      wird es zur Entscheidung: reinwerfen in den Mischschrott, oder die Reifen
      abziehen und die Alurahmen heraussortieren. Genau die Rechnung, die den
      Reinheitsgedanken im Spiel erst spürbar macht — an einem Gegenstand, den
      jeder kennt.

      *Wie es sparsam ginge:* Velos als **Bündel** anliefern, nicht als
      Einzelteile — ein verkeiltes Knäuel wie die Maschendraht-Bündel, die es
      schon gibt. Der Greifer holt daraus einzelne heraus. Das hält die Zahl der
      Körper klein und sieht nebenbei richtig aus.

      Gehört zu „Schrott" in Abschnitt 1 (E-016).

- [ ] **Bordwände und Türen an den LKW** (Patrick, 14.09.2026). Wie sich ein
      Aufbau öffnet, hängt an seiner Bauart — und beides wird heute gleich
      behandelt.

      **Pritsche:** Die Seitenwände lassen sich links und rechts herunterklappen,
      die Heckwand ebenso. **Heruntergeklappt hängen sie senkrecht nach unten**,
      nicht waagerecht — sie bleiben an den Scharnieren hängen und pendeln an
      der Bordwand. Heute klappen sie in die Waagerechte, und das ist der Fehler.

      **Fester Aufbau (Koffer):** Klappt gar nicht, hat Türen. Und Türen öffnen
      **seitlich**, nie nach oben oder unten.
      - **Hinten:** zwei Flügel, die um 270° herumschlagen und **an der
        Seitenwand einrasten**. So steht kein Flügel im Weg, wenn der Stapler
        oder der Greifer heranmuss.
      - **Seitentür:** wenn vorhanden, dann **nur auf einer Seite** — links
        *oder* rechts, nicht beides.
      - Ohne Seitentür ist ein fester Aufbau **ausschließlich über die Hecktür**
        zu öffnen.

      *Warum es zählt:* Es entscheidet, von wo aus der Bagger überhaupt an die
      Ladung kommt. Ein Koffer ohne Seitentür muss mit dem Heck zum Bagger
      stehen; eine Pritsche kann von drei Seiten entladen werden. Das ist keine
      Optik, das ist die Anfahrt — und damit dieselbe Frage wie beim Abkippplatz
      am Mischschrott.

      Gehört zu „Maschinen" in Abschnitt 1 (E-016), zusammen mit der Notiz zu
      Kranfarben und -typen: Welchen Aufbau ein Händler fährt, ist ebenfalls
      eine Eigenschaft des Kunden.

## Was als Nächstes ansteht (Stand 15.09.2026)

Geordnet nach Reihenfolge, nicht nach Größe. Wer hier weiterarbeitet — auch eine
spätere Sitzung — fängt oben an. Die Abschnitte folgen E-016: erst die Welt,
dann der Kreislauf, dann die App.

**Live, Stand 15.09.2026:** 534 Tests in 49 Dateien grün. Fahrpedale unten links
(E-017), Bildinterpolation gegen das Ruckeln, die fünf Baufehler (E-018 … E-021),
Seitenabladung (E-022 … E-024), Baggerkonzept als Zeichnung (E-025), Hallen und
Silos umgezogen samt Tor-Fehler (E-026), Greifanzeige aus der Bildmitte (E-027).
Alle Zeichnungen liegen unter `/v1/plaene/` und sind auf dem Telefon aufrufbar.

**In Arbeit, nichts davon oben:**
- **Platz:** eine Buntmetallmulde als Puffer statt dreier Sortiermulden · Silos
  neben die Hallen und ums Eck über die Südseite · Janine ans Tor zu den
  Warteplätzen · Kipper auf die Seitenabladung (E-028)
- **Bagger:** Zylinder, Drehkranz, Ausleger; danach Fahrer, Unterwagen, Oberwagen,
  Kabine; der Kabinenhub zuletzt und allein (E-029 ff., nach E-025)

### Abschnitt 1 — die Welt

1. ~~**Presse als offener Behälter statt Vollklotz.**~~ **ERLEDIGT 15.09.2026
   (E-029).** Sie stand als volles Rechteck in der Hindernisliste, 2,2 m hoch
   über die ganze Kammer — der Greifer kam nicht auf den Kammerboden, das
   fertige Paket lag unerreichbar darin (Befund Patrick: „Es war auch nicht
   möglich, ein zusammengepresstes Auto wieder aus der Presse zu holen").
   Jetzt ein Wandring aus `pressWaende()`, derselben Quelle wie die
   Rapier-Kollider. Lichte Kammer 4,05 × 4,20 m, Tastfenster der Spinne innen
   3,55 × 3,70 m, das Paket liegt 7,40 bis 9,15 m vom Sitz (Boden erreichbar
   von 3,0 bis 9,5 m). Für Fahrzeuge bleibt sie zu. `test/presse.test.ts`.
   **Bleibt offen:** Während die Deckelklappe geschlossen ist, hält die
   Hindernisliste den Greifer nicht mehr davon ab, in die Kammer zu greifen —
   die Klappe ist ein kinematischer Körper und steht in keiner Liste. Physisch
   stoßen die Krallen an sie; die Warnlogik sieht sie nicht.
2. **Pressengröße festlegen.** 4,20 × 4,05 m ist gebaut, harte Grenze 3,98 m
   (offene Spinne + 30 cm je Seite), alt waren 5,95. Alles dazwischen ist eine
   Zeile in `press.ts`. Am Bild zu entscheiden:
   `docs/messungen/2026-09-14_presse.svg`.
3. ~~**VA hat am Bagger kein Ziel.**~~ **ERLEDIGT** (E-028: Edelstahl liegt in
   „BUNT + VA"). Dasselbe galt für **Batterien** und ist mit E-029 erledigt:
   Patrick hat entschieden, sie in dieselbe Mulde zu legen, statt eine eigene
   Batteriemulde zu bauen. Das Lagersilo bleibt getrennt. **Offen bleibt der
   Preis dieser Entscheidung:** Das Schild warnt nicht mehr vor Blei. Geht ein
   Akku in derselben Fuhre mit, kostet er 155,00 € je 100 kg
   (`test/blei.test.ts`). Ob die Aufschrift „BUNT + VA" das Gefahrgut nennen
   soll, ist Patricks Entscheidung.
4. **Metallmulden zum Bagger hin niedrig schließen** — ein bis zwei Lagen, bei
   abgesenkter Kabine noch zu sehen.
5. **Pyramidenform auch an den Mulden?** Zwischen den Halden ist sie gebaut
   (Lagen 1·2·4·4·2·1), an den Mulden nicht. Am Bild zu entscheiden:
   `docs/messungen/2026-09-14_pyramiden.svg`.
6. **Firmenschild 8 × 4 statt 14 × 7?** Kleiner, dafür zu 100 % frei im Bild.
   Größer geht nur in der Nordostecke, und dann müssen drei Bäume weichen.
7. **Elektromotoren fehlen als Fraktion.** Das Silo ist mit E-026 entfallen, die
   Fraktion gibt es weiter nicht. Offen: Preis, Form, Herkunft, und ob
   Verbrennungs- und Elektromotor dasselbe Silo teilen.
8. **Der Starthaufen schläft nicht zuverlässig ein** — einer von vier Läufen.
   Kein Rückschritt. Eigenes Paket: Haufen erst fallen lassen, Wracks setzen,
   wenn er ruht.
9. **Federnde LKW beim Abladen**, Wrackzustände (fehlende Türen, Reifen,
   ausgeschlachteter Motor), Motorräder und Velos, Kranfarben und -typen,
   Bordwände und Türen — die Notizen weiter oben in dieser Datei.
10. ~~**Greifer:** Traverse Ø 0,70 → Ø 1,10, ja oder nein?~~ **Entschieden am
    15.09.2026 am Blatt `docs/f5-traverse-2026-09-15.svg`: Variante B, Ø 0,95**
    (E-039). Gebaut und gemessen: Zylinderneigung 38,9° → 24,4°, Hebelarm an
    der schwächsten Stelle 0,092 → 0,118 m (+28 % Schließkraft), Nettokorb
    1.524 → 1.529 l. Das 20°-Ziel aus E-009 bleibt verfehlt — dafür hätte es
    Ø 1,10 gebraucht. **Offen geblieben** ist, wie Traverse und
    Drehwerksgehäuse ineinandergreifen, seit die Traverse 10 cm höher sitzt
    (−0,96 → −0,865): gezeichnet, nicht konstruiert.

### Abschnitt 2 — der Kreislauf

11. **Die Zahlen stimmen.** Container-Schild rechnet Reinheit², ausgezahlt wird
    Reinheit³ — bei 76 % Reinheit 24 % weniger als angeschrieben. Die
    Sortierprämie steht im Code und wird nirgends benutzt. Abfall wird zum
    Pauschalpreis angekauft und mit negativem Preis verkauft.
12. **Der Kipper kippt sauber.** Der Schlitz am Kipplager ist die Ursache: Ein
    eingeklemmtes Teil wird vom Löser mit einem einzigen sehr großen Stoß
    befreit. Neu gemessen am 15.09.2026 über **sechzehn** Ladungen statt einer
    (E-029) — der alte Wächter prüfte *einen* Zufallsstartwert und war grün,
    weil er einen ruhigen Wurf erwischt hatte:

    | Rückweg zum Halt | Mittel | Höchstwert | über 130 km/h |
    |---|---|---|---|
    | 13,0 m | 154 | 424 km/h | 8 von 16 |
    | 9,5 m | 146 | 298 km/h | 7 von 16 |
    | **5,5 m (gebaut)** | **109** | **255 km/h** | **3 von 16** |
    | alte Kipperspur | 117 | 305 km/h | 6 von 16 |

    Während des Rückwärtssetzens ist die Fuhre verriegelt; je länger der Weg,
    desto tiefer arbeiten sich Stücke in den Schlitz. Der Rangierpunkt steht
    deshalb auf z −17,5. Der Katapult selbst ist damit **nicht behoben**, nur
    nicht mehr gefüttert. Dazu weiter offen: Heckklappe und Aufgeben-Regel.

    **Neu gemessen am 15.09.2026 (E-062), mit einem Gerät statt zweien.** Die
    Tabelle darüber stammt aus einer Zeit, in der zwei Messgeräte sich über
    denselben Vorgang um den Faktor zwei widersprachen; die Ursache war eine
    erfundene Fuhre, nicht das Verfahren. Drei Punkte sind damit erledigt oder
    anders zu sehen:

    - Dass der Wächter **andere Solver-Einstellungen** misst als das Spiel,
      stand hier als Verdacht. Nachgemessen ändert das die Bahn, nicht die
      Höhe (Mittel 147 → 138, Höchst 328 → 358 über dieselben acht Saaten).
      Kein Blocker, aber weiter eine Abschrift: `tools/kipper-messreihe.ts`
      kann die Werte aus `PhysicsWorld` setzen, der Wächter tut es nicht.
    - **Die Bodendicke ist ein echter Hebel.** Der Muldenboden-Kollider ist
      0,60 m dick (`vehicles.ts`, Oberkante +0,04). Mit 0,16 m, gleicher
      Oberkante und gleicher Ladung Stück für Stück: Mittel 149 → 94, Höchst
      463 → 226, paarweise −55 ± 19 km/h, besser in 18 von 24 Ladungen.
      **Warum** ein dickerer Quader schlechter ist, ist nicht verstanden — der
      Rahmen darunter endet 4 cm unter dem Muldenboden, da wäre Platz. Vor
      einer Änderung gehört die Ursache gefunden, nicht die Zahl kopiert.
    - **Der Wächter misst eine mildere Fuhre als das Spiel.**
      `test/kipper.test.ts` fährt 5.000 kg bei Füllgrad 0,60. Der Händler des
      Spiels kommt im Mittel mit 0,74 und 6.229 kg, und derselbe Apparat misst
      damit Mittel 159 / Höchst **585** km/h — über der Schranke von 500, die
      der Wächter hält. Er hält also einen Rückschritt an einer festen Fuhre
      fest und sagt **nicht**, dass im Spiel nichts fliegt. Ob er umgestellt
      wird (und die Schranken damit auf einen schlechteren, aber wahren Stand),
      gehört in dieses Paket.

    Patrick hat am 15.09.2026 entschieden, dass der Kipper **weiter kippt**
    (statt seitlich leergegriffen zu werden) — das Kippen ist der einzige Weg,
    auf dem Material ohne Spielerarbeit auf den Platz kommt.
13. **Die Hallen sind leer.** Es gibt keine Route hinein, keine Funk-Einweisung,
    keine Kapazität. Baulich steht alles: Tore zeigen auf den Platz, die Luftlinie
    von der Waage ist frei. Was fehlt, ist der Ablauf aus E-011 — Händler fährt
    hinein und lädt selbst ab, Lambert räumt die Halle ins Silo.
14. **Sortieren aus der Buntmetallmulde ins Silo.** Folgt aus E-028: Die Mulde ist
    Puffer, getrennt wird danach — vom Spieler oder von Lambert. Ob Lambert das
    heute kann, ist offen.
15. **Lambert auf die Schiene.** Mit Hallen links und Silos rechts fährt er quer
    über den Platz, aber nur nördlich von z −9,0 — die Zusage aus E-011 gilt der
    Sache nach, nicht mehr als Randspur. Neu zu bewerten.
16. **Der Tag hat ein Ende** — Bilanz, Pacht, Tagesziel. Und `ALLES_FREI = false`,
    damit Geld einen Zweck bekommt.

### Abschnitt 3 — die Verpackung

17. **Android als Probelauf** (geht ohne Mac und ohne Entwicklerkonto), dann iOS.
    Stand und Hindernisse in E-015. Capacitor macht das Spiel **nicht** schneller
    — dieselbe Engine.
18. **Die 14,6 ms je Bild**, die weder Physik noch Grafik sind. Frame 21,0 ms
    gegen 6,4 ms gemessene Arbeit. Das F3-Overlay zeigt die Zahl seit E-0xx als
    `Rest`; **sie ist noch nicht auf dem Gerät abgelesen worden.** Verdächtige in
    der Reihenfolge des erwarteten Gewinns: sechs Scheinwerfer rund um die Uhr im
    Shader · Auflösung `devicePixelRatio` 2 (5,6 Mio. Bildpunkte je Bild) ·
    Schatten 2048² mit der teuersten Filterstufe.

### Kleinkram, jederzeit nebenbei

- **Griff-Info im Querformat steht auf 12 px**, das Briefing verlangt ≥ 14.
  Auf 14 zu gehen kostet quer rund 40 px Bildhöhe (E-027).
- **Konto und Tagesablauf überlappen sich um 6 px** — `#money` ist wegen
  Zeilenabstand 1,5 tatsächlich 40,5 px hoch, `#shift` beginnt bei 46 (E-027).
- **Sichere Ränder** (Notch, Home-Indicator) werden nirgends berücksichtigt,
  obwohl `viewport-fit=cover` gesetzt ist. Gehört für alle unteren Elemente
  gemeinsam gelöst, nicht für eines allein (E-027).
- **Vier CPU-Kleinigkeiten sind erledigt** (HUD schreibt nur bei Änderung,
  Körperzählung nur bei offenem Overlay, Ladung viermal je Sekunde).

## Aus Patricks Gerätetests — laufend nachgehalten (ab 15.09.2026)

Angelegt, nachdem ein Befund von ihm verlorenging: Er hatte in einer Skizze die
Mittelsäule des Greifers durchgekreuzt und *danach* über den Zahn gesprochen;
gebaut wurde nur der Zahn. Seine Ansage: „es wäre schon gut, wenn wir nicht
einfach Punkte fallen lassen."

Regel: Jede seiner Meldungen kommt hier hinein, bevor irgendein Agent losläuft.
Ein Satz von ihm enthält oft mehrere Punkte — jeder bekommt eine eigene Zeile.
Abgehakt wird erst, wenn **er** es am Gerät bestätigt hat, nicht wenn es live ist.

### Offen

- [ ] **Mittelsäule raus, Zacken direkt an die Traverse** — gemessen sitzen
      zwischen `TRAVERSE_Y` (−0,865) und `STEMPEL_AUGE.y` (−1,5335) **66,9 cm
      Säule**. In seiner Skizze durchgekreuzt, von mir übersehen.
      *Stand: wird skizziert, nicht gebaut — auf seinen Blick am Bild.*
- [ ] **Zahn hängt offen 12° nach innen** — der Preis von E-069. Stört das beim
      Einstechen in den Haufen? *Wartet auf sein Urteil am Gerät.*
- [ ] **Kran fährt durch die Ladefläche** — gemeldet am 13.09., seitdem
      unangetastet. Eigenes Paket, noch nicht begonnen.
- [ ] **Greifer komplett zur Seite kippen** — zum Kehren und Schleudern.
      Vorgemessen (E-065), zurückgestellt bis die Säulenfrage entschieden ist,
      weil die Kollisionsrechnung sonst zweimal gemacht werden müsste.
- [ ] **Edelstahl-Halt, 16 cm Heckabstand zur Südwand des Kupferlagers** —
      gemessen, keine Durchdringung. *Wartet auf sein Urteil: Rangieren oder
      Unfall?*
- [ ] **Abholer brachte kein Geld** (15.09.) — die Ursache mit den drei
      verschiedenen Ladeflächen-Fenstern ist behoben (E-070), sein
      **Totalausfall aber nicht reproduziert**. Bleibt offen, bis er es
      wiedersieht oder nicht mehr wiedersieht.
- [ ] **Anlieferer ohne Frist blockiert den Hof** — wer nie abgeladen wird,
      steht unbegrenzt; im kopflosen Lauf zehn Minuten, und eine vorgemerkte
      Abholung kam nicht durch. Gefunden beim Nachstellen, nicht von ihm
      gemeldet — gehört trotzdem hierher.
- [ ] **Beim Kippen landen Teile quer über den Platz** — „nicht mal in der
      Nähe von dem LKW" (15.09.). Vermutlich der sichtbare Ausgang des
      Katapults: 500 km/h sind 139 m/s, der Platz ist rund 70 m lang. Wird als
      eigene Messgröße mitgemessen (Endlage statt Geschwindigkeit) und dient
      zugleich als Gegenprobe — passen die Endlagen nicht zum Tempo, gibt es
      einen zweiten Fehler.
- [ ] **Keine stehende Anzeige für Zahlungsunfähigkeit** — „Konto leer" ist ein
      Toast und verschwindet, der Zustand bleibt. Für „Platz dicht" gibt es eine
      Dauerzeile. `Account.lowOnCash` ist gebaut und wird nirgends benutzt.
