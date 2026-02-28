/**
 * Automated tests for IIS Web Deploy functionality
 * Run with: node test-iis-publish.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Test helpers
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(description, testFn) {
    totalTests++;
    try {
        testFn();
        console.log(`✓ ${description}`);
        passedTests++;
    } catch (error) {
        console.error(`✗ ${description}`);
        console.error(`  Error: ${error.message}`);
        failedTests++;
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(
            `${message || 'Assertion failed'}\n  Expected: ${expected}\n  Actual: ${actual}`
        );
    }
}

function assertIncludes(str, substring, message) {
    if (!str.includes(substring)) {
        throw new Error(
            `${message || 'Assertion failed'}\n  Expected to include: ${substring}\n  In: ${str}`
        );
    }
}

function assertNotIncludes(str, substring, message) {
    if (str.includes(substring)) {
        throw new Error(
            `${message || 'Assertion failed'}\n  Should not include: ${substring}\n  But found in: ${str}`
        );
    }
}

// Copy of functions from extension.ts for testing
function generatePublishProfileXml(config) {
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

function parsePublishProfile(filePath) {
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

function findPublishProfiles(projectDir) {
    const profilesPath = path.join(projectDir, 'Properties', 'PublishProfiles');
    const profiles = [];

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

// Create temp directory for tests
const tempDir = path.join(os.tmpdir(), 'iis-publish-tests-' + Date.now());
fs.mkdirSync(tempDir, { recursive: true });

console.log('\n=== XML Generation Tests ===\n');

test('Should generate valid XML structure', () => {
    const config = {
        profileName: 'Production',
        serverUrl: 'https://server.com:8172/msdeploy.axd',
        siteName: 'Default Web Site/MyApp',
        username: 'deployuser',
        password: 'password123'
    };

    const xml = generatePublishProfileXml(config);

    assertIncludes(xml, '<?xml version="1.0" encoding="utf-8"?>');
    assertIncludes(xml, '<WebPublishMethod>MSDeploy</WebPublishMethod>');
});

test('Should include server URL in XML', () => {
    const config = {
        serverUrl: 'https://myserver:8172/msdeploy.axd',
        siteName: 'Site',
        username: 'user'
    };

    const xml = generatePublishProfileXml(config);
    assertIncludes(xml, '<MSDeployServiceURL>https://myserver:8172/msdeploy.axd</MSDeployServiceURL>');
});

test('Should include site name in XML', () => {
    const config = {
        serverUrl: 'https://server.com',
        siteName: 'Default Web Site/MyApp',
        username: 'user'
    };

    const xml = generatePublishProfileXml(config);
    assertIncludes(xml, '<DeployIisAppPath>Default Web Site/MyApp</DeployIisAppPath>');
});

test('Should include username in XML', () => {
    const config = {
        serverUrl: 'https://server.com',
        siteName: 'Site',
        username: 'deployuser'
    };

    const xml = generatePublishProfileXml(config);
    assertIncludes(xml, '<UserName>deployuser</UserName>');
});

test('Should NOT include password in XML', () => {
    const config = {
        serverUrl: 'https://server.com',
        siteName: 'Site',
        username: 'user',
        password: 'secret123'
    };

    const xml = generatePublishProfileXml(config);
    assertNotIncludes(xml, 'secret123', 'Password should not be in XML');
    assertIncludes(xml, '<_SavePWD>False</_SavePWD>', 'Should indicate password not saved');
});

test('Should set backup enabled', () => {
    const config = {
        serverUrl: 'https://server.com',
        siteName: 'Site',
        username: 'user'
    };

    const xml = generatePublishProfileXml(config);
    assertIncludes(xml, '<EnableMSDeployBackup>True</EnableMSDeployBackup>');
});

test('Should set skip extra files', () => {
    const config = {
        serverUrl: 'https://server.com',
        siteName: 'Site',
        username: 'user'
    };

    const xml = generatePublishProfileXml(config);
    assertIncludes(xml, '<SkipExtraFilesOnServer>True</SkipExtraFilesOnServer>');
});

console.log('\n=== XML Parsing Tests ===\n');

test('Should parse server URL from XML', () => {
    const testXml = `<?xml version="1.0"?>
<Project>
  <PropertyGroup>
    <MSDeployServiceURL>https://testserver:8172/msdeploy.axd</MSDeployServiceURL>
    <DeployIisAppPath>TestSite</DeployIisAppPath>
    <UserName>testuser</UserName>
  </PropertyGroup>
</Project>`;

    const testFile = path.join(tempDir, 'test-parse.pubxml');
    fs.writeFileSync(testFile, testXml);

    const parsed = parsePublishProfile(testFile);
    assertEqual(parsed.serverUrl, 'https://testserver:8172/msdeploy.axd');
});

test('Should parse site name from XML', () => {
    const testXml = `<?xml version="1.0"?>
<Project>
  <PropertyGroup>
    <MSDeployServiceURL>https://server.com</MSDeployServiceURL>
    <DeployIisAppPath>Default Web Site/MyApp</DeployIisAppPath>
    <UserName>user</UserName>
  </PropertyGroup>
</Project>`;

    const testFile = path.join(tempDir, 'test-parse2.pubxml');
    fs.writeFileSync(testFile, testXml);

    const parsed = parsePublishProfile(testFile);
    assertEqual(parsed.siteName, 'Default Web Site/MyApp');
});

test('Should parse username from XML', () => {
    const testXml = `<?xml version="1.0"?>
<Project>
  <PropertyGroup>
    <MSDeployServiceURL>https://server.com</MSDeployServiceURL>
    <DeployIisAppPath>Site</DeployIisAppPath>
    <UserName>deployuser</UserName>
  </PropertyGroup>
</Project>`;

    const testFile = path.join(tempDir, 'test-parse3.pubxml');
    fs.writeFileSync(testFile, testXml);

    const parsed = parsePublishProfile(testFile);
    assertEqual(parsed.username, 'deployuser');
});

test('Should handle missing elements gracefully', () => {
    const testXml = `<?xml version="1.0"?>
<Project>
  <PropertyGroup>
    <SomeOtherProperty>value</SomeOtherProperty>
  </PropertyGroup>
</Project>`;

    const testFile = path.join(tempDir, 'test-parse4.pubxml');
    fs.writeFileSync(testFile, testXml);

    const parsed = parsePublishProfile(testFile);
    assertEqual(parsed.serverUrl, '');
    assertEqual(parsed.siteName, '');
    assertEqual(parsed.username, '');
});

console.log('\n=== Profile Discovery Tests ===\n');

test('Should return empty array when no profiles directory exists', () => {
    const noProfilesDir = path.join(tempDir, 'no-profiles-project');
    fs.mkdirSync(noProfilesDir, { recursive: true });

    const profiles = findPublishProfiles(noProfilesDir);
    assertEqual(profiles.length, 0);
});

test('Should find .pubxml files in PublishProfiles directory', () => {
    const projectDir = path.join(tempDir, 'test-project');
    const profilesDir = path.join(projectDir, 'Properties', 'PublishProfiles');
    fs.mkdirSync(profilesDir, { recursive: true });

    // Create test profiles
    fs.writeFileSync(path.join(profilesDir, 'Production.pubxml'), '<xml/>');
    fs.writeFileSync(path.join(profilesDir, 'Staging.pubxml'), '<xml/>');
    fs.writeFileSync(path.join(profilesDir, 'Development.pubxml'), '<xml/>');

    const profiles = findPublishProfiles(projectDir);
    assertEqual(profiles.length, 3);
});

test('Should extract profile names correctly', () => {
    const projectDir = path.join(tempDir, 'test-project2');
    const profilesDir = path.join(projectDir, 'Properties', 'PublishProfiles');
    fs.mkdirSync(profilesDir, { recursive: true });

    fs.writeFileSync(path.join(profilesDir, 'MyProfile.pubxml'), '<xml/>');

    const profiles = findPublishProfiles(projectDir);
    assertEqual(profiles.length, 1);
    assertEqual(profiles[0].name, 'MyProfile');
});

test('Should ignore non-.pubxml files', () => {
    const projectDir = path.join(tempDir, 'test-project3');
    const profilesDir = path.join(projectDir, 'Properties', 'PublishProfiles');
    fs.mkdirSync(profilesDir, { recursive: true });

    fs.writeFileSync(path.join(profilesDir, 'Valid.pubxml'), '<xml/>');
    fs.writeFileSync(path.join(profilesDir, 'readme.txt'), 'text');
    fs.writeFileSync(path.join(profilesDir, 'config.json'), '{}');

    const profiles = findPublishProfiles(projectDir);
    assertEqual(profiles.length, 1);
    assertEqual(profiles[0].name, 'Valid');
});

test('Should include full file path in profile object', () => {
    const projectDir = path.join(tempDir, 'test-project4');
    const profilesDir = path.join(projectDir, 'Properties', 'PublishProfiles');
    fs.mkdirSync(profilesDir, { recursive: true });

    fs.writeFileSync(path.join(profilesDir, 'TestProfile.pubxml'), '<xml/>');

    const profiles = findPublishProfiles(projectDir);
    assertEqual(profiles.length, 1);
    assertEqual(profiles[0].filePath, path.join(profilesDir, 'TestProfile.pubxml'));
});

console.log('\n=== Round-trip Tests (Generate + Parse) ===\n');

test('Should successfully round-trip configuration', () => {
    const config = {
        profileName: 'RoundTrip',
        serverUrl: 'https://roundtrip.com:8172/msdeploy.axd',
        siteName: 'Default Web Site/RoundTrip',
        username: 'roundtripuser',
        password: 'shouldNotAppear'
    };

    const xml = generatePublishProfileXml(config);
    const testFile = path.join(tempDir, 'roundtrip.pubxml');
    fs.writeFileSync(testFile, xml);

    const parsed = parsePublishProfile(testFile);
    assertEqual(parsed.serverUrl, config.serverUrl);
    assertEqual(parsed.siteName, config.siteName);
    assertEqual(parsed.username, config.username);
});

console.log('\n=== Security Tests ===\n');

test('Generated XML should never contain password', () => {
    const configs = [
        { serverUrl: 's', siteName: 's', username: 'u', password: 'SuperSecret123' },
        { serverUrl: 's', siteName: 's', username: 'u', password: 'P@ssw0rd!' },
        { serverUrl: 's', siteName: 's', username: 'u', password: 'admin' }
    ];

    configs.forEach(config => {
        const xml = generatePublishProfileXml(config);
        assertNotIncludes(xml, config.password, `Password "${config.password}" should not be in XML`);
    });
});

test('SavePWD should always be False', () => {
    const config = {
        serverUrl: 'https://server.com',
        siteName: 'Site',
        username: 'user',
        password: 'pass'
    };

    const xml = generatePublishProfileXml(config);
    assertIncludes(xml, '<_SavePWD>False</_SavePWD>');
    assertNotIncludes(xml, '<_SavePWD>True</_SavePWD>');
});

console.log('\n=== Edge Case Tests ===\n');

test('Should handle special characters in site name', () => {
    const config = {
        serverUrl: 'https://server.com',
        siteName: 'Default Web Site/My App (Production)',
        username: 'user'
    };

    const xml = generatePublishProfileXml(config);
    assertIncludes(xml, 'Default Web Site/My App (Production)');
});

test('Should handle DOMAIN\\username format', () => {
    const config = {
        serverUrl: 'https://server.com',
        siteName: 'Site',
        username: 'DOMAIN\\deployuser'
    };

    const xml = generatePublishProfileXml(config);
    assertIncludes(xml, '<UserName>DOMAIN\\deployuser</UserName>');
});

test('Should handle HTTPS URLs with custom ports', () => {
    const config = {
        serverUrl: 'https://server.example.com:9000/msdeploy.axd',
        siteName: 'Site',
        username: 'user'
    };

    const xml = generatePublishProfileXml(config);
    assertIncludes(xml, '<MSDeployServiceURL>https://server.example.com:9000/msdeploy.axd</MSDeployServiceURL>');
});

test('Should handle nested site paths', () => {
    const config = {
        serverUrl: 'https://server.com',
        siteName: 'MySite/SubFolder/MyApp/DeepNest',
        username: 'user'
    };

    const xml = generatePublishProfileXml(config);
    assertIncludes(xml, '<DeployIisAppPath>MySite/SubFolder/MyApp/DeepNest</DeployIisAppPath>');
});

// Cleanup
console.log('\n=== Cleanup ===\n');
try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`✓ Cleaned up temp directory: ${tempDir}`);
} catch (error) {
    console.log(`⚠ Could not clean up temp directory: ${error.message}`);
}

// Print summary
console.log('\n' + '='.repeat(50));
console.log(`Test Results: ${passedTests}/${totalTests} passed`);
if (failedTests > 0) {
    console.log(`${failedTests} test(s) FAILED`);
    process.exit(1);
} else {
    console.log('All tests PASSED ✓');
    process.exit(0);
}
