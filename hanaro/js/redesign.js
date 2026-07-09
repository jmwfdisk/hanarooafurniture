/* redesign.js — index의 Function 스타일 네비바/안내바/모바일 드로어를 서브페이지에 공용 적용.
   각 서브페이지에 <script src="../js/redesign.js?v=..."> 한 줄만 추가하면 됨. 되돌리려면 태그 제거.
   home(index.html)는 인라인으로 이미 적용돼 있어 이 스크립트를 넣지 않는다. */
(function(){
  if (window.__fhRedesignShared) return; window.__fhRedesignShared = true;
  var CSS = `:root{
        --fh-paper:#F6F4EF; --fh-paper-2:#FBFAF7; --fh-card:#FFFFFF;
        --fh-ink:#1D1D1F; --fh-ink-soft:#5B5B5F; --fh-line:#E7E3DA;
        --fh-green:#1F5C3D; --fh-green-2:#2E7D52; --fh-green-soft:#EAF1EC;
        --fh-radius:20px;
      }
      body{ background:var(--fh-paper); color:var(--fh-ink);
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Pretendard","Apple SD Gothic Neo",Roboto,"Noto Sans KR",sans-serif;
        -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }

      /* 히어로: 영상 위 스크림 + 정제된 타이포 */
      .main2-section::after{ content:""; position:absolute; inset:0; z-index:2; pointer-events:none;
        background:linear-gradient(180deg, rgba(10,15,12,.28) 0%, rgba(10,15,12,0) 30%, rgba(10,15,12,.10) 62%, rgba(10,15,12,.55) 100%); }
      .main2-content{ z-index:3; }
      .main2-title{ font-weight:600!important; letter-spacing:-.5px!important;
        font-size:clamp(22px,5vw,60px)!important; text-shadow:0 2px 24px rgba(0,0,0,.38)!important; }
      .main2-subtitle{ font-style:normal!important; font-weight:400!important;
        text-transform:uppercase; letter-spacing:.28em!important; opacity:.92;
        font-size:clamp(12px,1.6vw,15px)!important; margin-top:14px!important;
        text-shadow:0 1px 12px rgba(0,0,0,.4)!important; }

      /* 히어로 카테고리 버튼: 프로스티드 화이트 알약 */
      .main2-buttons .product-button{
        background:rgba(255,255,255,.16)!important; color:#fff!important;
        border:1px solid rgba(255,255,255,.55)!important; border-radius:999px!important;
        backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
        box-shadow:0 6px 22px rgba(0,0,0,.16)!important; font-weight:600!important;
        transition:background .25s ease,transform .25s ease,box-shadow .25s ease!important; }
      .main2-buttons .product-button:hover{
        background:#fff!important; color:var(--fh-green)!important;
        transform:translateY(-2px)!important; box-shadow:0 10px 28px rgba(0,0,0,.22)!important; }
      .main2-buttons .product-button::before{ display:none!important; }

      /* 에디토리얼 인트로 밴드 — 좌측 우수제품 이미지 배경 + 우측 정렬 텍스트 */
      /* 이미지를 섹션 배경으로 깔고 오른쪽을 흰색 페이드 → 세로 경계 없이 자연스럽게(이음새 제거) */
      .fh-intro{ position:relative; overflow:hidden; padding:clamp(56px,7vw,100px) 24px;
        background:
          linear-gradient(90deg, rgba(246,244,239,0) 36%, var(--fh-paper) 50%),
          url('./image/h-hero.png') left center / auto 104% no-repeat,
          var(--fh-paper); }
      .fh-intro-media{ display:none; }
      /* 창이 넓어지면 콘텐츠가 우측 끝에 붙도록: 중앙정렬 제거, 우측 컬럼 고정폭 앵커 */
      .fh-intro-inner{ display:grid; grid-template-columns:1fr minmax(0, 640px);
        column-gap:72px; align-items:center; }
      .fh-intro-text{ grid-column:2; text-align:right; }
      .fh-eyebrow{ display:inline-block; font-size:12px; font-weight:700; letter-spacing:.22em;
        text-transform:uppercase; color:var(--fh-green-2); margin:0 0 18px; }
      .fh-h2{ font-size:clamp(28px,4.4vw,50px); line-height:1.16; letter-spacing:-.6px;
        font-weight:600; color:var(--fh-ink); margin:0 0 20px; word-break:keep-all; }
      .fh-lead{ font-size:clamp(16px,1.7vw,19px); line-height:1.75; color:var(--fh-ink-soft); word-break:keep-all;
        margin:0 0 44px; }
      /* 인트로 영상보기 버튼(설명문 아래) */
      .fh-video-wrap{ margin:0 0 40px; }
      .fh-video-btn{ display:inline-flex; align-items:center; gap:9px; padding:12px 24px; border-radius:999px;
        background:var(--fh-sky); color:#fff!important; font-size:15px; font-weight:650; letter-spacing:-.2px;
        text-decoration:none; transition:background .2s ease, transform .2s ease; }
      .fh-video-btn:hover{ background:var(--fh-sky-2); transform:translateY(-1px); }
      .fh-video-btn svg{ width:15px; height:15px; }
      .fh-cards{ display:grid; grid-template-columns:repeat(3,1fr); gap:20px; text-align:left; }
      /* 모바일: 좌측 이미지 배경 해제(세로 스택), 텍스트는 우측 정렬 유지 */
      /* 1200px 이하: 2단 좁아짐 방지 → 세로 스택(이미지 숨김·콘텐츠 전체폭) */
      @media (max-width:1200px){
        .fh-intro{ padding:clamp(48px,8vw,80px) 24px; background:var(--fh-paper); }
        .fh-intro-inner{ grid-template-columns:1fr; max-width:1000px; margin:0 auto; }
        .fh-intro-text{ grid-column:1; text-align:right; }
      }
      .fh-card{ background:var(--fh-card); border:1px solid var(--fh-line); border-radius:var(--fh-radius);
        padding:30px 28px; text-align:center; }  /* 카드 내부 텍스트 중앙정렬, 호버효과 없음 */
      .fh-card-k{ display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px;
        border-radius:12px; background:var(--fh-green-soft); color:var(--fh-green); margin-bottom:18px; }
      .fh-card-k svg{ width:22px; height:22px; }
      .fh-card h3{ font-size:19px; font-weight:650; letter-spacing:-.2px; color:var(--fh-ink); margin:0 0 8px; }
      .fh-card p{ font-size:15px; line-height:1.65; color:var(--fh-ink-soft); margin:0; }
      @media (max-width:768px){ .fh-cards{ grid-template-columns:1fr; } }

      /* 파트너 로고 스트립: 여백 넓힌 그레이스케일 */
      .partner-logos{ background:var(--fh-paper-2)!important; border-color:var(--fh-line)!important;
        gap:34px!important; padding:40px 24px!important; }
      .partner-logos a{ background:transparent!important; box-shadow:none!important; }
      .partner-logos img{ filter:grayscale(1); opacity:.6; transition:filter .25s ease,opacity .25s ease; }
      .partner-logos a:hover img{ filter:grayscale(0); opacity:1; }
      .partner-logos a::before{ display:none!important; }

      /* ── 네비바 (Function 스타일): 상단 하늘색 안내바 + 히어로 위 다크 글래스 플로팅 바 ── */
      :root{ --fh-sky:#3FA9DC; --fh-sky-2:#2E97CC; }

      /* 상단 안내바 (하늘색) */
      .fh-topbar{ position:fixed; top:0; left:0; right:0; height:46px; z-index:1102;
        transition:transform .32s ease;
        display:flex; align-items:center; justify-content:center; padding:0 16px;
        background:var(--fh-sky); }
      .fh-topbar a{ color:#fff; font-size:15px; font-weight:600; text-decoration:underline;
        text-underline-offset:3px; letter-spacing:-.2px; white-space:nowrap;
        overflow:hidden; text-overflow:ellipsis; max-width:100%; }
      body{ padding-top:46px; }  /* 안내바 높이 확보 */
      .fh-topbar.fh-hide{ transform:translateY(-100%); }

      /* 히어로 위에 떠 있는 다크 글래스 라운드 네비 */
      .navbar{ position:fixed!important; top:58px; left:22px; right:22px; width:auto!important;
        height:64px!important; border-radius:18px;
        background:rgba(20,26,30,.42)!important;
        -webkit-backdrop-filter:blur(16px) saturate(1.3); backdrop-filter:blur(16px) saturate(1.3);
        border:1px solid rgba(255,255,255,.16)!important;
        box-shadow:0 14px 36px rgba(0,0,0,.22)!important;
        padding:0 52px 0 34px!important; z-index:1101; transition:background .3s ease, top .32s ease; }  /* 좌우 여백 여유·동일 */
      .navbar.fh-scrolled{ background:rgba(16,20,24,.72)!important; }
      .navbar.fh-topup{ top:12px; }

      /* 로고·로그인 아이콘 화이트 반전(로고가 어두워 다크 글래스에서 안 보임) */
      .navbar .logo img{ filter:brightness(0) invert(1); height:34px!important; }
      /* 데스크탑 로그인/로그아웃: 아이콘 대신 텍스트 버튼(Function 'Log in' 스타일) */
      .navbar .login .login-icon{ display:none!important; }
      .navbar .login .fh-authtext{ display:inline; color:#fff!important; font-size:15px; font-weight:600; letter-spacing:-.2px; }
      #login-link, #logout-link{ padding:8px 10px!important; }
      .navbar .login a:hover .fh-authtext{ opacity:.78; }
      /* 내 정보 알약: 다크 네비바에서 잘 보이게(흰 글씨·프로스티드 아웃라인) */
      .navbar #mypage-link{ background:rgba(255,255,255,.18)!important; color:#fff!important; border:1px solid rgba(255,255,255,.5)!important; }
      .navbar #mypage-link:hover{ background:rgba(255,255,255,.3)!important; }

      /* 흰색 네비 링크 */
      .navbar > div > a{ color:#fff!important; font-size:15px!important; font-weight:500!important;
        letter-spacing:-.1px!important; padding:8px 12px!important; border-radius:999px!important;
        transition:color .2s ease, background .2s ease!important; }
      .navbar > div > a:hover{ color:#fff!important; background:rgba(255,255,255,.18)!important; }

      /* ── 네비 메가 드롭다운: 메뉴 호버 시 보조메뉴 패널 (데스크탑 전용, Function 스타일) ── */
      @media (min-width:1201px){
        /* 페이지 기존 '.navbar > div{position:relative}' 규칙이 더 특이도 높아 !important 필수 */
        .fh-mega{ position:absolute!important; top:100%!important; left:-1px!important; right:-1px!important;
          margin:0!important; padding:0!important; pointer-events:none; }
        .fh-mega.open{ pointer-events:auto; }
        /* 열림 동안: 글래스 플로팅 바가 사라지고 네비바 자체가 전폭 파란 시트로 변신(닫히면 원복).
           left/right는 트랜지션 없이 즉시 확장 — JS가 확장 후 최종 레이아웃에서 메뉴 x좌표를 측정해 보조메뉴를 정렬.
           !important: 서브페이지 자체 CSS의 'transition:all'이 남으면 확장이 애니메이션돼 측정이 빗나감 */
        .navbar{ transition:background .3s ease, top .32s ease, border-radius .22s ease!important; }
        .navbar.fh-mega-open{ background:var(--fh-paper)!important;
          left:0!important; right:0!important; top:46px!important; border-radius:0;
          /* 플로팅 인셋을 패딩에 합산 → 확장돼도 로고·메뉴·로그인 위치가 글래스 상태와 동일
             (좌 22px, 우 22px, 위 8px) */
          padding:8px 74px 0 56px!important; height:72px!important;
          -webkit-backdrop-filter:none; backdrop-filter:none;
          border-color:transparent!important; box-shadow:none!important; }
        .navbar.fh-topup.fh-mega-open{ top:0!important; }  /* 스크롤로 안내바 숨은 상태에서 열리면 최상단 부착 */
        /* 크림 시트 위 다크 콘텐츠: 메뉴·로고·로그인 텍스트를 잉크색으로 반전 */
        .navbar.fh-mega-open > div > a{ color:var(--fh-ink)!important; }
        .navbar.fh-mega-open .logo img{ filter:none!important; }
        .navbar.fh-mega-open .login .fh-authtext{ color:var(--fh-ink)!important; }
        .navbar.fh-mega-open #mypage-link{ background:rgba(0,0,0,.05)!important;
          color:var(--fh-ink)!important; border-color:rgba(0,0,0,.22)!important; }
        .fh-mega-panel{ background:var(--fh-paper); border:none; border-radius:0; position:relative;
          box-shadow:0 22px 40px rgba(0,0,0,.16); padding:14px 24px 30px;
          opacity:0; transform:translateY(-8px); visibility:hidden;
          transition:opacity .22s ease, transform .22s ease, visibility 0s linear .22s; }
        .fh-mega.open .fh-mega-panel{ opacity:1; transform:translateY(0); visibility:visible; transition-delay:0s; }
        /* 보조메뉴 열림 동안 페이지 음영(딤) — 네비바(1101) 아래, 콘텐츠 위 */
        .fh-mega-dim{ position:fixed; inset:0; background:rgba(15,23,32,.45); z-index:1090;
          opacity:0; visibility:hidden; transition:opacity .3s ease, visibility 0s linear .3s; }
        .fh-mega-dim.on{ opacity:1; visibility:visible; transition-delay:0s; }
        /* 네비 메뉴줄 ↔ 보조메뉴줄 구분선: 네비바 플로팅 좌우 여백(22px)만큼 들여 화면 끝에 안 닿게 */
        .fh-mega-panel::before{ content:""; position:absolute; top:0; left:22px; right:22px; height:1px;
          background:var(--fh-line); }
        /* 보조메뉴는 호버한 메뉴 아래 세로 정렬, 시작점(x)은 JS가 호버 메뉴 좌표로 갱신 */
        .fh-mega-links{ display:flex; flex-direction:column; align-items:flex-start; gap:2px; padding-left:56px; }
        /* 글씨 크기·굵기·자간은 네비바 메뉴(.navbar > div > a)와 동일하게 통일 */
        .fh-mega-links a{ display:block; position:relative; padding:8px 0; font-size:15px; font-weight:500;
          letter-spacing:-.1px; color:var(--fh-ink)!important; text-align:left; white-space:nowrap;
          text-decoration:none!important; }
        /* 호버 밑줄: 좌→우로 그려지는 애니메이션 */
        .fh-mega-links a::after{ content:""; position:absolute; left:0; bottom:3px; width:100%; height:2px;
          background:rgba(29,29,31,.85); transform:scaleX(0); transform-origin:left center;
          transition:transform .8s cubic-bezier(.25,.8,.25,1); }
        .fh-mega-links a:hover::after{ transform:scaleX(1); }
        /* 열림 동안 메뉴 알약(호버 하이라이트) 제거 — 크림 시트 위에서는 플랫하게 */
        .navbar.fh-mega-open > div > a:hover,
        .navbar > div > a.fh-mega-on{ background:transparent!important; color:var(--fh-ink)!important; }
      }

      /* 하늘색 CTA 알약 (Function의 Start testing 대응) */
      /* 데스크탑 네비바에서는 CTA 버튼 숨김(요청) — 모바일 바에서만 노출 */
      .fh-cta-wrap{ display:none; align-items:center; margin-left:6px; }
      .fh-cta{ display:inline-flex; align-items:center; justify-content:center;
        background:var(--fh-sky)!important; color:#fff!important; text-decoration:none;
        font-size:15px; font-weight:650; letter-spacing:-.2px; padding:10px 20px;
        border-radius:999px; white-space:nowrap; transition:background .2s ease, transform .2s ease; }
      .fh-cta:hover{ background:var(--fh-sky-2)!important; transform:translateY(-1px); }

      /* 로그인 아이콘 살짝 정리 */
      /* 데스크탑 정렬: 로고(좌) + 메인메뉴(중앙) + Log in·임직원(우).
         로고 margin-right:auto + 로그인 margin-left:auto → 두 auto가 여백을 반씩 나눠 메뉴 중앙정렬 */
      .navbar > .logo{ margin-right:auto !important; }
      .navbar .login{ gap:6px; margin-left:auto; }

      /* ── 모바일: 로고 왼쪽 / CTA·로그인·햄버거 오른쪽 (Function 모바일) ── */
      @media (max-width:1200px){
        .fh-topbar a{ font-size:12.5px; }
        .navbar.fh-topup{ top:10px!important; }
        .navbar{ top:54px!important; left:14px!important; right:14px!important; width:auto!important; height:58px!important;
          display:flex!important; align-items:center!important; justify-content:flex-start!important;
          gap:8px; padding:0 30px 0 10px!important; }  /* 좌우 시각 여백 균등(로고 투명여백 보정) */
        .navbar .logo{ order:1; margin-right:auto!important; }
        .navbar .logo img{ height:26px!important; }
        /* 기존 '.navbar>div:not(.logo)...{display:none}' 규칙이 CTA도 숨기므로 다시 표시 */
        .fh-cta-wrap{ order:2; margin-left:0; display:flex!important; }
        .fh-cta{ padding:8px 14px; font-size:13.5px; }
        /* 모바일: 로그인은 드로어 메뉴의 '로그인' 버튼으로 통합 → 네비바에서 숨김 */
        .navbar .login{ display:none!important; }
        .hamburger{ order:4; position:relative!important; justify-self:auto!important; margin:0!important; width:26px; height:18px; }
        /* 페이지별 브레이크포인트(staff=1024 등) 차이 보정: ≤1200에서 데스크탑 메뉴 숨김·햄버거 표시 */
        .navbar > div:not(.logo):not(.login):not(.fh-cta-wrap){ display:none!important; }
        .navbar .hamburger{ display:inline-flex!important; }
        .hamburger .bar{ background:#fff!important; }
        /* 햄버거 2줄(가운데 바 숨김, Function 스타일) */
        .hamburger .bar:nth-child(2){ display:none!important; }
        .hamburger .bar:nth-child(1){ top:4px!important; }
        .hamburger .bar:nth-child(3){ bottom:4px!important; }
        /* 임직원 버튼은 모바일 바에서 숨김(공간 확보) */
        .navbar .login .employee-btn, .navbar .employee-btn{ display:none!important; }

        /* ── 우측 절반 패널 메뉴 (Function 스타일, 좌측은 딤 처리) ── */
        .mobile-drawer{ top:0!important; bottom:0!important; left:auto!important; right:0!important;
          width:clamp(320px,56%,560px)!important; max-width:560px!important;
          height:auto!important;  /* top+bottom로 뷰포트 높이 고정 → 넘치면 스크롤(모바일 툴바에도 안 잘림) */
          background:#FAF8F3!important; box-shadow:-8px 0 30px rgba(0,0,0,.18)!important;
          transform:translateX(100%)!important;
          padding:56px 26px calc(40px + env(safe-area-inset-bottom, 0px))!important; gap:0!important;
          z-index:1200!important; overflow-y:auto!important; -webkit-overflow-scrolling:touch;
          overscroll-behavior:contain; box-sizing:border-box; }
        .mobile-drawer.open{ transform:translateX(0)!important; }
        /* 메뉴 열리면 좌측(네비바 포함)까지 딤: 오버레이를 네비/안내바 위로 올림 */
        .overlay.menu-open{ z-index:1150!important; }
        .fh-drawer-close{ position:absolute; top:16px; right:18px; width:42px; height:42px; border:none;
          background:transparent; font-size:30px; line-height:1; color:var(--fh-ink); cursor:pointer; }
        .mobile-drawer a{ border-bottom:none!important; }
        .fh-drawer-links{ display:flex; flex-direction:column; gap:4px; }
        .fh-drawer-links a{ font-size:21px!important; font-weight:650!important; color:var(--fh-ink)!important;
          padding:8px 0!important; letter-spacing:-.4px; }
        .fh-drawer-links a:active{ color:var(--fh-sky)!important; }
        .fh-drawer-cta{ display:flex; flex-direction:column; gap:12px; margin-top:20px; }
        html[data-auth="in"] .fh-dlogin{ display:none!important; }
        html[data-auth="out"] .fh-dlogout{ display:none!important; }
        .fh-drawer-cta .fh-cta{ width:100%; padding:15px; font-size:16px; }
        .fh-drawer-login{ display:flex; align-items:center; justify-content:center; width:100%; padding:12px;
          border-radius:999px; border:none; color:var(--fh-sky)!important; background:#fff;
          font-size:16px; font-weight:650; text-decoration:none; }
        .fh-drawer-hr{ border:none; border-top:1px solid var(--fh-line); margin:26px 0 16px; }
        .fh-drawer-info{ margin-top:0; display:flex; flex-direction:column; gap:14px; }
        .fh-drawer-info a{ font-size:15px!important; color:var(--fh-ink-soft)!important; font-weight:500!important;
          display:flex; align-items:center; gap:10px; padding:2px 0!important; }
        .fh-drawer-info a b{ color:var(--fh-ink); font-weight:650; }
        /* Contact us 아웃라인 버튼(이미지7) — 콘텐츠 폭, 좌측 정렬 */
        .fh-drawer-info .fh-contact-btn{ display:inline-flex!important; align-self:flex-start; align-items:center; gap:10px;
          padding:12px 20px!important; border:none; border-radius:999px; background:#fff;
          color:var(--fh-ink)!important; font-size:15px!important; font-weight:600!important; text-decoration:none; }
        .fh-drawer-info .fh-contact-btn svg{ width:20px; height:20px; color:var(--fh-sky); flex:0 0 auto; }
        .fh-drawer-info .fh-contact-btn:hover{ background:#f2f2ef; }
        /* border-bottom:none 규칙이 알약 버튼 아래테두리까지 지워 '잘려' 보이던 것 복원 */
        /* Contact us + 임직원 나란히 */
        .fh-drawer-btnrow{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .fh-drawer-staff{ text-decoration:none; display:inline-flex; }
        .fh-drawer-staff button.employee-button{ padding:12px 20px!important; border:none!important;
          border-radius:999px!important; background:#fff!important; color:var(--fh-ink)!important; font-size:15px!important;
          font-weight:600!important; cursor:pointer; font-family:inherit; line-height:1!important; box-shadow:none!important; transform:none!important; }
        .fh-drawer-staff button.employee-button:not(:disabled):hover{ background:#f2f2ef!important; }
        .fh-drawer-staff button.employee-button:disabled{ color:#b8b8bb!important; background:#efeeeb!important; cursor:not-allowed; }
        /* 드로어 내부 스크롤 보장(로그인 버튼 하단 잘림 방지) */
        .mobile-drawer{ overflow-y:auto!important; -webkit-overflow-scrolling:touch; }
        .fh-drawer-login{ flex:0 0 auto; }
        .fh-drawer-info .fh-addr{ font-size:13.5px; color:var(--fh-ink-soft); margin:4px 0 0; line-height:1.5; }
      }
      /* 서브페이지 상단 여백 */
      html.fh-sub body{ padding-top:132px!important; }
      @media (max-width:1200px){ html.fh-sub body{ padding-top:116px!important; } }
`;
  var CONTACT_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10.5h6M8 13.5h4"/><path d="M4 5.5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-3.5 3v-3H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z"/><path d="M17 9h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3.5-3"/></svg>`;
  var st=document.createElement('style'); st.id='fh-redesign'; st.textContent=CSS;
  (document.head||document.documentElement).appendChild(st);
  document.documentElement.classList.add('fh-sub');

  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn,{once:true}); else fn(); }
  ready(function(){
    var navbar=document.querySelector('header.navbar')||document.querySelector('.navbar');
    if(!navbar) return;

    // 상단 안내바
    if(!document.querySelector('.fh-topbar')){
      var tb=document.createElement('div'); tb.className='fh-topbar';
      tb.innerHTML='<a href="https://shop.g2b.go.kr/" target="_blank" rel="noopener">나라장터 종합쇼핑몰에서 하나로오에이퍼니처 제품을 만나보세요</a>';
      document.body.insertBefore(tb, document.body.firstChild);
    }

    // 로그인/로그아웃 아이콘 → 텍스트
    var ll=navbar.querySelector('#login-link');
    if(ll && !ll.querySelector('.fh-authtext')){ var s=document.createElement('span'); s.className='fh-authtext'; s.textContent='Log in'; ll.appendChild(s); }
    var lo=navbar.querySelector('#logout-link');
    if(lo && !lo.querySelector('.fh-authtext')){ var s2=document.createElement('span'); s2.className='fh-authtext'; s2.textContent='Log out'; lo.appendChild(s2); }

    // CTA "제품 라인업" (login 앞)
    var login=navbar.querySelector('.login');
    if(login && !navbar.querySelector('.fh-cta-wrap')){
      var cw=document.createElement('div'); cw.className='fh-cta-wrap';
      cw.innerHTML='<a class="fh-cta" href="../product/product.html">제품 라인업</a>';
      login.parentNode.insertBefore(cw, login);
    }

    // 모바일 드로어 재구성 + body 직속 이동
    var drawer=document.getElementById('mobile-nav');
    if(drawer){
      var links=[].map.call(drawer.querySelectorAll('a'), function(a){ return '<a href="'+a.getAttribute('href')+'">'+a.textContent.trim()+'</a>'; }).join('');
      drawer.innerHTML =
        '<button type="button" class="fh-drawer-close" aria-label="메뉴 닫기" onclick="document.getElementById(\'hamburger\').click()">&times;</button>'+
        '<div class="fh-drawer-links">'+links+'</div>'+
        '<div class="fh-drawer-cta"><a class="fh-drawer-login fh-dlogin" href="#" onclick="if(window.showLogin){showLogin();}return false;">Log in</a><a class="fh-drawer-login fh-dlogout" href="#" onclick="if(window.logout){logout();}return false;">Log out</a></div>'+
        '<hr class="fh-drawer-hr">'+
        '<div class="fh-drawer-info"><div class="fh-drawer-btnrow">'+
          '<a class="fh-contact-btn" href="mailto:oa9500@empas.com">'+CONTACT_SVG+'Contact us</a>'+
          '<a class="fh-drawer-staff" href="../staff/staff.html" onclick="return !this.querySelector(\'.employee-button\').disabled;"><button type="button" class="employee-button" disabled>임직원</button></a>'+
        '</div><p class="fh-addr">대전광역시 대덕구 오정로 41번길 12<br>(주)하나로오에이퍼니처</p></div>';
      if(drawer.parentNode!==document.body) document.body.appendChild(drawer);
    }

    // 데스크탑 메가 드롭다운: 메뉴 호버 시 보조메뉴 패널(패널 링크는 각 메뉴 a의 href 기준 상대 해석)
    if(!navbar.querySelector('.fh-mega')){
      var MEGA={
        '회사소개':[['인사말','?sec=intro'],['일반현황','?sec=status'],['주요연혁','?sec=history'],['우수제품인증서','?sec=cert-excellent'],['기술(성능) / 기타 인증서','?sec=cert-tech'],['로고 ・ CI','?sec=logo-ci']],
        '제품소개':[['H시리즈','h.html'],['HS시리즈','hs.html'],['OA시리즈','oa.html']],
        '제품 라인업':[['우수제품','?category=우수제품'],['일반제품','?category=일반제품'],['사물함','?category=사물함'],['색상표','?category=색상표']],
        '고객지원':[['수리 및 서비스','repair.html'],['자주묻는 질문','faq.html'],['관리하기','manage.html']]
      };
      var mw=document.createElement('div'); mw.className='fh-mega';
      mw.innerHTML='<div class="fh-mega-panel"><div class="fh-mega-links"></div></div>';
      navbar.appendChild(mw);
      var md=document.createElement('div'); md.className='fh-mega-dim'; document.body.appendChild(md);
      var megaBox=mw.querySelector('.fh-mega-links'), megaCur=null;
      function megaEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
      function megaClose(){ mw.classList.remove('open'); navbar.classList.remove('fh-mega-open'); md.classList.remove('on');
        if(megaCur) megaCur.classList.remove('fh-mega-on'); megaCur=null; }
      function megaOpen(a, items){
        var base=a.getAttribute('href')||'';
        megaBox.innerHTML=items.map(function(it){
          var u = it[1].charAt(0)==='?' ? base.split(/[?#]/)[0]+it[1] : base.replace(/[^\/]*$/,'')+it[1];
          return '<a href="'+megaEsc(u)+'">'+megaEsc(it[0])+'</a>';
        }).join('');
        if(megaCur) megaCur.classList.remove('fh-mega-on');
        megaCur=a; a.classList.add('fh-mega-on'); mw.classList.add('open'); navbar.classList.add('fh-mega-open'); md.classList.add('on');
        // 시트 확장(전폭) 적용 후 최종 레이아웃 기준으로 정렬:
        // 메뉴 텍스트 시작 x(알약 패딩 12px 보정) − 보조메뉴 컨테이너 원점 x(패널 자체 패딩 24px 중복 방지)
        var aRect=a.getBoundingClientRect(), boxRect=megaBox.getBoundingClientRect();
        megaBox.style.paddingLeft = Math.max(0, Math.round(aRect.left + 10 - boxRect.left))+'px';
        // 안전장치: 페이지 자체 transition이 확장을 애니메이션시키는 경우 안정화 후 한 번 더 정렬
        setTimeout(function(){ if(megaCur===a && mw.classList.contains('open')){
          megaBox.style.paddingLeft = Math.max(0, Math.round(a.getBoundingClientRect().left + 10 - megaBox.getBoundingClientRect().left))+'px'; } }, 350);
      }
      [].forEach.call(navbar.children, function(el){
        if(el===mw) return;
        var a=(el.tagName==='DIV' && !el.classList.contains('fh-cta-wrap') && !el.classList.contains('login'))?el.querySelector('a'):null;
        var items=a?MEGA[a.textContent.trim()]:null;
        // 보조메뉴 없는 메뉴(납품학교·갤러리·A/S신청 등)에 호버해도 열린 패널 유지(닫힘은 외부 클릭·스크롤·ESC만)
        el.addEventListener('mouseenter', function(){ if(items) megaOpen(a, items); });
      });
      // 마우스가 떠나도 유지 — 외부 클릭·스크롤·ESC·보조메뉴 클릭 시 닫힘(원래 글래스 네비바로 복귀)
      document.addEventListener('click', function(e){ if(!navbar.contains(e.target)) megaClose(); });
      window.addEventListener('scroll', megaClose, {passive:true});
      mw.addEventListener('click', function(e){ if(e.target.tagName==='A') megaClose(); });
      document.addEventListener('keydown', function(e){ if(e.key==='Escape') megaClose(); });
    }

    // 스크롤 시 안내바 숨김 + 네비 위로
    function onScroll(){
      var away=window.scrollY>40;
      navbar.classList.toggle('fh-scrolled', window.scrollY>8);
      navbar.classList.toggle('fh-topup', away);
      var t=document.querySelector('.fh-topbar'); if(t) t.classList.toggle('fh-hide', away);
    }
    window.addEventListener('scroll', onScroll, {passive:true}); onScroll();
  });
})();
