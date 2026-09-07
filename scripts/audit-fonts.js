const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default || require('@babel/traverse');

// Directories to ignore during scanning
const IGNORED_DIRS = new Set(['node_modules', '.git', '.expo', 'android', 'apks', 'dist', 'build']);

/**
 * Recursively scans directory for .tsx files
 */
function findTsxFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findTsxFiles(fullPath, results);
    } else if (entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Truncates string to specified length, adding ellipsis if needed
 */
function truncate(str, maxLen = 40) {
  if (!str) return '';
  const clean = str.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 3) + '...';
}

/**
 * Extracts string content from an expression node
 */
function extractStringsFromExpr(node, isInsideTextWrapper = false) {
  if (!node) return [];
  switch (node.type) {
    case 'StringLiteral':
      return [{ content: node.value, line: node.loc?.start?.line, type: 'StringLiteral' }];

    case 'TemplateLiteral': {
      let preview = '`';
      node.quasis.forEach((quasi, idx) => {
        preview += quasi.value.raw;
        if (node.expressions[idx]) {
          const expr = node.expressions[idx];
          if (expr.type === 'Identifier') preview += `\${${expr.name}}`;
          else if (expr.type === 'MemberExpression') {
            const obj = expr.object.name || 'obj';
            const prop = expr.property.name || 'prop';
            preview += `\${${obj}.${prop}}`;
          } else {
            preview += '${...}';
          }
        }
      });
      preview += '`';
      return [{ content: preview, line: node.loc?.start?.line, type: 'TemplateLiteral' }];
    }

    case 'ConditionalExpression':
      return [
        ...extractStringsFromExpr(node.consequent, isInsideTextWrapper),
        ...extractStringsFromExpr(node.alternate, isInsideTextWrapper),
      ];

    case 'LogicalExpression':
      if (node.operator === '&&') {
        return extractStringsFromExpr(node.right, isInsideTextWrapper);
      } else if (node.operator === '||' || node.operator === '??') {
        return [
          ...extractStringsFromExpr(node.left, isInsideTextWrapper),
          ...extractStringsFromExpr(node.right, isInsideTextWrapper),
        ];
      }
      return [];

    case 'BinaryExpression':
      if (node.operator === '+') {
        return [
          ...extractStringsFromExpr(node.left, isInsideTextWrapper),
          ...extractStringsFromExpr(node.right, isInsideTextWrapper),
        ];
      }
      return [];

    case 'Identifier':
      if (isInsideTextWrapper) {
        return [{ content: `{${node.name}}`, line: node.loc?.start?.line, type: 'DynamicExpression' }];
      }
      return [];

    case 'MemberExpression': {
      if (isInsideTextWrapper) {
        const obj = node.object?.name || (node.object?.property?.name ? `...${node.object.property.name}` : 'obj');
        const prop = node.property?.name || 'prop';
        return [{ content: `{${obj}.${prop}}`, line: node.loc?.start?.line, type: 'DynamicExpression' }];
      }
      return [];
    }

    case 'CallExpression':
      if (isInsideTextWrapper) {
        return [{ content: '{call(...)}', line: node.loc?.start?.line, type: 'DynamicExpression' }];
      }
      return [];

    default:
      return [];
  }
}

/**
 * Resolves JSX element tag name
 */
function getTagName(openingElement) {
  const nameNode = openingElement.name;
  if (nameNode.type === 'JSXIdentifier') {
    return nameNode.name;
  }
  if (nameNode.type === 'JSXMemberExpression') {
    const obj = nameNode.object.name || 'Unknown';
    const prop = nameNode.property.name || 'Unknown';
    return `${obj}.${prop}`;
  }
  if (nameNode.type === 'JSXNamespacedName') {
    return `${nameNode.namespace.name}:${nameNode.name.name}`;
  }
  return 'Unknown';
}

/**
 * Audits a single .tsx file
 */
function auditFile(filePath, rootDir) {
  const code = fs.readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (err) {
    console.error(`Failed to parse ${filePath}:`, err.message);
    return [];
  }

  // Map of local identifier -> import details
  // localName -> { source, importedName }
  const imports = new Map();
  // Set of locally declared component names in this file
  const localDeclarations = new Set();

  traverse(ast, {
    ImportDeclaration(pathNode) {
      const source = pathNode.node.source.value;
      for (const specifier of pathNode.node.specifiers) {
        if (specifier.type === 'ImportSpecifier') {
          imports.set(specifier.local.name, {
            source,
            importedName: specifier.imported.name,
          });
        } else if (specifier.type === 'ImportDefaultSpecifier') {
          imports.set(specifier.local.name, {
            source,
            importedName: 'default',
          });
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
          imports.set(specifier.local.name, {
            source,
            importedName: '*',
          });
        }
      }
    },
    FunctionDeclaration(pathNode) {
      if (pathNode.node.id?.name) localDeclarations.add(pathNode.node.id.name);
    },
    VariableDeclarator(pathNode) {
      if (pathNode.node.id?.name) localDeclarations.add(pathNode.node.id.name);
    },
  });

  const relativeFilePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const results = [];

  traverse(ast, {
    JSXElement(pathNode) {
      const tagName = getTagName(pathNode.node.openingElement);

      // Classify the tag name
      let classification = 'UNKNOWN';
      let resolutionDetail = '';

      if (tagName.includes('.')) {
        const [objName, propName] = tagName.split('.');
        const importInfo = imports.get(objName);
        if (importInfo) {
          if (importInfo.source === 'react-native') {
            classification = (propName === 'Text' || propName === 'TextInput') ? 'RAW_RN' : 'RAW_RN_CONTAINER';
            resolutionDetail = `react-native .${propName}`;
          } else {
            classification = 'THIRD_PARTY';
            resolutionDetail = `${importInfo.source} .${propName}`;
          }
        } else {
          classification = 'UNKNOWN';
          resolutionDetail = `Unresolved object ${objName}`;
        }
      } else if (imports.has(tagName)) {
        const importInfo = imports.get(tagName);
        const resolvedSource = importInfo.source;

        // Check if resolves to components/Text.tsx wrapper
        let isWrapper = false;
        if (resolvedSource.startsWith('.')) {
          const absTarget = path.resolve(path.dirname(filePath), resolvedSource);
          const relTarget = path.relative(rootDir, absTarget).replace(/\\/g, '/');
          if (relTarget === 'components/Text' || relTarget === 'components/Text.tsx') {
            isWrapper = true;
          }
        }

        if (isWrapper) {
          classification = 'ENFORCED';
          resolutionDetail = 'components/Text.tsx';
        } else if (resolvedSource === 'react-native') {
          if (importInfo.importedName === 'Text' || importInfo.importedName === 'TextInput') {
            classification = 'RAW_RN';
          } else {
            classification = 'RAW_RN_CONTAINER';
          }
          resolutionDetail = `react-native -> ${importInfo.importedName}`;
        } else if (resolvedSource.startsWith('.')) {
          classification = 'LOCAL_COMPONENT';
          resolutionDetail = resolvedSource;
        } else {
          classification = 'THIRD_PARTY';
          resolutionDetail = `${resolvedSource} -> ${importInfo.importedName}`;
        }
      } else if (localDeclarations.has(tagName)) {
        classification = 'LOCAL_COMPONENT';
        resolutionDetail = 'locally declared';
      } else {
        classification = 'UNKNOWN';
        resolutionDetail = 'not imported';
      }

      // Check edge case: inside components/Text.tsx itself
      if (relativeFilePath === 'components/Text.tsx') {
        classification = 'ENFORCED_WRAPPER_DEF';
        resolutionDetail = 'Self-definition in components/Text.tsx';
      }

      const isTextWrapper = classification === 'ENFORCED' || classification === 'RAW_RN' || classification === 'ENFORCED_WRAPPER_DEF';
      const isTextReceiver = isTextWrapper || classification === 'THIRD_PARTY';

      // Collect strings from immediate children
      const textEntries = [];
      for (const child of pathNode.node.children) {
        if (child.type === 'JSXText') {
          const trimmed = child.value.replace(/\s+/g, ' ').trim();
          if (trimmed.length > 0) {
            textEntries.push({
              content: trimmed,
              line: child.loc?.start?.line || pathNode.node.loc?.start?.line,
            });
          }
        } else if (child.type === 'JSXExpressionContainer') {
          const extracted = extractStringsFromExpr(child.expression, isTextReceiver);
          for (const item of extracted) {
            if (item.content && item.content.trim().length > 0) {
              textEntries.push(item);
            }
          }
        }
      }

      if (textEntries.length === 0) return;

      for (const entry of textEntries) {
        results.push({
          classification,
          tag: tagName,
          resolutionDetail,
          file: relativeFilePath,
          line: entry.line,
          content: truncate(entry.content, 40),
        });
      }
    },
  });

  return results;
}

/**
 * Main execution
 */
function runAudit() {
  const rootDir = process.cwd();
  console.log(`Starting Font Enforcement Static-Analysis Audit...`);
  console.log(`Root: ${rootDir}\n`);

  const tsxFiles = findTsxFiles(rootDir);
  console.log(`Found ${tsxFiles.length} .tsx files to analyze.`);

  const allEntries = [];
  for (const file of tsxFiles) {
    const fileEntries = auditFile(file, rootDir);
    allEntries.push(...fileEntries);
  }

  // Group by classification
  const groups = {
    RAW_RN: [],
    RAW_RN_CONTAINER: [],
    THIRD_PARTY: [],
    UNKNOWN: [],
    LOCAL_COMPONENT: [],
    ENFORCED: [],
    ENFORCED_WRAPPER_DEF: [],
  };

  for (const entry of allEntries) {
    if (groups[entry.classification]) {
      groups[entry.classification].push(entry);
    } else {
      if (!groups.UNKNOWN) groups.UNKNOWN = [];
      groups.UNKNOWN.push(entry);
    }
  }

  console.log('\n======================================================');
  console.log('AUDIT SUMMARY BY CLASSIFICATION');
  console.log('======================================================');
  console.log(`RAW_RN (Direct RN Text/TextInput):  ${groups.RAW_RN.length}`);
  console.log(`RAW_RN_CONTAINER (Text in View):     ${groups.RAW_RN_CONTAINER.length}`);
  console.log(`THIRD_PARTY (External UI components):${groups.THIRD_PARTY.length}`);
  console.log(`UNKNOWN (Unresolved tag imports):    ${groups.UNKNOWN.length}`);
  console.log(`LOCAL_COMPONENT:                     ${groups.LOCAL_COMPONENT.length}`);
  console.log(`ENFORCED (components/Text.tsx):      ${groups.ENFORCED.length}`);
  console.log(`ENFORCED_WRAPPER_DEF:                ${groups.ENFORCED_WRAPPER_DEF.length}`);
  console.log(`TOTAL RENDERED TEXT NODES:           ${allEntries.length}`);

  // Function to print formatted table
  function printTable(title, entries) {
    console.log(`\n------------------------------------------------------`);
    console.log(`GROUP: ${title} (${entries.length} occurrences)`);
    console.log(`------------------------------------------------------`);
    if (entries.length === 0) {
      console.log('  (None - 0 occurrences found)');
      return;
    }
    console.log(
      '#'.padEnd(4) +
      'TAG'.padEnd(16) +
      'FILE:LINE'.padEnd(48) +
      'CONTENT'
    );
    console.log('-'.repeat(105));
    entries.forEach((e, idx) => {
      const num = String(idx + 1).padEnd(4);
      const tag = e.tag.padEnd(16);
      const loc = `${e.file}:${e.line}`.padEnd(48);
      console.log(`${num}${tag}${loc}${e.content}`);
    });
  }

  // Print every group explicitly as requested
  printTable('RAW_RN (React Native direct Text/TextInput - NOT on wrapper)', groups.RAW_RN);
  printTable('RAW_RN_CONTAINER (Text inside raw View/TouchableOpacity)', groups.RAW_RN_CONTAINER);
  printTable('THIRD_PARTY (External libraries rendering text)', groups.THIRD_PARTY);
  printTable('UNKNOWN (Unresolved import or custom element)', groups.UNKNOWN);
  printTable('LOCAL_COMPONENT (Custom local components with direct text children)', groups.LOCAL_COMPONENT);
  printTable('ENFORCED (components/Text.tsx wrapper - Bahnschrift Enforced)', groups.ENFORCED);

  return { groups, allEntries };
}

runAudit();
