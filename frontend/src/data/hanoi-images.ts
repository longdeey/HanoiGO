import { storyImages } from "./story-photos";
import { holidayImages } from "./holiday-photos";

/** A photo and its credit. Wikimedia photos carry a licence and the original file; story photos name their source only. */
export type HanoiImage = {
  key: string;
  src: string;
  alt: string;
  title: string;
  author: string;
  license: string;
  sourceUrl: string;
};

/** Openly licensed photos from Wikimedia Commons (decoration, home, plan). */
export const wikimediaImages: Record<string, HanoiImage> = {
  "hero": {
    key: "hero",
    src: "/images/hanoi/hero.jpg",
    alt: "Turtle Tower on Hoan Kiem Lake at sunset, Hanoi",
    title: "Turtle Tower, Hoan Kiem Lake",
    author: "Khoitran1957",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Turtle_Tower,_Hoan_Kiem_Lake,_Hanoi_4G4A7301.jpg",
  },
  "old-quarter": {
    key: "old-quarter",
    src: "/images/hanoi/old-quarter.jpg",
    alt: "Motorbikes and gold shops on Hang Bac Street in Hanoi's Old Quarter",
    title: "Hang Bac Street, Old Quarter",
    author: "Benjamin Smith",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Hanoi_-_H%C3%A0ng_B%E1%BA%A1c_Street_-_1.jpg",
  },
  "history": {
    key: "history",
    src: "/images/hanoi/history.jpg",
    alt: "Main gate of the Temple of Literature in Hanoi",
    title: "Temple of Literature main gate",
    author: "Daderot",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Main_gate_-_Temple_of_Literature,_Hanoi_-_DSC04519.JPG",
  },
  "museum": {
    key: "museum",
    src: "/images/hanoi/museum.jpg",
    alt: "Exterior of the Vietnam Museum of Ethnology in Hanoi",
    title: "Vietnam Museum of Ethnology",
    author: "Daderot",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Exterior_view_-_Vietnam_Museum_of_Ethnology_-_Hanoi,_Vietnam_-_DSC03432.JPG",
  },
  "food": {
    key: "food",
    src: "/images/hanoi/food.jpg",
    alt: "Steaming bowl of pho bo with lime and chili in Hanoi",
    title: "Pho bo in Cau Giay, Hanoi",
    author: "Codename5281",
    license: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ph%E1%BB%9F_b%C3%B2,_C%E1%BA%A7u_Gi%E1%BA%A5y,_H%C3%A0_N%E1%BB%99i.jpg",
  },
  "coffee": {
    key: "coffee",
    src: "/images/hanoi/coffee.jpg",
    alt: "Barista preparing Vietnamese egg coffee in a Hanoi cafe",
    title: "Egg coffee, Hanoi",
    author: "Rod Waddington from Kergunyah, Australia",
    license: "CC BY-SA 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Viet_Egg_Coffee_(30918733287).jpg",
  },
  "park": {
    key: "park",
    src: "/images/hanoi/park.jpg",
    alt: "Tran Quoc Pagoda gate on the shore of West Lake, Hanoi",
    title: "Tran Quoc Pagoda, West Lake",
    author: "Guerinf",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Temple_Tr%E1%BA%A5n_Qu%E1%BB%91c.jpg",
  },
  "shopping": {
    key: "shopping",
    src: "/images/hanoi/shopping.jpg",
    alt: "Facade of Dong Xuan Market in Hanoi's Old Quarter",
    title: "Dong Xuan Market",
    author: "Christophe95",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:%C4%90%E1%BB%93ng_Xu%C3%A2n_Market_1.jpg",
  },
  "festival": {
    key: "festival",
    src: "/images/hanoi/festival.jpg",
    alt: "Colourful decoration shops along Hang Ma Street in Hanoi",
    title: "Hang Ma Street, Hanoi",
    author: "Christophe95",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:H%C3%A0ng_M%C3%A3_Street,_Hanoi.jpg",
  },
  "hiking": {
    key: "hiking",
    src: "/images/hanoi/hiking.jpg",
    alt: "Ba Vi mountain peaks rising above a sea of clouds near Hanoi",
    title: "Ba Vi peak",
    author: "Bem photography",
    license: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:%C4%90%E1%BB%89nh_Ba_V%C3%AC.jpg",
  },
  "nature": {
    key: "nature",
    src: "/images/hanoi/nature.jpg",
    alt: "Woman in ao dai walking through a brick alley in Duong Lam ancient village",
    title: "Duong Lam ancient village",
    author: "Quangpraha",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:The-ancient-village-3358830.jpg",
  },
  "craft": {
    key: "craft",
    src: "/images/hanoi/craft.jpg",
    alt: "Artisan hand-crafting pottery in Bat Trang ceramic village",
    title: "Pottery making in Bat Trang",
    author: "Steven C. Price",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Bat-Trang-Ceramic-Village11.jpg",
  },
  "art": {
    key: "art",
    src: "/images/hanoi/art.jpg",
    alt: "Facade of the Hanoi Opera House",
    title: "Hanoi Opera House",
    author: "P. Hughes",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Hanoi_-_Opera_House_01.jpg",
  },
  "local_experience": {
    key: "local_experience",
    src: "/images/hanoi/local_experience.jpg",
    alt: "Long Bien Bridge over the Red River, Hanoi",
    title: "Long Bien Bridge",
    author: "Quangpraha",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Long-bien-bridge-3371617.jpg",
  },
  "accommodation": {
    key: "accommodation",
    src: "/images/hanoi/accommodation.jpg",
    alt: "Facade of the Sofitel Legend Metropole Hotel in Hanoi",
    title: "Sofitel Legend Metropole Hanoi",
    author: "Richard Mortel from Riyadh, Saudi Arabia",
    license: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Sofitel_Legend_Metropole_Hotel,_Hanoi,_1901_(1)_(37610180365).jpg",
  },
  "hidden_gem": {
    key: "hidden_gem",
    src: "/images/hanoi/hidden_gem.jpg",
    alt: "St. Joseph's Cathedral in Hanoi",
    title: "St. Joseph's Cathedral",
    author: "Christophe95",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:St._Joseph%27s_Cathedral_Hanoi_2.jpg",
  },
  "one_pillar_pagoda": {
    key: "one_pillar_pagoda",
    src: "/images/hanoi/one_pillar_pagoda.jpg",
    alt: "One Pillar Pagoda on its lotus pond in Hanoi",
    title: "One Pillar Pagoda",
    author: "Daderot",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:One_Pillar_Pagoda_-_Hanoi,_Vietnam_-_DSC03500.JPG",
  },
  "imperial_citadel": {
    key: "imperial_citadel",
    src: "/images/hanoi/imperial_citadel.jpg",
    alt: "Doan Mon gate of the Imperial Citadel of Thang Long, Hanoi",
    title: "Doan Mon gate, Imperial Citadel of Thang Long",
    author: "Christophe95",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Doan_Mon_Gate_1.jpg",
  },
  "ho_chi_minh_mausoleum": {
    key: "ho_chi_minh_mausoleum",
    src: "/images/hanoi/ho_chi_minh_mausoleum.jpg",
    alt: "Ho Chi Minh Mausoleum on Ba Dinh Square, Hanoi",
    title: "Ho Chi Minh Mausoleum",
    author: "CEphoto, Uwe Aranas",
    license: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Hanoi_Vietnam_Mausoleum-of-Ho-Chi-Minh-03.jpg",
  },
  "flag_tower": {
    key: "flag_tower",
    src: "/images/hanoi/flag_tower.jpg",
    alt: "Flag Tower of Hanoi with the national flag flying",
    title: "Flag Tower of Hanoi",
    author: "Richard Mortel from Riyadh, Saudi Arabia",
    license: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Flag_Tower_of_Hanoi,_1812_(1)_(37608539335).jpg",
  },
};

/** Every photo by key: the Wikimedia set, the story photos and the festival calendar covers. */
export const hanoiImages: Record<string, HanoiImage> = { ...wikimediaImages, ...storyImages, ...holidayImages };

/** Short place names for photo captions (the alt texts stay descriptive). */
export const imagePlaces: Record<string, { vi: string; en: string }> = {
  hero: { vi: "Tháp Rùa, Hồ Gươm", en: "Turtle Tower" },
  "old-quarter": { vi: "Phố Hàng Bạc", en: "Hang Bac Street" },
  history: { vi: "Văn Miếu", en: "Temple of Literature" },
  museum: { vi: "Bảo tàng Dân tộc học", en: "Museum of Ethnology" },
  food: { vi: "Phở bò", en: "Pho bo" },
  coffee: { vi: "Cà phê trứng", en: "Egg coffee" },
  park: { vi: "Chùa Trấn Quốc", en: "Tran Quoc Pagoda" },
  shopping: { vi: "Chợ Đồng Xuân", en: "Dong Xuan Market" },
  festival: { vi: "Phố Hàng Mã", en: "Hang Ma Street" },
  hiking: { vi: "Núi Ba Vì", en: "Ba Vi Mountain" },
  nature: { vi: "Làng cổ Đường Lâm", en: "Duong Lam Village" },
  craft: { vi: "Gốm Bát Tràng", en: "Bat Trang pottery" },
  art: { vi: "Nhà hát Lớn", en: "Opera House" },
  local_experience: { vi: "Cầu Long Biên", en: "Long Bien Bridge" },
  accommodation: { vi: "Khách sạn Metropole", en: "Metropole Hotel" },
  hidden_gem: { vi: "Nhà thờ Lớn", en: "St. Joseph's Cathedral" },
  one_pillar_pagoda: { vi: "Chùa Một Cột", en: "One Pillar Pagoda" },
  imperial_citadel: { vi: "Hoàng thành Thăng Long", en: "Imperial Citadel" },
  ho_chi_minh_mausoleum: { vi: "Lăng Bác", en: "Ho Chi Minh Mausoleum" },
  flag_tower: { vi: "Cột cờ Hà Nội", en: "Hanoi Flag Tower" },
};

