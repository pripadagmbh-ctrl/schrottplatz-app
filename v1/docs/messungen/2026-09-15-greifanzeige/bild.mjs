/*
 * Zeichnet den unteren HUD-Block samt Nachbarn in den drei Fassungen.
 *
 * WICHTIG: Das sind KEINE Bildschirmfotos. Hier lief kein Browser. Die Kaesten
 * sind aus dem CSS von `v1/index.html` gerechnet — dieselbe Rechnung, die
 * `v1/test/greifanzeige.test.ts` bei jedem Testlauf prueft. Was das Bild NICHT
 * zeigt: wie die Schrift wirklich umbricht, und was hinter dem HUD zu sehen
 * ist. Dafuer braucht es Patricks Geraet.
 *
 * Aufruf aus v1/:  node docs/messungen/2026-09-15-greifanzeige/bild.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(hier, "../../..");
const seite = readFileSync(resolve(wurzel, "index.html"), "utf8");
const css = seite
  .slice(seite.indexOf("<style>"), seite.indexOf("</style>"))
  .replace(/\/\*[\s\S]*?\*\//g, "");

// --- kleine CSS-Kaskade (Zwilling zu test/greifanzeige.test.ts) -------------
function parse(quelle) {
  const out = [];
  let media = null;
  let n = 0;
  const re = /([^{}]+)\{|\}/g;
  for (let m = re.exec(quelle); m; m = re.exec(quelle)) {
    if (m[0] === "}") {
      media = null;
      continue;
    }
    const kopf = m[1].trim();
    if (kopf.startsWith("@media")) {
      media = kopf.slice(6).trim();
      continue;
    }
    const zu = quelle.indexOf("}", re.lastIndex);
    out.push({
      media,
      selektoren: kopf.split(",").map((s) => s.trim()),
      decls: quelle.slice(re.lastIndex, zu),
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
function wert(sels, prop, w, h) {
  let gefunden = null;
  regeln
    .filter((r) => mediaPasst(r.media, w, h) && r.selektoren.some((s) => sels.includes(s)))
    .map((r) => ({ r, g: Math.max(...r.selektoren.filter((s) => sels.includes(s)).map(gewicht)) }))
    .sort((a, b) => a.g - b.g || a.r.reihenfolge - b.r.reihenfolge)
    .forEach((t) => {
      const m = new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;]+)`).exec(t.r.decls);
      if (m) gefunden = m[1].trim();
    });
  return gefunden;
}
const px = (sels, prop, w, h) => Number(/^(\d+)px/.exec(wert(sels, prop, w, h))[1]);
function fassung(sels, w, h) {
  const z = [...wert(sels, "padding", w, h).matchAll(/(\d+)(?:px)?/g)].map((m) => Number(m[1]));
  return z.length > 1 ? [z[0], z[1]] : [z[0], z[0]];
}

// --- Schrift ----------------------------------------------------------------
const EM = 0.55; // Consolas: 1126/2048 em je Zeichen
function zeilen(text, breite, schrift) {
  const proZeile = Math.floor(breite / (schrift * EM));
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

// --- die laengsten Texte (identisch zum Waechter) ---------------------------
const KOPF_LADUNG =
  "Greifer: 1.5 t  ›  über KUPFER + MESSING: ✕ falsche Zone";
const LISTE_LADUNG =
  "Unfallfahrzeug (Front eingedrückt) (Mischschrott · 58 % Baumischabfall), Wohnwagen-Kühlschrank (Mischschrott), U-Bahn-Drehgestell (angetrieben) (Mischschrott), 1× Stahlschrott, 1× Edelstahl VA, +3 weitere";
const LADEZEILE = "Baumischabfall: 12.4 t · ██████████ 100 % sortenrein";

const FASSUNGEN = [
  { name: "iPad quer", datei: "ipad-quer", w: 1024, h: 768 },
  { name: "iPhone mini quer", datei: "iphone-mini-quer", w: 812, h: 375 },
  { name: "iPhone mini hoch", datei: "iphone-mini-hoch", w: 375, h: 812 },
];

function kaesten(f) {
  const { w, h } = f;
  const halterSel = ["#pedals"];
  const pedalSel = ["#touch .pedal"];
  const [pad] = fassung(halterSel, w, h);
  const pBreite = 2 * pad + 2 * px(pedalSel, "width", w, h) + px(halterSel, "gap", w, h);
  const pHoehe = 2 * pad + px(pedalSel, "height", w, h);
  const pLinks = px(halterSel, "left", w, h);
  const pUnten = px(halterSel, "bottom", w, h);

  const dreh = (id) => {
    const sel = ["#touch .btn", `#touch #${id}`];
    const b = px(sel, "width", w, h) + 4;
    const ho = px(sel, "height", w, h) + 4;
    const r = px(sel, "right", w, h);
    const u = px(sel, "bottom", w, h);
    return { name: id.replace("btn-rot-", "Dreh "), x0: w - r - b, x1: w - r, y0: u, y1: u + ho };
  };

  const hu = ["#hudunten", "body.touch #hudunten"];
  const links = px(hu, "left", w, h);
  const rechts = px(hu, "right", w, h);
  const unten = px(hu, "bottom", w, h);
  const luecke = px(hu, "gap", w, h);
  const breite = w - links - rechts;
  const grip = ["#gripinfo", "#hudunten .hud", ".hud"];
  const load = ["#load", "#hudunten .hud", ".hud"];
  const kasten = (sel, text, plusZeile) => {
    const schrift = px(sel, "font-size", w, h);
    const [padY, padX] = fassung(sel, w, h);
    const n = zeilen(text, breite - 2 * padX - 2, schrift) + (plusZeile ? 1 : 0);
    return { hoehe: n * Math.ceil(schrift * 1.35) + 2 * padY + 2, zeilen: n, schrift };
  };
  const g = kasten(grip, KOPF_LADUNG, true);
  const l = kasten(load, LADEZEILE, false);

  return {
    pedale: { name: "Pedale", x0: pLinks, x1: pLinks + pBreite, y0: pUnten, y1: pUnten + pHoehe },
    drehL: dreh("btn-rot-l"),
    drehR: dreh("btn-rot-r"),
    griff: { name: "Griff-Info", x0: links, x1: w - rechts, y0: unten, y1: unten + g.hoehe, info: g },
    ladung: {
      name: "Ladeanzeige",
      x0: links,
      x1: w - rechts,
      y0: unten + g.hoehe + luecke,
      y1: unten + g.hoehe + luecke + l.hoehe,
      info: l,
    },
  };
}

function svg(f) {
  const k = kaesten(f);
  const rand = 20;
  const teile = [
    `<rect x="0" y="0" width="${f.w}" height="${f.h}" fill="#2b3136"/>`,
    `<rect x="0" y="${f.h * 0.42}" width="${f.w}" height="${f.h * 0.58}" fill="#3a4147"/>`,
    `<text x="${f.w / 2}" y="${f.h * 0.3}" fill="#8b949b" font-family="Consolas,monospace" font-size="16" text-anchor="middle">Bild (Platz und Maschine) — hier nur Platzhalter</text>`,
  ];
  const male = (kst, farbe, beschriftung) => {
    const y = f.h - kst.y1;
    teile.push(
      `<rect x="${kst.x0}" y="${y}" width="${kst.x1 - kst.x0}" height="${kst.y1 - kst.y0}" fill="${farbe}" fill-opacity="0.75" stroke="#fff" stroke-opacity="0.45"/>`,
      `<text x="${kst.x0 + 6}" y="${y + 15}" fill="#fff" font-family="Consolas,monospace" font-size="11">${beschriftung}</text>`
    );
  };
  male(k.pedale, "#c8901f", `Pedale ${k.pedale.x1 - k.pedale.x0}x${k.pedale.y1 - k.pedale.y0}`);
  male(k.drehL, "#6b7f8c", "Dreh links");
  male(k.drehR, "#6b7f8c", "Dreh rechts");
  male(
    k.griff,
    "#1a1c1e",
    `Griff-Info ${k.griff.x1 - k.griff.x0}x${k.griff.y1 - k.griff.y0} (${k.griff.info.zeilen} Zeilen)`
  );
  male(
    k.ladung,
    "#1a1c1e",
    `Ladeanzeige ${k.ladung.x1 - k.ladung.x0}x${k.ladung.y1 - k.ladung.y0} (${k.ladung.info.zeilen} Zeilen)`
  );
  teile.push(
    `<text x="${rand}" y="${rand + 4}" fill="#f0d060" font-family="Consolas,monospace" font-size="14">${f.name} · ${f.w} x ${f.h} · laengstmoeglicher Text · GERECHNET, kein Bildschirmfoto</text>`
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}">${teile.join("")}</svg>`;
}

// --- dasselbe als PNG ------------------------------------------------------
/*
 * Ein SVG kann sich der Agent, der das hier gebaut hat, nicht ansehen — es
 * kommt bei ihm als Text an. Darum dieselben Kaesten noch einmal als echtes
 * Bild, mit einem Minimal-PNG-Schreiber (nur zlib aus Node, keine Bibliothek).
 * So laesst sich mit eigenen Augen pruefen, dass sich nichts ueberlappt.
 */
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
  ihdr[8] = 8; // 8 Bit je Kanal
  ihdr[9] = 2; // Truecolor RGB
  const roh = Buffer.alloc((breite * 3 + 1) * hoehe);
  for (let y = 0; y < hoehe; y++) {
    roh[y * (breite * 3 + 1)] = 0; // Filter "none"
    pixel.copy(roh, y * (breite * 3 + 1) + 1, y * breite * 3, (y + 1) * breite * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(roh)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function bild(f) {
  const k = kaesten(f);
  const p = Buffer.alloc(f.w * f.h * 3);
  const setz = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
    const i = (y * f.w + x) * 3;
    p[i] = r;
    p[i + 1] = g;
    p[i + 2] = b;
  };
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) setz(x, y, y > f.h * 0.42 ? [58, 65, 71] : [43, 49, 54]);
  const male = (kst, farbe) => {
    const yo = f.h - kst.y1;
    for (let y = yo; y < f.h - kst.y0; y++)
      for (let x = kst.x0; x < kst.x1; x++) {
        const rand = y < yo + 2 || y >= f.h - kst.y0 - 2 || x < kst.x0 + 2 || x >= kst.x1 - 2;
        setz(x, y, rand ? [255, 255, 255] : farbe);
      }
  };
  male(k.pedale, [200, 144, 31]); // gelb: Fahrpedale
  male(k.drehL, [107, 127, 140]); // blaugrau: Drehtasten
  male(k.drehR, [107, 127, 140]);
  male(k.griff, [26, 28, 30]); // schwarz: Griff-Info
  male(k.ladung, [70, 40, 40]); // dunkelrot: Ladeanzeige
  return png(f.w, f.h, p);
}

const zeilenAus = [];
for (const f of FASSUNGEN) {
  writeFileSync(resolve(hier, `${f.datei}.svg`), svg(f), "utf8");
  writeFileSync(resolve(hier, `${f.datei}.png`), bild(f));
  const k = kaesten(f);
  for (const kst of [k.pedale, k.drehL, k.drehR, k.griff, k.ladung]) {
    zeilenAus.push(
      `${f.name.padEnd(17)} ${kst.name.padEnd(12)} x ${String(kst.x0).padStart(4)}..${String(kst.x1).padStart(4)}  y(unten) ${String(kst.y0).padStart(4)}..${String(kst.y1).padStart(4)}  ${kst.x1 - kst.x0} x ${kst.y1 - kst.y0}`
    );
  }
  const frei = f.h - k.ladung.y1;
  zeilenAus.push(
    `${f.name.padEnd(17)} Block endet bei ${k.ladung.y1} px von ${f.h} px (${((k.ladung.y1 / f.h) * 100).toFixed(1)} % des Bildes), darueber frei: ${frei} px`
  );
  zeilenAus.push("");
}
console.log(zeilenAus.join("\n"));
