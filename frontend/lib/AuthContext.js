"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const autoLogin = async () => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: "darwin@darwin.com",
          password: "12345678",
        });

        if (error) {
          console.error("Auto-login failed:", error);
        } else {
          setUser(data.user);
        }
      } catch (err) {
        console.error("Auto-login error:", err);
      } finally {
        setLoading(false);
      }
    };

    autoLogin();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
