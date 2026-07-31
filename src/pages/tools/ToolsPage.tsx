import {
  Grid,
  Heading,
  HStack,
  Icon,
  Text,
  VStack,
} from "@astryxdesign/core";
import type { ReactNode } from "react";
import { pathForTool, pathForTrip, type ToolRouteId } from "../../app/router";
import { ThemeControl } from "../../app/theme/ThemeControl";
import { AppLink } from "../../components/AppLink";
import { OfflineBanner } from "../../components/OfflineBanner";
import type { ToolItemView, ToolsViewModel, TripWorkspace } from "../../data/contracts";
import type { TripMutationController } from "../../services/mutations/controller";
import { ActivityPanel } from "./activity/ActivityPanel";
import { AiLauncher } from "./ai/AiLauncher";
import { BookingsPanel } from "./bookings/BookingsPanel";
import { ChecklistPanel } from "./checklist/ChecklistPanel";
import { CurrencyTool } from "./currency/CurrencyTool";
import { NotesPanel } from "./notes/NotesPanel";
import { SearchPanel } from "./search/SearchPanel";

interface ToolsPageProps {
  activeToolId?: ToolRouteId;
  tools: ToolsViewModel;
  deviceManagement: ReactNode;
  mutationController?: TripMutationController;
  reload?: () => void;
  workspace?: TripWorkspace;
}

const quickToolGroups = [
  { id: "planning", label: "예약·준비", toolIds: ["bookings", "checklist"] },
  { id: "record", label: "기록·계산", toolIds: ["notes", "exchange"] },
  { id: "find", label: "찾기·변경", toolIds: ["search", "activity"] }
];
const shortcutLabels: Record<string, string> = {
  search: "여행 검색",
  activity: "최근 변경"
};
const standaloneTools = {
  search: {
    id: "search",
    label: "여행 검색",
    description: "일정, 장소, 예약과 메모를 한 번에 찾습니다.",
    status: "available"
  },
  activity: {
    id: "activity",
    label: "최근 변경",
    description: "여행에서 최근 바뀐 내용을 확인합니다.",
    status: "available"
  }
} satisfies Record<"search" | "activity", ToolItemView>;

interface QuickToolItem {
  id: string;
  label: string;
}

function quickToolIcon(id: string) {
  switch (id) {
    case "bookings": return "calendar";
    case "checklist": return "check";
    case "notes": return "copy";
    case "exchange": return "arrowsUpDown";
    case "search": return "search";
    default: return "clock";
  }
}

function QuickToolLaunch({ item, tripId }: { item: QuickToolItem; tripId: string }) {
  return (
    <AppLink
      aria-label={`${item.label} 열기`}
      className="tools-quick-action"
      href={pathForTool(tripId, item.id as ToolRouteId)}
    >
      <Icon icon={quickToolIcon(item.id)} size="sm" />
      {item.label}
    </AppLink>
  );
}

function ToolLaunchCard({ item, tripId }: { item: ToolItemView; tripId: string }) {
  return (
    <AppLink
      aria-label={`${item.label} 열기`}
      className="tool-launch-card"
      href={pathForTool(tripId, item.id as ToolRouteId)}
    >
      <VStack gap={2}>
        <HStack className="tool-launch-card__heading" gap={2}>
          <Heading level={3}>{item.label}</Heading>
          {item.status === "preview" ? <Text className="tool-status" type="label">준비 중</Text> : null}
        </HStack>
        <Text color="secondary" type="body">{item.description}</Text>
        <Text className="tool-launch-card__action" type="label">열기</Text>
      </VStack>
    </AppLink>
  );
}

function ToolCard({
  controller,
  deviceManagement,
  item,
  reload,
  tools,
  workspace
}: {
  controller?: TripMutationController;
  deviceManagement: ReactNode;
  item: ToolItemView;
  reload: () => void;
  tools: ToolsViewModel;
  workspace?: TripWorkspace;
}) {
  if (item.id === "bookings") {
    return (
      <article className="tool-card tool-card--wide" id="bookings">
        <div className="tool-card__heading"><h1>{item.label}</h1></div>
        <p>{item.description}</p>
        <BookingsPanel
          bookings={tools.bookings}
          controller={controller}
          experiencePhase={workspace?.context.trip.experiencePhase}
          localDate={workspace?.context.localDate}
          places={tools.places}
          timeZone={tools.timeZone}
        />
      </article>
    );
  }

  if (item.id === "checklist") {
    return (
      <article className="tool-card tool-card--wide" id="checklist">
        <div className="tool-card__heading"><h1>{item.label}</h1></div>
        <p>{item.description}</p>
        <ChecklistPanel controller={controller} items={tools.checkItems} members={tools.members} viewerMemberId={tools.viewerMemberId} />
      </article>
    );
  }

  if (item.id === "notes") {
    return (
      <article className="tool-card tool-card--wide" id="notes">
        <div className="tool-card__heading"><h1>{item.label}</h1></div>
        <p>{item.description}</p>
        <NotesPanel controller={controller} notes={tools.notes} tripId={tools.tripId} viewerMemberId={tools.viewerMemberId} />
      </article>
    );
  }

  if (item.id === "exchange") {
    return (
      <article className="tool-card tool-card--wide" id="exchange">
        <div className="tool-card__heading"><h1>{item.label}</h1></div>
        <p>{item.description}</p>
        <CurrencyTool />
      </article>
    );
  }

  if (item.id === "ai-connect" && workspace) {
    return (
      <article className="tool-card tool-card--wide" id="ai-connect">
        <div className="tool-card__heading"><h1>{item.label}</h1></div>
        <p>{item.description}</p>
        <AiLauncher workspace={workspace} />
      </article>
    );
  }

  if (item.id === "search" && workspace) {
    return <SearchPanel workspace={workspace} />;
  }

  if (item.id === "activity") {
    return <ActivityPanel activity={tools.activity} reload={reload} />;
  }

  if (item.status === "preview") {
    return (
      <article className="tool-card tool-card--preview" id={item.id}>
        <div className="tool-card__heading">
          <h1>{item.label}</h1>
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
          <h1>{item.label}</h1>
        </div>
        <p>{item.description}</p>
        <div className="tool-card__slot">{deviceManagement}</div>
      </article>
    );
  }

  if (item.id === "theme") {
    return (
      <article className="tool-card tool-card--management">
        <div className="tool-card__heading"><h1>{item.label}</h1></div>
        <p>{item.description}</p>
        <ThemeControl />
      </article>
    );
  }

  if (item.id === "offline-sync") {
    return (
      <article className="tool-card tool-card--management">
        <div className="tool-card__heading"><h1>{item.label}</h1></div>
        <p>{item.description}</p>
        <OfflineBanner />
      </article>
    );
  }

  return (
    <article className="tool-card tool-card--preview">
      <div className="tool-card__heading"><h1>{item.label}</h1></div>
      <p>{item.description}</p>
    </article>
  );
}

export function ToolsPage({
  activeToolId,
  deviceManagement,
  mutationController,
  reload = () => undefined,
  tools,
  workspace
}: ToolsPageProps) {
  const availableTools = new Map(tools.groups.flatMap((group) => group.items).map((item) => [item.id, item]));
  const selectedTool = activeToolId
    ? availableTools.get(activeToolId) ?? standaloneTools[activeToolId as keyof typeof standaloneTools]
    : undefined;
  const launcherGroups = quickToolGroups.map((group) => ({
    ...group,
    items: group.toolIds.map((id) => {
      const item = availableTools.get(id);
      return item ? { id: item.id, label: item.label } : shortcutLabels[id] ? { id, label: shortcutLabels[id] } : null;
    }).filter((item): item is QuickToolItem => item !== null)
  }));

  if (activeToolId && selectedTool) {
    return (
      <section className="tools-page tools-detail-page" aria-label={`${selectedTool.label} 도구`}>
        <VStack gap={4}>
          <AppLink className="tools-detail-back" href={pathForTrip(tools.tripId, "tools")}>← 도구</AppLink>
          <ToolCard
            controller={mutationController}
            deviceManagement={deviceManagement}
            item={selectedTool}
            reload={reload}
            tools={tools}
            workspace={workspace}
          />
        </VStack>
      </section>
    );
  }

  return (
    <section className="tools-page" aria-labelledby="tools-title">
      <VStack gap={5}>
        <VStack className="tools-page__header" gap={1}>
          <Heading id="tools-title" level={1}>도구</Heading>
          <Text type="body">필요한 일을 골라 바로 열어보세요.</Text>
        </VStack>

        {launcherGroups.some((group) => group.items.length) ? (
          <VStack className="tools-launcher" gap={3}>
            {launcherGroups.map((group) => group.items.length ? (
              <VStack className="tools-launcher__group" gap={2} key={group.id}>
                <Text className="tools-launcher__label" type="label">{group.label}</Text>
                <HStack className="tools-launcher__actions" gap={2}>
                  {group.items.map((item) => <QuickToolLaunch item={item} key={item.id} tripId={tools.tripId} />)}
                </HStack>
              </VStack>
            ) : null)}
          </VStack>
        ) : null}

        {tools.groups.length ? (
          <VStack gap={6}>
            <VStack gap={1}>
              <Text color="accent" type="label">ALL TOOLS</Text>
              <Heading level={2}>전체 도구</Heading>
            </VStack>
            {tools.groups.map((group) => (
              <section className="tools-group" key={group.id} aria-labelledby={`tools-${group.id}-title`}>
                <Heading id={`tools-${group.id}-title`} level={3}>{group.title}</Heading>
                <Grid columns={{ minWidth: 220, max: 3 }} gap={3}>
                  {group.items.map((item) => (
                    <ToolLaunchCard
                      item={item}
                      key={item.id}
                      tripId={tools.tripId}
                    />
                  ))}
                </Grid>
              </section>
            ))}
          </VStack>
        ) : null}
      </VStack>
    </section>
  );
}
