import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

// Renders one field from an AssetLayer.attribute_schema entry:
// { key, label, type: "text"|"number"|"boolean"|"select", required, options?, unit? }
export default function DynamicAttributeField({ field, value, onChange, editable = true }) {
  if (!field) return null;

  if (field.type === "boolean") {
    return (
      <View style={styles.group}>
        <Text style={styles.label}>{field.label}{field.required ? " *" : ""}</Text>
        <View style={styles.row}>
          {[true, false].map((opt) => (
            <TouchableOpacity
              key={String(opt)}
              disabled={!editable}
              onPress={() => onChange(opt)}
              style={[styles.chip, value === opt && styles.chipActive]}
            >
              <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{opt ? "Yes" : "No"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  if (field.type === "select") {
    return (
      <View style={styles.group}>
        <Text style={styles.label}>{field.label}{field.required ? " *" : ""}</Text>
        <View style={styles.wrapRow}>
          {(field.options || []).map((opt) => (
            <TouchableOpacity
              key={opt}
              disabled={!editable}
              onPress={() => onChange(opt)}
              style={[styles.chip, value === opt && styles.chipActive]}
            >
              <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // text | number
  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        {field.label}{field.required ? " *" : ""}{field.unit ? ` (${field.unit})` : ""}
      </Text>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value === null || value === undefined ? "" : String(value)}
        onChangeText={onChange}
        editable={editable}
        keyboardType={field.type === "number" ? "numeric" : "default"}
        placeholder={editable ? `Enter ${field.label.toLowerCase()}` : ""}
        placeholderTextColor="#9ca3af"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#1f2937",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  inputDisabled: { backgroundColor: "#f3f4f6", color: "#6b7280" },
  row: { flexDirection: "row", gap: 10 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#0f2d5c", borderColor: "#0f2d5c" },
  chipText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  chipTextActive: { color: "#fff" },
});
