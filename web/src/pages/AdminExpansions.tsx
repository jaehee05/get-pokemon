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
import { Expansion } from "../types";

const blank: Omit<Expansion, "id"> = {
  code: "",
  name: "",
  baseCardCount: 83,
  isActive: true,
};

export default function AdminExpansions() {
  const [exps, setExps] = useState<Expansion[]>([]);
  const [draft, setDraft] = useState<Omit<Expansion, "id">>(blank);

  useEffect(() => {
    return onSnapshot(collection(db, "expansions"), (s) => {
      setExps(
        s.docs.map((d) => ({ id: d.id, ...d.data() }) as Expansion)
      );
    });
  }, []);

  async function create() {
    if (!draft.code) return;
    await addDoc(collection(db, "expansions"), draft);
    setDraft(blank);
  }

  async function patch(id: string, field: keyof Expansion, value: unknown) {
    await updateDoc(doc(db, "expansions", id), { [field]: value });
  }

  async function remove(id: string) {
    if (!confirm("이 확장팩을 삭제할까요? (이 확장팩으로 등록된 카드들은 expansionId 가 끊깁니다)"))
      return;
    await deleteDoc(doc(db, "expansions", id));
  }

  return (
    <div className="col">
      <div className="panel">
        <h2 className="h2">새 확장팩 추가</h2>
        <div className="row">
          <label>
            코드
            <input
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              placeholder="M4"
              style={{ width: 110 }}
            />
          </label>
          <label>
            이름 (선택)
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Mega Evolution Vol.4"
              style={{ minWidth: 240 }}
            />
          </label>
          <label>
            기본 카드 수 (분모)
            <input
              type="number"
              min={1}
              value={draft.baseCardCount}
              onChange={(e) =>
                setDraft({ ...draft, baseCardCount: Number(e.target.value) })
              }
              style={{ width: 120 }}
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
        <h2 className="h2">확장팩 목록 ({exps.length})</h2>
        <table>
          <thead>
            <tr>
              <th>코드</th>
              <th>이름</th>
              <th style={{ textAlign: "right" }}>기본 카드 수</th>
              <th>활성</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {exps.map((e) => (
              <tr key={e.id}>
                <td>
                  <input
                    value={e.code}
                    onChange={(ev) => patch(e.id, "code", ev.target.value)}
                    style={{ width: 90, fontWeight: 700 }}
                  />
                </td>
                <td>
                  <input
                    value={e.name}
                    onChange={(ev) => patch(e.id, "name", ev.target.value)}
                    style={{ minWidth: 220 }}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <input
                    type="number"
                    min={1}
                    value={e.baseCardCount}
                    onChange={(ev) =>
                      patch(e.id, "baseCardCount", Number(ev.target.value))
                    }
                    style={{ width: 80 }}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={e.isActive}
                    onChange={(ev) => patch(e.id, "isActive", ev.target.checked)}
                  />
                </td>
                <td>
                  <button className="danger" onClick={() => remove(e.id)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
