-- Milestone 19 — dashboard de métricas: troca os mocks do Milestone 5 por
-- queries reais (PLAN.md).
--
-- Todos os cards saem direto de `quotes` (org_id, período por `created_at`,
-- só revisão atual) — exceto o KPI central, "tempo até o 1º orçamento" (do
-- pedido do cliente ao PDF, CLAUDE.md > KPI central). Esse KPI não tinha
-- como ser calculado com o schema anterior: `quotes.created_at` e
-- `tax_snapshot_at` são gravados na mesma transação síncrona de
-- `create_public_quote` (Milestone 15) — a diferença entre os dois é sempre
-- ~instantânea, não reflete o tempo real de captcha + geração de PDF + envio.
-- E o PDF gerado pelo PDFMonkey nunca foi persistido em lugar nenhum.
--
-- Instrumentação nova: `requested_at` (capturado na primeira linha do
-- handler do formulário público, antes de honeypot/captcha — o instante mais
-- próximo do clique do cliente) e `delivered_at` (gravado logo após o PDF
-- ser gerado com sucesso, não após o e-mail — falha de envio não deveria
-- contaminar esta métrica). Só o canal público preenche as duas colunas:
-- orçamento manual (CRM) não tem um instante de "cliente pediu" distinto da
-- ação do próprio vendedor, então fica de fora do KPI (média ignora nulos).
--
-- Sem backfill possível — orçamentos existentes antes desta migration não
-- têm como reconstruir o instante do pedido. O KPI fica sem dado até o
-- primeiro orçamento público pós-deploy.

alter table quotes add column requested_at timestamptz;
alter table quotes add column delivered_at timestamptz;

-- As queries do dashboard (contagem/valor/conversão/funil por período) sempre
-- filtram por `org_id` + janela de `created_at`, só na revisão atual — mesmo
-- padrão de acesso do índice parcial `quotes_current_revision` (Milestone 14,
-- que cobre org_id + status), mas para um filtro por DATA em vez de status.
-- Sem isto, a leitura do dashboard faz seq scan em toda a organização a cada
-- carregamento de página.
create index quotes_org_created_current on quotes (org_id, created_at)
  where superseded_by_revision_id is null;

-- `create_public_quote` (Milestone 15, redefinida na Milestone 16 para logar
-- a timeline) — redefinida de novo só para gravar `requested_at` no insert.
-- Corpo idêntico fora do parâmetro novo e do trecho marcado abaixo.
create or replace function create_public_quote(
  p_org_id uuid,
  p_quote jsonb,
  p_items jsonb,
  p_snapshot jsonb
) returns quotes
language plpgsql security invoker
set search_path = public
as $$
declare
  v_quote    quotes;
  v_sequence integer;
  v_item     jsonb;
  v_tax      jsonb;
  v_position smallint := 0;
  v_item_id  uuid;
begin
  insert into quote_sequences (org_id, last_sequence)
  values (p_org_id, 1)
  on conflict (org_id) do update
    set last_sequence = quote_sequences.last_sequence + 1
  returning last_sequence into v_sequence;

  insert into quotes (
    org_id, sequence, revision,
    status, owner_id,
    customer_id, customer_name, customer_document, customer_source_id,
    discount_type, discount_value,
    payment_condition_id, expires_at,
    requested_at
  )
  values (
    p_org_id, v_sequence, 1,
    'gerado', null,
    (p_quote->>'customer_id')::uuid,
    p_quote->>'customer_name',
    coalesce(p_quote->>'customer_document', ''),
    p_quote->>'customer_source_id',
    coalesce(p_quote->>'discount_type', 'fixed'),
    coalesce((p_quote->>'discount_value')::numeric, 0),
    (p_quote->>'payment_condition_id')::uuid,
    (p_quote->>'expires_at')::date,
    -- NOVO na Milestone 19.
    coalesce((p_quote->>'requested_at')::timestamptz, now())
  )
  returning * into v_quote;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    insert into quote_items (
      quote_id, position, product_id, product_external_code, product_name,
      category_id_snapshot, category_name, quantity,
      unit_price_charged, unit_base_display, line_total
    )
    values (
      v_quote.id, v_position,
      (v_item->>'product_id')::uuid,
      v_item->>'product_external_code',
      v_item->>'product_name',
      (v_item->>'category_id_snapshot')::uuid,
      v_item->>'category_name',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price_charged')::numeric,
      (v_item->>'unit_base_display')::numeric,
      (v_item->>'line_total')::numeric
    )
    returning id into v_item_id;

    for v_tax in select * from jsonb_array_elements(coalesce(v_item->'taxes', '[]'::jsonb)) loop
      insert into quote_item_taxes (
        quote_item_id, tax_type_id, tax_code, tax_label, mode,
        rate_applied, rate_source, note, base_amount, tax_amount, display_order
      )
      values (
        v_item_id,
        (v_tax->>'tax_type_id')::uuid,
        v_tax->>'tax_code',
        v_tax->>'tax_label',
        v_tax->>'mode',
        (v_tax->>'rate_applied')::numeric,
        v_tax->>'rate_source',
        v_tax->>'note',
        (v_tax->>'base_amount')::numeric,
        (v_tax->>'tax_amount')::numeric,
        coalesce((v_tax->>'display_order')::smallint, 0)
      );
    end loop;
  end loop;

  update quotes set
    subtotal                           = (p_snapshot->>'subtotal')::numeric,
    total                              = (p_snapshot->>'total')::numeric,
    discount_amount                    = (p_snapshot->>'discount_amount')::numeric,
    payment_discount_amount            = (p_snapshot->>'payment_discount_amount')::numeric,
    payment_condition_label            = p_snapshot->>'payment_condition_label',
    payment_condition_kind             = p_snapshot->>'payment_condition_kind',
    payment_condition_discount_percent = (p_snapshot->>'payment_condition_discount_percent')::numeric,
    payment_condition_installments     = (p_snapshot->>'payment_condition_installments')::smallint,
    payment_condition_term_days        = (p_snapshot->>'payment_condition_term_days')::smallint,
    payment_band_label                 = p_snapshot->>'payment_band_label',
    tax_footer_note                    = p_snapshot->>'tax_footer_note',
    show_tax_lines                     = coalesce((p_snapshot->>'show_tax_lines')::boolean, true),
    tax_snapshot_at                    = now()
  where id = v_quote.id
  returning * into v_quote;

  insert into quote_activities (quote_id, type, label, author_label)
  values (v_quote.id, 'criacao', 'Orçamento gerado', 'Formulário público');

  return v_quote;
end;
$$;

-- Grava o instante em que o PDF ficou pronto para o cliente final. Chamada
-- pelo route handler do formulário público (service_role) só quando
-- `generateQuotePdf` retorna com sucesso — mesma razão de
-- `record_system_quote_activity`: sem sessão aqui, EXECUTE é PUBLIC por
-- padrão numa função nova.
--
-- `where delivered_at is null` torna a chamada idempotente por escolha (não
-- porque o caminho de código repita a chamada hoje): a primeira gravação
-- vence, então um retry futuro do route handler não pode inflar a métrica
-- reescrevendo o instante.
create or replace function record_quote_delivered(
  p_quote_id uuid,
  p_delivered_at timestamptz
) returns void
language sql security invoker
set search_path = public
as $$
  update quotes set delivered_at = p_delivered_at
  where id = p_quote_id and delivered_at is null;
$$;

revoke execute on function record_quote_delivered(uuid, timestamptz) from public;
grant execute on function record_quote_delivered(uuid, timestamptz) to service_role;
