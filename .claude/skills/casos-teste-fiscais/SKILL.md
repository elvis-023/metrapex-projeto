---
name: casos-teste-fiscais
description: Use esta skill ao escrever, revisar ou executar testes do motor de imposto — validar uma mudança no cálculo ou em `resolveRate`, montar fixtures de organização/tributo/categoria/produto (`tax_types`, `tax_rates`, `tax_settings`, `product_categories`), conferir regressão após mexer em alíquota, arredondamento, snapshot ou emissão, provar que override com `rate = 0` vence a categoria, que o cálculo é comutativo entre tributos, que o documento emitido está congelado, ou quando pedirem "casos de teste fiscais", "bateria de testes do imposto", "isso quebrou algum cenário?".
---

# Bateria canônica de casos de teste fiscais

Números extraídos de `briefing-motor-impostos.md` §5 e §7. **Agnóstica de stack**: não existe framework de teste nem comando (`npm test` não existe) neste repositório — descreva/implemente os casos no stack que for escolhido, mas não invente comandos.

**Matriz completa, com setup e valores esperados de cada caso: [references/matriz-casos.md](references/matriz-casos.md).**

## Como escrever qualquer caso

Todo caso tem três blocos:

1. **Setup** — `tax_settings` da org, `tax_types` (código, `mode`, `default_rate`, `active`, `display_order`), `tax_rates` (overrides de categoria/produto, `note`), `product_categories`, produto (preço, `category_id`).
2. **Entrada** — itens do documento: produto, quantidade.
3. **Saída esperada** — valores **em 6 casas** (`base_amount`, `tax_amount`, `unit_price_charged`, `unit_base_display`, `line_total`), `rate_applied`, **`rate_source`**, `note`, **quantas linhas** de `quote_item_taxes` existem, e a renderização em 2 casas.

Assertar `rate_source` e a **contagem de linhas** de `quote_item_taxes` é obrigatório — vários bugs produzem o número certo com a origem errada, ou zero linhas onde deveria haver uma linha de valor zero.

## Invariantes que todo caso deve preservar

- `inclusive`: `base_amount + tax_amount === unit_price_charged × quantidade` (em 6 casas). Se não reconstrói, houve arredondamento cedo.
- `exclusive`: `line_total === preço da linha + Σ impostos exclusive`.
- Trocar `display_order` **não muda nenhum número**.
- Nenhum valor de 2 casas é persistido; arredondamento half-up só na renderização e na soma do rodapé.
- Documento emitido nunca relê `tax_types` / `tax_rates`.

## Os três casos não negociáveis

Se só couber escrever três, escreva estes.

### T-04 — Override de produto com `rate = 0` vence a categoria e PARA a busca

Requisito inegociável do motor — `rate = 0` é override válido e tem que vencer a categoria; é o bug mais caro do sistema (ver skill `calculo-tributario`). Setup: `tax_type` ICMS `exclusive`; override de **18% na categoria**; produto dessa mesma categoria com override de **0% e `note = 'ICMS-ST recolhido pelo fabricante'`**. Item: 1 × R$ 100,00.

```
resolveRate → { rate: 0, source: 'product', note: 'ICMS-ST recolhido pelo fabricante' }
tax_amount  = 0.000000        base_amount = 100.000000
line_total  = 100.000000      (NÃO 118.000000)
quote_item_taxes: 1 linha, rate_applied=0.0000, rate_source='product', note preenchida
```

Impresso: `ICMS 0% — ICMS-ST recolhido pelo fabricante ....... R$ 0,00`.

Falha típica: `if (byProduct?.rate)` ou `byProduct?.rate || byCategory?.rate || default` → cai para 18%, total R$ 118,00, `rate_source='category'`. **É cobrança indevida, não erro de exibição.** Asserte os três: valor, `rate_source` e `note`.

### T-02 — IPI embutido `inclusive` 5% reconstrói o preço de catálogo (§7.2)

Setup: `tax_type` IPI `inclusive`, `default_rate = 0`; override de 5% na categoria do produto. Item: 1 × R$ 100,00.

```
resolveRate → { rate: 5, source: 'category' }
base_amount = 95.238095   tax_amount = 4.761905
95.238095 + 4.761905 = 100.000000            ✓ reconstrói o preço
unit_price_charged = 100.000000  unit_base_display = 95.238095  line_total = 100.000000
Renderizado: 95,24 + 4,76 = 100,00
```

O cliente paga os mesmos R$ 100,00 — o unitário exibido virou a base e o imposto ganhou linha própria.

### T-01 — MEI/Simples sem destaque: zero tributo é configuração NORMAL (§7.1)

Setup: **nenhum** `tax_type` para a org; `tax_settings.document_footer = 'Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.'`, `show_tax_lines = false`. Item: 1 × R$ 100,00.

```
quote_item_taxes: 0 linhas          (o laço não itera — não é erro, não é estado vazio)
unit_price_charged = 100.000000  unit_base_display = 100.000000  line_total = 100.000000
quotes.tax_footer_note = cópia literal de tax_settings.document_footer na emissão
```

O rodapé é **texto configurado, não cálculo** — o V1 não estima percentual nenhum. O teste deve falhar se o motor produzir qualquer número no rodapé, lançar erro por ausência de tributo, ou deixar `tax_footer_note` nulo quando `document_footer` está preenchido.

## Índice da bateria

| ID | Caso | Cobre |
|---|---|---|
| T-01 | Simples/MEI sem destaque (§7.1) | zero `tax_types` é normal; rodapé é texto |
| T-01b | Template "Isento" (`document_footer` null) | sem linhas e sem rodapé |
| T-02 | IPI `inclusive` 5% (§7.2) | `base + imposto` reconstrói o preço |
| T-03 | ICMS `exclusive` 18% (§7.3) | imposto por fora, total R$ 118,00 |
| T-04 | Override produto `rate = 0` (ST) (§7.3) | 0 vence categoria e para a busca; `note` impressa |
| T-05 | Só `org_default` | `rate_source = 'org_default'` |
| T-06 | Categoria vence `org_default` | `rate_source = 'category'` |
| T-07 | Produto vence categoria (rate ≠ 0) | `rate_source = 'product'` |
| T-08 | Produto sem categoria | pula passo 2, cai em `org_default` |
| T-09 | Categoria com `rate = 0` vence `org_default` | zero válido também no nível categoria |
| T-10 | Tributo `active = false` | não entra no laço; 0 linhas de snapshot |
| T-11 | Comutatividade, dois `exclusive` | `display_order` invertido → total idêntico |
| T-12 | Comutatividade, `inclusive` + `exclusive` | não cumulativo; nenhum imposto sobre imposto |
| T-13 | Congelamento: alíquota muda após emissão | reimpressão/export inalterados |
| T-14 | Congelamento: tributo deletado após emissão | sem FK forte; nenhum `join` obrigatório |
| T-15 | Congelamento do rodapé | alterar `document_footer` não altera documento emitido |
| T-16 | Quantidade 7 × R$ 100, IPI 5% (§5) | por linha vs por unidade: base diverge R$ 0,01 |
| T-17 | Múltiplos itens, quantidades > 1 | cálculo por linha em documento composto |
| T-18 | Rodapé: arredondar só no fim | soma em 6 casas vs somar arredondados: R$ 0,01 |
| T-19 | `rate = 0` nos dois modos, sem branch | `1 + 0/100 = 1`; linha de snapshot com valor 0 |
| T-20 | Preços variados, `inclusive` (propriedade) | `base + imposto === preço` para qualquer preço |

Detalhamento de setup/entrada/saída de todos: **[references/matriz-casos.md](references/matriz-casos.md)**.

## Regressão — quando rodar o quê

- Mexeu em `resolveRate` ou em `tax_rates` → **T-04 a T-10** obrigatórios (a hierarquia inteira, com `rate_source`).
- Mexeu em fórmula, `mode` ou tipo numérico → **T-02, T-03, T-16 a T-20**.
- Mexeu em emissão, snapshot, reimpressão ou export → **T-13 a T-15**, e confirme que nenhuma query do documento faz `join` com `tax_types`.
- Adicionou tributo, template de onboarding ou tela de configuração → **T-01, T-01b, T-11, T-12**.

## Armadilhas a não introduzir no próprio teste

- Comparar com `===` sobre `number` de ponto flutuante: `100 / 1.05 * 0.05` não bate bit a bit. Compare valores decimais em 6 casas.
- Fixar o esperado em 2 casas e assertar contra o valor persistido — o persistido tem 6.
- Usar quantidade 1 em todos os casos: esconde o bug de cálculo por unidade (T-16/T-17 existem para isso).
- Testar só o total: em T-16 o total fecha nas duas estratégias e só a **base** denuncia o erro.
- Assertar valor sem assertar `rate_source`: o número certo pela origem errada passa despercebido e envenena o snapshot.
- Inventar cenário de ICMS-ST calculado, DIFAL, monofásico ou percentual da Lei da Transparência: **fora do escopo do V1** — não devem existir testes exigindo esses comportamentos.
