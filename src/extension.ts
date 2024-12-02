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
    const dataContexts: string[] = ['None', 'AppDbContext', 'ApplicationDbContext'];

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

// Function to find the project directory based on the selected file
function findProjectDirectoryFromFile(selectedFilePath: string): string | null {
    const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath; // Root project folder

    // Log the workspace path to debug
    console.log(`Workspace Path: ${workspacePath}`);

    // Get all subdirectories in the workspace
    const directories = fs.readdirSync(workspacePath).filter(item => {
        const fullPath = path.join(workspacePath, item);
        return fs.statSync(fullPath).isDirectory();
    });

    // Iterate through each directory and check if it contains a .csproj file
    for (const dir of directories) {
        const fullDirPath = path.join(workspacePath, dir);
        const csprojFiles = fs.readdirSync(fullDirPath).filter(file => file.endsWith('.csproj'));

        if (csprojFiles.length > 0) {
            // Check if the selected file is within the current project directory
            if (selectedFilePath.startsWith(fullDirPath)) {
                console.log(`Found project directory for the selected file: ${fullDirPath}`);
                return fullDirPath; // Return the correct project directory
            }
        }
    }

    console.log('No project directory found for the selected file.');
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
    const projectDir = findProjectDirectoryFromFile(modelFilePath);

    if (!projectDir) {
        vscode.window.showErrorMessage('Unable to determine the project directory for the selected file.');
        return;
    }

    // Ensure Controllers folder exists
    const controllersPath = path.join(projectDir, 'Controllers');
    if (!fs.existsSync(controllersPath)) {
        fs.mkdirSync(controllersPath);
    }

    // Check and install necessary packages if missing
    if (!checkRequiredPackage(projectDir, 'Microsoft.EntityFrameworkCore.Tools')) {
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

    // Check and install Microsoft.VisualStudio.Web.CodeGeneration.Design package
    if (!checkRequiredPackage(projectDir, 'Microsoft.VisualStudio.Web.CodeGeneration.Design')) {
        const installCodeGenPackage = await vscode.window.showInformationMessage(
            'The required Microsoft.VisualStudio.Web.CodeGeneration.Design package is missing. Do you want to install it?',
            'Install', 'Cancel'
        );

        if (installCodeGenPackage === 'Install') {
            try {
                await installRequiredPackage(projectDir, 'Microsoft.VisualStudio.Web.CodeGeneration.Design');
            } catch (error) {
                vscode.window.showErrorMessage('Failed to install Web.CodeGeneration.Design package. Please try again.');
                return;
            }
        } else {
            return; // Abort scaffolding if the user cancels
        }
    }

    const controllerName = await vscode.window.showInputBox({
        prompt: 'Enter the name for the controller',
        value: `${className}Controller` // Default to model name + Controller suffix
    });

    if (!controllerName) {
        vscode.window.showErrorMessage('Controller name is required.');
        return;
    }

    const generateViews = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Generate views for this controller?'
    });

    // Fetch available data contexts
    const dataContexts = await getAvailableDataContexts(projectDir);
    const selectedContext = await vscode.window.showQuickPick(dataContexts, {
        placeHolder: 'Select a data context (or None)'
    });

    if (!selectedContext) {
        vscode.window.showErrorMessage('Data context selection is required.');
        return;
    }

    // Only check for SQL Server package if a data context is selected
    if (selectedContext !== 'None') {
        if (!checkRequiredPackage(projectDir, 'Microsoft.EntityFrameworkCore.SqlServer')) {
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

    // Construct the scaffolding command
    let terminalCommand = `dotnet aspnet-codegenerator controller -name ${controllerName} -m ${namespace}.${className} -dc ${selectedContext} -outDir Controllers`;

    if (generateViews === 'Yes') {
        terminalCommand += ' --useDefaultLayout --referenceScriptLibraries';
    }

    console.log(`Running command: ${terminalCommand}`);

    // Create terminal and run the command
    const terminal = vscode.window.createTerminal('Scaffolding');
    terminal.sendText(`cd "${projectDir}"`); // Ensure terminal is in the correct project directory
    terminal.sendText(terminalCommand);
    terminal.show();
});

// Register the scaffolding command
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(scaffoldCommand);
}

export function deactivate() {}
