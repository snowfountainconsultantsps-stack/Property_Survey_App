import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { useSelector } from "react-redux";
import { useGetAssetMapMetaQuery } from "../../services/assetSurveyApi";
import { isPropertyLayer } from "../../utils/layerKind";

function LayerRow({ layer, onPress }) {
  const property = isPropertyLayer(layer);
  const color = layer.style?.color || layer.category?.color || "#334155";
  const done = layer.surveyed_count || 0;
  const inProgress = layer.in_progress_count || 0;
  const total = layer.feature_count || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const progressPct = total ? Math.round((inProgress / total) * 100) : 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <MaterialIcons name={property ? "home-work" : "category"} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#1f2937" }}>{layer.name}</Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
          {layer.category?.name || "Uncategorized"} · {total} total
        </Text>
        {/* Survey progress at a glance, before opening the map. */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
          <View
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#e5e7eb",
              overflow: "hidden",
              flexDirection: "row",
            }}
          >
            <View style={{ width: `${pct}%`, height: "100%", backgroundColor: "#22c55e" }} />
            <View style={{ width: `${progressPct}%`, height: "100%", backgroundColor: "#f59e0b" }} />
          </View>
          <Text style={{ fontSize: 11, color: "#6b7280", marginLeft: 8 }}>
            {done}/{total}
            {inProgress ? ` (+${inProgress})` : ""}
          </Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color="#9ca3af" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

export default function SurveyorHome() {
  const router = useRouter();
  const user = useSelector((state) => state.auth.user);
  const { data, isLoading, isFetching, refetch, error } = useGetAssetMapMetaQuery({ status: "PUBLISHED" });
  const layers = (data?.layers || []).filter((l) => l.feature_count > 0);

  // The per-layer "x of y surveyed" counts go stale as soon as the surveyor
  // submits something, and this screen stays mounted underneath. Refresh on
  // focus so returning from a survey shows the new totals.
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      refetch();
    }, [refetch])
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" }}>
        <ActivityIndicator size="large" color="#0f2d5c" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <FlatList
        data={layers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 16, color: "#374151", fontWeight: "600" }}>
              Hi {user?.full_name || "Surveyor"}
            </Text>
            <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              Pick what to survey, then choose it on the map
            </Text>
          </View>
        }
        ListEmptyComponent={
          !isFetching && (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <MaterialIcons name={error ? "error-outline" : "inventory-2"} size={48} color="#d1d5db" />
              <Text style={{ color: "#6b7280", marginTop: 10, textAlign: "center" }}>
                {error ? "Could not load. Pull to retry." : "Nothing published to survey yet."}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <LayerRow layer={item} onPress={() => router.push(`/(surveyor)/assets/map/${item.id}`)} />
        )}
      />
    </View>
  );
}
