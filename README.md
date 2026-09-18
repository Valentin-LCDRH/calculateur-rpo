# Simulateur de capacité recrutement — Le Club des RH

Outil gratuit : capacité interne → capacity gap → typologie → comparaison interne / RPO / cabinet → allocation et budget.
100 % navigateur, aucun backend. URL cible : `/ressources/calculateur-rpo`.

```
src/config.js       ← TOUTES les hypothèses, bornes, liens, réglages lead/UTM (seul fichier à modifier)
src/calc.js         ← calculs purs (aucun DOM), testés
src/app.js          ← interface 4 étapes, analytics, remontée d'informations
src/client-contact.js ← à charger sur /client-contact : joint la simulation au formulaire
src/simulateur.css  ← styles encapsulés sous .crs (DA Club des RH : Encode Sans, #5E17EB, #F19A3E)
index.html          ← page de démo locale
test/calc.test.html ← 23 tests des formules · test/contact.mock.html ← test du passage de contexte
brevo-email.html    ← template de l'email transactionnel Brevo
```

Démo locale : `python3 -m http.server 8765` dans ce dossier, puis <http://127.0.0.1:8765/> et `/test/calc.test.html`.

---

## 1. Intégration Webflow

### Héberger les 4 fichiers
Webflow n'accepte pas l'upload de `.js`. Options, par ordre de préférence :
1. **Dépôt GitHub public + jsDelivr** : `https://cdn.jsdelivr.net/gh/Valentin-LCDRH/calculateur-rpo@v1.3.2/src/app.js`
   (épingler une version/tag pour maîtriser le cache ; changer de tag à chaque mise à jour).
2. Coller le contenu dans les *Custom code* de la page (vérifier la limite de caractères de votre plan Webflow).

### Page `/ressources/calculateur-rpo`
- **Title** : `Calculateur RPO : interne, RPO ou cabinet ? | Le Club des RH`
- **H1** (élément natif) : `Votre équipe peut-elle absorber votre plan de recrutement ?`
- **Intro** (paragraphe natif) : `Calculez votre capacité interne, identifiez votre besoin de renfort et simulez l'allocation de votre budget entre renfort interne, RPO freelance et cabinet de recrutement.`
- **Embed** à l'endroit du simulateur :
  ```html
  <div id="crs-simulator"></div>
  ```
- **Page settings → Inside `<head>`** :
  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Valentin-LCDRH/calculateur-rpo@v1.3.2/src/simulateur.css">
  <style>[data-crs-lead-form]{display:none}</style>
  ```
- **Page settings → Before `</body>`** (ordre obligatoire) :
  ```html
  <script src="https://cdn.jsdelivr.net/gh/Valentin-LCDRH/calculateur-rpo@v1.3.2/src/config.js"></script>
  <script src="https://cdn.jsdelivr.net/gh/Valentin-LCDRH/calculateur-rpo@v1.3.2/src/calc.js"></script>
  <script src="https://cdn.jsdelivr.net/gh/Valentin-LCDRH/calculateur-rpo@v1.3.2/src/app.js"></script>
  ```
Le simulateur hérite de la police du site. Toutes les classes sont préfixées `crs-` : aucun conflit avec les styles Webflow.

### Remontée d'informations (sans friction)
Aucune coordonnée n'est demandée dans le simulateur. Deux mécanismes :

**1. Enregistrement anonyme de chaque simulation.** À la fin de l'étape 4 (hypothèses de coût renseignées), le simulateur envoie les chiffres de la simulation — aucune donnée identifiante — à un Catch Hook Zapier qui alimente Airtable. Renseigner `snapshot_webhook_url` dans `config.js` ; vide, le simulateur se contente de l'afficher dans la console.

**2. Contexte transmis au formulaire de contact.** Au clic sur « Prendre rendez-vous », la simulation est déposée dans le `sessionStorage` (même domaine), avec un `simulation_id`. Sur `/client-contact`, `client-contact.js` la relit et :
- ajoute les chiffres en champs cachés au formulaire `#clientContact` (sans dupliquer les `utm_*` déjà gérés par le site) ;
- pré-remplit le message (`Needs`) avec un résumé modifiable : « Simulation de capacité recrutement : besoin total de 120 recrutements sur 12 mois… ».

Sur `/client-contact`, ajouter avant `</body>` :
```html
<script src="https://cdn.jsdelivr.net/gh/Valentin-LCDRH/calculateur-rpo@v1.3.2/src/config.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Valentin-LCDRH/calculateur-rpo@v1.3.2/src/client-contact.js"></script>
```
Si la personne arrive directement sur la page, ou depuis un autre navigateur, le formulaire fonctionne normalement, simplement sans contexte.

---

## 1 bis. État dans Webflow (fait)

Site **Le Club des RH** (`666c46feab6f482842f95982`).

| Élément | État |
|---|---|
| Page **Calculateur RPO** (`6aac50c868d481afa809b161`) | Créée **en brouillon**, chemin `/calculateur-rpo` |
| Contenu | Uniquement la section du simulateur (H1, intro, point de montage). Les blocs hérités du template — encart « En recherche d'un consultant freelance RH ? », témoignages, FAQ — ont été supprimés |
| SEO | Title et description renseignés |
| Code de la page | `<head>` : feuille de styles ; avant `</body>` : les 3 scripts + un script d'envoi de la simulation vers Zapier |
| Page **Client contact** (`6841574bb334785b523c3b2e`) | `client-contact.js` ajouté après le script multi-step existant |
| GTM | `GTM-KDMH79FM` déjà présent sur le site : les 8 événements arrivent dans le `dataLayer` |

Le chemin `/ressources/calculateur-rpo` n'est pas possible sans restructurer : `ressources` est une page, pas un dossier.

### Pour le web designer
Le code personnalisé ne s'exécute pas dans l'aperçu du Designer : il faut publier pour voir le simulateur.
1. Décocher « Brouillon » dans les paramètres de la page.
2. Publier **uniquement sur `le-club-des-rh-2024.webflow.io`**.
3. Tester : parcours complet, affichage mobile, puis clic sur « Prendre rendez-vous » → le message du formulaire de contact doit être pré-rempli avec le résumé de la simulation.
4. Publier sur `leclubdesrh.fr` (attention : une publication complète envoie aussi les autres modifications en attente du site).

---

## 2. Données transmises

Tous les noms correspondent au §29 du cahier des charges. Précisions de périmètre :

| Variable | Contenu |
|---|---|
| `rpo_days`, `rpo_cost` | Scénario « 100 % RPO » sur tout le gap (carte de comparaison) |
| `additional_fte`, `internal_cost_period`, `annual_employer_cost` | Scénario « 100 % renfort interne » sur tout le gap |
| `agency_hires`, `agency_cost` | Recrutements confiés au cabinet **dans l'allocation finale** |
| `internal_mix_hires`, `rpo_mix_hires`, `agency_mix_hires`, `total_allocation_cost` | Allocation finale choisie par l'utilisateur |
| `rpo_mix_days`, `internal_mix_cost`, `rpo_mix_cost`, `agency_mix_cost` | Détail de l'allocation (bonus) |
| `turnover_included` | `oui` / `non` / `partiel` |
| `future_recruitment_volume` | `durable` / `turnover` / `incertain` / `pic` |
| `recruiting_time_percentage`, `agency_fee_percentage` | En pourcentage (80 = 80 %) |
| Coûts | Nombres bruts en euros, 2 décimales max (vide si non calculable) |

---

## 3. Remontée vers Airtable et Pipedrive

### Ce qui est prêt
- **Base Airtable** « Simulateur capacité recrutement » (`appcGooK1oGE27CYQ`), table **Simulations** (`tblQjJQELUFandXjl`), 38 champs.
- **Automatisation Airtable** « Simulation reçue (webhook) » (`wflWFwFqK3XeV8kth`) : reçoit un JSON et crée la ligne, les 36 champs sont mappés. Elle est **en brouillon : à activer dans l'interface Airtable** (un agent ne peut pas la déployer).
- **Zap « Simulateur »** (Zapier, brouillon) : déclencheur *Catch Hook* sur `https://hooks.zapier.com/hooks/catch/15932003/4df2p7r/`, action *Webhooks POST* vers le webhook Airtable, type **Raw**, en-tête `Content-Type: application/json`. Plusieurs requêtes de test y sont déjà arrivées.
- **La page envoie déjà** chaque simulation terminée vers ce Catch Hook (script en pied de page).

### Ce qu'il reste (environ 3 minutes, dans l'éditeur Zapier)
L'éditeur Zapier ne se laisse pas piloter de façon fiable par un agent : le champ **Data** de l'action doit être renseigné à la main.
1. Étape 1 → onglet **Test** → **Find new records** → choisir la requête la plus récente → **Continue**.
2. Étape 2 → onglet **Configure** → champ **Data** : cliquer l'icône d'insertion de données et composer le corps JSON, par exemple
   `{"simulation_id":"<Simulation Id>","capacity_gap":"<Capacity Gap>", …}` en insérant chaque valeur depuis le sélecteur.
   Plus rapide : passer l'action sur *Airtable → Create Record* après avoir ré-autorisé la connexion Airtable pour cette base, et mapper les champs par leur nom.
3. **Test step** : Airtable doit répondre `{"success": true}`.
4. Publier le Zap, puis activer l'automatisation Airtable.

En attendant, **GA4 reçoit déjà tout** : volumes, gap, besoin total, source et campagne pour chaque simulation.

### Pipedrive
Le Zap existant `/client-contact` → Pipedrive doit recevoir les nouveaux champs cachés (ils arrivent avec la soumission du formulaire) et créer l'affaire sur le pipeline **Régie**. Note suggérée :
```
Simulateur capacité recrutement ({{simulation_id}})
Besoin total : {{total_hiring_need}} sur {{period_months}} mois
Capacité interne : {{internal_capacity}} ({{capacity_coverage_percentage}} %)
Capacity Gap : {{capacity_gap}} — dont {{complex_hires}} complexes
RPO simulé : {{rpo_days}} jours — {{rpo_cost}} € HT
Source : {{utm_source}} / {{utm_medium}} / {{utm_campaign}}
```

---

## 4. GA4 / GTM

Chaque événement est poussé dans `dataLayer` (si GTM est présent) ou envoyé via `gtag` (GA4 direct) :

| Événement | Quand |
|---|---|
| `calculator_view` | Simulateur visible à 25 % (1×) |
| `calculator_started` | Première interaction (1×) |
| `step_1_completed`, `step_2_completed`, `step_3_completed` | Passage d'étape (1× chacun) |
| `capacity_gap_generated` | Fin d'étape 2 avec gap > 0 (1×) |
| `simulation_completed` | Étape 4 avec toutes les hypothèses de coût renseignées (1×) — déclenche aussi l'enregistrement anonyme |
| `meeting_cta_clicked` | Clic « Prendre rendez-vous » |

Propriétés envoyées : `hiring_plan`, `total_hiring_need`, `capacity_gap`, `source`, `campaign` (+ `capacity_coverage_percentage`, `total_allocation_cost`, `strategic_hires` selon l'événement).

Dans GTM : un déclencheur *Custom Event* par nom (ou regex `^(calculator_|step_|capacity_gap|simulation_|email_submitted|meeting_cta)`), des variables *Data Layer* pour les propriétés, une balise *GA4 Event* avec `{{Event}}` comme nom. Déclarer les propriétés en dimensions/métriques personnalisées dans GA4. Entonnoir : view → started → simulation_completed → meeting_cta_clicked → demande de contact.

## 5. UTM
Les `utm_source/medium/campaign/content` de l'URL sont conservés en `sessionStorage` pendant la visite et transmis en champs cachés. Liens types :
- Événement : `?utm_source=event&utm_medium=email&utm_campaign=talent_acquisition_september_2026`
- LinkedIn : `?utm_source=linkedin&utm_medium=organic&utm_campaign=recruitment_capacity_calculator`

---

## 6. Règles de calcul (transparence)

- `total_hiring_need` = plan + remplacements (selon oui / non / partiellement).
- `internal_capacity` = recruteurs × recrutements/mois × mois × temps%, **arrondi à l'entier inférieur**.
- `capacity_gap` = max(0, besoin − capacité affichée) → entier, cohérent avec les chiffres affichés (120 − 86 = 34).
- Couverture arrondie à l'entier, jamais 100 % s'il reste un gap.
- RPO = Σ(recrutements × jours par typologie) × TJM. Durée équivalente = jours ÷ 20 jours ouvrés.
- Cabinet = recrutements × salaire moyen × honoraires.
- Interne : ETP = gap ÷ (productivité × période × temps%) ; coût = salaire × coefficient × ETP × période/12. Aucun coût de sortie de CDI.
- **Allocation** : la somme est toujours égale au gap (déplacer un curseur compense sur les autres). Pour chiffrer le RPO de l'allocation, le cabinet prend en priorité les recrutements les plus complexes ; le reste est réparti au prorata de la typologie (hypothèse affichée à l'écran).
- **Allocation de départ** : recrutements complexes au cabinet, le reste en RPO ; l'utilisateur la modifie librement.
- Pas de gap : message « capacité suffisante », sans CTA commercial ; option « Comparer mes coûts de recrutement » (coûts unitaires).

## 7. Trame SEO sous le calculateur (contenu natif Webflow)
H2 : Qu'est-ce qu'un RPO ? · Quand faire appel à un RPO ? · Différence entre RPO et cabinet de recrutement · RPO ou recrutement interne ? · Comment calculer la capacité d'une équipe recrutement ? · Combien coûte un RPO ? · Comment dimensionner une équipe recrutement ? · Comment répartir son budget entre recrutement interne, RPO et cabinets ?
Liens internes : `/services/recrutement-externalise-rpo`, `/client-contact`, cas clients RPO pertinents (`/cas-clients/...`).
Ajouter un balisage `FAQPage` (JSON-LD) si les H2 sont rédigés en questions/réponses.
