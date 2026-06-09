# Firestore 보안 규칙 적용 가이드

## 현재 문제
로그인 후 사용자 정보 조회 시 `permission-denied` 오류가 발생합니다.

## 해결 방법

### 1단계: Firebase Console 접속
1. https://console.firebase.google.com 접속
2. 프로젝트 선택: `hanarooa-f227d`

### 2단계: Firestore Database > 규칙 탭 이동
1. 왼쪽 메뉴에서 "Firestore Database" 클릭
2. 상단 탭에서 "규칙" 클릭

### 3단계: 보안 규칙 복사 및 적용
`Firestore_보안규칙_완성본.txt` 파일의 전체 내용을 복사하여 Firebase Console의 규칙 편집기에 붙여넣기

### 4단계: 규칙 게시
1. "게시" 버튼 클릭
2. 확인 대화상자에서 "게시" 클릭

### 5단계: 테스트
1. 페이지 새로고침
2. 로그인 시도
3. 콘솔에서 오류 확인

## 현재 보안 규칙 요약

### 관리자 권한 체크
관리자 권한은 Firebase 콘솔에서 설정한 `isAdmin` 필드로만 확인됩니다:
- **isAdmin 필드**: Firestore의 `users/{uid}` 문서에 `isAdmin: true` 설정 필요
- 하드코딩된 UID 없음: 모든 관리자는 Firebase 콘솔에서 `isAdmin` 필드로 관리

### users 컬렉션
- **개별 문서 읽기 (`get`)**: 로그인한 사용자는 모든 문서 읽기 가능
- **목록 조회 (`list`)**: 
  - 로그인한 사용자: 모든 조회 가능
  - 로그인 전 사용자: `limit <= 1`인 쿼리만 허용 (username으로 이메일 찾기용)
- **생성 (`create`)**: 본인만 생성 가능 (`request.auth.uid == userId`)
- **수정/삭제 (`update`, `delete`)**: 로그인한 사용자만 가능

### 활동사진첩
- **삭제 권한**: 본인이 업로드한 사진이거나 관리자만 삭제 가능

## 중요 사항
- 보안 규칙 변경은 즉시 적용됩니다
- 규칙 적용 후 브라우저 캐시를 삭제하고 다시 시도하세요
- 여전히 오류가 발생하면 Firebase Console에서 규칙이 제대로 저장되었는지 확인하세요

