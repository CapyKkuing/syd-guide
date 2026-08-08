import { Button, Heading, HStack, VStack } from "@astryxdesign/core";
import { BottomSheet } from "../../components/BottomSheet";
import type { MapPlaceView } from "../../data/contracts";
import type { TripMutationController } from "../../services/mutations/controller";
import type { PlaceDiscoveryDetails } from "../../shared/places";
import { googleMapsDirectionsUrl, googleMapsSearchUrl } from "./googleMapsLinks";

export interface MapPlaceSheetProps {
  place: MapPlaceView;
  onClose: () => void;
  onEdit: () => void;
  returnFocusTo: HTMLElement | null;
  controller?: TripMutationController;
  discovery?: PlaceDiscoveryDetails | null;
  photoUrl?: string | null;
  hideManagement?: boolean;
}

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

export function MapPlaceSheet({
  controller,
  discovery,
  hideManagement = false,
  onClose,
  onEdit,
  place,
  photoUrl,
  returnFocusTo
}: MapPlaceSheetProps) {
  const mapsSearchUrl = googleMapsSearchUrl(place);
  const mapsDirectionsUrl = googleMapsDirectionsUrl(place);
  return (
    <BottomSheet ariaLabel="장소 상세" onClose={onClose} returnFocusTo={returnFocusTo}>
      <VStack className="map-place-sheet" gap={4}>
        {photoUrl ? (
          <figure className="map-place-sheet__photo">
            <img alt={`${place.name} 장소 사진`} src={photoUrl} />
            {discovery?.photo?.authorAttributions.length ? (
              <figcaption>
                사진: {discovery.photo.authorAttributions.map((author, index) => (
                  author.uri ? (
                    <a href={author.uri} key={author.uri} rel="noreferrer noopener" target="_blank">
                      {index ? `, ${author.displayName}` : author.displayName}
                    </a>
                  ) : index ? `, ${author.displayName}` : author.displayName
                ))}
                {discovery.photo.sourceUrl ? (
                  <> · <a href={discovery.photo.sourceUrl} rel="noreferrer noopener" target="_blank">Google Maps에서 사진 보기</a></>
                ) : null}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
        <Heading level={2}>{place.name}</Heading>
        <dl>
          <VStack as="div" gap={1}><dt>분류</dt><dd>{categoryLabels[place.category]}</dd></VStack>
          <VStack as="div" gap={1}><dt>상태</dt><dd>{statusLabels[place.status]}</dd></VStack>
          <VStack as="div" gap={1}><dt>주소</dt><dd>{discovery?.address || place.address}</dd></VStack>
          {discovery?.rating ? <VStack as="div" gap={1}><dt>평점</dt><dd>★ {discovery.rating.toFixed(1)} · 리뷰 {discovery.userRatingCount.toLocaleString("ko-KR")}개</dd></VStack> : null}
          {discovery?.openNow !== null && discovery?.openNow !== undefined ? <VStack as="div" gap={1}><dt>현재 영업</dt><dd>{discovery.openNow ? "영업 중" : "영업 종료"}</dd></VStack> : null}
          {discovery?.phone ? <VStack as="div" gap={1}><dt>전화</dt><dd><a href={`tel:${discovery.phone}`}>{discovery.phone}</a></dd></VStack> : null}
          {discovery?.websiteUrl ? <VStack as="div" gap={1}><dt>웹사이트</dt><dd><a href={discovery.websiteUrl} rel="noreferrer noopener" target="_blank">공식 사이트 열기</a></dd></VStack> : null}
          {place.description ? <VStack as="div" gap={1}><dt>설명</dt><dd>{place.description}</dd></VStack> : null}
        </dl>
        {discovery ? <p className="google-maps-attribution" translate="no">Google Maps</p> : null}
        <HStack className="map-place-sheet__map-links" gap={2}>
          <a className="map-place-sheet__map-link" href={discovery?.mapUrl ?? mapsSearchUrl} rel="noreferrer noopener" target="_blank">최신 정보 보기</a>
          <a className="map-place-sheet__map-link" href={mapsDirectionsUrl} rel="noreferrer noopener" target="_blank">길찾기</a>
        </HStack>
        {controller && !hideManagement ? <Button label="장소 수정" onClick={onEdit} size="lg" variant="secondary" width="100%" /> : null}
      </VStack>
    </BottomSheet>
  );
}
