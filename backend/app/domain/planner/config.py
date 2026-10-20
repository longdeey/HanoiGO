SCORE_WEIGHTS = {
    "interest": 0.30,
    "geography": 0.20,
    "time": 0.15,
    "budget": 0.10,
    "weather": 0.10,
    "local": 0.10,
    "traveler": 0.05,
}

# Layer 2. When two places score within DISCOVERY_TIE_THRESHOLD points of each
# other (out of 100) they are treated as equally suitable, and
# DiscoveryScore = 0.3 * FeaturedTier + 0.7 * FeedbackScore decides their order.
DISCOVERY_TIE_THRESHOLD = 6
DISCOVERY_WEIGHTS = {"featured": 0.3, "feedback": 0.7}
FEATURED_TIER_SCORES = {"must_see": 100.0, "notable": 70.0, "standard": 40.0}
# FeedbackScore uses a Bayesian average of 1-5 star reviews so one glowing
# review cannot outrank a place with many consistent ratings. A place with no
# reviews sits at the prior.
FEEDBACK_PRIOR_RATING = 3.5
FEEDBACK_PRIOR_WEIGHT = 5

# User-facing radius presets. The selected preset is still bounded by the
# travel mode so a walking plan never quietly expands into a city-wide trek.
TRAVEL_RADIUS_KM = {
    "near": 5.0,
    "balanced": 15.0,
    "wide": 30.0,
    "outskirts": 80.0,
}
TRAVEL_MODE_DISTANCE_CAP_KM = {
    "walking": 10.0,
    "walking_grab": 35.0,
    "grab": 50.0,
    "motorbike": 80.0,
    "car": 80.0,
}

# Broad bounding rectangle of Hanoi, including peripheral districts. The
# geocoder still requires a Vietnam result and a user-submitted address.
HANOI_LAT_MIN = 20.45
HANOI_LAT_MAX = 21.55
HANOI_LON_MIN = 105.18
HANOI_LON_MAX = 106.25

WALKING_SPEED_KMH = 4.5
GRAB_SPEED_KMH = 18.0
GRAB_THRESHOLD_KM = 1.8
GRAB_WAIT_MINUTES = 5
GRAB_BASE_FARE_VND = 10_000
GRAB_RATE_VND_PER_KM = 12_000
GRAB_CAPACITY = 4
MOTORBIKE_SPEED_KMH = 22.0
MOTORBIKE_BASE_FARE_VND = 7_000
MOTORBIKE_RATE_VND_PER_KM = 5_000
MOTORBIKE_CAPACITY = 1
ROUTE_BUFFER_MINUTES = 2
MAX_CANDIDATES = 60
RAIN_PROBABILITY_THRESHOLD = 0.6
# Each day still to plan keeps at least this share of an equal daily budget, so
# one premium dinner cannot leave the last day with a single snack.
FUTURE_DAY_BUDGET_SHARE = 0.75
ESTIMATED_COST_BUFFER_SHARE = 0.05
MAX_BALANCED_STOP_BUDGET_SHARE = 0.45
# How far below the traveler's total budget an option may land. Best Match and
# Explore More use the money offered (within 5% / 10%) without exceeding it;
# Budget Friendly has no floor.
BUDGET_TARGET_TOLERANCE = {"BEST_MATCH": 0.05, "EXPLORE_MORE": 0.10}
BUDGET_FILL_MAX_STEPS = 30
BUDGET_FILL_POOL_SIZE = 30
MAIN_MEAL_MINUTES = 60
LUNCH_START_MINUTE = 11 * 60
LUNCH_END_MINUTE = 14 * 60
# A morning stop may end this long after LUNCH_START_MINUTE and still come before lunch.
LUNCH_MORNING_OVERRUN_MINUTES = 30
DINNER_START_MINUTE = 17 * 60
EARLIEST_DINNER_MINUTE = 17 * 60
STAY_NEARBY_RADIUS_KM = 5.0
# Light food: a dessert, a snack or a drink that fits right after a meal. Coffee
# is always light; a food place is light when tagged "dessert" or named so.
LIGHT_FOOD_WORDS = (
    "chè", "kem", "sữa chua", "tào phớ", "caramen", "bánh flan", "bánh ngọt", "trà sữa", "nước mía",
    "hoa quả", "dessert", "gelato", "ice cream", "bingsu", "yogurt", "bakery", "sweet",
)
# Time between the starts of two main dishes. On a trip with several interests
# a main dish is also never followed directly by another (a dessert, a coffee or
# a sight comes between); on a food-only or single-interest trip two may follow
# each other, never three.
MAIN_DISH_SPACING_MINUTES = {"diverse": 120, "single": 90}
# Light food (a dessert or, on coffee trips, a café) taken right after lunch
# and after dinner; at most one per meal.
TREATS_PER_DAY = 2
# A day starts at most this long after the traveler's start time and ends at
# most this long before their end time.
DAY_EDGE_TOLERANCE_MINUTES = 30
# Rough ride between two evening stops when planning how many fit after dinner.
EVENING_LEG_MINUTES = 10
# Hanoi's must-see places a day aims for (at least one, two on fuller days).
MUST_SEE_PER_DAY = 2
# Famous (must-see or notable) stops chosen up front for one day: the must-see
# quota plus one per interest the traveler picked that those do not cover.
MAX_FAMOUS_PER_DAY = 4
# How much closer a famous place counts as when ordering a day's candidates
# (per tier: notable 1, must-see 2), so a famous place beats an ordinary one nearby.
FAMOUS_DISTANCE_BONUS_KM = 1.5
# A famous eatery counts this many FinalScore points more when choosing a meal.
FAMOUS_MEAL_BONUS = 10
# A trip starting this far from Hoàn Kiếm Lake visits, every day, a famous place
# within LOCAL_STOP_RADIUS_KM of where the traveler stays, not only the centre.
HANOI_CENTRE = (21.0287, 105.8522)
OUTER_START_KM = 8.0
LOCAL_STOP_RADIUS_KM = 10.0
# From such a base, sights further than this are a separate outing: odd days stay
# around the base (its famous places, nearby meals), even days go to them, so no
# day rides downtown for breakfast and back.
FAR_FROM_BASE_KM = 15.0
# Stops added to fill a gap come from near the day's route first, so an
# evening is not spent riding across town to a park.
GAP_FILL_NEARBY_KM = {"walking": 2.0, "walking_grab": 4.0, "grab": 6.0, "motorbike": 6.0, "car": 8.0}
# A stop starts as soon as the traveler arrives from the previous one. Waiting
# for opening hours or a meal slot is absorbed by staying longer at the earlier
# stop (up to this share of its visit) or by starting it later; gaps too long
# for that are filled with extra stops by the planner.
MAX_STAY_EXTENSION_SHARE = 0.5
# Where a slot is fixed on both sides, a stop may stretch to at most this many
# times its usual visit to avoid a wait: a park, village or museum suits a long
# visit better than a meal or a coffee.
MAX_STAY_STRETCH_FACTOR = {"sight": 3, "food": 2}
# The day's last stop, when it is dinner, may run up to this many times its
# usual length: an unhurried dinner fills a quiet evening up to the
# traveler's end time when nothing else nearby is open that late.
LAST_DINNER_STRETCH_FACTOR = 3
GAP_FILL_MAX_STEPS = 10
# Desserts and cafés considered when filling a gap or separating two main dishes.
LIGHT_FOOD_POOL_SIZE = 8
# Seated meals offered to the gap filler when a day has lost its lunch or dinner.
MISSING_MEAL_POOL_SIZE = 8
# Moves tried per day to separate main dishes that come too close together.
REPAIR_MAX_STEPS = 4
REPAIR_POOL_SIZE = 25
# Sights tried in place of a main dish on a day with more than two of them.
REPAIR_SWAP_SIGHTS = 10
# Other meals kept in reserve for each meal slot, tried in turn when the first
# choice does not fit the day (too costly for the money left, closed by then).
MEAL_ALTERNATES = 4
# A meal chosen for a slot costs at most this share of the money left for the day.
MAX_MEAL_DAY_BUDGET_SHARE = 0.5
# Free parks and lakes considered when no stop matching the interests fits a gap.
GAP_FILL_FILLER_POOL_SIZE = 20
# A day may leave this much time empty (late start, early finish) before the
# planner adds a stop.
GAP_FILL_START_TOLERANCE_MINUTES = 60
# Candidates tried in place of an extra stop when a full day still starts late
# or ends early.
GAP_FILL_SWAP_POOL = 10

# Route improvement. After the meal slots and opening hours fix the rough
# shape of a day, a local search (segment reversal, swapping two stops, moving
# a run of one to three stops) removes zig-zags such as A -> B -> C when C is
# next to A. It runs until no move helps, capped at this many accepted moves.
# Waiting between stops is converted into a distance penalty so a shorter route
# never comes at the price of an empty gap; a later start of the day is free.
ROUTE_IMPROVEMENT_PASSES = 60
ROUTE_MOVE_MAX_SEGMENT = 3
# When no visiting order avoids a detour (the meal slot fixes when a restaurant
# is visited), a meal may be swapped for a comparable one closer to the route:
# same kind of meal, at most this many points lower in FinalScore, and only if
# the day becomes at least MEAL_SWAP_MIN_GAIN_KM shorter. The closest
# MEAL_SWAP_CANDIDATES alternatives are tried per meal.
MEAL_SWAP_SCORE_SLACK = 5
MEAL_SWAP_MIN_GAIN_KM = 0.5
MEAL_SWAP_CANDIDATES = 5
IDLE_MINUTE_KM_EQUIVALENT = 0.02
RAIN_AFTERNOON_START_MINUTE = 14 * 60
# Meals are chosen near the day's main attraction so lunch does not pull the
# route across the city and back.
MEAL_DISTANCE_PENALTY_PER_KM = 4.0
# Budget meals: VND a point of FinalScore is worth when choosing between cheap
# eateries, so a well-known one beats an anonymous one costing a little less.
BUDGET_MEAL_QUALITY_VND = 1_000
# FinalScore points held against a meal serving the same dish as one already
# chosen that day (chả cá for lunch, then chả cá again for dinner).
SAME_DISH_PENALTY = 30

# Tags that describe bookkeeping rather than a theme. They never count
# toward the variety an Explore More route is looking for.
META_TAGS = frozenset({"outskirts", "checkin", "hidden_gem", "rest", "family", "hoa_lac"})
