import axios from "axios";

const userLoginAPI = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api/v1/user/` : "/api/v1/user/",
    withCredentials: true,
});

export { userLoginAPI };
