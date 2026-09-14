/**
 * Welche Kralle haengt an einem tiefen Zapfen statt an einem breiten Ring?
 *
 * Herkunft: Kopie von `prototype/tools/zapfen-abtastung.ts` des Zweigs
 * wip/zapfen (Commit 0b2bfa4, 14.09.2026). Mit diesem Werkzeug wurden die Werte
 * in `src/excavator/clawGeometry.ts` gesucht: Zapfenradius 0,40 m, acht
 * Segmente, „zu" bei Spreizung 0,5495. Kopiert statt verwiesen — wip/zapfen
 * aendert `prototype/` und wird darum weder gemergt noch gepickt (Regel 1).
 *
 * Es tastet NUR die Krallenform ab (Zapfenradius, Segmentzahl, Kruemmung),
 * nicht die Zylinderanlenkung.
 *
 * Lauf: `npx tsx tools/zapfen-abtastung.ts` — steht ausserhalb von `src` und
 * wird darum von `npm run build` nicht mitgeprueft.
 */
const L = 0.26;
function spitze(R: number, s: number, n: number, B: number): { r: number; y: number } {
  let y = 0, z = 0;
  for (let i = 0; i < n; i++) { const th = -s + i * B; y -= L * Math.cos(th); z -= L * Math.sin(th); }
  return { r: R + z, y };
}
/** Spreizung, bei der die Spitzen von innen kommend die Achse treffen. */
function zuBei(R: number, n: number, B: number): number | null {
  let vorher = spitze(R, 0, n, B).r;
  for (let s = 0.001; s <= 1.6; s += 0.001) {
    const r = spitze(R, s, n, B).r;
    if (vorher < 0 && r >= 0) return s;
    vorher = r;
  }
  return null;
}
console.log("Zapfen Segm Kruemm  zu bei  OFFEN: Weite  Tiefe   ZU: Tiefe  Korb(Weite x Tiefe)");
for (const R of [0.25, 0.30, 0.40]) {
  for (const [n, B] of [[6,0.22],[7,0.22],[8,0.22],[7,0.26],[8,0.26],[9,0.24]] as Array<[number,number]>) {
    const zu = zuBei(R, n, B);
    if (zu === null) continue;
    const offen = Math.min(zu + 1.25, 1.55);
    const o = spitze(R, offen, n, B), z = spitze(R, zu, n, B);
    console.log(`  ${R.toFixed(2)}   ${n}   ${B.toFixed(2)}   ${zu.toFixed(2)}     ${(2*Math.abs(o.r)).toFixed(2)} m   ${(-o.y).toFixed(2)} m    ${(-z.y).toFixed(2)} m     ${(2*Math.abs(o.r)).toFixed(1)} x ${(-z.y).toFixed(1)}`);
  }
}
console.log("\nHeute: Ring 0,757 · 6 Segm · 0,22 · zu bei 0,00 · offen 3,38 m/1,11 m · zu 1,24 m tief");
