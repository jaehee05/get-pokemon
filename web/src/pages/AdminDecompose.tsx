import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { functions } from "../firebase";
import { ALL_RARITIES, RARITY_COLOR, RARITY_LABEL, Rarity } from "../types";

export default function AdminDecompose() {
  const [values, setValues] = useState<Record<Rarity, number>>(
    () => Object.fromEntries(ALL_RARITIES.map((r) => [r, 0])) as Record<Rarity, number>
  );
  const [saved, setSaved] = useState<Record<Rarity, number> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    httpsCallable<unknown, { values: Record<Rarity, number> }>(
      functions,
      "getDecomposeConfig"
    )({}).then((r) => {
      setValues(r.data.values);
      setSaved(r.data.values);
    });
  }, []);

  const dirty =
    saved &&
    ALL_RARITIES.some((r) => (saved[r] ?? 0) !== (values[r] ?? 0));

  async function save() {
    setBusy(true);
    try {
      const r = await httpsCallable<{ values: Record<Rarity, number> }, { ok: boolean; values: Record<Rarity, number> }>(
        functions,
        "setDecomposeConfig"
      )({ values });
      setSaved(r.data.values);
      setValues(r.data.values);
      alert("저장되었습니다.");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function bulk(multiplier: number) {
    setValues((cur) => {
      const next = { ...cur };
      for (const r of ALL_RARITIES) next[r] = Math.max(0, Math.round(next[r] * multiplier));
      return next;
    });
  }

  return (
    <div className="col">
      <div className="panel">
        <h2 className="h2" style={{ marginTop: 0 }}>등급별 분해 가치</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          유저가 카드 1장을 분해할 때 얻는 캐시 (C). 등급별로 다르게 설정 가능합니다.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 10,
            marginBottom: 14,
          }}
        >
          {ALL_RARITIES.map((r) => (
            <label key={r}>
              <span
                style={{
                  background: RARITY_COLOR[r],
                  color: "#0a0d14",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontWeight: 800,
                  fontSize: 10,
                  width: "fit-content",
                }}
                title={RARITY_LABEL[r]}
              >
                {r}
              </span>
              <input
                type="number"
                min={0}
                value={values[r] ?? 0}
                onChange={(e) =>
                  setValues((cur) => ({ ...cur, [r]: Math.max(0, Number(e.target.value)) }))
                }
              />
            </label>
          ))}
        </div>

        <div className="row">
          <button onClick={save} disabled={busy || !dirty}>
            {busy ? "저장 중..." : "저장"}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => saved && setValues(saved)}
          >
            되돌리기
          </button>
          <span style={{ flex: 1 }} />
          <button className="ghost" disabled={busy} onClick={() => bulk(2)} style={{ fontSize: 12 }}>
            ×2
          </button>
          <button className="ghost" disabled={busy} onClick={() => bulk(0.5)} style={{ fontSize: 12 }}>
            ÷2
          </button>
        </div>
      </div>

      <div className="panel">
        <h2 className="h2" style={{ marginTop: 0 }}>참고 — 추천 시작값</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          참고용 가이드라인. 게임 밸런스에 맞게 자유롭게 조정하세요.
        </p>
        <table>
          <thead>
            <tr><th>등급</th><th style={{ textAlign: "right" }}>추천값</th></tr>
          </thead>
          <tbody>
            <tr><td>C</td><td style={{ textAlign: "right" }}>5</td></tr>
            <tr><td>U</td><td style={{ textAlign: "right" }}>10</td></tr>
            <tr><td>R</td><td style={{ textAlign: "right" }}>30</td></tr>
            <tr><td>RR</td><td style={{ textAlign: "right" }}>80</td></tr>
            <tr><td>SR</td><td style={{ textAlign: "right" }}>200</td></tr>
            <tr><td>AR</td><td style={{ textAlign: "right" }}>250</td></tr>
            <tr><td>SAR</td><td style={{ textAlign: "right" }}>400</td></tr>
            <tr><td>UR</td><td style={{ textAlign: "right" }}>600</td></tr>
            <tr><td>ACE</td><td style={{ textAlign: "right" }}>700</td></tr>
            <tr><td>S / SSR / BWR</td><td style={{ textAlign: "right" }}>800 – 1,200</td></tr>
            <tr><td>MUR / MA</td><td style={{ textAlign: "right" }}>1,500 – 2,500</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
