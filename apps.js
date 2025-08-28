// =============================
// 🔥 Firebase Initialization
// =============================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);

const db = firebase.database();
const messaging = firebase.messaging();

// =============================
// 📌 Global Variables
// =============================
let currentUser = "";
let currentRoom = "";
let currentMode = "";
let messagesRef;

// =============================
// 🚀 Join Room
// =============================
function joinRoom() {
  const username = document.getElementById("username").value.trim();
  const room = document.getElementById("room").value.trim();
  const mode = document.getElementById("mode").value;

  if (!username || !room) return alert("Enter your name and room code");

  currentUser = username;
  currentRoom = room;
  currentMode = mode;

  // Save login if storage mode
  if (mode === "storage") {
    localStorage.setItem("jayaraUser", JSON.stringify({ username, room, mode }));
  }

  // Show chat area
  document.getElementById("chatArea").style.display = "block";
  document.getElementById("leaveBtn").style.display = "inline-block";
  document.getElementById("deleteBtn").style.display = "inline-block";

  // Start listening to messages
  messagesRef = db.ref("messages/" + room);
  messagesRef.on("child_added", snapshot => {
    const msg = snapshot.val();
    displayMessage(msg.username, msg.text);
  });

  // Register for push notifications
  requestNotificationPermission(username, room);
}

// =============================
// 💬 Send Message
// =============================
function sendMessage() {
  const msgBox = document.getElementById("msgBox");
  const text = msgBox.value.trim();
  if (!text) return;

  db.ref("messages/" + currentRoom).push({
    username: currentUser,
    text: text,
    timestamp: Date.now()
  });

  msgBox.value = "";
}

// =============================
// 🚪 Leave Room
// =============================
function leaveRoom() {
  if (messagesRef) messagesRef.off();

  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  // Show session ended indicator
  const info = document.createElement("div");
  info.classList.add("msg");
  info.style.background = "#ffe6e6";
  info.style.textAlign = "center";
  info.innerText = `🚪 Session Ended. You left the room.`;
  messagesDiv.appendChild(info);

  // Hide buttons & chat area
  document.getElementById("chatArea").style.display = "none";
  document.getElementById("leaveBtn").style.display = "none";
  document.getElementById("deleteBtn").style.display = "none";

  // Clear local storage
  localStorage.removeItem("jayaraUser");

  currentUser = "";
  currentRoom = "";
  currentMode = "";
}

// =============================
// 🗑 Delete All Messages
// =============================
function deleteAllMessages() {
  if (currentRoom) {
    db.ref("messages/" + currentRoom).remove();
    document.getElementById("messages").innerHTML = "";
  }
}

// =============================
// 🔔 Push Notification Setup
// =============================
async function requestNotificationPermission(username, room) {
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const token = await messaging.getToken({
        vapidKey: "BP2a0ozwY3d0DW3eEih0c_Ai0iaNngCyhDWIzzIM2umb5ZWrMwAXaDVw4yjbPSKYYuNDUAYg-U3nDGmumBMt7i0"
      });
      if (token) {
        console.log("FCM Token:", token);
        // Save token under tokens/{room}/{username}
        db.ref("tokens/" + room + "/" + username).set(token);
      }
    }
  } catch (err) {
    console.error("Unable to get permission for notifications", err);
  }
}

// =============================
// 📥 Display Message in UI
// =============================
function displayMessage(username, text) {
  const messagesDiv = document.getElementById("messages");
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("msg");

  if (username === currentUser) {
    msgDiv.classList.add("me");
    msgDiv.innerHTML = `<span class="username">Me:</span> ${text}`;
  } else {
    msgDiv.classList.add("other");
    msgDiv.innerHTML = `<span class="username">${username}:</span> ${text}`;
  }

  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight; // auto-scroll
}

// =============================
// ♻️ Auto Join if in Storage Mode
// =============================
function autoJoinIfStored() {
  const saved = localStorage.getItem("jayaraUser");
  if (saved) {
    const { username, room, mode } = JSON.parse(saved);
    document.getElementById("username").value = username;
    document.getElementById("room").value = room;
    document.getElementById("mode").value = mode;

    joinRoom();

    // Show indicator message
    const messagesDiv = document.getElementById("messages");
    const info = document.createElement("div");
    info.classList.add("msg");
    info.style.background = "#e6ffe6";
    info.style.textAlign = "center";
    info.innerText = `🔄 Rejoined ${room} as ${username} (Storage Mode)`;
    messagesDiv.appendChild(info);
  }
}

document.addEventListener("DOMContentLoaded", autoJoinIfStored);

// =============================
// Optional: Enter key to send
// =============================
document.getElementById("msgBox").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});