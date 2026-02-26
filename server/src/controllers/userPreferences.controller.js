import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { UserPreferences } from "../models/userPreferences.model.js";
// import { runPersonalization } from "../services/personalization.service.js";

const upsertUserPreferences = asyncHandler(async (req, res) => {
    if (!req.body) throw new ApiError(400, "Empty Request");

    const {
        conditions,
        dietPreference,
        activityLevel,
        age,
        gender,
        height,
        weight,
    } = req.body;

    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
        throw new ApiError(400, "At least one condition is required");
    }

    if (typeof dietPreference !== "string" || dietPreference.trim() === "") {
        throw new ApiError(400, "Diet Preference is required");
    }

    const savedPreferences = await UserPreferences.findOneAndUpdate(
        { user: req.user._id },
        {
            conditions,
            dietPreference,
            activityLevel,
            age,
            gender,
            height,
            weight,
        },
        {
            new: true,
            upsert: true,
            runValidators: true,
        }
    );

    if (!savedPreferences) {
        throw new ApiError(500, "Unable to save user preferences");
    }

    // const personalizationResult = await runPersonalization(savedPreferences);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {preferences: savedPreferences},
                // ...personalizationResult},
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
