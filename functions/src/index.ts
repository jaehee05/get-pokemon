import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { CallableOptions, HttpsError, onCall } from "firebase-functions/v2/https";
import { logger, setGlobalOptions } from "firebase-functions/v2";
import { openPacks as runGacha } from "./gacha";
import { Card, Pack } from "./types";

initializeApp();
setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

// 모든 callable 에 동일하게 적용할 옵션. cors: true 로 모든 origin 허용
// (auth 는 함수 내부에서 검증). invoker: 'public' 은 Cloud Run IAM 에
// allUsers/run.invoker 를 명시적으로 부여 — 첫 배포 때 IAM 전파 실패로
// openPack 만 403 이 떨어지는 케이스를 영구 차단.
const callable: CallableOptions = { cors: true, invoker: "public" };

const db = getFirestore();
const auth = getAuth();

function requireAuth(uid: string | undefined): asserts uid is string {
  if (!uid) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
}

async function requireAdmin(uid: string): Promise<void> {
  const user = await auth.getUser(uid);
  if (user.customClaims?.admin !== true) {
    throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  }
}

const MAX_PACK_COUNT = 10;

/**
 * 팩 열기 — 서버사이드 추첨.
 * 입력: { packId: string, count?: number (1..10, 기본 1) }
 * 출력: 묶음 결과 (count == 1 이어도 packs 배열 길이 1).
 */
export const openPack = onCall<{ packId?: string; count?: number }>(callable, async (request) => {
  const uid = request.auth?.uid;
  requireAuth(uid);

  const packId = request.data.packId;
  if (!packId || typeof packId !== "string") {
    throw new HttpsError("invalid-argument", "packId 가 필요합니다.");
  }

  const rawCount = request.data.count ?? 1;
  const count = Math.floor(rawCount);
  if (!Number.isFinite(count) || count < 1 || count > MAX_PACK_COUNT) {
    throw new HttpsError(
      "invalid-argument",
      `count 는 1 이상 ${MAX_PACK_COUNT} 이하 정수여야 합니다.`
    );
  }

  const packSnap = await db.collection("packs").doc(packId).get();
  if (!packSnap.exists) {
    throw new HttpsError("not-found", `pack ${packId} 없음`);
  }
  const pack = { id: packSnap.id, ...packSnap.data() } as Pack;
  if (!pack.isActive) {
    throw new HttpsError("failed-precondition", "비활성화된 팩입니다.");
  }

  // 카드 풀 로드. cardPool 이 비어있으면 전체 활성 카드.
  let allCards: Card[];
  if (pack.cardPool && pack.cardPool.length > 0) {
    const refs = pack.cardPool.map((id) => db.collection("cards").doc(id));
    const docs = await db.getAll(...refs);
    allCards = docs
      .filter((d) => d.exists)
      .map((d) => ({ id: d.id, ...d.data() }) as Card);
  } else {
    const snap = await db.collection("cards").where("isActive", "==", true).get();
    allCards = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Card);
  }

  // 빠른 가드: 재고 가능한 카드가 없으면 즉시 의미있는 에러
  const drawable = allCards.filter(
    (c) => c.isActive && (c.stock ?? 0) > 0
  );
  if (drawable.length === 0) {
    logger.warn("openPack: no drawable cards", {
      packId,
      poolSize: allCards.length,
    });
    throw new HttpsError(
      "failed-precondition",
      "이 팩에서 뽑을 수 있는 카드 재고가 없습니다. 관리자에게 문의하세요."
    );
  }

  let result;
  try {
    result = runGacha(pack, allCards, count);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("openPack: gacha failed", { packId, count, msg });
    throw new HttpsError("failed-precondition", `가챠 실패: ${msg}`);
  }

  // 트랜잭션: 재화 차감 + 인벤토리 갱신 + 뽑기 기록 (묶음 전체 한 번에)
  const userRef = db.collection("users").doc(uid);

  // 모든 팩의 카드를 합산
  const countByCard = new Map<string, number>();
  for (const p of result.packs) {
    for (const c of p.cards) {
      countByCard.set(c.id, (countByCard.get(c.id) ?? 0) + 1);
    }
  }
  const inventoryRefs = Array.from(countByCard.keys()).map((cardId) => ({
    cardId,
    ref: userRef.collection("inventory").doc(cardId),
  }));
  const pickedCardRefs = Array.from(countByCard.keys()).map((cardId) => ({
    cardId,
    ref: db.collection("cards").doc(cardId),
  }));

  // 묶음 비용 = price * count
  const totalCost = (pack.price ?? 0) * count;

  // 각 팩에 대한 pull 기록 ref 미리 생성
  const pullRefs = result.packs.map(() => db.collection("pulls").doc());

  let currencyAfter: number;
  try {
    currencyAfter = await db.runTransaction(async (tx) => {
    // === reads first ===
    const userDoc = await tx.get(userRef);
    const invDocs = await Promise.all(inventoryRefs.map(({ ref }) => tx.get(ref)));
    const cardDocs = await Promise.all(pickedCardRefs.map(({ ref }) => tx.get(ref)));

    const currency = (userDoc.data()?.currency as number | undefined) ?? 0;
    if (totalCost > 0 && currency < totalCost) {
      throw new HttpsError("failed-precondition", "재화가 부족합니다.");
    }
    const next = currency - totalCost;

    // 재고 검증: 트랜잭션 시작 시점의 현재 stock 이 뽑힌 개수보다 같거나 커야 함
    for (let i = 0; i < pickedCardRefs.length; i++) {
      const { cardId } = pickedCardRefs[i];
      const want = countByCard.get(cardId)!;
      const haveData = cardDocs[i].data();
      const have = ((haveData?.stock as number | undefined) ?? 0);
      if (!cardDocs[i].exists || have < want) {
        throw new HttpsError(
          "failed-precondition",
          `재고 부족: card ${cardId} (필요 ${want}, 재고 ${have})`
        );
      }
    }

    // === writes ===
    if (!userDoc.exists) {
      tx.set(userRef, {
        displayName: request.auth?.token.name ?? "Trainer",
        currency: next,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else if (totalCost > 0) {
      tx.update(userRef, { currency: next });
    }

    // 카드 재고 차감
    for (const { cardId, ref } of pickedCardRefs) {
      const count = countByCard.get(cardId)!;
      tx.update(ref, { stock: FieldValue.increment(-count) });
    }

    for (let i = 0; i < inventoryRefs.length; i++) {
      const { cardId, ref } = inventoryRefs[i];
      const existed = invDocs[i].exists;
      const count = countByCard.get(cardId)!;
      const data: Record<string, unknown> = {
        count: FieldValue.increment(count),
        lastObtainedAt: FieldValue.serverTimestamp(),
      };
      if (!existed) {
        data.firstObtainedAt = FieldValue.serverTimestamp();
      }
      tx.set(ref, data, { merge: true });
    }

    // 각 팩별 pull 기록
    for (let i = 0; i < result.packs.length; i++) {
      tx.set(pullRefs[i], {
        uid,
        packId: pack.id,
        bundleSize: count,
        bundleIndex: i,
        resultCardIds: result.packs[i].cards.map((c) => c.id),
        rarities: result.packs[i].rarities,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return next;
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("openPack: transaction failed", { packId, msg });
    throw new HttpsError("internal", `트랜잭션 실패: ${msg}`);
  }

  logger.info("pack opened", {
    uid,
    packId,
    count,
    pullIds: pullRefs.map((r) => r.id),
  });

  return {
    pullIds: pullRefs.map((r) => r.id),
    packs: result.packs,
    currencyAfter,
    totalCost,
    count,
  };
});

/**
 * 관리자 권한 부여/해제. 부트스트랩용으로 첫 호출 시,
 * users 컬렉션에 admin 이 한 명도 없으면 호출자 본인을 admin 으로 만든다.
 */
export const setAdmin = onCall<{ targetUid?: string; admin?: boolean }>(
  callable,
  async (request) => {
    const uid = request.auth?.uid;
    requireAuth(uid);

    const adminListSnap = await db
      .collection("users")
      .where("isAdmin", "==", true)
      .limit(1)
      .get();
    const hasAdmin = !adminListSnap.empty;

    if (!hasAdmin) {
      // 부트스트랩: 첫 호출자가 admin
      await auth.setCustomUserClaims(uid, { admin: true });
      await db.collection("users").doc(uid).set(
        { isAdmin: true },
        { merge: true }
      );
      logger.warn("bootstrap admin granted", { uid });
      return { ok: true, bootstrapped: true };
    }

    // 이후엔 admin 만 다른 사람을 admin 으로 만들 수 있음
    await requireAdmin(uid);
    const target = request.data.targetUid;
    const make = request.data.admin ?? true;
    if (!target) {
      throw new HttpsError("invalid-argument", "targetUid 필요");
    }
    await auth.setCustomUserClaims(target, make ? { admin: true } : {});
    await db.collection("users").doc(target).set(
      { isAdmin: make },
      { merge: true }
    );
    return { ok: true, bootstrapped: false };
  }
);

/**
 * 시스템에 admin 이 한 명이라도 존재하는지 확인.
 * 클라이언트가 "Admin 받기" 부트스트랩 버튼을 숨길지 판단할 때 사용.
 */
export const getAdminStatus = onCall(callable, async () => {
  const snap = await db
    .collection("users")
    .where("isAdmin", "==", true)
    .limit(1)
    .get();
  return { hasAdmin: !snap.empty };
});

/**
 * 특정 팩이 현재 재고로 몇 팩이나 나올 수 있는지 추정.
 * 각 등급의 1팩당 기대 사용량(슬롯 가중치 정규화 합)으로 stock 을 나눠
 * 가장 작은 값(병목)을 반환. 정확한 LP 해는 아니고, 게임 UI 용 근사치.
 */
export const getPackAvailability = onCall<{ packId?: string }>(
  callable,
  async (request) => {
    const packId = request.data.packId;
    if (!packId || typeof packId !== "string") {
      throw new HttpsError("invalid-argument", "packId 가 필요합니다.");
    }

    const packSnap = await db.collection("packs").doc(packId).get();
    if (!packSnap.exists) {
      return { approxPacksRemaining: 0, totalStock: 0 };
    }
    const pack = { id: packSnap.id, ...packSnap.data() } as Pack;

    let allCards: Card[];
    if (pack.cardPool && pack.cardPool.length > 0) {
      const refs = pack.cardPool.map((id) => db.collection("cards").doc(id));
      const docs = await db.getAll(...refs);
      allCards = docs
        .filter((d) => d.exists)
        .map((d) => ({ id: d.id, ...d.data() }) as Card);
    } else {
      const snap = await db.collection("cards").where("isActive", "==", true).get();
      allCards = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Card);
    }

    const eligible = allCards.filter((c) => c.isActive);
    const stockByRarity = new Map<string, number>();
    for (const c of eligible) {
      const s = c.stock ?? 0;
      if (s <= 0) continue;
      stockByRarity.set(c.rarity, (stockByRarity.get(c.rarity) ?? 0) + s);
    }
    const totalStock = [...stockByRarity.values()].reduce((s, v) => s + v, 0);

    // 등급별 1팩당 기대 사용량
    const expectedPerPack = new Map<string, number>();
    for (const slot of pack.slots ?? []) {
      const entries = Object.entries(slot.rarityWeights ?? {}).filter(
        ([, w]) => typeof w === "number" && (w as number) > 0
      ) as [string, number][];
      const total = entries.reduce((s, [, w]) => s + w, 0);
      if (total <= 0) continue;
      for (const [r, w] of entries) {
        const share = w / total;
        expectedPerPack.set(r, (expectedPerPack.get(r) ?? 0) + share);
      }
    }

    // 병목 등급: stock / expected
    let bottleneck = Number.POSITIVE_INFINITY;
    for (const [r, exp] of expectedPerPack) {
      if (exp <= 0) continue;
      const have = stockByRarity.get(r) ?? 0;
      const can = have / exp;
      if (can < bottleneck) bottleneck = can;
    }

    const approxPacksRemaining =
      Number.isFinite(bottleneck) ? Math.floor(bottleneck) : 0;

    return { approxPacksRemaining, totalStock };
  }
);

/**
 * 활성 팩 목록 — 확률/풀 정보 없이 슬림 메타데이터 + 잔여 수량 추정치.
 * 누구나 호출 가능 (auth 불요).
 */
export const listActivePacks = onCall(callable, async () => {
  const [packSnap, cardSnap] = await Promise.all([
    db.collection("packs").where("isActive", "==", true).get(),
    db.collection("cards").where("isActive", "==", true).get(),
  ]);

  const allActiveCards = cardSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Card);

  return {
    packs: packSnap.docs.map((d) => {
      const p = { id: d.id, ...d.data() } as Pack;

      // 풀 적용
      let pool: Card[];
      if (p.cardPool && p.cardPool.length > 0) {
        const set = new Set(p.cardPool);
        pool = allActiveCards.filter((c) => set.has(c.id));
      } else {
        pool = allActiveCards;
      }

      // 등급별 stock 합
      const stockByRarity = new Map<string, number>();
      for (const c of pool) {
        const s = c.stock ?? 0;
        if (s <= 0) continue;
        stockByRarity.set(c.rarity, (stockByRarity.get(c.rarity) ?? 0) + s);
      }

      // 등급별 1팩당 기대 사용량
      const expectedPerPack = new Map<string, number>();
      for (const slot of p.slots ?? []) {
        const entries = Object.entries(slot.rarityWeights ?? {}).filter(
          ([, w]) => typeof w === "number" && (w as number) > 0
        ) as [string, number][];
        const totalW = entries.reduce((s, [, w]) => s + w, 0);
        if (totalW <= 0) continue;
        for (const [r, w] of entries) {
          expectedPerPack.set(r, (expectedPerPack.get(r) ?? 0) + w / totalW);
        }
      }

      let bottleneck = Number.POSITIVE_INFINITY;
      for (const [r, exp] of expectedPerPack) {
        if (exp <= 0) continue;
        const have = stockByRarity.get(r) ?? 0;
        const can = have / exp;
        if (can < bottleneck) bottleneck = can;
      }
      const approxPacksRemaining = Number.isFinite(bottleneck) ? Math.floor(bottleneck) : 0;

      return {
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl ?? "",
        cardBackImageUrl: p.cardBackImageUrl ?? "",
        cardCount: p.cardCount,
        price: p.price ?? 0,
        approxPacksRemaining,
      };
    }),
  };
});

/** 유저 재화 충전 (관리자 전용 — 테스트/이벤트용). */
export const grantCurrency = onCall<{ targetUid?: string; amount?: number }>(
  callable,
  async (request) => {
    const uid = request.auth?.uid;
    requireAuth(uid);
    await requireAdmin(uid);
    const target = request.data.targetUid;
    const amount = request.data.amount;
    if (!target || typeof amount !== "number") {
      throw new HttpsError("invalid-argument", "targetUid, amount 필요");
    }
    await db.collection("users").doc(target).set(
      { currency: FieldValue.increment(amount) },
      { merge: true }
    );
    return { ok: true };
  }
);

/**
 * 관리자가 특정 유저의 인벤토리 항목을 수정.
 * - mode: "set" → count 를 absolute 값으로 덮어쓰기 (0 이면 doc 삭제)
 * - mode: "add" → 기존 count 에 delta 만큼 더함 (음수 가능, 결과는 0 floor)
 */
export const adminEditInventory = onCall<{
  targetUid?: string;
  cardId?: string;
  mode?: "set" | "add";
  value?: number;
}>(callable, async (request) => {
  const uid = request.auth?.uid;
  requireAuth(uid);
  await requireAdmin(uid);
  const { targetUid, cardId, mode, value } = request.data;
  if (!targetUid || !cardId || !mode || typeof value !== "number") {
    throw new HttpsError(
      "invalid-argument",
      "targetUid, cardId, mode, value 필요"
    );
  }

  const invRef = db
    .collection("users")
    .doc(targetUid)
    .collection("inventory")
    .doc(cardId);

  await db.runTransaction(async (tx) => {
    const cur = await tx.get(invRef);
    const curCount = (cur.data()?.count as number | undefined) ?? 0;
    const next =
      mode === "set" ? Math.max(0, Math.floor(value)) : Math.max(0, curCount + Math.floor(value));

    if (next === 0) {
      if (cur.exists) tx.delete(invRef);
      return;
    }

    if (!cur.exists) {
      tx.set(invRef, {
        count: next,
        firstObtainedAt: FieldValue.serverTimestamp(),
        lastObtainedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(invRef, {
        count: next,
        lastObtainedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  logger.info("admin inventory edit", {
    actor: uid,
    targetUid,
    cardId,
    mode,
    value,
  });
  return { ok: true };
});

/**
 * 관리자가 유저 인벤토리 항목들을 일괄 제거.
 * - cardIds 가 비어있으면 (또는 undefined) 인벤토리 전체 삭제
 * - cardIds 가 있으면 해당 카드만 삭제
 */
export const adminClearInventory = onCall<{
  targetUid?: string;
  cardIds?: string[];
}>(callable, async (request) => {
  const uid = request.auth?.uid;
  requireAuth(uid);
  await requireAdmin(uid);
  const { targetUid, cardIds } = request.data;
  if (!targetUid) {
    throw new HttpsError("invalid-argument", "targetUid 필요");
  }

  const invCol = db.collection("users").doc(targetUid).collection("inventory");

  let removed = 0;
  if (!cardIds || cardIds.length === 0) {
    // 전체 삭제 — 페이지네이션으로 모두 비우기
    while (true) {
      const snap = await invCol.limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      removed += snap.size;
      if (snap.size < 400) break;
    }
  } else {
    // 선택 삭제
    for (let i = 0; i < cardIds.length; i += 400) {
      const chunk = cardIds.slice(i, i + 400);
      const batch = db.batch();
      for (const cardId of chunk) {
        batch.delete(invCol.doc(cardId));
      }
      await batch.commit();
      removed += chunk.length;
    }
  }

  logger.info("admin inventory clear", { actor: uid, targetUid, removed, all: !cardIds });
  return { ok: true, removed };
});
