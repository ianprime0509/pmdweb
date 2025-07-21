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
    params: `2   7
  31  24   4   4   2  41   0   3   4   0
  31   0   0   4  15  41   0   1   3   0
  31   7   0   1  11  43   0   2   3   0
  29   9   0   9  15   0   0   1   3   0`.split(/\s+/g).map((n) => Number.parseInt(n, 10)),
  },
});

document.getElementById("button-play").addEventListener("click", () => {
  audioContext.resume();
});

document.getElementById("button-stop").addEventListener("click", () => {
  audioContext.suspend();
});

document.getElementById("button-key-on").addEventListener("click", () => {
  audioNode.port.postMessage({ cmd: "keyOn" });
});

document.getElementById("button-key-off").addEventListener("click", () => {
  audioNode.port.postMessage({ cmd: "keyOff" });
});
