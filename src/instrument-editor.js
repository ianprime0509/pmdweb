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

const svgNs = "http://www.w3.org/2000/svg";

class InstrumentChangeEvent extends Event {
  #data;

  constructor(data) {
    super("instrument-change");
    this.#data = data;
  }

  get data() {
    return this.#data;
  }
}

class InstrumentEditor extends HTMLElement {
  #data = `4   7
    31   0   0   3  15  38   0  11   3   0
    31  15   0   8  15  30   0  12   3   0
    31   6   0   1  11  33   0   1   3   0
    31   8   0   9  15   0   0   1   3   0`.split(/\s+/g).map((n) => Number.parseInt(n, 10));
  #name = "EPIANO2";
  #updateSlotAdsr = [];
  #updateMml;
  #externalUpdateHandlers = [];

  constructor() {
    super();
  }

  get data() {
    return structuredClone(this.#data);
  }

  update({ name, data }) {
    this.#name = name;
    this.#data = data;
    this.#externalUpdateHandlers.forEach((handler) => handler());
    this.#updateInstrument();
  }

  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.innerText = `
      input[type=text] {
        font-family: monospace;
      }

      :host {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0 1rem;
        justify-items: center;
      }

      #algorithm-selection {
        grid-column: 1 / -2;
        grid-row: 1 / span 2;

        display: grid;
        grid-template-columns: repeat(4, 1fr);
        width: 100%;
      }

      #algorithm-selection input {
        appearance: none;
      }

      #algorithm-selection label {
        border: 1px solid transparent;
        padding: 4px;
      }

      #algorithm-selection input:checked + label {
        border: 1px solid blue;
      }

      #algorithm-selection svg {
        user-select: none;
      }

      .slot-heading {
        font-size: larger;
        text-align: center;
      }

      .control-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 1ch;
      }

      .control-container output {
        text-align: end;
        min-width: 3ch;
      }

      .algorithm-box {
        fill: none;
        stroke: black;
        stroke-width: 1;
      }

      .algorithm-line {
        fill: none;
        stroke: black;
        stroke-width: 1;
      }

      .algorithm-label-text {
        font-family: monospace;
        font-size: 8px;
        text-anchor: middle;
        dominant-baseline: middle;
        stroke: black;
      }

      #mml {
        grid-column: 1 / -1;
        width: 100%;
        height: 6rem;
        margin-top: 0.5rem;
        resize: none;
        white-space: pre;
      }
    `;
    shadow.append(style);

    shadow.append(this.#algorithmSelectionControl());

    shadow.append(this.#nameControl());

    shadow.append(this.#parameterControl({
      id: "feedback",
      name: "FB",
      desc: "Feedback",
      index: 1,
      min: 0,
      max: 7,
    }));

    for (let slotIndex = 0; slotIndex < 4; slotIndex++) {
      shadow.append(this.#slotHeading(slotIndex));
    }

    for (let slotIndex = 0; slotIndex < 4; slotIndex++) {
      shadow.append(this.#adsrDiagram(slotIndex));
    }

    for (const [paramIndex, param] of instrumentParams.entries()) {
      for (let slotIndex = 0; slotIndex < 4; slotIndex++) {
        const id = `slot-${slotIndex}-${param.name}`;
        const index = 2 + 10 * slotIndex + paramIndex;
        shadow.append(this.#parameterControl({
          id,
          index,
          ...param,
        }));
      }
    }

    shadow.append(this.#mmlDisplay());

    this.#updateInstrument();
  }

  #algorithmSelectionControl() {
    const control = document.createElement("div");
    control.id = "algorithm-selection";
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
        elem.setAttribute("x", x);
        elem.setAttribute("y", y);
        elem.setAttribute("class", "algorithm-label-text");
        elem.textContent = text;
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
      if (n === this.#data[0]) input.checked = true;
      input.addEventListener("input", () => {
        if (input.checked) {
          this.#data[0] = n;
          this.#updateInstrument();
        }
      });
      this.#externalUpdateHandlers.push(() => {
        input.checked = this.#data[0] === n;
      });
      container.append(input);

      const label = document.createElement("label");
      label.htmlFor = id;
      label.append(svg);
      container.append(label);

      control.append(container);
    }
    return control;
  }

  #nameControl() {
    const container = document.createElement("div");
    container.classList.add("control-container");
    const label = document.createElement("label");
    label.textContent = "Name";
    label.htmlFor = "name-input";
    container.append(label);
    const input = document.createElement("input");
    input.id = "name-input";
    input.type = "text";
    input.value = this.#name;
    input.addEventListener("input", () => {
      this.#name = input.value;
      this.#updateInstrument();
    });
    this.#externalUpdateHandlers.push(() => input.value = this.#name);
    container.append(input);
    return container;
  }

  #parameterControl({
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
    labelText.textContent = name;
    labelText.title = desc;
    label.append(labelText);
    label.htmlFor = id;
    control.append(label);
    const input = document.createElement("input");
    input.id = id;
    input.type = "range";
    input.min = min;
    input.max = max;
    input.value = this.#data[index];
    control.append(input);
    const output = document.createElement("output");
    output.textContent = this.#data[index];
    output.htmlFor = id;
    control.append(output);

    input.addEventListener("input", () => {
      output.textContent = input.value;
      this.#data[index] = input.valueAsNumber;
      this.#updateInstrument();
    });
    this.#externalUpdateHandlers.push(() => {
      let value = this.#data[index];
      if (min < 0 && (value & 0x80) !== 0) value = -(~value + 1);
      input.value = value;
      output.textContent = value;
    });

    return control;
  }

  #slotHeading(slotIndex) {
    const heading = document.createElement("div");
    heading.class = "slot-heading";
    heading.textContent = `Slot ${slotIndex + 1}`;
    return heading;
  }

  #adsrDiagram(slotIndex) {
    const svg = document.createElementNS(svgNs, "svg");
    const width = 160;
    const height = 100;
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    this.#updateSlotAdsr[slotIndex] = () => {
      svg.replaceChildren();

      const params = this.#data.slice(2 + 10 * slotIndex);
      const ar = params[0] / 31;
      const dr = params[1] / 31;
      const sr = params[2] / 31;
      const rr = params[3] / 15;
      const sl = params[4] / 15;
      const tl = params[5] / 127;
      let [x, y] = [0, height];
      const d = [`M${x},${y}`];
      const to = (x2, y2) => {
        x = x2;
        y = y2;
        d.push(`L${x},${y}`);
      };
      (() => {
        if (ar === 0) return to(width, y);
        to(x + width / ar / 31, height * tl);
        if (dr === 0) return to(width, y);
        to(x + width / dr / 31, y + (height - y) * sl);
        if (sr === 0) return to(width, y);
        to(width, y + (width - x) * sr, height);
      })();

      const path = document.createElementNS(svgNs, "path");
      path.setAttribute("class", "algorithm-line");
      path.setAttribute("d", d.join(" "));
      svg.append(path);

      const rline = document.createElementNS(svgNs, "line");
      const tlY = ar !== 0 ? height * tl : height;
      rline.setAttribute("x1", 0);
      rline.setAttribute("y1", tlY);
      if (rr !== 0) {
        rline.setAttribute("x2", width / rr / 15);
        rline.setAttribute("y2", height);
      } else {
        rline.setAttribute("x2", width);
        rline.setAttribute("y2", tlY);
      }
      rline.setAttribute("class", "algorithm-line");
      rline.setAttribute("stroke-dasharray", "5");
      svg.append(rline);
    };

    return svg;
  }

  #mmlDisplay() {
    const mml = document.createElement("textarea");
    mml.id = "mml";
    mml.disabled = true;
    this.#updateMml = (text) => mml.textContent = text;
    return mml;
  }

  #updateInstrument() {
      this.#updateSlotAdsr.forEach((func) => func());
      const fmtParams = (arr) => arr.map((n) => String(n).padStart(3, " ")).join(" ");
      const mmlLines = [`@  0 ` + fmtParams(this.#data.slice(0, 2))];
      if (this.#name !== "") {
        mmlLines[0] += `   =${this.#name}`;
      }
      for (let i = 0; i < 4; i++) {
        mmlLines.push(" " + fmtParams(this.#data.slice(2 + 10 * i).slice(0, 10)));
      }
      this.#updateMml(mmlLines.join("\n"));
      this.dispatchEvent(new InstrumentChangeEvent(this.data));
  }
}

customElements.define("instrument-editor", InstrumentEditor);
