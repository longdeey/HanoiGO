# HanoiGO – Đặc tả thiết kế lại giao diện (v2)

> **Dành cho:** đội frontend và AI coding agent.
> **Phạm vi:** chỉ tầng giao diện trong `frontend/`. Không đổi API, dữ liệu, logic planner hay backend.
> **Căn cứ:** `README.md` (bản có API câu chuyện) và `HanoiGO_IMPLEMENTATION_SPEC.md`.
> **Thay thế:** mọi bản thiết kế giao diện trước đó, gồm cả canvas “Thiết kế tính năng Story”.
> **Ngày soạn:** 16/10/2026.

---

## Mục lục

0. Quy tắc dùng tài liệu
1. Những gì thay đổi
2. Định hướng thị giác: “Biển hiệu phố”
3. Kiểm kê chức năng phải giữ
4. Điều hướng và kiến trúc trang
5. Phân bổ chức năng theo màn hình
6. Hệ thị giác (design tokens)
7. Hệ chuyển động
8. Đặc tả từng màn hình
9. Thư viện thành phần
10. Chữ trong giao diện
11. Tiếp cận (accessibility)
12. Hiệu năng
13. Lộ trình triển khai
14. Kiểm thử
15. Giả định, rủi ro, câu hỏi mở
16. Nguồn tham khảo

---

## 0. Quy tắc dùng tài liệu

1. **Giữ nguyên chức năng.** Mọi dòng trong §3 phải còn chạy sau khi thiết kế lại. Đây là điều kiện nghiệm thu số một.
2. **Không thêm endpoint, không đổi request hay response.** Một vài bổ sung chạy hoàn toàn trên trình duyệt được đánh dấu **[client]** và là tuỳ chọn.
3. **Khi các yêu cầu xung đột**, ưu tiên theo thứ tự:
   1. chức năng và dữ liệu đúng;
   2. tiếp cận;
   3. hiệu năng;
   4. thẩm mỹ;
   5. chuyển động.
4. **Không tự đặt lại danh sách nghiệp vụ.** Những gì tài liệu ghi “giữ như hiện có” phải lấy từ code ở Phase 0, ví dụ danh sách lý do thay địa điểm, chiến lược tối ưu lại, các trường nâng cao của form và bản dịch VI/EN đã có.
5. **Ký hiệu chỗ trống.** `[...]` là chỗ dữ liệu thật điền vào. Không thay bằng số liệu bịa.
6. **Không chép mẫu.** Ví dụ chữ và bố cục trong tài liệu là hướng dẫn, không phải nội dung cố định.

---

## 1. Những gì thay đổi

| Hiện tại | Sau thiết kế lại |
|---|---|
| Phần lớn chức năng dồn trên một trang dài | 5 điểm đến trên thanh điều hướng; mỗi trang một việc chính |
| Form, kết quả, lịch trình, câu chuyện nối tiếp nhau khi cuộn | Mỗi bước có URL riêng, quay lại bằng nút Back của trình duyệt |
| Thông tin hiện cùng lúc | Ba tầng: luôn thấy / chạm để mở / trang riêng |
| Bảng màu đỏ – vàng chung chung | Hệ màu “Biển hiệu phố”, mỗi màu có một nghĩa |
| Ít chuyển động | Hệ chuyển động có token, danh mục 30 chuyển động, tôn trọng `prefers-reduced-motion` |
| Timeline và bản đồ tách rời | Một “tuyến” chung: cùng màu, cùng số ga, đồng bộ hai chiều |

---

## 2. Định hướng thị giác: “Biển hiệu phố”

### 2.1 Ý tưởng

Phố cổ Hà Nội có một kho chữ riêng: biển hiệu vẽ tay. Nhóm của Simon Richards (RMIT Việt Nam) đã ghi lại những biển hiệu ở quận Hoàn Kiếm. Có tấm hơn 70 năm tuổi, và nét chữ pha phong cách Pháp và Hoa. Phông **Phudu** của Dương Trần lấy cảm hứng từ chính các biển quảng cáo vẽ tay ngày trước của Việt Nam.

HanoiGO mượn ngữ pháp thị giác của biển hiệu:
- chữ đậm khổ hẹp;
- khung viền kép;
- màu sơn phẳng;
- nền sáng, hai màu sơn đỏ và lam, cùng mảng vàng tường cho những gì đáng chú ý.

Không sao chép biển hiệu cụ thể nào.

### 2.2 Một điểm nhớ duy nhất: “Tuyến”

Mỗi ngày trong lịch trình là một **tuyến** vẽ bằng một màu.
- Đường dọc trên timeline và đường trên bản đồ là **cùng một tuyến**: cùng màu, cùng số ga.
- Chạm vào một ga ở bên này thì ga tương ứng ở bên kia sáng lên.

Sự táo bạo dồn vào tuyến và tấm biển hiệu ở trang chủ. Mọi thứ khác yên tĩnh.

### 2.3 Sáu nguyên tắc

1. **Mỗi màn hình một việc chính.** Vùng nội dung có tối đa một nút đỏ trong khung nhìn. Thanh điều hướng dùng mực, không dùng đỏ, để không tranh với nút đỏ của trang (§4.4). Ngoại lệ duy nhất là chấm thông báo 8 px.
2. **Thông tin ba tầng.**
   - Luôn thấy: những gì cần để quyết định ngay.
   - Chạm để mở: chi tiết.
   - Trang riêng: nội dung dài (câu chuyện, đánh giá).
3. **Màu mang nghĩa.**
   - Đỏ: hành động chính trong trang, điểm “phải ghé”, lỗi và chấm thông báo. Tuyến của các ngày không dùng đỏ.
   - Lam: liên kết, lựa chọn, thông tin.
   - Rêu: trong ngân sách, thành công.
   - Vàng: mảng nhấn lớn (lễ hội, biển hiệu). Không bao giờ dùng vàng cho chữ trên nền trắng.
4. **Phân cấp bằng chữ và khoảng trắng**, không bằng hộp và bóng đổ.
5. **Chuyển động trả lời thao tác.** Mỗi chuyển động cho thấy cái gì vừa thay đổi.
6. **Thật thà với dữ liệu.**
   - Giá, cước, quãng đường và thời gian di chuyển ghi rõ là ước tính. README nói quãng đường tính theo đường thẳng, không theo đường bộ.
   - Chỉ hiện trường mà API thật sự trả về. Trường nào cần kiểm hợp đồng API được ghi **[kiểm P0]**: không có dữ liệu thì không hiện, không đoán.
   - Không có thanh tiến độ giả hay số liệu minh hoạ giả.
   - Thiếu ảnh có giấy phép thì để chữ.

### 2.4 Danh sách “không bị AI”

Các dấu hiệu bên trái thường gặp ở giao diện sinh tự động. HanoiGO **không dùng** chúng.

| Không làm | Làm thay thế |
|---|---|
| Nền kem, tiêu đề serif, điểm nhấn màu đất nung | Nền trắng, sơn đỏ và lam biển hiệu, vàng chỉ ở mảng lớn |
| Lưới thẻ bo tròn giống hệt nhau, cùng một bóng mờ | Bo góc theo cấp bậc (§6.4); nội dung trong luồng không có bóng |
| Gradient, glassmorphism, đốm sáng trang trí | Màu phẳng. Gradient chỉ được dùng làm lớp tối dưới chú thích ảnh để chữ đọc được |
| Nhãn in hoa giãn chữ phía trên mọi tiêu đề | Không nhãn in hoa; tiêu đề tự đủ nghĩa |
| Chuỗi meta nối bằng dấu chấm giữa (“Di tích · 90 phút · 30.000 đ”) | Mỗi thông tin là một phần tử riêng, có biểu tượng hoặc nhãn |
| Phông mono cho số liệu nhỏ | Số dùng Archivo với chữ số đều cột (`tnum`) |
| Mũi tên “→” ở cuối nút | Nút nói đúng hành động, không mũi tên |
| Tô màu hoặc in nghiêng một từ trong tiêu đề | Tiêu đề một màu; nhấn bằng cỡ chữ và độ đậm |
| Mỗi section mờ dần và trượt lên khi cuộn | Mỗi màn có tối đa một khoảnh khắc chuyển động tự chạy |
| Emoji, biểu tượng lấp lánh “AI” | Phosphor nét đều, không emoji |
| Số 01 / 02 / 03 để trang trí | Chỉ đánh số trình tự thật: điểm dừng, bước của form, ga trên tuyến |
| Ảnh minh hoạ 3D, ảnh stock | Chỉ ảnh có giấy phép kèm ghi công |
| Câu chung chung (“Khám phá hành trình tuyệt vời”) | Câu cụ thể (“Bạn có mấy ngày ở Hà Nội?”) |
| Thẻ có viền màu một bên trái | Phân nhóm bằng tiêu đề, khoảng trắng và tuyến |

---

## 3. Kiểm kê chức năng phải giữ

Bảng này là danh sách nghiệm thu. Mỗi dòng phải có ít nhất một kiểm thử E2E hoặc kiểm thử thành phần trước khi xong Phase 6.

| ID | Chức năng | Nguồn | Nơi xuất hiện sau thiết kế lại |
|---|---|---|---|
| F01 | Số ngày, số người, ngân sách VND. Mặc định 3 ngày, 2 người, 3.000.000 đ | README | `/plan` bước 1; ô nhập nhanh ở trang chủ |
| F02 | Ngày bắt đầu (tuỳ chọn) để hiện trải nghiệm theo ngày và các dịp lễ | README | `/plan` bước 1 |
| F03 | Điểm xuất phát nhập theo 6 cách: tên địa điểm hoặc địa chỉ; toạ độ; link Google Maps; vị trí hiện tại; chọn trên bản đồ; điểm có sẵn | README | `/plan` bước 2; màn chọn trên bản đồ |
| F04 | Lỗi `LOCATION_NOT_FOUND` và `LOCATION_SERVICE_UNAVAILABLE`, kèm đường lui | README | `/plan` bước 2, báo ngay dưới ô nhập |
| F05 | Phương tiện đi bộ, xe máy, ô tô; ước tính cước cho xe máy và ô tô | README | `/plan` bước 3; các chặng trên timeline |
| F06 | Phạm vi 5, 15, 30 km. 80 km là giá trị API cũ: giữ đúng cách xử lý hiện tại | README | `/plan` bước 3 |
| F07 | Đi bộ bị giới hạn 10 km mỗi lần tìm và mỗi ngày | README | `/plan` bước 3 (cảnh báo); lịch trình |
| F08 | Sở thích và mọi trường khác form đang có (nhịp độ, giờ trong ngày, ưu tiên trải nghiệm, ăn uống… nếu có) | Spec, code | `/plan` bước 3 và 4 |
| F09 | Tạo 3 phương án: Best Match, Budget Friendly, Explore More | `POST /trips/generate` | `/trips/[tripId]` |
| F10 | Mục tiêu dùng ngân sách: `budgetTargetShare` là mức sàn mục tiêu của phương án (Best Match 95%, Explore More 90%; Budget Friendly giữ 5% dự phòng) và `budgetTargetMet` cho biết có đạt hay không. Tỉ lệ đã dùng thực tế tính trên trình duyệt bằng chi phí chia ngân sách **[client]**. Ý nghĩa của trường với Budget Friendly cần **[kiểm P0]** | API, README | Thẻ phương án; header lịch trình; tab Chi phí |
| F11 | `NO_FEASIBLE_ITINERARY` kèm gợi ý trong `details` | API | Màn “Chưa xếp được” |
| F12 | `RATE_LIMITED` (429) kèm `Retry-After` | API | Màn chờ và nút gửi |
| F13 | Dịp lễ trong chuyến (`holidays`): tên, gợi ý, địa điểm tổ chức | API | Dải báo trên ngày tương ứng |
| F14 | Gợi ý lưu trú trong 5 km quanh điểm xuất phát hoặc tuyến | README | Tab Lưu trú |
| F15 | Timeline theo ngày. Mỗi điểm dừng có giờ, thời lượng (có thể dài hơn thường lệ), chi phí cả nhóm và vé mỗi người. Mỗi chặng có thời gian, quãng đường (ước tính đường thẳng) và cước (xe máy, ô tô). Mỗi ngày có tổng. Điểm sau bắt đầu ngay khi tới nơi; không có khoảng chờ giữa ngày | README | Tab Lịch trình |
| F16 | Bản đồ Leaflet. Điểm xuất phát mang nhãn `0`; marker “phải ghé” màu đỏ; chỉ hiện tuyến của ngày đang xem | README, spec | Tab Bản đồ; khung phải trên desktop |
| F17 | Hình học đường đi từ OSRM. Khi lỗi thì nối đường thẳng kèm cảnh báo | `POST /routes/geometry` | Bản đồ |
| F18 | Link chỉ đường Google Maps cho từng điểm, mở tab mới. Trong chuyến dùng phương tiện của chuyến (đi bộ, hai bánh, ô tô). Chỉ đường hai bánh tuỳ vùng phủ của Google Maps. Ngoài chuyến (trình đọc chuyện, trang địa điểm mở trực tiếp) giữ cách tạo link hiện có | README | Thẻ điểm dừng; trang địa điểm; trình đọc chuyện |
| F19 | Thay địa điểm theo danh sách lý do hiện có | `POST …/replace` | Sheet “Thay địa điểm” |
| F20 | Tối ưu lại theo danh sách chiến lược hiện có | `POST …/optimize` | Sheet “Tối ưu lại” |
| F21 | Chia sẻ: mỗi lần gọi tạo một liên kết chỉ xem mới và làm liên kết cũ hết hiệu lực. Không có API đọc lại liên kết hiện tại | `POST …/share` | Sheet “Chia sẻ” |
| F22 | Mở lại chuyến bằng owner token lưu trên trình duyệt; xem chuyến bằng share token | `GET /trips/{id}` | `/trips`; chế độ chỉ xem |
| F23 | Điểm đánh giá và bình luận của từng địa điểm; người đã đăng nhập gửi đánh giá 1–5 sao kèm bình luận | `GET /places`, `POST …/reviews` | Trang địa điểm |
| F24 | Đăng ký và đăng nhập bằng email hoặc số điện thoại | `POST /auth/*` | `/account`; hộp đăng nhập khi viết đánh giá |
| F25 | Liên kết câu chuyện (tiêu đề, đoạn dẫn, thời gian đọc) trên địa điểm, điểm dừng, địa điểm dịp lễ, lưu trú | API `story` | Thẻ điểm dừng, trang địa điểm, dải lễ, tab Lưu trú |
| F26 | Danh sách câu chuyện; chuyện nổi bật có ảnh xếp trước | `GET /stories` | Trang chủ; `/stories` |
| F27 | Trình đọc chuyện: các phần, dòng thời gian, mẹo tham quan, nguồn, địa danh (chỉ đường, “lập lịch từ đây”), chuyện khác trong 2 km, ghi công ảnh | `GET /stories/{slug}` | `/stories/[slug]` |
| F28 | Truyền thuyết được trình bày là truyền thuyết | README | Trình đọc chuyện, theo cách dữ liệu đánh dấu |
| F29 | Lịch dịp lễ cả năm | `GET /holidays` | `/festivals` |
| F30 | Thời tiết khi có. README: planner chỉ dùng dự báo buổi chiều ngày đầu; API trả về “tình trạng có dự báo”. Chỉ hiện đúng phần API trả về **[kiểm P0]**. Không có thì ẩn, lịch trình vẫn chạy | `GET /weather` | Dải chọn ngày (chỉ ngày có dữ liệu) |
| F31 | Song ngữ VI/EN | README | Thanh trên cùng; `/account` |
| F32 | Ảnh có giấy phép và ghi công | README | Chú thích dưới ảnh; trang `/credits` (README yêu cầu có trước khi công bố) |
| F33 | Trạng thái tải, rỗng và lỗi cho mọi yêu cầu bất đồng bộ | Spec | Mọi màn |
| F34 | Chức năng có trong code nhưng chưa ghi ở README (ví dụ khoá điểm) | Code | Phát hiện ở Phase 0, giữ và đặt vào màn phù hợp |
| F35 | Sửa ngân sách hoặc sở thích rồi lập lại lịch trình (có E2E riêng) | README | Nút “Sửa yêu cầu” ở trang so sánh và trong menu `⋯` của lịch trình; mở `/plan` đã điền sẵn |
| F36 | Thẻ trải nghiệm theo mùa và theo ngày khi có ngày bắt đầu (README gọi là “seasonal cards”, chỉ có chữ) | README | Khối “Trong những ngày bạn đi” ở trang so sánh; dải lễ trong lịch trình |

---

## 4. Điều hướng và kiến trúc trang

### 4.1 Năm điểm đến

Hướng dẫn của Android/Material cho thanh điều hướng: dùng cho 3 đến 5 điểm đến có tầm quan trọng ngang nhau, trên màn hình hẹp, và giữ nguyên trên mọi màn. HanoiGO dùng đúng 5.

| Điểm đến | Nhãn VI | Nhãn EN | Biểu tượng Phosphor | Route | Việc chính |
|---|---|---|---|---|---|
| Trang chủ | Trang chủ | Home | `House` | `/` | Bắt đầu nhanh; xem lễ hội sắp tới và chuyện nổi bật |
| Chuyện kể | Chuyện kể | Stories | `BookOpenText` | `/stories` | Đọc chuyện các danh thắng |
| Lập lịch | Lập lịch | Plan | `Path` | `/plan` | Tạo lịch trình (hành động chính) |
| Lễ hội | Lễ hội | Festivals | `CalendarDots` | `/festivals` | Chọn ngày đi theo dịp lễ |
| Chuyến đi | Chuyến đi | Trips | `MapTrifold` | `/trips` | Mở lại và dùng chuyến đã lập |

Tài khoản không phải một tab. Nút avatar (`UserCircle`) trên thanh trên cùng dẫn tới `/account`.

**Vì sao chọn 5 điểm đến này.** Người dùng có ba nhu cầu:
1. lập chuyến;
2. dùng chuyến trên đường;
3. tìm cảm hứng, tức câu chuyện và lễ hội.

Backend không có API duyệt hay tìm kiếm địa điểm, nên không có tab “Địa điểm”. Địa điểm được mở từ lịch trình, câu chuyện và lễ hội.

### 4.2 Sơ đồ trang

```
/                              Trang chủ
├── /stories                   Chuyện kể
│   └── /stories/[slug]        Trình đọc chuyện
├── /plan?step=1..4            Lập lịch (toàn màn hình)
│   └── (màn chờ)              Đang lập lịch trình
├── /festivals                 Lịch lễ hội cả năm
├── /trips                     Chuyến của tôi (trên trình duyệt này)
│   └── /trips/[tripId]        So sánh 3 phương án
│       └── /trips/[tripId]/[option]?day=n&view=timeline|map|budget|stays
│                              Lịch trình
├── /places/[placeId]          Địa điểm (trang đầy đủ; từ lịch trình thì mở dạng sheet)
├── /account                   Tài khoản, ngôn ngữ, giao diện
└── /credits                   Ghi công ảnh và dữ liệu bản đồ
```

### 4.3 Bảng route

| Route | Thanh điều hướng | Tab sáng | API dùng |
|---|---|---|---|
| `/` | Hiện | Trang chủ | `GET /stories`, `GET /holidays`, `GET /weather` (chỉ khi có dữ liệu cho hôm nay **[kiểm P0]**) |
| `/stories` | Hiện | Chuyện kể | `GET /stories` |
| `/stories/[slug]` | Ẩn khi cuộn xuống, hiện khi cuộn lên | Chuyện kể | `GET /stories/{slug}` |
| `/plan` | Ẩn; thay bằng thanh bước | — | `GET /locations/resolve`, `POST /trips/generate` |
| `/festivals` | Hiện | Lễ hội | `GET /holidays?start&days=365&language` |
| `/trips` | Hiện | Chuyến đi | `GET /trips/{id}` cho mỗi token đã lưu |
| `/trips/[tripId]` | Hiện | Chuyến đi | `GET /trips/{id}` |
| `/trips/[tripId]/[option]` | Hiện | Chuyến đi | `GET /trips/{id}`, `POST …/replace`, `POST …/optimize`, `POST …/share`, `POST /routes/geometry`, `GET /weather` |
| `/places/[placeId]` | Hiện | Theo trang mở ra nó | `GET /places/{id}`, `POST …/reviews` |
| `/account` | Hiện | — | `POST /auth/register`, `POST /auth/login` |
| `/credits` | Hiện | — | Dữ liệu tĩnh trong `hanoi-images.ts` |

### 4.4 Thanh điều hướng dưới (điện thoại và máy tính bảng, rộng dưới 1024 px)

```
┌──────────────────────────────────────────┐
│  ▔▔▔                                     │  vạch mực 24×3 px trên tab đang mở
│  ⌂        ▤        ┏━━━┓      ▦       ▱  │
│ Trang   Chuyện    ┃ ⤳ ┃    Lễ hội  Chuyến│
│  chủ     kể       ┗━━━┛            đi    │
│                  Lập lịch                │
└──────────────────────────────────────────┘
```

**Kích thước và bố cục**
- Cao 64 px, cộng thêm `env(safe-area-inset-bottom)`.
- Nền `--paper`, viền trên 1 px `--line`.
- Năm cột đều nhau. Vùng chạm mỗi mục tối thiểu 48 × 56 px.
- Biểu tượng 24 px. Nhãn Archivo 12/16, độ đậm 500, luôn hiện.

**Trạng thái**
- Tab đang mở: biểu tượng dùng biến thể `fill` màu mực, nhãn đậm 600, vạch mực 24 × 3 px trượt tới (M01). Tab khác dùng `--ink-muted`.
- “Lập lịch” vẫn nằm trong hàng. Biểu tượng trắng đặt trên một tấm biển nền mực 48 × 36 px, bo 8 px (tương phản 16,63:1). Nền mực giúp mục này nổi bật mà không lấy mất màu đỏ của nút chính trong trang.
- Không dùng nút nổi (FAB) nhô lên che nội dung.

**Huy hiệu.** Khi có chuyến đi rơi vào hôm nay, tab Chuyến đi có chấm đỏ 8 px, kèm chữ ẩn cho trình đọc màn hình: “Có chuyến hôm nay”.
- Lúc tạo chuyến, trình duyệt lưu kèm token một bản tóm tắt nhỏ: `startDate`, số ngày, thời điểm tạo **[client]**.
- Huy hiệu tính từ bản tóm tắt này, không gọi API trên mỗi trang.

**Ẩn thanh khi**
- đang ở `/plan`;
- đang mở màn chọn điểm trên bản đồ;
- cuộn xuống trong trình đọc chuyện (cuộn lên hoặc tới cuối bài thì hiện lại, M23).

**Chạm lại tab đang mở** thì cuộn trang về đầu.

**Mã HTML.** `<nav aria-label="Điều hướng chính">`, mỗi mục là `<a>`, mục đang mở có `aria-current="page"`.

### 4.5 Thanh trên cùng

**Điện thoại**, cao 56 px:
- Bên trái: wordmark HanoiGO ở các trang gốc; nút quay lại (`CaretLeft`) và tên trang ở trang con.
- Bên phải: nút ngôn ngữ (chữ “VI” hoặc “EN”, vùng chạm 44 × 44 px) và avatar.
- Khi đã cuộn, nền chuyển từ trong suốt sang `--paper` và hiện viền dưới (M30).

**Máy tính (từ 1024 px)**, cao 64 px:

```
┌────────────────────────────────────────────────────────────────────────┐
│ HanoiGO     Chuyện kể    Lễ hội    Chuyến đi       [Lập lịch trình] VI ◯ │
│             ▔▔▔▔▔▔▔                                                      │
└────────────────────────────────────────────────────────────────────────┘
```

- Trang chủ là wordmark.
- Mục đang mở có gạch chân mực 2 px trượt tới (M01).
- Nút “Lập lịch trình” nền mực, chữ trắng, luôn ở bên phải. Không dùng đỏ, vì trang có thể đã có nút đỏ riêng.
- Ở `/plan`, nút này ẩn đi.
- Không có thanh dưới.

### 4.6 Thanh phụ trong lịch trình

Thanh phụ dính ngay dưới thanh trên cùng:
- Hàng 1: các ngày (cuộn ngang khi chuyến dài).
- Hàng 2: bộ chuyển chế độ xem **Lịch trình | Bản đồ | Chi phí | Lưu trú**. Trên desktop không có “Bản đồ”, vì bản đồ luôn hiện ở khung phải.

Chế độ xem và ngày nằm trong URL: `?day=2&view=map`. Trên desktop, `view=map` được hiểu là `view=timeline`, vì bản đồ đã luôn hiện. URL được chuẩn hoá bằng `router.replace`.

### 4.7 Trạng thái trong URL và tương thích ngược

- **Lịch trình** dùng `?day` và `?view`. Nút Back khôi phục đúng ngày và chế độ xem.
- **Form** dùng `?step=1..4`. Giá trị đang nhập lưu trong `sessionStorage` **[client]** để không mất khi quay lại.
  - Dữ liệu này chỉ sống trong tab đang mở và bị xoá khi lập lịch xong.
  - Toạ độ điểm xuất phát chỉ được gửi đi trong yêu cầu tạo chuyến.
- **Điền sẵn form từ nơi khác:**
  - Trang chủ: `?days=&people=&budget=`.
  - Lễ hội: `?startDate=YYYY-MM-DD`.
  - Trình đọc chuyện (“Lập lịch từ đây”): `?startName=&startLat=&startLng=`.
- **URL cũ.** Phase 0 liệt kê mọi URL hiện có. Mỗi URL cũ, nhất là liên kết chia sẻ có token, phải chuyển hướng 308 sang URL mới trong `redirects()` của `next.config`. Tên tham số token giữ nguyên.
- **Khoá `localStorage`** của owner token giữ nguyên, để chuyến đã lập vẫn mở được.

### 4.8 Quy tắc phân bổ thông tin

1. Một khung nhìn có tối đa một nút chính (đỏ). Hành động phụ dùng nút viền, nút chữ, hoặc menu `DotsThree`.
2. Mỗi thẻ chỉ hiện những gì cần để chọn hay bỏ. Mọi thứ khác nằm ở sheet chi tiết.
3. Nội dung dài hơn khoảng 3 đoạn thì sang trang riêng.
4. Cảnh báo đặt ngay cạnh thứ nó nói tới, không dồn lên đầu trang.

---

## 5. Phân bổ chức năng theo màn hình

| Màn hình | Việc chính | Luôn thấy | Chạm để mở | Sang trang khác |
|---|---|---|---|---|
| Trang chủ | Bắt đầu lập lịch | Biển hiệu hỏi số ngày; ngân sách; số người; nút lập lịch | Lễ hội sắp tới; chuyện nổi bật; chuyến đang đi (nếu có) | `/plan`, `/stories/[slug]`, `/festivals` |
| Lập lịch, bước 1 | Nhập khung chuyến | Ngày, người, ngân sách, ngày bắt đầu | Giải thích ngày bắt đầu | — |
| Lập lịch, bước 2 | Chọn điểm xuất phát | Ô nhập, vị trí hiện tại, chọn trên bản đồ | Danh sách điểm có sẵn | Màn chọn trên bản đồ |
| Lập lịch, bước 3 | Cách đi lại | Phương tiện, phạm vi | Giờ trong ngày, nhịp độ (nếu có) | — |
| Lập lịch, bước 4 | Sở thích và gửi | Sở thích; tóm tắt; nút lập lịch | Trường nâng cao | Màn chờ |
| So sánh phương án | Chọn một phương án | Tên, chi phí, tỉ lệ ngân sách, quãng đường, thời gian đi lại, số điểm, tuyến thu nhỏ; cảnh báo ngân sách khi có | Trải nghiệm theo mùa; “Sửa yêu cầu” | Lịch trình; `/plan` |
| Lịch trình | Đi theo từng ngày | Ngày, tuyến, giờ, tên điểm, chi phí, chặng | Chi tiết điểm; thay địa điểm; tối ưu lại; chia sẻ | Trang địa điểm, trình đọc chuyện, Google Maps |
| Địa điểm | Quyết định ghé và xem đánh giá | Tên, loại, “phải ghé”, điểm đánh giá, chỉ đường, giờ mở cửa, vé | Toàn bộ bình luận | Trình đọc chuyện |
| Chuyện kể | Chọn chuyện để đọc | Chuyện nổi bật có ảnh; danh sách | — | Trình đọc chuyện |
| Trình đọc chuyện | Đọc | Tiêu đề, ảnh, các phần, dòng thời gian, mẹo, nguồn (cuối bài) | Mục lục | Chỉ đường; `/plan` từ địa danh; chuyện gần đó |
| Lễ hội | Chọn dịp để đi | Tháng, ngày dương, ngày âm (nếu có), tên dịp, gợi ý | Nơi tổ chức (nếu API có) | `/plan?startDate=` |
| Chuyến đi | Mở lại chuyến | Chuyến hôm nay; sắp tới; đã qua | Xoá khỏi máy này **[client]** | Lịch trình |
| Tài khoản | Đăng nhập và cài đặt | Đăng nhập hoặc đăng ký; ngôn ngữ | Giao diện sáng hoặc tối | `/credits` |

---

## 6. Hệ thị giác (design tokens)

### 6.1 Màu

Tỉ lệ tương phản tính theo công thức WCAG 2.2. Chữ thường cần ≥ 4,5:1. Chữ lớn (≥ 24 px, hoặc ≥ 18,66 px đậm) và thành phần không phải chữ cần ≥ 3:1.

| Token | Tên | Sáng | Tối | Dùng cho | Tương phản đã kiểm |
|---|---|---|---|---|---|
| `--paper` | Nền | `#FFFFFF` | `#15171C` | Nền trang | — |
| `--paper-sunken` | Nền lõm | `#F3F3EF` | `#1F222A` | Khối phụ, ô nhập | Mực trên nền lõm: 14,95 |
| `--ink` | Mực sơn | `#1C1E26` | `#EDEEF2` | Chữ chính | 16,63 trên trắng; 15,47 trên nền tối |
| `--ink-muted` | Mực nhạt | `#555A68` | `#A9ADBA` | Chữ phụ | 6,89 trên trắng; 8,0 trên nền tối |
| `--line` | Kẻ mảnh | `#D9DAD3` | `#2E323C` | Phân cách trang trí | 1,41 (không dùng cho viền điều khiển) |
| `--line-strong` | Viền điều khiển | `#8E92A0` | `#7A7F8F` | Viền ô nhập, nút viền | 3,1 trên trắng; 4,49 trên nền tối |
| `--sign-red` | Đỏ biển hiệu | `#C8231E` | nền nút `#D6352B`, chữ `#FF7A6E` | Nút chính, “phải ghé”, lỗi | Chữ trắng trên đỏ: 5,65 (tối: 4,77); chữ đỏ tối: 7,05 |
| `--sign-red-press` | Đỏ khi nhấn | `#A51C18` | `#B32A21` | Nút chính khi nhấn | Chữ trắng: 7,56 (tối: 6,42) |
| `--sign-red-soft` | Nền đỏ nhạt | `#FDECEA` | `#3B1A18` | Nền báo lỗi | Chữ đỏ: 4,94 (tối: 6,13) |
| `--sign-blue` | Lam biển hiệu | `#1F4FA3` | `#8FB2F5` | Liên kết, lựa chọn, viền focus | 7,76 trên trắng; 8,41 trên nền tối |
| `--sign-blue-soft` | Nền lam nhạt | `#E8EEF9` | `#1B2840` | Mục đang chọn | Chữ lam: 6,66 (tối: 6,92) |
| `--wall-yellow` | Vàng tường | `#F2C14E` | `#F2C14E` | Mảng lớn: biển hiệu, lễ hội | Chữ mực trên vàng: 9,91 |
| `--wall-yellow-soft` | Vàng nhạt | `#FFF3CC` | `#3A2F12` | Nền cảnh báo, vệt loé khi thay đổi | Chữ cảnh báo: 6,49 (tối: chữ vàng 7,84) |
| `--warn-ink` | Chữ cảnh báo | `#7A4E00` | `#F2C14E` | Chữ cảnh báo | Xem dòng trên |
| `--moss` | Rêu | `#2F6B4F` | `#6FC197` | Trong ngân sách, thành công | 6,29 trên trắng; 8,33 trên nền tối |
| `--moss-soft` | Nền rêu nhạt | `#E3F0E8` | `#17301F` | Nền báo thành công | Chữ rêu: 5,36 (tối: 6,59) |

**Màu tuyến theo ngày.** Màu dùng lặp lại từ ngày 6. Không có đỏ trong bảng này, vì đỏ đã có nghĩa “phải ghé” và “hành động chính”.

| Ngày | Sáng | Tối | Sáng so với nền trắng | Sáng so với nền bản đồ xám `#E6E6E3` | Tối so với `#15171C` |
|---|---|---|---|---|---|
| 1 | `#1F4FA3` lam | `#8FB2F5` | 7,76 | 6,21 | 8,41 |
| 2 | `#2F6B4F` rêu | `#6FC197` | 6,29 | 5,03 | 8,33 |
| 3 | `#A86A00` nghệ | `#E0A43A` | 4,44 | 3,55 | 8,15 |
| 4 | `#7A3E7A` mận | `#D79BD7` | 7,51 | 6,0 | 8,16 |
| 5 | `#0F6B78` lam ngọc | `#5CC4D1` | 6,19 | 4,95 | 8,77 |

**Màu nhóm chi phí** (tab Chi phí): Tham quan `--sign-blue`; Ăn uống `--moss`; Di chuyển `--cat-transport` (`#A86A00`, tối `#E0A43A`); Khác `--line-strong`. Mỗi đoạn luôn có nhãn chữ, nên màu không phải kênh thông tin duy nhất.

**Tổ hợp bị cấm**
- Chữ vàng trên nền trắng (1,68:1).
- Chữ đỏ trên nền vàng ở cỡ dưới 24 px (3,37:1).
- Chữ `--ink-muted` trên nền vàng (4,1:1). Trên vàng chỉ dùng chữ `--ink`.
- Dùng `--line` làm viền cho ô nhập hoặc nút.
- Hai tuyến ngày cùng hiện mà không có nhãn số ngày. Với người khó phân biệt màu, các tuyến có thể trông giống nhau. Vì vậy bản đồ chỉ vẽ tuyến của một ngày tại một thời điểm, và dải ngày luôn ghi số ngày.

### 6.2 Chữ

**Hai họ chữ, vai trò tách bạch**

| Họ chữ | Vai trò | Lý do |
|---|---|---|
| **Phudu** (OFL, biến thiên độ đậm 300–900, có bộ tiếng Việt) | Biển hiệu, tiêu đề lớn của trang gốc, tiêu đề trong trình đọc chuyện | Lấy cảm hứng từ biển quảng cáo vẽ tay ngày trước của Việt Nam; chỉ dùng ở cỡ lớn |
| **Archivo** (OFL, trục `wdth` 62–125 và `wght` 100–900, có bộ tiếng Việt và `tnum`) | Toàn bộ giao diện, văn bản, số liệu | Grotesk rõ ràng. Trục độ rộng cho phép số tiền lớn dùng khổ rộng và bảng dày dùng khổ hẹp mà không cần thêm họ chữ |

**Đã kiểm qua file phông của Fontsource**
- Cả hai họ chữ có đủ glyph `Ệ Ấ Ữ đ ₫`.
- Archivo có tính năng `tnum` (chữ số đều cột).
- File Be Vietnam Pro trên Fontsource (bản phân phối từ Google Fonts) không có `tnum`, và chữ số của nó rộng hẹp khác nhau. Đây là lý do không chọn nó cho giao diện nhiều số.

**Thang chữ.** Thang có tỉ lệ 1,25 với gốc 16 px.

| Token | Họ chữ | Điện thoại (cỡ/dòng) | Desktop (cỡ/dòng) | Độ đậm | Dùng cho |
|---|---|---|---|---|---|
| `display-sign` | Phudu | 49/57 | 76/88 | 800 | Biển hiệu trang chủ |
| `display` | Phudu | 39/46 | 61/72 | 700 | Tiêu đề trang gốc, tiêu đề chuyện |
| `h1` | Archivo | 31/38 | 39/46 | 700 | Tiêu đề trang con |
| `h2` | Archivo | 25/32 | 31/38 | 650 | Tiêu đề khối |
| `h3` | Archivo | 20/28 | 20/28 | 600 | Tên điểm dừng, tên phương án |
| `money-l` | Archivo `wdth 112`, `tnum` | 31/36 | 39/44 | 700 | Tổng chi phí |
| `body` | Archivo | 16/26 | 17/28 | 400 | Văn bản |
| `body-read` | Archivo | 18/30 | 19/32 | 400 | Thân bài trình đọc chuyện, tối đa 68 ký tự mỗi dòng |
| `small` | Archivo | 14/22 | 14/22 | 400 | Chữ phụ |
| `caption` | Archivo | 13/20 | 13/20 | 400 | Ghi công ảnh, chú thích; không nhỏ hơn 12 |
| `time` | Archivo `wdth 88`, `tnum` | 15/20 | 15/20 | 600 | Cột giờ trên timeline |

**Quy tắc riêng cho tiếng Việt**
- Dấu chồng (Ệ, Ấ, Ữ) cần chỗ. Chữ display có `line-height` ≥ 1,15 và chữ thân bài ≥ 1,6. Không đặt `line-height: 1` cho tiêu đề.
- Không giãn chữ âm quá −0,01 em; dấu của hai chữ cạnh nhau sẽ chạm vào nhau.
- Không in hoa cả nhãn. Chữ in hoa có dấu cao hơn, làm vỡ nhịp dòng.
- Tiêu đề dùng `text-wrap: balance`, đoạn văn dùng `text-wrap: pretty` (tăng cường dần; trình duyệt không hỗ trợ thì bỏ qua).
- Không ngắt từ bằng gạch nối.

**Định dạng số và ngày**
- Tiền: định dạng phần số bằng `Intl.NumberFormat('vi-VN')` (kiểu `decimal`) rồi ghép đơn vị theo quy ước code đang dùng, ví dụ “2.850.000 đ”. Lưu ý kiểu `currency` của `Intl` cho ra “2.850.000 ₫” (VI) và “₫2,850,000” (EN), nên không dùng thẳng nếu sản phẩm đang viết “đ” hoặc “VND”. Tiếng Anh: `Intl.NumberFormat('en-US')` cộng “ VND”, ví dụ “2,850,000 VND”.
- Khoảng cách: “3,4 km” (VI), “3.4 km” (EN).
- Thời lượng: “1 giờ 30 phút” (VI), “1 h 30 min” (EN).
- Ngày: dùng `Intl.DateTimeFormat`. Ví dụ 18/10/2026 là Chủ Nhật: “Chủ Nhật, 18/10” (VI), “Sun 18 Oct” (EN).
- Ngày âm lịch, khi dữ liệu có: “mùng 6 tháng Giêng”.
- Mọi cột số dùng `font-variant-numeric: tabular-nums`.

**Nạp phông.** Dùng `next/font/google`:
- Phudu và Archivo, mỗi họ với `subsets: ['latin', 'vietnamese']`.
- Archivo khai báo thêm `axes: ['wdth']`.
- `next/font` preload phông ở mọi route import nó. Vì Phudu dùng cho tiêu đề ở các trang gốc, chỉ nạp Phudu 700 và 800 để giữ dung lượng nhỏ.

### 6.3 Lưới, khoảng cách, điểm ngắt

- **Đơn vị khoảng cách:** 4 px. Thang 4, 8, 12, 16, 24, 32, 48, 64, 96.
- **Điểm ngắt:** dưới 640 (điện thoại), 640–1023 (máy tính bảng), từ 1024 (desktop), từ 1440 (desktop rộng).
- **Lề trang:** 16 px trên điện thoại, 24 px trên máy tính bảng, 40 px trên desktop.
- **Chiều rộng tối đa nội dung:** 1280 px. Trang đọc tối đa 68 ký tự mỗi dòng.
- **Căn lề:** mặc định căn trái. Không căn giữa đoạn văn. Chỉ căn giữa trạng thái rỗng ngắn và màn chờ.
- **Lịch trình trên desktop:** khung trái 5/12 (timeline), khung phải 7/12 (bản đồ dính).
- **Không cuộn ngang toàn trang.** Chỉ dải ngày, dải lễ hội và băng thẻ trên bản đồ được cuộn ngang, và các dải này có `scroll-snap`.

### 6.4 Hình khối và độ nổi

Bo góc theo cấp, không một bán kính cho mọi thứ:

| Thành phần | Bo góc |
|---|---|
| Nhãn nhỏ (“Phải ghé”, “Rẻ nhất”) | 2 px |
| Biển hiệu | 4 px, viền kép (§6.8) |
| Nút, ô nhập, chip | 8 px |
| Thẻ điểm dừng, thẻ chuyện | 12 px |
| Sheet (hai góc trên) | 20 px |
| Ga trên tuyến, avatar | Tròn |

**Độ nổi chỉ có hai mức, và chỉ cho thứ nổi trên nội dung:**
- Mức 1 (thanh điều hướng, nút điều khiển bản đồ): `0 2px 8px rgb(28 30 38 / 0.16)`.
- Mức 2 (sheet, hộp thoại): `0 -8px 24px rgb(28 30 38 / 0.18)`.

Nội dung nằm trong luồng trang không có bóng. Thẻ phân tách bằng nền `--paper-sunken` hoặc viền `--line`.

### 6.5 Biểu tượng

- Dùng gói `@phosphor-icons/react` (MIT). Trong Server Components, import từ `@phosphor-icons/react/ssr`.
- Kiểu `regular` cho trạng thái thường, `fill` cho tab đang mở.
- Cỡ 20 px trong dòng chữ, 24 px trong thanh điều hướng.
- Biểu tượng đi kèm chữ thì đặt `aria-hidden`. Nút chỉ có biểu tượng phải có `aria-label`.
- Bảng tên đã kiểm có trong bản 2.1.10:

| Ý nghĩa | Biểu tượng |
|---|---|
| Trang chủ / Chuyện kể / Lập lịch / Lễ hội / Chuyến đi | `House` / `BookOpenText` / `Path` / `CalendarDots` / `MapTrifold` |
| Đi bộ / Xe máy / Ô tô | `PersonSimpleWalk` / `Motorcycle` / `Car` |
| Chỉ đường / Ghim / Vị trí hiện tại | `NavigationArrow` / `MapPin` / `Crosshair` |
| Thay địa điểm / Tối ưu lại / Chia sẻ | `Swap` / `ArrowsClockwise` / `ShareNetwork` |
| Thời gian / Chi phí / Lưu trú / Đánh giá | `Clock` / `Coins` / `Bed` / `Star` |
| Nắng / Mưa | `Sun` / `CloudRain` |
| Cảnh báo / Thông tin / Đóng / Quay lại | `Warning` / `Info` / `X` / `CaretLeft` |
| Sao chép / Xong / Menu thêm / Ngôn ngữ / Tài khoản | `Copy` / `Check` / `DotsThree` / `Translate` / `UserCircle` |
| Nguồn / Câu chuyện | `SealCheck` / `Scroll` |

### 6.6 Ảnh

- Chỉ dùng ảnh trong `frontend/public/images/hanoi`, với giấy phép ghi ở `hanoi-images.ts`.
- **Ghi công ảnh.** README ghi rằng ảnh hero và ô chuyện hiện chưa có dòng ghi công. Thiết kế mới sửa như sau:
  - Ảnh lớn (hero, ảnh chuyện nổi bật, ảnh mở đầu trình đọc) có dòng ghi công ngay dưới ảnh (`caption`, 13 px): tác giả, giấy phép, liên kết.
  - Ảnh thu nhỏ (cạnh ≤ 160 px) không đủ chỗ cho dòng chữ. Chúng được ghi công trên trang `/credits`, liên kết từ chân trang và từ cuối danh sách chuyện. Điều 3(a)(2) của CC BY 4.0 cho phép ghi công “theo bất kỳ cách hợp lý nào”, kể cả bằng liên kết tới trang chứa thông tin. Ảnh dùng giấy phép phiên bản cũ hơn (2.0, 3.0) phải kiểm điều khoản tương ứng của từng phiên bản.
- Tỉ lệ khung: hero trang chủ 4:5 trên điện thoại, 3:4 trên desktop; ảnh chuyện nổi bật 3:2; ảnh mở đầu trình đọc chuyện 4:5 trên điện thoại, 16:9 trên desktop.
- Lớp tối dưới chữ đè ảnh: `linear-gradient(to top, rgb(0 0 0 / 0.55), transparent 60%)`. Đây là gradient duy nhất được phép, và chỉ để chữ đọc được.
- Không đặt filter làm đổi màu ảnh.
- Thẻ phương án, thẻ theo mùa, thẻ lưu trú, điểm dừng **không có ảnh** (README). Thiết kế dựa vào chữ, tuyến và màu. Không thêm ảnh stock.

### 6.7 Bản đồ

- **Ô nền OSM** được làm trung tính để tuyến nổi lên:
  - Sáng: `.leaflet-tile-pane { filter: grayscale(1) contrast(0.92) brightness(1.04); }`
  - Tối: `filter: grayscale(1) invert(1) brightness(0.85) contrast(0.9);`
  - Dòng ghi công “© OpenStreetMap contributors” luôn hiện, không bị filter làm mờ.
- **Tuyến:** nét 5 px, đầu và góc tròn, màu của ngày.
- **Tuyến lùi khi OSRM lỗi:** nét đứt `6 6` cùng màu, kèm nhãn cảnh báo “Đang nối các điểm bằng đường thẳng”.
- **Marker** là `L.divIcon` vẽ bằng HTML/CSS:

| Marker | Hình dạng |
|---|---|
| Điểm xuất phát | Ô vuông 28 px nền mực, số “0” trắng |
| Điểm dừng thường | Vòng tròn 28 px nền trắng, viền 3 px màu ngày, số thứ tự Archivo 700 |
| Điểm “phải ghé” | Vòng tròn đặc đỏ, số trắng, thêm vòng ngoài 2 px |
| Điểm có câu chuyện | Chấm vàng 8 px viền mực ở góc trên phải; trong `aria-label` thêm “có câu chuyện” |
| Đang chọn | Phóng 1,2 lần, quầng 8 px màu ngày ở độ mờ 25% |

- **Vùng chạm:** hình marker 28 px, nhưng `iconSize` của `divIcon` là 44 × 44 px, phần thừa trong suốt. Vùng chạm vì thế đạt 44 px như mọi điều khiển khác.
- **Phím:** marker Leaflet mặc định nhận focus bằng bàn phím (`keyboard: true`). Giữ nguyên.
- **Bản đồ không chở thông tin riêng.** Mọi thông tin trên bản đồ cũng có trong timeline, nên timeline là phương án thay thế tiếp cận được cho bản đồ.

### 6.8 Biển hiệu (thành phần chữ ký)

```
╔══════════════════════════════════╗
║┌────────────────────────────────┐║   viền ngoài 2 px mực
║│  Bạn có mấy ngày               │║   viền trong 1 px mực, lùi vào 4 px
║│  ở Hà Nội?                     │║   chữ Phudu
║└────────────────────────────────┘║   nền trắng hoặc vàng tường
╚══════════════════════════════════╝
```

Chỉ dùng ở ba nơi:
1. hero trang chủ;
2. tiêu đề trang Lễ hội;
3. tiêu đề trong trình đọc chuyện.

Không dùng cho nút, thẻ hay trạng thái rỗng. Hiếm thì mới đáng nhớ.

### 6.9 Biến CSS

```css
:root {
  --paper: #FFFFFF;          --paper-sunken: #F3F3EF;
  --ink: #1C1E26;            --ink-muted: #555A68;
  --line: #D9DAD3;           --line-strong: #8E92A0;
  --sign-red: #C8231E;       --sign-red-press: #A51C18;  --sign-red-soft: #FDECEA;
  --sign-red-text: #C8231E;
  --sign-blue: #1F4FA3;      --sign-blue-soft: #E8EEF9;
  --wall-yellow: #F2C14E;    --wall-yellow-soft: #FFF3CC; --warn-ink: #7A4E00;
  --moss: #2F6B4F;           --moss-soft: #E3F0E8;
  --focus: var(--sign-blue);
  --day-1: #1F4FA3; --day-2: #2F6B4F; --day-3: #A86A00; --day-4: #7A3E7A; --day-5: #0F6B78;
  --cat-attraction: var(--sign-blue); --cat-food: var(--moss);
  --cat-transport: #A86A00;           --cat-other: var(--line-strong);

  --radius-tag: 2px; --radius-sign: 4px; --radius-control: 8px;
  --radius-card: 12px; --radius-sheet: 20px;

  --dur-fade: 150ms; --dur-tap: 100ms; --dur-small: 200ms; --dur-medium: 300ms;
  --dur-large: 500ms; --dur-route: 800ms; --dur-moment: 1000ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-exit: cubic-bezier(0.3, 0, 0.8, 0.15);
  --ease-settle: cubic-bezier(0, 0, 0, 1);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #15171C; --paper-sunken: #1F222A;
    --ink: #EDEEF2;   --ink-muted: #A9ADBA;
    --line: #2E323C;  --line-strong: #7A7F8F;
    --sign-red: #D6352B; --sign-red-press: #B32A21;
    --sign-red-soft: #3B1A18; --sign-red-text: #FF7A6E;
    --sign-blue: #8FB2F5; --sign-blue-soft: #1B2840;
    --wall-yellow-soft: #3A2F12; --warn-ink: #F2C14E;
    --moss: #6FC197; --moss-soft: #17301F;
    --day-1: #8FB2F5; --day-2: #6FC197; --day-3: #E0A43A; --day-4: #D79BD7; --day-5: #5CC4D1;
    --cat-transport: #E0A43A;
  }
}
:root[data-theme="dark"] {
  --paper: #15171C; --paper-sunken: #1F222A;
  --ink: #EDEEF2;   --ink-muted: #A9ADBA;
  --line: #2E323C;  --line-strong: #7A7F8F;
  --sign-red: #D6352B; --sign-red-press: #B32A21;
  --sign-red-soft: #3B1A18; --sign-red-text: #FF7A6E;
  --sign-blue: #8FB2F5; --sign-blue-soft: #1B2840;
  --wall-yellow-soft: #3A2F12; --warn-ink: #F2C14E;
  --moss: #6FC197; --moss-soft: #17301F;
  --day-1: #8FB2F5; --day-2: #6FC197; --day-3: #E0A43A; --day-4: #D79BD7; --day-5: #5CC4D1;
  --cat-transport: #E0A43A;
}
```

Hai khối tối giống hệt nhau là cố ý. Khối đầu theo cài đặt của máy; khối sau dùng khi người dùng chọn “Tối” trong `/account`.

Nền nút đỏ dùng `--sign-red`. Chữ đỏ (lỗi, nhãn) dùng `--sign-red-text`, vì trên nền tối chữ đỏ cần sáng hơn nền nút.

Giao diện tối là ưu tiên P1: làm sau khi luồng chính xong, nhưng token phải có từ Phase 1.

---

## 7. Hệ chuyển động

### 7.1 Nguyên tắc

1. **Nhiều chuyển động, nhưng mỗi chuyển động có việc.** Chuyển động cho thấy cái gì vừa mở, vừa đổi, vừa xong. Không chuyển động nào chỉ để trang trí.
2. **Mỗi màn có tối đa một khoảnh khắc tự chạy.**

   | Màn | Khoảnh khắc tự chạy |
   |---|---|
   | Trang chủ | Biển hiệu được “sơn” (M03) |
   | Màn chờ | Tuyến vẽ lặp (M10) |
   | So sánh phương án | Ba phương án xuất hiện (M11) |
   | Lịch trình | Tuyến của ngày được vẽ (M13) |

   Mọi chuyển động còn lại đáp lại thao tác của người dùng.
3. **Không chặn thao tác.**
   - Phản hồi đầu tiên cho một thao tác (nhấn, đổi trạng thái, mở) bắt đầu trong 100 ms và xong trong ≤ 300 ms.
   - Chuyển động kể lại thay đổi lớn (bay bản đồ, vẽ tuyến, đổi thứ tự điểm, phần tử chung giữa hai màn) được dài tới 800 ms.
   - Trong lúc chuyển động chạy, người dùng vẫn chạm và cuộn được.
4. **Ưu tiên `transform` và `opacity`.**
   - Đổi kích thước hay vị trí thì dùng kỹ thuật FLIP (Motion `layout`).
   - Không chuyển động các thuộc tính gây tính lại bố cục: `width`, `height`, `top`, `left`, `margin`, `padding`.
   - Ngoại lệ được phép: `stroke-dashoffset` trên SVG nhỏ (tuyến, dấu tích); `background-color`, `border-color` trong chuyển động ngắn.
5. **Tôn trọng `prefers-reduced-motion`.** Mọi chuyển động trong §7.3 có cột thay thế. Không có trường hợp nào chuyển động bị tắt đến mức làm mất thông tin.
6. **Không chiếm quyền cuộn.** Không có thư viện cuộn mượt, không khoá cuộn, không parallax bằng JavaScript.

### 7.2 Token

Thời lượng và đường cong lấy từ hệ Material Design 3.

| Token | Giá trị | Tương ứng M3 | Dùng cho |
|---|---|---|---|
| `--dur-fade` | 150 ms | short3 | Mờ chéo, phương án thay thế khi giảm chuyển động |
| `--dur-tap` | 100 ms | short2 | Phản hồi nhấn |
| `--dur-small` | 200 ms | short4 | Chip, công tắc, đổi biểu tượng |
| `--dur-medium` | 300 ms | medium2 | Vào trang, mở sheet, đổi bước |
| `--dur-large` | 500 ms | long2 | Đổi thứ tự, phần tử chung giữa hai màn |
| `--dur-route` | 800 ms | extra-long2 | Bay bản đồ, vẽ tuyến |
| `--dur-moment` | 1000 ms | extra-long4 | Khoảnh khắc tự chạy duy nhất của màn |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | standard | Mặc định |
| `--ease-enter` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | emphasized decelerate | Thứ đi vào |
| `--ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | emphasized accelerate | Thứ đi ra |
| `--ease-settle` | `cubic-bezier(0, 0, 0, 1)` | standard decelerate | Dừng lại sau kéo |

Lò xo trong Motion: các giá trị khởi đầu dưới đây cần chỉnh trên thiết bị thật.

```ts
export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 40 }, // vạch tab, chip
  sheet:  { type: "spring", stiffness: 400, damping: 38 }, // sheet, thẻ mở rộng
  gentle: { type: "spring", stiffness: 260, damping: 30 }, // đổi thứ tự điểm dừng
} as const;
```

Thời lượng thoát bằng khoảng 2/3 thời lượng vào. Mọi thời lượng trong §7.3 lấy từ bảng token trên. Riêng chu kỳ của chuyển động lặp (M10, M24, M27) là thông số riêng của từng chuyển động.

### 7.3 Danh mục chuyển động

| ID | Tên | Kích hoạt | Mô tả | Thời lượng, đường cong | Khi giảm chuyển động |
|---|---|---|---|---|---|
| M01 | Vạch tab | Chọn tab | Vạch mực trượt tới tab mới (Motion `layoutId`) | spring `snappy` | Đổi ngay |
| M02 | Vào trang | Điều hướng | Nội dung mới: opacity 0→1, dịch y 12→0 px (`template.tsx`) | 300, enter | Chỉ opacity, 150 |
| M03 | Sơn biển hiệu | Mở trang chủ, mỗi phiên một lần | Khung biển vẽ viền; chữ lộ dần từ trái sang bằng `clip-path`, như một nét cọ | 1000, enter | Hiện ngay |
| M04 | Nhấn nút | Pointer down | `scale(0.97)` | 100, standard | Chỉ đổi màu nền |
| M05 | Bật chip | Chạm chip | Nền đổ từ trái; dấu tích tự vẽ (`pathLength` 0→1) | 200, standard | Đổi ngay |
| M06 | Đổi bước form | Tiếp tục / Quay lại | Trượt ngang 24 px theo hướng đi, kèm mờ dần | 300 vào, 200 ra | Chỉ opacity |
| M07 | Ước tính theo người | Gõ ngân sách | Dòng “khoảng … đ mỗi người mỗi ngày” chạy số tới giá trị mới | 300, settle | Đổi ngay |
| M08 | Ghim chọn điểm | Kéo bản đồ | Ghim nhấc lên 8 px và bóng giãn khi kéo; hạ xuống có nảy khi thả | spring | Không nảy |
| M09 | Báo lỗi trường | Kiểm tra lỗi | Viền đỏ; dòng lỗi mở ra bằng `layout`. Không rung | 200 | Không mở rộng có chuyển động |
| M10 | Màn chờ | Đang tạo lịch trình | Một tuyến vẽ lặp qua các ga; chú thích đổi mỗi 1,6 s. Không có phần trăm | Lặp 2400 | Tuyến tĩnh; chú thích đổi không chuyển động |
| M11 | Ba phương án | Kết quả về | Ba phương án hiện lần lượt cách nhau 80 ms; mỗi phương án vào trong 300 ms; số tiền chạy và thanh ngân sách đầy dần trong 500 ms | Khoảng 660 tổng, enter | Hiện ngay |
| M12 | Mở phương án | Chọn phương án | Tên và chi phí của phương án biến thành header lịch trình (phần tử chung, `layoutId`) | 500, spring `sheet` | Hiện chéo 150 |
| M13 | Vẽ tuyến | Lần đầu xem một ngày | Đường dọc timeline mọc từ trên xuống (`scaleY`, gốc ở trên); cùng lúc tuyến trên bản đồ tự vẽ (`stroke-dashoffset`); các ga hiện theo | 800, enter | Hiện ngay |
| M14 | Đổi ngày | Chọn ngày | Timeline trượt theo hướng ngày; bản đồ `flyToBounds`; tuyến mới vẽ lại | 300 và 800 | `fitBounds` không chuyển động; chỉ opacity |
| M15 | Đồng bộ timeline và bản đồ | Rê chuột, focus, chạm | Một điểm được chọn thì marker phóng 1,2 lần và có quầng. Chạm marker thì timeline cuộn tới thẻ và thẻ viền lam | 200 | Không phóng; chỉ đổi viền |
| M16 | Mở chi tiết | Chạm thẻ | Sheet trượt lên (điện thoại) hoặc thẻ mở rộng tại chỗ (desktop, `layout`) | spring `sheet` | Opacity 150 |
| M17 | Thay địa điểm | Xác nhận thay | Thẻ cũ trượt trái và mờ; thẻ mới vào từ phải; giờ các điểm sau lật số; ô thay đổi loé `--wall-yellow-soft` rồi nhạt trong 1,2 s; tổng chi phí chạy tới giá trị mới | 500 cả cụm | Đổi ngay; giữ vệt nền tĩnh 1,2 s |
| M18 | Tối ưu lại | Áp dụng chiến lược | Thẻ đổi chỗ bằng FLIP; tuyến vẽ lại; số tổng chạy | spring `gentle` | Đổi ngay |
| M19 | Sheet | Mở, đóng, kéo | Trượt lên theo lò xo; kéo xuống để đóng, xét theo vận tốc | spring `sheet` | Opacity 150 |
| M20 | Băng thẻ trên bản đồ | Vuốt thẻ | Thẻ khớp vào vị trí (`scroll-snap`); bản đồ `panTo` marker tương ứng | 500 | `setView` không chuyển động |
| M21 | Thanh ngân sách | Mở tab Chi phí | Các đoạn mọc lần lượt từ trái; số liệu chạy | 500 | Hiện ngay |
| M22 | Trình đọc chuyện | Cuộn | Thanh tiến độ đọc; ảnh mở đầu thu từ 1,06 về 1; các mốc trên dòng thời gian sáng lên khi vào khung nhìn. Dùng CSS scroll-driven trong `@supports` | Theo cuộn | Không có |
| M23 | Ẩn hiện thanh dưới | Cuộn trong trình đọc | Dịch y ra khỏi màn hình và trở lại | 300 | Thanh luôn hiện |
| M24 | Dịp đang diễn ra | Có dịp trùng hôm nay | Chấm đỏ nhịp chậm (opacity 1↔0,4) | Lặp 2000 | Chấm tĩnh |
| M25 | Toast | Có thông báo | Trượt lên và mờ dần; tự ẩn sau 5 s; dừng đếm khi rê chuột hoặc focus | 300 | Opacity |
| M26 | Sao chép liên kết | Chạm “Sao chép” | Biểu tượng `Copy` đổi thành `Check` tự vẽ | 200 | Đổi ngay |
| M27 | Khung chờ (skeleton) | Đang tải | Nhịp opacity 0,6↔1. Không dùng vệt sáng gradient | Lặp 1200 | Tĩnh |
| M28 | Đổi ngôn ngữ | Chạm VI/EN | Chữ hiện chéo; giữ kích thước khối để không nhảy bố cục | `--dur-fade` | Đổi ngay |
| M29 | Ảnh thẻ chuyện | Rê chuột (chỉ desktop) | Ảnh phóng 1,03 trong khung | 300 | Không |
| M30 | Thanh trên khi cuộn | Cuộn khỏi đầu trang | Nền đổi từ trong suốt sang `--paper`, hiện viền dưới. Header lịch trình gọn lại: dòng thứ hai mờ đi và trượt lên (transform); khối header đổi chiều cao bằng FLIP (`layout`), không chuyển động `height` | 200, standard | Đổi ngay |

### 7.4 Cài đặt

**Thư viện**
- Dùng `motion` (gói kế tục `framer-motion`) cho chuyển động trong React. Import từ `motion/react`.
- Bản 14.3.0 có đủ các API dùng trong tài liệu này: `MotionConfig` (`reducedMotion: "user"`), `LazyMotion`, `domMax`, `AnimatePresence`, `useReducedMotion`, `layoutId`, `drag`.
- **Phiên bản.** Major 14 ra ngày 02/10/2026; bản 14.3.0 ra ngày 15/10/2026, chỉ một ngày trước khi soạn tài liệu này.
  - Chọn bản đã phát hành ít nhất 2 tuần và khoá phiên bản chính xác trong `package-lock.json`.
  - Nếu bản 14 gặp lỗi, dùng dòng 13.5.x.
  - Đọc changelog trước khi nâng major.
- **Gói tính năng.** Tài liệu Motion (gzip): thành phần `m` trong `LazyMotion` khởi đầu khoảng 5 kB; `domAnimation` thêm 24 kB; `domMax` thêm 38 kB; thành phần `motion` đầy đủ không giảm được dưới 43 kB.
  - HanoiGO cần `layoutId`, `layout` và `drag` (M01, M12, M16, M18, M19). Các tính năng này chỉ có trong `domMax`, không có trong `domAnimation`.
  - Vì vậy nạp `domMax` **bất đồng bộ**: trang hiện ngay với `m`, rồi tính năng chuyển động tải sau lần vẽ đầu.

```ts
// lib/motion-features.ts
import { domMax } from "motion/react";
export default domMax;
```

```tsx
// app/providers.tsx
"use client";
import { LazyMotion, MotionConfig } from "motion/react";

const loadFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

export function MotionProviders({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
```

**Vào trang (M02).** Dùng `app/template.tsx`; file này mount lại mỗi lần điều hướng.
- Chỉ làm hiệu ứng vào, không làm hiệu ứng ra. Hiệu ứng ra trong App Router dễ gây lỗi khi layout bị gỡ.
- `experimental.viewTransition` của Next.js vẫn là tính năng thử nghiệm, không khuyến nghị cho production. Không dùng ở bản này.

```tsx
// app/template.tsx
"use client";
import * as m from "motion/react-m";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.05, 0.7, 0.1, 1] }}
    >
      {children}
    </m.div>
  );
}
```

**Vẽ tuyến trên Leaflet (M13, M14).**
- `Path.getElement()` trả về phần tử SVG của polyline (Leaflet 1.9.4).
- Bản đồ phải dùng renderer SVG, không đặt `preferCanvas: true`.
- Leaflet vẽ lại đường khi zoom xong, nên độ dài đo trước lúc bay bản đồ sẽ sai. Vì vậy gọi `flyToBounds` trước, rồi vẽ tuyến trong sự kiện `moveend`:

```ts
map.once("moveend", () => drawRoute(line, reduce, isFallback));
map.flyToBounds(bounds, { duration: 0.8, padding: [32, 32] });
```

```ts
export function drawRoute(line: L.Polyline, reduce: boolean, dashed: boolean) {
  const path = line.getElement() as SVGPathElement | undefined;
  if (!path || reduce) return;
  const length = path.getTotalLength();
  path.style.strokeDasharray = `${length}`;
  path.style.strokeDashoffset = `${length}`;
  path.getBoundingClientRect(); // ép trình duyệt tính lại trước khi chuyển động
  path.style.transition = "stroke-dashoffset 800ms cubic-bezier(0.05, 0.7, 0.1, 1)";
  path.style.strokeDashoffset = "0";
  path.addEventListener("transitionend", () => {
    path.style.transition = "";
    path.style.strokeDashoffset = "";
    path.style.strokeDasharray = dashed ? "6 6" : ""; // tuyến lùi khi OSRM lỗi giữ nét đứt
  }, { once: true });
}
```

**Bay bản đồ (M14).**
- Bình thường: như đoạn mã trên.
- Khi giảm chuyển động: `map.fitBounds(bounds, { animate: false })`, rồi hiện tuyến ngay, không vẽ dần.

**Số chạy (M07, M11, M17).**
- Dùng `animate(from, to, { duration, onUpdate })` để cập nhật một `<span aria-hidden>`.
- Đặt giá trị cuối vào một `<span class="sr-only" aria-live="polite">`, để trình đọc màn hình chỉ đọc một lần.

**Trình đọc chuyện (M22).** Chuyển động theo cuộn bằng CSS, chỉ bật khi trình duyệt hỗ trợ:

```css
@supports (animation-timeline: scroll()) {
  @media (prefers-reduced-motion: no-preference) {
    .read-progress {
      transform-origin: 0 50%;
      animation: grow linear both;
      animation-timeline: scroll(root);
    }
    @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  }
}
```

Tính đến giữa năm 2026, Chrome/Edge (từ 115) và Safari (từ 26) hỗ trợ tính năng này. Firefox bản ổn định chưa bật. Vì vậy M22 là tăng cường dần, không mang thông tin bắt buộc.

### 7.5 Ngân sách hiệu năng cho chuyển động

- Mỗi khung hình dưới 16 ms trên thiết bị Android tầm trung. Kiểm bằng Performance panel với CPU throttling 4×.
- `will-change` chỉ đặt trong lúc đang chuyển động, gỡ ngay sau đó.
- Không chạy quá 3 chuyển động lặp cùng lúc. Chuyển động lặp chỉ có ở M10, M24, M27.
- Chuyển động không được làm INP vượt 200 ms.

---

## 8. Đặc tả từng màn hình

Ký hiệu trong khung dây:
- `[ ]` là nút hoặc ô nhập;
- `( )` là lựa chọn;
- `●` là ga trên tuyến;
- `■0` là điểm xuất phát.

Các ký tự `✕ ⚠ ✓ ☀ ☂ ★ ⛍ ⚲ ⌕ ⌖ ⌾ ⇪ ⋯` trong khung dây chỉ đánh dấu chỗ đặt biểu tượng Phosphor tương ứng (§6.5). Không đưa các ký tự này vào giao diện thật.

### 8.1 Khung ứng dụng

- Thứ tự: liên kết “Bỏ qua tới nội dung chính” (ẩn, hiện khi focus), thanh trên cùng, `<main>`, thanh dưới.
- Phần tử cuộn của trang là tài liệu, nên `scroll-padding-top` và `scroll-padding-bottom` đặt trên `html`, bằng chiều cao hai thanh. Nhờ vậy phần tử đang focus không bị thanh dính che (WCAG 2.4.11). Vùng cuộn riêng (danh sách trong sheet, khung timeline trên desktop) đặt `scroll-padding` trên chính vùng đó.
- Vùng `aria-live="polite"` dùng chung cho toast nằm cuối `<body>`.

### 8.2 Trang chủ `/`

**Mục đích.** Bắt đầu lập lịch trong một chạm, và gợi lý do để đến (lễ hội, chuyện).

**Điện thoại**

```
┌──────────────────────────────────────┐
│ HanoiGO                       VI   ◯ │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │     ảnh Hồ Hoàn Kiếm 4:5         │ │
│ │ ╔══════════════════════════════╗ │ │
│ │ ║ Bạn có mấy ngày              ║ │ │  biển hiệu Phudu, nền trắng
│ │ ║ ở Hà Nội?                    ║ │ │
│ │ ╚══════════════════════════════╝ │ │
│ └──────────────────────────────────┘ │
│ Ảnh: [tác giả], [giấy phép]          │
│                                      │
│ (1) (2) [3] (4) (5+)  ngày           │
│ Ngân sách     [ 3.000.000        đ ] │
│ Số người      [−]  2  [+]            │
│ [        Lập lịch trình            ] │  nút đỏ
├──────────────────────────────────────┤
│ Chuyến đang đi (chỉ khi có)          │
│ Ngày 2 / 3, điểm tiếp theo 10:15     │
│ [ Mở lịch trình hôm nay ]            │
├──────────────────────────────────────┤
│ Sắp có lễ hội                        │
│ ┌────────────┐┌────────────┐┌──     │  cuộn ngang
│ │ [ngày]     ││ [ngày]     ││        │
│ │ [tên dịp]  ││ [tên dịp]  ││        │
│ └────────────┘└────────────┘└──     │
│ Xem lịch cả năm                      │
├──────────────────────────────────────┤
│ Chuyện kể                            │
│ ┌──────────────────────────────────┐ │
│ │ ảnh 3:2                          │ │
│ └──────────────────────────────────┘ │
│ Ảnh: [tác giả], [giấy phép]          │
│ [Tiêu đề chuyện nổi bật]             │
│ [Đoạn dẫn, 2 dòng]                   │
│ [6] phút đọc                         │
│ [Tiêu đề 2]               [5] phút   │
│ [Tiêu đề 3]               [4] phút   │
│ Xem tất cả chuyện                    │
├──────────────────────────────────────┤
│ Ghi công ảnh  Dữ liệu © OSM          │
├──────────────────────────────────────┤
│ Trang chủ  Chuyện kể  Lập lịch  Lễ hội  Chuyến đi │
└──────────────────────────────────────┘
```

**Desktop.** Hai cột.
- Trái (5/12): biển hiệu, ô nhập nhanh, nút đỏ.
- Phải (7/12): ảnh 3:4 và dòng ghi công.
- Bên dưới, hai cột: “Sắp có lễ hội” (4/12, danh sách dọc) và “Chuyện kể” (8/12, một chuyện lớn và hai chuyện nhỏ).

**Hành vi**
- Nút ngày “5+” mở ô số. Nút “Lập lịch trình” đi tới `/plan?step=1&days=&people=&budget=`.
- “Chuyến đang đi” chỉ hiện khi bản tóm tắt lưu cục bộ (§4.4) cho thấy một chuyến có ngày trùng hôm nay. Chuyến không có ngày bắt đầu thì không hiện. Chỉ chuyến đó mới được tải bằng `GET /trips/{id}` để biết điểm tiếp theo.
- Thời tiết: chỉ hiện khi `GET /weather` trả về dữ liệu dùng được cho hôm nay **[kiểm P0]**. Khi đó hiện một dòng nhỏ dưới ô nhập, gồm biểu tượng `Sun` hoặc `CloudRain` và đúng các trường API có. Không có dữ liệu thì không hiện gì.

**Chuyển động:** M03 (một lần mỗi phiên), M05, M04.

### 8.3 Lập lịch `/plan`

**Khung chung**

```
┌──────────────────────────────────────┐
│ ✕  Lập lịch trình          Bước 2/4  │
│ ━━━━━━━━━  ━━━━━━━━━  ─────  ─────   │  4 vạch: xong / đang làm / chưa
├──────────────────────────────────────┤
│              (nội dung bước)         │
├──────────────────────────────────────┤
│ [ Quay lại ]          [ Tiếp tục ]   │  thanh dính đáy, thay thanh điều hướng
└──────────────────────────────────────┘
```

- Nút `✕` quay lại trang trước. Giá trị đã nhập vẫn còn trong `sessionStorage`.
- “Tiếp tục” chỉ kiểm tra các trường của bước hiện tại, dùng lại Zod schema đang có.
- Có lỗi thì focus chuyển tới trường lỗi đầu tiên.

**Bước 1: Chuyến đi**

```
│ Chuyến đi                             │
│ Số ngày          [−]  3  [+]          │
│ Số người         [−]  2  [+]          │
│ Ngân sách cả chuyến                   │
│ [ 3.000.000                       đ ] │
│ Khoảng 500.000 đ mỗi người mỗi ngày   │  M07, tính trên trình duyệt
│ Ngày bắt đầu (không bắt buộc)         │
│ [ Chọn ngày                        ▦ ]│
│ Có ngày bắt đầu, HanoiGO báo các dịp  │
│ lễ và sự kiện rơi vào chuyến đi.      │
```

**Bước 2: Điểm xuất phát**

```
│ Bạn xuất phát từ đâu?                 │
│ [⌕ Khách sạn, địa chỉ, toạ độ        ]│
│ [  hoặc link Google Maps             ]│
│ ( ⌖ Vị trí hiện tại ) ( ⌾ Chọn trên bản đồ ) │
│ Điểm có sẵn                           │
│ ( Phố cổ )  ( [điểm có sẵn khác] )    │  danh sách hiện có trong code
```

- Địa chỉ chỉ được tra khi gửi form, không có gợi ý khi đang gõ (chính sách Nominatim, README).
- Nút “Tiếp tục” ở bước 2 chỉ kiểm tra ô không rỗng. Lỗi tra địa chỉ trả về ở lần gửi cuối thì đưa người dùng về bước 2, kèm:
  - `LOCATION_NOT_FOUND`: “Không tìm thấy địa chỉ này ở Hà Nội. Thử thêm tên phường, hoặc chọn trên bản đồ.”
  - `LOCATION_SERVICE_UNAVAILABLE`: “Dịch vụ tra địa chỉ đang không phản hồi. Bạn vẫn có thể chọn trên bản đồ hoặc dùng vị trí hiện tại.”
- “Vị trí hiện tại” chỉ xin quyền định vị khi người dùng chạm nút. Vị trí xác định qua dịch vụ định vị là dữ liệu cá nhân nhạy cảm theo Nghị định 356/2025/NĐ-CP. Vì vậy không ghi log và không lưu ngoài chuyến đi.

**Màn chọn trên bản đồ** (toàn màn hình, ẩn thanh điều hướng)

```
┌──────────────────────────────────────┐
│ ✕  Chọn điểm xuất phát               │
│                                      │
│              bản đồ                  │
│                 ▼                    │  ghim cố định giữa màn; kéo bản đồ bên dưới
│                                      │
├──────────────────────────────────────┤
│ Kéo bản đồ để đặt ghim               │
│ 21.0340, 105.8500                    │
│ [         Dùng điểm này            ] │
└──────────────────────────────────────┘
```

Không có API tra ngược toạ độ ra địa chỉ, nên chỉ hiện toạ độ. Không hiện tên đường đoán mò. Chuyển động M08.

**Bước 3: Đi lại**

```
│ Đi lại bằng gì?                       │
│ ( Đi bộ )   ( Xe máy )   ( Ô tô )     │  mỗi lựa chọn có biểu tượng Phosphor
│ Đi xa tới đâu?                        │
│ Tính từ điểm xuất phát                │
│ ( 5 km     Gần                   )    │
│ ( 15 km    Vừa                   )    │
│ ( 30 km    Xa                    )    │
│ ( 80 km    [nhãn hiện có]        )    │  chỉ khi form hiện tại có lựa chọn này
│ ⚠ Đi bộ chỉ tìm trong 10 km và tối đa │  chỉ hiện khi chọn đi bộ và trên 10 km
│   10 km mỗi ngày. Chọn xe máy hoặc ô tô│
│   để đi xa hơn.                       │
│ Giờ trong ngày, nhịp độ (nếu form có) │
```

- Nhãn phạm vi theo README (gần, vừa, xa) và không gắn tên khu vực. Bán kính tính từ bất kỳ điểm xuất phát nào, nên “nội thành” hay “ngoại thành” sẽ sai với nhiều điểm xuất phát.
- 80 km là giá trị API cũ. Nếu form hiện tại không cho chọn thì không thêm vào (F06).

Khi làm thật dùng `PersonSimpleWalk`, `Motorcycle`, `Car`, `Warning`. Không dùng emoji.

**Bước 4: Sở thích và gửi**

```
│ Bạn thích gì?                         │
│ [Ẩm thực✓] [Lịch sử✓] [Cà phê] [...]  │  danh sách sở thích hiện có
│ Thêm tuỳ chọn (mở ra)                 │  các trường nâng cao hiện có
│ ───────────────────────────────────── │
│ Tóm tắt                                │
│ 3 ngày, 2 người          Sửa           │
│ 3.000.000 đ              Sửa           │
│ Từ Phố cổ, xe máy, 15 km Sửa           │
│ [        Lập lịch trình            ]  │
```

### 8.4 Màn chờ

```
┌──────────────────────────────────────┐
│                                      │
│      ■━━━━●━━━━●━━━━●━━━━○           │  M10
│                                      │
│      Đang lập lịch trình             │
│      HanoiGO đang so giờ mở cửa      │  chú thích đổi lần lượt
│      với lịch của bạn                │
│                                      │
│      [ Huỷ ]                         │
└──────────────────────────────────────┘
```

- Chú thích mô tả những việc planner làm (giờ mở cửa, ngân sách, quãng đường, bữa ăn), không báo tiến độ.
- “Huỷ” huỷ yêu cầu bằng `AbortController` và quay về bước 4 **[client]**.
- Khi gặp `RATE_LIMITED`: “Bạn vừa lập nhiều lịch trình. Thử lại sau [42] giây.” Thời gian đếm ngược lấy từ `Retry-After`; nút gửi bị khoá đến hết giờ.
  - `Retry-After` không nằm trong danh sách header CORS mặc định. Frontend (cổng 3000) chỉ đọc được nó khi API (cổng 8000) gửi kèm `Access-Control-Expose-Headers: Retry-After`.
  - Phase 0 kiểm xem code hiện tại đọc được header này chưa.
  - Nếu không đọc được: hiện “Bạn vừa lập nhiều lịch trình. Thử lại sau ít phút.” và mở lại nút sau 60 giây.
  - Thêm header là một dòng cấu hình CORS ở backend. Việc này nằm ngoài phạm vi tài liệu; ghi ở §15.

### 8.5 So sánh phương án `/trips/[tripId]`

**Điện thoại**

```
┌──────────────────────────────────────┐
│ ←  3 phương án          Sửa yêu cầu  │
│ 3 ngày, 2 người, từ Phố cổ           │
├──────────────────────────────────────┤
│ Trong những ngày bạn đi              │  chỉ khi có ngày bắt đầu và có dữ liệu
│ ┌─────────────┐┌─────────────┐┌──   │  thẻ theo mùa và dịp lễ, chỉ chữ, cuộn ngang
│ │ [tên]       ││ [tên]       ││      │
│ │ [ngày]      ││ [ngày]      ││      │
│ └─────────────┘└─────────────┘└──   │
├──────────────────────────────────────┤
│ Phù hợp nhất                          │
│ ●─●─●─●─●        Ngày 1              │  tuyến thu nhỏ: một chấm = một điểm dừng
│ ●─●─●─●          Ngày 2              │
│ ●─●─●─●─●─●      Ngày 3              │
│ 2.850.000 đ                           │  money-l
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░  95% ngân sách   │
│ 27,4 km   3 giờ 45 phút   14 điểm     │
│ [        Xem lịch trình            ]  │
├──────────────────────────────────────┤
│ Tiết kiệm                  [Rẻ nhất]  │
│ ...                                   │
├──────────────────────────────────────┤
│ Đi được nhiều hơn       [Nhiều điểm nhất] │
│ ...                                   │
└──────────────────────────────────────┘
```

- Các số trong khung dây chỉ để minh hoạ bố cục. Khi chạy thật, mọi số lấy từ API hoặc tính từ dữ liệu API.
  - Chi phí, quãng đường, thời gian đi lại: các trường tổng của phương án.
  - Số điểm: đếm điểm dừng trong `days` **[client]**.
  - Tỉ lệ trên thanh: chi phí chia ngân sách **[client]**.
- Ba số quãng đường, thời gian đi lại và số điểm là ba phần tử riêng, có nhãn cho trình đọc màn hình. Không nối chúng bằng dấu chấm giữa.
- Nhãn “Rẻ nhất”, “Nhiều điểm nhất”, “Đi lại ít nhất” được tính trên trình duyệt từ ba phương án **[client]**. Hai phương án bằng nhau thì không gắn nhãn.
- Khi `budgetTargetMet = false`, hiện dải cảnh báo vàng ngay dưới thanh ngân sách: “Các điểm phù hợp quanh tuyến chưa dùng tới mức [95]% ngân sách mà phương án này nhắm tới.” Con số là `budgetTargetShare`. Kèm một gợi ý theo phương tiện:
  - Đi bộ (đã giới hạn 10 km): “Đổi sang xe máy hoặc ô tô để có thêm lựa chọn.”
  - Xe máy hoặc ô tô: “Thử mở rộng phạm vi hoặc thêm sở thích.”
- “Sửa yêu cầu” (F35) mở `/plan` ở bước 1, điền sẵn yêu cầu của chuyến này. Nguồn dữ liệu điền sẵn:
  - giá trị form còn trong `sessionStorage`;
  - hoặc dữ liệu yêu cầu mà `GET /trips/{id}` trả về, nếu có **[kiểm P0]**.
  Gửi lại sẽ tạo chuyến mới, như luồng E2E hiện có.
- Khối “Trong những ngày bạn đi” (F36) hiện các thẻ theo mùa và dịp lễ mà API trả về cho ngày đi. Mỗi thẻ có câu chuyện thì có liên kết “Đọc chuyện”.
- Tên phương án: giữ bản dịch hiện có. Nếu chưa có, đề xuất “Phù hợp nhất”, “Tiết kiệm”, “Đi được nhiều hơn” (EN giữ Best Match, Budget Friendly, Explore More).

**Desktop.** Ba cột cạnh nhau, các chỉ số thẳng hàng để so ngang. Nút “Xem lịch trình” ở cuối mỗi cột.

**Chuyển động:** M11, rồi M12 khi chọn.

### 8.6 Lịch trình `/trips/[tripId]/[option]`

**Header lịch trình** (gọn lại khi cuộn, M30)

```
│ ←  Phù hợp nhất               ⇪  ⋯   │  ⇪ = Chia sẻ; ⋯ = Tối ưu lại, Sửa yêu cầu, Đổi phương án
│ 18–20/10, 2 người                     │
│ 2.850.000 / 3.000.000 đ  ▓▓▓▓▓▓▓▓▓░   │
```

**Dải ngày và chế độ xem**

```
│ [Ngày 1    ] [Ngày 2    ] [Ngày 3    ]│
│ [CN 18/10 ☀] [T2 19/10  ] [T3 20/10  ]│  biểu tượng thời tiết chỉ ở ngày có dữ liệu
│ (Lịch trình)(Bản đồ)(Chi phí)(Lưu trú) │

Theo README, tín hiệu thời tiết hiện chỉ có cho chiều ngày đầu. Vì vậy thường chỉ ngày 1 có biểu tượng. Không hiện biểu tượng cho ngày không có dữ liệu.
```

**Tab Lịch trình (điện thoại)**

```
│ ┌ [Tên dịp lễ trong ngày] ───────────┐│  dải lễ (F13), nền vàng tường, chỉ khi có
│ │ [gợi ý ngắn]   Xem nơi tổ chức     ││  “Xem nơi tổ chức” chỉ khi API có địa điểm
│ └────────────────────────────────────┘│
│ [08:00] ■0  Điểm xuất phát            │
│         ┃   [Phố cổ]                  │
│         ┃   ⛍ [12] phút  [3,4] km  [25.000] đ │  chặng xe máy: thời gian, quãng, cước
│ [08:12] ●1  Văn Miếu – Quốc Tử Giám   │  giờ đến = giờ đi + thời gian chặng
│         ┃   [Phải ghé]                │
│         ┃   Di tích   [1 giờ 30 phút] │
│         ┃   [120.000] đ cả nhóm       │
│         ┃   Vé [30.000] đ mỗi người   │
│         ┃   ▸ Câu chuyện  [6] phút đọc│
│         ┃   ⛍ [10] phút  [1,2] km  [15.000] đ │
│ [09:52] ●2  [Tên điểm]                │  08:12 + 1 giờ 30 + 10 phút
│         ┃   ...                       │
│ ───────────────────────────────────── │
│ Tổng ngày 1               [ ] đ       │
│ Quãng đường, thời gian và cước là ước │
│ tính theo đường thẳng.                │
```

- **Đường dọc ┃** chính là tuyến của ngày: dày 4 px, màu ngày. Ga là vòng tròn 28 px trùng với marker trên bản đồ.
- **Cột giờ** dùng token `time`, căn phải, chữ số đều cột.
- **Mỗi điểm dừng luôn hiện:** giờ, số ga, tên, “Phải ghé” (nếu có), loại, thời lượng, chi phí cả nhóm, vé mỗi người (nếu có), liên kết câu chuyện (nếu có).
- **Chạm vào thẻ** mở sheet chi tiết (§8.7).
- **Mỗi chặng** hiện phương tiện của chuyến, thời gian, quãng đường và cước. Chuyến đi bộ không có cước.
- **Giờ.** Theo README, điểm sau bắt đầu ngay khi tới nơi; thời gian chờ được dồn vào điểm trước hoặc vào đầu ngày. Giờ hiển thị lấy nguyên từ API. Không tự cộng trừ.
- **Thời lượng dài hơn thường lệ:** hiện thêm dòng nhỏ “Ở lâu hơn để kịp giờ mở cửa của điểm sau”, chỉ khi dữ liệu cho biết điều này. Không suy đoán.
- **Nút “Tối ưu lại”** đặt cuối danh sách ngày và trong menu `⋯`.

**Tab Bản đồ (điện thoại)**

```
┌──────────────────────────────────────┐
│ (header gọn và dải ngày như trên)    │
├──────────────────────────────────────┤
│                                      │
│      ■0━━━●1━━━●2                    │
│                 ┗━━●3━━●4            │
│                                      │
│ [⚠ Đang nối các điểm bằng đường thẳng]│  chỉ khi OSRM lỗi
│ ┌───────────────────┐┌──────────────┐│
│ │ ●1  Văn Miếu      ││ ●2  [Tên]    ││  băng thẻ cuộn ngang, M20
│ │ [08:12] [1 giờ 30]││              ││
│ └───────────────────┘└──────────────┘│
├──────────────────────────────────────┤
│ thanh điều hướng                      │
└──────────────────────────────────────┘
```

**Tab Chi phí**

```
│ Đã dùng          2.850.000 đ          │
│ Ngân sách        3.000.000 đ          │
│ Còn lại            150.000 đ          │  màu rêu khi còn trong ngân sách
│ ▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒░░░░░                 │  thanh chồng ngang, M21
│ ■ Tham quan     [ ] đ                 │
│ ■ Ăn uống       [ ] đ                 │
│ ■ Di chuyển     [ ] đ                 │
│ ■ Khác          [ ] đ                 │
│ Theo ngày                              │
│ Ngày 1   [ ] đ                        │
│ Ngày 2   [ ] đ                        │
│ Giá, cước và quãng đường là ước tính.  │
```

- **Nguồn số liệu chia nhóm.** README chỉ nói mỗi điểm dừng có chi phí, mỗi chặng có cước và mỗi ngày có tổng.
  - Nếu API có sẵn bảng chia theo nhóm thì dùng bảng đó **[kiểm P0]**.
  - Nếu không, tính trên trình duyệt **[client]**: Tham quan là tổng chi phí điểm không phải bữa ăn; Ăn uống là tổng chi phí bữa ăn; Di chuyển là tổng cước các chặng; Khác là phần còn lại so với tổng của phương án.
  - Tổng các nhóm phải bằng tổng của phương án. Nếu lệch thì chỉ hiện tổng và theo ngày, không hiện bảng chia.
- Thanh chồng ngang, không dùng biểu đồ tròn.
- Mỗi đoạn có nhãn và giá trị bằng chữ bên dưới, nên màu không phải kênh thông tin duy nhất.
- Màu đoạn theo token `--cat-*` (§6.1).

**Tab Lưu trú.** Danh sách chữ.
- Mỗi mục chỉ hiện các trường API trả về: tên, khoảng cách, giá, câu chuyện (khi có). Kèm nút “Chỉ đường”.
- Không có ảnh, không có nút đặt phòng (đặt phòng nằm ngoài phạm vi).

**Desktop**

```
┌────────────────────────────────────────────────────────────────────────┐
│ HanoiGO   Chuyện kể  Lễ hội  Chuyến đi            [Lập lịch trình] VI ◯ │
├────────────────────────────────────────────────────────────────────────┤
│ ←  Phù hợp nhất   18–20/10, 2 người   2.850.000 / 3.000.000 đ ▓▓▓▓▓░    │
│                                        [Tối ưu lại]  [Chia sẻ]          │
├─────────────────────────────┬──────────────────────────────────────────┤
│ [Ngày 1][Ngày 2][Ngày 3]    │                                          │
│ (Lịch trình)(Chi phí)(Lưu trú)│                                          │
│ 08:00 ■0 Điểm xuất phát      │            bản đồ (dính)                 │
│       ┃                      │                                          │
│ 08:30 ●1 Văn Miếu            │                                          │
│       ┃  (mở rộng tại chỗ)   │                                          │
│ ...                          │                                          │
└─────────────────────────────┴──────────────────────────────────────────┘
          5/12                                  7/12
```

**Chế độ chỉ xem** (mở bằng share token): ẩn Thay địa điểm, Tối ưu lại, Chia sẻ và Sửa yêu cầu. Thêm dải trên cùng: “Bạn đang xem lịch trình được chia sẻ.” kèm nút “Lập chuyến của bạn”.
- Nút mở `/plan`.
- Chỉ điền sẵn số ngày, số người, ngân sách và điểm xuất phát khi `GET /trips/{id}` trả về các trường đó **[kiểm P0]**.

### 8.7 Sheet trong lịch trình

**Chi tiết điểm dừng**

```
│ ━━━                                   │  tay kéo
│ ●1  Văn Miếu – Quốc Tử Giám  [Phải ghé]│
│ Di tích, Đống Đa                      │
│ 08:30 đến 10:00                        │
│ Chi phí cả nhóm          120.000 đ    │
│ Vé mỗi người              30.000 đ    │
│ ★ [4,6]   [128] đánh giá              │
│ Vì sao có trong lịch trình            │  recommendation reasons, nếu API có
│ • [lý do]                              │
│ ┌ Câu chuyện ─────────────────────────┐│
│ │ [Tiêu đề]                           ││
│ │ [Đoạn dẫn]                          ││
│ │ [6] phút đọc            [Đọc chuyện]││
│ └─────────────────────────────────────┘│
│ [ Chỉ đường ]     [ Thay địa điểm ]   │
│ Xem trang địa điểm và đánh giá        │
```

**Thay địa điểm**
- Danh sách lý do hiện có, dạng hàng radio 56 px.
- Nút “Thay địa điểm” gửi yêu cầu, nút chuyển sang trạng thái đang tải.
- Thành công: sheet đóng, M17 chạy, rồi toast “Đã thay [A] bằng [B]. Chi phí ngày [tăng/giảm] [x] đ.” Chênh lệch tính trên trình duyệt.
- Lỗi: báo trong sheet và giữ sheet mở.

**Tối ưu lại**
- Danh sách chiến lược hiện có. Mỗi chiến lược có một dòng giải thích, ví dụ “Giảm chi phí: đổi sang điểm rẻ hơn cùng loại”.
- Thành công: M18 chạy, rồi toast tóm tắt thay đổi. Nếu không có gì thay đổi: “Lịch trình đã tối ưu theo cách này, không đổi gì thêm.”

**Chia sẻ**

API không có cách đọc lại liên kết hiện tại; mỗi lần gọi `POST …/share` tạo liên kết mới và vô hiệu hoá liên kết cũ. Vì vậy sheet có hai trạng thái.

**Chưa có liên kết lưu trên máy này**

```
│ Chia sẻ lịch trình                    │
│ Người có liên kết chỉ xem, không sửa được.│
│ Nếu trước đây bạn đã chia sẻ, liên kết │
│ cũ sẽ không mở được nữa.               │
│ [      Tạo liên kết chia sẻ        ]   │
```

**Đã có liên kết lưu trên máy này** **[client]**

```
│ Chia sẻ lịch trình                    │
│ [ https://…/trips/…?share=…  ] [Sao chép]│  M26
│ Người có liên kết chỉ xem, không sửa được.│
│ Tạo liên kết mới                       │
```

- Liên kết vừa tạo được lưu trong `localStorage`, cạnh owner token, để lần sau hiện lại mà không phải xoay token.
- Chạm “Tạo liên kết mới” mở hộp xác nhận: “Liên kết cũ sẽ không mở được nữa.”, với hai nút “Tạo liên kết mới” và “Huỷ”.
- Phase 0 kiểm xem code hiện tại đã lưu liên kết chưa, và giữ cách đó nếu có.

### 8.8 Địa điểm `/places/[placeId]`

- Mở từ lịch trình thì hiện dạng sheet. URL trực tiếp thì hiện trang đầy đủ.
- **Thứ tự nội dung:**
  1. tên, loại, khu vực, “Phải ghé”;
  2. điểm đánh giá trung bình và số lượt;
  3. hàng nút “Chỉ đường” (và “Lập lịch từ đây” nếu luồng hiện có);
  4. giờ mở cửa và vé, kèm ghi chú “Giá và giờ có thể là ước tính; kiểm tra lại trước khi đi”. README cho biết nhiều giá và giờ là ước tính, và API không có cờ phân biệt, nên ghi chú này luôn hiện;
  5. thẻ câu chuyện;
  6. đánh giá theo thứ tự API trả về, và nút “Viết đánh giá”.
- **Viết đánh giá khi chưa đăng nhập:** mở hộp thoại đăng nhập tại chỗ. Đăng nhập xong thì quay về form đánh giá, không mất nội dung đã gõ.
- **Form đánh giá:** chọn 1–5 sao bằng nhóm radio có thể dùng bàn phím, ô bình luận, nút “Gửi đánh giá”. Thành công: toast “Đã gửi đánh giá”, và điểm trung bình chạy tới giá trị mới.

### 8.9 Chuyện kể `/stories` và trình đọc `/stories/[slug]`

**Danh sách**

```
│ Chuyện kể                             │  display Phudu
│ ┌──────────────────────────────────┐  │
│ │ ảnh 3:2 (chuyện nổi bật)         │  │
│ └──────────────────────────────────┘  │
│ Ảnh: [tác giả], [giấy phép]           │
│ [Tiêu đề]                              │
│ [Đoạn dẫn]                              │
│ [6] phút đọc                           │
│ ─────────────────────────────────────  │
│ [ảnh 1:1] [Tiêu đề 2]       [5] phút   │  chuyện nổi bật khác
│ [Tiêu đề 3]                 [4] phút   │  chuyện không có ảnh: chỉ chữ
│ Ghi công ảnh                           │  liên kết tới /credits cho ảnh thu nhỏ
```

Desktop: lưới không đều. Một chuyện nổi bật chiếm 8/12; bên phải hai chuyện xếp dọc. Bên dưới là danh sách chữ hai cột.

**Trình đọc**

```
│ ←                                VI   │  thanh trên; thanh dưới ẩn khi cuộn xuống
│ ▔▔▔▔▔▔▔▔▔▔                            │  tiến độ đọc, M22
│ ┌──────────────────────────────────┐  │
│ │ ảnh 4:5                          │  │
│ └──────────────────────────────────┘  │
│ Ảnh: [tác giả], [giấy phép]           │
│ ╔══════════════════════════════════╗  │
│ ║ [Tên danh thắng]                 ║  │  biển hiệu
│ ╚══════════════════════════════════╝  │
│ [6] phút đọc                          │
│ [Đoạn dẫn]                             │
│ Trong bài (mở ra)                      │  mục lục các phần
│ [Phần 1 …]                             │  body-read, tối đa 68 ký tự mỗi dòng
│ Dòng thời gian                          │
│ [năm] ● [sự kiện]                      │
│ [năm] ● [sự kiện]                      │
│ Mẹo tham quan                           │
│ • [mẹo]                                 │
│ Nguồn                                   │
│ 1. [tên nguồn] (liên kết)               │
│ ┌ [Tên danh thắng] ─────────────────┐   │
│ │ [ Chỉ đường ]  [ Lập lịch từ đây ] │   │
│ └────────────────────────────────────┘   │
│ Chuyện khác trong 2 km                  │
│ [thẻ] [thẻ]                             │
```

- Desktop: cột chữ 68 ký tự ở bên trái. Cột phải là thanh dính gồm thẻ danh thắng (chỉ đường, lập lịch từ đây) và mục lục.
- README nói truyền thuyết được trình bày là truyền thuyết. Điều này nằm trong chính lời văn của chuyện (ví dụ “tương truyền”), không phải một trường dữ liệu riêng. Giao diện giữ nguyên lời văn và không tự gắn nhãn. Nếu Phase 0 thấy dữ liệu có trường đánh dấu thì mới hiện nhãn theo trường đó.
- “Chỉ đường” và “Lập lịch từ đây” giữ cách tạo link và tham số hiện có. “Lập lịch từ đây” mở `/plan` ở bước 2, với danh thắng làm điểm xuất phát.

### 8.10 Lễ hội `/festivals`

```
│ ╔══════════════════════════════════╗ │
│ ║ Lịch lễ hội Hà Nội               ║ │  biển hiệu nền vàng tường
│ ╚══════════════════════════════════╝ │
│ (Sắp tới) (Cả năm)                     │
│ Tháng 10                               │  tiêu đề tháng dính khi cuộn
│ ┌──────────────────────────────────┐   │
│ │ ● Đang diễn ra                   │   │  M24, chỉ khi trùng hôm nay
│ │ [18/10 đến 20/10]                │   │
│ │ [ngày âm lịch nếu có]            │   │
│ │ [Tên dịp]                        │   │
│ │ [Gợi ý ngắn]                     │   │
│ │ [ Lập lịch vào dịp này ]         │   │
│ └──────────────────────────────────┘   │
```

- Dữ liệu từ `GET /holidays?start=[hôm nay]&days=365&language=`.
- Nếu API trả về địa điểm tổ chức thì hiện liên kết tới trang địa điểm. Cần kiểm hợp đồng API ở Phase 0.
- Ghi chú cuối trang (README): “Ngày của các dịp lặp hằng năm là gợi ý để lập kế hoạch. Hãy kiểm tra lịch chính thức trước khi đi.”

### 8.11 Chuyến đi `/trips`

```
│ Chuyến đi                             │
│ ⓘ Chuyến chỉ lưu trên trình duyệt này. │
│ Hôm nay                                │
│ ┌──────────────────────────────────┐  │
│ │ Ngày 2 / 3       Phù hợp nhất    │  │
│ │ Tiếp theo 10:15  ●2 [Tên điểm]   │  │
│ │ [ Mở lịch trình hôm nay ]        │  │
│ └──────────────────────────────────┘  │
│ Sắp tới                                │
│ [ngày] [số ngày], [số người]           │
│ Đã qua                                 │
│ [ngày] [số ngày], [số người]           │
│ Chưa chọn ngày                          │
│ [lập lúc …]                             │
```

- Nhóm Hôm nay, Sắp tới, Đã qua, Chưa chọn ngày được xếp theo bản tóm tắt lưu cục bộ (§4.4). Thời điểm lập chuyến cũng lấy từ bản tóm tắt **[client]**, vì API không có trường này.
- Chuyến lập trước khi có bản tóm tắt chỉ có token. Khi mở `/trips` lần đầu, tải các chuyến này bằng `GET /trips/{id}` một lần để tạo bản tóm tắt.
- Chỉ chuyến “Hôm nay” cần tải đầy đủ để hiện điểm tiếp theo.
- Token hết hiệu lực hoặc chuyến không còn: “Không mở được chuyến này nữa.” kèm nút “Xoá khỏi máy này” **[client]**.
- Trạng thái rỗng: “Chưa có chuyến nào trên máy này.” và nút “Lập lịch trình”.
- README ghi không có liên kết chuyến với tài khoản. Đăng nhập không làm chuyến hiện trên máy khác; giao diện phải nói rõ điều này.

### 8.12 Tài khoản `/account` và ghi công `/credits`

- **Chưa đăng nhập:** hai tab Đăng nhập và Đăng ký. Đăng nhập gồm ô “Email hoặc số điện thoại” và ô mật khẩu. Đăng ký giữ đúng các trường form hiện có, kể cả tên tài khoản dùng khi đăng đánh giá **[kiểm P0]**. Lỗi hiện ngay dưới ô.
- **Đã đăng nhập:** tên tài khoản (hiện cạnh đánh giá) và nút “Đăng xuất”. Không có API đăng xuất, nên “Đăng xuất” là xoá phiên đăng nhập trên trình duyệt **[client]**; giữ cách code hiện tại đang làm.
- Đăng nhập chỉ dùng cho đánh giá. Chuyến đi không gắn với tài khoản (README). Ghi rõ dưới nút đăng nhập: “Tài khoản dùng để viết đánh giá. Chuyến đi vẫn chỉ lưu trên trình duyệt này.”
- **Cài đặt:** ngôn ngữ (Tiếng Việt / English), giao diện (Theo máy / Sáng / Tối, P1).
- **Liên kết:** Ghi công ảnh và dữ liệu; Quyền riêng tư.
- **`/credits`:** bảng ảnh lấy từ `hanoi-images.ts` (ảnh thu nhỏ, tác giả, giấy phép, liên kết gốc), và dòng “Dữ liệu bản đồ © OpenStreetMap contributors, ODbL”.

### 8.13 Trạng thái tải, rỗng, lỗi

| Tình huống | Hiển thị | Hành động |
|---|---|---|
| Đang tải trang | Khung chờ đúng hình nội dung (M27) | — |
| `NO_FEASIBLE_ITINERARY` | “Chưa xếp được lịch trình nào khớp mọi điều kiện.” Kèm danh sách gợi ý trong `details`, hiển thị như văn bản | Nút “Sửa yêu cầu” mở `/plan` bước 1. Chỉ khi `details` có khoá máy đọc được (ví dụ tên trường) **[kiểm P0]** thì mỗi gợi ý mới thành nút dẫn thẳng tới đúng bước |
| `LOCATION_NOT_FOUND`, `LOCATION_SERVICE_UNAVAILABLE` | Báo ngay dưới ô địa chỉ (§8.3) | Chọn trên bản đồ; vị trí hiện tại; điểm có sẵn |
| `RATE_LIMITED` | Đếm ngược theo `Retry-After` nếu đọc được; nếu không, “Thử lại sau ít phút” (§8.4) | Nút gửi mở lại khi hết giờ, hoặc sau 60 giây |
| OSRM lỗi | Tuyến nét đứt và nhãn cảnh báo | — |
| Không có thời tiết | Không hiện gì | — |
| Không có ảnh chuyện | Thẻ chỉ có chữ | — |
| Liên kết chia sẻ hết hạn | “Liên kết này không còn mở được. Người chia sẻ có thể đã tạo liên kết mới.” | “Lập lịch trình” |
| Mất kết nối | Toast “Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.” | “Thử lại” |
| Lỗi máy chủ (503) | “HanoiGO đang tạm gián đoạn. Thử lại sau ít phút.” | “Thử lại” |

---

## 9. Thư viện thành phần

Mỗi thành phần có các trạng thái: mặc định, rê chuột (chỉ khi thiết bị có chuột), `focus-visible`, nhấn, vô hiệu, đang tải, lỗi, đang chọn.

| Nhóm | Thành phần |
|---|---|
| Khung | `AppShell`, `TopBar`, `BottomNav`, `DesktopNav`, `SkipLink`, `ToastRegion` |
| Chữ ký | `Signboard`, `RouteLine` (đường tuyến), `Station` (ga) |
| Điều khiển | `Button` (primary, secondary, text, danger), `IconButton`, `Chip`, `Segmented`, `DayTabs`, `Stepper`, `MoneyInput`, `DateInput`, `TextField`, `RadioRow`, `StarRating` |
| Lớp phủ | `Sheet` (dựa trên `<dialog>` hoặc primitive dialog tiếp cận được, kèm Motion), `Dialog`, `Toast`, `Menu` |
| Lịch trình | `TripHeader`, `StopCard`, `LegRow`, `DayTotal`, `HolidayBand`, `BudgetMeter`, `BudgetBreakdown`, `OptionPanel`, `MiniRoute`, `StayRow` |
| Bản đồ | `MapView` (import động, `ssr: false`), `StartMarker`, `StationMarker`, `MapCardRail`, `FallbackRouteNotice`, `PinPicker` |
| Nội dung | `StoryCard` (lead, compact, text), `StoryReader` (các phần, dòng thời gian, mẹo, nguồn, `LandmarkCard`), `FestivalItem`, `TripRow`, `RatingSummary`, `ReviewItem`, `ReviewForm`, `PhotoCredit` |
| Trạng thái | `Skeleton`, `EmptyState`, `ErrorState`, `RateLimitCountdown` |

**Quy tắc chung**
- Nút chính cao 48 px; nút phụ cao 44 px; vùng chạm tối thiểu 44 × 44 px.
- Viền focus: `outline: 3px solid var(--focus); outline-offset: 2px`. Không bỏ outline.
- Trạng thái đang tải của nút: giữ nguyên chiều rộng, thay chữ bằng biểu tượng xoay nhỏ, đặt `aria-busy="true"`.

---

## 10. Chữ trong giao diện

**Giọng.** Ngắn, cụ thể, chủ động. Dùng chữ hoa đầu câu. Không xin lỗi, không chen chữ thừa. Lỗi nói rõ chuyện gì xảy ra và cách sửa.

**Từ khoá nhất quán.** Một hành động giữ một tên trong toàn luồng.

| Hành động | Nút (VI) | Kết quả (VI) | Nút (EN) |
|---|---|---|---|
| Tạo lịch trình | Lập lịch trình | Đang lập lịch trình | Plan my trip |
| Thay một điểm | Thay địa điểm | Đã thay [A] bằng [B] | Replace place |
| Tối ưu | Tối ưu lại | Đã tối ưu lại lịch trình | Re-optimize |
| Chia sẻ | Sao chép / Tạo liên kết mới | Đã sao chép liên kết | Copy / Create new link |
| Chỉ đường | Chỉ đường | (mở Google Maps) | Directions |
| Đọc chuyện | Đọc chuyện | — | Read the story |
| Đánh giá | Gửi đánh giá | Đã gửi đánh giá | Post review |
| Lập lịch từ chuyện | Lập lịch từ đây | — | Plan from here |
| Lập lịch theo dịp lễ | Lập lịch vào dịp này | — | Plan for these dates |

**Viết như thế này và tránh như thế kia**

| Tránh | Dùng |
|---|---|
| Khám phá hành trình tuyệt vời của bạn | Bạn có mấy ngày ở Hà Nội? |
| Đã xảy ra lỗi. Vui lòng thử lại. | Không tìm thấy địa chỉ này ở Hà Nội. Thử thêm tên phường, hoặc chọn trên bản đồ. |
| Submit | Lập lịch trình |
| Xem thêm → | Xem tất cả chuyện |
| AI đang tạo lịch trình thông minh cho bạn | Đang lập lịch trình |

Giữ mọi chuỗi trong từ điển i18n hiện có. Chuỗi mới thêm cả hai ngôn ngữ cùng lúc.

---

## 11. Tiếp cận (accessibility)

Mục tiêu: WCAG 2.2 mức AA.

- **Tương phản:** chữ ≥ 4,5:1; chữ lớn và thành phần không phải chữ ≥ 3:1. Đã kiểm ở §6.1.
- **Vùng chạm:** WCAG 2.5.8 yêu cầu tối thiểu 24 × 24 CSS px (mức AA). HanoiGO dùng 44 × 44 px cho mọi điều khiển.
- **Focus không bị che (2.4.11):** đặt `scroll-padding` theo chiều cao thanh trên và thanh dưới. Sheet là modal và giữ focus bên trong.
- **Chuyển động:** mọi chuyển động có phương án `prefers-reduced-motion` (§7.3). Không có gì nhấp nháy quá 3 lần mỗi giây.
- **Bản đồ:** timeline chứa đủ thông tin của bản đồ. Marker nhận focus và có `aria-label` gồm số thứ tự, tên, “phải ghé”, “có câu chuyện”.
- **Màu:** không có thông tin nào chỉ truyền bằng màu. Tuyến có số ngày; đoạn ngân sách có nhãn chữ; “phải ghé” có chữ.
- **Form:** mỗi ô có `<label>`; lỗi nối với ô bằng `aria-describedby`; chọn sao dùng nhóm radio.
- **Ngôn ngữ:** `<html lang>` đổi theo VI/EN. Tên riêng tiếng Việt trong trang EN có `lang="vi"`.
- **Kiểm tra:** axe-core qua `@axe-core/playwright` trên mọi route chính, cùng một lượt kiểm thủ công bằng bàn phím và VoiceOver hoặc TalkBack.

---

## 12. Hiệu năng

**Mục tiêu.** Mức “tốt” của Core Web Vitals, đo ở phân vị 75: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.

- **Leaflet** chỉ tải ở trang có bản đồ, qua `next/dynamic` với `ssr: false`. Khung bản đồ có kích thước cố định trước khi tải, để không gây CLS.
- **Ảnh** dùng `next/image` với `sizes` đúng. Ảnh hero trang chủ có `priority`; các ảnh khác tải lười.
- **Phông** dùng `next/font`, chỉ nạp bộ `latin` và `vietnamese` với các độ đậm thực dùng: Phudu 700 và 800; Archivo biến thiên.
- **Motion** dùng `LazyMotion` với `m`, và nạp `domMax` bất đồng bộ (§7.4). Phần tải ban đầu khoảng 5 kB; khoảng 38 kB tính năng tải sau lần vẽ đầu.
- **Dữ liệu** dùng TanStack Query. Trang chủ có thể gộp `stories` và `holidays` ở Server Component để giảm thác yêu cầu.
- **Chuyển động** chỉ dùng `transform` và `opacity` (§7.1).
- **Ngân sách JavaScript.** Đo kích thước bundle ở Phase 0 làm mốc. Mỗi route sau thiết kế lại không được nặng hơn mốc quá 15%, trừ khi ghi lý do.

---

## 13. Lộ trình triển khai

| Phase | Nội dung | Điều kiện xong |
|---|---|---|
| **P0 Kiểm kê** | Liệt kê route, component, trường form, `data-testid`, chuỗi i18n, khoá `localStorage`, danh sách lý do thay địa điểm và chiến lược tối ưu. Giải quyết mọi mục **[kiểm P0]** bằng cách đọc schema response thật: `/holidays`, `/weather`, `/trips/{id}`, chia nhóm chi phí, lưu trú, `details` của lỗi, `budgetTargetShare`, `Retry-After`. Chụp ảnh màn hình làm mốc. Đo bundle và Web Vitals | Có `docs/ui-inventory.md` trả lời từng mục **[kiểm P0]**; mọi quality gate trong README xanh |
| **P1 Nền tảng** | Token (§6.9), phông, biểu tượng, `MotionProviders`, các thành phần nền (§9). Trang `/dev/ui` chỉ có ở môi trường dev | Kiểm thử tương phản tự động; lint và typecheck xanh |
| **P2 Khung và điều hướng** | `AppShell`, hai thanh điều hướng, route mới, `template.tsx`, chuyển hướng URL cũ | E2E điều hướng qua 5 điểm đến; liên kết chia sẻ cũ vẫn mở được |
| **P3 Lập lịch** | Bốn bước, chọn trên bản đồ, màn chờ, so sánh phương án | E2E luồng mặc định 3 ngày, 2 người, 3 triệu; E2E địa chỉ tự nhập; E2E chọn ghim khi tra địa chỉ lỗi |
| **P4 Lịch trình** | Bốn tab, đồng bộ timeline và bản đồ, các sheet thay, tối ưu, chia sẻ, chế độ chỉ xem, “Sửa yêu cầu” | E2E thay địa điểm, giảm chi phí, chia sẻ; E2E lập lại sau khi sửa ngân sách và sở thích; đủ F09–F22, F35, F36 |
| **P5 Nội dung** | Chuyện kể, trình đọc, lễ hội, địa điểm và đánh giá, chuyến đi, tài khoản, ghi công | Đủ F23–F32 |
| **P6 Hoàn thiện** | Chuyển động theo §7.3, giao diện tối, kiểm tiếp cận, kiểm hiệu năng | axe 0 lỗi nghiêm trọng; Web Vitals đạt §12; toàn bộ E2E xanh, kể cả khi giảm chuyển động |

Mỗi phase kết thúc với đủ các lệnh kiểm tra trong README: `ruff`, `pytest`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e`.

---

## 14. Kiểm thử

- **E2E hiện có** phải xanh sau thiết kế lại. Theo README, gồm ba luồng:
  1. thay địa điểm, giảm chi phí, chia sẻ;
  2. địa chỉ tự nhập, xe máy, ngân sách 10 triệu, rồi lập lại sau khi đổi ngân sách và sở thích;
  3. chọn ghim trên bản đồ khi tra địa chỉ lỗi.
  - Ưu tiên chọn phần tử theo role và tên tiếp cận được (`getByRole`) thay cho class CSS.
  - Giữ các `data-testid` đang dùng.
- **E2E mới:**
  - điều hướng qua 5 điểm đến;
  - Back và Forward khôi phục đúng ngày và chế độ xem;
  - liên kết chia sẻ cũ được chuyển hướng;
  - đọc chuyện rồi “Lập lịch từ đây”;
  - lễ hội rồi “Lập lịch vào dịp này”;
  - viết đánh giá khi chưa đăng nhập.
- **Chạy toàn bộ E2E thêm một lần** với `page.emulateMedia({ reducedMotion: 'reduce' })`.
- **Ảnh chụp so sánh** bằng `toHaveScreenshot` cho 8 màn chính, ở 390 px và 1280 px, cả sáng và tối.
- **Kiểm thử thành phần:** `BudgetMeter` (tỉ lệ, cảnh báo), `MoneyInput` (định dạng VI/EN), `RouteLine` (số ga khớp dữ liệu), `drawRoute` (không chạy khi giảm chuyển động).
- **Kiểm tra tương phản tự động:** một test đọc token và kiểm từng cặp trong §6.1.

---

## 15. Giả định, rủi ro, câu hỏi mở

**Giả định**
- Frontend hiện dùng Next.js 15 App Router, Tailwind CSS, TanStack Query và Leaflet (README).
- Form có thêm các trường của spec gốc (nhịp độ, giờ trong ngày…). Phase 0 xác nhận.

**Rủi ro**

| Rủi ro | Giảm thiểu |
|---|---|
| Đổi cấu trúc trang làm hỏng E2E | Chọn phần tử theo role, giữ `data-testid`, làm theo phase |
| Liên kết chia sẻ đã gửi bị hỏng | Chuyển hướng 308 và kiểm thử riêng (P2) |
| Chuyển động làm chậm máy yếu | Ngân sách §7.5; `LazyMotion`; tắt chuyển động lặp khi tab ẩn |
| Phudu khó đọc ở cỡ nhỏ | Chỉ dùng Phudu từ 39 px trở lên |
| Motion 14 vừa ra mắt (bản 14.3.0 ra một ngày trước khi soạn tài liệu) | Chọn bản đã phát hành ít nhất 2 tuần; khoá phiên bản; đọc changelog; dùng dòng 13.5.x nếu gặp lỗi |
| Giao diện hứa dữ liệu mà API không có | Mọi mục **[kiểm P0]** phải được trả lời trước P3; thiếu dữ liệu thì ẩn phần giao diện đó |
| Ô nền OSM công cộng có giới hạn sử dụng | Chưa đổi trong bản này; cần nhà cung cấp ô nền riêng khi ra mắt rộng |

**Câu hỏi mở**
1. Giữ giá trị phạm vi 80 km trên giao diện hay chỉ để tương thích API?
2. `GET /holidays` có trả về địa điểm tổ chức không?
3. Giao diện tối làm ở bản này hay để sau?
4. Tên tiếng Việt cho ba phương án đã có trong i18n chưa?
5. Có cần tên do người dùng đặt cho chuyến đi không? Hiện API không có trường này, nên danh sách chuyến đặt tên theo ngày.
6. README vừa có API đăng ký và đăng nhập, vừa ghi “không có tài khoản người dùng” ở phần hạn chế (ý nói không có tài khoản gắn với chuyến đi). Nên sửa câu trong README cho khỏi hiểu nhầm.
7. Có muốn thêm `Access-Control-Expose-Headers: Retry-After` ở backend để giao diện đếm ngược chính xác không? Đây là thay đổi cấu hình CORS, nằm ngoài phạm vi frontend.
8. `GET /weather` có trả dữ liệu theo từng ngày hay chỉ chiều ngày đầu? Câu trả lời quyết định dải ngày có biểu tượng thời tiết cho mọi ngày hay không.

---

## 16. Nguồn tham khảo

**Cảm hứng chữ và biển hiệu**
- RMIT Vietnam (2019). *Hanoi’s heritage hand-painted typography honoured in RMIT exhibition.* https://www.rmit.edu.vn/news/all-news/2019/mar/hanoi-s-heritage-hand-painted-typography-honoured-in-rmit-exhibi
- RMIT Vietnam Library. *Typography in Vietnam* (lưu trữ ảnh biển hiệu Hà Nội). https://typographyvn.rmit.edu.vn/s/hanoi-typography
- Google Fonts. *Phudu*, Dương Trần. https://fonts.google.com/specimen/Phudu/about
- Mã nguồn Phudu. https://github.com/duongtrtype/DTPhudu
- Mã nguồn Archivo, Omnibus-Type. https://github.com/Omnibus-Type/Archivo

**Chuyển động và điều hướng**
- Material Components for Android, *Motion* (đường cong và token thời lượng M3). https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md
- Android Developers, *Navigation bar* (Compose, Material 3). https://developer.android.com/develop/ui/compose/components/navigation-bar
- Motion, *LazyMotion*. https://motion.dev/docs/react-lazy-motion
- Motion, *Reduce bundle size* (dung lượng `m`, `domAnimation`, `domMax`). https://motion.dev/docs/react-reduce-bundle-size
- MDN, *CORS-safelisted response header*. https://developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_response_header
- Creative Commons, *Attribution 4.0 International – Legal Code*, điều 3(a)(2). https://creativecommons.org/licenses/by/4.0/legalcode.en
- Next.js, *viewTransition* (thử nghiệm). https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition
- *CSS scroll-driven animations go cross-browser* (tình trạng hỗ trợ trình duyệt 2026). https://www.buildmvpfast.com/blog/css-scroll-driven-animations-replace-js-2026

**Tiếp cận, hiệu năng, quyền riêng tư**
- W3C, *Understanding SC 2.5.8 Target Size (Minimum)*. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C, *Understanding SC 2.4.11 Focus Not Obscured (Minimum)*. https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- web.dev, *Web Vitals*. https://web.dev/articles/vitals
- Nghị định 356/2025/NĐ-CP hướng dẫn Luật Bảo vệ dữ liệu cá nhân. https://thuvienphapluat.vn/van-ban/Quyen-dan-su/Nghi-dinh-356-2025-ND-CP-huong-dan-Luat-Bao-ve-du-lieu-ca-nhan-687428.aspx

**Đã kiểm trực tiếp từ gói npm (16/10/2026)**
- `@fontsource/phudu` 5.3.0 và `@fontsource-variable/archivo` 5.3.0: bộ ký tự, trục biến thiên, `tnum`, giấy phép OFL.
- `@phosphor-icons/react` 2.1.10: tên biểu tượng, export `/ssr`, giấy phép MIT.
- `motion` 14.3.0, `framer-motion` 14.3.0, `motion-dom` 14.3.0: các API ở §7.4.
- `leaflet` 1.9.4: `Path.getElement()`, `flyToBounds()`, tuỳ chọn `keyboard` của Marker.
