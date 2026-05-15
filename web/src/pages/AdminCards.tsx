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
  Expansion,
  RARITY_COLOR,
  RARITY_LABEL,
  Rarity,
  formatCardNumber,
} from "../types";

const blank: Omit<Card, "id"> = {
  name: "",
  imageUrl: "",
  rarity: "C",
  weight: 1,
  isActive: true,
  expansionId: "",
  number: undefined,
};

export default function AdminCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [exps, setExps] = useState<Expansion[]>([]);
  const [draft, setDraft] = useState<Omit<Card, "id">>(blank);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "cards"), (s) => {
      setCards(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Card));
    });
    const unsub2 = onSnapshot(collection(db, "expansions"), (s) => {
      setExps(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Expansion));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const expById = useMemo(() => {
    const m = new Map<string, Expansion>();
    for (const e of exps) m.set(e.id, e);
    return m;
  }, [exps]);

  async function create() {
    if (!draft.name) return;
    const payload: Partial<Card> = { ...draft };
    if (!payload.expansionId) delete payload.expansionId;
    if (payload.number == null || Number.isNaN(payload.number)) delete payload.number;
    await addDoc(collection(db, "cards"), payload);
    setDraft(blank);
  }

  async function patch(id: string, field: keyof Card, value: unknown) {
    await updateDoc(doc(db, "cards", id), { [field]: value });
  }

  async function remove(id: string) {
    if (!confirm("이 카드를 삭제할까요?")) return;
    await deleteDoc(doc(db, "cards", id));
  }

  return (
    <div className="col">
      <div className="panel">
        <h2 className="h2">새 카드 추가</h2>
        {exps.length === 0 && (
          <p className="muted" style={{ fontSize: 12 }}>
            먼저 <code className="mini">확장팩</code> 에 하나 이상 등록해두면 카드에 연결할 수 있어요.
          </p>
        )}
        <div className="row">
          <label>
            이름
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            이미지 URL
            <input
              value={draft.imageUrl}
              onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
              style={{ minWidth: 240 }}
            />
          </label>
          <label>
            확장팩
            <select
              value={draft.expansionId ?? ""}
              onChange={(e) => setDraft({ ...draft, expansionId: e.target.value })}
            >
              <option value="">— 없음 —</option>
              {exps.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} {e.name ? `(${e.name})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            번호
            <input
              type="number"
              min={1}
              value={draft.number ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  number: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              style={{ width: 90 }}
              placeholder="1"
            />
          </label>
          <label>
            등급
            <select
              value={draft.rarity}
              onChange={(e) => setDraft({ ...draft, rarity: e.target.value as Rarity })}
            >
              {ALL_RARITIES.map((r) => (
                <option key={r} value={r}>{RARITY_LABEL[r]}</option>
              ))}
            </select>
          </label>
          <label>
            가중치
            <input
              type="number"
              min={0}
              step={1}
              value={draft.weight}
              onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })}
              style={{ width: 80 }}
            />
          </label>
          <label>
            활성
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            />
          </label>
          <button onClick={create}>추가</button>
        </div>
      </div>

      <div className="panel">
        <h2 className="h2">카드 목록 ({cards.length})</h2>
        <table>
          <thead>
            <tr>
              <th>이미지</th>
              <th>이름</th>
              <th>확장팩 / 번호</th>
              <th>등급</th>
              <th>가중치</th>
              <th>활성</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const exp = c.expansionId ? expById.get(c.expansionId) : undefined;
              const label = formatCardNumber(c, exp);
              return (
                <tr key={c.id}>
                  <td>
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt=""
                        style={{ width: 40, height: 56, objectFit: "cover", borderRadius: 4 }}
                      />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <input
                      value={c.name}
                      onChange={(e) => patch(c.id, "name", e.target.value)}
                    />
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <select
                        value={c.expansionId ?? ""}
                        onChange={(e) =>
                          patch(c.id, "expansionId", e.target.value || null)
                        }
                        style={{ width: 100 }}
                      >
                        <option value="">—</option>
                        {exps.map((e) => (
                          <option key={e.id} value={e.id}>{e.code}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={c.number ?? ""}
                        onChange={(e) =>
                          patch(
                            c.id,
                            "number",
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                        style={{ width: 70 }}
                      />
                    </div>
                    {label && <code className="mini">{label}</code>}
                  </td>
                  <td>
                    <select
                      value={c.rarity}
                      onChange={(e) => patch(c.id, "rarity", e.target.value)}
                      style={{ background: RARITY_COLOR[c.rarity], color: "#000", fontWeight: 700 }}
                    >
                      {ALL_RARITIES.map((r) => (
                        <option key={r} value={r}>{RARITY_LABEL[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={c.weight}
                      onChange={(e) => patch(c.id, "weight", Number(e.target.value))}
                      style={{ width: 70 }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={c.isActive}
                      onChange={(e) => patch(c.id, "isActive", e.target.checked)}
                    />
                  </td>
                  <td>
                    <button className="danger" onClick={() => remove(c.id)}>삭제</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
