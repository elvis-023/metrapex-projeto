# Plano de execução

Divisão em milestones incrementais e testáveis (ver [CLAUDE.md](../CLAUDE.md) → Processo). Ordem: **setup → interface completa (dados mockados) → backend (dados reais, integrações) → deploy**. A interface vem primeiro para validar fluxo e UX cedo com dados falsos; cada milestone de backend na Fase 2 pluga dados reais na tela já existente da Fase 1, na mesma ordem.

Convenção de branch: `milestone/NN-slug`, criada a partir de `main`, mergeada via PR ao final do milestone. Convenção de commit final: [Conventional Commits](https://www.conventionalcommits.org/).

---

## Fase 0 — Setup

### Milestone 0 — Setup do projeto
**Branch:** `milestone/00-setup`
**Objetivo:** Scaffolding do repositório, tooling e pipeline de deploy vazio, para que todo milestone seguinte só adicione código de produto.

- [x] Inicializar projeto Next.js (App Router, TypeScript estrito)
- [x] Configurar Tailwind CSS e shadcn/ui
- [x] Configurar ESLint, Prettier e checagem de tipos no CI
- [x] Criar estrutura de pastas base (`app/`, `lib/`, `components/`, `docs/`) conforme [CLAUDE.md](../CLAUDE.md#estrutura-de-pastas-proposta)
- [x] Inicializar repositório Git e primeiro push
- [ ] Criar projeto no Supabase (ambiente dev) e projeto na Vercel, conectados
- [ ] Configurar variáveis de ambiente (`.env.local.example`) e segredos na Vercel
- [ ] Deploy inicial "hello world" na Vercel (valida pipeline antes de existir produto)

**Commit final:** `chore(setup): initial project scaffolding, tooling and deploy pipeline`

---

## Fase 1 — Interface (dados mockados)

Todas as telas desta fase usam dados estáticos/mockados em memória — sem Supabase, sem cálculo real de imposto, sem envio de e-mail. O objetivo é fechar UX e navegação antes de existir qualquer schema.

### Milestone 1 — Design system e layout base
**Branch:** `milestone/01-design-system`
**Objetivo:** Estabelecer os tokens visuais e os componentes de layout que toda tela subsequente vai reusar.

- [x] Tokens de tema no Tailwind (cores neutras + accent, cores semânticas, tipografia) conforme [CLAUDE.md](../CLAUDE.md#identidade-visual-proposta-inicial--ajustar-quando-houver-definição-de-marca)
- [x] Componentes base do shadcn/ui instalados e customizados (button, input, select, dialog, dropdown, table, card, badge, toast)
- [x] Layout do painel autenticado: sidebar de navegação, topbar com dropdown de troca de organização, área de conteúdo
- [x] Modo claro/escuro (se aplicável) e responsividade básica
- [x] Página de estados vazios/erro/loading padrão (skeletons)

**Commit final:** `feat(ui): design system tokens and base layout components`

### Milestone 2 — Landing page e páginas legais
**Branch:** `milestone/02-landing-page`
**Objetivo:** Página pública de apresentação do produto e páginas legais, primeiro contato do visitante.

- [x] Landing page: hero, funcionalidades, planos e preços, chamada para ação
- [x] Página de Termos de Uso
- [x] Página de Política de Privacidade
- [x] SEO básico (metadata, OpenGraph)

**Commit final:** `feat(marketing): landing page and legal pages`

### Milestone 3 — Autenticação (telas)
**Branch:** `milestone/03-auth-ui`
**Objetivo:** Telas de login, cadastro e recuperação de senha, sem integração real (mock de sessão).

- [x] Tela de login
- [x] Tela de cadastro
- [x] Tela de recuperação/redefinição de senha
- [x] Tela de aceite de convite de colaborador
- [x] Rotas protegidas com mock de sessão (redirect se "não autenticado")

**Commit final:** `feat(auth): authentication screens with mocked session`

### Milestone 4 — Onboarding (wizard UI)
**Branch:** `milestone/04-onboarding-ui`
**Objetivo:** Wizard autosserviço de criação de organização, navegável ponta a ponta com dados mockados.

- [x] Passo 1: criar organização (nome, dados básicos)
- [x] Passo 2: escolher template fiscal (Simples Nacional sem destaque, Isento, ICMS + IPI padrão) e tela de ajuste
- [x] Passo 3: popular catálogo (importar planilha ou cadastro manual) — UI de upload e tabela de preview
- [x] Passo 4: confirmar condições de pagamento (sugestão-padrão pré-preenchida)
- [x] Passo 5: instalar snippet do formulário público (tela de código para copiar)
- [x] Barra de progresso e navegação entre passos (voltar/avançar/pular)

**Commit final:** `feat(onboarding): self-service onboarding wizard UI`

### Milestone 5 — Shell do painel e dashboard
**Branch:** `milestone/05-dashboard-ui`
**Objetivo:** Tela inicial do painel autenticado com os cards e gráfico de métricas, dados mockados.

- [x] Cards: orçamentos gerados no período, valor total em pipeline, taxa de conversão, tempo médio até o primeiro orçamento
- [x] Gráfico de funil de vendas por etapa
- [x] Lista de orçamentos do vendedor logado com validade próxima do vencimento
- [x] Filtro de período no dashboard

**Commit final:** `feat(dashboard): metrics dashboard UI with mocked data`

### Milestone 6 — Catálogo de produtos (UI)
**Branch:** `milestone/06-catalog-ui`
**Objetivo:** Telas de listagem, cadastro, edição e importação de produtos.

- [x] Listagem de produtos com busca e filtro por categoria
- [x] Tela de cadastro/edição manual de produto (todos os campos do PRD: código externo, nome, preço, estoque, categoria, foto, campos complementares)
- [x] Fluxo de importação de planilha: upload, preview, exibição de erros de validação (linha a linha)
- [x] Gerenciamento de categorias

**Commit final:** `feat(catalog): product catalog CRUD and import UI`

### Milestone 7 — Kanban / Pipeline (UI)
**Branch:** `milestone/07-kanban-ui`
**Objetivo:** Board de pipeline com as etapas fixas do orçamento e página de detalhe.

- [x] Board Kanban com as 5 etapas fixas (gerado, enviado, em negociação, convertido, expirado)
- [x] Cards com número, cliente, origem do cliente, valor, responsável e validade
- [x] Drag-and-drop entre etapas (estado local, sem persistência ainda)
- [x] Filtro de apresentação por vendedor
- [x] Página de detalhe do orçamento com timeline de atividades (mockada)
- [x] Origem do cliente (Site, CRM) — tela dedicada de gerenciamento em `/customers`, exibida ao lado do nome do cliente no Kanban, no dashboard e no detalhe do orçamento
- [x] Gráfico "Origem dos clientes" no dashboard (Milestone 5), respeitando o filtro de período existente

**Commit final:** `feat(pipeline): kanban board and quote detail UI`

### Milestone 8 — Orçamento manual (UI)
**Branch:** `milestone/08-quote-builder-ui`
**Objetivo:** Fluxo do vendedor para montar um orçamento a partir do catálogo.

- [x] Seleção de cliente (busca/criação) e produtos do catálogo (com foto, preço e imposto exibidos)
- [x] Tela de revisão: subtotal, total de impostos, total, condição de pagamento
- [x] Aplicação de desconto negociado específico do orçamento — percentual ou valor fixo, com toggle e recálculo ao vivo
- [x] Preview do PDF (layout estático)
- [x] Tela de nova revisão (versionamento) a partir de um orçamento existente — a revisão anterior fica congelada, acessível pelo link antigo e marcada como "Versão antiga"; o board mostra só a revisão atual
- [x] Entrada de criação de orçamento própria na navegação (`Criar Orçamento` → `/quotes/new`), não restrita ao segmento `/pipeline`
- [x] Orçamento criado/revisado passa a existir no estado do pipeline (mock em memória, sem persistência real ainda) — aparece no board e tem página de detalhe navegável na mesma sessão

**Commit final:** `feat(quotes): manual quote builder UI`

### Milestone 9 — Formulário público de orçamento (UI)
**Branch:** `milestone/09-public-form-ui`
**Objetivo:** Formulário incorporável que o cliente final preenche, sem autenticação.

- [x] Identificação por CPF/CNPJ (campos de preenchimento automático de endereço/razão social, mockados)
- [x] Seleção de produtos (com opção de pré-carregar um produto específico via parâmetro)
- [x] Tela de confirmação/recebimento do orçamento
- [x] Layout embutível (iframe/snippet) e responsivo
- [x] Honeypot e placeholder de captcha na UI

**Commit final:** `feat(public-form): embeddable public quote request form UI`

### Milestone 10 — Configurações da organização (UI)
**Branch:** `milestone/10-settings-ui`
**Objetivo:** Telas administrativas de configuração usadas pelo admin.

- [x] Configuração de impostos (tipos de tributo, modo, alíquota padrão, overrides por categoria/produto)
- [x] Configuração de condições de pagamento e faixas de valor
- [x] Template de PDF (logo, dados da emissora, textos de garantia/termos/frete)
- [x] Gerenciamento de colaboradores (convite, papéis admin/vendedor)
- [x] Tela de plano/assinatura (placeholder, sem Stripe ainda)

**Commit final:** `feat(settings): organization settings screens UI`

---

## Fase 2 — Backend (dados reais)

Cada milestone desta fase pluga dados e lógica reais nas telas já construídas na Fase 1, na mesma ordem de dependência.

### Milestone 11 — Supabase: schema base, auth e multiempresa
**Branch:** `milestone/11-backend-foundation`
**Objetivo:** Fundação de dados: organizações, usuários, papéis e isolamento por RLS, com autenticação real.

- [ ] Schema: `organizations`, `organization_members` (papéis admin/vendedor), `profiles`
- [ ] Row Level Security em todas as tabelas multiempresa
- [ ] Integração com Supabase Auth (login, cadastro, recuperação de senha reais) — telas do Milestone 3 passam a funcionar
- [ ] Resolução de organização por request (sessão) e dropdown de troca de organização funcional
- [ ] Convite de colaborador por e-mail (Resend) funcional

**Commit final:** `feat(backend): organizations, auth and multi-tenant RLS foundation`

### Milestone 12 — Motor de impostos (backend)
**Branch:** `milestone/12-tax-engine`
**Objetivo:** Implementar o motor de impostos configurável conforme especificação já existente no repo — **não redesenhar, seguir [briefing-motor-impostos.md](../briefing-motor-impostos.md)**.

- [ ] DDL de `tax_types`, `tax_rates`, `product_categories`, `tax_settings` (ver briefing §3)
- [ ] `resolveRate` (hierarquia produto > categoria > padrão) — usar skill `calculo-tributario` e agent `auditor-resolve-rate` na revisão
- [ ] `calcTax` (`inclusive`/`exclusive`) com precisão decimal (ver convenção de dinheiro no CLAUDE.md)
- [ ] Templates de onboarding fiscal (Simples Nacional sem destaque, Isento, ICMS + IPI padrão) — Milestone 4 passa a gravar de verdade
- [ ] Testes conforme skill `casos-teste-fiscais` (incluindo caso de override com alíquota 0)

**Commit final:** `feat(tax-engine): configurable tax rules, rate resolution and calculation`

### Milestone 13 — Catálogo (backend)
**Branch:** `milestone/13-catalog-backend`
**Objetivo:** Persistência real do catálogo, ligando às telas do Milestone 6.

- [ ] CRUD de produtos e categorias no Supabase
- [ ] Import de planilha: parsing, validação (código duplicado, preço mal formatado, campo obrigatório, normalização de preço BR, linhas vazias ignoradas), upsert por código externo
- [ ] Upload de foto de produto (Supabase Storage)
- [ ] Vínculo de `category_id` ao produto (usado pelo motor de impostos)

**Commit final:** `feat(catalog): catalog persistence, spreadsheet import and validation`

### Milestone 14 — Motor de orçamento (backend)
**Branch:** `milestone/14-quote-engine`
**Objetivo:** Cálculo real de orçamento com snapshot e versionamento, ligando ao Milestone 8.

- [ ] Schema de `quotes`, `quote_items`, `quote_item_taxes`, `payment_conditions` (ver briefing §3 para os campos de snapshot)
- [ ] Cálculo: cruzar itens com catálogo, aplicar motor de impostos, montar subtotal/total de impostos/total
- [ ] Snapshot no momento da emissão (`tax_snapshot_at`) — congelar preço, imposto e condição de pagamento
- [ ] Versionamento: nova revisão ao aplicar desconto negociado, revisão mais recente marcada como atual
- [ ] Numeração sequencial de orçamento, independente por organização
- [ ] Condições de pagamento configuráveis e faixas de valor aplicadas no cálculo

**Commit final:** `feat(quotes): quote calculation engine with snapshot and versioning`

### Milestone 15 — Formulário público (backend)
**Branch:** `milestone/15-public-form-backend`
**Objetivo:** Endpoint público que resolve organização, deduplica cliente, calcula, gera PDF e envia — sem escrita direta do client no banco.

- [ ] Endpoint de validação (BrasilAPI para CNPJ, ViaCEP para CEP)
- [ ] Antispam: Cloudflare Turnstile, honeypot, limite de requisições por IP e por documento
- [ ] Resolução de organização pela chave pública do snippet
- [ ] Geração de PDF via PDFMonkey com template da organização
- [ ] Envio por e-mail (Resend) — canal WhatsApp condicionado ao plano
- [ ] Snippet de incorporação real (script + parâmetro de produto pré-carregado)

**Commit final:** `feat(public-form): public quote endpoint with antispam, PDF and delivery`

### Milestone 16 — Pipeline/Kanban (backend)
**Branch:** `milestone/16-pipeline-backend`
**Objetivo:** Persistência real do board e da timeline, ligando ao Milestone 7.

- [ ] Persistência imediata de mudança de etapa (drag-and-drop)
- [ ] Timeline de atividades (criação, envio, follow-up, mudança de status, notas)
- [ ] Regra de permissão: edição restrita ao dono do orçamento ou admin; visualização liberada a todos os usuários autenticados da organização

**Commit final:** `feat(pipeline): kanban persistence, activity timeline and permissions`

### Milestone 17 — Clientes e contatos (backend)
**Branch:** `milestone/17-customers-backend`
**Objetivo:** Cadastro de clientes com deduplicação, usado pelo Milestone 8 e pelo formulário público.

- [ ] CRUD de clientes por CPF/CNPJ
- [ ] Deduplicação automática dentro da organização
- [ ] Múltiplos contatos por cliente

**Commit final:** `feat(customers): customer records with dedup and multiple contacts`

### Milestone 18 — Automações agendadas
**Branch:** `milestone/18-automations`
**Objetivo:** Rotinas de follow-up e expiração via n8n, consumindo a API do backend.

- [ ] Job agendado: follow-up automático para orçamentos parados há mais de X dias
- [ ] Job agendado: expiração automática de orçamentos vencidos não convertidos
- [ ] Notificação ao vendedor responsável (in-app e/ou e-mail)

**Commit final:** `feat(automations): scheduled follow-up and expiration jobs`

### Milestone 19 — Dashboard de métricas (dados reais)
**Branch:** `milestone/19-dashboard-backend`
**Objetivo:** Substituir os mocks do Milestone 5 por queries reais.

- [ ] Query de orçamentos gerados, valor em pipeline, taxa de conversão
- [ ] Cálculo do tempo médio até o primeiro orçamento (KPI central)
- [ ] Funil de vendas por etapa a partir de dados reais

**Commit final:** `feat(dashboard): wire metrics dashboard to real data`

### Milestone 20 — Relatórios e exportação
**Branch:** `milestone/20-reports`
**Objetivo:** Relatórios pré-construídos, relatório customizável e exportação.

- [ ] Relatórios pré-construídos (orçamentos por período, conversão por vendedor/origem/faixa, ticket médio, taxa de expiração, produtos mais orçados/convertidos, evolução do tempo até o primeiro orçamento)
- [ ] Relatório customizável (objeto, métrica, agrupamento, filtro)
- [ ] Exportação CSV/Excel de dado bruto filtrado
- [ ] Exportação de gráfico/relatório em PDF/PNG
- [ ] Envio agendado por e-mail (diário/semanal/mensal)

**Commit final:** `feat(reports): prebuilt and custom reports with export`

### Milestone 21 — Billing (Stripe)
**Branch:** `milestone/21-billing`
**Objetivo:** Monetização por assinatura, ligando à tela placeholder do Milestone 10.

- [ ] Planos por número de vendedores e volume de orçamentos mensais
- [ ] Checkout Stripe
- [ ] Webhook de ativação/desativação de plano
- [ ] Portal de gerenciamento de assinatura
- [ ] Trava de limite de vendedores/orçamentos e liberação de canal WhatsApp por plano

**Commit final:** `feat(billing): stripe subscription checkout, webhooks and plan gating`

### Milestone 22 — Multiempresa avançado
**Branch:** `milestone/22-multi-org-polish`
**Objetivo:** Fechar os detalhes de permissão e multiempresa que dependem de billing e dados reais já existirem.

- [ ] Revisão de permissões admin/vendedor em todas as telas (não só pipeline)
- [ ] Usuário pertencente a múltiplas organizações — troca sem perda de contexto
- [ ] Auditoria de RLS end-to-end (nenhuma organização enxerga dado de outra)

**Commit final:** `feat(multi-tenant): finalize cross-org permissions and RLS audit`

---

## Fase 3 — Deploy

### Milestone 23 — Deploy e produção
**Branch:** `milestone/23-production-deploy`
**Objetivo:** Endurecer e publicar a versão de produção.

- [ ] Variáveis de ambiente e segredos de produção (Supabase, Stripe, Resend, PDFMonkey, Turnstile) na Vercel
- [ ] Domínio customizado e certificados
- [ ] Monitoramento e alertas (erros, jobs do n8n, webhooks do Stripe)
- [ ] Backups do banco e política de retenção
- [ ] QA final: percorrer os fluxos ponta a ponta (onboarding → formulário público → orçamento → PDF → Kanban → conversão → billing)
- [ ] Deploy de produção

**Commit final:** `chore(release): production deploy and launch checklist`
