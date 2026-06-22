/* ============================================================
 * footer-bar.js — 전 페이지 공통 하단 푸터 (전체 재구성)
 * 모든 페이지에서 auth.js 다음에 <script>로 1줄 포함하여 사용.
 * 기존 <footer>의 내용을 교체하여 아래 3단 구조로 렌더링한다.
 *   1) 법인 정보(대표이사/사업자번호/주소/연락처 등)
 *   2) Copyright + 인증마크 로고
 *   3) 링크 메뉴(이메일 무단 수집거부·개인정보처리방침) + SNS 아이콘
 *
 * ▼ 인증마크 이미지: /image/ 폴더에 아래 파일명으로 저장하세요.
 *   누락된 파일은 자동으로 숨겨집니다(onerror).
 *     cert-excellent.png  (조달청 우수조달물품)
 *     cert-patent.png     (특허)
 *     cert-eco.jpg        (친환경 인증)
 *     cert-women.png      (여성기업)
 *     cert-standard.png   (단체표준/SPS)
 *
 * ▼ 운영 시 채워 넣으세요 (현재는 placeholder '#').
 *     YOUTUBE_URL, KAKAO_URL
 * ============================================================ */
(function () {
  'use strict';

  if (window.__footerBarInit) return;        // 중복 주입 방지
  window.__footerBarInit = true;

  // ── 설정 ────────────────────────────────────────────────
  var YOUTUBE_URL = 'https://www.youtube.com/@하나로오에이퍼니처';
  var KAKAO_URL   = '#';   // 예: 'https://pf.kakao.com/_xxxxx'

  var COMPANY = {
    name: '(주)하나로오에이퍼니처',
    fullName: '주식회사 하나로오에이퍼니처',
    ceo: '정진희, 장인덕',
    addr: '대전광역시 대덕구 오정로 41번길 12',
    tel: '042-633-9500',
    asTel: '043-731-9511',
    email: 'oa9500@empas.com',
    biz: '305-81-45158'
  };

  // 인증마크 (파일은 /image/ 에 저장). 누락 시 onerror로 숨김.
  var MARKS = [
    { file: 'cert-excellent.png', alt: '조달청 우수조달물품' },
    { file: 'cert-patent.png',    alt: '특허' },
    { file: 'cert-eco.jpg',       alt: '친환경 인증' },
    { file: 'cert-women.png',     alt: '여성기업' },
    { file: 'cert-standard.png',  alt: '단체표준(SPS)' }
  ];

  // ── 이미지 경로 베이스 계산 (스크립트 자신의 URL 기준) ──
  // index: ./hanaro/js/footer-bar.js, 서브페이지: ../js/footer-bar.js
  // → 어느 경우든 절대 URL은 .../hanaro/js/footer-bar.js 로 해석됨.
  var thisScript = document.currentScript;
  var scriptSrc = thisScript ? thisScript.src : '';
  var IMG_BASE = scriptSrc.replace(/hanaro\/js\/footer-bar\.js.*$/, '') + 'image/';
  if (!/image\/$/.test(IMG_BASE)) IMG_BASE = 'image/'; // 안전장치

  // ── 스타일 ──────────────────────────────────────────────
  var css = '' +
    /* 기존 footer 스타일 무력화 */
    'footer.fbz-footer{background:#fff !important;color:#666 !important;text-align:left !important;' +
      'padding:0 !important;margin-top:0 !important;border-top:1px solid #e5e7eb;width:100%;' +
      'max-width:100%;box-sizing:border-box;}' +
    'footer.fbz-footer::before{display:none !important;}' +
    '.fbz-foot{font-family:inherit;color:#666;}' +
    '.fbz-foot-inner{padding:26px 20px 30px;box-sizing:border-box;}' +
    /* 1) 법인 정보 */
    '.fbz-legal{display:flex;flex-direction:column;gap:8px;}' +
    '.fbz-legal p{margin:0;font-size:13px;line-height:1.7;color:#888;' +
      'word-break:keep-all;overflow-wrap:break-word;}' +
    '.fbz-legal .fbz-sep2{display:inline-block;width:1px;height:11px;background:#d8d8d8;' +
      'margin:0 10px;vertical-align:middle;}' +
    '.fbz-div{border:none;border-top:1px solid #eee;margin:20px 0;}' +
    /* 2) Copyright + 인증마크 */
    '.fbz-copy-row{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;}' +
    '.fbz-copy{font-size:13px;color:#999;}' +
    '.fbz-marks{display:flex;align-items:center;justify-content:flex-end;gap:16px;flex-wrap:wrap;}' +
    '.fbz-marks img{height:36px;width:auto;max-width:84px;object-fit:contain;display:block;' +
      'opacity:.95;transition:opacity .15s ease,transform .15s ease;}' +
    '.fbz-marks img:hover{opacity:1;transform:scale(1.04);}' +
    /* 3) 링크 + SNS */
    '.fbz-bottom{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;}' +
    '.fbz-left{display:flex;flex-direction:column;gap:12px;min-width:0;}' +
    '.fbz-brand{font-weight:700;font-size:15px;color:#222;}' +
    '.fbz-links{display:flex;flex-wrap:wrap;align-items:center;}' +
    '.fbz-links a{color:#555;font-size:14px;text-decoration:none;padding:2px 0;cursor:pointer;}' +
    '.fbz-links a:hover{color:#111;text-decoration:underline;}' +
    '.fbz-links .fbz-strong{font-weight:700;color:#222;}' +
    '.fbz-sep{display:inline-block;width:1px;height:12px;background:#d0d0d0;margin:0 14px;}' +
    '.fbz-right{display:flex;flex-direction:column;align-items:flex-end;gap:12px;}' +
    '.fbz-right-title{font-size:14px;color:#555;}' +
    '.fbz-social{display:flex;align-items:center;gap:12px;}' +
    '.fbz-ico{width:38px;height:38px;border-radius:50%;background:#111;display:flex;' +
      'align-items:center;justify-content:center;transition:background .15s ease;}' +
    '.fbz-ico:hover{background:#3b4453;}' +
    '.fbz-ico svg{width:20px;height:20px;fill:#fff;}' +
    /* 모바일 */
    '@media (max-width:768px){' +
      '.fbz-foot-inner{padding:20px 20px 24px;}' +
      '.fbz-copy-row{flex-direction:column;align-items:flex-start;gap:16px;}' +
      '.fbz-marks{gap:12px;justify-content:flex-start;}' +
      '.fbz-marks img{height:30px;max-width:70px;}' +
      '.fbz-bottom{flex-direction:column;gap:16px;}' +
      '.fbz-right{align-items:flex-start;}' +
    '}' +
    /* 모달 */
    '.fbz-modal{display:none;position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.5);' +
      'align-items:center;justify-content:center;padding:20px;box-sizing:border-box;}' +
    '.fbz-modal.open{display:flex;}' +
    '.fbz-modal-card{background:#fff;border-radius:14px;max-width:640px;width:100%;' +
      'max-height:85vh;overflow-y:auto;padding:26px 28px;box-sizing:border-box;' +
      'box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:left;color:#333;}' +
    '.fbz-modal-card h3{margin:0 0 6px;font-size:20px;color:#222;}' +
    '.fbz-modal-card h4{margin:18px 0 6px;font-size:15px;color:#3b4453;}' +
    '.fbz-modal-card p,.fbz-modal-card li{font-size:14px;line-height:1.7;color:#444;}' +
    '.fbz-modal-card ul{margin:4px 0;padding-left:20px;}' +
    '.fbz-modal-foot{margin-top:22px;text-align:right;}' +
    '.fbz-modal-foot button{background:#3b4453;color:#fff;border:none;border-radius:8px;' +
      'padding:10px 22px;font-size:14px;cursor:pointer;}' +
    '.fbz-modal-foot button:hover{background:#2c333f;}';

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── 아이콘 (inline SVG) ─────────────────────────────────
  var YT_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5A2.7 2.7 0 0 0 2.4 7.2 28 28 0 0 0 2 12a28 28 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z"/></svg>';
  var KAKAO_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2-.2.7-.7 2.5-.8 2.9 0 0 0 .2.1.3.1 0 .2 0 .3-.1.3-.2 3-2 3.5-2.4.4 0 .9.1 1.4.1 5.1 0 9.2-3.3 9.2-7.3S17.1 3 12 3z"/></svg>';

  // ── 마크 HTML ───────────────────────────────────────────
  function marksHtml() {
    return MARKS.map(function (m) {
      return '<img src="' + IMG_BASE + m.file + '" alt="' + m.alt +
        '" onerror="this.style.display=\'none\'">';
    }).join('');
  }

  // ── 전체 푸터 HTML ──────────────────────────────────────
  function footerHtml() {
    return '' +
      '<div class="fbz-foot"><div class="fbz-foot-inner">' +
        // 1) 법인 정보
        '<div class="fbz-legal">' +
          '<p>' + COMPANY.fullName +
            '<span class="fbz-sep2"></span>대표이사 : ' + COMPANY.ceo +
            '<span class="fbz-sep2"></span>사업자등록번호 : ' + COMPANY.biz + '</p>' +
          '<p>사업장주소 : ' + COMPANY.addr +
            '<span class="fbz-sep2"></span>대표전화 : ' + COMPANY.tel +
            '<span class="fbz-sep2"></span>A/S : ' + COMPANY.asTel +
            '<span class="fbz-sep2"></span>이메일 : ' + COMPANY.email + '</p>' +
          '<p>본 사이트의 콘텐츠는 저작권법의 보호를 받으며 무단 전재·복사·배포 등을 금합니다.</p>' +
        '</div>' +
        '<hr class="fbz-div">' +
        // 2) Copyright + 인증마크
        '<div class="fbz-copy-row">' +
          '<div class="fbz-copy">Copyright © 2025 ' + COMPANY.name + '. All Rights Reserved.</div>' +
          '<div class="fbz-marks">' + marksHtml() + '</div>' +
        '</div>' +
        '<hr class="fbz-div">' +
        // 3) 링크 + SNS
        '<div class="fbz-bottom">' +
          '<div class="fbz-left">' +
            '<div class="fbz-brand">' + COMPANY.name + '</div>' +
            '<div class="fbz-links">' +
              '<a id="fbz-email-reject">이메일 무단 수집거부</a>' +
              '<span class="fbz-sep"></span>' +
              '<a id="fbz-privacy" class="fbz-strong">개인정보처리방침</a>' +
            '</div>' +
          '</div>' +
          '<div class="fbz-right">' +
            '<div class="fbz-right-title">' + COMPANY.name + '의 다양한 소식을 만나보세요!</div>' +
            '<div class="fbz-social">' +
              '<a class="fbz-ico" href="' + YOUTUBE_URL + '" target="_blank" rel="noopener" aria-label="유튜브">' + YT_SVG + '</a>' +
              '<a class="fbz-ico" href="' + KAKAO_URL + '" target="_blank" rel="noopener" aria-label="카카오톡 채널">' + KAKAO_SVG + '</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div></div>';
  }

  // ── 모달 ────────────────────────────────────────────────
  var modal;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'fbz-modal';
    modal.innerHTML =
      '<div class="fbz-modal-card">' +
        '<div id="fbz-modal-body"></div>' +
        '<div class="fbz-modal-foot"><button type="button" id="fbz-modal-close">닫기</button></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.id === 'fbz-modal-close') closeModal();
    });
    return modal;
  }
  function openModal(html) {
    ensureModal();
    document.getElementById('fbz-modal-body').innerHTML = html;
    modal.classList.add('open');
  }
  function closeModal() { if (modal) modal.classList.remove('open'); }

  var PRIVACY_HTML =
    '<h3>개인정보처리방침</h3>' +
    '<p>' + COMPANY.name + '(이하 "회사")는 「개인정보 보호법」 등 관련 법령을 준수하며, 이용자의 개인정보를 소중히 보호합니다.</p>' +
    '<h4>1. 수집하는 개인정보 항목 및 방법</h4>' +
    '<ul>' +
      '<li>회원가입·문의: 성명, 이메일, 연락처, 소속</li>' +
      '<li>A/S 신청: 성명, 연락처, 주소, 신청 내용</li>' +
      '<li>수집 방법: 홈페이지(회원가입·게시판·A/S 신청) 입력</li>' +
    '</ul>' +
    '<h4>2. 개인정보의 수집·이용 목적</h4>' +
    '<p>회원 관리, 제품·납품·A/S 등 서비스 제공 및 문의 응대.</p>' +
    '<h4>3. 보유 및 이용 기간</h4>' +
    '<p>수집·이용 목적 달성 시 지체 없이 파기합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>' +
    '<h4>4. 제3자 제공</h4>' +
    '<p>회사는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 단, 법령에 따른 경우는 예외로 합니다.</p>' +
    '<h4>5. 이용자의 권리</h4>' +
    '<p>이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다.</p>' +
    '<h4>6. 개인정보 보호책임자</h4>' +
    '<ul>' +
      '<li>' + COMPANY.name + ' (대표이사 ' + COMPANY.ceo + ')</li>' +
      '<li>주소: ' + COMPANY.addr + '</li>' +
      '<li>전화: ' + COMPANY.tel + ' / 이메일: ' + COMPANY.email + '</li>' +
      '<li>사업자등록번호: ' + COMPANY.biz + '</li>' +
    '</ul>' +
    '<p style="margin-top:14px;color:#888;font-size:12px;">※ 본 방침은 표준 양식 기반의 안내로, 실제 운영 현황에 맞게 법률 검토 후 보완하시기 바랍니다.</p>';

  var EMAIL_HTML =
    '<h3>이메일 무단 수집거부</h3>' +
    '<p>본 웹사이트에 게시된 이메일 주소가 전자우편 수집 프로그램이나 그 밖의 기술적 장치를 이용하여 무단으로 수집되는 것을 거부하며, 이를 위반 시 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」에 의해 형사처벌됨을 유념하시기 바랍니다.</p>' +
    '<p style="color:#888;font-size:13px;">— ' + COMPANY.name + '</p>';

  // ── 초기화: 기존 <footer> 내용을 교체 ───────────────────
  function init() {
    var footer = document.querySelector('footer');
    if (!footer) {
      footer = document.createElement('footer');
      document.body.appendChild(footer);
    }
    footer.classList.add('fbz-footer');
    footer.innerHTML = footerHtml();
    document.getElementById('fbz-privacy').addEventListener('click', function () { openModal(PRIVACY_HTML); });
    document.getElementById('fbz-email-reject').addEventListener('click', function () { openModal(EMAIL_HTML); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
