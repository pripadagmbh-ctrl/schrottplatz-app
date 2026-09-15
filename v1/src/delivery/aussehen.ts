/**
 * WIE EIN KUNDE AUSSIEHT — und der Wächter, der aufpasst, dass es nichts
 * verrät, was es nicht verraten darf.
 *
 * ANLASS. Patrick am Gerät (`docs/offene-punkte.md`, „Leute und Stimmung"):
 * „Schrotthändler sehen verschieden aus — gepflegt bis ölig, klein und dick
 * bis lang und dünn, Wiedererkennungsmerkmale (Goldkette, dicke Uhr,
 * Schäferhund)." Bis heute stieg aus jedem Wagen **dieselbe** Figur aus, in
 * denselben Farben, egal ob Willi Bäring kam oder Frau Öztürk.
 *
 * WO DIE DATEN STEHEN. Nicht hier. Hier stehen nur der TYP, die FARBTAFELN
 * und der WÄCHTER. Das Aussehen selbst steht **am Kunden** — in `FAMILIES`,
 * `TRADES` und `PRIVATLEUTE` in `customers.ts`, also in denselben Datensätzen,
 * die schon Namen, Spruch und Härtegrad tragen. Eine zweite Tabelle „Aussehen
 * je Name" daneben wäre genau die Fehlerklasse, an der dieses Projekt am
 * 15.09.2026 fünfmal hängengeblieben ist: zwei Stellen, die dasselbe wissen
 * sollen, und sie wissen es verschieden.
 *
 * ────────────────────────────────────────────────────────────────────────
 * TON-LEITPLANKE (Projektregel 7), hier als Rechenvorschrift
 * ────────────────────────────────────────────────────────────────────────
 *
 * Milieu entsteht aus Beruf, Familie und Geschäft — nie aus Herkunft. Beim
 * AUSSEHEN ist das schärfer zu fassen als bei Sprüchen, weil ein Bild
 * schneller zum Klischee wird als ein Satz. Deshalb gilt hier eine Regel, die
 * man nachrechnen kann:
 *
 *     ÜBER DIE GANZE KUNDSCHAFT HÄNGT KEIN AUSSEHENSMERKMAL MIT DER GRUPPE
 *     ODER MIT DEM VERHALTEN ZUSAMMEN.
 *
 * Also: Aus Statur, Pflegegrad, Hautton, Haarfarbe, Warnweste oder
 * Wiedererkennungsmerkmal lässt sich **nicht** ablesen, ob jemand Händler,
 * Gewerbe oder Privatmann ist, und **nicht**, wie hart er verhandelt. Der
 * gepflegte Händler drückt genauso zurück wie der ölige; die Goldkette sagt
 * nichts über den Preis und nichts über die Person außer: Man erkennt ihn
 * wieder.
 *
 * WAS DIE GRUPPE DANN NOCH ZEIGT: **das Fahrzeug**. Ein Händler kommt mit
 * Ladekran, ein Betrieb mit dem Firmenwagen, ein Privatmann mit PKW und
 * Anhänger (`vehicles.ts`, `withCrane`/`bodyStyle`). Das ist Beruf und
 * Geschäft, es steht am Gerät, nicht am Menschen — und es ist die ehrliche
 * Stelle dafür. Der Abbruchunternehmer sieht anders aus als der Privatmann,
 * weil er ein anderer Mensch ist und einen anderen Wagen fährt, nicht weil
 * „Abbruchunternehmer so aussehen".
 *
 * Geprüft wird das von `aussehensBefunde()` weiter unten, aufgerufen in
 * `test/kundenaussehen.test.ts` — mit Gegenprobe: eine absichtlich eingebaute
 * Korrelation MUSS gemeldet werden.
 */

/**
 * Das Wiedererkennungsmerkmal. **Genau eines je Figur** (Ansage: „zwei sind
 * zu viel"), und nicht jeder bekommt eines — `"keins"` ist der häufigste Fall.
 *
 * Alle bis auf den Hund sind Teil des Kleidungsnetzes und kosten deshalb kein
 * eigenes Netz. Der Hund ist der Sonderfall, siehe `world/kundenfigur.ts`.
 */
export type Merkmal = "keins" | "goldkette" | "uhr" | "muetze" | "bauchtasche" | "hund";

/** Alle Merkmale, in fester Reihenfolge — für Wächter und Werkzeuge. */
export const MERKMALE: Merkmal[] = [
  "keins",
  "goldkette",
  "uhr",
  "muetze",
  "bauchtasche",
  "hund",
];

export interface Aussehen {
  /**
   * Körperhöhe in Metern. Spanne 1,58 – 1,92 (`STATUR_KLEIN`/`STATUR_LANG`).
   * Gebaut wird damit nicht eine zweite Figur, sondern dieselbe mit anderen
   * Maßen.
   */
  groesse: number;
  /** Leibesfülle: 0 = lang und dünn, 1 = klein und dick. */
  fuelle: number;
  /** Pflegegrad: 0 = ölig, vom Betrieb gezeichnet; 1 = frisch und sauber. */
  pflege: number;
  /** Index in `HAUTTOENE`. */
  haut: number;
  /** Index in `HAARTOENE`. */
  haar: number;
  /** Index in `JACKENTOENE` — die Arbeitsjacke, an der man ihn von weitem kennt. */
  jacke: number;
  /**
   * Trägt eine Warnweste. KEIN Gruppenabzeichen: Auf einem Schrottplatz trägt
   * sie, wer eine dabei hat — der Privatmann mit Anhänger genauso wie der
   * Händler. Der Wächter hält das durch (`weste` gegen Gruppe und Härte).
   */
  weste: boolean;
  merkmal: Merkmal;
}

/* ----------------------------------------------------------- Farbtafeln -- */

/**
 * Hauttöne.
 *
 * Vier Töne, und der erste ist der, den jede Figur auf diesem Platz bisher
 * hatte (`world/people.ts`, `excavator/driver.ts`: 0xe3b18c) — damit Mario,
 * Janine, Lambert und Daniel weiter zur Kundschaft passen.
 *
 * SW. Die Verteilung ist NICHT zufällig und NICHT nach Gruppe: Jeder Ton
 * kommt in jeder der drei Gruppen vor, zweimal bis zwei-, dreimal (siehe
 * `customers.ts` und den Wächter). Das ist der ganze Punkt.
 */
export const HAUTTOENE = [0xe3b18c, 0xc98a5e, 0x9a6438, 0x6d4326];

/**
 * Haar- und Bartfarben: schwarz, dunkelbraun, hellbraun, grau, rotblond.
 * SW, gleiche Regel wie oben — jede Farbe kommt in jeder Gruppe vor.
 */
export const HAARTOENE = [0x241c16, 0x4a3a2e, 0x8a6a3a, 0x9a958c, 0xb35a26];

/**
 * Arbeitsjacken: marineblau, khaki, dunkelgrün, rotbraun, anthrazit.
 *
 * Der erste Ton ist der, den die Fahrerfigur bisher hatte (`vehicles.ts`:
 * `shirt: 0x3c4f63`) — er bleibt im Spiel, er ist jetzt nur nicht mehr der
 * einzige. Alles gedeckt: Ein Schrottplatz hat keine bunten Jacken, und die
 * eine kräftige Farbe auf dem Hof ist die Warnweste.
 *
 * SW, und wieder gilt: jede Jacke in jeder Gruppe, keine sagt etwas über den
 * Preis (Wächter).
 */
export const JACKENTOENE = [0x3c4f63, 0x4a4136, 0x2f3a33, 0x5a3a34, 0x3a3a3f];

/** Kleinste und größte Körperhöhe. SW — „klein und dick bis lang und dünn". */
export const STATUR_KLEIN = 1.58;
export const STATUR_LANG = 1.92;

/**
 * Ein neutrales Aussehen für Prüfstände und für den Abholer.
 *
 * Genau in der Mitte jeder Achse und ohne Merkmal: Wer es benutzt, prüft
 * etwas anderes als das Aussehen und soll durch die Figur keine Streuung in
 * seine Messung bekommen.
 */
export const AUSSEHEN_NEUTRAL: Aussehen = {
  groesse: 1.78,
  fuelle: 0.5,
  pflege: 0.5,
  haut: 0,
  haar: 1,
  jacke: 0,
  weste: true,
  merkmal: "keins",
};

/* -------------------------------------------------------- Der Wächter ---- */

/**
 * Ein Kunde, so wie der Wächter ihn sieht: Gruppe, Verhalten, Aussehen.
 *
 * Bewusst mit nackten `string`/`number` statt mit den Typen aus
 * `customers.ts` — so kann die Gegenprobe eine ABSICHTLICH schiefe Kundschaft
 * bauen, ohne das Spiel anzufassen.
 */
export interface KundenEintrag {
  name: string;
  /** "haendler" | "gewerbe" | "privat" */
  gruppe: string;
  /** Härtegrad 1–5: das Verhalten, das nicht sichtbar sein darf. */
  haerte: number;
  aussehen: Aussehen;
}

export interface Befund {
  /** Welches Aussehensmerkmal auffällig ist. */
  merkmal: string;
  /** Woran es hängt. */
  bezug: "gruppe" | "haerte";
  /** Die gemessene Kennzahl. */
  mass: number;
  /** Die Grenze, die sie überschritten hat. */
  grenze: number;
  text: string;
}

/**
 * Wie stark ein stufenloses Merkmal (Größe, Fülle, Pflege, Weste) mit dem
 * Härtegrad zusammenhängen darf — als Pearson-Korrelation.
 *
 * 0,30. Hergeleitet, nicht geraten: Bei n = 23 Kunden ist die 5-%-Schranke
 * für „kein Zusammenhang" rund |r| = 0,41 (t-Verteilung, 21 Freiheitsgrade).
 * Wer 0,30 unterschreitet, liegt also deutlich innerhalb dessen, was man bei
 * reinem Zufall erwartet — und die Gegenprobe (Pflege = Härte, |r| ≈ 1)
 * fliegt mit riesigem Abstand auf.
 */
export const R_GRENZE = 0.3;

/**
 * Wie weit der Gruppenmittelwert eines stufenlosen Merkmals vom
 * Gesamtmittel abweichen darf — auf die Achse 0–1 normiert.
 *
 * 0,12. Das ist rund ein Achtel der Achse; bei der Körperhöhe (Spanne 34 cm)
 * sind das 4 cm. Sagt man „die Gruppe X ist im Schnitt 4 cm größer", wäre das
 * am Bildschirm nicht zu sehen; 8 cm wären es.
 */
export const GRUPPEN_ABSTAND = 0.12;

/**
 * Wie viel der Gesamtspanne jede Gruppe mindestens abdecken muss.
 *
 * 0,70. Der Sinn: In jeder Gruppe muss es Kleine UND Lange, Dünne UND Dicke,
 * Gepflegte UND Ölige geben. Eine Gruppe, die nur das mittlere Drittel
 * besetzt, hätte einen Mittelwert wie alle anderen und wäre trotzdem sofort
 * erkennbar — der Mittelwert allein reicht als Wächter nicht.
 */
export const GRUPPEN_SPANNE = 0.7;

/**
 * Wie weit der mittlere Härtegrad einer Merkmalsausprägung (Hautton,
 * Haarfarbe, Wiedererkennungsmerkmal) vom Gesamtmittel abweichen darf.
 *
 * 0,60 Härtestufen bei einer Skala von 1 bis 5. Anders gesagt: Wer alle
 * Goldkettenträger zusammennimmt, darf daraus keine halbe Härtestufe
 * herauslesen können. Die Gegenprobe („Goldkette nur bei Härte 5") kommt auf
 * über 2,5 Stufen.
 */
export const HAERTE_ABSTAND = 0.6;

function mittel(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Pearson-Korrelation; 0, wenn eine der beiden Reihen konstant ist. */
export function korrelation(xs: number[], ys: number[]): number {
  const mx = mittel(xs);
  const my = mittel(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

/** Körperhöhe auf 0–1 normiert, damit alle Achsen dieselbe Grenze teilen. */
export function groesseNormiert(a: Aussehen): number {
  return (a.groesse - STATUR_KLEIN) / (STATUR_LANG - STATUR_KLEIN);
}

/** Die vier stufenlosen Achsen, so wie der Wächter sie liest. */
const ACHSEN: Array<{ name: string; wert: (a: Aussehen) => number }> = [
  { name: "groesse", wert: groesseNormiert },
  { name: "fuelle", wert: (a) => a.fuelle },
  { name: "pflege", wert: (a) => a.pflege },
  { name: "weste", wert: (a) => (a.weste ? 1 : 0) },
];

/** Die abzählbaren Merkmale. */
const KLASSEN: Array<{ name: string; wert: (a: Aussehen) => string }> = [
  { name: "haut", wert: (a) => `Ton ${a.haut}` },
  { name: "haar", wert: (a) => `Haar ${a.haar}` },
  { name: "jacke", wert: (a) => `Jacke ${a.jacke}` },
  { name: "merkmal", wert: (a) => a.merkmal },
];

/**
 * Alles, was an dieser Kundschaft Gruppe oder Verhalten verrät.
 *
 * Leere Liste heißt: Aus dem Aussehen ist nichts abzulesen. Jeder Eintrag
 * nennt Merkmal, Bezug, Messwert und Grenze — damit man beim Nachbessern
 * weiß, welche Zeile in `customers.ts` zu drehen ist.
 */
export function aussehensBefunde(liste: KundenEintrag[]): Befund[] {
  const befunde: Befund[] = [];
  if (liste.length < 3) return befunde;
  const gruppen = [...new Set(liste.map((k) => k.gruppe))].sort();
  const haerten = liste.map((k) => k.haerte);
  const haerteMittel = mittel(haerten);

  for (const achse of ACHSEN) {
    const werte = liste.map((k) => achse.wert(k.aussehen));

    // (1) Hängt die Achse am Härtegrad?
    const r = korrelation(werte, haerten);
    if (Math.abs(r) > R_GRENZE) {
      befunde.push({
        merkmal: achse.name,
        bezug: "haerte",
        mass: r,
        grenze: R_GRENZE,
        text:
          `${achse.name} haengt am Haertegrad (r = ${r.toFixed(2)}, erlaubt ` +
          `${R_GRENZE}). Aus dem Aussehen liesse sich ablesen, wer hart verhandelt.`,
      });
    }

    // (2) Hängt sie an der Gruppe? Mittelwert …
    const ganz = mittel(werte);
    const min = Math.min(...werte);
    const max = Math.max(...werte);
    const spanne = max - min;
    for (const g of gruppen) {
      const inG = liste.filter((k) => k.gruppe === g).map((k) => achse.wert(k.aussehen));
      if (inG.length === 0) continue;
      const d = Math.abs(mittel(inG) - ganz);
      if (d > GRUPPEN_ABSTAND) {
        befunde.push({
          merkmal: achse.name,
          bezug: "gruppe",
          mass: d,
          grenze: GRUPPEN_ABSTAND,
          text:
            `${achse.name}: Gruppe "${g}" liegt im Mittel ${d.toFixed(2)} neben ` +
            `allen anderen (erlaubt ${GRUPPEN_ABSTAND}).`,
        });
      }
      // … und Spannweite. Ein gleicher Mittelwert bei halber Spanne faellt sonst durch.
      if (spanne > 0 && inG.length >= 3) {
        const abdeckung = (Math.max(...inG) - Math.min(...inG)) / spanne;
        if (abdeckung < GRUPPEN_SPANNE) {
          befunde.push({
            merkmal: achse.name,
            bezug: "gruppe",
            mass: abdeckung,
            grenze: GRUPPEN_SPANNE,
            text:
              `${achse.name}: Gruppe "${g}" deckt nur ${(abdeckung * 100).toFixed(0)} % ` +
              `der Spanne ab (verlangt ${GRUPPEN_SPANNE * 100} %). Dort fehlen die Aussenfaelle.`,
          });
        }
      }
    }
  }

  for (const klasse of KLASSEN) {
    const werte = [...new Set(liste.map((k) => klasse.wert(k.aussehen)))].sort();
    for (const w of werte) {
      const traeger = liste.filter((k) => klasse.wert(k.aussehen) === w);
      // Einzelstuecke sagen nichts aus — ein Merkmal, das einmal vorkommt,
      // kann gar nicht anders, als in genau einer Gruppe zu stehen.
      if (traeger.length < 2) continue;

      const gruppenDort = new Set(traeger.map((k) => k.gruppe));
      if (gruppenDort.size < 2) {
        befunde.push({
          merkmal: `${klasse.name}=${w}`,
          bezug: "gruppe",
          mass: gruppenDort.size,
          grenze: 2,
          text:
            `${klasse.name}=${w} kommt ${traeger.length}x vor, aber nur in der Gruppe ` +
            `"${[...gruppenDort][0]}". Damit ist es ein Gruppenabzeichen.`,
        });
      }

      const d = Math.abs(mittel(traeger.map((k) => k.haerte)) - haerteMittel);
      if (d > HAERTE_ABSTAND) {
        befunde.push({
          merkmal: `${klasse.name}=${w}`,
          bezug: "haerte",
          mass: d,
          grenze: HAERTE_ABSTAND,
          text:
            `${klasse.name}=${w}: mittlerer Haertegrad liegt ${d.toFixed(2)} Stufen ` +
            `neben dem Schnitt (erlaubt ${HAERTE_ABSTAND}).`,
        });
      }
    }
  }
  return befunde;
}
