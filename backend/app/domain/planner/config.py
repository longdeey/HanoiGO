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
# A stop starts as soon as the traveler arrives from the previous one. Waiting
# for opening hours or a meal slot is absorbed by staying longer at the earlier
# stop (up to this share of its visit) or by starting it later; gaps too long
# for that are filled with extra stops by the planner.
MAX_STAY_EXTENSION_SHARE = 0.5
# Where a slot is fixed on both sides, a stop may stretch to at most this many
# times its usual visit to avoid a wait: a park, village or museum suits a long
# visit better than a meal or a coffee.
MAX_STAY_STRETCH_FACTOR = {"sight": 3, "food": 2}
GAP_FILL_MAX_STEPS = 6
# Free parks and lakes considered when no stop matching the interests fits a gap.
GAP_FILL_FILLER_POOL_SIZE = 20
# A day may leave this much time empty (late start, early finish) before the
# planner adds a stop.
GAP_FILL_START_TOLERANCE_MINUTES = 60

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

# Tags that describe bookkeeping rather than a theme. They never count
# toward the variety an Explore More route is looking for.
META_TAGS = frozenset({"outskirts", "checkin", "hidden_gem", "rest", "family", "hoa_lac"})
