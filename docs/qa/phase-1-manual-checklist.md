# Phase 1 수동 QA 체크리스트

검증일: 2026-07-30
검증 범위: 로컬 Worker + D1, production 배포 전
판정: Task 14~20 로컬 자동화·브라우저 검증 통과, 실기기·Cloudflare production 검증 대기

## 로컬 화면 검증

| 환경 | OS | 브라우저 | 화면 | 결과 | 스크린샷 |
| --- | --- | --- | --- | --- | --- |
| PC | Windows 10.0.26200.8875 | Chromium 151.0.7922.34 | 1440×900 | 통과 | `~/.codex/visualizations/2026/07/28/019fa84d-9b12-7ed2-a994-ceb0b4ea7a02/task13-desktop.png` |
| Android-like touch | Windows host | Chromium 151.0.7922.34 | 390×844 | 통과 | `~/.codex/visualizations/2026/07/28/019fa84d-9b12-7ed2-a994-ceb0b4ea7a02/task13-android.png` |
| iPhone-like touch | Windows host | WebKit 26.5 | 393×852 | 통과 | `~/.codex/visualizations/2026/07/28/019fa84d-9b12-7ed2-a994-ceb0b4ea7a02/task13-iphone.png` |

기존 세 화면 모두 올바른 제목·경로·주요 제목을 표시했고, 콘솔 오류와 가로 넘침이 없었다.
PC 오늘 화면, Android-like 일정 화면, iPhone-like 도구 화면의 카드·내비게이션·고정
하단 메뉴가 잘리거나 겹치지 않는지 스크린샷으로 확인했다.

Task 20에서는 로컬 Worker와 D1을 사용한 Chromium 실제 화면에서 여행 단계별 Today 홈과
사진 릴을 다시 확인했다. 릴 화면은 가로 사진의 `contain` 전경과 `cover` 배경, 무음 안내,
3분 표시를 직접 확인했다. 별도 보관용 스크린샷 실행은 Vite 단독 실행에서 화면이 열리지
않아 중단했으며, 제품 검증은 아래 Playwright 로컬 Worker 실행 결과를 근거로 삼는다.

## 자동화 시나리오

Playwright 1.62.0 전체 실행 결과: 24개 통과.

- 초대 링크·QR 표시, 10분 만료, 재사용 거부
- 연결 기기 해제 직후 partner API 401
- owner·partner 여행 생성·수정·휴지통·복구
- 일정·장소·예약·준비물·메모·투표 공동 편집
- 개인 준비물·메모 상호 비공개
- 예약번호 기본 마스킹
- 15초 동기화
- 오프라인 캐시 읽기·대기열 저장·재연결 전송
- 충돌 시 최신 내용 사용·내 수정 유지
- 세 화면 크기의 가로 넘침 없음
- 내비게이션·대화상자 키보드 조작, Escape 닫기, 포커스 복귀
- 모션 줄이기, 라이트·다크·시스템 테마
- PWA manifest와 service worker 등록
- 수동 입력 항공편의 여정 경계 우선 적용
- 여행 전 긴급 준비 최대 3개, 여행 중 섹션 순서, 여행 후 두 진입점
- 여행 후 완료된 정산 카드 숨김
- 사진 릴 자동 최대 2분·편집 최대 3분
- 릴 재생·일시정지·이전/다음·이어보기·백그라운드 복귀 초기화
- 가로 사진 전경 `contain`·배경 `cover`
- 다른 여행의 릴 데이터 비공개
- 서비스 워커 캐시를 통한 완전 오프라인 새 탭 재진입

추가 자동 검사:

- 앱 단위·컴포넌트 테스트 385개 통과
- Worker 테스트 59개 통과
- TypeScript typecheck, ESLint, production build, `git diff --check` 통과

Browser Plugin은 현재 설치되어 있지 않아 Playwright로 같은 브라우저 검증을 수행했다.
iPhone-like 기본 터치 프로필은 `Tab` 이동을 제공하지 않으므로 skip link(본문 바로가기
링크)의 직접 포커스 가능성을 확인했고, 대화상자 키보드·Escape·포커스 복귀 검사는
동일하게 수행했다.

## 실기기·production 대기 항목

아래 항목은 실제 기기 또는 Cloudflare 값과 사용자 승인이 필요하다. 실행 전 상태는
`대기`이며, 확인하지 않은 항목을 통과로 표시하지 않는다.

| 날짜 | 기기 | OS | 브라우저 | 확인 항목 | 결과 | 스크린샷 |
| --- | --- | --- | --- | --- | --- | --- |
| 미정 | 실제 Android | 미정 | Chrome | 설치·standalone 실행 | 대기 | 미정 |
| 미정 | 실제 iPhone | 미정 | Safari | 홈 화면 추가·standalone 실행 | 대기 | 미정 |
| 미정 | 실제 PC | 미정 | Chrome | owner Cloudflare Access 허용·차단 | 대기 | 미정 |
| 미정 | 실제 휴대폰 | 미정 | 카메라·브라우저 | 실제 QR 스캔·연결 | 대기 | 미정 |
| 미정 | 실제 휴대폰 | 미정 | 설치 앱 | 비행기 모드 읽기·수정·재연결 | 대기 | 미정 |
| 미정 | 실제 휴대폰 | 미정 | 설치 앱 | 연결 해제 후 401·로컬 캐시 삭제 | 대기 | 미정 |

## Cloudflare 승인 전 중단점

다음 값을 확인받기 전에는 production 설정·원격 D1·배포를 실행하지 않는다.

- 관리자 host
- 공유 앱 host
- 관리자 이메일
- Cloudflare account와 zone
- D1 name `couple-travel-guide`
- Worker names `couple-travel-guide`, `couple-travel-guide-admin`
