# EnglishBuddy

Build a simple English practice chat that opens directly into its working conversation. No landing page, sign-up form, onboarding questionnaire, invented history, or microphone feature.

The user can type immediately, get a natural short reply, review a specific optional language correction, save an expression, search their phrasebook, practise a saved phrase, start a new conversation, revisit old chats, and export their own data. Preferences are optional and never gate the chat.

Every app open starts a fresh conversation. Previous conversations stay in history and open only when selected. Three sample user messages are visible on a new chat; clicking one sends it directly to the real AI. These are starter messages, not prewritten assistant responses. Empty chats do not accumulate in storage.

Design: calm, friendly workspace; white conversation canvas, warm gray navigation, muted sage accent, Geist typography, Phosphor icons. A restrained notebook column supports the chat on wide windows. On narrow windows, history moves to a drawer and language notes remain within the conversation.

Architecture: static JavaScript SPA, bundled assets, schema 3, Anna Host LLM and private APS KV. No Executa or third-party model key. Use explicit englishbuddy-chat identity in every harness command. GitHub and Anna app identities must be independent from every reference project.

Reference material: current Anna Developer Hub and Build on Anna 101; local LearnTube, CareerCraft, Decision Room, and SkillQuest projects. Borrow architecture and lessons, never account caches, tool IDs, credentials, generated user data, or source branding.
