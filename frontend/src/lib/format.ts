import type { Language } from "@/i18n";

const VI_WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const VI_WEEKDAYS_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const EN_WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EN_MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];

/** "2.850.000 đ" (VI) or "2,850,000 VND" (EN). */
export function formatMoney(value: number, language: Language): string {
  const amount = Math.round(value);
  return language === "vi"
    ? `${new Intl.NumberFormat("vi-VN").format(amount)} đ`
    : `${new Intl.NumberFormat("en-US").format(amount)} VND`;
}

/** Number part only, for inputs and running counters. */
export function formatAmount(value: number, language: Language): string {
  return new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US").format(Math.round(value));
}

/** "3,4 km" (VI) or "3.4 km" (EN). */
export function formatKm(value: number, language: Language): string {
  return `${new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).format(value)} km`;
}

/** "1 giờ 30 phút" (VI) or "1 h 30 min" (EN). */
export function formatDuration(minutes: number, language: Language): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (language === "vi") {
    if (hours === 0) return `${rest} phút`;
    return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`;
  }
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Parse "YYYY-MM-DD" as a calendar date (no time-zone shift). */
export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Today's date in Hanoi as "YYYY-MM-DD". */
export function todayInHanoi(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** "Chủ Nhật, 18/10" (VI) or "Sun 18 Oct" (EN). */
export function formatDayLong(iso: string, language: Language): string {
  const date = parseIsoDate(iso);
  return language === "vi"
    ? `${VI_WEEKDAYS[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}`
    : `${EN_WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()} ${EN_MONTHS[date.getMonth()]}`;
}

/** "CN 18/10" (VI) or "Sun 18 Oct" (EN), for compact day tabs. */
export function formatDayShort(iso: string, language: Language): string {
  const date = parseIsoDate(iso);
  return language === "vi"
    ? `${VI_WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`
    : `${EN_WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()} ${EN_MONTHS[date.getMonth()]}`;
}

/** "18/10" (VI) or "18 Oct" (EN). */
export function formatDateNumeric(iso: string, language: Language): string {
  const date = parseIsoDate(iso);
  return language === "vi" ? `${date.getDate()}/${date.getMonth() + 1}` : `${date.getDate()} ${EN_MONTHS[date.getMonth()]}`;
}

/** "18–20/10" or "18/10 đến 2/11" (VI); "18–20 Oct" or "18 Oct – 2 Nov" (EN). */
export function formatDateRange(startIso: string, endIso: string, language: Language): string {
  if (startIso === endIso) return formatDateNumeric(startIso, language);
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return language === "vi"
      ? `${start.getDate()}–${end.getDate()}/${end.getMonth() + 1}`
      : `${start.getDate()}–${end.getDate()} ${EN_MONTHS[end.getMonth()]}`;
  }
  return language === "vi"
    ? `${formatDateNumeric(startIso, language)} đến ${formatDateNumeric(endIso, language)}`
    : `${formatDateNumeric(startIso, language)} – ${formatDateNumeric(endIso, language)}`;
}

/** "Tháng 10" (VI) or "October" (EN), optionally with the year. */
export function formatMonth(iso: string, language: Language, withYear = false): string {
  const date = parseIsoDate(iso);
  const name = language === "vi" ? `Tháng ${date.getMonth() + 1}` : EN_MONTHS_LONG[date.getMonth()];
  return withYear ? `${name}${language === "vi" ? ", " : " "}${date.getFullYear()}` : name;
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Straight-line distance in km (same formula as the backend estimate). */
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Sentence case: capitalise only the first letter ("lịch sử" -> "Lịch sử"). */
export function sentence(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase("vi") + text.slice(1) : text;
}
