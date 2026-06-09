# Firebase Storage CORS 설정 가이드

## CORS 오류 해결 방법

GitHub에 배포한 후 인터넷 환경에서도 정상 작동하도록 Firebase Storage의 CORS 설정이 필요합니다.

## 방법 1: gsutil 명령어 사용 (권장)

### 1단계: Google Cloud SDK 설치

1. https://cloud.google.com/sdk/docs/install 에서 Google Cloud SDK 설치
2. 터미널에서 `gcloud auth login` 실행하여 로그인
3. `gcloud config set project hanarooa-f227d` 실행

### 2단계: CORS 설정 파일 생성

프로젝트 루트에 `cors.json` 파일이 생성되어 있습니다.

### 3단계: CORS 설정 적용

터미널에서 다음 명령어 실행:

```bash
gsutil cors set cors.json gs://hanarooa-f227d.firebasestorage.app
```

또는:

```bash
gsutil cors set cors.json gs://hanarooa-f227d.firebasestorage.app/school-list
```

### 4단계: 설정 확인

```bash
gsutil cors get gs://hanarooa-f227d.firebasestorage.app
```

## 방법 2: Firebase Console에서 확인

1. Firebase Console > Storage > 설정
2. CORS 설정 확인
3. 필요시 수동으로 설정

## 배포 환경에서의 동작

### GitHub Pages 배포 시

- **도메인**: `https://[username].github.io/[repository-name]/`
- Firebase Storage는 기본적으로 HTTPS 도메인에서의 접근을 허용합니다
- CORS 설정이 되어 있으면 정상 작동합니다

### 로컬 개발 환경 vs 배포 환경

- **로컬**: `http://127.0.0.1:5500` - CORS 오류 발생 가능
- **배포**: `https://[domain]` - CORS 설정 시 정상 작동

## CORS 설정 파일 내용

`cors.json` 파일:
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length"],
    "maxAgeSeconds": 3600
  }
]
```

이 설정은:
- 모든 도메인에서 접근 허용 (`origin: ["*"]`)
- GET, HEAD 메서드만 허용
- Content-Type, Content-Length 헤더 허용
- 캐시 시간: 3600초 (1시간)

## 보안을 강화하려면

특정 도메인만 허용하려면:
```json
[
  {
    "origin": [
      "https://[username].github.io",
      "https://[your-domain].com"
    ],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length"],
    "maxAgeSeconds": 3600
  }
]
```

## 문제 해결

### CORS 오류가 계속 발생하는 경우

1. `gsutil cors set` 명령어가 제대로 실행되었는지 확인
2. Firebase Console에서 Storage 설정 확인
3. 브라우저 캐시 삭제 후 재시도
4. 배포된 환경에서 테스트 (로컬이 아닌 실제 도메인)

### 배포 후에도 오류가 발생하는 경우

1. Firebase Storage 보안 규칙 확인
2. 파일 경로가 올바른지 확인 (`school-list/school-list.xlsx`)
3. 파일이 실제로 업로드되었는지 Firebase Console에서 확인

