---
name: calculo-tributario
description: Use esta skill sempre que for implementar, alterar, revisar ou depurar o cálculo de imposto do motor tributário — fórmulas `inclusive` e `exclusive`, base de cálculo, extração de imposto do preço de catálogo, arredondamento e precisão decimal, `resolveRate`, hierarquia de alíquota produto > categoria > padrão da organização, `rate_source`, override com alíquota 0 / isenção por ST, montagem do total do item (`line_total`, `unit_base_display`), acúmulo do rodapé e totais por tributo, ou quando aparecer `tax_types`, `tax_rates`, `quote_item_taxes`, `calcTax`, "por dentro", "por fora", "imposto embutido no preço".
---

# Cálculo tributário — fórmulas, hierarquia e precisão

Fonte de verdade: `briefing-motor-impostos.md` §4 (hierarquia), §5 (fórmulas), §7 (exemplos numéricos). Esta skill é o resumo acionável; em conflito, o briefing vence.

## 1. As duas fórmulas

O motor tem exatamente dois modos. Nenhum outro. `rate` é percentual (18 = 18%).

### `inclusive` — imposto por dentro (o preço de catálogo já contém o imposto)

```
base          = preço / (1 + alíquota/100)
valor_imposto = base × alíquota/100
gross         = preço            // base + valor_imposto reconstrói o preço de catálogo
```

- O unitário **exibido ao cliente é a base**, não o preço de catálogo.
- O imposto aparece em **linha separada** do documento.
- `base + valor_imposto === preço de catálogo`. **O cliente não vê o preço subir** — vê a decomposição do preço que já era.

### `exclusive` — imposto por fora (somado ao preço)

```
valor_imposto = preço × alíquota/100
base          = preço
total         = preço + valor_imposto
```

- O unitário exibido é o **preço de catálogo**.
- O imposto soma por cima.

### Sem branch para alíquota zero

`1 + 0/100 = 1` sobrevive à fórmula: em `inclusive`, `base = preço / 1 = preço` e `imposto = 0`; em `exclusive`, `imposto = 0` e `total = preço`. **Nunca** escreva `if (rate === 0)`, early-return de isenção ou caminho alternativo. Isenção é configuração, não caso especial no código. Um `if` de alíquota zero é sinal de que o modelo foi entendido errado.

Referência do briefing (§5), mantida verbatim:

```ts
function calcTax(price: number, rate: number, mode: TaxMode): TaxLine {
  if (mode === 'inclusive') {
    const base = price / (1 + rate / 100);
    const tax = base * (rate / 100);
    return { base, tax, gross: price };      // base + tax === price
  }
  const tax = price * (rate / 100);
  return { base: price, tax, gross: price + tax };
}
```

(O `number` acima é ilustrativo do briefing — na implementação real use decimal; ver §4 desta skill.)

## 2. Ordem obrigatória: por linha, nunca por unidade

**`preço unitário × quantidade` PRIMEIRO, imposto depois.** Calcular o imposto por unidade e multiplicar pela quantidade — especialmente com arredondamento intermediário — diverge a base em centavos.

Exemplo do §5: 7 unidades a R$ 100,00, IPI embutido (`inclusive`) de 5%.

| Estratégia | Base | Imposto | Total |
|---|---:|---:|---:|
| **Por linha** (correto): `700 / 1,05` | **666,67** | **33,33** | 700,00 |
| Por unidade arredondada: `95,24 × 7` | 666,68 | 33,32 | 700,00 |

O total fecha nas duas estratégias — é por isso que o bug passa despercebido. O que diverge é a **base** (R$ 0,01) e, por consequência, o `base_amount` gravado no snapshot e qualquer relatório que some base. Padronize **por linha**, persista com 6 casas, arredonde só na renderização.

## 3. Hierarquia da alíquota (`resolveRate`)

**Produto > categoria > padrão da organização.** O nível mais específico vence e a função devolve também a `source`, que é persistida em `quote_item_taxes.rate_source`.

1. Existe linha em `tax_rates` com este `tax_type_id` e `product_id` = produto do item? → devolve `{ rate, source: 'product', note }` e **para**.
2. Senão, se o produto tem categoria: existe linha com este `tax_type_id` e `category_id` = categoria do produto? → devolve `{ rate, source: 'category', note }` e **para**.
3. Senão → devolve `{ rate: taxType.defaultRate, source: 'org_default', note: null }`.

Produto sem categoria pula direto do passo 1 para o 3. Tributo com `active = false` **nem entra no laço** — não é resolvido, não gera linha de snapshot.

## 4. ⚠️ `rate = 0` é um override VÁLIDO — o bug mais caro do sistema

Um override de produto com alíquota 0 (isenção por ST) **vence a categoria e para a busca**. Não é "vazio" que cai para o nível de cima.

**ERRADO — testa a verdade do número:**

```ts
// ❌ 0 é falsy: o override de isenção é ignorado e o item cai na categoria
if (byProduct?.rate) {
  return { rate: byProduct.rate, source: 'product', note: byProduct.note };
}

// ❌ mesma falha, forma compacta
const rate = byProduct?.rate || byCategory?.rate || taxType.defaultRate;

// ❌ também errado: `?? 0` mascara a ausência e perde a `source`
const rate = byProduct?.rate ?? byCategory?.rate ?? taxType.defaultRate;
// (aqui o ?? funciona para o número, mas a `source` e a `note` se perdem —
//  o snapshot fica mentindo sobre a origem da alíquota)
```

**CERTO — testa a existência da LINHA, não o valor:**

```ts
const byProduct = overrides.find(
  (o) => o.taxTypeId === taxType.id && o.productId === product.id,
);
if (byProduct) {                       // ✅ a linha existe → vence, mesmo com rate = 0
  return { rate: byProduct.rate, source: 'product', note: byProduct.note };
}

if (product.categoryId) {
  const byCategory = overrides.find(
    (o) => o.taxTypeId === taxType.id && o.categoryId === product.categoryId,
  );
  if (byCategory) {                    // ✅ idem
    return { rate: byCategory.rate, source: 'category', note: byCategory.note };
  }
}

return { rate: taxType.defaultRate, source: 'org_default', note: null };
```

**Por que importa:** produto marcado como ST tem override de 0% justamente para não ser tributado (o ICMS já foi recolhido pelo fabricante). Com `if (byProduct?.rate)`, ele cai na alíquota da categoria — 18% — e o cliente é **cobrado indevidamente**. É erro de valor cobrado, não de exibição. Exige teste explícito (ver skill `casos-teste-fiscais`).

O mesmo vale na camada SQL: nunca use `COALESCE(NULLIF(rate, 0), ...)` nem `WHERE rate > 0` na resolução. E vale para a `note`: ela sobe para `quote_item_taxes.note` e é impressa junto da linha do tributo — sem ela, a linha de R$ 0,00 parece erro.

## 5. Precisão e arredondamento

- Internamente **tudo é `numeric(18,6)`** — 6 casas decimais.
- Arredonde para **2 casas, half-up** (convenção de moeda no Brasil) **só na renderização e na soma do rodapé**.
- **Nunca persista valor arredondado como fonte de verdade.** Arredondar cedo é exatamente o que faz `base + imposto` deixar de reconstruir o preço de catálogo e o que produz a divergência da tabela do §2.
- Em TypeScript: use `decimal.js` / `big.js`, ou inteiros em centésimos de centavo. `number` de ponto flutuante **acumula erro** em somas longas de documento. Não use `toFixed` como estratégia de cálculo.
- A soma exibida fecha (`95,24 + 4,76 = 100,00`) porque o arredondamento half-up acontece **depois** da soma sobre os valores de 6 casas.

## 6. Não cumulativo (V1)

Cada tributo calcula **isoladamente sobre a base do item** — o preço de catálogo da linha. Nunca sobre a base, o valor ou o total de outro tributo. Se a organização configura ICMS e IPI, os dois olham para o mesmo preço de partida.

Consequência testável: o cálculo é **comutativo**. O resultado independe de `display_order`, que existe **só** para ordenar a impressão. Se trocar `display_order` mudar qualquer número, a implementação virou cumulativa — bug.

## 7. Laço de referência (item e rodapé)

```ts
import Decimal from 'decimal.js';
const D = (v: Decimal.Value) => new Decimal(v);

function calcItem(item: QuoteItem, product: Product,
                  taxTypes: TaxType[], overrides: TaxRateOverride[]) {
  // 1) POR LINHA: unitário × quantidade ANTES de qualquer imposto.
  const linePrice = D(product.price).times(item.quantity);

  let baseForDisplay = linePrice;   // vira a base se houver tributo `inclusive`
  let exclusiveTotal = D(0);
  const taxes = [];

  // Tributos inativos nem entram. A ordem aqui é irrelevante (não cumulativo).
  for (const t of taxTypes.filter((t) => t.active)) {
    const { rate, source, note } = resolveRate(t, product, overrides);
    const r = D(rate).div(100);

    let base: Decimal, tax: Decimal;
    if (t.mode === 'inclusive') {
      base = linePrice.div(D(1).plus(r));   // rate = 0 → div(1) → linePrice
      tax  = base.times(r);
      baseForDisplay = base;                // o unitário exibido vira a base
    } else {
      base = linePrice;
      tax  = linePrice.times(r);
      exclusiveTotal = exclusiveTotal.plus(tax);
    }

    // Snapshot: cópia literal da regra, sem FK viva para tax_types.
    taxes.push({
      taxTypeId: t.id, taxCode: t.code, taxLabel: t.label, mode: t.mode,
      rateApplied: rate, rateSource: source, note,
      baseAmount: base.toDecimalPlaces(6),   // 6 casas, NÃO 2
      taxAmount:  tax.toDecimalPlaces(6),
    });
  }

  return {
    unitPriceCharged: D(product.price).toDecimalPlaces(6),
    unitBaseDisplay:  baseForDisplay.div(item.quantity).toDecimalPlaces(6),
    lineTotal:        linePrice.plus(exclusiveTotal).toDecimalPlaces(6),
    taxes,
  };
}
```

`inclusive` não soma ao `lineTotal` — o imposto já estava dentro do preço. Só `exclusive` soma.

```ts
const round2 = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

function documentTotals(items: ItemResult[]) {
  let total = D(0);
  const byCode = new Map<string, Decimal>();

  for (const it of items) {
    total = total.plus(it.lineTotal);                    // soma em 6 casas
    for (const t of it.taxes) {
      byCode.set(t.taxCode, (byCode.get(t.taxCode) ?? D(0)).plus(t.taxAmount));
    }
  }

  // Arredonda SÓ AQUI, na renderização.
  return {
    total: round2(total),
    taxesByCode: new Map([...byCode].map(([c, v]) => [c, round2(v)])),
  };
}
```

Rodapé de transparência (Lei 12.741/2012): é **texto configurado**, não resultado de cálculo. Vem de `tax_settings.document_footer`, copiado para `quotes.tax_footer_note` na emissão. O V1 **não estima percentual**. Organização com zero `tax_types` ativos é caso normal: o laço não itera, `quote_item_taxes` fica sem linhas, e só o rodapé aparece.

## 8. Limites — não implemente por iniciativa própria

Fora do V1: ICMS-ST como cálculo (MVA/pauta/redução de base), DIFAL interestadual, PIS/COFINS monofásico, cumulatividade entre tributos, cálculo do percentual da Lei da Transparência. ST no V1 = override manual de alíquota 0 + `note`. IBPT é V2 e entra só como sugestão de preenchimento de `tax_rates.rate`.

Nunca adicione coluna fiscal em `products` / `quote_items` (`ipi_rate`, `ncm`, `icms_valor`). Tributo é **linha** em `tax_types`. O motor não conhece nenhum tributo por nome.

Documento emitido é fotografia: depois de `tax_snapshot_at`, nada é relido de `tax_types` / `tax_rates`. Nenhuma tela do documento faz `join` obrigatório com `tax_types`.

## 9. Pontos ainda em aberto (§11 do briefing) — não decida sozinho

- **Quantidade fracionária** (§11.6): o `unitBaseDisplay` em modo `inclusive` pode não multiplicar exatamente pelo total da linha. Comportamento não definido — consulte o §11 antes de escolher.
- **Múltiplos tributos `inclusive` no mesmo item**: qual base vira o `unit_base_display` não está definido no briefing. Não invente; levante a questão.
- **Bloco de totais por tributo** (§11.7): em modo `inclusive` o "total de impostos" **não soma** ao total a pagar. Se exibir, a UI precisa deixar isso explícito para não parecer cobrança dupla.
