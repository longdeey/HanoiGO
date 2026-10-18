# HanoiGO – Kiểm kê giao diện (Phase 0 của bản thiết kế lại v2)

Ngày kiểm: 16/10/2026. Nguồn: code trong `frontend/` và `backend/app` tại thời điểm trước khi thiết kế lại.

## 1. Route và URL hiện có

| URL cũ | Nội dung | Chuyển sang |
|---|---|---|
| `/` | Toàn bộ ứng dụng trên một trang (form 4 bước, kết quả, lịch trình, câu chuyện) | `/` (trang chủ mới) |
| `/?trip=<id>&option=<optionId>&share=<token>` | Mở lịch trình được chia sẻ (chỉ xem) | `308 → /trips/<id>/<optionId>?share=<token>` |
| `/?trip=<id>&option=<optionId>` | Mở lại chuyến bằng owner token lưu trên máy | `308 → /trips/<id>/<optionId>` |
| `/?trip=<id>` | Mở chuyến, chọn phương án đầu | `308 → /trips/<id>` |
| `/?story=<slug>` | Mở trình đọc chuyện | `308 → /stories/<slug>` |

Tên tham số token (`share`) giữ nguyên.

## 2. Khoá lưu trên trình duyệt

| Khoá | Nơi | Nội dung | Sau thiết kế lại |
|---|---|---|---|
| `hanoigo-owner-<tripId>` | localStorage | owner token | Giữ nguyên |
| `hanoigo-auth-token`, `hanoigo-auth-user` | localStorage | phiên đăng nhập | Giữ nguyên |
| `hanoigo-read-stories` | localStorage | danh sách slug đã đọc | Giữ nguyên |
| `hanoigo-trip-summary-<tripId>` | localStorage | **mới [client]**: `startDate`, số ngày, số người, ngân sách, thời điểm tạo | Mới |
| `hanoigo-share-<tripId>` | localStorage | **mới [client]**: liên kết chia sẻ gần nhất | Mới (code cũ không lưu) |
| `hanoigo-plan-draft` | sessionStorage | **mới [client]**: giá trị form đang nhập | Mới |
| `hanoigo-language`, `hanoigo-theme` | cookie | ngôn ngữ, giao diện | Mới (để server render đúng `lang` và theme) |

## 3. Trường form (schema Zod `frontend/src/schemas/trip.ts`)

`language`, `startDate`, `days` (1–14), `travelerCount` (1–20), `budgetTotal` (> 0), `startLocationName` (≥ 3 ký tự), `startLocationCoordinates` (tuỳ chọn), `interests` (≥ 1), `travelMode` (walking / motorbike / car), `travelRadiusMode` (near / balanced / wide; schema còn `outskirts` nhưng form không cho chọn), `pace` (relaxed / balanced / active), `experiencePreferences` (mặc định `["local"]`, không có điều khiển trên form), `dailyStartTime`, `dailyEndTime`.

- Mặc định: 3 ngày, 2 người, 3.000.000 đ, đi bộ, phạm vi vừa, nhịp cân bằng, 08:00–21:00, sở thích ẩm thực, lịch sử, cà phê, văn hoá địa phương.
- Sở thích: food, history, coffee, local_culture, museum, park, shopping, festival, hiking, nature, craft, art.
- Điểm xuất phát có sẵn (`START_COORDINATES` trong `services/api.ts`): Hanoi Old Quarter, Hoan Kiem Lake, West Lake, Temple of Literature.
- `startDate`: code cũ bắt buộc và mặc định là hôm nay. Backend nhận `null`. Bản mới cho phép để trống (README: tuỳ chọn).

## 4. Danh sách nghiệp vụ giữ nguyên

- **Lý do thay địa điểm:** TOO_FAR, TOO_EXPENSIVE, NOT_INTERESTED, ALREADY_VISITED, PREFER_INDOOR, PREFER_LOCAL.
- **Chiến lược tối ưu lại:** REDUCE_COST, REDUCE_DISTANCE, PREFER_INDOOR, MORE_LOCAL, MORE_FOOD, MORE_CHECKIN, REGENERATE_DAY (theo ngày đang xem).
- **Khoá điểm (F34):** API có `POST …/items/{id}/lock`, nhưng giao diện cũ cố ý không hiện (có test khẳng định không có nút khoá). Giữ nguyên: không hiện.
- **Tên phương án:** đã có bản dịch “Phù hợp nhất”, “Tiết kiệm”, “Khám phá nhiều hơn” (EN Best Match, Budget Friendly, Explore More). Giữ nguyên.

## 5. Trả lời các mục [kiểm P0]

| Mục | Kết quả |
|---|---|
| `GET /holidays` | Mỗi dịp có `key, name, kind, isPublicHoliday, startDate, endDate, tripDates, description, suggestion, relatedPlaces[]`. **Có** địa điểm tổ chức (`relatedPlaces`, mỗi địa điểm có thể kèm `story`). Không có trường ngày âm lịch riêng. |
| `GET /weather?latitude&longitude&day` | Trả `date, available, afternoonRainProbability, warning` cho **một ngày**. Planner chỉ dùng chiều ngày đầu. Giao diện chỉ gọi cho ngày đầu chuyến và cho hôm nay ở trang chủ; `available=false` thì không hiện gì. |
| `GET /trips/{id}` | Trả `tripId, language, travelMode, options, seasonalHighlights, holidays, stayOptions, startLatitude, startLongitude`. **Không** trả số người, tên điểm xuất phát, sở thích. Suy ra được: số ngày (`days.length`), ngân sách (`budget.total + budget.remaining`), ngày bắt đầu (`days[0].date`), phương tiện. |
| Chia nhóm chi phí | **Có sẵn** trong `option.budget`: `attractions, food, transport, others, total, remaining`. Không cần tự tính. |
| Lưu trú | `stayOptions` là danh sách `Place` (tên, toạ độ, `averageCost` = giá mỗi đêm ước tính, `story`). Khoảng cách tính trên trình duyệt từ điểm xuất phát (đường thẳng). |
| `details` của `NO_FEASIBLE_ITINERARY` | Danh sách chuỗi gợi ý (“Increase budget”, “Increase travel radius”, “Extend daily hours”), không có khoá máy đọc được. Hiển thị như văn bản, kèm nút “Sửa yêu cầu”. |
| `budgetTargetShare` | 0,95 (Best Match), 0,9 (Explore More), `null` (Budget Friendly). `budgetTargetMet` luôn `true` khi share là `null`. |
| `Retry-After` | Backend có gửi header, nhưng CORS **không** có `expose_headers`, nên trình duyệt ở cổng 3000 không đọc được. Dùng phương án dự phòng: “Thử lại sau ít phút”, mở lại nút sau 60 giây. |
| Trường đánh dấu truyền thuyết | Không có. Truyền thuyết nằm trong lời văn (“tương truyền”). Không tự gắn nhãn. |
| Đăng ký | Trường: tên hiển thị (dùng khi đăng đánh giá), email hoặc số điện thoại, mật khẩu ≥ 8 ký tự. |
| Lý do gợi ý trên điểm dừng | Có (`reasons[]`), hiện trong sheet chi tiết. |
| Ở lâu hơn thường lệ | Suy ra được khi `visitMinutes > place.averageVisitMinutes` (dữ liệu thật, không đoán). |

## 6. Mốc trước khi thiết kế lại

- Kiểm thử: backend 105, frontend 32 (vitest), 3 luồng E2E Playwright (`core-flow`, `personalization`, `map-picker`).
- Gói chính: Next 15.5.25, React 19.3, TanStack Query 5.102, Leaflet 1.9.4 / react-leaflet 5.
- Gói thêm cho bản mới (khoá phiên bản): `motion@13.5.1` (dòng 13 dự phòng của spec; dòng 14 mới ra 02/10/2026), `@phosphor-icons/react@2.1.10`.
- Phông: Phudu và Archivo có trong `next/font/google` của Next 15.5.25.

## 7. Bổ sung sau khi rà soát theo spec

**Thành phần (§9).** Khung: `AppShell`, `TopBar`, `BottomNav`, `DesktopNav`, liên kết bỏ qua, vùng toast. Chữ ký: `Signboard`, tuyến trên bản đồ (`RouteLine`) và đường dọc trên timeline, lớp `.station`. Điều khiển: `Button` (primary, secondary, ink, text, danger), `IconButton`, `Chip`, `Segmented`, `Stepper`, `MoneyInput`, `RadioRow`, `Field` + `.field`; ô ngày là `input type="date"`, chọn sao là nhóm radio trong trang địa điểm. Lớp phủ: `Sheet` (modal, giữ focus), `Menu`, `Toast`; hộp xác nhận tạo liên kết mới là `role="alertdialog"` ngay trong sheet chia sẻ. Lịch trình: `StopCard`, `StopDetails` (sheet trên điện thoại, mở rộng tại chỗ trên desktop), `LegRow`, `DayTotal`, `HolidayBand`, `StoryLink`, `BudgetMeter`, `BudgetBreakdown`, `OptionPanel`, `MiniRoute`, `StayList`. Bản đồ: `RouteMap` (import động, `ssr: false`), `PinPicker`. Nội dung: thẻ chuyện trong `StoriesPage` và trang chủ, `StoryReaderPage` + `LandmarkCard`, `FestivalItem`, `TripRow`, `Rating`, `Reviews`, `PhotoCredit`. Trạng thái: `Skeleton` và khung chờ theo trang, `EmptyState`, `ErrorState`.

**`data-testid`.** Giao diện cũ (`legacy-ui-backup/`) không có `data-testid` nào, nên không có gì phải giữ. Bản mới chỉ dùng `route-map` trong kiểm thử thành phần.

**Chuỗi i18n.** Mọi chuỗi nằm trong `frontend/src/i18n.ts` (khoá tiếng Anh, giá trị tiếng Việt). Chuỗi mới luôn thêm cả hai ngôn ngữ; tên hành động theo bảng §10.

**Mốc trước thiết kế lại.** Ảnh chụp, kích thước bundle và Web Vitals của giao diện cũ **không** được ghi lại ở Phase 0, và giao diện cũ chỉ có một route nên không so sánh được theo route. Mốc hiện dùng là của bản mới: kích thước trong `npm run build`, Web Vitals đo cục bộ ghi trong README, và 32 ảnh so sánh ở `frontend/e2e/visual.spec.ts-snapshots/` (chỉ cho Windows/Chromium).

**Giới hạn dữ liệu cho §8.8.** `PlaceResponse` không có giờ mở cửa (chỉ có liên kết `hoursSource`) và không có khu vực (quận/phường). Trang địa điểm vì vậy ghi tiêu đề “Vé” khi không có nguồn giờ, “Vé và giờ mở cửa” khi có liên kết nguồn, và không hiện khu vực.

**Chức năng cũ giữ lại (F34).** Rà lại `legacy-ui-backup/PlannerApp.tsx` thấy thêm và đã đặt lại vào màn phù hợp:
- nhãn “Đáng ghé” (`highlightLevel = notable`): thẻ điểm dừng, chi tiết điểm dừng, trang địa điểm;
- “% phù hợp” (`matchScore`) và số tiền còn lại: thẻ phương án ở trang so sánh;
- thẻ theo mùa: “Lặp lại quanh ngày này hằng năm”, “Thông tin hoạt động” (`informationSource`), chỉ đường;
- nơi tổ chức dịp lễ: chỉ đường và câu chuyện (dải lễ trong lịch trình);
- loại hình lưu trú (tab Lưu trú);
- số câu chuyện trong ngày (tổng ngày).

**Câu hỏi mở §15.5.** Chưa có tên do người dùng đặt cho chuyến: API không có trường này. Danh sách chuyến đặt tên theo ngày đi, hoặc theo thời điểm lập với chuyến chưa chọn ngày.

**Mâu thuẫn trong spec, đã chọn theo §8.** Bảng §5 ghi “chạm để mở” cho vài mục mà khung dây §8 vẽ sẵn trên trang: lễ hội sắp tới và chuyện nổi bật ở trang chủ (§8.2), giải thích ngày bắt đầu và danh sách điểm có sẵn ở bước 1–2 (§8.3), khối “Trong những ngày bạn đi” (§8.5). Các mục này hiện trên trang như §8. Những mục §5 không có khung dây trái ngược đã để sau một lần chạm: toàn bộ bình luận, chi tiết và nơi tổ chức lễ hội, giao diện sáng/tối, xoá chuyến khỏi máy này.

