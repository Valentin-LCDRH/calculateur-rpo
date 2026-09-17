/*!
 * Simulateur de capacité recrutement — Le Club des RH
 * INTERFACE. Dépend de config.js puis calc.js.
 * Point de montage : <div id="crs-simulator"></div>
 */
(function (root, doc) {
  'use strict';

  var CFG = root.CRS_CONFIG, C = root.CRSCalc;
  if (!CFG || !C) { if (root.console) console.error('[CRS] Chargez config.js et calc.js avant app.js.'); return; }

  /* ================================================================
   * Contenus
   * ================================================================ */
  var TYPO = [
    { k: 'volume', field: 'volume_hires', letter: 'A', label: 'Volume / standardisé',
      desc: 'Postes récurrents, process homogènes, vivier identifiable.',
      tip: 'Postes relativement récurrents, process homogènes, vivier identifiable et volume important.' },
    { k: 'standard', field: 'standard_hires', letter: 'B', label: 'Standard',
      desc: 'Sourcing et approche individualisée, sans tension exceptionnelle.',
      tip: 'Recrutements nécessitant du sourcing et une approche individualisée, sans tension exceptionnelle sur le marché.' },
    { k: 'complex', field: 'complex_hires', letter: 'C', label: 'Complexe / pénurique',
      desc: 'Profils rares, forte chasse, marché très tendu.',
      tip: 'Profils rares, forte chasse, expertise spécifique ou marché candidat particulièrement tendu.' }
  ];

  var MIX_META = {
    internal: { label: 'Renfort interne', short: 'Interne' },
    rpo: { label: 'RPO freelance', short: 'RPO' },
    agency: { label: 'Cabinet / chasse de tête', short: 'Cabinet' }
  };

  var DISCLAIMER = 'Les résultats de ce simulateur sont des estimations destinées à faciliter la réflexion sur le dimensionnement d’une équipe recrutement. La productivité et les coûts réels peuvent varier selon le secteur, la séniorité des profils recherchés, la tension du marché, les outils utilisés, l’organisation de l’équipe et le périmètre confié aux différents partenaires.';

  /* ================================================================
   * État
   * ================================================================ */
  var S = {
    planned_hires: '', period_months: CFG.defaults.period_months, turnover_included: '',
    turnover_replacement_hires: '', additional_turnover_hires: '',
    internal_recruiters: '', hires_per_recruiter_month: '',
    recruiting_time_percentage: CFG.defaults.recruiting_time_percentage,
    volume_hires: 0, standard_hires: 0, complex_hires: 0
  };
  var H = {};
  Object.keys(CFG.hypotheses).forEach(function (k) { H[k] = CFG.hypotheses[k] === null ? '' : CFG.hypotheses[k]; });

  var MIX = { internal: 0, rpo: 0, agency: 0 };
  var mixTouched = false;
  var step = 1;
  var unitMode = false;      // pas de gap : comparaison des coûts unitaires
  var simulationId = '';    // identifiant anonyme de la simulation (relie l'enregistrement et le formulaire de contact)
  var rootEl = null;
  var fired = {};
  var UTM = {};

  /* ================================================================
   * Utilitaires
   * ================================================================ */
  var NF0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var NF1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  var NF2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function plural(n, one, many) { return Math.abs(n) >= 2 ? many : one; }
  function hiresTxt(n) { return NF0.format(n) + ' ' + plural(n, 'recrutement', 'recrutements'); }
  function isNum(v) { return v !== null && v !== undefined && isFinite(v); }
  function eur(v, ht) { return isNum(v) ? NF0.format(Math.round(v)) + ' €' + (ht ? ' HT' : '') : null; }
  function scopeOf(name) { return name === 'H' ? H : S; }
  function qa(sel, el) { return Array.prototype.slice.call((el || rootEl).querySelectorAll(sel)); }

  function tip(text) {
    return '<span class="crs-tip" tabindex="0" role="note" aria-label="' + esc(text) + '" data-tip="' + esc(text) + '">?</span>';
  }

  /* ================================================================
   * Analytics (GA4 / GTM) et UTM
   * ================================================================ */
  function readUtm() {
    var params = new URLSearchParams(root.location.search), found = {}, any = false;
    CFG.utm_keys.forEach(function (k) { var v = params.get(k); if (v) { found[k] = v; any = true; } });
    try {
      if (any) root.sessionStorage.setItem(CFG.utm_storage_key, JSON.stringify(found));
      else found = JSON.parse(root.sessionStorage.getItem(CFG.utm_storage_key) || '{}') || {};
    } catch (e) { /* stockage indisponible : on garde la lecture d'URL */ }
    CFG.utm_keys.forEach(function (k) { UTM[k] = found[k] || ''; });
  }

  function track(event, props, once) {
    if (once) { if (fired[event]) return; fired[event] = true; }
    var cap = C.computeCapacity(S);
    var data = {
      calculator: 'recruitment_capacity',
      hiring_plan: cap.planned_hires,
      total_hiring_need: cap.total_hiring_need,
      capacity_gap: cap.capacity_gap,
      source: UTM.utm_source || '',
      campaign: UTM.utm_campaign || ''
    };
    if (props) Object.keys(props).forEach(function (k) { data[k] = props[k]; });
    root.dataLayer = root.dataLayer || [];
    var hasGtm = !!(root.google_tag_manager && Object.keys(root.google_tag_manager).some(function (k) { return k.indexOf('GTM-') === 0; }));
    if (hasGtm || typeof root.gtag !== 'function') {
      root.dataLayer.push(Object.assign({ event: event }, data));
    } else {
      root.gtag('event', event, data);
    }
  }

  /* ================================================================
   * Composants HTML
   * ================================================================ */
  function field(scope, name, label, o) {
    o = o || {};
    return '<div class="crs-field' + (o.cls ? ' ' + o.cls : '') + '">' +
      '<label class="crs-label" for="crs-' + name + '">' + label + (o.tip ? tip(o.tip) : '') + '</label>' +
      '<div class="crs-input">' +
        '<input id="crs-' + name + '" type="text" inputmode="' + (o.decimal ? 'decimal' : 'numeric') + '" autocomplete="off"' +
        ' data-scope="' + scope + '" data-field="' + name + '"' + (o.int ? ' data-int' : '') +
        ' placeholder="' + esc(o.placeholder || '') + '">' +
        (o.suffix ? '<span class="crs-suffix">' + o.suffix + '</span>' : '') +
      '</div>' +
      (o.help ? '<p class="crs-help">' + o.help + '</p>' : '') +
    '</div>';
  }

  function segmented(name, label, options, o) {
    o = o || {};
    return '<div class="crs-field">' +
      '<span class="crs-label" id="crs-lbl-' + name + '">' + label + (o.tip ? tip(o.tip) : '') + '</span>' +
      '<div class="crs-seg' + (o.cls ? ' ' + o.cls : '') + '" role="radiogroup" aria-labelledby="crs-lbl-' + name + '">' +
        options.map(function (op) {
          return '<button type="button" role="radio" aria-checked="false" data-choice="' + name + '" data-value="' + op.v + '">' + op.label + '</button>';
        }).join('') +
      '</div></div>';
  }

  function slider(scope, name, label, b, suffix, o) {
    o = o || {};
    return '<div class="crs-field">' +
      '<div class="crs-label-row"><label class="crs-label" for="crs-' + name + '">' + label + (o.tip ? tip(o.tip) : '') + '</label>' +
      '<output class="crs-output" data-out="' + name + '_txt"></output></div>' +
      '<input id="crs-' + name + '" class="crs-range" type="range" min="' + b.min + '" max="' + b.max + '" step="' + b.step + '" data-scope="' + scope + '" data-field="' + name + '">' +
      (o.help ? '<p class="crs-help">' + o.help + '</p>' : '') +
    '</div>';
  }

  function stepper(name, label) {
    return '<div class="crs-stepper">' +
      '<button type="button" class="crs-stepper-btn" data-action="dec" data-target="' + name + '" aria-label="Retirer un recrutement">−</button>' +
      '<input type="text" inputmode="numeric" autocomplete="off" aria-label="' + esc(label) + '" data-scope="S" data-field="' + name + '" data-int>' +
      '<button type="button" class="crs-stepper-btn" data-action="inc" data-target="' + name + '" aria-label="Ajouter un recrutement">+</button>' +
    '</div>';
  }

  function actions(n, label) {
    return '<div class="crs-actions">' +
      (n > 1 ? '<button type="button" class="crs-btn crs-btn--ghost" data-action="prev">Retour</button>' : '<span></span>') +
      '<div class="crs-actions-right"><span class="crs-hint" data-out="hint' + n + '"></span>' +
      '<button type="button" class="crs-btn" data-action="next" data-for="' + n + '">' + label + '<span aria-hidden="true">→</span></button></div>' +
    '</div>';
  }

  function liveInline() {
    return '<div class="crs-live-inline" data-if="live_ready" aria-live="polite">' +
      '<div><span>Besoin total</span><strong data-out="live_need_num"></strong></div>' +
      '<div><span>Capacité interne</span><strong data-out="live_capacity_num"></strong></div>' +
      '<div><span>À absorber</span><strong data-out="live_gap_num"></strong></div>' +
    '</div>';
  }

  /* ================================================================
   * Gabarit
   * ================================================================ */
  var STEP_LABELS = ['Plan de recrutement', 'Équipe TA', 'Besoin supplémentaire', 'Simulation'];

  function template() {
    var periodOpts = CFG.bounds.period_months_options.map(function (m) { return { v: m, label: m + ' mois' }; });

    var nav = '<ol class="crs-nav">' + STEP_LABELS.map(function (l, i) {
      return '<li><button type="button" class="crs-nav-item" data-action="goto" data-step="' + (i + 1) + '">' +
        '<span class="crs-nav-num">0' + (i + 1) + '</span><span class="crs-nav-label">' + l + '</span></button></li>';
    }).join('') + '</ol>';

    var s1 = '<section class="crs-step" data-step="1">' +
      '<header class="crs-step-head"><span class="crs-kicker">Étape 1 sur 4</span><h2 class="crs-h2" tabindex="-1">Votre plan de recrutement</h2></header>' +
      '<div class="crs-grid-2">' +
        field('S', 'planned_hires', 'Recrutements prévus dans votre plan', { int: true, suffix: 'recrutements', placeholder: '80' }) +
        segmented('period_months', 'Sur quelle période ?', periodOpts, { cls: 'crs-seg--grid4' }) +
      '</div>' +
      segmented('turnover_included', 'Votre plan inclut-il déjà les remplacements liés au turnover ?',
        [{ v: 'oui', label: 'Oui' }, { v: 'non', label: 'Non' }, { v: 'partiel', label: 'Partiellement' }],
        { tip: 'L’objectif est d’estimer le volume réel de recrutements que votre équipe devra absorber, en intégrant à la fois les créations de postes et les remplacements liés aux départs.' }) +
      '<div data-if="turnover_non" class="crs-reveal">' +
        field('S', 'turnover_replacement_hires', 'Combien de recrutements supplémentaires anticipez-vous pour remplacer les départs ?', { int: true, suffix: 'recrutements', placeholder: '12' }) +
      '</div>' +
      '<div data-if="turnover_partiel" class="crs-reveal">' +
        field('S', 'additional_turnover_hires', 'Combien de remplacements supplémentaires estimez-vous devoir ajouter à votre plan actuel ?', { int: true, suffix: 'recrutements', placeholder: '6' }) +
      '</div>' +
      liveInline() + actions(1, 'Continuer') +
    '</section>';

    var s2 = '<section class="crs-step" data-step="2">' +
      '<header class="crs-step-head"><span class="crs-kicker">Étape 2 sur 4</span><h2 class="crs-h2" tabindex="-1">Capacité de votre équipe interne</h2></header>' +
      '<div class="crs-grid-2">' +
        field('S', 'internal_recruiters', 'Recruteurs internes sur ce hiring plan', { decimal: true, suffix: 'recruteurs', placeholder: '3',
          tip: 'Vous pouvez saisir des équivalents temps plein, par exemple 2,5.' }) +
        field('S', 'hires_per_recruiter_month', 'Recrutements finalisés / recruteur à temps plein', { decimal: true, suffix: '/ mois', placeholder: '3',
          tip: 'Utilisez idéalement la moyenne constatée sur vos 6 à 12 derniers mois. Cette donnée permet d’adapter la simulation à votre secteur et à la complexité habituelle de vos recrutements.' }) +
      '</div>' +
      slider('S', 'recruiting_time_percentage', 'Part du temps réellement consacrée au recrutement', CFG.bounds.recruiting_time_percentage, '%',
        { tip: 'Tient compte des recruteurs ayant aussi des responsabilités de management, projets, reporting, marque employeur, etc.' }) +
      liveInline() + actions(2, 'Voir mon besoin') +
    '</section>';

    var typoRows = TYPO.map(function (t) {
      return '<div class="crs-typo-row">' +
        '<div class="crs-typo-letter crs-typo-letter--' + t.k + '">' + t.letter + '</div>' +
        '<div class="crs-typo-text"><div class="crs-typo-label">' + t.label + tip(t.tip) + '</div><div class="crs-typo-desc">' + t.desc + '</div></div>' +
        '<div class="crs-typo-ctrl">' + stepper(t.field, t.label) +
        '<button type="button" class="crs-link" data-action="rest" data-target="' + t.field + '" data-if="typo_under">+ le reste</button></div>' +
      '</div>';
    }).join('');

    var s3 = '<section class="crs-step" data-step="3">' +
      '<div data-if="has_gap">' +
        '<header class="crs-step-head"><span class="crs-kicker">Étape 3 sur 4</span><h2 class="crs-h2" tabindex="-1">Nature du besoin supplémentaire</h2>' +
        '<p class="crs-lead">Quels types de recrutements composent principalement les <strong data-out="gap_txt"></strong> que votre équipe ne peut pas absorber ?</p></header>' +
        '<div class="crs-counter" data-counter><span class="crs-counter-num"><strong data-out="typo_sum"></strong> / <span data-out="gap_num"></span></span> recrutements répartis' +
        '<span class="crs-counter-track"><span class="crs-counter-fill" data-counter-fill></span></span></div>' +
        '<div class="crs-typo">' + typoRows + '</div>' +
        actions(3, 'Lancer la simulation') +
      '</div>' +
      '<div data-if="no_gap" class="crs-nogap">' +
        '<div class="crs-nogap-icon" aria-hidden="true">✓</div>' +
        '<h2 class="crs-h2" tabindex="-1">Votre capacité actuelle semble suffisante pour absorber votre plan de recrutement.</h2>' +
        '<p class="crs-lead">Sur la base des informations renseignées, votre équipe dispose théoriquement de la capacité nécessaire pour réaliser votre plan de recrutement sur la période.</p>' +
        '<div class="crs-nogap-actions">' +
          '<button type="button" class="crs-btn" data-action="restart">Tester un autre scénario</button>' +
          '<button type="button" class="crs-btn crs-btn--ghost" data-action="unit">Comparer mes coûts de recrutement</button>' +
        '</div>' +
      '</div>' +
    '</section>';

    var hypRpo = '<details class="crs-details"><summary>Modifier les hypothèses RPO</summary>' +
      '<p class="crs-help">Estimations de simulation, adaptez-les à vos métiers.</p>' +
      '<div class="crs-grid-4">' +
        field('H', 'rpo_daily_rate', 'TJM RPO', { suffix: '€ HT / j', int: true }) +
        field('H', 'rpo_days_volume', 'Volume', { suffix: 'j / recr.', decimal: true }) +
        field('H', 'rpo_days_standard', 'Standard', { suffix: 'j / recr.', decimal: true }) +
        field('H', 'rpo_days_complex', 'Complexe', { suffix: 'j / recr.', decimal: true }) +
      '</div>' +
      '<div data-html="rpo_note"></div></details>';

    var mixRows = C.MIX_KEYS.map(function (k) {
      return '<div class="crs-mix-row">' +
        '<div class="crs-mix-head"><span class="crs-dot crs-dot--' + k + '"></span><span class="crs-mix-label">' + MIX_META[k].label + '</span>' +
        '<span class="crs-mix-cost" data-out="mix_cost_' + k + '"></span></div>' +
        '<div class="crs-mix-ctrl">' +
          '<input type="range" class="crs-range crs-range--' + k + '" min="0" step="1" data-mix="' + k + '" aria-label="' + MIX_META[k].label + ' (recrutements)">' +
          '<div class="crs-mix-num"><input type="text" inputmode="numeric" autocomplete="off" data-mix="' + k + '" aria-label="' + MIX_META[k].label + '"><span>recr.</span></div>' +
        '</div></div>';
    }).join('');

    var s4 = '<section class="crs-step crs-results" data-step="4">' +
      /* Carte partageable */
      '<div class="crs-hero">' +
        '<div class="crs-hero-top"><div><span class="crs-kicker crs-kicker--light">Simulation · <span data-out="period_txt"></span></span>' +
        '<h2 class="crs-h2 crs-hero-title" tabindex="-1">Votre capacité de recrutement</h2></div>' +
        '<div class="crs-hero-cov"><span class="crs-hero-cov-num" data-out="coverage_txt"></span><span class="crs-hero-cov-lbl">couverture actuelle</span></div></div>' +
        '<div class="crs-hero-grid">' +
          '<div><span>Plan de recrutement initial</span><strong data-out="planned_txt"></strong></div>' +
          '<div><span>Remplacements liés au turnover</span><strong data-out="turnover_txt"></strong></div>' +
          '<div><span>Besoin total estimé</span><strong data-out="need_txt"></strong></div>' +
          '<div><span>Capacité interne actuelle</span><strong data-out="capacity_txt"></strong></div>' +
          '<div class="crs-hero-gap"><span>Capacité supplémentaire nécessaire</span><strong data-out="gap_hero_txt"></strong></div>' +
        '</div>' +
        '<div data-html="hero_bar"></div>' +
      '</div>' +

      '<div class="crs-results-body">' +
      /* Hypothèses de coût */
      '<div class="crs-block">' +
        '<div class="crs-block-head"><h3 class="crs-h3">Vos hypothèses de coût<span data-if="has_gap"> pour couvrir vos <span data-out="gap_txt"></span> supplémentaires à absorber</span></h3><p class="crs-help">Visibles et modifiables à tout moment.</p></div>' +
        '<div class="crs-grid-2 crs-hyp">' +
          '<div class="crs-hyp-group"><div class="crs-hyp-title"><span class="crs-dot crs-dot--internal"></span>Renfort interne</div>' +
            field('H', 'internal_recruiter_salary', 'Salaire brut annuel moyen d’un recruteur', { int: true, suffix: '€ brut / an', placeholder: '50 000' }) +
            field('H', 'employer_cost_multiplier', 'Coefficient salaire brut → coût employeur', { decimal: true, suffix: '×', placeholder: '1,45',
              tip: 'Renseignez le coefficient habituellement utilisé dans votre entreprise pour estimer le coût employeur total à partir du salaire brut annuel.' }) +
          '</div>' +
          '<div class="crs-hyp-group"><div class="crs-hyp-title"><span class="crs-dot crs-dot--agency"></span>Cabinet / chasse de tête</div>' +
            field('H', 'average_salary', 'Salaire brut annuel moyen des profils concernés', { int: true, suffix: '€ brut / an', placeholder: '60 000' }) +
            slider('H', 'agency_fee_percentage', 'Honoraires moyens de vos cabinets', CFG.bounds.agency_fee_percentage, '%') +
          '</div>' +
        '</div>' +
        hypRpo +
      '</div>' +

      '<div data-if="has_gap">' +
        '<div class="crs-block">' +
          '<div class="crs-block-head"><h3 class="crs-h3">Trois façons de couvrir <span data-out="gap_txt"></span></h3>' +
          '<p class="crs-help">Coût estimé si l’intégralité du besoin supplémentaire était confiée à chaque solution. Ces options peuvent cohabiter : simulez votre allocation plus bas.</p></div>' +
          '<div class="crs-cards" data-html="cards"></div>' +
        '</div>' +

        '<div class="crs-block crs-mix">' +
          '<div class="crs-block-head"><h3 class="crs-h3">Simulez l’allocation de votre besoin de renfort</h3>' +
          '<p class="crs-help">Répartissez les recrutements que votre équipe actuelle ne peut pas absorber entre trois solutions.</p></div>' +
          '<div class="crs-mix-grid">' +
            '<div class="crs-mix-rows">' + mixRows +
              '<div class="crs-mix-sum"><span data-out="mix_sum"></span> / <span data-out="gap_num"></span> recrutements alloués</div>' +
            '</div>' +
            '<div class="crs-budget">' +
              '<span class="crs-budget-lbl">Budget estimé de votre allocation</span>' +
              '<strong class="crs-budget-num" data-out="budget_total"></strong>' +
              '<div data-html="mix_bar"></div>' +
              '<ul class="crs-budget-list" data-html="budget_list"></ul>' +
            '</div>' +
          '</div>' +
          '<div class="crs-callout crs-callout--inline"><span class="crs-callout-lbl">Hypothèse de ventilation</span>' +
            '<p>Le cabinet prend en priorité les recrutements les plus complexes / stratégiques ; les autres sont répartis entre RPO et interne au prorata de votre typologie.</p></div>' +
        '</div>' +

        '<div class="crs-cta">' +
          '<div><h3 class="crs-h3">Besoin de renforcer votre équipe recrutement ?</h3>' +
          '<p>Le Club des RH vous permet d’accéder rapidement à des RPO freelances qualifiés et disponibles pour absorber un pic de recrutement ou renforcer temporairement votre équipe Talent Acquisition.</p>' +
          '<p data-if="has_complex">Nous pouvons également vous mettre en relation avec un chasseur de tête spécialisé pour vos recrutements les plus stratégiques.</p></div>' +
          '<a class="crs-btn crs-btn--light" data-track="meeting" href="' + esc(CFG.links.meeting_url) + '">Prendre rendez-vous<span aria-hidden="true">→</span></a>' +
        '</div>' +
      '</div>' +

      '<div data-if="no_gap" class="crs-block">' +
        '<div class="crs-block-head"><h3 class="crs-h3">Comparer vos coûts par recrutement</h3>' +
        '<p class="crs-help">Votre capacité couvre votre plan. Voici, à titre de repère, le coût d’un recrutement selon chaque solution avec vos hypothèses.</p></div>' +
        '<div class="crs-cards" data-html="unit_cards"></div>' +
      '</div>' +

      '</div>' +

      '<div class="crs-foot">' +
        '<p class="crs-disclaimer">' + DISCLAIMER + '</p>' +
        '<div class="crs-foot-actions"><button type="button" class="crs-btn crs-btn--ghost" data-action="prev">Retour</button>' +
        '<button type="button" class="crs-btn crs-btn--ghost" data-action="restart">Tester un autre scénario</button></div>' +
      '</div>' +
    '</section>';

    var live = '<aside class="crs-live" aria-live="polite">' +
      '<div class="crs-live-title">Simulation en direct</div>' +
      '<div class="crs-live-item"><span>Besoin total estimé</span><strong data-out="live_need"></strong><small data-out="live_need_detail"></small></div>' +
      '<div class="crs-live-item"><span>Capacité interne estimée</span><strong data-out="live_capacity"></strong><small data-out="live_capacity_detail"></small></div>' +
      '<div class="crs-live-item crs-live-item--gap"><span>Capacité supplémentaire nécessaire</span><strong data-out="live_gap"></strong></div>' +
      '<div data-if="live_ready" class="crs-live-result"><p data-html="live_sentence"></p><div data-html="live_bar"></div></div>' +
    '</aside>';

    return '<div class="crs-shell">' + nav + '<div class="crs-body"><div class="crs-main">' + s1 + s2 + s3 + s4 + '</div>' + live + '</div></div>';
  }

  /* ================================================================
   * Validation
   * ================================================================ */
  function v1() {
    var p = C.num(S.planned_hires);
    if (!(p > 0)) return 'Indiquez le nombre de recrutements prévus';
    if (!S.turnover_included) return 'Précisez la prise en compte du turnover';
    if (S.turnover_included === 'non' && C.num(S.turnover_replacement_hires) === null) return 'Indiquez le nombre de remplacements';
    if (S.turnover_included === 'partiel' && C.num(S.additional_turnover_hires) === null) return 'Indiquez le nombre de remplacements';
    return '';
  }
  function v2() {
    var r = C.num(S.internal_recruiters);
    if (r === null || r < 0) return 'Indiquez le nombre de recruteurs';
    if (!(C.num(S.hires_per_recruiter_month) > 0)) return 'Indiquez la productivité moyenne';
    return '';
  }
  function v3() {
    var cap = C.computeCapacity(S);
    if (!cap.has_gap) return '';
    var diff = cap.capacity_gap - C.typologyTotal(C.typology(S));
    if (diff > 0) return 'Encore ' + hiresTxt(diff) + ' à répartir';
    if (diff < 0) return hiresTxt(-diff) + ' en trop';
    return '';
  }
  function reachable(n) {
    if (n <= 1) return true;
    if (v1()) return false;
    if (n === 2) return true;
    if (v2()) return false;
    if (n === 3) return true;
    return C.computeCapacity(S).has_gap ? !v3() : unitMode;
  }

  /* ================================================================
   * Rendu dynamique
   * ================================================================ */
  function setOut(key, text) { qa('[data-out="' + key + '"]').forEach(function (el) { el.textContent = text; }); }
  function setHtml(key, html) { qa('[data-html="' + key + '"]').forEach(function (el) { if (el.__html !== html) { el.innerHTML = html; el.__html = html; } }); }
  function setIf(key, on) { qa('[data-if="' + key + '"]').forEach(function (el) { el.hidden = !on; }); }

  function bar(parts, label) {
    var total = parts.reduce(function (a, p) { return a + p.value; }, 0) || 1;
    return '<div class="crs-bar" role="img" aria-label="' + esc(label) + '">' + parts.map(function (p) {
      return '<span class="crs-bar-seg crs-bar-seg--' + p.cls + '" style="width:' + (p.value / total * 100).toFixed(2) + '%"></span>';
    }).join('') + '</div>' +
    '<div class="crs-legend">' + parts.map(function (p) {
      return '<span><i class="crs-dot crs-dot--' + p.cls + '"></i>' + p.label + '</span>';
    }).join('') + '</div>';
  }

  function capacityBar(cap) {
    var covered = Math.min(cap.internal_capacity, cap.total_hiring_need);
    var parts = [{ cls: 'covered', value: covered, label: 'Couvert par l’équipe · ' + NF0.format(covered) }];
    if (cap.capacity_gap > 0) parts.push({ cls: 'gap', value: cap.capacity_gap, label: 'Reste à absorber · ' + NF0.format(cap.capacity_gap) });
    return bar(parts, 'Part couverte : ' + cap.capacity_coverage_percentage + ' %');
  }

  function fteTxt(fte) {
    return isNum(fte) ? '≈ ' + NF1.format(fte) + ' ETP' : '—';
  }

  function missing(id, label) {
    return '<button type="button" class="crs-missing" data-action="focus" data-target="crs-' + id + '">' + label + '</button>';
  }

  function row(dt, dd) { return '<div><dt>' + dt + '</dt><dd>' + dd + '</dd></div>'; }

  function card(kind, big, bigSub, rows, msg, notes) {
    return '<article class="crs-card crs-card--' + kind + '">' +
      '<div class="crs-card-tag"><span class="crs-dot crs-dot--' + kind + '"></span>' + MIX_META[kind].label + '</div>' +
      '<div class="crs-card-big">' + big + '</div><div class="crs-card-sub">' + bigSub + '</div>' +
      '<dl class="crs-dl">' + rows.join('') + '</dl>' +
      '<p class="crs-card-msg">' + msg + '</p>' +
      (notes || []).map(function (n) { return '<p class="crs-card-note">' + n + '</p>'; }).join('') +
    '</article>';
  }

  function renderCards(cap) {
    var gap = cap.capacity_gap, months = C.num(S.period_months);
    var ci = C.computeInternal(gap, S, H);
    var cr = C.computeRpo(C.typology(S), H, CFG);
    var ca = C.computeAgency(gap, H);
    var hSal = C.num(H.internal_recruiter_salary), hMul = C.num(H.employer_cost_multiplier), aSal = C.num(H.average_salary);

    var internal = card('internal',
      eur(ci.cost) || missing(hSal === null ? 'internal_recruiter_salary' : 'employer_cost_multiplier', 'Renseignez salaire et coefficient'),
      'coût employeur estimé sur ' + months + ' mois',
      [
        row('ETP supplémentaires', fteTxt(ci.additional_fte)),
        row('Salaire brut annuel', hSal === null ? '—' : eur(hSal)),
        row('Coefficient employeur', hMul === null ? '—' : NF2.format(hMul)),
        row('Coût par recrutement', eur(ci.cost_per_hire) || '—'),
        row('Durée simulée', months + ' mois')
      ],
      'Pertinent lorsque le besoin de recrutement est récurrent et durable.');

    var rpo = card('rpo', eur(cr.cost, true), 'coût total estimé',
      [
        row('Jours estimés', NF1.format(cr.days) + ' jours'),
        row('Durée équivalente', '≈ ' + NF1.format(cr.months_fulltime) + ' mois à temps plein'),
        row('TJM', eur(C.num(H.rpo_daily_rate), true)),
        row('Coût par recrutement', eur(cr.cost_per_hire, true) || '—')
      ],
      'Pertinent pour ajouter rapidement de la capacité à une équipe TA et absorber un volume temporaire de recrutements.');

    var agency = card('agency', eur(ca.cost, true) || missing('average_salary', 'Renseignez le salaire moyen'), 'coût total estimé',
      [
        row('Recrutements concernés', hiresTxt(gap)),
        row('Salaire moyen', aSal === null ? '—' : eur(aSal)),
        row('Honoraires moyens', NF1.format(C.num(H.agency_fee_percentage)) + ' %'),
        row('Coût par recrutement', eur(ca.cost_per_hire, true) || '—')
      ],
      'Particulièrement adapté à certaines recherches pénuriques, stratégiques, urgentes ou confidentielles.');

    return internal + rpo + agency;
  }

  function renderUnitCards() {
    var perYear = C.num(S.hires_per_recruiter_month) * 12 * C.num(S.recruiting_time_percentage) / 100;
    var annual = C.annualEmployerCost(H);
    var internalUnit = (annual !== null && perYear > 0) ? annual / perYear : null;
    var rate = C.num(H.rpo_daily_rate);
    var agencyUnit = C.agencyCostPerHire(H);

    return card('internal', eur(internalUnit) || missing(C.num(H.internal_recruiter_salary) === null ? 'internal_recruiter_salary' : 'employer_cost_multiplier', 'Renseignez salaire et coefficient'),
        'coût employeur par recrutement',
        [row('Productivité annuelle', NF1.format(perYear) + ' recr. / ETP'), row('Coût employeur annuel', eur(annual) || '—')],
        'Pertinent lorsque le besoin de recrutement est récurrent et durable.') +
      card('rpo', eur(C.num(H.rpo_days_standard) * rate, true), 'par recrutement standard',
        [row('Volume', eur(C.num(H.rpo_days_volume) * rate, true)), row('Standard', eur(C.num(H.rpo_days_standard) * rate, true)),
          row('Complexe', eur(C.num(H.rpo_days_complex) * rate, true)), row('TJM', eur(rate, true))],
        'Pertinent pour ajouter rapidement de la capacité à une équipe TA et absorber un volume temporaire de recrutements.') +
      card('agency', eur(agencyUnit, true) || missing('average_salary', 'Renseignez le salaire moyen'), 'par recrutement',
        [row('Salaire moyen', C.num(H.average_salary) === null ? '—' : eur(C.num(H.average_salary))), row('Honoraires moyens', NF1.format(C.num(H.agency_fee_percentage)) + ' %')],
        'Particulièrement adapté à certaines recherches pénuriques, stratégiques, urgentes ou confidentielles.');
  }

  function syncInputs() {
    qa('[data-field]').forEach(function (el) {
      if (el === doc.activeElement && el.type !== 'range') return;
      var v = scopeOf(el.getAttribute('data-scope'))[el.getAttribute('data-field')];
      var txt;
      if (el.type === 'range') txt = String(v === '' ? el.min : v);
      else { var n = C.num(v); txt = n === null ? (v === '' ? '' : String(v)) : NF2.format(n); }
      if (el.value !== txt) el.value = txt;
      if (el.type === 'range') el.style.setProperty('--p', ((C.num(el.value) - el.min) / (el.max - el.min) * 100) + '%');
    });
    qa('[data-choice]').forEach(function (el) {
      var on = String(S[el.getAttribute('data-choice')]) === el.getAttribute('data-value');
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function syncMix(gap) {
    qa('[data-mix]').forEach(function (el) {
      var k = el.getAttribute('data-mix');
      if (el.type === 'range') {
        el.max = String(gap);
        el.value = String(MIX[k]);
        el.style.setProperty('--p', (gap > 0 ? MIX[k] / gap * 100 : 0) + '%');
      } else if (el !== doc.activeElement) {
        el.value = String(MIX[k]);
      }
    });
  }

  function update() {
    var cap = C.computeCapacity(S);
    var ok1 = !v1(), ok2 = !v2(), liveReady = ok1 && ok2;
    var months = C.num(S.period_months);

    if (step === 4 && !reachable(4)) step = reachable(3) ? 3 : reachable(2) ? 2 : 1;
    if (step === 3 && !reachable(3)) step = reachable(2) ? 2 : 1;
    if (step === 2 && !reachable(2)) step = 1;

    rootEl.className = 'crs is-step-' + step;

    /* Navigation */
    qa('.crs-step').forEach(function (el) { el.hidden = Number(el.getAttribute('data-step')) !== step; });
    qa('.crs-nav-item').forEach(function (el) {
      var n = Number(el.getAttribute('data-step'));
      el.classList.toggle('is-active', n === step);
      el.classList.toggle('is-done', n < step);
      el.disabled = !reachable(n);
      if (n === step) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });

    /* Conditions */
    var typoSum = C.typologyTotal(C.typology(S));
    setIf('turnover_non', S.turnover_included === 'non');
    setIf('turnover_partiel', S.turnover_included === 'partiel');
    setIf('live_ready', liveReady);
    setIf('has_gap', cap.has_gap);
    setIf('no_gap', liveReady && !cap.has_gap);
    setIf('has_complex', C.num(S.complex_hires) > 0);
    setIf('typo_under', typoSum < cap.capacity_gap);

    /* Panneau direct */
    var needShown = C.num(S.planned_hires) > 0;
    setOut('live_need', needShown ? hiresTxt(cap.total_hiring_need) : '—');
    setOut('live_need_detail', needShown && cap.turnover_extra_hires > 0 ? NF0.format(cap.planned_hires) + ' prévus + ' + NF0.format(cap.turnover_extra_hires) + ' remplacements' : '');
    setOut('live_capacity', liveReady ? hiresTxt(cap.internal_capacity) : '—');
    setOut('live_capacity_detail', liveReady ? NF2.format(C.num(S.internal_recruiters)) + ' × ' + NF2.format(C.num(S.hires_per_recruiter_month)) + '/mois × ' + months + ' mois × ' + NF0.format(C.num(S.recruiting_time_percentage)) + ' %' : '');
    setOut('live_gap', liveReady ? hiresTxt(cap.capacity_gap) : '—');
    setOut('live_need_num', NF0.format(cap.total_hiring_need));
    setOut('live_capacity_num', NF0.format(cap.internal_capacity));
    setOut('live_gap_num', NF0.format(cap.capacity_gap));
    if (liveReady) {
      setHtml('live_sentence', cap.has_gap
        ? 'Votre équipe peut absorber environ <strong>' + cap.capacity_coverage_percentage + '&nbsp;%</strong> de votre besoin de recrutement.'
        : 'Votre capacité actuelle semble <strong>suffisante</strong> pour absorber votre plan.');
      setHtml('live_bar', capacityBar(cap));
    }

    /* Étape 2 */
    setOut('recruiting_time_percentage_txt', NF0.format(C.num(S.recruiting_time_percentage)) + ' %');

    /* Étape 3 */
    setOut('gap_txt', hiresTxt(cap.capacity_gap));
    setOut('gap_num', NF0.format(cap.capacity_gap));
    setOut('typo_sum', NF0.format(typoSum));
    var counter = rootEl.querySelector('[data-counter]');
    if (counter) {
      counter.setAttribute('data-state', typoSum === cap.capacity_gap ? 'ok' : typoSum > cap.capacity_gap ? 'over' : 'under');
      rootEl.querySelector('[data-counter-fill]').style.width = (cap.capacity_gap > 0 ? Math.min(100, typoSum / cap.capacity_gap * 100) : 0) + '%';
    }

    /* Hints & boutons */
    [v1(), v2(), v3()].forEach(function (msg, i) {
      setOut('hint' + (i + 1), msg);
      qa('[data-action="next"][data-for="' + (i + 1) + '"]').forEach(function (b) { b.disabled = !!msg; });
    });

    /* Étape 4 */
    if (step === 4) {
      if (!mixTouched || MIX.internal + MIX.rpo + MIX.agency !== cap.capacity_gap) { MIX = C.defaultAllocation(S); mixTouched = false; }

      setOut('period_txt', months + ' mois');
      setOut('coverage_txt', cap.capacity_coverage_percentage + ' %');
      setOut('planned_txt', NF0.format(cap.planned_hires));
      setOut('turnover_txt', S.turnover_included === 'oui' ? 'inclus' : NF0.format(cap.turnover_extra_hires));
      setOut('need_txt', NF0.format(cap.total_hiring_need));
      setOut('capacity_txt', NF0.format(cap.internal_capacity));
      setOut('gap_hero_txt', NF0.format(cap.capacity_gap));
      setHtml('hero_bar', capacityBar(cap));
      setOut('agency_fee_percentage_txt', NF1.format(C.num(H.agency_fee_percentage)) + ' %');

      setHtml('rpo_note', '<div class="crs-callout"><span class="crs-callout-lbl">Explications</span><p>On estime qu’un recruteur RPO a besoin de <strong>' +
        NF1.format(C.num(H.rpo_days_volume)) + ' jours</strong> par recrutement volume, <strong>' + NF1.format(C.num(H.rpo_days_standard)) + ' jours</strong> par recrutement standard et <strong>' +
        NF1.format(C.num(H.rpo_days_complex)) + ' jours</strong> par recrutement complexe, facturés au TJM de ' + eur(C.num(H.rpo_daily_rate), true) + '.</p></div>');

      if (cap.has_gap) {
        setHtml('cards', renderCards(cap));

        var alloc = C.computeAllocation(S, H, MIX, CFG);
        syncMix(cap.capacity_gap);
        setOut('mix_sum', NF0.format(MIX.internal + MIX.rpo + MIX.agency));
        C.MIX_KEYS.forEach(function (k) {
          var cost = alloc[k + '_cost'];
          setOut('mix_cost_' + k, MIX[k] === 0 ? '0 €' : (eur(cost, k !== 'internal') || 'à renseigner'));
        });
        setOut('budget_total', alloc.complete ? eur(alloc.total_allocation_cost, true) : 'Complétez vos hypothèses');
        setHtml('mix_bar', bar(C.MIX_KEYS.filter(function (k) { return MIX[k] > 0; }).map(function (k) {
          return { cls: k, value: MIX[k], label: MIX_META[k].short + ' · ' + NF0.format(MIX[k]) };
        }), 'Allocation du besoin de renfort'));
        setHtml('budget_list', C.MIX_KEYS.map(function (k) {
          var cost = alloc[k + '_cost'];
          var extra = k === 'internal' && MIX.internal > 0 && isNum(alloc.internal.additional_fte) ? ' <small>' + NF1.format(alloc.internal.additional_fte) + ' ETP</small>'
            : k === 'rpo' && MIX.rpo > 0 ? ' <small>' + NF1.format(alloc.rpo.days) + ' j</small>' : '';
          return '<li><span><i class="crs-dot crs-dot--' + k + '"></i>' + MIX_META[k].label + extra + '</span><strong>' +
            (MIX[k] === 0 ? '0 €' : (eur(cost, k !== 'internal') || '—')) + '</strong></li>';
        }).join(''));
      } else {
        setHtml('unit_cards', renderUnitCards());
      }

      var costsReady = C.annualEmployerCost(H) !== null && C.agencyCostPerHire(H) !== null;
      if (costsReady) {
        track('simulation_completed', { total_allocation_cost: C.computeAllocation(S, H, MIX, CFG).total_allocation_cost, mode: cap.has_gap ? 'gap' : 'no_gap' }, true);
        sendSnapshot();
      }
      saveHandoff();
    }

    syncInputs();
  }

  /* ================================================================
   * Remontée d'informations
   *  1. Enregistrement anonyme de chaque simulation (webhook -> Airtable).
   *  2. Passage du contexte au formulaire de contact via sessionStorage.
   * ================================================================ */
  function newSimulationId() {
    return 'sim_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function simulationData() {
    var extra = { simulation_id: simulationId, page_url: root.location.href.split('#')[0] };
    CFG.utm_keys.forEach(function (k) { extra[k] = UTM[k]; });
    return C.buildPayload(S, H, MIX, CFG, extra);
  }

  /* Résumé lisible, repris dans le message du formulaire de contact. */
  function summary() {
    var cap = C.computeCapacity(S), typo = C.typology(S);
    var txt = 'Simulation de capacité recrutement : besoin total de ' + NF0.format(cap.total_hiring_need) +
      ' recrutements sur ' + NF0.format(C.num(S.period_months)) + ' mois, capacité interne estimée à ' + NF0.format(cap.internal_capacity) +
      ' (' + cap.capacity_coverage_percentage + ' % de couverture).';
    if (cap.has_gap) {
      txt += ' Reste ' + NF0.format(cap.capacity_gap) + ' recrutements à absorber, dont ' + NF0.format(typo.complex) + ' complexes.';
      var alloc = C.computeAllocation(S, H, MIX, CFG);
      if (alloc.rpo.days > 0) txt += ' Scénario RPO simulé : ' + NF1.format(alloc.rpo.days) + ' jours.';
    }
    return txt;
  }

  /* 1. Enregistrement anonyme : aucune donnée identifiante n'est envoyée. */
  function sendSnapshot() {
    if (!CFG.snapshot_webhook_url) {
      if (root.console) console.info('[CRS] Simulation (aucun webhook configuré) :', simulationData());
      return;
    }
    try {
      root.fetch(CFG.snapshot_webhook_url, {
        method: 'POST', mode: 'no-cors', keepalive: true,
        body: new URLSearchParams(simulationData())
      });
    } catch (e) { /* l'analytics GA4 reste la source secondaire */ }
  }

  /* 2. Contexte déposé pour la page de contact (même domaine). */
  function saveHandoff() {
    try {
      root.sessionStorage.setItem(CFG.handoff.storage_key, JSON.stringify({
        saved_at: new Date().toISOString(),
        summary: summary(),
        data: simulationData()
      }));
    } catch (e) { /* stockage indisponible : le formulaire reste utilisable sans contexte */ }
  }

  /* ================================================================
   * Événements
   * ================================================================ */
  function go(n) {
    step = n;
    update();
    var top = rootEl.getBoundingClientRect().top;
    if (top < 0 || top > root.innerHeight * 0.5) rootEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var h = qa('.crs-step[data-step="' + n + '"] .crs-h2').filter(function (el) { return el.offsetParent !== null; })[0];
    if (h) h.focus({ preventScroll: true });
  }

  function onField(el, commit) {
    var scope = scopeOf(el.getAttribute('data-scope')), name = el.getAttribute('data-field');
    if (el.type === 'range') { scope[name] = Number(el.value); return update(); }
    var n = C.num(el.value);
    if (commit) {
      if (n !== null) {
        if (el.hasAttribute('data-int')) n = Math.max(0, Math.round(n));
        scope[name] = n;
      } else {
        scope[name] = el.value.trim() === '' ? '' : scope[name];
      }
      update();
    } else {
      scope[name] = n === null ? el.value : n;
      update();
    }
  }

  function bind() {
    rootEl.addEventListener('input', function (e) {
      var t = e.target;
      track('calculator_started', null, true);
      if (t.hasAttribute('data-mix')) {
        var cap = C.computeCapacity(S);
        var val = C.num(t.value);
        if (val === null && t.type !== 'range') return;
        MIX = C.rebalance(MIX, t.getAttribute('data-mix'), val, cap.capacity_gap);
        mixTouched = true;
        return update();
      }
      if (t.hasAttribute('data-field')) onField(t, false);
    });

    rootEl.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-field') && t.type !== 'range') onField(t, true);
      if (t.hasAttribute('data-mix') && t.type !== 'range') { t.value = String(MIX[t.getAttribute('data-mix')]); }
    });

    rootEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-field')) {
        onField(e.target, true);
        var next = rootEl.querySelector('.crs-step[data-step="' + step + '"] [data-action="next"]');
        if (next && !next.disabled) next.click();
      }
    });

    rootEl.addEventListener('click', function (e) {
      var t = e.target.closest('[data-choice],[data-action],[data-track]');
      if (!t || !rootEl.contains(t)) return;

      if (t.hasAttribute('data-track')) { saveHandoff(); track('meeting_cta_clicked', { complex_hires: C.num(S.complex_hires) || 0, simulation_id: simulationId }); return; }

      track('calculator_started', null, true);

      if (t.hasAttribute('data-choice')) {
        var name = t.getAttribute('data-choice'), val = t.getAttribute('data-value');
        S[name] = /^\d+$/.test(val) ? Number(val) : val;
        return update();
      }

      var a = t.getAttribute('data-action'), target = t.getAttribute('data-target');
      var cap = C.computeCapacity(S);
      switch (a) {
        case 'next':
          var from = step;
          if (from === 1 && !v1()) { track('step_1_completed', null, true); go(2); }
          else if (from === 2 && !v2()) {
            track('step_2_completed', null, true);
            if (cap.has_gap) track('capacity_gap_generated', { capacity_coverage_percentage: cap.capacity_coverage_percentage }, true);
            unitMode = false;
            go(3);
          } else if (from === 3 && !v3()) { track('step_3_completed', null, true); go(4); }
          break;
        case 'prev': go(Math.max(1, step - 1)); break;
        case 'goto': var n = Number(t.getAttribute('data-step')); if (reachable(n)) go(n); break;
        case 'inc':
        case 'dec':
          S[target] = Math.max(0, (C.num(S[target]) || 0) + (a === 'inc' ? 1 : -1));
          update();
          break;
        case 'rest':
          var restLeft = cap.capacity_gap - C.typologyTotal(C.typology(S));
          if (restLeft > 0) { S[target] = (C.num(S[target]) || 0) + restLeft; update(); }
          break;
        case 'unit': unitMode = true; go(4); break;
        case 'restart': unitMode = false; go(1); break;
        case 'focus':
          var el = doc.getElementById(target);
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
          break;
      }
    });
  }

  /* ================================================================
   * Initialisation
   * ================================================================ */
  function init() {
    var mount = doc.getElementById('crs-simulator') || doc.querySelector('[data-crs-simulator]');
    if (!mount || mount.__crs) return;
    mount.__crs = true;
    readUtm();
    try {
      simulationId = root.sessionStorage.getItem('crs_simulation_id') || '';
      if (!simulationId) { simulationId = newSimulationId(); root.sessionStorage.setItem('crs_simulation_id', simulationId); }
    } catch (e) { simulationId = newSimulationId(); }

    rootEl = doc.createElement('div');
    rootEl.className = 'crs is-step-1';
    rootEl.innerHTML = template();
    mount.appendChild(rootEl);

    bind();
    update();

    if ('IntersectionObserver' in root) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) { track('calculator_view', null, true); io.disconnect(); }
      }, { threshold: 0.25 });
      io.observe(rootEl);
    } else {
      track('calculator_view', null, true);
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
