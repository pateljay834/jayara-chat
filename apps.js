// -------------------------
// apps.js (full, with manual + automatic cleanup)
// -------------------------

// Firebase config (your existing values)
const firebaseConfig = {
  apiKey: "AIzaSyB0G0JLoNejrshjLaKxFR264cY11rmhVJU",
  authDomain: "jayara-web.firebaseapp.com",
  databaseURL: "https://jayara-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jayara-web",
  storageBucket: "jayara-web.firebasestorage.app",
  messagingSenderId: "342182893596",
  appId: "1:342182893596:web:664646e95a40e60d0da7d9"
};

// Init Firebase (compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Globals
let currentRoom = null;
let currentMode = null;
let currentUser = null;
let currentPass = null;
let msgRef = null;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// -------------------------
// Debug helper
// -------------------------
function logDebug(msg) {
  console.log(msg);
  const dbg = document.getElementById("debugLog");
  if (dbg) {
    dbg.innerText += msg + "\n";
    dbg.scrollTop = dbg.scrollHeight;
  }
}

// -------------------------
// Cleanup helpers
// -------------------------
// Clean messages under a single room/mode (e.g. rooms/<roomKey>/<modeKey>)
// removes messages older than threshold and removes the mode node if empty
function cleanupMode(roomKey, modeKey) {
  const now = Date.now();
  const threshold = modeKey === "vanish" ? ONE_DAY_MS : SEVEN_DAYS_MS;
  const modeRef = db.ref(`rooms/${roomKey}/${modeKey}`);

  return modeRef.once("value").then((snap) => {
    const deletions = [];
    snap.forEach((msgSnap) => {
      const msg = msgSnap.val();
      const age = now - (msg && msg.time ? msg.time : now);
      if (age > threshold) {
        deletions.push(msgSnap.ref.remove());
      }
    });

    // Wait for deletions to complete, then check if mode node empty and remove it if empty
    return Promise.all(deletions)
      .then(() => modeRef.once("value"))
      .then((afterSnap) => {
        if (!afterSnap.exists()) {
          return modeRef.remove().catch(() => {});
        }
        return Promise.resolve();
      });
  }).catch((err) => {
    logDebug(`cleanupMode error for ${roomKey}/${modeKey}: ${err}`);
    return Promise.resolve();
  });
}

// Run cleanup across all rooms: remove old messages, remove empty modes, remove empty rooms older than 7d
function runCleanup() {
  logDebug("🧹 Cleanup started...");
  const roomsRef = db.ref("rooms");
  const now = Date.now();

  return roomsRef.once("value").then((snap) => {
    const roomPromises = [];

    snap.forEach((roomSnap) => {
      const roomKey = roomSnap.key;

      // For each non-meta child (modes), schedule cleanupMode
      const modePromises = [];
      roomSnap.forEach((modeSnap) => {
        if (modeSnap.key === "meta") return; // skip meta
        modePromises.push(cleanupMode(roomKey, modeSnap.key));
      });

      // After cleaning modes, check if room is empty (excluding meta)
      const roomPromise = Promise.all(modePromises)
        .then(() => db.ref(`rooms/${roomKey}`).once("value"))
        .then((updatedRoomSnap) => {
          // Check if there are any non-meta children left
          let hasNonMeta = false;
          updatedRoomSnap.forEach((child) => {
            if (child.key !== "meta") hasNonMeta = true;
          });

          if (!hasNonMeta) {
            // If room has meta.lastActive older than 7 days, remove the room
            const meta = updatedRoomSnap.child("meta").val();
            if (meta && meta.lastActive && (now - meta.lastActive > SEVEN_DAYS_MS)) {
              return updatedRoomSnap.ref.remove().then(() => {
                logDebug(`🗑 Removed room ${roomKey} (empty & inactive >7d)`);
              }).catch((e) => {
                logDebug(`Failed to remove room ${roomKey}: ${e}`);
              });
            } else {
              // If no meta or not old enough, optionally remove mode nodes already done; do nothing else.
              return Promise.resolve();
            }
          }
          return Promise.resolve();
        });

      roomPromises.push(roomPromise);
    });

    return Promise.all(roomPromises);
  }).then(() => {
    logDebug("✅ Cleanup finished.");
    // Show small user alert only if manual trigger used (we'll call runCleanup from both manual and automatic).
    // Here we do not alert automatically; caller may decide to alert.
    return Promise.resolve();
  }).catch((err) => {
    logDebug("Cleanup failed: " + err);
  });
}

// Exposed wrapper called by button; shows alert when completed
function runCleanupButton() {
  runCleanup().then(() => {
    alert("Cleanup completed");
  });
}

// -------------------------
// Core chat functions
// -------------------------
function joinRoom() {
  currentUser = document.getElementById("username").value.trim();
  currentRoom = document.getElementById("room").value.trim();
  currentPass = document.getElementById("passphrase").value.trim();
  currentMode = document.getElementById("mode").value;

  if (!currentUser || !currentRoom || !currentPass) {
    alert("Enter all details (name, room, passphrase)");
    return;
  }

  // set msgRef
  msgRef = db.ref("rooms/" + currentRoom + "/" + currentMode);

  // update room meta lastActive
  db.ref(`rooms/${currentRoom}/meta`).update({ lastActive: Date.now() }).catch(() => {});

  // perform cleanup in background (non-blocking). This will prune old data.
  runCleanup();

  // UI switch
  document.getElementById("joinPanel").style.display = "none";
  document.getElementById("chatPanel").style.display = "block";
  document.getElementById("roomLabel").innerText = currentRoom;
  document.getElementById("modeBadge").innerText = currentMode;
  document.getElementById("messages").innerHTML = "";

  // start listening for messages in this room/mode
  msgRef.off();
  msgRef.on("child_added", (snap) => {
    const enc = snap.val();
    if (!enc || !enc.text) return;

    // In vanish mode, client also ensures expired messages are removed (best-effort):
    if (currentMode === "vanish" && enc.time && (Date.now() - enc.time > ONE_DAY_MS)) {
      // stale, remove it
      snap.ref.remove().catch(() => {});
      return;
    }

    try {
      const bytes = CryptoJS.AES.decrypt(enc.text, currentPass);
      const plain = bytes.toString(CryptoJS.enc.Utf8);
      if (!plain) {
        logDebug("⚠️ Decryption failed (wrong passphrase or corrupt message).");
        return;
      }
      addMessage(enc.user, plain, enc.user === currentUser);
    } catch (e) {
      logDebug("❌ Error decrypting: " + (e && e.message ? e.message : e));
    }
  });

  logDebug(`✅ Joined room: ${currentRoom} (${currentMode})`);
}

function sendMessage() {
  if (!msgRef) {
    logDebug("⚠️ Not in a room.");
    return;
  }
  const box = document.getElementById("msgBox");
  const text = box.value.trim();
  if (!text) return;

  const cipher = CryptoJS.AES.encrypt(text, currentPass).toString();

  msgRef.push({
    user: currentUser,
    text: cipher,
    time: Date.now()
  }).then(() => {
    // update room lastActive
    db.ref(`rooms/${currentRoom}/meta`).update({ lastActive: Date.now() }).catch(() => {});
    // run cleanup in background (best-effort)
    runCleanup();
  }).catch((err) => {
    logDebug("❌ Send failed: " + (err && err.message ? err.message : err));
  });

  box.value = "";
}

function addMessage(user, text, isMe) {
  const div = document.createElement("div");
  div.className = "msg " + (isMe ? "me" : "other");
  div.innerHTML = `<span class="username">${escapeHtml(user)}:</span> ${escapeHtml(text)}`;
  const box = document.getElementById("messages");
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function leaveRoom() {
  if (msgRef) msgRef.off();
  msgRef = null;
  currentRoom = null;
  document.getElementById("chatPanel").style.display = "none";
  document.getElementById("joinPanel").style.display = "block";
  logDebug("🚪 Left room");
}

function clearLocalMessages() {
  document.getElementById("messages").innerHTML = "";
  logDebug("🧹 Local view cleared.");
}

// small helper to avoid XSS in UI text
function escapeHtml(s) {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// expose functions for inline onclicks
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.sendMessage = sendMessage;
window.clearLocalMessages = clearLocalMessages;
window.runCleanup = runCleanupButton;