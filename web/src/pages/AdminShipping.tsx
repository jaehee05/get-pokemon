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

interface ShippingCardSnapshot {
  id: string;
  name: string;
  rarity: string;
  imageUrl?: string;
  expansionId?: string | null;
  number?: number | null;
}

interface ShippingRequest {
  id: string;
  uid: string;
  userEmail?: string | null;
  userDisplayName?: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  cardIds: string[];
  cards: ShippingCardSnapshot[];
  cardCount: number;
  fee: number;
  status: "pending" | "shipped" | "cancelled";
  createdAt?: Timestamp;
  shippedAt?: Timestamp;
  adminNote?: string;
}

const STATUS_LABEL: Record<ShippingRequest["status"], string> = {
  pending: "대기",
  shipped: "발송",
  cancelled: "취소",
};
const STATUS_COLOR: Record<ShippingRequest["status"], string> = {
  pending: "var(--warn)",
  shipped: "var(--ok)",
  cancelled: "var(--muted)",
};

export default function AdminShipping() {
  const [reqs, setReqs] = useState<ShippingRequest[]>([]);
  const [fee, setFee] = useState<number | null>(null);
  const [feeInput, setFeeInput] = useState<number>(0);
  const [savingFee, setSavingFee] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | ShippingRequest["status"]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const q = query(collection(db, "shippingRequests"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setReqs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ShippingRequest, "id">) })));
    });
  }, []);

  useEffect(() => {
    httpsCallable<unknown, { fee: number }>(functions, "getShippingConfig")({})
      .then((r) => {
        setFee(r.data.fee);
        setFeeInput(r.data.fee);
      })
      .catch(() => setFee(0));
  }, []);

  async function saveFee() {
    setSavingFee(true);
    try {
      const r = await httpsCallable<{ fee: number }, { ok: boolean; fee: number }>(
        functions,
        "setShippingConfig"
      )({ fee: feeInput });
      setFee(r.data.fee);
      alert("배송비가 저장되었습니다.");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingFee(false);
    }
  }

  async function updateStatus(id: string, status: ShippingRequest["status"]) {
    if (status === "cancelled") {
      if (!confirm("이 배송 신청을 취소 처리할까요? (캐시/카드는 자동 환불되지 않습니다)"))
        return;
    }
    setBusyId(id);
    try {
      await httpsCallable<{ requestId: string; status: ShippingRequest["status"] }, { ok: boolean }>(
        functions,
        "updateShippingStatus"
      )({ requestId: id, status });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  function toggle(id: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = statusFilter === "all" ? reqs : reqs.filter((r) => r.status === statusFilter);
  const counts = {
    pending: reqs.filter((r) => r.status === "pending").length,
    shipped: reqs.filter((r) => r.status === "shipped").length,
    cancelled: reqs.filter((r) => r.status === "cancelled").length,
  };

  return (
    <div className="col">
      {/* 배송비 설정 */}
      <div className="panel">
        <h2 className="h2" style={{ marginTop: 0 }}>배송비 설정</h2>
        <div className="row" style={{ gap: 10 }}>
          <label>
            배송비 (캐시)
            <input
              type="number"
              min={0}
              value={feeInput}
              onChange={(e) => setFeeInput(Math.max(0, Number(e.target.value)))}
              style={{ width: 140 }}
            />
          </label>
          <button onClick={saveFee} disabled={savingFee || feeInput === fee}>
            {savingFee ? "저장 중..." : "저장"}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            현재 설정값: {fee === null ? "..." : fee === 0 ? "무료" : `${fee.toLocaleString()} C`}
          </span>
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="panel">
        <div className="row" style={{ gap: 6 }}>
          {(["all", "pending", "shipped", "cancelled"] as const).map((s) => {
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

      {/* 신청 목록 */}
      <div className="panel">
        <h2 className="h2" style={{ marginTop: 0 }}>배송 신청 ({filtered.length})</h2>
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="icon">📭</div>
            해당 상태의 신청이 없습니다.
          </div>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {filtered.map((r) => {
              const isOpen = expanded.has(r.id);
              return (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 12,
                    background: "var(--panel-2)",
                  }}
                >
                  <div
                    className="row"
                    style={{ justifyContent: "space-between", cursor: "pointer" }}
                    onClick={() => toggle(r.id)}
                  >
                    <div className="row" style={{ gap: 10 }}>
                      <span
                        style={{
                          background: STATUS_COLOR[r.status],
                          color: "#0a0d14",
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                      <span style={{ fontWeight: 700 }}>{r.recipientName}</span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {r.cardCount}장 · {r.fee.toLocaleString()} C
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {r.createdAt?.toDate().toLocaleString("ko-KR") ?? ""}
                      </span>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      {r.status === "pending" && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(r.id, "shipped"); }}
                            disabled={busyId === r.id}
                            style={{ fontSize: 12 }}
                          >
                            발송 완료
                          </button>
                          <button
                            className="danger"
                            onClick={(e) => { e.stopPropagation(); updateStatus(r.id, "cancelled"); }}
                            disabled={busyId === r.id}
                            style={{ fontSize: 12 }}
                          >
                            취소
                          </button>
                        </>
                      )}
                      {r.status === "shipped" && (
                        <button
                          className="secondary"
                          onClick={(e) => { e.stopPropagation(); updateStatus(r.id, "pending"); }}
                          disabled={busyId === r.id}
                          style={{ fontSize: 12 }}
                        >
                          되돌리기
                        </button>
                      )}
                      <span className="muted" style={{ fontSize: 11 }}>
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="col" style={{ marginTop: 12, gap: 10 }}>
                      <div className="row" style={{ gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <div>
                          <div className="muted" style={{ fontSize: 11 }}>받는 사람</div>
                          <div style={{ fontWeight: 700 }}>{r.recipientName}</div>
                        </div>
                        <div>
                          <div className="muted" style={{ fontSize: 11 }}>연락처</div>
                          <div style={{ fontWeight: 600 }}>
                            <a href={`tel:${r.recipientPhone}`} style={{ color: "var(--accent-2)" }}>
                              {r.recipientPhone}
                            </a>
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 240 }}>
                          <div className="muted" style={{ fontSize: 11 }}>주소</div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{r.recipientAddress}</div>
                        </div>
                      </div>
                      <div className="row" style={{ gap: 22, fontSize: 13 }}>
                        <span className="muted">유저 {r.userDisplayName || r.userEmail || r.uid}</span>
                        <span className="muted">UID <code className="mini">{r.uid}</code></span>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                          카드 ({r.cardCount}장)
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                            gap: 6,
                          }}
                        >
                          {r.cards.map((c, i) => (
                            <div
                              key={i}
                              style={{
                                background: "var(--panel-3)",
                                padding: "4px 8px",
                                borderRadius: 6,
                                fontSize: 12,
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 6,
                              }}
                            >
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {c.name}
                              </span>
                              <span style={{ fontWeight: 700, color: "var(--accent-2)" }}>{c.rarity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
