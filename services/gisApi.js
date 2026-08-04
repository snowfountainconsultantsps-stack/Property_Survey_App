import AsyncStorage from "@react-native-async-storage/async-storage";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL } from "../config";

// Create an API slice for GIS operations
export const gisApi = createApi({
  reducerPath: "gisApi",
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: async (headers, { endpoint }) => {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: (builder) => ({
    // Find polygon by location coordinates
    findPolygonByLocation: builder.query({
      query: ({ lat, lng }) => ({
        url: "/gis/find-polygon",
        method: "GET",
        params: {
          lat,
          lng,
        },
      }),
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useFindPolygonByLocationQuery,
} = gisApi;
