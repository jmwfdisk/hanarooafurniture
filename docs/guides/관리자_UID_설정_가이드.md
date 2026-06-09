# 관리자 권한 설정 가이드

## 관리자 권한 설정 방법

이 프로젝트에서는 **Firebase 콘솔의 Firestore에서 `isAdmin` 필드로만** 관리자 권한을 관리합니다.
- 하드코딩된 관리자 UID 없음
- 모든 관리자는 Firebase 콘솔에서 `isAdmin: true` 필드로 설정

## 관리자 권한 설정 방법

### Firebase Console에서 직접 설정 (추천)

1. **Firebase Console 접속**
   - https://console.firebase.google.com 접속
   - 프로젝트: `hanarooa-f227d` 선택

2. **Firestore Database 이동**
   - 왼쪽 메뉴에서 "Firestore Database" 클릭
   - "데이터" 탭 선택

3. **사용자 문서 찾기**
   - `users` 컬렉션 클릭
   - 관리자로 설정할 사용자의 문서 ID를 찾습니다
     - 문서 ID는 사용자의 Firebase Authentication UID입니다
     - Firebase Console > Authentication > Users에서 UID 확인 가능

4. **관리자 권한 설정**
   - 해당 사용자 문서 클릭
   - 문서 편집 모드로 전환 (필드 값 클릭 또는 편집 버튼)
   - `isAdmin` 필드 추가/수정:
     - 필드 이름: `isAdmin`
     - 필드 유형: `boolean` 선택
     - 값: `true` 입력
   - "업데이트" 또는 "저장" 버튼 클릭

5. **기타 필드 확인**
   - `status` 필드가 `approved`로 설정되어 있는지 확인
   - 필요시 `status` 필드도 `approved`로 설정
     - 필드 이름: `status`
     - 필드 유형: `string` 선택
     - 값: `approved` 입력

### 브라우저 콘솔에서 설정 (고급 사용자용)

1. 웹사이트에 관리자 권한이 있는 계정으로 로그인
2. 브라우저 개발자 도구 열기 (F12)
3. Console 탭에서 다음 코드 실행 (UID를 원하는 사용자 UID로 변경):

```javascript
// Firebase 초기화 확인
if (typeof firebase === 'undefined' || !firebase.apps.length) {
    console.error('Firebase가 초기화되지 않았습니다.');
} else {
    const db = firebase.firestore();
    const adminUid = '사용자의UID'; // 여기에 관리자로 설정할 사용자의 UID 입력
    
    // 관리자 권한 설정
    db.collection('users').doc(adminUid).update({
        isAdmin: true,
        status: 'approved'
    }).then(() => {
        console.log('관리자 권한이 성공적으로 설정되었습니다.');
    }).catch((error) => {
        console.error('오류 발생:', error);
        // 문서가 없는 경우 생성
        if (error.code === 'not-found' || error.message.includes('No document')) {
            db.collection('users').doc(adminUid).set({
                uid: adminUid,
                isAdmin: true,
                status: 'approved',
                createdAt: new Date().toISOString()
            }).then(() => {
                console.log('관리자 계정이 생성되었습니다.');
            }).catch((err) => {
                console.error('계정 생성 오류:', err);
            });
        }
    });
}
```

## 기존 관리자 권한 제거

기존 관리자의 권한을 제거하려면:

1. Firebase Console > Firestore Database > users 컬렉션
2. 기존 관리자의 문서 ID 클릭
3. `isAdmin` 필드 값을 `false`로 변경하거나 필드 삭제

## 확인 방법

1. 웹사이트에서 해당 UID의 계정으로 로그인
2. 관리자 전용 기능 접근 가능 여부 확인:
   - 스태프 페이지 접근
   - 회원 관리 기능 사용
   - 공지사항 작성/삭제
   - 엑셀 업로드 기능 (학교 페이지)
   - A/S 게시글 삭제

## ⚠️ 중요: Firebase Authentication 확인 필요

관리자 권한을 설정하기 전에 해당 사용자가 Firebase Authentication에 등록되어 있는지 확인해야 합니다.

### Firebase Authentication 확인 방법

1. **Firebase Console 접속**
   - https://console.firebase.google.com
   - 프로젝트 `hanarooa-f227d` 선택

2. **Authentication 메뉴 이동**
   - 왼쪽 메뉴에서 "Authentication" 클릭
   - "Users" 탭 선택

3. **사용자 확인**
   - 관리자로 설정할 사용자의 이메일 또는 UID 검색
   - 사용자가 존재하지 않는 경우 아래 방법으로 계정 생성 필요

### 새 계정으로 관리자 설정하는 방법

1. **일반 회원가입으로 계정 생성**
   - 웹사이트에서 회원가입 진행
   - 이메일/비밀번호로 계정 생성

2. **생성된 UID 확인**
   - Firebase Console > Authentication > Users에서 새로 생성된 UID 확인
   - 또는 회원가입 후 콘솔 로그에서 UID 확인

3. **Firestore에 사용자 문서 확인**
   - Firestore Database > users 컬렉션에서 해당 UID 문서 확인
   - 문서가 없으면 자동으로 생성되거나, 회원가입 시 생성됨

4. **관리자 권한 설정**
   - Firestore Database > users > {UID} 문서 열기
   - `isAdmin: true`, `status: 'approved'` 필드 설정
   - 저장

### 보안 규칙 설명

현재 보안 규칙은 **하드코딩된 UID 없이** Firebase 콘솔의 `isAdmin` 필드만 사용합니다:
- 보안 규칙 변경 불필요
- Firebase 콘솔에서 `isAdmin: true` 설정만으로 관리자 권한 부여
- 여러 관리자 추가 시에도 규칙 변경 없이 사용 가능

## 주의사항

- ⚠️ **UID가 Firebase Authentication에 없으면 로그인할 수 없습니다**
- 관리자 권한을 부여하기 전에 해당 UID가 Firebase Authentication에 등록되어 있는지 확인하세요
- `isAdmin` 필드가 없거나 `false`인 경우 관리자 권한이 없습니다
- `status` 필드가 `approved`가 아니면 로그인할 수 없습니다
- 관리자 권한 변경은 즉시 적용됩니다 (페이지 새로고침 필요)
- 보안 규칙 변경 후 Firebase Console에서 규칙을 게시해야 합니다

