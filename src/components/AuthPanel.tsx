import { useEffect, useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  sendPasswordResetEmail,
  signOut,
  type User,
} from "firebase/auth";
import type { Timestamp } from "firebase/firestore";
import { getFirebaseClient } from "../lib/firebase";
import {
  ensureUserProfile,
  getAccountOverview,
  type AccountOverview,
} from "../lib/account";

const emptyOverview: AccountOverview = { favorites: [], activity: [] };

function readableAuthError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Este e-mail já tem uma conta. Experimenta iniciar sessão.",
    "auth/invalid-credential": "E-mail ou palavra-passe incorretos.",
    "auth/invalid-email": "O endereço de e-mail não é válido.",
    "auth/weak-password": "Escolhe uma palavra-passe com pelo menos 6 caracteres.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/too-many-requests": "Demasiadas tentativas. Tenta novamente mais tarde.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes de terminar.",
    "auth/popup-blocked": "O navegador bloqueou a janela. Permite pop-ups e tenta novamente.",
    "auth/unauthorized-domain": "Este domínio ainda não está autorizado no Firebase Authentication.",
    "auth/operation-not-allowed": "Este método de autenticação ainda não está ativado no Firebase.",
    "auth/network-request-failed": "Falha de ligação. Verifica a Internet e tenta novamente.",
  };

  return messages[code] ?? "Não foi possível concluir a operação. Tenta novamente.";
}

function formatDate(value?: Timestamp): string {
  if (!value) return "";
  return value.toDate().toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
  });
}

export default function AuthPanel() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [overview, setOverview] = useState<AccountOverview>(emptyOverview);

  useEffect(() => {
    if (!user) return;
    const refreshOverview = () => {
      void getAccountOverview(user).then(setOverview).catch(() => undefined);
    };
    window.addEventListener("nexauren:favorites-updated", refreshOverview);
    return () => window.removeEventListener("nexauren:favorites-updated", refreshOverview);
  }, [user]);

  useEffect(() => {
    const { auth } = getFirebaseClient();
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setMessage("");
      if (!currentUser) {
        setOverview(emptyOverview);
        setChecking(false);
        return;
      }

      setChecking(true);
      try {
        await ensureUserProfile(currentUser);
        const data = await getAccountOverview(currentUser);
        setOverview(data);
      } catch {
        setMessage(
          "A sessão está ativa, mas não foi possível sincronizar o perfil. Confirma as regras do Firestore.",
        );
      } finally {
        setChecking(false);
      }
    });
  }, []);

  async function perform(action: () => Promise<unknown>, successMessage = "Pedido concluído.") {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(successMessage);
    } catch (error) {
      setMessage(readableAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { auth } = getFirebaseClient();
    void perform(() =>
      mode === "register"
        ? createUserWithEmailAndPassword(auth, email.trim(), password)
        : signInWithEmailAndPassword(auth, email.trim(), password),
    );
  }

  function continueWithGoogle() {
    const { auth, googleProvider } = getFirebaseClient();
    googleProvider.setCustomParameters({ prompt: "select_account" });
    const mobileBrowser = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);\n    void perform(() =>\n      mobileBrowser\n        ? signInWithRedirect(auth, googleProvider)\n        : signInWithPopup(auth, googleProvider),\n    );
  }

  function leaveAccount() {
    const { auth } = getFirebaseClient();
    void perform(() => signOut(auth));
  }

  function resetPassword() {
    if (!email.trim()) {
      setMessage("Escreve primeiro o teu e-mail para receberes o link de recuperação.");
      return;
    }
    const { auth } = getFirebaseClient();
    void perform(
      () => sendPasswordResetEmail(auth, email.trim()),
      "Enviámos um link de recuperação para o teu e-mail.",
    );
  }

  if (checking) {
    return (
      <section className="auth-panel auth-loading" aria-live="polite">
        <span className="loading-orbit" />
        <p>A sincronizar o teu espaço seguro…</p>
      </section>
    );
  }

  if (user) {
    const displayName =
      user.displayName ?? user.email?.split("@")[0] ?? "Utilizador";

    return (
      <section className="auth-panel account-dashboard">
        <div className="eyebrow"><i className="status-dot" /> CONTA LIGADA</div>
        <div className="signed-user">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="user-avatar">{displayName.charAt(0).toUpperCase()}</span>
          )}
          <div>
            <h2>{displayName}</h2>
            <p>{user.email ?? "Conta Google"}</p>
          </div>
          <button className="signout-button" onClick={leaveAccount} disabled={busy}>
            {busy ? "A sair…" : "Terminar sessão"}
          </button>
        </div>

        <div className="account-stats">
          <div><b>{overview.favorites.length}</b><span>Favoritos</span></div>
          <div><b>{overview.activity.length}</b><span>Atividades recentes</span></div>
        </div>

        <div className="account-data-grid">
          <div className="account-data-section">
            <div className="account-section-heading"><h3>Os teus favoritos</h3><span>GUARDADOS</span></div>
            {overview.favorites.length ? (
              <ul className="account-items">
                {overview.favorites.map((item) => (
                  <li key={item.id}>
                    <a href={item.href}>{item.title}<span>↗</span></a>
                    <small>{formatDate(item.savedAt)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-account">Ainda não guardaste nenhum item. Usa o botão “Guardar” nos cartões do site.</p>
            )}
          </div>
          <div className="account-data-section">
            <div className="account-section-heading"><h3>Atividade recente</h3><span>HISTÓRICO</span></div>
            {overview.activity.length ? (
              <ul className="account-items">
                {overview.activity.map((item) => (
                  <li key={item.id}>
                    <a href={item.href}>{item.title}<span>↗</span></a>
                    <small>{formatDate(item.usedAt)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-account">As secções que visitares através dos cartões serão registadas aqui.</p>
            )}
          </div>
        </div>
        {message && <p className="auth-message" role="status">{message}</p>}
      </section>
    );
  }

  return (
    <section className="auth-panel">
      <div className="eyebrow"><i className="status-dot" /> CONTA NEXAUREN</div>
      <h2>{mode === "login" ? "Entra no teu espaço." : "Cria a tua conta."}</h2>
      <p className="muted">
        Guarda favoritos, acompanha a tua atividade e personaliza a experiência.
      </p>
      <button className="google-button" disabled={busy} onClick={continueWithGoogle}>
        <b>G</b> {busy ? "A processar…" : "Continuar com Google"}
      </button>
      <div className="or"><span /> ou com e-mail <span /></div>
      <form onSubmit={submit}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nome@exemplo.com"
        />
        <label htmlFor="password">Palavra-passe</label>
        <input
          id="password"
          type="password"
          minLength={6}
          required
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mínimo de 6 caracteres"
        />
        {mode === "login" && (
          <button type="button" className="forgot-button" onClick={resetPassword} disabled={busy}>
            Esqueceste a palavra-passe?
          </button>
        )}
        <button className="button primary full" disabled={busy}>
          {busy
            ? "A processar…"
            : mode === "login"
              ? "Iniciar sessão"
              : "Criar conta"}
        </button>
      </form>
      {message && <p className="auth-message" role="status">{message}</p>}
      <p className="switch">
        {mode === "login" ? "Ainda não tens conta?" : "Já tens uma conta?"}{" "}
        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setMessage("");
          }}
        >
          {mode === "login" ? "Regista-te" : "Entrar"}
        </button>
      </p>
      <small>A tua conta e os teus dados pessoais são guardados no Firebase.</small>
    </section>
  );
}
