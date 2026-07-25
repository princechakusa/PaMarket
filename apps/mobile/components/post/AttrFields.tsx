import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { attrSchema, SUBCATEGORIES } from "../../lib/attributes";
import { BRAND_BLUE } from "../../lib/constants";

export type AttrValues = Record<string, string | number | string[]>;

export function AttrFields({
  category,
  values,
  onChange,
}: {
  category: string;
  values: AttrValues;
  onChange: (next: AttrValues) => void;
}) {
  const schema = attrSchema(category);
  const subcats = SUBCATEGORIES[category];
  if (!schema.length && !subcats) return null;

  function setValue(key: string, value: string | number | string[]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Details</Text>

      {subcats ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Subcategory</Text>
          <View style={styles.chipWrap}>
            {subcats.map((s) => {
              const selected = values.subcat === s.key;
              return (
                <Pressable
                  key={s.key}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setValue("subcat", s.key)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {schema.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.fieldLabel}>
            {field.label}
            {field.unit ? ` (${field.unit})` : ""}
          </Text>

          {field.type === "select" ? (
            <View style={styles.chipWrap}>
              {field.options?.map((opt) => {
                const selected = values[field.key] === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setValue(field.key, opt)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : field.type === "chips" ? (
            <View style={styles.chipWrap}>
              {field.options?.map((opt) => {
                const current = Array.isArray(values[field.key]) ? (values[field.key] as string[]) : [];
                const selected = current.includes(opt);
                return (
                  <Pressable
                    key={opt}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() =>
                      setValue(field.key, selected ? current.filter((v) => v !== opt) : [...current, opt])
                    }
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <TextInput
              style={styles.input}
              placeholder={field.placeholder}
              placeholderTextColor="#8A93A6"
              keyboardType={field.type === "number" ? "numeric" : "default"}
              value={values[field.key] != null ? String(values[field.key]) : ""}
              onChangeText={(text) => setValue(field.key, field.type === "number" ? Number(text) || 0 : text)}
            />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5A6478",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D8DCE5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8DCE5",
  },
  chipSelected: {
    backgroundColor: BRAND_BLUE,
    borderColor: BRAND_BLUE,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  chipTextSelected: {
    color: "#ffffff",
  },
});
