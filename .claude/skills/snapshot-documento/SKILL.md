---
name: snapshot-documento
description: Use esta skill sempre que o trabalho tocar o documento de venda depois do cálculo — emitir orçamento/proposta/nota, gravar `quote_item_taxes`, congelar em `tax_snapshot_at`, decidir rascunho vs. emitido, reimprimir, exportar, gerar PDF ou CSV de um documento, escrever tela, query, repository, DTO ou relatório que leia `quotes` / `quote_items` / `quote_item_taxes`, imprimir o rodapé da Lei 12.741/2012 ou copiar `tax_settings.document_footer` para `quotes.tax_footer_note`, tratar organização sem nenhum tributo configurado, ou avaliar o impacto de uma alíquota alterada (ou de um tributo deletado) em documento já emitido.
---

# Documento emitido é fotografia, não consulta

## O invariante

Depois de emitido, o documento **nunca mais lê `tax_types` nem `tax_rates`**. Nem para reimprimir. Nem para exportar. Nem para gerar PDF. Nem para relatório. Nem se a alíquota mudar amanhã. Nem se o tributo for deletado.

Tudo que a reimpressão precisa já está copiado em `quote_item_taxes`, `quote_items` e `quotes`. Se uma tela precisa consultar a configuração viva para renderizar um documento emitido, a emissão gravou menos do que devia — corrija a emissão, não a tela.

Teste mental antes de aceitar qualquer código de leitura: *se eu deletasse `tax_types` e `tax_rates` inteiras agora, esse documento ainda imprimiria idêntico?* Se não, está errado.

## O que a emissão OBRIGATORIAMENTE copia

Uma linha em `quote_item_taxes` por (item × tributo aplicado):

| Campo | Origem | Para quê |
|---|---|---|
| `tax_type_id` | `tax_types.id` | **só auditoria**, sem FK — ver abaixo |
| `tax_code` | `tax_types.code` | identificação do tributo na impressão |
| `tax_label` | `tax_types.label` | rótulo impresso |
| `mode` | `tax_types.mode` | `inclusive` / `exclusive` — muda a apresentação |
| `rate_applied` | resultado de `resolveRate` | alíquota impressa |
| `rate_source` | `resolveRate` → `'product' \| 'category' \| 'org_default'` | rastreabilidade de por que essa alíquota |
| `note` | `tax_rates.note` do override que venceu | explica a linha (ex.: item zerado por ST) |
| `base_amount` | cálculo, `numeric(18,6)` | base da linha, já × quantidade |
| `tax_amount` | cálculo, `numeric(18,6)` | imposto da linha |

No item e no documento:

- `quote_items.unit_price_charged`, `unit_base_display`, `line_total` — `numeric(18,6)`
- `quotes.tax_snapshot_at` — quando a configuração foi congelada
- `quotes.tax_footer_note` — cópia do rodapé vigente na emissão

Se a impressão precisa de algum outro dado da configuração (ordem de exibição, texto auxiliar), copie também. A regra é: **a linha do snapshot é autossuficiente.**

`base_amount` e `tax_amount` são gravados com 6 casas. Arredondamento para 2 casas (half-up) é **só na renderização e na soma do rodapé** — nunca persista o valor arredondado, senão `base + imposto` deixa de reconstruir o preço de catálogo.

## `quote_item_taxes.tax_type_id` não tem FK — de propósito

É snapshot, não referência viva. O tributo pode ser desativado ou **deletado** depois, e o documento antigo continua imprimível. A coluna existe apenas para auditoria ("qual regra originou esta linha, se ela ainda existir").

**Consequência prática: nenhuma tela, consulta, export ou relatório do documento pode fazer `join` obrigatório com `tax_types`.**

### ERRADO — quebra ou some linhas quando o tributo é deletado

```sql
-- inner join: o item desaparece do documento se o tributo foi deletado
select qi.id, t.label, qit.rate_applied, qit.tax_amount
from quote_item_taxes qit
join quote_items qi on qi.id = qit.quote_item_id
join tax_types    t  on t.id = qit.tax_type_id;
```

```sql
-- também errado: lê a alíquota VIVA em vez da congelada
select qit.tax_code, t.default_rate as aliquota
from quote_item_taxes qit
join tax_types t on t.id = qit.tax_type_id;
```

```sql
-- errado de novo: left join "só para pegar o rótulo bonito".
-- O rótulo já está no snapshot; a versão viva pode ter mudado.
select coalesce(t.label, qit.tax_label) as rotulo
from quote_item_taxes qit
left join tax_types t on t.id = qit.tax_type_id;
```

### CERTO — o snapshot se basta

```sql
select qi.id            as quote_item_id,
       qit.tax_code,
       qit.tax_label,
       qit.mode,
       qit.rate_applied,
       qit.rate_source,
       qit.note,
       qit.base_amount,
       qit.tax_amount
from quote_items qi
left join quote_item_taxes qit on qit.quote_item_id = qi.id
where qi.quote_id = :quote_id
order by qi.position, qit.created_at;
```

`left join` de `quote_items` para `quote_item_taxes` é intencional: item sem nenhum tributo é caso normal e precisa aparecer no documento.

O mesmo vale em ORM/repository: nenhum `include`/`with`/`populate` de `taxType` na leitura do documento; nenhum tipo de retorno que exija `TaxType` presente. Nenhuma view de impressão pode ter `taxTypes` entre suas dependências.

Relatórios que fazem `join` com `products` / `product_categories` sofrem do problema análogo: mostram a categoria **atual**, não a vigente na emissão. Está no §11 do briefing (pergunta 5) se vale copiar a categoria para o snapshot — decisão pendente.

## Rodapé (Lei 12.741/2012)

Na emissão, `tax_settings.document_footer` é **copiado** para `quotes.tax_footer_note`. A impressão lê `quotes.tax_footer_note` — nunca `tax_settings` — pelo mesmo motivo de sempre: se a empresa editar o rodapé amanhã, o documento antigo não pode mudar.

O rodapé é **texto configurado, não resultado de cálculo**. O V1 **não estima** o percentual da Lei da Transparência. Não some `tax_amount` para "preencher" o percentual, não interpole valor nenhum na frase, não gere a frase automaticamente. Se a empresa quiser um percentual dentro do texto, ela escreve o percentual no texto.

`tax_settings.show_tax_lines = false` controla a exibição das linhas de tributo — não impede que o rodapé apareça.

## Organização com zero tributos: caso normal, não vazio

Zero `tax_types` ativos é a configuração default de MEI/Simples sem destaque. Nesse caso:

- o laço de tributos do item **não itera**;
- `quote_item_taxes` fica **sem linhas** — não é falha de gravação;
- o total é o preço de catálogo (`unit_price_charged = unit_base_display = line_total`);
- o documento é **válido e emitível**, com `tax_snapshot_at` preenchido e o rodapé impresso.

Não renderize empty state, aviso de "configuração incompleta", badge de erro nem call-to-action de "configure seus tributos". Não bloqueie a emissão. Não trate `taxes.length === 0` como erro.

## Rascunho vs. emitido — DECISÃO PENDENTE (§11.3)

A **proposta** do briefing é: rascunho **recalcula a cada abertura** (reflete mudança de configuração), e a emissão **congela** em `tax_snapshot_at`.

Isso é proposta, **não decisão tomada**. O §11 lista 8 perguntas em aberto e várias tocam esta camada:

- §11.3 — rascunho vs. emitido (a proposta acima)
- §11.2 — versionamento de alteração de alíquota (sobrescrita + log vs. `valid_from`)
- §11.4 — duplicar orçamento emitido há meses: herda snapshot ou recalcula?
- §11.5 — produto muda de categoria depois da emissão: copiar categoria para o snapshot?
- §11.7 — agregação de totais por tributo (em `inclusive` o "total de impostos" **não** soma ao total a pagar; a UI precisa deixar isso claro)
- §11.8 — confirmar que nenhuma tela do documento faz `join` obrigatório com `tax_types`

**Antes de escrever a camada de leitura/emissão: leia o §11 do briefing, levante a decisão com quem toca o produto e registre-a em `.claude/skills/decisao-pendente/references/decisoes-registradas.md`** (ver skill `decisao-pendente`). Não decida sozinho no meio da implementação — essas escolhas vazam para o schema e para todas as telas.

O que **não** é pendente e vale desde já: o documento **emitido** é congelado. Qualquer proposta de recalcular documento emitido está fora do desenho.

## O documento não é documento fiscal

O motor **não decide** questão fiscal: se o produto é ST, qual alíquota vale no estado, se há redução de base, se a venda exige DIFAL. Quem configura traz as respostas. O que o motor garante é que, uma vez configurado, o cálculo sai certo, consistente e congelado.

Portanto:

- o documento gerado **não pode se apresentar como documento fiscal válido** (não imite layout de NF-e/DANFE, não use "Nota Fiscal", não exiba campos que sugiram validade fiscal, não gere numeração que passe por série fiscal);
- a UI deve deixar explícito o limite — texto de ajuda no cadastro do tributo do tipo "confirme as alíquotas com seu contador";
- linha de tributo zerada precisa da `note` do snapshot impressa junto, senão parece erro. Se a apresentação optar por esconder linhas de valor zero, a nota tem que aparecer em outro lugar do documento.
