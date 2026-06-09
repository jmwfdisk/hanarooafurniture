# Firestore 권한 오류 해결: 순환 참조 문제

## 문제 증상
```
FirebaseError: [code=permission-denied]: Missing or insufficient permissions.
사용자 정보 조회 오류 발생
```

## 원인
`Firestore_보안규칙_최종본.txt`에서 순환 참조 문제가 발생합니다:

1. `isAdmin()` 함수가 `users/{userId}` 문서를 읽으려고 시도
2. `users/{userId}` 규칙이 `isAdmin()`을 호출하여 권한 확인
3. **순환 참조 발생** → 권한 확인 실패

```javascript
// 문제가 있는 코드
function isAdmin() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
}

match /users/{userId} {
  allow read: if request.auth.uid == userId || isAdmin();  // 순환 참조!
}
```

## 해결 방법

### 방법 1: 간단버전 규칙 사용 (권장)
`Firestore_보안규칙_간단버전_최종.txt`를 사용하세요. 이 버전은 순환 참조가 없습니다.

**적용 방법:**
1. Firebase Console → Firestore Database → Rules 탭으로 이동
2. `Firestore_보안규칙_간단버전_최종.txt` 파일 내용을 복사
3. Rules 편집기에 붙여넣기
4. "게시" 버튼 클릭

### 방법 2: 순환참조 수정본 사용
`Firestore_보안규칙_순환참조_수정본.txt`를 사용하세요.

**차이점:**
- `users/{userId}` 규칙에서 `isAdmin()` 호출 제거
- 본인 문서만 읽기/수정 가능
- 관리자 기능은 다른 컬렉션에서만 사용

## 즉시 적용 가이드

### 1단계: 현재 규칙 확인
Firebase Console에서 현재 적용된 규칙 확인

### 2단계: 간단버전 규칙 적용
```bash
# 파일 위치
docs/security-rules/rules/Firestore_보안규칙_간단버전_최종.txt
```

### 3단계: 테스트
1. 브라우저에서 로그인 시도
2. 콘솔에서 "Firestore 조회 성공" 메시지 확인
3. 권한 오류가 사라졌는지 확인

## 참고사항

### 간단버전 규칙의 특징
- ✅ 순환 참조 없음
- ✅ 본인 문서 읽기/수정 가능
- ✅ 회원가입 가능
- ⚠️ 관리자가 다른 사용자 문서 읽기 불가 (추후 개선 가능)

### 관리자 기능이 필요한 경우
나중에 관리자 기능이 필요하면:
1. 별도의 관리자 전용 컬렉션 사용
2. 또는 Cloud Functions를 통한 관리자 작업 처리

## 체크리스트
- [ ] Firebase Console에서 현재 규칙 확인
- [ ] 간단버전 규칙 파일 열기
- [ ] 규칙 복사하여 Firebase Console에 붙여넣기
- [ ] "게시" 버튼 클릭
- [ ] 브라우저에서 로그인 테스트
- [ ] 콘솔에서 오류 메시지 확인
