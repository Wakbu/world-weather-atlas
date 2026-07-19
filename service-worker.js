const CACHE_NAME = "world-weather-atlas-v23";
const ALERT_CACHE = "world-weather-atlas-alert-config";
const ALERT_CONFIG_URL = new URL("./__alert-config__", self.registration.scope).toString();
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260719-23",
  "./script.js?v=20260719-23",
  "./manifest.webmanifest?v=20260719-23",
  "./assets/advice-rain.png?v=20260719-23",
  "./assets/advice-sun.png?v=20260719-23",
  "./assets/advice-cold.png?v=20260719-23",
  "./assets/advice-heat.png?v=20260719-23",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== ALERT_CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return event.request.mode === "navigate" ? caches.match("./index.html") : Response.error();
      }))
  );
});

async function saveAlertConfig(config) {
  const cache = await caches.open(ALERT_CACHE);
  await cache.put(ALERT_CONFIG_URL, new Response(JSON.stringify({ ...config, savedAt: Date.now() }), { headers: { "Content-Type": "application/json" } }));
}

async function readAlertConfig() {
  const response = await caches.match(ALERT_CONFIG_URL);
  return response ? response.json() : null;
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SAVE_ALERT_CONFIG" && event.data.config) event.waitUntil(saveAlertConfig(event.data.config));
});

function weatherTimestamp(value, offsetSeconds) {
  return Date.parse(value + "Z") - Number(offsetSeconds || 0) * 1000;
}

async function checkWeatherAlerts() {
  const config = await readAlertConfig();
  if (!config?.place || !config.rules) return;
  if (config.lastNotifiedAt && Date.now() - config.lastNotifiedAt < 6 * 60 * 60 * 1000) return;
  const place = config.place;
  const base = new URL("https://api.open-meteo.com/v1/forecast");
  base.searchParams.set("latitude", place.latitude);
  base.searchParams.set("longitude", place.longitude);
  base.searchParams.set("timezone", "auto");
  base.searchParams.set("forecast_days", "2");
  base.searchParams.set("hourly", "weather_code,precipitation_probability");
  base.searchParams.set("daily", "temperature_2m_max");
  const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airUrl.searchParams.set("latitude", place.latitude);
  airUrl.searchParams.set("longitude", place.longitude);
  airUrl.searchParams.set("timezone", "auto");
  airUrl.searchParams.set("current", "us_aqi");

  const [forecast, air] = await Promise.all([
    fetch(base).then((response) => { if (!response.ok) throw new Error("forecast"); return response.json(); }),
    fetch(airUrl).then((response) => response.ok ? response.json() : null).catch(() => null),
  ]);
  const start = Math.max(0, forecast.hourly.time.findIndex((time) => weatherTimestamp(time, forecast.utc_offset_seconds) >= Date.now()));
  const codes = forecast.hourly.weather_code.slice(start, start + 12).map(Number);
  const rain = forecast.hourly.precipitation_probability.slice(start, start + 12).some((value) => Number(value) >= 60);
  const messages = [];
  const korean = config.language !== "en";
  if (config.rules.rain && rain) messages.push(korean ? "12시간 이내 비 가능성" : "Rain possible within 12 hours");
  if (config.rules.snow && codes.some((code) => code >= 71 && code <= 86)) messages.push(korean ? "눈 또는 결빙 가능성" : "Snow or ice possible");
  if (config.rules.heat && Number(forecast.daily.temperature_2m_max?.[0]) >= 33) messages.push(korean ? "오늘 폭염 위험" : "Heat risk today");
  if (config.rules.air && Number(air?.current?.us_aqi) >= 151) messages.push(korean ? "대기질 건강 주의" : "Unhealthy air quality");
  if (!messages.length) return;

  await self.registration.showNotification("World Weather Atlas", {
    body: (place.shortName || place.name) + " · " + messages.join(" · "),
    icon: "./assets/icon-192.png",
    badge: "./assets/icon-192.png",
    tag: "weather-alert-" + place.id,
  });
  await saveAlertConfig({ ...config, lastNotifiedAt: Date.now() });
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "weather-alert-check") event.waitUntil(checkWeatherAlerts());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("./"));
});