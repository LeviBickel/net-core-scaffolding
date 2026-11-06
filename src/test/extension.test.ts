// Smoke tests that load the bundled extension (dist/extension.js, the same file users
// get) into a real VS Code instance. These catch releases that fail to activate or
// leave menu entries pointing at commands that were never registered.
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'LeviBickel.net-core-mvc-scaffolding';

interface Manifest {
    main: string;
    contributes: {
        commands: { command: string }[];
        menus: Record<string, { command: string }[]>;
    };
}

suite('extension smoke tests', () => {
    let extension: vscode.Extension<unknown>;
    let manifest: Manifest;

    suiteSetup(async () => {
        const found = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(found, `extension ${EXTENSION_ID} is not installed in the test instance`);
        extension = found;
        manifest = extension.packageJSON as Manifest;
        await extension.activate();
    });

    test('activates without throwing', () => {
        assert.strictEqual(extension.isActive, true);
    });

    test('loads the bundled entry point declared in package.json', () => {
        assert.strictEqual(manifest.main, './dist/extension.js');
        assert.ok(fs.existsSync(path.join(extension.extensionPath, manifest.main)));
    });

    test('registers every contributed command', async () => {
        const registered = new Set(await vscode.commands.getCommands(true));
        const missing = manifest.contributes.commands
            .map(c => c.command)
            .filter(c => !registered.has(c));
        assert.deepStrictEqual(missing, [], `contributed but not registered: ${missing.join(', ')}`);
    });

    test('every menu entry points at a contributed command', () => {
        const contributed = new Set(manifest.contributes.commands.map(c => c.command));
        const dangling = Object.values(manifest.contributes.menus)
            .flat()
            .map(m => m.command)
            .filter(c => !contributed.has(c));
        assert.deepStrictEqual(dangling, []);
    });

    test('ships the SSH setup guide and opens it', async () => {
        assert.ok(fs.existsSync(path.join(extension.extensionPath, 'IIS-PUBLISH-GUIDE.md')));
        await vscode.commands.executeCommand('extension.openIISSSHGuide');
    });
});
