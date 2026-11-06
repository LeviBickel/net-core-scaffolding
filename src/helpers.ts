// Pure helpers with no dependency on the VS Code API, so they can be unit tested
// directly. extension.ts imports everything from here.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Function to safely quote paths for terminal commands
// Handles different shells: PowerShell, CMD, Bash, Zsh, Fish
export function quotePath(filePath: string): string {
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
export function extractModelInfo(filePath: string): { namespace: string, className: string } | null {
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

// Function to extract target framework from .csproj file
export function getTargetFramework(csprojPath: string): string | null {
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

// Function to extract declared build configurations from a .csproj file
export function getProjectConfigurations(csprojPath: string): string[] {
    try {
        const content = fs.readFileSync(csprojPath, 'utf-8');
        const match = content.match(/<Configurations>([^<]+)<\/Configurations>/i);
        if (match) {
            const configs = match[1].split(';').map(c => c.trim()).filter(c => c.length > 0);
            if (configs.length > 0) {
                return configs;
            }
        }
    } catch (error) {
        console.error(`Error reading .csproj file: ${error}`);
    }

    // No <Configurations> declared — matches the .NET SDK's own default
    return ['Debug', 'Release'];
}

export interface PublishProfile {
    name: string;
    filePath: string;
    kind: 'msdeploy' | 'sshiis';
}

export interface WebDeployConfig {
    profileName: string;
    serverUrl: string;
    siteName: string;
    username: string;
    password: string;
    allowUntrustedCert: boolean;
}

// SSH + PowerShell based IIS deployment (works from macOS/Linux, no msdeploy client needed)
export interface SshIisProfile {
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
export function findPublishProfiles(projectDir: string): PublishProfile[] {
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
export function parsePublishProfile(filePath: string): Partial<WebDeployConfig> {
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
export function generatePublishProfileXml(config: WebDeployConfig): string {
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

// Function to load an SSH IIS profile from disk
export function loadSshIisProfile(filePath: string): SshIisProfile | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as SshIisProfile;
    } catch (error) {
        console.error('Error parsing SSH IIS profile:', error);
        return null;
    }
}

// Escapes a value for safe interpolation inside a single-quoted PowerShell string
export function quotePowerShellSingle(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

// Joins a remote Windows path with a file name using backslashes
export function remoteWindowsJoin(remoteDir: string, fileName: string): string {
    return `${remoteDir.replace(/[\\/]+$/, '')}\\${fileName}`;
}

// A single deploy makes several separate ssh/scp calls (offline file, copy, bring back
// online, recycle pool). Sharing one multiplexed connection across all of them avoids
// paying a full TCP+SSH handshake for each call. %C is a pre-hashed, fixed-length
// identifier for (local host, remote host, port, user), keeping the socket path short
// regardless of how deep the OS temp directory is.
export function sshControlPath(): string {
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

export function sshConnectionOptions(): string[] {
    return [
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ControlMaster=auto',
        '-o', 'ControlPersist=60s',
        '-o', `ControlPath=${sshControlPath()}`,
        '-C'
    ];
}

export function sshArgs(profile: SshIisProfile, powerShellCommand: string): string[] {
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
export function scpArgs(profile: SshIisProfile, localPaths: string[], remoteDest: string): string[] {
    const args = [
        '-P', String(profile.port),
        '-i', profile.privateKeyPath,
        ...sshConnectionOptions(),
        '-r'
    ];
    args.push(...localPaths, `${profile.username}@${profile.host}:${remoteDest}`);
    return args;
}
