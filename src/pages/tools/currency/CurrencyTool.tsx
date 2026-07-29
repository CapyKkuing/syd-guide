import { useEffect, useState } from "react";
import {
  localSettings,
  type SettingsStore
} from "../../../services/offline/settingsStore";
import { DataFreshness, type Freshness } from "../../../components/DataFreshness";
import { convertAudToKrw, convertKrwToAud } from "./convert";

type ConversionDirection = "aud-to-krw" | "krw-to-aud";

interface LatestCurrencyRate {
  rate: number;
  fetchedAt: string;
}

const requestRate = (url: string) => fetch(url);

interface CurrencyToolProps {
  settings?: Pick<SettingsStore, "get" | "set">;
  request?: typeof requestRate;
}

const RATE_URL = "https://open.er-api.com/v6/latest/AUD";

export function CurrencyTool({
  request = requestRate,
  settings = localSettings
}: CurrencyToolProps) {
  const [direction, setDirection] =
    useState<ConversionDirection>("aud-to-krw");
  const [amount, setAmount] = useState("1");
  const [rate, setRate] = useState("");
  const [freshness, setFreshness] = useState<Freshness>({ source: "sample", updatedAt: null });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    settings.get<unknown>("currency-latest").then((saved) => {
      if (!active || !isLatestRate(saved)) return;
      setRate(String(saved.rate));
      setFreshness({ source: "cached", updatedAt: saved.fetchedAt });
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [settings]);

  const loadRate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await request(RATE_URL);
      if (!response.ok) throw new Error("rate request failed");
      const latest = parseRateResponse(await response.json());
      await settings.set("currency-latest", latest);
      setRate(String(latest.rate));
      setFreshness({ source: "live", updatedAt: latest.fetchedAt });
    } catch {
      setError("환율을 불러오지 못했습니다. 입력한 환율을 그대로 사용합니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tool-panel currency-tool">
      <div className="tool-search-controls">
        <label>
          환산 방향
          <select
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value as ConversionDirection);
              setAmount("1");
            }}
          >
            <option value="aud-to-krw">AUD → KRW</option>
            <option value="krw-to-aud">KRW → AUD</option>
          </select>
        </label>
        <label>
          금액
          <input
            min="0"
            inputMode="decimal"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          KRW/AUD 환율
          <input
            min="0"
            inputMode="decimal"
            step="0.01"
            type="number"
            value={rate}
            onChange={(event) => {
              setRate(event.target.value);
              setFreshness({ source: "sample", updatedAt: null });
            }}
          />
        </label>
      </div>
      <output className="currency-tool__result" aria-live="polite">
        {formatResult(direction, amount, rate)}
      </output>
      <button
        className="secondary-button"
        type="button"
        disabled={loading}
        onClick={loadRate}
      >
        {loading ? "불러오는 중" : "환율 불러오기"}
      </button>
      <DataFreshness value={freshness} />
      {freshness.source === "sample" ? <p className="currency-tool__time">환율을 직접 입력하거나 필요할 때만 불러오세요.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

function formatResult(
  direction: ConversionDirection,
  amountValue: string,
  rateValue: string
) {
  const amount = Number(amountValue);
  const rate = Number(rateValue);
  if (!amountValue || !rateValue) return "금액과 환율을 입력하세요.";

  try {
    return direction === "aud-to-krw"
      ? `${convertAudToKrw(amount, rate).toLocaleString("en-US")} KRW`
      : `${convertKrwToAud(amount, rate).toFixed(2)} AUD`;
  } catch {
    return "0 이상의 금액과 0보다 큰 환율을 입력하세요.";
  }
}

function parseRateResponse(value: unknown): LatestCurrencyRate {
  if (!value || typeof value !== "object" || !("rates" in value)) {
    throw new Error("invalid rate response");
  }
  const rates = value.rates;
  if (!rates || typeof rates !== "object" || !("KRW" in rates)) {
    throw new Error("missing KRW rate");
  }
  const rate = rates.KRW;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("invalid KRW rate");
  }
  const rawTime = "time_last_update_utc" in value
    ? value.time_last_update_utc
    : null;
  if (typeof rawTime !== "string") throw new Error("missing rate time");
  const fetchedAt = new Date(rawTime);
  if (Number.isNaN(fetchedAt.getTime())) throw new Error("invalid rate time");
  return { rate, fetchedAt: fetchedAt.toISOString() };
}

function isLatestRate(value: unknown): value is LatestCurrencyRate {
  if (!value || typeof value !== "object") return false;
  if (!("rate" in value) || !("fetchedAt" in value)) return false;
  return typeof value.rate === "number"
    && Number.isFinite(value.rate)
    && value.rate > 0
    && typeof value.fetchedAt === "string"
    && !Number.isNaN(new Date(value.fetchedAt).getTime());
}
