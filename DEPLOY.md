# Deploy HanoiGO lên Vercel (miễn phí)

| Phần | Vercel project | Địa chỉ |
|---|---|---|
| Website Next.js (`frontend/`) | `hanoigo` | https://hanoigo.vercel.app |
| API FastAPI (`backend/`, hàm Python serverless) | `hanoigo-api` | https://hanoigo-api.vercel.app |
| PostgreSQL + PostGIS | Neon `hanoigo-db` (gói Free, Singapore) | gắn vào `hanoigo-api` qua `DATABASE_URL` |

Cả website, API và cơ sở dữ liệu đều đặt ở Singapore (`sin1`), gần Việt Nam. Gói Hobby của Vercel và gói Free của Neon không mất phí, chỉ dành cho dự án cá nhân, phi thương mại.

## Deploy lại sau khi sửa code

Cần Vercel CLI đã đăng nhập (`npx vercel login`).

```bash
cd backend  && npx vercel deploy --prod --yes   # API
cd frontend && npx vercel deploy --prod --yes   # website
```

Nếu đã nối GitHub (xem cuối trang), chỉ cần `git push` lên `main`.

## Dữ liệu địa điểm

API trên Vercel không tự chạy migration hay nạp địa điểm. Mỗi khi đổi `migrations/`, `data/curated_places.json` hoặc `data/place_curation.json`, chạy từ máy mình:

```bash
cd backend
npx vercel env pull .env.local          # lấy DATABASE_URL_UNPOOLED của Neon
# đặt DATABASE_URL bằng DATABASE_URL_UNPOOLED trong .env.local, rồi:
python -m alembic upgrade head
python -m app.infrastructure.db.seed
python -m app.infrastructure.db.osm_import
```

(Lần đầu cần bật PostGIS: `CREATE EXTENSION IF NOT EXISTS postgis;`.)

## Biến môi trường

- `hanoigo-api`: `DATABASE_URL` (Neon tự thêm), `CORS_ORIGINS=https://hanoigo.vercel.app` (thêm tên miền khác, cách nhau bằng dấu phẩy), `APP_ENV=production`, `GENERATE_RATE_LIMIT_PER_MINUTE`, `ROUTE_API_URL`, `GEOCODING_API_URL`, `GEOCODING_USER_AGENT`.
- `hanoigo`: `NEXT_PUBLIC_API_URL=https://hanoigo-api.vercel.app` và `NEXT_PUBLIC_MAP_TILE_URL` (gắn vào lúc build, đổi xong phải deploy lại website).

Đổi bằng `npx vercel env add <TÊN> production` trong thư mục tương ứng, hoặc trên vercel.com → project → Settings → Environment Variables.

## Tự deploy khi push (tùy chọn)

1. vercel.com → Account Settings → **Authentication** → **Connect** GitHub (tài khoản `longdeey`).
2. Mỗi project → Settings → **Git** → Connect Git Repository → `longdeey/HanoiGO`, rồi Settings → Build and Deployment → **Root Directory**: `backend` cho `hanoigo-api`, `frontend` cho `hanoigo`.

Sau đó deploy bằng `git push`; không chạy `vercel deploy` từ trong `backend/` hay `frontend/` nữa (Root Directory đã trỏ vào đó).

## Lưu ý

- Lần gọi API đầu tiên sau một lúc không ai dùng chậm thêm 1–3 giây (hàm serverless khởi động); các lần sau nhanh.
- Neon Free: 0,5 GB dữ liệu, tự tạm nghỉ khi không dùng và thức dậy trong khoảng nửa giây.
- Tra địa chỉ dùng máy chủ Nominatim công cộng và bản đồ OpenStreetMap France; khi có nhiều người dùng nên chuyển sang nhà cung cấp riêng (xem README, mục giới hạn).
- Ảnh trong `frontend/public/images/stories` lấy từ báo chí (thư mục "CÂU CHUYỆN HÀ NỘI") chưa có giấy phép mở; xin phép các nguồn hoặc thay ảnh trước khi công khai rộng rãi.
