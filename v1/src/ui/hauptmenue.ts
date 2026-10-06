/**
 * DAS HAUPTMENÜ (E-118) — zwei Spielarten: SANDKASTEN und CHALLENGES.
 *
 * Es steht VOR dem Aufbau der Welt: `main.ts` wartet auf die Wahl und baut
 * erst dann den Platz. So kann eine Challenge (Etappe 3) ihren eigenen Platz
 * bekommen, ohne dass ein schon gebauter Platz wieder abgeräumt werden muss.
 *
 * Für Etappe 3 vorgesehen, aber hier bewusst NICHT gebaut: Die Challenges
 * kommen als Knöpfe in `#hm-challenges` (auf der Seite schon vorhanden, heute
 * leer), und `Spielwahl` bekommt eine zweite Form, etwa
 * `{ art: "challenge"; id: string }`. Das Menü selbst bleibt, wie es ist.
 */
export type Spielwahl = { art: "sandkasten" };

/** Menü zeigen und auf die Wahl warten. */
export function waehleSpielart(): Promise<Spielwahl> {
  const el = document.getElementById("hauptmenue")!;
  el.classList.add("open");
  return new Promise((fertig) => {
    document.getElementById("hm-sandkasten")!.addEventListener(
      "click",
      () => {
        el.classList.remove("open");
        fertig({ art: "sandkasten" });
      },
      { once: true }
    );
  });
}
