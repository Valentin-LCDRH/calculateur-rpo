/*!
 * Simulateur de capacité recrutement — Le Club des RH
 * CONFIGURATION CENTRALE
 *
 * Toutes les hypothèses, bornes, liens et paramètres de tracking sont ici.
 * Ne dupliquez aucune de ces valeurs dans calc.js ou app.js : modifiez-les ici uniquement.
 */
(function (root) {
  'use strict';

  root.CRS_CONFIG = {
    version: '1.0.0',

    /* ---------- Hypothèses économiques (modifiables par l'utilisateur) ---------- */
    hypotheses: {
      rpo_daily_rate: 600,          // € HT / jour
      rpo_days_volume: 4,           // jours RPO / recrutement Volume
      rpo_days_standard: 6,         // jours RPO / recrutement Standard
      rpo_days_complex: 10,         // jours RPO / recrutement Complexe
      agency_fee_percentage: 20,    // % du salaire brut annuel

      // PAS de valeur par défaut : à renseigner par l'entreprise.
      average_salary: null,
      internal_recruiter_salary: null,
      employer_cost_multiplier: null
    },

    /* ---------- Valeurs initiales du parcours ---------- */
    defaults: {
      period_months: 12,
      recruiting_time_percentage: 100
    },

    /* ---------- Bornes des champs ---------- */
    bounds: {
      period_months_options: [3, 6, 12, 18, 24],
      recruiting_time_percentage: { min: 25, max: 100, step: 5 },
      agency_fee_percentage: { min: 5, max: 40, step: 1 },
      employer_cost_multiplier: { min: 1, max: 2.5 }
    },

    /* Jours ouvrés par mois : sert uniquement à traduire les jours RPO en durée équivalente. */
    working_days_per_month: 20,

    /* ---------- Exemple d'allocation (jamais présenté comme une recommandation) ---------- */
    example_allocation: {
      // Besoin durable : le renfort interne n'est proposé que s'il représente au moins X ETP.
      durable_min_fte: 0.5
    },

    /* ---------- Liens ---------- */
    links: {
      meeting_url: 'https://www.leclubdesrh.fr/client-contact',
      privacy_url: 'https://www.leclubdesrh.fr/politique-de-confidentialite',
      rpo_page_url: 'https://www.leclubdesrh.fr/services/recrutement-externalise-rpo'
    },

    /* ---------- Lead ---------- */
    lead: {
      // Sélecteur du formulaire Webflow natif (voir README). S'il est absent, un formulaire de secours est rendu.
      webflow_form_selector: '[data-crs-lead-form] form',
      // Optionnel : URL d'un « Catch Hook » Zapier. Laisser vide si Zapier écoute les soumissions Webflow.
      webhook_url: ''
    },

    /* ---------- Tracking ---------- */
    utm_keys: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'],
    utm_storage_key: 'crs_utm'
  };
})(typeof window !== 'undefined' ? window : globalThis);
