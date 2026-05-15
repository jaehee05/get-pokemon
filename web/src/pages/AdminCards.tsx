import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  ALL_RARITIES,
  Card,
  RARITY_COLOR,
  RARITY_LABEL,
  Rarity,
} from "../types";

const blank: Omit<Card, "id"> = {
  name: "",
  imageUrl: "",
  rarity: "C",
  weight: 1,
  isActive: true,
};

export default function AdminCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [draft, setDraft] = useState<Omit<Card, "id">>(blank);

  useEffect(() => {
    return onSnapshot(collection(db, "cards"), (s) => {
      setCards(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Card));
    });
  }, []);

  async function create() {
    if (!draft.name) return;
    await addDoc(collection(db, "cards"), draft);
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
              style={{ minWidth: 280 }}
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
              <th>등급</th>
              <th>가중치</th>
              <th>활성</th>
              <th>ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" style={{ width: 40, height: 56, objectFit: "cover", borderRadius: 4 }} />
                  ) : <span className="muted">—</span>}
                </td>
                <td>
                  <input
                    value={c.name}
                    onChange={(e) => patch(c.id, "name", e.target.value)}
                  />
                </td>
                <td>
                  <select
                    value={c.rarity}
                    onChange={(e) => patch(c.id, "rarity", e.target.value)}
                    style={{ background: RARITY_COLOR[c.rarity], color: "#000" }}
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
                <td><code className="muted">{c.id.slice(0, 6)}</code></td>
                <td>
                  <button className="danger" onClick={() => remove(c.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
