// 로그인 함수 - 1단계 보안 규칙용 (간단 버전)
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
            // username으로 이메일 찾기
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
                alert('로그인 전에는 username으로 로그인할 수 없습니다.\n이메일 주소로 로그인해주세요.');
                return;
            }
        }

        // Firebase Auth로 로그인 (1단계: 간단한 로그인)
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log('Firebase Auth 로그인 성공:', user.uid);

        // Firestore에서 사용자 정보 확인 (1단계 규칙: 로그인한 사용자는 모든 문서 읽기 가능)
        let userDoc;
        try {
            console.log('Firestore 사용자 정보 조회 중... UID:', user.uid);
            userDoc = await authDb.collection('users').doc(user.uid).get();
            console.log('Firestore 조회 성공');
        } catch (docError) {
            console.error('사용자 정보 조회 오류:', docError);
            await auth.signOut();
            alert('사용자 정보를 불러올 수 없습니다.\nFirestore 보안 규칙을 확인해주세요.');
            return;
        }
        
        if (!userDoc || !userDoc.exists) {
            await auth.signOut();
            alert('사용자 정보를 찾을 수 없습니다.');
            return;
        }

        const userData = userDoc.data();

        // 1단계: 승인 상태 확인 (선택적 - 필요시 주석 처리 가능)
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
        
        if (error.code === 'auth/user-not-found') {
            alert('존재하지 않는 계정입니다.\n회원가입이 필요합니다.');
        } else if (error.code === 'auth/wrong-password') {
            alert('비밀번호가 일치하지 않습니다.');
        } else if (error.code === 'auth/invalid-credential') {
            alert('로그인 정보가 올바르지 않습니다.\n이메일과 비밀번호를 확인해주세요.');
        } else if (error.code === 'auth/invalid-email') {
            alert('올바른 이메일 형식을 입력해주세요.');
        } else {
            alert('로그인 중 오류가 발생했습니다.\n' + (error.message || '잠시 후 다시 시도해주세요.'));
        }
    }
}

