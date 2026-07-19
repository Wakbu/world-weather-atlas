import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const script = readFileSync("script.js", "utf8");
const css = readFileSync("styles.css", "utf8");
const worker = readFileSync("service-worker.js", "utf8");

for (const id of ["hazardPanel", "precipTimeline", "activityGrid", "moonPhase", "dataTrustDetails", "alertRain", "atmosphereMap", "officialAlertPanel", "backgroundAlertStatus", "mobileMoreButton", "mobileMoreMenu", "locationMetaToggle", "locationMetaPanel"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
}

for (const fn of ["renderHazards", "renderPrecipTimeline", "renderActivities", "renderAstronomy", "renderDataTrust", "renderOfficialAlerts", "saveAlertRules", "updateBackgroundAlertStatus"]) {
  assert.match(script, new RegExp(`function ${fn}\\(`), `missing ${fn}`);
}

assert.match(css, /@media\s*\(max-width:\s*720px\)/, "mobile breakpoint missing");
assert.match(css, /prefers-reduced-motion/, "reduced-motion support missing");
assert.equal((css.match(/html\[data-theme="dark"\]\{/g) || []).length, 1, "dark theme rules must not be duplicated");
assert.equal((css.match(/@media\(max-width:720px\)/g) || []).length, 1, "mobile rules must not be duplicated");
assert.match(worker, /cache: "no-store"/, "service worker must check the network for current assets");
assert.match(script, /L\.imageOverlay/, "continuous raster renderer missing");
assert.doesNotMatch(script, /L\.rectangle/, "block grid renderer must not return");
assert.doesNotMatch(html, /leaflet\.heat/, "radial heatmap dependency must not return");

const htmlVersion = html.match(/script\.js\?v=([\w-]+)/)?.[1];
assert.ok(htmlVersion, "script cache version missing");
assert.match(worker, new RegExp(`script\\.js\\?v=${htmlVersion}`), "service worker cache version differs");

console.log("World Weather Atlas smoke checks passed");
