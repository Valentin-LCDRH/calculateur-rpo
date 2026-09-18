# Simulateur de capacité recrutement — Le Club des RH

Outil gratuit publié sur le site Webflow du Club des RH (`/calculateur-rpo`). Il aide une équipe
Talent Acquisition à mesurer sa capacité de recrutement, son besoin de renfort (capacity gap) et à
répartir ce besoin entre renfort interne, RPO freelance et cabinet. Le détail complet (données
transmises, Zapier, Airtable, GA4, procédure de test) est dans `README.md` : lis-le avant d'agir.

## Architecture
- 100 % navigateur, aucun backend. Code en JavaScript sans framework ni build.
- `src/config.js` : **toutes** les hypothèses et paramètres (TJM, jours RPO, honoraires, bornes,
  liens, clés de stockage). Ne jamais dupliquer une valeur de config ailleurs.
- `src/calc.js` : calculs purs, sans DOM, exposés sur `window.CRSCalc`. Toute règle métier va ici.
- `src/app.js` : interface (4 étapes), analytics `dataLayer`, dépôt du contexte pour la page contact.
- `src/simulateur.css` : styles encapsulés sous `.crs`, classes préfixées `crs-`. Ne rien styler
  hors de ce préfixe (le CSS cohabite avec celui du site Webflow).
- `src/client-contact.js` : chargé sur `/client-contact`, relit la simulation dans `sessionStorage`
  et remplit des champs cachés + le message du formulaire `#clientContact`.
- Ordre de chargement obligatoire : `config.js`, `calc.js`, `app.js`.

## Déploiement
- Fichiers servis par jsDelivr depuis ce dépôt, **version épinglée par tag**
  (`https://cdn.jsdelivr.net/gh/Valentin-LCDRH/calculateur-rpo@vX.Y.Z/src/...`).
- Pour livrer un changement : commit sur `main`, release avec un nouveau tag, puis remplacer le tag
  dans le code personnalisé Webflow (page Calculateur RPO : head + fin de body ; page Client contact :
  fin de body). Mettre `version` à jour dans `config.js`.
- La page Webflow contient aussi un script en ligne (fin de body) qui envoie chaque simulation
  terminée vers Zapier. Ne pas le supprimer.
- Ne jamais publier le site Webflow sans l'accord de Valentin : une publication complète pousse aussi
  les autres modifications en attente.

## Tests
- `test/calc.test.html` : tests des calculs (ouvrir via un serveur local :
  `python3 -m http.server 8765` puis `http://127.0.0.1:8765/test/calc.test.html`). Ils doivent
  rester au vert ; ajouter un test pour toute règle modifiée dans `calc.js`.
- `test/contact.mock.html` : maquette du formulaire contact pour vérifier le passage de contexte.
- `index.html` : page de démo locale du simulateur.
- Scénario de référence : 108 prévus, turnover « Non » + 12, 12 mois, 3 recruteurs × 3/mois × 80 %
  → besoin 120, capacité 86, gap 34, couverture 72 %.

## Règles produit (validées avec Valentin)
- Pas de demande de coordonnées dans le simulateur : l'outil est entièrement gratuit ; la conversion
  passe par le bouton « Prendre rendez-vous » vers `/client-contact`.
- Présenter interne / RPO / cabinet comme complémentaires, jamais comme une recommandation unique.
- Capacité interne arrondie à l'entier inférieur ; le gap est en recrutements entiers.
- Pas de valeur par défaut pour le salaire du recruteur interne ni pour le coefficient employeur.
- Textes en français, ton sobre et crédible pour un Head of TA ; pas de discours commercial appuyé.
- Aucune donnée personnelle dans les envois anonymes (Zapier / Airtable) ni dans les URL.

## Contacts
Décisions produit : Valentin (Le Club des RH).
