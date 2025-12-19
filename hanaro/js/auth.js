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
let isInitializing = false;
let isLoggingIn = false;

// Firestore 조회 캐시 (중복 조회 방지)
let userDataCache = null;
let userDataCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// Firebase 초기화 (싱글톤 패턴)
async function initFirebase() {
    if (firebaseApp && auth && authDb) {
        log('[Firebase 초기화] 이미 초기화됨, 재사용');
        return { app: firebaseApp, auth: auth, db: authDb };
    }
    
    if (isInitializing) {
        log('[Firebase 초기화] 초기화 중, 대기...');
        return null;
    }
    
    isInitializing = true;
    
    try {
        if (typeof firebase === 'undefined') {
            logWarn('[Firebase 초기화] Firebase SDK가 로드되지 않았습니다.');
            isInitializing = false;
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
        isInitializing = false;
        return { app: firebaseApp, auth: auth, db: authDb };
    } catch (error) {
        logError('[Firebase 초기화] 실패:', error);
        isInitializing = false;
        return null;
    }
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
        console.warn('[Firestore] 접근 실패했지만 기본 정보로 로그인 상태 유지');
        return {
            uid: uid,
            email: auth.currentUser?.email || '',
            userType: 'guest',
            isAdmin: false
        };
    }
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
                                if (userData) {
                                    sessionStorage.setItem("loggedInUser", JSON.stringify(userData));
                                    sessionStorage.setItem("loggedIn", "true");
                                    // UI는 이미 올바른 상태이므로 임직원 버튼만 업데이트
                                    const isEmployee = userData.userType === 'employee' || userData.isAdmin === true;
                                    document.querySelectorAll('.employee-button, #employee-button, #employee-button-mobile').forEach(btn => {
                                        btn.disabled = !isEmployee;
                                    });
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
                    isAdmin: false
                };
            }
            
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
                                sessionStorage.removeItem("loggedInUser");
                                sessionStorage.removeItem("loggedIn");
                                userDataCache = null;
                                return;
                            }
                            setLoggedInState(false);
                            sessionStorage.removeItem("loggedInUser");
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
                sessionStorage.removeItem("loggedInUser");
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
                                sessionStorage.removeItem("loggedInUser");
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
                sessionStorage.removeItem("loggedInUser");
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

// 즉시 실행: DOMContentLoaded 전에 초기 상태 설정 (깜빡임 방지, 비동기 처리)
(function() {
    const loggedInUser = sessionStorage.getItem("loggedInUser");
    const loggedIn = sessionStorage.getItem("loggedIn");
    
    function setInitialState() {
        // requestAnimationFrame으로 비동기 처리하여 렌더링 블로킹 방지
        requestAnimationFrame(function() {
            const loginLink = document.getElementById('login-link');
            const logoutLink = document.getElementById('logout-link');
            
            if (loggedInUser && loggedIn === "true") {
                try {
                    const userData = JSON.parse(loggedInUser);
                    // 즉시 UI 업데이트
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
                    // 임직원 버튼 상태 설정 (비동기)
                    requestAnimationFrame(function() {
                        const isEmployee = userData.userType === 'employee' || userData.isAdmin === true;
                        document.querySelectorAll('.employee-button, #employee-button, #employee-button-mobile').forEach(btn => {
                            btn.disabled = !isEmployee;
                        });
                    });
                } catch (e) {
                    logWarn('[즉시 실행] sessionStorage 파싱 오류');
                }
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
        });
    }
    
    // DOM이 준비되면 즉시 실행 (더 빠른 실행)
    if (document.readyState === 'loading') {
        // DOMContentLoaded 대신 interactive 상태에서 실행 (더 빠름)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setInitialState, { once: true });
        }
        // 또는 즉시 시도
        if (document.body) {
            setInitialState();
        }
    } else {
        setInitialState();
    }
})();

// 페이지 로드 시 인증 상태 확인 (비동기 처리로 블로킹 방지)
document.addEventListener('DOMContentLoaded', function() {
    // 활동 감지 리스너 설정 (중복 방지)
    if (!window.activityListenersSetup) {
        setupActivityListeners();
        window.activityListenersSetup = true;
    }
    
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
                                isAdmin: false
                            };
                        }
                        
                        // userData가 없으면 기본 정보 생성
                        if (!userData) {
                            userData = {
                                uid: currentUser.uid,
                                email: currentUser.email || '',
                                userType: 'guest',
                                isAdmin: false
                            };
                        }
                        
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
    
    const warningModal = document.getElementById('auto-logout-warning');
    if (warningModal) {
        warningModal.remove();
        warningShown = false;
    }
    
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
        }
    }, 3 * 60 * 1000);
}

async function autoLogout() {
    const warningModal = document.getElementById('auto-logout-warning');
    if (warningModal) {
        warningModal.remove();
    }
    
    const timerDisplay = document.getElementById('logout-timer');
    if (timerDisplay) {
        timerDisplay.remove();
    }
    
    await logout();
    alert('15분간 활동이 없어 자동으로 로그아웃되었습니다.');
}

function updateLogoutTimer() {
    if (!lastActivityTime || !sessionStorage.getItem("loggedIn")) {
        const timerDisplay = document.getElementById('logout-timer');
        if (timerDisplay) {
            timerDisplay.remove();
        }
        if (logoutTimerUpdateInterval) {
            clearInterval(logoutTimerUpdateInterval);
            logoutTimerUpdateInterval = null;
        }
        return;
    }
    
    const elapsed = Date.now() - lastActivityTime;
    const remaining = AUTO_LOGOUT_TIME - elapsed;
    
    if (remaining <= 0) {
        if (logoutTimerUpdateInterval) {
            clearInterval(logoutTimerUpdateInterval);
            logoutTimerUpdateInterval = null;
        }
        return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    let timerDisplay = document.getElementById('logout-timer');
    if (!timerDisplay) {
        const logoutLink = document.getElementById('logout-link');
        if (logoutLink) {
            timerDisplay = document.createElement('span');
            timerDisplay.id = 'logout-timer';
            timerDisplay.style.cssText = `
                display: inline-flex;
                align-items: center;
                padding: 4px 8px;
                margin-left: 6px;
                background: rgba(255, 255, 255, 0.95);
                border: 1px solid #dee2e6;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                font-size: 11px;
                color: #6c757d;
                font-weight: 500;
                line-height: 1.2;
                text-align: center;
                white-space: nowrap;
                vertical-align: middle;
            `;
            let inserted = false;
            for (let node of logoutLink.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '로그아웃') {
                    logoutLink.insertBefore(timerDisplay, node.nextSibling);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                logoutLink.appendChild(timerDisplay);
            }
        } else {
            return;
        }
    }
    
    if (remaining <= 3 * 60 * 1000) {
        timerDisplay.style.color = '#ff6b6b';
        timerDisplay.style.fontWeight = '600';
        timerDisplay.style.borderColor = '#ff6b6b';
        timerDisplay.style.background = 'rgba(255, 107, 107, 0.1)';
    } else {
        timerDisplay.style.color = '#6c757d';
        timerDisplay.style.fontWeight = '500';
        timerDisplay.style.borderColor = '#dee2e6';
        timerDisplay.style.background = 'rgba(255, 255, 255, 0.95)';
    }
    
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // setInterval 사용 (재귀적 setTimeout 대신)
    if (!logoutTimerUpdateInterval) {
        logoutTimerUpdateInterval = setInterval(updateLogoutTimer, 1000);
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
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        if (tabs[1]) tabs[1].classList.add('active');
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
                    logout();
                    setTimeout(() => {
                        showLogin();
                    }, 500);
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
}

function hideLogin() {
    const overlay = document.getElementById('overlay');
    const loginContainer = document.getElementById('login-container');
    
    if (overlay) overlay.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'none';
    
    const fields = ['username', 'password', 'reg-username', 'reg-password', 'reg-password-confirm', 'reg-name', 'reg-email', 'reg-phone'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
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
        const userCredential = await auth.signInWithEmailAndPassword(emailOrUsername, password);
        const user = userCredential.user;
        
        console.log('[LOGIN OK] UID:', user.uid);
        console.log('[로그인] Firebase Auth 로그인 성공');
        
        // 인증 토큰 갱신
        try {
            await user.getIdToken(true);
            console.log('[로그인] 인증 토큰 갱신 완료');
        } catch (tokenError) {
            console.warn('[로그인] 인증 토큰 새로고침 오류:', tokenError);
        }
        
        hideLogin();
        console.log('[로그인] 로그인 모달 숨김');
        
        // onAuthStateChanged에서 처리되므로 여기서는 플래그만 리셋
        isLoggingIn = false;
        console.log('[로그인] 로그인 프로세스 완료 - onAuthStateChanged에서 최종 처리 대기');

    } catch (error) {
        isLoggingIn = false;
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

async function register() {
    log('[회원가입] register() 함수 호출됨');
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const userType = document.getElementById('reg-user-type') ? document.getElementById('reg-user-type').value : 'general';

    if (!username || !password || !name || !email) {
        alert('필수 항목을 모두 입력해주세요.\n(아이디, 비밀번호, 이름, 이메일)');
        return;
    }

    if (username.length < 4) {
        alert('아이디는 4자 이상이어야 합니다.');
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

    if (username === 'admin') {
        alert('사용할 수 없는 아이디입니다.');
        return;
    }

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

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        try {
            await user.getIdToken(true);
        } catch (tokenError) {
            logError('[회원가입] 인증 토큰 준비 오류:', tokenError);
            await user.delete();
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
                userType: userType,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false
            });
        } catch (setError) {
            logError('[회원가입] Firestore 저장 오류:', setError);
            
            if (setError.code === 'permission-denied') {
                await user.delete();
                alert('사용자 정보 저장 권한이 없습니다.\nFirestore 보안 규칙을 확인해주세요.');
                return;
            }
            throw setError;
        }

        await auth.signOut();
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
        
        sessionStorage.removeItem("loggedInUser");
        sessionStorage.removeItem("loggedIn");
        userDataCache = null; // 캐시 초기화
        setLoggedInState(false);
        
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
        sessionStorage.removeItem("loggedInUser");
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

let isLoggingOut = false;

window.addEventListener('pagehide', function(event) {
    if (!isLoggingOut) {
        performAutoLogout();
    }
});

function performAutoLogout() {
    const isLoggedIn = sessionStorage.getItem("loggedIn");
    if (isLoggedIn === "true" && !isLoggingOut) {
        isLoggingOut = true;
        
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
            
            sessionStorage.removeItem("loggedInUser");
            sessionStorage.removeItem("loggedIn");
            userDataCache = null;
            setLoggedInState(false);
        } catch (error) {
            logError('[자동 로그아웃] 오류:', error);
            sessionStorage.removeItem("loggedInUser");
            sessionStorage.removeItem("loggedIn");
        }
    }
}

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

if (typeof window !== 'undefined') {
    window.showLogin = showLogin;
    window.hideLogin = hideLogin;
    window.logout = logout;
    window.login = login;
    window.register = register;
    window.showAuthTab = showAuthTab;
    console.log('[auth.js] UI 핸들러 함수가 window 전역에 노출되었습니다.');
    console.log('[auth.js] login 함수 확인:', typeof window.login === 'function' ? '정의됨' : '정의되지 않음');
}
