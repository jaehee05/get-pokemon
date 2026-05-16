import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { CurrencyMark } from "../CurrencyMark";
import { functions } from "../firebase";
import { formatCurrency } from "../useProfile";

type Method = "card" | "bank";

interface ChargeResponse {
  ok: boolean;
  requestId: string;
  bankName: string;
  bankAccount: string;
  accountHolder: string;
}

const AMOUNT_PRESETS = [3000, 5000, 10000, 30000, 50000, 100000];

export function ChargeDialog({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = useState<Method>("card");
  const [amount, setAmount] = useState<number>(5000);
  const [phone, setPhone] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<ChargeResponse | null>(null);

  // 사전 표시용 (계좌 정보 미리 보여주기)
  const [bank, setBank] = useState<{ bankName: string; bankAccount: string; accountHolder: string } | null>(null);
  useEffect(() => {
    httpsCallable<unknown, { bankName: string; bankAccount: string; accountHolder: string }>(
      functions,
      "getPaymentConfig"
    )({}).then((r) => setBank(r.data)).catch(() => {});
  }, []);

  const minOk = amount >= 1000;
  const formOk =
    minOk && (method === "card" ? phone.trim().length > 0 : depositorName.trim().length > 0);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await httpsCallable<
        { method: Method; amount: number; phone?: string; depositorName?: string },
        ChargeResponse
      >(functions, "requestCharge")({
        method,
        amount,
        phone: method === "card" ? phone.trim() : undefined,
        depositorName: method === "bank" ? depositorName.trim() : undefined,
      });
      setDone(r.data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
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
        style={{ width: "min(480px, 100%)", maxHeight: "92vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h2 className="h2" style={{ margin: 0 }}>
            <CurrencyMark size={18} /> 캐시 충전
          </h2>
          <button className="ghost" onClick={onClose}>닫기</button>
        </div>

        {!done ? (
          <>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
              1 C = 1 원. 신청 후 관리자가 확인하면 캐시가 적립됩니다.
            </p>

            <div className="row" style={{ marginBottom: 10 }}>
              <button
                className={method === "card" ? "" : "secondary"}
                onClick={() => setMethod("card")}
                style={{ flex: 1 }}
              >
                💳 카드
              </button>
              <button
                className={method === "bank" ? "" : "secondary"}
                onClick={() => setMethod("bank")}
                style={{ flex: 1 }}
              >
                🏦 계좌이체
              </button>
            </div>

            <label style={{ marginBottom: 10 }}>
              충전 금액 (C)
              <input
                type="number"
                min={1000}
                step={1000}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value))))}
              />
            </label>

            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {AMOUNT_PRESETS.map((p) => (
                <button
                  key={p}
                  className={amount === p ? "" : "secondary"}
                  onClick={() => setAmount(p)}
                  style={{ fontSize: 12 }}
                >
                  {formatCurrency(p)} C
                </button>
              ))}
            </div>

            {method === "card" ? (
              <label style={{ marginBottom: 10 }}>
                청구서 받을 전화번호
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                />
              </label>
            ) : (
              <label style={{ marginBottom: 10 }}>
                입금자명
                <input
                  value={depositorName}
                  onChange={(e) => setDepositorName(e.target.value)}
                  placeholder="홍길동"
                />
              </label>
            )}

            <div
              className="panel"
              style={{ marginTop: 6, padding: "10px 12px", background: "var(--panel-3)" }}
            >
              <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                <span className="muted">충전 금액</span>
                <span style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CurrencyMark size={13} /> {formatCurrency(amount)}
                </span>
              </div>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                <span className="muted">결제 금액</span>
                <span style={{ fontWeight: 700 }}>{formatCurrency(amount)} 원</span>
              </div>
            </div>

            {err && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</p>}

            <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button className="ghost" onClick={onClose}>취소</button>
              <button onClick={submit} disabled={busy || !formOk}>
                {busy ? "신청 중..." : !minOk ? "1,000 C 이상" : "신청"}
              </button>
            </div>
          </>
        ) : (
          /* 완료 화면 */
          <>
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 12,
                background: "rgba(34, 197, 94, 0.10)",
                border: "1px solid rgba(34, 197, 94, 0.4)",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800 }}>✔ 신청 완료</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {method === "card"
                  ? `입력하신 전화번호로 청구서가 발송됩니다.`
                  : `아래 계좌로 입금해주시면 관리자 확인 후 캐시가 적립됩니다.`}
              </div>
            </div>

            {method === "bank" && (
              <div className="panel" style={{ background: "var(--panel-3)" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted" style={{ fontSize: 12 }}>입금 금액</span>
                  <div className="row" style={{ gap: 6 }}>
                    <b style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(amount)} 원</b>
                    <button
                      className="ghost"
                      onClick={() => copy(String(amount))}
                      style={{ fontSize: 11, padding: "3px 8px" }}
                    >
                      복사
                    </button>
                  </div>
                </div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
                  <span className="muted" style={{ fontSize: 12 }}>은행</span>
                  <span>{done.bankName || "—"}</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
                  <span className="muted" style={{ fontSize: 12 }}>계좌번호</span>
                  <div className="row" style={{ gap: 6 }}>
                    <b style={{ fontVariantNumeric: "tabular-nums" }}>{done.bankAccount || "—"}</b>
                    {done.bankAccount && (
                      <button
                        className="ghost"
                        onClick={() => copy(done.bankAccount)}
                        style={{ fontSize: 11, padding: "3px 8px" }}
                      >
                        복사
                      </button>
                    )}
                  </div>
                </div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
                  <span className="muted" style={{ fontSize: 12 }}>예금주</span>
                  <span>{done.accountHolder || "—"}</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
                  <span className="muted" style={{ fontSize: 12 }}>입금자명</span>
                  <span>{depositorName}</span>
                </div>
                {!done.bankAccount && (
                  <p style={{ color: "var(--warn)", fontSize: 12, marginTop: 8 }}>
                    아직 계좌번호가 등록되어있지 않습니다. 관리자에게 문의해주세요.
                  </p>
                )}
              </div>
            )}

            {method === "card" && (
              <div className="panel" style={{ background: "var(--panel-3)" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted" style={{ fontSize: 12 }}>결제 금액</span>
                  <b>{formatCurrency(amount)} 원</b>
                </div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
                  <span className="muted" style={{ fontSize: 12 }}>전화번호</span>
                  <span>{phone}</span>
                </div>
              </div>
            )}

            <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={onClose}>확인</button>
            </div>
          </>
        )}

        {/* 사전 안내 (미리 계좌 정보) */}
        {!done && method === "bank" && bank?.bankAccount && (
          <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
            입금 계좌: {bank.bankName} {bank.bankAccount} ({bank.accountHolder})
          </p>
        )}
      </div>
    </div>
  );
}
