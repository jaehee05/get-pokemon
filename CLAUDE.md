# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

`get-pokemon` — Pokémon 데이터를 조회/표시하는 프로젝트.

> 현재 레포는 비어있는 상태입니다. 첫 커밋이 추가되면 이 문서를 실제 구조에 맞춰 업데이트하세요.

## Suggested Stack

아직 코드가 없으므로 결정되지 않았습니다. 다음 중 선택을 고려:

- **Frontend only**: React + Vite, PokéAPI(https://pokeapi.co) 직접 호출
- **Full-stack**: Next.js (App Router) — 서버 컴포넌트에서 PokéAPI fetch + 캐싱
- **Static**: 단순 HTML + fetch — 학습용으로 충분

## External API

- PokéAPI: `https://pokeapi.co/api/v2/pokemon/{id-or-name}`
- 인증 불필요, rate limit 관대 — 하지만 동일 요청은 캐싱 권장 (SWR / React Query / Next.js `fetch` cache).

## Conventions (to confirm once code lands)

- 패키지 매니저: `npm` / `pnpm` / `bun` 중 택1 — 첫 커밋의 lockfile로 확정.
- 코드 스타일: ESLint + Prettier 기본값 권장.
- 커밋: Conventional Commits (`feat:`, `fix:`, `chore:` ...) 권장.

## Common Commands

코드가 들어오면 아래를 실제 값으로 교체:

```bash
# install
# dev
# build
# test
# lint
```

## Notes for Claude

- 이 파일이 placeholder 상태라면, 첫 코드 커밋 후 실제 구조(디렉토리, 빌드 도구, 테스트 러너)에 맞춰 다시 작성해 주세요.
- PokéAPI 응답은 deeply nested — 타입/스키마를 한 곳에서 정의해두면 이후 작업이 훨씬 편합니다.
