# KHO MŨ TBS — Hướng dẫn cài đặt & vận hành

Hệ thống quản lý kho mũ BTP theo mô hình tinh gọn:
- **Giao diện & Camera (`docs/index.html`):** Chạy trên **GitHub Pages** (HTTPS chuẩn nên camera điện thoại hoạt động trực tiếp).
- **Máy chủ API (`apps-script/Code.gs`):** Google Apps Script.
- **Cơ sở dữ liệu:** Google Sheets (`Shelves, Items, Stock, Logs, Users`).

Quy mô kho hiện tại: **24 kệ (K01–K24) × 3 tầng × 4 ô = 288 ô vị trí**.
- Dãy A: `K01` – `K12` · Dãy B: `K13` – `K24`.
- Mã QR ô chuẩn: `KE:K01-T1-O2` (`T1` là tầng đáy, `T3` là tầng trên cùng, `O1`–`O4` từ trái sang phải).

---

## Phần 1 — Cài đặt từng thành phần (làm lần đầu ~5 phút)

### Bước 1: Tạo Google Sheet & Apps Script
1. Mở Google Drive → tạo Google Sheet mới, đặt tên **Kho Mũ TBS**.
2. Vào **Tiện ích mở rộng → Apps Script**.
3. Xoá hết code mẫu trong `Code.gs`, dán toàn bộ nội dung file `apps-script/Code.gs` vào rồi nhấn **Lưu**.
4. Chọn hàm `setup` ở thanh trên → nhấn **Chạy** → cấp quyền truy cập bảng tính.
   *(Nếu quên bước này, backend vẫn tự khởi tạo ngay ở lần đầu web kết nối, hoặc bạn có thể mở menu **Kho Mũ TBS** ngay trên thanh công cụ Google Sheet).*
5. Nhấn **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**:
   - **Thực thi với tư cách:** Tôi
   - **Người có quyền truy cập:** Bất kỳ ai
6. Nhấn **Triển khai**, copy đường link Web App có dạng:
   `https://script.google.com/macros/s/...../exec`

> **Lưu ý khi nâng cấp code Apps Script về sau:** Vào **Triển khai → Quản lý triển khai → biểu tượng cây bút (Chỉnh sửa) → Phiên bản: Phiên bản mới → Triển khai** để giữ nguyên đường link `/exec`.

### Bước 2: Đưa giao diện & Camera lên GitHub Pages
1. Tạo một repository trên GitHub (ví dụ `kho-mu-tbs`), tải thư mục `docs/` (gồm `index.html` và `.nojekyll`) lên nhánh `main`.
2. Vào GitHub repo → **Settings → Pages**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` · Thư mục: **`/docs`** → nhấn **Save**.
3. Đợi ~1 phút, mở đường link trang web `https://<tên-github>.github.io/kho-mu-tbs/`.

### Bước 3: Kết nối & Kiểm tra bằng Setup Doctor
1. Mở trang web GitHub Pages → nhấn **Cài đặt kết nối Sheet**.
2. Dán link `/exec` đã copy ở Bước 1 → nhấn **Kiểm tra kết nối** → nhấn **Lưu & kết nối**.
3. Đăng nhập tài khoản mặc định: **`admin` / `123456`**.
4. Vào tab **Cài đặt**, xem bảng **Setup Doctor** bảo đảm cả 4 mục đều xanh:
   - Môi trường GitHub Pages (HTTPS)
   - Camera & Thiết bị quét
   - Apps Script & Google Sheet (24 kệ)
   - Đồng bộ & Lưu cục bộ
5. Vào **Cài đặt → Quản lý tài khoản** để tạo tài khoản công nhân và **đổi mật khẩu `admin`**.
6. *(Tuỳ chọn)* Bấm **Nạp dữ liệu mẫu** trong Cài đặt để test sơ đồ 24 kệ, sau đó bấm **Xoá dữ liệu tồn & log** trước khi chạy thật.

### Bước 4: In nhãn QR dán tại kho
Vào **Cài đặt → In nhãn QR vị trí** → chọn từ kệ `1` đến `24` → **In nhãn**.
Mỗi kệ in ra 1 trang A4 gồm 1 nhãn đầu kệ lớn (`KE:K01`) và 12 nhãn ô (`KE:K01-T1-O1` … `KE:K01-T3-O4`).

---

## Phần 2 — Hướng dẫn thao tác nhanh cho công nhân

- **Nhập kho (3 bước):** Nhấn **NHẬP KHO** → quét mã **Ô kệ** → quét **mã mũ** → nhập số lượng → **LƯU NHẬP KHO**.
  Sau khi lưu, hệ thống **giữ nguyên ô hiện tại** để quét tiếp các mã mũ khác vào cùng ô mà không phải quét lại ô.
- **Xuất kho (3 bước):** Nhấn **XUẤT KHO** → quét mã **Ô kệ** → chạm chọn mã mũ đang có trong ô → nhập số lượng → **LƯU XUẤT KHO**.
  Hệ thống tự động chặn không cho xuất vượt số lượng tồn trong ô.
- **Kiểm kê ô:** Nhấn **KIỂM KÊ Ô** → quét ô → sửa số lượng thực tế (hoặc quét từng mã mũ để cộng +1) → **LƯU KIỂM KÊ Ô**.
- **Tìm mũ & Sơ đồ 24 kệ:** Nhấn **Tra cứu** → gõ hoặc quét mã mũ → bấm vào kết quả để **ô chứa hàng nhấp nháy đỏ-vàng** ngay trên sơ đồ 24 kệ. Chạm vào ô trên sơ đồ có thể bấm **+ Nhập ô / − Xuất ô / Kiểm kê** trực tiếp.
- **Súng bắn mã vạch (USB / Bluetooth):** Đứng ở màn hình thao tác hoặc tra cứu, chỉ cần bóp cò là tự nhận mã, không cần chạm màn hình. Có thể tắt "Tự mở camera" trong Cài đặt nếu dùng chuyên súng quét.

---

## Phần 3 — Xử lý sự cố thường gặp

| Tình huống | Nguyên nhân & Cách xử lý |
|---|---|
| **Không mở được Camera trực tiếp** | 1. Đang mở file `index.html` trực tiếp trên máy (`file://`) thay vì link `https://...github.io/...` → hãy truy cập qua GitHub Pages.<br>2. Trình duyệt bị từ chối quyền Camera → bấm biểu tượng ổ khoá cạnh thanh địa chỉ → **Camera → Cho phép**.<br>3. Hoặc bấm ngay nút **Chụp ảnh mã** ngay dưới khung camera để chụp ảnh tem và đọc mã 100%. |
| **Báo "Không kết nối được máy chủ"** | Kiểm tra lại link `/exec` và chắc chắn trong Apps Script đã chọn **Người có quyền truy cập: Bất kỳ ai**. |
| **Mất WiFi / 4G giữa ca làm việc** | Công nhân vẫn quét nhập/xuất bình thường. Các phiếu được lưu an toàn trong hàng đợi trên máy (góc trên bên phải hiện `Mất mạng · N chờ`). Khi có mạng lại, hệ thống tự đẩy lên Sheet và chống ghi trùng bằng `clientId`. |
| **Quá lâu không bấm bị văng đăng nhập** | Phiên đăng nhập kéo dài **12 giờ** (trọn ca làm việc). Nếu hết hạn, các thao tác chờ gửi vẫn được giữ nguyên trên máy và tự đồng bộ ngay sau khi đăng nhập lại. |
