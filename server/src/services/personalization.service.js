// // server/src/services/personalization.service.js
// import axios from "axios";

// /**
//  * Personalization service - production-ready replacement
//  *
//  * Features:
//  * - Hard dedupe & normalization (string normalization)
//  * - Multi-condition encoding using a single bitmask integer (no extra features)
//  * - Clinical safety filters (hypertension & diabetes)
//  * - Protein-aware re-ranking
//  * - Simple diversity penalty (cluster by primary token)
//  * - Faster greedy calorie optimizer per meal (score/calorie ratio)
//  * - Limits returned recommendations to `MAX_RECS`
//  */

// const ACTIVITY_MULTIPLIERS = {
//   sedentary: 1.2,
//   light: 1.375,
//   moderate: 1.55,
//   active: 1.725,
//   very_active: 1.9,
// };

// const KNOWN_CONDITIONS = [
//   "obesity",
//   "diabetes",
//   "hypertension",
//   "pcos",
//   "cardiovascular",
//   // add more known conditions here (lowercase). Keep list stable.
// ];
// const CONDITION_INDEX = KNOWN_CONDITIONS.reduce((acc, c, i) => {
//   acc[c] = i;
//   return acc;
// }, {});

// const MAX_RECS = 60; // cap returned candidate recommendations

// // clinical thresholds (per-serving). Tune according to dietician guidance.
// const CLINICAL_THRESHOLDS = {
//   hypertension: {
//     max_sodium_mg: 400, // per serving
//   },
//   diabetes: {
//     max_free_sugar_g: 15, // per serving
//   },
//   obesity: {
//     max_calories: 800, // avoid extremely caloric single items as defaults
//   },
// };

// /* ---------- helpers ---------- */

// const calculateBMI = (weight, height) => {
//   const h = height / 100;
//   return +(weight / (h * h)).toFixed(2);
// };

// const calculateBMR = ({ gender, weight, height, age }) => {
//   if (gender === "male")
//     return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
//   if (gender === "female")
//     return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
//   return Math.round(10 * weight + 6.25 * height - 5 * age - 78);
// };

// const calculateTDEE = (bmr, activityLevel) => {
//   return Math.round(
//     bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.sedentary)
//   );
// };

// // encode array of conditions into a single integer bitmask
// const encodeConditionsBitmask = (conditions = []) => {
//   let mask = 0;
//   for (const cond of (conditions || [])) {
//     const c = (cond || "").toString().toLowerCase().trim();
//     if (c in CONDITION_INDEX) {
//       mask |= 1 << CONDITION_INDEX[c];
//     }
//   }
//   return mask;
// };

// // clinical safety filter for an item, returns false if item should be filtered out
// const passesClinicalFilters = (food, condMask) => {
//   // If thresholds are not present in data, treat as safe (do not filter)
//   // sodium field names that might exist: "Sodium (mg)", "sodium_mg", "sodium"
//   const sodium = Number(food["Sodium (mg)"] ?? food.sodium_mg ?? food.sodium ?? 0);
//   const freeSugar = Number(
//     food["Free Sugar (g)"] ?? food.free_sugar_g ?? food.free_sugar ?? 0
//   );
//   const calories = Number(food["Calories (kcal)"] ?? food.calories ?? 0);

//   // Hypertension: check sodium
//   if ((condMask & (1 << (CONDITION_INDEX["hypertension"] ?? -99))) && sodium) {
//     if (sodium > CLINICAL_THRESHOLDS.hypertension.max_sodium_mg) return false;
//   }

//   // Diabetes: check free sugar
//   if ((condMask & (1 << (CONDITION_INDEX["diabetes"] ?? -99))) && freeSugar) {
//     if (freeSugar > CLINICAL_THRESHOLDS.diabetes.max_free_sugar_g) return false;
//   }

//   // Obesity: block extremely caloric single items
//   if ((condMask & (1 << (CONDITION_INDEX["obesity"] ?? -99))) && calories) {
//     if (calories > CLINICAL_THRESHOLDS.obesity.max_calories) return false;
//   }

//   // else allow
//   return true;
// };

// // normalize dish name for dedupe and clustering
// const normalizeName = (s) => (s || "").toString().trim().toLowerCase();

// // quick primary cluster token (first meaningful token)
// // This is a very light heuristic that gives basic diversity categories
// const primaryToken = (name) => {
//   if (!name) return "";
//   const tokens = name.split(/[\s\(\)\-,:]+/).filter(Boolean);
//   return tokens.length ? tokens[0] : name;
// };

// /**
//  * Fast greedy calorie-aware picker:
//  * - Sort candidates by adjustedScore / calories (better bang-for-calorie)
//  * - Pick until we approximate targetCalories (allow small overshoot)
//  * - Ensure we don't reuse dish names via usedSet
//  */
// const pickItemsForMeal = (candidates, targetCalories, usedSet, maxItems = 3) => {
//   const items = [];
//   let totalCalories = 0;
//   let totalProtein = 0;

//   if (!Array.isArray(candidates) || candidates.length === 0) {
//     return { items: [], totalCalories: 0, totalProtein: 0 };
//   }

//   // compute adjustedScore used for picking (already present on candidate)
//   // candidates should already have finalScore and clusterToken fields
//   const pool = candidates
//     .filter((c) => {
//       const name = (c["Dish Name"] || c.name || "").toString();
//       return name && !usedSet.has(name);
//     })
//     .slice(); // shallow copy

//   // sort by finalScore/calories ratio (higher is better)
//   pool.sort((a, b) => {
//     const aRatio = (Number(a.finalScore ?? a.score ?? 0) || 0) / (Number(a.calories ?? 1) || 1);
//     const bRatio = (Number(b.finalScore ?? b.score ?? 0) || 0) / (Number(b.calories ?? 1) || 1);
//     return bRatio - aRatio;
//   });

//   const calorieLimit = Math.max(50, targetCalories * 1.05); // allow small overshoot, avoid too small limits

//   for (const food of pool) {
//     if (items.length >= maxItems) break;

//     const name = (food["Dish Name"] || food.name || "").toString();
//     const cal = Number(food["Calories (kcal)"] ?? food.calories ?? 0);
//     const protein = Number(food["Protein (g)"] ?? food.protein ?? 0);

//     if (!name || cal <= 0) continue;
//     if (usedSet.has(name)) continue;

//     // pick if within limit OR if we have no items yet (ensure at least one)
//     if (totalCalories + cal <= calorieLimit || items.length === 0) {
//       items.push({ name, calories: Math.round(cal), protein: Math.round(protein), meal_type: food.meal_type ?? "", score: Number(food.finalScore ?? food.score ?? 0) });
//       totalCalories += cal;
//       totalProtein += protein;
//       usedSet.add(name);
//     }
//   }

//   // if nothing chosen (very rare), pick the top candidate
//   if (items.length === 0 && pool.length > 0) {
//     const f = pool[0];
//     const name = (f["Dish Name"] || f.name || "").toString();
//     const cal = Number(f["Calories (kcal)"] ?? f.calories ?? 0);
//     const protein = Number(f["Protein (g)"] ?? f.protein ?? 0);
//     items.push({ name, calories: Math.round(cal), protein: Math.round(protein), meal_type: f.meal_type ?? "", score: Number(f.finalScore ?? f.score ?? 0) });
//     totalCalories += cal;
//     totalProtein += protein;
//     usedSet.add(name);
//   }

//   return { items, totalCalories: Math.round(totalCalories), totalProtein: Math.round(totalProtein) };
// };

// /* ---------- main exported function ---------- */

// export const runPersonalization = async (preferences) => {
//   try {
//     const {
//       conditions = [],
//       dietPreference = "veg",
//       activityLevel = "sedentary",
//       age,
//       gender,
//       height,
//       weight,
//       bodyFatPercentage,
//       calorieTarget: providedCalorieTarget,
//       proteinTarget: providedProteinTarget,
//       bmi: providedBmi,
//       bmr: providedBmr,
//       tdee: providedTdee,
//     } = preferences || {};

//     const ageNum = Number(age || 30);
//     const heightNum = Number(height || 170);
//     const weightNum = Number(weight || 70);

//     // health metrics (if not provided)
//     const bmi = Number(providedBmi) || calculateBMI(weightNum, heightNum);
//     const bmr = Number(providedBmr) || calculateBMR({ gender, weight: weightNum, height: heightNum, age: ageNum });
//     const tdee = Number(providedTdee) || calculateTDEE(bmr, activityLevel);

//     const calorieTarget = Number(providedCalorieTarget) || tdee || Math.round(2000);
//     const proteinTarget = Number(providedProteinTarget) || Math.round(weightNum * 1.4);

//     // encode multiple conditions into single bitmask
//     const condMask = encodeConditionsBitmask(conditions);

//     // 2) Call ML service to get a reasonably large candidate set
//     const mlUrl = process.env.ML_SERVICE_URL || "http://localhost:8001/predict/foods";

//     const mlResp = await axios.post(mlUrl, {
//       userPreferences: {
//         conditions,
//         dietPreference,
//         activityLevel,
//         age: ageNum,
//         gender,
//         height: heightNum,
//         weight: weightNum,
//         bodyFatPercentage: bodyFatPercentage ? Number(bodyFatPercentage) : null,
//         calorieTarget: Number(calorieTarget),
//         proteinTarget: Number(proteinTarget),
//         bmi,
//         bmr,
//         tdee,
//         // also send encoded bitmask if your ML model can accept it
//         conditionMask: condMask,
//       },
//       // request larger candidate set so server can optimize & diversify locally
//       top_k: Math.max(50, MAX_RECS),
//     });

//     const mlData = mlResp.data || {};
//     // Accept either mlData.recommendations or mlData.rawRecommendations or array directly
//     let rawFoods = [];
//     if (Array.isArray(mlData.recommendations)) rawFoods = mlData.recommendations;
//     else if (Array.isArray(mlData.rawRecommendations)) rawFoods = mlData.rawRecommendations;
//     else if (Array.isArray(mlData)) rawFoods = mlData;
//     else rawFoods = [];

//     // if ML already returned a mealPlan, pass-through (still add healthProfile)
//     if (mlData && mlData.mealPlan) {
//       // ensure health profile present
//       return {
//         healthProfile: mlData.healthProfile || { bmi, bmr, tdee, calorieTarget, proteinTarget },
//         usedPreferences: mlData.usedPreferences || preferences,
//         ...mlData,
//       };
//     }

//     // no recommendations -> return healthProfile only
//     if (!Array.isArray(rawFoods) || rawFoods.length === 0) {
//       return {
//         healthProfile: { bmi, bmr, tdee, calorieTarget, proteinTarget },
//         usedPreferences: preferences,
//         mealPlan: {},
//         mealTotals: {},
//         totals: {},
//         recommendations: [],
//         rawRecommendations: [],
//       };
//     }

//     // Normalize & extract fields
//     const foodsNormalized = rawFoods.map((f) => {
//       const dishNameRaw = f["Dish Name"] ?? f.dish_name ?? f.name ?? "";
//       const dishName = normalizeName(dishNameRaw);
//       const calories = Number(f["Calories (kcal)"] ?? f.calories ?? 0);
//       const protein = Number(f["Protein (g)"] ?? f.protein ?? 0);
//       const sodium = Number(f["Sodium (mg)"] ?? f.sodium_mg ?? f.sodium ?? 0);
//       const freeSugar = Number(f["Free Sugar (g)"] ?? f.free_sugar_g ?? f.free_sugar ?? 0);
//       const meal_type = (f.meal_type ?? f.mealType ?? "").toString().toLowerCase();
//       const baseScore = Number(f.score ?? 0);

//       return {
//         original: f,
//         "Dish Name": dishName,
//         displayName: (dishNameRaw || "").toString().trim(),
//         calories,
//         protein,
//         sodium,
//         freeSugar,
//         meal_type,
//         baseScore,
//         clusterToken: primaryToken(dishName),
//       };
//     });

//     // HARD dedupe: by normalized dish name + calories + protein
//     const dedupeKeySet = new Set();
//     const deduped = [];
//     for (const f of foodsNormalized) {
//       const key = `${f["Dish Name"]}||${Math.round(f.calories)}||${Math.round(f.protein)}`;
//       if (!dedupeKeySet.has(key)) {
//         dedupeKeySet.add(key);
//         deduped.push(f);
//       }
//     }

//     // Apply clinical safety filters (remove items that violate)
//     const clinicallyFiltered = deduped.filter((f) => passesClinicalFilters(f, condMask));

//     // If filtering removed too many, fallback to deduped list (so user still gets suggestions)
//     const filteredPool = clinicallyFiltered.length > 0 ? clinicallyFiltered : deduped;

//     // Basic re-ranking: protein-aware & diversity penalty
//     // protein importance weight (tuneable)
//     const PROTEIN_WEIGHT = 0.30; // how much protein proximity influences final score (0..1)
//     const DIVERSITY_PENALTY = 0.18; // reduce score when cluster already represented

//     // compute per-meal protein target approximations
//     const proteinSplit = {
//       breakfast: proteinTarget * 0.25,
//       snack: proteinTarget * 0.10,
//       beverage: proteinTarget * 0.05,
//       lunch: proteinTarget * 0.30,
//       dinner: proteinTarget * 0.30,
//     };

//     // Precompute finalScore with protein boost and a small diversity penalty applied later
//     // proteinScore = sigmoid-like measure: protein / (mealProteinTarget + 6) clipped
//     for (const f of filteredPool) {
//       const mealProteinTarget = proteinSplit[f.meal_type] ?? (proteinTarget / 3);
//       const proteinScore = Math.min(1, (f.protein || 0) / (Math.max(6, mealProteinTarget / 2) + 0.0001));
//       // combine baseScore and proteinScore
//       f.finalScore = (Number(f.baseScore || 0) * (1 - PROTEIN_WEIGHT)) + (proteinScore * PROTEIN_WEIGHT);
//     }

//     // Sort by finalScore descending initially
//     filteredPool.sort((a, b) => b.finalScore - a.finalScore);

//     // Diversity boost / penalty phase:
//     // Keep track of chosen clusters and penalize items from already represented primary tokens
//     // We will not remove duplicates here, just reduce score slightly to favor variety
//     const clusterCounts = new Map();
//     for (const f of filteredPool) {
//       const token = f.clusterToken || "";
//       const count = clusterCounts.get(token) || 0;
//       // apply penalty proportionally to current count
//       const penalty = Math.min(0.5, count * DIVERSITY_PENALTY);
//       f.finalScore = Math.max(0, f.finalScore - penalty);
//       // update counts lazily (we don't "choose" yet) - this simply biases items with many duplicates
//       clusterCounts.set(token, count + 1);
//     }

//     // re-sort by adjusted finalScore
//     filteredPool.sort((a, b) => b.finalScore - a.finalScore);

//     // limit candidate list to MAX_RECS (so we don't return 200+)
//     const candidates = filteredPool.slice(0, Math.max(MAX_RECS, 50));

//     // Build per-meal candidate lists (also allow fallback to generic pool)
//     const mealCandidates = {
//       breakfast: candidates.filter((c) => c.meal_type.includes("breakfast")),
//       snack: candidates.filter((c) => c.meal_type.includes("snack")),
//       beverage: candidates.filter((c) => /(beverage|drink|tea|coffee)/.test(c.meal_type)),
//       lunch: candidates.filter((c) => c.meal_type.includes("lunch")),
//       dinner: candidates.filter((c) => c.meal_type.includes("dinner")),
//     };

//     const genericPool = candidates.slice();

//     // pick meals greedily with fast optimizer
//     const usedSet = new Set();
//     const mealPlan = {};
//     const mealTotals = {};
//     const fillOrder = ["beverage", "snack", "breakfast", "lunch", "dinner"];

//     for (const meal of fillOrder) {
//       let cands = (mealCandidates[meal] && mealCandidates[meal].length > 0) ? mealCandidates[meal] : genericPool;

//       // prefer diet-specific names when dietPreference exists (simple heuristic)
//       if (dietPreference) {
//         const dietLower = (dietPreference || "").toString().toLowerCase();
//         const filteredByDiet = cands.filter((c) => (c.displayName || "").toLowerCase().includes(dietLower));
//         if (filteredByDiet.length > 0) cands = filteredByDiet;
//       }

//       const maxItems = meal === "beverage" ? 1 : meal === "snack" ? 2 : 3;
//       const { items, totalCalories, totalProtein } = pickItemsForMeal(cands, calorieTarget * (meal === "breakfast" ? 0.25 : meal === "snack" ? 0.1 : meal === "beverage" ? 0.05 : meal === "lunch" ? 0.3 : 0.3), usedSet, maxItems);
//       mealPlan[meal] = items;
//       mealTotals[meal] = { calories: totalCalories, protein: totalProtein };
//     }

//     const totalPlannedCalories = Object.values(mealTotals).reduce((s, m) => s + (m.calories || 0), 0);
//     const totalPlannedProtein = Object.values(mealTotals).reduce((s, m) => s + (m.protein || 0), 0);

//     // Prepare final recommendations output (map back to displayName and include finalScore)
//     const recommendations = candidates.map((c) => ({
//       "Dish Name": c.displayName || c["Dish Name"],
//       score: Number(c.finalScore ?? c.baseScore ?? 0),
//       "Calories (kcal)": Number(c.calories || 0),
//       "Protein (g)": Number(c.protein || 0),
//       meal_type: c.meal_type || "",
//     }));

//     // Ensure stable sorting by score desc
//     recommendations.sort((a, b) => b.score - a.score);

//     return {
//       healthProfile: { bmi, bmr, tdee, calorieTarget, proteinTarget },
//       usedPreferences: preferences,
//       mealPlan,
//       mealTotals,
//       totals: { plannedCalories: totalPlannedCalories, plannedProtein: totalPlannedProtein },
//       recommendations: recommendations.slice(0, MAX_RECS),
//       rawRecommendations: recommendations.slice(0, MAX_RECS),
//       meta: {
//         candidateCount: filteredPool.length,
//         dedupedCount: deduped.length,
//         requestedTopK: Math.max(MAX_RECS, 50),
//       },
//     };
//   } catch (err) {
//     console.error("runPersonalization error:", err && err.message ? err.message : err);
//     // rethrow so caller can handle HTTP 500 / 422 appropriately
//     throw err;
//   }
// }; 