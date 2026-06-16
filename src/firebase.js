import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCc-fnXgXsOggrR64ByvctLHlhxbetKZKs",
  authDomain: "lms-sms-auth.firebaseapp.com",
  projectId: "lms-sms-auth",
  storageBucket: "lms-sms-auth.firebasestorage.app",
  messagingSenderId: "49190953510",
  appId: "1:49190953510:web:9be621b68eaeb3ca927ce7",
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Xuất công cụ xác thực để trang Đăng nhập sử dụng
export const auth = getAuth(app);
