# LOGOFIE MARKET WATCH — pilote Aniassué

API de collecte et de validation des relevés de prix agricoles pour LOGOFIE DOUMAN.

## Périmètre de cette première version

- Réception des relevés transmis par les correspondants.
- Enregistrement initial avec le statut `pending`.
- Consultation des prix déjà validés.
- Espace d'administration protégé par une clé serveur.
- Publication uniquement après validation humaine.
- Séparation du prix producteur et du prix de vente au marché.
- Conservation de la localité, du marché, de l'unité et de la date d'observation.

Cette version constitue le socle technique. Elle ne récupère pas encore automatiquement les bulletins OCPV et n'est pas encore connectée à l'interface GitHub Pages. Ces étapes seront réalisées après configuration et test du serveur et de la base de données.

## Zone et rythme du pilote

- Aniassué en priorité.
- Correspondants : 2 à 3 personnes, identifiées par un code interne plutôt que par leur nom public.
- Relevés prévus : mardi et jeudi, samedi facultatif.
- Les prix d'Abengourou et d'Abidjan pourront servir de références distinctes, sans les présenter comme des relevés directs d'Aniassué.

## Installation

Prérequis : Node.js 20 ou supérieur et un projet Supabase.

1. Dans Supabase, ouvrir le SQL Editor et exécuter le contenu de `schema.sql`.
2. Copier `.env.example` vers `.env`.
3. Renseigner les variables :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_API_KEY` (secret long, aléatoire et conservé côté serveur uniquement)
   - `FRONTEND_ORIGIN` (origine autorisée de l'application)
4. Installer et lancer :
   ```bash
   npm install
   npm start
   ```

Ne jamais publier le fichier `.env`, la clé service-role ou la clé administrateur dans GitHub, dans l'application web ou dans un message public. La configuration des comptes et services externes doit être effectuée avec un adulte responsable.

## Routes API

- `GET /api/health` : état du service et de sa configuration.
- `POST /api/submissions` : recevoir un relevé non vérifié.
- `GET /api/prices?locality=Aniassué` : lire les prix validés.
- `GET /api/admin/submissions?status=pending` : lister les relevés en attente (administrateur).
- `POST /api/admin/submissions/:id/decision` : approuver ou refuser un relevé (administrateur).
- `POST /api/admin/finance/entries` : enregistrer une écriture de suivi financier (administrateur).
- `GET /api/admin/finance/summary` : consulter les totaux du suivi financier (administrateur).

## Espace d'administration — inscriptions et annonces

La migration `admin_market_schema.sql` crée les tables privées pour les inscriptions, les produits et les profils transporteurs.

1. Exécuter `admin_market_schema.sql` dans Supabase après `schema.sql`.
2. Les formulaires serveur disponibles sont `POST /api/registrations`, `POST /api/products` et `POST /api/transporters`.
3. L'administrateur peut consulter les demandes en attente via `GET /api/admin/market/queue`.
4. Une décision est enregistrée via `POST /api/admin/market/:resource/:id/decision`, avec `resource` égal à `registrations`, `products` ou `transporters` et `decision` égal à `approve` ou `reject`.

Ces routes sont protégées par `ADMIN_API_KEY` côté serveur. Les données personnelles ne sont pas exposées dans les réponses publiques. Cette étape prépare le backend : les formulaires actuels de GitHub Pages restent encore en mode local de démonstration et ne sont pas raccordés à ces nouvelles routes. Il faut donc déployer et tester l'API, exécuter la migration et réaliser le raccordement de l'interface avant toute utilisation réelle. Les comptes et services externes doivent être configurés avec un adulte responsable.

## LOGÔFIÉ GESTION — suivi financier préparatoire

Après avoir exécuté `schema.sql`, exécuter également `finance_schema.sql` dans le SQL Editor Supabase.

- Les types d'écritures sont vente, transport et dépense.
- Une vente ne compte dans les commissions acquises que si son statut est `confirmed`.
- Un transport ne compte dans les commissions acquises que si son statut est `completed`.
- Une dépense ne réduit le résultat estimé que si son statut est `completed`.
- Les commissions en attente sont présentées séparément.
- Le taux est saisi pour chaque écriture ; les valeurs pilotes de 2 % et 5 % restent des hypothèses à négocier, pas des tarifs automatiques.
- Le tableau de bord ne collecte ni ne transfère d'argent. Les données sont des écritures déclaratives saisies par l'administrateur.
- L'API renvoie les 5 000 écritures les plus récentes au maximum pour son résumé ; un mécanisme d'agrégation serveur sera nécessaire si le volume devient important.

Les routes financières exigent la clé administrateur dans l'en-tête `Authorization: Bearer ...`. Cette clé ne doit jamais être placée dans le navigateur ou dans GitHub.

### Exemple de relevé

```json
{
  "locality": "Aniassué",
  "market_name": "Marché d'Aniassué",
  "product": "Igname Kponan",
  "producer_price": 450,
  "market_price": 600,
  "unit": "kg",
  "quantity": 50,
  "observed_at": "2026-11-26",
  "correspondent_code": "ANI-01",
  "notes": "Prix observé auprès de plusieurs vendeurs"
}
```

## Règles de fiabilité

1. Un relevé local est une observation datée, pas un prix garanti.
2. Aucun relevé en attente ne doit apparaître dans les prix publics.
3. Toujours préciser l'unité : kg, sac, bassine, tas, etc.
4. Ne jamais convertir une unité traditionnelle en kilogrammes sans mesure fiable.
5. Conserver la distinction entre prix producteur, prix de marché et prix officiel.
6. Une photo est facultative et ne doit pas montrer de données personnelles sans consentement.
7. Les identités et numéros privés des correspondants ne sont pas publiés.

## État du projet

Socle API préparé, non encore déployé. La base Supabase, les variables serveur, le test réel des routes et le raccordement à l'application restent à effectuer.
