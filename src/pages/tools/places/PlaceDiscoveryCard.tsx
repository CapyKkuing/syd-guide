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
import { useCallback, useEffect, useRef, useState } from "react";
import type { MapPlaceView } from "../../../data/contracts";
import { ApiClientError } from "../../../services/api/errors";
import type { TripMutationController } from "../../../services/mutations/controller";
import { placesApi } from "../../../services/places/api";
import type {
  PlaceDiscoveryDetails,
  PlaceProviderUsage,
} from "../../../shared/places";
import type { MutationPayloadMap } from "../../../shared/mutations";
import { googleMapsDirectionsUrl } from "../../map/googleMapsLinks";

export interface PlaceCardSelection {
  place: MapPlaceView;
  discovery: PlaceDiscoveryDetails | null;
  photoUrl: string | null;
  isTransient: boolean;
}

export function PlaceDiscoveryCard({
  controller,
  initialDiscovery,
  isRecommendation = false,
  onOpen,
  onUsage,
  place,
  storedPlace,
  tripId,
  viewerMemberId,
}: {
  controller?: TripMutationController;
  initialDiscovery?: PlaceDiscoveryDetails | null;
  isRecommendation?: boolean;
  // ESLint's base rule does not recognize TypeScript function-type arguments.
  // eslint-disable-next-line no-unused-vars
  onOpen: (selection: PlaceCardSelection) => void;
  // eslint-disable-next-line no-unused-vars
  onUsage: (usage: PlaceProviderUsage[]) => void;
  place: MapPlaceView;
  storedPlace?: MapPlaceView;
  tripId: string;
  viewerMemberId: string;
}) {
  const [loadedDiscovery, setLoadedDiscovery] = useState<PlaceDiscoveryDetails | null>(null);
  const discovery = initialDiscovery !== undefined ? initialDiscovery : loadedDiscovery;
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => normalizeImageUrl(place.imageUrl));
  const [error, setError] = useState("");
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);
  const mountedRef = useRef(true);
  const objectUrlRef = useRef<string | null>(null);
  const isTransient = !storedPlace;
  const isSaved = savedOverride ?? storedPlace?.isSaved ?? place.isSaved;

  const setPhotoBlob = useCallback((blob: Blob) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(blob);
    objectUrlRef.current = objectUrl;
    setPhotoUrl(objectUrl);
    return objectUrl;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (initialDiscovery !== undefined) return;
    let active = true;
    void placesApi.getDiscovery(tripId, place.id).then((response) => {
      if (!active) return;
      setLoadedDiscovery(response.details);
      onUsage(response.usage);
    }).catch((caught: unknown) => {
      if (!active) return;
      setError(caught instanceof ApiClientError && caught.code === "PLACES_FREE_LIMIT_REACHED"
        ? "무료 조회 한도 도달"
        : "Google 정보 연결 전");
    });
    return () => { active = false; };
  }, [initialDiscovery, onUsage, place.id, place.providerPlaceId, tripId]);

  useEffect(() => {
    if (!discovery?.photo) return;
    let active = true;
    const photoRequest = isRecommendation
      ? placesApi.getRecommendationPhoto(tripId, discovery.photo.name, { automatic: true })
      : placesApi.getPhoto(tripId, place.id, discovery.photo.name, { automatic: true });
    void photoRequest.then(({ blob, usage }) => {
      if (!active) return;
      setPhotoBlob(blob);
      onUsage([usage]);
    }).catch(() => {
      if (active) setPhotoUrl(normalizeImageUrl(place.imageUrl));
    });
    return () => {
      active = false;
    };
  }, [discovery?.photo, isRecommendation, onUsage, place.id, place.imageUrl, setPhotoBlob, tripId]);

  async function openDetails() {
    let nextPhotoUrl = photoUrl;
    if (!nextPhotoUrl && discovery?.photo) {
      setIsLoadingPhoto(true);
      try {
        const result = isRecommendation
          ? await placesApi.getRecommendationPhoto(tripId, discovery.photo.name)
          : await placesApi.getPhoto(tripId, place.id, discovery.photo.name);
        if (!mountedRef.current) return;
        nextPhotoUrl = setPhotoBlob(result.blob);
        onUsage([result.usage]);
      } catch {
        if (mountedRef.current) setError("사진을 불러오지 못했습니다.");
      } finally {
        if (mountedRef.current) setIsLoadingPhoto(false);
      }
    }
    if (!mountedRef.current) return;
    onOpen({ place, discovery, photoUrl: nextPhotoUrl, isTransient });
  }

  async function toggleSaved() {
    if (!controller || isSaving) return;
    setIsSaving(true);
    const persistent = storedPlace;
    const payload: MutationPayloadMap["place"] = {
      name: persistent?.name ?? "내가 저장한 Google 장소",
      category: place.category,
      status: persistent?.status ?? "saved",
      address: persistent?.address || null,
      latitude: persistent?.latitude ?? null,
      longitude: persistent?.longitude ?? null,
      mapUrl: persistent?.mapUrl ?? null,
      sourceUrl: persistent?.sourceUrl ?? null,
      imageUrl: normalizeImageUrl(persistent?.imageUrl ?? null),
      description: persistent?.description ?? "",
      savedBy: isSaved ? null : viewerMemberId,
      isRecommended: false,
      isSaved: !isSaved,
      provider: discovery ? "google-places" : persistent?.provider ?? place.provider,
      providerPlaceId: discovery?.providerPlaceId
        ?? persistent?.providerPlaceId
        ?? place.providerPlaceId,
    };
    try {
      await controller.submit(
        "place",
        persistent ? "update" : "create",
        persistent?.id ?? crypto.randomUUID(),
        persistent?.version ?? null,
        payload
      );
      setSavedOverride(!isSaved);
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
  const directionsUrl = googleMapsDirectionsUrl({
    name: discovery?.name ?? place.name,
    address: discovery?.address ?? place.address,
    latitude: discovery?.latitude ?? place.latitude,
    longitude: discovery?.longitude ?? place.longitude,
  });

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
          {isSaved ? <Token color="teal" label="내가 저장" size="sm" /> : null}
        </HStack>
        <HStack align="start" justify="between">
          <VStack gap={1}>
            <Heading level={3}>{place.name}</Heading>
            <Text color="secondary" type="supporting">{address}</Text>
          </VStack>
          <Button
            isDisabled={!controller || isSaving}
            label={isSaved ? "저장됨" : "저장"}
            onClick={() => void toggleSaved()}
            size="sm"
            variant={isSaved ? "secondary" : "primary"}
          />
        </HStack>
        {rating || openLabel ? (
          <HStack className="place-discovery-card__meta" gap={2}>
            {rating ? <Text hasTabularNumbers type="label">{rating}</Text> : null}
            {openLabel ? <Text color="secondary" type="label">{openLabel}</Text> : null}
          </HStack>
        ) : null}
        {discovery ? (
          <p className="google-maps-attribution" translate="no">Google Maps</p>
        ) : error ? <Text color="secondary" type="supporting">{error}</Text> : null}
        <HStack className="place-discovery-card__actions" gap={2}>
          <Button
            isDisabled={isLoadingPhoto}
            label={isLoadingPhoto ? "사진 불러오는 중" : "상세 보기"}
            onClick={() => void openDetails()}
            size="sm"
            variant="secondary"
          />
          <a
            className="map-place-sheet__map-link place-discovery-card__directions"
            href={directionsUrl}
            rel="noreferrer noopener"
            target="_blank"
          >
            길찾기
          </a>
        </HStack>
      </VStack>
    </Card>
  );
}

function normalizeImageUrl(value: string | null): string | null {
  return value?.startsWith("images/") ? `/${value}` : value;
}
