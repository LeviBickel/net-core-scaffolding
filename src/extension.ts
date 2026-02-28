import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';

// Function to safely quote paths for terminal commands
// Handles different shells: PowerShell, CMD, Bash, Zsh, Fish
function quotePath(filePath: string): string {
    if (process.platform === 'win32') {
        // Windows (PowerShell/CMD): Just wrap in quotes
        // Backslashes and colons don't need escaping
        // Double quotes are illegal in Windows file names, so no need to escape
        return `"${filePath}"`;
    } else {
        // Unix (Linux/macOS) using Bash/Zsh/Fish
        // Escape characters that are special inside double quotes
        const escaped = filePath
            .replace(/\\/g, '\\\\')   // Backslash
            .replace(/"/g, '\\"')      // Double quote
            .replace(/\$/g, '\\$')     // Dollar sign (variable expansion)
            .replace(/`/g, '\\`');     // Backtick (command substitution)
        return `"${escaped}"`;
    }
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
    terminal.sendText(`cd ${quotePath(projectDir)}`);
    terminal.sendText(terminalCommand);
    terminal.show();
});

// Function to extract target framework from .csproj file
function getTargetFramework(csprojPath: string): string | null {
    try {
        const content = fs.readFileSync(csprojPath, 'utf-8');

        // Match <TargetFramework>net8.0</TargetFramework> or <TargetFrameworks>net8.0;net7.0</TargetFrameworks>
        const singleFrameworkRegex = /<TargetFramework>([^<]+)<\/TargetFramework>/i;
        const multiFrameworkRegex = /<TargetFrameworks>([^<]+)<\/TargetFrameworks>/i;

        const singleMatch = content.match(singleFrameworkRegex);
        if (singleMatch) {
            return singleMatch[1].trim();
        }

        const multiMatch = content.match(multiFrameworkRegex);
        if (multiMatch) {
            // Return the first framework if multiple are specified
            const frameworks = multiMatch[1].split(';');
            return frameworks[0].trim();
        }
    } catch (error) {
        console.error(`Error reading .csproj file: ${error}`);
    }

    return null;
}

// Function to handle publish to folder command
async function publishToFolder(uri: vscode.Uri, context: vscode.ExtensionContext) {
    if (!uri || !uri.fsPath.endsWith('.csproj')) {
        vscode.window.showErrorMessage('Please select a .csproj file.');
        return;
    }

    const projectDir = path.dirname(uri.fsPath);
    const projectName = path.basename(uri.fsPath, '.csproj');

    // Get the last used publish folder from workspace state
    const lastPublishFolder = context.workspaceState.get<string>('lastPublishFolder');

    // Determine the default URI for the folder picker
    let defaultUri: vscode.Uri | undefined;
    if (lastPublishFolder && fs.existsSync(lastPublishFolder)) {
        defaultUri = vscode.Uri.file(lastPublishFolder);
    } else {
        defaultUri = vscode.Uri.file(projectDir);
    }

    // Open folder dialog for publish destination
    const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Publish Folder',
        defaultUri: defaultUri
    });

    if (!folderUri || folderUri.length === 0) {
        vscode.window.showInformationMessage('Publish cancelled - no folder selected.');
        return;
    }

    const publishPath = folderUri[0].fsPath;

    // Save the selected folder for next time
    await context.workspaceState.update('lastPublishFolder', path.dirname(publishPath));

    // Show configuration options
    const configuration = await vscode.window.showQuickPick(['Debug', 'Release'], {
        placeHolder: 'Select build configuration'
    });

    if (!configuration) {
        vscode.window.showInformationMessage('Publish cancelled - no configuration selected.');
        return;
    }

    // Get the target framework from the .csproj file
    const detectedFramework = getTargetFramework(uri.fsPath);
    const defaultFramework = detectedFramework || 'net8.0';

    const framework = await vscode.window.showInputBox({
        prompt: 'Target framework (e.g., net6.0, net7.0, net8.0, net9.0) - leave empty for default',
        placeHolder: defaultFramework,
        value: defaultFramework
    });

    // Build the dotnet publish command with properly quoted paths
    let publishCommand = `dotnet publish ${quotePath(uri.fsPath)} -c ${configuration} -o ${quotePath(publishPath)}`;

    if (framework && framework.trim()) {
        publishCommand += ` -f ${framework.trim()}`;
    }

    // Create and show terminal
    const terminal = vscode.window.createTerminal(`Publish ${projectName}`);
    terminal.sendText(`cd ${quotePath(projectDir)}`);
    terminal.sendText(publishCommand);
    terminal.show();

    vscode.window.showInformationMessage(`Publishing ${projectName} to ${publishPath}...`);
}

// ==================== IIS Web Deploy Functionality ====================

interface PublishProfile {
    name: string;
    filePath: string;
}

interface WebDeployConfig {
    profileName: string;
    serverUrl: string;
    siteName: string;
    username: string;
    password: string;
    allowUntrustedCert: boolean;
}

// Function to find existing publish profiles
function findPublishProfiles(projectDir: string): PublishProfile[] {
    const profilesPath = path.join(projectDir, 'Properties', 'PublishProfiles');
    const profiles: PublishProfile[] = [];

    if (!fs.existsSync(profilesPath)) {
        return profiles;
    }

    const files = fs.readdirSync(profilesPath);
    for (const file of files) {
        if (file.endsWith('.pubxml')) {
            profiles.push({
                name: path.basename(file, '.pubxml'),
                filePath: path.join(profilesPath, file)
            });
        }
    }

    return profiles;
}

// Function to parse publish profile XML
function parsePublishProfile(filePath: string): Partial<WebDeployConfig> {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Extract server URL
        const serverMatch = content.match(/<MSDeployServiceURL>([^<]+)<\/MSDeployServiceURL>/);
        const serverUrl = serverMatch ? serverMatch[1] : '';

        // Extract site name
        const siteMatch = content.match(/<DeployIisAppPath>([^<]+)<\/DeployIisAppPath>/);
        const siteName = siteMatch ? siteMatch[1] : '';

        // Extract username
        const userMatch = content.match(/<UserName>([^<]+)<\/UserName>/);
        const username = userMatch ? userMatch[1] : '';

        return {
            serverUrl,
            siteName,
            username
        };
    } catch (error) {
        console.error('Error parsing publish profile:', error);
        return {};
    }
}

// Function to generate publish profile XML
function generatePublishProfileXml(config: WebDeployConfig): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<!--
This file is used by the publish/package process of your Web project.
You can customize the behavior of this process by editing this MSBuild file.
-->
<Project ToolsVersion="4.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <PropertyGroup>
    <WebPublishMethod>MSDeploy</WebPublishMethod>
    <LastUsedBuildConfiguration>Release</LastUsedBuildConfiguration>
    <LastUsedPlatform>Any CPU</LastUsedPlatform>
    <SiteUrlToLaunchAfterPublish />
    <LaunchSiteAfterPublish>True</LaunchSiteAfterPublish>
    <ExcludeApp_Data>False</ExcludeApp_Data>
    <ProjectGuid>00000000-0000-0000-0000-000000000000</ProjectGuid>
    <MSDeployServiceURL>${config.serverUrl}</MSDeployServiceURL>
    <DeployIisAppPath>${config.siteName}</DeployIisAppPath>
    <RemoteSitePhysicalPath />
    <SkipExtraFilesOnServer>True</SkipExtraFilesOnServer>
    <MSDeployPublishMethod>WMSVC</MSDeployPublishMethod>
    <EnableMSDeployBackup>True</EnableMSDeployBackup>
    <UserName>${config.username}</UserName>
    <_SavePWD>False</_SavePWD>
    <PublishDatabaseSettings>
      <Objects xmlns="" />
    </PublishDatabaseSettings>
  </PropertyGroup>
</Project>`;
}

// Function to save publish profile
async function savePublishProfile(projectDir: string, config: WebDeployConfig): Promise<string> {
    const profilesPath = path.join(projectDir, 'Properties', 'PublishProfiles');

    // Create directories if they don't exist
    if (!fs.existsSync(path.join(projectDir, 'Properties'))) {
        fs.mkdirSync(path.join(projectDir, 'Properties'));
    }
    if (!fs.existsSync(profilesPath)) {
        fs.mkdirSync(profilesPath);
    }

    const profilePath = path.join(profilesPath, `${config.profileName}.pubxml`);
    const xmlContent = generatePublishProfileXml(config);

    fs.writeFileSync(profilePath, xmlContent, 'utf-8');
    return profilePath;
}

// Function to store credentials securely
async function storeCredentials(context: vscode.ExtensionContext, profileName: string, username: string, password: string): Promise<void> {
    await context.secrets.store(`iis-publish-${profileName}-username`, username);
    await context.secrets.store(`iis-publish-${profileName}-password`, password);
}

// Function to retrieve credentials
async function getCredentials(context: vscode.ExtensionContext, profileName: string): Promise<{ username: string, password: string } | null> {
    const username = await context.secrets.get(`iis-publish-${profileName}-username`);
    const password = await context.secrets.get(`iis-publish-${profileName}-password`);

    if (username && password) {
        return { username, password };
    }
    return null;
}

// Function to prompt for credentials
async function promptForCredentials(existingUsername?: string): Promise<{ username: string, password: string } | null> {
    const username = await vscode.window.showInputBox({
        prompt: 'Enter deployment username',
        placeHolder: 'username or DOMAIN\\username',
        value: existingUsername || ''
    });

    if (!username) {
        return null;
    }

    const password = await vscode.window.showInputBox({
        prompt: 'Enter deployment password',
        password: true
    });

    if (!password) {
        return null;
    }

    return { username, password };
}

// Function to create a new publish profile
async function createNewPublishProfile(context: vscode.ExtensionContext, projectDir: string): Promise<WebDeployConfig | null> {
    // Profile name
    const profileName = await vscode.window.showInputBox({
        prompt: 'Enter publish profile name',
        placeHolder: 'e.g., Production, Staging, Development'
    });

    if (!profileName) {
        return null;
    }

    // Step 1: Get server name or IP
    const serverName = await vscode.window.showInputBox({
        prompt: 'Enter server name or IP address',
        placeHolder: 'e.g., webserver-2 or 192.168.21.83',
        validateInput: (value) => {
            if (!value || value.trim() === '') {
                return 'Server name or IP is required';
            }
            return null;
        }
    });

    if (!serverName) {
        return null;
    }

    // Step 2: Choose protocol
    const protocol = await vscode.window.showQuickPick(
        [
            { label: 'HTTPS (Recommended)', value: 'https://' },
            { label: 'HTTP (Not secure)', value: 'http://' }
        ],
        {
            placeHolder: 'Select protocol'
        }
    );

    if (!protocol) {
        return null;
    }

    // Step 3: Get port (with default)
    const port = await vscode.window.showInputBox({
        prompt: 'Enter Web Management Service port',
        placeHolder: '8172',
        value: '8172',
        validateInput: (value) => {
            if (!value || value.trim() === '') {
                return 'Port is required';
            }
            if (!/^\d+$/.test(value)) {
                return 'Port must be a number';
            }
            return null;
        }
    });

    if (!port) {
        return null;
    }

    // Auto-construct the full URL
    const autoServerUrl = `${protocol.value}${serverName.trim()}:${port}/msdeploy.axd`;

    // Step 4: Confirm/edit the constructed URL
    const serverUrl = await vscode.window.showInputBox({
        prompt: 'Confirm or edit the Web Deploy URL',
        value: autoServerUrl,
        validateInput: (value) => {
            if (!value || value.trim() === '') {
                return 'Server URL is required';
            }
            if (!value.startsWith('http://') && !value.startsWith('https://')) {
                return 'URL must start with http:// or https://';
            }
            if (!value.includes('/msdeploy.axd')) {
                return 'URL should end with /msdeploy.axd';
            }
            return null;
        }
    });

    if (!serverUrl) {
        return null;
    }

    // Site name
    const siteName = await vscode.window.showInputBox({
        prompt: 'Enter IIS site name',
        placeHolder: 'e.g., Default Web Site/MyApp'
    });

    if (!siteName) {
        return null;
    }

    // Credentials
    const credentials = await promptForCredentials();
    if (!credentials) {
        return null;
    }

    // Allow untrusted certificate
    const allowUntrusted = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Allow untrusted SSL certificates? (useful for self-signed certs)'
    });

    const config: WebDeployConfig = {
        profileName,
        serverUrl,
        siteName,
        username: credentials.username,
        password: credentials.password,
        allowUntrustedCert: allowUntrusted === 'Yes'
    };

    // Save profile
    try {
        await savePublishProfile(projectDir, config);
        await storeCredentials(context, profileName, credentials.username, credentials.password);
        vscode.window.showInformationMessage(`Publish profile "${profileName}" created successfully`);
        return config;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create publish profile: ${error}`);
        return null;
    }
}

// Main function to handle IIS publishing
async function publishToIIS(uri: vscode.Uri, context: vscode.ExtensionContext) {
    if (!uri || !uri.fsPath.endsWith('.csproj')) {
        vscode.window.showErrorMessage('Please select a .csproj file.');
        return;
    }

    const projectDir = path.dirname(uri.fsPath);
    const projectName = path.basename(uri.fsPath, '.csproj');

    // Find existing profiles
    const existingProfiles = findPublishProfiles(projectDir);

    // Build options for quick pick
    const options: string[] = [];
    if (existingProfiles.length > 0) {
        options.push(...existingProfiles.map(p => `📄 ${p.name}`));
        options.push('---');
    }
    options.push('➕ Create New Profile');

    // Show profile selection
    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select a publish profile or create a new one'
    });

    if (!selected) {
        return;
    }

    let config: WebDeployConfig | null = null;
    let profileName: string;

    if (selected === '➕ Create New Profile') {
        // Create new profile
        config = await createNewPublishProfile(context, projectDir);
        if (!config) {
            return;
        }
        profileName = config.profileName;
    } else {
        // Use existing profile
        profileName = selected.replace('📄 ', '');
        const profile = existingProfiles.find(p => p.name === profileName);

        if (!profile) {
            vscode.window.showErrorMessage('Selected profile not found');
            return;
        }

        // Parse profile for server info
        const profileData = parsePublishProfile(profile.filePath);

        // Try to get stored credentials
        let credentials = await getCredentials(context, profileName);

        // If no stored credentials, prompt for them
        if (!credentials) {
            credentials = await promptForCredentials(profileData.username);
            if (!credentials) {
                return;
            }

            // Ask if they want to save credentials
            const saveCredsChoice = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Save credentials for future use?'
            });

            if (saveCredsChoice === 'Yes') {
                await storeCredentials(context, profileName, credentials.username, credentials.password);
            }
        }

        config = {
            profileName,
            serverUrl: profileData.serverUrl || '',
            siteName: profileData.siteName || '',
            username: credentials.username,
            password: credentials.password,
            allowUntrustedCert: true
        };
    }

    // Select build configuration
    const configuration = await vscode.window.showQuickPick(['Debug', 'Release'], {
        placeHolder: 'Select build configuration'
    });

    if (!configuration) {
        return;
    }

    // Get target framework
    const detectedFramework = getTargetFramework(uri.fsPath);
    const defaultFramework = detectedFramework || 'net8.0';

    const framework = await vscode.window.showInputBox({
        prompt: 'Target framework (leave empty for default)',
        placeHolder: defaultFramework,
        value: defaultFramework
    });

    // Build the publish command
    let publishCommand = `dotnet publish ${quotePath(uri.fsPath)} -c ${configuration} /p:PublishProfile=${profileName}`;

    if (framework && framework.trim()) {
        publishCommand += ` -f ${framework.trim()}`;
    }

    // Add credentials as MSBuild parameters
    publishCommand += ` /p:UserName=${config.username}`;
    publishCommand += ` /p:Password=${config.password}`;

    if (config.allowUntrustedCert) {
        publishCommand += ` /p:AllowUntrustedCertificate=true`;
    }

    // Create and show terminal
    const terminal = vscode.window.createTerminal(`Publish to IIS - ${projectName}`);
    terminal.sendText(`cd ${quotePath(projectDir)}`);

    // Show info message (don't echo command to avoid password exposure)
    vscode.window.showInformationMessage(`Publishing ${projectName} to ${config.siteName}...`);
    vscode.window.showWarningMessage('⚠️ Password will be visible in terminal output. For production, use Windows Authentication or CI/CD with secrets.');

    // Execute publish command
    terminal.sendText(publishCommand);
    terminal.show();
}

// Activate function
export function activate(context: vscode.ExtensionContext) {
    // Register the publish to folder command with context
    const publishToFolderCommand = vscode.commands.registerCommand('extension.publishToFolder', async (uri: vscode.Uri) => {
        await publishToFolder(uri, context);
    });

    // Register the publish to IIS command with context
    const publishToIISCommand = vscode.commands.registerCommand('extension.publishToIIS', async (uri: vscode.Uri) => {
        await publishToIIS(uri, context);
    });

    context.subscriptions.push(scaffoldCommand);
    context.subscriptions.push(publishToFolderCommand);
    context.subscriptions.push(publishToIISCommand);
}

// Deactivate function
export function deactivate() {}
