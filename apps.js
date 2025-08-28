// Firebase Initialization
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
let currentUser = "";
let currentRoom = "";
let currentMode = "";
let messagesRef;

// Join Room
function joinRoom() {
  const username = document.getElementById("username").value.trim();
  const room = document.getElementById("room").value.trim();
  const mode = document.getElementById("mode").value;

  if (!username || !room) return alert("Enter your name and room code");

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
  messagesRef.on("child_added", snapshot => {
    const msg = snapshot.val();
    displayMessage(msg.username, msg.text);
  });
}

// Send Message
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

// Leave Room
function leaveRoom() {
  if (messagesRef) messagesRef.off();

  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  const info = document.createElement("div");
  info.classList.add("msg");
  info.style.background = "#ffe6e6";
  info.style.textAlign = "center";
  info.innerText = `🚪 Session Ended. You left the room.`;
  messagesDiv.appendChild(info);

  document.getElementById("chatArea").style.display = "none";
  document.getElementById("leaveBtn").style.display = "none";
  document.getElementById("deleteBtn").style.display = "none";

  localStorage.removeItem("jayaraUser");
  currentUser = "";
  currentRoom = "";
  currentMode = "";
}

// Delete All Messages
function deleteAllMessages() {
  if (currentRoom) {
    db.ref("messages/" + currentRoom).remove();
    document.getElementById("messages").innerHTML = "";
  }
}

// Display Message
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

// Auto Join if Storage Mode
function autoJoinIfStored() {
  const saved = localStorage.getItem("jayaraUser");
  if (saved) {
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
}

document.addEventListener("DOMContentLoaded", autoJoinIfStored);

// Enter key sends message
document.getElementById("msgBox").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});