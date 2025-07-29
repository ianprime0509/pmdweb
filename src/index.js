const instrumentParams = [
  { name: "AR", desc: "Attack Rate", min: 0, max: 31 },
  { name: "DR", desc: "Decay Rate", min: 0, max: 31 },
  { name: "SR", desc: "Sustain Rate", min: 0, max: 31 },
  { name: "RR", desc: "Release Rate", min: 0, max: 15 },
  { name: "SL", desc: "Sustain Level", min: 0, max: 15 },
  { name: "TL", desc: "Total Level", min: 0, max: 127 },
  { name: "KS", desc: "Key Scale", min: 0, max: 3 },
  { name: "ML", desc: "Multiple", min: 0, max: 15 },
  { name: "DT", desc: "Detune", min: -3, max: 3 },
  { name: "AM", desc: "Amplitude Modulation", min: 0, max: 1 },
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

const updateSlotAdsr = [() => {}, () => {}, () => {}, () => {}];
const updateInstrument = () => {
  updateSlotAdsr.forEach((func) => func());
  audioNode.port.postMessage({
    cmd: "instrumentSet",
    args: { params: instrument },
  });
};

const svgNs = "http://www.w3.org/2000/svg";

const elemAlgorithmSelection = document.getElementById("algorithm-selection");
for (const [n, alg] of algorithms.entries()) {
  const svg = document.createElementNS(svgNs, "svg");
  const width = 100;
  const height = 100;
  const margin = 3;
  const boxSize = 16;
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const addText = (x, y, text) => {
    const elem = document.createElementNS(svgNs, "text");
    elem.innerText = text;
    elem.setAttribute("x", x);
    elem.setAttribute("y", y);
    elem.setAttribute("class", "algorithm-label-text");
    elem.append(text);
    svg.append(elem);
  };

  const addBox = (x, y) => {
    const elem = document.createElementNS(svgNs, "rect");
    elem.setAttribute("x", x - boxSize / 2);
    elem.setAttribute("y", y - boxSize / 2);
    elem.setAttribute("width", boxSize);
    elem.setAttribute("height", boxSize);
    elem.setAttribute("class", "algorithm-box");
    svg.append(elem);
  };

  const addPath = (path) => {
    const elem = document.createElementNS(svgNs, "path");
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

  const container = document.createElement("div");
  container.classList.add("control-container");

  const id = `algorithm-${n}`;
  const input = document.createElement("input");
  input.id = id;
  input.type = "radio";
  input.name = "algorithm";
  if (n === instrument[0]) input.checked = true;
  container.append(input);

  const label = document.createElement("label");
  label.htmlFor = id;
  label.append(svg);
  container.append(label);

  elemAlgorithmSelection.append(container);

  input.addEventListener("input", () => {
    if (input.checked) {
      instrument[0] = n;
      updateInstrument();
    }
  });
}

elemAlgorithmSelection.insertAdjacentElement("afterend", parameterControl({
  id: "feedback",
  name: "FB",
  desc: "Feedback",
  index: 1,
  min: 0,
  max: 7,
}));

const elemInstrumentEditor = document.getElementById("instrument-editor");

for (let slotIndex = 0; slotIndex < 4; slotIndex++) {
  const svg = document.createElementNS(svgNs, "svg");
  const width = 160;
  const height = 100;
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  updateSlotAdsr[slotIndex] = () => {
    svg.replaceChildren();

    const params = instrument.slice(2 + 10 * slotIndex);
    const ar = params[0] / 31;
    const dr = params[1] / 31;
    const sr = params[2] / 31;
    const rr = params[3] / 15;
    const sl = params[4] / 15;
    const tl = params[5] / 127;
    const releaseX = width * 4 / 5;
    let [x, y] = [0, height];
    const d = [`M${x},${y}`];
    let maxX = releaseX;
    const to = (x2, y2) => {
      x = Math.min(x2, maxX);
      y = Math.min(y2, height);
      d.push(`L${x},${y}`);
    };
    (() => {
      if (ar === 0) return to(width, y);
      to(x + width / ar / 32, height * tl);
      if (dr === 0) return to(width, y);
      to(x + width / dr / 32, y + (height - y) * sl);
      if (sr === 0) return to(width, y);
      to(maxX, y + (maxX - x) * sr, height);
    })();
    maxX = width;
    if (rr !== 0) to(x + width / rr / 32, height);
    to(width, y);

    const path = document.createElementNS(svgNs, "path");
    path.setAttribute("class", "algorithm-line");
    path.setAttribute("d", d.join(" "));
    svg.append(path);

    const rline = document.createElementNS(svgNs, "line");
    rline.setAttribute("x1", releaseX);
    rline.setAttribute("y1", 0);
    rline.setAttribute("x2", releaseX);
    rline.setAttribute("y2", height);
    rline.setAttribute("class", "algorithm-line");
    rline.setAttribute("stroke-dasharray", "5");
    svg.append(rline);
  };

  elemInstrumentEditor.append(svg);
}

for (const [paramIndex, param] of instrumentParams.entries()) {
  for (let slotIndex = 0; slotIndex < 4; slotIndex++) {
    const id = `slot-${slotIndex}-${param.name}`;
    const index = 2 + 10 * slotIndex + paramIndex;
    elemInstrumentEditor.append(parameterControl({
      id,
      index,
      ...param,
    }));
  }
}

function parameterControl({
  id,
  name,
  desc,
  index,
  min,
  max,
}) {
  const control = document.createElement("div");
  control.classList.add("control-container");
  const label = document.createElement("label");
  const labelText = document.createElement("abbr");
  labelText.innerText = name;
  labelText.title = desc;
  label.append(labelText);
  label.htmlFor = id;
  control.append(label);
  const input = document.createElement("input");
  input.id = id;
  input.type = "range";
  input.min = min;
  input.max = max;
  input.value = instrument[index];
  control.append(input);
  const output = document.createElement("output");
  output.innerText = instrument[index];
  output.htmlFor = id;
  control.append(output);

  input.addEventListener("input", () => {
    output.innerText = input.value;
    instrument[index] = input.valueAsNumber;
    updateInstrument();
  });

  return control;
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
