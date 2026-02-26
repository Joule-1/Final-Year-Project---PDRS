import React, { useState, useMemo, useRef, useEffect } from "react";
import Select from "react-select";
import { dietTypeOptions } from "../utils/options/dietType_options";
import { activityLevelOptions } from "../utils/options/activityLevel_options";
import { healthConditionOptions } from "../utils/options/healthCondition_options";
import { genderOptions } from "../utils/options/gender_options";
import { userPreferencesAPI } from "../utils/UserPreferencesAxios";
import { AuthContext } from "../utils/AuthContext";
import VerifyUserLogIn from "../utils/VerifyUserLogIn";

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
        const response = await userPreferencesAPI.put(
            "/registerUserPreferences",
            {
                conditions: conditions,
                dietPreference: dietPreference,
                activityLevel: activityLevel,
                age: age,
                gender: gender,
                height: height,
                weight: weight,
                bodyFatPercentage: bodyFatPercentage,
                calorieTarget: calorieTarget,
                proteinTarget: proteinTarget,
                bmi: String(bmi),
                bmr: String(bmr),
                tdee: String(tdee),
            }
        );
        console.log(response)
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
        if (gender.value == "male") {
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
                            value={dietPreference.value}
                            onChange={(selected) =>
                                setDietPreference(selected.value)
                            }
                            className="my-5 w-[250px]"
                            options={dietTypeOptions}
                        />
                        <Select
                            placeholder="Activity Level*"
                            value={activityLevel.value}
                            onChange={(selected) =>
                                setActivityLevel(selected.value)
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
                            value={gender.value}
                            onChange={(selected) => setGender(selected.value)}
                            className="my-5 w-[250px]"
                            options={genderOptions}
                        />
                    </div>
                    <button
                        onClick={handleSubmit}
                        className="poppins-semibold hover:border-bg-green-700 my-5 cursor-pointer rounded-xl border-4 bg-green-700 px-4 py-2 text-white hover:bg-white hover:text-green-700"
                    >
                        Submit
                    </button>
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
        </section>
    );
};

export default UserPreferencesCollector;
