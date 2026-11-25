# Third-party notices

This file is generated from the resolved Cargo dependency graph (`Cargo.lock`) using Cargo package metadata. It records every external package and its declared SPDX license expression, including target-specific and build dependencies. Keep this inventory with source or binary distributions; the upstream package metadata and source archive contain the corresponding copyright notices and license texts.

## Project license

The Newbox workspace is licensed under GPL-3.0-or-later. The project retains its existing license after replacing yash-syntax with the MIT-licensed brush-parser. See [`LICENSE`](LICENSE).

## Vendored and modified code

- `vendor/jaq-core` (3.1.2) and `vendor/jaq-json` (2.0.3) are Copyright Michael Färber, MIT licensed. Each directory includes `LICENSE-MIT`, `NEWBOX_UPSTREAM.json`, and `NEWBOX_PATCH.md`; Newbox patches numeric/string lexing, literal normalization, number formatting and selected runtime error values. Newbox-authored additions retain the project GPL-3.0-or-later license.
- `vendor/jaq-std` is jaq-std 3.0.4, Copyright Michael Färber, MIT licensed. Its license text is included at [`vendor/jaq-std/LICENSE-MIT`](vendor/jaq-std/LICENSE-MIT). Newbox removes or disables environment, clock, input iteration, ambient debug/stderr implementations, and module-loading functions; see [`vendor/jaq-std/NEWBOX_PATCH.md`](vendor/jaq-std/NEWBOX_PATCH.md).
- `vendor/eawk` is eawk 0.1.1, Copyright the eawk authors, Apache-2.0 licensed. Its license text is included at [`vendor/eawk/LICENSE`](vendor/eawk/LICENSE). Newbox disables host file opening, AWK file redirection, command execution, and command pipes, and fixes input value classification, FILENAME/FNR and array-key compatibility; see [`vendor/eawk/NEWBOX_PATCH.md`](vendor/eawk/NEWBOX_PATCH.md).
- `vendor/brush-parser` is brush-parser 0.4.0, MIT licensed. The upstream license is included at [`vendor/brush-parser/LICENSE`](vendor/brush-parser/LICENSE). Parser compatibility fixes and guest dependency restrictions are recorded in [`vendor/brush-parser/NEWBOX_PATCH.md`](vendor/brush-parser/NEWBOX_PATCH.md). No brush shell executor is included.
- Other dependencies are consumed from crates.io and are not copied into this repository. The complete resolved package and license expression inventory follows.

The source-only Go prototype that was previously kept under `cmd/` and `internal/` has been removed from the release tree. It was never linked by a Rust build target; the historical compatibility results remain under `evals/`. Its former module licenses were:

| Package | Version | License |
| --- | --- | --- |
| `mvdan.cc/sh/v3` | 3.14.1 | BSD-3-Clause |
| `golang.org/x/sys` | 0.47.0 | BSD-3-Clause |
| Go standard library | Go 1.26 | BSD-3-Clause |
| `github.com/benhoyt/goawk` | 1.32.0 | MIT |
| `github.com/itchyny/gojq` | 0.12.20 | MIT |
| `github.com/itchyny/timefmt-go` | 0.1.9 | MIT |
| `github.com/tetratelabs/wazero` | 1.12.0 | Apache-2.0 |

## Resolved Cargo dependency license inventory

| Package | Version | Declared license |
| --- | --- | --- |
| `adler2` | 2.0.1 | 0BSD OR MIT OR Apache-2.0 |
| `ahash` | 0.8.12 | MIT OR Apache-2.0 |
| `aho-corasick` | 1.1.5 | Unlicense OR MIT |
| `allocator-api2` | 0.2.21 | MIT OR Apache-2.0 |
| `ambient-authority` | 0.0.2 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `android_system_properties` | 0.1.6 | MIT OR Apache-2.0 |
| `anyhow` | 1.0.104 | MIT OR Apache-2.0 |
| `arrayvec` | 0.7.8 | MIT OR Apache-2.0 |
| `async-trait` | 0.1.92 | MIT OR Apache-2.0 |
| `atomic-polyfill` | 1.0.3 | MIT OR Apache-2.0 |
| `autocfg` | 1.5.1 | Apache-2.0 OR MIT |
| `base64` | 0.22.1 | MIT OR Apache-2.0 |
| `bitflags` | 2.13.2 | MIT OR Apache-2.0 |
| `block-buffer` | 0.10.4 | MIT OR Apache-2.0 |
| `bon` | 3.10.3 | MIT OR Apache-2.0 |
| `bon-macros` | 3.10.3 | MIT OR Apache-2.0 |
| `brush-parser` | 0.4.0 | MIT |
| `bstr` | 1.13.1 | MIT OR Apache-2.0 |
| `bumpalo` | 3.20.3 | MIT OR Apache-2.0 |
| `byteorder` | 1.5.0 | Unlicense OR MIT |
| `bytes` | 1.12.1 | MIT |
| `cached` | 0.59.0 | MIT |
| `cached_proc_macro` | 0.27.0 | MIT |
| `cached_proc_macro_types` | 0.1.1 | MIT |
| `cap-fs-ext` | 3.4.6 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `cap-primitives` | 3.4.6 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `cap-primitives` | 4.0.3 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `cap-rand` | 3.4.6 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `cap-std` | 3.4.6 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `cap-std` | 4.0.3 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `cap-time-ext` | 3.4.6 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `cc` | 1.11.1 | MIT OR Apache-2.0 |
| `cfg-if` | 1.0.5 | MIT OR Apache-2.0 |
| `cobs` | 0.3.0 | MIT OR Apache-2.0 |
| `codesnake` | 0.3.0 | MIT |
| `core-foundation-sys` | 0.8.7 | MIT OR Apache-2.0 |
| `cpufeatures` | 0.2.17 | MIT OR Apache-2.0 |
| `crabz2` | 0.7.0 | MIT |
| `crc32fast` | 1.5.5 | MIT OR Apache-2.0 |
| `critical-section` | 1.2.0 | MIT OR Apache-2.0 |
| `crypto-common` | 0.1.7 | MIT OR Apache-2.0 |
| `darling` | 0.20.11 | MIT |
| `darling` | 0.24.1 | MIT |
| `darling_core` | 0.20.11 | MIT |
| `darling_core` | 0.24.1 | MIT |
| `darling_macro` | 0.20.11 | MIT |
| `darling_macro` | 0.24.1 | MIT |
| `digest` | 0.10.7 | MIT OR Apache-2.0 |
| `dyn-clone` | 1.0.20 | MIT OR Apache-2.0 |
| `eawk` | 0.1.1 | Apache-2.0 |
| `embedded-io` | 0.4.0 | MIT OR Apache-2.0 |
| `embedded-io` | 0.6.1 | MIT OR Apache-2.0 |
| `equivalent` | 1.0.3 | Apache-2.0 OR MIT |
| `errno` | 0.3.14 | MIT OR Apache-2.0 |
| `fd-lock` | 4.0.4 | MIT OR Apache-2.0 |
| `find-msvc-tools` | 0.1.15 | MIT OR Apache-2.0 |
| `flate2` | 1.1.11 | MIT OR Apache-2.0 |
| `fnv` | 1.0.7 | Apache-2.0 / MIT |
| `foldhash` | 0.1.5 | Zlib |
| `foldhash` | 0.2.0 | Zlib |
| `fs-set-times` | 0.20.3 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `futures-core` | 0.3.34 | MIT OR Apache-2.0 |
| `futures-task` | 0.3.34 | MIT OR Apache-2.0 |
| `futures-util` | 0.3.34 | MIT OR Apache-2.0 |
| `generic-array` | 0.14.7 | MIT |
| `getrandom` | 0.2.17 | MIT OR Apache-2.0 |
| `getrandom` | 0.4.3 | MIT OR Apache-2.0 |
| `glob` | 0.3.4 | MIT OR Apache-2.0 |
| `hash32` | 0.2.1 | MIT OR Apache-2.0 |
| `hashbrown` | 0.15.5 | MIT OR Apache-2.0 |
| `hashbrown` | 0.16.1 | MIT OR Apache-2.0 |
| `hashbrown` | 0.17.1 | MIT OR Apache-2.0 |
| `heapless` | 0.7.17 | MIT OR Apache-2.0 |
| `heck` | 0.5.0 | MIT OR Apache-2.0 |
| `hifijson` | 0.5.0 | MIT |
| `iana-time-zone` | 0.1.65 | MIT OR Apache-2.0 |
| `iana-time-zone-haiku` | 0.1.2 | MIT OR Apache-2.0 |
| `ident_case` | 1.0.1 | MIT/Apache-2.0 |
| `indenter` | 0.3.4 | MIT OR Apache-2.0 |
| `indexmap` | 2.14.2 | Apache-2.0 OR MIT |
| `io-extras` | 0.18.4 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `io-extras` | 0.19.0 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `io-lifetimes` | 2.0.4 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `io-lifetimes` | 3.0.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `ipnet` | 2.12.2 | MIT OR Apache-2.0 |
| `itoa` | 1.0.19 | MIT OR Apache-2.0 |
| `jaq-all` | 0.4.0 | MIT |
| `jaq-core` | 3.1.2 | MIT |
| `jaq-fmts` | 0.1.1 | MIT |
| `jaq-json` | 2.0.3 | MIT |
| `jaq-std` | 3.0.4 | MIT |
| `jiff` | 0.2.42 | Unlicense OR MIT |
| `jiff-core` | 0.1.4 | Unlicense OR MIT |
| `jiff-static` | 0.2.42 | Unlicense OR MIT |
| `jiff-tzdb` | 0.1.9 | Unlicense OR MIT |
| `jiff-tzdb-platform` | 0.1.3 | Unlicense OR MIT |
| `js-sys` | 0.3.107 | MIT OR Apache-2.0 |
| `leb128` | 0.2.7 | MIT OR Apache-2.0 |
| `leb128fmt` | 0.1.0 | MIT OR Apache-2.0 |
| `libc` | 0.2.191 | MIT OR Apache-2.0 |
| `libm` | 0.2.16 | MIT |
| `linux-raw-sys` | 0.12.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `linux-raw-sys` | 0.4.15 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `lock_api` | 0.4.14 | MIT OR Apache-2.0 |
| `log` | 0.4.35 | MIT OR Apache-2.0 |
| `maybe-owned` | 0.3.4 | MIT OR Apache-2.0 |
| `md-5` | 0.10.6 | MIT OR Apache-2.0 |
| `memchr` | 2.8.3 | Unlicense OR MIT |
| `memmap2` | 0.9.12 | MIT OR Apache-2.0 |
| `miniz_oxide` | 0.9.1 | MIT OR Zlib OR Apache-2.0 |
| `num-bigint` | 0.4.8 | MIT OR Apache-2.0 |
| `num-integer` | 0.1.47 | MIT OR Apache-2.0 |
| `num-traits` | 0.2.19 | MIT OR Apache-2.0 |
| `once_cell` | 1.21.4 | MIT OR Apache-2.0 |
| `parking_lot` | 0.12.5 | MIT OR Apache-2.0 |
| `parking_lot_core` | 0.9.12 | MIT OR Apache-2.0 |
| `peg` | 0.8.6 | MIT |
| `peg-macros` | 0.8.6 | MIT |
| `peg-runtime` | 0.8.6 | MIT |
| `pin-project-lite` | 0.2.17 | Apache-2.0 OR MIT |
| `portable-atomic` | 1.15.0 | Apache-2.0 OR MIT |
| `portable-atomic-util` | 0.2.8 | Apache-2.0 OR MIT |
| `postcard` | 1.1.3 | MIT OR Apache-2.0 |
| `ppv-lite86` | 0.2.21 | MIT OR Apache-2.0 |
| `prettyplease` | 0.3.0 | MIT OR Apache-2.0 |
| `proc-macro2` | 1.0.107 | MIT OR Apache-2.0 |
| `quote` | 1.0.47 | MIT OR Apache-2.0 |
| `r-efi` | 6.0.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later |
| `rand` | 0.8.8 | MIT OR Apache-2.0 |
| `rand_chacha` | 0.3.1 | MIT OR Apache-2.0 |
| `rand_core` | 0.6.4 | MIT OR Apache-2.0 |
| `redox_syscall` | 0.5.18 | MIT |
| `regex` | 1.13.1 | MIT OR Apache-2.0 |
| `regex-automata` | 0.4.18 | MIT OR Apache-2.0 |
| `regex-bites` | 0.1.6 | MIT OR Apache-2.0 |
| `regex-syntax` | 0.8.11 | MIT OR Apache-2.0 |
| `rustc_apfloat` | 0.2.3+llvm-462a31f5a5ab | Apache-2.0 WITH LLVM-exception |
| `rustc_version` | 0.4.1 | MIT OR Apache-2.0 |
| `rustix` | 0.38.44 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `rustix` | 1.1.6 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `rustix-linux-procfs` | 0.1.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `rustversion` | 1.0.23 | MIT OR Apache-2.0 |
| `ryu` | 1.0.23 | Apache-2.0 OR BSL-1.0 |
| `scopeguard` | 1.2.0 | MIT OR Apache-2.0 |
| `self_cell` | 1.3.0 | Apache-2.0 OR GPL-2.0-only |
| `semver` | 1.0.28 | MIT OR Apache-2.0 |
| `serde` | 1.0.229 | MIT OR Apache-2.0 |
| `serde_core` | 1.0.229 | MIT OR Apache-2.0 |
| `serde_derive` | 1.0.229 | MIT OR Apache-2.0 |
| `serde_json` | 1.0.154 | MIT OR Apache-2.0 |
| `sha1` | 0.10.7 | MIT OR Apache-2.0 |
| `sha2` | 0.10.9 | MIT OR Apache-2.0 |
| `shlex` | 2.0.1 | MIT OR Apache-2.0 |
| `simd-adler32` | 0.3.10 | MIT |
| `slab` | 0.4.12 | MIT |
| `smallvec` | 1.16.5 | MIT OR Apache-2.0 |
| `spin` | 0.9.9 | MIT |
| `stable_deref_trait` | 1.2.1 | MIT OR Apache-2.0 |
| `string-interner` | 0.19.0 | MIT/Apache-2.0 |
| `strsim` | 0.11.1 | MIT |
| `syn` | 2.0.119 | MIT OR Apache-2.0 |
| `syn` | 3.0.10 | MIT OR Apache-2.0 |
| `system-interface` | 0.27.3 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `thiserror` | 1.0.69 | MIT OR Apache-2.0 |
| `thiserror` | 2.0.21 | MIT OR Apache-2.0 |
| `thiserror-impl` | 1.0.69 | MIT OR Apache-2.0 |
| `thiserror-impl` | 2.0.21 | MIT OR Apache-2.0 |
| `tracing` | 0.1.44 | MIT |
| `tracing-attributes` | 0.1.31 | MIT |
| `tracing-core` | 0.1.36 | MIT |
| `typed-arena` | 2.0.2 | MIT |
| `typenum` | 1.20.1 | MIT OR Apache-2.0 |
| `unicode-ident` | 1.0.27 | (MIT OR Apache-2.0) AND Unicode-3.0 |
| `unicode-width` | 0.1.14 | MIT OR Apache-2.0 |
| `unicode-width` | 0.2.3 | MIT OR Apache-2.0 |
| `urlencoding` | 2.1.3 | MIT |
| `utf8-chars` | 3.0.7 | MIT OR Apache-2.0 |
| `uuid` | 1.29.2 | Apache-2.0 OR MIT |
| `version_check` | 0.9.5 | MIT/Apache-2.0 |
| `wasi` | 0.11.1+wasi-snapshot-preview1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `wasi-common` | 36.0.20 | Apache-2.0 WITH LLVM-exception |
| `wasm-bindgen` | 0.2.130 | MIT OR Apache-2.0 |
| `wasm-bindgen-macro` | 0.2.130 | MIT OR Apache-2.0 |
| `wasm-bindgen-macro-support` | 0.2.130 | MIT OR Apache-2.0 |
| `wasm-bindgen-shared` | 0.2.130 | MIT OR Apache-2.0 |
| `wasm-encoder` | 0.263.0 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `wasmi` | 2.0.0 | MIT/Apache-2.0 |
| `wasmi_collections` | 2.0.0 | MIT/Apache-2.0 |
| `wasmi_core` | 2.0.0 | MIT/Apache-2.0 |
| `wasmi_ir` | 2.0.0 | MIT/Apache-2.0 |
| `wasmi_wasi` | 2.0.0 | MIT/Apache-2.0 |
| `wasmparser` | 0.228.0 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `wasmparser` | 0.263.0 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `wast` | 263.0.0 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `wast` | 35.0.2 | Apache-2.0 WITH LLVM-exception |
| `wat` | 1.263.0 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| `web-time` | 1.1.0 | MIT OR Apache-2.0 |
| `wiggle` | 36.0.20 | Apache-2.0 WITH LLVM-exception |
| `wiggle-generate` | 36.0.20 | Apache-2.0 WITH LLVM-exception |
| `wiggle-macro` | 36.0.20 | Apache-2.0 WITH LLVM-exception |
| `windows-core` | 0.62.2 | MIT OR Apache-2.0 |
| `windows-implement` | 0.60.2 | MIT OR Apache-2.0 |
| `windows-interface` | 0.59.3 | MIT OR Apache-2.0 |
| `windows-link` | 0.2.1 | MIT OR Apache-2.0 |
| `windows-result` | 0.4.1 | MIT OR Apache-2.0 |
| `windows-strings` | 0.5.1 | MIT OR Apache-2.0 |
| `windows-sys` | 0.59.0 | MIT OR Apache-2.0 |
| `windows-sys` | 0.60.2 | MIT OR Apache-2.0 |
| `windows-sys` | 0.61.2 | MIT OR Apache-2.0 |
| `windows-targets` | 0.52.6 | MIT OR Apache-2.0 |
| `windows-targets` | 0.53.5 | MIT OR Apache-2.0 |
| `windows_aarch64_gnullvm` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_aarch64_gnullvm` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_aarch64_msvc` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_aarch64_msvc` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_i686_gnu` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_i686_gnu` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_i686_gnullvm` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_i686_gnullvm` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_i686_msvc` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_i686_msvc` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_x86_64_gnu` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_x86_64_gnu` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_x86_64_gnullvm` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_x86_64_gnullvm` | 0.53.1 | MIT OR Apache-2.0 |
| `windows_x86_64_msvc` | 0.52.6 | MIT OR Apache-2.0 |
| `windows_x86_64_msvc` | 0.53.1 | MIT OR Apache-2.0 |
| `winx` | 0.36.4 | Apache-2.0 WITH LLVM-exception |
| `witx` | 0.9.1 | Apache-2.0 |
| `zerocopy` | 0.8.63 | BSD-2-Clause OR Apache-2.0 OR MIT |
| `zerocopy-derive` | 0.8.63 | BSD-2-Clause OR Apache-2.0 OR MIT |
| `zmij` | 1.0.23 | MIT |

## jq 上游行为参考（不链接进产品）

`evals/upstream/jq-1.8.2/` 保存官方 jq 1.8.2 的 `src/main.c`、`src/jv_parse.c`、`src/jv.c`、`src/jv_print.c`、`src/jv_dtoa.c`、`src/lexer.l`、`src/builtin.c`、`src/jv_aux.c`、`src/jv_unicode.c`、`src/jv_utf8_tables.h`、`src/util.c`、原始 `COPYING`、官方 1.8 手册快照和下载来源/哈希，用于参数审计。许可证以同目录 `COPYING` 为准；这些 C 源码不参与 Newbox 构建，也不作为运行时依赖。

`crates/applets/src/jq/json_string.rs` 和 `json_utf8.rs` 参考上述 jq 字符串解码算法，Rust 实现保留相同的非法 UTF-8 分组与转义语义；jq 版权及 MIT 许可全文保存在 `evals/upstream/jq-1.8.2/COPYING`。宿主不链接或执行官方 jq。

`crates/applets/src/jq/json_decode.rs`、`json_scan.rs`、`json_stack.rs` 和 `json_literal.rs` 根据 jq 的扫描/分隔符规则实现受限 Rust 状态机；错误字符串、规则与上述参考实现遵循同目录保存的 jq MIT 许可。JSON 多文件语义参考 `util.c`，不引入其中的文件打开或原生执行功能。

`vendor/jaq-json/src/newbox_error.rs` 参考 jq 的类型、算术和下标错误及 30 字节摘要规则；jq 的 MIT 版权/许可仍保存在上述 COPYING。Newbox 的 jq 执行器显式处理 JaQ 控制流，不调用会退出进程的通用 unwrap_valr 入口。

`crates/applets/src/jq/input_source.rs`、`input.rs` 根据 `util.c` 的按需读取、4091 字节/换行缓冲与 UTF-8 尾部规则实现 VFS 输入；I/O 诊断和状态优先级参考 `main.c`。所有文件句柄均来自既有授权 VFS，不移植原生 fopen/stdin 实现；没有新增依赖。

`crates/applets/src/jq/effects.rs` 依据 jq main.c/builtin.c 实现 guest 内受限 debug/stderr 回调；`builtins.rs` 和 vendor 错误模块依据 builtin.c/execute.c 对齐 keys、迭代与取反错误。官方 execute.c 及其下载来源/哈希已存于 jq 参考目录。原生 JaQ 日志/stderr 函数仍不注册，不增加宿主能力。

`vendor/jaq-json/src/newbox_update/` 参考 jq 1.8.2 jv_aux.c 的 jv_set/jv_dels 和 jv.c 的 jv_array_set，实现纯值路径更新。对应 MIT 许可与源代码保存在 jq 参考目录；jaq-core 的 map_path 扩展保留默认行为，JSON 实现使用独立更新模块。

`crates/applets/src/jq/compiler/syntax/` 使用 jq 1.8.2 `parser.y` 和 `lexer.l` 的语法规则及诊断（jq MIT 许可见上述 COPYING）。`tables.rs` 是 Bison 3.8.2 从该语法生成的解析表数据；解析引擎、词法扫描和常量形状检查由 Rust 实现。产品不包含 Bison 的 C 解析器骨架，也不链接 jq C 代码。`scripts/generate-jq-parser.py` 只在开发时重生成表，正常 Cargo/Wasm/ELF 构建不需要 Bison、C 编译器或官方 jq。表文件标明输入语法的 SHA-256，原生差分 oracle 仅用于开发测试。

`crates/applets/src/jq/formats/` 按 jq 1.8.2 builtin.c 的 f_format/escape_string 实现纯数据格式编码，沿用 jq MIT 许可参考记录。URI 严格 UTF-8 检查、NUL 转义和分隔格式均不引入文件、进程或网络 API。

`crates/applets/src/jq/definitions_control.jq` 中 first/limit/skip/nth/del、`definitions.jq` 的 inputs 依据 jq 1.8.2 builtin.jq；标签和循环/赋值控制实现参考 execute.c、compile.c。`output.rs` 与 `output_options.rs` 参考 jv_print.c/main.c 的输出、颜色和参数规则。上述派生规则沿用参考目录保存的 jq MIT 版权及许可，不链接 jq 原生执行引擎。测试目录中的 read-fault-oracle.c 仅给开发期官方 jq 注入读取故障，不参与产品构建。

`crates/applets/src/jq/json_stream.rs` 与 `json_state.rs` 的流事件/错误路径规则参考 jq 1.8.2 jv_parse.c，沿用上述 jq MIT 版权许可。流状态由 Rust 实现，所有数据仍经受控 VFS 进入 guest。

`crates/applets/src/jq/json_sequence.rs` 的 RS、恢复与截断规则参考 jq 1.8.2 jv_parse.c；适用上述 jq MIT 许可。

`crates/applets/src/jq/file_arguments.rs` 参考 jq 1.8.2 jv_file.c/main.c，`usage_short.txt` 改编自 main.c 的 usage 文本并注明 Newbox/JaQ 身份；适用上述 jq MIT 版权许可。

`crates/applets/src/jq/usage_options.txt` 改编自 jq 1.8.2 main.c 的 usage 文本，额外注明 Newbox 的模块加载限制；适用上述 jq MIT 版权许可。

Newbox 的 jq 调试参数顺序/输出时机参考 jq 1.8.2 main.c/execute.c/bytecode.c。实际 IR 与迭代器观察代码位于 `vendor/jaq-core/src/compile/inspect.rs`、`filter/trace.rs` 和 `crates/applets/src/jq/tracing.rs`；JaQ 补丁沿用其原许可证，没有移植或嵌入官方 jq VM。

`crates/applets/src/jq/run_tests/` 的测试格式/选取/摘要语义参考 jq 1.8.2 jq_test.c；实际状态自检使用 JaQ。`definitions_entries.jq` 的 join/to_entries/from_entries/with_entries 定义改编自官方 builtin.jq，`filter/collect.rs` 与 native_fold 的路径状态修正参考 compile.c 的 gen_collect/gen_reduce/gen_foreach；适用上述 jq MIT 版权/许可，官方 COPYING 与来源哈希保留在 evals/upstream/jq-1.8.2。

`crates/applets/src/jq/definitions_stream.jq` 的 tostream/fromstream/truncate_stream 定义改编自 jq 1.8.2 builtin.jq 的 Streaming utilities，适用上述 jq MIT 版权/许可；执行器仍为内嵌 JaQ，没有引入官方 jq CLI 或宿主 I/O。

`definitions_index.jq` 的 INDEX/JOIN/IN 定义改编自 jq 1.8.2 builtin.jq；`vendor/jaq-core/src/filter/index.rs` 的计算下标顺序参考 parser.y 的 gen_index/gen_slice_index。适用上述 jq MIT 版权/许可，未引入数据库、网络或进程接口。

`definitions_trim.jq` 的三个 trim 定义改编自 jq 1.8.2 builtin.jq；`string_edges.rs` 的 startswith/endswith 比较与诊断参考 builtin.c。适用上述 jq MIT 版权/许可，所有操作均为 guest 纯值运算。

`crates/applets/src/jq/math.rs` 使用已锁定的 MIT 许可 libm 0.2.16（既有传递依赖增加直接依赖边），没有链接 libc。lgamma_r 包装规则参考 jq MIT 许可 builtin.c/libm.h；负整数极点符号边界参考 glibc CORE-MATH 实现，源码、其 MIT 许可头与固定提交/哈希保存在 `evals/compatibility/jq-lgamma-r-20261111/glibc-lgamma-reference.c` 和 `math-source-manifest.json`，该 C 文件只用于审计。

`crates/applets/src/jq/metadata.rs` 的元数据规则参考 jq 1.8.2 builtin.c、compile.c、execute.c 和 main.c；官方 MIT 版权/许可与来源哈希仍保存在 jq 参考目录。实际列表来自本项目注册表，路径来自 VFS，不复制宿主环境、可执行文件目录或模块搜索路径。

`vendor/jaq-core/src/load/parse.rs` 的 fold 源 Expr 边界参考 jq 1.8.2 parser.y；固定官方 `tests/jq.test` 作为开发期语义审计夹具保存于 jq 参考目录，来源和 SHA-256 已加入其 manifest，沿用同目录 COPYING。测试夹具不嵌入或参与产品运行。
