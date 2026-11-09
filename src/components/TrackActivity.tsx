import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseClient } from "../lib/firebase";
import { recordActivity } from "../lib/account";

type Props = { activityId: string; activityTitle: string; href?: string };
export default function TrackActivity({ activityId, activityTitle, href }: Props) {
  useEffect(() => {
    const { auth } = getFirebaseClient();
    return onAuthStateChanged(auth, (user) => {
      if (!user) return;
      void recordActivity(user, {
        id: activityId,
        title: activityTitle,
        kind: "tool",
        href: href ?? window.location.pathname,
      }).catch(() => undefined);
    });
  }, [activityId, activityTitle, href]);
  return null;
}
