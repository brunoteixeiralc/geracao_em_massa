import { describe, expect, it } from "vitest";
import { settingsKeyboard, templateKeyboard } from "../../src/bot/keyboards.js";

describe("templateKeyboard", () => {
  it("lists real file-backed templates as Telegram buttons", () => {
    const buttons = flattenInlineButtons(templateKeyboard().inline_keyboard);

    expect(buttons).toEqual(
      expect.arrayContaining([{ text: "Humor Cachorro", callback_data: "template:humor-cachorro" }])
    );
  });
});

describe("settingsKeyboard", () => {
  it("exposes every global batch setting before processing", () => {
    const buttons = flattenInlineButtons(settingsKeyboard().inline_keyboard);

    expect(buttons).toEqual(
      expect.arrayContaining([
        { text: "Zoom -", callback_data: "settings:zoom:-5" },
        { text: "Zoom +", callback_data: "settings:zoom:5" },
        { text: "Vel -", callback_data: "settings:speed:-0.1" },
        { text: "Vel +", callback_data: "settings:speed:0.1" },
        { text: "Inicio -", callback_data: "settings:trim_start:-0.1" },
        { text: "Inicio +", callback_data: "settings:trim_start:0.1" },
        { text: "Fim -", callback_data: "settings:trim_end:-0.1" },
        { text: "Fim +", callback_data: "settings:trim_end:0.1" },
        { text: "Espelhar on/off", callback_data: "settings:mirror" },
        { text: "Corte auto on/off", callback_data: "settings:auto_cut" },
        { text: "Antidup on/off", callback_data: "settings:antiduplication" },
        { text: "CTA on/off", callback_data: "settings:cta" },
        { text: "Marca on/off", callback_data: "settings:watermark" },
        { text: "Processar lote", callback_data: "batch:process" },
        { text: "Cancelar lote", callback_data: "batch:cancel" }
      ])
    );
  });
});

function flattenInlineButtons(rows: Array<Array<{ text: string; callback_data?: string }>>) {
  return rows.flat().map((button) => ({ text: button.text, callback_data: button.callback_data }));
}
