import {
  Button,
  Card,
  ClickableCard,
  Grid,
  Heading,
  HStack,
  List,
  ListItem,
  StatusDot,
  Text,
  VStack,
} from "@astryxdesign/core";
import { useCallback, useEffect, useState } from "react";
import { pathForTrip } from "../../app/router";
import { AppLink } from "../../components/AppLink";
import { BottomSheet } from "../../components/BottomSheet";
import { ExpensePanel } from "./ExpensePanel";
import { WeatherCard } from "./TodayCards";
import {
  expenseReminderKey,
  selectNextSchedule,
  shouldShowExpenseReminder,
} from "./homeSelectors";
import type { TodayHomeProps } from "./todayHomeTypes";

export function DuringTripHome({
  members,
  mutationController,
  today,
  trip,
  viewerMemberId,
}: TodayHomeProps) {
  const [reminderOpen, setReminderOpen] = useState(() =>
    shouldOpenReminder(trip.id, today.localDate, today.experiencePhase, trip.timeZone),
  );
  const [expenseOpenSignal, setExpenseOpenSignal] = useState(0);
  const schedule = selectNextSchedule(today.schedule, new Date());
  const nextMovement = today.nextMovement;

  const checkReminder = useCallback(() => {
    const dismissed = window.localStorage.getItem(
      expenseReminderKey(trip.id, today.localDate),
    ) === "dismissed";
    if (shouldShowExpenseReminder({
      experiencePhase: today.experiencePhase,
      localHour: hourInZone(new Date(), trip.timeZone),
      dismissed,
    })) {
      setReminderOpen(true);
    }
  }, [today.experiencePhase, today.localDate, trip.id, trip.timeZone]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkReminder();
    };
    window.addEventListener("focus", checkReminder);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", checkReminder);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkReminder]);

  function dismissReminder(openExpense: boolean) {
    window.localStorage.setItem(
      expenseReminderKey(trip.id, today.localDate),
      "dismissed",
    );
    setReminderOpen(false);
    if (openExpense) setExpenseOpenSignal((value) => value + 1);
  }

  return (
    <VStack gap={6}>
      <Card className="today-live-hero" elevation="low" padding={5} variant="muted">
        <VStack gap={4}>
          <HStack align="center" justify="between">
            <VStack gap={1}>
              <Text color="accent" type="label">여행 중 · {today.dayLabel}</Text>
              <Heading level={2}>오늘의 동선</Heading>
            </VStack>
            <HStack align="center" gap={1}>
              <StatusDot label="여행 중" variant="accent" />
              <Text type="supporting">여행 중</Text>
            </HStack>
          </HStack>
          <Card className="today-live-next" elevation="low" padding={4} variant="teal">
            <VStack gap={3}>
              <Text type="label">다음 이동</Text>
              <Heading level={3}>
                {nextMovement
                  ? `${nextMovement.departureTime} · ${nextMovement.destination}`
                  : "다음 이동을 일정에서 확인하세요"}
              </Heading>
              <Text type="supporting">
                {nextMovement
                  ? `${nextMovement.countdownLabel} · ${modeLabel(nextMovement.mode)} ${nextMovement.routeSummary}`
                  : "오늘 일정과 저장한 장소를 먼저 확인해 주세요."}
              </Text>
              {!reminderOpen ? (
                <Button
                  isDisabled={!mutationController}
                  label="지출 기록"
                  onClick={() => setExpenseOpenSignal((value) => value + 1)}
                  variant="primary"
                  width="100%"
                />
              ) : null}
            </VStack>
          </Card>
        </VStack>
      </Card>

      <Grid className="today-live-quick-row" columns={{ minWidth: 280, max: 2 }} gap={4}>
        <ClickableCard
          elevation="low"
          href={pathForTrip(trip.id, "map")}
          label="오늘 동선 지도 보기"
          padding={4}
          variant="cyan"
        >
          <VStack gap={2}>
            <Text type="label">ROUTE MAP</Text>
            <Heading level={3}>오늘 동선 지도</Heading>
            <Text type="supporting">일정 순서와 저장한 장소를 지도에서 확인합니다.</Text>
          </VStack>
        </ClickableCard>
        <WeatherCard weather={today.weather} />
      </Grid>

      <Card className="today-live-schedule" elevation="low" padding={5} variant="default">
        <VStack gap={4}>
          <HStack align="center" justify="between">
            <VStack gap={1}>
              <Text color="accent" type="label">TODAY TIMELINE</Text>
              <Heading level={2}>오늘 일정</Heading>
            </VStack>
            <AppLink href={pathForTrip(trip.id, "schedule")}>전체 보기</AppLink>
          </HStack>
          {schedule.length ? (
            <List density="balanced">
              {schedule.map((item) => (
                <ListItem
                  description={`${item.place || item.description}${item.travelNote ? ` · ${item.travelNote}` : ""}`}
                  endContent={
                    item.bookingStatus === "confirmed" ? (
                      <Text color="accent" type="label">예약 확정</Text>
                    ) : item.travelMode ? (
                      <Text type="label">{modeLabel(item.travelMode)}</Text>
                    ) : undefined
                  }
                  href={pathForTrip(trip.id, "schedule")}
                  key={item.id}
                  label={item.title}
                  startContent={<Text hasTabularNumbers type="label">{item.startsAt.slice(11, 16)}</Text>}
                />
              ))}
            </List>
          ) : <Text color="secondary" type="body">남은 일정이 없습니다.</Text>}
        </VStack>
      </Card>

      <ExpensePanel
        controller={mutationController}
        expenses={today.expenses}
        initiallyOpen={expenseOpenSignal > 0}
        key={expenseOpenSignal}
        localDate={today.localDate}
        members={members}
        mode="during"
        viewerMemberId={viewerMemberId}
      />

      {reminderOpen ? (
        <BottomSheet ariaLabel="오늘 지출 정리 알림" onClose={() => dismissReminder(false)} returnFocusTo={null}>
          <VStack gap={4}>
            <Text color="accent" type="label">21:00 CHECK</Text>
            <Heading level={2}>오늘 쓴 돈, 잊기 전에 정리할까요?</Heading>
            <Text type="body">식비·교통·쇼핑 등 오늘 지출을 지금 기록해 두세요.</Text>
            <HStack gap={2} justify="end">
              <Button label="오늘은 닫기" onClick={() => dismissReminder(false)} variant="secondary" />
              <Button label="지출 기록" onClick={() => dismissReminder(true)} variant="primary" />
            </HStack>
          </VStack>
        </BottomSheet>
      ) : null}
    </VStack>
  );
}

function modeLabel(mode: NonNullable<TodayHomeProps["today"]["nextMovement"]>["mode"]): string {
  return { walk: "도보", transit: "대중교통", drive: "차량", ferry: "페리" }[mode];
}

function hourInZone(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
}

function shouldOpenReminder(
  tripId: string,
  localDate: string,
  experiencePhase: TodayHomeProps["today"]["experiencePhase"],
  timeZone: string,
): boolean {
  const dismissed = window.localStorage.getItem(
    expenseReminderKey(tripId, localDate),
  ) === "dismissed";
  return shouldShowExpenseReminder({
    experiencePhase,
    localHour: hourInZone(new Date(), timeZone),
    dismissed,
  });
}
