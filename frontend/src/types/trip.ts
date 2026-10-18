export type Place = {
  id: string; slug: string; name: string; category: string;
  latitude: number; longitude: number; averageCost: number;
  entranceFee: number; averageVisitMinutes: number; indoor: boolean; outdoor: boolean;
  priceVerified: boolean; hoursVerified: boolean;
  priceSource: string | null; hoursSource: string | null;
  highlightLevel: "standard" | "notable" | "must_see";
  availableFrom: string | null; availableUntil: string | null;
  informationSource: string | null;
  annual: boolean;
  ratingAverage?: number;
  ratingCount?: number;
  comments?: PlaceComment[];
  bookingSource?: string | null;
  story?: PlaceStory | null;
};

/** Short link from a place to its history/culture story. */
export type PlaceStory = { slug: string; title: string; teaser: string; readingMinutes: number };

export type StorySummary = {
  slug: string; title: string; teaser: string; imageKey: string | null;
  readingMinutes: number; themes: string[]; featured: boolean;
};

export type StoryDetail = StorySummary & {
  sections: { heading: string; body: string }[];
  timeline: { year: string; text: string }[];
  tips: string[];
  sources: { title: string; url: string }[];
  place: Place | null;
  nearby: (StorySummary & { distanceKm: number })[];
};

export type PlaceComment = {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type ItineraryItem = {
  id: string; sequence: number; place: Place; startTime: string; endTime: string;
  visitMinutes: number; travelMinutes: number; travelKm: number;
  estimatedCost: number; travelCost: number; recommendationScore: number;
  reasons: string[];
  locked: boolean;
};

export type ItineraryDay = {
  dayNumber: number; date: string; theme: string; estimatedCost: number;
  estimatedDistanceKm: number; estimatedTravelMinutes: number; items: ItineraryItem[];
};

export type Budget = {
  attractions: number; food: number; transport: number; others: number;
  total: number; remaining: number;
};

export type ItineraryOption = {
  id: string; type: "BEST_MATCH" | "BUDGET_FRIENDLY" | "EXPLORE_MORE";
  matchScore: number; estimatedTotalCost: number;
  estimatedTotalDistanceKm: number; estimatedTotalTravelMinutes: number;
  totalPlaces: number; budget: Budget; days: ItineraryDay[];
  budgetTargetShare?: number | null; budgetTargetMet?: boolean;
};

export type Holiday = {
  key: string; name: string;
  kind: "public_holiday" | "traditional" | "festival" | "observance";
  isPublicHoliday: boolean; startDate: string; endDate: string; tripDates: string[];
  description: string; suggestion: string; relatedPlaces: Place[];
};

export type TripResponse = {
  tripId: string; language: "en" | "vi";
  travelMode: "walking" | "motorbike" | "car" | "grab" | "walking_grab";
  options: ItineraryOption[];
  seasonalHighlights: { date: string; place: Place }[];
  holidays?: Holiday[];
  stayOptions: Place[];
  startLatitude?: number; startLongitude?: number;
  ownerToken?: string | null;
};
/** GET /weather: one day's afternoon forecast, when available. */
export type Weather = {
  date: string; available: boolean; afternoonRainProbability: number | null; warning: string | null;
};

export type ApiError = {
  success: false; error: { code: string; message: string; details: unknown };
};

export type AuthUser = { id: string; displayName: string; email: string | null; phone: string | null };
export type AuthResponse = { token: string; user: AuthUser };

export type RoadRouteResponse = {
  coordinates: { latitude: number; longitude: number }[];
  roadDistanceKm: number | null; roadDurationMinutes: number | null;
  source: "osrm" | "direct"; warning: string | null;
};
