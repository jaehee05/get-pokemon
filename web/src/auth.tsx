import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { auth, db, googleProvider } from "./firebase";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOutNow: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
        // 프로필 동기화 (관리자 화면에서 유저 목록 표시용)
        try {
          await setDoc(
            doc(db, "users", u.uid),
            {
              displayName: u.displayName ?? "",
              email: u.email ?? "",
            },
            { merge: true }
          );
        } catch {
          // 룰 위반/오프라인 등은 무시 — 로그인 자체에는 영향 없음
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  const value: AuthState = {
    user,
    isAdmin,
    loading,
    signInGoogle: async () => {
      await signInWithPopup(auth, googleProvider);
    },
    signInEmail: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signUpEmail: async (email, password, displayName) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(auth, email);
    },
    signOutNow: async () => {
      await signOut(auth);
    },
    refreshClaims: async () => {
      if (!auth.currentUser) return;
      const token = await auth.currentUser.getIdTokenResult(true);
      setIsAdmin(token.claims.admin === true);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside <AuthProvider>");
  return ctx;
}
