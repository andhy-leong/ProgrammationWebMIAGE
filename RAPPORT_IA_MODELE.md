# Rapport d'usage de l'IA — TP1

> **Modèle utilisé** : Gemini 2.5 Flash / Claude 3.5 Sonnet (assistant Antigravity IDE)  
> **Contexte** : MIAGE M1 — Programmation Web (TP1 : Architecture Authentification et Profil)  
> **Auteurs (Binôme)** : FOUILLOUD Valentin

---

## Mission 1 — Inscription, Connexion et Profil

---

### 1. Formulaires réactifs pour l’inscription et la connexion

- **Objectif** :  
  Construire les formulaires de connexion (`/login`) et d'inscription (`/register`) avec l'approche réactive d'Angular (`ReactiveFormsModule`, `FormGroup`, `FormControl`), en assurant un typage strict et une liaison propre avec le template HTML.

- **Prompt principal** :  
  > *« Fais-moi la partie formulaires réactifs pour l'inscription et la connexion. »*

- **Plan proposé par l'agent** :  
  1. Importer `ReactiveFormsModule` dans les composants standalone [`LoginPageComponent`](frontend-starter/src/app/components/login-page/login-page.ts) et [`RegisterPageComponent`](frontend-starter/src/app/components/register-page/register-page.ts).
  2. Déclarer des `FormGroup` fortement typés avec l'option `{ nonNullable: true }` sur chaque `FormControl`.
  3. Relier les contrôles dans les templates via la directive `[formGroup]="form"` et les attributs `formControlName`.
  4. Intercepter la soumission `(ngSubmit)="submit()"` en vérifiant `this.form.invalid`, et déclencher `this.form.markAllAsTouched()` pour révéler les erreurs si l'utilisateur soumet un formulaire incomplet.

- **Vérifications réalisées par le binôme** :  
  - Saisie de données dans les champs et observation de la mise à jour réactive des valeurs.
  - Vérification dans les Angular DevTools que les contrôles de formulaire changent bien d'état (`pristine` → `dirty`, `untouched` → `touched`).
  - Test de soumission à vide : la requête HTTP n'est pas envoyée tant que le formulaire est invalide.

- **Erreurs ou propositions rejetées** :  
  - Rejet de l'approche *Template-driven Forms* (`[(ngModel)]` / `FormsModule`) qui mélange la logique de validation avec le template HTML et complique les tests unitaires.

- **Fichiers effectivement modifiés** :  
  - [`frontend-starter/src/app/components/login-page/login-page.ts`](frontend-starter/src/app/components/login-page/login-page.ts)
  - [`frontend-starter/src/app/components/login-page/login-page.html`](frontend-starter/src/app/components/login-page/login-page.html)
  - [`frontend-starter/src/app/components/register-page/register-page.ts`](frontend-starter/src/app/components/register-page/register-page.ts)
  - [`frontend-starter/src/app/components/register-page/register-page.html`](frontend-starter/src/app/components/register-page/register-page.html)

- **Preuve de fonctionnement** :  
  - Formulaires fonctionnels avec extraction typée des données via `this.form.getRawValue()`. Bouton de soumission désactivé pendant le chargement (`[disabled]="loading()"`).

- **Ce que chaque membre sait maintenant expliquer sans l'agent** :  
  - Pourquoi privilégier les formulaires réactifs aux formulaires pilotés par le template (meilleure séparation des responsabilités, testabilité directe dans la classe TypeScript, contrôle synchrone du statut de validation).
  - L'utilité de `{ nonNullable: true }` pour garantir que `.value` ou `.getRawValue()` renvoie toujours des chaînes de caractères et non `null` après un `.reset()`.

---

### 2. Validations et messages d'erreur compréhensibles

- **Objectif** :  
  Mettre en place des validateurs synchrones stricts respectant les règles du backend (nom $\ge$ 2 caractères, mot de passe $\ge$ 8 caractères, format email valide) et afficher des messages d'erreur clairs, compréhensibles et contextualisés (erreurs de saisie et retours HTTP de l'API).

- **Prompt principal** :  
  > *« Fais-moi la partie validations et message d'erreur compréhensible. »*

- **Plan proposé par l'agent** :  
  1. Configurer les validateurs Angular natifs : `Validators.required`, `Validators.email`, `Validators.minLength(2)` pour le nom, `Validators.minLength(8)` pour le mot de passe.
  2. Créer une fonction de validation personnalisée (`passwordMatchValidator`) pour vérifier que le mot de passe et sa confirmation correspondent.
  3. Dans le HTML, conditionner l'affichage des erreurs avec la syntaxe de flux `@if (form.controls.field.touched && form.controls.field.hasError('...'))` pour ne pas agresser l'utilisateur avant qu'il n'ait interagi avec le champ.
  4. Créer des bannières d'alerte stylisées (`.alert-error`) pour traduire les codes HTTP retournés par le backend (`400 Bad Request`, `401 Unauthorized`, `409 Conflict`, `0 Erreur réseau`).
  5. Ajouter des retours visuels CSS (`.is-invalid`, bordure rouge) sur les champs en défaut.

- **Vérifications réalisées par le binôme** :  
  - Saisie d'un email malformé (`test@`) : le message *« Veuillez renseigner une adresse email valide »* s'affiche dès la perte de focus.
  - Saisie d'un mot de passe de moins de 8 caractères : le message *« Le mot de passe doit comporter au moins 8 caractères »* apparaît immédiatement.
  - Saisie de deux mots de passe différents lors de l'inscription : le message *« Les mots de passe ne correspondent pas »* bloque la validation.
  - Tentative d'inscription avec une adresse déjà existante (`demo@example.com`) : réception du code HTTP 409 et affichage de la bannière *« Cette adresse email est déjà utilisée par un autre compte »*.

- **Erreurs ou propositions rejetées** :  
  - Rejet d'un affichage des erreurs dès l'arrivée sur la page (`form.invalid` seul) : l'état `touched` a été rendu obligatoire pour préserver une expérience utilisateur de qualité.
  - Rejet de messages d'erreur génériques de type « Erreur » au profit de phrases explicites guidant l'utilisateur.

- **Fichiers effectivement modifiés** :  
  - [`frontend-starter/src/app/components/login-page/login-page.ts`](frontend-starter/src/app/components/login-page/login-page.ts)
  - [`frontend-starter/src/app/components/login-page/login-page.html`](frontend-starter/src/app/components/login-page/login-page.html)
  - [`frontend-starter/src/app/components/login-page/login-page.css`](frontend-starter/src/app/components/login-page/login-page.css)
  - [`frontend-starter/src/app/components/register-page/register-page.ts`](frontend-starter/src/app/components/register-page/register-page.ts)
  - [`frontend-starter/src/app/components/register-page/register-page.html`](frontend-starter/src/app/components/register-page/register-page.html)
  - [`frontend-starter/src/app/components/register-page/register-page.css`](frontend-starter/src/app/components/register-page/register-page.css)

- **Preuve de fonctionnement** :  
  - Messages d'erreur explicites sous les champs lors de saisies invalides ; coloration rouge immédiate ; messages d'erreur HTTP traduits et affichés dans les bannières d'alerte.

- **Ce que chaque membre sait maintenant expliquer sans l'agent** :  
  - La différence entre les états de validation d'Angular : `touched` (le champ a perdu le focus au moins une fois), `dirty` (la valeur a changé), `invalid` (au moins une règle échoue).
  - Comment écrire un validateur personnalisé au niveau du `FormGroup` pour comparer deux champs dépendants (`control.get('password')?.value !== control.get('confirmPassword')?.value`).

---

### 3. Appels de `/api/auth/register` et `/api/auth/login`

- **Objectif** :  
  Connecter les formulaires de l'interface utilisateur à l'API Express via [`AuthService`](frontend-starter/src/app/shared/services/auth.service.ts), en utilisant `HttpClient` dans le service et `inject()` dans les composants, conformément à `API_CONTRACT.md`.

- **Prompt principal** :  
  > *« Fais-moi cette partie - appels de `/api/auth/register` et `/api/auth/login` ; »*

- **Plan proposé par l'agent** :  
  1. Respecter la séparation des couches : ne jamais injecter `HttpClient` directement dans les composants ; toutes les requêtes HTTP doivent transiter par [`AuthService`](frontend-starter/src/app/shared/services/auth.service.ts).
  2. Implémenter les méthodes `login(email, password)` et `register(name, email, password)` renvoyant des `Observable<AuthResponse>`.
  3. Utiliser l'opérateur RxJS `tap()` pour déclencher les effets de bord (stockage de l'authentification) avant la notification au composant.
  4. Dans les composants, souscrire (`.subscribe()`) aux méthodes du service, gérer l'état de chargement (`loading.set(false)`), afficher les erreurs éventuelles ou rediriger (`router.navigateByUrl('/tracks')` ou `'/profile'`).
  5. Nettoyer les saisies avec `.trim()` sur les emails et noms pour éviter les espaces invisibles.

- **Vérifications réalisées par le binôme** :  
  - Test dans l'onglet **Network (Réseau)** des DevTools du navigateur avec le filtre **Fetch/XHR** :
    - Clic sur « Se connecter » : émission d'une requête HTTP `POST http://localhost:4200/api/auth/login`.
    - Code statut HTTP retourné : `200 OK`.
    - Corps de la réponse JSON vérifié : `{ "token": "...", "user": { "id": "...", "name": "Demo", "email": "demo@example.com" } }`.
  - Inscription d'un nouvel utilisateur : émission d'une requête `POST http://localhost:4200/api/auth/register` avec statut `201 Created`.
  - Redirection automatique vers la bibliothèque de backing tracks (`/tracks`) ou la page de profil (`/profile`).

- **Erreurs ou propositions rejetées** :  
  - Rejet de l'injection directe de `HttpClient` dans `LoginPageComponent` ou `RegisterPageComponent` (violation du principe de responsabilité unique et du sujet TP1).

- **Fichiers effectivement modifiés** :  
  - [`frontend-starter/src/app/shared/services/auth.service.ts`](frontend-starter/src/app/shared/services/auth.service.ts)
  - [`frontend-starter/src/app/components/login-page/login-page.ts`](frontend-starter/src/app/components/login-page/login-page.ts)
  - [`frontend-starter/src/app/components/register-page/register-page.ts`](frontend-starter/src/app/components/register-page/register-page.ts)

- **Preuve de fonctionnement** :  
  - Requêtes observables dans l'onglet Network (statuts 200 et 201) ; mise à jour instantanée du composant et redirection vers les routes protégées.

- **Ce que chaque membre sait maintenant expliquer sans l'agent** :  
  - Le flux complet d'une requête : Composant → `AuthService.login()` → `HttpClient.post()` → Proxy Angular (`proxy.conf.json` qui redirige vers le port 3000) → API Express (`app.post('/api/auth/login')`) → MongoDB (`User.findOne()`) → Réponse JSON.
  - Pourquoi le proxy Angular `proxy.conf.json` est nécessaire en développement pour éviter les blocages CORS.

---

### 4. Sauvegarde du JWT côté navigateur, sans jamais l’afficher dans les logs

- **Objectif** :  
  Conserver le jeton JWT côté navigateur afin de maintenir la session utilisateur active (survivre à un rafraîchissement F5 de la page), tout en respectant la consigne stricte de sécurité interdisant d'imprimer la valeur du token dans la console ou les fichiers de log.

- **Prompt principal** :  
  > *« Fais la partie - sauvegarde du JWT côté navigateur, sans jamais l’afficher dans les logs ; »*

- **Plan proposé par l'agent** :  
  1. Centraliser la clé de stockage sous une constante dédiée (`const TOKEN_STORAGE_KEY = 'gpc_token'`).
  2. Dans la méthode privée `storeAuthentication(response: AuthResponse)` de [`AuthService`](frontend-starter/src/app/shared/services/auth.service.ts) :
     - Écrire le token dans le stockage navigateur : `localStorage.setItem(TOKEN_STORAGE_KEY, response.token)`.
     - Synchroniser le signal Angular réactif : `this.token.set(response.token)`.
     - Synchroniser les données publiques de l'utilisateur : `this.currentUser.set(response.user)`.
  3. À l'initialisation du service, initialiser le signal à partir du stockage : `readonly token = signal<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY))`.
  4. Lors de la déconnexion (`logout()`), supprimer l'entrée : `localStorage.removeItem(TOKEN_STORAGE_KEY)` et remettre les signaux à `null`.
  5. Vérifier l'intégralité du code frontend pour s'assurer qu'aucun `console.log()` ou `console.debug()` n'affiche le token JWT ou le mot de passe.

- **Vérifications réalisées par le binôme** :  
  - **Vérification du stockage** : DevTools > onglet **Application** > rubrique **Storage** > **Local Storage** (`http://localhost:4200`) : la clé `gpc_token` contient bien la chaîne JWT (format `header.payload.signature`).
  - **Vérification de la sécurité des logs** : DevTools > onglet **Console** : seuls des messages discrets sans donnée sensible sont émis (`[LoginPage] Connexion réussie`, `[RegisterPage] Inscription réussie`). Aucune valeur de JWT n'apparaît.
  - **Test de persistance** : Rafraîchissement de la page (`F5`) sur la route `/tracks` : la session reste ouverte, l'utilisateur n'est pas renvoyé vers `/login`.
  - **Test de déconnexion** : Clic sur « Déconnexion » : la clé `gpc_token` disparaît immédiatement du `localStorage`, et l'accès aux routes protégées est de nouveau bloqué par le guard [`authGuard`](frontend-starter/src/app/shared/guards/auth.guard.ts).

- **Erreurs ou propositions rejetées** :  
  - Rejet de l'affichage de l'objet de réponse complet dans la console (ex: `console.log(response)`), car il contient le champ sensible `token`.
  - Rejet du stockage en simple variable mémoire JavaScript (qui réinitialiserait la session à chaque rafraîchissement d'onglet).

- **Fichiers effectivement modifiés** :  
  - [`frontend-starter/src/app/shared/services/auth.service.ts`](frontend-starter/src/app/shared/services/auth.service.ts)
  - [`frontend-starter/src/app/components/login-page/login-page.ts`](frontend-starter/src/app/components/login-page/login-page.ts)
  - [`frontend-starter/src/app/components/register-page/register-page.ts`](frontend-starter/src/app/components/register-page/register-page.ts)

- **Preuve de fonctionnement** :  
  - Token visible et persistant dans l'onglet **Application > Local Storage** ; console DevTools exempte de tout log de token.

- **Ce que chaque membre sait maintenant expliquer sans l'agent** :  
  - **Pourquoi ne jamais logger un JWT ?** : Le JWT est un jeton d'authentification au porteur (*Bearer token*). Toute personne ou script malveillant (extension de navigateur compromise, attaque XSS) accédant à la console ou aux logs peut dérober ce token et usurper l'identité de l'utilisateur sans connaître son mot de passe.
  - **Différence fondamentale entre `Signal` et `localStorage`** :
    - Le **`Signal`** est une primitive de réactivité en **mémoire vive** propre à Angular. Il notifie automatiquement les composants et déclenche le réaffichage du DOM dès que sa valeur change, mais il est volatil et disparaît au rechargement de la page.
    - Le **`localStorage`** est une API du navigateur qui écrit sur le **disque** du client. Les données y persistent même après fermeture du navigateur, mais il n'est pas réactif (Angular ne peut pas écouter nativement ses modifications).
    - **Architecture retenue** : Le `localStorage` assure la persistance inter-sessions, tandis que le `Signal` assure la réactivité intra-application.

---

### 5. Mise à jour du Signal `currentUser`

- **Objectif** :  
  Centraliser et gérer l'identité de l'utilisateur connecté de façon réactive dans toute l'application via le Signal Angular `readonly currentUser = signal<User | null>(null)`, en assurant sa mise à jour automatique lors de la connexion, de l'inscription, de la lecture du profil (`GET /api/users/me`), de la mise à jour du nom (`PUT /api/users/me`), et de la déconnexion.

- **Prompt principal** :  
  > *« J'aimerais que tu me fasses la partie - mise à jour du Signal `currentUser` ; Quand tu le fais, j'aimerais que tu remplisses et que tu le détailles dans le fichier rapport_ia_modele.md »*

- **Plan proposé par l'agent** :  
  1. Définir le signal réactif `readonly currentUser = signal<User | null>(null)` dans [`AuthService`](frontend-starter/src/app/shared/services/auth.service.ts) en tant que source unique de vérité (*Single Source of Truth*).
  2. Mettre à jour la valeur du signal avec `.set(...)` aux 5 moments clés du cycle de vie :
     - **Connexion** (`login`) : `this.currentUser.set(response.user)`.
     - **Inscription** (`register`) : `this.currentUser.set(response.user)`.
     - **Chargement du profil** (`profile()`) : `.pipe(tap((user) => this.currentUser.set(user)))`.
     - **Modification du profil** (`update(name)`) : `.pipe(tap((user) => this.currentUser.set(user)))` pour refléter immédiatement le nouveau nom renvoyé par le backend.
     - **Déconnexion** (`logout()`) : `this.currentUser.set(null)`.
  3. Mettre en place la **réhydratation au rechargement** dans [`AppComponent`](frontend-starter/src/app/components/app/app.ts) : si un token existe dans `localStorage` mais que `currentUser()` est null (suite à un rafraîchissement F5), déclencher un appel silencieux à `auth.profile()` pour restaurer le profil en mémoire.
  4. Consommer le signal dans les templates avec la syntaxe réactive moderne `@if (auth.currentUser(); as user)` dans l'en-tête de navigation ([`app.html`](frontend-starter/src/app/components/app/app.html)) et sur la page de profil ([`profile-page.html`](frontend-starter/src/app/components/profile-page/profile-page.html)).

- **Vérifications réalisées par le binôme** :  
  - **Propagation instantanée lors de la connexion** : Après saisie des identifiants et clic sur « Se connecter », la barre de navigation affiche immédiatement le prénom et nom (`👤 Demo`) sans aucun rechargement de page.
  - **Propagation instantanée lors de la modification du nom** : Sur `/profile`, modification du nom en « Valentin F. » et clic sur « Enregistrer » : le nom est mis à jour en temps réel à la fois dans le badge du profil ET dans la barre de navigation en haut de l'écran, démontrant la puissance de la réactivité synchrone du signal.
  - **Pérennité au rafraîchissement (F5)** : Rafraîchissement de la page : le constructeur de [`AppComponent`](frontend-starter/src/app/components/app/app.ts) réhydrate `currentUser`, l'interface conserve le nom sans repasser par un état déconnecté.
  - **Nettoyage lors de la déconnexion** : Clic sur « Déconnexion » : `currentUser` repasse immédiatement à `null`, le header masque le nom et affiche à nouveau les liens de connexion/inscription.

- **Erreurs ou propositions rejetées** :  
  - Rejet de l'ancien modèle RxJS `BehaviorSubject` avec pipe `async` (`currentUser$ | async`) : les Signals natifs d'Angular offrent une granularité plus fine (*fine-grained reactivity*), ne nécessitent pas de désouscription manuelle pour éviter les fuites de mémoire, et allègent grandement la syntaxe des templates.
  - Rejet de la duplication d'état : aucun composant ne stocke une copie locale de l'objet utilisateur, ils lisent tous directement le signal exposé par [`AuthService`](frontend-starter/src/app/shared/services/auth.service.ts).

- **Fichiers effectivement modifiés** :  
  - [`frontend-starter/src/app/shared/services/auth.service.ts`](frontend-starter/src/app/shared/services/auth.service.ts)
  - [`frontend-starter/src/app/components/app/app.ts`](frontend-starter/src/app/components/app/app.ts)
  - [`frontend-starter/src/app/components/app/app.html`](frontend-starter/src/app/components/app/app.html)
  - [`frontend-starter/src/app/components/app/app.css`](frontend-starter/src/app/components/app/app.css)
  - [`frontend-starter/src/app/components/profile-page/profile-page.ts`](frontend-starter/src/app/components/profile-page/profile-page.ts)
  - [`frontend-starter/src/app/components/profile-page/profile-page.html`](frontend-starter/src/app/components/profile-page/profile-page.html)

- **Preuve de fonctionnement** :  
  - Nom affiché en direct dans la barre de navigation (`👤 Nom`) dès la connexion.
  - Synchronisation bidirectionnelle immédiate entre la page profil et l'en-tête lors d'une mise à jour du nom.
  - Disparition instantanée de toutes les informations utilisateur lors d'un clic sur « Déconnexion ».

- **Ce que chaque membre sait maintenant expliquer sans l'agent** :  
  - **Qu'est-ce qu'un Signal Angular ?** : Une boîte enveloppant une valeur qui notifie automatiquement le moteur de rendu d'Angular dès que sa valeur change via `.set()` ou `.update()`, déclenchant un réaffichage chirurgical du DOM sans réévaluer l'ensemble de l'arbre des composants.
  - **Rôle du service comme Source Unique de Vérité (*Single Source of Truth*)** : Un service injecté à la racine (`providedIn: 'root'`) est un singleton. En y plaçant le Signal `currentUser`, tous les composants de l'application partagent le même état d'authentification en temps réel.

