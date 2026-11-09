import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseClient } from "../lib/firebase";
import { toggleFavorite } from "../lib/account";

type Props = {
  itemId: string;
  title: string;
  kind: "app" | "tool" | "article" | "section";
  href: string;
};

export default function FavoriteButton({ itemId, title, kind, href }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const { auth, db } = getFirebaseClient();
    let stopFavorite: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (currentUser) => {
      stopFavorite?.();
      stopFavorite = undefined;
      setUser(currentUser);
      setSaved(false);
      setMessage("");
      if (!currentUser) return;
      stopFavorite = onSnapshot(
        doc(db, "users", currentUser.uid, "favorites", itemId),
        (favorite) => setSaved(favorite.exists()),
        () => setMessage("Não foi possível sincronizar este favorito."),
      );
    });
    return () => { stopAuth(); stopFavorite?.(); };
  }, [itemId]);

  async function handleToggle() {
    if (!user) {
      setMessage("Inicia sessão para guardares este item.");
      return;
    }
    if (busy) return;

    setBusy(true);
    setMessage("");
    try {
      const nextSaved = await toggleFavorite(user, {
        id: itemId,
        title,
        kind,
        href,
      });
      setSaved(nextSaved);
      setMessage(nextSaved ? "Guardado nos favoritos." : "Removido dos favoritos.");
      window.dispatchEvent(new Event("nexauren:favorites-updated"));
    } catch {
      setMessage("Não foi possível atualizar os favoritos. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="favorite-control">
      <button
        type="button"
        className={`favorite-button ${saved ? "is-saved" : ""}`}
        onClick={handleToggle}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? `Remover ${title} dos favoritos` : `Guardar ${title} nos favoritos`}
      >
        <span aria-hidden="true">{saved ? "★" : "☆"}</span>
        {busy ? "A guardar…" : saved ? "Guardado" : "Guardar"}
      </button>
      {message && <span className="favorite-feedback" role="status">{message}</span>}
    </div>
  );
}
