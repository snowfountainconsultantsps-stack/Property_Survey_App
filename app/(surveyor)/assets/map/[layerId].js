import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import NearbyMapView from "../../../../components/NearbyMapView";
import {
  useEnsureFeaturePolygonMutation,
  useGetAssetMapMetaQuery,
  useGetAssetMapViewportQuery,
} from "../../../../services/assetSurveyApi";
import { isPropertyLayer } from "../../../../utils/layerKind";

export default function AssetLayerMapScreen() {
  const { layerId } = useLocalSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Other layers are opt-in and picked individually — the map starts showing
  // only what's actually surveyable.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contextLayerIds, setContextLayerIds] = useState(() => new Set());
  // What the map is currently looking at; features are fetched for this only.
  const [bbox, setBbox] = useState(null);

  const toggleContextLayer = (id) =>
    setContextLayerIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const [ensurePolygon] = useEnsureFeaturePolygonMutation();

  // Catalogue metadata (counts, extents) — a few KB regardless of dataset size.
  const { data: metaRes, isLoading: metaLoading, error: metaError } = useGetAssetMapMetaQuery({
    status: "PUBLISHED",
  });
  const allLayers = metaRes?.layers || [];
  const layer = allLayers.find((l) => String(l.id) === String(layerId));
  const property = isPropertyLayer(layer);

  // Geometry for the visible viewport only.
  const { data: viewRes, isFetching: featuresLoading } = useGetAssetMapViewportQuery(
    { status: "PUBLISHED", bbox },
    { skip: !bbox }
  );
  const viewLayers = viewRes?.layers || [];
  const truncated = Boolean(viewRes?.truncated);

  const otherLayers = useMemo(
    () => allLayers.filter((l) => String(l.id) !== String(layerId) && l.feature_count > 0),
    [allLayers, layerId]
  );

  const geojson = useMemo(() => {
    const features = [];
    for (const l of viewLayers) {
      const selectable = String(l.id) === String(layerId);
      if (!selectable && !contextLayerIds.has(l.id)) continue;
      for (const f of l.geojson?.features || []) {
        features.push({
          ...f,
          properties: {
            ...f.properties,
            layerName: l.name,
            layerColor: l.style?.color || l.category?.color || null,
            selectable,
          },
        });
      }
    }
    return { type: "FeatureCollection", features };
  }, [viewLayers, layerId, contextLayerIds]);

  // On-screen counts (what's visible now) alongside the layer-wide totals.
  const selected = geojson.features.filter((f) => f.properties.selectable);
  const doneCount = selected.filter((f) => f.properties.survey_state === "DONE").length;
  const progressCount = selected.filter((f) => f.properties.survey_state === "IN_PROGRESS").length;
  const pendingCount = selected.length - doneCount - progressCount;
  const totalCount = layer?.feature_count || 0;
  const totalDone = layer?.surveyed_count || 0;
  const totalProgress = layer?.in_progress_count || 0;

  const isLoading = metaLoading;
  const error = metaError;

  // Asset layers go to the single-form asset survey. Parcels run the full
  // property wizard instead, which needs a Polygon — resolved on the fly.
  const handleSelect = async (featureId, { surveyState, surveyId, selectable, layerName } = {}) => {
    // Other layers are drawn for context only.
    if (selectable === false) {
      Toast.show({
        type: "info",
        text1: `${layerName || "Other layer"} — not selected`,
        text2: `Go back and choose ${layerName || "that layer"} to survey it.`,
      });
      return;
    }

    // Finished features are read-only here — nothing left to submit.
    if (surveyState === "DONE") {
      Toast.show({
        type: "info",
        text1: "Already surveyed",
        text2: "This one is done — pick a green or amber one.",
      });
      return;
    }

    // A half-finished wizard reopens where it left off rather than starting
    // a second survey for the same parcel.
    if (surveyState === "IN_PROGRESS" && surveyId) {
      Toast.show({ type: "info", text1: "Resuming survey", text2: "Picking up where you left off" });
      router.push(`/(surveyor)/property/create?surveyId=${surveyId}`);
      return;
    }

    if (!property) {
      router.push(`/(surveyor)/survey/${featureId}`);
      return;
    }

    setBusy(true);
    try {
      const res = await ensurePolygon(featureId).unwrap();
      const d = res.data;

      if (d.hasCompletedSurvey && d.completedSurveyId) {
        Toast.show({
          type: "info",
          text1: "Already Surveyed",
          text2: "Opening the existing survey",
        });
        router.push(`/(surveyor)/property/${d.completedSurveyId}`);
        return;
      }

      // Parcel already has an unfinished wizard — continue it.
      if (d.draftSurveyId) {
        Toast.show({ type: "info", text1: "Resuming survey", text2: "Picking up where you left off" });
        router.push(`/(surveyor)/property/create?surveyId=${d.draftSurveyId}`);
        return;
      }

      router.push(
        `/(surveyor)/property/create?polygonCode=${encodeURIComponent(d.polygon_code)}` +
          `&polygonId=${d.polygon_id}&wardId=${d.ward_id}` +
          `&wardName=${encodeURIComponent(d.ward_name || "")}` +
          `&areaSqmt=${d.area_sqmt ?? ""}`
      );
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Cannot start survey",
        text2: err?.data?.message || "Could not prepare this parcel.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <View
        style={{
          backgroundColor: "#fff",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#e5e7eb",
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#1f2937" }}>
          {layer?.name || (isLoading ? "Loading…" : "Layer")}
        </Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
          On screen: {pendingCount} to do
          {progressCount ? ` · ${progressCount} in progress` : ""} · {doneCount} done
          {totalCount
            ? `   (layer: ${totalDone} done${totalProgress ? `, ${totalProgress} in progress` : ""} of ${totalCount})`
            : ""}
        </Text>
        {truncated && (
          <Text style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>
            Too many assets here to draw them all — zoom in to see the rest.
          </Text>
        )}
        {featuresLoading && !truncated && (
          <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Loading this area…</Text>
        )}

        {otherLayers.length > 0 && (
          <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f3f4f6" }}>
            <TouchableOpacity
              onPress={() => setPickerOpen((o) => !o)}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <MaterialIcons name="layers" size={18} color="#6b7280" />
              <Text style={{ fontSize: 12, color: "#374151", flex: 1, marginLeft: 6 }}>
                Show other assets
                {contextLayerIds.size > 0 ? ` · ${contextLayerIds.size} on` : ""}
              </Text>
              <MaterialIcons
                name={pickerOpen ? "expand-less" : "expand-more"}
                size={22}
                color="#6b7280"
              />
            </TouchableOpacity>

            {pickerOpen && (
              <View style={{ marginTop: 6 }}>
                {contextLayerIds.size > 0 && (
                  <TouchableOpacity
                    onPress={() => setContextLayerIds(new Set())}
                    style={{ alignSelf: "flex-end", paddingVertical: 4 }}
                  >
                    <Text style={{ fontSize: 11, color: "#2563eb", fontWeight: "600" }}>
                      Clear all
                    </Text>
                  </TouchableOpacity>
                )}
                <ScrollView style={{ maxHeight: 190 }} nestedScrollEnabled>
                  {otherLayers.map((l) => {
                    const on = contextLayerIds.has(l.id);
                    const count = l.feature_count || 0;
                    return (
                      <View
                        key={l.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 4,
                        }}
                      >
                        <View
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 5,
                            marginRight: 8,
                            backgroundColor: l.style?.color || l.category?.color || "#93c5fd",
                            opacity: on ? 1 : 0.35,
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: on ? "#1f2937" : "#6b7280" }}>
                            {l.name}
                          </Text>
                          <Text style={{ fontSize: 10, color: "#9ca3af" }}>
                            {l.category?.name || "Uncategorized"} · {count}
                          </Text>
                        </View>
                        <Switch
                          value={on}
                          onValueChange={() => toggleContextLayer(l.id)}
                          trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                          thumbColor={on ? "#2563eb" : "#f4f4f5"}
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>

      {isLoading && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#0f2d5c" />
        </View>
      )}

      {error && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <MaterialIcons name="error-outline" size={40} color="#dc2626" />
          <Text style={{ marginTop: 10, color: "#6b7280", textAlign: "center" }}>
            Could not load the map.
          </Text>
        </View>
      )}

      {!isLoading && !error && (
        <NearbyMapView
          userLocation={null}
          geojson={geojson}
          onSelectFeature={handleSelect}
          onBoundsChange={setBbox}
          fitExtent={layer?.extent || null}
          showContextLegend={contextLayerIds.size > 0}
        />
      )}

      {busy && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: "#fff", marginTop: 10, fontWeight: "600" }}>Preparing parcel…</Text>
        </View>
      )}
    </View>
  );
}
