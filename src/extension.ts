import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
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
    kind: 'msdeploy' | 'sshiis';
}

interface WebDeployConfig {
    profileName: string;
    serverUrl: string;
    siteName: string;
    username: string;
    password: string;
    allowUntrustedCert: boolean;
}

// SSH + PowerShell based IIS deployment (works from macOS/Linux, no msdeploy client needed)
interface SshIisProfile {
    profileName: string;
    host: string;
    port: number;
    username: string;
    privateKeyPath: string;
    remotePath: string;      // Windows path, e.g. C:\inetpub\wwwroot\MyApp
    appPoolName: string;
    siteName?: string;
}

// Function to find existing publish profiles (both MSDeploy .pubxml and SSH .iisssh.json)
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
                filePath: path.join(profilesPath, file),
                kind: 'msdeploy'
            });
        } else if (file.endsWith('.iisssh.json')) {
            profiles.push({
                name: path.basename(file, '.iisssh.json'),
                filePath: path.join(profilesPath, file),
                kind: 'sshiis'
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

// ==================== SSH + PowerShell IIS Publishing ====================
// Alternative to MSDeploy for deploying from macOS/Linux to a Windows IIS
// server using the OpenSSH client and PowerShell (no msdeploy client required).

// Function to load an SSH IIS profile from disk
function loadSshIisProfile(filePath: string): SshIisProfile | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as SshIisProfile;
    } catch (error) {
        console.error('Error parsing SSH IIS profile:', error);
        return null;
    }
}

// Function to save an SSH IIS profile to disk
async function saveSshIisProfile(projectDir: string, profile: SshIisProfile): Promise<string> {
    const profilesPath = path.join(projectDir, 'Properties', 'PublishProfiles');

    if (!fs.existsSync(path.join(projectDir, 'Properties'))) {
        fs.mkdirSync(path.join(projectDir, 'Properties'));
    }
    if (!fs.existsSync(profilesPath)) {
        fs.mkdirSync(profilesPath);
    }

    const profilePath = path.join(profilesPath, `${profile.profileName}.iisssh.json`);
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf-8');
    return profilePath;
}

// Function to create a new SSH IIS profile
async function createNewSshIisProfile(context: vscode.ExtensionContext, projectDir: string): Promise<SshIisProfile | null> {
    const profileName = await vscode.window.showInputBox({
        prompt: 'Enter publish profile name',
        placeHolder: 'e.g., Production, Staging, Development'
    });
    if (!profileName) {
        return null;
    }

    const host = await vscode.window.showInputBox({
        prompt: 'Enter Windows server hostname or IP address',
        placeHolder: 'e.g., webserver-2 or 192.168.21.83',
        validateInput: (value) => (!value || value.trim() === '') ? 'Host is required' : null
    });
    if (!host) {
        return null;
    }

    const portInput = await vscode.window.showInputBox({
        prompt: 'Enter SSH port',
        placeHolder: '22',
        value: '22',
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
    if (!portInput) {
        return null;
    }

    const username = await vscode.window.showInputBox({
        prompt: 'Enter SSH username',
        placeHolder: 'e.g., deploy-user or DOMAIN\\deploy-user'
    });
    if (!username) {
        return null;
    }

    const defaultKeyDir = path.join(os.homedir(), '.ssh');
    const keyUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: 'Select Private Key',
        defaultUri: fs.existsSync(defaultKeyDir) ? vscode.Uri.file(defaultKeyDir) : undefined
    });
    if (!keyUri || keyUri.length === 0) {
        return null;
    }
    const privateKeyPath = keyUri[0].fsPath;

    const remotePath = await vscode.window.showInputBox({
        prompt: 'Enter remote deployment path on the Windows server',
        placeHolder: 'e.g., C:\\inetpub\\wwwroot\\MyApp',
        validateInput: (value) => (!value || value.trim() === '') ? 'Remote path is required' : null
    });
    if (!remotePath) {
        return null;
    }

    const appPoolName = await vscode.window.showInputBox({
        prompt: 'Enter IIS application pool name (recycled after each deploy)',
        placeHolder: 'e.g., MyApp',
        validateInput: (value) => (!value || value.trim() === '') ? 'App pool name is required' : null
    });
    if (!appPoolName) {
        return null;
    }

    const siteName = await vscode.window.showInputBox({
        prompt: 'Enter IIS site name (optional, for reference only)',
        placeHolder: 'e.g., Default Web Site/MyApp'
    });

    const profile: SshIisProfile = {
        profileName,
        host: host.trim(),
        port: parseInt(portInput, 10),
        username: username.trim(),
        privateKeyPath,
        remotePath: remotePath.trim(),
        appPoolName: appPoolName.trim(),
        siteName: siteName && siteName.trim() ? siteName.trim() : undefined
    };

    try {
        await saveSshIisProfile(projectDir, profile);
        vscode.window.showInformationMessage(`SSH publish profile "${profileName}" created successfully`);
        return profile;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create SSH publish profile: ${error}`);
        return null;
    }
}

// Escapes a value for safe interpolation inside a single-quoted PowerShell string
function quotePowerShellSingle(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

// Joins a remote Windows path with a file name using backslashes
function remoteWindowsJoin(remoteDir: string, fileName: string): string {
    return `${remoteDir.replace(/[\\/]+$/, '')}\\${fileName}`;
}

// A single deploy makes several separate ssh/scp calls (offline file, copy, bring back
// online, recycle pool). Sharing one multiplexed connection across all of them avoids
// paying a full TCP+SSH handshake for each call. %C is a pre-hashed, fixed-length
// identifier for (local host, remote host, port, user), keeping the socket path short
// regardless of how deep the OS temp directory is.
function sshControlPath(): string {
    // Unix domain socket paths are capped at ~104-108 bytes by the OS. OpenSSH expands
    // %C to a 40-char hash and appends its own ~17-char random suffix while creating the
    // socket, so os.tmpdir() (e.g. macOS's deeply nested /var/folders/.../T/) reliably
    // blows past that limit. /tmp is short and fixed, keeping the expanded path well
    // under the cap. Windows doesn't share this AF_UNIX path constraint the same way.
    const controlDir = process.platform === 'win32'
        ? path.join(os.tmpdir(), 'iis-ssh-cm')
        : '/tmp/iis-ssh-cm';
    if (!fs.existsSync(controlDir)) {
        fs.mkdirSync(controlDir, { recursive: true });
    }
    return path.join(controlDir, 'cm-%C');
}

function sshConnectionOptions(): string[] {
    return [
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ControlMaster=auto',
        '-o', 'ControlPersist=60s',
        '-o', `ControlPath=${sshControlPath()}`,
        '-C'
    ];
}

function sshArgs(profile: SshIisProfile, powerShellCommand: string): string[] {
    return [
        '-i', profile.privateKeyPath,
        '-p', String(profile.port),
        ...sshConnectionOptions(),
        `${profile.username}@${profile.host}`,
        'powershell', '-NoProfile', '-NonInteractive', '-Command', powerShellCommand
    ];
}

// localPaths are copied as siblings into remoteDest in a single scp invocation (one
// connection for the whole batch, instead of one process/handshake per file or folder).
function scpArgs(profile: SshIisProfile, localPaths: string[], remoteDest: string): string[] {
    const args = [
        '-P', String(profile.port),
        '-i', profile.privateKeyPath,
        ...sshConnectionOptions(),
        '-r'
    ];
    args.push(...localPaths, `${profile.username}@${profile.host}:${remoteDest}`);
    return args;
}

// Tells a running ControlMaster to exit right away instead of waiting out ControlPersist
async function closeSshControlConnection(profile: SshIisProfile, outputChannel: vscode.OutputChannel): Promise<void> {
    try {
        await runCommand('ssh', [
            '-o', `ControlPath=${sshControlPath()}`,
            '-O', 'exit',
            `${profile.username}@${profile.host}`
        ], outputChannel);
    } catch {
        // Best effort — ControlPersist=60s will clean the socket up on its own regardless
    }
}

// Opens the bundled SSH setup guide (server setup, key setup, permissions) in a Markdown preview
async function openIISSSHSetupGuide(context: vscode.ExtensionContext): Promise<void> {
    const guideUri = vscode.Uri.joinPath(context.extensionUri, 'IIS-PUBLISH-GUIDE.md');
    try {
        await vscode.commands.executeCommand('markdown.showPreviewToSide', guideUri);
    } catch (error) {
        // Fall back to a plain editor tab if the Markdown preview command isn't available
        const doc = await vscode.workspace.openTextDocument(guideUri);
        await vscode.window.showTextDocument(doc);
    }
}

let sshPublishOutputChannel: vscode.OutputChannel | undefined;
function getSshPublishOutputChannel(): vscode.OutputChannel {
    if (!sshPublishOutputChannel) {
        sshPublishOutputChannel = vscode.window.createOutputChannel('IIS SSH Publish');
    }
    return sshPublishOutputChannel;
}

// Runs a command via spawn (not exec) so output can stream and success/failure is detected reliably
function runCommand(command: string, args: string[], outputChannel: vscode.OutputChannel): Promise<void> {
    return new Promise((resolve, reject) => {
        outputChannel.appendLine(`$ ${command} ${args.join(' ')}`);
        const proc = cp.spawn(command, args);

        proc.stdout.on('data', (data) => outputChannel.append(data.toString()));
        proc.stderr.on('data', (data) => outputChannel.append(data.toString()));

        proc.on('error', (error) => reject(error));
        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}: ${command} ${args.slice(0, 2).join(' ')} ...`));
            }
        });
    });
}

// Main function to handle SSH + PowerShell based IIS publishing
async function publishToIISviaSsh(
    uri: vscode.Uri,
    profile: SshIisProfile,
    configuration: string,
    framework: string | undefined
): Promise<void> {
    const projectName = path.basename(uri.fsPath, '.csproj');
    const outputChannel = getSshPublishOutputChannel();
    outputChannel.clear();
    outputChannel.show(true);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `iis-publish-${projectName}-`));
    const remoteOfflineFile = remoteWindowsJoin(profile.remotePath, 'app_offline.htm');

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Publishing ${projectName} to ${profile.host}`,
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Building...' });
                const publishArgs = ['publish', uri.fsPath, '-c', configuration, '-o', tempDir];
                if (framework && framework.trim()) {
                    publishArgs.push('-f', framework.trim());
                }
                await runCommand('dotnet', publishArgs, outputChannel);

                try {
                    progress.report({ message: 'Taking app offline...' });
                    const offlineFilePath = path.join(tempDir, 'app_offline.htm');
                    fs.writeFileSync(offlineFilePath, '<html><body>Deploying update, back shortly...</body></html>', 'utf-8');
                    await runCommand('scp', scpArgs(profile, [offlineFilePath], remoteOfflineFile), outputChannel);
                    fs.rmSync(offlineFilePath, { force: true });

                    // app_offline.htm alone doesn't reliably release file locks for
                    // in-process hosted apps (the .NET default since Core 3.0), since the
                    // app's DLLs are loaded directly into the w3wp.exe worker process, not
                    // a separate process app_offline.htm can just kill. Stop the app pool
                    // outright and poll until IIS actually reports it stopped before
                    // copying, instead of guessing with a fixed delay — a slow-draining or
                    // actively-loaded app pool can easily take longer than a couple seconds.
                    progress.report({ message: 'Stopping application pool...' });
                    await runCommand('ssh', sshArgs(profile,
                        `Import-Module WebAdministration; Stop-WebAppPool -Name ${quotePowerShellSingle(profile.appPoolName)}; ` +
                        `$deadline = (Get-Date).AddSeconds(30); ` +
                        `while ((Get-WebAppPoolState -Name ${quotePowerShellSingle(profile.appPoolName)}).Value -ne 'Stopped' -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }`
                    ), outputChannel);

                    progress.report({ message: 'Copying published files...' });
                    const entries = fs.readdirSync(tempDir).map((entry) => path.join(tempDir, entry));
                    await runCommand('scp', scpArgs(profile, entries, profile.remotePath), outputChannel);

                    progress.report({ message: 'Bringing app back online...' });
                    await runCommand('ssh', sshArgs(profile, `Remove-Item -LiteralPath ${quotePowerShellSingle(remoteOfflineFile)} -Force -ErrorAction SilentlyContinue`), outputChannel);
                    await runCommand('ssh', sshArgs(profile, `Import-Module WebAdministration; Start-WebAppPool -Name ${quotePowerShellSingle(profile.appPoolName)}`), outputChannel);
                } catch (deployError) {
                    // Best effort: bring the app back online even if a later step failed
                    try {
                        await runCommand('ssh', sshArgs(profile, `Remove-Item -LiteralPath ${quotePowerShellSingle(remoteOfflineFile)} -Force -ErrorAction SilentlyContinue`), outputChannel);
                        await runCommand('ssh', sshArgs(profile, `Import-Module WebAdministration; Start-WebAppPool -Name ${quotePowerShellSingle(profile.appPoolName)} -ErrorAction SilentlyContinue`), outputChannel);
                    } catch {
                        // Ignore secondary failure; the original error is what matters
                    }
                    throw deployError;
                }
            }
        );

        vscode.window.showInformationMessage(`Successfully published ${projectName} to ${profile.host}.`);
    } catch (error) {
        outputChannel.appendLine(`ERROR: ${error}`);
        vscode.window.showErrorMessage(`Publish failed: ${error instanceof Error ? error.message : error}`);
    } finally {
        await closeSshControlConnection(profile, outputChannel);
        fs.rmSync(tempDir, { recursive: true, force: true });
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

    // Find existing profiles (both MSDeploy and SSH)
    const existingProfiles = findPublishProfiles(projectDir);
    const profileIcon = (kind: PublishProfile['kind']) => kind === 'sshiis' ? '🔐' : '📄';

    // Build options for quick pick
    const options: string[] = [];
    if (existingProfiles.length > 0) {
        options.push(...existingProfiles.map(p => `${profileIcon(p.kind)} ${p.name}`));
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

    let msDeployConfig: WebDeployConfig | null = null;
    let sshProfile: SshIisProfile | null = null;
    let profileName: string;
    let profileKind: PublishProfile['kind'];

    if (selected === '➕ Create New Profile') {
        const method = await vscode.window.showQuickPick(
            [
                { label: 'MSDeploy (Windows only)', value: 'msdeploy' as const },
                { label: 'SSH + PowerShell (cross-platform)', value: 'sshiis' as const }
            ],
            { placeHolder: 'Select deployment method' }
        );

        if (!method) {
            return;
        }

        if (method.value === 'msdeploy') {
            msDeployConfig = await createNewPublishProfile(context, projectDir);
            if (!msDeployConfig) {
                return;
            }
            profileName = msDeployConfig.profileName;
            profileKind = 'msdeploy';
        } else {
            const guideChoice = await vscode.window.showInformationMessage(
                'SSH + PowerShell publishing needs one-time server setup: enabling OpenSSH Server on the Windows box, installing an SSH key, and granting app pool permissions.',
                'View Setup Guide', 'Continue'
            );
            if (guideChoice === 'View Setup Guide') {
                await openIISSSHSetupGuide(context);
            }

            sshProfile = await createNewSshIisProfile(context, projectDir);
            if (!sshProfile) {
                return;
            }
            profileName = sshProfile.profileName;
            profileKind = 'sshiis';
        }
    } else {
        // Use existing profile
        const strippedName = selected.replace(/^(📄|🔐)\s/, '');
        const profile = existingProfiles.find(p => p.name === strippedName);

        if (!profile) {
            vscode.window.showErrorMessage('Selected profile not found');
            return;
        }

        profileName = profile.name;
        profileKind = profile.kind;

        if (profile.kind === 'sshiis') {
            sshProfile = loadSshIisProfile(profile.filePath);
            if (!sshProfile) {
                vscode.window.showErrorMessage('Failed to load SSH publish profile');
                return;
            }
        } else {
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

            msDeployConfig = {
                profileName,
                serverUrl: profileData.serverUrl || '',
                siteName: profileData.siteName || '',
                username: credentials.username,
                password: credentials.password,
                allowUntrustedCert: true
            };
        }
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

    if (profileKind === 'sshiis') {
        if (!sshProfile) {
            return;
        }
        await publishToIISviaSsh(uri, sshProfile, configuration, framework);
        return;
    }

    if (!msDeployConfig) {
        return;
    }

    // Build the publish command
    let publishCommand = `dotnet publish ${quotePath(uri.fsPath)} -c ${configuration} /p:PublishProfile=${profileName}`;

    if (framework && framework.trim()) {
        publishCommand += ` -f ${framework.trim()}`;
    }

    // Add credentials as MSBuild parameters
    publishCommand += ` /p:UserName=${msDeployConfig.username}`;
    publishCommand += ` /p:Password=${msDeployConfig.password}`;

    if (msDeployConfig.allowUntrustedCert) {
        publishCommand += ` /p:AllowUntrustedCertificate=true`;
    }

    // Create and show terminal
    const terminal = vscode.window.createTerminal(`Publish to IIS - ${projectName}`);
    terminal.sendText(`cd ${quotePath(projectDir)}`);

    // Show info message (don't echo command to avoid password exposure)
    vscode.window.showInformationMessage(`Publishing ${projectName} to ${msDeployConfig.siteName}...`);
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

    // Register a standalone command so the SSH setup guide is reachable anytime via the Command Palette
    const openIISSSHGuideCommand = vscode.commands.registerCommand('extension.openIISSSHGuide', async () => {
        await openIISSSHSetupGuide(context);
    });

    context.subscriptions.push(scaffoldCommand);
    context.subscriptions.push(publishToFolderCommand);
    context.subscriptions.push(publishToIISCommand);
    context.subscriptions.push(openIISSSHGuideCommand);
}

// Deactivate function
export function deactivate() {}
