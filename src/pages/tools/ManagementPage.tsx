import { Grid, Heading, Text, VStack } from "@astryxdesign/core";
import type { ReactNode } from "react";
import { ThemeControl } from "../../app/theme/ThemeControl";
import { OfflineBanner } from "../../components/OfflineBanner";

export function ManagementPage({
  deviceManagement,
}: {
  deviceManagement: ReactNode;
}) {
  return (
    <section className="tools-page management-page" aria-labelledby="management-title">
      <VStack gap={6}>
        <VStack className="tools-page__header" gap={1}>
          <Heading id="management-title" level={1}>관리</Heading>
          <Text type="body">참여자와 기기, 앱 설정을 한곳에서 관리하세요.</Text>
        </VStack>

        <section aria-labelledby="management-devices-title">
          <VStack gap={3}>
            <VStack gap={1}>
              <Heading id="management-devices-title" level={2}>참여자·초대·기기</Heading>
              <Text color="secondary" type="body">여행 멤버를 추가하고 초대 링크와 연결 기기를 관리합니다.</Text>
            </VStack>
            {deviceManagement}
          </VStack>
        </section>

        <Grid columns={{ minWidth: 280, max: 2 }} gap={3}>
          <section className="management-setting-card" aria-labelledby="management-theme-title">
            <VStack gap={3}>
              <VStack gap={1}>
                <Heading id="management-theme-title" level={2}>화면 설정</Heading>
                <Text color="secondary" type="body">이 기기에서 사용할 화면 테마를 선택합니다.</Text>
              </VStack>
              <ThemeControl />
            </VStack>
          </section>
          <section className="management-setting-card" aria-labelledby="management-sync-title">
            <VStack gap={3}>
              <VStack gap={1}>
                <Heading id="management-sync-title" level={2}>오프라인·동기화</Heading>
                <Text color="secondary" type="body">현재 연결 상태와 저장된 여행 정보 상태를 확인합니다.</Text>
              </VStack>
              <OfflineBanner />
            </VStack>
          </section>
        </Grid>
      </VStack>
    </section>
  );
}
