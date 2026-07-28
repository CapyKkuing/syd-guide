import { useEffect, type ReactNode } from "react";
import { ThemeControl } from "../../app/theme/ThemeControl";
import { Icon } from "../../components/Icon";
import { OfflineBanner } from "../../components/OfflineBanner";
import type { ToolItemView, ToolsViewModel } from "../../data/contracts";

interface ToolsPageProps {
  tools: ToolsViewModel;
  deviceManagement: ReactNode;
}

const approvedDeepLinks = new Set(["bookings", "devices", "emergency"]);

function ToolCard({ item, deviceManagement }: { item: ToolItemView; deviceManagement: ReactNode }) {
  const id = approvedDeepLinks.has(item.id) ? item.id : undefined;

  if (item.status === "preview") {
    return (
      <article className="tool-card tool-card--preview" id={id}>
        <div className="tool-card__heading">
          <h3>{item.label}</h3>
          <span className="tool-status">준비 중</span>
        </div>
        <p>{item.description}</p>
      </article>
    );
  }

  if (item.id === "devices") {
    return (
      <article className="tool-card tool-card--management" id="devices">
        <div className="tool-card__heading">
          <h3>{item.label}</h3>
        </div>
        <p>{item.description}</p>
        <div className="tool-card__slot">{deviceManagement}</div>
      </article>
    );
  }

  if (item.id === "theme") {
    return (
      <article className="tool-card tool-card--management">
        <div className="tool-card__heading"><h3>{item.label}</h3></div>
        <p>{item.description}</p>
        <ThemeControl />
      </article>
    );
  }

  if (item.id === "offline-sync") {
    return (
      <article className="tool-card tool-card--management">
        <div className="tool-card__heading"><h3>{item.label}</h3></div>
        <p>{item.description}</p>
        <OfflineBanner />
      </article>
    );
  }

  return (
    <article className="tool-card tool-card--preview">
      <div className="tool-card__heading"><h3>{item.label}</h3></div>
      <p>{item.description}</p>
    </article>
  );
}

export function ToolsPage({ tools, deviceManagement }: ToolsPageProps) {
  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!approvedDeepLinks.has(targetId)) return;
    document.getElementById(targetId)?.scrollIntoView?.({ block: "start" });
  }, []);

  return (
    <section className="tools-page" aria-labelledby="tools-title">
      <header className="tools-page__header">
        <Icon className="tools-page__icon" name="tools" />
        <div>
          <h1 id="tools-title">도구</h1>
          <p>여행에 필요한 정보와 설정을 정리합니다.</p>
        </div>
      </header>
      <div className="tools-groups">
        {tools.groups.map((group) => (
          <section className="tools-group" key={group.id} aria-labelledby={`tools-${group.id}-title`}>
            <h2 id={`tools-${group.id}-title`}>{group.title}</h2>
            <div className="tools-group__items">
              {group.items.map((item) => <ToolCard item={item} deviceManagement={deviceManagement} key={item.id} />)}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
