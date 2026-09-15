import { CONFIGS, lagerMuldeFuer, bayHalb } from "./containers";
import type { ItemManager, ScrapItem } from "./scrapItems";

/**
 * PLATZINVENTAR — was zum Platz gehoert und nicht zur Ware.
 *
 * Ansage Patrick 15.09.2026 ueber den Muellcontainer: „Selbst wenn er mal
 * aufgeladen wird, gibt es kein Geld dafuer. Auch wenn er in der Presse mal
 * verschwindet, gaebe es kein Geld dafuer. … Also wie auch der Besen ist es
 * ein fester Bestandteil des Platzes."
 *
 * Damit ist es keine Eigenheit eines Containers, sondern eine GATTUNG: Der
 * Besen aus dem Nachbarpaket gehoert genauso dazu. Was sie teilen, steht hier
 * an einer Stelle, damit nicht zwei Sonderwege entstehen, die spaeter
 * auseinanderlaufen.
 *
 * Ein Stueck Platzinventar ist:
 *
 *  - **unverkaeuflich** — es taucht in keiner Geldformel auf, weder ganz noch
 *    anteilig, weder leer noch voll;
 *  - **beweglich und heimatlos** — der Spieler stellt es hin, wo er will, und
 *    dort bleibt es. Es schnappt an keine Sollposition zurueck (ausdruecklich:
 *    „Der Container soll erstmal frei bleiben, damit ich auch testen kann, wo
 *    der am besten steht");
 *  - **nicht verlierbar** — die Wege, auf denen es verschwinden koennte, sind
 *    zugemauert statt hinterher repariert. Beim Muellcontainer sind das zwei:
 *    Die Presskammer misst licht 4,20 x 4,05 m, der Container 3,60 x 4,30 m —
 *    er passt in keiner Lage hinein. Und nimmt ihn ein Abholer mit, bringt der
 *    Fahrer ihn zurueck und kippt ihn beim Bagger ab (Ansage 15.09.2026).
 */

/** Was ein Stueck Platzinventar im Verkauf bringt. Immer. */
export const PLATZINVENTAR_EUR = 0;

/** Traegt dieser Datensatz das Kennzeichen? */
export function istPlatzinventar(x: { platzinventar?: boolean } | null | undefined): boolean {
  return x?.platzinventar === true;
}

/* --------------------------------------------------------- Tageswechsel --- */

/**
 * Der Tageswechsel, so wie ihn das Spiel heute wirklich hat.
 *
 * `economy/shift.ts` fuehrt KEINEN Tagesablauf und keine Phasen: `Shift`
 * zaehlt Sekunden, Umschlag und Fuhren und macht die Einfahrt zu, wenn der
 * Platz zusteht — einen Morgen gibt es dort nicht. Der einzige Tageswechsel,
 * den das Spiel kennt, ist die Uhr: `world/daylight.ts` laesst `time` ueber
 * Mitternacht laufen (`% 1`), ein Tag dauert 900 s Echtzeit. Daran haengt
 * diese Wache, und an nichts sonst — ein zweiter, erfundener Tagesanfang
 * waere eine zweite Wahrheit ueber dieselbe Sache.
 *
 * Gemeldet wird der Wechsel NICHT per Rueckruf, sondern abgeholt: Wer
 * mitbekommen will, dass ein neuer Tag begonnen hat, fragt einmal je Runde
 * `tagGewechselt("sein-name")`. So braucht es keine Verdrahtung in `main.ts`
 * und keine feste Reihenfolge — wer zuerst fragt, bekommt die Antwort, und
 * jeder Frager bekommt sie genau einmal.
 */
export class Platzwache {
  /** Wievielter Arbeitstag. Der erste Morgen ist Tag 1. */
  tag = 1;
  private gesehen = new Map<string, number>();

  /** Die Uhr ist ueber Mitternacht gelaufen. */
  neuerTag(): number {
    this.tag++;
    return this.tag;
  }

  /**
   * Hat der Tag gewechselt, seit `wer` zuletzt gefragt hat?
   *
   * Beim allerersten Mal ist die Antwort `false` — der Spielstart ist kein
   * Tageswechsel, sonst raeumte die Nachtschicht schon in der ersten Sekunde.
   */
  tagGewechselt(wer: string): boolean {
    const zuletzt = this.gesehen.get(wer);
    this.gesehen.set(wer, this.tag);
    return zuletzt !== undefined && zuletzt !== this.tag;
  }
}

/**
 * Die eine Wache, an der die Uhr haengt.
 *
 * Ein Modulwert und kein Feld in `main.ts`: Die Uhr (`Daylight`) und die
 * Behaelter (`ContainerManager`) kennen einander nicht und sollen es auch
 * nicht. Fuer Tests gibt es die Klasse daneben — dort wird eine eigene Wache
 * gebaut, damit sich zwei Tests nicht gegenseitig den Tag weiterdrehen.
 */
export const platzwache = new Platzwache();

/* ------------------------------------------- Inhalt ins Lager raeumen ----- */

/**
 * DIE EINE REGEL: „Inhalt ins Abfall-Silo, Huelle bleibt."
 *
 * Sie hat zwei Ausloeser und deshalb genau eine Funktion (Ansage Patrick
 * 15.09.2026):
 *
 *  1. TAGESWECHSEL — „Wenn mal Muell verschwindet, dann verschwindet er ueber
 *     Nacht nicht, sondern landet in dem Muellsilo. Da wird er dann gelagert.
 *     Und der Container stuende wieder bei mir."
 *  2. ABHOLER NIMMT DEN CONTAINER MIT — „Mit ohne Muell in dem Fall. Und der
 *     Muell landet natuerlich bei uns im Silo."
 *
 * Es ist ausdruecklich KEIN Verkauf: Kein Euro wechselt den Besitzer, das
 * Material bleibt im Spiel und liegt danach da, wo es auch Lambert hingetragen
 * haette (`people.ts`, `muldeFuer`). Deshalb wird nichts geloescht, sondern
 * versetzt — die Kilogramm muessen im Silo ankommen, sonst stimmt die Bilanz
 * des Platzes nicht mehr.
 *
 * Abzuschalten ist der ganze Vorgang an einer Stelle: `NACHTSCHICHT = false`.
 */
export const NACHTSCHICHT = true;

/**
 * Wie die Stuecke im Silo abgesetzt werden.
 *
 * Rasterweise und ueber dem, was schon drinliegt — nie ineinander. Zwei
 * Koerper, die sich beim Anlegen ueberlappen, treibt Rapier mit voller Kraft
 * auseinander; genau davor warnt die Lehre aus v2 (E-010, „Spawn ohne
 * Ueberlappung"). Ein Raster von 1,05 m ist breiter als das groesste
 * Abfallstueck (Reifen, rund 0,70 m) und laesst in einem 4,20 x 6,00 m
 * grossen Silo 4 x 5 = 20 Plaetze je Lage.
 */
const RASTER_M = 1.05;
const LAGEN = 3;
/** Fallhoehe ueber dem vorhandenen Haufen — kurz genug, dass nichts springt. */
const ABSETZ_HOEHE = 0.8;

export interface LagerBericht {
  /** Wieviel kg wirklich im Silo angekommen sind */
  kg: number;
  /** Wieviele Stuecke */
  stueck: number;
  /** Wieviele liegengeblieben sind, weil kein Platz mehr war */
  rest: number;
}

/**
 * Alles, was `gehoertDazu` einsammelt, in das Lagersilo seiner Fraktion
 * versetzen.
 *
 * @param items     der ItemManager des laufenden Spiels
 * @param gehoertDazu  Punktprobe: liegt dieses Stueck im Container?
 */
export function inhaltInsLager(
  items: ItemManager,
  gehoertDazu: (p: { x: number; y: number; z: number }) => boolean
): LagerBericht {
  const bericht: LagerBericht = { kg: 0, stueck: 0, rest: 0 };
  if (!NACHTSCHICHT) return bericht;

  /*
   * ERST SAMMELN, DANN ANWENDEN (Lehre aus v2, E-044). Waehrend des Versetzens
   * wandern Koerper in andere Zonen; wer in derselben Schleife liest und
   * schreibt, versetzt Stuecke zweimal oder gar nicht.
   */
  const zuTragen: Array<{ item: ScrapItem; ziel: string }> = [];
  for (const it of items.items) {
    if (!it.body.isValid() || !it.body.isDynamic()) continue;
    const p = it.body.translation();
    if (!gehoertDazu(p)) continue;
    const ziel = lagerMuldeFuer(it.materialId);
    if (!ziel) continue; // ohne Lager bleibt es liegen — lieber sichtbar als weg
    zuTragen.push({ item: it, ziel: ziel.id });
  }
  if (zuTragen.length === 0) return bericht;

  /* Je Ziel-Silo ein eigener Rasterzaehler und eine eigene Absetzhoehe. */
  const belegt = new Map<string, number>();
  for (const { item, ziel } of zuTragen) {
    const cfg = CONFIGS.find((c) => c.id === ziel)!;
    const { hw, hd } = bayHalb(cfg);
    const spaltenX = Math.max(1, Math.floor((2 * hw - 0.8) / RASTER_M));
    const spaltenZ = Math.max(1, Math.floor((2 * hd - 0.8) / RASTER_M));
    const proLage = spaltenX * spaltenZ;
    const n = belegt.get(ziel) ?? 0;
    if (n >= proLage * LAGEN) {
      // Kein Platz mehr: das Stueck bleibt, wo es ist. Keine erfundene Regel,
      // kein Verschwinden — es faellt auf und wird gemeldet.
      bericht.rest++;
      continue;
    }
    belegt.set(ziel, n + 1);
    const lage = Math.floor(n / proLage);
    const i = n % proLage;
    const gx = i % spaltenX;
    const gz = Math.floor(i / spaltenX);
    const x = cfg.x - hw + 0.4 + (gx + 0.5) * ((2 * hw - 0.8) / spaltenX);
    const z = cfg.z - hd + 0.4 + (gz + 0.5) * ((2 * hd - 0.8) / spaltenZ);
    const y = ABSETZ_HOEHE + lage * ABSETZ_HOEHE;
    const b = item.body;
    b.setTranslation({ x, y, z }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.wakeUp();
    item.containerId = ziel;
    bericht.kg += item.massKg;
    bericht.stueck++;
  }
  return bericht;
}
