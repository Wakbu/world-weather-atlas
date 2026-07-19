import { test, expect } from "@playwright/test";

function mockForecast() {
  const hourlyTime = Array.from({ length: 192 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 6, 19, index));
    return date.toISOString().slice(0, 13) + ":00";
  });
  const dailyTime = Array.from({ length: 8 }, (_, index) => "2026-07-" + String(19 + index).padStart(2, "0"));
  return {
    latitude: 37.56, longitude: 126.97, elevation: 38, timezone: "Asia/Seoul", utc_offset_seconds: 32400,
    current: { time: "2026-07-19T12:00", temperature_2m: 27, relative_humidity_2m: 68, apparent_temperature: 29, precipitation: 0, weather_code: 1, wind_speed_10m: 12, surface_pressure: 1008, cloud_cover: 22, is_day: 1 },
    hourly: {
      time: hourlyTime,
      temperature_2m: hourlyTime.map((_, i) => 24 + Math.sin(i / 5) * 4),
      relative_humidity_2m: hourlyTime.map(() => 68),
      precipitation_probability: hourlyTime.map((_, i) => i % 17 === 0 ? 65 : 10),
      precipitation: hourlyTime.map(() => 0),
      weather_code: hourlyTime.map(() => 1),
      wind_speed_10m: hourlyTime.map(() => 12),
      wind_direction_10m: hourlyTime.map(() => 210),
      surface_pressure: hourlyTime.map(() => 1008),
      cloud_cover: hourlyTime.map(() => 22),
      visibility: hourlyTime.map(() => 18000),
      uv_index: hourlyTime.map((_, i) => i % 24 > 8 && i % 24 < 18 ? 6 : 0),
    },
    daily: {
      time: dailyTime,
      weather_code: dailyTime.map(() => 1),
      temperature_2m_max: dailyTime.map((_, i) => 30 + i % 2),
      temperature_2m_min: dailyTime.map(() => 22),
      precipitation_sum: dailyTime.map(() => 0),
      precipitation_probability_max: dailyTime.map(() => 20),
      wind_speed_10m_max: dailyTime.map(() => 18),
      sunrise: dailyTime.map((day) => day + "T05:25"),
      sunset: dailyTime.map((day) => day + "T19:48"),
      daylight_duration: dailyTime.map(() => 51780),
      uv_index_max: dailyTime.map(() => 7),
    },
  };
}

function mockArchive() {
  const time = Array.from({ length: 7 }, (_, index) => "2026-07-" + String(12 + index).padStart(2, "0"));
  return { timezone: "Asia/Seoul", utc_offset_seconds: 32400, daily: { time, weather_code: time.map(() => 2), temperature_2m_max: time.map(() => 29), temperature_2m_min: time.map(() => 21), precipitation_sum: time.map(() => 1), wind_speed_10m_max: time.map(() => 16) } };
}

async function mockApis(page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "geocoding-api.open-meteo.com") {
      return route.fulfill({ json: { results: [{ name: "서울", admin1: "서울특별시", country: "대한민국", country_code: "KR", latitude: 37.5665, longitude: 126.978, timezone: "Asia/Seoul", elevation: 38 }] } });
    }
    if (url.hostname === "api.open-meteo.com") return route.fulfill({ json: mockForecast() });
    if (url.hostname === "archive-api.open-meteo.com") return route.fulfill({ json: mockArchive() });
    if (url.hostname === "air-quality-api.open-meteo.com") return route.fulfill({ json: { current: { us_aqi: 42, pm10: 18, pm2_5: 9, ozone: 44, nitrogen_dioxide: 12 }, hourly: { us_aqi: [42], pm10: [18], pm2_5: [9] } } });
    if (url.hostname === "api.weather.gov") {
      return route.fulfill({ json: { features: [{ properties: { event: "Heat Advisory", headline: "Heat Advisory remains in effect", severity: "Moderate", expires: "2026-07-20T02:00:00Z" } }] } });
    }
    if (url.hostname === "api.rainviewer.com") return route.fulfill({ json: { host: "https://tilecache.rainviewer.com", radar: { past: [] } } });
    return route.continue();
  });
}

test.beforeEach(async ({ page }) => {
  await mockApis(page);
});

test("overview is readable without horizontal overflow", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("#settingsPanel")).toBeHidden();
  await expect(page.locator("#currentTemp")).toContainText("27");
  await expect(page.locator("#placeName")).toContainText("서울");
  await expect(page.locator("#precipTimeline .precip-hour")).toHaveCount(24);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/visual/" + testInfo.project.name + "-overview.png", fullPage: false, animations: "disabled" });
});

test("tabs and official alerts expose their state", async ({ page }) => {
  await page.goto("/?lat=40.7128&lon=-74.0060&name=New%20York");
  await expect(page.locator("#officialAlertPanel")).toBeVisible();
  await expect(page.locator("#officialAlertTitle")).toContainText(/1|active/);
  await page.getByRole("tab", { name: /48시간|48 hours/ }).click();
  await expect(page.locator("#tab-hourly")).toBeVisible();
  await expect(page.getByRole("tab", { name: /48시간|48 hours/ })).toHaveAttribute("aria-selected", "true");
});