import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { clearAuth, setUser } from "../store/authSlice";

export default function useAuth() {
  const { token, role } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        let storedToken = token;
        let storedRole = role;

        if (!storedToken || !storedRole) {
          storedToken = await AsyncStorage.getItem("token");
          storedRole = await AsyncStorage.getItem("role");
        }

        const storedUserJson = await AsyncStorage.getItem("user");
        const storedUser = storedUserJson ? JSON.parse(storedUserJson) : null;

        if (!storedToken || !storedRole) {
          dispatch(clearAuth());
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        let decoded;
        try {
          decoded = jwtDecode(storedToken);
        } catch {
          dispatch(clearAuth());
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        const currentTime = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < currentTime) {
          dispatch(clearAuth());
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        if (!token || !role) {
          dispatch(setUser({ user: storedUser || { role: storedRole }, token: storedToken }));
        }

        setIsAuthenticated(true);
        setLoading(false);
      } catch (err) {
        console.log("Auth check error:", err);
        dispatch(clearAuth());
        setIsAuthenticated(false);
        setLoading(false);
      }
    };

    checkAuth();
  }, [token, role, dispatch]);

  return { loading, isAuthenticated, role };
}
