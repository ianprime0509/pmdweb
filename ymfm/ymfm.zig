const std = @import("std");

pub const Ym2608 = opaque {
    pub const Register = packed struct {
        n: u8,
        port: u1,

        pub fn init(port: u1, n: u8) Register {
            return .{ .port = port, .n = n };
        }

        pub fn low(n: u8) Register {
            return .{ .n = n, .port = 0 };
        }

        pub fn high(n: u8) Register {
            return .{ .n = n, .port = 1 };
        }

        pub fn offset(r: Register, off: u8) Register {
            return .{
                .n = r.n + off,
                .port = r.port,
            };
        }
    };

    pub const Sample = extern struct {
        fm_left: i32,
        fm_right: i32,
        ssg: i32,
    };

    extern fn ym2608_new() ?*Ym2608;
    extern fn ym2608_delete(chip: *Ym2608) void;
    extern fn ym2608_reset(chip: *Ym2608) void;
    extern fn ym2608_sample_rate(chip: *Ym2608, input_clock: u32) u32;
    extern fn ym2608_write_address(chip: *Ym2608, data: u8) void;
    extern fn ym2608_write_address_hi(chip: *Ym2608, data: u8) void;
    extern fn ym2608_write_data(chip: *Ym2608, data: u8) void;
    extern fn ym2608_write_data_hi(chip: *Ym2608, data: u8) void;
    extern fn ym2608_generate(chip: *Ym2608, output: [*]Sample, numsamples: u32) void;

    pub fn init() error{OutOfMemory}!*Ym2608 {
        return ym2608_new() orelse error.OutOfMemory;
    }

    pub fn deinit(chip: *Ym2608) void {
        ym2608_delete(chip);
    }

    pub fn reset(chip: *Ym2608) void {
        ym2608_reset(chip);
    }

    pub fn sampleRate(chip: *Ym2608, input_clock: u32) u32 {
        return ym2608_sample_rate(chip, input_clock);
    }

    pub fn write(chip: *Ym2608, register: Register, data: u8) void {
        switch (register.port) {
            0 => {
                chip.writeAddress(register.n);
                chip.writeData(data);
            },
            1 => {
                chip.writeAddressHi(register.n);
                chip.writeDataHi(data);
            },
        }
    }

    pub fn writeAddress(chip: *Ym2608, data: u8) void {
        ym2608_write_address(chip, data);
    }

    pub fn writeAddressHi(chip: *Ym2608, data: u8) void {
        ym2608_write_address_hi(chip, data);
    }

    pub fn writeData(chip: *Ym2608, data: u8) void {
        ym2608_write_data(chip, data);
    }

    pub fn writeDataHi(chip: *Ym2608, data: u8) void {
        ym2608_write_data_hi(chip, data);
    }

    pub fn generate(chip: *Ym2608, output: []Sample) void {
        ym2608_generate(chip, output.ptr, @intCast(output.len));
    }
};
