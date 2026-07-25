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

## Identidade visual

Tom: SaaS B2B enxuto e denso, sem elementos decorativos — prioriza legibilidade de dados (tabelas, cards de Kanban, dashboards) sobre estética vistosa. Referências de UX: Pipedrive (fluidez do pipeline) e HubSpot (organização), simplificados.

A direção visual é ancorada no próprio artefato que o produto emite: o orçamento é um documento numerado sequencialmente por organização (ver PRD > Motor de orçamento), então o vocabulário vem do talão de orçamento/nota — numeração de protocolo, algarismos tabulares, carimbo de aprovação — em vez de um look genérico de SaaS.

- **Paleta**: base "papel" (fundo quase-branco com um fio de calor, não branco clínico) e grafite (nunca preto puro), com **uma** accent color de marca — um azul-cobalto dessaturado ("tinta de carimbo"), deliberadamente mais opaco que o índigo brilhante padrão de SaaS — para CTAs, estados ativos e o pipeline. Cores semânticas separadas da accent color (verde=convertido, âmbar=expirando, vermelho=expirado) para não colidir com a marca.
- **Tipografia**: uma família sans-serif (Geist, ver `app/layout.tsx`), pesos limitados (regular/medium/semibold). Números (preços, totais, número do orçamento) em **Geist Mono** com tabular figures — a mesma família de design da sans, usada como voz utilitária para dado tabular, não uma fonte de exibição pareada à parte.
- **Cantos**: radius reduzido (`--radius: 0.35rem`) — um formulário oficial não tem a curva macia de SaaS consumer genérico.
- **Densidade**: espaçamento compacto nas telas de dados (Kanban, tabelas de orçamento, catálogo); espaçamento mais aberto só na landing page e no onboarding.
- **Componentização**: shadcn/ui como base; variações de marca via tokens do Tailwind (`app/globals.css`), não componentes duplicados.
- **Motivo de assinatura**: o hero da landing page (`components/marketing/quote-receipt.tsx`) renderiza um orçamento real — borda perfurada de talão, numeração sequencial, linhas em mono, selo de carimbo que "prensa" uma vez ao carregar (respeita `prefers-reduced-motion`). Reservar esse tipo de gesto para um único lugar por tela — não replicar o carimbo/perfuração em todo componente.

## Personas (para orientar decisões de UX)

- **Admin**: configura organização, imposto, catálogo, pagamento, convites e plano. Acesso total.
- **Vendedor**: cria orçamento manual, opera o Kanban, faz follow-up. Pode estar em mais de uma organização.
- **Cliente final**: sem login, preenche o formulário público — metade do valor do produto está na experiência dele.
- **Freelancer/consultor solo**: admin sozinho, workspace por cliente/projeto, começa no plano de entrada.

## Origem de clientes

Cada orçamento carrega a origem do cliente que o gerou — `Site` ou `CRM` por enquanto, mas a lista é gerenciável (não um enum fixo em código) na tela dedicada em `/customers` (`lib/customers/`). Aparece ao lado do nome do cliente no Kanban, no detalhe do orçamento e na tabela "Vencendo em breve" do dashboard, e alimenta o gráfico "Origem dos clientes" e, futuramente, a dimensão de origem nos relatórios (ver PRD > Relatórios).

## Orçamento manual (Milestone 8, UI com dados mockados)

O construtor de orçamento do vendedor (`components/quotes/`) tem entrada própria na navegação — **Criar Orçamento** → `/quotes/new` — e não fica restrito ao segmento `/pipeline`; a tela de nova revisão é que continua em `/pipeline/[id]/revise`, por ser uma ação sobre um orçamento existente do board.

- **Desconto negociado** aceita percentual ou valor fixo (toggle R$/%), resolvido para R$ por `resolveDiscountAmount` (`lib/quotes/mock-data.ts`) — a mesma função alimenta a tela de revisão e o preview do PDF, para as duas nunca divergirem.
- **Revisão é um registro novo**, não uma sobrescrita: `PipelineQuote` rastreia `revision`, `previousRevisionId` e `supersededByRevisionId`. A versão anterior fica congelada, continua acessível pelo link antigo e aparece marcada como "Versão antiga"; o board do Kanban mostra só a revisão atual de cada orçamento.
- **`PipelineProvider` vive no layout do painel inteiro** (`app/(app)/layout.tsx`), não só em `/pipeline` — é o que permite `/quotes/new` gravar no mesmo estado mockado que o board lê. Ainda é só estado em memória da sessão (sem Supabase); um reload de página perde tudo, isso é esperado até o backend do motor de orçamento (Milestone 14) e do pipeline (Milestone 16) existir. Páginas de detalhe (`/pipeline/[id]`, `/pipeline/[id]/revise`) por isso leem do contexto ao vivo, não de fetch de servidor sobre o mock estático — senão um orçamento criado na sessão dá 404 ao abrir.

## Processo

Construir em milestones incrementais, cada um um entregável testável — priorizar o núcleo (formulário público → cálculo → PDF → envio, e o Kanban básico) antes de relatórios, automações e integrações avançadas. Testar cada milestone antes de avançar para o próximo.
