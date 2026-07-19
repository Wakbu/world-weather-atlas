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
      precipitation_sum: dailyTime.map((_, i) => [0, 38, 12, 55, 4, 28, 46, 8][i]),
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
  return { timezone: "Asia/Seoul", utc_offset_seconds: 32400, daily: { time, weather_code: time.map(() => 2), temperature_2m_max: time.map(() => 29), temperature_2m_min: time.map(() => 21), precipitation_sum: time.map((_, i) => [32, 4, 47, 18, 55, 7, 38][i]), wind_speed_10m_max: time.map(() => 16) } };
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

async function crossGroupOverlaps(page, firstSelector, secondSelector) {
  return page.evaluate(({ firstSelector, secondSelector }) => {
    const boxes = (selector) => [...document.querySelectorAll(selector)].map((element) => {
      const box = element.getBBox();
      return { x: box.x, y: box.y, width: box.width, height: box.height, text: element.textContent };
    });
    const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    return boxes(firstSelector).flatMap((first) => boxes(secondSelector).filter((second) => overlaps(first, second)).map((second) => ({ first, second })));
  }, { firstSelector, secondSelector });
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

test("tabs and official alerts expose their state", async ({ page }, testInfo) => {
  await page.goto("/?lat=40.7128&lon=-74.0060&name=New%20York");
  await expect(page.locator("#officialAlertPanel")).toBeVisible();
  await expect(page.locator("#officialAlertTitle")).toContainText(/1|active/);
  if (testInfo.project.name === "mobile") {
    await page.locator('[data-mobile-tab="hourly"]').click();
    await expect(page.locator('[data-mobile-tab="hourly"]')).toHaveAttribute("aria-current", "page");
  } else {
    await page.locator('.tab-button[data-tab="hourly"]').click();
    await expect(page.locator('.tab-button[data-tab="hourly"]')).toHaveAttribute("aria-selected", "true");
  }
  await expect(page.locator("#tab-hourly")).toBeVisible();
});
test("mobile navigation and location details stay intentional", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only interaction");
  await page.goto("/");
  await expect(page.locator(".mobile-dock")).toBeVisible();
  await page.locator("#settingsButton").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await expect(page.locator("#refreshButton")).toBeVisible();
  await page.locator("#settingsButton").click();
  await expect(page.locator(".tabbar")).toBeHidden();
  await page.locator('[data-mobile-tab="hourly"]').click();
  await expect(page.locator("#tab-hourly")).toBeVisible();
  await page.locator("#mobileMoreButton").click();
  await expect(page.locator("#mobileMoreMenu")).toBeVisible();
  await page.locator('[data-mobile-tab="weekly"]').click();
  await expect(page.locator("#tab-weekly")).toBeVisible();
  await page.locator('[data-mobile-tab="overview"]').click();
  await expect(page.locator("#locationMetaPanel")).toBeHidden();
  await page.locator("#locationMetaToggle").click();
  await expect(page.locator("#locationMetaPanel")).toBeVisible();
});

test("dark theme keeps core surfaces readable", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("weather-theme", "dark"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const ratios = await page.evaluate(() => {
    const rgb = (value) => (value.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);
    const luminance = (value) => {
      const values = rgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    const ratio = (foreground, background) => {
      const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    };
    return [["body", "body"], [".panel", ".panel"], [".advice-copy h2", ".advice-panel"], [".advice-copy > p:not(.advice-label)", ".advice-panel"], [".search input", ".search"]].map(([textSelector, surfaceSelector]) => {
      const textStyle = getComputedStyle(document.querySelector(textSelector));
      const surfaceStyle = getComputedStyle(document.querySelector(surfaceSelector));
      return ratio(textStyle.color, surfaceStyle.backgroundColor);
    });
  });
  expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: "test-results/visual/" + testInfo.project.name + "-dark.png", fullPage: false, animations: "disabled" });
});
test("desktop favorites form a compact city rail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only layout");
  await page.goto("/");
  await expect(page.locator(".saved-places-bar")).toBeVisible();
  await expect(page.locator(".favorite-empty")).toBeVisible();
  await page.locator("#favoriteButton").click();
  await expect(page.locator(".favorite-quick-list .place-chip")).toHaveCount(1);
  const rail = await page.locator(".saved-places-bar").boundingBox();
  expect(rail.height).toBeLessThanOrEqual(90);
  await page.screenshot({ path: "test-results/visual/desktop-favorites.png", fullPage: false, animations: "disabled" });
});
test("dark chart labels follow the readable theme color", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("weather-theme", "dark"));
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await page.locator('[data-mobile-tab="hourly"]').click();
  } else {
    await page.locator('.tab-button[data-tab="hourly"]').click();
  }
  await expect(page.locator(".hour-temp-value").first()).toBeVisible();
  const bodyColor = await page.locator("body").evaluate((element) => getComputedStyle(element).color);
  const hourlyFill = await page.locator(".hour-temp-value").first().evaluate((element) => getComputedStyle(element).fill);
  expect(hourlyFill).toBe(bodyColor);

  if (testInfo.project.name === "mobile") {
    await page.locator("#mobileMoreButton").click();
    await page.locator('[data-mobile-tab="weekly"]').click();
  } else {
    await page.locator('.tab-button[data-tab="weekly"]').click();
  }
  await expect(page.locator(".chart-value").first()).toBeVisible();
  const weeklyFill = await page.locator(".chart-value").first().evaluate((element) => getComputedStyle(element).fill);
  expect(weeklyFill).toBe(bodyColor);
  await page.screenshot({ path: "test-results/visual/" + testInfo.project.name + "-dark-chart.png", fullPage: false, animations: "disabled" });
});
test("temperature and precipitation graphics keep separate label lanes", async ({ page }, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await page.locator('[data-mobile-tab="hourly"]').click();
  } else {
    await page.locator('.tab-button[data-tab="hourly"]').click();
  }
  await expect(page.locator(".hour-temp-value").first()).toBeVisible();
  expect(await crossGroupOverlaps(page, ".hour-temp-value", ".hour-rain-bar")).toEqual([]);

  if (testInfo.project.name === "mobile") {
    await page.locator("#mobileMoreButton").click();
    await page.locator('[data-mobile-tab="weekly"]').click();
  } else {
    await page.locator('.tab-button[data-tab="weekly"]').click();
  }
  await expect(page.locator(".chart-rain").first()).toBeVisible();
  expect(await crossGroupOverlaps(page, "#tab-weekly .chart-value", "#tab-weekly .chart-rain")).toEqual([]);
  expect(await crossGroupOverlaps(page, "#tab-weekly .chart-rain", "#tab-weekly .rain-bar")).toEqual([]);
  expect(await crossGroupOverlaps(page, "#tab-weekly .chart-value.high", "#tab-weekly .chart-value.low")).toEqual([]);

  if (testInfo.project.name === "mobile") {
    await page.locator("#mobileMoreButton").click();
    await page.locator('[data-mobile-tab="history"]').click();
  } else {
    await page.locator('.tab-button[data-tab="history"]').click();
  }
  await expect(page.locator("#historyChart .chart-rain").first()).toBeVisible();
  const historySvg = await page.locator("#historyChart svg").boundingBox();
  expect(historySvg.width / historySvg.height).toBeCloseTo(840 / 330, 1);
  expect(await crossGroupOverlaps(page, "#historyChart .chart-value", "#historyChart .chart-rain")).toEqual([]);
  expect(await crossGroupOverlaps(page, "#historyChart .chart-rain", "#historyChart .rain-bar")).toEqual([]);
  expect(await crossGroupOverlaps(page, "#historyChart .chart-value.high", "#historyChart .chart-value.low")).toEqual([]);
  await page.locator("#historyChart").screenshot({ path: "test-results/visual/" + testInfo.project.name + "-chart-spacing.png", animations: "disabled" });
});