# As 8 perguntas em aberto do §11

Reprodução fiel do §11 de `briefing-motor-impostos.md` ("Perguntas em aberto para quem implementar"), com a proposta/recomendação do briefing destacada quando existe, mais uma nota do que cada uma trava na implementação.

Antes de responder qualquer uma delas, confira [decisoes-registradas.md](decisoes-registradas.md) — se a pergunta já tiver uma entrada lá, ela deixou de estar em aberto.

---

## 1. Validação de alíquota

> Os `CHECK (rate between 0 and 100)` do DDL barram negativo e absurdo no banco. Falta decidir: a camada de serviço replica a validação com mensagem amigável, ou confia no erro de constraint? E existe teto de negócio abaixo de 100 (ex.: avisar acima de 40%) — bloqueio ou warning?

- **Proposta do briefing:** nenhuma. Duas subperguntas independentes (validação na aplicação; teto de negócio).
- **Trava:** camada de serviço de `tax_types` / `tax_rates` e as mensagens de erro da UI de cadastro.
- **Em jogo:** erro de constraint cru é hostil ao usuário; teto como bloqueio pode impedir um caso legítimo raro, como warning pode ser ignorado.

---

## 2. Versionamento de alteração de alíquota

> O documento emitido é snapshot e não recalcula — isso resolve o passado. Falta decidir o presente: alterar `tax_rates.rate` sobrescreve a linha (perde histórico) ou insere versão nova com `valid_from` e a leitura pega a vigente? A segunda opção é mais correta em auditoria e mais cara em consulta.

- **Recomendação do briefing:** *começar com sobrescrita + tabela de log de alteração, e migrar para `valid_from` se auditoria exigir.*
- **Trava:** DDL de `tax_rates`, rotina de atualização de alíquota e toda leitura de override.
- **Em jogo:** `valid_from` encarece cada resolução de alíquota (toda leitura vira consulta por vigência); sobrescrita + log entrega auditoria suficiente com leitura simples.

---

## 3. Rascunho vs emitido

> Enquanto o orçamento está em rascunho, ele deve refletir mudanças de configuração ou já congelar na criação? Precisa estar decidido antes de escrever a camada de leitura.

- **Proposta do briefing:** *rascunho recalcula a cada abertura; a emissão (`tax_snapshot_at`) congela.*
- **Trava:** camada de leitura do orçamento e a rotina de emissão — é pré-requisito, não detalhe.
- **Em jogo:** congelar na criação deixa rascunhos antigos com alíquota morta; recalcular a cada abertura faz o valor do rascunho mudar entre visualizações, o que a UI precisa comunicar.

---

## 4. Duplicar orçamento antigo

> Ao clonar um documento emitido há seis meses, o novo herda as alíquotas do snapshot ou recalcula com a configuração atual? Recalcular é quase certamente o certo, mas precisa ser explícito na UI (avisar que os valores mudaram).

- **Inclinação do briefing:** *recalcular*, com aviso explícito na UI.
- **Trava:** rota/ação de duplicar documento e o aviso correspondente na interface.
- **Em jogo:** herdar o snapshot ressuscita alíquota revogada; recalcular sem avisar surpreende o vendedor que esperava o mesmo total.

---

## 5. Produto muda de categoria depois da emissão

> O snapshot protege o documento, mas relatórios que fazem `join` de `quote_item_taxes` com `products`/`product_categories` vão mostrar a categoria atual, não a vigente. Vale copiar `category_id`/nome da categoria para o snapshot?

- **Proposta do briefing:** nenhuma; pergunta aberta sobre estender o snapshot.
- **Trava:** DDL de `quote_item_taxes` (ou `quote_items`) e a camada de relatórios.
- **Em jogo:** copiar categoria mantém a coerência histórica dos relatórios ao custo de mais denormalização; não copiar deixa o relatório contar uma história diferente da do documento.

---

## 6. Arredondamento em quantidade fracionária

> §5 padroniza cálculo por linha. Falta definir o comportamento com quantidade decimal (2,5 kg) e se o unitário exibido em modo `inclusive` é a base por unidade arredondada (que pode não multiplicar exatamente pelo total da linha — precisa de nota de rodapé ou de aceitar a divergência de centavo).

- **Proposta do briefing:** o cálculo é **por linha** (isso está fixado no §5); o que falta é a **exibição** do unitário e o tratamento da divergência de centavo.
- **Trava:** camada de renderização do documento e os casos de teste de arredondamento.
- **Em jogo:** unitário exibido × quantidade pode não bater com o total da linha; ou se aceita a divergência com nota, ou se escolhe outra apresentação. Não vale "consertar" arredondando o cálculo cedo — isso quebra a invariante de precisão.

---

## 7. Agregação no total do documento

> Somar `tax_amount` por `tax_code` e mostrar um bloco de totais por tributo, ou só o total geral? Em modo `inclusive` o "total de impostos" não soma ao total a pagar — a UI precisa deixar isso claro para não parecer cobrança dupla.

- **Proposta do briefing:** nenhuma quanto a mostrar ou não; **obrigatório** deixar claro que, em `inclusive`, o total de impostos não soma ao total a pagar.
- **Trava:** rodapé/bloco de totais do documento e do PDF.
- **Em jogo:** documento com tributos `inclusive` e `exclusive` misturados torna um "total de impostos" único ambíguo.

---

## 8. Tributo excluído depois da emissão

> `quote_item_taxes.tax_type_id` propositalmente não tem FK forte. Confirmar que nenhuma tela do documento faz `join` obrigatório com `tax_types` — todo dado necessário para reimprimir já está copiado na linha do snapshot.

- **Proposta do briefing:** não é escolha de design, é **verificação**: garantir que nenhuma tela de documento dependa de `tax_types`.
- **Trava:** todas as consultas de exibição, reimpressão e exportação de documento.
- **Em jogo:** um único `inner join` com `tax_types` faz o documento sumir ou quebrar quando o tributo for deletado. Precisa de teste: deletar o `tax_type` e reimprimir o documento.
