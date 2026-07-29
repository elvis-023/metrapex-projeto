import { AnimateOnScroll } from "@/components/shared/animate-on-scroll";
import { CaseMetricCard, type CaseMetric } from "@/components/marketing/case-metric-card";

const illustrativeCases: CaseMetric[] = [
  {
    company: "NexTech Solutions",
    segment: "Distribuidora",
    label: "Taxa de conversão",
    value: 47,
    prefix: "+",
    suffix: "%",
  },
  {
    company: "Órbita Digital",
    segment: "Consultoria",
    label: "Mais orçamentos qualificados",
    value: 3.2,
    suffix: "x",
    decimals: 1,
  },
  {
    company: "CloudBridge Inc.",
    segment: "Indústria",
    label: "Tempo de ciclo de venda",
    value: 62,
    prefix: "-",
    suffix: "%",
  },
];

export function SuccessCases() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-muted-foreground font-mono text-xs tracking-[0.14em] uppercase">
          Exemplo ilustrativo
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          O que um pipeline mais rápido parece, na prática
        </h2>
        <p className="text-muted-foreground mt-3 text-balance">
          Cenários ilustrativos de uso do Trezofy — ainda não são cases publicados de clientes
          reais.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {illustrativeCases.map((metric, index) => (
          <AnimateOnScroll key={metric.company} delayMs={index * 100}>
            <CaseMetricCard metric={metric} index={index} />
          </AnimateOnScroll>
        ))}
      </div>
    </section>
  );
}
