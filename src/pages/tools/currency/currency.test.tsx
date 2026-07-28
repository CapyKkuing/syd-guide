import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CurrencyTool } from "./CurrencyTool";
import { convertAudToKrw, convertKrwToAud } from "./convert";

describe("currency conversion", () => {
  it("validates and converts both AUD and KRW amounts", () => {
    expect(convertAudToKrw(12.5, 900)).toBe(11_250);
    expect(convertKrwToAud(11_250, 900)).toBe(12.5);
    expect(() => convertAudToKrw(-1, 900)).toThrow(
      "AUD 금액은 0 이상이어야 합니다."
    );
    expect(() => convertAudToKrw(1, 0)).toThrow(
      "환율은 0보다 커야 합니다."
    );
    expect(() => convertKrwToAud(Number.NaN, 900)).toThrow(
      "KRW 금액은 0 이상이어야 합니다."
    );
  });

  it("uses direct input without requesting a rate on render", async () => {
    const request = vi.fn();
    render(
      <CurrencyTool
        request={request}
        settings={{
          get: vi.fn().mockResolvedValue(undefined),
          set: vi.fn().mockResolvedValue(undefined)
        }}
      />
    );

    await userEvent.clear(screen.getByLabelText("KRW/AUD 환율"));
    await userEvent.type(screen.getByLabelText("KRW/AUD 환율"), "900");
    await userEvent.clear(screen.getByLabelText("금액"));
    await userEvent.type(screen.getByLabelText("금액"), "12.5");

    expect(screen.getByText("11,250 KRW")).toBeVisible();
    expect(request).not.toHaveBeenCalled();

    await userEvent.selectOptions(
      screen.getByLabelText("환산 방향"),
      "krw-to-aud"
    );
    await userEvent.clear(screen.getByLabelText("금액"));
    await userEvent.type(screen.getByLabelText("금액"), "11250");
    expect(screen.getByText("12.50 AUD")).toBeVisible();
  });

  it("fetches only on demand and stores the latest successful rate and time", async () => {
    const settings = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      result: "success",
      time_last_update_utc: "Tue, 28 Jul 2026 12:00:00 +0000",
      rates: { KRW: 915.5 }
    }), { status: 200 }));

    render(
      <CurrencyTool
        request={request}
        settings={settings}
      />
    );
    expect(request).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "환율 불러오기" }));

    expect(request).toHaveBeenCalledWith(
      "https://open.er-api.com/v6/latest/AUD"
    );
    expect(screen.getByLabelText("KRW/AUD 환율")).toHaveValue(915.5);
    await waitFor(() => {
      expect(settings.set).toHaveBeenCalledWith("currency-latest", {
        rate: 915.5,
        fetchedAt: "2026-07-28T12:00:00.000Z"
      });
    });
  });

  it("keeps the user's rate when the network request fails", async () => {
    const settings = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined)
    };
    render(
      <CurrencyTool
        request={vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))}
        settings={settings}
      />
    );
    await userEvent.clear(screen.getByLabelText("KRW/AUD 환율"));
    await userEvent.type(screen.getByLabelText("KRW/AUD 환율"), "901");
    await userEvent.click(screen.getByRole("button", { name: "환율 불러오기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "환율을 불러오지 못했습니다"
    );
    expect(screen.getByLabelText("KRW/AUD 환율")).toHaveValue(901);
    expect(settings.set).not.toHaveBeenCalled();
  });

  it("loads the last successful local rate without a network request", async () => {
    const request = vi.fn();
    render(
      <CurrencyTool
        request={request}
        settings={{
          get: vi.fn().mockResolvedValue({
            rate: 905.25,
            fetchedAt: "2026-07-28T09:30:00.000Z"
          }),
          set: vi.fn().mockResolvedValue(undefined)
        }}
      />
    );

    expect(await screen.findByLabelText("KRW/AUD 환율")).toHaveValue(905.25);
    expect(screen.getByText(/2026\. 7\. 28\./)).toBeVisible();
    expect(request).not.toHaveBeenCalled();
  });
});
