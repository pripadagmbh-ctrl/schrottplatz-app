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

- [ ] **Lambert trennt mit Werkzeug** — Flex und Abdrückmaschine. Alles, was
      `nurWerkzeug` trägt, ist seine Arbeit: Alufelge vom Reifen, später mehr.
      Er holt das Stück, arbeitet eine Weile daran, und danach liegen die
      Fraktionen getrennt da. Die Datenseite steht schon (`trennbar` +
      `nurWerkzeug`, `items.zerlege`), es fehlt sein Arbeitsgang.
- [ ] **Heinz als Hilfsarbeiter** — zweiter Mann, damit zwei Arbeitsgänge
      parallel laufen. Ausbaustufe wie Radlader und Bulldozer.
