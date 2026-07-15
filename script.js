const API = {
  geocode: "https://geocoding-api.open-meteo.com/v1/search",
  forecast: "https://api.open-meteo.com/v1/forecast",
  archive: "https://archive-api.open-meteo.com/v1/archive",
  radar: "https://api.rainviewer.com/public/weather-maps.json",
};

const state = { loading: false, unit: "c", places: [], selectedPlace: null, weather: null, mapPoint: { latitude: 37.5665, longitude: 126.9780 }, lastRefreshAt: 0, refreshTimer: null, radarMetadata: null };
let weatherMap;
let mapMarker;
let rainRadarMap;
let rainRadarLayer;
let rainRadarMarker;
const $ = (selector) => document.querySelector(selector);

const elements = {
  form: $("#searchForm"), input: $("#cityInput"), geoButton: $("#geoButton"), unitButton: $("#unitButton"), refreshButton: $("#refreshButton"), refreshStatus: $("#refreshStatus"), themeButton: $("#themeButton"), themeIcon: $("#themeIcon"),
  resultStatus: $("#resultStatus"), resultList: $("#resultList"), placeName: $("#placeName"), dateRange: $("#dateRange"),
  latitude: $("#latitude"), longitude: $("#longitude"), timezone: $("#timezone"), elevation: $("#elevation"),
  currentSummary: $("#currentSummary"), currentTemp: $("#currentTemp"), currentTime: $("#currentTime"), weatherIcon: $("#weatherIcon"),
  apparentTemp: $("#apparentTemp"), humidity: $("#humidity"), precipitation: $("#precipitation"), windSpeed: $("#windSpeed"), pressure: $("#pressure"), cloudCover: $("#cloudCover"),
  hourlyList: $("#hourlyList"), pastList: $("#pastList"), futureList: $("#futureList"),
  sunrise: $("#sunrise"), sunset: $("#sunset"), daylight: $("#daylight"), uvIndex: $("#uvIndex"), visibility: $("#visibility"), weeklySummary: $("#weeklySummary"),
  adviceVisual: $("#adviceVisual"), adviceTitle: $("#adviceTitle"), adviceText: $("#adviceText"), adviceMeta: $("#adviceMeta"), rainRadarSection: $("#rainRadarSection"), rainRadarMap: $("#rainRadarMap"), radarTime: $("#radarTime"),
  mapCoordinates: $("#mapCoordinates"), mapApplyButton: $("#mapApplyButton"), presetList: $("#presetList"), weeklyChart: $("#weeklyChart"), historyChart: $("#historyChart"), historySummary: $("#historySummary"), historyRangeForm: $("#historyRangeForm"), historyStart: $("#historyStart"), historyEnd: $("#historyEnd"), historyRangeStatus: $("#historyRangeStatus"),
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
function weatherText(code) { return weatherCodes[code] || ["정보 없음", "·"]; }

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${isoDate}T00:00:00`));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatHour(value) {
  return new Intl.DateTimeFormat("ko-KR", { weekday: "short", hour: "2-digit" }).format(new Date(value));
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
  const data = await fetchJson(buildUrl(API.geocode, { name: query, count: 8, language: "ko", format: "json" }));
  if (!data.results?.length) throw new Error("도시를 찾지 못했습니다.");
  return data.results.map((place) => normalizePlace(place, query));
}

async function fetchWeather(place) {
  const now = new Date();
  const shared = { latitude: place.latitude, longitude: place.longitude, timezone: "auto" };
  const forecastUrl = buildUrl(API.forecast, {
    ...shared,
    forecast_days: 8,
    current: ["temperature_2m", "relative_humidity_2m", "apparent_temperature", "precipitation", "weather_code", "wind_speed_10m", "surface_pressure", "cloud_cover", "is_day"],
    hourly: ["temperature_2m", "relative_humidity_2m", "precipitation_probability", "weather_code", "wind_speed_10m", "wind_direction_10m", "surface_pressure", "cloud_cover", "visibility", "uv_index"],
    daily: ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "precipitation_probability_max", "wind_speed_10m_max", "sunrise", "sunset", "daylight_duration", "uv_index_max"],
  });
  const archiveUrl = buildUrl(API.archive, {
    ...shared,
    start_date: toIsoDate(addDays(now, -7)),
    end_date: toIsoDate(addDays(now, -1)),
    daily: ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "wind_speed_10m_max"],
  });
  const [forecast, archive] = await Promise.all([fetchJson(forecastUrl), fetchJson(archiveUrl)]);
  return { forecast, archive };
}

async function fetchLatestForecast(place) {
  const url = buildUrl(API.forecast, {
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: "auto",
    forecast_days: 8,
    current: ["temperature_2m", "relative_humidity_2m", "apparent_temperature", "precipitation", "weather_code", "wind_speed_10m", "surface_pressure", "cloud_cover", "is_day"],
    hourly: ["temperature_2m", "relative_humidity_2m", "precipitation_probability", "weather_code", "wind_speed_10m", "wind_direction_10m", "surface_pressure", "cloud_cover", "visibility", "uv_index"],
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
  elements.tabs.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabName));
  elements.panels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tabName}`));
  if (tabName === "location" && weatherMap) setTimeout(() => weatherMap.invalidateSize(), 0);
  if (tabName === "overview" && rainRadarMap) setTimeout(() => rainRadarMap.invalidateSize(), 0);
}

function setMapPoint(latitude, longitude, moveView = false) {
  state.mapPoint = { latitude, longitude };
  elements.mapCoordinates.textContent = latitude.toFixed(4) + ", " + longitude.toFixed(4);
  if (mapMarker) mapMarker.setLatLng([latitude, longitude]);
  if (moveView && weatherMap) weatherMap.setView([latitude, longitude], Math.max(weatherMap.getZoom(), 7));
}

function initMap() {
  if (!window.L) {
    elements.mapCoordinates.textContent = "지도를 불러오지 못했습니다.";
    elements.mapApplyButton.disabled = true;
    return;
  }
  weatherMap = L.map("weatherMap", { worldCopyJump: true }).setView([37.5665, 126.978], 3);
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
    card.addEventListener("click", () => loadPlace(place));
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
  elements.precipitation.textContent = `${current.precipitation} mm`;
  elements.windSpeed.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  elements.pressure.textContent = `${Math.round(current.surface_pressure)} hPa`;
  elements.cloudCover.textContent = `${current.cloud_cover}%`;
}

const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

function isCurrentlyRaining(current) {
  return rainCodes.has(Number(current.weather_code));
}

function renderAdvice(forecast) {
  const current = forecast.current;
  const daily = forecast.daily;
  const raining = isCurrentlyRaining(current);
  const rainChance = Number(daily.precipitation_probability_max?.[0] || 0);
  const uv = Number(daily.uv_index_max?.[0] || 0);
  const temp = Number(current.temperature_2m);
  const wind = Number(current.wind_speed_10m);
  let advice = { kind: "heat", title: "가볍게 나가기 좋은 날씨예요", text: "급격한 변화에 대비해 현재 날씨를 한 번 더 확인하고 외출하세요." };

  if (raining) {
    advice = { kind: "rain", title: "지금 우산이 꼭 필요해요", text: "현재 비가 내리고 있습니다. 미끄러운 길과 낮아진 시야에도 주의하세요." };
  } else if (rainChance >= 60 || Number(daily.precipitation_sum?.[0] || 0) > 1) {
    advice = { kind: "rain", title: "오늘은 우산을 챙겨가세요", text: "지금 비가 오지 않아도 오늘 강수 가능성이 높습니다." };
  } else if (uv >= 6) {
    advice = { kind: "sun", title: "외출 전에 선크림을 바르세요", text: "자외선이 강합니다. 모자와 선글라스도 도움이 됩니다." };
  } else if (temp >= 28) {
    advice = { kind: "heat", title: "물병을 챙기고 자주 쉬세요", text: "더운 날씨에는 갈증이 나기 전부터 수분을 보충하는 것이 좋습니다." };
  } else if (temp <= 5) {
    advice = { kind: "cold", title: "따뜻한 겉옷을 챙기세요", text: "기온이 낮습니다. 목과 손을 보호할 수 있는 옷차림이 좋습니다." };
  } else if (wind >= 30) {
    advice = { kind: "cold", title: "바람을 막을 겉옷이 필요해요", text: "바람이 강해 체감온도가 낮아질 수 있습니다." };
  }

  elements.adviceVisual.dataset.kind = advice.kind;
  elements.adviceTitle.textContent = advice.title;
  elements.adviceText.textContent = advice.text;
  elements.adviceMeta.replaceChildren();
  [["강수확률", rainChance + "%"], ["UV", uv.toFixed(1)], ["바람", Math.round(wind) + " km/h"]].forEach(([label, value]) => {
    const chip = document.createElement("span");
    chip.textContent = label + " " + value;
    elements.adviceMeta.append(chip);
  });
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
  elements.radarTime.textContent = "레이더 불러오는 중";
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
    const radarTime = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(frame.time * 1000));
    elements.radarTime.textContent = radarTime + " 기준";
    setTimeout(() => rainRadarMap.invalidateSize(), 0);
  } catch (error) {
    elements.radarTime.textContent = "레이더 데이터를 불러오지 못했습니다.";
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
    ["최대 풍속", Math.round(Math.max(...wind)) + " km/h"],
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
  const svg = svgNode("svg", { viewBox: "0 0 " + width + " " + height, "aria-hidden": "true" });

  [0, 0.5, 1].forEach((ratio) => {
    const lineY = top + plotHeight * ratio;
    svg.append(svgNode("line", { x1: left, y1: lineY, x2: width - right, y2: lineY, class: "chart-grid" }));
    svg.append(svgNode("text", { x: left - 8, y: lineY + 4, class: "chart-axis", "text-anchor": "end" }, Math.round(maxTemp - range * ratio) + "°"));
  });

  rain.forEach((value, index) => {
    const barHeight = (value / 100) * (plotHeight * 0.42);
    svg.append(svgNode("rect", { x: x(index) - 7, y: top + plotHeight - barHeight, width: 14, height: barHeight, rx: 3, class: "hour-rain-bar" }));
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
    row.querySelector(".rain").textContent = `강수 ${Number(daily.precipitation_sum[index] ?? 0).toFixed(1)} mm · 바람 ${Math.round(daily.wind_speed_10m_max[index])} km/h`;
    const probability = daily.precipitation_probability_max?.[index];
    row.querySelector(".sun").textContent = Number.isFinite(probability) ? `최대 강수확률 ${probability}%` : "";
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

function renderWeeklyChart(daily) {
  const dates = daily.time.slice(1, 8);
  const highs = daily.temperature_2m_max.slice(1, 8).map(chartTemp);
  const lows = daily.temperature_2m_min.slice(1, 8).map(chartTemp);
  const rain = daily.precipitation_sum.slice(1, 8).map((value) => Number(value || 0));
  const width = 840, height = 330, left = 48, right = 24, top = 36, bottom = 62;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const minTemp = Math.floor(Math.min(...lows) - 3), maxTemp = Math.ceil(Math.max(...highs) + 3);
  const tempRange = Math.max(1, maxTemp - minTemp), maxRain = Math.max(5, ...rain);
  const x = (index) => left + (plotWidth * index) / Math.max(1, dates.length - 1);
  const y = (value) => top + ((maxTemp - value) / tempRange) * plotHeight;
  const svg = svgNode("svg", { viewBox: "0 0 " + width + " " + height, "aria-hidden": "true" });

  [0, 0.5, 1].forEach((ratio) => {
    const lineY = top + plotHeight * ratio;
    svg.append(svgNode("line", { x1: left, y1: lineY, x2: width - right, y2: lineY, class: "chart-grid" }));
    svg.append(svgNode("text", { x: left - 10, y: lineY + 4, class: "chart-axis", "text-anchor": "end" }, Math.round(maxTemp - tempRange * ratio) + "°"));
  });

  dates.forEach((date, index) => {
    const barHeight = (rain[index] / maxRain) * (plotHeight * 0.35);
    const day = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(new Date(date + "T00:00:00"));
    const barWidth = Math.max(8, Math.min(28, plotWidth / dates.length * 0.55));
    svg.append(svgNode("rect", { x: x(index) - barWidth / 2, y: top + plotHeight - barHeight, width: barWidth, height: barHeight, rx: 4, class: "rain-bar" }));
    svg.append(svgNode("text", { x: x(index), y: height - 26, class: "chart-day", "text-anchor": "middle" }, day));
    svg.append(svgNode("text", { x: x(index), y: top + plotHeight - barHeight - 7, class: "chart-rain", "text-anchor": "middle" }, rain[index].toFixed(1)));
  });

  [highs, lows].forEach((values, lineIndex) => {
    const lineClass = lineIndex === 0 ? "temp-line high-line-path" : "temp-line low-line-path";
    svg.append(svgNode("polyline", { points: values.map((value, index) => x(index) + "," + y(value)).join(" "), class: lineClass }));
    values.forEach((value, index) => {
      svg.append(svgNode("circle", { cx: x(index), cy: y(value), r: 5, class: lineIndex === 0 ? "high-dot" : "low-dot" }));
      svg.append(svgNode("text", { x: x(index), y: y(value) + (lineIndex === 0 ? -10 : 20), class: "chart-value " + (lineIndex === 0 ? "high" : "low"), "text-anchor": "middle" }, Math.round(value) + "°"));
    });
  });

  const unit = state.unit === "f" ? "°F" : "°C";
  elements.weeklyChart.replaceChildren();
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = '<span><i class="high-line"></i>최고 ' + unit + '</span><span><i class="low-line"></i>최저 ' + unit + '</span><span><i class="rain-key"></i>강수 mm</span>';
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
  const svg = svgNode("svg", { viewBox: "0 0 " + width + " " + height, "aria-hidden": "true" });

  [0, 0.5, 1].forEach((ratio) => {
    const lineY = top + plotHeight * ratio;
    svg.append(svgNode("line", { x1: left, y1: lineY, x2: width - right, y2: lineY, class: "chart-grid" }));
    svg.append(svgNode("text", { x: left - 10, y: lineY + 4, class: "chart-axis", "text-anchor": "end" }, Math.round(maxTemp - tempRange * ratio) + "°"));
  });

  dates.forEach((date, index) => {
    const barHeight = (rain[index] / maxRain) * (plotHeight * 0.35);
    const label = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(new Date(date + "T00:00:00"));
    const barWidth = Math.max(8, Math.min(28, plotWidth / dates.length * 0.55));
    svg.append(svgNode("rect", { x: x(index) - barWidth / 2, y: top + plotHeight - barHeight, width: barWidth, height: barHeight, rx: 4, class: "rain-bar" }));
    if (index % labelStep === 0 || index === dates.length - 1) svg.append(svgNode("text", { x: x(index), y: height - 26, class: "chart-day", "text-anchor": "middle" }, label));
    if (index % labelStep === 0 || index === dates.length - 1) svg.append(svgNode("text", { x: x(index), y: top + plotHeight - barHeight - 7, class: "chart-rain", "text-anchor": "middle" }, rain[index].toFixed(1)));
  });

  [highs, lows].forEach((values, lineIndex) => {
    svg.append(svgNode("polyline", { points: values.map((value, index) => x(index) + "," + y(value)).join(" "), class: lineIndex === 0 ? "temp-line high-line-path" : "temp-line low-line-path" }));
    values.forEach((value, index) => {
      svg.append(svgNode("circle", { cx: x(index), cy: y(value), r: 5, class: lineIndex === 0 ? "high-dot" : "low-dot" }));
      if (index % labelStep === 0 || index === dates.length - 1) svg.append(svgNode("text", { x: x(index), y: y(value) + (lineIndex === 0 ? -10 : 20), class: "chart-value " + (lineIndex === 0 ? "high" : "low"), "text-anchor": "middle" }, Math.round(value) + "°"));
    });
  });

  elements.historyChart.replaceChildren();
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = '<span><i class="high-line"></i>최고</span><span><i class="low-line"></i>최저</span><span><i class="rain-key"></i>강수 mm</span>';
  elements.historyChart.append(legend, svg);

  const avgHigh = highs.reduce((sum, value) => sum + value, 0) / highs.length;
  const avgLow = lows.reduce((sum, value) => sum + value, 0) / lows.length;
  const totalRain = rain.reduce((sum, value) => sum + value, 0);
  const summaries = [["평균 최고", Math.round(avgHigh) + "°"], ["평균 최저", Math.round(avgLow) + "°"], ["누적 강수", totalRain.toFixed(1) + " mm"], ["최대 풍속", Math.round(Math.max(...wind)) + " km/h"]];
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
  elements.weeklySummary.textContent = `평균 ${compactTemp(avgMin)} / ${compactTemp(avgMax)}, 누적 강수 ${rain.toFixed(1)} mm 예상`;
}

function renderPlace(place, weather) {
  state.selectedPlace = place;
  state.weather = weather;
  elements.placeName.textContent = place.name;
  elements.dateRange.textContent = `${formatDate(weather.archive.daily.time[0])} - ${formatDate(weather.forecast.daily.time.at(-1))}`;
  elements.latitude.textContent = place.latitude.toFixed(4);
  elements.longitude.textContent = place.longitude.toFixed(4);
  elements.timezone.textContent = weather.forecast.timezone || place.timezone;
  elements.elevation.textContent = `${Math.round(weather.forecast.elevation ?? place.elevation ?? 0)} m`;
  setMapPoint(place.latitude, place.longitude, true);
  renderResults();
  renderCurrent(weather.forecast.current);
  renderAdvice(weather.forecast);
  renderRainRadar(place, weather.forecast.current);
  renderHourly(weather.forecast.hourly);
  renderDaily(elements.futureList, weather.forecast.daily, { skipToday: true, limit: 7 });
  renderWeeklyChart(weather.forecast.daily);
  renderDaily(elements.pastList, weather.archive.daily, { limit: weather.archive.daily.time.length });
  renderHistoryChart(weather.archive.daily);
  elements.historyStart.value = weather.archive.daily.time[0];
  elements.historyEnd.value = weather.archive.daily.time.at(-1);
  const yesterday = toIsoDate(addDays(new Date(), -1));
  elements.historyStart.max = yesterday;
  elements.historyEnd.max = yesterday;
  elements.historyRangeStatus.textContent = formatDate(weather.archive.daily.time[0]) + " - " + formatDate(weather.archive.daily.time.at(-1));
  renderInsights(weather.forecast);
  if (state.lastRefreshAt) {
    const refreshed = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(state.lastRefreshAt));
    elements.refreshStatus.textContent = refreshed + " 갱신 · 10분마다 자동";
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
  elements.futureList.replaceChildren();
}

async function loadPlace(place) {
  if (state.loading) return;
  setLoading(true);
  elements.currentSummary.textContent = "상세 날씨 데이터를 불러오는 중입니다.";
  try {
    const weather = await fetchWeather(place);
    state.lastRefreshAt = Date.now();
    renderPlace(place, weather);
    startAutoRefresh();
  } catch (error) {
    renderError(error.message || "날씨 데이터를 불러오지 못했습니다.");
  } finally {
    setLoading(false);
  }
}

async function loadByQuery(query) {
  if (!query.trim() || state.loading) return;
  setLoading(true);
  elements.resultStatus.textContent = "전세계 도시 후보를 찾는 중입니다.";
  elements.currentSummary.textContent = "위치 정보를 검색하는 중입니다.";
  try {
    state.places = await searchPlaces(query.trim());
    renderResults();
    setLoading(false);
    await loadPlace(state.places[0]);
  } catch (error) {
    renderError(error.message || "도시를 찾지 못했습니다.");
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
  if (!state.selectedPlace || !state.weather || state.loading) return;
  const place = state.selectedPlace;
  setLoading(true);
  elements.refreshButton.classList.add("refreshing");
  elements.refreshStatus.textContent = manual ? "새 날씨를 불러오는 중" : "자동 갱신 중";
  try {
    const forecast = await fetchLatestForecast(place);
    if (state.selectedPlace?.id !== place.id) return;
    state.weather = { forecast, archive: state.weather.archive };
    state.lastRefreshAt = Date.now();
    renderPlace(place, state.weather);
  } catch (error) {
    elements.refreshStatus.textContent = "갱신 실패 · 잠시 후 다시 시도";
  } finally {
    elements.refreshButton.classList.remove("refreshing");
    setLoading(false);
  }
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
  elements.unitButton.textContent = state.unit === "c" ? "°F 보기" : "°C 보기";
  elements.unitButton.setAttribute("aria-pressed", state.unit === "f");
  if (state.selectedPlace && state.weather) renderPlace(state.selectedPlace, state.weather);
});

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
elements.tabs.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));

elements.mapApplyButton.addEventListener("click", () => {
  loadByCoordinates(state.mapPoint.latitude, state.mapPoint.longitude, "지도 선택 위치");
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
initMap();
renderPresets();
loadByQuery(elements.input.value);
