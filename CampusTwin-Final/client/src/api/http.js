import axios from "axios";

export const TOKEN_KEY = "campustwin_token";
export const USER_KEY = "campustwin_user";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Send the saved token with every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the token is rejected (expired or invalid), log the user out
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = (error.config && error.config.url) || "";
    const hadToken = Boolean(localStorage.getItem(TOKEN_KEY));
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/register");

    if (error.response && error.response.status === 401 && hadToken && !isAuthCall) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

// Turns an Axios error into a short message for the screen
export function errorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (error.response && error.response.data && error.response.data.message) {
    return error.response.data.message;
  }
  if (!error.response) {
    return "Cannot reach the server. Check that the backend is running.";
  }
  return fallback;
}

export default http;
