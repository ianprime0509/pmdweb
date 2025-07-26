const instrumentParams = [
  { name: "AR", min: 0, max: 31 },
  { name: "DR", min: 0, max: 31 },
  { name: "SR", min: 0, max: 31 },
  { name: "RR", min: 0, max: 15 },
  { name: "SL", min: 0, max: 15 },
  { name: "TL", min: 0, max: 127 },
  { name: "KS", min: 0, max: 3 },
  { name: "ML", min: 0, max: 15 },
  { name: "DT", min: -3, max: 3 },
  { name: "AM", min: 0, max: 1 },
];

const algorithms = [
  [[1], [2], [3], [4]],
  [[1, 2], [3], [4]],
  [[0, 2], [1, 3], [4]],
  [[1, 0], [2, 3], [4]],
  [[1, 3], [2, 4]],
  [[1], [2, 3, 4]],
  [[1, 0, 0], [2, 3, 4]],
  [[1, 2, 3, 4]],
];

const instrument = `4   7
  31   0   0   3  15  38   0  11   3   0
  31  15   0   8  15  30   0  12   3   0
  31   6   0   1  11  33   0   1   3   0
  31   8   0   9  15   0   0   1   3   0`.split(/\s+/g).map((n) => Number.parseInt(n, 10));

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

const updateInstrument = () => audioNode.port.postMessage({
  cmd: "instrumentSet",
  args: { params: instrument },
});

const elemAlgorithmSelection = document.getElementById("algorithm-selection");
for (const [n, alg] of algorithms.entries()) {
  const id = `algorithm-${n}`;
  const input = document.createElement("input");
  input.id = id;
  input.type = "radio";
  input.name = "algorithm";
  if (n === instrument[0]) input.checked = true;
  elemAlgorithmSelection.append(input);

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const width = 100;
  const height = 100;
  const margin = 3;
  const boxSize = 16;
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const addText = (x, y, text) => {
    const elem = document.createElementNS(ns, "text");
    elem.innerText = text;
    elem.setAttribute("x", x);
    elem.setAttribute("y", y);
    elem.setAttribute("class", "algorithm-label-text");
    elem.append(text);
    svg.append(elem);
  };

  const addBox = (x, y) => {
    const elem = document.createElementNS(ns, "rect");
    elem.setAttribute("x", x - boxSize / 2);
    elem.setAttribute("y", y - boxSize / 2);
    elem.setAttribute("width", boxSize);
    elem.setAttribute("height", boxSize);
    elem.setAttribute("class", "algorithm-box");
    svg.append(elem);
  };

  const addPath = (path) => {
    const elem = document.createElementNS(ns, "path");
    elem.setAttribute("d", path);
    elem.setAttribute("class", "algorithm-line");
    svg.append(elem);
  };

  addText(width - boxSize / 2, boxSize / 2, n);

  let x = width / 2 - (alg.length - 1) * (margin + boxSize / 2);
  const deltaX = 2 * margin + boxSize;
  const startY = (col) => height / 2 - (col.length - 1) * (margin + boxSize / 2);
  const deltaY = 2 * margin + boxSize;
  for (const [i, col] of alg.entries()) {
    let y = startY(col);
    for (const slot of col) {
      if (slot !== 0) {
        addBox(x, y);
        addText(x, y, slot);
        if (i + 1 == alg.length) {
          // Feed to output
          addPath(`M${x + boxSize / 2},${y} l${margin},0 0,${height / 2 - y} L${width},${height / 2}`);
        } else if (alg[i + 1].length === col.length) {
          // Straight line to next node
          addPath(`M${x + boxSize / 2},${y} l${2 * margin},0`);
        } else {
          // Feed into all next nodes
          const nextCol = alg[i + 1];
          let y2 = startY(nextCol);
          for (let j = 0; j < nextCol.length; j++) {
            addPath(`M${x + boxSize / 2},${y} l${margin},0 0,${y2 - y} ${margin},0`);
            y2 += deltaY;
          }
        }
      }
      if (slot === 1) {
        addPath(`M${x + boxSize / 2},${y} l${margin},0 0,-${margin + boxSize / 2} -${2 * margin + boxSize},0 0,${margin + boxSize / 2} ${margin},0`);
      }
      y += deltaY;
    }
    x += deltaX;
  }

  const label = document.createElement("label");
  label.htmlFor = id;
  label.append(svg);
  elemAlgorithmSelection.append(label);

  input.addEventListener("input", () => {
    if (input.checked) {
      instrument[0] = n;
      updateInstrument();
    }
  });
}

(() => {
  const valueIndex = 1;
  const control = document.createElement("div");
  control.classList.add("control-container");
  const id = "feedback";
  const label = document.createElement("label");
  label.innerText = "FB";
  label.htmlFor = id;
  control.append(label);
  const input = document.createElement("input");
  input.id = id;
  input.type = "range";
  input.min = 0;
  input.max = 7;
  input.value = instrument[valueIndex];
  control.append(input);
  const output = document.createElement("output");
  output.innerText = instrument[valueIndex];
  output.htmlFor = id;
  control.append(output);
  elemAlgorithmSelection.insertAdjacentElement("afterend", control);

  input.addEventListener("input", () => {
    output.innerText = input.value;
    instrument[valueIndex] = input.valueAsNumber;
    updateInstrument();
  });
})();

const elemInstrumentEditor = document.getElementById("instrument-editor");

for (const [paramIndex, param] of instrumentParams.entries()) {
  for (let slotIndex = 0; slotIndex < 4; slotIndex++) {
    const valueIndex = 2 + 10 * slotIndex + paramIndex;
    const control = document.createElement("div");
    control.classList.add("control-container");
    const id = `slot-${slotIndex}-${param.name}`;
    const label = document.createElement("label");
    label.innerText = param.name;
    label.htmlFor = id;
    control.append(label);
    const input = document.createElement("input");
    input.id = id;
    input.type = "range";
    input.min = param.min;
    input.max = param.max;
    input.value = instrument[valueIndex];
    control.append(input);
    const output = document.createElement("output");
    output.innerText = instrument[valueIndex];
    output.htmlFor = id;
    control.append(output);
    elemInstrumentEditor.append(control);

    input.addEventListener("input", () => {
      output.innerText = input.value;
      instrument[valueIndex] = input.valueAsNumber;
      updateInstrument();
    });
  }
}

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

updateInstrument();
