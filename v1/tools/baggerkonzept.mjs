/**
 * Das Baggerkonzept vom 14.09.2026, gezeichnet.
 *
 * Patricks Ansage: „Der Bagger soll als zentrales Element auch mehr Detailtiefe
 * bekommen. Jetzt aktuell ist es auch Playmobil like samt Fahrer. Auch da die
 * Zylinder, wie man das aufbauen koennte, die Reifen, die sind nicht so richtig
 * erkennbar." Vorbild ist ein SENNEBOGEN 840 E Umschlagbagger auf Raedern.
 *
 * Erzeugt `docs/baggerkonzept-2026-09-14.svg`: Seitenansicht, Draufsicht und
 * fuenf Tafeln (Zylinder, Rad-Einbau, Fahrer, Netzbilanz, Teilenummern).
 *
 * ALLE MASSE IN METERN und aus dem Bestand gemessen. Die Herkunft jeder Zahl
 * steht im Kommentar daneben (Projektregel 3, E-008).
 *
 * Ausrichtung: Seitenansicht auf die RECHTE Maschinenseite (−X, dort sitzt die
 * Kabine), gespiegelt dargestellt, damit VORN rechts im Bild liegt. Die
 * Draufsicht liegt darunter auf derselben z-Achse; −X liegt unten.
 *
 * Aufruf:  node tools/baggerkonzept.mjs
 */
import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- Maszahlen
const RAD_R = 0.62;              // wheelParts.ts:40
const RAD_B = 0.5;               // wheelParts.ts:42
const RAD_Z = 1.5;               // excavator.ts RAD_ECKEN (z = ±1,5)
const RAD_X = 1.25;              // excavator.ts RAD_ECKEN (x = ±1,25)
const RAHMEN_L = 4.4;            // excavator.ts:667 BoxGeometry(2.4, 0.9, 4.4)
const RAHMEN_B = 2.4;            // dito
const RAHMEN_OK = 1.6;           // excavator.ts:668 (y 1,15 + 0,45)
const DECK_OK = 1.955;           // cabGroup.y 1,6 + deck y 0,18 + 0,175
const DECK_B = 2.9;              // excavator.ts:694
const DECK_L = 3.2;              // dito
const GEGEN_Z = -2.0, GEGEN_T = 0.7, GEGEN_H = 0.75;               // :714
const HAUBE_Z = -1.0, HAUBE_T = 1.7, HAUBE_H = 1.0, HAUBE_B = 2.5; // :700
const BOOM_PIV_Y = 2.95, BOOM_PIV_Z = 0.55; // excavator.ts BOOM_PIVOT
const BOOM_LEN = 5.2, STICK_LEN = 4.0;      // excavator.ts
const GRAPPLE_LINK = 0.55;                  // excavator.ts
const CLAW_MAX_DEPTH = 2.9995;              // clawGeometry.ts, gemessen 14.09.
const BLADE_Z = 2.55, BLADE_W = 2.9;        // excavator.ts
const CAB_X = -1.05, CAB_Z = 0.6;           // excavator.ts buildCabin
const CAB_LIFT_MAX = 2.6;                   // excavator.ts:369
const AUG_Y = 1.6 + 1.68;                   // cabinEye, = 3,28 ueber Boden
const AUG_Z = CAB_Z - 0.4;                  // 0,20
const PRATZE_X = 1.8, PRATZE_Z = 1.35, PRATZE_PAD = 0.62;  // buildOutriggers
const SCHWENK_INNEN = 5.8, SCHWENK_AUSSEN = 9.2;           // world/baggerstand.ts:46

// Arbeitsstellung der Seitenansicht: Ausleger 40°, Stiel −95°.
const B = (40 * Math.PI) / 180;
const ST = (-95 * Math.PI) / 180;
const BOOM_TIP = { z: BOOM_PIV_Z + BOOM_LEN * Math.cos(B), y: BOOM_PIV_Y + BOOM_LEN * Math.sin(B) };
const STICK_TIP = {
  z: BOOM_TIP.z + STICK_LEN * Math.cos(B + ST),
  y: BOOM_TIP.y + STICK_LEN * Math.sin(B + ST),
};

// ------------------------------------------------------------------- Blatt
const W = 1760, H = 2260;
const F = {
  blatt: "#FBFAF7", rahmen: "#C9C4B8", text: "#1F2326", blass: "#6E7377",
  gruen: "#5BBF46", gruenL: "#BFE6B4", stahl: "#3A3F43", stahlL: "#C6CBD0",
  blank: "#9AA2A8", glas: "#9FC4D8", glasL: "#DCEAF2", gummi: "#2A2C2E",
  haut: "#E3B18C", warn: "#E8720C", rot: "#A33A24", mass: "#2C7A66",
  neu: "#B9563A", grund: "#8C8578",
};
const out = [];
const P = (s) => out.push(s);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function txt(x, y, s, o = {}) {
  const { size = 13, fill = F.text, anchor = "start", weight = 400 } = o;
  P(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`);
}
function rect(x, y, w, h, o = {}) {
  const { fill = "none", stroke = F.stahl, sw = 1.2, rx = 0, op = 1 } = o;
  P(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(w, 0).toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" rx="${rx}" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="${sw}"/>`);
}
function poly(pts, o = {}) {
  const { fill = "none", stroke = F.stahl, sw = 1.2, op = 1 } = o;
  const d = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  P(`<polygon points="${d}" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="${sw}"/>`);
}
function line(x1, y1, x2, y2, o = {}) {
  const { stroke = F.stahl, sw = 1.2, dash = null } = o;
  P(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
}
function circ(x, y, r, o = {}) {
  const { fill = "none", stroke = F.stahl, sw = 1.2, op = 1, dash = null } = o;
  P(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
}
function path(d, o = {}) {
  const { fill = "none", stroke = F.stahl, sw = 1.2, op = 1, dash = null } = o;
  P(`<path d="${d}" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
}
/** Balken: Mittellinie a→b, Breite wa am Anfang, wb am Ende. */
function balken(a, b, wa, wb, o = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  poly([
    [a[0] + (nx * wa) / 2, a[1] + (ny * wa) / 2],
    [b[0] + (nx * wb) / 2, b[1] + (ny * wb) / 2],
    [b[0] - (nx * wb) / 2, b[1] - (ny * wb) / 2],
    [a[0] - (nx * wa) / 2, a[1] - (ny * wa) / 2],
  ], o);
}
function massH(x1, x2, y, label, o = {}) {
  const { farbe = F.mass, ueber = true } = o;
  line(x1, y, x2, y, { stroke: farbe, sw: 1 });
  for (const x of [x1, x2]) line(x, y - 4, x, y + 4, { stroke: farbe, sw: 1 });
  txt((x1 + x2) / 2, ueber ? y - 5 : y + 13, label, { size: 11.5, fill: farbe, anchor: "middle" });
}
function massV(y1, y2, x, label, o = {}) {
  const { farbe = F.mass, rechts = true, oben = false } = o;
  line(x, y1, x, y2, { stroke: farbe, sw: 1 });
  for (const y of [y1, y2]) line(x - 4, y, x + 4, y, { stroke: farbe, sw: 1 });
  if (oben) {
    txt(x, Math.min(y1, y2) - 7, label, { size: 11.5, fill: farbe, anchor: "middle" });
    return;
  }
  P(`<text x="${(x + (rechts ? 6 : -6)).toFixed(1)}" y="${((y1 + y2) / 2).toFixed(1)}" font-family="Helvetica,Arial,sans-serif" font-size="11.5" fill="${farbe}" text-anchor="${rechts ? "start" : "end"}" dominant-baseline="middle">${esc(label)}</text>`);
}
/** Nummernkreis mit Fuehrungslinie: (tx,ty) am Bauteil → Kreis bei (cx,cy). */
function ballon(nr, tx, ty, cx, cy, o = {}) {
  const { farbe = F.rot, r = 12 } = o;
  line(tx, ty, cx, cy, { stroke: farbe, sw: 0.8 });
  circ(tx, ty, 2, { fill: farbe, stroke: farbe, sw: 0 });
  circ(cx, cy, r, { fill: "#FFFFFF", stroke: farbe, sw: 1.2 });
  P(`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-family="Helvetica,Arial,sans-serif" font-size="${nr.length > 4 ? 8.5 : 10}" font-weight="600" fill="${farbe}" text-anchor="middle" dominant-baseline="middle">${esc(nr)}</text>`);
}
function tafel(x, y, w, h, titel, unter = "") {
  rect(x, y, w, h, { fill: "#FFFFFF", stroke: F.rahmen, sw: 1.4, rx: 6 });
  txt(x + 16, y + 26, titel, { size: 16, weight: 700 });
  if (unter) txt(x + 16, y + 44, unter, { size: 12, fill: F.blass });
}

// =========================================================== SEITENANSICHT
const S1 = 60;                 // px je Meter (Massstab rund 1:17)
const SX0 = 340, SY0 = 800;    // Bildpunkt von (z = 0, y = 0)
const sx = (z) => SX0 + z * S1;
const sy = (y) => SY0 - y * S1;

/** Zylinder in der Uebersicht: Rohr (dunkel), Kolbenstange (blank), Augen. */
function zylinder(a, c, dRohr, dStange, anteil) {
  const dx = c[0] - a[0], dy = c[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const lr = l * anteil;
  balken(a, [a[0] + ux * lr, a[1] + uy * lr], dRohr, dRohr, { fill: F.stahl, stroke: "#1B1E20", sw: 1 });
  balken([a[0] + ux * lr, a[1] + uy * lr], c, dStange, dStange, { fill: F.blank, stroke: F.stahl, sw: 1 });
  balken([a[0] + ux * (lr - 7), a[1] + uy * (lr - 7)], [a[0] + ux * lr, a[1] + uy * lr],
         dRohr * 1.25, dRohr * 1.25, { fill: "#4A5055", stroke: "#1B1E20", sw: 0.8 });
  circ(a[0], a[1], dRohr * 0.5, { fill: "#FFF", stroke: F.stahl, sw: 1.4 });
  circ(c[0], c[1], dStange * 0.75, { fill: "#FFF", stroke: F.stahl, sw: 1.4 });
}

function seitenansicht() {
  tafel(40, 130, 1010, 760,
    "1 — SEITENANSICHT, Massstab rund 1:17",
    "Blick auf die rechte Maschinenseite (dort sitzt die Kabine), gespiegelt — VORN liegt rechts. Arbeitsstellung: Ausleger 40°, Stiel −95°.");

  // Boden und Schwenkband
  line(sx(-3.9), sy(0), sx(11.4), sy(0), { stroke: F.grund, sw: 2 });
  for (const [d, t] of [[SCHWENK_INNEN, "5,80 innen"], [SCHWENK_AUSSEN, "9,20 aussen"]]) {
    line(sx(d), sy(0) + 6, sx(d), sy(0) - 20, { stroke: F.mass, sw: 1, dash: "3 3" });
    txt(sx(d), sy(0) + 20, t, { size: 10.5, fill: F.mass, anchor: "middle" });
  }
  txt(sx(7.5), sy(0) + 36, "Schwenkband des Platzes (world/baggerstand.ts) — bleibt unveraendert",
      { size: 10.5, fill: F.mass, anchor: "middle" });

  // --- 02 Raeder (Form abgenommen, unveraendert) ------------------------
  for (const z of [RAD_Z, -RAD_Z]) {
    const cx = sx(z), cy = sy(RAD_R);
    circ(cx, cy, RAD_R * S1, { fill: F.gummi, stroke: "#0E0F10", sw: 1.2 });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      line(cx + Math.cos(a) * 0.582 * S1, cy + Math.sin(a) * 0.582 * S1,
           cx + Math.cos(a) * 0.62 * S1, cy + Math.sin(a) * 0.62 * S1, { stroke: "#4A4D50", sw: 2.2 });
    }
    circ(cx, cy, 0.41 * S1, { fill: F.gruen, stroke: "#2E6B24", sw: 1 });
    circ(cx, cy, 0.33 * S1, { stroke: "#2E6B24", sw: 0.8 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      circ(cx + Math.cos(a) * 0.25 * S1, cy + Math.sin(a) * 0.25 * S1, 2.2, { fill: "#2E6B24", stroke: "none", sw: 0 });
    }
    circ(cx, cy, 0.14 * S1, { fill: F.blank, stroke: F.stahl, sw: 1 });
  }

  // --- 01 Unterwagen, neu gegliedert ------------------------------------
  rect(sx(-0.9), sy(1.24), 1.8 * S1, 0.24 * S1, { fill: "#4CA33B", stroke: "#2E6B24", sw: 1 });
  rect(sx(-RAHMEN_L / 2), sy(RAHMEN_OK), RAHMEN_L * S1, (RAHMEN_OK - 1.24) * S1,
       { fill: F.gruen, stroke: "#2E6B24", sw: 1.4 });
  for (const z of [RAD_Z, -RAD_Z]) {   // Kotfluegelbogen in der Seitenwange
    const cx = sx(z), cy = sy(RAD_R);
    path(`M ${(cx - 0.74 * S1).toFixed(1)} ${cy.toFixed(1)} A ${(0.74 * S1).toFixed(1)} ${(0.74 * S1).toFixed(1)} 0 0 1 ${(cx + 0.74 * S1).toFixed(1)} ${cy.toFixed(1)}`,
         { stroke: "#2E6B24", sw: 1.6 });
  }
  for (const z of [RAD_Z, -RAD_Z])     // Achsbruecken
    rect(sx(z - 0.21), sy(0.77), 0.42 * S1, 0.3 * S1, { fill: F.stahlL, stroke: F.stahl, sw: 1 });
  rect(sx(-1.05), sy(1.24), 0.95 * S1, 0.42 * S1, { fill: F.gruen, stroke: "#2E6B24", sw: 1 }); // Tank
  rect(sx(0.18), sy(1.24), 0.72 * S1, 0.4 * S1, { fill: F.stahlL, stroke: F.stahl, sw: 1 });    // Werkzeugkasten
  for (let i = 0; i < 3; i++)          // Aufstieg
    rect(sx(0.52 + i * 0.3), sy(0.48 + i * 0.3), 0.28 * S1, 0.05 * S1, { fill: F.stahl, stroke: F.stahl, sw: 0.8 });
  path(`M ${sx(0.46)} ${sy(0.6)} L ${sx(1.16)} ${sy(1.46)} L ${sx(1.2)} ${sy(1.95)}`, { stroke: F.stahl, sw: 2.4 });
  rect(sx(-2.44), sy(0.78), 0.24 * S1, 0.22 * S1, { fill: F.stahl, stroke: F.stahl, sw: 1 });   // Unterfahrschutz

  // --- 03 Abstuetzung (steht aussen, deshalb heller) --------------------
  for (const z of [PRATZE_Z, -PRATZE_Z]) {
    rect(sx(z - 0.17), sy(0.92), 0.34 * S1, 0.78 * S1, { fill: "#EDEFF1", stroke: F.stahl, sw: 1 });
    rect(sx(z - 0.11), sy(0.3), 0.22 * S1, 0.16 * S1, { fill: F.blank, stroke: F.stahl, sw: 0.9 });
    rect(sx(z - 0.31), sy(0.14), PRATZE_PAD * S1, 0.14 * S1, { fill: F.stahl, stroke: F.stahl, sw: 1 });
  }

  // --- 01 Raeumschild ---------------------------------------------------
  poly([[sx(2.42), sy(0.88)], [sx(2.68), sy(0.84)], [sx(2.62), sy(0.16)], [sx(2.36), sy(0.2)]],
       { fill: F.stahl, stroke: "#1B1E20", sw: 1 });
  poly([[sx(2.36), sy(0.2)], [sx(2.62), sy(0.16)], [sx(2.63), sy(0.02)], [sx(2.35), sy(0.06)]],
       { fill: F.blank, stroke: F.stahl, sw: 1 });
  line(sx(2.18), sy(1.05), sx(2.44), sy(0.78), { stroke: F.stahl, sw: 3 });

  // --- 04 Drehkranz mit Zahnkranz --------------------------------------
  rect(sx(-0.85), sy(1.78), 1.7 * S1, 0.18 * S1, { fill: F.stahlL, stroke: F.stahl, sw: 1.2 });
  for (let i = 0; i < 24; i++)
    line(sx(-0.82 + i * 0.0713), sy(1.62), sx(-0.82 + i * 0.0713), sy(1.7), { stroke: F.stahl, sw: 1.3 });

  // --- 05 Oberwagen -----------------------------------------------------
  rect(sx(-DECK_L / 2), sy(DECK_OK), DECK_L * S1, (DECK_OK - 1.78) * S1, { fill: F.stahl, stroke: "#1B1E20", sw: 1.2 });
  poly([[sx(GEGEN_Z - GEGEN_T / 2 - 0.35), sy(DECK_OK)], [sx(GEGEN_Z + GEGEN_T / 2), sy(DECK_OK)],
        [sx(GEGEN_Z + GEGEN_T / 2), sy(DECK_OK + GEGEN_H)], [sx(GEGEN_Z - GEGEN_T / 2 - 0.22), sy(DECK_OK + GEGEN_H)],
        [sx(GEGEN_Z - GEGEN_T / 2 - 0.35), sy(DECK_OK + GEGEN_H - 0.3)]],
       { fill: F.stahl, stroke: "#1B1E20", sw: 1.2 });
  poly([[sx(HAUBE_Z - HAUBE_T / 2), sy(DECK_OK)], [sx(HAUBE_Z + HAUBE_T / 2), sy(DECK_OK)],
        [sx(HAUBE_Z + HAUBE_T / 2), sy(DECK_OK + 0.72)], [sx(HAUBE_Z + 0.42), sy(DECK_OK + 0.72)],
        [sx(HAUBE_Z + 0.42), sy(DECK_OK + HAUBE_H)], [sx(HAUBE_Z - HAUBE_T / 2), sy(DECK_OK + HAUBE_H)]],
       { fill: F.gruen, stroke: "#2E6B24", sw: 1.4 });
  for (let i = 0; i < 5; i++)
    line(sx(-1.72 + i * 0.13), sy(2.15), sx(-1.72 + i * 0.13), sy(2.72), { stroke: "#1F2224", sw: 2 });
  rect(sx(-0.36), sy(3.52), 0.14 * S1, 0.6 * S1, { fill: F.stahl, stroke: "#1B1E20", sw: 1 });   // Auspuff
  poly([[sx(-0.43), sy(3.52)], [sx(-0.15), sy(3.52)], [sx(-0.22), sy(3.62)], [sx(-0.36), sy(3.62)]],
       { fill: F.stahl, stroke: "#1B1E20", sw: 1 });
  line(sx(-2.3), sy(2.86), sx(-0.24), sy(2.86), { stroke: F.stahl, sw: 2.6 });   // Gelaender
  line(sx(-2.3), sy(2.42), sx(-0.24), sy(2.42), { stroke: F.stahl, sw: 1.5 });
  line(sx(-2.28), sy(2.86), sx(-2.28), sy(2.7), { stroke: F.stahl, sw: 2.2 });
  line(sx(-1.3), sy(2.86), sx(-1.3), sy(DECK_OK), { stroke: F.stahl, sw: 2.2 });
  line(sx(-0.26), sy(2.86), sx(-0.26), sy(DECK_OK), { stroke: F.stahl, sw: 2.2 });
  rect(sx(-2.12), sy(3.04), 0.22 * S1, 0.16 * S1, { fill: "#F5E6A8", stroke: F.stahl, sw: 1 });  // Scheinwerfer

  // --- 06 Kabine: erst NACH dem Ausleger gezeichnet ---------------------
  // Sie sitzt bei x = −1,05, also auf der Seite, von der wir schauen — sie
  // verdeckt den Auslegerfuss, nicht umgekehrt.
  const kabine = () => {
    const kz0 = CAB_Z - 0.7, kz1 = CAB_Z + 0.7;
    const ky0 = 1.6 + 0.545, ky1 = 1.6 + 2.145;
    line(sx(-0.15), sy(1.95), sx(0.48), sy(2.1), { stroke: F.stahl, sw: 5 });
    line(sx(-0.15), sy(2.36), sx(0.48), sy(2.51), { stroke: F.stahl, sw: 5 });
    circ(sx(-0.15), sy(1.95), 3.2, { fill: "#FFF", stroke: F.stahl, sw: 1.2 });
    circ(sx(0.48), sy(2.1), 3.2, { fill: "#FFF", stroke: F.stahl, sw: 1.2 });
    rect(sx(kz0), sy(ky1), (kz1 - kz0) * S1, (ky1 - ky0) * S1, { fill: F.gruen, stroke: "#2E6B24", sw: 1.4 });
    rect(sx(kz0 + 0.06), sy(ky1 - 0.12), (kz1 - kz0 - 0.12) * S1, (ky1 - ky0 - 0.32) * S1,
         { fill: F.glasL, stroke: "#6E8FA0", sw: 1 });
    line(sx(kz1 - 0.07), sy(ky1 - 0.12), sx(kz1 - 0.07), sy(ky0 + 0.18), { stroke: "#2E6B24", sw: 3 });
    poly([[sx(kz1 - 0.07), sy(ky0 + 0.32)], [sx(kz1 + 0.22), sy(ky0 + 0.08)],
          [sx(kz1 + 0.22), sy(ky0)], [sx(kz1 - 0.07), sy(ky0 + 0.22)]],
         { fill: F.glas, stroke: "#6E8FA0", sw: 1 });
    rect(sx(CAB_Z - 0.42), sy(ky0 + 1.18), 0.16 * S1, 0.74 * S1, { fill: "#24272A", stroke: "#24272A", sw: 1 });
    rect(sx(CAB_Z - 0.42), sy(ky0 + 0.46), 0.52 * S1, 0.12 * S1, { fill: "#24272A", stroke: "#24272A", sw: 1 });
    poly([[sx(CAB_Z - 0.26), sy(ky0 + 1.12)], [sx(CAB_Z + 0.12), sy(ky0 + 1.06)],
          [sx(CAB_Z + 0.16), sy(ky0 + 0.52)], [sx(CAB_Z - 0.24), sy(ky0 + 0.5)]],
         { fill: F.warn, stroke: "#8A4406", sw: 1 });
    circ(sx(CAB_Z - 0.16), sy(ky0 + 1.3), 0.115 * S1, { fill: F.haut, stroke: "#B98A68", sw: 1 });
    line(sx(kz1 + 0.02), sy(ky1 - 0.2), sx(kz1 + 0.34), sy(ky1 - 0.06), { stroke: F.stahl, sw: 2 });
    rect(sx(kz1 + 0.3), sy(ky1 - 0.02), 0.1 * S1, 0.24 * S1, { fill: F.stahl, stroke: F.stahl, sw: 1 });
    line(sx(kz1 - 0.05), sy(ky0 + 1.34), sx(kz1 - 0.11), sy(ky0 + 0.72), { stroke: "#1B1E20", sw: 1.6 });
    rect(sx(kz0), sy(ky1 + CAB_LIFT_MAX), (kz1 - kz0) * S1, (ky1 - ky0) * S1, { stroke: F.neu, sw: 1 });
    for (const kz of [kz0, kz1])
      line(sx(kz), sy(ky1), sx(kz), sy(ky0 + CAB_LIFT_MAX), { stroke: F.neu, sw: 0.8, dash: "3 4" });
    P(`<text x="${sx(kz0 - 0.16).toFixed(1)}" y="${sy(ky1 + CAB_LIFT_MAX - 0.8).toFixed(1)}" font-family="Helvetica,Arial,sans-serif" font-size="10.5" fill="${F.neu}" text-anchor="end">Kabine ganz oben (+2,60 m)</text>`);
    circ(sx(AUG_Z), sy(AUG_Y), 3.2, { fill: F.warn, stroke: "#8A4406", sw: 1 });
  };

  // --- 07 Ausleger, Stiel, Zylinder -------------------------------------
  const piv = [sx(BOOM_PIV_Z), sy(BOOM_PIV_Y)];
  const tipB = [sx(BOOM_TIP.z), sy(BOOM_TIP.y)];
  const tipS = [sx(STICK_TIP.z), sy(STICK_TIP.y)];
  balken(piv, tipB, 0.62 * S1, 0.44 * S1, { fill: F.gruen, stroke: "#2E6B24", sw: 1.4 });
  balken(tipB, tipS, 0.45 * S1, 0.3 * S1, { fill: F.gruen, stroke: "#2E6B24", sw: 1.4 });
  const nb = [-(tipB[1] - piv[1]), tipB[0] - piv[0]];
  const lb = Math.hypot(nb[0], nb[1]);
  for (const t of [0.3, 0.5, 0.7]) {   // Aussteifungsrippen
    const a = [piv[0] + (tipB[0] - piv[0]) * t, piv[1] + (tipB[1] - piv[1]) * t];
    line(a[0] - (nb[0] / lb) * 15, a[1] - (nb[1] / lb) * 15, a[0] + (nb[0] / lb) * 15, a[1] + (nb[1] / lb) * 15,
         { stroke: "#2E6B24", sw: 1 });
  }
  path(`M ${(piv[0] + (nb[0] / lb) * 19).toFixed(1)} ${(piv[1] + (nb[1] / lb) * 19).toFixed(1)} Q ${((piv[0] + tipB[0]) / 2 + (nb[0] / lb) * 29).toFixed(1)} ${((piv[1] + tipB[1]) / 2 + (nb[1] / lb) * 29).toFixed(1)} ${(tipB[0] + (nb[0] / lb) * 13).toFixed(1)} ${(tipB[1] + (nb[1] / lb) * 13).toFixed(1)}`,
       { stroke: "#1C1E20", sw: 2.6 });
  for (const p of [piv, tipB, tipS]) circ(p[0], p[1], 4.5, { fill: "#FFF", stroke: F.stahl, sw: 1.6 });

  const cb = Math.cos(B), sb = Math.sin(B);
  const cs = Math.cos(B + ST), ss = Math.sin(B + ST);
  zylinder([sx(1.05), sy(1.62)],
           [sx(BOOM_PIV_Z + 2.6 * cb + 0.2 * sb), sy(BOOM_PIV_Y + 2.6 * sb - 0.2 * cb)],
           0.2 * S1, 0.11 * S1, 0.62);
  zylinder([sx(BOOM_PIV_Z + 3.4 * cb - 0.34 * sb), sy(BOOM_PIV_Y + 3.4 * sb + 0.34 * cb)],
           [sx(BOOM_TIP.z + 0.35 * cs - 0.2 * ss), sy(BOOM_TIP.y + 0.35 * ss + 0.2 * cs)],
           0.17 * S1, 0.095 * S1, 0.7);
  zylinder([sx(-0.05), sy(1.98)], [sx(0.42), sy(2.46)], 0.14 * S1, 0.08 * S1, 0.55);

  // --- Greiferhalter und Spinne (fremdes Paket, nur Umriss) -------------
  rect(tipS[0] - 0.21 * S1, tipS[1], 0.42 * S1, 0.52 * S1, { fill: F.stahl, stroke: "#1B1E20", sw: 1.2 });
  line(tipS[0], tipS[1] + 0.52 * S1, tipS[0], tipS[1] + GRAPPLE_LINK * S1 + 8, { stroke: F.stahl, sw: 5 });
  const gy = tipS[1] + (GRAPPLE_LINK + 0.2) * S1;
  path(`M ${(tipS[0] - 0.9 * S1).toFixed(1)} ${(gy + 0.2 * S1).toFixed(1)} Q ${tipS[0].toFixed(1)} ${(gy + (CLAW_MAX_DEPTH + 0.6) * S1).toFixed(1)} ${(tipS[0] + 0.9 * S1).toFixed(1)} ${(gy + 0.2 * S1).toFixed(1)}`,
       { stroke: F.blass, sw: 1.6, dash: "7 5" });
  txt(tipS[0] + 1.0 * S1, gy + 0.8 * S1, "Spinne — eigenes Paket (E-009/E-013),", { size: 10.5, fill: F.blass });
  txt(tipS[0] + 1.0 * S1, gy + 0.8 * S1 + 14, "hier nicht angefasst.", { size: 10.5, fill: F.blass });

  kabine();

  // --- Bemassung --------------------------------------------------------
  massV(sy(0), sy(1.24), sx(-2.9), "Rad 1,24", { oben: true });
  massV(sy(0), sy(BOOM_PIV_Y), sx(-3.5), "Drehpunkt 2,95", { oben: true });
  massV(sy(0), sy(AUG_Y), sx(-4.1), "Augpunkt 3,28", { oben: true });
  massV(sy(DECK_OK), sy(3.745), sx(2.9), "Kabine 1,79");
  massH(sx(-RAD_Z), sx(RAD_Z), sy(-0.55), "Radstand 3,00");
  massH(sx(-RAHMEN_L / 2), sx(RAHMEN_L / 2), sy(-0.95), "Unterwagen 4,40");
  massH(sx(0), sx(STICK_TIP.z), sy(7.15), "Greifpunkt 6,83 m in dieser Stellung");
  txt(sx(-4.3), sy(0) + 16, "Boden 0,00", { size: 10.5, fill: F.grund });

  // --- Nummern ----------------------------------------------------------
  for (const [nr, tz, ty, cz, cy] of [
    ["01.1", -0.2, 1.42, -2.60, 1.95], ["01.2", 1.5, 0.62, 0.72, -0.28],
    ["01.4", -1.5, 1.32, -2.60, 1.45], ["01.5", 0.95, 0.82, 1.95, 0.36],
    ["01.6", -0.6, 1.44, -2.60, 0.95], ["01.9", 2.5, 0.5, 3.35, 0.35],
    ["02", -1.5, 0.22, -2.4, -0.42], ["03", 1.35, 0.2, 1.72, -0.42],
    ["04", 0.0, 1.69, 0.95, 1.05], ["05.1", -1.15, 1.87, -2.60, 2.45],
    ["05.3", -2.2, 2.42, -2.75, 3.05], ["05.4", -1.7, 2.86, -2.75, 3.60],
    ["05.5", -0.29, 3.96, 0.42, 4.35], ["06.1", 0.16, 2.03, 1.62, 1.55],
    ["06.3", 0.1, 3.6, -1.35, 4.55], ["06.4", 1.2, 3.1, 2.25, 3.62],
    ["06.10", 0.44, 2.9, 1.95, 2.55], ["07.1", 2.6, 4.5, 1.8, 5.4],
    ["07.3", 3.3, 5.4, 2.55, 6.15], ["07.6", 5.7, 4.65, 5.0, 5.6],
    ["07.7", 6.83, 2.7, 7.85, 2.98], ["07.9", 1.95, 3.1, 0.95, 3.5],
    ["07.10", 3.85, 5.8, 4.45, 6.6],
  ]) ballon(nr, sx(tz), sy(ty), sx(cz), sy(cy));
}

// ============================================================= DRAUFSICHT
const SY2 = 1150;
const dx_ = (z) => SX0 + z * S1;
/*
 * −X ist die rechte Maschinenseite (Regel bei RAD_ECKEN in excavator.ts), und
 * dort sitzt die Kabine. Damit die Draufsicht zur Seitenansicht darueber passt
 * — die schaut von rechts —, liegt −X UNTEN im Bild.
 */
const dy_ = (x) => SY2 - x * S1;

function draufsicht() {
  tafel(40, 905, 1010, 490,
    "2 — DRAUFSICHT, gleicher Massstab, gleiche z-Achse wie oben",
    "Unten im Bild ist die rechte Maschinenseite (−X) — dort steht die Kabine. Oberwagen durchscheinend, Vorderraeder mit 20° Einschlag.");

  rect(dx_(-RAHMEN_L / 2), dy_(1.2), RAHMEN_L * S1, RAHMEN_B * S1, { fill: F.gruenL, stroke: "#2E6B24", sw: 1.4 });
  rect(dx_(-RAHMEN_L / 2), dy_(0.75), RAHMEN_L * S1, 1.5 * S1, { fill: F.gruen, stroke: "#2E6B24", sw: 1 });
  for (const z of [RAD_Z, -RAD_Z])
    rect(dx_(z - 0.21), dy_(1.05), 0.42 * S1, 2.1 * S1, { fill: F.stahlL, stroke: F.stahl, sw: 1 });
  for (const [z, lenk] of [[RAD_Z, -20], [-RAD_Z, 0]])
    for (const x of [RAD_X, -RAD_X]) {
      const cx = dx_(z), cy = dy_(x);
      P(`<g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(${lenk})">`);
      P(`<rect x="${(-RAD_R * S1).toFixed(1)}" y="${((-RAD_B / 2) * S1).toFixed(1)}" width="${(2 * RAD_R * S1).toFixed(1)}" height="${(RAD_B * S1).toFixed(1)}" fill="${F.gummi}" stroke="#0E0F10" stroke-width="1"/>`);
      for (let i = 0; i < 9; i++)
        P(`<line x1="${(-RAD_R * S1 + 4 + i * 6.2).toFixed(1)}" y1="${((-RAD_B / 2) * S1 + 2).toFixed(1)}" x2="${(-RAD_R * S1 + 8 + i * 6.2).toFixed(1)}" y2="${((RAD_B / 2) * S1 - 2).toFixed(1)}" stroke="#4A4D50" stroke-width="1.8"/>`);
      P(`</g>`);
    }
  for (const z of [RAD_Z, -RAD_Z])
    for (const x of [RAD_X, -RAD_X])
      rect(dx_(z - 0.78), dy_(x + 0.29), 1.56 * S1, 0.58 * S1, { stroke: "#2E6B24", sw: 1.4, dash: "5 3" });
  for (const z of [PRATZE_Z, -PRATZE_Z])
    for (const x of [PRATZE_X, -PRATZE_X]) {
      line(dx_(z), dy_(Math.sign(x) * 1.05), dx_(z), dy_(x), { stroke: F.stahl, sw: 7 });
      rect(dx_(z - PRATZE_PAD / 2), dy_(x + PRATZE_PAD / 2), PRATZE_PAD * S1, PRATZE_PAD * S1,
           { fill: F.stahl, stroke: "#1B1E20", sw: 1 });
    }
  rect(dx_(BLADE_Z - 0.08), dy_(BLADE_W / 2), 0.16 * S1, BLADE_W * S1, { fill: F.stahl, stroke: "#1B1E20", sw: 1.2 });
  circ(dx_(0), dy_(0), 0.85 * S1, { stroke: F.stahl, sw: 1.4 });
  circ(dx_(0), dy_(0), 0.7 * S1, { stroke: F.stahl, sw: 0.8, dash: "3 3" });

  rect(dx_(-DECK_L / 2), dy_(DECK_B / 2), DECK_L * S1, DECK_B * S1, { fill: "#E7E9EB", stroke: F.stahl, sw: 1.4, op: 0.45 });
  rect(dx_(GEGEN_Z - GEGEN_T / 2), dy_(1.2), GEGEN_T * S1, 2.4 * S1, { fill: F.stahl, stroke: "#1B1E20", sw: 1.2, op: 0.55 });
  rect(dx_(HAUBE_Z - HAUBE_T / 2), dy_(HAUBE_B / 2), HAUBE_T * S1, HAUBE_B * S1, { fill: F.gruen, stroke: "#2E6B24", sw: 1.4, op: 0.5 });
  path(`M ${dx_(-0.2)} ${dy_(-1.42)} L ${dx_(-2.3)} ${dy_(-1.42)} L ${dx_(-2.3)} ${dy_(1.42)} L ${dx_(-0.2)} ${dy_(1.42)}`,
       { stroke: F.stahl, sw: 2.2 });
  rect(dx_(CAB_Z - 0.7), dy_(CAB_X + 0.55), 1.4 * S1, 1.1 * S1, { fill: F.glasL, stroke: "#2E6B24", sw: 1.6 });
  circ(dx_(AUG_Z), dy_(CAB_X), 4.5, { fill: F.warn, stroke: "#8A4406", sw: 1 });
  txt(dx_(AUG_Z) + 9, dy_(CAB_X) + 4, "Augpunkt", { size: 10, fill: F.warn });
  rect(dx_(BOOM_PIV_Z), dy_(0.21), (BOOM_TIP.z - BOOM_PIV_Z) * S1, 0.42 * S1, { fill: F.gruen, stroke: "#2E6B24", sw: 1.2, op: 0.55 });
  rect(dx_(BOOM_TIP.z), dy_(0.16), (STICK_TIP.z - BOOM_TIP.z) * S1, 0.32 * S1, { fill: F.gruen, stroke: "#2E6B24", sw: 1.2, op: 0.55 });
  circ(dx_(STICK_TIP.z), dy_(0), 0.55 * S1, { stroke: F.blass, sw: 1.4, dash: "7 5" });

  massH(dx_(-RAHMEN_L / 2), dx_(RAHMEN_L / 2), dy_(-2.45), "Unterwagen 4,40", { ueber: false });
  massV(dy_(-1.5), dy_(1.5), dx_(-2.85), "Spur 3,00 ueber Reifen", { oben: true });
  massV(dy_(-PRATZE_X - 0.31), dy_(PRATZE_X + 0.31), dx_(3.9), "Abstuetzung 4,22", { oben: true });
  txt(dx_(-1.5), dy_(-0.95), "Deck 2,90 breit", { size: 11, fill: F.mass });

  for (const [nr, tz, tx2, cz, cx2] of [
    ["01.3", RAD_Z - 0.32, -0.95, RAD_Z + 0.95, -1.75],
    ["03.2", PRATZE_Z, PRATZE_X, PRATZE_Z + 1.05, PRATZE_X + 0.25],
    ["05.4", -2.3, -1.42, -3.15, -2.05],
    ["06.3", CAB_Z, CAB_X - 0.55, CAB_Z + 1.35, CAB_X - 0.95],
    ["07.1", 3.2, 0.21, 3.2, 1.35],
  ]) ballon(nr, dx_(tz), dy_(tx2), dx_(cz), dy_(cx2));
}

// ================================================ TAFEL 3 — DER ZYLINDER
function tafelZylinder() {
  const X = 1070, Y = 130, BW = 650, BH = 690;
  tafel(X, Y, BW, BH, "3 — WIE EIN ZYLINDER AUFGEBAUT IST",
    "Patricks Frage. Rohr und Kolbenstange haben FESTE Laengen — die Stange taucht ein.");

  const S3 = 130;
  const ox = X + 62;
  /** Ein Zylinder in Seitenlage, Auszug 0..1. Masse aus tools/zylinderhub.ts. */
  const zeichne = (yM, auszug, bemasst) => {
    const rohrL = 2.298, stangeL = 1.813, dR = 0.2, dS = 0.11;
    circ(ox - 0.11 * S3, yM, 0.105 * S3, { fill: "#4A5055", stroke: "#1B1E20", sw: 1.2 });
    circ(ox - 0.11 * S3, yM, 0.045 * S3, { fill: "#FFF", stroke: "#1B1E20", sw: 1 });
    rect(ox, yM - (dR / 2) * S3, rohrL * S3, dR * S3, { fill: F.stahl, stroke: "#1B1E20", sw: 1.2 });
    for (const t of [0.12, 0.86]) {
      const px2 = ox + rohrL * t * S3;
      rect(px2, yM - (dR / 2) * S3 - 0.05 * S3, 0.07 * S3, 0.05 * S3, { fill: "#1B1E20", stroke: "#1B1E20", sw: 1 });
      path(`M ${(px2 + 4).toFixed(1)} ${(yM - (dR / 2) * S3 - 7).toFixed(1)} q 8 -22 30 -26`, { stroke: "#1C1E20", sw: 2.6 });
    }
    rect(ox + (rohrL - 0.12) * S3, yM - dR * 0.62 * S3, 0.12 * S3, dR * 1.24 * S3, { fill: "#4A5055", stroke: "#1B1E20", sw: 1.2 });
    for (let i = 0; i < 4; i++)
      circ(ox + (rohrL - 0.06) * S3, yM - dR * 0.48 * S3 + i * dR * 0.32 * S3, 1.8, { fill: "#1B1E20", stroke: "none", sw: 0 });
    // Herausstehender Teil der Stange: Ankerabstand minus Auge minus Rohr.
    // 2,518 − 0,11 − 2,298 = 0,110 m eingefahren; +1,239 m Hub ausgefahren.
    const raus = 0.11 + auszug * 1.239;
    rect(ox + rohrL * S3, yM - (dS / 2) * S3, raus * S3, dS * S3, { fill: F.blank, stroke: F.stahl, sw: 1.2 });
    rect(ox + (rohrL - (stangeL - raus)) * S3, yM - (dS / 2) * S3, (stangeL - raus) * S3, dS * S3,
         { stroke: F.blank, sw: 1, dash: "4 3" });
    const gx = ox + (rohrL + raus) * S3;
    poly([[gx, yM - 0.085 * S3], [gx + 0.19 * S3, yM - 0.085 * S3], [gx + 0.23 * S3, yM],
          [gx + 0.19 * S3, yM + 0.085 * S3], [gx, yM + 0.085 * S3]],
         { fill: F.blank, stroke: F.stahl, sw: 1.2 });
    circ(gx + 0.125 * S3, yM, 0.042 * S3, { fill: "#FFF", stroke: F.stahl, sw: 1.2 });
    rect(gx + 0.085 * S3, yM - 0.15 * S3, 0.085 * S3, 0.3 * S3, { fill: "#4A5055", stroke: "#1B1E20", sw: 1 });
    if (bemasst) {
      massH(ox, ox + rohrL * S3, yM + 0.3 * S3, "Rohr 2,30 m — feste Laenge", { ueber: false });
      massH(ox + rohrL * S3, gx, yM + 0.3 * S3, "Auszug", { ueber: false });
    }
    return gx;
  };

  const y1 = Y + 134, y2 = Y + 302;
  txt(X + 22, y1 - 48, "EINGEFAHREN — kuerzester Ankerabstand 2,52 m", { size: 12, weight: 700 });
  zeichne(y1, 0, false);
  txt(X + 22, y2 - 108, "AUSGEFAHREN — laengster Ankerabstand 3,76 m, Hub 1,24 m", { size: 12, weight: 700 });
  const gx2 = zeichne(y2, 1, true);

  for (const [n, tx, ty, cx, cy] of [
    ["a", ox - 0.11 * S3, y2 - 0.09 * S3, ox - 0.34 * S3, y2 - 74],
    ["f", ox + 0.31 * S3, y2 - 0.17 * S3, ox + 0.25 * S3, y2 - 74],
    ["b", ox + 1.1 * S3, y2 - 0.1 * S3, ox + 1.05 * S3, y2 - 74],
    ["c", ox + 2.24 * S3, y2 - 0.12 * S3, ox + 2.2 * S3, y2 - 74],
    ["d", ox + 3.1 * S3, y2 - 0.055 * S3, ox + 3.05 * S3, y2 - 74],
    ["e", gx2 + 0.12 * S3, y2 - 0.085 * S3, gx2 + 0.1 * S3, y2 - 74],
  ]) ballon(n, tx, ty, cx, cy, { farbe: "#2C5FA3", r: 11 });

  let yy = Y + 402;
  for (const [n, t, s] of [
    ["a", "Bodenauge", "Kugelbuchse im Rohrboden, Bolzen im Lagerbock des Traegers"],
    ["b", "Zylinderrohr", "nahtloses Rohr, 14 Umfangssegmente — ein Zehneck sieht man"],
    ["c", "Fuehrungskopf", "dicker Ring am offenen Ende, mit sechs Schraubenkoepfen"],
    ["d", "Kolbenstange", "blank verchromt; FESTE Laenge, taucht ins Rohr ein"],
    ["e", "Gabelkopf", "Bolzen und Sicherungsblech, dazu der Lagerbock am Anbauteil"],
    ["f", "Anschluesse", "zwei Stutzen mit Kurzschlaeuchen ins Schlauchpaket"],
  ]) {
    circ(X + 32, yy - 4, 10.5, { fill: "#FFF", stroke: "#2C5FA3", sw: 1.2 });
    txt(X + 32, yy, n, { size: 10.5, weight: 600, fill: "#2C5FA3", anchor: "middle" });
    txt(X + 52, yy, t, { size: 12.5, weight: 700 });
    txt(X + 158, yy, s, { size: 11.3, fill: F.blass });
    yy += 22;
  }
  yy += 14;
  for (const [t, c, w] of [
    ["HEUTE: Rohr und Stange sind zwei glatte Zylinder — und BEIDE werden in", F.neu, 0],
    ["der Laenge gestreckt (excavator.ts updateHydraulics, scale.y). Am", F.neu, 0],
    ["Hubzylinder waechst die Stange von 0,97 auf 2,21 m, also um 128 %.", F.neu, 0],
    ["Darum liest sie sich nicht als Kolbenstange — und ein angebautes Auge", F.neu, 0],
    ["wuerde mitgestreckt.", F.neu, 0],
    ["", F.neu, 0],
    ["MORGEN: Beide Teile behalten ihre Laenge, die Stange wird nur", F.mass, 700],
    ["VERSCHOBEN. Das kostet kein zusaetzliches Netz — zwei je Zylinder.", F.mass, 700],
  ]) { txt(X + 22, yy, t, { size: 11.5, fill: c, weight: w || 400 }); yy += 16; }
}

// =================================================== TAFEL 4 — DAS RAD
function tafelRad() {
  const X = 1070, Y = 835, BW = 650, BH = 420;
  tafel(X, Y, BW, BH, "4 — DIE REIFEN: nicht das Rad ist schuld, der Einbau ist es",
    "Seitenriss an der Vorderachse. Gemessen an excavator.ts:667/686 und wheelParts.ts.");
  const S4 = 88;
  const radbild = (ox, oy, alt) => {
    const zx = (z) => ox + z * S4, yh = (y) => oy - y * S4;
    line(zx(-0.5), yh(0), zx(2.5), yh(0), { stroke: F.grund, sw: 2 });
    const cx = zx(1.0), cy = yh(RAD_R);
    circ(cx, cy, RAD_R * S4, { fill: F.gummi, stroke: "#0E0F10", sw: 1.2 });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      line(cx + Math.cos(a) * 0.582 * S4, cy + Math.sin(a) * 0.582 * S4,
           cx + Math.cos(a) * 0.62 * S4, cy + Math.sin(a) * 0.62 * S4, { stroke: "#4A4D50", sw: 2.2 });
    }
    circ(cx, cy, 0.4 * S4, { fill: F.gruen, stroke: "#2E6B24", sw: 1 });
    circ(cx, cy, 0.14 * S4, { fill: F.blank, stroke: F.stahl, sw: 1 });
    if (alt) {
      rect(zx(-0.5), yh(1.6), 3.0 * S4, 0.9 * S4, { fill: F.gruen, stroke: "#2E6B24", sw: 1.4, op: 0.9 });
      rect(cx - 0.62 * S4, yh(1.24), 1.24 * S4, 0.54 * S4, { fill: F.rot, stroke: F.rot, sw: 1, op: 0.3 });
      massV(yh(0.7), yh(1.24), cx + 0.95 * S4, "0,54 im Kasten", { farbe: F.rot });
    } else {
      rect(zx(-0.5), yh(1.6), 3.0 * S4, 0.36 * S4, { fill: F.gruen, stroke: "#2E6B24", sw: 1.4 });
      path(`M ${(cx - 0.74 * S4).toFixed(1)} ${yh(1.24).toFixed(1)} A ${(0.74 * S4).toFixed(1)} ${(0.74 * S4).toFixed(1)} 0 0 1 ${(cx + 0.74 * S4).toFixed(1)} ${yh(1.24).toFixed(1)}`,
           { stroke: "#2E6B24", sw: 2.2 });
      rect(zx(-0.5), yh(0.77), 1.29 * S4, 0.3 * S4, { fill: F.stahlL, stroke: F.stahl, sw: 1 });
      rect(cx - 0.21 * S4, yh(0.82), 0.42 * S4, 0.4 * S4, { fill: F.stahlL, stroke: F.stahl, sw: 1 });
      massV(yh(1.24), yh(1.6), cx + 0.95 * S4, "Wange", { farbe: F.mass });
      path(`M ${(cx + 0.3 * S4).toFixed(1)} ${(cy - 0.28 * S4).toFixed(1)} a ${(0.41 * S4).toFixed(1)} ${(0.41 * S4).toFixed(1)} 0 1 1 ${(-0.06 * S4).toFixed(1)} ${(-0.38 * S4).toFixed(1)}`,
           { stroke: "#FFF", sw: 2 });
      poly([[cx + 0.16 * S4, cy - 0.72 * S4], [cx + 0.32 * S4, cy - 0.64 * S4], [cx + 0.15 * S4, cy - 0.54 * S4]],
           { fill: "#FFF", stroke: "#FFF", sw: 1 });
    }
    massV(yh(0), yh(1.24), zx(-0.34), "1,24", { rechts: false });
  };
  radbild(X + 62, Y + 248, true);
  radbild(X + 382, Y + 248, false);
  txt(X + 150, Y + 72, "HEUTE", { size: 13, weight: 700, anchor: "middle", fill: F.neu });
  txt(X + 470, Y + 72, "MORGEN", { size: 13, weight: 700, anchor: "middle", fill: F.mass });
  const l1 = [
    "Rahmen y 0,70 – 1,60, Rad y 0,00 – 1,24: die",
    "obersten 54 cm des Rades stecken IM Kasten.",
    "In der Breite ueberschneiden sich Rad (1,00 –",
    "1,50) und Rahmen (bis 1,20) um 20 cm.",
    "Kein Kotfluegel, keine Achse — nichts verbindet",
    "das Rad mit der Maschine. Und es dreht sich nie:",
    "keine Zeile im Quelltext dreht ein Rad.",
  ];
  const l2 = [
    "Die Seitenwange sitzt auf 1,24 auf — genau auf",
    "der Radoberkante. Kein Rad steckt mehr im",
    "Rahmen. Darunter Achsbruecke und Achsschenkel,",
    "darueber der Kotfluegelbogen.",
    "Alle vier Raeder rollen beim Fahren, die",
    "Vorderraeder lenken mit. Radform, Groesse und",
    "der Kollider bleiben unveraendert.",
  ];
  let yy = Y + 302;
  for (let i = 0; i < l1.length; i++) {
    txt(X + 20, yy, l1[i], { size: 11 });
    txt(X + 335, yy, l2[i], { size: 11 });
    yy += 15;
  }
}

// ================================================= TAFEL 5 — DER FAHRER
function tafelFahrer() {
  const X = 1070, Y = 1270, BW = 650, BH = 472;
  tafel(X, Y, BW, BH, "5 — DER FAHRER: warum er nach Spielfigur aussieht",
    "Heute 16 Kapseln und Kugeln, weisses Hemd, Jeans, Kugelkopf, Lederband.");
  const S5 = 112;
  const figur = (cx, cy, neu) => {
    const h = (m) => cy - m * S5;
    if (!neu) {
      circ(cx, h(1.62), 0.115 * S5, { fill: F.haut, stroke: "#B98A68", sw: 1.2 });
      path(`M ${(cx - 0.122 * S5).toFixed(1)} ${h(1.635).toFixed(1)} a ${(0.122 * S5).toFixed(1)} ${(0.116 * S5).toFixed(1)} 0 0 1 ${(0.244 * S5).toFixed(1)} 0 z`,
           { fill: "#6B4A2E", stroke: "#6B4A2E", sw: 1 });
      rect(cx - 0.05 * S5, h(1.5), 0.1 * S5, 0.055 * S5, { fill: F.haut, stroke: "#B98A68", sw: 1 });
      P(`<ellipse cx="${cx}" cy="${h(1.18).toFixed(1)}" rx="${(0.165 * S5).toFixed(1)}" ry="${(0.3 * S5).toFixed(1)}" fill="#F4F3EE" stroke="#C9C8C2" stroke-width="1.2"/>`);
      circ(cx, h(1.4), 0.17 * S5, { fill: "#F4F3EE", stroke: "#C9C8C2", sw: 1.2 });
      for (const s of [-1, 1])
        P(`<ellipse cx="${(cx + s * 0.29 * S5).toFixed(1)}" cy="${h(1.16).toFixed(1)}" rx="${(0.058 * S5).toFixed(1)}" ry="${(0.17 * S5).toFixed(1)}" fill="#F4F3EE" stroke="#C9C8C2" stroke-width="1.1"/>`);
      P(`<ellipse cx="${cx}" cy="${h(0.88).toFixed(1)}" rx="${(0.12 * S5).toFixed(1)}" ry="${(0.12 * S5).toFixed(1)}" fill="#3D4B5C" stroke="#2A3542" stroke-width="1.1"/>`);
      for (const s of [-1, 1]) {
        P(`<ellipse cx="${(cx + s * 0.1 * S5).toFixed(1)}" cy="${h(0.6).toFixed(1)}" rx="${(0.07 * S5).toFixed(1)}" ry="${(0.2 * S5).toFixed(1)}" fill="#3D4B5C" stroke="#2A3542" stroke-width="1.1"/>`);
        circ(cx + s * 0.1 * S5, h(0.28), 0.075 * S5, { fill: "#2A2724", stroke: "#1B1917", sw: 1 });
      }
      circ(cx, h(1.31), 0.075 * S5, { stroke: "#2A2724", sw: 2 });
    } else {
      circ(cx, h(1.62), 0.115 * S5, { fill: F.haut, stroke: "#B98A68", sw: 1.2 });
      path(`M ${(cx - 0.125 * S5).toFixed(1)} ${h(1.645).toFixed(1)} a ${(0.125 * S5).toFixed(1)} ${(0.105 * S5).toFixed(1)} 0 0 1 ${(0.25 * S5).toFixed(1)} 0 z`,
           { fill: "#2F4A5E", stroke: "#22384A", sw: 1 });
      rect(cx + 0.06 * S5, h(1.645), 0.17 * S5, 0.03 * S5, { fill: "#22384A", stroke: "#22384A", sw: 1 });
      rect(cx - 0.05 * S5, h(1.5), 0.1 * S5, 0.055 * S5, { fill: F.haut, stroke: "#B98A68", sw: 1 });
      poly([[cx - 0.205 * S5, h(1.47)], [cx + 0.205 * S5, h(1.47)], [cx + 0.23 * S5, h(1.33)],
            [cx + 0.185 * S5, h(0.92)], [cx - 0.185 * S5, h(0.92)], [cx - 0.23 * S5, h(1.33)]],
           { fill: F.warn, stroke: "#8A4406", sw: 1.2 });
      for (const yv of [1.37, 1.12])
        rect(cx - 0.2 * S5, h(yv), 0.4 * S5, 0.045 * S5, { fill: "#EDEDE6", stroke: "#B9B9B0", sw: 0.8 });
      poly([[cx - 0.07 * S5, h(1.47)], [cx, h(1.39)], [cx + 0.07 * S5, h(1.47)]], { fill: "#8A4406", stroke: "#8A4406", sw: 1 });
      line(cx, h(1.39), cx, h(0.94), { stroke: "#8A4406", sw: 1.2 });
      for (const s of [-1, 1]) {
        poly([[cx + s * 0.2 * S5, h(1.45)], [cx + s * 0.305 * S5, h(1.41)],
              [cx + s * 0.315 * S5, h(1.0)], [cx + s * 0.21 * S5, h(1.02)]],
             { fill: F.warn, stroke: "#8A4406", sw: 1.1 });
        rect(cx + (s > 0 ? 0.215 : -0.315) * S5, h(1.12), 0.1 * S5, 0.04 * S5, { fill: "#EDEDE6", stroke: "#B9B9B0", sw: 0.8 });
      }
      poly([[cx - 0.185 * S5, h(0.92)], [cx + 0.185 * S5, h(0.92)], [cx + 0.175 * S5, h(0.44)],
            [cx + 0.025 * S5, h(0.44)], [cx, h(0.7)], [cx - 0.025 * S5, h(0.44)], [cx - 0.175 * S5, h(0.44)]],
           { fill: "#3D4B5C", stroke: "#2A3542", sw: 1.2 });
      for (const s of [-1, 1]) {
        rect(cx + s * 0.1 * S5 - 0.062 * S5, h(0.44), 0.124 * S5, 0.3 * S5, { fill: "#3D4B5C", stroke: "#2A3542", sw: 1 });
        poly([[cx + s * 0.1 * S5 - 0.07 * S5, h(0.14)], [cx + s * 0.1 * S5 + 0.07 * S5, h(0.14)],
              [cx + s * 0.1 * S5 + 0.09 * S5, h(0.0)], [cx + s * 0.1 * S5 - 0.09 * S5, h(0.0)]],
             { fill: "#2A2724", stroke: "#1B1917", sw: 1 });
      }
    }
  };
  figur(X + 140, Y + 272, false);
  figur(X + 330, Y + 272, true);
  txt(X + 140, Y + 290, "HEUTE — 16 Netze", { size: 12, weight: 700, anchor: "middle", fill: F.neu });
  txt(X + 330, Y + 290, "MORGEN — 2 Netze", { size: 12, weight: 700, anchor: "middle", fill: F.mass });
  let yz = Y + 312;
  for (const [t, w] of [
    ["Warum er nach Spielfigur aussieht:", 700],
    ["1. Alles ist Kapsel oder Kugel — keine Kante bricht die Silhouette.", 0],
    ["2. Der Kopf ist eine Kugel mit einer zweiten Kugel als Haar.", 0],
    ["3. Weisses Hemd und Jeans — Freizeitkleidung, keine Arbeitskleidung.", 0],
    ["4. Er bewegt sich nie; nur die Unterarme haengen an den Joysticks.", 0],
    ["", 0],
    ["Die kleinste Aenderung, die das behebt — in dieser Reihenfolge:", 700],
    ["a) Warnjacke in Orange mit zwei Reflexstreifen statt weissem Hemd.", 0],
    ["b) Eckige Schultern und ein Kragen statt einer Kapsel.", 0],
    ["c) Muetze statt Haarkugel, Lederband entfaellt.", 0],
    ["Drei Formen statt sechzehn — und er kostet danach 2 Netze statt 16.", 600],
  ]) { txt(X + 20, yz, t, { size: 11.2, weight: w || 400 }); yz += 14.2; }
}

// ====================================== TAFEL 6 — NETZBILANZ / TEILELISTE
function tafelBilanz() {
  const X = 40, Y = 1410, BW = 1010, BH = 815;
  tafel(X, Y, BW, BH, "6 — TEILE, NETZE, ZEICHENRUFE: heute gegen morgen",
    "Heute gemessen mit tools/baggerteile.ts, morgen aus der Teileliste gezaehlt. Ohne Spinne — die hat ihr eigenes Paket.");

  const sp = [X + 20, X + 300, X + 385, X + 470, X + 560, X + 650, X + 760, X + 870];
  ["Baugruppe", "Teile h.", "Teile m.", "Netze h.", "Netze m.", "Δ Netze", "Dreiecke h.", "Dreiecke m."]
    .forEach((k, i) => txt(sp[i], Y + 78, k, { size: 11.5, weight: 700, anchor: i === 0 ? "start" : "end" }));
  line(X + 20, Y + 84, X + BW - 20, Y + 84, { stroke: F.rahmen, sw: 1 });

  // Teile h. / Netze h. / Dreiecke h. sind GEMESSEN (tools/baggerteile.ts).
  // Teile m. / Netze m. sind aus der Teileliste in docs/baggerkonzept.md
  // ausgezaehlt; Dreiecke m. ist eine Schaetzung nach Bauform.
  const zeilen = [
    ["01 Unterwagen (ohne Schild)", 1, 25, 1, 2, 12, 2600],
    ["01 Raeumschild", 10, 16, 10, 2, 200, 500],
    ["02 Raeder (4 ×, unveraendert)", 32, 32, 12, 12, 5376, 5376],
    ["03 Abstuetzung (4 ×)", 16, 28, 16, 8, 192, 1400],
    ["04 Drehkranz", 1, 4, 1, 0, 12, 900],
    ["05 Oberwagen", 10, 29, 10, 3, 120, 7300],
    ["06 Kabine (Geruest, Glas, Sitz)", 27, 51, 27, 7, 354, 3400],
    ["06 Joysticks + Fahrerarme", 20, 10, 20, 4, 3192, 1900],
    ["06 Fahrer Daniel", 16, 25, 16, 2, 4648, 3700],
    ["07 Ausleger", 5, 23, 5, 5, 592, 1800],
    ["07 Stiel + Greiferhalter", 8, 16, 8, 3, 360, 1500],
    ["07 Hydraulikzylinder", 10, 48, 10, 8, 360, 3600],
    ["08 Kleinteile", 1, 2, 1, 1, 2, 60],
  ];
  let yy = Y + 104;
  const s = [0, 0, 0, 0, 0, 0];
  for (const [n, th, tm, nh, nm, dh, dm] of zeilen) {
    txt(sp[0], yy, n, { size: 11.5 });
    [th, tm, nh, nm].forEach((v, i) => txt(sp[i + 1], yy, String(v), { size: 11.5, anchor: "end" }));
    const d = nm - nh;
    txt(sp[5], yy, d === 0 ? "0" : d > 0 ? `+${d}` : `${d}`,
        { size: 11.5, anchor: "end", weight: 600, fill: d > 0 ? F.neu : d < 0 ? F.mass : F.blass });
    txt(sp[6], yy, dh.toLocaleString("de-DE"), { size: 11.5, anchor: "end" });
    txt(sp[7], yy, dm.toLocaleString("de-DE"), { size: 11.5, anchor: "end", fill: F.blass });
    s[0] += th; s[1] += tm; s[2] += nh; s[3] += nm; s[4] += dh; s[5] += dm;
    yy += 19;
  }
  line(X + 20, yy - 12, X + BW - 20, yy - 12, { stroke: F.rahmen, sw: 1 });
  yy += 6;
  txt(sp[0], yy, "SUMME", { size: 12.5, weight: 700 });
  [s[0], s[1], s[2], s[3]].forEach((v, i) => txt(sp[i + 1], yy, String(v), { size: 12.5, weight: 700, anchor: "end" }));
  txt(sp[5], yy, `${s[3] - s[2]}`, { size: 12.5, weight: 700, anchor: "end", fill: F.mass });
  txt(sp[6], yy, s[4].toLocaleString("de-DE"), { size: 12.5, weight: 700, anchor: "end" });
  txt(sp[7], yy, `~${s[5].toLocaleString("de-DE")}`, { size: 12.5, weight: 700, anchor: "end" });

  yy += 42;
  for (const [a, b2, c, f] of [
    ["Netze", "heute 137", "morgen 57 — also 80 WENIGER statt mehr", F.mass],
    ["Zeichenrufe", "heute rund 194", "morgen rund 82 (jedes Netz mit Schatten zaehlt doppelt)", F.mass],
    ["Dreiecke", "heute 15 420", "morgen rund 34 000 — plus 8 % des Geraetebildes von 240k", F.blass],
    ["Vergleich LKW", "Kipper: 79 Netze, 2 460 Dreiecke", "der Bagger liegt schon heute darueber — falsch VERTEILT, nicht zu wenig", F.neu],
  ]) {
    txt(X + 20, yy, a, { size: 12, weight: 700 });
    txt(X + 140, yy, b2, { size: 12 });
    txt(X + 400, yy, c, { size: 12, fill: f, weight: 600 });
    yy += 20;
  }
  yy += 16;
  for (const t of [
    "DIE REGEL, aus der die ganze Liste folgt — Machart uebernommen aus wheelParts.ts (14.09.2026):",
    "EIN NETZ JE STARRKOERPER UND WERKSTOFF.",
    "Was sich nicht gegeneinander bewegt und dieselbe Farbe hat, wird mit mergeGeometries zu EINER Geometrie",
    "verschmolzen. Dreiecke sind fast gratis, Netze sind teuer: jedes schattenwerfende Netz kostet zwei",
    "Zeichenrufe. Deshalb darf der Ausleger dreissig Einzelteile bekommen, ohne einen einzigen Zeichenruf zu",
    "kosten — und deshalb kostet der Fahrer heute sechzehn Netze fuer eine Figur, die sich nie bewegt.",
  ]) { txt(X + 20, yy, t, { size: 11.5, weight: t.startsWith("EIN NETZ") ? 700 : 400 }); yy += 16; }
  yy += 12;
  txt(X + 20, yy, "UNVERAENDERT, weil der ganze Platz daran haengt:", { size: 11.5, weight: 700, fill: F.rot });
  yy += 16;
  for (const t of [
    "Reichweite (Ausleger 5,20 m, Stiel 4,00 m, Drehpunkt y 2,95 / z 0,55), Schwenkband 5,80 / 9,20 m, groesste",
    "Grabtiefe 2,9995 m, Raddurchmesser 1,24 m, Radstand 3,00 m, Unterwagen-Kollider 2,4 × 1,5 × 4,4 m,",
    "Augpunkt der Kabinenkamera bei y 3,28 (Kabine unten) — siehe Frage 3 in docs/baggerkonzept.md.",
  ]) { txt(X + 20, yy, t, { size: 11.5 }); yy += 16; }
}

// ================================================ TAFEL 7 — TEILENUMMERN
function tafelLegende() {
  const X = 1070, Y = 1757, BW = 650, BH = 468;
  tafel(X, Y, BW, BH, "7 — DIE NUMMERN IN DER ZEICHNUNG",
    "Gleiche Nummerierung wie die Bauteilnamen im Quelltext (test/baggerteile.test.ts).");
  const eintraege = [
    ["01.1", "Hauptrahmen mit Seitenwangen"],
    ["01.2", "Achsbruecke vorn und hinten"],
    ["01.3", "Achsschenkel — lenkt mit"],
    ["01.4", "Kotfluegel ueber jedem Rad"],
    ["01.5", "Aufstieg: drei Stufen, Handlauf"],
    ["01.6", "Kraftstofftank, Werkzeugkasten"],
    ["01.9", "Raeumschild mit Schneide"],
    ["02", "Rad: Reifen, Felge, Nabe"],
    ["03", "Pratze: Kasten, Stempel, Teller"],
    ["04", "Drehkranz mit Zahnkranz"],
    ["05.1", "Oberwagenrahmen, Laufblech"],
    ["05.3", "Gegengewicht, gegossen"],
    ["05.4", "Umlaufendes Gelaender"],
    ["05.5", "Auspuff mit Regenkappe"],
    ["06.1", "Kabinenhub: Parallelogramm"],
    ["06.3", "Kabinengeruest, Tuer, Spiegel"],
    ["06.4", "Verglasung (ein Netz)"],
    ["06.10", "Fahrer Daniel in Warnjacke"],
    ["07.1", "Auslegerkasten mit Rippen"],
    ["07.3", "Schlauchpaket mit Schellen"],
    ["07.6", "Stielkasten"],
    ["07.7", "Greiferhalter am Stielende"],
    ["07.9", "Hubzylinder (2 ×)"],
    ["07.10", "Stielzylinder"],
  ];
  let yy = Y + 76, sp2 = 0;
  for (const [n, t] of eintraege) {
    const cx = X + 26 + sp2 * 318;
    circ(cx, yy - 4, 11, { fill: "#FFF", stroke: F.rot, sw: 1.1 });
    txt(cx, yy, n, { size: n.length > 4 ? 8.5 : 9.5, weight: 600, fill: F.rot, anchor: "middle" });
    txt(cx + 18, yy, t, { size: 11 });
    yy += 17.5;
    if (sp2 === 0 && yy > Y + 76 + 11 * 17.5) { sp2 = 1; yy = Y + 76; }
  }
  txt(X + 20, Y + BH - 92, "Nicht in diesem Konzept: die Spinne, der Fuenfschalengreifer (E-009, E-013) und", { size: 11.5, fill: F.blass });
  txt(X + 20, Y + BH - 76, "das Kardangelenk darueber. Die haben ihr eigenes Paket und ihre eigene Liste.", { size: 11.5, fill: F.blass });
  txt(X + 20, Y + BH - 46, "Vorbild: SENNEBOGEN 840 E — Mobilbagger, Vierpunkt-Abstuetzung, hochfahrbare", { size: 11.5 });
  txt(X + 20, Y + BH - 30, "Kabine, Zweiteiler-Ausleger. Uebernommen ist die FORM, nicht das Datenblatt:", { size: 11.5 });
  txt(X + 20, Y + BH - 14, "unsere Maschine langt 9,2 m weit, eine echte 840 E deutlich weiter.", { size: 11.5, weight: 700 });
}

// ------------------------------------------------------------------ Blatt
P(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
P(`<rect width="${W}" height="${H}" fill="${F.blatt}"/>`);
txt(40, 52, "BAGGERKONZEPT — Umschlagbagger nach Vorbild SENNEBOGEN 840 E", { size: 26, weight: 700 });
txt(40, 78, "Rust'n'Reibach v1 · 14.09.2026 · Entwurf zum Abnicken am Bild — noch nicht gebaut (E-016: erst zeichnen, dann bauen)", { size: 13, fill: F.blass });
txt(40, 100, "Alle Masse in Metern, am Bestand gemessen. Reichweite, Gelenkpunkte und Grabtiefe bleiben unveraendert.", { size: 13, fill: F.rot });
line(40, 114, W - 40, 114, { stroke: F.rahmen, sw: 1.4 });

seitenansicht();
draufsicht();
tafelZylinder();
tafelRad();
tafelFahrer();
tafelBilanz();
tafelLegende();
P(`</svg>`);

writeFileSync(new URL("../docs/baggerkonzept-2026-09-14.svg", import.meta.url), out.join("\n"));
console.log("geschrieben: docs/baggerkonzept-2026-09-14.svg");
