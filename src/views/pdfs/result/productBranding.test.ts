import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect, it} from 'vitest';

it.each(['scan.html', 'hematological.html', 'hasnoLimits.html', 'hasLimits.html', 'chemistry.html'])('keeps the official product name in %s', filename => {
    const source = readFileSync(join(__dirname, filename), 'utf8');
    expect(source).toMatch(/Powered by Prime Laboratory Software \(PLS\)/);
    expect(source).not.toMatch(/Prime Laboratory System/);
});
