import { telegramFxMiniAppHtml } from "./telegram-fx-app.js";
import { applyTelegramFeaturePack } from "./telegram-feature-pack.js";
import { applyTelegramPrizePack } from "./telegram-prize-pack.js";
import { applyTelegramProductPass } from "./telegram-product-pass.js";
import { injectVeilSfx } from "./sfx-integration.js";
import { applyTelegramVisualEditorAdapter } from "./telegram-visual-editor-adapter.js";

export function buildTelegramMiniAppHtml() {
  const baseHtml = telegramFxMiniAppHtml();
  const featureHtml = applyTelegramFeaturePack(baseHtml);
  const sponsorHtml = applyTelegramPrizePack(featureHtml);
  const audioHtml = injectVeilSfx(sponsorHtml);
  const productHtml = applyTelegramProductPass(audioHtml);
  return applyTelegramVisualEditorAdapter(productHtml);
}
