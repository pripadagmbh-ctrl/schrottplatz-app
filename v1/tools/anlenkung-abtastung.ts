/**
 * Abtastung der Zylinderanlenkung (E-007, 14.09.2026).
 *
 * Aufruf:  npx vite-node tools/anlenkung-abtastung.ts
 *
 * Warum als Werkzeug und nicht als Test: Der Test in `test/greifer.test.ts`
 * prueft, ob die EINGEBAUTEN Werte taugen. Hier steht, WOHER sie kommen —
 * welche Familien es ueberhaupt gibt und was die Nachbarn koennen. Wer an
 * Zapfen, Segmentzahl oder Oeffnungsweg dreht, muss hier neu suchen; die
 * Werte von gestern sind dann fast sicher tot. Genau das ist am 14.09.
 * passiert: Die Anlenkung vom Ring hielt am Zapfen keine einzige Bedingung
 * mehr.
 *
 * Die sechs Bedingungen:
 *
 *   1. Der Zylinder faehrt zum SCHLIESSEN aus — die starke Richtung.
 *   2. Hub ueber 0,15 m, sonst ist die Stange nicht zu sehen.
 *   3. Er bleibt laenger als sein Rohr.
 *   4. Er steht steil (unter 20 Grad), statt quer ueber dem Kopf zu liegen.
 *   5. Kein Totpunkt: Hebelarm nirgends unter 0,10 m.
 *   6. Er laeuft frei am Gussblock vorbei.
 *
 * Dazu zwei Schranken aus der Bauform, ohne die die Suche in die falsche
 * Richtung gewinnt: Der Anlenkbock darf nicht breiter werden als der alte
 * Ring (sonst steht wieder ein Schirm ueber dem Korb), und die Lasche muss
 * auf dem Ruecken des ersten Segments Platz haben.
 */
import {
  CLAW_CLOSED_SPLAY,
  CLAW_OPEN_SPLAY,
  CLAW_RING_R,
  CLAW_RING_Y,
} from "../src/excavator/clawGeometry";
import { LASCHE, MITTELSTUECK, ROHRLAENGE, ROHR_R, ZYLINDERKREIS, ZYLINDER_OBEN_Y } from "../src/grapple/form";

const ZU = CLAW_CLOSED_SPLAY;
const OFFEN = CLAW_OPEN_SPLAY;

/**
 * Wirksamer Radius des Gussblocks auf Hoehe `y`, am Azimut einer Kralle.
 *
 * Der Block ist ein Fuenfeck und um pi/5 gedreht, damit jede Anlenkung auf
 * einer FLAECHE sitzt und nicht auf einer Kante. Am Krallenazimut ist der
 * Abstand zur Achse deshalb nicht der Umkreis-, sondern der Inkreisradius.
 */
const FLACH = Math.cos(Math.PI / 5);
const BLOCK_OBEN = MITTELSTUECK.y + MITTELSTUECK.hoehe / 2;
const BLOCK_UNTEN = MITTELSTUECK.y - MITTELSTUECK.hoehe / 2;
function blockRadius(y: number): number {
  if (y > BLOCK_OBEN || y < BLOCK_UNTEN) return -1;
  const t = (BLOCK_OBEN - y) / (BLOCK_OBEN - BLOCK_UNTEN);
  return (MITTELSTUECK.oben + (MITTELSTUECK.unten - MITTELSTUECK.oben) * t) * FLACH;
}

/** Wo die Lasche steht — dieselbe Rechnung wie `laschePunkt` in `rig.ts`. */
function lasche(schwenk: number, ly: number, lz: number): { r: number; y: number } {
  const phi = -schwenk;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return { r: CLAW_RING_R + (ly * s + lz * c), y: CLAW_RING_Y + (ly * c - lz * s) };
}

interface Bilanz {
  hub: number;
  neigung: number;
  hebelMin: number;
  kuerzest: number;
  blockLuft: number;
  hebelZu: number;
  hebelOffen: number;
}

function bilanz(rA: number, yA: number, ly: number, lz: number): Bilanz {
  let neigung = 0;
  let hebelMin = Infinity;
  let kuerzest = Infinity;
  let blockLuft = Infinity;
  let hebelZu = 0;
  let hebelOffen = 0;
  for (let i = 0; i <= 40; i++) {
    const schwenk = ZU + (OFFEN - ZU) * (i / 40);
    const l = lasche(schwenk, ly, lz);
    const dr = l.r - rA;
    const dy = l.y - yA;
    const d = Math.hypot(dr, dy);
    neigung = Math.max(neigung, (Math.atan2(Math.abs(dr), Math.abs(dy)) * 180) / Math.PI);
    kuerzest = Math.min(kuerzest, d);
    const hebel = Math.abs(((CLAW_RING_R - rA) * dy - (CLAW_RING_Y - yA) * dr) / d);
    hebelMin = Math.min(hebelMin, hebel);
    if (i === 0) hebelZu = hebel;
    if (i === 40) hebelOffen = hebel;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const y = yA + dy * t;
      const br = blockRadius(y);
      if (br < 0) continue;
      blockLuft = Math.min(blockLuft, rA + dr * t - br - ROHR_R);
    }
  }
  const zu = lasche(ZU, ly, lz);
  const offen = lasche(OFFEN, ly, lz);
  return {
    hub: Math.hypot(zu.r - rA, zu.y - yA) - Math.hypot(offen.r - rA, offen.y - yA),
    neigung,
    hebelMin,
    kuerzest,
    blockLuft,
    hebelZu,
    hebelOffen,
  };
}

function zeile(rA: number, yA: number, ly: number, lz: number): string {
  const b = bilanz(rA, yA, ly, lz);
  const fehlt: string[] = [];
  if (!(b.hub > 0.15)) fehlt.push("Hub");
  if (!(b.neigung < 20)) fehlt.push("Neigung");
  if (!(b.hebelMin > 0.1)) fehlt.push("Totpunkt");
  if (!(b.kuerzest > ROHRLAENGE)) fehlt.push("Rohr");
  if (!(b.blockLuft > 0)) fehlt.push("Gussblock");
  if (!(b.hebelZu > b.hebelOffen)) fehlt.push("Richtung");
  return (
    `${rA.toFixed(2)}  ${yA.toFixed(2)}  ${ly.toFixed(2)}  ${lz.toFixed(2)}  ` +
    `${b.hub.toFixed(3)} ${b.neigung.toFixed(1).padStart(5)}  ${b.hebelMin.toFixed(3)}  ` +
    `${(b.hebelZu / b.hebelOffen).toFixed(2)}  ${b.kuerzest.toFixed(2)}  ` +
    `${b.blockLuft.toFixed(2)}  ${fehlt.length ? "FAELLT DURCH: " + fehlt.join(", ") : "alle gruen"}`
  );
}

const KOPF = "Kreis  Bock   Ly     Lz    Hub   Neig  Hebel  Fakt  kurz  Luft";

console.log(`Zapfen ${CLAW_RING_R} auf ${CLAW_RING_Y} · zu ${ZU} · offen ${OFFEN}`);
console.log("");
console.log("EINGEBAUT");
console.log(KOPF);
console.log(zeile(ZYLINDERKREIS, ZYLINDER_OBEN_Y, LASCHE.y, LASCHE.z));

console.log("");
console.log("VORGAENGER — dieselbe Anlenkung, als die Krallen noch am Ring 0,757 hingen");
console.log(KOPF);
console.log(zeile(0.84, -0.38, -0.04, 0.2));

const treffer: Array<{ rA: number; yA: number; ly: number; lz: number; b: Bilanz }> = [];
for (let rA = 0.5; rA <= 0.8001; rA += 0.01) {
  for (let yA = -0.8; yA <= -0.3001; yA += 0.01) {
    for (let ly = -0.26; ly <= 0.0001; ly += 0.01) {
      for (let lz = 0.1; lz <= 0.2601; lz += 0.01) {
        if (Math.hypot(ly, lz) > 0.3) continue;
        const b = bilanz(rA, yA, ly, lz);
        if (b.hub <= 0.22) continue;
        if (b.neigung >= 10) continue;
        if (b.hebelMin <= 0.17) continue;
        if (b.kuerzest <= 0.35) continue;
        if (b.blockLuft <= 0.03) continue;
        if (b.hebelZu / b.hebelOffen <= 1.3) continue;
        treffer.push({ rA, yA, ly, lz, b });
      }
    }
  }
}
console.log("");
console.log(`${treffer.length} Familien halten alle sechs Bedingungen mit Reserve.`);
console.log(KOPF);
treffer.sort((a, b) => b.b.hebelMin - a.b.hebelMin);
for (const t of treffer.slice(0, 10)) console.log(zeile(t.rA, t.yA, t.ly, t.lz));
