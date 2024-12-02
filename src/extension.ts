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
        cp.exec(`dotnet add "${projectDir}" package ${packageName}`, (error, stdout, stderr) => {
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
    const dataContexts: string[] = ['None', 'DbContext', 'ApplicationDbContext'];

    const findDbContextFiles = (dir: string): string[] => {
        const csFiles: string[] = [];
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory() && file.toLowerCase() !== 'node_modules') {
                csFiles.push(...findDbContextFiles(fullPath));
            } else if (stat.isFile() && file.endsWith('.cs')) {
                csFiles.push(fullPath);
            }
        });

        return csFiles;
    };

    const csFiles = findDbContextFiles(projectDir);

    for (const filePath of csFiles) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const dbContextRegex = /public\s+class\s+(\w+)\s*:\s*DbContext/;
            const match = content.match(dbContextRegex);

            if (match) {
                const relativePath = path.relative(projectDir, filePath);
                dataContexts.push(`Found in Project: ${match[1]} (${relativePath})`);
            }
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
        }
    }

    return dataContexts;
}

// Function to determine the project directory based on the selected file's path
function findProjectDirectoryFromFile(filePath: string): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {return null;}

    for (const folder of workspaceFolders) {
        const folderPath = folder.uri.fsPath;
        if (filePath.startsWith(folderPath)) {
            const subDirs = fs.readdirSync(folderPath).filter(subDir => {
                const fullPath = path.join(folderPath, subDir);
                return fs.statSync(fullPath).isDirectory();
            });

            for (const subDir of subDirs) {
                const fullDirPath = path.join(folderPath, subDir);
                const csprojFiles = fs.readdirSync(fullDirPath).filter(file => file.endsWith('.csproj'));
                if (csprojFiles.length > 0) {
                    return fullDirPath;
                }
            }
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

    // Check for required packages
    const requiredPackages = [
        'Microsoft.EntityFrameworkCore.Tools',
        'Microsoft.EntityFrameworkCore.SqlServer',
        'Microsoft.VisualStudio.Web.CodeGeneration.Design'
    ];

    for (const packageName of requiredPackages) {
        if (!checkRequiredPackage(projectDir, packageName)) {
            const installPackage = await vscode.window.showInformationMessage(
                `The required ${packageName} package is missing. Do you want to install it?`,
                'Install', 'Cancel'
            );

            if (installPackage === 'Install') {
                try {
                    await installRequiredPackage(projectDir, packageName);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to install ${packageName}. Please try again.`);
                    return;
                }
            } else {
                return;
            }
        }
    }

    const controllerName = await vscode.window.showInputBox({
        prompt: 'Enter the name for the controller',
        value: `${className}Controller`
    });

    if (!controllerName) {
        vscode.window.showErrorMessage('Controller name is required.');
        return;
    }

    const generateViews = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Generate views for this controller?'
    });

    const dataContexts = await getAvailableDataContexts(projectDir);
    const selectedContext = await vscode.window.showQuickPick(dataContexts, {
        placeHolder: 'Select a data context (or None)'
    });

    if (!selectedContext) {
        vscode.window.showErrorMessage('Data context selection is required.');
        return;
    }

    const contextName = selectedContext.replace('Found in Project: ', '').replace(/\s*\(.*\)$/, '');

    let terminalCommand = `dotnet aspnet-codegenerator controller -name ${controllerName} -m ${namespace}.${className}`;

    if (selectedContext !== 'None') {
        terminalCommand += ` -dc ${contextName}`;
    }

    terminalCommand += ' -outDir Controllers';

    if (generateViews === 'Yes') {
        terminalCommand += ' --useDefaultLayout --referenceScriptLibraries';
    } else {
        terminalCommand += ' --noViews';
    }

    const terminal = vscode.window.createTerminal('Scaffold MVC');
    terminal.sendText(`cd "${projectDir}"`);
    terminal.sendText(terminalCommand);
    terminal.show();
});

// Activate function
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(scaffoldCommand);
}

// Deactivate function
export function deactivate() {}
