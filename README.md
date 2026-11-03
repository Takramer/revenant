# REVENANT — something lives here

Something lives in this page. It is a small language model running in your browser on WebGPU, with no server and no API calls. It notices how you move, hover and wait, speaks in short lines, rewrites the page's own words, and remembers you when you come back. Its mood sets the colors and motion of the background.

Once the browser has cached the model, you can unplug the network and it keeps talking.

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

There is no framework and no backend. Open the dev console; it leaves notes there too.

## License

MIT. See [LICENSE](LICENSE).
