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
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MapPlaceView } from "../../../data/contracts";
import { ApiClientError } from "../../../services/api/errors";
import type { TripMutationController } from "../../../services/mutations/controller";
import { placesApi } from "../../../services/places/api";
import type {
  PlaceDiscoveryDetails,
  PlaceProviderUsage,
  PlaceRecommendationCategory,
} from "../../../shared/places";
import { MapPlaceSheet } from "../../map/MapPlaceSheet";
import { PlaceEditorDialog } from "../../map/PlaceEditorDialog";
import {
  PlaceDiscoveryCard,
  type PlaceCardSelection,
} from "./PlaceDiscoveryCard";

type PlaceFilter = "all" | "recommended" | "saved";
type PlaceSort = "popular" | "reviews" | "rating";

interface PlacePanelItem {
  discovery?: PlaceDiscoveryDetails;
  place: MapPlaceView;
  popularityRank: number;
  storedPlace?: MapPlaceView;
}

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
  const discoveryEnabled = Boolean(tripId && category !== "transport");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PlaceFilter>("all");
  const [sort, setSort] = useState<PlaceSort>("popular");
  const [visibleCount, setVisibleCount] = useState(6);
  const [selected, setSelected] = useState<PlaceCardSelection | null>(null);
  const [editingPlace, setEditingPlace] = useState<MapPlaceView | null | undefined>();
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const [usage, setUsage] = useState<PlaceProviderUsage[]>([]);
  const [recommendations, setRecommendations] = useState<PlaceDiscoveryDetails[]>([]);
  const [recommendationError, setRecommendationError] = useState("");
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(discoveryEnabled);
  const items = useMemo(
    () => mergePlaceRecommendations(category, places, recommendations),
    [category, places, recommendations]
  );
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const searchable = `${item.place.name} ${item.discovery?.address ?? item.place.address} ${item.place.description}`;
      return (filter === "all"
        || filter === "recommended" && item.discovery !== undefined
        || filter === "saved" && item.storedPlace?.isSaved)
      && (!query || searchable.toLocaleLowerCase().includes(query));
    }).sort((left, right) => comparePlaceItems(left, right, sort));
  }, [filter, items, search, sort]);
  const visibleItems = filteredItems.slice(0, visibleCount);

  const handleUsage = useCallback((next: PlaceProviderUsage[]) => {
    setUsage((current) => {
      const merged = new Map(current.map((item) => [item.sku, item]));
      next.forEach((item) => {
        const previous = merged.get(item.sku);
        merged.set(item.sku, previous && previous.used > item.used ? previous : item);
      });
      return [...merged.values()];
    });
  }, []);

  const refreshRecommendations = useCallback(async () => {
    if (!discoveryEnabled || !tripId) return;
    setIsLoadingRecommendations(true);
    setRecommendationError("");
    try {
      const response = await placesApi.getRecommendations(
        tripId,
        category as PlaceRecommendationCategory,
        true
      );
      setRecommendations(response.places);
      setUsage(response.usage);
    } catch (caught) {
      setRecommendationError(recommendationErrorMessage(caught));
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [category, discoveryEnabled, tripId]);

  useEffect(() => {
    if (!discoveryEnabled || !tripId) return;
    let active = true;
    void placesApi.getRecommendations(
      tripId,
      category as PlaceRecommendationCategory
    ).then((response) => {
      if (!active) return;
      setRecommendations(response.places);
      setUsage(response.usage);
    }).catch((caught: unknown) => {
      if (active) setRecommendationError(recommendationErrorMessage(caught));
    }).finally(() => {
      if (active) setIsLoadingRecommendations(false);
    });
    return () => { active = false; };
  }, [category, discoveryEnabled, tripId]);

  function openPlace(selection: PlaceCardSelection) {
    setReturnFocusTo(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setSelected(selection);
  }

  return (
    <VStack className="place-category-tool" gap={3}>
      <HStack className="place-category-tool__heading" align="center" justify="between">
        <Text hasTabularNumbers type="label">{filteredItems.length}개 장소</Text>
        <HStack className="place-category-tool__actions" gap={1}>
          {discoveryEnabled ? (
            <Button
              isDisabled={isLoadingRecommendations}
              label={isLoadingRecommendations ? "추천 불러오는 중" : "추천 새로고침"}
              onClick={() => void refreshRecommendations()}
              size="sm"
              variant="secondary"
            />
          ) : null}
          <Button
            isDisabled={!controller}
            label="장소 추가"
            onClick={() => setEditingPlace(null)}
            size="sm"
            variant="secondary"
          />
        </HStack>
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
          <SegmentedControl
            label="추천 정렬"
            layout="fill"
            onChange={(value) => {
              setSort(value as PlaceSort);
              setVisibleCount(6);
            }}
            size="sm"
            value={sort}
          >
            <SegmentedControlItem label="인기순" value="popular" />
            <SegmentedControlItem label="리뷰 많은순" value="reviews" />
            <SegmentedControlItem label="평점순" value="rating" />
          </SegmentedControl>
          <Card className="place-provider-limit" padding={3} variant="muted">
            <HStack align="center" justify="between">
              <VStack gap={1}>
                <Text type="label">무료 한도 보호 작동 중</Text>
                <Text color="secondary" type="supporting">
                  Google 최신 추천입니다. 정렬 변경에는 추가 호출이 없습니다.
                </Text>
              </VStack>
              <Text hasTabularNumbers type="label">
                검색 {usage.find((item) => item.sku === "nearby-search-enterprise")?.used ?? 0}/800 · 사진 {usage.find((item) => item.sku === "place-photo")?.used ?? 0}/800
              </Text>
            </HStack>
          </Card>
          {recommendationError ? (
            <Text color="secondary" role="alert" type="supporting">
              {recommendationError}
            </Text>
          ) : null}
        </VStack>
      ) : null}
      {visibleItems.length ? discoveryEnabled && tripId ? (
        <Grid columns={{ minWidth: 250, max: 3, repeat: "fit" }} gap={3}>
          {visibleItems.map((item) => (
            <PlaceDiscoveryCard
              controller={controller}
              initialDiscovery={item.discovery}
              isRecommendation={item.discovery !== undefined}
              key={item.discovery?.providerPlaceId ?? item.place.id}
              onOpen={openPlace}
              onUsage={handleUsage}
              place={item.place}
              storedPlace={item.storedPlace}
              tripId={tripId}
              viewerMemberId={viewerMemberId}
            />
          ))}
        </Grid>
      ) : (
        <VStack gap={2}>
          {visibleItems.map(({ place }) => (
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
                  onClick={() => openPlace({
                    place,
                    discovery: null,
                    photoUrl: place.imageUrl,
                    isTransient: false,
                  })}
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
      {visibleCount < filteredItems.length ? (
        <Button
          label={`장소 ${Math.min(6, filteredItems.length - visibleCount)}개 더 보기`}
          onClick={() => setVisibleCount((count) => count + 6)}
          variant="secondary"
        />
      ) : null}
      {selected ? (
        <MapPlaceSheet
          controller={selected.isTransient ? undefined : controller}
          discovery={selected.discovery}
          hideManagement={selected.isTransient}
          onClose={() => setSelected(null)}
          onEdit={() => {
            if (selected.isTransient) return;
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

function mergePlaceRecommendations(
  category: MapPlaceView["category"],
  places: MapPlaceView[],
  recommendations: PlaceDiscoveryDetails[]
): PlacePanelItem[] {
  const stored = places.filter((place) => place.category === category && place.isSaved);
  if (category === "transport") {
    return stored.map((place, index) => ({ place, popularityRank: index, storedPlace: place }));
  }
  const usedStoredIds = new Set<string>();
  const live = recommendations.map((discovery, index) => {
    const storedPlace = stored.find((place) =>
      place.providerPlaceId === discovery.providerPlaceId
      || normalizePlaceName(place.name) === normalizePlaceName(discovery.name)
    );
    if (storedPlace) usedStoredIds.add(storedPlace.id);
    return {
      discovery,
      popularityRank: index,
      storedPlace,
      place: {
        ...(storedPlace ?? emptyRecommendationPlace(category, index)),
        name: discovery.name,
        address: discovery.address,
        isRecommended: true,
        isSaved: storedPlace?.isSaved ?? false,
        provider: "google-places" as const,
        providerPlaceId: discovery.providerPlaceId,
      },
    };
  });
  const savedOnly = stored
    .filter((place) => !usedStoredIds.has(place.id))
    .map((place, index) => ({
      place,
      popularityRank: recommendations.length + index,
      storedPlace: place,
    }));
  return [...live, ...savedOnly];
}

function emptyRecommendationPlace(
  category: Exclude<MapPlaceView["category"], "transport">,
  index: number
): MapPlaceView {
  return {
    id: `recommendation-${index}`,
    version: 0,
    name: "",
    category,
    status: "saved",
    dayDate: null,
    latitude: null,
    longitude: null,
    address: "",
    description: "",
    mapUrl: null,
    sourceUrl: null,
    imageUrl: null,
    savedBy: null,
    isRecommended: true,
    isSaved: false,
    provider: "google-places",
    providerPlaceId: null,
    updatedAt: "",
    votes: [],
  };
}

function comparePlaceItems(left: PlacePanelItem, right: PlacePanelItem, sort: PlaceSort) {
  if (sort === "reviews") {
    return (right.discovery?.userRatingCount ?? -1) - (left.discovery?.userRatingCount ?? -1)
      || left.popularityRank - right.popularityRank;
  }
  if (sort === "rating") {
    return (right.discovery?.rating ?? -1) - (left.discovery?.rating ?? -1)
      || (right.discovery?.userRatingCount ?? -1) - (left.discovery?.userRatingCount ?? -1)
      || left.popularityRank - right.popularityRank;
  }
  return left.popularityRank - right.popularityRank;
}

function normalizePlaceName(value: string) {
  return value.normalize("NFKD").toLocaleLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function recommendationErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === "PLACES_FREE_LIMIT_REACHED") {
      return "이번 달 무료 추천 한도에 도달했습니다. 저장한 장소는 계속 사용할 수 있습니다.";
    }
    if (error.code === "PLACE_DISCOVERY_LOCATION_REQUIRED") {
      return "위치가 입력된 장소를 하나 추가하면 주변 추천을 받을 수 있습니다.";
    }
  }
  return "Google 최신 추천을 불러오지 못했습니다. 저장한 장소는 계속 사용할 수 있습니다.";
}
