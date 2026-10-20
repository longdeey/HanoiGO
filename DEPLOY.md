# Deploy HanoiGO lên Render

`render.yaml` mô tả cả ba phần: cơ sở dữ liệu PostgreSQL (`hanoigo-db`), API FastAPI (`hanoigo-api`) và website Next.js (`hanoigo-web`), đều ở gói miễn phí.

## 1. Đưa code lên GitHub

```bash
git push -u origin main
```

## 2. Tạo dịch vụ trên Render

1. Đăng nhập https://render.com bằng tài khoản GitHub.
2. **New → Blueprint**, chọn kho `HanoiGO`, bấm **Apply**.
3. Render hỏi hai giá trị (để trống lúc này cũng được, điền ở bước 3):
   - `CORS_ORIGINS` (của `hanoigo-api`)
   - `NEXT_PUBLIC_API_URL` (của `hanoigo-web`)
4. Chờ build xong. Lần đầu API tự tạo bảng, bật PostGIS và nạp các địa điểm (khoảng 2–4 phút).

## 3. Nối website với API

Sau lần deploy đầu, mỗi dịch vụ có một địa chỉ dạng `https://<tên>.onrender.com`.

1. `hanoigo-api` → **Environment** → `CORS_ORIGINS` = địa chỉ của website, ví dụ `https://hanoigo-web.onrender.com`. Lưu (API tự khởi động lại).
2. `hanoigo-web` → **Environment** → `NEXT_PUBLIC_API_URL` = địa chỉ của API, ví dụ `https://hanoigo-api.onrender.com`. Lưu, rồi **Manual Deploy → Deploy latest commit** (giá trị này được gắn vào lúc build).
3. Kiểm tra: mở `https://<api>.onrender.com/api/v1/ready` (trả về 200) rồi mở địa chỉ website.

Mỗi lần push lên `main`, Render tự deploy lại.

## Chạy thật: Singapore, không ngủ, tên miền riêng

`render-singapore.yaml` tạo bộ dịch vụ thứ hai ở Singapore, gói trả phí (khoảng 20 USD/tháng): `hanoigo-db-sg` (Basic 256 MB), `hanoigo-api-sg` và `hanoigo-web-sg` (Starter). Bộ miễn phí cũ vẫn chạy cho tới khi bạn xoá nó, nên không có lúc nào web bị tắt. Vùng của một dịch vụ Render không đổi được, vì vậy cần tạo dịch vụ mới thay vì sửa dịch vụ cũ.

### 1. Mua tên miền

Rẻ nhất về lâu dài là `.com` ở Cloudflare Registrar (giá gốc, khoảng 10,5 USD/năm, gia hạn cùng giá, có sẵn DNS). Ví dụ `hanoi-go.com` (còn trống ngày 20/10/2026). Các đuôi rẻ năm đầu như `.xyz` có giá gia hạn cao hơn.

Cloudflare → **Domain Registration → Register Domains**, tìm tên, thanh toán.

### 2. Tạo dịch vụ ở Singapore

1. Render → **New → Blueprint** → kho `HanoiGO` → **Blueprint path**: `render-singapore.yaml` → **Apply** (Render yêu cầu thẻ thanh toán).
2. Để trống `CORS_ORIGINS` và `NEXT_PUBLIC_API_URL` lúc này. Chờ build xong (API tự tạo bảng và nạp địa điểm).

### 3. Gắn tên miền

Ví dụ với `hanoi-go.com`: website ở `hanoi-go.com` (và `www`), API ở `api.hanoi-go.com`.

1. Render → `hanoigo-web-sg` → **Settings → Custom Domains → Add**: `hanoi-go.com` (Render thêm luôn `www.hanoi-go.com`). Render → `hanoigo-api-sg` → **Add**: `api.hanoi-go.com`.
2. Cloudflare → tên miền → **DNS → Records**, thêm (Proxy status: **DNS only**, mây xám):

   | Type | Name | Target |
   |---|---|---|
   | CNAME | `@` | `hanoigo-web-sg.onrender.com` |
   | CNAME | `www` | `hanoigo-web-sg.onrender.com` |
   | CNAME | `api` | `hanoigo-api-sg.onrender.com` |

   Xoá các bản ghi AAAA nếu có. Quay lại Render, bấm **Verify**; chứng chỉ HTTPS được cấp tự động sau vài phút.
3. `hanoigo-api-sg` → **Environment** → `CORS_ORIGINS` = `https://hanoi-go.com,https://www.hanoi-go.com,https://hanoigo-web-sg.onrender.com`.
4. `hanoigo-web-sg` → **Environment** → `NEXT_PUBLIC_API_URL` = `https://api.hanoi-go.com` → **Manual Deploy → Deploy latest commit**.
5. Kiểm tra `https://api.hanoi-go.com/api/v1/ready` (200) rồi `https://hanoi-go.com`.

### 4. Chuyển tài khoản và chuyến đi đã lưu

Tài khoản và chuyến đi đã lưu nằm trong cơ sở dữ liệu cũ, và chuyến đi trỏ tới địa điểm theo mã riêng của từng cơ sở dữ liệu, nên chép **toàn bộ** cơ sở dữ liệu cũ sang rồi để API nạp lại địa điểm lên trên (nạp theo slug, giữ nguyên mã cũ). Lấy **External Database URL** của `hanoigo-db` (cũ) và `hanoigo-db-sg` (mới) trong Render → **Connect**, rồi chạy (cần Docker, dùng sẵn container Postgres 16 của dự án):

```bash
docker exec hanoigo-postgres-1 sh -c 'pg_dump --no-owner --no-privileges --clean --if-exists "OLD_URL" | psql "NEW_URL"'
```

(thay `OLD_URL`, `NEW_URL` bằng hai địa chỉ trên), sau đó `hanoigo-api-sg` → **Manual Deploy → Restart service** để chạy lại migration và nạp địa điểm mới nhất.

### 5. Tắt bộ miễn phí

Khi tên miền mới chạy ổn: Render → `hanoigo-web`, `hanoigo-api`, `hanoigo-db` → **Settings → Delete**. Sau đó có thể xoá `render.yaml` và đổi tên `render-singapore.yaml` thành `render.yaml`.

## Lưu ý về gói miễn phí

- Dịch vụ miễn phí "ngủ" sau 15 phút không có người vào; lần mở đầu tiên sau đó mất khoảng 30–60 giây.
- Cơ sở dữ liệu miễn phí của Render hết hạn sau 30 ngày; nâng lên gói trả phí (hoặc tạo lại) để giữ dữ liệu chuyến đi.
- Tra địa chỉ dùng máy chủ Nominatim công cộng và bản đồ OpenStreetMap France; khi có nhiều người dùng nên chuyển sang nhà cung cấp riêng (xem README, mục giới hạn).
- Ảnh trong `frontend/public/images/stories` lấy từ báo chí (thư mục "CÂU CHUYỆN HÀ NỘI") chưa có giấy phép mở; xin phép các nguồn hoặc thay ảnh trước khi công khai rộng rãi.
