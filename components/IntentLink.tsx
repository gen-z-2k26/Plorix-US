"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type ComponentProps } from "react";

type IntentLinkProps = Omit<ComponentProps<typeof Link>, "prefetch">;

/**
 * Prefetches on hover, focus, or touch instead of when the link scrolls into
 * view. Product grids render dozens of links, and viewport prefetch turned
 * each page view into dozens of page renders.
 */
export function IntentLink({
  href,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: IntentLinkProps) {
  const router = useRouter();
  const prefetched = useRef(false);

  function prefetch() {
    if (prefetched.current || typeof href !== "string") return;
    prefetched.current = true;
    router.prefetch(href);
  }

  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onMouseEnter={(event) => {
        prefetch();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        prefetch();
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        prefetch();
        onTouchStart?.(event);
      }}
    />
  );
}
