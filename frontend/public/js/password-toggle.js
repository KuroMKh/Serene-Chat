if (window.lucide) {
  window.lucide.createIcons();
} else {
  console.warn("Lucide icons failed to load from the CDN.");
}

function togglePassword(button) {
  const inputId = button.getAttribute("aria-controls");
  const input = document.getElementById(inputId);
  if (!input) return;

  const shouldShow = input.type === "password";
  input.type = shouldShow ? "text" : "password";
  button.setAttribute("aria-pressed", String(shouldShow));
  button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
  input.focus({ preventScroll: true });
}
