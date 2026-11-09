import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { getFirebaseClient } from "../lib/firebase";
import { recordActivity } from "../lib/account";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  activityId: string;
  activityTitle: string;
};

export default function TrackedLink({
  activityId,
  activityTitle,
  href = "/",
  onClick,
  children,
  ...props
}: Props) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const { auth } = getFirebaseClient();
    const user = auth.currentUser;
    if (user) {
      void recordActivity(user, {
        id: activityId,
        title: activityTitle,
        kind: "section",
        href: String(href),
      }).catch(() => undefined);
    }
  }

  return <a {...props} href={href} onClick={handleClick}>{children}</a>;
}
