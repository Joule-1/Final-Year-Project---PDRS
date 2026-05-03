# ml-model-service/app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
import joblib
import os
import re
import gc
import time
import warnings

from xgboost import XGBClassifier

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Prefer native JSON (stable across XGBoost versions); pickle is fallback only.
NATIVE_MODEL_CANDIDATES = [
    os.path.join(BASE_DIR, "diet_model_native.json"),
    os.path.join(BASE_DIR, "diet_model.json"),
]
PICKLE_MODEL_CANDIDATES = [
    os.path.join(BASE_DIR, "diet_model.pkl"),
    os.path.join(BASE_DIR, "Older models", "diet_model_personalized.pkl"),
    os.path.join(BASE_DIR, "Older models", "diet_model_personalized _light.pkl"),
]


def load_classifier():
    for path in NATIVE_MODEL_CANDIDATES:
        if os.path.isfile(path):
            clf = XGBClassifier()
            clf.load_model(path)
            print(f"[INIT] Loaded native XGBoost model ({os.path.basename(path)})")
            return clf
    pickle_path = next((p for p in PICKLE_MODEL_CANDIDATES if os.path.isfile(p)), None)
    if pickle_path is None:
        raise FileNotFoundError(
            "No model found. Add diet_model_native.json or run export_native_model.py; "
            f"otherwise provide one of: {PICKLE_MODEL_CANDIDATES}"
        )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        clf = joblib.load(pickle_path)
    print(f"[INIT] Loaded pickled model ({os.path.basename(pickle_path)}) — consider export_native_model.py")
    return clf


DATA_PATH = os.path.join(BASE_DIR, "raw_data", "final_df_cleaned.csv")
if not os.path.isfile(DATA_PATH):
    raise FileNotFoundError(f"Food data CSV not found: {DATA_PATH}")

app = FastAPI(title="DietRecommendationEngine-Pro")

@app.get("/")
def health():
    return {"status": "ok"}

print("[INIT] Loading model...")
model = load_classifier()
print("[INIT] Loading CSV...")
_raw = pd.read_csv(DATA_PATH)

NUTRIENT_COLS = [
    "Calories (kcal)", "Carbohydrates (g)", "Protein (g)", "Fats (g)",
    "Free Sugar (g)", "Fibre (g)", "Sodium (mg)", "Calcium (mg)",
    "Iron (mg)", "Vitamin C (mg)", "Folate (µg)",
]

# Unique food table
_food_cols = ["Dish Name"] + NUTRIENT_COLS + ["meal_type", "food_group", "diet_preference"]
FOODS = _raw[_food_cols].drop_duplicates(subset=["Dish Name"]).reset_index(drop=True).copy()
N_FOODS = len(FOODS)
print(f"[INIT] {N_FOODS} unique dishes")

# Label encoder maps (sorted = sklearn LabelEncoder default)
COND_CLASSES = sorted(_raw["condition"].unique())
MT_CLASSES = sorted(_raw["meal_type"].unique())
FG_CLASSES = sorted(_raw["food_group"].unique())
DP_CLASSES = sorted(_raw["diet_preference"].unique())

COND_MAP = {v: i for i, v in enumerate(COND_CLASSES)}
MT_MAP = {v: i for i, v in enumerate(MT_CLASSES)}
FG_MAP = {v: i for i, v in enumerate(FG_CLASSES)}
DP_MAP = {v: i for i, v in enumerate(DP_CLASSES)}

# Pre-encode once (immutable arrays)
NUTR_MAT = FOODS[NUTRIENT_COLS].fillna(0).to_numpy(dtype=np.float32).copy()
MT_ENC = FOODS["meal_type"].map(MT_MAP).fillna(0).to_numpy(dtype=np.float32).copy()
FG_ENC = FOODS["food_group"].map(FG_MAP).fillna(0).to_numpy(dtype=np.float32).copy()
DP_ENC = FOODS["diet_preference"].map(DP_MAP).fillna(0).to_numpy(dtype=np.float32).copy()
DISH_NAMES = FOODS["Dish Name"].to_numpy().copy()
CALORIES = FOODS["Calories (kcal)"].fillna(0).to_numpy(dtype=np.float32).copy()
PROTEIN = FOODS["Protein (g)"].fillna(0).to_numpy(dtype=np.float32).copy()
MEAL_TYPES = FOODS["meal_type"].fillna("").to_numpy().copy()
FOOD_GROUPS = FOODS["food_group"].fillna("").to_numpy().copy()
DIET_PREFS = FOODS["diet_preference"].fillna("").to_numpy().copy()

del _raw
gc.collect()
print("[INIT] Ready")


# ---- Request models ----
class UserPreferences(BaseModel):
    conditions: List[str]
    dietPreference: Optional[str] = None
    activityLevel: Optional[str] = None
    age: Optional[float] = None
    gender: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    bodyFatPercentage: Optional[float] = None
    calorieTarget: Optional[float] = None
    proteinTarget: Optional[float] = None
    bmi: Optional[float] = None
    bmr: Optional[float] = None
    tdee: Optional[float] = None

class PredictRequest(BaseModel):
    userPreferences: UserPreferences
    top_k: int = 50


# ---- Helpers ----
DIET_HIERARCHY = {"veg": {"veg"}, "egg": {"veg", "egg"}, "non_veg": {"veg", "egg", "non_veg"}}
COND_NAME_MAP = {c.lower(): c for c in COND_CLASSES}
COND_NAME_MAP.update({c.lower().replace("_", ""): c for c in COND_CLASSES})

PRIORITY_KW = [
    "sandwich", "omelette", "omlet", "paratha", "parantha",
    "dosa", "idli", "cake", "pulao", "soup", "salad", "roti", "curry", "dal",
    "rice", "bhaji", "sabzi", "halwa", "kheer", "chutney", "raita",
]

def auto_category(name: str) -> str:
    s = str(name).lower()
    for k in PRIORITY_KW:
        if k in s:
            return k
    tokens = re.findall(r"\b[a-z]{3,}\b", s)
    return tokens[0] if tokens else s

def normalize_condition(cond: str) -> Optional[str]:
    c = cond.strip()
    if c in COND_CLASSES:
        return c
    return COND_NAME_MAP.get(c.lower()) or COND_NAME_MAP.get(c.lower().replace(" ", "_"))

def get_candidate_mask(diet_pref: str, conditions_raw: List[str]) -> np.ndarray:
    allowed_diets = DIET_HIERARCHY.get(diet_pref, {"veg", "egg", "non_veg"})
    mask = np.array([d in allowed_diets for d in DIET_PREFS])

    conds = {c.lower() for c in conditions_raw}
    names_lower = np.char.lower(DISH_NAMES.astype(str))
    blacklist_pat = re.compile(r"masala|powder|blend|pickle")
    mask &= np.array([not blacklist_pat.search(n) for n in names_lower])

    if "hypertension" in conds:
        mask &= FOODS["Sodium (mg)"].fillna(0).to_numpy() <= 500
    if "diabetes" in conds:
        mask &= FOODS["Free Sugar (g)"].fillna(0).to_numpy() <= 10
    if "pcos" in conds:
        mask &= FOODS["Free Sugar (g)"].fillna(0).to_numpy() <= 12
    if "obesity" in conds:
        mask &= CALORIES <= 450
    if "hyperlipidemia" in conds:
        mask &= FOODS["Fats (g)"].fillna(0).to_numpy() <= 15
    if "gout" in conds:
        mask &= PROTEIN <= 25
    if "ckd_early" in conds:
        mask &= FOODS["Sodium (mg)"].fillna(0).to_numpy() <= 400
        mask &= PROTEIN <= 20

    return mask

def build_X(mask: np.ndarray, cond_code: float) -> np.ndarray:
    n = mask.sum()
    return np.column_stack([
        NUTR_MAT[mask],
        np.full(n, cond_code, dtype=np.float32),
        MT_ENC[mask],
        FG_ENC[mask],
        DP_ENC[mask],
    ])


@app.post("/predict/foods")
def predict_foods(req: PredictRequest):
    t0 = time.time()
    try:
        prefs = req.userPreferences
        age = float(prefs.age or 30)
        height = float(prefs.height or 170)
        weight = float(prefs.weight or 70)
        bmi = float(prefs.bmi) if prefs.bmi else round(weight / ((height / 100) ** 2), 2)
        tdee = float(prefs.tdee) if prefs.tdee else round(
            (10 * weight + 6.25 * height - 5 * age + (5 if prefs.gender == "male" else -161)) * 1.2
        )
        cal_target = float(prefs.calorieTarget) if prefs.calorieTarget else float(tdee)
        prot_target = float(prefs.proteinTarget) if prefs.proteinTarget else float(max(50.0, round(weight * 1.4)))

        diet_pref = (prefs.dietPreference or "non_veg").lower()
        user_conds_raw = prefs.conditions or []
        mask = get_candidate_mask(diet_pref, user_conds_raw)

        if mask.sum() == 0:
            return _empty_response(bmi, tdee, cal_target, prot_target)

        valid_conds = [c for c in (normalize_condition(x) for x in user_conds_raw) if c]
        if not valid_conds:
            valid_conds = ["Obesity"]

        # Score per condition (fully vectorized)
        n_cand = mask.sum()
        total_probs = np.zeros(n_cand, dtype=np.float64)
        min_probs = np.ones(n_cand, dtype=np.float64)

        for cond in valid_conds:
            X = build_X(mask, float(COND_MAP.get(cond, 0)))
            p = model.predict_proba(X)[:, 1].astype(np.float64)
            total_probs += p
            min_probs = np.minimum(min_probs, p)

        scores = 0.6 * (total_probs / len(valid_conds)) + 0.4 * min_probs

        # Add controlled randomness for variety across requests
        rng = np.random.default_rng()
        noise = rng.uniform(-0.03, 0.03, size=n_cand)
        scores = np.clip(scores + noise, 0.0, 1.0)

        # Extract arrays for candidates only
        c_names = DISH_NAMES[mask]
        c_cal = CALORIES[mask]
        c_prot = PROTEIN[mask]
        c_mt = MEAL_TYPES[mask]

        # Sort by score descending
        order = np.argsort(-scores)
        scores = scores[order]
        c_names = c_names[order]
        c_cal = c_cal[order]
        c_prot = c_prot[order]
        c_mt = c_mt[order]

        # Build recommendations with diversity
        recs = _diverse_recommendations(c_names, scores, c_cal, c_prot, c_mt)

        # Meal plan
        meal_plan, meal_totals = _build_meal_plan(
            c_names, scores, c_cal, c_prot, c_mt, cal_target, prot_target
        )
        plan_cal = sum(m["calories"] for m in meal_totals.values())
        plan_prot = sum(m["protein"] for m in meal_totals.values())

        elapsed = round(time.time() - t0, 3)
        print(f"[PREDICT] {len(recs)} recs, {len(valid_conds)} conds, {n_cand} candidates, {elapsed}s")

        return {
            "success": True,
            "healthProfile": {"bmi": bmi, "tdee": tdee, "calorieTarget": cal_target, "proteinTarget": prot_target},
            "recommendations": recs,
            "rawRecommendations": recs[:50],
            "mealPlan": meal_plan,
            "mealTotals": meal_totals,
            "totals": {"plannedCalories": plan_cal, "plannedProtein": plan_prot},
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback, sys
        traceback.print_exc(file=sys.stdout)
        raise HTTPException(status_code=500, detail=str(e))


def _empty_response(bmi, tdee, cal, prot):
    return {
        "success": True,
        "healthProfile": {"bmi": bmi, "tdee": tdee, "calorieTarget": cal, "proteinTarget": prot},
        "recommendations": [], "rawRecommendations": [],
        "mealPlan": {}, "mealTotals": {}, "totals": {},
    }


def _diverse_recommendations(names, scores, cals, prots, meal_types, max_total=24, max_per_cat=2, max_per_meal=6):
    cat_counts = {}
    meal_counts = {}
    recs = []
    for i in range(len(names)):
        if len(recs) >= max_total:
            break
        if cals[i] < 40 or scores[i] < 0.35:
            continue
        cat = auto_category(str(names[i]))
        mt = str(meal_types[i]).lower()
        if cat_counts.get(cat, 0) >= max_per_cat:
            continue
        if meal_counts.get(mt, 0) >= max_per_meal:
            continue
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        meal_counts[mt] = meal_counts.get(mt, 0) + 1
        recs.append({
            "Dish Name": str(names[i]),
            "score": round(float(scores[i]), 4),
            "Calories (kcal)": round(float(cals[i]), 1),
            "Protein (g)": round(float(prots[i]), 1),
            "meal_type": mt,
        })
    return recs


def _build_meal_plan(names, scores, cals, prots, meal_types, cal_target, prot_target):
    splits = {"breakfast": 0.25, "snack": 0.10, "beverage": 0.05, "lunch": 0.30, "dinner": 0.30}
    plan = {}
    totals = {}
    used = set()

    for meal, ratio in splits.items():
        budget = cal_target * ratio
        items = []
        cal_sum = 0.0
        prot_sum = 0.0
        for i in range(len(names)):
            if len(items) >= 3:
                break
            if str(names[i]) in used:
                continue
            mt = str(meal_types[i]).lower()
            if meal not in mt and items:
                continue
            c = float(cals[i])
            if c < 20:
                continue
            if cal_sum + c <= budget * 1.1 or not items:
                items.append({
                    "Dish Name": str(names[i]),
                    "score": round(float(scores[i]), 4),
                    "Calories (kcal)": round(c, 1),
                    "Protein (g)": round(float(prots[i]), 1),
                    "meal_type": mt,
                })
                used.add(str(names[i]))
                cal_sum += c
                prot_sum += float(prots[i])

        plan[meal] = items
        totals[meal] = {"calories": round(cal_sum, 1), "protein": round(prot_sum, 1)}

    return plan, totals


if __name__ == "__main__":
    import uvicorn

    _port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=_port)
