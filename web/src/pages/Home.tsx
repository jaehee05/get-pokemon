import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { functions } from "../firebase";

interface PackMeta {
  id: string;
  name: string;
  imageUrl: string;
  cardCount: number;
  price: number;
}

export default function Home() {
  const [packs, setPacks] = useState<PackMeta[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const call = httpsCallable<unknown, { packs: PackMeta[] }>(
      functions,
      "listActivePacks"
    );
    call({})
      .then((r) => setPacks(r.data.packs))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div>
      <h1 className="h1">팩 선택</h1>
      {!user && (
        <p className="muted">
          팩을 열려면 우측 상단에서 Google 로그인을 해주세요.
        </p>
      )}
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      {packs === null && !err && <p className="muted">불러오는 중...</p>}
      {packs && packs.length === 0 && (
        <p className="muted">
          아직 활성화된 팩이 없습니다. 관리자에서 카드와 팩을 추가해주세요.
        </p>
      )}
      {packs && packs.length > 0 && (
        <div className="grid packs">
          {packs.map((p) => (
            <Link
              key={p.id}
              to={`/pack/${p.id}`}
              className="card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="thumb">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} />
                ) : (
                  <span style={{ fontSize: 48 }}>📦</span>
                )}
              </div>
              <div className="name">{p.name}</div>
              <div className="muted">
                {p.cardCount}장 · 가격 {p.price ?? 0}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
