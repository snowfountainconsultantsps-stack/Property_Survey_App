import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import { useGetMyAssetSurveysQuery } from "../../services/assetSurveyApi";
import { useGetSurveyorSurveysQuery } from "../../services/surveyApi";

// Property surveys are a wizard that can be left half-finished; asset surveys
// are submitted in one shot. So the two have different status vocabularies.
const PROPERTY_STATUS = {
  completed: { bg: "#dcfce7", fg: "#166534", label: "Completed" },
  reviewed: { bg: "#dcfce7", fg: "#166534", label: "Reviewed" },
  in_progress: { bg: "#fef3c7", fg: "#92400e", label: "In Progress" },
  assigned: { bg: "#e0e7ff", fg: "#3730a3", label: "Assigned" },
  rejected: { bg: "#fee2e2", fg: "#991b1b", label: "Rejected" },
};

const ASSET_STATUS = {
  submitted: { bg: "#fef3c7", fg: "#92400e", label: "Pending Review" },
  approved: { bg: "#dcfce7", fg: "#166534", label: "Approved" },
  rejected: { bg: "#fee2e2", fg: "#991b1b", label: "Rejected" },
};

const ACTION_LABEL = {
  VERIFY: "Verified",
  CORRECT_ATTRIBUTE: "Correction",
  CORRECT_GEOMETRY: "Geometry Correction",
  FLAG: "Flagged Issue",
};

const PROPERTY_KEY = "__property__";

function Badge({ style }) {
  return (
    <View style={{ backgroundColor: style.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: style.fg }}>{style.label}</Text>
    </View>
  );
}

const card = {
  backgroundColor: "#fff",
  borderRadius: 12,
  padding: 14,
  marginBottom: 10,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
  elevation: 2,
};

// ─── Level 1: one row per asset type the surveyor has worked on ──────────
function GroupRow({ group, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ ...card, flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: group.color,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <MaterialIcons name={group.icon} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#1f2937" }}>{group.name}</Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
          {group.total} survey{group.total === 1 ? "" : "s"}
          {group.pending ? ` · ${group.pending} unfinished` : ""}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
    </TouchableOpacity>
  );
}

// ─── Level 2a: a property survey, resumable while unfinished ─────────────
function PropertySurveyRow({ survey, router }) {
  const status = String(survey.status || "").toLowerCase();
  const style = PROPERTY_STATUS[status] || { bg: "#e5e7eb", fg: "#374151", label: status || "Unknown" };
  // Same rule as the previous app: anything not finished can be picked up.
  const canContinue = !["completed", "reviewed", "approved"].includes(status);

  const property = survey.Property || survey.PropertyDetails || {};
  const title = property.property_code || survey.property_code || `Survey #${survey.id}`;
  const address = property.address || survey.address;

  return (
    <View style={card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: "#1f2937", flex: 1 }} numberOfLines={1}>
          {title}
        </Text>
        <Badge style={style} />
      </View>
      {address ? (
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }} numberOfLines={2}>
          {address}
        </Text>
      ) : null}
      <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
        {survey.survey_date ? new Date(survey.survey_date).toLocaleDateString() : "—"}
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        {canContinue && (
          <TouchableOpacity
            onPress={() => router.push(`/(surveyor)/property/create?surveyId=${survey.id}`)}
            style={{ flex: 1, backgroundColor: "#d97706", paddingVertical: 8, borderRadius: 8, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>Continue</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => router.push(`/(surveyor)/property/${survey.id}?type=${status}`)}
          style={{ flex: 1, backgroundColor: "#0f2d5c", paddingVertical: 8, borderRadius: 8, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Level 2b: an asset survey ───────────────────────────────────────────
function AssetSurveyRow({ item, onPress }) {
  const style = ASSET_STATUS[item.status] || ASSET_STATUS.submitted;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: "#1f2937", flex: 1 }} numberOfLines={1}>
          {ACTION_LABEL[item.action] || item.action}
          {item.feature_code ? ` — ${item.feature_code}` : ` — #${item.feature_id}`}
        </Text>
        <Badge style={style} />
      </View>
      {item.condition ? (
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Condition: {item.condition}</Text>
      ) : null}
      {item.notes ? (
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }} numberOfLines={2}>
          {item.notes}
        </Text>
      ) : null}
      <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
        {new Date(item.createdAt).toLocaleDateString()}{" "}
        {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </TouchableOpacity>
  );
}

export default function MySurveysScreen() {
  const router = useRouter();
  const user = useSelector((state) => state.auth.user);
  const [openGroup, setOpenGroup] = useState(null);

  const {
    data: assetRes,
    isLoading: assetLoading,
    isFetching: assetFetching,
    refetch: refetchAssets,
  } = useGetMyAssetSurveysQuery();

  const {
    data: propRes,
    isLoading: propLoading,
    isFetching: propFetching,
    refetch: refetchProps,
  } = useGetSurveyorSurveysQuery(
    { surveyorId: user?.id, limit: 500, offset: 0 },
    { skip: !user?.id }
  );

  const assetSurveys = assetRes?.data || [];
  const propertySurveys = propRes?.surveys || [];

  const isLoading = assetLoading || propLoading;
  const isFetching = assetFetching || propFetching;
  const refetch = () => {
    refetchAssets();
    refetchProps();
  };

  // Group by asset type, with property surveys as their own first entry.
  const groups = useMemo(() => {
    const out = [];

    if (propertySurveys.length) {
      const unfinished = propertySurveys.filter(
        (s) => !["completed", "reviewed", "approved"].includes(String(s.status || "").toLowerCase())
      ).length;
      out.push({
        key: PROPERTY_KEY,
        name: "Property",
        icon: "home-work",
        color: "#0f2d5c",
        total: propertySurveys.length,
        pending: unfinished,
      });
    }

    const byLayer = new Map();
    for (const s of assetSurveys) {
      const key = String(s.layer_id);
      if (!byLayer.has(key)) {
        byLayer.set(key, {
          key,
          name: s.layer_name || `Layer ${s.layer_id}`,
          icon: "category",
          color: s.layer_style?.color || s.category_color || "#2f8683",
          total: 0,
          pending: 0,
        });
      }
      const g = byLayer.get(key);
      g.total += 1;
      if (s.status === "rejected") g.pending += 1;
    }
    return out.concat([...byLayer.values()]);
  }, [assetSurveys, propertySurveys]);

  const openGroupMeta = groups.find((g) => g.key === openGroup);
  const rowsForOpenGroup = useMemo(() => {
    if (!openGroup) return [];
    if (openGroup === PROPERTY_KEY) return propertySurveys;
    return assetSurveys.filter((s) => String(s.layer_id) === openGroup);
  }, [openGroup, assetSurveys, propertySurveys]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" }}>
        <ActivityIndicator size="large" color="#0f2d5c" />
      </View>
    );
  }

  // ── Level 2: one asset type's surveys ─────────────────────────────────
  if (openGroup) {
    const isProperty = openGroup === PROPERTY_KEY;
    return (
      <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
        <TouchableOpacity
          onPress={() => setOpenGroup(null)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: "#fff",
            borderBottomWidth: 1,
            borderBottomColor: "#e5e7eb",
          }}
        >
          <MaterialIcons name="arrow-back" size={20} color="#374151" />
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#1f2937", marginLeft: 8 }}>
            {openGroupMeta?.name || "Surveys"}
          </Text>
          <Text style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
            ({rowsForOpenGroup.length})
          </Text>
        </TouchableOpacity>

        <FlatList
          data={rowsForOpenGroup}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          renderItem={({ item }) =>
            isProperty ? (
              <PropertySurveyRow survey={item} router={router} />
            ) : (
              <AssetSurveyRow item={item} onPress={() => router.push(`/(surveyor)/survey/${item.feature_id}`)} />
            )
          }
        />
      </View>
    );
  }

  // ── Level 1: asset types ──────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <FlatList
        data={groups}
        keyExtractor={(g) => g.key}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListHeaderComponent={
          <Text style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
            Your surveys, grouped by what you surveyed
          </Text>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <MaterialIcons name="assignment-turned-in" size={48} color="#d1d5db" />
            <Text style={{ color: "#6b7280", marginTop: 10 }}>You haven't submitted any surveys yet.</Text>
          </View>
        }
        renderItem={({ item }) => <GroupRow group={item} onPress={() => setOpenGroup(item.key)} />}
      />
    </View>
  );
}
