# Couple Travel Guide V1 handoff

기준일: 2026-08-13 KST

## 출시 식별자

- 제품 코드 SHA: `65a1dd43bac7f5928dc100e1276982960629d5a7`
- 최종 게이트 문서 SHA: `96e1432a93b551309c7c45f8dadc99ed0af31b94`
- V1 release tag: `v1.0.0`
- tag 대상: 이 handoff 문서를 포함한 최종 `main` commit
- 운영 표면: 사용자 Worker와 관리자 Worker
- 두 Worker 상태: 제품 SHA `65a1dd43...`, 각각 100%

## 최종 판정

- 미해결 P0: 0
- 미해결 P1: 0
- 핵심 흐름 차단 실패: 0
- `TASKS.md` Task 20: 완료
- Pages `main` push 자동 배포: 없음
- 운영 방식: Workers 단일 운영

## 자동 검증

- typecheck: 통과
- lint: 통과
- frontend: 69파일 498건 통과
- Worker: 11파일 105건 통과
- production build: 통과
- Playwright: 5개 프로젝트 47/47 통과
- Playwright 최종 결과: `passed`, 실패 0
- `git diff --check`: 통과

## 운영·실기기 증거

- Android 사용자·관리자 설치 PWA, 온라인 저장·재조회·다른 기기 반영을 확인했다.
- Places 목록·상세·편집·지도 확대 유지와 월 800회 선차단 경계를 확인했다.
- Drive OAuth 재연결, PDF, 실제 JPEG EXIF, 원본·WebP 분리와 원본 보존을 확인했다.
- 대표자 변경·재실행 유지, 대표사진 이력 즉시 삭제와 현재 대표 보호를 확인했다.
- 다른 기기 빈 캐시의 대표사진·릴 미리보기, 릴 전체 재생과 빠른 점진 로딩을 확인했다.
- Open-Meteo live·cached·동시 cache miss와 월 10,000회 선차단 계약을 확인했다.
- 암호화 D1 export, 제한된 Drive 보관, 다운로드 SHA 일치, 별도 D1 복원, 사용자 테이블 27개와 비민감 구조 지표 대조, 평문 잔존 0을 확인했다.

## 승인된 V1 예외와 다음 단계

- iPhone 실기기 QA는 상용화 단계로 이관한다.
- Android 자동 재연결은 수동 `다시 불러오기` 예외를 허용한다.
- Places 운영 호출 800회 실제 소진은 결정적 자동 경계와 운영 QA로 대체했다.
- 실제 사진 40~60장 추가 업로드와 정확한 전송 바이트 측정은 자동 상한·운영 실사진·빈 캐시 증거로 대체했다.
- Open-Meteo Free는 비공개·비상업 V1에 사용하며 상업 공개 전 라이선스를 다시 검토한다.
- 복원 테스트 D1 삭제는 별도 파괴적 승인 없이는 실행하지 않는다.

## 운영 인계

- 사용자·관리자 Worker 배포는 같은 제품 SHA를 사용해야 한다.
- migration은 Worker보다 먼저 적용하고 pending migration이 예상과 다르면 중단한다.
- 비밀값·OAuth credential·개인키·평문 SQL은 Git·문서·로그·Drive에 기록하지 않는다.
- 장애 시 새 migration을 되돌리지 않고 이전 정상 Worker 제품 SHA로 롤백하며, additive 테이블은 비사용 상태로 둔다.
- 진행 기준 문서는 `docs/superpowers/plans/2026-08-03-v1-completion-plan.md`다.
- 최종 검증 절차는 `docs/qa/v1-final-release-checklist.md`다.
- D1 복구 절차는 `docs/operations/d1-backup-restore.md`다.
