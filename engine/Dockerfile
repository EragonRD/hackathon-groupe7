# Engine — Pôle 3 (microservice IA). Image CPU, 100% local.
FROM python:3.10-slim

# ffmpeg = prérequis (extraction audio)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /engine

# Dépendances : torch CPU-only d'abord (évite ~2,5 Go CUDA), puis le reste
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt \
       --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu

COPY app/ app/
COPY models/ models/

# LLM (Qwen2.5-1.5B Q4_K_M, ~1 Go) : models/ est gitignoré, donc le COPY ci-dessus
# n'apporte le GGUF que si le poste de build l'a déjà. On le télécharge sinon, au
# BUILD, pour que l'image soit autosuffisante (sans lui, l'analyse échoue à l'étape
# résumé/chapitres). Les autres modèles (Whisper/MiniLM/NLLB) se téléchargent au 1er
# appel. Si rate-limit HuggingFace : passer -e HF_TOKEN=hf_xxx.
RUN python -c "import os; from huggingface_hub import hf_hub_download; \
p='models/qwen2.5-1.5b-instruct-q4_k_m.gguf'; \
os.path.exists(p) or hf_hub_download('Qwen/Qwen2.5-1.5B-Instruct-GGUF','qwen2.5-1.5b-instruct-q4_k_m.gguf', local_dir='models')"

ENV ENGINE_OUTPUT_DIR=/engine/outputs
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
