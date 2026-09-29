<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { auth, db, observeAuth } from "../services/firebase.js";

const props = defineProps({ guest: Boolean });
const router = useRouter();
const loading = ref(true), user = ref(null), roomInput = ref(""), rooms = ref([]);
let stopAuth, stopRooms;
const roomIcons = ["fa-seedling", "fa-dove", "fa-water", "fa-spa", "fa-sun", "fa-moon", "fa-leaf", "fa-clover", "fa-heart", "fa-cloud"];
const avatar = uid => `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(uid)}`;

onMounted(() => {
  stopAuth = observeAuth(current => {
    loading.value = false;
    if (!current) return router.replace("/login");
    if (props.guest !== current.isAnonymous) return router.replace(current.isAnonymous ? "/guest" : "/dashboard");
    user.value = current;
    if (!props.guest) loadRooms(current.uid);
  });
});
onUnmounted(() => { stopAuth?.(); stopRooms?.(); });
function loadRooms(uid) {
  stopRooms = db.collection("users").doc(uid).collection("saved_rooms").orderBy("lastVisited", "desc").limit(15).onSnapshot(s => {
    rooms.value = s.docs.map(d => ({ id: d.id, ...d.data(), icon: roomIcons[d.id.charCodeAt(0) % roomIcons.length] }));
  });
}
function createRoom() { router.push({ path: "/room", query: { room: Math.random().toString(36).slice(2,8) + "-" + Math.random().toString(36).slice(2,6) } }); }
function joinRoom() { const room = roomInput.value.trim(); room ? router.push({ path: "/room", query: { room } }) : alert("Please enter a room name or code first."); }
async function renameRoom(event, room) { event.stopPropagation(); const name = prompt("Enter a new name for this room:", room.customName || ""); if (name?.trim()) await db.collection("users").doc(user.value.uid).collection("saved_rooms").doc(room.id).update({ customName: name.trim() }); }
async function deleteRoom(event, room) { event.stopPropagation(); if (confirm("Are you sure you want to remove this room from your history?")) await db.collection("users").doc(user.value.uid).collection("saved_rooms").doc(room.id).delete(); }
async function signOut() { await auth.signOut(); router.replace("/login"); }
</script>

<template>
  <div v-if="loading" class="overlay" style="display:flex"><div class="spinner"></div><p class="loading-text">Loading…</p></div>
  <div v-if="user" class="wrap" style="display:block">
    <div class="greeting"><div class="greeting-row"><div><div class="hello">Hello,</div><h1>{{ props.guest ? 'Guest' : (user.displayName || 'User') }} <i class="fa-solid fa-hand" aria-hidden="true"></i></h1></div><div class="avatar-circle"><img :src="avatar(user.uid)" alt="avatar"></div></div></div>
    <div v-if="props.guest" class="guest-banner"><div class="guest-banner-icon"><i class="fa-solid fa-user" aria-hidden="true"></i></div><div class="guest-banner-text"><strong>You're browsing as a Guest</strong><span>Sign up to save rooms &amp; chat history</span></div><button class="guest-banner-btn" @click="router.push('/register')">Sign Up</button></div>
    <div v-else class="user-card"><div class="uc-avatar"><img :src="avatar(user.uid)" alt=""></div><div class="uc-info"><div class="uc-name">{{ user.displayName || 'User' }}</div><div class="uc-email">{{ user.email }}</div><div class="uc-badge"><div class="uc-dot"></div> Verified Member</div></div><button class="logout-btn" @click="signOut">Sign Out</button></div>
    <div class="search-bar"><span class="search-icon"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></span><input v-model="roomInput" placeholder="Search or enter room code…" @keydown.enter="joinRoom"></div>
    <template v-if="!props.guest">
      <div v-if="rooms.length" id="roomsSection"><div class="section-label">Recent Rooms</div><div id="roomList"><div v-for="room in rooms" :key="room.id" class="room-item" @click="router.push({path:'/room',query:{room:room.id}})"><div class="room-avatar"><i :class="['fa-solid', room.icon]" aria-hidden="true"></i></div><div class="room-info"><div class="room-name">{{ room.customName?.trim() || `Room: ${room.id}` }}</div><div class="room-sub">{{ room.customName?.trim() ? `ID: ${room.id}` : 'Tap to enter' }}</div></div><div class="room-actions"><button class="delete-btn" title="Delete Room" @click="deleteRoom($event, room)"><i class="fa-solid fa-trash" aria-hidden="true"></i></button><button class="edit-btn" title="Rename Room" @click="renameRoom($event, room)"><i class="fa-solid fa-pen" aria-hidden="true"></i></button><span class="go-arrow"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span></div></div></div></div>
      <div v-else class="empty-state" style="display:block"><div class="es-icon"><i class="fa-solid fa-comments" aria-hidden="true"></i></div><p>No rooms yet!<br>Use the + button to create a room, or search a code above to join one.</p></div>
    </template>
    <div v-else class="no-history-note"><div class="note-icon"><i class="fa-solid fa-folder-open" aria-hidden="true"></i></div><p>Guest sessions don't save room history.<br>Use the + button to create a new room.</p></div>
    <div v-if="props.guest" class="exit-link"><a href="#" @click.prevent="signOut">Exit guest session</a></div>
  </div>
  <button v-if="user" class="fab" title="New Room" aria-label="Create new room" @click="createRoom"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
</template>
