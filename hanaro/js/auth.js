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

// Firebase 초기화
let authDb = null;
let auth = null;

function initFirebase() {
try {
    if (typeof firebase !== 'undefined') {
        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
        authDb = firebase.firestore();
            auth = firebase.auth();
            console.log('Firebase 초기화 완료');
        } else {
            console.warn('Firebase SDK가 로드되지 않았습니다.');
    }
} catch (error) {
    console.warn('Firebase 초기화 실패:', error);
}
}

// 즉시 초기화 시도
initFirebase();

// 페이지 로드 시 인증 상태 확인
document.addEventListener('DOMContentLoaded', function() {
    // 활동 감지 리스너 설정
    setupActivityListeners();
    
    if (!auth) {
        initFirebase();
    }
    
    // Firebase Auth 상태 변경 감지
    if (auth) {
        auth.onAuthStateChanged(async function(user) {
            if (user) {
                // 로그인된 상태 - Firestore에서 사용자 정보 확인
                try {
                    const userDoc = await authDb.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        if (userData.status === 'approved' || userData.isAdmin) {
                            setLoggedInState(true, userData);
                            sessionStorage.setItem("loggedInUser", JSON.stringify({
                                uid: user.uid,
                                email: user.email,
                                ...userData
                            }));
                        } else {
                            // 승인되지 않은 사용자는 로그아웃
                            setLoggedInState(false);
                        }
                    }
                } catch (error) {
                    console.error('사용자 정보 로드 오류:', error);
                }
            } else {
                // 로그아웃 상태
                setLoggedInState(false);
                sessionStorage.removeItem("loggedInUser");
            }
        });
    } else {
        // Firebase가 없는 경우 세션 스토리지 확인
    const loggedInUser = sessionStorage.getItem("loggedInUser");
    if (loggedInUser) {
            setLoggedInState(true, JSON.parse(loggedInUser));
        }
    }
});

// 자동 로그아웃 타이머 관리
let autoLogoutTimer = null;
let autoLogoutWarningTimer = null;
let lastActivityTime = null;
const AUTO_LOGOUT_TIME = 15 * 60 * 1000; // 15분 (밀리초)
const WARNING_TIME = 12 * 60 * 1000; // 12분 (3분 전 알림)
let warningShown = false;

// 사용자 활동 감지
function resetAutoLogoutTimer() {
    if (!sessionStorage.getItem("loggedIn")) {
        return; // 로그인되지 않은 경우 타이머 시작 안 함
    }
    
    lastActivityTime = Date.now();
    
    // 경고 모달이 표시되어 있으면 제거
    const warningModal = document.getElementById('auto-logout-warning');
    if (warningModal) {
        warningModal.remove();
        warningShown = false;
    }
    
    // 기존 타이머 클리어
    if (autoLogoutTimer) {
        clearTimeout(autoLogoutTimer);
        autoLogoutTimer = null;
    }
    if (autoLogoutWarningTimer) {
        clearTimeout(autoLogoutWarningTimer);
        autoLogoutWarningTimer = null;
    }
    
    // 3분 전 알림 타이머 설정
    autoLogoutWarningTimer = setTimeout(() => {
        showAutoLogoutWarning();
    }, WARNING_TIME);
    
    // 자동 로그아웃 타이머 설정
    autoLogoutTimer = setTimeout(() => {
        autoLogout();
    }, AUTO_LOGOUT_TIME);
    
    updateLogoutTimer();
}

// 자동 로그아웃 경고 표시
function showAutoLogoutWarning() {
    if (warningShown) return;
    warningShown = true;
    
    // 경고 모달 생성
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
    
    // 확인 버튼 클릭 이벤트
    const confirmBtn = document.getElementById('warning-confirm-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            warningModal.remove();
            resetAutoLogoutTimer();
        });
    }
    
    // 3분 후 자동으로 모달 제거
    setTimeout(() => {
        if (warningModal.parentElement) {
            warningModal.remove();
        }
    }, 3 * 60 * 1000);
}

// 자동 로그아웃 실행
async function autoLogout() {
    // 경고 모달 제거
    const warningModal = document.getElementById('auto-logout-warning');
    if (warningModal) {
        warningModal.remove();
    }
    
    // 타이머 표시 제거
    const timerDisplay = document.getElementById('logout-timer');
    if (timerDisplay) {
        timerDisplay.remove();
    }
    
    // 로그아웃 실행
    await logout();
    alert('15분간 활동이 없어 자동으로 로그아웃되었습니다.');
}

// 로그아웃 타이머 표시 업데이트
function updateLogoutTimer() {
    if (!lastActivityTime || !sessionStorage.getItem("loggedIn")) {
        const timerDisplay = document.getElementById('logout-timer');
        if (timerDisplay) {
            timerDisplay.remove();
        }
        return;
    }
    
    const elapsed = Date.now() - lastActivityTime;
    const remaining = AUTO_LOGOUT_TIME - elapsed;
    
    if (remaining <= 0) {
        return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    let timerDisplay = document.getElementById('logout-timer');
    if (!timerDisplay) {
        // 타이머 표시 요소 생성
        const logoutLink = document.getElementById('logout-link');
        if (logoutLink) {
            // 타이머 생성 (로그아웃 글씨에 붙게)
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
            // 로그아웃 링크 내부에 추가 (텍스트 바로 옆)
            // 로그아웃 링크 구조: <a><img> 로그아웃</a>
            // 텍스트 노드를 찾아서 그 다음에 삽입
            let inserted = false;
            for (let node of logoutLink.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '로그아웃') {
                    logoutLink.insertBefore(timerDisplay, node.nextSibling);
                    inserted = true;
                    break;
                }
            }
            // 텍스트 노드를 찾지 못한 경우 링크 끝에 추가
            if (!inserted) {
                logoutLink.appendChild(timerDisplay);
            }
        } else {
            return;
        }
    }
    
    // 3분 이하일 때 빨간색으로 표시
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
    
    // 1초마다 업데이트
    setTimeout(updateLogoutTimer, 1000);
}

// 활동 감지 이벤트 리스너 설정
function setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
        document.addEventListener(event, resetAutoLogoutTimer, { passive: true });
    });
}

// 로그인 상태 설정
function setLoggedInState(isLoggedIn, userData = null) {
    // 임직원 버튼 상태 설정 (임직원만 활성화)
    const isEmployee = isLoggedIn && userData && (userData.userType === 'employee' || userData.isAdmin);
    document.querySelectorAll('.employee-button, #employee-button, #employee-button-mobile').forEach(btn => {
        btn.disabled = !isEmployee;
    });
    
    // 로그인/로그아웃 링크 표시
    const loginLink = document.getElementById('login-link');
    const logoutLink = document.getElementById('logout-link');
    
    if (loginLink) loginLink.style.display = isLoggedIn ? 'none' : 'flex';
    if (logoutLink) logoutLink.style.display = isLoggedIn ? 'flex' : 'none';
    
    // 세션 스토리지 업데이트
    if (isLoggedIn && userData) {
        sessionStorage.setItem("loggedIn", "true");
        // 자동 로그아웃 타이머 시작
        resetAutoLogoutTimer();
    } else if (!isLoggedIn) {
        sessionStorage.removeItem("loggedIn");
        // 타이머 정리
        if (autoLogoutTimer) {
            clearTimeout(autoLogoutTimer);
            autoLogoutTimer = null;
        }
        if (autoLogoutWarningTimer) {
            clearTimeout(autoLogoutWarningTimer);
            autoLogoutWarningTimer = null;
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

// 탭 전환
function showAuthTab(tab) {
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

// 로그인 모달 표시
function showLogin() {
    // 이미 로그인된 상태 확인
    if (auth && auth.currentUser) {
        const confirmLogout = confirm('이미 다른 계정으로 로그인되어 있습니다.\n로그아웃 후 다시 로그인하시겠습니까?');
        if (confirmLogout) {
            logout();
            setTimeout(() => {
                showLogin();
            }, 500);
        }
        return;
    }
    
    // 세션 스토리지에서도 확인
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (loggedInUser) {
        const userData = JSON.parse(loggedInUser);
        const confirmLogout = confirm(`이미 ${userData.name || userData.username}님으로 로그인되어 있습니다.\n로그아웃 후 다시 로그인하시겠습니까?`);
        if (confirmLogout) {
            logout();
            setTimeout(() => {
                showLogin();
            }, 500);
        }
        return;
    }
    
    const overlay = document.getElementById('overlay');
    const loginContainer = document.getElementById('login-container');
    
    if (overlay) overlay.style.display = 'block';
    if (loginContainer) loginContainer.style.display = 'block';
    showAuthTab('login');
}

// 로그인 모달 숨기기
function hideLogin() {
    const overlay = document.getElementById('overlay');
    const loginContainer = document.getElementById('login-container');
    
    if (overlay) overlay.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'none';
    
    // 폼 초기화
    const fields = ['username', 'password', 'reg-username', 'reg-password', 'reg-password-confirm', 'reg-name', 'reg-email', 'reg-phone'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

// 로그인 함수
async function login() {
    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password');
    
    if (!usernameEl || !passwordEl) {
        alert('로그인 입력 필드를 찾을 수 없습니다.');
        return;
    }
    
    const emailOrUsername = usernameEl.value.trim();
    const password = passwordEl.value;

    if (!emailOrUsername || !password) {
        alert('아이디와 비밀번호를 입력해주세요.');
        return;
    }

    // Firebase 재초기화 시도
    if (!auth || !authDb) {
        initFirebase();
    }

    if (!auth) {
        alert('서버 연결에 실패했습니다.\n페이지를 새로고침 후 다시 시도해주세요.');
        return;
    }

    try {
        // 이메일 형식이 아닌 경우 이메일로 변환 시도
        let email = emailOrUsername;
        if (!emailOrUsername.includes('@')) {
            // username으로 이메일 찾기 (권한 오류 처리)
            try {
                const usersSnapshot = await authDb.collection('users')
                    .where('username', '==', emailOrUsername)
                    .limit(1)
                    .get();
                
                if (usersSnapshot.empty) {
                    alert('존재하지 않는 아이디입니다.');
                    return;
                }
                email = usersSnapshot.docs[0].data().email;
            } catch (queryError) {
                console.error('사용자 정보 조회 오류:', queryError);
                if (queryError.code === 'permission-denied') {
                    alert('로그인 전에는 username으로 로그인할 수 없습니다.\n이메일 주소로 로그인해주세요.');
                    return;
                }
                throw queryError;
            }
        }

        // Firebase Auth로 로그인 (타임아웃 추가)
        let userCredential;
        try {
            const loginPromise = auth.signInWithEmailAndPassword(email, password);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('로그인 시간 초과')), 15000)
            );
            userCredential = await Promise.race([loginPromise, timeoutPromise]);
        } catch (authError) {
            throw authError;
        }
        const user = userCredential.user;

        // Firestore에서 사용자 정보 확인
        const userDoc = await authDb.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            await auth.signOut();
            alert('사용자 정보를 찾을 수 없습니다.');
            return;
        }

        const userData = userDoc.data();

        // 승인 상태 확인
        if (userData.status === 'pending') {
            await auth.signOut();
            alert('가입 승인 대기 중입니다.\n관리자 승인 후 로그인이 가능합니다.');
            return;
        }

        if (userData.status === 'rejected') {
            await auth.signOut();
            alert('가입이 거절되었습니다.\n관리자에게 문의해주세요.');
            return;
        }

        if (userData.status !== 'approved' && !userData.isAdmin) {
            await auth.signOut();
            alert('로그인할 수 없는 계정입니다.');
            return;
        }

        // 로그인 성공
        hideLogin();
        const fullUserData = {
            uid: user.uid,
            email: user.email,
            ...userData
        };
        sessionStorage.setItem("loggedInUser", JSON.stringify(fullUserData));
        sessionStorage.setItem("loggedIn", "true");
        setLoggedInState(true, fullUserData);
        
        // 자동 로그아웃 타이머 시작
        resetAutoLogoutTimer();
        
        setTimeout(() => {
            alert(`${userData.name || userData.username}님, 환영합니다!`);
        }, 100);

    } catch (error) {
        console.error('로그인 오류:', error);
        console.error('오류 코드:', error.code);
        console.error('오류 메시지:', error.message);
        
        if (error.code === 'auth/user-not-found') {
            alert('존재하지 않는 계정입니다.');
        } else if (error.code === 'auth/wrong-password') {
            alert('비밀번호가 일치하지 않습니다.');
        } else if (error.code === 'auth/invalid-email') {
            alert('올바른 이메일 형식을 입력해주세요.');
        } else if (error.code === 'auth/too-many-requests') {
            alert('로그인 시도가 너무 많습니다.\n잠시 후 다시 시도해주세요.');
        } else if (error.code === 'permission-denied' || error.message?.includes('permission')) {
            alert('권한 오류가 발생했습니다.\nFirestore 보안 규칙을 확인해주세요.');
        } else if (error.message === '로그인 시간 초과') {
            alert('로그인 시간이 초과되었습니다.\n네트워크 연결을 확인하고 다시 시도해주세요.');
        } else {
            const errorMsg = error.message || '알 수 없는 오류';
            alert('로그인 중 오류가 발생했습니다.\n' + errorMsg);
        }
    }
}

// 회원가입 함수
async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const userType = document.getElementById('reg-user-type') ? document.getElementById('reg-user-type').value : 'general';

    // 유효성 검사
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

    // Firebase 재초기화 시도
    if (!auth || !authDb) {
        initFirebase();
    }
    
    if (!auth || !authDb) {
        alert('서버 연결에 실패했습니다.\n페이지를 새로고침 후 다시 시도해주세요.');
        return;
    }

    try {
        console.log('회원가입 시도:', username, email);

        // Firebase Auth로 계정 생성 (이메일 중복은 자동으로 체크됨)
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        console.log('Firebase Auth 계정 생성 완료:', user.uid);

        // 계정 생성 후 자동 로그인된 상태에서 아이디 중복 확인
        const existingUsername = await authDb.collection('users')
            .where('username', '==', username)
            .limit(1)
            .get();
        
        if (!existingUsername.empty) {
            // 중복된 아이디가 있으면 생성한 계정 삭제
            await user.delete();
            alert('이미 사용 중인 아이디입니다.');
            return;
        }

        // Firestore에 사용자 정보 저장 (비밀번호 제외!)
        await authDb.collection('users').doc(user.uid).set({
            uid: user.uid,
            username: username,
            name: name,
            email: email,
            phone: phone || '',
            userType: userType,  // 'employee' 또는 'general'
            status: 'pending',  // 승인 대기
            createdAt: new Date().toISOString(),
            isAdmin: false
        });

        console.log('Firestore 사용자 정보 저장 완료');

        // 회원가입 후 즉시 로그아웃 (승인 전까지 로그인 불가)
        await auth.signOut();

        alert('회원가입 신청이 완료되었습니다.\n관리자 승인 후 로그인이 가능합니다.');
        hideLogin();

    } catch (error) {
        console.error('회원가입 오류:', error);
        
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

// 로그아웃 함수
async function logout() {
    try {
        // 타이머 정리
        if (autoLogoutTimer) {
            clearTimeout(autoLogoutTimer);
            autoLogoutTimer = null;
        }
        if (autoLogoutWarningTimer) {
            clearTimeout(autoLogoutWarningTimer);
            autoLogoutWarningTimer = null;
        }
        
        // 경고 모달 제거
        const warningModal = document.getElementById('auto-logout-warning');
        if (warningModal) {
            warningModal.remove();
        }
        
        if (auth) {
            await auth.signOut();
        }
    sessionStorage.removeItem("loggedInUser");
    sessionStorage.removeItem("loggedIn");
    setLoggedInState(false);
        
        // 자동 로그아웃이 아닌 경우에만 알림 표시
        if (!warningShown || Date.now() - lastActivityTime < AUTO_LOGOUT_TIME) {
    alert('로그아웃되었습니다.');
        }
        
        // 스태프 페이지에서 로그아웃한 경우 홈으로 리다이렉트
        const currentPath = window.location.pathname;
        if (currentPath.includes('staff.html')) {
            // 홈 페이지로 리다이렉트
            const homePath = currentPath.includes('/hanaro/staff/') 
                ? '../../index.html' 
                : currentPath.includes('/staff/')
                ? '../../../index.html'
                : '/index.html';
            window.location.href = homePath;
            return;
        }
    } catch (error) {
        console.error('로그아웃 오류:', error);
        // 오류가 발생해도 로컬 상태는 초기화
        sessionStorage.removeItem("loggedInUser");
        sessionStorage.removeItem("loggedIn");
        setLoggedInState(false);
        
        // 스태프 페이지에서 로그아웃한 경우 홈으로 리다이렉트
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

// 현재 로그인된 사용자 정보 가져오기
function getCurrentUser() {
    const userStr = sessionStorage.getItem("loggedInUser");
    if (userStr) {
        return JSON.parse(userStr);
    }
    return null;
}

// 관리자 여부 확인
function isAdmin() {
    const user = getCurrentUser();
    return user && user.isAdmin === true;
}

// 오버레이 클릭 시 로그인 창 닫기
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
