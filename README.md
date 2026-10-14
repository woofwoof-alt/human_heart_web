# Trái tim AR / VR trên web

Bản web của project Unity *human_heart_vr*. Webcam nhận diện ảnh marker, trái tim 3D
trồi lên từ tờ giấy, có 12 bộ phận kèm nhãn tên và chế độ kính VR kiểu Cardboard.
Dùng three.js 0.160 và MindAR 1.2.5, tải từ CDN.

---

## 1. Chuẩn bị

### Phần cứng
| Thứ cần có | Ghi chú |
|---|---|
| Máy tính có **webcam** | Webcam trong laptop hoặc webcam rời đều được |
| **Ảnh marker** | In file [`assets/Markers/heart_marker2.jpg`](assets/Markers/heart_marker2.jpg) ra giấy A4 (ảnh rộng khoảng 19,6 cm), hoặc mở ảnh trên điện thoại hay máy tính bảng để giơ trước webcam |
| Kính VR Cardboard *(không bắt buộc)* | Chỉ cần nếu muốn dùng chế độ **Kính VR** trên điện thoại |

### Phần mềm
| Thứ cần có | Cách kiểm tra / cài |
|---|---|
| **Trình duyệt** Chrome, Edge hoặc Firefox bản mới | |
| **Python 3** (để chạy web server nhỏ ở máy) | Mở Command Prompt, gõ `python --version`. Nếu chưa có thì tải ở https://www.python.org/downloads/ và khi cài nhớ tick **"Add python.exe to PATH"** |
| **Kết nối internet** | Trang tải three.js và MindAR từ CDN mỗi lần mở |
| Git *(không bắt buộc)* | Chỉ cần nếu muốn tải code bằng `git clone` |

### Tải code về máy
Repo này để **riêng tư**, nên bạn phải đăng nhập GitHub bằng tài khoản đã được cấp quyền.

**Cách A: tải file ZIP (không cần Git)**
1. Trên trang repo, bấm nút xanh **Code** → **Download ZIP**.
2. Giải nén ra một thư mục, ví dụ `D:\human_heart_web`.

**Cách B: dùng Git**
```
git clone https://github.com/woofwoof-alt/human_heart_web.git
cd human_heart_web
```
Lần đầu Git sẽ mở trình duyệt để bạn đăng nhập GitHub.

---

## 2. Chạy project

### Windows: nháy đúp `start.bat`
1. Mở thư mục code vừa tải về.
2. Nháy đúp **`start.bat`**. Một cửa sổ đen hiện ra và trình duyệt tự mở http://localhost:8000/
3. Giữ cửa sổ đen mở trong lúc dùng. Đóng cửa sổ là tắt server.

### macOS / Linux, hoặc chạy bằng tay
Mở terminal **trong thư mục code**, rồi chạy:
```
python -m http.server 8000
```
(trên macOS/Linux có thể phải gõ `python3`). Sau đó mở trình duyệt vào http://localhost:8000/

> ⚠️ Đừng nháy đúp thẳng vào `index.html` (đường dẫn `file:///...`). Trình duyệt chỉ cho
> dùng webcam khi trang mở qua `http://localhost` hoặc `https`.

---

## 3. Sử dụng

1. Bấm **Cho phép** khi trình duyệt hỏi quyền dùng camera.
2. Lần đầu mở, trang mất vài giây để "Đang chuẩn bị marker". Các lần sau sẽ nhanh hơn.
3. Khi thấy dòng *"Đưa tờ giấy in marker vào trước webcam"*, hãy giơ ảnh marker vào giữa
   khung hình. Tim sẽ trồi lên trong khoảng 4 giây.
4. Thao tác:

| Thao tác | Chuột | Cảm ứng |
|---|---|---|
| Xoay tim quanh mặt giấy | Kéo ngang | Kéo ngang một ngón |
| Lật tim tới/lui | Kéo dọc | Kéo dọc một ngón |
| Phóng to / thu nhỏ | Cuộn chuột | Chụm hoặc mở hai ngón |
| Xem tên bộ phận | Bấm vào chấm màu | Chạm vào chấm màu |
| Về góc nhìn ban đầu | Nút **Đặt lại góc nhìn** | |

5. **Chế độ Kính VR** (dùng trên điện thoại với kính Cardboard): bấm nút **Kính VR**.
   Màn hình chia đôi và xoay ngang. Nhìn vào một chấm màu khoảng 1,5 giây (vòng tròn ở tâm
   ngắm sẽ đầy dần) hoặc chạm màn hình để chọn. Bấm **✕ Thoát kính VR** hoặc phím Esc để thoát.
6. Muốn xem mô hình mà không cần webcam: mở http://localhost:8000/viewer.html (hoặc bấm
   link **Xem 3D** trên trang chính).

### Các trang
| Trang | Nội dung |
|---|---|
| `index.html` | AR qua webcam và chế độ kính VR |
| `viewer.html` | Xem mô hình 3D, không cần webcam |
| `test.html` | Chỉ thử nhận diện marker |

---

## 4. Gặp lỗi?

| Hiện tượng | Cách xử lý |
|---|---|
| Báo *"Trình duyệt chỉ cho dùng webcam khi mở trang qua http://localhost"* | Bạn đang mở file trực tiếp. Hãy chạy `start.bat` rồi mở http://localhost:8000/ |
| `start.bat` báo *"Khong tim thay Python 3"* | Cài Python 3 và tick **Add python.exe to PATH**, rồi chạy lại |
| Báo *"Không mở được webcam"* | Bấm biểu tượng camera trên thanh địa chỉ và chọn Cho phép. Đóng Zoom, Teams, Camera... nếu đang dùng webcam, rồi tải lại trang |
| Báo *"Không tải được mô hình hoặc ảnh marker"* | Kiểm tra thư mục `assets/` còn đủ file và server đang chạy trong đúng thư mục code |
| Trang đứng ở *"Đang khởi động..."* | Kiểm tra kết nối internet (cần tải thư viện từ CDN) |
| Không thấy tim hiện lên | Giơ marker gần hơn, đủ sáng, không bị lóa. Toàn bộ ảnh phải nằm trong khung hình |
| Tim rung hoặc trễ | Giữ marker yên hơn và tăng ánh sáng |
| Vẫn thấy giao diện cũ sau khi cập nhật code | Bấm **Ctrl+F5** để tải lại không dùng bộ nhớ đệm |
| Cổng 8000 đang bị dùng | Chạy `python -m http.server 8080` rồi mở http://localhost:8080/ |

Mở trang với `?debug` (ví dụ http://localhost:8000/?debug) rồi bấm F12 để xem trạng thái
trong biến `window.heartApp`.

---

## Cấu trúc thư mục

```
├── index.html          trang AR chính
├── main.js             logic AR/VR (port từ các script C# của bản Unity)
├── heart-data.js       vị trí đặt tim và 12 hotspot trên marker
├── viewer.html         xem 3D không cần webcam
├── test.html           thử nhận diện marker
├── start.bat           chạy server và mở trình duyệt (Windows)
└── assets/
    ├── Models/heart.glb
    └── Markers/heart_marker2.jpg
```

## Giấy phép mô hình

[Human Heart 3D Model](https://sketchfab.com/3d-models/human-heart-3d-model-anatomy-medical-project-5da08bb137014f0392c69f9997f777cd)
của Mesh-Magnet, giấy phép CC BY 4.0.
