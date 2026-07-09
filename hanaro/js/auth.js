// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyD-FTnZJKNXJHz-FTzuLXPk4n7uTbVrA68",
    authDomain: "hanarooa-f227d.firebaseapp.com",
    projectId: "hanarooa-f227d",
    storageBucket: "hanarooa-f227d.firebasestorage.app",
    messagingSenderId: "224725591655",
    appId: "1:224725591655:web:946b6b462c2ad06a8f56c2",
    measurementId: "G-ELZBEYYQDB"
};

// 디버그 모드 (프로덕션에서는 false로 설정)
const DEBUG_MODE = true; // 임시로 true로 설정하여 로그인 문제 디버깅

// 로그 헬퍼 함수
function log(...args) {
    if (DEBUG_MODE) console.log(...args);
}
function logWarn(...args) {
    if (DEBUG_MODE) console.warn(...args);
}
function logError(...args) {
    console.error(...args); // 에러는 항상 표시
}

// Live Server WebSocket 오류 필터링 (개발 도구 오류 무시)
(function() {
    const originalError = console.error;
    console.error = function(...args) {
        const message = args.join(' ');
        // Live Server WebSocket 오류는 무시 (개발 도구 관련 오류)
        if (message.includes('WebSocket') && 
            (message.includes('127.0.0.1:5500') || message.includes('suspension'))) {
            return; // 오류 무시
        }
        originalError.apply(console, args);
    };
})();

// Firebase 싱글톤 인스턴스 (전역에서 한 번만 초기화)
let firebaseApp = null;
let authDb = null;
let auth = null;
let authStateUnsubscribe = null;
let authStateChangedCount = 0;
let initFirebasePromise = null; // 초기화 진행 중이면 이 Promise를 공유(동시 호출이 null 대신 완료를 기다림)
let isLoggingIn = false;
let isRegistering = false;      // 가입 신청 진행 중 — 연타 차단 + onAuthStateChanged 개입 차단
// 로그아웃 세대 카운터: 로그아웃/세션정리 때마다 +1.
// 비동기 콜백(fetchUserData .then 등)은 시작 시점 값을 캡처해 두었다가,
// sessionStorage에 쓰기 직전 값이 그대로인지 재확인한다(로그아웃 이후 뒤늦게 도착한 응답이 세션을 부활시키는 문제 방지).
let authEpoch = 0;

// Firestore 조회 캐시 (중복 조회 방지)
let userDataCache = null;
let userDataCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// Firebase 초기화 (싱글톤 패턴)
// 동시 호출 시 이전에는 null을 반환해 빠른 로그인 클릭이 "새로고침" 오류로 실패했음 →
// 진행 중인 초기화 Promise를 공유해 모든 호출자가 같은 결과를 기다리도록 변경.
async function initFirebase() {
    if (firebaseApp && auth && authDb) {
        log('[Firebase 초기화] 이미 초기화됨, 재사용');
        return { app: firebaseApp, auth: auth, db: authDb };
    }

    if (initFirebasePromise) {
        log('[Firebase 초기화] 초기화 진행 중 → 완료 대기');
        return initFirebasePromise;
    }

    initFirebasePromise = (async () => {
        try {
            if (typeof firebase === 'undefined') {
                logWarn('[Firebase 초기화] Firebase SDK가 로드되지 않았습니다.');
                return null;
            }

            try {
                if (firebase.apps.length === 0) {
                    firebaseApp = firebase.initializeApp(firebaseConfig);
                    log('[Firebase 초기화] 새로 초기화됨');
                } else {
                    firebaseApp = firebase.app();
                    log('[Firebase 초기화] 기존 앱 재사용');
                }
            } catch (error) {
                if (error.code === 'app/duplicate-app') {
                    firebaseApp = firebase.app();
                } else {
                    throw error;
                }
            }

            auth = firebaseApp.auth();
            authDb = firebaseApp.firestore();

            if (auth) {
                try {
                    const currentUser = auth.currentUser;
                    if (!currentUser) {
                        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                        log('[Firebase 초기화] Auth persistence를 LOCAL로 설정 완료');
                    }
                } catch (error) {
                    logWarn('[Firebase 초기화] Auth persistence 설정 실패:', error.message);
                }
            }

            log('[Firebase 초기화] 완료');
            return { app: firebaseApp, auth: auth, db: authDb };
        } catch (error) {
            logError('[Firebase 초기화] 실패:', error);
            return null;
        }
    })();

    const result = await initFirebasePromise;
    if (!result) initFirebasePromise = null; // 실패 시 다음 호출에서 재시도 가능
    return result;
}

// 즉시 초기화 시도
if (typeof firebase !== 'undefined') {
    initFirebase().catch(error => {
        logError('[Firebase 초기화] 즉시 초기화 실패:', error);
    });
} else {
    window.addEventListener('load', async function() {
        if (!firebaseApp && typeof firebase !== 'undefined') {
            await initFirebase();
        }
    });
}

// onAuthStateChanged 리스너 관리
let isAuthStateListenerSetup = false;
let listenerSetupAttempts = 0;
window.authListenerReady = false;
window.authStateChangedCount = 0;
let authChecked = false;
let authCheckStartTime = null;

// Firestore에서 사용자 데이터 조회 (캐싱 적용)
async function fetchUserData(uid, forceRefresh = false) {
    if (!authDb) {
        logError('[Firestore] authDb가 초기화되지 않았습니다.');
        return null;
    }
    
    // 캐시 확인
    if (!forceRefresh && userDataCache && userDataCache.uid === uid) {
        const cacheAge = Date.now() - userDataCacheTime;
        if (cacheAge < CACHE_DURATION) {
            log('[Firestore] 캐시에서 사용자 데이터 반환');
            return userDataCache;
        }
    }
    
    try {
        const userDocRef = authDb.collection('users').doc(uid);
        const userDoc = await userDocRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const fullUserData = {
                uid: uid,
                email: auth.currentUser?.email || '',
                ...userData
            };
            
            // 캐시 저장
            userDataCache = fullUserData;
            userDataCacheTime = Date.now();
            
            return fullUserData;
        }
        
        // 문서가 없으면 기본 정보 반환
        return {
            uid: uid,
            email: auth.currentUser?.email || '',
            userType: 'guest',
            isAdmin: false
        };
    } catch (error) {
        logError('[Firestore] 사용자 데이터 조회 실패:', error);
        // Firestore 접근 실패 시에도 기본 정보 반환 (로그인 상태 유지)
        // Firebase Auth는 성공했으므로 Firestore 접근 실패는 로그인 상태와 별개
        // _fallback: 일시 장애 폴백 표식 — 이 값으로 sessionStorage의 정상 프로필을 덮어쓰지 않는다
        // (임직원이 세션 내내 guest로 고착되던 문제 방지)
        console.warn('[Firestore] 접근 실패했지만 기본 정보로 로그인 상태 유지');
        return {
            uid: uid,
            email: auth.currentUser?.email || '',
            userType: 'guest',
            isAdmin: false,
            _fallback: true
        };
    }
}

// Firestore 일시 장애 폴백(guest)이 기존의 정상 프로필을 덮어쓰지 않도록 보정.
// 폴백이고 sessionStorage에 같은 uid의 정상 프로필이 있으면 그 프로필을 유지한다.
function preferStoredProfile(userData, uid) {
    if (!userData || !userData._fallback) return userData;
    try {
        const prev = JSON.parse(sessionStorage.getItem('loggedInUser') || 'null');
        if (prev && prev.uid === uid && !prev._fallback) return prev;
    } catch (e) { /* 파싱 실패 시 폴백 사용 */ }
    return userData;
}

function setupAuthStateListener() {
    listenerSetupAttempts++;
    
    if (isAuthStateListenerSetup && authStateUnsubscribe) {
        log(`[Auth 리스너] 이미 설정됨 (시도 #${listenerSetupAttempts})`);
        window.authListenerReady = true;
        return;
    }
    
    if (!auth) {
        logWarn(`[Auth 리스너] auth가 초기화되지 않음 (시도 #${listenerSetupAttempts})`);
        if (listenerSetupAttempts < 10) {
            setTimeout(setupAuthStateListener, 200);
        }
        return;
    }
    
    if (authStateUnsubscribe) {
        log('[Auth 리스너] 기존 리스너 해제');
        authStateUnsubscribe();
        authStateUnsubscribe = null;
    }
    
    isAuthStateListenerSetup = true;
    authStateChangedCount = 0;
    window.authListenerReady = true;
    authCheckStartTime = Date.now();
    
    authStateUnsubscribe = auth.onAuthStateChanged(async function(user) {
        authStateChangedCount++;
        window.authStateChangedCount = authStateChangedCount;

        if (user) {
            // 가입 신청 처리 중 createUserWithEmailAndPassword가 일으키는 임시 사인인은 무시
            // (guest로 로그인 UI·sessionStorage가 세워졌다가 signOut 후 유령 세션으로 남던 문제 방지)
            if (isRegistering) {
                log('[Auth 리스너] 가입 신청 처리 중 — 임시 사인인 무시');
                return;
            }
            const epochAtStart = authEpoch; // 이 콜백이 시작된 세대 — 쓰기 직전 재확인용
            isLoggingIn = false;
            authChecked = true;
            
            const loginContainer = document.getElementById('login-container');
            if (loginContainer && loginContainer.style.display === 'block') {
                hideLogin();
            }
            
            // 현재 sessionStorage와 비교하여 불필요한 업데이트 방지
            const currentLoggedInUser = sessionStorage.getItem("loggedInUser");
            const currentLoggedIn = sessionStorage.getItem("loggedIn");
            let needsUpdate = true;
            
            if (currentLoggedInUser && currentLoggedIn === "true") {
                try {
                    const currentUserData = JSON.parse(currentLoggedInUser);
                    if (currentUserData.uid === user.uid) {
                        // 이미 같은 사용자로 로그인되어 있고 UI가 올바르게 설정되어 있으면
                        // Firestore 조회는 하되 UI 업데이트는 최소화
                        const loginLink = document.getElementById('login-link');
                        const logoutLink = document.getElementById('logout-link');
                        if (loginLink && loginLink.style.display === 'none' && 
                            logoutLink && logoutLink.style.display === 'flex') {
                            // UI가 이미 올바른 상태이면 Firestore 조회만 수행 (캐시 갱신)
                            needsUpdate = false;
                            fetchUserData(user.uid, true).then(userData => {
                                // 로그아웃 이후 뒤늦게 도착한 응답이면 기록하지 않음 (세션 부활 방지)
                                if (epochAtStart !== authEpoch || !auth || !auth.currentUser || auth.currentUser.uid !== user.uid) return;
                                if (userData) {
                                    userData = preferStoredProfile(userData, user.uid); // 폴백이 정상 프로필을 덮지 않게
                                    sessionStorage.setItem("loggedInUser", JSON.stringify(userData));
                                    sessionStorage.setItem("loggedIn", "true");
                                    // UI는 이미 올바른 상태이므로 임직원 버튼만 업데이트
                                    const isEmployee = userData.userType === 'employee' || userData.isAdmin === true;
                                    document.querySelectorAll('.employee-button, #employee-button, #employee-button-mobile').forEach(btn => {
                                        btn.disabled = !isEmployee;
                                    });
                                    // ⚠ 페이지 훅은 UI 갱신 생략과 무관하게 반드시 호출.
                                    // (pagehide 제거 후 세션이 내비게이션을 살아남으면서 staff.html 등이 이 빠른 경로로만
                                    //  진입하는데, 예전 코드는 여기서 checkStaffAccess를 부르지 않아 게시판이
                                    //  '불러오는 중…'에서 영영 멈췄음 — 이 두 호출을 제거하지 말 것)
                                    if (typeof window.checkStaffAccess === 'function') {
                                        try {
                                            const r = window.checkStaffAccess(user, userData);
                                            if (r && typeof r.catch === 'function') r.catch(() => {});
                                        } catch (e) { logError('[Auth 리스너] checkStaffAccess 오류:', e); }
                                    }
                                    // school.html 등은 이 이벤트로 데이터 로드를 시작한다
                                    window.dispatchEvent(new CustomEvent('authStateRestored', {
                                        detail: { user: user, userData: userData, restored: true }
                                    }));
                                }
                            });
                            return; // UI 업데이트 없이 종료
                        }
                    }
                } catch (e) {
                    // 파싱 오류 시 업데이트 필요
                }
            }
            
            // Firestore에서 사용자 정보 조회 (캐싱 적용)
            // 중요: fetchUserData는 실패해도 기본 정보를 반환하므로 항상 userData가 있음
            let userData;
            try {
                userData = await fetchUserData(user.uid);
            } catch (fetchError) {
                console.error('[Auth 리스너] fetchUserData 오류:', fetchError);
                // Firestore 접근 실패 시에도 기본 정보로 로그인 상태 유지
                userData = {
                    uid: user.uid,
                    email: user.email || '',
                    userType: 'guest',
                    isAdmin: false
                };
            }
            
            // userData가 없으면 기본 정보 생성
            if (!userData) {
                userData = {
                    uid: user.uid,
                    email: user.email || '',
                    userType: 'guest',
                    isAdmin: false,
                    _fallback: true
                };
            }

            // 로그아웃 이후 뒤늦게 도착한 조회 결과면 여기서 중단 (세션 부활 방지)
            if (epochAtStart !== authEpoch || !auth || !auth.currentUser || auth.currentUser.uid !== user.uid) {
                log('[Auth 리스너] 조회 완료 전에 로그아웃됨 — 세션 기록 생략');
                return;
            }
            userData = preferStoredProfile(userData, user.uid); // 폴백(guest)이 정상 프로필을 덮지 않게

            // 항상 로그인 상태 유지 (Firestore 접근 실패와 무관)
            if (needsUpdate) {
                setLoggedInState(true, userData);
            }
            sessionStorage.setItem("loggedInUser", JSON.stringify(userData));
            sessionStorage.setItem("loggedIn", "true");
            sessionStorage.setItem("lastLoginTime", Date.now().toString());
            
            // 로그인 상태 복원 이벤트 발생 (다른 페이지에서 즉시 감지 가능)
            // setLoggedInState와 sessionStorage 설정 후에 발생
            window.dispatchEvent(new CustomEvent('authStateRestored', { 
                detail: { user: user, userData: userData, restored: true } 
            }));
            
            // staff 페이지 접근 제어
            if (typeof window.checkStaffAccess === 'function') {
                const checkResult = window.checkStaffAccess(user, userData);
                if (checkResult && typeof checkResult.catch === 'function') {
                    checkResult.catch(error => {
                        logError('[Auth 리스너] staff 페이지 접근 제어 오류:', error);
                    });
                }
            }
            
            // 로그인 성공 메시지 (한 번만, 새로 로그인한 경우에만)
            if (needsUpdate) {
                const lastLoginMessage = sessionStorage.getItem("lastLoginMessage");
                if (!lastLoginMessage || lastLoginMessage !== user.uid) {
                    setTimeout(() => {
                        alert(`${userData.name || userData.username || userData.email}님, 환영합니다!`);
                        sessionStorage.setItem("lastLoginMessage", user.uid);
                    }, 100);
                }
            }
        } else {
            // user가 null인 경우
            // 중요: 페이지 로드 시 Firebase Auth 복원이 완료되기 전에 user=null이 호출될 수 있음
            // sessionStorage와 auth.currentUser를 먼저 확인하여 실제 로그아웃 상태인지 확인
            
            // auth.currentUser를 직접 확인 (더 정확한 상태 확인)
            if (auth && auth.currentUser) {
                console.log(`[Auth 리스너] user=null이지만 auth.currentUser 존재 (UID: ${auth.currentUser.uid}) - false 설정 안 함`);
                return; // auth.currentUser가 있으면 false로 설정하지 않음
            }
            
            const currentLoggedInUser = sessionStorage.getItem("loggedInUser");
            const currentLoggedIn = sessionStorage.getItem("loggedIn");
            
            // sessionStorage에 로그인 정보가 있으면 Firebase Auth 복원 대기 중일 수 있음
            // 첫 번째 또는 두 번째 호출이고 sessionStorage에 로그인 정보가 있으면 false로 설정하지 않음
            if ((authStateChangedCount === 1 || authStateChangedCount === 2) && currentLoggedInUser && currentLoggedIn === "true") {
                console.log(`[Auth 리스너] 호출 #${authStateChangedCount}에서 user=null이지만 sessionStorage에 로그인 정보 있음 - Firebase Auth 복원 대기 중`);
                
                // UI 상태 확인
                const loginLink = document.getElementById('login-link');
                const logoutLink = document.getElementById('logout-link');
                
                // UI가 이미 로그인 상태로 올바르게 설정되어 있으면 아무것도 하지 않음
                if (loginLink && loginLink.style.display === 'none' && 
                    logoutLink && logoutLink.style.display === 'flex') {
                    console.log('[Auth 리스너] UI가 이미 로그인 상태로 올바르게 설정됨 - false로 변경하지 않음');
                    return; // false로 설정하지 않음
                }
                
                // Firebase Auth 복원을 기다리기 위해 잠시 대기 후 재확인
                setTimeout(async () => {
                    // 다시 확인
                    if (auth && auth.currentUser) {
                        console.log('[Auth 리스너] 재확인 결과: Firebase Auth 복원됨 - UID:', auth.currentUser.uid);
                        // onAuthStateChanged가 곧 호출될 것이므로 여기서는 처리하지 않음
                        return;
                    } else {
                        // 여전히 null이고 sessionStorage도 없으면 실제 로그아웃 상태
                        const recheckLoggedInUser = sessionStorage.getItem("loggedInUser");
                        const recheckLoggedIn = sessionStorage.getItem("loggedIn");
                        
                        if (!recheckLoggedInUser || recheckLoggedIn !== "true") {
                            console.log('[Auth 리스너] 재확인 결과: 실제 로그아웃 상태');
                            const loginLink = document.getElementById('login-link');
                            const logoutLink = document.getElementById('logout-link');
                            if (loginLink && loginLink.style.display === 'flex' && 
                                logoutLink && logoutLink.style.display === 'none') {
                                // 이미 로그아웃 상태로 표시되어 있으면 업데이트 생략
                                authEpoch++; sessionStorage.removeItem("loggedInUser");
                                sessionStorage.removeItem("loggedIn");
                                userDataCache = null;
                                return;
                            }
                            setLoggedInState(false);
                            authEpoch++; sessionStorage.removeItem("loggedInUser");
                            sessionStorage.removeItem("loggedIn");
                            userDataCache = null;
                            
                            if (typeof window.checkStaffAccess === 'function') {
                                window.checkStaffAccess(null, null);
                            }
                        } else {
                            console.log('[Auth 리스너] 재확인 결과: sessionStorage에 여전히 로그인 정보 있음 - 로그인 상태 유지');
                        }
                    }
                }, 1000); // 1초 대기 후 재확인 (더 긴 대기 시간)
                return; // 즉시 false로 설정하지 않음
            }
            
            // 실제 로그아웃 상태인 경우에만 처리
            // sessionStorage에 로그인 정보가 없고, UI도 로그아웃 상태인 경우에만
            const loginLink = document.getElementById('login-link');
            const logoutLink = document.getElementById('logout-link');
            
            // sessionStorage에 로그인 정보가 없고, UI도 로그아웃 상태인 경우에만 false로 설정
            if ((!currentLoggedInUser || currentLoggedIn !== "true") &&
                loginLink && loginLink.style.display === 'flex' && 
                logoutLink && logoutLink.style.display === 'none') {
                // 이미 로그아웃 상태로 표시되어 있고 sessionStorage에도 없으면 업데이트 생략
                authEpoch++; sessionStorage.removeItem("loggedInUser");
                sessionStorage.removeItem("loggedIn");
                userDataCache = null;
                return;
            }
            
            // sessionStorage에도 로그인 정보가 없고 UI도 로그아웃 상태면 실제 로그아웃
            // 하지만 페이지 로드 초기에는 Firebase Auth 복원이 완료되지 않았을 수 있으므로
            // 최소 2초는 대기 후에만 false로 설정
            if (!currentLoggedInUser || currentLoggedIn !== "true") {
                // UI가 로그인 상태로 표시되어 있으면 절대 false로 설정하지 않음
                if (loginLink && loginLink.style.display === 'none' && 
                    logoutLink && logoutLink.style.display === 'flex') {
                    console.log('[Auth 리스너] UI가 로그인 상태인데 sessionStorage 없음 - false로 변경하지 않음');
                    return;
                }
                
                // 페이지 로드 후 일정 시간이 지나지 않았으면 대기
                const pageLoadTime = window.pageLoadTime || Date.now();
                const timeSinceLoad = Date.now() - pageLoadTime;
                
                if (timeSinceLoad < 2000) {
                    console.log(`[Auth 리스너] 페이지 로드 후 ${timeSinceLoad}ms 경과 - Firebase Auth 복원 대기 중 (false 설정 지연)`);
                    setTimeout(() => {
                        const recheckLoggedInUser = sessionStorage.getItem("loggedInUser");
                        const recheckLoggedIn = sessionStorage.getItem("loggedIn");
                        if (!recheckLoggedInUser || recheckLoggedIn !== "true") {
                            const recheckLoginLink = document.getElementById('login-link');
                            const recheckLogoutLink = document.getElementById('logout-link');
                            if (recheckLoginLink && recheckLoginLink.style.display === 'flex' && 
                                recheckLogoutLink && recheckLogoutLink.style.display === 'none') {
                                setLoggedInState(false);
                                authEpoch++; sessionStorage.removeItem("loggedInUser");
                                sessionStorage.removeItem("loggedIn");
                                userDataCache = null;
                                
                                if (typeof window.checkStaffAccess === 'function') {
                                    window.checkStaffAccess(null, null);
                                }
                            }
                        }
                    }, 2000 - timeSinceLoad);
                    return;
                }
                
                setLoggedInState(false);
                authEpoch++; sessionStorage.removeItem("loggedInUser");
                sessionStorage.removeItem("loggedIn");
                userDataCache = null;
                
                if (typeof window.checkStaffAccess === 'function') {
                    window.checkStaffAccess(null, null);
                }
            } else {
                // sessionStorage에 로그인 정보가 있으면 false로 설정하지 않음
                console.log('[Auth 리스너] sessionStorage에 로그인 정보 있음 - false로 변경하지 않음');
            }
        }
    });
    
    log('[Auth 리스너] onAuthStateChanged 리스너 등록 완료');
}

// 페이지 로드 시간 기록 (Firebase Auth 복원 대기 시간 계산용)
window.pageLoadTime = Date.now();

// 즉시 실행: sessionStorage 기준으로 로그인 UI를 '동기적으로' 확정 (네비 이동 시 로그인 깜빡임 제거)
// auth.js는 각 페이지 <body> 끝에서 로드 → 헤더의 login-link/logout-link는 이미 파싱된 상태이므로,
// requestAnimationFrame/DOMContentLoaded로 미루지 않고 스크립트 실행 그 자리에서 바로 인라인 스타일을
// 적용해야 '첫 페인트부터' 올바른 상태가 된다(이전 버전은 rAF로 미뤄 로그아웃→로그인 플래시가 생겼음).
(function() {
    function applyInitialState() {
        const loginLink = document.getElementById('login-link');
        const logoutLink = document.getElementById('logout-link');
        // 헤더가 아직 파싱되지 않았으면(예외적으로 <head>에서 로드된 페이지) false 반환 → DOM 준비 후 재시도
        if (!loginLink && !logoutLink) return false;

        let userData = null;
        try {
            const raw = sessionStorage.getItem('loggedInUser');
            if (raw && sessionStorage.getItem('loggedIn') === 'true') userData = JSON.parse(raw);
        } catch (e) {
            logWarn('[초기 상태] sessionStorage 파싱 오류');
            userData = null;
        }

        if (userData) {
            if (loginLink) {
                loginLink.setAttribute('data-initialized', 'true');
                loginLink.style.display = 'none';
                loginLink.style.width = '0';
                loginLink.style.margin = '0';
                loginLink.style.padding = '0';
            }
            if (logoutLink) {
                logoutLink.setAttribute('data-initialized', 'true');
                logoutLink.style.display = 'flex';
                logoutLink.style.width = 'auto';
                logoutLink.style.margin = '';
                logoutLink.style.padding = '';
            }
            const isEmployee = userData.userType === 'employee' || userData.isAdmin === true;
            document.querySelectorAll('.employee-button, #employee-button, #employee-button-mobile').forEach(btn => {
                btn.disabled = !isEmployee;
            });
        } else {
            // 로그아웃 상태
            if (loginLink) {
                loginLink.setAttribute('data-initialized', 'true');
                loginLink.style.display = 'flex';
                loginLink.style.width = 'auto';
            }
            if (logoutLink) {
                logoutLink.setAttribute('data-initialized', 'true');
                logoutLink.style.display = 'none';
                logoutLink.style.width = '0';
                logoutLink.style.margin = '0';
                logoutLink.style.padding = '0';
            }
        }
        // 헤더 로그인/로그아웃 표시의 '단일 진실원천'은 <html data-auth>('in'|'out').
        // <head> 스니펫이 심은 #auth-css(!important)가 이 속성에 따라 표시를 강제하므로,
        // 비동기 인증 복원 중 인라인 display가 잠깐 바뀌어도 헤더는 절대 흔들리지 않는다.
        document.documentElement.setAttribute('data-auth', userData ? 'in' : 'out');
        return true;
    }

    // 1) 스크립트 실행 즉시 동기 적용(헤더는 이미 위에서 파싱됨)
    if (!applyInitialState()) {
        // 2) 헤더가 아직 없으면 DOM 준비 후 재시도
        document.addEventListener('DOMContentLoaded', applyInitialState, { once: true });
    }
})();

// 페이지 로드 시 인증 상태 확인 (비동기 처리로 블로킹 방지)
document.addEventListener('DOMContentLoaded', function() {
    // 활동 감지 리스너 설정 (중복 방지)
    if (!window.activityListenersSetup) {
        setupActivityListeners();
        window.activityListenersSetup = true;
    }

    // 마이페이지(내 정보 수정) 준비 — 스타일/헤더 링크/모달을 전 페이지 공통 주입
    try { ensureMyPageStyle(); ensureMyPageLink(); ensureMyPageModal(); } catch (e) { /* 무시 */ }

    // Firebase 초기화 및 리스너 설정 (비동기, 블로킹 없음)
    requestAnimationFrame(function() {
        if (!auth || !authDb) {
            initFirebase().then(result => {
                if (result) {
                    auth = result.auth;
                    authDb = result.db;
                    if (auth && !isAuthStateListenerSetup) {
                        setupAuthStateListener();
                    }
                }
            }).catch(error => {
                logError('[DOMContentLoaded] Firebase 재초기화 실패:', error);
            });
        } else {
            setupAuthStateListener();
        }
        
        // auth.currentUser 확인 (비동기, 블로킹 없음)
        setTimeout(function() {
            (async () => {
                let retryCount = 0;
                while ((!auth || !authDb) && retryCount < 10) { // 최대 대기 시간 단축
                    await new Promise(resolve => setTimeout(resolve, 50)); // 대기 시간 단축
                    retryCount++;
                }
                
                if (auth && auth.currentUser) {
                    const currentUser = auth.currentUser;
                    const loggedInUser = sessionStorage.getItem("loggedInUser");
                    const loggedIn = sessionStorage.getItem("loggedIn");
                    
                    const needsUpdate = !loggedInUser || 
                                       loggedIn !== "true" || 
                                       (loggedInUser && JSON.parse(loggedInUser).uid !== currentUser.uid);
                    
                    if (needsUpdate) {
                        const epochAtStart = authEpoch;
                        let userData;
                        try {
                            userData = await fetchUserData(currentUser.uid);
                        } catch (fetchError) {
                            console.error('[DOMContentLoaded] fetchUserData 오류:', fetchError);
                            // Firestore 접근 실패 시에도 기본 정보로 로그인 상태 유지
                            userData = {
                                uid: currentUser.uid,
                                email: currentUser.email || '',
                                userType: 'guest',
                                isAdmin: false,
                                _fallback: true
                            };
                        }

                        // userData가 없으면 기본 정보 생성
                        if (!userData) {
                            userData = {
                                uid: currentUser.uid,
                                email: currentUser.email || '',
                                userType: 'guest',
                                isAdmin: false,
                                _fallback: true
                            };
                        }

                        // 로그아웃 이후 뒤늦게 도착한 응답이면 기록하지 않음 (세션 부활 방지)
                        if (epochAtStart !== authEpoch || !auth || !auth.currentUser || auth.currentUser.uid !== currentUser.uid) return;
                        userData = preferStoredProfile(userData, currentUser.uid);

                        sessionStorage.setItem("loggedInUser", JSON.stringify(userData));
                        sessionStorage.setItem("loggedIn", "true");
                        sessionStorage.setItem("lastLoginTime", Date.now().toString());
                        requestAnimationFrame(function() {
                            setLoggedInState(true, userData);
                        });
                    }
                } else if (!auth || !auth.currentUser) {
                    // Firebase Auth가 아직 복원되지 않았을 수 있으므로
                    // sessionStorage를 확인하여 실제 로그아웃 상태인지 확인
                    const loggedInUser = sessionStorage.getItem("loggedInUser");
                    const loggedIn = sessionStorage.getItem("loggedIn");
                    
                    if (loggedIn === "true" && loggedInUser) {
                        // sessionStorage에 로그인 정보가 있으면 Firebase Auth 복원 대기 중일 수 있음
                        // onAuthStateChanged에서 처리하도록 하므로 여기서는 false로 설정하지 않음
                        console.log('[DOMContentLoaded] sessionStorage에 로그인 정보 있지만 Firebase Auth 복원 대기 중');
                        return;
                    } else {
                        // sessionStorage에도 없으면 실제 로그아웃 상태
                        requestAnimationFrame(function() {
                            setLoggedInState(false);
                        });
                    }
                }
            })();
        }, 0); // 다음 이벤트 루프에서 실행
    });
});

// 자동 로그아웃 타이머 관리
let autoLogoutTimer = null;
let autoLogoutWarningTimer = null;
let logoutTimerUpdateInterval = null;
let lastActivityTime = null;
const AUTO_LOGOUT_TIME = 15 * 60 * 1000;
const WARNING_TIME = 12 * 60 * 1000;
let warningShown = false;

function resetAutoLogoutTimer() {
    if (!sessionStorage.getItem("loggedIn")) {
        return;
    }
    
    lastActivityTime = Date.now();
    // 다른 탭과 활동 시각 공유 — 한 탭의 방치 타이머가 활발히 쓰는 다른 탭까지 로그아웃시키지 않도록
    try { localStorage.setItem('lastActivityTime', String(lastActivityTime)); } catch (e) {}

    const warningModal = document.getElementById('auto-logout-warning');
    if (warningModal) {
        warningModal.remove();
    }
    // 경고 표시 여부는 모달 존재와 무관하게 항상 리셋
    // (자동 로그아웃/3분 타임아웃이 모달만 제거하고 플래그를 남겨, 재로그인 후 경고 없이 로그아웃되던 문제)
    warningShown = false;
    
    if (autoLogoutTimer) {
        clearTimeout(autoLogoutTimer);
        autoLogoutTimer = null;
    }
    if (autoLogoutWarningTimer) {
        clearTimeout(autoLogoutWarningTimer);
        autoLogoutWarningTimer = null;
    }
    if (logoutTimerUpdateInterval) {
        clearInterval(logoutTimerUpdateInterval);
        logoutTimerUpdateInterval = null;
    }
    
    autoLogoutWarningTimer = setTimeout(() => {
        showAutoLogoutWarning();
    }, WARNING_TIME);
    
    autoLogoutTimer = setTimeout(() => {
        autoLogout();
    }, AUTO_LOGOUT_TIME);

    // 남은 시간 카운트다운 배지는 표시하지 않음 (경고 알림만 사용)
    updateLogoutTimer();
}

function showAutoLogoutWarning() {
    if (warningShown) return;
    warningShown = true;
    
    const warningModal = document.createElement('div');
    warningModal.id = 'auto-logout-warning';
    warningModal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
        padding: 30px;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        z-index: 10002;
        text-align: center;
        min-width: 320px;
        max-width: 400px;
        animation: scaleIn 0.3s ease;
    `;
    
    warningModal.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">⏰</div>
        <h3 style="margin: 0 0 16px 0; font-size: 20px; color: #212529;">자동 로그아웃 알림</h3>
        <p style="margin: 0 0 24px 0; font-size: 15px; color: #6c757d; line-height: 1.6;">
            3분 후 자동으로 로그아웃됩니다.<br>
            계속 사용하시려면 아무 곳이나 클릭해주세요.
        </p>
        <button id="warning-confirm-btn" 
                style="padding: 12px 24px; background: linear-gradient(135deg, #44aa6b 0%, #3a8f5a 100%); 
                       color: white; border: none; border-radius: 12px; cursor: pointer; 
                       font-weight: 600; font-size: 15px; width: 100%;">
            확인
        </button>
    `;
    
    document.body.appendChild(warningModal);
    
    const confirmBtn = document.getElementById('warning-confirm-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            warningModal.remove();
            resetAutoLogoutTimer();
        });
    }
    
    setTimeout(() => {
        if (warningModal.parentElement) {
            warningModal.remove();
            warningShown = false; // 플래그 잔존 시 재로그인 후 경고 없이 로그아웃되는 문제 방지
        }
    }, 3 * 60 * 1000);
}

async function autoLogout() {
    // 다른 탭에서 최근 활동이 있었으면 로그아웃하지 않는다
    // (Auth persistence는 LOCAL로 전 탭 공유라, 방치된 탭의 signOut이 작업 중인 탭까지 로그아웃시키던 문제)
    try {
        const shared = parseInt(localStorage.getItem('lastActivityTime') || '0', 10);
        if (shared && Date.now() - shared < AUTO_LOGOUT_TIME) {
            log('[자동 로그아웃] 다른 탭에서 최근 활동 감지 — 로그아웃 취소, 타이머 재설정');
            warningShown = false;
            const warningModal = document.getElementById('auto-logout-warning');
            if (warningModal) warningModal.remove();
            resetAutoLogoutTimer();
            return;
        }
    } catch (e) { /* localStorage 접근 실패 시 기존 동작 유지 */ }

    const warningModal = document.getElementById('auto-logout-warning');
    if (warningModal) {
        warningModal.remove();
    }
    warningShown = false;

    const timerDisplay = document.getElementById('logout-timer');
    if (timerDisplay) {
        timerDisplay.remove();
    }

    await logout();
    alert('15분간 활동이 없어 자동으로 로그아웃되었습니다.');
}

function updateLogoutTimer() {
    // 남은 시간 카운트다운 배지는 더 이상 표시하지 않는다.
    // 기존에 만들어진 배지가 있으면 제거하고, 갱신 인터벌도 정리한다.
    const timerDisplay = document.getElementById('logout-timer');
    if (timerDisplay) {
        timerDisplay.remove();
    }
    if (logoutTimerUpdateInterval) {
        clearInterval(logoutTimerUpdateInterval);
        logoutTimerUpdateInterval = null;
    }
}

function setupActivityListeners() {
    if (window.activityListenersSetup) return;
    
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const throttledReset = throttle(resetAutoLogoutTimer, 1000); // 1초마다 최대 1회 호출
    
    events.forEach(event => {
        document.addEventListener(event, throttledReset, { passive: true });
    });
}

// throttle 함수 (성능 최적화)
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// setLoggedInState 호출 추적 (중복 호출 방지)
let lastSetLoggedInStateCall = null;
let setLoggedInStateCallCount = 0;

function setLoggedInState(isLoggedIn, userData = null) {
    setLoggedInStateCallCount++;
    const callTime = Date.now();
    
    // 호출 스택 추적 (디버깅용)
    const stack = new Error().stack;
    const caller = stack.split('\n')[2] || 'unknown';
    console.log(`[setLoggedInState] 호출 #${setLoggedInStateCallCount} - isLoggedIn: ${isLoggedIn}, userData: ${userData ? (userData.userType || 'N/A') : 'null'}, 호출자: ${caller.trim()}`);
    
    // 중요: false로 설정하려고 할 때 강력한 보호 로직
    // sessionStorage에 로그인 정보가 있으면 절대 false로 설정하지 않음
    if (!isLoggedIn) {
        const currentLoggedInUser = sessionStorage.getItem("loggedInUser");
        const currentLoggedIn = sessionStorage.getItem("loggedIn");
        
        // sessionStorage에 로그인 정보가 있으면 무조건 보호
        if (currentLoggedInUser && currentLoggedIn === "true") {
            console.warn(`[setLoggedInState] 호출 #${setLoggedInStateCallCount}: false로 설정하려 했지만 sessionStorage에 로그인 정보 있음 - false 설정 완전 차단`);
            
            // Firebase Auth도 확인
            if (auth && auth.currentUser) {
                console.warn(`[setLoggedInState] Firebase Auth에도 로그인 정보 있음 (UID: ${auth.currentUser.uid}) - false 설정 완전 차단`);
                // sessionStorage의 정보로 복원
                try {
                    const storedUserData = JSON.parse(currentLoggedInUser);
                    isLoggedIn = true;
                    userData = storedUserData;
                    console.log(`[setLoggedInState] sessionStorage 정보로 자동 복원 - UID: ${storedUserData.uid}`);
                } catch (e) {
                    console.warn('[setLoggedInState] sessionStorage 파싱 오류:', e);
                    // 파싱 오류 시에도 Firebase Auth 정보 사용
                    if (auth.currentUser) {
                        isLoggedIn = true;
                        userData = {
                            uid: auth.currentUser.uid,
                            email: auth.currentUser.email || '',
                            userType: 'guest',
                            isAdmin: false
                        };
                        console.log(`[setLoggedInState] Firebase Auth 정보로 복원 - UID: ${auth.currentUser.uid}`);
                    }
                }
            } else {
                // Firebase Auth는 없지만 sessionStorage에 있으면 복원
                try {
                    const storedUserData = JSON.parse(currentLoggedInUser);
                    isLoggedIn = true;
                    userData = storedUserData;
                    console.log(`[setLoggedInState] sessionStorage 정보로 복원 (Firebase Auth 대기 중) - UID: ${storedUserData.uid}`);
                } catch (e) {
                    console.warn('[setLoggedInState] sessionStorage 파싱 오류:', e);
                }
            }
            
            // false로 설정하려는 시도를 완전히 차단했으므로 여기서 return
            if (isLoggedIn) {
                console.log(`[setLoggedInState] false 설정 차단 완료 - true로 복원됨`);
            }
        }
    }
    
    // 중복 호출 방지: 같은 상태로 연속 호출되는 경우 무시
    if (lastSetLoggedInStateCall) {
        const timeDiff = callTime - lastSetLoggedInStateCall.time;
        if (timeDiff < 100 && lastSetLoggedInStateCall.isLoggedIn === isLoggedIn && 
            lastSetLoggedInStateCall.userDataUid === (userData ? userData.uid : null)) {
            console.warn(`[setLoggedInState] 중복 호출 감지 (${timeDiff}ms 차이) - 무시`);
            return;
        }
    }
    
    lastSetLoggedInStateCall = {
        isLoggedIn: isLoggedIn,
        userDataUid: userData ? userData.uid : null,
        time: callTime
    };
    
    log('[setLoggedInState] 호출 - isLoggedIn:', isLoggedIn);
    
    const isEmployee = isLoggedIn && userData && (userData.userType === 'employee' || userData.isAdmin === true);
    document.querySelectorAll('.employee-button, #employee-button, #employee-button-mobile').forEach(btn => {
        btn.disabled = !isEmployee;
    });
    
    const loginLink = document.getElementById('login-link');
    const logoutLink = document.getElementById('logout-link');

    // 헤더 표시의 단일 진실원천: <html data-auth>. #auth-css(!important)가 이 속성으로 표시를 강제하므로
    // 아래 인라인 토글이 어떤 순서로 들어와도(비동기 복원 레이스 포함) 헤더는 이 값만 따른다.
    document.documentElement.setAttribute('data-auth', isLoggedIn ? 'in' : 'out');

    if (loginLink) {
        loginLink.setAttribute('data-initialized', 'true');
        if (isLoggedIn) {
            loginLink.style.display = 'none';
            loginLink.style.width = '0';
            loginLink.style.margin = '0';
            loginLink.style.padding = '0';
        } else {
            loginLink.style.display = 'flex';
            loginLink.style.width = 'auto';
            loginLink.style.margin = '';
            loginLink.style.padding = '';
        }
    }
    if (logoutLink) {
        logoutLink.setAttribute('data-initialized', 'true');
        if (isLoggedIn) {
            logoutLink.style.display = 'flex';
            logoutLink.style.width = 'auto';
            logoutLink.style.margin = '';
            logoutLink.style.padding = '';
        } else {
            logoutLink.style.display = 'none';
            logoutLink.style.width = '0';
            logoutLink.style.margin = '0';
            logoutLink.style.padding = '0';
        }
    }
    
    if (isLoggedIn) {
        const loginContainer = document.getElementById('login-container');
        if (loginContainer && loginContainer.style.display === 'block') {
            hideLogin();
        }
        sessionStorage.setItem("loggedIn", "true");
        resetAutoLogoutTimer();
    } else {
        sessionStorage.removeItem("loggedIn");
        if (autoLogoutTimer) {
            clearTimeout(autoLogoutTimer);
            autoLogoutTimer = null;
        }
        if (autoLogoutWarningTimer) {
            clearTimeout(autoLogoutWarningTimer);
            autoLogoutWarningTimer = null;
        }
        if (logoutTimerUpdateInterval) {
            clearInterval(logoutTimerUpdateInterval);
            logoutTimerUpdateInterval = null;
        }
        const timerDisplay = document.getElementById('logout-timer');
        if (timerDisplay) {
            timerDisplay.remove();
        }
        const warningModal = document.getElementById('auto-logout-warning');
        if (warningModal) {
            warningModal.remove();
        }
    }
}

function showAuthTab(tab) {
    log('[로그인] showAuthTab() 함수 호출됨 - tab:', tab);
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabs = document.querySelectorAll('.auth-tab');
    
    if (!loginForm || !registerForm) return;
    
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        if (tabs[0]) tabs[0].classList.add('active');
    } else {
        setupRegisterForm();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        if (tabs[1]) tabs[1].classList.add('active');
    }
}

// 회원가입 폼 보정 (폼 HTML이 여러 페이지에 정적으로 중복돼 있어 auth.js에서 일원화 주입):
//  1) '직급 / 직책' 입력칸을 '이름' 입력칸 '위'에 보장
//  2) 회원유형 드롭다운(reg-user-type) 제거
//  3) 단일 '회원가입 신청' 버튼 → '임직원 가입신청' + '일반회원 가입신청' 2개로 교체
function setupRegisterForm() {
    const form = document.getElementById('register-form');
    if (!form) return;

    // 1) 직급/직책 입력칸 (이름 위)
    if (!document.getElementById('reg-position')) {
        const nameEl = document.getElementById('reg-name');
        if (nameEl && nameEl.parentNode) {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'reg-position';
            input.placeholder = '직급 / 직책 (일반회원 필수)';
            if (nameEl.className) input.className = nameEl.className; // 기존 입력칸과 동일 스타일
            nameEl.insertAdjacentElement('beforebegin', input);
        }
    }

    // 2) 회원유형 드롭다운 제거 (가입 버튼으로 대체)
    const sel = document.getElementById('reg-user-type');
    if (sel) sel.remove();

    // 3) 단일 가입 버튼 → 임직원/일반회원 2개 버튼
    //    (본사 임직원 구분은 가입 시 받지 않고, 관리자가 회원관리 유형에서 '본사 임직원'으로 지정)
    if (!document.getElementById('reg-submit-employee')) {
        const oldBtn = Array.from(form.querySelectorAll('button')).find(b =>
            (b.getAttribute('onclick') || '').includes('register') || /회원가입\s*신청/.test(b.textContent || ''));
        const wrap = document.createElement('div');
        wrap.id = 'reg-submit-wrap';
        wrap.style.cssText = 'display:flex;flex-direction:column;';
        wrap.innerHTML =
            '<button type="button" id="reg-submit-employee" onclick="register(\'employee\')">임직원 가입신청</button>' +
            '<button type="button" id="reg-submit-general" onclick="register(\'general\')">일반회원 가입신청</button>';
        if (oldBtn && oldBtn.parentNode) { oldBtn.parentNode.insertBefore(wrap, oldBtn); oldBtn.remove(); }
        else form.appendChild(wrap);
    }
}

function showLogin() {
    log('[로그인] showLogin() 함수 호출됨');
    
    if (auth && auth.currentUser) {
        const loggedInUser = sessionStorage.getItem('loggedInUser');
        if (loggedInUser) {
            try {
                const userData = JSON.parse(loggedInUser);
                const confirmLogout = confirm(`이미 ${userData.name || userData.username || userData.email}님으로 로그인되어 있습니다.\n로그아웃 후 다시 로그인하시겠습니까?`);
                if (confirmLogout) {
                    // 고정 500ms 대기 대신 로그아웃 완료를 실제로 기다림 (signOut이 늦으면 confirm이 다시 뜨던 문제)
                    logout().then(function () { showLogin(); });
                }
                return;
            } catch (e) {
                logWarn('[로그인] sessionStorage 파싱 오류:', e);
            }
        } else {
            return;
        }
    }
    
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const loggedIn = sessionStorage.getItem('loggedIn');
    if (loggedInUser && loggedIn === "true") {
        return;
    }
    
    const overlay = document.getElementById('overlay');
    const loginContainer = document.getElementById('login-container');

    if (overlay) overlay.style.display = 'block';
    if (loginContainer) loginContainer.style.display = 'block';
    showAuthTab('login');
    ensureRememberIdUI();
}

// '아이디 저장' 체크박스 — 로그인 폼은 페이지마다 정적 복제라 auth.js가 런타임에 한 곳에서 주입.
// 체크 시 로그인 성공한 이메일을 localStorage('savedLoginId')에 저장, 다음 로그인 창에서 자동 입력.
function ensureRememberIdUI() {
    const form = document.getElementById('login-form');
    if (form && !document.getElementById('remember-id')) {
        const pw = document.getElementById('password');
        const row = document.createElement('label');
        row.id = 'remember-id-row';
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:8px 2px 0;font-size:13px;color:#555;cursor:pointer;user-select:none;text-align:left;';
        row.innerHTML = '<input type="checkbox" id="remember-id" style="width:auto;margin:0;accent-color:#44aa6b;"> 아이디 저장';
        if (pw && pw.parentNode === form) form.insertBefore(row, pw.nextSibling);
        else form.appendChild(row);
    }
    try {
        const saved = localStorage.getItem('savedLoginId') || '';
        const chk = document.getElementById('remember-id');
        const userEl = document.getElementById('username');
        if (chk) chk.checked = !!saved;
        if (saved && userEl && !userEl.value) userEl.value = saved;
    } catch (e) { /* localStorage 접근 불가 환경은 무시 */ }
}

function hideLogin() {
    const overlay = document.getElementById('overlay');
    const loginContainer = document.getElementById('login-container');
    
    if (overlay) overlay.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'none';
    
    const fields = ['username', 'password', 'reg-password', 'reg-password-confirm', 'reg-name', 'reg-position', 'reg-org', 'reg-email', 'reg-phone'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

// 로그인 버튼 로딩 스피너 (전 페이지 공통 — onclick="login()" 제출 버튼 대상)
function ensureAuthSpinnerStyle() {
    if (document.getElementById('auth-spinner-style')) return;
    var st = document.createElement('style');
    st.id = 'auth-spinner-style';
    st.textContent = '@keyframes authSpin{to{transform:rotate(360deg)}}'
        + '.auth-spinner{display:inline-block;width:15px;height:15px;margin-right:8px;vertical-align:-2px;'
        + 'border:2px solid rgba(255,255,255,.45);border-top-color:#fff;border-radius:50%;'
        + 'animation:authSpin .7s linear infinite;}'
        + '.login-container button.auth-btn-loading{opacity:.9;cursor:default;}';
    document.head.appendChild(st);
}
function setLoginBtnLoading(loading) {
    try {
        ensureAuthSpinnerStyle();
        var btns = document.querySelectorAll('button[onclick="login()"]');
        btns.forEach(function (btn) {
            if (loading) {
                if (btn.dataset.origHtml == null) btn.dataset.origHtml = btn.innerHTML;
                btn.disabled = true;
                btn.classList.add('auth-btn-loading');
                btn.innerHTML = '<span class="auth-spinner"></span>로그인 중…';
            } else {
                btn.disabled = false;
                btn.classList.remove('auth-btn-loading');
                if (btn.dataset.origHtml != null) { btn.innerHTML = btn.dataset.origHtml; delete btn.dataset.origHtml; }
            }
        });
    } catch (e) { /* 무시 */ }
}
// 회원가입(가입 신청) 버튼 로딩 스피너 — 클릭된 버튼에 스피너, 두 버튼 모두 비활성
function setRegisterBtnLoading(loading, userTypeArg) {
    try {
        ensureAuthSpinnerStyle();
        var btns = document.querySelectorAll('#reg-submit-employee, #reg-submit-general, button[onclick^="register("]');
        var seen = [];
        btns.forEach(function (btn) {
            if (seen.indexOf(btn) !== -1) return; seen.push(btn);
            var oc = btn.getAttribute('onclick') || '';
            var isTarget = !userTypeArg
                || oc.indexOf("register('" + userTypeArg + "')") !== -1
                || oc.indexOf('register("' + userTypeArg + '")') !== -1
                || oc.indexOf('register()') !== -1;   // 레거시 단일 버튼
            if (loading) {
                btn.disabled = true;
                if (isTarget) {
                    if (btn.dataset.origHtml == null) btn.dataset.origHtml = btn.innerHTML;
                    btn.classList.add('auth-btn-loading');
                    btn.innerHTML = '<span class="auth-spinner"></span>가입 신청 중…';
                }
            } else {
                btn.disabled = false;
                btn.classList.remove('auth-btn-loading');
                if (btn.dataset.origHtml != null) { btn.innerHTML = btn.dataset.origHtml; delete btn.dataset.origHtml; }
            }
        });
    } catch (e) { /* 무시 */ }
}

async function login() {
    console.log('[로그인] login() 함수 호출됨');
    
    if (isLoggingIn) {
        console.warn('[로그인] 이미 로그인 진행 중입니다.');
        alert('로그인 처리 중입니다. 잠시만 기다려주세요.');
        return;
    }
    
    if (auth && auth.currentUser) {
        console.warn('[로그인] 이미 로그인된 상태입니다. UID:', auth.currentUser.uid);
        alert('이미 로그인되어 있습니다.');
        return;
    }
    
    isLoggingIn = true;
    
    try {
        const usernameEl = document.getElementById('username');
        const passwordEl = document.getElementById('password');

        console.log('[로그인] 입력 필드 확인 - usernameEl:', !!usernameEl, 'passwordEl:', !!passwordEl);

        if (!usernameEl || !passwordEl) {
            console.error('[로그인] 입력 필드를 찾을 수 없음');
            alert('로그인 입력 필드를 찾을 수 없습니다.');
            isLoggingIn = false;
            return;
        }
        
        const emailOrUsername = usernameEl.value.trim();
        const password = passwordEl.value;

        console.log('[로그인] 입력값 확인 - email:', emailOrUsername ? '입력됨' : '비어있음', 'password:', password ? '입력됨' : '비어있음');

        if (!emailOrUsername || !password) {
            console.warn('[로그인] 입력값이 비어있음');
            alert('아이디와 비밀번호를 입력해주세요.');
            isLoggingIn = false;
            return;
        }

        console.log('[로그인] Firebase 초기화 확인 - auth:', !!auth, 'authDb:', !!authDb);

        if (!auth || !authDb) {
            console.log('[로그인] Firebase 재초기화 시도');
            const result = await initFirebase();
            if (result) {
                auth = result.auth;
                authDb = result.db;
                console.log('[로그인] Firebase 재초기화 완료');
            } else {
                console.error('[로그인] Firebase 재초기화 실패');
                alert('Firebase 초기화 중 오류가 발생했습니다.\n페이지를 새로고침 후 다시 시도해주세요.');
                isLoggingIn = false;
                return;
            }
        }

        if (!auth) {
            console.error('[로그인] auth 객체가 없음');
            alert('서버 연결에 실패했습니다.\n페이지를 새로고침 후 다시 시도해주세요.');
            isLoggingIn = false;
            return;
        }

        if (!emailOrUsername.includes('@')) {
            console.warn('[로그인] 이메일 형식이 아님:', emailOrUsername);
            alert('이메일 주소로 로그인해주세요.\nusername으로는 로그인할 수 없습니다.');
            isLoggingIn = false;
            return;
        }
        
        console.log('[로그인] signInWithEmailAndPassword 호출 시작...');
        setLoginBtnLoading(true);   // 로그인 처리 시작 → 버튼 스피너
        const userCredential = await auth.signInWithEmailAndPassword(emailOrUsername, password);
        const user = userCredential.user;
        
        console.log('[LOGIN OK] UID:', user.uid);
        console.log('[로그인] Firebase Auth 로그인 성공');

        // 아이디 저장: 체크 시 저장, 해제 시 삭제 (hideLogin이 입력값을 지우기 전에 처리)
        try {
            const rememberChk = document.getElementById('remember-id');
            if (rememberChk && rememberChk.checked) localStorage.setItem('savedLoginId', emailOrUsername);
            else localStorage.removeItem('savedLoginId');
        } catch (e) { /* 무시 */ }

        // 사인인 성공 즉시 스피너 해제 + 모달 닫기 (체감 지연 최소화).
        // 최종 로그인 UI는 onAuthStateChanged가 처리한다.
        setLoginBtnLoading(false);
        hideLogin();
        isLoggingIn = false;
        console.log('[로그인] 로그인 모달 숨김 - onAuthStateChanged에서 최종 처리 대기');

        // 토큰 강제 갱신은 로그인 직후엔 불필요(토큰이 이미 최신, 커스텀 클레임 미사용)하므로
        // 블로킹하지 않고 백그라운드로만 워밍(있어도 로그인 완료를 지연시키지 않음).
        user.getIdToken().catch(function (tokenError) {
            console.warn('[로그인] 토큰 워밍 오류(무시 가능):', tokenError);
        });

    } catch (error) {
        isLoggingIn = false;
        setLoginBtnLoading(false);  // 오류 시 버튼 원복(재시도 가능)
        console.error('[로그인] 오류 발생:', error);
        console.error('[로그인] 오류 코드:', error.code);
        console.error('[로그인] 오류 메시지:', error.message);
        
        if (error.code === 'auth/user-not-found') {
            alert('존재하지 않는 계정입니다.\n회원가입이 필요합니다.');
        } else if (error.code === 'auth/wrong-password') {
            alert('비밀번호가 일치하지 않습니다.');
        } else if (error.code === 'auth/invalid-credential') {
            alert('로그인 정보가 올바르지 않습니다.\n이메일과 비밀번호를 확인해주세요.');
        } else if (error.code === 'auth/invalid-email') {
            alert('올바른 이메일 형식을 입력해주세요.');
        } else if (error.code === 'auth/too-many-requests') {
            alert('로그인 시도가 너무 많습니다.\n잠시 후 다시 시도해주세요.');
        } else if (error.code === 'auth/network-request-failed') {
            alert('네트워크 연결에 실패했습니다.\n인터넷 연결을 확인해주세요.');
        } else {
            const errorMsg = error.message || '알 수 없는 오류';
            const errorCode = error.code || 'N/A';
            console.error('[로그인] 알 수 없는 오류:', errorMsg, '코드:', errorCode);
            alert('로그인 중 오류가 발생했습니다.\n\n오류: ' + errorMsg + '\n오류 코드: ' + errorCode);
        }
    }
}

async function register(userTypeArg) {
    log('[회원가입] register() 함수 호출됨 - userType:', userTypeArg);

    // 연타/중복 진입 차단 — 첫 await(initFirebase) 이전에 걸어야 초기화 지연 중 이중 가입 시도가 안 생김
    if (isRegistering) {
        alert('가입 신청 처리 중입니다. 잠시만 기다려주세요.');
        return;
    }

    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const orgEl = document.getElementById('reg-org');
    const org = orgEl ? orgEl.value.trim() : '';
    const positionEl = document.getElementById('reg-position');
    const position = positionEl ? positionEl.value.trim() : '';
    // 회원유형: 가입 버튼이 넘긴 값('employee-hq'/'employee'/'general') 우선, 없으면 (구) 드롭다운 → 기본 general
    // 'employee-hq'(본사 임직원)는 userType='employee' + empGroup='hq'로 저장(임직원 권한 동일, 연월차 결재 구분용)
    const rawType = userTypeArg
        || (document.getElementById('reg-user-type') ? document.getElementById('reg-user-type').value : 'general');
    const empGroup = rawType === 'employee-hq' ? 'hq' : '';
    const userType = rawType === 'employee-hq' ? 'employee' : rawType;
    // 아이디와 이메일 통합: 이메일을 아이디(username)로 사용
    const username = email;

    if (!password || !name || !email) {
        alert('필수 항목을 모두 입력해주세요.\n(이메일, 비밀번호, 이름)');
        return;
    }

    if (password.length < 6) {
        alert('비밀번호는 6자 이상이어야 합니다.');
        return;
    }

    if (password !== passwordConfirm) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }

    if (!email.includes('@')) {
        alert('올바른 이메일 형식을 입력해주세요.');
        return;
    }

    // 일반회원은 직급 / 직책 필수 (임직원은 선택 — 관리자가 회원관리에서 보완 가능)
    if (userType === 'general' && !position) {
        alert('일반회원은 직급 / 직책을 입력해주세요.');
        return;
    }

    isRegistering = true;   // 이 시점부터 onAuthStateChanged가 임시 사인인을 무시(유령 세션 방지)
    try {
        if (!auth || !authDb) {
            const result = await initFirebase();
            if (result) {
                auth = result.auth;
                authDb = result.db;
            }
        }

        if (!auth || !authDb) {
            alert('서버 연결에 실패했습니다.\n페이지를 새로고침 후 다시 시도해주세요.');
            return;
        }

        setRegisterBtnLoading(true, userTypeArg);   // 가입 신청 처리 시작 → 버튼 스피너

        // 가입 도중 실패 시 계정 정리 폴백 — users 문서 없는 Auth 계정이 남으면
        // 같은 이메일 재가입이 email-already-in-use로 영구히 막히므로, 어떤 실패든 삭제를 시도한다.
        // (delete 자체가 실패하면 최소한 signOut으로 로그인 잔류만이라도 정리)
        const cleanupAccount = async (user) => {
            try { await user.delete(); }
            catch (delErr) {
                logError('[회원가입] 계정 롤백(delete) 실패:', delErr);
                try { await auth.signOut(); } catch (e2) { /* 무시 */ }
            }
        };

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            try {
                await user.getIdToken(true);
            } catch (tokenError) {
                logError('[회원가입] 인증 토큰 준비 오류:', tokenError);
                await cleanupAccount(user);
                alert('인증 토큰을 가져올 수 없습니다.\n다시 시도해주세요.');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            try {
                const userDocRef = authDb.collection('users').doc(user.uid);
                await userDocRef.set({
                    uid: user.uid,
                    username: username,
                    name: name,
                    email: email,
                    phone: phone || '',
                    org: org || '',
                    position: position || '',
                    userType: userType,
                    empGroup: empGroup,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isAdmin: false
                });
            } catch (setError) {
                logError('[회원가입] Firestore 저장 오류:', setError);
                // 사유 불문 계정 정리 (이전에는 permission-denied만 정리해 고아 계정이 남았음)
                await cleanupAccount(user);
                if (setError.code === 'permission-denied') {
                    alert('사용자 정보 저장 권한이 없습니다.\nFirestore 보안 규칙을 확인해주세요.');
                } else {
                    alert('가입 정보 저장에 실패했습니다.\n네트워크 상태를 확인한 뒤 같은 이메일로 다시 가입 신청해주세요.\n(' + (setError.message || '') + ')');
                }
                return;
            }

            // 가입 성공 확정 — signOut 실패는 가입 성공 안내를 막지 않는다 (성공을 오류로 오인시키던 문제 방지)
            try { await auth.signOut(); }
            catch (soErr) { logWarn('[회원가입] 가입 후 로그아웃 실패(가입 자체는 완료):', soErr); }
            // 가입 절차 중 세션 흔적 정리 (리스너는 isRegistering으로 차단되지만 이중 안전장치)
            authEpoch++;
            sessionStorage.removeItem('loggedInUser');
            sessionStorage.removeItem('loggedIn');
            document.documentElement.setAttribute('data-auth', 'out');
            alert('회원가입 신청이 완료되었습니다.\n관리자 승인 후 로그인이 가능합니다.');
            hideLogin();

        } catch (error) {
            logError('[회원가입] 오류:', error);

            if (error.code === 'auth/email-already-in-use') {
                alert('이미 사용 중인 이메일입니다.');
            } else if (error.code === 'auth/invalid-email') {
                alert('올바른 이메일 형식을 입력해주세요.');
            } else if (error.code === 'auth/weak-password') {
                alert('비밀번호가 너무 약합니다.\n6자 이상 입력해주세요.');
            } else if (error.code === 'permission-denied') {
                alert('권한이 없습니다.\n관리자에게 문의해주세요.');
            } else {
                alert('회원가입 중 오류가 발생했습니다.\n' + (error.message || '잠시 후 다시 시도해주세요.'));
            }
        } finally {
            setRegisterBtnLoading(false);   // 성공·오류·중단 모든 경우 버튼 원복
        }
    } finally {
        isRegistering = false;
    }
}

async function logout() {
    log('[로그아웃] logout() 함수 호출');
    
    try {
        if (autoLogoutTimer) {
            clearTimeout(autoLogoutTimer);
            autoLogoutTimer = null;
        }
        if (autoLogoutWarningTimer) {
            clearTimeout(autoLogoutWarningTimer);
            autoLogoutWarningTimer = null;
        }
        if (logoutTimerUpdateInterval) {
            clearInterval(logoutTimerUpdateInterval);
            logoutTimerUpdateInterval = null;
        }
        
        const warningModal = document.getElementById('auto-logout-warning');
        if (warningModal) {
            warningModal.remove();
        }
        
        if (auth) {
            await auth.signOut();
        }

        authEpoch++; sessionStorage.removeItem("loggedInUser");
        sessionStorage.removeItem("loggedIn");
        userDataCache = null; // 캐시 초기화
        setLoggedInState(false);
        // 다른 탭에 로그아웃 전파 (Auth는 LOCAL 공유라 이미 로그아웃 — 각 탭의 sessionStorage/UI도 정리시킴)
        try { localStorage.setItem('authLogoutAt', String(Date.now())); } catch (e) {}
        
        if (!warningShown || Date.now() - lastActivityTime < AUTO_LOGOUT_TIME) {
            alert('로그아웃되었습니다.');
        }
        
        const currentPath = window.location.pathname;
        if (currentPath.includes('staff.html')) {
            const homePath = currentPath.includes('/hanaro/staff/') 
                ? '../../index.html' 
                : currentPath.includes('/staff/')
                ? '../../../index.html'
                : '/index.html';
            window.location.href = homePath;
            return;
        }
    } catch (error) {
        logError('[로그아웃] 오류:', error);
        authEpoch++; sessionStorage.removeItem("loggedInUser");
        sessionStorage.removeItem("loggedIn");
        userDataCache = null;
        setLoggedInState(false);
        
        const currentPath = window.location.pathname;
        if (currentPath.includes('staff.html')) {
            const homePath = currentPath.includes('/hanaro/staff/') 
                ? '../../index.html' 
                : currentPath.includes('/staff/')
                ? '../../../index.html'
                : '/index.html';
            window.location.href = homePath;
            return;
        }
    }
}

// (제거됨) 기존 pagehide 핸들러는 탭 닫기뿐 아니라 '모든 페이지 이동'에서 발화해
// 매 내비게이션마다 로그인 캐시(sessionStorage)를 지웠고, <html data-auth> 첫 페인트 설계를 무력화했다.
// 탭이 닫히면 sessionStorage는 브라우저가 자동 소거하고 Firebase signOut은 애초에 호출하지 않았으므로
// 보안 효과도 없어 핸들러 자체를 제거함. "탭을 닫으면 로그아웃" 정책이 필요해지면
// persistence를 SESSION으로 바꾸는 것이 올바른 수단이다. — 재도입 금지.

// 다른 탭에서의 로그아웃을 이 탭에도 반영 (storage 이벤트는 다른 탭에서만 발화)
window.addEventListener('storage', function (e) {
    if (e.key === 'authLogoutAt' && e.newValue) {
        log('[멀티탭] 다른 탭 로그아웃 감지 — 이 탭 세션 정리');
        authEpoch++;
        sessionStorage.removeItem('loggedInUser');
        sessionStorage.removeItem('loggedIn');
        userDataCache = null;
        document.documentElement.setAttribute('data-auth', 'out');
        setLoggedInState(false);
        if (typeof window.checkStaffAccess === 'function') {
            try { window.checkStaffAccess(null, null); } catch (err) { /* 무시 */ }
        }
    }
});

function getCurrentUser() {
    const userStr = sessionStorage.getItem("loggedInUser");
    if (userStr) {
        return JSON.parse(userStr);
    }
    return null;
}

function isAdmin() {
    const user = getCurrentUser();
    return user && user.isAdmin === true;
}

document.addEventListener('DOMContentLoaded', function() {
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            const loginContainer = document.getElementById('login-container');
            const drawer = document.getElementById('mobile-nav');
            if (loginContainer && loginContainer.style.display === 'block' && 
                (!drawer || !drawer.classList.contains('open'))) {
                hideLogin();
            }
        });
    }
});

// ================= 마이페이지 (내 정보 수정) — 전 페이지 공통, auth.js가 동적 주입 =================
// 로그인한 사용자가 이름·연락처·소속·직급/직책을 직접 수정하고 비밀번호를 변경한다.
// 이메일(로그인 아이디)·회원유형·권한·승인상태는 수정 불가(관리자 영역).
// Firestore 규칙도 본인 수정은 name/phone/org/position 4개 필드만 허용하도록 축소되어 있음.
function ensureMyPageStyle() {
    if (document.getElementById('mypage-style')) return;
    var st = document.createElement('style');
    st.id = 'mypage-style';
    st.textContent =
        // '내 정보' — 작은 알약(pill) 버튼. 로그아웃 뒤에 배치.
        '#mypage-link{cursor:pointer;text-decoration:none;align-items:center;gap:4px;padding:6px 14px;border-radius:999px;background:#eef1f4;color:#0071e3;font-size:13px;font-weight:600;line-height:1;white-space:nowrap;}' +
        '#mypage-link:hover{background:#e2e8f2;}' +
        'html[data-auth="in"] #mypage-link{display:inline-flex!important}' +
        'html[data-auth="out"] #mypage-link{display:none!important}' +
        // 임직원 버튼도 동일한 알약(pill) 모양으로 통일(전 페이지 공통 오버라이드)
        '.employee-btn button{border-radius:999px!important;}' +
        // 데스크탑: '내 정보'와 '임직원' 알약 크기 통일(폰트 14px·패딩 6px 14px·높이 26px).
        // index.html의 `.navbar > .login > a{padding:0!important}` 리셋이 #mypage-link 패딩을 지우던 것을
        // ID+!important로 이겨 알약을 복원하고, 임직원 버튼은 line-height:1로 높이를 내정보와 맞춘다.
        // (min-width 스코프: 모바일 페이지별 임직원 버튼 규칙을 건드리지 않기 위함)
        '@media (min-width:769px){' +
          '#mypage-link{font-size:14px!important;padding:6px 14px!important;}' +
          '.employee-btn button{font-size:14px!important;padding:6px 14px!important;line-height:1!important;}' +
          // 호버도 '내 정보'와 동일한 방식으로: 배경만 살짝 진해짐(떠오름 transform·그림자 확대 애니 제거)
          '.employee-btn button:not(:disabled):hover{transform:none!important;box-shadow:0 2px 8px rgba(68,170,107,.3)!important;background:linear-gradient(135deg,#3d9d61 0%,#347f50 100%)!important;}' +
        '}' +
        // 로그인/로그아웃은 아이콘만 표시(텍스트 제거됨) → 아이콘 우측 여백 제거
        '#login-link .login-icon, #logout-link .login-icon{margin-right:0!important;}' +
        // 모바일: 로그인/로그아웃 아이콘과 '내 정보' 글씨를 크게(페이지 모바일 규칙 14px를 id 선택자로 오버라이드)
        '@media (max-width:768px){' +
          '#login-link .login-icon, #logout-link .login-icon{height:22px!important;width:auto!important;margin-right:0!important;}' +
          '#mypage-link{font-size:15px!important;padding:8px 16px!important;}' +
        '}' +
        '#mypage-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100000;}' +
        '#mypage-modal{display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100001;width:400px;max-width:92vw;max-height:88vh;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.25);padding:26px 24px;box-sizing:border-box;text-align:left;}' +
        '#mypage-modal h3{margin:0 0 4px;font-size:20px;color:#1d1d1f;}' +
        '#mypage-modal .mp-sub{margin:0 0 10px;font-size:13px;color:#8a8f98;}' +
        '#mypage-modal label{display:block;font-size:12px;color:#6b7280;margin:12px 0 5px;font-weight:600;}' +
        '#mypage-modal input{width:100%;box-sizing:border-box;padding:11px 13px;border:1px solid #d5d9e0;border-radius:10px;font-size:14px;background:#fff;color:#1d1d1f;}' +
        '#mypage-modal input:disabled{background:#f1f3f5;color:#868e96;}' +
        '#mypage-modal .mp-hr{border:none;border-top:1px solid #eee;margin:22px 0 2px;}' +
        '#mypage-modal .mp-row{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;}' +
        '#mypage-modal button{padding:11px 22px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;}' +
        '#mypage-modal .mp-cancel{background:#eef0f3;color:#444;}' +
        '#mypage-modal .mp-save{background:linear-gradient(135deg,#0071e3,#005bb5);color:#fff;}' +
        '#mypage-modal .mp-pw{background:#eef1f4;color:#0071e3;}';
    document.head.appendChild(st);
}
// 헤더에 '내 정보' 알약 버튼 삽입 — '로그아웃' 바로 뒤(로그아웃 → 내 정보 → 임직원 순).
// 로그인 상태에서만 표시(data-auth CSS).
function ensureMyPageLink() {
    if (document.getElementById('mypage-link')) return;
    var logoutLink = document.getElementById('logout-link');
    if (!logoutLink || !logoutLink.parentNode) return;
    var a = document.createElement('a');
    a.href = '#';
    a.id = 'mypage-link';
    a.setAttribute('onclick', 'showMyPage(); return false;');
    a.textContent = '내 정보';
    logoutLink.insertAdjacentElement('afterend', a);   // 로그아웃 뒤에 배치
}
function ensureMyPageModal() {
    if (document.getElementById('mypage-modal')) return;
    var ov = document.createElement('div');
    ov.id = 'mypage-overlay';
    ov.setAttribute('onclick', 'hideMyPage()');
    var m = document.createElement('div');
    m.id = 'mypage-modal';
    m.innerHTML =
        '<h3>내 정보 수정</h3>' +
        '<p class="mp-sub">이메일·이름·연락처·회원유형은 관리자만 변경할 수 있습니다. 소속·직급/직책만 수정할 수 있습니다.</p>' +
        '<label>이메일 (로그인 아이디)</label><input id="mp-email" type="email" disabled>' +
        '<label>이름</label><input id="mp-name" type="text" placeholder="이름" disabled>' +
        '<label>연락처</label><input id="mp-phone" type="tel" placeholder="연락처" disabled>' +
        '<label>소속</label><input id="mp-org" type="text" placeholder="소속">' +
        '<label>직급 / 직책</label><input id="mp-position" type="text" placeholder="직급 / 직책">' +
        '<div class="mp-row"><button type="button" class="mp-cancel" onclick="hideMyPage()">취소</button>' +
        '<button type="button" class="mp-save" onclick="saveMyPage()">저장</button></div>' +
        '<hr class="mp-hr">' +
        '<label>비밀번호 변경 (선택)</label>' +
        '<input id="mp-pw-current" type="password" placeholder="현재 비밀번호" autocomplete="current-password">' +
        '<input id="mp-pw-new" type="password" placeholder="새 비밀번호 (6자 이상)" autocomplete="new-password" style="margin-top:8px;">' +
        '<input id="mp-pw-confirm" type="password" placeholder="새 비밀번호 확인" autocomplete="new-password" style="margin-top:8px;">' +
        '<div class="mp-row"><button type="button" class="mp-pw" onclick="changeMyPassword()">비밀번호 변경</button></div>';
    document.body.appendChild(ov);
    document.body.appendChild(m);
}
function myPageUser() {
    try { return JSON.parse(sessionStorage.getItem('loggedInUser') || '{}'); } catch (e) { return {}; }
}
function showMyPage() {
    if (sessionStorage.getItem('loggedIn') !== 'true') { showLogin(); return; }
    ensureMyPageStyle(); ensureMyPageModal();
    var u = myPageUser();
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; };
    set('mp-email', u.email || u.username);
    set('mp-name', u.name);
    set('mp-phone', u.phone);
    set('mp-org', u.org);
    set('mp-position', u.position);
    ['mp-pw-current', 'mp-pw-new', 'mp-pw-confirm'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('mypage-overlay').style.display = 'block';
    document.getElementById('mypage-modal').style.display = 'block';
    // 최신 정보로 폼 갱신(Firestore) — 실패해도 세션값으로 표시됨
    if (auth && auth.currentUser && typeof fetchUserData === 'function') {
        fetchUserData(auth.currentUser.uid, true).then(function (fresh) {
            if (!fresh || document.getElementById('mypage-modal').style.display !== 'block') return;
            set('mp-email', fresh.email || fresh.username);
            set('mp-name', fresh.name);
            set('mp-phone', fresh.phone);
            set('mp-org', fresh.org);
            set('mp-position', fresh.position);
        }).catch(function () {});
    }
}
function hideMyPage() {
    var ov = document.getElementById('mypage-overlay');
    var m = document.getElementById('mypage-modal');
    if (ov) ov.style.display = 'none';
    if (m) m.style.display = 'none';
}
async function saveMyPage() {
    if (!auth || !auth.currentUser || !authDb) { alert('로그인 상태를 확인할 수 없습니다.\n다시 로그인해 주세요.'); return; }
    if (saveMyPage._busy) return; // 연타 가드
    saveMyPage._busy = true;
    // 이름·연락처는 관리자만 수정 가능 → 여기선 소속·직급/직책만 저장(Firestore 규칙도 이 둘만 허용)
    var org = (document.getElementById('mp-org').value || '').trim();
    var position = (document.getElementById('mp-position').value || '').trim();
    var uid = auth.currentUser.uid;
    try {
        await authDb.collection('users').doc(uid).update({ org: org, position: position });
        // 세션·캐시 갱신
        var u = myPageUser();
        u.org = org; u.position = position;
        sessionStorage.setItem('loggedInUser', JSON.stringify(u));
        if (typeof userDataCache !== 'undefined' && userDataCache && userDataCache.uid === uid) {
            userDataCache.org = org; userDataCache.position = position;
        }
        alert('내 정보가 저장되었습니다.');
        hideMyPage();
    } catch (e) {
        logError('[마이페이지] 저장 실패:', e);
        if (e && e.code === 'permission-denied') alert('저장 권한이 없습니다.\n보안 규칙을 확인해 주세요.');
        else alert('저장 중 오류가 발생했습니다.\n' + (e && e.message ? e.message : ''));
    } finally {
        saveMyPage._busy = false;
    }
}
async function changeMyPassword() {
    if (!auth || !auth.currentUser) { alert('로그인 상태를 확인할 수 없습니다.'); return; }
    if (changeMyPassword._busy) return; // 연타 가드 — 두 번째 reauth가 옛 비밀번호로 실패해 "방금 성공했는데 오류" 혼란을 일으키던 문제
    changeMyPassword._busy = true;
    var cur = document.getElementById('mp-pw-current').value;
    var nw = document.getElementById('mp-pw-new').value;
    var cf = document.getElementById('mp-pw-confirm').value;
    try {
        if (!cur || !nw || !cf) { alert('현재 비밀번호와 새 비밀번호를 모두 입력해주세요.'); return; }
        if (nw.length < 6) { alert('새 비밀번호는 6자 이상이어야 합니다.'); return; }
        if (nw !== cf) { alert('새 비밀번호가 일치하지 않습니다.'); return; }
        var user = auth.currentUser;
        var cred = firebase.auth.EmailAuthProvider.credential(user.email, cur);
        await user.reauthenticateWithCredential(cred);
        await user.updatePassword(nw);
        ['mp-pw-current', 'mp-pw-new', 'mp-pw-confirm'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
        alert('비밀번호가 변경되었습니다.');
    } catch (e) {
        logError('[마이페이지] 비밀번호 변경 실패:', e);
        if (e && (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential')) alert('현재 비밀번호가 올바르지 않습니다.');
        else if (e && e.code === 'auth/weak-password') alert('새 비밀번호가 너무 약합니다.');
        else if (e && e.code === 'auth/requires-recent-login') alert('보안을 위해 다시 로그인한 뒤 시도해주세요.');
        else alert('비밀번호 변경 중 오류가 발생했습니다.\n' + (e && e.message ? e.message : ''));
    } finally {
        changeMyPassword._busy = false;
    }
}

if (typeof window !== 'undefined') {
    window.showLogin = showLogin;
    window.hideLogin = hideLogin;
    window.logout = logout;
    window.login = login;
    window.register = register;
    window.showAuthTab = showAuthTab;
    window.showMyPage = showMyPage;
    window.hideMyPage = hideMyPage;
    window.saveMyPage = saveMyPage;
    window.changeMyPassword = changeMyPassword;
    console.log('[auth.js] UI 핸들러 함수가 window 전역에 노출되었습니다.');
    console.log('[auth.js] login 함수 확인:', typeof window.login === 'function' ? '정의됨' : '정의되지 않음');
}
