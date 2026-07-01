# Architecture du pipeline — Engine Pôle 3 (IA & Data)

Schéma du flux : de la vidéo au **JSON multilingue** (contrat P3-A + sous-titres).

```mermaid
flowchart TD
    classDef view fill:#1e3a8a,stroke:#1e3a8a,color:#fff;
    classDef core fill:#0f766e,stroke:#0f766e,color:#fff;
    classDef eng fill:#7c3aed,stroke:#7c3aed,color:#fff;
    classDef model fill:#b45309,stroke:#b45309,color:#fff;
    classDef out fill:#166534,stroke:#166534,color:#fff;

    U["👤 Utilisateur — View (React)"]:::view

    subgraph CORE["⚙️ Core — NestJS"]
        AUTH["🔐 Auth JWT (HS256)"]:::core
        ORCH["🔀 Orchestration<br/>relaie le token"]:::core
    end

    subgraph ENGINE["🐍 Engine — FastAPI · Python · 100% local CPU"]
        API["API REST<br/>/analyze · /jobs · /search"]:::eng
        JOB["🧵 Job asynchrone<br/>(processing → done)"]:::eng

        FF["🎵 ffmpeg<br/>extraction audio 16kHz"]:::model
        WH["📝 faster-whisper (base)<br/>transcription + segments horodatés"]:::model
        LLM["🧠 llama.cpp · Qwen2.5-1.5B<br/>résumé + chapitres"]:::model
        KW["🏷️ KeyBERT<br/>mots-clés (MMR)"]:::model
        NLLB["🌍 NLLB-200<br/>traduction fr/en/es/ar<br/>+ sous-titres horodatés"]:::model
        EMB["🔎 MiniLM<br/>embeddings (recherche)"]:::model

        JSON["📦 JSON contrat P3-A<br/>+ translations[] (sous-titres)"]:::out
    end

    U -->|"1 · login"| AUTH
    AUTH -->|"JWT court"| U
    U -->|"2 · upload vidéo + Bearer JWT"| API
    API --> ORCH
    ORCH -.->|"vérifie le token"| AUTH
    API --> JOB
    JOB --> FF --> WH
    WH --> LLM
    WH --> KW
    WH --> EMB
    WH --> NLLB
    LLM -->|"déchargé avant NLLB (RAM)"| NLLB
    LLM --> JSON
    KW --> JSON
    NLLB --> JSON
    EMB --> JSON
    JSON -->|"3 · résultat (poll /jobs)"| U
    EMB -.->|"/search"| U
```

## Légende
| Couleur | Brique |
|---|---|
| 🔵 Bleu | View (React) — interface, lecteur, sous-titres |
| 🟢 Teal | Core (NestJS) — auth + orchestration |
| 🟣 Violet | Engine (FastAPI) — API + jobs |
| 🟠 Orange | Modèles locaux (Whisper, llama.cpp, NLLB, MiniLM, KeyBERT) |
| 🟩 Vert | Sortie JSON (contrat + traductions) |

## Points clés
- **100 % local, CPU**, sans clé API payante.
- Traitement **asynchrone** (l'analyse prend du temps) : `POST /analyze` → poll `/jobs/{id}`.
- Traduction par **modèle dédié NLLB-200** (200 langues) ; le **LLM est déchargé** avant NLLB pour tenir dans la RAM.
- Sortie = **contrat P3-A** + `translations[]` (sous-titres horodatés multilingues).
