/**
 * Die drei Zahnformen des Fuenfschalengreifers und ihre Masse — EINE Quelle
 * fuer zwei Blaetter.
 *
 * Herausgeloest aus `zahnknick.ts` am 15.09.2026 (E-068/E-069 haben das Blatt
 * gebracht, das Vorher-Nachher-Blatt braucht dieselbe Rechnung). Zwei Kopien
 * derselben Messung waeren zwei Wahrheiten — und die Frage, die hier beantwortet
 * wird, ist gerade die, ob ueberhaupt etwas gebaut wurde. Eine abgeschriebene
 * Zahl kann das nicht beantworten.
 *
 *   A  bis 15.09. gebaut   Anschlag 96,25°, Zahn 12,15° gegen das Schalenende
 *   B  SEIT E-069 gebaut   Anschlag 96,25°, Zahn tangential
 *   C  verworfen           Anschlag 108,40°, Zahn tangential
 *
 * Gemessen wird am GEBAUTEN NETZ, nicht an einer Nachbildung: Jede Form wird
 * zusammengesetzt und danach abgetastet. Wer `teile.ts` aendert, aendert die
 * Zahlen hier mit.
 */
import * as THREE from "three";
import {
  DREHPUNKT,
  OFFEN,
  STEMPEL_AUGE,
  ZU,
  baueGreiferspitze,
  schalenEnde,
  stoffe,
  zahnAnstellung,
  zahnEigenwinkel,
} from "../../src/fuenfschalen/teile";
import { baueGreiferInTeilen, hebelarm, type Formsatz } from "../../src/fuenfschalen/rig";

export const GRAD = 180 / Math.PI;

/** Der Anschlag, bei dem der tangential sitzende Zahn offen lotrecht steht. */
export const ANSCHLAG_C = schalenEnde().th - zahnEigenwinkel();

export interface Form {
  kurz: string;
  name: string;
  ruf: string;
  form: Formsatz;
  /** Anstellung des Zahns gegen das Schalenende (rad) — 0 heisst knickfrei. */
  anstellung: number;
}

const GRUND = { drehpunktR: STEMPEL_AUGE.r, versatz: DREHPUNKT.versatz };

export const FORMEN: Form[] = [
  {
    kurz: "A",
    name: "A — bis 15.09. gebaut",
    ruf: "Zahn 12,15° angestellt",
    form: { ...GRUND, offen: OFFEN },
    anstellung: zahnEigenwinkel(),
  },
  {
    kurz: "B",
    name: "B — SEIT E-069 GEBAUT",
    ruf: "Zahn tangential, 96,25°",
    form: { ...GRUND, offen: OFFEN },
    anstellung: 0,
  },
  {
    kurz: "C",
    name: "C — Knick weg, Anschlag folgt",
    ruf: "Zahn tangential, 108,40°",
    form: { ...GRUND, offen: ANSCHLAG_C },
    anstellung: 0,
  },
];

/**
 * Einen Greifer mit vorgegebener ZAHNANSTELLUNG bauen.
 *
 * `rig.baueGreifer` leitet die Anstellung aus `form.offen` ab — die beiden
 * lassen sich ueber den Formsatz nicht trennen. Fuer Variante B muessen sie es
 * aber: derselbe Anschlag wie heute, aber ein tangential sitzender Zahn.
 * Deshalb wird der Zahn hier NACH dem Bau ausgetauscht, an derselben Stelle
 * und mit derselben Lage. Alles andere am Modell bleibt, wie `rig.ts` es baut.
 */
export function baue(f: Form): ReturnType<typeof baueGreiferInTeilen> {
  const g = baueGreiferInTeilen(stoffe(), f.form);
  const soll = zahnAnstellung(f.form.offen);
  if (Math.abs(soll - f.anstellung) < 1e-9) return g;
  /*
   * `baueGreiferspitze(st, offen)` liest die Anstellung aus `offen`. Gesucht
   * ist `anstellung`, also wird der Wert eingesetzt, der sie ergibt:
   *   anstellung = offen − th + eigen   →   offen = anstellung + th − eigen
   */
  const ersatz = f.anstellung + schalenEnde().th;
  for (let i = 0; i < g.schalen.length; i++) {
    const nr = String(i + 1).padStart(2, "0");
    const alt = g.schalen[i]!.gelenk.getObjectByName(`SHELL_TIP_${nr}`)!;
    const neu = baueGreiferspitze(stoffe(), ersatz);
    neu.name = alt.name;
    neu.position.copy(alt.position);
    neu.rotation.copy(alt.rotation);
    alt.parent!.add(neu);
    alt.parent!.remove(alt);
  }
  return g;
}

export interface Mass {
  /** Schwebehoehe geschlossen ueber dem Beton (m). */
  schwebt: number;
  /** Tiefster Punkt geschlossen, unter der Aufhaengung (m). */
  tiefeZu: number;
  /** Tiefster Punkt ueber den ganzen Schliessweg (m) — daran setzt der Arm ab. */
  maxTiefe: number;
  /** Anteil des Weges, an dem er erreicht wird. */
  bei: number;
  /** Maulweite offen, Zahnspitze zu Zahnspitze ueber die Achse (m). */
  maul: number;
  /** Korbtiefe unter der Bolzenebene, geschlossen (m). */
  korbtiefe: number;
  /** Zahnachse gegen den Boden im Augenblick des Bodenkontakts (Grad). */
  zahnBoden: number;
  /** Zahnachse gegen die Senkrechte bei voller Oeffnung (Grad) — Soll 0. */
  zahnOffen: number;
  /** Kleinster Hebelarm des Zylinders ueber den Weg (m). */
  hebelMin: number;
  /** Hebelarm ganz offen (m). */
  hebelOffen: number;
  /** Groesster gezeichneter Durchmesser ueber den Weg (m). */
  huellkreis: number;
  /** Genutzter Sektor je Schale (Grad), Grenze 36. */
  sektor: number;
}

/**
 * Wie weit die Zahnachse bei Schwenk `s` von der Senkrechten absteht (rad).
 *
 * Nicht am Netz abgegriffen, sondern aus der Kette gerechnet, die
 * `zahnAnstellung` dokumentiert: Weltdrehung des Zahnrahmens ist
 * `−s + schalenEnde().th + Anstellung`, und lotrecht steht die ACHSE, wenn
 * diese Drehung gerade `zahnEigenwinkel()` betraegt. Die Abweichung ist also
 * die Differenz. Gegengeprueft am Netz: 34,15° gerechnet gegen 33,5° gemessen
 * fuer A am Tiefpunkt — der Rest ist der Unterschied zwischen Achse und
 * tiefstem Netzpunkt.
 */
export function zahnGegenSenkrechte(f: Form, s: number): number {
  return -s + schalenEnde().th + f.anstellung - zahnEigenwinkel();
}

/** Der Knoten `07_ZAHN` der ersten Schale. */
export function zahnNetz(g: ReturnType<typeof baue>): THREE.Mesh {
  return g.schalen[0]!.gelenk
    .getObjectByName("SHELL_TIP_01")!
    .getObjectByName("07_ZAHN") as THREE.Mesh;
}

/**
 * Weltlage der Zahnspitze bei Oeffnung `t`.
 *
 * Ueber die letzten fuenf Eckpunkte des Netzes — das ist die Stirnflaeche, mit
 * der die Zeichnung auf 22 x 14 mm auslaeuft. NICHT ueber „aeussersten Punkt":
 * bei einer nach innen gekruemmten Schale ist das die Rueckseite, und genau
 * daran ist am 14.09.2026 ein Messwerkzeug gescheitert.
 */
export function zahnspitze(g: ReturnType<typeof baue>, t: number): THREE.Vector3 {
  g.setOeffnung(t);
  g.wurzel.updateMatrixWorld(true);
  const z = zahnNetz(g);
  const pos = z.geometry.getAttribute("position") as THREE.BufferAttribute;
  const m = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let k = pos.count - 5; k < pos.count; k++) m.add(v.fromBufferAttribute(pos, k));
  return m.multiplyScalar(0.2).applyMatrix4(z.matrixWorld);
}

export function miss(f: Form): Mass {
  const g = baue(f);
  const p = new THREE.Vector3();

  /* Tiefster Punkt der GANZEN Schale — nicht nur des Zahns. */
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
        d = Math.max(d, -p.y);
      }
    });
    return d;
  };
  let maxTiefe = 0;
  let bei = 0;
  for (let i = 0; i <= 200; i++) {
    const d = tiefe(i / 200);
    if (d > maxTiefe) {
      maxTiefe = d;
      bei = i / 200;
    }
  }
  const tiefeZu = tiefe(0);

  const spitzeR = (t: number): number => {
    const m = zahnspitze(g, t);
    return Math.hypot(m.x, m.z);
  };

  let huellkreis = 0;
  let sektor = 0;
  for (let i = 0; i <= 40; i++) {
    g.setOeffnung(i / 40);
    g.wurzel.updateMatrixWorld(true);
    const s0 = g.schalen[0]!;
    s0.gelenk.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const q = m.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < q.count; k++) {
        p.fromBufferAttribute(q, k).applyMatrix4(m.matrixWorld);
        const r = Math.hypot(p.x, p.z);
        huellkreis = Math.max(huellkreis, 2 * r);
        if (r < 0.3) continue;
        let d = Math.atan2(p.x, p.z) - s0.winkel;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        sektor = Math.max(sektor, Math.abs(d) * GRAD);
      }
    });
  }

  let hebelMin = Infinity;
  for (let i = 0; i <= 200; i++) {
    hebelMin = Math.min(hebelMin, hebelarm(ZU + ((f.form.offen - ZU) * i) / 200, f.form));
  }

  const sStern = (f.form.offen - ZU) * bei;
  return {
    schwebt: maxTiefe - tiefeZu,
    tiefeZu,
    maxTiefe,
    bei,
    maul: 2 * spitzeR(1),
    korbtiefe: tiefeZu - -STEMPEL_AUGE.y,
    zahnBoden: 90 - Math.abs(zahnGegenSenkrechte(f, sStern) * GRAD),
    zahnOffen: zahnGegenSenkrechte(f, f.form.offen) * GRAD,
    hebelMin,
    hebelOffen: hebelarm(f.form.offen, f.form),
    huellkreis,
    sektor,
  };
}
