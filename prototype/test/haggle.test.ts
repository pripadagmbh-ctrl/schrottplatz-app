import { describe, it, expect } from "vitest";
import { haggle, leavesOnRefusal, OFFER_FACTOR, type Offer } from "../src/economy/haggle";
import type { CustomerProfile, CustomerGroup } from "../src/delivery/customers";

function kunde(group: CustomerGroup, hardness = 3): CustomerProfile {
  return {
    group,
    name: "Test",
    subtitle: "Test",
    massKg: 1000,
    sortedMaterial: null,
    contaminantShare: 0.1,
    hardness,
    greeting: "Moin.",
  };
}

/** Gemischte Ware — dort ist der meiste Spielraum. */
const GEMISCHT = 0.45;
/** Sortenrein — klarer Marktwert, kaum zu drücken */
const REIN = 1;

describe("Verhandeln", () => {
  it("nimmt den Marktpreis immer an", () => {
    for (const g of ["privat", "haendler", "gewerbe"] as CustomerGroup[]) {
      const r = haggle(kunde(g, 5), "markt", REIN);
      expect(r.accepted, g).toBe(true);
      expect(r.factor).toBe(1);
      expect(r.offense).toBe(0);
    }
  });

  it("lässt sich bei Privatleuten am weitesten drücken", () => {
    const privat = haggle(kunde("privat"), "hart", GEMISCHT);
    const haendler = haggle(kunde("haendler"), "hart", GEMISCHT);
    expect(privat.accepted, "Privat kennt die Preise nicht").toBe(true);
    expect(haendler.accepted, "Händler kontert").toBe(false);
  });

  it("lässt Gewerbe nur ein kleines Entgegenkommen zu", () => {
    // Im echten Profil hat Gewerbe Härte 2: sachlich, wenig Spielraum
    expect(haggle(kunde("gewerbe", 2), "hart", GEMISCHT).accepted, "hart nicht").toBe(false);
    expect(haggle(kunde("gewerbe", 2), "leicht", GEMISCHT).accepted, "leicht schon").toBe(true);
  });

  it("macht harte Händler schwieriger als umgängliche", () => {
    const weich = haggle(kunde("haendler", 1), "leicht", GEMISCHT);
    const hart = haggle(kunde("haendler", 5), "leicht", GEMISCHT);
    expect(weich.accepted, "Härte 1 lässt mit sich reden").toBe(true);
    expect(hart.accepted, "Härte 5 nicht").toBe(false);
  });

  it("lässt sortenreine Ware schlechter drücken als gemischte", () => {
    const gemischt = haggle(kunde("haendler", 2), "leicht", GEMISCHT);
    const rein = haggle(kunde("haendler", 2), "leicht", REIN);
    expect(gemischt.accepted, "bei Mischschrott ist Spielraum").toBe(true);
    expect(rein.accepted, "sortenrein hat einen klaren Marktwert").toBe(false);
  });

  it("verschafft guter Ruf zusätzlichen Spielraum", () => {
    // Bei einem harten Händler entscheidet der Ruf über Ja und Nein
    const ohne = haggle(kunde("haendler", 5), "leicht", GEMISCHT, 0);
    const mit = haggle(kunde("haendler", 5), "leicht", GEMISCHT, 1);
    expect(ohne.accepted).toBe(false);
    expect(mit.accepted, "wer einen Namen hat, darf mehr").toBe(true);
  });

  it("zahlt bei Ablehnung den Marktpreis, nicht das Angebot", () => {
    const r = haggle(kunde("haendler", 5), "hart", REIN);
    expect(r.accepted).toBe(false);
    expect(r.factor, "keine Einigung heißt kein Abschlag").toBe(1);
  });

  it("merkt sich Drücken auch dann, wenn es angenommen wurde", () => {
    const r = haggle(kunde("privat"), "hart", GEMISCHT);
    expect(r.accepted).toBe(true);
    expect(r.offense, "das bleibt in Erinnerung").toBeGreaterThan(0);
  });

  it("lässt nur Händler bei Ablehnung wieder abfahren", () => {
    expect(leavesOnRefusal(kunde("haendler"))).toBe(true);
    expect(leavesOnRefusal(kunde("privat"))).toBe(false);
    expect(leavesOnRefusal(kunde("gewerbe"))).toBe(false);
  });

  it("staffelt die Angebote absteigend", () => {
    const f = (o: Offer): number => OFFER_FACTOR[o];
    expect(f("markt")).toBeGreaterThan(f("leicht"));
    expect(f("leicht")).toBeGreaterThan(f("hart"));
    expect(f("hart"), "auch hart bleibt ein Angebot, kein Raub").toBeGreaterThan(0.5);
  });

  it("gibt zu jedem Ausgang eine Antwort", () => {
    for (const g of ["privat", "haendler", "gewerbe"] as CustomerGroup[]) {
      for (const o of ["markt", "leicht", "hart"] as Offer[]) {
        expect(haggle(kunde(g, 5), o, GEMISCHT).reply.length).toBeGreaterThan(4);
      }
    }
  });
});
