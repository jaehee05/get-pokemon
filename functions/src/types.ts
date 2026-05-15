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
}

export type RarityWeights = Partial<Record<Rarity, number>>;

export interface SlotConfig {
  rarityWeights: RarityWeights;
}

export interface Pack {
  id: string;
  name: string;
  imageUrl?: string;
  cardCount: number;
  slots: SlotConfig[];
  cardPool: string[];
  price: number;
  isActive: boolean;
}
