import { Button, HStack, Icon, Text, VStack } from "@astryxdesign/core";
import { useRef, useState } from "react";
import type { ScheduleItemView } from "../../data/contracts";

export function ScheduleReorderList({
  busy,
  items,
  onMove,
}: {
  busy: boolean;
  items: ScheduleItemView[];
  // eslint-disable-next-line no-unused-vars
  onMove: (sourceId: string, targetId: string) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const pointerDrag = useRef<{ sourceId: string; targetId: string } | null>(null);

  function endPointerDrag() {
    const drag = pointerDrag.current;
    pointerDrag.current = null;
    setDraggedId(null);
    if (drag && drag.sourceId !== drag.targetId) {
      onMove(drag.sourceId, drag.targetId);
    }
  }

  return (
    <VStack gap={2}>
      <Text color="secondary" type="supporting">
        손잡이를 끌거나 화살표로 순서를 바꾼 뒤 완료를 눌러 저장하세요.
      </Text>
      <ol aria-label="일정 순서 편집" className="schedule-reorder-list">
        {items.map((item, index) => (
          <li
            className="schedule-reorder-item"
            data-dragging={draggedId === item.id || undefined}
            data-reorder-item-id={item.id}
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
              if (sourceId && sourceId !== item.id) onMove(sourceId, item.id);
            }}
          >
            <HStack align="center" gap={2}>
              <Button
                icon={<Icon icon="arrowsUpDown" />}
                isDisabled={busy}
                isIconOnly
                label={`${item.title} 끌어서 이동`}
                onPointerCancel={endPointerDrag}
                onPointerDown={(event) => {
                  if (busy || event.button !== 0) return;
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  pointerDrag.current = { sourceId: item.id, targetId: item.id };
                  setDraggedId(item.id);
                }}
                onPointerMove={(event) => {
                  if (!pointerDrag.current) return;
                  event.preventDefault();
                  const target = document.elementFromPoint(event.clientX, event.clientY)
                    ?.closest<HTMLElement>("[data-reorder-item-id]")
                    ?.dataset.reorderItemId;
                  if (target) pointerDrag.current.targetId = target;
                }}
                onPointerUp={endPointerDrag}
                size="md"
                variant="ghost"
              />
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
                    if (target) onMove(item.id, target.id);
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
                    if (target) onMove(item.id, target.id);
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
