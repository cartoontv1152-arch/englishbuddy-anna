# EnglishBuddy for Anna

Friendly English conversation practice that opens directly into a new chat. Type your own message or click a starter to send it immediately to Anna AI. Previous conversations stay in history.

EnglishBuddy offers short conversational replies, one optional language note at a time, and a personal phrasebook. Save an expression from a reply, search it later, or use **Practise this** to bring it into a new conversation. Choose Beginner, Everyday, or Confident English without an onboarding form.

## Architecture

- Static JavaScript SPA with locally bundled Geist and Phosphor assets.
- Anna manifest schema 3, with direct Host `llm.complete` calls and private APS KV storage.
- No Executa, external model API, provider key, custom backend, or landing page.
- Each conversation is stored separately. Saves are serialized, unchanged records are skipped, and APS etags protect against stale overwrites.
- The phrasebook and preferences persist separately. Empty fresh chats are not stored.
- Opening or reloading starts a fresh chat; choose a previous chat explicitly to resume it.
- Real AI failures retain the learner's message and provide **Retry reply** and **Edit message**. Invalid/empty output gets at most one repair attempt. There are no fake AI replies or production fixtures.
- Feedback is limited to an exact excerpt of the latest learner message. Expressions must appear in the actual assistant reply before they can be offered for saving.

This release provides text conversation practice. It does not request microphone access or claim to assess pronunciation. AI can make mistakes; corrections are suggestions.

## Development

Use Node.js 22+ and Anna CLI 0.1.59+.

```powershell
npm ci
npm run check
anna-app login --host https://anna.partners
npm run dev
```

Open `http://localhost:5206/` in Chrome. `npm run dev` uses real Anna AI and APS, billed against the signed-in user's normal Anna quota. It explicitly binds both dev identities to `englishbuddy-chat`.

For deterministic, free fixture testing:

```powershell
npm run dev:mock
```

Open `http://localhost:5205/`. Start this command after the fixture file exists; the CLI loads the JSONL at startup. The mock is a test scenario and is never included in the production bundle. Restart the harness after editing a fixture. Legacy mock storage is window-session state; use the real APS harness or an installed app to verify cross-session persistence.

`npm run preview` serves a standalone UI preview on port 5210. AI calls require Anna. This preview keeps any local data only in that browser; hosted production data is never silently copied to localStorage.

## Limits and data control

The first release keeps up to 24 conversations, 60 messages in each conversation, and 120 saved expressions. Large conversations stop accepting new messages before the APS record limit, preserving the existing history. Export all practice as JSON in Preferences. Deleting a conversation keeps its saved expressions. Removing an expression offers Undo.

## Build and release

```powershell
npm run check
anna-app apps status englishbuddy-chat --account https://anna.partners --json
anna-app apps publish --dry-run --account https://anna.partners
anna-app apps publish --account https://anna.partners --json
```

Verify the exact app ID, version, bundle, installed permissions, and live chat before submitting for review. An uploaded version is not public in the Marketplace until Anna approves and releases it. See [DEPLOY.md](DEPLOY.md) for verification records and the release procedure.

## Project layout

`src/` contains the editable UI and pure logic. `scripts/build.mjs` bundles it into `bundle/`. `tests/` covers grounding, malformed AI responses, persistence, concurrent saves, and storage limits. `fixtures/` is development-only. `listing-assets/` contains the logo and screenshots of the actual app.

Reference projects informed Anna integration and reliability lessons. This is a separate project and app identity; no account caches, credentials, tool IDs, or reference-project user data were copied.

## Licenses

Geist is distributed under the SIL Open Font License; Phosphor icons use the MIT License. Their license files ship in `bundle/assets/`.
