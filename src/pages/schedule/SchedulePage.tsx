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
import { useState } from "react";
import type { MapPlaceView, ScheduleDayView, ScheduleItemView } from "../../data/contracts";
import type { TripMutationController } from "../../services/mutations/controller";
import { MapCanvas, type MapLoader, type MapOpenRequest } from "../map/MapCanvas";
import { MapPlaceSheet } from "../map/MapPlaceSheet";
import { PlaceEditorDialog } from "../map/PlaceEditorDialog";
import { ScheduleDetailSheet } from "./ScheduleDetailSheet";
import { ScheduleEditorDialog } from "./ScheduleEditorDialog";

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
  const day = days[selectedIndex] ?? null;

  if (!day) {
    return (
      <VStack gap={4}>
        <Heading level={1}>일정</Heading>
        <Text type="body">표시할 일정이 없습니다.</Text>
      </VStack>
    );
  }

  const items = [...day.items].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const nextItemId = items.find((item) => !item.isDone)?.id;
  const routePlaceIds = new Set(items.flatMap((item) => item.placeId ? [item.placeId] : []));
  const routePlaces = places.filter((place) => routePlaceIds.size
    ? routePlaceIds.has(place.id)
    : place.dayDate === day.date);

  function openPlace({ place, opener }: MapOpenRequest) {
    setPlaceReturnFocusTo(opener);
    setSelectedPlace(place);
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

      {!mutationController ? <Text color="secondary" type="supporting">미리보기에서는 일정을 편집할 수 없습니다.</Text> : null}

      <TabList hasDivider layout="fill" onChange={(value) => setSelectedIndex(days.findIndex((candidate) => candidate.date === value))} size="sm" value={day.date}>
        {days.map((candidate) => (
          <Tab key={candidate.date} label={candidate.dayLabel} value={candidate.date} />
        ))}
      </TabList>

      <SegmentedControl label="일정 보기 방식" layout="fill" onChange={(value) => setView(value === "list" ? "list" : "map")} value={view}>
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
          <Text hasTabularNumbers type="label">{items.length}개 일정</Text>
        </HStack>

        {view === "map" ? (
          <VStack gap={3}>
            {routePlaces.length ? (
              <MapCanvas loader={mapLoader} onOpenPlace={openPlace} places={routePlaces} />
            ) : (
              <Card padding={4} variant="muted">
                <Text type="body">지도에 표시할 위치가 있는 장소를 일정에 연결해 주세요.</Text>
              </Card>
            )}
            <Text color="secondary" type="supporting">
              지도 핀을 누르면 장소 정보와 Google Maps 길찾기를 확인할 수 있습니다.
            </Text>
          </VStack>
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
