import { createSlice } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";

const initialState = {
  user: null,
  token: null,
  role: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.role = action.payload.user?.role || null;
      AsyncStorage.setItem("token", action.payload.token);
      AsyncStorage.setItem("role", action.payload.user?.role);
      AsyncStorage.setItem("user", JSON.stringify(action.payload.user));
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.role = null;
      AsyncStorage.removeItem("token");
      AsyncStorage.removeItem("role");
      AsyncStorage.removeItem("user");
    },
  },
});

export const { setUser, clearAuth } = authSlice.actions;

export default authSlice.reducer;
