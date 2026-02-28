# IIS Web Deploy Publishing Guide

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
2. Select **"Publish to IIS (Web Deploy)"**
3. Choose your existing profile from the list
4. Enter credentials (if not stored)
5. Select build configuration (Debug/Release)
6. Confirm framework version
7. ✅ Done! Your app deploys to IIS

### Creating a New Profile

1. **Right-click** on your `.csproj` file
2. Select **"Publish to IIS (Web Deploy)"**
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
A: Yes for creating profiles, but publishing requires Windows Server with IIS.

**Q: Can I publish to Azure?**
A: Yes! Use Azure's Web Deploy endpoint from the portal.

## Support

Issues? Questions?
- 📝 [Report bugs](https://github.com/LeviBickel/net-core-scaffolding/issues)
- 💬 [Discussion forum](https://github.com/LeviBickel/net-core-scaffolding/discussions)
- 📖 [Web Deploy docs](https://www.iis.net/downloads/microsoft/web-deploy)

---

**Happy Deploying!** 🚀
