import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import ProtectedRoute from "../../../components/ProtectedRoute";
import SurveySkeleton from "../../../components/skeleton/SurveySkeleton";
import useAuth from "../../../hooks/useAuth";
import { useGetSurveyorSurveysQuery } from "../../../services/surveyApi";
import { clearAuth } from "../../../store/authSlice";

export default function SurveysIndex() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { loading: authLoading } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: surveysData,
    isLoading,
    refetch,
    isFetching,
  } = useGetSurveyorSurveysQuery(
    {
      surveyorId: user?.id,
      limit: 999,
      offset: 0,
    },
    {
      skip: !user?.id,
    },
  );

  // const getSurveyOwnerInfo = (survey) => {
  //   const property = survey?.Property;
  //   const propertyType = String(property?.property_type || "").toUpperCase();
  //   const propertySubtype = String(
  //     property?.property_subtype || "",
  //   ).toLowerCase();

  //   const isResidentialSingle =
  //     propertyType === "RESIDENTIAL" && propertySubtype.includes("singlestory");
  //   const isResidentialMulti =
  //     propertyType === "RESIDENTIAL" && propertySubtype.includes("multistory");

  //   // In your log, it is "PropertyOwners" (plural) and it is an Array
  //   const propertyOwner = property?.PropertyOwners?.[0];
  //   const unitOwner = {
  //     owner_name: survey?.owner_name,
  //     mobile_number: survey?.mobile_number,
  //   };
  //   // console.log("Determined property type:", {
  //   //   propertyType,
  //   //   propertySubtype,
  //   //   isResidentialSingle,
  //   //   isResidentialMulti,
  //   // });

  //   if (isResidentialSingle) {
  //     return {
  //       ownerName: propertyOwner?.owner_name || "No name",
  //       mobileNumber: propertyOwner?.mobile_number || "N/A",
  //     };
  //   }

  //   if (isResidentialMulti) {
  //     return {
  //       ownerName:
  //         unitOwner.owner_name || propertyOwner?.owner_name || "No name",
  //       mobileNumber:
  //         unitOwner.mobile_number || propertyOwner?.mobile_number || "N/A",
  //     };
  //   }

  //   // Default fallback
  //   return {
  //     ownerName: unitOwner.owner_name || propertyOwner?.owner_name || "No name",
  //     mobileNumber:
  //       unitOwner.mobile_number || propertyOwner?.mobile_number || "N/A",
  //   };
  // };
  const getSurveyOwnerInfo = (survey) => {
    let finalOwnerName = "";
    let finalMobileNumber = "";
    //let unitNumber = "";

    const updateDetails = (name, number) => {
      if (!finalOwnerName && name && name.trim() !== "") {
        finalOwnerName = name;
      }
      if (!finalMobileNumber && number && String(number).trim() !== "") {
        finalMobileNumber = number;
      }
      // if(!unitNumber && survey?.PropertyUnit?.unit_number) {
      //   unitNumber = survey.PropertyUnit.unit_number;
      // }
    };
    const property = survey?.Property || survey?.PropertyDetails;
    const propertySubtype = String(
      property?.property_subtype || "",
    ).toLowerCase();
    const isMultiStory = propertySubtype.includes("multistory");
    const isSingleStory = propertySubtype.includes("singlestory");

    if (isMultiStory) {
      const building = property?.Building || property?.Buildings?.[0];
      const floors = building?.Floors || [];

      for (const floor of floors) {
        const units = floor?.Units || floor?.PropertyUnits || floor?.Unit || [];
        for (const unit of units) {
          const unitOwner = unit?.UnitOwners?.[0] || unit?.UnitOwner;
          // console.log("Checking unit owner:", {
          //   unitNumber: unit?.unit_number,
          //   ownerName: unitOwner?.owner_name,
          //   mobile: unitOwner?.mobile,
          // });

          updateDetails(
            unitOwner?.owner_name,
            unitOwner?.mobile,
            // unit?.unit_number
          );
          if (finalOwnerName && finalMobileNumber) break;
        }
        if (finalOwnerName && finalMobileNumber) break;
        // if (unitNumber) break;
      }
    }
    const propertyOwner =
      property?.PropertyOwners?.[0] || property?.PropertyOwner;
    updateDetails(propertyOwner?.owner_name, propertyOwner?.mobile_number);
    updateDetails(survey?.owner_name, survey?.mobile_number);

    return {
      ownerName: finalOwnerName || "No name",
      mobileNumber: finalMobileNumber || "N/A",
      // unitNumber: unitNumber || "N/A",
    };
  };

  const getSurveyUnitNumber = (survey) => {
    const property = survey?.Property || survey?.PropertyDetails;
    const propertyType = String(property?.property_type || "").toUpperCase();
    const propertySubtype = String(
      property?.property_subtype || "",
    ).toLowerCase();

    // Only show unit_number for Residential properties
    if (propertyType !== "RESIDENTIAL") {
      return "N/A";
    }

    const isResidentialSingle = propertySubtype.includes("singlestory");
    const isResidentialMulti = propertySubtype.includes("multistory");

    // For both Single and Multi Story Residential, first check survey's direct PropertyUnit
    if (survey?.PropertyUnit?.unit_number) {
      return survey.PropertyUnit.unit_number;
    }

    // For Multi Story Residential, fallback to finding unit from building if PropertyUnit doesn't have it
    if (isResidentialMulti) {
      const building = property?.Building || property?.Buildings?.[0];
      const floors = building?.Floors || [];

      for (const floor of floors) {
        const units = floor?.Units || floor?.PropertyUnits || floor?.Unit || [];
        for (const unit of units) {
          if (unit?.unit_number) {
            return unit.unit_number;
          }
        }
      }
    }

    // Fallback
    return "N/A";
  };

  useEffect(() => {
    if (setIsRefreshing) {
      setIsRefreshing(false);
    }
  }, [surveysData, isFetching]);

  const handleLogout = () => {
    dispatch(clearAuth());
    router.push("/");
  };

  const handleRefresh = async () => {
    if (isRefreshing || isFetching) return;
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const getCardBorderClass = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case "active":
      case "in_progress":
      case "inprogress":
        return "border-l-orange-500";
      case "completed":
      case "approved":
        return "border-l-green-500";
      default:
        return "border-l-survey-dark";
    }
  };

  const getStatusBadgeClasses = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case "active":
      case "in_progress":
      case "inprogress":
        return "bg-yellow-100";
      case "completed":
      case "approved":
        return "bg-green-100";
      default:
        return "bg-gray-200";
    }
  };

  const getStatusTextClasses = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case "active":
      case "in_progress":
      case "inprogress":
        return "text-orange-700";
      case "completed":
      case "approved":
        return "text-green-700";
      default:
        return "text-gray-700";
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

  const renderSurveyCard = (survey) => {
    const property = survey?.Property || survey?.PropertyDetails;
    const address = property?.address || survey?.address || "";
    const propertyCode = property?.property_code || survey?.property_code || "";
    const typeLabel = [property?.property_type, property?.property_subtype]
      .filter(Boolean)
      .join(" · ");

    const unitNumber = getSurveyUnitNumber(survey);
    const ownerInfo = getSurveyOwnerInfo(survey);
    const hasOwner = ownerInfo.ownerName && ownerInfo.ownerName !== "No name";
    const hasMobile =
      ownerInfo.mobileNumber && ownerInfo.mobileNumber !== "N/A";

    // Headline: unit number when known, otherwise the property type/subtype.
    const headline =
      unitNumber && unitNumber !== "N/A" ? unitNumber : typeLabel || "Property";

    // Primary line: owner name once captured, otherwise the address from Step 1.
    const primaryText = hasOwner
      ? ownerInfo.ownerName
      : address || "Details pending";
    const mobileNumber = hasMobile ? ownerInfo.mobileNumber : "";

    // Backend list returns `status`; older/adapted payloads use `survey_status`.
    const status =
      (survey.status || survey.survey_status)?.toLowerCase() || "pending";
    const canContinue = !["completed", "approved"].includes(status);
    const surveyDate = survey.survey_date
      ? new Date(survey.survey_date).toLocaleDateString()
      : "N/A";

    return (
      <View
        className={`bg-white rounded-xl p-4 mb-3 border-l-4 shadow-md ${getCardBorderClass(status)}`}
      >
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-lg font-extrabold text-survey-dark">
            {headline}
          </Text>
          <View
            className={`px-3 py-1 rounded-lg ${getStatusBadgeClasses(status)}`}
          >
            <Text
              className={`text-xs font-extrabold ${getStatusTextClasses(status)}`}
            >
              {getStatusLabel(status)}
            </Text>
          </View>
        </View>

        {propertyCode ? (
          <View className="flex-row items-center mb-2">
            <MaterialIcons name="tag" size={14} color="#1e3a8a" />
            <Text className="text-xs font-bold text-blue-900 ml-1 tracking-wider">
              {propertyCode}
            </Text>
          </View>
        ) : null}

        <View className="flex-row justify-between items-center mb-1">
          <View className="flex-1">
            <Text className="text-sm font-bold text-survey-dark">
              {primaryText}
            </Text>
          </View>
          {mobileNumber ? (
            <Text className="text-sm text-survey-gray ml-3">{mobileNumber}</Text>
          ) : null}
        </View>

        {hasOwner && address ? (
          <Text
            className="text-xs text-survey-gray mb-3"
            numberOfLines={1}
          >
            {address}
          </Text>
        ) : (
          <View className="mb-2" />
        )}

        <View className="flex-row justify-between items-center gap-2">
          <View className="flex-row items-center gap-2 flex-1">
            <MaterialIcons name="calendar-today" size={14} color="#6b7280" />
            <Text className="text-sm text-survey-gray">{surveyDate}</Text>
          </View>
          <View className="flex-row gap-2">
            {canContinue && (
              <TouchableOpacity
                className="py-2 px-3 rounded-lg bg-amber-600 items-center"
                onPress={() =>
                  router.push(
                    `/(surveyor)/property/create?surveyId=${survey.id}`,
                  )
                }
              >
                <Text className="text-white text-xs font-extrabold">
                  Continue
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="py-2 px-6 rounded-lg bg-survey-dark items-center"
              onPress={() =>
                router.push(
                  `/(surveyor)/property/${survey.id}?type=${status}`,
                )
              }
            >
              <Text className="text-white text-xs font-extrabold">View</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ProtectedRoute allowedRoles={["SURVEYOR"]}>
      <View className="flex-1 bg-survey-light">
        <View
          className="bg-survey-dark pt-15 pb-8 px-5 rounded-b-3xl shadow-lg"
          style={{ paddingTop: 60, paddingBottom: 30 }}
        >
          <View className="flex-row justify-between items-center">
            <Text
              className="text-3xl font-extrabold text-white"
              style={{ letterSpacing: 0.5 }}
            >
              My Surveys
            </Text>
            <TouchableOpacity className="p-2" onPress={handleLogout}>
              <MaterialIcons name="logout" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-1 px-5 py-5">
          {authLoading ||
          isLoading ||
          (isRefreshing && !surveysData?.surveys?.length) ? (
            <SurveySkeleton />
          ) : !surveysData?.surveys?.length && !isFetching ? (
            <ScrollView
              contentContainerStyle={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor="#0f2d5c"
                />
              }
            >
              <View className="flex-1 justify-center items-center py-10">
                <MaterialIcons name="assignment" size={64} color="#d1d5db" />
                <Text className="text-survey-gray text-base font-semibold mt-4">
                  No surveys found
                </Text>
              </View>
            </ScrollView>
          ) : (
            <FlatList
              data={surveysData?.surveys || []}
              renderItem={({ item, index }) => renderSurveyCard(item)}
              keyExtractor={(item, index) => `survey-${item.id}-${index}`}
              contentContainerStyle={{ paddingBottom: 100, marginTop: 20 }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={true}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor="#0f2d5c"
                />
              }
            />
          )}
        </View>

        <TouchableOpacity
          style={{
            position: "absolute",
            bottom: 30,
            right: 20,
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: "#4caf50",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#4caf50",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 10,
            elevation: 8,
          }}
          onPress={() => router.push("/(surveyor)/property/create")}
        >
          <MaterialIcons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
      <Toast />
    </ProtectedRoute>
  );
}
