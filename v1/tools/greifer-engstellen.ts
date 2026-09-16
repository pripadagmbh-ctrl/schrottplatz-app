/**
 * PASST DER OFFENE GREIFER NOCH UEBERALL HINEIN?
 *
 * Anlass: E-090 hat den Huellkreis des Fuenfschalengreifers von 3,2262 auf
 * 3,3064 m wachsen lassen und dabei SELBST gemeldet, dass an genau dieser Zahl
 * Presskammer und Muldenbreiten haengen (`CLAW_OPEN_SPLAY` nennt beide
 * ausdruecklich) — und dass das nicht nachgemessen wurde.
 *
 * Dieses Werkzeug misst es nach, fuer BEIDE Greiferformen, gegen jedes Ziel,
 * in das der Greifer hineingreifen soll. Es entscheidet nichts; es liefert je
 * Ziel drei Zahlen:
 *
 *   - passt er (ja/nein),
 *   - mit wie viel Luft je Seite,
 *   - und wenn nicht: wie weit daneben, und bis zu welchem Oeffnungsgrad es
 *     noch ginge.
 *
 * ## DIE NULLPROBE STEHT VORNE, NICHT HINTEN
 *
 * E-065 hat dieselbe Frage mit Kaesten beantwortet und bei 0 Grad −0,071 m
 * gemeldet, wo der Greifer nachweislich frei hing. Die Zahlen waren
 * unbrauchbar, und es hat einen ganzen Durchgang gekostet, das zu merken.
 * Deshalb rechnet dieses Werkzeug ZUERST fuenf Faelle, deren Ergebnis von Hand
 * nachzurechnen ist. Stimmt eine davon nicht, hat der Rest keinen Wert.
 *
 * Aufruf: npx vite-node tools/greifer-engstellen.ts
 */
import * as THREE from "three";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { clawSpan, CLAW_OPEN_SPLAY } from "../src/excavator/clawGeometry";
import type { Greiferform } from "../src/excavator/greiferform";
import {
  freierKreis,
  huellkreisKurve,
  spitzenkreis,
  leinwandMitVerlauf,
  aufgeblasen,
  type Fenster,
  type Kasten,
  type Kurvenpunkt,
} from "./engstellen-kern";
import { zielePlatz, type Ziel } from "./engstellen-platz";

const cm = (m: number): string => `${(m * 100).toFixed(1)} cm`;

/* =========================================================== NULLPROBE === */

function nullprobe(): boolean {
  console.log("=== Nullprobe — erst wenn diese sechs stimmen, gilt der Rest ===\n");
  let alleGut = true;
  const pruefe = (name: string, ist: number, soll: number, toleranz: number): void => {
    const gut = Math.abs(ist - soll) <= toleranz;
    if (!gut) alleGut = false;
    console.log(
      `  ${gut ? "ok  " : "FALSCH"} ${name.padEnd(52)} ist ${ist.toFixed(4)}  soll ${soll.toFixed(4)} (±${toleranz})`
    );
  };

  // 1 Ein leeres Fenster von 5 x 3 m: der groesste Kreis hat 3,00 m.
  const leer: Fenster = {
    name: "leer",
    x0: -2.5, x1: 2.5, z0: -1.5, z1: 1.5, y0: 0, y1: 1,
    herkunft: "Nullprobe",
  };
  pruefe("leeres Fenster 5,00 x 3,00 m", freierKreis(leer, []).d, 3.0, 0.005);

  // 2 Dasselbe Fenster, eine 1,00 m breite Wand mittig quer hinein:
  //   frei bleiben links und rechts je 2,00 m Breite  ->  Kreis 2,00 m.
  const wand: Kasten = {
    name: "Pruefwand",
    min: { x: -0.5, y: 0, z: -1.5 },
    max: { x: 0.5, y: 1, z: 1.5 },
  };
  pruefe("dasselbe mit 1,00 m Wand quer in der Mitte", freierKreis(leer, [wand]).d, 2.0, 0.005);

  // 3 Dieselbe Wand, aber ueber dem Hoehenband: sie zaehlt nicht mit.
  const hoch: Kasten = {
    name: "Pruefwand hoch",
    min: { x: -0.5, y: 2, z: -1.5 },
    max: { x: 0.5, y: 3, z: 1.5 },
  };
  pruefe("dieselbe Wand ueber dem Hoehenband", freierKreis(leer, [hoch]).d, 3.0, 0.005);

  /*
   * 4 Ein einzelner Kasten von 2,00 x 4,00 m auf der Achse. Sein weitester
   *   Punkt ist eine Ecke: hypot(1,00; 2,00) = 2,2360679…, Huellkreis also
   *   4,4721359… — von Hand nachzurechnen, ohne jede Schleife.
   */
  const einer = new THREE.Group();
  const kasten = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 4));
  kasten.position.y = -1;
  einer.add(kasten);
  const einerBau = { gruppe: einer, setWinkel: () => {}, nachfuehren: () => {} };
  pruefe(
    "ein Kasten 2,00 x 4,00 m auf der Achse",
    groesstes(huellkreisKurve(einerBau, 1, 0, 1, 3)).d,
    2 * Math.hypot(1, 2),
    0.0005
  );

  /*
   * 5 Ein Stern aus fuenf Kaesten auf Halbmesser 1,50 m, jeder 0,20 m dick.
   *
   *   HIER WAR DIE FALLE, und die Nullprobe hat sie gefangen: Erwartet waren
   *   3,20 m (1,50 + 0,10, zweimal). Gemessen wurden 3,2797 m — und gemessen
   *   hatte recht. Die Ecke eines achsparallelen Kastens liegt nicht radial
   *   nach aussen, sondern SCHRAEG; ihr Halbmesser ist
   *   hypot(px ± 0,10; pz ± 0,10) und damit je nach Umfangswinkel ein anderer.
   *
   *   Der Sollwert wird deshalb hier ueber die acht Ecken ausgerechnet — mit
   *   eigener Arithmetik, nicht mit derselben Schleife wie die Messung. Das
   *   ist der Sinn einer Nullprobe: zwei Wege, ein Ergebnis.
   */
  const stern = new THREE.Group();
  let sollStern = 0;
  for (let i = 0; i < 5; i++) {
    const w = (i / 5) * Math.PI * 2;
    const px = Math.sin(w) * 1.5;
    const pz = Math.cos(w) * 1.5;
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    k.position.set(px, -1, pz);
    stern.add(k);
    for (const sx of [-0.1, 0.1])
      for (const sz of [-0.1, 0.1])
        sollStern = Math.max(sollStern, 2 * Math.hypot(px + sx, pz + sz));
  }
  const sternBau = { gruppe: stern, setWinkel: () => {}, nachfuehren: () => {} };
  const sternIst = groesstes(huellkreisKurve(sternBau, 5, 0, 1, 3)).d;
  pruefe("Stern aus fuenf Kaesten, gegen die Eckenrechnung", sternIst, sollStern, 0.0005);

  /*
   * 6 Derselbe Stern, um 20 cm aufgeblasen. Er MUSS genau 20 cm breiter
   *   herauskommen — sonst greift die Gegenprobe des Waechters ins Leere und
   *   meldete einen Fehler, den sie gar nicht erzeugt hat.
   */
  const dick = aufgeblasen(sternBau, sternIst, 0.2);
  pruefe(
    "derselbe Stern, 20 cm aufgeblasen",
    groesstes(huellkreisKurve(dick, 5, 0, 1, 3)).d,
    sternIst + 0.2,
    0.0005
  );

  console.log(
    `\n  ${alleGut ? "Alle sechs stimmen." : "NULLPROBE GERISSEN — die Zahlen unten sind wertlos."}\n`
  );
  return alleGut;
}

function groesstes(k: Kurvenpunkt[]): Kurvenpunkt {
  return k.reduce((a, b) => (b.d > a.d ? b : a));
}

/* ============================================================= GREIFER === */

interface Formmass {
  form: Greiferform;
  kurve: Kurvenpunkt[];
  /** Groesster Huellkreis ueber den ganzen Oeffnungsweg. */
  huell: Kurvenpunkt;
  /** Huellkreis im ganz offenen Stand. */
  offen: Kurvenpunkt;
  /** Spitzenkreis offen — womit er ueber ein liegendes Teil kommt. */
  spitzen: { d: number; tiefe: number };
}

function formVermessen(form: Greiferform): Formmass {
  const bau = form.baue();
  const kurve = huellkreisKurve(bau, form.schalen, form.zu, form.offen, 41);
  const spitzen = spitzenkreis(bau, form.schalen, form.offen);
  return {
    form,
    kurve,
    huell: groesstes(kurve),
    offen: kurve[kurve.length - 1]!,
    spitzen,
  };
}

/* ============================================================== AUSGABE === */

function auswerten(ziele: Ziel[], formen: Formmass[]): void {
  console.log("=== ZIEL FUER ZIEL ===\n");
  const kopf =
    "  Ziel".padEnd(38) +
    "| frei    |" +
    formen.map((f) => ` ${f.form.name.slice(0, 18).padEnd(18)} `).join("|");
  console.log(kopf);
  console.log("  " + "-".repeat(kopf.length - 2));
  const befunde: string[] = [];
  const erwartet: string[] = [];
  for (const z of ziele) {
    const frei = freierKreis(z.fenster, z.hindernisse);
    const felder = formen.map((f) => {
      const d = f.huell.d;
      const luft = (frei.d - d) / 2;
      if (luft >= 0) return `+${cm(luft)} je Seite`.padEnd(20);
      /* Passt nicht — bis zu welchem Oeffnungsgrad ginge es noch? */
      let bis = -1;
      for (const p of f.kurve) if (p.d <= frei.d && p.t > bis) bis = p.t;
      const wie = bis < 0 ? "gar nicht" : `nur bis ${(bis * 100).toFixed(0)} % offen`;
      const satz =
        `${f.form.name} in „${z.fenster.name}“: ${cm(-luft)} zu breit je Seite ` +
        `(Huellkreis ${d.toFixed(4)} m, frei ${frei.d.toFixed(4)} m) — ${wie}`;
      (z.sollPassen ? befunde : erwartet).push(satz);
      return `NEIN, ${cm(-luft)} zu breit`.padEnd(20);
    });
    console.log(
      `  ${z.fenster.name.slice(0, 35).padEnd(36)}| ${frei.d.toFixed(3)} m |` +
        felder.map((f) => ` ${f} `).join("|")
    );
    /*
     * WER einschnuert, nicht nur DASS: Eine Muldennummer allein ist keine
     * Auskunft. Steht ein Kasten im Weg, kommen seine Masse dazu — sonst
     * muesste man raten, und Raten ist genau das, was hier nicht sein soll.
     */
    const k = z.hindernisse.find((h) => h.name === frei.eng);
    const wo = k
      ? `${k.name} (x ${k.min.x.toFixed(2)}…${k.max.x.toFixed(2)} · ` +
        `y ${k.min.y.toFixed(2)}…${k.max.y.toFixed(2)} · z ${k.min.z.toFixed(2)}…${k.max.z.toFixed(2)})`
      : frei.eng;
    console.log(
      `  ${" ".repeat(36)}| eng: ${wo}, Fehlerschranke ${(frei.fehler * 1000).toFixed(1)} mm — ${z.zweck}`
    );
  }
  console.log("\n=== BEFUNDE: wo er hinein SOLL und nicht hineinpasst ===\n");
  if (befunde.length === 0) console.log("  keiner.");
  for (const b of befunde) console.log(`  - ${b}`);
  console.log("\n=== ERWARTET ENG: dort laedt er von oben, kein Befund ===\n");
  for (const b of erwartet) console.log(`  - ${b}`);
}

/**
 * Wie weit der offene Greifer ueber eine Kante hinausreicht, wenn er noch
 * gerade eben davor steht. Das ist die Frage „langt er in die Nachbarmulde".
 */
function uebergriff(formen: Formmass[]): void {
  console.log("\n=== UEBERGRIFF: wie weit langt er ueber eine Kante ===\n");
  for (const f of formen) {
    console.log(
      `  ${f.form.name.padEnd(22)} Halbmesser offen ${(f.huell.d / 2).toFixed(3)} m — ` +
        `so weit steht er ueber jede Kante, an der er mittig anlegt.`
    );
  }
  console.log(
    "\n  Zum Vergleich: die Trennsteinreihe zwischen den Halden ist 0,60 m dick\n" +
      "  und hoechstens 2,40 m hoch (`yard.ts`, TRENNSTEINE), die Halden sind\n" +
      "  5,00 m hoch. Der Greifer reicht also in JEDER Stellung ueber die Fuge —\n" +
      "  so ist es gewollt (Ansage 14.09.2026: „sodass der Zugriff von\n" +
      "  Mischschrott zu Stahlschrott fluessig laeuft“). Kein Befund, eine Zahl."
  );
}

/* ================================================================= MAIN === */

async function main(): Promise<void> {
  leinwandMitVerlauf();
  await initPhysics();

  if (!nullprobe()) {
    process.exitCode = 1;
    return;
  }

  console.log("=== DIE BEIDEN GREIFER, AM GEBAUTEN NETZ GEMESSEN ===\n");
  const formen = [SICHELKRALLE, FUENFSCHALEN].map(formVermessen);
  for (const f of formen) {
    console.log(`  ${f.form.name}`);
    console.log(
      `    Huellkreis ueber den ganzen Weg  ${f.huell.d.toFixed(4)} m` +
        `  (bei ${(f.huell.t * 100).toFixed(0)} % offen, Netz ${f.huell.netz}, y ${f.huell.y.toFixed(3)} m)`
    );
    console.log(`    Huellkreis ganz offen            ${f.offen.d.toFixed(4)} m`);
    console.log(
      `    Spitzenkreis ganz offen          ${f.spitzen.d.toFixed(4)} m` +
        `  (Spitzen ${f.spitzen.tiefe.toFixed(3)} m unter dem Kardangelenk)`
    );
    console.log(
      `    Eckpunkte je Stellung            ${f.huell.punkte.toLocaleString("de-DE")}` +
        `  (exakt: das Maximum von hypot(x,z) ueber ein Dreieck liegt immer in einer Ecke)`
    );
  }
  console.log(
    `\n  Zum Vergleich, die Zahl aus der Mittellinienrechnung:\n` +
      `    clawSpan(CLAW_OPEN_SPLAY) = ${clawSpan(CLAW_OPEN_SPLAY).toFixed(4)} m — ` +
      `das ist die Zahl, mit der\n    test/spinnenmass.test.ts und test/presseKammer.test.ts heute rechnen.\n`
  );

  const { ziele, kaesten, uebergangen } = zielePlatz();
  console.log(
    `  Welt gebaut: ${kaesten.length} Quaderkollider` +
      (uebergangen.length
        ? `, ${uebergangen.length} Kollider anderer Form UEBERGANGEN bei ` +
          uebergangen.map((u) => `(${u.x.toFixed(1)}|${u.z.toFixed(1)})`).join(", ")
        : "") +
      `\n`
  );
  auswerten(ziele, formen);
  uebergriff(formen);
}

void main();
