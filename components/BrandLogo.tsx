import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  heightClass = "h-8",
  alt = "Plorix",
}: {
  className?: string;
  heightClass?: string;
  alt?: string;
}) {
  const imageClass = cn("h-auto w-auto max-w-full object-contain", heightClass);

  return (
    <span className={cn("inline-flex items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/plorix-logo-dark.png"
        alt={alt}
        className={cn(imageClass, "dark:hidden")}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/plorix-logo-white.png"
        alt=""
        className={cn(imageClass, "hidden dark:block")}
      />
    </span>
  );
}
