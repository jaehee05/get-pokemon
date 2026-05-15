import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger, setGlobalOptions } from "firebase-functions/v2";
import { openPack as runGacha } from "./gacha";
import { Card, Pack } from "./types";

initializeApp();
setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

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

/**
 * 팩 열기 — 서버사이드 추첨.
 * 입력: { packId: string }
 * 출력: { cards: Card[], pullId: string, currencyAfter: number }
 */
export const openPack = onCall<{ packId?: string }>(async (request) => {
  const uid = request.auth?.uid;
  requireAuth(uid);

  const packId = request.data.packId;
  if (!packId || typeof packId !== "string") {
    throw new HttpsError("invalid-argument", "packId 가 필요합니다.");
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

  const result = runGacha(pack, allCards);

  // 트랜잭션: 재화 차감 + 인벤토리 갱신 + 뽑기 기록
  const pullRef = db.collection("pulls").doc();
  const userRef = db.collection("users").doc(uid);

  // 같은 카드 중복 뽑힐 수 있으므로 카운트 합산
  const countByCard = new Map<string, number>();
  for (const c of result.cards) {
    countByCard.set(c.id, (countByCard.get(c.id) ?? 0) + 1);
  }
  const inventoryRefs = Array.from(countByCard.keys()).map((cardId) => ({
    cardId,
    ref: userRef.collection("inventory").doc(cardId),
  }));

  const currencyAfter = await db.runTransaction(async (tx) => {
    // === reads first ===
    const userDoc = await tx.get(userRef);
    const invDocs = await Promise.all(inventoryRefs.map(({ ref }) => tx.get(ref)));

    const currency = (userDoc.data()?.currency as number | undefined) ?? 0;
    if (pack.price > 0 && currency < pack.price) {
      throw new HttpsError("failed-precondition", "재화가 부족합니다.");
    }
    const next = currency - (pack.price ?? 0);

    // === writes ===
    if (!userDoc.exists) {
      tx.set(userRef, {
        displayName: request.auth?.token.name ?? "Trainer",
        currency: next,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else if (pack.price > 0) {
      tx.update(userRef, { currency: next });
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

    tx.set(pullRef, {
      uid,
      packId: pack.id,
      resultCardIds: result.cards.map((c) => c.id),
      rarities: result.rarities,
      createdAt: FieldValue.serverTimestamp(),
    });

    return next;
  });

  logger.info("pack opened", {
    uid,
    packId,
    pullId: pullRef.id,
    rarities: result.rarities,
  });

  return {
    pullId: pullRef.id,
    cards: result.cards,
    rarities: result.rarities,
    currencyAfter,
  };
});

/**
 * 관리자 권한 부여/해제. 부트스트랩용으로 첫 호출 시,
 * users 컬렉션에 admin 이 한 명도 없으면 호출자 본인을 admin 으로 만든다.
 */
export const setAdmin = onCall<{ targetUid?: string; admin?: boolean }>(
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
 * 활성 팩 목록 — 확률/풀 정보 없이 슬림 메타데이터만 반환.
 * 누구나 호출 가능 (auth 불요).
 */
export const listActivePacks = onCall(async () => {
  const snap = await db
    .collection("packs")
    .where("isActive", "==", true)
    .get();
  return {
    packs: snap.docs.map((d) => {
      const p = d.data();
      return {
        id: d.id,
        name: p.name as string,
        imageUrl: (p.imageUrl as string | undefined) ?? "",
        cardCount: p.cardCount as number,
        price: (p.price as number | undefined) ?? 0,
      };
    }),
  };
});

/** 유저 재화 충전 (관리자 전용 — 테스트/이벤트용). */
export const grantCurrency = onCall<{ targetUid?: string; amount?: number }>(
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
