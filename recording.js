"use strict";

(() => {
  const recordButton = document.getElementById("record");
  const stopButton = document.getElementById("record-stop");
  const audioOption = document.getElementById("include-audio");
  const passwordInput = document.getElementById("password");
  const indicator = document.getElementById("recording-indicator");
  const playback = document.getElementById("playback");
  const fileInput = document.getElementById("recording-file");
  const openPassword = document.getElementById("open-password");
  const openButton = document.getElementById("open-recording");
  const magic = new TextEncoder().encode("CRYPTF01");
  const rounds = 600000;
  const maximumBytes = 50 * 1024 * 1024;
  let cameraOn = false;
  let pending = false;
  let generation = 0;
  let recording = null;
  let playbackUrl = null;

  function updateButtons() {
    recordButton.disabled = !cameraOn || pending || !!recording;
    stopButton.disabled = !recording || recording.recorder.state !== "recording";
    audioOption.disabled = pending || !!recording;
    passwordInput.disabled = pending || !!recording;
  }

  function release(session) {
    session.capture.getTracks().forEach((track) => track.stop());
    if (session.microphone) session.microphone.getTracks().forEach((track) => track.stop());
    if (session.audioContext) session.audioContext.close().catch((error) => console.error("Erro ao liberar áudio:", error));
  }

  async function deriveKey(password, salt, usage) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: rounds, hash: "SHA-256" },
      material, { name: "AES-GCM", length: 256 }, false, [usage]
    );
  }

  async function encrypt(blob, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, "encrypt");
    const type = new TextEncoder().encode(blob.type || "video/webm");
    if (type.length > 255) throw new Error("Formato de vídeo inválido.");
    const header = new Uint8Array(1 + type.length);
    header[0] = type.length;
    header.set(type, 1);
    const plaintext = await new Blob([header, blob]).arrayBuffer();
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: magic }, key, plaintext);
    return new Blob([magic, salt, iv, ciphertext], { type: "application/octet-stream" });
  }

  async function decrypt(file, password) {
    if (file.size > maximumBytes || file.size < 53) throw new Error("Arquivo inválido ou maior que 50 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!magic.every((byte, i) => bytes[i] === byte)) throw new Error("Arquivo não é uma gravação CriptFace.");
    const salt = bytes.slice(8, 24);
    const iv = bytes.slice(24, 36);
    const key = await deriveKey(password, salt, "decrypt");
    const decoded = new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: magic }, key, bytes.slice(36)
    ));
    const typeLength = decoded[0];
    if (!typeLength || typeLength + 1 >= decoded.length) throw new Error("Conteúdo da gravação inválido.");
    const type = new TextDecoder().decode(decoded.slice(1, typeLength + 1));
    if (!/^video\/(webm|mp4)(;|$)/i.test(type)) throw new Error("Formato de vídeo não suportado.");
    return new Blob([decoded.slice(typeLength + 1)], { type });
  }

  async function exportEncrypted(blob) {
    const name = `criptface-${Date.now()}.ccr`;
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(blob);
      });
      await window.Capacitor.nativePromise("EncryptedExport", "share", { name, data: base64 });
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }

  async function finish(session) {
    release(session);
    try {
      if (session.error) throw session.error;
      const blob = new Blob(session.chunks, { type: session.recorder.mimeType });
      if (!blob.size) throw new Error("A gravação ficou vazia.");
      if (blob.size > maximumBytes - 512) throw new Error("A gravação excedeu 50 MB.");
      setStatus("Criptografando a gravação...");
      const encrypted = await encrypt(blob, session.password);
      session.chunks.length = 0;
      session.password = "";
      await exportEncrypted(encrypted);
      setStatus(window.Capacitor && window.Capacitor.isNativePlatform()
        ? "Gravação criptografada. Escolha um destino para salvar o arquivo."
        : "Gravação criptografada. Guarde o arquivo e a senha em locais seguros.");
    } catch (error) {
      setStatus(`Não foi possível salvar a gravação: ${error.message}`, true);
      console.error("Erro na gravação:", error);
    } finally {
      session.chunks.length = 0;
      session.password = "";
      if (recording === session) recording = null;
      pending = false;
      indicator.hidden = true;
      updateButtons();
    }
  }

  function stopRecording() {
    if (!recording || recording.recorder.state !== "recording") return;
    indicator.hidden = true;
    stopButton.disabled = true;
    setStatus("Finalizando gravação...");
    recording.recorder.stop();
  }

  async function startRecording() {
    if (!cameraOn || pending || recording) return;
    if (!crypto.subtle || !window.MediaRecorder || !output.captureStream) {
      setStatus("A gravação protegida não é compatível com este dispositivo.", true);
      return;
    }
    if (passwordInput.value.length < 12) {
      setStatus("Informe uma senha de pelo menos 12 caracteres para gravar.", true);
      return;
    }
    const id = ++generation;
    const password = passwordInput.value;
    const withAudio = audioOption.checked;
    pending = true;
    updateButtons();
    let session = null;
    try {
      const captureCanvas = document.createElement("canvas");
      captureCanvas.width = output.width;
      captureCanvas.height = output.height;
      if (!captureCanvas.width || !captureCanvas.height) throw new Error("Aguarde a imagem da câmera aparecer.");
      captureCanvas.getContext("2d").drawImage(output, 0, 0);
      session = { canvas: captureCanvas, capture: captureCanvas.captureStream(30), microphone: null, audioContext: null, chunks: [], bytes: 0, password, error: null };
      if (withAudio) {
        setStatus("Solicitando acesso ao microfone...");
        session.microphone = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (id !== generation || !cameraOn) {
          release(session);
          return;
        }
        session.audioContext = new AudioContext();
        await session.audioContext.audioWorklet.addModule("./voice-worklet.js");
        const source = session.audioContext.createMediaStreamSource(session.microphone);
        const distorter = new AudioWorkletNode(session.audioContext, "voice-distorter", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        });
        const destination = session.audioContext.createMediaStreamDestination();
        source.connect(distorter).connect(destination);
        await session.audioContext.resume();
        session.capture.addTrack(destination.stream.getAudioTracks()[0]);
        session.microphone.getAudioTracks()[0].addEventListener("ended", () => {
          if (recording === session) {
            session.error = new Error("O microfone foi desconectado durante a gravação.");
            stopRecording();
          }
        });
      }
      if (id !== generation || !cameraOn) {
        release(session);
        return;
      }
      const candidates = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
      const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      if (!mimeType) throw new Error("Nenhum formato de gravação compatível foi encontrado.");
      session.recorder = new MediaRecorder(session.capture, { mimeType });
      session.recorder.ondataavailable = (event) => {
        if (event.data.size) {
          session.chunks.push(event.data);
          session.bytes += event.data.size;
          if (session.bytes > maximumBytes - 512 && session.recorder.state === "recording") {
            session.error = new Error("A gravação excedeu 50 MB.");
            stopRecording();
          }
        }
      };
      session.recorder.onerror = (event) => {
        session.error = event.error || new Error("O gravador encontrou um erro.");
      };
      session.recorder.onstop = () => finish(session);
      recording = session;
      session.recorder.start(1000);
      passwordInput.value = "";
      indicator.hidden = false;
      setStatus("Gravando vídeo filtrado" + (withAudio ? " com voz distorcida." : ", sem áudio."));
    } catch (error) {
      if (session) release(session);
      recording = null;
      setStatus(`Não foi possível iniciar a gravação: ${error.message}`, true);
      console.error("Erro ao iniciar gravação:", error);
    } finally {
      pending = false;
      updateButtons();
    }
  }

  window.addEventListener("camera-started", () => { cameraOn = true; updateButtons(); });
  window.addEventListener("camera-stopping", () => {
    cameraOn = false;
    generation++;
    stopRecording();
    updateButtons();
  });
  window.addEventListener("camera-frame", () => {
    if (recording && recording.recorder.state === "recording") {
      recording.canvas.getContext("2d").drawImage(output, 0, 0, recording.canvas.width, recording.canvas.height);
    }
  });
  recordButton.addEventListener("click", startRecording);
  stopButton.addEventListener("click", stopRecording);
  openButton.addEventListener("click", async () => {
    if (!fileInput.files.length || !openPassword.value) {
      setStatus("Escolha um arquivo e informe a senha.", true);
      return;
    }
    openButton.disabled = true;
    if (playbackUrl) {
      playback.hidden = true;
      playback.pause();
      playback.removeAttribute("src");
      playback.load();
      URL.revokeObjectURL(playbackUrl);
      playbackUrl = null;
    }
    try {
      setStatus("Abrindo gravação...");
      const blob = await decrypt(fileInput.files[0], openPassword.value);
      playbackUrl = URL.createObjectURL(blob);
      playback.hidden = false;
      playback.src = playbackUrl;
      openPassword.value = "";
      setStatus("Gravação aberta somente neste aparelho.");
    } catch (error) {
      setStatus("Não foi possível abrir o arquivo: senha incorreta, arquivo inválido ou danificado.", true);
      console.error("Erro ao abrir gravação:", error);
    } finally {
      openButton.disabled = false;
    }
  });
  playback.addEventListener("error", () => {
    if (!playback.hidden) setStatus("O vídeo foi descriptografado, mas este dispositivo não conseguiu reproduzi-lo.", true);
  });
  window.addEventListener("pagehide", () => {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
  });
})();
