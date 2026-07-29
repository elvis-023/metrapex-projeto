"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function useCountUp(target: number, durationMs = 1500) {
  const ref = useRef<HTMLDivElement>(null);
  const [animatedValue, setAnimatedValue] = useState(0);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion) return;

    let frameId: number | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();

        function tick(now: number) {
          const progress = Math.min((now - start) / durationMs, 1);
          const eased = 1 - (1 - progress) ** 3;
          setAnimatedValue(target * eased);
          if (progress < 1) frameId = requestAnimationFrame(tick);
        }

        frameId = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frameId !== undefined) cancelAnimationFrame(frameId);
    };
  }, [target, durationMs, prefersReducedMotion]);

  return { ref, value: prefersReducedMotion ? target : animatedValue };
}

export type CaseMetric = {
  company: string;
  segment: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
};

/** Delay negativo do `case-float` — dessincroniza a flutuação entre os cards (Trezofy design scope §03). */
const floatDelayByIndex = ["0s", "-1.2s", "-2.4s"];

export function CaseMetricCard({ metric, index }: { metric: CaseMetric; index: number }) {
  const { ref, value } = useCountUp(metric.value);

  return (
    <div
      ref={ref}
      className="glass-card animate-case-float flex flex-col items-center gap-1 rounded-xl p-6 text-center"
      style={{ animationDelay: floatDelayByIndex[index % floatDelayByIndex.length] }}
    >
      <span className="font-heading text-primary text-4xl font-extrabold tabular-nums">
        {metric.prefix}
        {value.toFixed(metric.decimals ?? 0)}
        {metric.suffix}
      </span>
      <span className="text-sm font-medium">{metric.label}</span>
      <span className="text-muted-foreground font-mono text-xs">{metric.company}</span>
    </div>
  );
}
