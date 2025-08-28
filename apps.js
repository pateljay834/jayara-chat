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
let roomKey = null; // AES-GCM key for encryption

// ------------------ Crypto Helpers ------------------
async function generateKeyFromPassphrase(passphrase) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("jayara_salt_" + currentRoom),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptMessage(text) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    roomKey,
    enc.encode(text)
  );
  return { iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(cipherBuffer)) };
}

async function decryptMessage(data) {
  const dec = new TextDecoder();
  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(data.iv) },
      roomKey,
      new Uint8Array(data.ciphertext)
    );
    return dec.decode(plainBuffer);
  } catch {
    return "🔒 Unable to decrypt message";
  }
}

// ------------------ Join Room ------------------
async function joinRoom() {
  const username = document.getElementById("username").value.trim();
  const room = document.getElementById("room").value.trim();
  const mode = document.getElementById("mode").value;

  if (!username || !room) return alert("Enter your name and room code");

  // Check if a passphrase is already stored
  const saved = localStorage.getItem("jayaraUser");
  let passphrase = "";
  if (saved) {
    const stored = JSON.parse(saved);
    if (stored.username === username && stored.room === room) {
      passphrase = stored.passphrase;
    }
  }

  // Ask once if no passphrase stored
  if (!passphrase) {
    passphrase = prompt("Enter room passphrase for encryption:");
    if (!passphrase) return alert("Passphrase required for encryption");
    if (mode === "storage") {
      localStorage.setItem(
        "jayaraUser",
        JSON.stringify({ username, room, mode, passphrase })
      );
    }
  }

  roomKey = await generateKeyFromPassphrase(passphrase);

  if (messagesRef) messagesRef.off();

  currentUser = username;
  currentRoom = room;
  currentMode = mode;

  document.getElementById("chatArea").style.display = "block";
  document.getElementById("leaveBtn").style.display = "inline-block";
  document.getElementById("deleteBtn").style.display = "inline-block";

  messagesRef = db.ref("messages/" + room);

  messagesRef.on("child_added", async snapshot => {
    const msg = snapshot.val();
    if (!msg) return;
    const text = msg.ciphertext ? await decryptMessage(msg) : msg.text;
    displayMessage(msg.username, text);
  });

  console.log(`🔑 Joined room "${room}" as "${username}" in ${mode} mode`);
}

// ------------------ Send Message ------------------
async function sendMessage() {
  const msgBox = document.getElementById("msgBox");
  const text = msgBox.value.trim();
  if (!text || !currentRoom || !currentUser) return;

  const encrypted = await encryptMessage(text);
  const newMsgRef = db.ref("messages/" + currentRoom).push();
  newMsgRef
    .set({
      username: currentUser,
      ...encrypted,
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
  roomKey = null;

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
async function autoJoinIfStored() {
  const saved = localStorage.getItem("jayaraUser");
  if (!saved) return;

  const { username, room, mode, passphrase } = JSON.parse(saved);
  document.getElementById("username").value = username;
  document.getElementById("room").value = room;
  document.getElementById("mode").value = mode;

  // Generate encryption key from stored passphrase
  roomKey = await generateKeyFromPassphrase(passphrase);

  // Join the room automatically
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

async function requestNotificationPermission() {
  if ('Notification' in window && 'serviceWorker' in navigator) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log("✅ Notifications allowed");
      initFCM();
    }
  }
}

async function initFCM() {
  const messaging = firebase.messaging();
  try {
    const token = await messaging.getToken({
      vapidKey: "BP2a0ozwY3d0DW3eEih0c_Ai0iaNngCyhDWIzzIM2umb5ZWrMwAXaDVw4yjbPSKYYuNDUAYg-U3nDGmumBMt7i0"
    });
    console.log("FCM Token:", token);
    // Later: Save this token in Firebase DB per user/device
  } catch (err) {
    console.error("Error getting FCM token:", err);
  }

  // Foreground message display
  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    if (title && body) new Notification(title, { body, icon: 'icon-192.png' });
  });
}

// Call once at app startup
requestNotificationPermission();