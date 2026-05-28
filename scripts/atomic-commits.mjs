#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';

const ALLOWED_TYPES = new Set([
  'feat',
  'fix',
  'chore',
  'refactor',
  'style',
  'docs',
  'test',
  'build',
  'ci',
  'perf',
  'revert',
]);

const CONFIG_FILES = new Set([
  '.dockerignore',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.gitignore',
  '.npmrc',
  '.prettierrc',
  '.prettierrc.json',
  'eslint.config.js',
  'eslint.config.mjs',
  'jest.config.js',
  'jest.config.ts',
  'nest-cli.json',
  'package-lock.json',
  'package.json',
  'pnpm-lock.yaml',
  'prettier.config.js',
  'tsconfig.build.json',
  'tsconfig.json',
  'yarn.lock',
]);

const ALWAYS_IGNORED_SEGMENTS = new Set([
  '.cache',
  '.git',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'logs',
  'node_modules',
  'temp',
  'test-results',
  'tmp',
]);

const ALWAYS_IGNORED_ROOTS = new Set([
  '.local-storage',
  'storage',
  'uploads',
]);

const ALWAYS_IGNORED_BASENAMES = new Set([
  'npm-debug.log',
  'pnpm-debug.log',
  'yarn-error.log',
]);

const DB_BACKUP_EXTENSIONS = new Set([
  '.sqlite',
  '.sqlite3',
  '.db',
  '.dump',
  '.backup',
  '.bak',
]);

const ENV_ALLOWLIST = new Set(['.env.example', '.env.staging.example']);

const GENERIC_SUBJECTS = new Set([
  'add changes',
  'change file',
  'fix issue',
  'misc changes',
  'update code',
  'update file',
  'wip',
]);

const PORTUGUESE_WORDS = /\b(alterar|arquivo|atualizar|configuracao|configuração|corrigir|dados|implementar|nao|não|para|permissao|permissão|producao|produção|usuario|usuário)\b/i;
const NON_ASCII = /[^\x00-\x7F]/;

const SECRET_ASSIGNMENT = /^\s*(?:export\s+)?([A-Z0-9_.-]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API[_-]?KEY|PRIVATE[_-]?KEY|DATABASE_URL|DB_URL|JWT[A-Z0-9_.-]*SECRET)[A-Z0-9_.-]*)\s*[:=]\s*("?[^"#\n]+"?|'\S+'|\S+)/i;
const SECRET_PATTERNS = [
  { name: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/ },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: 'JWT token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

const DOMAIN_NAMES = new Map([
  ['assembly', 'assembly workflow'],
  ['auth', 'authentication'],
  ['clients', 'client management'],
  ['dashboard', 'management dashboard'],
  ['expedition', 'expedition workflow'],
  ['furniture', 'furniture management'],
  ['health', 'health check'],
  ['notifications', 'notification workflow'],
  ['orders', 'order management'],
  ['parts', 'part tracking'],
  ['platform', 'platform workspace'],
  ['processes', 'operator process workflow'],
  ['uploads', 'upload handling'],
  ['users', 'user management'],
]);

const args = parseArgs(process.argv.slice(2));
const originalCwd = process.cwd();

main().catch((error) => {
  console.error(`\n[atomic] Fatal error: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const repoRoot = getRepoRoot();
  const repoName = path.basename(repoRoot);
  const headAtStart = hasHead(repoRoot);
  const rawStatus = git(repoRoot, ['status', '--porcelain=v1', '-z']).stdout;
  const parsedEntries = parsePorcelainStatus(rawStatus);
  const expandedItems = expandStatusEntries(repoRoot, parsedEntries);
  const plan = buildProcessingPlan(repoRoot, expandedItems, headAtStart, args);

  printHeader({
    repoName,
    repoRoot,
    currentDir: originalCwd,
    headExists: headAtStart,
    dryRun: args.dryRun,
    detectedEntries: parsedEntries.length,
    detectedFiles: expandedItems.length,
    processCount: plan.items.length,
    ignoredCount: plan.ignored.length,
  });

  if (plan.ignored.length > 0) {
    console.log('\nIgnored files:');
    for (const ignored of plan.ignored) {
      console.log(`  - ${ignored.path} (${ignored.reason})`);
    }
  }

  if (plan.items.length === 0) {
    console.log('\nNo processable files found.');
    return;
  }

  const summary = {
    committed: 0,
    dryRun: 0,
    ignored: plan.ignored.length,
    skipped: 0,
    errors: 0,
  };

  const usedMessages = new Set();
  const rl = args.yes || args.dryRun
    ? null
    : readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    if (!args.dryRun) {
      clearStaging(repoRoot);
    }

    for (const item of plan.items) {
      const generatedMessage = ensureUniqueMessage(
        generateCommitMessage(repoRoot, item, headAtStart),
        item,
        usedMessages,
      );
      item.message = generatedMessage;

      printItem(item);

      if (args.dryRun) {
        console.log(`  Result: dry-run, no commit created`);
        summary.dryRun += 1;
        continue;
      }

      const decision = args.yes
        ? { action: 'commit', message: generatedMessage }
        : await promptForDecision(rl, generatedMessage);

      if (decision.action === 'quit') {
        console.log('  Result: stopped by user');
        break;
      }

      if (decision.action === 'skip') {
        console.log('  Result: skipped by user');
        summary.skipped += 1;
        continue;
      }

      const message = decision.message;
      const messageError = validateCommitMessage(message);
      if (messageError) {
        console.log(`  Result: skipped invalid message (${messageError})`);
        summary.skipped += 1;
        continue;
      }

      try {
        clearStaging(repoRoot);
        stageItem(repoRoot, item);
        assertOnlyCurrentItemStaged(repoRoot, item);

        if (!hasStagedChanges(repoRoot)) {
          console.log('  Result: skipped because staging produced no changes');
          summary.skipped += 1;
          continue;
        }

        git(repoRoot, ['commit', '-m', message]);
        console.log(`  Result: committed`);
        summary.committed += 1;
      } catch (error) {
        console.log(`  Result: error (${error.message})`);
        summary.errors += 1;
      } finally {
        clearStaging(repoRoot);
      }
    }
  } finally {
    if (rl) {
      rl.close();
    }

    if (!args.dryRun) {
      clearStaging(repoRoot);
    }
  }

  printSummary(summary);

  if (summary.errors > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    includeDeleted: false,
    includeEnv: false,
    yes: false,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--include-deleted') {
      options.includeDeleted = true;
    } else if (arg === '--include-env') {
      options.includeEnv = true;
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/atomic-commits.mjs [options]

Options:
  --yes, -y           Accept generated messages automatically
  --dry-run          Show the commit plan without staging or committing
  --include-env      Allow .env files to be considered
  --include-deleted  Allow deleted files to be committed
  --help, -h         Show this help message`);
}

function getRepoRoot() {
  const result = run('git', ['rev-parse', '--show-toplevel'], { cwd: originalCwd });
  return result.stdout.trim();
}

function hasHead(repoRoot) {
  return git(repoRoot, ['rev-parse', '--verify', 'HEAD'], { allowFailure: true }).status === 0;
}

function git(repoRoot, gitArgs, options = {}) {
  return run('git', gitArgs, { cwd: repoRoot, ...options });
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (!options.allowFailure && result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const detail = stderr || stdout || `exit code ${result.status}`;
    throw new Error(`${command} ${commandArgs.join(' ')} failed: ${detail}`);
  }

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status ?? 0,
  };
}

function parsePorcelainStatus(rawStatus) {
  if (!rawStatus) {
    return [];
  }

  const tokens = rawStatus.split('\0');
  if (tokens[tokens.length - 1] === '') {
    tokens.pop();
  }

  const entries = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token || token.length < 4) {
      continue;
    }

    const status = token.slice(0, 2);
    const filePath = normalizePath(token.slice(3));
    const isRename = status.includes('R') || status.includes('C');

    if (isRename) {
      const oldPath = normalizePath(tokens[index + 1] || '');
      index += 1;
      entries.push({
        path: filePath,
        oldPath,
        status,
        statusLabel: `${status} ${oldPath} -> ${filePath}`,
        type: 'rename',
      });
    } else {
      entries.push({
        path: filePath,
        oldPath: null,
        status,
        statusLabel: `${status} ${filePath}`,
        type: 'file',
      });
    }
  }

  return entries;
}

function expandStatusEntries(repoRoot, entries) {
  const expanded = [];
  const seen = new Set();

  for (const entry of entries) {
    if (entry.type === 'rename') {
      addExpandedItem(expanded, seen, entry);
      continue;
    }

    const absolutePath = path.join(repoRoot, entry.path);
    if (entry.status === '??' && isDirectory(absolutePath)) {
      const files = listFilesRecursively(absolutePath, repoRoot);
      for (const filePath of files) {
        addExpandedItem(expanded, seen, {
          ...entry,
          path: filePath,
          statusLabel: `${entry.status} ${filePath}`,
        });
      }
      continue;
    }

    addExpandedItem(expanded, seen, entry);
  }

  return expanded;
}

function addExpandedItem(expanded, seen, entry) {
  const key = entry.type === 'rename'
    ? `rename:${entry.oldPath}->${entry.path}`
    : `${entry.status}:${entry.path}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  expanded.push({
    ...entry,
    paths: entry.type === 'rename' ? [entry.oldPath, entry.path].filter(Boolean) : [entry.path],
  });
}

function listFilesRecursively(absoluteDir, repoRoot) {
  const files = [];
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = normalizePath(path.relative(repoRoot, absolutePath));

    if (entry.isDirectory()) {
      if (!ALWAYS_IGNORED_SEGMENTS.has(entry.name)) {
        files.push(...listFilesRecursively(absolutePath, repoRoot));
      }
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      files.push(relativePath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function buildProcessingPlan(repoRoot, items, headExists, options) {
  const ignored = [];
  const processable = [];

  for (const item of items) {
    const ignoreReason = getIgnoreReason(repoRoot, item, options);
    if (ignoreReason) {
      ignored.push({ path: item.path, reason: ignoreReason });
      continue;
    }

    const secretReason = getSecretReason(repoRoot, item);
    if (secretReason) {
      ignored.push({ path: item.path, reason: secretReason });
      continue;
    }

    processable.push({
      ...item,
      existsInWorkingTree: fs.existsSync(path.join(repoRoot, item.path)),
      headExists,
    });
  }

  return { ignored, items: processable };
}

function getIgnoreReason(repoRoot, item, options) {
  const paths = item.paths.length > 0 ? item.paths : [item.path];

  for (const filePath of paths) {
    const normalized = normalizePath(filePath);
    const baseName = path.posix.basename(normalized);
    const lowerBaseName = baseName.toLowerCase();
    const segments = normalized.split('/').filter(Boolean);

    if (ALWAYS_IGNORED_ROOTS.has(segments[0])) {
      return 'ignored local upload or storage directory';
    }

    if (segments.some((segment) => ALWAYS_IGNORED_SEGMENTS.has(segment))) {
      return 'ignored local/generated directory';
    }

    if (ALWAYS_IGNORED_BASENAMES.has(lowerBaseName) || lowerBaseName.endsWith('.log')) {
      return 'ignored log file';
    }

    if (DB_BACKUP_EXTENSIONS.has(path.posix.extname(lowerBaseName))) {
      return 'ignored local database, dump, or backup file';
    }

    if (isEnvFile(normalized) && !options.includeEnv) {
      return 'ignored environment file';
    }
  }

  if (isDeletedItem(item) && !options.includeDeleted) {
    return 'deleted file requires --include-deleted';
  }

  if (isUnmergedItem(item)) {
    return 'unmerged Git status requires manual resolution';
  }

  for (const filePath of paths) {
    const absolutePath = path.join(repoRoot, filePath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
      return 'directory status could not be expanded to files';
    }
  }

  return null;
}

function isEnvFile(filePath) {
  const baseName = path.posix.basename(filePath);
  return (baseName === '.env' || baseName.startsWith('.env.')) && !ENV_ALLOWLIST.has(baseName);
}

function isDeletedItem(item) {
  return item.type !== 'rename' && item.status.includes('D');
}

function isUnmergedItem(item) {
  return ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(item.status);
}

function getSecretReason(repoRoot, item) {
  if (isDeletedItem(item)) {
    return null;
  }

  const pathsToScan = item.type === 'rename' ? [item.path] : item.paths;

  for (const filePath of pathsToScan) {
    const absolutePath = path.join(repoRoot, filePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      continue;
    }

    const content = readTextFileSafe(absolutePath);
    if (content === null) {
      continue;
    }

    const secretMatch = findSecret(content);
    if (secretMatch) {
      return `possible secret detected: ${secretMatch}`;
    }
  }

  return null;
}

function readTextFileSafe(absolutePath) {
  const buffer = fs.readFileSync(absolutePath);
  if (buffer.includes(0)) {
    return null;
  }
  return buffer.toString('utf8');
}

function findSecret(content) {
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      return name;
    }
  }

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(SECRET_ASSIGNMENT);
    if (!match) {
      continue;
    }

    const value = stripQuotes(match[2].trim());
    if (isLikelySecretValue(value)) {
      return `credential assignment for ${match[1]}`;
    }
  }

  return null;
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function isLikelySecretValue(value) {
  const normalized = value.trim();
  const lower = normalized.toLowerCase();

  if (!normalized || normalized.length < 16) {
    return false;
  }

  if (
    lower.includes('example') ||
    lower.includes('placeholder') ||
    lower.includes('changeme') ||
    lower.includes('change-me') ||
    lower.includes('your_') ||
    lower.includes('your-') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('rastroom') ||
    lower.startsWith('dev-') ||
    lower.startsWith('test-') ||
    lower.startsWith('process.env')
  ) {
    return false;
  }

  if (/^[A-Za-z0-9_./+=:-]{24,}$/.test(normalized) && /[A-Za-z]/.test(normalized) && /[0-9]/.test(normalized)) {
    return true;
  }

  return /^postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i.test(normalized) && !lower.includes('localhost');
}

function generateCommitMessage(repoRoot, item, headExistsAtStart) {
  const filePath = item.path;
  const diff = getDiffText(repoRoot, item);
  const lowerDiff = diff.toLowerCase();
  const fileName = path.posix.basename(filePath);
  const lowerPath = filePath.toLowerCase();
  const moduleName = getModuleName(filePath);
  const domain = DOMAIN_NAMES.get(moduleName) || humanizeToken(moduleName) || humanizeFileName(fileName);
  const role = getFileRole(filePath);
  const statusKind = getStatusKind(item, headExistsAtStart);

  let type = inferCommitType({ filePath, fileName, lowerPath, moduleName, role, statusKind, diff, lowerDiff, item });
  let subject = inferSubject({ filePath, fileName, lowerPath, moduleName, domain, role, statusKind, diff, lowerDiff, type, item });

  if (type === 'perf' && !subject.startsWith('optimize')) {
    subject = `optimize ${subject}`;
  }

  const message = normalizeMessage(`${type}: ${subject}`);
  const validationError = validateCommitMessage(message);

  if (!validationError) {
    return message;
  }

  type = fallbackTypeForPath(lowerPath);
  subject = fallbackSubjectForPath(filePath, domain, role, type);
  return normalizeMessage(`${type}: ${subject}`);
}

function getDiffText(repoRoot, item) {
  const paths = item.paths.length > 0 ? item.paths : [item.path];
  const chunks = [];

  for (const filePath of paths) {
    const worktreeDiff = git(repoRoot, ['diff', '--', filePath], { allowFailure: true }).stdout;
    const cachedDiff = git(repoRoot, ['diff', '--cached', '--', filePath], { allowFailure: true }).stdout;
    chunks.push(worktreeDiff, cachedDiff);

    const absolutePath = path.join(repoRoot, filePath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      const content = readTextFileSafe(absolutePath);
      if (content) {
        chunks.push(content);
      }
    }
  }

  return chunks.filter(Boolean).join('\n');
}

function inferCommitType(context) {
  const { filePath, fileName, lowerPath, moduleName, role, statusKind, lowerDiff, item } = context;

  if (statusKind !== 'added' && lowerDiff.includes('this reverts commit')) {
    return 'revert';
  }

  if (isTestPath(lowerPath, fileName)) {
    return 'test';
  }

  if (isDocsPath(lowerPath, fileName)) {
    return 'docs';
  }

  if (lowerPath.startsWith('.github/')) {
    return 'ci';
  }

  if (isEnvExamplePath(lowerPath)) {
    return 'chore';
  }

  if (lowerPath === 'src/app.module.ts' || lowerPath === 'src/main.ts') {
    return 'chore';
  }

  if (isBuildPath(lowerPath, fileName)) {
    return lowerPath.startsWith('.github/') ? 'ci' : 'build';
  }

  if (isConfigPath(lowerPath, fileName)) {
    return 'chore';
  }

  if (lowerPath.startsWith('prisma/migrations/')) {
    if (hasFixSignals(lowerDiff)) {
      return 'fix';
    }
    if (lowerDiff.includes('create table') || lowerDiff.includes('alter table') || lowerDiff.includes('create type')) {
      return 'feat';
    }
    return 'chore';
  }

  if (lowerPath === 'prisma/seed.ts' || lowerPath.startsWith('prisma/seed/')) {
    if (hasFixSignals(lowerDiff)) {
      return 'fix';
    }
    if (lowerDiff.includes('demo') || lowerDiff.includes('homologation') || lowerDiff.includes('staging')) {
      return 'feat';
    }
    return 'chore';
  }

  if (lowerPath === 'prisma/schema.prisma') {
    if (hasFixSignals(lowerDiff) || lowerDiff.includes('@@index') || lowerDiff.includes('@@unique')) {
      return 'fix';
    }
    if (statusKind === 'added' || lowerDiff.includes('+model ') || lowerDiff.includes('+enum ')) {
      return 'feat';
    }
    return 'chore';
  }

  if (filePath.startsWith('scripts/')) {
    return lowerPath.includes('staging') || lowerPath.includes('deploy') ? 'build' : 'chore';
  }

  if (role === 'guard' || role === 'strategy' || role === 'decorator' || lowerPath.includes('access-policy') || lowerPath.includes('permissions')) {
    if (hasFixSignals(lowerDiff)) {
      return 'fix';
    }
    if (hasRefactorSignals(lowerDiff) || item.type === 'rename') {
      return 'refactor';
    }
    return 'feat';
  }

  if (hasPerformanceSignals(lowerDiff, lowerPath)) {
    return 'perf';
  }

  if (hasFixSignals(lowerDiff)) {
    return 'fix';
  }

  if (hasRefactorSignals(lowerDiff) || item.type === 'rename') {
    return 'refactor';
  }

  if (lowerPath.startsWith('src/common/') || lowerPath.startsWith('src/shared/') || lowerPath.includes('/utils/')) {
    return statusKind === 'added' ? 'feat' : 'refactor';
  }

  if (moduleName) {
    if (statusKind === 'added') {
      return 'feat';
    }

    if (role === 'controller' && hasEndpointSignals(lowerDiff)) {
      return 'feat';
    }

    if (role === 'dto' && lowerDiff.includes('@is')) {
      return 'fix';
    }

    return 'refactor';
  }

  if (filePath.startsWith('scripts/')) {
    return 'chore';
  }

  return statusKind === 'added' ? 'feat' : 'chore';
}

function inferSubject(context) {
  const { filePath, fileName, lowerPath, moduleName, domain, role, statusKind, lowerDiff, type, item } = context;

  if (type === 'revert') {
    return `revert ${domain} changes`;
  }

  if (type === 'test') {
    return inferTestSubject(filePath, moduleName, domain);
  }

  if (type === 'docs') {
    if (lowerPath.includes('staging')) {
      return 'document staging deployment workflow';
    }
    if (fileName.toLowerCase() === 'readme.md') {
      return 'update backend README';
    }
    return `document ${domain}`;
  }

  if (type === 'ci') {
    return 'add backend validation workflow';
  }

  if (type === 'build') {
    if (lowerPath.includes('staging')) {
      return 'add staging Docker Compose configuration';
    }
    if (lowerPath.includes('docker')) {
      return 'update Docker build configuration';
    }
    return 'update backend build configuration';
  }

  if (lowerPath === 'package.json' || lowerPath === 'package-lock.json') {
    return 'update backend package scripts';
  }

  if (lowerPath === '.env.staging.example') {
    return 'update staging environment example';
  }

  if (lowerPath === '.env.example') {
    return 'update environment examples';
  }

  if (lowerPath === 'src/app.module.ts') {
    return 'update application module wiring';
  }

  if (lowerPath === 'src/main.ts') {
    return 'update application bootstrap';
  }

  if (lowerPath === 'src/health.controller.ts') {
    if (lowerDiff.includes('readiness')) {
      return type === 'fix'
        ? 'handle readiness check database failure'
        : 'add readiness health check';
    }
    return type === 'fix' ? 'correct health check endpoint' : 'add health check endpoint';
  }

  if (isConfigPath(lowerPath, fileName)) {
    if (isEnvExamplePath(lowerPath)) {
      return 'update environment examples';
    }
    if (lowerPath === '.gitignore') {
      return 'update repository ignore rules';
    }
    return `update ${humanizeFileName(fileName)} configuration`;
  }

  if (lowerPath.startsWith('prisma/migrations/')) {
    if (type === 'feat') {
      return 'add Rastroom domain migration';
    }
    if (type === 'fix') {
      return 'correct Prisma migration constraints';
    }
    return 'update Prisma migration files';
  }

  if (lowerPath === 'prisma/schema.prisma') {
    if (type === 'feat') {
      return 'add Prisma domain models';
    }
    if (type === 'fix') {
      return 'correct Prisma schema constraints';
    }
    return 'update Prisma schema';
  }

  if (lowerPath === 'prisma/seed.ts' || lowerPath.startsWith('prisma/seed/')) {
    if (type === 'feat') {
      return lowerDiff.includes('homologation') ? 'add homologation demo seed' : 'add Rastroom demo seed';
    }
    if (type === 'fix') {
      return 'correct demo seed data';
    }
    return 'update Prisma seed data';
  }

  if (filePath.startsWith('scripts/')) {
    if (fileName.includes('atomic')) {
      return 'add atomic commit automation';
    }
    if (fileName.includes('staging')) {
      return 'update staging smoke check';
    }
    if (fileName.includes('homologation')) {
      return 'update homologation check';
    }
    if (fileName.includes('seed')) {
      return 'update demo seed check';
    }
    return `update ${humanizeFileName(fileName)} script`;
  }

  const keywordSubject = subjectFromKeywords({ lowerDiff, lowerPath, moduleName, domain, role, type });
  if (keywordSubject) {
    return keywordSubject;
  }

  if (lowerPath.startsWith('src/common/') || lowerPath.startsWith('src/shared/')) {
    return commonSubject(type, filePath, role);
  }

  if (moduleName) {
    return moduleSubject({ type, moduleName, domain, role, statusKind });
  }

  if (item.type === 'rename') {
    return `rename ${humanizeFileName(fileName)}`;
  }

  return fallbackSubjectForPath(filePath, domain, role, type);
}

function subjectFromKeywords({ lowerDiff, lowerPath, moduleName, domain, role, type }) {
  if (moduleName === 'dashboard') {
    if (type === 'feat' && role === 'controller') {
      return 'add management dashboard endpoint';
    }
    if (type === 'feat') {
      return 'implement dashboard metrics service';
    }
    if (type === 'fix' && lowerDiff.includes('organization')) {
      return 'enforce organization filtering on dashboard metrics';
    }
    if (type === 'perf') {
      return 'optimize dashboard metrics aggregation';
    }
    if (type === 'refactor') {
      return 'simplify dashboard metrics aggregation';
    }
  }

  if (moduleName === 'processes') {
    if (lowerDiff.includes('current_process') || lowerDiff.includes('currentprocess')) {
      return type === 'fix'
        ? 'correct current process tracking'
        : 'update current process tracking';
    }
    if (lowerDiff.includes('route')) {
      return type === 'fix'
        ? 'prevent process route type mismatch'
        : 'update process route handling';
    }
    if (type === 'feat') {
      return 'add operator process workflow';
    }
    if (type === 'refactor') {
      return 'simplify process transition handling';
    }
  }

  if (moduleName === 'platform') {
    if (lowerDiff.includes('document') && lowerDiff.includes('label')) {
      return type === 'fix'
        ? 'hydrate document label data'
        : 'add document label generation';
    }
    if (lowerDiff.includes('access policy') || lowerPath.includes('access-policy')) {
      return type === 'fix'
        ? 'correct access policy enforcement'
        : type === 'refactor'
          ? 'centralize access policy rules'
          : 'implement access policy endpoint';
    }
    if (lowerDiff.includes('checklist')) {
      return `${type === 'feat' ? 'add' : 'update'} platform checklist workflow`;
    }
    if (lowerDiff.includes('defect')) {
      return `${type === 'feat' ? 'add' : 'update'} defect tracking workflow`;
    }
    if (lowerDiff.includes('audit')) {
      return `${type === 'feat' ? 'add' : 'update'} platform audit workflow`;
    }
    if (type === 'refactor') {
      return 'reorganize platform document service';
    }
  }

  if (moduleName === 'orders' && type === 'fix' && lowerDiff.includes('organization')) {
    return 'enforce organization filtering on orders';
  }

  if (moduleName === 'parts') {
    if (type === 'fix' && lowerDiff.includes('organization')) {
      return 'enforce organization filtering on parts';
    }
    if (lowerDiff.includes('label') || lowerDiff.includes('document')) {
      return type === 'fix'
        ? 'hydrate part label document data'
        : 'add part label document data';
    }
  }

  if (moduleName === 'auth') {
    if (lowerDiff.includes('refresh')) {
      return type === 'fix' ? 'correct refresh token handling' : 'add refresh token flow';
    }
    if (lowerDiff.includes('jwt')) {
      return type === 'fix' ? 'correct JWT authentication flow' : 'add JWT authentication flow';
    }
    if (lowerDiff.includes('login')) {
      return type === 'fix' ? 'correct login flow' : 'add login flow';
    }
  }

  if (moduleName === 'uploads') {
    if (lowerDiff.includes('mime')) {
      if (type === 'fix') {
        return 'validate upload MIME types';
      }
      if (type === 'refactor') {
        return 'reorganize upload MIME validation';
      }
      return 'add upload MIME validation';
    }
    if (lowerDiff.includes('limit') || lowerDiff.includes('size')) {
      if (type === 'fix') {
        return 'enforce upload file limits';
      }
      if (type === 'refactor') {
        return 'reorganize upload file limit handling';
      }
      return 'add upload file limits';
    }
  }

  if (moduleName === 'health') {
    if (lowerDiff.includes('readiness')) {
      return type === 'fix'
        ? 'handle readiness check database failure'
        : 'add readiness health check';
    }
    if (lowerDiff.includes('liveness')) {
      return type === 'fix' ? 'correct liveness health check' : 'add liveness health check';
    }
  }

  if (lowerDiff.includes('pagination')) {
    if (type === 'fix') {
      return 'normalize pagination query parameters';
    }
    if (type === 'refactor') {
      return `simplify ${domain} pagination`;
    }
    if (type === 'feat') {
      return `add ${domain} pagination`;
    }
    return `update ${domain} pagination`;
  }

  if (lowerDiff.includes('organization') || lowerDiff.includes('tenant')) {
    if (type === 'fix') {
      return `enforce organization filtering on ${domain}`;
    }
    if (type === 'refactor') {
      return `centralize organization filtering for ${domain}`;
    }
    if (type === 'feat') {
      return `add organization isolation for ${domain}`;
    }
    return `update organization isolation for ${domain}`;
  }

  if (type === 'perf') {
    return `${domain} queries`;
  }

  return null;
}

function inferTestSubject(filePath, moduleName, domain) {
  const baseName = path.posix.basename(filePath).toLowerCase();
  if (baseName.includes('access-policy')) {
    return 'add access policy unit tests';
  }
  if (moduleName) {
    return `add ${domain} tests`;
  }
  if (filePath.startsWith('test/') || filePath.startsWith('tests/')) {
    return 'add backend e2e tests';
  }
  return 'add backend unit tests';
}

function commonSubject(type, filePath, role) {
  const lowerPath = filePath.toLowerCase();

  if (lowerPath.includes('pagination')) {
    return type === 'fix'
      ? 'normalize pagination query parameters'
      : 'add pagination utilities';
  }

  if (lowerPath.includes('filter')) {
    return type === 'fix'
      ? 'correct HTTP exception filtering'
      : 'update HTTP exception filtering';
  }

  if (lowerPath.includes('guard') || role === 'guard') {
    return type === 'fix' ? 'correct authorization guard checks' : 'add authorization guard checks';
  }

  if (lowerPath.includes('decorator') || role === 'decorator') {
    return type === 'refactor' ? 'reorganize common decorators' : 'add common request decorators';
  }

  if (lowerPath.includes('access-policy')) {
    return type === 'fix'
      ? 'correct access policy enforcement'
      : type === 'refactor'
        ? 'centralize access policy rules'
        : 'implement access policy rules';
  }

  if (lowerPath.includes('utils')) {
    return type === 'fix' ? 'correct shared utility behavior' : 'add shared utility helpers';
  }

  return type === 'refactor' ? 'reorganize shared backend utilities' : 'add shared backend utilities';
}

function moduleSubject({ type, moduleName, domain, role, statusKind }) {
  if (role === 'controller') {
    if (type === 'feat') {
      return `add ${domain} endpoint`;
    }
    if (type === 'fix') {
      return `correct ${domain} route handling`;
    }
    return `reorganize ${domain} controller`;
  }

  if (role === 'service') {
    if (type === 'feat') {
      return `implement ${domain} service`;
    }
    if (type === 'fix') {
      return `correct ${domain} business logic`;
    }
    if (type === 'perf') {
      return `optimize ${domain} queries`;
    }
    return `simplify ${domain} service`;
  }

  if (role === 'dto') {
    if (type === 'feat') {
      return `add ${domain} input contract`;
    }
    if (type === 'fix') {
      return `correct ${domain} validation`;
    }
    return `reorganize ${domain} DTOs`;
  }

  if (role === 'guard' || role === 'strategy' || role === 'decorator') {
    if (type === 'fix') {
      return `correct ${domain} authorization checks`;
    }
    if (type === 'refactor') {
      return `reorganize ${domain} security rules`;
    }
    return `add ${domain} access rules`;
  }

  if (role === 'module') {
    return statusKind === 'added'
      ? `wire ${domain} module`
      : `update ${domain} module wiring`;
  }

  if (type === 'feat') {
    return `add ${domain} capability`;
  }

  if (type === 'fix') {
    return `correct ${domain} behavior`;
  }

  if (type === 'perf') {
    return `optimize ${domain} queries`;
  }

  return `simplify ${domain} implementation`;
}

function fallbackSubjectForPath(filePath, domain, role, type) {
  const fileName = path.posix.basename(filePath);
  const readableName = humanizeFileName(fileName);

  if (role && role !== 'file') {
    if (type === 'feat') {
      return `add ${domain} ${role}`;
    }
    if (type === 'fix') {
      return `correct ${domain} ${role}`;
    }
    if (type === 'refactor') {
      return `reorganize ${domain} ${role}`;
    }
  }

  if (type === 'feat') {
    return `add ${readableName}`;
  }

  if (type === 'fix') {
    return `correct ${readableName}`;
  }

  if (type === 'refactor') {
    return `reorganize ${readableName}`;
  }

  return `update ${readableName}`;
}

function fallbackTypeForPath(lowerPath) {
  if (lowerPath.includes('.spec.') || lowerPath.includes('.test.') || lowerPath.startsWith('test/')) {
    return 'test';
  }
  if (lowerPath.endsWith('.md') || lowerPath.startsWith('docs/')) {
    return 'docs';
  }
  if (lowerPath.startsWith('.github/')) {
    return 'ci';
  }
  if (lowerPath.includes('docker') || lowerPath.includes('staging')) {
    return 'build';
  }
  if (lowerPath.startsWith('src/')) {
    return 'refactor';
  }
  return 'chore';
}

function getModuleName(filePath) {
  const match = filePath.match(/^src\/modules\/([^/]+)\//);
  return match ? match[1] : '';
}

function getFileRole(filePath) {
  const baseName = path.posix.basename(filePath).toLowerCase();

  if (baseName.endsWith('.controller.ts')) {
    return 'controller';
  }
  if (baseName.endsWith('.service.ts')) {
    return 'service';
  }
  if (baseName.endsWith('.dto.ts')) {
    return 'dto';
  }
  if (baseName.endsWith('.guard.ts')) {
    return 'guard';
  }
  if (baseName.endsWith('.strategy.ts')) {
    return 'strategy';
  }
  if (baseName.endsWith('.decorator.ts')) {
    return 'decorator';
  }
  if (baseName.endsWith('.module.ts')) {
    return 'module';
  }
  return 'file';
}

function getStatusKind(item, headExistsAtStart) {
  if (item.type === 'rename') {
    return 'renamed';
  }
  if (item.status === '??' || item.status.includes('A') || !headExistsAtStart) {
    return 'added';
  }
  if (item.status.includes('D')) {
    return 'deleted';
  }
  return 'modified';
}

function isTestPath(lowerPath, fileName) {
  const lowerFileName = fileName.toLowerCase();
  return lowerPath.startsWith('test/')
    || lowerPath.startsWith('tests/')
    || lowerFileName.includes('.spec.')
    || lowerFileName.includes('.test.')
    || lowerFileName.includes('jest');
}

function isDocsPath(lowerPath, fileName) {
  const lowerFileName = fileName.toLowerCase();
  return lowerPath.startsWith('docs/')
    || lowerFileName === 'readme.md'
    || lowerFileName.endsWith('.md')
    || lowerFileName.endsWith('.mdx');
}

function isBuildPath(lowerPath, fileName) {
  const lowerFileName = fileName.toLowerCase();
  return lowerFileName === 'dockerfile'
    || lowerPath.includes('docker-compose')
    || lowerPath.startsWith('docker/')
    || lowerPath.includes('/docker/')
    || lowerPath.includes('staging')
    || lowerPath.includes('deploy');
}

function isConfigPath(lowerPath, fileName) {
  const lowerFileName = fileName.toLowerCase();
  return CONFIG_FILES.has(lowerPath)
    || CONFIG_FILES.has(lowerFileName)
    || isEnvExamplePath(lowerPath)
    || lowerFileName.endsWith('.config.js')
    || lowerFileName.endsWith('.config.ts')
    || lowerFileName.endsWith('.json')
    || lowerFileName.endsWith('.yaml')
    || lowerFileName.endsWith('.yml');
}

function isEnvExamplePath(lowerPath) {
  const lowerBaseName = path.posix.basename(lowerPath);
  return lowerBaseName === '.env.example' || lowerBaseName === '.env.staging.example';
}

function hasFixSignals(lowerDiff) {
  return /\b(fix|bug|correct|prevent|resolve|validate|validation|invalid|error|failure|mismatch|pagination|filter|organization|organisation|tenant|permission|role|password|login|refresh|jwt|relation|constraint|readiness|liveness|mime|limit|status code|current_process|currentprocess)\b/.test(lowerDiff);
}

function hasRefactorSignals(lowerDiff) {
  return /\b(refactor|simplify|reorganize|reorganise|extract|centralize|decouple|split|rename|move|cleanup)\b/.test(lowerDiff);
}

function hasPerformanceSignals(lowerDiff, lowerPath) {
  if (!lowerPath.endsWith('.service.ts') && !lowerPath.includes('dashboard')) {
    return false;
  }
  return /\b(perf|performance|optimize|optimise|aggregation|aggregate|groupby|group by|n\+1|distinct|select:|include:|skip:|take:)\b/.test(lowerDiff);
}

function hasEndpointSignals(lowerDiff) {
  return /@(get|post|patch|put|delete)\b/i.test(lowerDiff);
}

function ensureUniqueMessage(message, item, usedMessages) {
  const candidates = [
    message,
    withQualifier(message, qualifierFromPath(item.path)),
    withQualifier(message, humanizeFileName(path.posix.basename(item.path))),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!usedMessages.has(candidate) && !validateCommitMessage(candidate)) {
      usedMessages.add(candidate);
      return candidate;
    }
  }

  const [type, subject] = splitMessage(message);
  let suffix = qualifierFromPath(item.path) || humanizeFileName(path.posix.basename(item.path));
  suffix = suffix.replace(/\b(file|implementation)\b/g, '').trim();
  const fallback = normalizeMessage(`${type}: ${subject} for ${suffix}`);
  usedMessages.add(fallback);
  return fallback;
}

function withQualifier(message, qualifier) {
  if (!qualifier) {
    return null;
  }

  const [type, subject] = splitMessage(message);
  if (subject.includes(qualifier)) {
    return message;
  }
  return normalizeMessage(`${type}: ${subject} for ${qualifier}`);
}

function qualifierFromPath(filePath) {
  const moduleName = getModuleName(filePath);
  const role = getFileRole(filePath);

  if (moduleName && role !== 'file') {
    return `${DOMAIN_NAMES.get(moduleName) || humanizeToken(moduleName)} ${role}`;
  }
  if (moduleName) {
    return DOMAIN_NAMES.get(moduleName) || humanizeToken(moduleName);
  }
  if (filePath.startsWith('src/common/')) {
    return 'shared backend utility';
  }
  if (filePath.startsWith('prisma/')) {
    return 'Prisma schema';
  }
  return humanizeFileName(path.posix.basename(filePath));
}

function splitMessage(message) {
  const separatorIndex = message.indexOf(': ');
  return [message.slice(0, separatorIndex), message.slice(separatorIndex + 2)];
}

function normalizeMessage(message) {
  return message
    .replace(/\s+/g, ' ')
    .replace(/\s+\//g, '/')
    .replace(/\.$/, '')
    .trim();
}

function validateCommitMessage(message) {
  const trimmed = message.trim();
  const match = trimmed.match(/^([a-z]+):\s+(.+)$/);

  if (!match) {
    return 'message must start with a valid Conventional Commit prefix';
  }

  const [, type, subject] = match;
  if (!ALLOWED_TYPES.has(type)) {
    return `unsupported commit type: ${type}`;
  }

  if (/^[a-z]+\([^)]+\):/.test(trimmed)) {
    return 'scoped Conventional Commit messages are not allowed';
  }

  if (subject.trim().length < 5) {
    return 'message must include descriptive text after the prefix';
  }

  if (trimmed.length > 100) {
    return 'message must be 100 characters or shorter';
  }

  if (NON_ASCII.test(trimmed) || PORTUGUESE_WORDS.test(trimmed)) {
    return 'message must be clear English text';
  }

  if (GENERIC_SUBJECTS.has(subject.toLowerCase().trim())) {
    return 'message subject is too generic';
  }

  if (!/^[a-z]+: [A-Za-z0-9][A-Za-z0-9 .,'/_-]*$/.test(trimmed)) {
    return 'message contains unsupported characters';
  }

  return null;
}

async function promptForDecision(rl, generatedMessage) {
  let message = generatedMessage;

  while (true) {
    const answer = (await rl.question('  Action [c=commit, e=edit, s=skip, q=quit]: ')).trim().toLowerCase();

    if (answer === '' || answer === 'c' || answer === 'commit') {
      const validationError = validateCommitMessage(message);
      if (validationError) {
        console.log(`  Invalid message: ${validationError}`);
        continue;
      }
      return { action: 'commit', message };
    }

    if (answer === 'e' || answer === 'edit') {
      const edited = (await rl.question('  Commit message: ')).trim();
      const validationError = validateCommitMessage(edited);
      if (validationError) {
        console.log(`  Invalid message: ${validationError}`);
        continue;
      }
      message = edited;
      console.log(`  Message: ${message}`);
      continue;
    }

    if (answer === 's' || answer === 'skip') {
      return { action: 'skip' };
    }

    if (answer === 'q' || answer === 'quit') {
      return { action: 'quit' };
    }

    console.log('  Choose c, e, s, or q.');
  }
}

function clearStaging(repoRoot) {
  if (hasHead(repoRoot)) {
    git(repoRoot, ['reset', '--quiet', '--']);
    return;
  }

  git(repoRoot, ['rm', '-r', '--cached', '--quiet', '--ignore-unmatch', '--', '.'], { allowFailure: true });
}

function stageItem(repoRoot, item) {
  const paths = item.type === 'rename' ? item.paths : [item.path];
  git(repoRoot, ['add', '--', ...paths]);
}

function assertOnlyCurrentItemStaged(repoRoot, item) {
  const allowed = new Set(item.paths.map((filePath) => normalizePath(filePath)));
  const staged = getStagedFiles(repoRoot);
  const unexpected = staged.filter((filePath) => !allowed.has(filePath));

  if (unexpected.length > 0) {
    throw new Error(`unexpected staged files: ${unexpected.join(', ')}`);
  }
}

function getStagedFiles(repoRoot) {
  const result = git(repoRoot, ['diff', '--cached', '--name-only', '-z'], { allowFailure: true });
  return result.stdout
    .split('\0')
    .filter(Boolean)
    .map((filePath) => normalizePath(filePath));
}

function hasStagedChanges(repoRoot) {
  return git(repoRoot, ['diff', '--cached', '--quiet'], { allowFailure: true }).status === 1;
}

function printHeader(details) {
  console.log('Rastroom atomic commit automation');
  console.log(`Repository: ${details.repoName}`);
  console.log(`Repository root: ${details.repoRoot}`);
  console.log(`Current directory: ${details.currentDir}`);
  console.log(`HEAD exists: ${details.headExists ? 'yes' : 'no'}`);
  console.log(`Dry run: ${details.dryRun ? 'yes' : 'no'}`);
  console.log(`Detected status entries: ${details.detectedEntries}`);
  console.log(`Detected files after expansion: ${details.detectedFiles}`);
  console.log(`Files to process: ${details.processCount}`);
  console.log(`Files ignored: ${details.ignoredCount}`);
}

function printItem(item) {
  console.log(`\nFile: ${item.path}`);
  console.log(`  Git status: ${item.statusLabel}`);
  if (item.type === 'rename') {
    console.log(`  Rename: ${item.oldPath} -> ${item.path}`);
  }
  console.log(`  Message: ${item.message}`);
}

function printSummary(summary) {
  console.log('\nSummary:');
  console.log(`  Commits created: ${summary.committed}`);
  console.log(`  Dry-run items: ${summary.dryRun}`);
  console.log(`  Files ignored: ${summary.ignored}`);
  console.log(`  Files skipped: ${summary.skipped}`);
  console.log(`  Errors: ${summary.errors}`);
}

function isDirectory(absolutePath) {
  return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function humanizeToken(token) {
  return token
    .replace(/\.[^.]+$/, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function humanizeFileName(fileName) {
  return humanizeToken(fileName)
    .replace(/\bts\b/g, '')
    .replace(/\bjs\b/g, '')
    .replace(/\bjson\b/g, '')
    .replace(/\bsql\b/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'backend file';
}
