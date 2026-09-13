/** Spitzenweite und groesste Weite ueber den Oeffnungswinkel. */
import { mittellinie, SCHALEN_ABSCHNITTE } from "../src/grapple/teile";
console.log(" Winkel   Spitzenweite   groesste Weite");
for (let g = 40; g <= 75; g += 2.5) {
  const b = mittellinie((g * Math.PI) / 180);
  const spitze = 2 * b[SCHALEN_ABSCHNITTE]!.r;
  const weit = 2 * Math.max(...b.map((p) => p.r));
  const tief = -Math.min(...b.map((p) => p.y));
  console.log(
    `  ${g.toFixed(1).padStart(5)}°    ${spitze.toFixed(2)} m        ${weit.toFixed(2)} m    (Bauhoehe ${tief.toFixed(2)} m)`
  );
}
