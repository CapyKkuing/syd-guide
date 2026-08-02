export const transportReferences = [
  {
    title: "Transport NSW 여행 계획",
    description: "실시간 출발, 경로, 운임, 운행 변경을 공식 화면에서 확인합니다.",
    href: "https://transportnsw.info/plan",
  },
  {
    title: "Opal·비접촉 결제",
    description: "Opal 카드 또는 해외 결제 가능한 카드·모바일 기기로 탭 온·탭 오프합니다.",
    href: "https://transportnsw.info/tickets-fares/opal",
  },
  {
    title: "대중교통 기본 안내",
    description: "기차, 메트로, 버스, 페리, 라이트레일 이용법을 확인합니다.",
    href: "https://transportnsw.info/public-transport-essentials",
  },
] as const;

export const emergencyContacts = [
  {
    title: "경찰·소방·구급 긴급",
    phone: "000",
    phoneHref: "tel:000",
    description: "생명·신체·재산에 즉각적인 위험이 있을 때 사용합니다.",
    sourceUrl: "https://www.nsw.gov.au/emergency/emergency-services",
  },
  {
    title: "NSW 경찰 비긴급",
    phone: "131 444",
    phoneHref: "tel:131444",
    description: "진행 중인 위험이 아닌 범죄 신고와 일반 경찰 문의입니다.",
    sourceUrl: "https://www.police.nsw.gov.au/safety_and_prevention/emergency_management/emergency_management_information/emergency_management_information",
  },
  {
    title: "Healthdirect 간호 상담",
    phone: "1800 022 222",
    phoneHref: "tel:180002222",
    description: "긴급하지 않은 건강 증상을 24시간 상담합니다. 응급 상황은 000으로 전화합니다.",
    sourceUrl: "https://www.healthdirect.gov.au/contact-us",
  },
  {
    title: "주시드니 대한민국 총영사관",
    phone: "+61 403 546 058",
    phoneHref: "tel:+61403546058",
    description: "근무시간 외 사건·사고 긴급 연락처입니다. 여권·비자 일반 민원용이 아닙니다.",
    sourceUrl: "https://overseas.mofa.go.kr/au-sydney-ko/index.do",
  },
] as const;

export const fallbackTravelTips = [
  {
    id: "fallback-tip-transport",
    title: "교통카드",
    body: "대중교통은 Opal 카드 또는 비접촉 결제를 사용합니다. 탑승과 하차 때 같은 카드나 기기로 탭하세요.",
  },
  {
    id: "fallback-tip-card",
    title: "카드 결제",
    body: "해외 결제 알림을 켜고, 결제 단말기에서는 원화보다 현지 통화 AUD를 선택하세요.",
  },
  {
    id: "fallback-tip-sun",
    title: "자외선",
    body: "해변 일정에는 SPF50+ 선크림, 모자, 물을 준비하고 중간에 다시 바르세요.",
  },
  {
    id: "fallback-tip-emergency",
    title: "비상 연락",
    body: "000, 숙소 주소, 보험사 긴급번호를 잠금화면에서도 확인할 수 있게 저장하세요.",
  },
] as const;
