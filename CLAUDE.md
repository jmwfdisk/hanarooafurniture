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

**Verification = syntax-check the inline scripts.** With no test runner, the standing check before deploying an edit to a big inline-script page (staff.html has 9 inline `<script>` blocks, AS.html/school.html similar) is to extract each block and run `node --check` on it — this is what catches the common breakage here (an `await` outside `async`, an unclosed brace in a 15k-line file). One-liner:
```
node -e 'const fs=require("fs"),cp=require("child_process"),os=require("os"),p=require("path");
const f=process.argv[1],d=fs.mkdtempSync(p.join(os.tmpdir(),"chk-"));let m,i=0,bad=0;
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,h=fs.readFileSync(f,"utf8");
while((m=re.exec(h))){i++;const t=p.join(d,`b${i}.js`);fs.writeFileSync(t,m[1]);
try{cp.execFileSync("node",["--check",t],{stdio:"pipe"})}catch(e){bad++;console.log(`block ${i} FAIL\n`+e.stderr)}}
console.log(`${f}: ${i} blocks, ${bad} failed`)' hanaro/staff/staff.html
```

**Cache-bust bumps must hit every page.** The shared includes are duplicated across **15 HTML pages** (all of `hanaro/**` + `index.html`), so a `?v=` bump is a repo-wide find-and-replace, not a one-file edit. Find the current value before editing:
```
grep -rho "auth\.js?v=[0-9a-z]*" --include="*.html" --exclude-dir=_backup* . | sort | uniq -c
```
All 15 must end up on the same value (a page left behind keeps serving the stale file). As of 2026-08-05: `auth.js?v=20260714a`, `footer-bar.js?v=20260706a`, `redesign.js?v=20260709g` (redesign.js is on 14 pages — `index.html` inlines its own copy).

To apply Firebase Storage CORS settings after changes to `cors.json`:
```
gsutil cors set cors.json gs://hanarooa-f227d.firebasestorage.app
```

To backfill `Cache-Control` on files uploaded before the cache policy existed (see Key Patterns), e.g.:
```
gsutil setmeta -h "Cache-Control:public, max-age=31536000, immutable" "gs://hanarooa-f227d.firebasestorage.app/as-result-files/**"
```
Run these **without `gsutil -m`** — parallel mode hangs with no progress on this machine.

Security rules are maintained as files in the repo root and must be **manually pasted into the Firebase Console**: `Firestore_보안규칙_완성본.txt` → Firestore → Rules, `Storage_보안규칙_완성본.txt` → Storage → Rules. Editing the file does nothing until it's pasted — when a change needs a rule change, say so explicitly so the user publishes it.

Commit messages are written in Korean, describing the user-facing change concisely (e.g. `바로가기 카테고리 소제목 색상 초록색(#2e9e54)`, `바로가기 드롭다운 카테고리별 그룹화`). Follow this convention.

## Architecture

### Page Structure

The site is a hybrid: `index.html` is a single-page app (SPA) that renders multiple sections in-place, while subpages under `hanaro/` are separate HTML files.

```
index.html              ← Main SPA (home, product sections, search)
hanaro/
  js/auth.js            ← Shared Firebase auth singleton (loaded on every page)
  js/footer-bar.js      ← Shared footer; replaces <footer> content on every page (legal info + cert marks + links/SNS). Cert images in image/ (cert-*.png). Also injects the **'바로가기' dropdown** into `.partner-logos` — STAFF PAGE ONLY (guarded by `location.pathname` `/staff/`). Links live in `SITE_LINKS`, a category-grouped array `[{category, links:[{label,url}]}]`; each include is cache-busted with `?v=YYYYMMDD…` (bump on every edit, all pages). The dropdown menu (`.fbz-sl-menu`) is `position:fixed` with JS-computed coordinates (`positionMenu`, opens upward when there's no room below) — NOT `absolute` — and is **moved to `document.body` (portal) at build time**, because `.partner-logos` is a horizontal-scroll (`overflow-x:auto`) strip on mobile: iOS Safari clips a `fixed` menu left inside the scroll strip to the strip's height, and `.fbz-sitelinks`'s `z-index:30` stacking context would cap the menu under higher-z page elements. Open state = `.open` class on BOTH `.fbz-sitelinks` (caret) and `.fbz-sl-menu` (visibility); the outside-click closer checks `menu.contains(e.target)` too.
  js/redesign.js        ← **Function 스타일 리디자인 공용 모듈**(전 서브페이지에 `?v=YYYYMMDD` 한 줄로 include). 런타임에 상단 하늘색 안내바(`.fh-topbar`) + 다크글래스 플로팅 네비바 주입, 로그인 아이콘→텍스트, '제품 라인업' CTA, 모바일 절반 드로어를 body로 포털 재구성, 스크롤 시 안내바 숨김, **네비 메가 드롭다운**(`.fh-mega`, 데스크탑 ≥1201px 호버 보조메뉴 — 회사소개 `?sec=`/제품소개 H·HS·OA/제품 라인업 `?category=`/고객지원 3페이지; 열림 동안 네비바가 전폭 크림색(`--fh-paper` #F6F4EF) 시트로 변신(`.navbar.fh-mega-open`), 보조메뉴는 호버 메뉴 x좌표 아래 세로 정렬, 닫힘=외부 클릭·스크롤·ESC(마우스 이탈로는 안 닫힘); 링크는 각 메뉴 a의 href 기준 상대 해석이라 홈·서브 공용, JS도 index 인라인과 이중 관리). 리디자인 CSS는 **홈(index.html)은 인라인 `<style id="fh-redesign">`, 서브는 이 파일의 CSS 리터럴로 이중 관리** — 네비바 수정 시 두 곳 다 고칠 것. z-index: 네비바 1101·상단바 1102(모달이 이 위로 나오려면 z≥1200 필요, staff 모달 참고). 캐시버스트 `?v=` 범프 필수.
  js/router.js          ← SPA route handler + School section logic
  css/common.css        ← Shared design system
  css/auth.css          ← Login modal styles
  AS/AS.html            ← A/S 신청 페이지
  Gallery/Gallery.html  ← 갤러리
  company/company.html  ← 회사 소개 (좌측 메뉴 + 우측 내용, 인증현황 드롭다운, 로고・CI; 모바일은 좌측메뉴가 제목 아래 가로 스크롤 칩)
  support/support.html  ← 고객지원 (Apple 지원 스타일: 제품 카테고리 + 퀵카드)
  support/repair.html   ← 수리 및 서비스 (A/S기간·하자보증·접수방법)
  support/faq.html      ← 자주묻는 질문 (아코디언)
  support/manage.html   ← 관리하기 (가구 관리 방법 스텝 페이지; 고객지원 퀵카드 + 홈 메가메뉴에서 링크)
  product/product.html  ← 제품 목록 (네비 '제품 라인업')
  product/intro.html    ← 제품소개 개요 (네비 '제품소개'): 보조네비(H/HS/OA) + 블러 히어로
  product/h.html        ← H시리즈 (intro 보조네비 공유)
  product/hs.html       ← HS시리즈
  product/oa.html       ← OA시리즈
  school/school.html    ← 납품학교 리스트 (로그인 필요)
  staff/staff.html      ← 임직원 전용 게시판 (임직원/관리자만) — 모듈 상세는 `hanaro/staff/CLAUDE.md`
  lib/tabulator/        ← Locally bundled Tabulator.js (fallback)
  school/lib/tabulator/ ← Second copy of Tabulator, loaded by school.html
```

### Repository Hygiene

The working tree contains scratch, stale, and binary files that are **not** the live site — don't edit them assuming they're canonical:
- `hanaro/js/auth.js` is the live auth singleton. `auth_js_1단계_버전.js` (root) is an older "1단계" snapshot — do not edit it.
- `sample.html`, `sample2.html`, `search.html` (root) and `hanaro/AS/이전as.html`, `hanaro/AS/테스트.html` are experiments/older versions, not linked from the live site.
- `_backup/` is a gitignored duplicate of `index.html` + `hanaro/`. Edits there have no effect on production.
- `.gitignore` excludes `_backup/`, `_backup_predesign_2026-07-06/` (리디자인 전 백업), `.cursor/`, `docs/`, `*.psd`, `*.clip`, `.DS_Store`, so design sources (`.psd`, `.clip`) and the internal docs live in the tree but stay untracked (`docs/` is 내부 참고 문서, 배포 불필요 — edits there never reach the repo/production).
- **Two parallel doc sets, one per agent**: `CLAUDE.md` (Claude Code) and `AGENTS.md` (Codex, untracked) hold the same content — a pair in the repo root and a pair in `hanaro/staff/`, each auto-loaded for its own directory. They drift: after editing one, copy it onto its sibling and re-apply the differing header lines (the title, the "guidance to …" line, and the cross-references to the other file in the pair).

### Firebase Auth (`hanaro/js/auth.js`)

This file is a **singleton** that must be loaded before any page-specific scripts. It:
- Initializes Firebase once globally (`firebaseApp`, `auth`, `authDb`)
- Manages `onAuthStateChanged` with sessionStorage as a fast-restore cache
- Exposes `window.login`, `window.logout`, `window.register`, `window.showLogin`, `window.hideLogin`, plus the **마이페이지** handlers `window.showMyPage`/`hideMyPage`/`saveMyPage`/`changeMyPassword`
- Auto-logs out after **15 minutes** of inactivity with a 3-minute warning modal
- Caches Firestore user data for 5 minutes to reduce reads

**Header login/logout UI & flicker fix.** The header has `#login-link` (아이콘만; text removed) and `#logout-link` (아이콘만). Visibility is driven by **`<html data-auth="in|out">`**: a tiny inline `<head>` snippet on every page sets it from sessionStorage synchronously (first paint correct) and injects `#auth-css` (`html[data-auth="in"] #login-link{display:none!important}` etc.); `auth.js` is the single source of truth that updates `data-auth` in `applyInitialState()` and `setLoggedInState()`. This replaced the earlier inline-`style.display` toggling that flickered on navigation — **don't reintroduce display-toggle-only auth UI**. When logged in, `ensureMyPageLink()` injects a **'내 정보' 알약 버튼 after `#logout-link`** (order: 로그아웃 → 내 정보 → 임직원); `.employee-btn button` is forced to a pill via the injected `#mypage-style`.

**마이페이지 (내 정보 수정).** `auth.js` injects a shared modal (`#mypage-modal`, built by `ensureMyPageModal()`) so all 14 pages get it without per-page markup. A logged-in user edits **소속(`org`)·직급/직책(`position`) only** (+비밀번호 변경 via reauthenticate→updatePassword); 이메일·이름·연락처는 읽기전용(관리자 전용 수정). `saveMyPage()` writes only `{org, position}` to `users/{uid}` and refreshes sessionStorage/`userDataCache`. **This is enforced server-side**: the `users` update rule's self-branch is `affectedKeys().hasOnly(['org','position'])` — a user cannot change their own name/phone/userType/empGroup/permissions/isAdmin/status (closes a privilege-escalation hole; admins still update any field).

### User Roles (Firestore `users` collection)

| Field | Values | Meaning |
|-------|--------|---------|
| `userType` | `'general'`, `'employee'` | Role |
| `empGroup` | `'hq'` / `''` | 본사 임직원 구분 (userType은 그대로 `'employee'` — 연월차 결재 그룹 잠금용; UI상 회원유형 "본사 임직원") |
| `isAdmin` | `true` / `false` | Admin flag (separate from userType) |
| `status` | `'pending'`, `'approved'` | Registration approval state |

New registrations are created with `status: 'pending'` and require admin approval before login works. **Server-side too (2026-07-13)**: the Firestore `isEmployee()` helper requires `status=='approved'` (docs missing the field are grandfathered as approved — safe because the create rule forces `status:'pending'`), and `permFor()`/`hrManager()`/`payManager()` require an approved employee. The `users` create rule whitelists `userType` to `general`/`employee` and blocks self-granting `permissions`/`scheduleEditor`/`empGroup:'hq'` at signup. Employee buttons (`#employee-button`, `.employee-button`) are `disabled` for non-employees. `org` (소속), `position` (직급 / 직책), `name` (이름), `phone` (연락처) are collected at signup. In the member table (admin-only): `org`·`position`·`name`·`phone` are all **admin-editable inline** (`editMemberOrg`/`editMemberPosition`/`editMemberName`/`editMemberPhone` + their `saveMember*`); `phone` renders as a small 📞 sub-line under the name in the 이름 cell (no separate column). `position` is **required for 일반회원** at signup, optional for 임직원. **The register form HTML is duplicated static markup across ~13 pages, so `auth.js`'s `setupRegisterForm()` (called from `showAuthTab('register')`) restructures it at runtime in ONE place** — injects the `#reg-position` input above 이름, removes the legacy `#reg-user-type` dropdown, and replaces the single 회원가입 button with **two**: **임직원 가입신청** → `register('employee')` and **일반회원 가입신청** → `register('general')` (`register(userTypeArg)` takes the type from the button, falling back to the dropdown then `'general'`). **본사 임직원 is NOT chosen at signup** — an admin promotes a member via the 회원관리 유형 select (`changeMemberType('employee-hq')` → `userType:'employee'`+`empGroup:'hq'`). `register('employee-hq')` still exists but is no longer wired to any signup button. Stale-cached old `auth.js` degrades gracefully; `auth.js` includes are cache-busted with `?v=YYYYMMDD` on all pages (bump on every auth.js edit — currently `?v=20260714a`). The login form is also duplicated static markup: `ensureRememberIdUI()` (called from `showLogin`) injects the **'아이디 저장' checkbox** at runtime (right-aligned under the password field); when checked, the successful login email is kept in `localStorage('savedLoginId')` and auto-filled next time (unchecked login clears it). `position`/`phone` are extra fields on the `users` doc; the self-edit Firestore rule allowlist is `org`/`position` only (see Firebase Auth section — name/phone are admin-only).

### Firestore Collections

| Collection | Used by | Write access (see `Firestore_보안규칙_완성본.txt`) |
|------------|---------|-----------------|
| `users` | all pages | self-update = `org`/`position` only (`hasOnly`); admin = any field; `uid`/`username` never |
| `asPosts/posts` | AS.html ↔ staff A/S 처리결과 | write=authenticated; **read=`isApprovedUser() OR isEmployee()`** (비인증 공개읽기 차단 — 신청서에 연락처 등 PII. AS.html은 비로그인 시 목록 대신 로그인 안내를 표시하고 로그인 시 `authStateRestored`로 재로드) |
| `staffPosts/{board}` | staff 직원게시판·회사운영 (boards: `notice`/`cert`/`staff`/`staff-data`/`staff-report`/`suggestion`/`as-result`) | employee (`as-result` needs `permFor('asResult')`; `staff-report`(업무보고 본사) read+write need `permFor('report')`) |
| `activityPhotos` | staff 활동사진첩 | owner or admin (per-doc) |
| `materials/{id}` | ~~staff 자재관리 자재목록 탭~~ — **2026-08-05 탭 제거로 UI에서 접근 불가** (문서·규칙·구현 코드는 그대로 보존, 되살리려면 `hanaro/staff/CLAUDE.md` 참고) | read=`isEmployee()`; create/update/delete=`permFor('materials')` |
| `materialSheets/{key}` | staff 자재관리 **시트 탭** ('월재고' 엑셀 양식 8종: `prod`/`vendor`/`inject`/`brow`/`neworder`/`pipe`/`matsum`/`alllist`) — 문서 1개 = 시트 1개, 저장 형식은 `inventory`와 동일(2D 필드는 JSON 문자열) | read=`isEmployee()`; create/update/delete=`permFor('materials')` (materials와 동일) |
| `inventory/{main\|YYYY-MM-DD\|_index}` | staff 재고현황: `main`=최신본, `YYYY-MM-DD`=날짜별 스냅샷, `_index.dates[]`=저장된 날짜 목록 | `permFor('inventory')` |
| `deliverySchedule/{YYYY-MM-DD}` | staff 일정관리 | `permFor('schedule')` |
| `hrRecords/{uid}` | staff 운영관리 인사관리(인사기록부) | read=본인(`isOwner`) or `hrManager()`; write=`hrManager()` = admin or **명시적 `hr` 권한만('all' 미포함**, 결재 권한과 동일 원칙; client는 `hrCanManage()`) — 'hr' 권한자는 `users` 컬렉션 read도 규칙에서 허용(대상 임직원 선택용) |
| `paySlips/{uid}` | staff 운영관리 인사관리(급여명세서) | read=**본인만**(`isOwner` — 데이터관리자·관리자도 타인 열람 불가, 쓰기 전용 업로드); write=`payManager()` = admin/`hr`/명시적 `pay`(급여명세 업로드 전용 권한, 'all' 미포함; client `payCanManage()` — `pay` 권한자는 `users` read 허용, `hrRecords`는 불가). `months['YYYY-MM_회사키']={url,payDate,company,...}`(구버전 키 `YYYY-MM`=하나로) — PDF는 Storage `pay-slips/`(read=로그인, 파일명 무작위 토큰이라 경로 추측 불가) |
| `paySlipsIndex/{uid}` | staff 급여명세 존재 인덱스 | read=본인 or `payManager()`; write=`payManager()`. 내용 없이 `months[key]={company,payDate}`만 — 삭제 전 존재 확인용(`payDeleteSlip`: 없으면 없다 안내, 있으면 확인 후 본문+인덱스 동시 삭제; 인덱스 도입 전 업로드분은 '삭제 시도' 확인 폴백) |
| `payInquiries/{id}` | staff 급여명세서 **이의제기 문의** | read=본인(`uid`) or `payManager()`(문의에 급여 금액이 들어갈 수 있어 명세서와 동일 열람 원칙); create=승인 임직원 본인 명의+`status:'open'`+`reply` 사전 포함 금지; update(답변)=`payManager()`; delete=`payManager()` or 본인 미답변 취소. 필드 `{uid,author,slipKey,ym,company,text,createdAt,status:'open'\|'answered',reply:{text,by,date}}` — 내 명세서 행 '이의제기' 버튼(`payOpenInquiry`) → 폼 접수(`paySubmitInquiry`) → 담당자 문의함(`payRenderInquiryInbox`, 미답변 배지)에서 답변(`payReplyInquiry`)·삭제 |
| `companyCalendar/{id}` | staff 회사운영 캘린더(주요회사운영) | `permFor('company')` |
| `leaveSchedule/{id}` | staff 직원게시판 **연월차일정** 캘린더 | read/create=`isEmployee()`; update/delete=`permFor('leaveSchedule')` or `permFor('leaveApprove')` |
| `appConfig/{memberOrder\|asAssignees\|leaveApprovals}` | staff | `memberOrder`=admin; `asAssignees`(A/S 출동담당자 목록)=`permFor('asAssignee')`; `leaveApprovals`(연월차 월별 결재 `{months:{'YYYY-MM':{hq:{title,name,date},factory:{…}}}}`)=`permFor('leaveApprove')` or `permFor('leaveApproveFactory')` |

### Staff Page (`hanaro/staff/staff.html`) — detail in `hanaro/staff/CLAUDE.md`

`staff.html` is one ~15.5k-line file holding every employee tool, and its module notes are **half of this document's former size**, so they live in **`hanaro/staff/CLAUDE.md`** — automatically loaded when you work in that directory. Read it before editing `staff.html`; skip it entirely otherwise. It covers:

- **Permissions** (`users.permissions`, `userCan(area)` / `asrPerm()`, `PERM_AREAS`, the 권한설정 modal) — which gates are client-only vs. enforced in the Firestore rules.
- **연월차일정 캘린더** — the calendar engine shared with 주요회사운영, 월별 결재 도장, and the per-group month lock.
- **Staff page modules** — 운영관리 셸 (인사관리·급여명세서·일정관리·자재관리·재고현황), 활동사진첩, the rich-text board editor, 게시판 검색, and A/S 처리결과 결재선.

The Firestore collections these modules write to, and their access rules, stay in the table above — that table is the index for `Firestore_보안규칙_완성본.txt` edits, which happen from outside `hanaro/staff/`.

### External Libraries (CDN)

- **Firebase 10.7.1** — compat mode (`firebase-app-compat.js`, etc.)
- **SheetJS xlsx-0.20.1** — Excel parsing/writing. Used by `school.html` (delivery list upload) and `staff.html` (자재관리·재고현황·일정관리 Excel import/export).
- **Tabulator.js 6.3.x** — Spreadsheet/table UI. Used by `school.html` (delivery list) and `staff.html` 자재관리. `hanaro/lib/tabulator/` + `hanaro/school/lib/tabulator/` are local fallbacks.
- **DOMPurify 3.1.6** — HTML sanitizer (jsDelivr CDN), loaded by `staff.html` for the board write rich-text editor. `rteSanitize()` falls back to tag-stripped plain text if it fails to load, so missing CDN degrades safely (loses formatting, never injects).

### Key Patterns

- **Board writes go through `commitBoardChange(board, mutator)` (Firestore transaction), NOT the old whole-array `savePosts`.** `staffPosts/{board}` stores all of a board's posts in one `posts` array and clients load it one-shot (no live listener). The legacy `savePosts(board)` did `doc.set({posts: allPosts[board]})` from the *local* copy, so a stale client re-saving (notably `viewPost` re-saving on every view to bump 조회수) would clobber posts others had added since page load — attachments "disappeared over time". `commitBoardChange` re-reads the server array inside a transaction and applies `mutator(serverPosts)` so concurrent additions survive. Posts carry a stable `id` (`makePostId`); identity is `postMatches` (id, else title+author+date). Modal edit/delete resolve the target by reference (`currentPostRef`/`editingPostRef`), not by a possibly-shifted index. **Don't reintroduce full-array `set()` for post mutations.** Attachments must go to Storage via `uploadFilesToStorage` (URL only in the doc) — never embed base64 in the Firestore doc when `db` exists (1MB limit → silent loss); base64 fallback is allowed only in pure-local `!db` dev mode. Post attachments live in THREE parallel arrays — `files` (names), `fileUrls` (index-aligned URLs), `fileData` (objects, matched by name) — any mutation must keep them in sync: the edit form's existing-attachment ✕ buttons reserve removals in `editRemovedFiles` (`{idx,name,url}`) and `submitPost`'s edit transaction removes matched entries from all three against the server-fresh post (re-finding by name+URL if indices shifted; cancel = no change; Storage originals are intentionally left in place).
- **Storage 업로드는 반드시 `cacheControl`을 지정한다 (2026-08-04)** — 지정하지 않으면 캐시 지시가 없어 브라우저가 파일을 **방문할 때마다 다시 받는다**(활동사진첩 80KB 썸네일이 매번 늦게 뜨던 원인). 파일명이 매번 유일한 경로(`activity-photos`·`as-result-files`·`as-files`·`hr-photos`·`schedule-images`)는 **1년 immutable** — 내용이 바뀌면 새 파일명·새 URL이 되므로 안전하다. 개인정보성 파일(`as-files` 신청서 첨부, `hr-photos`)은 `private`(브라우저만, 공용 캐시 금지), **급여명세 `pay-slips`는 `private, no-store`**(공용 PC 캐시 잔존 방지 — 열 때마다 재다운로드). **예외: `school-list/school-list.xlsx`는 파일명이 고정(덮어쓰기)이라 `no-cache`(매번 재검증)** — 여기에 장기 캐시를 걸면 옛 납품학교 명단이 계속 보인다. 상수는 staff.html의 `STORAGE_CACHE_PUBLIC`/`STORAGE_CACHE_PRIVATE`, 사진첩은 `PHOTO_CACHE_CONTROL`. 이미 올라간 파일은 헤더가 없으므로 사진첩은 관리자용 `optimizeExistingPhotos()` 2단계(`photoFixCacheHeader`: getMetadata → updateMetadata, **다운로드 URL 유지**)가 보정하고, 다른 경로는 `gsutil setmeta`로 일괄 처리한다.
- All pages re-include the Firebase SDK scripts individually (no shared loader).
- `sessionStorage` keys: `loggedInUser` (JSON), `loggedIn` ("true"), `lastLoginTime`, `lastLoginMessage`. `localStorage` keys: `savedLoginId` (아이디 저장).
- `setLoggedInState(bool, userData)` is the single function that toggles login/logout UI across the page; it has protective logic that blocks `false` calls when sessionStorage shows the user is still logged in (to handle Firebase Auth restore delay on page load).
- `window.checkStaffAccess` is a hook that `staff.html` registers to enforce access control; `auth.js` calls it after every auth state change.
- **Modal close buttons are pill-style text buttons** (알약형 "닫기", e.g. `.as-close-pill`, `.asr-close-pill`, `border-radius:999px`), unified app-wide — don't add round `×` icon close buttons to new modals.
- **Centered dialogs (staff.html)**: native `alert`/`confirm`/`prompt` are replaced by centered popups. `window.alert` is globally overridden by `showStaffAlertPopup`; use `await showStaffConfirm(msg)` (Promise<bool>, so the enclosing fn must be `async`) instead of `confirm`, and `await showStaffPrompt(msg, def)` instead of `prompt`. `showStaffDonePopup` / AS.html `showAsDonePopup` are success toasts. Don't reintroduce native dialogs.
- **XSS**: user-supplied values (post titles, member 소속/이름/이메일, file names, photo titles) must be escaped before `innerHTML`. Reuse the local escape helpers already present (`asEsc`, `photoEsc`, `schedEsc`, per-render `esc`). Prefer `textContent` where no markup is needed. Values placed inside `onclick="...('${x}')"` need JS-string escaping too, not just HTML escaping.

## Docs

`docs/` contains Korean-language guides for Firebase configuration, organized into `firebase-storage/`, `firestore/`, `guides/`, `planning/` (feature plans, e.g. OpenAI 연동 기획안), `security-rules/`, and `troubleshooting/`. These are reference documents, not generated output — edit them when procedures change.

`docs/개발일지.md` is the running dev log (newest entries on top). Append a dated section there when you make notable changes.

`docs/작업현황.md` is the cross-device handover doc (current state, pending work). Because `docs/` is untracked, it travels between machines via iCloud sync only — read it when resuming work from another device, and update it at the end of a work session.

Note that some files are duplicated between the repo root and `docs/` (e.g. `Firestore_보안규칙_완성본.txt`, `Firebase_Storage_CORS_설정_가이드.md`). The root `Firestore_보안규칙_완성본.txt` is the canonical copy that gets pasted into the Firebase Console; `docs/security-rules/rules/` holds historical staged versions (1단계/2단계/3단계).
