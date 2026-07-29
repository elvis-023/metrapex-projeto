export function WaveSeparator() {
  return (
    <div aria-hidden="true" className="relative h-10 overflow-hidden">
      <svg
        viewBox="0 0 2400 50"
        preserveAspectRatio="none"
        className="animate-wave-scroll absolute inset-0 h-full w-[200%]"
      >
        <path
          d="M0,25 C200,50 400,0 600,25 C800,50 1000,0 1200,25 C1400,50 1600,0 1800,25 C2000,50 2200,0 2400,25 L2400,50 L0,50 Z"
          style={{ fill: "color-mix(in oklch, var(--primary) 6%, transparent)" }}
        />
      </svg>
    </div>
  );
}
