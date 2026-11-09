import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseClient } from "./firebase";

export type FavoriteInput = {
  id: string;
  title: string;
  kind: "app" | "tool" | "article" | "section";
  href: string;
};

export type FavoriteRecord = FavoriteInput & {
  savedAt?: Timestamp;
};

export type ActivityInput = {
  id: string;
  title: string;
  kind: "section" | "tool";
  href: string;
};

export type ActivityRecord = ActivityInput & {
  usedAt?: Timestamp;
};

export type AccountOverview = {
  favorites: FavoriteRecord[];
  activity: ActivityRecord[];
};

export async function ensureUserProfile(user: User): Promise<void> {
  const { db } = getFirebaseClient();
  const profileRef = doc(db, "users", user.uid);
  const current = await getDoc(profileRef);
  const previousCreatedAt = current.exists()
    ? current.data().createdAt ?? serverTimestamp()
    : serverTimestamp();

  await setDoc(
    profileRef,
    {
      uid: user.uid,
      email: user.email ?? "",
      displayName:
        user.displayName ?? user.email?.split("@")[0] ?? "Utilizador",
      photoURL: user.photoURL ?? null,
      providerIds: user.providerData.map((provider) => provider.providerId),
      createdAt: previousCreatedAt,
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function toggleFavorite(
  user: User,
  item: FavoriteInput,
): Promise<boolean> {
  const { db } = getFirebaseClient();
  const favoriteRef = doc(db, "users", user.uid, "favorites", item.id);
  const existing = await getDoc(favoriteRef);

  if (existing.exists()) {
    await deleteDoc(favoriteRef);
    return false;
  }

  await setDoc(favoriteRef, {
    ...item,
    savedAt: serverTimestamp(),
  });
  return true;
}

export async function recordActivity(
  user: User,
  activity: ActivityInput,
): Promise<void> {
  const { db } = getFirebaseClient();
  await addDoc(collection(db, "users", user.uid, "toolHistory"), {
    ...activity,
    usedAt: serverTimestamp(),
  });
}

export async function getAccountOverview(
  user: User,
): Promise<AccountOverview> {
  const { db } = getFirebaseClient();
  const favoritesRef = collection(db, "users", user.uid, "favorites");
  const historyRef = collection(db, "users", user.uid, "toolHistory");

  const [favoritesSnapshot, historySnapshot] = await Promise.all([
    getDocs(query(favoritesRef, orderBy("savedAt", "desc"), limit(20))),
    getDocs(query(historyRef, orderBy("usedAt", "desc"), limit(6))),
  ]);

  return {
    favorites: favoritesSnapshot.docs.map((entry) => ({
      ...(entry.data() as Omit<FavoriteRecord, "id">),
      id: entry.id,
    })),
    activity: historySnapshot.docs.map((entry) => ({
      ...(entry.data() as Omit<ActivityRecord, "id">),
      id: entry.id,
    })),
  };
}
