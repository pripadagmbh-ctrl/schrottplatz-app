/**
 * DIE MULDENWAND, DREIMAL BEFRAGT — Stein, Kollider, Hinderniseintrag.
 *
 * Anlass, woertlich (Patrick am Geraet, 22.09.2026):
 *   „Kollisionsprüfung ohne Mauer bei Buntmetallmulde?"
 *   „die spinne bleibt über dem abgesenkten muldenwand stehen"
 *
 * Eine Muldenwand ist im Spiel dreimal vorhanden, und jede der drei Fassungen
 * wirkt auf etwas anderes:
 *
 *   STEIN     das Bild — was Patrick sieht (`Container`, `kind === "bay"`)
 *   KOLLIDER  die Physik — woran Schrott und Spinne anstossen (Rapier)
 *   EINTRAG   die Karte — was `hitsObstacle` sperrt, also Unterwagen, Arm,
 *             Lambert und die LKW (`obstacles.ts`, `STATIC_OBSTACLES`)
 *
 * Bis zum 22.09.2026 rechnete jede Fassung selbst. Dieses Geraet stellt sie
 * nebeneinander und misst den Unterschied in Metern, statt ihn zu schaetzen.
 *
 * VIER ABSCHNITTE:
 *
 *   A  GRUNDRISS    Stein gegen Eintrag, je Mulde und je Wand. Wieviel Sperre
 *                   steht ohne Stein, wieviel Stein ohne Sperre? Gemessen
 *                   gegen die heutige Liste UND gegen die Fassung vor E-110,
 *                   damit die Reparatur eine Zahl hat.
 *   B  STRAHL       Die Kollider-Oberkante, gemessen wie `surfaceUnderClaws`
 *                   sie misst: ein Strahl von oben, erster fester Treffer.
 *   C  SCHWELLE     Haelt die 1,00 m hohe Schwelle den Schrott auch ohne die
 *                   unsichtbare 3-m-Wand? Gezaehlt, nicht vermutet.
 *   D  FOLGEN       Was die um 0,20 m nach aussen und 0,35 m nach innen
 *                   verschobenen Sperren kosten und bringen: erreichbarer
 *                   Muldenboden, Luft zum Muellcontainer.
 *
 * Aufruf:  npx vite-node tools/muldenwand-abgleich.ts
 */
import { leinwandAttrappe } from "./leinwand-attrappe";
leinwandAttrappe();
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { EventBus } from "../src/core/events";
import {
  CONFIGS,
  ContainerManager,
  MULDE_STEIN,
  muldenWaendeWelt,
  type ContainerConfig,
} from "../src/world/containers";
import { ItemManager, type ScrapShape } from "../src/world/scrapItems";
import { STATIC_OBSTACLES } from "../src/world/obstacles";
import { BAGGER_STAND, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { UNTERWAGEN_HALB_B } from "../src/excavator/unterwagenParts";

await initPhysics();

const m2 = (x: number): string => x.toFixed(2).padStart(6);
const m3 = (x: number): string => x.toFixed(3).padStart(7);

/** Ein achsenparalleles Rechteck, wie es in beiden Listen steht. */
interface Rechteck {
  x: number;
  z: number;
  hw: number;
  hd: number;
  top: number;
  label: string;
}

/* ================================================================= A ==== */
/**
 * Die Hinderniseintraege, WIE SIE VOR E-110 GERECHNET WURDEN.
 *
 * Wortgleich aus `obstacles.ts` vom 21.09.2026 uebernommen (`BAY_T = 0.35`,
 * `RUECKWAND_PLUS = 1.0`, Mittellinien auf der Muldenkante). Sie steht hier,
 * damit die Reparatur eine Zahl hat und nicht nur eine Behauptung — und sie
 * steht NUR hier, nicht mehr im Spiel.
 */
const BAY_T_ALT = 0.35;
const RUECKWAND_PLUS_ALT = 1.0;
function gemeldetAlt(cfg: ContainerConfig): Rechteck[] {
  if (cfg.kind !== "bay") return [];
  const [w, d, top] = cfg.size;
  const nord = cfg.facing === "north";
  const hw = (nord ? d : w) / 2;
  const hd = (nord ? w : d) / 2;
  const L = cfg.label;
  if (nord) {
    return [
      { x: cfg.x, z: cfg.z - hd, hw, hd: BAY_T_ALT, top, label: `${L} Süd` },
      { x: cfg.x - hw, z: cfg.z, hw: BAY_T_ALT, hd, top, label: `${L} West` },
      { x: cfg.x + hw, z: cfg.z, hw: BAY_T_ALT, hd, top, label: `${L} Ost` },
    ];
  }
  const stirn = cfg.facing === "east" ? -hw : hw;
  const out: Rechteck[] = [];
  if (!cfg.shareSouth)
    out.push({ x: cfg.x, z: cfg.z - hd, hw, hd: BAY_T_ALT, top, label: `${L} Süd` });
  if (!cfg.shareNorth)
    out.push({ x: cfg.x, z: cfg.z + hd, hw, hd: BAY_T_ALT, top, label: `${L} Nord` });
  if (!cfg.shareEast)
    out.push({
      x: cfg.x + stirn,
      z: cfg.z,
      hw: BAY_T_ALT,
      hd,
      top: top + RUECKWAND_PLUS_ALT,
      label: `${L} Stirn`,
    });
  else if (cfg.niedrigeStirn)
    out.push({
      x: cfg.x + stirn,
      z: cfg.z,
      hw: BAY_T_ALT,
      hd,
      top: cfg.niedrigeStirn,
      label: `${L} Schwelle`,
    });
  return out;
}

/** Die gebauten Steine einer Mulde als Rechtecke auf dem Platz. */
function gebaut(cfg: ContainerConfig): Rechteck[] {
  return muldenWaendeWelt(cfg).map((w) => ({
    x: w.x,
    z: w.z,
    hw: w.hw,
    hd: w.hd,
    top: w.top,
    label: `${cfg.label} ${w.teil}`,
  }));
}

/** Von wo bis wo ein Rechteck auf einer Achse reicht. */
const spanne = (r: Rechteck, achse: "x" | "z"): [number, number] =>
  achse === "x" ? [r.x - r.hw, r.x + r.hw] : [r.z - r.hd, r.z + r.hd];

/**
 * Wieviel steht vom einen ueber das andere hinaus — Ende fuer Ende.
 * `[unten, oben]`, positiv heisst „a reicht weiter als b".
 */
function ueberstand(a: [number, number], b: [number, number]): [number, number] {
  return [Math.max(0, b[0] - a[0]), Math.max(0, a[1] - b[1])];
}

console.log("=== A · GRUNDRISS: Stein gegen Hinderniseintrag ===\n");
console.log(
  "Steindicke MULDE_STEIN.dicke = " +
    MULDE_STEIN.dicke.toFixed(2) +
    " m, alte Eintragsdicke BAY_T = " +
    BAY_T_ALT.toFixed(2) +
    " m\n"
);
let maxSperreOhneStein = 0;
let maxSteinOhneSperre = 0;
for (const cfg of CONFIGS.filter((c) => c.kind === "bay" || c.kind === "halde")) {
  const st = gebaut(cfg);
  const alt = gemeldetAlt(cfg);
  const jetzt = STATIC_OBSTACLES.filter((o) => o.label.startsWith(`${cfg.label} `)) as Rechteck[];
  console.log(
    `--- ${cfg.label} (${cfg.kind}, ${cfg.facing ?? "west"}), Mitte (${cfg.x.toFixed(2)} | ${cfg.z.toFixed(
      2
    )}), ${cfg.size[0]}×${cfg.size[1]}×${cfg.size[2]} m`
  );
  if (st.length === 0) {
    console.log(
      `    keine Waende gebaut — Eintraege: alt ${alt.length}, jetzt ${jetzt.length}` +
        (cfg.kind === "halde" ? " (haldeWaende alles false)" : "")
    );
    continue;
  }
  for (const wand of st) {
    // Der alte Eintrag zu dieser Wand: der mit dem naechsten Mittelpunkt
    const partner = (liste: Rechteck[]): Rechteck | undefined =>
      liste
        .slice()
        .sort(
          (a, b) => Math.hypot(a.x - wand.x, a.z - wand.z) - Math.hypot(b.x - wand.x, b.z - wand.z)
        )[0];
    const a = partner(alt);
    const j = partner(jetzt);
    console.log(`  ${wand.label}`);
    for (const achse of ["x", "z"] as const) {
      const s = spanne(wand, achse);
      const richtung = achse === "x" ? "x" : "z";
      const zeile = (name: string, r: Rechteck | undefined): string => {
        if (!r) return `      ${name}: —`;
        const g = spanne(r, achse);
        const [sperreU, sperreO] = ueberstand(g, s); // Eintrag reicht weiter
        const [steinU, steinO] = ueberstand(s, g); // Stein reicht weiter
        maxSperreOhneStein = Math.max(maxSperreOhneStein, sperreU, sperreO);
        maxSteinOhneSperre = Math.max(maxSteinOhneSperre, steinU, steinO);
        return (
          `      ${name} ${richtung} ${m2(g[0])} … ${m2(g[1])}` +
          `  Sperre ohne Stein ${m2(sperreU)} / ${m2(sperreO)}` +
          `  Stein ohne Sperre ${m2(steinU)} / ${m2(steinO)}`
        );
      };
      console.log(`      Stein  ${richtung} ${m2(s[0])} … ${m2(s[1])}   Oberkante ${m2(wand.top)}`);
      console.log(zeile("alt   ", a));
      console.log(zeile("jetzt ", j));
    }
    if (a) console.log(`      Oberkante: Stein ${m2(wand.top)} · alt ${m2(a.top)} · jetzt ${m2(j?.top ?? NaN)}`);
  }
}
console.log(
  `\nGroesste Abweichung gegen die HEUTIGE Liste muss 0 sein — gemessen: ` +
    `Sperre ohne Stein ${m3(maxSperreOhneStein)} m, Stein ohne Sperre ${m3(maxSteinOhneSperre)} m ` +
    `(beide Zahlen enthalten die alte Fassung; die Zeilen „jetzt" darueber sind die Probe)\n`
);

/* ================================================================= B ==== */
console.log("=== B · STRAHL VON OBEN: Kollider-Oberkante, wie surfaceUnderClaws sie sieht ===\n");

function baueWelt(): { world: RAPIER.World; scene: THREE.Scene; items: ItemManager } {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  new ContainerManager(scene, world, new EventBus());
  // EIN Schritt, bevor gefragt wird: Rapier baut seinen Suchbaum erst im
  // `step()` auf. Ohne ihn trifft jeder Strahl ins Leere (erste Fassung dieses
  // Geraets: lauter NaN, obwohl die Wand dastand).
  world.step();
  return { world, scene, items };
}

/** Erster fester Treffer unter (x|z), von 8 m Hoehe aus. Wie `surfaceUnderClaws`. */
function oberkante(world: RAPIER.World, x: number, z: number): number {
  const ray = new RAPIER.Ray({ x, y: 8, z }, { x: 0, y: -1, z: 0 });
  const t = world.castRay(ray, 12, true);
  return t ? 8 - t.timeOfImpact : NaN;
}

const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
{
  const { world } = baueWelt();
  console.log("  Mulde / Wand                 Stein   Eintrag   Strahl");
  for (const cfg of CONFIGS.filter((c) => c.kind === "bay")) {
    for (const wand of gebaut(cfg)) {
      // Der Eintrag zu dieser Wand: der mit dem naechsten Mittelpunkt
      const e = STATIC_OBSTACLES.filter((o) => o.label.startsWith(`${cfg.label} `)).sort(
        (a, b) =>
          Math.hypot(a.x - wand.x, a.z - wand.z) - Math.hypot(b.x - wand.x, b.z - wand.z)
      )[0];
      const strahl = oberkante(world, wand.x, wand.z);
      const gleich = Math.abs(strahl - wand.top) < 0.005 && Math.abs((e?.top ?? NaN) - wand.top) < 0.005;
      console.log(
        `  ${wand.label.padEnd(26)} ${m2(wand.top)}   ${m2(e?.top ?? NaN)}   ${m2(strahl)}   ${
          gleich ? "" : "  ← AUSEINANDER"
        }`
      );
    }
  }
  /*
   * Und nun die Fassung VOR E-110 an derselben Stelle: Der Rueckwand-Kollider
   * entstand ohne Bedingung, also auch an der Mulde mit `shareEast`. Genau
   * diese Zahl bringt die Spinne zum Stehen.
   */
  const [w, d, h] = bunt.size;
  const T = MULDE_STEIN.dicke;
  const lagen = Math.max(2, Math.round(h / MULDE_STEIN.hoehe)) + 2;
  const hoch = lagen * MULDE_STEIN.hoehe;
  const koerper = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(bunt.x, 0, bunt.z)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(T / 2, hoch / 2, d / 2 + T).setTranslation(
      w / 2 + T / 2,
      hoch / 2,
      0
    ),
    koerper
  );
  const wandMitte = gebaut(bunt).find((x) => x.label.endsWith("schwelle"))!;
  console.log(
    `\n  Gegenprobe „Stand E-109" an der Schwelle (${wandMitte.x.toFixed(2)} | ${wandMitte.z.toFixed(
      2
    )}):`
  );
  console.log(
    `    Rueckwand-Kollider ohne Bedingung nachgebaut (${lagen} Lagen = ${hoch.toFixed(
      2
    )} m) → Strahl trifft auf ${m2(oberkante(world, wandMitte.x, wandMitte.z))} m,` +
      ` sichtbare Steine ${m2(wandMitte.top)} m`
  );
}

/* ================================================================= C ==== */
console.log("\n=== C · HAELT DIE SCHWELLE? Schrott in die Mulde, gezaehlt ===\n");
/**
 * Volle Mulde, dann gezaehlt, was auf der Baggerseite (Osten) ueber die
 * Schwelle hinaus liegt. Zweimal: mit der unsichtbaren 3-m-Wand („Stand
 * E-109") und ohne sie („jetzt").
 */
function schwellenProbe(
  mitAlterWand: boolean,
  saat: number
): { drin: number; drueber: number; vorn: number } {
  const { world, items } = baueWelt();
  const [w, d, h] = bunt.size;
  const T = MULDE_STEIN.dicke;
  if (mitAlterWand) {
    const hoch = (Math.max(2, Math.round(h / MULDE_STEIN.hoehe)) + 2) * MULDE_STEIN.hoehe;
    const k = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(bunt.x, 0, bunt.z));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(T / 2, hoch / 2, d / 2 + T).setTranslation(w / 2 + T / 2, hoch / 2, 0),
      k
    );
  }
  // Ein billiger, wiederholbarer Zufall — dieselbe Saat, dieselbe Fuellung.
  let s = saat;
  const zuf = (): number => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const form: ScrapShape = { kind: "box", dims: [0.55, 0.4, 0.7], color: 0x8899aa };
  /*
   * SW: 160 Kisten à 0,15 m³ auf 25 m² Muldenboden — locker geschuettet reicht
   * das ueber die 1,00 m hohe Schwelle hinaus. Mit 60 Stueck (erste Fassung)
   * blieb der Haufen unter der Schwelle, und beide Faelle meldeten null: eine
   * Messung, die nichts messen kann.
   */
  const STUECK = 160;
  for (let i = 0; i < STUECK; i++) {
    items.spawnScrap(
      "steel",
      45,
      form,
      new THREE.Vector3(
        bunt.x + (zuf() - 0.5) * (w - 0.9),
        1.4 + i * 0.12,
        bunt.z + (zuf() - 0.5) * (d - 0.9)
      ),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(zuf() * 3.14, zuf() * 3.14, zuf() * 3.14)
      )
    );
  }
  for (let f = 0; f < 1200; f++) {
    items.clampSpeeds(1 / 60);
    world.step();
  }
  const aussenkante = bunt.x + w / 2 + T; // x −4,95: Aussenflaeche der Schwellensteine
  const vorderkante = bunt.x - w / 2; // x −9,70: die offene Seite, Lamberts Seite
  let drin = 0;
  let drueber = 0;
  let vorn = 0;
  for (const it of items.items) {
    const t = it.body.translation();
    if (t.x > aussenkante) drueber++;
    else if (t.x < vorderkante) vorn++;
    else drin++;
  }
  return { drin, drueber, vorn };
}
for (const saat of [7, 23, 101]) {
  const alt = schwellenProbe(true, saat);
  const neu = schwellenProbe(false, saat);
  console.log(
    `  Saat ${String(saat).padStart(3)}: ueber die Schwelle (oestlich x ${(
      bunt.x +
      bunt.size[0] / 2 +
      MULDE_STEIN.dicke
    ).toFixed(2)}) mit 3-m-Wand ${String(alt.drueber).padStart(3)} · ohne sie ${String(
      neu.drueber
    ).padStart(3)}   | vorn heraus (offene Seite) ${String(alt.vorn).padStart(3)} · ${String(
      neu.vorn
    ).padStart(3)}   | in der Mulde ${String(alt.drin).padStart(3)} · ${String(neu.drin).padStart(3)}`
  );
}

/* ================================================================= D ==== */
console.log("\n=== D · FOLGEN: erreichbarer Muldenboden und Luft zum Muellcontainer ===\n");
/**
 * Wieviel Muldenboden gibt die Karte frei?
 *
 * Der Arm faehrt hinein, wo `hitsObstacle` auf Greiferhoehe nichts meldet.
 * Gerastert mit 5 cm ueber die ganze Mulde samt Waenden, gerechnet gegen NUR
 * die Waende dieser Mulde — die Nachbarn sind eine andere Frage.
 */
function freierBoden(cfg: ContainerConfig, liste: Rechteck[], y: number): number {
  const [w, d] = cfg.size;
  const hw = (cfg.facing === "north" ? d : w) / 2 + MULDE_STEIN.dicke;
  const hd = (cfg.facing === "north" ? w : d) / 2 + MULDE_STEIN.dicke;
  const SCHRITT = 0.05;
  let n = 0;
  for (let x = cfg.x - hw; x <= cfg.x + hw; x += SCHRITT) {
    for (let z = cfg.z - hd; z <= cfg.z + hd; z += SCHRITT) {
      const drin = liste.some(
        (o) => Math.abs(x - o.x) < o.hw && Math.abs(z - o.z) < o.hd && y <= o.top
      );
      if (!drin) n++;
    }
  }
  return n * SCHRITT * SCHRITT;
}
/**
 * Die LICHTE Weite zwischen den Innenflaechen der gemeldeten Waende — das ist
 * der Schlauch, in den die Spinne herunterkommt, ohne dass `hitsObstacle`
 * anschlaegt.
 */
function lichteWeite(cfg: ContainerConfig, liste: Rechteck[]): { x: number; z: number } {
  let x = Infinity;
  let z = Infinity;
  for (const achse of ["x", "z"] as const) {
    let von = -Infinity;
    let bis = Infinity;
    for (const o of liste) {
      const [a, b] = spanne(o, achse);
      const mitte = achse === "x" ? cfg.x : cfg.z;
      /*
       * Nur Waende, die QUER zu dieser Achse stehen — also die, deren Dicke
       * hier gemessen wird. Die Schranke ist 0,80 m und nicht `MULDE_STEIN`:
       * Die alte Fassung trug 0,70 m dicke Eintraege (2 × BAY_T), und mit der
       * Steindicke als Schranke fielen genau die heraus, die verglichen werden
       * sollen (erste Fassung dieses Geraets meldete „offen").
       */
      if (b - a > 0.8) continue;
      if (b <= mitte) von = Math.max(von, b);
      if (a >= mitte) bis = Math.min(bis, a);
    }
    const weite = bis - von;
    if (achse === "x") x = weite;
    else z = weite;
  }
  return { x, z };
}
console.log("  Mulde                  lichte Weite x · z (alt → jetzt)      Boden frei auf 0,60 m");
for (const cfg of CONFIGS.filter((c) => c.kind === "bay")) {
  const alt = freierBoden(cfg, gemeldetAlt(cfg), 0.6);
  const neu = freierBoden(cfg, gebaut(cfg), 0.6);
  const la = lichteWeite(cfg, gemeldetAlt(cfg));
  const ln = lichteWeite(cfg, gebaut(cfg));
  const zahl = (v: number): string => (Number.isFinite(v) ? v.toFixed(2) : "offen");
  console.log(
    `  ${cfg.label.padEnd(14)} ${zahl(la.x)} · ${zahl(la.z)}  →  ${zahl(ln.x)} · ${zahl(ln.z)}` +
      `     ${m2(alt)} → ${m2(neu)} m²  (${neu > alt ? "+" : ""}${(neu - alt).toFixed(2)})`
  );
}

const muell = CONFIGS.find((c) => c.id === "r_rubble")!;
/** Abstand zweier Rechtecke; negativ = sie durchdringen sich. */
function abstand(
  a: { x: number; z: number; hw: number; hd: number },
  b: { x: number; z: number; hw: number; hd: number }
): number {
  const dx = Math.abs(a.x - b.x) - (a.hw + b.hw);
  const dz = Math.abs(a.z - b.z) - (a.hd + b.hd);
  if (dx >= 0 && dz >= 0) return Math.hypot(dx, dz);
  if (dx >= 0) return dx;
  if (dz >= 0) return dz;
  return Math.max(dx, dz);
}
console.log("\n  MUELL-Container an seinem Startplatz gegen die Waende von BUNT + VA:");
for (const [name, liste] of [
  ["alt   ", gemeldetAlt(bunt)],
  ["jetzt ", gebaut(bunt)],
] as const) {
  const g = { x: muell.x, z: muell.z, hw: muell.size[0] / 2, hd: muell.size[1] / 2 };
  let eng = Infinity;
  let wo = "";
  for (const o of liste) {
    const dd = abstand(g, o);
    if (dd < eng) {
      eng = dd;
      wo = o.label;
    }
  }
  console.log(
    `    ${name} (${muell.x.toFixed(2)} | ${muell.z.toFixed(2)}) → ${m2(eng)} m an „${wo}"`
  );
}
console.log(
  `    Schwenkband: ${m2(
    Math.hypot(muell.x - BAGGER_STAND.x, muell.z - BAGGER_STAND.z)
  )} m vom Sitz (Grenze ${SCHWENK_AUSSEN.toFixed(2)})` +
    `, Fahrlinie: ${m2(Math.abs(muell.x - BAGGER_STAND.x) - (muell.size[0] / 2 + UNTERWAGEN_HALB_B))} m Luft`
);
/*
 * Die Tasche zwischen Muldenwand und Schwenkband — wie hoch ist sie ueberhaupt
 * noch? Das ist die Zahl, an der die Lage des Containers haengt.
 */
{
  const nordkante = Math.max(...gebaut(bunt).map((o) => o.z + o.hd));
  const suedkanteMuell = muell.z - muell.size[1] / 2;
  const bandGrenze = (x: number): number =>
    BAGGER_STAND.z + Math.sqrt(Math.max(0, SCHWENK_AUSSEN ** 2 - (x - BAGGER_STAND.x) ** 2));
  const fahrlinieX = BAGGER_STAND.x - (muell.size[0] / 2 + UNTERWAGEN_HALB_B);
  console.log(
    `    Tasche: Muldenwand endet auf z ${nordkante.toFixed(2)} (alt ${Math.max(
      ...gemeldetAlt(bunt).map((o) => o.z + o.hd)
    ).toFixed(2)}), Containersueden liegt auf z ${suedkanteMuell.toFixed(2)}`
  );
  console.log(
    `    Schwenkband erlaubt die Mitte bis z ${bandGrenze(muell.x).toFixed(2)} bei x ${muell.x.toFixed(
      2
    )} · bis z ${bandGrenze(fahrlinieX).toFixed(2)} bei x ${fahrlinieX.toFixed(2)} (Fahrlinie am Anschlag)`
  );
  console.log(
    `    → hoechstmoegliche Luft zur Wand bei x ${muell.x.toFixed(2)}: ${(
      bandGrenze(muell.x) -
      muell.size[1] / 2 -
      nordkante
    ).toFixed(2)} m`
  );
}
/* Und die Gegenprobe gegen die ECHTE Huelle des Containers (Oberriegel, Rungen). */
{
  const { world, scene } = baueWelt();
  scene.updateMatrixWorld(true);
  const kasten = new THREE.Box3();
  const mitte = new THREE.Vector3(muell.x, 0, muell.z);
  scene.traverse((o) => {
    const eltern = o.parent;
    if ((o as THREE.Mesh).isMesh && eltern && eltern.position.distanceTo(mitte) < 0.01)
      kasten.expandByObject(o);
  });
  if (!kasten.isEmpty()) {
    const groesse = kasten.getSize(new THREE.Vector3());
    console.log(
      `\n  Gegenprobe Container-Huelle: gemeldet ${muell.size[0].toFixed(2)} × ${muell.size[1].toFixed(
        2
      )} m, gebaut ${groesse.x.toFixed(2)} × ${groesse.z.toFixed(2)} m` +
        ` (Oberriegel und Rungen stehen ${((groesse.z - muell.size[1]) / 2).toFixed(2)} m je Seite vor)`
    );
  }
  void world;
}
console.log("");
