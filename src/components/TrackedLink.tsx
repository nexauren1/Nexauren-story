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
  target,
  children,
  ...props
}: Props) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      target === "_blank" ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    const { auth } = getFirebaseClient();
    const user = auth.currentUser;
    if (!user) return;

    // Persist the activity before navigating so it is not lost during page unload.
    event.preventDefault();
    void recordActivity(user, {
      id: activityId,
      title: activityTitle,
      kind: "section",
      href: String(href),
    })
      .catch(() => undefined)
      .finally(() => window.location.assign(String(href)));
  }

  return <a {...props} href={href} target={target} onClick={handleClick}>{children}</a>;
}
