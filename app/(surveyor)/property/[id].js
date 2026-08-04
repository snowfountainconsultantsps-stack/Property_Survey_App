import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
// import { useDispatch } from "react-redux";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { BACKEND_IP, BACKEND_PORT } from "../../../config";
import {
  useGetPropertyPhotosQuery,
  useGetSurveyQuery,
} from "../../../services/surveyApi";
// import { clearAuth } from "../../../store/authSlice";
import SurveyDetailsSkeleton from "../../../components/skeleton/SurveyDetailsSkeleton";

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
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  unitDetailsHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f2d5c",
    marginBottom: 10,
  },
  unitList: {
    maxHeight: 320,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
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
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginVertical: 10,
  },
  statusBadgeActive: {
    backgroundColor: "#fef3c7",
  },
  statusBadgeCompleted: {
    backgroundColor: "#d1fae5",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  statusTextActive: {
    color: "#b45309",
  },
  statusTextCompleted: {
    color: "#065f46",
  },
  headerInfo: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#0f2d5c",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  surveyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f2d5c",
    marginBottom: 8,
  },
  surveySubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 12,
  },
  propertyCodeChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  propertyCodeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8",
    marginLeft: 4,
    marginRight: 8,
  },
  propertyCodeValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f2d5c",
    letterSpacing: 1,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  infoItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#f9fafb",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  infoItemIcon: {
    marginBottom: 4,
  },
  infoItemLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
    marginBottom: 2,
  },
  infoItemValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f2d5c",
    textAlign: "center",
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
  actionButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  actionButtonTextSecondary: {
    color: "#1f2937",
  },
  emptyText: {
    fontSize: 13,
    color: "#9ca3af",
    fontStyle: "italic",
  },
});

export default function SurveyDetail() {
  const router = useRouter();
  //   const dispatch = useDispatch();
  const { id, type } = useLocalSearchParams();

  const [isImageViewerVisible, setIsImageViewerVisible] = React.useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [isRoadSectionOpen, setIsRoadSectionOpen] = useState(false);
  // Use single survey query from surveyApi
  const {
    data: surveyData,
    isLoading,
    error,
  } = useGetSurveyQuery(id, {
    skip: !id,
  });

  const {
    data: propertyPhotosData = [],
    isLoading: isPhotosLoading,
    error: photosError,
  } = useGetPropertyPhotosQuery(surveyData?.Property?.id, {
    skip: !surveyData?.Property?.id,
  });

  const surveyDetail = surveyData;
  const property = surveyDetail?.Property || {};
  const resolveImageUri = (imageUrl) => {
    if (!imageUrl) return null;
    if (
      imageUrl.startsWith("http://") ||
      imageUrl.startsWith("https://") ||
      imageUrl.startsWith("file://")
    ) {
      return imageUrl;
    }
    const normalizedPath = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    return `http://${BACKEND_IP}:${BACKEND_PORT}${normalizedPath}`;
  };

  const getImageUrl = (image) => {
    // Try different possible field names for image URL
    return (
      image?.image_url ||
      image?.url ||
      image?.photo_url ||
      image?.imagePath ||
      image?.path ||
      null
    );
  };

  const PropertyPhoto = Array.isArray(surveyDetail?.Property?.PropertyPhotos)
    ? surveyDetail.Property.PropertyPhotos
    : [];
  //console.log("Property Photo:", surveyDetail?.Property?.PropertyPhotos);
  const PropertyOwnerPhotos = Array.isArray(
    surveyDetail?.Property?.PropertyOwners,
  )
    ? surveyDetail.Property.PropertyOwners.flatMap((owner) =>
        Array.isArray(owner?.PropertyPhotos) ? owner.PropertyPhotos : [],
      )
    : [];
  //console.log("Property Photos:", PropertyPhoto);
  // console.log("Property Owner Photos:", PropertyOwnerPhotos);
  // console.log("Property Owner Photo:", surveyDetail?.Property?.PropertyOwners);

  const allPropertyPhotos = [...PropertyPhoto, ...PropertyOwnerPhotos];
  //console.log("All Property Photos:", allPropertyPhotos);

  const allUnitPhotos =
    surveyDetail?.Property?.Building?.Floors?.flatMap(
      (floor) =>
        floor.Units?.flatMap((unit) =>
          Array.isArray(unit?.UnitPhotos) ? unit.UnitPhotos : [],
        ) || [],
    ) || [];
  //console.log("All Unit Photos:", allUnitPhotos);
  const allUnitsPhotoswithPropertyPhotos = [
    ...allPropertyPhotos,
    ...allUnitPhotos,
  ];
  //console.log("All Units & Property Photos:", allUnitsPhotoswithPropertyPhotos);

  const building = property?.Building || {};
  //console.log("Building Data:", building);
  const propertyUtilities = property?.PropertyUtility || {};
  const propertyRoads = Array.isArray(property?.PropertyRoads)
    ? property.PropertyRoads
    : [];
  const propertyOwners = Array.isArray(property?.PropertyOwners)
    ? property.PropertyOwners
    : [];

  const compareFloorNumbers = (a, b) => {
    if (a < 0 && b < 0) return b - a;
    if (a < 0) return -1;
    if (b < 0) return 1;
    return a - b;
  };

  const floors = Array.isArray(building?.Floors)
    ? [...building.Floors].sort((a, b) =>
        compareFloorNumbers(
          Number(a.floor_number || 0),
          Number(b.floor_number || 0),
        ),
      )
    : [];
  //console.log("Floors:", floors);

  // Floor FloorUtilities
  const floorUtilities = floors.flatMap((floor) =>
    (floor?.FloorUtilities || []).map((utility) => ({
      ...utility,
      floor_number: utility?.floor_number ?? floor?.floor_number,
    })),
  );
  // console.log("Floor Utilities:", floorUtilities);

  const floorUnitsFromFloors = floors.flatMap((floor) =>
    (floor?.Units || []).map((unit) => ({
      ...unit,
      floor_number: unit?.floor_number ?? floor?.floor_number,
    })),
  );
  const propertyUnits = Array.isArray(building?.PropertyUnits)
    ? building.PropertyUnits
    : [];

  const units = [
    ...new Map(
      [...propertyUnits, ...floorUnitsFromFloors].map((unit) => {
        const key = unit?.id
          ? String(unit.id)
          : `${unit?.floor_number ?? ""}_${unit?.unit_number ?? ""}_${unit?.unit_address ?? ""}`;
        return [key, unit];
      }),
    ).values(),
  ];

  const groupedUnitsByFloor = units.reduce((acc, unit) => {
    const floorNumber = Number(
      unit?.floor_number ?? unit?.Floor?.floor_number ?? 0,
    );
    const key = Number.isNaN(floorNumber) ? 0 : floorNumber;
    acc[key] = acc[key] || [];
    acc[key].push(unit);
    return acc;
  }, {});

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

  const renderValue = (value) =>
    value === 0
      ? "0"
      : value === false
        ? "No"
        : value || value === ""
          ? String(value)
          : "N/A";

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
    if (obj?.UnitUtilities?.[0]?.[path] !== undefined) {
      return obj.UnitUtilities[0][path];
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
      unit?.UnitUtilities?.[0]?.[field],
      unit?.UnitUtility?.[field],
      unit?.[field.replace(/sqmt$/, "_sqmt")],
      unit?.[field.replace(/_sqmt$/, "")],
    ];
    return candidates.find((value) => value !== undefined && value !== null);
  };

  const getUnitOwnerRecord = (unit) => {
    if (Array.isArray(unit?.UnitOwners) && unit.UnitOwners.length > 0) {
      return unit.UnitOwners[0];
    }
    return unit?.UnitOwner || {};
  };

  const getUnitUtilityRecord = (unit) => {
    if (Array.isArray(unit?.UnitUtilities) && unit.UnitUtilities.length > 0) {
      return unit.UnitUtilities[0];
    }
    return unit?.UnitUtility || unit?.UnitDetails || {};
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

  const getUnitUtilityValue = (unit, field) => {
    const utility = getUnitUtilityRecord(unit);
    return (
      utility?.[field] ??
      unit?.[field] ??
      unit?.UnitDetails?.[field] ??
      unit?.UnitDetails?.type_specific_attributes?.[field]
    );
  };

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

  const roadSides = [
    { side: "front", title: "Front Side Road" },
    { side: "back", title: "Back Side Road" },
    { side: "left", title: "Left Side Road" },
    { side: "right", title: "Right Side Road" },
  ];

  const buildRoadSection = ({ side, title }) => {
    const roadItem = propertyRoadsBySection[side];
    const road_type =
      property[`road_type_${side}`] || roadItem?.road_type || roadItem?.type;
    const road_width =
      property[`road_width_${side}`] || roadItem?.road_width || roadItem?.width;
    const carriageway_area =
      property[`carriageway_area_${side}`] ||
      roadItem?.carriageway_area ||
      roadItem?.carriagewayArea;
    const footpath_area =
      property[`footpath_area_${side}`] ||
      roadItem?.footpath_area ||
      roadItem?.footpathArea;

    return {
      side,
      title,
      road_type,
      road_width,
      carriageway_area,
      footpath_area,
    };
  };

  const roadSections = roadSides
    .map(buildRoadSection)
    .filter(
      ({ road_type, road_width, carriageway_area, footpath_area }) =>
        road_type || road_width || carriageway_area || footpath_area,
    );

  const getUtilityStatus = (fieldNames) => {
    for (const field of fieldNames) {
      const value = propertyUtilities?.[field];
      if (value !== undefined && value !== null) return value;
    }
    return false;
  };

  const plotArea = property.plot_area_sqmt || property.plot_area || "N/A";
  //   const handleLogout = () => {
  //     dispatch(clearAuth());
  //     router.push("/");
  //   };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case "active":
      case "in_progress":
      case "inprogress":
        return styles.statusBadgeActive;
      case "completed":
      case "approved":
        return styles.statusBadgeCompleted;
      default:
        return {};
    }
  };

  const getStatusTextStyle = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case "active":
      case "in_progress":
      case "inprogress":
        return styles.statusTextActive;
      case "completed":
      case "approved":
        return styles.statusTextCompleted;
      default:
        return {};
    }
  };
  const getStatusLabel = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case "active":
      case "in_progress":
      case "inprogress":
        return "In Progress";
      case "pending":
        return "Pending";
      case "completed":
      case "approved":
        return "Completed";
      default:
        return status || "Unknown";
    }
  };

  const ViewerImages = propertyPhotosData;
  const onRequestClose = () => setIsImageViewerVisible(false);
  const hasViewerImages = ViewerImages.length > 0;
  const activeViewerImage = hasViewerImages
    ? ViewerImages[Math.min(imageViewerIndex, ViewerImages.length - 1)]
    : null;
  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={["SURVEYOR"]}>
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Survey Detail</Text>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <SurveyDetailsSkeleton />
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
              <Text style={styles.headerTitle}>Survey Detail</Text>
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
              {error?.data?.message || "Failed to load survey details"}
            </Text>
          </View>
        </View>
      </ProtectedRoute>
    );
  }

  const survey = surveyDetail?.survey;

  const building_type = String(property.property_type || "Unknown");
  const building_subtype = String(property.property_subtype || "Unknown");
  const isResidential = building_type.toLowerCase() === "residential";
  const isSingleStory =
    isResidential && building_subtype.toLowerCase().includes("single");
  const isMultiStory =
    isResidential && building_subtype.toLowerCase().includes("multi");

  const status = surveyDetail?.status || "unknown";
  //console.log("Total Floors found:", surveyDetail?.Property?.Building?.Floors?.length);
  const FloorOccupancy =
    surveyDetail?.Property?.Building?.Floors?.map(
      (floor) => floor.FloorOccupancy || "N/A",
    ) ||
    [] ||
    "unknown";
  // console.log("FloorOccupancy Status:", FloorOccupancy);

  const title = propertyOwners?.[0]?.owner_name || survey?.title || "Survey";
  const propertyCode =
    surveyDetail?.property_code ||
    property?.property_code ||
    surveyDetail?.PropertyDetails?.property_code ||
    "";
  const createdDate = property.survey_date
    ? new Date(property.survey_date).toLocaleDateString()
    : "N/A";

  const renderUnitDetails = (unit, index) => {
    const unitNumber =
      getUnitValue(unit, "unit_number") || unit?.unit_number || index + 1;
    const unitAddress =
      getUnitValue(unit, "unit_address") || unit?.unit_address;
    const constructionYear =
      getUnitValue(unit, "construction_year") || unit?.construction_year;
    const carpetArea =
      getUnitValue(unit, "carpet_area") ||
      getUnitValue(unit, "carpet_area_sqmt") ||
      getUnitValue(unit, "unit_area_sqmt");
    const occupancyStatus =
      getUnitValue(unit, "occupancy_status") || unit?.occupancy_status || "N/A";
    const normalizedStatus = String(occupancyStatus).toLowerCase();
    const showOccupierDetails =
      normalizedStatus === "rented" || normalizedStatus === "selfrented";
    const showOwnerDetails =
      normalizedStatus === "self" || normalizedStatus === "selfrented";

    const ownerName =
      getUnitOwnerValue(unit, "owner_name") ||
      getUnitValue(unit, "owner_name") ||
      unit?.owner_name;
    const ownerMobile =
      getUnitOwnerValue(unit, "mobile") ||
      getUnitOwnerValue(unit, "mobile_number") ||
      getUnitValue(unit, "mobile_number") ||
      unit?.mobile_number;
    const ownerOccupation =
      getUnitOwnerValue(unit, "occupation") || unit?.owner_occupation;
    const disabledPerson =
      getUnitOwnerValueFromFields(unit, [
        "disabled_person",
        "is_disabled_person",
      ]) ??
      unit?.disabled_person ??
      unit?.is_disabled_person;

    const fatherHusbandName =
      getUnitOwnerValue(unit, "father_or_husband_name") ||
      unit?.father_or_husband_name;
    const aadharNumber =
      getUnitOwnerValue(unit, "aadhar") ||
      getUnitOwnerValue(unit, "aadhar_number") ||
      unit?.aadhar_number;
    const occupierName =
      getUnitValue(unit, "occupier_name") ||
      getUnitValue(unit, "tenant_name") ||
      getUnitValue(unit, "occupant_name");
    const occupierMobile =
      getUnitValue(unit, "occupier_mobile") ||
      getUnitValue(unit, "tenant_mobile") ||
      getUnitValue(unit, "occupant_mobile");
    const rentAmount =
      getUnitValue(unit, "rent_amount") ||
      getUnitValue(unit, "rent") ||
      unit?.rent_amount;
    const area =
      getUnitValue(unit, "unit_area_sqmt") ||
      getUnitValue(unit, "area") ||
      getUnitValue(unit, "self_area") ||
      getUnitValue(unit, "rented_area");

    const electricity =
      getUnitUtilityValue(unit, "electric_connection") ||
      getUnitUtilityValue(unit, "has_electricity");
    const water =
      getUnitUtilityValue(unit, "water_connection") ||
      getUnitUtilityValue(unit, "has_water_connection");
    const gas =
      getUnitUtilityValue(unit, "gas_connection") ||
      getUnitUtilityValue(unit, "has_gas_connection");
    const sewer =
      getUnitUtilityValue(unit, "sewer_connection") ||
      getUnitUtilityValue(unit, "has_sewer");
    const solar =
      getUnitUtilityValue(unit, "has_solar") ||
      getUnitUtilityValue(unit, "solar_connection");
    const internet = getUnitUtilityValue(unit, "internet_connection");
    const hasKitchen =
      getUnitUtilityValue(unit, "has_kitchen") || unit?.has_kitchen;
    const kitchenCount =
      getUnitUtilityValue(unit, "kitchen_count") ||
      getUnitValue(unit, "kitchen_count");
    const kitchenArea =
      getUnitUtilityValue(unit, "kitchen_area_sqmt") ||
      getUnitUtilityValue(unit, "kitchen_area");
    const hasToilet =
      getUnitUtilityValue(unit, "has_toilet") || unit?.has_toilet;
    const toiletCount =
      getUnitUtilityValue(unit, "toilet_count") ||
      getUnitValue(unit, "toilet_count");
    const toiletArea =
      getUnitUtilityValue(unit, "toilet_area_sqmt") ||
      getUnitUtilityValue(unit, "toilet_area");
    const parkingType =
      getUnitUtilityValue(unit, "parking_type") || unit?.parking_type;
    const parkingArea =
      getUnitUtilityValue(unit, "parking_area_sqmt") ||
      getUnitUtilityValue(unit, "parking_area");

    const formatAvailability = (value) => {
      if (value === false) return "Not Available";
      if (value === true) return "Available";
      return value !== undefined && value !== null && value !== ""
        ? String(value)
        : "N/A";
    };

    return (
      <View
        key={`unit-${unit.id || index}`}
        style={{
          marginTop: 12,
          borderRadius: 12,
          backgroundColor: "#f9fafb",
          padding: 12,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: "#0f2d5c",
            marginBottom: 8,
          }}
        >
          Unit Number : {renderValue(unitNumber)}
        </Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Unit Address</Text>
          <Text style={styles.detailValue}>{renderValue(unitAddress)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Carpet Area (sq.mt)</Text>
          <Text style={styles.detailValue}>{renderValue(carpetArea)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Construction Year</Text>
          <Text style={styles.detailValue}>
            {renderValue(constructionYear)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Occupancy Status</Text>
          <Text style={styles.detailValue}>{renderValue(occupancyStatus)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Area (sq.mt)</Text>
          <Text style={styles.detailValue}>{renderValue(area)}</Text>
        </View>

        {showOccupierDetails && (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Occupier Name</Text>
              <Text style={styles.detailValue}>
                {renderValue(occupierName)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Occupier Mobile</Text>
              <Text style={styles.detailValue}>
                {renderValue(occupierMobile)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Monthly Rent</Text>
              <Text style={styles.detailValue}>{renderValue(rentAmount)}</Text>
            </View>
          </>
        )}

        <>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Owner Name</Text>
            <Text style={styles.detailValue}>{renderValue(ownerName)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Owner Mobile</Text>
            <Text style={styles.detailValue}>{renderValue(ownerMobile)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Occupation</Text>
            <Text style={styles.detailValue}>
              {renderValue(ownerOccupation)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Disabled Person</Text>
            <Text style={styles.detailValue}>
              {renderValue(disabledPerson)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Father/Husband Name</Text>
            <Text style={styles.detailValue}>
              {renderValue(fatherHusbandName)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Aadhar Number</Text>
            <Text style={styles.detailValue}>{renderValue(aadharNumber)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Electricity Connection</Text>
            <Text style={styles.detailValue}>
              {formatAvailability(electricity)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Water Connection</Text>
            <Text style={styles.detailValue}>{formatAvailability(water)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Gas Connection</Text>
            <Text style={styles.detailValue}>{formatAvailability(gas)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sewer Connection</Text>
            <Text style={styles.detailValue}>{formatAvailability(sewer)}</Text>
          </View>
          {internet !== undefined && internet !== null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Internet Connection</Text>
              <Text style={styles.detailValue}>
                {formatAvailability(internet)}
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Has Kitchen</Text>
            <Text style={styles.detailValue}>{renderValue(hasKitchen)}</Text>
          </View>
          {hasKitchen && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Kitchen Count</Text>
                <Text style={styles.detailValue}>
                  {renderValue(kitchenCount)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Kitchen Area (sq.mt)</Text>
                <Text style={styles.detailValue}>
                  {renderValue(kitchenArea)}
                </Text>
              </View>
            </>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Has Toilet</Text>
            <Text style={styles.detailValue}>{renderValue(hasToilet)}</Text>
          </View>
          {hasToilet && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Toilet Count</Text>
                <Text style={styles.detailValue}>
                  {renderValue(toiletCount)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Toilet Area (sq.mt)</Text>
                <Text style={styles.detailValue}>
                  {renderValue(toiletArea)}
                </Text>
              </View>
            </>
          )}
          {parkingType && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Parking Type</Text>
                <Text style={styles.detailValue}>
                  {renderValue(parkingType)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Parking Area (sq.mt)</Text>
                <Text style={styles.detailValue}>
                  {renderValue(parkingArea)}
                </Text>
              </View>
            </>
          )}
        </>
      </View>
    );
  };

  const getFloorUtility = (floorNumber, floorRecord) => {
    const localUtilities = Array.isArray(floorRecord?.FloorUtilities)
      ? floorRecord.FloorUtilities
      : [];
    if (localUtilities.length > 0) {
      return localUtilities[0];
    }

    return (
      floorUtilities.find(
        (u) => Number(u?.floor_number ?? -999) === Number(floorNumber ?? -999),
      ) || {}
    );
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
      return (
        <View key={`floor-${floorNumber}`} style={styles.section}>
          <Text style={styles.sectionTitle}>{getFloorLabel(floorNumber)}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Construction Year</Text>
            <Text style={styles.detailValue}>
              {renderValue(
                floor.construction_year ||
                  getUnitValue(floorUnits?.[0], "construction_year"),
              )}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Carpet Area (sq.mt)</Text>
            <Text style={styles.detailValue}>
              {renderValue(
                floor.carpet_area ||
                  floor.carpet_area ||
                  getUnitValue(floorUnits?.[0], "carpet_area") ||
                  getUnitValue(floorUnits?.[0], "carpet_area"),
              )}
            </Text>
          </View>
          {/* Ground Floor Use */}
          {building_type === "Residential" &&
          building_subtype === "MultiStory" ? (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Floor Use</Text>
                <Text style={styles.detailValue}>
                  {renderValue(
                    floor.floor_use ||
                      floor.ground_floor_use ||
                      floor.ground_floor_mode ||
                      getUnitValue(floorUnits?.[0], "ground_floor_use") ||
                      getUnitValue(floorUnits?.[0], "ground_floor_mode"),
                  )}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Parking Type</Text>
                <Text style={styles.detailValue}>
                  {renderValue(
                    floorUtility?.parking_type ||
                      getUnitUtilityValue(floorUnits?.[0], "parking_type") ||
                      floor.parking_type,
                  )}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Parking Area (sq.mt)</Text>
                <Text style={styles.detailValue}>
                  {renderValue(
                    floorUtility?.parking_area ||
                      getUnitUtilityValue(floorUnits?.[0], "parking_area") ||
                      floor.parking_area,
                  )}
                </Text>
              </View>
            </>
          ) : (
            // Parkiund Detaiilas like Parking Type and Parking Area for Ground Floor

            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Occupancy Status</Text>
                <Text style={styles.detailValue}>
                  {renderValue(
                    floor.FloorOccupancy?.occupancy_status ||
                      getUnitValue(floorUnits?.[0], "occupancy_status"),
                  )}
                </Text>
              </View>
              {(floor.FloorOccupancy?.occupancy_status === "Rented" ||
                floor.FloorOccupancy?.occupancy_status === "SelfRented") && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Occupant/Tenant Name</Text>
                    <Text style={styles.detailValue}>
                      {renderValue(
                        getUnitValue(floor.FloorOccupancy, "occupant_name"),
                      )}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      Occupant/Tenant Mobile
                    </Text>
                    <Text style={styles.detailValue}>
                      {renderValue(
                        getUnitValue(floor.FloorOccupancy, "occupant_mobile"),
                      )}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Monthly Rent</Text>
                    <Text style={styles.detailValue}>
                      {renderValue(
                        getUnitValue(floor.FloorOccupancy, "rent_amount"),
                      )}
                    </Text>
                  </View>
                </>
              )}
            </>
          )}

          {building_type === "Residential" &&
          building_subtype === "SingleStory" ? (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Area</Text>
                <Text style={styles.detailValue}>
                  {renderValue(floor.carpet_area || 0)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Has Kitchen</Text>
                <Text style={styles.detailValue}>
                  {renderValue(floorUtility?.has_kitchen ?? false)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>No. of Kitchen</Text>
                <Text style={styles.detailValue}>
                  {renderValue(floorUtility?.kitchen_count ?? 0)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Kitchen Area</Text>
                <Text style={styles.detailValue}>
                  {renderValue(floorUtility?.kitchen_area ?? 0)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Has Toilet</Text>
                <Text style={styles.detailValue}>
                  {renderValue(floorUtility?.has_toilet ?? false)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>No. of Toilets</Text>
                <Text style={styles.detailValue}>
                  {renderValue(floorUtility?.toilet_count ?? 0)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Toilet Area</Text>
                <Text style={styles.detailValue}>
                  {renderValue(floorUtility?.toilet_area ?? 0)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Has Parking</Text>
                <Text style={styles.detailValue}>
                  {renderValue(floorUtility?.has_parking ?? false)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Parking Type</Text>
                <Text style={styles.detailValue}>
                  {renderValue(floorUtility?.parking_type || "N/A")}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Parking Area</Text>
                <Text style={styles.detailValue}>
                  {renderValue(floorUtility?.parking_area ?? 0)}
                </Text>
              </View>
            </>
          ) : (
            <View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>No. of Flats</Text>
                <Text style={styles.detailValue}>
                  {renderValue(floor.number_of_units || floorUnits.length || 0)}
                </Text>
              </View>

              {isMultiStory && floorUnits.length > 0 ? (
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
                    {floorUnits.map((item, index) => (
                      <View
                        key={`unit-${item.id || item.unit_id || index}`}
                        style={{ marginTop: index === 0 ? 0 : 12 }}
                      >
                        {renderUnitDetails(item, index)}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          )}
        </View>
      );
    });
  };

  return (
    <ProtectedRoute allowedRoles={["SURVEYOR"]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Survey Detail</Text>
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
          {/* Survey Header Info */}
          <View style={styles.headerInfo}>
            <View style={styles.headerContent}>
              <Text style={styles.surveyTitle}>{title}</Text>
              <View style={[styles.statusBadge, getStatusColor(status)]}>
                <Text style={[styles.statusText, getStatusTextStyle(status)]}>
                  {getStatusLabel(status)}
                </Text>
              </View>
            </View>
            {/* <Text style={styles.surveySubtitle}>{address}</Text> */}

            {propertyCode ? (
              <View style={styles.propertyCodeChip}>
                <MaterialIcons name="tag" size={16} color="#0f2d5c" />
                <Text style={styles.propertyCodeLabel}>Property ID</Text>
                <Text style={styles.propertyCodeValue}>{propertyCode}</Text>
              </View>
            ) : null}

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <View style={styles.infoItemIcon}>
                  <MaterialIcons name="home" size={20} color="#0f2d5c" />
                </View>
                <Text style={styles.infoItemLabel}>Property Type</Text>
                <Text style={styles.infoItemValue}>{building_type}</Text>
              </View>
              <View style={styles.infoItem}>
                <View style={styles.infoItemIcon}>
                  <MaterialIcons name="home" size={20} color="#0f2d5c" />
                </View>
                <Text style={styles.infoItemLabel}>Property Subtype</Text>
                <Text style={styles.infoItemValue}>{building_subtype}</Text>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoItemIcon}>
                  <MaterialIcons
                    name="calendar-today"
                    size={20}
                    color="#0f2d5c"
                  />
                </View>
                <Text style={styles.infoItemLabel}>Created</Text>
                <Text style={styles.infoItemValue}>{createdDate}</Text>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoItemIcon}>
                  <MaterialIcons name="date-range" size={20} color="#0f2d5c" />
                </View>
                <Text style={styles.infoItemLabel}>Construction Year</Text>
                <Text style={styles.infoItemValue}>
                  {surveyDetail.Property.Building.construction_year || "N/A"}
                </Text>
              </View>
            </View>
          </View>
          {/* Owner/Business Details */}
          {isSingleStory && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Owner Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Owner Name</Text>
                <Text style={styles.detailValue}>
                  {surveyDetail?.Property?.PropertyOwners?.[0]?.owner_name ||
                    "N/A"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Active</Text>
                <Text style={styles.detailValue}>
                  {surveyDetail?.Property?.PropertyOwners?.[0]?.is_active
                    ? "Yes"
                    : "NO"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>
                  {surveyDetail?.Property?.PropertyOwners?.[0]?.mobile_number ||
                    "N/A"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Aadhar Number</Text>
                <Text style={styles.detailValue}>
                  {surveyDetail?.Property?.PropertyOwners?.[0]?.aadhar_number ||
                    "N/A"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Occupation</Text>
                <Text style={styles.detailValue}>
                  {surveyDetail?.Property?.PropertyOwners?.[0]?.occupation ||
                    "N/A"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Disabled Person</Text>
                <Text style={styles.detailValue}>
                  {surveyDetail?.Property?.PropertyOwners?.[0]?.is_disabled
                    ? "Yes"
                    : "No"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Father/Husband Name</Text>
                <Text style={styles.detailValue}>
                  {surveyDetail?.Property?.PropertyOwners?.[0]
                    ?.father_or_husband_name || "N/A"}
                </Text>
              </View>
            </View>
          )}
          {isMultiStory && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Property Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={styles.detailValue}>
                  {surveyDetail?.Property?.address || "N/A"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Plot Area (sqm)</Text>
                <Text style={styles.detailValue}>
                  {plotArea || "N/A" || "N/A"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Construction Type</Text>
                <Text style={styles.detailValue}>
                  {property.construction_type || "N/A"}
                </Text>
              </View>
            </View>
          )}
          {/* Property Details */}
          {isSingleStory && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Property Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Built-up Area (sq.m)</Text>
                <Text style={styles.detailValue}>
                  {renderValue(property.plot_area || "N/A")}
                </Text>
              </View>
            </View>
          )}
          {isSingleStory && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Property Utilities</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sewer Connection</Text>
                <Text style={styles.detailValue}>
                  {getUtilityStatus(["has_sewer", "sewer_connection"])
                    ? "Available"
                    : "Not Available"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Water Connection</Text>
                <Text style={styles.detailValue}>
                  {getUtilityStatus([
                    "has_water_connection",
                    "water_connection",
                  ])
                    ? "Available"
                    : "Not Available"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Electricity Connection</Text>
                <Text style={styles.detailValue}>
                  {getUtilityStatus(["has_electricity", "electric_connection"])
                    ? "Available"
                    : "Not Available"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Gas Connection</Text>
                <Text style={styles.detailValue}>
                  {getUtilityStatus(["has_gas_connection", "gas_connection"])
                    ? "Available"
                    : "Not Available"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Solar Panel</Text>
                <Text style={styles.detailValue}>
                  {getUtilityStatus(["has_solar", "solar_connection"])
                    ? "Available"
                    : "Not Available"}
                </Text>
              </View>
            </View>
          )}
          <View style={styles.section}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={styles.sectionTitle}>Property Road Details</Text>
              <TouchableOpacity
                onPress={() => setIsRoadSectionOpen((prev) => !prev)}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: "#0f2d5c",
                    marginRight: 4,
                  }}
                >
                  {isRoadSectionOpen ? "Hide" : "Show"}
                </Text>
                <MaterialIcons
                  name={
                    isRoadSectionOpen
                      ? "keyboard-arrow-up"
                      : "keyboard-arrow-down"
                  }
                  size={22}
                  color="#0f2d5c"
                />
              </TouchableOpacity>
            </View>
            {isRoadSectionOpen && (
              <>
                {roadSections.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No road data available for this property.
                  </Text>
                ) : (
                  roadSections.map((section) => (
                    <View
                      key={section.side}
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: "#f3f4f6",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#0f2d5c",
                          marginBottom: 8,
                        }}
                      >
                        {section.title}
                      </Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Road Type</Text>
                        <Text style={styles.detailValue}>
                          {renderValue(section.road_type)}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Road Width</Text>
                        <Text style={styles.detailValue}>
                          {renderValue(section.road_width)}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          Carriageway (m)
                        </Text>
                        <Text style={styles.detailValue}>
                          {renderValue(section.carriageway_area)}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          Footpath (m)
                        </Text>
                        <Text style={styles.detailValue}>
                          {renderValue(section.footpath_area)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Building Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                Floors No. including Ground Floor
              </Text>
              <Text style={styles.detailValue}>
                {surveyDetail?.Property?.Building?.floors_above_ground || "N/A"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                Floors No. including Below (Basement) Floor
              </Text>
              <Text style={styles.detailValue}>
                {surveyDetail?.Property?.Building?.floors_below_ground || "N/A"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Built up Area(sq.m)</Text>
              <Text style={styles.detailValue}>
                {surveyDetail?.Property?.Building?.total_builtup_area || "N/A"}
              </Text>
            </View>
          </View>
          {renderFloorSections()}

          {/* Survey Images */}

          {propertyPhotosData && propertyPhotosData.length > 0 ? (
            <View style={styles.section}>
              {building_type === "Residential" &&
              building_subtype === "MultiStory" ? (
                <Text style={styles.sectionTitle}>Property & Units Images</Text>
              ) : (
                <Text style={styles.sectionTitle}>Property Images</Text>
              )}
              <Text
                style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}
              >
                {propertyPhotosData.length} image(s) captured during survey
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
              >
                {propertyPhotosData.map((image, index) => (
                  <View
                    key={image.id || index}
                    style={{
                      marginRight: 12,
                      width: 220,
                      backgroundColor: "#fff",
                      borderRadius: 12,
                      padding: 10,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setImageViewerIndex(index);
                        setIsImageViewerVisible(true);
                      }}
                    >
                      <Image
                        source={{ uri: resolveImageUri(getImageUrl(image)) }}
                        style={{
                          width: "100%",
                          height: 160,
                          borderRadius: 8,
                          backgroundColor: "#e5e7eb",
                        }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                    <View style={{ marginTop: 10, paddingHorizontal: 4 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#0f2d5c",
                          fontWeight: "700",
                          marginBottom: 4,
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
                      {image.image_latitude && image.image_longitude && (
                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
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
                            {image.image_latitude.toFixed(6)},{" "}
                            {image.image_longitude.toFixed(6)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
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
                      source={{
                        uri: resolveImageUri(getImageUrl(activeViewerImage)),
                      }}
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
                      <MaterialIcons
                        name="chevron-left"
                        size={22}
                        color="#fff"
                      />
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
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Property Images</Text>
              <View style={{ paddingVertical: 12 }}>
                <Text
                  style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}
                >
                  No images available
                </Text>
                {isPhotosLoading && (
                  <Text
                    style={{ fontSize: 11, color: "#10b981", marginBottom: 8 }}
                  >
                    ⏳ Loading images...
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                router.push(
                  `/(surveyor)/property/${surveyDetail?.id || id}/edit?type=${property?.building_type}`,
                )
              }
            >
              <MaterialIcons name="edit" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={() => router.back()}
            >
              <MaterialIcons name="arrow-back" size={18} color="#1f2937" />
              <Text
                style={[
                  styles.actionButtonText,
                  styles.actionButtonTextSecondary,
                ]}
              >
                Back
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
      <Toast />
    </ProtectedRoute>
  );
}
