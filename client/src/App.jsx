import "./App.css";
import React, { useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./components/LandingPage/Home.jsx";
import SignIn from "./components/SignIn.jsx";
import SignUp from "./components/SignUp.jsx";
import Privacy from "./components/LandingPage/Privacy.jsx";
import TermsOfService from "./components/LandingPage/TermsOfService.jsx";
import NotFound from "./components/NotFound.jsx";
import DynamicTitle from "./utils/DynamicTitle.jsx";
import UserPreferencesCollector from "./components/UserPreferencesCollector.jsx";
import Navbar from "./components/Navbar.jsx";
import Pricings from "./components/LandingPage/Pricings.jsx";
import Testimonials from "./components/LandingPage/Testimonials.jsx";
import { AuthContext } from "./utils/AuthContext.jsx";
import VerifyUserLogIn from "./utils/VerifyUserLogIn.jsx";

const AppWrapper = () => {
    const { user } = useContext(AuthContext);
    return (
        <>
            <Navbar />
            <DynamicTitle />
            <Routes>
                {/* ✅ Each path is unique */}
                <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Home />} />
                <Route path="/signin" element={user ? <Navigate to="/dashboard" replace /> : <SignIn />} />
                <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <SignUp />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/pricing" element={<Pricings />} />
                <Route path="/testimonials" element={<Testimonials />} />
                <Route path="/tos" element={<TermsOfService />} />
                <Route element={<VerifyUserLogIn />}>
                    <Route path="/dashboard" element={<UserPreferencesCollector />} />
                </Route>
                <Route path="*" element={<NotFound />} />
            </Routes>
        </>
    );
};

function App() {
    return (
        <BrowserRouter>
            <AppWrapper />
        </BrowserRouter>
    );
}
export default App;
