# Firestore 보안 규칙 최종 확인 체크리스트

## 🚨 현재 상황
- 3회 재시도 모두 `permission-denied` 오류
- 인증 토큰 재확인 완료되었지만 여전히 오류 발생
- **Firebase Console에 보안 규칙이 게시되지 않았을 가능성이 매우 높음**

## ✅ 필수 확인 사항 (순서대로 진행)

### 1단계: Firebase Console 접속 확인
- [ ] https://console.firebase.google.com 접속 완료
- [ ] Google 계정으로 로그인 완료
- [ ] 프로젝트 `hanarooa-f227d` 선택 완료

### 2단계: Firestore Database > 규칙 탭 이동
- [ ] 왼쪽 사이드바에서 "Firestore Database" 클릭
- [ ] 상단 탭에서 **"규칙"** 탭 클릭 완료
- [ ] 규칙 편집기가 표시되는지 확인

### 3단계: 현재 규칙 내용 확인
편집기에 표시된 규칙을 확인하고, 다음 중 하나인지 확인:

**❌ 문제가 있는 경우:**
- [ ] 규칙이 비어있음
- [ ] `allow read: if false;` 같은 제한적인 규칙이 있음
- [ ] `users` 컬렉션에 대한 규칙이 없음
- [ ] 다른 보안 규칙이 적용되어 있음

**✅ 올바른 경우:**
- [ ] `match /users/{userId} {` 섹션이 있음
- [ ] `allow read: if request.auth != null;` 라인이 있음

### 4단계: 규칙 전체 교체
1. **편집기 내 모든 내용 선택** (Ctrl+A 또는 Cmd+A)
2. **전체 삭제**
3. 아래 규칙 코드를 **전체 복사**하여 붙여넣기:

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

### 5단계: 규칙 게시 (가장 중요!)
- [ ] 편집기 하단 또는 상단에 **"게시"** 또는 "Publish" 버튼이 보이는지 확인
- [ ] **"게시" 버튼을 클릭함**
- [ ] 확인 대화상자에서 **"게시"** 또는 "Publish" 클릭
- [ ] **"규칙이 게시되었습니다"** 또는 "Rules published" 메시지 확인

### 6단계: 게시 상태 확인
- [ ] 규칙 탭 상단에 **"게시됨"** 또는 "Published" 상태 표시 확인
- [ ] 마지막 게시 시간이 **방금 전**으로 표시되는지 확인
- [ ] 규칙 내용이 올바르게 표시되는지 재확인

### 7단계: 데이터베이스 확인
- [ ] Firestore Database 페이지 상단에 여러 데이터베이스가 있는지 확인
- [ ] "(default)" 데이터베이스를 선택했는지 확인
- [ ] 다른 데이터베이스가 있다면 그 데이터베이스에도 동일한 규칙 적용

## 🔄 게시 후 테스트

### 1. 브라우저 완전 새로고침
- [ ] 웹사이트가 열려 있는 탭으로 이동
- [ ] Ctrl+Shift+R (Windows) 또는 Cmd+Shift+R (Mac) 실행
- [ ] 또는 브라우저 캐시 완전 삭제

### 2. 로그인 재시도
- [ ] 이메일과 비밀번호 입력
- [ ] 로그인 버튼 클릭

### 3. 콘솔 확인
- [ ] F12 키로 개발자 도구 열기
- [ ] Console 탭에서 오류 확인
- [ ] `permission-denied` 오류가 사라졌는지 확인

## 🚨 여전히 문제가 발생하는 경우

### 추가 확인 사항

1. **Firebase Console에서 규칙 스크린샷 확인**
   - 규칙 탭의 전체 화면 스크린샷
   - 특히 `users` 컬렉션 부분 확인

2. **다른 브라우저에서 테스트**
   - Chrome, Firefox, Safari 등 다른 브라우저에서 시도
   - 시크릿/프라이빗 모드에서 시도

3. **Firebase 프로젝트 확인**
   - 올바른 프로젝트(`hanarooa-f227d`)를 선택했는지 재확인
   - 다른 프로젝트를 선택하지 않았는지 확인

4. **네트워크 확인**
   - 인터넷 연결 상태 확인
   - VPN이나 프록시 사용 중인지 확인

## 📝 확인해야 할 핵심 사항

**가장 중요한 것:**
1. ✅ Firebase Console에서 **"게시" 버튼을 클릭했는가?**
2. ✅ **"규칙이 게시되었습니다"** 메시지를 확인했는가?
3. ✅ 규칙 탭 상단에 **"게시됨"** 상태가 표시되는가?

**이 세 가지를 모두 확인하지 않으면 규칙이 적용되지 않습니다!**

## 💡 참고

- 보안 규칙을 편집만 하고 게시하지 않으면 **절대 적용되지 않습니다**
- 규칙 게시는 **즉시 적용**되지만, 브라우저 캐시 때문에 몇 초 지연될 수 있습니다
- 규칙 게시 후 최대 1-2분 정도 기다린 후 테스트하는 것을 권장합니다

