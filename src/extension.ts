import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';

// Function to extract namespace and class name from the model file
function extractModelInfo(filePath: string): { namespace: string, className: string } | null {
    const content = fs.readFileSync(filePath, 'utf-8');
    const namespaceRegex = /namespace\s+([A-Za-z0-9_.]+)/;
    const classRegex = /class\s+([A-Za-z0-9_]+)/;

    const namespaceMatch = content.match(namespaceRegex);
    const classMatch = content.match(classRegex);

    if (namespaceMatch && classMatch) {
        return {
            namespace: namespaceMatch[1],
            className: classMatch[1]
        };
    }

    return null;
}

// Function to check if the required NuGet package is installed
function checkRequiredPackage(projectDir: string, packageName: string): boolean {
    const csprojPath = path.join(projectDir, '*.csproj');
    const files = fs.readdirSync(projectDir);
    const csprojFile = files.find(file => file.endsWith('.csproj'));

    if (!csprojFile) {
        vscode.window.showErrorMessage('No .csproj file found in the project directory.');
        return false;
    }

    const csprojFilePath = path.join(projectDir, csprojFile);
    const csprojContent = fs.readFileSync(csprojFilePath, 'utf-8');

    // Check if the required package is referenced in the .csproj file
    return csprojContent.includes(packageName);
}

// Function to install the required NuGet package
function installRequiredPackage(projectDir: string, packageName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        vscode.window.showInformationMessage(`Installing ${packageName} package...`);

        // Run the dotnet command to add the package
        cp.exec(`dotnet add ${projectDir} package ${packageName}`, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Error installing package: ${stderr}`);
                reject(stderr);
            } else {
                vscode.window.showInformationMessage(`${packageName} package installed successfully.`);
                resolve();
            }
        });
    });
}

// Function to get available data contexts (mock function, replace with actual implementation)
async function getAvailableDataContexts(): Promise<string[]> {
    return ['None', 'AppDbContext', 'ApplicationDbContext'];  // Example contexts
}

// Scaffolding command
let scaffoldCommand = vscode.commands.registerCommand('extension.scaffoldMVC', async (uri) => {
    const modelFilePath = uri.fsPath;
    const modelInfo = extractModelInfo(modelFilePath);

    if (!modelInfo) {
        vscode.window.showErrorMessage('Unable to extract model class and namespace from the selected file.');
        return;
    }

    const { namespace, className } = modelInfo;
    const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath; // Root project folder
    const projectDir = path.join(workspacePath, 'WebApplication1'); // Project directory

    // Ensure project directory exists
    if (!fs.existsSync(projectDir)) {
        vscode.window.showErrorMessage(`The project directory does not exist: ${projectDir}`);
        return;
    }

    // Check if the required scaffolding NuGet package is installed
    if (!checkRequiredPackage(projectDir, 'Microsoft.VisualStudio.Web.CodeGeneration.Design')) {
        // Ask the user if they want to install the package
        const installPackage = await vscode.window.showInformationMessage(
            'The required Microsoft.VisualStudio.Web.CodeGeneration.Design package is missing. Do you want to install it?',
            'Install', 'Cancel'
        );

        if (installPackage === 'Install') {
            try {
                await installRequiredPackage(projectDir, 'Microsoft.VisualStudio.Web.CodeGeneration.Design');
            } catch (error) {
                vscode.window.showErrorMessage('Failed to install required package. Please try again.');
                return;
            }
        } else {
            return; // Abort scaffolding if the user cancels
        }
    }

    // Check if the Entity Framework Core Tools package is installed
    if (!checkRequiredPackage(projectDir, 'Microsoft.EntityFrameworkCore.Tools')) {
        // Ask the user if they want to install the package
        const installEfPackage = await vscode.window.showInformationMessage(
            'The required Microsoft.EntityFrameworkCore.Tools package is missing. Do you want to install it?',
            'Install', 'Cancel'
        );

        if (installEfPackage === 'Install') {
            try {
                await installRequiredPackage(projectDir, 'Microsoft.EntityFrameworkCore.Tools');
            } catch (error) {
                vscode.window.showErrorMessage('Failed to install Entity Framework Core Tools package. Please try again.');
                return;
            }
        } else {
            return; // Abort scaffolding if the user cancels
        }
    }

    // Check if the Microsoft.EntityFrameworkCore.SqlServer package is installed
    if (!checkRequiredPackage(projectDir, 'Microsoft.EntityFrameworkCore.SqlServer')) {
        // Ask the user if they want to install the package
        const installSqlServerPackage = await vscode.window.showInformationMessage(
            'The required Microsoft.EntityFrameworkCore.SqlServer package is missing. Do you want to install it?',
            'Install', 'Cancel'
        );

        if (installSqlServerPackage === 'Install') {
            try {
                await installRequiredPackage(projectDir, 'Microsoft.EntityFrameworkCore.SqlServer');
            } catch (error) {
                vscode.window.showErrorMessage('Failed to install Microsoft.EntityFrameworkCore.SqlServer package. Please try again.');
                return;
            }
        } else {
            return; // Abort scaffolding if the user cancels
        }
    }

    // Prompt for controller name
    const controllerName = await vscode.window.showInputBox({
        prompt: 'Enter the name for the controller',
        value: `${className}Controller` // Default to model name + Controller suffix
    });

    if (!controllerName) {
        vscode.window.showErrorMessage('Controller name is required.');
        return;
    }

    // Prompt for view generation
    const generateViews = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Generate views for this controller?'
    });

    // Fetch available data contexts
    const dataContexts = await getAvailableDataContexts();
    const selectedContext = await vscode.window.showQuickPick(dataContexts, {
        placeHolder: 'Select a data context (or None)'
    });

    if (!selectedContext) {
        vscode.window.showErrorMessage('Data context selection is required.');
        return;
    }

    // Construct the terminal command
    const terminalCommand = `dotnet aspnet-codegenerator controller -name ${controllerName} -m ${namespace}.${className} ${
        selectedContext !== 'None' ? `-dc ${selectedContext}` : ''
    } -outDir ${path.relative(projectDir, path.join(projectDir, 'Controllers'))} ${
        generateViews === 'Yes' ? '--useDefaultLayout --referenceScriptLibraries' : ''
    }`;

    // Open terminal and run the command
    const terminal = vscode.window.createTerminal('Scaffold MVC');
    terminal.show();
    terminal.sendText(`cd ${projectDir}`); // Change working directory to the project folder
    terminal.sendText(terminalCommand);    // Run the scaffolding command
});

// Activate function for VS Code extension
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(scaffoldCommand);
}

// Deactivate function for VS Code extension
export function deactivate() {}
