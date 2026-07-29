import { BottomSheet } from "../../components/BottomSheet";
import type { MapPlaceView } from "../../data/contracts";
import type { TripMutationController } from "../../services/mutations/controller";
import { googleMapsDirectionsUrl, googleMapsSearchUrl } from "./googleMapsLinks";
import { PlaceVoteControl } from "./PlaceVoteControl";

export interface MapPlaceSheetProps {
  place: MapPlaceView;
  onClose: () => void;
  onEdit: () => void;
  returnFocusTo: HTMLElement | null;
  controller?: TripMutationController;
  viewerMemberId: string;
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
  onClose,
  onEdit,
  place,
  returnFocusTo,
  viewerMemberId
}: MapPlaceSheetProps) {
  const mapsSearchUrl = googleMapsSearchUrl(place);
  const mapsDirectionsUrl = googleMapsDirectionsUrl(place);
  const voteTotals = {
    must: place.votes.filter((vote) => vote.choice === "must").length,
    okay: place.votes.filter((vote) => vote.choice === "okay").length,
    skip: place.votes.filter((vote) => vote.choice === "skip").length
  };
  return (
    <BottomSheet ariaLabel="장소 상세" onClose={onClose} returnFocusTo={returnFocusTo}>
      <div className="map-place-sheet">
        <h2>{place.name}</h2>
        <dl>
          <div><dt>분류</dt><dd>{categoryLabels[place.category]}</dd></div>
          <div><dt>상태</dt><dd>{statusLabels[place.status]}</dd></div>
          <div><dt>주소</dt><dd>{place.address}</dd></div>
          {place.description ? <div><dt>설명</dt><dd>{place.description}</dd></div> : null}
        </dl>
        <p>투표: 꼭 가요 {voteTotals.must} · 괜찮아요 {voteTotals.okay} · 건너뛰기 {voteTotals.skip}</p>
        <PlaceVoteControl controller={controller} place={place} viewerMemberId={viewerMemberId} />
        <div className="map-place-sheet__map-links">
          <a className="map-place-sheet__map-link" href={mapsSearchUrl} rel="noreferrer noopener" target="_blank">최신 정보 보기</a>
          <a className="map-place-sheet__map-link" href={mapsDirectionsUrl} rel="noreferrer noopener" target="_blank">길찾기</a>
        </div>
        {controller ? <button className="secondary-button" onClick={onEdit} type="button">장소 수정</button> : null}
      </div>
    </BottomSheet>
  );
}
