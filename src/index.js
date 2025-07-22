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
audioNode.port.postMessage({
  cmd: "instrumentSet",
  args: {
    params: `4   7
  31   0   0   3  15  38   0  11   3   0
  31  15   0   8  15  30   0  12   3   0
  31   6   0   1  11  33   0   1   3   0
  31   8   0   9  15   0   0   1   3   0`.split(/\s+/g).map((n) => Number.parseInt(n, 10)),
  },
});

document.getElementById("button-play").addEventListener("click", () => {
  audioContext.resume();
});

document.getElementById("button-stop").addEventListener("click", () => {
  audioContext.suspend();
});

const notes = {
  KeyZ:   [3,  0],
  KeyS:   [3,  1],
  KeyX:   [3,  2],
  KeyD:   [3,  3],
  KeyC:   [3,  4],
  KeyV:   [3,  5],
  KeyG:   [3,  6],
  KeyB:   [3,  7],
  KeyH:   [3,  8],
  KeyN:   [3,  9],
  KeyJ:   [3, 10],
  KeyM:   [3, 11],
  Comma:  [4,  0],

  KeyQ:   [4,  0],
  Digit2: [4,  1],
  KeyW:   [4,  2],
  Digit3: [4,  3],
  KeyE:   [4,  4],
  KeyR:   [4,  5],
  Digit5: [4,  6],
  KeyT:   [4,  7],
  Digit6: [4,  8],
  KeyY:   [4,  9],
  Digit7: [4, 10],
  KeyU:   [4, 11],

  KeyI:   [5,  0],
};

const chans = [null, null, null, null, null, null];

document.getElementById("body").addEventListener("keydown", (e) => {
  audioContext.resume();
  if (e.repeat) return;
  console.debug("Key down", e.code);
  const chan = chans.findIndex((key) => key === null);
  if (chan === -1) return;
  const note = notes[e.code];
  if (note) {
    chans[chan] = e.code;
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
      args: {
        chan,
      },
    });
  }
});

document.getElementById("body").addEventListener("keyup", (e) => {
  audioContext.resume();
  if (e.repeat) return;
  console.debug("Key up", e.code);
  const chan = chans.findIndex((key) => key === e.code);
  if (chan === -1) return;
  chans[chan] = null;
  audioNode.port.postMessage({
    cmd: "keyOff",
    args: {
      chan,
    },
  });
});
