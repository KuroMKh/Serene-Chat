<script setup>
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { db, observeAuth, serverTimestamp, storage } from "../services/firebase.js";

const route = useRoute(), router = useRouter();
const roomId = String(route.query.room || "").trim();
const loading = ref(true), needsLogin = ref(false), currentUser = ref(null), username = ref("");
const registered = ref(false), messages = ref([]), online = ref(0), text = ref("");
const aiText = ref("AI loading"), aiReady = ref(false), file = ref(null), previewUrl = ref(""), uploadStatus = ref("");
const showRiskLog = ref(false), riskLogs = ref([]), riskLogState = ref(""), copied = ref(false), alerts = ref([]);
const chatBox = ref(null), fileInput = ref(null);
let stopAuth, stopMessages, stopUsers, heartbeat, userRef, firstLoad = true;
const alertedIds = new Set();
const avatar = name => `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(name)}`;

onMounted(() => {
  if (!roomId) { alert("No Room ID found!"); router.replace("/dashboard"); return; }
  stopAuth = observeAuth(async user => {
    loading.value = false;
    if (!user) { needsLogin.value = true; return; }
    currentUser.value = user; registered.value = !user.isAnonymous;
    username.value = user.isAnonymous ? guestName() : (user.displayName || "User");
    if (registered.value) await db.collection("users").doc(user.uid).collection("saved_rooms").doc(roomId).set({ lastVisited: serverTimestamp() }, { merge: true });
    await startChat();
    try { await window.SereneAI.loadAI(); aiReady.value = true; aiText.value = "AI Active"; }
    catch { aiText.value = "AI Failed (Regex only)"; }
  });
});
onUnmounted(() => { stopAuth?.(); stopMessages?.(); stopUsers?.(); clearInterval(heartbeat); userRef?.delete().catch(()=>{}); if (previewUrl.value) URL.revokeObjectURL(previewUrl.value); });

function guestName() { let name = sessionStorage.getItem("anon_nick"); if (!name) { name = "Guest-" + Math.floor(Math.random()*1000); sessionStorage.setItem("anon_nick", name); } return name; }
async function startChat() {
  await window.SereneCrypto.initRoomKey(roomId);
  const id = registered.value ? currentUser.value.uid : username.value;
  userRef = db.collection("rooms").doc(roomId).collection("users").doc(id);
  const ping = () => userRef.set({ lastSeen: serverTimestamp(), name: username.value }, { merge: true }).catch(()=>{});
  ping(); heartbeat = setInterval(ping, 10000);
  stopMessages = db.collection("rooms").doc(roomId).collection("messages").orderBy("time", "desc").limit(50).onSnapshot(async snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
    for (const row of rows) {
      row.plainText = row.type === "text" && row.text ? await window.SereneCrypto.decrypt(row.text) : (row.text || "");
      row.level = row.isRisk ? (row.riskLevel || "medium") : null;
      if (row.level === "pending") row.level = null;
      row.timeText = row.time?.toDate?.().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";
      if (!firstLoad && row.isRisk && registered.value && row.user !== username.value && row.level && row.level !== "low" && !alertedIds.has(row.id)) {
        const recent = !row.time || Date.now() - row.time.toDate().getTime() < 10000;
        if (recent) { addAlert(row); alertedIds.add(row.id); }
      }
    }
    messages.value = rows; firstLoad = false;
    await nextTick(); if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
  });
  stopUsers = db.collection("rooms").doc(roomId).collection("users").onSnapshot(snap => {
    const now = Date.now(); online.value = snap.docs.filter(d => d.data().lastSeen && now - d.data().lastSeen.toDate().getTime() < 20000).length;
  });
}
async function sendMessage() {
  const value = text.value.trim(); if (!value) return; text.value = "";
  try {
    const encrypted = await window.SereneCrypto.encrypt(value);
    const doc = await db.collection("rooms").doc(roomId).collection("messages").add({ user: username.value, text: encrypted, type: "text", verified: registered.value, isRisk: false, riskLevel: "pending", riskScore: null, time: serverTimestamp() });
    window.SereneAI.analyzeRisk(value).then(a => doc.update({ isRisk: a.isRisk, riskLevel: a.riskLevel, riskScore: a.finalScore })).catch(console.warn);
  } catch (e) { alert("Message failed: " + e.message); text.value = value; }
}
function selectFile(event) { const chosen = event.target.files?.[0]; event.target.value = ""; if (!chosen) return; file.value = chosen; previewUrl.value = URL.createObjectURL(chosen); }
function cancelUpload() { if (previewUrl.value) URL.revokeObjectURL(previewUrl.value); file.value = null; previewUrl.value = ""; uploadStatus.value = ""; }
function confirmUpload() {
  if (!file.value) return; uploadStatus.value = "Uploading… 0%";
  const task = storage.ref(`chat_images/${roomId}/${Date.now()}_${file.value.name}`).put(file.value);
  task.on("state_changed", s => uploadStatus.value = `Uploading… ${Math.round(s.bytesTransferred/s.totalBytes*100)}%`, e => { alert("Upload failed: " + e.message); cancelUpload(); }, async () => {
    const url = await task.snapshot.ref.getDownloadURL();
    await db.collection("rooms").doc(roomId).collection("messages").add({ user: username.value, imageUrl: url, text: "Image", type: "image", verified: registered.value, time: serverTimestamp() }); cancelUpload();
  });
}
async function requestPrivate(target) { if (!confirm(`Start a private session with ${target}?`)) return; const privateRoomId = "private-" + Math.random().toString(36).slice(2,12); await db.collection("rooms").doc(roomId).collection("messages").add({ user: username.value, targetUser: target, privateRoomId, type: "invite", verified: registered.value, isRisk: false, time: serverTimestamp() }); router.push({ path: "/room", query: { room: privateRoomId } }); }
function addAlert(row) { alerts.value.push({ id: row.id, user: row.user, text: row.plainText }); if (Notification.permission === "granted") new Notification("RISK ALERT", { body: `${row.user}: ${row.plainText}` }); setTimeout(() => alerts.value = alerts.value.filter(a => a.id !== row.id), 20000); }
async function requestNotifications() { if ("Notification" in window) await Notification.requestPermission(); }
async function copyLink() { await navigator.clipboard.writeText(location.href); copied.value = true; setTimeout(() => copied.value = false, 2000); }
async function openRiskLog() {
  showRiskLog.value = true; riskLogs.value = []; riskLogState.value = "Fetching secure logs…";
  try {
    const snap = await db.collection("rooms").doc(roomId).collection("messages").where("isRisk", "==", true).orderBy("time", "desc").limit(30).get();
    for (const doc of snap.docs) {
      const d = doc.data(), plainText = d.text ? await window.SereneCrypto.decrypt(d.text) : "(no text)";
      let level = d.riskLevel, score = d.riskScore;
      if (!level || level === "pending" || score == null) { const a = await window.SereneAI.analyzeRisk(plainText); level = a.riskLevel === "none" ? "medium" : a.riskLevel; score = a.finalScore; }
      riskLogs.value.push({ id: doc.id, user: d.user, plainText, level, score: Number.isFinite(score) ? `${(score*100).toFixed(1)}%` : "N/A", time: d.time?.toDate?.().toLocaleString([], { dateStyle: "short", timeStyle: "short" }) || "Unknown Time" });
    }
    riskLogState.value = snap.empty ? "No flagged messages in this room." : "";
  } catch (e) { console.error(e); riskLogState.value = "Database error. A Firestore composite index may be required."; }
}
function goBack() { router.push(currentUser.value?.isAnonymous ? "/guest" : "/dashboard"); }
</script>

<template>
  <button v-if="registered && 'Notification' in window && Notification.permission === 'default'" id="enableNotifyBtn" style="display:block" @click="requestNotifications"><i class="fa-solid fa-bell" aria-hidden="true"></i> Enable Alerts</button>
  <div id="riskAlertOverlay" :style="{display: alerts.length ? 'flex' : 'none'}"><div v-for="alert in alerts" :key="alert.id" class="alert-card"><div class="alert-header"><span><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Potential Risk Detected</span><button class="alert-close icon-button" aria-label="Close alert" @click="alerts = alerts.filter(a => a.id !== alert.id)"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div><div class="alert-body"><strong>User:</strong> {{ alert.user }}<br><strong>Message:</strong> "{{ alert.text }}"</div><div class="alert-actions"><button class="btn-dismiss" @click="alerts = alerts.filter(a => a.id !== alert.id)">Dismiss</button></div></div></div>
  <div v-if="loading" id="loadingOverlay" class="overlay" style="display:flex"><div class="spinner"></div><p class="loading-text">Connecting to room…</p></div>
  <div v-if="needsLogin" id="loginOverlay" class="overlay" style="display:flex"><div class="overlay-card"><div class="login-lock-icon"><i class="fa-solid fa-lock" aria-hidden="true"></i></div><h2>Sign In Required</h2><p>You need to sign in to join this chat room.</p><button class="btn-large" @click="router.push({path:'/login',query:{room:roomId}})">Go to Login</button></div></div>
  <div v-if="previewUrl" id="previewOverlay" class="overlay" style="display:flex"><div class="overlay-card preview-card"><h3 class="preview-title">Send this image?</h3><img id="previewImage" :src="previewUrl" alt="Preview"><div class="preview-actions"><button class="preview-btn btn-cancel" @click="cancelUpload">Cancel</button><button class="preview-btn btn-confirm" @click="confirmUpload">Send ↑</button></div><div id="uploadStatus">{{ uploadStatus }}</div></div></div>
  <div v-if="showRiskLog" id="riskLogOverlay" class="overlay" style="display:flex"><div class="overlay-card risk-log-card"><div class="risk-log-header"><h2 class="risk-log-title"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Flagged History</h2><button class="risk-log-close" aria-label="Close flagged history" @click="showRiskLog=false"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div><div id="riskLogContent"><p v-if="riskLogState" class="risk-log-state">{{ riskLogState }}</p><div v-for="log in riskLogs" :key="log.id" class="log-item"><div class="log-meta"><span><i class="fa-solid fa-user" aria-hidden="true"></i> {{ log.user }} <span :class="`risk-level-badge risk-level-${log.level}`">{{ log.level.toUpperCase() }} · {{ log.score }}</span></span><span class="log-time">{{ log.time }}</span></div><div class="log-message">"{{ log.plainText }}"</div></div></div></div></div>
  <div class="chat-wrapper"><header class="chat-header"><button class="back-btn" aria-label="Back" @click="goBack"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button><div class="room-avatar-wrap"><div class="room-avatar"><i class="fa-solid fa-comments" aria-hidden="true"></i></div><div class="online-indicator"></div></div><div class="header-info"><div class="header-room-name">{{ roomId }}</div><div class="header-sub"><span>{{ online }} online</span><div class="ai-pill"><div class="status-dot" :class="aiReady ? 'status-ready' : 'status-loading'"></div><span>{{ aiText }}</span></div></div></div><button v-if="registered" class="copy-btn" @click="openRiskLog"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Log</button><button class="copy-btn" @click="copyLink"><i :class="copied ? 'fa-solid fa-check' : 'fa-solid fa-link'" aria-hidden="true"></i> {{ copied ? 'Copied!' : 'Copy Link' }}</button></header>
    <div ref="chatBox" id="chatBox"><div v-for="(msg,index) in messages" :key="msg.id" class="message" :class="[msg.user === username ? 'own' : 'other', registered && msg.level ? `risk-flagged risk-${msg.level}` : '', index && messages[index-1].user === msg.user ? 'grouped' : '']"><div class="sender"><img class="avatar" :src="avatar(msg.user)" alt="User"><span v-if="!registered && msg.verified && msg.user !== username" class="clickable-sender" @click="requestPrivate(msg.user)">{{ msg.user }}</span><span v-else>{{ msg.user === username ? 'You' : msg.user }}</span><span v-if="msg.verified" class="verified-badge"><i class="fa-solid fa-circle-check" aria-label="Verified"></i></span></div><div class="msg-content"><img v-if="msg.type === 'image' || msg.imageUrl" :src="msg.imageUrl" class="chat-image" @click="window.open(msg.imageUrl,'_blank')"><div v-else-if="msg.type === 'invite'" class="invite-box"><strong><i class="fa-solid fa-lock" aria-hidden="true"></i> Private Session Request</strong><br><span class="invite-meta">From: {{ msg.user }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i> To: {{ msg.targetUser }}</span><button v-if="msg.targetUser === username || msg.user === username" class="btn-join-private" @click="router.push({path:'/room',query:{room:msg.privateRoomId}})">Join Private Room <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button><span v-else class="invite-restricted">Only {{ msg.targetUser }} can join.</span></div><template v-else>{{ msg.plainText }}</template></div><div class="msg-time">{{ msg.timeText }}</div></div></div>
    <footer class="chat-footer"><input id="imageInput" ref="fileInput" type="file" accept="image/*" @change="selectFile"><button class="footer-icon-btn" title="Send image" aria-label="Send image" @click="fileInput.click()"><i class="fa-solid fa-camera" aria-hidden="true"></i></button><input id="msgInput" v-model="text" placeholder="Type a message…" @keydown.enter.prevent="sendMessage"><button class="send-btn" aria-label="Send message" @click="sendMessage"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button></footer>
  </div>
</template>
