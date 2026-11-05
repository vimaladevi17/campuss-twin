import { createContext, useContext, useState } from "react";
import { TOKEN_KEY, USER_KEY } from "../api/http";

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw && localStorage.getItem(TOKEN_KEY) ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export function roleHome(role) {
  if (role === "admin") return "/admin-dashboard";
  if (role === "faculty") return "/faculty-dashboard";
  return "/student-dashboard";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  const login = (token, userData) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
