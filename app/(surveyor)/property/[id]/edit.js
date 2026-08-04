import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Toast from "react-native-toast-message";
import ProtectedRoute from "../../../../components/ProtectedRoute";
import SurveyEditSkeleton from "../../../../components/skeleton/SurveyEditSkeleton";
import { ENV } from "../../../../config";
import {
  useAddUnitMutation,
  useAddUnitOwnerMutation,
  useAddUnitPhotosMutation,
  useCreatePropertyPhotoMutation,
  useDeleteSurveyImageMutation,
  useDeleteUnitMutation,
  useDeleteUnitPhotoMutation,
  useGetPropertyPhotosQuery,
  useGetSurveyQuery,
  useGetUnitPhotosQuery,
  useUpdateBuildingMutation,
  useUpdateFloorMutation,
  useUpdateFloorOccupancyMutation,
  useUpdatePropertyMutation,
  useUpdatePropertyOwnerMutation,
  useUpdatePropertyRoadMutation,
  useUpdateSurveyMutation,
  useUpdateUnitMutation,
  useUpdateUnitOwnerMutation,
  useUpsertFloorUtilitiesMutation,
  useUpsertPropertyUtilitiesMutation,
  useUpsertUnitUtilitiesMutation,
} from "../../../../services/surveyApi";

export default function EditSurvey() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [deletedImageIds, setDeletedImageIds] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [removedNewImageIndices, setRemovedNewImageIndices] = useState(
    new Set(),
  );
  const [uploading, setUploading] = useState(false);
  const [coordinates, setCoordinates] = useState(null);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [isImageViewerVisible, setIsImageViewerVisible] = React.useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const [units, setUnits] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAddingUnits, setIsAddingUnits] = useState(false);
  const onRequestClose = () => setIsImageViewerVisible(false);

  // Fetch survey data
  const {
    data: surveyDetail,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetSurveyQuery(id, {
    skip: !id,
  });

  // Update mutation
  const [updateSurvey, { isLoading: isUpdating }] = useUpdateSurveyMutation();
  const [updateUnit, { isLoading: isUpdatingUnit }] = useUpdateUnitMutation();
  const [updateUnitOwner, { isLoading: isUpdatingUnitOwner }] =
    useUpdateUnitOwnerMutation();
  const [upsertUnitUtilities, { isLoading: isUpsertingUnitUtilities }] =
    useUpsertUnitUtilitiesMutation();
  const [createUnitPhotos, { isLoading: isCreatingUnitPhotos }] =
    useAddUnitPhotosMutation();
  const [deleteUnitPhoto, { isLoading: isDeletingUnitPhoto }] =
    useDeleteUnitPhotoMutation();
  const [deleteSurveyImage, { isLoading: isDeletingImage }] =
    useDeleteSurveyImageMutation();
  const [deleteUnit, { isLoading: isDeletingUnit }] = useDeleteUnitMutation();
  const [updateProperty, { isLoading: isUpdatingProperty }] =
    useUpdatePropertyMutation();
  const [upsertPropertyUtilities, { isLoading: isUpsertingUtilities }] =
    useUpsertPropertyUtilitiesMutation();
  const [updatePropertyRoad, { isLoading: isUpdatingPropertyRoad }] =
    useUpdatePropertyRoadMutation();
  const [updateBuilding, { isLoading: isUpdatingBuilding }] =
    useUpdateBuildingMutation();
  const [updatePropertyOwner, { isLoading: isUpdatingPropertyOwner }] =
    useUpdatePropertyOwnerMutation();
  const [updateFloor, { isLoading: isUpdatingFloor }] =
    useUpdateFloorMutation();
  const [updateFloorOccupancy, { isLoading: isUpdatingFloorOccupancy }] =
    useUpdateFloorOccupancyMutation();
  const [upsertFloorUtilities, { isLoading: isUpsertingFloorUtilities }] =
    useUpsertFloorUtilitiesMutation();
  const [createPropertyPhoto, { isLoading: isCreatingPropertyPhoto }] =
    useCreatePropertyPhotoMutation();
  const [addUnit, { isLoading: isAddingUnit }] = useAddUnitMutation();
  const [addUnitOwner, { isLoading: isAddingUnitOwner }] =
    useAddUnitOwnerMutation();

  const survey = surveyDetail;
  const property = surveyDetail?.Property || {};
  const propertyId = property?.id;
  const building = property?.Building || {};
  const buildingType = building?.building_type;
  const { data: propertyPhotos = [], refetch: refetchPropertyPhotos } =
    useGetPropertyPhotosQuery(propertyId, {
      skip: !propertyId,
    });
  const { data: unitPhotos = [] } = useGetUnitPhotosQuery(id, {
    skip: !id,
  });

  // const floorss = Array.isArray(surveyDetail?.Property?.Building?.Floors)
  //   ? surveyDetail.Property.Building.Floors
  //   : [];

  // const unitsData = floorss.flatMap((floor) => floorss?.Units || []);
  // console.log("Unit Data:", unitsData);

  // Extract details based on survey type
  //const property = surveyDetail?.Property || {};
  const building_type = String(property.property_type || "Unknown");
  //console.log("Building Type:", building_type);
  const building_subtype = String(property.property_subtype || "Unknown");
  //console.log("Building Subtype:", building_subtype);
  const isResidential = building_type.toLowerCase() === "residential";
  const isSingleStory =
    isResidential && building_subtype.toLowerCase().includes("single");
  const isMultiStory =
    isResidential && building_subtype.toLowerCase().includes("multi");
  const showResidentialRoadDetails = isSingleStory || isMultiStory;

  const status = surveyDetail?.status || "unknown";

  // Additional data processing for floors and units
  const compareFloorNumbers = (a, b) => {
    if (a < 0 && b < 0) return b - a;
    if (a < 0) return -1;
    if (b < 0) return 1;
    return a - b;
  };

  const floors = useMemo(
    () =>
      Array.isArray(building?.Floors)
        ? [...building.Floors].sort((a, b) =>
            compareFloorNumbers(
              Number(a.floor_number || 0),
              Number(b.floor_number || 0),
            ),
          )
        : [],
    [building?.Floors],
  );

  const floorUtilities = useMemo(
    () =>
      floors.flatMap((floor) =>
        (floor?.FloorUtilities || []).map((utility) => ({
          ...utility,
          floor_number: utility?.floor_number ?? floor?.floor_number,
        })),
      ),
    [floors],
  );

  const floorUnitsFromFloors = useMemo(
    () =>
      floors.flatMap((floor) =>
        (floor?.Units || []).map((unit) => ({
          ...unit,
          floor_number: unit?.floor_number ?? floor?.floor_number,
        })),
      ),
    [floors],
  );

  const propertyUnits = useMemo(
    () =>
      Array.isArray(building?.PropertyUnits) ? building.PropertyUnits : [],
    [building?.PropertyUnits],
  );

  // Initialize units state
  // useEffect(() => {
  //   if (surveyDetail) {
  //     const computedUnits = [
  //       ...new Map(
  //         [...propertyUnits, ...floorUnitsFromFloors].map((unit) => {
  //           const key = unit?.id
  //             ? String(unit.id)
  //             : `${unit?.floor_number ?? ""}_${unit?.unit_number ?? ""}_${unit?.unit_address ?? ""}`;
  //           return [key, unit];
  //         }),
  //       ).values(),
  //     ];
  //     setUnits(computedUnits);
  //   }
  // }, [surveyDetail, propertyUnits, floorUnitsFromFloors]);
  useEffect(() => {
    if (surveyDetail && !isInitialized) {
      const computedUnits = [
        ...new Map(
          [...propertyUnits, ...floorUnitsFromFloors].map((unit) => {
            const key = unit?.id
              ? String(unit.id)
              : `${unit?.floor_number ?? ""}_${unit?.unit_number ?? ""}_${unit?.unit_address ?? ""}`;
            return [key, unit];
          }),
        ).values(),
      ];

      setUnits(computedUnits);
      setIsInitialized(true); // ✅ only run once
    }
  }, [surveyDetail, propertyUnits, floorUnitsFromFloors, isInitialized]);

  const groupedUnitsByFloor = useMemo(() => {
    return units.reduce((acc, unit) => {
      const floorNumber = Number(
        unit?.floor_number ?? unit?.Floor?.floor_number ?? 0,
      );
      const key = Number.isNaN(floorNumber) ? 0 : floorNumber;
      acc[key] = acc[key] || [];
      acc[key].push(unit);
      return acc;
    }, {});
  }, [units]);
  const getBuildingFloorNumbers = () => {
    const aboveGroundCount = Number(building?.floors_above_ground ?? 0);
    const belowGroundCount = Number(building?.floors_below_ground ?? 0);
    const numbers = [];

    for (let i = -belowGroundCount; i < 0; i += 1) {
      numbers.push(i);
    }
    for (let i = 0; i < aboveGroundCount; i += 1) {
      numbers.push(i);
    }
    return numbers;
  };

  const allFloorNumbers = Array.from(
    new Set([
      ...floors.map((floor) => Number(floor.floor_number ?? 0)),
      ...Object.keys(groupedUnitsByFloor).map((value) => Number(value)),
      ...getBuildingFloorNumbers(),
    ]),
  )
    .filter((num) => !Number.isNaN(num))
    .sort(compareFloorNumbers);

  const getFloorUtility = (floorNumber, floorRecord) => {
    const floorUtils = floorUtilities.filter(
      (util) => Number(util.floor_number ?? 0) === Number(floorNumber),
    );
    if (floorUtils.length > 0) return floorUtils[0];

    // Fallback to floor record utilities
    if (floorRecord?.FloorUtilities?.length > 0) {
      return floorRecord.FloorUtilities[0];
    }
    return {};
  };

  const isFloorMarkedSaved = (
    floorRecord,
    floorState = {},
    floorUtility = {},
  ) => {
    if (!floorRecord?.id) return false;

    const effectiveFloorUse = String(
      floorState.floor_use || floorRecord.floor_use || "",
    ).trim();

    if (effectiveFloorUse === "Parking") {
      const effectiveParkingType = String(
        floorState.parking_type ||
          floorUtility.parking_type ||
          floorRecord?.parking_type ||
          "",
      ).trim();
      const effectiveParkingArea = String(
        floorState.parking_area ??
          floorUtility.parking_area ??
          floorRecord?.parking_area ??
          "",
      ).trim();

      return Boolean(effectiveParkingType && effectiveParkingArea);
    }

    return true;
  };

  // Form state - Survey Metadata
  const [surveyMetadata, setSurveyMetadata] = useState({
    occupancy_status: "",
    owner_name: "",
    mobile_number: "",
    water_connection: false,
    sewer_connection: false,
    electricity_connection: false,
    road_width: "",
    address: "",
    plot_area: "",
    floors_above_ground: "",
    floors_below_ground: "",
    total_builtup_area: "",
    aadhar_number: "",
    occupation: "",
    father_husband_name: "",
    is_disabled_person: null,
  });

  const [editableUnits, setEditableUnits] = useState({});
  const [unitUpdatingIds, setUnitUpdatingIds] = useState({});
  const [unitDeletingIds, setUnitDeletingIds] = useState({});
  const [floorUpdatingIds, setFloorUpdatingIds] = useState({});
  const [floorSavedIds, setFloorSavedIds] = useState({});
  const [isAddUnitModalVisible, setIsAddUnitModalVisible] = useState(false);
  const [newUnitData, setNewUnitData] = useState({
    unit_number: "",
    unit_address: "",
    carpet_area: "",
    construction_year: "",
    occupancy_status: "Self",
    area: "",
    self_area: "",
    rented_area: "",
    owner_name: "",
    mobile: "",
    owner_adhar: "",
    owner_occupation: "",
    disabled_person: "NO",
    father_or_husband_name: "",
    occupant_name: "",
    occupant_mobile: "",
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
    electricity_connection: false,
    water_connection: false,
    sewer_connection: false,
    gas_connection: false,
    internet_connection: false,
    photos: [],
  });
  const [currentFloorForNewUnit, setCurrentFloorForNewUnit] = useState(null);

  const roadSideOptions = [
    { side: "front", title: "Front Side Road" },
    { side: "back", title: "Back Side Road" },
    { side: "left", title: "Left Side Road" },
    { side: "right", title: "Right Side Road" },
  ];

  const [roadSidesState, setRoadSidesState] = useState({
    front: false,
    back: false,
    left: false,
    right: false,
  });

  const [roadDetails, setRoadDetails] = useState({
    road_type_front: "",
    road_type_back: "",
    road_type_left: "",
    road_type_right: "",
    road_width_front: "",
    road_width_back: "",
    road_width_left: "",
    road_width_right: "",
    carriageway_area_front: "",
    carriageway_area_back: "",
    carriageway_area_left: "",
    carriageway_area_right: "",
    footpath_area_front: "",
    footpath_area_back: "",
    footpath_area_left: "",
    footpath_area_right: "",
  });

  // Residential details state
  const [residential, setResidential] = useState({
    family_count: "",
    has_kitchen: false,
    has_toilet: false,
    parking_type: "",
    construction_type: "",
  });

  // Non-residential details state
  const [nonResidential, setNonResidential] = useState({
    business_name: "",
    ownership_type: "",
    operational_status: "",
    employee_count: "",
  });

  // Floor details state for editing
  const [floorDetails, setFloorDetails] = useState({});

  const [errors, setErrors] = useState({});
  const getImageUrl = (image) =>
    image?.image_url ||
    image?.url ||
    image?.photo_url ||
    image?.imagePath ||
    image?.path ||
    null;
  const serverImages = Array.isArray(propertyPhotos) ? propertyPhotos : [];
  const ViewerImages = serverImages;
  const hasViewerImages = ViewerImages.length > 0;
  const activeViewerImage = hasViewerImages
    ? ViewerImages[Math.min(imageViewerIndex, ViewerImages.length - 1)]
    : null;

  useEffect(() => {
    if (ENV === "DEV") {
      setCoordinates({
        lat: "26.8280972",
        lng: "80.9446796",
      });
    }
  }, []);

  // Initialize form with survey data
  useEffect(() => {
    if (survey) {
      const property = survey?.Property || surveyDetail?.Property || {};
      const owner =
        property?.PropertyOwners?.[0] || property?.PropertyOwner || {};
      setSurveyMetadata({
        occupancy_status:
          survey.occupancy_status || property.construction_type || "",
        owner_name: survey.owner_name || owner.owner_name || owner.name || "",
        mobile_number:
          survey.mobile_number || owner.mobile_number || owner.mobile || "",
        water_connection: survey.water_connection || false,
        sewer_connection: survey.sewer_connection || false,
        electricity_connection: survey.electricity_connection || false,
        road_width: survey.road_width || "",
        address:
          survey.address || property.address_line1 || property.address || "",
        plot_area: String(property.plot_area_sqmt || property.plot_area || ""),
        aadhar_number:
          survey.aadhar_number || owner.aadhar_number || owner.aadhar || "",
        occupation:
          survey.occupation || owner.occupation || owner.owner_occupation || "",
        father_husband_name:
          survey.father_husband_name ||
          owner.father_or_husband_name ||
          owner.father_husband_name ||
          "",
        is_disabled_person: normalizeYesNoValue(
          survey.is_disabled_person ??
            owner.is_disabled_person ??
            property.is_disabled_person,
        ),
        floors_above_ground: String(
          property?.Building?.floors_above_ground ?? "",
        ),
        floors_below_ground: String(
          property?.Building?.floors_below_ground ?? "",
        ),
        total_builtup_area: String(
          property?.Building?.total_builtup_area ?? "",
        ),
      });

      const propertyRoads = Array.isArray(property?.PropertyRoads)
        ? property.PropertyRoads
        : [];
      // const propertyRoads = Array.isArray(property?.PropertyRoads)
      //   ? property.PropertyRoads
      //   : [];
      const propertyRoadsBySection = propertyRoads.reduce((acc, road) => {
        const section = String(
          road?.section ||
            road?.road_section ||
            road?.side ||
            road?.road_side ||
            "",
        )
          .toLowerCase()
          .trim();
        if (section) acc[section] = road;
        return acc;
      }, {});

      const nextRoadDetails = { ...roadDetails };
      const nextRoadSides = {
        front: false,
        back: false,
        left: false,
        right: false,
      };

      ["front", "back", "left", "right"].forEach((side) => {
        const roadItem = propertyRoadsBySection[side];
        const sideType =
          property[`road_type_${side}`] ||
          roadItem?.road_type ||
          roadItem?.type ||
          "";
        const sideWidth =
          property[`road_width_${side}`] ||
          roadItem?.road_width ||
          roadItem?.width ||
          "";
        const carriagewayArea =
          property[`carriageway_area_${side}`] ||
          roadItem?.carriageway_area ||
          roadItem?.carriagewayArea ||
          "";
        const footpathArea =
          property[`footpath_area_${side}`] ||
          roadItem?.footpath_area ||
          roadItem?.footpathArea ||
          "";

        nextRoadDetails[`road_type_${side}`] = sideType;
        nextRoadDetails[`road_width_${side}`] = sideWidth;
        nextRoadDetails[`carriageway_area_${side}`] = String(carriagewayArea);
        nextRoadDetails[`footpath_area_${side}`] = String(footpathArea);

        if (sideType || sideWidth || carriagewayArea || footpathArea) {
          nextRoadSides[side] = true;
        }
      });

      setRoadDetails(nextRoadDetails);
      setRoadSidesState(nextRoadSides);

      // Initialize floor details
      const initialFloorDetails = {};
      const initialFloorSavedIds = {};
      allFloorNumbers.forEach((floorNumber) => {
        const floor =
          floors.find(
            (item) => Number(item.floor_number ?? 0) === floorNumber,
          ) || {};
        const floorUnits = groupedUnitsByFloor[floorNumber] || [];
        const floorUtility = getFloorUtility(floorNumber, floor);

        initialFloorDetails[floorNumber] = {
          construction_year: String(
            floor.construction_year ||
              getUnitValue(floorUnits?.[0], "construction_year") ||
              "",
          ),
          carpet_area: String(
            floor.carpet_area ||
              getUnitValue(floorUnits?.[0], "carpet_area") ||
              "",
          ),
          floor_use: String(
            floor.floor_use ||
              floor.ground_floor_use ||
              floor.ground_floor_mode ||
              getUnitValue(floorUnits?.[0], "ground_floor_use") ||
              getUnitValue(floorUnits?.[0], "ground_floor_mode") ||
              "",
          ),
          occupancy_status: String(
            floor.FloorOccupancy?.occupancy_status ||
              getUnitValue(floorUnits?.[0], "occupancy_status") ||
              "",
          ),
          occupant_name: String(
            getUnitValue(floor.FloorOccupancy, "occupant_name") || "",
          ),
          occupant_mobile: String(
            getUnitValue(floor.FloorOccupancy, "occupant_mobile") || "",
          ),
          rent_amount: String(
            getUnitValue(floor.FloorOccupancy, "rent_amount") || "",
          ),
          has_kitchen: normalizeBooleanFlag(
            floorUtility?.has_kitchen ?? floor?.has_kitchen,
          ),
          kitchen_count: String(
            floorUtility?.kitchen_count ?? floor?.kitchen_count ?? "",
          ),
          kitchen_area: String(
            floorUtility?.kitchen_area ?? floor?.kitchen_area ?? "",
          ),
          has_toilet: normalizeBooleanFlag(
            floorUtility?.has_toilet ?? floor?.has_toilet,
          ),
          toilet_count: String(
            floorUtility?.toilet_count ?? floor?.toilet_count ?? "",
          ),
          toilet_area: String(
            floorUtility?.toilet_area ?? floor?.toilet_area ?? "",
          ),
          has_parking: normalizeBooleanFlag(
            floorUtility?.has_parking ?? floor?.has_parking,
          ),
          parking_type: String(
            floorUtility?.parking_type || floor?.parking_type || "",
          ),
          parking_area: String(
            floorUtility?.parking_area ?? floor?.parking_area ?? "",
          ),
        };
        initialFloorSavedIds[floorNumber] = isFloorMarkedSaved(
          floor,
          initialFloorDetails[floorNumber],
          floorUtility,
        );
      });
      setFloorDetails(initialFloorDetails);
      setFloorSavedIds(initialFloorSavedIds);

      const initialEditableUnits = {};
      units.forEach((unit) => {
        const unitKey = unit?.id
          ? String(unit.id)
          : `${unit?.floor_number ?? ""}_${unit?.unit_number ?? ""}_${unit?.unit_address ?? ""}`;

        initialEditableUnits[unitKey] = {
          id: unit.id ?? null,
          floor_number: unit?.floor_number ?? unit?.Floor?.floor_number ?? null,
          savedPhotos: Array.isArray(unit.UnitPhotos)
            ? unit.UnitPhotos
            : Array.isArray(unit.photos)
              ? unit.photos
              : [],
          unit_number:
            String(
              getUnitValue(unit, "unit_number") || unit.unit_number || "",
            ) || "",
          unit_address:
            String(
              getUnitValue(unit, "unit_address") || unit.unit_address || "",
            ) || "",
          carpet_area: String(
            getUnitValue(unit, "carpet_area") ||
              getUnitValue(unit, "unit_area_sqmt") ||
              "",
          ),
          area: String(
            getUnitValue(unit, "area") ||
              unit.area ||
              getUnitValue(unit, "unit_area_sqmt") ||
              "",
          ),
          occupancy_status:
            String(
              getUnitValue(unit, "occupancy_status") ||
                unit.occupancy_status ||
                "Self",
            ) || "Self",
          disabled_person:
            normalizeYesNoValue(
              getUnitOwnerValueFromFields(unit, [
                "disabled_person",
                "is_disabled_person",
              ]) ??
                getUnitValue(unit, "disabled_person") ??
                getUnitValue(unit, "is_disabled_person") ??
                unit.disabled_person ??
                unit.is_disabled_person,
            ) ?? "NO",
          water_connection:
            getUnitUtilityValue(unit, "water_connection") ?? false,
          electricity_connection:
            getUnitUtilityValue(unit, "electric_connection") ?? false,
          sewer_connection:
            getUnitUtilityValue(unit, "sewer_connection") ?? false,
          gas_connection: getUnitUtilityValue(unit, "gas_connection") ?? false,
          internet_connection:
            getUnitUtilityValue(unit, "internet_connection") ?? false,
          has_kitchen: normalizeBooleanFlag(
            getUnitUtilityValue(unit, "has_kitchen"),
          ),
          kitchen_count: String(
            getUnitUtilityValue(unit, "kitchen_count") || "",
          ),
          kitchen_area: String(getUnitUtilityValue(unit, "kitchen_area") || ""),
          has_toilet: normalizeBooleanFlag(
            getUnitUtilityValue(unit, "has_toilet"),
          ),
          toilet_count: String(getUnitUtilityValue(unit, "toilet_count") || ""),
          toilet_area: String(getUnitUtilityValue(unit, "toilet_area") || ""),
          has_parking: normalizeBooleanFlag(
            getUnitUtilityValue(unit, "has_parking"),
          ),
          parking_type: String(getUnitUtilityValue(unit, "parking_type") || ""),
          parking_area: String(getUnitUtilityValue(unit, "parking_area") || ""),
          owner_name: String(
            getUnitOwnerValue(unit, "owner_name") ||
              getUnitValue(unit, "owner_name") ||
              unit.owner_name ||
              "",
          ),
          owner_mobile: String(
            getUnitOwnerValue(unit, "mobile") ||
              getUnitOwnerValue(unit, "mobile_number") ||
              getUnitValue(unit, "mobile_number") ||
              getUnitValue(unit, "mobile") ||
              unit.owner_mobile ||
              unit.mobile_number ||
              "",
          ),
          owner_occupation: String(
            getUnitOwnerValue(unit, "occupation") ||
              unit.owner_occupation ||
              "",
          ),
          father_or_husband_name: String(
            getUnitOwnerValue(unit, "father_or_husband_name") ||
              getUnitValue(unit, "father_or_husband_name") ||
              unit.father_or_husband_name ||
              "",
          ),
          aadhar_number: String(
            getUnitOwnerValue(unit, "aadhar") ||
              getUnitOwnerValue(unit, "aadhar_number") ||
              getUnitValue(unit, "aadhar_number") ||
              unit.aadhar_number ||
              "",
          ),
          occupier_name: String(
            getUnitValue(unit, "occupant_name") ||
              getUnitValue(unit, "occupier_name") ||
              getUnitValue(unit, "tenant_name") ||
              "",
          ),
          occupier_mobile: String(
            getUnitValue(unit, "occupant_mobile") ||
              getUnitValue(unit, "occupier_mobile") ||
              getUnitValue(unit, "tenant_mobile") ||
              "",
          ),
          rent_amount: String(
            getUnitValue(unit, "rent_amount") || unit.rent_amount || "",
          ),
          construction_year:
            String(
              getUnitValue(unit, "construction_year") ||
                unit.construction_year ||
                "",
            ) || "",
        };
      });
      setEditableUnits(initialEditableUnits);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units]);
  const getFloorLabel = (floorNumber) => {
    if (floorNumber === 0) return "Ground Floor";
    if (floorNumber > 0) {
      switch (floorNumber) {
        case 1:
          return "First Floor";
        case 2:
          return "Second Floor";
        case 3:
          return "Third Floor";
        case 4:
          return "Fourth Floor";
        default:
          return `Floor ${floorNumber}`;
      }
    }
    return `Basement ${floorNumber}`;
  };

  const renderValue = (value) =>
    value === 0
      ? "0"
      : value === false
        ? "No"
        : value || value === ""
          ? String(value)
          : "N/A";

  const getLatestRelatedRecord = (records = []) => {
    if (!Array.isArray(records) || records.length === 0) {
      return undefined;
    }

    return [...records].sort((a, b) => {
      const aTime = new Date(
        a?.updated_at || a?.updatedAt || a?.created_at || a?.createdAt || 0,
      ).getTime();
      const bTime = new Date(
        b?.updated_at || b?.updatedAt || b?.created_at || b?.createdAt || 0,
      ).getTime();

      if (aTime !== bTime) {
        return bTime - aTime;
      }

      return Number(b?.id || 0) - Number(a?.id || 0);
    })[0];
  };

  const getLatestUnitUtilityRecord = (unit) =>
    getLatestRelatedRecord(unit?.UnitUtilities) || unit?.UnitUtility;

  const getAttribute = (obj, path) => {
    const value = obj?.[path];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
    if (obj?.UnitDetails?.type_specific_attributes) {
      const nestedValue = obj.UnitDetails.type_specific_attributes[path];
      if (
        nestedValue !== undefined &&
        nestedValue !== null &&
        nestedValue !== ""
      ) {
        return nestedValue;
      }
    }
    const latestUnitUtility = getLatestUnitUtilityRecord(obj);
    if (latestUnitUtility?.[path] !== undefined) {
      return latestUnitUtility[path];
    }
    if (obj?.UnitUtility?.[path] !== undefined) {
      return obj.UnitUtility[path];
    }
    return undefined;
  };

  const getUnitValue = (unit, field) => {
    const candidates = [
      getAttribute(unit, field),
      getAttribute(unit, field.replace(/sqmt$/, "_sqmt")),
      getAttribute(unit, field.replace(/_sqmt$/, "")),
      unit?.[field],
      unit?.UnitDetails?.[field],
      getLatestUnitUtilityRecord(unit)?.[field],
      unit?.UnitUtility?.[field],
      unit?.[field.replace(/sqmt$/, "_sqmt")],
      unit?.[field.replace(/_sqmt$/, "")],
    ];
    return candidates.find((value) => value !== undefined && value !== null);
  };

  const getUnitOwnerRecord = (unit) => {
    if (Array.isArray(unit?.UnitOwners) && unit.UnitOwners.length > 0) {
      return getLatestRelatedRecord(unit.UnitOwners);
    }
    return unit?.UnitOwner || {};
  };

  const getUnitOwnerValue = (unit, field) => {
    const owner = getUnitOwnerRecord(unit);
    return (
      owner?.[field] ??
      unit?.[field] ??
      unit?.UnitDetails?.type_specific_attributes?.[field] ??
      unit?.UnitDetails?.[field]
    );
  };

  const getUnitOwnerValueFromFields = (unit, fields) => {
    for (const field of fields) {
      const value = getUnitOwnerValue(unit, field);
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
    return undefined;
  };

  const normalizeYesNoValue = (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    if (typeof value === "boolean") {
      return value ? "YES" : "NO";
    }

    if (typeof value === "number") {
      if (value === 1) return "YES";
      if (value === 0) return "NO";
    }

    const normalizedValue = String(value).trim().toLowerCase();

    if (["yes", "y", "true", "1"].includes(normalizedValue)) {
      return "YES";
    }

    if (["no", "n", "false", "0"].includes(normalizedValue)) {
      return "NO";
    }

    return String(value).trim();
  };

  const normalizeBooleanFlag = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;

    const normalizedValue = String(value ?? "")
      .trim()
      .toLowerCase();

    if (["true", "1", "yes", "y"].includes(normalizedValue)) {
      return true;
    }

    if (["false", "0", "no", "n", ""].includes(normalizedValue)) {
      return false;
    }

    return Boolean(value);
  };

  const toSafeInt = (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const parsed = parseInt(String(value).trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toSafeFloat = (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const parsed = parseFloat(String(value).trim());
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeOccupancyStatus = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();

    if (normalized === "selfrented" || normalized === "self_rented") {
      return "SelfRented";
    }
    if (normalized === "self") {
      return "Self";
    }
    if (normalized === "rented") {
      return "Rented";
    }
    if (normalized === "vacant") {
      return "Vacant";
    }

    return String(value || "").trim();
  };

  const isRentedLikeOccupancy = (value) => {
    const normalized = normalizeOccupancyStatus(value);
    return normalized === "Rented" || normalized === "SelfRented";
  };

  const getUnitUtilityValue = (unit, field) => {
    if (unit?.UnitUtilities?.[0]?.[field] !== undefined) {
      return unit.UnitUtilities[0][field];
    }
    if (unit?.UnitUtility?.[field] !== undefined) {
      return unit.UnitUtility[field];
    }
    return getAttribute(unit, field);
  };

  const getUnitKey = (unit) =>
    unit?.id
      ? String(unit.id)
      : `${unit?.floor_number ?? ""}_${unit?.unit_number ?? ""}_${unit?.unit_address ?? ""}`;

  const handleUnitDetailChange = (unitKey, field, value) => {
    setEditableUnits((prev) => ({
      ...prev,
      [unitKey]: {
        ...prev[unitKey],
        [field]:
          field === "disabled_person" ? normalizeYesNoValue(value) : value,
      },
    }));
  };

  const addUnitPhotos = (unitKey, assets) => {
    if (!unitKey || !Array.isArray(assets) || assets.length === 0) return;

    setEditableUnits((prev) => {
      const currentUnit = prev[unitKey] || {};
      const existingPhotos = Array.isArray(currentUnit.photos)
        ? currentUnit.photos
        : [];
      return {
        ...prev,
        [unitKey]: {
          ...currentUnit,
          photos: [...existingPhotos, ...assets],
        },
      };
    });
  };

  const addNewUnitPhotos = (assets) => {
    if (!Array.isArray(assets) || assets.length === 0) return;

    setNewUnitData((prev) => ({
      ...prev,
      photos: [...(Array.isArray(prev.photos) ? prev.photos : []), ...assets],
    }));
  };

  const handleRemoveSavedPhoto = async (unitKey, photo, savedIndex) => {
    try {
      if (photo.id) {
        setDeletingPhotoId(photo.id);

        await deleteUnitPhoto({ photoId: photo.id }).unwrap();

        Toast.show({
          type: "success",
          text1: "Photo Deleted",
        });
      }

      setEditableUnits((prev) => ({
        ...prev,
        [unitKey]: {
          ...prev[unitKey],
          savedPhotos: Array.isArray(prev[unitKey]?.savedPhotos)
            ? prev[unitKey].savedPhotos.filter((savedPhoto, index) =>
                photo.id ? savedPhoto.id !== photo.id : index !== savedIndex,
              )
            : [],
        },
      }));
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Delete Failed",
        text2: err?.data?.message || "Error deleting photo",
      });
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const capturePhoto = async (unitKey) => {
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

    if (result.canceled || !Array.isArray(result.assets)) return;

    if (unitKey) {
      addUnitPhotos(unitKey, result.assets);
      return;
    }

    addNewUnitPhotos(result.assets);
  };

  const pickImages = async (unitKey) => {
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

    if (result.canceled || !Array.isArray(result.assets)) return;

    if (unitKey) {
      addUnitPhotos(unitKey, result.assets);
      return;
    }

    addNewUnitPhotos(result.assets);
  };
  const handleUpdateUnit = async (unitKey, item) => {
    const unitState = editableUnits[unitKey];
    if (!unitState?.id) {
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: "This unit cannot be updated because it has no ID.",
      });
      if (unitPhotos.length === 0) {
        Toast.show({
          type: "info",
          text1: "No Photos",
          text2: "Please add at least one photo before updating.",
        });
        return;
      }
    }

    try {
      setUnitUpdatingIds((prev) => ({ ...prev, [unitKey]: true }));

      const floorNumber = Number(unitState.floor_number ?? 0);
      const floor = floors.find(
        (f) => Number(f.floor_number ?? 0) === floorNumber,
      );

      if (floor?.id) {
        const floorState = floorDetails[floorNumber] || {};

        // Update floor
        const floorData = {
          construction_year: toSafeInt(floorState.construction_year),
          carpet_area: toSafeFloat(floorState.carpet_area),
          floor_use: floorState.floor_use || null,
          number_of_units: groupedUnitsByFloor[floorNumber]?.length || 0,
        };
        await updateFloor({ floorId: floor.id, data: floorData }).unwrap();
      }

      // Update unit utilities from unit-level state, not floor-level
      const existingUnitUtility = getLatestUnitUtilityRecord(item);
      const utilitiesData = {
        id: existingUnitUtility?.id || undefined,
        utility_id: existingUnitUtility?.id || undefined,
        unit_id: unitState.id,
        has_kitchen: Boolean(unitState.has_kitchen),
        kitchen_count: toSafeInt(unitState.kitchen_count),
        kitchen_area: toSafeFloat(unitState.kitchen_area),
        has_toilet: Boolean(unitState.has_toilet),
        toilet_count: toSafeInt(unitState.toilet_count),
        toilet_area: toSafeFloat(unitState.toilet_area),
        has_parking: Boolean(unitState.has_parking),
        parking_type: unitState.parking_type || null,
        parking_area: toSafeFloat(unitState.parking_area),
        electric_connection: Boolean(unitState.electricity_connection ?? false),
        water_connection: Boolean(unitState.water_connection ?? false),
        sewer_connection: Boolean(unitState.sewer_connection ?? false),
        gas_connection: Boolean(unitState.gas_connection ?? false),
        internet_connection: Boolean(unitState.internet_connection ?? false),
      };
      await upsertUnitUtilities({
        unitId: unitState.id,
        data: utilitiesData,
      }).unwrap();
      const ownerRecord = getUnitOwnerRecord(item);
      const ownerId = ownerRecord?.id || ownerRecord?.owner_id;
      const unitowerData = {
        owner_name: unitState.owner_name || null,
        mobile: unitState.owner_mobile || null,
        occupation: unitState.owner_occupation || null,
        disabled_person: unitState.disabled_person,
        aadhar: unitState.aadhar_number || null,
        father_or_husband_name: unitState.father_or_husband_name || null,
      };
      if (ownerId) {
        await updateUnitOwner({
          ownerId,
          data: unitowerData,
        }).unwrap();
      }

      const data = {
        floor_number: unitState.floor_number ?? null,
        unit_number: unitState.unit_number || null,
        unit_address: unitState.unit_address || null,
        carpet_area: toSafeFloat(unitState.carpet_area),
        area: toSafeFloat(unitState.area),
        occupancy_status: normalizeOccupancyStatus(unitState.occupancy_status),
        occupant_name: isRentedLikeOccupancy(unitState.occupancy_status)
          ? unitState.occupier_name || null
          : null,
        occupant_mobile: isRentedLikeOccupancy(unitState.occupancy_status)
          ? unitState.occupier_mobile || null
          : null,
        rent_amount: isRentedLikeOccupancy(unitState.occupancy_status)
          ? toSafeFloat(unitState.rent_amount)
          : null,
      };
      await updateUnit({ unitId: unitState.id, data }).unwrap();

      // Upload only new photos (those with URI but no ID from database)
      const newPhotos = Array.isArray(unitState.photos)
        ? unitState.photos.filter((photo) => photo.uri && !photo.id)
        : [];

      if (newPhotos.length > 0) {
        const formData = new FormData();

        // 1. Images append
        newPhotos.forEach((photo, index) => {
          formData.append("images", {
            uri: photo.uri,
            type: "image/jpeg",
            name: `survey_${Date.now()}_${index}.jpg`,
          });
        });

        // 2. Metadata JSON append
        const metadata = newPhotos.map((photo) => ({
          caption: photo.caption || "Unit Photo",
          photo_type: "unit_photo",
        }));

        formData.append("metadata", JSON.stringify(metadata));

        await createUnitPhotos({ unitId: unitState.id, formData }).unwrap();
      }

      Toast.show({
        type: "success",
        text1: "Unit updated",
        text2: "Unit details were updated successfully.",
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: err?.data?.message || err?.message || "Could not update unit.",
      });
    } finally {
      setUnitUpdatingIds((prev) => ({ ...prev, [unitKey]: false }));
    }
  };

  const handleUpdateFloor = async (floorNumber) => {
    const floor = floors.find(
      (f) => Number(f.floor_number ?? 0) === floorNumber,
    );

    if (!floor?.id) {
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: "This floor cannot be updated because it has no ID.",
      });
      return;
    }

    const floorState = floorDetails[floorNumber] || {};

    try {
      setFloorUpdatingIds((prev) => ({ ...prev, [floorNumber]: true }));

      // Update floor
      const floorData = {
        construction_year: toSafeInt(floorState.construction_year),
        carpet_area: toSafeFloat(floorState.carpet_area),
        floor_use: floorState.floor_use || null,
        number_of_units:
          floorState.floor_use === "Parking"
            ? 0
            : groupedUnitsByFloor[floorNumber]?.length || 0,
        has_parking: floorState.floor_use === "Parking" ? true : undefined,
        parking_type:
          floorState.floor_use === "Parking"
            ? floorState.parking_type || null
            : undefined,
        parking_area:
          floorState.floor_use === "Parking"
            ? toSafeFloat(floorState.parking_area)
            : undefined,
      };
      await updateFloor({ floorId: floor.id, data: floorData }).unwrap();

      Toast.show({
        type: "success",
        text1: "Floor updated",
        text2: "Floor details updated successfully.",
      });
      // Refetch survey data to show updated floor details immediately

      setFloorSavedIds((prev) => ({
        ...prev,
        [floorNumber]: isFloorMarkedSaved(floor, floorState, floorState),
      }));
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: err?.data?.message || err?.message || "Could not update floor.",
      });
    } finally {
      setFloorUpdatingIds((prev) => ({ ...prev, [floorNumber]: false }));
    }
  };

  const handleDeleteUnit = (unitKey, item) => {
    if (!item?.id) {
      Toast.show({
        type: "error",
        text1: "Delete failed",
        text2: "This unit cannot be deleted because it has no ID.",
      });
      return;
    }

    Alert.alert(
      "Delete Unit",
      "This will permanently delete the unit from the survey.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setUnitDeletingIds((prev) => ({ ...prev, [unitKey]: true }));
              await deleteUnit({ unitId: item.id }).unwrap();

              Toast.show({
                type: "success",
                text1: "Unit deleted",
                text2: "Unit deleted successfully.",
              });

              // Update floor's number_of_units
              const floorNumber = Number(item.floor_number ?? 0);
              const floor = floors.find(
                (f) => Number(f.floor_number ?? 0) === floorNumber,
              );

              if (floor?.id) {
                const currentUnits = groupedUnitsByFloor[floorNumber] || [];
                const newNumberOfUnits = Math.max(0, currentUnits.length - 1);

                const floorData = {
                  construction_year: toSafeInt(
                    floorDetails[floorNumber]?.construction_year,
                  ),
                  carpet_area: toSafeFloat(
                    floorDetails[floorNumber]?.carpet_area,
                  ),
                  floor_use: floorDetails[floorNumber]?.floor_use || null,
                  number_of_units: newNumberOfUnits,
                };

                await updateFloor({
                  floorId: floor.id,
                  data: floorData,
                }).unwrap();
              }

              setEditableUnits((prev) => {
                const next = { ...prev };
                delete next[unitKey];
                return next;
              });
              // Update local units state to remove deleted unit immediately
              setUnits((prev) => prev.filter((u) => u.id !== item.id));
              Toast.show({
                type: "success",
                text1: "Unit deleted",
                text2: "The unit has been removed.",
              });
            } catch (err) {
              Toast.show({
                type: "error",
                text1: "Delete failed",
                text2:
                  err?.data?.message ||
                  err?.message ||
                  "Could not delete unit.",
              });
            } finally {
              setUnitDeletingIds((prev) => ({ ...prev, [unitKey]: false }));
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleAddNewUnit = async (floorNumber) => {
    if (isAddingUnits) return;
    // Validation
    if (!newUnitData.unit_number.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Unit Number is required.",
      });
      return;
    }
    if (!newUnitData.unit_address.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Unit Address is required.",
      });
      return;
    }
    if (!newUnitData.carpet_area || isNaN(newUnitData.carpet_area)) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Carpet Area is required and must be a number.",
      });
      return;
    }
    if (
      !newUnitData.construction_year ||
      isNaN(newUnitData.construction_year)
    ) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Construction Year is required and must be a number.",
      });
      return;
    }
    if (newUnitData.occupancy_status === "SelfRented") {
      if (!newUnitData.self_area || isNaN(newUnitData.self_area)) {
        Toast.show({
          type: "error",
          text1: "Validation Error",
          text2: "Self Area is required and must be a number.",
        });
        return;
      }
      if (!newUnitData.rented_area || isNaN(newUnitData.rented_area)) {
        Toast.show({
          type: "error",
          text1: "Validation Error",
          text2: "Rented Area is required and must be a number.",
        });
        return;
      }
    }
    if (!Array.isArray(newUnitData.photos) || newUnitData.photos.length === 0) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please add at least one unit photo.",
      });
      return;
    }

    try {
      setIsAddingUnits(true);
      const floor = floors.find(
        (f) => Number(f.floor_number ?? 0) === Number(floorNumber),
      );

      if (!floor?.id) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Floor not found.",
        });
        return;
      }

      // Create unit data
      const unitData = {
        floor_number: floorNumber,
        unit_number: newUnitData.unit_number,
        unit_address: newUnitData.unit_address,
        carpet_area: toSafeFloat(newUnitData.carpet_area),
        construction_year: toSafeInt(newUnitData.construction_year),
        occupancy_status: normalizeOccupancyStatus(
          newUnitData.occupancy_status,
        ),
        area: toSafeFloat(
          newUnitData.occupancy_status === "SelfRented"
            ? newUnitData.self_area
            : newUnitData.area,
        ),
        rented_area: toSafeFloat(
          newUnitData.occupancy_status === "SelfRented"
            ? newUnitData.rented_area
            : null,
        ),
        occupant_name: isRentedLikeOccupancy(newUnitData.occupancy_status)
          ? newUnitData.occupant_name || null
          : null,
        occupant_mobile: isRentedLikeOccupancy(newUnitData.occupancy_status)
          ? newUnitData.occupant_mobile || null
          : null,
        rent_amount: isRentedLikeOccupancy(newUnitData.occupancy_status)
          ? toSafeFloat(newUnitData.rent_amount)
          : null,
      };

      const unitResponse = await addUnit({
        floorId: floor.id,
        data: unitData,
      }).unwrap();
      const newUnitId = unitResponse?.data?.id || unitResponse?.id;

      if (!newUnitId) {
        throw new Error("Failed to get unit ID from response");
      }

      // Add unit owner
      const ownerData = {
        owner_name: newUnitData.owner_name || null,
        mobile: newUnitData.owner_mobile || null,
        occupation: newUnitData.owner_occupation || null,
        disabled_person: newUnitData.disabled_person === "YES",
        aadhar: newUnitData.owner_adhar || null,
        father_or_husband_name: newUnitData.father_or_husband_name || null,
      };

      await addUnitOwner({ unitId: newUnitId, data: ownerData }).unwrap();

      // Add unit utilities
      const utilitiesData = {
        has_kitchen: Boolean(newUnitData.has_kitchen),
        kitchen_count: toSafeInt(newUnitData.kitchen_count),
        kitchen_area: toSafeFloat(newUnitData.kitchen_area),
        has_toilet: Boolean(newUnitData.has_toilet),
        toilet_count: toSafeInt(newUnitData.toilet_count),
        toilet_area: toSafeFloat(newUnitData.toilet_area),
        electric_connection: Boolean(newUnitData.electricity_connection),
        water_connection: Boolean(newUnitData.water_connection),
        sewer_connection: Boolean(newUnitData.sewer_connection),
        gas_connection: Boolean(newUnitData.gas_connection),
        internet_connection: Boolean(newUnitData.internet_connection),
      };

      await upsertUnitUtilities({
        unitId: newUnitId,
        data: utilitiesData,
      }).unwrap();

      const newUnitPhotos = Array.isArray(newUnitData.photos)
        ? newUnitData.photos.filter((photo) => photo?.uri)
        : [];

      if (newUnitPhotos.length > 0) {
        const formData = new FormData();

        newUnitPhotos.forEach((photo, index) => {
          const extension = photo.uri?.split(".").pop()?.toLowerCase() || "jpg";
          const normalizedExtension = extension === "jpg" ? "jpeg" : extension;

          formData.append("images", {
            uri: photo.uri,
            type: `image/${normalizedExtension}`,
            name: `unit_${newUnitId}_${Date.now()}_${index}.${extension === "jpeg" ? "jpg" : extension}`,
          });
        });

        const metadata = newUnitPhotos.map((photo) => ({
          caption: photo.caption || "Unit Photo",
          photo_type: "unit_photo",
        }));

        formData.append("metadata", JSON.stringify(metadata));

        await createUnitPhotos({ unitId: newUnitId, formData }).unwrap();
      }

      // Update floor's number_of_units
      const currentUnits = groupedUnitsByFloor[floorNumber] || [];
      const newNumberOfUnits = currentUnits.length + 1;

      const floorData = {
        construction_year: toSafeInt(
          floorDetails[floorNumber]?.construction_year,
        ),
        carpet_area: toSafeFloat(floorDetails[floorNumber]?.carpet_area),
        floor_use: floorDetails[floorNumber]?.floor_use || null,
        number_of_units: newNumberOfUnits,
        has_parking: Boolean(newUnitData.has_parking),
        parking_type: newUnitData.parking_type || null,
        parking_area: toSafeFloat(newUnitData.parking_area),
      };

      await updateFloor({ floorId: floor.id, data: floorData }).unwrap();

      setIsAddUnitModalVisible(false);
      // Reset form and close modal
      setNewUnitData({
        unit_number: "",
        unit_address: "",
        carpet_area: "",
        construction_year: "",
        occupancy_status: "Self",
        area: "",
        self_area: "",
        rented_area: "",
        owner_name: "",
        owner_mobile: "",
        owner_adhar: "",
        owner_occupation: "",
        disabled_person: "NO",
        father_or_husband_name: "",
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
        electricity_connection: false,
        water_connection: false,
        sewer_connection: false,
        gas_connection: false,
        internet_connection: false,
        photos: [],
      });
      setUnits((prev) => [...prev, { id: newUnitId, ...unitData }]);
      setIsAddingUnits(false);

      Toast.show({
        type: "success",
        text1: "Unit added",
        text2: "New unit has been added successfully.",
      });

      // Navigate to survey details page immediately
      router.replace(`../${id}`);
    } catch (err) {
      setIsAddingUnits(false);
      Toast.show({
        type: "error",
        text1: "Add unit failed",
        text2: err?.data?.message || err?.message || "Could not add unit.",
      });
    }
  };

  const renderFloorSections = () => {
    if (allFloorNumbers.length === 0) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Floor & Unit Details</Text>
          <Text style={styles.emptyText}>
            No floor or unit records available.
          </Text>
        </View>
      );
    }

    return allFloorNumbers.map((floorNumber) => {
      const floor =
        floors.find((item) => Number(item.floor_number ?? 0) === floorNumber) ||
        {};
      const floorUnits = groupedUnitsByFloor[floorNumber] || [];
      const floorUtility = getFloorUtility(floorNumber, floor);
      const currentFloorDetails = floorDetails[floorNumber] || {};

      return (
        <View key={`floor-${floorNumber}`} style={styles.section}>
          <Text style={styles.sectionTitle}>{getFloorLabel(floorNumber)}</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Construction Year</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter construction year"
              value={currentFloorDetails.construction_year || ""}
              onChangeText={(value) =>
                handleFloorDetailChange(floorNumber, "construction_year", value)
              }
              keyboardType="numeric"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Carpet Area (sq.mt)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter carpet area"
              value={currentFloorDetails.carpet_area || ""}
              onChangeText={(value) =>
                handleFloorDetailChange(floorNumber, "carpet_area", value)
              }
              keyboardType="numeric"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Ground Floor Use */}
          {building_type === "Residential" &&
          building_subtype === "MultiStory" ? (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Floor Use</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {["Unit", "Parking", "Both"].map((status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() =>
                      handleFloorDetailChange(floorNumber, "floor_use", status)
                    }
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor:
                        currentFloorDetails.floor_use === status
                          ? "#0f2d5c"
                          : "#f3f4f6",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color:
                          currentFloorDetails.floor_use === status
                            ? "#fff"
                            : "#374151",
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Occupancy Status</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {["Self", "Rented", "SelfRented", "Vacant"].map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() =>
                        handleFloorDetailChange(
                          floorNumber,
                          "occupancy_status",
                          status,
                        )
                      }
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor:
                          currentFloorDetails.occupancy_status === status
                            ? "#0f2d5c"
                            : "#f3f4f6",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            currentFloorDetails.occupancy_status === status
                              ? "#fff"
                              : "#374151",
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {status}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {isRentedLikeOccupancy(currentFloorDetails.occupancy_status) && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Occupant/Tenant Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter occupant name"
                      value={currentFloorDetails.occupant_name || ""}
                      onChangeText={(value) =>
                        handleFloorDetailChange(
                          floorNumber,
                          "occupant_name",
                          value,
                        )
                      }
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Occupant/Tenant Mobile</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter occupant mobile"
                      value={currentFloorDetails.occupant_mobile || ""}
                      onChangeText={(value) =>
                        handleFloorDetailChange(
                          floorNumber,
                          "occupant_mobile",
                          value,
                        )
                      }
                      keyboardType="phone-pad"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Monthly Rent Amount (₹)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter monthly rent"
                      value={currentFloorDetails.rent_amount || ""}
                      onChangeText={(value) =>
                        handleFloorDetailChange(
                          floorNumber,
                          "rent_amount",
                          value,
                        )
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </>
              )}
            </>
          )}

          {building_type === "Residential" &&
          building_subtype === "SingleStory" ? (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Area</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter area"
                  value={currentFloorDetails.carpet_area || ""}
                  onChangeText={(value) =>
                    handleFloorDetailChange(floorNumber, "carpet_area", value)
                  }
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Has Kitchen</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {["Yes", "No"].map((value) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() =>
                        handleFloorDetailChange(
                          floorNumber,
                          "has_kitchen",
                          value === "Yes",
                        )
                      }
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor:
                          currentFloorDetails.has_kitchen === (value === "Yes")
                            ? "#0f2d5c"
                            : "#f3f4f6",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            currentFloorDetails.has_kitchen ===
                            (value === "Yes")
                              ? "#fff"
                              : "#374151",
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>No. of Kitchen</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter number of kitchens"
                  value={currentFloorDetails.kitchen_count || ""}
                  onChangeText={(value) =>
                    handleFloorDetailChange(floorNumber, "kitchen_count", value)
                  }
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Kitchen Area</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter kitchen area"
                  value={currentFloorDetails.kitchen_area || ""}
                  onChangeText={(value) =>
                    handleFloorDetailChange(floorNumber, "kitchen_area", value)
                  }
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Has Toilet</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {["Yes", "No"].map((value) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() =>
                        handleFloorDetailChange(
                          floorNumber,
                          "has_toilet",
                          value === "Yes",
                        )
                      }
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor:
                          currentFloorDetails.has_toilet === (value === "Yes")
                            ? "#0f2d5c"
                            : "#f3f4f6",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            currentFloorDetails.has_toilet === (value === "Yes")
                              ? "#fff"
                              : "#374151",
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>No. of Toilets</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter number of toilets"
                  value={currentFloorDetails.toilet_count || ""}
                  onChangeText={(value) =>
                    handleFloorDetailChange(floorNumber, "toilet_count", value)
                  }
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Toilet Area</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter toilet area"
                  value={currentFloorDetails.toilet_area || ""}
                  onChangeText={(value) =>
                    handleFloorDetailChange(floorNumber, "toilet_area", value)
                  }
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Has Parking</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {["Yes", "No"].map((value) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() =>
                        handleFloorDetailChange(
                          floorNumber,
                          "has_parking",
                          value === "Yes",
                        )
                      }
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor:
                          currentFloorDetails.has_parking === (value === "Yes")
                            ? "#0f2d5c"
                            : "#f3f4f6",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            currentFloorDetails.has_parking ===
                            (value === "Yes")
                              ? "#fff"
                              : "#374151",
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Parking Type</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter parking type"
                  value={currentFloorDetails.parking_type || ""}
                  onChangeText={(value) =>
                    handleFloorDetailChange(floorNumber, "parking_type", value)
                  }
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Parking Area</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter parking area"
                  value={currentFloorDetails.parking_area || ""}
                  onChangeText={(value) =>
                    handleFloorDetailChange(floorNumber, "parking_area", value)
                  }
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </>
          ) : (
            <View>
              {currentFloorDetails.floor_use === "Parking" ? (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Parking Type</Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {["OPEN", "COVERED", "NONE"].map((type) => (
                        <TouchableOpacity
                          key={type}
                          onPress={() =>
                            handleFloorDetailChange(
                              floorNumber,
                              "parking_type",
                              type,
                            )
                          }
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor:
                              currentFloorDetails.parking_type === type
                                ? "#0f2d5c"
                                : "#f3f4f6",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              color:
                                currentFloorDetails.parking_type === type
                                  ? "#fff"
                                  : "#374151",
                              fontWeight: "600",
                              fontSize: 13,
                            }}
                          >
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Parking Area (sq.mt)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter parking area"
                      value={currentFloorDetails.parking_area || ""}
                      onChangeText={(value) =>
                        handleFloorDetailChange(
                          floorNumber,
                          "parking_area",
                          value,
                        )
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => handleUpdateFloor(floorNumber)}
                    disabled={!!floorUpdatingIds[floorNumber]}
                    style={{
                      marginTop: 12,
                      paddingVertical: 12,
                      borderRadius: 8,
                      backgroundColor: floorSavedIds[floorNumber]
                        ? "#0f2d5c"
                        : "#0f2d5c",
                      alignItems: "center",
                    }}
                  >
                    {floorUpdatingIds[floorNumber] ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        {floorSavedIds[floorNumber]
                          ? "Update Floor"
                          : "Save Floor"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>No. of Flats</Text>
                    <TextInput
                      style={[
                        styles.input,
                        errors.plot_area && { borderColor: "#dc2626" },
                      ]}
                      placeholder="Enter number of units"
                      value={renderValue(
                        floor.number_of_units || floorUnits.length || 0,
                      )}
                      onChangeText={(value) =>
                        handleFloorDetailChange(
                          floorNumber,
                          "number_of_units",
                          value,
                        )
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setCurrentFloorForNewUnit(floorNumber);
                      setIsAddUnitModalVisible(true);
                    }}
                    style={{
                      marginTop: 12,
                      paddingVertical: 12,
                      borderRadius: 8,
                      backgroundColor: "#0f2d5c",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      Add New Flat
                    </Text>
                  </TouchableOpacity>

                  {isMultiStory ? (
                    <View
                      style={{
                        marginTop: 16,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: "#e5e7eb",
                      }}
                    >
                      <Text style={styles.unitDetailsHeader}>
                        {`Units Details (${floorUnits.length})`}
                      </Text>

                      <ScrollView
                        style={styles.unitList}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                      >
                        {floorUnits.map((item, index) => {
                          const unitKey = getUnitKey(item);
                          const unitState = editableUnits[unitKey] || {};
                          const isLoadingUnit = !!unitUpdatingIds[unitKey];
                          const isDeletingUnit = !!unitDeletingIds[unitKey];
                          const selectedOccupancyStatus =
                            unitState.occupancy_status || item.occupancy_status;
                          const showRentedFields = isRentedLikeOccupancy(
                            selectedOccupancyStatus,
                          );

                          return (
                            <View
                              key={`unit-${item.id || item.unit_id || index}`}
                              style={{
                                marginTop: index === 0 ? 0 : 16,
                                padding: 14,
                                borderRadius: 14,
                                backgroundColor: "#f8fafb",
                                borderWidth: 1,
                                borderColor: "#e5e7eb",
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: 10,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 14,
                                    fontWeight: "700",
                                    color: "#0f2d5c",
                                  }}
                                >
                                  Unit {index + 1}:{" "}
                                  {unitState.unit_number ||
                                    item.unit_number ||
                                    item.unit_address ||
                                    "N/A"}
                                </Text>
                                <TouchableOpacity
                                  onPress={() =>
                                    handleDeleteUnit(unitKey, item)
                                  }
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 10,
                                    backgroundColor: "#ef4444",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {isDeletingUnit ? (
                                    <ActivityIndicator
                                      size="small"
                                      color="#fff"
                                    />
                                  ) : (
                                    <MaterialIcons
                                      name="delete"
                                      size={18}
                                      color="#fff"
                                    />
                                  )}
                                </TouchableOpacity>
                              </View>

                              <View style={styles.formGroup}>
                                <Text style={styles.label}>Unit Number</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Unit number"
                                  value={unitState.unit_number || ""}
                                  onChangeText={(value) =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "unit_number",
                                      value,
                                    )
                                  }
                                  placeholderTextColor="#9ca3af"
                                />
                              </View>

                              <View style={styles.formGroup}>
                                <Text style={styles.label}>Unit Address</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Unit address"
                                  value={unitState.unit_address || ""}
                                  onChangeText={(value) =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "unit_address",
                                      value,
                                    )
                                  }
                                  placeholderTextColor="#9ca3af"
                                />
                              </View>
                              <View style={styles.formGroup}>
                                <Text style={styles.label}>
                                  Carpet Area (sq.mt)
                                </Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Enter carpet area"
                                  value={unitState.carpet_area || ""}
                                  onChangeText={(value) =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "carpet_area",
                                      value,
                                    )
                                  }
                                  keyboardType="numeric"
                                  placeholderTextColor="#9ca3af"
                                />
                              </View>
                              <View style={styles.formGroup}>
                                <Text style={styles.label}>
                                  Construction Year
                                </Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Enter construction year"
                                  value={unitState.construction_year || ""}
                                  onChangeText={(value) =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "construction_year",
                                      value,
                                    )
                                  }
                                  keyboardType="numeric"
                                  placeholderTextColor="#9ca3af"
                                />
                              </View>

                              <View style={styles.formGroup}>
                                <Text style={styles.label}>
                                  Occupancy Status
                                </Text>
                                <View style={{ flexDirection: "row", gap: 10 }}>
                                  {[
                                    "Self",
                                    "Rented",
                                    "SelfRented",
                                    "Vacant",
                                  ].map((status) => (
                                    <TouchableOpacity
                                      key={status}
                                      onPress={() =>
                                        handleUnitDetailChange(
                                          unitKey,
                                          "occupancy_status",
                                          status,
                                        )
                                      }
                                      style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        paddingHorizontal: 12,
                                        borderRadius: 8,
                                        backgroundColor:
                                          unitState.occupancy_status === status
                                            ? "#0f2d5c"
                                            : "#f3f4f6",
                                        alignItems: "center",
                                      }}
                                    >
                                      <Text
                                        style={{
                                          color:
                                            unitState.occupancy_status ===
                                            status
                                              ? "#fff"
                                              : "#374151",
                                          fontWeight: "600",
                                          fontSize: 13,
                                        }}
                                      >
                                        {status}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                              <View style={styles.formGroup}>
                                <Text style={styles.label}>Area (sq.mt)</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Enter area"
                                  value={unitState.area || ""}
                                  onChangeText={(value) =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "area",
                                      value,
                                    )
                                  }
                                  keyboardType="numeric"
                                  placeholderTextColor="#9ca3af"
                                />
                              </View>
                              <View style={styles.formGroup}>
                                <Text style={styles.label}>Owner Name</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Enter owner name"
                                  value={unitState.owner_name || ""}
                                  onChangeText={(value) =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "owner_name",
                                      value,
                                    )
                                  }
                                  placeholderTextColor="#9ca3af"
                                />
                              </View>

                              <View style={styles.formGroup}>
                                <Text style={styles.label}>Owner Mobile</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Enter owner mobile"
                                  keyboardType="phone-pad"
                                  value={unitState.owner_mobile || ""}
                                  maxLength={10}
                                  onChangeText={(value) =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "owner_mobile",
                                      value,
                                    )
                                  }
                                  placeholderTextColor="#9ca3af"
                                />
                              </View>
                              <View style={styles.formGroup}>
                                <Text style={styles.label}>Aadhar Number</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Enter Aadhar number"
                                  keyboardType="phone-pad"
                                  value={unitState.aadhar_number || ""}
                                  maxLength={12}
                                  onChangeText={(value) =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "aadhar_number",
                                      value,
                                    )
                                  }
                                  placeholderTextColor="#9ca3af"
                                />
                              </View>

                              <View style={styles.formGroup}>
                                <Text style={styles.label}>
                                  Owner Occupation
                                </Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Enter owner occupation"
                                  value={unitState.owner_occupation || ""}
                                  onChangeText={(value) =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "owner_occupation",
                                      value,
                                    )
                                  }
                                  placeholderTextColor="#9ca3af"
                                />
                              </View>
                              <View style={styles.formGroup}>
                                <Text style={styles.label}>
                                  Disabled Person
                                </Text>
                                <View style={{ flexDirection: "row", gap: 10 }}>
                                  {["YES", "NO"].map((status) => (
                                    <TouchableOpacity
                                      key={status}
                                      onPress={() =>
                                        handleUnitDetailChange(
                                          unitKey,
                                          "disabled_person",
                                          status,
                                        )
                                      }
                                      style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        paddingHorizontal: 12,
                                        borderRadius: 8,
                                        backgroundColor:
                                          unitState.disabled_person === status
                                            ? "#0f2d5c"
                                            : "#f3f4f6",
                                        alignItems: "center",
                                      }}
                                    >
                                      <Text
                                        style={{
                                          color:
                                            unitState.disabled_person === status
                                              ? "#fff"
                                              : "#374151",
                                          fontWeight: "600",
                                          fontSize: 13,
                                        }}
                                      >
                                        {status}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                              <View style={styles.formGroup}>
                                <Text style={styles.label}>
                                  Father/Husband Name
                                </Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Enter father/husband name"
                                  value={unitState.father_or_husband_name || ""}
                                  onChangeText={(value) =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "father_or_husband_name",
                                      value,
                                    )
                                  }
                                  placeholderTextColor="#9ca3af"
                                />
                              </View>
                              {showRentedFields && (
                                <>
                                  <View style={styles.formGroup}>
                                    <Text style={styles.label}>
                                      Occupier Name
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Enter occupier name"
                                      value={unitState.occupier_name || ""}
                                      onChangeText={(value) =>
                                        handleUnitDetailChange(
                                          unitKey,
                                          "occupier_name",
                                          value,
                                        )
                                      }
                                      placeholderTextColor="#9ca3af"
                                    />
                                  </View>
                                  <View style={styles.formGroup}>
                                    <Text style={styles.label}>
                                      Occupier Mobile
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Enter occupier mobile"
                                      keyboardType="phone-pad"
                                      value={unitState.occupier_mobile || ""}
                                      onChangeText={(value) =>
                                        handleUnitDetailChange(
                                          unitKey,
                                          "occupier_mobile",
                                          value,
                                        )
                                      }
                                      placeholderTextColor="#9ca3af"
                                    />
                                  </View>
                                  <View style={styles.formGroup}>
                                    <Text style={styles.label}>
                                      Monthly Rent Amount (₹)
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Enter monthly rent"
                                      keyboardType="numeric"
                                      value={unitState.rent_amount || ""}
                                      onChangeText={(value) =>
                                        handleUnitDetailChange(
                                          unitKey,
                                          "rent_amount",
                                          value,
                                        )
                                      }
                                      placeholderTextColor="#9ca3af"
                                    />
                                  </View>
                                </>
                              )}
                              <Text className="text-xl mb-3 mt-4">
                                Utilities
                              </Text>
                              <View
                                style={{
                                  flexDirection: "column",
                                  gap: 12,
                                }}
                              >
                                {[
                                  {
                                    key: "electricity_connection",
                                    label: "Electricity Coonnection",
                                  },
                                  {
                                    key: "water_connection",
                                    label: "Water Connection",
                                  },
                                  {
                                    key: "sewer_connection",
                                    label: "Sewer Connection",
                                  },
                                  {
                                    key: "gas_connection",
                                    label: "Gas Connection",
                                  },
                                  {
                                    key: "internet_connection",
                                    label: "Internet Connection",
                                  },
                                ].map(({ key, label }) => {
                                  const value = !!unitState[key];

                                  return (
                                    <TouchableOpacity
                                      key={key}
                                      activeOpacity={0.7}
                                      onPress={() =>
                                        handleUnitDetailChange(
                                          unitKey,
                                          key,
                                          !value,
                                        )
                                      }
                                      style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingVertical: 14,
                                        paddingHorizontal: 16,
                                        borderRadius: 12,
                                        backgroundColor: value
                                          ? "#eef4ff"
                                          : "#ffffff",
                                        borderWidth: 1,
                                        borderColor: value
                                          ? "#0f2d5c"
                                          : "#e5e7eb",
                                        shadowColor: "#000",
                                        shadowOpacity: 0.05,
                                        shadowRadius: 4,
                                        shadowOffset: { width: 0, height: 2 },
                                        elevation: 2,
                                      }}
                                    >
                                      <View
                                        style={{
                                          width: 22,
                                          height: 22,
                                          borderRadius: 6,
                                          borderWidth: 2,
                                          borderColor: value
                                            ? "#0f2d5c"
                                            : "#d1d5db",
                                          backgroundColor: value
                                            ? "#0f2d5c"
                                            : "#fff",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          marginRight: 12,
                                        }}
                                      >
                                        {value && (
                                          <MaterialIcons
                                            name="check"
                                            size={16}
                                            color="#fff"
                                          />
                                        )}
                                      </View>

                                      <Text
                                        style={{
                                          color: value ? "#0f2d5c" : "#374151",
                                          fontSize: 14,
                                          fontWeight: value ? "600" : "400",
                                        }}
                                      >
                                        {label}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>

                              <View style={styles.formGroup}>
                                <Text style={styles.label}>Has Kitchen</Text>
                                <TouchableOpacity
                                  onPress={() =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "has_kitchen",
                                      !unitState.has_kitchen,
                                    )
                                  }
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 10,
                                    paddingHorizontal: 12,
                                    borderRadius: 8,
                                    backgroundColor: "#f9fafb",
                                    borderWidth: 1,
                                    borderColor: unitState.has_kitchen
                                      ? "#0f2d5c"
                                      : "#d1d5db",
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: 4,
                                      borderWidth: 2,
                                      borderColor: unitState.has_kitchen
                                        ? "#0f2d5c"
                                        : "#d1d5db",
                                      backgroundColor: unitState.has_kitchen
                                        ? "#0f2d5c"
                                        : "#fff",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      marginRight: 10,
                                    }}
                                  >
                                    {unitState.has_kitchen && (
                                      <MaterialIcons
                                        name="check"
                                        size={14}
                                        color="#fff"
                                      />
                                    )}
                                  </View>
                                  <Text style={{ color: "#374151" }}>
                                    Has Kitchen
                                  </Text>
                                </TouchableOpacity>
                              </View>

                              {unitState.has_kitchen ? (
                                <>
                                  <View style={styles.formGroup}>
                                    <Text style={styles.label}>
                                      Kitchen Count
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Enter kitchen count"
                                      keyboardType="numeric"
                                      value={unitState.kitchen_count || ""}
                                      onChangeText={(value) =>
                                        handleUnitDetailChange(
                                          unitKey,
                                          "kitchen_count",
                                          value,
                                        )
                                      }
                                      placeholderTextColor="#9ca3af"
                                    />
                                  </View>
                                  <View style={styles.formGroup}>
                                    <Text style={styles.label}>
                                      Kitchen Area (sq.mt)
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Enter kitchen area"
                                      keyboardType="numeric"
                                      value={unitState.kitchen_area || ""}
                                      onChangeText={(value) =>
                                        handleUnitDetailChange(
                                          unitKey,
                                          "kitchen_area",
                                          value,
                                        )
                                      }
                                      placeholderTextColor="#9ca3af"
                                    />
                                  </View>
                                </>
                              ) : null}

                              <View style={styles.formGroup}>
                                <Text style={styles.label}>Has Toilet</Text>
                                <TouchableOpacity
                                  onPress={() =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "has_toilet",
                                      !unitState.has_toilet,
                                    )
                                  }
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 10,
                                    paddingHorizontal: 12,
                                    borderRadius: 8,
                                    backgroundColor: "#f9fafb",
                                    borderWidth: 1,
                                    borderColor: unitState.has_toilet
                                      ? "#0f2d5c"
                                      : "#d1d5db",
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: 4,
                                      borderWidth: 2,
                                      borderColor: unitState.has_toilet
                                        ? "#0f2d5c"
                                        : "#d1d5db",
                                      backgroundColor: unitState.has_toilet
                                        ? "#0f2d5c"
                                        : "#fff",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      marginRight: 10,
                                    }}
                                  >
                                    {unitState.has_toilet && (
                                      <MaterialIcons
                                        name="check"
                                        size={14}
                                        color="#fff"
                                      />
                                    )}
                                  </View>
                                  <Text style={{ color: "#374151" }}>
                                    Has Toilet
                                  </Text>
                                </TouchableOpacity>
                              </View>

                              {unitState.has_toilet ? (
                                <>
                                  <View style={styles.formGroup}>
                                    <Text style={styles.label}>
                                      Toilet Count
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Enter toilet count"
                                      keyboardType="numeric"
                                      value={unitState.toilet_count || ""}
                                      onChangeText={(value) =>
                                        handleUnitDetailChange(
                                          unitKey,
                                          "toilet_count",
                                          value,
                                        )
                                      }
                                      placeholderTextColor="#9ca3af"
                                    />
                                  </View>
                                  <View style={styles.formGroup}>
                                    <Text style={styles.label}>
                                      Toilet Area (sq.mt)
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Enter toilet area"
                                      keyboardType="numeric"
                                      value={unitState.toilet_area || ""}
                                      onChangeText={(value) =>
                                        handleUnitDetailChange(
                                          unitKey,
                                          "toilet_area",
                                          value,
                                        )
                                      }
                                      placeholderTextColor="#9ca3af"
                                    />
                                  </View>
                                </>
                              ) : null}

                              <View style={styles.formGroup}>
                                <Text style={styles.label}>Has Parking</Text>
                                <TouchableOpacity
                                  onPress={() =>
                                    handleUnitDetailChange(
                                      unitKey,
                                      "has_parking",
                                      !unitState.has_parking,
                                    )
                                  }
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 10,
                                    paddingHorizontal: 12,
                                    borderRadius: 8,
                                    backgroundColor: "#f9fafb",
                                    borderWidth: 1,
                                    borderColor: unitState.has_parking
                                      ? "#0f2d5c"
                                      : "#d1d5db",
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: 4,
                                      borderWidth: 2,
                                      borderColor: unitState.has_parking
                                        ? "#0f2d5c"
                                        : "#d1d5db",
                                      backgroundColor: unitState.has_parking
                                        ? "#0f2d5c"
                                        : "#fff",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      marginRight: 10,
                                    }}
                                  >
                                    {unitState.has_parking && (
                                      <MaterialIcons
                                        name="check"
                                        size={14}
                                        color="#fff"
                                      />
                                    )}
                                  </View>
                                  <Text style={{ color: "#374151" }}>
                                    Has Parking
                                  </Text>
                                </TouchableOpacity>
                              </View>

                              {unitState.has_parking ? (
                                <>
                                  <View style={styles.formGroup}>
                                    <Text style={styles.label}>
                                      Parking Type
                                    </Text>
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        gap: 10,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      {["NONE", "OPEN", "COVERED"].map(
                                        (type) => (
                                          <TouchableOpacity
                                            key={type}
                                            onPress={() =>
                                              handleUnitDetailChange(
                                                unitKey,
                                                "parking_type",
                                                type,
                                              )
                                            }
                                            style={{
                                              flex: 1,
                                              minWidth: "40%",
                                              paddingVertical: 10,
                                              paddingHorizontal: 12,
                                              borderRadius: 8,
                                              backgroundColor:
                                                unitState.parking_type === type
                                                  ? "#0f2d5c"
                                                  : "#f3f4f6",
                                              alignItems: "center",
                                            }}
                                          >
                                            <Text
                                              style={{
                                                color:
                                                  unitState.parking_type ===
                                                  type
                                                    ? "#fff"
                                                    : "#374151",
                                                fontWeight: "600",
                                                fontSize: 12,
                                              }}
                                            >
                                              {type}
                                            </Text>
                                          </TouchableOpacity>
                                        ),
                                      )}
                                    </View>
                                  </View>
                                  <View style={styles.formGroup}>
                                    <Text style={styles.label}>
                                      Parking Area
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Enter parking area"
                                      keyboardType="numeric"
                                      value={unitState.parking_area || ""}
                                      onChangeText={(value) =>
                                        handleUnitDetailChange(
                                          unitKey,
                                          "parking_area",
                                          value,
                                        )
                                      }
                                      placeholderTextColor="#9ca3af"
                                    />
                                  </View>
                                </>
                              ) : null}

                              {/* Units Images  */}
                              <Text className="text-xl font-bold mb-3 mt-4">
                                Units Photos
                              </Text>
                              <Text className="text-gray-600 mb-3">
                                Add at least one photo before continuing
                              </Text>

                              <View className="flex-row mb-4">
                                <TouchableOpacity
                                  onPress={() => pickImages(unitKey)}
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
                                  onPress={() => capturePhoto(unitKey)}
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
                                {(() => {
                                  const selectedPhotos = Array.isArray(
                                    unitState.photos,
                                  )
                                    ? unitState.photos
                                    : [];
                                  const savedPhotos = Array.isArray(
                                    unitState.savedPhotos,
                                  )
                                    ? unitState.savedPhotos
                                    : Array.isArray(item.UnitPhotos)
                                      ? item.UnitPhotos
                                      : Array.isArray(item.photos)
                                        ? item.photos
                                        : [];
                                  const totalPhotos =
                                    selectedPhotos.length + savedPhotos.length;

                                  return (
                                    <>
                                      <Text className="font-semibold mb-2">
                                        {totalPhotos} photo(s) selected
                                      </Text>

                                      <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                      >
                                        {selectedPhotos.map(
                                          (photo, localIndex) => {
                                            const uri =
                                              photo.uri ||
                                              getImageUrl(photo) ||
                                              "";
                                            return (
                                              <View
                                                key={photo.uri ?? localIndex}
                                                className="bg-white border border-gray-200 rounded-xl p-2 mr-3"
                                              >
                                                <Image
                                                  source={{ uri }}
                                                  className="w-40 h-64 rounded-lg mb-2"
                                                  resizeMode="cover"
                                                />

                                                <TouchableOpacity
                                                  onPress={() => {
                                                    const currentPhotos =
                                                      Array.isArray(
                                                        unitState.photos,
                                                      )
                                                        ? unitState.photos
                                                        : [];
                                                    const updatedPhotos =
                                                      currentPhotos.filter(
                                                        (_, i) =>
                                                          i !== localIndex,
                                                      );
                                                    setEditableUnits(
                                                      (prev) => ({
                                                        ...prev,
                                                        [unitKey]: {
                                                          ...prev[unitKey],
                                                          photos: updatedPhotos,
                                                        },
                                                      }),
                                                    );
                                                  }}
                                                  className="bg-red-500 p-2 rounded-lg"
                                                >
                                                  <Text className="text-white text-center text-sm">
                                                    Remove
                                                  </Text>
                                                </TouchableOpacity>
                                              </View>
                                            );
                                          },
                                        )}

                                        {savedPhotos.map(
                                          (photo, savedIndex) => {
                                            const uri =
                                              getImageUrl(photo) || "";
                                            return (
                                              <View
                                                key={
                                                  photo.id ?? uri ?? savedIndex
                                                }
                                                className="bg-white border border-gray-200 rounded-xl p-2 mr-3"
                                              >
                                                <Image
                                                  source={{ uri }}
                                                  className="w-40 h-64 rounded-lg mb-2"
                                                  resizeMode="cover"
                                                />
                                                <View className="bg-gray-100 p-2 rounded-lg">
                                                  <TouchableOpacity
                                                    disabled={
                                                      deletingPhotoId ===
                                                      photo.id
                                                    }
                                                    onPress={() => {
                                                      handleRemoveSavedPhoto(
                                                        unitKey,
                                                        photo,
                                                        savedIndex,
                                                      );
                                                    }}
                                                    className="bg-red-500 p-2 rounded-lg"
                                                  >
                                                    {deletingPhotoId ===
                                                    photo.id ? (
                                                      <ActivityIndicator color="#fff" />
                                                    ) : (
                                                      <Text className="text-white text-center text-sm">
                                                        Remove
                                                      </Text>
                                                    )}
                                                  </TouchableOpacity>
                                                </View>
                                              </View>
                                            );
                                          },
                                        )}
                                      </ScrollView>
                                    </>
                                  );
                                })()}
                              </View>

                              <View
                                style={{
                                  flexDirection: "row",
                                  gap: 10,
                                  marginTop: 12,
                                }}
                              >
                                <TouchableOpacity
                                  onPress={() =>
                                    handleUpdateUnit(unitKey, item)
                                  }
                                  disabled={isLoadingUnit}
                                  style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 8,
                                    backgroundColor: "#0f2d5c",
                                    alignItems: "center",
                                  }}
                                >
                                  {isLoadingUnit ? (
                                    <ActivityIndicator color="#fff" />
                                  ) : (
                                    <Text
                                      style={{
                                        color: "#fff",
                                        fontWeight: "700",
                                        fontSize: 13,
                                      }}
                                    >
                                      Update Unit
                                    </Text>
                                  )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                  onPress={() => {
                                    setCurrentFloorForNewUnit(floorNumber);
                                    setIsAddUnitModalVisible(true);
                                  }}
                                  style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 8,
                                    backgroundColor: "green",
                                    alignItems: "center",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#fff",
                                      fontWeight: "700",
                                      fontSize: 13,
                                    }}
                                  >
                                    Add New Unit
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </ScrollView>

                      {floorUnits.length === 0 ? (
                        <View
                          style={{
                            paddingVertical: 20,
                            alignItems: "center",
                          }}
                        >
                          <Text style={styles.emptyText}>
                            No units added for this floor yet.
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </>
              )}
            </View>
          )}
        </View>
      );
    });
  };
  const handleSurveyMetadataChange = (field, value) => {
    setSurveyMetadata((prev) => ({
      ...prev,
      [field]:
        field === "is_disabled_person" ? normalizeYesNoValue(value) : value,
    }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleFloorDetailChange = (floorNumber, field, value) => {
    setFloorDetails((prev) => ({
      ...prev,
      [floorNumber]: {
        ...prev[floorNumber],
        [field]: value,
        ...(field === "has_kitchen" && value === false
          ? {
              kitchen_count: "",
              kitchen_area: "",
            }
          : {}),
        ...(field === "has_parking" && value === false
          ? {
              parking_type: "",
              parking_area: "",
            }
          : {}),
      },
    }));
    setFloorSavedIds((prev) => ({ ...prev, [floorNumber]: false }));
    if (errors[`floor_${floorNumber}_${field}`]) {
      setErrors((prev) => ({ ...prev, [`floor_${floorNumber}_${field}`]: "" }));
    }
  };

  const toggleRoadSide = (side) => {
    setRoadSidesState((prev) => ({
      ...prev,
      [side]: !prev[side],
    }));
  };

  const handleRoadDetailChange = (field, value) => {
    setRoadDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Survey metadata validation
    if (!surveyMetadata.occupancy_status?.trim())
      newErrors.occupancy_status = "Occupancy status is required";
    if (!surveyMetadata.owner_name?.trim())
      newErrors.owner_name = "Owner name is required";
    if (!surveyMetadata.mobile_number?.trim())
      newErrors.mobile_number = "Mobile number is required";

    ["front", "back", "left", "right"].forEach((side) => {
      if (roadSidesState[side]) {
        if (!roadDetails[`road_type_${side}`]) {
          newErrors[`road_type_${side}`] =
            `${side.charAt(0).toUpperCase() + side.slice(1)} side road type is required`;
        }
        if (!roadDetails[`road_width_${side}`]) {
          newErrors[`road_width_${side}`] =
            `${side.charAt(0).toUpperCase() + side.slice(1)} side road width is required`;
        }
        if (!roadDetails[`carriageway_area_${side}`]?.trim()) {
          newErrors[`carriageway_area_${side}`] =
            `${side.charAt(0).toUpperCase() + side.slice(1)} side carriageway (m) is required`;
        }
        if (!roadDetails[`footpath_area_${side}`]?.trim()) {
          newErrors[`footpath_area_${side}`] =
            `${side.charAt(0).toUpperCase() + side.slice(1)} side footpath (m) is required`;
        }
      }
    });

    if (buildingType === "RESIDENTIAL") {
      if (!residential.family_count?.trim())
        newErrors.family_count = "Family count is required";
      if (!residential.construction_type?.trim())
        newErrors.construction_type = "Construction type is required";
    } else if (buildingType === "NON_RESIDENTIAL") {
      if (!nonResidential.business_name?.trim())
        newErrors.business_name = "Business name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSingleStoryUpdate = async () => {
    if (!validateForm()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please fill in required fields",
      });
      return;
    }
    if (
      newImages.filter((_, index) => !removedNewImageIndices.has(index))
        .length === 0 &&
      survey?.SurveyImages?.length - deletedImageIds.length === 0
    ) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "At least one image is required",
      });
      return;
    }

    const propertyId = property?.id;
    const buildingId = building?.id;
    const ownerId =
      property?.PropertyOwners?.[0]?.id ||
      property?.PropertyOwners?.[0]?.owner_id;

    const propertyPayload = {};
    if (surveyMetadata.address?.trim()) {
      propertyPayload.address_line1 = surveyMetadata.address;
    }
    if (surveyMetadata.plot_area?.trim()) {
      propertyPayload.plot_area_sqmt =
        parseFloat(surveyMetadata.plot_area) || null;
    }
    if (surveyMetadata.construction_type?.trim()) {
      propertyPayload.construction_type = surveyMetadata.construction_type;
    }
    if (surveyMetadata.road_width?.trim()) {
      propertyPayload.road_width = surveyMetadata.road_width;
    }

    const propertyUtilitiesPayload = {
      has_electricity: Boolean(surveyMetadata.electricity_connection),
      has_water_connection: Boolean(surveyMetadata.water_connection),
      has_sewer_connection: Boolean(surveyMetadata.sewer_connection),
      has_gas_connection: Boolean(surveyMetadata.gas_connection),
    };

    const propertyRoadPayload = {};
    ["front", "back", "left", "right"].forEach((side) => {
      propertyRoadPayload[`road_type_${side}`] =
        roadSidesState[side] && roadDetails[`road_type_${side}`]
          ? roadDetails[`road_type_${side}`]
          : null;
      propertyRoadPayload[`road_width_${side}`] =
        roadSidesState[side] && roadDetails[`road_width_${side}`]
          ? roadDetails[`road_width_${side}`]
          : null;
      propertyRoadPayload[`carriageway_area_${side}`] =
        roadSidesState[side] && roadDetails[`carriageway_area_${side}`]
          ? parseFloat(roadDetails[`carriageway_area_${side}`])
          : null;
      propertyRoadPayload[`footpath_area_${side}`] =
        roadSidesState[side] && roadDetails[`footpath_area_${side}`]
          ? parseFloat(roadDetails[`footpath_area_${side}`])
          : null;
    });

    const ownerPayload = {
      owner_name: surveyMetadata.owner_name || null,
      mobile_number: surveyMetadata.mobile_number || null,
      occupation: surveyMetadata.occupation || null,
      aadhar_number: surveyMetadata.aadhar_number || null,
      is_disabled_person: surveyMetadata.is_disabled_person || null,
      father_or_husband_name: surveyMetadata.father_husband_name || null,
    };

    const buildingPayload = {};
    if (building?.floors_above_ground != null) {
      buildingPayload.floors_above_ground = building.floors_above_ground;
    }
    if (building?.floors_below_ground != null) {
      buildingPayload.floors_below_ground = building.floors_below_ground;
    }
    if (building?.total_builtup_area != null) {
      buildingPayload.total_builtup_area = building.total_builtup_area;
    }

    try {
      if (ownerId) {
        await updatePropertyOwner({ ownerId, data: ownerPayload }).unwrap();
      }
      if (propertyId && Object.keys(propertyPayload).length > 0) {
        await updateProperty({ propertyId, data: propertyPayload }).unwrap();
      }
      if (propertyId) {
        await upsertPropertyUtilities({
          propertyId,
          data: propertyUtilitiesPayload,
        }).unwrap();
        await updatePropertyRoad({
          propertyId,
          data: propertyRoadPayload,
        }).unwrap();
      }
      if (buildingId && Object.keys(buildingPayload).length > 0) {
        await updateBuilding({ buildingId, data: buildingPayload }).unwrap();
      }

      const floorByNumber = new Map(
        floors.map((floor) => [String(floor.floor_number), floor]),
      );

      await Promise.all(
        Object.keys(floorDetails).map(async (floorNumber) => {
          const floorState = floorDetails[floorNumber];
          const floorRecord = floorByNumber.get(String(floorNumber));
          if (!floorRecord?.id) {
            return;
          }

          await updateFloor({
            floorId: floorRecord.id,
            data: {
              floor_number: parseInt(floorNumber, 10),
              construction_year: floorState.construction_year
                ? parseInt(floorState.construction_year, 10)
                : null,
              carpet_area: floorState.carpet_area
                ? parseFloat(floorState.carpet_area)
                : null,
              usage_type_id: null,
            },
          }).unwrap();

          await updateFloorOccupancy({
            floorId: floorRecord.id,
            data: {
              occupancy_status: normalizeOccupancyStatus(
                floorState.occupancy_status,
              ),
              occupant_name: isRentedLikeOccupancy(floorState.occupancy_status)
                ? floorState.occupant_name || null
                : null,
              occupant_mobile: isRentedLikeOccupancy(
                floorState.occupancy_status,
              )
                ? floorState.occupant_mobile || null
                : null,
              rent_amount: isRentedLikeOccupancy(floorState.occupancy_status)
                ? floorState.rent_amount
                  ? parseFloat(floorState.rent_amount)
                  : null
                : null,
            },
          }).unwrap();

          await upsertFloorUtilities({
            floorId: floorRecord.id,
            data: {
              has_kitchen: Boolean(floorState.has_kitchen),
              kitchen_count: floorState.has_kitchen
                ? parseInt(floorState.kitchen_count, 10) || null
                : null,
              kitchen_area: floorState.has_kitchen
                ? parseFloat(floorState.kitchen_area) || null
                : null,
              has_toilet: Boolean(floorState.has_toilet),
              toilet_count: floorState.has_toilet
                ? parseInt(floorState.toilet_count, 10) || null
                : null,
              toilet_area: floorState.has_toilet
                ? parseFloat(floorState.toilet_area) || null
                : null,
              has_parking: Boolean(floorState.has_parking),
              parking_type: floorState.has_parking
                ? floorState.parking_type || null
                : null,
              parking_area: floorState.has_parking
                ? parseFloat(floorState.parking_area) || null
                : null,
            },
          }).unwrap();
        }),
      );

      if (newImages.length > 0 && propertyId) {
        const photoFormData = new FormData();
        newImages.forEach((image, index) => {
          // Skip removed images - only upload non-removed images
          if (removedNewImageIndices.has(index)) return;
          const ext = image.uri.split(".").pop() || "jpg";
          photoFormData.append("photos", {
            uri: image.uri,
            name: `property_${Date.now()}_${index}.${ext}`,
            type: `image/${ext === "jpg" ? "jpeg" : ext}`,
          });
        });
        await createPropertyPhoto({
          propertyId,
          formData: photoFormData,
        }).unwrap();
      }

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Survey updated successfully!",
      });

      // Reset image state after successful update
      setNewImages([]);
      setRemovedNewImageIndices(new Set());

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (err) {
      console.error("Update error:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err?.data?.message || err?.message || "Failed to update survey",
      });
    }
  };
  const handleMultyStoryUpdate = async () => {
    // if (!validateForm()) {
    //   Toast.show({
    //     type: "error",
    //     text1: "Validation Error",
    //     text2: "Please fill in required fields",
    //   });
    //   return;
    // }

    if (
      newImages.filter((_, index) => !removedNewImageIndices.has(index))
        .length === 0 &&
      survey?.SurveyImages?.length - deletedImageIds.length === 0
    ) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "At least one image is required",
      });
      return;
    }

    const propertyId = property?.id;
    const buildingId = building?.id;

    try {
      // Update Property Information
      const propertyPayload = {};
      if (surveyMetadata.address?.trim()) {
        propertyPayload.address_line1 = surveyMetadata.address;
      }
      if (surveyMetadata.plot_area?.trim()) {
        propertyPayload.plot_area =
          parseFloat(surveyMetadata.plot_area) || null;
      }
      if (surveyMetadata.occupancy_status?.trim()) {
        propertyPayload.construction_type = surveyMetadata.occupancy_status;
      }
      if (surveyMetadata.road_width?.trim()) {
        propertyPayload.road_width = surveyMetadata.road_width;
      }

      if (propertyId && Object.keys(propertyPayload).length > 0) {
        await updateProperty({ propertyId, data: propertyPayload }).unwrap();
      }

      // Update Property Road Details
      const propertyRoadPayload = {};
      ["front", "back", "left", "right"].forEach((side) => {
        propertyRoadPayload[`road_type_${side}`] =
          roadSidesState[side] && roadDetails[`road_type_${side}`]
            ? roadDetails[`road_type_${side}`]
            : null;
        propertyRoadPayload[`road_width_${side}`] =
          roadSidesState[side] && roadDetails[`road_width_${side}`]
            ? roadDetails[`road_width_${side}`]
            : null;
        propertyRoadPayload[`carriageway_area_${side}`] =
          roadSidesState[side] && roadDetails[`carriageway_area_${side}`]
            ? parseFloat(roadDetails[`carriageway_area_${side}`])
            : null;
        propertyRoadPayload[`footpath_area_${side}`] =
          roadSidesState[side] && roadDetails[`footpath_area_${side}`]
            ? parseFloat(roadDetails[`footpath_area_${side}`])
            : null;
      });

      if (propertyId) {
        await updatePropertyRoad({
          propertyId,
          data: propertyRoadPayload,
        }).unwrap();
      }

      // Update Building Information
      const buildingPayload = {};
      if (surveyMetadata.floors_above_ground?.trim()) {
        buildingPayload.floors_above_ground =
          parseInt(surveyMetadata.floors_above_ground, 10) || null;
      }
      if (surveyMetadata.floors_below_ground?.trim()) {
        buildingPayload.floors_below_ground =
          parseInt(surveyMetadata.floors_below_ground, 10) || null;
      }
      if (surveyMetadata.total_builtup_area?.trim()) {
        buildingPayload.total_builtup_area =
          parseFloat(surveyMetadata.total_builtup_area) || null;
      }

      if (buildingId && Object.keys(buildingPayload).length > 0) {
        await updateBuilding({ buildingId, data: buildingPayload }).unwrap();
      }

      // Upload new property images if any
      if (newImages.length > 0 && propertyId) {
        const photoFormData = new FormData();
        newImages.forEach((image, index) => {
          // Skip removed images - only upload non-removed images
          if (removedNewImageIndices.has(index)) return;
          if (image.id) return; // Skip already uploaded images
          const ext = image.uri.split(".").pop() || "jpg";
          photoFormData.append("photos", {
            uri: image.uri,
            name: `property_${Date.now()}_${index}.${ext}`,
            type: `image/${ext === "jpg" ? "jpeg" : ext}`,
          });
          photoFormData.append("caption", image.caption || "Property Photo");
          photoFormData.append("photo_type", image.photo_type || "PROPERTY");
        });

        await createPropertyPhoto({
          propertyId,
          formData: photoFormData,
        }).unwrap();
      }

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Survey updated successfully!",
      });

      // Reset image state after successful update
      setNewImages([]);
      setRemovedNewImageIndices(new Set());

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (err) {
      console.error("Update error:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err?.data?.message || err?.message || "Failed to update survey",
      });
    }
  };

  const removePhoto = (imageId) => {
    Alert.alert(
      "Are you sure?",
      "This will permanently delete the image.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingImageId(imageId);
              const result = await deleteUnitPhoto({ imageId }).unwrap();

              Toast.show({
                type: "success",
                text1: "Success",
                text2: result.message || "Image deleted successfully",
              });

              setDeletedImageIds((prev) => [...prev, imageId]);
            } catch (error) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: error?.data?.message || "Failed to delete image",
              });
            } finally {
              setDeletingImageId(null);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const pickImage = async () => {
    try {
      setUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const selectedAssets = result.assets || [];
      if (selectedAssets.length === 0) {
        setUploading(false);
        return;
      }

      const NewPhotos = selectedAssets.map((asset) => ({
        uri: asset.uri,
        fileName: asset.fileName,
        type: asset.type,
        gps_latitude: parseFloat(coordinates?.lat) || null,
        gps_longitude: parseFloat(coordinates?.lng) || null,
      }));

      // Fill removed slots first with new images
      const updatedImages = [...newImages];
      const removedIndices = Array.from(removedNewImageIndices).sort(
        (a, b) => a - b,
      );
      const newRemovedIndices = new Set(removedNewImageIndices);

      let photoIndex = 0;
      for (const slotIndex of removedIndices) {
        if (photoIndex < NewPhotos.length) {
          updatedImages[slotIndex] = NewPhotos[photoIndex];
          newRemovedIndices.delete(slotIndex);
          photoIndex++;
        }
      }

      // Add remaining images to the end
      if (photoIndex < NewPhotos.length) {
        updatedImages.push(...NewPhotos.slice(photoIndex));
      }

      setNewImages(updatedImages);
      setRemovedNewImageIndices(newRemovedIndices);

      Toast.show({
        type: "success",
        text1: "Images Added",
        text2: `${NewPhotos.length} image(s) added successfully`,
      });

      setUploading(false);
    } catch (error) {
      console.error("Image pick error:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to pick image",
      });
      setUploading(false);
    }
  };

  const removeNewImage = (index) => {
    // Mark image as removed instead of deleting (keeps slot for future uploads)
    const newRemovedIndices = new Set(removedNewImageIndices);
    newRemovedIndices.add(index);
    setRemovedNewImageIndices(newRemovedIndices);
    Toast.show({
      type: "success",
      text1: "Image Removed",
      text2: "Slot available for new image",
    });
  };

  if (isLoading || isFetching) {
    return (
      <ProtectedRoute allowedRoles={["SURVEYOR"]}>
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Edit Survey</Text>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <SurveyEditSkeleton />
        </View>
      </ProtectedRoute>
    );
  }

  if (error || !surveyDetail) {
    return (
      <ProtectedRoute allowedRoles={["SURVEYOR"]}>
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Edit Survey</Text>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.loadingContainer}>
            <MaterialIcons name="error-outline" size={48} color="#ef4444" />
            <Text
              style={{ marginTop: 12, color: "#ef4444", fontWeight: "600" }}
            >
              {error?.data?.message || "Failed to load survey"}
            </Text>
          </View>
        </View>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["SURVEYOR"]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Edit Survey</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.contentContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Survey Metadata */}
          <View style={styles.section}>
            {isSingleStory ? (
              <Text style={styles.sectionTitle}>Survey Information</Text>
            ) : (
              <Text style={styles.sectionTitle}>Property Information</Text>
            )}
            {isSingleStory ? (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Owner Name <Text style={{ color: "#dc2626" }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.owner_name && { borderColor: "#dc2626" },
                    ]}
                    placeholder="Enter owner name"
                    value={surveyMetadata.owner_name || ""}
                    onChangeText={(value) =>
                      handleSurveyMetadataChange("owner_name", value)
                    }
                    placeholderTextColor="#9ca3af"
                  />
                  {errors.owner_name && (
                    <Text style={styles.errorText}>{errors.owner_name}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Mobile Number <Text style={{ color: "#dc2626" }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.mobile_number && { borderColor: "#dc2626" },
                    ]}
                    placeholder="Enter mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={surveyMetadata.mobile_number || ""}
                    onChangeText={(value) =>
                      handleSurveyMetadataChange("mobile_number", value)
                    }
                    placeholderTextColor="#9ca3af"
                  />
                  {errors.mobile_number && (
                    <Text style={styles.errorText}>{errors.mobile_number}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Aadhar Number <Text style={{ color: "#dc2626" }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.aadhar_number && { borderColor: "#dc2626" },
                    ]}
                    placeholder="Enter Aadhar number"
                    keyboardType="phone-pad"
                    maxLength={12}
                    value={surveyMetadata.aadhar_number || ""}
                    onChangeText={(value) =>
                      handleSurveyMetadataChange("aadhar_number", value)
                    }
                    placeholderTextColor="#9ca3af"
                  />
                  {errors.aadhar_number && (
                    <Text style={styles.errorText}>{errors.aadhar_number}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Occupation <Text style={{ color: "#dc2626" }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.occupation && { borderColor: "#dc2626" },
                    ]}
                    placeholder="Enter occupation"
                    value={surveyMetadata.occupation || ""}
                    onChangeText={(value) =>
                      handleSurveyMetadataChange("occupation", value)
                    }
                    placeholderTextColor="#9ca3af"
                  />
                  {errors.occupation && (
                    <Text style={styles.errorText}>{errors.occupation}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Disabled Person <Text style={{ color: "#dc2626" }}>*</Text>
                  </Text>
                  <View className="flex-row mb-3">
                    {["YES", "NO"].map((value) => (
                      <TouchableOpacity
                        key={value}
                        onPress={() =>
                          handleSurveyMetadataChange(
                            "is_disabled_person",
                            value,
                          )
                        }
                        className={`flex-1 p-3 border rounded-lg mx-1 ${
                          surveyMetadata.is_disabled_person === value
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        <Text
                          className={`text-center ${
                            surveyMetadata.is_disabled_person === value
                              ? "text-white font-semibold"
                              : "text-gray-700"
                          }`}
                        >
                          {value}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {errors.is_disabled_person && (
                    <Text style={styles.errorText}>
                      {errors.is_disabled_person}
                    </Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Father/Husband Name{" "}
                    <Text style={{ color: "#dc2626" }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.father_husband_name && {
                        borderColor: "#dc2626",
                      },
                    ]}
                    placeholder="Enter father/husband name"
                    value={surveyMetadata.father_husband_name || ""}
                    onChangeText={(value) =>
                      handleSurveyMetadataChange("father_husband_name", value)
                    }
                    placeholderTextColor="#9ca3af"
                  />
                  {errors.father_husband_name && (
                    <Text style={styles.errorText}>
                      {errors.father_husband_name}
                    </Text>
                  )}
                </View>
              </>
            ) : (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Property Address <Text style={{ color: "#dc2626" }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.address && { borderColor: "#dc2626" },
                    ]}
                    placeholder="Enter address"
                    value={surveyMetadata.address}
                    onChangeText={(value) =>
                      handleSurveyMetadataChange("address", value)
                    }
                    placeholderTextColor="#9ca3af"
                  />
                  {errors.address && (
                    <Text style={styles.errorText}>{errors.address}</Text>
                  )}
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Plot Area(sqm) <Text style={{ color: "#dc2626" }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.plot_area && { borderColor: "#dc2626" },
                    ]}
                    placeholder="Enter plot area"
                    value={surveyMetadata.plot_area}
                    onChangeText={(value) =>
                      handleSurveyMetadataChange("plot_area", value)
                    }
                    placeholderTextColor="#9ca3af"
                  />
                  {errors.plot_area && (
                    <Text style={styles.errorText}>{errors.plot_area}</Text>
                  )}
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Construction Type<Text style={{ color: "#dc2626" }}>*</Text>
                  </Text>
                  <View style={styles.formGroup}>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {["PUCCA", "SEMI_PUCCA", "KUCCHA"].map((status) => (
                        <TouchableOpacity
                          key={status}
                          onPress={() =>
                            handleSurveyMetadataChange(
                              "occupancy_status",
                              status,
                            )
                          }
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor:
                              surveyMetadata.occupancy_status === status
                                ? "#0f2d5c"
                                : "#f3f4f6",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              color:
                                surveyMetadata.occupancy_status === status
                                  ? "#fff"
                                  : "#374151",
                              fontWeight: "600",
                              fontSize: 13,
                            }}
                          >
                            {status}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {errors.occupancy_status && (
                      <Text style={styles.errorText}>
                        {errors.occupancy_status}
                      </Text>
                    )}
                  </View>
                  {errors.construction_type && (
                    <Text style={styles.errorText}>
                      {errors.construction_type}
                    </Text>
                  )}
                </View>
                {buildingType === "Residential" &&
                building_subtype === "SingleStory" ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Utility Connections</Text>
                    <View style={{ gap: 10 }}>
                      {[
                        { key: "water_connection", label: "Water Connection" },
                        { key: "sewer_connection", label: "Sewer Connection" },
                        { key: "gas_connection", label: "Gas Connection" },
                        { key: "solar_connection", label: "Solar Connection" },
                        {
                          key: "electricity_connection",
                          label: "Electricity Connection",
                        },
                      ].map(({ key, label }) => (
                        <TouchableOpacity
                          key={key}
                          onPress={() =>
                            handleSurveyMetadataChange(
                              key,
                              !surveyMetadata[key],
                            )
                          }
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor: "#f9fafb",
                            borderWidth: 1,
                            borderColor: "#d1d5db",
                          }}
                        >
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              borderWidth: 2,
                              borderColor: surveyMetadata[key]
                                ? "#0f2d5c"
                                : "#d1d5db",
                              backgroundColor: surveyMetadata[key]
                                ? "#0f2d5c"
                                : "#fff",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 10,
                            }}
                          >
                            {surveyMetadata[key] && (
                              <MaterialIcons
                                name="check"
                                size={14}
                                color="#fff"
                              />
                            )}
                          </View>
                          <Text style={{ fontSize: 14, color: "#374151" }}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            )}
            {showResidentialRoadDetails && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Property Road Details</Text>
                {roadSideOptions.map(({ side, title }) => (
                  <View key={side} style={styles.roadSideCard}>
                    <TouchableOpacity
                      onPress={() => toggleRoadSide(side)}
                      style={styles.roadSideToggle}
                    >
                      <MaterialIcons
                        name={
                          roadSidesState[side]
                            ? "check-box"
                            : "check-box-outline-blank"
                        }
                        size={22}
                        color={roadSidesState[side] ? "#065f46" : "#6b7280"}
                      />
                      <Text style={styles.roadSideTitle}>{title}</Text>
                    </TouchableOpacity>
                    {roadSidesState[side] && (
                      <>
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#374151",
                            marginBottom: 4,
                          }}
                        >
                          Road Type
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 6,
                            marginBottom: 8,
                          }}
                        >
                          {[
                            { value: "BITUMINOUS", label: "Bituminous" },
                            { value: "INTERLOCKING", label: "Interlocking" },
                            { value: "CC", label: "CC" },
                            { value: "KUCCHA", label: "Kuccha" },
                            { value: "KHADANJA", label: "Khadanja" },
                          ].map((type) => (
                            <TouchableOpacity
                              key={`${side}-type-${type.value}`}
                              onPress={() =>
                                handleRoadDetailChange(
                                  `road_type_${side}`,
                                  type.value,
                                )
                              }
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor:
                                  roadDetails[`road_type_${side}`] ===
                                  type.value
                                    ? "#0f2d5c"
                                    : "#d1d5db",
                                backgroundColor:
                                  roadDetails[`road_type_${side}`] ===
                                  type.value
                                    ? "#0f2d5c"
                                    : "#fff",
                                marginRight: 6,
                                marginBottom: 6,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "600",
                                  color:
                                    roadDetails[`road_type_${side}`] ===
                                    type.value
                                      ? "#fff"
                                      : "#374151",
                                }}
                              >
                                {type.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {errors[`road_type_${side}`] && (
                          <Text style={styles.errorText}>
                            {errors[`road_type_${side}`]}
                          </Text>
                        )}

                        <Text
                          style={{
                            fontSize: 12,
                            color: "#374151",
                            marginBottom: 4,
                          }}
                        >
                          Road Width
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 8,
                            marginBottom: 8,
                          }}
                        >
                          {["1_12M", "12_24M", "ABOVE_24M"].map((width) => (
                            <TouchableOpacity
                              key={`${side}-width-${width}`}
                              onPress={() =>
                                handleRoadDetailChange(
                                  `road_width_${side}`,
                                  width,
                                )
                              }
                              style={{
                                flex: 1,
                                paddingVertical: 8,
                                paddingHorizontal: 8,
                                borderRadius: 8,
                                alignItems: "center",
                                backgroundColor:
                                  roadDetails[`road_width_${side}`] === width
                                    ? "#0f2d5c"
                                    : "#f3f4f6",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "600",
                                  color:
                                    roadDetails[`road_width_${side}`] === width
                                      ? "#fff"
                                      : "#374151",
                                }}
                              >
                                {width.replace("_", "-").replace("M", "m")}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {errors[`road_width_${side}`] && (
                          <Text style={styles.errorText}>
                            {errors[`road_width_${side}`]}
                          </Text>
                        )}

                        <Text style={styles.label}>
                          Carriageway (m)
                        </Text>
                        <TextInput
                          style={[
                            styles.input,
                            errors[`carriageway_area_${side}`] && {
                              borderColor: "#dc2626",
                            },
                          ]}
                          placeholder={`Enter ${title} carriageway in metres`}
                          value={roadDetails[`carriageway_area_${side}`]}
                          onChangeText={(value) =>
                            handleRoadDetailChange(
                              `carriageway_area_${side}`,
                              value,
                            )
                          }
                          keyboardType="numeric"
                          placeholderTextColor="#9ca3af"
                        />
                        {errors[`carriageway_area_${side}`] && (
                          <Text style={styles.errorText}>
                            {errors[`carriageway_area_${side}`]}
                          </Text>
                        )}

                        <Text style={styles.label}>Footpath (m)</Text>
                        <TextInput
                          style={[
                            styles.input,
                            errors[`footpath_area_${side}`] && {
                              borderColor: "#dc2626",
                            },
                          ]}
                          placeholder={`Enter ${title} footpath in metres`}
                          value={roadDetails[`footpath_area_${side}`]}
                          onChangeText={(value) =>
                            handleRoadDetailChange(
                              `footpath_area_${side}`,
                              value,
                            )
                          }
                          keyboardType="numeric"
                          placeholderTextColor="#9ca3af"
                        />
                        {errors[`footpath_area_${side}`] && (
                          <Text style={styles.errorText}>
                            {errors[`footpath_area_${side}`]}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Building Info (Read-only display) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Building Information</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Floor No. Including Ground Floor</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter number of floors above ground"
                keyboardType="numeric"
                value={surveyMetadata.floors_above_ground}
                onChangeText={(value) =>
                  handleSurveyMetadataChange("floors_above_ground", value)
                }
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Floor No. Including Below (Basement) Floor
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter number of floors below ground"
                keyboardType="numeric"
                value={surveyMetadata.floors_below_ground}
                onChangeText={(value) =>
                  handleSurveyMetadataChange("floors_below_ground", value)
                }
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Built-up Area(sq.mt)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter built-up area"
                keyboardType="numeric"
                value={surveyMetadata.total_builtup_area}
                onChangeText={(value) =>
                  handleSurveyMetadataChange("total_builtup_area", value)
                }
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* Floor & Unit Details */}
          {renderFloorSections()}

          {/* Survey Images */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Survey Images</Text>
            <Text style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
              Images captured during survey creation
            </Text>

            {survey?.SurveyImages?.length > 0 ||
            newImages.some((_, index) => !removedNewImageIndices.has(index)) ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 8 }}
                >
                  {survey?.SurveyImages?.map((image, index) => (
                    <View
                      key={image.id || index}
                      style={{
                        marginRight: 12,
                        width: 200,
                        backgroundColor: "#f9fafb",
                        borderRadius: 8,
                        padding: 8,
                        borderWidth: 1,
                        borderColor: "#d1d5db",
                        position: "relative",
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => removePhoto(image.id)}
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          backgroundColor: "#ef4444",
                          borderRadius: 12,
                          width: 28,
                          height: 28,
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 10,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 3,
                          elevation: 5,
                        }}
                      >
                        {deletingImageId === image.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <MaterialIcons name="delete" size={16} color="#fff" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setImageViewerIndex(index);
                          setIsImageViewerVisible(true);
                        }}
                      >
                        <Image
                          source={{ uri: image.image_url }}
                          style={{
                            width: "100%",
                            height: 150,
                            borderRadius: 6,
                            backgroundColor: "#e5e7eb",
                            marginTop: 8,
                          }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                      <View style={{ marginTop: 8 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#6b7280",
                            fontWeight: "600",
                          }}
                        >
                          Image {index + 1}
                        </Text>
                        {image.image_timestamp && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginBottom: 2,
                            }}
                          >
                            <MaterialIcons
                              name="schedule"
                              size={12}
                              color="#6b7280"
                            />
                            <Text
                              style={{
                                fontSize: 10,
                                color: "#6b7280",
                                marginLeft: 4,
                              }}
                            >
                              {new Date(image.image_timestamp).toLocaleString()}
                            </Text>
                          </View>
                        )}
                        {image.latitude && image.longitude && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <MaterialIcons
                              name="location-on"
                              size={12}
                              color="#6b7280"
                            />
                            <Text
                              style={{
                                fontSize: 10,
                                color: "#6b7280",
                                marginLeft: 4,
                              }}
                            >
                              {`Lat: ${image.latitude.toFixed(4)}, Lng: ${image.longitude.toFixed(4)}`}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                  {newImages.map((image, index) => {
                    // Skip removed images from rendering
                    if (removedNewImageIndices.has(index)) return null;
                    return (
                      <View
                        key={`new-${index}`}
                        style={{
                          marginRight: 12,
                          width: 200,
                          backgroundColor: "#f9fafb",
                          borderRadius: 8,
                          padding: 8,
                          borderWidth: 1,
                          borderColor: "#d1d5db",
                          position: "relative",
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => removeNewImage(index)}
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            backgroundColor: "#ef4444",
                            borderRadius: 12,
                            width: 28,
                            height: 28,
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 10,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 3,
                            elevation: 5,
                          }}
                        >
                          <MaterialIcons name="delete" size={16} color="#fff" />
                        </TouchableOpacity>
                        <Image
                          source={{ uri: image.uri }}
                          style={{
                            width: "100%",
                            height: 150,
                            borderRadius: 6,
                            backgroundColor: "#e5e7eb",
                            marginTop: 8,
                          }}
                          resizeMode="cover"
                        />
                        <View style={{ marginTop: 8 }}>
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#6b7280",
                              fontWeight: "600",
                            }}
                          >
                            New Image
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: "#10b981",
                              marginTop: 2,
                              fontWeight: "500",
                            }}
                          >
                            Ready to upload
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  onPress={pickImage}
                  disabled={uploading}
                  style={{
                    marginTop: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    backgroundColor: "#0f2d5c",
                    borderRadius: 8,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialIcons name="add-a-photo" size={18} color="#fff" />
                  )}
                  <Text
                    style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}
                  >
                    {uploading ? "Uploading..." : "Add More Images"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={pickImage}
                disabled={uploading}
                style={{
                  marginTop: 16,
                  paddingVertical: 20,
                  paddingHorizontal: 16,
                  backgroundColor: uploading ? "#e5e7eb" : "#f3f4f6",
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: "#d1d5db",
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                {uploading ? (
                  <ActivityIndicator size="large" color="#0f2d5c" />
                ) : (
                  <MaterialIcons
                    name="image-not-supported"
                    size={32}
                    color="#9ca3af"
                  />
                )}
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    color: uploading ? "#9ca3af" : "#6b7280",
                    fontWeight: "600",
                  }}
                >
                  {uploading ? "Selecting Images..." : "No Images Yet"}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "#9ca3af",
                    marginBottom: 8,
                  }}
                >
                  {uploading ? "Loading..." : "Tap to add survey images"}
                </Text>
                <TouchableOpacity
                  onPress={pickImage}
                  disabled={uploading}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    backgroundColor: uploading ? "#9ca3af" : "#0f2d5c",
                    borderRadius: 6,
                    marginTop: 8,
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}
                  >
                    {uploading ? "Selecting..." : "Upload Images"}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            <Modal
              visible={isImageViewerVisible && hasViewerImages}
              transparent
              animationType="fade"
              onRequestClose={onRequestClose}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 16,
                }}
              >
                <TouchableOpacity
                  onPress={onRequestClose}
                  style={{
                    position: "absolute",
                    top: 48,
                    right: 20,
                    zIndex: 2,
                    backgroundColor: "rgba(0,0,0,0.45)",
                    borderRadius: 20,
                    padding: 6,
                  }}
                >
                  <MaterialIcons name="close" size={24} color="#fff" />
                </TouchableOpacity>

                {activeViewerImage && (
                  <Image
                    source={{ uri: activeViewerImage.image_url }}
                    style={{
                      width: "100%",
                      height: "78%",
                      borderRadius: 12,
                      backgroundColor: "#111827",
                    }}
                    resizeMode="contain"
                  />
                )}

                <View
                  style={{
                    marginTop: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      setImageViewerIndex((prev) => Math.max(prev - 1, 0))
                    }
                    disabled={imageViewerIndex <= 0}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor:
                        imageViewerIndex <= 0 ? "#4b5563" : "#0f2d5c",
                      marginRight: 10,
                    }}
                  >
                    <MaterialIcons name="chevron-left" size={22} color="#fff" />
                  </TouchableOpacity>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    {hasViewerImages ? imageViewerIndex + 1 : 0}/
                    {ViewerImages.length}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setImageViewerIndex((prev) =>
                        Math.min(prev + 1, ViewerImages.length - 1),
                      )
                    }
                    disabled={imageViewerIndex >= ViewerImages.length - 1}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor:
                        imageViewerIndex >= ViewerImages.length - 1
                          ? "#4b5563"
                          : "#0f2d5c",
                      marginLeft: 10,
                    }}
                  >
                    <MaterialIcons
                      name="chevron-right"
                      size={22}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={
                isSingleStory ? handleSingleStoryUpdate : handleMultyStoryUpdate
              }
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="save" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={() => router.back()}
              disabled={isUpdating}
            >
              <MaterialIcons name="close" size={18} color="#1f2937" />
              <Text
                style={[
                  styles.actionButtonText,
                  styles.actionButtonTextSecondary,
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Add New Unit Modal */}
        <Modal
          visible={isAddUnitModalVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setIsAddUnitModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
            {/* Modal Header */}
            <View
              style={{
                backgroundColor: "#0f2d5c",
                paddingTop: 60,
                paddingBottom: 20,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "800",
                  color: "#fff",
                  letterSpacing: 0.5,
                }}
              >
                Add New Unit
              </Text>
              <TouchableOpacity
                onPress={() => setIsAddUnitModalVisible(false)}
                style={{
                  padding: 8,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.2)",
                }}
              >
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1, padding: 20 }}
              showsVerticalScrollIndicator={false}
            >
        
              {/* Unit Address */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Unit Address <Text style={{ color: "#dc2626" }}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter unit address"
                  value={newUnitData.unit_address}
                  onChangeText={(value) =>
                    setNewUnitData((prev) => ({ ...prev, unit_address: value }))
                  }
                  placeholderTextColor="#9ca3af"
                />
              </View>

              {/* Carpet Area */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Carpet Area (sq.mt){" "}
                  <Text style={{ color: "#dc2626" }}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter carpet area"
                  value={newUnitData.carpet_area}
                  onChangeText={(value) =>
                    setNewUnitData((prev) => ({ ...prev, carpet_area: value }))
                  }
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              {/* Construction Year */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Construction Year <Text style={{ color: "#dc2626" }}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter construction year"
                  value={newUnitData.construction_year}
                  onChangeText={(value) =>
                    setNewUnitData((prev) => ({
                      ...prev,
                      construction_year: value,
                    }))
                  }
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              {/* Occupancy Status */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Occupancy Status</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {["Self", "Rented", "SelfRented", "Vacant"].map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          occupancy_status: status,
                        }))
                      }
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor:
                          newUnitData.occupancy_status === status
                            ? "#0f2d5c"
                            : "#f3f4f6",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            newUnitData.occupancy_status === status
                              ? "#fff"
                              : "#374151",
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {status}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {newUnitData.occupancy_status === "SelfRented" ? (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>
                      Self Area (sq.mt){" "}
                      <Text style={{ color: "#dc2626" }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter self area"
                      value={newUnitData.self_area}
                      onChangeText={(value) =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          self_area: value,
                        }))
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>
                      Rented Area (sq.mt){" "}
                      <Text style={{ color: "#dc2626" }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter rented area"
                      value={newUnitData.rented_area}
                      onChangeText={(value) =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          rented_area: value,
                        }))
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </>
              ) : (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Area(sq.mt) <Text style={{ color: "#dc2626" }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter area"
                    value={newUnitData.area}
                    onChangeText={(value) =>
                      setNewUnitData((prev) => ({
                        ...prev,
                        area: value,
                      }))
                    }
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              )}

              {/* Owner Details */}
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#0f2d5c",
                  marginTop: 20,
                  marginBottom: 12,
                }}
              >
                Owner Details
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Owner Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter owner name"
                  value={newUnitData.owner_name}
                  onChangeText={(value) =>
                    setNewUnitData((prev) => ({ ...prev, owner_name: value }))
                  }
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Owner Mobile</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter owner mobile"
                  value={newUnitData.owner_mobile}
                  onChangeText={(value) =>
                    setNewUnitData((prev) => ({ ...prev, owner_mobile: value }))
                  }
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Aadhar Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter Aadhar number"
                  value={newUnitData.owner_adhar}
                  onChangeText={(value) =>
                    setNewUnitData((prev) => ({
                      ...prev,
                      owner_adhar: value,
                    }))
                  }
                  keyboardType="phone-pad"
                  maxLength={12}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Owner Occupation</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter owner occupation"
                  value={newUnitData.owner_occupation}
                  onChangeText={(value) =>
                    setNewUnitData((prev) => ({
                      ...prev,
                      owner_occupation: value,
                    }))
                  }
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Disabled Person</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {["YES", "NO"].map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          disabled_person: status,
                        }))
                      }
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor:
                          newUnitData.disabled_person === status
                            ? "#0f2d5c"
                            : "#f3f4f6",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            newUnitData.disabled_person === status
                              ? "#fff"
                              : "#374151",
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {status}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Father/Husband Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter father/husband name"
                  value={newUnitData.father_or_husband_name}
                  onChangeText={(value) =>
                    setNewUnitData((prev) => ({
                      ...prev,
                      father_or_husband_name: value,
                    }))
                  }
                  placeholderTextColor="#9ca3af"
                />
              </View>

              {/* Rented Fields */}
              {isRentedLikeOccupancy(newUnitData.occupancy_status) && (
                <>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "#0f2d5c",
                      marginTop: 20,
                      marginBottom: 12,
                    }}
                  >
                    Occupier Details
                  </Text>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Occupier Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter occupier name"
                      value={newUnitData.occupant_name}
                      onChangeText={(value) =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          occupant_name: value,
                        }))
                      }
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Occupier Mobile</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter occupier mobile"
                      value={newUnitData.occupant_mobile}
                      onChangeText={(value) =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          occupant_mobile: value,
                        }))
                      }
                      keyboardType="phone-pad"
                      maxLength={10}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Monthly Rent Amount (₹)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter monthly rent"
                      value={newUnitData.rent_amount}
                      onChangeText={(value) =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          rent_amount: value,
                        }))
                      }
                      keyboardType="numeric"
                      maxLength={8}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </>
              )}

              {/* Utilities */}
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#0f2d5c",
                  marginTop: 20,
                  marginBottom: 12,
                }}
              >
                Utilities
              </Text>

              <View style={{ flexDirection: "column", gap: 12 }}>
                {[
                  {
                    key: "electricity_connection",
                    label: "Electricity Connection",
                  },
                  {
                    key: "water_connection",
                    label: "Water Connection",
                  },
                  {
                    key: "sewer_connection",
                    label: "Sewer Connection",
                  },
                  {
                    key: "gas_connection",
                    label: "Gas Connection",
                  },
                  {
                    key: "internet_connection",
                    label: "Internet Connection",
                  },
                ].map(({ key, label }) => (
                  <View key={key} style={styles.formGroup}>
                    <TouchableOpacity
                      onPress={() =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: "#f9fafb",
                        borderWidth: 1,
                        borderColor: newUnitData[key] ? "#0f2d5c" : "#d1d5db",
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: newUnitData[key] ? "#0f2d5c" : "#d1d5db",
                          backgroundColor: newUnitData[key]
                            ? "#0f2d5c"
                            : "#fff",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 10,
                        }}
                      >
                        {newUnitData[key] && (
                          <MaterialIcons name="check" size={14} color="#fff" />
                        )}
                      </View>
                      <Text style={{ color: "#374151" }}>{label}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Kitchen */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Has Kitchen</Text>
                <TouchableOpacity
                  onPress={() =>
                    setNewUnitData((prev) => ({
                      ...prev,
                      has_kitchen: !prev.has_kitchen,
                    }))
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: "#f9fafb",
                    borderWidth: 1,
                    borderColor: newUnitData.has_kitchen
                      ? "#0f2d5c"
                      : "#d1d5db",
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: newUnitData.has_kitchen
                        ? "#0f2d5c"
                        : "#d1d5db",
                      backgroundColor: newUnitData.has_kitchen
                        ? "#0f2d5c"
                        : "#fff",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    {newUnitData.has_kitchen && (
                      <MaterialIcons name="check" size={14} color="#fff" />
                    )}
                  </View>
                  <Text style={{ color: "#374151" }}>Has Kitchen</Text>
                </TouchableOpacity>
              </View>

              {newUnitData.has_kitchen && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Kitchen Count</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter kitchen count"
                      value={newUnitData.kitchen_count}
                      onChangeText={(value) =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          kitchen_count: value,
                        }))
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Kitchen Area (sq.mt)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter kitchen area"
                      value={newUnitData.kitchen_area}
                      onChangeText={(value) =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          kitchen_area: value,
                        }))
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </>
              )}

              {/* Toilet */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Has Toilet</Text>
                <TouchableOpacity
                  onPress={() =>
                    setNewUnitData((prev) => ({
                      ...prev,
                      has_toilet: !prev.has_toilet,
                    }))
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: "#f9fafb",
                    borderWidth: 1,
                    borderColor: newUnitData.has_toilet ? "#0f2d5c" : "#d1d5db",
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: newUnitData.has_toilet
                        ? "#0f2d5c"
                        : "#d1d5db",
                      backgroundColor: newUnitData.has_toilet
                        ? "#0f2d5c"
                        : "#fff",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    {newUnitData.has_toilet && (
                      <MaterialIcons name="check" size={14} color="#fff" />
                    )}
                  </View>
                  <Text style={{ color: "#374151" }}>Has Toilet</Text>
                </TouchableOpacity>
              </View>

              {newUnitData.has_toilet && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Toilet Count</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter toilet count"
                      value={newUnitData.toilet_count}
                      onChangeText={(value) =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          toilet_count: value,
                        }))
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Toilet Area (sq.mt)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter toilet area"
                      value={newUnitData.toilet_area}
                      onChangeText={(value) =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          toilet_area: value,
                        }))
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </>
              )}

              {/* Parking */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Has Parking</Text>
                <TouchableOpacity
                  onPress={() =>
                    setNewUnitData((prev) => ({
                      ...prev,
                      has_parking: !prev.has_parking,
                    }))
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: "#f9fafb",
                    borderWidth: 1,
                    borderColor: newUnitData.has_parking
                      ? "#0f2d5c"
                      : "#d1d5db",
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: newUnitData.has_parking
                        ? "#0f2d5c"
                        : "#d1d5db",
                      backgroundColor: newUnitData.has_parking
                        ? "#0f2d5c"
                        : "#fff",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    {newUnitData.has_parking && (
                      <MaterialIcons name="check" size={14} color="#fff" />
                    )}
                  </View>
                  <Text style={{ color: "#374151" }}>Has Parking</Text>
                </TouchableOpacity>
              </View>

              {newUnitData.has_parking && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Parking Type</Text>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      {["NONE", "OPEN", "COVERED"].map((type) => (
                        <TouchableOpacity
                          key={type}
                          onPress={() =>
                            setNewUnitData((prev) => ({
                              ...prev,
                              parking_type: type,
                            }))
                          }
                          style={{
                            flex: 1,
                            minWidth: "40%",
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor:
                              newUnitData.parking_type === type
                                ? "#0f2d5c"
                                : "#f3f4f6",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              color:
                                newUnitData.parking_type === type
                                  ? "#fff"
                                  : "#374151",
                              fontWeight: "600",
                              fontSize: 12,
                            }}
                          >
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Parking Area</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter parking area"
                      value={newUnitData.parking_area}
                      onChangeText={(value) =>
                        setNewUnitData((prev) => ({
                          ...prev,
                          parking_area: value,
                        }))
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </>
              )}

              <View style={styles.photoSection}>
                <Text className="text-xl font-bold mb-3 mt-4">
                  Units Photos
                </Text>
                <Text className="text-gray-600 mb-3">
                  Add at least one photo before continuing
                </Text>

                <View className="flex-row mb-4">
                  <TouchableOpacity
                    onPress={() => pickImages()}
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
                    onPress={() => capturePhoto()}
                    className="bg-green-600 p-3 rounded-lg flex-1 ml-2 flex-row items-center justify-center"
                  >
                    <MaterialIcons name="camera-alt" size={20} color="white" />
                    <Text className="text-white font-semibold ml-2">
                      Camera
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="mb-3">
                  {(() => {
                    const selectedPhotos = Array.isArray(newUnitData.photos)
                      ? newUnitData.photos
                      : [];

                    return (
                      <>
                        <Text className="font-semibold mb-2">
                          {selectedPhotos.length} photo(s) selected
                        </Text>

                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                        >
                          {selectedPhotos.map((photo, localIndex) => {
                            const uri = photo.uri || getImageUrl(photo) || "";
                            return (
                              <View
                                key={photo.uri ?? localIndex}
                                className="bg-white border border-gray-200 rounded-xl p-2 mr-3"
                              >
                                <Image
                                  source={{ uri }}
                                  className="w-40 h-64 rounded-lg mb-2"
                                  resizeMode="cover"
                                />

                                <TouchableOpacity
                                  onPress={() => {
                                    setNewUnitData((prev) => ({
                                      ...prev,
                                      photos: Array.isArray(prev.photos)
                                        ? prev.photos.filter(
                                            (_, i) => i !== localIndex,
                                          )
                                        : [],
                                    }));
                                  }}
                                  className="bg-red-500 p-2 rounded-lg"
                                >
                                  <Text className="text-white text-center text-sm">
                                    Remove
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </ScrollView>
                      </>
                    );
                  })()}
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={() => handleAddNewUnit(currentFloorForNewUnit)}
                disabled={isAddingUnit}
                style={{
                  marginTop: 30,
                  marginBottom: 50,
                  paddingVertical: 15,
                  borderRadius: 10,
                  backgroundColor: "#0f2d5c",
                  alignItems: "center",
                }}
              >
                {isAddingUnit ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: 16,
                    }}
                  >
                    Submit New Unit
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      </View>
      <Toast />
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  headerContainer: {
    backgroundColor: "#0f2d5c",
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1f2937",
    flex: 1,
    textAlign: "right",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1f2937",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginTop: 6,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  backButton: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f2d5c",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#e5e7eb",
  },
  formGroup: {
    marginBottom: 14,
  },
  textAreaInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    paddingBottom: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#0f2d5c",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  actionButtonSecondary: {
    backgroundColor: "#e5e7eb",
  },
  actionButtonDanger: {
    backgroundColor: "#ef4444",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  actionButtonTextSecondary: {
    color: "#1f2937",
  },
  errorText: {
    fontSize: 12,
    color: "#dc2626",
    marginTop: 4,
  },
  roadSideCard: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  roadSideToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  roadSideTitle: {
    fontWeight: "700",
    color: "#0f2d5c",
    marginLeft: 10,
  },
  photoSection: {
    marginTop: 16,
  },
  photoGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },
  photoCard: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  unitDetailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  photoCardImage: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    marginBottom: 8,
  },
  photoCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
    textAlign: "center",
  },
  photoUploadButton: {
    backgroundColor: "#0f2d5c",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  photoUploadButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  photoRemoveButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#9ca3af",
    fontStyle: "italic",
  },
});
