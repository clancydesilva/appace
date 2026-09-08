#!/usr/bin/env node
/**
 * scripts/sync-privacy.js
 *
 * Ensures privacy_policy.md remains the single source of truth across:
 * 1. The in-app TypeScript constant (constants/PrivacyPolicy.ts)
 * 2. The web / GitHub Pages view (index.html)
 *
 * Usage:
 *   node scripts/sync-privacy.js          # Syncs markdown to constants/PrivacyPolicy.ts
 *   node scripts/sync-privacy.js --check  # Verifies files are identical, fails with code 1 if drifted
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const MD_PATH = path.join(ROOT_DIR, 'privacy_policy.md');
const TS_PATH = path.join(ROOT_DIR, 'constants', 'PrivacyPolicy.ts');

const isCheck = process.argv.includes('--check');

if (!fs.existsSync(MD_PATH)) {
  console.error(`Error: ${MD_PATH} not found.`);
  process.exit(1);
}

const mdContent = fs.readFileSync(MD_PATH, 'utf8').trim();

// Escape backticks and ${} to safely embed inside TypeScript template literal
const escapedForTemplate = mdContent
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const generatedTs = `// AUTO-GENERATED from privacy_policy.md — DO NOT EDIT DIRECTLY.
// Run "npm run sync-privacy" to update.

export const PRIVACY_POLICY_MD = \`
${escapedForTemplate}
\`;
`;

if (isCheck) {
  if (!fs.existsSync(TS_PATH)) {
    console.error(`❌ Check failed: ${TS_PATH} does not exist. Run "npm run sync-privacy".`);
    process.exit(1);
  }

  const currentTs = fs.readFileSync(TS_PATH, 'utf8');
  // Normalize line endings for comparison
  const normalize = (s) => s.replace(/\r\n/g, '\n').trim();

  if (normalize(currentTs) !== normalize(generatedTs)) {
    console.error(`❌ Check failed: constants/PrivacyPolicy.ts is out of sync with privacy_policy.md!`);
    console.error(`Run "npm run sync-privacy" to update.`);
    process.exit(1);
  }

  console.log(`✓ Privacy policy in sync: constants/PrivacyPolicy.ts matches privacy_policy.md.`);
  process.exit(0);
}

// Sync mode
fs.writeFileSync(TS_PATH, generatedTs, 'utf8');
console.log(`✓ Successfully synced privacy_policy.md -> constants/PrivacyPolicy.ts`);
