/*
 * SCHILDER ist aus dem Funktionskranz ins Pausenmenue gezogen (E-093).
 * Dieses Skript zeichnet beides nach, in beiden Fassungen:
 *   - den Kranz mit jetzt ACHT Eintraegen
 *   - das Pausenfeld mit dem neuen Knopf „Zonenmarkierungen an/aus"
 *
 * WICHTIG: Das sind KEINE Bildschirmfotos. Hier lief kein Browser. Alle
 * Kaesten sind aus `v1/index.html` und `v1/src/core/touch.ts` gerechnet —
 * dieselbe Rechnung, die `v1/test/funktionskranz.test.ts` und
 * `v1/test/menue-markierungen.test.ts` bei jedem Testlauf pruefen. Was das
 * Bild NICHT zeigt: wie Safari die Schrift wirklich setzt und wie sich das
 * Ziehen anfuehlt. Dafuer braucht es Patricks Geraet.
 *
 * PNG-Schreiber und Grundgeruest uebernommen aus
 * docs/messungen/2026-09-16-funktionskranz/bild.mjs (E-088).
 *
 * Aufruf aus v1/:  node docs/messungen/2026-09-17-schilder-ins-menue/bild.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(hier, "../../..");
const seite = readFileSync(resolve(wurzel, "index.html"), "utf8");
const touchTs = readFileSync(resolve(wurzel, "src/core/touch.ts"), "utf8");

const R = Number(/const RADIAL_R = (\d+);/.exec(touchTs)[1]);
const SKALA = Number(/#radial \.sektor\.sel \{[\s\S]*?scale\(([\d.]+)\)/.exec(seite)[1]);

/** Beschriftungen des Kranzes, in der Reihenfolge der Seite. */
const vonK = seite.indexOf('<div class="hidden-actions">');
const bisK = seite.indexOf('<div class="hidden-actions" id="menu-actions">');
const KRANZ = [...seite.slice(vonK, bisK).matchAll(/<span id="([\w-]+)">([^<]+)<\/span>/g)].map(
  (m) => ({ id: m[1], text: m[2] })
);

/** Die Knoepfe des Pausenfelds, in der Reihenfolge der Seite. */
const vonP = seite.indexOf('<div id="pause">');
const bisP = seite.indexOf('<div id="controls-menu">');
const KNOEPFE = [...seite.slice(vonP, bisP).matchAll(/<button id="(pause-[\w-]+)">([^<]+)<\/button>/g)]
  .map((m) => ({ id: m[1], text: m[2].trim() }));

/** Sektormass aus dem CSS: der erste Block gilt, der in der Medienabfrage ist kleiner. */
function sektorMass(klein) {
  const alle = [...seite.matchAll(/#radial \.sektor \{([^}]*)\}/g)].map((m) => m[1]);
  const block = klein ? alle[alle.length - 1] : alle[0];
  const zahl = (prop) => Number(new RegExp(`${prop}:\\s*(\\d+)px`).exec(block)[1]);
  const schrift = klein ? zahl("font-size") : Number(/font:\s*600\s*(\d+)px/.exec(block)[1]);
  return { w: zahl("width"), h: zahl("height"), schrift };
}

const FASSUNGEN = [
  // sa = sichere Raender, wie Safari sie bei viewport-fit=cover meldet
  { name: "iPad quer", w: 1024, h: 768, klein: false, datei: "ipad-quer", sa: { l: 0, r: 0, t: 0, b: 0 } },
  { name: "iPhone mini quer", w: 812, h: 375, klein: true, datei: "iphone-mini-quer", sa: { l: 50, r: 50, t: 0, b: 21 } },
];

/*
 * Mass des Pausenfelds, aus `index.html` abgelesen. Die Zahlen stehen hier
 * doppelt — im CSS und hier — und das ist bewusst: Das CSS ist die Wahrheit,
 * dieses Skript zeichnet nur nach. Driftet eines, faellt es im Bild auf.
 *
 * Consolas ist eine Festbreitenschrift: 0,55 em je Zeichen (siehe
 * test/cssmass.ts, EM_BREITE). Zeilenhoehe bei `normal` rund 1,2 em.
 */
const EM = 0.55;
const FELD = {
  // #pause .panel                       Basis           @media (max-height:430px)
  padY: (klein) => (klein ? 12 : 24),
  padX: (klein) => (klein ? 16 : 28),
  gapY: (klein) => (klein ? 6 : 0),
  gapX: (klein) => (klein ? 10 : 0),
  spalten: (klein) => (klein ? 2 : 1),
  rahmen: 2,
  // #pause button
  bPadY: (klein) => (klein ? 9 : 13),
  bPadX: (klein) => (klein ? 10 : 18),
  bSchrift: (klein) => (klein ? 12 : 15),
  bMarginY: (klein) => (klein ? 0 : 8),
  bRahmen: 2,
  // #pause h1
  h1: (klein) => (klein ? { schrift: 17, unten: 4 } : { schrift: 26, unten: 18 }),
  // #pause .hint — vier Zeilen, durch <br> getrennt
  hint: (klein) => (klein ? { schrift: 10, zeile: 1.45, oben: 6 } : { schrift: 11, zeile: 1.7, oben: 16 }),
  maxHoehe: (klein, f) => (klein ? 0.94 : 0.88) * f.h,
};

/** Kaesten des Pausenfelds, absolut im Bild. */
function feldLayout(f) {
  const k = f.klein;
  const spalten = FELD.spalten(k);
  const bH = Math.round(FELD.bSchrift(k) * 1.2) + 2 * FELD.bPadY(k) + 2 * FELD.bRahmen;
  // Spaltenbreite = breitester Knopf (Grid `1fr 1fr` waechst auf den Inhalt)
  const textBreite = (t) => Math.ceil(t.length * FELD.bSchrift(k) * EM);
  const spaltenB = Math.max(
    ...KNOEPFE.map((b) => textBreite(b.text)),
    k ? 0 : 0
  ) + 2 * FELD.bPadX(k) + 2 * FELD.bRahmen;
  const innenB = spaltenB * spalten + FELD.gapX(k) * (spalten - 1);
  const minB = k ? 300 : 260; // min-width aus dem CSS, ohne Polster
  const inhaltB = Math.max(innenB, minB - 2 * FELD.padX(k));
  const h1 = FELD.h1(k);
  const hint = FELD.hint(k);

  const reihen = Math.ceil(KNOEPFE.length / spalten);
  const h1H = Math.round(h1.schrift * 1.2) + h1.unten;
  const knopfBlockH = k
    ? reihen * bH + (reihen - 1) * FELD.gapY(k) + FELD.gapY(k) /* Abstand unter h1 */
    : KNOEPFE.length * (bH + 2 * FELD.bMarginY(k));
  const hintH = hint.oben + 4 * Math.round(hint.schrift * hint.zeile);
  const inhaltH = h1H + knopfBlockH + hintH + (k ? FELD.gapY(k) : 0);

  const feldB = inhaltB + 2 * FELD.padX(k) + 2 * FELD.rahmen;
  const feldH = inhaltH + 2 * FELD.padY(k) + 2 * FELD.rahmen;
  const grenzeH = FELD.maxHoehe(k, f);
  // #pause: flex, zentriert, Polster = sichere Raender
  const buehneX = f.sa.l;
  const buehneB = f.w - f.sa.l - f.sa.r;
  const buehneY = f.sa.t;
  const buehneH = f.h - f.sa.t - f.sa.b;
  const sichtH = Math.min(feldH, grenzeH);
  const x0 = buehneX + (buehneB - feldB) / 2;
  const y0 = buehneY + (buehneH - sichtH) / 2;

  const kaesten = [];
  let y = y0 + FELD.rahmen + FELD.padY(k);
  kaesten.push({ art: "h1", text: "PAUSE", x0: x0 + FELD.rahmen + FELD.padX(k), y0: y, x1: x0 + feldB - FELD.rahmen - FELD.padX(k), y1: y + Math.round(h1.schrift * 1.2), schrift: h1.schrift });
  y += h1H + (k ? FELD.gapY(k) : 0);
  KNOEPFE.forEach((b, i) => {
    const sp = i % spalten;
    const re = Math.floor(i / spalten);
    const bx = x0 + FELD.rahmen + FELD.padX(k) + sp * (spaltenB + FELD.gapX(k));
    const by = k
      ? y + re * (bH + FELD.gapY(k))
      : y + re * (bH + 2 * FELD.bMarginY(k)) + FELD.bMarginY(k);
    kaesten.push({
      art: "knopf",
      id: b.id,
      text: b.text,
      x0: bx,
      y0: by,
      x1: bx + (spalten === 1 ? inhaltB : spaltenB),
      y1: by + bH,
      schrift: FELD.bSchrift(k),
      an: b.id === "pause-markierungen", // Zustandsbalken: Markierungen sind an
    });
  });
  y += knopfBlockH;
  kaesten.push({ art: "hint", text: "Linker Stick ... Funktionskranz", x0: x0 + FELD.rahmen + FELD.padX(k), y0: y + hint.oben, x1: x0 + feldB - FELD.rahmen - FELD.padX(k), y1: y + hint.oben + 4 * Math.round(hint.schrift * hint.zeile), schrift: hint.schrift });
  return { x0, y0, feldB, feldH, sichtH, grenzeH, kaesten, buehneY, buehneH, scrollt: feldH > grenzeH };
}

/** Die n Kaesten auf dem Ring um (cx, cy). */
function ring(n, cx, cy, mass, gewaehlt) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.sin(a) * R;
    const y = cy - Math.cos(a) * R;
    const s = i === gewaehlt ? SKALA : 1;
    out.push({
      i,
      x0: x - (mass.w * s) / 2,
      y0: y - (mass.h * s) / 2,
      x1: x + (mass.w * s) / 2,
      y1: y + (mass.h * s) / 2,
    });
  }
  return out;
}

const luft = (a, b) => Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1);
function engste(kaesten) {
  let min = Infinity;
  for (let i = 0; i < kaesten.length; i++)
    for (let j = i + 1; j < kaesten.length; j++) min = Math.min(min, luft(kaesten[i], kaesten[j]));
  return min;
}

/* ----------------------------------------------------- 5x7-Schrift -------- */
/*
 * Ohne Schrift im PNG sieht man nur Kaesten und kann nicht pruefen, ob der
 * richtige Knopf den Zustandsbalken traegt. Darum ein winziger Zeichensatz —
 * Grossbuchstaben, Ziffern und die paar Zeichen, die in den Beschriftungen
 * vorkommen. Umlaute werden auf den Grundbuchstaben abgebildet.
 */
const FONT = {
  A: "01110,10001,10001,11111,10001,10001,10001",
  B: "11110,10001,10001,11110,10001,10001,11110",
  C: "01111,10000,10000,10000,10000,10000,01111",
  D: "11110,10001,10001,10001,10001,10001,11110",
  E: "11111,10000,10000,11110,10000,10000,11111",
  F: "11111,10000,10000,11110,10000,10000,10000",
  G: "01111,10000,10000,10111,10001,10001,01111",
  H: "10001,10001,10001,11111,10001,10001,10001",
  I: "11111,00100,00100,00100,00100,00100,11111",
  J: "00111,00010,00010,00010,00010,10010,01100",
  K: "10001,10010,10100,11000,10100,10010,10001",
  L: "10000,10000,10000,10000,10000,10000,11111",
  M: "10001,11011,10101,10101,10001,10001,10001",
  N: "10001,11001,10101,10011,10001,10001,10001",
  O: "01110,10001,10001,10001,10001,10001,01110",
  P: "11110,10001,10001,11110,10000,10000,10000",
  Q: "01110,10001,10001,10001,10101,10010,01101",
  R: "11110,10001,10001,11110,10100,10010,10001",
  S: "01111,10000,10000,01110,00001,00001,11110",
  T: "11111,00100,00100,00100,00100,00100,00100",
  U: "10001,10001,10001,10001,10001,10001,01110",
  V: "10001,10001,10001,10001,10001,01010,00100",
  W: "10001,10001,10001,10101,10101,11011,10001",
  X: "10001,01010,00100,00100,00100,01010,10001",
  Y: "10001,01010,00100,00100,00100,00100,00100",
  Z: "11111,00001,00010,00100,01000,10000,11111",
  0: "01110,10011,10101,10101,10101,11001,01110",
  1: "00100,01100,00100,00100,00100,00100,01110",
  2: "01110,10001,00001,00110,01000,10000,11111",
  3: "11110,00001,00001,01110,00001,00001,11110",
  4: "00010,00110,01010,10010,11111,00010,00010",
  5: "11111,10000,11110,00001,00001,10001,01110",
  6: "01110,10000,11110,10001,10001,10001,01110",
  7: "11111,00001,00010,00100,01000,01000,01000",
  8: "01110,10001,01110,10001,10001,10001,01110",
  9: "01110,10001,10001,01111,00001,00001,01110",
  " ": "00000,00000,00000,00000,00000,00000,00000",
  "/": "00001,00010,00010,00100,01000,01000,10000",
  "-": "00000,00000,00000,11111,00000,00000,00000",
  ".": "00000,00000,00000,00000,00000,01100,01100",
  ",": "00000,00000,00000,00000,01100,00100,01000",
  ":": "00000,01100,01100,00000,01100,01100,00000",
  "·": "00000,00000,00000,01100,01100,00000,00000",
  "→": "00000,00100,00010,11111,00010,00100,00000",
  "(": "00010,00100,01000,01000,01000,00100,00010",
  ")": "01000,00100,00010,00010,00010,00100,01000",
  "=": "00000,00000,11111,00000,11111,00000,00000",
  "×": "00000,10001,01010,00100,01010,10001,00000",
};
const ERSATZ = { Ä: "A", Ö: "O", Ü: "U", ä: "A", ö: "O", ü: "U", ß: "S", "„": '"', '"': '"', '"': '"' };

/* ------------------------------------------------------------ PNG --------- */
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
  const roh = Buffer.alloc((breite * 3 + 1) * hoehe);
  for (let y = 0; y < hoehe; y++) {
    roh[y * (breite * 3 + 1)] = 0;
    pixel.copy(roh, y * (breite * 3 + 1) + 1, y * breite * 3, (y + 1) * breite * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(roh)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function leinwand(w, h, grund) {
  const p = Buffer.alloc(w * h * 3);
  const setz = (x, y, [r, g, b]) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 3;
    p[i] = r;
    p[i + 1] = g;
    p[i + 2] = b;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setz(x, y, grund);
  const kasten = (k, fuell, rahmen, dick = 2) => {
    for (let y = Math.round(k.y0); y < Math.round(k.y1); y++)
      for (let x = Math.round(k.x0); x < Math.round(k.x1); x++) {
        const rand = y < k.y0 + dick || y >= k.y1 - dick || x < k.x0 + dick || x >= k.x1 - dick;
        if (rand) setz(x, y, rahmen);
        else if (fuell) setz(x, y, fuell);
      }
  };
  const text = (s, x, y, farbe, groesse = 1) => {
    let cx = x;
    for (const roh of s.toUpperCase()) {
      const z = ERSATZ[roh] ?? roh;
      const g = FONT[z];
      if (g) {
        const reihen = g.split(",");
        for (let ry = 0; ry < 7; ry++)
          for (let rx = 0; rx < 5; rx++)
            if (reihen[ry][rx] === "1")
              for (let dy = 0; dy < groesse; dy++)
                for (let dx = 0; dx < groesse; dx++) setz(cx + rx * groesse + dx, y + ry * groesse + dy, farbe);
      }
      cx += 6 * groesse;
    }
    return cx - x;
  };
  return { p, setz, kasten, text };
}

const GRUND = [43, 49, 54];
const DUNKEL = [26, 28, 30];
const HELL = [232, 232, 228];
const GOLD = [240, 208, 96];
const GELB = [240, 180, 41];
const GRAU = [139, 148, 155];
const ROT = [200, 80, 70];

/* ------------------------------------------------------- Kranzbild -------- */
function kranzBild(f) {
  const mass = sektorMass(f.klein);
  const l = leinwand(f.w, f.h, GRUND);
  const cx = f.w * 0.72;
  const cy = f.h * 0.5;
  const k = ring(KRANZ.length, cx, cy, mass, 0); // der oberste scharfgestellt
  l.kasten({ x0: cx - 13, y0: cy - 13, x1: cx + 13, y1: cy + 13 }, GELB, HELL);
  const kipp = KRANZ.findIndex((e) => e.id === "btn-kipp");
  for (const kst of k) {
    const sel = kst.i === 0;
    l.kasten(kst, sel ? GELB : DUNKEL, sel ? GOLD : [120, 125, 130]);
    const t = KRANZ[kst.i].text;
    const breite = t.length * 6;
    l.text(t, (kst.x0 + kst.x1) / 2 - breite / 2, (kst.y0 + kst.y1) / 2 - 5, sel ? DUNKEL : HELL);
    if (kst.i === kipp) {
      // Zustandsbalken: so sieht „eingeschaltet" aus
      l.kasten({ x0: kst.x0 + 7, y0: kst.y1 - 7, x1: kst.x1 - 7, y1: kst.y1 - 3 }, GOLD, GOLD, 0);
    }
  }
  const eng = engste(k);
  l.text(
    `${f.name} ${f.w}x${f.h} KRANZ ${KRANZ.length} EINTRAEGE R=${R} KASTEN ${mass.w}X${mass.h}`,
    14, 14, GOLD
  );
  l.text(`ENGSTE STELLE ${eng.toFixed(1)} PX (SCHRANKE 6) GERECHNET KEIN BILDSCHIRMFOTO`, 14, 26, GRAU);
  l.text(`SCHILDER IST RAUS, KIPPEN TRAEGT DEN ZUSTANDSBALKEN`, 14, 38, GRAU);
  return { daten: png(f.w, f.h, l.p), eng };
}

/* -------------------------------------------------------- Menuebild ------- */
function menueBild(f) {
  const L = feldLayout(f);
  const l = leinwand(f.w, f.h, [20, 23, 26]);
  // Buehne: der Bereich innerhalb der sicheren Raender
  l.kasten(
    { x0: f.sa.l, y0: f.sa.t, x1: f.w - f.sa.r, y1: f.h - f.sa.b },
    null,
    [60, 66, 72],
    1
  );
  l.kasten({ x0: L.x0, y0: L.y0, x1: L.x0 + L.feldB, y1: L.y0 + L.sichtH }, [24, 27, 30], [110, 116, 122]);
  for (const k of L.kaesten) {
    if (k.art === "knopf") {
      l.kasten(k, DUNKEL, k.an ? GOLD : [120, 125, 130]);
      l.text(k.text, k.x0 + 8, (k.y0 + k.y1) / 2 - 3, HELL);
      if (k.an) l.kasten({ x0: k.x0 + 7, y0: k.y1 - 7, x1: k.x1 - 7, y1: k.y1 - 3 }, GOLD, GOLD, 0);
    } else if (k.art === "h1") {
      l.text(k.text, k.x0, k.y0, GELB, f.klein ? 1 : 2);
    } else {
      l.text("LINKER STICK ... FUNKTIONSKRANZ (4 ZEILEN)", k.x0, k.y0, GRAU);
    }
  }
  // Ueberlappung der Knoepfe untereinander
  const knoepfe = L.kaesten.filter((k) => k.art === "knopf");
  const eng = engste(knoepfe);
  if (eng < 0) l.kasten({ x0: 0, y0: 0, x1: f.w, y1: 6 }, ROT, ROT, 0);
  l.text(`${f.name} ${f.w}x${f.h} PAUSENMENUE ${knoepfe.length} KNOEPFE`, 14, f.h - 40, GOLD);
  l.text(
    `FELD ${Math.round(L.feldB)}X${Math.round(L.feldH)} GRENZE ${Math.round(L.grenzeH)} ` +
      `${L.scrollt ? "SCROLLT" : "PASST"} ENGSTE ${eng.toFixed(1)} PX`,
    14, f.h - 28, L.scrollt || eng < 0 ? ROT : GRAU
  );
  l.text(`ZONENMARKIERUNGEN MIT BALKEN = AN`, 14, f.h - 16, GRAU);
  return { daten: png(f.w, f.h, l.p), L, eng };
}

const zeilen = [];
for (const f of FASSUNGEN) {
  const kb = kranzBild(f);
  writeFileSync(resolve(hier, `${f.datei}-kranz.png`), kb.daten);
  const mb = menueBild(f);
  writeFileSync(resolve(hier, `${f.datei}-menue.png`), mb.daten);
  const mass = sektorMass(f.klein);
  zeilen.push(
    `${f.name.padEnd(18)} Kranz: ${KRANZ.length} Eintraege, Kasten ${mass.w}x${mass.h}, R=${R} ` +
      `-> engste Stelle ${kb.eng.toFixed(1)} px`
  );
  zeilen.push(
    `${"".padEnd(18)} Menue: ${KNOEPFE.length} Knoepfe, Feld ${Math.round(mb.L.feldB)}x${Math.round(mb.L.feldH)} px, ` +
      `Grenze ${Math.round(mb.L.grenzeH)} px -> ${mb.L.scrollt ? "SCROLLT" : "passt ohne Scrollen"}, ` +
      `engste Stelle zwischen Knoepfen ${mb.eng.toFixed(1)} px`
  );
}
console.log(zeilen.join("\n"));
