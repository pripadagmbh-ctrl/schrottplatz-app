import { writeFileSync } from "node:fs";
/**
 * Wo müsste der Drehpunkt eines echten Kabinen-Parallelogramms sitzen?
 *
 * Anlass (15.09.2026): E-025, Frage 3 hat Patrick mit „Parallelogramm, Lenker
 * 1,88 m, −28° … +66°" beantwortet. Beim Bauen stellte sich heraus, dass diese
 * drei Zahlen den Drehpunkt eindeutig festlegen — und zwar an zwei möglichen
 * Stellen, von denen die eine mitten durch die Kabine führt. Dieses Werkzeug
 * rechnet beide aus und sagt, was sie treffen.
 *
 * DIE RECHNUNG. Die Kabine soll von (y 0,50 | z −0,12) nach (y 3,10 | z 0,76)
 * fahren — das ist der heutige Weg: 2,60 m hoch, 0,884 m nach vorn (Vorlauf
 * 0,34 × Hub, `excavator.ts`). Beide Punkte liegen auf einem Kreis um den
 * Drehpunkt mit Radius L. Damit liegt der Drehpunkt auf der Mittelsenkrechten
 * der Sehne, im Abstand √(L² − (Sehne/2)²) von ihrer Mitte — zwei Lösungen,
 * eine auf jeder Seite.
 *
 * Aufruf:  npx vite-node tools/kabinenhub.ts
 */

/** Länge eines Lenkers (m) — aus E-025, Frage 3, von Patrick bestätigt. */
const L = 1.88;

/** Kabinenmitte (m) — `buildCabin` in `excavator.ts`. */
const CX = -1.05;
const CZ = 0.6;
/** Seitenversatz der beiden Lenker einer Ebene (m) — unverändert. */
const RX = 0.42;

/** Anlenkpunkt an der Kabine, unten (y | z im Oberwagen-Frame). */
const A0 = { y: 0.5, z: CZ - 0.72 };
/** Hub der Kabine (m) und Vorlauf je Meter Hub — unverändert. */
const HUB = 2.6;
const VORLAUF = 0.34;
/** Anlenkpunkt an der Kabine, oben. */
const A1 = { y: A0.y + HUB, z: A0.z + HUB * VORLAUF };

const sehneY = A1.y - A0.y;
const sehneZ = A1.z - A0.z;
const sehne = Math.hypot(sehneY, sehneZ);
const mitteY = (A0.y + A1.y) / 2;
const mitteZ = (A0.z + A1.z) / 2;
const h = Math.sqrt(L * L - (sehne / 2) ** 2);
// Einheitsvektor senkrecht zur Sehne
const ny = sehneZ / sehne;
const nz = -sehneY / sehne;

console.log("KABINENHUB — wo der Drehpunkt eines Parallelogramms liegen muss");
console.log("==============================================================");
console.log(`Lenkerlänge          ${L.toFixed(3)} m   (E-025, Frage 3)`);
console.log(`Weg der Kabine       ${sehneY.toFixed(3)} m hoch, ${sehneZ.toFixed(3)} m vor`);
console.log(`Sehne                ${sehne.toFixed(3)} m`);
console.log(
  `Schwenkwinkel        ${((2 * Math.asin(sehne / 2 / L) * 180) / Math.PI).toFixed(1)}°` +
    "   (E-025 nennt 94° = −28° … +66°)"
);
console.log("");

/** Die Motorhaube, wie sie `oberwagenParts.ts` baut (Oberwagen-Frame). */
const HAUBE = { xHalb: 1.25, zVorn: -0.15, zHinten: -1.85, oben: 1.355 };
/** Die Kabine, wie sie `kabinenParts.ts` baut, in unterster Stellung. */
const KABINE = {
  xVon: CX - 0.56,
  xBis: CX + 0.56,
  zVon: CZ - 0.71,
  zBis: CZ + 0.71,
  yVon: 0.4,
  yBis: 2.16,
};
/** Deckplatte des Oberwagens. */
const DECK = { xHalb: 1.45, zHalb: 1.6, oben: 0.355 };

for (const [nr, s] of [
  ["A  Drehpunkt HINTER der Kabine, Mast auf dem Oberwagen", 1],
  ["B  Drehpunkt VOR der Kabine (so, wie die Winkel im Konzept stehen)", -1],
] as const) {
  const py = mitteY + s * h * ny;
  const pz = mitteZ + s * h * nz;
  console.log(nr);
  console.log(`   Drehpunkt        y ${py.toFixed(3)} | z ${pz.toFixed(3)}  (Oberwagen-Frame)`);
  console.log(`   über Grund       y ${(py + 1.6).toFixed(3)} m`);
  console.log(`   über dem Deck    ${(py - DECK.oben).toFixed(3)} m Mast`);
  console.log(`   Lenker bei x     ${(CX - RX).toFixed(2)} und ${(CX + RX).toFixed(2)}`);

  // Läuft der Lenker in irgendeiner Stellung durch die Kabine?
  let durchKabine = 0;
  const a0 = Math.atan2(A0.y - py, A0.z - pz);
  const a1 = Math.atan2(A1.y - py, A1.z - pz);
  for (let i = 0; i <= 40; i++) {
    const w = a0 + ((a1 - a0) * i) / 40;
    for (let t = 0; t <= 20; t++) {
      const y = py + Math.sin(w) * L * (t / 20);
      const z = pz + Math.cos(w) * L * (t / 20);
      // Die Kabine steht bei dieser Lenkerstellung um (dy | dz) versetzt
      const dy = py + Math.sin(w) * L - A0.y;
      const dz = pz + Math.cos(w) * L - A0.z;
      if (
        y > KABINE.yVon + dy &&
        y < KABINE.yBis + dy &&
        z > KABINE.zVon + dz &&
        z < KABINE.zBis + dz
      ) {
        durchKabine++;
      }
    }
  }
  console.log(
    `   durch die Kabine  ${durchKabine > 0 ? "JA — " + durchKabine + " von 861 Abtastpunkten" : "nein"}`
  );

  // Steht der Mast in der Motorhaube?
  const inHaube =
    pz < HAUBE.zVorn && pz > HAUBE.zHinten && Math.abs(CX + RX) < HAUBE.xHalb ? "JA" : "nein";
  console.log(`   Mast in der Haube ${inHaube}` + (inHaube === "JA" ? `  (innerer Fuß bei x ${(CX + RX).toFixed(2)})` : ""));
  // Steht ein Mastfuß über der Deckkante?
  const ueberDeck = Math.abs(CX - RX) > DECK.xHalb || Math.abs(pz) > DECK.zHalb;
  console.log(`   Fuß über der Kante ${ueberDeck ? "JA" : "nein"}`);
  console.log("");
}

console.log("Zum Vergleich — was HEUTE passiert (E-025, Befund 2):");
console.log("  Die beiden Lenker werden gedehnt: Ankerabstand 0,647 → 2,75 m,");
console.log("  Verhältnis 4,25 : 1. Die Kabinenhubzylinder verlangen 5,18 : 1");
console.log("  (0,650 → 3,368 m); ihr 1,10-m-Rohr steht in der untersten");
console.log("  Stellung durch den Kabinenboden.");

/* ------------------------------------------------- Ein Riss zum Entscheiden */

/*
 * E-016: erst zeichnen, dann bauen. Zahlen allein reichen bei einer
 * Gestaltungsfrage nicht — Patrick entscheidet am Bild.
 *
 * Gezeichnet wird die Maschine von der Seite (z nach rechts, y nach oben),
 * mit Deck, Motorhaube, Kabine unten und oben und beiden Lenkerlagen.
 */
const B = 1180;
const H = 640;
const S = 150; // Pixel je Meter
const OX = 590; // z = 0
const OY = 560; // y = 0 (Oberwagen-Frame)
const px = (z: number): number => OX + z * S;
const py2 = (y: number): number => OY - y * S;

function kasten(z0: number, y0: number, z1: number, y1: number, f: string, o = 1): string {
  const x = px(Math.min(z0, z1)).toFixed(1);
  const y = py2(Math.max(y0, y1)).toFixed(1);
  const w = (Math.abs(z1 - z0) * S).toFixed(1);
  const hh = (Math.abs(y1 - y0) * S).toFixed(1);
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${hh}" ` +
    `fill="${f}" fill-opacity="${o}" stroke="#333" stroke-width="1"/>`
  );
}

function linie(z0: number, y0: number, z1: number, y1: number, f: string, w = 3): string {
  return (
    `<line x1="${px(z0).toFixed(1)}" y1="${py2(y0).toFixed(1)}" ` +
    `x2="${px(z1).toFixed(1)}" y2="${py2(y1).toFixed(1)}" stroke="${f}" stroke-width="${w}"/>`
  );
}
function punkt(z: number, y: number, f: string): string {
  return `<circle cx="${px(z).toFixed(1)}" cy="${py2(y).toFixed(1)}" r="6" fill="${f}"/>`;
}
function text(z: number, y: number, t: string, f = "#1b2026", gr = 13): string {
  return (
    `<text x="${px(z).toFixed(1)}" y="${py2(y).toFixed(1)}" font-family="Segoe UI,Arial" ` +
    `font-size="${gr}" fill="${f}">${t}</text>`
  );
}

let bild = "";
// Deck und Haube
bild += kasten(-DECK.zHalb, DECK.oben - 0.135, DECK.zHalb, DECK.oben, "#3a3f44");
bild += kasten(HAUBE.zHinten, DECK.oben, HAUBE.zVorn, 1.075, "#5bbf46");
bild += kasten(HAUBE.zHinten + 0.15, 1.075, HAUBE.zVorn - 0.15, HAUBE.oben, "#5bbf46");
// Kabine unten und oben
for (const [dy, dz, o] of [
  [0, 0, 1],
  [HUB, HUB * VORLAUF, 0.35],
] as const) {
  bild += kasten(KABINE.zVon + dz, KABINE.yVon + dy, KABINE.zBis + dz, KABINE.yBis + dy, "#9fc4d8", o);
}
// Die beiden Drehpunkte samt Lenkern
const farben = ["#c0392b", "#1f6fb2"];
for (const [i, s] of [1, -1].entries()) {
  const pyP = mitteY + s * h * ny;
  const pzP = mitteZ + s * h * nz;
  const f = farben[i]!;
  bild += punkt(pzP, pyP, f);
  bild += linie(pzP, pyP, A0.z, A0.y, f);
  bild += linie(pzP, pyP, A1.z, A1.y, f, 2);
  bild += linie(pzP, DECK.oben, pzP, pyP, f, 2);
  bild += text(pzP + 0.06, pyP + 0.08, i === 0 ? "A hinten" : "B vorn", f, 15);
}
bild += punkt(A0.z, A0.y, "#222");
bild += punkt(A1.z, A1.y, "#222");
bild += text(A0.z + 0.05, A0.y - 0.2, "Anlenkung unten");
bild += text(A1.z + 0.05, A1.y + 0.1, "Anlenkung oben");

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${B}" height="${H}" viewBox="0 0 ${B} ${H}">` +
  `<rect width="${B}" height="${H}" fill="#eef0f3"/>` +
  `<text x="24" y="34" font-family="Segoe UI,Arial" font-size="20" font-weight="700" fill="#1b2026">` +
  `KABINENHUB als Parallelogramm — wo der Drehpunkt liegen muss</text>` +
  `<text x="24" y="56" font-family="Segoe UI,Arial" font-size="13" fill="#5b626b">` +
  `Lenker 1,88 m, Schwenk 93,8° (E-025 Frage 3). Seitenriss, +z nach rechts. ` +
  `A: Mast 1,86 m auf dem Oberwagen, innerer Fuß in der Haube. ` +
  `B: Lenker laufen durch die Kabine.</text>` +
  bild +
  "</svg>";
writeFileSync("docs/messungen/2026-09-15-bagger/07-kabinenhub.svg", svg);
console.log("");
console.log("geschrieben: docs/messungen/2026-09-15-bagger/07-kabinenhub.svg");
