# .NET Core MVC Scaffolding

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/LeviBickel.net-core-mvc-scaffolding.svg)](https://marketplace.visualstudio.com/items?itemName=LeviBickel.net-core-mvc-scaffolding)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/LeviBickel.net-core-mvc-scaffolding.svg)](https://marketplace.visualstudio.com/items?itemName=LeviBickel.net-core-mvc-scaffolding)

Bring Visual Studio's powerful .NET Core MVC scaffolding and publishing capabilities to VS Code. This extension provides an intuitive right-click interface for generating MVC controllers, views, and publishing your applications - just like in Visual Studio.

## ✨ Features

### 🏗️ MVC Scaffolding
- **One-click scaffolding**: Right-click any `.cs` model file to generate complete MVC controllers
- **Smart dependency management**: Automatically detects and installs missing NuGet packages
- **Flexible data context support**: Choose from existing contexts or specify custom ones
- **View generation**: Optional automatic view generation with default layouts and script libraries

### 📦 Publish to Folder
- **Visual Studio-like publishing**: Right-click `.csproj` files for familiar publishing workflow
- **Interactive configuration**: Choose Debug/Release builds and target frameworks
- **Smart defaults**: Remembers last publish location and auto-detects project framework version
- **Folder selection**: Built-in folder picker for publish destinations
- **Cross-platform support**: Works seamlessly on Windows, macOS, and Linux

### 🛡️ Robust Path Handling
- **Special character support**: Handles paths with `!`, `@`, `#`, and other special characters
- **Cross-platform compatibility**: Proper shell escaping for all operating systems
- **Clear feedback**: Integrated terminal output with progress information

## 🚀 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for ".NET Core MVC Scaffolding"
4. Click **Install**

### From Command Line
```bash
code --install-extension LeviBickel.net-core-mvc-scaffolding
```

## 📖 Usage

### Scaffolding MVC Controllers

1. **Right-click** on any `.cs` model file in your project
2. Select **"Scaffold MVC Controller"** from the context menu
3. Follow the prompts to:
   - Install any missing dependencies (if needed)
   - Choose your data context
   - Specify controller name
   - Choose whether to generate views

The extension will generate a complete MVC controller with CRUD operations and optionally create corresponding views.

### Publishing Projects

1. **Right-click** on any `.csproj` file in your project
2. Select **"Publish to Folder"** from the context menu
3. Choose your publish destination folder
4. Select build configuration (Debug/Release)
5. Optionally specify target framework (e.g., `net8.0`)

The extension will execute `dotnet publish` with your selected options.

## 📋 Requirements

- **VS Code** 1.95.0 or higher
- **.NET SDK** installed and available in PATH
- **.NET Core MVC project** with proper project structure

### Optional Dependencies
- **Entity Framework Core** (for scaffolding with data contexts)
- **Microsoft.VisualStudio.Web.CodeGeneration.Design** (automatically installed when needed)

## 🔧 Supported Scenarios

- ✅ .NET Core 6.0+ MVC projects
- ✅ Entity Framework Core models
- ✅ Custom and existing DbContexts
- ✅ Cross-platform development (Windows, macOS, Linux)
- ✅ Workspaces with special characters in paths

## 🔒 Security

This extension is actively maintained with regular security updates. All dependencies are kept up-to-date to ensure the safety of your development environment.

## 🎬 Screenshots

### MVC Scaffolding in Action
Right-click any C# model file to instantly scaffold a complete MVC controller with CRUD operations.

### Publish to Folder
Right-click any .csproj file to publish your application with Visual Studio-like workflow.

## ❓ FAQ

### How do I scaffold a controller?
Simply right-click on any `.cs` model file in your project explorer and select "Scaffold MVC Controller" from the context menu.

### What dependencies are automatically installed?
The extension will detect if you're missing `Microsoft.VisualStudio.Web.CodeGeneration.Design` and prompt you to install it automatically.

### Can I use my own DbContext?
Yes! The extension will detect existing DbContexts in your project and let you choose from them, or you can specify a custom one.

### Does this work on macOS and Linux?
Absolutely! The extension is fully cross-platform and works on Windows, macOS, and Linux.

### What .NET versions are supported?
The extension supports .NET Core 6.0 and higher, including .NET 8.0 and .NET 9.0.

## 🔧 Troubleshooting

### Extension doesn't appear in context menu
- Ensure you're right-clicking on a `.cs` file for scaffolding or `.csproj` file for publishing
- Restart VS Code after installation

### Scaffolding fails with dependency errors
- Make sure you have .NET SDK installed and available in your PATH
- Run `dotnet --version` in terminal to verify
- The extension will prompt to install missing NuGet packages automatically

### Special characters in path cause issues
- Version 0.0.9+ includes enhanced special character handling
- Update to the latest version if you're experiencing path-related issues

### DbContext not detected
- Ensure your DbContext class inherits from `DbContext`
- Check that your project is properly built
- The DbContext must be in the same project as your model

## 📝 Release Notes

### 0.0.16 (Latest)
- **🐛 CRITICAL FIX**: Comprehensive cross-platform path handling
  - Implemented OS-aware path quoting for all terminal commands
  - Windows (PowerShell/CMD): Clean quoting without unnecessary escaping
  - Unix (Bash/Zsh/Fish): Proper escaping of `$`, `` ` ``, `\`, and `"` characters
  - Fixed `c:\` being converted to `c\:` causing "drive not found" errors on Windows
  - Resolves "Project file does not exist" errors across all platforms and shell types
  - Tested with 28 comprehensive tests covering all edge cases

### 0.0.15
- Released but unpublished (version conflict)

### 0.0.14
- **🐛 BUGFIX**: Fixed Windows drive letter path handling in publish command
  - Removed incorrect escaping of colon `:` character that caused paths like `c:\` to become `c\:`
  - Resolves "Project file does not exist" errors when publishing on Windows
  - Improves cross-platform path compatibility

### 0.0.13
- **🔒 SECURITY**: Fixed all 7 security vulnerabilities
  - Updated undici to 7.18.2+ (CVE-2026-22036 - Moderate)
  - Updated lodash to 4.17.23+ (CVE-2025-13465 - Moderate)
  - Updated @isaacs/brace-expansion to 5.0.1+ (CVE-2026-25547 - High)
  - Updated markdown-it to 14.1.1+ (CVE-2026-2327 - Moderate)
  - Updated qs to 6.14.2+ (CVE-2026-2391 - Low)
  - Updated minimatch to 10.2.1+ (CVE-2026-26996 - High)
  - Updated ajv to 8.18.0+ (CVE-2025-69873 - Moderate)
- **🆕 FEATURE**: Publish to folder now remembers last used location
- **🆕 FEATURE**: Target framework auto-detects from project (no more defaulting to net8.0)
- **🧹 CLEANUP**: Removed deprecated inflight package (memory leak risk)
- **📦 IMPROVED**: Updated 101 dependencies to latest compatible versions
- **✅ VERIFIED**: Zero vulnerabilities, zero deprecation warnings

### 0.0.10
- **🔒 SECURITY**: Updated all dependencies to fix security vulnerabilities
  - Fixed tar-fs (CVE-2025-59343 - High severity)
  - Fixed js-yaml (CVE-2025-64718 - Moderate severity)
  - Fixed glob (CVE-2025-64756 - High severity)
  - Fixed jws (CVE-2025-65945 - High severity)
  - Fixed qs (High severity)
- **📦 IMPROVED**: Reduced extension package size from 81.58 KB to 8.08 KB
- **✅ VERIFIED**: All tests passing with zero security vulnerabilities

### 0.0.9
- **🆕 NEW**: Added "Publish to Folder" feature for .csproj files
- **🔧 IMPROVED**: Enhanced special character handling in file paths
- **🔧 IMPROVED**: Better shell command escaping for cross-platform compatibility
- **🔧 IMPROVED**: Updated user interface descriptions and functionality

### 0.0.7
- Enhanced scaffolding functionality and improved error handling

### 0.0.6
- Added support for custom Database Context names
- Improved DbContext handling and selection

<details>
<summary>View older releases</summary>

### 0.0.3
- Fixed dependency installation issues
- Improved DbContext handling

### 0.0.2
- Bug fixes for initial deployment

### 0.0.1
- Initial release with basic MVC scaffolding functionality

</details>

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests on our [GitHub repository](https://github.com/LeviBickel/net-core-scaffolding).

## 📄 License

This extension is licensed under the terms specified in the [license file](license.txt).

## 🐛 Issues & Support

Found a bug or have a feature request? Please report it on our [GitHub Issues page](https://github.com/LeviBickel/net-core-scaffolding/issues).

---

**Enjoy scaffolding!** 🎉 