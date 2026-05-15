import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useMemo, useState } from "react";
import { db, functions } from "../firebase";
import {
  Card,
  Expansion,
  RARITY_COLOR,
  formatCardNumber,
} from "../types";

interface Row {
  cardId: string;
  count: number;
  card?: Card;
}

export function InventoryEditor({
  uid,
  displayName,
  onClose,
}: {
  uid: string;
  displayName: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [exps, setExps] = useState<Expansion[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [busyCard, setBusyCard] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [picked, setPicked] = useState<Card | null>(null);
  const [pickedAmount, setPickedAmount] = useState(1);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "expansions"), (s) =>
      setExps(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Expansion))
    );
    const u2 = onSnapshot(collection(db, "cards"), (s) =>
      setAllCards(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Card))
    );
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    const ref = collection(db, "users", uid, "inventory");
    return onSnapshot(ref, async (snap) => {
      const base: Row[] = snap.docs.map((d) => ({
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
  }, [uid]);

  const expById = useMemo(() => {
    const m = new Map<string, Expansion>();
    for (const e of exps) m.set(e.id, e);
    return m;
  }, [exps]);

  async function edit(cardId: string, mode: "set" | "add", value: number) {
    setBusyCard(cardId);
    try {
      await httpsCallable<
        { targetUid: string; cardId: string; mode: "set" | "add"; value: number },
        { ok: boolean }
      >(
        functions,
        "adminEditInventory"
      )({ targetUid: uid, cardId, mode, value });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyCard(null);
    }
  }

  const ownedCardIds = new Set(rows.map((r) => r.cardId));
  const pickerResults = useMemo(() => {
    if (!pickerQuery) return [];
    const q = pickerQuery.toLowerCase();
    return allCards
      .filter((c) => {
        if (ownedCardIds.has(c.id)) return false;
        const exp = c.expansionId ? expById.get(c.expansionId) : undefined;
        const label = formatCardNumber(c, exp).toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.rarity.toLowerCase() === q ||
          label.includes(q)
        );
      })
      .slice(0, 20);
  }, [pickerQuery, allCards, ownedCardIds, expById]);

  async function addPicked() {
    if (!picked) return;
    await edit(picked.id, "set", pickedAmount);
    setPicked(null);
    setPickerQuery("");
    setPickedAmount(1);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{ width: "min(900px, 100%)", maxHeight: "92vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h2 className="h2" style={{ margin: 0 }}>
            {displayName} 의 컬렉션
          </h2>
          <button className="secondary" onClick={onClose}>닫기</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          편집은 즉시 반영됩니다. 카드 재고와는 별개로 직접 부여/회수합니다.
        </p>

        <div className="panel" style={{ marginTop: 12 }}>
          <h2 className="h2" style={{ marginTop: 0 }}>카드 추가</h2>
          <div className="row">
            <input
              placeholder="이름 / 번호 (예: 003) / 등급 (R)"
              value={pickerQuery}
              onChange={(e) => { setPickerQuery(e.target.value); setPicked(null); }}
              style={{ flex: 1, minWidth: 240 }}
            />
            {picked && (
              <>
                <input
                  type="number"
                  min={1}
                  value={pickedAmount}
                  onChange={(e) => setPickedAmount(Math.max(1, Number(e.target.value)))}
                  style={{ width: 80 }}
                />
                <button onClick={addPicked} disabled={busyCard !== null}>
                  추가 ({picked.name} ×{pickedAmount})
                </button>
              </>
            )}
          </div>
          {pickerQuery && !picked && (
            <div style={{ marginTop: 8, maxHeight: 220, overflow: "auto" }}>
              <table>
                <tbody>
                  {pickerResults.map((c) => {
                    const exp = c.expansionId ? expById.get(c.expansionId) : undefined;
                    const label = formatCardNumber(c, exp);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setPicked(c)}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ width: 40 }}>
                          {c.imageUrl ? (
                            <img src={c.imageUrl} alt="" style={{ width: 28, height: 40, objectFit: "cover", borderRadius: 3 }} />
                          ) : <span className="muted">—</span>}
                        </td>
                        <td>{c.name}</td>
                        <td>
                          <span className="rarity-pill" style={{ background: RARITY_COLOR[c.rarity] }}>
                            {c.rarity}
                          </span>
                        </td>
                        <td><code className="mini">{label}</code></td>
                      </tr>
                    );
                  })}
                  {pickerResults.length === 0 && (
                    <tr><td className="muted" colSpan={4}>일치하는 카드 없음 (이미 보유 중이거나 카탈로그에 없음).</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel" style={{ marginTop: 12 }}>
          <h2 className="h2" style={{ marginTop: 0 }}>보유 카드 ({rows.length}종)</h2>
          {rows.length === 0 ? (
            <p className="muted">보유 카드 없음.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>이름</th>
                  <th>등급</th>
                  <th>번호</th>
                  <th style={{ textAlign: "right" }}>수량</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const exp = r.card?.expansionId ? expById.get(r.card.expansionId) : undefined;
                  const label = r.card ? formatCardNumber(r.card, exp) : "";
                  return (
                    <tr key={r.cardId}>
                      <td style={{ width: 40 }}>
                        {r.card?.imageUrl ? (
                          <img src={r.card.imageUrl} alt="" style={{ width: 28, height: 40, objectFit: "cover", borderRadius: 3 }} />
                        ) : <span className="muted">—</span>}
                      </td>
                      <td>{r.card?.name ?? <code className="mini">{r.cardId}</code>}</td>
                      <td>
                        {r.card && (
                          <span className="rarity-pill" style={{ background: RARITY_COLOR[r.card.rarity] }}>
                            {r.card.rarity}
                          </span>
                        )}
                      </td>
                      <td><code className="mini">{label}</code></td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="number"
                          min={0}
                          value={r.count}
                          onChange={(e) => edit(r.cardId, "set", Math.max(0, Number(e.target.value)))}
                          style={{ width: 80, textAlign: "right" }}
                          disabled={busyCard === r.cardId}
                        />
                      </td>
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <button
                            className="secondary"
                            onClick={() => edit(r.cardId, "add", 1)}
                            disabled={busyCard === r.cardId}
                            style={{ fontSize: 11, padding: "3px 7px" }}
                          >
                            +1
                          </button>
                          <button
                            className="secondary"
                            onClick={() => edit(r.cardId, "add", -1)}
                            disabled={busyCard === r.cardId}
                            style={{ fontSize: 11, padding: "3px 7px" }}
                          >
                            −1
                          </button>
                          <button
                            className="danger"
                            onClick={() => {
                              if (confirm(`${r.card?.name ?? r.cardId} 을(를) 컬렉션에서 제거할까요?`))
                                edit(r.cardId, "set", 0);
                            }}
                            disabled={busyCard === r.cardId}
                            style={{ fontSize: 11, padding: "3px 7px" }}
                          >
                            제거
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
