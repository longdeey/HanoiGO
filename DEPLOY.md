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

## Lưu ý về gói miễn phí

- Dịch vụ miễn phí "ngủ" sau 15 phút không có người vào; lần mở đầu tiên sau đó mất khoảng 30–60 giây.
- Cơ sở dữ liệu miễn phí của Render hết hạn sau 30 ngày; nâng lên gói trả phí (hoặc tạo lại) để giữ dữ liệu chuyến đi.
- Tra địa chỉ dùng máy chủ Nominatim công cộng và bản đồ OpenStreetMap France; khi có nhiều người dùng nên chuyển sang nhà cung cấp riêng (xem README, mục giới hạn).
- Ảnh trong `frontend/public/images/stories` lấy từ báo chí (thư mục "CÂU CHUYỆN HÀ NỘI") chưa có giấy phép mở; xin phép các nguồn hoặc thay ảnh trước khi công khai rộng rãi.
