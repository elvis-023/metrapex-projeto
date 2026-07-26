import { createHash } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Decimal from "decimal.js";

import { calculateQuote, formatQuoteNumber, QuoteCalculationError } from "@/lib/quotes/engine";
import { verifyTurnstileToken } from "@/lib/integrations/turnstile";
import { generateQuotePdf } from "@/lib/integrations/pdfmonkey";
import { sendQuoteEmail } from "@/lib/integrations/resend";
import { isWhatsAppEligiblePlan, triggerWhatsAppQuoteDelivery } from "@/lib/integrations/n8n";
import { isValidDocument } from "@/lib/public-form/cpf-cnpj";
import type { Database } from "@/lib/supabase/types";
import type { PublicFormAddress, PublicFormCartItem } from "@/lib/public-form/types";

/**
 * Client de service_role isolado a este route handler — não existe sessão
 * aqui (endpoint aberto à internet), então RLS não se aplica a ninguém e
 * este client bypassa tudo. Definido só neste arquivo, sem export, para que
 * nenhum outro endpoint reuse esse poder por engano.
 */
function createServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role não configurado.");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Camadas de rate limit — do mais barato ao mais caro de contornar.
const RATE_LIMIT_IP = { scope: "ip", windowSeconds: 600, limit: 10 };
const RATE_LIMIT_DOCUMENT = { scope: "document", windowSeconds: 86400, limit: 5 };
const RATE_LIMIT_ORG = { scope: "org", windowSeconds: 86400, limit: 500 };
const IDEMPOTENCY_WINDOW_SECONDS = 300;
const VALIDITY_DAYS = 30;

type PublicQuoteRequestBody = {
  publicFormKey: string;
  documentType: "cpf" | "cnpj";
  document: string;
  legalName: string;
  contactName: string;
  email: string;
  phone: string;
  address: PublicFormAddress;
  cart: PublicFormCartItem[];
  honeypot: string;
  captchaToken: string | null;
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function clientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function cartHash(cart: PublicFormCartItem[]): string {
  const normalized = [...cart]
    .map((item) => `${item.productId}:${item.quantity}`)
    .sort()
    .join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

function expiryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + VALIDITY_DAYS);
  return date.toISOString().slice(0, 10);
}

function validateBody(body: Partial<PublicQuoteRequestBody>): string | null {
  if (!body.publicFormKey) return "Formulário não identificado.";
  if (body.documentType !== "cpf" && body.documentType !== "cnpj")
    return "Tipo de documento inválido.";

  // Não só o formato: o dígito verificador é checado de verdade — achado da
  // revisão adversarial (14 dígitos não repetidos passava como CNPJ válido).
  if (!isValidDocument(body.documentType, body.document ?? "")) {
    return body.documentType === "cpf" ? "CPF inválido." : "CNPJ inválido.";
  }

  if (!body.legalName || body.legalName.trim().length < 2) return "Nome/razão social inválido.";
  if (!body.email || !/\S+@\S+\.\S+/.test(body.email)) return "E-mail inválido.";
  if (!body.phone || onlyDigits(body.phone).length < 10) return "Telefone inválido.";
  if (!body.address?.street || !body.address?.city) return "Endereço incompleto.";
  if (!Array.isArray(body.cart) || body.cart.length === 0) return "Carrinho vazio.";
  for (const item of body.cart) {
    if (typeof item.productId !== "string" || !item.productId) return "Item de carrinho inválido.";
    if (typeof item.quantity !== "number" || item.quantity <= 0) return "Quantidade inválida.";
  }
  if (!body.captchaToken) return "Verificação de segurança não concluída.";

  return null;
}

export async function POST(request: NextRequest) {
  let body: Partial<PublicQuoteRequestBody>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo da requisição inválido.");
  }

  // 1. Honeypot — mais barato possível, nem toca banco. Bot que preenche o
  // campo escondido cai aqui antes de qualquer outra checagem.
  if (body.honeypot) {
    return badRequest("Não foi possível processar a solicitação.");
  }

  const validationError = validateBody(body);
  if (validationError) return badRequest(validationError);

  const {
    publicFormKey,
    document,
    legalName,
    contactName,
    email,
    phone,
    address,
    cart,
    captchaToken,
  } = body as PublicQuoteRequestBody;

  const documentDigits = onlyDigits(document);
  const ip = clientIp(request);

  // 2. Turnstile — segunda camada mais barata, ainda sem tocar banco.
  try {
    const captchaOk = await verifyTurnstileToken(captchaToken!, ip === "unknown" ? null : ip);
    if (!captchaOk) return badRequest("Verificação de segurança falhou.");
  } catch (error) {
    console.error("[public-quote] falha ao verificar Turnstile", error);
    return badRequest("Não foi possível validar a verificação de segurança.", 503);
  }

  const supabase = createServiceClient();

  // 3. Resolução da organização pela chave pública do snippet — nunca pelo
  // slug (migration 20260726000010).
  const { data: org } = await supabase
    .rpc("resolve_public_organization", { p_public_form_key: publicFormKey })
    .maybeSingle();

  if (!org) return badRequest("Formulário não encontrado.", 404);

  // 4. Rate limit — IP, depois documento por organização, depois teto da
  // organização. Falha cedo, na ordem do mais barato pro mais caro de burlar.
  const [ipOk, documentOk, orgOk] = await Promise.all([
    supabase.rpc("public_form_check_rate_limit", {
      p_scope: RATE_LIMIT_IP.scope,
      p_key: ip,
      p_window_seconds: RATE_LIMIT_IP.windowSeconds,
      p_limit: RATE_LIMIT_IP.limit,
    }),
    supabase.rpc("public_form_check_rate_limit", {
      p_scope: RATE_LIMIT_DOCUMENT.scope,
      p_key: `${org.id}:${documentDigits}`,
      p_window_seconds: RATE_LIMIT_DOCUMENT.windowSeconds,
      p_limit: RATE_LIMIT_DOCUMENT.limit,
    }),
    supabase.rpc("public_form_check_rate_limit", {
      p_scope: RATE_LIMIT_ORG.scope,
      p_key: org.id,
      p_window_seconds: RATE_LIMIT_ORG.windowSeconds,
      p_limit: RATE_LIMIT_ORG.limit,
    }),
  ]);

  if (ipOk.data === false)
    return badRequest("Muitas solicitações. Tente novamente mais tarde.", 429);
  if (documentOk.data === false) {
    return badRequest("Limite de solicitações para este documento atingido hoje.", 429);
  }
  if (orgOk.data === false) {
    return badRequest("Este formulário atingiu o limite de solicitações do dia.", 429);
  }

  // 5. Idempotência — absorve duplo clique/retry, não é a barreira de
  // segurança (essa já passou, acima).
  const hash = cartHash(cart);
  const { data: claim } = await supabase
    .rpc("public_form_claim_submission", {
      p_org_id: org.id,
      p_document: documentDigits,
      p_cart_hash: hash,
      p_window_seconds: IDEMPOTENCY_WINDOW_SECONDS,
    })
    .maybeSingle();

  if (claim && !claim.claimed) {
    if (claim.status === "done" && claim.quote_id) {
      const { data: existingQuote } = await supabase
        .from("quotes")
        .select("sequence")
        .eq("id", claim.quote_id)
        .maybeSingle();
      if (existingQuote) {
        return NextResponse.json({ quoteNumber: formatQuoteNumber(existingQuote.sequence) });
      }
    }
    // `status = 'processing'` ainda em andamento (corrida rara): segue e
    // processa de novo em vez de travar a resposta do cliente.
  }

  // 6. Catálogo e configuração fiscal/pagamento — sempre escopados por
  // org_id explicitamente: o service_role bypassa RLS, então não há mais
  // nenhuma camada isolando organizações além desta query.
  const [productsResult, categoriesResult, taxTypesResult, taxSettingsResult, taxRatesResult] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, external_code, name, price, category_id, photo_url")
        .eq("org_id", org.id),
      supabase.from("product_categories").select("id, name").eq("org_id", org.id),
      supabase
        .from("tax_types")
        .select("id, code, label, mode, default_rate, active, display_order")
        .eq("org_id", org.id)
        .eq("active", true)
        .order("display_order"),
      supabase
        .from("tax_settings")
        .select("document_footer, show_tax_lines")
        .eq("org_id", org.id)
        .maybeSingle(),
      supabase.from("tax_rates").select("tax_type_id, category_id, product_id, rate, note"),
    ]);

  const taxTypeIds = new Set((taxTypesResult.data ?? []).map((row) => row.id));

  let calculation;
  try {
    calculation = calculateQuote({
      items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      products: (productsResult.data ?? []).map((row) => ({
        id: row.id,
        externalCode: row.external_code,
        name: row.name,
        price: Number(row.price),
        categoryId: row.category_id,
        photoUrl: row.photo_url,
      })),
      categoryNamesById: new Map((categoriesResult.data ?? []).map((row) => [row.id, row.name])),
      taxTypes: (taxTypesResult.data ?? []).map((row) => ({
        id: row.id,
        code: row.code,
        label: row.label,
        mode: row.mode,
        defaultRate: Number(row.default_rate),
        active: row.active,
        displayOrder: row.display_order,
      })),
      overrides: (taxRatesResult.data ?? [])
        .filter((row) => taxTypeIds.has(row.tax_type_id))
        .map((row) => ({
          taxTypeId: row.tax_type_id,
          categoryId: row.category_id,
          productId: row.product_id,
          rate: Number(row.rate),
          note: row.note,
        })),
      // O formulário público não escolhe condição de pagamento — fica a
      // cargo do vendedor negociar depois, no CRM.
      discount: { type: "fixed", value: 0 },
      paymentConditionId: null,
      paymentConditions: [],
      paymentValueBands: [],
    });
  } catch (error) {
    if (error instanceof QuoteCalculationError) return badRequest(error.message);
    throw error;
  }

  // 7. Dedupe do cliente por (org_id, documento) — upsert atômico, não
  // select-depois-insert: duas submissões do mesmo documento não podem criar
  // dois registros de cliente numa corrida.
  const { data: customerId, error: customerError } = await supabase.rpc("upsert_public_customer", {
    p_org_id: org.id,
    p_document: documentDigits,
    p_name: legalName.trim(),
    p_email: email,
    p_phone: phone,
    p_address: address,
  });

  if (customerError || !customerId) {
    console.error("[public-quote] falha ao gravar cliente", customerError);
    return badRequest("Não foi possível processar a solicitação. Tente novamente.", 500);
  }

  // 8. Persistência — nasce já emitido (create_public_quote), sem fase de
  // rascunho: o cliente final recebe o PDF na hora, não revisa um rascunho.
  const items = calculation.items.map((item) => ({
    product_id: item.productId,
    product_external_code: item.productExternalCode,
    product_name: item.productName,
    category_id_snapshot: item.categoryId,
    category_name: item.categoryName,
    quantity: item.quantity.toFixed(6),
    unit_price_charged: item.unitPriceCharged.toFixed(6),
    unit_base_display: item.unitBaseDisplay.toFixed(6),
    line_total: item.lineTotal.toFixed(6),
    taxes: item.taxes.map((tax) => ({
      tax_type_id: tax.taxTypeId,
      tax_code: tax.taxCode,
      tax_label: tax.taxLabel,
      mode: tax.mode,
      rate_applied: new Decimal(tax.rateApplied).toFixed(4),
      rate_source: tax.rateSource,
      note: tax.note,
      base_amount: tax.baseAmount.toFixed(6),
      tax_amount: tax.taxAmount.toFixed(6),
      display_order: tax.displayOrder,
    })),
  }));

  const snapshot = {
    subtotal: calculation.subtotal.toFixed(6),
    total: calculation.total.toFixed(6),
    discount_amount: calculation.discountAmount.toFixed(6),
    payment_discount_amount: calculation.paymentDiscountAmount.toFixed(6),
    payment_condition_label: null,
    payment_condition_kind: null,
    payment_condition_discount_percent: null,
    payment_condition_installments: null,
    payment_condition_term_days: null,
    payment_band_label: null,
    tax_footer_note: taxSettingsResult.data?.document_footer ?? null,
    show_tax_lines: taxSettingsResult.data?.show_tax_lines ?? true,
  };

  const { data: quote, error: createError } = await supabase.rpc("create_public_quote", {
    p_org_id: org.id,
    p_quote: {
      customer_id: customerId,
      customer_name: legalName.trim(),
      customer_document: documentDigits,
      customer_source_id: "site",
      discount_type: "fixed",
      discount_value: "0",
      payment_condition_id: null,
      expires_at: expiryDate(),
    },
    p_items: items,
    p_snapshot: snapshot,
  });

  if (createError || !quote) {
    console.error("[public-quote] falha ao criar orçamento", createError);
    return badRequest("Não foi possível gerar o orçamento. Tente novamente.", 500);
  }

  if (claim) {
    await supabase.rpc("public_form_complete_submission", { p_id: claim.id, p_quote_id: quote.id });
  }

  const quoteNumber = formatQuoteNumber(quote.sequence);

  // 9. PDF + entrega — melhor esforço a partir daqui: o documento já existe
  // no pipeline da organização mesmo que a entrega falhe, então uma falha
  // aqui não derruba a resposta de sucesso ao cliente final. E-mail e
  // WhatsApp falham independentemente um do outro — um canal quebrado não
  // deve impedir o outro de tentar.
  let pdfUrl: string | null = null;
  try {
    const { data: pdfSettings } = await supabase
      .from("pdf_settings")
      .select(
        "logo_url, issuer_name, issuer_document, issuer_address, warranty_text, terms_text, shipping_text, pdfmonkey_template_id",
      )
      .eq("org_id", org.id)
      .maybeSingle();

    const templateId =
      pdfSettings?.pdfmonkey_template_id ?? process.env.PDFMONKEY_DEFAULT_TEMPLATE_ID;
    if (!templateId) throw new Error("Nenhum template do PDFMonkey configurado.");

    pdfUrl = await generateQuotePdf({
      templateId,
      payload: {
        quote_number: quoteNumber,
        organization_name: org.name,
        issuer: pdfSettings ?? null,
        customer: { legalName, contactName, document, email, phone, address },
        items: calculation.items.map((item) => ({
          name: item.productName,
          quantity: item.quantity.toNumber(),
          unit_price: item.unitPriceCharged.toNumber(),
          line_total: item.lineTotal.toNumber(),
        })),
        subtotal: calculation.subtotal.toNumber(),
        total: calculation.total.toNumber(),
        expires_at: expiryDate(),
      },
    });
  } catch (error) {
    console.error("[public-quote] falha ao gerar PDF do orçamento", quote.id, error);
  }

  if (pdfUrl) {
    try {
      await sendQuoteEmail({ to: email, organizationName: org.name, quoteNumber, pdfUrl });
    } catch (error) {
      console.error("[public-quote] falha ao enviar e-mail do orçamento", quote.id, error);
    }

    if (isWhatsAppEligiblePlan(org.plan)) {
      try {
        await triggerWhatsAppQuoteDelivery({
          phone,
          organizationName: org.name,
          quoteNumber,
          pdfUrl,
        });
      } catch (error) {
        console.error("[public-quote] falha ao acionar entrega por WhatsApp", quote.id, error);
      }
    }
  }

  return NextResponse.json({ quoteNumber });
}
