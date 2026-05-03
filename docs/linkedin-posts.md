# LinkedIn Posts — OdTauLai

Five drafts. Pick, mix, edit. Hashtags are suggestions, not mandates.

---

## Post 1 — Launch announcement (broad audience)

Introducing **OdTauLai** — *On-Device Task App Using Local Ambient Intelligence.*

A Pomodoro timer and ClickUp-style task manager that actually understands what your tasks **mean** — without sending a single character to the cloud.

- 100% local-first. No account. No telemetry. No cloud LLM.
- A 33 MB embedding model runs in your browser (WebGPU, with WASM fallback for iPhone).
- Semantic search, smart-add, duplicate detection, and "harmonize all fields" — all on-device.
- Vanilla JS. No build step. PWA. Works offline.
- MIT licensed.

Built with intent. Runs on your device. Owes you nothing.

→ [link to repo / demo]

#LocalFirst #PrivacyByDesign #ProductivityTools #OpenSource #OnDeviceAI

---

## Post 2 — Privacy / local-first angle

Most "AI productivity" tools quietly ship your tasks, notes, and calendar to someone else's server. We took the other path.

OdTauLai is a task manager and Pomodoro app where the AI lives entirely in your browser:

→ A 33 MB sentence-embedding model (Xenova/gte-small) handles semantic search, smart suggestions, and duplicate detection — locally.
→ The optional generative AI is opt-in, downloads on click, and runs in WebGPU/WASM. No OpenAI, no Anthropic, no anyone.
→ The only outbound calls are the one-time model download (cached forever after) and integrations *you* explicitly turn on.

If you've ever closed a productivity app because the privacy policy made you uneasy, this one is for you.

MIT licensed. Open source. Audit the `fetch(` calls yourself.

#PrivacyFirst #LocalFirst #OpenSource #PrivacyByDesign

---

## Post 3 — Technical / engineering angle

A few engineering choices behind **OdTauLai** that we're proud of:

🟣 **No framework. No bundler. No build step.** Vanilla HTML, CSS, and JS modules. `git clone` and open `index.html` — it just runs. In 10 years it will still just run.

🟣 **On-device embeddings via Transformers.js.** 384-dim vectors, cosine similarity, kNN — that's all you need for "what does this task mean?" Chat LLMs are overkill for that question.

🟣 **Background-safe audio.** Web Audio scheduling + a silent 20Hz oscillator + Media Session API + Wake Lock. Pomodoro chimes survive a minimized tab.

🟣 **Pareto 80/20 impact scoring.** A derived score from priority, due urgency, blocker graph depth, and an effort inverse (`xs → 1.35x`, `xl → 0.7x`). High output, low input, rises to the top.

🟣 **Optional WebRTC P2P sync.** No server-side state. The signalling server brokers; your data goes peer to peer.

The full source is MIT.

#WebDev #JavaScript #PWA #SoftwareEngineering #WebGPU

---

## Post 4 — Short / punchy

Every productivity app these days wants your account, your data, and a subscription.

We built one that wants none of those.

OdTauLai → on-device AI task manager + Pomodoro. Vanilla JS. Offline. Free. MIT.

The AI runs in your browser. Your tasks never leave your machine.

That's the whole pitch.

→ [link]

#OpenSource #ProductivityTools #LocalFirst

---

## Post 5 — Story / "why we built it"

Why we built OdTauLai.

We wanted a task app that:
- understood the *meaning* of our work, not just keywords,
- never asked us to sign in,
- never phoned home,
- worked on a flight, on a phone, on a corporate laptop,
- and was small enough to read end to end on a Saturday.

What shipped:

✅ Pomodoro + quick timers + stopwatch with background-safe audio
✅ ClickUp-style nested tasks, dependencies, recurrence, calendar feeds (iCal/ICS)
✅ On-device semantic search and smart-add — 33 MB model, no cloud
✅ Pareto 80/20 impact view that ranks what actually moves things forward
✅ Optional P2P sync (WebRTC), opt-in generative AI (small local model)
✅ PWA, offline, vanilla JS, no build step

If "the AI" in your tools makes you nervous, try one where the AI lives in your browser tab and nowhere else.

Open source. MIT. → [link]

#LocalFirst #PrivacyByDesign #OpenSource #ProductivityTools #OnDeviceAI

---

## Notes on usage

- LinkedIn favors posts under ~1,300 characters before the "see more" cut. Posts 1, 2, and 4 are safely under; post 5 is right at the edge — trim a bullet if needed.
- Hashtags: 3–5 is the LinkedIn sweet spot. Drop the rest.
- Pair posts 1 or 5 with the architecture image already in `README.md` for higher engagement.
- Replace `[link]` with the GitHub URL or a deployed demo URL before posting.
