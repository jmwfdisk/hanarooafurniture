# Firebase Storage 보안 규칙 업데이트 가이드 (만료 경고 해결)

## ⚠️ 현재 상황

Firebase에서 **2일 내로 Cloud Storage 버킷에 대한 클라이언트 액세스가 만료**된다는 경고를 받았습니다.

**원인:**
- Storage가 테스트 모드로 시작되어 30일 동안만 공개 접근 허용
- 30일 후 자동으로 모든 클라이언트 요청이 거부되도록 설정됨

**해결 방법:**
- 적절한 보안 규칙을 설정하여 데이터를 보호하면서 앱이 정상 작동하도록 해야 합니다.

---

## 📋 프로젝트에서 사용하는 Storage 경로

프로젝트에서 다음 경로들을 사용하고 있습니다:

1. **`school-list/`** - 납품학교 리스트 엑셀 파일
   - 읽기: 인증된 사용자만
   - 쓰기: 관리자만

2. **`as-files/`** - A/S 신청 첨부 파일
   - 읽기: 모든 사용자 (관리자가 확인)
   - 쓰기: 모든 사용자 (A/S 신청 시 업로드)

3. **`activity-photos/`** - 직원 활동 사진
   - 읽기: 인증된 사용자만
   - 쓰기/삭제: 관리자만

---

## 🔧 보안 규칙 설정 방법

### 1단계: Firebase Console 접속

1. https://console.firebase.google.com/ 접속
2. 프로젝트 **"hanarooa-f227d"** 선택
3. 왼쪽 사이드바에서 **"Storage"** 클릭
4. 상단 탭에서 **"규칙"** 클릭

### 2단계: 보안 규칙 입력

다음 보안 규칙을 복사하여 붙여넣으세요:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // ========== 납품학교 리스트 (school-list) ==========
    // 인증된 사용자만 읽기 가능, 관리자만 쓰기 가능
    match /school-list/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // ========== A/S 신청 파일 (as-files) ==========
    // 모든 사용자가 읽기/쓰기 가능 (A/S 신청용)
    match /as-files/{fileName} {
      allow read: if true;
      allow write: if true;
    }
    
    // ========== 직원 활동 사진 (activity-photos) ==========
    // 인증된 사용자만 읽기 가능, 관리자만 쓰기/삭제 가능
    match /activity-photos/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
      allow delete: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // ========== 기타 경로 ==========
    // 위에 명시되지 않은 모든 경로는 접근 불가
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### 3단계: 규칙 게시

1. 규칙 코드를 입력한 후
2. **"게시"** 또는 "Publish" 버튼 클릭
3. 확인 메시지가 표시되면 완료!

---

## 🔍 규칙 설명

### school-list 규칙
```javascript
match /school-list/{allPaths=**} {
  allow read: if request.auth != null;  // 로그인한 사용자만 읽기
  allow write: if request.auth != null && 
                  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
                  // 관리자만 쓰기 가능
}
```

### as-files 규칙
```javascript
match /as-files/{fileName} {
  allow read: if true;   // 모든 사용자 읽기 가능
  allow write: if true;  // 모든 사용자 쓰기 가능 (A/S 신청용)
}
```

### activity-photos 규칙
```javascript
match /activity-photos/{fileName} {
  allow read: if request.auth != null;  // 로그인한 사용자만 읽기
  allow write: if request.auth != null && 
                  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
                  // 관리자만 쓰기/삭제 가능
}
```

---

## ✅ 설정 완료 확인

### 1. 규칙 게시 확인
- Firebase Console > Storage > 규칙 탭에서 규칙이 저장되었는지 확인

### 2. 기능 테스트

**납품학교 리스트 테스트:**
1. 로그인하지 않은 상태에서 `/school` 페이지 접속
2. 엑셀 파일이 로드되지 않아야 함 (정상)
3. 로그인 후 다시 접속
4. 엑셀 파일이 정상적으로 로드되어야 함

**A/S 신청 테스트:**
1. 로그인하지 않은 상태에서 A/S 신청 페이지 접속
2. 파일 첨부 후 등록
3. 정상적으로 업로드되어야 함

**직원 활동 사진 테스트:**
1. 로그인하지 않은 상태에서 활동 사진 확인
2. 사진이 표시되지 않아야 함 (정상)
3. 로그인 후 다시 확인
4. 사진이 정상적으로 표시되어야 함

---

## ⚠️ 주의사항

### 1. Firestore 데이터베이스 ID 확인
보안 규칙에서 `$(database)`를 사용하고 있습니다. 
- 기본값은 `(default)`입니다.
- 다른 데이터베이스를 사용하는 경우, Firestore 설정에서 데이터베이스 ID를 확인하고 규칙을 수정하세요.

### 2. 사용자 권한 구조 확인
보안 규칙은 Firestore의 `users/{uid}` 문서에서 `isAdmin` 필드를 확인합니다.
- 사용자 문서 구조가 다른 경우 규칙을 수정해야 합니다.
- 예: `isAdmin` 대신 `role == 'admin'`을 사용하는 경우

### 3. 테스트 모드 규칙 (임시 사용 시)
만약 빠른 테스트가 필요하다면, 다음 규칙을 임시로 사용할 수 있습니다 (보안에 취약함):

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;  // ⚠️ 모든 사용자 접근 허용 (보안 취약)
    }
  }
}
```

**⚠️ 주의:** 이 규칙은 보안에 취약하므로 프로덕션 환경에서는 사용하지 마세요!

---

## 🐛 문제 해결

### 문제 1: "Permission denied" 오류

**증상:**
- 파일 업로드/다운로드 시 권한 오류 발생

**해결:**
1. Firebase Console > Storage > 규칙 탭에서 규칙이 올바르게 게시되었는지 확인
2. 사용자가 로그인되어 있는지 확인
3. 관리자 권한이 필요한 작업인 경우, Firestore에서 사용자의 `isAdmin` 필드 확인

### 문제 2: 규칙이 적용되지 않음

**증상:**
- 규칙을 게시했지만 여전히 오류 발생

**해결:**
1. 규칙 게시 후 몇 분 정도 기다리기 (최대 5분)
2. 브라우저 캐시 삭제 후 다시 시도
3. Firebase Console에서 규칙이 올바르게 저장되었는지 확인

### 문제 3: Firestore 데이터베이스 ID 오류

**증상:**
- `$(database)` 관련 오류 발생

**해결:**
1. Firebase Console > Firestore Database로 이동
2. 데이터베이스 ID 확인 (기본값: `(default)`)
3. 다른 ID를 사용하는 경우, 규칙에서 `$(database)` 대신 실제 ID 사용:
   ```javascript
   get(/databases/your-database-id/documents/users/$(request.auth.uid))
   ```

---

## 📝 체크리스트

설정 완료 후 확인:

- [ ] Firebase Console > Storage > 규칙 탭 접속
- [ ] 보안 규칙 코드 입력 완료
- [ ] 규칙 게시 완료
- [ ] 납품학교 리스트 읽기 테스트 (로그인 필요)
- [ ] A/S 파일 업로드 테스트 (로그인 불필요)
- [ ] 활동 사진 읽기 테스트 (로그인 필요)
- [ ] 브라우저 콘솔에서 오류 확인 (F12)
- [ ] 만료 경고 메시지가 사라졌는지 확인 (24시간 후)

---

## 🔗 참고 링크

- [Firebase Storage 보안 규칙 문서](https://firebase.google.com/docs/storage/security)
- [Firebase Storage 보안 규칙 예제](https://firebase.google.com/docs/storage/security/rules-conditions)
- [Firestore 보안 규칙과 연동](https://firebase.google.com/docs/storage/security/rules-conditions#access_other_documents)

---

## 💡 추가 권장사항

### 1. 파일 크기 제한 추가
보안 규칙에 파일 크기 제한을 추가할 수 있습니다:

```javascript
match /as-files/{fileName} {
  allow write: if request.resource.size < 10 * 1024 * 1024;  // 10MB 제한
}
```

### 2. 파일 타입 제한
특정 파일 타입만 허용:

```javascript
match /as-files/{fileName} {
  allow write: if request.resource.contentType.matches('image/.*') || 
                  request.resource.contentType.matches('application/pdf');
}
```

### 3. 파일명 검증
파일명에 특정 패턴만 허용:

```javascript
match /as-files/{fileName} {
  allow write: if fileName.matches('.*\\.(jpg|jpeg|png|pdf)$');
}
```

---

**⚠️ 중요:** 이 가이드를 따라 설정하면 2일 내 만료 경고를 해결할 수 있습니다. 규칙을 게시한 후 24시간 이내에 Firebase에서 분석이 실행되어 경고가 사라집니다.

