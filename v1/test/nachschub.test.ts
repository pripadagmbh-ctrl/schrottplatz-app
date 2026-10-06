import { describe, it, expect } from "vitest";
import { NACHSCHUB_FOLGE, NACHSCHUB_MELDUNG, profilFuer } from "../src/delivery/nachschub";
import { rollCustomer } from "../src/delivery/customers";

/*
 * NACHSCHUB im Sandkasten (E-118): Kipper, Pritsche, Wrack reihum, mit einem
 * Profil, dessen Ladung zum Fahrzeug passt.
 */
describe("Nachschub", () => {
  it("reihum Kipper, Pritsche, Wrack", () => {
    expect([...NACHSCHUB_FOLGE]).toEqual(["kipper", "pritsche", "wrack"]);
  });

  it("das Profil hat das verlangte Fahrzeug — 50 Mal je Art", () => {
    for (const art of NACHSCHUB_FOLGE) {
      for (let i = 0; i < 50; i++) expect(profilFuer(art).vehicle).toBe(art);
    }
  });

  it("die Meldung nennt das Fahrzeug, keinen Kunden", () => {
    for (const art of NACHSCHUB_FOLGE) expect(NACHSCHUB_MELDUNG[art]).toMatch(/^Nachschub: /);
  });

  it("GEGENPROBE: passt nie eins, kommt trotzdem eine Fuhre — und die Suche endet", () => {
    let wuerfe = 0;
    const nurPkw = () => {
      wuerfe++;
      return { ...rollCustomer(), vehicle: "pkw" as const };
    };
    expect(profilFuer("wrack", nurPkw).vehicle).toBe("pkw");
    expect(wuerfe).toBe(200);
  });
});
