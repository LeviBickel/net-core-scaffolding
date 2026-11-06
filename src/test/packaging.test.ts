// Checks what actually goes into the .vsix that users install, using the same file
// selection `vsce package` uses.
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { builtinModules } from 'module';

const root = path.resolve(__dirname, '..', '..');

suite('packaging', () => {
    test('the .vsix includes the bundle, manifest and guide, and no source or dependencies', async function () {
        this.timeout(30000);
        const { listFiles } = require('@vscode/vsce') as { listFiles(options: { cwd: string }): Promise<string[]> };
        const files = await listFiles({ cwd: root });

        for (const required of ['package.json', 'dist/extension.js', 'IIS-PUBLISH-GUIDE.md', 'README.md', 'CHANGELOG.md']) {
            assert.ok(files.includes(required), `${required} is missing from the package`);
        }
        const unwanted = files.filter(f => f.startsWith('src/') || f.startsWith('node_modules/') || f.startsWith('out/') || f.endsWith('.ts'));
        assert.deepStrictEqual(unwanted, []);
    });

    test('the bundle only requires vscode and Node built-ins', () => {
        // Anything else would need node_modules, which is not shipped
        const bundle = fs.readFileSync(path.join(root, 'dist', 'extension.js'), 'utf-8');
        const required = [...bundle.matchAll(/require\(["']([^"']+)["']\)/g)].map(m => m[1]);
        const external = required.filter(m => m !== 'vscode' && !builtinModules.includes(m.replace(/^node:/, '')));
        assert.deepStrictEqual([...new Set(external)], []);
    });
});
