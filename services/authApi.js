import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKEND_IP, BACKEND_PORT } from "../config";

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `http://${BACKEND_IP}:${BACKEND_PORT}/api`,
    prepareHeaders: async (headers) => {
      const token = await AsyncStorage.getItem("token");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
    logout: builder.mutation({
      query: () => ({ url: "/auth/logout", method: "POST" }),
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation } = authApi;
