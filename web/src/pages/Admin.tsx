import { Link, Route, Routes, useLocation } from "react-router-dom";
import AdminCards from "./AdminCards";
import AdminCharge from "./AdminCharge";
import AdminDecompose from "./AdminDecompose";
import AdminExpansions from "./AdminExpansions";
import AdminPacks from "./AdminPacks";
import AdminShipping from "./AdminShipping";
import AdminStock from "./AdminStock";
import AdminUsers from "./AdminUsers";

interface SectionDef {
  to: string;
  icon: string;
  title: string;
  desc: string;
}

const SECTIONS: SectionDef[] = [
  { to: "/admin/expansions", icon: "📚", title: "확장팩", desc: "코드 / 기본 카드 수 / 벌크 임포트" },
  { to: "/admin/cards", icon: "🃏", title: "카드", desc: "카탈로그 정의 · 등급 · 이미지 URL" },
  { to: "/admin/stock", icon: "📦", title: "재고", desc: "필터 + 일괄 작업으로 가챠 풀 관리" },
  { to: "/admin/packs", icon: "🎴", title: "팩", desc: "슬롯별 등급 가중치 + 카드풀" },
  { to: "/admin/users", icon: "👥", title: "유저", desc: "캐시 지급 · 컬렉션 편집 · 삭제" },
  { to: "/admin/shipping", icon: "🚚", title: "배송", desc: "배송비 설정 · 신청 목록 · 상태 변경" },
  { to: "/admin/decompose", icon: "♻️", title: "분해", desc: "등급별 분해 가치 (C) 설정" },
  { to: "/admin/charge", icon: "💳", title: "충전", desc: "입금 계좌 · 충전 신청 승인 / 취소" },
];

function AdminLanding() {
  return (
    <div className="grid admin-tiles">
      {SECTIONS.map((s) => (
        <Link key={s.to} to={s.to} className="admin-tile">
          <div className="admin-tile-icon">{s.icon}</div>
          <div className="admin-tile-title">{s.title}</div>
          <div className="admin-tile-desc">{s.desc}</div>
        </Link>
      ))}
    </div>
  );
}

function AdminNav() {
  const loc = useLocation();
  // /admin 자체에서는 nav 숨김 (랜딩이 이미 카드 형태)
  if (loc.pathname === "/admin" || loc.pathname === "/admin/") return null;
  return (
    <div className="admin-nav">
      {SECTIONS.map((s) => {
        const active = loc.pathname.startsWith(s.to);
        return (
          <Link
            key={s.to}
            to={s.to}
            className={`admin-nav-link${active ? " active" : ""}`}
          >
            <span style={{ marginRight: 6 }}>{s.icon}</span>
            {s.title}
          </Link>
        );
      })}
    </div>
  );
}

export default function Admin() {
  const loc = useLocation();
  const isLanding = loc.pathname === "/admin" || loc.pathname === "/admin/";
  const currentSection = SECTIONS.find((s) => loc.pathname.startsWith(s.to));

  return (
    <div className="admin-root">
      <div className="row" style={{ alignItems: "baseline", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
        <Link to="/admin" className="h1" style={{ margin: 0, textDecoration: "none", color: "inherit" }}>
          관리자
        </Link>
        {currentSection && !isLanding && (
          <>
            <span style={{ color: "var(--muted-2)", fontSize: 14 }}>/</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              {currentSection.icon} {currentSection.title}
            </span>
            <span className="muted" style={{ fontSize: 13 }}>· {currentSection.desc}</span>
          </>
        )}
      </div>

      <AdminNav />

      <Routes>
        <Route index element={<AdminLanding />} />
        <Route path="expansions" element={<AdminExpansions />} />
        <Route path="cards" element={<AdminCards />} />
        <Route path="stock" element={<AdminStock />} />
        <Route path="packs" element={<AdminPacks />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="shipping" element={<AdminShipping />} />
        <Route path="decompose" element={<AdminDecompose />} />
        <Route path="charge" element={<AdminCharge />} />
      </Routes>
    </div>
  );
}
