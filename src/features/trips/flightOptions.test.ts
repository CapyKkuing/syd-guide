import { describe, expect, it } from "vitest";
import {
  airlineOptions,
  airportOptions,
  findAirlineOption,
  findAirportOption,
  flightTimeZones,
} from "./flightOptions";

describe("flight search options", () => {
  it("matches airports by Korean name, English alias, and IATA code", () => {
    expect(findAirportOption("인천")?.iata).toBe("ICN");
    expect(findAirportOption("incheon")?.iata).toBe("ICN");
    expect(findAirportOption("icn")?.name).toBe("인천국제공항");
  });

  it("does not choose an airport when a city matches more than one", () => {
    expect(findAirportOption("서울")).toBeUndefined();
    expect(findAirportOption("직접 입력 공항")).toBeUndefined();
  });

  it("matches airlines by name, alias, and code", () => {
    expect(findAirlineOption("KE")?.name).toBe("대한항공");
    expect(findAirlineOption("Korean Air")?.code).toBe("KE");
    expect(findAirlineOption("직접 입력 항공사")).toBeUndefined();
  });

  it("covers major Korean, Australian, and transfer options with full time zones", () => {
    expect(airlineOptions.length).toBeGreaterThanOrEqual(40);
    expect(airportOptions.length).toBeGreaterThanOrEqual(50);
    expect(findAirportOption("창이")?.iata).toBe("SIN");
    expect(findAirportOption("다윈")?.timeZone).toBe("Australia/Darwin");
    expect(flightTimeZones).toContain("Asia/Seoul");
    expect(flightTimeZones.length).toBeGreaterThanOrEqual(50);
  });
});
