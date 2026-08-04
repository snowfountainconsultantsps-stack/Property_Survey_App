import AsyncStorage from "@react-native-async-storage/async-storage";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { BACKEND_IP, BACKEND_PORT } from "../config";

// Create an API slice for GIS operations
export const gisApi = createApi({
  reducerPath: "gisApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `http://${BACKEND_IP}:${BACKEND_PORT}/api`,
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
