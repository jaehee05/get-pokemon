/**
 * 등급. 낮은 → 높은 순.
 * C, U, R, RR, SR, AR, SAR, UR, ACE, S, SSR, BWR, MUR, MA
 */
export type Rarity =
  | "C"
  | "U"
  | "R"
  | "RR"
  | "SR"
  | "AR"
  | "SAR"
  | "UR"
  | "ACE"
  | "S"
  | "SSR"
  | "BWR"
  | "MUR"
  | "MA";

export const ALL_RARITIES: Rarity[] = [
  "C", "U", "R", "RR", "SR", "AR", "SAR",
  "UR", "ACE", "S", "SSR", "BWR", "MUR", "MA",
];

export interface Expansion {
  id: string;
  code: string;
  name: string;
  baseCardCount: number;
  isActive: boolean;
}

export interface Card {
  id: string;
  name: string;
  imageUrl: string;
  rarity: Rarity;
  weight: number;
  isActive: boolean;
  expansionId?: string;
  number?: number;
  /** 남은 재고. 미정의/0 이면 가챠 후보에서 제외. 뽑힐 때마다 1씩 차감. */
  stock?: number;
}

export type RarityWeights = Partial<Record<Rarity, number>>;

export interface SlotConfig {
  rarityWeights: RarityWeights;
}

export interface Pack {
  id: string;
  name: string;
  imageUrl?: string;
  /** 개봉 시 카드 뒷면 이미지. */
  cardBackImageUrl?: string;
  cardCount: number;
  slots: SlotConfig[];
  cardPool: string[];
  price: number;
  isActive: boolean;
}
