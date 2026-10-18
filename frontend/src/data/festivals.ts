// Photos and short facts for the festivals page: the big festivals with a
// story, and a photo for each calendar entry that has one.

type Text = { vi: string; en: string };

/** A festival in the photo gallery: the story whose photos it shows and its short name. */
export type FestivalGallery = { key: string; story: string; label: Text };

export const festivalGalleries: FestivalGallery[] = [
  { key: "huong", story: "le-hoi-chua-huong", label: { vi: "Chùa Hương", en: "Perfume Pagoda" } },
  { key: "dong-da", story: "le-hoi-go-dong-da", label: { vi: "Gò Đống Đa", en: "Đống Đa Mound" } },
  { key: "co-loa", story: "le-hoi-co-loa", label: { vi: "Cổ Loa", en: "Cổ Loa" } },
  { key: "hai-ba-trung", story: "le-hoi-den-hai-ba-trung", label: { vi: "Đền Hai Bà Trưng", en: "Trưng Sisters' temple" } },
  { key: "giong", story: "hoi-giong", label: { vi: "Hội Gióng", en: "Gióng Festival" } },
  { key: "quan-su", story: "chua-quan-su", label: { vi: "Chùa Quán Sứ", en: "Quán Sứ Pagoda" } },
  { key: "tet-nguyen-dan", story: "tet-nguyen-dan", label: { vi: "Tết Nguyên Đán", en: "Lunar New Year" } },
  { key: "ong-cong-ong-tao", story: "ong-cong-ong-tao", label: { vi: "Ông Công Ông Táo", en: "Kitchen Gods" } },
  { key: "ram-thang-gieng", story: "ram-thang-gieng", label: { vi: "Rằm tháng Giêng", en: "First full moon" } },
  { key: "le-hoi-chua-thay", story: "le-hoi-chua-thay", label: { vi: "Chùa Thầy", en: "Thầy Pagoda" } },
  { key: "gio-to-hung-vuong", story: "gio-to-hung-vuong", label: { vi: "Giỗ Tổ Hùng Vương", en: "Hùng Kings" } },
  { key: "tet-trung-thu", story: "tet-trung-thu", label: { vi: "Trung thu", en: "Mid-Autumn" } },
  { key: "tet-han-thuc", story: "tet-han-thuc", label: { vi: "Tết Hàn thực", en: "Cold Food Day" } },
  { key: "tiet-thanh-minh", story: "tiet-thanh-minh", label: { vi: "Thanh Minh", en: "Thanh Minh" } },
  { key: "tet-doan-ngo", story: "tet-doan-ngo", label: { vi: "Đoan Ngọ", en: "Đoan Ngọ" } },
];

/**
 * A photo (image key) for each calendar entry that has one, and the story it opens when there is one.
 * Each photo shows the occasion itself or the place where Hanoi marks it (Ba Đình on National Day,
 * the Opera House for the August Revolution, the Flag Tower on Liberation Day).
 */
export const holidayPhotos: Record<string, { image: string; story?: string }> = {
  lunar_new_year: { image: "tet-nguyen-dan-1", story: "tet-nguyen-dan" },
  lunar_new_year_eve: { image: "tet-nguyen-dan-1", story: "tet-nguyen-dan" },
  kitchen_gods: { image: "ong-cong-ong-tao-1", story: "ong-cong-ong-tao" },
  first_full_moon: { image: "ram-thang-gieng-1", story: "ram-thang-gieng" },
  thay_pagoda_festival: { image: "le-hoi-chua-thay-1", story: "le-hoi-chua-thay" },
  hung_kings: { image: "gio-to-hung-vuong-1", story: "gio-to-hung-vuong" },
  mid_autumn: { image: "tet-trung-thu-1", story: "tet-trung-thu" },
  cold_food_festival: { image: "tet-han-thuc-1", story: "tet-han-thuc" },
  thanh_minh: { image: "tiet-thanh-minh-1", story: "tiet-thanh-minh" },
  doan_ngo: { image: "tet-doan-ngo-1", story: "tet-doan-ngo" },
  huong_pagoda_festival: { image: "le-hoi-chua-huong-3", story: "le-hoi-chua-huong" },
  dong_da_festival: { image: "le-hoi-go-dong-da-3", story: "le-hoi-go-dong-da" },
  co_loa_festival: { image: "le-hoi-co-loa-7", story: "le-hoi-co-loa" },
  hai_ba_trung_festival: { image: "le-hoi-den-hai-ba-trung-5", story: "le-hoi-den-hai-ba-trung" },
  soc_temple_festival: { image: "hoi-giong-5", story: "hoi-giong" },
  giong_phu_dong_festival: { image: "hoi-giong-4", story: "hoi-giong" },
  vesak: { image: "chua-quan-su-1", story: "chua-quan-su" },
  vu_lan: { image: "chua-quan-su-3", story: "chua-quan-su" },
  national_day: { image: "lang-chu-tich-ho-chi-minh-2", story: "lang-chu-tich-ho-chi-minh" },
  ho_chi_minh_birthday: { image: "lang-chu-tich-ho-chi-minh-1", story: "lang-chu-tich-ho-chi-minh" },
  reunification_day: { image: "bao-tang-lich-su-quan-su-3", story: "bao-tang-lich-su-quan-su" },
  war_invalids_day: { image: "bao-tang-lich-su-quan-su-2", story: "bao-tang-lich-su-quan-su" },
  august_revolution: { image: "nha-hat-lon-ha-noi-6", story: "nha-hat-lon-ha-noi" },
  capital_liberation: { image: "flag_tower", story: "cot-co-ha-noi" },
  teachers_day: { image: "van-mieu-quoc-tu-giam-3", story: "van-mieu-quoc-tu-giam" },
  christmas: { image: "hidden_gem", story: "nha-tho-lon-ha-noi" },
  new_year: { image: "hero" },
};
