# IIS Publishing Guide

This extension supports publishing .NET applications to IIS two ways:

1. **Web Deploy (MSDeploy)** — the classic Visual Studio-style method. Requires the Windows msdeploy client, so file transfer only works when run **on Windows**. macOS/Linux can create `.pubxml` profiles but cannot publish with them.
2. **SSH + PowerShell** — works end-to-end **from macOS, Linux, or Windows** to a Windows IIS server, using the OpenSSH client and PowerShell instead of msdeploy. This is the method to use when deploying from a Mac.

Both methods share the same "Publish to IIS" command and profile picker; you choose the method when creating a new profile.

## Web Deploy (MSDeploy)

This extension now supports publishing .NET applications to IIS using Web Deploy (MSDeploy), providing a seamless Visual Studio-like experience directly in VS Code.

## Features

✅ **Use Existing Profiles** - Automatically detects and uses publish profiles from `Properties/PublishProfiles/`
✅ **Create New Profiles** - Interactive UI to create new Web Deploy profiles
✅ **Secure Credentials** - Passwords stored in VS Code's secure storage (never in files)
✅ **Compatible** - Works with profiles created in Visual Studio
✅ **Professional** - Generates standard `.pubxml` files for team sharing

## Quick Start

### Using an Existing Profile

1. **Right-click** on your `.csproj` file
2. Select **"Publish to IIS..."**
3. Choose your existing profile from the list
4. Enter credentials (if not stored)
5. Select build configuration (Debug/Release)
6. Confirm framework version
7. ✅ Done! Your app deploys to IIS

### Creating a New Profile

1. **Right-click** on your `.csproj` file
2. Select **"Publish to IIS..."**
3. Choose **"➕ Create New Profile"**
4. Follow the prompts:
   - **Profile name**: e.g., `Production`, `Staging`
   - **Server URL**: e.g., `https://yourserver:8172/msdeploy.axd`
   - **IIS Site name**: e.g., `Default Web Site/MyApp`
   - **Username**: Deployment credentials
   - **Password**: Deployment password
   - **Allow untrusted certificates**: Yes for self-signed certs
5. Profile is created and saved
6. Credentials stored securely
7. Publish begins automatically

## Server Setup Requirements

Your IIS server must have:
- ✅ IIS installed
- ✅ Web Deploy 3.6+ installed
- ✅ Web Management Service (WMSvc) running
- ✅ Deployment user with appropriate permissions

### Quick Server Setup (Windows Server)

```powershell
# Install Web Deploy
# Download from: https://www.iis.net/downloads/microsoft/web-deploy

# Enable Web Management Service
Install-WindowsFeature Web-Mgmt-Service
Set-Service WMSVC -StartupType Automatic
Start-Service WMSVC

# Configure firewall (if needed)
New-NetFirewallRule -DisplayName "Web Deploy" -Direction Inbound -LocalPort 8172 -Protocol TCP -Action Allow
```

## Profile File Structure

Profiles are saved in:
```
YourProject/
├── Properties/
│   └── PublishProfiles/
│       ├── Production.pubxml
│       ├── Staging.pubxml
│       └── Development.pubxml
└── YourProject.csproj
```

### Example Profile (`Production.pubxml`)

```xml
<?xml version="1.0" encoding="utf-8"?>
<Project ToolsVersion="4.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <PropertyGroup>
    <WebPublishMethod>MSDeploy</WebPublishMethod>
    <LastUsedBuildConfiguration>Release</LastUsedBuildConfiguration>
    <MSDeployServiceURL>https://yourserver:8172/msdeploy.axd</MSDeployServiceURL>
    <DeployIisAppPath>Default Web Site/YourApp</DeployIisAppPath>
    <UserName>deploy-user</UserName>
    <_SavePWD>False</_SavePWD>
    <SkipExtraFilesOnServer>True</SkipExtraFilesOnServer>
    <EnableMSDeployBackup>True</EnableMSDeployBackup>
  </PropertyGroup>
</Project>
```

## Security Best Practices

### Credential Storage
- ❌ **Never** commit passwords to source control
- ✅ Passwords stored in VS Code secure storage
- ✅ `.pubxml` files safe to commit (no passwords)
- ✅ Credentials stored per-profile, per-workspace

### Clearing Stored Credentials

To remove stored credentials:
1. VS Code → Settings → Search "Manage Trusted Extensions and Storage"
2. Clear extension storage

Or programmatically:
```typescript
// Credentials are stored with keys like:
// iis-publish-{ProfileName}-username
// iis-publish-{ProfileName}-password
```

## Advanced Configuration

### Using Windows Authentication

If your server uses Windows Auth instead of basic auth:

1. Set username as: `DOMAIN\\username`
2. Provide domain password
3. Ensure server allows Windows Auth for Web Deploy

### Custom Server Ports

Default: `https://yourserver:8172/msdeploy.axd`

If using custom port:
```
https://yourserver:9000/msdeploy.axd
```

### Publishing to Specific Application Paths

For apps in subfolders:
```
Site name: Default Web Site/SubFolder/MyApp
```

For multiple sites:
```
Site name: MySite/MyApp
```

## Troubleshooting

### "Could not connect to server"

**Causes:**
- Web Management Service not running
- Firewall blocking port 8172
- SSL certificate issues

**Solutions:**
```powershell
# Check service status
Get-Service WMSVC

# Restart service
Restart-Service WMSVC

# Check firewall
Get-NetFirewallRule -DisplayName "*8172*"
```

### "Authentication failed"

**Causes:**
- Incorrect username/password
- User lacks deployment permissions
- Windows Auth mismatch

**Solutions:**
1. Verify credentials in IIS Manager
2. Check user is in "Delegated Users" list
3. Try `DOMAIN\\username` format for Windows Auth

### "Publish profile not found"

**Causes:**
- Profile file missing
- Incorrect profile name
- Wrong project directory

**Solutions:**
1. Verify `.pubxml` exists in `Properties/PublishProfiles/`
2. Check exact profile name (case-sensitive)
3. Re-create profile using extension

### "Untrusted certificate"

**Causes:**
- Self-signed SSL certificate
- Certificate chain not trusted

**Solutions:**
- Enable "Allow untrusted certificates" when creating profile
- Or install proper SSL certificate on server

## Command Line Alternative

You can also publish directly from terminal:

### Using Profile
```bash
dotnet publish -c Release /p:PublishProfile=Production /p:Password=yourpassword
```

### Without Profile (Full Parameters)
```bash
dotnet publish -c Release \
  /p:WebPublishMethod=MSDeploy \
  /p:MSDeployServiceURL=https://yourserver:8172/msdeploy.axd \
  /p:DeployIisAppPath="Default Web Site/MyApp" \
  /p:UserName=username \
  /p:Password=password \
  /p:AllowUntrustedCertificate=true
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Deploy to IIS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup .NET
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '8.0.x'

      - name: Publish to IIS
        run: |
          dotnet publish -c Release `
            /p:PublishProfile=Production `
            /p:Password=${{ secrets.DEPLOY_PASSWORD }}
        env:
          DEPLOY_PASSWORD: ${{ secrets.DEPLOY_PASSWORD }}
```

### Azure DevOps Example

```yaml
- task: DotNetCoreCLI@2
  displayName: 'Publish to IIS'
  inputs:
    command: 'publish'
    publishWebProjects: true
    arguments: '-c Release /p:PublishProfile=Production /p:Password=$(DeployPassword)'
    zipAfterPublish: false
```

## SSH + PowerShell (Mac → Windows IIS)

Use this method when publishing from macOS or Linux, since the MSDeploy
method above cannot actually transfer files from those platforms. It only
needs an OpenSSH client locally (built into macOS/Linux) and OpenSSH Server
+ PowerShell on the Windows target — no Web Deploy/WMSvc installation
required.

### How it works

1. Builds the project locally with `dotnet publish -c <config> -f <framework>` into a temp folder.
2. Uploads an `app_offline.htm` file to the site root first. The ASP.NET Core Module (ANCM) sees this and gracefully unloads just that app — other apps in the same pool keep running.
3. Copies the published output to the remote path via `scp`.
4. Removes `app_offline.htm`, bringing the app back online.
5. Recycles the configured IIS application pool via PowerShell's `WebAdministration` module (`Restart-WebAppPool`) as a safety net so any cached state is cleared.
6. Deletes the local temp build output.

All command output streams to the **"IIS SSH Publish"** output channel in VS Code.

### Prerequisite: ASP.NET Core Hosting Bundle

This is required regardless of which deploy method you use (SSH or
MSDeploy) — it's an IIS requirement, not specific to this extension. If
it's missing, the site will 500 with an error like `HTTP Error 500.19 -
Internal Server Error` / `Error Code 0x8007000d` complaining about invalid
configuration data, because IIS doesn't recognize the `<aspNetCore>`
element in your published `web.config` at all. Install the **ASP.NET Core
Runtime Hosting Bundle** matching your target framework (e.g. .NET 9 →
[hosting bundle for 9.0](https://dotnet.microsoft.com/download/dotnet/9.0)),
then restart IIS so the newly registered module takes effect:

```powershell
net stop was /y
net start w3svc
```

### Windows Server Setup

Windows ships two different OpenSSH services and it's easy to install the
wrong one:

- **"OpenSSH Authentication Agent"** (service name `ssh-agent`) — already present on Windows 10/11 by default. It just caches decrypted keys locally; it is **not** a server and does not accept incoming connections. Starting/enabling this one alone will not let you connect in.
- **"OpenSSH SSH Server"** (service name `sshd`) — the actual server we need. This is **not** installed by default and must be added explicitly.

Also, the fixed-version capability name (`OpenSSH.Server~~~~0.0.1.0`) varies
across Windows builds, so hardcoding it can silently fail to install
anything. Look the exact name up instead:

```powershell
# Check what's currently installed
Get-WindowsCapability -Online -Name 'OpenSSH*' | Select-Object Name, State

# Install the Server capability (looks up the correct version suffix automatically)
Get-WindowsCapability -Online -Name 'OpenSSH.Server*' | Add-WindowsCapability -Online

# Confirm the sshd service now exists (should list both ssh-agent and sshd)
Get-Service -Name '*ssh*'

# Start and enable sshd specifically — NOT ssh-agent
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic

# Allow SSH through the firewall
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22

# Optional but recommended: make PowerShell the default shell for SSH sessions
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell -Value "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -PropertyType String -Force
```

If `Get-Service sshd` reports it can't find the service after the
`Add-WindowsCapability` step, re-run `Get-WindowsCapability -Online -Name
'OpenSSH.Server*'` and check the `State` column — it should say `Installed`,
not `NotPresent`. On some locked-down/managed images the capability install
can also fail silently if Windows Update access is blocked; in that case
the server MSI/feature needs to come from an offline source instead.

### SSH Key Setup (required — password auth is not supported for this method)

On your Mac:

```bash
# Generate a key if you don't already have one
ssh-keygen -t ed25519 -f ~/.ssh/iis_deploy_key
```

On the Windows server, the target account's `.ssh` folder almost never
exists yet — create it first, or the next step fails with a
`DirectoryNotFoundException`:

```powershell
ssh deploy-user@yourserver "New-Item -ItemType Directory -Force -Path C:\Users\deploy-user\.ssh"
```

Then copy the public key over. Do this in two steps — copy the file with
`scp`, then append it to `authorized_keys` in a PowerShell pipeline that
runs entirely on the server. Piping `cat file | ssh host "Add-Content ..."`
looks simpler but doesn't work reliably: `Add-Content` requires an
explicit `-Value`, and raw stdin piped in from an external process (your
local `cat`) isn't automatically bound to it the way a native PowerShell
pipeline's output would be — you'd need `-Value $input` and then fight
`$` escaping across both the local shell and the remote one. Keeping the
whole pipeline on the server side avoids that entirely, and also
sidesteps the encoding trap: a plain `cat >> file` redirect from PowerShell
writes UTF-16LE with a BOM, which `sshd` silently treats as an invalid key
even though the copy "succeeds", so use `-Encoding ascii` explicitly:

```bash
# 1. Copy the public key file itself to the server
scp ~/.ssh/iis_deploy_key.pub "deploy-user@yourserver:C:\Users\deploy-user\.ssh\iis_deploy_key.pub"

# 2. Append it into authorized_keys on the server side, then remove the temp copy
ssh deploy-user@yourserver "Get-Content C:\Users\deploy-user\.ssh\iis_deploy_key.pub | Add-Content -Path C:\Users\deploy-user\.ssh\authorized_keys -Encoding ascii; Remove-Item C:\Users\deploy-user\.ssh\iis_deploy_key.pub"
```

Verify it landed intact before moving on:

```powershell
ssh deploy-user@yourserver "Get-Content C:\Users\deploy-user\.ssh\authorized_keys"
```

If the deploy account is a **local administrator** on the Windows server
(commonly required so it can manage the app pool), the steps above alone
won't work — Windows OpenSSH Server's default config has a `Match Group
administrators` rule that **ignores the per-user `authorized_keys` file
entirely** for admin accounts and only reads the special admin keys file
instead. Symptom: key auth keeps failing with `Permission denied
(publickey,password,keyboard-interactive)` even though the key is
correctly installed at `C:\Users\<user>\.ssh\authorized_keys`.

Check whether this applies to your account first (still prompts for a
password — that's expected, it's not testing key auth yet):

```bash
ssh deploy-user@yourserver "whoami /groups | findstr Administrators"
```

If that matches, install the key into the admin-specific file instead:

```bash
# 1. Copy the public key to the server (temp location)
scp ~/.ssh/iis_deploy_key.pub "deploy-user@yourserver:C:\Users\deploy-user\.ssh\iis_deploy_key2.pub"
```

```powershell
# 2. Append it to the admin authorized_keys file, then remove the temp copy
ssh deploy-user@yourserver "Get-Content C:\Users\deploy-user\.ssh\iis_deploy_key2.pub | Add-Content -Path C:\ProgramData\ssh\administrators_authorized_keys -Encoding ascii; Remove-Item C:\Users\deploy-user\.ssh\iis_deploy_key2.pub"

# 3. Lock down the ACLs — sshd refuses to use this file otherwise
ssh deploy-user@yourserver "icacls.exe C:\ProgramData\ssh\administrators_authorized_keys /inheritance:r /grant Administrators:F /grant SYSTEM:F"

# 4. Verify
ssh deploy-user@yourserver "Get-Content C:\ProgramData\ssh\administrators_authorized_keys"
```

Then confirm key auth actually works end to end — this should log in with
**no password prompt**:

```bash
ssh -i ~/.ssh/iis_deploy_key deploy-user@yourserver "whoami"
```

Use a key with **no passphrase**, since the extension runs `ssh`/`scp`
non-interactively and cannot answer a passphrase prompt. If you'd rather
keep a passphrase on the key, load it into `ssh-agent` (`ssh-add`) before
publishing instead.

### Permissions

The deploy user needs:
- Write access to the remote deployment folder (e.g., `C:\inetpub\wwwroot\MyApp`)
- Rights to manage the target application pool (`Restart-WebAppPool` via the `WebAdministration` module normally requires local administrator rights, or a delegated IIS management configuration)

### Creating a Profile

**Tip:** this page is bundled with the extension — open it anytime from the
Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) via **"IIS Publish: Open
SSH Setup Guide"**, no need to hunt for it on GitHub. It also pops up
automatically with a "View Setup Guide" button the first time you create a
new SSH profile.

1. Right-click your `.csproj` file → **"Publish to IIS..."**
2. Choose **"➕ Create New Profile"**
3. Select **"SSH + PowerShell (cross-platform)"**
4. Enter: profile name, host/IP, SSH port (default `22`), username, private key file, remote deployment path, and the app pool name to recycle
5. Profile is saved as `Properties/PublishProfiles/<name>.iisssh.json` (no passwords or keys are embedded in the file — only the path to your private key)

**Username format:** use the plain account name (e.g. `deploy-user`), **not**
the `DOMAIN\deploy-user` form you'd type into a Windows logon dialog. SSH's
protocol-level username isn't matched against that format, so a
domain-qualified username causes public-key auth to be silently rejected
as an unrecognized identity, even if the same account's key works fine
under its plain name. If you already created a profile with the wrong
format, just edit `username` in the `.iisssh.json` file directly.

### Limitations (v1)

- Every deploy does a full copy of the publish output — there's no incremental/delta sync (unlike MSDeploy's built-in delta support). Stale files removed from the project aren't automatically deleted from the server.
- No progress cancellation mid-deploy once file copy has started, to avoid leaving the app pool in an inconsistent offline state.

## Comparison with Folder Publishing

| Feature | IIS Web Deploy | Folder Publish |
|---------|---------------|----------------|
| Direct to IIS | ✅ Yes | ❌ Manual copy needed |
| Incremental | ✅ Only changed files | ❌ Full copy |
| IIS Restart | ✅ Automatic | ❌ Manual |
| Rollback | ✅ Built-in backup | ❌ Manual backup |
| Speed | ✅ Fast (delta) | ⚠️ Slower (full) |
| Setup | ⚠️ Server config needed | ✅ None |
| Use Case | Production servers | Local/network folders |

## FAQ

**Q: Can I use this without Visual Studio?**
A: Yes! This extension creates profiles without needing Visual Studio.

**Q: Are my passwords safe?**
A: Yes, stored in VS Code's secure credential storage, same as other extensions.

**Q: Can I share profiles with my team?**
A: Yes! Commit `.pubxml` files to git. Each developer enters their own credentials.

**Q: Does this work on macOS/Linux?**
A: With the MSDeploy method, you can create profiles but publishing requires Windows (the msdeploy client). With the **SSH + PowerShell** method, publishing works fully from macOS/Linux to a Windows IIS server — see the [SSH + PowerShell](#ssh--powershell-mac--windows-iis) section above.

**Q: Can I publish to Azure?**
A: Yes! Use Azure's Web Deploy endpoint from the portal.

## Support

Issues? Questions?
- 📝 [Report bugs](https://github.com/LeviBickel/net-core-scaffolding/issues)
- 💬 [Discussion forum](https://github.com/LeviBickel/net-core-scaffolding/discussions)
- 📖 [Web Deploy docs](https://www.iis.net/downloads/microsoft/web-deploy)

---

**Happy Deploying!** 🚀
