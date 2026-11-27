# LOGOFIE DOUMAN

Application pilote de mise en relation agricole : **« Du village à la ville, le bon marché. »**

## Application web

- Site GitHub Pages : https://ytounkara213-ui.github.io/logofie-douman/
- Dépôt : https://github.com/ytounkara213-ui/logofie-douman
- Zone pilote : Aniassué, Côte d'Ivoire.
- Comparaisons de référence : Abengourou et Abidjan.

## État fonctionnel actuel

Le site public reste un **prototype de démonstration**. Les données saisies dans les formulaires sont enregistrées localement sur l'appareil utilisé ; elles ne sont pas partagées entre utilisateurs.

- Une annonce de stock exige une photo réelle et tous les champs demandés.
- Les stocks ne sont visibles et achetables que si leur statut est explicitement `approved`.
- Les annonces de stands exigent photo, produit, description, quantité, prix, localité, nom et contact du producteur.
- Les profils transporteurs exigent les informations du véhicule, les trajets et un contact.
- Les inscriptions sont enregistrées localement en attente ; aucun message WhatsApp n'est envoyé.
- Les commandes et leur progression sont des simulations. Aucun paiement réel n'est effectué.
- Les relevés MARKET WATCH restent locaux tant que l'API n'est pas configurée et raccordée.

## Avant une mise en service réelle

1. Configurer un projet Supabase et exécuter les scripts SQL.
2. Déployer l'API du dossier `market-watch/` sur un hébergeur serveur.
3. Configurer les secrets côté hébergeur uniquement, à partir de `market-watch/.env.example`.
4. Créer un espace de stockage sécurisé pour les photos et définir les règles d'accès.
5. Raccorder les formulaires web à l'API, avec authentification et validation serveur.
6. Créer un espace d'administration protégé pour approuver ou refuser stocks, stands, transporteurs, inscriptions et relevés.
7. Tester les permissions, les quantités, les commandes et les sauvegardes avant d'ouvrir le service.

**Important :** ne jamais publier une clé Supabase service-role, une clé administrateur, un mot de passe ou un fichier `.env` dans le dépôt ou dans le navigateur. La configuration des comptes et paiements éventuels doit être accompagnée par un adulte responsable.

## LOGÔFIÉ GESTION — suivi des revenus

Un premier socle de suivi financier est ajouté dans `market-watch/` :

- Migration SQL : `market-watch/finance_schema.sql`.
- Enregistrement administrateur des ventes, transports et dépenses.
- Calcul des commissions déclaratives selon le taux saisi.
- Distinction entre commissions en attente et commissions acquises.
- Calcul d'un résultat estimatif après dépenses enregistrées.

Les taux pilotes de 2 % sur les ventes et 5 % sur les transports restent des hypothèses à discuter et à accepter par les participants. Aucun prélèvement ni paiement n'est réalisé par ce module. La base Supabase et l'API doivent être configurées et testées avant utilisation. La clé administrateur reste exclusivement côté serveur.

## LOGOFIE MARKET WATCH

- Rythme pilote : mardi et jeudi, samedi facultatif.
- Réseau initial : 2 à 3 correspondants identifiés par code.
- Les relevés sont en attente jusqu'à validation humaine.
- Distinguer prix officiels, observations locales, prix déclarés par les vendeurs et estimations.
- Ne pas présenter les références régionales comme des prix mesurés directement à Aniassué.

Voir [market-watch/README.md](market-watch/README.md) pour les instructions de l'API.


## Tableau de bord LOGÔFIÉ GESTION — démonstration

L'onglet **Gestion** présente une maquette visuelle avec des chiffres entièrement fictifs. Il ne lit aucune donnée réelle et n'est pas un espace d'administration. Les taux affichés (2 % sur les ventes et 5 % sur les transports) sont des hypothèses de travail non activées. Le tableau de bord réel devra être réservé à l'administration, alimenté par l'API sécurisée et testé avant toute utilisation. Aucun paiement n'est collecté par cette maquette.
