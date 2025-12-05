const recordButton = document.getElementById('recordButton');
const micStatus = document.getElementById('micStatus');
const statusText = document.getElementById('status');
const logList = document.getElementById('log');

const normalBtn = document.getElementById('normalBtn');
const echoBtn = document.getElementById('echoBtn');
const robotBtn = document.getElementById('robotBtn');
const chipmunkBtn = document.getElementById('chipmunkBtn');
const deepBtn = document.getElementById('deepBtn');

let mediaRecorder;
let recordedChunks = [];
let audioBuffer = null;
let isRecording = false;
let audioContext;

function addLog(message) {
  const item = document.createElement('li');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  item.textContent = `[${time}] ${message}`;
  logList.prepend(item);
}

function setPlaybackEnabled(enabled) {
  [normalBtn, echoBtn, robotBtn, chipmunkBtn, deepBtn].forEach(btn => {
    btn.disabled = !enabled;
  });
}

async function initMic() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    micStatus.textContent = 'Microphone ready';
    addLog('Microphone permission granted.');
  } catch (err) {
    micStatus.textContent = 'Microphone blocked — allow access to record';
    addLog('Microphone access was denied. Please enable it and reload.');
    recordButton.disabled = true;
  }
}

async function startRecording() {
  if (isRecording) return;
  recordedChunks = [];
  isRecording = true;
  statusText.textContent = 'Recording… tap again to stop.';
  recordButton.textContent = 'Stop recording';
  setPlaybackEnabled(false);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      isRecording = false;
      recordButton.textContent = 'Tap to record';
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      await decodeRecording(blob);
    };

    mediaRecorder.start();
    addLog('Recording started.');
  } catch (error) {
    isRecording = false;
    recordButton.textContent = 'Tap to record';
    statusText.textContent = 'Could not start recording — check microphone access.';
    addLog('Recording failed to start: ' + error.message);
  }
}

async function decodeRecording(blob) {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  try {
    statusText.textContent = 'Processing your take…';
    const arrayBuffer = await blob.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    statusText.textContent = 'Ready. Tap an effect to listen.';
    addLog('Recording processed and ready for playback.');
    setPlaybackEnabled(true);
  } catch (error) {
    statusText.textContent = 'Processing failed. Please record again.';
    addLog('Failed to decode audio: ' + error.message);
  }
}

function playBuffer(setupNodes) {
  if (!audioBuffer || !audioContext) return;

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;

  const destination = audioContext.destination;
  let nodeChainEnd = setupNodes ? setupNodes(source) : source;
  if (!nodeChainEnd) nodeChainEnd = source;
  nodeChainEnd.connect(destination);
  source.start();
}

function createEchoChain(source) {
  const delay = audioContext.createDelay(5.0);
  delay.delayTime.value = 0.24;

  const feedback = audioContext.createGain();
  feedback.gain.value = 0.32;

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3200;

  source.connect(delay);
  delay.connect(filter);
  filter.connect(feedback);
  feedback.connect(delay);

  const dryGain = audioContext.createGain();
  dryGain.gain.value = 0.75;

  const wetGain = audioContext.createGain();
  wetGain.gain.value = 0.65;

  source.connect(dryGain);
  delay.connect(wetGain);

  const merger = audioContext.createGain();
  dryGain.connect(merger);
  wetGain.connect(merger);

  return merger;
}

function createRobotChain(source) {
  const modOsc = audioContext.createOscillator();
  modOsc.frequency.value = 30;

  const modGain = audioContext.createGain();
  modGain.gain.value = 0.7;

  modOsc.connect(modGain);

  const ringMod = audioContext.createGain();
  source.connect(ringMod.gain);
  modGain.connect(ringMod);
  modOsc.start();

  const comb = audioContext.createDelay();
  comb.delayTime.value = 0.005;
  ringMod.connect(comb);

  const filter = audioContext.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1400;
  filter.Q.value = 1.2;

  comb.connect(filter);
  return filter;
}

function playNormal() {
  statusText.textContent = 'Playing clean take…';
  addLog('Playing: Clean');
  playBuffer((source) => source);
}

function playEcho() {
  statusText.textContent = 'Playing with echo…';
  addLog('Playing: Echo');
  playBuffer(createEchoChain);
}

function playRobot() {
  statusText.textContent = 'Playing with robot tone…';
  addLog('Playing: Robot');
  playBuffer(createRobotChain);
}

function playChipmunk() {
  statusText.textContent = 'Playing fast & bright…';
  addLog('Playing: Chipmunk');
  playBuffer((source) => {
    source.playbackRate.value = 1.35;
    return source;
  });
}

function playDeep() {
  statusText.textContent = 'Playing slower & lower…';
  addLog('Playing: Deep');
  playBuffer((source) => {
    source.playbackRate.value = 0.75;
    return source;
  });
}

recordButton.addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  } else {
    mediaRecorder?.stop();
    statusText.textContent = 'Finishing recording…';
  }
});

normalBtn.addEventListener('click', playNormal);
echoBtn.addEventListener('click', playEcho);
robotBtn.addEventListener('click', playRobot);
chipmunkBtn.addEventListener('click', playChipmunk);
deepBtn.addEventListener('click', playDeep);

initMic();
