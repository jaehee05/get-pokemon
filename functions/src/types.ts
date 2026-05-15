export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "super_rare"
  | "secret_rare";

export const ALL_RARITIES: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "super_rare",
  "secret_rare",
];

export interface Card {
  id: string;
  name: string;
  imageUrl: string;
  rarity: Rarity;
  /** 같은 등급 내에서의 가중치 (기본 1). 클수록 자주 등장. */
  weight: number;
  isActive: boolean;
}

/**
 * 한 슬롯에서 어떤 등급이 나올지에 대한 가중치.
 * 예: { common: 90, rare: 10 } → 9:1 비율로 common/rare.
 * 합이 100일 필요 없음 — 비율만 맞으면 됨.
 */
export type RarityWeights = Partial<Record<Rarity, number>>;

export interface SlotConfig {
  rarityWeights: RarityWeights;
}

export interface Pack {
  id: string;
  name: string;
  imageUrl?: string;
  /** 한 팩에 들어가는 카드 장수. slots.length 와 일치해야 함. */
  cardCount: number;
  /** 슬롯별 등급 확률. cardCount 개. */
  slots: SlotConfig[];
  /** 이 팩에서 등장 가능한 카드 ID 목록. 빈 배열이면 전체 카드. */
  cardPool: string[];
  price: number;
  isActive: boolean;
}
