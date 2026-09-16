/*!
 * Simulateur de capacité recrutement — Le Club des RH
 * CALCULS (fonctions pures, sans DOM). Toutes les hypothèses viennent de CRS_CONFIG.
 */
(function (root) {
  'use strict';

  var EPS = 1e-6;
  var TYPES = ['volume', 'standard', 'complex'];
  var MIX_KEYS = ['internal', 'rpo', 'agency'];

  /* Convertit une saisie (nombre, « 1,45 », « 60 000 ») en nombre, ou null si vide / invalide. */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var n = parseFloat(String(v).replace(/[\s  €%]/g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function n0(v) { var n = num(v); return n === null ? 0 : n; }
  function pos(v) { return Math.max(0, n0(v)); }

  /* ---------- §6 Besoin total ---------- */
  function computeNeed(s) {
    var planned = pos(s.planned_hires);
    var extra = 0;
    if (s.turnover_included === 'non') extra = pos(s.turnover_replacement_hires);
    else if (s.turnover_included === 'partiel') extra = pos(s.additional_turnover_hires);
    return { planned_hires: planned, turnover_extra_hires: extra, total_hiring_need: planned + extra };
  }

  /* Capacité d'un recruteur (ETP) sur la période. */
  function capacityPerFte(s) {
    return pos(s.hires_per_recruiter_month) * pos(s.period_months) * (pos(s.recruiting_time_percentage) / 100);
  }

  /* ---------- §8 à §10 Capacité, gap, couverture ---------- */
  function computeCapacity(s) {
    var need = computeNeed(s);
    var total = need.total_hiring_need;
    var raw = pos(s.internal_recruiters) * capacityPerFte(s);
    var shown = Math.floor(raw + EPS);                 // arrondi prudent à l'entier inférieur
    var gap = Math.max(0, total - shown);              // en recrutements entiers, cohérent avec l'affichage
    var coverage = 0;
    if (total > 0) {
      coverage = Math.round(Math.min(shown, total) / total * 100);
      if (gap > 0 && coverage >= 100) coverage = 99;   // ne jamais afficher 100 % s'il reste un gap
    }
    return {
      planned_hires: need.planned_hires,
      turnover_extra_hires: need.turnover_extra_hires,
      total_hiring_need: total,
      internal_capacity_raw: raw,
      internal_capacity: shown,
      capacity_gap: gap,
      capacity_coverage_percentage: coverage,
      has_gap: gap > 0
    };
  }

  /* ---------- §17 RPO ---------- */
  function rpoDays(typo, h) {
    return n0(typo.volume) * pos(h.rpo_days_volume) +
      n0(typo.standard) * pos(h.rpo_days_standard) +
      n0(typo.complex) * pos(h.rpo_days_complex);
  }
  function computeRpo(typo, h, cfg) {
    var hires = n0(typo.volume) + n0(typo.standard) + n0(typo.complex);
    var days = rpoDays(typo, h);
    var cost = days * pos(h.rpo_daily_rate);
    return {
      hires: hires,
      days: days,
      months_fulltime: days / cfg.working_days_per_month,
      cost: cost,
      cost_per_hire: hires > 0 ? cost / hires : null
    };
  }

  /* ---------- §19 Cabinet ---------- */
  function agencyCostPerHire(h) {
    var salary = num(h.average_salary), fee = num(h.agency_fee_percentage);
    if (salary === null || fee === null || salary <= 0) return null;
    return salary * fee / 100;
  }
  function computeAgency(hires, h) {
    var unit = agencyCostPerHire(h);
    return { hires: hires, cost: unit === null ? null : unit * hires, cost_per_hire: unit };
  }

  /* ---------- §20 à §22 Renfort interne ---------- */
  function annualEmployerCost(h) {
    var salary = num(h.internal_recruiter_salary), mult = num(h.employer_cost_multiplier);
    if (salary === null || mult === null || salary <= 0 || mult <= 0) return null;
    return salary * mult;
  }
  function computeInternal(hires, s, h) {
    var perFte = capacityPerFte(s);
    var fte = perFte > 0 ? hires / perFte : null;
    var annual = annualEmployerCost(h);
    var cost = (annual === null || fte === null) ? null : annual * fte * (pos(s.period_months) / 12);
    return {
      hires: hires,
      additional_fte: fte,
      annual_employer_cost: annual,
      cost: cost,
      cost_per_hire: (cost !== null && hires > 0) ? cost / hires : null
    };
  }

  /* ---------- §12 Typologie ---------- */
  function typology(s) {
    return { volume: pos(s.volume_hires), standard: pos(s.standard_hires), complex: pos(s.complex_hires) };
  }
  function typologyTotal(t) { return t.volume + t.standard + t.complex; }

  /* ---------- §26 Allocation ---------- */

  /* Ventile la typologie du gap entre les solutions.
   * Hypothèse affichée : le cabinet prend en priorité les recrutements les plus complexes ;
   * le reste est réparti entre RPO et interne au prorata de la typologie restante. */
  function splitTypology(typo, mix) {
    var rem = { volume: typo.volume, standard: typo.standard, complex: typo.complex };
    var agency = { volume: 0, standard: 0, complex: 0 };
    var left = n0(mix.agency);
    ['complex', 'standard', 'volume'].forEach(function (k) {
      var take = Math.min(left, rem[k]);
      agency[k] = take; rem[k] -= take; left -= take;
    });
    var remTotal = typologyTotal(rem);
    var share = remTotal > 0 ? Math.min(1, n0(mix.rpo) / remTotal) : 0;
    var rpo = {}, internal = {};
    TYPES.forEach(function (k) { rpo[k] = rem[k] * share; internal[k] = rem[k] - rpo[k]; });
    return { agency: agency, rpo: rpo, internal: internal };
  }

  function computeAllocation(s, h, mix, cfg) {
    var split = splitTypology(typology(s), mix);
    var internal = computeInternal(n0(mix.internal), s, h);
    var rpo = computeRpo(split.rpo, h, cfg);
    var agency = computeAgency(n0(mix.agency), h);
    var parts = [
      n0(mix.internal) > 0 ? internal.cost : 0,
      n0(mix.rpo) > 0 ? rpo.cost : 0,
      n0(mix.agency) > 0 ? agency.cost : 0
    ];
    var complete = parts.every(function (c) { return c !== null; });
    return {
      split: split,
      internal: internal,
      rpo: rpo,
      agency: agency,
      internal_cost: parts[0],
      rpo_cost: parts[1],
      agency_cost: parts[2],
      complete: complete,
      total_allocation_cost: complete ? parts[0] + parts[1] + parts[2] : null
    };
  }

  /* Modifie une part de l'allocation et compense sur les autres pour garder somme = gap. */
  var COMPENSATION = { internal: ['rpo', 'agency'], rpo: ['internal', 'agency'], agency: ['rpo', 'internal'] };
  function rebalance(mix, key, value, gap) {
    var next = { internal: n0(mix.internal), rpo: n0(mix.rpo), agency: n0(mix.agency) };
    next[key] = Math.max(0, Math.min(gap, Math.round(n0(value))));
    var diff = next.internal + next.rpo + next.agency - gap;   // > 0 : trop ; < 0 : pas assez
    COMPENSATION[key].forEach(function (k) {
      if (diff > 0) { var take = Math.min(diff, next[k]); next[k] -= take; diff -= take; }
      else if (diff < 0) { next[k] -= diff; diff = 0; }
    });
    return next;
  }

  /* ---------- §27 Exemple d'allocation à explorer ---------- */
  function exampleAllocation(s, cfg) {
    var gap = computeCapacity(s).capacity_gap;
    var mix = { internal: 0, rpo: 0, agency: 0 };
    if (gap <= 0) return mix;

    mix.agency = Math.min(gap, Math.min(pos(s.strategic_hires), pos(s.complex_hires)));
    var remaining = gap - mix.agency;
    var perFte = capacityPerFte(s);

    switch (s.future_recruitment_volume) {
      case 'durable':
        if (perFte > 0 && remaining / perFte >= cfg.example_allocation.durable_min_fte) mix.internal = remaining;
        break;
      case 'turnover':
      case 'incertain':
        // Capacité interne par ETP entiers ; le surplus en renfort flexible.
        if (perFte > 0) mix.internal = Math.min(remaining, Math.floor(Math.floor(remaining / perFte) * perFte + EPS));
        break;
      default: // 'pic' ou non renseigné : renfort temporaire
        break;
    }
    mix.rpo = remaining - mix.internal;
    return mix;
  }

  /* ---------- §29 Données transmises (Zapier) ---------- */
  function round2(v) { return (v === null || v === undefined || !isFinite(v)) ? '' : Math.round(v * 100) / 100; }

  function buildPayload(s, h, mix, cfg, extra) {
    var c = computeCapacity(s);
    var typo = typology(s);
    var rpoFull = computeRpo(typo, h, cfg);
    var internalFull = computeInternal(c.capacity_gap, s, h);
    var alloc = computeAllocation(s, h, mix, cfg);
    var p = {
      planned_hires: c.planned_hires,
      turnover_included: s.turnover_included || '',
      turnover_replacement_hires: s.turnover_included === 'non' ? pos(s.turnover_replacement_hires) : '',
      additional_turnover_hires: s.turnover_included === 'partiel' ? pos(s.additional_turnover_hires) : '',
      total_hiring_need: c.total_hiring_need,
      period_months: pos(s.period_months),
      future_recruitment_volume: s.future_recruitment_volume || '',

      internal_recruiters: pos(s.internal_recruiters),
      hires_per_recruiter_month: pos(s.hires_per_recruiter_month),
      recruiting_time_percentage: pos(s.recruiting_time_percentage),
      internal_capacity: c.internal_capacity,
      capacity_gap: c.capacity_gap,
      capacity_coverage_percentage: c.capacity_coverage_percentage,

      volume_hires: typo.volume,
      standard_hires: typo.standard,
      complex_hires: typo.complex,
      strategic_hires: pos(s.strategic_hires),

      rpo_daily_rate: pos(h.rpo_daily_rate),
      rpo_days_volume: pos(h.rpo_days_volume),
      rpo_days_standard: pos(h.rpo_days_standard),
      rpo_days_complex: pos(h.rpo_days_complex),
      rpo_days: round2(rpoFull.days),
      rpo_cost: round2(rpoFull.cost),

      average_salary: num(h.average_salary) === null ? '' : num(h.average_salary),
      agency_fee_percentage: pos(h.agency_fee_percentage),
      agency_hires: n0(mix.agency),
      agency_cost: round2(alloc.agency.cost),

      internal_recruiter_salary: num(h.internal_recruiter_salary) === null ? '' : num(h.internal_recruiter_salary),
      employer_cost_multiplier: num(h.employer_cost_multiplier) === null ? '' : num(h.employer_cost_multiplier),
      annual_employer_cost: round2(internalFull.annual_employer_cost),
      additional_fte: round2(internalFull.additional_fte),
      internal_cost_period: round2(internalFull.cost),

      internal_mix_hires: n0(mix.internal),
      rpo_mix_hires: n0(mix.rpo),
      agency_mix_hires: n0(mix.agency),
      rpo_mix_days: round2(alloc.rpo.days),
      internal_mix_cost: round2(alloc.internal_cost),
      rpo_mix_cost: round2(alloc.rpo_cost),
      agency_mix_cost: round2(alloc.agency_cost),
      total_allocation_cost: round2(alloc.total_allocation_cost),

      simulator_version: cfg.version
    };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }

  root.CRSCalc = {
    TYPES: TYPES,
    MIX_KEYS: MIX_KEYS,
    num: num,
    computeNeed: computeNeed,
    capacityPerFte: capacityPerFte,
    computeCapacity: computeCapacity,
    computeRpo: computeRpo,
    agencyCostPerHire: agencyCostPerHire,
    computeAgency: computeAgency,
    annualEmployerCost: annualEmployerCost,
    computeInternal: computeInternal,
    typology: typology,
    typologyTotal: typologyTotal,
    splitTypology: splitTypology,
    computeAllocation: computeAllocation,
    rebalance: rebalance,
    exampleAllocation: exampleAllocation,
    buildPayload: buildPayload
  };
})(typeof window !== 'undefined' ? window : globalThis);
