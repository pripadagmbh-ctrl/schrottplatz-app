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

- [ ] **Gelbes Anbauteil der Presse** verdeckt die Ballen und stört beim
      Greifen — weg, schmaler oder nur bei Bedarf.
- [ ] **Ballen sehen zu sauber aus** — Fransen, Reste der Ursprungsform,
      unterschiedliche Farben.
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

## Was als Nächstes ansteht (Stand 14.09.2026)

Geordnet nach Reihenfolge, nicht nach Größe. Wer hier weiterarbeitet — auch eine
spätere Sitzung — fängt oben an. Die Abschnitte folgen E-016: erst die Welt,
dann der Kreislauf, dann die App.

**In Arbeit, Stand 14.09.2026 abends:**
- Fahrpedale unten Mitte (ersetzt die Fahrfläche von heute)
- Fünf Baufehler am Platz: Legosteine stehen über · Wand durch Baum ·
  Firmenschild verdeckt · Scheinwerfer einmauern · Schneemobil mit vier
  Gummirädern

### Abschnitt 1 — die Welt

1. **Die Presse versetzen.** Der schwerste offene Fehler. Sie sitzt direkt
   nördlich der Mischschrott-Halde; zwischen ihr und der Stahlschrott-Halde
   bleiben **2,9 m**, ein LKW ist 2,5 m breit. Rückwärts an den Mischschrott
   ranzusetzen ist damit praktisch unmöglich — die erste Station des Kreislaufs
   ist unbrauchbar. Patricks Vorschlag: Ausbuchtung etwas kürzer, Presse hinein,
   hinter den Stahlschrott. **Erst zeichnen, dann bauen** (E-016).
2. **Hallen zu den Silos**, alles auf die Ostseite, nicht dorthin, wo Janine
   steht. Falls der Platz nicht reicht: Silos auf beide Seiten verteilen.
   Gehört mit 1 in dieselbe Zeichnung.
3. **Metallmulden zum Bagger hin niedrig schließen** — ein bis zwei Lagen, bei
   abgesenkter Kabine noch zu sehen.
4. **Pyramidenform auch an den Mulden?** Offene Frage an Patrick; zwischen den
   Halden ist sie gebaut (Lagen 1·2·4·4·2·1).
5. **VA hat am Bagger kein Ziel.** Drei Mulden, Edelstahl ist nicht dabei.
   Entweder zur Kabelmulde dazu oder bewusst „VA fährt der Spieler zum Silo".
6. **Elektromotoren fehlen als Fraktion** — das Silo steht als leere Hülle.
   Offen: Preis, Form, Herkunft, und ob Verbrennungs- und Elektromotor dasselbe
   Silo teilen.
7. **Der Starthaufen schläft nicht zuverlässig ein** — einer von vier Läufen.
   Kein Rückschritt, auf der alten Stelle war es schlechter. Eigenes Paket:
   Haufen erst fallen lassen, Wracks setzen, wenn er ruht.
8. **Menüknopf über der Kontoanzeige** auf dem iPad quer — „Konto: 1.25☰ €".
   Bestand, kein neuer Fehler, gehört ins HUD.
9. **Federnde LKW beim Abladen**, Wrackzustände, Motorräder und Velos,
   Kranfarben, Bordwände und Türen — die Notizen weiter oben in dieser Datei.
10. **Der Bagger nach dem Baggerkonzept**: Unterwagen, Abstützung, Drehkranz,
    Oberwagen, Kabine mit Fahrer, Ausleger mit Schläuchen, Kleinteile. Räder und
    Positionsliste sind fertig. Budget: von 125 auf rund 250 Bauteile.
11. **Presse als offener Behälter statt Vollklotz.** Sie steht als volles
    Rechteck in der Hindernisliste, 2,2 m hoch über die ganze Kammer — der
    Greifer kommt nicht auf den Kammerboden. Wie die Sortiermulden bauen: Wände
    ja, Deckel nein.
12. **Greifer:** Traverse Ø 0,70 → Ø 1,10, ja oder nein? Das ist die einzige Tür
    zu den offenen Kennwerten aus E-009 (Zylinderneigung, Hebelarm). Entscheidung
    am Bild, 4.567 gerechnete Lösungen liegen bereit.

### Abschnitt 2 — der Kreislauf

13. **Die Zahlen stimmen.** Container-Schild rechnet Reinheit², ausgezahlt wird
    Reinheit³ — bei 76 % Reinheit 24 % weniger als angeschrieben. Sortierprämie
    steht im Code und wird nirgends benutzt. Abfall wird zum Pauschalpreis
    angekauft und mit negativem Preis verkauft.
14. **Der Kipper kippt sauber.** Bis 141 km/h Ladung quer über den Platz.
    Zweite Ursache gefunden: der Schlitz am Kipplager. Dazu Heckklappe und die
    Aufgeben-Regel. Der Wächter prüft mit *einem* Zufallsstartwert und misst
    andere Solver-Einstellungen als das Spiel.
15. **Lambert auf die Schiene** — eigene Fahrspur am Westrand, die den
    Arbeitsbereich nie kreuzt. Voraussetzung für das Hallenkonzept aus E-011.
16. **Hallen, Einweisung per Funk, Kapazität, Abholung auf Abruf** (E-011).
17. **Der Tag hat ein Ende** — Bilanz, Pacht, Tagesziel. Und `ALLES_FREI = false`,
    damit Geld einen Zweck bekommt.

### Abschnitt 3 — die Verpackung

18. **Android als Probelauf** (geht ohne Mac und ohne Entwicklerkonto), dann
    iOS. Stand und Hindernisse in E-015. Capacitor macht das Spiel **nicht**
    schneller — dieselbe Engine.
19. **Die 14,6 ms je Bild**, die weder Physik noch Grafik sind. Frame 21,0 ms
    gegen 6,4 ms gemessene Arbeit. In der App lässt sich das nicht mehr dem
    Browser zuschieben.
