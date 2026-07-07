# Change Log

All notable changes to the "net-core-scaffolding" extension will be documented in this file.

## [0.0.20] - 2026-07-07

### Security
- **CRITICAL**: Fixed `shell-quote` vulnerability (CVE-2026-9277)
- **HIGH**: Fixed `form-data` vulnerability (CVE-2026-12143)
- **HIGH**: Fixed `linkify-it` vulnerability (CVE-2026-48801)
- **HIGH**: Fixed `tmp` vulnerability (CVE-2026-44705)
- **HIGH**: Fixed `undici` vulnerabilities (CVE-2026-9697, CVE-2026-6734, CVE-2026-12151, CVE-2026-6733, CVE-2026-11525)
- **MODERATE**: Fixed `markdown-it` vulnerability (CVE-2026-48988)
- **MODERATE**: Fixed `js-yaml` quadratic-complexity DoS (GHSA-h67p-54hq-rp68)

### Updated
- Added `package.json` overrides pinning `form-data`, `linkify-it`, `markdown-it`, `shell-quote`, `tmp`, and `undici` to patched versions

### Verified
- All TypeScript type checks passing
- Zero security vulnerabilities detected (`npm audit`)

## [0.0.19] - 2026-07-07

### Security
- **HIGH**: Fixed `fast-uri` vulnerabilities (GHSA-q3j6-qgpj-74h6, GHSA-v39h-62p7-jpjc)
- **MODERATE**: Fixed `brace-expansion` vulnerability (GHSA-jxxr-4gwj-5jf2)
- **MODERATE**: Fixed `qs` vulnerability (GHSA-q8mj-m7cp-5q26)
- **MODERATE**: Removed vulnerable `uuid` 8.3.2 (GHSA-w5hq-g745-h8pq) by updating `@azure/msal-node` to 5.2.2+

### Verified
- Zero security vulnerabilities detected

## [0.0.18] - 2026-04-12

### Security
- **HIGH**: Fixed `flatted` vulnerability (GHSA-25h7-pfq9-p65f / GHSA-rf6f-7fwh-wjgh) — unbounded recursion DoS and Prototype Pollution via `parse()`
- **HIGH**: Fixed `lodash` vulnerability (GHSA-r5fr-rjxr-66jc / GHSA-f23m-r3pf-42rh) — Code Injection via `_.template` and Prototype Pollution via `_.unset`/`_.omit`
- **HIGH**: Fixed `picomatch` vulnerability (GHSA-3v7f-55p6-f55p / GHSA-c2c7-rcm5-vvqj) — Method Injection in POSIX character classes and ReDoS via extglob quantifiers
- **HIGH**: Fixed `undici` vulnerabilities — WebSocket 64-bit length overflow, HTTP Request/Response Smuggling, CRLF Injection, and unbounded memory DoS
- **MODERATE**: Fixed `brace-expansion` vulnerability (GHSA-f886-m6hf-6m8v) — zero-step sequence causes process hang and memory exhaustion
- **MODERATE**: Fixed `serialize-javascript` CPU exhaustion DoS via crafted array-like objects

### Updated
- `@types/vscode`: 1.109.0 → 1.115.0
- `@types/node`: 20.19.33 → 20.19.39
- `@typescript-eslint/eslint-plugin` & `parser`: 8.56.1 → 8.58.1
- `eslint`: 9.39.3 → 9.39.4
- ~40 additional transitive dependency updates

### Verified
- All TypeScript type checks passing
- All ESLint checks passing
- Zero security vulnerabilities detected

## [0.0.15] - 2026-02-27

### Security
- **CRITICAL**: Fixed minimatch vulnerability (GHSA-23c5-xmqv-rm74 - High severity)
  - Updated minimatch to version 3.1.4+ to fix ReDoS vulnerability
  - Nested *() extglobs no longer generate catastrophically backtracking regular expressions
  - All transitive dependencies updated to secure versions

### Verified
- All TypeScript type checks passing
- All ESLint checks passing
- Zero security vulnerabilities detected

## [0.0.11] - 2025-01-13

### Improved
- **DOCUMENTATION**: Enhanced README with comprehensive FAQ section
- **DOCUMENTATION**: Added troubleshooting guide for common issues
- **DOCUMENTATION**: Added security section highlighting active maintenance
- **DOCUMENTATION**: Improved screenshots section with feature highlights
- **DOCUMENTATION**: Updated release notes with version 0.0.10 security fixes

## [0.0.10] - 2025-01-13

### Security
- **CRITICAL**: Fixed tar-fs vulnerability (CVE-2025-59343 - High severity)
- **CRITICAL**: Fixed js-yaml vulnerability (CVE-2025-64718 - Moderate severity)
- **CRITICAL**: Fixed glob vulnerability (CVE-2025-64756 - High severity)
- **CRITICAL**: Fixed jws vulnerability (CVE-2025-65945 - High severity)
- **CRITICAL**: Fixed qs vulnerability (High severity)

### Improved
- Reduced extension package size from 81.58 KB to 8.08 KB
- All dependencies updated to secure versions
- Excluded unnecessary files from published package (.backup, .claude)

### Verified
- All TypeScript type checks passing
- All ESLint checks passing
- All unit tests passing
- Zero security vulnerabilities detected

## [0.0.9] - 2025-01-13

### Added
- **NEW FEATURE**: "Publish to Folder" functionality for .csproj files
- Interactive folder selection dialog for publish destinations
- Build configuration selection (Debug/Release)
- Optional target framework specification

### Improved
- Enhanced special character handling in file paths (fixes issues with !, @, #, etc.)
- Better shell command escaping for cross-platform compatibility
- Updated extension display name and description to reflect expanded functionality
- Improved user interface with clearer progress feedback

### Fixed
- Path handling issues on macOS and Linux systems
- Shell command execution with special characters in folder names

## [0.0.7] - Previous Release
- Enhanced scaffolding functionality and improved error handling

## [0.0.6] - Previous Release
- Added support for custom Database Context names
- Improved DbContext handling and selection

## [0.0.5] - Previous Release
- Minor changes to expand upon allowing the user to specify a custom input for the database context name 