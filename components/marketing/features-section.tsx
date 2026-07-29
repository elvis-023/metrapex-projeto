import { AnimateOnScroll } from "@/components/shared/animate-on-scroll";

const features = [
  {
    tag: "FORM",
    title: "Formulário público incorporável",
    description:
      "O cliente informa CPF ou CNPJ, escolhe os produtos e recebe o orçamento em PDF na hora, sem ninguém do time precisar agir.",
  },
  {
    tag: "TAX",
    title: "Motor de impostos configurável",
    description:
      "Cada tributo é uma regra por empresa, com hierarquia de alíquota produto > categoria > padrão — serve do Simples Nacional ao ICMS + IPI destacado.",
  },
  {
    tag: "PIPE",
    title: "Pipeline visual (Kanban)",
    description:
      "Acompanhe cada orçamento do gerado ao convertido, com follow-up e expiração automáticos, sem sair do CRM.",
  },
  {
    tag: "SEND",
    title: "PDF e envio automático",
    description:
      "Template de PDF configurável por empresa, enviado por e-mail (e WhatsApp nos planos superiores) assim que o orçamento é gerado.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-muted-foreground font-mono text-xs tracking-[0.14em] uppercase">
          O que carimba cada orçamento
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          Tudo entre o pedido e o orçamento na mão do cliente
        </h2>
        <p className="text-muted-foreground mt-3 text-balance">
          O KPI que importa é o tempo até o primeiro orçamento — cada peça existe para derrubar esse
          número.
        </p>
      </div>

      <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2">
        {features.map((feature, index) => (
          <AnimateOnScroll key={feature.title} delayMs={index * 100}>
            <div className="border-primary/25 hover:border-primary/60 -translate-y-0 border-l-2 border-dashed pl-5 transition-[border-color,transform] duration-300 hover:-translate-y-1">
              <span className="text-primary font-mono text-xs font-medium tracking-[0.1em]">
                [{feature.tag}]
              </span>
              <h3 className="mt-2 text-base font-medium">{feature.title}</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          </AnimateOnScroll>
        ))}
      </div>
    </section>
  );
}
