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

# Modèles HF (Whisper, MiniLM, NLLB) téléchargés au 1er appel.
# Si rate-limit de téléchargement : passer -e HF_TOKEN=hf_xxx
ENV ENGINE_OUTPUT_DIR=/engine/outputs
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
