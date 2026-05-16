import {
  Timestamp,
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { db, functions } from "../firebase";

interface PaymentConfig {
  bankName: string;
  bankAccount: string;
  accountHolder: string;
}

interface ChargeRequest {
  id: string;
  uid: string;
  userEmail?: string | null;
  userDisplayName?: string | null;
  method: "card" | "bank";
  amount: number;
  phone?: string;
  depositorName?: string;
  status: "pending" | "completed" | "cancelled";
  createdAt?: Timestamp;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  adminNote?: string;
}

const STATUS_LABEL: Record<ChargeRequest["status"], string> = {
  pending: "대기",
  completed: "승인",
  cancelled: "취소",
};
const STATUS_COLOR: Record<ChargeRequest["status"], string> = {
  pending: "var(--warn)",
  completed: "var(--ok)",
  cancelled: "var(--muted)",
};

export default function AdminCharge() {
  const [cfg, setCfg] = useState<PaymentConfig>({ bankName: "", bankAccount: "", accountHolder: "" });
  const [saved, setSaved] = useState<PaymentConfig | null>(null);
  const [savingCfg, setSavingCfg] = useState(false);

  const [reqs, setReqs] = useState<ChargeRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | ChargeRequest["status"]>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    httpsCallable<unknown, PaymentConfig>(functions, "getPaymentConfig")({}).then((r) => {
      setCfg(r.data);
      setSaved(r.data);
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "chargeRequests"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setReqs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChargeRequest, "id">) })));
    });
  }, []);

  const dirty =
    saved &&
    (saved.bankName !== cfg.bankName ||
      saved.bankAccount !== cfg.bankAccount ||
      saved.accountHolder !== cfg.accountHolder);

  async function saveCfg() {
    setSavingCfg(true);
    try {
      const r = await httpsCallable<PaymentConfig, { ok: boolean } & PaymentConfig>(
        functions,
        "setPaymentConfig"
      )(cfg);
      setSaved({ bankName: r.data.bankName, bankAccount: r.data.bankAccount, accountHolder: r.data.accountHolder });
      alert("저장되었습니다.");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingCfg(false);
    }
  }

  async function approve(id: string) {
    if (!confirm("이 신청을 승인하면 유저에게 캐시가 적립됩니다. 진행할까요?")) return;
    setBusyId(id);
    try {
      await httpsCallable<{ requestId: string }, { ok: boolean }>(functions, "approveCharge")({ requestId: id });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: string) {
    const reason = prompt("취소 사유 (선택)") ?? undefined;
    setBusyId(id);
    try {
      await httpsCallable<{ requestId: string; reason?: string }, { ok: boolean }>(
        functions,
        "cancelCharge"
      )({ requestId: id, reason });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const filtered = statusFilter === "all" ? reqs : reqs.filter((r) => r.status === statusFilter);
  const counts = {
    pending: reqs.filter((r) => r.status === "pending").length,
    completed: reqs.filter((r) => r.status === "completed").length,
    cancelled: reqs.filter((r) => r.status === "cancelled").length,
  };

  return (
    <div className="col">
      <div className="panel">
        <h2 className="h2" style={{ marginTop: 0 }}>입금 계좌 (계좌이체 충전용)</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          유저가 계좌이체로 충전 신청 시 안내되는 계좌 정보입니다.
        </p>
        <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
          <label>
            은행
            <input
              value={cfg.bankName}
              onChange={(e) => setCfg({ ...cfg, bankName: e.target.value })}
              placeholder="국민은행"
              style={{ width: 140 }}
            />
          </label>
          <label>
            계좌번호
            <input
              value={cfg.bankAccount}
              onChange={(e) => setCfg({ ...cfg, bankAccount: e.target.value })}
              placeholder="123456-78-901234"
              style={{ width: 200 }}
            />
          </label>
          <label>
            예금주
            <input
              value={cfg.accountHolder}
              onChange={(e) => setCfg({ ...cfg, accountHolder: e.target.value })}
              placeholder="홍길동"
              style={{ width: 140 }}
            />
          </label>
          <button onClick={saveCfg} disabled={savingCfg || !dirty}>
            {savingCfg ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="row" style={{ gap: 6 }}>
          {(["pending", "all", "completed", "cancelled"] as const).map((s) => {
            const on = statusFilter === s;
            const count = s === "all" ? reqs.length : counts[s];
            return (
              <button
                key={s}
                className={on ? "" : "secondary"}
                onClick={() => setStatusFilter(s)}
                style={{ fontSize: 12 }}
              >
                {s === "all" ? "전체" : STATUS_LABEL[s]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2 className="h2" style={{ marginTop: 0 }}>충전 신청 ({filtered.length})</h2>
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="icon">📭</div>
            해당 상태의 신청이 없습니다.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>상태</th>
                <th>유저</th>
                <th>방식</th>
                <th>정보</th>
                <th style={{ textAlign: "right" }}>금액 (C/원)</th>
                <th>시간</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span
                      style={{
                        background: STATUS_COLOR[r.status],
                        color: "#0a0d14",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {r.userDisplayName || r.userEmail || "—"}
                    </div>
                    <code className="mini">{r.uid}</code>
                  </td>
                  <td>{r.method === "card" ? "💳 카드" : "🏦 계좌"}</td>
                  <td style={{ fontSize: 13 }}>
                    {r.method === "card" ? (
                      <span>
                        📱{" "}
                        <a href={`tel:${r.phone}`} style={{ color: "var(--accent-2)" }}>
                          {r.phone}
                        </a>
                      </span>
                    ) : (
                      <span>입금자: <b>{r.depositorName}</b></span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                    {r.amount.toLocaleString()}
                  </td>
                  <td className="muted" style={{ fontSize: 11 }}>
                    {r.createdAt?.toDate().toLocaleString("ko-KR") ?? ""}
                  </td>
                  <td>
                    {r.status === "pending" && (
                      <div className="row" style={{ gap: 4 }}>
                        <button
                          onClick={() => approve(r.id)}
                          disabled={busyId === r.id}
                          style={{ fontSize: 12 }}
                        >
                          승인
                        </button>
                        <button
                          className="danger"
                          onClick={() => cancel(r.id)}
                          disabled={busyId === r.id}
                          style={{ fontSize: 12 }}
                        >
                          취소
                        </button>
                      </div>
                    )}
                    {r.adminNote && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                        {r.adminNote}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
