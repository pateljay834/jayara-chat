// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyB0G0JLoNejrshjLaKxFR264cY11rmhVJU",
  authDomain: "jayara-web.firebaseapp.com",
  databaseURL: "https://jayara-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jayara-web",
  storageBucket: "jayara-web.appspot.com",
  messagingSenderId: "342182893596",
  appId: "1:342182893596:web:664646e95a40e60d0da7d9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentRoom = null;
let currentMode = "vanish";
let currentUser = "";
let roomRef = null;

document.getElementById("joinBtn").addEventListener("click", joinRoom);
document.getElementById("sendBtn").addEventListener("click", sendMessage);

function joinRoom() {
  currentUser = document.getElementById("username").value.trim() || "Guest";
  currentRoom = document.getElementById("room").value.trim() || "defaultRoom";
  currentMode = document.getElementById("mode").value;

  document.getElementById("chatArea").style.display = "block";
  document.getElementById("messages").innerHTML = "";

  const roomPath = "rooms/" + currentRoom;
  roomRef = db.ref(roomPath);

  // ✅ Vanish Mode: clear all previous messages when user joins
  if (currentMode === "vanish") {
    roomRef.remove();
  }

  // Listen for new messages
  roomRef.on("child_added", snap => {
    const data = snap.val();
    if (!data) return;

    // Auto-delete old messages in Storage Mode (>15 days)
    if (currentMode === "storage" && Date.now() - data.time > 15 * 24 * 60 * 60 * 1000) {
      snap.ref.remove();
      return;
    }

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("msg", data.user === currentUser ? "me" : "other");
    msgDiv.innerHTML = `<span class="username">${data.user}:</span> ${data.text}`;
    document.getElementById("messages").appendChild(msgDiv);
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
  });
}

function sendMessage() {
  const text = document.getElementById("msgBox").value.trim();
  if (!text) return;

  roomRef.push({
    user: currentUser,
    text: text,
    time: Date.now()
  });

  document.getElementById("msgBox").value = "";
}

// ❌ Remove beforeunload — not reliable on mobile PWA