import { useEffect, useState } from "react";
import type { TripWorkspace } from "../../../data/contracts";
import {
  localSettings,
  type SettingsStore
} from "../../../services/offline/settingsStore";
import {
  buildAiPrompt,
  type AiPromptScope
} from "./prompt";

type AiProvider = "chatgpt" | "gemini";

interface AiLauncherProps {
  workspace: TripWorkspace;
  settings?: Pick<SettingsStore, "get" | "set">;
  openProvider?: typeof openProviderTab;
  copyPrompt?: typeof writePrompt;
}

const providers = {
  chatgpt: { label: "ChatGPT", url: "https://chatgpt.com/" },
  gemini: { label: "Gemini", url: "https://gemini.google.com/app" }
} satisfies Record<AiProvider, { label: string; url: string }>;

const openProviderTab = (url: string) =>
  window.open(url, "_blank", "noopener,noreferrer");

async function writePrompt(prompt: string) {
  if (!navigator.clipboard) throw new Error("clipboard unavailable");
  await navigator.clipboard.writeText(prompt);
}

export function AiLauncher({
  copyPrompt = writePrompt,
  openProvider = openProviderTab,
  settings = localSettings,
  workspace
}: AiLauncherProps) {
  const [provider, setProvider] = useState<AiProvider>("chatgpt");
  const [scope, setScope] = useState<AiPromptScope>("trip");
  const [selectedId, setSelectedId] = useState(
    workspace.mapPreview.places[0]?.id ?? ""
  );
  const [fallbackPrompt, setFallbackPrompt] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    settings.get<unknown>("ai-provider").then((saved) => {
      if (active && (saved === "chatgpt" || saved === "gemini")) {
        setProvider(saved);
      }
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [settings]);

  const chooseProvider = (next: AiProvider) => {
    setProvider(next);
    settings.set("ai-provider", next).catch(() => {
      setStatus("AI 공급자 선택을 이 기기에 저장하지 못했습니다.");
    });
  };

  const launch = async () => {
    const prompt = buildAiPrompt(workspace, {
      scope,
      selectedId: scope === "place" ? selectedId : null
    });
    const selectedProvider = providers[provider];
    const popup = openProvider(selectedProvider.url);
    setPopupBlocked(popup === null);
    setFallbackPrompt(null);

    try {
      await copyPrompt(prompt);
      setStatus("질문을 복사했습니다. 열린 AI 화면에 붙여넣으세요.");
    } catch {
      setFallbackPrompt(prompt);
      setStatus("자동 복사가 차단됐습니다. 아래 질문을 직접 복사하세요.");
    }
  };

  return (
    <div className="tool-panel ai-launcher">
      <div className="tool-search-controls">
        <label>
          AI 공급자
          <select
            value={provider}
            onChange={(event) => chooseProvider(event.target.value as AiProvider)}
          >
            <option value="chatgpt">ChatGPT</option>
            <option value="gemini">Gemini</option>
          </select>
        </label>
        <label>
          질문 범위
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as AiPromptScope)}
          >
            <option value="trip">여행 전체</option>
            <option value="today">오늘 일정</option>
            <option value="place">선택한 장소</option>
          </select>
        </label>
      </div>
      {scope === "place" ? (
        <label className="tool-filter">
          장소
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {workspace.mapPreview.places.map((place) => (
              <option key={place.id} value={place.id}>{place.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="tool-privacy-note">
        예약번호·예약 메모·개인 메모는 질문에서 항상 제외합니다.
      </p>
      <button className="primary-button" type="button" onClick={launch}>
        AI에서 질문하기
      </button>
      {status ? <p role="status">{status}</p> : null}
      {fallbackPrompt ? (
        <label>
          복사할 질문
          <textarea readOnly rows={10} value={fallbackPrompt} />
        </label>
      ) : null}
      {popupBlocked ? (
        <a
          href={providers[provider].url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {providers[provider].label} 열기
        </a>
      ) : null}
    </div>
  );
}
