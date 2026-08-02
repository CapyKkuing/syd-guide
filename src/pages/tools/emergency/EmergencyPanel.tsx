import { Card, Heading, Text, VStack } from "@astryxdesign/core";
import type { MapPlaceView } from "../../../data/contracts";
import { emergencyContacts } from "../reference/sydneyGuide";

export function EmergencyPanel({ places }: { places: MapPlaceView[] }) {
  const lodgings = places.filter((place) => place.category === "lodging");

  return (
    <VStack className="travel-reference-tool" gap={5}>
      <Card className="emergency-priority" padding={4} variant="muted">
        <VStack gap={2}>
          <Text color="accent" type="label">호주 긴급번호</Text>
          <Heading level={2}>위급하면 000</Heading>
          <Text type="body">경찰·소방·구급이 즉시 필요한 상황에 사용합니다. 통화 시 현재 위치와 필요한 서비스를 먼저 말하세요.</Text>
          <a className="reference-call" href="tel:000">000 전화</a>
        </VStack>
      </Card>
      <VStack gap={3}>
        {emergencyContacts.map((contact) => (
          <Card className="reference-card" key={contact.phoneHref} padding={3}>
            <VStack gap={2}>
              <Heading level={3}>{contact.title}</Heading>
              <Text hasTabularNumbers type="body">{contact.phone}</Text>
              <Text color="secondary" type="body">{contact.description}</Text>
              <VStack gap={2}>
                <a className="reference-call" href={contact.phoneHref}>{contact.phone} 전화</a>
                <a className="reference-link" href={contact.sourceUrl} rel="noreferrer" target="_blank">공식 출처</a>
              </VStack>
            </VStack>
          </Card>
        ))}
      </VStack>
      <VStack gap={3}>
        <Heading level={2}>숙소 주소</Heading>
        {lodgings.length ? lodgings.map((place) => (
          <Card className="reference-card" key={place.id} padding={3}>
            <VStack gap={1}>
              <Heading level={3}>{place.name}</Heading>
              <Text type="body">{place.address || "주소를 입력해 주세요."}</Text>
            </VStack>
          </Card>
        )) : <Card padding={4} variant="muted"><Text type="body">구급·택시 요청에 쓸 숙소 주소를 지도에서 저장해 두세요.</Text></Card>}
      </VStack>
      <Text color="secondary" type="supporting">공식 연락처 확인일: 2026-08-02</Text>
    </VStack>
  );
}
