# REVENANT — something lives here

A web page with a resident entity. A small language model runs entirely in your browser — WebGPU, no server, no API calls — and behaves like something that lives in the page. It notices how you move, hover and wait, speaks in short lines, rewrites the page's own words, and remembers you between visits. Its mood drives the colors and motion of the background.

It works offline. Once the model is cached, unplug the network and it keeps talking.

Live: https://revenant-lyart.vercel.app

## Run it

```sh
npm install
npm run dev
```

Requires a WebGPU browser (Chrome/Edge desktop, Safari 26+). The first visit downloads the model weights (`Qwen2.5-0.5B-Instruct`, a few hundred MB) once; the browser caches them after that.

## How it works

| File | Role |
|---|---|
| `src/main.js` | Watches interaction (idle time, hovers, fast movement), renders lines, saves memory to `localStorage` |
| `src/entity.js` | Loads the model with [`@mlc-ai/web-llm`](https://github.com/mlc-ai/web-llm) and runs short generations |
| `src/persona.js` | The entity's voice, the prompt it gets, and fallback lines |
| `src/backdrop.js` | Background shader driven by mood |

No frameworks, no backend. Open the dev console.

## License

MIT. See [LICENSE](LICENSE).
