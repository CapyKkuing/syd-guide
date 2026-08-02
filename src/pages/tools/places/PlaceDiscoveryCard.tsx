import {
  AspectRatio,
  Button,
  Card,
  Heading,
  HStack,
  Text,
  Token,
  VStack,
} from "@astryxdesign/core";
import { useEffect, useState } from "react";
import type { MapPlaceView } from "../../../data/contracts";
import { ApiClientError } from "../../../services/api/errors";
import type { TripMutationController } from "../../../services/mutations/controller";
import { placesApi } from "../../../services/places/api";
import type {
  PlaceDiscoveryDetails,
  PlaceProviderUsage,
} from "../../../shared/places";
import type { MutationPayloadMap } from "../../../shared/mutations";

export interface PlaceCardSelection {
  place: MapPlaceView;
  discovery: PlaceDiscoveryDetails | null;
  photoUrl: string | null;
}

export function PlaceDiscoveryCard({
  controller,
  onOpen,
  onUsage,
  place,
  tripId,
  viewerMemberId,
}: {
  controller?: TripMutationController;
  // ESLint's base rule does not recognize TypeScript function-type arguments.
  // eslint-disable-next-line no-unused-vars
  onOpen: (selection: PlaceCardSelection) => void;
  // eslint-disable-next-line no-unused-vars
  onUsage: (usage: PlaceProviderUsage[]) => void;
  place: MapPlaceView;
  tripId: string;
  viewerMemberId: string;
}) {
  const [discovery, setDiscovery] = useState<PlaceDiscoveryDetails | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => normalizeImageUrl(place.imageUrl));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void placesApi.getDiscovery(tripId, place.id).then((response) => {
      if (!active) return;
      setDiscovery(response.details);
      onUsage(response.usage);
    }).catch((caught: unknown) => {
      if (!active) return;
      setError(caught instanceof ApiClientError && caught.code === "PLACES_FREE_LIMIT_REACHED"
        ? "무료 사진 한도 도달"
        : "Google 정보 연결 전");
    });
    return () => { active = false; };
  }, [onUsage, place.id, place.providerPlaceId, tripId]);

  useEffect(() => {
    if (!discovery?.photo) return;
    let active = true;
    let objectUrl: string | null = null;
    void placesApi.getPhoto(tripId, place.id, discovery.photo.name).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setPhotoUrl(objectUrl);
    }).catch(() => {
      if (active) setPhotoUrl(normalizeImageUrl(place.imageUrl));
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [discovery?.photo, place.id, place.imageUrl, tripId]);

  async function toggleSaved() {
    if (!controller || isSaving) return;
    setIsSaving(true);
    const payload: MutationPayloadMap["place"] = {
      name: place.name,
      category: place.category,
      status: place.status,
      address: place.address || null,
      latitude: place.latitude,
      longitude: place.longitude,
      mapUrl: place.mapUrl,
      sourceUrl: place.sourceUrl,
      imageUrl: normalizeImageUrl(place.imageUrl),
      description: place.description,
      savedBy: place.isSaved ? null : viewerMemberId,
      isRecommended: place.isRecommended,
      isSaved: !place.isSaved,
      provider: discovery ? "google-places" : place.provider,
      providerPlaceId: discovery?.providerPlaceId ?? place.providerPlaceId,
    };
    try {
      await controller.submit("place", "update", place.id, place.version, payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장 상태를 바꾸지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const address = discovery?.address || place.address || "주소 정보 없음";
  const rating = discovery?.rating === null || discovery?.rating === undefined
    ? null
    : `★ ${discovery.rating.toFixed(1)} (${discovery.userRatingCount.toLocaleString("ko-KR")})`;
  const openLabel = discovery?.openNow === null || discovery?.openNow === undefined
    ? null
    : discovery.openNow ? "영업 중" : "영업 종료";

  return (
    <Card className="place-discovery-card" padding={0}>
      <AspectRatio fit="cover" ratio={16 / 10}>
        {photoUrl ? (
          <img alt={`${place.name} 장소 사진`} src={photoUrl} />
        ) : (
          <VStack className="place-discovery-card__photo-empty" gap={1}>
            <Text color="secondary" type="supporting">사진 준비 중</Text>
          </VStack>
        )}
      </AspectRatio>
      <VStack className="place-discovery-card__body" gap={2}>
        <HStack className="place-discovery-card__tokens" gap={1}>
          {place.isRecommended ? <Token color="green" label="추천" size="sm" /> : null}
          {place.isSaved ? <Token color="teal" label="내 저장" size="sm" /> : null}
        </HStack>
        <HStack align="start" justify="between">
          <VStack gap={1}>
            <Heading level={3}>{place.name}</Heading>
            <Text color="secondary" type="supporting">{address}</Text>
          </VStack>
          <Button
            isDisabled={!controller || isSaving}
            label={place.isSaved ? "저장됨" : "저장"}
            onClick={() => void toggleSaved()}
            size="sm"
            variant={place.isSaved ? "secondary" : "primary"}
          />
        </HStack>
        {rating || openLabel ? (
          <HStack className="place-discovery-card__meta" gap={2}>
            {rating ? <Text hasTabularNumbers type="label">{rating}</Text> : null}
            {openLabel ? <Text color="secondary" type="label">{openLabel}</Text> : null}
          </HStack>
        ) : null}
        {discovery ? (
          <Text className="google-maps-attribution" color="secondary" type="supporting">
            Google Maps
          </Text>
        ) : error ? <Text color="secondary" type="supporting">{error}</Text> : null}
        <Button
          label="상세 보기"
          onClick={() => onOpen({ place, discovery, photoUrl })}
          size="sm"
          variant="secondary"
        />
      </VStack>
    </Card>
  );
}

function normalizeImageUrl(value: string | null): string | null {
  return value?.startsWith("images/") ? `/${value}` : value;
}
