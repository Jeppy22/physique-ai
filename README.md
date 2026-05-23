# PhysiqueAI

A Next.js web app where bodybuilders chat with an AI contest prep coach. The agent calls tools to project weight trajectories, assess macros, generate peak week protocols, and flag warning signs.

Pass 3: Anthropic Claude agent wired end-to-end with the four tool functions from Pass 2. Streaming chat, inline tool-call pills, no persistence.

## Running

```bash
npm install --legacy-peer-deps
```

Create `.env.local` in the project root with your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm test` — run vitest unit tests for the tool functions
- `npm run lint` — ESLint
