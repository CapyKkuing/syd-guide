(function () {
  const h = React.createElement;
  const F = React.Fragment;

  const navItems = [
    { href: "index.html", label: "홈" },
    { href: "schedule.html", label: "일정" },
    { href: "food.html", label: "맛집" },
    { href: "cafe.html", label: "카페" },
    { href: "tips.html", label: "주의사항" },
    { href: "currency.html", label: "환율계산기" }
  ];

  const routeCards = [
    {
      title: "일정",
      href: "schedule.html",
      eyebrow: "Day by day",
      text: "일자별 코스를 타임라인으로 정리. 이동, 식사, 사진 포인트를 한 흐름으로 본다.",
      image: "images/sydney_harbour_bridge.jpg",
      featured: true
    },
    {
      title: "맛집",
      href: "food.html",
      eyebrow: "Dining notes",
      text: "한식, 중식, 아시아, 스테이크, 해산물 순으로 빠르게 훑는 음식 지도.",
      image: "images/fish_market.jpg"
    },
    {
      title: "카페",
      href: "cafe.html",
      eyebrow: "Coffee stops",
      text: "브런치, 디저트, 해변 카페를 동선별로 묶어 둔 휴식용 리스트.",
      image: "images/single_o.jpg"
    },
    {
      title: "주의사항",
      href: "tips.html",
      eyebrow: "Before you go",
      text: "교통, 결제, 안전, 날씨를 먼저 확인하고 여행 중 삽질을 줄인다.",
      image: "images/sydney_airport.jpg"
    },
    {
      title: "환율계산기",
      href: "currency.html",
      eyebrow: "Quick math",
      text: "AUD 금액을 바로 KRW로 계산. 카드 결제 전 확인용으로 둔다.",
      image: "images/sydney_tower.jpg"
    }
  ];

  const timeline = [
    {
      day: "Day 1",
      title: "도착과 첫 정리",
      detail: "공항 이동, 숙소 체크인, 주변 동선 파악. 저녁은 가볍게 정리형 식사로 둔다."
    },
    {
      day: "Day 2",
      title: "도심과 오페라하우스",
      detail: "CBD를 먼저 훑고, Circular Quay와 오페라하우스 주변으로 저녁까지 이어간다."
    },
    {
      day: "Day 3",
      title: "본다이와 해변 산책",
      detail: "해변, 브런치, 카페를 묶어서 느리게 쓰는 날로 배치한다."
    },
    {
      day: "Day 4",
      title: "맨리와 항구 풍경",
      detail: "페리 이동을 포함한 바닷길 코스. 사진 포인트를 중심으로 짠다."
    }
  ];

  function currentPageName() {
    const path = window.location.pathname.split(/[\\/]/).pop() || "index.html";
    if (!path || path === "/") return "index.html";
    if (path.toLowerCase() === "sydney_route.html") return "index.html";
    return path.toLowerCase();
  }

  function navLink(item) {
    const active = currentPageName() === item.href;
    return h(
      "a",
      {
        href: item.href,
        "data-page": item.href,
        className: active ? "active" : undefined,
        "aria-current": active ? "page" : undefined
      },
      item.label
    );
  }

  function Header() {
    return h(
      "header",
      { className: "site-header" },
      h(
        "div",
        { className: "nav-wrap" },
        h("a", { className: "brand", href: "index.html" }, "시드니 여행 가이드"),
        h(
          "nav",
          { className: "nav-links", "aria-label": "상단 메뉴" },
          navItems.map(function (item) {
            return h(F, { key: item.href }, navLink(item));
          })
        )
      )
    );
  }

  function Hero() {
    return h(
      "section",
      { className: "hero home-hero" },
      h(
        "div",
        { className: "hero-copy" },
        h(
          "div",
          { className: "hero-meta" },
          h("span", null, "8일 일정"),
          h("span", null, "편집형 구성"),
          h("span", null, "빠른 메뉴 유지")
        ),
        h("h1", null, "시드니 8일 여행 가이드"),
        h(
          "div",
          { className: "hero-actions" },
          h("a", { className: "button primary", href: "schedule.html" }, "일정 보기"),
          h("a", { className: "button", href: "food.html" }, "맛집 보기"),
          h("a", { className: "button", href: "currency.html" }, "환율 계산")
        )
      ),
      h(
        "aside",
        { className: "hero-panel", "aria-label": "여행 요약" },
        h(
          "article",
          { className: "card home-launch-card featured" },
          h("img", {
            className: "media",
            src: "images/sydney_opera_house.jpg",
            alt: "시드니 오페라하우스와 항구 전경"
          }),
          h(
            "div",
            { className: "card-body" },
            h("span", { className: "badge gold" }, "trip dossier"),
            h("h3", null, "여행의 중심축"),
            h(
              "p",
              { className: "muted" },
              "도심, 해변, 식사, 환율을 하나의 흐름으로 묶어 매일 다시 찾기 쉽게 정리했다."
            )
          ),
          h("a", { className: "home-launch-link", href: "schedule.html", "aria-label": "일정 페이지로 이동" })
        ),
        h(
          "div",
          { className: "home-rail" },
          h(
            "div",
            { className: "rail-item" },
            h("strong", null, "첫날"),
            h("span", null, "도착, 체크인, 도심 적응")
          ),
          h(
            "div",
            { className: "rail-item" },
            h("strong", null, "중간"),
            h("span", null, "본다이, 맨리, 브런치, 카페")
          ),
          h(
            "div",
            { className: "rail-item" },
            h("strong", null, "마무리"),
            h("span", null, "맛집 재확인, 환율 정리, 출국 준비")
          )
        )
      )
    );
  }

  function QuickLaunch() {
    return h(
      "section",
      { className: "section home-section" },
      h("h2", null, "빠른 메뉴"),
      h(
        "div",
        { className: "home-launch-grid" },
        routeCards.map(function (item) {
          return h(
            "article",
            {
              className: "card home-launch-card" + (item.featured ? " featured" : ""),
              key: item.title
            },
            h("a", { className: "home-launch-link", href: item.href, "aria-label": item.title + " 페이지로 이동" }),
            h("img", { className: "media", src: item.image, alt: item.title }),
            h(
              "div",
              { className: "card-body" },
              h("span", { className: "badge" }, item.eyebrow),
              h("h3", null, item.title),
              h("p", { className: "muted" }, item.text)
            )
          );
        })
      )
    );
  }

  function TimelinePreview() {
    return h(
      "section",
      { className: "section home-section" },
      h("h2", null, "당일 코스 안내"),
      h(
        "div",
        { className: "timeline-preview" },
        h(
          "div",
          { className: "timeline-card" },
          h(
            "div",
            { className: "timeline-card-head" },
            h("span", { className: "badge gold" }, "오늘 일정"),
            h("strong", null, "해당 날짜에 맞춰 코스를 확인")
          ),
          h(
            "div",
            { className: "timeline-list" },
            timeline.map(function (item) {
              return h(
                "article",
                { className: "timeline-item", key: item.day },
                h("div", { className: "timeline-mark" }, h("span", null, item.day)),
                h(
                  "div",
                  { className: "timeline-copy" },
                  h("h3", null, item.title),
                  h("p", { className: "muted" }, item.detail)
                )
              );
            })
          )
        )
      )
    );
  }

  function Footer() {
    return h(
      "footer",
      { className: "footer" },
      "시드니 여행 가이드. 편집형 레이아웃과 빠른 메뉴를 유지한 상태로 정리했다."
    );
  }

  function App() {
    return h(
      F,
      null,
      h(Header),
      h(
        "main",
        { className: "container home-page" },
        h(Hero),
        h(QuickLaunch),
        h(TimelinePreview)
      ),
      h(Footer)
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(h(App));
})();
