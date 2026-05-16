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
          유저가 카드 1장을 분해할 때 얻는 캐시 (C). <b>1 C = 1 원</b> 기준입니다.
          분해된 카드 수량은 자동으로 풀 재고에 회수됩니다.
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
        <h2 className="h2" style={{ marginTop: 0 }}>추천 시세 (1 C = 1 원)</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          국내 포켓몬 카드 시장의 일반적인 시세를 참고한 추천값. 등급 내에서도 카드별 편차가 크니
          시장 가격의 절반 ~ 70% 정도로 잡는 게 무난합니다. 실제 운영에 맞춰 자유롭게 조정하세요.
        </p>
        <table>
          <thead>
            <tr>
              <th>등급</th>
              <th>이름</th>
              <th style={{ textAlign: "right" }}>시세 (원)</th>
              <th style={{ textAlign: "right" }}>추천 분해값</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>C</td>  <td>커먼</td>          <td style={{ textAlign: "right" }}>100 – 300</td>       <td style={{ textAlign: "right" }}>100</td></tr>
            <tr><td>U</td>  <td>언커먼</td>        <td style={{ textAlign: "right" }}>300 – 800</td>       <td style={{ textAlign: "right" }}>300</td></tr>
            <tr><td>R</td>  <td>레어</td>          <td style={{ textAlign: "right" }}>1,000 – 3,000</td>   <td style={{ textAlign: "right" }}>1,000</td></tr>
            <tr><td>RR</td> <td>더블레어</td>      <td style={{ textAlign: "right" }}>5,000 – 15,000</td>  <td style={{ textAlign: "right" }}>3,000</td></tr>
            <tr><td>SR</td> <td>슈퍼레어</td>      <td style={{ textAlign: "right" }}>20,000 – 50,000</td> <td style={{ textAlign: "right" }}>15,000</td></tr>
            <tr><td>AR</td> <td>아트레어</td>      <td style={{ textAlign: "right" }}>30,000 – 80,000</td> <td style={{ textAlign: "right" }}>30,000</td></tr>
            <tr><td>SAR</td><td>스페셜아트</td>    <td style={{ textAlign: "right" }}>80,000 – 200,000</td><td style={{ textAlign: "right" }}>80,000</td></tr>
            <tr><td>UR</td> <td>울트라레어</td>    <td style={{ textAlign: "right" }}>100,000 – 300,000</td><td style={{ textAlign: "right" }}>100,000</td></tr>
            <tr><td>ACE</td><td>에이스</td>        <td style={{ textAlign: "right" }}>50,000 – 200,000</td><td style={{ textAlign: "right" }}>70,000</td></tr>
            <tr><td>S</td>  <td>샤이니</td>        <td style={{ textAlign: "right" }}>30,000 – 150,000</td><td style={{ textAlign: "right" }}>50,000</td></tr>
            <tr><td>SSR</td><td>스페셜슈퍼레어</td><td style={{ textAlign: "right" }}>150,000 – 500,000</td><td style={{ textAlign: "right" }}>200,000</td></tr>
            <tr><td>BWR</td><td>흑백레어</td>      <td style={{ textAlign: "right" }}>80,000 – 300,000</td><td style={{ textAlign: "right" }}>120,000</td></tr>
            <tr><td>MUR</td><td>마스터울트라</td>  <td style={{ textAlign: "right" }}>300,000 – 1,000,000</td><td style={{ textAlign: "right" }}>500,000</td></tr>
            <tr><td>MA</td> <td>마스터</td>        <td style={{ textAlign: "right" }}>800,000 ~</td>       <td style={{ textAlign: "right" }}>1,000,000</td></tr>
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
          ⚠️ 시세는 시점/카드/상태에 따라 크게 변동합니다. 위 표는 평균치 기준의 대략적인 가이드.
        </p>
      </div>
    </div>
  );
}
