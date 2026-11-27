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

## LOGOFIE MARKET WATCH

- Rythme pilote : mardi et jeudi, samedi facultatif.
- Réseau initial : 2 à 3 correspondants identifiés par code.
- Les relevés sont en attente jusqu'à validation humaine.
- Distinguer prix officiels, observations locales, prix déclarés par les vendeurs et estimations.
- Ne pas présenter les références régionales comme des prix mesurés directement à Aniassué.

Voir [market-watch/README.md](market-watch/README.md) pour les instructions de l'API.
