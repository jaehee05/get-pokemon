import { FirebaseError } from "firebase/app";
import { FormEvent, useState } from "react";
import { useAuth } from "./auth";

type Mode = "login" | "signup";

export function AuthDialog({ onClose }: { onClose: () => void }) {
  const { signInGoogle, signInEmail, signUpEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      if (mode === "login") {
        await signInEmail(email, password);
      } else {
        await signUpEmail(email, password, displayName || undefined);
      }
      onClose();
    } catch (e: unknown) {
      setErr(humanizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setErr(null);
    try {
      await signInGoogle();
      onClose();
    } catch (e: unknown) {
      setErr(humanizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (!email) {
      setErr("비밀번호 재설정 메일을 받을 이메일을 입력해주세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await resetPassword(email);
      setInfo("비밀번호 재설정 메일을 보냈습니다. 받은편지함을 확인하세요.");
    } catch (e: unknown) {
      setErr(humanizeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{ width: "min(420px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ marginBottom: 12 }}>
          <button
            className={mode === "login" ? "" : "secondary"}
            onClick={() => setMode("login")}
            style={{ flex: 1 }}
          >
            로그인
          </button>
          <button
            className={mode === "signup" ? "" : "secondary"}
            onClick={() => setMode("signup")}
            style={{ flex: 1 }}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={submit} className="col">
          {mode === "signup" && (
            <label>
              표시 이름 (선택)
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Trainer"
              />
            </label>
          )}
          <label>
            이메일
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {err && <p style={{ color: "var(--danger)", margin: 0 }}>{err}</p>}
          {info && <p style={{ color: "var(--ok)", margin: 0 }}>{info}</p>}

          <button type="submit" disabled={busy}>
            {busy ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </button>

          {mode === "login" && (
            <button
              type="button"
              className="secondary"
              onClick={onReset}
              disabled={busy}
              style={{ fontSize: 12 }}
            >
              비밀번호 잊으셨나요?
            </button>
          )}
        </form>

        <div
          style={{
            margin: "16px 0 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--muted)",
            fontSize: 12,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          또는
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <button
          type="button"
          className="secondary"
          onClick={google}
          disabled={busy}
          style={{ width: "100%" }}
        >
          Google 계정으로 계속
        </button>
      </div>
    </div>
  );
}

function humanizeAuthError(e: unknown): string {
  if (e instanceof FirebaseError) {
    switch (e.code) {
      case "auth/email-already-in-use":
        return "이미 가입된 이메일입니다. 로그인 탭으로 이동해주세요.";
      case "auth/invalid-email":
        return "이메일 형식이 올바르지 않습니다.";
      case "auth/weak-password":
        return "비밀번호는 6자 이상이어야 합니다.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "이메일 또는 비밀번호가 일치하지 않습니다.";
      case "auth/too-many-requests":
        return "시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.";
      case "auth/popup-closed-by-user":
        return "로그인 창이 닫혔습니다.";
      case "auth/operation-not-allowed":
        return "이 로그인 방법이 Firebase 콘솔에서 활성화되어있지 않습니다.";
      default:
        return `오류: ${e.code}`;
    }
  }
  return e instanceof Error ? e.message : String(e);
}
