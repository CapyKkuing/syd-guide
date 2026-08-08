import { Card, Heading, Text, VStack } from "@astryxdesign/core";
import { pathForTool } from "../../../app/router";
import { AppLink } from "../../../components/AppLink";
import type { NoteView } from "../../../data/contracts";
import { fallbackTravelTips } from "../reference/sydneyGuide";

export function TipsPanel({ notes, tripId }: { notes: NoteView[]; tripId: string }) {
  const importedTips = notes
    .filter((note) => note.id.startsWith("legacy-tip-") && note.visibility === "shared")
    .map((note) => splitTip(note.id, note.body));
  const tips = importedTips.length ? importedTips : fallbackTravelTips;

  return (
    <VStack className="travel-reference-tool" gap={4}>
      <Text color="secondary" type="body">여행 중 바로 확인할 핵심 주의사항입니다. 온라인에서 서버의 최신 내용을 보여줍니다.</Text>
      {tips.map((tip) => (
        <Card className="reference-card" key={tip.id} padding={3}>
          <VStack gap={2}>
            <Heading level={3}>{tip.title}</Heading>
            <Text type="body">{tip.body}</Text>
          </VStack>
        </Card>
      ))}
      <VStack className="tips-actions" gap={2}>
        <AppLink className="reference-link" href={pathForTool(tripId, "checklist")}>준비 체크리스트 열기</AppLink>
        <AppLink className="reference-link" href={pathForTool(tripId, "emergency")}>비상 연락처 열기</AppLink>
      </VStack>
    </VStack>
  );
}

function splitTip(id: string, body: string) {
  const separator = body.indexOf(":");
  if (separator < 0) return { id, title: "여행 주의", body };
  return {
    id,
    title: body.slice(0, separator).trim(),
    body: body.slice(separator + 1).trim(),
  };
}
