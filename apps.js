// Firebase Config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "jayara-web.firebaseapp.com",
  databaseURL: "https://jayara-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jayara-web",
  storageBucket: "jayara-web.appspot.com",
  messagingSenderId: "342182893596",
  appId: "1:342182893596:web:664646e95a40e60d0da7d9"
};
firebase.initializeApp(firebaseConfig);

const db = firebase.database();
const messaging = firebase.messaging();

let currentRoom = null;
let currentUser = "";
let currentMode = "vanish";

// ✅ Request FCM token and save in room
async function getFCMToken(roomId) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notifications not allowed");
      return;
    }

    const token = await messaging.getToken({
      vapidKey: "BP2a0ozwY3d0DW3eEih0c_Ai0