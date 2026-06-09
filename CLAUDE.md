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
  js/router.js          ← SPA route handler + School section logic
  css/common.css        ← Shared design system
  css/auth.css          ← Login modal styles
  AS/AS.html            ← A/S 신청 페이지
  Gallery/Gallery.html  ← 갤러리
  company/company.html  ← 회사 소개
  product/product.html  ← 제품 목록
  school/school.html    ← 납품학교 리스트 (로그인 필요)
  staff/staff.html      ← 임직원 전용 게시판 (임직원/관리자만)
  lib/tabulator/        ← Locally bundled Tabulator.js (fallback)
```

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

New registrations are created with `status: 'pending'` and require admin approval before login works. Employee buttons (`#employee-button`, `.employee-button`) are `disabled` for non-employees.

### External Libraries (CDN)

- **Firebase 10.7.1** — compat mode (`firebase-app-compat.js`, etc.)
- **SheetJS xlsx-0.20.1** — Excel file parsing (school delivery list upload)
- **Tabulator.js 6.3.x** — Spreadsheet/table UI (`hanaro/lib/tabulator/` is a local fallback)

### Key Patterns

- All pages re-include the Firebase SDK scripts individually (no shared loader).
- `sessionStorage` keys: `loggedInUser` (JSON), `loggedIn` ("true"), `lastLoginTime`, `lastLoginMessage`.
- `setLoggedInState(bool, userData)` is the single function that toggles login/logout UI across the page; it has protective logic that blocks `false` calls when sessionStorage shows the user is still logged in (to handle Firebase Auth restore delay on page load).
- `window.checkStaffAccess` is a hook that `staff.html` registers to enforce access control; `auth.js` calls it after every auth state change.

## Docs

`docs/` contains Korean-language guides for Firebase configuration (Firestore security rules, Storage CORS, troubleshooting). These are reference documents, not generated output — edit them when procedures change.
