/*
 * Vermisst und zeichnet ALLE HUD-Kaesten in den drei Fassungen — mit sicheren
 * Raendern (Notch, Home-Indicator).
 *
 * WICHTIG: Das sind KEINE Bildschirmfotos. Hier lief kein Browser. Die Kaesten
 * sind aus dem CSS von `v1/index.html` gerechnet, mit Rahmen und Fassung, und
 * env(safe-area-inset-*) wird je Fassung mit den Werten des echten Geraets
 * ersetzt. Dieselbe Rechnung laeuft in `v1/test/greifanzeige.test.ts` und
 * `v1/test/hudplatz.test.ts`. Was das Bild NICHT zeigt: wie die Schrift
 * wirklich umbricht, und was hinter dem HUD zu sehen ist. Das entscheidet das
 * Geraet.
 *
 * Aufruf aus v1/:
 *   node docs/messungen/2026-09-15-hud/mass.mjs              (aktueller Stand)
 *   node docs/messungen/2026-09-15-hud/mass.mjs <datei> vorher
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(hier, "../../..");
const quelle = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(wurzel, "index.html");
const marke = process.argv[3] ?? "nachher";
const seite = readFileSync(quelle, "utf8");
const css = seite
  .slice(seite.indexOf("<style>"), seite.indexOf("</style>"))
  .replace(/\/\*[\s\S]*?\*\//g, "");

// --- kleine CSS-Kaskade -----------------------------------------------------
function parse(q) {
  const out = [];
  let media = null;
  let n = 0;
  const re = /([^{}]+)\{|\}/g;
  for (let m = re.exec(q); m; m = re.exec(q)) {
    if (m[0] === "}") {
      media = null;
      continue;
    }
    const kopf = m[1].trim();
    if (kopf.startsWith("@media")) {
      media = kopf.slice(6).trim();
      continue;
    }
    const zu = q.indexOf("}", re.lastIndex);
    out.push({
      media,
      selektoren: kopf.split(",").map((s) => s.trim()),
      decls: q.slice(re.lastIndex, zu),
      reihenfolge: n++,
    });
    re.lastIndex = zu + 1;
  }
  return out;
}
const regeln = parse(css);
const mediaPasst = (media, w, h) =>
  !media ||
  media.split(" and ").every((teil) => {
    const m = /\((max|min)-(width|height):\s*(\d+)px\)/.exec(teil);
    const ist = m[2] === "width" ? w : h;
    return m[1] === "max" ? ist <= Number(m[3]) : ist >= Number(m[3]);
  });
const gewicht = (sel) =>
  (sel.match(/#/g) ?? []).length * 100 + (sel.match(/\.[a-zA-Z]/g) ?? []).length * 10;
function roh(sels, prop, f) {
  let gefunden = null;
  regeln
    .filter((r) => mediaPasst(r.media, f.w, f.h) && r.selektoren.some((s) => sels.includes(s)))
    .map((r) => ({ r, g: Math.max(...r.selektoren.filter((s) => sels.includes(s)).map(gewicht)) }))
    .sort((a, b) => a.g - b.g || a.r.reihenfolge - b.r.reihenfolge)
    .forEach((t) => {
      const m = new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;]+)`).exec(t.r.decls);
      if (m) gefunden = m[1].trim();
    });
  return gefunden;
}

/** Kommas auf oberster Klammerebene. */
function teile(s) {
  const out = [];
  let tiefe = 0;
  let akt = "";
  for (const c of s) {
    if (c === "(") tiefe++;
    if (c === ")") tiefe--;
    if (c === "," && tiefe === 0) {
      out.push(akt);
      akt = "";
    } else akt += c;
  }
  out.push(akt);
  return out;
}

/** px-Wert mit aufgeloesten sicheren Raendern. */
function loese(v, sa) {
  if (v == null) return null;
  const s = v.trim();
  if (s === "auto") return null;
  if (s.startsWith("max(")) return Math.max(...teile(s.slice(4, s.lastIndexOf(")"))).map((t) => loese(t, sa)));
  if (s.startsWith("calc("))
    return s
      .slice(5, s.lastIndexOf(")"))
      .split("+")
      .reduce((a, t) => a + loese(t, sa), 0);
  const mv = /^var\(--sa-([lrtb])\)$/.exec(s);
  if (mv) return sa[mv[1]];
  const mp = /^(-?\d+(?:\.\d+)?)px$/.exec(s);
  if (mp) return Number(mp[1]);
  if (s === "0") return 0;
  throw new Error(`unbekannter Wert: ${v}`);
}
const px = (sels, prop, f) => loese(roh(sels, prop, f), f.sa);
function fassungInnen(sels, f) {
  const v = roh(sels, "padding", f);
  const z = [...v.matchAll(/(\d+)(?:px)?/g)].map((m) => Number(m[1]));
  return z.length > 1 ? [z[0], z[1]] : [z[0], z[0]];
}
function zeilenhoehe(sels, f) {
  const lh = roh(sels, "line-height", f) ?? roh(sels, "font", f)?.match(/\/([\d.]+)/)?.[1] ?? "1.5";
  return Number(String(lh).replace(/[^\d.]/g, ""));
}

// --- Schrift ----------------------------------------------------------------
const EM = 0.55; // Consolas: 1126/2048 em je Zeichen
function zeilen(text, breite, schrift) {
  const proZeile = Math.floor(breite / (schrift * EM));
  if (proZeile <= 0) return 99;
  let n = 1;
  let voll = 0;
  for (const wort of text.split(" ")) {
    if (voll === 0) voll = wort.length;
    else if (voll + 1 + wort.length <= proZeile) voll += 1 + wort.length;
    else {
      n++;
      voll = wort.length;
    }
    while (voll > proZeile) {
      n++;
      voll -= proZeile;
    }
  }
  return n;
}

// --- die laengsten Texte, aus dem Spiel geholt (siehe test/greifanzeige) ----
const ZIEL_KOPF = "▼ Unfallfahrzeug (Front eingedrückt) (Mischschrott · 58 % Baumischabfall) · 1.2 t · 160 €/t €";
const LADUNG_KOPF = "Greifer: 1.5 t  ›  über MISCHSCHROTT: ✕ falsche Zone";
const LADUNG_LISTE =
  "Unfallfahrzeug (Front eingedrückt) (Mischschrott · 58 % Baumischabfall), Wohnwagen-Kühlschrank (Absorber) (Mischschrott), U-Bahn-Drehgestell (angetrieben) (Mischschrott), 1× Stahlschrott, 1× Edelstahl VA, +3 weitere";
const LADEZEILE = "Baumischabfall: 12.4 t · ██████████ 100 % sortenrein";
/** Der Alltag: ein normales Teil anvisiert, kein Abholer da. */
const ALLTAG_KOPF = "▼ Kühlschrank (Mischschrott) · 84 kg · 160 €/t €";
const KONTO = "Konto: 1250 € · Haufen ≈ 3480 €";
const SCHICHT = "Sortieren — 12:40 (Abholer wartet)";

/*
 * Sichere Raender je Geraet, in CSS-Pixeln.
 *  - iPad: env() liefert null. Deshalb muss die Fassung dort Pixel fuer Pixel
 *    dieselbe bleiben wie vorher.
 *  - iPhone 13 mini quer: Safari meldet den Rand symmetrisch auf BEIDEN Seiten,
 *    damit sich beim Drehen nichts verschiebt. 50 px ist der ungünstigste Wert.
 *  - iPhone 13 mini hoch: 50 px Statusleiste/Notch oben, 34 px Home-Indicator.
 */
const FASSUNGEN = [
  { name: "iPad quer", datei: "ipad-quer", w: 1024, h: 768, sa: { l: 0, r: 0, t: 0, b: 0 } },
  { name: "iPhone mini quer", datei: "iphone-mini-quer", w: 812, h: 375, sa: { l: 50, r: 50, t: 0, b: 21 } },
  { name: "iPhone mini hoch", datei: "iphone-mini-hoch", w: 375, h: 812, sa: { l: 0, r: 0, t: 50, b: 34 } },
];

const RAHMEN = 1; // .hud: 1px Rand

function textKasten(sels, f, breite, texte) {
  const schrift = px(sels, "font-size", f);
  const [padY, padX] = fassungInnen(sels, f);
  const lh = zeilenhoehe(sels, f);
  const innen = breite - 2 * padX - 2 * RAHMEN;
  const n = texte.reduce((a, t) => a + (t.eine ? 1 : zeilen(t.text, innen, schrift)), 0);
  return { hoehe: n * Math.ceil(schrift * lh) + 2 * padY + 2 * RAHMEN, zeilen: n, schrift };
}

function kaesten(f, fall) {
  const { w, h } = f;

  // Pedale
  const pHalter = ["#pedals"];
  const pedal = ["#touch .pedal"];
  const [pad] = fassungInnen(pHalter, f);
  const pB = 2 * pad + 2 * px(pedal, "width", f) + px(pHalter, "gap", f);
  const pH = 2 * pad + px(pedal, "height", f);
  const pL = px(pHalter, "left", f);
  const pU = px(pHalter, "bottom", f);

  const dreh = (id) => {
    const sel = ["#touch .btn", `#touch #${id}`];
    const b = px(sel, "width", f) + 4;
    const ho = px(sel, "height", f) + 4;
    const r = px(sel, "right", f);
    const u = px(sel, "bottom", f);
    return { name: id.replace("btn-rot-", "Dreh "), x0: w - r - b, x1: w - r, y0: u, y1: u + ho };
  };
  const menue = (() => {
    const sel = ["#touch .btn", "#btn-menu"];
    const b = px(sel, "width", f) + 4;
    const ho = px(sel, "height", f) + 4;
    const r = px(sel, "right", f);
    const t = px(sel, "top", f);
    return { name: "Menue", x0: w - r - b, x1: w - r, y0: h - t - ho, y1: h - t };
  })();

  // Unterer Stapel
  const hu = ["#hudunten", "body.touch #hudunten"];
  const links = px(hu, "left", f);
  const rechts = px(hu, "right", f);
  const unten = px(hu, "bottom", f);
  const luecke = px(hu, "gap", f);
  const breite = w - links - rechts;
  const grip = ["#gripinfo", "#hudunten .hud", ".hud"];
  const load = ["#load", "#hudunten .hud", ".hud"];

  const g =
    fall === "ruhe"
      ? { hoehe: 0, zeilen: 0 }
      : fall === "alltag"
        ? textKasten(grip, f, breite, [{ text: ALLTAG_KOPF }])
        : fall === "ziel"
          ? textKasten(grip, f, breite, [{ text: ZIEL_KOPF }])
          : textKasten(grip, f, breite, [{ text: LADUNG_KOPF }, { text: LADUNG_LISTE, eine: true }]);
  const l =
    fall === "ruhe" || fall === "alltag"
      ? { hoehe: 0, zeilen: 0 }
      : textKasten(load, f, breite, [{ text: LADEZEILE }]);
  const stapel = g.hoehe + l.hoehe + (g.hoehe && l.hoehe ? luecke : 0);

  // Oberer Stapel
  const ho = ["#hudoben", "body.touch #hudoben"];
  const oTop = px(ho, "top", f);
  const oRechts = px(ho, "right", f);
  const oLinks = px(ho, "left", f);
  const oLuecke = px(ho, "gap", f);
  const money = ["#money", "#hudoben .hud", ".hud"];
  const shift = ["#shift", "#hudoben .hud", ".hud"];
  /* Der Halter hat nur EINEN waagerechten Anker (links ODER rechts). Ein so
     gesetzter fixierter Kasten ist "shrink to fit": so breit wie noetig,
     hoechstens bis zur gegenueberliegenden Bildkante. */
  const oBreite = w - (oLinks ?? 0) - (oRechts ?? 0);
  const mK = textKasten(money, f, oBreite, [{ text: KONTO }]);
  const sK = textKasten(shift, f, oBreite, [{ text: SCHICHT }]);
  const mBreite =
    KONTO.length * px(money, "font-size", f) * EM + 2 * fassungInnen(money, f)[1] + 2 * RAHMEN;
  const sBreite =
    SCHICHT.length * px(shift, "font-size", f) * EM + 2 * fassungInnen(shift, f)[1] + 2 * RAHMEN;
  const obenX = (b) => (oRechts === null ? [oLinks, oLinks + b] : [w - oRechts - b, w - oRechts]);
  const [mx0, mx1] = obenX(mBreite);
  const [sx0, sx1] = obenX(sBreite);

  return {
    pedale: { name: "Pedale", x0: pL, x1: pL + pB, y0: pU, y1: pU + pH },
    drehL: dreh("btn-rot-l"),
    drehR: dreh("btn-rot-r"),
    menue,
    griff: { name: "Griff-Info", x0: links, x1: w - rechts, y0: unten + l.hoehe + (g.hoehe && l.hoehe ? luecke : 0), y1: unten + stapel, info: g },
    ladung: { name: "Ladeanzeige", x0: links, x1: w - rechts, y0: unten, y1: unten + l.hoehe, info: l },
    stapelOben: unten + stapel,
    konto: { name: "Konto", x0: mx0, x1: mx1, y0: h - oTop - mK.hoehe, y1: h - oTop, info: mK },
    schicht: {
      name: "Tagesablauf",
      x0: sx0,
      x1: sx1,
      y0: h - oTop - mK.hoehe - oLuecke - sK.hoehe,
      y1: h - oTop - mK.hoehe - oLuecke,
      info: sK,
    },
  };
}

const ueberlappt = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// --- PNG (nur zlib aus Node) -----------------------------------------------
function png(breite, hoehe, pixel) {
  const crcTab = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTab[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTab[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (typ, daten) => {
    const laenge = Buffer.alloc(4);
    laenge.writeUInt32BE(daten.length);
    const koerper = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
    const pruef = Buffer.alloc(4);
    pruef.writeUInt32BE(crc(koerper));
    return Buffer.concat([laenge, koerper, pruef]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rohD = Buffer.alloc((breite * 3 + 1) * hoehe);
  for (let y = 0; y < hoehe; y++) {
    rohD[y * (breite * 3 + 1)] = 0;
    pixel.copy(rohD, y * (breite * 3 + 1) + 1, y * breite * 3, (y + 1) * breite * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rohD)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function bild(f, fall) {
  const k = kaesten(f, fall);
  const p = Buffer.alloc(f.w * f.h * 3);
  const setz = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
    const i = (y * f.w + x) * 3;
    p[i] = c[0];
    p[i + 1] = c[1];
    p[i + 2] = c[2];
  };
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) setz(x, y, y > f.h * 0.42 ? [58, 65, 71] : [43, 49, 54]);
  // sichere Raender als helle Zone
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++)
      if (x < f.sa.l || x >= f.w - f.sa.r || y < f.sa.t || y >= f.h - f.sa.b) setz(x, y, [92, 60, 60]);
  const male = (kst, farbe) => {
    if (!kst || kst.y1 - kst.y0 <= 0) return;
    const yo = f.h - kst.y1;
    for (let y = yo; y < f.h - kst.y0; y++)
      for (let x = kst.x0; x < kst.x1; x++) {
        const rand = y < yo + 2 || y >= f.h - kst.y0 - 2 || x < kst.x0 + 2 || x >= kst.x1 - 2;
        setz(x, y, rand ? [255, 255, 255] : farbe);
      }
  };
  male(k.pedale, [200, 144, 31]);
  male(k.drehL, [107, 127, 140]);
  male(k.drehR, [107, 127, 140]);
  male(k.menue, [107, 127, 140]);
  male(k.griff, [26, 28, 30]);
  male(k.ladung, [70, 40, 40]);
  male(k.konto, [40, 60, 30]);
  male(k.schicht, [40, 60, 30]);
  return png(f.w, f.h, p);
}

const aus = [];
for (const f of FASSUNGEN) {
  for (const fall of ["ruhe", "alltag", "ziel", "voll"]) {
    const k = kaesten(f, fall);
    if (fall === "voll" || fall === "ruhe")
      writeFileSync(resolve(hier, `${marke}-${f.datei}-${fall}.png`), bild(f, fall));
    // Ein leerer Halter zeichnet nichts — dann ist 0 die ehrliche Zahl.
    if (k.griff.info.zeilen === 0 && k.ladung.info.zeilen === 0) k.stapelOben = 0;
    const anteil = ((k.stapelOben / f.h) * 100).toFixed(1);
    aus.push(
      `${f.name.padEnd(17)} ${fall.padEnd(7)} unterer Stapel endet bei ${String(k.stapelOben).padStart(4)} px von ${f.h} (${anteil} %)  [Griff ${k.griff.info.zeilen} Z / ${k.griff.y1 - k.griff.y0} px, Ladung ${k.ladung.info.zeilen} Z / ${k.ladung.y1 - k.ladung.y0} px]`
    );
  }
  const k = kaesten(f, "voll");
  for (const kst of [k.pedale, k.drehL, k.drehR, k.menue, k.griff, k.ladung, k.konto, k.schicht])
    aus.push(
      `${" ".repeat(17)} ${kst.name.padEnd(12)} x ${String(Math.round(kst.x0)).padStart(4)}..${String(Math.round(kst.x1)).padStart(4)}  y(unten) ${String(Math.round(kst.y0)).padStart(4)}..${String(Math.round(kst.y1)).padStart(4)}`
    );
  const paare = [
    ["Griff", k.griff],
    ["Ladung", k.ladung],
  ];
  for (const [n1, a] of paare)
    for (const [n2, b] of [
      ["Pedale", k.pedale],
      ["DrehL", k.drehL],
      ["DrehR", k.drehR],
    ])
      if (ueberlappt(a, b)) aus.push(`${" ".repeat(17)} !! ${n1} ueberlappt ${n2}`);
  if (ueberlappt(k.konto, k.menue)) aus.push(`${" ".repeat(17)} !! Konto ueberlappt Menueknopf`);
  if (ueberlappt(k.konto, k.schicht)) aus.push(`${" ".repeat(17)} !! Konto ueberlappt Tagesablauf`);
  // innerhalb der sicheren Raender?
  for (const kst of [k.pedale, k.drehL, k.drehR, k.menue, k.griff, k.ladung, k.konto, k.schicht]) {
    if (kst.y1 - kst.y0 <= 0) continue;
    if (kst.x0 < f.sa.l || kst.x1 > f.w - f.sa.r || kst.y0 < f.sa.b || kst.y1 > f.h - f.sa.t)
      aus.push(`${" ".repeat(17)} !! ${kst.name} ragt in den sicheren Rand`);
  }
  aus.push("");
}
console.log(`--- ${marke} (${quelle}) ---`);
console.log(aus.join("\n"));
