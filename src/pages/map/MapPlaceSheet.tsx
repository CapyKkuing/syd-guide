import { BottomSheet } from "../../components/BottomSheet";
import type { MapPlaceView } from "../../data/contracts";
import type { TripMutationController } from "../../services/mutations/controller";
import type { PlaceDiscoveryDetails } from "../../shared/places";
import { googleMapsDirectionsUrl, googleMapsSearchUrl } from "./googleMapsLinks";
import { PlaceVoteControl } from "./PlaceVoteControl";

export interface MapPlaceSheetProps {
  place: MapPlaceView;
  onClose: () => void;
  onEdit: () => void;
  returnFocusTo: HTMLElement | null;
  controller?: TripMutationController;
  viewerMemberId: string;
  discovery?: PlaceDiscoveryDetails | null;
  photoUrl?: string | null;
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
  onClose,
  onEdit,
  place,
  photoUrl,
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
              </figcaption>
            ) : null}
          </figure>
        ) : null}
        <h2>{place.name}</h2>
        <dl>
          <div><dt>분류</dt><dd>{categoryLabels[place.category]}</dd></div>
          <div><dt>상태</dt><dd>{statusLabels[place.status]}</dd></div>
          <div><dt>주소</dt><dd>{discovery?.address || place.address}</dd></div>
          {discovery?.rating ? <div><dt>평점</dt><dd>★ {discovery.rating.toFixed(1)} · 리뷰 {discovery.userRatingCount.toLocaleString("ko-KR")}개</dd></div> : null}
          {discovery?.openNow !== null && discovery?.openNow !== undefined ? <div><dt>현재 영업</dt><dd>{discovery.openNow ? "영업 중" : "영업 종료"}</dd></div> : null}
          {discovery?.phone ? <div><dt>전화</dt><dd><a href={`tel:${discovery.phone}`}>{discovery.phone}</a></dd></div> : null}
          {discovery?.websiteUrl ? <div><dt>웹사이트</dt><dd><a href={discovery.websiteUrl} rel="noreferrer noopener" target="_blank">공식 사이트 열기</a></dd></div> : null}
          {place.description ? <div><dt>설명</dt><dd>{place.description}</dd></div> : null}
        </dl>
        {discovery ? <p className="google-maps-attribution" translate="no">Google Maps</p> : null}
        <p>투표: 꼭 가요 {voteTotals.must} · 괜찮아요 {voteTotals.okay} · 건너뛰기 {voteTotals.skip}</p>
        <PlaceVoteControl controller={controller} place={place} viewerMemberId={viewerMemberId} />
        <div className="map-place-sheet__map-links">
          <a className="map-place-sheet__map-link" href={discovery?.mapUrl ?? mapsSearchUrl} rel="noreferrer noopener" target="_blank">최신 정보 보기</a>
          <a className="map-place-sheet__map-link" href={mapsDirectionsUrl} rel="noreferrer noopener" target="_blank">길찾기</a>
        </div>
        {controller ? <button className="secondary-button" onClick={onEdit} type="button">장소 수정</button> : null}
      </div>
    </BottomSheet>
  );
}
