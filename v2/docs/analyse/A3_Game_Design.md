# Game-Design-Review: Schrottplatz-App

Rolle: game-designer · Stand: 2026-09-02 · Grundlage: `docs/02_Briefing.md` (1 020 Zeilen), `docs/Pruefung/*.md`, `docs/10_Store_Veroeffentlichung.md`, `prototype/README.md` und der Quellcode in `prototype/src/` (economy/, delivery/customers.ts, delivery/vehicles.ts, ui/tutorial.ts, main.ts, materials/, world/office.ts).

Alle Pfade sind relativ zu `/home/claude/sp/proto/`. Ich habe **nur gelesen und gerechnet**, nichts gestartet (kein Browser-Lauf). Wo ich etwas aus dem Code ableite, steht **BELEGT** mit Datei und Zeile; wo ich schätze oder aus Erfahrung urteile, steht **VERMUTUNG**.

Legende für Laien:
- **GDD** = Game Design Document, hier `docs/02_Briefing.md`.
- **Core Loop** = die Handlungsschleife, die der Spieler immer wieder durchläuft (Sekunden: ein Griff; Minuten: eine Anlieferung; Session: eine Spielsitzung; Meta: Fortschritt über viele Sitzungen).
- **Progression** = sichtbarer, planbarer Fortschritt („was bekomme ich als Nächstes und wofür?").
- **Onboarding** = die ersten Minuten, in denen das Spiel sich selbst erklärt.

---

## 0. Zusammenfassung (die fünf wichtigsten Befunde)

1. **Es gibt kein Spielziel im Code.** Keine Tage, kein Tagesende, keine Bilanz, keine Fixkosten, keine Aufträge/Tagesziele. `Shift` zählt nur kumulierte Tonnen (`src/economy/shift.ts:31`), die Tageszeit ist reine Beleuchtung (`src/world/daylight.ts:16`, Tag = 15 min, läuft endlos im Kreis). Patricks Kritik „Ziel unklar" ist damit nicht Geschmack, sondern belegter Ist-Zustand: Das Spiel ist ein Endlos-Umschlag ohne Abschluss.
2. **Die Wirtschaft ist nicht in sich schlüssig.** Der Ankauf kostet **pauschal 0,16 €/kg für jedes Material** (`src/economy/account.ts:16`), der Verkauf zahlt materialabhängig bis **7,20 €/kg** (`src/materials/catalog.ts:27`). Eine sortenreine Kupfer-Fuhre kostet ~260 € und bringt ~11 500 € (Rechnung in Kap. 3.2). Das GDD sieht 20 % Marge vor (Kap. 7: Kupfer Ankauf 6,00 / Verkauf 7,20). Balancing-Aussagen im GDD (Kap. 10.3) beziehen sich auf eine Wirtschaft, die im Code so nicht existiert.
3. **Die Hälfte des Ausbaus ist Attrappe.** `src/world/office.ts` (die im GDD Kap. 27.3 als „roter Faden" beschriebene Gebäudekette Wiegehäuschen → Büro → Halle) wird **nirgends importiert** (BELEGT: `grep OfficeBuilding` findet nur die Definition). Büro, Halle und Magnet haben keinerlei Spielwirkung außer dem Freischalten anderer Einträge (`src/main.ts:449-459`). Der Spieler zahlt 9 000 + 28 000 + 26 000 € für nichts Sichtbares.
4. **Das GDD widerspricht sich in drei Schichten.** Kap. 1–24 (Stand 27.08., Design-Pivot „Zerstörung vor Ordnung", Container → Haufen, Waage/Beleg raus), Kap. 25 (29.08.: Zyklus mit Einfahrt-Schließung, Waage wieder drin) und Kap. 27 + Code (02.09.: Einfahrt schließt nicht mehr, Durchsatz statt Zyklus, `src/economy/shift.ts:4-13`). Ein Entwickler, der Kap. 4 liest, baut etwas anderes als einer, der Kap. 25 liest, und beide etwas anderes als das, was läuft.
5. **Das Onboarding erklärt nicht das Greifen.** Die sechs Tutorial-Karten (`src/ui/tutorial.ts:45-104`) setzen voraus, dass der Spieler die Baggersteuerung beherrscht, und verweisen auf eine falsche Taste („Taste G" für den Ausbau, tatsächlich `KeyZ`, `src/main.ts:736`; Hilfe-Overlay sagt „Z", `index.html:321`; auf deutscher Tastatur liegt `KeyZ` physisch auf **Y**). Die im GDD Kap. 14.3 beschriebene Minuten-genaue Einführung (Träger greifen → Container → Mini-Anlieferung) ist nicht gebaut.

Empfehlung in einem Satz: **Vor jedem weiteren Feature ein Tages-Gerüst mit drei Aufträgen, einer Abend-Bilanz und einer sichtbaren Ausbaustufe einziehen (Spezifikation in Kap. 5) — das ist eine Woche Arbeit im bestehenden Stack und beantwortet Patricks Kernkritik unabhängig von der Engine-Frage.**

---

## 1. Was ist das Spielziel — laut GDD, laut Code, laut Spieler?

### 1.1 Laut GDD (drei verschiedene Antworten)

| Fassung | Wo | Ziel des Spielers |
|---|---|---|
| **A: „Ordnung"** (ursprünglich, Kap. 1–24 vor dem Pivot) | `02_Briefing.md:13`, `:66-82`, `:285-296` | Aus Chaos sortenreine Container machen; Tagesbilanz mit Umsatz/Kosten/Sortierquote; Tagesziele mit Bonus; 15-Tage-Kampagne „Platz vom Onkel geerbt" bis zum ersten Auto |
| **B: „Zerstörung"** (Pivot 27.08.) | `02_Briefing.md:28`, `:607-642`, `:691` | „Kompetenz und kathartische Zerstörung": Auto packen, aufs Dach fallen lassen, Motor herausreißen; Sortieren nur noch „leichtgewichtige zweite Ebene"; Waage/Beleg/Geduld raus aus dem MVP |
| **C: „Umschlag/Zyklus"** (29.08. + 02.09., Kap. 25–27) | `02_Briefing.md:731-746`, `:875-1010` | Annahme → Einfahrt zu → Sortieren → Abholung → Geld nach Sortenreinheit; verhandeln mit drei Kundengruppen; Platz ausbauen (Büro → Halle → Maschinen) |

Diese drei Fassungen stehen **nebeneinander im selben Dokument**, ohne dass eine die andere aufhebt. Kap. 2 sagt ausdrücklich, Ordnung sei „ersetzt" (`:28`); Kap. 25 und 27 bauen die Ordnung (Sortenreinheit als „ganzer Kern des Geschäfts", `src/ui/tutorial.ts:66-68`) wieder zum Zentrum aus. Kap. 21 (`:609`) sagt „Container werden zu offenen Haufen-Zonen"; Kap. 25.1 (`:738`) spricht wieder von Boxen; der Code hat beides (Stahl-Haufen + Betonlego-Boxen, `prototype/README.md:59-64`).

**Bewertung:** Der Pivot vom 27.08. wurde nicht zu Ende gedacht. Zerstörung (Wrack greifen, Scheiben, Quetschstufen) ist gebaut (README M2), aber sie **zahlt auf nichts ein**: Ein zerquetschtes Auto bringt kein Geld, keinen Auftrag, keinen Ruf. Kap. 27 erwähnt Zerstörung mit keinem Wort mehr. Das Spiel hat also einen „Spaß-Kern" (Physik) und einen „Wirtschafts-Kern" (Sortenreinheit), die nicht verbunden sind — und das ist exakt, was Patrick als „nicht schlüssig" erlebt.

### 1.2 Laut Code (BELEGT)

Was der laufende Prototyp als Ziel anbietet:

- **Kontostand** (`src/economy/account.ts:34`, Start 5 000 €), angezeigt oben mit „Haufen ≈ X €" (`src/ui/hud.ts:63`).
- **Umschlag in Tonnen** im HUD (`src/economy/shift.ts:70-74`: „3,2 t umgeschlagen · 4 800 kg liegen").
- **Ausbau-Menü** mit 8 Einträgen, freigeschaltet nach kumulierten Tonnen (`src/economy/upgrades.ts:36-102`).
- **Tutorial** mit 6 Karten, endet nach dem ersten Verkauf (`src/ui/tutorial.ts:97-104`).

Was **nicht** existiert (BELEGT durch Suche nach `Tag`, `Fixkosten`, `Bilanz`, `dayEnd`, `Contract`, `daily_goal` in `src/` — keine Treffer außer Kommentaren und `people.ts`-Namensschildern):

- Kein Tagesende, keine Tagesbilanz, keine Fixkosten (GDD Kap. 10.1: 150 €/Tag).
- Kein `Contract`/Tagesziel (GDD Kap. 11, Datenmodell Kap. 18 `interface Contract`, `:534-543`).
- Keine Kampagne, keine Sterne, kein Abschluss („Spielende" ist im GDD nirgends definiert — auch nicht als „Freies Spiel ohne Ende, aber mit Meilenstein X").
- Kein Ruf-Effekt außer Verhandlungsbonus: `Reputation.decay()` und `frequencyFactor()` werden **nie aufgerufen** (BELEGT: `grep -rn "\.decay(\|frequencyFactor(" src` liefert nur die Definition in `reputation.ts`). GDD Kap. 27.2 (`:950`) behauptet „Der Ruf steuert die Anlieferfrequenz" — **falsch**. Auch die Ereignisse `kurzeStandzeit`/`langeWartenLassen` (`reputation.ts:32-33`) werden nie ausgelöst. Der Ruf ist eine Zahl, die nur beim Verhandeln ±10 % Toleranz gibt (`src/economy/haggle.ts:82`).
- Keine Marktpreise (fest, `catalog.ts`), keine Tagespreis-Tafel.
- Sortierprämie: `prototype/README.md:53` behauptet „0,05 €/kg Sortierprämie sofort". `SORTING_BONUS_PER_KG` (`account.ts:18`) wird **nirgends verwendet**; `noteSorted()` (`account.ts:55-57`) zählt nur. README ist veraltet.

### 1.3 Was der Spieler in den ersten 5 Minuten erlebt (aus Code rekonstruiert, VERMUTUNG mit Belegen)

| Zeit | Was passiert | Beleg |
|---|---|---|
| 0:00 | Platz mit großem Stahlberg, zwei Wracks, Schrott auf Bergen. Karte 1/6: „Linker Stick: Hauptarm und Oberwagen … dreh den Oberwagen einmal herum" — Karte schaltet nach 12 s **von selbst** weiter, egal ob der Spieler etwas getan hat | `src/main.ts:126-144`, `src/ui/tutorial.ts:47-53`, `:128` (`done: () => true`, Zeitschwelle 12 s) |
| 0:12 | Karte 2/6 „Der erste Kunde": Nach 12 s Spielzeit fährt der erste LKW ein (`FIRST_DELAY_S = 12`). Es kann ein Händler mit 2,5–9 t sein (40 % Wahrscheinlichkeit) | `src/delivery/routes.ts:108`, `src/delivery/customers.ts:240-243`, `:267` |
| ~0:40 | Waage → Verhandlungsdialog mit drei Knöpfen. Der Spieler weiß noch nicht, was „Marktpreis" hier bedeutet, ob er kaufen oder verkaufen soll, und dass er gerade **Geld ausgibt** | `src/main.ts:508-543` |
| ~1:00 | LKW kippt 10–13 Teile ab (Händler: bis 420 kg pro Teil, Faktor bis 8× hochskaliert). Karte 3/6: „wirf ihn in die passende Mulde … > 300 kg" | `src/delivery/vehicles.ts:357-377`, `src/ui/tutorial.ts:63-69` |
| ~1:30 | Nächster LKW: 7–15 s × Faktor 0,6–2,2 nach dem Wegfahren des vorigen. Der Spieler hat den ersten Haufen noch nicht angerührt | `src/delivery/routes.ts:109`, `src/economy/shift.ts:56-60` |
| 2–5 min | Der Spieler kämpft mit 5 Achsen (Q/E, R/F, T/G, LMB, Mausrad) — **kein Tutorial-Schritt erklärt einen einzigen Griff**. Es kommen 2–4 weitere LKW. Ab 16 t Losem: „Platz dicht" | `index.html:306-322`, `src/economy/shift.ts:20`, `:71` |

**Fazit Onboarding:** Das Tutorial ist eine Checkliste über den Wirtschaftskreislauf, kein Steuerungs-Tutorial. Die im GDD Kap. 14.3 (`:373-379`) spezifizierte Einführung (ein Träger, ein Container, dann 5 Objekte) ist deutlich besser als das Gebaute — und wurde ersetzt, nicht umgesetzt. Kap. 27.6 (`:1002-1010`) erklärt das zur Tugend („schreibt nichts vor, blockiert nichts"). Für ein Spiel, dessen größtes Einstiegsrisiko laut GDD selbst die Steuerung ist (Kap. 23 `:674`), ist das die falsche Stelle für Zurückhaltung.

Zusätzlich BELEGT: Die Tutorial-Karte 6 sagt „Mit dem Verdienten baust du den Platz aus (**Taste G**)" (`tutorial.ts:102`). G ist aber „Stiel ran" (`index.html:310`). Der Ausbau liegt auf `KeyZ` (`main.ts:736`); das Hilfe-Overlay sagt „Z" (`index.html:321`); `Input` wertet `e.code` aus (`src/core/input.ts:20`), und `KeyZ` ist auf einer deutschen QWERTZ-Tastatur die physische **Y**-Taste. Drei Angaben, drei verschiedene Tasten. `docs/Pruefung/00_Start_hier.md:33` behauptet ebenfalls „G".

---

## 2. Über- und Unterspezifikation des GDD

### 2.1 Überspezifiziert (Zahlen ohne Wirkung)

Das GDD ist mit 1 020 Zeilen ein Produktions-Pflichtenheft für ein 12-Monats-Projekt, nicht ein Prototyp-Briefing. Konkret zu viel:

| Kapitel | Umfang | Warum zu viel für jetzt |
|---|---|---|
| 7 Materialkatalog | 12 Materialklassen mit Dichte, Stückgewicht, Ankauf, Verkauf, Fehlsortierung, visuelle Erkennung | Code hat 9 IDs, davon 3 (wood/tires/rubble) ohne Kunden, der Ankauf ignoriert die Tabelle komplett (0,16 € pauschal) |
| 8.2 Auto-Zerlegung | 7-stufige Reihenfolge mit Strafen je Schritt | Im Code: Motor + Räder abreißbar, kein Kat, keine Batterie, keine Presse-Sperre, kein Geld für Teile |
| 10.2 Upgrade-Baum | 12 Upgrades 800–80 000 € | Code hat 8 völlig andere Upgrades (9 000–42 000 €); Kap. 25.2 nennt 6 weitere; drei Listen, keine gilt |
| 10.3 Balancing-Kurve | Kontostand pro Spielstunde | Bezieht sich auf die Wirtschaft aus Kap. 7/10, die nicht gebaut ist; Zahlen sind unbrauchbar |
| 13, 26 Kundschaft/Ruf | Zufriedenheits-Sterne, 8 Familien, 8 Branchen, Ruf-Matrix 6×3 | Kap. 26.5 Ruf-Matrix hat 6 Ereignisse, Code 5, davon 3 aktiv angebunden |
| 17–19 Technik, Datenmodell, Budgets | ~170 Zeilen | Gehört in ein Tech-Dokument, nicht ins Design; Datenmodell Kap. 18 stimmt nicht mehr mit dem Code überein (kein `Contract`, kein `yardLevel`, kein `marketSeed`) |
| 6.2 Greifen technisch | Abrutsch-Wahrscheinlichkeit 8 %/s, Sperrigkeits-Regeln | Detailtiefe, die nie getestet wurde und laut README anders gebaut ist (Sensorkugel, kein 5-Finger-Kontakt) |

Muster: Das GDD hält **Startwerte (SW)** für Design. Sie sind aber nie gespielt worden — `docs/Pruefung/02_Schwachstellen.md:99-103` gibt selbst zu, dass es „nie einen Durchlauf über mehrere Spieltage" gab. 300+ Zahlen ohne einen Playtest sind Ballast, keine Spezifikation.

### 2.2 Unterspezifiziert (die Fragen, die den Spielspaß entscheiden)

| Frage | Stand im GDD |
|---|---|
| **Was ist das Ziel?** | Nirgends in einem Satz. Kap. 4 „Session-Loop" nennt „Tagesziel", Kap. 11 macht Tagesziele zu `[V1]`, Kap. 25/27 kennen weder Tag noch Ziel |
| **Warum sortiere ich?** | „Sauberes Trennen bringt Geld" — aber wofür brauche ich Geld? Kap. 25.2 (`:750-751`): „Upgrades sind das Sahnehäubchen, nicht der Antrieb". Was ist dann der Antrieb? Unbeantwortet |
| **Wann höre ich auf / was ist ein guter Abschluss einer Sitzung?** | Nicht definiert. Kein Spielende, kein Meilenstein, keine Sterne, kein „Tag geschafft" |
| **Wer bin ich, wem gehört der Platz, was steht auf dem Spiel?** | Kap. 26.1 „Daniel" (Sohn von Lambert), Kap. 11 „Platz vom Onkel geerbt" — zwei Fassungen, keine im Spiel. Lambert, Mario, Janine existieren als Figuren (`src/world/people.ts:254`, `:274`), haben aber keine Rolle für den Spieler |
| **Wie hängen Zerstörung und Wirtschaft zusammen?** | Nicht. Wrack fallen lassen ist gratis, folgenlos, unbelohnt |
| **Was macht den Unterschied zwischen einem guten und einem schlechten Spieler aus?** | Sortenreinheit³ beim Verkauf — aber die Presse mischt alles zu einem Paket, und Mischschrott pressen wird im Tutorial als Normalfall gelehrt (`tutorial.ts:74-80`). Widerspruch zwischen „sortenrein ist alles" und „press einfach den Rest" |
| **Scheitern** | „Kein Game Over" (Kap. 11), Kreditlimit −1 500 € (`account.ts:33`) — aber was passiert dann? Es liefert niemand mehr (`main.ts:847`), und wenn nichts Verkäufliches liegt, ist der Spielstand faktisch tot. Ungeklärt |

---

## 3. Core Loop und Wirtschaft

### 3.1 Loop-Bewertung

| Loop | GDD-Soll | Im Prototyp | Urteil |
|---|---|---|---|
| **Sekunden** (Greifen → Abwerfen) | 8–15 s, Feedback Sound + Ampel + Ticker | Gebaut: Griff-Info, Abwurf-Ampel, Sounds, Highlight (README M1); Geld-Ticker beim Abwurf **entfernt** (`account.ts:52-57`) | **Funktioniert**, aber Belohnungskanal halbiert: Der richtige Wurf klingt gut, zahlt aber nichts mehr. GDD Kap. 15 (`:400`): „Audio ist der primäre Belohnungskanal" — ok; aber der Geldticker war der zweite, und der ist weg |
| **Minuten** (eine Anlieferung) | 3–8 min, 400 kg, Beleg | Händler-Fuhre 2,5–9 t in 10–13 Teilen, nächster LKW nach 7–15 s. Verhandlung als 3-Knopf-Dialog | **Überlastet.** 5 t je Fuhre bei 1 Griff / 10–15 s (ein Teil pro Griff, bis 420 kg) = 2–3 min reine Sortierzeit pro LKW; Nachschub kommt schneller. Der Spieler erlebt nicht „eine Anlieferung abarbeiten", sondern einen Berg, der schneller wächst, als er schrumpft (bewusst so gebaut: `shift.ts:4-13`) |
| **Session** (ein Arbeitstag) | 15–30 min, Tagesziel → Bilanz → Speichern | **Nicht vorhanden.** Tageslicht rotiert kosmetisch alle 15 min (`daylight.ts:16`), es passiert nichts am „Abend" | **Fehlt komplett.** Das ist die Lücke, die Patrick spürt |
| **Meta** (Ausbau) | 3–4 Upgrades in 5 h, „Wunsch-Upgrade sichtbar unerreichbar" | 8 Upgrades, 12 000–42 000 €, Schwellen 0–160 t. Wirkung: Radlader (Lambert fährt), Dozer/Stapler (Lambert 1,4× schneller), Baggerausbau (1,35× Tempo, 1,5× Last), Presse (1,6× Ballen). Büro/Halle/Magnet: **keine Wirkung** | **Halb.** Von 8 Käufen sind 3 leer, 3 wirken auf eine NPC-Figur, die der Spieler kaum beobachtet, nur Baggerausbau verändert **sein eigenes** Spielgefühl — und der kommt erst bei 120 t |

### 3.2 Wirtschaft nachgerechnet (BELEGT aus Konstanten, Mengen VERMUTUNG)

**Grundregeln im Code:**
- Ankauf: `netKg × 0,16 € × Faktor` (Faktor 1,0 / 0,85 / 0,68; Gewerbe 1,06) — `account.ts:16`, `:46`, `haggle.ts:27-31`, `main.ts:506`.
- Verkauf: `kg × Verkaufspreis(dominante Fraktion) × Reinheit³` — `account.ts:119`. **Achtung:** README (`:55`), GDD Kap. 7 (`:184`), Kap. 10.1 (`:251`) und die HUD-Prognose (`src/materials/purity.ts:26`, Test `purity.test.ts:27` „wirkt quadratisch") sagen alle **Reinheit²**. Nur der tatsächliche Verkauf nutzt ³. Der Spieler sieht „Haufen ≈ 1 000 €" und bekommt bei 80 % Reinheit 512 € statt 640 €. Kleine Abweichung, aber ein Vertrauensbruch — und ein Beispiel für „Feature ändert Bestehendes, niemand merkt es".
- Verkaufspreise €/kg: Stahl 0,25 · VA 1,40 · Alu 1,50 · Kupfer 7,20 · Kabel 2,20 · Störstoff −0,08 (`catalog.ts:24-30`).

**Rechnung 1 — Marge je Material bei Ankauf 0,16 €/kg:**

| Material | Verkauf | Marge/kg | Faktor |
|---|---|---|---|
| Stahl | 0,25 | +0,09 | 1,6× |
| Alu | 1,50 | +1,34 | 9,4× |
| Kabel | 2,20 | +2,04 | 13,8× |
| Kupfer | 7,20 | +7,04 | **45×** |

GDD Kap. 7 sieht überall ~20–30 % Marge vor (Kupfer 6,00 → 7,20). Der Code hat das Ankaufsmodell aus dem Pivot („Anlieferung light … ohne Waage/Beleg", Kap. 21) übernommen und die Waage später wieder eingebaut, ohne den materialabhängigen Ankauf nachzuziehen.

**Rechnung 2 — eine sortenreine Kupfer-Fuhre (Händler Zöllner, 45 % seiner Fuhren sind sortenrein, `customers.ts:98`, `:269`):**
Kupfer-Kleinteile 12–18 kg (`scrapItems.ts:132-134`), 10–13 Stück, Skalierung auf Kundenmenge gedeckelt auf Faktor 8 (`vehicles.ts:371`) → ca. 13 × 15 kg × 8 ≈ **1 560 kg**. Ankauf: 1 560 × 0,16 = **250 €**. Verkauf sortenrein: 1 560 × 7,20 = **11 232 €**. Eine Fuhre = fast ein Radlader. Das Verhandeln (−15 %/−32 % auf 250 €) ist dagegen bedeutungslos — ein ganzes Subsystem (haggle.ts, 138 Zeilen, 15 Tests) bewegt bei den wertvollen Fuhren zwei- bis dreistellige Beträge, während die Fraktion vierstellige entscheidet.

**Rechnung 3 — Zeit bis zum ersten Upgrade (VERMUTUNG, Annahmen genannt):**
Annahmen: Der Spieler schafft realistisch 1 Griff/12 s; er sortiert nur die wertvollen Fraktionen (Alu/VA/Kupfer/Kabel, ca. 25 % der Masse einer Mischfuhre) und lädt den Abholer damit; Stahl bleibt liegen. Eine Händler-Mischfuhre (Ø 5,7 t, Ankauf ~920 €) enthält dann ~1,4 t Buntmetall ≈ 0,6 t Alu (900 €) + 0,3 t VA (420 €) + 0,25 t Kupfer (1 800 €) + 0,25 t Kabel (550 €) ≈ **3 670 €** Verkaufswert bei Reinheit 1 — pro Fuhre also ~2 700 € Nettogewinn, wenn sortenrein geladen wird (4 Abholungen nötig, je ~1–2 min). Sortierzeit ~15 Griffe ≈ 3 min + Verladen ~4 × 2 min.
→ **Radlader (12 000 €, ab 0 t) nach ca. 3 Fuhren ≈ 25–40 Minuten.** Büro (9 000 €, ab 15 t) braucht 15 t *abgefahrene* Masse — mit Buntmetall allein (1,4 t/Fuhre) ~11 Fuhren, mit Stahl deutlich schneller aber unrentabler pro Griff.
→ **Größere Presse (42 000 €, ab 160 t):** bei ~3 t je Abholung ~55 Abholungen ≈ 4–6 h. Vertretbar als Fernziel — wenn die Zwischenschritte etwas bedeuten würden.

**Rechnung 4 — Zahlungsunfähigkeit:** Startkapital 5 000 €, Kreditlimit −1 500 €, Händler-Fuhre bis 9 000 kg × 0,16 = 1 440 €. Ein Anfänger, der 4–5 Fuhren zum Marktpreis annimmt, ohne zu verkaufen, ist nach ~8 min bei „Konto leer — es liefert niemand mehr" (`main.ts:851`). Das ist eine mögliche Todesspirale im Tutorial: Karte 2 („nenn deinen Preis") lehrt annehmen, Karte 5 (verkaufen) kommt erst, wenn 300 kg sortiert und einmal gepresst wurde. Dazwischen kommen ~4 LKW.

**Fazit Wirtschaft:** Nicht schlüssig. Drei konkrete Brüche: (a) pauschaler Ankauf vs. materialabhängiger Verkauf, (b) HUD ² vs. Verkauf ³, (c) Verhandeln ist ökonomisch irrelevant neben der Fraktionswahl. Die Schwellen 15–160 t sind erreichbar, aber die Käufe dazwischen sind unfühlbar.

---

## 4. Monetarisierung

### 4.1 Ausgangslage im GDD

Premium 4,99 €, keine Werbung, keine In-App-Käufe (`02_Briefing.md:19`, `:682` „der Preis ist meine Setzung"). Begründung im GDD: Datenschutz-Angriffsfläche klein (`:677`). `10_Store_Veroeffentlichung.md:63-65` merkt korrekt an, dass Google Play einen Wechsel von gratis auf kostenpflichtig nicht erlaubt — die Entscheidung ist also einmalig.

### 4.2 Ehrliche Einschätzung (VERMUTUNG — Erfahrungswerte aus dem Mobile-Markt, keine aktuellen Zahlen geprüft)

**Sichtbarkeit.** Ein Premium-Titel ohne Publisher, ohne Community, ohne Presse hat im Play Store praktisch keine organische Auffindbarkeit. Die Kategorie „Simulation" ist von Free-to-Play-Titeln mit sechsstelligen Marketing-Budgets dominiert. Die Store-Suche belohnt Downloads und Bewertungen; ein 4,99-€-Titel bekommt beides zehn- bis hundertmal seltener als ein Gratis-Titel. Realistische Erwartung ohne Marketing: **zwei- bis niedrige dreistellige Verkäufe im ersten Jahr**, also einige Hundert Euro. Das ist keine „App zur Monetarisierung", sondern ein Hobbyprojekt mit Preisschild.

**Conversion.** Nutzer kaufen Premium-Mobile-Spiele fast nur bei (a) bekannter Marke, (b) PC/Konsolen-Port mit Reputation, (c) starker Presse/YouTube-Welle. Nichts davon liegt vor. Das größte Kaufhindernis ist zudem projektspezifisch: **Die Steuerung ist das Risiko** (5 Achsen, virtuelle Sticks). Niemand zahlt 4,99 € für etwas, von dem er nicht weiß, ob er es bedienen kann. Ein Premium-Modell ohne Probiermöglichkeit verschenkt genau die Spieler, die das Spiel tragen würden.

**Vergleichstitel (nach meinem Kenntnisstand, nicht tagesaktuell geprüft):**

| Titel | Modell auf Mobile | Lehre |
|---|---|---|
| PowerWash Simulator Mobile | Gratis-Download, Umsatz über In-App-Käufe (Inhalte/Freischaltung), von einem Publisher getragen | Selbst die Genre-Referenz mit PC-Ruhm ging auf Mobile nicht Premium |
| Bau-Simulator (Construction Simulator, astragon) | Premium (~5 €) **mit** Publisher und 10 Jahren Markenaufbau; ältere Teile als „Lite"-Gratisfassung zum Anfüttern | Premium funktioniert dort nur mit Marke; und selbst da gibt es eine Demo-Schiene |
| Car Mechanic Simulator (Mobile) | Gratis + Werbung + IAP | Publisher-getriebenes F2P |
| Junkyard-/Scrapyard-Spiele (Junkyard Tycoon u. ä.) | Gratis + Rewarded Ads + IAP, meist Idle-Mechanik | Das Schrottplatz-Thema ist auf Mobile als F2P-Nische besetzt, Premium ist dort nicht etabliert |

**Alternativen:**

| Modell | Für | Gegen |
|---|---|---|
| **A: Premium 4,99 €** (GDD) | Einfach; kein SDK; sauberer Datenschutz; passt zum „kein Stress"-Ton | Keine Sichtbarkeit, keine Probe, Steuerungsrisiko ungesichert; Ertrag vernachlässigbar |
| **B: Gratis + Rewarded Ads** | Höchste Download-Zahlen; Rewarded Ads (freiwillig, gegen Bonus) werden vom Publikum akzeptiert | Braucht Ad-SDK in Capacitor/WebView (technisch mühsam, Datenschutz/Consent-Dialog, Data-Safety-Formular wird komplex); Rewarded braucht etwas, das sich zu belohnen lohnt (z. B. „Abholer sofort", „Lambert räumt") — verträgt sich schlecht mit „kein Stress als Default" |
| **C: Gratis + Premium-Freischaltung (Free-to-Try)** | Spieler probieren Steuerung und Kern (z. B. erste 3 Tage / Ausbaustufe 1) kostenlos; ein einziger IAP (4,99 €) schaltet alles frei; keine Werbung; Data Safety bleibt schlank (Google Play Billing ist Google-eigen) | Ein IAP-SDK (Capacitor-Plugin für Google Play Billing) nötig; „gratis" im Store weckt F2P-Erwartungen; Konversion Free→Paid typisch 1–3 % |
| **D: Desktop-Demo zuerst (itch.io / Steam Next Fest)** | Das Spiel **ist** ein Desktop-Spiel (Tastatur+Maus, Entwicklungsplattform); ein Web-Build läuft ohne Store auf itch.io in 1 Tag; Feedback zu Spaß und Steuerung, bevor Mobile-Geld ausgegeben wird | Kein Umsatz; Mobile-Ziel verschiebt sich |

### 4.3 Empfehlung

**C + D, in dieser Reihenfolge:**

1. **Jetzt (Kosten 0):** Web-Build als **kostenlose Desktop-Demo** auf itch.io. Ziel ist nicht Umsatz, sondern die Antwort auf die Frage, die kein Test im Projekt beantwortet (`docs/Pruefung/02_Schwachstellen.md:23-40`): Macht es Spaß, und versteht ein Fremder die Steuerung? 20 Spieler mit einem 5-Fragen-Formular sind mehr wert als jede Balancing-Tabelle.
2. **Für den Play Store:** **Gratis mit einmaliger Premium-Freischaltung** (kein Abo, keine Werbung). Der kostenlose Teil endet an einem sichtbaren Punkt — z. B. nach dem ersten „Wochenende" (Tag 3) mit der Bilanz „Willi bietet dir den Platz an: 4,99 €". Das behält den Geist des GDD (keine Ads, kein Grind), sichert die Probe der Steuerung und ist Store-technisch reversibel (paid→free geht, free→paid nicht — mit einem IAP bleibt man flexibel).
3. **Nicht:** Rewarded Ads. Sie erzwingen ein Belohnungs-Design, das dem „kein Stress"-Kern widerspricht, und die Integration in einen WebView-Stack ist ein technisches Risiko, das das Projekt gerade nicht braucht.

Ehrliche Erwartung auch bei C: ohne Marketing bleibt es ein Nischenprodukt. Der Unterschied zu A ist nicht der Umsatz, sondern dass man **erfährt, ob es jemandem gefällt** — und das ist die Voraussetzung für alles Weitere.

---

## 5. Spezifikation: Ziel- und Missionsgerüst für v2 (max. 1 Seite)

Ziel: Der Spieler weiß in jedem Moment, **was er heute tun soll, warum, und was er dafür bekommt.** Nichts davon braucht neue Physik, neue Fahrzeuge oder neue Assets. Alles baut auf vorhandenen Zählern (`Account`, `Shift`, `Reputation`, `UpgradeState`, `Tutorial`) auf.

### 5.1 Rahmen („Story-light")

- Der Spieler ist **Daniel** (Kap. 26.1). **Willi Bäring** (`customers.ts:61`, härtester Händler) ist der Schwager, dem der Platz zur Hälfte gehört; er will ihn verkaufen, wenn Daniel ihn nicht in **30 Tagen** rentabel macht. **Lambert** (Vater, Platzarbeiter) ist die Stimme der Ermutigung und erklärt das Tutorial in Textblasen. Mario (Waage) und Janine (Kaffee) bleiben Kulisse.
- Das ist der ganze Plot. Er liefert: ein Ende (Tag 30), einen Antagonisten mit Gesicht, einen Grund fürs Geld (Anteil auskaufen) und eine Rechtfertigung für Fixkosten (Willis Anteil an der Pacht).
- Nach Tag 30: „Freies Spiel" — gleicher Rhythmus, keine Frist.

### 5.2 Tagesstruktur (ersetzt endlosen Umschlag)

| Phase | Dauer | Was passiert | Code-Anker |
|---|---|---|---|
| **Morgen** | Karte, 10 s | Tagesnummer, Kontostand, **3 Aufträge** (unten), Tagespreise (fest, später schwankend) | neues Modul `economy/day.ts`; `Daylight.time` auf 0,3 setzen |
| **Betrieb** | 12 min Echtzeit | Anlieferungen wie heute, aber **gedeckelt: 4 Fuhren pro Tag** (Tag 1–3: 2). Danach schließt das Tor (Schild „Feierabend"). Nachschub-Takt statt 7–15 s auf **60–120 s** | `VehicleManager.acceptDeliveries`, `routes.ts:109` |
| **Feierabend** | offen, Spieler beendet mit Taste/Button | Kein Nachschub mehr; sortieren, pressen, verladen. Kein Timer. | `Shift.jammed`-Mechanik entfällt |
| **Abend-Bilanz** | Karte | Einnahmen (Verkäufe), Ausgaben (Ankauf + **Fixkosten 150 €**), Aufträge erfüllt/verfehlt mit Bonus, Sortenreinheit Ø, **1–3 Sterne**, Ausbau-Fortschritt. Autosave. „Weiter → Tag n+1" | `Account` um `dayIncome/dayExpense` erweitern; `storeSave()` |

### 5.3 Die drei Tagesaufträge (Datenmodell `Contract` aus GDD Kap. 18 übernehmen)

Jeder Tag hat genau drei, aus einem Pool gezogen, Schwierigkeit nach Tag skaliert:

| Typ | Beispiel | Metrik (vorhanden) | Bonus |
|---|---|---|---|
| **Liefern** | „Abholer für 800 kg Alu, ≥ 90 % rein" | `sellContainer()` → `dominant`, `massKg`, `purity` | 100–300 € |
| **Räumen** | „Annahmefläche am Abend leer (< 500 kg lose)" | `measureLoose()` | 100 € |
| **Kunde** | „Nimm Hardwigs Fuhre zum Marktpreis an" / „Fertige Gießerei Hallmann in < 3 min ab" | `onWeighIn`/`onWeighOut`, `preisFaktor` | 150 € + Ruf |
| **Zerlegen** (ab Tag 5) | „Reiß den Motor aus dem Wrack und verkauf ihn als Stahl" | `composites`, `grip.tearing` | 200 € |

Anzeige: rechts oben, drei Zeilen mit Haken (GDD „Ziel-Tracker", Kap. 14.1). Verfehlen kostet nichts außer dem Bonus. **Drei erfüllte Aufträge = 3 Sterne.**

### 5.4 Sichtbare Ausbaustufen (ersetzt den 8er-Shop)

Drei Stufen, an **Tage und Sterne** gebunden, nicht nur an Geld — damit der Platz sich verändert, auch wenn man schlecht wirtschaftet:

| Stufe | Bedingung | Sichtbar | Spielwirkung |
|---|---|---|---|
| **1 Wiegehäuschen** | Start | `office.ts` Stage `hut` — **endlich einbinden** | — |
| **2 Büro** | ≥ 10 Sterne + 9 000 € | Stage `office` | Ladungszusammensetzung am Waage-Dialog sichtbar (Info, die heute fehlt); 5 Fuhren/Tag |
| **3 Halle + Radlader** | ≥ 25 Sterne + 20 000 € | Stage `hall`, Lambert im Radlader | Lambert räumt Fahrspuren selbst; Baggerausbau (Tempo 1,35×, Last 1,5×) **hier** und nicht bei 120 t |

Alles andere aus `upgrades.ts` (Dozer, Stapler, Magnet, Presse) wird gestrichen oder in „Später" geparkt. Drei Stufen, die man sieht, schlagen acht, von denen drei nichts tun.

### 5.5 Onboarding neu (Tag 0, ~6 min, GDD Kap. 14.3 wieder einsetzen)

1. Leerer Platz, ein Träger, Lambert-Blase: „Q/E dreht, R/F hebt" → Träger greifen → auf den Stahlhaufen (Ampel grün). **Blockiert, bis erledigt.**
2. Ein PKW-Anhänger, 5 Teile (3 Stahl, 1 Kupfer, 1 Holz). Griff-Info erklärt „orange + schwer = Kupfer".
3. Abholer rufen, Kupfer verladen, Verkauf → Geld-Toast. Bilanz Tag 0. Willi tritt auf: „30 Tage, Daniel."
4. Tag 1 beginnt mit 2 Fuhren und 3 Aufträgen.

Keine Verhandlung im Tutorial (kommt Tag 2 als Auftrag „Nimm die Fuhre zum Marktpreis"). Kein Pressen im Tutorial (Tag 4).

### 5.6 Wirtschafts-Korrekturen (Pflicht, je 1 Zeile Code)

1. Ankauf **materialabhängig**: `netKg × buyPricePerKg(Fraktion)` bei sortenreinen Fuhren; Mischfuhren pauschal 0,16 €/kg (das ist dann der bewusste „Mischschrott-Rabatt", der das Sortieren lohnt). `account.ts:46`.
2. Verkauf **Reinheit²** wie überall dokumentiert (`account.ts:119`), oder HUD auf ³ — eines von beiden.
3. Fixkosten 150 €/Tag in der Bilanz.
4. Sortierprämie 0,05 €/kg **wieder rein** als sichtbarer Ticker (Sekunden-Loop-Belohnung), gegenfinanziert über Fixkosten.

### 5.7 MVP-Schnitt für den Store

**MUSS:** Tagesstruktur (5.2) · 3 Aufträge mit 3 Sterne (5.3, Typen Liefern/Räumen/Kunde) · Bilanz-Karte · Onboarding (5.5) · Ausbau 3 Stufen (5.4, Büro/Halle sichtbar) · Wirtschafts-Korrekturen (5.6) · Willi/Lambert-Textblasen (10–15 Sätze) · Tag-30-Abschluss-Karte · Save pro Tag.
**KANN WEG (v2):** Verhandlungs-Dialog (durch Auftrag „zum Marktpreis annehmen" ersetzen, Formel behalten) · Ruf-System (drei Zahlen ohne Wirkung — stumm schalten, nicht löschen) · Dozer/Stapler/Magnet/größere Presse · Fahrspur-Störfall (`laneWatch.ts`) · Tageslicht-Nacht (Tag endet vor Dunkelheit) · 8 Händlerfamilien → 3 (Willi, Hardwig, Zöllner) · 7 Branchen → 3 · Bündelung (`consolidate`) bleibt technisch, ist aber kein Feature.
**NIE (für Store 1.0):** Graue Geschäfte (Kap. 26.6) · Kampagne über 30 Tage hinaus · Marktpreisschwankung · Kat/Batterie-Zerlegung.

---

## 6. Was vom 1 000-Zeilen-GDD in eine 150-Zeilen-v2 gehört

**Übernehmen (gekürzt):**

| Aus | Was | Zeilen-Budget |
|---|---|---|
| Kap. 1 | Elevator Pitch (1 Absatz) + Tabelle Genre/Plattform/Monetarisierung — Monetarisierung auf „Gratis + Premium-Freischaltung" ändern | 10 |
| Kap. 2 | Tragende Emotion **neu in einem Satz**: „Kompetenz: schwere Dinge sicher bewegen und am Abend sehen, was man geschafft hat." Zerstörung als Würze, nicht als Ziel. Die Tabelle „Was sich gut anfühlen muss" (5 Zeilen mit Abnahmekriterium) behalten | 15 |
| Kap. 3 | Zielgruppe (2 Zeilen), Zielgerät (1 Zeile), Landscape-only | 5 |
| Kap. 4 | Die vier Loops — **neu geschrieben nach Kap. 5 dieses Reviews**, je 2 Zeilen mit „Fertig, wenn" | 12 |
| Kap. 5.1 | Achsentabelle (nur Touch + Tastatur) | 10 |
| Kap. 7 | Materialtabelle auf 6 Zeilen (Stahl, Alu, VA, Kupfer, Kabel, Störstoff) mit Ankauf/Verkauf/Farbe — **Zahlen aus dem Code, nicht umgekehrt** | 10 |
| Kap. 14.3 | Onboarding-Tabelle (5 Zeilen) — die alte Fassung war richtig | 8 |
| Kap. 15 | Prinzip „Audio ist Belohnungskanal" (2 Zeilen) | 2 |
| Kap. 16 | Farbleitsystem (1 Zeile Hex-Codes), Stil (1 Satz) | 3 |
| Kap. 21 | MVP-Abgrenzung — **eine** Liste, nach Kap. 5.7 oben | 20 |
| Kap. 23 | Risiken auf 4 Zeilen (Mobile-Performance, Steuerung, Scope, Spaß ungetestet) | 5 |
| Kap. 26.1, 26.6 Leitplanke | Daniel (3 Zeilen), Ton-Leitplanke wörtlich (3 Zeilen) | 6 |
| Kap. 27 | **Als eigenes Dokument „Umsetzungsstand"** führen, nicht im GDD — und dort nur, was der Code tatsächlich tut (Ruf steuert *nicht* die Frequenz; Büro/Halle *nicht* sichtbar) | 0 im GDD |
| Neu | Ziel/Missionen/Ausbaustufen/Bilanz aus Kap. 5 dieses Reviews | 40 |

**Streichen:** Kap. 6 (Physik-Detail → Tech-Doc), 8.2 (Auto-Reihenfolge → Später), 9 (Beleg-Bürokratie), 10.2/10.3 (Upgrade-Baum, Balancing-Kurve — durch 3 Stufen ersetzt), 11 (Modi — es gibt einen), 12 (Platzplan → README), 13 (NPC-KI), 17–19 (Technik/Datenmodell/Budgets → Tech-Doc), 20 (Barrierefreiheit → 3 Zeilen in Kap. 5.1), 22 (Meilensteine → Projektplan), 24 (Glossar → Anhang), 25 (überholt durch Code), 26.2–26.5, 26.7 (Familien-/Branchen-Detail → Content-Doc, wenn überhaupt).

**Regel für v2:** Jede Zahl im GDD muss entweder aus dem Code kommen (dann mit Datei:Zeile) oder ein Playtest-Ziel sein (dann mit „Fertig, wenn"). Alles andere ist Meinung und gehört nicht hinein.

---

## 7. Was ich geprüft habe und was nicht

**Geprüft (gelesen, gerechnet):** Alle in der Aufgabe genannten Dateien vollständig; zusätzlich `delivery/vehicles.ts` (Zeilen 350–400, 470–490, 1060–1100), `delivery/routes.ts` (100–115), `world/scrapItems.ts` (110–260), `world/office.ts` (Kopf), `world/containers.ts` (290–300), `world/daylight.ts` (Kopf), `materials/purity.ts`, `core/input.ts` (Kopf), `index.html` (Hilfe-Overlay), Testnamen in `test/`. Alle Zahlen in Kap. 3.2 stammen aus Konstanten; die Mengenschätzungen (Griffe/min, Buntmetall-Anteil) sind Annahmen.

**Nicht geprüft:** Ich habe das Spiel nicht gestartet — keine Aussage zu Spielgefühl, Steuerung, Bildrate, Touch. Wie viel tatsächlich auf einen Abhol-LKW passt (`containedItems`, `vehicles.ts:470`), habe ich nur geometrisch abgeschätzt (Ladefläche 5,4 × 2,7 m). Ob die Tutorial-Karte 1 nach 12 s wirklich ohne Aktion weiterläuft, folgt aus `tutorial.ts:128` + `:53`, ist aber nicht beobachtet. Marktdaten in Kap. 4 sind Erfahrungswerte, nicht recherchiert.

**Zur Selbst-Einschätzung in `docs/Pruefung/`:** Sie ist im Technischen ehrlich (Physiklast, Testlücken), im Design aber blind — `02_Schwachstellen.md` kennt „Ziel unklar" nicht als Risiko, obwohl `10_Store_Veroeffentlichung.md:120-127` es als Punkt 1 und 2 der Release-Blocker nennt („Ohne Punkt 1 und 2 ist es eine Sandkiste, keine Kauf-App"). Dieser Satz ist der richtigste im ganzen Projekt.
