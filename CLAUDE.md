# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**포켓몬 카드 뽑기 (Gacha / Pack Opening)** 웹앱.

- **관리자 (나)**: 카드 마스터 데이터를 DB에 등록하고, 카드별 등장 확률을 설정한다.
- **사용자**: 팩을 열어 카드를 뽑고, 자신의 컬렉션을 확인한다.

## Core Domain

### Entities (초안 — Firestore 기준)

```
cards/{cardId}
  name: string
  imageUrl: string
  rarity: "common" | "uncommon" | "rare" | "super_rare" | "secret_rare"
  weight: number        # 확률 가중치 (예: 100 = 흔함, 1 = 시크릿)
  isActive: boolean

packs/{packId}
  name: string          # 예: "기본 팩", "특별 팩"
  cardCount: number     # 한 팩에 몇 장 (예: 5)
  cardPool: cardId[]    # 이 팩에서 나올 수 있는 카드 목록 (선택)
  price: number         # 인게임 재화 또는 0
  rarityDistribution?: { rarity: count } # 예: 5장 중 rare 1장 보장

users/{uid}
  displayName: string
  isAdmin: boolean
  currency: number      # 팩 구매용 재화 (선택)

users/{uid}/inventory/{cardId}
  count: number         # 중복 보유 수
  firstObtainedAt: timestamp

pulls/{pullId}          # 뽑기 기록 (감사/통계용)
  uid: string
  packId: string
  resultCardIds: cardId[]
  createdAt: timestamp
```

### 확률 계산 (가중치 방식)

```
totalWeight = sum(card.weight for card in pool)
roll = random() * totalWeight
누적 합산으로 어느 카드인지 결정
```

**보장 슬롯**(예: 5장 중 1장은 rare 이상)을 지원하려면 풀을 rarity 단위로 쪼개 각 슬롯마다 별도 가중 추첨.

## CRITICAL: 서버사이드 가챠

> **확률 계산과 카드 지급은 절대 클라이언트에서 하지 않는다.**

이유:
- 클라이언트가 확률을 알면 의미가 없고, 결과를 조작할 수 있음.
- 인벤토리 쓰기를 클라이언트에 맡기면 무한 뽑기가 가능.

구현:
- **Cloud Function (callable)** `openPack(packId)` 하나로 처리:
  1. 사용자 인증/재화 확인
  2. 서버에서 난수 생성 + 가중 추첨
  3. 트랜잭션으로 인벤토리/재화/pulls 기록을 한 번에 갱신
  4. 결과 카드 배열만 반환
- Firestore 보안 규칙은 `cards`, `packs`, `inventory`, `pulls`를 **클라이언트 쓰기 차단**, 읽기는 필요한 범위만 허용.

## Suggested Stack

사용자가 이미 Firebase를 쓰고 있으므로 동일 스택 권장:

- **Frontend**: React + Vite (또는 Next.js, SSR 필요 없으면 Vite로 충분)
- **Hosting**: Firebase Hosting
- **DB**: Firestore
- **가챠 로직**: Cloud Functions for Firebase (Node, callable functions)
- **Auth**: Firebase Auth (Google 로그인 권장)
- **Storage**: Firebase Storage (카드 이미지)

## Admin

- `users/{uid}.isAdmin === true` 또는 Firebase Auth **custom claim** `admin: true`로 게이팅.
- 관리자 화면: 카드 CRUD, 확률(weight) 편집, 팩 정의, 뽑기 통계.
- 보안 규칙에서 `cards`/`packs` 쓰기는 admin claim만 허용.

## UX Notes

- 팩 오픈 애니메이션은 결과를 **먼저 서버에서 받고**, 클라이언트는 그걸 연출만 한다. (결과 미리 확정 → 카드 뒤집기 연출)
- 중복 카드는 인벤토리 카운트 +1, "NEW!" 뱃지는 `firstObtainedAt`로 판단.
- 시크릿/희귀 카드는 뽑힐 때 별도 연출(빛, 진동) — 결과의 rarity 필드로 분기.

## Conventions (코드 들어오면 확정)

- 패키지 매니저: 첫 커밋 lockfile로 확정.
- 커밋: Conventional Commits (`feat:`, `fix:`, `chore:` ...).
- 디렉토리 제안:
  ```
  /web        # React 앱
  /functions  # Cloud Functions
  /firestore.rules
  /storage.rules
  ```

## Common Commands

코드가 들어오면 실제 값으로 교체:

```bash
# web 개발
# npm run dev

# functions 로컬 에뮬레이터
# firebase emulators:start

# 배포
# firebase deploy --only hosting,functions,firestore:rules
```

## Notes for Claude

- 가챠 관련 코드를 작성/수정할 때 **항상 서버사이드 위치인지 먼저 확인**. 클라이언트에서 확률/지급을 다루는 PR은 거절.
- 카드/팩/유저 인벤토리 스키마가 위 초안과 어긋나기 시작하면 이 문서를 같이 업데이트.
- 보안 규칙 변경은 항상 에뮬레이터로 테스트 후 배포.
