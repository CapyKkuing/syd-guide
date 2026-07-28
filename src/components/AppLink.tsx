import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import { pathForApp } from "../app/basePath";
import { navigate } from "../app/router";

type AppLinkProps = ComponentPropsWithoutRef<"a"> & {
  onNavigate?: () => void;
};

function isSameAppPath(href: string | undefined): href is string {
  if (!href?.startsWith("/") || href.startsWith("//")) return false;
  return new URL(href, window.location.href).origin === window.location.origin;
}

export function AppLink({
  download,
  href,
  onClick,
  onNavigate,
  target,
  ...props
}: AppLinkProps) {
  const appHref = isSameAppPath(href) ? pathForApp(href) : href;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    const hasModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    const hasDownload = download !== undefined && download !== false;

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      hasModifier ||
      target !== undefined ||
      hasDownload ||
      !isSameAppPath(appHref)
    ) {
      return;
    }

    event.preventDefault();
    onNavigate?.();
    navigate(appHref);
  };

  return <a {...props} download={download} href={appHref} onClick={handleClick} target={target} />;
}
