import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { WebView } from "react-native-webview";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { API_ORIGIN } from "../../../config";
import {
  useAddBuildingInfoMutation,
  useAddFloorMutation,
  useAddPropertyDetailsMutation,
  useAddUnitMutation,
  useAddUnitOwnerMutation,
  useAddUnitPhotosMutation,
  useCreateDraftSurveyMutation,
  useCreateFloorOccupancyMutation,
  useDeleteUnitMutation,
  useGetSurveyQuery,
  useSubmitSurveyMutation,
  useUpdateSurveyProgressMutation,
  useUpdateFloorMutation,
  useUpdateUnitMutation,
  useUpdateUnitOwnerMutation,
  useUpdateUnitPhotoMutation,
  useUploadSurveyPhotosMutation,
  useUpsertFloorUtilitiesMutation,
  useUpsertUnitUtilitiesMutation,
} from "../../../services/surveyApi";
import {
  useGetCategoriesQuery,
  useGetFloorUsageTypesQuery,
  useGetSubtypesQuery,
} from "../../../services/typesApi";

const API_BASE_URL = API_ORIGIN;

// Blank wizard state. Defined once at module scope so the initial value and the
// "starting a different property" reset can never drift apart.
const INITIAL_PROPERTY_DETAILS = {
  address_line1: "",
  address_line2: "",
  landmark: "",
  plot_area_sqmt: "",
  road_width_front: "1_12M",
  road_width_back: "1_12M",
  road_width_left: "1_12M",
  road_width_right: "1_12M",
  road_type_front: "BITUMINOUS",
  road_type_back: "BITUMINOUS",
  road_type_left: "BITUMINOUS",
  road_type_right: "BITUMINOUS",
  carriageway_area_front: "",
  carriageway_area_back: "",
  carriageway_area_left: "",
  carriageway_area_right: "",
  footpath_area_front: "",
  footpath_area_back: "",
  footpath_area_left: "",
  footpath_area_right: "",
  // Utilities
  has_electricity: false,
  has_gas_connection: false,
  has_water_connection: false,
  has_internet_connection: false,
  has_solar: false,
  has_rainwater_harvesting: false,
  has_sewer: false,
  // Owner details (for simple single-unit properties)
  owner_name: "",
  owner_occupation: "",
  is_disabled_person: "NO",
  mobile_number: "",
  aadhar_number: "",
  father_husband_name: "",
  bill_photo_url: "",
  construction_type: "PUCCA",
};

const INITIAL_ROAD_SIDES = { front: true, back: false, left: false, right: false };

const INITIAL_BUILDING_INFO = {
  category_id: null,
  subtype_id: null,
  total_floors: "",
  builtup_area_sqmt: "",
  construction_year: "",
  single_storey_occupancy: "Self",
  floors_below_ground: "0",
};
const DEFAULT_PLACEHOLDER_COLOR = "#6B7280";
const YEAR_SPAN_REGEX = /^(\d{4})-(\d{4})$/;

TextInput.defaultProps = {
  ...(TextInput.defaultProps || {}),
  placeholderTextColor: DEFAULT_PLACEHOLDER_COLOR,
};

export default function MultiStepSurvey() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const resumeSurveyId = params?.surveyId ? Number(params.surveyId) : null;

  // A parcel tapped on the asset map arrives already chosen, so the built-in
  // location/refresh/map picker below is skipped entirely and we go straight
  // to the property form for that parcel.
  const preselectedPolygonCode = params?.polygonCode
    ? String(params.polygonCode)
    : null;
  const isPreselected = Boolean(preselectedPolygonCode);
  // const { user } = useSelector((state) => state.auth); // Available for future use

  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [surveyId, setSurveyId] = useState(null);
  const [buildingId, setBuildingId] = useState(null);

  // Step 1: Polygon selection + basic property info
  const [coordinates, setCoordinates] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [polygons, setPolygons] = useState(null);
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [step1Data, setStep1Data] = useState({
    address: "",
    category_id: null,
    subtype_id: null,
  });

  // Seed the chosen parcel from the map so step 1 only asks for the details
  // the surveyor still has to fill in.
  useEffect(() => {
    if (!isPreselected) return;
    setSelectedPolygon((prev) =>
      prev?.polygon_code === preselectedPolygonCode
        ? prev
        : {
            id: params?.polygonId ? Number(params.polygonId) : null,
            polygon_code: preselectedPolygonCode,
            ward_id: params?.wardId ? Number(params.wardId) : null,
            ward_name: params?.wardName ? String(params.wardName) : null,
            area_sqmt: params?.areaSqmt ? Number(params.areaSqmt) : null,
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreselected, preselectedPolygonCode]);

  // Step 2: Property details
  const [propertyDetails, setPropertyDetails] = useState(INITIAL_PROPERTY_DETAILS);

  // Track which sides have roads
  const [roadSides, setRoadSides] = useState(INITIAL_ROAD_SIDES);

  // Step 3: Building info
  const [buildingInfo, setBuildingInfo] = useState(INITIAL_BUILDING_INFO);

  // Step 4: Floors
  const [floors, setFloors] = useState([]);
  const [currentFloorData, setCurrentFloorData] = useState({
    floor_number: "",
    construction_year: "",
    usage_type_id: null,
  });

  // Step 5: Units
  const [units, setUnits] = useState([]);
  const [currentUnitData, setCurrentUnitData] = useState({
    floor_number: "",
    unit_position: "FULL_FLOOR",
    carpet_area_sqmt: "",
    occupancy_status: "Self",
    owner_name: "",
    mobile_number: "",
    has_kitchen: true,
    toilet_count: "",
    parking_type: "NONE",
  });

  // Merged Floor-Unit data for Residential Single Story
  const [mergedFloorUnits, setMergedFloorUnits] = useState([]);
  const [isSavedSingleStoreyData, setIsSavedSingleStoreyData] = useState(false);
  const [isResidentialSingle, setIsResidentialSingle] = useState(false);
  const [isResidentialMultiStoreyFlow, setIsResidentialMultiStoreyFlow] =
    useState(false);
  const [isNonResidentialSimpleFlow, setIsNonResidentialSimpleFlow] =
    useState(false);
  const [isCommercialComplexFlow, setIsCommercialComplexFlow] = useState(false);
  const [isMixedFlow, setIsMixedFlow] = useState(false);
  const [isVacantFlow, setIsVacantFlow] = useState(false);

  // Residential multi-storey collects no survey photos, so the Photos step is
  // dropped from that flow entirely — hidden in the indicator and skipped when
  // moving both forwards and backwards.
  const photosStepEnabled = !isResidentialMultiStoreyFlow;
  const stepAfterFloors = photosStepEnabled ? 6 : 7;
  const [multiStoreyFloorUnits, setMultiStoreyFloorUnits] = useState([]);
  const [savedFloorUnits, setSavedFloorUnits] = useState({});
  const [unsavedFloorUnits, setUnsavedFloorUnits] = useState({});
  const [savedUnitCounts, setSavedUnitCounts] = useState({}); // Track count of saved units per floor
  const [savingUnitDetails, setSavingUnitDetails] = useState(false);
  const [savingFloorIndex, setSavingFloorIndex] = useState(null);
  const [savingUnitIndex, setSavingUnitIndex] = useState(null);
  const [deletingUnitKey, setDeletingUnitKey] = useState(null);
  const [submittingMergedFloorUnits, setSubmittingMergedFloorUnits] =
    useState(false);
  const [floorSavedIds, setFloorSavedIds] = useState({}); // Track saved parking-only floors

  // Unique property identifier ({ward}/{polygon}/{seq}), assigned by the backend
  // at draft creation and shown on the last tab + survey card.
  const [propertyCode, setPropertyCode] = useState("");

  // Step 6: Photos
  const [photos, setPhotos] = useState([]);
  const [images, setImages] = useState([]); // For photos fetched from API
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    const clearPhotos = async () => {
      await AsyncStorage.removeItem("photos");
      setPhotos([]);
    };

    clearPhotos();
  }, []);
  const getPropertyTypeFlags = () => {
    const selectedCategory = categories?.find(
      (c) => c.id === step1Data.category_id,
    );
    const selectedSubtype = subtypes?.find(
      (s) => s.id === step1Data.subtype_id,
    );

    // Use exact lower-case name comparison to avoid "nonresidential".includes("residential")
    const categoryName = selectedCategory?.name?.toLowerCase() || "";
    const subtypeName = selectedSubtype?.name?.toLowerCase() || "";

    const isResidential = categoryName === "residential";
    const isNonResidential = categoryName === "nonresidential";
    const isVacant = categoryName === "vacant";
    const isMixedCategory = categoryName === "mixed";

    const isResidentialSingle =
      isResidential &&
      (subtypeName.includes("single") || subtypeName === "singlestory");

    const isResidentialMultiStorey =
      isResidential &&
      (subtypeName.includes("multi") || subtypeName === "multistory") &&
      !subtypeName.includes("single");

    const isCommercialComplex =
      isNonResidential &&
      (subtypeName.includes("complex") || subtypeName === "commercialcomplex");

    // Commercial or PetrolPump
    const isNonResidentialSimple = isNonResidential && !isCommercialComplex;

    return {
      categoryName,
      subtypeName,
      isResidentialSingle,
      isNonResidentialSimple,
      isResidentialMultiStorey,
      isCommercialComplex,
      isVacant,
      isMixed: isMixedCategory,
      isSimpleProperty: isResidentialSingle || isNonResidentialSimple,
    };
  };

  const parseAreaValue = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const sanitizeDigitsWithLimit = (value, maxLength) =>
    String(value || "")
      .replace(/\D/g, "")
      .slice(0, maxLength);

  const sanitizeFieldValue = (field, value) => {
    if (["mobile_number", "owner_mobile", "occupier_mobile"].includes(field)) {
      return sanitizeDigitsWithLimit(value, 10);
    }
    if (field === "aadhar_number") {
      return sanitizeDigitsWithLimit(value, 12);
    }
    if (field === "construction_year") {
      const digits = String(value || "")
        .replace(/\D/g, "")
        .slice(0, 8);
      if (digits.length <= 4) return digits;
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return value;
  };

  const isValidYearSpan = (value) => {
    const match = String(value || "")
      .trim()
      .match(YEAR_SPAN_REGEX);
    if (!match) return false;
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    return end >= start;
  };

  const getStartYearFromSpan = (value) => {
    const str = String(value || "").trim();
    const match = str.match(YEAR_SPAN_REGEX);
    if (match) {
      return parseInt(match[1], 10);
    }
    // If it's a single year
    if (/^\d{4}$/.test(str)) {
      return parseInt(str, 10);
    }
    return null;
  };

  const toYearSpan = (yearValue) => {
    const year = parseInt(yearValue, 10);
    if (!Number.isFinite(year)) return "";
    return `${year}-${year + 1}`;
  };

  /**
   * Validates that a data object contains no NaN values
   * Logs warnings for any NaN values found
   * @param {Object} data - Data object to validate
   * @param {string} context - Context label for debugging (e.g., "Unit payload", "Floor utilities")
   * @returns {boolean} true if no NaN found, false if NaN values detected
   */
  const validateNoNaN = (data, context = "Data") => {
    if (!data || typeof data !== "object") return true;

    let foundNaN = false;
    const scanObject = (obj, path = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === "number" && !Number.isFinite(value)) {
          console.warn(
            `⚠️ NaN detected in ${context} at ${currentPath}: ${value}`,
          );
          foundNaN = true;
        } else if (typeof value === "object" && value !== null) {
          scanObject(value, currentPath);
        }
      }
    };

    scanObject(data);

    if (foundNaN) {
      console.error(`❌ NaN values found in ${context}. Check logs above.`);
      Toast.show({
        type: "error",
        text1: "Data Validation Error",
        text2: `Invalid data detected. Please fill all required fields.`,
      });
    }

    return !foundNaN;
  };

  const getDraftCacheKey = (id) => `survey_draft_progress_${id}`;

  // Push the resume position to the server alongside the local cache. The
  // cache holds the full form state (including edits not yet sent), while the
  // server is the durable record of how far the wizard got — so Continue works
  // on another device or after the cache is cleared. Fire-and-forget: a failed
  // progress ping must never block the surveyor.
  const persistStepToServer = (targetSurveyId, nextStep) => {
    if (!targetSurveyId || !nextStep) return;
    updateSurveyProgressMutation({ surveyId: targetSurveyId, current_step: nextStep })
      .unwrap()
      .catch((e) =>
        console.log("Unable to persist step to server:", e?.data?.message || e?.message || e),
      );
  };

  const saveDraftProgress = async (nextStep = currentStep, overrides = {}) => {
    if (!surveyId) return;
    persistStepToServer(surveyId, nextStep);
    try {
      const payload = {
        currentStep: nextStep,
        propertyCode,
        step1Data,
        propertyDetails,
        roadSides,
        buildingInfo,
        floors,
        mergedFloorUnits,
        multiStoreyFloorUnits,
        savedFloorUnits,
        unsavedFloorUnits,
        savedUnitCounts,
        floorSavedIds,
        photos,
        isResidentialSingle,
        isResidentialMultiStoreyFlow,
        isNonResidentialSimpleFlow,
        isCommercialComplexFlow,
        isMixedFlow,
        isVacantFlow,
        ...overrides,
      };
      await AsyncStorage.setItem(
        getDraftCacheKey(surveyId),
        JSON.stringify(payload),
      );
    } catch (error) {
      console.log("Unable to save draft progress:", error?.message || error);
    }
  };

  const saveDraftProgressFor = async (
    targetSurveyId,
    nextStep = currentStep,
    overrides = {},
  ) => {
    if (!targetSurveyId) return;
    persistStepToServer(targetSurveyId, nextStep);
    try {
      const payload = {
        currentStep: nextStep,
        propertyCode,
        step1Data,
        propertyDetails,
        roadSides,
        buildingInfo,
        floors,
        mergedFloorUnits,
        multiStoreyFloorUnits,
        savedFloorUnits,
        unsavedFloorUnits,
        savedUnitCounts,
        floorSavedIds,
        photos,
        isResidentialSingle,
        isResidentialMultiStoreyFlow,
        isNonResidentialSimpleFlow,
        isCommercialComplexFlow,
        isMixedFlow,
        isVacantFlow,
        ...overrides,
      };
      await AsyncStorage.setItem(
        getDraftCacheKey(targetSurveyId),
        JSON.stringify(payload),
      );
    } catch (error) {
      console.log("Unable to save draft progress:", error?.message || error);
    }
  };

  const isStep4DraftStateValid = (parsed) => {
    const hasMergedFloorUnits =
      Array.isArray(parsed.mergedFloorUnits) &&
      parsed.mergedFloorUnits.length > 0;
    const hasMultiStoreyFloorUnits =
      Array.isArray(parsed.multiStoreyFloorUnits) &&
      parsed.multiStoreyFloorUnits.length > 0;
    const isMergedStep4 =
      parsed.isResidentialSingle || parsed.isNonResidentialSimpleFlow;
    const isMultiStep4 =
      parsed.isResidentialMultiStoreyFlow ||
      parsed.isCommercialComplexFlow ||
      parsed.isMixedFlow;

    if (parsed.currentStep !== 4) return true;
    if (isMergedStep4) return hasMergedFloorUnits;
    if (isMultiStep4) return hasMultiStoreyFloorUnits;
    return false;
  };

  const ensureBuildingId = async (targetSurveyId) => {
    if (!targetSurveyId) return;
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/api/surveys/${targetSurveyId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      const survey = data.data || data;
      const extractedId = survey?.PropertyUnit?.Building?.id;

      if (extractedId) {
        console.log("✅ Extracted buildingId from survey:", extractedId);
        setBuildingId(extractedId);
        return extractedId;
      } else {
        console.warn(
          "⚠️ Could not find buildingId in survey. Survey structure:",
          survey,
        );
        return null;
      }
    } catch (error) {
      console.error("❌ Error fetching survey for buildingId:", error);
      return null;
    }
  };

  const upsertFloorUtilitiesData = async (floorId, floorData) => {
    if (!floorId || !upsertFloorUtilitiesMutation) {
      console.warn(
        "⚠️ Cannot upsert floor utilities - floorId or mutation missing",
      );
      return null;
    }

    try {
      const utilitiesPayload = {
        has_kitchen: floorData.has_kitchen || false,
        kitchen_count: floorData.has_kitchen
          ? parseInt(floorData.kitchen_count) || 0
          : null,
        kitchen_area: floorData.has_kitchen
          ? parseFloat(floorData.kitchen_area) || null
          : null,
        has_toilet: floorData.has_toilet || false,
        toilet_count: floorData.has_toilet
          ? parseInt(floorData.toilet_count) || 0
          : null,
        toilet_area: floorData.has_toilet
          ? parseFloat(floorData.toilet_area) || null
          : null,
        parking_type: floorData.parking_type || "NONE",
        parking_area:
          floorData.has_parking || floorData.parking_type !== "NONE"
            ? parseFloat(floorData.parking_area) || null
            : null,
      };

      console.log(
        `🔧 Upserting floor utilities for floor ${floorId}:`,
        utilitiesPayload,
      );

      const result = await upsertFloorUtilitiesMutation({
        floorId,
        data: utilitiesPayload,
      }).unwrap();

      console.log(`✅ Floor utilities upserted for floor ${floorId}`);
      return result;
    } catch (error) {
      console.error(
        `❌ Error upserting floor utilities for floor ${floorId}:`,
        error,
      );
      console.error("Error data:", error.data);
      return null;
    }
  };

  const upsertFloorOccupancyData = async (floorId, unitData) => {
    if (!floorId || !createFloorOccupancyMutation) {
      console.warn(
        "⚠️ Cannot upsert floor occupancy - floorId or mutation missing",
      );
      return null;
    }

    try {
      const occupancyStatus = unitData.occupancy_status || "Self";

      // Build payload based on occupancy_status
      const occupancyPayload = {
        occupancy_status: occupancyStatus,
        carpet_area: parseFloat(unitData.carpet_area_sqmt) || null,
        area: parseFloat(unitData.area) || null,
      };

      // Add occupant details for Rented and SelfRented
      if (occupancyStatus === "Rented" || occupancyStatus === "SelfRented") {
        occupancyPayload.occupant_name = unitData.occupier_name || null;
        occupancyPayload.occupant_mobile = unitData.occupier_mobile || null;
        occupancyPayload.rent_amount = parseFloat(unitData.rent_amount) || null;
      }

      console.log(
        `🔧 Upserting floor occupancy for floor ${floorId} (Status: ${occupancyStatus}):`,
        occupancyPayload,
      );

      const result = await createFloorOccupancyMutation({
        floorId,
        data: occupancyPayload,
      }).unwrap();

      console.log(
        `✅ Floor occupancy upserted for floor ${floorId} - Status: ${occupancyStatus}`,
      );
      return result;
    } catch (error) {
      console.error(
        `❌ Error upserting floor occupancy for floor ${floorId}:`,
        error,
      );
      console.error("Error data:", error.data);
      return null;
    }
  };

  const computeResumeStepFromSurvey = (survey) => {
    if (!survey || survey.survey_status === "COMPLETED") return 7;

    // The server records the resume position directly (Surveys.current_step),
    // so trust it when present. The inference below is the fallback for
    // surveys created before that column existed.
    const stored = Number(survey.current_step);
    if (Number.isInteger(stored) && stored > 1) return stored;

    // Step 1 (createDraftSurvey) already writes a Property row AND an empty
    // Building shell, so simply testing that they exist would report every
    // brand-new draft as being past steps 2 and 3. Each step is therefore
    // judged on whether its own fields were actually filled in.
    const property = survey.PropertyDetails || survey.Property || null;
    const building = survey?.PropertyUnit?.Building || property?.Building || null;

    const filled = (v) => v !== null && v !== undefined && v !== "";

    // Step 2 — property details: owner, plot/construction, utilities, roads.
    const hasPropertyDetails =
      !!property &&
      (filled(property.plot_area) ||
        filled(property.construction_type) ||
        (property.PropertyOwners || []).length > 0 ||
        !!property.PropertyUtility ||
        (property.PropertyRoads || []).length > 0);

    // Step 3 — building info. A Vacant plot never gets a Building, so it has
    // no step 3 to complete.
    const isVacant = String(property?.property_type || "").toLowerCase() === "vacant";
    const hasBuilding =
      isVacant ||
      (!!building &&
        (Number(building.floors_above_ground) > 0 ||
          Number(building.floors_below_ground) > 0 ||
          filled(building.construction_year) ||
          filled(building.total_builtup_area) ||
          filled(building.building_occupancy)));

    // Step 4 — floors and their units.
    const floors = building?.Floors || [];
    const hasFloors = floors.length > 0;
    const hasUnits =
      (building?.PropertyUnits || []).length > 0 ||
      floors.some((f) => (f?.Units || f?.PropertyUnits || []).length > 0);

    const hasPhotos =
      (survey?.SurveyImages || []).length > 0 ||
      (property?.PropertyPhotos || []).length > 0;

    if (!hasPropertyDetails) return 2;
    if (!hasBuilding) return 3;
    if (isVacant) return hasPhotos ? 7 : 6;
    if (!hasFloors || !hasUnits) return 4;
    if (!hasPhotos) return 6;
    return 7;
  };

  const hydrateFromResumeSurvey = (survey) => {
    if (!survey) return;

    setSurveyId(survey.id);
    const resumedCode =
      survey.property_code || survey?.PropertyDetails?.property_code;
    if (resumedCode) setPropertyCode(resumedCode);

    const building = survey?.PropertyUnit?.Building;
    if (building?.id) {
      setBuildingId(building.id);
    }
    const polygon = building?.Polygon;
    const property = survey?.PropertyDetails;
    let isSingle = false;
    let isMulti = false;
    let isNonResSingle = false;
    let isComComplex = false;
    let isMixed = false;

    if (polygon) {
      setSelectedPolygon({
        id: polygon.id,
        polygon_code: polygon.polygon_code,
        ward_id: polygon.ward_id,
        ward_name: polygon?.Ward?.name || "",
        city_name: polygon?.Ward?.City?.name || "",
        district_name:
          polygon?.Ward?.District?.name ||
          polygon?.Ward?.City?.District?.name ||
          "",
        state_name:
          polygon?.Ward?.District?.State?.name ||
          polygon?.Ward?.City?.District?.State?.name ||
          "",
        area_sqmt: polygon.area_sqmt,
      });
    }

    setStep1Data((prev) => ({
      ...prev,
      address: property?.address_line1 || survey.address || prev.address,
      category_id: building?.category_id || prev.category_id,
      subtype_id: building?.subtype_id || prev.subtype_id,
    }));

    if (building) {
      const subtypeName = String(
        building?.building_subtype || building?.Subtype?.name || "",
      ).toLowerCase();
      const categoryName = String(
        building?.building_type || building?.Category?.name || "",
      ).toLowerCase();

      // Use exact equality to avoid "nonresidential".includes("residential") bug
      const isResidential = categoryName === "residential";
      const isNonResidential = categoryName === "nonresidential";
      const isVacant = categoryName === "vacant";
      const isMixedCategory = categoryName === "mixed";

      isSingle =
        isResidential &&
        (subtypeName.includes("single") ||
          subtypeName.includes("residential_single"));
      isMulti =
        isResidential &&
        (subtypeName.includes("multi") ||
          subtypeName.includes("multistorey")) &&
        !subtypeName.includes("single");

      const isComplexFlag =
        isNonResidential &&
        (subtypeName.includes("complex") ||
          subtypeName === "commercialcomplex");
      const isNonResSimpleFlag = isNonResidential && !isComplexFlag;

      // Assign outer-scope flags for use in units hydration below
      isNonResSingle = isNonResSimpleFlag;
      isComComplex = isComplexFlag;
      isMixed = isMixedCategory;

      setIsResidentialSingle(isSingle);
      setIsResidentialMultiStoreyFlow(isMulti);
      setIsNonResidentialSimpleFlow(isNonResSimpleFlag);
      setIsCommercialComplexFlow(isComplexFlag);
      setIsMixedFlow(isMixedCategory);
      setIsVacantFlow(isVacant);

      setBuildingInfo((prev) => ({
        ...prev,
        category_id: building.category_id || prev.category_id,
        subtype_id: building.subtype_id || prev.subtype_id,
        total_floors: building.total_floors
          ? String(building.total_floors)
          : prev.total_floors,
        floors_below_ground: building.floors_below_ground
          ? String(building.floors_below_ground)
          : prev.floors_below_ground,
        builtup_area_sqmt: building.builtup_area_sqmt
          ? String(building.builtup_area_sqmt)
          : prev.builtup_area_sqmt,
        construction_year: toYearSpan(building.construction_year),
      }));
    }

    if (property) {
      const populatedRoadSides = {
        front: !!property.road_width_front,
        back: !!property.road_width_back,
        left: !!property.road_width_left,
        right: !!property.road_width_right,
      };
      setRoadSides(populatedRoadSides);
      setPropertyDetails((prev) => ({
        ...prev,
        address_line1: property.address_line1 || prev.address_line1,
        address_line2: property.address_line2 || prev.address_line2,
        landmark: property.landmark || prev.landmark,
        plot_area_sqmt: property.plot_area_sqmt
          ? String(property.plot_area_sqmt)
          : prev.plot_area_sqmt,
        road_width_front: property.road_width_front || prev.road_width_front,
        road_width_back: property.road_width_back || prev.road_width_back,
        road_width_left: property.road_width_left || prev.road_width_left,
        road_width_right: property.road_width_right || prev.road_width_right,
        road_type_front: property.road_type_front || prev.road_type_front,
        road_type_back: property.road_type_back || prev.road_type_back,
        road_type_left: property.road_type_left || prev.road_type_left,
        road_type_right: property.road_type_right || prev.road_type_right,
        owner_name: property.owner_name || prev.owner_name,
        mobile_number: property.mobile_number || prev.mobile_number,
        aadhar_number: property.aadhar_number || prev.aadhar_number,
        father_husband_name:
          property.father_husband_name || prev.father_husband_name,
        bill_photo_url: property.bill_photo_url || prev.bill_photo_url,
      }));
    }

    setPhotos(
      (survey?.SurveyImages || []).map((img) => ({
        uri: img.image_url,
        name: img.image_url?.split("/").pop() || `survey_${img.id}.jpg`,
        type: "image/jpeg",
      })),
    );

    if (building) {
      const floorsFromApi = [...(building.Floors || [])].sort(
        (a, b) => (a.floor_number || 0) - (b.floor_number || 0),
      );
      const unitsFromApi = building.PropertyUnits || [];
      const unitsByFloor = unitsFromApi.reduce((acc, unit) => {
        const floorNo = unit?.floor_number ?? unit?.Floor?.floor_number ?? 0;
        if (!acc[floorNo]) acc[floorNo] = [];
        acc[floorNo].push(unit);
        return acc;
      }, {});

      setFloors(floorsFromApi);

      if (isSingle || isNonResSingle) {
        const merged = floorsFromApi.map((floor) => {
          const floorUnits = unitsByFloor[floor.floor_number] || [];
          const unit = floorUnits[0] || {};
          const unitDetails = unit?.UnitDetails || {};
          const typeAttrs = unitDetails?.type_specific_attributes || {};
          return {
            id: floor.id || null,
            unitId: unit.id || null,
            floor_number: floor.floor_number,
            construction_year: toYearSpan(floor.construction_year),
            carpet_area_sqmt: unit.carpet_area_sqmt
              ? String(unit.carpet_area_sqmt)
              : "",
            occupancy_status: unit.occupancy_status || "Self",
            area:
              typeAttrs.occupancy_area_sqmt !== undefined &&
              typeAttrs.occupancy_area_sqmt !== null
                ? String(typeAttrs.occupancy_area_sqmt)
                : "",
            self_area:
              typeAttrs.self_area_sqmt !== undefined &&
              typeAttrs.self_area_sqmt !== null
                ? String(typeAttrs.self_area_sqmt)
                : "",
            rented_area:
              typeAttrs.rented_area_sqmt !== undefined &&
              typeAttrs.rented_area_sqmt !== null
                ? String(typeAttrs.rented_area_sqmt)
                : "",
            occupier_name: typeAttrs.occupier_name || "",
            occupier_mobile: typeAttrs.occupier_mobile || "",
            has_kitchen: !!unitDetails.has_kitchen,
            kitchen_count:
              unitDetails.kitchen_count !== null &&
              unitDetails.kitchen_count !== undefined
                ? String(unitDetails.kitchen_count)
                : "",
            kitchen_area:
              unitDetails.kitchen_area_sqmt !== null &&
              unitDetails.kitchen_area_sqmt !== undefined
                ? String(unitDetails.kitchen_area_sqmt)
                : "",
            has_toilet: !!unitDetails.has_toilet,
            toilet_count:
              unitDetails.toilet_count !== null &&
              unitDetails.toilet_count !== undefined
                ? String(unitDetails.toilet_count)
                : "",
            toilet_area:
              unitDetails.toilet_area_sqmt !== null &&
              unitDetails.toilet_area_sqmt !== undefined
                ? String(unitDetails.toilet_area_sqmt)
                : "",
            has_parking:
              typeAttrs.parking_type && typeAttrs.parking_type !== "NONE",
            parking_type: typeAttrs.parking_type || "NONE",
            parking_area:
              typeAttrs.parking_area_sqmt !== null &&
              typeAttrs.parking_area_sqmt !== undefined
                ? String(typeAttrs.parking_area_sqmt)
                : "",
          };
        });
        setMergedFloorUnits(merged);
        setIsSavedSingleStoreyData(true);
      }

      if (isMulti || isComComplex || isMixed) {
        const multi = floorsFromApi.map((floor) => {
          const floorUnits = (unitsByFloor[floor.floor_number] || []).sort(
            (a, b) => (a.id || 0) - (b.id || 0),
          );
          const resolvedFloorMode = getUiFloorUseMode(floor.floor_use);
          const isGroundFloor = floor.floor_number === 0;
          const isBasementFloor = floor.floor_number < 0;
          const floorParkingType = floor.parking_type || "NONE";
          const floorParkingArea =
            floor.parking_area !== null && floor.parking_area !== undefined
              ? String(floor.parking_area)
              : "";

          return {
            id: floor.id || null,
            floor_number: floor.floor_number,
            floor_area_sqmt:
              floor.carpet_area_sqmt !== null &&
              floor.carpet_area_sqmt !== undefined
                ? String(floor.carpet_area_sqmt)
                : "",
            carpet_area: floor.carpet_area_sqmt
              ? String(floor.carpet_area_sqmt)
              : "",
            construction_year: toYearSpan(floor.construction_year),
            floor_use:
              !isGroundFloor && !isBasementFloor ? resolvedFloorMode : null,
            ground_floor_mode: isGroundFloor ? resolvedFloorMode : null,
            basement_floor_mode: isBasementFloor ? resolvedFloorMode : null,
            has_parking:
              resolvedFloorMode === "PARKING_ONLY" ||
              resolvedFloorMode === "BOTH" ||
              floorParkingType !== "NONE",
            parking_type: floorParkingType,
            parking_area: floorParkingArea,
            unit_count: String(
              floorUnits.length ||
                (resolvedFloorMode === "PARKING_ONLY" ? 0 : 1),
            ),
            units:
              floorUnits.length > 0
                ? floorUnits.map((unit) => ({
                    ...createMultiStoreyUnitTemplate(),
                    id: unit.id || null,
                    owner_id: unit.owner_id || null,
                    unit_address:
                      unit?.UnitDetails?.type_specific_attributes
                        ?.unit_address || "",
                    carpet_area_sqmt: unit.carpet_area_sqmt
                      ? String(unit.carpet_area_sqmt)
                      : "",
                    construction_year:
                      toYearSpan(
                        unit?.UnitDetails?.type_specific_attributes
                          ?.unit_construction_year,
                      ) || toYearSpan(floor.construction_year),
                    occupancy_status: unit.occupancy_status || "Self",
                    owner_name: unit.owner_name || "",
                    owner_mobile: unit.mobile_number || "",
                    occupier_name: unit.tenant_name || "",
                    occupier_mobile: unit.tenant_mobile || "",
                    usage_type: unit.usage_type || "RESIDENTIAL",
                    area:
                      unit?.UnitDetails?.type_specific_attributes
                        ?.occupancy_area_sqmt !== undefined &&
                      unit?.UnitDetails?.type_specific_attributes
                        ?.occupancy_area_sqmt !== null
                        ? String(
                            unit.UnitDetails.type_specific_attributes
                              .occupancy_area_sqmt,
                          )
                        : "",
                    self_area:
                      unit?.UnitDetails?.type_specific_attributes
                        ?.self_area_sqmt !== undefined &&
                      unit?.UnitDetails?.type_specific_attributes
                        ?.self_area_sqmt !== null
                        ? String(
                            unit.UnitDetails.type_specific_attributes
                              .self_area_sqmt,
                          )
                        : "",
                    rented_area:
                      unit?.UnitDetails?.type_specific_attributes
                        ?.rented_area_sqmt !== undefined &&
                      unit?.UnitDetails?.type_specific_attributes
                        ?.rented_area_sqmt !== null
                        ? String(
                            unit.UnitDetails.type_specific_attributes
                              .rented_area_sqmt,
                          )
                        : "",
                  }))
                : [{ ...createMultiStoreyUnitTemplate() }],
          };
        });
        setMultiStoreyFloorUnits(multi);
        setFloorSavedIds(deriveSavedParkingFloorIds(multi));
        setSavedFloorUnits(
          floorsFromApi.reduce((acc, floor, index) => {
            acc[index] = (unitsByFloor[floor.floor_number] || []).length > 0;
            return acc;
          }, {}),
        );
        setUnsavedFloorUnits({});
      }
    }

    setCurrentStep(computeResumeStepFromSurvey(survey));
  };

  const updatePropertyDetailsField = (field, value) => {
    setPropertyDetails((prev) => ({
      ...prev,
      [field]: sanitizeFieldValue(field, value),
    }));
  };

  const getSideCarriagewayArea = (side) =>
    parseAreaValue(propertyDetails[`carriageway_area_${side}`]);

  const getSideFootpathArea = (side) =>
    parseAreaValue(propertyDetails[`footpath_area_${side}`]);

  const getSideTotalRoadArea = (side) =>
    getSideCarriagewayArea(side) + getSideFootpathArea(side);

  const totalCarriagewayArea = ["front", "back", "left", "right"].reduce(
    (sum, side) => sum + (roadSides[side] ? getSideCarriagewayArea(side) : 0),
    0,
  );

  const totalFootpathArea = ["front", "back", "left", "right"].reduce(
    (sum, side) => sum + (roadSides[side] ? getSideFootpathArea(side) : 0),
    0,
  );

  const totalRoadArea = totalCarriagewayArea + totalFootpathArea;

  // API hooks
  const [createDraft, { isLoading: creatingDraft }] =
    useCreateDraftSurveyMutation();
  const [addPropertyDetailsMutation, { isLoading: addingPropertyDetails }] =
    useAddPropertyDetailsMutation();
  const [addBuildingInfoMutation, { isLoading: addingBuildingInfo }] =
    useAddBuildingInfoMutation();
  const [addFloorMutation, { isLoading: addingFloor }] = useAddFloorMutation();
  const [upsertFloorUtilitiesMutation, { isLoading: upsertingFloorUtilities }] =
    useUpsertFloorUtilitiesMutation();
  const [createFloorOccupancyMutation, { isLoading: creatingFloorOccupancy }] =
    useCreateFloorOccupancyMutation();
  const [addUnitMutation, { isLoading: addingUnit }] = useAddUnitMutation();
  const [upsertUnitUtilitiesMutation, { isLoading: upsertingUnitUtilities }] =
    useUpsertUnitUtilitiesMutation();
  const [addUnitOwnerMutation, { isLoading: addingUnitOwner }] =
    useAddUnitOwnerMutation();
  const [updateUnitOwnerMutation, { isLoading: updatingUnitOwner }] =
    useUpdateUnitOwnerMutation();
  const [updateFloorMutation, { isLoading: updatingFloor }] =
    useUpdateFloorMutation();
  const [updateUnitMutation, { isLoading: updatingUnit }] =
    useUpdateUnitMutation();

  const [createUnitPhotos, { isLoading: addingUnitPhotos }] =
    useAddUnitPhotosMutation();
  const [updateUnitPhotos, { isLoading: updatingUnitPhotos }] =
    useUpdateUnitPhotoMutation();
  const [uploadPhotosMutation, { isLoading: uploadingPhotosBackend }] =
    useUploadSurveyPhotosMutation();
  const [submitSurveyMutation, { isLoading: submitting }] =
    useSubmitSurveyMutation();
  const [updateSurveyProgressMutation] = useUpdateSurveyProgressMutation();
  const [deleteUnitMutation] = useDeleteUnitMutation();
  const { data: resumeSurveyData } = useGetSurveyQuery(resumeSurveyId, {
    skip: !resumeSurveyId,
  });

  // Fetch property types
  const { data: categories, isLoading: loadingCategories } =
    useGetCategoriesQuery();
  const { data: subtypes, isLoading: loadingSubtypes } = useGetSubtypesQuery(
    step1Data.category_id || buildingInfo.category_id,
  );
  const { data: floorUsageTypes, isLoading: loadingFloorTypes } =
    useGetFloorUsageTypesQuery();

  // What the step-1 map draws. Arriving with a parcel already chosen (tapped on
  // the asset map) means the surveyor has decided — showing the whole city's
  // polygons alongside it just invites picking the wrong one, so narrow the map
  // to that single property.
  const mapPolygons = useMemo(() => {
    if (!isPreselected) return polygons;
    const targetId = params?.polygonId ? String(params.polygonId) : null;
    const targetCode = preselectedPolygonCode;
    const match = (polygons || []).filter(
      (p) =>
        (targetId && String(p.id) === targetId) ||
        (targetCode && p.polygon_code === targetCode),
    );
    return match;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreselected, polygons, params?.polygonId, preselectedPolygonCode]);

  // Once the full polygon record loads, fold its details (ward/city/area, and
  // the geometry the map needs) into the stub built from the route params.
  useEffect(() => {
    if (!isPreselected || !mapPolygons?.length) return;
    const full = mapPolygons[0];
    setSelectedPolygon((prev) =>
      prev && prev.id === full.id && prev.boundary ? prev : { ...prev, ...full },
    );
  }, [isPreselected, mapPolygons]);

  // Fill the address from the parcel being surveyed, not the surveyor's own
  // GPS position. Runs when a polygon is picked (or its geometry arrives) and
  // only while the field is untouched, so a manually typed or resumed address
  // is never overwritten.
  const addressFilledForPolygonRef = useRef(null);
  useEffect(() => {
    if (resumeSurveyId) return; // resumed surveys already carry their address
    const polygonId = selectedPolygon?.id;
    if (!polygonId) return;
    if (addressFilledForPolygonRef.current === polygonId) return;

    const center = getPolygonCenter(selectedPolygon);
    if (!center) return;

    addressFilledForPolygonRef.current = polygonId;
    autoFillAddressFromLocation(center.latitude, center.longitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPolygon, resumeSurveyId]);

  // Get location on mount (used only for the "you are here" marker — it does
  // not restrict which polygons are shown, nor set the address).
  useEffect(() => {
    if (resumeSurveyId) {
      return;
    }
    getLocation();
    fetchAllPolygons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSurveyId]);

  // A survey saved before this flow dropped photos (or resumed from a stored
  // step) could land on a screen that no longer exists for it — move it on.
  useEffect(() => {
    if (!photosStepEnabled && currentStep === 6) setCurrentStep(7);
  }, [photosStepEnabled, currentStep]);

  // Which survey the draft has already been restored for.
  //
  // This effect depends on `resumeSurveyData`, and every save mutation
  // invalidates the "Surveys" tag, so the query refetches and hands back a new
  // object after each step. Without this guard the effect re-ran on every save
  // and re-applied the *cached* draft over the live form — wiping edits, making
  // "back" show stale values, and resetting currentStep (which is why "Save &
  // Next" could jump straight to the last step). Restore must happen once per
  // survey, not on every refetch.
  const restoredForSurveyRef = useRef(null);

  // Starting a different property must not inherit the previous one's answers.
  // expo-router keeps this screen mounted between visits, so navigating here
  // for a new parcel would otherwise reuse the last survey's state — and land
  // the surveyor on the step they finished on. Reset whenever the target
  // survey changes (including to "none", i.e. a brand-new survey).
  const activeSurveyKeyRef = useRef(undefined);
  useEffect(() => {
    const key = resumeSurveyId ?? null;
    if (activeSurveyKeyRef.current === key) return;
    const isFirstRun = activeSurveyKeyRef.current === undefined;
    activeSurveyKeyRef.current = key;
    if (isFirstRun) return; // nothing to clear on initial mount

    restoredForSurveyRef.current = null;
    addressFilledForPolygonRef.current = null;
    setCurrentStep(1);
    setSurveyId(null);
    setBuildingId(null);
    setPropertyCode("");
    setSelectedPolygon(null);
    setStep1Data({ address: "", category_id: null, subtype_id: null });
    setPropertyDetails(INITIAL_PROPERTY_DETAILS);
    setRoadSides(INITIAL_ROAD_SIDES);
    setBuildingInfo(INITIAL_BUILDING_INFO);
    setFloors([]);
    setMergedFloorUnits([]);
    setMultiStoreyFloorUnits([]);
    setSavedFloorUnits({});
    setUnsavedFloorUnits({});
    setSavedUnitCounts({});
    setFloorSavedIds({});
    setPhotos([]);
    setIsResidentialSingle(false);
    setIsResidentialMultiStoreyFlow(false);
    setIsNonResidentialSimpleFlow(false);
    setIsCommercialComplexFlow(false);
    setIsMixedFlow(false);
    setIsVacantFlow(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSurveyId]);

  useEffect(() => {
    const restoreDraftProgress = async () => {
      if (!resumeSurveyId || !resumeSurveyData) return;
      if (restoredForSurveyRef.current === resumeSurveyId) return;
      // Claim it before any await so a rapid re-render can't double-restore.
      restoredForSurveyRef.current = resumeSurveyId;

      // With transformResponse, resumeSurveyData IS the survey object directly
      const survey = resumeSurveyData;
      try {
        const cache = await AsyncStorage.getItem(
          getDraftCacheKey(resumeSurveyId),
        );
        if (cache) {
          const parsed = JSON.parse(cache);
          setSurveyId(resumeSurveyId);
          setStep1Data(parsed.step1Data || step1Data);
          setPropertyDetails(parsed.propertyDetails || propertyDetails);
          setRoadSides(parsed.roadSides || roadSides);
          setBuildingInfo(parsed.buildingInfo || buildingInfo);
          setFloors(parsed.floors || []);
          setMergedFloorUnits(parsed.mergedFloorUnits || []);
          setMultiStoreyFloorUnits(parsed.multiStoreyFloorUnits || []);
          setSavedFloorUnits(parsed.savedFloorUnits || {});
          setUnsavedFloorUnits(parsed.unsavedFloorUnits || {});
          setSavedUnitCounts(parsed.savedUnitCounts || {});
          setFloorSavedIds({
            ...deriveSavedParkingFloorIds(parsed.multiStoreyFloorUnits || []),
            ...(parsed.floorSavedIds || {}),
          });
          setPhotos(parsed.photos || []);
          if (parsed.propertyCode) setPropertyCode(parsed.propertyCode);
          setIsResidentialSingle(!!parsed.isResidentialSingle);
          setIsResidentialMultiStoreyFlow(
            !!parsed.isResidentialMultiStoreyFlow,
          );
          setIsNonResidentialSimpleFlow(!!parsed.isNonResidentialSimpleFlow);
          setIsCommercialComplexFlow(!!parsed.isCommercialComplexFlow);
          setIsMixedFlow(!!parsed.isMixedFlow);
          setIsVacantFlow(!!parsed.isVacantFlow);
          // Resume at whichever source shows more progress.
          //   • the server is ground truth for what actually persisted
          //   • the cache can be further along when there is local work that
          //     hasn't been pushed yet
          // Taking the max means a lagging cache (e.g. it still says 2 from
          // draft creation) can never send the surveyor back through steps
          // they already completed and saved.
          const serverStep = computeResumeStepFromSurvey(survey);
          const cachedStep = Number(parsed.currentStep) || 0;
          setCurrentStep(Math.max(cachedStep, serverStep) || 1);

          if (!isStep4DraftStateValid(parsed) && parsed.currentStep === 4) {
            console.warn(
              "Stale or invalid cached Step 4 draft found. Rehydrating Step 4 state.",
            );
            hydrateFromResumeSurvey(survey);
            return;
          }

          // Initialize floor data if empty and required
          if (
            parsed.isResidentialMultiStoreyFlow &&
            (!parsed.multiStoreyFloorUnits ||
              parsed.multiStoreyFloorUnits.length === 0)
          ) {
            const totalFloors =
              parseInt(parsed.buildingInfo?.total_floors) || 1;
            const floorsBelowGround =
              parseInt(parsed.buildingInfo?.floors_below_ground) || 0;
            const defaultYear = parsed.buildingInfo?.construction_year || "";
            const floorData = [];
            // First, add basement floors
            for (let j = 1; j <= floorsBelowGround; j++) {
              floorData.push({
                floor_number: -j,
                construction_year: defaultYear,
                floor_area_sqmt: "",
                ground_floor_mode: null,
                has_parking: false,
                parking_type: "NONE",
                parking_area: "",
                unit_count: "1",
                units: [{ ...createMultiStoreyUnitTemplate() }],
              });
            }
            // Then, add regular floors
            for (let i = 0; i < totalFloors; i++) {
              floorData.push({
                floor_number: i,
                construction_year: defaultYear,
                floor_area_sqmt: "",
                ground_floor_mode: i === 0 ? "UNIT_ONLY" : null,
                has_parking: false,
                parking_type: "NONE",
                parking_area: "",
                unit_count: "1",
                units: [{ ...createMultiStoreyUnitTemplate() }],
              });
            }
            setMultiStoreyFloorUnits(floorData);
          }

          if (
            parsed.isResidentialSingle &&
            (!parsed.mergedFloorUnits || parsed.mergedFloorUnits.length === 0)
          ) {
            const totalFloors =
              parseInt(parsed.buildingInfo?.total_floors) || 1;
            const defaultYear = parsed.buildingInfo?.construction_year || "";
            const merged = [];
            for (let i = 0; i < totalFloors; i++) {
              merged.push({
                floor_number: i,
                construction_year: defaultYear,
                carpet_area_sqmt: "",
                occupancy_status: "Self",
                area: "",
                self_area: "",
                rented_area: "",
                occupier_name: "",
                occupier_mobile: "",
                has_kitchen: false,
                kitchen_count: "",
                kitchen_area: "",
                has_toilet: false,
                toilet_count: "",
                toilet_area: "",
                has_parking: false,
                parking_type: "NONE",
                parking_area: "",
              });
            }
            setMergedFloorUnits(merged);
          }

          return;
        }
      } catch (error) {
        console.log("Unable to restore draft cache:", error?.message || error);
      }

      hydrateFromResumeSurvey(survey);
    };

    restoreDraftProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSurveyId, resumeSurveyData]);

  const generateMapHTML = (lat, lng, polygons, selectedId) => {
    console.log("generateMapHTML called with:", {
      lat,
      lng,
      polygonCount: polygons?.length,
      selectedId,
    });

    const polygonJS = polygons
      .map((p) => {
        if (!p.parsedCoordinates || p.parsedCoordinates.length === 0) {
          console.warn(`Polygon ${p.id} has no parsed coordinates`);
          return "";
        }

        const coords = p.parsedCoordinates
          .map((c) => `[${c[0]}, ${c[1]}]`)
          .join(",");

        const isSelected = p.id === selectedId;
        const isCompleted = p.hasCompletedSurvey;
        const baseColor = isCompleted ? "#16a34a" : "#0f2d5c";
        const selectedColor = isCompleted ? "#15803d" : "#ff0000";

        return `
  var poly${p.id} = L.polygon([${coords}], {
    color: '${isSelected ? selectedColor : baseColor}',
    weight: ${isSelected ? 4 : 2},
    fillOpacity: ${isSelected ? 0.5 : 0.2}
  });

  poly${p.id}.addTo(map)
    .bindPopup("<b>${p?.polygon_code}</b><br/>Tap to select");

  allLayers.push(poly${p.id});

  ${isSelected ? `selectedLayer = poly${p.id};` : ""}

  poly${p.id}.on('click', function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'SELECT_POLYGON',
      id: ${p.id}
    }));
  });
`;
      })
      .join("\n");

    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
    <style>#map { height: 100vh; }</style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map = L.map('map').setView([${lat}, ${lng}], 17);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(map);

      // Array to collect all layers for bounds
      var allLayers = [];
      
      // Add location marker
      var marker = L.circleMarker([${lat}, ${lng}], { 
        radius: 8, 
        color: 'red', 
        fillColor: '#ff0000', 
        fillOpacity: 1 
      }).addTo(map);
      allLayers.push(marker);

      ${polygonJS}

      // Create a feature group and fit bounds to it
     // Track selected polygon
var selectedLayer = null;

${polygonJS}

// Zoom logic
if (selectedLayer) {
  map.flyToBounds(selectedLayer.getBounds(), {
    padding: [40, 40],
    maxZoom: 19,
    duration: 1.5
  });
} else if (allLayers.length > 0) {
  var group = L.featureGroup(allLayers);
  map.fitBounds(group.getBounds(), {
    padding: [30, 30],
    maxZoom: 18
  });
}
    </script>
  </body>
  </html>
  `;
  };

  function formatReverseGeocodedAddress(place) {
    if (!place) return "";

    const streetLine = [place.streetNumber, place.street]
      .filter(Boolean)
      .join(" ");

    const parts = [
      place.name,
      streetLine,
      place.subregion,
      place.city,
      place.region,
      place.postalCode,
      place.country,
    ].filter(Boolean);

    return [...new Set(parts)].join(", ");
  }

  // Average of a parcel's boundary vertices — good enough to reverse-geocode
  // a street address for the plot, and avoids pulling in a geometry library.
  const getPolygonCenter = (polygon) => {
    const ring = polygon?.parsedCoordinates;
    if (!Array.isArray(ring) || !ring.length) return null;
    let latSum = 0;
    let lngSum = 0;
    let n = 0;
    for (const point of ring) {
      const lat = Number(point?.[0]);
      const lng = Number(point?.[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        latSum += lat;
        lngSum += lng;
        n += 1;
      }
    }
    return n ? { latitude: latSum / n, longitude: lngSum / n } : null;
  };

  async function autoFillAddressFromLocation(latitude, longitude) {
    try {
      const locations = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (!locations?.length) return;

      const resolvedAddress = formatReverseGeocodedAddress(locations[0]);
      if (!resolvedAddress) return;

      setStep1Data((prev) => ({ ...prev, address: resolvedAddress }));
    } catch (error) {
      console.log("Reverse geocoding failed:", error?.message || error);
    }
  }


  const getLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: "Permission Denied",
          text2: "Location permission is required",
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Only used to centre the map / show "you are here". The address must
      // describe the parcel being surveyed, not wherever the surveyor is
      // standing, so it is filled from the selected polygon instead.
      setCoordinates({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Location Error",
        text2: error.message,
      });
    } finally {
      setLoadingLocation(false);
    }
  };

  // Loads every property polygon (not just what's near the surveyor) so the
  // Step 1 map shows the whole property list — the surveyor picks one by
  // tapping it, GPS proximity is no longer required.
  const fetchAllPolygons = async () => {
    setLoadingLocation(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/gis/polygons`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      const fetchedPolygons = (data.polygons || []).map((p) => {
        let parsedCoordinates = [];
        if (p.boundary) {
          try {
            const geoJSON = JSON.parse(p.boundary);
            if (geoJSON.type === "MultiPolygon") {
              parsedCoordinates = geoJSON.coordinates[0][0].map((coord) => [
                coord[1],
                coord[0],
              ]);
            }
          } catch (e) {
            console.error("Error parsing boundary:", e);
          }
        }
        return {
          ...p,
          parsedCoordinates,
          hasCompletedSurvey: !!p.survey_done,
          completedSurveyId: p.latest_survey_id || null,
        };
      });

      setPolygons(fetchedPolygons);
      if (!fetchedPolygons.length) {
        Toast.show({
          type: "info",
          text1: "No Properties Found",
          text2: "No property polygons have been uploaded yet.",
        });
      }
    } catch (error) {
      console.error("Fetch all polygons error:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load the property list",
      });
    } finally {
      setLoadingLocation(false);
    }
  };

  // ============================================================================
  // STEP 1: CREATE DRAFT SURVEY
  // ============================================================================
  const handleStep1CreateDraft = async () => {
    if (!selectedPolygon) {
      Toast.show({
        type: "error",
        text1: "Select Polygon",
        text2: "Please select a polygon to survey",
      });
      return;
    }

    if (!step1Data.address.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please enter property address",
      });
      return;
    }

    if (!step1Data.category_id) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please select building type",
      });
      return;
    }

    if (!step1Data.subtype_id) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please select building subtype",
      });
      return;
    }
    console.log("Step 1 Data:", step1Data);

    try {
      const result = await createDraft({
        polygon_code: selectedPolygon.polygon_code,
        ward_id: selectedPolygon.ward_id,
        address: step1Data.address,
        category_id: step1Data.category_id,
        subtype_id: step1Data.subtype_id,
      }).unwrap();

      console.log("🔍 Create Draft Response:", result);
      console.log("Response keys:", Object.keys(result));

      setSurveyId(result.survey_id || result.surveyId || result.id);
      if (result.property_code) setPropertyCode(result.property_code);
      // Try multiple possible keys for building ID
      const extractedBuildingId =
        result.building_id ||
        result.buildingId ||
        result.build_id ||
        result.PropertyUnit?.Building?.id;
      setBuildingId(extractedBuildingId);
      console.log(
        "✅ Survey ID set:",
        result.survey_id,
        "Building ID set:",
        extractedBuildingId,
      );

      if (!extractedBuildingId) {
        console.error(
          "❌ WARNING: No building ID found in response. This will cause floor addition to fail.",
        );
        console.error("Full response object:", JSON.stringify(result, null, 2));
      }

      // Pre-fill building info for later steps
      setBuildingInfo({
        ...buildingInfo,
        category_id: step1Data.category_id,
        subtype_id: step1Data.subtype_id,
      });

      Toast.show({
        type: "success",
        text1: "Draft Created",
        text2: "Survey draft created successfully",
      });

      await saveDraftProgressFor(result.survey_id, 2);
      setCurrentStep(2);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.data?.message || "Failed to create draft survey",
      });
    }
  };

  // ============================================================================
  // STEP 2: ADD PROPERTY DETAILS
  // ============================================================================
  const handleStep2PropertyDetails = async () => {
    if (!surveyId) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Survey not initialized. Please go back and try again.",
      });
      return;
    }

    const { isSimpleProperty, isResidentialMultiStorey } =
      getPropertyTypeFlags();

    // Validate required fields
    if (!propertyDetails.plot_area_sqmt) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please enter plot area",
      });
      return;
    }

    // Validate plot area is within ±10% of polygon area
    if (selectedPolygon?.area_sqmt) {
      const polygonArea = parseFloat(selectedPolygon.area_sqmt);
      const enteredArea = parseFloat(propertyDetails.plot_area_sqmt);
      const lowerLimit = polygonArea * 0.9;
      const upperLimit = polygonArea * 1.1;

      if (enteredArea < lowerLimit || enteredArea > upperLimit) {
        Toast.show({
          type: "error",
          text1: "Invalid Plot Area",
          text2: `Plot area must be within ±10% of polygon area (${lowerLimit.toFixed(2)} - ${upperLimit.toFixed(2)} sq.m)`,
        });
        return;
      }
    }

    // Validate at least one road side is selected
    const hasRoadSide = Object.values(roadSides).some((side) => side);
    if (!hasRoadSide) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please select at least one road side",
      });
      return;
    }

    for (const side of ["front", "back", "left", "right"]) {
      if (!roadSides[side]) {
        continue;
      }

      const carriagewayArea = propertyDetails[`carriageway_area_${side}`];
      const footpathArea = propertyDetails[`footpath_area_${side}`];

      if (carriagewayArea === "" || footpathArea === "") {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please enter carriageway and footpath (m) for ${side} side`,
        });
        return;
      }
    }

    if (isResidentialMultiStorey && photos.length === 0) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please add at least one property photo",
      });
      return;
    }

    // Validate owner fields for simple properties
    if (isSimpleProperty) {
      if (!propertyDetails.owner_name || !propertyDetails.mobile_number) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: "Please enter owner name and mobile number",
        });
        return;
      }

      if (!propertyDetails.owner_occupation?.trim()) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: "Please enter owner occupation",
        });
        return;
      }

      // Validate mobile number format
      if (!/^\d{10}$/.test(propertyDetails.mobile_number)) {
        Toast.show({
          type: "error",
          text1: "Invalid Mobile",
          text2: "Mobile number must be 10 digits",
        });
        return;
      }

      // Validate Aadhar if provided
      if (
        propertyDetails.aadhar_number &&
        !/^\d{12}$/.test(propertyDetails.aadhar_number)
      ) {
        Toast.show({
          type: "error",
          text1: "Invalid Aadhar",
          text2: "Aadhar number must be 12 digits",
        });
        return;
      }
    }

    try {
      const roadData = {};
      ["front", "back", "left", "right"].forEach((side) => {
        if (roadSides[side]) {
          roadData[`road_type_${side}`] = propertyDetails[`road_type_${side}`];
          roadData[`road_width_${side}`] =
            propertyDetails[`road_width_${side}`];
          roadData[`carriageway_area_${side}`] = parseAreaValue(
            propertyDetails[`carriageway_area_${side}`],
          );
          roadData[`footpath_area_${side}`] = parseAreaValue(
            propertyDetails[`footpath_area_${side}`],
          );
        } else {
          roadData[`road_type_${side}`] = null;
          roadData[`road_width_${side}`] = null;
          roadData[`carriageway_area_${side}`] = null;
          roadData[`footpath_area_${side}`] = null;
        }
      });

      // Prepare utility connections object for backend
      const utility_connections = {
        electricity: propertyDetails.has_electricity,
        gas: propertyDetails.has_gas_connection,
        water: propertyDetails.has_water_connection,
        internet: propertyDetails.has_internet_connection,
        solar: propertyDetails.has_solar,
        rainwater_harvesting: propertyDetails.has_rainwater_harvesting,
        sewerage: propertyDetails.has_sewer,
      };

      // Remove individual utility fields from data
      const {
        has_electricity,
        has_gas_connection,
        has_water_connection,
        has_internet_connection,
        has_solar,
        has_rainwater_harvesting,
        has_sewer,
        road_width_front,
        road_width_back,
        road_width_left,
        road_width_right,
        road_type_front,
        road_type_back,
        road_type_left,
        road_type_right,
        carriageway_area_front,
        carriageway_area_back,
        carriageway_area_left,
        carriageway_area_right,
        footpath_area_front,
        footpath_area_back,
        footpath_area_left,
        footpath_area_right,
        ...propertyDetailsData
      } = propertyDetails;

      // Upload the owner's bill photo (simple properties) to Cloudinary first,
      // then send the hosted URL instead of the local file path.
      let billPhotoUrl = propertyDetailsData.bill_photo_url;
      if (billPhotoUrl && !String(billPhotoUrl).startsWith("http")) {
        const billMap = await uploadSurveyPhotosToCloud([{ uri: billPhotoUrl }]);
        if (billMap[billPhotoUrl]) {
          billPhotoUrl = billMap[billPhotoUrl];
          setPropertyDetails((prev) => ({
            ...prev,
            bill_photo_url: billPhotoUrl,
          }));
        }
      }

      await addPropertyDetailsMutation({
        surveyId,
        data: {
          ...propertyDetailsData,
          ...roadData,
          bill_photo_url: billPhotoUrl,
          plot_area_sqmt: parseFloat(propertyDetails.plot_area_sqmt),
          ...(!isResidentialMultiStorey ? { utility_connections } : {}),
        },
      }).unwrap();

      const uploadedMap = await uploadSurveyPhotosToCloud(photos);
      applyUploadedPhotoUrls(uploadedMap);

      Toast.show({
        type: "success",
        text1: "Property Details Saved",
      });

      const { isVacant } = getPropertyTypeFlags();
      if (isVacant) {
        setIsVacantFlow(true);
        await saveDraftProgress(6);
        setCurrentStep(6);
      } else {
        await saveDraftProgress(3);
        setCurrentStep(3);
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.data?.message || "Failed to save property details",
      });
    }
  };

  // ============================================================================
  // STEP 3: ADD BUILDING INFO
  // ============================================================================
  const handleStep3BuildingInfo = async () => {
    // Validation for required fields
    if (!buildingInfo.total_floors || !buildingInfo.builtup_area_sqmt) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please enter total floors and built-up area",
      });
      return;
    }

    if (
      selectedPolygon?.hasCompletedSurvey &&
      selectedPolygon?.completedSurveyId
    ) {
      Toast.show({
        type: "info",
        text1: "Already Surveyed",
        text2: "This polygon already has a completed survey",
      });
      router.push(`/(surveyor)/property/${selectedPolygon.completedSurveyId}`);
      return;
    }

    if (
      buildingInfo.construction_year &&
      !isValidYearSpan(buildingInfo.construction_year)
    ) {
      Toast.show({
        type: "error",
        text1: "Invalid Construction Year",
        text2: "Please enter year span as YYYY-YYYY (example: 2023-2024)",
      });
      return;
    }

    try {
      const buildingResponse = await addBuildingInfoMutation({
        surveyId,
        data: {
          category_id: buildingInfo.category_id,
          subtype_id: buildingInfo.subtype_id,
          floors_above_ground: parseInt(buildingInfo.total_floors) || 1,
          floors_below_ground: parseInt(buildingInfo.floors_below_ground) || 0,
          builtup_area_sqmt: parseFloat(buildingInfo.builtup_area_sqmt) || 0,
          construction_year: getStartYearFromSpan(
            buildingInfo.construction_year,
          ),
          building_occupancy: buildingInfo.single_storey_occupancy,
        },
      }).unwrap();

      console.log("🔍 Building Info Response:", buildingResponse);
      console.log("Response keys:", Object.keys(buildingResponse || {}));

      // Extract buildingId from response if available
      if (buildingResponse?.data?.PropertyUnit?.Building?.id) {
        console.log(
          "✅ Setting buildingId from step 3 response:",
          buildingResponse.data.PropertyUnit.Building.id,
        );
        setBuildingId(buildingResponse.data.PropertyUnit.Building.id);
      } else if (buildingResponse?.PropertyUnit?.Building?.id) {
        console.log(
          "✅ Setting buildingId from step 3 response (direct):",
          buildingResponse.PropertyUnit.Building.id,
        );
        setBuildingId(buildingResponse.PropertyUnit.Building.id);
      } else if (buildingResponse?.id) {
        console.log(
          "✅ Setting buildingId from step 3 response (id field):",
          buildingResponse.id,
        );
        setBuildingId(buildingResponse.id);
      } else {
        console.warn(
          "⚠️ buildingId not found in building response. Will use the one from Step 1. Current buildingId:",
          buildingId,
        );
        // Fallback: fetch the survey to get the buildingId
        if (!buildingId) {
          console.log("⚠️ buildingId is null. Fetching from server...");
          await ensureBuildingId(surveyId);
        }
      }

      Toast.show({
        type: "success",
        text1: "Building Info Saved",
      });

      // Determine property type flags using step1Data (which has category_id / subtype_id)
      const {
        isResidentialSingle: isResSingle,
        isResidentialMultiStorey: isResMultiStorey,
        isNonResidentialSimple: isNonResSingle,
        isCommercialComplex: isComComplex,
        isMixed,
      } = getPropertyTypeFlags();

      // Sync state flags so later steps can reference them
      setIsResidentialSingle(isResSingle);
      setIsResidentialMultiStoreyFlow(isResMultiStorey);
      setIsNonResidentialSimpleFlow(isNonResSingle);
      setIsCommercialComplexFlow(isComComplex);
      setIsMixedFlow(isMixed);

      const totalFloors = parseInt(buildingInfo.total_floors) || 1;
      const floorsBelowGround = parseInt(buildingInfo.floors_below_ground) || 0;

      if (isResSingle) {
        // Residential Single → merged floor-units with RESIDENTIAL usage
        const singleStoreyOccupancy =
          buildingInfo.single_storey_occupancy || "Self";
        const initializedFloors = [];
        for (let i = 0; i < totalFloors; i++) {
          initializedFloors.push({
            floor_number: i,
            construction_year: buildingInfo.construction_year || "",
            carpet_area_sqmt: "",
            occupancy_status:
              singleStoreyOccupancy === "SelfRented"
                ? "Self"
                : singleStoreyOccupancy,
            area: "",
            self_area: "",
            rented_area: "",
            occupier_name: "",
            occupier_mobile: "",
            rent_amount: "",
            has_kitchen: false,
            kitchen_count: "",
            kitchen_area: "",
            has_toilet: false,
            toilet_count: "",
            toilet_area: "",
            has_parking: false,
            parking_type: "NONE",
            parking_area: "",
          });
        }
        for (let j = floorsBelowGround; j >= 1; j--) {
          initializedFloors.unshift({
            floor_number: -j,
            construction_year: buildingInfo.construction_year || "",
            carpet_area_sqmt: "",
            occupancy_status: "Self" || "Rented" || "Vacant" || "SelfRented",
            area: "",
            self_area: "",
            rented_area: "",
            occupier_name: "",
            occupier_mobile: "",
            rent_amount: "",
            has_kitchen: false,
            kitchen_count: "",
            kitchen_area: "",
            has_toilet: false,
            toilet_count: "",
            toilet_area: "",
            has_parking: false,
            parking_type: "NONE",
            parking_area: "",
          });
        }
        setMergedFloorUnits(initializedFloors);
        await saveDraftProgress(4, {
          isResidentialSingle: true,
          isResidentialMultiStoreyFlow: false,
          isNonResidentialSimpleFlow: false,
          isCommercialComplexFlow: false,
          isMixedFlow: false,
          mergedFloorUnits: initializedFloors,
          multiStoreyFloorUnits: [],
        });
        setCurrentStep(4);
      } else if (isResMultiStorey) {
        // Residential Multi-Storey → multi-storey floor-units with RESIDENTIAL usage
        const initializedFloors = await initializeMultiStoreyFloorUnits(
          totalFloors,
          floorsBelowGround,
          buildingInfo.construction_year,
        );
        await saveDraftProgress(4, {
          isResidentialSingle: false,
          isResidentialMultiStoreyFlow: true,
          isNonResidentialSimpleFlow: false,
          isCommercialComplexFlow: false,
          isMixedFlow: false,
          multiStoreyFloorUnits: initializedFloors,
          mergedFloorUnits: [],
        });
        setCurrentStep(4);
      } else if (isNonResSingle) {
        // NonResidential Commercial / PetrolPump → merged floor-units with COMMERCIAL usage
        const initializedFloors = Array.from(
          { length: totalFloors },
          (_, i) => ({
            floor_number: i,
            construction_year: buildingInfo.construction_year || "",
            carpet_area_sqmt: "",
            occupancy_status: "self",
            area: "",
            self_area: "",
            rented_area: "",
            occupier_name: "",
            occupier_mobile: "",
            has_kitchen: false,
            kitchen_count: "",
            kitchen_area: "",
            has_toilet: false,
            toilet_count: "",
            toilet_area: "",
            has_parking: false,
            parking_type: "NONE",
            parking_area: "",
          }),
        );
        setMergedFloorUnits(initializedFloors);
        await saveDraftProgress(4, {
          isResidentialSingle: false,
          isResidentialMultiStoreyFlow: false,
          isNonResidentialSimpleFlow: true,
          isCommercialComplexFlow: false,
          isMixedFlow: false,
          mergedFloorUnits: initializedFloors,
          multiStoreyFloorUnits: [],
        });
        setCurrentStep(4);
      } else if (isComComplex) {
        // NonResidential CommercialComplex → multi-storey floor-units with COMMERCIAL usage
        const initializedFloors = await initializeMultiStoreyFloorUnits(
          totalFloors,
          floorsBelowGround,
          buildingInfo.construction_year,
        );
        await saveDraftProgress(4, {
          isResidentialSingle: false,
          isResidentialMultiStoreyFlow: false,
          isNonResidentialSimpleFlow: false,
          isCommercialComplexFlow: true,
          isMixedFlow: false,
          multiStoreyFloorUnits: initializedFloors,
          mergedFloorUnits: [],
        });
        setCurrentStep(4);
      } else if (isMixed) {
        // Mixed → multi-storey floor-units; each unit can have its own usage_type
        const initializedFloors = await initializeMultiStoreyFloorUnits(
          totalFloors,
          floorsBelowGround,
          buildingInfo.construction_year,
        );
        await saveDraftProgress(4, {
          isResidentialSingle: false,
          isResidentialMultiStoreyFlow: false,
          isNonResidentialSimpleFlow: false,
          isCommercialComplexFlow: false,
          isMixedFlow: true,
          multiStoreyFloorUnits: initializedFloors,
          mergedFloorUnits: [],
        });
        setCurrentStep(4);
      } else {
        await saveDraftProgress(6);
        setCurrentStep(6);
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.data?.message || "Failed to save building info",
      });
    }
  };

  // ============================================================================
  // STEP 4: ADD FLOOR
  // ============================================================================
  const handleAddFloor = async () => {
    let activeBuildingId = buildingId;

    // If buildingId is still null, try to fetch it from the server
    if (!activeBuildingId && surveyId) {
      console.log("⚠️ buildingId is null. Attempting to fetch from server...");
      activeBuildingId = await ensureBuildingId(surveyId);
    }

    if (!activeBuildingId) {
      Toast.show({
        type: "error",
        text1: "Building Info Missing",
        text2: "Building ID not set. Please complete Steps 1-3 first.",
      });
      console.error(
        "❌ buildingId is not set. surveyId:",
        surveyId,
        "buildingId:",
        buildingId,
      );
      return;
    }

    if (
      currentFloorData.floor_number === "" ||
      !currentFloorData.construction_year
    ) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please enter floor number and construction year",
      });
      return;
    }

    if (!isValidYearSpan(currentFloorData.construction_year)) {
      Toast.show({
        type: "error",
        text1: "Invalid Construction Year",
        text2: "Please enter year span as YYYY-YYYY (example: 2023-2024)",
      });
      return;
    }

    try {
      const payload = {
        floor_number: parseInt(currentFloorData.floor_number),
        construction_year: getStartYearFromSpan(
          currentFloorData.construction_year,
        ),
        carpet_area: parseFloat(currentFloorData.carpet_area_sqmt) || null,
        usage_type_id: currentFloorData.usage_type_id ?? null,
      };

      console.log(
        "🏗️ Adding floor with buildingId:",
        activeBuildingId,
        "Type:",
        typeof activeBuildingId,
      );
      console.log("Floor payload:", payload);

      const result = await addFloorMutation({
        buildingId: Number(activeBuildingId),
        data: payload,
      }).unwrap();

      console.log("✅ Floor created successfully. Floor ID:", result?.id);

      // Save floor utilities to database
      if (result?.id) {
        console.log("💾 Saving utilities for floor ID:", result.id);
        await upsertFloorUtilitiesData(result.id, currentFloorData);
      }

      setFloors([...floors, result]);
      setCurrentFloorData({
        floor_number: "",
        construction_year: "",
        usage_type_id: null,
      });

      Toast.show({
        type: "success",
        text1: "Floor Added",
      });
    } catch (error) {
      console.error("❌ Add Floor Error:", error);
      console.error("Error data:", error.data);
      console.error("Error status:", error.status);
      console.error(
        "Building ID being sent:",
        activeBuildingId,
        "State buildingId:",
        buildingId,
      );
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.data?.message || "Failed to add floor",
      });
    }
  };

  const handleContinueToUnits = async () => {
    if (floors.length === 0) {
      Toast.show({
        type: "error",
        text1: "Add Floors",
        text2: "Please add at least one floor",
      });
      return;
    }
    await saveDraftProgress(stepAfterFloors);
    setCurrentStep(stepAfterFloors);
  };

  // ============================================================================
  // STEP 4 (MERGED): ADD FLOOR AND UNIT DATA FOR RESIDENTIAL SINGLE STORY
  // ============================================================================
  const handleSubmitMergedFloorUnits = async () => {
    if (submittingMergedFloorUnits) return;

    setSubmittingMergedFloorUnits(true);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));

    let activeBuildingId = buildingId;
    try {
      // If buildingId is still null, try to fetch it from the server
      if (!activeBuildingId && surveyId) {
        console.log(
          "⚠️ buildingId is null in handleSubmitMergedFloorUnits. Attempting to fetch from server...",
        );
        activeBuildingId = await ensureBuildingId(surveyId);
      }

      if (!activeBuildingId) {
        Toast.show({
          type: "error",
          text1: "Building Info Missing",
          text2: "Building ID not set. Please complete Steps 1-3 first.",
        });
        console.error(
          "❌ buildingId is not set in handleSubmitMergedFloorUnits",
        );
        return;
      }

      const selectedOccupancy = buildingInfo.single_storey_occupancy || "Self";
      const isMixedSingleStorey = selectedOccupancy === "SelfRented";

      // Validate all floors have required data
      for (let i = 0; i < mergedFloorUnits.length; i++) {
        const floorData = mergedFloorUnits[i];

        if (
          !isMixedSingleStorey &&
          floorData.occupancy_status !== selectedOccupancy
        ) {
          Toast.show({
            type: "error",
            text1: "Invalid Occupancy",
            text2: `For this building, ${getFloorName(i)} must be ${selectedOccupancy.replace("_", " ")}`,
          });
          return;
        }

        if (
          isMixedSingleStorey &&
          floorData.occupancy_status !== "Self" &&
          floorData.occupancy_status !== "Rented"
        ) {
          Toast.show({
            type: "error",
            text1: "Invalid Occupancy",
            text2: `For mixed occupancy, ${getFloorName(i)} must be Self or Rented`,
          });
          return;
        }

        // Basic validation
        if (!floorData.construction_year || !floorData.carpet_area_sqmt) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please fill construction year and carpet area for ${getFloorName(i)}`,
          });
          return;
        }

        if (!isValidYearSpan(floorData.construction_year)) {
          Toast.show({
            type: "error",
            text1: "Invalid Construction Year",
            text2: `Please enter year span as YYYY-YYYY for ${getFloorName(i)}`,
          });
          return;
        }

        // Validate area for Self, Rented, Vacant
        if (
          floorData.occupancy_status === "Self" ||
          floorData.occupancy_status === "Rented" ||
          floorData.occupancy_status === "Vacant"
        ) {
          if (!floorData.area) {
            Toast.show({
              type: "error",
              text1: "Missing Information",
              text2: `Please enter area for ${getFloorName(i)}`,
            });
            return;
          }
        }

        // Validate self/rented areas for SelfRented
        if (floorData.occupancy_status === "SelfRented") {
          if (!floorData.self_area || !floorData.rented_area) {
            Toast.show({
              type: "error",
              text1: "Missing Information",
              text2: `Please enter self and rented areas for ${getFloorName(i)}`,
            });
            return;
          }
        }

        // Validate occupier details if Rented or SelfRented
        if (
          floorData.occupancy_status === "Rented" ||
          floorData.occupancy_status === "SelfRented"
        ) {
          if (!floorData.occupier_name || !floorData.occupier_mobile) {
            Toast.show({
              type: "error",
              text1: "Missing Information",
              text2: `Please enter occupier details for ${getFloorName(i)}`,
            });
            return;
          }
        }

        // Validate kitchen details if has_kitchen
        if (floorData.has_kitchen) {
          if (!floorData.kitchen_count || !floorData.kitchen_area) {
            Toast.show({
              type: "error",
              text1: "Missing Information",
              text2: `Please enter kitchen count and area for ${getFloorName(i)}`,
            });
            return;
          }
        }

        // Validate toilet details if has_toilet
        if (floorData.has_toilet) {
          if (!floorData.toilet_count || !floorData.toilet_area) {
            Toast.show({
              type: "error",
              text1: "Missing Information",
              text2: `Please enter toilet count and area for ${getFloorName(i)}`,
            });
            return;
          }
        }

        // Validate parking details if has_parking (ground floor only)
        if (floorData.floor_number === 0 && floorData.has_parking) {
          if (!floorData.parking_area || floorData.parking_type === "NONE") {
            Toast.show({
              type: "error",
              text1: "Missing Information",
              text2: `Please enter parking type and area for ${getFloorName(i)}`,
            });
            return;
          }
        }
      }

      try {
        console.log(
          "Starting to save merged floor units. Total floors:",
          mergedFloorUnits.length,
        );
        const updatedMergedFloorUnits = [...mergedFloorUnits];

        // Add or update floors and units sequentially
        for (let i = 0; i < mergedFloorUnits.length; i++) {
          const floorData = mergedFloorUnits[i];
          console.log(`Processing floor ${i}:`, floorData.floor_number);

          try {
            const existingFloorId =
              floorData.id || findExistingFloorId(floorData.floor_number);

            const floorPayload = {
              floor_number: floorData.floor_number,
              construction_year: getStartYearFromSpan(
                floorData.construction_year,
              ),
              carpet_area: parseFloat(floorData.carpet_area_sqmt) || null,
              usage_type_id: null,
            };

            console.log(
              `🏗️ Saving floor ${floorData.floor_number} with buildingId:`,
              activeBuildingId,
              "existingFloorId:",
              existingFloorId,
            );

            const floorResponse = existingFloorId
              ? await updateFloorMutation({
                  floorId: existingFloorId,
                  data: floorPayload,
                }).unwrap()
              : await addFloorMutation({
                  buildingId: Number(activeBuildingId),
                  data: floorPayload,
                }).unwrap();

            const floorId =
              existingFloorId ||
              floorResponse?.data?.id ||
              floorResponse?.id ||
              floorResponse?.floorId;

            if (!floorId) {
              console.error(
                "❌ Floor ID not returned from floor save response:",
                floorResponse,
              );
              Toast.show({
                type: "error",
                text1: "Error",
                text2: `Failed to get floor ID for ${getFloorName(floorData.floor_number)}`,
              });
              continue; // Skip this floor, continue with others
            }

            console.log("✅ Floor saved successfully. Floor ID:", floorId);

            // Save floor utilities & occupancy for this floor
            await upsertFloorUtilitiesData(floorId, floorData);
            await upsertFloorOccupancyData(floorId, floorData);

            // Prepare residential details
            const residentialDetails = {
              family_count: 1,
              has_kitchen: floorData.has_kitchen,
              kitchen_count: floorData.has_kitchen
                ? parseInt(floorData.kitchen_count) || 0
                : null,
              kitchen_area_sqmt: floorData.has_kitchen
                ? parseFloat(floorData.kitchen_area) || null
                : null,
              has_toilet: floorData.has_toilet,
              toilet_count: floorData.has_toilet
                ? parseInt(floorData.toilet_count) || 0
                : null,
              toilet_area_sqmt: floorData.has_toilet
                ? parseFloat(floorData.toilet_area) || null
                : null,
              parking_type:
                floorData.floor_number === 0 && floorData.has_parking
                  ? floorData.parking_type
                  : "NONE",
              parking_area_sqmt:
                floorData.floor_number === 0 && floorData.has_parking
                  ? parseFloat(floorData.parking_area) || null
                  : null,
              construction_type: propertyDetails.construction_type || "PUCCA",
              occupier_name:
                floorData.occupancy_status === "Rented" ||
                floorData.occupancy_status === "SelfRented"
                  ? floorData.occupier_name
                  : null,
              occupier_mobile:
                floorData.occupancy_status === "Rented" ||
                floorData.occupancy_status === "SelfRented"
                  ? floorData.occupier_mobile
                  : null,
              rent_amount:
                floorData.occupancy_status === "Rented" ||
                floorData.occupancy_status === "SelfRented"
                  ? parseFloat(floorData.rent_amount) || null
                  : null,
              self_area_sqmt:
                floorData.occupancy_status === "SelfRented"
                  ? parseFloat(floorData.self_area) || null
                  : floorData.occupancy_status === "Self"
                    ? parseFloat(floorData.area) || null
                    : null,
              rented_area_sqmt:
                floorData.occupancy_status === "SelfRented"
                  ? parseFloat(floorData.rented_area) || null
                  : floorData.occupancy_status === "Rented"
                    ? parseFloat(floorData.area) || null
                    : null,
              vacant_area_sqmt:
                floorData.occupancy_status === "Vacant"
                  ? parseFloat(floorData.area) || null
                  : null,
              type_specific_attributes: {
                owner_occupation: propertyDetails.owner_occupation || null,
                is_disabled_person: propertyDetails.is_disabled_person || "NO",
              },
            };

            // Add or update unit for this floor
            const unitPayload = {
              floor_number: floorData.floor_number,
              unit_position: "FULL_FLOOR",
              carpet_area: parseFloat(floorData.carpet_area_sqmt) || null,
              usage_type: isNonResidentialSimpleFlow
                ? "COMMERCIAL"
                : "RESIDENTIAL",
              occupancy_status: floorData.occupancy_status,
              owner_name: null,
              mobile_number: null,
              has_kitchen: floorData.has_kitchen,
              toilet_count: floorData.has_toilet
                ? parseInt(floorData.toilet_count) || 0
                : null,
              parking_type:
                floorData.floor_number === 0 && floorData.has_parking
                  ? floorData.parking_type
                  : "NONE",
              residential_details: residentialDetails,
            };

            let unitId = floorData.unitId || null;
            if (unitId) {
              await updateUnitMutation({ unitId, data: unitPayload }).unwrap();
            } else {
              const unitResponse = await addUnitMutation({
                floorId,
                data: unitPayload,
              }).unwrap();
              unitId = unitResponse?.data?.id || unitResponse?.id || unitId;
            }

            updatedMergedFloorUnits[i] = {
              ...floorData,
              id: floorId,
              unitId,
            };
            console.log(
              `✅ Floor ${floorData.floor_number} and unit saved successfully`,
            );
          } catch (floorError) {
            console.error(
              `❌ Error saving floor ${floorData.floor_number}:`,
              floorError,
            );
            Toast.show({
              type: "error",
              text1: "Error",
              text2: `Failed to save ${getFloorName(floorData.floor_number)}: ${floorError.data?.message || floorError.message}`,
            });
            // Continue with next floor
          }
        }
        // console.log(
        //   "All floors and units added successfully",
        //   updatedMergedFloorUnits,
        // );
        setMergedFloorUnits(updatedMergedFloorUnits);
        setIsSavedSingleStoreyData(true);
        Toast.show({
          type: "success",
          text1: "Floor & Unit Details Saved",
        });

        await saveDraftProgress(6);
        setCurrentStep(6); // Move to photos
      } catch (error) {
        console.error("❌ Submit Merged Floor Units Error:", error);
        console.error("Error data:", error.data);
        console.error("Building ID:", buildingId);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: error.data?.message || "Failed to save floor and unit details",
        });
      }
    } finally {
      setSubmittingMergedFloorUnits(false);
    }
  };

  const getFloorName = (floorNumber) => {
    if (floorNumber < 0) {
      // Basement floors: -1 → "Basement -1", -2 → "Basement -2", etc.
      return `Basement ${floorNumber}`;
    }
    if (floorNumber === 0) return "Ground Floor";
    if (floorNumber === 1) return "First Floor";
    if (floorNumber === 2) return "Second Floor";
    if (floorNumber === 3) return "Third Floor";
    return `${floorNumber}th Floor`;
  };

  const findExistingFloorId = (floorNumber) => {
    const parsedFloorNumber = Number(floorNumber);
    const isNumberValid = !Number.isNaN(parsedFloorNumber);

    const match = floors.find((f) => {
      if (!f?.id) return false;
      if (isNumberValid) {
        return Number(f.floor_number) === parsedFloorNumber;
      }
      return String(f.floor_number) === String(floorNumber);
    });

    if (match?.id) return match.id;

    const resumeFloors = resumeSurveyData?.PropertyUnit?.Building?.Floors || [];
    const resumeMatch = resumeFloors.find((f) => {
      if (!f?.id) return false;
      if (isNumberValid) {
        return Number(f.floor_number) === parsedFloorNumber;
      }
      return String(f.floor_number) === String(floorNumber);
    });

    return resumeMatch?.id || null;
  };

  const getMappedFloorUse = (mode) => {
    if (mode === "UNIT_ONLY") return "Unit";
    if (mode === "PARKING_ONLY") return "Parking";
    if (mode === "BOTH") return "Both";
    return "Unit";
  };

  const getUiFloorUseMode = (floorUse) => {
    const normalized = String(floorUse || "")
      .trim()
      .toLowerCase();
    if (normalized === "parking" || normalized === "parking_only") {
      return "PARKING_ONLY";
    }
    if (normalized === "both") {
      return "BOTH";
    }
    return "UNIT_ONLY";
  };

  const deriveSavedParkingFloorIds = (floorList = []) =>
    floorList.reduce((acc, floor, index) => {
      const mode = getUiFloorUseMode(
        floor?.basement_floor_mode ||
          floor?.ground_floor_mode ||
          floor?.floor_use,
      );
      if (mode === "PARKING_ONLY" && floor?.id) {
        acc[index] = true;
      }
      return acc;
    }, {});

  const toInt = (v) => {
    const n = parseInt(v);
    return isNaN(n) ? null : n;
  };

  const toFloat = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const normalizeUnitMatchValue = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const findExistingUnitRecord = (floorNumber, unitData) => {
    const allUnits =
      resumeSurveyData?.PropertyUnit?.Building?.PropertyUnits || [];
    const unitsOnFloor = allUnits.filter((candidate) => {
      const candidateFloor =
        candidate?.floor_number ?? candidate?.Floor?.floor_number ?? null;
      return candidateFloor === floorNumber;
    });

    if (!unitsOnFloor.length) {
      return null;
    }

    const unitNumber = normalizeUnitMatchValue(unitData?.unit_number);
    const unitAddress = normalizeUnitMatchValue(unitData?.unit_address);

    if (unitNumber) {
      const byNumber = unitsOnFloor.find(
        (candidate) =>
          normalizeUnitMatchValue(candidate?.unit_number) === unitNumber,
      );
      if (byNumber) {
        return byNumber;
      }
    }

    if (unitAddress) {
      const byAddress = unitsOnFloor.find((candidate) => {
        const candidateAddress = normalizeUnitMatchValue(
          candidate?.UnitDetails?.type_specific_attributes?.unit_address,
        );
        return candidateAddress === unitAddress;
      });
      if (byAddress) {
        return byAddress;
      }
    }

    return null;
  };

  const ensureFloorSavedForUnitSubmission = async (floorIndex) => {
    const floor = multiStoreyFloorUnits[floorIndex];
    if (!floor) {
      throw new Error("Floor not found");
    }

    const getMappedFloorUse = (mode) => {
      if (mode === "UNIT_ONLY") return "Unit";
      if (mode === "PARKING_ONLY") return "Parking";
      if (mode === "BOTH") return "Both";
      return "Unit";
    };

    let activeBuildingId = buildingId;
    if (!activeBuildingId && surveyId) {
      activeBuildingId = await ensureBuildingId(surveyId);
    }

    if (!activeBuildingId) {
      throw new Error("Building ID not set. Please complete Steps 1-3 first.");
    }

    const normalizedFloorNumber = toInt(floor.floor_number);
    if (!Number.isFinite(normalizedFloorNumber)) {
      throw new Error(
        `Invalid floor number for ${getFloorName(floor.floor_number)}`,
      );
    }

    const safeParkingType =
      needsParking && floor.parking_type && floor.parking_type !== "undefined"
        ? floor.parking_type
        : "NONE";
    const safeParkingArea = needsParking
      ? toFloat(floor.parking_area) || null
      : null;

    const floorPayload = {
      floor_number: normalizedFloorNumber,
      construction_year: getStartYearFromSpan(floor.construction_year),
      carpet_area: toFloat(floor.floor_area_sqmt) || null,
      floor_use: getMappedFloorUse(floor.ground_floor_mode),
      number_of_units: parseInt(floor.unit_count) || 0,
      usage_type_id: null,
      has_parking: needsParking,
      parking_type: safeParkingType,
      parking_area: safeParkingArea,
    };

    const existingFloorId = floor.id || findExistingFloorId(floor.floor_number);

    const savedFloor = existingFloorId
      ? await updateFloorMutation({
          floorId: Number(existingFloorId),
          data: floorPayload,
        }).unwrap()
      : await addFloorMutation({
          buildingId: Number(activeBuildingId),
          data: floorPayload,
        }).unwrap();

    const floorId =
      savedFloor?.id || savedFloor?.data?.id || existingFloorId || floor.id;
    if (!floorId) {
      throw new Error(
        `Failed to save ${getFloorName(floor.floor_number)} before saving units`,
      );
    }

    const isGroundFloor = floor.floor_number === 0;
    const groundMode = floor.ground_floor_mode || "UNIT_ONLY";
    const needsParking =
      isGroundFloor && (groundMode === "PARKING_ONLY" || groundMode === "BOTH");

    await upsertFloorUtilitiesMutation({
      floorId,
      data: {
        has_kitchen: false,
        kitchen_count: null,
        kitchen_area: null,
        has_toilet: false,
        toilet_count: null,
        toilet_area: null,
        parking_type: needsParking ? floor.parking_type : "NONE",
        parking_area: needsParking ? toFloat(floor.parking_area) : null,
      },
    }).unwrap();

    setMultiStoreyFloorUnits((prev) => {
      const updated = [...prev];
      updated[floorIndex] = {
        ...updated[floorIndex],
        id: floorId,
      };
      return updated;
    });

    return floorId;
  };

  const handleSubmitMultiStoreyFloorUnits = async () => {
    if (!multiStoreyFloorUnits.length) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please configure floors and units",
      });
      return;
    }

    // Check if all floors with units have been saved
    for (let i = 0; i < multiStoreyFloorUnits.length; i++) {
      const floor = multiStoreyFloorUnits[i];
      const unitCount = parseInt(floor.unit_count || "0") || 0;
      const isGroundFloor = floor.floor_number === 0;
      const groundMode = floor.ground_floor_mode || "UNIT_ONLY";
      const needsUnits =
        !isGroundFloor || groundMode === "UNIT_ONLY" || groundMode === "BOTH";

      if (needsUnits && unitCount > 0 && !savedFloorUnits[i]) {
        Toast.show({
          type: "error",
          text1: "Save Units First",
          text2: `Please click "Save Unit Details" for ${getFloorName(floor.floor_number)} before continuing`,
        });
        return;
      }
    }

    let activeBuildingId = buildingId;

    // If buildingId is still null, try to fetch it from the server
    if (!activeBuildingId && surveyId) {
      console.log(
        "⚠️ buildingId is null in handleSubmitMultiStoreyFloorUnits. Attempting to fetch from server...",
      );
      activeBuildingId = await ensureBuildingId(surveyId);
    }

    if (!activeBuildingId) {
      Toast.show({
        type: "error",
        text1: "Building Info Missing",
        text2: "Building ID not set. Please complete Steps 1-3 first.",
      });
      console.error(
        "❌ buildingId is not set in handleSubmitMultiStoreyFloorUnits",
      );
      return;
    }

    try {
      const getMappedFloorUse = (mode) => {
        if (mode === "UNIT_ONLY") return "Unit";
        if (mode === "PARKING_ONLY") return "Parking";
        if (mode === "BOTH") return "Both";
        return "Unit";
      };

      console.log(
        "🏗️ Saving multi-storey floors with buildingId:",
        activeBuildingId,
      );

      // Create or update all floors in parallel
      const createdFloors = await Promise.all(
        multiStoreyFloorUnits.map((floor) => {
          const floorPayload = {
            floor_number: floor.floor_number,
            construction_year: getStartYearFromSpan(floor.construction_year),
            carpet_area: toFloat(floor.floor_area_sqmt) || null,
            floor_use: getMappedFloorUse(floor.ground_floor_mode),
            number_of_units: parseInt(floor.unit_count) || 0,
            // parking_type: floor.floor_number === 0 && floor.has_parking ? floor.parking_type : null,
            // parking_area: floor.floor_number === 0 && floor.has_parking ? toFloat(floor.parking_area) || null: null,
            usage_type_id: null,
          };

          if (floor.id) {
            return updateFloorMutation({
              floorId: floor.id,
              data: floorPayload,
            }).unwrap();
          }

          return addFloorMutation({
            buildingId: Number(activeBuildingId),
            data: floorPayload,
          }).unwrap();
        }),
      );
      for (let i = 0; i < createdFloors.length; i++) {
        const createdFloor = createdFloors[i];
        const floorData = multiStoreyFloorUnits[i];
        const floorId =
          createdFloor?.id || createdFloor?.data?.id || floorData?.id;
        if (floorId && floorData) {
          const needParking =
            floorData.floor_number === 0 &&
            (floorData.ground_floor_mode === "PARKING_ONLY" ||
              floorData.ground_floor_mode === "BOTH");
          await upsertFloorUtilitiesMutation({
            floorId,
            data: {
              has_kitchen: false,
              kitchen_count: null,
              kitchen_area: null,
              has_toilet: false,
              toilet_count: null,
              toilet_area: null,
              parking_type: needParking ? floorData.parking_type : "NONE",
              parking_area: needParking
                ? toFloat(floorData.parking_area)
                : null,
            },
          }).unwrap();
          console.log(
            `✅ Saved floor ${getFloorName(floorData.floor_number)} with ID:`,
            floorId,
          );
        }
      }

      console.log("✅ All floors saved successfully");

      // Save utilities and occupancy for each created floor
      console.log("💾 Saving utilities and occupancy for all floors...");
      for (let i = 0; i < createdFloors.length; i++) {
        const createdFloor = createdFloors[i];
        const floorData = multiStoreyFloorUnits[i];
        const floorId =
          createdFloor?.id || createdFloor?.data?.id || floorData?.id;
        if (floorId && floorData) {
          console.log(
            `Saving utilities for floor ${floorData.floor_number} (ID: ${floorId})`,
          );
          await upsertFloorUtilitiesData(floorId, floorData);

          console.log(
            `Saving occupancy for floor ${floorData.floor_number} (ID: ${floorId})`,
          );
          // For multi-storey, get first unit's occupancy data
          const firstUnit = (floorData.units || [])[0];
          if (firstUnit) {
            await upsertFloorOccupancyData(floorId, firstUnit);
          }
        }
      }

      setFloors(createdFloors);
      setMultiStoreyFloorUnits((prev) =>
        prev.map((floor, index) => ({
          ...floor,
          id:
            createdFloors[index]?.id ||
            createdFloors[index]?.data?.id ||
            floor.id ||
            null,
        })),
      );
      Toast.show({
        type: "success",
        text1: "Floors Saved Successfully",
        text2: "All floors have been created or updated successfully.",
      });

      await saveDraftProgress(7);
      setCurrentStep(7);
    } catch (error) {
      console.error("❌ Submit Multi-Storey Floor Units Error:", error);
      console.error("Error data:", error.data);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.data?.message || "Failed to save floor details",
      });
    }
  };

  const saveUnitDetailsOnly = async (floorIndex) => {
    try {
      setSavingUnitDetails(true);
      setSavingFloorIndex(floorIndex);

      const floor = multiStoreyFloorUnits[floorIndex];
      let activeBuildingId = buildingId;
      if (!activeBuildingId && surveyId) {
        console.log(
          "⚠️ buildingId is null in saveUnitDetailsOnly. Attempting to fetch from server...",
        );
        activeBuildingId = await ensureBuildingId(surveyId);
      }
      console.log(
        "Active building ID at saveUnitDetailsOnly start:",
        activeBuildingId,
      );
      if (!floor) {
        throw new Error("Floor not found");
      }

      // Validate floor data
      if (!floor.construction_year) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please enter construction year for ${getFloorName(floorIndex)}`,
        });
        return;
      }

      if (!isValidYearSpan(floor.construction_year)) {
        Toast.show({
          type: "error",
          text1: "Invalid Construction Year",
          text2: `Please enter year span as YYYY-YYYY for ${getFloorName(floorIndex)}`,
        });
        return;
      }

      const unitCount = parseInt(floor.unit_count || "0") || 0;
      const isGroundFloor = floor.floor_number === 0;
      const groundMode = floor.ground_floor_mode || "UNIT_ONLY";
      const needsParking =
        isGroundFloor &&
        (groundMode === "PARKING_ONLY" || groundMode === "BOTH");
      const needsUnits =
        !isGroundFloor || groundMode === "UNIT_ONLY" || groundMode === "BOTH";

      // Validate parking data if needed
      if (needsParking) {
        if (floor.parking_type === "NONE" || !floor.parking_area) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please enter parking type and area for ${getFloorName(floorIndex)}`,
          });
          return;
        }
      }

      if (!needsUnits) {
        // Mark this floor's units as saved (empty case - no units needed)
        setSavedFloorUnits((prev) => ({
          ...prev,
          [floorIndex]: true,
        }));
        setSavedUnitCounts((prev) => ({
          ...prev,
          [floorIndex]: 0,
        }));
        setUnsavedFloorUnits((prev) => {
          const newState = { ...prev };
          delete newState[floorIndex];
          return newState;
        });
        Toast.show({
          type: "success",
          text1: "Data Saved ✓",
          text2: `${getFloorName(floorIndex)} parking details saved`,
        });
        return;
      }

      if (unitCount <= 0) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please add at least one unit for ${getFloorName(floorIndex)}`,
        });
        return;
      }

      const newUnitIndexes = (floor.units || [])
        .map((unit, idx) => (unit.id == null ? idx : -1))
        .filter((idx) => idx !== -1);

      if (newUnitIndexes.length === 0) {
        Toast.show({
          type: "info",
          text1: "No new units to save",
          text2: "All units on this floor are already saved.",
        });
        return;
      }

      // Validate only new unsaved units before saving to database
      for (const j of newUnitIndexes) {
        const unit = floor.units[j];
        const unitLabel = `${getFloorName(floorIndex)} - Unit ${j + 1}`;

        if (
          !unit.unit_address ||
          !unit.carpet_area_sqmt ||
          !unit.construction_year
        ) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please fill address, carpet area and construction year for ${unitLabel}`,
          });
          return;
        }

        if (!isValidYearSpan(unit.construction_year)) {
          Toast.show({
            type: "error",
            text1: "Invalid Construction Year",
            text2: `Please enter year span as YYYY-YYYY for ${unitLabel}`,
          });
          return;
        }

        if (!unit.owner_name || !unit.owner_mobile) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please enter owner details for ${unitLabel}`,
          });
          return;
        }

        if (!unit.owner_occupation?.trim()) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please enter owner occupation for ${unitLabel}`,
          });
          return;
        }

        if (!/^\d{10}$/.test(unit.owner_mobile)) {
          Toast.show({
            type: "error",
            text1: "Invalid Mobile",
            text2: `Owner mobile must be 10 digits for ${unitLabel}`,
          });
          return;
        }

        if (
          !unit.father_husband_name ||
          !unit.aadhar_number ||
          !unit.bill_photo_url
        ) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please enter father/husband name, Aadhar and bill proof for ${unitLabel}`,
          });
          return;
        }

        if (!/^\d{12}$/.test(unit.aadhar_number)) {
          Toast.show({
            type: "error",
            text1: "Invalid Aadhar",
            text2: `Aadhar must be 12 digits for ${unitLabel}`,
          });
          return;
        }

        if (
          (unit.occupancy_status === "Rented" ||
            unit.occupancy_status === "SelfRented") &&
          (!unit.occupier_name || !unit.occupier_mobile)
        ) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please enter occupier details for ${unitLabel}`,
          });
          return;
        }

        if (
          (unit.occupancy_status === "Rented" ||
            unit.occupancy_status === "SelfRented") &&
          !/^\d{10}$/.test(unit.occupier_mobile)
        ) {
          Toast.show({
            type: "error",
            text1: "Invalid Mobile",
            text2: `Occupier mobile must be 10 digits for ${unitLabel}`,
          });
          return;
        }

        if (
          (unit.occupancy_status === "Self" ||
            unit.occupancy_status === "Rented" ||
            unit.occupancy_status === "Vacant") &&
          !unit.area
        ) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please enter area for ${unitLabel}`,
          });
          return;
        }

        if (
          unit.occupancy_status === "SelfRented" &&
          (!unit.self_area || !unit.rented_area)
        ) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please enter self and rented area for ${unitLabel}`,
          });
          return;
        }

        if (unit.has_kitchen && (!unit.kitchen_count || !unit.kitchen_area)) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please enter kitchen count and area for ${unitLabel}`,
          });
          return;
        }

        if (unit.has_toilet && (!unit.toilet_count || !unit.toilet_area)) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please enter toilet count and area for ${unitLabel}`,
          });
          return;
        }

        if (
          !Array.isArray(unit.photos) ||
          !unit.photos.some((photo) => Boolean(photo?.uri || photo?.image_url))
        ) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please add at least one unit photo for ${unitLabel}`,
          });
          return;
        }
      }
      if (photos && photos.length === 0 && images && images.length === 0) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: "Please add at least one property photo",
        });
        return;
      }

      console.log(
        `🚀 Starting unit details save to database for ${getFloorName(floorIndex)}...`,
      );

      let floorId = await ensureFloorSavedForUnitSubmission(floorIndex);
      const normalizedFloorNumber = toInt(floor.floor_number);
      if (!Number.isFinite(normalizedFloorNumber)) {
        throw new Error(
          `Invalid floor number for ${getFloorName(floorIndex)} before saving units`,
        );
      }

      // Step 2: Create each unit with all related data
      const createdUnitIds = [];
      const updatedUnits = [...(floor.units || [])];

      for (const j of newUnitIndexes) {
        const unit = updatedUnits[j];
        const unitLabel = `${getFloorName(floorIndex)} - Unit ${j + 1}`;

        try {
          console.log(`📝 Creating ${unitLabel}...`);

          // Create unit
          const createdUnit = await addUnitMutation({
            floorId,
            data: {
              floor_number: normalizedFloorNumber,
              unit_position: "FULL_FLOOR",
              unit_number: toInt(unit.unit_number) || j + 1,
              unit_address: unit.unit_address,
              carpet_area: toFloat(unit.carpet_area_sqmt) || null,
              construction_year: getStartYearFromSpan(unit.construction_year),
              occupancy_status: unit.occupancy_status,
              unit_area_sqmt: toFloat(unit.area || unit.self_area || null),
              occupant_name:
                unit.occupancy_status === "Rented" ||
                unit.occupancy_status === "SelfRented"
                  ? unit.occupier_name
                  : null,
              occupant_mobile:
                unit.occupancy_status === "Rented" ||
                unit.occupancy_status === "SelfRented"
                  ? unit.occupier_mobile
                  : null,
              rent_amount:
                unit.occupancy_status === "Rented" ||
                unit.occupancy_status === "SelfRented"
                  ? toFloat(unit.rent_amount)
                  : null,
            },
          }).unwrap();

          const unitId = createdUnit?.id || createdUnit?.data?.id;
          if (!unitId) {
            throw new Error(`No unit ID returned for ${unitLabel}`);
          }

          createdUnitIds.push(unitId);
          updatedUnits[j] = { ...updatedUnits[j], id: unitId };
          console.log(`✅ Unit created: ${unitLabel} (ID: ${unitId})`);

          // Add unit owner details
          console.log(`📝 Adding owner details for ${unitLabel}...`);
          const ownerResult = await addUnitOwnerMutation({
            unitId,
            data: {
              owner_name: unit.owner_name,
              mobile: unit.owner_mobile,
              father_or_husband_name: unit.father_husband_name,
              aadhar: unit.aadhar_number,
              occupation: unit.owner_occupation,
              disabled_person: unit.is_disabled_person || "NO",
            },
          }).unwrap();
          const ownerId = ownerResult?.id || ownerResult?.data?.id;
          if (ownerId) {
            updatedUnits[j] = { ...updatedUnits[j], owner_id: ownerId };
          }
          console.log(`✅ Owner details saved for ${unitLabel}`);

          // Add unit utilities
          console.log(`📝 Adding utilities for ${unitLabel}...`);
          await upsertUnitUtilitiesMutation({
            unitId,
            data: {
              electric_connection: unit.has_electricity || false,
              gas_connection: unit.has_gas_connection || false,
              has_solar: unit.has_solar || false,
              water_connection: unit.has_water_connection || false,
              sewer_connection: unit.has_sewer || false,
              internet_connection: unit.has_internet_connection || false,
              has_kitchen: unit.has_kitchen || false,
              kitchen_count: unit.has_kitchen
                ? toInt(unit.kitchen_count)
                : null,
              kitchen_area: unit.has_kitchen
                ? toFloat(unit.kitchen_area)
                : null,
              has_toilet: unit.has_toilet || false,
              toilet_count: unit.has_toilet ? toInt(unit.toilet_count) : null,
              toilet_area: unit.has_toilet ? toFloat(unit.toilet_area) : null,
            },
          }).unwrap();
          console.log(`✅ Utilities saved for ${unitLabel}`);

          const safeParkingType =
            needsParking &&
            floor.parking_type &&
            floor.parking_type !== "undefined"
              ? floor.parking_type
              : "NONE";
          const safeParkingArea = needsParking
            ? toFloat(floor.parking_area) || null
            : null;

          const FloorDatapayload = {
            floor_number: normalizedFloorNumber,
            construction_year: getStartYearFromSpan(floor.construction_year),
            carpet_area: toFloat(floor.floor_area_sqmt) || null,
            floor_use: getMappedFloorUse(floor.ground_floor_mode),
            number_of_units: isNaN(parseInt(floor.unit_count))
              ? 0
              : parseInt(floor.unit_count),
            usage_type_id: null,
            has_parking: needsParking,
            parking_type: safeParkingType,
            parking_area: safeParkingArea,
          };
          const ExistingFloorId =
            floor.id || findExistingFloorId(floor.floor_number);

          console.log(
            "Existing floor ID for unit submission:",
            ExistingFloorId,
          );
          const savedFloor = ExistingFloorId
            ? await updateFloorMutation({
                floorId: Number(ExistingFloorId),
                data: FloorDatapayload,
              }).unwrap()
            : await addFloorMutation({
                buildingId: Number(activeBuildingId),
                data: FloorDatapayload,
              }).unwrap();
          const savedFloorId = savedFloor?.id || savedFloor?.data?.id;
          console.log("Saved floor ID for unit submission:", savedFloorId);

          if (!savedFloorId) {
            throw new Error(`No floor ID returned for ${unitLabel}`);
          }
          updatedUnits[j] = { ...updatedUnits[j], floor_id: savedFloorId };
          console.log(`✅ Floor saved for ${unitLabel}`);

          // Upload this unit's photos to Cloudinary; keep returned URLs so we
          // never re-upload them on the next save.
          const photoUpdates = await syncUnitPhotos(unitId, unit);
          updatedUnits[j] = { ...updatedUnits[j], ...photoUpdates };
        } catch (unitError) {
          console.error(`❌ Error saving ${unitLabel}:`, unitError);
          Toast.show({
            type: "error",
            text1: "Error",
            text2: `Failed to save ${unitLabel}: ${unitError?.data?.message || unitError?.message}`,
          });
          return;
        }
      }

      const nextMultiStoreyFloorUnits = [...multiStoreyFloorUnits];
      nextMultiStoreyFloorUnits[floorIndex] = {
        ...nextMultiStoreyFloorUnits[floorIndex],
        id: floorId,
        units: updatedUnits,
      };
      setMultiStoreyFloorUnits(nextMultiStoreyFloorUnits);

      // Mark floor units as saved
      const nextSavedFloorUnits = {
        ...savedFloorUnits,
        [floorIndex]: true,
      };
      const nextUnsavedFloorUnits = {
        ...unsavedFloorUnits,
        [floorIndex]: false,
      };
      const nextSavedUnitCounts = {
        ...savedUnitCounts,
        [floorIndex]: (floor.units || []).length,
      };
      setSavedFloorUnits(nextSavedFloorUnits);
      setUnsavedFloorUnits(nextUnsavedFloorUnits);
      setSavedUnitCounts(nextSavedUnitCounts);

      console.log(`✅ All units saved for ${getFloorName(floorIndex)}`);
      Toast.show({
        type: "success",
        text1: "Data Saved ✓",
        text2: `All ${createdUnitIds.length} unit(s) saved successfully`,
      });

      await saveDraftProgress(currentStep, {
        multiStoreyFloorUnits: nextMultiStoreyFloorUnits,
        savedFloorUnits: nextSavedFloorUnits,
        unsavedFloorUnits: nextUnsavedFloorUnits,
        savedUnitCounts: nextSavedUnitCounts,
      });
    } catch (error) {
      console.error("❌ Error saving unit details:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error?.message || "Failed to save unit details",
      });
    } finally {
      setSavingUnitDetails(false);
      setSavingFloorIndex(null);
    }
  };
  // ✅ FIX: Update only the specific unit being edited
  // - Does NOT create + update (prevents duplicate entries)
  // - Does NOT update multiple units at once
  // - Only processes the unit at unitIndex position
  const updateUnitDetailsOnly = async (floorIndex, unitIndex) => {
    setSavingUnitDetails(true);
    setSavingFloorIndex(floorIndex);
    setSavingUnitIndex(unitIndex);

    try {
      const floor = multiStoreyFloorUnits[floorIndex];
      if (!floor) {
        throw new Error("Floor not found");
      }

      // Validate floor data
      if (!floor.construction_year) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please enter construction year for ${getFloorName(floorIndex)}`,
        });
        return;
      }

      if (!isValidYearSpan(floor.construction_year)) {
        Toast.show({
          type: "error",
          text1: "Invalid Construction Year",
          text2: `Please enter year span as YYYY-YYYY for ${getFloorName(floorIndex)}`,
        });
        return;
      }

      const unitCount = parseInt(floor.unit_count || "0") || 0;
      const isGroundFloor = floor.floor_number === 0;
      const groundMode = floor.ground_floor_mode || "UNIT_ONLY";
      const needsParking =
        isGroundFloor &&
        (groundMode === "PARKING_ONLY" || groundMode === "BOTH");
      const needsUnits =
        !isGroundFloor || groundMode === "UNIT_ONLY" || groundMode === "BOTH";

      // Validate parking data if needed
      if (needsParking) {
        if (floor.parking_type === "NONE" || !floor.parking_area) {
          Toast.show({
            type: "error",
            text1: "Missing Information",
            text2: `Please enter parking type and area for ${getFloorName(floorIndex)}`,
          });
          return;
        }
      }

      if (!needsUnits) {
        // Mark this floor's units as saved (empty case - no units needed)
        setSavedUnitCounts((prev) => ({
          ...prev,
          [floorIndex]: 0,
        }));
        setUnsavedFloorUnits((prev) => {
          const newState = { ...prev };
          delete newState[floorIndex];
          return newState;
        });
        Toast.show({
          type: "success",
          text1: "Data Saved ✓",
          text2: `${getFloorName(floorIndex)} parking details saved`,
        });
        return;
      }

      if (unitCount <= 0) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please add at least one unit for ${getFloorName(floorIndex)}`,
        });
        return;
      }

      // ✅ VALIDATE ONLY THE SPECIFIC UNIT BEING UPDATED
      const unit = floor.units?.[unitIndex];
      if (!unit) {
        throw new Error(`Unit at index ${unitIndex} not found`);
      }

      const unitLabel = `${getFloorName(floorIndex)} - Unit ${unitIndex + 1}`;

      if (
        !unit.unit_address ||
        !unit.carpet_area_sqmt ||
        !unit.construction_year
      ) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please fill address, carpet area and construction year for ${unitLabel}`,
        });
        return;
      }

      if (!isValidYearSpan(unit.construction_year)) {
        Toast.show({
          type: "error",
          text1: "Invalid Construction Year",
          text2: `Please enter year span as YYYY-YYYY for ${unitLabel}`,
        });
        return;
      }

      if (!unit.owner_name || !unit.owner_mobile) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please enter owner details for ${unitLabel}`,
        });
        return;
      }

      if (!unit.owner_occupation?.trim()) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please enter owner occupation for ${unitLabel}`,
        });
        return;
      }

      if (!/^\d{10}$/.test(unit.owner_mobile)) {
        Toast.show({
          type: "error",
          text1: "Invalid Mobile",
          text2: `Owner mobile must be 10 digits for ${unitLabel}`,
        });
        return;
      }

      if (
        !unit.father_husband_name ||
        !unit.aadhar_number ||
        !unit.bill_photo_url
      ) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please enter father/husband name, Aadhar and bill proof for ${unitLabel}`,
        });
        return;
      }

      if (!/^\d{12}$/.test(unit.aadhar_number)) {
        Toast.show({
          type: "error",
          text1: "Invalid Aadhar",
          text2: `Aadhar must be 12 digits for ${unitLabel}`,
        });
        return;
      }

      if (
        (unit.occupancy_status === "Rented" ||
          unit.occupancy_status === "SelfRented") &&
        (!unit.occupier_name || !unit.occupier_mobile)
      ) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please enter occupier details for ${unitLabel}`,
        });
        return;
      }

      if (
        (unit.occupancy_status === "Rented" ||
          unit.occupancy_status === "SelfRented") &&
        !/^\d{10}$/.test(unit.occupier_mobile)
      ) {
        Toast.show({
          type: "error",
          text1: "Invalid Mobile",
          text2: `Occupier mobile must be 10 digits for ${unitLabel}`,
        });
        return;
      }

      if (
        (unit.occupancy_status === "Self" ||
          unit.occupancy_status === "Rented" ||
          unit.occupancy_status === "Vacant") &&
        !unit.area
      ) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please enter area for ${unitLabel}`,
        });
        return;
      }

      if (
        unit.occupancy_status === "SelfRented" &&
        (!unit.self_area || !unit.rented_area)
      ) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please enter self and rented area for ${unitLabel}`,
        });
        return;
      }

      if (unit.has_kitchen && (!unit.kitchen_count || !unit.kitchen_area)) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please enter kitchen count and area for ${unitLabel}`,
        });
        return;
      }

      if (unit.has_toilet && (!unit.toilet_count || !unit.toilet_area)) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please enter toilet count and area for ${unitLabel}`,
        });
        return;
      }

      if (
        !Array.isArray(unit.photos) ||
        !unit.photos.some((photo) => Boolean(photo?.uri || photo?.image_url))
      ) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: `Please add at least one unit photo for ${unitLabel}`,
        });
        return;
      }

      if (photos && photos.length === 0) {
        Toast.show({
          type: "error",
          text1: "Missing Information",
          text2: "Please add at least one property photo",
        });
        return;
      }

      console.log(
        `🚀 Starting unit details update to database for ${unitLabel}...`,
      );

      let floorId = await ensureFloorSavedForUnitSubmission(floorIndex);

      const existedFloor = multiStoreyFloorUnits[floorIndex];
      const updatedUnits = [...(existedFloor.units || [])];
      const processedUnitIds = [];

      // ✅ ONLY PROCESS THE SPECIFIC UNIT AT unitIndex
      {
        const j = unitIndex;
        const unitToProcess = updatedUnits[j];
        const unitLabelForProcess = `${getFloorName(floorIndex)} - Unit ${j + 1}`;

        try {
          console.log(`📝 Processing ${unitLabelForProcess}...`);

          const normalizedFloorNumber = toInt(floor.floor_number);
          if (!Number.isFinite(normalizedFloorNumber)) {
            throw new Error(
              `Invalid floor number for ${getFloorName(floorIndex)} before updating units`,
            );
          }

          const unitPayload = {
            floor_number: normalizedFloorNumber,
            unit_position: "FULL_FLOOR",
            unit_number: toInt(unitToProcess.unit_number) || j + 1,
            unit_address: unitToProcess.unit_address,
            carpet_area: toFloat(unitToProcess.carpet_area_sqmt),
            construction_year: getStartYearFromSpan(
              unitToProcess.construction_year,
            ),
            occupancy_status: unitToProcess.occupancy_status,
            unit_area_sqmt: toFloat(
              unitToProcess.area || unitToProcess.self_area || null,
            ),
            occupant_name:
              unitToProcess.occupancy_status === "Rented" ||
              unitToProcess.occupancy_status === "SelfRented"
                ? unitToProcess.occupier_name
                : null,
            occupant_mobile:
              unitToProcess.occupancy_status === "Rented" ||
              unitToProcess.occupancy_status === "SelfRented"
                ? unitToProcess.occupier_mobile
                : null,
            rent_amount:
              unitToProcess.occupancy_status === "Rented" ||
              unitToProcess.occupancy_status === "SelfRented"
                ? toFloat(unitToProcess.rent_amount)
                : null,
          };

          let unitId = unitToProcess.id;
          let isNewlyCreatedUnit = false;

          // ✅ CRITICAL FIX: Prevent creating and then updating the same unit (duplicate entries)
          // Before: Would call addUnitMutation() then always call updateUnitMutation()
          // After: Only call updateUnitMutation() if unit already existed
          if (!unitId) {
            const existingUnit = findExistingUnitRecord(
              floor.floor_number,
              unitToProcess,
            );

            if (existingUnit?.id) {
              // ✅ Found existing unit in database - will UPDATE it
              unitId = existingUnit.id;
              updatedUnits[j] = {
                ...updatedUnits[j],
                id: unitId,
                owner_id: updatedUnits[j].owner_id || existingUnit.owner_id,
              };
              console.log(
                `Matched existing unit for update: ${unitLabel} (ID: ${unitId})`,
              );
            } else {
              // ✅ Creating NEW unit - won't update after creating
              console.log(`Creating new unit record for ${unitLabel}...`);
              const createdUnit = await addUnitMutation({
                floorId,
                data: unitPayload,
              }).unwrap();
              unitId = createdUnit?.id || createdUnit?.data?.id;

              if (!unitId) {
                throw new Error(`No unit ID returned for ${unitLabel}`);
              }

              updatedUnits[j] = { ...updatedUnits[j], id: unitId };
              isNewlyCreatedUnit = true;
              console.log(`✅ New unit created: ${unitLabel} (ID: ${unitId})`);
            }
          }

          // ✅ ONLY update if unit existed before (not just created)
          if (!isNewlyCreatedUnit) {
            await updateUnitMutation({ unitId, data: unitPayload }).unwrap();
            console.log(`✅ Unit updated: ${unitLabel} (ID: ${unitId})`);
          }

          processedUnitIds.push(unitId);

          // Owner update / create
          const ownerPayload = {
            owner_name: unitToProcess.owner_name,
            mobile: unitToProcess.owner_mobile,
            father_or_husband_name: unitToProcess.father_husband_name,
            aadhar: unitToProcess.aadhar_number,
            occupation: unitToProcess.owner_occupation,
            disabled_person: unitToProcess.is_disabled_person || "NO",
          };

          if (unitToProcess.owner_id) {
            await updateUnitOwnerMutation({
              ownerId: unitToProcess.owner_id,
              data: ownerPayload,
            }).unwrap();
            console.log(`✅ Owner updated for ${unitLabelForProcess}`);
          } else {
            const ownerResult = await addUnitOwnerMutation({
              unitId,
              data: ownerPayload,
            }).unwrap();

            const ownerId = ownerResult?.id || ownerResult?.data?.id;
            if (ownerId) {
              updatedUnits[j] = { ...updatedUnits[j], owner_id: ownerId };
            }
            console.log(`✅ Owner created for ${unitLabelForProcess}`);
          }

          // Utilities upsert
          await upsertUnitUtilitiesMutation({
            unitId,
            data: {
              electric_connection: unitToProcess.has_electricity || false,
              gas_connection: unitToProcess.has_gas_connection || false,
              has_solar: unitToProcess.has_solar || false,
              water_connection: unitToProcess.has_water_connection || false,
              sewer_connection: unitToProcess.has_sewer || false,
              internet_connection:
                unitToProcess.has_internet_connection || false,
              has_kitchen: unitToProcess.has_kitchen || false,
              kitchen_count: unitToProcess.has_kitchen
                ? toInt(unitToProcess.kitchen_count)
                : null,
              kitchen_area: unitToProcess.has_kitchen
                ? toFloat(unitToProcess.kitchen_area)
                : null,
              has_toilet: unitToProcess.has_toilet || false,
              toilet_count: unitToProcess.has_toilet
                ? toInt(unitToProcess.toilet_count)
                : null,
              toilet_area: unitToProcess.has_toilet
                ? toFloat(unitToProcess.toilet_area)
                : null,
              parking_type: needsParking ? floor.parking_type : "NONE",
              parking_area: needsParking ? toFloat(floor.parking_area) : null,
            },
          }).unwrap();

          const updatedFloorPayload = {
            floor_number: normalizedFloorNumber,
            construction_year: getStartYearFromSpan(floor.construction_year),
            carpet_area: toFloat(floor.floor_area_sqmt) || null,
            floor_use: getMappedFloorUse(floor.ground_floor_mode),
            number_of_units: isNaN(parseInt(floor.unit_count))
              ? 0
              : parseInt(floor.unit_count),
            parking_type: needsParking ? floor.parking_type : "NONE",
            parking_area: needsParking ? toFloat(floor.parking_area) : null,
            usage_type_id: null,
          };
          const ExistingFloorId =
            floor.id || findExistingFloorId(floor.floor_number);

          await updateFloorMutation({
            floorId: ExistingFloorId,
            data: updatedFloorPayload,
          }).unwrap();

          // Upload this unit's photos to Cloudinary; keep returned URLs so we
          // never re-upload them on the next save.
          const photoUpdates = await syncUnitPhotos(unitId, unitToProcess);
          updatedUnits[j] = { ...updatedUnits[j], ...photoUpdates };
        } catch (unitError) {
          console.error(`❌ Error saving ${unitLabelForProcess}:`, unitError);
          Toast.show({
            type: "error",
            text1: "Error",
            text2: `Failed to save ${unitLabelForProcess}: ${unitError?.data?.message || unitError?.message}`,
          });
          return;
        }
      }

      // Update local units after processing - only update the specific unit
      const nextMultiStoreyFloorUnits = [...multiStoreyFloorUnits];
      nextMultiStoreyFloorUnits[floorIndex] = {
        ...nextMultiStoreyFloorUnits[floorIndex],
        units: updatedUnits,
      };
      setMultiStoreyFloorUnits(nextMultiStoreyFloorUnits);

      // Mark floor units as saved
      const nextSavedFloorUnits = {
        ...savedFloorUnits,
        [floorIndex]: true,
      };
      const nextUnsavedFloorUnits = {
        ...unsavedFloorUnits,
        [floorIndex]: false,
      };
      const nextSavedUnitCounts = {
        ...savedUnitCounts,
        [floorIndex]: updatedUnits.length,
      };
      setSavedFloorUnits(nextSavedFloorUnits);
      setUnsavedFloorUnits(nextUnsavedFloorUnits);
      setSavedUnitCounts(nextSavedUnitCounts);

      console.log(`✅ Unit updated for ${getFloorName(floorIndex)}`);
      Toast.show({
        type: "success",
        text1: "Data Updated ✓",
        text2: `Unit ${unitIndex + 1} saved successfully`,
      });

      await saveDraftProgress(currentStep, {
        multiStoreyFloorUnits: nextMultiStoreyFloorUnits,
        savedFloorUnits: nextSavedFloorUnits,
        unsavedFloorUnits: nextUnsavedFloorUnits,
        savedUnitCounts: nextSavedUnitCounts,
      });
    } catch (error) {
      console.error("❌ Error updating unit details:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error?.message || "Failed to update unit details",
      });
    } finally {
      setSavingUnitDetails(false);
      setSavingFloorIndex(null);
      setSavingUnitIndex(null);
    }
  };

  const createMultiStoreyUnitTemplate = () => ({
    unit_number: "",
    unit_address: "",
    carpet_area_sqmt: "",
    usage_type: "RESIDENTIAL",
    has_electricity: false,
    has_gas_connection: false,
    has_internet_connection: false,
    has_solar: false,
    has_rainwater_harvesting: false,
    has_sewer: false,
    has_kitchen: false,
    kitchen_count: "",
    kitchen_area: "",
    has_toilet: false,
    toilet_count: "",
    toilet_area: "",
    construction_year: "",
    occupancy_status: "self",
    owner_name: "",
    owner_occupation: "",
    is_disabled_person: "NO",
    owner_mobile: "",
    father_husband_name: "",
    aadhar_number: "",
    bill_photo_url: "",
    photos: [],
    occupier_name: "",
    occupier_mobile: "",
    rent_amount: "",
    area: "",
    self_area: "",
    rented_area: "",
  });

  const makeBlankMultiStoreyFloor = (floorNumber, defaultYear = "") => ({
    floor_number: floorNumber,
    floor_area_sqmt: "",
    construction_year: defaultYear || "",
    ground_floor_mode: floorNumber === 0 ? "UNIT_ONLY" : null,
    has_parking: false,
    parking_type: "NONE",
    parking_area: "",
    unit_count: "0",
    units: [],
  });

  /**
   * Bring the floor list in line with the counts entered on step 3, without
   * throwing away work.
   *
   * Editing the floor count and pressing Next used to rebuild this array from
   * scratch, silently discarding every unit already entered (and orphaning the
   * rows already saved on the server). Now:
   *   • floors still in range keep their units, areas and saved ids
   *   • newly added floors come in blank
   *   • floors that fall out of range are removed, and any units already
   *     persisted for them are deleted server-side so nothing is orphaned
   */
  const initializeMultiStoreyFloorUnits = async (
    totalFloors,
    floorsBelowGround = 0,
    defaultYear = "",
  ) => {
    // Preserve the existing ordering: basements first (-1, -2, …), then 0 up.
    const desired = [];
    for (let j = 1; j <= floorsBelowGround; j++) desired.push(-j);
    for (let i = 0; i < totalFloors; i++) desired.push(i);

    const existingByNumber = new Map(
      (multiStoreyFloorUnits || []).map((f) => [Number(f.floor_number), f]),
    );

    const floorData = desired.map((n) => {
      const kept = existingByNumber.get(n);
      if (!kept) return makeBlankMultiStoreyFloor(n, defaultYear);
      // Ground floor gains its mode if it didn't have one before.
      return n === 0 && !kept.ground_floor_mode
        ? { ...kept, ground_floor_mode: "UNIT_ONLY" }
        : kept;
    });

    // Anything no longer in range: drop it, and clean up the server.
    const desiredSet = new Set(desired);
    const removed = (multiStoreyFloorUnits || []).filter(
      (f) => !desiredSet.has(Number(f.floor_number)),
    );

    if (removed.length) {
      const staleUnitIds = removed
        .flatMap((f) => f.units || [])
        .map((u) => Number(u?.id))
        .filter((id) => Number.isFinite(id));

      for (const unitId of staleUnitIds) {
        try {
          await deleteUnitMutation({ unitId }).unwrap();
        } catch (err) {
          // A unit that's already gone is not a failure worth blocking on.
          const msg = err?.data?.message || err?.message || "";
          if (!(msg.includes("Unit not found") || err?.status === 404)) {
            console.log("Could not delete unit on removed floor:", unitId, msg);
          }
        }
      }

      // Drop the bookkeeping for removed floors; these maps are keyed by the
      // floor's index in the array, which has just shifted, so rebuild them
      // against the new positions.
      const oldIndexByNumber = new Map(
        (multiStoreyFloorUnits || []).map((f, i) => [Number(f.floor_number), i]),
      );
      const remap = (source) => {
        const next = {};
        floorData.forEach((f, newIndex) => {
          const oldIndex = oldIndexByNumber.get(Number(f.floor_number));
          if (oldIndex !== undefined && source[oldIndex] !== undefined) {
            next[newIndex] = source[oldIndex];
          }
        });
        return next;
      };
      setSavedFloorUnits((prev) => remap(prev));
      setUnsavedFloorUnits((prev) => remap(prev));
      setSavedUnitCounts((prev) => remap(prev));
      setFloorSavedIds((prev) => remap(prev));
    }

    setMultiStoreyFloorUnits(floorData);
    return floorData;
  };

  const updateMultiStoreyFloor = (floorIndex, field, value) => {
    const updated = [...multiStoreyFloorUnits];
    updated[floorIndex] = {
      ...updated[floorIndex],
      [field]: sanitizeFieldValue(field, value),
    };
    setMultiStoreyFloorUnits(updated);
    setFloorSavedIds((prev) => ({ ...prev, [floorIndex]: false }));
  };

  const handleSaveFloor = async (floorIndex) => {
    const floor = multiStoreyFloorUnits[floorIndex];
    if (!floor) return;

    let activeBuildingId = buildingId;
    if (!activeBuildingId && surveyId) {
      activeBuildingId = await ensureBuildingId(surveyId);
    }
    if (!activeBuildingId) {
      Toast.show({
        type: "error",
        text1: "Building Info Missing",
        text2: "Building ID not set. Please complete Steps 1-3 first.",
      });
      return;
    }
    if (!floor.floor_area_sqmt) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Floor Area is required and must be a number.",
      });
      return;
    }

    try {
      const getMappedFloorUse = (mode) => {
        if (mode === "UNIT_ONLY") return "Unit";
        if (mode === "PARKING_ONLY") return "Parking";
        if (mode === "BOTH") return "Both";
        return "Unit";
      };

      const floorPayload = {
        floor_number: floor.floor_number,
        construction_year: getStartYearFromSpan(floor.construction_year),
        carpet_area: toFloat(floor.floor_area_sqmt) || null,
        floor_use: getMappedFloorUse(
          floor.basement_floor_mode ||
            floor.ground_floor_mode ||
            floor.floor_use,
        ),
        number_of_units: 0, // Parking only floors have 0 units
        has_parking: true,
        parking_type: floor.parking_type || null,
        parking_area: toFloat(floor.parking_area) || null,
        usage_type_id: null,
      };

      const existingFloorId =
        floor.id || findExistingFloorId(floor.floor_number);
      let savedFloor;

      if (existingFloorId) {
        savedFloor = await updateFloorMutation({
          floorId: Number(existingFloorId),
          data: floorPayload,
        }).unwrap();
      } else {
        savedFloor = await addFloorMutation({
          buildingId: Number(activeBuildingId),
          data: floorPayload,
        }).unwrap();
      }

      const floorId = savedFloor?.id || savedFloor?.data?.id || existingFloorId;

      if (floorId) {
        const updated = [...multiStoreyFloorUnits];
        updated[floorIndex] = {
          ...updated[floorIndex],
          id: floorId,
        };
        const nextFloorSavedIds = { ...floorSavedIds, [floorIndex]: true };
        setMultiStoreyFloorUnits(updated);
        setFloorSavedIds(nextFloorSavedIds);

        // Save the updated state to draft
        await saveDraftProgress(currentStep, {
          multiStoreyFloorUnits: updated,
          floorSavedIds: nextFloorSavedIds,
        });

        Toast.show({
          type: "success",
          text1: "Floor Saved",
          text2: `${getFloorName(floor.floor_number)} saved successfully.`,
        });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Save Failed",
        text2: error.data?.message || "Failed to save floor",
      });
    }
  };

  const updateMultiStoreyUnit = (floorIndex, unitIndex, field, value) => {
    const updated = [...multiStoreyFloorUnits];
    updated[floorIndex].units[unitIndex] = {
      ...updated[floorIndex].units[unitIndex],
      [field]: sanitizeFieldValue(field, value),
    };
    setMultiStoreyFloorUnits(updated);
  };

  const updateMultiStoreyUnitCount = (floorIndex, value) => {
    const updated = [...multiStoreyFloorUnits];
    const floor = updated[floorIndex];
    const currentCount = Math.max(0, parseInt(floor.unit_count || "0") || 0);
    const unitCount =
      typeof value === "undefined"
        ? currentCount + 1
        : Math.max(0, parseInt(value || "0") || 0);
    const nextUnits = [...floor.units];

    if (unitCount > nextUnits.length) {
      for (let i = nextUnits.length; i < unitCount; i++) {
        nextUnits.push({
          ...createMultiStoreyUnitTemplate(),
          construction_year: floor.construction_year || "",
        });
      }
    } else if (unitCount < nextUnits.length) {
      nextUnits.splice(unitCount);
    }

    floor.unit_count = String(unitCount);
    floor.units = nextUnits;
    setMultiStoreyFloorUnits(updated);
    setFloorSavedIds((prev) => ({ ...prev, [floorIndex]: false }));
    setUnsavedFloorUnits((prev) => ({
      ...prev,
      [floorIndex]: true,
    }));
  };

  const deleteMultiStoreyUnit = (floorIndex, unitIndex) => {
    const currentFloor = multiStoreyFloorUnits[floorIndex];
    if (!currentFloor) return;
    const unitToDelete = currentFloor.units?.[unitIndex];
    if (!unitToDelete) return;

    const uniqueKey = `${floorIndex}-${unitIndex}`;

    Alert.alert(
      "Delete Unit",
      "Are you sure you want to delete this unit? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingUnitKey(uniqueKey);

              const currentUnits = [...(currentFloor.units || [])];
              const nextUnits = [...currentUnits];
              nextUnits.splice(unitIndex, 1);

              const nextMultiStoreyFloorUnits = [...multiStoreyFloorUnits];
              nextMultiStoreyFloorUnits[floorIndex] = {
                ...currentFloor,
                units: nextUnits,
                unit_count: String(nextUnits.length),
              };

              const nextUnsavedFloorUnits = { ...unsavedFloorUnits };
              if (
                savedFloorUnits[floorIndex] &&
                nextUnits.length === (savedUnitCounts[floorIndex] || 0)
              ) {
                delete nextUnsavedFloorUnits[floorIndex];
              } else {
                nextUnsavedFloorUnits[floorIndex] = true;
              }
              const unitIdValue = unitToDelete.id;
              const parsedUnitId =
                unitIdValue != null && unitIdValue !== ""
                  ? Number(unitIdValue)
                  : null;

              if (parsedUnitId != null && Number.isFinite(parsedUnitId)) {
                try {
                  await deleteUnitMutation({ unitId: parsedUnitId }).unwrap();
                } catch (apiError) {
                  const errorMessage =
                    apiError?.data?.message || apiError?.message || "";
                  if (
                    errorMessage.includes("Unit not found") ||
                    apiError?.status === 404
                  ) {
                    console.log(
                      "Unit was not in DB. Proceeding to remove locally.",
                    );
                  } else {
                    throw apiError;
                  }
                }
              }
              setMultiStoreyFloorUnits(nextMultiStoreyFloorUnits);
              setUnsavedFloorUnits(nextUnsavedFloorUnits);

              if (surveyId) {
                await saveDraftProgress(currentStep, {
                  multiStoreyFloorUnits: nextMultiStoreyFloorUnits,
                  unsavedFloorUnits: nextUnsavedFloorUnits,
                });
              }
              Toast.show({
                type: "success",
                text1: "Unit Deleted",
                text2: "Unit has been removed successfully.",
              });
            } catch (error) {
              console.error("Delete Error:", error);
              Toast.show({
                type: "error",
                text1: "Delete Failed",
                text2: "Could not delete the unit. Please try again.",
              });
            } finally {
              setDeletingUnitKey(null);
            }
          },
        },
      ],
    );
  };

  const updateGroundFloorMode = (floorIndex, mode) => {
    const updated = [...multiStoreyFloorUnits];
    const floor = { ...updated[floorIndex] };

    floor.ground_floor_mode = mode;
    floor.has_parking = mode === "PARKING_ONLY" || mode === "BOTH";

    if (mode === "PARKING_ONLY") {
      floor.unit_count = "0";
      floor.units = [];
    } else if ((floor.units || []).length === 0) {
      floor.unit_count = "0";
      floor.units = [];
    }

    updated[floorIndex] = floor;
    setMultiStoreyFloorUnits(updated);
    setFloorSavedIds((prev) => ({ ...prev, [floorIndex]: false }));
  };

  const updateBasementFloorMode = (floorIndex, mode) => {
    const updated = [...multiStoreyFloorUnits];
    const floor = { ...updated[floorIndex] };

    floor.basement_floor_mode = mode;
    floor.has_parking = mode === "PARKING_ONLY" || mode === "BOTH";

    if (mode === "PARKING_ONLY") {
      floor.unit_count = "0";
      floor.units = [];
    } else if ((floor.units || []).length === 0) {
      floor.unit_count = "0";
      floor.units = [];
    }

    updated[floorIndex] = floor;
    setMultiStoreyFloorUnits(updated);
    setFloorSavedIds((prev) => ({ ...prev, [floorIndex]: false }));
  };

  const getUnitBillProofUris = () => {
    const uris = [];
    multiStoreyFloorUnits.forEach((floor) => {
      floor.units?.forEach((unit) => {
        if (unit.bill_photo_url) uris.push(unit.bill_photo_url);
      });
    });
    return uris;
  };

  // ==========================================================================
  // SHARED PHOTO UPLOAD HELPERS
  // Images are uploaded to Cloudinary by the backend, which returns the hosted
  // `image_urls`. We write those URLs back into local state so a photo is never
  // re-uploaded on the next step/save (this is what keeps bandwidth in check).
  // ==========================================================================

  /**
   * Upload the local (non-http) photos among `candidates` to the survey photos
   * endpoint and return a map of { originalLocalUri: cloudinaryUrl }.
   * Already-hosted (http) photos are skipped.
   */
  const uploadSurveyPhotosToCloud = async (candidates) => {
    const toUpload = (candidates || []).filter(
      (p) => p?.uri && !String(p.uri).startsWith("http"),
    );
    if (toUpload.length === 0) return {};

    const formData = new FormData();
    toUpload.forEach((photo, index) => {
      formData.append("images", {
        uri: photo.uri,
        type: photo.mimeType || "image/jpeg",
        name: `survey_${Date.now()}_${index}.jpg`,
      });
    });
    formData.append(
      "survey_images",
      JSON.stringify(
        toUpload.map(() => ({
          image_latitude: coordinates?.latitude || null,
          image_longitude: coordinates?.longitude || null,
          image_timestamp: new Date().toISOString(),
        })),
      ),
    );

    const response = await uploadPhotosMutation({ surveyId, formData }).unwrap();
    const urls = response?.image_urls || response?.data?.image_urls || [];

    const map = {};
    toUpload.forEach((photo, index) => {
      if (urls[index]) map[photo.uri] = urls[index];
    });
    return map;
  };

  /** Replace uploaded local uris in the survey-level `photos` state with the
   *  returned Cloudinary URLs so they are not re-uploaded again. */
  const applyUploadedPhotoUrls = (uriToUrl) => {
    if (!uriToUrl || Object.keys(uriToUrl).length === 0) return;
    setPhotos((prev) =>
      prev.map((p) => (uriToUrl[p?.uri] ? { ...p, uri: uriToUrl[p.uri] } : p)),
    );
  };

  /**
   * Upload a single unit's new photos (bill proof + unit photos) to Cloudinary
   * and re-upload any changed existing photos. Returns the updated photo fields
   * ({ bill_photo_url, photos }) to merge back into the unit so the now-hosted
   * URLs are skipped on subsequent saves.
   */
  const syncUnitPhotos = async (unitId, unit) => {
    const newPhotosToUpload = [];
    const existingPhotosToUpdate = [];

    if (unit.bill_photo_url && String(unit.bill_photo_url).startsWith("file://")) {
      newPhotosToUpload.push({
        uri: unit.bill_photo_url,
        caption: "Bill Proof",
        photo_type: "bill_proof",
        name: `unit_bill_${Date.now()}.jpg`,
        _kind: "bill",
      });
    }

    if (Array.isArray(unit.photos)) {
      unit.photos.forEach((photo, index) => {
        if (photo.id && photo.uri && String(photo.uri).startsWith("file://")) {
          existingPhotosToUpdate.push({
            id: photo.id,
            index,
            caption: photo.caption || `Unit Photo ${index + 1}`,
            photo_type: "unit_photo",
            uri: photo.uri,
          });
        } else if (photo.uri && String(photo.uri).startsWith("file://")) {
          newPhotosToUpload.push({
            uri: photo.uri,
            caption: photo.caption || `Unit Photo ${index + 1}`,
            photo_type: "unit_photo",
            name: `unit_photo_${index + 1}_${Date.now()}.jpg`,
            _kind: "unit",
            _index: index,
          });
        }
      });
    }

    const nextPhotos = Array.isArray(unit.photos)
      ? unit.photos.map((p) => ({ ...p }))
      : [];
    let nextBillUrl = unit.bill_photo_url;

    // Re-upload changed existing photos
    for (const photo of existingPhotosToUpdate) {
      const formData = new FormData();
      formData.append("images", {
        uri: photo.uri,
        type: "image/jpeg",
        name: `updated_${photo.id}_${Date.now()}.jpg`,
      });
      formData.append("caption", photo.caption);
      formData.append("photo_type", photo.photo_type);

      const resp = await updateUnitPhotos({
        photoId: photo.id,
        formData,
      }).unwrap();
      const newUrl = resp?.data?.photo_url || resp?.photo_url;
      if (newUrl && nextPhotos[photo.index]) {
        nextPhotos[photo.index] = { ...nextPhotos[photo.index], uri: newUrl };
      }
    }

    // Upload brand new photos
    if (newPhotosToUpload.length > 0) {
      const formData = new FormData();
      const metadata = [];
      newPhotosToUpload.forEach((photo) => {
        formData.append("images", {
          uri: photo.uri,
          type: "image/jpeg",
          name: photo.name,
        });
        metadata.push({ caption: photo.caption, photo_type: photo.photo_type });
      });
      formData.append("metadata", JSON.stringify(metadata));

      const resp = await createUnitPhotos({ unitId, formData }).unwrap();
      const created = resp?.data || [];
      const urls =
        resp?.image_urls ||
        (Array.isArray(created) ? created.map((c) => c?.photo_url) : []);

      // Returned photos are in the same order they were appended above.
      newPhotosToUpload.forEach((photo, i) => {
        const url = urls[i];
        const id = created[i]?.id;
        if (photo._kind === "bill") {
          if (url) nextBillUrl = url;
        } else if (photo._kind === "unit" && nextPhotos[photo._index]) {
          nextPhotos[photo._index] = {
            ...nextPhotos[photo._index],
            ...(url ? { uri: url } : {}),
            ...(id ? { id } : {}),
          };
        }
      });
    }

    return { bill_photo_url: nextBillUrl, photos: nextPhotos };
  };

  const updateMergedFloorUnit = (index, field, value) => {
    const updated = [...mergedFloorUnits];
    updated[index] = {
      ...updated[index],
      [field]: sanitizeFieldValue(field, value),
    };
    setMergedFloorUnits(updated);
  };

  // ============================================================================
  // STEP 5: ADD UNIT
  // ============================================================================
  const handleAddUnit = async () => {
    if (!currentUnitData.carpet_area_sqmt || !currentUnitData.owner_name) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please fill required unit details",
      });
      return;
    }

    // Find the floor by floor_number
    const floorNumber = parseInt(currentUnitData.floor_number) || 0;
    const selectedFloor = floors.find((f) => f.floor_number === floorNumber);

    if (!selectedFloor || !selectedFloor.id) {
      Toast.show({
        type: "error",
        text1: "Missing Floor",
        text2: "Please create or select a floor first",
      });
      return;
    }

    try {
      const result = await addUnitMutation({
        floorId: selectedFloor.id,
        data: {
          floor_number: floorNumber,
          unit_position: currentUnitData.unit_position,
          carpet_area_sqmt:
            parseFloat(currentUnitData.carpet_area_sqmt) || null,
          usage_type: currentUnitData.usage_type || "RESIDENTIAL",
          occupancy_status: currentUnitData.occupancy_status,
          owner_name: currentUnitData.owner_name,
          mobile_number: currentUnitData.mobile_number,
          has_kitchen: currentUnitData.has_kitchen,
          toilet_count: currentUnitData.has_toilet
            ? parseInt(currentUnitData.toilet_count) || 0
            : null,
          parking_type: currentUnitData.parking_type,
          residential_details: {
            family_count: 1,
            has_kitchen: currentUnitData.has_kitchen,
            has_toilet: (parseInt(currentUnitData.toilet_count) || 0) > 0,
            parking_type: currentUnitData.parking_type,
            construction_type: propertyDetails.construction_type || "PUCCA",
          },
        },
      }).unwrap();

      setUnits([...units, result]);

      Toast.show({
        type: "success",
        text1: "Unit Added",
      });

      // Photos next, unless this flow skips them.
      await saveDraftProgress(stepAfterFloors);
      setCurrentStep(stepAfterFloors);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.data?.message || "Failed to add unit",
      });
    }
  };

  // ============================================================================
  // STEP 6: UPLOAD PHOTOS
  // ============================================================================
  const pickImages = async (floorIndex = null, unitIndex = null) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Toast.show({
        type: "error",
        text1: "Permission Denied",
        text2: "Camera roll permission is required",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    if (floorIndex !== null && unitIndex !== null) {
      const updated = [...multiStoreyFloorUnits];
      const existingPhotos = updated[floorIndex].units[unitIndex].photos || [];
      updated[floorIndex].units[unitIndex] = {
        ...updated[floorIndex].units[unitIndex],
        photos: [...existingPhotos, ...result.assets],
      };
      setMultiStoreyFloorUnits(updated);
      return;
    }

    setPhotos([...photos, ...result.assets]);
  };

  const capturePhoto = async (floorIndex = null, unitIndex = null) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Toast.show({
        type: "error",
        text1: "Permission Denied",
        text2: "Camera permission is required",
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled) return;

    if (floorIndex !== null && unitIndex !== null) {
      const updated = [...multiStoreyFloorUnits];
      const existingPhotos = updated[floorIndex].units[unitIndex].photos || [];
      updated[floorIndex].units[unitIndex] = {
        ...updated[floorIndex].units[unitIndex],
        photos: [...existingPhotos, ...result.assets],
      };
      setMultiStoreyFloorUnits(updated);
      return;
    }

    setPhotos([...photos, ...result.assets]);
  };

  const handleUploadPhotos = async () => {
    const billProofUris = getUnitBillProofUris();
    const photosToUpload = photos.filter(
      (photo) => !billProofUris.includes(photo.uri),
    );

    if (photosToUpload.length === 0) {
      Toast.show({
        type: "error",
        text1: "No Photos",
        text2: "Please add at least one property photo",
      });
      return;
    }

    try {
      setUploadingPhotos(true);

      const uploadedMap = await uploadSurveyPhotosToCloud(photosToUpload);
      applyUploadedPhotoUrls(uploadedMap);

      Toast.show({
        type: "success",
        text1: "Photos Uploaded",
      });

      await saveDraftProgress(7);
      setCurrentStep(7);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.data?.message || "Failed to upload photos",
      });
    } finally {
      setUploadingPhotos(false);
    }
  };

  // ============================================================================
  // STEP 7: SUBMIT SURVEY
  // ============================================================================
  const handleSubmitSurvey = async () => {
    try {
      const submitRes = await submitSurveyMutation(surveyId).unwrap();
      const finalCode =
        submitRes?.data?.property_code || submitRes?.property_code;
      if (finalCode) setPropertyCode(finalCode);
      if (surveyId) {
        await AsyncStorage.removeItem(getDraftCacheKey(surveyId));
      }

      Toast.show({
        type: "success",
        text1: "Survey Submitted",
        text2: "Survey completed successfully!",
      });

      router.replace("/(surveyor)/home");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Submission Error",
        text2:
          error.data?.message ||
          error.data?.errors?.join(", ") ||
          "Failed to submit survey",
      });
    }
  };

  // ============================================================================
  // RENDER STEP INDICATOR
  // ============================================================================
  const renderStepIndicator = () => {
    // `num` must be the real currentStep value, not the dot's position.
    // Every flow runs 1 → 2 → 3 → 4 → 6 → 7; step 5 (the old standalone
    // "Unit Details" screen) is no longer reached because units are captured
    // inside step 4. Numbering these 1..6 made the indicator drift by one
    // from step 4 onward — the photos screen highlighted "Submit".
    const steps = [
      { num: 1, label: "Polygon" },
      { num: 2, label: "Property" },
      { num: 3, label: "Building" },
      { num: 4, label: "Floors" },
      // Flows that don't collect photos drop the dot entirely rather than
      // showing a stage the surveyor can never reach.
      ...(photosStepEnabled ? [{ num: 6, label: "Photos" }] : []),
      { num: 7, label: "Submit" },
    ];

    return (
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        <View className="flex-row justify-between items-center">
          {steps.map((step, index) => (
            <View key={step.num} className="items-center flex-1">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center z-10 ${
                  currentStep >= step.num ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <Text className="text-white font-semibold text-xs">
                  {index + 1}
                </Text>
              </View>
              <Text
                className={`text-xs mt-1 ${currentStep >= step.num ? "text-blue-600" : "text-gray-500"}`}
              >
                {step.label}
              </Text>
              {index < steps.length - 1 && (
                <View
                  className={`absolute h-0.5 top-4 z-0 ${
                    currentStep > step.num ? "bg-blue-600" : "bg-gray-300"
                  }`}
                  style={{ left: "50%", width: "100%" }}
                />
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ============================================================================
  // RENDER STEPS
  // ============================================================================
  const renderStep1 = () => (
    <ScrollView className="flex-1 p-4">
      <Text className="text-2xl font-bold mb-4">
        {isPreselected ? "Property Survey" : "Select Polygon"}
      </Text>

      {/* Location is a convenience for centring the map and autofilling the
          address — it never limits which polygon can be chosen. */}
      {!isPreselected && (
        <TouchableOpacity
          onPress={getLocation}
          disabled={loadingLocation}
          className="bg-blue-600 p-4 rounded-lg mb-4 flex-row items-center justify-center"
        >
          {loadingLocation ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialIcons name="my-location" size={24} color="white" />
              <Text className="text-white font-semibold ml-2">
                Get Current Location
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {coordinates && (
        <View className="bg-gray-100 p-4 rounded-lg mb-4">
          <Text className="font-semibold mb-2">Current Coordinates:</Text>
          <Text>Lat: {coordinates.latitude.toFixed(6)}</Text>
          <Text>Lng: {coordinates.longitude.toFixed(6)}</Text>
        </View>
      )}

      {!isPreselected && (
        <TouchableOpacity
          onPress={fetchAllPolygons}
          disabled={loadingLocation}
          className="bg-green-600 p-4 rounded-lg mb-4 flex-row items-center justify-center"
        >
          {loadingLocation ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialIcons name="refresh" size={24} color="white" />
              <Text className="text-white font-semibold ml-2">
                Refresh Property List
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {mapPolygons && mapPolygons.length > 0 && (
        <>
          <Text className="text-lg font-semibold mb-2">
            {isPreselected ? "Selected Property" : "Property Map"}
          </Text>
          <View
            className="bg-white rounded-lg mb-4 border border-gray-200 overflow-hidden"
            style={{ height: 400 }}
          >
            <WebView
              source={{
                html: generateMapHTML(
                  coordinates?.latitude || 26.8908627,
                  coordinates?.longitude || 80.9680742,
                  mapPolygons,
                  selectedPolygon?.id,
                ),
              }}
              onMessage={(event) => {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === "SELECT_POLYGON") {
                  // Look inside what's actually drawn, so a preselected survey
                  // can only ever resolve to its own parcel.
                  const chosen = (mapPolygons || []).find((p) => p.id === data.id);
                  if (!chosen) return;
                  if (chosen?.hasCompletedSurvey && chosen?.completedSurveyId) {
                    Toast.show({
                      type: "info",
                      text1: "Already Surveyed",
                      text2: "Opening completed survey details",
                    });
                    router.push(
                      `/(surveyor)/property/${chosen.completedSurveyId}`,
                    );
                    return;
                  }
                  setSelectedPolygon(chosen);

                  Toast.show({
                    type: "info",
                    text1: "Polygon Selected",
                    text2: chosen.polygon_code,
                  });
                }
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error("WebView error: ", nativeEvent);
              }}
              onLoadEnd={() => console.log("WebView loaded successfully")}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </View>
        </>
      )}

      {selectedPolygon && (
        <View className="bg-green-100 p-4 rounded-lg mb-4 border border-green-500">
          <Text className="font-semibold text-green-800 mb-2 text-base">
            Selected Polygon:
          </Text>
          <Text className="text-green-700 font-semibold text-sm mb-1">
            Code: {selectedPolygon.polygon_code}
          </Text>
          {selectedPolygon.ward_name || selectedPolygon.ward_id ? (
            <Text className="text-green-700 text-sm">
              Ward: {selectedPolygon.ward_name || selectedPolygon.ward_id}
            </Text>
          ) : null}
          {selectedPolygon.city_name ? (
            <Text className="text-green-700 text-sm">
              City: {selectedPolygon.city_name}
            </Text>
          ) : null}
          {selectedPolygon.district_name ? (
            <Text className="text-green-700 text-sm">
              District: {selectedPolygon.district_name}
            </Text>
          ) : null}
          {selectedPolygon.state_name ? (
            <Text className="text-green-700 text-sm">
              State: {selectedPolygon.state_name}
            </Text>
          ) : null}
          <Text className="text-green-700 text-sm mt-1">
            Area:{" "}
            {selectedPolygon.area_sqmt
              ? `${parseFloat(selectedPolygon.area_sqmt).toFixed(2)} sq.m`
              : "N/A"}
          </Text>
          {selectedPolygon.distance_meters ? (
            <Text className="text-green-700 text-sm">
              Distance:{" "}
              {`${parseFloat(selectedPolygon.distance_meters).toFixed(2)} meters`}
            </Text>
          ) : null}
          {selectedPolygon.hasCompletedSurvey && (
            <View className="mt-3">
              <Text className="text-green-800 font-semibold text-sm mb-2">
                Survey already completed for this polygon.
              </Text>
              <TouchableOpacity
                className="self-start bg-green-700 px-3 py-2 rounded-lg"
                onPress={() =>
                  router.push(
                    `/(surveyor)/property/${selectedPolygon.completedSurveyId}`,
                  )
                }
              >
                <Text className="text-white text-xs font-semibold">
                  View Survey
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {selectedPolygon && (
        <>
          <Text className="text-lg font-semibold mb-4 mt-4">
            Property Details
          </Text>

          <Text className="font-semibold mb-2">
            Property Address<Text className="text-red-600">*</Text>
          </Text>
          <TextInput
            placeholder="Enter property address"
            value={setSelectedPolygon.address || step1Data.address}
            onChangeText={(text) =>
              setStep1Data({ ...step1Data, address: text })
            }
            className="bg-white border border-gray-300 p-3 rounded-lg mb-4"
            multiline
          />

          <Text className="font-semibold mb-2">
            Building Type<Text className="text-red-600">*</Text>
          </Text>
          {loadingCategories ? (
            <ActivityIndicator />
          ) : (
            <View className="mb-4">
              {categories?.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setStep1Data({
                      ...step1Data,
                      category_id: cat.id,
                      subtype_id: null,
                    });
                  }}
                  className={`p-4 border rounded-lg mb-2 ${
                    step1Data.category_id === cat.id
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-300"
                  }`}
                >
                  <Text
                    className={
                      step1Data.category_id === cat.id
                        ? "text-white font-semibold"
                        : "text-gray-700"
                    }
                  >
                    {cat.name}
                  </Text>
                  <Text
                    className={`text-sm ${
                      step1Data.category_id === cat.id
                        ? "text-white"
                        : "text-gray-500"
                    }`}
                  >
                    {cat.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step1Data.category_id && (
            <>
              <Text className="font-semibold mb-2">
                Building Subtype<Text className="text-red-600">*</Text>
              </Text>
              {loadingSubtypes ? (
                <ActivityIndicator />
              ) : (
                <View className="mb-4">
                  {subtypes?.map((subtype) => (
                    <TouchableOpacity
                      key={subtype.id}
                      onPress={() =>
                        setStep1Data({ ...step1Data, subtype_id: subtype.id })
                      }
                      className={`p-4 border rounded-lg mb-2 ${
                        step1Data.subtype_id === subtype.id
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300"
                      }`}
                    >
                      <Text
                        className={
                          step1Data.subtype_id === subtype.id
                            ? "text-white font-semibold"
                            : "text-gray-700"
                        }
                      >
                        {subtype.name}
                      </Text>
                      <Text
                        className={`text-sm ${
                          step1Data.subtype_id === subtype.id
                            ? "text-white"
                            : "text-gray-500"
                        }`}
                      >
                        {subtype.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </>
      )}

      <TouchableOpacity
        onPress={handleStep1CreateDraft}
        disabled={
          !selectedPolygon ||
          creatingDraft ||
          !!selectedPolygon?.hasCompletedSurvey
        }
        className={`p-4 rounded-lg flex-row items-center justify-center ${
          selectedPolygon &&
          !creatingDraft &&
          !selectedPolygon?.hasCompletedSurvey
            ? "bg-blue-600"
            : "bg-gray-300"
        }`}
      >
        {creatingDraft ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Text className="text-white font-semibold">
              Create Survey Draft
            </Text>
            <MaterialIcons name="arrow-forward" size={24} color="white" />
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStep2 = () => {
    const {
      categoryName,
      subtypeName,
      isResidentialSingle,
      isNonResidentialSimple,
      isResidentialMultiStorey,
      isSimpleProperty,
    } = getPropertyTypeFlags();

    console.log("🏠 Step 2 Property Type Check:", {
      category: categoryName,
      subtype: subtypeName,
      isResidentialSingle,
      isNonResidentialSimple,
      isSimpleProperty,
    });
    return (
      <ScrollView className="flex-1 p-4">
        {/* Owner Details - Only for Simple Properties */}
        {isSimpleProperty && (
          <>
            <Text className="text-2xl font-bold mb-4">Basic Details</Text>

            <Text className="font-semibold mb-2">
              Owner Name<Text className="text-red-600">*</Text>
            </Text>
            <TextInput
              placeholder="Enter owner name"
              value={propertyDetails.owner_name}
              onChangeText={(text) =>
                setPropertyDetails({ ...propertyDetails, owner_name: text })
              }
              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
            />

            <Text className="font-semibold mb-2">
              Occupation<Text className="text-red-600">*</Text>
            </Text>
            <TextInput
              placeholder="Enter owner occupation"
              value={propertyDetails.owner_occupation}
              onChangeText={(text) =>
                setPropertyDetails({
                  ...propertyDetails,
                  owner_occupation: text,
                })
              }
              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
            />

            <Text className="font-semibold mb-2">
              Disabled Person<Text className="text-red-600">*</Text>
            </Text>
            <View className="flex-row mb-3">
              {["YES", "NO"].map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() =>
                    setPropertyDetails({
                      ...propertyDetails,
                      is_disabled_person: value,
                    })
                  }
                  className={`flex-1 p-3 border rounded-lg mx-1 ${
                    propertyDetails.is_disabled_person === value
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  <Text
                    className={`text-center ${
                      propertyDetails.is_disabled_person === value
                        ? "text-white font-semibold"
                        : "text-gray-700"
                    }`}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="font-semibold mb-2">Father/Husband Name</Text>
            <TextInput
              placeholder="Enter father or husband name"
              value={propertyDetails.father_husband_name}
              onChangeText={(text) =>
                setPropertyDetails({
                  ...propertyDetails,
                  father_husband_name: text,
                })
              }
              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
            />

            <Text className="font-semibold mb-2">
              Mobile Number<Text className="text-red-600">*</Text>
            </Text>
            <TextInput
              placeholder="Enter mobile number"
              value={propertyDetails.mobile_number}
              onChangeText={(text) =>
                updatePropertyDetailsField("mobile_number", text)
              }
              keyboardType="number-pad"
              maxLength={10}
              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
            />

            <Text className="font-semibold mb-2">Aadhar Number</Text>
            <TextInput
              placeholder="Enter 12-digit Aadhar number"
              value={propertyDetails.aadhar_number}
              onChangeText={(text) =>
                updatePropertyDetailsField("aadhar_number", text)
              }
              keyboardType="number-pad"
              maxLength={12}
              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
            />

            <Text className="font-semibold mb-2">Bill Photo</Text>
            {propertyDetails.bill_photo_url ? (
              <View className="mb-3">
                <Image
                  source={{ uri: propertyDetails.bill_photo_url }}
                  className="w-full h-48 rounded-lg mb-2"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() =>
                    setPropertyDetails({
                      ...propertyDetails,
                      bill_photo_url: "",
                    })
                  }
                  className="bg-red-500 p-2 rounded-lg"
                >
                  <Text className="text-white text-center">Remove Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row mb-3">
                <TouchableOpacity
                  onPress={async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsEditing: true,
                      quality: 0.8,
                    });
                    if (!result.canceled) {
                      setPropertyDetails({
                        ...propertyDetails,
                        bill_photo_url: result.assets[0].uri,
                      });
                    }
                  }}
                  className="bg-blue-600 p-3 rounded-lg flex-1 mr-2 flex-row items-center justify-center"
                >
                  <MaterialIcons name="photo-library" size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    const { status } =
                      await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== "granted") {
                      Toast.show({
                        type: "error",
                        text1: "Permission Denied",
                        text2: "Camera permission is required",
                      });
                      return;
                    }
                    const result = await ImagePicker.launchCameraAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsEditing: true,
                      quality: 0.8,
                    });
                    if (!result.canceled) {
                      setPropertyDetails({
                        ...propertyDetails,
                        bill_photo_url: result.assets[0].uri,
                      });
                    }
                  }}
                  className="bg-green-600 p-3 rounded-lg flex-1 ml-2 flex-row items-center justify-center"
                >
                  <MaterialIcons name="camera-alt" size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <Text
          className={`text-2xl font-bold mb-4 ${isSimpleProperty ? "mt-6" : ""}`}
        >
          Property Details
        </Text>

        <Text className="font-semibold mb-2">
          Plot Area (sq.mt)<Text className="text-red-600">*</Text>
        </Text>
        <TextInput
          placeholder="Enter plot area in square meters"
          value={propertyDetails.plot_area_sqmt}
          onChangeText={(text) =>
            setPropertyDetails({ ...propertyDetails, plot_area_sqmt: text })
          }
          keyboardType="numeric"
          className="bg-white border border-gray-300 p-3 rounded-lg mb-1"
        />
        {selectedPolygon?.area_sqmt && (
          <Text className="text-sm text-gray-600 mb-3">
            Polygon area: {parseFloat(selectedPolygon.area_sqmt).toFixed(2)}{" "}
            sq.m (Acceptable range:{" "}
            {(parseFloat(selectedPolygon.area_sqmt) * 0.9).toFixed(2)} -{" "}
            {(parseFloat(selectedPolygon.area_sqmt) * 1.1).toFixed(2)} sq.m)
          </Text>
        )}

        {!isResidentialMultiStorey && (
          <>
            {/* Utilities */}
            <Text className="text-xl font-bold mb-3 mt-4">Utilities</Text>

            <TouchableOpacity
              onPress={() =>
                setPropertyDetails({
                  ...propertyDetails,
                  has_electricity: !propertyDetails.has_electricity,
                })
              }
              className="flex-row items-center mb-3"
            >
              <View
                className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                  propertyDetails.has_electricity
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-400"
                }`}
              >
                {propertyDetails.has_electricity && (
                  <MaterialIcons name="check" size={18} color="white" />
                )}
              </View>
              <Text className="text-base">Electricity Connection</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                setPropertyDetails({
                  ...propertyDetails,
                  has_gas_connection: !propertyDetails.has_gas_connection,
                })
              }
              className="flex-row items-center mb-3"
            >
              <View
                className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                  propertyDetails.has_gas_connection
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-400"
                }`}
              >
                {propertyDetails.has_gas_connection && (
                  <MaterialIcons name="check" size={18} color="white" />
                )}
              </View>
              <Text className="text-base">Gas Connection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                setPropertyDetails({
                  ...propertyDetails,
                  has_water_connection: !propertyDetails.has_water_connection,
                })
              }
              className="flex-row items-center mb-3"
            >
              <View
                className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                  propertyDetails.has_water_connection
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-400"
                }`}
              >
                {propertyDetails.has_water_connection && (
                  <MaterialIcons name="check" size={18} color="white" />
                )}
              </View>
              <Text className="text-base">Water Connection</Text>
            </TouchableOpacity>
            {/* add Internet connection */}
            <TouchableOpacity
              onPress={() =>
                setPropertyDetails({
                  ...propertyDetails,
                  has_internet_connection:
                    !propertyDetails.has_internet_connection,
                })
              }
              className="flex-row items-center mb-3"
            >
              <View
                className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                  propertyDetails.has_internet_connection
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-400"
                }`}
              >
                {propertyDetails.has_internet_connection && (
                  <MaterialIcons name="check" size={18} color="white" />
                )}
              </View>
              <Text className="text-base">Internet Connection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                setPropertyDetails({
                  ...propertyDetails,
                  has_solar: !propertyDetails.has_solar,
                })
              }
              className="flex-row items-center mb-3"
            >
              <View
                className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                  propertyDetails.has_solar
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-400"
                }`}
              >
                {propertyDetails.has_solar && (
                  <MaterialIcons name="check" size={18} color="white" />
                )}
              </View>
              <Text className="text-base">Solar Panel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                setPropertyDetails({
                  ...propertyDetails,
                  has_sewer: !propertyDetails.has_sewer,
                })
              }
              className="flex-row items-center mb-3"
            >
              <View
                className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                  propertyDetails.has_sewer
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-400"
                }`}
              >
                {propertyDetails.has_sewer && (
                  <MaterialIcons name="check" size={18} color="white" />
                )}
              </View>
              <Text className="text-base">Sewer Connection</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Road Details - All 4 Sides */}
        <Text className="text-xl font-bold mb-3 mt-4">
          Road Details (Edge to Edge)
        </Text>

        {["front", "back", "left", "right"].map((side) => (
          <View
            key={side}
            className="mb-4 p-3 rounded-xl border bg-white border-gray-200"
          >
            {/* Checkbox for side */}
            <TouchableOpacity
              onPress={() =>
                setRoadSides({ ...roadSides, [side]: !roadSides[side] })
              }
              className="flex-row items-center mb-3"
            >
              <View
                className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                  roadSides[side]
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-400"
                }`}
              >
                {roadSides[side] && (
                  <MaterialIcons name="check" size={18} color="white" />
                )}
              </View>
              <Text className="text-base font-semibold capitalize text-gray-800">
                {side} Side Road
              </Text>
            </TouchableOpacity>

            {/* Only show road type and width if checkbox is checked */}
            {roadSides[side] && (
              <>
                {/* Road Type */}
                <Text className="font-medium mb-2 text-sm text-gray-700">
                  Road Type:
                </Text>
                <View className="flex-row flex-wrap mb-3">
                  {[
                    { value: "BITUMINOUS", label: "Bituminous" },
                    { value: "INTERLOCKING", label: "Interlocking" },
                    { value: "CC", label: "CC" },
                    { value: "KUCCHA", label: "Kuccha" },
                    { value: "KHADANJA", label: "Khadanja" },
                  ].map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      onPress={() =>
                        setPropertyDetails({
                          ...propertyDetails,
                          [`road_type_${side}`]: type.value,
                        })
                      }
                      className={`p-2 border rounded-lg m-1 ${
                        propertyDetails[`road_type_${side}`] === type.value
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      <Text
                        className={`text-xs ${
                          propertyDetails[`road_type_${side}`] === type.value
                            ? "text-white font-semibold"
                            : "text-gray-700"
                        }`}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Road Width */}
                <Text className="font-medium mb-2 text-sm text-gray-700">
                  Road Width:
                </Text>
                <View className="flex-row">
                  {["1_12M", "12_24M", "ABOVE_24M"].map((width) => (
                    <TouchableOpacity
                      key={width}
                      onPress={() =>
                        setPropertyDetails({
                          ...propertyDetails,
                          [`road_width_${side}`]: width,
                        })
                      }
                      className={`flex-1 p-2 border rounded-lg mx-1 ${
                        propertyDetails[`road_width_${side}`] === width
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      <Text
                        className={`text-center text-xs ${
                          propertyDetails[`road_width_${side}`] === width
                            ? "text-white font-semibold"
                            : "text-gray-700"
                        }`}
                      >
                        {width.replace("_", "-").replace("M", "m")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="font-medium mt-3 mb-2 text-sm text-gray-700">
                  Carriageway (m):
                </Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded-lg px-4 py-3 mb-3"
                  placeholder={`Enter ${side} side carriageway in metres`}
                  value={propertyDetails[`carriageway_area_${side}`]}
                  onChangeText={(text) =>
                    setPropertyDetails({
                      ...propertyDetails,
                      [`carriageway_area_${side}`]: text,
                    })
                  }
                  keyboardType="numeric"
                />

                <Text className="font-medium mb-2 text-sm text-gray-700">
                  Footpath (m):
                </Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded-lg px-4 py-3"
                  placeholder={`Enter ${side} side footpath in metres`}
                  value={propertyDetails[`footpath_area_${side}`]}
                  onChangeText={(text) =>
                    setPropertyDetails({
                      ...propertyDetails,
                      [`footpath_area_${side}`]: text,
                    })
                  }
                  keyboardType="numeric"
                />

                <Text className="text-sm font-semibold text-gray-700 mt-2">
                  Side Total: {getSideTotalRoadArea(side).toFixed(2)} m
                </Text>
              </>
            )}
          </View>
        ))}

        <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
          <Text className="text-sm text-gray-700">
            Total Carriageway: {totalCarriagewayArea.toFixed(2)} m
          </Text>
          <Text className="text-sm text-gray-700 mt-1">
            Total Footpath: {totalFootpathArea.toFixed(2)} m
          </Text>
          <Text className="text-base font-bold text-blue-700 mt-2">
            Automatic Total: {totalRoadArea.toFixed(2)} m
          </Text>
        </View>

        {isResidentialMultiStorey && (
          <>
            <Text className="text-xl font-bold mb-3 mt-4">
              Construction Type
            </Text>
            <View className="flex-row mb-3">
              {["PUCCA", "SEMI_PUCCA", "KUCCHA"].map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() =>
                    setPropertyDetails({
                      ...propertyDetails,
                      construction_type: type,
                    })
                  }
                  className={`flex-1 p-3 border rounded-lg mx-1 ${
                    propertyDetails.construction_type === type
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-300"
                  }`}
                >
                  <Text
                    className={`text-center text-xs ${
                      propertyDetails.construction_type === type
                        ? "text-white font-semibold"
                        : "text-gray-700"
                    }`}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-xl font-bold mb-3 mt-4">Property Photos</Text>
            <Text className="text-gray-600 mb-3">
              Add at least one photo before continuing
            </Text>

            <View className="flex-row mb-4">
              <TouchableOpacity
                onPress={pickImages}
                className="bg-blue-600 p-3 rounded-lg flex-1 mr-2 flex-row items-center justify-center"
              >
                <MaterialIcons name="photo-library" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={capturePhoto}
                className="bg-green-600 p-3 rounded-lg flex-1 ml-2 flex-row items-center justify-center"
              >
                <MaterialIcons name="camera-alt" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Camera</Text>
              </TouchableOpacity>
            </View>

            {photos.length > 0 && (
              <View className="mb-3">
                <Text className="font-semibold mb-2">
                  {photos.length} photo(s) selected
                </Text>
                {photos.map((photo, index) => (
                  <View
                    key={index}
                    className="bg-white border border-gray-200 rounded-xl p-3 mb-3"
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      className="w-full h-56 rounded-lg mb-2"
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setPhotos(photos.filter((_, i) => i !== index))
                      }
                      className="bg-red-500 p-2 rounded-lg"
                    >
                      <Text className="text-white text-center text-sm">
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View className="flex-row justify-between mt-4">
          <TouchableOpacity
            onPress={() => setCurrentStep(1)}
            className="bg-gray-500 p-4 rounded-lg flex-1 mr-2"
          >
            <Text className="text-white font-semibold text-center">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStep2PropertyDetails}
            disabled={addingPropertyDetails}
            className={`p-4 rounded-lg flex-1 ml-2 ${addingPropertyDetails ? "bg-gray-300" : "bg-blue-600"}`}
          >
            {addingPropertyDetails ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-center">Next</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderStep3 = () => {
    // Get selected category and subtype names for display
    const selectedCategory = categories?.find(
      (c) => c.id === buildingInfo.category_id,
    );
    const selectedSubtype = subtypes?.find(
      (s) => s.id === buildingInfo.subtype_id,
    );
    const categoryName = selectedCategory?.name?.toLowerCase() || "";
    const subtypeName = selectedSubtype?.name?.toLowerCase() || "";
    const isResSingle =
      categoryName.includes("residential") &&
      (subtypeName.includes("single") ||
        subtypeName.includes("residential_single"));

    return (
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold mb-4">Building Information</Text>

        {/* Display selected property type from Step 1 */}
        {selectedCategory && selectedSubtype && (
          <View className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-200">
            <Text className="text-sm text-gray-600 mb-1">
              Property Type (from Step 1):
            </Text>
            <Text className="font-semibold text-blue-900">
              {selectedCategory.name}
            </Text>
            <Text className="text-sm text-blue-700 mt-1">
              {selectedSubtype.name}
            </Text>
          </View>
        )}

        <Text className="font-semibold mb-2">
          Total Floors including Ground Floors
          <Text className="text-red-600">*</Text>
        </Text>
        <TextInput
          placeholder="Enter total number of floors"
          value={buildingInfo.total_floors}
          onChangeText={(text) =>
            setBuildingInfo({ ...buildingInfo, total_floors: text })
          }
          keyboardType="numeric"
          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
        />

        <Text className="font-semibold mb-2">
          Total Floors Below Ground (Basement)
          <Text className="text-red-600">*</Text>
        </Text>
        <TextInput
          placeholder="Enter Basement floors if applicable"
          value={buildingInfo.floors_below_ground}
          onChangeText={(text) =>
            setBuildingInfo({ ...buildingInfo, floors_below_ground: text })
          }
          keyboardType="numeric"
          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
        />

        <Text className="font-semibold mb-2">
          Built-up Area (sq.mt)<Text className="text-red-600">*</Text>
        </Text>
        <TextInput
          placeholder="Enter built-up area in square meters"
          value={buildingInfo.builtup_area_sqmt}
          onChangeText={(text) =>
            setBuildingInfo({ ...buildingInfo, builtup_area_sqmt: text })
          }
          keyboardType="numeric"
          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
        />

        <Text className="font-semibold mb-2">Construction Year</Text>
        <TextInput
          placeholder="Enter construction year span (e.g. 2023-2024)"
          value={buildingInfo.construction_year}
          onChangeText={(text) =>
            setBuildingInfo({
              ...buildingInfo,
              construction_year: sanitizeFieldValue("construction_year", text),
            })
          }
          keyboardType="default"
          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
        />

        {isResSingle && (
          <>
            <Text className="font-semibold mb-2">
              Building Occupancy
              <Text className="text-red-600">*</Text>
            </Text>
            <View className="flex-row flex-wrap mb-3">
              {[
                { value: "Self", label: "Self" },
                { value: "Rented", label: "Rented" },
                { value: "Vacant", label: "Vacant" },
                { value: "SelfRented", label: "Self + Rented" },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() =>
                    setBuildingInfo({
                      ...buildingInfo,
                      single_storey_occupancy: opt.value,
                    })
                  }
                  className={`p-3 border rounded-lg mr-2 mb-2 ${
                    buildingInfo.single_storey_occupancy === opt.value
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white border-gray-300"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      buildingInfo.single_storey_occupancy === opt.value
                        ? "text-white font-semibold"
                        : "text-gray-700"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View className="flex-row justify-between mt-4">
          <TouchableOpacity
            onPress={() => setCurrentStep(2)}
            className="bg-gray-500 p-4 rounded-lg flex-1 mr-2"
          >
            <Text className="text-white font-semibold text-center">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStep3BuildingInfo}
            disabled={
              addingBuildingInfo ||
              !buildingInfo.total_floors ||
              !buildingInfo.builtup_area_sqmt
            }
            className={`p-4 rounded-lg flex-1 ml-2 ${
              addingBuildingInfo ||
              !buildingInfo.total_floors ||
              !buildingInfo.builtup_area_sqmt
                ? "bg-gray-300"
                : "bg-blue-600"
            }`}
          >
            {addingBuildingInfo ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-center">Next</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // Merged Floor + Unit Details for Residential Single Story
  const renderStep4Merged = () => {
    const buildingOccupancy = buildingInfo.single_storey_occupancy || "Self";
    const isMixedSingleStorey = buildingOccupancy === "SelfRented";

    return (
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold mb-4">Floor & Unit Details</Text>
        <Text className="text-gray-600 mb-4">Enter details for each floor</Text>

        {mergedFloorUnits.map((floorUnit, index) => (
          <View
            key={index}
            className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-300"
          >
            <Text className="text-xl font-bold mb-4 text-blue-900">
              {getFloorName(floorUnit.floor_number)}
            </Text>

            {/* Construction Year */}
            <Text className="font-semibold mb-2">
              Construction Year<Text className="text-red-600">*</Text>
            </Text>
            <TextInput
              placeholder="Enter construction year span (e.g. 2023-2024)"
              value={floorUnit.construction_year}
              onChangeText={(text) =>
                updateMergedFloorUnit(index, "construction_year", text)
              }
              keyboardType="numeric"
              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
            />

            {/* Carpet Area */}
            <Text className="font-semibold mb-2">
              Carpet Area (sq.mt)<Text className="text-red-600">*</Text>
            </Text>
            <TextInput
              placeholder="Enter carpet area"
              value={floorUnit.carpet_area_sqmt}
              onChangeText={(text) =>
                updateMergedFloorUnit(index, "carpet_area_sqmt", text)
              }
              keyboardType="numeric"
              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
            />

            {/* Occupancy Status */}
            {isMixedSingleStorey ? (
              <>
                <Text className="font-semibold mb-2">
                  Occupancy Status
                  <Text className="text-red-600">*</Text>
                </Text>
                <View className="flex-row mb-3">
                  {[
                    { value: "Self", label: "Self Occupied", icon: "home" },
                    { value: "Rented", label: "Rented", icon: "business" },
                  ].map((status) => (
                    <TouchableOpacity
                      key={status.value}
                      onPress={() =>
                        updateMergedFloorUnit(
                          index,
                          "occupancy_status",
                          status.value,
                        )
                      }
                      className={`flex-1 p-3 border rounded-xl mx-1 ${
                        floorUnit.occupancy_status === status.value
                          ? "bg-blue-50 border-blue-600"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      <View className="items-center">
                        <MaterialIcons
                          name={status.icon}
                          size={20}
                          color={
                            floorUnit.occupancy_status === status.value
                              ? "#1d4ed8"
                              : "#6b7280"
                          }
                        />
                        <Text
                          className={`text-center text-xs mt-1 ${
                            floorUnit.occupancy_status === status.value
                              ? "text-blue-700 font-semibold"
                              : "text-gray-700"
                          }`}
                        >
                          {status.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <View className="mb-3">
                <Text className="font-semibold mb-1">Occupancy Status</Text>
                <View className="self-start bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 flex-row items-center">
                  <MaterialIcons name="verified" size={16} color="#1d4ed8" />
                  <Text className="text-sm text-blue-700 font-semibold">
                    {" "}
                    {buildingOccupancy.replace("_", " ")}
                  </Text>
                </View>
              </View>
            )}

            {/* Area for Self, Rented, Vacant */}
            {(floorUnit.occupancy_status === "Self" ||
              floorUnit.occupancy_status === "Rented" ||
              floorUnit.occupancy_status === "Vacant") && (
              <>
                <Text className="font-semibold mb-2">
                  Area (sq.mt)<Text className="text-red-600">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter area"
                  value={floorUnit.area}
                  onChangeText={(text) =>
                    updateMergedFloorUnit(index, "area", text)
                  }
                  keyboardType="numeric"
                  className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                />
              </>
            )}

            {/* Self and Rented Area for SelfRented */}
            {floorUnit.occupancy_status === "SelfRented" && (
              <>
                <Text className="font-semibold mb-2">
                  Self Occupied Area (sq.mt)
                  <Text className="text-red-600">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter self occupied area"
                  value={floorUnit.self_area}
                  onChangeText={(text) =>
                    updateMergedFloorUnit(index, "self_area", text)
                  }
                  keyboardType="numeric"
                  className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                />

                <Text className="font-semibold mb-2">
                  Rented Area (sq.mt)<Text className="text-red-600">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter rented area"
                  value={floorUnit.rented_area}
                  onChangeText={(text) =>
                    updateMergedFloorUnit(index, "rented_area", text)
                  }
                  keyboardType="numeric"
                  className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                />
              </>
            )}

            {/* Occupier Details (if Rented or SelfRented) */}
            {(floorUnit.occupancy_status === "Rented" ||
              floorUnit.occupancy_status === "SelfRented") && (
              <>
                <Text className="font-semibold mb-2">
                  Occupier/Tenant Name<Text className="text-red-600">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter occupier's name"
                  value={floorUnit.occupier_name}
                  onChangeText={(text) =>
                    updateMergedFloorUnit(index, "occupier_name", text)
                  }
                  className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                />

                <Text className="font-semibold mb-2">
                  Occupier Mobile Number
                  <Text className="text-red-600">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter occupier mobile number"
                  value={floorUnit.occupier_mobile}
                  onChangeText={(text) =>
                    updateMergedFloorUnit(index, "occupier_mobile", text)
                  }
                  keyboardType="number-pad"
                  maxLength={10}
                  className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                />

                <Text className="font-semibold mb-2">
                  Monthly Rent Amount (₹)
                  <Text className="text-red-600">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter monthly rent amount"
                  value={floorUnit.rent_amount}
                  onChangeText={(text) =>
                    updateMergedFloorUnit(index, "rent_amount", text)
                  }
                  keyboardType="numeric"
                  className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                />
              </>
            )}

            {/* Kitchen Details */}
            <Text className="text-lg font-bold mb-3 mt-4 text-gray-800">
              Kitchen Details
            </Text>

            <TouchableOpacity
              onPress={() =>
                updateMergedFloorUnit(
                  index,
                  "has_kitchen",
                  !floorUnit.has_kitchen,
                )
              }
              className="flex-row items-center mb-3"
            >
              <View
                className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                  floorUnit.has_kitchen
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-400"
                }`}
              >
                {floorUnit.has_kitchen && (
                  <MaterialIcons name="check" size={18} color="white" />
                )}
              </View>
              <Text className="text-base">Has Kitchen</Text>
            </TouchableOpacity>

            {floorUnit.has_kitchen && (
              <>
                <Text className="font-semibold mb-2">
                  Number of Kitchens<Text className="text-red-600">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter number of kitchens"
                  value={floorUnit.kitchen_count}
                  onChangeText={(text) =>
                    updateMergedFloorUnit(index, "kitchen_count", text)
                  }
                  keyboardType="numeric"
                  className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                />

                <Text className="font-semibold mb-2">
                  Total Kitchen Area (sq.mt)
                  <Text className="text-red-600">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter total kitchen area"
                  value={floorUnit.kitchen_area}
                  onChangeText={(text) =>
                    updateMergedFloorUnit(index, "kitchen_area", text)
                  }
                  keyboardType="numeric"
                  className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                />
              </>
            )}

            {/* Toilet Details */}
            <Text className="text-lg font-bold mb-3 mt-4 text-gray-800">
              Toilet Details
            </Text>

            <TouchableOpacity
              onPress={() =>
                updateMergedFloorUnit(
                  index,
                  "has_toilet",
                  !floorUnit.has_toilet,
                )
              }
              className="flex-row items-center mb-3"
            >
              <View
                className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                  floorUnit.has_toilet
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-400"
                }`}
              >
                {floorUnit.has_toilet && (
                  <MaterialIcons name="check" size={18} color="white" />
                )}
              </View>
              <Text className="text-base">Has Toilet</Text>
            </TouchableOpacity>

            {floorUnit.has_toilet && (
              <>
                <Text className="font-semibold mb-2">
                  Number of Toilets<Text className="text-red-600">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter number of toilets"
                  value={floorUnit.toilet_count}
                  onChangeText={(text) =>
                    updateMergedFloorUnit(index, "toilet_count", text)
                  }
                  keyboardType="numeric"
                  className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                />

                <Text className="font-semibold mb-2">
                  Total Toilet Area (sq.mt)
                  <Text className="text-red-600">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter total toilet area"
                  value={floorUnit.toilet_area}
                  onChangeText={(text) =>
                    updateMergedFloorUnit(index, "toilet_area", text)
                  }
                  keyboardType="numeric"
                  className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                />
              </>
            )}

            {/* Parking Details (Ground Floor Only) */}
            {floorUnit.floor_number === 0 && (
              <>
                <Text className="text-lg font-bold mb-3 mt-4 text-gray-800">
                  Parking Details
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    updateMergedFloorUnit(
                      index,
                      "has_parking",
                      !floorUnit.has_parking,
                    )
                  }
                  className="flex-row items-center mb-3"
                >
                  <View
                    className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                      floorUnit.has_parking
                        ? "bg-blue-600 border-blue-600"
                        : "border-gray-400"
                    }`}
                  >
                    {floorUnit.has_parking && (
                      <MaterialIcons name="check" size={18} color="white" />
                    )}
                  </View>
                  <Text className="text-base">Has Parking</Text>
                </TouchableOpacity>

                {floorUnit.has_parking && (
                  <>
                    <Text className="font-semibold mb-2">
                      Parking Type<Text className="text-red-600">*</Text>
                    </Text>
                    <View className="flex-row mb-3">
                      {["NONE", "OPEN", "COVERED"].map((type) => (
                        <TouchableOpacity
                          key={type}
                          onPress={() =>
                            updateMergedFloorUnit(index, "parking_type", type)
                          }
                          className={`flex-1 p-3 border rounded-lg mx-1 ${
                            floorUnit.parking_type === type
                              ? "bg-blue-600 border-blue-600"
                              : "border-gray-300"
                          }`}
                        >
                          <Text
                            className={`text-center ${floorUnit.parking_type === type ? "text-white" : "text-gray-700"}`}
                          >
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text className="font-semibold mb-2">
                      Parking Area (sq.mt)
                      <Text className="text-red-600">*</Text>
                    </Text>
                    <TextInput
                      placeholder="Enter parking area"
                      value={floorUnit.parking_area}
                      onChangeText={(text) =>
                        updateMergedFloorUnit(index, "parking_area", text)
                      }
                      keyboardType="numeric"
                      className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                    />
                  </>
                )}
              </>
            )}
          </View>
        ))}

        <View className="flex-row justify-between mt-4">
          <TouchableOpacity
            onPress={() => setCurrentStep(3)}
            className="bg-gray-500 p-4 rounded-lg flex-1 mr-2"
          >
            <Text className="text-white font-semibold text-center">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmitMergedFloorUnits}
            disabled={submittingMergedFloorUnits || addingFloor || addingUnit}
            className={`p-4 rounded-lg flex-1 ml-2 ${
              submittingMergedFloorUnits || addingFloor || addingUnit
                ? "bg-gray-300"
                : "bg-blue-600"
            }`}
          >
            {submittingMergedFloorUnits || addingFloor || addingUnit ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-center">
                {isSavedSingleStoreyData
                  ? "Update & Continue"
                  : "Save & Continue"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderStep4MultiStorey = () => {
    return (
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold mb-2">Floor & Unit Details</Text>
        <Text className="text-gray-600 mb-4">
          For each floor, enter number of flats and fill each unit detail.
        </Text>

        {multiStoreyFloorUnits.map((floor, floorIndex) => (
          <View
            key={floorIndex}
            className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
          >
            {(() => {
              const isGroundFloor = floor.floor_number === 0;
              const isBasementFloor = floor.floor_number === -1;
              const groundMode = floor.ground_floor_mode || "UNIT_ONLY";
              const basementMode = floor.basement_floor_mode || "UNIT_ONLY";
              const showUnits =
                (!isGroundFloor &&
                  !isBasementFloor &&
                  (floor.floor_use === "UNIT_ONLY" ||
                    floor.floor_use === "BOTH" ||
                    !floor.floor_use)) ||
                (isGroundFloor &&
                  (groundMode === "UNIT_ONLY" || groundMode === "BOTH")) ||
                (isBasementFloor &&
                  (basementMode === "UNIT_ONLY" || basementMode === "BOTH"));
              const hasAddedUnits = (floor.units || []).length > 0;
              const showParking =
                (!isGroundFloor &&
                  !isBasementFloor &&
                  (floor.floor_use === "PARKING_ONLY" ||
                    floor.floor_use === "BOTH")) ||
                (isGroundFloor &&
                  (groundMode === "PARKING_ONLY" || groundMode === "BOTH")) ||
                (isBasementFloor &&
                  (basementMode === "PARKING_ONLY" || basementMode === "BOTH"));

              return (
                <>
                  <Text className="text-xl font-bold mb-3 text-gray-800">
                    {getFloorName(floor.floor_number)}
                  </Text>

                  <Text className="font-semibold mb-2">
                    Floor Construction Year
                    <Text className="text-red-600">*</Text>
                  </Text>
                  <TextInput
                    placeholder="Enter floor construction year span (e.g. 2023-2024)"
                    value={floor.construction_year}
                    onChangeText={(text) =>
                      updateMultiStoreyFloor(
                        floorIndex,
                        "construction_year",
                        text,
                      )
                    }
                    keyboardType="numeric"
                    className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                  />

                  <Text className="font-semibold mb-2">
                    Floor Area (sq.mt)
                    <Text className="text-red-600">*</Text>
                  </Text>

                  <TextInput
                    placeholder="Enter floor area"
                    value={floor.floor_area_sqmt}
                    onChangeText={(text) =>
                      updateMultiStoreyFloor(
                        floorIndex,
                        "floor_area_sqmt",
                        text,
                      )
                    }
                    keyboardType="numeric"
                    className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                  />

                  <Text className="font-semibold mb-2">
                    Floor Use<Text className="text-red-600">*</Text>
                  </Text>
                  <View className="flex-row mb-3">
                    {[
                      { value: "UNIT_ONLY", label: "Unit" },
                      { value: "PARKING_ONLY", label: "Parking" },
                      { value: "BOTH", label: "Both" },
                    ].map((mode) => (
                      <TouchableOpacity
                        key={mode.value}
                        onPress={() => {
                          if (isGroundFloor) {
                            updateGroundFloorMode(floorIndex, mode.value);
                          } else if (isBasementFloor) {
                            updateBasementFloorMode(floorIndex, mode.value);
                          } else {
                            // For other floors, update floor_use
                            updateMultiStoreyFloor(
                              floorIndex,
                              "floor_use",
                              mode.value,
                            );
                            const updated = [...multiStoreyFloorUnits];
                            const fl = { ...updated[floorIndex] };
                            fl.floor_use = mode.value;
                            fl.has_parking =
                              mode.value === "PARKING_ONLY" ||
                              mode.value === "BOTH";
                            if (mode.value === "PARKING_ONLY") {
                              fl.unit_count = "0";
                              fl.units = [];
                            } else if ((fl.units || []).length === 0) {
                              fl.unit_count = "0";
                              fl.units = [];
                            }
                            updated[floorIndex] = fl;
                            setMultiStoreyFloorUnits(updated);
                          }
                        }}
                        className={`flex-1 p-3 border rounded-lg mx-1 ${
                          (isGroundFloor
                            ? groundMode
                            : isBasementFloor
                              ? basementMode
                              : floor.floor_use || "UNIT_ONLY") === mode.value
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        <Text
                          className={`text-center text-xs ${
                            (isGroundFloor
                              ? groundMode
                              : isBasementFloor
                                ? basementMode
                                : floor.floor_use || "UNIT_ONLY") === mode.value
                              ? "text-white font-semibold"
                              : "text-gray-700"
                          }`}
                        >
                          {mode.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {showParking && (
                    <>
                      <Text className="font-semibold mb-2">
                        Parking Type<Text className="text-red-600">*</Text>
                      </Text>
                      <View className="flex-row mb-3">
                        {["OPEN", "COVERED"].map((type) => (
                          <TouchableOpacity
                            key={type}
                            onPress={() =>
                              updateMultiStoreyFloor(
                                floorIndex,
                                "parking_type",
                                type,
                              )
                            }
                            className={`flex-1 p-3 border rounded-lg mx-1 ${
                              floor.parking_type === type
                                ? "bg-blue-600 border-blue-600"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            <Text
                              className={`text-center ${
                                floor.parking_type === type
                                  ? "text-white font-semibold"
                                  : "text-gray-700"
                              }`}
                            >
                              {type}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text className="font-semibold mb-2">
                        Parking Area (sq.mt)
                        <Text className="text-red-600">*</Text>
                      </Text>
                      <TextInput
                        placeholder="Enter parking area"
                        value={floor.parking_area}
                        onChangeText={(text) =>
                          updateMultiStoreyFloor(
                            floorIndex,
                            "parking_area",
                            text,
                          )
                        }
                        keyboardType="numeric"
                        className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                      />
                    </>
                  )}
                  {(() => {
                    const currentMode = isBasementFloor
                      ? basementMode
                      : isGroundFloor
                        ? groundMode
                        : floor.floor_use || "UNIT_ONLY";
                    const isParkingOnly = currentMode === "PARKING_ONLY";

                    if (isParkingOnly) {
                      const isSaved =
                        floorSavedIds[floorIndex] ??
                        !!multiStoreyFloorUnits[floorIndex].id;
                      return (
                        <TouchableOpacity
                          activeOpacity={isSaved ? 1 : 0.5}
                          disabled={isSaved}
                          onPress={() => {
                            if (!isSaved) {
                              handleSaveFloor(floorIndex);
                            }
                          }}
                          className={`p-3 rounded-lg mb-3 ${
                            isSaved ? "bg-green-600" : "bg-blue-600"
                          }`}
                        >
                          <Text className="text-center text-white font-semibold">
                            {isSaved ? "Floor Saved" : "Save Floor"}
                          </Text>
                        </TouchableOpacity>
                      );
                    } else {
                      return (
                        <>
                          <Text className="font-semibold mb-2">
                            No. of Units / Flats
                            <Text className="text-red-600">*</Text>
                          </Text>
                          <TextInput
                            placeholder="Enter number of units"
                            value={floor.unit_count}
                            editable={false}
                            onChangeText={(text) =>
                              updateMultiStoreyUnitCount(floorIndex, text)
                            }
                            keyboardType="numeric"
                            className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                          />

                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() =>
                              updateMultiStoreyUnitCount(floorIndex)
                            }
                            className="bg-blue-600 p-3 rounded-lg mb-3 flex-row items-center justify-center"
                          >
                            <MaterialIcons
                              name="apartment"
                              size={20}
                              color="#fff"
                            />

                            <Text className="text-white font-semibold ml-2">
                              Add Flats
                            </Text>
                          </TouchableOpacity>
                        </>
                      );
                    }
                  })()}

                  {showUnits &&
                    hasAddedUnits &&
                    (floor.units || []).map((unit, unitIndex) => (
                      <View
                        key={
                          unit.id != null
                            ? `floor-${floorIndex}-unit-${unit.id}`
                            : `floor-${floorIndex}-unit-${unitIndex}`
                        }
                        className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-3 mt-2"
                      >
                        <View className="flex-row justify-between items-center mb-3">
                          <Text className="text-lg font-bold text-gray-800">
                            Unit {unitIndex + 1}
                          </Text>
                          {unitIndex > 0 && (
                            <TouchableOpacity
                              onPress={() =>
                                deleteMultiStoreyUnit(floorIndex, unitIndex)
                              }
                              className="bg-red-500 px-3 py-1 rounded-lg flex-row items-center"
                            >
                              {deletingUnitKey ===
                              `${floorIndex}-${unitIndex}` ? (
                                <ActivityIndicator size="small" color="white" />
                              ) : (
                                <MaterialIcons
                                  name="delete"
                                  size={18}
                                  color="white"
                                />
                              )}
                              <Text className="text-white text-xs font-semibold ml-1">
                                {deletingUnitKey ===
                                `${floorIndex}-${unitIndex}`
                                  ? "Removing..."
                                  : "Remove"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text className="font-semibold mb-2">
                          Unit Address<Text className="text-red-600">*</Text>
                        </Text>
                        <TextInput
                          placeholder="Enter unit/flat address"
                          value={unit.unit_address}
                          onChangeText={(text) =>
                            updateMultiStoreyUnit(
                              floorIndex,
                              unitIndex,
                              "unit_address",
                              text,
                            )
                          }
                          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                        />

                        <Text className="font-semibold mb-2">
                          Carpet Area (sq.mt)
                          <Text className="text-red-600">*</Text>
                        </Text>
                        <TextInput
                          placeholder="Enter carpet area"
                          value={unit.carpet_area_sqmt}
                          onChangeText={(text) =>
                            updateMultiStoreyUnit(
                              floorIndex,
                              unitIndex,
                              "carpet_area_sqmt",
                              text,
                            )
                          }
                          keyboardType="numeric"
                          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                        />

                        <Text className="font-semibold mb-2">
                          Construction Year
                          <Text className="text-red-600">*</Text>
                        </Text>
                        <TextInput
                          placeholder="Enter unit construction year span (e.g. 2023-2024)"
                          value={unit.construction_year}
                          onChangeText={(text) =>
                            updateMultiStoreyUnit(
                              floorIndex,
                              unitIndex,
                              "construction_year",
                              text,
                            )
                          }
                          keyboardType="numeric"
                          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                        />

                        {isMixedFlow && (
                          <>
                            <Text className="font-semibold mb-2">
                              Usage Type<Text className="text-red-600">*</Text>
                            </Text>
                            <View className="flex-row mb-3">
                              {[
                                { value: "RESIDENTIAL", label: "Residential" },
                                { value: "COMMERCIAL", label: "Commercial" },
                              ].map((uType) => (
                                <TouchableOpacity
                                  key={uType.value}
                                  onPress={() =>
                                    updateMultiStoreyUnit(
                                      floorIndex,
                                      unitIndex,
                                      "usage_type",
                                      uType.value,
                                    )
                                  }
                                  className={`flex-1 p-3 border rounded-lg mx-1 ${
                                    (unit.usage_type || "RESIDENTIAL") ===
                                    uType.value
                                      ? "bg-blue-600 border-blue-600"
                                      : "border-gray-300 bg-white"
                                  }`}
                                >
                                  <Text
                                    className={`text-center text-sm ${
                                      (unit.usage_type || "RESIDENTIAL") ===
                                      uType.value
                                        ? "text-white font-semibold"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    {uType.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </>
                        )}

                        <Text className="font-semibold mb-2">
                          Occupancy Status
                          <Text className="text-red-600">*</Text>
                        </Text>
                        <View className="flex-row flex-wrap mb-3">
                          {[
                            { value: "Self", label: "Self", icon: "home" },
                            {
                              value: "Rented",
                              label: "Rented",
                              icon: "business",
                            },
                            {
                              value: "Vacant",
                              label: "Vacant",
                              icon: "hourglass-empty",
                            },
                            {
                              value: "SelfRented",
                              label: "Self + Rented",
                              icon: "swap-horiz",
                            },
                          ].map((status) => (
                            <TouchableOpacity
                              key={status.value}
                              onPress={() =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "occupancy_status",
                                  status.value,
                                )
                              }
                              className={`w-[48%] p-3 border rounded-xl mr-[2%] mb-2 ${
                                unit.occupancy_status === status.value
                                  ? "bg-blue-50 border-blue-600"
                                  : "border-gray-300 bg-white"
                              }`}
                            >
                              <View className="flex-row items-center">
                                <MaterialIcons
                                  name={status.icon}
                                  size={16}
                                  color={
                                    unit.occupancy_status === status.value
                                      ? "#1d4ed8"
                                      : "#6b7280"
                                  }
                                />
                                <Text
                                  className={`text-xs ml-2 ${
                                    unit.occupancy_status === status.value
                                      ? "text-blue-700 font-semibold"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {status.label}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {(unit.occupancy_status === "Self" ||
                          unit.occupancy_status === "Rented" ||
                          unit.occupancy_status === "Vacant") && (
                          <>
                            <Text className="font-semibold mb-2">
                              Area (sq.mt)
                              <Text className="text-red-600">*</Text>
                            </Text>
                            <TextInput
                              placeholder="Enter area"
                              value={unit.area}
                              onChangeText={(text) =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "area",
                                  text,
                                )
                              }
                              keyboardType="numeric"
                              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                            />
                          </>
                        )}

                        {unit.occupancy_status === "SelfRented" && (
                          <>
                            <Text className="font-semibold mb-2">
                              Self Area (sq.mt)
                              <Text className="text-red-600">*</Text>
                            </Text>
                            <TextInput
                              placeholder="Enter self occupied area"
                              value={unit.self_area}
                              onChangeText={(text) =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "self_area",
                                  text,
                                )
                              }
                              keyboardType="numeric"
                              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                            />

                            <Text className="font-semibold mb-2">
                              Rented Area (sq.mt)
                              <Text className="text-red-600">*</Text>
                            </Text>
                            <TextInput
                              placeholder="Enter rented area"
                              value={unit.rented_area}
                              onChangeText={(text) =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "rented_area",
                                  text,
                                )
                              }
                              keyboardType="numeric"
                              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                            />
                          </>
                        )}

                        <Text className="font-semibold mb-2">
                          Owner Name<Text className="text-red-600">*</Text>
                        </Text>
                        <TextInput
                          placeholder="Enter owner name"
                          value={unit.owner_name}
                          onChangeText={(text) =>
                            updateMultiStoreyUnit(
                              floorIndex,
                              unitIndex,
                              "owner_name",
                              text,
                            )
                          }
                          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                        />

                        <Text className="font-semibold mb-2">
                          Owner Mobile<Text className="text-red-600">*</Text>
                        </Text>
                        <TextInput
                          placeholder="Enter owner mobile"
                          value={unit.owner_mobile}
                          onChangeText={(text) =>
                            updateMultiStoreyUnit(
                              floorIndex,
                              unitIndex,
                              "owner_mobile",
                              text,
                            )
                          }
                          keyboardType="number-pad"
                          maxLength={10}
                          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                        />

                        <Text className="font-semibold mb-2">
                          Occupation<Text className="text-red-600">*</Text>
                        </Text>
                        <TextInput
                          placeholder="Enter owner occupation"
                          value={unit.owner_occupation}
                          onChangeText={(text) =>
                            updateMultiStoreyUnit(
                              floorIndex,
                              unitIndex,
                              "owner_occupation",
                              text,
                            )
                          }
                          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                        />

                        <Text className="font-semibold mb-2">
                          Disabled Person<Text className="text-red-600">*</Text>
                        </Text>
                        <View className="flex-row mb-3">
                          {["YES", "NO"].map((value) => (
                            <TouchableOpacity
                              key={value}
                              onPress={() =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "is_disabled_person",
                                  value,
                                )
                              }
                              className={`flex-1 p-3 border rounded-lg mx-1 ${
                                unit.is_disabled_person === value
                                  ? "bg-blue-600 border-blue-600"
                                  : "border-gray-300 bg-white"
                              }`}
                            >
                              <Text
                                className={`text-center ${
                                  unit.is_disabled_person === value
                                    ? "text-white font-semibold"
                                    : "text-gray-700"
                                }`}
                              >
                                {value}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text className="font-semibold mb-2">
                          Father/Husband Name
                          <Text className="text-red-600">*</Text>
                        </Text>
                        <TextInput
                          placeholder="Enter father/husband name"
                          value={unit.father_husband_name}
                          onChangeText={(text) =>
                            updateMultiStoreyUnit(
                              floorIndex,
                              unitIndex,
                              "father_husband_name",
                              text,
                            )
                          }
                          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                        />

                        <Text className="font-semibold mb-2">
                          Aadhar Number<Text className="text-red-600">*</Text>
                        </Text>
                        <TextInput
                          placeholder="Enter 12-digit Aadhar number"
                          value={unit.aadhar_number}
                          onChangeText={(text) =>
                            updateMultiStoreyUnit(
                              floorIndex,
                              unitIndex,
                              "aadhar_number",
                              text,
                            )
                          }
                          keyboardType="number-pad"
                          maxLength={12}
                          className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                        />

                        <Text className="font-semibold mb-2">
                          Bill Proof<Text className="text-red-600">*</Text>
                        </Text>
                        {unit.bill_photo_url ? (
                          <View className="mb-3">
                            <Image
                              source={{ uri: unit.bill_photo_url }}
                              className="w-full h-40 rounded-lg mb-2"
                              resizeMode="cover"
                            />
                            <TouchableOpacity
                              onPress={() =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "bill_photo_url",
                                  "",
                                )
                              }
                              className="bg-red-500 p-2 rounded-lg"
                            >
                              <Text className="text-white text-center">
                                Remove Bill Proof
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View className="flex-row mb-3">
                            <TouchableOpacity
                              onPress={async () => {
                                const { status } =
                                  await ImagePicker.requestMediaLibraryPermissionsAsync();
                                if (status !== "granted") {
                                  Toast.show({
                                    type: "error",
                                    text1: "Permission Denied",
                                    text2: "Gallery permission is required",
                                  });
                                  return;
                                }
                                const result =
                                  await ImagePicker.launchImageLibraryAsync({
                                    mediaTypes:
                                      ImagePicker.MediaTypeOptions.Images,
                                    allowsEditing: true,
                                    quality: 0.8,
                                  });
                                if (!result.canceled) {
                                  updateMultiStoreyUnit(
                                    floorIndex,
                                    unitIndex,
                                    "bill_photo_url",
                                    result.assets[0].uri,
                                  );
                                }
                              }}
                              className="bg-blue-600 p-3 rounded-lg flex-1 mr-2 flex-row items-center justify-center"
                            >
                              <MaterialIcons
                                name="photo-library"
                                size={20}
                                color="white"
                              />
                              <Text className="text-white font-semibold ml-2">
                                Gallery
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={async () => {
                                const { status } =
                                  await ImagePicker.requestCameraPermissionsAsync();
                                if (status !== "granted") {
                                  Toast.show({
                                    type: "error",
                                    text1: "Permission Denied",
                                    text2: "Camera permission is required",
                                  });
                                  return;
                                }
                                const result =
                                  await ImagePicker.launchCameraAsync({
                                    mediaTypes:
                                      ImagePicker.MediaTypeOptions.Images,
                                    allowsEditing: true,
                                    quality: 0.8,
                                  });
                                if (!result.canceled) {
                                  updateMultiStoreyUnit(
                                    floorIndex,
                                    unitIndex,
                                    "bill_photo_url",
                                    result.assets[0].uri,
                                  );
                                }
                              }}
                              className="bg-green-600 p-3 rounded-lg flex-1 ml-2 flex-row items-center justify-center"
                            >
                              <MaterialIcons
                                name="camera-alt"
                                size={20}
                                color="white"
                              />
                              <Text className="text-white font-semibold ml-2">
                                Camera
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        <Text className="text-base font-bold mb-2 mt-2 text-gray-800">
                          Utilities
                        </Text>
                        {[
                          ["has_electricity", "Electricity Connection"],
                          ["has_gas_connection", "Gas Connection"],
                          ["has_solar", "Solar Panel"],
                          // ["has_rainwater_harvesting", "Rainwater Harvesting"],
                          ["has_sewer", "Sewer Connection"],
                          ["has_water_connection", "Water Connection"],
                          ["has_internet_connection", "Internet Connection"],
                        ].map(([key, label]) => (
                          <TouchableOpacity
                            key={key}
                            onPress={() =>
                              updateMultiStoreyUnit(
                                floorIndex,
                                unitIndex,
                                key,
                                !unit[key],
                              )
                            }
                            className="flex-row items-center mb-3"
                          >
                            <View
                              className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                                unit[key]
                                  ? "bg-blue-600 border-blue-600"
                                  : "border-gray-400"
                              }`}
                            >
                              {unit[key] && (
                                <MaterialIcons
                                  name="check"
                                  size={18}
                                  color="white"
                                />
                              )}
                            </View>
                            <Text className="text-base">{label}</Text>
                          </TouchableOpacity>
                        ))}

                        {(unit.occupancy_status === "Rented" ||
                          unit.occupancy_status === "SelfRented") && (
                          <>
                            <Text className="font-semibold mb-2">
                              Occupier Name
                              <Text className="text-red-600">*</Text>
                            </Text>
                            <TextInput
                              placeholder="Enter occupier name"
                              value={unit.occupier_name}
                              onChangeText={(text) =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "occupier_name",
                                  text,
                                )
                              }
                              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                            />

                            <Text className="font-semibold mb-2">
                              Occupier Mobile
                              <Text className="text-red-600">*</Text>
                            </Text>
                            <TextInput
                              placeholder="Enter occupier mobile"
                              value={unit.occupier_mobile}
                              onChangeText={(text) =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "occupier_mobile",
                                  text,
                                )
                              }
                              keyboardType="number-pad"
                              maxLength={10}
                              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                            />

                            <Text className="font-semibold mb-2">
                              Monthly Rent Amount (₹)
                              <Text className="text-red-600">*</Text>
                            </Text>
                            <TextInput
                              placeholder="Enter monthly rent amount"
                              value={unit.rent_amount}
                              onChangeText={(text) =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "rent_amount",
                                  text,
                                )
                              }
                              keyboardType="numeric"
                              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                            />
                          </>
                        )}

                        <Text className="text-base font-bold mb-2 mt-2 text-gray-800">
                          Kitchen Details
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            updateMultiStoreyUnit(
                              floorIndex,
                              unitIndex,
                              "has_kitchen",
                              !unit.has_kitchen,
                            )
                          }
                          className="flex-row items-center mb-3"
                        >
                          <View
                            className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                              unit.has_kitchen
                                ? "bg-blue-600 border-blue-600"
                                : "border-gray-400"
                            }`}
                          >
                            {unit.has_kitchen && (
                              <MaterialIcons
                                name="check"
                                size={18}
                                color="white"
                              />
                            )}
                          </View>
                          <Text className="text-base">Has Kitchen</Text>
                        </TouchableOpacity>

                        {unit.has_kitchen && (
                          <>
                            <Text className="font-semibold mb-2">
                              No. of Kitchens
                              <Text className="text-red-600">*</Text>
                            </Text>
                            <TextInput
                              placeholder="Enter number of kitchens"
                              value={unit.kitchen_count}
                              onChangeText={(text) =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "kitchen_count",
                                  text,
                                )
                              }
                              keyboardType="numeric"
                              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                            />

                            <Text className="font-semibold mb-2">
                              Total Kitchen Area (sq.mt)
                              <Text className="text-red-600">*</Text>
                            </Text>
                            <TextInput
                              placeholder="Enter total kitchen area"
                              value={unit.kitchen_area}
                              onChangeText={(text) =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "kitchen_area",
                                  text,
                                )
                              }
                              keyboardType="numeric"
                              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                            />
                          </>
                        )}

                        <Text className="text-base font-bold mb-2 mt-2 text-gray-800">
                          Toilet Details
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            updateMultiStoreyUnit(
                              floorIndex,
                              unitIndex,
                              "has_toilet",
                              !unit.has_toilet,
                            )
                          }
                          className="flex-row items-center mb-3"
                        >
                          <View
                            className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                              unit.has_toilet
                                ? "bg-blue-600 border-blue-600"
                                : "border-gray-400"
                            }`}
                          >
                            {unit.has_toilet && (
                              <MaterialIcons
                                name="check"
                                size={18}
                                color="white"
                              />
                            )}
                          </View>
                          <Text className="text-base">Has Toilet</Text>
                        </TouchableOpacity>

                        {unit.has_toilet && (
                          <>
                            <Text className="font-semibold mb-2">
                              No. of Toilets
                              <Text className="text-red-600">*</Text>
                            </Text>
                            <TextInput
                              placeholder="Enter number of toilets"
                              value={unit.toilet_count}
                              onChangeText={(text) =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "toilet_count",
                                  text,
                                )
                              }
                              keyboardType="numeric"
                              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                            />

                            <Text className="font-semibold mb-2">
                              Total Toilet Area (sq.mt)
                              <Text className="text-red-600">*</Text>
                            </Text>
                            <TextInput
                              placeholder="Enter total toilet area"
                              value={unit.toilet_area}
                              onChangeText={(text) =>
                                updateMultiStoreyUnit(
                                  floorIndex,
                                  unitIndex,
                                  "toilet_area",
                                  text,
                                )
                              }
                              keyboardType="numeric"
                              className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
                            />
                          </>
                        )}
                        <Text className="text-xl font-bold mb-3 mt-4">
                          Units Photos
                          <Text className="text-red-600 font-semibold">*</Text>
                        </Text>
                        <Text className="text-gray-600 mb-3">
                          Add at least one photo before continuing
                        </Text>

                        <View className="flex-row mb-4">
                          <TouchableOpacity
                            onPress={() => pickImages(floorIndex, unitIndex)}
                            className="bg-blue-600 p-3 rounded-lg flex-1 mr-2 flex-row items-center justify-center"
                          >
                            <MaterialIcons
                              name="photo-library"
                              size={20}
                              color="white"
                            />
                            <Text className="text-white font-semibold ml-2">
                              Gallery
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => capturePhoto(floorIndex, unitIndex)}
                            className="bg-green-600 p-3 rounded-lg flex-1 ml-2 flex-row items-center justify-center"
                          >
                            <MaterialIcons
                              name="camera-alt"
                              size={20}
                              color="white"
                            />
                            <Text className="text-white font-semibold ml-2">
                              Camera
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View className="mb-3">
                          <Text className="font-semibold mb-2">
                            {(unit.photos || []).length} photo(s) selected
                          </Text>

                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                          >
                            {(unit.photos || []).map((photo, index) => (
                              <View
                                key={index}
                                className="bg-white border border-gray-200 rounded-xl p-2 mr-3"
                              >
                                <Image
                                  source={{ uri: photo.uri }}
                                  className="w-40 h-64 rounded-lg mb-2"
                                  resizeMode="cover"
                                />

                                <TouchableOpacity
                                  onPress={() => {
                                    const updated = [...multiStoreyFloorUnits];
                                    updated[floorIndex].units[unitIndex] = {
                                      ...updated[floorIndex].units[unitIndex],
                                      photos: (
                                        updated[floorIndex].units[unitIndex]
                                          .photos || []
                                      ).filter((_, i) => i !== index),
                                    };
                                    setMultiStoreyFloorUnits(updated);
                                  }}
                                  className="bg-red-500 p-2 rounded-lg"
                                >
                                  <Text className="text-white text-center text-sm">
                                    Remove
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ))}
                          </ScrollView>
                        </View>
                        {(floor.units || []).length > 0 && (
                          <View className="flex-row justify-end mb-4 p-3 gap-2 flex-wrap mt-5">
                            {unit.id == null && (
                              <TouchableOpacity
                                onPress={() => saveUnitDetailsOnly(floorIndex)}
                                disabled={
                                  savingUnitDetails &&
                                  savingFloorIndex === floorIndex
                                }
                                className={`px-4 py-4 rounded-lg flex-row items-center justify-center flex-1 bg-blue-600 ${
                                  savingUnitDetails &&
                                  savingFloorIndex === floorIndex
                                    ? "opacity-50"
                                    : ""
                                }`}
                              >
                                {savingUnitDetails &&
                                savingFloorIndex === floorIndex ? (
                                  <>
                                    <ActivityIndicator
                                      color="white"
                                      size={20}
                                    />
                                    <Text className="text-white font-semibold ml-2">
                                      Saving...
                                    </Text>
                                  </>
                                ) : (
                                  <>
                                    <MaterialIcons
                                      name="save"
                                      size={20}
                                      color="white"
                                    />
                                    <Text className="text-white font-semibold ml-2">
                                      Save Unit Details
                                    </Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}
                            {unit.id != null && (
                              <>
                                {/* ADD NEW FLAT BUTTON */}
                                <TouchableOpacity
                                  onPress={() =>
                                    updateMultiStoreyUnitCount(floorIndex)
                                  }
                                  disabled={
                                    savingUnitDetails &&
                                    savingFloorIndex === floorIndex
                                  }
                                  className={`px-4 py-4 rounded-lg flex-row items-center justify-center flex-1 bg-blue-600 mr-2 ${
                                    savingUnitDetails &&
                                    savingFloorIndex === floorIndex
                                      ? "opacity-50"
                                      : ""
                                  }`}
                                >
                                  <MaterialIcons
                                    name="add-circle"
                                    size={20}
                                    color="white"
                                  />
                                  <Text className="text-white font-bold ml-2">
                                    Add New Flat
                                  </Text>
                                </TouchableOpacity>

                                {/* UPDATE UNITS BUTTON */}
                                <TouchableOpacity
                                  onPress={() =>
                                    updateUnitDetailsOnly(floorIndex, unitIndex)
                                  }
                                  disabled={
                                    savingUnitDetails &&
                                    savingFloorIndex === floorIndex &&
                                    savingUnitIndex === unitIndex
                                  }
                                  className={`px-4 py-4 rounded-lg flex-row items-center justify-center flex-1 bg-orange-600 ${
                                    savingUnitDetails &&
                                    savingFloorIndex === floorIndex &&
                                    savingUnitIndex === unitIndex
                                      ? "opacity-50"
                                      : ""
                                  }`}
                                >
                                  {savingUnitDetails &&
                                  savingFloorIndex === floorIndex &&
                                  savingUnitIndex === unitIndex ? (
                                    <>
                                      {/* UPDATE HOTE WAQT LOADER DIKHAYEN */}
                                      <ActivityIndicator
                                        color="white"
                                        size={20}
                                      />
                                      <Text className="text-white font-bold ml-2">
                                        Updating...
                                      </Text>
                                    </>
                                  ) : (
                                    <>
                                      <MaterialIcons
                                        name="edit"
                                        size={20}
                                        color="white"
                                      />
                                      <Text className="text-white font-bold ml-2">
                                        Update Unit
                                      </Text>
                                    </>
                                  )}
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                </>
              );
            })()}
          </View>
        ))}

        <View className="flex-row justify-between mt-4">
          <TouchableOpacity
            onPress={() => setCurrentStep(3)}
            className="bg-gray-500 p-4 rounded-lg flex-1 mr-2"
          >
            <Text className="text-white font-semibold text-center">Back</Text>
          </TouchableOpacity>

          {/* ℹ️ Note: This button may show loader while saving individual units - this is expected
              because Save Unit Details and Update Unit buttons call mutations tracked by addingUnit state */}
          <TouchableOpacity
            onPress={handleSubmitMultiStoreyFloorUnits}
            disabled={addingFloor || addingUnit}
            className={`p-4 rounded-lg flex-1 ml-2 ${
              addingFloor || addingUnit ? "bg-gray-300" : "bg-blue-600"
            }`}
          >
            {addingFloor || addingUnit ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-center">
                Save & Continue
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // const renderStep4 = () => (
  //   <ScrollView className="flex-1 p-4">
  //     <Text className="text-2xl font-bold mb-4">Floor Details</Text>
  //     <Text className="text-gray-600 mb-4">
  //       Add each floor with its construction year
  //     </Text>

  //     {floors.length > 0 && (
  //       <View className="mb-4">
  //         <Text className="font-semibold mb-2">Added Floors:</Text>
  //         {floors.map((floor, index) => (
  //           <View
  //             key={index}
  //             className="bg-green-100 p-3 rounded-lg mb-2 border border-green-500"
  //           >
  //             <Text className="text-green-800">
  //               Floor {floor.floor_number} - Built: {floor.construction_year}
  //             </Text>
  //           </View>
  //         ))}
  //       </View>
  //     )}

  //     <Text className="font-semibold mb-2">
  //       Floor Number<Text className="text-red-600">*</Text>
  //     </Text>
  //     <TextInput
  //       placeholder="0=Ground, -1=Basement, 1+=Upper floors"
  //       value={currentFloorData.floor_number}
  //       onChangeText={(text) =>
  //         setCurrentFloorData({ ...currentFloorData, floor_number: text })
  //       }
  //       keyboardType="numeric"
  //       className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
  //     />

  //     <Text className="font-semibold mb-2">
  //       Construction Year<Text className="text-red-600">*</Text>
  //     </Text>
  //     <TextInput
  //       placeholder="Enter construction year span (e.g. 2023-2024)"
  //       value={currentFloorData.construction_year}
  //       onChangeText={(text) =>
  //         setCurrentFloorData({
  //           ...currentFloorData,
  //           construction_year: sanitizeFieldValue("construction_year", text),
  //         })
  //       }
  //       keyboardType="numeric"
  //       className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
  //     />

  //     <Text className="font-semibold mb-2">Floor Usage Type</Text>
  //     {loadingFloorTypes ? (
  //       <ActivityIndicator />
  //     ) : (
  //       <View className="mb-4">
  //         {floorUsageTypes?.map((type) => (
  //           <TouchableOpacity
  //             key={type.id}
  //             onPress={() =>
  //               setCurrentFloorData({
  //                 ...currentFloorData,
  //                 usage_type_id: type.id,
  //               })
  //             }
  //             className={`p-3 border rounded-lg mb-2 ${
  //               currentFloorData.usage_type_id === type.id
  //                 ? "bg-blue-600 border-blue-600"
  //                 : "border-gray-300"
  //             }`}
  //           >
  //             <Text
  //               className={
  //                 currentFloorData.usage_type_id === type.id
  //                   ? "text-white font-semibold"
  //                   : "text-gray-700"
  //               }
  //             >
  //               {type.name}
  //             </Text>
  //           </TouchableOpacity>
  //         ))}
  //       </View>
  //     )}

  //     <TouchableOpacity
  //       onPress={handleAddFloor}
  //       disabled={addingFloor}
  //       className={`p-4 rounded-lg mb-4 ${addingFloor ? "bg-gray-300" : "bg-green-600"}`}
  //     >
  //       {addingFloor ? (
  //         <ActivityIndicator color="white" />
  //       ) : (
  //         <Text className="text-white font-semibold text-center">
  //           Add Floor
  //         </Text>
  //       )}
  //     </TouchableOpacity>

  //     <View className="flex-row justify-between mt-4">
  //       <TouchableOpacity
  //         onPress={() => setCurrentStep(3)}
  //         className="bg-gray-500 p-4 rounded-lg flex-1 mr-2"
  //       >
  //         <Text className="text-white font-semibold text-center">Back</Text>
  //       </TouchableOpacity>

  //       <TouchableOpacity
  //         onPress={handleContinueToUnits}
  //         className="p-4 rounded-lg flex-1 ml-2 bg-blue-600"
  //       >
  //         <Text className="text-white font-semibold text-center">
  //           Continue to Photos
  //         </Text>
  //       </TouchableOpacity>
  //     </View>
  //   </ScrollView>
  // );

  const renderStep5 = () => (
    <ScrollView className="flex-1 p-4">
      <Text className="text-2xl font-bold mb-4">Unit Details</Text>

      <Text className="font-semibold mb-2">
        Floor Number<Text className="text-red-600">*</Text>
      </Text>
      <TextInput
        placeholder="Enter floor number"
        value={currentUnitData.floor_number}
        onChangeText={(text) =>
          setCurrentUnitData({ ...currentUnitData, floor_number: text })
        }
        keyboardType="numeric"
        className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
      />

      <Text className="font-semibold mb-2">
        Carpet Area (sq.mt)<Text className="text-red-600">*</Text>
      </Text>
      <TextInput
        placeholder="Enter carpet area in square meters"
        value={currentUnitData.carpet_area_sqmt}
        onChangeText={(text) =>
          setCurrentUnitData({ ...currentUnitData, carpet_area_sqmt: text })
        }
        keyboardType="numeric"
        className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
      />

      <Text className="font-semibold mb-2">
        Owner Name<Text className="text-red-600">*</Text>
      </Text>
      <TextInput
        placeholder="Enter owner's full name"
        value={currentUnitData.owner_name}
        onChangeText={(text) =>
          setCurrentUnitData({ ...currentUnitData, owner_name: text })
        }
        className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
      />

      <Text className="font-semibold mb-2">Mobile Number</Text>
      <TextInput
        placeholder="Enter mobile number"
        value={currentUnitData.mobile_number}
        onChangeText={(text) =>
          setCurrentUnitData({
            ...currentUnitData,
            mobile_number: sanitizeFieldValue("mobile_number", text),
          })
        }
        keyboardType="number-pad"
        maxLength={10}
        className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
      />

      <Text className="font-semibold mb-2">Number of Toilets</Text>
      <TextInput
        placeholder="Enter number of toilets"
        value={currentUnitData.toilet_count}
        onChangeText={(text) =>
          setCurrentUnitData({ ...currentUnitData, toilet_count: text })
        }
        keyboardType="numeric"
        className="bg-white border border-gray-300 p-3 rounded-lg mb-3"
      />

      <Text className="font-semibold mb-2">Occupancy Status</Text>
      <View className="flex-row flex-wrap mb-4">
        {[
          { value: "Self", label: "Self", icon: "home" },
          { value: "Rented", label: "Rented", icon: "business" },
          { value: "Vacant", label: "Vacant", icon: "hourglass-empty" },
          { value: "SelfRented", label: "Self + Rented", icon: "swap-horiz" },
        ].map((status) => (
          <TouchableOpacity
            key={status.value}
            onPress={() =>
              setCurrentUnitData({
                ...currentUnitData,
                occupancy_status: status.value,
              })
            }
            className={`w-[48%] p-3 border rounded-xl mr-[2%] mb-2 ${
              currentUnitData.occupancy_status === status.value
                ? "bg-blue-50 border-blue-600"
                : "border-gray-300 bg-white"
            }`}
          >
            <View className="flex-row items-center">
              <MaterialIcons
                name={status.icon}
                size={16}
                color={
                  currentUnitData.occupancy_status === status.value
                    ? "#1d4ed8"
                    : "#6b7280"
                }
              />
              <Text
                className={`text-xs ml-2 ${
                  currentUnitData.occupancy_status === status.value
                    ? "text-blue-700 font-semibold"
                    : "text-gray-700"
                }`}
              >
                {status.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="font-semibold mb-2">Parking Type</Text>
      <View className="flex-row mb-4">
        {["NONE", "OPEN", "COVERED"].map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() =>
              setCurrentUnitData({ ...currentUnitData, parking_type: type })
            }
            className={`flex-1 p-3 border rounded-lg mx-1 ${
              currentUnitData.parking_type === type
                ? "bg-blue-600 border-blue-600"
                : "border-gray-300"
            }`}
          >
            <Text
              className={`text-center ${currentUnitData.parking_type === type ? "text-white" : "text-gray-700"}`}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="flex-row justify-between mt-4">
        <TouchableOpacity
          onPress={() => setCurrentStep(4)}
          className="bg-gray-500 p-4 rounded-lg flex-1 mr-2"
        >
          <Text className="text-white font-semibold text-center">Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAddUnit}
          disabled={addingUnit}
          className={`p-4 rounded-lg flex-1 ml-2 ${addingUnit ? "bg-gray-300" : "bg-blue-600"}`}
        >
          {addingUnit ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-center">
              Add Unit & Continue
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderStep6 = () => (
    <ScrollView className="flex-1 p-4">
      {(() => {
        const billProofUris = getUnitBillProofUris();
        const displayPhotos = photos.filter(
          (photo) => !billProofUris.includes(photo.uri),
        );
        return (
          <>
            <Text className="text-2xl font-bold mb-4">Upload Photos</Text>
            <Text className="text-gray-600 mb-4">
              Add photos of the property (minimum 1 required)
            </Text>

            <View className="flex-row mb-4">
              <TouchableOpacity
                onPress={pickImages}
                className="bg-blue-600 p-4 rounded-lg flex-1 mr-2 flex-row items-center justify-center"
              >
                <MaterialIcons name="photo-library" size={24} color="white" />
                <Text className="text-white font-semibold ml-2">Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={capturePhoto}
                className="bg-green-600 p-4 rounded-lg flex-1 ml-2 flex-row items-center justify-center"
              >
                <MaterialIcons name="camera-alt" size={24} color="white" />
                <Text className="text-white font-semibold ml-2">Camera</Text>
              </TouchableOpacity>
            </View>

            {displayPhotos.length > 0 && (
              <View className="mb-4">
                <Text className="font-semibold mb-2">
                  {displayPhotos.length} photo(s) selected
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {displayPhotos.map((photo, index) => (
                    <View key={index} className="mr-2">
                      <Image
                        source={{ uri: photo.uri }}
                        className="w-24 h-24 rounded-lg"
                      />
                      <TouchableOpacity
                        key={index}
                        onPress={() =>
                          setPhotos((prev) =>
                            prev.filter((p) => p.uri !== photo.uri),
                          )
                        }
                        className="absolute top-0 right-0 bg-red-500 w-6 h-6 rounded-full items-center justify-center"
                      >
                        <MaterialIcons name="close" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                    // remove photo
                  ))}
                </ScrollView>
              </View>
            )}

            <View className="flex-row justify-between mt-4">
              <TouchableOpacity
                onPress={() =>
                  setCurrentStep(
                    isVacantFlow
                      ? 2
                      : isResidentialSingle ||
                          isResidentialMultiStoreyFlow ||
                          isNonResidentialSimpleFlow ||
                          isCommercialComplexFlow ||
                          isMixedFlow ||
                          floors.length > 0
                        ? 4
                        : 3,
                  )
                }
                className="bg-gray-500 p-4 rounded-lg flex-1 mr-2"
              >
                <Text className="text-white font-semibold text-center">
                  Back
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleUploadPhotos}
                disabled={
                  uploadingPhotos ||
                  uploadingPhotosBackend ||
                  displayPhotos.length === 0
                }
                className={`p-4 rounded-lg flex-1 ml-2 ${
                  uploadingPhotos ||
                  uploadingPhotosBackend ||
                  displayPhotos.length === 0
                    ? "bg-gray-300"
                    : "bg-blue-600"
                }`}
              >
                {uploadingPhotos || uploadingPhotosBackend ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-center">
                    Upload & Continue
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        );
      })()}
    </ScrollView>
  );

  const renderStep4Fallback = () => (
    <View className="flex-1 justify-center items-center p-4">
      <Text className="text-xl font-semibold mb-3">
        Unable to render Step 4
      </Text>
      <Text className="text-center text-gray-600 mb-4">
        Step 4 state is incomplete or stale. Please go back to Step 3 and
        continue.
      </Text>
      <TouchableOpacity
        onPress={() => setCurrentStep(3)}
        className="bg-blue-600 px-4 py-3 rounded-lg"
      >
        <Text className="text-white font-semibold">Back to Step 3</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep4 = () => {
    if (isResidentialSingle || isNonResidentialSimpleFlow) {
      return mergedFloorUnits.length > 0
        ? renderStep4Merged()
        : renderStep4Fallback();
    }

    if (
      isResidentialMultiStoreyFlow ||
      isCommercialComplexFlow ||
      isMixedFlow
    ) {
      return multiStoreyFloorUnits.length > 0
        ? renderStep4MultiStorey()
        : renderStep4Fallback();
    }

    return renderStep4Fallback();
  };

  const renderStep7 = () => (
    <View className="flex-1 justify-center items-center p-4">
      {propertyCode ? (
        <View className="bg-blue-50 border border-blue-200 p-4 rounded-lg w-full mb-6 items-center">
          <Text className="text-xs font-semibold text-blue-700 mb-1">
            PROPERTY ID
          </Text>
          <Text className="text-xl font-extrabold text-blue-900 tracking-wider">
            {propertyCode}
          </Text>
        </View>
      ) : null}

      <MaterialIcons name="check-circle" size={80} color="#10b981" />
      <Text className="text-2xl font-bold mt-4 mb-2">Survey Complete!</Text>
      <Text className="text-gray-600 text-center mb-6">
        Review and submit your survey
      </Text>

      <View className="bg-gray-100 p-4 rounded-lg w-full mb-6">
        <Text className="font-semibold mb-2">Summary:</Text>
        <Text>✓ Polygon selected</Text>
        <Text>✓ Property details added</Text>
        <Text>✓ Building information saved</Text>
        <Text>✓ {floors.length} floor(s) added</Text>
        <Text>✓ {units.length} unit(s) added</Text>
        <Text>✓ {photos.length} photo(s) uploaded</Text>
      </View>

      <TouchableOpacity
        onPress={handleSubmitSurvey}
        disabled={submitting}
        className={`p-4 rounded-lg w-full ${submitting ? "bg-gray-300" : "bg-green-600"}`}
      >
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-semibold text-center text-lg">
            Submit Survey
          </Text>
        )}
      </TouchableOpacity>

      {/* Step back to whatever actually precedes Submit in this flow. */}
      <TouchableOpacity
        onPress={() => setCurrentStep(photosStepEnabled ? 6 : 4)}
        className="mt-4"
      >
        <Text className="text-blue-600">
          {photosStepEnabled ? "Back to Photos" : "Back to Floors"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ProtectedRoute allowedRoles={["SURVEYOR"]}>
      <View className="flex-1 bg-survey-dark">
        <StatusBar style="light" hidden={currentStep === 6} />

        {/* Header */}
        <View
          className="bg-survey-dark rounded-b-3xl shadow-lg"
          style={{ paddingTop: 60, paddingBottom: 30, paddingHorizontal: 20 }}
        >
          <View className="flex-row justify-between items-center">
            <TouchableOpacity onPress={() => router.back()} className="p-2">
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text
              className="text-3xl font-extrabold text-white flex-1 text-center"
              style={{ letterSpacing: 0.5 }}
            >
              Create Survey
            </Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        {/* Step Indicator */}
        <View className="bg-white">{renderStepIndicator()}</View>

        <View className="flex-1 bg-survey-light">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
          {currentStep === 6 && renderStep6()}
          {currentStep === 7 && renderStep7()}
        </View>
      </View>
      <Toast />
    </ProtectedRoute>
  );
}
