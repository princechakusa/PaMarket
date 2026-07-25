import categoryAttrsJson from "./category-attrs.json";
import subcategoriesJson from "./subcategories.json";

export type AttrFieldType = "select" | "number" | "text" | "chips";

export type AttrField = {
  key: string;
  label: string;
  type: AttrFieldType;
  options?: string[];
  unit?: string;
  placeholder?: string;
  quick?: boolean;
  icon?: string;
  suffix?: string;
};

export type Subcategory = { key: string; label: string };

// Generated verbatim from www/js/attributes.js H.CATEGORY_ATTRS / H.SUBCATEGORIES.
export const CATEGORY_ATTRS: Record<string, AttrField[]> = categoryAttrsJson as unknown as Record<
  string,
  AttrField[]
>;
export const SUBCATEGORIES: Record<string, Subcategory[]> = subcategoriesJson;

export function attrSchema(category: string): AttrField[] {
  return CATEGORY_ATTRS[category] ?? [];
}

export function subcatLabel(category: string, key: string): string {
  return SUBCATEGORIES[category]?.find((s) => s.key === key)?.label ?? "";
}
