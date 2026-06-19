# OpenAI API 연동 — 임직원 "AI 비서" 기획안

| 항목 | 내용 |
|---|---|
| 문서 성격 | 기능 기획안 (구현 전 설계 문서) |
| 작성일 | 2026-06-16 |
| 대상 페이지 | `hanaro/staff/staff.html` (임직원 전용) |
| 상태 | 초안 — 의사결정 대기 (§11) |
| 한 줄 요약 | 임직원 네비게이션 `회원관리` 옆에 **🤖 AI 비서**를 추가하고, OpenAI API로 채팅 + 업무 연동(특히 자재관리 엑셀, 게시판 작성)을 제공한다. |

---

## 1. 개요

### 1.1 배경
- 현재 staff 페이지는 게시판(공지/직원게시판/제안활동/A·S), 자재관리(엑셀), 활동사진첩, 회원관리로 구성된 임직원 업무 허브이다.
- 반복 업무(자재 데이터 정리·분석, 게시글 작성·요약)를 AI로 보조해 업무 효율을 높이고자 한다.

### 1.2 목표
1. 임직원이 사이트 안에서 바로 쓰는 **AI 채팅** 제공
2. **게시판 글 작성**을 AI가 초안 작성·요약·교정으로 보조
3. **자재관리 엑셀** 업무(분석, 신규 입력, 업로드 정리, 리포트)를 AI로 보조

### 1.3 비목표 (이번 범위 아님)
- 외부 고객/일반 사용자용 AI (임직원 전용으로 한정)
- AI의 완전 자동 실행(무검토 게시·무검토 데이터 변경) — 본 기획은 **항상 사람 검토 단계**를 둔다.

---

## 2. 핵심 전제 — 백엔드 프록시는 필수

> **⚠️ OpenAI API 키를 브라우저(클라이언트 코드)에 절대 넣지 않는다.**
> 현재 사이트는 정적 HTML + Firebase 클라이언트 SDK만 사용하고 서버가 없다. 정적 사이트에서 OpenAI를 직접 호출하면 키가 노출되어 과금 도용·악용된다.

따라서 **키를 서버에 숨기고 OpenAI를 대신 호출하는 프록시**가 반드시 필요하다.

- 1순위: **Firebase Cloud Functions** (기존 Firebase 사용과 자연스럽게 연결, **Blaze 종량제 요금제 필요**)
- 대안: Vercel / Cloudflare Workers 등 서버리스 (별도 인프라 추가)

이 전제(백엔드 도입 가능 여부)가 **본 기획 전체의 최우선 의사결정 사항**이다(§11).

---

## 3. 전체 아키텍처

```
┌─────────────────────────────────────────────┐
│  staff 페이지 — 🤖 AI 비서 패널 (프런트엔드)      │
│  - 채팅 UI / 현재 화면 컨텍스트 인식              │
└───────────────┬─────────────────────────────┘
                │ HTTPS + Firebase ID 토큰
                ▼
┌─────────────────────────────────────────────┐
│  Cloud Function: aiProxy (백엔드)               │
│  - Firebase 토큰 검증 → 임직원 여부 확인          │
│  - 사용량/요청 한도 체크 (비용 통제)               │
│  - OpenAI API 키 보관 (Secret Manager)          │
└───────────────┬─────────────────────────────┘
                │ OpenAI Chat Completions / Responses API
                ▼
┌─────────────────────────────────────────────┐
│  OpenAI API                                   │
│  - 답변 + function calling(도구 호출) 반환        │
└───────────────┬─────────────────────────────┘
                │ 도구 호출(JSON)을 프런트로 전달
                ▼
┌─────────────────────────────────────────────┐
│  프런트가 도구 실행 (로그인 직원 본인 권한)         │
│  - 게시글 초안 채우기 / 자재 행 추가 / 분석 등      │
│  - 기존 Firestore 보안규칙이 그대로 방어선         │
└─────────────────────────────────────────────┘
```

**설계 원칙: 권한 상승 없음.** 실제 데이터 변경(Firestore 쓰기)은 프록시(서버)가 아니라 **로그인한 직원 본인의 클라이언트 권한**으로 수행한다. 따라서 기존 `staffPosts`/`materials` 보안규칙이 그대로 적용되어, AI를 통한다고 권한이 늘어나지 않는다.

---

## 4. 기능 명세

### 4.1 AI 채팅 (기본)
- `회원관리` 옆 **🤖 AI 비서** 진입 시 **우측 슬라이드 패널**(또는 전용 섹션)로 채팅 열림
- 어느 화면(게시판/자재관리)에서도 호출 가능, **현재 화면 컨텍스트 인식**
- 응답 **스트리밍** 표시
- 사용 권한: 기존 `checkStaffAccess`와 동일하게 임직원/관리자만 (비용 통제 위해 초기 관리자 한정 옵션 가능)

### 4.2 게시판 작성 연동 (`staffPosts`)
- "공지 초안 써줘", "제안활동 내용 정리해줘" → AI가 제목+본문 초안 생성
- 생성된 초안을 **글쓰기 폼(`showWriteForm`)에 자동 채움** → **사람이 검토 후 직접 등록(`submitPost`)**
- 기존 글 **요약/번역/교정** 지원
- 권한 규칙 유지: 공지사항은 관리자만 등록 가능(AI 초안도 동일 제출 경로를 거치므로 규칙 자동 적용)

> **항상 검토 단계(human-in-the-loop):** AI가 곧바로 게시하지 않는다.

### 4.3 엑셀(자재관리) 연동 (`materials` + Tabulator + SheetJS)
자재관리는 `materials` 컬렉션 + Tabulator 그리드(`#materials-grid`) + SheetJS(xlsx)로 동작한다. 자재 스키마: `sku, name, spec, unit, stock, safety, location, vendor, note, registeredAt, updatedAt, updatedBy`.

핵심 흐름 2가지:
1. **분석/질의**: "안전재고 미달 항목 알려줘", "중복 SKU 찾아줘" → 그리드/Firestore 데이터를 읽어 요약·분석
2. **엑셀 업로드 정리**: **.xlsx 업로드 → SheetJS 파싱 → AI가 컬럼 매핑·정리 → 그리드에 미리보기 → 사용자 확정 후 일괄 등록(`upsertMaterial`)**
3. **자연어 입력**: "○○ 자재 3건 추가" → 스키마에 맞춰 행 생성 → 검토 후 확정
4. **리포트**: 조건별 자재 리포트를 CSV/엑셀로 생성·다운로드

---

## 5. 도구(Function Calling) 명세

AI가 말만 하지 않고 실제 업무를 하도록 OpenAI function calling으로 의도를 구조화한다. 프런트가 도구를 실행한다.

| 도구 | 입력 | 동작 | 위험도 |
|---|---|---|---|
| `summarize_posts` | `board`, `n` | 최근 글 요약 | 낮음(읽기) |
| `draft_board_post` | `board`, `title`, `content` | 글쓰기 폼 자동 채움(검토 후 등록) | 중(검토형 쓰기) |
| `proofread_text` | `text` | 교정/번역 | 낮음 |
| `analyze_materials` | `filter?` | 재고 부족·안전재고 미달·중복 SKU 분석 | 낮음(읽기) |
| `add_materials` | `rows[]` | 스키마 매핑 후 `upsertMaterial`(검토 후 확정) | 중(검토형 쓰기) |
| `normalize_excel` | `rows[]` | 업로드 xlsx를 스키마로 정리 → 미리보기 | 중 |
| `build_report` | `filter?`, `format` | CSV/엑셀 리포트 생성·다운로드 | 낮음 |

> 모든 **쓰기 계열 도구는 미리보기/확인 단계**를 거치고, 실행은 **사용자 본인 권한**으로만 한다.

---

## 6. UI / UX

- 네비게이션: `회원관리` 다음에 `🤖 AI 비서` 링크 추가 (`hanaro/staff/staff.html`)
- 형태: **우측 슬라이드 패널** 권장(화면 전환 없이 어디서나 사용). 대안으로 전용 board-section.
- 구성: 대화 영역(스트리밍) + 입력창 + 빠른 작업 버튼(예: "자재 분석", "공지 초안", "엑셀 정리")
- 컨텍스트 배지: 현재 화면(예: "자재관리 보는 중")을 표시해 AI가 무엇을 다루는지 명확화
- 쓰기 작업 시 **미리보기 카드 + [적용]/[취소]** 버튼으로 검토 단계 제공

---

## 7. 보안 · 거버넌스

| 항목 | 방침 |
|---|---|
| API 키 | Cloud Functions Secret Manager/환경변수에만 보관, 클라이언트 노출 금지 |
| 인증 | 프록시가 Firebase ID 토큰 검증 + 임직원 여부 확인 후에만 OpenAI 호출 |
| 비용 통제 | 사용자별 일일 요청/토큰 상한, 전체 월 예산 상한, 경량/상위 모델 분리 |
| 실행 권한 | 도구 실행은 사용자 본인 권한 → 기존 Firestore 규칙이 방어선(권한 상승 없음) |
| 쓰기 안전 | 게시/자재 변경은 항상 사람 검토 후, **감사 로그** 기록 |
| 데이터 민감도 | 자재·게시판 내용이 OpenAI로 전송됨. 사내 내부정보 정책 확인 필요. (OpenAI API는 기본적으로 입력을 모델 학습에 미사용이나, 전송 자체에 대한 사내 승인 권장) |

---

## 8. 모델 · 비용

- 정확도가 필요한 분석은 상위 모델, 일반 채팅·요약은 경량(mini급) 모델로 **비용 분리**
- 비용 = OpenAI 토큰 사용량 + Cloud Functions 호출/네트워크
- 통제 수단: 사용자/전체 한도, 응답 캐싱, 컨텍스트 데이터 최소화
- (참고) 프록시 구조라 추후 다른 LLM으로 교체 용이. 본 기획은 요청대로 OpenAI 기준.

---

## 9. 구현 로드맵

| 단계 | 내용 | 위험도 |
|---|---|---|
| **Phase 1 — 기반** | Cloud Function 프록시(키 보관·토큰검증·한도) + `🤖 AI 비서` 네비/패널 + 기본 채팅(스트리밍) | 기반 |
| **Phase 2 — 읽기 연동** | 자재 분석·요약, 게시판 요약 (read 전용) | 낮음 |
| **Phase 3 — 쓰기 연동(검토형)** | 게시글 초안 자동 채움, 자재 행 추가 | 중 |
| **Phase 4 — 엑셀 고급** | xlsx 업로드 → AI 정리 → 그리드 반영, 리포트 생성 | 중 |

---

## 10. 기존 코드 연동 지점 (`hanaro/staff/staff.html`)

| 기능 | 재사용/연동 대상 |
|---|---|
| 접근 제어 | `checkStaffAccess`, `staffAccessGranted` |
| 인증 토큰 | auth.js의 `auth.currentUser.getIdToken()` |
| 게시판 데이터 | `allPosts`, `savePosts(board)`, `staffPosts` 컬렉션 |
| 글쓰기 | `showWriteForm()`, `submitPost()` (초안 자동 채움 후 사람이 제출) |
| 자재 데이터 | `materials` 컬렉션, `upsertMaterial(row)`, Tabulator `#materials-grid` |
| 자재 권한 | `getMaterialsPermission()` |
| 엑셀 파싱 | SheetJS(xlsx) — 업로드 파싱은 기존 클라이언트 로직 활용 |

---

## 11. 의사결정 필요 사항 (착수 전)

1. **백엔드**: Firebase **Cloud Functions(Blaze 요금제)** 도입 가능 여부 — *최우선 전제.* 불가 시 대안(Vercel/Cloudflare) 검토
2. **OpenAI 계정/API 키** 준비 가능 여부 + **월 예산 상한**
3. **사용 대상**: 임직원 전체 vs 우선 관리자만
4. **시작 범위**: 로드맵 중 어디까지 먼저 (권장: Phase 1부터)

---

## 12. 위험 및 대응

| 위험 | 대응 |
|---|---|
| API 키 유출 | 서버 프록시 + Secret Manager, 클라이언트 노출 금지 |
| 비용 폭증 | 사용자/전체 한도, 모델 분리, 캐싱 |
| AI 오작성으로 잘못된 게시/데이터 변경 | 모든 쓰기 검토 단계 + 감사 로그 |
| 내부정보 외부 전송 | 사내 정책 확인, 데이터 최소화, 전송 승인 |
| 백엔드 미도입 | 본 기능은 서버 없이는 안전 구현 불가 → §11-1 선결 |

---

## 부록 A. Cloud Function 프록시 의사코드 (개념)

```
function aiProxy(request):
    user = verifyFirebaseIdToken(request.token)       # 1) 인증
    assertEmployee(user)                              # 2) 임직원 확인
    assertWithinRateLimit(user)                       # 3) 비용/한도
    body = {
        model: 선택(경량 or 상위),
        messages: request.messages,
        tools: [draft_board_post, analyze_materials, add_materials, ...]
    }
    response = OpenAI.chat(body, apiKey=SECRET)        # 4) 키는 서버에만
    return response   # 답변 + tool_calls 를 프런트로 전달 (실행은 프런트가 본인 권한으로)
```

## 부록 B. 도구 스키마 예시 (`draft_board_post`)

```json
{
  "type": "function",
  "function": {
    "name": "draft_board_post",
    "description": "게시판 글 초안을 작성해 글쓰기 폼에 채운다(사람이 검토 후 등록).",
    "parameters": {
      "type": "object",
      "properties": {
        "board": { "type": "string", "enum": ["notice", "staff", "suggestion", "as-result"] },
        "title": { "type": "string" },
        "content": { "type": "string" }
      },
      "required": ["board", "title", "content"]
    }
  }
}
```
