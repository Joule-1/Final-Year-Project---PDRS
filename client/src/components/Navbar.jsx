import { useState, useEffect, useContext } from "react";
import React from "react";
import { Logo } from "../assets";
import { Link } from "react-scroll";
import { userLoginAPI } from "../utils/UserLoginAxios.js";
import { AuthContext } from "../utils/AuthContext.jsx";
import { useLocation } from "react-router-dom";

const Navbar = () => {
    const { user, setUser } = useContext(AuthContext);
    const [menuOpen, setMenuOpen] = useState(false);

    const currentUserName = user?.data?.name;
    const currentUserAvatar = user?.data?.avatarURL;

    const handleLogout = async () => {
        try {
            await userLoginAPI.get("/logout");
            setUser(null);
            location.pathname === "/";
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    // Close menu on route change
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    return (
        <section className="z-50 w-full bg-white shadow-lg">
            {/* Top bar */}
            <div className="flex h-15 w-full items-center justify-between px-5 text-sm">
                {/* Logo */}
                <a className="flex items-center" href="/">
                    <div className="w-10 hover:scale-105">
                        <img src={Logo} className="w-full" />
                    </div>
                    <span
                        className="poppins-semibold ml-2 text-xl"
                        title="Personalised Diet Recommendation System"
                    >
                        PDRS
                    </span>
                </a>

                {/* Desktop nav links */}
                <div className="poppins-semibold hidden items-center md:flex">
                    <span
                        className={`mx-5 cursor-pointer hover:text-[#0084cc] ${location.pathname === "/privacy" ? "text-[#0084cc]" : ""}`}
                    >
                        <a href="/privacy">Privacy</a>
                    </span>
                    <span
                        className={`mx-5 cursor-pointer hover:text-[#0084cc] ${location.pathname === "/tos" ? "text-[#0084cc]" : ""}`}
                    >
                        <a href="/tos">Terms of Service</a>
                    </span>
                    {location.pathname === "/" ? (
                        <Link
                            to="pricings"
                            id="pricings"
                            offset={-40}
                            smooth={true}
                            duration={500}
                            className="mx-5 cursor-pointer hover:text-[#0084cc]"
                        >
                            Pricing
                        </Link>
                    ) : (
                        <a
                            className={`mx-5 cursor-pointer hover:text-[#0084cc] ${location.pathname === "/pricing" ? "text-[#0084cc]" : ""}`}
                            href="/pricing"
                        >
                            Pricing
                        </a>
                    )}
                    {location.pathname === "/" ? (
                        <Link
                            to="testimonials"
                            id="testimonials"
                            offset={-40}
                            smooth={true}
                            duration={500}
                            className="mx-5 cursor-pointer hover:text-[#0084cc]"
                        >
                            Testimonials
                        </Link>
                    ) : (
                        <a
                            className={`${location.pathname === "/testimonials" ? "text-[#0084cc]" : ""} mx-5 cursor-pointer hover:text-[#0084cc]`}
                            href="/testimonials"
                        >
                            Testimonials
                        </a>
                    )}
                </div>

                {/* Desktop right-side auth */}
                <div className="hidden md:flex items-center">
                    {!currentUserName &&
                        !currentUserAvatar &&
                        location.pathname === "/" && (
                            <div className="flex items-center">
                                <a
                                    href="/signin"
                                    id="NavbarHomeSign"
                                    className="ml-5 cursor-pointer hover:text-[#0084cc]"
                                >
                                    <span>Sign In</span>
                                </a>
                                <a
                                    href="/signup"
                                    id="NavbarHomeSign"
                                    className="poppins-semibold ml-2 cursor-pointer rounded-xl border border-2 bg-[#0084cc] p-2 text-white hover:border-[#0084cc] hover:bg-white hover:text-[#0084cc]"
                                >
                                    <span>Sign Up</span>
                                </a>
                            </div>
                        )}

                    {location.pathname === "/signin" && !user && (
                        <a className="text-xs" href="/signup">
                            <span className="mr-2 text-gray-500">
                                Don't have an account?
                            </span>
                            <span className="poppins-semibold cursor-pointer rounded-xl border-2 bg-[#0084cc] p-2 text-white hover:border-[#0084cc] hover:bg-white hover:text-[#0084cc]">
                                Sign Up
                            </span>
                        </a>
                    )}
                    {location.pathname === "/signup" && !user && (
                        <a className="text-xs" href="/signin">
                            <span className="text-gray-500">
                                Already have an account?
                            </span>
                            <span className="poppins-semibold ml-2 cursor-pointer rounded-xl border-2 bg-[#0084cc] p-2 text-white hover:border-[#0084cc] hover:bg-white hover:text-[#0084cc]">
                                Sign In
                            </span>
                        </a>
                    )}
                    {currentUserName && currentUserAvatar && (
                        <div className="flex items-center">
                            <img
                                src={currentUserAvatar}
                                className="h-8 w-8 rounded-full"
                            />
                            <span className="poppins-semibold ml-2">
                                {currentUserName}
                            </span>
                            <span
                                id="NavbarHomeSign"
                                className="poppins-semibold ml-2 cursor-pointer rounded-xl border border-2 bg-red-600 p-2 text-white hover:border-red-600 hover:bg-white hover:text-red-600 sm:ml-5"
                            >
                                <div onClick={handleLogout}>Sign Off</div>
                            </span>
                        </div>
                    )}
                </div>

                {/* Hamburger button (mobile only) */}
                <button
                    className="flex flex-col justify-center items-center gap-[5px] md:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    aria-label="Toggle menu"
                >
                    <span
                        className={`block h-0.5 w-6 bg-gray-700 transition-all duration-300 ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`}
                    />
                    <span
                        className={`block h-0.5 w-6 bg-gray-700 transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`}
                    />
                    <span
                        className={`block h-0.5 w-6 bg-gray-700 transition-all duration-300 ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`}
                    />
                </button>
            </div>

            {/* Mobile dropdown menu */}
            {menuOpen && (
                <div className="poppins-semibold flex flex-col gap-1 border-t border-gray-100 bg-white px-5 py-4 text-sm md:hidden">
                    <a
                        href="/privacy"
                        className={`py-2 cursor-pointer hover:text-[#0084cc] ${location.pathname === "/privacy" ? "text-[#0084cc]" : ""}`}
                        onClick={() => setMenuOpen(false)}
                    >
                        Privacy
                    </a>
                    <a
                        href="/tos"
                        className={`py-2 cursor-pointer hover:text-[#0084cc] ${location.pathname === "/tos" ? "text-[#0084cc]" : ""}`}
                        onClick={() => setMenuOpen(false)}
                    >
                        Terms of Service
                    </a>
                    {location.pathname === "/" ? (
                        <Link
                            to="pricings"
                            offset={-40}
                            smooth={true}
                            duration={500}
                            className="py-2 cursor-pointer hover:text-[#0084cc]"
                            onClick={() => setMenuOpen(false)}
                        >
                            Pricing
                        </Link>
                    ) : (
                        <a
                            href="/pricing"
                            className={`py-2 cursor-pointer hover:text-[#0084cc] ${location.pathname === "/pricing" ? "text-[#0084cc]" : ""}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            Pricing
                        </a>
                    )}
                    {location.pathname === "/" ? (
                        <Link
                            to="testimonials"
                            offset={-40}
                            smooth={true}
                            duration={500}
                            className="py-2 cursor-pointer hover:text-[#0084cc]"
                            onClick={() => setMenuOpen(false)}
                        >
                            Testimonials
                        </Link>
                    ) : (
                        <a
                            href="/testimonials"
                            className={`py-2 cursor-pointer hover:text-[#0084cc] ${location.pathname === "/testimonials" ? "text-[#0084cc]" : ""}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            Testimonials
                        </a>
                    )}

                    {/* Mobile auth section */}
                    <div className="mt-2 border-t border-gray-100 pt-3">
                        {!currentUserName &&
                            !currentUserAvatar &&
                            location.pathname === "/" && (
                                <div className="flex gap-3">
                                    <a
                                        href="/signin"
                                        className="cursor-pointer hover:text-[#0084cc]"
                                    >
                                        Sign In
                                    </a>
                                    <a
                                        href="/signup"
                                        className="poppins-semibold cursor-pointer rounded-xl border-2 bg-[#0084cc] px-3 py-1.5 text-white hover:border-[#0084cc] hover:bg-white hover:text-[#0084cc]"
                                    >
                                        Sign Up
                                    </a>
                                </div>
                            )}
                        {location.pathname === "/signin" && !user && (
                            <a href="/signup" className="text-xs">
                                <span className="mr-2 text-gray-500">
                                    Don't have an account?
                                </span>
                                <span className="poppins-semibold cursor-pointer rounded-xl border-2 bg-[#0084cc] p-2 text-white hover:border-[#0084cc] hover:bg-white hover:text-[#0084cc]">
                                    Sign Up
                                </span>
                            </a>
                        )}
                        {location.pathname === "/signup" && !user && (
                            <a href="/signin" className="text-xs">
                                <span className="text-gray-500">
                                    Already have an account?
                                </span>
                                <span className="poppins-semibold ml-2 cursor-pointer rounded-xl border-2 bg-[#0084cc] p-2 text-white hover:border-[#0084cc] hover:bg-white hover:text-[#0084cc]">
                                    Sign In
                                </span>
                            </a>
                        )}
                        {currentUserName && currentUserAvatar && (
                            <div className="flex items-center gap-3">
                                <img
                                    src={currentUserAvatar}
                                    className="h-8 w-8 rounded-full"
                                />
                                <span className="poppins-semibold">
                                    {currentUserName}
                                </span>
                                <span className="poppins-semibold cursor-pointer rounded-xl border-2 bg-red-600 px-3 py-1.5 text-white hover:border-red-600 hover:bg-white hover:text-red-600">
                                    <div onClick={handleLogout}>Sign Off</div>
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};

export default Navbar;
