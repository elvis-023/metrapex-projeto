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

### Regime Tributário #5 — schema real dos campos de detecção (BrasilAPI) — confirmado em 2026-08-02

Decisão: os campos usados na detecção automática de MEI/Simples são
`opcao_pelo_simples: boolean | null`, `data_opcao_pelo_simples: string | null`,
`opcao_pelo_mei: boolean | null`, `data_opcao_pelo_mei: string | null` e
`porte: string` (acompanhado de `codigo_porte: number`) — **nuláveis, não
`boolean` puro** como a suposição inicial (ver conversa anterior, resposta à
pergunta 2 do usuário). `data_exclusao_do_mei`/`data_exclusao_do_simples` também
existem na resposta (nuláveis) e não são usados na detecção — servem para uma
empresa que já foi MEI/Simples e saiu, fora de escopo do Bloco 7.
Porquê: chamada de teste controlada à BrasilAPI (`GET /api/cnpj/v1/33000167000101`,
Petrobras — Lucro Real, nunca MEI nem Simples) confirmada em 2026-08-02.
Payload real (subconjunto relevante):
```json
{
  "porte": "DEMAIS",
  "codigo_porte": 5,
  "opcao_pelo_mei": null,
  "data_opcao_pelo_mei": null,
  "data_exclusao_do_mei": null,
  "opcao_pelo_simples": null,
  "data_opcao_pelo_simples": null,
  "data_exclusao_do_simples": null
}
```
Para uma empresa fora de MEI/Simples, os quatro campos vêm `null` — **não** `false`.
O tipo definitivo em `lib/integrations/brasil-api.ts` precisa tratar `null` como "não
optante" (equivalente a `false` para fins de detecção), nunca lançar/quebrar em cima de
um campo ausente. Ainda não confirmado empiricamente o formato do payload para uma
empresa que É MEI ou É optante do Simples (`opcao_pelo_mei: true`?) — o dado real deste
teste só prova o caso negativo. Antes de fechar o tipo de teste/fixture que cubra o
caso positivo, rodar uma segunda chamada controlada com um CNPJ real conhecido de
empresa MEI/Simples, ou tratar como suposição razoável (mas não confirmada) que o campo
vira `true` no caso positivo.
Impacto: `lib/integrations/brasil-api.ts` (tipo `BrasilApiCnpjResponse` e a função de
detecção), `lib/tax-engine/onboarding-templates.ts` (mapeamento detecção → `TaxRegime`).

### Regime Tributário #6 — gatilho da detecção por contagem de dígitos, sem validação de DV — decidido em 2026-08-02

Decisão: a detecção automática de regime só dispara quando `organization.document`
(passo 1) tiver exatamente 14 dígitos após remover não-dígitos. Com 11 dígitos (CPF),
a detecção é pulada silenciosamente — nenhuma chamada de rede, nenhuma mensagem de
erro ou aviso. Nenhuma outra contagem de dígitos dispara nada. Não valida dígito
verificador de CNPJ nesta etapa — só contagem.
Porquê: o passo 1 aceita "CNPJ ou CPF" no mesmo campo de texto livre (persona
freelancer solo, briefing → Personas), sem máscara nem validação hoje
(`components/onboarding/step-organization.tsx`). Validar dígito verificador
adicionaria uma camada de validação nova ao campo que não existe hoje e não é
necessária para decidir se dispara a consulta — a própria BrasilAPI já rejeita CNPJ
inválido (a rota pública trata isso como 404, "CNPJ não encontrado").
Impacto: novo trecho de lógica no passo 1 do onboarding (Bloco 8), não em
`lib/public-form/cpf-cnpj.ts` (aquele módulo é do formulário público, valida dígito
verificador para um propósito diferente — antispam do endpoint público — e não deve
ganhar um uso novo aqui sem necessidade).

### Regime Tributário #7 — falha/timeout degrada silenciosamente, nunca bloqueia o avanço — decidido em 2026-08-02

Decisão: falha de rede, timeout ou resposta de erro da BrasilAPI durante a detecção
degrada para "nenhuma sugestão automática" (passo 2 abre sem regime pré-marcado,
usuário escolhe manualmente) e **nunca** bloqueia o avanço do passo 1 para o passo 2.
Porquê: o único precedente de fluxo assíncrono no wizard hoje é a saída do passo 4
(`advancePastPaymentStep`, `components/onboarding/onboarding-wizard.tsx`), que bloqueia
o avanço em erro (`toast.error` + permanece no passo) — esse padrão foi avaliado e
descartado explicitamente para a detecção de CNPJ: lá o bloqueio é correto porque a
organização está sendo criada de verdade (efeito colateral que não pode falhar
silenciosamente); aqui a consulta é só uma sugestão de UX sobre um campo que o usuário
sempre pode preencher manualmente no passo 2 — bloquear o onboarding por causa de uma
API de terceiro indisponível não se justifica.
Impacto: novo trecho de lógica no passo 1 do onboarding (Bloco 8) — timeout explícito
na chamada (a chamada não deve ficar pendurada sem prazo), catch silencioso sem toast
de erro voltado ao usuário.

### Regime Tributário #8 — escopo do gatilho (contagem de dígitos + disparo) é Bloco 8, não Bloco 7 — decidido em 2026-08-02

Decisão: a distinção CNPJ/CPF por contagem de dígitos e o gatilho da detecção no passo
1 (decisões #6 e #7 acima) entram no escopo do **Bloco 8**. O Bloco 7 cobre o serviço de
detecção em si (client de BrasilAPI extraído — decisão #4 — mapeamento
`porte`/`opcao_pelo_simples`/`opcao_pelo_mei` → `TaxRegime` sugerido, e o pré-marcar da
opção no passo 2). O Bloco 8 é quem liga esse serviço ao campo de texto livre do passo 1
que hoje não dispara nada.
Porquê: é trabalho novo no passo 1 (que hoje não tem nenhuma lógica de CNPJ/CPF, nem
máscara, nem chamada de rede — ver investigação anterior), não uma religação de algo
existente; separar do Bloco 7 mantém o serviço de detecção testável isoladamente antes
de acoplá-lo ao trigger de UI.
Impacto: escopo do Bloco 7 vs. Bloco 8 no plano de execução (a confirmar em
`docs/PLAN.md` quando os blocos forem abertos).

### Regime Tributário #9 — serviço final: tri-estado, status atual (sem checar exclusão), cache com TTL — decidido em 2026-08-02

Decisão: `lib/tax-engine/regime-detection.ts` (novo arquivo, separado de
`onboarding-templates.ts`) concentra o serviço de detecção:
- `classifyCnpjRegime`/`detectRegimeFromCnpj` devolvem um tipo de **três estados**
  (`"mei" | "simples_nacional" | "nao_detectado"`), nunca `TaxRegime | null` — Lucro
  Presumido/Lucro Real nunca são um resultado possível desta função.
- A classificação usa só `opcao_pelo_mei`/`opcao_pelo_simples` **atuais** —
  `data_exclusao_do_mei`/`data_exclusao_do_simples` deliberadamente NÃO entram na
  regra, mesmo existindo no tipo. Decisão explícita do usuário: o booleano da
  BrasilAPI já reflete o status corrente: não cruzar com data de exclusão.
- `detectRegimeFromCnpj` nunca lança — qualquer falha (rede, timeout, HTTP não-2xx) é
  capturada, logada via `console.error` e vira `"nao_detectado"`, o mesmo valor do caso
  "consultei e não é nem MEI nem Simples". A tela nunca recebe `undefined` nem uma
  exceção não tratada.
- Cache em memória por processo, chave = CNPJ (só dígitos), TTL de 5 minutos —
  cobre tanto resultado positivo quanto falha (evita martelar uma API fora do ar
  dentro da janela). Best-effort: não sobrevive a reinício do processo nem é
  compartilhado entre instâncias em deploy multi-instância — aceitável por ser só
  sugestão de UX. Chave por valor (não por tempo de navegação no wizard): voltar ao
  passo 1 sem mudar o CNPJ não gera nova chamada; mudar o CNPJ gera uma chave nova,
  então sempre consulta.
- Timeout de `fetch` (`lib/integrations/brasil-api.ts`, `CNPJ_LOOKUP_TIMEOUT_MS`) em
  4000ms — valor inicial conservador, número exato a revisar depois (pedido explícito
  do usuário, ainda não fechado).
Porquê: registrado em resposta às perguntas 2–6 do usuário sobre o plano do serviço de
detecção (não confundir MEI com Simples genérico — MEI é SIMEI, subconjunto com regras
próprias; usar status atual, não histórico de exclusão; cache por TTL para não
reconsultar a cada tecla).
Impacto: `lib/tax-engine/regime-detection.ts` (novo), `lib/integrations/brasil-api.ts`
(`CNPJ_LOOKUP_TIMEOUT_MS`), `lib/tax-engine/actions.ts` (`detectTaxRegimeFromCnpjAction`
vira wrapper fino), `lib/tax-engine/onboarding-templates.ts` (a função de mapeamento
que vivia aqui foi removida — superada pela de `regime-detection.ts`).
