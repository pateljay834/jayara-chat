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

let currentRoom = null;
let currentUser = "";
let currentMode = "vanish";

// Join a room
function joinRoom() {
  currentUser = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  currentMode = document.getElementById("mode").value;

  if (!currentUser) currentUser = "Guest";
  if (!currentRoom) currentRoom = "defaultRoom";

  document.getElementById("chatArea").style.display = "block";
  document.getElementById("messages").innerHTML = "";

  // ✅ Listen for messages in this room
  db.ref("rooms/" + currentRoom).on("child_added", snap => {
    let data = snap.val();
    let now = Date.now();

    // Auto-delete old messages in storage mode
    if (currentMode === "storage" && now - data.time > 15 * 24 * 60 * 60 * 1000) {
      snap.ref.remove();
      return;
    }

    // Create message bubble
    let msgDiv = document.createElement("div");
    msgDiv.classList.add("msg");
    msgDiv.classList.add(data.user === currentUser ? "me" : "other");
    msgDiv.innerHTML = `<span class="username">${data.user}:</span> ${data.text}`;
    document.getElementById("messages").appendChild(msgDiv);

    // Scroll to latest
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
  });
}

// Send a message
function sendMessage() {
  let text = document.getElementById("msgBox").value.trim();
  if (!text || !currentRoom) return;

  db.ref("rooms/" + currentRoom).push({
    user: currentUser,
    text: text,
    time: Date.now()
  });

  document.getElementById("msgBox").value = "";
}

// Leave current room
function leaveRoom() {
  if (currentRoom) {
    db.ref("rooms/" + currentRoom).off(); // Stop listening
  }

  document.getElementById("chatArea").style.display = "none";
  document.getElementById("messages").innerHTML = "";
  document.getElementById("username").value = "";
  document.getElementById("room").value = "";

  currentRoom = null;
  currentUser = "";
}

// ✅ Vanish mode: delete all messages when closing window
window.addEventListener("beforeunload", () => {
  if (currentMode === "vanish" && currentRoom) {
    db.ref("rooms/" + currentRoom).remove();
  }
});