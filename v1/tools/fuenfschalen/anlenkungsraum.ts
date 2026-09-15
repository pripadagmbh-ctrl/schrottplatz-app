/**
 * Der Anlenkungsraum — wo es überhaupt Lösungen gibt. GERECHNET, NICHT GEBAUT.
 *
 * Anlass, wörtlich (Patrick, 15.09.2026, vor `docs/f5-anlenkung-2026-09-15.svg`):
 *
 *   „Also ich glaube, das liegt halt ein bisschen an deinem oberen Aufbau. Das
 *    Problem, das ursprüngliche Problem ist ja, dass der Stempel breiter sein
 *    muss oder die Traverse, was auch immer, als der obere Teil, wo die
 *    Zylinder da sind. Da muss er die Spinne halt ein bisschen anders bauen,
 *    damit wir das gelöst bekommen. Aber es kann nicht sein, dass wir da keine
 *    Lösung finden."
 *
 * ER HAT RECHT, UND UNSER BISHERIGER ANSATZ WAR ZU ENG. E-072 und E-074 haben
 * immer nur EINE Größe verschoben — die Höhe — und alles andere festgehalten.
 * Dann bleibt zwangsläufig „nicht baubar". Hier sind VIER Größen frei:
 *
 *   rOben   Radius der Zylinderaufnahme am Kopf        (heute 0,465 m)
 *   rUnten  Radius des Schalenbolzenkreises            (heute 0,590 m)
 *   Ay, Az  Lage des oberen Schalenauges gegen den Bolzen, längs und quer
 *                                                      (heute −0,08 / 0,245)
 *
 * und gesucht wird die kleinste SÄULE, die alle Schranken hält. Die Säule ist
 * `d − 0,23`: Zwischen Zylinderaufnahme und Traversenmitte liegen fest 0,23 m
 * (E-039), darunter beginnt der Abstand zum Bolzen. Säule 0 heißt d = 0,23.
 *
 * `Ay`/`Az` sind mit dabei, weil E-039 sie selbst als Stellschraube benutzt hat
 * (von 0/0,31 auf −0,08/0,245). Ohne sie ist die Karte fast leer, und das wäre
 * keine Antwort, sondern die Wiederholung der alten Annahme.
 *
 * DER BEFUND, DER DIE KARTE ERKLÄRT: Die Anlenkung sieht von den beiden Radien
 * nur ihre DIFFERENZ `rUnten − rOben`. In `zylinderLaenge`, `zylinderNeigung`
 * und `hebelarm` stehen ausschließlich Differenzen — dieselbe Lehre wie in
 * E-074, eine Ebene höher. Die Karte über (rOben, rUnten) ist deshalb entlang
 * ihrer Diagonalen konstant, und die zweite Richtung entscheidet nicht die
 * Hydraulik, sondern die Kopfbreite: was der Kopf von oben zubaut.
 *
 * `src/` ist unberührt. Die Rechnung prüft sich bei jedem Lauf gegen `rig.ts`.
 */
import {
  stoffe,
  DREHPUNKT,
  MASS,
  OBERE_ANBINDUNG,
  OFFEN,
  STEMPEL_AUGE,
  ZU,
  ZYLINDER_AUFNAHME,
  schwenkFuer,
} from "../../src/fuenfschalen/teile";
import { baueGreiferInTeilen, hebelarm, zylinderLaenge, zylinderNeigung } from "../../src/fuenfschalen/rig";
import * as THREE from "three";

export const GRAD = 180 / Math.PI;

/** Länge des Zylinderrohrs (m) — dieselbe Ableitung wie in `rig.stelleSchale`. */
export const ROHR = MASS.zylinder.laenge * 0.6;
/** Äquator der geschlossenen Kugel: `drehpunktR + versatz` (rig.Formsatz). */
export const AEQUATOR = STEMPEL_AUGE.r + DREHPUNKT.versatz;
/** Fester Abstand Zylinderaufnahme ↔ Traversenmitte (m), seit E-039. */
export const AUFNAHME_UEBER_TRAVERSE = ZYLINDER_AUFNAHME.y - -0.865;
/** Heutiger senkrechter Abstand Aufnahme ↔ Bolzen (m). */
export const D_HEUTE = ZYLINDER_AUFNAHME.y - STEMPEL_AUGE.y;
/** Heutige Säulenhöhe (m). */
export const SAEULE_HEUTE = -0.865 - STEMPEL_AUGE.y;
/** Heutiger Abstand der beiden Radien (m) — positiv heißt: Bolzen weiter außen. */
export const DR_HEUTE = STEMPEL_AUGE.r - ZYLINDER_AUFNAHME.r;

/* ------------------------------------------------------------- Die Rechnung */

export interface Anlenkung {
  /** Abstand der beiden Radien: `rUnten − rOben` (m). */
  dr0: number;
  /** Senkrechter Abstand Aufnahme ↔ Bolzen (m). */
  d: number;
  /** Schalenauge gegen den Bolzen, längs der Schale (m). */
  Ay: number;
  /** Schalenauge gegen den Bolzen, quer dazu (m). */
  Az: number;
}

export interface Kennwert {
  neigungMax: number;
  hebelMin: number;
  hebelZu: number;
  laengeZu: number;
  laengeOffen: number;
  laengeMin: number;
  laengeMax: number;
  hub: number;
  /** Wie weit die Stange im ungünstigsten Fall aus dem Rohr schaut (m). */
  ueberstand: number;
}

/**
 * Kennwerte der Anlenkung über den ganzen Schließweg.
 *
 * Wortgleich mit `anbindungspunkt`/`zylinderNeigung`/`hebelarm` in `rig.ts`,
 * nur dass dort vier Zahlen Konstanten sind. Die Kopie ist zulässig, WEIL sie
 * sich gegen das Original prüfen lässt — `probe()` tut das bei jedem Lauf und
 * bricht ab, wenn sie abweicht.
 */
export function kennwert(a: Anlenkung, stufen = 40): Kennwert {
  let neigungMax = 0;
  let hebelMin = Infinity;
  let laengeMin = Infinity;
  let laengeMax = 0;
  let hebelZu = 0;
  let laengeZu = 0;
  let laengeOffen = 0;
  for (let i = 0; i <= stufen; i++) {
    const s = ZU + ((OFFEN - ZU) * i) / stufen;
    const c = Math.cos(-s);
    const sn = Math.sin(-s);
    /* Alles relativ: Aufnahme im Ursprung, Bolzen bei (dr0, −d). */
    const dr = a.dr0 + (a.Ay * sn + a.Az * c);
    const dy = -a.d + (a.Ay * c - a.Az * sn);
    const l = Math.hypot(dr, dy);
    const neigung = Math.atan2(Math.abs(dr), Math.abs(dy)) * GRAD;
    const hebel = Math.abs((a.dr0 * dy + a.d * dr) / Math.max(l, 1e-9));
    if (neigung > neigungMax) neigungMax = neigung;
    if (hebel < hebelMin) hebelMin = hebel;
    if (l < laengeMin) laengeMin = l;
    if (l > laengeMax) laengeMax = l;
    if (i === 0) {
      hebelZu = hebel;
      laengeZu = l;
    }
    if (i === stufen) laengeOffen = l;
  }
  return {
    neigungMax,
    hebelMin,
    hebelZu,
    laengeZu,
    laengeOffen,
    laengeMin,
    laengeMax,
    hub: laengeZu - laengeOffen,
    ueberstand: laengeMin - ROHR,
  };
}

/** Die heutige Anlenkung, aus `teile.ts` gelesen statt abgeschrieben. */
export const HEUTE: Anlenkung = {
  dr0: DR_HEUTE,
  d: D_HEUTE,
  Ay: OBERE_ANBINDUNG.y,
  Az: OBERE_ANBINDUNG.z,
};

/**
 * Die Gegenprobe: bei den heutigen Maßen muss die Kopie das Original treffen.
 *
 * Und sie darf nicht blind sein — deshalb wird auch gemessen, was ein um 1 cm
 * verschobener Radiusabstand ausmacht. Wäre das null, prüfte der Vergleich
 * oben nichts.
 */
export function probe(): { fehler: number; gegenprobe: number } {
  let fehler = 0;
  for (let i = 0; i <= 60; i++) {
    const s = schwenkFuer(i / 60);
    const c = Math.cos(-s);
    const sn = Math.sin(-s);
    const dr = HEUTE.dr0 + (HEUTE.Ay * sn + HEUTE.Az * c);
    const dy = -HEUTE.d + (HEUTE.Ay * c - HEUTE.Az * sn);
    const l = Math.hypot(dr, dy);
    fehler = Math.max(fehler, Math.abs(l - zylinderLaenge(s)));
    fehler = Math.max(fehler, Math.abs(Math.atan2(Math.abs(dr), Math.abs(dy)) - zylinderNeigung(s)));
    fehler = Math.max(fehler, Math.abs(Math.abs((HEUTE.dr0 * dy + HEUTE.d * dr) / l) - hebelarm(s)));
  }
  const a = kennwert(HEUTE);
  const b = kennwert({ ...HEUTE, dr0: HEUTE.dr0 + 0.01 });
  return { fehler, gegenprobe: Math.abs(a.hebelMin - b.hebelMin) };
}

/* ------------------------------------------------------------ Die Schranken */

/**
 * Die Bedingungen — alle aus dem Bestand, KEINE nachgezogen.
 *
 *   neigungMax  < 25°      `test/fuenfschalen.test.ts`, E-039
 *   hebelMin    > 0,115 m  dieselbe Stelle
 *   hebelZu     > 0,2 m    dieselbe Stelle („kein Totpunkt beim Schließen")
 *   laengeMin   ≥ Rohr+…   `haeltVertrag`; dort +0,02, hier zusätzlich +0,05
 *                          als „echter Überstand" — beides wird ausgewiesen
 *   hub         ≥ 0,15 m   `haeltVertrag`
 *   laengeMax   ≤ 1,05 m   `haeltVertrag`
 */
export const SCHRANKE = {
  neigung: 25,
  hebel: 0.115,
  hebelZu: 0.2,
  ueberstandKnapp: 0.02,
  ueberstandEcht: 0.05,
  hub: 0.15,
  laengeMax: 1.05,
} as const;

export type Grund = "" | "Neigung" | "Hebelarm" | "Hebel zu" | "Stange" | "Hub" | "zu lang";

/**
 * Wie viel Luft eine Lösung zu jeder Schranke hat, in Anteilen der Schranke.
 *
 * Negativ heißt gerissen. Der KLEINSTE Wert entscheidet — und sein Name ist die
 * Antwort auf „woran scheitert es hier". Ohne diese Normierung ließe sich ein
 * Winkel in Grad nicht gegen einen Hebelarm in Millimetern abwägen, und die
 * Karte müsste sich für eine Schranke entscheiden, statt zu zeigen, welche
 * zuerst bricht.
 */
export function schwaechste(k: Kennwert, echterUeberstand: boolean): [Grund, number] {
  const noetig = echterUeberstand ? SCHRANKE.ueberstandEcht : SCHRANKE.ueberstandKnapp;
  const alle: Array<[Grund, number]> = [
    ["Neigung", (SCHRANKE.neigung - k.neigungMax) / SCHRANKE.neigung],
    ["Hebelarm", (k.hebelMin - SCHRANKE.hebel) / SCHRANKE.hebel],
    ["Hebel zu", (k.hebelZu - SCHRANKE.hebelZu) / SCHRANKE.hebelZu],
    ["Stange", (k.ueberstand - noetig) / 0.1],
    ["Hub", (k.hub - SCHRANKE.hub) / SCHRANKE.hub],
    ["zu lang", (SCHRANKE.laengeMax - k.laengeMax) / SCHRANKE.laengeMax],
  ];
  let best: [Grund, number] = ["", Infinity];
  for (const e of alle) if (e[1] < best[1]) best = e;
  return best;
}

export function haelt(k: Kennwert, echterUeberstand: boolean): boolean {
  return schwaechste(k, echterUeberstand)[1] > 0;
}

/* ---------------------------------------------------------------- Die Suche */

export interface Fund {
  dr0: number;
  /** Kleinste Säule, die alles hält (m) — null, wenn es keine gibt. */
  saeule: number | null;
  Ay: number;
  Az: number;
  k: Kennwert | null;
  /** Woran es scheitert, wenn nichts geht — an der besten Stelle. */
  grund: Grund;
  /** Wie knapp es dort war (Anteil der Schranke, negativ = gerissen). */
  luft: number;
}

/**
 * Für einen Radiusabstand: die kleinste Säule, die alles hält — über alle
 * Lagen des Schalenauges.
 *
 * Abgetastet, nicht optimiert. Bei vier Größen ist ein Raster ehrlicher als
 * ein Suchlauf, der in ein lokales Loch fällt; und es kann sagen, WORAN es
 * scheitert, wo nichts geht. Ein Fund wird mit doppelt so feiner Abtastung des
 * Schließwegs gegengerechnet — sonst rutscht eine Lösung durch, die nur
 * zwischen den Stützstellen hält.
 */
/**
 * Die Raster fuer die Lage des Schalenauges — und warum die heutigen Werte
 * ausdruecklich darinstehen.
 *
 * Die erste Fassung rasterte in 2-cm-Schritten und meldete fuer den HEUTIGEN
 * Radiusabstand „keine Loesung" — obwohl der gebaute Greifer genau dort steht.
 * Grund: `OBERE_ANBINDUNG.z` ist 0,245 und lag zwischen zwei Rasterpunkten.
 * Der heutige Stand ist eine NADEL im Raum; ein Raster, das ihn nicht trifft,
 * behauptet, es gaebe ihn nicht. Deshalb sind seine beiden Zahlen jetzt Teil
 * des Rasters — und `test/anlenkungsraum.test.ts` prueft, dass er gefunden wird.
 */
const AY_RASTER: number[] = (() => {
  const a: number[] = [];
  for (let y = -0.44; y <= 0.5001; y += 0.01) a.push(Math.round(y * 1e4) / 1e4);
  if (!a.includes(OBERE_ANBINDUNG.y)) a.push(OBERE_ANBINDUNG.y);
  return a.sort((x, y) => x - y);
})();
const AZ_RASTER: number[] = (() => {
  const a: number[] = [];
  for (let z = 0.1; z <= 0.4001; z += 0.01) a.push(Math.round(z * 1e4) / 1e4);
  if (!a.includes(OBERE_ANBINDUNG.z)) a.push(OBERE_ANBINDUNG.z);
  return a.sort((x, y) => x - y);
})();

export function kleinsteSaeule(
  dr0: number,
  echterUeberstand: boolean,
  maxSaeule = 0.95,
  stufen = 21
): Fund {
  let besteLuft = -Infinity;
  let besterGrund: Grund = "";
  for (let saeule = 0; saeule <= maxSaeule + 1e-9; saeule += 0.01) {
    const d = saeule + AUFNAHME_UEBER_TRAVERSE;
    for (const Az of AZ_RASTER) {
      for (const Ay of AY_RASTER) {
        const k = kennwert({ dr0, d, Ay, Az }, stufen);
        const [g, v] = schwaechste(k, echterUeberstand);
        if (v > 0) {
          const fein = kennwert({ dr0, d, Ay, Az }, 80);
          if (haelt(fein, echterUeberstand)) {
            return { dr0, saeule, Ay, Az, k: fein, grund: "", luft: v };
          }
        }
        if (v > besteLuft) {
          besteLuft = v;
          besterGrund = g;
        }
      }
    }
  }
  return { dr0, saeule: null, Ay: 0, Az: 0, k: null, grund: besterGrund, luft: besteLuft };
}

/** Die Kurve über den Radiusabstand — daraus wird die Karte gefüllt. */
export function kurve(von: number, bis: number, schritt: number, echterUeberstand: boolean): Fund[] {
  const raus: Fund[] = [];
  for (let dr0 = von; dr0 <= bis + 1e-9; dr0 += schritt) {
    raus.push(kleinsteSaeule(Math.round(dr0 * 1e4) / 1e4, echterUeberstand));
  }
  return raus;
}

/** Durchmesser der Mitteltraverse zu einem Aufnahmeradius (m) — `traverseAus`. */
export function kopfDurchmesser(rOben: number): number {
  return 2 * rOben + 0.02;
}

/* ------------------------------------------- Der Arm, in Patricks Sprache */

/**
 * Wie weit der Schalenarm über seinen Bolzen hinausragt (m) — der ABSTAND
 * Bolzen ↔ Zylinderauge.
 *
 * `Ay` und `Az` sind Längs- und Quermaß im Schalenrahmen; was die Anlenkung
 * wirklich spürt, ist ihr Betrag. Heute sind das 0,2577 m.
 */
export function armRadius(Ay: number, Az: number): number {
  return Math.hypot(Ay, Az);
}

/**
 * Wie hoch das Zylinderauge beim ÖFFNEN über den Bolzen steigt (m).
 *
 * DAS IST DIE GRÖSSE, DIE DIE SÄULE ERZWINGT — und sie hängt NICHT davon ab,
 * ob der Arm nach oben oder nach unten zeigt.
 *
 * Das Auge läuft auf einem Kreis um den Bolzen: seine Höhe über dem Bolzen ist
 * `Ay·cos s + Az·sin s`, und das erreicht über den Schwenk von 96,25° seinen
 * Scheitel bei `hypot(Ay, Az)` — dem ARMRADIUS —, sobald der Winkel
 * `atan2(Az, Ay)` im Schwenkbereich liegt. Bei unserem Anschlag liegt er das
 * für jedes `Ay > −0,03`.
 *
 * Folge: Den Arm nach OBEN zu ziehen (`Ay` positiv statt negativ) verschiebt
 * nur, WANN der Scheitel kommt, nicht WIE HOCH er ist. Die Zylinderaufnahme
 * muss um diesen Scheitel plus den Winkelzuschlag darüberstehen — das ist die
 * Säule. Wer sie kürzen will, muss den ARMRADIUS kürzen, und der ist nach
 * unten durch den Hebelarm-Wächter gedeckelt: Der Hebelarm kann nie größer
 * werden als der Armradius.
 */
export function augenHoch(Ay: number, Az: number, stufen = 200): number {
  let hoch = -Infinity;
  for (let i = 0; i <= stufen; i++) {
    const s = ZU + ((OFFEN - ZU) * i) / stufen;
    hoch = Math.max(hoch, Ay * Math.cos(s) + Az * Math.sin(s));
  }
  return hoch;
}

/**
 * Kleinste Säule bei FESTEM Armradius — über alle Armwinkel und Kopfabstände.
 *
 * Damit lässt sich die Frage „hilft ein hochstehender Arm?" beantworten, ohne
 * sie zu glauben: Der Armwinkel `phi` läuft von −90° (Arm zeigt nach unten,
 * heute −18°) bis +90° (Arm zeigt nach oben), der Radius bleibt.
 */
export function kleinsteSaeuleBeiArm(
  armR: number,
  echterUeberstand: boolean,
  drVon = -0.6,
  drBis = 0.3,
  /* Armwinkel in Grad: negativ = Arm zeigt nach unten (heute −18°). */
  gVon = -90,
  gBis = 90
): { saeule: number | null; dr0: number; Ay: number; Az: number; k: Kennwert | null } {
  for (let saeule = 0; saeule <= 0.95 + 1e-9; saeule += 0.01) {
    const d = saeule + AUFNAHME_UEBER_TRAVERSE;
    for (let dr0 = drVon; dr0 <= drBis + 1e-9; dr0 += 0.02) {
      for (let g = gVon; g <= gBis + 0.01; g += 2) {
        const Ay = armR * Math.sin((g * Math.PI) / 180);
        const Az = armR * Math.cos((g * Math.PI) / 180);
        const k = kennwert({ dr0, d, Ay, Az }, 21);
        if (schwaechste(k, echterUeberstand)[1] > 0) {
          const fein = kennwert({ dr0, d, Ay, Az }, 80);
          if (haelt(fein, echterUeberstand)) {
            return { saeule, dr0, Ay, Az, k: fein };
          }
        }
      }
    }
  }
  return { saeule: null, dr0: 0, Ay: 0, Az: 0, k: null };
}

/* --------------------------------------------------------- Maße der Schale */

export interface Schalenmass {
  rUnten: number;
  tiefeZu: number;
  maxTiefe: number;
  schwebt: number;
  maul: number;
  huellkreis: number;
  sektor: number;
}

/**
 * Was ein anderer Bolzenkreis an der Schale kostet — am GEBAUTEN Netz gemessen.
 *
 * Der Formsatz hält `drehpunktR + versatz` auf dem Äquator (0,89), damit die
 * GESCHLOSSENE Form dieselbe bleibt. Was sich ändert, ist der offene Zustand:
 * Maulweite, Hüllkreis, Schwebehöhe und der Sektor, den eine Schale braucht.
 */
export function schalenmass(rUnten: number): Schalenmass {
  const g = baueGreiferInTeilen(stoffe(), {
    drehpunktR: rUnten,
    versatz: AEQUATOR - rUnten,
    offen: OFFEN,
  });
  const p = new THREE.Vector3();
  const tiefe = (t: number): number => {
    g.setOeffnung(t);
    g.wurzel.updateMatrixWorld(true);
    let d = 0;
    g.schalen[0]!.gelenk.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const a = m.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < a.count; k++) {
        p.fromBufferAttribute(a, k).applyMatrix4(m.matrixWorld);
        d = Math.max(d, STEMPEL_AUGE.y - p.y);
      }
    });
    return d;
  };
  let maxTiefe = 0;
  for (let i = 0; i <= 60; i++) maxTiefe = Math.max(maxTiefe, tiefe(i / 60));
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
  let sektor = 0;
  for (let i = 0; i <= 20; i++) {
    g.setOeffnung(i / 20);
    g.wurzel.updateMatrixWorld(true);
    const s0 = g.schalen[0]!;
    s0.gelenk.traverse((o) => {
      const q = o as THREE.Mesh;
      if (!q.isMesh) return;
      const a = q.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < a.count; k++) {
        p.fromBufferAttribute(a, k).applyMatrix4(q.matrixWorld);
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
  return {
    rUnten,
    tiefeZu,
    maxTiefe,
    schwebt: maxTiefe - tiefeZu,
    maul: 2 * Math.hypot(m.x, m.z),
    huellkreis,
    sektor,
  };
}
