# Firestore 회원관리 보안 규칙 설정 가이드

## 문제 상황
회원관리 페이지에서 "Missing or insufficient permissions" 오류가 발생하는 경우, Firestore 보안 규칙이 올바르게 설정되지 않았을 수 있습니다.

## 해결 방법

### 1. Firebase Console 접속
1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. 프로젝트 선택: `hanarooa-f227d`
3. 왼쪽 메뉴에서 **Firestore Database** 클릭
4. **규칙** 탭 클릭

### 2. 보안 규칙 설정

**완성본 파일 참조:**
프로젝트 루트의 `Firestore_보안규칙_완성본.txt` 파일에 전체 보안 규칙이 포함되어 있습니다.

**핵심 변경 사항:**
- `users/{userId}`의 `allow read` 규칙에 관리자 권한 추가
- 회원관리 기능을 위해 관리자가 모든 사용자 정보를 조회할 수 있도록 설정
- 순환 참조 방지를 위해 `isAdmin()` 헬퍼 함수 대신 직접 확인

**주요 규칙:**

```javascript
match /users/{userId} {
  // 읽기: 본인 또는 관리자만 가능
  allow read: if request.auth != null && 
    request.auth.uid != null && (
      // 본인 정보 읽기
      request.auth.uid == userId ||
      // 관리자가 다른 사용자 정보 읽기 (회원관리 기능)
      (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true)
    );
  
  // 생성: 본인만 회원가입 시 생성 가능
  allow create: if request.auth != null && 
    request.auth.uid != null && 
    request.auth.uid == userId;
  
  // 수정: 본인 또는 관리자만 가능
  allow update: if request.auth != null && 
    request.auth.uid != null && (
      request.auth.uid == userId ||
      (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true)
    );
  
  // 삭제: 관리자만 가능
  allow delete: if request.auth != null && 
    request.auth.uid != null && 
    exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
}
```

**전체 보안 규칙:**
`Firestore_보안규칙_완성본.txt` 파일의 내용을 Firebase Console에 복사하여 붙여넣으세요.

### 3. 인덱스 생성

`orderBy('createdAt')`를 사용하는 경우 인덱스가 필요할 수 있습니다.

1. Firebase Console에서 오류 메시지의 **인덱스 생성 링크**를 클릭
2. 또는 **Firestore Database** > **인덱스** 탭에서 수동 생성:
   - 컬렉션 ID: `users`
   - 필드 추가:
     - `createdAt` (내림차순)
   - 쿼리 범위: 컬렉션
   - 인덱스 생성 클릭

### 4. 관리자 계정 확인

관리자 계정이 올바르게 설정되어 있는지 확인:

1. Firestore Database > **데이터** 탭
2. `users` 컬렉션에서 관리자 계정 문서 찾기
3. `isAdmin` 필드가 `true`로 설정되어 있는지 확인

### 5. 테스트

1. 관리자 계정으로 로그인
2. Staff 페이지 > 회원관리 탭 접근
3. 회원 목록이 정상적으로 표시되는지 확인

## 주의사항

- 보안 규칙 변경 후 **게시** 버튼을 클릭해야 적용됩니다
- 보안 규칙 변경은 즉시 적용되지만, 최대 1분 정도 소요될 수 있습니다
- 테스트 모드에서는 모든 읽기/쓰기가 허용되지만, 프로덕션에서는 위 규칙을 적용해야 합니다

## 문제 해결 체크리스트

- [ ] Firebase Console에서 Firestore 보안 규칙 확인
- [ ] `users` 컬렉션에 대한 읽기 규칙이 관리자에게 허용되어 있는지 확인
- [ ] 관리자 계정의 `isAdmin` 필드가 `true`인지 확인
- [ ] `createdAt` 필드에 대한 인덱스가 생성되어 있는지 확인
- [ ] 브라우저 콘솔에서 오류 메시지 확인
- [ ] 관리자 계정으로 로그인했는지 확인

## 추가 참고

- [Firestore 보안 규칙 문서](https://firebase.google.com/docs/firestore/security/get-started)
- [Firestore 인덱스 문서](https://firebase.google.com/docs/firestore/query-data/indexing-overview)
