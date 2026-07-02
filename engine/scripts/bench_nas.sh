#!/usr/bin/env bash
# ============================================================================
# Emule le NAS (RAM + cœurs plafonnes, via cgroups systemd) pour tester un
# modele Whisper LOCAL sans risquer un crash sur le vrai NAS.
#
# En pipeline SEQUENTIELLE, la transcription tourne SEULE (le chiffrement est
# deja fini) -> la RAM libre est ~= RAM totale - OS - Core. On emule ce budget.
#
# Usage :
#   scripts/bench_nas.sh [modele] [ram] [cpus] [threads] [video]
#   ex. scripts/bench_nas.sh small 6G 0-4 3
#       scripts/bench_nas.sh distil-large-v3 6G 0-4 3
#
# Limite : cgroups plafonne RAM + NB de cœurs, PAS la faiblesse par-cœur du
# Pentium 8505 -> le TEMPS mesure ici est une BORNE BASSE (le NAS sera plus lent).
# Le pic RAM et un eventuel OOM ('Killed') sont, eux, representatifs.
# ============================================================================
set -u
MODEL="${1:-small}"
RAM="${2:-6G}"          # RAM dispo pendant la transcription (sequentiel : ~6G sur 8G)
CPUS="${3:-0-4}"        # 5 cœurs (Pentium Gold 8505 = 5c/6t)
THREADS="${4:-3}"       # threads faster-whisper plafonnes (laisse du CPU au systeme)
VIDEO="${5:-tests/examples/cours-anglais.mp4}"

ENGINE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ENGINE_DIR" || exit 1

echo "== Emulation NAS : modele=$MODEL | RAM=$RAM | CPUs=$CPUS | threads=$THREADS =="
echo "   (MemorySwapMax=0 -> un depassement RAM provoque un 'Killed' comme sur le NAS)"

systemd-run --user --scope --quiet \
  -p MemoryMax="$RAM" -p MemorySwapMax=0 -p AllowedCPUs="$CPUS" \
  env WHISPER_MODEL="$MODEL" WHISPER_COMPUTE=int8 WHISPER_CPU_THREADS="$THREADS" \
      ENGINE_ASR_PROVIDER=local ENGINE_ALLOW_LOCAL_FALLBACK=true \
  /usr/bin/time -v ./.venv/bin/python -c "
import time
from app.nlp import transcribe
t0 = time.time()
r = transcribe._transcribe_local('$VIDEO')
print(f'[$MODEL] {time.time()-t0:.1f}s | langue={r[\"language\"]} | segments={len(r[\"segments\"])}')
for s in r['segments'][:2]:
    print('   ', s['start'], '-', s['end'], s['text'][:60])
" 2>&1 | grep -Ei 'Maximum resident|Elapsed|^\[|langue|Killed|Out of memory|oom' || true

echo "----"
echo "Lecture : 'Maximum resident set size' = pic RAM (ko). 'Killed'/OOM = CE MODELE"
echo "crasherait le NAS avec $RAM. Sinon, regarder le temps (x3-5 sur le vrai NAS)."
