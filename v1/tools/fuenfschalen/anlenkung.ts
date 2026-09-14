/**
 * Gibt es eine Anlenkung, die BEIDE offenen Kennwerte aus E-009 erreicht?
 *
 * Offen sind seit dem 14.09.2026 zwei Zahlen (E-009, `test/fuenfschalen.test.ts`
 * Zeile „ACHTUNG, offene Frage"):
 *
 *   Zylinderneigung  38,90°  gegen Ziel < 20°
 *   Hebelarm         0,0924 m gegen Ziel > 0,10 m
 *
 * Beide folgen allein aus drei Punkten — `ZYLINDER_AUFNAHME` (oben an der
 * Traverse), `STEMPEL_AUGE` (der Bolzen) und `OBERE_ANBINDUNG` (das Auge an der
 * Schale). Schale, Korb, Sektor und das Schliessen auf der Achse hängen an
 * keinem davon: Der Bolzen bleibt, wo er ist, und was sich bewegt, ist nur der
 * Hebel, mit dem der Zylinder daran zieht.
 *
 * Das Werkzeug rastert diese Punkte ab und meldet, was den Vertrag hält:
 *
 *   fährt zum SCHLIESSEN aus, Hub mindestens 0,15 m
 *   kürzeste Länge über dem Rohr (0,42 m) plus 2 cm Reserve
 *   längste Länge höchstens 1,05 m — sonst ist es kein 0,70-m-Zylinder mehr
 *   Hebelarm über den ganzen Weg über dem Ziel, geschlossen über 0,20 m
 *   Neigung über den ganzen Weg unter dem Ziel
 *   Aufnahme nicht näher an der Achse als die Mittelsäule (r >= 0,25)
 *
 * Getrennt ausgewiesen wird, was die Lösung am BAUTEIL kostet: Eine Aufnahme
 * weiter aussen als r 0,35 passt nicht mehr auf die Ø-700-Mitteltraverse der
 * Positionsliste, ein Auge weiter als z 0,31 vom Bolzen sitzt nicht mehr auf
 * dem dicken Teil des Gusskörpers.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/anlenkung.ts
 */
import { OFFEN, STEMPEL_AUGE, ZU } from "../../src/fuenfschalen/teile";

const ROHR = 0.42; // MASS.zylinder.laenge * 0,6

interface Anlenkung {
  Zr: number;
  Zy: number;
  Ay: number;
  Az: number;
}

interface Kennwert {
  neigungMax: number;
  hebelMin: number;
  hebelZu: number;
  laengeZu: number;
  laengeOffen: number;
  laengeMin: number;
  laengeMax: number;
  hub: number;
}

function kennwerte(a: Anlenkung): Kennwert {
  let neigungMax = 0;
  let hebelMin = Infinity;
  let laengeMin = Infinity;
  let laengeMax = 0;
  let laengeZu = 0;
  let laengeOffen = 0;
  let hebelZu = 0;
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const s = ZU + ((OFFEN - ZU) * i) / N;
    const cs = Math.cos(s);
    const sn = Math.sin(s);
    /* Dieselbe Rechnung wie `anbindungspunkt` in rig.ts, mit cos(−s)/sin(−s). */
    const r = STEMPEL_AUGE.r + (a.Ay * -sn + a.Az * cs);
    const y = STEMPEL_AUGE.y + (a.Ay * cs - a.Az * -sn);
    const dr = r - a.Zr;
    const dy = y - a.Zy;
    const l = Math.hypot(dr, dy);
    laengeMin = Math.min(laengeMin, l);
    laengeMax = Math.max(laengeMax, l);
    neigungMax = Math.max(neigungMax, (Math.atan2(Math.abs(dr), Math.abs(dy)) * 180) / Math.PI);
    const hebel = Math.abs(
      ((STEMPEL_AUGE.r - a.Zr) * dy - (STEMPEL_AUGE.y - a.Zy) * dr) / Math.max(l, 1e-6)
    );
    hebelMin = Math.min(hebelMin, hebel);
    if (i === 0) {
      laengeZu = l;
      hebelZu = hebel;
    }
    if (i === N) laengeOffen = l;
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
  };
}

function haeltVertrag(k: Kennwert): boolean {
  return (
    k.hub >= 0.15 &&
    k.laengeMin >= ROHR + 0.02 &&
    k.laengeMax <= 1.05 &&
    k.hebelZu > 0.2
  );
}

const HEUTE: Anlenkung = { Zr: 0.34, Zy: -0.73, Ay: 0, Az: 0.31 };
const h = kennwerte(HEUTE);
console.log("Heutige Anlenkung");
console.log(
  `  Zr 0,340  Zy −0,730  Ay 0,000  Az 0,310   ` +
    `Neigung ${h.neigungMax.toFixed(2)}°  Hebel ${h.hebelMin.toFixed(4)}  ` +
    `Laenge ${h.laengeZu.toFixed(3)}/${h.laengeOffen.toFixed(3)}  Hub ${h.hub.toFixed(3)}`
);
console.log("");

/* ---------------------------------------------------------------- Suche */

const treffer: Array<{ a: Anlenkung; k: Kennwert }> = [];
for (let Zr = 0.25; Zr <= 0.75001; Zr += 0.01)
  for (let Zy = -0.95; Zy <= -0.55001; Zy += 0.01)
    for (let Ay = -0.16; Ay <= 0.16001; Ay += 0.02)
      for (let Az = 0.2; Az <= 0.5001; Az += 0.01) {
        const a = { Zr, Zy, Ay, Az };
        const k = kennwerte(a);
        if (!haeltVertrag(k)) continue;
        if (k.neigungMax >= 20 || k.hebelMin <= 0.1) continue;
        treffer.push({ a, k });
      }

console.log(`${treffer.length} Anlenkungen halten BEIDE Ziele und den Vertrag.`);
console.log("");

if (treffer.length > 0) {
  /* Die schonendsten zuerst: möglichst wenig Abstand zur heutigen Anlenkung. */
  const abstand = (a: Anlenkung): number =>
    Math.abs(a.Zr - HEUTE.Zr) + Math.abs(a.Zy - HEUTE.Zy) + Math.abs(a.Ay) + Math.abs(a.Az - HEUTE.Az);
  treffer.sort((x, y) => abstand(x.a) - abstand(y.a));
  console.log("Die zehn, die der heutigen am nächsten liegen:");
  console.log("   Zr     Zy      Ay     Az     Neigung  Hebel   Laenge zu/offen  Hub    Traverse Ø  Auge");
  for (const t of treffer.slice(0, 10)) {
    const passtTraverse = t.a.Zr <= 0.35 ? "  0,70 ok " : `  ${(2 * t.a.Zr + 0.02).toFixed(2)} !!`;
    const passtAuge = t.a.Az <= 0.31 && Math.abs(t.a.Ay) < 0.001 ? "  am Guss" : "  Konsole";
    console.log(
      `  ${t.a.Zr.toFixed(3)}  ${t.a.Zy.toFixed(3)}  ${t.a.Ay.toFixed(3)}  ${t.a.Az.toFixed(3)}  ` +
        `${t.k.neigungMax.toFixed(2).padStart(7)}  ${t.k.hebelMin.toFixed(4)}  ` +
        `${t.k.laengeZu.toFixed(3)}/${t.k.laengeOffen.toFixed(3)}    ${t.k.hub.toFixed(3)}` +
        passtTraverse +
        passtAuge
    );
  }
  console.log("");
  const ohneUmbau = treffer.filter((t) => t.a.Zr <= 0.35);
  const kleinstesZr = Math.min(...treffer.map((t) => t.a.Zr));
  console.log(
    ohneUmbau.length > 0
      ? `${ohneUmbau.length} davon kommen ohne grössere Mitteltraverse aus (Zr <= 0,35).`
      : "KEINE davon kommt ohne grössere Mitteltraverse aus."
  );
  console.log(
    `  Kleinster Aufnahmeradius über alle Lösungen: ${kleinstesZr.toFixed(3)} m ` +
      `— das ist eine Mitteltraverse von Ø ${(2 * kleinstesZr + 0.02).toFixed(2)} m ` +
      `statt der Ø 0,70 der Positionsliste.`
  );
}

/* ------------------------------------------- Was fehlt jeweils allein? */

console.log("");
console.log("Gegenprobe — was ist einzeln erreichbar (Vertrag gehalten)?");
let bestNeigung = { a: HEUTE, k: h };
let bestHebel = { a: HEUTE, k: h };
for (let Zr = 0.25; Zr <= 0.75001; Zr += 0.01)
  for (let Zy = -0.95; Zy <= -0.55001; Zy += 0.01)
    for (let Ay = -0.16; Ay <= 0.16001; Ay += 0.02)
      for (let Az = 0.2; Az <= 0.5001; Az += 0.01) {
        const a = { Zr, Zy, Ay, Az };
        const k = kennwerte(a);
        if (!haeltVertrag(k)) continue;
        if (a.Zr <= 0.35 && k.neigungMax < bestNeigung.k.neigungMax) bestNeigung = { a, k };
        if (a.Zr <= 0.35 && k.hebelMin > bestHebel.k.hebelMin) bestHebel = { a, k };
      }
console.log(
  `  kleinste Neigung mit Ø-0,70-Traverse: ${bestNeigung.k.neigungMax.toFixed(2)}° ` +
    `(Zr ${bestNeigung.a.Zr.toFixed(2)}, Zy ${bestNeigung.a.Zy.toFixed(2)}, ` +
    `Ay ${bestNeigung.a.Ay.toFixed(2)}, Az ${bestNeigung.a.Az.toFixed(2)}), ` +
    `Hebel dabei ${bestNeigung.k.hebelMin.toFixed(4)}`
);
console.log(
  `  grösster Hebel mit Ø-0,70-Traverse:   ${bestHebel.k.hebelMin.toFixed(4)} m ` +
    `(Zr ${bestHebel.a.Zr.toFixed(2)}, Zy ${bestHebel.a.Zy.toFixed(2)}, ` +
    `Ay ${bestHebel.a.Ay.toFixed(2)}, Az ${bestHebel.a.Az.toFixed(2)}), ` +
    `Neigung dabei ${bestHebel.k.neigungMax.toFixed(2)}°`
);
