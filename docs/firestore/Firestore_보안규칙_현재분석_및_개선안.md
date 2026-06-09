# 현재 보안 규칙 분석 및 개선안

## 📋 현재 적용된 보안 규칙 분석

현재 보안 규칙은 전반적으로 잘 구성되어 있지만, `permission-denied` 오류가 발생하는 원인을 찾았습니다.

---

## 🔴 문제점 발견

### 1. **`get()` 함수 사용 시 문서 존재 여부 확인 누락**

**현재 규칙:**
```javascript
allow read: if request.auth != null && (
  request.auth.uid == userId || 
  exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true
);
```

**문제점:**
- `exists()`로 확인하지만, 문서가 없을 때 `get()`을 호출하면 오류가 발생할 수 있음
- 사용자가 처음 로그인할 때 자신의 문서를 읽으려고 하는데, 다른 사용자 문서를 `get()`으로 읽으려고 시도하면 권한 오류 발생 가능

### 2. **관리자 확인 로직의 순환 참조 가능성**

관리자가 다른 사용자 정보를 읽으려고 할 때:
1. 자신의 문서를 `get()`으로 읽어서 `isAdmin` 확인
2. 하지만 자신의 문서를 읽는 것도 같은 규칙을 거쳐야 함
3. 이로 인해 순환 참조나 권한 문제 발생 가능

---

## ✅ 개선된 보안 규칙

### 옵션 1: 간단한 버전 (즉시 테스트용 - 권장)

이 버전은 관리자 기능 없이 본인만 읽기/수정 가능하도록 단순화했습니다.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 사용자 정보 - 본인만 읽기/수정 가능
    match /users/{userId} {
      // 읽기: 본인 정보만 읽기 가능
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // 생성: 본인만 회원가입 시 생성 가능
      allow create: if request.auth != null && request.auth.uid == userId;
      
      // 수정: 본인만 수정 가능
      allow update: if request.auth != null && request.auth.uid == userId;
      
      // 삭제: 본인만 삭제 가능 (관리자 기능은 나중에 추가)
      allow delete: if request.auth != null && request.auth.uid == userId;
    }

    // A/S 게시판 - 공개 읽기, 인증된 사용자만 작성
    match /asPosts/{document} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        (!exists(resource.data.authorId) || resource.data.authorId == request.auth.uid);
    }

    // 직원 게시판 - 모든 로그인 사용자 접근 (임시)
    match /staffPosts/{board} {
      allow read, write: if request.auth != null;
    }

    // 활동사진첩
    match /activityPhotos/{photoId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        (!exists(resource.data.uploadedBy) || resource.data.uploadedBy == request.auth.uid);
    }
  }
}
```

**특징:**
- ✅ 가장 간단하고 확실한 규칙
- ✅ 본인 정보만 읽기/수정 가능
- ✅ 관리자 기능 없음 (나중에 추가 가능)
- ✅ 순환 참조 문제 없음

---

### 옵션 2: 관리자 기능 포함 버전 (개선된)

관리자 기능이 필요한 경우 사용하는 버전입니다.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 헬퍼 함수: 관리자 확인 (문서 존재 여부 먼저 확인)
    function isAdmin() {
      return request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // 헬퍼 함수: 임직원 확인
    function isEmployee() {
      return request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.userType == 'employee' ||
         isAdmin());
    }
    
    // 사용자 정보
    match /users/{userId} {
      // 읽기: 본인 정보만 읽기 가능 (관리자는 예외)
      allow read: if request.auth != null && (
        request.auth.uid == userId || isAdmin()
      );
      
      // 생성: 본인만 회원가입 시 생성 가능
      allow create: if request.auth != null && request.auth.uid == userId;
      
      // 수정: 본인만 수정 가능 (관리자는 예외)
      allow update: if request.auth != null && (
        request.auth.uid == userId || isAdmin()
      );
      
      // 삭제: 관리자만 가능
      allow delete: if isAdmin();
    }

    // A/S 게시판
    match /asPosts/{document} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && (
        (!exists(resource.data.authorId) || resource.data.authorId == request.auth.uid) ||
        isAdmin()
      );
    }

    // 직원 게시판
    match /staffPosts/{board} {
      allow read, write: if isEmployee();
    }

    // 활동사진첩
    match /activityPhotos/{photoId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && (
        (!exists(resource.data.uploadedBy) || resource.data.uploadedBy == request.auth.uid) ||
        isAdmin()
      );
    }
  }
}
```

**개선 사항:**
- ✅ `exists()` 확인 후 `get()` 호출로 안전성 향상
- ✅ 헬퍼 함수로 코드 중복 제거
- ✅ 관리자 확인 로직 개선

---

## 🚀 즉시 적용 방법

### 1단계: 간단한 버전으로 테스트 (권장)

1. **옵션 1의 규칙 복사**
2. **Firebase Console > Firestore Database > 규칙**에 붙여넣기
3. **"게시" 버튼 클릭**
4. **브라우저 완전 새로고침** (Ctrl+Shift+R 또는 Cmd+Shift+R)
5. **로그인 재시도**

### 2단계: 작동 확인 후 관리자 기능 추가

간단한 버전으로 로그인이 정상 작동하면:
1. **옵션 2의 규칙으로 교체**
2. **게시**
3. **테스트**

---

## 🔍 현재 규칙의 문제점 상세 분석

### 문제 1: `get()` 함수 호출 전 문서 존재 확인

**현재 코드:**
```javascript
exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true
```

이 코드는 이론적으로는 올바르지만, Firestore 보안 규칙에서 `get()` 함수는 읽기 권한이 필요합니다. 

**문제 시나리오:**
1. 사용자 A가 로그인
2. 사용자 A가 자신의 정보를 읽으려고 시도
3. 규칙에서 관리자인지 확인하기 위해 `get(/databases/.../users/A)` 호출
4. 하지만 사용자 A가 자신의 문서를 읽는 것도 같은 규칙을 거쳐야 함
5. 순환 참조 또는 권한 문제 발생 가능

**해결책:**
- 먼저 간단한 버전(옵션 1)으로 테스트
- 본인 정보 읽기가 정상 작동하는지 확인
- 그 다음 관리자 기능 추가

---

## 📊 규칙 비교

| 항목 | 현재 규칙 | 옵션 1 (간단) | 옵션 2 (개선) |
|------|----------|--------------|--------------|
| 본인 정보 읽기 | ✅ | ✅ | ✅ |
| 관리자 기능 | ✅ (문제 가능) | ❌ | ✅ (개선) |
| 순환 참조 위험 | ⚠️ 있음 | ✅ 없음 | ✅ 없음 |
| 복잡도 | 높음 | 낮음 | 중간 |

---

## ✅ 권장 사항

1. **먼저 옵션 1 (간단한 버전) 적용**
   - 로그인이 정상 작동하는지 확인
   - `permission-denied` 오류 해결 확인

2. **정상 작동 확인 후 옵션 2 적용**
   - 관리자 기능이 필요한 경우
   - 헬퍼 함수로 코드 정리

3. **규칙 시뮬레이터로 테스트**
   - Firebase Console > Firestore Database > 규칙 > 시뮬레이터
   - 다양한 시나리오 테스트

---

## 🆘 여전히 문제가 발생하는 경우

1. **사용자 문서 존재 확인**
   - Firestore Database > 데이터 탭
   - `users` 컬렉션에 해당 UID 문서가 있는지 확인

2. **규칙 시뮬레이터 사용**
   - 정확한 오류 원인 파악

3. **임시로 모든 사용자 읽기 허용 (테스트용)**
   ```javascript
   match /users/{userId} {
     allow read: if request.auth != null;  // 모든 로그인 사용자가 모든 사용자 정보 읽기 가능 (테스트용)
   }
   ```
   이 규칙으로 테스트하여 로그인이 작동하면, 그 다음 단계로 본인만 읽기 가능하도록 수정
