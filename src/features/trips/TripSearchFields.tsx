import {
  Typeahead,
  TypeaheadItem,
  type SearchableItem,
  type SearchSource,
} from "@astryxdesign/core/Typeahead";
import { airportOptions, flightTimeZones } from "./flightOptions";

interface DestinationItem extends SearchableItem {
  destination: string;
  timeZone: string;
  searchText: string;
  description: string;
}

interface TimeZoneItem extends SearchableItem {
  timeZone: string;
  searchText: string;
  description: string;
}

interface DestinationSeed {
  destination: string;
  englishName: string;
  country: string;
  timeZone: string;
  aliases: string[];
}

const additionalDestinationSeeds: DestinationSeed[] = [
  { destination: "가오슝", englishName: "Kaohsiung", country: "대만 Taiwan", timeZone: "Asia/Taipei", aliases: ["카오슝"] },
  { destination: "상하이", englishName: "Shanghai", country: "중국 China", timeZone: "Asia/Shanghai", aliases: ["상해"] },
  { destination: "베이징", englishName: "Beijing", country: "중국 China", timeZone: "Asia/Shanghai", aliases: ["북경"] },
  { destination: "칭다오", englishName: "Qingdao", country: "중국 China", timeZone: "Asia/Shanghai", aliases: [] },
  { destination: "마카오", englishName: "Macau", country: "마카오 Macau", timeZone: "Asia/Macau", aliases: ["Macao"] },
  { destination: "오사카", englishName: "Osaka", country: "일본 Japan", timeZone: "Asia/Tokyo", aliases: [] },
  { destination: "삿포로", englishName: "Sapporo", country: "일본 Japan", timeZone: "Asia/Tokyo", aliases: [] },
  { destination: "교토", englishName: "Kyoto", country: "일본 Japan", timeZone: "Asia/Tokyo", aliases: [] },
  { destination: "나고야", englishName: "Nagoya", country: "일본 Japan", timeZone: "Asia/Tokyo", aliases: [] },
  { destination: "오키나와", englishName: "Okinawa", country: "일본 Japan", timeZone: "Asia/Tokyo", aliases: ["나하", "Naha"] },
  { destination: "치앙마이", englishName: "Chiang Mai", country: "태국 Thailand", timeZone: "Asia/Bangkok", aliases: [] },
  { destination: "푸껫", englishName: "Phuket", country: "태국 Thailand", timeZone: "Asia/Bangkok", aliases: ["푸켓"] },
  { destination: "파타야", englishName: "Pattaya", country: "태국 Thailand", timeZone: "Asia/Bangkok", aliases: [] },
  { destination: "다낭", englishName: "Da Nang", country: "베트남 Vietnam", timeZone: "Asia/Ho_Chi_Minh", aliases: ["Danang"] },
  { destination: "나트랑", englishName: "Nha Trang", country: "베트남 Vietnam", timeZone: "Asia/Ho_Chi_Minh", aliases: [] },
  { destination: "푸꾸옥", englishName: "Phu Quoc", country: "베트남 Vietnam", timeZone: "Asia/Ho_Chi_Minh", aliases: [] },
  { destination: "씨엠립", englishName: "Siem Reap", country: "캄보디아 Cambodia", timeZone: "Asia/Phnom_Penh", aliases: ["앙코르와트", "Angkor Wat"] },
  { destination: "비엔티안", englishName: "Vientiane", country: "라오스 Laos", timeZone: "Asia/Vientiane", aliases: [] },
  { destination: "보라카이", englishName: "Boracay", country: "필리핀 Philippines", timeZone: "Asia/Manila", aliases: [] },
  { destination: "보홀", englishName: "Bohol", country: "필리핀 Philippines", timeZone: "Asia/Manila", aliases: [] },
  { destination: "괌", englishName: "Guam", country: "괌 Guam", timeZone: "Pacific/Guam", aliases: [] },
  { destination: "사이판", englishName: "Saipan", country: "북마리아나 제도 Northern Mariana Islands", timeZone: "Pacific/Saipan", aliases: [] },
  { destination: "델리", englishName: "Delhi", country: "인도 India", timeZone: "Asia/Kolkata", aliases: ["뉴델리", "New Delhi"] },
  { destination: "뭄바이", englishName: "Mumbai", country: "인도 India", timeZone: "Asia/Kolkata", aliases: ["Bombay"] },
  { destination: "발리", englishName: "Bali", country: "인도네시아 Indonesia", timeZone: "Asia/Makassar", aliases: ["덴파사르", "Denpasar"] },
  { destination: "쿠타", englishName: "Kuta", country: "인도네시아 Indonesia", timeZone: "Asia/Makassar", aliases: [] },
  { destination: "프라하", englishName: "Prague", country: "체코 Czechia", timeZone: "Europe/Prague", aliases: [] },
  { destination: "빈", englishName: "Vienna", country: "오스트리아 Austria", timeZone: "Europe/Vienna", aliases: ["비엔나"] },
  { destination: "로마", englishName: "Rome", country: "이탈리아 Italy", timeZone: "Europe/Rome", aliases: [] },
  { destination: "밀라노", englishName: "Milan", country: "이탈리아 Italy", timeZone: "Europe/Rome", aliases: [] },
  { destination: "베네치아", englishName: "Venice", country: "이탈리아 Italy", timeZone: "Europe/Rome", aliases: ["베니스"] },
  { destination: "바르셀로나", englishName: "Barcelona", country: "스페인 Spain", timeZone: "Europe/Madrid", aliases: [] },
  { destination: "마드리드", englishName: "Madrid", country: "스페인 Spain", timeZone: "Europe/Madrid", aliases: [] },
  { destination: "리스본", englishName: "Lisbon", country: "포르투갈 Portugal", timeZone: "Europe/Lisbon", aliases: [] },
  { destination: "아테네", englishName: "Athens", country: "그리스 Greece", timeZone: "Europe/Athens", aliases: [] },
  { destination: "부다페스트", englishName: "Budapest", country: "헝가리 Hungary", timeZone: "Europe/Budapest", aliases: [] },
  { destination: "취리히", englishName: "Zurich", country: "스위스 Switzerland", timeZone: "Europe/Zurich", aliases: [] },
  { destination: "레이캬비크", englishName: "Reykjavik", country: "아이슬란드 Iceland", timeZone: "Atlantic/Reykjavik", aliases: [] },
  { destination: "두브로브니크", englishName: "Dubrovnik", country: "크로아티아 Croatia", timeZone: "Europe/Zagreb", aliases: [] },
  { destination: "카이로", englishName: "Cairo", country: "이집트 Egypt", timeZone: "Africa/Cairo", aliases: [] },
  { destination: "마라케시", englishName: "Marrakesh", country: "모로코 Morocco", timeZone: "Africa/Casablanca", aliases: ["Marrakech"] },
  { destination: "케이프타운", englishName: "Cape Town", country: "남아프리카 South Africa", timeZone: "Africa/Johannesburg", aliases: [] },
  { destination: "호놀룰루", englishName: "Honolulu", country: "미국 USA", timeZone: "Pacific/Honolulu", aliases: ["하와이", "Hawaii"] },
  { destination: "라스베이거스", englishName: "Las Vegas", country: "미국 USA", timeZone: "America/Los_Angeles", aliases: [] },
  { destination: "시애틀", englishName: "Seattle", country: "미국 USA", timeZone: "America/Los_Angeles", aliases: [] },
  { destination: "시카고", englishName: "Chicago", country: "미국 USA", timeZone: "America/Chicago", aliases: [] },
  { destination: "보스턴", englishName: "Boston", country: "미국 USA", timeZone: "America/New_York", aliases: [] },
  { destination: "올랜도", englishName: "Orlando", country: "미국 USA", timeZone: "America/New_York", aliases: [] },
  { destination: "칸쿤", englishName: "Cancun", country: "멕시코 Mexico", timeZone: "America/Cancun", aliases: [] },
  { destination: "리우데자네이루", englishName: "Rio de Janeiro", country: "브라질 Brazil", timeZone: "America/Sao_Paulo", aliases: ["리우"] },
  { destination: "부에노스아이레스", englishName: "Buenos Aires", country: "아르헨티나 Argentina", timeZone: "America/Argentina/Buenos_Aires", aliases: [] },
  { destination: "피지", englishName: "Fiji", country: "피지 Fiji", timeZone: "Pacific/Fiji", aliases: ["난디", "Nadi"] },
  { destination: "타히티", englishName: "Tahiti", country: "프랑스령 폴리네시아 French Polynesia", timeZone: "Pacific/Tahiti", aliases: ["파페에테", "Papeete"] },
];

const timeZoneAbbreviations: Record<string, string> = {
  "Asia/Seoul": "KST",
  "Asia/Tokyo": "JST",
  "Asia/Singapore": "SGT",
  "Asia/Hong_Kong": "HKT",
  "Asia/Taipei": "CST",
  "Asia/Bangkok": "ICT",
  "Asia/Kuala_Lumpur": "MYT",
  "Asia/Ho_Chi_Minh": "ICT",
  "Asia/Manila": "PHT",
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Dubai": "GST",
  "Asia/Qatar": "AST",
  "Australia/Sydney": "AEST · AEDT",
  "Australia/Melbourne": "AEST · AEDT",
  "Australia/Brisbane": "AEST",
  "Australia/Adelaide": "ACST · ACDT",
  "Australia/Perth": "AWST",
  "Australia/Darwin": "ACST",
  "Australia/Hobart": "AEST · AEDT",
  "Pacific/Auckland": "NZST · NZDT",
  "Europe/London": "GMT · BST",
  "Europe/Paris": "CET · CEST",
  "Europe/Berlin": "CET · CEST",
  "Europe/Amsterdam": "CET · CEST",
  "Europe/Istanbul": "TRT",
  "America/Los_Angeles": "PST · PDT",
  "America/New_York": "EST · EDT",
  "America/Vancouver": "PST · PDT",
  "America/Toronto": "EST · EDT",
};

const destinationItems = buildDestinationItems();
const timeZoneItems = buildTimeZoneItems();

const destinationSource: SearchSource<DestinationItem> = {
  bootstrap: () => destinationItems.slice(0, 12),
  search: (query) => {
    const matches = searchItems(destinationItems, query);
    return query.trim() ? [...matches, directDestinationItem(query)] : matches;
  },
};

const timeZoneSource: SearchSource<TimeZoneItem> = {
  bootstrap: () => timeZoneItems.filter((item) => item.description).slice(0, 12),
  search: (query) => searchItems(timeZoneItems, query),
};

export function DestinationField({
  destination,
  timeZone,
  onChange,
}: {
  destination: string;
  timeZone: string;
  // ESLint's base rule does not recognize TypeScript function arguments.
  // eslint-disable-next-line no-unused-vars
  onChange: (destination: string, timeZone: string) => void;
}) {
  const selected = findDestinationItem(destination)
    ?? (destination ? customDestinationItem(destination, timeZone) : null);

  return (
    <Typeahead
      label="여행지"
      searchSource={destinationSource}
      value={selected}
      onChange={(item) => onChange(item?.destination ?? "", item?.timeZone ?? "")}
      renderItem={(item) => <TypeaheadItem item={item} description={item.description} />}
      placeholder="도시·국가를 한글 또는 영어로 검색"
      emptySearchResultsText="일치하는 여행지가 없습니다"
      hasEntriesOnFocus
      isRequired
      maxMenuItems={12}
      debounceMs={0}
    />
  );
}

export function TimeZoneField({
  value,
  onChange,
}: {
  value: string;
  // ESLint's base rule does not recognize TypeScript function arguments.
  // eslint-disable-next-line no-unused-vars
  onChange: (timeZone: string) => void;
}) {
  const selected = findTimeZoneItem(value)
    ?? (value ? customTimeZoneItem(value) : null);

  return (
    <Typeahead
      label="시간대"
      searchSource={timeZoneSource}
      value={selected}
      onChange={(item) => onChange(item?.timeZone ?? "")}
      renderItem={(item) => <TypeaheadItem item={item} description={item.description} />}
      placeholder="예: 서울, Seoul, KST"
      emptySearchResultsText="일치하는 시간대가 없습니다"
      hasEntriesOnFocus
      isRequired
      maxMenuItems={12}
      debounceMs={0}
    />
  );
}

function buildDestinationItems(): DestinationItem[] {
  const seen = new Set<string>();
  const airportItems = airportOptions.flatMap((airport) => {
    const englishCity = preferredEnglishCity(airport.aliases);
    const destination = englishCity || airport.city;
    const key = `${destination.toLocaleLowerCase("en-US")}:${airport.timeZone}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const country = countryLabel(airport.timeZone);
    const label = [airport.city, englishCity, country].filter(Boolean).join(" · ");
    return [{
      id: key,
      label,
      destination,
      timeZone: airport.timeZone,
      description: `${country} · ${airport.timeZone}`,
      searchText: [label, airport.iata, airport.name, ...airport.aliases].join(" "),
    }];
  });
  const additionalItems = additionalDestinationSeeds.flatMap((seed) => {
    const key = `${seed.englishName.toLocaleLowerCase("en-US")}:${seed.timeZone}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const label = [seed.destination, seed.englishName, seed.country].join(" · ");
    return [{
      id: key,
      label,
      destination: seed.englishName,
      timeZone: seed.timeZone,
      description: `${seed.country} · ${seed.timeZone}`,
      searchText: [label, ...seed.aliases].join(" "),
    }];
  });
  return [...airportItems, ...additionalItems];
}

function buildTimeZoneItems(): TimeZoneItem[] {
  return flightTimeZones.map((timeZone) => {
    const destinations = destinationItems.filter((item) => item.timeZone === timeZone);
    const cities = destinations.flatMap((item) => [item.destination, item.label]);
    const abbreviations = timeZoneAbbreviations[timeZone] ?? "";
    const country = countryLabel(timeZone);
    const localCity = destinations[0]?.label.split(" · ")[0] ?? "";
    const label = [timeZone, localCity, abbreviations].filter(Boolean).join(" · ");
    return {
      id: timeZone,
      label,
      timeZone,
      description: destinations.length ? country : "",
      searchText: [label, country, ...cities].join(" "),
    };
  });
}

function findDestinationItem(input: string): DestinationItem | undefined {
  const query = normalize(input);
  if (!query) return undefined;
  return destinationItems.find((item) =>
    normalize(item.destination) === query
    || item.searchText.split(" ").some((value) => normalize(value) === query),
  );
}

function findTimeZoneItem(input: string): TimeZoneItem | undefined {
  const query = normalize(input);
  if (!query) return undefined;
  const matches = timeZoneItems.filter((item) =>
    normalize(item.timeZone) === query
    || item.searchText.split(/[ ·]+/).some((value) => normalize(value) === query),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function searchItems<T extends { searchText: string }>(items: T[], query: string): T[] {
  const normalized = normalize(query);
  return items.filter((item) => normalize(item.searchText).includes(normalized));
}

function preferredEnglishCity(aliases: string[]): string {
  const englishAliases = aliases.filter((alias) => /[a-z]/i.test(alias));
  const shortName = [...englishAliases].reverse().find((alias) =>
    !/(airport|international|kingsford|tullamarine|coolangatta)/i.test(alias),
  );
  return shortName ?? englishAliases.at(-1)?.replace(/\s+(international\s+)?airport.*$/i, "") ?? "";
}

function countryLabel(timeZone: string): string {
  if (timeZone.startsWith("Australia/")) return "호주 Australia";
  if (timeZone === "Asia/Seoul") return "대한민국 Korea";
  if (timeZone === "Asia/Tokyo") return "일본 Japan";
  if (timeZone === "Asia/Singapore") return "싱가포르 Singapore";
  if (timeZone === "Asia/Hong_Kong") return "홍콩 Hong Kong";
  if (timeZone === "Asia/Taipei") return "대만 Taiwan";
  if (timeZone === "Asia/Bangkok") return "태국 Thailand";
  if (timeZone === "Asia/Kuala_Lumpur") return "말레이시아 Malaysia";
  if (timeZone === "Asia/Ho_Chi_Minh") return "베트남 Vietnam";
  if (timeZone === "Asia/Manila") return "필리핀 Philippines";
  if (["Asia/Jakarta", "Asia/Makassar"].includes(timeZone)) return "인도네시아 Indonesia";
  if (timeZone === "Pacific/Auckland") return "뉴질랜드 New Zealand";
  if (timeZone === "Asia/Dubai") return "아랍에미리트 UAE";
  if (timeZone === "Asia/Qatar") return "카타르 Qatar";
  if (timeZone === "Europe/London") return "영국 United Kingdom";
  if (timeZone === "Europe/Paris") return "프랑스 France";
  if (timeZone === "Europe/Berlin") return "독일 Germany";
  if (timeZone === "Europe/Amsterdam") return "네덜란드 Netherlands";
  if (timeZone === "Europe/Istanbul") return "튀르키예 Turkey";
  if (["America/Los_Angeles", "America/New_York"].includes(timeZone)) return "미국 USA";
  if (["America/Vancouver", "America/Toronto"].includes(timeZone)) return "캐나다 Canada";
  return "";
}

function customDestinationItem(destination: string, timeZone: string): DestinationItem {
  return {
    id: `custom:${destination}`,
    label: destination,
    destination,
    timeZone,
    description: timeZone,
    searchText: destination,
  };
}

function directDestinationItem(input: string): DestinationItem {
  const destination = input.trim();
  return {
    id: `direct:${normalize(destination)}`,
    label: `${destination} · 직접 입력`,
    destination,
    timeZone: "",
    description: "시간대를 직접 선택하세요",
    searchText: destination,
  };
}

function customTimeZoneItem(timeZone: string): TimeZoneItem {
  return {
    id: `custom:${timeZone}`,
    label: timeZone,
    timeZone,
    description: "",
    searchText: timeZone,
  };
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}
