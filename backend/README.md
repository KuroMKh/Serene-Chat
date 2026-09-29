# Backend

The production backend is currently provided entirely by managed Firebase
services. This directory documents that boundary and is the home for future
server-owned resources such as Firestore rules, Storage rules, indexes, and
Cloud Functions.

## Services

- Firebase Authentication: email/password and anonymous sessions.
- Cloud Firestore: rooms, messages, presence, and saved-room history.
- Cloud Storage: uploaded chat images.

## Firestore data model

```text
rooms/{roomId}/messages/{messageId}
rooms/{roomId}/users/{userIdOrGuestName}
users/{uid}/saved_rooms/{roomId}
```

At present the browser writes directly to these services. Firebase configuration
in `frontend/public/js/firebase-config.js` is public client configuration, not a
server secret. Access control must therefore be enforced by deployed Firestore
and Storage Security Rules.

Security rules are not currently tracked in this repository. They should be
exported and reviewed before adding Cloud Functions or treating this application
as production-ready.
