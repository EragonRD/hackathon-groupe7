"""Chargement paresseux des modèles (singletons) — économise la RAM.

Les modèles ne sont chargés qu'au premier usage et réutilisés ensuite
(évite le rechargement à chaque requête). KeyBERT réutilise l'embedder.
"""

import threading

from . import config

_lock = threading.Lock()
_whisper = None
_llm = None
_embed = None
_nllb = None  # (tokenizer, model)


def get_whisper():
    global _whisper
    if _whisper is None:
        with _lock:
            if _whisper is None:
                from faster_whisper import WhisperModel

                _whisper = WhisperModel(
                    config.WHISPER_MODEL,
                    device="cpu",
                    compute_type=config.WHISPER_COMPUTE,
                    cpu_threads=config.WHISPER_CPU_THREADS,  # 0 = auto ; plafonner sur NAS
                )
    return _whisper


def get_llm():
    global _llm
    if _llm is None:
        with _lock:
            if _llm is None:
                from llama_cpp import Llama

                _llm = Llama(
                    model_path=config.LLM_GGUF,
                    n_ctx=config.LLM_N_CTX,
                    n_threads=config.LLM_THREADS,
                    verbose=False,
                )
    return _llm


def get_embedder():
    global _embed
    if _embed is None:
        with _lock:
            if _embed is None:
                from sentence_transformers import SentenceTransformer

                _embed = SentenceTransformer(config.EMBED_MODEL)
    return _embed


def get_nllb():
    """Modèle de traduction multilingue NLLB-200 (tokenizer, model)."""
    global _nllb
    if _nllb is None:
        with _lock:
            if _nllb is None:
                from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

                tok = AutoTokenizer.from_pretrained(config.NLLB_MODEL)
                mod = AutoModelForSeq2SeqLM.from_pretrained(config.NLLB_MODEL)
                mod.eval()
                _nllb = (tok, mod)
    return _nllb


def unload_llm() -> None:
    """Libère le LLM (llama.cpp) — utile avant de charger NLLB sur machine à RAM limitée."""
    global _llm
    import gc

    with _lock:
        _llm = None
    gc.collect()
