# Trái tim AR / VR trên web

Bản web của project Unity *human_heart_vr*: dùng webcam nhận diện ảnh marker,
trái tim 3D trồi lên từ tờ giấy, có 12 bộ phận kèm nhãn tên và chế độ kính VR
(kiểu Cardboard). Chạy bằng three.js 0.160 + MindAR 1.2.5 (tải từ CDN).

## Chạy thử

- Windows: nháy đúp `start.bat` (cần Python 3), trình duyệt tự mở
  http://localhost:8000/ — bấm **Cho phép** khi được hỏi quyền camera.
- Cách khác: chạy `python -m http.server 8000` trong thư mục này rồi mở
  http://localhost:8000/. Không mở thẳng file `index.html` (trình duyệt chặn webcam).

In ảnh `assets/Markers/heart_marker2.jpg` (rộng 19,6 cm, khổ A4) hoặc mở ảnh trên
điện thoại, rồi giơ vào trước webcam.

## Các trang

| Trang | Nội dung |
|---|---|
| `index.html` | AR qua webcam: tim trồi lên, kéo để xoay, cuộn/chụm để zoom, chạm chấm màu để xem tên. Nút **Kính VR**: chia đôi màn hình, nhìn 1,5 giây hoặc chạm để chọn |
| `viewer.html` | Xem mô hình 3D không cần webcam |
| `test.html` | Chỉ thử nhận diện marker |

## Cấu trúc

- `main.js` — toàn bộ logic AR/VR (port từ các script C# của bản Unity)
- `heart-data.js` — vị trí đặt tim và 12 hotspot trên marker
- `assets/Models/heart.glb`, `assets/Markers/heart_marker2.jpg`

## Giấy phép mô hình

[Human Heart 3D Model](https://sketchfab.com/3d-models/human-heart-3d-model-anatomy-medical-project-5da08bb137014f0392c69f9997f777cd)
của Mesh-Magnet, giấy phép CC BY 4.0.
