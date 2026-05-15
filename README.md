# get-pokemon

포켓몬 카드 뽑기 (TCG Pocket 스타일) — Firebase 기반.

- 관리자가 카드/팩/슬롯별 등급 확률을 등록
- 사용자는 팩을 열어 카드를 뽑고 컬렉션 보유
- 가챠 추첨은 **서버사이드(Cloud Functions)** 에서만 수행

자세한 구조와 설정은 [CLAUDE.md](./CLAUDE.md) 참고.

## Quick start (로컬 에뮬레이터)

```bash
# 의존성
cd functions && npm install && cd ..
cd web      && npm install && cd ..

# 에뮬레이터 (auth/firestore/functions/hosting/storage)
firebase emulators:start

# 다른 터미널에서 web dev 서버
cd web
cp .env.example .env   # VITE_USE_EMULATORS=true 로 설정
npm run dev
```

## 테스트

```bash
cd functions
npm test     # 가챠 분포 검증 (vitest)
```
