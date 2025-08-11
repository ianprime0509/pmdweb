const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .wasi,
    });
    const optimize = b.standardOptimizeOption(.{});

    const ymfm_cpp_dep = b.dependency("ymfm", .{});
    const ymfm_cpp_mod = b.createModule(.{
        .target = target,
        .optimize = optimize,
        .link_libcpp = true,
    });
    ymfm_cpp_mod.addIncludePath(ymfm_cpp_dep.path("src"));
    ymfm_cpp_mod.addCSourceFiles(.{
        .root = ymfm_cpp_dep.path("src"),
        .files = &.{
            "ymfm_opn.cpp",
            "ymfm_adpcm.cpp",
            "ymfm_ssg.cpp",
        },
    });
    const ymfm_cpp_lib = b.addLibrary(.{
        .name = "ymfm",
        .root_module = ymfm_cpp_mod,
    });
    ymfm_cpp_lib.installHeadersDirectory(ymfm_cpp_dep.path("src"), ".", .{});
    b.installArtifact(ymfm_cpp_lib);

    const ymfm_mod = b.createModule(.{
        .root_source_file = b.path("ymfm/ymfm.zig"),
        .target = target,
        .optimize = optimize,
        .link_libcpp = true,
    });
    ymfm_mod.linkLibrary(ymfm_cpp_lib);
    ymfm_mod.addCSourceFiles(.{
        .root = b.path("ymfm"),
        .files = &.{"ym2608.cpp"},
    });

    const audio_wasm_mod = b.createModule(.{
        .root_source_file = b.path("src/audio.zig"),
        .target = target,
        .optimize = optimize,
        .imports = &.{
            .{ .name = "ymfm", .module = ymfm_mod },
        },
    });
    const audio_wasm_exe = b.addExecutable(.{
        .name = "audio",
        .root_module = audio_wasm_mod,
    });
    audio_wasm_exe.entry = .disabled;
    audio_wasm_exe.wasi_exec_model = .reactor;
    audio_wasm_exe.rdynamic = true;

    const static_files: []const []const u8 = &.{
        "audio.js",
        "index.html",
        "index.js",
        "instrument-editor.js",
    };
    const ui_dir: std.Build.InstallDir = .{ .custom = "ui" };
    for (static_files) |static_file| {
        b.getInstallStep().dependOn(&b.addInstallFileWithDir(
            b.path("src").join(b.allocator, static_file) catch @panic("OOM"),
            ui_dir,
            static_file,
        ).step);
    }
    b.getInstallStep().dependOn(&b.addInstallFileWithDir(audio_wasm_exe.getEmittedBin(), ui_dir, "audio.wasm").step);
}
