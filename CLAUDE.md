# Meu Projeto — briefing do produto

SaaS multiempresa de geração automática de orçamentos. Junta um formulário público incorporável (cliente pede orçamento no site e recebe PDF na hora) com um CRM enxuto de pipeline visual para o time de vendas. O PRD completo está em [docs/PRD.md](docs/PRD.md) — leia lá antes de decisões de escopo ou de UX.

O KPI central do produto é **tempo até o primeiro orçamento** (do pedido do cliente até o orçamento na mão dele). Toda decisão de arquitetura que adicionar latência nesse caminho (formulário público → cálculo → PDF → envio) deve ser questionada.

## Stack técnico

- **Frontend + backend**: Next.js (App Router), API Routes / Route Handlers, TypeScript estrito.
- **UI**: React, Tailwind CSS, shadcn/ui.
- **Dados/auth/storage**: Supabase — PostgreSQL com Row Level Security (isolamento entre organizações), Supabase Auth (login), Supabase Storage (PDFs gerados).
- **Pagamento da assinatura**: Stripe — checkout, webhook de ativação/desativação de plano, portal de gerenciamento.
- **E-mail transacional**: Resend — envio de orçamento, convite de colaborador, follow-up, e e-mails de auth via SMTP customizado no Supabase Auth.
- **Geração de PDF**: PDFMonkey, template configurável por organização.
- **Automação assíncrona**: n8n — **só** envio de e-mail/WhatsApp e rotinas agendadas (follow-up, expiração). O cálculo do orçamento roda sempre no backend Next.js, nunca no n8n.
- **APIs externas do formulário público**: BrasilAPI (CNPJ), ViaCEP (CEP), Cloudflare Turnstile (captcha invisível).
- **Deploy**: Vercel (app) + Supabase (banco).

## Módulo motor de impostos

O motor de impostos configurável (diferencial central do produto — hierarquia de alíquota produto > categoria > padrão da organização, modos `inclusive`/`exclusive`, snapshot no documento emitido) já tem briefing técnico e tooling dedicados neste repo. **Não reimplemente esse conhecimento aqui** — consulte:

- [briefing-motor-impostos.md](briefing-motor-impostos.md) — schema, fórmulas, exemplos numéricos, escopo do V1 e perguntas em aberto.
- Skills: `calculo-tributario`, `schema-tributario`, `casos-teste-fiscais`, `snapshot-documento`, `decisao-pendente`, `escopo-v1`.
- Agents (read-only, revisão/consulta): `auditor-resolve-rate`, `revisor-invariantes`, `revisor-precisao-monetaria`, `consultor-briefing`.

Use esses skills/agents sempre que o trabalho tocar cálculo de imposto, schema fiscal, ou o documento de orçamento pós-emissão — eles carregam o contexto certo em vez de você reconstruí-lo.

## Convenções de código

- TypeScript estrito em todo o projeto; sem `any` implícito.
- App Router: Server Components por padrão; Client Components só onde há interatividade real (formulários, drag-and-drop do Kanban, etc.).
- Toda rota/query autenticada resolve a organização (workspace) a partir da sessão antes de tocar dados — nunca confie em um `org_id` vindo do client sem validar contra RLS.
- O endpoint do formulário público nunca escreve direto no banco a partir de input do cliente sem passar pela validação de backend (dedupe de cliente, cálculo, geração de PDF).
- Dinheiro nunca em `number` de ponto flutuante puro — ver convenção de precisão em [briefing-motor-impostos.md](briefing-motor-impostos.md#3-modelo-de-dados).
- Sem comentários explicando o óbvio; sem abstração para casos hipotéticos; sem feature flags/shims de compatibilidade — mude o código direto.

## Estrutura de pastas (proposta)

```
app/
  (marketing)/        # landing page, termos, privacidade — público, sem auth
  (public-form)/       # formulário incorporável de orçamento — público, sem auth
  (app)/                # painel autenticado: dashboard, kanban, catálogo, clientes, config
    api/                # route handlers internos (autenticados)
  api/
    public-quote/       # endpoint do formulário público (validação, antispam, cálculo, PDF, envio)
    webhooks/           # Stripe, etc.
lib/
  tax-engine/           # motor de impostos (ver briefing-motor-impostos.md)
  quotes/                # motor de orçamento (subtotal, snapshot, versionamento)
  supabase/              # clients (server/browser), tipos gerados
  integrations/          # BrasilAPI, ViaCEP, Turnstile, Resend, PDFMonkey, Stripe
components/
  ui/                    # shadcn/ui
  kanban/, catalog/, quotes/, dashboard/  # componentes de domínio
docs/
  PRD.md
briefing-motor-impostos.md
```

## Identidade visual (proposta inicial — ajustar quando houver definição de marca)

Tom: SaaS B2B enxuto e denso, sem elementos decorativos — prioriza legibilidade de dados (tabelas, cards de Kanban, dashboards) sobre estética vistosa. Referências de UX: Pipedrive (fluidez do pipeline) e HubSpot (organização), simplificados.

- **Paleta**: base neutra (grafite/cinza em vez de preto puro, fundo quase-branco), com **uma** accent color de marca para CTAs, estados ativos e o pipeline. Cores semânticas separadas da accent color (verde=convertido, âmbar=expirando, vermelho=expirado) para não colidir com a marca.
- **Tipografia**: uma família sans-serif (ex.: Inter, já comum em shadcn/ui), pesos limitados (regular/medium/semibold). Números (preços, totais) em tabular figures para alinhar em tabelas e cards.
- **Densidade**: espaçamento compacto nas telas de dados (Kanban, tabelas de orçamento, catálogo); espaçamento mais aberto só na landing page e no onboarding.
- **Componentização**: shadcn/ui como base; variações de marca via tokens do Tailwind (`tailwind.config`), não componentes duplicados.

## Personas (para orientar decisões de UX)

- **Admin**: configura organização, imposto, catálogo, pagamento, convites e plano. Acesso total.
- **Vendedor**: cria orçamento manual, opera o Kanban, faz follow-up. Pode estar em mais de uma organização.
- **Cliente final**: sem login, preenche o formulário público — metade do valor do produto está na experiência dele.
- **Freelancer/consultor solo**: admin sozinho, workspace por cliente/projeto, começa no plano de entrada.

## Processo

Construir em milestones incrementais, cada um um entregável testável — priorizar o núcleo (formulário público → cálculo → PDF → envio, e o Kanban básico) antes de relatórios, automações e integrações avançadas. Testar cada milestone antes de avançar para o próximo.
