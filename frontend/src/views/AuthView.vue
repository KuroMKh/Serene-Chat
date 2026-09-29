<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import googleIcon from "@iconify-icons/logos/google-icon";
import facebookIcon from "@iconify-icons/logos/facebook";
import appleIcon from "@iconify-icons/logos/apple";
import { auth, observeAuth } from "../services/firebase.js";

const props = defineProps({ mode: { type: String, required: true } });
const route = useRoute();
const router = useRouter();
const email = ref("");
const password = ref("");
const displayName = ref("");
const error = ref("");
const currentUser = ref(null);
const busy = ref(false);
const showPassword = ref(false);
const isLogin = computed(() => props.mode === "login");
let unsubscribe;

onMounted(async () => {
  unsubscribe = observeAuth(user => { currentUser.value = user; });
  try {
    const result = await auth.getRedirectResult();
    if (result.user) await router.replace(destination(result.user));
  } catch (e) { error.value = authErrorMessage(e); }
});
onUnmounted(() => unsubscribe?.());

function destination(user) {
  if (route.query.room) return { path: "/room", query: { room: route.query.room } };
  return user?.isAnonymous ? "/guest" : "/dashboard";
}

async function submit() {
  error.value = "";
  if (!email.value || !password.value || (!isLogin.value && !displayName.value.trim())) {
    error.value = "Please fill in all fields.";
    return;
  }
  busy.value = true;
  try {
    if (isLogin.value) {
      const result = await auth.signInWithEmailAndPassword(email.value, password.value);
      await router.push(destination(result.user));
    } else {
      const result = await auth.createUserWithEmailAndPassword(email.value, password.value);
      await result.user.updateProfile({ displayName: displayName.value.trim() });
      await router.push(destination(result.user));
    }
  } catch (e) {
    error.value = isLogin.value ? "Invalid email or password. Please try again." : e.message;
  } finally { busy.value = false; }
}

async function guestLogin() {
  busy.value = true;
  error.value = "";
  try {
    const result = await auth.signInAnonymously();
    await router.push(destination(result.user));
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}

function createSocialProvider(providerName) {
  if (providerName === "google") {
    const provider = new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return provider;
  }
  if (providerName === "facebook") {
    const provider = new window.firebase.auth.FacebookAuthProvider();
    provider.addScope("email");
    return provider;
  }
  const provider = new window.firebase.auth.OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return provider;
}

function authErrorMessage(e) {
  if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") return "Sign-in window was closed before completion.";
  if (e?.code === "auth/account-exists-with-different-credential") return "An account already exists with this email using a different sign-in method.";
  if (e?.code === "auth/operation-not-allowed") return "This sign-in provider has not been enabled in Firebase Console yet.";
  if (e?.code === "auth/unauthorized-domain") return "This domain is not authorised in Firebase Authentication settings.";
  return e?.message || "Unable to sign in. Please try again.";
}

async function socialLogin(providerName) {
  busy.value = true;
  error.value = "";
  const provider = createSocialProvider(providerName);
  try {
    const result = await auth.signInWithPopup(provider);
    await router.push(destination(result.user));
  } catch (e) {
    if (e?.code === "auth/popup-blocked" || e?.code === "auth/operation-not-supported-in-this-environment") {
      await auth.signInWithRedirect(provider);
      return;
    }
    error.value = authErrorMessage(e);
  } finally { busy.value = false; }
}

async function signOut() {
  await auth.signOut();
  currentUser.value = null;
}
</script>

<template>
  <main class="auth-shell">
    <section class="auth-welcome" aria-label="Welcome to Serene Chat">
      <div class="welcome-orb welcome-orb-one"></div>
      <div class="welcome-orb welcome-orb-two"></div>
      <div class="welcome-content">
        <div class="auth-mark" role="img" aria-label="Serene Chat logo"></div>
        <p class="welcome-kicker">SERENE CHAT</p>
        <h1>{{ isLogin ? "Welcome back." : "A calmer place to connect." }}</h1>
        <p>{{ isLogin ? "Continue your conversations in a space designed to feel safe and simple." : "Create an account to save rooms, revisit conversations and stay connected." }}</p>
        <div class="trust-row"><span><i class="fa-solid fa-lock" aria-hidden="true"></i> Private rooms</span><span><i class="fa-solid fa-leaf" aria-hidden="true"></i> Thoughtful spaces</span></div>
      </div>
    </section>

    <section class="auth-panel">
      <div class="mobile-brand"><div class="mobile-mark" role="img" aria-label="Serene Chat logo"></div><span>Serene Chat</span></div>

      <div v-if="currentUser && isLogin" class="auth-state">
        <div class="success-icon"><i class="fa-solid fa-check" aria-hidden="true"></i></div>
        <h2>You're already signed in</h2>
        <p>Continue straight to your conversations.</p>
        <button class="auth-primary" @click="router.push(destination(currentUser))">Continue to app <span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></button>
        <button class="auth-secondary" @click="signOut">Sign out</button>
      </div>

      <form v-else class="auth-form" @submit.prevent="submit">
        <div class="form-heading">
          <p class="eyebrow">{{ isLogin ? "WELCOME BACK" : "GET STARTED" }}</p>
          <h2>{{ isLogin ? "Sign in to Serene" : "Create your account" }}</h2>
          <p>{{ isLogin ? "Enter your details to continue." : "It only takes a minute to join." }}</p>
        </div>

        <div v-if="error" class="auth-error" role="alert">{{ error }}</div>

        <div v-if="!isLogin" class="auth-field">
          <label for="displayName">Full name</label>
          <div class="input-shell"><span><i class="fa-solid fa-user" aria-hidden="true"></i></span><input id="displayName" v-model="displayName" type="text" autocomplete="name" placeholder="Enter your name"></div>
        </div>

        <div class="auth-field">
          <label for="email">Email address</label>
          <div class="input-shell"><span><i class="fa-solid fa-envelope" aria-hidden="true"></i></span><input id="email" v-model="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com"></div>
        </div>

        <div class="auth-field">
          <div class="field-label-row"><label for="password">Password</label><span v-if="!isLogin">At least 6 characters</span></div>
          <div class="input-shell"><span><i class="fa-solid fa-key" aria-hidden="true"></i></span><input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" :autocomplete="isLogin ? 'current-password' : 'new-password'" :placeholder="isLogin ? 'Enter your password' : 'Create a password'"><button type="button" class="show-password" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword"><i :class="showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" aria-hidden="true"></i></button></div>
        </div>

        <button class="auth-primary" :disabled="busy">{{ busy ? "Please wait…" : isLogin ? "Sign in" : "Create account" }} <span v-if="!busy"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></button>

        <div class="auth-divider"><span>or continue with</span></div>
        <div class="social-grid" aria-label="Social sign in options">
          <button type="button" class="social-button social-google" :disabled="busy" @click="socialLogin('google')"><Icon :icon="googleIcon" aria-hidden="true" /><span>Google</span></button>
          <button type="button" class="social-button social-facebook" :disabled="busy" @click="socialLogin('facebook')"><Icon :icon="facebookIcon" aria-hidden="true" /><span>Facebook</span></button>
          <button type="button" class="social-button social-apple" :disabled="busy" @click="socialLogin('apple')"><Icon :icon="appleIcon" aria-hidden="true" /><span>Apple</span></button>
        </div>

        <button v-if="isLogin" type="button" class="guest-button" :disabled="busy" @click="guestLogin"><i class="fa-solid fa-user-secret" aria-hidden="true"></i> Continue as guest</button>

        <p class="auth-switch">{{ isLogin ? "New to Serene?" : "Already have an account?" }} <router-link :to="{ path: isLogin ? '/register' : '/login', query: route.query }">{{ isLogin ? "Create account" : "Sign in" }}</router-link></p>
      </form>
    </section>
  </main>
</template>
