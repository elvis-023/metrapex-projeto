/**
 * Snippet de incorporação do formulário público de orçamento (Milestone 15).
 * Vanilla JS de propósito — roda no site do cliente, fora de qualquer
 * controle de build/framework nosso, então não pode depender de nada além
 * do próprio navegador.
 *
 * Uso:
 *   <script src="https://SEU_DOMINIO/embed.js" data-org-key="pfk_..." async></script>
 *   <div id="metrapex-orcamento"></div>
 *
 * Atributos opcionais no <script>:
 *   data-produto="CODIGO"  — pré-carrega um produto específico do catálogo.
 *   data-target="outro-id" — usa outro elemento como alvo em vez do padrão.
 */
(function () {
  var scripts = document.getElementsByTagName("script");
  var current = scripts[scripts.length - 1];

  var orgKey = current.getAttribute("data-org-key");
  if (!orgKey) {
    console.error("[metrapex] embed.js: atributo data-org-key ausente no <script>.");
    return;
  }

  var targetId = current.getAttribute("data-target") || "metrapex-orcamento";
  var target = document.getElementById(targetId);
  if (!target) {
    console.error('[metrapex] embed.js: elemento "#' + targetId + '" não encontrado na página.');
    return;
  }

  var origin = current.src.replace(/\/embed\.js.*$/, "");
  var produto = current.getAttribute("data-produto");
  var src = origin + "/quote-request/" + encodeURIComponent(orgKey);
  if (produto) {
    src += "?produto=" + encodeURIComponent(produto);
  }

  var iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = "Formulário de orçamento";
  iframe.style.width = "100%";
  iframe.style.minHeight = "640px";
  iframe.style.border = "0";

  target.appendChild(iframe);
})();
