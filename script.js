"use strict";

const video = document.getElementById("video");
const output = document.getElementById("output");
const viewer = document.querySelector(".viewer");
const placeholder = document.getElementById("placeholder");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const density = document.getElementById("density");
const densityValue = document.getElementById("density-value");
const mirror = document.getElementById("mirror");
const status = document.getElementById("status");
const context = output.getContext("2d");
const sample = document.createElement("canvas");
const sampleContext = sample.getContext("2d", { willReadFrequently: true });

const characters = "01X#&@";
const colors = ["#020704", "#155a2b", "#238d46", "#48c96e", "#a1ffb7"];
let stream = null;
let frame = null;
let requestId = 0;
let segmenterPromise = null;
let segmenter = null;
let lastVideoTime = -1;

function loadSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import("./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs");
      const fileset = await FilesetResolver.forVisionTasks("./node_modules/@mediapipe/tasks-vision/wasm");
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "./models/selfie_segmenter.tflite" },
        runningMode: "VIDEO",
        outputCategoryMask: false,
        outputConfidenceMasks: true
      });
    })().catch((error) => {
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function stopCamera(message = "Câmera desligada.") {
  window.dispatchEvent(new Event("camera-stopping"));
  requestId += 1;
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  lastVideoTime = -1;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  video.pause();
  video.srcObject = null;
  context.clearRect(0, 0, output.width, output.height);
  placeholder.hidden = false;
  startButton.disabled = false;
  stopButton.disabled = true;
  setStatus(message);
}

function drawFrame() {
  if (!stream) return;

  try {
    const width = viewer.clientWidth;
    const height = viewer.clientHeight;
    if (width > 0 && height > 0 && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      segmenter.segmentForVideo(video, performance.now(), (result) => {
        if (!result.confidenceMasks || result.confidenceMasks.length !== 1) {
          throw new Error("O modelo não retornou a máscara de pessoa esperada.");
        }
        renderMaskedFrame(width, height, result.confidenceMasks[0]);
      });
    }
    frame = requestAnimationFrame(drawFrame);
  } catch (error) {
    stopCamera();
    setStatus("Não foi possível separar a pessoa do fundo. A câmera foi desligada; tente novamente.", true);
    console.error("Erro ao segmentar a imagem:", error);
  }
}

function renderMaskedFrame(width, height, mask) {
  const columns = Number(density.value);
  const cellWidth = width / columns;
  const fontSize = cellWidth / 0.6;
  const rows = Math.max(1, Math.floor(height / (fontSize * 1.15)));

  if (output.width !== width || output.height !== height) {
    output.width = width;
    output.height = height;
  }
  if (sample.width !== columns || sample.height !== rows) {
    sample.width = columns;
    sample.height = rows;
  }

  sampleContext.setTransform(mirror.checked ? -1 : 1, 0, 0, 1, mirror.checked ? columns : 0, 0);
  sampleContext.imageSmoothingEnabled = true;
  sampleContext.imageSmoothingQuality = "high";
  sampleContext.drawImage(video, 0, 0, columns, rows);
  const pixels = sampleContext.getImageData(0, 0, columns, rows).data;
  const confidence = mask.getAsFloat32Array();

  context.fillStyle = "#020704";
  context.fillRect(0, 0, width, height);
  context.font = `${fontSize}px monospace`;
  context.textBaseline = "top";
  const phase = Math.floor(performance.now() / 300);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const sourceX = mirror.checked ? columns - 1 - x : x;
      const maskX = Math.min(mask.width - 1, Math.floor((sourceX + 0.5) * mask.width / columns));
      const maskY = Math.min(mask.height - 1, Math.floor((y + 0.5) * mask.height / rows));
      if (confidence[maskY * mask.width + maskX] < 0.7) continue;
      const index = (y * columns + x) * 4;
      const brightness = (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255;
      const level = Math.min(colors.length - 1, Math.floor(brightness * colors.length));
      if (level > 0) {
        const character = characters[((x * 17 + y * 31 + x * y * 7 + phase * 13) >>> 0) % characters.length];
        context.fillStyle = colors[level];
        context.fillText(character, x * cellWidth, y * height / rows);
      }
    }
  }
  window.dispatchEvent(new Event("camera-frame"));
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("Câmera indisponível. Abra esta página em localhost ou HTTPS e use um navegador compatível.", true);
    return;
  }

  const currentRequest = ++requestId;
  startButton.disabled = true;
  stopButton.disabled = false;
  setStatus("Solicitando acesso à câmera...");

  try {
    const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    if (currentRequest !== requestId) {
      newStream.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = newStream;
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (stream === newStream) stopCamera("A câmera foi desconectada ou deixou de estar disponível.");
      });
    });
    video.srcObject = stream;
    await video.play();
    if (currentRequest !== requestId) return;

    setStatus("Carregando o modelo para remover o fundo...");
    try {
      segmenter = await loadSegmenter();
    } catch (error) {
      if (currentRequest !== requestId) return;
      stopCamera();
      setStatus("Não foi possível carregar o modelo de segmentação. Verifique a instalação e tente novamente.", true);
      console.error("Erro ao carregar o modelo de segmentação:", error);
      return;
    }
    if (currentRequest !== requestId) return;

    viewer.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    placeholder.hidden = true;
    setStatus("Câmera ligada. Apenas pessoas são exibidas; o processamento é local.");
    window.dispatchEvent(new Event("camera-started"));
    drawFrame();
  } catch (error) {
    if (currentRequest !== requestId) return;
    stopCamera();
    const detail = error.name === "NotAllowedError"
      ? "Permissão negada. Autorize o acesso à câmera nas configurações do navegador."
      : error.name === "NotFoundError"
        ? "Nenhuma câmera foi encontrada."
        : "Não foi possível iniciar a câmera. Verifique se ela está disponível e tente novamente.";
    setStatus(detail, true);
    console.error("Erro ao iniciar a câmera:", error);
  }
}

function updateDensityLabel() {
  densityValue.value = `${density.value} colunas`;
}

startButton.addEventListener("click", startCamera);
stopButton.addEventListener("click", () => stopCamera());
density.addEventListener("input", updateDensityLabel);
window.addEventListener("pagehide", () => stopCamera());
document.addEventListener("visibilitychange", () => {
  if (document.hidden && stream) stopCamera("Câmera desligada porque o aplicativo foi colocado em segundo plano.");
});
updateDensityLabel();
