# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

하나로오에이퍼니처 (Hanaro OA Furniture) company website — a static HTML/CSS/JavaScript site with Firebase backend. No build system, no framework, no npm. All pages are plain files served directly.

- Production domain: `hanarooa.com`
- Firebase project: `hanarooa-f227d`
- Repo: `github.com/jmwfdisk/hanarooafurniture` (branch `main`)

## Development

Open HTML files directly in a browser, or use VS Code **Live Server** extension at `http://127.0.0.1:5500`. There is no build step, test suite, or package manager.

**Deployment is GitHub Pages from `main`** (CNAME `hanarooa.com`, no Actions workflow). Pushing/merging to `main` publishes straight to production — there is no staging. Browsers may cache `auth.js`/`footer-bar.js`/etc., so bump the `?v=YYYYMMDD…` query string on changed includes (see footer-bar note below) so users get the new file.

To apply Firebase Storage CORS settings after changes to `cors.json`:
```
gsutil cors set cors.json gs://hanarooa-f227d.firebasestorage.app
```

Firestore security rules are maintained in `Firestore_보안규칙_완성본.txt` and must be manually pasted into the Firebase Console → Firestore → Rules.

Commit messages are written in Korean, describing the user-facing change concisely (e.g. `바로가기 카테고리 소제목 색상 초록색(#2e9e54)`, `바로가기 드롭다운 카테고리별 그룹화`). Follow this convention.

## Architecture

### Page Structure

The site is a hybrid: `index.html` is a single-page app (SPA) that renders multiple sections in-place, while subpages under `hanaro/` are separate HTML files.

```
index.html              ← Main SPA (home, product sections, search)
hanaro/
  js/auth.js            ← Shared Firebase auth singleton (loaded on every page)
  js/footer-bar.js      ← Shared footer; replaces <footer> content on every page (legal info + cert marks + links/SNS). Cert images in image/ (cert-*.png). Also injects the **'바로가기' dropdown** into `.partner-logos` — STAFF PAGE ONLY (guarded by `location.pathname` `/staff/`). Links live in `SITE_LINKS`, a category-grouped array `[{category, links:[{label,url}]}]`; each include is cache-busted with `?v=YYYYMMDD…` (bump on every edit, all pages). The dropdown menu (`.fbz-sl-menu`) is `position:fixed` with JS-computed coordinates (`positionMenu`, opens upward when there's no room below) — NOT `absolute` — because `.partner-logos` is a horizontal-scroll (`overflow-x:auto`) strip on mobile that would otherwise clip the menu.
  js/router.js          ← SPA route handler + School section logic
  css/common.css        ← Shared design system
  css/auth.css          ← Login modal styles
  AS/AS.html            ← A/S 신청 페이지
  Gallery/Gallery.html  ← 갤러리
  company/company.html  ← 회사 소개 (좌측 메뉴 + 우측 내용, 인증현황 드롭다운, 로고・CI; 모바일은 좌측메뉴가 제목 아래 가로 스크롤 칩)
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

New registrations are created with `status: 'pending'` and require admin approval before login works. Employee buttons (`#employee-button`, `.employee-button`) are `disabled` for non-employees. The optional `org` (소속) and `position` (직급 / 직책) fields are collected at signup and shown/edited in the member table (`position` is **required for 일반회원**, optional for 임직원; admin-editable inline via `editMemberPosition`/`saveMemberPosition`, mirroring `org`). **The register form HTML is duplicated static markup across ~13 pages, so `auth.js`'s `setupRegisterForm()` (called from `showAuthTab('register')`) restructures it at runtime in ONE place** — injects the `#reg-position` input above 이름, removes the legacy `#reg-user-type` dropdown, and replaces the single 회원가입 button with two: **임직원 가입신청** → `register('employee')` and **일반회원 가입신청** → `register('general')` (`register(userTypeArg)` takes the type from the button, falling back to the dropdown then `'general'`). Stale-cached old `auth.js` degrades to the old single-button+dropdown form, which still works. `position` is an extra field on the `users` doc (no Firestore-rule allowlist, like `org`).

### Firestore Collections

| Collection | Used by | Write access (see `Firestore_보안규칙_완성본.txt`) |
|------------|---------|-----------------|
| `users` | all pages | self (limited) / admin |
| `asPosts/posts` | AS.html ↔ staff A/S 처리결과 | authenticated (read public) |
| `staffPosts/{board}` | staff 직원게시판·회사운영 (boards: `notice`/`staff`/`staff-data`/`staff-report`/`suggestion`/`as-result`) | employee (`as-result` needs `permFor('asResult')`; `staff-report`(업무보고 본사) read+write need `permFor('report')`) |
| `activityPhotos` | staff 활동사진첩 | owner or admin (per-doc) |
| `materials/{id}` | staff 자재관리 (one doc per row) | read=`isEmployee()`; create/update/delete=`permFor('materials')` |
| `inventory/{main\|YYYY-MM-DD\|_index}` | staff 재고현황: `main`=최신본, `YYYY-MM-DD`=날짜별 스냅샷, `_index.dates[]`=저장된 날짜 목록 | `permFor('inventory')` |
| `deliverySchedule/{YYYY-MM-DD}` | staff 일정관리 | `permFor('schedule')` |
| `companyCalendar/{id}` | staff 회사운영 캘린더(주요회사운영) | `permFor('company')` |
| `leaveSchedule/{id}` | staff 직원게시판 **연월차일정** 캘린더 | read/create=`isEmployee()`; update/delete=`permFor('leaveSchedule')` |
| `appConfig/{memberOrder\|asAssignees}` | staff | `memberOrder`=admin; `asAssignees`(A/S 출동담당자 목록)=`permFor('asAssignee')` |

Permission helper `userCan(area)` (areas: `all/notice/company/photos/schedule/asResult/asAssignee/asApprStaff/asApprove/asApproveCeo/inventory/materials/leaveSchedule/report`) gates UI; admin overrides — **except the 3 A/S 결재 areas (`asApprStaff`/`asApprove`/`asApproveCeo`) which are checked via `asrPerm()` with NO admin/all override** (the 권한설정 modal can't grant them to admin accounts anyway). Stored in `users.permissions`. `notice` controls **공지사항** write/edit/delete (was admin-only; now `userCan('notice')`, so admin/`all`/notice-holders) — **client-gated only**: the Firestore rule still allows any employee to update `staffPosts/notice` because the per-view 조회수 save (`viewPost`→`commitBoardChange`) is also an `update`, and server-gating it would make read-only viewers hit the save-failure alert. The 권한설정 modal rows show a parenthetical `.perm-desc` describing each area's operations (쓰기/읽기/수정/삭제). `report` controls the 직원게시판 **업무보고(본사)** segment (`staff-report` board): the segment button is hidden and access blocked for users without it. `asAssignee` controls the A/S 처리결과 **출동 담당자 관리**(추가/삭제 of `appConfig/asAssignees`) — gated in UI via `asrCanManageAssignee()` (button visibility + `openAssigneeManager`/`addAssignee`/`removeAssignee`) and enforced in the Firestore rule for `appConfig/asAssignees`. `leaveSchedule` controls the 직원게시판 **연월차일정** calendar's **edit/delete** only — **adding** events is open to all employees. The monthly-calendar engine is shared between 주요회사운영 (`companyCalendar`, 회사운영 tab) and 연월차일정 (`leaveSchedule`, 직원게시판 tab) via a `currentCalKind` ('company'|'leave') + `CAL_KINDS` config (`collection`/`viewId`/`canAdd`/`canManage`); the shared `loadAndRenderCalendar`/`renderCalendar`/`renderDayModal`/`addCompanyEvent`/`editCompanyEvent`/`saveCompanyEventEdit`/`deleteCompanyEvent` read `calCfg()`. `staff-leave` is a `switchBoard` board type that shows `#leave-calendar-view` (like `as-result` shows the asr view). Multi-day range adds stamp `periodStart`/`periodEnd` on each day's doc, shown as small grey text above the title in the day modal. **The leave calendar's add/edit forms are a simplified sheet** (no title/time/memo): 휴가기간 + 연차일수(1일/0.5일) + 종류(연차/휴가/병가/경조사/기타) selects; the title is auto-built by `buildLeaveTitle()` as `"직급 이름(연차N)"` + ` / 종류` when 종류≠연차 (author from `currentAuthorLabel()`, read-only; edit keeps the original author via `leaveInfoOf()`, which also parses legacy titles). When the period spans more than one day (start≠end) the 연차일수 select is disabled (`updateLeaveDaysBadge()` add / `leaveEditSyncDays()` edit, wired to the date inputs' onchange) and the title shows the period instead — `"직급 이름(7.8~7.10) / 휴가"` (`calFmtShort()` M.D format, `leaveDays` saved as null). **Only admins (`calIsAdmin()`) can change the author** — for them the 작성자 field renders as a text input (`.day-leave-author-input`) in both add and edit forms (대리 등록/정정); non-admins get the read-only auto-filled label. Leave docs additionally store `author`/`leaveDays`/`leaveType`; the shared `#day-add-form` toggles `#day-add-company-fields` vs `#day-add-leave-fields` per `currentCalKind`, and the day-modal list hides the time column for leave. Areas are data-driven via `PERM_AREAS` (drives the 권한설정 modal checkboxes `#perm-<area>`). The **회원관리** nav (`switchBoard('member-management')`) is **admin-only** — the nav link is `display:none` by default and revealed only for admins in `checkStaffAccess`; `switchBoard` also blocks non-admins.

### Staff Page Modules (`hanaro/staff/staff.html`)

This single large file (~10.6k lines, several inline `<script>` blocks) holds all employee tools:
- **재고현황 / 일정관리** share one in-house spreadsheet engine (`sheet*` functions: `sheetRenderTable`, `sheetBind`, `sheetEditCell` double-click edit, drag-select via `schedSel`, right-click `#sheet-ctxmenu`, merge/align, undo/redo `sheetPushUndo`). Model: `{columns, grid, merges, aligns, ...}`. 재고현황 adds per-group `rowColors`.
- **자재관리** uses **Tabulator** (row = Firestore doc, structured fields), NOT the sheet engine. Has its own right-click menu, app-level undo/redo (native history is wiped by realtime `replaceData`), CSV/JSON/Excel import-export.
- **활동사진첩**: photos carry an optional `title`. The viewer groups photos by identical title (next/prev cycles within the group), supports mobile swipe. Upload assigns one common title to the batch; grid titles are double-click editable by owner/admin only.
- **게시판 글쓰기 리치 에디터**: the shared write form (`#write-form`) uses a `contenteditable` editor (`#write-content`, `.rte-editor`) + toolbar (`#write-rte-toolbar`), not a textarea. Bold/italic/underline/strike/list/align run via `document.execCommand`; font color/highlight via `foreColor`/`hiliteColor`; **pt font size wraps the selection (or caret, via a ZWSP span) in `<span style="font-size:Npt">`** since execCommand fontSize only supports 1–7. Post body is stored as **HTML, sanitized with `rteSanitize()` (DOMPurify allowlist) on save and on render** — legacy plain-text posts are auto-detected and rendered with `escape + nl2br`. Helpers: `rteSanitize`, `rteToText`, `initRteToolbar` (tracks the last selection range so the OS color picker doesn't lose it). Applies to ALL boards sharing the form.
- **게시판 검색** (`searchPosts`): there is ONE shared search element (`.search-group#board-search`, a 제목/내용 select + input + magnifier button). `placeBoardSearch()` **relocates it to the right end of the active segment menu** (`.notice-segment` row) — `#notice-segment` (공지사항), `#staff-segment` (직원게시판), `#asresult-segment` (A/S) — styled as a `.seg-search` pill (알약형) with the select hidden so it searches title **and** content (`searchType='all'`). 제안활동 has no segment menu, so it uses a right-aligned bar `#suggestion-search-bar` at the top of `#notice-post-view`. The search is hidden on 캘린더/활동사진첩/회원관리. `placeBoardSearch()` is called from `switchBoard`, `setNoticeSegment`, `setAsrSegment` and **clears the query on every move**; the parked `.board-footer` home is `display:none`. **A/S 처리결과 uses a separate data path** (`asrData`/`renderAsResult`, not `allPosts`): `searchPosts` delegates to `searchAsr()`, which sets `asrSearchQuery`; `renderAsResult` filters rows by 제목·작성자·구분·내용·담당자.
- **A/S 처리결과** is `asPosts`-backed with assignee management (`appConfig/asAssignees`), replies, and completion handling. Kept live via an `onSnapshot` listener on `asPosts/posts` (`startAsrRealtime`, started from `startStaffListeners`) so new AS.html applications and processing updates appear without re-clicking the tab; while the detail modal (`asr-modal`) is open, incoming changes are buffered in `asrPendingPosts` and applied on `closeAsrModal` to avoid `asrCurrentIdx` desync. (AS.html's applicant-side list is still one-shot `.get()`.) **완료(done)** 건 상세에는 4단계 **결재선**(`asrApprovalHtml`): 출동담당자(자동확인=assignee/completedBy·completedDate) → 담당자 → 관리자 → 대표이사. The 3 manual stages stamp `apprStaff`/`apprAuth`/`apprCeo` = `{title,name,date}` on the post. Each pending cell renders the "미결재" text as a **button** (`approveAsr(stage)`) only for the user who may stamp the **next sequential** stage (담당자→관리자→대표이사); clicking just **confirms** (no manual input) and auto-stamps the approver's **직책(=`users.position`) + 이름 + 날짜** (대표이사 stage falls back to 직책 "대표이사" if `position` is unset). Stage permission is checked via `asrPerm(key)` which reads `users.permissions[key]` **only — NO admin/`all` override** (per requirement: approvers are admin-designated employees, not the site admin): 담당자=`asApprStaff`, 관리자=`asApprove`, 대표=`asApproveCeo`. Approval data lives in `asPosts/posts` (client-gated like the rest of AS — no extra Firestore rule). The detail also has a **구매이력 확인** card (above 답글/메모) — memo (`purchaseNote = {text,by,date}`) writable by anyone holding any 결재 permission (`asrCanPurchase()`); **this memo is also shown to the applicant on the public AS.html detail modal** (`#modal-as-status`, 구매이력 확인 card) whenever `purchaseNote.text` exists. The **처리내용** card is renamed **A/S 출동담당자(처리 내용)** and is writable/completable **only by the assigned 출동담당자** — identified by name match between the logged-in user and `p.assignee` (`asrIsDispatcher()`; `completeAsr` enforces it). **담당자 지정(assignee select)** is gated by `asrCanAssign()` = `asrCanEdit()` (asResult) **OR `asrIsRegisteredDispatcher()`** (logged-in user's name matches an entry in the 출동담당자 목록 `asrAssignees`), so a registered 출동담당자 can self-assign **without** asResult and thereby unlock their own 처리내용 input (`assignAsr` enforces `asrCanAssign()`; asPosts write is `isAuthenticated`, no rule change). Editing the master 출동담당자 목록 still needs `asAssignee` (`asrCanManageAssignee()`). 처리내용 supports **image attachments** (`p.asReportFiles = [{name,url,type,size}]`, Storage URLs only via the global `uploadFilesToStorage`): the dispatcher picks images (pending `File`s in `asrReportSelected`, previewed as removable thumbnails), and `completeAsr` uploads them on save+complete; saved images render as thumbnails via `asrReportImagesHtml()` (reuses `.asr-thumb`) in all three 처리내용 states and are listed (filenames) in the Excel export. 답글/메모 stay gated by `asrCanEdit()` (`asResult`); 담당자 지정 uses `asrCanAssign()` (see above). A **완료(done)** item's detail also shows a **🗑️ 게시물 삭제** button (`.asr-btn.danger`) visible **only to web/server admins** (`asrIsAdmin()`); `deleteAsrDone()` splices the post out of the shared `asPosts` array and saves — so it **also disappears from the public AS.html applicant list** (full delete, with confirm + rollback on save failure; no Firestore-rule change, admin gate is client-side like the rest of AS). The detail modal of a **완료(done)** item also shows a `#asr-export-btn` that calls `exportAsrDetailExcel()` — builds an AOA (구분·제목·작성자·신청일·담당자·신청내용·첨부·답글·처리내용·완료자/일) and `XLSX.writeFile`s `A_S신청상세_<제목>_<완료일>.xlsx` via the already-loaded SheetJS.

### External Libraries (CDN)

- **Firebase 10.7.1** — compat mode (`firebase-app-compat.js`, etc.)
- **SheetJS xlsx-0.20.1** — Excel parsing/writing. Used by `school.html` (delivery list upload) and `staff.html` (자재관리·재고현황·일정관리 Excel import/export).
- **Tabulator.js 6.3.x** — Spreadsheet/table UI. Used by `school.html` (delivery list) and `staff.html` 자재관리. `hanaro/lib/tabulator/` + `hanaro/school/lib/tabulator/` are local fallbacks.
- **DOMPurify 3.1.6** — HTML sanitizer (jsDelivr CDN), loaded by `staff.html` for the board write rich-text editor. `rteSanitize()` falls back to tag-stripped plain text if it fails to load, so missing CDN degrades safely (loses formatting, never injects).

### Key Patterns

- **Board writes go through `commitBoardChange(board, mutator)` (Firestore transaction), NOT the old whole-array `savePosts`.** `staffPosts/{board}` stores all of a board's posts in one `posts` array and clients load it one-shot (no live listener). The legacy `savePosts(board)` did `doc.set({posts: allPosts[board]})` from the *local* copy, so a stale client re-saving (notably `viewPost` re-saving on every view to bump 조회수) would clobber posts others had added since page load — attachments "disappeared over time". `commitBoardChange` re-reads the server array inside a transaction and applies `mutator(serverPosts)` so concurrent additions survive. Posts carry a stable `id` (`makePostId`); identity is `postMatches` (id, else title+author+date). Modal edit/delete resolve the target by reference (`currentPostRef`/`editingPostRef`), not by a possibly-shifted index. **Don't reintroduce full-array `set()` for post mutations.** Attachments must go to Storage via `uploadFilesToStorage` (URL only in the doc) — never embed base64 in the Firestore doc when `db` exists (1MB limit → silent loss); base64 fallback is allowed only in pure-local `!db` dev mode.
- All pages re-include the Firebase SDK scripts individually (no shared loader).
- `sessionStorage` keys: `loggedInUser` (JSON), `loggedIn` ("true"), `lastLoginTime`, `lastLoginMessage`.
- `setLoggedInState(bool, userData)` is the single function that toggles login/logout UI across the page; it has protective logic that blocks `false` calls when sessionStorage shows the user is still logged in (to handle Firebase Auth restore delay on page load).
- `window.checkStaffAccess` is a hook that `staff.html` registers to enforce access control; `auth.js` calls it after every auth state change.
- **Centered dialogs (staff.html)**: native `alert`/`confirm`/`prompt` are replaced by centered popups. `window.alert` is globally overridden by `showStaffAlertPopup`; use `await showStaffConfirm(msg)` (Promise<bool>, so the enclosing fn must be `async`) instead of `confirm`, and `await showStaffPrompt(msg, def)` instead of `prompt`. `showStaffDonePopup` / AS.html `showAsDonePopup` are success toasts. Don't reintroduce native dialogs.
- **XSS**: user-supplied values (post titles, member 소속/이름/이메일, file names, photo titles) must be escaped before `innerHTML`. Reuse the local escape helpers already present (`asEsc`, `photoEsc`, `schedEsc`, per-render `esc`). Prefer `textContent` where no markup is needed. Values placed inside `onclick="...('${x}')"` need JS-string escaping too, not just HTML escaping.

## Docs

`docs/` contains Korean-language guides for Firebase configuration, organized into `firebase-storage/`, `firestore/`, `guides/`, `planning/` (feature plans, e.g. OpenAI 연동 기획안), `security-rules/`, and `troubleshooting/`. These are reference documents, not generated output — edit them when procedures change.

`docs/개발일지.md` is the running dev log (newest entries on top). Append a dated section there when you make notable changes.

Note that some files are duplicated between the repo root and `docs/` (e.g. `Firestore_보안규칙_완성본.txt`, `Firebase_Storage_CORS_설정_가이드.md`). The root `Firestore_보안규칙_완성본.txt` is the canonical copy that gets pasted into the Firebase Console; `docs/security-rules/rules/` holds historical staged versions (1단계/2단계/3단계).
