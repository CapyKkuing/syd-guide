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
import { useState } from "react";
import {
  addParticipant,
  deleteParticipant,
  updateParticipant,
  type ParticipantRoster,
} from "./api";

export function ParticipantManager({
  roster,
  onChange,
}: {
  roster: ParticipantRoster;
  // eslint-disable-next-line no-unused-vars
  onChange: (roster: ParticipantRoster) => void;
}) {
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const members = roster.members.filter((member) => member.isActive);

  async function add() {
    if (!newName.trim()) {
      setStatus("추가할 사람의 이름을 입력해 주세요.");
      return;
    }
    setStatus("");
    try {
      onChange(await addParticipant(newName.trim()));
      setNewName("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "참여자를 추가하지 못했습니다.");
    }
  }

  async function makeRepresentative(memberId: string) {
    setStatus("");
    try {
      onChange(await updateParticipant(memberId, { isRepresentative: true }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "대표자를 변경하지 못했습니다.");
    }
  }

  async function remove(memberId: string) {
    setStatus("");
    try {
      onChange(await deleteParticipant(memberId));
      setDeleteTargetId(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "참여자를 삭제하지 못했습니다.");
    }
  }

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <VStack gap={1}>
          <Heading level={3}>여행 참여자</Heading>
          <Text color="secondary" type="supporting">
            대표자는 여행 안의 표시입니다. 보안 관리자 권한은 바뀌지 않습니다.
          </Text>
        </VStack>
        {members.map((member) => (
          <HStack className="participant-person" align="center" gap={3} key={member.id}>
            <Avatar name={member.displayName} size="lg" tooltip={false} />
            <StackItem size="fill">
              <VStack gap={0.5}>
                <HStack align="center" gap={2}>
                  <Text type="label">{member.displayName}</Text>
                  {member.isRepresentative ? <Badge label="대표자" variant="green" /> : null}
                </HStack>
                <Text color="secondary" type="supporting">
                  {member.id === "owner" ? "이 기기의 보안 관리자" : `연결 기기 ${member.deviceCount}대`}
                </Text>
              </VStack>
            </StackItem>
            {!member.isRepresentative || member.id !== "owner" ? (
              <HStack align="center" gap={1} wrap="wrap">
                {!member.isRepresentative ? (
                  <Button
                    clickAction={() => makeRepresentative(member.id)}
                    label={`${member.displayName} 대표자로 지정`}
                    size="sm"
                    variant="ghost"
                  >대표자로</Button>
                ) : null}
                {member.id !== "owner" && deleteTargetId === member.id ? (
                  <>
                    <Button
                      clickAction={() => remove(member.id)}
                      label={`${member.displayName} 삭제 확인`}
                      size="sm"
                      variant="ghost"
                    >삭제 확인</Button>
                    <Button
                      clickAction={() => setDeleteTargetId(null)}
                      label={`${member.displayName} 삭제 취소`}
                      size="sm"
                      variant="secondary"
                    >취소</Button>
                  </>
                ) : member.id !== "owner" ? (
                  <Button
                    clickAction={() => setDeleteTargetId(member.id)}
                    label={`${member.displayName} 삭제`}
                    size="sm"
                    variant="ghost"
                  >삭제</Button>
                ) : null}
              </HStack>
            ) : null}
          </HStack>
        ))}
        <HStack className="participant-add-row" align="end" gap={2}>
          <StackItem size="fill">
            <TextInput
              label="새 참여자 이름"
              onChange={setNewName}
              placeholder="이름 입력"
              value={newName}
            />
          </StackItem>
          <Button clickAction={add} label="참여자 추가" variant="secondary" />
        </HStack>
        {status ? <Text className="form-status" type="supporting">{status}</Text> : null}
      </VStack>
    </Card>
  );
}
