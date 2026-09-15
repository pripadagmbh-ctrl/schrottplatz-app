/**
 * Druckt die Einsortierung, nach der der Umbau später arbeitet.
 *
 *     npx vite-node tools/stahlschrott-liste.ts          # Übersicht
 *     npx vite-node tools/stahlschrott-liste.ts alle     # jede Zeile
 *     npx vite-node tools/stahlschrott-liste.ts md       # Markdown für docs/
 */
import { alleUrteile, type Urteil } from "./stahlschrott";

const urteile = alleUrteile();
const modus = process.argv[2] ?? "";

const name = (u: Urteil) => u.spec.name ?? `(namenlos, ${u.spec.materialId})`;
const z = (n: number, k = 0) => n.toLocaleString("de-DE", { maximumFractionDigits: k, minimumFractionDigits: k });

const vorherStahl = urteile.filter((u) => u.vorher === "steel");
const jetztStahl = urteile.filter((u) => u.jetzt === "steel");
const wechsel = urteile.filter((u) => u.vorher !== u.jetzt);

if (modus === "alle" || modus === "md") {
  const zeilen = [...urteile].sort((a, b) => b.wand - a.wand);
  if (modus === "md") {
    console.log("| Stück | kg | Maße (m) | Wandstärke | Hüllwichte | Fremd | vorher | jetzt | Grund |");
    console.log("|---|---:|---|---:|---:|---:|---|---|---|");
    for (const u of zeilen) {
      console.log(
        `| ${name(u)} | ${z(u.spec.massKg)} | ${u.spec.dims.map((d) => z(d, 2)).join(" × ")} (${u.spec.kind}) | ${z(u.wand, 1)} mm | ${z(u.wichte)} | ${z(u.fremd * 100)} % | ${u.vorher} | ${u.jetzt} | ${u.grund} |`
      );
    }
  } else {
    for (const u of zeilen) {
      console.log(
        `${u.vorher === u.jetzt ? "  " : "->"} ${z(u.wand, 1).padStart(6)} mm ${z(u.wichte).padStart(5)} kg/m³  ${u.vorher.padEnd(8)}→ ${u.jetzt.padEnd(8)} ${u.grund.padEnd(10)} ${name(u)}`
      );
    }
  }
}


if (modus === "graubereich") {
  // Was die Regel NICHT sicher entscheiden kann: alles dicht an der Schwelle.
  // Wer den Umbau macht, sieht hier, wo er von Hand hinschauen muss.
  const g = urteile
    .filter((u) => u.spec.materialId === "steel" && u.wand >= 4.5 && u.wand < 8)
    .sort((a, b) => b.wand - a.wand);
  console.log(`Graubereich 4,5-8,0 mm: ${g.length} Stuecke`);
  for (const u of g) console.log(`  ${z(u.wand, 1).padStart(5)} mm  ${u.jetzt.padEnd(6)} ${name(u)}`);

  const rauf = urteile.filter((u) => u.vorher !== "steel" && u.jetzt === "steel");
  console.log("");
  console.log(`Mischschrott -> Stahlschrott: ${rauf.length} (${rauf.map(name).join(", ") || "keine"})`);

  const band = urteile.filter((u) => u.spec.zusammensetzung?.length && 1 - u.fremd >= 0.9 && 1 - u.fremd < 0.95);
  console.log(
    `Stuecklisten zwischen 90 % und 95 % Leitstoff: ${band.length} ` +
      `(die gewinnt die weichere Verbundschwelle hinzu)`
  );

  const ohne = urteile.filter((u) => !u.spec.zusammensetzung?.length);
  console.log(`Ohne Stueckliste: ${ohne.length} von ${urteile.length} — fuer die entscheiden nur Masse und Mass.`);
}


if (modus === "271") {
  // Dieselbe Rechnung auf dem Ausschnitt, den `docs/fraktionen.md` vermessen
  // hat: nur die exportierten Listen. Damit sind die Zahlen vergleichbar.
  const teil = urteile.filter((u) => u.liste !== "BIG_SPECS" && u.liste !== "HUGE_SPECS");
  const h = teil.filter((u) => u.vorher === "steel");
  const n = teil.filter((u) => u.jetzt === "steel");
  console.log(`Ausschnitt wie docs/fraktionen.md: ${teil.length} Eintraege`);
  console.log(`  Stahlschrott vorher ${h.length}, jetzt ${n.length}, es wechseln ${teil.filter((u) => u.vorher !== u.jetzt).length}`);
}


if (modus === "masse") {
  // Frage 15.09.2026 (Patrick): "Dicke Uebersee-Container haben auch viel
  // Masse, auch wenn es duennes Blech ist. Drum Stahl." Gibt es eine
  // Massenschwelle, ab der Duennwandiges trotzdem Premium ist?
  const duenn = urteile
    .filter((u) => u.grund === "duennwandig")
    .sort((a, b) => b.spec.massKg - a.spec.massKg);
  console.log(`Duennwandig und stahlgefuehrt: ${duenn.length} Stuecke, nach Masse:`);
  for (const u of duenn.slice(0, 40))
    console.log(
      `  ${z(u.spec.massKg).padStart(5)} kg  ${z(u.wand, 1).padStart(5)} mm  ` +
        `${(u.spec.bau ?? "-").padEnd(14)} ${name(u)}`
    );
}


if (modus === "brocken") {
  // Dieselbe Frage, aber nur fuer Stuecke, die die Verbundschwelle bestehen —
  // ein schwerer Verbund ist kein Premium, das bleibt.
  const kandidaten = urteile
    .filter((u) => u.grund === "duennwandig" && u.fremd <= 0.1 + 1e-9)
    .sort((a, b) => b.spec.massKg - a.spec.massKg);
  console.log(`Duennwandig, stahlgefuehrt, kein Verbund: ${kandidaten.length} Stuecke`);
  for (const u of kandidaten.slice(0, 30))
    console.log(
      `  ${z(u.spec.massKg).padStart(5)} kg  ${z(u.wand, 1).padStart(5)} mm  ` +
        `${(u.spec.bau ?? "-").padEnd(14)} ${name(u)}`
    );
}

const nachGrund = new Map<string, number>();
for (const u of urteile) nachGrund.set(u.grund, (nachGrund.get(u.grund) ?? 0) + 1);

console.log("");
console.log(`Einträge gesamt:            ${urteile.length}`);
console.log(`Stahlschrott vorher:           ${vorherStahl.length}`);
console.log(`Stahlschrott jetzt:         ${jetztStahl.length}`);
console.log(`wechselt die Mulde:         ${wechsel.length}`);
console.log("");
for (const [g, n] of [...nachGrund].sort((a, b) => b[1] - a[1])) console.log(`  ${g.padEnd(12)} ${n}`);

// Was an Masse umzieht — das ist die Zahl fürs Geld.
const kgVorher = vorherStahl.reduce((s, u) => s + u.spec.massKg, 0);
const kgJetzt = jetztStahl.reduce((s, u) => s + u.spec.massKg, 0);
console.log("");
console.log(`Masse Stahlschrott vorher:     ${z(kgVorher)} kg über ${vorherStahl.length} Stücke`);
console.log(`Masse Stahlschrott jetzt:      ${z(kgJetzt)} kg über ${jetztStahl.length} Stücke`);
