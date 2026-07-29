import type { Metadata } from "next";

const description = "Como o Trezofy coleta, usa e protege dados de organizações e clientes finais.";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description,
  openGraph: {
    title: "Política de Privacidade | Trezofy",
    description,
    siteName: "Trezofy",
    type: "website",
    locale: "pt_BR",
  },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-prose px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Política de Privacidade</h1>
      <p className="text-muted-foreground mt-2 text-sm">Última atualização: a definir.</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed">
        <p>
          Este é um texto placeholder. A Política de Privacidade definitiva do Trezofy será redigida
          por um profissional jurídico, em conformidade com a LGPD, antes do lançamento em produção,
          e substituirá este conteúdo.
        </p>

        <section>
          <h2 className="text-lg font-medium">1. Dados que coletamos</h2>
          <p className="text-muted-foreground mt-2">
            Dados de cadastro da organização e dos usuários (nome, e-mail), dados de clientes finais
            informados no formulário público (CPF/CNPJ, endereço) e dados de uso da plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">2. Como usamos os dados</h2>
          <p className="text-muted-foreground mt-2">
            Os dados são usados para gerar orçamentos, calcular impostos, emitir PDFs, enviar
            comunicações relacionadas ao serviço e manter o isolamento entre organizações.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">3. Compartilhamento com terceiros</h2>
          <p className="text-muted-foreground mt-2">
            Utilizamos provedores como Supabase (banco de dados e armazenamento), Resend (e-mail),
            PDFMonkey (geração de PDF) e Stripe (pagamento), cada um processando apenas os dados
            necessários à sua função.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">4. Direitos do titular</h2>
          <p className="text-muted-foreground mt-2">
            Titulares de dados podem solicitar acesso, correção ou exclusão de suas informações,
            conforme a Lei Geral de Proteção de Dados (LGPD).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">5. Segurança</h2>
          <p className="text-muted-foreground mt-2">
            Adotamos isolamento por organização via Row Level Security no banco de dados e controles
            de acesso por papel (admin/vendedor).
          </p>
        </section>
      </div>
    </article>
  );
}
