import { Button, HStack, Text, VStack } from "@astryxdesign/core";
import { useState, type FormEvent } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import type { MapPlaceView } from "../../data/contracts";
import type { MutationPayloadMap } from "../../shared/mutations";
import type { TripMutationController } from "../../services/mutations/controller";

export function PlaceEditorDialog({
  controller,
  initialCategory = "attraction",
  onClose,
  place,
  viewerMemberId
}: {
  controller: TripMutationController;
  initialCategory?: MapPlaceView["category"];
  onClose: () => void;
  place: MapPlaceView | null;
  viewerMemberId: string;
}) {
  const [name, setName] = useState(place?.name ?? "");
  const [category, setCategory] = useState<MapPlaceView["category"]>(place?.category ?? initialCategory);
  const [status, setStatus] = useState<MapPlaceView["status"]>(place?.status ?? "saved");
  const [address, setAddress] = useState(place?.address ?? "");
  const [description, setDescription] = useState(place?.description ?? "");
  const [latitude, setLatitude] = useState(place?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(place?.longitude?.toString() ?? "");
  const [mapUrl, setMapUrl] = useState(place?.mapUrl ?? "");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const coordinates = parseCoordinates(latitude, longitude);
    if (coordinates.error) {
      setError(coordinates.error);
      return;
    }
    const payload: MutationPayloadMap["place"] = {
      name: name.trim(),
      category,
      status,
      address: address.trim() || null,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      mapUrl: httpsOrNull(mapUrl),
      sourceUrl: place?.sourceUrl ?? null,
      imageUrl: place?.imageUrl ?? null,
      description: description.trim(),
      savedBy: place?.savedBy ?? viewerMemberId,
      isRecommended: place?.isRecommended ?? false,
      isSaved: place?.isSaved ?? true,
      provider: place?.provider ?? null,
      providerPlaceId: place?.providerPlaceId ?? null
    };
    try {
      await controller.submit(
        "place",
        place ? "update" : "create",
        place?.id ?? crypto.randomUUID(),
        place?.version ?? null,
        payload
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "장소를 저장하지 못했습니다.");
    }
  }

  async function remove() {
    if (!place) return;
    try {
      await controller.submit("place", "delete", place.id, place.version, null);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "장소를 삭제하지 못했습니다.");
    }
  }

  return (
    <BottomSheet ariaLabel={place ? "장소 수정" : "장소 추가"} onClose={onClose} returnFocusTo={null}>
      <form className="place-editor" onSubmit={submit}>
        <h2>{place ? "장소 수정" : "장소 추가"}</h2>
        <label><span>장소 이름</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>분류</span><select value={category} onChange={(event) => setCategory(event.target.value as MapPlaceView["category"])}>
          <option value="attraction">관광</option><option value="restaurant">맛집</option><option value="cafe">카페</option>
          <option value="lodging">숙소</option><option value="transport">교통</option>
        </select></label>
        <label><span>상태</span><select value={status} onChange={(event) => setStatus(event.target.value as MapPlaceView["status"])}>
          <option value="saved">저장</option><option value="maybe">고민</option><option value="visited">방문</option>
        </select></label>
        <label><span>주소</span><input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        <label><span>설명</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <HStack className="place-editor__coordinates" gap={3}>
          <label><span>위도</span><input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
          <label><span>경도</span><input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
        </HStack>
        <label><span>Google 지도 주소</span><input type="url" value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} /></label>
        {error ? <p role="alert">{error}</p> : null}
        {confirmDelete ? (
          <VStack className="place-editor__confirm" gap={2}>
            <Text type="label">{place?.name} 장소를 삭제할까요?</Text>
            <Button label="삭제 확인" onClick={() => void remove()} size="lg" variant="destructive" />
          </VStack>
        ) : null}
        <HStack className="place-editor__actions" gap={2} justify="end">
          {place ? <Button label="삭제" onClick={() => setConfirmDelete(true)} size="lg" variant="destructive" /> : null}
          <Button label="저장" size="lg" type="submit" variant="primary" />
        </HStack>
      </form>
    </BottomSheet>
  );
}

function parseCoordinates(latitude: string, longitude: string): {
  latitude: number | null;
  longitude: number | null;
  error?: string;
} {
  const latitudeValue = latitude.trim();
  const longitudeValue = longitude.trim();
  if (!latitudeValue && !longitudeValue) return { latitude: null, longitude: null };
  if (!latitudeValue || !longitudeValue) {
    return { latitude: null, longitude: null, error: "위도와 경도를 모두 입력해 주세요." };
  }
  const parsedLatitude = Number(latitudeValue);
  const parsedLongitude = Number(longitudeValue);
  if (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) {
    return { latitude: null, longitude: null, error: "위도는 -90부터 90 사이 숫자여야 합니다." };
  }
  if (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180) {
    return { latitude: null, longitude: null, error: "경도는 -180부터 180 사이 숫자여야 합니다." };
  }
  return { latitude: parsedLatitude, longitude: parsedLongitude };
}

function httpsOrNull(value: string): string | null {
  if (!value.trim()) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}
