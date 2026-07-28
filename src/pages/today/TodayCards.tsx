import { Badge, Card, ProgressBar } from "@astryxdesign/core";
import { AppLink } from "../../components/AppLink";
import { Icon } from "../../components/Icon";
import type { TodayViewModel } from "../../data/contracts";
import { isSafeExternalHttpsUrl } from "./todayHelpers";
import { pathForTrip } from "../../app/router";

type TodayCardProps = Pick<TodayViewModel, "weather" | "nextMovement" | "booking" | "budget"> & {
  tripId: string;
};

function CardHeading({ icon, title, id }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; id: string }) {
  return (
    <div className="today-card__heading">
      <Icon name={icon} />
      <h3 id={id}>{title}</h3>
    </div>
  );
}

export function WeatherCard({ weather }: Pick<TodayCardProps, "weather">) {
  return (
    <Card
      aria-labelledby="weather-card-title"
      className="today-card"
      data-motion-stack="true"
      elevation="low"
      padding={5}
      role="region"
      variant="green"
    >
      <div className="today-card__heading">
        <Icon name="weather" />
        <h3 id="weather-card-title">날씨</h3>
        <Badge className="today-card__badge" label="샘플" variant="neutral" />
      </div>
      <p className="today-card__value">{weather.temperatureC}°C · {weather.condition}</p>
      <p className="today-card__detail">{weather.location} · UV {weather.uvIndex}</p>
    </Card>
  );
}

export function MovementCard({ nextMovement }: Pick<TodayCardProps, "nextMovement">) {
  if (!nextMovement) {
    return (
      <Card
        aria-labelledby="movement-card-title"
        className="today-card"
        data-motion-stack="true"
        elevation="low"
        padding={5}
        role="region"
        variant="cyan"
      >
        <CardHeading icon="movement" title="다음 이동" id="movement-card-title" />
        <p className="today-card__detail">다음 이동 정보가 아직 없습니다.</p>
      </Card>
    );
  }

  return (
    <Card
      aria-labelledby="movement-card-title"
      className="today-card"
      data-motion-stack="true"
      elevation="low"
      padding={5}
      role="region"
      variant="cyan"
    >
      <div className="today-card__heading">
        <Icon name="movement" />
        <h3 id="movement-card-title">다음 이동</h3>
      </div>
      <p className="today-card__eyebrow">NEXT UP</p>
      <p className="today-card__value"><time>{nextMovement.departureTime}</time> · {nextMovement.countdownLabel}</p>
      <p className="today-card__detail">{nextMovement.origin} → {nextMovement.destination}</p>
      <p className="today-card__detail">{modeLabel(nextMovement.mode)} · {nextMovement.routeSummary}</p>
      {isSafeExternalHttpsUrl(nextMovement.mapUrl) ? (
        <a className="today-card__link" href={nextMovement.mapUrl} target="_blank" rel="noreferrer noopener">길찾기</a>
      ) : null}
    </Card>
  );
}

export function BookingCard({ booking, tripId }: Pick<TodayCardProps, "booking" | "tripId">) {
  return (
    <Card
      aria-labelledby="booking-card-title"
      className="today-card"
      data-motion-stack="true"
      elevation="low"
      padding={5}
      role="region"
      variant="orange"
    >
      <div className="today-card__heading">
        <Icon name="booking" />
        <h3 id="booking-card-title">예약</h3>
      </div>
      {booking ? (
        <>
          <p className="today-card__value">{booking.place}</p>
          <p className="today-card__detail">예약처: {booking.provider}</p>
          <p className="today-card__detail"><time>{booking.time}</time> · {booking.type} · {booking.status === "confirmed" ? "확정" : "확인 필요"}</p>
          <AppLink className="today-card__link" href={`${pathForTrip(tripId, "tools")}#bookings`}>예약 상세</AppLink>
        </>
      ) : <p className="today-card__detail">예약 정보를 아직 받지 못했습니다.</p>}
    </Card>
  );
}

export function BudgetCard({ budget }: Pick<TodayCardProps, "budget">) {
  const percentage = budget.limitAud > 0
    ? Math.min(100, Math.round((budget.spentAud / budget.limitAud) * 100))
    : 0;

  return (
    <Card
      aria-labelledby="budget-card-title"
      className="today-card"
      data-motion-stack="true"
      elevation="low"
      padding={5}
      role="region"
      variant="muted"
    >
      <div className="today-card__heading">
        <Icon name="budget" />
        <h3 id="budget-card-title">예산</h3>
        <Badge className="today-card__badge" label="샘플" variant="neutral" />
      </div>
      <p className="today-card__value">A${budget.spentAud.toLocaleString("en-AU")} / A${budget.limitAud.toLocaleString("en-AU")}</p>
      <p className="today-card__detail">{percentage}% 사용</p>
      <ProgressBar
        className="today-budget-progress"
        isLabelHidden
        label="예산 사용률"
        max={100}
        value={percentage}
        variant={percentage >= 90 ? "warning" : "accent"}
      />
    </Card>
  );
}

function modeLabel(mode: NonNullable<TodayViewModel["nextMovement"]>["mode"]): string {
  return { walk: "도보", transit: "대중교통", drive: "차량", ferry: "페리" }[mode];
}
