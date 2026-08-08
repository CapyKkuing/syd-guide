import {
  Button,
  Card,
  Grid,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  VStack,
} from "@astryxdesign/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import type { MapPlaceView } from "../../data/contracts";
import { isSamePlace } from "../../domain/placeIdentity";
import { ApiClientError } from "../../services/api/errors";
import type { TripMutationController } from "../../services/mutations/controller";
import { placesApi } from "../../services/places/api";
import type {
  PlaceDiscoveryDetails,
  PlaceProviderUsage,
  PlaceRecommendationCategory,
} from "../../shared/places";
import {
  PlaceDiscoveryCard,
  type PlaceCardSelection,
} from "../tools/places/PlaceDiscoveryCard";
import { MapPlaceSheet } from "./MapPlaceSheet";
import { PlaceEditorDialog } from "./PlaceEditorDialog";

export type PlaceHubCategory = "all" | PlaceRecommendationCategory;
type PlaceSort = "popular" | "reviews" | "rating";

interface PlaceHubItem {
  discovery?: PlaceDiscoveryDetails;
  place: MapPlaceView;
  popularityRank: number;
  storedPlace?: MapPlaceView;
}

interface CategorizedRecommendation {
  category: PlaceRecommendationCategory;
  discovery: PlaceDiscoveryDetails;
  popularityRank: number;
}

export function PlaceHubPanel({
  category,
  controller,
  onOpenMap,
  places,
  tripId,
  viewerMemberId,
}: {
  category: PlaceHubCategory;
  controller?: TripMutationController;
  onOpenMap: () => void;
  places: MapPlaceView[];
  tripId: string;
  viewerMemberId: string;
}) {
  const recommendationEnabled = places.some((place) => (
    place.latitude !== null && place.longitude !== null
  ));
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<PlaceSort>("popular");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [selected, setSelected] = useState<PlaceCardSelection | null>(null);
  const [editingPlace, setEditingPlace] = useState<MapPlaceView | undefined>();
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const [usage, setUsage] = useState<PlaceProviderUsage[]>([]);
  const [recommendations, setRecommendations] = useState<CategorizedRecommendation[]>([]);
  const [recommendationError, setRecommendationError] = useState("");
  const [isLoading, setIsLoading] = useState(recommendationEnabled);

  const recommendationCategories = useMemo(
    () => category === "all" ? (["restaurant", "cafe"] as const) : [category],
    [category]
  );

  const handleUsage = useCallback((next: PlaceProviderUsage[]) => {
    setUsage((current) => mergeUsage(current, next));
  }, []);

  const loadRecommendations = useCallback(async (refresh = false) => {
    if (!recommendationEnabled) return;
    await Promise.resolve();
    setIsLoading(true);
    setRecommendationError("");
    try {
      const responses = await Promise.all(recommendationCategories.map(async (itemCategory) => ({
        category: itemCategory,
        response: await placesApi.getRecommendations(tripId, itemCategory, refresh),
      })));
      let rank = 0;
      setRecommendations(responses.flatMap(({ category: itemCategory, response }) => (
        response.places.map((discovery) => ({
          category: itemCategory,
          discovery,
          popularityRank: rank++,
        }))
      )));
      setUsage(responses.reduce(
        (current, { response }) => mergeUsage(current, response.usage),
        [] as PlaceProviderUsage[]
      ));
    } catch (caught) {
      setRecommendationError(recommendationErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [recommendationCategories, recommendationEnabled, tripId]);

  useEffect(() => {
    if (!recommendationEnabled) return;
    const timer = window.setTimeout(() => void loadRecommendations(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRecommendations, recommendationEnabled]);

  const displayedRecommendationError = recommendationEnabled
    ? recommendationError
    : "위치가 입력된 장소를 하나 추가하면 주변 추천을 받을 수 있습니다.";

  const savedCount = useMemo(() => savedItems(places, category).length, [category, places]);
  const items = useMemo(
    () => unifiedItems(places, recommendations, category),
    [category, places, recommendations]
  );
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const searchable = `${item.place.name} ${item.discovery?.address ?? item.place.address} ${item.place.description}`;
      return (!showSavedOnly || item.storedPlace?.isSaved || item.place.isSaved)
        && (!query || searchable.toLocaleLowerCase().includes(query));
    }).sort((left, right) => comparePlaceItems(left, right, sort));
  }, [items, search, showSavedOnly, sort]);
  const visibleItems = filteredItems.slice(0, visibleCount);

  return (
    <VStack className="place-hub-panel" gap={3}>
      <HStack className="place-hub-panel__quick-actions" gap={2}>
        <Button
          label={`내 저장 ${savedCount}`}
          onClick={() => setShowSavedOnly((current) => !current)}
          size="sm"
          variant={showSavedOnly ? "primary" : "secondary"}
        />
        <Button
          icon={<Icon name="map" />}
          label="지도 보기"
          onClick={onOpenMap}
          size="sm"
          variant="secondary"
        />
      </HStack>

      <HStack align="center" className="place-hub-panel__heading" justify="between">
        <Text hasTabularNumbers type="label">저장과 추천을 한눈에 · {filteredItems.length}곳</Text>
        <Button
          isDisabled={isLoading || !recommendationEnabled}
          label={isLoading ? "추천 불러오는 중" : "추천 새로고침"}
          onClick={() => void loadRecommendations(true)}
          size="sm"
          variant="secondary"
        />
      </HStack>

      <label className="map-search">
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

      <VStack gap={2}>
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
                Google 최신 추천입니다. 처음 6장만 자동 표시하고 나머지 사진은 상세 보기에서 불러옵니다.
              </Text>
            </VStack>
            <Text hasTabularNumbers type="label">
              검색 {usage.find((item) => item.sku === "nearby-search-enterprise")?.used ?? 0}/800 · 사진 {usage.find((item) => item.sku === "place-photo")?.used ?? 0}/800
            </Text>
          </HStack>
        </Card>
        {displayedRecommendationError ? (
          <Text color="secondary" role="alert" type="supporting">
            {displayedRecommendationError}
          </Text>
        ) : null}
      </VStack>

      {visibleItems.length ? (
        <Grid className="place-hub-panel__grid" columns={{ minWidth: 250, max: 3, repeat: "fit" }} gap={3}>
          {visibleItems.map((item) => (
            <PlaceDiscoveryCard
              controller={controller}
              initialDiscovery={item.discovery}
              isRecommendation={item.discovery !== undefined}
              key={item.discovery?.providerPlaceId ?? item.place.id}
              onOpen={(selection) => {
                setReturnFocusTo(document.activeElement instanceof HTMLElement ? document.activeElement : null);
                setSelected(selection);
              }}
              onUsage={handleUsage}
              place={item.place}
              storedPlace={item.storedPlace}
              tripId={tripId}
              viewerMemberId={viewerMemberId}
            />
          ))}
        </Grid>
      ) : (
        <Card padding={4} variant="muted">
          <VStack gap={2}>
            <Text type="body">
              {isLoading
                ? "장소를 불러오는 중입니다."
                : showSavedOnly
                  ? "저장한 맛집이나 카페가 없습니다."
                  : displayedRecommendationError || "추천 장소가 없습니다."}
            </Text>
          </VStack>
        </Card>
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
        />
      ) : null}
      {editingPlace && controller ? (
        <PlaceEditorDialog
          controller={controller}
          initialCategory={editingPlace.category}
          onClose={() => setEditingPlace(undefined)}
          place={editingPlace}
          viewerMemberId={viewerMemberId}
        />
      ) : null}
    </VStack>
  );
}

function savedItems(places: MapPlaceView[], category: PlaceHubCategory): PlaceHubItem[] {
  return places.flatMap((place, index) => (
    place.isSaved
      && (place.category === "restaurant" || place.category === "cafe")
      && (category === "all" || place.category === category)
      ? [{ place, storedPlace: place, popularityRank: index }]
      : []
  ));
}

function unifiedItems(
  places: MapPlaceView[],
  recommendations: CategorizedRecommendation[],
  category: PlaceHubCategory
): PlaceHubItem[] {
  const recommended = recommendationItems(places, recommendations).filter((item) => (
    category === "all" || item.place.category === category
  ));
  const savedOnly = savedItems(places, category).filter((saved) => !recommended.some((item) => (
    samePlace(item.place, saved.place)
  )));
  return [...recommended, ...savedOnly].map((item, popularityRank) => ({
    ...item,
    popularityRank,
  }));
}

function recommendationItems(
  places: MapPlaceView[],
  recommendations: CategorizedRecommendation[]
): PlaceHubItem[] {
  const stored = places.filter((place) => place.isSaved);
  return recommendations.map(({ category, discovery, popularityRank }) => {
    const storedPlace = stored.find((place) => isSamePlace(place, discovery));
    return {
      discovery,
      popularityRank,
      storedPlace,
      place: {
        ...(storedPlace ?? emptyRecommendationPlace(category, popularityRank)),
        name: discovery.name,
        address: discovery.address,
        latitude: discovery.latitude,
        longitude: discovery.longitude,
        mapUrl: discovery.mapUrl,
        isRecommended: true,
        isSaved: storedPlace?.isSaved ?? false,
        provider: "google-places",
        providerPlaceId: discovery.providerPlaceId,
      },
    };
  });
}

function samePlace(left: MapPlaceView, right: MapPlaceView) {
  return isSamePlace(left, right);
}

function emptyRecommendationPlace(
  category: PlaceRecommendationCategory,
  index: number
): MapPlaceView {
  return {
    id: `recommendation-${category}-${index}`,
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

function comparePlaceItems(left: PlaceHubItem, right: PlaceHubItem, sort: PlaceSort) {
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

function mergeUsage(current: PlaceProviderUsage[], next: PlaceProviderUsage[]) {
  const merged = new Map(current.map((item) => [item.sku, item]));
  next.forEach((item) => {
    const previous = merged.get(item.sku);
    merged.set(item.sku, previous && previous.used > item.used ? previous : item);
  });
  return [...merged.values()];
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
