# AGENTS

Project-specific guidance for AI coding agents.

## 컨텍스트 압축 및 작업 재개 필수 규칙

이 프로젝트는 채팅 기록이 아니라 저장소 문서를 작업 기준으로 사용한다. 새 세션, 컨텍스트 압축, handoff(핸드오프: 작업 인계), 모델 변경 뒤에는 코드·계획·답변보다 먼저 아래 순서를 따른다.

### 기준 문서와 읽는 순서

1. 이 `AGENTS.md`를 처음부터 끝까지 읽는다.
2. `docs/superpowers/plans/2026-08-03-v1-completion-plan.md`를 처음부터 끝까지 읽는다.
3. 계획서의 `현재 작업 상태`, `요구사항 불일치·미구현 원장`, `다음 실행 단위`, `컨텍스트 압축 후 복구 체크리스트`를 확인한다.
4. `git branch --show-current`, `git status --short`, 현재 `HEAD`를 확인해 계획서 기준과 비교한다.
5. 현재 코드와 계획서가 다르면 구현하지 말고 차이를 먼저 사용자에게 보고한다.

구 핸드오프·구 계획·구 목업이 최신 V1 계획서 또는 사용자의 최신 직접 지시와 충돌하면 최신 직접 지시와 V1 계획서를 우선한다. 채팅 요약만으로 완료 상태나 승인 범위를 추정하지 않는다.

### 압축 직후 반드시 보고할 내용

- `caveman ultra` 보고 방식 적용 여부. 이는 말투 규칙이며 모델이나 추론 단계 변경을 뜻하지 않는다.
- 현재 Phase와 실행 단위, 완료·진행·미완료 상태.
- 최신 요구사항과 코드·계획을 비교해 발견한 불일치.
- 현재 승인된 로컬 수정 범위와 별도 승인이 필요한 commit, push, migration, Secret, 외부 API, 배포 범위.
- 사용자가 해야 할 일.
- 다음 작업의 간략한 내용, 권장 모델, reasoning(추론) 단계.
- 안전하게 나눌 수 있는 읽기 전용 조사·QA가 있을 때 서브에이전트 활용 여부와 회수한 결과.

### 계획서 우선 실행 규칙

- 실제 작업을 시작하기 전에 작업 목표·범위·완료 기준·검증 방법·승인 경계를 V1 계획서에 기록한다.
- 사용자 요구가 바뀌면 코드를 먼저 고치지 않는다. 계획서의 확정 요구, 폐기된 요구, 새 불일치와 다음 실행 단위를 먼저 갱신한다.
- 전수조사에서 나온 불일치와 미구현 항목은 계획서 원장에서 제거하지 않는다. 구현·자동 검증·실제 화면 QA·사용자 승인이 모두 끝난 뒤에만 `완료`로 바꾼다.
- 하위 화면이나 테스트 하나가 끝났다는 이유로 Phase 전체를 완료 처리하지 않는다.
- `구현됨`, `자동 검증됨`, `운영 검증됨`, `사용자 승인됨`을 서로 다른 상태로 기록한다.
- 현재 실행 단위의 완료 기준을 모두 충족하기 전에는 다음 실행 단위 코드를 수정하지 않는다.
- 작업 중 새 불일치를 발견하면 즉시 계획서 원장에 추가하고 사용자에게 보고한 뒤 범위 승인을 받는다.
- 대화 내용과 계획서가 다르면 계획서를 자동으로 덮어쓰지 않는다. 차이를 보고하고 사용자의 최신 결정을 기록한다.

### 상태 및 승인 규칙

- 각 작업 시작 전 사용자에게 작업 내용, 권장 모델, 추론 단계, 사용자가 확인할 항목을 짧게 알린다.
- commit, push, merge, 운영 D1 migration, Secret 설정, 외부 서비스 설정, 배포는 계획서의 승인 기록과 사용자의 명시적 승인이 모두 있을 때만 실행한다.
- Phase 단위 커밋 정책이 승인돼 있으면 해당 Phase의 모든 작업과 QA가 끝나기 전 중간 커밋을 만들지 않는다.
- `.codex-progress/index.html`은 진행 표시용이며 기준 문서가 아니다. 상태 충돌 시 V1 계획서를 먼저 바로잡는다.

<!-- ASTRYX:START -->
Astryx v0.1.9 · 153 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else style/className with tokens — var(--color-*|--spacing-*|--radius-*). No raw hex/px. (No StyleX/Tailwind compiler here — don't use xstyle/utility classes.)
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any raw <div>/<span> layout, imported .css/@apply, or hardcoded value (#hex, 16px) with the component or a token (var(--color-*|--spacing-*|…)). If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   153 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->
