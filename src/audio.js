class AudioProcessor extends AudioWorkletProcessor {
  x = 0;
  frequency = 440;
  wasm;
  sampleBuffer;
  instrumentBuffer;

  constructor({ processorOptions: { wasmSource } }) {
    super();

    const wasm_module = new WebAssembly.Module(wasmSource);
    const ENOTSUP = 58;
    const processor = this;
    this.wasm = new WebAssembly.Instance(wasm_module, {
      wasi_snapshot_preview1: {
        args_get() { return ENOTSUP; },
        args_sizes_get() { return ENOTSUP; },
        clock_res_get() { return ENOTSUP; },
        clock_time_get() { return ENOTSUP; },
        environ_get() { return ENOTSUP; },
        environ_sizes_get() { return ENOTSUP; },
        fd_advise() { return ENOTSUP; },
        fd_allocate() { return ENOTSUP; },
        fd_close() { return ENOTSUP; },
        fd_datasync() { return ENOTSUP; },
        fd_fdstat_get() { return ENOTSUP; },
        fd_fdstat_set_flags() { return ENOTSUP; },
        fd_fdstat_set_rights() { return ENOTSUP; },
        fd_filestat_get() { return ENOTSUP; },
        fd_filestat_set_size() { return ENOTSUP; },
        fd_filestat_set_times() { return ENOTSUP; },
        fd_pread() { return ENOTSUP; },
        fd_prestat_dir_name() { return ENOTSUP; },
        fd_prestat_get() { return ENOTSUP; },
        fd_pwrite() { return ENOTSUP; },
        fd_read() { return ENOTSUP; },
        fd_readdir() { return ENOTSUP; },
        fd_renumber() { return ENOTSUP; },
        fd_seek() { return ENOTSUP; },
        fd_sync() { return ENOTSUP; },
        fd_tell() { return ENOTSUP; },
        fd_write(fd, iovs, iovsLen, nWritten) {
          // Temporary stub implementation that writes nothing
          // TODO: use of Uint32Array won't work correctly on big endian
          const iovsData = new Uint32Array(processor.wasm.exports.memory.buffer, iovs, iovsLen * 2);
          let n = 0;
          for (let i = 0; i < iovsLen; i++) {
            n += iovsData[2 * i + 1];
          }
          const retData = new Uint32Array(processor.wasm.exports.memory.buffer, nWritten, 1);
          retData[0] = n;
          return 0;
        },
        path_create_directory() { return ENOTSUP; },
        path_filestat_get() { return ENOTSUP; },
        path_filestat_set_times() { return ENOTSUP; },
        path_link() { return ENOTSUP; },
        path_open() { return ENOTSUP; },
        path_readlink() { return ENOTSUP; },
        path_remove_directory() { return ENOTSUP; },
        path_rename() { return ENOTSUP; },
        path_symlink() { return ENOTSUP; },
        path_unlink_file() { return ENOTSUP; },
        poll_oneoff() { return ENOTSUP; },
        proc_exit() { return ENOTSUP; },
        random_get() { return ENOTSUP; },
        sched_yield() { return ENOTSUP; },
        sock_accept() { return ENOTSUP; },
        sock_recv() { return ENOTSUP; },
        sock_send() { return ENOTSUP; },
        sock_shutdown() { return ENOTSUP; },
      },
    });
    this.wasm.exports.init();
    this.sampleBuffer = new Float32Array(this.wasm.exports.memory.buffer, this.wasm.exports.getSampleBuffer(), 256);
    this.instrumentBuffer = new Uint8Array(this.wasm.exports.memory.buffer, this.wasm.exports.getInstrumentBuffer(), 42);

    this.port.addEventListener("message", ({ data: { cmd, args } }) => {
      console.debug("Received command", cmd, args);
      const method = "handle" + cmd.substring(0, 1).toUpperCase() + cmd.substring(1);
      this[method](args);
    });
    this.port.start();
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const totalSamples = output[0].length;
    let completedSamples = 0;
    while (completedSamples < totalSamples) {
      const blockSize = Math.min(totalSamples, 128);
      this.wasm.exports.generateSamples(blockSize);
      for (let i = completedSamples; i < completedSamples + blockSize; i++) {
        output[0][i] = this.sampleBuffer[2 * i];
        output[1][i] = this.sampleBuffer[2 * i + 1];
      }
      completedSamples += blockSize;
    }
    return true;
  }

  handleInstrumentSet({ params }) {
    this.instrumentBuffer.set(params);
    for (let i = 0; i < 6; i++) {
      this.wasm.exports.setInstrument(i);
    }
  }

  handleKeyOn() {
    this.wasm.exports.keyOn();
  }

  handleKeyOff() {
    this.wasm.exports.keyOff();
  }
}

registerProcessor("audio-processor", AudioProcessor);
