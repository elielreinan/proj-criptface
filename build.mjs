import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/node_modules/@mediapipe/tasks-vision", { recursive: true });
for (const file of ["index.html", "style.css", "script.js", "recording.js", "voice-worklet.js"]) {
  await cp(file, `dist/${file}`);
}
await cp("models", "dist/models", { recursive: true });
await cp("node_modules/@mediapipe/tasks-vision/vision_bundle.mjs", "dist/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs");
await cp("node_modules/@mediapipe/tasks-vision/wasm", "dist/node_modules/@mediapipe/tasks-vision/wasm", { recursive: true });
