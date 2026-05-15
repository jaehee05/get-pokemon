# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**포켓몬 카드 뽑기 (Pokémon TCG Pocket 스타일)** 웹앱.

- **관리자**: 카드 마스터 + 팩 정의(슬롯별 등급 가중치)를 DB에 등록.
- **사용자**: 팩을 열어 카드를 뽑고 자신의 컬렉션 보유.

## Repository Layout

```
/firebase.json              # hosting/functions/firestore/storage/emulators
/firestore.rules            # 클라이언트 쓰기 차단, admin claim 게이팅
/firestore.indexes.json
/storage.rules
/functions/                 # Cloud Functions (Node 20, TS)
  src/types.ts              # Rarity, Card, Pack, SlotConfig
  src/gacha.ts              # 순수 추첨 로직 (테스트 가능)
  src/gacha.test.ts         # vitest — 분포 검증
  src/index.ts              # openPack / setAdmin / grantCurrency callables
/web/                       # React + Vite + TS
  src/firebase.ts           # SDK 초기화 + 에뮬레이터 연결
  src/auth.tsx              # Google 로그인 + admin claim 추적
  src/pages/Home.tsx        # 활성 팩 목록
  src/pages/PackOpen.tsx    # openPack 호출 + 카드 뒤집기 연출
  src/pages/Inventory.tsx   # 내 카드 컬렉션
  src/pages/Admin*.tsx      # 카드/팩 CRUD + 슬롯 가중치 편집
```

## Data Model

### `cards/{cardId}`
```ts
{ name, imageUrl, rarity, weight, isActive }
```
- `rarity`: `common | uncommon | rare | super_rare | secret_rare`
- `weight`: 같은 등급 내 가중치 (기본 1, 클수록 자주 등장)

### `packs/{packId}`
```ts
{
  name, imageUrl, cardCount, price, isActive,
  slots: SlotConfig[],   // length === cardCount
  cardPool: cardId[]     // 빈 배열이면 전체 활성 카드
}

type SlotConfig = { rarityWeights: { [rarity]: number } }
```

각 슬롯에서:
1. `rarityWeights` 로 등급을 가중 추첨
2. 그 등급의 `cardPool` 안에서 `card.weight` 로 카드를 가중 추첨

**TCG Pocket 기본값** (`web/src/pages/AdminPacks.tsx` `defaultSlots`):
- 슬롯 1-3: `{ common: 100 }`
- 슬롯 4: `{ uncommon: 90, rare: 10 }`
- 슬롯 5 (Hit): `{ rare: 70, super_rare: 25, secret_rare: 5 }`

### `users/{uid}` & `users/{uid}/inventory/{cardId}`
- `currency`: 팩 구매 재화
- `inventory.{cardId}`: `count`, `firstObtainedAt`, `lastObtainedAt`

### `pulls/{pullId}`
뽑기 감사 로그. `uid`, `packId`, `resultCardIds`, `rarities`, `createdAt`.

## CRITICAL: 가챠는 항상 서버사이드

- 추첨 + 인벤토리 갱신은 **반드시** `functions/src/index.ts#openPack` 안에서.
- Firestore rules는 `cards`/`packs`/`inventory`/`pulls` 클라이언트 쓰기 차단.
- 카드/팩 쓰기는 admin custom claim 만 허용.
- 첫 admin은 `setAdmin` callable 부트스트랩 — admin 이 한 명도 없을 때 호출자 본인을 admin 으로 승격.

## 확률 가중치 락다운

- `packs/{packId}` 의 client read 는 **admin 만 허용**. 일반 사용자는 `slots`/`cardPool`/`weight` 를 못 본다.
- 사용자용 슬림 메타데이터는 callable `listActivePacks` 로만 노출 — `{ id, name, imageUrl, cardCount, price }` 만 반환.
- 따라서 새 사용자 화면에서 팩 정보가 필요하면 Firestore 직접 read 하지 말고 `listActivePacks` 호출. 직접 read 하는 코드는 admin 화면에서만.

## Common Commands

```bash
# functions
cd functions
npm install
npm run build          # tsc
npm test               # vitest (gacha 분포 검증)

# web
cd web
npm install
cp .env.example .env   # Firebase config 채우기
npm run dev            # http://localhost:5173
npm run build

# 로컬 풀스택 에뮬레이터
firebase emulators:start

# 배포
firebase deploy --only firestore:rules,storage,functions,hosting
```

## Setup (최초 1회)

1. Firebase 콘솔에서 프로젝트 생성, **Authentication → Google** 활성화, **Firestore** 만들기.
2. 루트에서 `firebase use --add` 로 프로젝트 연결.
3. `web/.env` 에 Firebase web SDK 설정 채우기.
4. `firebase deploy --only firestore:rules,storage,functions,hosting`.
5. 배포된 사이트에서 Google 로그인 후 브라우저 콘솔:
   ```js
   const { getFunctions, httpsCallable } = await import("firebase/functions");
   await httpsCallable(getFunctions(undefined, "asia-northeast3"), "setAdmin")({});
   ```
   첫 호출자가 admin. 이후 로그아웃→재로그인 (claim refresh).

## Notes for Claude

- **가챠 로직을 클라이언트로 옮기는 PR은 거절.**
- `cardCount` 와 `slots.length` 가 항상 일치 — 어드민에서 자동 동기화하고 서버에서도 한 번 더 검증함.
- 새 rarity 추가 시: `functions/src/types.ts` + `web/src/types.ts` 양쪽 업데이트.
- 분포 변경 후엔 `functions/` 의 `npm test` 통계 검증 thresholds 확인.
