import { useState } from "react";
import type { MapPlaceView } from "../../data/contracts";
import type { VoteChoice } from "../../shared/entities";
import type { TripMutationController } from "../../services/mutations/controller";

const choices: Array<{ value: VoteChoice; label: string }> = [
  { value: "must", label: "꼭 가요" },
  { value: "okay", label: "괜찮아요" },
  { value: "skip", label: "건너뛰기" }
];

export function PlaceVoteControl({
  controller,
  place,
  viewerMemberId
}: {
  controller?: TripMutationController;
  place: MapPlaceView;
  viewerMemberId: string;
}) {
  const [error, setError] = useState("");
  const current = place.votes.find((vote) => vote.memberId === viewerMemberId);

  async function vote(choice: VoteChoice) {
    if (!controller) return;
    setError("");
    try {
      await controller.submit(
        "vote",
        current ? "update" : "create",
        current?.id ?? crypto.randomUUID(),
        current?.version ?? null,
        { targetType: "place", targetId: place.id, choice }
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "투표를 저장하지 못했습니다.");
    }
  }

  return (
    <div className="place-vote-control">
      <p>내 선택</p>
      <div role="group" aria-label={`${place.name} 투표`}>
        {choices.map((choice) => (
          <button
            aria-pressed={current?.choice === choice.value}
            disabled={!controller}
            key={choice.value}
            onClick={() => void vote(choice.value)}
            type="button"
          >
            {choice.label}
          </button>
        ))}
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
