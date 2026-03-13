# Service de Médias - Politique de Sécurité (`media-service`)

## 0. Sommaire

- [1. Introduction](#1-introduction)
- [2. Modèle de Chiffrement E2E Signal](#2-modèle-de-chiffrement-e2e-signal)
  - [2.1 Médias de type `message`](#21-médias-de-type-message)
  - [2.2 Médias de type `avatar` et `group_icon`](#22-médias-de-type-avatar-et-group_icon)
  - [2.3 Ce que le Serveur ne Peut pas Faire](#23-ce-que-le-serveur-ne-peut-pas-faire)
- [3. Contrôle d'Accès](#3-contrôle-daccès)
  - [3.1 Authentification](#31-authentification)
  - [3.2 Autorisation par Contexte](#32-autorisation-par-contexte)
  - [3.3 Signed URLs](#33-signed-urls)
- [4. Validation des Uploads](#4-validation-des-uploads)
- [5. Quotas et Rate Limiting](#5-quotas-et-rate-limiting)
- [6. Protection des Communications](#6-protection-des-communications)
- [7. Modération](#7-modération)
- [8. Stockage Sécurisé](#8-stockage-sécurisé)
- [9. Audit et Traçabilité](#9-audit-et-traçabilité)
- [10. Protection des Données Personnelles](#10-protection-des-données-personnelles)
- [11. Sauvegarde et Récupération](#11-sauvegarde-et-récupération)
- [Annexes](#annexes)

---

## 1. Introduction

### 1.1 Objectif
Cette politique définit les mesures de sécurité du media-service de Whispr, dans le cadre d'une architecture de messagerie chiffrée de bout en bout basée sur le protocole Signal.

### 1.2 Principes Fondamentaux

- **Store-and-forward aveugle** : le serveur stocke des blobs opaques qu'il ne peut pas déchiffrer
- **Confidentialité par construction** : les clés Signal ne transitent jamais par le media-service
- **Contrôle d'accès par contexte** : politique d'accès différenciée selon le type de média (`message`, `avatar`, `group_icon`)
- **Quotas et rate limiting** : protection contre les abus sans analyse du contenu
- **Modération côté client** : modèle ML embarqué dans l'application mobile
- **Traçabilité des accès** : audit complet des opérations sur les métadonnées

---

## 2. Modèle de Chiffrement E2E Signal

### 2.1 Médias de type `message`

Les médias attachés aux messages suivent le protocole Signal de bout en bout :

```
Device A                      media-service                Device B
   |                               |                           |
   |  1. Génère clé K aléatoire    |                           |
   |  2. Chiffre fichier → blob    |                           |
   |     (AES-256-CBC + HMAC-SHA256, enveloppe Signal)         |
   |  3. POST /upload (blob) ----> |                           |
   |                          stocke blob opaque               |
   |  <-- { mediaId, url } ------> |                           |
   |                               |                           |
   |  4. Canal Signal: { mediaId, url, K } ----------------->  |
   |                               |                           |
   |                               | <-- GET /blob/:id ------- |
   |                               | -- blob opaque ---------> |
   |                               |        5. Déchiffre avec K
```

**Garanties** :
- La clé K ne transite jamais par le media-service
- Le serveur stocke un blob qu'il ne peut pas déchiffrer
- Même en cas de compromission du stockage, les médias restent illisibles sans K
- L'expiration de la signed URL révoque l'accès réseau, indépendamment du chiffrement

### 2.2 Médias de type `avatar` et `group_icon`

Ces ressources sont semi-publiques : elles n'ont pas de destinataire Signal spécifique et doivent être accessibles à des utilisateurs multiples sans échange de clés préalable.

- Chiffrés côté serveur au repos (AES-256-GCM, clé serveur stockée dans le Secret Manager)
- Exposés via URL publique permanente (`expiresAt: null`)
- Le contenu est accessible au serveur — ces fichiers peuvent potentiellement passer par une compression côté serveur si nécessaire à l'avenir

### 2.3 Ce que le Serveur ne Peut pas Faire

Du fait du chiffrement E2E sur les médias `message`, le serveur est structurellement dans l'impossibilité de :

| Opération | Possible | Raison |
|---|---|---|
| Lire le contenu d'un média `message` | ❌ | Blob chiffré Signal, clé inconnue |
| Resize / compression côté serveur | ❌ | Contenu illisible |
| Générer des previews/thumbnails | ❌ | Délégué au client |
| Scanner pour malware | ❌ | Blob opaque |
| Modération de contenu automatisée | ❌ | Délégué au modèle embarqué mobile |
| Déduplication par similarité perceptuelle | ❌ | Impossible sur blob chiffré |

---

## 3. Contrôle d'Accès

### 3.1 Authentification

- **JWT validation** : chaque requête est authentifiée via le auth-service (gRPC mTLS)
- Le JWT contient le `userId` — utilisé pour vérifier la propriété des ressources
- Blacklist des tokens révoqués gérée par le auth-service

### 3.2 Autorisation par Contexte

| Action | `message` | `avatar` | `group_icon` |
|---|---|---|---|
| Upload | Authentifié | Authentifié | Authentifié |
| Download blob | Signed URL (propriétaire ou destinataire Signal) | URL publique | URL publique |
| Delete | Propriétaire uniquement | Propriétaire uniquement | Admin groupe |
| Accès métadonnées | Propriétaire uniquement | Public | Membres groupe |

Pour les médias `message`, le contrôle d'accès est double :
1. **Côté serveur** : signed URL expirante — empêche l'accès après expiration même avec le `mediaId`
2. **Côté contenu** : chiffrement Signal — même avec l'URL, le blob est illisible sans la clé K

### 3.3 Signed URLs

- **`message`** : durée configurable (défaut : 7 jours), renouvelable si le média est encore actif
- **`avatar` / `group_icon`** : URL publique permanente, pas de signature
- Les signed URLs sont générées par le storage service (MinIO presigned URLs ou S3 presigned URLs)
- Paramètres de signature : `X-Amz-Expires`, `X-Amz-Signature`, `X-Amz-Credential`

---

## 4. Validation des Uploads

Le serveur valide ce qu'il peut voir sur le blob, sans accéder à son contenu déchiffré :

### 4.1 Vérification Structurelle

- **Magic bytes** : les premiers octets du blob sont vérifiés pour correspondre au `Content-Type` déclaré (ex: un blob déclaré `image/jpeg` doit commencer par `FF D8 FF`)
- Pour les blobs Signal (`message`), le format de l'enveloppe Signal est validé
- **Taille** : vérification que `blob_size` correspond à la taille réelle reçue
- **Limites par context** : rejet des blobs dépassant les limites définies (voir §5)

### 4.2 Validation des Métadonnées

- `context` : doit être `message`, `avatar`, ou `group_icon`
- `ownerId` : doit correspondre au `userId` du token JWT (pour `message` et `avatar`) ou à un groupe dont l'utilisateur est admin (pour `group_icon`)
- Nettoyage des noms de fichiers : sanitisation pour prévenir les path traversal

---

## 5. Quotas et Rate Limiting

### 5.1 Quotas de Stockage

| Limite | Valeur par défaut | Scope |
|---|---|---|
| Stockage total | 1 GB | Par utilisateur |
| Fichiers actifs | 1000 | Par utilisateur |
| Uploads/jour | 100 | Par utilisateur |
| Taille blob `message` | 100 MB | Par fichier |
| Taille blob `avatar` | 5 MB | Par fichier |
| Taille blob `group_icon` | 5 MB | Par fichier |

- Le quota est vérifié **avant** d'accepter le blob
- Mis à jour **après** stockage réussi
- Notifications à 80% et 95% du quota (via notification-service)

### 5.2 Rate Limiting

- **60 requêtes/minute** par utilisateur (Istio rate limiting)
- **3 uploads simultanés** par utilisateur (semaphore applicatif)
- **10 MB/s** débit upload maximum (application level)

---

## 6. Protection des Communications

### 6.1 Communications Internes (inter-services)

- **mTLS automatique** via Istio pour toutes les communications gRPC
- Identité de service via SPIFFE (rotation automatique des certificats)
- AuthorizationPolicies Istio : seul l'api-gateway peut appeler le media-service

### 6.2 Communications Externes (stockage objet)

- **TLS 1.3** obligatoire vers MinIO/S3
- Authentification via credentials IAM ou Service Account (stockés dans Secret Manager)
- Validation des certificats SSL
- Buckets privés — aucun accès public direct, uniquement via signed URLs

### 6.3 API REST

- TLS 1.3 via Istio Ingress
- Headers de sécurité via Helmet.js (`X-Content-Type-Options`, `X-Frame-Options`, etc.)
- CORS configuré de manière restrictive (origines whitlistées uniquement)
- Validation stricte des inputs via DTOs NestJS + class-validator

---

## 7. Modération

### 7.1 Architecture de Modération

La modération de contenu est effectuée **sur le device mobile**, avant chiffrement, via un modèle ML embarqué dans l'application. Ce modèle est la première et principale ligne de défense.

Le media-service **ne fait pas appel** au moderation-service pour l'analyse de contenu — il est structurellement incapable d'analyser des blobs chiffrés.

### 7.2 Mesures Côté Serveur

Sans accès au contenu, le serveur contribue à la sécurité via :

- **Quotas et rate limiting** : prévention de l'abus de stockage
- **Signalement post-factum** : les destinataires peuvent signaler un média via l'application, ce signalement est traité par le moderation-service en dehors du media-service
- **Déduplication de blobs** : un blob identique déjà signalé peut être bloqué via son hash SHA-256 (hash du blob chiffré, pas du contenu — protection limitée mais non nulle)

### 7.3 Limites Assumées

Ce modèle de modération est un choix architectural cohérent avec la confidentialité E2E. Il est identique à celui de Signal et WhatsApp. Les limites sont connues et assumées :
- Un client modifié peut contourner la modération embarquée
- La détection de contenu similaire (perceptual hashing) est impossible côté serveur

---

## 8. Stockage Sécurisé

### 8.1 Organisation des Buckets/Préfixes

```
bucket-whispr/
├── messages/
│   └── {userId}/
│       └── {mediaId}.bin      # blob Signal chiffré
├── avatars/
│   └── {userId}/
│       └── {mediaId}.webp     # image (chiffrement serveur)
├── group_icons/
│   └── {groupId}/
│       └── {mediaId}.webp     # image (chiffrement serveur)
└── thumbnails/
    └── {mediaId}.bin          # thumbnail chiffré Signal (si fourni)
```

### 8.2 Politiques de Rétention

- **`message`** : TTL configurable (défaut : 30 jours après `expires_at`)
- **`avatar` / `group_icon`** : pas d'expiration automatique, suppression sur action utilisateur
- **Logs d'accès** : 90 jours

### 8.3 Chiffrement au Repos

| Type | Chiffrement blob | Chiffrement DB | Qui peut déchiffrer |
|---|---|---|---|
| `message` | AES-256-CBC Signal (clé client) | TDE | Personne côté serveur |
| `avatar` | AES-256-GCM (clé serveur) | TDE | Le service via Secret Manager |
| `group_icon` | AES-256-GCM (clé serveur) | TDE | Le service via Secret Manager |

---

## 9. Audit et Traçabilité

- Tous les accès (upload, download, delete) loggés dans `MEDIA_ACCESS_LOGS`
- Logs structurés JSON avec `userId`, `mediaId`, `action`, `client_ip`, `timestamp`
- **Pas** de log du contenu ou des métadonnées EXIF (incluses dans les blobs chiffrés, inaccessibles)
- Rétention 90 jours
- Protection contre l'altération des logs (append-only via partitionnement PostgreSQL)

---

## 10. Protection des Données Personnelles

### 10.1 Minimisation par Construction

Le chiffrement E2E Signal impose une minimisation des données par construction :
- Les données EXIF (géolocalisation, appareil) sont incluses dans les blobs chiffrés — inaccessibles au serveur
- Le serveur ne stocke que : taille du blob, type MIME déclaré, context, owner, dates

### 10.2 Conformité RGPD

- **Droit d'accès** : liste de tous les médias et métadonnées via `GET /media/v1/my-media`
- **Droit à l'effacement** : `DELETE /media/v1/:id` + suppression physique du blob dans les 30 jours
- **Portabilité** : export des blobs et métadonnées sur demande
- **Consentement** : les politiques de rétention sont présentées lors de l'inscription

---

## 11. Sauvegarde et Récupération

### 11.1 Stratégie de Sauvegarde

- **Métadonnées PostgreSQL** : sauvegardes continues, rétention 2 ans
- **Blobs `message`** : pas de sauvegarde (conformité E2E — une sauvegarde serait de toute façon inutile sans les clés Signal)
- **Blobs `avatar` / `group_icon`** : sauvegarde quotidienne cross-region

### 11.2 Objectifs de Reprise

- **RPO** : 5 minutes (métadonnées)
- **RTO** : 10 minutes

---

## Annexes

### A. Matrice des Risques

| Risque | Probabilité | Impact | Mesure de Contrôle |
|---|---|---|---|
| Compromission du stockage objet | Faible | Faible (blobs chiffrés) | Chiffrement E2E Signal sur `message` |
| Abus de stockage / spam | Moyenne | Moyen | Quotas + rate limiting |
| Accès non autorisé aux blobs | Faible | Faible (chiffrés) | Signed URLs + auth JWT |
| Client modifié contournant la modération | Moyenne | Élevé | Signalement post-factum, rate limiting |
| Compromission clé serveur (avatar/group_icon) | Très faible | Élevé | Secret Manager + rotation |
| DDoS sur l'endpoint d'upload | Moyenne | Moyen | Rate limiting Istio + circuit breakers |

### B. Contacts d'Urgence

| Rôle | Responsabilité |
|---|---|
| Responsable Sécurité (David) | Coordination incidents sécurité |
| DevSecOps (Tudy) | Infrastructure et déploiement |
| Lead Développeur | Correctifs d'urgence |
| Chef de Projet (Agnes) | Coordination générale |

### C. Références

- [Signal Protocol — Sealed Sender & Attachments](https://signal.org/docs/)
- [OWASP Secure File Upload Guidelines](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [NIST SP 800-57 — Key Management](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
- [RGPD — Règlement Général sur la Protection des Données](https://gdpr.eu/)
- [NestJS Security Best Practices](https://docs.nestjs.com/security/authentication)
- [Istio Security Documentation](https://istio.io/latest/docs/ops/best-practices/security/)
