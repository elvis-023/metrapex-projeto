# Matriz completa de casos de teste fiscais

Valores em **6 casas** são os persistidos (`numeric(18,6)`); valores em 2 casas são a renderização (half-up). Todos os números derivam de `briefing-motor-impostos.md` §5 e §7.

Convenções usadas nas fixtures:

- `ORG` — organização sob teste; `CAT_A` / `CAT_B` — categorias; `P1`, `P2`… — produtos.
- Salvo indicação, produto pertence a `CAT_A` e a quantidade é 1.
- "0 linhas de `quote_item_taxes`" é uma asserção, não uma observação.

---

## Bloco 1 — Organização sem destaque

### T-01 — Simples Nacional / MEI, sem destaque (§7.1)

**Setup**

| Tabela | Conteúdo |
|---|---|
| `tax_types` | **nenhuma linha** para `ORG` |
| `tax_rates` | — |
| `tax_settings` | `document_footer = 'Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.'`, `show_tax_lines = false` |
| produto | `P1`, preço `100.00`, `category_id = null` |

**Entrada** — 1 item: `P1` × 1. Documento emitido.

**Saída esperada**

```
quote_item_taxes              → 0 linhas
quote_items.unit_price_charged = 100.000000
quote_items.unit_base_display  = 100.000000
quote_items.line_total         = 100.000000
quotes.tax_snapshot_at         = preenchido na emissão
quotes.tax_footer_note         = 'Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.'
```

Impressão: `Produto X — 1 × R$ 100,00 — R$ 100,00`, nenhuma linha de imposto, rodapé com a frase.

**Deve falhar se**: o motor lançar erro/aviso por ausência de tributo; produzir qualquer percentual calculado no rodapé; deixar `tax_footer_note` nulo; criar linha de `quote_item_taxes` com valor zero.

### T-01b — Template "Isento"

**Setup**: nenhum `tax_type`; `tax_settings.document_footer = null`, `show_tax_lines = false`.

**Saída**: 0 linhas de `quote_item_taxes`; `line_total = 100.000000`; `quotes.tax_footer_note = null`; documento sem rodapé fiscal.

---

## Bloco 2 — Os dois modos

### T-02 — IPI embutido, `inclusive` 5% (§7.2)

**Setup**

| Tabela | Conteúdo |
|---|---|
| `tax_types` | `code='IPI'`, `label='IPI'`, `mode='inclusive'`, `default_rate=0.0000`, `active=true`, `display_order=2` |
| `tax_rates` | override de **categoria** `CAT_A`, `rate=5.0000`, `note=null` |
| produto | `P1`, preço `100.00`, categoria `CAT_A` |

**Entrada** — `P1` × 1.

**Saída esperada**

```
resolveRate → { rate: 5, source: 'category', note: null }

base          = 100 / (1 + 5/100) = 100 / 1,05 = 95,238095…
valor_imposto = 95,238095… × 0,05             =  4,761904…

quote_item_taxes (1 linha):
  tax_code='IPI'  tax_label='IPI'  mode='inclusive'
  rate_applied=5.0000  rate_source='category'  note=null
  base_amount=95.238095   tax_amount=4.761905

quote_items:
  unit_price_charged=100.000000
  unit_base_display=95.238095
  line_total=100.000000
```

Conferência obrigatória: `95.238095 + 4.761905 = 100.000000` (reconstrói o preço de catálogo).

Renderização:

| Linha | Valor |
|---|---:|
| Produto X — 1 un. (unitário R$ 95,24) | R$ 95,24 |
| IPI 5% | R$ 4,76 |
| **Total** | **R$ 100,00** |

**Deve falhar se**: `line_total` virar `105.000000` (tratou `inclusive` como `exclusive`); `unit_base_display` ficar `100.000000` (não extraiu a base); `base_amount` ficar `95.240000` (arredondou cedo).

### T-03 — ICMS por fora, `exclusive` 18%, produto normal (§7.3)

**Setup**

| Tabela | Conteúdo |
|---|---|
| `tax_types` | `code='ICMS'`, `mode='exclusive'`, `default_rate=0.0000`, `active=true`, `display_order=1` |
| `tax_rates` | override de **categoria** `CAT_A`, `rate=18.0000` |
| produto | `P2`, preço `100.00`, categoria `CAT_A` |

**Saída esperada**

```
resolveRate → { rate: 18, source: 'category', note: null }
valor_imposto = 100 × 0,18 = 18,000000
total         = 100 + 18   = 118,000000

quote_item_taxes (1 linha):
  rate_applied=18.0000  rate_source='category'
  base_amount=100.000000  tax_amount=18.000000
quote_items: unit_price_charged=100.000000  unit_base_display=100.000000  line_total=118.000000
```

Renderizado: `Produto Y — 1 un. R$ 100,00` / `ICMS 18% R$ 18,00` / **Total R$ 118,00**.

---

## Bloco 3 — Hierarquia e o override de alíquota zero

Fixture comum do bloco: `tax_type` ICMS `exclusive`, `default_rate = 18.0000`, `active = true`.

### T-04 — Override de produto `rate = 0` (ST) vence a categoria e PARA a busca (§7.3) ⚠️

**Setup**

| Tabela | Conteúdo |
|---|---|
| `tax_types` | ICMS, `exclusive`, `default_rate=0.0000` |
| `tax_rates` #1 | categoria `CAT_A`, `rate=18.0000` |
| `tax_rates` #2 | produto `P3`, `rate=0.0000`, `note='ICMS-ST recolhido pelo fabricante'` |
| produto | `P3`, preço `100.00`, categoria `CAT_A` (a MESMA que tem 18%) |

**Saída esperada**

```
resolveRate → { rate: 0, source: 'product', note: 'ICMS-ST recolhido pelo fabricante' }
valor_imposto = 100 × 0 = 0,000000
total         = 100 + 0 = 100,000000

quote_item_taxes (1 linha — existe, com valor zero):
  rate_applied=0.0000  rate_source='product'
  note='ICMS-ST recolhido pelo fabricante'
  base_amount=100.000000  tax_amount=0.000000
quote_items: line_total=100.000000
```

Renderizado: `Produto Z — 1 un. R$ 100,00` / `ICMS 0% — ICMS-ST recolhido pelo fabricante  R$ 0,00` / **Total R$ 100,00**.

**Asserções obrigatórias (as três):** `tax_amount = 0.000000`, `rate_source = 'product'`, `note` preenchida e impressa junto da linha.

**Modo de falha que este teste existe para pegar**: `if (byProduct?.rate)`, `byProduct?.rate || byCategory?.rate || defaultRate`, `COALESCE(NULLIF(rate,0), …)`, `WHERE rate > 0`. Todos derrubam para a categoria → `tax_amount = 18.000000`, `line_total = 118.000000`, `rate_source = 'category'`. É **cobrança indevida**.

Variante: se a apresentação esconder linhas de valor zero, a `note` precisa aparecer em outro lugar do documento — asserte que ela não some.

### T-05 — Só `org_default`

Setup: `default_rate=18.0000`; nenhum `tax_rates`; produto `P4` com `category_id = null`.
Saída: `{ rate: 18, source: 'org_default', note: null }`; `tax_amount=18.000000`; `line_total=118.000000`; `rate_source='org_default'`.

### T-06 — Categoria vence `org_default`

Setup: `default_rate=18.0000`; `tax_rates` categoria `CAT_A` `rate=12.0000`; produto `P5` em `CAT_A`.
Saída: `{ rate: 12, source: 'category' }`; `tax_amount=12.000000`; `line_total=112.000000`; `rate_source='category'`.

### T-07 — Produto vence categoria (com `rate` ≠ 0)

Setup: `default_rate=18.0000`; categoria `CAT_A` `rate=12.0000`; produto `P6` (em `CAT_A`) `rate=7.0000`.
Saída: `{ rate: 7, source: 'product' }`; `tax_amount=7.000000`; `line_total=107.000000`; `rate_source='product'`.

### T-08 — Produto sem categoria pula o passo 2

Setup: `default_rate=18.0000`; existe `tax_rates` de categoria `CAT_A` `rate=12.0000`; produto `P7` com `category_id = null`.
Saída: `{ rate: 18, source: 'org_default' }`. **Deve falhar se** o motor aplicar 12% (varreu overrides de categoria sem checar a categoria do produto).

### T-09 — Override de **categoria** com `rate = 0` vence o `org_default`

Setup: `default_rate=18.0000`; `tax_rates` categoria `CAT_B` `rate=0.0000`, `note='Isento nesta categoria'`; produto `P8` em `CAT_B`.
Saída: `{ rate: 0, source: 'category', note: 'Isento nesta categoria' }`; `tax_amount=0.000000`; `line_total=100.000000`. Zero é override válido também no nível de categoria.

### T-10 — Tributo inativo não entra no laço

Setup: `tax_type` ICMS `exclusive` `default_rate=25.0000`, **`active=false`**; produto `P1`.
Saída: `quote_item_taxes` → **0 linhas**; `line_total=100.000000`. Distinguir de T-19: inativo não gera linha; ativo com alíquota 0 gera linha com valor zero.

---

## Bloco 4 — Não cumulativo e comutatividade

### T-11 — Dois tributos `exclusive`, `display_order` invertido

**Setup A**: `ICMS` `exclusive` 18% (`display_order=1`); `TAXA` `exclusive` 10% (`display_order=2`). Produto `P1`, preço `100.00`, sem overrides (ambos por `default_rate`).

```
ICMS: base_amount=100.000000  tax_amount=18.000000  rate_source='org_default'
TAXA: base_amount=100.000000  tax_amount=10.000000  rate_source='org_default'
line_total = 100 + 18 + 10 = 128.000000
```

**Setup B**: idêntico, com `display_order` trocado (`TAXA=1`, `ICMS=2`).

**Asserção**: todos os valores de 6 casas são **idênticos** entre A e B; só a ordem das linhas impressas muda.

**Deve falhar se** `TAXA` for calculada sobre `118` (`11.800000`) ou `ICMS` sobre `110` (`19.800000`) — isso é cumulatividade, fora do V1.

### T-12 — `inclusive` + `exclusive` no mesmo item, ordem invertida

**Setup**: `ICMS` `exclusive` 18% + `IPI` `inclusive` 5%; produto `P1`, preço `100.00`, qty 1.

```
ICMS: base_amount=100.000000   tax_amount=18.000000
IPI:  base_amount=95.238095    tax_amount=4.761905
line_total = 100 + 18 = 118.000000        (só `exclusive` soma)
unit_base_display = 95.238095             (a base extraída pelo tributo `inclusive`)
```

Inverter `display_order` → números idênticos.

**Deve falhar se** aparecer `21.240000` (ICMS sobre 118), `17.142857` (ICMS sobre a base do IPI) ou `5.619048` (IPI sobre 118).

*Nota:* qual base vira `unit_base_display` quando há **mais de um** tributo `inclusive` não está definido no briefing — não invente o esperado; levante como pergunta aberta.

---

## Bloco 5 — Congelamento (documento é fotografia)

### T-13 — Alterar `tax_rates` depois da emissão não muda o documento

**Setup/roteiro**

1. Configura ICMS `exclusive` com override de categoria 18%; emite documento com `P2` × 1 → snapshot `rate_applied=18.0000`, `tax_amount=18.000000`, `line_total=118.000000`, `tax_snapshot_at` preenchido.
2. `update tax_rates set rate = 25.0000 …`.
3. Reimprime, reabre e exporta o documento **emitido**.

**Saída esperada**: exatamente os mesmos valores do passo 1 (`18.0000` / `18.000000` / `118.000000`). Nenhum recálculo. Idem se `tax_types.mode`, `label` ou `default_rate` mudarem.

Complemento: um documento **novo** criado depois do passo 2 usa 25% — é o mesmo caminho de código, só configuração diferente.

### T-14 — Tributo deletado depois da emissão

**Roteiro**: emite documento; `delete from tax_types where id = :icms`.
**Saída esperada**: reimpressão e export continuam funcionando com `tax_code`, `tax_label`, `mode`, `rate_applied`, `rate_source`, `note`, `base_amount`, `tax_amount` já copiados; `quote_item_taxes.tax_type_id` fica órfão (sem FK forte, por design, só auditoria).
**Deve falhar se** qualquer query de tela/relatório do documento fizer `join` obrigatório com `tax_types` — a linha some ou a consulta quebra.

### T-15 — Rodapé congelado

**Roteiro**: emite com `tax_settings.document_footer = 'Frase A'`; depois altera para `'Frase B'`.
**Saída esperada**: `quotes.tax_footer_note` continua `'Frase A'` e é ela que imprime. Documento novo usa `'Frase B'`.

*(Relacionado, §11.5 — pergunta aberta:)* produto mudar de categoria após a emissão não altera nenhum valor do snapshot. Se o snapshot passar a copiar categoria, registre a decisão antes de escrever o teste.

---

## Bloco 6 — Quantidade, precisão e arredondamento

### T-16 — 7 unidades a R$ 100,00 com IPI `inclusive` 5% (§5)

**Setup**: `IPI` `inclusive`, override de categoria 5%. **Entrada**: `P1` (R$ 100,00) × **7**.

```
linha         = 100 × 7 = 700.000000        ← multiplica PRIMEIRO
base_amount   = 700 / 1,05 = 666,666666…  → 666.666667
tax_amount    = 666,666666… × 0,05        →  33.333333
conferência   = 666.666667 + 33.333333 = 700.000000   ✓
line_total    = 700.000000
```

Comparativo do §5 (renderizado em 2 casas):

| Estratégia | Base | Imposto | Total |
|---|---:|---:|---:|
| **Por linha** (correto) | **666,67** | **33,33** | 700,00 |
| Por unidade arredondada (`95,24 × 7`) | 666,68 | 33,32 | 700,00 |

**Asserte a base, não só o total** — o total fecha nas duas estratégias; só `base_amount` denuncia o erro.

*Nota (§11.6, pergunta aberta):* `unit_base_display = 95.238095` e `95.238095 × 7 = 666.666665 ≠ 666.666667`. Não asserte igualdade exata entre `unit_base_display × quantidade` e `base_amount` até o §11.6 estar decidido.

### T-17 — Documento com múltiplos itens e quantidades > 1

**Setup**: `IPI` `inclusive` com override 5% em `CAT_A`; `ICMS` `exclusive` com override 18% em `CAT_B`.

**Entrada**

| Item | Produto | Preço | Qty | Categoria |
|---|---|---:|---:|---|
| 1 | `P1` | 100,00 | 7 | `CAT_A` (IPI 5%) |
| 2 | `P9` | 49,90 | 3 | `CAT_B` (ICMS 18%) |

**Saída esperada**

```
Item 1: linha = 700.000000
        IPI  base_amount=666.666667  tax_amount=33.333333   line_total=700.000000
Item 2: linha = 49,90 × 3 = 149.700000
        ICMS base_amount=149.700000  tax_amount=26.946000   line_total=176.646000

Total do documento = 700.000000 + 176.646000 = 876.646000  → R$ 876,65
Impostos por código: IPI 33.333333 → R$ 33,33 ; ICMS 26.946000 → R$ 26,95
```

**Deve falhar se** o ICMS do item 2 for `26.940000` (`49,90 × 0,18 = 8,982 → 8,98` arredondado por unidade e multiplicado por 3) — diverge R$ 0,01 na renderização.

*Nota (§11.7):* o IPI (`inclusive`) **não** soma ao total a pagar; se a UI exibir bloco de "total de impostos", precisa deixar isso explícito.

### T-18 — Arredondar só no fim (soma do rodapé)

**Setup**: tributo `TAXA` `exclusive` 5% (`default_rate=5.0000`). **Entrada**: 3 itens, cada um produto de R$ 2,50 × 1.

```
por item: base_amount=2.500000  tax_amount=0.125000  line_total=2.625000

CORRETO   — soma em 6 casas, arredonda depois:
  Σ impostos = 0.375000 → R$ 0,38      total = 7.875000 → R$ 7,88
ERRADO    — arredonda cada linha e depois soma:
  0,13 × 3 = R$ 0,39                   total = 2,63 × 3 = R$ 7,89
```

Divergência de R$ 0,01 em três linhas — cresce com o tamanho do documento. Asserte os valores **corretos** e que nenhum valor de 2 casas foi persistido.

### T-19 — Alíquota 0 nos dois modos, sem branch

**Setup A**: tributo ativo `exclusive`, `default_rate = 0.0000`; produto R$ 100,00.
```
base_amount=100.000000  tax_amount=0.000000  line_total=100.000000
quote_item_taxes → 1 linha, rate_applied=0.0000, rate_source='org_default'
```

**Setup B**: tributo ativo `inclusive`, `default_rate = 0.0000`; produto R$ 100,00.
```
base = 100 / (1 + 0/100) = 100 / 1 = 100.000000
base_amount=100.000000  tax_amount=0.000000
unit_base_display=100.000000  line_total=100.000000
quote_item_taxes → 1 linha
```

**Asserção estrutural**: tributo ativo com alíquota 0 **gera** linha de snapshot (≠ T-10, inativo, e ≠ T-01, org sem tributo). Se houver divisão por zero, `NaN`, `Infinity` ou early-return de isenção, a implementação tem branch onde não deveria.

### T-20 — Propriedade: `inclusive` sempre reconstrói o preço

**Setup**: tributo `inclusive` 5%. **Entrada**: preços variados, qty 1.

| Preço | `base_amount` | `tax_amount` | soma |
|---:|---:|---:|---:|
| 10,00 | 9.523810 | 0.476190 | 10.000000 |
| 33,33 | 31.742857 | 1.587143 | 33.330000 |
| 99,99 | 95.228571 | 4.761429 | 99.990000 |
| 1.234,56 | 1175.771429 | 58.788571 | 1234.560000 |

**Asserção**: `|base_amount + tax_amount − (preço × quantidade)| ≤ 0.000001` para qualquer preço e alíquota. Tolerância de 1e-6 porque ambos são persistidos arredondados na sexta casa; qualquer desvio maior significa arredondamento precoce ou uso de `number` de ponto flutuante.

Repita a propriedade com alíquotas 0%, 5%, 12%, 18% e 100% (limite do `check` do DDL). Com 100%: `base = preço / 2`, `tax = preço / 2`.

---

## Fora de escopo — não escreva testes que exijam isso

ICMS-ST calculado (MVA/pauta/redução de base), DIFAL interestadual, PIS/COFINS monofásico, cumulatividade entre tributos, cálculo do percentual da Lei 12.741/2012, sugestão IBPT. Nada disso é V1. ST se testa como T-04: override manual de alíquota 0 + `note`.
