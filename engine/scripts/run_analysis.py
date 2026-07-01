"""Pipeline complet en ligne de commande.

Lance toute l'analyse, mesure la détection contre le corrigé, évalue le
modèle en LOO-CV, et sauvegarde les artefacts dans `outputs/` :
  - metrics.json            : P/R/F1 détection + MAE/R² par modèle
  - detection_per_video.csv : P/R par vidéo
  - predictions.csv         : rétention réelle vs prédite
  - feature_importance.csv
  - model.pkl               : modèle final réentraîné sur tout

Usage :  python scripts/run_analysis.py   (depuis le dossier engine/)
"""
from __future__ import annotations
import json
import os
import sys
from pathlib import Path
import joblib
import pandas as pd

# Rend le package `app` (engine/app/) importable, comme scripts/analyze_file.py.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.data.data_loader import load_logs, load_videos, load_ground_truth, session_table  # noqa: E402
from app.data.retention import retention_target, completion_rate  # noqa: E402
from app.data.hotspots import evaluate_detection, THRESHOLD_QUANTILE  # noqa: E402
from app.data.features import build_features  # noqa: E402
from app.data.model import evaluate_models, best_model_name, fit_final, feature_importance  # noqa: E402

# Artefacts générés (engine/outputs/, ignoré par git).
OUT = Path(__file__).resolve().parent.parent / "outputs"


def main() -> None:
    OUT.mkdir(exist_ok=True)
    logs = load_logs()
    videos = load_videos()
    gt = load_ground_truth()
    sessions = session_table(logs)

    # --- détection (évaluée vs corrigé) ---
    det = evaluate_detection(logs, sessions, videos, gt)
    det["per_video"].to_csv(OUT / "detection_per_video.csv", index=False)
    print(f"[Détection] P={det['precision']:.3f}  R={det['recall']:.3f}  "
          f"F1={det['f1']:.3f}  (quantile={THRESHOLD_QUANTILE})")

    # --- prédiction ---
    y = retention_target(sessions)
    X = build_features(logs, sessions, videos).loc[y.index]
    results = evaluate_models(X, y)
    print("\n[Prédiction] (Leave-One-Out CV)")
    for name, r in results.items():
        print(f"  {name:22s} MAE={r.mae:.4f}  R2={r.r2:.3f}")

    best = best_model_name(results)
    print(f"\nModèle retenu : {best}")
    model = fit_final(X, y, best)
    joblib.dump({"model": model, "columns": list(X.columns)}, OUT / "model.pkl")

    # predictions réelles vs prédites (in-sample du modèle final, indicatif)
    pred_df = pd.DataFrame({
        "video_id": y.index,
        "retention_reelle": y.values,
        "retention_predite_loo": results[best].predictions,
        "completion_rate": completion_rate(sessions).loc[y.index].values,
    })
    pred_df.to_csv(OUT / "predictions.csv", index=False)

    imp = feature_importance(X, y)
    imp.rename("importance").to_csv(OUT / "feature_importance.csv")

    metrics = {
        "detection": {k: det[k] for k in ("precision", "recall", "f1", "tp", "fp", "fn")},
        "detection_quantile": THRESHOLD_QUANTILE,
        "prediction": {name: {"mae": r.mae, "r2": r.r2} for name, r in results.items()},
        "best_model": best,
        "features": list(X.columns),
        "n_videos": int(len(y)),
    }
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False))
    print(f"\nArtefacts écrits dans {OUT}/")


if __name__ == "__main__":
    main()
