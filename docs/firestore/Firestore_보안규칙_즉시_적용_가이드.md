# Firestore 보안 규칙 즉시 적용 가이드

## 🚨 현재 상황
- ✅ Firebase Auth 로그인 성공
- ✅ 인증 토큰 가져오기 성공  
- ❌ Firestore 사용자 정보 조회 실패 (permission-denied)

**문제: Firebase Console에 보안 규칙이 게시되지 않았습니다.**

## ⚡ 즉시 해결 방법 (5분 이내)

### 1단계: Firebase Console 열기
1. 새 브라우저 탭 열기
2. **https://console.firebase.google.com** 접속
3. Google 계정으로 로그인
4. 프로젝트 목록에서 **"hanarooa-f227d"** 클릭

### 2단계: Firestore Database로 이동
1. 왼쪽 사이드바 스크롤하여 **"Firestore Database"** 찾기
2. **"Firestore Database"** 클릭
   - "빌드(Build)" 섹션 아래에 있을 수 있음

### 3단계: 규칙 탭 클릭
1. Firestore Database 페이지 상단에 여러 탭이 보임:
   - "데이터"
   - **"규칙"** ← 이 탭 클릭
   - "색인"
   - "재해 복구"
   - 등등

### 4단계: 현재 규칙 확인
편집기에 표시된 규칙을 확인하세요.

**문제가 있는 경우:**
- 편집기가 비어있음
- `allow read: if false;` 같은 제한적인 규칙이 있음
- `match /users/{userId}` 섹션이 없음

### 5단계: 규칙 전체 교체 (중요!)

#### 방법 A: 파일에서 복사
1. `Firestore_보안규칙_완성본.txt` 파일을 열기
2. **전체 내용 선택** (Ctrl+A 또는 Cmd+A)
3. **전체 복사** (Ctrl+C 또는 Cmd+C)

#### 방법 B: 아래 코드 직접 복사
아래 코드를 전체 선택하여 복사하세요:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 직원 게시판
    match /staffPosts/{board} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // A/S 게시판
    match /asPosts/{document} {
      allow read: if true;
      allow write: if true;
    }

    // 사용자 정보 - 가장 중요한 부분
    match /users/{userId} {
      // 읽기: 로그인한 사용자는 모든 사용자 문서 읽기 가능
      allow read: if request.auth != null;
      
      // 생성: 본인만 회원가입 시 생성 가능
      allow create: if request.auth != null && request.auth.uid == userId;
      
      // 수정/삭제: 인증된 사용자는 모두 가능
      allow update, delete: if request.auth != null;
    }

    // 활동사진첩
    match /activityPhotos/{photoId} {
      // 읽기: 인증된 사용자만
      allow read: if request.auth != null;
      
      // 생성: 인증된 사용자만
      allow create: if request.auth != null;
      
      // 삭제: 본인이 업로드한 사진만 (관리자 기능은 앱 코드에서 처리)
      allow delete: if request.auth != null && 
        resource.data.uploadedBy == request.auth.uid;
    }
  }
}
```

### 6단계: 규칙 편집기에 붙여넣기
1. Firebase Console 규칙 편집기 내부 클릭
2. **전체 내용 선택** (Ctrl+A 또는 Cmd+A)
3. **전체 삭제** (Delete 키)
4. 복사한 규칙 코드 **붙여넣기** (Ctrl+V 또는 Cmd+V)
5. 규칙이 올바르게 표시되는지 확인

### 7단계: 규칙 게시 (가장 중요!)

1. **"게시" 버튼 찾기**
   - 편집기 상단 또는 하단에 파란색 버튼
   - "게시" 또는 "Publish" 텍스트

2. **"게시" 버튼 클릭**
   - 버튼을 클릭

3. **확인 대화상자**
   - "게시하시겠습니까?" 같은 메시지가 나타나면
   - **"게시"** 또는 **"Publish"** 버튼 클릭

4. **게시 완료 확인**
   - "규칙이 게시되었습니다" 또는 "Rules published" 메시지 확인
   - 규칙 탭 상단에 **"게시됨"** 또는 "Published" 상태 표시 확인

### 8단계: 게시 상태 최종 확인

반드시 다음을 확인하세요:
- ✅ 규칙 탭 상단에 **"게시됨"** 또는 "Published" 표시
- ✅ 마지막 게시 시간이 **방금 전**으로 표시
- ✅ 편집기에 규칙 내용이 올바르게 표시됨

### 9단계: 웹사이트 테스트

1. **웹사이트가 열려 있는 탭으로 이동**

2. **브라우저 완전 새로고침**
   - **Ctrl+Shift+R** (Windows) 또는 **Cmd+Shift+R** (Mac)
   - 또는 브라우저 캐시 완전 삭제

3. **로그인 재시도**
   - 이메일과 비밀번호 입력
   - 로그인 버튼 클릭

4. **콘솔 확인**
   - F12 키로 개발자 도구 열기
   - Console 탭 확인
   - 이제 `permission-denied` 오류가 사라져야 함
   - 대신 "Firestore 조회 성공" 메시지가 표시되어야 함

## ✅ 성공 확인

다음 메시지가 콘솔에 표시되면 성공입니다:
- ✅ "Firestore 사용자 정보 조회 중... UID: [UID]"
- ✅ "Firestore 조회 성공"
- ✅ 로그인 성공 알림

## 🚨 여전히 문제가 발생하는 경우

### 확인 사항 1: 데이터베이스 확인
Firebase Console에서:
1. Firestore Database 페이지로 이동
2. 상단에 여러 데이터베이스가 표시되는지 확인
   - 예: "(default)", "test-db" 등
3. **"(default)" 데이터베이스**의 규칙을 수정했는지 확인

### 확인 사항 2: 규칙 게시 확인
1. Firebase Console > Firestore Database > 규칙 탭
2. 규칙 탭 상단에 **"게시됨"** 상태가 표시되는지 확인
3. 마지막 게시 시간이 방금 전인지 확인

### 확인 사항 3: 규칙 내용 확인
규칙 편집기에서 다음 부분이 있는지 확인:
```javascript
match /users/{userId} {
  allow read: if request.auth != null;
  ...
}
```

이 부분이 반드시 있어야 합니다!

## 💡 핵심 포인트

**가장 중요한 것:**
1. ✅ Firebase Console에서 **"게시" 버튼을 클릭했는가?**
2. ✅ **"규칙이 게시되었습니다"** 메시지를 확인했는가?
3. ✅ 규칙 탭 상단에 **"게시됨"** 상태가 표시되는가?

**이 세 가지를 모두 확인하지 않으면 규칙이 적용되지 않습니다!**

규칙을 편집만 하고 게시하지 않으면 절대 적용되지 않습니다.

