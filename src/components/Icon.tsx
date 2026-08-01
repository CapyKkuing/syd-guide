import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "library"
  | "today"
  | "schedule"
  | "map"
  | "tools"
  | "weather"
  | "movement"
  | "booking"
  | "budget"
  | "settings"
  | "chevron"
  | "close";

const paths: Record<IconName, ReactNode> = {
  library: <><path d="M5 4.75h12.5A1.5 1.5 0 0 1 19 6.25v12.5a.5.5 0 0 1-.8.4L15 16.75l-3.2 2.4a.5.5 0 0 1-.6 0L8 16.75l-3.2 2.4a.5.5 0 0 1-.8-.4v-12A2 2 0 0 1 5.75 4.75Z" /><path d="M8 8h7M8 11h7" /></>,
  today: <><circle cx="12" cy="12" r="7" /><path d="M12 8v4l2.75 1.75M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>,
  schedule: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></>,
  map: <><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2Z" /><path d="M9 4v14M15 6v14" /></>,
  tools: <><path d="m14.5 6.5 3-3 3 3-3 3M13 8l-8.5 8.5a2.12 2.12 0 0 0 3 3L16 11" /><path d="m5 4 2.5 2.5M4 9l3 3" /></>,
  weather: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>,
  movement: <><path d="M4 17.5h16M7 17.5V11l5-4 5 4v6.5M10 17.5v-3h4v3" /><path d="M4 8h2M18 8h2" /></>,
  booking: <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  budget: <><circle cx="12" cy="12" r="8" /><path d="M15 9.5c-.58-.66-1.5-1-2.75-1-1.55 0-2.75.69-2.75 2s1.2 2 2.75 2 2.75.69 2.75 2-1.2 2-2.75 2c-1.25 0-2.17-.34-2.75-1M12.25 6.5v11" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.4v-4h.1A1.7 1.7 0 0 0 4.2 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.66 3.8l.06.06A1.7 1.7 0 0 0 8.6 4.2a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1v-.1h4v.1a1.7 1.7 0 0 0 1 1.7 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.6a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7 1Z" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  close: <path d="m6 6 12 12M18 6 6 18" />
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden={props["aria-hidden"] ?? true}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
