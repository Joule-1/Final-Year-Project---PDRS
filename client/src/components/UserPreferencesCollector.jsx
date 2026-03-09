import React, { useState, useMemo, useRef, useEffect } from "react";
import Select from "react-select";
import {
    UtensilsCrossed,
    Flame,
    Target,
    Scale,
    Sun,
    Coffee,
    Apple,
    Moon,
    ChevronRight,
} from "lucide-react";
import { dietTypeOptions } from "../utils/options/dietType_options";
import { activityLevelOptions } from "../utils/options/activityLevel_options";
import { healthConditionOptions } from "../utils/options/healthCondition_options";
import { genderOptions } from "../utils/options/gender_options";
import { userPreferencesAPI } from "../utils/UserPreferencesAxios";
import { AuthContext } from "../utils/AuthContext";
import VerifyUserLogIn from "../utils/VerifyUserLogIn";

const mealTypeConfig = {
    breakfast: { icon: Sun, label: "Breakfast", color: "bg-amber-100 text-amber-800 border-amber-200" },
    snack: { icon: Apple, label: "Snack", color: "bg-lime-100 text-lime-800 border-lime-200" },
    beverage: { icon: Coffee, label: "Beverage", color: "bg-sky-100 text-sky-800 border-sky-200" },
    lunch: { icon: UtensilsCrossed, label: "Lunch", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    dinner: { icon: Moon, label: "Dinner", color: "bg-violet-100 text-violet-800 border-violet-200" },
};
function getMealBadge(mealType) {
    const key = (mealType || "").toLowerCase();
    return mealTypeConfig[key] || { icon: UtensilsCrossed, label: key || "Meal", color: "bg-gray-100 text-gray-700 border-gray-200" };
}

const UserPreferencesCollector = () => {
    const [dietPreference, setDietPreference] = useState(false);
    const [activityLevel, setActivityLevel] = useState("");
    const [conditions, setConditions] = useState([]);
    const [gender, setGender] = useState("");
    const [height, setHeight] = useState("");
    const [age, setAge] = useState("");
    const [weight, setWeight] = useState("");
    const [bodyFatPercentage, setBodyFatPercentage] = useState("");
    const [calorieTarget, setCalorieTarget] = useState("");
    const [proteinTarget, setProteinTarget] = useState("");
    const [recommendationResult, setRecommendationResult] = useState(null);
    const [submitError, setSubmitError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bmiInfoDisplay, setBMIInfoDisplay] = useState(false);
    const [bmrInfoDisplay, setBMRInfoDisplay] = useState(false);
    const [tdeeInfoDisplay, setTDEEInfoDisplay] = useState(false);
    const bmiInfoDisplayRef = useRef(null);
    const bmrInfoDisplayRef = useRef(null);
    const tdeeInfoDisplayRef = useRef(null);

    useEffect(() => {
        function handleClickOutsideInfoBox(e) {
            if (
                bmiInfoDisplayRef.current &&
                !bmiInfoDisplayRef.current.contains(e.target)
            ) {
                setBMIInfoDisplay(false);
            }
            if (
                bmrInfoDisplayRef.current &&
                !bmrInfoDisplayRef.current.contains(e.target)
            ) {
                setBMRInfoDisplay(false);
            }
            if (
                tdeeInfoDisplayRef.current &&
                !tdeeInfoDisplayRef.current.contains(e.target)
            ) {
                setTDEEInfoDisplay(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutsideInfoBox);
        return () =>
            document.removeEventListener(
                "mousedown",
                handleClickOutsideInfoBox
            );
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitError(null);
        setRecommendationResult(null);
        setIsSubmitting(true);
        try {
            const payload = {
                conditions: conditions,
                dietPreference: dietPreference?.value ?? dietPreference,
                activityLevel: activityLevel?.value ?? activityLevel,
                age: age,
                gender: gender?.value ?? gender,
                height: height,
                weight: weight,
                bodyFatPercentage: bodyFatPercentage,
                calorieTarget: calorieTarget,
                proteinTarget: proteinTarget,
                bmi: bmi != null && bmi !== "" ? String(bmi) : undefined,
                bmr: bmr != null && bmr !== "" ? String(bmr) : undefined,
                tdee: tdee != null && tdee !== "" ? String(tdee) : undefined,
            };
            const response = await userPreferencesAPI.put(
                "/registerUserPreferences",
                payload
            );
            const data = response?.data?.data;
            if (data?.recommendations) {
                setRecommendationResult({
                    recommendations: data.recommendations,
                    mealPlan: data.mealPlan || {},
                    mealTotals: data.mealTotals || {},
                    totals: data.totals || {},
                    healthProfile: data.healthProfile || {},
                });
            } else if (data?.preferences) {
                setSubmitError(
                    "Preferences saved, but diet recommendations could not be loaded. Ensure the ML service is running on port 8001."
                );
            }
        } catch (err) {
            setSubmitError(
                err?.response?.data?.message || err?.message || "Failed to submit"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const bmi = useMemo(() => {
        if (!height || !weight) return 0;

        const value = weight / (height / 100) ** 2;
        if (value < 12) return "< 12";
        if (value > 50) return "> 50";
        return Number(value.toFixed(1));
    }, [height, weight]);

    const bmr = useMemo(() => {
        if (!weight || !height || !age || !gender) return 0;

        if (gender === "male") {
            const ansM = Math.round(10 * weight + 6.25 * height - 5 * age + 5);
            if (ansM < 800) return "< 800";
            if (ansM > 4000) return "> 4000";
            return ansM;
        }
        let ansF = Math.round(10 * weight + 6.25 * height - 5 * age - 161);
        if (ansF < 800) return "< 800";
        if (ansF > 4000) return "> 4000";
        return ansF;
    }, [weight, height, age, gender]);

    const tdee = useMemo(() => {
        if (!bmr || !activityLevel) return 0;

        const multipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            very_active: 1.9,
        };
        const ans = Math.round(bmr * multipliers[activityLevel]);
        if (ans < 1200) return "< 1200";
        if (ans > 5000) return "> 5000";
        return ans;
    }, [bmr, activityLevel]);

    // BMI	Category (12-50)
    // < 18.5	Underweight
    // 18.5 – 24.9	Normal
    // 25 – 29.9	Overweight
    // 30 – 34.9	Obese Class I
    // 35 – 39.9	Obese Class II
    // ≥ 40	Obese Class III

    // Women (800-4000)
    // Category	BMR
    // Low	< 1200
    // Normal	1200 – 1600
    // High	> 1600
    // Men
    // Category	BMR
    // Low	< 1400
    // Normal	1400 – 1900
    // High	> 1900

    // Very high BMR often = muscular / large body mass.

    // By Calorie Level (1200-5000)
    // TDEE	Meaning
    // < 1500	Very low expenditure
    // 1500 – 2200	Light/moderate
    // 2200 – 3000	Active
    // 3000 – 4000	Highly active
    // > 4000	Athlete-level
    const handleBMIColor = (bmiValue) => {
        if (bmiValue < 18.5) {
            return "text-gray-400";
        } else if (bmiValue >= 18.5 && bmiValue <= 24.9) {
            return "text-green-400";
        } else if (bmiValue >= 25 && bmiValue <= 29.9) {
            return "text-yellow-400";
        } else if (bmiValue >= 30 && bmiValue <= 34.9) {
            return "text-orange-400";
        } else if (bmiValue >= 35 && bmiValue <= 39.9) {
            return "text-red-400";
        } else if (bmiValue >= 40) {
            return "text-red-800";
        } else {
            return "text-gray-400";
        }
    };
    const handleBMRColor = (bmrValue) => {
        const g = gender?.value ?? gender;
        if (g === "male") {
            if (bmrValue < 1400) {
                return "text-gray-400";
            } else if (bmrValue >= 1400 && bmrValue <= 1900) {
                return "text-green-400";
            } else if (bmrValue > 1900) {
                return "text-red-400";
            } else {
                return "text-gray-400";
            }
        } else {
            if (bmrValue < 1200) {
                return "text-gray-400";
            } else if (bmrValue >= 1200 && bmrValue <= 1600) {
                return "text-green-400";
            } else if (bmrValue > 1600) {
                return "text-red-400";
            } else {
                return "text-gray-400";
            }
        }
    };
    const handleTDEEColor = (tdeeValue) => {
        if (tdeeValue < 1500) {
            return "text-gray-400";
        } else if (tdeeValue >= 1500 && tdeeValue <= 2200) {
            return "text-yellow-400";
        } else if (tdeeValue >= 2200 && tdeeValue <= 3000) {
            return "text-green-400";
        } else if (tdeeValue >= 3000 && tdeeValue <= 4000) {
            return "text-orange-400";
        } else if (tdeeValue > 4000) {
            return "text-red-400";
        } else {
            return "text-gray-400";
        }
    };

    return (
        <section className="">
            <div className="h-10 border"></div>
            <div className="flex">
                <div className="flex flex-2 flex-col items-center text-lg">
                    <div className="relative my-5 flex items-center">
                        <div ref={bmiInfoDisplayRef}>
                            <button
                                onClick={() =>
                                    setBMIInfoDisplay((prev) => !prev)
                                }
                                className="poppins-semibold-italic mx-2 cursor-pointer rounded-full bg-blue-500 px-2 text-sm text-white"
                            >
                                i
                            </button>
                            <div
                                className={`${bmiInfoDisplay ? "block" : "hidden"} absolute top-6 left-0 z-50 flex w-[300px] max-w-[500px] items-center overflow-x-auto rounded-xl bg-gray-100 p-3 text-sm text-gray-500 shadow-lg`}
                            >
                                <div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            &lt; 18.5
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            Underweight
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            18.5 - 24.9
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            Normal
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            25 - 29.9
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            Overweight
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            30 - 34.9
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            Obese Class I
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            35 - 39.9
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            Obese Class II
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            &ge; 40
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            Obese Class III
                                        </span>
                                    </div>
                                </div>
                                <div className="ml-5 flex items-center text-lg whitespace-nowrap text-gray-800">
                                    <span className="poppins-semibold-italic">
                                        Body Mass Index(BMI)
                                    </span>
                                    <span>=</span>

                                    <div className="flex flex-col items-center leading-tight">
                                        <span className="px-2">
                                            Weight (kg)
                                        </span>

                                        <div className="my-1 w-full border-t border-gray-800"></div>

                                        <span className="px-2">
                                            (Height (cm) / 100)<sup>2</sup>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>BMI</div>&nbsp;&nbsp;
                        <button
                            className={`${handleBMIColor(bmi)} poppins-semibold`}
                        >
                            {bmi}
                        </button>
                    </div>
                    <div className="my-5 flex items-center">
                        <div ref={bmrInfoDisplayRef} className="relative">
                            <button
                                onClick={() =>
                                    setBMRInfoDisplay((prev) => !prev)
                                }
                                className="poppins-semibold-italic mx-2 cursor-pointer rounded-full bg-blue-500 px-2 text-sm text-white"
                            >
                                i
                            </button>
                            <div
                                className={`${bmrInfoDisplay ? "block" : "hidden"} absolute top-6 left-0 z-50 flex w-[300px] max-w-[500px] items-center overflow-x-auto rounded-xl bg-gray-100 p-3 text-sm text-gray-500 shadow-lg`}
                            >
                                <div>
                                    <div className="poppins-bold flex items-center justify-center whitespace-nowrap">
                                        ---- Women ----
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            &lt; 1200
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            Low
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            1200 - 1600
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            Normal
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            &gt; 1600
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            High
                                        </span>
                                    </div>
                                    <div className="poppins-bold flex items-center justify-center whitespace-nowrap">
                                        ---- Men ----
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            &lt; 1400
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            Low
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            1400 - 1900
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            Normal
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            &gt; 1900
                                        </span>
                                        <span className="my-2 w-[110px]">
                                            High
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div className="mx-5 my-10 flex items-center text-lg whitespace-nowrap text-gray-800">
                                        <span className="poppins-semibold-italic">
                                            Basal Metabolic Rate (BMR -&gt;
                                            Male)
                                        </span>

                                        <span className="mx-2">=</span>

                                        <div className="flex items-center space-x-1">
                                            <span>(10 × Weight (kg))</span>
                                            <span>+</span>
                                            <span>(6.25 × Height (cm))</span>
                                            <span>−</span>
                                            <span>(5 × Age (years))</span>
                                            <span>+</span>
                                            <span>5</span>
                                        </div>
                                    </div>
                                    <div className="mx-5 my-10 flex items-center text-lg whitespace-nowrap text-gray-800">
                                        <span className="poppins-semibold-italic">
                                            Basal Metabolic Rate (BMR -&gt;
                                            Female)
                                        </span>

                                        <span className="mx-2">=</span>

                                        <div className="flex items-center space-x-1">
                                            <span>(10 × Weight (kg))</span>
                                            <span>+</span>
                                            <span>(6.25 × Height (cm))</span>
                                            <span>−</span>
                                            <span>(5 × Age (years))</span>
                                            <span>−</span>
                                            <span>161</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>BMR</div>&nbsp;&nbsp;
                        <div
                            className={`${handleBMRColor(bmr)} poppins-semibold`}
                        >
                            {bmr}
                        </div>
                    </div>
                    <div className="my-5 flex items-center">
                        <div ref={tdeeInfoDisplayRef} className="relative">
                            <button
                                onClick={() =>
                                    setTDEEInfoDisplay((prev) => !prev)
                                }
                                className="poppins-semibold-italic mx-2 cursor-pointer rounded-full bg-blue-500 px-2 text-sm text-white"
                            >
                                i
                            </button>
                            <div
                                className={`absolute ${tdeeInfoDisplay ? "block" : "hidden"} top-6 left-0 z-50 flex w-[300px] max-w-[500px] items-center overflow-x-auto rounded-xl bg-gray-100 p-3 text-sm text-gray-500 shadow-lg`}
                            >
                                <div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            &lt; 1500
                                        </span>
                                        <span className="my-2 w-[150px]">
                                            Very Low Expenditure
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            1500 - 2200
                                        </span>
                                        <span className="my-2 w-[150px]">
                                            Light/Moderate
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            2200 - 3000
                                        </span>
                                        <span className="my-2 w-[150px]">
                                            Active
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            3000 - 4000
                                        </span>
                                        <span className="my-2 w-[150px]">
                                            Highly Active
                                        </span>
                                    </div>
                                    <div className="flex items-center whitespace-nowrap">
                                        <span className="my-2 w-[100px]">
                                            &gt; 4000
                                        </span>
                                        <span className="my-2 w-[150px]">
                                            Athlete-Level
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div className="mx-10 my-2 flex items-center text-lg whitespace-nowrap text-gray-800">
                                        <span className="poppins-semibold-italic">
                                            Total Daily Energy Expenditure
                                            (TDEE)
                                        </span>

                                        <span className="mx-2">=</span>

                                        <div className="flex items-center space-x-1">
                                            <span>BMR</span>
                                            <span>×</span>
                                            <span>Activity Factor</span>
                                        </div>
                                    </div>

                                    <div className="mx-10 whitespace-nowrap text-gray-500">
                                        <div className="my-2 flex w-[420px] justify-between">
                                            <span>
                                                Sedentary (little or no
                                                exercise)
                                            </span>
                                            <span>1.2</span>
                                        </div>

                                        <div className="my-2 flex w-[420px] justify-between">
                                            <span>
                                                Lightly Active (1–3 days/week)
                                            </span>
                                            <span>1.375</span>
                                        </div>

                                        <div className="my-2 flex w-[420px] justify-between">
                                            <span>
                                                Moderately Active (3–5
                                                days/week)
                                            </span>
                                            <span>1.55</span>
                                        </div>

                                        <div className="my-2 flex w-[420px] justify-between">
                                            <span>
                                                Very Active (6–7 days/week)
                                            </span>
                                            <span>1.725</span>
                                        </div>

                                        <div className="my-2 flex w-[420px] justify-between">
                                            <span>
                                                Extra Active (Athlete / Physical
                                                Job)
                                            </span>
                                            <span>1.9</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>TDEE</div>&nbsp;&nbsp;
                        <div
                            className={`${handleTDEEColor(tdee)} poppins-semibold`}
                        >
                            {tdee}
                        </div>
                    </div>
                </div>
                <div className="flex flex-4 flex-col items-center">
                    <div className="flex w-full flex-wrap place-content-evenly">
                        <Select
                            placeholder="Diet Preferences*"
                            value={dietTypeOptions.find((o) => o.value === dietPreference) ?? null}
                            onChange={(selected) =>
                                setDietPreference(selected?.value ?? selected)
                            }
                            className="my-5 w-[250px]"
                            options={dietTypeOptions}
                        />
                        <Select
                            placeholder="Activity Level*"
                            value={activityLevelOptions.find((o) => o.value === activityLevel) ?? null}
                            onChange={(selected) =>
                                setActivityLevel(selected?.value ?? selected)
                            }
                            className="my-5 w-[250px]"
                            options={activityLevelOptions}
                        />

                        <Select
                            placeholder="Conditions*"
                            isOptionDisabled={() => conditions?.length >= 3}
                            isMulti
                            value={healthConditionOptions.filter((option) =>
                                conditions?.includes(option.value)
                            )}
                            onChange={(selected) => {
                                if (!selected || selected.length <= 3) {
                                    const valuesArray = selected
                                        ? selected.map((option) => option.value)
                                        : [];

                                    setConditions(valuesArray);
                                }
                            }}
                            className="my-5 w-[250px]"
                            options={healthConditionOptions}
                        />
                        <Select
                            placeholder="Gender*"
                            value={genderOptions.find((o) => o.value === gender) ?? null}
                            onChange={(selected) => setGender(selected?.value ?? selected)}
                            className="my-5 w-[250px]"
                            options={genderOptions}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="poppins-semibold hover:border-bg-green-700 my-5 cursor-pointer rounded-xl border-4 bg-green-700 px-4 py-2 text-white hover:bg-white hover:text-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "Submitting…" : "Submit"}
                    </button>
                    {submitError && (
                        <p className="my-2 max-w-md text-sm text-red-600">
                            {submitError}
                        </p>
                    )}
                </div>
                <div className="flex-3">
                    <div className="flex w-full flex-wrap place-content-evenly">
                        <input
                            type="number"
                            step="0.1"
                            min="54.6"
                            max="243.84"
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                            className="my-5 w-[210px] rounded-md border border-gray-300 px-3 py-2 text-center"
                            placeholder="Height (in cm)*"
                        />
                        <input
                            type="number"
                            step="0.1"
                            min="15"
                            max="300"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            className="my-5 w-[210px] rounded-md border border-gray-300 px-3 py-2 text-center"
                            placeholder="Weight (in kg)*"
                        />
                        <input
                            type="number"
                            min="10"
                            max="100"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            className="my-5 w-[210px] rounded-md border border-gray-300 px-3 py-2 text-center"
                            placeholder="Age (10-100)*"
                        />
                        <input
                            type="number"
                            step="0.1"
                            min="3"
                            max="50"
                            value={bodyFatPercentage}
                            onChange={(e) =>
                                setBodyFatPercentage(e.target.value)
                            }
                            className="my-5 w-[210px] rounded-md border border-gray-300 px-3 py-2 text-center"
                            placeholder="Body Fat Percentage"
                        />
                        <input
                            type="number"
                            step="0.1"
                            min="800"
                            max="6000"
                            value={calorieTarget}
                            onChange={(e) => setCalorieTarget(e.target.value)}
                            className="my-5 w-[210px] rounded-md border border-gray-300 px-3 py-2 text-center"
                            placeholder="Calorie Target (in kcal)"
                        />
                        <input
                            type="number"
                            step="0.1"
                            min="30"
                            max="350"
                            value={proteinTarget}
                            onChange={(e) => setProteinTarget(e.target.value)}
                            className="my-5 w-[210px] rounded-md border border-gray-300 px-3 py-2 text-center"
                            placeholder="Protein Target (in gm)"
                        />
                    </div>
                </div>
            </div>

            {recommendationResult && (
                <div className="mt-10 overflow-hidden rounded-2xl bg-gradient-to-b from-slate-50 to-white shadow-lg ring-1 ring-slate-200/60">
                    {/* Header */}
                    <div className="border-b border-slate-200/80 bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-6 text-white">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                                <UtensilsCrossed className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="poppins-semibold text-2xl tracking-tight">
                                    Your Diet Recommendations
                                </h2>
                                <p className="mt-0.5 text-sm text-emerald-100">
                                    Personalized for your profile and goals
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Stats strip */}
                    {recommendationResult.healthProfile && (
                        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-white/50 p-4 sm:grid-cols-4">
                            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                    <Scale className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">BMI</p>
                                    <p className="poppins-semibold text-slate-800">{recommendationResult.healthProfile.bmi}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                                    <Flame className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">TDEE</p>
                                    <p className="poppins-semibold text-slate-800">{recommendationResult.healthProfile.tdee} kcal</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                                    <Target className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Calorie target</p>
                                    <p className="poppins-semibold text-slate-800">
                                        {recommendationResult.healthProfile.calorieTarget ?? recommendationResult.healthProfile.tdee} kcal
                                    </p>
                                </div>
                            </div>
                            {recommendationResult.healthProfile.proteinTarget != null && (
                                <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                                        <UtensilsCrossed className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Protein target</p>
                                        <p className="poppins-semibold text-slate-800">{recommendationResult.healthProfile.proteinTarget}g</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recommendations grid */}
                    <div className="p-6">
                        <h3 className="poppins-semibold mb-4 text-slate-800">Recommended dishes</h3>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {recommendationResult.recommendations?.slice(0, 24).map((item, i) => {
                                const badge = getMealBadge(item.meal_type);
                                const MealIcon = badge.icon;
                                return (
                                    <div
                                        key={i}
                                        className="group relative rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-emerald-200"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="poppins-medium flex-1 text-slate-800 line-clamp-2">
                                                {item["Dish Name"] || item.dishName || "—"}
                                            </p>
                                            <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${badge.color}`}>
                                                <MealIcon className="h-3.5 w-3.5" />
                                                {badge.label}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                                            {item["Calories (kcal)"] != null && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Flame className="h-4 w-4 text-orange-400" />
                                                    {Math.round(item["Calories (kcal)"])} kcal
                                                </span>
                                            )}
                                            {item["Protein (g)"] != null && (
                                                <span>{Math.round(item["Protein (g)"])}g protein</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Meal plan */}
                    {recommendationResult.mealPlan && Object.keys(recommendationResult.mealPlan).length > 0 && (
                        <div className="border-t border-slate-200/80 bg-slate-50/50 p-6">
                            <h3 className="poppins-semibold mb-4 flex items-center gap-2 text-slate-800">
                                <UtensilsCrossed className="h-5 w-5 text-emerald-600" />
                                Your meal plan
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                                {Object.entries(recommendationResult.mealPlan).map(([meal, items]) => {
                                    const config = mealTypeConfig[meal] || { icon: UtensilsCrossed, label: meal, color: "bg-slate-100 text-slate-700 border-slate-200" };
                                    const Icon = config.icon;
                                    const totals = recommendationResult.mealTotals?.[meal];
                                    return (
                                        <div
                                            key={meal}
                                            className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                                        >
                                            <div className={`mb-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${config.color}`}>
                                                <Icon className="h-4 w-4" />
                                                <span className="poppins-medium text-sm capitalize">{config.label}</span>
                                            </div>
                                            <ul className="space-y-2">
                                                {(items || []).slice(0, 5).map((food, j) => (
                                                    <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                                                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                                        <span className="line-clamp-2">{food["Dish Name"] || food.dishName || "—"}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {totals && (
                                                <div className="mt-3 border-t border-slate-100 pt-3 text-xs font-medium text-slate-500">
                                                    {Math.round(totals.calories)} kcal · {Math.round(totals.protein)}g protein
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export default UserPreferencesCollector;
