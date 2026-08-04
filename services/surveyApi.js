import { API_BASE_URL } from "@/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createApi } from "@reduxjs/toolkit/query/react";

// Custom base query for handling FormData uploads in React Native
const baseQuery = async (args, api, extraOptions) => {
  // Handle both string and object args
  const {
    url,
    method = "GET",
    body,
    ...rest
  } = typeof args === "string" ? { url: args } : args;

  try {
    const token = await AsyncStorage.getItem("token");

    let fetchBody = body;
    let headers = {
      Authorization: `Bearer ${token}`,
    };

    // Handle FormData - DO NOT set any Content-Type header
    // React Native fetch will automatically set multipart/form-data with boundary
    if (body instanceof FormData) {
      // console.log("📤 Sending FormData request (FormData detected)");
      fetchBody = body;
      // DO NOT SET Content-Type - let fetch handle it automatically
    } else if (body) {
      // console.log("📤 Sending JSON request");
      headers["Content-Type"] = "application/json";
      fetchBody = JSON.stringify(body);
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    // console.log(`Request: ${method} ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method,
      headers,
      body: fetchBody,
    });

    // console.log("Response status:", response.status);

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

    if (!response.ok) {
      console.error("❌ Response error:", response.status, data);
      return { error: data };
    }

    // console.log("✅ Request successful");
    return { data };
  } catch (error) {
    console.error("❌ Fetch error:", error);
    return { error: { message: error.message } };
  }
};

export const surveyApi = createApi({
  reducerPath: "surveyApi",
  baseQuery,
  // Granular tags on purpose.
  //
  // Previously every wizard mutation invalidated a single broad "Surveys" tag
  // that six queries provided, so each "Save & Next" refetched the whole survey
  // AND the 500-row surveyor list — several redundant round trips per tap, and
  // the refetch was also clobbering in-progress form state. The per-step
  // mutations below now invalidate nothing: the wizard already holds that state
  // locally and re-reads the survey only when it mounts. Only survey lifecycle
  // events (create / submit / delete) refresh the list, and photo mutations
  // refresh just their own photo query.
  tagTypes: ["Surveys", "SurveyList", "PropertyPhotos", "UnitPhotos"],
  endpoints: (builder) => ({
    // Create survey (handles both residential and commercial)
    createSurvey: builder.mutation({
      query: (formData) => {
        // console.log("🎬 createSurvey mutation called");
        // console.log("Body is FormData:", formData instanceof FormData);
        return {
          url: "/surveys",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["SurveyList"],
    }),

    // Get all surveys for a surveyor with pagination and filters
    getSurveyorSurveys: builder.query({
      query: ({ surveyorId, limit = 30, offset = 0, status }) => {
        const params = new URLSearchParams();
        params.append("limit", limit);
        params.append("offset", offset);
        if (status) params.append("status", status);
        return `/surveys/surveyor/${surveyorId}?${params.toString()}`;
      },
      transformResponse: (response) => ({
        surveys: response.data,
        total: response.total,
      }),
      providesTags: ["SurveyList"],
      refetchOnMountOrArgChange: true,
    }),

    // Get today's surveys for a surveyor
    getSurveyorTodaysSurveys: builder.query({
      query: ({ surveyorId, limit = 999, offset = 0, status }) => {
        const params = new URLSearchParams();
        params.append("limit", limit);
        params.append("offset", offset);
        if (status) params.append("status", status);
        return `/surveys/surveyor/${surveyorId}/today?${params.toString()}`;
      },
      transformResponse: (response) => ({
        surveys: response.data,
        total: response.total,
      }),
      providesTags: ["SurveyList"],
      refetchOnMountOrArgChange: true,
    }),

    // Get today's surveys for admin (all surveys)
    getAdminTodaysSurveys: builder.query({
      query: ({ limit = 999, offset = 0, status } = {}) => {
        const params = new URLSearchParams();
        params.append("limit", String(limit));
        params.append("offset", String(offset));

        if (status && status.trim() !== "") {
          params.append("status", status);
        }
        const qs = params.toString();
        return qs ? `/surveys/today?${qs}` : `/surveys/today`;
      },
      transformResponse: (response) => ({
        surveys: response.data,
        total: response.total,
      }),
      providesTags: ["SurveyList"],
      refetchOnMountOrArgChange: true,
    }),

    // Get single survey by ID
    getSurvey: builder.query({
      //query: (surveyId) => `/surveys/${surveyId}`,
      query: (surveyId) => {
        return `/surveys/${surveyId}`;
      },
      transformResponse: (response) => response?.data ?? response,
      providesTags: (r, e, surveyId) => [{ type: "Surveys", id: surveyId }],
      refetchOnMountOrArgChange: true,
    }),

    // Update survey
    updateSurvey: builder.mutation({
      query: ({ surveyId, formData }) => ({
        url: `/surveys/${surveyId}`,
        method: "PUT",
        body: formData,
      }),
      invalidatesTags: ["SurveyList"],
    }),

    // Delete survey
    deleteSurvey: builder.mutation({
      query: (surveyId) => ({
        url: `/surveys/${surveyId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SurveyList"],
    }),

    // Find polygon by coordinates
    findPolygon: builder.query({
      query: ({ lat, lng }) => `/gis/find-polygon?lat=${lat}&lng=${lng}`,
    }),

    deleteSurveyImage: builder.mutation({
      query: ({ imageId }) => ({
        url: `/surveys/image/${imageId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["PropertyPhotos"],
    }),

    // ========================================================================
    // MULTI-STEP SURVEY API - For Field Surveyor Workflow
    // ========================================================================

    // Step 1: Create draft survey
    createDraftSurvey: builder.mutation({
      query: (data) => ({
        url: "/surveys/draft",
        method: "POST",
        body: data,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: ["SurveyList"],
    }),

    // Step 2: Add property details
    addPropertyDetails: builder.mutation({
      query: ({ surveyId, data }) => ({
        url: `/surveys/${surveyId}/property-details`,
        method: "PUT",
        body: data,
      }),
    }),

    // Step 3: Add building information
    addBuildingInfo: builder.mutation({
      query: ({ surveyId, data }) => ({
        url: `/surveys/${surveyId}/building`,
        method: "PUT",
        body: data,
      }),
    }),

    addFloor: builder.mutation({
      query: ({ buildingId, data }) => ({
        url: `/surveys/buildings/${buildingId}/floors`,
        method: "POST",
        body: data,
      }),
    }),
    updateFloor: builder.mutation({
      query: ({ floorId, data }) => ({
        url: `/surveys/floors/${floorId}`,
        method: "PUT",
        body: data,
      }),
    }),
    upsertFloorUtilities: builder.mutation({
      query: ({ floorId, data }) => ({
        url: `/surveys/floors/${floorId}/utilities`,
        method: "PUT",
        body: data,
      }),
    }),
    createFloorOccupancy: builder.mutation({
      query: ({ floorId, data }) => ({
        url: `/surveys/floors/${floorId}/occupancy`,
        method: "PUT",
        body: data,
      }),
    }),

    // Step 5: Add unit
    addUnit: builder.mutation({
      query: ({ floorId, data }) => ({
        url: `/surveys/floors/${floorId}/units`,
        method: "POST",
        body: data,
      }),
    }),
    updateUnit: builder.mutation({
      query: ({ unitId, data }) => ({
        url: `/surveys/units/${unitId}`,
        method: "PUT",
        body: data,
      }),
    }),
    deleteUnit: builder.mutation({
      query: ({ unitId }) => ({
        url: `/surveys/units/${unitId}`,
        method: "DELETE",
      }),
    }),
    addUnitOwner: builder.mutation({
      query: ({ unitId, data }) => ({
        url: `/surveys/units/${unitId}/owners`,
        method: "POST",
        body: data,
      }),
    }),
    updateUnitOwner: builder.mutation({
      query: ({ ownerId, data }) => ({
        url: `/surveys/unit-owners/${ownerId}`,
        method: "PUT",
        body: data,
      }),
    }),
    upsertUnitUtilities: builder.mutation({
      query: ({ unitId, data }) => ({
        url: `/surveys/units/${unitId}/utilities`,
        method: "PUT",
        body: data,
      }),
    }),
    addUnitPhotos: builder.mutation({
      query: ({ unitId, formData }) => ({
        url: `/surveys/units/${unitId}/photos`,
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["UnitPhotos"],
    }),
    UpdateUnitPhoto: builder.mutation({
      query: ({ photoId, formData }) => ({
        url: `/surveys/unit-photos/${photoId}`,
        method: "PUT",
        body: formData,
      }),
      invalidatesTags: ["UnitPhotos"],
    }),

    // Step 6: Upload photos
    uploadSurveyPhotos: builder.mutation({
      query: ({ surveyId, formData }) => ({
        url: `/surveys/${surveyId}/photos`,
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["PropertyPhotos"],
    }),

    // Remember how far the wizard got, server-side.
    // Deliberately does NOT invalidate "Surveys": this fires on every step
    // change, and invalidating would refetch the survey each time, which is
    // what used to clobber in-progress form state.
    updateSurveyProgress: builder.mutation({
      query: ({ surveyId, current_step }) => ({
        url: `/surveys/${surveyId}/progress`,
        method: "PUT",
        body: { current_step },
      }),
    }),

    // Step 7: Submit survey
    submitSurvey: builder.mutation({
      query: (surveyId) => ({
        url: `/surveys/${surveyId}/submit`,
        method: "POST",
      }),
      invalidatesTags: ["SurveyList"],
    }),
    getBuildingByProperty: builder.query({
      query: (propertyId) => `/surveys/properties/${propertyId}/building`,
    }),
    getFloorsByBuilding: builder.query({
      query: (buildingId) => `/surveys/buildings/${buildingId}/floors`,
    }),
    getPropertyOwners: builder.query({
      query: (propertyId) => `/surveys/properties/${propertyId}/owners`,
    }),
    getUnitOwners: builder.query({
      query: (unitId) => `/surveys/units/${unitId}/owners`,
    }),
    updatePropertyOwner: builder.mutation({
      query: ({ ownerId, data }) => ({
        url: `/surveys/property-owners/${ownerId}`,
        method: "PUT",
        body: data,
      }),
    }),
    updateProperty: builder.mutation({
      query: ({ propertyId, data }) => ({
        url: `/properties/${propertyId}`,
        method: "PUT",
        body: data,
      }),
    }),
    upsertPropertyUtilities: builder.mutation({
      query: ({ propertyId, data }) => ({
        url: `/surveys/properties/${propertyId}/utilities`,
        method: "PUT",
        body: data,
      }),
    }),
    updatePropertyRoad: builder.mutation({
      query: ({ propertyId, data }) => ({
        url: `/surveys/property-roads/${propertyId}`,
        method: "PUT",
        body: data,
      }),
    }),
    updateBuilding: builder.mutation({
      query: ({ buildingId, data }) => ({
        url: `/surveys/buildings/${buildingId}`,
        method: "PUT",
        body: data,
      }),
    }),
    updateFloorOccupancy: builder.mutation({
      query: ({ floorId, data }) => ({
        url: `/surveys/floor-occupancy/${floorId}`,
        method: "PUT",
        body: data,
      }),
    }),
    createPropertyPhoto: builder.mutation({
      query: ({ propertyId, formData }) => ({
        url: `/surveys/properties/${propertyId}/photos`,
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["PropertyPhotos"],
    }),
    getPropertyPhotos: builder.query({
      query: (propertyId) => `/surveys/properties/${propertyId}/photos`,
      transformResponse: (response) => response?.data ?? response ?? [],
      providesTags: ["PropertyPhotos"],
    }),
    getUnitPhotos: builder.query({
      query: (unitId) => `/surveys/units/${unitId}/photos`,
      transformResponse: (response) => response?.data ?? response ?? [],
      providesTags: ["UnitPhotos"],
    }),
    deleteUnitPhoto: builder.mutation({
      query: ({ photoId }) => ({
        url: `/surveys/unit-photos/${photoId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["UnitPhotos"],
    }),
  }),
});

export const {
  useCreateSurveyMutation,
  useGetSurveyorSurveysQuery,
  useGetSurveyorTodaysSurveysQuery,
  useGetAdminTodaysSurveysQuery,
  useGetSurveyQuery,
  useUpdateSurveyMutation,
  useDeleteSurveyMutation,
  useFindPolygonQuery,
  useDeleteSurveyImageMutation,
  // Multi-step survey hooks
  useCreateDraftSurveyMutation,
  useAddPropertyDetailsMutation,
  useAddBuildingInfoMutation,
  useAddFloorMutation,
  useUpsertFloorUtilitiesMutation,
  useCreateFloorOccupancyMutation,
  useUpsertUnitUtilitiesMutation,
  useAddUnitMutation,
  useAddUnitOwnerMutation,
  useAddUnitPhotosMutation,
  useUpdateUnitPhotoMutation,
  useDeleteUnitMutation,
  useUploadSurveyPhotosMutation,
  useSubmitSurveyMutation,
  useUpdateSurveyProgressMutation,
  useGetBuildingByPropertyQuery,
  useGetFloorsByBuildingQuery,
  useGetPropertyOwnersQuery,
  useUpdatePropertyOwnerMutation,
  useUpdatePropertyMutation,
  useUpsertPropertyUtilitiesMutation,
  useUpdatePropertyRoadMutation,
  useUpdateBuildingMutation,
  useUpdateFloorOccupancyMutation,
  useCreatePropertyPhotoMutation,
  useGetPropertyPhotosQuery,
  useGetUnitOwnersQuery,
  useUpdateUnitOwnerMutation,
  useUpdateFloorMutation,
  useUpdateUnitMutation,
  useGetUnitPhotosQuery,
  useDeleteUnitPhotoMutation,
} = surveyApi;
