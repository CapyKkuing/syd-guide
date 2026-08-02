import {
  Button,
  Card,
  Heading,
  HStack,
  List,
  ListItem,
  SegmentedControl,
  SegmentedControlItem,
  Tab,
  TabList,
  Text,
  VStack,
} from "@astryxdesign/core";
import { useMemo, useState } from "react";
import type { MapPlaceView, ScheduleDayView, ScheduleItemView } from "../../data/contracts";
import { moveScheduleItem, orderScheduleItems, placesInScheduleOrder } from "../../domain/scheduleOrder";
import type { MutationPayloadMap } from "../../shared/mutations";
import type { TripMutationController } from "../../services/mutations/controller";
import { MapCanvas, type MapLoader, type MapOpenRequest } from "../map/MapCanvas";
import { MapPlaceSheet } from "../map/MapPlaceSheet";
import { PlaceEditorDialog } from "../map/PlaceEditorDialog";
import { ScheduleDetailSheet } from "./ScheduleDetailSheet";
import { ScheduleEditorDialog } from "./ScheduleEditorDialog";
import { ScheduleReorderList } from "./ScheduleReorderList";

const kindLabels: Record<ScheduleItemView["kind"], string> = {
  movement: "이동",
  meal: "식사",
  attraction: "관광",
  booking: "예약",
  note: "메모",
};

type ScheduleView = "map" | "list";

function timeOf(value: string): string {
  return value.slice(11, 16);
}

export interface SchedulePageProps {
  tripId?: string;
  timeZone?: string;
  days: ScheduleDayView[];
  mapLoader?: MapLoader;
  mutationController?: TripMutationController;
  places?: MapPlaceView[];
  viewerMemberId?: string;
}

export function SchedulePage({
  days,
  mapLoader,
  mutationController,
  places = [],
  timeZone = "UTC",
  viewerMemberId = "",
}: SchedulePageProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ScheduleItemView | null>(null);
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const [editorItem, setEditorItem] = useState<ScheduleItemView | null | undefined>(undefined);
  const [selectedPlace, setSelectedPlace] = useState<MapPlaceView | null>(null);
  const [placeReturnFocusTo, setPlaceReturnFocusTo] = useState<HTMLElement | null>(null);
  const [editingPlace, setEditingPlace] = useState<MapPlaceView | null | undefined>(undefined);
  const [view, setView] = useState<ScheduleView>("map");
  const [reorderMode, setReorderMode] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState("");
  const [reorderMessage, setReorderMessage] = useState("");
  const [pendingOrder, setPendingOrder] = useState<{ dayId: string; ids: string[] } | null>(null);
  const day = days[selectedIndex] ?? null;
  const serverItems = useMemo(() => orderScheduleItems(day?.items ?? []), [day?.items]);
  const serverOrderKey = serverItems.map((item) => item.id).join("|");
  const items = useMemo(() => {
    if (
      !day
      || pendingOrder?.dayId !== day.id
      || pendingOrder.ids.join("|") === serverOrderKey
    ) return serverItems;
    const byId = new Map(serverItems.map((item) => [item.id, item]));
    const ordered = pendingOrder.ids.flatMap((id) => {
      const item = byId.get(id);
      if (!item) return [];
      byId.delete(id);
      return [item];
    });
    return [...ordered, ...byId.values()];
  }, [day, pendingOrder, serverItems, serverOrderKey]);

  if (!day) {
    return (
      <VStack gap={4}>
        <Heading level={1}>일정</Heading>
        <Text type="body">표시할 일정이 없습니다.</Text>
      </VStack>
    );
  }

  const nextItemId = items.find((item) => !item.isDone)?.id;
  const routePlaces = placesInScheduleOrder(items, places);
  const locatedRoutePlaces = routePlaces.filter(hasCoordinates);

  function openPlace({ place, opener }: MapOpenRequest) {
    setPlaceReturnFocusTo(opener);
    setSelectedPlace(place);
  }

  async function reorderItems(sourceId: string, targetId: string) {
    if (!day || reordering) return;
    const nextItems = moveScheduleItem(items, sourceId, targetId);
    if (nextItems.map((item) => item.id).join("|") === items.map((item) => item.id).join("|")) return;
    setPendingOrder({ dayId: day.id, ids: nextItems.map((item) => item.id) });
    setReorderError("");
    setReorderMessage("");
    const moved = nextItems.find((item) => item.id === sourceId);
    if (!mutationController) {
      setReorderMessage(moved ? `${moved.title} 순서를 미리 바꿨습니다.` : "일정 순서를 미리 바꿨습니다.");
      return;
    }
    setReordering(true);
    try {
      const updates = nextItems.flatMap((item, index) => {
        const position = index + 1;
        return item.position === position ? [] : [{ item, position }];
      });
      await Promise.all(updates.map(({ item, position }) => mutationController.submit(
        "schedule_item",
        "update",
        item.id,
        item.version,
        schedulePayload(item, position)
      )));
      setReorderMessage(moved ? `${moved.title} 순서를 저장했습니다.` : "일정 순서를 저장했습니다.");
    } catch (caught) {
      setPendingOrder(null);
      setReorderError(caught instanceof Error ? caught.message : "일정 순서를 저장하지 못했습니다.");
    } finally {
      setReordering(false);
    }
  }

  return (
    <VStack gap={6}>
      <HStack align="center" justify="between">
        <VStack gap={1}>
          <Text color="accent" type="label">TRIP PLAN</Text>
          <Heading level={1}>일정</Heading>
        </VStack>
        <Button
          isDisabled={!mutationController}
          label="일정 추가"
          onClick={() => setEditorItem(null)}
          variant="primary"
        />
      </HStack>

      {!mutationController ? <Text color="secondary" type="supporting">미리보기에서는 일정 추가와 내용 수정만 제한됩니다.</Text> : null}

      <TabList hasDivider layout="fill" onChange={(value) => {
        setSelectedIndex(days.findIndex((candidate) => candidate.date === value));
        setPendingOrder(null);
        setReorderMode(false);
        setReorderError("");
        setReorderMessage("");
      }} size="sm" value={day.date}>
        {days.map((candidate) => (
          <Tab key={candidate.date} label={candidate.dayLabel} value={candidate.date} />
        ))}
      </TabList>

      <SegmentedControl label="일정 보기 방식" layout="fill" onChange={(value) => {
        const nextView = value === "list" ? "list" : "map";
        setView(nextView);
        if (nextView === "map") setReorderMode(false);
      }} value={view}>
        <SegmentedControlItem label="지도 동선" value="map" />
        <SegmentedControlItem label="전체 일정" value="list" />
      </SegmentedControl>

      <Card className="schedule-day-section" padding={4}>
        <VStack gap={3}>
        <HStack align="center" justify="between">
          <VStack gap={1}>
            <Text color="accent" type="label">{day.dayLabel} · {day.date}</Text>
            <Heading level={2}>{day.headline}</Heading>
          </VStack>
          <HStack align="center" gap={2}>
            <Text hasTabularNumbers type="label">{items.length}개 일정</Text>
            {view === "list" && items.length > 1 ? (
              <Button
                isDisabled={reordering}
                label={reorderMode ? "순서 편집 완료" : "순서 편집"}
                onClick={() => setReorderMode((current) => !current)}
                size="sm"
                variant="secondary"
              />
            ) : null}
          </HStack>
        </HStack>

        {view === "map" ? (
          <VStack gap={3}>
            {locatedRoutePlaces.length ? (
              <MapCanvas connectRoute loader={mapLoader} numberedMarkers onOpenPlace={openPlace} places={locatedRoutePlaces} />
            ) : routePlaces.length ? (
              <Card padding={4} variant="muted">
                <Text type="body">연결한 장소에 지도 위치가 없습니다. 장소를 수정해 좌표를 입력해 주세요.</Text>
              </Card>
            ) : (
              <Card padding={4} variant="muted">
                <Text type="body">지도에 표시할 위치가 있는 장소를 일정에 연결해 주세요.</Text>
              </Card>
            )}
            <Text color="secondary" type="supporting">
              지도 핀을 누르면 장소 정보와 Google Maps 길찾기를 확인할 수 있습니다.
            </Text>
            {locatedRoutePlaces.length > 0 && locatedRoutePlaces.length < routePlaces.length ? (
              <Text color="secondary" type="supporting">
                좌표가 없는 {routePlaces.length - locatedRoutePlaces.length}개 장소는 지도에서 제외됐습니다.
              </Text>
            ) : null}
          </VStack>
        ) : (
          <VStack gap={2}>
            {reorderMode ? (
              <ScheduleReorderList busy={reordering} items={items} onMove={reorderItems} />
            ) : (
              <List density="spacious">
                {items.map((item) => (
                  <ListItem
                    description={`${item.place || item.description}${item.travelNote ? ` · ${item.travelNote}` : ""}`}
                    endContent={<Text type="label">{item.bookingStatus === "confirmed" ? "예약 확정" : `${kindLabels[item.kind]} · ${item.isDone ? "완료" : "예정"}`}</Text>}
                    isSelected={item.id === nextItemId}
                    key={item.id}
                    label={item.title}
                    onClick={(event) => {
                      if (event.currentTarget instanceof HTMLElement) {
                        setReturnFocusTo(event.currentTarget);
                      }
                      setSelectedItem(item);
                    }}
                    startContent={<Text hasTabularNumbers type="label">{timeOf(item.startsAt)}</Text>}
                  />
                ))}
              </List>
            )}
            {reorderError ? <p className="schedule-reorder-status is-error" role="alert">{reorderError}</p> : null}
            <p aria-live="polite" className="schedule-reorder-status">{reorderMessage}</p>
          </VStack>
        )}
        </VStack>
      </Card>

      {selectedItem ? (
        <ScheduleDetailSheet
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={mutationController ? () => {
            setEditorItem(selectedItem);
            setSelectedItem(null);
          } : undefined}
          returnFocusTo={returnFocusTo}
        />
      ) : null}
      {editorItem !== undefined && mutationController ? (
        <ScheduleEditorDialog
          day={day}
          item={editorItem}
          mutationController={mutationController}
          onClose={() => setEditorItem(undefined)}
          places={places}
          timeZone={timeZone}
        />
      ) : null}
      {selectedPlace ? (
        <MapPlaceSheet
          controller={mutationController}
          onClose={() => setSelectedPlace(null)}
          onEdit={() => {
            setEditingPlace(selectedPlace);
            setSelectedPlace(null);
          }}
          place={selectedPlace}
          returnFocusTo={placeReturnFocusTo}
          viewerMemberId={viewerMemberId}
        />
      ) : null}
      {editingPlace !== undefined && mutationController ? (
        <PlaceEditorDialog
          controller={mutationController}
          onClose={() => setEditingPlace(undefined)}
          place={editingPlace}
          viewerMemberId={viewerMemberId}
        />
      ) : null}
    </VStack>
  );
}

function hasCoordinates(place: MapPlaceView): boolean {
  return place.latitude !== null && place.longitude !== null
    && Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
}

function schedulePayload(
  item: ScheduleItemView,
  position: number
): MutationPayloadMap["schedule_item"] {
  return {
    tripDayId: item.tripDayId,
    placeId: item.placeId,
    bookingId: item.bookingId,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    memo: item.description,
    travelMode: item.travelMode,
    travelNote: item.travelNote ?? "",
    position,
    isFixed: item.isFixed,
    isDone: item.isDone,
  };
}
