import { createContext, useContext, ReactNode, useState } from "react";
import { api } from "@/services/api";

import { getAceessToken, getUserFromLoacalStorage } from "@/lib/utils";
import { LoginApiResponse, LoginCred, UserDetail } from "@/types";


interface AuthContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
  login: (credentials: LoginCred) => Promise<any>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
  user: UserDetail | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    getAceessToken() !== null
  );
  const [user, setUser] = useState<UserDetail | null>(getUserFromLoacalStorage());

  const handleLoginSuccess = (data: LoginApiResponse) => {
    const { access, user } = data.data;
    localStorage.setItem("accessToken", access);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    setIsAuthenticated(true);
  };

  const login = async (credentials: LoginCred) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.post('/login/', credentials, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
/*      const response:LoginApiResponse = {
        data: {
          access: "1234",
          refresh: "23455",
          user: {
            full_name: "test user",
            email: "test@test.com"
          }
        }
      }*/
      handleLoginSuccess(response);
    } catch (err) {
      console.log(err);
      const errorMessage = err.response?.data?.message || 'An error occurred during login';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        login,
        logout,
        isLoading,
        error,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
