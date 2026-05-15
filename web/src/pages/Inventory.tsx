import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth";
import { db } from "../firebase";
import {
  Card,
  Expansion,
  RARITY_COLOR,
  RARITY_LABEL,
  formatCardNumber,
} from "../types";

interface InvRow {
  cardId: string;
  count: number;
  card?: Card;
}

export default function Inventory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InvRow[]>([]);
  const [exps, setExps] = useState<Expansion[]>([]);

  useEffect(() => {
    return onSnapshot(collection(db, "expansions"), (s) =>
      setExps(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Expansion))
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = collection(db, "users", user.uid, "inventory");
    return onSnapshot(ref, async (snap) => {
      const base: InvRow[] = snap.docs.map((d) => ({
        cardId: d.id,
        count: (d.data().count as number) ?? 0,
      }));
      const filled = await Promise.all(
        base.map(async (r) => {
          const c = await getDoc(doc(db, "cards", r.cardId));
          return { ...r, card: c.exists() ? ({ id: c.id, ...c.data() } as Card) : undefined };
        })
      );
      setRows(filled);
    });
  }, [user]);

  const expById = useMemo(() => {
    const m = new Map<string, Expansion>();
    for (const e of exps) m.set(e.id, e);
    return m;
  }, [exps]);

  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div>
      <h1 className="h1">내 컬렉션</h1>
      <p className="muted">
        보유 종류 {rows.length} · 총 {total}장
      </p>
      {rows.length === 0 ? (
        <div className="empty">
          <div className="icon">🃏</div>
          아직 카드가 없습니다. 팩을 열어보세요.
        </div>
      ) : (
        <div className="grid cards">
          {rows.map((r) => {
            if (!r.card) return null;
            const exp = r.card.expansionId ? expById.get(r.card.expansionId) : undefined;
            const label = formatCardNumber(r.card, exp);
            return (
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
                <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
                  <span
                    className="rarity-pill"
                    style={{ background: RARITY_COLOR[r.card.rarity] }}
                  >
                    {RARITY_LABEL[r.card.rarity]}
                  </span>
                  {label && <code className="mini">{label}</code>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
