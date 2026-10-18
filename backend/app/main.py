from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes.trips import router as trip_router
from app.application.access import TripAccessDenied
from app.application.auth import AuthError
from app.application.modify import LockedTripItem, MissingTripItem
from app.application.rate_limit import RateLimited
from app.core.config import get_settings
from app.domain.planner.planner import NoFeasibleItinerary
from app.infrastructure.maps.geocoding import GeocodingUnavailable, LocationNotFound

settings = get_settings()
app = FastAPI(title="HanoiGO API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(trip_router)


def error_response(status_code: int, code: str, message: str, details: object = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message, "details": details}},
    )


@app.exception_handler(RequestValidationError)
def validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    details = [{"field": ".".join(str(part) for part in error["loc"]), "message": error["msg"]}
               for error in exc.errors()]
    return error_response(422, "INVALID_REQUEST", "Trip request is invalid.", details)


@app.exception_handler(NoFeasibleItinerary)
def no_feasible_itinerary(_request: Request, exc: NoFeasibleItinerary) -> JSONResponse:
    return error_response(422, "NO_FEASIBLE_ITINERARY", str(exc), list(exc.suggestions))


@app.exception_handler(SQLAlchemyError)
def database_error(_request: Request, _exc: SQLAlchemyError) -> JSONResponse:
    return error_response(503, "DATABASE_UNAVAILABLE", "Database unavailable.")


@app.exception_handler(HTTPException)
def http_error(_request: Request, exc: HTTPException) -> JSONResponse:
    return error_response(exc.status_code, "NOT_FOUND", str(exc.detail))


@app.exception_handler(MissingTripItem)
def missing_trip_item(_request: Request, exc: MissingTripItem) -> JSONResponse:
    return error_response(404, "NOT_FOUND", str(exc))


@app.exception_handler(LockedTripItem)
def locked_trip_item(_request: Request, exc: LockedTripItem) -> JSONResponse:
    return error_response(409, "PLACE_LOCKED", str(exc))


@app.exception_handler(TripAccessDenied)
def trip_access_denied(_request: Request, exc: TripAccessDenied) -> JSONResponse:
    return error_response(403, "TRIP_ACCESS_DENIED", str(exc))


@app.exception_handler(AuthError)
def auth_error(_request: Request, exc: AuthError) -> JSONResponse:
    return error_response(400, "AUTHENTICATION_FAILED", str(exc))


@app.exception_handler(RateLimited)
def rate_limited(_request: Request, exc: RateLimited) -> JSONResponse:
    response = error_response(429, "RATE_LIMITED", str(exc))
    response.headers["Retry-After"] = str(exc.retry_after)
    return response


@app.exception_handler(LocationNotFound)
def location_not_found(_request: Request, exc: LocationNotFound) -> JSONResponse:
    return error_response(404, "LOCATION_NOT_FOUND", str(exc))


@app.exception_handler(GeocodingUnavailable)
def geocoding_unavailable(_request: Request, exc: GeocodingUnavailable) -> JSONResponse:
    return error_response(503, "LOCATION_SERVICE_UNAVAILABLE", str(exc))


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/ready", response_model=None)
def ready() -> dict[str, str] | JSONResponse:
    try:
        engine = create_engine(settings.database_url, pool_pre_ping=True)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        engine.dispose()
    except SQLAlchemyError:
        return error_response(503, "DATABASE_UNAVAILABLE", "Database unavailable.")
    return {"status": "ok"}
