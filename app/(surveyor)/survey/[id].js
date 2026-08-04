import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import DynamicAttributeField from "../../../components/DynamicAttributeField";
import {
  useAddFeaturePhotosMutation,
  useGetFeatureByIdQuery,
  useGetLayerByIdQuery,
  useSubmitFeatureSurveyMutation,
} from "../../../services/assetSurveyApi";

// Shown title-case; the server upper-cases these to match the DB enum
// (GOOD/FAIR/POOR/DAMAGED/MISSING).
const CONDITIONS = ["Good", "Fair", "Poor", "Damaged", "Missing"];

export default function SurveyFeatureScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const { data: featureRes, isLoading: featureLoading, error: featureError } = useGetFeatureByIdQuery(id, { skip: !id });
  const feature = featureRes?.data;
  const layerId = feature?.properties?.layer_id;

  const { data: layerRes, isLoading: layerLoading } = useGetLayerByIdQuery(layerId, { skip: !layerId });
  const layer = layerRes?.data;

  const [submitSurvey, { isLoading: submitting }] = useSubmitFeatureSurveyMutation();
  const [addPhotos, { isLoading: uploadingPhotos }] = useAddFeaturePhotosMutation();

  // The asset register is being built from scratch, so there is nothing to
  // "verify" or "correct" against — the surveyor is recording values for the
  // first time. The only distinction that still matters is whether the asset
  // needs office follow-up, so the backend action is derived from this toggle.
  const [hasProblem, setHasProblem] = useState(false);
  const [condition, setCondition] = useState("");
  const [fields, setFields] = useState({});
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState([]);

  // Clear everything the moment a different asset is opened.
  //
  // expo-router keeps this screen mounted between visits, so surveying asset B
  // straight after asset A would otherwise show A's answers — and the prefill
  // effect below can't cover it, because it waits for the new feature to load
  // and never touched notes/photos/problem at all.
  useEffect(() => {
    setCondition("");
    setFields({});
    setNotes("");
    setPhotos([]);
    setHasProblem(false);
  }, [id]);

  // Pre-fill from the feature's current attribute values once the layer's
  // schema (and therefore which keys are real attributes) is known.
  useEffect(() => {
    if (!feature || !layer) return;
    // Guard against a stale response: while the new asset loads, RTK Query can
    // still hand back the previously cached feature.
    if (String(feature.properties?.id ?? "") !== String(id)) return;

    const p = feature.properties || {};
    setCondition(typeof p.condition === "string" ? p.condition : "");
    const initial = {};
    (layer.attribute_schema || []).forEach((f) => {
      initial[f.key] = p[f.key] ?? "";
    });
    setFields(initial);
  }, [feature, layer, id]);

  const setField = (key) => (value) => setFields((f) => ({ ...f, [key]: value }));

  const addPhotoFrom = async (source) => {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: "error", text1: "Permission needed", text2: `Allow ${source} access to add a photo.` });
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsMultipleSelection: true });
    if (result.canceled) return;
    setPhotos((prev) => [...prev, ...result.assets]);
  };

  const pickPhoto = () => {
    Alert.alert("Add Photo", "Choose a source", [
      { text: "Camera", onPress: () => addPhotoFrom("camera") },
      { text: "Photo Library", onPress: () => addPhotoFrom("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const removePhoto = (uri) => setPhotos((prev) => prev.filter((p) => p.uri !== uri));

  const handleSubmit = async () => {
    let gps_lat = null;
    let gps_lng = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        gps_lat = pos.coords.latitude;
        gps_lng = pos.coords.longitude;
      }
    } catch {
      /* GPS is best-effort — submit proceeds without it */
    }

    try {
      const res = await submitSurvey({
        featureId: id,
        // FLAG marks the feature for office follow-up; CORRECT_ATTRIBUTE is the
        // plain "here is what I recorded" case, which is what every normal
        // survey now is.
        action: hasProblem ? "FLAG" : "CORRECT_ATTRIBUTE",
        condition: condition || null,
        notes: notes.trim() || null,
        gps_lat,
        gps_lng,
        proposed_properties: Object.keys(fields).length ? fields : null,
      }).unwrap();

      if (photos.length) {
        const formData = new FormData();
        photos.forEach((p, i) => {
          formData.append("photos", {
            uri: p.uri,
            name: p.fileName || `photo_${i}.jpg`,
            type: p.mimeType || "image/jpeg",
          });
        });
        formData.append("asset_survey_id", String(res.data.id));
        await addPhotos({ featureId: id, formData }).unwrap();
      }

      Toast.show({ type: "success", text1: "Survey submitted", text2: "Thanks — an admin will review it." });
      router.back();
    } catch (err) {
      // 409 = this asset already has a survey. Not a failure to retry — send
      // the surveyor back rather than let them keep tapping Submit.
      if (err?.status === 409 || err?.originalStatus === 409) {
        Toast.show({
          type: "info",
          text1: "Already surveyed",
          text2: "Another survey exists for this asset.",
        });
        router.back();
        return;
      }
      Toast.show({ type: "error", text1: "Submit failed", text2: err?.data?.message || "Please try again." });
    }
  };

  if (featureLoading || layerLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0f2d5c" />
      </View>
    );
  }

  if (featureError || !feature) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <MaterialIcons name="error-outline" size={40} color="#dc2626" />
        <Text style={{ marginTop: 10, color: "#6b7280", textAlign: "center" }}>Could not load this asset.</Text>
      </View>
    );
  }

  const p = feature.properties || {};
  const isSubmitting = submitting || uploadingPhotos;
  // Condition has its own control and its own column; every seeded layer also
  // lists it as a question, which showed it twice.
  const schemaFields = (layer?.attribute_schema || []).filter(
    (f) => String(f.key).toLowerCase() !== "condition",
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f5f5f5" }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {/* Feature header */}
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937" }}>
          {layer?.name || "Asset"}{p.feature_code ? ` — ${p.feature_code}` : ""}
        </Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Status: {p.status}</Text>
      </View>

      {/* Details */}
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <DynamicAttributeField
          field={{ key: "condition", label: "Condition", type: "select", options: CONDITIONS }}
          value={condition}
          onChange={setCondition}
        />

        {/* The survey questions for this asset type. Always editable: imported
            features usually arrive with these blank, so locking them unless
            "Correct" was picked left the surveyor unable to record anything.
            `condition` is skipped — it has its own control above, backed by a
            dedicated column, and most layers also list it as a question. */}
        {schemaFields.length > 0 && (
          <>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#374151", marginTop: 6, marginBottom: 10 }}>
              Asset details
            </Text>
            {schemaFields.map((f) => (
              <DynamicAttributeField
                key={f.key}
                field={f}
                value={fields[f.key]}
                onChange={setField(f.key)}
              />
            ))}
          </>
        )}

        <DynamicAttributeField
          field={{ key: "notes", label: "Notes", type: "text" }}
          value={notes}
          onChange={setNotes}
        />
      </View>

      {/* The one case the surveyor can't resolve alone: the asset isn't there,
          can't be reached, or needs the office to decide something. Flagging
          marks it for follow-up instead of leaving it silently blank. */}
      <TouchableOpacity
        onPress={() => setHasProblem((v) => !v)}
        activeOpacity={0.7}
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: hasProblem ? "#dc2626" : "#e5e7eb",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <MaterialIcons
          name={hasProblem ? "check-box" : "check-box-outline-blank"}
          size={22}
          color={hasProblem ? "#dc2626" : "#9ca3af"}
        />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: hasProblem ? "#b91c1c" : "#374151" }}>
            Report a problem with this asset
          </Text>
          <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            Missing, inaccessible, badly damaged — flags it for the office
          </Text>
        </View>
      </TouchableOpacity>

      {/* Photos */}
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 10 }}>Photos</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {photos.map((ph) => (
            <View key={ph.uri} style={{ position: "relative" }}>
              <Image source={{ uri: ph.uri }} style={{ width: 76, height: 76, borderRadius: 8 }} />
              <TouchableOpacity
                onPress={() => removePhoto(ph.uri)}
                style={{
                  position: "absolute", top: -6, right: -6, backgroundColor: "#dc2626",
                  borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center",
                }}
              >
                <MaterialIcons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={pickPhoto}
            style={{
              width: 76, height: 76, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db", borderStyle: "dashed",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <MaterialIcons name="add-a-photo" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isSubmitting}
        style={{
          backgroundColor: isSubmitting ? "#93a5c9" : "#0f2d5c",
          paddingVertical: 15,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Submit Survey</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
