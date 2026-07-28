import "./ThemeControl.css";
import { useTheme } from "./ThemeProvider";
import type { ThemePreference } from "./types";

const options: Array<{ label: string; value: ThemePreference }> = [
  { label: "라이트", value: "light" },
  { label: "다크", value: "dark" },
  { label: "시스템", value: "system" }
];

export function ThemeControl() {
  const { preference, setPreference } = useTheme();

  return (
    <fieldset className="theme-control">
      <legend>테마</legend>
      {options.map(({ label, value }) => (
        <label key={value} style={{ minHeight: 44 }}>
          <input
            checked={preference === value}
            name="theme-preference"
            onChange={() => setPreference(value)}
            type="radio"
            value={value}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
