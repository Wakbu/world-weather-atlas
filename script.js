const API = {
  geocode: "https://geocoding-api.open-meteo.com/v1/search",
  forecast: "https://api.open-meteo.com/v1/forecast",
  archive: "https://archive-api.open-meteo.com/v1/archive",
  radar: "https://api.rainviewer.com/public/weather-maps.json",
  air: "https://air-quality-api.open-meteo.com/v1/air-quality",
};

const state = { loading: false, unit: "c", windUnit: "kmh", precipUnit: "mm", pressureUnit: "hpa", language: "ko", colorSafe: false, places: [], selectedPlace: null, weather: null, airQuality: null, favorites: [], recentPlaces: [], compareIds: [], alertRules: {}, dataMeta: null, mapPoint: { latitude: 37.5665, longitude: 126.9780 }, lastRefreshAt: 0, refreshTimer: null, radarMetadata: null, activeTab: "overview", notificationEnabled: false, lastRainNotice: "", weatherLayer: "radar" };
let weatherMap;
let mapMarker;
let rainRadarMap;
let rainRadarLayer;
let rainRadarMarker;
let atmosphereMap;
let atmosphereDataLayer;
let atmosphereRadarLayer;
let atmosphereMarker;
let atmosphereMoveTimer;
let atmosphereLoadId = 0;
const $ = (selector) => document.querySelector(selector);

const elements = {
  form: $("#searchForm"), input: $("#cityInput"), geoButton: $("#geoButton"), unitButton: $("#unitButton"), favoriteButton: $("#favoriteButton"), favoriteButtonLabel: $("#favoriteButtonLabel"), favoriteQuickList: $("#favoriteQuickList"), favoriteHelp: $("#favoriteHelp"), resetButton: $("#resetButton"), notifyButton: $("#notifyButton"), settingsButton: $("#settingsButton"), settingsPanel: $("#settingsPanel"), installButton: $("#installButton"), languageSelect: $("#languageSelect"), windUnitSelect: $("#windUnitSelect"), precipUnitSelect: $("#precipUnitSelect"), pressureUnitSelect: $("#pressureUnitSelect"), refreshButton: $("#refreshButton"), refreshStatus: $("#refreshStatus"), themeButton: $("#themeButton"), themeIcon: $("#themeIcon"), offlineBanner: $("#offlineBanner"), toast: $("#toast"),
  resultStatus: $("#resultStatus"), resultList: $("#resultList"), placeName: $("#placeName"), dateRange: $("#dateRange"),
  latitude: $("#latitude"), longitude: $("#longitude"), timezone: $("#timezone"), elevation: $("#elevation"),
  currentSummary: $("#currentSummary"), currentTemp: $("#currentTemp"), currentTime: $("#currentTime"), weatherIcon: $("#weatherIcon"),
  apparentTemp: $("#apparentTemp"), humidity: $("#humidity"), precipitation: $("#precipitation"), windSpeed: $("#windSpeed"), pressure: $("#pressure"), cloudCover: $("#cloudCover"),
  hourlyList: $("#hourlyList"), pastList: $("#pastList"), futureList: $("#futureList"),
  sunrise: $("#sunrise"), sunset: $("#sunset"), daylight: $("#daylight"), uvIndex: $("#uvIndex"), visibility: $("#visibility"), weeklySummary: $("#weeklySummary"),
  adviceVisual: $("#adviceVisual"), adviceTitle: $("#adviceTitle"), adviceText: $("#adviceText"), adviceMeta: $("#adviceMeta"), rainRadarSection: $("#rainRadarSection"), rainRadarMap: $("#rainRadarMap"), radarTime: $("#radarTime"), airQualityStatus: $("#airQualityStatus"), airQualityIndex: $("#airQualityIndex"), airQualityLevel: $("#airQualityLevel"), pm25: $("#pm25"), pm10: $("#pm10"), ozone: $("#ozone"), nitrogenDioxide: $("#nitrogenDioxide"),
  mapCoordinates: $("#mapCoordinates"), mapPlaceLabel: $("#mapPlaceLabel"), mapApplyButton: $("#mapApplyButton"), presetList: $("#presetList"), favoriteList: $("#favoriteList"), recentList: $("#recentList"), compareSelector: $("#compareSelector"), compareGrid: $("#compareGrid"), compareStatus: $("#compareStatus"), weeklyChart: $("#weeklyChart"), historyChart: $("#historyChart"), historySummary: $("#historySummary"), historyRangeForm: $("#historyRangeForm"), historyStart: $("#historyStart"), historyEnd: $("#historyEnd"), historyRangeStatus: $("#historyRangeStatus"),
  atmosphereMap: $("#atmosphereMap"), atmosphereStatus: $("#atmosphereStatus"), atmosphereLegend: $("#atmosphereLegend"), layerRefreshButton: $("#layerRefreshButton"), layerButtons: document.querySelectorAll("[data-weather-layer]"), hazardPanel: $("#hazardPanel"), hazardTitle: $("#hazardTitle"), hazardList: $("#hazardList"), precipTimeline: $("#precipTimeline"), precipTimelineSummary: $("#precipTimelineSummary"), activityGrid: $("#activityGrid"), moonPhase: $("#moonPhase"), sunProgress: $("#sunProgress"), dataTrustLevel: $("#dataTrustLevel"), dataTrustDetails: $("#dataTrustDetails"), alertPlaceName: $("#alertPlaceName"), alertRain: $("#alertRain"), alertSnow: $("#alertSnow"), alertHeat: $("#alertHeat"), alertAir: $("#alertAir"), saveAlertSettings: $("#saveAlertSettings"), colorSafeToggle: $("#colorSafeToggle"),
  tabs: document.querySelectorAll(".tab-button"), panels: document.querySelectorAll(".tab-panel"),
  resultTemplate: $("#resultTemplate"), hourTemplate: $("#hourTemplate"), dayTemplate: $("#dayTemplate"),
};


function applyTheme(theme, persist = false) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  const isDark = nextTheme === "dark";
  elements.themeIcon.textContent = isDark ? "☀" : "◐";
  elements.themeButton.setAttribute("aria-pressed", String(isDark));
  elements.themeButton.setAttribute("aria-label", isDark ? "라이트 모드로 전환" : "다크 모드로 전환");
  elements.themeButton.title = isDark ? "라이트 모드" : "다크 모드";
  if (persist) {
    try { localStorage.setItem("weather-theme", nextTheme); } catch (error) { /* Storage may be unavailable. */ }
  }
}

applyTheme(document.documentElement.dataset.theme || "light");
const presets = [
  ["서울", 37.5665, 126.9780], ["도쿄", 35.6762, 139.6503], ["뉴욕", 40.7128, -74.0060], ["런던", 51.5072, -0.1276],
  ["파리", 48.8566, 2.3522], ["두바이", 25.2048, 55.2708], ["싱가포르", 1.3521, 103.8198], ["시드니", -33.8688, 151.2093],
];

const weatherCodes = {
  0: ["맑음", "☀"], 1: ["대체로 맑음", "🌤"], 2: ["구름 조금", "⛅"], 3: ["흐림", "☁"],
  45: ["안개", "🌫"], 48: ["서리 낀 안개", "🌫"], 51: ["약한 이슬비", "🌦"], 53: ["이슬비", "🌦"], 55: ["강한 이슬비", "🌧"],
  56: ["어는 이슬비", "🌧"], 57: ["강한 어는 이슬비", "🌧"], 61: ["약한 비", "🌧"], 63: ["비", "🌧"], 65: ["강한 비", "🌧"],
  66: ["어는 비", "🌧"], 67: ["강한 어는 비", "🌧"], 71: ["약한 눈", "🌨"], 73: ["눈", "🌨"], 75: ["강한 눈", "❄"],
  77: ["싸락눈", "🌨"], 80: ["약한 소나기", "🌦"], 81: ["소나기", "🌧"], 82: ["강한 소나기", "⛈"],
  85: ["약한 눈 소나기", "🌨"], 86: ["강한 눈 소나기", "❄"], 95: ["뇌우", "⛈"], 96: ["우박 동반 뇌우", "⛈"], 99: ["강한 우박 동반 뇌우", "⛈"],
};

function setLoading(isLoading) {
  state.loading = isLoading;
  elements.form.querySelector("button").disabled = isLoading;
  elements.geoButton.disabled = isLoading;
  elements.refreshButton.disabled = isLoading;
  elements.unitButton.disabled = isLoading && !state.weather;
  elements.mapApplyButton.disabled = isLoading;
}

function addDays(date, days) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}
const weatherDescriptionsEn = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Heavy freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Heavy freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Light showers", 81: "Showers", 82: "Heavy showers",
  85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe hailstorm",
};

function tr(korean, english) { return state.language === "en" ? english : korean; }
function weatherText(code) {
  const fallback = weatherCodes[code] || ["정보 없음", "·"];
  return [state.language === "en" ? (weatherDescriptionsEn[code] || "Unavailable") : fallback[0], fallback[1]];
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${isoDate}T00:00:00`));
}

function formatTime(value) {
  return new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatHour(value) {
  return new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { weekday: "short", hour: "2-digit" }).format(new Date(value));
}

function displayTemp(value) {
  const celsius = Number(value);
  if (!Number.isFinite(celsius)) return "--";
  return state.unit === "f" ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`;
}

function compactTemp(value) {
  const celsius = Number(value);
  if (!Number.isFinite(celsius)) return "--";
  return state.unit === "f" ? `${Math.round((celsius * 9) / 5 + 32)}°` : `${Math.round(celsius)}°`;
}

function formatDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return "--";
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
}

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "--";
  const hours = Math.floor(value / 3600);
  const minutes = Math.round((value % 3600) / 60);
  return `${hours}시간 ${minutes}분`;
}

function displayWind(value) {
  const kmh = Number(value);
  if (!Number.isFinite(kmh)) return "--";
  if (state.windUnit === "ms") return (kmh / 3.6).toFixed(1) + " m/s";
  if (state.windUnit === "mph") return Math.round(kmh * 0.621371) + " mph";
  return Math.round(kmh) + " km/h";
}

function displayPrecip(value) {
  const mm = Number(value);
  if (!Number.isFinite(mm)) return "--";
  return state.precipUnit === "inch" ? (mm / 25.4).toFixed(2) + " in" : mm.toFixed(1) + " mm";
}

function displayPressure(value) {
  const hpa = Number(value);
  if (!Number.isFinite(hpa)) return "--";
  return state.pressureUnit === "inhg" ? (hpa * 0.02953).toFixed(2) + " inHg" : Math.round(hpa) + " hPa";
}

function buildUrl(base, params) {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, Array.isArray(value) ? value.join(",") : value));
  return url.toString();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`요청 실패: ${response.status}`);
  return response.json();
}

function normalizePlace(place, fallbackName) {
  return {
    id: `${place.latitude},${place.longitude},${place.name || fallbackName}`,
    name: [place.name || fallbackName, place.admin1, place.country].filter(Boolean).join(", "),
    shortName: place.name || fallbackName,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || "auto",
    elevation: place.elevation,
  };
}

async function searchPlaces(query) {
  const data = await fetchJson(buildUrl(API.geocode, { name: query, count: 8, language: state.language, format: "json" }));
  if (!data.results?.length) throw new Error("도시를 찾지 못했습니다.");
  return data.results.map((place) => normalizePlace(place, query));
}

async function fetchAirQuality(place) {
  return fetchJson(buildUrl(API.air, {
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: "auto",
    current: ["us_aqi", "pm10", "pm2_5", "ozone", "nitrogen_dioxide"],
    hourly: ["us_aqi", "pm10", "pm2_5"],
    forecast_days: 3,
  }));
}

async function fetchWeather(place) {
  const now = new Date();
  const shared = { latitude: place.latitude, longitude: place.longitude, timezone: "auto" };
  const forecastUrl = buildUrl(API.forecast, {
    ...shared,
    forecast_days: 8,
    current: ["temperature_2m", "relative_humidity_2m", "apparent_temperature", "precipitation", "weather_code", "wind_speed_10m", "surface_pressure", "cloud_cover", "is_day"],
    hourly: ["temperature_2m", "relative_humidity_2m", "precipitation_probability", "precipitation", "weather_code", "wind_speed_10m", "wind_direction_10m", "surface_pressure", "cloud_cover", "visibility", "uv_index"],
    daily: ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "precipitation_probability_max", "wind_speed_10m_max", "sunrise", "sunset", "daylight_duration", "uv_index_max"],
  });
  const archiveUrl = buildUrl(API.archive, {
    ...shared,
    start_date: toIsoDate(addDays(now, -7)),
    end_date: toIsoDate(addDays(now, -1)),
    daily: ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "wind_speed_10m_max"],
  });
  const [forecast, archive, airQuality] = await Promise.all([
    fetchJson(forecastUrl),
    fetchJson(archiveUrl).catch(() => null),
    fetchAirQuality(place).catch(() => null),
  ]);
  return { forecast, archive, airQuality };
}

async function fetchLatestForecast(place) {
  const url = buildUrl(API.forecast, {
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: "auto",
    forecast_days: 8,
    current: ["temperature_2m", "relative_humidity_2m", "apparent_temperature", "precipitation", "weather_code", "wind_speed_10m", "surface_pressure", "cloud_cover", "is_day"],
    hourly: ["temperature_2m", "relative_humidity_2m", "precipitation_probability", "precipitation", "weather_code", "wind_speed_10m", "wind_direction_10m", "surface_pressure", "cloud_cover", "visibility", "uv_index"],
    daily: ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "precipitation_probability_max", "wind_speed_10m_max", "sunrise", "sunset", "daylight_duration", "uv_index_max"],
  });
  return fetchJson(url);
}
async function fetchHistoryRange(place, startDate, endDate) {
  const url = buildUrl(API.archive, {
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: "auto",
    start_date: startDate,
    end_date: endDate,
    daily: ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "wind_speed_10m_max"],
  });
  return fetchJson(url);
}
function switchTab(tabName) {
  state.activeTab = tabName;
  elements.tabs.forEach((button) => { const active = button.dataset.tab === tabName; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1; });
  elements.panels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tabName}`));
  if (tabName === "location" && weatherMap) setTimeout(() => weatherMap.invalidateSize(), 0);
  if (tabName === "overview" && rainRadarMap) setTimeout(() => rainRadarMap.invalidateSize(), 0);
  if (tabName === "layers") {
    initAtmosphereMap();
    setTimeout(() => atmosphereMap?.invalidateSize(), 0);
    renderAtmosphereLayer(state.weatherLayer);
  }
  if (tabName === "compare") renderCompare();
  updateUrlState();
}

function initializeTabAccessibility() {
  elements.tabs.forEach((button, index) => {
    const panel = document.querySelector("#tab-" + button.dataset.tab);
    button.id = "weather-tab-" + button.dataset.tab;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", panel.id);
    button.setAttribute("aria-selected", String(button.classList.contains("active")));
    button.tabIndex = button.classList.contains("active") ? 0 : -1;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", button.id);
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const last = elements.tabs.length - 1;
      const next = event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowRight" ? (index + 1) % elements.tabs.length : (index - 1 + elements.tabs.length) % elements.tabs.length;
      elements.tabs[next].focus();
      switchTab(elements.tabs[next].dataset.tab);
    });
  });
}
function setMapPoint(latitude, longitude, moveView = false, place = null) {
  state.mapPoint = { latitude, longitude, place };
  elements.mapCoordinates.textContent = latitude.toFixed(4) + ", " + longitude.toFixed(4);
  elements.mapPlaceLabel.textContent = place?.shortName || place?.name || tr("핀으로 선택한 위치", "Pinned location");
  if (mapMarker) mapMarker.setLatLng([latitude, longitude]);
  if (moveView && weatherMap) weatherMap.setView([latitude, longitude], Math.max(weatherMap.getZoom(), 7));
}

function initMap() {
  if (!window.L) {
    elements.mapCoordinates.textContent = "지도를 불러오지 못했습니다.";
    elements.mapApplyButton.disabled = true;
    return;
  }
  weatherMap = L.map("weatherMap", { worldCopyJump: true, scrollWheelZoom: false }).setView([37.5665, 126.978], 3);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(weatherMap);
  mapMarker = L.marker([37.5665, 126.978], { draggable: true }).addTo(weatherMap);
  weatherMap.on("click", ({ latlng }) => setMapPoint(latlng.lat, latlng.lng));
  mapMarker.on("dragend", () => {
    const point = mapMarker.getLatLng();
    setMapPoint(point.lat, point.lng);
  });
}
function renderPresets() {
  elements.presetList.replaceChildren();
  presets.forEach(([name, latitude, longitude]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-button";
    button.textContent = name;
    button.addEventListener("click", () => { setMapPoint(latitude, longitude, true); loadByCoordinates(latitude, longitude, name); switchTab("overview"); });
    elements.presetList.append(button);
  });
}

function renderResults() {
  elements.resultList.replaceChildren();
  elements.resultStatus.textContent = `${state.places.length}개 후보 중 선택`;
  state.places.forEach((place) => {
    const card = elements.resultTemplate.content.firstElementChild.cloneNode(true);
    card.classList.toggle("active", state.selectedPlace?.id === place.id);
    card.querySelector(".result-name").textContent = place.name;
    card.querySelector(".result-detail").textContent = `${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)} · ${place.timezone}`;
    card.querySelector(".result-action").textContent = state.selectedPlace?.id === place.id ? "선택됨" : "선택";
    card.addEventListener("click", () => { loadPlace(place); switchTab("overview"); });
    elements.resultList.append(card);
  });
}

function renderCurrent(current) {
  const [summary, icon] = weatherText(current.weather_code);
  elements.currentSummary.textContent = `${summary} · ${current.is_day ? "낮" : "밤"}`;
  elements.weatherIcon.textContent = icon;
  elements.currentTemp.textContent = compactTemp(current.temperature_2m);
  elements.currentTime.textContent = `업데이트 ${formatTime(current.time)}`;
  elements.apparentTemp.textContent = displayTemp(current.apparent_temperature);
  elements.humidity.textContent = `${current.relative_humidity_2m}%`;
  elements.precipitation.textContent = displayPrecip(current.precipitation);
  elements.windSpeed.textContent = displayWind(current.wind_speed_10m);
  elements.pressure.textContent = displayPressure(current.surface_pressure);
  elements.cloudCover.textContent = `${current.cloud_cover}%`;
}

const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

function isCurrentlyRaining(current) {
  return rainCodes.has(Number(current.weather_code)) || Number(current.precipitation || 0) > 0.01;
}

function renderAdvice(forecast) {
  const current = forecast.current;
  const daily = forecast.daily;
  const raining = isCurrentlyRaining(current);
  const rainChance = Number(daily.precipitation_probability_max?.[0] || 0);
  const uv = Number(daily.uv_index_max?.[0] || 0);
  const temp = Number(current.temperature_2m);
  const wind = Number(current.wind_speed_10m);
  let advice = { kind: "heat", title: tr("가볍게 나가기 좋은 날씨예요", "Comfortable conditions outside"), text: tr("급격한 변화에 대비해 현재 날씨를 한 번 더 확인하고 외출하세요.", "Check the latest conditions before heading out.") };

  if (raining) {
    advice = { kind: "rain", title: tr("지금 우산이 꼭 필요해요", "Take an umbrella now"), text: tr("현재 비가 내리고 있습니다. 미끄러운 길과 낮아진 시야에도 주의하세요.", "It is raining now. Watch for slippery roads and reduced visibility.") };
  } else if (rainChance >= 60 || Number(daily.precipitation_sum?.[0] || 0) > 1) {
    advice = { kind: "rain", title: tr("오늘은 우산을 챙겨가세요", "Take an umbrella today"), text: tr("지금 비가 오지 않아도 오늘 강수 가능성이 높습니다.", "Rain is likely later even if it is dry right now.") };
  } else if (uv >= 6) {
    advice = { kind: "sun", title: tr("외출 전에 선크림을 바르세요", "Apply sunscreen before going out"), text: tr("자외선이 강합니다. 모자와 선글라스도 도움이 됩니다.", "UV levels are high. A hat and sunglasses can also help.") };
  } else if (temp >= 28) {
    advice = { kind: "heat", title: tr("물병을 챙기고 자주 쉬세요", "Carry water and take breaks"), text: tr("더운 날씨에는 갈증이 나기 전부터 수분을 보충하는 것이 좋습니다.", "Hydrate before you feel thirsty in hot weather.") };
  } else if (temp <= 5) {
    advice = { kind: "cold", title: tr("따뜻한 겉옷을 챙기세요", "Bring a warm outer layer"), text: tr("기온이 낮습니다. 목과 손을 보호할 수 있는 옷차림이 좋습니다.", "Temperatures are low. Protect your neck and hands.") };
  } else if (wind >= 30) {
    advice = { kind: "cold", title: tr("바람을 막을 겉옷이 필요해요", "Wear a wind-resistant layer"), text: tr("바람이 강해 체감온도가 낮아질 수 있습니다.", "Strong winds can make it feel colder.") };
  }

  elements.adviceVisual.dataset.kind = advice.kind;
  elements.adviceTitle.textContent = advice.title;
  elements.adviceText.textContent = advice.text;
  elements.adviceMeta.replaceChildren();
  const rainTime = nextRainWindow(forecast);
  const meta = [[tr("강수확률", "Rain"), rainChance + "%"], ["UV", uv.toFixed(1)], [tr("바람", "Wind"), displayWind(wind)]];
  if (rainTime) meta.unshift([tr("비 예상", "Rain near"), new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(rainTime))]);
  if (!raining) meta.push([tr("레이더", "Radar"), tr("현재 비 없음", "No rain now")]);
  meta.forEach(([label, value]) => {
    const chip = document.createElement("span");
    chip.textContent = label + " " + value;
    elements.adviceMeta.append(chip);
  });
}

function renderAdviceFallback() {
  elements.adviceVisual.dataset.kind = "sun";
  elements.adviceTitle.textContent = tr("날씨 정보를 잠시 불러오지 못했어요", "Weather data is temporarily unavailable");
  elements.adviceText.textContent = tr("연결 상태를 확인한 뒤 새로고침을 눌러주세요. 화면은 10분마다 자동으로 다시 확인합니다.", "Check your connection or refresh. The app retries automatically every 10 minutes.");
  elements.adviceMeta.replaceChildren();
  [tr("데이터 연결 대기", "Waiting for data"), tr("자동 재시도", "Auto retry")].forEach((text) => {
    const chip = document.createElement("span");
    chip.textContent = text;
    elements.adviceMeta.append(chip);
  });
}

function forecastWindow(forecast, hours = 24) {
  const hourly = forecast.hourly;
  const start = Math.max(0, hourly.time.findIndex((time) => new Date(time).getTime() >= Date.now()));
  return { hourly, start, end: Math.min(hourly.time.length, start + hours) };
}

function deriveHazards(forecast, airQuality) {
  const { hourly, start, end } = forecastWindow(forecast);
  const values = (key) => (hourly[key] || []).slice(start, end).map(Number);
  const codes = values("weather_code");
  const rain = values("precipitation");
  const wind = values("wind_speed_10m");
  const maxTemp = Number(forecast.daily.temperature_2m_max?.[0]);
  const minTemp = Number(forecast.daily.temperature_2m_min?.[0]);
  const maxRain = Math.max(0, ...rain);
  const maxWind = Math.max(0, ...wind);
  const aqi = Number(airQuality?.current?.us_aqi);
  const hazards = [];
  if (codes.some((code) => code >= 95)) hazards.push({ level: "danger", text: tr("뇌우 가능성", "Thunderstorm risk") });
  if (maxRain >= 10 || Number(forecast.daily.precipitation_sum?.[0]) >= 30) hazards.push({ level: "danger", text: tr("강한 비 가능성", "Heavy rain risk") });
  else if (maxRain >= 4 || Number(forecast.daily.precipitation_sum?.[0]) >= 10) hazards.push({ level: "warning", text: tr("많은 비 주의", "Rain caution") });
  if (codes.some((code) => code >= 71 && code <= 86)) hazards.push({ level: "warning", text: tr("눈·결빙 주의", "Snow and ice caution") });
  if (maxTemp >= 33) hazards.push({ level: maxTemp >= 36 ? "danger" : "warning", text: tr("폭염 위험", "Heat risk") });
  if (minTemp <= -12) hazards.push({ level: minTemp <= -18 ? "danger" : "warning", text: tr("한파 위험", "Cold risk") });
  if (maxWind >= 50) hazards.push({ level: maxWind >= 70 ? "danger" : "warning", text: tr("강풍 위험", "Strong wind risk") });
  if (aqi >= 151) hazards.push({ level: aqi >= 201 ? "danger" : "warning", text: tr("대기질 건강 주의", "Air quality health risk") });
  return hazards;
}

function renderHazards(forecast, airQuality) {
  const hazards = deriveHazards(forecast, airQuality);
  elements.hazardList.replaceChildren();
  elements.hazardPanel.hidden = hazards.length === 0;
  if (!hazards.length) return;
  elements.hazardTitle.textContent = hazards.some((item) => item.level === "danger") ? tr("외출 전 반드시 확인하세요", "Check before going outside") : tr("오늘 주의할 날씨가 있습니다", "Weather needs attention today");
  hazards.forEach((hazard) => {
    const chip = document.createElement("span");
    chip.className = "hazard-chip " + hazard.level;
    chip.textContent = hazard.text;
    elements.hazardList.append(chip);
  });
}

function renderPrecipTimeline(forecast) {
  const { hourly, start, end } = forecastWindow(forecast);
  elements.precipTimeline.replaceChildren();
  let peakChance = 0;
  let peakTime = null;
  for (let index = start; index < end; index += 1) {
    const chance = Number(hourly.precipitation_probability?.[index] || 0);
    const amount = Number(hourly.precipitation?.[index] || 0);
    if (chance > peakChance) { peakChance = chance; peakTime = hourly.time[index]; }
    const cell = document.createElement("div");
    cell.className = "precip-hour";
    cell.dataset.level = amount >= 4 || chance >= 80 ? "3" : amount >= 1 || chance >= 50 ? "2" : "1";
    cell.setAttribute("aria-label", formatHour(hourly.time[index]) + ", " + tr("강수확률 ", "rain chance ") + chance + "%, " + displayPrecip(amount));
    const value = document.createElement("strong");
    const track = document.createElement("div");
    const bar = document.createElement("i");
    const label = document.createElement("small");
    track.className = "precip-bar-track";
    bar.className = "precip-bar";
    bar.style.height = Math.max(4, chance) + "%";
    value.textContent = chance ? chance + "%" : "";
    label.textContent = index % 3 === start % 3 ? new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { hour: "2-digit" }).format(new Date(hourly.time[index])) : "";
    track.append(bar);
    cell.append(value, track, label);
    elements.precipTimeline.append(cell);
  }
  elements.precipTimelineSummary.textContent = peakTime ? formatHour(peakTime) + " · " + tr("최대 ", "peak ") + peakChance + "%" : tr("강수 가능성 낮음", "Low rain chance");
}

function scoreLabel(score, inverse = false) {
  if (inverse) return score >= 70 ? tr("높음", "High") : score >= 35 ? tr("보통", "Medium") : tr("낮음", "Low");
  return score >= 75 ? tr("좋음", "Good") : score >= 45 ? tr("보통", "Fair") : tr("비추천", "Poor");
}

function renderActivities(forecast, airQuality) {
  const current = forecast.current;
  const rainChance = Number(forecast.daily.precipitation_probability_max?.[0] || 0);
  const uv = Number(forecast.daily.uv_index_max?.[0] || 0);
  const temp = Number(current.apparent_temperature);
  const wind = Number(current.wind_speed_10m);
  const humidity = Number(current.relative_humidity_2m);
  const aqi = Number(airQuality?.current?.us_aqi || 0);
  const comfortPenalty = Math.max(0, Math.abs(temp - 20) - 4) * 4;
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
  const activities = [
    [tr("출퇴근", "Commute"), clamp(100 - rainChance * .55 - wind * .6 - comfortPenalty)],
    [tr("야외 운동", "Exercise"), clamp(100 - rainChance * .7 - wind * .8 - comfortPenalty - Math.max(0, aqi - 50) * .45)],
    [tr("세탁", "Laundry"), clamp(100 - rainChance - humidity * .35 - Number(current.cloud_cover) * .25)],
    [tr("우산 필요", "Umbrella"), clamp(Math.max(rainChance, isCurrentlyRaining(current) ? 100 : 0)), true],
    [tr("자외선 차단", "Sun protection"), clamp(uv * 11), true],
  ];
  elements.activityGrid.replaceChildren();
  activities.forEach(([label, score, inverse = false]) => {
    const row = document.createElement("div");
    row.className = "activity-row";
    row.dataset.score = score >= 75 ? "high" : score >= 45 ? "mid" : "low";
    const name = document.createElement("span");
    const meter = document.createElement("div");
    const fill = document.createElement("i");
    const result = document.createElement("strong");
    name.textContent = label;
    meter.className = "activity-meter";
    meter.setAttribute("role", "progressbar");
    meter.setAttribute("aria-valuemin", "0"); meter.setAttribute("aria-valuemax", "100"); meter.setAttribute("aria-valuenow", String(score));
    fill.style.width = score + "%";
    result.textContent = scoreLabel(score, inverse) + " " + score;
    meter.append(fill); row.append(name, meter, result); elements.activityGrid.append(row);
  });
}

function moonPhaseInfo(date = new Date()) {
  const cycle = 29.53058867;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const age = ((date.getTime() - knownNewMoon) / 86400000 % cycle + cycle) % cycle;
  const phases = [tr("삭", "New moon"), tr("초승달", "Waxing crescent"), tr("상현달", "First quarter"), tr("차오르는 달", "Waxing gibbous"), tr("보름달", "Full moon"), tr("기우는 달", "Waning gibbous"), tr("하현달", "Last quarter"), tr("그믐달", "Waning crescent")];
  return phases[Math.round(age / cycle * 8) % 8] + " · " + tr("주기 ", "day ") + age.toFixed(1);
}

function renderAstronomy(forecast) {
  const sunrise = new Date(forecast.daily.sunrise[0]);
  const sunset = new Date(forecast.daily.sunset[0]);
  const now = new Date();
  elements.moonPhase.textContent = moonPhaseInfo(now);
  if (now < sunrise) elements.sunProgress.textContent = tr("일출 전 · ", "Before sunrise · ") + new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { hour: "2-digit", minute: "2-digit" }).format(sunrise);
  else if (now > sunset) elements.sunProgress.textContent = tr("일몰 후 · 내일 다시", "After sunset · returns tomorrow");
  else elements.sunProgress.textContent = Math.round(((now - sunrise) / (sunset - sunrise)) * 100) + "% · " + tr("일몰 ", "sunset ") + new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { hour: "2-digit", minute: "2-digit" }).format(sunset);
}

function renderDataTrust(weather, dataMeta = state.dataMeta) {
  const currentTime = new Date(weather.forecast.current.time).getTime();
  const ageMinutes = Math.max(0, Math.round((Date.now() - currentTime) / 60000));
  const cached = dataMeta?.kind === "cache";
  const available = [true, Boolean(weather.airQuality?.current), Boolean(weather.archive?.daily)].filter(Boolean).length;
  const high = !cached && ageMinutes <= 120 && available === 3;
  elements.dataTrustLevel.textContent = high ? tr("높음", "High") : cached ? tr("저장 데이터", "Cached") : tr("보통", "Moderate");
  elements.dataTrustDetails.replaceChildren();
  const details = [
    [cached ? tr("로컬 캐시", "Local cache") : tr("실시간 API", "Live API"), cached ? "warn" : "ok"],
    [tr("모델 기준 ", "Model age ") + ageMinutes + tr("분 전", " min"), ageMinutes <= 120 ? "ok" : "warn"],
    [tr("예보 제공", "Forecast available"), "ok"],
    [weather.airQuality?.current ? tr("대기질 제공", "Air quality available") : tr("대기질 누락", "Air quality missing"), weather.airQuality?.current ? "ok" : "warn"],
    [weather.archive?.daily ? tr("과거 자료 제공", "History available") : tr("과거 자료 누락", "History missing"), weather.archive?.daily ? "ok" : "warn"],
  ];
  details.forEach(([text, tone]) => { const chip = document.createElement("span"); chip.className = "trust-chip " + tone; chip.textContent = text; elements.dataTrustDetails.append(chip); });
}

function currentAlertRules() {
  const id = state.selectedPlace?.id;
  return id && state.alertRules[id] ? state.alertRules[id] : { rain: true, snow: true, heat: false, air: false };
}

function renderAlertSettings() {
  if (!state.selectedPlace) return;
  const rules = currentAlertRules();
  elements.alertPlaceName.textContent = state.selectedPlace.shortName || state.selectedPlace.name;
  elements.alertRain.checked = Boolean(rules.rain);
  elements.alertSnow.checked = Boolean(rules.snow);
  elements.alertHeat.checked = Boolean(rules.heat);
  elements.alertAir.checked = Boolean(rules.air);
}

function saveAlertRules() {
  if (!state.selectedPlace) return;
  state.alertRules[state.selectedPlace.id] = { rain: elements.alertRain.checked, snow: elements.alertSnow.checked, heat: elements.alertHeat.checked, air: elements.alertAir.checked };
  writeStorage("weather-alert-rules", state.alertRules);
  showToast(tr("현재 위치의 알림 조건을 저장했습니다.", "Alert rules saved for this location."));
}
async function getRadarMetadata() {
  if (state.radarMetadata && Date.now() - state.radarMetadata.fetchedAt < 300000) return state.radarMetadata.data;
  const data = await fetchJson(API.radar);
  state.radarMetadata = { data, fetchedAt: Date.now() };
  return data;
}

async function renderRainRadar(place, current) {
  if (!isCurrentlyRaining(current) || !window.L) {
    elements.rainRadarSection.hidden = true;
    return;
  }

  elements.rainRadarSection.hidden = false;
  elements.radarTime.textContent = tr("레이더 불러오는 중", "Loading radar");
  try {
    const data = await getRadarMetadata();
    if (state.selectedPlace?.id !== place.id) return;
    const frame = data.radar?.past?.at(-1);
    if (!frame) throw new Error("사용 가능한 레이더가 없습니다.");
    const center = [place.latitude, place.longitude];

    if (!rainRadarMap) {
      rainRadarMap = L.map("rainRadarMap", { worldCopyJump: true }).setView(center, 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap",
      }).addTo(rainRadarMap);
      rainRadarMap.createPane("radarPane");
      rainRadarMap.getPane("radarPane").style.zIndex = 450;
      rainRadarMarker = L.marker(center).addTo(rainRadarMap);
    } else {
      rainRadarMap.setView(center, Math.max(6, rainRadarMap.getZoom()));
      rainRadarMarker.setLatLng(center);
    }

    if (rainRadarLayer) rainRadarLayer.remove();
    const tileUrl = data.host + frame.path + "/256/{z}/{x}/{y}/2/1_1.png";
    rainRadarLayer = L.tileLayer(tileUrl, { pane: "radarPane", opacity: 0.78, maxNativeZoom: 7, maxZoom: 18 });
    rainRadarLayer.addTo(rainRadarMap);
    const radarTime = new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(frame.time * 1000));
    elements.radarTime.textContent = radarTime + " 기준";
    setTimeout(() => rainRadarMap.invalidateSize(), 0);
  } catch (error) {
    elements.radarTime.textContent = tr("레이더 데이터를 불러오지 못했습니다.", "Radar data is unavailable.");
  }
}
function initAtmosphereMap() {
  if (atmosphereMap || !window.L) {
    if (!window.L) elements.atmosphereStatus.textContent = tr("지도를 불러오지 못했습니다.", "The map could not be loaded.");
    return;
  }
  const place = state.selectedPlace || { latitude: 37.5665, longitude: 126.978 };
  atmosphereMap = L.map("atmosphereMap", { worldCopyJump: true, scrollWheelZoom: false }).setView([place.latitude, place.longitude], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(atmosphereMap);
  atmosphereDataLayer = L.layerGroup().addTo(atmosphereMap);
  atmosphereMarker = L.marker([place.latitude, place.longitude]).addTo(atmosphereMap);
  atmosphereMap.on("moveend", () => {
    if (state.activeTab !== "layers" || state.weatherLayer === "radar") return;
    clearTimeout(atmosphereMoveTimer);
    atmosphereMoveTimer = setTimeout(() => renderAtmosphereLayer(state.weatherLayer), 500);
  });
}

function syncAtmosphereMap(place) {
  if (!atmosphereMap) return;
  atmosphereMarker?.setLatLng([place.latitude, place.longitude]);
  if (state.activeTab === "layers") atmosphereMap.setView([place.latitude, place.longitude], Math.max(5, atmosphereMap.getZoom()));
}

function atmosphereGridPoints() {
  const bounds = atmosphereMap.getBounds();
  const center = atmosphereMap.getCenter();
  const south = Math.max(-80, bounds.getSouth());
  const north = Math.min(80, bounds.getNorth());
  let west = bounds.getWest();
  let east = bounds.getEast();
  if (east - west > 300) { west = center.lng - 150; east = center.lng + 150; }
  const normalizeLongitude = (value) => ((value + 540) % 360) - 180;
  const points = [];
  const rows = 6;
  const columns = 8;
  const latitudeStep = (north - south) / rows;
  const longitudeStep = (east - west) / columns;
  for (let row = 0; row < rows; row += 1) {
    const latitude = south + latitudeStep * (row + .5);
    for (let column = 0; column < columns; column += 1) {
      const cellWest = west + longitudeStep * column;
      const cellEast = cellWest + longitudeStep;
      const longitude = normalizeLongitude(cellWest + longitudeStep * .5);
      points.push({
        latitude,
        longitude,
        cellBounds: [[south + latitudeStep * row, cellWest], [south + latitudeStep * (row + 1), cellEast]],
      });
    }
  }
  return points;
}

async function fetchAtmosphereWeather(points) {
  const data = await fetchJson(buildUrl(API.forecast, {
    latitude: points.map((point) => point.latitude),
    longitude: points.map((point) => point.longitude),
    timezone: "auto",
    current: ["cloud_cover", "wind_speed_10m", "wind_direction_10m"],
    forecast_days: 1,
  }));
  return Array.isArray(data) ? data : [data];
}

async function fetchAtmosphereAir(points) {
  const data = await fetchJson(buildUrl(API.air, {
    latitude: points.map((point) => point.latitude),
    longitude: points.map((point) => point.longitude),
    timezone: "auto",
    current: ["pm2_5"],
    forecast_days: 1,
  }));
  return Array.isArray(data) ? data : [data];
}

function cloudColor(value) {
  if (value >= 80) return "#43545d";
  if (value >= 55) return "#738b92";
  if (value >= 30) return "#a8c0c3";
  return "#d8eeee";
}

function pm25Color(value) {
  if (state.colorSafe) {
    if (value <= 15) return "#0072b2";
    if (value <= 35) return "#56b4e9";
    if (value <= 55) return "#f0e442";
    if (value <= 125) return "#e69f00";
    return "#d55e00";
  }
  if (value <= 15) return "#2ca58d";
  if (value <= 35) return "#e0b83f";
  if (value <= 55) return "#e67e35";
  if (value <= 125) return "#c94747";
  return "#754a99";
}

function windColor(value) {
  if (state.colorSafe) return value >= 40 ? "#d55e00" : value >= 25 ? "#e69f00" : value >= 12 ? "#0072b2" : "#009e73";
  if (value >= 40) return "#b63737";
  if (value >= 25) return "#d76825";
  if (value >= 12) return "#1677a3";
  return "#087f72";
}

function setAtmosphereLegend(layer) {
  const content = {
    radar: [tr("비구름 강도", "Rain intensity"), tr("파랑 약함 · 노랑/빨강 강함", "Blue light · yellow/red heavy"), "radar", [tr("약함", "Light"), tr("보통", "Medium"), tr("강함", "Heavy")]],
    cloud: [tr("구름량", "Cloud cover"), tr("부드러운 48셀 분포 · 진할수록 구름 많음", "Smoothed 48-cell field · darker means cloudier"), "cloud", ["0%", "30%", "55%", "80%", "100%"]],
    wind: [tr("바람 흐름", "Wind flow"), tr("화살표 방향 · 아래 배지 풍속", "Arrow direction · speed badge below"), "", []],
    pm25: ["PM2.5", tr("부드러운 48셀 농도 분포", "Smoothed 48-cell concentration field"), "pm25", ["0", "15", "35", "55", "125+"]],
  }[layer];
  elements.atmosphereLegend.replaceChildren();
  const title = document.createElement("strong");
  const description = document.createElement("span");
  title.textContent = content[0];
  description.textContent = content[1];
  elements.atmosphereLegend.append(title, description);
  if (content[2]) {
    const scale = document.createElement("div");
    scale.className = "legend-scale " + content[2];
    elements.atmosphereLegend.append(scale);
  }
  if (content[3].length) {
    const ranges = document.createElement("small");
    ranges.className = "legend-ranges";
    content[3].forEach((label) => { const tick = document.createElement("b"); tick.textContent = label; ranges.append(tick); });
    elements.atmosphereLegend.append(ranges);
  }
}

function atmosphereTimeLabel(value) {
  if (!value) return tr("최신 모델 현재값", "Latest model current value");
  return new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) + tr(" 기준", " model");
}

function renderAtmosphereHeatField(points, data, layer) {
  const size = atmosphereMap.getSize();
  const spacing = Math.max(size.x / 8, size.y / 6);
  const radius = Math.max(34, Math.round(spacing * .78));
  const blur = Math.max(24, Math.round(radius * .72));
  const cloudLayer = layer === "cloud";
  const values = data.map((item) => Number(cloudLayer ? item?.current?.cloud_cover : item?.current?.pm2_5) || 0);
  const heatPoints = points.map((point, index) => {
    const intensity = cloudLayer ? .04 + Math.min(100, values[index]) / 105 : .16 + Math.min(150, values[index]) / 180;
    return [point.latitude, point.longitude, Math.min(1, intensity)];
  });
  const gradient = cloudLayer
    ? { .08: "#edf7f6", .32: "#bed4d5", .58: "#829ba1", .8: "#536970", 1: "#283b43" }
    : state.colorSafe
      ? { .12: "#0072b2", .35: "#56b4e9", .55: "#f0e442", .75: "#e69f00", 1: "#d55e00" }
      : { .12: "#2ca58d", .35: "#8ecf72", .55: "#f0c74b", .75: "#e67e35", 1: "#9f3d68" };

  if (typeof L.heatLayer === "function") {
    L.heatLayer(heatPoints, { radius, blur, max: 1, minOpacity: cloudLayer ? .2 : .34, gradient }).addTo(atmosphereDataLayer);
  } else {
    points.forEach((point, index) => {
      const color = cloudLayer ? cloudColor(values[index]) : pm25Color(values[index]);
      L.circleMarker([point.latitude, point.longitude], { radius: Math.max(22, radius * .55), stroke: false, fillColor: color, fillOpacity: .48 }).addTo(atmosphereDataLayer);
    });
  }

  points.forEach((point, index) => {
    const label = cloudLayer ? tr("구름량 ", "Cloud ") + Math.round(values[index]) + "%" : "PM2.5 " + values[index].toFixed(1) + " μg/m³";
    L.circleMarker([point.latitude, point.longitude], { radius: 18, stroke: false, fillOpacity: 0, opacity: 0, interactive: true })
      .bindTooltip(label)
      .addTo(atmosphereDataLayer);
  });
}
async function renderAtmosphereLayer(layer = state.weatherLayer) {
  initAtmosphereMap();
  if (!atmosphereMap || !atmosphereDataLayer) return;
  state.weatherLayer = layer;
  elements.layerButtons.forEach((button) => button.classList.toggle("active", button.dataset.weatherLayer === layer));
  elements.layerRefreshButton.classList.add("loading");
  elements.atmosphereStatus.textContent = tr("최신 레이어를 불러오는 중입니다.", "Loading the latest layer.");
  setAtmosphereLegend(layer);
  const loadId = ++atmosphereLoadId;
  atmosphereDataLayer.clearLayers();
  if (atmosphereRadarLayer) { atmosphereRadarLayer.remove(); atmosphereRadarLayer = null; }
  try {
    if (layer === "radar") {
      const data = await getRadarMetadata();
      if (loadId !== atmosphereLoadId) return;
      const frame = data.radar?.past?.at(-1);
      if (!frame) throw new Error("No radar frame");
      atmosphereRadarLayer = L.tileLayer(data.host + frame.path + "/256/{z}/{x}/{y}/2/1_1.png", { opacity: .78, maxNativeZoom: 7, maxZoom: 18 }).addTo(atmosphereMap);
      elements.atmosphereStatus.textContent = atmosphereTimeLabel(frame.time * 1000);
      return;
    }

    const points = atmosphereGridPoints();
    const data = layer === "pm25" ? await fetchAtmosphereAir(points) : await fetchAtmosphereWeather(points);
    if (loadId !== atmosphereLoadId) return;
    if (layer === "cloud" || layer === "pm25") {
      renderAtmosphereHeatField(points, data, layer);
    } else {
      data.forEach((item, index) => {
        const point = points[index];
        if (!point || !item?.current) return;
        const speed = Number(item.current.wind_speed_10m || 0);
        const direction = (Number(item.current.wind_direction_10m || 0) + 180) % 360;
        const icon = L.divIcon({ className: "wind-marker", iconSize: [58, 56], iconAnchor: [29, 28], html: '<div class="wind-glyph" style="--wind-direction:' + direction + 'deg;--wind-color:' + windColor(speed) + '"><b aria-hidden="true">&#10148;</b><small>' + displayWind(speed) + '</small></div>' });
        L.marker([point.latitude, point.longitude], { icon }).bindTooltip(tr("풍속 ", "Wind ") + displayWind(speed)).addTo(atmosphereDataLayer);
      });
    }
    elements.atmosphereStatus.textContent = atmosphereTimeLabel(data[0]?.current?.time);
  } catch (error) {
    elements.atmosphereStatus.textContent = tr("레이어 데이터를 불러오지 못했습니다. 다시 시도해 주세요.", "Layer data is unavailable. Please retry.");
  } finally {
    if (loadId === atmosphereLoadId) elements.layerRefreshButton.classList.remove("loading");
  }
}

function renderHourly(hourly) {
  elements.hourlyList.replaceChildren();
  const now = Date.now();
  const foundIndex = hourly.time.findIndex((time) => new Date(time).getTime() >= now);
  const start = Math.max(0, foundIndex);
  const end = Math.min(hourly.time.length, start + 48);
  const times = hourly.time.slice(start, end);
  const temps = hourly.temperature_2m.slice(start, end).map(chartTemp);
  const rain = hourly.precipitation_probability.slice(start, end).map((value) => Number(value || 0));
  const wind = hourly.wind_speed_10m.slice(start, end).map(Number);
  const codes = hourly.weather_code.slice(start, end);
  if (!times.length) return;

  const summary = document.createElement("div");
  summary.className = "hourly-summary";
  const items = [
    ["최고 기온", displayTemp(Math.max(...hourly.temperature_2m.slice(start, end)))],
    ["최저 기온", displayTemp(Math.min(...hourly.temperature_2m.slice(start, end)))],
    ["최대 강수확률", Math.max(...rain) + "%"],
    ["최대 풍속", displayWind(Math.max(...wind))],
  ];
  items.forEach(([label, value]) => {
    const item = document.createElement("div");
    const dt = document.createElement("span");
    const dd = document.createElement("strong");
    dt.textContent = label;
    dd.textContent = value;
    item.append(dt, dd);
    summary.append(item);
  });

  const width = 1240, height = 300, left = 42, right = 20, top = 34, bottom = 48;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const minTemp = Math.floor(Math.min(...temps) - 3), maxTemp = Math.ceil(Math.max(...temps) + 3);
  const range = Math.max(1, maxTemp - minTemp);
  const x = (index) => left + (plotWidth * index) / Math.max(1, times.length - 1);
  const y = (value) => top + ((maxTemp - value) / range) * plotHeight;
  const svg = svgNode("svg", { viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": "기온과 강수 그래프" });
  svg.append(svgNode("line", { x1: left, y1: top, x2: left, y2: top + plotHeight, class: "chart-now-line" }));
  svg.append(svgNode("text", { x: left + 6, y: top + 12, class: "chart-now-label" }, tr("현재", "Now")));

  [0, 0.5, 1].forEach((ratio) => {
    const lineY = top + plotHeight * ratio;
    svg.append(svgNode("line", { x1: left, y1: lineY, x2: width - right, y2: lineY, class: "chart-grid" }));
    svg.append(svgNode("text", { x: left - 8, y: lineY + 4, class: "chart-axis", "text-anchor": "end" }, Math.round(maxTemp - range * ratio) + "°"));
  });

  rain.forEach((value, index) => {
    const barHeight = (value / 100) * (plotHeight * 0.42);
    svg.append(svgNodeWithTitle("rect", { x: x(index) - 7, y: top + plotHeight - barHeight, width: 14, height: barHeight, rx: 3, class: "hour-rain-bar" }, formatHour(times[index]) + " · 강수확률 " + value + "%"));
  });

  svg.append(svgNode("polyline", { points: temps.map((value, index) => x(index) + "," + y(value)).join(" "), class: "hour-temp-line" }));
  times.forEach((time, index) => {
    if (index % 6 !== 0 && index !== times.length - 1) return;
    svg.append(svgNode("circle", { cx: x(index), cy: y(temps[index]), r: 5, class: "hour-temp-dot" }));
    svg.append(svgNode("text", { x: x(index), y: y(temps[index]) - 11, class: "hour-temp-value", "text-anchor": "middle" }, Math.round(temps[index]) + "°"));
    svg.append(svgNode("text", { x: x(index), y: height - 17, class: "chart-day", "text-anchor": "middle" }, formatHour(time)));
  });

  const chartScroll = document.createElement("div");
  chartScroll.className = "hourly-chart-scroll";
  chartScroll.append(svg);

  const timeline = document.createElement("div");
  timeline.className = "weather-timeline";
  for (let index = 0; index < times.length; index += 3) {
    const cell = document.createElement("div");
    const [desc, icon] = weatherText(codes[index]);
    cell.className = "weather-time-cell";
    const time = document.createElement("span");
    const symbol = document.createElement("strong");
    const detail = document.createElement("small");
    time.textContent = formatHour(times[index]);
    symbol.textContent = icon;
    detail.textContent = desc + " · " + compactTemp(hourly.temperature_2m[start + index]) + " · " + rain[index] + "%";
    cell.append(time, symbol, detail);
    timeline.append(cell);
  }

  elements.hourlyList.append(summary, chartScroll, timeline);
}

function renderDaily(container, daily, options = {}) {
  container.replaceChildren();
  const startIndex = options.skipToday ? 1 : 0;
  const endIndex = Math.min(daily.time.length, startIndex + (options.limit || daily.time.length));
  for (let index = startIndex; index < endIndex; index += 1) {
    const row = elements.dayTemplate.content.firstElementChild.cloneNode(true);
    const [desc] = weatherText(daily.weather_code[index]);
    row.querySelector(".day-date").textContent = formatDate(daily.time[index]);
    row.querySelector(".day-desc").textContent = desc;
    row.querySelector(".temp-range").textContent = `${compactTemp(daily.temperature_2m_min[index])} / ${compactTemp(daily.temperature_2m_max[index])}`;
    row.querySelector(".rain").textContent = `${tr("강수", "Rain")} ${displayPrecip(daily.precipitation_sum[index] ?? 0)} · ${tr("바람", "Wind")} ${displayWind(daily.wind_speed_10m_max[index])}`;
    const probability = daily.precipitation_probability_max?.[index];
    row.querySelector(".sun").textContent = Number.isFinite(probability) ? `${tr("최대 강수확률", "Max rain chance")} ${probability}%` : "";
    container.append(row);
  }
}

function chartTemp(value) {
  const celsius = Number(value);
  return state.unit === "f" ? (celsius * 9) / 5 + 32 : celsius;
}

function svgNode(tag, attributes = {}, text = "") {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  if (text) node.textContent = text;
  return node;
}

function svgNodeWithTitle(tag, attributes, titleText) {
  const node = svgNode(tag, attributes);
  node.append(svgNode("title", {}, titleText));
  return node;
}

function renderWeeklyChart(daily) {
  const dates = daily.time.slice(0, 7);
  const highs = daily.temperature_2m_max.slice(0, 7).map(chartTemp);
  const lows = daily.temperature_2m_min.slice(0, 7).map(chartTemp);
  const rain = daily.precipitation_sum.slice(0, 7).map((value) => Number(value || 0));
  const width = 840, height = 330, left = 48, right = 24, top = 36, bottom = 62;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const minTemp = Math.floor(Math.min(...lows) - 3), maxTemp = Math.ceil(Math.max(...highs) + 3);
  const tempRange = Math.max(1, maxTemp - minTemp), maxRain = Math.max(5, ...rain);
  const x = (index) => left + (plotWidth * index) / Math.max(1, dates.length - 1);
  const y = (value) => top + ((maxTemp - value) / tempRange) * plotHeight;
  const svg = svgNode("svg", { viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": "기온과 강수 그래프" });
  svg.append(svgNode("line", { x1: left, y1: top, x2: left, y2: top + plotHeight, class: "chart-now-line" }));
  svg.append(svgNode("text", { x: left + 6, y: top + 12, class: "chart-now-label" }, tr("오늘", "Today")));

  [0, 0.5, 1].forEach((ratio) => {
    const lineY = top + plotHeight * ratio;
    svg.append(svgNode("line", { x1: left, y1: lineY, x2: width - right, y2: lineY, class: "chart-grid" }));
    svg.append(svgNode("text", { x: left - 10, y: lineY + 4, class: "chart-axis", "text-anchor": "end" }, Math.round(maxTemp - tempRange * ratio) + "°"));
  });

  dates.forEach((date, index) => {
    const barHeight = (rain[index] / maxRain) * (plotHeight * 0.35);
    const day = new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { weekday: "short" }).format(new Date(date + "T00:00:00"));
    const barWidth = Math.max(8, Math.min(28, plotWidth / dates.length * 0.55));
    svg.append(svgNodeWithTitle("rect", { x: x(index) - barWidth / 2, y: top + plotHeight - barHeight, width: barWidth, height: barHeight, rx: 4, class: "rain-bar" }, formatDate(date) + " · 강수 " + displayPrecip(rain[index])));
    svg.append(svgNode("text", { x: x(index), y: height - 26, class: "chart-day", "text-anchor": "middle" }, day));
    svg.append(svgNode("text", { x: x(index), y: top + plotHeight - barHeight - 7, class: "chart-rain", "text-anchor": "middle" }, displayPrecip(rain[index])));
  });

  [highs, lows].forEach((values, lineIndex) => {
    const lineClass = lineIndex === 0 ? "temp-line high-line-path" : "temp-line low-line-path";
    svg.append(svgNode("polyline", { points: values.map((value, index) => x(index) + "," + y(value)).join(" "), class: lineClass }));
    values.forEach((value, index) => {
      svg.append(svgNodeWithTitle("circle", { cx: x(index), cy: y(value), r: 5, class: lineIndex === 0 ? "high-dot" : "low-dot" }, formatDate(dates[index]) + " · " + (lineIndex === 0 ? "최고 " : "최저 ") + Math.round(value) + "°"));
      svg.append(svgNode("text", { x: x(index), y: y(value) + (lineIndex === 0 ? -10 : 20), class: "chart-value " + (lineIndex === 0 ? "high" : "low"), "text-anchor": "middle" }, Math.round(value) + "°"));
    });
  });

  const unit = state.unit === "f" ? "°F" : "°C";
  elements.weeklyChart.replaceChildren();
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = '<span><i class="high-line"></i>' + tr('최고 ', 'High ') + unit + '</span><span><i class="low-line"></i>' + tr('최저 ', 'Low ') + unit + '</span><span><i class="rain-key"></i>' + tr('강수 ', 'Rain ') + (state.precipUnit === 'inch' ? 'in' : 'mm') + '</span>';
  elements.weeklyChart.append(legend, svg);
}
function renderHistoryChart(daily) {
  const dates = daily.time;
  const labelStep = Math.max(1, Math.ceil(dates.length / 7));
  const highs = daily.temperature_2m_max.map(chartTemp);
  const lows = daily.temperature_2m_min.map(chartTemp);
  const rain = daily.precipitation_sum.map((value) => Number(value || 0));
  const wind = daily.wind_speed_10m_max.map(Number);
  const width = 840, height = 330, left = 48, right = 24, top = 36, bottom = 62;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const minTemp = Math.floor(Math.min(...lows) - 3), maxTemp = Math.ceil(Math.max(...highs) + 3);
  const tempRange = Math.max(1, maxTemp - minTemp), maxRain = Math.max(5, ...rain);
  const x = (index) => left + (plotWidth * index) / Math.max(1, dates.length - 1);
  const y = (value) => top + ((maxTemp - value) / tempRange) * plotHeight;
  const svg = svgNode("svg", { viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": "기온과 강수 그래프" });
  svg.append(svgNode("line", { x1: width - right, y1: top, x2: width - right, y2: top + plotHeight, class: "chart-now-line" }));
  svg.append(svgNode("text", { x: width - right - 6, y: top + 12, class: "chart-now-label", "text-anchor": "end" }, tr("최신", "Latest")));

  [0, 0.5, 1].forEach((ratio) => {
    const lineY = top + plotHeight * ratio;
    svg.append(svgNode("line", { x1: left, y1: lineY, x2: width - right, y2: lineY, class: "chart-grid" }));
    svg.append(svgNode("text", { x: left - 10, y: lineY + 4, class: "chart-axis", "text-anchor": "end" }, Math.round(maxTemp - tempRange * ratio) + "°"));
  });

  dates.forEach((date, index) => {
    const barHeight = (rain[index] / maxRain) * (plotHeight * 0.35);
    const label = new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { weekday: "short" }).format(new Date(date + "T00:00:00"));
    const barWidth = Math.max(8, Math.min(28, plotWidth / dates.length * 0.55));
    svg.append(svgNodeWithTitle("rect", { x: x(index) - barWidth / 2, y: top + plotHeight - barHeight, width: barWidth, height: barHeight, rx: 4, class: "rain-bar" }, formatDate(date) + " · 강수 " + displayPrecip(rain[index])));
    if (index % labelStep === 0 || index === dates.length - 1) svg.append(svgNode("text", { x: x(index), y: height - 26, class: "chart-day", "text-anchor": "middle" }, label));
    if (index % labelStep === 0 || index === dates.length - 1) svg.append(svgNode("text", { x: x(index), y: top + plotHeight - barHeight - 7, class: "chart-rain", "text-anchor": "middle" }, displayPrecip(rain[index])));
  });

  [highs, lows].forEach((values, lineIndex) => {
    svg.append(svgNode("polyline", { points: values.map((value, index) => x(index) + "," + y(value)).join(" "), class: lineIndex === 0 ? "temp-line high-line-path" : "temp-line low-line-path" }));
    values.forEach((value, index) => {
      svg.append(svgNodeWithTitle("circle", { cx: x(index), cy: y(value), r: 5, class: lineIndex === 0 ? "high-dot" : "low-dot" }, formatDate(dates[index]) + " · " + (lineIndex === 0 ? "최고 " : "최저 ") + Math.round(value) + "°"));
      if (index % labelStep === 0 || index === dates.length - 1) svg.append(svgNode("text", { x: x(index), y: y(value) + (lineIndex === 0 ? -10 : 20), class: "chart-value " + (lineIndex === 0 ? "high" : "low"), "text-anchor": "middle" }, Math.round(value) + "°"));
    });
  });

  elements.historyChart.replaceChildren();
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = '<span><i class="high-line"></i>' + tr('최고', 'High') + '</span><span><i class="low-line"></i>' + tr('최저', 'Low') + '</span><span><i class="rain-key"></i>' + tr('강수 ', 'Rain ') + (state.precipUnit === 'inch' ? 'in' : 'mm') + '</span>';
  elements.historyChart.append(legend, svg);

  const avgHigh = highs.reduce((sum, value) => sum + value, 0) / highs.length;
  const avgLow = lows.reduce((sum, value) => sum + value, 0) / lows.length;
  const totalRain = rain.reduce((sum, value) => sum + value, 0);
  const summaries = [[tr("평균 최고", "Average high"), Math.round(avgHigh) + "°"], [tr("평균 최저", "Average low"), Math.round(avgLow) + "°"], [tr("누적 강수", "Total rain"), displayPrecip(totalRain)], [tr("최대 풍속", "Max wind"), displayWind(Math.max(...wind))]];
  elements.historySummary.replaceChildren();
  summaries.forEach(([label, value]) => {
    const item = document.createElement("div");
    const span = document.createElement("span");
    const strong = document.createElement("strong");
    span.textContent = label;
    strong.textContent = value;
    item.append(span, strong);
    elements.historySummary.append(item);
  });
}
function renderInsights(forecast) {
  const daily = forecast.daily;
  const maxTemps = daily.temperature_2m_max.slice(1, 8).map(Number);
  const minTemps = daily.temperature_2m_min.slice(1, 8).map(Number);
  const rain = daily.precipitation_sum.slice(1, 8).reduce((sum, value) => sum + Number(value || 0), 0);
  const avgMax = maxTemps.reduce((sum, value) => sum + value, 0) / maxTemps.length;
  const avgMin = minTemps.reduce((sum, value) => sum + value, 0) / minTemps.length;
  elements.sunrise.textContent = formatTime(daily.sunrise[0]);
  elements.sunset.textContent = formatTime(daily.sunset[0]);
  elements.daylight.textContent = formatDuration(daily.daylight_duration[0]);
  elements.uvIndex.textContent = Number(daily.uv_index_max[0]).toFixed(1);
  elements.visibility.textContent = formatDistance(forecast.hourly.visibility[0]);
  elements.weeklySummary.textContent = `${tr("평균", "Average")} ${compactTemp(avgMin)} / ${compactTemp(avgMax)}, ${tr("누적 강수", "total rain")} ${displayPrecip(rain)}`;
}

function renderPlace(place, weather, dataMeta = state.dataMeta || { kind: "live", fetchedAt: Date.now() }) {
  state.dataMeta = dataMeta;
  state.selectedPlace = place;
  state.weather = weather;
  state.airQuality = weather.airQuality || null;
  elements.placeName.textContent = place.name;
  const archiveDates = weather.archive?.daily?.time || [];
  elements.dateRange.textContent = archiveDates.length
    ? `${formatDate(archiveDates[0])} - ${formatDate(weather.forecast.daily.time.at(-1))}`
    : `${formatDate(weather.forecast.daily.time[0])} - ${formatDate(weather.forecast.daily.time.at(-1))}`;
  elements.latitude.textContent = place.latitude.toFixed(4);
  elements.longitude.textContent = place.longitude.toFixed(4);
  elements.timezone.textContent = weather.forecast.timezone || place.timezone;
  elements.elevation.textContent = `${Math.round(weather.forecast.elevation ?? place.elevation ?? 0)} m`;
  setMapPoint(place.latitude, place.longitude, true, place);
  renderResults();
  renderCurrent(weather.forecast.current);
  renderAdvice(weather.forecast);
  renderHazards(weather.forecast, weather.airQuality);
  renderPrecipTimeline(weather.forecast);
  renderActivities(weather.forecast, weather.airQuality);
  renderAirQuality(weather.airQuality);
  renderRainRadar(place, weather.forecast.current);
  renderHourly(weather.forecast.hourly);
  renderDaily(elements.futureList, weather.forecast.daily, { skipToday: false, limit: 7 });
  renderWeeklyChart(weather.forecast.daily);
  const yesterday = toIsoDate(addDays(new Date(), -1));
  elements.historyStart.max = yesterday;
  elements.historyEnd.max = yesterday;
  if (archiveDates.length) {
    renderDaily(elements.pastList, weather.archive.daily, { limit: archiveDates.length });
    renderHistoryChart(weather.archive.daily);
    elements.historyStart.value = archiveDates[0];
    elements.historyEnd.value = archiveDates.at(-1);
    elements.historyRangeStatus.textContent = formatDate(archiveDates[0]) + " - " + formatDate(archiveDates.at(-1));
  } else {
    renderDataState(elements.pastList, tr("과거 날씨를 불러오지 못했습니다.", "Historical weather is temporarily unavailable."));
    renderDataState(elements.historyChart, tr("과거 그래프를 표시할 수 없습니다.", "The history chart is unavailable."));
    elements.historyStart.value = toIsoDate(addDays(new Date(), -7));
    elements.historyEnd.value = yesterday;
    elements.historyRangeStatus.textContent = tr("과거 데이터 연결 대기", "Waiting for history data");
  }
  renderInsights(weather.forecast);
  renderAstronomy(weather.forecast);
  renderDataTrust(weather, dataMeta);
  renderAlertSettings();
  updateSky(weather.forecast.current);
  syncAtmosphereMap(place);
  rememberPlace(place);
  updateFavoriteButton();
  updateUrlState();
  scheduleRainNotification(weather.forecast);
  if (state.lastRefreshAt) {
    const refreshed = new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(state.lastRefreshAt));
    elements.refreshStatus.textContent = refreshed + tr(" 갱신 · 10분마다 자동", " updated · every 10 minutes");
  }
}

function renderError(message) {
  elements.resultStatus.textContent = message;
  elements.currentSummary.textContent = message;
  elements.currentTemp.textContent = "--";
  elements.weatherIcon.textContent = "!";
  elements.currentTime.textContent = "--";
  elements.dateRange.textContent = "다시 조회해 주세요.";
  elements.hourlyList.replaceChildren();
  elements.pastList.replaceChildren();
  renderDataState(elements.hourlyList, message);
  renderDataState(elements.pastList, message);
  renderDataState(elements.futureList, message);
  renderDataState(elements.weeklyChart, message);
  renderDataState(elements.historyChart, message);
  elements.rainRadarSection.hidden = true;
  elements.hazardPanel.hidden = true;
  renderDataState(elements.precipTimeline, tr("강수 타임라인을 불러오지 못했습니다.", "Precipitation timeline unavailable."), false);
  renderDataState(elements.activityGrid, tr("활동 적합도를 계산할 수 없습니다.", "Activity scores unavailable."), false);
  renderDataState(elements.dataTrustDetails, tr("데이터 연결을 확인하고 있습니다.", "Checking data connection."), false);
  elements.refreshStatus.textContent = "연결 대기 · 10분마다 자동 재시도";
  renderAdviceFallback();
}

async function loadPlace(place) {
  if (state.loading) return;
  state.selectedPlace = place;
  state.weather = null;
  startAutoRefresh();
  setLoading(true);
  elements.currentSummary.textContent = tr("상세 날씨 데이터를 불러오는 중입니다.", "Loading detailed weather data.");
  try {
    const weather = await fetchWeather(place);
    state.lastRefreshAt = Date.now();
    renderPlace(place, weather, { kind: "live", fetchedAt: Date.now() });
    cacheWeather(place, weather);
  } catch (error) {
    const cached = loadCachedWeather(place);
    if (cached) {
      renderPlace(place, cached.weather, { kind: "cache", fetchedAt: cached.savedAt });
      const saved = new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(cached.savedAt));
      elements.refreshStatus.textContent = saved + tr(" 저장 · 연결되면 자동 갱신", " saved · refreshes when online");
      showToast("네트워크 문제로 마지막 저장 날씨를 표시합니다.");
    } else {
      renderError(error.message || "날씨 데이터를 불러오지 못했습니다.");
    }
  } finally {
    setLoading(false);
  }
}

async function loadByQuery(query) {
  if (!query.trim() || state.loading) return;
  setLoading(true);
  elements.resultStatus.textContent = tr("전세계 도시 후보를 찾는 중입니다.", "Searching cities worldwide.");
  elements.currentSummary.textContent = tr("위치 정보를 검색하는 중입니다.", "Searching for the location.");
  try {
    state.places = await searchPlaces(query.trim());
    renderResults();
    setLoading(false);
    await loadPlace(state.places[0]);
  } catch (error) {
    if (state.weather) {
      elements.resultStatus.textContent = error.message || "도시를 찾지 못했습니다.";
      showToast("검색 결과를 불러오지 못했습니다. 현재 날씨는 유지됩니다.");
    } else renderError(error.message || "도시를 찾지 못했습니다.");
    setLoading(false);
  }
}

async function loadByCoordinates(latitude, longitude, label = "선택 위치") {
  if (state.loading) return;
  const place = { id: `${latitude},${longitude},${label}`, name: label, shortName: label, latitude, longitude, timezone: "auto" };
  state.places = [place];
  renderResults();
  await loadPlace(place);
}

const AUTO_REFRESH_MS = 10 * 60 * 1000;

function startAutoRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(() => {
    if (!document.hidden) refreshSelectedWeather(false);
  }, AUTO_REFRESH_MS);
}

async function refreshSelectedWeather(manual = false) {
  if (!state.selectedPlace || state.loading) return;
  const place = state.selectedPlace;
  setLoading(true);
  elements.refreshButton.classList.add("refreshing");
  elements.refreshStatus.textContent = manual ? "새 날씨를 불러오는 중" : "자동 갱신 중";
  try {
    const weather = state.weather
      ? { forecast: await fetchLatestForecast(place), archive: state.weather.archive, airQuality: await fetchAirQuality(place).catch(() => state.weather.airQuality || null) }
      : await fetchWeather(place);
    if (state.selectedPlace?.id !== place.id) return;
    state.lastRefreshAt = Date.now();
    renderPlace(place, weather, { kind: "live", fetchedAt: Date.now() });
    cacheWeather(place, weather);
    if (state.activeTab === "layers") renderAtmosphereLayer(state.weatherLayer);
  } catch (error) {
    elements.refreshStatus.textContent = tr("갱신 실패 · 잠시 후 다시 시도", "Refresh failed · retrying later");
    if (!state.weather) renderAdviceFallback();
  } finally {
    elements.refreshButton.classList.remove("refreshing");
    setLoading(false);
  }
}
function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (error) { return fallback; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* Storage can be unavailable. */ }
}

function serializePlace(place) {
  return {
    id: place.id,
    name: place.name,
    shortName: place.shortName || place.name,
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    timezone: place.timezone || "auto",
    elevation: place.elevation,
  };
}

function weatherCacheKey(place) {
  return "weather-cache:" + Number(place.latitude).toFixed(3) + ":" + Number(place.longitude).toFixed(3);
}

function cacheWeather(place, weather) {
  writeStorage(weatherCacheKey(place), { savedAt: Date.now(), weather });
}

function loadCachedWeather(place) {
  const cached = readStorage(weatherCacheKey(place), null);
  if (!cached?.weather || Date.now() - cached.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
  return cached;
}

function renderDataState(container, message, retry = true) {
  if (!container) return;
  const stateNode = document.createElement("div");
  stateNode.className = "data-state";
  stateNode.textContent = message + (retry ? " 새로고침 버튼으로 다시 시도할 수 있습니다." : "");
  container.replaceChildren(stateNode);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { elements.toast.hidden = true; }, 3600);
}

function aqiInfo(value) {
  const aqi = Number(value);
  if (!Number.isFinite(aqi)) return { label: tr("정보 없음", "Unavailable"), color: "#718078" };
  if (aqi <= 50) return { label: tr("좋음", "Good"), color: "#18856c" };
  if (aqi <= 100) return { label: tr("보통", "Moderate"), color: "#bb8124" };
  if (aqi <= 150) return { label: tr("민감군 주의", "Sensitive groups"), color: "#d46b32" };
  if (aqi <= 200) return { label: tr("나쁨", "Unhealthy"), color: "#c64945" };
  if (aqi <= 300) return { label: tr("매우 나쁨", "Very unhealthy"), color: "#824b9b" };
  return { label: tr("위험", "Hazardous"), color: "#722c3b" };
}

function renderAirQuality(data) {
  const current = data?.current;
  if (!current) {
    elements.airQualityStatus.textContent = tr("이 위치의 대기질 데이터를 제공하지 않습니다.", "Air quality is unavailable for this location.");
    [elements.airQualityIndex, elements.pm25, elements.pm10, elements.ozone, elements.nitrogenDioxide].forEach((node) => { node.textContent = "--"; });
    elements.airQualityLevel.textContent = tr("잠시 후 다시 확인", "Try again later");
    return;
  }
  const info = aqiInfo(current.us_aqi);
  elements.airQualityIndex.closest(".aqi-primary").style.setProperty("--aqi-color", info.color);
  elements.airQualityIndex.textContent = Math.round(current.us_aqi);
  elements.airQualityLevel.textContent = info.label;
  elements.airQualityStatus.textContent = tr("미국 AQI 기준 · ", "US AQI · ") + info.label;
  const concentration = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(1) + " μg/m³" : "--";
  elements.pm25.textContent = concentration(current.pm2_5);
  elements.pm10.textContent = concentration(current.pm10);
  elements.ozone.textContent = concentration(current.ozone);
  elements.nitrogenDioxide.textContent = concentration(current.nitrogen_dioxide);
}

function updateSky(current) {
  const night = Number(current.is_day) === 0;
  document.body.dataset.sky = night ? "night" : isCurrentlyRaining(current) ? "day-rain" : "day-clear";
}

function updateUrlState() {
  if (!state.selectedPlace) return;
  const url = new URL(location.href);
  url.searchParams.set("lat", Number(state.selectedPlace.latitude).toFixed(4));
  url.searchParams.set("lon", Number(state.selectedPlace.longitude).toFixed(4));
  url.searchParams.set("name", state.selectedPlace.shortName || state.selectedPlace.name);
  url.searchParams.set("tab", state.activeTab);
  history.replaceState(null, "", url);
}

function rememberPlace(place) {
  const item = serializePlace(place);
  state.recentPlaces = [item, ...state.recentPlaces.filter((entry) => entry.id !== item.id)].slice(0, 5);
  writeStorage("weather-recent", state.recentPlaces);
  renderPlaceLibraries();
}

function isFavorite(place = state.selectedPlace) {
  return Boolean(place && state.favorites.some((entry) => entry.id === place.id));
}

function updateFavoriteButton() {
  const active = isFavorite();
  elements.favoriteButton.querySelector(".favorite-icon").textContent = active ? "★" : "☆";
  elements.favoriteButtonLabel.textContent = active ? tr("즐겨찾기 저장됨", "Saved favorite") : tr("즐겨찾기 추가", "Add favorite");
  elements.favoriteButton.setAttribute("aria-label", active ? tr("즐겨찾기에서 삭제", "Remove favorite") : tr("즐겨찾기에 추가", "Add favorite"));
  elements.favoriteButton.setAttribute("aria-pressed", String(active));
}

function toggleFavorite() {
  if (!state.selectedPlace) return;
  if (isFavorite()) {
    state.favorites = state.favorites.filter((entry) => entry.id !== state.selectedPlace.id);
    state.compareIds = state.compareIds.filter((id) => id !== state.selectedPlace.id);
    showToast("즐겨찾기에서 삭제했습니다.");
  } else {
    if (state.favorites.length >= 6) { showToast("즐겨찾기는 최대 6곳까지 저장할 수 있습니다."); return; }
    state.favorites.push(serializePlace(state.selectedPlace));
    showToast("즐겨찾기에 저장했습니다.");
  }
  writeStorage("weather-favorites", state.favorites);
  writeStorage("weather-compare", state.compareIds);
  updateFavoriteButton();
  renderPlaceLibraries();
  renderCompareSelector();
}

function placeChip(place, removable = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "place-chip";
  const select = document.createElement("button");
  select.type = "button";
  select.textContent = place.shortName || place.name;
  select.addEventListener("click", () => { loadPlace(place); switchTab("overview"); });
  wrapper.append(select);
  if (removable) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-place";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "즐겨찾기 삭제");
    remove.addEventListener("click", () => {
      state.favorites = state.favorites.filter((entry) => entry.id !== place.id);
      state.compareIds = state.compareIds.filter((id) => id !== place.id);
      writeStorage("weather-favorites", state.favorites);
      writeStorage("weather-compare", state.compareIds);
      renderPlaceLibraries();
      renderCompareSelector();
      updateFavoriteButton();
    });
    wrapper.append(remove);
  }
  return wrapper;
}

function renderPlaceLibraries() {
  elements.favoriteList.replaceChildren();
  elements.favoriteQuickList.replaceChildren();
  elements.recentList.replaceChildren();
  if (!state.favorites.length) {
    renderDataState(elements.favoriteList, tr("저장한 도시가 없습니다.", "No saved cities yet."), false);
    const empty = document.createElement("span");
    empty.className = "favorite-empty";
    empty.textContent = tr("아직 저장한 도시가 없습니다.", "No saved cities yet.");
    elements.favoriteQuickList.append(empty);
  } else {
    state.favorites.forEach((place) => {
      elements.favoriteList.append(placeChip(place, true));
      elements.favoriteQuickList.append(placeChip(place));
    });
  }
  if (!state.recentPlaces.length) renderDataState(elements.recentList, tr("최근 조회 위치가 없습니다.", "No recent places."), false);
  else state.recentPlaces.forEach((place) => elements.recentList.append(placeChip(place)));
}

function renderCompareSelector() {
  elements.compareSelector.replaceChildren();
  if (!state.favorites.length) {
    renderDataState(elements.compareSelector, "즐겨찾기에 도시를 먼저 저장해 주세요.", false);
    return;
  }
  state.favorites.forEach((place) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "place-chip";
    button.classList.toggle("active", state.compareIds.includes(place.id));
    button.textContent = (state.compareIds.includes(place.id) ? "✓ " : "+ ") + (place.shortName || place.name);
    button.addEventListener("click", () => {
      if (state.compareIds.includes(place.id)) state.compareIds = state.compareIds.filter((id) => id !== place.id);
      else if (state.compareIds.length < 3) state.compareIds.push(place.id);
      else { showToast("비교는 최대 3곳까지 가능합니다."); return; }
      writeStorage("weather-compare", state.compareIds);
      renderCompareSelector();
      renderCompare();
    });
    elements.compareSelector.append(button);
  });
}

async function renderCompare() {
  renderCompareSelector();
  const places = state.compareIds.map((id) => state.favorites.find((place) => place.id === id)).filter(Boolean);
  elements.compareGrid.replaceChildren();
  if (!places.length) { renderDataState(elements.compareGrid, "비교할 도시를 선택해 주세요.", false); return; }
  elements.compareStatus.textContent = tr("선택한 도시의 최신 날씨를 불러오는 중", "Loading the selected cities");
  const results = await Promise.all(places.map(async (place) => {
    try { return { place, forecast: await fetchLatestForecast(place) }; }
    catch (error) { return { place, error }; }
  }));
  results.forEach(({ place, forecast }) => {
    const card = document.createElement("article");
    card.className = "compare-card";
    if (!forecast) { card.innerHTML = "<h3></h3><p class=empty-state>데이터를 불러오지 못했습니다.</p>"; card.querySelector("h3").textContent = place.name; elements.compareGrid.append(card); return; }
    const current = forecast.current;
    const [description, icon] = weatherText(current.weather_code);
    card.innerHTML = '<h3></h3><div class="compare-current"><span></span><div><strong></strong><p></p></div></div><div class="compare-metrics"><div><span>체감</span><strong></strong></div><div><span>강수</span><strong></strong></div><div><span>바람</span><strong></strong></div><div><span>오늘 최고/최저</span><strong></strong></div></div>';
    card.querySelector("h3").textContent = place.name;
    card.querySelector(".compare-current span").textContent = icon;
    card.querySelector(".compare-current strong").textContent = compactTemp(current.temperature_2m);
    card.querySelector(".compare-current p").textContent = description;
    [tr("체감", "Feels like"), tr("강수", "Rain"), tr("바람", "Wind"), tr("오늘 최고/최저", "Today high/low")].forEach((label, index) => { card.querySelectorAll(".compare-metrics span")[index].textContent = label; });
    const values = [displayTemp(current.apparent_temperature), displayPrecip(current.precipitation), displayWind(current.wind_speed_10m), compactTemp(forecast.daily.temperature_2m_max[0]) + " / " + compactTemp(forecast.daily.temperature_2m_min[0])];
    card.querySelectorAll(".compare-metrics strong").forEach((node, index) => { node.textContent = values[index]; });
    elements.compareGrid.append(card);
  });
  elements.compareStatus.textContent = places.length + tr("개 도시 비교", " cities compared");
}

function nextRainWindow(forecast) {
  const hourly = forecast.hourly;
  const now = Date.now();
  for (let index = 0; index < hourly.time.length; index += 1) {
    const time = new Date(hourly.time[index]).getTime();
    if (time < now || time > now + 12 * 60 * 60 * 1000) continue;
    if (rainCodes.has(Number(hourly.weather_code[index])) || Number(hourly.precipitation_probability[index]) >= 60 || Number(hourly.precipitation?.[index] || 0) >= 0.2) return hourly.time[index];
  }
  return null;
}

function scheduleRainNotification(forecast) {
  if (!state.notificationEnabled || !("Notification" in window) || Notification.permission !== "granted" || !state.selectedPlace) return;
  const rules = currentAlertRules();
  const rainTime = nextRainWindow(forecast);
  const { hourly, start, end } = forecastWindow(forecast, 12);
  const codes = hourly.weather_code.slice(start, end).map(Number);
  const messages = [];
  if (rules.rain && rainTime) {
    const label = new Intl.DateTimeFormat(state.language === "en" ? "en-US" : "ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(rainTime));
    messages.push(tr(label + " 비 가능성", "Rain possible near " + label));
  }
  if (rules.snow && codes.some((code) => code >= 71 && code <= 86)) messages.push(tr("12시간 이내 눈·결빙 가능성", "Snow or ice possible within 12 hours"));
  if (rules.heat && Number(forecast.daily.temperature_2m_max?.[0]) >= 33) messages.push(tr("오늘 폭염 위험", "Heat risk today"));
  if (rules.air && Number(state.airQuality?.current?.us_aqi) >= 151) messages.push(tr("대기질 건강 주의", "Unhealthy air quality"));
  if (!messages.length) return;
  const key = state.selectedPlace.id + ":" + toIsoDate(new Date()) + ":" + messages.join("|");
  if (state.lastRainNotice === key) return;
  state.lastRainNotice = key;
  writeStorage("weather-last-rain-notice", key);
  new Notification("World Weather Atlas", { body: (state.selectedPlace.shortName || state.selectedPlace.name) + " · " + messages.join(" · "), icon: "assets/advice-rain.png" });
}

function savePreferences() {
  state.language = elements.languageSelect.value;
  state.windUnit = elements.windUnitSelect.value;
  state.precipUnit = elements.precipUnitSelect.value;
  state.pressureUnit = elements.pressureUnitSelect.value;
  state.colorSafe = elements.colorSafeToggle.checked;
  document.documentElement.dataset.palette = state.colorSafe ? "accessible" : "default";
  writeStorage("weather-preferences", { language: state.language, windUnit: state.windUnit, precipUnit: state.precipUnit, pressureUnit: state.pressureUnit, unit: state.unit, colorSafe: state.colorSafe });
  document.documentElement.lang = state.language;
  applyLanguage();
  if (state.selectedPlace && state.weather) renderPlace(state.selectedPlace, state.weather);
}

function applyLanguage() {
  const english = state.language === "en";
  const setText = (selector, korean, en) => { const node = document.querySelector(selector); if (node) node.textContent = english ? en : korean; };
  const setSeries = (selector, korean, en) => document.querySelectorAll(selector).forEach((node, index) => { node.textContent = english ? en[index] : korean[index]; });
  const setLabel = (selector, korean, en) => { const node = document.querySelector(selector)?.firstChild; if (node) node.textContent = english ? en : korean; };
  const labels = {
    "[data-tab=overview]": ["요약", "Overview"], "[data-tab=location]": ["위치 선택", "Location"], "[data-tab=layers]": ["기상 지도", "Weather map"], "[data-tab=hourly]": ["48시간", "48 hours"],
    "[data-tab=weekly]": ["주간", "Weekly"], "[data-tab=history]": ["과거", "History"], "[data-tab=compare]": ["도시 비교", "Compare"],
    "#geoButton": ["현재 위치", "My location"], "#resetButton": ["초기화", "Reset"], "#mapApplyButton": ["이 위치 날씨 보기", "Use this location"], "#searchForm button": ["검색", "Search"],
    ".lead": ["원하는 위치를 선택하고 필요한 정보만 탭으로 나눠 확인합니다.", "Choose any place and explore focused weather views."],
    ".saved-places-heading strong": ["즐겨찾기", "Favorites"], "#favoriteHelp": ["상단의 즐겨찾기 추가 버튼으로 현재 도시를 저장하세요.", "Use Add favorite above to save the current city."],
    ".advice-label": ["오늘의 준비", "TODAY'S CHECK"], ".air-quality-panel .panel-header h2": ["대기질과 건강", "Air quality & health"],
    "#tab-layers .panel-header h2": ["실시간 기상 지도", "Live weather map"], "#tab-hourly .panel-header h2": ["48시간 흐름", "48-hour outlook"], "#tab-weekly .panel-header h2": ["앞으로 7일", "Next 7 days"],
    "#tab-history .panel-header h2": ["과거 날씨 조회", "Weather history"], "#tab-compare .panel-header h2": ["도시 날씨 비교", "City comparison"],
    ".precip-panel .panel-header h2": ["앞으로 24시간 강수", "Next 24 hours precipitation"], ".activity-panel .panel-header h2": ["오늘의 활동 적합도", "Today activity scores"],
    ".trust-panel .panel-header h2": ["데이터 신뢰도", "Data confidence"], ".alert-config-panel .panel-header h2": ["위치별 날씨 알림", "Location weather alerts"],
  };
  Object.entries(labels).forEach(([selector, pair]) => setText(selector, pair[0], pair[1]));
  setSeries(".layer-button", ["비구름", "구름량", "바람", "미세먼지 PM2.5"], ["Rain radar", "Clouds", "Wind", "Fine dust PM2.5"]);
  setSeries(".location-meta dt", ["위도", "경도", "시간대", "고도"], ["Latitude", "Longitude", "Timezone", "Elevation"]);
  setSeries(".metric-grid dt", ["체감", "습도", "강수", "풍속", "기압", "구름"], ["Feels like", "Humidity", "Rain", "Wind", "Pressure", "Clouds"]);
  setSeries(".air-quality-grid dt", ["통합 AQI", "초미세먼지 PM2.5", "미세먼지 PM10", "오존 O₃", "이산화질소 NO₂"], ["Overall AQI", "Fine dust PM2.5", "Dust PM10", "Ozone O₃", "Nitrogen dioxide NO₂"]);
  setSeries(".insight-list dt", ["일출", "일몰", "낮 길이", "최대 자외선", "가시거리", "달 위상", "해 진행도", "주간 요약"], ["Sunrise", "Sunset", "Daylight", "Max UV", "Visibility", "Moon phase", "Sun progress", "Weekly summary"]);
  setSeries("#tab-location .panel-header h2", ["즐겨찾는 도시", "최근 위치", "검색 후보", "지도에서 선택"], ["Favorite cities", "Recent places", "Search results", "Choose on map"]);
  setLabel("#settingsPanel label:nth-child(1)", "언어", "Language");
  setLabel("#settingsPanel label:nth-child(2)", "풍속", "Wind");
  setLabel("#settingsPanel label:nth-child(3)", "강수", "Precipitation");
  setLabel("#settingsPanel label:nth-child(4)", "기압", "Pressure");
  setLabel("#historyRangeForm label:nth-child(1)", "시작일", "Start");
  setLabel("#historyRangeForm label:nth-child(3)", "종료일", "End");
  elements.input.placeholder = english ? "Search Seoul, New York, Paris..." : "Seoul, New York, Paris, Tokyo";
  elements.unitButton.textContent = state.unit === "c" ? (english ? "Show °F" : "°F 보기") : (english ? "Show °C" : "°C 보기");
}
function restorePreferences() {
  const prefs = readStorage("weather-preferences", {});
  state.unit = prefs.unit === "f" ? "f" : "c";
  state.language = prefs.language === "en" ? "en" : "ko";
  state.windUnit = ["kmh", "ms", "mph"].includes(prefs.windUnit) ? prefs.windUnit : "kmh";
  state.precipUnit = prefs.precipUnit === "inch" ? "inch" : "mm";
  state.pressureUnit = prefs.pressureUnit === "inhg" ? "inhg" : "hpa";
  state.colorSafe = Boolean(prefs.colorSafe);
  state.alertRules = readStorage("weather-alert-rules", {});
  document.documentElement.dataset.palette = state.colorSafe ? "accessible" : "default";
  state.favorites = readStorage("weather-favorites", []);
  state.recentPlaces = readStorage("weather-recent", []);
  state.compareIds = readStorage("weather-compare", []).filter((id) => state.favorites.some((place) => place.id === id)).slice(0, 3);
  state.notificationEnabled = readStorage("weather-notifications", false) && "Notification" in window && Notification.permission === "granted";
  state.lastRainNotice = readStorage("weather-last-rain-notice", "");
  elements.languageSelect.value = state.language;
  elements.windUnitSelect.value = state.windUnit;
  elements.precipUnitSelect.value = state.precipUnit;
  elements.pressureUnitSelect.value = state.pressureUnit;
  elements.colorSafeToggle.checked = state.colorSafe;
  elements.unitButton.textContent = state.unit === "c" ? "°F 보기" : "°C 보기";
  elements.notifyButton.setAttribute("aria-pressed", String(state.notificationEnabled));
  document.documentElement.lang = state.language;
  applyLanguage();
}

async function toggleNotifications() {
  if (!("Notification" in window)) { showToast("이 브라우저는 알림을 지원하지 않습니다."); return; }
  if (!state.notificationEnabled) {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { showToast("브라우저 알림 권한이 필요합니다."); return; }
    state.notificationEnabled = true;
    showToast(tr("선택한 위치별 날씨 조건을 알려드립니다.", "Location alert rules are enabled."));
    if (state.weather) scheduleRainNotification(state.weather.forecast);
  } else {
    state.notificationEnabled = false;
    showToast(tr("위치별 날씨 알림을 껐습니다.", "Weather alerts are off."));
  }
  writeStorage("weather-notifications", state.notificationEnabled);
  elements.notifyButton.setAttribute("aria-pressed", String(state.notificationEnabled));
}

function initializeConnectionState() {
  const update = () => { elements.offlineBanner.hidden = navigator.onLine; };
  addEventListener("online", update);
  addEventListener("offline", update);
  update();
}

function registerPwa() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js?v=20260715-18").catch(() => {});
  let installPrompt;
  addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event; elements.installButton.hidden = false; });
  elements.installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    elements.installButton.hidden = true;
  });
}

function resetApplication() {
  if (elements.resetButton.dataset.armed !== "true") {
    elements.resetButton.dataset.armed = "true";
    elements.resetButton.textContent = tr("초기화 확인", "Confirm");
    showToast(tr("즐겨찾기, 최근 위치, 단위 설정을 지우려면 초기화 버튼을 한 번 더 누르세요.", "Press Reset again to clear favorites, recent places and display settings."));
    clearTimeout(resetApplication.timer);
    resetApplication.timer = setTimeout(() => {
      elements.resetButton.dataset.armed = "false";
      elements.resetButton.textContent = tr("초기화", "Reset");
    }, 4500);
    return;
  }
  try {
    Object.keys(localStorage).filter((key) => key.startsWith("weather-")).forEach((key) => localStorage.removeItem(key));
    sessionStorage.clear();
  } catch (error) { /* Storage can be unavailable. */ }
  history.replaceState(null, "", location.pathname);
  location.replace(location.pathname);
}

async function initializeApp() {
  restorePreferences();
  initializeConnectionState();
  registerPwa();
  renderPlaceLibraries();
  renderCompareSelector();
  initMap();
  renderPresets();
  const params = new URLSearchParams(location.search);
  const latitude = params.has("lat") ? Number(params.get("lat")) : NaN;
  const longitude = params.has("lon") ? Number(params.get("lon")) : NaN;
  const tab = params.get("tab") || "overview";
  switchTab(document.querySelector('[data-tab="' + tab + '"]') ? tab : "overview");
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) await loadByCoordinates(latitude, longitude, params.get("name") || "공유 위치");
  else await loadByQuery("Seoul");
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadByQuery(elements.input.value);
  switchTab("location");
});

elements.geoButton.addEventListener("click", () => {
  if (!navigator.geolocation) { renderError("브라우저가 현재 위치 기능을 지원하지 않습니다."); return; }
  navigator.geolocation.getCurrentPosition(
    (position) => { loadByCoordinates(position.coords.latitude, position.coords.longitude, "현재 위치"); switchTab("overview"); },
    () => renderError("현재 위치 권한이 필요합니다.")
  );
});

elements.unitButton.addEventListener("click", () => {
  state.unit = state.unit === "c" ? "f" : "c";
  elements.unitButton.textContent = state.unit === "c" ? tr("°F 보기", "Show °F") : tr("°C 보기", "Show °C");
  elements.unitButton.setAttribute("aria-pressed", state.unit === "f");
  writeStorage("weather-preferences", { language: state.language, windUnit: state.windUnit, precipUnit: state.precipUnit, pressureUnit: state.pressureUnit, unit: state.unit, colorSafe: state.colorSafe });
  if (state.selectedPlace && state.weather) renderPlace(state.selectedPlace, state.weather);
});

elements.favoriteButton.addEventListener("click", toggleFavorite);
elements.resetButton.addEventListener("click", resetApplication);
elements.layerButtons.forEach((button) => button.addEventListener("click", () => renderAtmosphereLayer(button.dataset.weatherLayer)));
elements.layerRefreshButton.addEventListener("click", () => renderAtmosphereLayer(state.weatherLayer));
elements.notifyButton.addEventListener("click", toggleNotifications);
elements.saveAlertSettings.addEventListener("click", saveAlertRules);
elements.colorSafeToggle.addEventListener("change", savePreferences);
elements.settingsButton.addEventListener("click", () => { elements.settingsPanel.hidden = !elements.settingsPanel.hidden; });
[elements.languageSelect, elements.windUnitSelect, elements.precipUnitSelect, elements.pressureUnitSelect].forEach((select) => select.addEventListener("change", savePreferences));
elements.refreshButton.addEventListener("click", () => refreshSelectedWeather(true));

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.lastRefreshAt && Date.now() - state.lastRefreshAt >= AUTO_REFRESH_MS) {
    refreshSelectedWeather(false);
  }
});
elements.themeButton.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme, true);
});
initializeTabAccessibility();
elements.tabs.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));

elements.mapApplyButton.addEventListener("click", () => {
  if (state.mapPoint.place) loadPlace(state.mapPoint.place);
  else loadByCoordinates(state.mapPoint.latitude, state.mapPoint.longitude, tr("지도에서 선택한 위치", "Map-selected location"));
  switchTab("overview");
});

async function loadHistoryRange(startDate, endDate) {
  if (!state.selectedPlace || !state.weather) return;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const days = Math.round((end - start) / 86400000) + 1;
  const yesterday = addDays(new Date(), -1);
  yesterday.setHours(23, 59, 59, 999);
  if (!startDate || !endDate || end < start) {
    elements.historyRangeStatus.textContent = "날짜 범위를 확인해 주세요.";
    return;
  }
  if (days > 31) {
    elements.historyRangeStatus.textContent = "한 번에 최대 31일까지 조회할 수 있습니다.";
    return;
  }
  if (end > yesterday) {
    elements.historyRangeStatus.textContent = "어제까지의 과거 데이터를 선택해 주세요.";
    return;
  }

  const submit = elements.historyRangeForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  elements.historyRangeStatus.textContent = "선택 기간 데이터를 불러오는 중입니다.";
  try {
    const archive = await fetchHistoryRange(state.selectedPlace, startDate, endDate);
    state.weather.archive = archive;
    renderDaily(elements.pastList, archive.daily, { limit: archive.daily.time.length });
    renderHistoryChart(archive.daily);
    elements.historyRangeStatus.textContent = formatDate(startDate) + " - " + formatDate(endDate) + " · " + days + "일";
  } catch (error) {
    elements.historyRangeStatus.textContent = error.message || "과거 데이터를 불러오지 못했습니다.";
  } finally {
    submit.disabled = false;
  }
}

elements.historyRangeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadHistoryRange(elements.historyStart.value, elements.historyEnd.value);
});

document.querySelectorAll("[data-history-days]").forEach((button) => {
  button.addEventListener("click", () => {
    const days = Number(button.dataset.historyDays);
    const end = addDays(new Date(), -1);
    const start = addDays(end, -(days - 1));
    elements.historyStart.value = toIsoDate(start);
    elements.historyEnd.value = toIsoDate(end);
    loadHistoryRange(elements.historyStart.value, elements.historyEnd.value);
  });
});
initializeApp();
