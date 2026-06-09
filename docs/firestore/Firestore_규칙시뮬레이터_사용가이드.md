# Firestore 규칙 시뮬레이터 사용 가이드

## 📋 "필드" 항목 입력 방법

Firestore 보안 규칙 시뮬레이터에서 "필드" 항목에 입력해야 하는 값은 **테스트하려는 규칙의 조건**에 따라 다릅니다.

---

## 🔍 현재 상황 분석

이미지에서 보이는 설정:
- **필드**: (비어있음) ← 여기에 입력해야 함
- **유형**: string
- **문자열**: `jrSeEHFpXiPJKymdRuYDLhhjhXk1` (UID)

이것은 **인증된 사용자(authenticated user)**의 UID를 테스트하는 설정으로 보입니다.

---

## ✅ 올바른 입력 방법

### 경우 1: 인증된 사용자 UID 테스트

**필드 항목에 입력:**
```
request.auth.uid
```

**설명:**
- `request.auth.uid`는 현재 로그인한 사용자의 UID를 나타냅니다
- 보안 규칙에서 `request.auth.uid == userId` 같은 조건을 테스트할 때 사용합니다

**전체 설정:**
- 필드: `request.auth.uid`
- 유형: string
- 문자열: `jrSeEHFpXiPJKymdRuYDLhhjhXk1`

---

### 경우 2: 문서 데이터의 UID 필드 테스트

**필드 항목에 입력:**
```
resource.data.uid
```

**설명:**
- `resource.data.uid`는 Firestore 문서에 저장된 `uid` 필드 값을 나타냅니다
- 문서의 데이터를 확인할 때 사용합니다

**전체 설정:**
- 필드: `resource.data.uid`
- 유형: string
- 문자열: `jrSeEHFpXiPJKymdRuYDLhhjhXk1`

---

### 경우 3: 경로 변수 테스트

**필드 항목에 입력:**
```
userId
```

**설명:**
- `userId`는 보안 규칙의 경로 변수입니다
- `match /users/{userId}`에서 `{userId}` 부분을 나타냅니다

**전체 설정:**
- 필드: `userId`
- 유형: string
- 문자열: `jrSeEHFpXiPJKymdRuYDLhhjhXk1`

---

## 🎯 현재 상황에 맞는 입력

현재 보안 규칙이 다음과 같다면:
```javascript
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
}
```

**시뮬레이터 설정:**
1. **위치**: `users/jrSeEHFpXiPJKymdRuYDLhhjhXk1`
2. **읽기** 선택
3. **인증된 사용자** 섹션:
   - **필드**: `request.auth.uid` ← **이것을 입력하세요!**
   - **유형**: string
   - **문자열**: `jrSeEHFpXiPJKymdRuYDLhhjhXk1`

---

## 📝 일반적인 필드 값들

### 인증 관련
- `request.auth.uid` - 로그인한 사용자의 UID
- `request.auth.token.email` - 로그인한 사용자의 이메일
- `request.auth != null` - 로그인 여부 (불리언)

### 문서 데이터 관련
- `resource.data.uid` - 문서의 uid 필드
- `resource.data.email` - 문서의 email 필드
- `resource.data.isAdmin` - 문서의 isAdmin 필드 (불리언)
- `resource.data.userType` - 문서의 userType 필드

### 경로 변수 관련
- `userId` - 경로 변수 (match /users/{userId}에서)
- `document` - 경로 변수 (match /asPosts/{document}에서)

---

## 🔧 시뮬레이터 사용 예시

### 예시 1: 본인 정보 읽기 테스트

**보안 규칙:**
```javascript
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
}
```

**시뮬레이터 설정:**
- 위치: `users/jrSeEHFpXiPJKymdRuYDLhhjhXk1`
- 작업: 읽기
- 인증된 사용자:
  - 필드: `request.auth.uid`
  - 유형: string
  - 문자열: `jrSeEHFpXiPJKymdRuYDLhhjhXk1`

**예상 결과:** ✅ 허용됨 (UID가 일치하므로)

---

### 예시 2: 다른 사용자 정보 읽기 테스트

**시뮬레이터 설정:**
- 위치: `users/jrSeEHFpXiPJKymdRuYDLhhjhXk1`
- 작업: 읽기
- 인증된 사용자:
  - 필드: `request.auth.uid`
  - 유형: string
  - 문자열: `다른UID123456789` (다른 UID)

**예상 결과:** ❌ 거부됨 (UID가 일치하지 않으므로)

---

## 💡 핵심 정리

**현재 상황에서 "필드" 항목에 입력할 값:**

```
request.auth.uid
```

**이유:**
- 보안 규칙에서 `request.auth.uid == userId` 조건을 테스트하려고 합니다
- 시뮬레이터에서 인증된 사용자의 UID를 설정하는 부분입니다
- 따라서 `request.auth.uid`를 입력해야 합니다

---

## ✅ 단계별 입력 방법

1. **"필드" 입력란 클릭**

2. **다음 중 하나 입력:**
   - `request.auth.uid` (가장 일반적)
   - `resource.data.uid` (문서 데이터 확인 시)
   - `userId` (경로 변수 확인 시)

3. **"유형" 확인**
   - string (문자열) - UID는 문자열이므로 string이 맞습니다

4. **"문자열" 입력란 확인**
   - `jrSeEHFpXiPJKymdRuYDLhhjhXk1` (이미 입력되어 있음)

5. **"추가" 버튼 클릭**

---

## 🆘 여전히 모르겠다면

**가장 안전한 선택:**
```
request.auth.uid
```

이것은 대부분의 경우에 사용되는 값입니다.
