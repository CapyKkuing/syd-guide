import { SegmentedControl, SegmentedControlItem, Text, VStack } from "@astryxdesign/core";
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
  const [pendingChoice, setPendingChoice] = useState<VoteChoice | null>(null);

  async function vote(choice: VoteChoice) {
    if (!controller) return;
    const previousChoice = pendingChoice;
    setPendingChoice(choice);
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
      setPendingChoice(previousChoice);
      setError(caught instanceof Error ? caught.message : "투표를 저장하지 못했습니다.");
    }
  }

  return (
    <VStack className="place-vote-control" gap={2}>
      <Text type="label">내 선택</Text>
      <SegmentedControl
        disabledMessage="온라인으로 연결하면 선택을 저장할 수 있습니다."
        isDisabled={!controller}
        label={`${place.name} 투표`}
        layout="fill"
        onChange={(value) => void vote(value as VoteChoice)}
        size="md"
        value={pendingChoice ?? current?.choice ?? ""}
      >
        {choices.map((choice) => (
          <SegmentedControlItem key={choice.value} label={choice.label} value={choice.value} />
        ))}
      </SegmentedControl>
      {error ? <Text color="secondary" role="alert" type="supporting">{error}</Text> : null}
    </VStack>
  );
}
