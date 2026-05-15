import { Card, Pack, Rarity } from "./types";

export type Rng = () => number;

/** [0,1) 균등 난수. Math.random 보다 약간 더 균등한 crypto 기반. */
export function defaultRng(): number {
  // Node 20 has globalThis.crypto
  const arr = new Uint32Array(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto.getRandomValues(arr);
  return arr[0] / 0x100000000;
}

/** 가중치 맵에서 키 하나를 가중 무작위 선택. */
export function weightedPickKey<K extends string>(
  weights: Partial<Record<K, number>>,
  rng: Rng = defaultRng
): K {
  const entries = (Object.entries(weights) as [K, number | undefined][])
    .filter(([, w]) => (w ?? 0) > 0)
    .map(([k, w]) => [k, w as number] as const);
  if (entries.length === 0) {
    throw new Error("weightedPickKey: empty or all-zero weights");
  }
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r < 0) return k;
  }
  return entries[entries.length - 1][0];
}

/** 항목 배열에서 가중치로 하나 선택. */
export function weightedPickItem<T>(
  items: T[],
  weightOf: (t: T) => number,
  rng: Rng = defaultRng
): T {
  if (items.length === 0) {
    throw new Error("weightedPickItem: empty pool");
  }
  const weights = items.map(weightOf).map((w) => (w > 0 ? w : 0));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) {
    // 전부 0이면 균등 추첨
    return items[Math.floor(rng() * items.length)];
  }
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

export interface OpenPackResult {
  cards: Card[];
  /** 각 슬롯에서 어떤 rarity가 뽑혔는지 (감사용). */
  rarities: Rarity[];
}

/**
 * 한 팩 오픈. 슬롯마다:
 *   1) rarityWeights 로 등급을 가중 추첨
 *   2) 그 등급의 cardPool 에서 card.weight 로 카드를 가중 추첨
 */
export function openPack(
  pack: Pack,
  allCards: Card[],
  rng: Rng = defaultRng
): OpenPackResult {
  if (pack.slots.length !== pack.cardCount) {
    throw new Error(
      `pack ${pack.id}: slots.length (${pack.slots.length}) != cardCount (${pack.cardCount})`
    );
  }

  const poolIds =
    pack.cardPool.length > 0 ? new Set(pack.cardPool) : null;
  const eligible = allCards.filter(
    (c) =>
      c.isActive &&
      (c.stock ?? 0) > 0 &&
      (poolIds === null || poolIds.has(c.id))
  );

  // 같은 팩 안에서 동일 카드의 재고가 1인데 두 슬롯에서 뽑히는 걸 방지하기 위해
  // 로컬 stock 카운터를 두고 뽑힐 때마다 1 차감 → 후속 슬롯은 잔여만 보이게.
  const localStock = new Map<string, number>();
  for (const c of eligible) localStock.set(c.id, c.stock ?? 0);

  const cards: Card[] = [];
  const rarities: Rarity[] = [];

  for (let i = 0; i < pack.slots.length; i++) {
    const slot = pack.slots[i];
    const rarity = weightedPickKey<Rarity>(slot.rarityWeights, rng);
    const candidates = eligible.filter(
      (c) => c.rarity === rarity && (localStock.get(c.id) ?? 0) > 0
    );
    if (candidates.length === 0) {
      throw new Error(
        `pack ${pack.id} slot ${i}: 등급 "${rarity}" 뽑혔지만 재고 가능한 카드 없음`
      );
    }
    const card = weightedPickItem(candidates, (c) => c.weight, rng);
    localStock.set(card.id, (localStock.get(card.id) ?? 0) - 1);
    cards.push(card);
    rarities.push(rarity);
  }

  return { cards, rarities };
}
