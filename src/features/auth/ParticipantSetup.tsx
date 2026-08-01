import {
  Avatar,
  Badge,
  Button,
  Card,
  Heading,
  HStack,
  StackItem,
  Text,
  TextInput,
  VStack,
} from "@astryxdesign/core";
import { useEffect, useState, type ReactNode } from "react";
import { StatusPanel } from "../../components/StatusPanel";
import {
  getParticipantRoster,
  getPrincipal,
  setupParticipants,
  type ParticipantRoster,
} from "./api";

function SetupScreen({
  roster,
  onComplete,
}: {
  roster: ParticipantRoster;
  // eslint-disable-next-line no-unused-vars
  onComplete: (roster: ParticipantRoster) => void;
}) {
  const owner = roster.members.find((member) => member.id === "owner");
  const [ownerName, setOwnerName] = useState(
    owner?.displayName === "나" ? "" : owner?.displayName ?? ""
  );
  const [participantNames, setParticipantNames] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [attempted, setAttempted] = useState(false);
  const validNames = participantNames.map((name) => name.trim()).filter(Boolean);

  async function submit() {
    setAttempted(true);
    setStatus("");
    if (!ownerName.trim() || validNames.length !== participantNames.length) return;
    try {
      onComplete(await setupParticipants(ownerName.trim(), validNames));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "참여자 설정을 저장하지 못했습니다.");
    }
  }

  return (
    <VStack className="participant-setup" gap={5} maxWidth={520} width="100%">
      <VStack gap={1}>
        <Text color="accent" type="label">첫 설정</Text>
        <Heading level={1}>누구와 함께 가나요?</Heading>
        <Text color="secondary" type="body">
          대표자와 함께 갈 사람을 먼저 등록해 주세요. 기기 연결은 나중에 할 수 있어요.
        </Text>
      </VStack>

      <Card padding={4} variant="green">
        <VStack gap={3}>
          <Text type="label">내 정보</Text>
          <TextInput
            isRequired
            label="내 이름"
            onChange={setOwnerName}
            placeholder="이름 입력"
            status={attempted && !ownerName.trim()
              ? { type: "error", message: "내 이름을 입력해 주세요." }
              : undefined}
            value={ownerName}
          />
          <HStack align="center" gap={3}>
            <Avatar name={ownerName || "대표자"} size="lg" tooltip={false} />
            <VStack gap={0.5}>
              <HStack align="center" gap={2}>
                <Text type="label">{ownerName || "이름을 입력해 주세요"}</Text>
                <Badge label="대표자" variant="green" />
              </HStack>
              <Text color="secondary" type="supporting">여행 대표자 · 이 기기의 관리자</Text>
            </VStack>
          </HStack>
        </VStack>
      </Card>

      <Card padding={4}>
        <VStack gap={3}>
          <HStack align="center" justify="between">
            <Heading level={3}>함께 갈 사람</Heading>
            <Text color="secondary" type="supporting">
              {validNames.length}명 입력됨
            </Text>
          </HStack>
          {!participantNames.length ? (
            <Text color="secondary" type="supporting">
              선택 사항입니다. 나중에 기기 관리에서 추가할 수 있어요.
            </Text>
          ) : null}
          {participantNames.map((name, index) => (
            <HStack className="participant-person" align="end" gap={3} key={index}>
              <Avatar name={name || `참여자 ${index + 1}`} size="lg" tooltip={false} />
              <StackItem size="fill">
                <TextInput
                  isRequired
                  label={`함께 갈 사람 ${index + 1}`}
                  onChange={(value) => setParticipantNames((current) =>
                    current.map((item, itemIndex) => itemIndex === index ? value : item)
                  )}
                  placeholder="이름 입력"
                  status={attempted && !name.trim()
                    ? { type: "error", message: "이름을 입력해 주세요." }
                    : undefined}
                  value={name}
                />
              </StackItem>
              {participantNames.length ? (
                <Button
                  label={`${index + 1}번째 사람 삭제`}
                  onClick={() => setParticipantNames((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index)
                  )}
                  size="sm"
                  variant="ghost"
                >삭제</Button>
              ) : null}
            </HStack>
          ))}
          <Button
            label="함께 갈 사람 추가"
            onClick={() => setParticipantNames((current) => [...current, ""])}
            variant="secondary"
            width="100%"
          />
        </VStack>
      </Card>

      <VStack gap={2}>
        <Button
          clickAction={submit}
          label={`${participantNames.length + 1}명으로 시작하기`}
          size="lg"
          variant="primary"
          width="100%"
        />
        <Text color="secondary" type="supporting">
          대표자는 여행 안의 표시입니다. Cloudflare 보안 관리자 권한은 이 기기에 그대로 유지됩니다.
        </Text>
        {status ? <Text className="form-status" type="supporting">{status}</Text> : null}
      </VStack>
    </VStack>
  );
}

export function ParticipantSetupGate({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; roster: ParticipantRoster | null }
    | { status: "error"; message: string }
  >({ status: enabled ? "loading" : "ready", roster: null });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void getPrincipal().then(async (principal) => {
      const roster = principal.role === "owner" ? await getParticipantRoster() : null;
      if (active) setState({ status: "ready", roster });
    }).catch((error: unknown) => {
      if (active) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "참여자 설정을 확인하지 못했습니다.",
        });
      }
    });
    return () => { active = false; };
  }, [enabled]);

  if (state.status === "loading") {
    return <StatusPanel kind="loading" title="참여자 설정 확인 중" description="잠시만 기다려 주세요." />;
  }
  if (state.status === "error") {
    return <StatusPanel kind="error" title="참여자 설정을 불러오지 못했습니다" description={state.message} />;
  }
  if (state.roster && !state.roster.setupComplete) {
    return <SetupScreen roster={state.roster} onComplete={() => setState({ status: "ready", roster: null })} />;
  }
  return children;
}
