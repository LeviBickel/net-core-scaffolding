# Change Log

All notable changes to the "net-core-scaffolding" extension will be documented in this file.

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