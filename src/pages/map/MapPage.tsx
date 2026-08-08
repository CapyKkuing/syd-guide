import {
  Button,
  Card,
  Heading,
  HStack,
  List,
  ListItem,
  Selector,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  TextInput,
  VStack,
} from "@astryxdesign/core";
import { useCallback, useMemo, useState } from "react";
import type { MapPlaceView, ScheduleDayView } from "../../data/contracts";
import { orderScheduleItems, placesInScheduleOrder } from "../../domain/scheduleOrder";
import type { TripMutationController } from "../../services/mutations/controller";
import { MapCanvas, type MapLoader } from "./MapCanvas";
import { MapPlaceSheet } from "./MapPlaceSheet";
import { PlaceEditorDialog } from "./PlaceEditorDialog";
import {
  PlaceHubPanel,
  type PlaceHubCategory,
} from "./PlaceHubPanel";

type CategoryFilter = "all" | MapPlaceView["category"];
type StatusFilter = "all" | MapPlaceView["status"];

const categories: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "restaurant", label: "맛집" },
  { value: "cafe", label: "카페" },
  { value: "attraction", label: "관광" },
  { value: "lodging", label: "숙소" },
  { value: "transport", label: "교통" }
];

const statuses: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "saved", label: "저장" },
  { value: "maybe", label: "고민" },
  { value: "visited", label: "방문" }
];

const categoryLabels: Record<MapPlaceView["category"], string> = {
  restaurant: "맛집",
  cafe: "카페",
  attraction: "관광",
  lodging: "숙소",
  transport: "교통"
};

const statusLabels: Record<MapPlaceView["status"], string> = {
  saved: "저장",
  maybe: "고민",
  visited: "방문"
};

export function MapPage({
  days,
  mapLoader,
  mutationController,
  places,
  tripId,
  viewerMemberId = ""
}: {
  days: ScheduleDayView[];
  mapLoader?: MapLoader;
  mutationController?: TripMutationController;
  places: MapPlaceView[];
  tripId: string;
  viewerMemberId?: string;
}) {
  const [showMap, setShowMap] = useState(false);
  const [hubCategory, setHubCategory] = useState<PlaceHubCategory>("all");
  const [search, setSearch] = useState("");
  const [dayDate, setDayDate] = useState("all");
  const [mapCategory, setMapCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedPlace, setSelectedPlace] = useState<MapPlaceView | null>(null);
  const [editingPlace, setEditingPlace] = useState<MapPlaceView | null | undefined>();
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);

  const filteredPlaces = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const selectedDay = dayDate === "all"
      ? null
      : days.find((day) => day.date === dayDate) ?? null;
    const scheduledPlaces = selectedDay
      ? placesInScheduleOrder(orderScheduleItems(selectedDay.items), places)
      : [];
    const scheduledIds = new Set(scheduledPlaces.map((place) => place.id));
    const orderedPlaces = selectedDay
      ? [...scheduledPlaces, ...places.filter((place) => !scheduledIds.has(place.id))]
      : places;
    return orderedPlaces.filter((place) => (
      (dayDate === "all" || scheduledIds.has(place.id))
      && (mapCategory === "all" || place.category === mapCategory)
      && (status === "all" || place.status === status)
      && (!normalizedSearch || `${place.name} ${place.address}`.toLocaleLowerCase().includes(normalizedSearch))
    ));
  }, [dayDate, days, mapCategory, places, search, status]);

  const dates = Array.from(new Set(days.map((day) => day.date)));
  const dateOptions = [
    { value: "all", label: "전체 날짜" },
    ...dates.map((date) => ({ value: date, label: date }))
  ];
  const resetFilters = () => {
    setSearch("");
    setDayDate("all");
    setMapCategory("all");
    setStatus("all");
  };
  const openPlace = useCallback(({ place, opener }: { place: MapPlaceView; opener: HTMLElement }) => {
    setReturnFocusTo(opener);
    setSelectedPlace(place);
  }, []);

  return (
    <section className="map-page" aria-labelledby="map-title">
      <HStack as="header" className="map-page__header" align="end" gap={3} justify="between" wrap="wrap">
        <VStack gap={1}>
          <Text className="map-page__eyebrow" type="label">PLACE BOOK</Text>
          <Heading id="map-title" level={1}>장소</Heading>
          <Text color="secondary" type="body">저장한 맛집과 카페를 바로 확인하고 길찾기를 시작하세요.</Text>
        </VStack>
        <Button
          isDisabled={!mutationController}
          label="장소 추가"
          onClick={() => setEditingPlace(null)}
          variant="secondary"
        />
      </HStack>

      {!showMap ? (
        <SegmentedControl
          label="장소 분류"
          layout="fill"
          onChange={(value) => setHubCategory(value as PlaceHubCategory)}
          size="sm"
          value={hubCategory}
        >
          <SegmentedControlItem label="전체" value="all" />
          <SegmentedControlItem label="맛집" value="restaurant" />
          <SegmentedControlItem label="카페" value="cafe" />
        </SegmentedControl>
      ) : null}

      {!showMap ? (
        <PlaceHubPanel
          category={hubCategory}
          controller={mutationController}
          key={hubCategory}
          onOpenMap={() => setShowMap(true)}
          places={places}
          tripId={tripId}
          viewerMemberId={viewerMemberId}
        />
      ) : (
        <VStack className="map-page__map-view" gap={4}>
          <HStack align="center" className="map-page__map-toolbar" gap={3} justify="between" wrap="wrap">
            <Text color="secondary" type="supporting">지도에서 저장한 장소를 비교해 보세요.</Text>
            <Button
              label="목록 보기"
              onClick={() => setShowMap(false)}
              size="sm"
              variant="secondary"
            />
          </HStack>
          <Card className="map-filters" padding={4} variant="default">
            <VStack gap={3}>
              <TextInput
                hasClear
                label="장소 검색"
                onChange={setSearch}
                placeholder="장소명 또는 주소"
                value={search}
              />
              <HStack className="map-filter-selectors" align="end" gap={3} wrap="wrap">
                <Selector
                  hasSearch
                  label="날짜"
                  onChange={(value) => setDayDate(value ?? "all")}
                  options={dateOptions}
                  value={dayDate}
                />
                <Selector
                  label="분류"
                  onChange={(value) => setMapCategory((value ?? "all") as CategoryFilter)}
                  options={categories}
                  value={mapCategory}
                />
                <Selector
                  label="장소 상태"
                  onChange={(value) => setStatus((value ?? "all") as StatusFilter)}
                  options={statuses}
                  value={status}
                />
                {filteredPlaces.length > 0 && (search || dayDate !== "all" || mapCategory !== "all" || status !== "all") ? (
                  <Button label="필터 초기화" onClick={resetFilters} size="sm" variant="ghost" />
                ) : null}
              </HStack>
            </VStack>
          </Card>

          <HStack align="center" className="map-page__result-summary" justify="between" gap={3} wrap="wrap">
            <Text aria-live="polite" className="map-result-count" type="label">{filteredPlaces.length}개 장소</Text>
            <Text color="secondary" type="supporting">장소를 누르면 상세 정보와 길찾기를 확인합니다.</Text>
          </HStack>

      <section className="map-page__content">
        <MapCanvas
          connectRoute={dayDate !== "all"}
          loader={mapLoader}
          numberedMarkers={dayDate !== "all"}
          onOpenPlace={openPlace}
          places={filteredPlaces}
        />
        <VStack as="section" className="map-place-list-section" gap={3} aria-labelledby="map-list-title">
          <Heading id="map-list-title" level={2}>장소 목록</Heading>
          <List aria-label="장소 목록" density="spacious">
            {filteredPlaces.map((place) => (
              <ListItem
                description={`${categoryLabels[place.category]}, ${statusLabels[place.status]}, ${place.address}`}
                key={place.id}
                label={place.name}
                onClick={(event) => {
                  if (event.currentTarget instanceof HTMLElement) {
                    openPlace({ place, opener: event.currentTarget });
                  }
                }}
              />
            ))}
          </List>
          {filteredPlaces.length === 0 ? (
            <Card className="map-empty" padding={5} role="status" variant="muted">
              <VStack gap={3}>
                <Text type="body">조건에 맞는 장소가 없습니다</Text>
                <Button label="필터 초기화" onClick={resetFilters} size="sm" variant="secondary" />
              </VStack>
            </Card>
          ) : null}
        </VStack>
      </section>
        </VStack>
      )}

      {selectedPlace ? (
        <MapPlaceSheet
          controller={mutationController}
          onClose={() => setSelectedPlace(null)}
          onEdit={() => {
            setEditingPlace(selectedPlace);
            setSelectedPlace(null);
          }}
          place={selectedPlace}
          returnFocusTo={returnFocusTo}
          viewerMemberId={viewerMemberId}
        />
      ) : null}
      {editingPlace !== undefined && mutationController ? (
        <PlaceEditorDialog
          controller={mutationController}
          initialCategory={hubCategory === "all" ? undefined : hubCategory}
          onClose={() => setEditingPlace(undefined)}
          place={editingPlace}
          viewerMemberId={viewerMemberId}
        />
      ) : null}
    </section>
  );
}
