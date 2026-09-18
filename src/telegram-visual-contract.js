export const TELEGRAM_VISUAL_PROJECT_ID = "veil-arena";

export const TELEGRAM_VISUAL_DEFAULT_MANIFEST = Object.freeze({
  schemaVersion: 1,
  projectId: TELEGRAM_VISUAL_PROJECT_ID,
  name: "Veil Arena",
  kind: "game-ui",
  revision: 0,
  updatedAt: "2026-09-18T00:00:00Z",
  breakpoints: {
    desktop: { width: 1180 },
    tablet: { width: 760 },
    mobile: { width: 390 }
  },
  slots: {
    "arena.header": {
      label: "Arena Header",
      layout: { desktop: { gap: 8 }, tablet: { gap: 8 }, mobile: { gap: 6 } },
      style: { desktop: { opacity: 1 }, tablet: { opacity: 1 }, mobile: { opacity: 1 } },
      asset: null
    },
    "arena.stats": {
      label: "Round / Players / Alive",
      layout: { desktop: { gap: 5 }, tablet: { gap: 5 }, mobile: { gap: 5 } },
      style: { desktop: { opacity: 1 }, tablet: { opacity: 1 }, mobile: { opacity: 1 } },
      asset: null
    },
    "arena.eventPlate": {
      label: "Current Round Events",
      layout: { desktop: { padding: 15, gap: 0 }, tablet: { padding: 10, gap: 0 }, mobile: { padding: 10, gap: 0 } },
      style: {
        desktop: { opacity: 1, color: "#f4eef8", fontSize: 11, lineHeight: 1.38 },
        tablet: { opacity: 1, color: "#f4eef8", fontSize: 11, lineHeight: 1.38 },
        mobile: { opacity: 1, color: "#f4eef8", fontSize: 11, lineHeight: 1.38 }
      },
      asset: "/telegram/NewEventBackgroundPlate.PNG"
    },
    "arena.viewerState": {
      label: "Viewer State",
      layout: {
        desktop: { width: 520, minHeight: 72 },
        tablet: { width: 520, minHeight: 72 },
        mobile: { width: 520, minHeight: 72 }
      },
      style: { desktop: { opacity: 1 }, tablet: { opacity: 1 }, mobile: { opacity: 1 } },
      asset: null
    },
    "arena.roster": {
      label: "Player Roster",
      layout: { desktop: { gap: 8 }, tablet: { gap: 7 }, mobile: { gap: 7 } },
      style: { desktop: { opacity: 1 }, tablet: { opacity: 1 }, mobile: { opacity: 1 } },
      asset: null
    },
    "arena.sponsor": {
      label: "Sponsor Panel",
      layout: {
        desktop: { gap: 14, minHeight: 150 },
        tablet: { gap: 14, minHeight: 132 },
        mobile: { gap: 10, minHeight: 118 }
      },
      style: { desktop: { opacity: 1 }, tablet: { opacity: 1 }, mobile: { opacity: 1 } },
      asset: "/telegram/veil_ui_sponsor_panel.svg"
    },
    "arena.results": {
      label: "Results",
      layout: { desktop: { padding: 50 }, tablet: { padding: 40 }, mobile: { padding: 34 } },
      style: { desktop: { opacity: 1 }, tablet: { opacity: 1 }, mobile: { opacity: 1 } },
      asset: null
    }
  }
});

export const TELEGRAM_VISUAL_CAPABILITIES = Object.freeze({
  "arena.header": Object.freeze({ layout: ["gap"], style: ["opacity"], asset: false }),
  "arena.stats": Object.freeze({ layout: ["gap"], style: ["opacity"], asset: false }),
  "arena.eventPlate": Object.freeze({ layout: ["padding", "gap"], style: ["opacity", "color", "fontSize", "lineHeight"], asset: true }),
  "arena.viewerState": Object.freeze({ layout: ["width", "minHeight"], style: ["opacity"], asset: false }),
  "arena.roster": Object.freeze({ layout: ["gap"], style: ["opacity"], asset: false }),
  "arena.sponsor": Object.freeze({ layout: ["gap", "minHeight"], style: ["opacity"], asset: true }),
  "arena.results": Object.freeze({ layout: ["padding"], style: ["opacity"], asset: false })
});

const SAFE_ASSET = /^(?:\/telegram\/[A-Za-z0-9%._()\- ]+|https:\/\/[^\s"'<>]+)$/;

function number(value, fallback, min, max) {
  const next = Number(value);
  return Number.isFinite(next) && next >= min && next <= max ? next : fallback;
}

function text(value, fallback, max = 120) {
  const next = String(value ?? "").trim();
  return next && next.length <= max && !/[{}<>;]/.test(next) ? next : fallback;
}

function slotValue(manifest, slotId, group, breakpoint, key, fallback) {
  const slot = manifest?.slots?.[slotId];
  const direct = slot?.[group]?.[breakpoint]?.[key];
  if (direct !== undefined) return direct;
  const desktop = slot?.[group]?.desktop?.[key];
  return desktop !== undefined ? desktop : fallback;
}

function assetValue(manifest, slotId, fallback) {
  const value = manifest?.slots?.[slotId]?.asset;
  return typeof value === "string" && SAFE_ASSET.test(value) ? value : fallback;
}

function cssUrl(value) {
  return 'url("' + String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '")';
}

export function compileTelegramVisualManifest(manifest = TELEGRAM_VISUAL_DEFAULT_MANIFEST) {
  if (!manifest || manifest.projectId !== TELEGRAM_VISUAL_PROJECT_ID) {
    throw new Error("Wrong visual project manifest");
  }

  const breakpoints = {
    desktop: number(manifest.breakpoints?.desktop?.width, 1180, 240, 3840),
    tablet: number(manifest.breakpoints?.tablet?.width, 760, 240, 3840),
    mobile: number(manifest.breakpoints?.mobile?.width, 390, 240, 3840)
  };

  const defaults = TELEGRAM_VISUAL_DEFAULT_MANIFEST;
  const varsFor = bp => {
    const get = (slot, group, key, fallback) => slotValue(manifest, slot, group, bp, key, fallback);
    return {
      "--av-header-gap": number(get("arena.header", "layout", "gap", 8), 8, 0, 200) + "px",
      "--av-header-opacity": number(get("arena.header", "style", "opacity", 1), 1, 0, 1),
      "--av-stats-gap": number(get("arena.stats", "layout", "gap", 5), 5, 0, 200) + "px",
      "--av-stats-opacity": number(get("arena.stats", "style", "opacity", 1), 1, 0, 1),
      "--av-event-padding": number(get("arena.eventPlate", "layout", "padding", bp === "desktop" ? 15 : 10), bp === "desktop" ? 15 : 10, 0, 300) + "px",
      "--av-event-gap": number(get("arena.eventPlate", "layout", "gap", 0), 0, 0, 200) + "px",
      "--av-event-opacity": number(get("arena.eventPlate", "style", "opacity", 1), 1, 0, 1),
      "--av-event-color": text(get("arena.eventPlate", "style", "color", "#f4eef8"), "#f4eef8", 64),
      "--av-event-font-size": number(get("arena.eventPlate", "style", "fontSize", 11), 11, 6, 72) + "px",
      "--av-event-line-height": number(get("arena.eventPlate", "style", "lineHeight", 1.38), 1.38, 0.7, 4),
      "--av-viewer-width": number(get("arena.viewerState", "layout", "width", 520), 520, 120, 1600) + "px",
      "--av-viewer-min-height": number(get("arena.viewerState", "layout", "minHeight", 72), 72, 0, 1000) + "px",
      "--av-viewer-opacity": number(get("arena.viewerState", "style", "opacity", 1), 1, 0, 1),
      "--av-roster-gap": number(get("arena.roster", "layout", "gap", bp === "desktop" ? 8 : 7), bp === "desktop" ? 8 : 7, 0, 200) + "px",
      "--av-roster-opacity": number(get("arena.roster", "style", "opacity", 1), 1, 0, 1),
      "--av-sponsor-gap": number(get("arena.sponsor", "layout", "gap", bp === "mobile" ? 10 : 14), bp === "mobile" ? 10 : 14, 0, 200) + "px",
      "--av-sponsor-min-height": number(get("arena.sponsor", "layout", "minHeight", bp === "desktop" ? 150 : bp === "tablet" ? 132 : 118), bp === "desktop" ? 150 : bp === "tablet" ? 132 : 118, 0, 1000) + "px",
      "--av-sponsor-opacity": number(get("arena.sponsor", "style", "opacity", 1), 1, 0, 1),
      "--av-results-padding": number(get("arena.results", "layout", "padding", bp === "desktop" ? 50 : bp === "tablet" ? 40 : 34), bp === "desktop" ? 50 : bp === "tablet" ? 40 : 34, 0, 300) + "px",
      "--av-results-opacity": number(get("arena.results", "style", "opacity", 1), 1, 0, 1)
    };
  };

  const block = vars => Object.entries(vars).map(([key, value]) => key + ":" + value + ";").join("");
  const desktop = varsFor("desktop");
  const tablet = varsFor("tablet");
  const mobile = varsFor("mobile");
  const css = [
    ":root{" + block(desktop) + "--av-sponsor-asset:" + cssUrl(assetValue(manifest, "arena.sponsor", defaults.slots["arena.sponsor"].asset)) + ";}",
    "@media(max-width:" + breakpoints.tablet + "px){:root{" + block(tablet) + "}}",
    "@media(max-width:" + breakpoints.mobile + "px){:root{" + block(mobile) + "}}"
  ].join("\n");

  return {
    css,
    assets: {
      eventPlate: assetValue(manifest, "arena.eventPlate", defaults.slots["arena.eventPlate"].asset),
      sponsor: assetValue(manifest, "arena.sponsor", defaults.slots["arena.sponsor"].asset)
    },
    capabilities: TELEGRAM_VISUAL_CAPABILITIES
  };
}
