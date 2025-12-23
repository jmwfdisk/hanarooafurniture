// SPA 라우팅 시스템 + School 페이지 통합
(function() {
    'use strict';
    
    // 라우트 정의
    const routes = {
        '/': 'home',
        '/school': 'school',
        '/company': 'company',
        '/product': 'product',
        '/gallery': 'gallery',
        '/as': 'as'
    };
    
    // 현재 라우트
    let currentRoute = '/';
    
    // ========== School 페이지 관련 변수 및 함수 ==========
    let storage = null;
    let cachedLoginLink = null;
    let cachedLogoutLink = null;
    let cachedLoginModal = null;
    
    // Firebase Storage 초기화 함수
    function initStorage() {
        if (typeof firebase !== 'undefined' && firebase.storage) {
            try {
                storage = firebase.storage();
                console.log('Firebase Storage 초기화 완료');
            } catch (error) {
                console.error('Firebase Storage 초기화 오류:', error);
            }
        } else {
            console.warn('Firebase Storage SDK가 로드되지 않았습니다.');
        }
    }
    
    // 사용자 권한 확인
    function checkUserPermission() {
        const loggedInUser = sessionStorage.getItem('loggedInUser');
        if (loggedInUser) {
            try {
                const userData = JSON.parse(loggedInUser);
                // 관리자만 업로드 버튼 표시
                if (userData.isAdmin) {
                    const uploadBtn = document.getElementById('excel-upload-btn');
                    if (uploadBtn) {
                        uploadBtn.style.display = 'flex';
                    }
                }
                return true;
            } catch (e) {
                console.error('사용자 정보 파싱 오류:', e);
                return false;
            }
        }
        return false;
    }
    
    // DOM 요소 캐싱
    const getLoginLink = () => {
        if (!cachedLoginLink) cachedLoginLink = document.getElementById('login-link');
        return cachedLoginLink;
    };
    
    const getLogoutLink = () => {
        if (!cachedLogoutLink) cachedLogoutLink = document.getElementById('logout-link');
        return cachedLogoutLink;
    };
    
    const getLoginModal = () => {
        if (!cachedLoginModal) cachedLoginModal = document.getElementById('login-notice-modal');
        return cachedLoginModal;
    };
    
    // 안내 모달 닫기 함수
    const closeLoginModal = () => {
        const modal = getLoginModal();
        if (modal && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    };
    
    // 로그인 안내 모달 닫기 (전역 함수)
    window.closeLoginNotice = function() {
        closeLoginModal();
    };
    
    // 간단한 로그인 상태 확인
    const checkAuthState = () => {
        const loggedInUser = sessionStorage.getItem('loggedInUser');
        const loggedIn = sessionStorage.getItem('loggedIn');
        
        if (loggedInUser && loggedIn === "true") {
            if (typeof window.authListenerReady !== 'undefined' && window.authListenerReady) {
                return true;
            }
            return null;
        }
        
        if (typeof window.authListenerReady !== 'undefined' && window.authListenerReady) {
            return false;
        }
        
        return null;
    };
    
    // 로그인 초기화 완료 대기 함수
    async function waitForAuthInit(maxWaitTime = 3000) {
        return new Promise((resolve) => {
            let resolved = false;
            const startTime = Date.now();
            
            const handleAuthRestored = () => {
                if (resolved) return;
                setTimeout(() => {
                    if (resolved) return;
                    const state = checkAuthState();
                    if (state !== null) {
                        resolved = true;
                        window.removeEventListener('authStateRestored', handleAuthRestored);
                        if (state === true) {
                            closeLoginModal();
                        }
                        resolve(state);
                    }
                }, 200);
            };
            
            window.addEventListener('authStateRestored', handleAuthRestored);
            
            const immediateState = checkAuthState();
            if (immediateState !== null) {
                resolved = true;
                window.removeEventListener('authStateRestored', handleAuthRestored);
                if (immediateState === true) {
                    closeLoginModal();
                }
                resolve(immediateState);
                return;
            }
            
            const pollInterval = setInterval(() => {
                if (resolved) {
                    clearInterval(pollInterval);
                    return;
                }
                
                const state = checkAuthState();
                if (state !== null) {
                    resolved = true;
                    window.removeEventListener('authStateRestored', handleAuthRestored);
                    clearInterval(pollInterval);
                    if (state === true) {
                        closeLoginModal();
                    }
                    resolve(state);
                    return;
                }
                
                if (Date.now() - startTime >= maxWaitTime) {
                    if (!resolved) {
                        resolved = true;
                        window.removeEventListener('authStateRestored', handleAuthRestored);
                        clearInterval(pollInterval);
                        const loggedInUser = sessionStorage.getItem('loggedInUser');
                        const loggedIn = sessionStorage.getItem('loggedIn');
                        const finalResult = (loggedInUser && loggedIn === "true");
                        resolve(finalResult);
                    }
                }
            }, 500);
        });
    }
    
    // 엑셀 파일 업로드 처리
    window.handleExcelUpload = async function(event) {
        const file = event.target.files[0];
        if (!file) {
            event.target.value = '';
            return;
        }

        if (!file.name.match(/\.(xlsx|xls)$/)) {
            alert('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
            event.target.value = '';
            return;
        }

        if (!storage) {
            initStorage();
            if (!storage) {
                alert('Firebase Storage가 초기화되지 않았습니다. 페이지를 새로고침해주세요.');
                event.target.value = '';
                return;
            }
        }

        try {
            const storageRef = storage.ref();
            const fileRef = storageRef.child('school-list/school-list.xlsx');
            
            const excelContent = document.getElementById('excel-content');
            const tabulatorTable = document.getElementById('tabulator-table');
            if (excelContent) {
                excelContent.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">파일 업로드 중...</p>';
                excelContent.style.display = 'block';
            }
            if (tabulatorTable) {
                tabulatorTable.style.display = 'none';
            }
            
            const uploadTask = fileRef.put(file);
            
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (excelContent) {
                        excelContent.innerHTML = `<p style="text-align: center; padding: 40px; color: #666;">파일 업로드 중... ${Math.round(progress)}%</p>`;
                        excelContent.style.display = 'block';
                    }
                },
                (error) => {
                    console.error('업로드 오류:', error);
                    event.target.value = '';
                    let errorMsg = '파일 업로드 중 오류가 발생했습니다.';
                    if (error.code === 'storage/unauthorized') {
                        errorMsg = '업로드 권한이 없습니다. 관리자 계정으로 로그인해주세요.';
                    } else if (error.code === 'storage/quota-exceeded') {
                        errorMsg = '저장 공간이 부족합니다.';
                    } else if (error.code === 'storage/canceled') {
                        errorMsg = '업로드가 취소되었습니다.';
                    }
                    alert(errorMsg);
                    if (excelContent) {
                        excelContent.innerHTML = '<p style="text-align: center; padding: 40px; color: #dc3545;">업로드 실패</p>';
                        excelContent.style.display = 'block';
                    }
                    if (tabulatorTable) {
                        tabulatorTable.style.display = 'none';
                    }
                },
                async () => {
                    try {
                        console.log('업로드 완료');
                        await loadExcelFile();
                        event.target.value = '';
                    } catch (error) {
                        console.error('파일 로드 오류:', error);
                        alert('파일 업로드는 완료되었지만 표시 중 오류가 발생했습니다.');
                        event.target.value = '';
                    }
                }
            );
        } catch (error) {
            console.error('업로드 오류:', error);
            event.target.value = '';
            alert('파일 업로드 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
        }
    };
    
    // Firebase Storage에서 엑셀 파일 로드
    async function loadExcelFile() {
        const excelContent = document.getElementById('excel-content');
        const tabulatorTable = document.getElementById('tabulator-table');
        
        // 로딩 메시지 표시
        if (excelContent) {
            excelContent.innerHTML = '<div style="text-align: center; padding: 60px 20px;"><div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #44aa6b; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div><p style="color: #666; font-size: 16px; margin: 0;">로딩 중입니다...</p></div>';
            excelContent.style.display = 'block';
        }
        if (tabulatorTable) {
            tabulatorTable.style.display = 'none';
        }
        
        try {
            if (!storage) {
                initStorage();
                if (!storage) {
                    if (excelContent) {
                        excelContent.innerHTML = '<p style="text-align: center; padding: 40px; color: #dc3545;">Firebase Storage 초기화 오류가 발생했습니다.<br>페이지를 새로고침해주세요.</p>';
                    }
                    return;
                }
            }

            if (typeof XLSX === 'undefined') {
                if (excelContent) {
                    excelContent.innerHTML = '<p style="text-align: center; padding: 40px; color: #dc3545;">엑셀 파일 읽기 라이브러리를 불러올 수 없습니다.<br>페이지를 새로고침해주세요.</p>';
                    excelContent.style.display = 'block';
                }
                return;
            }

            if (typeof Tabulator === 'undefined') {
                if (excelContent) {
                    excelContent.innerHTML = '<p style="text-align: center; padding: 40px; color: #dc3545;">스프레드시트 뷰 라이브러리를 불러올 수 없습니다.<br>페이지를 새로고침해주세요.</p>';
                    excelContent.style.display = 'block';
                }
                return;
            }

            const storageRef = storage.ref();
            const fileRef = storageRef.child('school-list/school-list.xlsx');
            
            // 파일 다운로드 시작 - 로딩 메시지 업데이트
            if (excelContent) {
                excelContent.innerHTML = '<div style="text-align: center; padding: 60px 20px;"><div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #44aa6b; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div><p style="color: #666; font-size: 16px; margin: 0;">파일을 불러오는 중입니다...</p></div>';
            }
            
            let arrayBuffer;
            try {
                const url = await fileRef.getDownloadURL();
                
                // 파일 다운로드 중 - 로딩 메시지 업데이트
                if (excelContent) {
                    excelContent.innerHTML = '<div style="text-align: center; padding: 60px 20px;"><div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #44aa6b; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div><p style="color: #666; font-size: 16px; margin: 0;">데이터를 처리하는 중입니다...</p></div>';
                }
                const response = await fetch(url, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit',
                    headers: {
                        'Accept': 'application/octet-stream'
                    }
                });
                
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }
                
                arrayBuffer = await response.arrayBuffer();
            } catch (fetchError) {
                console.error('fetch 실패:', fetchError);
                // CORS 오류인 경우 명확한 안내
                if (fetchError.message && (
                    fetchError.message.includes('CORS') || 
                    fetchError.message.includes('Access-Control-Allow-Origin') ||
                    fetchError.message.includes('Failed to fetch') ||
                    fetchError.name === 'TypeError'
                )) {
                    const isGitHubPages = window.location.hostname.includes('github.io');
                    if (isGitHubPages) {
                        throw new Error('CORS 오류: Firebase Storage의 CORS 설정이 필요합니다. Firebase_Storage_CORS_설정_가이드.md 파일을 참고하세요.');
                    } else {
                        throw new Error('CORS 오류가 발생했습니다. Firebase Console에서 Storage의 CORS 설정을 확인하세요.');
                    }
                }
                throw fetchError;
            }
            
            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                throw new Error('다운로드된 파일이 비어있습니다.');
            }
            
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new Error('엑셀 파일에 시트가 없습니다.');
            }
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            if (!worksheet) {
                throw new Error('시트를 읽을 수 없습니다.');
            }
            
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                header: 1,
                defval: ''
            });
            
            if (!jsonData || jsonData.length === 0) {
                throw new Error('엑셀 데이터가 비어있습니다.');
            }
            
            const headers = jsonData[0];
            if (!headers || headers.length === 0) {
                throw new Error('엑셀 파일에 헤더가 없습니다.');
            }
            
            const dataRows = jsonData.slice(1);
            const filteredRows = dataRows.filter(row => {
                return row && row.some(cell => cell !== undefined && cell !== null && cell.toString().trim() !== '');
            });
            
            if (filteredRows.length === 0) {
                throw new Error('엑셀 파일에 데이터 행이 없습니다.');
            }
            
            // 데이터 변환 중 - 로딩 메시지 업데이트
            if (excelContent) {
                excelContent.innerHTML = '<div style="text-align: center; padding: 60px 20px;"><div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #44aa6b; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div><p style="color: #666; font-size: 16px; margin: 0;">스프레드시트를 생성하는 중입니다...</p></div>';
            }
            
            const tabulatorData = filteredRows.map((row, index) => {
                const rowObj = { id: index + 1 };
                headers.forEach((header, colIndex) => {
                    const columnName = header && header.toString().trim() 
                        ? header.toString().trim() 
                        : `Column${colIndex + 1}`;
                    rowObj[columnName] = row[colIndex] !== undefined && row[colIndex] !== null 
                        ? row[colIndex].toString() 
                        : '';
                });
                return rowObj;
            });
            
            const columns = headers.map((header, index) => {
                const columnName = header && header.toString().trim() 
                    ? header.toString().trim() 
                    : `Column${index + 1}`;
                return {
                    title: columnName,
                    field: columnName,
                    headerFilter: "input",
                    headerSort: true,
                    sorter: "string",
                    width: 150,
                    minWidth: 100,
                    resizable: true
                };
            });
            
            const tabulatorTable = document.getElementById('tabulator-table');
            if (!tabulatorTable) {
                throw new Error('Tabulator 테이블 컨테이너를 찾을 수 없습니다.');
            }
            
            if (window.schoolTable) {
                try {
                    window.schoolTable.destroy();
                } catch (e) {
                    console.warn('기존 테이블 제거 중 오류:', e);
                }
            }
            
            window.schoolTable = new Tabulator("#tabulator-table", {
                data: tabulatorData,
                columns: columns,
                layout: "fitColumns",
                pagination: true,
                paginationSize: 50,
                paginationSizeSelector: [25, 50, 100, 200],
                paginationCounter: "rows",
                movableColumns: true,
                resizableColumns: true,
                tooltips: true,
                placeholder: "데이터가 없습니다.",
                height: tabulatorData.length > 0 ? "600px" : "400px",
                minHeight: "400px",
                responsiveLayout: "hide",
                initialSort: [
                    {column: "id", dir: "asc"}
                ]
            });
            
            if (excelContent) {
                excelContent.style.display = 'none';
            }
            tabulatorTable.style.display = 'block';
            
        } catch (error) {
            console.error('엑셀 파일 로드 오류:', error);
            const tabulatorTable = document.getElementById('tabulator-table');
            if (tabulatorTable) {
                tabulatorTable.style.display = 'none';
            }
            
            if (excelContent) {
                excelContent.style.display = 'block';
                if (error.code === 'storage/object-not-found' || error.message?.includes('not found')) {
                    excelContent.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">엑셀 파일이 아직 업로드되지 않았습니다.<br>관리자가 엑셀 파일을 업로드해주세요.</p>';
                } else if (error.message && error.message.includes('CORS')) {
                    // CORS 오류인 경우 상세 안내
                    const isGitHubPages = window.location.hostname.includes('github.io');
                    if (isGitHubPages) {
                        excelContent.innerHTML = '<div style="text-align: center; padding: 40px; color: #dc3545;"><p style="font-weight: bold; margin-bottom: 15px;">CORS 설정이 필요합니다</p><p style="line-height: 1.8; margin-bottom: 10px;">GitHub Pages에서 Firebase Storage에 접근하려면 CORS 설정이 필요합니다.</p><p style="line-height: 1.8; margin-bottom: 10px;">프로젝트 루트의 <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">Firebase_Storage_CORS_설정_가이드.md</code> 파일을 참고하여 설정하세요.</p><p style="font-size: 12px; color: #999; margin-top: 20px;">오류: ' + error.message + '</p></div>';
                    } else {
                        excelContent.innerHTML = '<p style="text-align: center; padding: 40px; color: #dc3545;">CORS 오류가 발생했습니다.<br>Firebase Console에서 Storage의 CORS 설정을 확인하세요.<br><br>오류: ' + error.message + '</p>';
                    }
                } else {
                    excelContent.innerHTML = '<p style="text-align: center; padding: 40px; color: #dc3545;">엑셀 파일을 불러오는 중 오류가 발생했습니다.<br>오류: ' + (error.message || '알 수 없는 오류') + '</p>';
                }
            }
        }
    }
    
    // ========== 라우팅 시스템 ==========
    
    // 라우트 변경 함수
    function navigateTo(route) {
        if (route.startsWith('#')) {
            route = route.substring(1);
        }
        
        if (routes[route]) {
            currentRoute = route;
            window.location.hash = route;
            renderRoute(route);
        } else {
            console.warn('알 수 없는 라우트:', route);
        }
    }
    
    // 라우트 렌더링 함수
    function renderRoute(route) {
        const sectionId = routes[route];
        
        document.querySelectorAll('.spa-section').forEach(section => {
            section.style.display = 'none';
        });
        
        if (route === '/') {
            // 홈 페이지: 모든 기본 콘텐츠 표시
            document.querySelectorAll('section, .main2-section, .main-section, .MAS-section, .gallery-section, .partner-logos, footer').forEach(el => {
                if (!el.closest('#spa-sections') && !el.closest('.login-notice-modal')) {
                    el.style.display = '';
                }
            });
            return;
        }
        
        // 다른 페이지: 기본 콘텐츠 숨기기 (footer는 유지)
        document.querySelectorAll('section, .main2-section, .main-section, .MAS-section, .gallery-section, .partner-logos').forEach(el => {
            if (!el.closest('#spa-sections') && !el.closest('.login-notice-modal')) {
                el.style.display = 'none';
            }
        });
        
        // footer는 항상 표시
        document.querySelectorAll('footer').forEach(el => {
            el.style.display = 'block';
        });
        
        const section = document.getElementById('section-' + sectionId);
        if (section) {
            section.style.display = 'block';
            
            if (sectionId === 'school') {
                initSchoolSection();
            }
        }
    }
    
    // School 섹션 초기화
    function initSchoolSection() {
        const schoolSection = document.getElementById('section-school');
        if (!schoolSection) return;
        
        // 엑셀 업로드 버튼 이벤트 리스너 설정
        const uploadInput = document.getElementById('excel-upload');
        if (uploadInput && !uploadInput.dataset.listenerAdded) {
            uploadInput.addEventListener('change', window.handleExcelUpload);
            uploadInput.dataset.listenerAdded = 'true';
        }
        
        // 초기 상태 설정 - excel-display-area는 항상 표시
        const excelArea = document.getElementById('excel-display-area');
        const tabulatorTable = document.getElementById('tabulator-table');
        const excelContent = document.getElementById('excel-content');
        
        if (excelArea) {
            excelArea.style.display = 'block';
        }
        if (tabulatorTable) {
            tabulatorTable.style.display = 'none';
        }
        if (excelContent) {
            excelContent.style.display = 'block';
        }
        
        // Firebase Storage 초기화
        initStorage();
        
        // 로그인 상태 확인 및 처리 (즉시 확인, 대기 시간 최소화)
        // auth.js가 이미 로드되어 있으므로 즉시 확인 가능
        const loggedInUser = sessionStorage.getItem('loggedInUser');
        const loggedIn = sessionStorage.getItem('loggedIn');
        const modal = getLoginModal();
        
        // authListenerReady 확인
        if (typeof window.authListenerReady !== 'undefined' && window.authListenerReady) {
            // 이미 초기화 완료
            if (loggedInUser && loggedIn === "true") {
                // 로그인 상태
                checkUserPermission();
                if (modal && modal.classList.contains('active')) {
                    modal.classList.remove('active');
                }
                // 엑셀 파일 로드
                loadExcelFile();
            } else {
                // 로그아웃 상태 - 모달 대신 상단 안내문구에 메시지 표시
                // 모달은 표시하지 않음
                if (modal && modal.classList.contains('active')) {
                    modal.classList.remove('active');
                }
                // 상단 안내문구 업데이트
                const readOnlyNotice = document.querySelector('#section-school .read-only-notice');
                if (readOnlyNotice) {
                    readOnlyNotice.innerHTML = '⚠️ 모바일에서는 정상적으로 표시되지 않습니다 데스크탑 브라우저를 이용해주세요! 납품학교리스트를 보려면 로그인이 필요합니다 회원가입을 해주세요';
                }
                // excel-display-area는 표시하되 내용만 안내 메시지
                if (excelContent) {
                    excelContent.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">로그인이 필요합니다.</p>';
                    excelContent.style.display = 'block';
                }
            }
        } else {
            // 아직 초기화 중이면 짧게 대기
            waitForAuthInit(1000).then(isLoggedIn => {
                checkUserPermission();
                const modal = getLoginModal();
                
                if (!isLoggedIn) {
                    // 로그아웃 상태 - 모달 대신 상단 안내문구에 메시지 표시
                    // 모달은 표시하지 않음
                    if (modal && modal.classList.contains('active')) {
                        modal.classList.remove('active');
                    }
                    // 상단 안내문구 업데이트
                    const readOnlyNotice = document.querySelector('#section-school .read-only-notice');
                    if (readOnlyNotice) {
                        readOnlyNotice.innerHTML = '⚠️ 모바일에서는 정상적으로 표시되지 않습니다 데스크탑 브라우저를 이용해주세요! 납품학교리스트를 보려면 로그인이 필요합니다 회원가입을 해주세요';
                    }
                    if (excelContent) {
                        excelContent.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">로그인이 필요합니다.</p>';
                        excelContent.style.display = 'block';
                    }
                } else {
                    if (modal && modal.classList.contains('active')) {
                        modal.classList.remove('active');
                    }
                    // 로그인 상태일 때는 원래 안내문구로 복원
                    const readOnlyNotice = document.querySelector('#section-school .read-only-notice');
                    if (readOnlyNotice) {
                        readOnlyNotice.innerHTML = '⚠️ 모바일에서는 정상적으로 표시되지 않습니다 데스크탑 브라우저를 이용해주세요!';
                    }
                    loadExcelFile();
                }
            }).catch(error => {
                console.error('[School] 로그인 초기화 대기 중 오류:', error);
                const isLoggedIn = checkUserPermission();
                const modal = getLoginModal();
                
                if (!isLoggedIn) {
                    // 로그아웃 상태 - 모달 대신 상단 안내문구에 메시지 표시
                    // 모달은 표시하지 않음
                    if (modal && modal.classList.contains('active')) {
                        modal.classList.remove('active');
                    }
                    // 상단 안내문구 업데이트
                    const readOnlyNotice = document.querySelector('#section-school .read-only-notice');
                    if (readOnlyNotice) {
                        readOnlyNotice.innerHTML = '⚠️ 모바일에서는 정상적으로 표시되지 않습니다 데스크탑 브라우저를 이용해주세요! 납품학교리스트를 보려면 로그인이 필요합니다 회원가입을 해주세요';
                    }
                    if (excelContent) {
                        excelContent.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">로그인이 필요합니다.</p>';
                        excelContent.style.display = 'block';
                    }
                } else {
                    if (modal && modal.classList.contains('active')) {
                        modal.classList.remove('active');
                    }
                    // 로그인 상태일 때는 원래 안내문구로 복원
                    const readOnlyNotice = document.querySelector('#section-school .read-only-notice');
                    if (readOnlyNotice) {
                        readOnlyNotice.innerHTML = '⚠️ 모바일에서는 정상적으로 표시되지 않습니다 데스크탑 브라우저를 이용해주세요!';
                    }
                    loadExcelFile();
                }
            });
        }
    }
    
    // 링크 클릭 이벤트 처리
    function handleLinkClick(e) {
        const link = e.target.closest('a[href^="#"]');
        if (link && link.getAttribute('href').startsWith('#')) {
            e.preventDefault();
            const route = link.getAttribute('href');
            navigateTo(route);
        }
    }
    
    // 전역: 로그인 상태 복원 시 안내 모달 자동 닫기 및 스쿨 섹션 재초기화
    function setupAuthStateListener() {
        if (window.schoolAuthStateListenerSetup) {
            return;
        }
        window.schoolAuthStateListenerSetup = true;
        
        window.addEventListener('authStateRestored', function(event) {
            setTimeout(() => {
                const loggedInUser = sessionStorage.getItem('loggedInUser');
                const loggedIn = sessionStorage.getItem('loggedIn');
                if (loggedInUser && loggedIn === "true") {
                    // 로그인 모달 닫기
                    closeLoginModal();
                    
                    // 현재 스쿨 섹션이 활성화되어 있는지 확인
                    const schoolSection = document.getElementById('section-school');
                    const modal = getLoginModal();
                    const isSchoolSectionActive = schoolSection && schoolSection.style.display === 'block';
                    const isModalOpen = modal && modal.classList.contains('active');
                    
                    // 스쿨 섹션이 활성화되어 있고 모달이 열려있었으면 자동으로 엑셀 파일 로드
                    if (isSchoolSectionActive || isModalOpen) {
                        console.log('[Router] 인증 상태 복원됨 - 스쿨 섹션 자동 재초기화');
                        // 권한 확인 및 엑셀 파일 로드
                        checkUserPermission();
                        loadExcelFile().catch(error => {
                            console.error('[Router] 엑셀 파일 자동 로드 실패:', error);
                        });
                    }
                }
            }, 300); // 약간의 지연을 두어 sessionStorage 업데이트 완료 대기
        });
    }
    
    // 모달 배경 클릭 시 닫기
    document.addEventListener('click', function(e) {
        const modal = getLoginModal();
        if (modal && modal.classList.contains('active')) {
            if (e.target === modal) {
                closeLoginNotice();
            }
        }
    });
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeLoginNotice();
        }
    });
    
    // 초기화
    function init() {
        window.addEventListener('hashchange', function() {
            const route = window.location.hash || '#/';
            navigateTo(route);
        });
        
        document.addEventListener('click', handleLinkClick);
        
        const initialRoute = window.location.hash || '#/';
        navigateTo(initialRoute);
        
        setupAuthStateListener();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    window.SPARouter = {
        navigate: navigateTo,
        currentRoute: () => currentRoute
    };
})();
