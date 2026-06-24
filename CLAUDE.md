# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

하나로오에이퍼니처 (Hanaro OA Furniture) company website — a static HTML/CSS/JavaScript site with Firebase backend. No build system, no framework, no npm. All pages are plain files served directly.

- Production domain: `hanarooa.com`
- Firebase project: `hanarooa-f227d`

## Development

Open HTML files directly in a browser, or use VS Code **Live Server** extension at `http://127.0.0.1:5500`. There is no build step, test suite, or package manager.

To apply Firebase Storage CORS settings after changes to `cors.json`:
```
gsutil cors set cors.json gs://hanarooa-f227d.firebasestorage.app
```

Firestore security rules are maintained in `Firestore_보안규칙_완성본.txt` and must be manually pasted into the Firebase Console → Firestore → Rules.

## Architecture

### Page Structure

The site is a hybrid: `index.html` is a single-page app (SPA) that renders multiple sections in-place, while subpages under `hanaro/` are separate HTML files.

```
index.html              ← Main SPA (home, product sections, search)
hanaro/
  js/auth.js            ← Shared Firebase auth singleton (loaded on every page)
  js/footer-bar.js      ← Shared footer; replaces <footer> content on every page (legal info + cert marks + links/SNS). Cert images in image/ (cert-*.png)
  js/router.js          ← SPA route handler + School section logic
  css/common.css        ← Shared design system
  css/auth.css          ← Login modal styles
  AS/AS.html            ← A/S 신청 페이지
  Gallery/Gallery.html  ← 갤러리
  company/company.html  ← 회사 소개 (좌측 메뉴 + 우측 내용, 인증현황 드롭다운)
  support/support.html  ← 고객지원 (Apple 지원 스타일: 제품 카테고리 + 퀵카드)
  support/repair.html   ← 수리 및 서비스 (A/S기간·하자보증·접수방법)
  support/faq.html      ← 자주묻는 질문 (아코디언)
  product/product.html  ← 제품 목록 (네비 '제품 라인업')
  product/intro.html    ← 제품소개 개요 (네비 '제품소개'): 보조네비(H/HS/OA) + 블러 히어로
  product/h.html        ← H시리즈 (intro 보조네비 공유)
  product/hs.html       ← HS시리즈
  product/oa.html       ← OA시리즈
  school/school.html    ← 납품학교 리스트 (로그인 필요)
  staff/staff.html      ← 임직원 전용 게시판 (임직원/관리자만)
  lib/tabulator/        ← Locally bundled Tabulator.js (fallback)
  school/lib/tabulator/ ← Second copy of Tabulator, loaded by school.html
```

### Repository Hygiene

The working tree contains scratch, stale, and binary files that are **not** the live site — don't edit them assuming they're canonical:
- `hanaro/js/auth.js` is the live auth singleton. `auth_js_1단계_버전.js` (root) is an older "1단계" snapshot — do not edit it.
- `sample.html`, `sample2.html`, `search.html` (root) and `hanaro/AS/이전as.html`, `hanaro/AS/테스트.html` are experiments/older versions, not linked from the live site.
- `_backup/` is a gitignored duplicate of `index.html` + `hanaro/`. Edits there have no effect on production.
- `.gitignore` excludes `_backup/`, `.cursor/`, `*.psd`, `*.clip`, `.DS_Store`, so design sources (`.psd`, `.clip`) live in the tree but stay untracked.

### Firebase Auth (`hanaro/js/auth.js`)

This file is a **singleton** that must be loaded before any page-specific scripts. It:
- Initializes Firebase once globally (`firebaseApp`, `auth`, `authDb`)
- Manages `onAuthStateChanged` with sessionStorage as a fast-restore cache
- Exposes `window.login`, `window.logout`, `window.register`, `window.showLogin`, `window.hideLogin`
- Auto-logs out after **15 minutes** of inactivity with a 3-minute warning modal
- Caches Firestore user data for 5 minutes to reduce reads

### User Roles (Firestore `users` collection)

| Field | Values | Meaning |
|-------|--------|---------|
| `userType` | `'general'`, `'employee'` | Role |
| `isAdmin` | `true` / `false` | Admin flag (separate from userType) |
| `status` | `'pending'`, `'approved'` | Registration approval state |

New registrations are created with `status: 'pending'` and require admin approval before login works. Employee buttons (`#employee-button`, `.employee-button`) are `disabled` for non-employees. The optional `org` (소속) field is collected at signup and shown in the member table.

### Firestore Collections

| Collection | Used by | Write access (see `Firestore_보안규칙_완성본.txt`) |
|------------|---------|-----------------|
| `users` | all pages | self (limited) / admin |
| `asPosts/posts` | AS.html ↔ staff A/S 처리결과 | authenticated (read public) |
| `staffPosts/{board}` | staff 직원게시판·회사운영 | employee (`asResult` needs `permFor('asResult')`) |
| `activityPhotos` | staff 활동사진첩 | owner or admin (per-doc) |
| `materials/{id}` | staff 자재관리 (one doc per row) | employee |
| `inventory/{main\|YYYY-MM-DD\|_index}` | staff 재고현황: `main`=최신본, `YYYY-MM-DD`=날짜별 스냅샷, `_index.dates[]`=저장된 날짜 목록 | `permFor('inventory')` |
| `deliverySchedule/{YYYY-MM-DD}` | staff 일정관리 | `permFor('schedule')` |
| `companyCalendar/{id}` | staff 회사운영 캘린더 | `permFor('company')` |
| `appConfig/{memberOrder\|asAssignees}` | staff | admin |

Permission helper `userCan(area)` (areas: `all/company/photos/schedule/asResult/inventory`) gates UI; admin overrides. Stored in `users.permissions`.

### Staff Page Modules (`hanaro/staff/staff.html`)

This single large file (~9k lines, several inline `<script>` blocks) holds all employee tools:
- **재고현황 / 일정관리** share one in-house spreadsheet engine (`sheet*` functions: `sheetRenderTable`, `sheetBind`, `sheetEditCell` double-click edit, drag-select via `schedSel`, right-click `#sheet-ctxmenu`, merge/align, undo/redo `sheetPushUndo`). Model: `{columns, grid, merges, aligns, ...}`. 재고현황 adds per-group `rowColors`.
- **자재관리** uses **Tabulator** (row = Firestore doc, structured fields), NOT the sheet engine. Has its own right-click menu, app-level undo/redo (native history is wiped by realtime `replaceData`), CSV/JSON/Excel import-export.
- **활동사진첩**: photos carry an optional `title`. The viewer groups photos by identical title (next/prev cycles within the group), supports mobile swipe. Upload assigns one common title to the batch; grid titles are double-click editable by owner/admin only.
- **A/S 처리결과** is `asPosts`-backed with assignee management (`appConfig/asAssignees`), replies, and completion handling. Kept live via an `onSnapshot` listener on `asPosts/posts` (`startAsrRealtime`, started from `startStaffListeners`) so new AS.html applications and processing updates appear without re-clicking the tab; while the detail modal (`asr-modal`) is open, incoming changes are buffered in `asrPendingPosts` and applied on `closeAsrModal` to avoid `asrCurrentIdx` desync. (AS.html's applicant-side list is still one-shot `.get()`.)

### External Libraries (CDN)

- **Firebase 10.7.1** — compat mode (`firebase-app-compat.js`, etc.)
- **SheetJS xlsx-0.20.1** — Excel parsing/writing. Used by `school.html` (delivery list upload) and `staff.html` (자재관리·재고현황·일정관리 Excel import/export).
- **Tabulator.js 6.3.x** — Spreadsheet/table UI. Used by `school.html` (delivery list) and `staff.html` 자재관리. `hanaro/lib/tabulator/` + `hanaro/school/lib/tabulator/` are local fallbacks.

### Key Patterns

- All pages re-include the Firebase SDK scripts individually (no shared loader).
- `sessionStorage` keys: `loggedInUser` (JSON), `loggedIn` ("true"), `lastLoginTime`, `lastLoginMessage`.
- `setLoggedInState(bool, userData)` is the single function that toggles login/logout UI across the page; it has protective logic that blocks `false` calls when sessionStorage shows the user is still logged in (to handle Firebase Auth restore delay on page load).
- `window.checkStaffAccess` is a hook that `staff.html` registers to enforce access control; `auth.js` calls it after every auth state change.
- **XSS**: user-supplied values (post titles, member 소속/이름/이메일, file names, photo titles) must be escaped before `innerHTML`. Reuse the local escape helpers already present (`asEsc`, `photoEsc`, `schedEsc`, per-render `esc`). Prefer `textContent` where no markup is needed. Values placed inside `onclick="...('${x}')"` need JS-string escaping too, not just HTML escaping.

## Docs

`docs/` contains Korean-language guides for Firebase configuration, organized into `firebase-storage/`, `firestore/`, `guides/`, `planning/` (feature plans, e.g. OpenAI 연동 기획안), `security-rules/`, and `troubleshooting/`. These are reference documents, not generated output — edit them when procedures change.

`docs/개발일지.md` is the running dev log (newest entries on top). Append a dated section there when you make notable changes.

Note that some files are duplicated between the repo root and `docs/` (e.g. `Firestore_보안규칙_완성본.txt`, `Firebase_Storage_CORS_설정_가이드.md`). The root `Firestore_보안규칙_완성본.txt` is the canonical copy that gets pasted into the Firebase Console; `docs/security-rules/rules/` holds historical staged versions (1단계/2단계/3단계).
