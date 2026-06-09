# Firebase Storage CORS 설정 가이드 (GitHub Pages 배포용)

## GitHub Pages 배포 시 스프레드시트 표시를 위한 필수 설정

### ✅ 현재 상태
- Firebase 설정: ✅ 완료
- Firebase Storage 사용: ✅ 완료
- 코드 구조: ✅ GitHub Pages 호환

### ⚠️ 필수 설정 사항

#### 1. Firebase Storage CORS 설정 (필수)

GitHub Pages에서 Firebase Storage에 접근하려면 CORS 설정이 필요합니다.

**설정 방법:**

1. **Google Cloud SDK 설치**
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # 또는 공식 사이트에서 다운로드
   # https://cloud.google.com/sdk/docs/install
   ```

2. **Google Cloud 인증**
   ```bash
   gcloud auth login
   gcloud config set project hanarooa-f227d
   ```

3. **CORS 설정 파일 생성** (`cors.json`)
   ```json
   [
     {
       "origin": [
         "https://your-username.github.io",
         "https://your-username.github.io/*",
         "http://localhost:5500",
         "http://127.0.0.1:5500"
       ],
       "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
       "responseHeader": [
         "Content-Type",
         "Content-Length",
         "Access-Control-Allow-Origin"
       ],
       "maxAgeSeconds": 3600
     }
   ]
   ```
   
   **주의:** `your-username`을 실제 GitHub 사용자명으로 변경하세요.

4. **CORS 설정 적용**
   ```bash
   gsutil cors set cors.json gs://hanarooa-f227d.firebasestorage.app
   ```

5. **설정 확인**
   ```bash
   gsutil cors get gs://hanarooa-f227d.firebasestorage.app
   ```

#### 2. Firebase Storage 보안 규칙 확인

Firebase Console에서 Storage 보안 규칙을 확인하세요:

**권장 설정:**
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // school-list 폴더는 인증된 사용자만 읽기 가능
    match /school-list/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

**테스트용 (임시):**
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /school-list/{allPaths=**} {
      allow read: if true;  // 임시로 모든 사용자 읽기 허용
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

#### 3. GitHub Pages 배포 확인 사항

1. **상대 경로 확인**
   - ✅ 모든 경로가 상대 경로로 설정되어 있음
   - ✅ `./hanaro/...` 형식 사용

2. **라이브러리 로드 확인**
   - ✅ Firebase SDK: CDN 사용 (정상 작동)
   - ✅ SheetJS: CDN 사용 (정상 작동)
   - ⚠️ Tabulator: 로컬 파일 사용 (`./hanaro/school/lib/tabulator/`)
     - GitHub에 파일이 업로드되어 있는지 확인 필요

3. **파일 구조 확인**
   ```
   프로젝트H/
   ├── index.html
   ├── hanaro/
   │   ├── js/
   │   │   ├── auth.js
   │   │   └── router.js
   │   ├── school/
   │   │   └── lib/
   │   │       └── tabulator/
   │   │           ├── tabulator.min.css
   │   │           └── tabulator.min.js
   │   └── ...
   ```

### 🔍 문제 해결

#### 문제 1: CORS 오류
**증상:** `Access-Control-Allow-Origin` 오류
**해결:** 위의 CORS 설정 적용

#### 문제 2: 파일을 찾을 수 없음
**증상:** `storage/object-not-found` 오류
**해결:** 
- Firebase Storage에 `school-list/school-list.xlsx` 파일이 업로드되어 있는지 확인
- 파일 경로가 정확한지 확인

#### 문제 3: 권한 오류
**증상:** `storage/unauthorized` 오류
**해결:**
- Firebase Storage 보안 규칙 확인
- 사용자가 로그인되어 있는지 확인
- Firestore에서 사용자 권한 확인

### 📝 체크리스트

배포 전 확인 사항:
- [ ] Firebase Storage CORS 설정 완료
- [ ] Firebase Storage 보안 규칙 설정 완료
- [ ] `school-list/school-list.xlsx` 파일이 Storage에 업로드됨
- [ ] Tabulator 라이브러리 파일이 GitHub에 포함됨
- [ ] GitHub Pages URL이 CORS 설정에 포함됨
- [ ] 테스트: GitHub Pages에서 스프레드시트 로드 확인

### 🚀 배포 후 테스트

1. GitHub Pages URL로 접속
2. 로그인
3. "납품학교 리스트" 클릭
4. 스프레드시트가 정상적으로 표시되는지 확인
5. 브라우저 콘솔에서 오류 확인

### 💡 추가 권장 사항

1. **환경 변수 사용 (선택)**
   - Firebase 설정을 환경 변수로 관리 (보안 강화)

2. **에러 핸들링 개선**
   - CORS 오류 시 명확한 안내 메시지 표시

3. **캐싱 전략**
   - 엑셀 파일 다운로드 결과를 캐싱하여 성능 개선
