import { createApi } from "@reduxjs/toolkit/query/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKEND_IP, BACKEND_PORT } from "../config";

// Custom base query (not RTK Query's fetchBaseQuery) — this app's photo
// upload needs reliable multipart/form-data handling in React Native, where
// fetchBaseQuery's FormData detection has proven flaky in this codebase
// (see the existing Property_Survey_App/services/surveyApi.js, which hit the
// same issue). Skipping any Content-Type header on FormData bodies lets
// RN's fetch set the multipart boundary itself.
const baseQuery = async (args) => {
  const { url, method = "GET", body } = typeof args === "string" ? { url: args } : args;

  try {
    const token = await AsyncStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };
    let fetchBody = body;

    if (body instanceof FormData) {
      fetchBody = body;
    } else if (body) {
      headers["Content-Type"] = "application/json";
      fetchBody = JSON.stringify(body);
    }

    const response = await fetch(`http://${BACKEND_IP}:${BACKEND_PORT}/api/assets${url}`, {
      method,
      headers,
      body: fetchBody,
    });

    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) return { error: data };
    return { data };
  } catch (error) {
    return { error: { message: error.message } };
  }
};

// ──────────────────────────────────────────────────────────────
// assetSurveyApi — the surveyor-facing slice of the digital-asset system:
// browse every published feature on a map, submit field surveys, attach
// photos, and review your own submission history. Mirrors backend
// /api/assets/*.
// ──────────────────────────────────────────────────────────────
export const assetSurveyApi = createApi({
  reducerPath: "assetSurveyApi",
  baseQuery,
  tagTypes: ["MySurveys", "FeatureSurveys", "FeaturePhotos"],
  endpoints: (builder) => ({
    // Layer list with counts, surveyed counts and extents — no geometry, so
    // it stays a few KB even when the catalog holds tens of thousands of
    // features. Drives the home list and centres the map before any features
    // are loaded.
    getAssetMapMeta: builder.query({
      query: ({ status = "PUBLISHED" } = {}) => `/map?status=${status}&meta_only=1`,
    }),

    // Features for the current viewport only. Fetching a whole city's parcels
    // (8MB+) would hang the WebView bridge, so the map always queries by bbox
    // with a hard cap and warns the user when the result is truncated.
    getAssetMapViewport: builder.query({
      query: ({ status = "PUBLISHED", bbox, limit = 1200 } = {}) =>
        `/map?status=${status}&limit=${limit}${bbox ? `&bbox=${bbox}` : ""}`,
    }),

    getFeatureById: builder.query({
      query: (featureId) => `/features/${featureId}`,
    }),

    // GET /layers/:id/features?status= — one layer's features, for the
    // "map of this layer" step after picking it from the layer list.
    getLayerFeatures: builder.query({
      query: ({ layerId, status = "PUBLISHED" }) => `/layers/${layerId}/features?status=${status}`,
    }),

    getLayerById: builder.query({
      query: (layerId) => `/layers/${layerId}`,
    }),

    // Parcel feature → Polygon bridge. Property parcels live in AssetFeatures,
    // but the property wizard saves into Properties/Surveys keyed on Polygons,
    // so this resolves (creating on first use) the matching Polygon and hands
    // back the polygon_code the wizard needs.
    ensureFeaturePolygon: builder.mutation({
      query: (featureId) => ({
        url: `/features/${featureId}/ensure-polygon`,
        method: "POST",
      }),
    }),

    // Body: { action, proposed_properties?, condition?, notes?, gps_lat?, gps_lng? }
    submitFeatureSurvey: builder.mutation({
      query: ({ featureId, ...body }) => ({
        url: `/features/${featureId}/survey`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["MySurveys", "FeatureSurveys"],
    }),

    getFeatureSurveys: builder.query({
      query: (featureId) => `/features/${featureId}/surveys`,
      providesTags: ["FeatureSurveys"],
    }),

    getMyAssetSurveys: builder.query({
      query: () => "/surveys/my",
      providesTags: ["MySurveys"],
    }),

    // formData: FormData with one or more `photos` file fields.
    addFeaturePhotos: builder.mutation({
      query: ({ featureId, formData }) => ({
        url: `/features/${featureId}/photos`,
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["FeaturePhotos"],
    }),

    getFeaturePhotos: builder.query({
      query: (featureId) => `/features/${featureId}/photos`,
      providesTags: ["FeaturePhotos"],
    }),
  }),
});

export const {
  useGetAssetMapMetaQuery,
  useGetAssetMapViewportQuery,
  useGetFeatureByIdQuery,
  useGetLayerFeaturesQuery,
  useEnsureFeaturePolygonMutation,
  useGetLayerByIdQuery,
  useSubmitFeatureSurveyMutation,
  useGetFeatureSurveysQuery,
  useGetMyAssetSurveysQuery,
  useAddFeaturePhotosMutation,
  useGetFeaturePhotosQuery,
} = assetSurveyApi;
