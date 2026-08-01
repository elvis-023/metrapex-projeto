# Decisões registradas (§11 do briefing)

Log de decisões tomadas para as 8 perguntas em aberto listadas em [perguntas-abertas.md](perguntas-abertas.md). Enquanto uma pergunta não tiver uma entrada aqui, ela continua em aberto — consulte a skill `decisao-pendente` antes de decidir sozinho.

Formato de cada entrada:

```markdown
### §11.N — <título> — decidido em AAAA-MM-DD

Decisão: <o comportamento escolhido, em uma frase imperativa>.
Porquê: <justificativa em uma ou duas linhas, incluindo o que foi descartado>.
Impacto: <arquivos/camadas afetados, se já existirem>.
```

Acrescente entradas abaixo, sem apagar nem reordenar as anteriores.

---

### §11.3 — Rascunho vs. emitido — decidido em 2026-07-26

Decisão: rascunho (`quotes.tax_snapshot_at is null`) recalcula a configuração vigente a cada abertura; a emissão grava `tax_snapshot_at` e congela `quote_item_taxes`, `quote_items` e os campos de snapshot de `quotes`.
Porquê: proposta explícita do §11.3; mantém o rascunho útil como simulação e preserva o invariante "documento emitido é fotografia, não consulta". Descartado congelar na criação, que deixaria rascunhos velhos com alíquota morta.
Impacto: `lib/quotes/` (leitura e emissão), migration do Milestone 14.

### §11.4 — Duplicar/revisar orçamento antigo — decidido em 2026-07-26

Decisão: revisão nova recalcula alíquotas e preços de catálogo com a configuração vigente no momento da revisão; a revisão anterior permanece congelada, e a UI avisa explicitamente que os valores foram recalculados.
Porquê: recomendação do §11.4 — emitir documento novo com alíquota que não vale mais propaga configuração morta indefinidamente. Descartado herdar o snapshot anterior e o híbrido "preço herdado + imposto recalculado", que quebra a reconstrução `base + imposto = preço de catálogo`.
Impacto: rotina de criação de revisão em `lib/quotes/`, tela `/pipeline/[id]/revise`.

### §11.5 — Produto muda de categoria depois da emissão — decidido em 2026-07-26

Decisão: copiar `category_id` e o nome da categoria para o snapshot do item (`quote_items.category_id_snapshot`, `quote_items.category_name`), sem FK forte; relatórios agrupam por esses campos, nunca por `join` com `product_categories`.
Porquê: sem a cópia, produto que troca de categoria move retroativamente totais históricos entre categorias, e a coluna não pode ser adicionada depois (o dado histórico já se perdeu — backfill impossível). Custo de duas colunas contra perda permanente de histórico.
Impacto: DDL de `quote_items`, montagem do snapshot na emissão, futuros relatórios (Milestone 20).

### §11.6 — Arredondamento em quantidade fracionária — decidido em 2026-07-26

Decisão: `quote_items.quantity` é `numeric(18,6)`; o cálculo é sempre por linha (`preço unitário × quantidade` primeiro, imposto depois) e `unit_base_display` é a base da linha dividida pela quantidade em 6 casas — valor de exibição, nunca fonte para reconstruir `line_total`.
Porquê: mantém o comportamento já implementado em `calcItemTaxes` (Milestone 12) e evita arredondamento intermediário por unidade, que diverge centavos na base. A divergência residual fica confinada ao unitário exibido, que não alimenta nenhuma soma.
Impacto: `lib/tax-engine/calc-tax.ts` (comportamento existente confirmado), DDL de `quote_items`, renderização do documento.

### §11.7 — Agregação no total do documento — decidido em 2026-07-26

Decisão: totais por tributo são agregados na leitura, somando `quote_item_taxes.tax_amount` por `tax_code`, sem persistir bloco agregado; tributo `inclusive` é rotulado como já contido no total a pagar, e só o `exclusive` soma por cima.
Porquê: as linhas de origem já estão congeladas, então a agregação é determinística e não viola o snapshot — persistir de novo criaria uma segunda fonte de verdade a manter sincronizada. O rótulo evita que o cliente leia "total de impostos" como cobrança dupla em modo `inclusive`.
Impacto: `documentTotals` em `lib/tax-engine/calc-tax.ts`, leitura do documento, prévia do PDF.

### §11.8 — Tributo excluído depois da emissão — decidido em 2026-07-26

Decisão: confirmado — `quote_item_taxes.tax_type_id` fica sem FK, e nenhuma query, DTO, repository ou tela do documento faz `join` com `tax_types`; a leitura é `quote_items left join quote_item_taxes`, com item sem tributo tratado como caso normal.
Porquê: fecha o invariante do briefing §3 ("fotografia, não consulta") na camada de leitura, garantindo reimpressão idêntica mesmo após desativação ou exclusão do tributo. `left join` porque organização sem tributo (MEI/Simples sem destaque) é configuração válida e emitível.
Impacto: DDL e todas as consultas de leitura de orçamento do Milestone 14.

---

## Decisões fora do §11 — mudança "Regime Tributário" (fora do plano, chegou depois do Milestone 20)

Estas quatro não são das 8 perguntas do briefing — são decisões de arquitetura para a
mudança do passo 2 do onboarding de "template fiscal" para "Regime Tributário" (MEI,
Simples Nacional, Lucro Real, Lucro Presumido) com detecção automática por CNPJ.
Registradas aqui pelo mesmo motivo: nascer explicadas, não implícitas no código.

### Regime Tributário #1 — coluna persistida em `organizations` — decidido em 2026-08-01

Decisão: `organizations` ganha uma coluna `tax_regime` persistida, mesmo o motor de
cálculo (`resolveRate`/`calcTax`) nunca lendo esse campo.
Porquê: o campo existe só para exibir a escolha detectada no onboarding (via CNPJ) e
permitir trocar de regime depois — não para o motor decidir cálculo por regime, o que
violaria o invariante "regras, não colunas" do briefing §2. Descartado não persistir
nada, o que impediria mostrar/editar a escolha fora do fluxo de criação da organização.
Impacto: migration em `organizations`, onboarding (passo 2), tela de settings que vier
a expor/editar o regime.

### Regime Tributário #2 — quarto template como entrada própria — decidido em 2026-08-01

Decisão: `"lucro-real"` é um `TaxTemplateId` próprio em `buildTaxTemplatePlan`
(`lib/tax-engine/onboarding-templates.ts`), com seu próprio `case`, não um alias/fallthrough
para `"icms-ipi"` — mesmo que o plano de saída inicial seja idêntico hoje.
Porquê: os dois regimes coincidem por acaso no V1 (nenhum dos quatro exige mudança de
cálculo, conforme diagnóstico), mas são conceitos diferentes para quem lê o código e
podem divergir no futuro (ex.: PIS/COFINS não-cumulativo do Lucro Real, hoje fora de
escopo). Alias economiza uma entrada hoje e obriga a separar depois sem histórico do
porquê eram iguais.
Impacto: `lib/tax-engine/onboarding-templates.ts` (`TaxTemplateId`, `buildTaxTemplatePlan`),
`lib/onboarding/mock-data.ts` (copy do passo 2).

### Regime Tributário #3 — `/settings/taxes` sai do mock, vira CRUD real — decidido em 2026-08-01

Decisão: `app/(app)/settings/taxes` deixa de rodar sobre `lib/settings/mock-data.ts` e
passa a ler/escrever `tax_types`/`tax_rates`/`tax_settings` de verdade, reaproveitando
`getTaxConfiguration` de `lib/quotes/queries.ts` como base da leitura. Entra no escopo
do bloco que mexe nessa tela (não um milestone separado).
Porquê: a tela já existe desde o Milestone 10 mas nunca foi ligada a dado real; a
mudança de regime torna essa lacuna visível (usuário escolhe regime no onboarding, mas
não consegue conferir/ajustar o resultado na tela de configuração). Reaproveitar
`getTaxConfiguration` evita uma segunda função de leitura das mesmas três tabelas.
Impacto: `app/(app)/settings/taxes/page.tsx`, `components/settings/tax-settings-manager.tsx`,
`lib/settings/` (mock a ser removido), possível extensão de `lib/quotes/queries.ts` se
`getTaxConfiguration` precisar de campos que a tela usa e a leitura do orçamento não.

### Regime Tributário #4 — client de BrasilAPI extraído para lib compartilhada — decidido em 2026-08-01

Decisão: a chamada HTTP à BrasilAPI hoje embutida em
`app/api/public-quote/lookup-cnpj/route.ts` é extraída para uma função de
`lib/integrations/` (client compartilhado); o onboarding autenticado consome essa
função diretamente, sem chamar a rota pública do formulário.
Porquê: a rota pública tem rate-limit e contrato de resposta (`legalName`+`address`)
pensados para o visitante anônimo do formulário; o onboarding autenticado precisa
também de `porte`/`opcao_pelo_simples`/`opcao_pelo_mei` (campos que a rota pública hoje
descarta) para a detecção automática de MEI/Simples — forçar o onboarding a chamar a
rota pública acoplaria dois consumidores com necessidades diferentes a um único
contrato de resposta. Descartado duplicar a chamada fetch em dois lugares.
Impacto: novo arquivo em `lib/integrations/` (ex.: `lib/integrations/brasil-api.ts`),
`app/api/public-quote/lookup-cnpj/route.ts` (passa a chamar a função em vez do fetch
inline), novo ponto de consumo no onboarding (Bloco 7).
