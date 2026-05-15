import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  ALL_RARITIES,
  Card,
  Pack,
  RARITY_COLOR,
  RARITY_LABEL,
  Rarity,
  SlotConfig,
} from "../types";

function defaultSlots(n: number): SlotConfig[] {
  // TCG Pocket 풍 기본값: 앞 슬롯은 common, 마지막 1~2개가 Hit
  return Array.from({ length: n }, (_, i) => {
    if (i < Math.max(0, n - 2)) return { rarityWeights: { common: 100 } };
    if (i === n - 2)
      return { rarityWeights: { uncommon: 90, rare: 10 } };
    return {
      rarityWeights: { rare: 70, super_rare: 25, secret_rare: 5 },
    };
  });
}

export default function AdminPacks() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [editing, setEditing] = useState<Pack | null>(null);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "packs"), (s) =>
      setPacks(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Pack))
    );
    const unsub2 = onSnapshot(collection(db, "cards"), (s) =>
      setCards(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Card))
    );
    return () => { unsub1(); unsub2(); };
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
  onSave,
  onClose,
}: {
  pack: Pack;
  allCards: Card[];
  onSave: (patch: Partial<Pack>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(pack.name);
  const [imageUrl, setImageUrl] = useState(pack.imageUrl ?? "");
  const [cardCount, setCardCount] = useState(pack.cardCount);
  const [price, setPrice] = useState(pack.price ?? 0);
  const [isActive, setIsActive] = useState(pack.isActive);
  const [slots, setSlots] = useState<SlotConfig[]>(
    pack.slots?.length === pack.cardCount ? pack.slots : defaultSlots(pack.cardCount)
  );
  const [pool, setPool] = useState<string[]>(pack.cardPool ?? []);

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
        <div className="row">
          <label>이름 <input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>
            이미지 URL
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

        <h2 className="h2">슬롯별 등급 가중치</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          각 슬롯에서 어떤 등급이 나올지 가중치로 지정. 합산은 자동, 비율만 맞으면 됩니다.
          (예: 5번째 슬롯 SR 25, SCR 5 → 슬롯 안에서 SR 25/30 ≈ 83.3%, SCR 5/30 ≈ 16.7%)
        </p>

        <div className="slot-config">
          <div className="label">슬롯</div>
          {ALL_RARITIES.map((r) => (
            <div key={r} className="label" style={{ color: RARITY_COLOR[r] }}>
              {RARITY_LABEL[r]}
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
                value={s.rarityWeights[r] ?? 0}
                onChange={(e) => setSlotWeight(i, r, Number(e.target.value))}
              />
            ))}
          </div>
        ))}

        <h2 className="h2">카드 풀</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          체크된 카드만 이 팩에서 등장 가능. 모두 해제하면 전체 활성 카드가 풀이 됩니다.
        </p>
        <div className="grid cards">
          {allCards.map((c) => {
            const on = pool.includes(c.id);
            return (
              <label key={c.id} className="card" style={{ outline: on ? `2px solid ${RARITY_COLOR[c.rarity]}` : "none" }}>
                <div className="thumb">
                  {c.imageUrl ? <img src={c.imageUrl} alt="" /> : <span className="muted">—</span>}
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="name">{c.name}</div>
                  <input type="checkbox" checked={on} onChange={() => togglePool(c.id)} />
                </div>
                <span className="rarity-pill" style={{ background: RARITY_COLOR[c.rarity] }}>
                  {RARITY_LABEL[c.rarity]}
                </span>
              </label>
            );
          })}
        </div>

        <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="secondary" onClick={onClose}>취소</button>
          <button
            onClick={() =>
              onSave({
                name,
                imageUrl,
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
