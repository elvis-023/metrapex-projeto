# PROJECT ARCHITECTURE: Meu Projeto

## 1. CONTEXT & PROBLEM

Empresas que vendem produtos perdem venda por lentidão na resposta ao pedido de orçamento. Isso acontece em dois pontos: no site, o cliente preenche um formulário de "solicitar orçamento" e espera horas ou dias por uma resposta — nesse meio-tempo, o concorrente que respondeu primeiro já fechou a venda. E internamente, o vendedor demora para montar o orçamento porque depende de um sistema lento, cálculo manual de imposto e de condição de pagamento, e um PDF montado à mão.

As ferramentas existentes não resolvem o problema inteiro. CRMs genéricos (HubSpot, Pipedrive) organizam o lead, mas não geram o orçamento com preço, imposto e PDF, além de serem caros ou complexos demais para pequenas e médias empresas. ERPs geram orçamento, mas são pesados, caros, e não têm um formulário público que devolve o orçamento na hora para o cliente.

Existe um vão no meio: falta uma ferramenta enxuta que crie o orçamento em segundos (quando é o próprio cliente que preenche) ou em minutos (quando é o vendedor montando manualmente), e que qualquer empresa consiga configurar sozinha — sem depender do regime tributário de um segmento específico, já que empresas no Simples Nacional, no Lucro Presumido e com diferentes composições de imposto (ICMS, IPI) precisam do mesmo sistema funcionando de formas distintas.

## 2. PROPOSED SOLUTION

Construir um SaaS multiempresa de geração automática de orçamentos, que junta duas engrenagens em cima do mesmo catálogo e das mesmas regras:

Formulário público incorporável: um botão/formulário instalado no site ou loja da empresa. O cliente informa CPF ou CNPJ, escolhe produtos e recebe o orçamento em PDF na hora, por e-mail (e WhatsApp a partir de um plano superior), sem ninguém do time precisar agir.

CRM enxuto para o time de vendas: o vendedor cria um orçamento manual em minutos a partir do catálogo (com foto, preço e imposto já calculados), acompanha tudo num pipeline visual (Kanban), e conta com follow-up e expiração automáticos.

O diferencial central é a combinação de velocidade (orçamento instantâneo no formulário público, minutos no manual) com abrangência: impostos, condições de pagamento, catálogo e textos do orçamento são configuráveis por empresa, então o mesmo sistema serve tanto quem está no Simples Nacional e não destaca imposto quanto quem trabalha com ICMS e IPI destacados.

A métrica que prova o valor do produto é o tempo até o primeiro orçamento — do pedido do cliente até o orçamento estar na mão dele. É o número que o produto existe para derrubar, e aparece como KPI central no dashboard.

Monetização via planos de assinatura por número de vendedores, com volume de orçamentos mensais diferenciando os planos, e checkout/gerenciamento via Stripe.

## 3. FUNCTIONAL REQUIREMENTS

- Login e Autenticação
- Kanban
- Dashboards
- Parte premium (paga)
- Busca e Filtros
- Landing Page
- Upload de Arquivos
- Notificações
- Onboarding do Usuário
- Relatórios e Exportação
- Integrações (API)
- Permissões por usuário
- Multi usuário
- Multi empresa

Multiempresa e controle de acesso
Cada empresa/time é uma organização (workspace) isolada; um usuário pode pertencer a mais de uma, com troca por dropdown.
Convite de colaboradores por e-mail.
Papéis: admin (acesso total, configura tudo) e vendedor (opera orçamentos, clientes e pipeline).
Isolamento de dados entre empresas via Row Level Security no banco — nenhuma empresa enxerga dado de outra.

Onboarding (wizard autosserviço)
Passo a passo guiado: criar a organização, escolher um template fiscal pronto (ex.: Simples Nacional sem destaque, Isento, ICMS + IPI padrão) e ajustar, popular o catálogo (importação de planilha ou cadastro manual), confirmar condições de pagamento (com sugestão-padrão pré-preenchida), e instalar o snippet do formulário no site.
Autosserviço por padrão; onboarding assistido por humano reservado a planos maiores.

Catálogo de produtos
Três formas de manter o catálogo: importar planilha (upsert por código único), cadastrar produto manual, ou editar qualquer produto existente — o sistema é a fonte da verdade, sem sincronização externa sobrescrevendo dados.
Campos: código externo, nome, preço, estoque, categoria (genérica, configurável por empresa), foto, e campos complementares (título alternativo, links de catálogo/manual/vídeo, elegibilidade de certificado, prazo de entrega).
Validação na importação: para e mostra erro em vez de gravar dado inconsistente (código duplicado, preço mal formatado, campo obrigatório faltando); normaliza preço em formato brasileiro e ignora linhas vazias.

Motor de impostos configurável (diferencial central)
Em vez de campos fixos de imposto no schema, cada tributo que a empresa usa (ICMS, IPI, ou nenhum) é uma regra configurável, com modo de cálculo (embutido no preço ou somado por fora) e origem da alíquota resolvida por hierarquia: padrão da empresa, com possibilidade de override por categoria, com possibilidade de override mais específico por produto — o nível mais específico sempre vence.
Fórmulas: no modo embutido, extrai-se a base do preço cheio (base = preço / (1 + alíquota/100)) e o imposto aparece em linha separada; no modo por fora, soma-se o imposto ao preço. Alíquota zero não quebra a fórmula em nenhum dos dois modos.
Templates prontos no onboarding para não começar do zero (Simples Nacional sem destaque, Isento, ICMS + IPI padrão).
Escopo da primeira versão: cada tributo calculado isoladamente sobre a base do item, sem composição entre tributos — casos avançados (substituição tributária, DIFAL interestadual, PIS/COFINS monofásico) ficam para uma versão futura.

Condições de pagamento configuráveis
Formas de pagamento cadastráveis (à vista, cartão, boleto) com desconto, parcelas e prazo.
Faixas de valor por tipo de documento definindo quais formas de pagamento se aplicam a cada faixa.
Desconto negociado específico por orçamento, aplicado por cima do total, sem alterar as regras gerais da empresa.

Motor de orçamento
Cálculo cruza os itens escolhidos com o catálogo, aplica o motor de impostos e monta subtotal, total de impostos e total.
Snapshot: o orçamento e seus itens congelam preço, imposto e condições de pagamento no momento da emissão — mudanças posteriores no catálogo não afetam orçamentos já emitidos.
Versionamento: quando o vendedor negocia um desconto especial, cria-se uma nova revisão em vez de sobrescrever; a mais recente fica marcada como atual, as anteriores ficam no histórico.
Numeração de orçamento sequencial e independente por organização.

Formulário público incorporável
Snippet de incorporação único por organização, identificado por uma chave pública; pode pré-carregar um produto específico ou abrir em branco.
Identificação do cliente por CPF ou CNPJ, com preenchimento automático de razão social/endereço (consulta por CNPJ) ou endereço via CEP (consulta por CPF).
Antispam: captcha invisível, honeypot e limite de requisições por IP e por documento.
O formulário nunca escreve direto no banco — sempre passa por validação no backend, que resolve a organização, deduplica cliente, calcula, gera o PDF e envia.

Geração e envio do orçamento
Template de PDF configurável por empresa (logo, dados da emissora, textos de garantia/termos/frete).
Envio por e-mail incluído em todos os planos; envio por WhatsApp liberado a partir de um plano superior.

Pipeline / CRM (Kanban)
Etapas fixas do ciclo de vida do orçamento (gerado, enviado, em negociação, convertido, expirado), iguais para todas as empresas — o significado da etapa alimenta as automações de follow-up e expiração.
Drag-and-drop entre as etapas, com persistência imediata.
Cards com número do orçamento, cliente, valor, responsável e validade; página de detalhe com timeline completa de atividades (criação, envio, follow-up, mudança de status, notas).
Todos os usuários autenticados da empresa veem todos os orçamentos; a filtragem por vendedor no board é só de apresentação — editar é restrito ao dono do orçamento ou a um admin.

Clientes e contatos
Cadastro de clientes por CPF/CNPJ, com deduplicação automática dentro de cada empresa, e múltiplos contatos por cliente.

Dashboard de métricas
Cards de orçamentos gerados no período, valor total em pipeline, taxa de conversão, e tempo médio até o primeiro orçamento (o KPI central do produto).
Gráfico de funil de vendas por etapa.
Lista de orçamentos do vendedor logado com validade próxima do vencimento.

Automações agendadas
Follow-up automático para orçamentos parados há mais de X dias sem mudança de status.
Expiração automática de orçamentos com validade vencida e não convertidos.

Relatórios e Exportação
Relatórios pré-construídos: orçamentos gerados por período, taxa de conversão por vendedor/origem/faixa de valor, valor total em pipeline e ticket médio, taxa de expiração, desempenho por vendedor, produtos mais orçados e mais convertidos, e a evolução histórica do tempo até o primeiro orçamento.
Relatório customizável: escolha do objeto (orçamentos, itens, clientes), da métrica (contagem, soma, média), do agrupamento e do filtro, montando um relatório sob medida sem precisar de código.
Exportação de dado bruto filtrado em CSV/Excel, exportação de gráfico/relatório em PDF ou PNG, e envio agendado por e-mail (diário, semanal ou mensal) para o time ou para a gestão.

Monetização
Planos por assinatura, com limite de vendedores e de orçamentos mensais por plano, e canal de WhatsApp liberado só a partir de um plano intermediário.
Checkout, webhook de ativação/desativação e portal de gerenciamento de assinatura integrados a um provedor de pagamento.

Landing page e páginas legais
Página pública com apresentação do produto, funcionalidades, planos e preços, e chamada para ação.
Páginas de Termos de Uso e Política de Privacidade.

## 4. USER PERSONAS

Admin da empresa (dono ou gestor): cria a organização, conduz o onboarding (configuração de imposto, catálogo e condições de pagamento), convida o time e gerencia o plano de assinatura. Tem acesso total ao sistema.
Vendedor (colaborador): opera no dia a dia — cria orçamentos manuais, move os cards no pipeline, registra atividades e conduz follow-up. Pode fazer parte de mais de uma organização.
Cliente final (quem preenche o formulário público no site da empresa): não tem login e não conhece o sistema por trás. Precisa de um formulário rápido, claro, que devolve o orçamento pronto na hora — a experiência dele é metade do valor do produto.
Freelancer ou consultor (admin solo): opera sozinho, geralmente com um workspace por cliente ou projeto; começa no plano de entrada e sobe conforme o volume de orçamentos cresce.

## 5. TECHNICAL STACK

- Next.js
- React
- Tailwind CSS
- shadcn/ui
- Supabase
- Stripe
- Vercel
- Claude Code
- Node.js
- PostgreSQL
- TypeScript
- Resend (e-mails)

Frontend e backend: Next.js (App Router) com API Routes, cobrindo a aplicação inteira, resolução de organização por requisição, billing/webhooks e o endpoint do formulário público (que precisa de validação robusta contra abuso).
Interface: React, Tailwind CSS e shadcn/ui.
Banco de dados, autenticação e armazenamento: Supabase (PostgreSQL com Row Level Security para isolamento entre empresas, Auth para login, Storage para os PDFs gerados).
Automações assíncronas: n8n cuidando apenas do envio de e-mail/WhatsApp e das rotinas agendadas (follow-up e expiração) — o motor de cálculo do orçamento roda no backend Next.js, não no n8n.
Pagamento da assinatura do SaaS: Stripe, com checkout, webhook de ativação/desativação de plano e portal de gerenciamento de assinatura.
E-mail transacional: Resend, cobrindo envio de orçamento, convite de colaborador, follow-up e também os e-mails de autenticação (confirmação de cadastro e recuperação de senha, via SMTP customizado apontando para o Supabase Auth).
Geração de PDF: PDFMonkey, com template configurável por organização.
APIs externas de apoio ao formulário público: BrasilAPI (consulta de CNPJ), ViaCEP (consulta de CEP) e Cloudflare Turnstile (captcha invisível).
Deploy: Vercel para a aplicação, Supabase para o banco.
Linguagem: TypeScript.

## 6. DESIGN LANGUAGE

Referências principais: HubSpot CRM, Pipedrive, e ferramentas de agendamento/reserva instantânea (categoria Calendly).

HubSpot CRM
CRM gratuito mais popular do mercado, com pipeline visual e gestão de contatos robusta.
Pontos fortes: ecossistema completo, plano gratuito generoso.
Pontos fracos: complexo demais para pequenas empresas, e não gera orçamento com cálculo de imposto e PDF — resolve só a parte de organização do lead, não a parte comercial do documento.
Insight: usar o pipeline visual como referência de UX, mas manter o produto radicalmente mais simples, focado só no ciclo do orçamento.

Pipedrive
CRM focado em vendas, com o pipeline Kanban como referência de mercado.
Pontos fortes: UX de pipeline intuitiva e direta.
Pontos fracos: sem plano gratuito, e sem geração nativa de orçamento com imposto e documento — para isso, o vendedor ainda precisa de outra ferramenta por fora.
Insight: adotar a fluidez do pipeline do Pipedrive, mas embutir o motor de orçamento que ele não tem, eliminando a etapa de "sair do CRM para montar a proposta".

## 7. PROCESS

- Break app build into logical milestones (steps)
- Each milestone should be a deliverable increment
- Prioritize core functionality first, then iterate
- Test each milestone before moving to the next
