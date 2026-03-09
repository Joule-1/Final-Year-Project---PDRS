# ml-model-service/app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
import joblib
import os
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Try multiple model paths (pkl was trained with xgboost - pip install xgboost)
MODEL_CANDIDATES = [
    os.path.join(BASE_DIR, "diet_model.pkl"),
    os.path.join(BASE_DIR, "Older models", "diet_model_personalized.pkl"),
    os.path.join(BASE_DIR, "Older models", "diet_model_personalized _light.pkl"),
]
MODEL_PATH = None
for p in MODEL_CANDIDATES:
    if os.path.isfile(p):
        MODEL_PATH = p
        break
if MODEL_PATH is None:
    raise FileNotFoundError(
        f"No model file found. Tried: {MODEL_CANDIDATES}. "
        "Add diet_model.pkl to ml-model-service/ or use a model from Older models/."
    )

DATA_PATH = os.path.join(BASE_DIR, "raw_data", "final_df_cleaned.csv")
if not os.path.isfile(DATA_PATH):
    raise FileNotFoundError(f"Food data CSV not found: {DATA_PATH}")

app = FastAPI(title="DietRecommendationEngine-Pro")

# load model and data once (xgboost must be installed for pickle to load)
model = joblib.load(MODEL_PATH)
foods_df = pd.read_csv(DATA_PATH)

# ===== Request models =====
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

# ===== Multi-condition encoding WITHOUT increasing feature count =====
# We compress multiple conditions into a single integer using bitmask.
ALL_CONDITIONS = [
    "obesity", "diabetes", "hypertension", "pcos", "ibs", "anemia"
]
# (Ensure this list covers conditions used in UI; adding new conditions still uses one scalar.)

def condition_bitmask(conditions: List[str]) -> float:
    mask = 0
    for cond in conditions:
        cond_l = str(cond).lower().strip()
        if cond_l in ALL_CONDITIONS:
            i = ALL_CONDITIONS.index(cond_l)
            mask |= (1 << i)
    return float(mask)

# diet encoding (keep single scalar)
DIET_MAP = {"veg": 0.0, "egg": 1.0, "non_veg": 2.0}

# nutrient columns used in training (order is important — must match model training)
NUTRIENT_COLS = [
    "Calories (kcal)",
    "Carbohydrates (g)",
    "Protein (g)",
    "Fats (g)",
    "Free Sugar (g)",
    "Fibre (g)",
    "Sodium (mg)",
    "Calcium (mg)",
    "Iron (mg)",
    "Vitamin C (mg)",
    "Folate (µg)"
]
# total features = 11 nutrient_cols + 1 condition + 1 diet + 1 bmi + 1 tdee = 15

# ===== Clinical filters =====
def apply_clinical_filters(df: pd.DataFrame, conditions: List[str]) -> pd.DataFrame:
    dd = df.copy()
    conds = [c.lower() for c in conditions]

    # Remove obvious non-meal items (strong blacklist)
    blacklist = ["masala", "powder", "blend", "pickle"]  # add more if needed
    pattern = "|".join(re.escape(x) for x in blacklist)
    dd = dd[~dd["Dish Name"].str.lower().str.contains(pattern, na=False)]

    # Hypertension: strict sodium cap
    if "hypertension" in conds:
        dd = dd[dd["Sodium (mg)"].fillna(0) <= 500]

    # Diabetes / PCOS: strict free sugar cap
    if "diabetes" in conds:
        dd = dd[dd["Free Sugar (g)"].fillna(0) <= 10]
    if "pcos" in conds:
        dd = dd[dd["Free Sugar (g)"].fillna(0) <= 12]

    # Obesity: hard calorie filter
    if "obesity" in conds:
        dd = dd[dd["Calories (kcal)"].fillna(0) <= 450]

    return dd

# ===== Auto category clustering (diversity) =====
PRIORITY_KEYWORDS = [
    "sandwich", "omelette", "omlet", "paratha", "parantha",
    "dosa", "idli", "cake", "pulao", "soup", "salad", "roti", "curry", "dal"
]

def auto_category(name: str) -> str:
    if not isinstance(name, str):
        return ""
    s = name.lower()
    for k in PRIORITY_KEYWORDS:
        if k in s:
            return k
    tokens = re.findall(r"\b[a-z]+\b", s)
    return tokens[0] if tokens else s

# ===== Fast greedy optimizer (protein-aware value density) =====
def greedy_select(df: pd.DataFrame, calorie_limit: float, protein_goal: float, max_items: int = 3):
    if df.empty:
        return [], 0.0, 0.0

    # compute value = score-weighted + protein contribution
    df2 = df.copy()
    df2["score_norm"] = (df2["score"] - df2["score"].min()) / (df2["score"].max() - df2["score"].min() + 1e-8)
    df2["value"] = df2["score_norm"] * 100 + (df2["Protein (g)"].fillna(0) / max(1.0, protein_goal)) * 20

    df2["density"] = df2["value"] / df2["Calories (kcal)"].replace(0, 1)

    df2 = df2.sort_values("density", ascending=False)

    selected = []
    cal_sum = 0.0
    prot_sum = 0.0
    cal_cap = calorie_limit * 1.05  # small slack

    for _, row in df2.iterrows():
        if len(selected) >= max_items:
            break
        cal = float(row["Calories (kcal)"] or 0)
        prot = float(row["Protein (g)"] or 0)
        if cal <= 0:
            continue
        if cal_sum + cal <= cal_cap or len(selected) == 0:
            selected.append(row)
            cal_sum += cal
            prot_sum += prot

    # as fallback try lowest-calorie top-scoring candidates (if nothing selected)
    if len(selected) == 0 and not df2.empty:
        top = df2.sort_values(["score", "Calories (kcal)"], ascending=[False, True]).head(max_items)
        for _, r in top.iterrows():
            selected.append(r)
            cal_sum += float(r["Calories (kcal)"] or 0)
            prot_sum += float(r["Protein (g)"] or 0)

    # convert to list of dicts
    items = []
    for r in selected:
        items.append({
            "Dish Name": r["Dish Name"],
            "score": float(r["score"]),
            "Calories (kcal)": float(r["Calories (kcal)"] or 0),
            "Protein (g)": float(r["Protein (g)"] or 0),
            "meal_type": r.get("meal_type", "")
        })
    return items, round(cal_sum, 2), round(prot_sum, 2)

# ===== Main endpoint =====
@app.post("/predict/foods")
def predict_foods(req: PredictRequest):
    try:
        prefs = req.userPreferences

        # compute safe numeric defaults
        age = float(prefs.age or 30)
        height = float(prefs.height or 170)
        weight = float(prefs.weight or 70)
        bmi = float(prefs.bmi) if prefs.bmi else round(weight / ((height/100)**2), 2)
        tdee = float(prefs.tdee) if prefs.tdee else round( (10*weight + 6.25*height - 5*age + (5 if prefs.gender=="male" else -161)) * (1.2), 0)

        # clinical filters first (reduce candidate set)
        df_filtered = apply_clinical_filters(foods_df, prefs.conditions or [])

        # Prepare features: keep EXACTLY 15 features in the exact order used in training
        X_rows = []
        processed_rows = []
        # Prefill nutrient values with zeros for missing columns
        for _, row in df_filtered.iterrows():
            # If column missing in csv, fill 0
            nutrient_vals = []
            for col in NUTRIENT_COLS:
                nutrient_vals.append(float(row.get(col, 0) or 0))
            cond_code = condition_bitmask(prefs.conditions or [])
            diet_code = float(DIET_MAP.get((prefs.dietPreference or "").lower(), 0.0))
            # Order MUST match model training:
            # [nutrient_cols...] + [condition_encoded] + [diet_encoded] + [bmi] + [tdee]
            feature_vec = nutrient_vals + [cond_code, diet_code, float(bmi), float(tdee)]
            X_rows.append(feature_vec)
            processed_rows.append(row)

        if len(X_rows) == 0:
            # no candidates after clinical filters
            return {
                "success": True,
                "healthProfile": {"bmi": bmi, "tdee": tdee},
                "recommendations": [],
                "rawRecommendations": [],
                "mealPlan": {},
                "mealTotals": {}
            }

        X = np.array(X_rows, dtype=float)

        # protective check: enforce shape to match model
        if X.shape[1] != 15:
            raise HTTPException(status_code=500, detail=f"Feature shape mismatch: expected 15 got {X.shape[1]}")

        probs = model.predict_proba(X)[:, 1]
        # build results dataframe
        out = []
        for r, p, row in zip(processed_rows, probs, processed_rows):
            out.append({
                "Dish Name": row["Dish Name"],
                "score": float(p),
                "Calories (kcal)": float(row.get("Calories (kcal)", 0) or 0),
                "Protein (g)": float(row.get("Protein (g)", 0) or 0),
                "meal_type": (row.get("meal_type") or row.get("mealType") or "").lower()
            })
        raw_df = pd.DataFrame(out)

        # 🔥 HARD DEDUPLICATION (by Dish Name + Calories)
        raw_df = raw_df.drop_duplicates(
            subset=["Dish Name", "Calories (kcal)", "Protein (g)"]
        ).reset_index(drop=True)

        # small adjustments: penalize extreme sugar for diabetes or obesity to lower their score
        if any(c.lower() == "diabetes" for c in (prefs.conditions or [])):
            raw_df["score"] -= (raw_df["Protein (g)"].fillna(0) * 0.001)  # favor protein slight
            raw_df["score"] -= (raw_df["Calories (kcal)"] / 1000) * 0.05
            raw_df["score"] -= (raw_df["Calories (kcal)"] / 1000) * (raw_df["Protein (g)"] < 3).astype(float) * 0.03

        raw_df["score"] = raw_df["score"].clip(lower=0.0)

        # Sort by score
        raw_df = raw_df.sort_values("score", ascending=False).reset_index(drop=True)

        # Auto category clustering and diversity reduction
        raw_df["_category"] = raw_df["Dish Name"].apply(auto_category)
        dedup_df = raw_df.drop_duplicates(subset=["_category"]).reset_index(drop=True)

        # ===== SMART RECOMMENDATION FILTERING =====

        # 1️⃣ Remove ultra-low calorie noise (waters, stocks, etc.)
        filtered = raw_df[raw_df["Calories (kcal)"] >= 40].copy()

        # 2️⃣ Remove very low confidence predictions
        filtered = filtered[filtered["score"] >= 0.60]

        # 3️⃣ Auto category clustering (limit duplicates per food type)
        filtered["_category"] = filtered["Dish Name"].apply(auto_category)

        MAX_PER_CATEGORY = 2
        filtered = (
            filtered.sort_values("score", ascending=False)
            .groupby("_category", as_index=False)
            .head(MAX_PER_CATEGORY)
        )

        # 4️⃣ Limit per meal type
        MAX_PER_MEAL = 6
        filtered = (
            filtered.sort_values("score", ascending=False)
            .groupby("meal_type", as_index=False)
            .head(MAX_PER_MEAL)
        )

        # 5️⃣ Final global cap
        FINAL_CAP = 35
        filtered = filtered.sort_values("score", ascending=False).head(FINAL_CAP)

        recommendations = filtered[
            ["Dish Name", "score", "Calories (kcal)", "Protein (g)", "meal_type"]
        ].to_dict(orient="records")

        # Keep raw list separate but trimmed
        rawRecommendations = raw_df.head(80)[
            ["Dish Name", "score", "Calories (kcal)", "Protein (g)", "meal_type"]
        ].to_dict(orient="records")
        
        # ===== Meal Planning (greedy) =====
        calorieTarget = float(prefs.calorieTarget) if prefs.calorieTarget else float(tdee)
        proteinTarget = float(prefs.proteinTarget) if prefs.proteinTarget else float(max(50.0, round(weight * 1.4)))

        splits = {"breakfast": 0.25, "snack": 0.10, "beverage": 0.05, "lunch": 0.30, "dinner": 0.30}
        mealPlan = {}
        mealTotals = {}

        df_for_meals = raw_df.copy()
        df_for_meals["meal_type"] = df_for_meals["meal_type"].fillna("")

        for meal, ratio in splits.items():
            meal_pool = df_for_meals[df_for_meals["meal_type"].str.contains(meal, na=False)]
            if meal_pool.empty:
                meal_pool = df_for_meals  # fallback to entire set
            items, csum, psum = greedy_select(meal_pool, calorieTarget * ratio, proteinTarget)
            mealPlan[meal] = items
            mealTotals[meal] = {"calories": csum, "protein": psum}

        totals = {
            "plannedCalories": sum(m["calories"] for m in mealTotals.values()),
            "plannedProtein": sum(m["protein"] for m in mealTotals.values())
        }

        return {
            "success": True,
            "healthProfile": {"bmi": bmi, "tdee": tdee, "calorieTarget": calorieTarget, "proteinTarget": proteinTarget},
            "recommendations": recommendations,
            "rawRecommendations": rawRecommendations,
            "mealPlan": mealPlan,
            "mealTotals": mealTotals,
            "totals": totals
        }

    except HTTPException:
        raise
    except Exception as e:
        # keep error details in logs, but return generic 500
        import traceback, sys
        traceback.print_exc(file=sys.stdout)
        raise HTTPException(status_code=500, detail=str(e))