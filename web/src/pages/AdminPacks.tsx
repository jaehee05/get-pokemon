import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { SafeImage } from "../SafeImage";
import { db } from "../firebase";
import {
  ALL_RARITIES,
  Card,
  Expansion,
  Pack,
  RARITY_CODE,
  RARITY_COLOR,
  RARITY_LABEL,
  Rarity,
  SlotConfig,
  formatCardNumber,
} from "../types";

/** 이전 등급 체계 → 새 코드. 기존 팩의 슬롯 가중치 호환용. */
const LEGACY_RARITY_MAP: Record<string, Rarity> = {
  common: "C",
  uncommon: "U",
  rare: "R",
  super_rare: "SR",
  secret_rare: "SAR",
};

const RARITY_SET: ReadonlySet<string> = new Set(ALL_RARITIES);

/** 슬롯 하나의 가중치를 마이그레이션 — 이전 키는 새 키로 옮기고, 알 수 없는 키는 버림. */
function migrateSlot(s: SlotConfig): SlotConfig {
  const out: SlotConfig["rarityWeights"] = {};
  for (const [k, v] of Object.entries(s.rarityWeights ?? {})) {
    if (typeof v !== "number") continue;
    if (RARITY_SET.has(k)) {
      out[k as Rarity] = (out[k as Rarity] ?? 0) + v;
    } else if (LEGACY_RARITY_MAP[k]) {
      const nk = LEGACY_RARITY_MAP[k];
      out[nk] = (out[nk] ?? 0) + v;
    }
    // 그 외는 drop
  }
  return { rarityWeights: out };
}

function migrateSlots(slots: SlotConfig[]): SlotConfig[] {
  return slots.map(migrateSlot);
}

/** 한 슬롯이라도 이전 키가 있으면 true. */
function hasLegacyKeys(slots: SlotConfig[]): boolean {
  return slots.some((s) =>
    Object.keys(s.rarityWeights ?? {}).some(
      (k) => !RARITY_SET.has(k) && LEGACY_RARITY_MAP[k]
    )
  );
}

function defaultSlots(n: number): SlotConfig[] {
  // TCG Pocket 풍 기본값: 앞 슬롯은 C, 마지막 1~2개가 Hit
  return Array.from({ length: n }, (_, i) => {
    if (i < Math.max(0, n - 2)) return { rarityWeights: { C: 100 } };
    if (i === n - 2) return { rarityWeights: { U: 85, R: 15 } };
    return {
      rarityWeights: {
        R: 40, RR: 25, SR: 12, AR: 10, SAR: 6,
        UR: 3, ACE: 2, S: 1, SSR: 0.5, BWR: 0.3, MUR: 0.15, MA: 0.05,
      },
    };
  });
}

export default function AdminPacks() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [exps, setExps] = useState<Expansion[]>([]);
  const [editing, setEditing] = useState<Pack | null>(null);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "packs"), (s) =>
      setPacks(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Pack))
    );
    const unsub2 = onSnapshot(collection(db, "cards"), (s) =>
      setCards(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Card))
    );
    const unsub3 = onSnapshot(collection(db, "expansions"), (s) =>
      setExps(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Expansion))
    );
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  async function create() {
    const blank: Omit<Pack, "id"> = {
      name: "새 팩",
      imageUrl: "",
      cardCount: 5,
      slots: defaultSlots(5),
      cardPool: [],
      price: 0,
      isActive: false,
    };
    await addDoc(collection(db, "packs"), blank);
  }

  async function remove(id: string) {
    if (!confirm("이 팩을 삭제할까요?")) return;
    await deleteDoc(doc(db, "packs", id));
  }

  return (
    <div className="col">
      <div className="row">
        <button onClick={create}>+ 새 팩 만들기</button>
      </div>
      <div className="grid packs">
        {packs.map((p) => (
          <div key={p.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="name">{p.name}</div>
              <span className={p.isActive ? "muted" : ""} style={{ color: p.isActive ? "var(--ok)" : "var(--muted)" }}>
                {p.isActive ? "활성" : "비활성"}
              </span>
            </div>
            <div className="muted">
              {p.cardCount}장 · 가격 {p.price ?? 0} · pool {p.cardPool?.length ?? 0}
            </div>
            <div className="row">
              <button className="secondary" onClick={() => setEditing(p)}>편집</button>
              <button className="danger" onClick={() => remove(p.id)}>삭제</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <PackEditor
          pack={editing}
          allCards={cards}
          exps={exps}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await updateDoc(doc(db, "packs", editing.id), patch);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PackEditor({
  pack,
  allCards,
  exps,
  onSave,
  onClose,
}: {
  pack: Pack;
  allCards: Card[];
  exps: Expansion[];
  onSave: (patch: Partial<Pack>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(pack.name);
  const [imageUrl, setImageUrl] = useState(pack.imageUrl ?? "");
  const [cardBackImageUrl, setCardBackImageUrl] = useState(pack.cardBackImageUrl ?? "");
  const [cardCount, setCardCount] = useState(pack.cardCount);
  const [price, setPrice] = useState(pack.price ?? 0);
  const [isActive, setIsActive] = useState(pack.isActive);
  const initialSlots =
    pack.slots?.length === pack.cardCount ? pack.slots : defaultSlots(pack.cardCount);
  const legacyDetected = hasLegacyKeys(initialSlots);
  const [slots, setSlots] = useState<SlotConfig[]>(
    legacyDetected ? migrateSlots(initialSlots) : initialSlots
  );
  const [pool, setPool] = useState<string[]>(pack.cardPool ?? []);
  // 카드풀 필터: 확장팩 + 등급
  const [poolExpFilter, setPoolExpFilter] = useState<string>(""); // "" = 전체, "none" = 확장팩 없음
  const [poolRarityFilter, setPoolRarityFilter] = useState<Set<Rarity>>(
    () => new Set(ALL_RARITIES)
  );

  const expById = useMemo(() => {
    const m = new Map<string, Expansion>();
    for (const e of exps) m.set(e.id, e);
    return m;
  }, [exps]);

  const visibleCards = useMemo(() => {
    return allCards
      .filter((c) => {
        if (poolExpFilter === "") return true;
        if (poolExpFilter === "none") return !c.expansionId;
        return c.expansionId === poolExpFilter;
      })
      .filter((c) => poolRarityFilter.has(c.rarity))
      .sort((a, b) => {
        const ea = a.expansionId ? expById.get(a.expansionId)?.code ?? "" : "";
        const eb = b.expansionId ? expById.get(b.expansionId)?.code ?? "" : "";
        if (ea !== eb) return ea.localeCompare(eb);
        return (a.number ?? 0) - (b.number ?? 0);
      });
  }, [allCards, poolExpFilter, poolRarityFilter, expById]);

  function togglePoolRarity(r: Rarity) {
    setPoolRarityFilter((cur) => {
      const next = new Set(cur);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  function selectAllVisible() {
    const visibleIds = new Set(visibleCards.map((c) => c.id));
    setPool((cur) => Array.from(new Set([...cur, ...visibleIds])));
  }
  function deselectAllVisible() {
    const visibleIds = new Set(visibleCards.map((c) => c.id));
    setPool((cur) => cur.filter((id) => !visibleIds.has(id)));
  }

  const visibleSelectedCount = visibleCards.filter((c) => pool.includes(c.id)).length;

  // cardCount 바뀌면 slots 길이 동기화
  function changeCardCount(n: number) {
    setCardCount(n);
    setSlots((cur) => {
      if (cur.length === n) return cur;
      if (cur.length < n) {
        return [...cur, ...defaultSlots(n).slice(cur.length)];
      }
      return cur.slice(0, n);
    });
  }

  function setSlotWeight(slotIdx: number, rarity: Rarity, val: number) {
    setSlots((cur) =>
      cur.map((s, i) =>
        i === slotIdx
          ? {
              ...s,
              rarityWeights: { ...s.rarityWeights, [rarity]: val },
            }
          : s
      )
    );
  }

  function togglePool(id: string) {
    setPool((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  // 슬롯별 확률 미리보기 (합산 → %)
  const previews = useMemo(
    () =>
      slots.map((s) => {
        const total = ALL_RARITIES.reduce(
          (sum, r) => sum + (s.rarityWeights[r] ?? 0),
          0
        );
        return { total };
      }),
    [slots]
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{ width: "min(900px, 100%)", maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="h2">팩 편집</h2>
        {legacyDetected && (
          <div
            style={{
              background: "rgba(255,203,5,0.12)",
              border: "1px solid rgba(255,203,5,0.4)",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            ⚠️ 이전 등급 체계가 감지되어 자동 변환했습니다
            (common→C, uncommon→U, rare→R, super_rare→SR, secret_rare→SAR).
            <b> 저장</b>을 눌러야 영구 반영됩니다.
          </div>
        )}
        <div className="row">
          <label>이름 <input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>
            팩 이미지 URL
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={{ minWidth: 240 }} />
          </label>
          <label>
            카드 장수
            <input
              type="number"
              min={1}
              max={10}
              value={cardCount}
              onChange={(e) => changeCardCount(Number(e.target.value))}
              style={{ width: 70 }}
            />
          </label>
          <label>
            가격
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </label>
          <label>
            활성
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
          </label>
        </div>
        <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
          <label style={{ flex: 1 }}>
            카드 뒷면 이미지 URL
            <input
              value={cardBackImageUrl}
              onChange={(e) => setCardBackImageUrl(e.target.value)}
              placeholder="개봉할 때 모든 카드의 뒷면으로 표시됩니다. 비우면 기본 디자인."
            />
          </label>
          {cardBackImageUrl && (
            <img
              src={cardBackImageUrl}
              alt="뒷면 미리보기"
              style={{
                width: 50,
                height: 70,
                objectFit: "cover",
                borderRadius: 6,
                border: "1px solid var(--border-strong)",
              }}
            />
          )}
        </div>

        <h2 className="h2">슬롯별 등급 가중치</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          각 슬롯에서 어떤 등급이 나올지 가중치로 지정. 합산은 자동, 비율만 맞으면 됩니다.
          (예: 5번째 슬롯 SR 25, SCR 5 → 슬롯 안에서 SR 25/30 ≈ 83.3%, SCR 5/30 ≈ 16.7%)
        </p>

        <div className="slot-grid-wrap">
          <div className="slot-config">
            <div className="label">슬롯</div>
            {ALL_RARITIES.map((r) => (
              <div
                key={r}
                className="label"
                style={{ color: RARITY_COLOR[r], fontWeight: 700, textAlign: "center" }}
                title={RARITY_LABEL[r]}
              >
                {RARITY_CODE[r]}
              </div>
            ))}
          </div>
          {slots.map((s, i) => (
            <div key={i} className="slot-config">
              <div className="label">#{i + 1}{previews[i].total === 0 ? " ⚠️" : ""}</div>
              {ALL_RARITIES.map((r) => (
                <input
                  key={r}
                  type="number"
                  min={0}
                  step={0.05}
                  value={s.rarityWeights[r] ?? 0}
                  onChange={(e) => setSlotWeight(i, r, Number(e.target.value))}
                />
              ))}
            </div>
          ))}
        </div>

        <h2 className="h2">카드 풀</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          체크된 카드만 이 팩에서 등장 가능. 모두 해제하면 전체 활성 카드가 풀이 됩니다.
          <br />
          현재 풀에 <b style={{ color: "var(--text)" }}>{pool.length}</b>장 등록됨.
        </p>

        <div className="row" style={{ marginBottom: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label>
            확장팩 필터
            <select
              value={poolExpFilter}
              onChange={(e) => setPoolExpFilter(e.target.value)}
              style={{ minWidth: 180 }}
            >
              <option value="">전체</option>
              <option value="none">— 확장팩 없음</option>
              {exps.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} {e.name ? `(${e.name})` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="col" style={{ gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>등급 필터</span>
            <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
              {ALL_RARITIES.map((r) => {
                const on = poolRarityFilter.has(r);
                return (
                  <button
                    type="button"
                    key={r}
                    className={on ? "" : "secondary"}
                    onClick={() => togglePoolRarity(r)}
                    style={{
                      fontSize: 10,
                      padding: "3px 7px",
                      background: on ? RARITY_COLOR[r] : undefined,
                      color: on ? "#0a0d14" : undefined,
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="row" style={{ marginBottom: 8, fontSize: 13 }}>
          <span>
            필터된 카드 <b>{visibleCards.length}</b>장
            {visibleCards.length > 0 && (
              <> · 그 중 풀에 포함 <b>{visibleSelectedCount}</b></>
            )}
          </span>
          <button type="button" className="secondary" onClick={selectAllVisible} disabled={visibleCards.length === 0}>
            필터 전체 선택
          </button>
          <button
            type="button"
            className="secondary"
            onClick={deselectAllVisible}
            disabled={visibleSelectedCount === 0}
          >
            필터 전체 해제
          </button>
        </div>

        <div className="grid cards">
          {visibleCards.map((c) => {
            const on = pool.includes(c.id);
            const exp = c.expansionId ? expById.get(c.expansionId) : undefined;
            const label = formatCardNumber(c, exp);
            return (
              <label key={c.id} className="card" style={{ outline: on ? `2px solid ${RARITY_COLOR[c.rarity]}` : "none" }}>
                <div className="thumb">
                  <SafeImage
                    src={c.imageUrl}
                    alt=""
                    fallback={<span className="muted">—</span>}
                  />
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="name" style={{ fontSize: 12 }}>{c.name}</div>
                  <input type="checkbox" checked={on} onChange={() => togglePool(c.id)} />
                </div>
                <div className="row" style={{ justifyContent: "space-between", gap: 4 }}>
                  <span className="rarity-pill" style={{ background: RARITY_COLOR[c.rarity], fontSize: 10 }}>
                    {RARITY_LABEL[c.rarity]}
                  </span>
                  {label && <code className="mini">{label}</code>}
                </div>
              </label>
            );
          })}
          {visibleCards.length === 0 && (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              필터 조건에 맞는 카드가 없습니다.
            </div>
          )}
        </div>

        <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="secondary" onClick={onClose}>취소</button>
          <button
            onClick={() =>
              onSave({
                name,
                imageUrl,
                cardBackImageUrl,
                cardCount,
                price,
                isActive,
                slots,
                cardPool: pool,
              })
            }
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
