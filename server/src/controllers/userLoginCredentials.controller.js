import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { UserLogin } from "../models/userLoginCredentials.model.js";
import validator from "validator";
import jwt from "jsonwebtoken";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
};

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await UserLogin.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save();

        return {
            accessToken,
            refreshToken,
        };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generation refresh and access token"
        );
    }
};

const registerUser = asyncHandler(async (req, res) => {
    let { name, email, password, avatarURL } = req.body;
    name = name?.trim();
    email = email?.trim();
    password = password?.trim();
    avatarURL = avatarURL?.trim();

    if ([name, email, password, avatarURL].some((field) => !field)) {
        throw new ApiError(400, "All fields are required");
    }

    const normalizedEmail = validator.normalizeEmail(email, { gmail_lowercase: true }) || email.toLowerCase();
    const existedUser = await UserLogin.findOne({ email: normalizedEmail });

    if (existedUser)
        throw new ApiError(
            409,
            "UserLogin with email or username already exists"
        );

    const user = await UserLogin.create({
        name,
        email: normalizedEmail,
        password,
        avatarURL,
    });

    if (!user) throw new ApiError(500, "UserLogin is not being created");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id
    );

    const createdUser = await UserLogin.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser)
        throw new ApiError(
            500,
            "Something went wrong while registering the user"
        );

    return res
        .status(201)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                201,
                createdUser,
                "UserLogin Registered Successfully"
            )
        );
});

const loginUser = asyncHandler(async (req, res) => {
    let { email, username, password } = req.body;
    email = email?.trim();
    username = username?.trim();
    password = password?.trim();

    if (!username && !email)
        throw new ApiError(400, "Username or Email is required");

    const normalizedEmail = email ? (validator.normalizeEmail(email, { gmail_lowercase: true }) || email.toLowerCase()) : undefined;
    const query = [];
    if (username) query.push({ username });
    if (normalizedEmail !== undefined) query.push({ email: normalizedEmail });
    if (query.length === 0) throw new ApiError(400, "Username or Email is required");

    const user = await UserLogin.findOne({ $or: query });

    if (!user) throw new ApiError(400, "UserLogin doesn't exist");

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid)
        throw new ApiError(401, "Invalid UserLogin Credentials");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id
    );

    const loggedInUser = await UserLogin.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!loggedInUser)
        throw new ApiError(
            500,
            "Something went wrong while logging in the user"
        );

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                loggedInUser,
                "UserLogin logged in successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await UserLogin.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1,
            },
        },
        {
            new: true,
        }
    );

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "UserLogin Logged Out"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.user,
                "Current UserLogin Fetched Successfully"
            )
        );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken;

    if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized Request");

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await UserLogin.findById(decodedToken?._id);

        if (!user) throw new ApiError(401, "Invalid Refresh Token");

        if (incomingRefreshToken !== user?.refreshToken)
            throw new ApiError(401, "Refresh Token is expired or used");

        const { accessToken, refreshToken } =
            await generateAccessAndRefreshTokens(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json(new ApiResponse(200, {}, "Access Token Refreshed"));
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token");
    }
});

export {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    refreshAccessToken,
};
