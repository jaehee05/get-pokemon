import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { db } from "../firebase";
import { Card, RARITY_COLOR, RARITY_LABEL } from "../types";

interface InvRow {
  cardId: string;
  count: number;
  card?: Card;
}

export default function Inventory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InvRow[]>([]);

  useEffect(() => {
    if (!user) return;
    const ref = collection(db, "users", user.uid, "inventory");
    return onSnapshot(ref, async (snap) => {
      const base: InvRow[] = snap.docs.map((d) => ({
        cardId: d.id,
        count: (d.data().count as number) ?? 0,
      }));
      // 카드 정보 채워넣기 (간단히 개별 fetch — 카드 수 많아지면 캐시/일괄로 개선)
      const filled = await Promise.all(
        base.map(async (r) => {
          const c = await getDoc(doc(db, "cards", r.cardId));
          return { ...r, card: c.exists() ? ({ id: c.id, ...c.data() } as Card) : undefined };
        })
      );
      setRows(filled);
    });
  }, [user]);

  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div>
      <h1 className="h1">내 컬렉션</h1>
      <p className="muted">
        보유 종류 {rows.length} · 총 {total}장
      </p>
      {rows.length === 0 ? (
        <p className="muted">아직 카드가 없습니다. 팩을 열어보세요.</p>
      ) : (
        <div className="grid cards">
          {rows.map((r) =>
            r.card ? (
              <div key={r.cardId} className="card">
                <div className="thumb">
                  {r.card.imageUrl ? (
                    <img src={r.card.imageUrl} alt={r.card.name} />
                  ) : (
                    <span className="muted">No image</span>
                  )}
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="name">{r.card.name}</div>
                  <div className="muted">×{r.count}</div>
                </div>
                <span
                  className="rarity-pill"
                  style={{ background: RARITY_COLOR[r.card.rarity] }}
                >
                  {RARITY_LABEL[r.card.rarity]}
                </span>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
