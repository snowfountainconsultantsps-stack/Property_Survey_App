import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config";

// ──────────────────────────────────────────────────────────────
// assignmentApi — what this surveyor has been allocated: which project,
// which area inside it, and which asset type they're meant to survey.
// The backend enforces the same scope on every data endpoint, so this is
// for showing the surveyor their remit, not for gating anything client-side.
// ──────────────────────────────────────────────────────────────
export const assignmentApi = createApi({
  reducerPath: "assignmentApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/assignments`,
    prepareHeaders: async (headers) => {
      const token = await AsyncStorage.getItem("token");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["MyAllocation"],
  endpoints: (builder) => ({
    getMyAllocation: builder.query({
      query: () => "/me",
      transformResponse: (r) => r.data,
      providesTags: ["MyAllocation"],
    }),
  }),
});

export const { useGetMyAllocationQuery } = assignmentApi;
