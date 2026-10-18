"""Vietnamese lunisolar calendar conversion (UTC+7).

Implements Hồ Ngọc Đức's astronomical algorithm, the reference used for the
Vietnamese âm lịch: months start on the new moon day in Hanoi time, and the
leap month is the first month without a major solar term.
"""

from datetime import date, timedelta
from functools import lru_cache
from math import floor, pi, sin

TIME_ZONE = 7.0
_SYNODIC_MONTH = 29.530588853
_DR = pi / 180


def _jd_from_date(day: date) -> int:
    return day.toordinal() + 1721425


def _date_from_jd(jd: int) -> date:
    return date.fromordinal(jd - 1721425)


def _new_moon(k: int) -> float:
    t = k / 1236.85
    t2 = t * t
    t3 = t2 * t
    jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3
    jd1 += 0.00033 * sin((166.56 + 132.87 * t - 0.009173 * t2) * _DR)
    m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3
    mpr = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3
    f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3
    c1 = (0.1734 - 0.000393 * t) * sin(m * _DR) + 0.0021 * sin(2 * _DR * m)
    c1 -= 0.4068 * sin(mpr * _DR) + 0.0161 * sin(_DR * 2 * mpr)
    c1 -= 0.0004 * sin(_DR * 3 * mpr)
    c1 += 0.0104 * sin(_DR * 2 * f) - 0.0051 * sin(_DR * (m + mpr))
    c1 -= 0.0074 * sin(_DR * (m - mpr)) + 0.0004 * sin(_DR * (2 * f + m))
    c1 -= 0.0004 * sin(_DR * (2 * f - m)) - 0.0006 * sin(_DR * (2 * f + mpr))
    c1 += 0.0010 * sin(_DR * (2 * f - mpr)) + 0.0005 * sin(_DR * (2 * mpr + m))
    if t < -11:
        delta_t = 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
    else:
        delta_t = -0.000278 + 0.000265 * t + 0.000262 * t2
    return jd1 + c1 - delta_t


def _new_moon_day(k: int) -> int:
    return floor(_new_moon(k) + 0.5 + TIME_ZONE / 24)


def sun_longitude_degrees(jd: float) -> float:
    """Apparent solar longitude in degrees at Julian day ``jd`` (UT)."""
    t = (jd - 2451545.0) / 36525
    t2 = t * t
    m = 357.52910 + 35999.05030 * t - 0.0001559 * t2 - 0.00000048 * t * t2
    l0 = 280.46645 + 36000.76983 * t + 0.0003032 * t2
    dl = (1.914600 - 0.004817 * t - 0.000014 * t2) * sin(_DR * m)
    dl += (0.019993 - 0.000101 * t) * sin(_DR * 2 * m) + 0.000290 * sin(_DR * 3 * m)
    return (l0 + dl) % 360


def _sun_sector(day_number: int) -> int:
    """Index 0..11 of the 30° solar sector at the start of a local day."""
    return floor(sun_longitude_degrees(day_number - 0.5 - TIME_ZONE / 24) / 30)


@lru_cache(maxsize=256)
def _lunar_month_11(year: int) -> int:
    off = _jd_from_date(date(year, 12, 31)) - 2415021
    k = floor(off / _SYNODIC_MONTH)
    new_moon = _new_moon_day(k)
    if _sun_sector(new_moon) >= 9:
        new_moon = _new_moon_day(k - 1)
    return new_moon


def _leap_month_offset(a11: int) -> int:
    k = floor((a11 - 2415021.076998695) / _SYNODIC_MONTH + 0.5)
    i = 1
    arc = _sun_sector(_new_moon_day(k + i))
    while True:
        last = arc
        i += 1
        arc = _sun_sector(_new_moon_day(k + i))
        if arc == last or i >= 14:
            break
    return i - 1


def lunar_to_solar(lunar_year: int, month: int, day: int, leap: bool = False) -> date | None:
    """Solar date of a lunar date, or None when it does not exist (e.g. a missing leap month)."""
    if month < 11:
        a11, b11 = _lunar_month_11(lunar_year - 1), _lunar_month_11(lunar_year)
    else:
        a11, b11 = _lunar_month_11(lunar_year), _lunar_month_11(lunar_year + 1)
    k = floor(0.5 + (a11 - 2415021.076998695) / _SYNODIC_MONTH)
    off = (month - 11) % 12
    if b11 - a11 > 365:
        leap_off = _leap_month_offset(a11)
        leap_month = (leap_off - 2) % 12
        if leap and month != leap_month:
            return None
        if leap or off >= leap_off:
            off += 1
    elif leap:
        return None
    month_start = _new_moon_day(k + off)
    next_start = _new_moon_day(k + off + 1)
    if day > next_start - month_start:
        return None
    return _date_from_jd(month_start + day - 1)


def solar_to_lunar(solar: date) -> tuple[int, int, int, bool]:
    """Return (lunar_year, month, day, is_leap_month) for a solar date."""
    day_number = _jd_from_date(solar)
    k = floor((day_number - 2415021.076998695) / _SYNODIC_MONTH)
    month_start = _new_moon_day(k + 1)
    if month_start > day_number:
        month_start = _new_moon_day(k)
    a11 = _lunar_month_11(solar.year)
    b11 = a11
    if a11 >= month_start:
        lunar_year = solar.year
        a11 = _lunar_month_11(solar.year - 1)
    else:
        lunar_year = solar.year + 1
        b11 = _lunar_month_11(solar.year + 1)
    lunar_day = day_number - month_start + 1
    diff = floor((month_start - a11) / 29)
    leap = False
    lunar_month = diff + 11
    if b11 - a11 > 365:
        leap_diff = _leap_month_offset(a11)
        if diff >= leap_diff:
            lunar_month = diff + 10
            if diff == leap_diff:
                leap = True
    if lunar_month > 12:
        lunar_month -= 12
    if lunar_month >= 11 and diff < 4:
        lunar_year -= 1
    return lunar_year, lunar_month, lunar_day, leap


def solar_term_date(year: int, longitude: float) -> date:
    """First local day on which the sun's longitude reaches ``longitude`` degrees."""
    # Spring equinox (0°) is around 20 March; each degree is roughly a day.
    guess = date(year, 3, 20) + timedelta(days=round(((longitude % 360) * 365.2422) / 360))
    day = guess - timedelta(days=4)
    for _ in range(10):
        start = sun_longitude_degrees(_jd_from_date(day) - 0.5 - TIME_ZONE / 24)
        end = sun_longitude_degrees(_jd_from_date(day) + 0.5 - TIME_ZONE / 24)
        if (end - longitude) % 360 < (end - start) % 360:
            return day
        day += timedelta(days=1)
    return guess
