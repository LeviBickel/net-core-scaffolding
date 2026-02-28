# Script to check Web Deploy installation on server
# Run this on webserver-2 (192.168.21.83)

Write-Host "=== Checking Web Deploy Installation ===" -ForegroundColor Cyan

# Check if Web Deploy is installed
$webDeployPath = "C:\Program Files\IIS\Microsoft Web Deploy V3\msdeploy.exe"
if (Test-Path $webDeployPath) {
    Write-Host "✓ Web Deploy V3 is installed at: $webDeployPath" -ForegroundColor Green

    # Get version
    $version = & $webDeployPath -version
    Write-Host "  Version: $version" -ForegroundColor Green
} else {
    Write-Host "✗ Web Deploy V3 NOT found at expected location" -ForegroundColor Red
    Write-Host "  Looking for other versions..." -ForegroundColor Yellow

    # Check for V4
    $webDeployPathV4 = "C:\Program Files\IIS\Microsoft Web Deploy V4\msdeploy.exe"
    if (Test-Path $webDeployPathV4) {
        Write-Host "✓ Web Deploy V4 found at: $webDeployPathV4" -ForegroundColor Green
    } else {
        Write-Host "✗ Web Deploy is NOT installed" -ForegroundColor Red
        Write-Host "  Download from: https://www.iis.net/downloads/microsoft/web-deploy" -ForegroundColor Yellow
    }
}

# Check Web Deploy Handler
Write-Host "`n=== Checking IIS Handlers ===" -ForegroundColor Cyan
$handlers = Get-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter "system.webServer/handlers" -Name "Collection"

$msdeployHandler = $handlers | Where-Object { $_.name -like "*MSDeploy*" -or $_.name -like "*WebDeploy*" }
if ($msdeployHandler) {
    Write-Host "✓ Web Deploy handler found in IIS" -ForegroundColor Green
    $msdeployHandler | Format-Table name, path, verb -AutoSize
} else {
    Write-Host "✗ No Web Deploy handler found in IIS" -ForegroundColor Red
    Write-Host "  Web Deploy may not be properly installed" -ForegroundColor Yellow
}

# Check Web Deploy service
Write-Host "`n=== Checking Web Deploy Services ===" -ForegroundColor Cyan
$services = @("MsDepSvc", "WMSVC")
foreach ($svc in $services) {
    $service = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($service) {
        $status = $service.Status
        $color = if ($status -eq "Running") { "Green" } else { "Yellow" }
        Write-Host "  $($service.Name): $status" -ForegroundColor $color
    } else {
        Write-Host "  $svc: Not found" -ForegroundColor Gray
    }
}

# Check firewall for port 8172
Write-Host "`n=== Checking Firewall ===" -ForegroundColor Cyan
$firewallRule = Get-NetFirewallRule | Where-Object {
    $_.DisplayName -like "*Web*" -and
    ($_ | Get-NetFirewallPortFilter).LocalPort -eq 8172
}

if ($firewallRule) {
    Write-Host "✓ Firewall rule found for port 8172" -ForegroundColor Green
    $firewallRule | Format-Table DisplayName, Enabled, Direction -AutoSize
} else {
    Write-Host "⚠ No firewall rule found for port 8172" -ForegroundColor Yellow
    Write-Host "  May need to create firewall rule" -ForegroundColor Yellow
}

# Test if port 8172 is listening
Write-Host "`n=== Checking Port 8172 ===" -ForegroundColor Cyan
$listening = Get-NetTCPConnection -LocalPort 8172 -ErrorAction SilentlyContinue
if ($listening) {
    Write-Host "✓ Port 8172 is LISTENING" -ForegroundColor Green
    $listening | Format-Table LocalAddress, LocalPort, State -AutoSize
} else {
    Write-Host "✗ Port 8172 is NOT listening" -ForegroundColor Red
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "If Web Deploy is NOT installed:" -ForegroundColor Yellow
Write-Host "  1. Download Web Deploy 3.6: https://www.iis.net/downloads/microsoft/web-deploy" -ForegroundColor Yellow
Write-Host "  2. Install with 'Complete' option" -ForegroundColor Yellow
Write-Host "  3. Restart IIS and WMSVC service" -ForegroundColor Yellow
Write-Host "  4. Try publishing again" -ForegroundColor Yellow
