import { useMemo, useState } from "react";
import type { TripWorkspace } from "../../../data/contracts";
import { searchTrip, type SearchKind } from "./searchTrip";

const labels: Record<SearchKind, string> = {
  schedule: "일정",
  place: "장소",
  booking: "예약",
  checklist: "준비물",
  note: "메모"
};

export function SearchPanel({ workspace }: { workspace: TripWorkspace }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | SearchKind>("all");
  const results = useMemo(() => searchTrip(workspace, query, kind), [kind, query, workspace]);
  return (
    <article className="tool-card tool-card--wide" id="search">
      <h2>여행 검색</h2>
      <div className="tool-search-controls">
        <label><span>검색어</span><input minLength={2} type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label><span>검색 종류</span><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="all">전체</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      {query.trim().length === 1 ? <p>검색어를 두 글자 이상 입력하세요.</p> : null}
      <ul className="tool-search-results">
        {results.map((result) => <li key={`${result.kind}-${result.id}`}><a href={result.href}><span>{labels[result.kind]}</span><strong>{result.title}</strong><small>{result.excerpt}</small></a></li>)}
      </ul>
    </article>
  );
}
