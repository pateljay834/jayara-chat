/* apps.js - Jayara Chat (robust rewrite)
   Key ideas:
   - Firebase paths:
     /rooms/{room}/storage/{msgId}
     /rooms/{room}/vanish/{msgId}
   - Storage messages are stored locally (IndexedDB) with firebaseId to avoid duplicates
   - Vanish messages are ONLY in Firebase (transient) and displayed in DOM (not saved locally)
   - Listeners are attached/detached safely on join/leave
*/

///// Firebase config (use your config)
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

///// App state
let username = "";
let currentRoom = "";
let passphrase = "";
let mode = "storage";

let localDB = null;          // IndexedDB instance
let storageListener = null;  // firebase ref for storage path
let vanishListener = null;   // firebase ref for vanish path

///// IndexedDB setup
function openDB(callback) {
  const req = indexedDB.open("JayaraChat_v2", 1);
  req.onupgradeneeded = (e) => {
    const idb = e.target.result;
    if (!idb.objectStoreNames.contains("messages")) {
      const store = idb.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
      store.createIndex("byRoom", "room", { unique: false });
      store.createIndex("byFirebaseId", "firebaseId", { unique: true });
    }
  };
  req.onsuccess = (e) => {
    localDB = e.target.result;
    if (callback) callback();
  };
  req.onerror = () => {
    console.error("IndexedDB open failed");
    alert("Local database unavailable");
  };
}

///// Helpers - encryption (AES via CryptoJS using passphrase)
function encryptText(plaintext) {
  return CryptoJS.AES.encrypt(plaintext, passphrase).toString();
}
function decryptText(cipher) {
  try { return CryptoJS.AES.decrypt(cipher, passphrase).toString(CryptoJS.enc.Utf8); }
  catch (e) { return "[decrypt error]"; }
}

///// UI helpers
function $(id){ return document.getElementById(id); }
function showPanel(joined) {
  $("joinPanel").style.display = joined ? "none" : "block";
  $("chatPanel").style.display = joined ? "block" : "none";
  if (joined) {
    $("roomLabel").textContent = currentRoom;
    $("modeBadge").textContent = mode.toUpperCase();
    $("modeBadge").className = "badge";
    $("clearBtn").style.display = (mode === "storage") ? "inline-block" : "none";
  } else {
    $("roomLabel").textContent = "";
    $("modeBadge").textContent = "";
    $("clearBtn").style.display = "none";
  }
}

///// Join/leave
function joinRoom() {
  username = $("username").value.trim();
  currentRoom = $("room").value.trim();
  passphrase = $("passphrase").value;
  mode = $("mode").value;

  if (!username || !currentRoom || !passphrase) {
    alert("Please fill name, room and passphrase");
    return;
  }

  // initialize DB then attach listeners
  openDB(() => {
    // leave any previous listeners
    leaveRoom(true);
    showPanel(true);
    attachListeners();
    // initial display of local storage messages (storage mode)
    renderLocalMessages();
  });
}

function leaveRoom(silent=false) {
  // detach firebase listeners if any
  if (storageListener) {
    storageListener.off();
    storageListener = null;
  }
  if (vanishListener) {
    vanishListener.off();
    vanishListener = null;
  }

  // clear transient vanish DOM (but keep local storage)
  clearVanishDom();

  // Reset UI and state
  if (!silent) {
    showPanel(false);
    // keep localDB open for next join
  } else {
    showPanel(false);
  }
  currentRoom = "";
  passphrase = "";
  username = "";
}

///// Firebase paths helpers
function storagePath() { return `rooms/${currentRoom}/storage`; }
function vanishPath()  { return `rooms/${currentRoom}/vanish`; }

///// Send a message (storage or vanish)
function sendMessage() {
  const input = $("msgBox");
  const text = input.value.trim();
  if (!text) return;

  // prepare message
  const msgObj = {
    senderName: username,
    ciphertext: encryptText(text),
    timestamp: Date.now()
  };

  if (mode === "storage") {
    // push to storage path and include firebaseId to dedupe
    const ref = db.ref(storagePath()).push();
    msgObj.firebaseId = ref.key;
    ref.set(msgObj)
      .then(() => { /* ok */ })
      .catch(err => console.error("firebase set error", err));

    // store locally immediately using firebaseId to avoid duplication later
    storeLocalMessage({
      firebaseId: msgObj.firebaseId,
      room: currentRoom,
      mode: "storage",
      senderName: username,
      text: text,
      timestamp: msgObj.timestamp
    });

  } else { // vanish
    const ref = db.ref(vanishPath()).push();
    msgObj.firebaseId = ref.key;
    msgObj.vanish = true;
    ref.set(msgObj)
      .then(() => {})
      .catch(err => console.error("firebase set error", err));
    // Do NOT store vanish locally
  }

  input.value = "";
}

///// Attach firebase listeners (safe)
function attachListeners() {
  // storage listener
  const sRef = db.ref(storagePath());
  storageListener = sRef;
  // ensure only one child_added listener by calling off() first
  sRef.off();
  sRef.on("child_added", snap => {
    const data = snap.val();
    if (!data || !data.firebaseId) return;

    // decrypt
    const plain = decryptText(data.ciphertext);

    // only store locally if not already present (dedupe by firebaseId)
    if (localDB) {
      checkLocalHasFirebaseId(data.firebaseId).then(has => {
        if (!has) {
          storeLocalMessage({
            firebaseId: data.firebaseId,
            room: currentRoom,
            mode: "storage",
            senderName: data.senderName || "unknown",
            text: plain,
            timestamp: data.timestamp || Date.now()
          });
        } else {
          // already present; just refresh UI (other devices may have changed)
          renderLocalMessages();
        }
      });
    }
  });

  // vanish listener
  const vRef = db.ref(vanishPath());
  vanishListener = vRef;
  vRef.off();
  vRef.on("child_added", snap => {
    const data = snap.val();
    if (!data) return;
    const plain = decryptText(data.ciphertext);
    // display transiently in DOM (not stored)
    renderVanishMessage({
      firebaseId: data.firebaseId || snap.key,
      senderName: data.senderName || "unknown",
      text: plain,
      timestamp: data.timestamp || Date.now()
    });

    // schedule server-side-like cleanup: if older than 24h, remove; also set timeout to remove from DOM
    const age = Date.now() - (data.timestamp || Date.now());
    if (age > 24*60*60*1000) {
      snap.ref.remove().catch(()=>{});
    } else {
      // ensure it will be removed from server after 24h if not already removed by other clients
      // (client-side cleanup loop below will handle periodic removal)
    }
  });
}

///// Local storage helpers (IndexedDB) - store object format:
/// { firebaseId, room, mode, senderName, text, timestamp }

function checkLocalHasFirebaseId(firebaseId) {
  return new Promise((resolve) => {
    if (!localDB) return resolve(false);
    const tx = localDB.transaction(["messages"], "readonly");
    const store = tx.objectStore("messages");
    const index = store.index("byFirebaseId");
    const req = index.get(firebaseId);
    req.onsuccess = (e) => resolve(!!e.target.result);
    req.onerror = () => resolve(false);
  });
}

function storeLocalMessage(msg) {
  // msg must include: firebaseId (optional for local-only), room, mode ("storage"), senderName, text, timestamp
  if (!localDB) return;
  if (!msg.room || msg.mode !== "storage") return; // only store storage-mode locally

  // dedupe by firebaseId if present
  if (msg.firebaseId) {
    checkLocalHasFirebaseId(msg.firebaseId).then(has => {
      if (has) {
        renderLocalMessages();
        return;
      }
      const tx = localDB.transaction(["messages"], "readwrite");
      const store = tx.objectStore("messages");
      store.add(msg);
      tx.oncomplete = () => renderLocalMessages();
    });
  } else {
    // local-only (shouldn't happen for storage messages in our flow) but handle anyway
    const tx = localDB.transaction(["messages"], "readwrite");
    const store = tx.objectStore("messages");
    store.add(msg);
    tx.oncomplete = () => renderLocalMessages();
  }
}

function fetchLocalMessagesForRoomAndMode(room, curMode) {
  return new Promise((resolve) => {
    if (!localDB) return resolve([]);
    const tx = localDB.transaction(["messages"], "readonly");
    const store = tx.objectStore("messages");
    const req = store.getAll();
    req.onsuccess = (e) => {
      const all = e.target.result || [];
      const filtered = all.filter(m => m.room === room && m.mode === curMode);
      filtered.sort((a,b)=> (a.timestamp||0) - (b.timestamp||0));
      resolve(filtered);
    };
    req.onerror = () => resolve([]);
  });
}

function deleteLocalById(id) {
  if (!localDB) return;
  const tx = localDB.transaction(["messages"], "readwrite");
  tx.objectStore("messages").delete(id);
  tx.oncomplete = () => renderLocalMessages();
}

function clearLocalStorageForRoom() {
  if (!localDB) return;
  const tx = localDB.transaction(["messages"], "readwrite");
  const store = tx.objectStore("messages");
  const req = store.getAll();
  req.onsuccess = (e) => {
    const all = e.target.result || [];
    all.forEach(item => {
      if (item.room === currentRoom && item.mode === "storage") store.delete(item.id);
    });
    tx.oncomplete = () => renderLocalMessages();
  };
}

///// Rendering

// render storage messages from IndexedDB
function renderLocalMessages() {
  fetchLocalMessagesForRoomAndMode(currentRoom, "storage").then(list => {
    const container = $("messages");
    // remove stored message nodes (we will rebuild storage list). But keep vanish nodes in place (they are transient DOM nodes we add separately)
    // We'll create a marker wrapper for storage messages to make clearing easier
    // strategy: clear entire container and re-add vanish transient nodes after (we will keep a small queue of vanish entries)
    container.innerHTML = "";
    // First render storage messages
    list.forEach(m => {
      const node = document.createElement("div");
      node.className = "msg " + ((m.senderName === username) ? "me" : "other");
      node.dataset.localId = m.id;
      node.innerHTML = `<div class="meta"><strong>${escapeHtml(m.senderName)}</strong></div>
                        <div class="body">${escapeHtml(m.text)}</div>`;
      // add delete button for storage messages
      const del = document.createElement("button");
      del.className = "del";
      del.title = "Delete local message";
      del.innerText = "🗑️";
      del.onclick = (e) => { e.stopPropagation(); deleteLocalById(m.id); };
      node.appendChild(del);
      container.appendChild(node);
    });

    // After storage messages, also append currently visible vanish messages (if any)
    // vanish DOM nodes are tracked in vanishDomMap; append them after storage messages so vanish appears inline with storage.
    for (const vid of Object.keys(vanishDomMap)) {
      const vNode = vanishDomMap[vid];
      if (vNode && !container.contains(vNode)) container.appendChild(vNode);
    }

    container.scrollTop = container.scrollHeight;
  });
}

// transient vanish DOM nodes map (keyed by firebaseId)
const vanishDomMap = {};

// render one transient vanish message (visible only in DOM, not saved)
function renderVanishMessage(msg) {
  // create DOM node
  const node = document.createElement("div");
  node.className = "msg " + ((msg.senderName === username) ? "me" : "other");
  node.innerHTML = `<div class="meta"><strong>${escapeHtml(msg.senderName)}</strong>
                    <span class="vanish-marker">VANISH</span></div>
                    <div class="body">${escapeHtml(msg.text)}</div>`;
  // add to map and DOM
  vanishDomMap[msg.firebaseId] = node;
  $("messages").appendChild(node);
  $("messages").scrollTop = $("messages").scrollHeight;

  // remove DOM node after visible lifetime (for UI, choose 2 minutes) — message on server will be deleted after 24h
  setTimeout(() => {
    if (vanishDomMap[msg.firebaseId]) {
      const n = vanishDomMap[msg.firebaseId];
      if (n.parentNode) n.parentNode.removeChild(n);
      delete vanishDomMap[msg.firebaseId];
    }
  }, 2 * 60 * 1000); // 2 minutes visible on client
}

function clearVanishDom() {
  for (const key in vanishDomMap) {
    const n = vanishDomMap[key];
    if (n && n.parentNode) n.parentNode.removeChild(n);
  }
  for (const k in vanishDomMap) delete vanishDomMap[k];
}

///// Utility
function escapeHtml(s) {
  if (!s && s !== "") return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// periodic server-side-like cleanup client: remove vanish messages older than 24h (best-effort)
setInterval(() => {
  if (!currentRoom) return;
  const vRef = db.ref(vanishPath());
  vRef.once("value").then(snap => {
    snap.forEach(child => {
      const m = child.val();
      if (m && m.timestamp && (Date.now() - m.timestamp > 24*60*60*1000)) {
        child.ref.remove().catch(()=>{});
      }
    });
  }).catch(()=>{});
}, 60*60*1000); // every hour

// Helper to build vanishPath/storagePath used above
function storagePath(){ return `rooms/${currentRoom}/storage`; }
function vanishPath(){ return `rooms/${currentRoom}/vanish`; }

///// Clear local storage (UI)
function clearLocalMessages() { clearLocalStorageForRoom(); }

///// Expose some functions to global (for buttons)
window.joinRoom = joinRoom;
window.leaveRoom = () => { leaveRoom(); };
window.sendMessage = sendMessage;
window.clearLocalMessages = clearLocalMessages;

// On load, ensure DB is opened so UI is responsive
openDB();