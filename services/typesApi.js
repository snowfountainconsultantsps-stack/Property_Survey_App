import { API_BASE_URL } from "@/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createApi } from "@reduxjs/toolkit/query/react";

// Custom base query for types API
const baseQuery = async (args, api, extraOptions) => {
  const { url, method = "GET", body } = typeof args === 'string' ? { url: args } : args;
  
  try {
    const token = await AsyncStorage.getItem("token");
    
    let fetchBody = body;
    let headers = {
      Authorization: `Bearer ${token}`,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
      fetchBody = JSON.stringify(body);
    }

    const fullUrl = `${API_BASE_URL}${url}`;

    const response = await fetch(fullUrl, {
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

    if (!response.ok) {
      console.error("❌ Types API error:", response.status, data);
      return { error: data };
    }

    return { data };
  } catch (error) {
    console.error("❌ Types API fetch error:", error);
    return { error: { message: error.message } };
  }
};

export const typesApi = createApi({
  reducerPath: "typesApi",
  baseQuery,
  tagTypes: ["PropertyTypes"],
  endpoints: (builder) => ({
    // Get all property type categories
    getCategories: builder.query({
      query: () => "/types/categories",
      transformResponse: (response) => response.data,
      providesTags: ["PropertyTypes"],
    }),

    // Get property subtypes (optionally filtered by category)
    getSubtypes: builder.query({
      query: (categoryId) => {
        const url = categoryId 
          ? `/types/subtypes?category_id=${categoryId}`
          : "/types/subtypes";
        return url;
      },
      transformResponse: (response) => response.data,
      providesTags: ["PropertyTypes"],
    }),

    // Get floor usage types
    getFloorUsageTypes: builder.query({
      query: () => "/types/floor-usage",
      transformResponse: (response) => response.data,
      providesTags: ["PropertyTypes"],
    }),

    // Create new category (Admin only)
    createCategory: builder.mutation({
      query: (data) => ({
        url: "/types/categories",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["PropertyTypes"],
    }),

    // Create new subtype (Admin only)
    createSubtype: builder.mutation({
      query: (data) => ({
        url: "/types/subtypes",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["PropertyTypes"],
    }),

    // Update category (Admin only)
    updateCategory: builder.mutation({
      query: ({ id, data }) => ({
        url: `/types/categories/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["PropertyTypes"],
    }),

    // Update subtype (Admin only)
    updateSubtype: builder.mutation({
      query: ({ id, data }) => ({
        url: `/types/subtypes/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["PropertyTypes"],
    }),

    // Delete category (Admin only)
    deleteCategory: builder.mutation({
      query: (id) => ({
        url: `/types/categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["PropertyTypes"],
    }),

    // Delete subtype (Admin only)
    deleteSubtype: builder.mutation({
      query: (id) => ({
        url: `/types/subtypes/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["PropertyTypes"],
    }),
  }),
});

export const {
  useGetCategoriesQuery,
  useGetSubtypesQuery,
  useGetFloorUsageTypesQuery,
  useCreateCategoryMutation,
  useCreateSubtypeMutation,
  useUpdateCategoryMutation,
  useUpdateSubtypeMutation,
  useDeleteCategoryMutation,
  useDeleteSubtypeMutation,
} = typesApi;
