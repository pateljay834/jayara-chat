// ✅ Firebase Config
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
let currentUser = "";
let currentMode = "vanish";
let roomRef = null;

// Join a room
function joinRoom() {
  currentUser = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  currentMode = document.getElementById("mode").value;

  if (!currentUser) currentUser = "Guest";
  if (!currentRoom) currentRoom = "defaultRoom";

  if (roomRef) roomRef.off(); // stop old listener
  roomRef = db.ref("rooms/" + currentRoom);

  document.getElementById("chatArea").style.display = "block";
  document.getElementById("leaveBtn").style.display = "inline-block";
  document.getElementById("deleteBtn").style.display = currentMode === "storage" ? "inline-block" : "none";
  document.getElementById("messages").innerHTML = "";

  roomRef.on("child_added", snap => {
    let data = snap.val();
    let now = Date.now();

    if (currentMode === "storage" && now - data.time > 15 * 24 * 60 * 60 * 1000) {
      snap.ref.remove();
      return;
    }

    let msgDiv = document.createElement("div");
    msgDiv.classList.add("msg");
    msgDiv.classList.add(data.user === currentUser ? "me" : "other");
    msgDiv.innerHTML = `<span class="username">${data.user}:</span> ${data.text}`;

    let messagesDiv = document.getElementById("messages");
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
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

// Leave a room
function leaveRoom() {
  if (roomRef) {
    if (currentMode === "vanish") {
      if (confirm("Leaving will delete all messages in this room. Continue?")) {
        roomRef.remove();
      }
    }
    roomRef.off();
  }

  document.getElementById("chatArea").style.display = "none";
  document.getElementById("leaveBtn").style.display = "none";
  document.getElementById("deleteBtn").style.display = "none";
  document.getElementById("messages").innerHTML = "";
  currentRoom = null;
  roomRef = null;
}

// Delete all messages manually (storage mode)
function deleteAllMessages() {
  if (roomRef && currentMode === "storage") {
    if (confirm("Are you sure you want to delete all messages in this room?")) {
      roomRef.remove();
      document.getElementById("messages").innerHTML = "";
    }
  }
}