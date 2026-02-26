import axios from "axios";

const userPreferencesAPI = axios.create({
    baseURL: "/api/v1/userPreferences/",
    withCredentials: true,
});

export { userPreferencesAPI };
