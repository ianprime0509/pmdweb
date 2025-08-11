const audioContext = new AudioContext({
  sampleRate: 44_100,
});
await audioContext.audioWorklet.addModule("audio.js");
const audioNode = new AudioWorkletNode(audioContext, "audio-processor", {
  numberOfInputs: 0,
  numberOfOutputs: 1,
  outputChannelCount: [2],
  processorOptions: {
    wasmSource: await fetch("audio.wasm").then((r) => r.arrayBuffer()),
  },
});
audioNode.connect(audioContext.destination);

const updateInstrument = (data) => audioNode.port.postMessage({
  cmd: "instrumentSet",
  args: { params: data },
});

const instrumentEditor = document.getElementById("instrument-editor");
instrumentEditor.addEventListener("instrument-change", (e) => updateInstrument(e.data));
customElements.whenDefined("instrument-editor").then(() => updateInstrument(instrumentEditor.data));

const notes = {
  KeyZ:      [3,  0],
  KeyS:      [3,  1],
  KeyX:      [3,  2],
  KeyD:      [3,  3],
  KeyC:      [3,  4],
  KeyV:      [3,  5],
  KeyG:      [3,  6],
  KeyB:      [3,  7],
  KeyH:      [3,  8],
  KeyN:      [3,  9],
  KeyJ:      [3, 10],
  KeyM:      [3, 11],
  Comma:     [4,  0],
  KeyL:      [4,  1],
  Period:    [4,  2],
  Semicolon: [4,  3],
  Slash:     [4,  4],

  KeyQ:      [4,  0],
  Digit2:    [4,  1],
  KeyW:      [4,  2],
  Digit3:    [4,  3],
  KeyE:      [4,  4],
  KeyR:      [4,  5],
  Digit5:    [4,  6],
  KeyT:      [4,  7],
  Digit6:    [4,  8],
  KeyY:      [4,  9],
  Digit7:    [4, 10],
  KeyU:      [4, 11],
  KeyI:      [5,  0],
  Digit9:    [5,  1],
  KeyO:      [5,  2],
  Digit0:    [5,  3],
  KeyP:      [5,  4],
};

const chans = [null, null, null, null, null, null];
const chansLru = [];

document.getElementById("body").addEventListener("keydown", (e) => {
  if (e.repeat) return;
  console.debug("Key down", e.code);
  audioContext.resume();

  const note = notes[e.code];
  if (!note) return;
  let chan = chans.findIndex((key) => key === null);
  if (chan === -1) {
    chan = chansLru.shift();
    audioNode.port.postMessage({
      cmd: "keyOff",
      args: { chan },
    });
  }

  chans[chan] = e.code;
  chansLru.push(chan);
  console.log(chan, chans, chansLru);
  audioNode.port.postMessage({
    cmd: "setNote",
    args: {
      chan,
      octave: note[0],
      note: note[1],
    },
  });
  audioNode.port.postMessage({
    cmd: "keyOn",
    args: { chan },
  });
});

document.getElementById("body").addEventListener("keyup", (e) => {
  if (e.repeat) return;
  console.debug("Key up", e.code);

  const chan = chans.findIndex((key) => key === e.code);
  if (chan === -1) return;
  chans[chan] = null;
  for (let i = chansLru.length - 1; i >= 0; i--) {
    if (chansLru[i] === chan) chansLru.splice(i, 1);
  }
  audioNode.port.postMessage({
    cmd: "keyOff",
    args: { chan },
  });
});
