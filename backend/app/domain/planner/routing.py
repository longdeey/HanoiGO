from math import ceil

from app.domain.planner.config import (
    GRAB_BASE_FARE_VND,
    GRAB_CAPACITY,
    GRAB_RATE_VND_PER_KM,
    GRAB_SPEED_KMH,
    GRAB_THRESHOLD_KM,
    GRAB_WAIT_MINUTES,
    MOTORBIKE_BASE_FARE_VND,
    MOTORBIKE_CAPACITY,
    MOTORBIKE_RATE_VND_PER_KM,
    MOTORBIKE_SPEED_KMH,
    ROUTE_BUFFER_MINUTES,
    WALKING_SPEED_KMH,
)
from app.domain.planner.constraints import distance_km
from app.domain.planner.types import PlaceCandidate


def route_order(
    places: list[PlaceCandidate], start_latitude: float, start_longitude: float
) -> list[PlaceCandidate]:
    remaining = list(places)
    ordered: list[PlaceCandidate] = []
    latitude, longitude = start_latitude, start_longitude
    while remaining:
        next_place = min(
            remaining,
            key=lambda place: (
                distance_km(latitude, longitude, place.latitude, place.longitude), place.slug
            ),
        )
        ordered.append(next_place)
        remaining.remove(next_place)
        latitude, longitude = next_place.latitude, next_place.longitude
    return ordered


def travel_leg(
    lat_a: float, lon_a: float, lat_b: float, lon_b: float,
    travel_mode: str, traveler_count: int,
) -> tuple[float, int, int]:
    distance = distance_km(lat_a, lon_a, lat_b, lon_b)
    if distance < 0.001:
        return 0.0, 0, 0
    use_motorbike = travel_mode == "motorbike"
    use_grab = travel_mode in {"grab", "car"} or (
        travel_mode == "walking_grab" and distance > GRAB_THRESHOLD_KM
    )
    if use_motorbike:
        minutes = ceil(distance / MOTORBIKE_SPEED_KMH * 60) + GRAB_WAIT_MINUTES + ROUTE_BUFFER_MINUTES
        bikes = ceil(traveler_count / MOTORBIKE_CAPACITY)
        cost = bikes * (MOTORBIKE_BASE_FARE_VND + ceil(distance * MOTORBIKE_RATE_VND_PER_KM))
    elif use_grab:
        minutes = ceil(distance / GRAB_SPEED_KMH * 60) + GRAB_WAIT_MINUTES + ROUTE_BUFFER_MINUTES
        cars = ceil(traveler_count / GRAB_CAPACITY)
        cost = cars * (GRAB_BASE_FARE_VND + ceil(distance * GRAB_RATE_VND_PER_KM))
    else:
        minutes = ceil(distance / WALKING_SPEED_KMH * 60) + ROUTE_BUFFER_MINUTES
        cost = 0
    return round(distance, 3), minutes, cost
