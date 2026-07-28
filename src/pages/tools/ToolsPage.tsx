import { useEffect, type ReactNode } from "react";
import { ThemeControl } from "../../app/theme/ThemeControl";
import { Icon } from "../../components/Icon";
import { OfflineBanner } from "../../components/OfflineBanner";
import type { ToolItemView, ToolsViewModel, TripWorkspace } from "../../data/contracts";
import type { TripMutationController } from "../../services/mutations/controller";
import { ActivityPanel } from "./activity/ActivityPanel";
import { BookingsPanel } from "./bookings/BookingsPanel";
import { ChecklistPanel } from "./checklist/ChecklistPanel";
import { NotesPanel } from "./notes/NotesPanel";
import { SearchPanel } from "./search/SearchPanel";

interface ToolsPageProps {
  tools: ToolsViewModel;
  deviceManagement: ReactNode;
  mutationController?: TripMutationController;
  reload?: () => void;
  workspace?: TripWorkspace;
}

const approvedDeepLinks = new Set(["bookings", "checklist", "notes", "search", "activity", "devices", "emergency"]);

function ToolCard({
  controller,
  deviceManagement,
  item,
  tools
}: {
  controller?: TripMutationController;
  deviceManagement: ReactNode;
  item: ToolItemView;
  tools: ToolsViewModel;
}) {
  const id = approvedDeepLinks.has(item.id) ? item.id : undefined;

  if (item.id === "bookings") {
    return (
      <article className="tool-card tool-card--wide" id="bookings">
        <div className="tool-card__heading"><h3>{item.label}</h3></div>
        <p>{item.description}</p>
        <BookingsPanel bookings={tools.bookings} controller={controller} places={tools.places} timeZone={tools.timeZone} />
      </article>
    );
  }

  if (item.id === "checklist") {
    return (
      <article className="tool-card tool-card--wide" id="checklist">
        <div className="tool-card__heading"><h3>{item.label}</h3></div>
        <p>{item.description}</p>
        <ChecklistPanel controller={controller} items={tools.checkItems} members={tools.members} viewerMemberId={tools.viewerMemberId} />
      </article>
    );
  }

  if (item.id === "notes") {
    return (
      <article className="tool-card tool-card--wide" id="notes">
        <div className="tool-card__heading"><h3>{item.label}</h3></div>
        <p>{item.description}</p>
        <NotesPanel controller={controller} notes={tools.notes} tripId={tools.tripId} viewerMemberId={tools.viewerMemberId} />
      </article>
    );
  }

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

export function ToolsPage({
  deviceManagement,
  mutationController,
  reload = () => undefined,
  tools,
  workspace
}: ToolsPageProps) {
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
      {workspace ? (
        <div className="tools-overview">
          <SearchPanel workspace={workspace} />
          <ActivityPanel activity={tools.activity} reload={reload} />
        </div>
      ) : null}
      <div className="tools-groups">
        {tools.groups.map((group) => (
          <section className="tools-group" key={group.id} aria-labelledby={`tools-${group.id}-title`}>
            <h2 id={`tools-${group.id}-title`}>{group.title}</h2>
            <div className="tools-group__items">
              {group.items.map((item) => (
                <ToolCard
                  controller={mutationController}
                  deviceManagement={deviceManagement}
                  item={item}
                  key={item.id}
                  tools={tools}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
