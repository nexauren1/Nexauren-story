import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseClient } from "../lib/firebase";

export default function AccountLink() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const { auth } = getFirebaseClient();
    return onAuthStateChanged(auth, setUser);
  }, []);
  const label = user?.displayName?.trim().split(/\s+/)[0] ?? user?.email?.split("@")[0] ?? "Entrar";
  return (
    <a className={user ? "account-link is-authenticated" : "account-link"} href="/account" aria-label={user ? "Abrir a minha conta" : "Entrar na conta"}>
      {user ? <span className="account-link-dot" aria-hidden="true"/> : null}
      <span className="account-link-label">{user ? label : "Entrar"}</span>
      <span className="account-link-arrow" aria-hidden="true">↗</span>
    </a>
  );
}