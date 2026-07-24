# Templates de onboarding (§6 do briefing)

Presets aplicados na **criação da organização**, para que ninguém comece com tela em branco. São **inserts, não código** — nenhum template introduz branch por regime no motor.

Os três templates usam o mesmo schema e o mesmo caminho de cálculo. O que muda entre eles é exclusivamente o conteúdo de `tax_types`, `tax_rates` e `tax_settings`.

---

## 1. "Simples Nacional (sem destaque)"

**Nenhum `tax_type`. Só o rodapé informativo.** É o default para MEI e para Simples que não destaca.

```sql
insert into tax_settings (org_id, document_footer, show_tax_lines)
values (:org, 'Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.', false);
```

Resultado: o documento sai sem nenhuma linha de imposto, o total é o preço de catálogo, e a frase aparece no rodapé (copiada para `quotes.tax_footer_note` na emissão).

### Zero `tax_types` ativos é configuração normal — não é vazio nem erro

Este é o ponto que mais gera bug de implementação. Trate explicitamente:

- O laço de tributos do item **não itera nenhuma vez**. Isso é o caminho feliz, não um caso de borda.
- `quote_item_taxes` fica **sem linhas** para esse documento. Não é falha de gravação.
- **Não** emita warning, badge de "configuração incompleta", tela de erro, empty state com call-to-action de "configure seus tributos", nem bloqueio de emissão.
- **Não** trate `tax_types.length === 0` como estado a corrigir. É a configuração escolhida.
- O documento continua **válido e emitível**, com rodapé.

Exemplo numérico (item de R$ 100,00, qtd. 1):

```
unit_price_charged = 100,000000
unit_base_display  = 100,000000
line_total         = 100,000000
```

Impressão: `Produto X — 1 × R$ 100,00 — R$ 100,00`, e no rodapé o texto de `quotes.tax_footer_note`.

A nota é **texto configurado, não resultado de cálculo**. O V1 não estima o percentual da Lei da Transparência. Se a empresa quiser o percentual dentro da frase, ela escreve o percentual na frase.

---

## 2. "Isento"

**Nenhum `tax_type`, nenhum rodapé.**

```sql
insert into tax_settings (org_id, document_footer, show_tax_lines)
values (:org, null, false);
```

Serve para quem só quer orçamento limpo: serviço não tributado no destaque, venda interna, teste do produto.

Vale a mesma observação do template anterior: zero tributos é configuração normal. A única diferença para o "Simples Nacional (sem destaque)" é `document_footer = null` — nenhuma linha de rodapé é impressa.

---

## 3. "ICMS + IPI padrão"

Revenda no Lucro Presumido: **ICMS por fora** no padrão da empresa, **IPI embutido** por categoria.

```sql
insert into tax_types (org_id, code, label, mode, default_rate, display_order)
values
  (:org, 'ICMS', 'ICMS', 'exclusive', 18.0000, 1),
  (:org, 'IPI',  'IPI',  'inclusive',  0.0000, 2);

-- IPI de 5% só na categoria que tem industrialização; demais ficam em 0.
insert into tax_rates (tax_type_id, category_id, rate)
values (:ipi_id, :categoria_industrializados, 5.0000);
```

Note o IPI com `default_rate = 0`: a organização **usa** o tributo, mas ele só incide onde houver override de categoria. Zero como padrão é o jeito de dizer "existe, mas não incide por omissão".

`display_order` (1, 2) é **só ordem de impressão**. O cálculo é não cumulativo e comutativo: ICMS e IPI olham o mesmo preço de partida do item; o resultado não depende da ordem.

`code` e `label` aqui são só os valores mais comuns — são texto livre. O motor não reconhece `'ICMS'` nem `'IPI'` por nome em lugar nenhum.

---

## Isenção pontual por ST (não é template, é uso de override)

ST no V1 **não é cálculo**. Resolve-se como override de produto com alíquota 0 + nota explicativa:

```sql
insert into tax_rates (tax_type_id, product_id, rate, note)
values (:icms_id, :produto_st, 0.0000, 'ICMS-ST recolhido pelo fabricante');
```

O override de produto com `rate = 0` **vence a categoria e para a busca**. A `note` sobe para `quote_item_taxes.note` e é impressa junto da linha do tributo — sem ela, uma linha de R$ 0,00 parece erro.

---

## Aplicação dos templates

- Escolha do template acontece **na criação da organização**; nada impede o usuário de sair do preset depois, editando `tax_types` / `tax_rates` / `tax_settings`.
- Nenhum template pode virar coluna, flag de regime (`org.regime = 'simples'`), enum de perfil fiscal ou branch no motor. Depois de aplicado, o template deixa de existir: só sobram as linhas que ele inseriu.
- A UI de configuração deve deixar explícito que o motor **não decide** questão fiscal — texto de ajuda do tipo "confirme as alíquotas com seu contador". Quem configura traz as respostas.
