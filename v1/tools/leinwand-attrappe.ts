/**
 * Ein `document` mit genau einer Faehigkeit: `createElement("canvas")`.
 *
 * Der Bagger baut in der Kabine ein Bordinstrument (`instruments.ts`), und das
 * zeichnet auf eine Leinwand. Ohne Browser gibt es die nicht, und damit liesse
 * sich der Bagger ausserhalb des Spiels gar nicht erst bauen — weder messen
 * noch in einem Test pruefen.
 *
 * Die Attrappe nimmt alle Zeichenbefehle entgegen und verwirft sie. Sie ist
 * ausdruecklich KEIN Renderer: Wer ein Bild braucht, nimmt einen echten
 * Canvas. Sie existiert nur, damit der Aufbau durchlaeuft.
 */
export function leinwandAttrappe(): void {
  if (typeof (globalThis as Record<string, unknown>).document !== "undefined") return;

  const nichts = (): void => {};
  const ctx = new Proxy(
    { canvas: null as unknown, measureText: () => ({ width: 0 }) },
    {
      get(ziel: Record<string, unknown>, feld: string) {
        if (feld in ziel) return ziel[feld];
        return nichts;
      },
      set(ziel: Record<string, unknown>, feld: string, wert: unknown) {
        ziel[feld] = wert;
        return true;
      },
    }
  );

  (globalThis as Record<string, unknown>).document = {
    createElement(tag: string) {
      if (tag !== "canvas") throw new Error(`Attrappe kann nur canvas, nicht ${tag}`);
      const leinwand = {
        width: 0,
        height: 0,
        style: {},
        getContext: () => ctx,
        // three liest das beim Hochladen der Textur; ohne Renderer passiert nichts
        toDataURL: () => "",
        addEventListener: nichts,
        removeEventListener: nichts,
      };
      (ctx as unknown as { canvas: unknown }).canvas = leinwand;
      return leinwand;
    },
  };
}
