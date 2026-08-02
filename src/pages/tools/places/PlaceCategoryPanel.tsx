import {
  Button,
  Card,
  Grid,
  Heading,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  VStack,
} from "@astryxdesign/core";
import { useCallback, useMemo, useState } from "react";
import type { MapPlaceView } from "../../../data/contracts";
import type { TripMutationController } from "../../../services/mutations/controller";
import type { PlaceProviderUsage } from "../../../shared/places";
import { MapPlaceSheet } from "../../map/MapPlaceSheet";
import { PlaceEditorDialog } from "../../map/PlaceEditorDialog";
import {
  PlaceDiscoveryCard,
  type PlaceCardSelection,
} from "./PlaceDiscoveryCard";

type PlaceFilter = "all" | "recommended" | "saved";

export function PlaceCategoryPanel({
  category,
  controller,
  emptyMessage,
  places,
  tripId,
  viewerMemberId,
}: {
  category: "restaurant" | "cafe" | "transport";
  controller?: TripMutationController;
  emptyMessage: string;
  places: MapPlaceView[];
  tripId?: string;
  viewerMemberId: string;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PlaceFilter>("all");
  const [visibleCount, setVisibleCount] = useState(6);
  const [selected, setSelected] = useState<PlaceCardSelection | null>(null);
  const [editingPlace, setEditingPlace] = useState<MapPlaceView | null | undefined>();
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const [usage, setUsage] = useState<PlaceProviderUsage[]>([]);
  const discoveryEnabled = Boolean(tripId && category !== "transport");
  const filteredPlaces = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return places.filter((place) => place.category === category
      && (!discoveryEnabled || place.isRecommended || place.isSaved)
      && (filter === "all"
        || filter === "recommended" && place.isRecommended
        || filter === "saved" && place.isSaved)
      && (!query || `${place.name} ${place.address} ${place.description}`
        .toLocaleLowerCase().includes(query)));
  }, [category, discoveryEnabled, filter, places, search]);
  const visiblePlaces = filteredPlaces.slice(0, visibleCount);

  const handleUsage = useCallback((next: PlaceProviderUsage[]) => {
    setUsage(next);
  }, []);

  function openPlace(selection: PlaceCardSelection) {
    setReturnFocusTo(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setSelected(selection);
  }

  return (
    <VStack className="place-category-tool" gap={3}>
      <HStack align="center" justify="between">
        <Text hasTabularNumbers type="label">{filteredPlaces.length}개 장소</Text>
        <Button
          isDisabled={!controller}
          label="장소 추가"
          onClick={() => setEditingPlace(null)}
          size="sm"
          variant="secondary"
        />
      </HStack>
      <label className="tool-filter">
        <span>장소 검색</span>
        <input
          onChange={(event) => {
            setSearch(event.target.value);
            setVisibleCount(6);
          }}
          placeholder="이름, 주소, 설명"
          type="search"
          value={search}
        />
      </label>
      {discoveryEnabled ? (
        <VStack gap={2}>
          <SegmentedControl
            label="장소 표시 기준"
            layout="fill"
            onChange={(value) => {
              setFilter(value as PlaceFilter);
              setVisibleCount(6);
            }}
            size="sm"
            value={filter}
          >
            <SegmentedControlItem label="전체" value="all" />
            <SegmentedControlItem label="추천" value="recommended" />
            <SegmentedControlItem label="내가 저장" value="saved" />
          </SegmentedControl>
          <Card className="place-provider-limit" padding={3} variant="muted">
            <HStack align="center" justify="between">
              <VStack gap={1}>
                <Text type="label">무료 한도 보호 작동 중</Text>
                <Text color="secondary" type="supporting">
                  월 무료량의 80%에서 Google 호출을 자동 차단합니다.
                </Text>
              </VStack>
              <Text hasTabularNumbers type="label">
                사진 {usage.find((item) => item.sku === "place-photo")?.used ?? 0}/800
              </Text>
            </HStack>
          </Card>
        </VStack>
      ) : null}
      {visiblePlaces.length ? discoveryEnabled && tripId ? (
        <Grid columns={{ minWidth: 250, max: 3, repeat: "fit" }} gap={3}>
          {visiblePlaces.map((place) => (
            <PlaceDiscoveryCard
              controller={controller}
              key={place.id}
              onOpen={openPlace}
              onUsage={handleUsage}
              place={place}
              tripId={tripId}
              viewerMemberId={viewerMemberId}
            />
          ))}
        </Grid>
      ) : (
        <VStack gap={2}>
          {visiblePlaces.map((place) => (
            <Card className="place-tool-card" key={place.id} padding={3}>
              <VStack gap={2}>
                <HStack align="start" justify="between">
                  <VStack gap={1}>
                    <Heading level={3}>{place.name}</Heading>
                    <Text color="secondary" type="supporting">{place.address || "주소 미입력"}</Text>
                  </VStack>
                  <Text type="label">{place.status === "visited" ? "방문" : place.status === "maybe" ? "고민" : "저장"}</Text>
                </HStack>
                {place.description ? <Text type="body">{place.description}</Text> : null}
                <Button
                  label="상세 보기"
                  onClick={() => openPlace({ place, discovery: null, photoUrl: place.imageUrl })}
                  size="sm"
                  variant="secondary"
                />
              </VStack>
            </Card>
          ))}
        </VStack>
      ) : (
        <Card padding={4} variant="muted"><Text type="body">{emptyMessage}</Text></Card>
      )}
      {visibleCount < filteredPlaces.length ? (
        <Button
          label={`장소 ${Math.min(6, filteredPlaces.length - visibleCount)}개 더 보기`}
          onClick={() => setVisibleCount((count) => count + 6)}
          variant="secondary"
        />
      ) : null}
      {selected ? (
        <MapPlaceSheet
          controller={controller}
          discovery={selected.discovery}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditingPlace(selected.place);
            setSelected(null);
          }}
          photoUrl={selected.photoUrl}
          place={selected.place}
          returnFocusTo={returnFocusTo}
          viewerMemberId={viewerMemberId}
        />
      ) : null}
      {editingPlace !== undefined && controller ? (
        <PlaceEditorDialog
          controller={controller}
          initialCategory={category}
          onClose={() => setEditingPlace(undefined)}
          place={editingPlace}
          viewerMemberId={viewerMemberId}
        />
      ) : null}
    </VStack>
  );
}
