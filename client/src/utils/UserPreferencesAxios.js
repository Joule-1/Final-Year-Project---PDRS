import axios from "axios";

const userPreferencesAPI = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api/v1/userPreferences/` : "/api/v1/userPreferences/",
    withCredentials: true,
});

export { userPreferencesAPI };
