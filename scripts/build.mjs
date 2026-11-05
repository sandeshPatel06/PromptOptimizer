import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const filesToCopy = [
  'background.js',
  'sidepanel.html',
  'sidepanel.js',
  'sidepanel.css',
  'icons'
];

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function buildTarget(target) {
  const targetDir = path.join(distDir, target);
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy standard web extension files
  for (const item of filesToCopy) {
    const src = path.join(rootDir, item);
    const dest = path.join(targetDir, item);
    if (fs.existsSync(src)) {
      if (fs.lstatSync(src).isDirectory()) {
        copyDirRecursive(src, dest);
      } else {
        fs.copyFileSync(src, dest);
      }
    }
  }

  // Copy lib directory
  const libSrc = path.join(rootDir, 'lib');
  const libDest = path.join(targetDir, 'lib');
  if (fs.existsSync(libSrc)) {
    copyDirRecursive(libSrc, libDest);
  }

  // Select manifest
  const manifestSrc = target === 'firefox'
    ? path.join(rootDir, 'manifest.firefox.json')
    : path.join(rootDir, 'manifest.json');

  fs.copyFileSync(manifestSrc, path.join(targetDir, 'manifest.json'));

  console.log(`✓ Built ${target.toUpperCase()} extension package at: dist/${target}`);
}

console.log('Building PromptOptimizer for Chrome & Firefox...');
buildTarget('chrome');
buildTarget('firefox');
console.log('All builds completed successfully!');
