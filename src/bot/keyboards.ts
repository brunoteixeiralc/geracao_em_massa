import { InlineKeyboard } from "grammy";
import { TEMPLATES } from "../templates/templates.js";

export function templateKeyboard() {
  const keyboard = new InlineKeyboard();

  for (const template of TEMPLATES) {
    keyboard.text(template.name, `template:${template.id}`).row();
  }

  keyboard.text("Cancelar lote", "batch:cancel");

  return keyboard;
}

export function receivingKeyboard() {
  return new InlineKeyboard().text("Finalizar envio", "batch:settings").row().text("Cancelar lote", "batch:cancel");
}

export function settingsKeyboard() {
  return new InlineKeyboard()
    .text("Zoom -", "settings:zoom:-5")
    .text("Zoom +", "settings:zoom:5")
    .row()
    .text("Vel -", "settings:speed:-0.1")
    .text("Vel +", "settings:speed:0.1")
    .row()
    .text("Inicio -", "settings:trim_start:-0.1")
    .text("Inicio +", "settings:trim_start:0.1")
    .row()
    .text("Fim -", "settings:trim_end:-0.1")
    .text("Fim +", "settings:trim_end:0.1")
    .row()
    .text("Espelhar on/off", "settings:mirror")
    .row()
    .text("Corte auto on/off", "settings:auto_cut")
    .row()
    .text("Antidup on/off", "settings:antiduplication")
    .row()
    .text("CTA on/off", "settings:cta")
    .row()
    .text("Marca on/off", "settings:watermark")
    .row()
    .text("Processar lote", "batch:process")
    .row()
    .text("Cancelar lote", "batch:cancel");
}
