# Motor de imposto configurável — briefing de implementação (V1)

Módulo autônomo para sistemas que emitem orçamento, proposta ou nota de venda de produto no Brasil. Não depende do produto hospedeiro: assume apenas que existe uma organização (empresa usuária), um catálogo de produtos com preço, e um documento de venda com itens.

---

## 1. Objetivo

Calcular e destacar tributos em documentos de venda de produto para qualquer empresa brasileira — do MEI e do Simples Nacional (que não destacam nada, só imprimem a nota de transparência) até a revenda no Lucro Presumido ou no Lucro Real, com ICMS por fora e IPI embutido no preço de tabela — **sem alteração de código, apenas configuração por organização**. O mesmo motor, o mesmo schema e o mesmo caminho de cálculo atendem os quatro regimes; o que muda é o conteúdo de duas tabelas. Nenhum dos quatro regimes exige mudança no cálculo em si (`resolveRate`/`calcTax` não sabem o que é "regime") — ver decisões registradas em `.claude/skills/decisao-pendente/references/decisoes-registradas.md`, seção "Regime Tributário".

---

## 2. Princípio central: regras, não colunas

O erro comum é cravar o regime fiscal no schema: `products.ipi_rate`, `products.ncm`, `quote_items.icms_valor`. Isso amarra o sistema a um segmento — quem não tem IPI carrega coluna morta, e quem tem um terceiro tributo precisa de migration.

Aqui, **cada tributo que a empresa usa é uma linha de configuração**, não uma coluna. Uma regra (`tax_types`) tem:

- **Código e rótulo livres** — `ICMS`, `IPI`, `ISS`, ou qualquer coisa que o contador da empresa chame de tributo. O motor não conhece nenhum deles por nome.
- **Modo de cálculo** — `inclusive` (o preço do catálogo já contém o imposto; extrai-se a base) ou `exclusive` (o imposto é somado ao preço).
- **Origem da alíquota**, resolvida por hierarquia de especificidade:
  1. **Padrão da empresa** — alíquota única, vale para tudo que não tiver override.
  2. **Categoria** — a empresa cria suas categorias e define alíquota por categoria. É o substituto genérico do NCM: mesma função (agrupar produtos com tributação igual), sem obrigar ninguém a classificar mercadoria pela TIPI.
  3. **Produto** — override mais específico, inclusive para isenção pontual (ex.: item já tributado por substituição tributária upstream).

O nível mais específico vence. Um override existente com alíquota **0 é um override válido** e vence a categoria — isso não é um "vazio" que cai para o nível de cima.

### Não cumulativo (V1)

Cada tributo é calculado **isoladamente sobre a base do item**. Nunca sobre a base, o valor ou o total de outro tributo. Se a empresa configura ICMS e IPI, os dois olham para o mesmo preço de partida; não há ordem de aplicação, não há imposto sobre imposto. Isso torna o cálculo comutativo e o resultado independente de `display_order`.

---

## 3. Modelo de dados

DDL em PostgreSQL. Tipos e nomes são portáveis; adapte `uuid`/`org_id` ao que o sistema hospedeiro já usa.

```sql
-- Categorias de produto da organização. Substituto genérico do NCM.
create table product_categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

-- Produto NÃO ganha nenhuma coluna fiscal. Só o vínculo de categoria.
alter table products
  add column category_id uuid references product_categories(id) on delete set null;
create index on products (category_id);
```

```sql
-- Uma linha por tributo que a organização usa. Vazio = organização sem destaque.
create table tax_types (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  code          text not null,                    -- 'ICMS', 'IPI', 'ISS' — livre
  label         text not null,                    -- rótulo impresso no documento
  mode          text not null
                check (mode in ('inclusive', 'exclusive')),
  default_rate  numeric(7,4) not null default 0   -- alíquota da organização, em %
                check (default_rate >= 0 and default_rate <= 100),
  active        boolean not null default true,
  display_order smallint not null default 0,      -- só ordem de impressão
  footer_note   text,                             -- texto informativo opcional
  created_at    timestamptz not null default now(),
  unique (org_id, code)
);
create index on tax_types (org_id) where active;
```

`footer_note` cobre o caso "não destaco nada, mas preciso imprimir uma frase" (Lei da Transparência, Lei 12.741/2012). Uma organização pode ter zero `tax_types` ativos e mesmo assim precisar da nota — ver §6, template Simples Nacional, onde a nota vive no nível da organização.

```sql
-- Overrides de alíquota. Exatamente um de category_id / product_id preenchido.
create table tax_rates (
  id           uuid primary key default gen_random_uuid(),
  tax_type_id  uuid not null references tax_types(id) on delete cascade,
  category_id  uuid references product_categories(id) on delete cascade,
  product_id   uuid references products(id) on delete cascade,
  rate         numeric(7,4) not null
               check (rate >= 0 and rate <= 100),
  note         text,          -- ex.: 'ICMS-ST recolhido pelo fabricante'
  created_at   timestamptz not null default now(),
  constraint tax_rates_exactly_one_scope
    check ((category_id is null) <> (product_id is null))
);

-- Um override por escopo por tributo.
create unique index tax_rates_uniq_category
  on tax_rates (tax_type_id, category_id) where category_id is not null;
create unique index tax_rates_uniq_product
  on tax_rates (tax_type_id, product_id)  where product_id is not null;
```

```sql
-- Configuração da organização (ou colunas na tabela organizations existente).
create table tax_settings (
  org_id             uuid primary key references organizations(id) on delete cascade,
  document_footer    text,     -- nota de tributos aproximados, quando aplicável
  show_tax_lines     boolean not null default true,
  updated_at         timestamptz not null default now()
);
```

### Snapshot no documento de venda

O documento emitido é **fotografia, não consulta**. Depois de emitido, ele nunca lê `tax_types` / `tax_rates` de novo — nem para reimprimir, nem para exportar, nem se a alíquota mudar amanhã.

```sql
-- Uma linha por (item × tributo) aplicado no momento da emissão.
create table quote_item_taxes (
  id             uuid primary key default gen_random_uuid(),
  quote_item_id  uuid not null references quote_items(id) on delete cascade,

  -- Cópia literal da regra, não FK "viva". tax_type_id fica só para auditoria.
  tax_type_id    uuid,                       -- sem FK forte; pode ser deletado depois
  tax_code       text not null,
  tax_label      text not null,
  mode           text not null check (mode in ('inclusive', 'exclusive')),

  rate_applied   numeric(7,4) not null,
  rate_source    text not null
                 check (rate_source in ('org_default', 'category', 'product')),
  note           text,

  base_amount    numeric(18,6) not null,     -- base da linha (já × quantidade)
  tax_amount     numeric(18,6) not null,     -- imposto da linha

  created_at     timestamptz not null default now()
);
create index on quote_item_taxes (quote_item_id);
```

```sql
alter table quote_items
  add column unit_price_charged numeric(18,6) not null,  -- preço do catálogo aplicado
  add column unit_base_display  numeric(18,6) not null,  -- unitário mostrado ao cliente
  add column line_total         numeric(18,6) not null;  -- o que entra no total

alter table quotes
  add column tax_snapshot_at    timestamptz,   -- quando a config foi congelada
  add column tax_footer_note    text;          -- cópia do rodapé vigente na emissão
```

**Precisão.** Internamente tudo é `numeric(18,6)`; a exibição arredonda para 2 casas (half-up, convenção de moeda no Brasil). Nunca persista o valor já arredondado como fonte de verdade — arredondar cedo é o que faz `base + imposto` deixar de reconstruir o preço original. Em TypeScript, use uma lib decimal (`decimal.js`, `big.js`) ou inteiros em centésimos de centavo; `number` de ponto flutuante acumula erro em somas longas de documento.

---

## 4. Hierarquia de resolução da alíquota

```ts
type TaxMode = 'inclusive' | 'exclusive';
type RateSource = 'org_default' | 'category' | 'product';

interface TaxType {
  id: string;
  code: string;
  label: string;
  mode: TaxMode;
  defaultRate: number;   // %
  active: boolean;
  displayOrder: number;
}

interface TaxRateOverride {
  taxTypeId: string;
  categoryId: string | null;
  productId: string | null;
  rate: number;          // %
  note: string | null;
}

interface Product {
  id: string;
  categoryId: string | null;
  price: number;
}

interface ResolvedRate {
  rate: number;
  source: RateSource;
  note: string | null;
}

/**
 * Produto vence categoria, que vence o padrão da organização.
 * Um override com rate = 0 É um override: vence normalmente e não
 * cai para o nível de cima. Isenção pontual depende disso.
 */
function resolveRate(
  taxType: TaxType,
  product: Product,
  overrides: TaxRateOverride[],
): ResolvedRate {
  // 1. Override no produto — nível mais específico.
  const byProduct = overrides.find(
    (o) => o.taxTypeId === taxType.id && o.productId === product.id,
  );
  if (byProduct) {
    return { rate: byProduct.rate, source: 'product', note: byProduct.note };
  }

  // 2. Override na categoria do produto.
  if (product.categoryId) {
    const byCategory = overrides.find(
      (o) => o.taxTypeId === taxType.id && o.categoryId === product.categoryId,
    );
    if (byCategory) {
      return { rate: byCategory.rate, source: 'category', note: byCategory.note };
    }
  }

  // 3. Padrão da organização.
  return { rate: taxType.defaultRate, source: 'org_default', note: null };
}
```

Passos, em prosa, para quem for portar para outra linguagem:

1. Procure em `tax_rates` a linha com este `tax_type_id` e `product_id` = produto do item. Achou → devolva (`source = 'product'`), mesmo que `rate` seja 0.
2. Não achou, e o produto tem categoria → procure a linha com este `tax_type_id` e `category_id` = categoria do produto. Achou → devolva (`source = 'category'`).
3. Não achou → devolva `tax_types.default_rate` (`source = 'org_default'`).

Produto sem categoria pula direto do passo 1 para o 3. Tributo inativo (`active = false`) nem entra no laço.

---

## 5. Fórmulas

```ts
interface TaxLine {
  base: number;    // base de cálculo do item
  tax: number;     // valor do imposto
  gross: number;   // o que o cliente paga por este item
}

/**
 * Calcula um tributo isolado sobre o preço unitário.
 * Não cumulativo: `price` é sempre o preço de catálogo do item,
 * jamais o resultado de outro tributo.
 * rate = 0 é neutro nos dois modos — sem branch especial.
 */
function calcTax(price: number, rate: number, mode: TaxMode): TaxLine {
  if (mode === 'inclusive') {
    // O preço de catálogo JÁ contém o imposto: extrai-se a base.
    const base = price / (1 + rate / 100);
    const tax = base * (rate / 100);
    return { base, tax, gross: price };      // base + tax === price
  }
  // 'exclusive': o imposto é somado ao preço.
  const tax = price * (rate / 100);
  return { base: price, tax, gross: price + tax };
}
```

**Por dentro (`inclusive`)**

```
base          = preço / (1 + alíquota/100)
valor_imposto = base × alíquota/100
```

O unitário **exibido ao cliente é a base**; o imposto aparece em linha separada; `base + valor_imposto` reconstrói exatamente o preço cheio do catálogo. O cliente não vê o preço subir — vê a decomposição do preço que já era.

**Por fora (`exclusive`)**

```
valor_imposto = preço × alíquota/100
total         = preço + valor_imposto
```

O unitário exibido é o preço do catálogo; o imposto soma por cima.

**Alíquota zero.** Em `inclusive`, `1 + 0/100 = 1` → base = preço, imposto = 0. Em `exclusive`, imposto = 0 → total = preço. Nos dois modos a fórmula sobrevive sem `if`. Isenção é configuração, não caso especial no código.

**Arredondamento e quantidade.** Calcule sobre o valor da **linha** (`preço unitário × quantidade`), não por unidade com arredondamento intermediário. Exemplo: 7 unidades a R$ 100 com IPI embutido de 5%.

| Estratégia | Base | Imposto | Total |
|---|---:|---:|---:|
| Por linha: `700 / 1,05` | 666,67 | 33,33 | 700,00 |
| Por unidade arredondada: `95,24 × 7` | 666,68 | 33,32 | 700,00 |

O total fecha nas duas, mas a base diverge em R$ 0,01. Padronize **por linha** e persista com 6 casas; arredonde só na renderização e na soma do rodapé.

---

## 6. Regime Tributário (onboarding)

O passo 2 do onboarding pergunta o **Regime Tributário** da organização — MEI, Simples Nacional, Lucro Real ou Lucro Presumido — e usa a resposta como preset inicial de `tax_types`/`tax_rates`/`tax_settings`. São inserts, não código: cada regime abaixo tem sua própria entrada em `buildTaxTemplatePlan` (`lib/tax-engine/onboarding-templates.ts`), mesmo quando duas coincidem no conteúdo inicial, porque podem divergir depois (ex.: Lucro Real e PIS/COFINS não-cumulativo, hoje fora de escopo — §8, §10).

**"Regime tributário" é metadado da organização, não dado de cálculo.** Ele determina qual preset roda no onboarding e orienta a UI (ex.: `organizations.tax_regime`, exibido/editável depois na tela de configuração) — o motor de cálculo (`resolveRate`/`calcTax`) continua sem conhecer regime por nome, e resolve alíquota exclusivamente pela hierarquia produto > categoria > padrão da organização (§4). Nenhuma linha de código do motor lê `tax_regime`.

Todas as alíquotas abaixo são **sugestão inicial**, não verdade fiscal: a organização (ou o contador dela) precisa confirmar e ajustar em `/settings/taxes` antes de emitir com valor real — §9 continua valendo integralmente, inclusive para quem chegou pelo fluxo de regime.

### MEI

Nenhum `tax_type`. Só o rodapé informativo — MEI não destaca tributo no documento de venda.

```sql
insert into tax_settings (org_id, document_footer, show_tax_lines)
values (:org, 'Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.', false);
```

Documento sai sem nenhuma linha de imposto; o total é o preço de catálogo; a frase aparece no rodapé. **Sugestão a confirmar:** o texto do rodapé é o modelo genérico da Lei 12.741/2012 — se o contador da organização quiser outro texto (ou nenhum), é ajustável em `/settings/taxes` depois do onboarding.

### Simples Nacional

Mesmo preset do MEI — nenhum `tax_type`, só o rodapé informativo. É o comportamento correto para a maioria das empresas do Simples, que não destacam tributo no orçamento.

```sql
insert into tax_settings (org_id, document_footer, show_tax_lines)
values (:org, 'Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.', false);
```

**Sugestão a confirmar:** existem empresas do Simples que destacam algum tributo específico (raro, mas possível conforme o anexo/atividade) — isso não é resolvido pelo regime sozinho; o contador precisa avaliar e, se for o caso, cadastrar o tributo manualmente em `/settings/taxes` depois do onboarding.

### Lucro Presumido

ICMS por fora no padrão da empresa, IPI embutido por categoria — caso típico de revenda.

```sql
insert into tax_types (org_id, code, label, mode, default_rate, display_order)
values
  (:org, 'ICMS', 'ICMS', 'exclusive', 18.0000, 1),
  (:org, 'IPI',  'IPI',  'inclusive',  0.0000, 2);

-- IPI de 5% só na categoria que tem industrialização; demais ficam em 0.
insert into tax_rates (tax_type_id, category_id, rate)
values (:ipi_id, :categoria_industrializados, 5.0000);
```

Note o IPI com `default_rate = 0`: a organização usa o tributo, mas ele só incide onde houver override de categoria. Zero como padrão é o jeito de dizer "existe, mas não incide por omissão". **Sugestão a confirmar:** os 18% de ICMS e os 5% de IPI são valores de exemplo do briefing, não a alíquota real de nenhuma organização — o contador confirma a alíquota de ICMS do estado/produto e quais categorias realmente têm IPI antes da primeira emissão real.

### Lucro Real

Mesmo conteúdo inicial do Lucro Presumido — ICMS por fora, IPI embutido por categoria —, mas com entrada própria (`"lucro-real"`) em `buildTaxTemplatePlan`, não um alias de `"icms-ipi"`.

```sql
insert into tax_types (org_id, code, label, mode, default_rate, display_order)
values
  (:org, 'ICMS', 'ICMS', 'exclusive', 18.0000, 1),
  (:org, 'IPI',  'IPI',  'inclusive',  0.0000, 2);

-- IPI de 5% só na categoria que tem industrialização; demais ficam em 0.
insert into tax_rates (tax_type_id, category_id, rate)
values (:ipi_id, :categoria_industrializados, 5.0000);
```

**Sugestão a confirmar:** mesma ressalva do Lucro Presumido — ICMS e IPI de exemplo, a confirmar com o contador. A entrada própria existe porque Lucro Real e Lucro Presumido só coincidem por acaso no V1; PIS/COFINS não-cumulativo (regime típico de parte do Lucro Real) está fora de escopo hoje (§8) e, se entrar no V2, muda só o preset do Lucro Real, sem tocar no do Lucro Presumido.

### Fora do fluxo de regime: preset "Isento"

`tax_types` vazio, sem rodapé — não é uma das quatro opções do passo 2, fica disponível como ajuste manual em `/settings/taxes` para quem não se encaixa em nenhum regime (venda interna, teste do produto, serviço não tributado no destaque).

```sql
insert into tax_settings (org_id, document_footer, show_tax_lines)
values (:org, null, false);
```

---

## 7. Exemplos numéricos

Item de R$ 100,00, quantidade 1, nos três cenários.

| Cenário | Configuração | Resultado |
|---|---|---|
| Revenda no Simples Nacional | Nenhum tributo destacado; só texto de "tributos aproximados" | Cliente paga **R$ 100,00**; nota de rodapé, sem linha de cálculo |
| Revenda com IPI embutido | IPI por categoria, `inclusive`, 5% | Base **R$ 95,24** + IPI **R$ 4,76** em linha separada = **R$ 100,00** |
| Revenda com ICMS por fora + item isento por ST | ICMS por categoria, `exclusive`, 18%; produto específico com override 0% + nota | Produto normal: **R$ 118,00**. Produto marcado: **R$ 100,00** |

### 7.1 Simples Nacional — sem destaque

`tax_types` vazio para a organização. O laço de tributos do item não itera nenhuma vez; `quote_item_taxes` fica sem linhas.

```
unit_price_charged = 100,000000
unit_base_display  = 100,000000
line_total         = 100,000000
```

O documento imprime uma linha só: `Produto X — 1 × R$ 100,00 — R$ 100,00`. No rodapé, copiado de `tax_settings.document_footer` para `quotes.tax_footer_note` no momento da emissão:

> Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.

Não há cálculo nenhum — a nota é texto, não resultado. Se a empresa quiser o percentual estimado dentro da frase, ela escreve o percentual na frase; o motor não o produz no V1.

### 7.2 IPI embutido no preço — `inclusive`, 5%

`resolveRate` acha override na categoria do produto → `{ rate: 5, source: 'category' }`.

```
base          = 100 / (1 + 5/100) = 100 / 1,05 = 95,238095…  → 95,238095
valor_imposto = 95,238095… × 0,05 =  4,761904…  →  4,761905
conferência   = 95,238095… + 4,761904… = 100,000000  ✓
```

Exibido ao cliente (2 casas):

| Linha | Valor |
|---|---:|
| Produto X — 1 un. (unitário R$ 95,24) | R$ 95,24 |
| IPI 5% | R$ 4,76 |
| **Total** | **R$ 100,00** |

O preço de catálogo era R$ 100 e o cliente paga R$ 100. O que mudou foi a apresentação: o unitário exibido virou a base, e o imposto ganhou linha própria. `95,24 + 4,76 = 100,00` fecha na exibição porque o arredondamento é half-up e a soma é feita sobre os valores de 6 casas antes de renderizar.

Snapshot gravado:

```
quote_item_taxes: tax_code='IPI', mode='inclusive', rate_applied=5.0000,
                  rate_source='category',
                  base_amount=95.238095, tax_amount=4.761905
quote_items:      unit_price_charged=100.000000,
                  unit_base_display=95.238095, line_total=100.000000
```

### 7.3 ICMS por fora + produto isento por ST — `exclusive`, 18%

Configuração: `tax_type` ICMS, `mode = 'exclusive'`; override de **18% na categoria**; e, num produto específico dessa mesma categoria, override de **0% com nota**.

**Produto normal** (só o override de categoria se aplica):

```
resolveRate → { rate: 18, source: 'category' }
valor_imposto = 100 × 0,18 = 18,000000
total         = 100 + 18   = 118,000000
```

| Linha | Valor |
|---|---:|
| Produto Y — 1 un. | R$ 100,00 |
| ICMS 18% | R$ 18,00 |
| **Total** | **R$ 118,00** |

**Produto marcado como ST** (override de produto vence a categoria):

```
resolveRate → { rate: 0, source: 'product',
                note: 'ICMS-ST recolhido pelo fabricante' }
valor_imposto = 100 × 0 = 0,000000
total         = 100 + 0 = 100,000000
```

| Linha | Valor |
|---|---:|
| Produto Z — 1 un. | R$ 100,00 |
| ICMS 0% — ICMS-ST recolhido pelo fabricante | R$ 0,00 |
| **Total** | **R$ 100,00** |

Dois pontos que a implementação precisa acertar aqui:

1. O passo 1 de `resolveRate` encontra a linha de produto com `rate = 0` e **para**. Se o código tratar 0 como "sem valor" (`if (byProduct?.rate)`, `||`, coalescência frouxa), ele cai para a categoria e cobra 18% num item que não deve ser tributado. Teste isso explicitamente.
2. A `note` do override sobe para `quote_item_taxes.note` e é impressa junto da linha do tributo. É ela que explica ao cliente por que o item aparece zerado — sem a nota, a linha de R$ 0,00 parece erro. A alternativa (esconder linhas com valor zero) é decisão de apresentação; se adotada, a nota precisa aparecer em outro lugar do documento.

---

## 8. Fora de escopo do V1

| Item | Por que fica de fora |
|---|---|
| **ICMS-ST como cálculo** (MVA/IVA-ST, pauta fiscal, redução de base) | Exige base de MVA por NCM × UF de origem × UF de destino e fórmula própria (`base_ST = (valor + frete + IPI) × (1 + MVA)`), que não cabe em "alíquota única com hierarquia". No V1, ST se resolve como **override manual de alíquota zero + nota** — que é o que a maioria das revendas precisa no orçamento. |
| **DIFAL em venda interestadual** | Depende da UF do destinatário, da condição de contribuinte dele e das alíquotas interestaduais; muda a estrutura do cálculo (partilha entre origem e destino), não só o número. |
| **PIS/COFINS monofásico** | Regime por produto com alíquota concentrada no início da cadeia; modelar como tributo comum produz destaque incorreto. |
| **Cumulatividade entre tributos** | Todo tributo do V1 calcula sobre a base do item. Base de um tributo composta pelo valor de outro fica para V2. |
| **Cálculo do percentual da Lei da Transparência** | V1 imprime o texto configurado pela empresa; não estima o percentual. |

O V1 cobre bem a **venda de produto padrão dentro do estado, sem regime especial** — que é a maior parte do volume de orçamento em revenda.

---

## 9. Onde está o limite (leia antes de prometer qualquer coisa)

O sistema **não decide** se um produto é ST, qual a alíquota de ICMS aplicável no estado da empresa, se um item tem redução de base, nem se aquela venda interestadual exige DIFAL. Quem configura — a empresa ou o contador dela — precisa trazer essas respostas.

O que o motor garante: **uma vez configurado, o cálculo sai certo, consistente entre documentos, e congelado no que foi emitido.** O que ele não garante: que a resposta fiscal em si está correta.

Isso não é uma limitação envergonhada, é a divisão de responsabilidade padrão do mercado — nenhum ERP genérico "sabe" sozinho a legislação de cada estado, cada NCM e cada regime. A interface de configuração deve deixar isso explícito para o usuário (texto de ajuda no cadastro do tributo: "confirme as alíquotas com seu contador"), e o documento gerado não deve se apresentar como documento fiscal válido se não for.

---

## 10. Registrado para V2

Integração com a tabela pública do **IBPT** (Instituto Brasileiro de Planejamento e Tributação) como **sugestão automática** de alíquota aproximada por NCM/categoria na tela de cadastro — o usuário aceita ou sobrescreve. Reduz trabalho manual de configuração sem transformar o módulo num projeto de compliance. Não é V1, e não muda o modelo de dados acima: entra como preenchimento sugerido de `tax_rates.rate`.

---

## 11. Perguntas em aberto para quem implementar

1. **Validação de alíquota.** Os `CHECK (rate between 0 and 100)` do DDL barram negativo e absurdo no banco. Falta decidir: a camada de serviço replica a validação com mensagem amigável, ou confia no erro de constraint? E existe teto de negócio abaixo de 100 (ex.: avisar acima de 40%) — bloqueio ou warning?

2. **Versionamento de alteração de alíquota.** O documento emitido é snapshot e não recalcula — isso resolve o passado. Falta decidir o presente: alterar `tax_rates.rate` sobrescreve a linha (perde histórico) ou insere versão nova com `valid_from` e a leitura pega a vigente? A segunda opção é mais correta em auditoria e mais cara em consulta. Recomendação: começar com sobrescrita + tabela de log de alteração, e migrar para `valid_from` se auditoria exigir.

3. **Rascunho vs emitido.** Enquanto o orçamento está em rascunho, ele deve refletir mudanças de configuração ou já congelar na criação? Proposta: rascunho recalcula a cada abertura; a emissão (`tax_snapshot_at`) congela. Precisa estar decidido antes de escrever a camada de leitura.

4. **Duplicar orçamento antigo.** Ao clonar um documento emitido há seis meses, o novo herda as alíquotas do snapshot ou recalcula com a configuração atual? Recalcular é quase certamente o certo, mas precisa ser explícito na UI (avisar que os valores mudaram).

5. **Produto muda de categoria depois da emissão.** O snapshot protege o documento, mas relatórios que fazem `join` de `quote_item_taxes` com `products`/`product_categories` vão mostrar a categoria atual, não a vigente. Vale copiar `category_id`/nome da categoria para o snapshot?

6. **Arredondamento em quantidade fracionária.** §5 padroniza cálculo por linha. Falta definir o comportamento com quantidade decimal (2,5 kg) e se o unitário exibido em modo `inclusive` é a base por unidade arredondada (que pode não multiplicar exatamente pelo total da linha — precisa de nota de rodapé ou de aceitar a divergência de centavo).

7. **Agregação no total do documento.** Somar `tax_amount` por `tax_code` e mostrar um bloco de totais por tributo, ou só o total geral? Em modo `inclusive` o "total de impostos" não soma ao total a pagar — a UI precisa deixar isso claro para não parecer cobrança dupla.

8. **Tributo excluído depois da emissão.** `quote_item_taxes.tax_type_id` propositalmente não tem FK forte. Confirmar que nenhuma tela do documento faz `join` obrigatório com `tax_types` — todo dado necessário para reimprimir já está copiado na linha do snapshot.
