/*!
 * Simulateur de capacité recrutement — Le Club des RH
 * PAGE DE CONTACT : reprend le contexte de la simulation et le joint au formulaire.
 *
 * À charger sur /client-contact, après config.js :
 *   <script src=".../src/config.js"></script>
 *   <script src=".../src/client-contact.js"></script>
 *
 * Aucune donnée personnelle n'est lue : uniquement les chiffres de la simulation,
 * déposés par le simulateur dans le sessionStorage du même domaine.
 */
(function (root, doc) {
  'use strict';

  var CFG = root.CRS_CONFIG;
  if (!CFG || !CFG.handoff) { if (root.console) console.error('[CRS] config.js doit être chargé avant client-contact.js.'); return; }

  /* Champs déjà gérés par le site : on ne les duplique pas. */
  var SKIP = { utm_source: 1, utm_medium: 1, utm_campaign: 1, utm_content: 1, utm_term: 1, page_url: 1 };

  function readHandoff() {
    try {
      var raw = root.sessionStorage.getItem(CFG.handoff.storage_key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }   // navigation privée, autre navigateur, stockage bloqué
  }

  function hidden(form, name, value) {
    var el = form.querySelector('input[type="hidden"][name="' + name + '"]');
    if (!el) {
      el = doc.createElement('input');
      el.type = 'hidden';
      el.name = name;
      form.appendChild(el);
    }
    el.value = String(value);
  }

  function init() {
    var form = doc.querySelector(CFG.handoff.contact_form_selector);
    if (!form) return;

    var handoff = readHandoff();
    if (!handoff || !handoff.data) return;   // arrivée directe : formulaire normal, sans contexte

    Object.keys(handoff.data).forEach(function (k) {
      if (!SKIP[k]) hidden(form, k, handoff.data[k]);
    });
    hidden(form, 'simulation_saved_at', handoff.saved_at || '');

    /* Message pré-rempli (modifiable par l'utilisateur), uniquement s'il est vide. */
    if (CFG.handoff.prefill_message && handoff.summary) {
      var msg = form.querySelector('[name="' + CFG.handoff.message_field + '"]');
      if (msg && !msg.value.trim()) {
        msg.value = handoff.summary + '\n\n';
        if (typeof msg.dispatchEvent === 'function') msg.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
