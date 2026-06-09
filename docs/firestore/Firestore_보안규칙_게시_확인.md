# Firestore 보안 규칙 게시 확인 가이드

## ⚠️ 중요: permission-denied 오류 해결

`permission-denied` 오류가 발생하는 경우, Firebase Console에 보안 규칙이 **게시되지 않았을 가능성**이 높습니다.

## 즉시 확인 및 해결 방법

### 1단계: Firebase Console 접속
1. https://console.firebase.google.com 접속
2. 프로젝트 `hanarooa-f227d` 선택

### 2단계: Firestore Database > 규칙 탭 이동
1. 왼쪽 메뉴에서 "Firestore Database" 클릭
2. 상단 탭에서 **"규칙"** 클릭

### 3단계: 현재 규칙 확인
현재 편집기에 있는 규칙이 다음 내용과 일치하는지 확인:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 관리자 권한 확인 함수 (Firebase 콘솔의 isAdmin 필드로만 관리)
    function isAdmin() {
      return request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    // 직원 게시판
    match /staffPosts/{board} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // A/S 게시판
    match /asPosts/{document} {
      allow read: if true;
      allow write: if true;  // 비로그인 사용자도 A/S 신청 가능
    }

    // 사용자 정보
    match /users/{userId} {
      // 읽기 권한: 로그인한 사용자는 모든 문서 읽기 가능
      // read는 get과 list를 모두 포함
      allow read: if request.auth != null;
      
      // 본인만 회원가입 시 생성 가능
      allow create: if request.auth != null && request.auth.uid == userId;
      // 인증된 사용자는 업데이트/삭제 가능 (관리자 승인 등)
      allow update, delete: if request.auth != null;
    }

    // 활동사진첩
    match /activityPhotos/{photoId} {
      // 인증된 사용자는 모든 사진 읽기 가능
      allow read: if request.auth != null;
      // 인증된 사용자는 사진 업로드 가능
      allow create: if request.auth != null;
      // 본인이 업로드한 사진이거나 관리자인 경우만 삭제 가능
      allow delete: if request.auth != null && 
        (resource.data.uploadedBy == request.auth.uid || isAdmin());
    }
  }
}
```

### 4단계: 규칙 복사 및 붙여넣기
1. `Firestore_보안규칙_완성본.txt` 파일 열기
2. **전체 내용** 복사 (Ctrl+C 또는 Cmd+C)
3. Firebase Console의 규칙 편집기에 **전체 내용 붙여넣기** (Ctrl+V 또는 Cmd+V)
4. 규칙이 올바르게 입력되었는지 확인

### 5단계: 규칙 게시 (중요!)
1. 편집기 하단 또는 상단의 **"게시"** 버튼 클릭
   - 버튼이 파란색으로 표시됨
   - "게시" 또는 "Publish" 텍스트
2. 확인 대화상자에서 **"게시"** 또는 "Publish" 클릭
3. 게시 완료 메시지 확인
   - "규칙이 게시되었습니다" 또는 "Rules published" 메시지 표시

### 6단계: 게시 확인
1. 규칙 탭 상단에 **"게시됨"** 또는 "Published" 상태 표시 확인
2. 마지막 게시 시간 확인
3. 규칙 내용이 올바르게 표시되는지 재확인

### 7단계: 웹사이트 테스트
1. **브라우저 완전 새로고침**
   - Ctrl+Shift+R (Windows) 또는 Cmd+Shift+R (Mac)
   - 또는 브라우저 캐시 삭제
2. 로그인 시도
3. 콘솔(F12)에서 오류 확인

## 확인 사항 체크리스트

- [ ] Firebase Console에 로그인되어 있는가?
- [ ] 프로젝트 `hanarooa-f227d`를 선택했는가?
- [ ] Firestore Database > 규칙 탭으로 이동했는가?
- [ ] 규칙 편집기에 올바른 규칙이 입력되어 있는가?
- [ ] **"게시" 버튼을 클릭했는가? (가장 중요!)**
- [ ] 게시 완료 메시지를 확인했는가?
- [ ] 브라우저를 새로고침했는가?

## 문제가 계속 발생하는 경우

### 1. 브라우저 개발자 도구에서 확인
- F12 키로 개발자 도구 열기
- Console 탭에서 정확한 오류 메시지 확인
- Network 탭에서 Firebase 요청 실패 여부 확인

### 2. 다른 브라우저에서 테스트
- 다른 브라우저(Chrome, Firefox, Safari 등)에서 로그인 시도
- 캐시 문제일 수 있음

### 3. Firebase Console에서 규칙 재확인
- 규칙 탭에서 다시 한 번 규칙 내용 확인
- 특히 `users` 컬렉션의 `allow read: if request.auth != null;` 라인 확인

### 4. Firestore 데이터 확인
- Firestore Database > 데이터 탭
- `users` 컬렉션에서 로그인하려는 사용자의 문서가 존재하는지 확인
- 문서 ID가 Firebase Authentication의 UID와 일치하는지 확인

## 참고

- 보안 규칙 변경은 **즉시 적용**되지만, 브라우저 캐시 때문에 몇 초 지연될 수 있습니다
- 규칙 게시 후 최대 1-2분 정도 기다린 후 테스트하는 것을 권장합니다
- 규칙을 게시하지 않으면 변경사항이 적용되지 않습니다

