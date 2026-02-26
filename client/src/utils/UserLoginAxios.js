import axios from "axios";

const userLoginAPI = axios.create({
    baseURL: "/api/v1/user/",
    withCredentials: true,
});

export { userLoginAPI };
