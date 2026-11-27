# Contrat HTTP - TP1

Base : `/api`. Sauf inscription et connexion, envoyer `Authorization: Bearer <token>`.

Le contrat HTTP ne dépend pas du choix de persistance : le backend fourni utilise Mongoose et MongoDB. MongoDB conserve les utilisateurs et métadonnées ; les octets des fichiers audio restent sur le disque du serveur.

| Méthode | Route | Requête | Réponse principale |
|---|---|---|---|
| GET | `/health` | - | `{ "status": "ok" }` |
| POST | `/auth/register` | `{name,email,password}` | `201 {token,user}` |
| POST | `/auth/login` | `{email,password}` | `200 {token,user}` |
| GET | `/users/me` | JWT | `200 User` |
| PUT | `/users/me` | `{name}` + JWT | `200 User` |
| PUT | `/users/me/password` | `{currentPassword,newPassword}` + JWT | `200 {message}` |
| DELETE | `/users/me` | JWT | `200 {message}` |
| GET | `/tracks?page=1&limit=5` | JWT | `Page<Track>` |
| POST | `/tracks` | multipart : `audio`, `title` | `201 Track` |
| GET | `/tracks/:id/audio` | JWT | flux audio |
| PUT | `/tracks/:id` | `{title}` + JWT | `200 Track` |
| GET | `/tracks/favorites` | JWT | `200 Track[]` |
| PUT | `/tracks/:id/favorite` | `{isFavorite}` + JWT | `200 Track` |
| DELETE | `/tracks/:id` | JWT | `204` (bonus) |

### `PUT /tracks/:id` - renommer une piste

- **Authentification** : JWT obligatoire (`Authorization: Bearer <token>`). Seul le propriétaire de la piste peut la renommer.
- **Paramètre d'URL** : `id`, l'identifiant de la piste.
- **Corps JSON** : `{ "title": "Nouveau titre" }`. Les espaces au début et à la fin sont supprimés.
- **Réponse** : `200 Track` (la piste avec son nouveau titre).
- **Erreurs** : `400` si `title` est absent ou vide, `401` si le token est absent ou invalide, `404` si la piste n'existe pas ou appartient à un autre utilisateur.

### `GET /tracks/favorites` - lister les favoris

- **Authentification** : JWT obligatoire.
- **Paramètres** : aucun (pas de pagination).
- **Réponse** : `200 Track[]`, toutes les pistes de l'utilisateur dont `isFavorite` vaut `true`, des plus récentes aux plus anciennes.
- **Erreurs** : `401` si le token est absent ou invalide.

### `PUT /tracks/:id/favorite` - ajouter ou retirer des favoris

- **Authentification** : JWT obligatoire. Seul le propriétaire de la piste peut la modifier.
- **Paramètre d'URL** : `id`, l'identifiant de la piste.
- **Corps JSON** : `{ "isFavorite": true }` pour ajouter, `{ "isFavorite": false }` pour retirer.
- **Réponse** : `200 Track` (la piste mise à jour).
- **Erreurs** : `400` si `isFavorite` n'est pas un booléen, `401` si le token est absent ou invalide, `404` si la piste n'existe pas ou appartient à un autre utilisateur.

Chaque `Track` contient maintenant le champ `isFavorite` (booléen, `false` par défaut).

`Page<Track>` contient `items`, `page`, `limit`, `total` et `pages`. Formats acceptés : MP3, WAV, OGG et M4A, 25 Mo maximum.

Erreurs courantes : `400` validation, `401` authentification, `404` ressource, `409` email déjà utilisé.
