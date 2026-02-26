import React, { useState, useRef, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../assets";
import { userLoginAPI } from "../utils/UserLoginAxios.js";
import { userPreferencesAPI } from "../utils/UserPreferencesAxios.js";
import { AuthContext } from "../utils/AuthContext.jsx";

function SignIn() {
    const { user, setUser } = useContext(AuthContext);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({
        email: "",
        password: "",
    });
    const navigate = useNavigate();

    const emailRef = useRef(null);
    const passwordRef = useRef(null);

    const togglePassword = () => {
        setShowPassword((prev) => !prev);
    };

    const navigateToHomePage = () => {
        navigate("/");
    };

    // Client-side validation function
    const validateForm = () => {
        const email = emailRef.current.value.trim();
        const password = passwordRef.current.value.trim();
        const errors = { email: "", password: "" };
        let isValid = true;
        // Email validation
        if (!email) {
            errors.email = "Email is required";
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.email = "Please enter a valid email address";
            isValid = false;
        }
        // Password validation
        if (!password) {
            errors.password = "Password is required";
            isValid = false;
        } else if (password.length < 6) {
            errors.password = "Password must be at least 6 characters long";
            isValid = false;
        }
        setFieldErrors(errors);
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setFieldErrors({ email: "", password: "" });

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            const response = await userLoginAPI.post("/login", {
                email: emailRef.current.value.trim(),
                password: passwordRef.current.value.trim(),
            });

            if (response.data.success) {
                const checkUserPreferences = await userPreferencesAPI.get(
                    "/getCurrentPreferences"
                );
                console.log(checkUserPreferences.data.data);
                console.log(response.data);
                setUser(response.data);
                navigate("/dashboard");
            } else {
                setError(res.data.message || "Login failed. Please try again.");
            }
        } catch (error) {
            console.error("Login error:", error);

            // Handle different types of errors
            if (error.response) {
                // Server responded with error status
                const errorMessage =
                    error.response.data?.message || error.response.data?.error;

                if (
                    error.response.status === 404 ||
                    errorMessage?.toLowerCase().includes("doesn't exist") ||
                    errorMessage?.toLowerCase().includes("not found")
                ) {
                    setError(
                        "User doesn't exist. Please check your email or register first."
                    );
                } else if (
                    error.response.status === 401 ||
                    errorMessage?.toLowerCase().includes("password") ||
                    errorMessage?.toLowerCase().includes("incorrect")
                ) {
                    setError("Incorrect password. Please try again.");
                } else if (error.response.status === 400) {
                    setError(
                        errorMessage ||
                            "Invalid credentials. Please check your email and password."
                    );
                } else if (error.response.status >= 500) {
                    setError("Server error. Please try again later.");
                } else {
                    setError(errorMessage || "Login failed. Please try again.");
                }
            } else if (error.request) {
                // Network error
                setError(
                    "Network error. Please check your internet connection and try again."
                );
            } else {
                // Other errors
                setError("An unexpected error occurred. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    // Clear errors when user starts typing
    const handleInputChange = (field) => {
        if (fieldErrors[field]) {
            setFieldErrors((prev) => ({ ...prev, [field]: "" }));
        }
        if (error) {
            setError("");
        }
    };

    return (
        <section className="">
            <div id="root" className="">
                {" "}
                <section
                    id="login-form"
                    className="relative mx-auto mt-10 w-full max-w-md"
                >
                    <div className="relative z-10 rounded-3xl border border-[#0084cc] bg-white p-8 shadow-lg transition-all duration-500 hover:shadow-xl">
                        <div className="mb-5 text-center">
                            <div
                                onClick={navigateToHomePage}
                                className="mx-auto mb-2 h-16 w-16"
                            >
                                <img src={Logo} />
                            </div>
                            <h1
                                onClick={navigateToHomePage}
                                className="font-inter cursor-pointer text-2xl font-bold text-gray-900"
                            >
                                PDRS
                            </h1>
                            <p className="mt-1 text-sm text-gray-600">
                                Welcome back to your workspace
                            </p>
                        </div>

                        {/* Global Error Message */}
                        {error && (
                            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
                                <div className="flex items-center">
                                    <svg
                                        className="mr-2 h-5 w-5 text-red-500"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    <p className="text-sm text-red-700">
                                        {error}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Login Form */}
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {/* Email Input */}
                            <div className="transition-transform duration-300">
                                <label
                                    htmlFor="email"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Email Address
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        id="email"
                                        autoFocus
                                        autoComplete="email"
                                        name="email"
                                        ref={emailRef}
                                        onChange={() =>
                                            handleInputChange("email")
                                        }
                                        className={`w-full rounded-2xl border bg-gray-50 px-4 py-3 text-sm transition-all duration-300 outline-none focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#0084cc] ${
                                            fieldErrors.email
                                                ? "border-red-300 bg-red-50"
                                                : "border-gray-200"
                                        }`}
                                        placeholder="Enter your email"
                                    />
                                    <svg
                                        className="absolute top-3.5 right-3 h-5 w-5 text-gray-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                                        />
                                    </svg>
                                </div>
                                {fieldErrors.email && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {fieldErrors.email}
                                    </p>
                                )}
                            </div>

                            {/* Password Input */}
                            <div className="transition-transform duration-300">
                                <label
                                    htmlFor="password"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        id="password"
                                        name="password"
                                        autoComplete="current-password"
                                        ref={passwordRef}
                                        onChange={() =>
                                            handleInputChange("password")
                                        }
                                        className={`w-full rounded-2xl border bg-gray-50 px-4 py-3 pr-12 text-sm transition-all duration-300 outline-none focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#0084cc] ${
                                            fieldErrors.password
                                                ? "border-red-300 bg-red-50"
                                                : "border-gray-200"
                                        }`}
                                        placeholder="Enter your password"
                                    />
                                    <button
                                        type="button"
                                        className="absolute top-3.5 right-3 text-gray-400 hover:text-gray-600"
                                        onClick={togglePassword}
                                    >
                                        {showPassword ? (
                                            <svg
                                                className="h-5 w-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                                                />
                                            </svg>
                                        ) : (
                                            <svg
                                                className="h-5 w-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {fieldErrors.password && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {fieldErrors.password}
                                    </p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="w-full transform rounded-2xl bg-[#0084cc] bg-gradient-to-r px-4 py-3 font-medium text-white transition-all duration-300 hover:cursor-pointer hover:bg-[#0084cc] focus:ring-4 focus:ring-[#0084cc] active:scale-95 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center">
                                        <svg
                                            className="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        Signing in...
                                    </div>
                                ) : (
                                    "Sign In to SprintSync"
                                )}
                            </button>
                        </form>

                        {/* Register Link */}
                        <div className="mt-8 border-t border-gray-100 pt-6 text-center">
                            <p className="text-sm text-gray-600">
                                New here?
                                <Link
                                    to={"/signup"}
                                    className="font-medium text-[#0084cc] transition-colors duration-200 hover:text-[#005f99]"
                                >
                                    {" "}
                                    Register Now
                                </Link>
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </section>
    );
}

export default SignIn;
