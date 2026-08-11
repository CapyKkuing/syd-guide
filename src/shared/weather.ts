export interface WeatherForecastDay {
  date: string;
  condition: string;
  conditionCode: number;
  maxTemperatureC: number;
  minTemperatureC: number;
}

export interface WeatherLocation {
  name: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

export interface WeatherSnapshot {
  location: WeatherLocation;
  condition: string;
  conditionCode: number;
  temperatureC: number;
  uvIndex: number;
  observedAt: string;
  fetchedAt: string;
  forecast: WeatherForecastDay[];
}

export type WeatherResponse =
  | {
      status: "live" | "cached";
      weather: WeatherSnapshot;
      message: null;
      attribution: "Open-Meteo · BOM ACCESS-G";
      disclaimer: string;
    }
  | {
      status: "quota" | "unavailable";
      location: string;
      weather: null;
      message: string;
      attribution: "Open-Meteo · BOM ACCESS-G";
      disclaimer: string;
    };

export const WEATHER_DISCLAIMER = "일반 참고용 정보입니다.";

export function unavailableWeather(
  location: string,
  message = "실제 날씨 정보를 아직 불러올 수 없습니다."
): WeatherResponse {
  return {
    status: "unavailable",
    location,
    weather: null,
    message,
    attribution: "Open-Meteo · BOM ACCESS-G",
    disclaimer: WEATHER_DISCLAIMER,
  };
}

export function quotaWeather(location: string): WeatherResponse {
  return {
    status: "quota",
    location,
    weather: null,
    message: "이번 달 날씨 무료 보호 한도에 도달했습니다.",
    attribution: "Open-Meteo · BOM ACCESS-G",
    disclaimer: WEATHER_DISCLAIMER,
  };
}
