// Generated sources are the generator's business, not ours: ktfmt and detekt are told to skip
// them, and this is TypeScript's only equivalent. Without it the strictest options cannot be
// turned on at all, because the generated client does not compile under them — while everything
// we write does.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pragma = '// @ts-nocheck -- generated; see scripts/exempt-generated.mjs\n';

function exempt(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      exempt(path);
      continue;
    }

    if (!path.endsWith('.ts')) continue;

    const source = readFileSync(path, 'utf8');

    if (source.startsWith(pragma)) continue;

    writeFileSync(path, pragma + source);
  }
}

exempt('src/gen');
