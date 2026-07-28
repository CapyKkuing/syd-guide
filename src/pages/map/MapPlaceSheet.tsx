import { BottomSheet } from "../../components/BottomSheet";
import type { MapPlaceView } from "../../data/contracts";
import { isSafeGoogleMapsUrl } from "../../shared/externalUrls";

export interface MapPlaceSheetProps {
  place: MapPlaceView;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
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

export function MapPlaceSheet({ place, onClose, returnFocusTo }: MapPlaceSheetProps) {
  return (
    <BottomSheet ariaLabel="장소 상세" onClose={onClose} returnFocusTo={returnFocusTo}>
      <div className="map-place-sheet">
        <h2>{place.name}</h2>
        <dl>
          <div><dt>분류</dt><dd>{categoryLabels[place.category]}</dd></div>
          <div><dt>상태</dt><dd>{statusLabels[place.status]}</dd></div>
          <div><dt>주소</dt><dd>{place.address}</dd></div>
        </dl>
        {isSafeGoogleMapsUrl(place.mapUrl) ? (
          <a className="map-place-sheet__map-link" href={place.mapUrl} rel="noreferrer noopener" target="_blank">
            Google 지도 열기
          </a>
        ) : null}
      </div>
    </BottomSheet>
  );
}
