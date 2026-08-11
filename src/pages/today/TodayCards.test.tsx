import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeatherCard } from "./TodayCards";

describe("WeatherCard", () => {
  it("shows live Open-Meteo BOM data with its source and disclaimer", () => {
    render(<WeatherCard weather={{
      status: "live",
      weather: {
        location: {
          name: "Sydney",
          latitude: -33.87,
          longitude: 151.21,
          timeZone: "Australia/Sydney",
        },
        condition: "맑음",
        conditionCode: 1000,
        temperatureC: 19.5,
        uvIndex: 4,
        observedAt: "2026-08-12T00:00:00.000Z",
        fetchedAt: "2026-08-12T00:00:00.000Z",
        forecast: [],
      },
      message: null,
      attribution: "Open-Meteo · BOM ACCESS-G",
      disclaimer: "일반 참고용 정보입니다.",
    }} />);

    expect(screen.getByText("19.5°C · 맑음")).toBeVisible();
    expect(screen.getByText("Sydney · UV 4")).toBeVisible();
    expect(screen.getByText("실시간")).toBeVisible();
    expect(screen.getByText(/출처: Open-Meteo · BOM ACCESS-G/)).toBeVisible();
  });

  it("does not show sample values when weather is unavailable", () => {
    render(<WeatherCard weather={{
      status: "unavailable",
      location: "Sydney",
      weather: null,
      message: "현재 날씨 정보를 불러올 수 없습니다.",
      attribution: "Open-Meteo · BOM ACCESS-G",
      disclaimer: "일반 참고용 정보입니다.",
    }} />);

    expect(screen.getByText("현재 날씨 정보를 불러올 수 없습니다.")).toBeVisible();
    expect(screen.queryByText(/21°C/)).not.toBeInTheDocument();
  });
});
