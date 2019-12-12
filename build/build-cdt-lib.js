/**
 * @license Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const fs = require('fs');

const outDir = `${__dirname}/../lighthouse-core/lib/cdt/generated`;
const files = {
  'node_modules/chrome-devtools-frontend/front_end/sdk/SourceMap.js': 'SourceMap.js',
};

// eslint-disable-next-line no-console
console.log('making modifications ...');

for (const [input, output] of Object.entries(files)) {
  const code = fs.readFileSync(input, 'utf-8');

  let lines = code.match(/^.*(\r?\n|$)/mg) || [];
  const cutoffIndex = lines.findIndex(line => line.includes('Legacy exported object'));
  lines = lines.splice(0, cutoffIndex);

  let deletionMode = false;
  let deletionBraceCount = 0;

  const modifiedLines = lines.map((line, i) => {
    // Don't modify jsdoc comments.
    if (/^\s*[/*]/.test(line)) {
      return line;
    }
    let newLine = line;

    if (input.endsWith('SourceMap.js')) {
      if (line.includes('static load(')) deletionMode = true;
      if (line.includes('sourceContentProvider(')) deletionMode = true;
      if (line.includes('Common.UIString')) newLine = '';
      if (line.includes('export class WasmSourceMap')) deletionMode = true;
      if (line.includes('WasmSourceMap')) newLine = '';
      if (line.includes('export class EditResult')) deletionMode = true;
      newLine = newLine.replace(`Common.ParsedURL.completeURL(this._baseURL, href)`, `''`);
    }

    if (deletionMode) {
      if (line.trim().endsWith('{')) deletionBraceCount += 1;
      if (line.trim().startsWith('}')) deletionBraceCount -= 1;
      if (deletionBraceCount >= 0) {
        newLine = '';
      }
      if (deletionBraceCount === 0) {
        deletionMode = false;
        deletionBraceCount = 0;
      }
    }

    // ESModules -> CommonJS.
    let match = newLine.match(/export default class (\w*)/);
    if (match) {
      newLine = newLine.replace(match[0], `const ${match[1]} = module.exports = class ${match[1]}`);
    }
    match = newLine.match(/export class (\w*)/);
    if (match) {
      newLine = newLine
        .replace(match[0], `const ${match[1]} = module.exports.${match[1]} = class ${match[1]}`);
    }

    if (newLine !== line) {
      // eslint-disable-next-line no-console
      console.log(`${input}:${i}: ${line.trim()}`);
    }
    return newLine;
  });
  const modifiedFile = [
    '// @ts-nocheck\n',
    '// generated by build-cdt-lib.js\n',
    'const Common = require(\'../Common.js\')\n',
    ...modifiedLines,
  ].join('');
  fs.writeFileSync(`${outDir}/${output}`, modifiedFile);
}
