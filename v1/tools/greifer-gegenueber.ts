/**
 * Die Tabelle zur Greiferfrage — druckt, was `greifer-modelle.ts` misst.
 *
 * Auftrag 15.09.2026: Bevor der Fuenfschalengreifer an den Bagger darf, muss
 * durchgerechnet sein, was sich an Reichweite, Grabtiefe, Korb und Kollidern
 * aendert. Dieses Werkzeug misst und druckt — es aendert nichts.
 *
 * Getrennt von der Messung, damit `greifer-vergleich-blatt.ts` dieselbe
 * Messung aufrufen kann, ohne dass dabei eine Tabelle in die Ausgabe laeuft.
 * Wie gemessen wird und warum nicht ueber Extrempunkte, steht im Kopf von
 * `greifer-modelle.ts`.
 *
 * Aufruf:  npx vite-node tools/greifer-gegenueber.ts
 */
import { hoechsteKrallenspitze } from "../src/excavator/excavator";
import { SCHWENK_AUSSEN, SCHWENK_INNEN } from "../src/world/baggerstand";
import { CONFIGS } from "../src/world/containers";
import { PRESS_INNER } from "../src/world/press";
import {
  CLAW_MAX_DEPTH,
  CLAW_OPEN_SPLAY,
  CLAW_RING_R,
  clawSpan,
} from "../src/excavator/clawGeometry";
import { STEMPEL_AUGE, ZU } from "../src/fuenfschalen/teile";
import {
  Messung,
  Pruefling,
  STAHL,
  dreiecke,
  fuenfschalen,
  korbRadius,
  miss,
  sichelkralle,
} from "./greifer-modelle";

/* ------------------------------------------------------------- Korbprofil */

/**
 * Was `isInsideGrapple` fuer einen Korb haelt — und wie der Korb wirklich
 * aussieht.
 *
 * `Excavator.isInsideGrapple` verjuengt den Korb GERADE vom Gelenkring zur
 * Spitze und legt 0,14 m Luft darum. Bei der Sichelkralle ist das eine
 * konservative Naeherung (der echte Korb bauscht sich dazwischen weiter aus);
 * beim Fuenfschalengreifer waere derselbe Kegel noch deutlich zu eng, weil
 * dessen Schalen am Aequator ansetzen und nicht an einem schmalen Zapfen.
 * Diese Tabelle beziffert es.
 */
function korbprofil(): void {
  console.log("");
  console.log("Korbprofil geschlossen — Radius in m, je Zehntel der Korbhoehe");
  const zeile = (n: string, w: string[]): string =>
    `  ${n.padEnd(30)}${w.map((x) => x.padStart(7)).join("")}`;
  console.log(zeile("Anteil der Korbhoehe", Array.from({ length: 11 }, (_, i) => (i / 10).toFixed(1))));
  for (const [p, ringR] of [
    [sichelkralle(), CLAW_RING_R],
    [fuenfschalen(), STEMPEL_AUGE.r],
  ] as Array<[Pruefling, number]>) {
    p.setOeffnung(0);
    const bahn = p.mittellinie(0);
    const yO = p.bolzenY;
    const yU = Math.min(...bahn.map((b) => b.y));
    const tipR = Math.max(bahn[bahn.length - 1]!.r, 0);
    const echt: string[] = [];
    const modell: string[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      echt.push(korbRadius(bahn, yO + (yU - yO) * t).toFixed(3));
      modell.push((ringR + (tipR - ringR) * t + 0.14).toFixed(3));
    }
    console.log(zeile(`${p.name} — echt`, echt));
    console.log(zeile(`${p.name} — isInsideGrapple`, modell));
  }
}

/* ------------------------------------------------- Reichweite und Behaelter */

/**
 * Was der Greiferwechsel an der Reichweite aendert.
 *
 * Die WAAGRECHTE Reichweite haengt allein am Arm: Der Greifer haengt lotrecht
 * unter der Stielspitze (`grappleGroup.position.copy(stickTip)`), sein Bau
 * verschiebt keinen einzigen Punkt in x oder z. Das Schwenkband
 * (`SCHWENK_INNEN` … `SCHWENK_AUSSEN`) bleibt deshalb, wie es ist.
 *
 * SENKRECHT geht die Grabtiefe als reine Subtraktion in `hoechsteKrallenspitze`
 * ein (`best = max(y) − tief`). Ein flacherer Greifer hebt die erreichbare
 * Spitzenhoehe an JEDER Stelle um genau denselben Betrag — die Differenz der
 * beiden Grabtiefen. Deshalb steht hier keine zweite Armrechnung, sondern die
 * eine Zahl, mit der die vorhandene zu verschieben ist.
 */
function reichweite(delta: number): void {
  console.log("");
  console.log(`Reichweite — Spitzenhoehe ueber Grund (m), Verschiebung ${delta >= 0 ? "+" : ""}${delta.toFixed(4)} m`);
  const zeile = (n: string, w: string[]): string =>
    `  ${n.padEnd(24)}${w.map((x) => x.padStart(9)).join("")}`;
  const abstaende = [4.6, 5.8, 6.0, 6.5, 7.5, 8.5, 9.2, 9.5];
  const heute = abstaende.map((d) => hoechsteKrallenspitze(d));
  console.log(zeile("Abstand vom Bagger (m)", abstaende.map((d) => d.toFixed(1))));
  console.log(zeile("Sichelkralle", heute.map((h) => (isFinite(h) ? h.toFixed(2) : "—"))));
  console.log(
    zeile("Fuenfschalengreifer", heute.map((h) => (isFinite(h) ? (h + delta).toFixed(2) : "—")))
  );
  console.log(`  Schwenkband unveraendert: ${SCHWENK_INNEN} … ${SCHWENK_AUSSEN} m`);
}

/**
 * Wie weit laesst sich der Greifer in einem Behaelter dieser Weite noch
 * oeffnen? 1,00 = ganz auf.
 *
 * Die Zeile „passt / passt nicht" allein hilft nicht: Ein Greifer, der nur bis
 * 90 % aufgeht, raeumt den Behaelter trotzdem aus. Gemessen wird der groesste
 * gezeichnete Durchmesser je Stellung.
 */
function oeffnungsgrenze(p: Pruefling, weite: number): number {
  let letzte = 0;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    p.setOeffnung(t);
    let weit = 0;
    for (const tri of dreiecke(p.wurzel)) {
      for (const j of [0, 3, 6]) weit = Math.max(weit, 2 * Math.hypot(tri[j]!, tri[j + 2]!));
    }
    if (weit > weite) return letzte;
    letzte = t;
  }
  return 1;
}

/** Behaelter des Platzes gegen beide Greifer gehalten. */
function behaelter(a: Messung, b: Messung): void {
  console.log("");
  console.log("Behaelter — lichte Weite gegen den groessten gezeichneten Durchmesser");
  const zeile = (n: string, w: string[]): string =>
    `  ${n.padEnd(30)}${w.map((x) => x.padStart(14)).join("")}`;
  console.log(zeile("", ["lichte Weite", a.name, b.name]));
  const sp = sichelkralle();
  const fp = fuenfschalen();
  const pruef = (name: string, weite: number): void => {
    console.log(
      zeile(name, [
        weite.toFixed(3),
        `${((weite - a.huellkreis) / 2).toFixed(3)} (${(oeffnungsgrenze(sp, weite) * 100).toFixed(0)} %)`,
        `${((weite - b.huellkreis) / 2).toFixed(3)} (${(oeffnungsgrenze(fp, weite) * 100).toFixed(0)} %)`,
      ])
    );
  };
  console.log("  (Luft JE SEITE in m; in Klammern: wie weit er darin noch aufgeht)");
  pruef("Presskammer quer", PRESS_INNER.tiefe);
  pruef("Presskammer laengs", PRESS_INNER.laenge);
  /*
   * Der Muellcontainer ist ein `rolloff` von 3,60 m Aussenmass; seine lichte
   * Weite steht mit 3,42 m in `containers.ts` und folgt aus Wandstaerke 0,09 m
   * je Seite (`T`). Hier nachgerechnet statt abgeschrieben.
   */
  const muell = CONFIGS.find((c) => c.kind === "rolloff");
  if (muell) pruef(`${muell.label} (quer)`, Math.min(muell.size[0], muell.size[1]) - 2 * 0.09);
  for (const c of CONFIGS) {
    if (c.kind === "bay" || c.sortierbox === true) {
      pruef(`${c.label} (${c.kind})`, Math.min(c.size[0], c.size[1]));
    }
  }
}

function main(): void {
  const m = [miss(sichelkralle()), miss(fuenfschalen())];
  const zeile = (n: string, w: string[]): string =>
    `  ${n.padEnd(42)}${w.map((x) => x.padStart(20)).join("")}`;
  console.log("Greifer-Gegenueberstellung — gemessen am gebauten Modell, 15.09.2026");
  console.log("");
  console.log(zeile("", m.map((x) => x.name)));
  console.log(zeile("Netze", m.map((x) => String(x.netze))));
  console.log(zeile("Dreiecke", m.map((x) => String(x.dreiecke))));
  console.log("");
  console.log(zeile("Grabtiefe Zahn ueber den Weg (m)", m.map((x) => x.grabtiefe.toFixed(4))));
  console.log(zeile("tiefster gezeichneter Punkt (m)", m.map((x) => x.tiefsterPunkt.toFixed(4))));
  console.log(zeile("Oberkante unter Aufhaengung (m)", m.map((x) => x.oberkante.toFixed(4))));
  console.log(zeile("Bauhoehe geschlossen (m)", m.map((x) => x.bauhoehe.toFixed(3))));
  console.log("");
  console.log(zeile("Huellkreis ueber den Weg (m)", m.map((x) => x.huellkreis.toFixed(4))));
  console.log(zeile("Spitzenweite offen (m)", m.map((x) => x.spitzenweiteOffen.toFixed(4))));
  console.log(zeile("Spitzenweite geschlossen (m)", m.map((x) => x.spitzenweiteZu.toFixed(4))));
  console.log(zeile("Breite geschlossen (m)", m.map((x) => x.breiteZu.toFixed(3))));
  console.log("");
  console.log(zeile("Bolzenebene (m)", m.map((x) => x.bolzenY.toFixed(4))));
  console.log(zeile("Bruttokorb (l)", m.map((x) => (x.bruttokorb * 1000).toFixed(0))));
  console.log(zeile("Nettokorb (l)", m.map((x) => (x.nettokorb * 1000).toFixed(0))));
  console.log(zeile("Muendung an der Bolzenebene (m²)", m.map((x) => x.muendung.toFixed(3))));
  console.log(zeile("  davon zugebaut (%)", m.map((x) => ((x.schatten / x.muendung) * 100).toFixed(1))));
  console.log(zeile("Aequator geschlossen (m)", m.map((x) => x.aequator.toFixed(3))));
  console.log(zeile("Aequator sitzt auf (m)", m.map((x) => x.aequatorY.toFixed(3))));
  console.log(
    zeile(
      "  davon zugebaut (%)",
      m.map((x) => ((x.schattenAequator / (Math.PI * (x.aequator / 2) ** 2)) * 100).toFixed(1))
    )
  );
  console.log("");
  console.log("Grabtiefe ueber den Oeffnungsweg (m), 0 = zu … 1 = offen:");
  for (const x of m) {
    console.log(`  ${x.name.padEnd(22)}${x.tiefenweg.map((t) => t.toFixed(3).padStart(8)).join("")}`);
  }
  console.log(`  ${"Stellung".padEnd(22)}${["0.0","0.1","0.2","0.3","0.4","0.5","0.6","0.7","0.8","0.9","1.0"].map((s) => s.padStart(8)).join("")}`);
  for (const x of m) {
    const zu = x.tiefenweg[0]!;
    const auf = x.tiefenweg[10]!;
    console.log(
      `  ${x.name}: offen ${auf.toFixed(3)} · zu ${zu.toFixed(3)} · tiefste Stellung ` +
        `${x.grabtiefe.toFixed(3)} · Hub beim Schliessen ${(x.grabtiefe - auf).toFixed(3)} m`
    );
  }
  console.log("");
  console.log(zeile("Werkstoffvolumen (m³)", m.map((x) => x.werkstoff.toFixed(4))));
  console.log(zeile(`Masse bei ${STAHL} kg/m³ (kg)`, m.map((x) => (x.werkstoff * STAHL).toFixed(0))));
  console.log("");
  console.log(zeile("Mittellinie tiefster Punkt (m)", m.map((x) => x.mittellinieTief.toFixed(4))));
  console.log(zeile("noetiger SENSOR_RADIUS (m)", m.map((x) => x.sensorRadius.toFixed(4))));
  console.log(zeile("Schalenluecke geschlossen (m)", m.map((x) => x.schalenluecke.toFixed(4))));
  console.log(zeile("Luecke bei Schliessgrad 0,60 (m)", m.map((x) => x.lueckeFensterAuf.toFixed(4))));
  console.log(zeile("Luecke bei Schliessgrad 0,98 (m)", m.map((x) => x.lueckeFensterZu.toFixed(4))));
  console.log(
    zeile("zwei Schalen noetig ab (m)", m.map((x) => (2 * x.schalenluecke).toFixed(3)))
  );
  console.log(zeile("Korbradius auf halber Hoehe (m)", m.map((x) => x.korbRadiusMitte.toFixed(4))));
  console.log("");
  korbprofil();
  reichweite(m[0]!.grabtiefe - m[1]!.grabtiefe);
  behaelter(m[0]!, m[1]!);
  console.log("");
  console.log("Gegenprobe gegen die Rechenmodelle:");
  console.log(`  CLAW_MAX_DEPTH          ${CLAW_MAX_DEPTH.toFixed(4)} m`);
  console.log(`  clawSpan(offen)         ${clawSpan(CLAW_OPEN_SPLAY).toFixed(4)} m`);
  console.log(`  CLAW_RING_R             ${CLAW_RING_R.toFixed(4)} m`);
  console.log(`  STEMPEL_AUGE.r          ${STEMPEL_AUGE.r.toFixed(4)} m  (ZU = ${ZU})`);
}

main();
