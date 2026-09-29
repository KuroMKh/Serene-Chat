import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";
import App from "./App.vue";
import AuthView from "./views/AuthView.vue";
import DashboardView from "./views/DashboardView.vue";
import ChatRoomView from "./views/ChatRoomView.vue";

const legacyRoutes = {
  "/login.html": "/login",
  "/register.html": "/register",
  "/au.html": "/guest",
  "/vu.html": "/dashboard",
  "/room.html": "/room"
};
if (legacyRoutes[location.pathname]) history.replaceState({}, "", legacyRoutes[location.pathname] + location.search);

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/login" },
    { path: "/login", component: AuthView, props: { mode: "login" } },
    { path: "/register", component: AuthView, props: { mode: "register" } },
    { path: "/guest", component: DashboardView, props: { guest: true } },
    { path: "/dashboard", component: DashboardView, props: { guest: false } },
    { path: "/room", component: ChatRoomView },
    { path: "/:pathMatch(.*)*", redirect: "/login" }
  ]
});

router.afterEach((to) => {
  document.body.className = to.path === "/room"
    ? "chat-page"
    : to.path === "/login" || to.path === "/register"
      ? "auth-page"
      : to.path === "/guest"
        ? "dashboard-page guest-page"
        : "dashboard-page member-page";
});

createApp(App).use(router).mount("#app");
