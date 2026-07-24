---
name: escopo-v1
description: Use esta skill quando alguém pedir funcionalidade fiscal nova no motor de impostos, mencionar ICMS-ST, substituição tributária, MVA, IVA-ST, pauta fiscal, redução de base de cálculo, DIFAL, venda interestadual, PIS/COFINS monofásico, tributo sobre tributo / cumulatividade, IBPT, NCM, ou cálculo do percentual da Lei da Transparência (Lei 12.741/2012); quando perguntarem "o motor consegue fazer X?", "dá para adicionar X?", "e se o cliente precisar de X?"; antes de prometer qualquer coisa a cliente; e ao escrever texto de UI, ajuda, rodapé de documento ou material de marketing sobre o produto. Ela diz o que está fora do escopo do V1, qual é o contorno oficial disponível, e como responder ao pedido sem expandir o escopo por conta própria.
---

# Escopo do V1 — o que o motor faz e o que ele não faz

Fonte de verdade: `briefing-motor-impostos.md`, §8 (fora de escopo), §9 (onde está o limite) e §10 (registrado para V2). Esta skill resume e operacionaliza; em caso de dúvida, releia as seções.

## 1. Fora do escopo do V1 — não implemente por iniciativa própria

Estes cinco itens estão **explicitamente excluídos** do V1. Nenhum deles deve ser implementado, esboçado em código, adicionado ao schema ou prometido, mesmo que o pedido pareça pequeno.

| Item | O que exatamente está fora | Por quê (§8) |
|---|---|---|
| **ICMS-ST como cálculo** | MVA / IVA-ST, pauta fiscal, redução de base de cálculo, e a fórmula `base_ST = (valor + frete + IPI) × (1 + MVA)` | Exige base de MVA por NCM × UF de origem × UF de destino e fórmula própria — não cabe em "alíquota única com hierarquia" |
| **DIFAL em venda interestadual** | Diferencial de alíquota, partilha origem/destino, dependência da UF e da condição de contribuinte do destinatário | Muda a *estrutura* do cálculo, não só o número |
| **PIS/COFINS monofásico** | Regime por produto com alíquota concentrada no início da cadeia | Modelar como tributo comum produz destaque incorreto |
| **Cumulatividade entre tributos** | Base de um tributo composta pela base, pelo valor ou pelo total de outro | Todo tributo do V1 calcula isoladamente sobre a base do item. Fica para V2 |
| **Cálculo do percentual da Lei da Transparência** | Estimar o % de tributos da Lei 12.741/2012 | V1 imprime o texto configurado pela empresa; não estima o percentual |

Consequência prática no código e no schema: nada de coluna `mva`, `pauta`, `reducao_base`, `uf_destino`, `difal_*`, `percentual_tributos`; nada de campo em `tax_types` que faça um tributo apontar para outro; nada de branch por regime fiscal. O V1 cobre **venda de produto padrão dentro do estado, sem regime especial** — a maior parte do volume de orçamento em revenda.

## 2. Os contornos oficiais que existem no V1

Quando o pedido cair em um dos itens acima, ofereça o contorno — ele resolve a maioria dos casos reais.

### ST → override manual de alíquota 0 + `note`

O jeito suportado de tratar substituição tributária no V1:

1. Cria-se um override em `tax_rates` no **produto** (nível mais específico), com `rate = 0`.
2. Preenche-se `tax_rates.note` com a explicação — ex.: `'ICMS-ST recolhido pelo fabricante'`.
3. A `note` sobe para `quote_item_taxes.note` no snapshot e é **impressa junto da linha do tributo** no documento.

Resultado no documento: `ICMS 0% — ICMS-ST recolhido pelo fabricante ....... R$ 0,00`. Sem a nota, uma linha de R$ 0,00 parece erro.

Dois pontos a garantir: (a) `rate = 0` é override válido e **vence a categoria** — a busca para no produto; (b) se a apresentação esconder linhas com valor zero, a nota precisa aparecer em outro lugar do documento.

Isso não calcula ST — apenas registra que o item não é tributado ali e por quê. Quem afirma que o produto é ST é quem configura, não o motor.

### IBPT → V2, e só como sugestão

IBPT está **registrado para o V2** (§10) e, mesmo lá, entra como **sugestão automática de preenchimento de `tax_rates.rate`** na tela de cadastro — o usuário aceita ou sobrescreve. **Não muda o modelo de dados.** Qualquer proposta de IBPT que crie tabela nova, coluna de NCM em `products`, ou consulta em tempo de cálculo está fora até do V2 como planejado.

### Lei da Transparência → texto configurado

O rodapé vem de `tax_settings.document_footer`, copiado para `quotes.tax_footer_note` na emissão. É **texto, não resultado de cálculo**. Se a empresa quiser o percentual estimado dentro da frase, ela escreve o percentual na frase.

## 3. A fronteira (§9) — leia antes de prometer qualquer coisa

O motor **não decide questão fiscal**. Especificamente, ele não decide:

- se um produto é ST;
- qual a alíquota de ICMS aplicável no estado da empresa;
- se um item tem redução de base;
- se aquela venda interestadual exige DIFAL.

Quem configura — a empresa ou o contador dela — traz essas respostas.

O que o motor **garante**: uma vez configurado, o cálculo sai **certo, consistente entre documentos e congelado no que foi emitido**.
O que ele **não garante**: que a resposta fiscal em si está correta.

Isso não é limitação envergonhada — é a divisão de responsabilidade padrão do mercado. Nenhum ERP genérico "sabe" sozinho a legislação de cada estado, cada NCM e cada regime. A UI de configuração deve deixar isso explícito, e o documento gerado não deve se apresentar como documento fiscal válido.

## 4. Regra de resposta quando alguém pede um item fora de escopo

Não silencie o pedido e não expanda o escopo sozinho. Siga os quatro passos, nesta ordem:

1. **Nomeie o item e diga que está fora do V1**, citando §8 e o motivo de uma linha (não é "não dá", é "muda a estrutura do cálculo / exige dados que o V1 não tem").
2. **Ofereça o contorno do V1**, se houver (ST → override 0 + `note`; transparência → texto no rodapé; alíquota específica → override de produto ou categoria).
3. **Diga o que o pedido custaria de verdade** em uma frase, quando for útil para a decisão — ex.: "DIFAL exige UF do destinatário, condição de contribuinte e partilha origem/destino; é mudança de estrutura, não de número".
4. **Ofereça registrar como item de V2.** Escreva o pedido como candidato de backlog, com o caso de uso concreto de quem pediu. Se a decisão de escopo for do usuário, pergunte — não decida sozinho.

Nunca: implementar "só um comecinho", deixar coluna preparada "para quando vier", ou aceitar o pedido no texto e não no código.

**Modelo de resposta:**

> `<item>` está fora do escopo do V1 (§8 do briefing): `<motivo em uma linha>`.
> No V1, o caminho suportado para esse caso é `<contorno>`.
> Se isso não resolver o seu cenário, posso registrar `<item>` como candidato de V2 com o seu caso de uso — quer que eu registre?

## 5. Frases prontas para UI e documento

Copie como estão; elas existem para alinhar a expectativa antes da reclamação.

**Ajuda no cadastro de tributo:**
> Confirme as alíquotas com o seu contador. O sistema aplica exatamente a alíquota que você configurar — ele não determina qual alíquota é devida.

**Ajuda no override de alíquota 0 (ST):**
> Use alíquota 0 com uma observação para itens já tributados na origem (ex.: ICMS-ST recolhido pelo fabricante). A observação é impressa junto da linha, para o cliente entender por que o item aparece zerado. O sistema não verifica se o produto é de fato ST.

**Rodapé do documento — não é documento fiscal:**
> Este documento é um orçamento/proposta comercial e **não** constitui documento fiscal. Os valores de tributos são informativos, calculados a partir das alíquotas configuradas pela empresa emitente.

**Rodapé da Lei 12.741/2012 (texto configurado, default do template Simples Nacional):**
> Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.

**Aviso ao lado do bloco de totais por tributo, em modo `inclusive`:**
> Tributos já inclusos no preço. O valor destacado é informativo e **não** é somado ao total a pagar.

**Texto de marketing / descrição de produto — o que pode e o que não pode:**
> Pode: "cálculo e destaque de tributos configuráveis por organização", "mesma configuração aplicada de forma consistente em todos os documentos", "valores congelados no documento emitido".
> Não pode: "conformidade fiscal", "cálculo fiscal correto", "apuração", "substituto de NF-e", "calcula ICMS-ST/DIFAL", "sabe a alíquota do seu estado", "atende à Lei da Transparência automaticamente".
