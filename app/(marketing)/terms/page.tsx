import type { Metadata } from "next";

const description = "Condições de uso da plataforma Trezofy.";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description,
  openGraph: {
    title: "Termos de Uso | Trezofy",
    description,
    siteName: "Trezofy",
    type: "website",
    locale: "pt_BR",
  },
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-prose px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Termos de Uso</h1>
      <p className="text-muted-foreground mt-2 text-sm">Última atualização: a definir.</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed">
        <p>
          Este é um texto placeholder. Os Termos de Uso definitivos do Trezofy serão redigidos por
          um profissional jurídico antes do lançamento em produção e substituirão este conteúdo.
        </p>

        <section>
          <h2 className="text-lg font-medium">1. Aceitação dos termos</h2>
          <p className="text-muted-foreground mt-2">
            Ao criar uma conta ou utilizar o Trezofy, você concorda com estes Termos de Uso e com a
            nossa Política de Privacidade.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">2. Uso do serviço</h2>
          <p className="text-muted-foreground mt-2">
            O Trezofy é um serviço de geração de orçamentos e gestão de pipeline de vendas
            oferecido por assinatura, sujeito aos limites e recursos de cada plano.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">3. Conta e responsabilidades</h2>
          <p className="text-muted-foreground mt-2">
            Cada organização é responsável pela veracidade dos dados cadastrados, pela configuração
            de suas regras fiscais e pelo uso adequado do formulário público incorporável.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">4. Assinatura e cobrança</h2>
          <p className="text-muted-foreground mt-2">
            Planos são cobrados de forma recorrente, com limites de vendedores e de orçamentos
            mensais conforme o plano contratado, podendo ser cancelados a qualquer momento.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">5. Alterações nestes termos</h2>
          <p className="text-muted-foreground mt-2">
            Podemos atualizar estes termos periodicamente. Mudanças relevantes serão comunicadas aos
            usuários com antecedência razoável.
          </p>
        </section>
      </div>
    </article>
  );
}
