const CACHE_NAME = "world-weather-atlas-v8";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260715-8",
  "./script.js?v=20260715-8",
  "./manifest.webmanifest?v=20260715-8",
  "./assets/advice-rain.png?v=20260715-8",
  "./assets/advice-sun.png?v=20260715-8",
  "./assets/advice-cold.png?v=20260715-8",
  "./assets/advice-heat.png?v=20260715-8",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return event.request.mode === "navigate" ? caches.match("./index.html") : Response.error();
      }))
  );
});
