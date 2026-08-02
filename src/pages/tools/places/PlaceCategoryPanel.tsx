import { Button, Card, Heading, HStack, Text, VStack } from "@astryxdesign/core";
import { useMemo, useState } from "react";
import type { MapPlaceView } from "../../../data/contracts";
import type { TripMutationController } from "../../../services/mutations/controller";
import { MapPlaceSheet } from "../../map/MapPlaceSheet";
import { PlaceEditorDialog } from "../../map/PlaceEditorDialog";

export function PlaceCategoryPanel({
  category,
  controller,
  emptyMessage,
  places,
  viewerMemberId,
}: {
  category: "restaurant" | "cafe" | "transport";
  controller?: TripMutationController;
  emptyMessage: string;
  places: MapPlaceView[];
  viewerMemberId: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<MapPlaceView | null>(null);
  const [editingPlace, setEditingPlace] = useState<MapPlaceView | null | undefined>();
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const filteredPlaces = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return places.filter((place) => place.category === category && (
      !query || `${place.name} ${place.address} ${place.description}`.toLocaleLowerCase().includes(query)
    ));
  }, [category, places, search]);

  function openPlace(place: MapPlaceView) {
    setReturnFocusTo(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setSelectedPlace(place);
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
          onChange={(event) => setSearch(event.target.value)}
          placeholder="이름, 주소, 설명"
          type="search"
          value={search}
        />
      </label>
      {filteredPlaces.length ? (
        <VStack gap={2}>
          {filteredPlaces.map((place) => (
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
                <Button label="상세 보기" onClick={() => openPlace(place)} size="sm" variant="secondary" />
              </VStack>
            </Card>
          ))}
        </VStack>
      ) : (
        <Card padding={4} variant="muted"><Text type="body">{emptyMessage}</Text></Card>
      )}
      {selectedPlace ? (
        <MapPlaceSheet
          controller={controller}
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
