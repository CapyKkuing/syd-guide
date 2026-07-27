const pages = {
  library: {
    eyebrow: "OUR JOURNEYS",
    title: "여행 서재",
    description: "둘이 함께 만든 여행을 한 권씩 모아보세요."
  },
  today: {
    eyebrow: "RIGHT NOW",
    title: "오늘",
    description: "지금 필요한 일정, 예약, 메모를 한눈에 확인해요."
  },
  schedule: {
    eyebrow: "PLAN TOGETHER",
    title: "일정",
    description: "가고 싶은 장소를 모아 둘만의 동선을 만들어요."
  },
  places: {
    eyebrow: "SAVED PLACES",
    title: "장소",
    description: "맛집, 카페, 액티비티와 추억을 함께 저장해요."
  },
  more: {
    eyebrow: "TRIP TOOLS",
    title: "더보기",
    description: "비용 정산과 여행 도구를 이곳에서 관리해요."
  }
} as const;

export function PreviewPage({ page }: { page: Page }) {
  const content = pages[page];

  return (
    <section className="page-preview" aria-labelledby={`${page}-title`}>
      <p className="eyebrow">{content.eyebrow}</p>
      <h1 id={`${page}-title`}>{content.title}</h1>
      <p className="page-description">{content.description}</p>
      <div className="preview-card">
        <span className="preview-card__mark" aria-hidden="true">✦</span>
        <div>
          <strong>시드니 여행을 새 가이드북으로 옮기는 중</strong>
          <p>다음 단계부터 실제 여행 생성과 초대 기능이 연결됩니다.</p>
        </div>
      </div>
    </section>
  );
}
import type { Page } from "./router";
