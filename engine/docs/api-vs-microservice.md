# API ou microservice ? (clarification — soutenance)

**Réponse : les deux, à deux niveaux.** L'**API** est l'*interface* ; le **microservice** est l'*architecture*. L'Engine est un **microservice qui expose une API REST**.

| | API | Microservice |
|---|---|---|
| Nature | contrat d'interaction (endpoints, schémas) | service autonome déployable seul |
| C'est… | *comment on parle* au service | *le service lui-même* |
| Ici | `/analyze`, `/jobs`, `/search` (FastAPI) | tout le dossier `engine/` |

## L'Engine coche les critères du microservice
| Critère | État |
|---|---|
| Responsabilité unique (bounded context) | ✅ vidéo → JSON IA uniquement |
| Déployable indépendamment | ✅ process Python/venv propre (Dockerisable) |
| Communication réseau | ✅ HTTP REST |
| Données/modèles propres | ✅ pas de DB partagée avec le Core |
| Couplage faible | ✅ appelé par le Core via HTTP + JWT |

Dans l'archi globale **View / Core / Engine** = **architecture microservices** (3 services indépendants).

## Limites honnêtes (production-grade)
- Jobs **en mémoire** (éphémères) → idéal : file de tâches (Celery/RabbitMQ) + persistance (Redis/DB).
- Async via **threads**, pas un broker de messages.
- Manque : **Dockerfile**, readiness/liveness probes, observabilité (logs/metrics/traces).

## Verdict
> Un **microservice IA** (bounded context « traitement vidéo ») qui **expose une API REST** consommée par le Core. Pour le présenter : « ce n'est pas qu'une API, c'est un service autonome de l'architecture microservices ».
