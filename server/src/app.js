import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middlewares/errorHandler.middlewares.js";

const app = express();

app.get("/", (req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use(
    cors({
        origin: function (origin, callback) {
            const allowed = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim());
            if (!origin || allowed.includes(origin) || allowed.includes("*")) {
                callback(null, true);
            } else {
                callback(null, true);
            }
        },
        credentials: true,
    })
);

app.use(express.static("public"));
app.use(cookieParser());
app.use(
    express.json({
        limit: "16kb",
        strict: true,
    })
);
app.use(
    express.urlencoded({
        extended: true,
        limit: "16kb",
    })
);

import userLoginRouter from "./routes/userLoginCredentials.route.js";
import userPreferencesRouter from "./routes/userPreferences.route.js";

app.use("/api/v1/user", userLoginRouter);
app.use("/api/v1/userPreferences", userPreferencesRouter);

app.use(errorHandler);

export { app };