# EnglishBuddy privacy

EnglishBuddy runs inside Anna. It does not require a separate account, model API key, custom Executa, or third-party analytics service.

When you send a message, the app sends the latest conversation context, practice topic, selected English level, and language-note preference to Anna's Host LLM API. Anna routes that request through the models and quota available to your account. The app does not contact model providers directly.

Your saved conversations, optional language notes, expressions, and preferences are stored in your private per-user, per-app Anna Persistent Storage bucket. Hosted data is not silently copied to browser localStorage. A standalone local preview uses localStorage only on that preview's origin and cannot run real AI chat.

The app includes no advertising or custom tracking. It requests no microphone, camera, email, contacts, filesystem, or cross-app storage access. It does not send messages to other people.

You can export your practice as JSON from Preferences, delete individual conversations, and remove expressions from your phrasebook. Deleting a conversation keeps expressions you explicitly saved from it; remove those separately if you want to delete them too. Anna manages its own account data, model processing, backups, retention, and platform logs under Anna's privacy policy.

Avoid sharing passwords or other information you do not want processed by Anna's AI. For app support, use the repository Issues link and describe the problem without posting private chat text or credentials.

Maintainer: [cartoontv1152-arch](https://github.com/cartoontv1152-arch).
