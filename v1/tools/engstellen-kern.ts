/**
 * ENGSTELLEN — der Rechenkern: passt ein runder Koerper in ein waagerechtes
 * Fenster, und wie viel Luft bleibt?
 *
 * Warum es diese Datei gibt. E-090 hat den Huellkreis des Greifers von 3,2262
 * auf 3,3064 m wachsen lassen (+8 cm) und dabei selbst gemeldet, dass an
 * derselben Zahl Presskammer und Muldenbreiten haengen — ungemessen. Diese
 * Datei liefert beide Haelften der Antwort:
 *
 *   1. `huellkreis()` — wie breit der Greifer WIRKLICH ist, am gebauten Netz.
 *   2. `freierKreis()` — wie breit das Loch ist, in das er hinein soll.
 *
 * ## WARUM AM NETZ UND NICHT AM KASTEN
 *
 * E-065 hat die Freigangfrage mit KAESTEN um die Netze beantwortet und dabei
 * bei 0 Grad −0,071 m gemeldet, wo der Greifer nachweislich frei hing. Der
 * Kasten um einen fuenfarmigen Stern ist viel groesser als der Stern.
 *
 * Fuer die Frage „wie breit ist der Greifer" gilt das genauso — aber sie ist
 * billiger zu beantworten als die Freigangfrage, und zwar EXAKT statt
 * abgetastet: Gesucht ist das Maximum von `hypot(x, z)` ueber die Oberflaeche.
 * Diese Funktion ist konvex, ihr Maximum ueber ein Dreieck liegt deshalb immer
 * in einer ECKE. Die Eckpunkte der Netze reichen also aus; es gibt keinen
 * Abtastfehler und keine Fehlerschranke, die man dazurechnen muesste.
 *
 * (Das ist der Unterschied zur Freigangmessung in `freigang-kern.ts`: Dort
 * wird der ABSTAND zweier Flaechen gesucht, und der kann mitten in einem
 * Dreieck liegen. Hier wird ein Halbmesser um eine feste Achse gesucht.)
 *
 * ## WARUM EIN KREIS UND KEIN QUADRAT
 *
 * `test/presseKammer.test.ts` misst die groesste freie QUADRATkante — ein
 * achsparalleles Quadrat. Das ist eine gueltige, aber unnoetig strenge
 * Schranke: Der Greifer haengt an einem Rotator und kann sich drehen, seine
 * Huelle ist ein Kreis. Ein Kreis vom Durchmesser D passt in jedes freie
 * Quadrat der Kante D, aber auch in manches, in das das Quadrat nicht passt.
 * Gemessen wird deshalb der groesste freie KREIS; die Quadratzahl bleibt als
 * strengere Nebenangabe erhalten, wo es sie schon gibt.
 */
import * as THREE from "three";

/** Ein achsparalleler Kasten in Weltkoordinaten. */
export interface Kasten {
  name: string;
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/**
 * Ein ZIEL: das waagerechte Fenster, in das der offene Greifer hinein soll,
 * und das Hoehenband, in dem die Waende stehen.
 */
export interface Fenster {
  name: string;
  /** Die Muendung in Weltachsen. */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Hoehenband: nur was hier hineinragt, steht dem Greifer im Weg. */
  y0: number;
  y1: number;
  /** Woher die Zahlen stammen — steht in der Ausgabe. */
  herkunft: string;
}

/** Waagerechter Abstand eines Punktes zum Kasten (0 = drin). */
export function abstandXZ(px: number, pz: number, k: Kasten): number {
  const dx = Math.max(k.min.x - px, px - k.max.x, 0);
  const dz = Math.max(k.min.z - pz, pz - k.max.z, 0);
  return Math.hypot(dx, dz);
}

/**
 * Spiel am Rand des Hoehenbandes (m).
 *
 * WARUM ES DAS GEBEN MUSS, und was ohne es passiert: Der Boden der
 * Presskammer endet auf 0,30 m, das Hoehenband faengt auf 0,30 m an. In
 * Gleitkomma ist die Oberkante aber 0,30000000000000004, und damit galt der
 * KAMMERBODEN als Hindernis — er deckt die ganze Muendung ab, der groesste
 * freie Kreis kam auf 0,000 m heraus, und die Presse haette „gar nicht"
 * gemeldet. Gemessen am 16.09.2026, beim ersten Lauf dieses Werkzeugs.
 *
 * 2 cm, dieselbe Zahl wie `TOLERANZ` in `test/presseKammer.test.ts`, die dort
 * aus demselben Grund steht. Wer sie wegnimmt, bekommt keine Fehlermeldung,
 * sondern lauter Nullen — die gefaehrlichere Sorte Fehler.
 */
export const BAND_SPIEL = 0.02;

/** Ragt der Kasten in das Hoehenband des Fensters? */
export function imBand(k: Kasten, f: Fenster): boolean {
  return k.max.y > f.y0 + BAND_SPIEL && k.min.y < f.y1 - BAND_SPIEL;
}

/**
 * Wie viel Platz an der Stelle (px|pz) ist: der Halbmesser des groessten
 * Kreises um diesen Punkt, der im Fenster liegt und keinen Kasten beruehrt.
 *
 * Die Funktion ist 1-LIPSCHITZ in (px|pz) — verschiebt man den Mittelpunkt um
 * s, aendert sich der Wert um hoechstens s. Beides folgt aus der
 * Dreiecksungleichung (Abstand zu einer Menge) und aus dem Minimum solcher
 * Funktionen. Genau darauf beruht die Fehlerschranke der Rastersuche unten.
 */
function platz(px: number, pz: number, f: Fenster, hindernisse: Kasten[]): number {
  let r = Math.min(px - f.x0, f.x1 - px, pz - f.z0, f.z1 - pz);
  for (const k of hindernisse) {
    const d = abstandXZ(px, pz, k);
    if (d < r) r = d;
  }
  return r;
}

export interface FreierKreis {
  /** Durchmesser des groessten freien Kreises (m). */
  d: number;
  /** Wo sein Mittelpunkt liegt. */
  x: number;
  z: number;
  /** Was ihn begrenzt: Kastenname oder Fensterkante. */
  eng: string;
  /** Wie viele Kaesten im Hoehenband lagen. */
  kaesten: number;
  /**
   * Obere Schranke des Rasterfehlers (m). Der wahre Durchmesser liegt
   * zwischen `d` und `d + fehler` — nie darunter.
   */
  fehler: number;
}

/**
 * Der groesste freie Kreis im Fenster.
 *
 * Verfahren: grobes Raster, dann oertliches Nachfassen mit halbierter
 * Schrittweite. Weil `platz` 1-Lipschitz ist, liegt der wahre Bestwert
 * hoechstens `raster/sqrt(2)` ueber dem besten Rasterwert (der weiteste Punkt
 * einer Rasterzelle von ihrem Gitterpunkt ist die halbe Diagonale). Das
 * Nachfassen drueckt den Rest; ausgewiesen wird trotzdem die Schranke des
 * groben Rasters, damit die Zahl nach unten sicher ist.
 *
 * NACH UNTEN SICHER ist das Wichtige: Ein zu klein gemessenes Loch meldet
 * lieber einmal zu viel; ein zu gross gemessenes liesse den Greifer anfahren.
 */
export function freierKreis(
  f: Fenster,
  alle: Kasten[],
  raster = 0.02
): FreierKreis {
  const hindernisse = alle.filter((k) => imBand(k, f));
  let best = -Infinity;
  let bx = (f.x0 + f.x1) / 2;
  let bz = (f.z0 + f.z1) / 2;
  const nx = Math.max(1, Math.ceil((f.x1 - f.x0) / raster));
  const nz = Math.max(1, Math.ceil((f.z1 - f.z0) / raster));
  for (let i = 0; i <= nx; i++) {
    const px = f.x0 + ((f.x1 - f.x0) * i) / nx;
    for (let j = 0; j <= nz; j++) {
      const pz = f.z0 + ((f.z1 - f.z0) * j) / nz;
      const p = platz(px, pz, f, hindernisse);
      if (p > best) {
        best = p;
        bx = px;
        bz = pz;
      }
    }
  }
  // Oertliches Nachfassen: acht Nachbarn, Schrittweite halbiert sich.
  let schritt = raster;
  for (let runde = 0; runde < 24; runde++) {
    let gebessert = false;
    for (const [dx, dz] of [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ] as Array<[number, number]>) {
      const px = bx + dx * schritt;
      const pz = bz + dz * schritt;
      const p = platz(px, pz, f, hindernisse);
      if (p > best) {
        best = p;
        bx = px;
        bz = pz;
        gebessert = true;
      }
    }
    if (!gebessert) schritt /= 2;
  }
  // Wer begrenzt? Dasselbe Minimum noch einmal, diesmal mit Namen.
  let eng = "Fensterkante";
  let min = Math.min(bx - f.x0, f.x1 - bx, bz - f.z0, f.z1 - bz);
  for (const k of hindernisse) {
    const d = abstandXZ(bx, bz, k);
    if (d < min) {
      min = d;
      eng = k.name;
    }
  }
  return {
    d: 2 * Math.max(0, best),
    x: bx,
    z: bz,
    eng,
    kaesten: hindernisse.length,
    fehler: (2 * raster) / Math.SQRT2,
  };
}

/* ------------------------------------------------------- Der Greifer ----- */

/** Was `huellkreis` vom gebauten Greifer braucht. */
export interface Greiferbaustand {
  gruppe: THREE.Object3D;
  setWinkel(i: number, w: number): void;
  nachfuehren(): void;
}

/** Der Huellkreis bei EINEM Oeffnungsgrad. */
export interface Kurvenpunkt {
  /** Oeffnungsgrad: 0 = zu, 1 = ganz offen. */
  t: number;
  /** Groesster Durchmesser um die Greiferachse (m). */
  d: number;
  /** In welchem Netz der weiteste Punkt sitzt. */
  netz: string;
  /** Auf welcher Hoehe er sitzt (m, gemessen ab Kardangelenk, negativ = darunter). */
  y: number;
  /** Wie viele Eckpunkte dafuer geprueft wurden. */
  punkte: number;
}

/**
 * Der Huellkreis eines gebauten Greifers ueber den ganzen Oeffnungsweg: der
 * groesste Durchmesser, den irgendein gezeichneter Punkt um die Greiferachse
 * beschreibt, Oeffnungsgrad fuer Oeffnungsgrad.
 *
 * Gemessen wird im FRAME der Greifergruppe: Ihr Ursprung IST das
 * Kardangelenk, und ihre y-Achse ist die Drehachse des Rotators. Ein Punkt
 * (x|y|z) laeuft beim Drehen also auf einem Kreis vom Halbmesser
 * `hypot(x, z)` — unabhaengig davon, wie der Rotator gerade steht. Deshalb ist
 * diese Zahl die richtige fuer „passt er hinein": Sie gilt in jeder
 * Rotatorstellung.
 *
 * Die KURVE statt einer einzelnen Zahl, weil daran die naechste Frage haengt:
 * Wenn er ganz offen nicht hineinpasst — wie weit offen denn noch?
 *
 * Unsichtbares zaehlt nicht mit, und zwar auch dann nicht, wenn nur ein
 * Vorfahr unsichtbar ist: Beim Greiferwechsel bleibt die alte Form als
 * unsichtbare Gruppe haengen (`Excavator.setGreifer`), und wer sie mitmisst,
 * misst beide Greifer auf einmal.
 */
export function huellkreisKurve(
  bau: Greiferbaustand,
  schalen: number,
  zu: number,
  offen: number,
  stufen = 41
): Kurvenpunkt[] {
  const p = new THREE.Vector3();
  const wurzel = bau.gruppe;
  const raus: Kurvenpunkt[] = [];
  for (let s = 0; s < stufen; s++) {
    const t = stufen === 1 ? 1 : s / (stufen - 1);
    const w = zu + (offen - zu) * t;
    for (let i = 0; i < schalen; i++) bau.setWinkel(i, w);
    bau.nachfuehren();
    wurzel.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(wurzel.matrixWorld).invert();
    let d = 0;
    let netz = "—";
    let y = 0;
    let punkte = 0;
    wurzel.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (let q: THREE.Object3D | null = m; q; q = q.parent) if (!q.visible) return;
      const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
      if (!pos) return;
      for (let k = 0; k < pos.count; k++) {
        p.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
        punkte++;
        const dk = 2 * Math.hypot(p.x, p.z);
        if (dk > d) {
          d = dk;
          netz = m.name || m.parent?.name || "?";
          y = p.y;
        }
      }
    });
    raus.push({ t, d, netz, y, punkte });
  }
  return raus;
}

/**
 * DIE GEGENPROBE DES WAECHTERS: derselbe Greifer, um `zuschlag` Meter im
 * Durchmesser aufgeblasen.
 *
 * Nicht „die Zahl plus 20 cm" — das pruefte nur den Vergleich, nicht die
 * Messung. Hier wird der GEBAUTE Greifer in eine Gruppe gehaengt, die ihn
 * waagerecht streckt; `huellkreisKurve` misst danach wirklich einen breiteren
 * Koerper. Gestreckt wird nur in x und z: Ein Greifer, der auch laenger
 * wuerde, veraenderte Grabtiefe und Bodenanschlag mit und waere nicht mehr
 * dieselbe Frage.
 *
 * Die Streckung sitzt auf einem KIND, nicht auf der zurueckgegebenen Gruppe.
 * Andernfalls rechnete `huellkreisKurve` sie mit der Inversen der
 * Wurzelmatrix wieder heraus und maesse unveraendert den alten Greifer — ein
 * Fehler, den man an der Zahl nicht sieht, weil sie „richtig" aussieht.
 */
export function aufgeblasen(
  bau: Greiferbaustand,
  istDurchmesser: number,
  zuschlag: number
): Greiferbaustand {
  const k = (istDurchmesser + zuschlag) / istDurchmesser;
  const skaliert = new THREE.Group();
  skaliert.scale.set(k, 1, k);
  skaliert.add(bau.gruppe);
  const wurzel = new THREE.Group();
  wurzel.add(skaliert);
  return {
    gruppe: wurzel,
    setWinkel: (i, w) => bau.setWinkel(i, w),
    nachfuehren: () => bau.nachfuehren(),
  };
}

/**
 * Der SPITZENKREIS des ganz offenen Greifers: zweimal der Halbmesser der
 * tiefsten gezeichneten Punkte.
 *
 * Das ist die Zahl, die entscheidet, ob der Greifer von oben ueber ein
 * liegendes Teil kommt — nicht der Huellkreis. `clawSpan` der Sichelkralle
 * rechnet dasselbe auf der Mittellinie; hier wird es am Netz genommen, damit
 * die Zahnkappen mitzaehlen.
 *
 * `bandtiefe` ist die Hoehe des Bandes unter dem tiefsten Punkt, aus dem die
 * Spitzen genommen werden — 0,15 m, weil eine Zahnkappe rund so hoch ist.
 */
export function spitzenkreis(
  bau: Greiferbaustand,
  schalen: number,
  offen: number,
  bandtiefe = 0.15
): { d: number; tiefe: number } {
  for (let i = 0; i < schalen; i++) bau.setWinkel(i, offen);
  bau.nachfuehren();
  const wurzel = bau.gruppe;
  wurzel.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(wurzel.matrixWorld).invert();
  const p = new THREE.Vector3();
  const alle: Array<{ y: number; r: number }> = [];
  wurzel.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let q: THREE.Object3D | null = m; q; q = q.parent) if (!q.visible) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    if (!pos) return;
    for (let k = 0; k < pos.count; k++) {
      p.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
      alle.push({ y: p.y, r: Math.hypot(p.x, p.z) });
    }
  });
  let tiefste = Infinity;
  for (const a of alle) if (a.y < tiefste) tiefste = a.y;
  let r = 0;
  for (const a of alle) if (a.y <= tiefste + bandtiefe && a.r > r) r = a.r;
  return { d: 2 * r, tiefe: -tiefste };
}

/* ------------------------------------------------------- Leinwand ------- */

/**
 * Eine Leinwand-Attrappe, die auch den PLATZBODEN bauen laesst.
 *
 * `tools/leinwand-attrappe.ts` gibt fuer jeden unbekannten Aufruf `undefined`
 * zurueck. Der Boden in `world/yard.ts` legt aber einen Farbverlauf an und
 * ruft darauf `addColorStop` — mit der gemeinsamen Attrappe bricht `new Yard`
 * deshalb ab. Gemessen am 16.09.2026:
 *
 *     TypeError: Cannot read properties of undefined (reading 'addColorStop')
 *     at Yard.buildGround (src/world/yard.ts)
 *
 * DAS IST SCHON DIE ZWEITE KOPIE dieser Umgehung: `tools/platzlast.ts` traegt
 * seit dem 15.09.2026 dieselbe im Dateikopf, mit derselben Begruendung („Die
 * dortige verwirft jeden Zeichenbefehl und liefert `undefined` zurueck"). Wer
 * hier aufraeumt, raeumt an drei Stellen auf; solange bleibt die Doppelung
 * sichtbar statt versteckt.
 *
 * Der Unterschied zur gemeinsamen Attrappe ist EINE Zeile: Jeder unbekannte
 * Aufruf gibt wieder eine Attrappe zurueck statt `undefined`. Damit laeuft
 * auch eine Kette wie `ctx.createRadialGradient(...).addColorStop(...)` durch.
 */
export function leinwandMitVerlauf(): void {
  if (typeof (globalThis as Record<string, unknown>).document !== "undefined") return;
  const attrappe = (): unknown =>
    new Proxy(
      {},
      {
        get: (ziel: Record<string, unknown>, feld: string) =>
          feld in ziel ? ziel[feld] : attrappe,
        set: (ziel: Record<string, unknown>, feld: string, wert: unknown) => {
          ziel[feld] = wert;
          return true;
        },
      }
    );
  const ctx = attrappe() as Record<string, unknown>;
  ctx.measureText = (): { width: number } => ({ width: 0 });
  (globalThis as Record<string, unknown>).requestAnimationFrame = (): number => 0;
  (globalThis as Record<string, unknown>).document = {
    createElement: (): unknown => ({
      width: 0,
      height: 0,
      getContext: () => ctx,
      toDataURL: () => "",
      style: {},
    }),
  };
}

/* ------------------------------------------------ Kaesten aus der Welt --- */

/**
 * Alle Kollider einer Rapier-Welt als achsparallele Kaesten.
 *
 * Nur Quader (`halfExtents`) — alles andere hat der Platz nicht, und ein
 * stillschweigend uebergangener Kollider waere ein uebersehenes Hindernis.
 * Deshalb wird gezaehlt, was uebergangen wurde.
 */
export function kaestenAusWelt(
  world: { forEachCollider(f: (c: unknown) => void): void },
  praefix = "Kollider"
): { kaesten: Kasten[]; uebergangen: Array<{ x: number; y: number; z: number }> } {
  const kaesten: Kasten[] = [];
  const uebergangen: Array<{ x: number; y: number; z: number }> = [];
  let nr = 0;
  world.forEachCollider((roh) => {
    const c = roh as {
      halfExtents(): { x: number; y: number; z: number } | null;
      translation(): { x: number; y: number; z: number };
      rotation(): { x: number; y: number; z: number; w: number };
    };
    const he = c.halfExtents();
    const t = c.translation();
    if (!he) {
      uebergangen.push({ x: t.x, y: t.y, z: t.z });
      return;
    }
    const r = c.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1])
          box.expandByPoint(
            v.set(sx * he.x, sy * he.y, sz * he.z).applyQuaternion(q).add(
              new THREE.Vector3(t.x, t.y, t.z)
            )
          );
    kaesten.push({
      name: `${praefix} ${++nr}`,
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
    });
  });
  return { kaesten, uebergangen };
}
