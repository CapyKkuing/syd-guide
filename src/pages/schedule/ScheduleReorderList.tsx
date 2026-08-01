import { Button, HStack, Icon, Text, VStack } from "@astryxdesign/core";
import { useState } from "react";
import type { ScheduleItemView } from "../../data/contracts";

export function ScheduleReorderList({
  busy,
  items,
  onMove,
}: {
  busy: boolean;
  items: ScheduleItemView[];
  // eslint-disable-next-line no-unused-vars
  onMove: (sourceId: string, targetId: string) => Promise<void>;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  return (
    <VStack gap={2}>
      <Text color="secondary" type="supporting">
        PC에서는 일정을 끌어서 옮길 수 있습니다. 모바일에서는 화살표를 눌러 순서를 바꾸세요.
      </Text>
      <ol aria-label="일정 순서 편집" className="schedule-reorder-list">
        {items.map((item, index) => (
          <li
            className="schedule-reorder-item"
            data-dragging={draggedId === item.id || undefined}
            draggable={!busy}
            key={item.id}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={(event) => {
              setDraggedId(item.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
              setDraggedId(null);
              if (sourceId && sourceId !== item.id) void onMove(sourceId, item.id);
            }}
          >
            <HStack align="center" gap={2}>
              <Icon icon="arrowsUpDown" size="sm" />
              <Text className="schedule-reorder-item__number" hasTabularNumbers type="label">
                {index + 1}
              </Text>
              <VStack className="schedule-reorder-item__copy" gap={1}>
                <Text type="label">{item.title}</Text>
                <Text color="secondary" type="supporting">
                  {item.startsAt.slice(11, 16)}{item.place ? ` · ${item.place}` : ""}
                </Text>
              </VStack>
              <HStack gap={1}>
                <Button
                  icon={<Icon icon="arrowUp" />}
                  isDisabled={busy || index === 0}
                  isIconOnly
                  label={`${item.title} 위로 이동`}
                  onClick={() => {
                    const target = items[index - 1];
                    if (target) void onMove(item.id, target.id);
                  }}
                  size="md"
                  variant="ghost"
                />
                <Button
                  icon={<Icon icon="arrowDown" />}
                  isDisabled={busy || index === items.length - 1}
                  isIconOnly
                  label={`${item.title} 아래로 이동`}
                  onClick={() => {
                    const target = items[index + 1];
                    if (target) void onMove(item.id, target.id);
                  }}
                  size="md"
                  variant="ghost"
                />
              </HStack>
            </HStack>
          </li>
        ))}
      </ol>
    </VStack>
  );
}
