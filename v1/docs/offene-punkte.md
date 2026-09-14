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
