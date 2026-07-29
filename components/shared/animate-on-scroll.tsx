"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type AnimateOnScrollProps = {
  children: ReactNode;
  className?: string;
  /** Atraso em ms depois que o elemento entra no viewport — para o efeito stagger entre irmãos. */
  delayMs?: number;
};

export function AnimateOnScroll({ children, className, delayMs = 0 }: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    let timeoutId: number | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        timeoutId = window.setTimeout(() => setIsVisible(true), delayMs);
        observer.disconnect();
      },
      { threshold: 0.15 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeoutId);
    };
  }, [delayMs]);

  return (
    <div ref={ref} className={cn("animate-on-scroll", isVisible && "is-visible", className)}>
      {children}
    </div>
  );
}
