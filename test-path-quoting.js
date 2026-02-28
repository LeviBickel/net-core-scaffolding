/**
 * Comprehensive tests for path quoting functionality
 * Run with: node test-path-quoting.js
 */

// Copy of the quotePath function from extension.ts
function quotePath(filePath, mockPlatform) {
    const platform = mockPlatform || process.platform;

    if (platform === 'win32') {
        // Windows (PowerShell/CMD): Just wrap in quotes
        return `"${filePath}"`;
    } else {
        // Unix (Linux/macOS) using Bash/Zsh/Fish
        // Escape characters that are special inside double quotes
        const escaped = filePath
            .replace(/\\/g, '\\\\')   // Backslash
            .replace(/"/g, '\\"')      // Double quote
            .replace(/\$/g, '\\$')     // Dollar sign
            .replace(/`/g, '\\`');     // Backtick
        return `"${escaped}"`;
    }
}

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

function assertNotIncludes(str, substring, message) {
    if (str.includes(substring)) {
        throw new Error(
            `${message || 'Assertion failed'}\n  String should not include: ${substring}\n  But got: ${str}`
        );
    }
}

console.log('\n=== Windows Platform Tests ===\n');

test('Should quote simple Windows path', () => {
    const result = quotePath('C:\\Users\\test\\file.txt', 'win32');
    assertEqual(result, '"C:\\Users\\test\\file.txt"');
});

test('Should quote Windows path with spaces', () => {
    const result = quotePath('C:\\Users\\Online Picture Viewer\\project.csproj', 'win32');
    assertEqual(result, '"C:\\Users\\Online Picture Viewer\\project.csproj"');
});

test('Should quote Windows path with drive letter N:', () => {
    const result = quotePath('N:\\Levi\\App Dev\\Exports\\PixleyStudio', 'win32');
    assertEqual(result, '"N:\\Levi\\App Dev\\Exports\\PixleyStudio"');
});

test('Should handle paths with parentheses', () => {
    const result = quotePath('C:\\Program Files (x86)\\App\\file.exe', 'win32');
    assertEqual(result, '"C:\\Program Files (x86)\\App\\file.exe"');
});

test('Should handle paths with ampersands', () => {
    const result = quotePath('C:\\Projects\\Research & Development\\file.txt', 'win32');
    assertEqual(result, '"C:\\Projects\\Research & Development\\file.txt"');
});

test('Should handle paths with at signs', () => {
    const result = quotePath('C:\\Users\\user@domain\\Documents\\file.txt', 'win32');
    assertEqual(result, '"C:\\Users\\user@domain\\Documents\\file.txt"');
});

test('Should handle paths with exclamation marks', () => {
    const result = quotePath('C:\\Projects\\New! Project\\file.txt', 'win32');
    assertEqual(result, '"C:\\Projects\\New! Project\\file.txt"');
});

test('Should NOT escape backslashes on Windows', () => {
    const result = quotePath('C:\\test\\path', 'win32');
    assertEqual(result, '"C:\\test\\path"');
    assertNotIncludes(result, '\\\\', 'Should not double backslashes');
});

test('Should NOT escape colons on Windows', () => {
    const result = quotePath('C:\\test', 'win32');
    assertEqual(result, '"C:\\test"');
    assertNotIncludes(result, '\\:', 'Should not escape colons');
});

test('Should handle UNC paths on Windows', () => {
    const result = quotePath('\\\\server\\share\\folder\\file.txt', 'win32');
    assertEqual(result, '"\\\\server\\share\\folder\\file.txt"');
});

console.log('\n=== Unix Platform Tests ===\n');

test('Should quote simple Unix path', () => {
    const result = quotePath('/home/user/file.txt', 'linux');
    assertEqual(result, '"/home/user/file.txt"');
});

test('Should quote Unix path with spaces', () => {
    const result = quotePath('/home/user/My Projects/file.txt', 'linux');
    assertEqual(result, '"/home/user/My Projects/file.txt"');
});

test('Should escape dollar signs on Unix', () => {
    const result = quotePath('/home/user/$PROJECT/file.txt', 'linux');
    assertEqual(result, '"/home/user/\\$PROJECT/file.txt"');
});

test('Should escape backticks on Unix', () => {
    const result = quotePath('/home/user/file`test`.txt', 'linux');
    assertEqual(result, '"/home/user/file\\`test\\`.txt"');
});

test('Should escape backslashes on Unix', () => {
    const result = quotePath('/home/user/file\\test.txt', 'linux');
    assertEqual(result, '"/home/user/file\\\\test.txt"');
});

test('Should escape double quotes on Unix', () => {
    const result = quotePath('/home/user/file"test".txt', 'linux');
    assertEqual(result, '"/home/user/file\\"test\\".txt"');
});

test('Should escape multiple special characters on Unix', () => {
    const result = quotePath('/home/user/$VAR/file`cmd`.txt', 'linux');
    assertEqual(result, '"/home/user/\\$VAR/file\\`cmd\\`.txt"');
});

test('Should handle paths with parentheses on Unix (no escaping)', () => {
    const result = quotePath('/opt/apps (beta)/file.txt', 'linux');
    assertEqual(result, '"/opt/apps (beta)/file.txt"');
});

test('Should handle paths with ampersands on Unix (no escaping)', () => {
    const result = quotePath('/home/user/Research & Dev/file.txt', 'linux');
    assertEqual(result, '"/home/user/Research & Dev/file.txt"');
});

console.log('\n=== Command Generation Tests ===\n');

test('Should generate valid cd command for Windows', () => {
    const path = 'C:\\Users\\Online Picture Viewer\\OnlineDriveViewer';
    const command = `cd ${quotePath(path, 'win32')}`;
    assertEqual(command, 'cd "C:\\Users\\Online Picture Viewer\\OnlineDriveViewer"');
});

test('Should generate valid dotnet publish command for Windows', () => {
    const projectPath = 'C:\\Users\\test\\project.csproj';
    const outputPath = 'N:\\Builds\\Output';
    const command = `dotnet publish ${quotePath(projectPath, 'win32')} -c Release -o ${quotePath(outputPath, 'win32')}`;
    assertEqual(
        command,
        'dotnet publish "C:\\Users\\test\\project.csproj" -c Release -o "N:\\Builds\\Output"'
    );
});

test('Should generate valid command with config and framework', () => {
    const projectPath = 'C:\\Projects\\My App\\app.csproj';
    const outputPath = 'C:\\Deploy\\App';
    const command = `dotnet publish ${quotePath(projectPath, 'win32')} -c Release -o ${quotePath(outputPath, 'win32')} -f net9.0`;
    assertEqual(
        command,
        'dotnet publish "C:\\Projects\\My App\\app.csproj" -c Release -o "C:\\Deploy\\App" -f net9.0'
    );
});

test('Original bug test: Path should not have c\\:', () => {
    const path = 'c:\\Users\\lbickel\\Documents\\Online Picture Viewer\\OnlineDriveViewer\\OnlineDriveViewer.csproj';
    const result = quotePath(path, 'win32');
    assertNotIncludes(result, 'c\\:', 'Should not have escaped colon after drive letter');
    assertEqual(result, '"c:\\Users\\lbickel\\Documents\\Online Picture Viewer\\OnlineDriveViewer\\OnlineDriveViewer.csproj"');
});

test('Original bug test: Full publish command', () => {
    const projectPath = 'c:\\Users\\lbickel\\Documents\\Online Picture Viewer\\OnlineDriveViewer\\OnlineDriveViewer.csproj';
    const outputPath = 'n:\\Levi\\App Dev\\Exports\\PixleyStudio';
    const command = `dotnet publish ${quotePath(projectPath, 'win32')} -c Release -o ${quotePath(outputPath, 'win32')} -f net9.0`;

    assertNotIncludes(command, 'c\\:', 'Should not have c\\:');
    assertNotIncludes(command, 'n\\:', 'Should not have n\\:');
    assertEqual(
        command,
        'dotnet publish "c:\\Users\\lbickel\\Documents\\Online Picture Viewer\\OnlineDriveViewer\\OnlineDriveViewer.csproj" -c Release -o "n:\\Levi\\App Dev\\Exports\\PixleyStudio" -f net9.0'
    );
});

console.log('\n=== Edge Cases ===\n');

test('Should handle empty path', () => {
    const result = quotePath('', 'win32');
    assertEqual(result, '""');
});

test('Should handle path with only spaces', () => {
    const result = quotePath('   ', 'win32');
    assertEqual(result, '"   "');
});

test('Should handle very long paths', () => {
    const longPath = 'C:\\' + 'VeryLongFolderName\\'.repeat(30) + 'file.txt';
    const result = quotePath(longPath, 'win32');
    assertEqual(result.substring(0, 4), '"C:\\');
    // Check that it ends with file.txt"
    const endsCorrectly = result.endsWith('file.txt"');
    if (!endsCorrectly) {
        throw new Error(`Expected to end with file.txt" but got: ...${result.substring(result.length - 15)}`);
    }
});

console.log('\n=== Actual Platform Test ===\n');

test(`Current platform (${process.platform}) basic test`, () => {
    if (process.platform === 'win32') {
        const result = quotePath('C:\\test\\path');
        assertEqual(result, '"C:\\test\\path"');
    } else {
        const result = quotePath('/home/test/path');
        assertEqual(result, '"/home/test/path"');
    }
});

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
