# CriptFace

CriptFace transforma imagens da câmera em caracteres e tenta separar pessoas do fundo. Permite gravar o resultado com voz distorcida e proteger o arquivo com senha, processando tudo no próprio dispositivo.

![Status](https://img.shields.io/badge/status-em_desenvolvimento-green.svg)
![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)

---

## 📌 Índice

- [Visão Geral](#-visão-geral)
- [Tecnologias](#️-tecnologias)
- [Como Executar](#-como-executar)
- [Como Contribuir](#-como-contribuir)
- [Licença](#-licença)

---

## 💡 Visão Geral

- **Filtro em tempo real:** transforma a pessoa em caracteres, com até 120 colunas e remoção aproximada do fundo.
- **Gravação:** captura apenas a imagem filtrada, com áudio opcional e voz distorcida; a voz original não é adicionada à gravação.
- **Proteção por senha:** exporta um arquivo `.ccr` criptografado, que pode ser aberto no próprio CriptFace.
- **Android:** projeto nativo usando Capacitor, com permissões solicitadas quando necessárias.

### Privacidade e limitações

Vídeo e áudio são processados localmente e não são enviados a servidores pelo aplicativo. O microfone é solicitado somente ao iniciar uma gravação com áudio, e não há monitoramento da voz pelos alto-falantes.

O arquivo `.ccr` usa AES-256-GCM e uma chave derivada da senha com PBKDF2-SHA-256 (600.000 iterações), salt e nonce aleatórios. Use uma senha forte e única: uma senha fraca pode ser adivinhada; **quem tiver a senha pode descriptografar o arquivo**, e não há recuperação se ela for perdida. No Android, escolha um destino no compartilhamento para conservar o arquivo: o cache do aplicativo pode ser apagado pelo sistema. Arquivos exportados podem ser copiados por outros aplicativos ou pessoas com acesso a eles.

O tamanho máximo do arquivo é 50 MB; uma gravação que ultrapasse esse limite é interrompida e descartada. Mantenha o aplicativo aberto até concluir a exportação.

O filtro, a segmentação e a distorção **não garantem anonimato nem impedem a recuperação ou identificação**. Parte do fundo pode aparecer, e características da voz, da imagem, do ambiente ou dos movimentos podem identificar uma pessoa. Não use a segmentação para esconder informações sensíveis. A reprodução descriptografada fica na memória do aplicativo, mas outro aplicativo ou uma captura de tela pode copiar o conteúdo exibido.

---

## 🛠️ Tecnologias

- HTML, CSS e JavaScript
- [MediaPipe Image Segmenter](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter) e modelo Selfie Segmentation
- Web Audio, MediaRecorder e Web Crypto
- Node.js e [Capacitor](https://capacitorjs.com/) para o projeto Android

---

## 🚀 Como Executar

### Pré-requisitos

- Node.js 20 ou superior e npm.
- Python 3 para servir a versão web localmente.
- Para Android: Android Studio, Android SDK e JDK 21. Use um aparelho ou emulador com câmera, microfone e Android System WebView atualizado.

### 🔧 Passo a Passo

Na pasta do projeto:

```powershell
npm install
python -m http.server 8000
```

Abra `http://localhost:8000` no navegador. Clique em **Ligar câmera**, autorize a câmera e aguarde o modelo carregar. Para gravar, informe uma senha de pelo menos 12 caracteres, escolha se deseja áudio e clique em **Iniciar gravação**; permita o microfone quando solicitado. Finalize a gravação para exportar o arquivo criptografado. Em **Abrir gravação protegida**, selecione o arquivo e informe a senha para reproduzi-lo.

O navegador precisa oferecer acesso à câmera, MediaRecorder, captura de canvas, Web Audio Worklet e Web Crypto em contexto seguro (`localhost` ou HTTPS). O formato do vídeo e a compatibilidade dependem do navegador.

### Android

Após instalar as dependências:

```powershell
npm run android:sync
npx cap open android
```

No Android Studio, configure o SDK e execute o app em um dispositivo ou gere um APK de depuração. A gravação abre o seletor de compartilhamento: escolha onde salvar o arquivo `.ccr`. O app precisa ter permissões de câmera e, para gravação com áudio, microfone. Se algum recurso de gravação não for suportado pelo WebView, o aplicativo apresenta um erro.

---

## 🤝 Como Contribuir

Crie uma branch, faça alterações pequenas e teste o filtro, a gravação e o fluxo de abertura do arquivo antes de propor suas mudanças. Não inclua gravações, senhas, chaves ou dados pessoais no repositório.

---

## 📄 Licença

Ainda não foi definida uma licença para o projeto. As dependências e o modelo de terceiros mantêm suas próprias licenças.
