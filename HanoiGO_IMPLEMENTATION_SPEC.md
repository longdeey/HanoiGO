# HanoiGO – Implementation Specification & AI Coding Prompt

> **Mục đích của tài liệu này**  
> Tài liệu này là đặc tả kỹ thuật dùng để yêu cầu một AI coding agent xây dựng **HanoiGO** theo đúng phạm vi MVP. AI phải coi tài liệu này là **nguồn yêu cầu chính**, không tự ý mở rộng phạm vi nếu chưa được yêu cầu.
>
> **Mục tiêu sản phẩm**  
> HanoiGO là một web **ALL-IN-ONE lập và tối ưu lịch trình du lịch Hà Nội**. Người dùng nhập các ràng buộc như số ngày, ngân sách, số người, sở thích, vị trí bắt đầu, khoảng cách/phạm vi di chuyển, phương tiện và nhịp độ chuyến đi. Hệ thống sẽ lọc địa điểm phù hợp, tối ưu theo ngân sách – khoảng cách – thời gian – giờ mở cửa – thời tiết, sau đó trả về các lịch trình cụ thể để người dùng lựa chọn và sử dụng trực tiếp khi du lịch tại Hà Nội.

---

# 1. Product Vision

## 1.1. Định vị sản phẩm

HanoiGO **không phải chatbot du lịch** và không lấy chatbot làm tính năng cốt lõi.

HanoiGO được định vị là:

> **AI-powered Hanoi itinerary planning platform that builds practical travel plans around the user's constraints.**

Giá trị cốt lõi:

1. Hiểu ràng buộc của người dùng.
2. Tìm địa điểm phù hợp từ dữ liệu Hà Nội đã được cấu trúc.
3. Tối ưu lịch trình theo thời gian, khoảng cách, ngân sách và sở thích.
4. Hiển thị lịch trình rõ ràng theo timeline và bản đồ.
5. Cho phép thay đổi địa điểm / tái tối ưu mà không cần hội thoại chatbot.

## 1.2. Những gì sản phẩm phải giải quyết

Người dùng hiện thường phải dùng nhiều công cụ riêng biệt:

- Google Maps để tìm đường.
- Blog/TikTok/TripAdvisor để tìm địa điểm.
- Weather app để xem thời tiết.
- Excel/Notes để tự xếp lịch.
- Máy tính để ước lượng ngân sách.

HanoiGO phải gom quy trình trên vào **một web duy nhất**.

## 1.3. Mục tiêu MVP

MVP phải hoàn thiện thật tốt chuỗi nghiệp vụ:

```text
Nhập ràng buộc
    ↓
Lọc địa điểm phù hợp
    ↓
Chấm điểm địa điểm
    ↓
Phân cụm theo vị trí
    ↓
Xếp lịch theo ngày / buổi
    ↓
Tối ưu tuyến đường
    ↓
Tính ngân sách
    ↓
Kiểm tra điều kiện hợp lệ
    ↓
Sinh nhiều phương án lịch trình
    ↓
Người dùng chọn
    ↓
Xem timeline + map + chi phí
    ↓
Replace / Re-optimize
```

---

# 2. Scope của MVP

## 2.1. Bắt buộc phải có

### A. Trip Input / Constraint Form

Người dùng phải có thể nhập:

- Số ngày.
- Số người.
- Tổng ngân sách.
- Địa điểm lưu trú / điểm bắt đầu.
- Sở thích.
- Nhịp độ du lịch.
- Phương tiện ưu tiên.
- Phạm vi/khoảng cách di chuyển mong muốn.
- Loại trải nghiệm mong muốn.
- Giờ bắt đầu trong ngày.

Các trường nâng cao có thể thêm:

- Solo / Couple / Friends / Family.
- Có trẻ em / người cao tuổi hay không.
- Vegetarian / halal / dietary preference.
- Tránh nơi đông người.
- Ưu tiên indoor/outdoor.
- Hidden gems / famous places / local experiences.

### B. Recommendation Engine

Hệ thống phải:

- Lấy dữ liệu POI từ database.
- Lọc theo hard constraints.
- Chấm điểm theo soft constraints.
- Chọn candidate POIs tốt nhất.
- Không phụ thuộc hoàn toàn vào LLM.

### C. Itinerary Generator

Hệ thống phải sinh ít nhất **3 phương án**:

1. **Best Match** – cân bằng tốt nhất.
2. **Budget Friendly** – giảm chi phí.
3. **Explore More** – trải nghiệm nhiều hơn / đa dạng hơn.

Mỗi phương án phải bao gồm:

- Tổng chi phí dự kiến.
- Tổng quãng đường dự kiến.
- Tổng thời gian di chuyển.
- Tổng số địa điểm.
- Lịch từng ngày.
- Timeline theo từng khung giờ.
- Chi phí từng hoạt động nếu có.
- Thời gian tham quan dự kiến.
- Thời gian di chuyển giữa hai điểm.

### D. Interactive Map

Phải có:

- Marker theo thứ tự hành trình.
- Route giữa các điểm.
- Đồng bộ với timeline.
- Khi đổi địa điểm, map phải update.
- Khi đổi ngày, map chỉ hiển thị route của ngày đó.

### E. Budget Engine

Phải tính được tối thiểu:

- Vé tham quan.
- Ăn uống.
- Di chuyển.
- Chi phí khác dự kiến.

Phải có:

```text
Estimated Cost
Budget Limit
Remaining Budget
```

Hệ thống không được tạo itinerary vượt budget nếu budget là hard constraint, trừ khi không có phương án khả thi và phải trả warning rõ ràng.

### F. Replace Place

Người dùng có thể thay một địa điểm bằng địa điểm khác.

Luồng:

```text
User chọn Place
    ↓
Replace
    ↓
Chọn lý do
    ↓
Tìm alternative
    ↓
Kiểm tra budget/time/distance
    ↓
Thay địa điểm
    ↓
Recalculate route
    ↓
Recalculate budget
```

Các lý do:

- Too far.
- Too expensive.
- Not interested.
- Already visited.
- Prefer indoor.
- Prefer local place.

### G. Re-optimize

Quick actions:

- Reduce cost.
- Reduce travel distance.
- Prefer indoor.
- More local places.
- More food experiences.
- More check-in places.
- Regenerate current day.

### H. Weather-aware Planning

MVP nên có weather integration.

Ví dụ:

```text
Nếu khả năng mưa cao vào 14:00–17:00
→ ưu tiên indoor POI trong khoảng này.
```

### I. Vietnamese / English

UI phải có khả năng hỗ trợ:

- `vi`
- `en`

MVP có thể dùng static translation dictionary.

---

# 3. Những chức năng KHÔNG thuộc MVP

Không tập trung vào các chức năng sau trong lần triển khai đầu tiên:

- Full AI chatbot.
- Social network.
- Community post.
- Review system phức tạp.
- Payment.
- Premium subscription.
- B2B API.
- Mobile app native.
- Fine-tuning model.
- Real-time traffic nâng cao.
- Leaderboard.
- Complex authentication/authorization.

Nếu có thời gian, có thể thêm:

- Share link.
- Save trip.
- Export PDF.

Nhưng các phần này chỉ được làm **sau khi core flow chạy ổn định và test pass**.

---

# 4. Nguyên tắc kỹ thuật bắt buộc

## 4.1. Không sử dụng microservices cho MVP

Dùng **Modular Monolith**.

Lý do:

- Dễ phát triển.
- Dễ debug.
- Dễ test.
- Dễ deploy.
- Phù hợp nhóm nhỏ.

Kiến trúc tổng quát:

```text
Frontend
  ↓
Backend API
  ↓
Application Services
  ↓
Planner Engine
  ↓
Database / External APIs
```

## 4.2. LLM không được quyết định logic quan trọng

Không dùng LLM để tự tính:

- Budget.
- Khoảng cách.
- Giờ mở cửa.
- Route.
- Thời gian di chuyển.
- Tính hợp lệ của itinerary.

Những phần này phải được xử lý bằng code, database và API có cấu trúc.

LLM chỉ dùng cho:

- Parse free-text preference thành structured constraints.
- Sinh mô tả tự nhiên.
- Giải thích lý do đề xuất.
- Semantic matching nâng cao nếu cần.

## 4.3. Không để frontend phụ thuộc trực tiếp dữ liệu trả tự do từ LLM

Mọi response itinerary phải tuân theo JSON schema cố định.

---

# 5. Tech Stack đề xuất

## 5.1. Frontend

```text
Next.js
TypeScript
Tailwind CSS
TanStack Query
Zod
React Hook Form
```

Có thể dùng Zustand nếu cần global client state.

## 5.2. Backend

```text
Python 3.12+
FastAPI
Pydantic v2
SQLAlchemy 2
Alembic
Pytest
HTTPX
```

## 5.3. Database

```text
PostgreSQL
PostGIS
```

Optional sau:

```text
pgvector
```

## 5.4. External Services

Một map provider duy nhất:

- Google Maps Platform hoặc Mapbox.

Một weather provider:

- OpenWeatherMap hoặc provider tương đương.

LLM provider:

- OpenAI-compatible API.

Không trộn nhiều provider cho cùng một chức năng trong MVP.

---

# 6. Kiến trúc hệ thống

```text
┌────────────────────────────────────────────┐
│                 Web Client                 │
│ Next.js + TypeScript + Tailwind            │
└───────────────────────┬────────────────────┘
                        │ REST/JSON
                        ▼
┌────────────────────────────────────────────┐
│                  FastAPI                   │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ Presentation/API Layer               │  │
│  └─────────────────────┬────────────────┘  │
│                        ▼                   │
│  ┌──────────────────────────────────────┐  │
│  │ Application Layer                    │  │
│  │ TripService                          │  │
│  │ PlaceService                         │  │
│  │ OptimizationService                  │  │
│  └─────────────────────┬────────────────┘  │
│                        ▼                   │
│  ┌──────────────────────────────────────┐  │
│  │ Domain / Planner Engine              │  │
│  │ Constraint Engine                    │  │
│  │ Ranking Engine                       │  │
│  │ Clustering Engine                    │  │
│  │ Schedule Builder                     │  │
│  │ Route Optimizer                      │  │
│  │ Budget Calculator                    │  │
│  │ Validator                            │  │
│  └─────────────────────┬────────────────┘  │
│                        ▼                   │
│  ┌──────────────────────────────────────┐  │
│  │ Infrastructure                       │  │
│  │ PostgreSQL/PostGIS                   │  │
│  │ Map Provider                         │  │
│  │ Weather Provider                     │  │
│  │ LLM Provider                         │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

---

# 7. Repository Structure

Khuyến nghị monorepo:

```text
hanoigo/
│
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── Makefile
│
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── plan/
│   │   │   ├── trips/
│   │   │   └── api/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── trip-form/
│   │   │   ├── itinerary/
│   │   │   ├── map/
│   │   │   └── budget/
│   │   ├── features/
│   │   │   ├── trip-planning/
│   │   │   ├── itinerary/
│   │   │   └── place-replacement/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── types/
│   │   └── i18n/
│   └── tests/
│
└── backend/
    ├── pyproject.toml
    ├── alembic.ini
    ├── app/
    │   ├── main.py
    │   ├── core/
    │   │   ├── config.py
    │   │   ├── logging.py
    │   │   └── exceptions.py
    │   ├── api/
    │   │   ├── router.py
    │   │   └── routes/
    │   │       ├── trips.py
    │   │       ├── places.py
    │   │       ├── weather.py
    │   │       └── health.py
    │   ├── domain/
    │   │   ├── models/
    │   │   ├── enums/
    │   │   ├── services/
    │   │   └── planner/
    │   │       ├── constraints.py
    │   │       ├── ranking.py
    │   │       ├── clustering.py
    │   │       ├── scheduling.py
    │   │       ├── routing.py
    │   │       ├── budgeting.py
    │   │       └── validation.py
    │   ├── application/
    │   │   ├── dto/
    │   │   ├── services/
    │   │   └── use_cases/
    │   ├── infrastructure/
    │   │   ├── db/
    │   │   ├── repositories/
    │   │   ├── maps/
    │   │   ├── weather/
    │   │   └── ai/
    │   └── tests/
    │       ├── unit/
    │       ├── integration/
    │       └── e2e/
    └── migrations/
```

---

# 8. Domain Model

## 8.1. Place

Tối thiểu cần các field:

```text
id
slug
name_vi
name_en
latitude
longitude
category
tags
description_vi
description_en
average_cost
entrance_fee
average_visit_minutes
indoor
outdoor
experience_type
crowd_level
local_score
opening_hours
best_time_slots
suitable_for
verified
verified_at
source
is_active
created_at
updated_at
```

## 8.2. TripRequest

```text
id
language
start_date
days
traveler_count
budget_total
start_location
start_latitude
start_longitude
travel_mode
travel_radius_mode
pace
interests
experience_preferences
dietary_preferences
special_requirements
daily_start_time
daily_end_time
created_at
```

## 8.3. Itinerary

```text
id
trip_request_id
option_type
match_score
estimated_total_cost
estimated_total_distance_km
estimated_total_travel_minutes
status
created_at
```

## 8.4. ItineraryDay

```text
id
itinerary_id
day_number
date
theme
estimated_cost
estimated_distance_km
estimated_travel_minutes
```

## 8.5. ItineraryItem

```text
id
itinerary_day_id
place_id
sequence
start_time
end_time
estimated_visit_minutes
estimated_cost
travel_from_previous_minutes
travel_from_previous_km
recommendation_score
recommendation_reasons
locked
```

---

# 9. Database Rules

## 9.1. Không lưu dữ liệu có thể tính lại nếu không cần thiết

Có thể cache các giá trị route hoặc scoring nhưng phải phân biệt:

- Source data.
- Derived data.

## 9.2. Monetary data

Tiền VND nên lưu dạng integer.

Ví dụ:

```text
1500000
```

Không dùng floating point cho tiền.

## 9.3. Coordinates

Dùng PostGIS `geography(Point, 4326)` hoặc kiểu phù hợp.

## 9.4. Opening Hours

Không lưu opening hours dưới dạng free text duy nhất.

Cần structured format hỗ trợ validate theo ngày/giờ.

---

# 10. Constraints

## 10.1. Hard Constraints

Hard constraints không được phép vi phạm.

Ví dụ:

```text
number_of_days
budget_limit
opening_hours
place_active
route_possible
activity_duration_fits_time_window
```

Nếu hệ thống không tìm được plan hợp lệ:

```json
{
  "success": false,
  "code": "NO_FEASIBLE_ITINERARY",
  "message": "No itinerary satisfies all required constraints.",
  "suggestions": [
    "Increase budget",
    "Increase travel radius",
    "Reduce number of interests"
  ]
}
```

Không được tự ý phá hard constraint để trả kết quả trông có vẻ hợp lệ.

## 10.2. Soft Constraints

Ví dụ:

```text
interest_match
travel_distance_preference
crowd_preference
local_experience
hidden_gem
indoor_preference
food_preference
pace
```

---

# 11. Recommendation Scoring

MVP dùng công thức deterministic trước.

Ví dụ:

```text
FinalScore =
    InterestMatch        * 0.30
  + GeographicFit       * 0.20
  + TimeFit             * 0.15
  + BudgetFit           * 0.10
  + WeatherFit          * 0.10
  + LocalValue          * 0.10
  + TravelerTypeFit     * 0.05
```

Yêu cầu:

- Weight phải để trong config.
- Không hard-code rải rác trong source.
- Viết unit test cho từng component score.
- Final score normalize về `0..100`.

---

# 12. Planner Engine

## 12.1. Step 1 – Parse Input

Validate:

- `days >= 1`
- `traveler_count >= 1`
- `budget_total > 0`
- `interests` không rỗng.

## 12.2. Step 2 – Candidate Filtering

Filter:

- Active places.
- Categories phù hợp.
- Budget phù hợp.
- Opening hours hợp lệ.
- Suitable traveler type.
- Distance/radius nếu user giới hạn.

## 12.3. Step 3 – Ranking

Tính recommendation score.

Lấy top N candidates đủ lớn để lập kế hoạch nhưng không quá lớn.

Ví dụ:

```text
Top 30–60 candidates
```

Không truyền toàn bộ database cho LLM.

## 12.4. Step 4 – Geographic Clustering

Mục tiêu:

- Các điểm trong cùng ngày gần nhau.
- Giảm zig-zag route.

Có thể sử dụng:

- K-means theo tọa độ cho prototype.
- DBSCAN.
- Custom greedy clustering.

Phải đảm bảo clustering deterministic và test được.

## 12.5. Step 5 – Schedule Building

Xếp địa điểm theo:

- Opening hours.
- Best time.
- Average visit duration.
- Meal periods.
- Travel time.
- Daily start/end.

Không xếp overlap.

## 12.6. Step 6 – Route Optimization

MVP có thể dùng:

- Greedy nearest-neighbor.
- 2-opt improvement.
- Route Matrix API nếu provider hỗ trợ.

Không cần giải TSP tối ưu tuyệt đối.

Mục tiêu:

- Route hợp lý.
- Chạy nhanh.
- Predictable.

## 12.7. Step 7 – Budget Calculation

```text
TotalCost =
  attraction_cost
+ food_cost
+ transport_cost
+ optional_estimates
```

Tất cả cost phải nhân theo số người nếu business rule yêu cầu.

## 12.8. Step 8 – Validation

Validator cuối cùng phải kiểm tra toàn bộ itinerary.

Không được trả response trước khi validator pass.

Validation gồm:

- Không trùng địa điểm không cần thiết.
- Không overlap thời gian.
- Không vượt daily window.
- Không vượt hard budget.
- Place mở cửa.
- Route khả thi.
- Mỗi ngày có ít nhất một activity.
- Itinerary item sequence liên tục.

---

# 13. Multiple Itinerary Strategies

## 13.1. Best Match

Ưu tiên:

```text
interest
local relevance
balanced distance
balanced budget
```

## 13.2. Budget Friendly

Ưu tiên:

```text
lower cost
free attractions
shorter travel
```

## 13.3. Explore More

Ưu tiên:

```text
more activities
broader experience categories
higher local diversity
```

Ba phương án không được giống nhau gần như hoàn toàn.

Phải có logic diversity giữa các option.

---

# 14. Weather-aware Logic

Ví dụ rule:

```text
IF precipitation_probability >= configured_threshold
AND place.outdoor == true
THEN reduce weather score
```

Nếu buổi chiều mưa:

```text
Prefer indoor POIs in afternoon
Prefer outdoor POIs in morning
```

Nếu weather provider unavailable:

- Không fail toàn bộ trip generation.
- Log warning.
- Fallback về neutral weather score.

---

# 15. API Design

## 15.1. Health

```http
GET /api/v1/health
```

Response:

```json
{
  "status": "ok"
}
```

## 15.2. Generate Trip

```http
POST /api/v1/trips/generate
```

Request example:

```json
{
  "language": "en",
  "days": 3,
  "travelerCount": 2,
  "budgetTotal": 3000000,
  "startLocation": {
    "name": "Hanoi Old Quarter",
    "latitude": 21.034,
    "longitude": 105.85
  },
  "interests": ["food", "history", "coffee", "local_culture"],
  "travelMode": "walking_grab",
  "travelRadiusMode": "balanced",
  "pace": "balanced",
  "experiencePreferences": ["local", "hidden_gem"],
  "dailyStartTime": "08:00",
  "dailyEndTime": "21:00"
}
```

Response phải luôn có schema ổn định.

```json
{
  "tripId": "uuid",
  "options": [
    {
      "id": "uuid",
      "type": "BEST_MATCH",
      "matchScore": 94,
      "estimatedTotalCost": 2850000,
      "estimatedTotalDistanceKm": 27.4,
      "estimatedTotalTravelMinutes": 225,
      "days": []
    }
  ]
}
```

## 15.3. Get Trip

```http
GET /api/v1/trips/{tripId}
```

## 15.4. Replace Place

```http
POST /api/v1/trips/{tripId}/itineraries/{itineraryId}/items/{itemId}/replace
```

Request:

```json
{
  "reason": "TOO_FAR"
}
```

## 15.5. Re-optimize

```http
POST /api/v1/trips/{tripId}/itineraries/{itineraryId}/optimize
```

Request:

```json
{
  "strategy": "REDUCE_COST"
}
```

Các strategy:

```text
REDUCE_COST
REDUCE_DISTANCE
PREFER_INDOOR
MORE_LOCAL
MORE_FOOD
MORE_CHECKIN
REGENERATE_DAY
```

## 15.6. Place Detail

```http
GET /api/v1/places/{placeId}
```

## 15.7. Weather

```http
GET /api/v1/weather
```

---

# 16. Error Contract

Tất cả lỗi business/API phải có format thống nhất:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_BUDGET",
    "message": "Budget must be greater than zero.",
    "details": null
  }
}
```

Không expose stack trace ra client.

Không trả lỗi dạng text tùy ý.

---

# 17. Frontend Screens

## 17.1. Homepage

Phải có:

- HanoiGO branding.
- CTA `Build my trip`.
- Sample plans.
- Giải thích ngắn về cách hệ thống hoạt động.

## 17.2. Trip Planner Form

Nên chia step:

```text
Step 1 – Trip Basics
Step 2 – Interests
Step 3 – Budget & Travel
Step 4 – Preferences
```

Yêu cầu UI:

- Mobile-first.
- Validation inline.
- Không reload trang giữa các step.
- Có progress indicator.

## 17.3. Recommendation Options

Hiển thị card:

```text
Best Match
Budget Friendly
Explore More
```

Mỗi card:

- Match score.
- Budget.
- Distance.
- Places.
- Travel time.
- CTA View Plan.

## 17.4. Itinerary Detail

Desktop layout:

```text
Timeline        Map
```

Mobile:

```text
Timeline
[View Map]
```

Mỗi item phải hiển thị:

- Time.
- Place.
- Category.
- Duration.
- Cost.
- Travel time from previous.
- Recommendation reasons.
- Replace button.
- Lock button nếu implement.

## 17.5. Budget Summary

```text
Attractions
Food
Transport
Others
Total
Remaining
```

## 17.6. Optimization Actions

Đặt ở vị trí dễ thấy:

```text
Reduce cost
Reduce travel
Prefer indoor
More local
```

---

# 18. UX Rules

Không hiển thị đoạn văn AI dài trong itinerary.

Ưu tiên:

- Badge.
- Metric.
- Timeline.
- Map.
- Short explanation.

Ví dụ:

```text
94% Match
Within budget
6 min from previous stop
Indoor – suitable for rain
Local favorite
```

---

# 19. AI Integration

## 19.1. Không bắt buộc chatbot

Không tạo chatbot drawer trong MVP trừ khi core hoàn thành trước deadline.

## 19.2. LLM use case 1 – Parse Free Text

Ví dụ input:

```text
I have 2 days in Hanoi with my girlfriend.
We like local food, quiet coffee shops and history.
Budget is about 2 million VND.
```

LLM output phải validate bằng schema:

```json
{
  "days": 2,
  "travelerCount": 2,
  "budgetTotal": 2000000,
  "interests": ["food", "coffee", "history"],
  "experiencePreferences": ["local", "quiet"]
}
```

Nếu schema invalid → reject/fallback.

## 19.3. LLM use case 2 – Recommendation Explanation

LLM chỉ nhận dữ liệu đã được hệ thống chọn.

Không cho model tự thêm địa điểm mới.

---

# 20. Clean Code Requirements

AI coding agent phải tuân theo các nguyên tắc sau:

## 20.1. Function nhỏ và có trách nhiệm rõ ràng

Không viết một function 200–300 dòng xử lý toàn bộ planner.

## 20.2. Domain logic không đặt trong route/controller

Sai:

```text
API route → 300 dòng business logic
```

Đúng:

```text
API route
→ use case/service
→ domain service
→ repository/provider
```

## 20.3. Không duplicate business rule

Ví dụ rule budget phải tồn tại ở một nơi chuẩn.

## 20.4. Config tách riêng

Không hard-code:

- API keys.
- Base URLs.
- Score weight.
- Weather threshold.
- Default travel speed.

## 20.5. Type safety

Frontend:

- `strict: true` trong TypeScript.
- Không dùng `any` nếu không có lý do rõ ràng.

Backend:

- Type hints đầy đủ.
- Pydantic validation.

## 20.6. Naming

Tên phải mô tả business meaning.

Ví dụ tốt:

```text
calculate_itinerary_cost
find_replacement_candidates
validate_daily_schedule
```

Không dùng:

```text
handleData
processThing
doStuff
```

---

# 21. Security

MVP tối thiểu phải có:

- API key chỉ ở backend.
- `.env` không commit.
- `.env.example` không chứa secret.
- Input validation.
- Request timeout với external API.
- Rate limit endpoint generate nếu deploy public.
- CORS config rõ ràng.
- Không log secret.
- Không trả stack trace production.

---

# 22. External API Rules

Mọi external API phải đi qua adapter/interface.

Ví dụ:

```python
class MapProvider(Protocol):
    async def get_route_matrix(...): ...
```

Implementation:

```text
GoogleMapsProvider
hoặc
MapboxProvider
```

Business logic không được import SDK provider trực tiếp.

Tương tự:

```text
WeatherProvider
LLMProvider
```

Lợi ích:

- Test dễ.
- Mock dễ.
- Đổi provider dễ.

---

# 23. Testing Strategy

Mục tiêu không phải chỉ "có test", mà phải test đúng core business flow.

## 23.1. Unit Tests

Bắt buộc cho:

### Constraint Engine

Test:

```text
budget invalid
number of days invalid
traveler count invalid
opening hour filtering
radius filtering
```

### Ranking Engine

Test:

```text
higher interest match gets higher score
budget fit influences result
weather fit influences result
score is between 0 and 100
```

### Budget Calculator

Test:

```text
cost per person
free attraction
transport cost
multi-day total
```

### Schedule Validator

Test:

```text
no overlap
place opening hours
activity fits available time
daily end time
```

### Route Logic

Test:

```text
route order deterministic
no missing place
empty candidates
single candidate
```

## 23.2. Integration Tests

Test:

```text
API + DB
Planner + repository
Trip generation + seeded places
Replace place + recalculate itinerary
```

External APIs phải mock/stub trong CI.

## 23.3. API Contract Tests

Kiểm tra:

- HTTP status.
- Response schema.
- Error schema.
- Field type.

## 23.4. Frontend Tests

Test:

- Form validation.
- Form submit.
- Loading state.
- Error state.
- Recommendation cards.
- Itinerary rendering.
- Replace action.
- Re-optimize action.

## 23.5. End-to-End Test

Tối thiểu một E2E hoàn chỉnh:

```text
User opens HanoiGO
→ Create trip
→ Fill 3 days / 2 people / budget
→ Select interests
→ Submit
→ Receive 3 itineraries
→ Select Best Match
→ View itinerary
→ Replace one place
→ Verify budget updates
→ Verify route/timeline updates
```

Nên dùng Playwright.

---

# 24. Test Data

Phải có seed data phục vụ test/demo.

Không phụ thuộc external API để unit/integration test core planner.

Seed tối thiểu nên có nhiều loại địa điểm:

```text
history
food
coffee
museum
park
shopping
local experience
hidden gem
```

Seed phải có:

- POI giá thấp/cao.
- Indoor/outdoor.
- Opening hours khác nhau.
- Tọa độ ở các khu vực khác nhau.
- Suitable traveler type khác nhau.

---

# 25. Quality Gates

AI coding agent **không được coi task hoàn thành** nếu chưa đạt các gate sau.

## Backend

```bash
ruff check .
pytest
```

Nếu thêm type checker:

```bash
mypy app
```

## Frontend

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## E2E

```bash
npm run test:e2e
```

Tất cả phải pass trước khi báo hoàn thành.

---

# 26. Development Workflow dành cho AI Coding Agent

AI phải phát triển theo từng phase.

Không viết toàn bộ hệ thống rồi mới test.

## Phase 0 – Bootstrap

Tạo:

- Repo structure.
- Backend app chạy được.
- Frontend app chạy được.
- PostgreSQL Docker.
- Health endpoint.
- CI script cơ bản.

**Exit condition:**

```text
Frontend build pass
Backend boot pass
Database connects
Health endpoint 200
```

## Phase 1 – Data Layer

Tạo:

- Place model.
- Trip models.
- Migrations.
- Seed data.
- Repository.

**Exit condition:**

```text
Migration up/down works
Seed works
Repository tests pass
```

## Phase 2 – Constraint + Ranking Engine

Tạo:

- Constraint validation.
- Candidate filtering.
- Ranking.

**Exit condition:** unit tests pass.

## Phase 3 – Planner

Tạo:

- Clustering.
- Scheduling.
- Budgeting.
- Routing abstraction.
- Validation.

**Exit condition:** một trip request tạo được itinerary hợp lệ từ seed data.

## Phase 4 – Multiple Options

Tạo:

- Best Match.
- Budget Friendly.
- Explore More.

**Exit condition:** ba option hợp lệ và khác nhau đủ rõ.

## Phase 5 – API

Tạo:

- Generate trip.
- Get trip.
- Place detail.

**Exit condition:** integration tests pass.

## Phase 6 – Frontend

Tạo:

- Planner form.
- Results.
- Itinerary detail.
- Budget summary.

**Exit condition:** user có thể đi hết flow trên UI.

## Phase 7 – Map

Tạo map + route.

**Exit condition:** route hiển thị đúng theo itinerary.

## Phase 8 – Replace + Optimize

Tạo:

- Replace Place.
- Reduce Cost.
- Reduce Distance.
- Prefer Indoor.

**Exit condition:** state + budget + map cùng update.

## Phase 9 – Weather

Tích hợp weather.

**Exit condition:** planner phản ứng được với rainy scenario.

## Phase 10 – E2E + Polish

- Playwright.
- Responsive.
- Loading state.
- Error handling.
- Empty state.

---

# 27. Bug Prevention Rules

Không thể đảm bảo phần mềm thực tế "không bao giờ có bug", nhưng AI phải tuân theo quy trình giảm lỗi tối đa.

## Bắt buộc

Trước mỗi thay đổi:

1. Hiểu requirement.
2. Xác định module bị ảnh hưởng.
3. Viết/update test trước hoặc cùng thay đổi.
4. Implement nhỏ nhất có thể.
5. Chạy test module.
6. Chạy full regression test.
7. Chạy build.
8. Chỉ sau khi pass mới sang task tiếp theo.

Không được sửa lỗi bằng cách:

- Disable test.
- Comment validation.
- `try/except: pass`.
- Hard-code response.
- Bỏ TypeScript strict.
- Dùng `any` để né lỗi.
- Mock core business trong production code.

---

# 28. Logging & Debugging

Backend log tối thiểu:

```text
request_id
endpoint
trip_id
execution_time
planner_phase
external_api_latency
warning/error
```

Không log:

- API secret.
- Sensitive personal info không cần thiết.

Planner nên có debug trace ở development:

```text
Candidates: 46
After hard filter: 22
After ranking: 18
Selected: 12
Estimated cost: ...
Validation: PASS
```

---

# 29. Performance Expectations

MVP mục tiêu:

```text
Trip generation < 10 seconds under normal demo conditions
Normal API endpoints < 1 second excluding third-party APIs
```

Nếu external route API chậm:

- Timeout.
- Retry có giới hạn.
- Có fallback.

Không retry vô hạn.

---

# 30. Failure Handling

## Map API unavailable

- Không crash app.
- Timeline vẫn usable.
- Thông báo map temporarily unavailable.

## Weather unavailable

- Generate plan bình thường.
- Weather score neutral.

## LLM unavailable

- Core itinerary vẫn generate.
- Chỉ thiếu natural-language explanation.

## Database unavailable

- API trả `503` rõ ràng.

---

# 31. UI States bắt buộc

Mọi màn có async request phải có:

```text
Idle
Loading
Success
Empty
Error
```

Không để blank screen.

Generate trip loading có thể hiển thị:

```text
Analyzing your preferences...
Finding suitable places...
Optimizing routes...
Checking budget...
Building your Hanoi trip...
```

---

# 32. Acceptance Criteria – Core Flow

## Scenario

User:

```text
Days: 3
People: 2
Budget: 3,000,000 VND
Start: Old Quarter
Interests: Food, History, Coffee, Local culture
Travel: Walking + Grab
Pace: Balanced
Preference: Local experiences
```

Hệ thống phải:

1. Validate input.
2. Lọc POI.
3. Trả 3 itinerary options.
4. Mỗi option không vượt budget nếu có thể tạo phương án hợp lệ.
5. Có timeline theo ngày.
6. Có travel time giữa các điểm.
7. Có estimated cost.
8. Có map route.
9. Cho replace một place.
10. Sau replace, route + cost + timeline được cập nhật.
11. Cho `Reduce Cost` và tạo plan mới có cost thấp hơn hoặc bằng plan trước.
12. Không sinh overlapping schedule.
13. Không chọn place đóng cửa tại thời điểm đến.

---

# 33. Acceptance Criteria – Technical

Hoàn thành chỉ khi:

```text
No failing unit tests
No failing integration tests
No failing E2E test
No TypeScript compile error
No backend import/runtime error
Frontend production build succeeds
Database migration succeeds
Seed succeeds
Docker local environment starts successfully
```

Không được báo "done" khi còn lỗi known issue ảnh hưởng core flow.

Nếu còn limitation, phải ghi rõ trong README.

---

# 34. README bắt buộc

README phải có:

- Product overview.
- Architecture.
- Tech stack.
- Environment variables.
- Local setup.
- Database migration.
- Seed commands.
- Run backend.
- Run frontend.
- Run tests.
- Run E2E.
- Build production.
- Known limitations.

Một developer mới phải clone repo và chạy được dự án chỉ dựa vào README.

---

# 35. Environment Variables

Ví dụ `.env.example`:

```env
DATABASE_URL=
MAP_API_KEY=
WEATHER_API_KEY=
LLM_API_KEY=
LLM_MODEL=
APP_ENV=development
CORS_ORIGINS=http://localhost:3000
```

Không đưa secret thật vào source.

---

# 36. Docker Local Development

`docker-compose.yml` tối thiểu:

```text
postgres
```

Có thể containerize backend sau.

Ưu tiên developer experience đơn giản.

---

# 37. CI Pipeline

Pull Request phải chạy:

```text
Backend lint
Backend tests
Frontend lint
Frontend typecheck
Frontend tests
Frontend build
```

E2E có thể chạy trên main hoặc PR nếu setup ổn định.

Không merge nếu core checks fail.

---

# 38. Git Rules

Branch convention:

```text
feature/...
fix/...
refactor/...
test/...
```

Commit nhỏ, rõ nghĩa.

Không commit:

```text
.env
node_modules
venv
coverage output
IDE secret settings
```

---

# 39. Coding Agent Behaviour

AI coding agent phải thực hiện đúng các quy tắc sau:

## 39.1. Trước khi code

Phải:

- Đọc toàn bộ spec.
- Kiểm tra repo hiện tại.
- Không overwrite code tốt đang tồn tại nếu không cần.
- Tạo kế hoạch triển khai ngắn.
- Xác định dependencies cần dùng.

## 39.2. Trong khi code

Phải:

- Làm theo phase.
- Sau mỗi phase chạy test.
- Khi gặp lỗi, tìm root cause.
- Không tạo workaround tạm thời nếu có giải pháp đúng.
- Không duplicate code.

## 39.3. Khi sửa bug

Phải:

1. Reproduce bug.
2. Thêm regression test.
3. Fix.
4. Verify regression test pass.
5. Run related tests.
6. Run full test suite nếu thay đổi có phạm vi rộng.

## 39.4. Khi hoàn thành

Phải báo:

```text
Implemented
Tests added
Tests passed
Build status
Known limitations
How to run
```

Không chỉ nói "done".

---

# 40. Không over-engineer

Không tự thêm:

- Kafka.
- Redis.
- Kubernetes.
- Event-driven architecture.
- Microservices.
- CQRS phức tạp.
- GraphQL.

trừ khi có yêu cầu mới và có lý do thực tế.

MVP phải ưu tiên:

```text
Correctness
Clarity
Testability
Demo reliability
Speed of development
```

---

# 41. Feature Priority

## P0 – Must Have

```text
Trip constraints
POI database
Candidate filtering
Recommendation scoring
Multiple itineraries
Schedule generation
Budget engine
Distance optimization
Timeline
Map
Replace place
Re-optimize
Validation
```

## P1 – Should Have

```text
Weather integration
VI/EN
Share link
Lock place
```

## P2 – Later

```text
PDF
Account
Chatbot
Community
Premium
B2B API
Mobile app
```

---

# 42. Demo Flow cuối cùng

Demo chuẩn:

```text
1. Mở HanoiGO.
2. Nhập 3 ngày, 2 người, 3 triệu.
3. Chọn Food + History + Coffee + Local culture.
4. Chọn Balanced + Walking/Grab.
5. Submit.
6. Hiển thị 3 plan.
7. Chọn Best Match.
8. Xem timeline + map + cost.
9. Replace một địa điểm quá xa.
10. Route và budget tự cập nhật.
11. Bấm Reduce Cost.
12. Hệ thống tạo phương án rẻ hơn.
13. Nếu có weather: cho thấy planner ưu tiên indoor khi mưa.
```

Đây là flow quan trọng nhất của toàn hệ thống.

---

# 43. Definition of Done

Một feature chỉ được coi là hoàn thành khi:

```text
Requirement implemented
Validation implemented
Error handling implemented
Unit/integration test added where applicable
Tests pass
No lint error
No type error
Production build pass
README updated if needed
```

Một MVP chỉ được coi là hoàn thành khi **toàn bộ demo flow chạy liên tục từ đầu đến cuối mà không cần sửa tay database/source code giữa chừng**.

---

# 44. Final Instruction to AI Coding Agent

> Build HanoiGO as a clean, testable, modular monolith. The core product is the itinerary planning engine, not a chatbot. Implement constraint-based recommendation, geographic planning, budget calculation, itinerary validation, multiple plan strategies, interactive map integration, place replacement and re-optimization first. Do not move to optional features before the core end-to-end flow is stable. Do not rely on LLM output for deterministic business rules. Use structured data, explicit schemas, strong validation and automated testing. After every implementation phase, run the relevant tests and fix all failures before continuing. Before declaring the project complete, run linting, type checking, unit tests, integration tests, production build and at least one full end-to-end user journey.

---

# 45. Kết quả mong đợi cuối cùng

Sản phẩm sau MVP phải chứng minh được:

```text
User constraints
       ↓
Smart Recommendation
       ↓
Time + Distance + Budget Optimization
       ↓
Practical Hanoi Itinerary
       ↓
Timeline + Map
       ↓
Replace / Re-optimize
```

HanoiGO phải tạo cảm giác đây là **một công cụ lập kế hoạch du lịch thực sự có thể sử dụng**, chứ không phải một giao diện demo gọi LLM.
