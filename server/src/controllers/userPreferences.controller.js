import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { UserPreferences } from "../models/userPreferences.model.js";
import { callMLRecommendations } from "../services/personalization.service.js";

const upsertUserPreferences = asyncHandler(async (req, res) => {
    if (!req.body) throw new ApiError(400, "Empty Request");

    const dietVal = req.body.dietPreference?.value ?? req.body.dietPreference;
    const activityVal = req.body.activityLevel?.value ?? req.body.activityLevel;
    const genderVal = req.body.gender?.value ?? req.body.gender;

    const {
        conditions,
        age,
        height,
        weight,
        bodyFatPercentage,
        calorieTarget,
        proteinTarget,
        bmi,
        bmr,
        tdee,
    } = req.body;

    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
        throw new ApiError(400, "At least one condition is required");
    }

    const dietPreference = typeof dietVal === "string" ? dietVal.trim() : "";
    if (!dietPreference) {
        throw new ApiError(400, "Diet Preference is required");
    }

    const update = {
        conditions,
        dietPreference,
        activityLevel: activityVal || req.body.activityLevel,
        age,
        gender: genderVal || req.body.gender,
        height,
        weight,
        bodyFatPercentage,
        calorieTarget,
        proteinTarget,
        bmi,
        bmr,
        tdee,
    };
    // remove undefined so we don't overwrite with undefined
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const savedPreferences = await UserPreferences.findOneAndUpdate(
        { user: req.user._id },
        update,
        {
            new: true,
            upsert: true,
            runValidators: true,
        }
    );

    if (!savedPreferences) {
        throw new ApiError(500, "Unable to save user preferences");
    }

    let recommendationsPayload = null;
    try {
        recommendationsPayload = await callMLRecommendations(savedPreferences);
    } catch (err) {
        console.warn("ML recommendations failed:", err.message);
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                preferences: savedPreferences,
                ...(recommendationsPayload && {
                    recommendations: recommendationsPayload.recommendations,
                    mealPlan: recommendationsPayload.mealPlan,
                    mealTotals: recommendationsPayload.mealTotals,
                    totals: recommendationsPayload.totals,
                    healthProfile: recommendationsPayload.healthProfile,
                }),
            },
            "User Preferences Saved Successfully"
        )
    );
});

const getCurrentPreferences = asyncHandler(async (req, res) => {
    const currentPreferences = await UserPreferences.findOne({
        user: req.user._id,
    });

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                currentPreferences,
                currentPreferences
                    ? "Current Preferences Fetched Successfully"
                    : "No User Preferences Registered"
            )
        );
});

export { upsertUserPreferences, getCurrentPreferences };
