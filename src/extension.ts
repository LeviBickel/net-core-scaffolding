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

// Function to get available data contexts
async function getAvailableDataContexts(projectDir: string): Promise<string[]> {
    const dataContexts: string[] = [];

    // Check for DbContext classes in the entire project directory
    const findDbContextFiles = (dir: string): string[] => {
        const csFiles: string[] = [];
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory() && file.toLowerCase() !== 'node_modules') {
                // Recursively search subdirectories
                csFiles.push(...findDbContextFiles(fullPath));
            } else if (stat.isFile() && file.endsWith('.cs')) {
                csFiles.push(fullPath);
            }
        });

        return csFiles;
    };

    // Find all .cs files in the project
    const csFiles = findDbContextFiles(projectDir);

    // Search through files for DbContext classes
    for (const filePath of csFiles) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Updated regex to catch DbContext inheritance more comprehensively
            const dbContextRegex = /public\s+class\s+(\w+)\s*:\s*DbContext/;
            const match = content.match(dbContextRegex);
            
            if (match) {
                // Add the context name with its relative path
                const relativePath = path.relative(projectDir, filePath);
                dataContexts.push(`Found in Project: ${match[1]} (${relativePath})`);
            }
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
        }
    }

    return dataContexts;
}

// Function to find the project directory based on the workspace
function findProjectDirectory(workspacePath: string): string | null {
    const files = fs.readdirSync(workspacePath);
    const csprojFile = files.find(file => file.endsWith('.csproj'));

    if (csprojFile) {
        return workspacePath; // Return the workspace if the .csproj file is found
    }

    const subdirectories = fs.readdirSync(workspacePath).filter((file) => fs.statSync(path.join(workspacePath, file)).isDirectory());
    for (const subdir of subdirectories) {
        const csprojInSubdir = path.join(workspacePath, subdir, '*.csproj');
        const subFiles = fs.readdirSync(path.join(workspacePath, subdir));
        if (subFiles.some(file => file.endsWith('.csproj'))) {
            return path.join(workspacePath, subdir);
        }
    }

    return null;
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

    // Determine the project directory by finding the .csproj file in the workspace
    const projectDir = findProjectDirectory(workspacePath);

    if (!projectDir) {
        vscode.window.showErrorMessage('No project directory with a .csproj file found.');
        return;
    }

    // Ensure Controllers folder exists
    const controllersPath = path.join(projectDir, 'Controllers');
    if (!fs.existsSync(controllersPath)) {
        fs.mkdirSync(controllersPath);
    }

    // (Previous package installation checks remain the same)
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
    const dataContexts = await getAvailableDataContexts(projectDir);
    dataContexts.unshift('None');  // Add 'None' option at the start of the list
    const selectedContext = await vscode.window.showQuickPick(dataContexts, {
        placeHolder: 'Select a data context (or None)'
    });

    if (!selectedContext) {
        vscode.window.showErrorMessage('Data context selection is required.');
        return;
    }

    // Only check for SQL Server package if a data context is selected
    if (selectedContext !== 'None') {
        // Check if the Microsoft.EntityFrameworkCore.SqlServer package is installed
        if (!checkRequiredPackage(projectDir, 'Microsoft.EntityFrameworkCore.SqlServer')) {
            // Ask the user if they want to install the SQL Server package
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
    }
    
    // Construct the terminal command
    let terminalCommand = `dotnet aspnet-codegenerator controller -name ${controllerName} -m ${namespace}.${className}`;

    // Add data context if not 'None'
    if (selectedContext !== 'None') {
        // Extract just the context name, removing both prefixes
        const contextName = selectedContext
            .replace('Found in Project: ', '')
            .replace(/\s*\(.*\)$/, '');
        terminalCommand += ` -dc ${contextName}`;
    }

    // Explicitly set output directory to Controllers folder
    terminalCommand += ` -outDir Controllers`;

    // Only add view generation flags if "Yes" is selected
    if (generateViews === 'Yes') {
        terminalCommand += ' --useDefaultLayout --referenceScriptLibraries';
    } else {
        // Explicitly prevent view generation
        terminalCommand += ' --noViews';
    }

    console.log(`Generated Command: ${terminalCommand}`);  // For debugging

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
