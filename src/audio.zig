const std = @import("std");
const Ym2608 = @import("ymfm").Ym2608;

const gpa = std.heap.wasm_allocator;
var sample_buffer: [256]f32 = undefined;
var instrument_buffer: [42]u8 = @splat(0);
var chip: *Ym2608 = undefined;

const chip_clock = 8_000_000;
const Time = enum(u64) {
    _,

    const zero: Time = @enumFromInt(0);
    const second: Time = @enumFromInt(0x1_0000_0000);

    fn sample(rate: u32) Time {
        return @enumFromInt(@intFromEnum(Time.second) / rate);
    }

    fn plus(a: Time, b: Time) Time {
        return @enumFromInt(@intFromEnum(a) + @intFromEnum(b));
    }

    fn order(a: Time, b: Time) std.math.Order {
        return std.math.order(@intFromEnum(a), @intFromEnum(b));
    }
};
const audio_sample_time: Time = .sample(44_100);
var chip_sample_time: Time = undefined;

export fn init() void {
    chip = Ym2608.init() catch oom();
    chip.reset();
    chip_sample_time = .sample(chip.sampleRate(chip_clock));

    setRegister(.low(0x29), 0x80);
}

export fn getSampleBuffer() [*]f32 {
    return &sample_buffer;
}

export fn generateSamples(n: u32) void {
    const g = struct {
        var audio_time: Time = .zero;
        var chip_time: Time = .zero;
    };

    for (0..n) |i| {
        applyRegister();
        var sample: [1]Ym2608.Sample = undefined;
        while (g.chip_time.order(g.audio_time) != .gt) : (g.chip_time = g.chip_time.plus(chip_sample_time)) {
            chip.generate(&sample);
        }
        sample_buffer[2 * i] = @as(f32, @floatFromInt(sample[0].fm_left + sample[0].ssg)) / std.math.maxInt(i16);
        sample_buffer[2 * i + 1] = @as(f32, @floatFromInt(sample[0].fm_right + sample[0].ssg)) / std.math.maxInt(i16);
        g.audio_time = g.audio_time.plus(audio_sample_time);
    }
}

export fn getInstrumentBuffer() [*]u8 {
    return &instrument_buffer;
}

var rng: std.Random.DefaultPrng = .init(0);

export fn setInstrument(chan: u8) void {
    const base: Ym2608.Register = .init(@intCast(chan / 3), chan % 3);

    const alg = instrument_buffer[0] & 7;
    const fb = instrument_buffer[1] & 7;
    setRegister(base.offset(0xB0), (fb << 3) | alg); // FB/Algorithm
    const params = instrument_buffer[2..];
    setInstrumentSlot(base.offset(0x30), params[0..10]);
    setInstrumentSlot(base.offset(0x38), params[10..20]);
    setInstrumentSlot(base.offset(0x34), params[20..30]);
    setInstrumentSlot(base.offset(0x3C), params[30..40]);
}

fn setInstrumentSlot(reg: Ym2608.Register, params: *const [10]u8) void {
    const ar = params[0] & 0x1F;
    const dr = params[1] & 0x1F;
    const sr = params[2] & 0x1F;
    const rr = params[3] & 0xF;
    const sl = params[4] & 0xF;
    const tl = params[5] & 0x7F;
    const ks = params[6] & 0x3;
    const ml = params[7] & 0xF;
    const dt = params[8] & 0x7;
    const am = params[9] & 0x1;
    setRegister(reg, (dt << 4) | ml); // DT/MULTI
    setRegister(reg.offset(0x10), tl); // TL
    setRegister(reg.offset(0x20), (ks << 6) | ar); // KS/AR
    setRegister(reg.offset(0x30), (am << 7) | dr); // AM/DR
    setRegister(reg.offset(0x40), sr); // SR
    setRegister(reg.offset(0x50), (sl << 4) | rr); // SL/RR
}

const fnums: []const u16 = &.{
    0x026A,
    0x028F,
    0x02B6,
    0x02DF,
    0x030B,
    0x0339,
    0x036A,
    0x039E,
    0x03D5,
    0x0410,
    0x044E,
    0x048F,
};

fn setNote(chan: u8, octave: u8, note: u8) void {
    const base: Ym2608.Register = .init(@intCast(chan / 3), chan % 3);
    const block = octave - 1;
    const fnum = fnums[note];
    setRegister(base.offset(0xA4), (block << 3) | @as(u8, @intCast(fnum >> 8)));
    setRegister(base.offset(0xA0), @intCast(fnum & 0xFF));
}

export fn keyOn() void {
    setNote(0, 4, 0);
    setNote(1, 4, 4);
    setNote(2, 4, 7);
    setNote(3, 4, 10);
    setRegister(.low(0x28), 0xF0);
    setRegister(.low(0x28), 0xF1);
    setRegister(.low(0x28), 0xF2);
    setRegister(.low(0x28), 0xF4);
}

export fn keyOff() void {
    setRegister(.low(0x28), 0x00);
    setRegister(.low(0x28), 0x01);
    setRegister(.low(0x28), 0x02);
    setRegister(.low(0x28), 0x04);
}

var regQueue: [1024]struct { Ym2608.Register, u8 } = undefined;
var regQueueTail: usize = 0;
var regQueueHead: usize = 0;

fn setRegister(r: Ym2608.Register, data: u8) void {
    regQueue[regQueueHead] = .{ r, data };
    regQueueHead = (regQueueHead + 1) % regQueue.len;
}

fn applyRegister() void {
    if (regQueueTail != regQueueHead) {
        const r, const data = regQueue[regQueueTail];
        chip.write(r, data);
        regQueueTail = (regQueueTail + 1) % regQueue.len;
    }
}

fn oom() noreturn {
    @panic("OOM");
}
