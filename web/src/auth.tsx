import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { auth, googleProvider } from "./firebase";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
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
    signIn: async () => {
      await signInWithPopup(auth, googleProvider);
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
