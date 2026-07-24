---
name: decisao-pendente
description: Use esta skill quando a implementação do motor de impostos esbarrar numa questão em aberto do §11 do briefing — rascunho vs. emitido / quando congelar o snapshot, versionamento de alteração de alíquota (sobrescrever ou valid_from), validação e teto de alíquota, duplicar orçamento antigo, produto que muda de categoria depois da emissão, arredondamento com quantidade fracionária, agregação de totais por tributo no documento, ou tributo excluído depois da emissão. Use também sempre que for necessário tomar ou registrar uma decisão de arquitetura do motor, quando a tarefa exigir escolher um comportamento que o briefing não fixou, ou quando alguém perguntar "isso já foi decidido?". Ela traz as 8 perguntas com as propostas do briefing, o workflow obrigatório de consultar antes de decidir, e o log de decisões já tomadas em `references/decisoes-registradas.md`.
---

# Decisões pendentes do motor de impostos (§11)

O briefing fixa as invariantes, mas deixa **8 questões em aberto** (§11 de `briefing-motor-impostos.md`). Cada uma trava uma camada específica da implementação. Decidir por conta própria, em silêncio, é como o design se perde: a decisão vira comportamento implícito no código e ninguém consegue reconstruir por quê.

Texto integral das 8 perguntas, com a proposta/recomendação do briefing quando houver: **[references/perguntas-abertas.md](references/perguntas-abertas.md)**. Decisões já tomadas ficam registradas em **[references/decisoes-registradas.md](references/decisoes-registradas.md)** — confira os dois antes de decidir.

## Workflow obrigatório

Nesta ordem. Não pule para o passo 4.

### 1. Identificar qual das 8 a tarefa toca

Mapa rápido do sintoma para a pergunta:

| O que você está prestes a escrever | Pergunta |
|---|---|
| Validação de alíquota na camada de serviço, mensagem de erro, aviso de alíquota alta | **1. Validação de alíquota** |
| `update` em `tax_rates.rate`, tabela de log, coluna `valid_from` | **2. Versionamento de alteração de alíquota** |
| Camada de leitura do orçamento, quando gravar `tax_snapshot_at`, recalcular ao abrir | **3. Rascunho vs. emitido** |
| Botão/rota de duplicar ou clonar orçamento | **4. Duplicar orçamento antigo** |
| Relatório que faz `join` de `quote_item_taxes` com `products` / `product_categories` | **5. Produto muda de categoria depois da emissão** |
| Quantidade decimal, unitário exibido em modo `inclusive`, divergência de centavo | **6. Arredondamento em quantidade fracionária** |
| Bloco de totais do documento, soma por `tax_code`, "total de impostos" | **7. Agregação no total do documento** |
| Tela de documento que lê `tax_types`, deleção de tributo | **8. Tributo excluído depois da emissão** |

Se a tarefa não toca nenhuma delas, siga em frente — esta skill não se aplica.

### 2. Consultar o §11 antes de decidir sozinho

Abra `references/perguntas-abertas.md` (e o §11 do briefing, se precisar do contexto ao redor). Duas delas já vêm com direção do briefing e devem ser adotadas salvo motivo forte:

- **Rascunho vs. emitido (3)** — *proposta:* rascunho recalcula a cada abertura; a emissão congela em `tax_snapshot_at`.
- **Versionamento de alíquota (2)** — *recomendação:* começar com sobrescrita + tabela de log de alteração, e migrar para `valid_from` se auditoria exigir.

Verifique também se a decisão **já foi registrada** em `references/decisoes-registradas.md`. Se já estiver lá, apenas siga o que está registrado.

### 3. Registrar a decisão por escrito

Se a decisão for tomada, **antes de implementar**, acrescente uma entrada em `references/decisoes-registradas.md` seguindo o template da seção abaixo, com a data e a justificativa em uma ou duas linhas. Registro depois da implementação não conta — o objetivo é que o código nasça já explicado.

Não apague nem reordene entradas existentes — apenas acrescente.

### 4. Só então implementar

Implemente exatamente o que foi registrado. Se durante a implementação a decisão se mostrar inviável, volte ao passo 2 e atualize o registro — não divirja em silêncio.

## Template de registro (acrescentar em `references/decisoes-registradas.md`)

```markdown
### §11.3 — Rascunho vs. emitido — decidido em AAAA-MM-DD

Decisão: <o comportamento escolhido, em uma frase imperativa>.
Porquê: <justificativa em uma ou duas linhas, incluindo o que foi descartado>.
Impacto: <arquivos/camadas afetados, se já existirem>.
```

Exemplo preenchido:

```markdown
### §11.3 — Rascunho vs. emitido — decidido em 2026-07-23

Decisão: rascunho recalcula a configuração vigente a cada abertura; a emissão grava `tax_snapshot_at` e congela `quote_item_taxes`.
Porquê: proposta do §11; mantém o rascunho útil como simulação e preserva o invariante "documento emitido é fotografia, não consulta". Descartado congelar na criação, que deixaria rascunhos velhos com alíquota morta.
Impacto: camada de leitura do orçamento e rotina de emissão.
```

Uma vez registrada, a pergunta correspondente deixa de estar em aberto: quem consultar `references/decisoes-registradas.md` no passo 2 do workflow vai encontrá-la ali.

## Esta skill não decide pelo usuário

Quando a escolha muda o produto — o que o cliente vê, o que fica auditável, o custo de manutenção — **apresente as opções e o trade-off e pergunte**. Não escolha por padrão só porque uma opção é mais fácil de programar.

Formato para levar a pergunta ao usuário:

> **§11.N — `<título>`.** A tarefa esbarrou nisto e o briefing não fixa a resposta.
> **Opção A:** `<comportamento>` — ganha `<benefício>`, custa `<custo>`.
> **Opção B:** `<comportamento>` — ganha `<benefício>`, custa `<custo>`.
> O briefing sugere `<proposta, se houver>`. Qual você quer? Registro a escolha em `references/decisoes-registradas.md` antes de implementar.

Decida sozinho apenas quando: (a) o briefing já dá proposta/recomendação explícita e nada no contexto a contradiz, ou (b) a escolha é puramente interna, reversível e invisível ao usuário. Nos dois casos, registre mesmo assim.

## Cuidado: decisão pendente não autoriza quebrar invariante

Nenhuma das 8 perguntas está em aberto a ponto de permitir violar os invariantes de arquitetura do motor — regras em vez de colunas, hierarquia produto > categoria > organização, `rate = 0` como override válido, não cumulatividade, snapshot sem `join` obrigatório com `tax_types`, e organização sem tributo como caso normal. Se a "decisão" exigir quebrar um deles, pare e traga a contradição ao usuário. E se ela exigir implementar algo do §8, a skill correta é `escopo-v1`.
