import { httpsCallable } from "firebase/functions";
import { useEffect, useMemo, useState } from "react";
import { SafeImage } from "../SafeImage";
import { functions } from "../firebase";
import {
  Card,
  Expansion,
  RARITY_COLOR,
} from "../types";
import { CurrencyMark } from "../CurrencyMark";
import { formatCurrency, UserProfile } from "../useProfile";

interface SelectedCard {
  cardId: string;
  card: Card;
  exp?: Expansion;
}

export function ShippingDialog({
  profile,
  balance,
  selected,
  onClose,
  onSubmitted,
}: {
  profile: UserProfile | null;
  balance: number;
  selected: SelectedCard[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [name, setName] = useState(profile?.shippingName ?? "");
  const [phone, setPhone] = useState(profile?.shippingPhone ?? "");
  const [address, setAddress] = useState(profile?.shippingAddress ?? "");
  const [fee, setFee] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    httpsCallable<unknown, { fee: number }>(functions, "getShippingConfig")({})
      .then((r) => setFee(r.data.fee))
      .catch(() => setFee(null));
  }, []);

  const cardCount = selected.length;
  const canAfford = fee !== null && balance >= fee;
  const formValid = name.trim() && phone.trim() && address.trim();
  const submittable = canAfford && formValid && cardCount > 0 && !busy;

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await httpsCallable<
        { cardIds: string[]; recipientName: string; recipientPhone: string; recipientAddress: string },
        { ok: boolean; requestId: string; fee: number }
      >(functions, "requestShipping")({
        cardIds: selected.map((s) => s.cardId),
        recipientName: name.trim(),
        recipientPhone: phone.trim(),
        recipientAddress: address.trim(),
      });
      onSubmitted();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const cardsPreview = useMemo(() => selected.slice(0, 30), [selected]);

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
        style={{ width: "min(640px, 100%)", maxHeight: "92vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h2 className="h2" style={{ margin: 0 }}>📦 배송 신청</h2>
          <button className="ghost" onClick={onClose}>닫기</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          신청 시 선택한 카드 각 1장씩이 컬렉션에서 차감됩니다. 배송 정보는 다음 신청 시 자동으로 채워집니다.
        </p>

        {/* 선택한 카드 미리보기 */}
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 className="h2" style={{ marginTop: 0 }}>선택한 카드 ({cardCount}장)</h3>
          {cardCount === 0 ? (
            <p className="muted">선택된 카드가 없습니다.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
                gap: 6,
                maxHeight: 180,
                overflow: "auto",
              }}
            >
              {cardsPreview.map((s) => (
                <div key={s.cardId} title={s.card.name}>
                  <SafeImage
                    src={s.card.imageUrl}
                    alt={s.card.name}
                    style={{ width: "100%", aspectRatio: "5/7", objectFit: "cover", borderRadius: 4 }}
                    fallback={
                      <div
                        style={{
                          width: "100%", aspectRatio: "5/7",
                          background: RARITY_COLOR[s.card.rarity],
                          color: "#0a0d14",
                          display: "grid", placeItems: "center",
                          fontSize: 10, fontWeight: 800,
                          borderRadius: 4,
                        }}
                      >
                        {s.card.rarity}
                      </div>
                    }
                  />
                </div>
              ))}
              {cardCount > cardsPreview.length && (
                <div
                  style={{
                    aspectRatio: "5/7",
                    background: "var(--panel-3)",
                    border: "1px dashed var(--border-strong)",
                    borderRadius: 4,
                    display: "grid", placeItems: "center",
                    color: "var(--muted)",
                    fontSize: 12,
                  }}
                >
                  +{cardCount - cardsPreview.length}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 배송 정보 */}
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 className="h2" style={{ marginTop: 0 }}>배송 정보</h3>
          <div className="col">
            <label>
              받는 사람 (실명)
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
            </label>
            <label>
              연락처
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-1234-5678" />
            </label>
            <label>
              주소
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="우편번호를 포함해 상세주소까지 입력"
              />
            </label>
          </div>
        </div>

        {/* 비용 요약 */}
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 className="h2" style={{ marginTop: 0 }}>요약</h3>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">선택 카드</span>
            <span><b>{cardCount}</b>장</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">배송비</span>
            <span style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {fee === null ? "..." : fee === 0 ? "무료" : <><CurrencyMark size={13} />{formatCurrency(fee)}</>}
            </span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">신청 후 잔액</span>
            <span
              style={{
                fontWeight: 700,
                color: !canAfford ? "var(--danger)" : "var(--text)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <CurrencyMark size={13} />
              {formatCurrency(balance - (fee ?? 0))}
            </span>
          </div>
        </div>

        {err && (
          <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</p>
        )}

        <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
          <button className="ghost" onClick={onClose}>취소</button>
          <button onClick={submit} disabled={!submittable}>
            {busy
              ? "신청 중..."
              : !canAfford
              ? "캐시 부족"
              : !formValid
              ? "정보 입력 필요"
              : "신청"}
          </button>
        </div>
      </div>
    </div>
  );
}
