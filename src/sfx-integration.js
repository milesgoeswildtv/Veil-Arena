const VEIL_SFX_TAGS = `
<script src="/sfx/veil-sfx-audio-1.js"></script>
<script src="/sfx/veil-sfx-audio-2.js"></script>
<script src="/sfx/veil-sfx-audio-3.js"></script>
<script src="/sfx/veil-sfx-audio-4.js"></script>
<script src="/sfx/veil-sfx-core.js"></script>`;

export function injectVeilSfx(html) {
  if (typeof html !== "string" || !html || html.includes('/sfx/veil-sfx-core.js')) return html;
  return html.includes("</head>") ? html.replace("</head>", `${VEIL_SFX_TAGS}\n</head>`) : html;
}
