const firebase = window.firebase;
if (!firebase?.apps?.length) throw new Error("Firebase failed to initialise");

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
export const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();

export function observeAuth(callback) {
  return auth.onAuthStateChanged(callback);
}
