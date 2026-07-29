export interface Freshness {
  source: "live" | "cached" | "sample";
  updatedAt: string | null;
}

const sourceLabels: Record<Freshness["source"], string> = {
  live: "실시간",
  cached: "저장됨",
  sample: "샘플"
};

export function DataFreshness({ value }: { value: Freshness }) {
  return (
    <span className="data-freshness">
      <strong>{sourceLabels[value.source]}</strong>
      {value.updatedAt ? <span>마지막 업데이트 {formatUpdatedAt(value.updatedAt)}</span> : null}
    </span>
  );
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
