// Unit tests for the pure helpers in src/helpers.ts. These import the real code that
// ships in the extension, so a regression in any helper fails here.
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    quotePath,
    extractModelInfo,
    getTargetFramework,
    getProjectConfigurations,
    findPublishProfiles,
    parsePublishProfile,
    generatePublishProfileXml,
    loadSshIisProfile,
    quotePowerShellSingle,
    remoteWindowsJoin,
    sshControlPath,
    sshArgs,
    scpArgs,
    SshIisProfile,
    WebDeployConfig
} from '../helpers';

let tmpRoot: string;

function tmpFile(name: string, content: string): string {
    const filePath = path.join(tmpRoot, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
}

function withPlatform<T>(platform: NodeJS.Platform, fn: () => T): T {
    const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { value: platform });
    try {
        return fn();
    } finally {
        Object.defineProperty(process, 'platform', original);
    }
}

const webDeployConfig: WebDeployConfig = {
    profileName: 'Production',
    serverUrl: 'https://server.example.com:8172/msdeploy.axd',
    siteName: 'Default Web Site/MyApp',
    username: 'DOMAIN\\deployer',
    password: 'super-secret-password',
    allowUntrustedCert: false
};

const sshProfile: SshIisProfile = {
    profileName: 'Prod',
    host: 'iis.example.com',
    port: 2222,
    username: 'deploy',
    privateKeyPath: '/home/me/.ssh/id_ed25519',
    remotePath: 'C:\\inetpub\\wwwroot\\MyApp',
    appPoolName: 'MyAppPool'
};

suite('helpers', () => {
    setup(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'netscaffolding-test-'));
    });

    teardown(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    suite('quotePath', () => {
        test('Windows: wraps in quotes without escaping backslashes or colons', () => {
            withPlatform('win32', () => {
                assert.strictEqual(quotePath('C:\\My Projects\\App (1)'), '"C:\\My Projects\\App (1)"');
                assert.strictEqual(quotePath('N:\\Shared\\App'), '"N:\\Shared\\App"');
                assert.strictEqual(quotePath('\\\\server\\share\\App'), '"\\\\server\\share\\App"');
            });
        });

        test('Unix: wraps in quotes and leaves ordinary characters alone', () => {
            withPlatform('darwin', () => {
                assert.strictEqual(quotePath('/Users/me/My Projects/App & (1)'), '"/Users/me/My Projects/App & (1)"');
            });
        });

        test('Unix: escapes characters special inside double quotes', () => {
            withPlatform('linux', () => {
                assert.strictEqual(quotePath('/a/$HOME'), '"/a/\\$HOME"');
                assert.strictEqual(quotePath('/a/`whoami`'), '"/a/\\`whoami\\`"');
                assert.strictEqual(quotePath('/a/say "hi"'), '"/a/say \\"hi\\""');
                assert.strictEqual(quotePath('/a/back\\slash'), '"/a/back\\\\slash"');
            });
        });
    });

    suite('extractModelInfo', () => {
        test('reads namespace and class name from a block-scoped namespace', () => {
            const file = tmpFile('Product.cs', 'namespace MyApp.Models\n{\n    public class Product\n    {\n    }\n}\n');
            assert.deepStrictEqual(extractModelInfo(file), { namespace: 'MyApp.Models', className: 'Product' });
        });

        test('reads a file-scoped namespace', () => {
            const file = tmpFile('Order.cs', 'namespace MyApp.Models;\n\npublic class Order { }\n');
            assert.deepStrictEqual(extractModelInfo(file), { namespace: 'MyApp.Models', className: 'Order' });
        });

        test('returns null when there is no namespace', () => {
            const file = tmpFile('NoNs.cs', 'public class Loose { }\n');
            assert.strictEqual(extractModelInfo(file), null);
        });
    });

    suite('getTargetFramework', () => {
        test('reads a single TargetFramework', () => {
            const file = tmpFile('App.csproj', '<Project><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>');
            assert.strictEqual(getTargetFramework(file), 'net8.0');
        });

        test('returns the first of multiple TargetFrameworks', () => {
            const file = tmpFile('App.csproj', '<Project><PropertyGroup><TargetFrameworks>net9.0;net8.0</TargetFrameworks></PropertyGroup></Project>');
            assert.strictEqual(getTargetFramework(file), 'net9.0');
        });

        test('returns null for a missing file or missing element', () => {
            assert.strictEqual(getTargetFramework(path.join(tmpRoot, 'missing.csproj')), null);
            const file = tmpFile('Empty.csproj', '<Project></Project>');
            assert.strictEqual(getTargetFramework(file), null);
        });
    });

    suite('getProjectConfigurations', () => {
        test('reads declared configurations', () => {
            const file = tmpFile('App.csproj', '<Project><PropertyGroup><Configurations>Debug; Release ;Staging;</Configurations></PropertyGroup></Project>');
            assert.deepStrictEqual(getProjectConfigurations(file), ['Debug', 'Release', 'Staging']);
        });

        test('falls back to Debug/Release when none are declared or the file is missing', () => {
            const file = tmpFile('App.csproj', '<Project></Project>');
            assert.deepStrictEqual(getProjectConfigurations(file), ['Debug', 'Release']);
            assert.deepStrictEqual(getProjectConfigurations(path.join(tmpRoot, 'missing.csproj')), ['Debug', 'Release']);
        });
    });

    suite('MSDeploy publish profiles', () => {
        test('generated XML contains the configuration but never the password', () => {
            const xml = generatePublishProfileXml(webDeployConfig);
            assert.ok(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>'));
            assert.ok(xml.includes(`<MSDeployServiceURL>${webDeployConfig.serverUrl}</MSDeployServiceURL>`));
            assert.ok(xml.includes(`<DeployIisAppPath>${webDeployConfig.siteName}</DeployIisAppPath>`));
            assert.ok(xml.includes(`<UserName>${webDeployConfig.username}</UserName>`));
            assert.ok(xml.includes('<_SavePWD>False</_SavePWD>'));
            assert.ok(xml.includes('<EnableMSDeployBackup>True</EnableMSDeployBackup>'));
            assert.ok(xml.includes('<SkipExtraFilesOnServer>True</SkipExtraFilesOnServer>'));
            assert.ok(!xml.includes(webDeployConfig.password));
        });

        test('round-trips through parsePublishProfile', () => {
            const file = tmpFile('Production.pubxml', generatePublishProfileXml(webDeployConfig));
            assert.deepStrictEqual(parsePublishProfile(file), {
                serverUrl: webDeployConfig.serverUrl,
                siteName: webDeployConfig.siteName,
                username: webDeployConfig.username
            });
        });

        test('parsePublishProfile tolerates missing elements and missing files', () => {
            const file = tmpFile('Partial.pubxml', '<Project><PropertyGroup><UserName>me</UserName></PropertyGroup></Project>');
            assert.deepStrictEqual(parsePublishProfile(file), { serverUrl: '', siteName: '', username: 'me' });
            assert.deepStrictEqual(parsePublishProfile(path.join(tmpRoot, 'missing.pubxml')), {});
        });
    });

    suite('findPublishProfiles', () => {
        test('returns an empty list when there is no PublishProfiles folder', () => {
            assert.deepStrictEqual(findPublishProfiles(tmpRoot), []);
        });

        test('finds MSDeploy and SSH profiles and ignores other files', () => {
            const dir = path.join('Properties', 'PublishProfiles');
            tmpFile(path.join(dir, 'Production.pubxml'), '<Project />');
            tmpFile(path.join(dir, 'Prod.iisssh.json'), '{}');
            tmpFile(path.join(dir, 'FolderProfile.pubxml.user'), '');
            tmpFile(path.join(dir, 'notes.txt'), '');

            const profiles = findPublishProfiles(tmpRoot).sort((a, b) => a.name.localeCompare(b.name));
            const profilesDir = path.join(tmpRoot, dir);
            assert.deepStrictEqual(profiles, [
                { name: 'Prod', filePath: path.join(profilesDir, 'Prod.iisssh.json'), kind: 'sshiis' },
                { name: 'Production', filePath: path.join(profilesDir, 'Production.pubxml'), kind: 'msdeploy' }
            ]);
        });
    });

    suite('SSH + PowerShell publishing', () => {
        test('loadSshIisProfile reads saved JSON and returns null for bad input', () => {
            const file = tmpFile('Prod.iisssh.json', JSON.stringify(sshProfile, null, 2));
            assert.deepStrictEqual(loadSshIisProfile(file), sshProfile);
            assert.strictEqual(loadSshIisProfile(tmpFile('bad.iisssh.json', '{not json')), null);
            assert.strictEqual(loadSshIisProfile(path.join(tmpRoot, 'missing.iisssh.json')), null);
        });

        test('quotePowerShellSingle doubles embedded single quotes', () => {
            assert.strictEqual(quotePowerShellSingle('MyAppPool'), "'MyAppPool'");
            assert.strictEqual(quotePowerShellSingle("O'Brien's Site"), "'O''Brien''s Site'");
        });

        test('remoteWindowsJoin uses a single backslash separator', () => {
            assert.strictEqual(remoteWindowsJoin('C:\\inetpub\\wwwroot\\MyApp', 'app_offline.htm'), 'C:\\inetpub\\wwwroot\\MyApp\\app_offline.htm');
            assert.strictEqual(remoteWindowsJoin('C:\\inetpub\\wwwroot\\MyApp\\', 'web.config'), 'C:\\inetpub\\wwwroot\\MyApp\\web.config');
            assert.strictEqual(remoteWindowsJoin('C:/inetpub/MyApp//', 'web.config'), 'C:/inetpub/MyApp\\web.config');
        });

        test('control socket path stays under the Unix socket length limit', function () {
            if (process.platform === 'win32') { this.skip(); }
            // OpenSSH expands %C to 40 chars and appends a ~17-char suffix; the limit is ~104 bytes
            const expanded = sshControlPath().replace('%C', 'x'.repeat(40)) + '.' + 'y'.repeat(17);
            assert.ok(Buffer.byteLength(expanded) < 104, `socket path too long: ${expanded}`);
        });

        test('sshArgs targets the host with key, port and a non-interactive PowerShell command', () => {
            const args = sshArgs(sshProfile, 'Stop-WebAppPool -Name \'MyAppPool\'');
            assert.deepStrictEqual(args.slice(0, 4), ['-i', sshProfile.privateKeyPath, '-p', '2222']);
            assert.ok(args.includes('BatchMode=yes'), 'ssh must never prompt for a password');
            assert.ok(args.some(a => a.startsWith('ControlPath=')));
            assert.deepStrictEqual(args.slice(-6), [
                'deploy@iis.example.com', 'powershell', '-NoProfile', '-NonInteractive', '-Command', 'Stop-WebAppPool -Name \'MyAppPool\''
            ]);
        });

        test('scpArgs copies all local paths recursively in one call', () => {
            const args = scpArgs(sshProfile, ['/tmp/out/a.dll', '/tmp/out/wwwroot'], 'C:/inetpub/wwwroot/MyApp');
            assert.deepStrictEqual(args.slice(0, 4), ['-P', '2222', '-i', sshProfile.privateKeyPath]);
            assert.ok(args.includes('-r'));
            assert.deepStrictEqual(args.slice(-3), ['/tmp/out/a.dll', '/tmp/out/wwwroot', 'deploy@iis.example.com:C:/inetpub/wwwroot/MyApp']);
        });
    });
});
