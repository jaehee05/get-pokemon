import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { ALL_RARITIES, Expansion, RARITY_COLOR, Rarity } from "../types";

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
      setExps(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Expansion));
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
    if (!confirm("이 확장팩을 삭제할까요? (소속 카드들의 expansionId 가 끊깁니다)"))
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
                  <button className="danger" onClick={() => remove(e.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BulkImport exps={exps} />
      <BulkImageImport exps={exps} />
    </div>
  );
}

/* ---------- Bulk import ---------- */

interface ParsedRow {
  raw: string;
  num: number | null;
  name: string;
  rarity: string;
  valid: boolean;
  reason?: string;
}

const RARITY_SET: ReadonlySet<string> = new Set(ALL_RARITIES);

function parseBulk(text: string): ParsedRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map<ParsedRow>((line) => {
      const tokens = line.split(/\s+/);
      if (tokens.length < 3) {
        return { raw: line, num: null, name: "", rarity: "", valid: false, reason: "필드 부족 (번호 / 이름 / 등급 필요)" };
      }
      const numToken = tokens[0];
      const rarityToken = tokens[tokens.length - 1];
      const name = tokens.slice(1, -1).join(" ");
      const numStr = numToken.split("/")[0];
      const num = Number.parseInt(numStr, 10);
      if (!Number.isFinite(num)) {
        return { raw: line, num: null, name, rarity: rarityToken, valid: false, reason: `번호 파싱 실패: ${numToken}` };
      }
      if (!RARITY_SET.has(rarityToken)) {
        return { raw: line, num, name, rarity: rarityToken, valid: false, reason: `알 수 없는 등급: ${rarityToken}` };
      }
      return { raw: line, num, name, rarity: rarityToken, valid: true };
    });
}

function BulkImport({ exps }: { exps: Expansion[] }) {
  const [expansionId, setExpansionId] = useState<string>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{
    created: number; updated: number; skipped: number;
  } | null>(null);

  const parsed = useMemo(() => parseBulk(text), [text]);
  const valid = parsed.filter((r) => r.valid);
  const invalid = parsed.filter((r) => !r.valid);

  async function submit() {
    if (!expansionId) return;
    if (valid.length === 0) return;
    setBusy(true);
    setReport(null);
    try {
      const existingSnap = await getDocs(
        query(collection(db, "cards"), where("expansionId", "==", expansionId))
      );
      const byNumber = new Map<number, string>();
      existingSnap.forEach((d) => {
        const data = d.data() as { number?: unknown };
        if (typeof data.number === "number") byNumber.set(data.number, d.id);
      });

      // Firestore batch 한도 500 — 안전하게 청크.
      let created = 0, updated = 0;
      for (let i = 0; i < valid.length; i += 400) {
        const chunk = valid.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const row of chunk) {
          if (row.num == null) continue;
          const existingId = byNumber.get(row.num);
          if (existingId) {
            batch.update(doc(db, "cards", existingId), {
              name: row.name,
              rarity: row.rarity as Rarity,
              number: row.num,
              expansionId,
            });
            updated++;
          } else {
            const newRef = doc(collection(db, "cards"));
            batch.set(newRef, {
              name: row.name,
              rarity: row.rarity as Rarity,
              number: row.num,
              expansionId,
              imageUrl: "",
              weight: 1,
              isActive: true,
              stock: 0, // 카탈로그 등록 직후엔 재고 없음 → 관리자가 별도로 재고 설정
            });
            created++;
          }
        }
        await batch.commit();
      }
      setReport({ created, updated, skipped: invalid.length });
      setText("");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="h2">벌크 등록 (확장팩 카드 리스트)</h2>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        한 줄에 <code className="mini">번호 이름 등급</code> 순. 번호는 <code className="mini">001/083</code> 또는 <code className="mini">1</code> 둘 다 OK.
        구분자는 탭 또는 공백. 같은 번호가 이미 있으면 덮어쓰기 (이미지/가중치/활성 상태는 유지).
      </p>
      <div className="row" style={{ marginBottom: 10 }}>
        <label>
          대상 확장팩
          <select
            value={expansionId}
            onChange={(e) => setExpansionId(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">— 선택 —</option>
            {exps.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} {e.name ? `(${e.name})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        rows={10}
        placeholder={"001/083\t뿔충이\tC\n002/083\t딱충이\tC\n003/083\t독침붕\tRR\n..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: "100%", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}
      />

      {parsed.length > 0 && (
        <div className="row" style={{ marginTop: 8, fontSize: 13 }}>
          <span>총 <b>{parsed.length}</b>행</span>
          <span style={{ color: "var(--ok)" }}>정상 {valid.length}</span>
          {invalid.length > 0 && (
            <span style={{ color: "var(--danger)" }}>오류 {invalid.length}</span>
          )}
        </div>
      )}

      {valid.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 220, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>번호</th>
                <th>이름</th>
                <th style={{ width: 80 }}>등급</th>
              </tr>
            </thead>
            <tbody>
              {valid.slice(0, 200).map((r, i) => (
                <tr key={i}>
                  <td><code className="mini">{String(r.num).padStart(3, "0")}</code></td>
                  <td>{r.name}</td>
                  <td>
                    <span
                      className="rarity-pill"
                      style={{ background: RARITY_COLOR[r.rarity as Rarity] }}
                    >
                      {r.rarity}
                    </span>
                  </td>
                </tr>
              ))}
              {valid.length > 200 && (
                <tr><td colSpan={3} className="muted">… {valid.length - 200}행 더</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {invalid.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 160, overflow: "auto" }}>
          <p className="muted" style={{ fontSize: 12, color: "var(--danger)" }}>
            처리 불가 {invalid.length}건:
          </p>
          <table>
            <tbody>
              {invalid.slice(0, 50).map((r, i) => (
                <tr key={i}>
                  <td style={{ color: "var(--danger)", fontSize: 12 }}>{r.reason}</td>
                  <td><code className="mini">{r.raw}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button
          onClick={submit}
          disabled={busy || !expansionId || valid.length === 0}
        >
          {busy ? "등록 중..." : `${valid.length}건 등록 / 업데이트`}
        </button>
        {report && (
          <span style={{ color: "var(--ok)", fontSize: 14 }}>
            ✔ 신규 {report.created} · 업데이트 {report.updated}
            {report.skipped > 0 ? ` · 건너뜀 ${report.skipped}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Bulk image URL import ---------- */

interface ImgRow {
  raw: string;
  num: number | null;
  url: string;
  valid: boolean;
  reason?: string;
}

function parseImageBulk(text: string): ImgRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map<ImgRow>((line) => {
      const tokens = line.split(/\s+/);
      if (tokens.length < 2) {
        return { raw: line, num: null, url: "", valid: false, reason: "필드 부족 (번호 URL)" };
      }
      const numStr = tokens[0].split("/")[0];
      const num = Number.parseInt(numStr, 10);
      const url = tokens.slice(1).join(" ");
      if (!Number.isFinite(num)) {
        return { raw: line, num: null, url, valid: false, reason: `번호 파싱 실패: ${tokens[0]}` };
      }
      if (!/^https?:\/\//i.test(url)) {
        return { raw: line, num, url, valid: false, reason: "URL 이 http(s):// 로 시작하지 않음" };
      }
      return { raw: line, num, url, valid: true };
    });
}

function BulkImageImport({ exps }: { exps: Expansion[] }) {
  const [expansionId, setExpansionId] = useState<string>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{
    updated: number; missing: number; skipped: number;
  } | null>(null);

  const parsed = useMemo(() => parseImageBulk(text), [text]);
  const valid = parsed.filter((r) => r.valid);
  const invalid = parsed.filter((r) => !r.valid);

  async function submit() {
    if (!expansionId || valid.length === 0) return;
    setBusy(true);
    setReport(null);
    try {
      const existingSnap = await getDocs(
        query(collection(db, "cards"), where("expansionId", "==", expansionId))
      );
      const byNumber = new Map<number, string>();
      existingSnap.forEach((d) => {
        const data = d.data() as { number?: unknown };
        if (typeof data.number === "number") byNumber.set(data.number, d.id);
      });

      let updated = 0, missing = 0;
      for (let i = 0; i < valid.length; i += 400) {
        const chunk = valid.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const row of chunk) {
          if (row.num == null) continue;
          const cardId = byNumber.get(row.num);
          if (!cardId) {
            missing++;
            continue;
          }
          batch.update(doc(db, "cards", cardId), { imageUrl: row.url });
          updated++;
        }
        await batch.commit();
      }
      setReport({ updated, missing, skipped: invalid.length });
      setText("");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="h2">이미지 URL 일괄 등록</h2>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        한 줄에 <code className="mini">번호 URL</code>. 번호는 <code className="mini">001/083</code> 또는 <code className="mini">1</code> 둘 다 OK.
        해당 번호의 카드가 이미 등록되어 있어야 합니다 (없으면 건너뜀).
      </p>

      <div className="row" style={{ marginBottom: 10 }}>
        <label>
          대상 확장팩
          <select
            value={expansionId}
            onChange={(e) => setExpansionId(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">— 선택 —</option>
            {exps.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} {e.name ? `(${e.name})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        rows={8}
        placeholder={"001\thttps://example.com/cards/m4/001.png\n002\thttps://example.com/cards/m4/002.png\n..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: "100%", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}
      />

      {parsed.length > 0 && (
        <div className="row" style={{ marginTop: 8, fontSize: 13 }}>
          <span>총 <b>{parsed.length}</b>행</span>
          <span style={{ color: "var(--ok)" }}>정상 {valid.length}</span>
          {invalid.length > 0 && (
            <span style={{ color: "var(--danger)" }}>오류 {invalid.length}</span>
          )}
        </div>
      )}

      {valid.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 200, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>번호</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {valid.slice(0, 200).map((r, i) => (
                <tr key={i}>
                  <td><code className="mini">{String(r.num).padStart(3, "0")}</code></td>
                  <td style={{ fontSize: 11, wordBreak: "break-all" }}>{r.url}</td>
                </tr>
              ))}
              {valid.length > 200 && (
                <tr><td colSpan={2} className="muted">… {valid.length - 200}행 더</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {invalid.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 160, overflow: "auto" }}>
          <p className="muted" style={{ fontSize: 12, color: "var(--danger)" }}>
            처리 불가 {invalid.length}건:
          </p>
          <table>
            <tbody>
              {invalid.slice(0, 50).map((r, i) => (
                <tr key={i}>
                  <td style={{ color: "var(--danger)", fontSize: 12 }}>{r.reason}</td>
                  <td><code className="mini">{r.raw}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={submit} disabled={busy || !expansionId || valid.length === 0}>
          {busy ? "업데이트 중..." : `${valid.length}건 이미지 적용`}
        </button>
        {report && (
          <span style={{ color: "var(--ok)", fontSize: 14 }}>
            ✔ 적용 {report.updated}
            {report.missing > 0 ? ` · 카드 없음 ${report.missing}` : ""}
            {report.skipped > 0 ? ` · 형식 오류 ${report.skipped}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
