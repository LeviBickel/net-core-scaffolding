import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';

// Function to escape shell special characters in paths
function escapeShellPath(filePath: string): string {
    // Characters that need to be escaped in shell commands
    const specialChars = /[!@#$%^&*()[\]{}|;':"<>?,`~]/g;

    // Replace special characters with escaped versions
    return filePath.replace(specialChars, '\\$&');
}

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
    const files = fs.readdirSync(projectDir);
    const csprojFile = files.find(file => file.endsWith('.csproj'));

    if (!csprojFile) {
        vscode.window.showErrorMessage('No .csproj file found in the project directory.');
        return false;
    }

    const csprojFilePath = path.join(projectDir, csprojFile);
    console.log(`Checking .csproj file at: ${csprojFilePath}`);

    try {
        const csprojContent = fs.readFileSync(csprojFilePath, 'utf-8');
        console.log(`.csproj content:\n${csprojContent}`);

        // Check if the required package is referenced in the .csproj file
        const isPackageReferenced = csprojContent.includes(`<PackageReference Include="${packageName}"`);
        console.log(`Is package "${packageName}" referenced: ${isPackageReferenced}`);

        return isPackageReferenced;
    } catch (error) {
        console.error(`Error reading .csproj file at ${csprojFilePath}:`, error);
        return false;
    }
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

// Function to get available data contexts with custom option
async function getAvailableDataContexts(projectDir: string): Promise<string[]> {
    const dataContexts: string[] = ['None', 'DbContext', 'ApplicationDbContext', 'Custom...'];

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

    // Prompt the user to select a DbContext
    const selectedContext = await vscode.window.showQuickPick(dataContexts, {
        placeHolder: 'Select a data context (or None)',
        canPickMany: false
    });

    // If the user selects "None", return an empty array
    if (!selectedContext || selectedContext === 'None') {
        return [];
    }

    // If the user selects "Custom...", show input box for custom DbContext
    if (selectedContext === 'Custom...') {
        const customDbContext = await vscode.window.showInputBox({
            prompt: 'Enter a custom DbContext name',
            placeHolder: 'e.g., MyCustomDbContext'
        });

        if (customDbContext) {
            return [customDbContext];
        }

        return [];  // If no input is given, return empty array
    }

    // If the user selected a predefined context, return it
    if (selectedContext && !selectedContext.startsWith('Found in Project:')) {
        return [selectedContext];
    }

    // If the user selects a context found in the project, return it
    return selectedContext
        ? [selectedContext.replace('Found in Project: ', '').replace(/\s*\(.*\)$/, '')]
        : [];
}



// Function to find the project directory based on the selected model file
function findProjectDirectoryFromFile(filePath: string): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) { return null; }

    for (const folder of workspaceFolders) {
        const folderPath = folder.uri.fsPath;
        
        // Check if the file is inside the workspace folder
        if (filePath.startsWith(folderPath)) {
            const subDirs = fs.readdirSync(folderPath).filter(subDir => {
                const fullPath = path.join(folderPath, subDir);
                return fs.statSync(fullPath).isDirectory();
            });

            // Iterate over subdirectories to check for a .csproj file
            for (const subDir of subDirs) {
                const fullDirPath = path.join(folderPath, subDir);
                const csprojFiles = fs.readdirSync(fullDirPath).filter(file => file.endsWith('.csproj'));

                if (csprojFiles.length > 0) {
                    // Check if the model file exists in the current subdirectory
                    const modelDir = path.dirname(filePath);
                    if (modelDir.startsWith(fullDirPath)) {
                        // If the model file is in this subdirectory, set this as the project directory
                        return fullDirPath;
                    }
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
    terminal.sendText(`cd "${escapeShellPath(projectDir)}"`);
    terminal.sendText(terminalCommand);
    terminal.show();
});

// Function to handle publish to folder command
const publishToFolderCommand = vscode.commands.registerCommand('extension.publishToFolder', async (uri: vscode.Uri) => {
    if (!uri || !uri.fsPath.endsWith('.csproj')) {
        vscode.window.showErrorMessage('Please select a .csproj file.');
        return;
    }

    const projectDir = path.dirname(uri.fsPath);
    const projectName = path.basename(uri.fsPath, '.csproj');

    // Open folder dialog for publish destination
    const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Publish Folder'
    });

    if (!folderUri || folderUri.length === 0) {
        vscode.window.showInformationMessage('Publish cancelled - no folder selected.');
        return;
    }

    const publishPath = folderUri[0].fsPath;

    // Show configuration options
    const configuration = await vscode.window.showQuickPick(['Debug', 'Release'], {
        placeHolder: 'Select build configuration'
    });

    if (!configuration) {
        vscode.window.showInformationMessage('Publish cancelled - no configuration selected.');
        return;
    }

    const framework = await vscode.window.showInputBox({
        prompt: 'Target framework (e.g., net6.0, net7.0, net8.0) - leave empty for default',
        placeHolder: 'net8.0'
    });

    // Build the dotnet publish command with escaped paths
    const escapedProjectPath = escapeShellPath(uri.fsPath);
    const escapedPublishPath = escapeShellPath(publishPath);
    const escapedProjectDir = escapeShellPath(projectDir);

    let publishCommand = `dotnet publish "${escapedProjectPath}" -c ${configuration} -o "${escapedPublishPath}"`;

    if (framework && framework.trim()) {
        publishCommand += ` -f ${framework.trim()}`;
    }

    // Create and show terminal
    const terminal = vscode.window.createTerminal(`Publish ${projectName}`);
    terminal.sendText(`cd "${escapedProjectDir}"`);
    terminal.sendText(publishCommand);
    terminal.show();

    vscode.window.showInformationMessage(`Publishing ${projectName} to ${publishPath}...`);
});

// Activate function
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(scaffoldCommand);
    context.subscriptions.push(publishToFolderCommand);
}

// Deactivate function
export function deactivate() {}
