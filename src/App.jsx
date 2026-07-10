import React, { useRef, useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
  useNavigate,
  Link,
  Navigate,
} from "react-router-dom";
import axios from "axios";
import Hls from "hls.js"; // 🛡️ Import Lõi giải mã HLS "hàng xịn"

// ==========================================
// COMPONENT CAO CẤP: ĐẦU ĐĨA LÕI HLS + ĐỒ HỌA CANVAS (TRIỆT TIÊU 100% NÚT IDM)
// ==========================================
function HlsVideoPlayer({
  src,
  videoRef,
  maxWatched,
  setMaxWatched,
  onEnded,
  userPhone,
}) {
  const canvasRef = useRef(null);
  const [watermarkPos, setWatermarkPos] = useState({ top: "10%", left: "10%" });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Thuật toán cho số điện thoại bay nhảy ngẫu nhiên mỗi 4 giây
  useEffect(() => {
    const interval = setInterval(() => {
      const randomTop = Math.floor(Math.random() * 60) + 10;
      const randomLeft = Math.floor(Math.random() * 60) + 10;
      setWatermarkPos({ top: `${randomTop}%`, left: `${randomLeft}%` });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Bộ giải mã lõi HLS chạy ẩn trong bộ nhớ
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [src, videoRef]);

  // 🛡️ LUỒNG ĐỒ HỌA: Vẽ từng khung hình video ẩn lên thẻ Canvas công khai
  useEffect(() => {
    let animationFrameId;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");

    const renderLoop = () => {
      if (video && video.videoWidth > 0 && !video.paused && !video.ended) {
        // Tự động bo khít kích thước canvas theo độ phân giải video gốc
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        // Sao chép khung hình hiện tại của video sang canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [videoRef]);

  // Bộ điều khiển Play/Pause thủ công trên thực thể video ẩn
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Thuật toán chống tua video + Cập nhật thời gian thực
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;

    if (current === undefined || isNaN(current)) return;

    if (current > maxWatched + 2) {
      videoRef.current.currentTime = maxWatched;
    } else {
      setMaxWatched(Math.max(maxWatched, current));
      setCurrentTime(current);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "00:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: "10px",
        overflow: "hidden",
        background: "#000",
        boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
      }}
    >
      {/* 1. ẨN HOÀN TOÀN THẺ VIDEO - IDM HOÀN TOÀN BỊ "MÙ" KHÔNG TÌM THẤY TỌA ĐỘ */}
      <video
        ref={videoRef}
        disablePictureInPicture
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          onEnded();
        }}
        style={{
          display: "none",
        }} /* Khóa chặt luồng nhận diện của extension */
      />

      {/* 2. THẺ CANVAS HIỂN THỊ CÔNG KHAI - KHÔNG TRÌNH DUYỆT NÀO NHẬN DIỆN ĐƯỢC ĐÂY LÀ VIDEO */}
      <canvas
        ref={canvasRef}
        onClick={handlePlayPause}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: "100%",
          display: "block",
          cursor: "pointer",
        }}
      />

      {/* 3. THANH ĐIỀU KHIỂN TỰ CHẾ (CUSTOM CONTROLS) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          background: "rgba(0, 0, 0, 0.75)",
          padding: "10px 15px",
          display: "flex",
          alignItems: "center",
          gap: "15px",
          zIndex: 20,
          boxSizing: "border-box",
        }}
      >
        <button
          onClick={handlePlayPause}
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            fontSize: "18px",
            fontWeight: "bold",
            padding: 0,
            lineHeight: 1,
          }}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <span
          style={{ color: "#fff", fontSize: "14px", fontFamily: "monospace" }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* 👇 CHỮ NGUYỄN TRÍ DŨNG Ở ĐÂY NÈ 👇 */}
        <span
          style={{
            marginLeft: "auto",
            color: "rgba(255,255,255,0.3)",
            fontSize: "12px",
            fontStyle: "italic",
          }}
        >
          🛡️ Nguyễn Trí Dũng - 408
        </span>
      </div>

      {/* 4. LỚP WATERMARK SỐ ĐIỆN THOẠI */}
      <div
        style={{
          position: "absolute",
          top: watermarkPos.top,
          left: watermarkPos.left,
          color: "rgba(255, 255, 255, 0.4)",
          fontSize: "16px",
          fontWeight: "bold",
          letterSpacing: "2px",
          pointerEvents: "none",
          userSelect: "none",
          transition: "all 1.5s ease-in-out",
          textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
          zIndex: 30,
        }}
      >
        {userPhone}
      </div>
    </div>
  );
}

// ==========================================
// TRANG 1: ĐĂNG NHẬP & ĐĂNG KÝ
// ==========================================
function LoginPage({ onLoginSuccess }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Test ở localhost
    const apiUrl = isLoginMode
      ? "http://localhost:3000/api/login"
      : "http://localhost:3000/api/register";

    try {
      const res = await axios.post(apiUrl, { phone, password });
      const userData = res.data.data;
      localStorage.setItem("lms_user", JSON.stringify(userData));
      onLoginSuccess(userData);
    } catch (err) {
      setError(err.response?.data?.error || "Không thể kết nối đến máy chủ!");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        maxWidth: "400px",
        margin: "100px auto",
        fontFamily: "sans-serif",
        padding: "30px",
        background: "#fff",
        borderRadius: "10px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "10px", color: "#333" }}>
        {isLoginMode ? "Đăng Nhập Hệ Thống" : "Đăng Ký Tài Khoản"}
      </h2>
      <p
        style={{
          textAlign: "center",
          color: "#666",
          fontSize: "14px",
          marginBottom: "20px",
        }}
      >
        {isLoginMode
          ? "Chào mừng bạn quay trở lại!"
          : "Nhập số điện thoại và tạo mật khẩu mới."}
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        <input
          type="text"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Số điện thoại..."
          style={{
            padding: "12px",
            borderRadius: "5px",
            border: "1px solid #ccc",
            fontSize: "16px",
          }}
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu..."
          style={{
            padding: "12px",
            borderRadius: "5px",
            border: "1px solid #ccc",
            fontSize: "16px",
          }}
        />
        {error && (
          <p
            style={{
              color: "#dc3545",
              margin: 0,
              fontSize: "14px",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px",
            background: isLoginMode ? "#007bff" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          {loading
            ? "Đang xử lý..."
            : isLoginMode
              ? "Vào Học Ngay"
              : "Tạo Tài Khoản"}
        </button>
      </form>

      <div style={{ marginTop: "20px", textAlign: "center", fontSize: "14px" }}>
        {isLoginMode ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
        <span
          onClick={() => {
            setIsLoginMode(!isLoginMode);
            setError("");
            setPassword("");
          }}
          style={{
            color: "#007bff",
            cursor: "pointer",
            fontWeight: "bold",
            textDecoration: "underline",
          }}
        >
          {isLoginMode ? "Đăng ký ngay" : "Đăng nhập"}
        </span>
      </div>
    </div>
  );
}

// ==========================================
// ==========================================
// TRANG 2: TRANG CHỦ MỚI (SẢNH CHỜ CHỌN NGÔN NGỮ)
// ==========================================
function HomePage({ user, onLogout }) {
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [lessons, setLessons] = useState([]);
  const navigate = useNavigate();

  // 🎨 Bộ từ điển gán cờ tự động bằng HÌNH ẢNH THẬT (Hiển thị đẹp trên mọi máy)
  const getFlag = (langName) => {
    if (!langName) return "📚";
    if (langName.toLowerCase().includes("lào")) {
      return (
        <img
          src="https://flagcdn.com/w160/la.png"
          alt="Cờ Lào"
          style={{
            width: "80px",
            borderRadius: "5px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        />
      );
    }
    if (langName.toLowerCase().includes("campuchia")) {
      return (
        <img
          src="https://flagcdn.com/w160/kh.png"
          alt="Cờ Campuchia"
          style={{
            width: "80px",
            borderRadius: "5px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        />
      );
    }
    return "📚";
  };

  // 1. Tải danh sách khóa học (Ngôn ngữ) từ Backend mới
  useEffect(() => {
    axios
      .get("http://localhost:3000/api/languages")
      .then((res) => setLanguages(res.data.data))
      .catch((err) => console.error("Lỗi tải ngôn ngữ:", err));
  }, []);

  // 2. Chỉ tải bài học khi học viên đã bấm chọn 1 ngôn ngữ
  useEffect(() => {
    if (selectedLanguage) {
      axios
        .get(
          `http://localhost:3000/api/courses/progress?userId=${user.id}&languageId=${selectedLanguage.id}`,
        )
        .then((res) => setLessons(res.data.data))
        .catch((err) => console.error("Lỗi tải bài học:", err));
    }
  }, [selectedLanguage, user.id]);

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "50px auto",
        fontFamily: "sans-serif",
        padding: "0 20px",
      }}
    >
      {/* THANH THÔNG TIN BÊN TRÊN */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
          padding: "15px",
          background: "#f8f9fa",
          borderRadius: "10px",
        }}
      >
        <div>
          <span style={{ fontWeight: "bold", color: "#333" }}>
            👤 Xin chào, {user.phone}
          </span>
          {user.role === "admin" && (
            <span
              style={{
                marginLeft: "10px",
                padding: "3px 8px",
                background: "#dc3545",
                color: "white",
                borderRadius: "15px",
                fontSize: "12px",
              }}
            >
              Admin
            </span>
          )}
        </div>
        <div>
          {user.role === "admin" && (
            <button
              onClick={() => navigate("/admin")}
              style={{
                padding: "5px 10px",
                background: "#343a40",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                marginRight: "10px",
              }}
            >
              ⚙️ Quản trị
            </button>
          )}
          <button
            onClick={onLogout}
            style={{
              padding: "5px 10px",
              background: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* NẾU CHƯA CHỌN KHÓA HỌC -> HIỂN THỊ SẢNH CHỜ */}
      {!selectedLanguage ? (
        <>
          <h1
            style={{ color: "#333", textAlign: "center", marginBottom: "30px" }}
          >
            🌍 Lựa Chọn Khóa Học Của Bạn
          </h1>

          {/* 🎨 ĐÃ LÀM ĐẸP CSS KHU VỰC NÀY */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "25px",
            }}
          >
            {languages.map((lang) => (
              <div
                key={lang.id}
                onClick={() => setSelectedLanguage(lang)}
                style={{
                  background: "linear-gradient(145deg, #ffffff, #f0f0f0)",
                  padding: "40px 20px",
                  borderRadius: "20px",
                  border: "2px solid transparent",
                  textAlign: "center",
                  cursor: "pointer",
                  boxShadow:
                    "5px 5px 15px rgba(0,0,0,0.05), -5px -5px 15px rgba(255,255,255,0.8)",
                  transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-8px)";
                  e.currentTarget.style.boxShadow =
                    "0 15px 25px rgba(0,123,255,0.15)";
                  e.currentTarget.style.borderColor = "#007bff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "5px 5px 15px rgba(0,0,0,0.05), -5px -5px 15px rgba(255,255,255,0.8)";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <div
                  style={{
                    fontSize: "70px",
                    marginBottom: "20px",
                    filter: "drop-shadow(2px 4px 6px rgba(0,0,0,0.2))",
                  }}
                >
                  {getFlag(lang.name)}
                </div>
                <h2
                  style={{
                    margin: 0,
                    color: "#2c3e50",
                    fontSize: "24px",
                    fontWeight: "800",
                    letterSpacing: "1px",
                  }}
                >
                  {lang.name}
                </h2>
                <p
                  style={{
                    color: "#7f8c8d",
                    fontSize: "14px",
                    marginTop: "10px",
                  }}
                >
                  Bấm để vào học &rarr;
                </p>
              </div>
            ))}

            {languages.length === 0 && (
              <p
                style={{
                  gridColumn: "span 2",
                  textAlign: "center",
                  color: "#666",
                }}
              >
                Hệ thống chưa có khóa học nào. Chờ Admin thêm nhé!
              </p>
            )}
          </div>
        </>
      ) : (
        /* NẾU ĐÃ CHỌN KHÓA HỌC -> HIỂN THỊ DANH SÁCH BÀI NHƯ CŨ (KHÔNG ĐỔI) */
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              flexWrap:
                "wrap" /* MỚI: Cho phép rớt dòng gọn gàng nếu màn hình nhỏ */,
              gap: "15px" /* MỚI: Tạo khoảng cách giữa nút và chữ nếu bị rớt dòng */,
            }}
          >
            <h1
              style={{
                color: "#333",
                margin: 0,
                lineHeight:
                  "1.4" /* MỚI: Kéo dãn khoảng cách dòng để chữ không bị đè lên nhau */,
              }}
            >
              Lộ trình học: {selectedLanguage.name}
            </h1>
            <button
              onClick={() => setSelectedLanguage(null)}
              style={{
                padding: "8px 15px",
                background: "#e2e6ea",
                color: "#333",
                border: "1px solid #dae0e5",
                borderRadius: "5px",
                cursor: "pointer",
                fontWeight: "bold",
                whiteSpace:
                  "nowrap" /* MỚI: Giữ cho chữ trong nút không bị méo */,
              }}
            >
              🔙 Đổi khóa học
            </button>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {lessons.length === 0 && (
              <p style={{ textAlign: "center", color: "#666" }}>
                Khóa học này chưa có bài nào.
              </p>
            )}
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "20px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  background: lesson.status === "locked" ? "#f8f9fa" : "#fff",
                  opacity: lesson.status === "locked" ? 0.6 : 1,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, color: "#333" }}>
                    Bài {lesson.orderIndex}: {lesson.title}
                  </h3>
                  <p
                    style={{
                      margin: "5px 0 0 0",
                      color: "#666",
                      fontSize: "14px",
                    }}
                  >
                    {lesson.status === "completed" &&
                      "✅ Bạn đã vượt qua bài này"}
                    {lesson.status === "unlocked" && "⏳ Đang chờ bạn khám phá"}
                    {lesson.status === "locked" &&
                      "🔒 Hãy hoàn thành bài trước để mở khóa"}
                  </p>
                </div>
                {lesson.status === "completed" && (
                  <button
                    onClick={() => navigate(`/lesson/${lesson.id}`)}
                    style={{
                      padding: "10px 20px",
                      background: "#28a745",
                      color: "#fff",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Đã hoàn thành
                  </button>
                )}
                {lesson.status === "unlocked" && (
                  <button
                    onClick={() => navigate(`/lesson/${lesson.id}`)}
                    style={{
                      padding: "10px 20px",
                      background: "#007bff",
                      color: "#fff",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Vào học ngay
                  </button>
                )}
                {lesson.status === "locked" && (
                  <button
                    disabled
                    style={{
                      padding: "10px 20px",
                      background: "#ccc",
                      color: "#666",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "not-allowed",
                      fontWeight: "bold",
                    }}
                  >
                    Chưa mở khóa
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
// ==========================================
// TRANG 3: CHI TIẾT BÀI HỌC
// ==========================================

function LessonPage({ user }) {
  const { id } = useParams();
  const lessonId = parseInt(id);

  const [lesson, setLesson] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");

  const videoRef = useRef(null);
  const [maxWatched, setMaxWatched] = useState(0);
  const [showQuizBtn, setShowQuizBtn] = useState(false);
  const [showQuizForm, setShowQuizForm] = useState(false);

  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [resultMessage, setResultMessage] = useState("");
  const [isPassed, setIsPassed] = useState(false);

  useEffect(() => {
    setLesson(null);
    setShowQuizBtn(false);
    setShowQuizForm(false);
    setAnswers({});
    setResultMessage("");
    setMaxWatched(0);
    setIsPassed(false);

    axios
      .get(`http://localhost:3000/api/lessons/${lessonId}?userId=${user.id}`)
      .then((res) => {
        setLesson(res.data.data);
        setIsLocked(false);
      })
      .catch((err) => {
        if (err.response && err.response.status === 403) {
          setIsLocked(true);
          setLockMessage(err.response.data.message);
        }
      });
  }, [lessonId, user.id]);

  // 🛡️ BẢO VỆ CHỐNG DOWNLOAD BÔI ĐEN - GIỮ NGUYÊN
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    const handleCopy = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.key === "u") ||
        (e.ctrlKey && e.key === "c") ||
        (e.ctrlKey && e.key === "s") ||
        (e.ctrlKey && e.key === "p")
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Ping tiến độ lên server
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        axios
          .post("http://localhost:3000/api/progress/ping", {
            userId: user.id,
            lessonId,
            currentTime: videoRef.current.currentTime,
            isEnded: false,
          })
          .catch((err) => console.log(err));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [maxWatched, lessonId, user.id]);

  if (isLocked) {
    return (
      <div
        style={{
          maxWidth: "600px",
          margin: "100px auto",
          textAlign: "center",
          fontFamily: "sans-serif",
          padding: "20px",
          background: "#fff3cd",
          borderRadius: "10px",
        }}
      >
        <h2 style={{ color: "#856404" }}>🚧 Bài học bị khóa!</h2>
        <p style={{ color: "#856404" }}>{lockMessage}</p>
        <Link
          to="/"
          style={{
            display: "inline-block",
            marginTop: "20px",
            padding: "10px 20px",
            background: "#ffc107",
            color: "#333",
            textDecoration: "none",
            borderRadius: "5px",
            fontWeight: "bold",
          }}
        >
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  if (!lesson)
    return (
      <h3 style={{ textAlign: "center", marginTop: "50px" }}>
        Đang tải dữ liệu...
      </h3>
    );

  const handleVideoEnded = () => {
    setShowQuizBtn(true);
    axios.post("http://localhost:3000/api/progress/ping", {
      userId: user.id,
      lessonId,
      currentTime: maxWatched,
      isEnded: true,
    });
  };

  const handleStartQuiz = () => {
    const QUIZ_LIMIT = 10;
    const shuffled = [...lesson.questions]
      .sort(() => Math.random() - 0.5)
      .slice(0, QUIZ_LIMIT);
    setShuffledQuestions(shuffled);
    setShowQuizForm(true);
    setAnswers({});
    setResultMessage("");
    setIsPassed(false);
  };

  const handleAnswerChange = (questionId, value) =>
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

  const handleSubmitQuiz = async () => {
    if (Object.keys(answers).length < shuffledQuestions.length) {
      alert(`Vui lòng trả lời đầy đủ ${shuffledQuestions.length} câu!`);
      return;
    }
    const formattedAnswers = Object.keys(answers).map((qId) => ({
      questionId: parseInt(qId),
      answer: answers[qId],
    }));
    try {
      const res = await axios.post("http://localhost:3000/api/quiz/submit", {
        userId: user.id,
        lessonId,
        userAnswers: formattedAnswers,
      });
      setResultMessage(res.data.message);
      setIsPassed(res.data.passed);
    } catch (error) {
      setResultMessage("Lỗi nộp bài!");
    }
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "30px auto",
        fontFamily: "sans-serif",
        padding: "0 20px",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <Link
        to="/"
        style={{
          display: "inline-block",
          marginBottom: "20px",
          color: "#007bff",
          textDecoration: "none",
          fontWeight: "bold",
        }}
      >
        &larr; Quay lại danh sách
      </Link>
      <h2 style={{ textAlign: "center", marginTop: 0 }}>{lesson.title}</h2>

      {/* 🛡️ Trình phát Video HLS GIỮ NGUYÊN */}
      <HlsVideoPlayer
        src={lesson.videoUrl}
        videoRef={videoRef}
        maxWatched={maxWatched}
        setMaxWatched={setMaxWatched}
        onEnded={handleVideoEnded}
        userPhone={user.phone}
      />

      {showQuizBtn && !showQuizForm && (
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button
            onClick={handleStartQuiz}
            style={{
              padding: "10px 20px",
              background: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            Bắt đầu làm bài kiểm tra
          </button>
        </div>
      )}

      {showQuizForm && (
        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            background: "#f8f9fa",
            borderRadius: "10px",
            border: "1px solid #ddd",
          }}
        >
          <h3
            style={{
              textAlign: "center",
              color: "#333",
              marginBottom: "20px",
            }}
          >
            📝 Bài Kiểm Tra Kiến Thức
          </h3>
          {shuffledQuestions.map((question, index) => (
            <div
              key={question.id}
              style={{
                marginBottom: "25px",
                paddingBottom: "15px",
                borderBottom: "1px dashed #ccc",
              }}
            >
              <h4
                style={{
                  marginBottom: "15px",
                  color: "#2c3e50",
                  lineHeight: "1.5",
                }}
              >
                Câu {index + 1}: {question.content}
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  paddingLeft: "10px",
                }}
              >
                {["A", "B", "C", "D"].map((opt) => (
                  <label
                    key={opt}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      value={opt}
                      checked={answers[question.id] === opt}
                      onChange={(e) =>
                        handleAnswerChange(question.id, e.target.value)
                      }
                      disabled={isPassed}
                      style={{ transform: "scale(1.2)" }}
                    />
                    <span>
                      <strong>{opt}.</strong> {question[`option${opt}`]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {!isPassed && (
            <button
              onClick={handleSubmitQuiz}
              style={{
                padding: "15px 20px",
                background: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "18px",
                width: "100%",
                fontWeight: "bold",
                marginTop: "10px",
              }}
            >
              Nộp bài làm
            </button>
          )}

          {resultMessage && (
            <div
              style={{
                marginTop: "20px",
                padding: "15px",
                borderRadius: "5px",
                textAlign: "center",
                fontWeight: "bold",
                fontSize: "16px",
                background: isPassed ? "#d4edda" : "#f8d7da",
                color: isPassed ? "#155724" : "#721c24",
              }}
            >
              {resultMessage}
              {!isPassed && (
                <button
                  onClick={handleStartQuiz}
                  style={{
                    display: "block",
                    margin: "15px auto 0",
                    padding: "8px 15px",
                    background: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                  }}
                >
                  🔄 Làm lại bài (Đảo câu hỏi)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// TRANG 4: ADMIN PANEL (CÓ THÊM CHỌN NGÔN NGỮ ĐỂ TẠO BÀI HỌC)
// ==========================================
function AdminPage({ user }) {
  if (user.role !== "admin") return <Navigate to="/" />;

  const [adminLessons, setAdminLessons] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");

  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [orderIndex, setOrderIndex] = useState("");
  const [languageId, setLanguageId] = useState(""); // LƯU TRỮ NGÔN NGỮ ĐƯỢC CHỌN
  const [questions, setQuestions] = useState([
    {
      content: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      correctAnswer: "A",
    },
  ]);

  useEffect(() => {
    fetchLessons();
    fetchLanguages();
  }, []);

  const fetchLessons = () => {
    axios
      .get("http://localhost:3000/api/admin/lessons")
      .then((res) => setAdminLessons(res.data.data))
      .catch((err) => console.error(err));
  };

  const fetchLanguages = () => {
    axios
      .get("http://localhost:3000/api/languages")
      .then((res) => {
        setLanguages(res.data.data);
        if (res.data.data.length > 0)
          setLanguageId(res.data.data[0].id.toString());
      })
      .catch(console.error);
  };

  const handleSelectChange = (e) => {
    const id = e.target.value;
    setSelectedLessonId(id);

    if (id === "") {
      setTitle("");
      setVideoUrl("");
      setOrderIndex("");
      if (languages.length > 0) setLanguageId(languages[0].id.toString());
      setQuestions([
        {
          content: "",
          optionA: "",
          optionB: "",
          optionC: "",
          optionD: "",
          correctAnswer: "A",
        },
      ]);
    } else {
      const lessonToEdit = adminLessons.find((l) => l.id === parseInt(id));
      if (lessonToEdit) {
        setTitle(lessonToEdit.title);
        setVideoUrl(lessonToEdit.videoUrl);
        setOrderIndex(lessonToEdit.orderIndex);
        setLanguageId(
          lessonToEdit.languageId ? lessonToEdit.languageId.toString() : "",
        );
        if (lessonToEdit.questions.length > 0)
          setQuestions(lessonToEdit.questions);
        else
          setQuestions([
            {
              content: "",
              optionA: "",
              optionB: "",
              optionC: "",
              optionD: "",
              correctAnswer: "A",
            },
          ]);
      }
    }
  };

  const handleAddQuestion = () =>
    setQuestions([
      ...questions,
      {
        content: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctAnswer: "A",
      },
    ]);
  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };
  const handleRemoveQuestion = (index) =>
    setQuestions(questions.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title,
        videoUrl,
        orderIndex: parseInt(orderIndex),
        languageId: parseInt(languageId),
        questions,
      };
      let res;
      if (selectedLessonId === "")
        res = await axios.post(
          "http://localhost:3000/api/admin/lessons",
          payload,
        );
      else
        res = await axios.put(
          `http://localhost:3000/api/admin/lessons/${selectedLessonId}`,
          payload,
        );
      alert(res.data.message);
      fetchLessons();
      if (selectedLessonId === "") {
        setTitle("");
        setVideoUrl("");
        setOrderIndex("");
        setQuestions([
          {
            content: "",
            optionA: "",
            optionB: "",
            optionC: "",
            optionD: "",
            correctAnswer: "A",
          },
        ]);
      }
    } catch (error) {
      alert("Lỗi: " + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        fontFamily: "sans-serif",
        padding: "20px",
        background: "#f4f7f6",
        borderRadius: "10px",
      }}
    >
      <Link
        to="/"
        style={{
          display: "inline-block",
          marginBottom: "20px",
          color: "#007bff",
          textDecoration: "none",
          fontWeight: "bold",
        }}
      >
        &larr; Quay lại Trang chủ
      </Link>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ margin: 0, color: "#333" }}>Quản Trị Bài Học</h2>
        <select
          value={selectedLessonId}
          onChange={handleSelectChange}
          style={{
            padding: "10px",
            borderRadius: "5px",
            border: "1px solid #ccc",
            fontWeight: "bold",
            background: "#fff",
          }}
        >
          <option value="">➕ TẠO BÀI HỌC MỚI</option>
          <optgroup label="✏️ SỬA BÀI HỌC CŨ:">
            {adminLessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.language ? `[${l.language.name}] ` : ""}Bài {l.orderIndex}:{" "}
                {l.title}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        {/* 🌟 FORM CHỌN NGÔN NGỮ DÀNH CHO ADMIN */}
        <div>
          <label style={{ fontWeight: "bold", color: "#d32f2f" }}>
            Chọn Khóa Học (Ngôn ngữ):
          </label>
          <select
            required
            value={languageId}
            onChange={(e) => setLanguageId(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "2px solid #d32f2f",
              fontWeight: "bold",
              background: "#fff",
            }}
          >
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontWeight: "bold" }}>Tên bài học:</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <div>
          <label style={{ fontWeight: "bold" }}>Link Video (Cloudinary):</label>
          <input
            type="text"
            required
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <div>
          <label style={{ fontWeight: "bold" }}>Thứ tự bài học:</label>
          <input
            type="number"
            required
            value={orderIndex}
            onChange={(e) => setOrderIndex(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        <hr style={{ border: "1px solid #ddd", margin: "10px 0" }} />
        <h3 style={{ margin: 0, color: "#333" }}>Danh sách Câu hỏi</h3>

        {questions.map((q, index) => (
          <div
            key={index}
            style={{
              padding: "20px",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #ddd",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "5px",
              }}
            >
              <label style={{ fontWeight: "bold" }}>
                Câu hỏi số {index + 1}:
              </label>
              <button
                type="button"
                onClick={() => handleRemoveQuestion(index)}
                style={{
                  background: "transparent",
                  color: "red",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ✖ Xóa câu này
              </button>
            </div>
            <input
              type="text"
              required
              value={q.content}
              placeholder="Nhập nội dung câu hỏi..."
              onChange={(e) =>
                handleQuestionChange(index, "content", e.target.value)
              }
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #ccc",
                marginBottom: "15px",
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              {["A", "B", "C", "D"].map((opt) => (
                <div key={opt}>
                  <strong style={{ color: "#007bff" }}>{opt}.</strong>{" "}
                  <input
                    type="text"
                    required
                    value={q[`option${opt}`]}
                    placeholder={`Nội dung đáp án ${opt}...`}
                    onChange={(e) =>
                      handleQuestionChange(
                        index,
                        `option${opt}`,
                        e.target.value,
                      )
                    }
                    style={{
                      width: "90%",
                      padding: "8px",
                      borderRadius: "5px",
                      border: "1px solid #ccc",
                    }}
                  />
                </div>
              ))}
            </div>

            <div
              style={{
                background: "#e9ecef",
                padding: "10px",
                borderRadius: "5px",
                display: "inline-block",
              }}
            >
              <label
                style={{
                  fontWeight: "bold",
                  marginRight: "10px",
                  color: "#28a745",
                }}
              >
                ✅ Đáp án đúng:
              </label>
              <select
                value={q.correctAnswer}
                onChange={(e) =>
                  handleQuestionChange(index, "correctAnswer", e.target.value)
                }
                style={{
                  padding: "8px",
                  borderRadius: "5px",
                  fontWeight: "bold",
                }}
              >
                <option value="A">Đáp án A</option>
                <option value="B">Đáp án B</option>
                <option value="C">Đáp án C</option>
                <option value="D">Đáp án D</option>
              </select>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddQuestion}
          style={{
            padding: "10px",
            background: "#17a2b8",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold",
            width: "200px",
          }}
        >
          + Thêm câu hỏi
        </button>
        <button
          type="submit"
          style={{
            padding: "15px",
            background: selectedLessonId ? "#ffc107" : "#28a745",
            color: selectedLessonId ? "#333" : "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "16px",
            marginTop: "20px",
          }}
        >
          {selectedLessonId
            ? "💾 Cập Nhật Bài Học Này"
            : "💾 Lưu Bài Mới Vào Hệ Thống"}
        </button>
      </form>
    </div>
  );
}

// ==========================================
// BỘ ĐIỀU CHUYỂN TRUNG TÂM
// ==========================================
export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("lms_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogout = () => {
    localStorage.removeItem("lms_user");
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            !user ? (
              <LoginPage onLoginSuccess={setUser} />
            ) : (
              <HomePage user={user} onLogout={handleLogout} />
            )
          }
        />
        <Route
          path="/lesson/:id"
          element={!user ? <Navigate to="/" /> : <LessonPage user={user} />}
        />
        <Route
          path="/admin"
          element={!user ? <Navigate to="/" /> : <AdminPage user={user} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
