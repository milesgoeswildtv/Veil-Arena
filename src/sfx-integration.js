const VEIL_SFX_CORE_TAG = '<script src="/sfx/veil-sfx-core.js"></script>';
const VEIL_TELEGRAM_MUSIC_TAG = '<script src="/sfx/veil-telegram-music.js"></script>';

export function injectVeilSfx(html) {
  if (typeof html !== "string" || !html) return html;
  const tags = [];
  if (!html.includes('/sfx/veil-sfx-core.js')) tags.push(VEIL_SFX_CORE_TAG);
  if (!html.includes('/sfx/veil-telegram-music.js')) tags.push(VEIL_TELEGRAM_MUSIC_TAG);
  if (!tags.length) return html;
  return html.includes("</head>") ? html.replace("</head>", `${tags.join("\n")}\n</head>`) : html;
}
