import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "../services/authApi";
import { assetSurveyApi } from "../services/assetSurveyApi";
import { surveyApi } from "../services/surveyApi";
import { typesApi } from "../services/typesApi";
import { gisApi } from "../services/gisApi";
import { assignmentApi } from "../services/assignmentApi";
import authReducer from "./authSlice";

export const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [assetSurveyApi.reducerPath]: assetSurveyApi.reducer,
    [surveyApi.reducerPath]: surveyApi.reducer,
    [typesApi.reducerPath]: typesApi.reducer,
    [gisApi.reducerPath]: gisApi.reducer,
    [assignmentApi.reducerPath]: assignmentApi.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      assetSurveyApi.middleware,
      surveyApi.middleware,
      typesApi.middleware,
      gisApi.middleware,
      assignmentApi.middleware
    ),
});

export default store;
