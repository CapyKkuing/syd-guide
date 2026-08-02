import { Card, Heading, HStack, Text, VStack } from "@astryxdesign/core";
import type { MapPlaceView, ScheduleDayView } from "../../../data/contracts";
import type { TripMutationController } from "../../../services/mutations/controller";
import { PlaceCategoryPanel } from "../places/PlaceCategoryPanel";
import { transportReferences } from "../reference/sydneyGuide";

const modeLabels = {
  walk: "도보",
  transit: "대중교통",
  drive: "차량",
  ferry: "페리",
} as const;

export function TransportPanel({
  controller,
  days,
  places,
  viewerMemberId,
}: {
  controller?: TripMutationController;
  days: ScheduleDayView[];
  places: MapPlaceView[];
  viewerMemberId: string;
}) {
  const movements = days.flatMap((day) => day.items.flatMap((item) => item.travelMode ? [{ day, item }] : []));

  return (
    <VStack className="travel-reference-tool" gap={5}>
      <VStack gap={3}>
        <Heading level={2}>공식 실시간 정보</Heading>
        {transportReferences.map((reference) => (
          <Card className="reference-card" key={reference.href} padding={3}>
            <VStack gap={2}>
              <Heading level={3}>{reference.title}</Heading>
              <Text color="secondary" type="body">{reference.description}</Text>
              <a aria-label={`${reference.title} 공식 화면 열기`} className="reference-link" href={reference.href} rel="noreferrer" target="_blank">공식 화면 열기</a>
            </VStack>
          </Card>
        ))}
      </VStack>
      <VStack gap={3}>
        <HStack align="center" justify="between">
          <Heading level={2}>일정 이동 구간</Heading>
          <Text hasTabularNumbers type="label">{movements.length}개</Text>
        </HStack>
        {movements.length ? movements.map(({ day, item }) => (
          <Card className="reference-card" key={item.id} padding={3}>
            <VStack gap={1}>
              <Text color="accent" type="label">{day.dayLabel} · {item.startsAt.slice(11, 16)}</Text>
              <Heading level={3}>{item.title}</Heading>
              <Text type="body">{modeLabels[item.travelMode!] ?? "이동"}{item.travelNote ? ` · ${item.travelNote}` : ""}</Text>
            </VStack>
          </Card>
        )) : <Card padding={4} variant="muted"><Text type="body">일정에서 이동 수단을 지정하면 여기에 모아 보여줍니다.</Text></Card>}
      </VStack>
      <VStack gap={3}>
        <Heading level={2}>저장한 교통 장소</Heading>
        <PlaceCategoryPanel
          category="transport"
          controller={controller}
          emptyMessage="공항, 역, 선착장 같은 교통 장소를 추가해 두세요."
          places={places}
          viewerMemberId={viewerMemberId}
        />
      </VStack>
    </VStack>
  );
}
