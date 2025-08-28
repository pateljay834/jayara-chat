// Firebase Configuration (Compat SDK)
const firebaseConfig = {
  apiKey: "AIzaSyB0G0JLoNejrshjLaKxFR264cY11rmhVJU",
  authDomain: "jayara-web.firebaseapp.com",
  databaseURL: "https://jayara-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jayara-web",
  storageBucket: "jayara-web.firebasestorage.app",
  messagingSenderId: "342182893596",
  appId: "1:342182893596:web:664646e95a40e60d0da7d9"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentUser = "";
let currentRoom = "";
let currentMode = "";
let messagesRef = null;

// ------------------ Join Room ------------------
function joinRoom() {
  const username = document.getElementById("username").value.trim();
  const room = document.getElementById("room").value.trim();
  const mode = document.getElementById("mode").value;

  if (!username || !room) return alert("Enter your name and room code");

  // Remove any previous listener
  if (messagesRef) {
    messagesRef.off();
    console.log("✅ Previous listener removed");
  }

  currentUser = username;
  currentRoom = room;
  currentMode = mode;

  if (mode === "storage") {
    localStorage.setItem("jayaraUser", JSON.stringify({ username, room, mode }));
  }

  document.getElementById("chatArea").style.display = "block";
  document.getElementById("leaveBtn").style.display = "inline-block";
  document.getElementById("deleteBtn").style.display = "inline-block";

  messagesRef = db.ref("messages/" + room);

  // Attach listener
  messagesRef.on("child_added", snapshot => {
    const msg = snapshot.val();
    if (!msg) return;
    displayMessage(msg.username, msg.text);
  });

  console.log(`🔑 Joined room "${room}" as "${username}" in ${mode} mode`);
}

// ------------------ Send Message ------------------
function sendMessage() {
  const msgBox = document.getElementById("msgBox");
  const text = msgBox.value.trim();
  if (!text || !currentRoom || !currentUser) return;

  const newMsgRef = db.ref("messages/" + currentRoom).push();
  newMsgRef
    .set({
      username: currentUser,
      text: text,
      timestamp: Date.now()
    })
    .then(() => console.log("✅ Message delivered:", text))
    .catch(err => console.error("❌ Message delivery failed:", err));

  msgBox.value = "";
}

// ------------------ Leave Room ------------------
function leaveRoom() {
  if (messagesRef) messagesRef.off();

  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  const info = document.createElement("div");
  info.classList.add("msg");
  info.style.background = "#ffe6e6";
  info.style.textAlign = "center";
  info.innerText = `🚪 You left the room.`;
  messagesDiv.appendChild(info);

  document.getElementById("chatArea").style.display = "none";
  document.getElementById("leaveBtn").style.display = "none";
  document.getElementById("deleteBtn").style.display = "none";

  localStorage.removeItem("jayaraUser");
  currentUser = "";
  currentRoom = "";
  currentMode = "";

  console.log("🚪 Left the room and cleared listener");
}

// ------------------ Delete All Messages ------------------
function deleteAllMessages() {
  if (!currentRoom) return;
  db.ref("messages/" + currentRoom)
    .remove()
    .then(() => {
      document.getElementById("messages").innerHTML = "";
      console.log("🗑 All messages deleted");
    })
    .catch(err => console.error("❌ Delete failed:", err));
}

// ------------------ Display Message ------------------
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
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ------------------ Auto-Join Storage Mode ------------------
function autoJoinIfStored() {
  const saved = localStorage.getItem("jayaraUser");
  if (!saved) return;

  const { username, room, mode } = JSON.parse(saved);
  document.getElementById("username").value = username;
  document.getElementById("room").value = room;
  document.getElementById("mode").value = mode;

  joinRoom();

  const messagesDiv = document.getElementById("messages");
  const info = document.createElement("div");
  info.classList.add("msg");
  info.style.background = "#e6ffe6";
  info.style.textAlign = "center";
  info.innerText = `🔄 Rejoined ${room} as ${username} (Storage Mode)`;
  messagesDiv.appendChild(info);
}

// ------------------ Enter Key Sends ------------------
document.addEventListener("DOMContentLoaded", autoJoinIfStored);
document.getElementById("msgBox").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});