export interface AirlineOption {
  code: string;
  name: string;
  aliases: string[];
}

export interface AirportOption {
  iata: string;
  name: string;
  city: string;
  timeZone: string;
  aliases: string[];
}

export const airlineOptions: AirlineOption[] = [
  { code: "KE", name: "대한항공", aliases: ["Korean Air", "코리안에어"] },
  { code: "OZ", name: "아시아나항공", aliases: ["Asiana Airlines", "아시아나"] },
  { code: "TW", name: "티웨이항공", aliases: ["T'way Air", "Tway"] },
  { code: "YP", name: "에어프레미아", aliases: ["Air Premia"] },
  { code: "LJ", name: "진에어", aliases: ["Jin Air"] },
  { code: "7C", name: "제주항공", aliases: ["Jeju Air"] },
  { code: "BX", name: "에어부산", aliases: ["Air Busan"] },
  { code: "RS", name: "에어서울", aliases: ["Air Seoul"] },
  { code: "ZE", name: "이스타항공", aliases: ["Eastar Jet"] },
  { code: "RF", name: "에어로케이", aliases: ["Aero K"] },
  { code: "QF", name: "콴타스항공", aliases: ["Qantas"] },
  { code: "JQ", name: "젯스타", aliases: ["Jetstar"] },
  { code: "VA", name: "버진 오스트레일리아", aliases: ["Virgin Australia"] },
  { code: "ZL", name: "렉스항공", aliases: ["Rex Airlines"] },
  { code: "SQ", name: "싱가포르항공", aliases: ["Singapore Airlines"] },
  { code: "TR", name: "스쿠트항공", aliases: ["Scoot"] },
  { code: "CX", name: "캐세이퍼시픽", aliases: ["Cathay Pacific"] },
  { code: "HX", name: "홍콩항공", aliases: ["Hong Kong Airlines"] },
  { code: "MH", name: "말레이시아항공", aliases: ["Malaysia Airlines"] },
  { code: "D7", name: "에어아시아 X", aliases: ["AirAsia X"] },
  { code: "AK", name: "에어아시아", aliases: ["AirAsia"] },
  { code: "CI", name: "중화항공", aliases: ["China Airlines"] },
  { code: "BR", name: "에바항공", aliases: ["EVA Air"] },
  { code: "JL", name: "일본항공", aliases: ["Japan Airlines", "JAL"] },
  { code: "NH", name: "전일본공수", aliases: ["All Nippon Airways", "ANA"] },
  { code: "GK", name: "젯스타 재팬", aliases: ["Jetstar Japan"] },
  { code: "MM", name: "피치항공", aliases: ["Peach Aviation"] },
  { code: "VN", name: "베트남항공", aliases: ["Vietnam Airlines"] },
  { code: "VJ", name: "비엣젯항공", aliases: ["VietJet Air"] },
  { code: "PR", name: "필리핀항공", aliases: ["Philippine Airlines"] },
  { code: "5J", name: "세부퍼시픽", aliases: ["Cebu Pacific"] },
  { code: "TG", name: "타이항공", aliases: ["Thai Airways"] },
  { code: "XJ", name: "타이 에어아시아 X", aliases: ["Thai AirAsia X"] },
  { code: "GA", name: "가루다 인도네시아", aliases: ["Garuda Indonesia"] },
  { code: "NZ", name: "에어뉴질랜드", aliases: ["Air New Zealand"] },
  { code: "EK", name: "에미레이트항공", aliases: ["Emirates"] },
  { code: "QR", name: "카타르항공", aliases: ["Qatar Airways"] },
  { code: "EY", name: "에티하드항공", aliases: ["Etihad Airways"] },
  { code: "UA", name: "유나이티드항공", aliases: ["United Airlines"] },
  { code: "DL", name: "델타항공", aliases: ["Delta Air Lines"] },
  { code: "AC", name: "에어캐나다", aliases: ["Air Canada"] },
  { code: "TK", name: "터키항공", aliases: ["Turkish Airlines"] },
  { code: "BA", name: "영국항공", aliases: ["British Airways"] },
  { code: "AF", name: "에어프랑스", aliases: ["Air France"] },
  { code: "LH", name: "루프트한자", aliases: ["Lufthansa"] },
  { code: "KL", name: "KLM 네덜란드항공", aliases: ["KLM"] },
];

export const airportOptions: AirportOption[] = [
  {
    iata: "ICN",
    name: "인천국제공항",
    city: "서울·인천",
    timeZone: "Asia/Seoul",
    aliases: ["인천", "서울", "Incheon International Airport", "Incheon", "Seoul"],
  },
  {
    iata: "GMP",
    name: "김포국제공항",
    city: "서울",
    timeZone: "Asia/Seoul",
    aliases: ["김포", "Gimpo International Airport", "Gimpo", "Seoul"],
  },
  {
    iata: "PUS",
    name: "김해국제공항",
    city: "부산",
    timeZone: "Asia/Seoul",
    aliases: ["김해", "부산", "Gimhae International Airport", "Busan"],
  },
  {
    iata: "CJU",
    name: "제주국제공항",
    city: "제주",
    timeZone: "Asia/Seoul",
    aliases: ["제주", "Jeju International Airport", "Jeju"],
  },
  { iata: "TAE", name: "대구국제공항", city: "대구", timeZone: "Asia/Seoul", aliases: ["대구", "Daegu International Airport", "Daegu"] },
  { iata: "CJJ", name: "청주국제공항", city: "청주", timeZone: "Asia/Seoul", aliases: ["청주", "Cheongju International Airport", "Cheongju"] },
  { iata: "MWX", name: "무안국제공항", city: "무안·광주", timeZone: "Asia/Seoul", aliases: ["무안", "Muan International Airport", "Muan"] },
  { iata: "YNY", name: "양양국제공항", city: "양양", timeZone: "Asia/Seoul", aliases: ["양양", "Yangyang International Airport", "Yangyang"] },
  { iata: "RSU", name: "여수공항", city: "여수", timeZone: "Asia/Seoul", aliases: ["여수", "Yeosu Airport", "Yeosu"] },
  { iata: "USN", name: "울산공항", city: "울산", timeZone: "Asia/Seoul", aliases: ["울산", "Ulsan Airport", "Ulsan"] },
  { iata: "HIN", name: "사천공항", city: "사천·진주", timeZone: "Asia/Seoul", aliases: ["사천", "진주", "Sacheon Airport", "Jinju"] },
  { iata: "KWJ", name: "광주공항", city: "광주", timeZone: "Asia/Seoul", aliases: ["광주", "Gwangju Airport", "Gwangju"] },
  { iata: "KUV", name: "군산공항", city: "군산", timeZone: "Asia/Seoul", aliases: ["군산", "Gunsan Airport", "Gunsan"] },
  { iata: "WJU", name: "원주공항", city: "원주", timeZone: "Asia/Seoul", aliases: ["원주", "Wonju Airport", "Wonju"] },
  {
    iata: "SYD",
    name: "시드니 킹스포드 스미스 국제공항",
    city: "시드니",
    timeZone: "Australia/Sydney",
    aliases: ["시드니", "Sydney Airport", "Kingsford Smith", "Sydney"],
  },
  {
    iata: "MEL",
    name: "멜버른 공항",
    city: "멜버른",
    timeZone: "Australia/Melbourne",
    aliases: ["멜버른", "Melbourne Airport", "Tullamarine", "Melbourne"],
  },
  {
    iata: "BNE",
    name: "브리즈번 공항",
    city: "브리즈번",
    timeZone: "Australia/Brisbane",
    aliases: ["브리즈번", "Brisbane Airport", "Brisbane"],
  },
  {
    iata: "OOL",
    name: "골드코스트 공항",
    city: "골드코스트",
    timeZone: "Australia/Brisbane",
    aliases: ["골드코스트", "Gold Coast Airport", "Coolangatta", "Gold Coast"],
  },
  {
    iata: "PER",
    name: "퍼스 공항",
    city: "퍼스",
    timeZone: "Australia/Perth",
    aliases: ["퍼스", "Perth Airport", "Perth"],
  },
  {
    iata: "ADL",
    name: "애들레이드 공항",
    city: "애들레이드",
    timeZone: "Australia/Adelaide",
    aliases: ["애들레이드", "Adelaide Airport", "Adelaide"],
  },
  {
    iata: "CNS",
    name: "케언스 공항",
    city: "케언스",
    timeZone: "Australia/Brisbane",
    aliases: ["케언스", "Cairns Airport", "Cairns"],
  },
  {
    iata: "CBR",
    name: "캔버라 공항",
    city: "캔버라",
    timeZone: "Australia/Sydney",
    aliases: ["캔버라", "Canberra Airport", "Canberra"],
  },
  { iata: "DRW", name: "다윈 국제공항", city: "다윈", timeZone: "Australia/Darwin", aliases: ["다윈", "Darwin International Airport", "Darwin"] },
  { iata: "HBA", name: "호바트 공항", city: "호바트", timeZone: "Australia/Hobart", aliases: ["호바트", "Hobart Airport", "Hobart"] },
  { iata: "LST", name: "론서스턴 공항", city: "론서스턴", timeZone: "Australia/Hobart", aliases: ["론서스턴", "Launceston Airport", "Launceston"] },
  { iata: "NTL", name: "뉴캐슬 공항", city: "뉴캐슬", timeZone: "Australia/Sydney", aliases: ["뉴캐슬", "Newcastle Airport", "Newcastle"] },
  { iata: "AVV", name: "아발론 공항", city: "멜버른", timeZone: "Australia/Melbourne", aliases: ["아발론", "Avalon Airport", "Melbourne Avalon"] },
  { iata: "MCY", name: "선샤인코스트 공항", city: "선샤인코스트", timeZone: "Australia/Brisbane", aliases: ["선샤인코스트", "Sunshine Coast Airport"] },
  { iata: "TSV", name: "타운즈빌 공항", city: "타운즈빌", timeZone: "Australia/Brisbane", aliases: ["타운즈빌", "Townsville Airport", "Townsville"] },
  { iata: "BME", name: "브룸 국제공항", city: "브룸", timeZone: "Australia/Perth", aliases: ["브룸", "Broome International Airport", "Broome"] },
  { iata: "ASP", name: "앨리스스프링스 공항", city: "앨리스스프링스", timeZone: "Australia/Darwin", aliases: ["앨리스스프링스", "Alice Springs Airport", "Alice Springs"] },
  { iata: "SIN", name: "싱가포르 창이 국제공항", city: "싱가포르", timeZone: "Asia/Singapore", aliases: ["창이", "싱가포르", "Singapore Changi Airport", "Singapore"] },
  { iata: "HKG", name: "홍콩 국제공항", city: "홍콩", timeZone: "Asia/Hong_Kong", aliases: ["홍콩", "Hong Kong International Airport", "Hong Kong"] },
  { iata: "TPE", name: "타이완 타오위안 국제공항", city: "타이베이", timeZone: "Asia/Taipei", aliases: ["타오위안", "타이베이", "Taiwan Taoyuan International Airport", "Taipei"] },
  { iata: "NRT", name: "나리타 국제공항", city: "도쿄", timeZone: "Asia/Tokyo", aliases: ["나리타", "도쿄", "Narita International Airport", "Tokyo"] },
  { iata: "HND", name: "도쿄 하네다 공항", city: "도쿄", timeZone: "Asia/Tokyo", aliases: ["하네다", "도쿄", "Haneda Airport", "Tokyo"] },
  { iata: "KIX", name: "간사이 국제공항", city: "오사카", timeZone: "Asia/Tokyo", aliases: ["간사이", "오사카", "Kansai International Airport", "Osaka"] },
  { iata: "FUK", name: "후쿠오카 공항", city: "후쿠오카", timeZone: "Asia/Tokyo", aliases: ["후쿠오카", "Fukuoka Airport", "Fukuoka"] },
  { iata: "BKK", name: "수완나품 공항", city: "방콕", timeZone: "Asia/Bangkok", aliases: ["수완나품", "방콕", "Suvarnabhumi Airport", "Bangkok"] },
  { iata: "DMK", name: "돈므앙 국제공항", city: "방콕", timeZone: "Asia/Bangkok", aliases: ["돈므앙", "방콕", "Don Mueang International Airport", "Bangkok"] },
  { iata: "KUL", name: "쿠알라룸푸르 국제공항", city: "쿠알라룸푸르", timeZone: "Asia/Kuala_Lumpur", aliases: ["쿠알라룸푸르", "Kuala Lumpur International Airport"] },
  { iata: "SGN", name: "떤선녓 국제공항", city: "호찌민", timeZone: "Asia/Ho_Chi_Minh", aliases: ["호찌민", "호치민", "Tan Son Nhat International Airport", "Ho Chi Minh City"] },
  { iata: "HAN", name: "노이바이 국제공항", city: "하노이", timeZone: "Asia/Ho_Chi_Minh", aliases: ["하노이", "Noi Bai International Airport", "Hanoi"] },
  { iata: "MNL", name: "니노이 아키노 국제공항", city: "마닐라", timeZone: "Asia/Manila", aliases: ["마닐라", "Ninoy Aquino International Airport", "Manila"] },
  { iata: "CEB", name: "막탄 세부 국제공항", city: "세부", timeZone: "Asia/Manila", aliases: ["세부", "Mactan Cebu International Airport", "Cebu"] },
  { iata: "CGK", name: "수카르노 하타 국제공항", city: "자카르타", timeZone: "Asia/Jakarta", aliases: ["자카르타", "Soekarno Hatta International Airport", "Jakarta"] },
  { iata: "DPS", name: "응우라라이 국제공항", city: "발리", timeZone: "Asia/Makassar", aliases: ["발리", "덴파사르", "Ngurah Rai International Airport", "Bali", "Denpasar"] },
  { iata: "AKL", name: "오클랜드 공항", city: "오클랜드", timeZone: "Pacific/Auckland", aliases: ["오클랜드", "Auckland Airport", "Auckland"] },
  { iata: "CHC", name: "크라이스트처치 공항", city: "크라이스트처치", timeZone: "Pacific/Auckland", aliases: ["크라이스트처치", "Christchurch Airport", "Christchurch"] },
  { iata: "DXB", name: "두바이 국제공항", city: "두바이", timeZone: "Asia/Dubai", aliases: ["두바이", "Dubai International Airport", "Dubai"] },
  { iata: "DOH", name: "하마드 국제공항", city: "도하", timeZone: "Asia/Qatar", aliases: ["도하", "Hamad International Airport", "Doha"] },
  { iata: "AUH", name: "자이드 국제공항", city: "아부다비", timeZone: "Asia/Dubai", aliases: ["아부다비", "Zayed International Airport", "Abu Dhabi"] },
  { iata: "LHR", name: "런던 히스로 공항", city: "런던", timeZone: "Europe/London", aliases: ["히스로", "런던", "Heathrow Airport", "London"] },
  { iata: "CDG", name: "파리 샤를 드골 공항", city: "파리", timeZone: "Europe/Paris", aliases: ["샤를드골", "파리", "Charles de Gaulle Airport", "Paris"] },
  { iata: "FRA", name: "프랑크푸르트 공항", city: "프랑크푸르트", timeZone: "Europe/Berlin", aliases: ["프랑크푸르트", "Frankfurt Airport", "Frankfurt"] },
  { iata: "AMS", name: "암스테르담 스키폴 공항", city: "암스테르담", timeZone: "Europe/Amsterdam", aliases: ["스키폴", "암스테르담", "Amsterdam Airport Schiphol"] },
  { iata: "IST", name: "이스탄불 공항", city: "이스탄불", timeZone: "Europe/Istanbul", aliases: ["이스탄불", "Istanbul Airport", "Istanbul"] },
  { iata: "LAX", name: "로스앤젤레스 국제공항", city: "로스앤젤레스", timeZone: "America/Los_Angeles", aliases: ["로스앤젤레스", "Los Angeles International Airport", "Los Angeles"] },
  { iata: "SFO", name: "샌프란시스코 국제공항", city: "샌프란시스코", timeZone: "America/Los_Angeles", aliases: ["샌프란시스코", "San Francisco International Airport", "San Francisco"] },
  { iata: "JFK", name: "존 F. 케네디 국제공항", city: "뉴욕", timeZone: "America/New_York", aliases: ["뉴욕", "John F Kennedy International Airport", "New York"] },
  { iata: "YVR", name: "밴쿠버 국제공항", city: "밴쿠버", timeZone: "America/Vancouver", aliases: ["밴쿠버", "Vancouver International Airport", "Vancouver"] },
  { iata: "YYZ", name: "토론토 피어슨 국제공항", city: "토론토", timeZone: "America/Toronto", aliases: ["토론토", "Toronto Pearson International Airport", "Toronto"] },
];

type SupportedValuesOf = typeof Intl.supportedValuesOf;
const supportedValuesOf = (Intl as typeof Intl & {
  supportedValuesOf?: SupportedValuesOf;
}).supportedValuesOf;

export const flightTimeZones = supportedValuesOf
  ? supportedValuesOf("timeZone")
  : Array.from(new Set(airportOptions.map((airport) => airport.timeZone)));

export function findAirlineByCode(code: string): AirlineOption | undefined {
  return airlineOptions.find((airline) => airline.code === code);
}

export function findAirportByIata(iata: string): AirportOption | undefined {
  return airportOptions.find((airport) => airport.iata === iata);
}

export function findAirlineOption(input: string): AirlineOption | undefined {
  const query = normalized(input);
  return airlineOptions.find((airline) =>
    [airline.code, airline.name, ...airline.aliases].some((value) => normalized(value) === query),
  );
}

export function findAirportOption(input: string): AirportOption | undefined {
  const query = normalized(input);
  const matches = airportOptions.filter((airport) =>
    [airport.iata, airport.name, airport.city, ...airport.aliases]
      .some((value) => normalized(value) === query),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}
