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

## 📝 Release Notes

### 0.0.9 (Latest)
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