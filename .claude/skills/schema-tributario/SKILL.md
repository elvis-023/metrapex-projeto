---
name: schema-tributario
description: Use esta skill sempre que for mexer no schema do motor de imposto — criar ou alterar tabela, escrever migration, modelar entidade nova, adicionar coluna, mexer em `products`, `quotes` ou `quote_items`, criar `tax_types` / `tax_rates` / `product_categories` / `tax_settings`, definir tipos numéricos (numeric, decimal, precisão de alíquota ou de valor), decidir sobre foreign key, unique, check ou índice no domínio fiscal, ou escrever seeds/templates de onboarding de organização (Simples Nacional, MEI, Isento, ICMS + IPI). Também vale quando alguém propõe guardar alíquota, NCM, IPI, ICMS, ISS, ST, CFOP ou CST numa coluna de produto ou de item de venda.
---

# Schema do motor tributário: regras, não colunas

## A regra de ouro

**Cada tributo que a empresa usa é uma LINHA em `tax_types`. Nunca uma coluna.**

O motor não conhece nenhum tributo por nome. `ICMS`, `IPI`, `ISS` são texto livre digitado pelo usuário em `tax_types.code` / `tax_types.label`. Se o seu código, o seu schema ou a sua migration precisa saber que existe algo chamado "IPI", o desenho está errado.

Consequência direta: MEI no Simples, revenda com IPI embutido e revenda com ICMS por fora passam pelo **mesmo caminho de código e pelo mesmo schema**. A diferença vive no conteúdo de duas tabelas (`tax_types`, `tax_rates`), nunca em branch por regime nem em coluna nova.

## Colunas proibidas

Nunca crie, nunca aceite em revisão, nunca "só por enquanto":

- `products.ipi_rate`, `products.icms_rate`, `products.iss_rate`
- `products.ncm`, `products.cest`, `products.cfop`, `products.cst`, `products.origem`
- `products.st`, `products.substituicao_tributaria`, `products.isento`
- `quote_items.icms_valor`, `quote_items.ipi_valor`, `quote_items.base_icms`
- `quotes.total_impostos_icms`, `quotes.valor_ipi`
- qualquer coluna com sufixo `_rate`, `_aliquota`, `_valor`, `_base`, `_st` **cujo prefixo seja o nome de um tributo**
- qualquer coluna, em qualquer tabela, nomeada por um tributo específico

Alíquota mora em `tax_types.default_rate` (padrão da organização) ou em `tax_rates.rate` (override por categoria ou por produto). Valor calculado mora em `quote_item_taxes`, uma linha por (item × tributo), com o código do tributo **como dado**, não como nome de coluna.

## `products` ganha exatamente uma coluna nova

```sql
alter table products
  add column category_id uuid references product_categories(id) on delete set null;
```

Só isso. Produto **não ganha nenhuma coluna fiscal**.

## Categoria substitui NCM

A organização cria as próprias `product_categories` (`unique (org_id, name)`) e configura alíquota por categoria em `tax_rates`. É o substituto genérico do NCM: mesma função de agrupar produtos com tributação igual, **sem obrigar ninguém a classificar mercadoria pela TIPI**.

Não crie tabela de NCM, não importe TIPI, não valide formato de NCM. Se um dia entrar IBPT (V2), ele entra apenas como *sugestão de preenchimento* de `tax_rates.rate` — sem tocar no modelo de dados.

## Hierarquia de alíquota (o schema tem que permitir os três níveis)

produto > categoria > padrão da organização.

- Produto e categoria: linhas em `tax_rates`, com `constraint tax_rates_exactly_one_scope check ((category_id is null) <> (product_id is null))` e um unique parcial por escopo.
- Padrão: `tax_types.default_rate`.

`rate = 0` é um override **válido** (isenção por ST). O schema precisa permitir gravar zero e o código de leitura precisa tratar "linha existe" e não "rate é truthy". Nunca modele ausência de override como `rate = null` nem como `rate = 0` — ausência é **ausência de linha**.

## Tipos numéricos

| Coisa | Tipo | Por quê |
|---|---|---|
| Alíquota em % | `numeric(7,4)` + `check (rate >= 0 and rate <= 100)` | 4 casas cobrem alíquota efetiva; check barra negativo e absurdo |
| Base, imposto, preço, total de linha | `numeric(18,6)` | 6 casas para `base + imposto` reconstruir o preço de catálogo |
| Ordem de impressão | `smallint` | `display_order` é só ordenação de impressão, não ordem de cálculo |

Nunca persista valor já arredondado como fonte de verdade. Arredondar para 2 casas (half-up) acontece **só na renderização e na soma do rodapé**. Não crie coluna `numeric(18,2)` para valor de imposto ou base — é aí que `base + imposto` deixa de fechar com o preço.

## FK: onde é forte e onde não é

- `tax_rates.tax_type_id` → FK forte, `on delete cascade`. Override sem tributo não faz sentido.
- `tax_rates.category_id` / `product_id` → FK forte, `on delete cascade`.
- `products.category_id` → FK, `on delete set null`.
- `quote_item_taxes.tax_type_id` → **sem FK**, de propósito. É snapshot; o tributo pode ser deletado depois e o documento antigo continua imprimível. Se você adicionar essa FK numa migration, quebrou o produto. Ver a skill `snapshot-documento`.

## Checklist de revisão de migration

Antes de aceitar qualquer coluna nova no domínio fiscal, responda as quatro:

1. **Essa coluna sobreviveria a uma empresa que usa um tributo que eu nunca ouvi falar?** Se a resposta depende de qual tributo é, é coluna morta para todo mundo que não usa aquele tributo.
2. **O motor precisaria saber o nome do tributo para ler essa coluna?** Se sim, o nome do tributo virou schema. Errado — nome de tributo é dado, digitado pelo usuário.
3. **Isso não deveria ser uma linha em `tax_rates` (ou em `tax_types`)?** Alíquota, isenção, nota explicativa e modo de cálculo são configuração — linha, não coluna.
4. **Se a empresa parar de usar esse tributo amanhã, sobra coluna nula em todas as linhas?** Se sim, é regra disfarçada de coluna: delete a linha de `tax_types` e acabou, sem migration.

Adicionar um tributo novo para uma organização **nunca** pode exigir migration. Se exigir, a proposta está fora do desenho.

## Fora de escopo do V1 — não modele por iniciativa própria

ICMS-ST como cálculo (MVA/pauta/redução de base), DIFAL interestadual, PIS/COFINS monofásico, cumulatividade entre tributos, cálculo do percentual da Lei 12.741/2012. Nada disso ganha coluna, tabela ou campo "só para depois". ST no V1 se resolve como override de produto com `rate = 0` + `tax_rates.note` explicativa.

Se a implementação parecer exigir uma dessas, pare e pergunte — não estenda o schema sozinho.

## Referências

- `references/ddl.sql` — DDL PostgreSQL completo do §3 do briefing (tabelas, checks, índices, alterações em `products`, `quote_items`, `quotes`).
- `references/templates-onboarding.md` — os 3 templates do §6 como inserts documentados.

## Decisões pendentes

O §11 do briefing tem perguntas em aberto que tocam o schema — notavelmente **versionamento de alteração de alíquota** (sobrescrever `tax_rates.rate` + log vs. versão nova com `valid_from`; a recomendação é começar com sobrescrita + log) e **copiar `category_id`/nome da categoria para o snapshot**. Consulte o §11 antes de decidir sozinho; se decidir, registre a decisão em `.claude/skills/decisao-pendente/references/decisoes-registradas.md` (ver skill `decisao-pendente`).
