import {
  Timestamp,
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { InventoryEditor } from "./InventoryEditor";
import { db, functions } from "../firebase";

interface UserRow {
  uid: string;
  displayName?: string;
  email?: string;
  currency?: number;
  isAdmin?: boolean;
  createdAt?: Timestamp;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filter, setFilter] = useState("");
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [pendingAmount, setPendingAmount] = useState<Record<string, number>>({});
  const [editingUid, setEditingUid] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "users"));
    return onSnapshot(q, (snap) => {
      setUsers(
        snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserRow, "uid">) }))
      );
    });
  }, []);

  async function grant(uid: string, amount: number) {
    if (!Number.isFinite(amount) || amount === 0) return;
    setBusyUid(uid);
    try {
      await httpsCallable<{ targetUid: string; amount: number }, { ok: boolean }>(
        functions,
        "grantCurrency"
      )({ targetUid: uid, amount });
      setPendingAmount((p) => ({ ...p, [uid]: 0 }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyUid(null);
    }
  }

  const filtered = users.filter((u) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (
      u.uid.toLowerCase().includes(f) ||
      (u.displayName ?? "").toLowerCase().includes(f) ||
      (u.email ?? "").toLowerCase().includes(f)
    );
  });

  const editingUser = users.find((u) => u.uid === editingUid) ?? null;

  return (
    <div className="col">
      <div className="panel">
        <h2 className="h2">유저 목록 ({users.length})</h2>
        <div className="row">
          <input
            placeholder="UID / 이름 / 이메일 검색"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <span className="muted" style={{ fontSize: 12 }}>
            * 한 번이라도 로그인한 사용자만 표시됩니다.
          </span>
        </div>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일/UID</th>
              <th style={{ textAlign: "right" }}>잔액</th>
              <th>지급</th>
              <th>컬렉션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const amt = pendingAmount[u.uid] ?? 0;
              return (
                <tr key={u.uid}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {u.displayName || "—"}
                      {u.isAdmin && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 999,
                            background: "var(--accent)",
                            color: "#1a1a1a",
                            fontWeight: 800,
                          }}
                        >
                          ADMIN
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>{u.email || "—"}</div>
                    <code className="mini">{u.uid}</code>
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {u.currency ?? 0}
                  </td>
                  <td>
                    <div className="row">
                      <input
                        type="number"
                        value={amt === 0 ? "" : amt}
                        placeholder="0"
                        onChange={(e) => {
                          const v = e.target.value;
                          setPendingAmount((p) => ({
                            ...p,
                            [u.uid]: v === "" ? 0 : Number(v),
                          }));
                        }}
                        style={{ width: 100 }}
                      />
                      <button
                        onClick={() => grant(u.uid, amt)}
                        disabled={busyUid === u.uid || amt === 0}
                      >
                        {busyUid === u.uid ? "..." : amt < 0 ? "차감" : "지급"}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => grant(u.uid, 100)}
                        disabled={busyUid === u.uid}
                        style={{ fontSize: 12 }}
                      >
                        +100
                      </button>
                      <button
                        className="secondary"
                        onClick={() => grant(u.uid, 1000)}
                        disabled={busyUid === u.uid}
                        style={{ fontSize: 12 }}
                      >
                        +1000
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() => setEditingUid(u.uid)}
                    >
                      편집
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <InventoryEditor
          uid={editingUser.uid}
          displayName={editingUser.displayName || editingUser.email || editingUser.uid}
          onClose={() => setEditingUid(null)}
        />
      )}
    </div>
  );
}
