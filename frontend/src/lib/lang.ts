import type { Language } from "@/i18n";

// Letters that only Vietnamese uses among the scripts HanoiGO shows.
const VIETNAMESE = /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i;

/**
 * `lang="vi"` for a Vietnamese proper name shown in the English interface
 * (spec §11), so screen readers pronounce it in Vietnamese. The API already
 * returns English names where it has them; those stay unmarked.
 */
export function nameLang(text: string | null | undefined, language: Language): "vi" | undefined {
  return language === "en" && text && VIETNAMESE.test(text) ? "vi" : undefined;
}
