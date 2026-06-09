# Firestore 보안 규칙 긴급 수정 가이드

## ⚠️ 현재 상황
`permission-denied` 오류가 3회 재시도 후에도 계속 발생하고 있습니다.
이는 **Firebase Console에 보안 규칙이 제대로 게시되지 않았거나**, 다른 보안 규칙이 적용되어 있을 가능성이 높습니다.

## 🔧 즉시 해결 방법

### 방법 1: Firebase Console에서 직접 확인 및 수정

#### 1단계: Firebase Console 접속
1. 브라우저에서 새 탭 열기
2. https://console.firebase.google.com 접속
3. Google 계정으로 로그인
4. 프로젝트 `hanarooa-f227d` 선택

#### 2단계: Firestore Database > 규칙 탭 이동
1. 왼쪽 사이드바에서 **"Firestore Database"** 클릭
   - "빌드(Build)" 섹션 아래에 있을 수 있음
2. 상단 탭에서 **"규칙"** 클릭

#### 3단계: 현재 규칙 확인
현재 편집기에 표시된 규칙을 확인하세요.

**문제가 있는 경우:**
- 규칙이 비어있거나
- 다른 규칙이 있거나
- `users` 컬렉션에 대한 읽기 권한이 없거나
- `allow read: if false;` 같은 제한적인 규칙이 있는 경우

#### 4단계: 규칙 전체 교체
1. **편집기 내의 모든 내용을 선택** (Ctrl+A 또는 Cmd+A)
2. **전체 삭제** (Delete 키 또는 Backspace)
3. 아래의 **완전한 규칙 코드를 복사**하여 붙여넣기:

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

#### 5단계: 규칙 검증 및 게시
1. 규칙 편집기 하단에 있는 **"규칙 검증"** 또는 "Validate" 버튼 클릭 (있는 경우)
2. 오류가 없으면 **"게시"** 또는 "Publish" 버튼 클릭
   - 버튼이 파란색으로 표시됨
   - 편집기 상단 또는 하단에 있을 수 있음
3. 확인 대화상자에서 **"게시"** 또는 "Publish" 클릭
4. **"규칙이 게시되었습니다"** 또는 "Rules published" 메시지 확인

#### 6단계: 게시 확인
1. 규칙 탭 상단에 **"게시됨"** 또는 "Published" 상태 확인
2. 마지막 게시 시간이 방금 전으로 표시되는지 확인
3. 규칙 내용이 올바르게 표시되는지 재확인

### 방법 2: 보안 규칙 파일 직접 복사

1. `Firestore_보안규칙_완성본.txt` 파일 열기
2. **전체 내용 선택** (Ctrl+A 또는 Cmd+A)
3. **전체 복사** (Ctrl+C 또는 Cmd+C)
4. Firebase Console 규칙 편집기에서:
   - 기존 내용 전체 선택 (Ctrl+A 또는 Cmd+A)
   - 삭제
   - 붙여넣기 (Ctrl+V 또는 Cmd+V)
5. **"게시"** 버튼 클릭

## ✅ 확인 체크리스트

다음을 모두 확인하세요:

- [ ] Firebase Console에 로그인되어 있는가?
- [ ] 올바른 프로젝트(`hanarooa-f227d`)를 선택했는가?
- [ ] Firestore Database > 규칙 탭으로 이동했는가?
- [ ] 규칙 편집기에 위의 전체 규칙 코드가 입력되어 있는가?
- [ ] **"게시" 버튼을 클릭했는가? (가장 중요!)**
- [ ] 게시 완료 메시지를 확인했는가?
- [ ] 규칙 탭 상단에 "게시됨" 상태가 표시되는가?

## 🔄 게시 후 테스트

1. **브라우저 완전 새로고침**
   - 웹사이트가 열려 있는 탭으로 이동
   - Ctrl+Shift+R (Windows) 또는 Cmd+Shift+R (Mac)
   - 또는 브라우저 캐시 완전 삭제

2. **로그인 재시도**
   - 이메일과 비밀번호 입력
   - 로그인 버튼 클릭

3. **콘솔 확인**
   - F12 키로 개발자 도구 열기
   - Console 탭에서 오류 확인
   - `permission-denied` 오류가 사라져야 함

## 🚨 여전히 문제가 발생하는 경우

### 확인 사항 1: 다른 데이터베이스 확인
Firebase Console에서:
1. Firestore Database 페이지로 이동
2. 상단에 여러 데이터베이스가 있는지 확인
3. "(default)" 데이터베이스의 규칙을 수정했는지 확인
4. 다른 데이터베이스가 있다면 그 데이터베이스에도 동일한 규칙 적용

### 확인 사항 2: 네트워크 및 브라우저
1. 다른 브라우저에서 테스트 (Chrome, Firefox, Safari 등)
2. 시크릿/프라이빗 모드에서 테스트
3. 브라우저 확장 프로그램 비활성화 후 테스트

### 확인 사항 3: Firebase Console에서 규칙 재확인
1. Firebase Console > Firestore Database > 규칙 탭
2. 현재 표시된 규칙이 위의 코드와 정확히 일치하는지 확인
3. 특히 `users` 컬렉션 부분:
   ```javascript
   match /users/{userId} {
     allow read: if request.auth != null;
     ...
   }
   ```
   이 부분이 있는지 확인

## 📞 추가 도움

위의 모든 단계를 완료했는데도 문제가 발생한다면:
1. Firebase Console의 규칙 탭 스크린샷
2. 브라우저 콘솔의 전체 오류 메시지
3. 어떤 단계에서 문제가 발생하는지

이 정보를 함께 제공해주시면 추가로 도와드리겠습니다.

