import { Timestamp, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { db } from "./firebase";

export interface UserProfile {
  displayName?: string;
  email?: string;
  currency?: number;
  isAdmin?: boolean;
  createdAt?: Timestamp;
}

/**
 * 현재 로그인된 유저의 Firestore user doc 를 실시간 구독.
 * 로그인 안 된 상태면 null.
 */
export function useProfile(): UserProfile | null {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    return onSnapshot(doc(db, "users", user.uid), (s) => {
      setProfile(s.exists() ? (s.data() as UserProfile) : null);
    });
  }, [user]);

  return profile;
}

/** 1234 → "1,234". 음수도 처리. */
export function formatCurrency(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "0";
  return n.toLocaleString("ko-KR");
}
