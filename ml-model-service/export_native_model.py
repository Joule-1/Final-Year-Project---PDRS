"""
Export the pickled diet model to XGBoost native JSON (recommended on-disk format).

Run once after changing diet_model.pkl:
  python export_native_model.py

Writes diet_model_native.json next to app.py — same predictions as the pickle, no version mismatch warnings at load time.
"""
from __future__ import annotations

import os
import warnings

import joblib
from xgboost import XGBClassifier

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PICKLE_CANDIDATES = [
    os.path.join(BASE_DIR, "diet_model.pkl"),
    os.path.join(BASE_DIR, "Older models", "diet_model_personalized.pkl"),
    os.path.join(BASE_DIR, "Older models", "diet_model_personalized _light.pkl"),
]
OUT_PATH = os.path.join(BASE_DIR, "diet_model_native.json")


def main() -> None:
    path = next((p for p in PICKLE_CANDIDATES if os.path.isfile(p)), None)
    if path is None:
        raise FileNotFoundError(f"No pickle found. Tried: {PICKLE_CANDIDATES}")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        m = joblib.load(path)

    if not hasattr(m, "get_booster"):
        raise TypeError(f"Expected XGBoost estimator with get_booster(); got {type(m)!r}")

    m.get_booster().save_model(OUT_PATH)
    # Sanity check: reload via sklearn wrapper (matches app.py)
    chk = XGBClassifier()
    chk.load_model(OUT_PATH)
    print(f"Exported {path} -> {OUT_PATH} ({os.path.getsize(OUT_PATH) // 1024} KiB)")
    print(f"Reload OK: {type(chk).__name__}, n_features_in_={getattr(chk, 'n_features_in_', 'n/a')}")


if __name__ == "__main__":
    main()
