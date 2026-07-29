import Link from "next/link";

import { cn } from "@/lib/utils";

const sizeClasses = {
  lg: { text: "text-2xl", line: "h-[3px] -bottom-1.5" },
  md: { text: "text-base", line: "h-[2px] -bottom-1" },
  sm: { text: "text-sm", line: "h-px -bottom-0.5" },
} as const;

type LogoProps = {
  size?: keyof typeof sizeClasses;
  /** `null` renderiza sem link — uso no rodapé, que não é clicável hoje. */
  href?: string | null;
  className?: string;
};

export function Logo({ size = "md", href = "/", className }: LogoProps) {
  const sizes = sizeClasses[size];

  const content = (
    <span
      className={cn(
        "font-heading relative inline-block font-bold tracking-tight",
        sizes.text,
        className,
      )}
    >
      Trezo<span className="text-primary">fy</span>
      <span
        aria-hidden="true"
        className={cn(
          "animate-flow-pulse via-primary absolute left-0 w-full rounded-full bg-gradient-to-r from-transparent to-transparent",
          sizes.line,
        )}
      />
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="tracking-tight">
      {content}
    </Link>
  );
}
