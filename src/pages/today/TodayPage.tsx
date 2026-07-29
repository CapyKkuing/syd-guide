import { AfterTripHome } from "./AfterTripHome";
import { BeforeTripHome } from "./BeforeTripHome";
import { DuringTripHome } from "./DuringTripHome";
import type { TodayHomeProps } from "./todayHomeTypes";

export function TodayPage(props: TodayHomeProps) {
  if (props.today.experiencePhase === "before") {
    return <BeforeTripHome {...props} />;
  }
  if (props.today.experiencePhase === "during") {
    return <DuringTripHome {...props} />;
  }
  return <AfterTripHome {...props} />;
}
