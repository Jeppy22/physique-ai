# PhysiqueAI

**Evidence-based contest prep coaching, grounded in peer-reviewed bodybuilding research.**

An AI agent that reasons about bodybuilding contest prep using four structured physiology tools and cites the underlying research for every recommendation.

[ Live demo ] · [ Demo video ] · [ How it works ](#architecture)

---

## What it does

PhysiqueAI is a chat-based AI coach that helps natural bodybuilders prepare for contests. Users enter their stats once (gender, age, height, weight, training phase, current macros). The agent then reasons about their prep using four research-grounded tools:

- **project_weight_trajectory** — projects weekly weight curves and flags unsafe cut rates (>1% bodyweight/week per Helms 2014)
- **assess_macros** — recommends protein, fat, and calorie ranges based on phase, training volume, and lean body mass (Helms 2014, Morton 2018)
- **generate_peak_week** — day-by-day water/sodium/carb protocols for the week before stage (Mitchell 2018)
- **flag_warning_signs** — checks energy, sleep, libido, menstrual cycle, and weight loss rate against severity thresholds (Rossow 2013, Trexler 2014)

Every tool returns citations to the underlying research. The agent surfaces those citations in its responses. No "AI hallucinated coaching advice."

## Why I built it

I'm building a public portfolio of healthcare + AI projects on Azure. PhysiqueAI is the consumer-side proof — the same agentic AI pattern as my clinical [fhir-ai-query-layer](https://github.com/Jeppy22/fhir-ai-query-layer) work, applied to a domain I have firsthand expertise in as someone currently cutting. The shared lesson: tools-with-citations beat prompt-with-instructions for any domain where being wrong has consequences.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (Next.js 15 + Tailwind v4)                 │
│  - Onboarding wizard (3 screens, persisted state)   │
│  - Bloomberg-terminal-styled chat panel             │
│  - Character-by-character streaming with rAF buffer │
└──────────────────┬──────────────────────────────────┘
                   │ SSE
┌──────────────────▼──────────────────────────────────┐
│  Next.js API route (/api/chat)                      │
│  - Anthropic SDK (Claude Sonnet 4.5)                │
│  - Agentic tool-call loop (max 5 iterations)        │
│  - Streams text_delta + tool_call events            │
└──────────────────┬──────────────────────────────────┘
                   │ tool_use → execute → tool_result
┌──────────────────▼──────────────────────────────────┐
│  Pure TypeScript physiology tools (lib/tools/)      │
│  - 19 unit tests covering edge cases                │
│  - No I/O, no API calls — pure functions            │
│  - Every output includes citations array            │
└─────────────────────────────────────────────────────┘
```

## The engineering decisions that mattered most

### 1. Pure functions before AI

The four tools are pure TypeScript with unit tests. The AI doesn't reason about contest prep from memory — it calls a tool. This decouples "is the math right?" (test it with vitest) from "does the AI explain it well?" (prompt engineering). Without this separation, every prompt change is also a math-correctness change. With it, the math is locked and only the prose iterates.

### 2. Citations as a tool output field, not a prompt instruction

Every tool returns a `citations: string[]` field as part of its structured output. The agent surfaces these in chat. If I asked the agent in the system prompt to "always cite sources," it would invent citations when it forgot. By making citations a *return value of the tool*, they're computationally guaranteed to be the real ones used in the underlying logic.

### 3. Streaming buffer with adaptive drain rate

Anthropic's API streams text in chunks. Rendering each chunk directly produces visible bursts. I buffer incoming deltas and drain them character-by-character at 70 chars/sec base rate, with adaptive catch-up rates (150 / 400 / 600 chars/sec) when the buffer grows beyond thresholds. The result is smooth typewriter-style flow regardless of API chunk size.

### 4. Lifter state as system prompt context, not conversation history

The user's stats (age, weight, current macros, phase) live in localStorage and are injected into every chat request as structured context in the system prompt. The agent doesn't need to re-ask. Conversation history stays focused on the actual questions being asked.

## Stack

- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind v4
- **AI:** Anthropic Claude Sonnet 4.5 via @anthropic-ai/sdk
- **Streaming:** Server-Sent Events with custom rAF-based typewriter buffer
- **Testing:** vitest (19 tests, all passing)
- **Deployment:** Vercel
- **Storage:** localStorage (no backend, no auth, no database)

## Research grounding

All physiology logic cites peer-reviewed sources:

- Helms, Aragon, Fitschen 2014 — *Evidence-based recommendations for natural bodybuilding contest preparation* (JISSN)
- Rossow et al. 2013 — *Natural bodybuilding competition preparation and recovery: a 12-month case study* (IJSNEM)
- Mitchell et al. 2018 — *Practical recommendations for natural bodybuilding peak week* (Sports)
- Trexler, Smith-Ryan, Norton 2014 — *Metabolic adaptation to weight loss* (JISSN)
- Morton et al. 2018 — *Systematic review of dietary protein during weight loss and resistance training* (BJSM)

## Run locally

```bash
git clone https://github.com/Jeppy22/physique-ai.git
cd physique-ai
npm install --legacy-peer-deps
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploy to Vercel

1. Fork the repo.
2. Import it at [vercel.com/new](https://vercel.com/new) — framework auto-detects as Next.js.
3. Add an `ANTHROPIC_API_KEY` environment variable.
4. Deploy. The `vercel.json` in the repo pins the `--legacy-peer-deps` install flag required by shadcn's peer dependencies.

## Tests

```bash
npm test          # run all 19 unit tests
npm run build     # production build
```

## Vision (opt-in)

PhysiqueAI supports optional physique photo upload for visual assessment. Click `[+ PHOTOS]` in the chat to upload front / side / back images.

The vision assessment voice is intentionally constrained:
- Body fat estimates use ranges, never single-point values
- The agent refuses medical observations and stage-readiness timelines in weeks
- Lighting, angle, and pose limits are acknowledged in every analysis
- No comparisons to named competitors or celebrity physiques

**Privacy:** Photos are sent to Anthropic's API for the duration of the request only. They are not stored by PhysiqueAI in any form — not in localStorage, not in sessionStorage, not on disk. They are not used for training per Anthropic's data policy.

**Cost:** Vision-enabled chat turns use ~5000-9000 input tokens vs ~2000 for text-only turns. With Claude Sonnet 4.5 pricing, expect each photo analysis to cost roughly $0.05–$0.10 in API credits.

## Privacy

PhysiqueAI does not collect, store, or transmit user data to any backend. All lifter stats live in your browser's localStorage. Chat messages are sent to Anthropic's API for processing and are not stored by PhysiqueAI. See [Anthropic's data privacy policy](https://www.anthropic.com/legal/privacy) for how messages are handled on their end.

## About

Built by Jeff Madden ([@Jeppy22](https://github.com/Jeppy22)) as part of a public portfolio of healthcare + Azure + AI engineering projects. See also: [fhir-ai-query-layer](https://github.com/Jeppy22/fhir-ai-query-layer) (clinical AI on Azure with FHIR R4).

[GitHub](https://github.com/Jeppy22)

## License

MIT
