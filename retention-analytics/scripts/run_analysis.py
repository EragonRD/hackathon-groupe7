"""Pipeline complet en ligne de commande.

Lance toute l'analyse, mesure la détection contre le corrigé, évalue le
modèle en LOO-CV, et sauvegarde les artefacts dans `outputs/` :
  - metrics.json            : P/R/F1 détection + MAE/R² par modèle
  - detection_per_video.csv : P/R par vidéo
  - predictions.csv         : rétention réelle vs prédite
  - feature_importance.csv
  - model.pkl               : modèle final réentraîné sur tout

Usage :  python -m scripts.run_analysis   (depuis la racine du repo)
"""
from __future__ import annotations
import json
from pathlib import Path
import joblib
import pandas as pd

from src.data_loader import load_logs, load_videos, load_ground_truth, session_table
from src.retention import retention_target, completion_rate
from src.hotspots import evaluate_detection, THRESHOLD_QUANTILE
from src.features import build_features
from src.model import evaluate_models, best_model_name, fit_final, feature_importance

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
