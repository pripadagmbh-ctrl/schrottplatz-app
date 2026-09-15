/**
 * Die Mittelsäule — die RECHNUNG. Gerechnet, nicht gebaut.
 *
 * Herausgelöst aus `mittelsaeule.ts` am 15.09.2026, weil ein zweites Blatt
 * (`anlenkung-blatt.ts`) dieselben Zahlen braucht. Ein Werkzeug, das beim
 * Importieren sein eigenes Blatt schreibt, lässt sich nicht wiederverwenden —
 * genau das ist beim ersten Versuch passiert.
 *
 * Hier steht nur Rechnung und Messung, kein Blatt und keine Ausgabe. Wer die
 * Zahlen als Bild will: `mittelsaeule.ts`.
 *
 * Anlass, wörtlich (Patrick, 15.09.2026):
 *
 *   „Also, wir sind uns doch einig, dass die Zacken direkt an der Traverse
 *    sein sollen. Und das ist aktuell nicht der Fall."
 *   „der ist ja nur durch den Bolzen quasi direkt an der Traverse fest"
 *
 * Nachgemessen hat er recht: `TRAVERSE_Y` = −0,865, `STEMPEL_AUGE.y` = −1,5335.
 * Zwischen der Mitteltraverse und den fünf Schalenbolzen liegen **66,9 cm**.
 * Davon sind 26 cm der Stempelkörper selbst (`MASS.stempel.hoehe`, er trägt die
 * fünf Ausleger) und 40,9 cm die gerechnete Säule (`09_SAEULE`).
 *
 * SIE WIRD HIER NICHT WEGGEBAUT. `src/` ist unberührt. Die Anlenkung wird
 * deshalb mit einer eigenen, parametrischen Rechnung geführt — und die
 * beweist sich selbst: Bei der heutigen Bolzenhöhe muss sie Ziffer für Ziffer
 * dasselbe liefern wie `rig.ts` (`probe()`, Abbruch bei Abweichung).
 */
import * as THREE from "three";
import {
  MASS,
  OBERE_ANBINDUNG,
  OFFEN,
  STEMPEL_AUGE,
  TRAVERSE_Y,
  ZU,
  ZYLINDER_AUFNAHME,
  schwenkFuer,
  stoffe,
} from "../../src/fuenfschalen/teile";
import {
  baueGreiferInTeilen,
  hebelarm,
  zylinderLaenge,
  zylinderNeigung,
} from "../../src/fuenfschalen/rig";

const GRAD = 180 / Math.PI;

/** Wie weit der Bolzen heute unter der Traversenmitte sitzt (m). */
export const SAEULE_HEUTE = TRAVERSE_Y - STEMPEL_AUGE.y;
/** Reines Säulenrohr `09_SAEULE` — der Rest ist der Stempelkörper. */
export const SAEULENROHR = SAEULE_HEUTE - MASS.stempel.hoehe;

/* =========================================================== 1  ANLENKUNG */

export interface Anlenkwert {
  neigungZu: number;
  neigungOffen: number;
  neigungMax: number;
  hebelZu: number;
  hebelOffen: number;
  hebelMin: number;
  laengeZu: number;
  laengeOffen: number;
  laengeMin: number;
  hub: number;
}

/**
 * Kennwerte der Anlenkung bei FREI GEWÄHLTER Bolzenhöhe.
 *
 * Wortgleich mit `anbindungspunkt`/`hebelarm`/`zylinderNeigung` in `rig.ts`,
 * nur dass `STEMPEL_AUGE.y` durch `By` ersetzt ist. Warum abgeschrieben statt
 * aufgerufen: `rig.ts` nimmt die Bolzenhöhe nicht als Parameter, und sie dort
 * hineinzureichen hieße, `src/` für eine Rechnung anzufassen, die nichts bauen
 * soll. Die Kopie ist zulässig, WEIL sie sich gegen das Original prüfen lässt
 * — `probe()` tut das bei jedem Lauf.
 */
export function anlenkungBei(By: number): Anlenkwert {
  return anlenkungAus(ZYLINDER_AUFNAHME.y, By);
}

/**
 * Wo die Kolbenstange an der Schale angreift — das obere Schalenauge.
 *
 * Wortgleich mit `anbindungspunkt` in `rig.ts`, nur mit freier Bolzenhoehe.
 * Eine einzige Stelle, an der die Formel steht; `probe()` haelt sie gegen das
 * Original.
 */
export function anbindung(schwenk: number, By: number): { r: number; y: number } {
  const c = Math.cos(-schwenk);
  const sn = Math.sin(-schwenk);
  return {
    r: STEMPEL_AUGE.r + (OBERE_ANBINDUNG.y * sn + OBERE_ANBINDUNG.z * c),
    y: By + (OBERE_ANBINDUNG.y * c - OBERE_ANBINDUNG.z * sn),
  };
}

/**
 * Kennwerte fuer eine frei gewaehlte Zylinderaufnahme UND Bolzenhoehe.
 *
 * Zwei Hoehen statt einer, weil es zwei Wege gibt, den Abstand zwischen
 * Traverse und Schalenbolzen zu schliessen: den Bolzen hinauf oder die
 * Traverse herunter. Fuer die Anlenkung sind das dieselbe Rechnung — sie
 * kennt nur den ABSTAND. Genau das soll das Blatt zeigen koennen, und dafuer
 * muss man beide Wege getrennt einsetzen duerfen.
 */
export function anlenkungAus(Zy: number, By: number): Anlenkwert {
  let neigungMax = 0;
  let hebelMin = Infinity;
  let laengeMin = Infinity;
  let neigungZu = 0;
  let neigungOffen = 0;
  let hebelZu = 0;
  let hebelOffen = 0;
  let laengeZu = 0;
  let laengeOffen = 0;
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const s = ZU + ((OFFEN - ZU) * i) / N;
    const l = anbindung(s, By);
    const dr = l.r - ZYLINDER_AUFNAHME.r;
    const dy = l.y - Zy;
    const laenge = Math.hypot(dr, dy);
    const neigung = Math.atan2(Math.abs(dr), Math.abs(dy)) * GRAD;
    const hebel = Math.abs(
      ((STEMPEL_AUGE.r - ZYLINDER_AUFNAHME.r) * dy - (By - Zy) * dr) / Math.max(laenge, 1e-6)
    );
    laengeMin = Math.min(laengeMin, laenge);
    neigungMax = Math.max(neigungMax, neigung);
    hebelMin = Math.min(hebelMin, hebel);
    if (i === 0) {
      neigungZu = neigung;
      hebelZu = hebel;
      laengeZu = laenge;
    }
    if (i === N) {
      neigungOffen = neigung;
      hebelOffen = hebel;
      laengeOffen = laenge;
    }
  }
  return {
    neigungZu,
    neigungOffen,
    neigungMax,
    hebelZu,
    hebelOffen,
    hebelMin,
    laengeZu,
    laengeOffen,
    laengeMin,
    hub: laengeZu - laengeOffen,
  };
}

/**
 * Die Gegenprobe: bei heutiger Bolzenhöhe muss die Kopie das Original treffen.
 *
 * Ein Wächter mit Zahlenschranke, der nie meldet, ist keiner. Deshalb prüft
 * `probe()` NICHT nur, dass es passt, sondern gibt auch den Abstand zurück,
 * den eine um 1 mm verschobene Bolzenhöhe erzeugt — wenn der null wäre, wäre
 * die Prüfung blind.
 */
export function probe(): { fehler: number; gegenprobe: number } {
  let fehler = 0;
  for (let i = 0; i <= 60; i++) {
    const s = schwenkFuer(i / 60);
    const c = Math.cos(-s);
    const sn = Math.sin(-s);
    const r = STEMPEL_AUGE.r + (OBERE_ANBINDUNG.y * sn + OBERE_ANBINDUNG.z * c);
    const y = STEMPEL_AUGE.y + (OBERE_ANBINDUNG.y * c - OBERE_ANBINDUNG.z * sn);
    const dr = r - ZYLINDER_AUFNAHME.r;
    const dy = y - ZYLINDER_AUFNAHME.y;
    fehler = Math.max(fehler, Math.abs(Math.hypot(dr, dy) - zylinderLaenge(s)));
    fehler = Math.max(
      fehler,
      Math.abs(Math.atan2(Math.abs(dr), Math.abs(dy)) - zylinderNeigung(s))
    );
    fehler = Math.max(
      fehler,
      Math.abs(
        Math.abs(
          ((STEMPEL_AUGE.r - ZYLINDER_AUFNAHME.r) * dy - (STEMPEL_AUGE.y - ZYLINDER_AUFNAHME.y) * dr) /
            Math.hypot(dr, dy)
        ) - hebelarm(s)
      )
    );
  }
  const a = anlenkungBei(STEMPEL_AUGE.y);
  const b = anlenkungBei(STEMPEL_AUGE.y + 0.001);
  return { fehler, gegenprobe: Math.abs(a.hebelMin - b.hebelMin) };
}

/* ================================================================ 2  KORB */

export interface Korbmass {
  /** Tiefster Punkt geschlossen, unter dem BOLZEN (m). */
  tiefeZu: number;
  /** Tiefster Punkt über den Schließweg, unter dem BOLZEN (m). */
  maxTiefe: number;
  /** Schwebehöhe geschlossen (m). */
  schwebt: number;
  /** Maulweite offen, Spitze zu Spitze (m). */
  maul: number;
  /** Größter gezeichneter Durchmesser über den Weg (m). */
  huellkreis: number;
  /**
   * Tiefster Punkt in WELTHÖHE (m, unter der Aufhängung) — die Gegenprobe.
   *
   * Alles andere in diesem Satz ist auf den Bolzen bezogen und darf sich beim
   * Heben NICHT rühren. Wäre `hoch` wirkungslos, wäre das trivial richtig und
   * die Prüfung blind. Diese eine Zahl MUSS sich um genau `hoch` ändern.
   */
  tiefeWelt: number;
}

/**
 * Korbmaße einer Schale, gemessen UNTER IHREM BOLZEN.
 *
 * Der Bezug ist Absicht: Die Schale hängt am Bolzen und geht mit, wenn er
 * wandert. Alles, was hier herauskommt, muss darum von `hoch` unabhängig sein
 * — und genau das ist die Aussage, die das Blatt braucht. Gemessen statt
 * behauptet: `hoch` verschiebt das Schalengelenk wirklich.
 */
export function korbmass(hoch: number, stufen = 200): Korbmass {
  const g = baueGreiferInTeilen(stoffe());
  for (const s of g.schalen) s.gelenk.position.y += hoch;
  const bolzen = STEMPEL_AUGE.y + hoch;
  const p = new THREE.Vector3();
  const tiefe = (t: number): number => {
    g.setOeffnung(t);
    g.wurzel.updateMatrixWorld(true);
    let d = 0;
    g.schalen[0]!.gelenk.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) {
        p.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
        d = Math.max(d, bolzen - p.y);
      }
    });
    return d;
  };
  let maxTiefe = 0;
  for (let i = 0; i <= stufen; i++) maxTiefe = Math.max(maxTiefe, tiefe(i / stufen));
  const tiefeZu = tiefe(0);

  g.setOeffnung(1);
  g.wurzel.updateMatrixWorld(true);
  const zahn = g.schalen[0]!.gelenk
    .getObjectByName("SHELL_TIP_01")!
    .getObjectByName("07_ZAHN") as THREE.Mesh;
  const pos = zahn.geometry.getAttribute("position") as THREE.BufferAttribute;
  const m = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let k = pos.count - 5; k < pos.count; k++) m.add(v.fromBufferAttribute(pos, k));
  m.multiplyScalar(0.2).applyMatrix4(zahn.matrixWorld);

  let huellkreis = 0;
  for (let i = 0; i <= 40; i++) {
    g.setOeffnung(i / 40);
    g.wurzel.updateMatrixWorld(true);
    g.schalen[0]!.gelenk.traverse((o) => {
      const q = o as THREE.Mesh;
      if (!q.isMesh) return;
      const a = q.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < a.count; k++) {
        p.fromBufferAttribute(a, k).applyMatrix4(q.matrixWorld);
        huellkreis = Math.max(huellkreis, 2 * Math.hypot(p.x, p.z));
      }
    });
  }
  return {
    tiefeZu,
    maxTiefe,
    schwebt: maxTiefe - tiefeZu,
    maul: 2 * Math.hypot(m.x, m.z),
    huellkreis,
    tiefeWelt: maxTiefe - bolzen,
  };
}

/* ============================================ 3  SCHLUND UND EIGENKOLLISION */

/** Dreiecke eines Teilbaums in Weltlage. */
export function dreiecke(wurzel: THREE.Object3D): Float64Array[] {
  wurzel.updateMatrixWorld(true);
  const raus: Float64Array[] = [];
  const v = new THREE.Vector3();
  wurzel.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const anz = idx ? idx.count : pos.count;
    for (let i = 0; i < anz; i += 3) {
      const t = new Float64Array(9);
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        t[j * 3] = v.x;
        t[j * 3 + 1] = v.y;
        t[j * 3 + 2] = v.z;
      }
      raus.push(t);
    }
  });
  return raus;
}

/**
 * Wie viel Fläche in der Ebene `y` von Material versperrt ist (m²).
 *
 * Das ist das Mass, mit dem am 14.09.2026 die Saeule gekuerzt wurde: „In der
 * Ebene 5 cm ueber den Bolzen versperrte die Saeule 0,46 m² von 2,49 m²" — der
 * SCHLUND, also das, was von oben ueberhaupt hineinfaellt. Gemessen wird mit
 * senkrechten Strahlen (ungerade Zahl von Durchstossungen darueber = im
 * Koerper), auf einem 1-cm-Raster.
 */
export function versperrt(tris: Float64Array[], y: number, raster = 0.01, R = 1.8): number {
  let flaeche = 0;
  for (let x = -R; x <= R; x += raster) {
    for (let z = -R; z <= R; z += raster) {
      let n = 0;
      for (const t of tris) {
        /* Baryzentrisch in der xz-Projektion; y des Schnittpunkts ueber der Ebene? */
        const x1 = t[0]!;
        const z1 = t[2]!;
        const x2 = t[3]!;
        const z2 = t[5]!;
        const x3 = t[6]!;
        const z3 = t[8]!;
        const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
        if (Math.abs(d) < 1e-12) continue;
        const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d;
        if (a < 0 || a > 1) continue;
        const b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d;
        if (b < 0 || b > 1) continue;
        const c = 1 - a - b;
        if (c < 0 || c > 1) continue;
        if (a * t[1]! + b * t[4]! + c * t[7]! > y) n++;
      }
      if (n % 2 === 1) flaeche += raster * raster;
    }
  }
  return flaeche;
}

/** Kleinster Abstand zweier Punktwolken (m) — grob, aber ausreichend. */
export function naehe(a: THREE.Vector3[], b: THREE.Vector3[]): number {
  let min = Infinity;
  for (const p of a) for (const q of b) {
    const d = p.distanceToSquared(q);
    if (d < min) min = d;
  }
  return Math.sqrt(min);
}

export function wolke(wurzel: THREE.Object3D, raster = 0.02): THREE.Vector3[] {
  wurzel.updateMatrixWorld(true);
  const gesehen = new Set<string>();
  const raus: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  wurzel.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const k = `${Math.round(v.x / raster)}|${Math.round(v.y / raster)}|${Math.round(v.z / raster)}`;
      if (gesehen.has(k)) continue;
      gesehen.add(k);
      raus.push(v.clone());
    }
  });
  return raus;
}

/**
 * Kommen sich die fuenf Schalen und der Kopf in die Quere, wenn der Bolzen um
 * `hoch` steigt?
 *
 * Zwei Fragen, und sie sind NICHT dieselbe:
 *   Schale gegen Nachbarschale — aendert sich durch eine gemeinsame Hebung
 *      GAR NICHT (alle fuenf steigen um denselben Betrag). Wird trotzdem
 *      gemessen, damit die Aussage nicht auf einem Gedanken beruht.
 *   Schale gegen KOPF (Traverse, Drehwerksgehaeuse, Stempel) — genau hier
 *      wird es eng, denn der Kopf bleibt stehen, wo er ist.
 */
export function freigang(hoch: number): { nachbar: number; traverse: number; wo: number } {
  const g = baueGreiferInTeilen(stoffe());
  for (const s of g.schalen) s.gelenk.position.y += hoch;
  /* Der Stempel traegt die Bolzen und geht mit ihnen mit — er bleibt aussen vor. */
  g.stempel.position.y += hoch;
  let nachbar = Infinity;
  let traverse = Infinity;
  let wo = 0;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    g.setOeffnung(t);
    g.wurzel.updateMatrixWorld(true);
    const s0 = wolke(g.schalen[0]!.gelenk, 0.03);
    const s1 = wolke(g.schalen[1]!.gelenk, 0.03);
    const k = wolke(g.traverse, 0.03);
    const n = naehe(s0, s1);
    const h = naehe(s0, k);
    if (n < nachbar) nachbar = n;
    if (h < traverse) {
      traverse = h;
      wo = t;
    }
  }
  return { nachbar, traverse, wo };
}

/**
 * Die Teile des KOPFES — Rotator, Drehwerksgehaeuse, Mitteltraverse.
 *
 * Alles, was unter dem Adapter haengt und sich weder mit den Schalen noch mit
 * dem Stempel bewegt. Ueber die Kinderliste gesucht statt ueber Namen: Wer ein
 * Bauteil umbenennt, soll hier nicht stillschweigend eines verlieren.
 */
export function kopfteile(g: ReturnType<typeof baueGreiferInTeilen>): THREE.Object3D[] {
  const schalen = new Set<THREE.Object3D>(g.schalen.map((s) => s.gelenk));
  const zylinder = new Set<THREE.Object3D>(g.zylinder.map((z) => z.gelenk));
  return g.rotator.children.filter(
    (k) => !schalen.has(k) && !zylinder.has(k) && k !== g.stempel
  );
}

/**
 * Variante 3: der KOPF kommt zum Bolzen herunter, der Bolzen bleibt stehen.
 *
 * Gemessen wird am gebauten Netz: Rotator, Gehaeuse und Traverse wandern um
 * `delta` nach unten, Schalen und Stempel bleiben. Zurueck kommt, was dabei
 * wirklich passiert — wie tief der Kopf unter die Bolzenebene reicht, wie viel
 * er vom Schlund versperrt, wie nah er den Schalen kommt und welche Luecke
 * oben zum Adapter aufreisst.
 */
export function kopfHerunter(
  delta: number,
  /*
   * Die Schlundmessung kostet 130.000 Strahlen. Fuers Blatt ist sie noetig,
   * fuer den Waechter nicht — der prueft die Lage des Kopfes, nicht die
   * Flaeche. Wer sie abschaltet, bekommt 0 und weiss das.
   */
  mitSchlund = true
): {
  tiefsterKopf: number;
  unterBolzen: number;
  schlund: number;
  freiZuSchale: number;
  luecke: number;
  rotatorY: number;
  traverseYneu: number;
} {
  const g = baueGreiferInTeilen(stoffe());
  const kopf = kopfteile(g);
  for (const k of kopf) k.position.y -= delta;
  const gruppe = new THREE.Group();
  g.wurzel.updateMatrixWorld(true);
  for (const k of kopf) gruppe.add(k);

  let tiefsterKopf = 0;
  const p = new THREE.Vector3();
  gruppe.updateMatrixWorld(true);
  gruppe.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      tiefsterKopf = Math.min(tiefsterKopf, p.y);
    }
  });

  let freiZuSchale = Infinity;
  for (let i = 0; i <= 20; i++) {
    g.setOeffnung(i / 20);
    g.wurzel.updateMatrixWorld(true);
    gruppe.updateMatrixWorld(true);
    freiZuSchale = Math.min(freiZuSchale, naehe(wolke(g.schalen[0]!.gelenk, 0.03), wolke(gruppe, 0.03)));
  }
  g.setOeffnung(1);
  g.wurzel.updateMatrixWorld(true);
  gruppe.updateMatrixWorld(true);
  const schlund = mitSchlund
    ? versperrt(dreiecke(gruppe).concat(dreiecke(g.stempel)), STEMPEL_AUGE.y + 0.05)
    : 0;

  return {
    tiefsterKopf,
    unterBolzen: STEMPEL_AUGE.y - tiefsterKopf,
    schlund,
    freiZuSchale,
    /* Der Adapter bleibt an der Aufhaengung — darunter klafft jetzt Luft. */
    luecke: delta,
    rotatorY: -0.51 - delta,
    traverseYneu: TRAVERSE_Y - delta,
  };
}

/* ======================================================= 4  BAUHOEHE / ARM */

/**
 * Wie tief der Arm die Stielspitze ueberhaupt bekommt (m ueber Grund),
 * je waagerechtem Abstand vom Drehmittelpunkt.
 *
 * Gemessen am ECHTEN Bagger, nicht an nachgeschriebenen Konstanten: Ausleger-
 * und Stielwinkel werden gesetzt, die Meshkette nachgefuehrt und die Weltlage
 * von `grappleGroup` abgelesen. Der Bodenanschlag ist dabei ausdruecklich NICHT
 * im Spiel — gefragt ist, was die Kinematik hergibt.
 */
export async function stielspitze(): Promise<Map<number, number>> {
  const { leinwandAttrappe } = await import("../leinwand-attrappe");
  const RAPIER = (await import("@dimforge/rapier3d-compat")).default;
  const { initPhysics } = await import("../../src/physics/physicsWorld");
  const { Excavator } = await import("../../src/excavator/excavator");
  const { BAGGER_STAND } = await import("../../src/world/baggerstand");
  leinwandAttrappe();
  await initPhysics();
  const welt = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = welt.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  welt.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), welt);
  const b = bagger as unknown as { boomAngle: number; stickAngle: number; syncMeshes(): void };
  const tiefste = new Map<number, number>();
  for (let bo = 5; bo <= 70; bo += 0.5) {
    for (let st = -140; st <= -25; st += 0.5) {
      b.boomAngle = bo / GRAD;
      b.stickAngle = st / GRAD;
      b.syncMeshes();
      const p = bagger.grappleGroup.position;
      const d = Math.round(Math.hypot(p.x - BAGGER_STAND.x, p.z - BAGGER_STAND.z) * 10) / 10;
      const alt = tiefste.get(d);
      if (alt === undefined || p.y < alt) tiefste.set(d, p.y);
    }
  }
  return tiefste;
}

