import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const cli = fileURLToPath(new URL('./lint-commits.mjs', import.meta.url));
const repository = fileURLToPath(new URL('../../', import.meta.url));
const historicalMerge = '18c10411923556d2f236b1802876deb85665807e';
const longBody =
  'This integration metadata line is deliberately longer than the one hundred character limit for ordinary commit messages.';
// Git hooks export repository settings that override cwd. Keep them out of every fixture child.
const fixtureEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: devNull,
};

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'calendar-commitlint-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, { cwd, env: fixtureEnv, encoding: 'utf8' }).trim();
  const template = join(cwd, 'template');
  const hooks = join(cwd, 'hooks');
  mkdirSync(template);
  mkdirSync(hooks);
  git('init', '--quiet', '--initial-branch=main', `--template=${template}`);
  assert.equal(
    realpathSync(git('rev-parse', '--absolute-git-dir')),
    realpathSync(join(cwd, '.git')),
  );
  assert.equal(realpathSync(git('rev-parse', '--show-toplevel')), realpathSync(cwd));
  git('config', 'core.hooksPath', hooks);
  git('config', 'user.name', 'Commitlint fixture');
  git('config', 'user.email', 'commitlint@example.test');
  const commit = (message) => git('commit', '--quiet', '--allow-empty', '-m', message);
  commit('chore: initialize fixture');
  const base = git('rev-parse', 'HEAD');
  const lint = (...args) =>
    spawnSync(process.execPath, [cli, '--from', base, ...args], {
      cwd,
      env: fixtureEnv,
      encoding: 'utf8',
    });
  const merge = (message) => {
    git('checkout', '--quiet', '-b', 'feature');
    commit('feat: add feature (#14)');
    git('checkout', '--quiet', 'main');
    commit('fix: prepare integration (#14)');
    git('merge', '--quiet', '--no-ff', 'feature', '-m', message);
    assert.equal(git('rev-list', '--parents', '-1', 'HEAD').split(' ').length, 3);
  };
  return { cwd, git, commit, base, lint, merge };
}

test('history lint accepts valid implementation commits and merge messages', (t) => {
  const { merge, lint } = fixture(t);
  merge('feat: integrate feature (#14)\n\nKeep this merge description within the line limit.');
  const result = lint();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('history lint rejects a long body on another merge commit', (t) => {
  const { merge, lint } = fixture(t);
  merge(`feat: integrate feature (#14)\n\n${longBody}`);
  const result = lint();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /body-max-line-length/);
});

test('history lint rejects a default Git merge header instead of silently ignoring it', (t) => {
  const { merge, lint } = fixture(t);
  merge("Merge branch 'feature'");
  const result = lint();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /type-empty/);
});

test('history lint exempts only the published historical merge SHA', () => {
  const result = spawnSync(
    process.execPath,
    [cli, '--from', `${historicalMerge}^1`, '--to', historicalMerge],
    { cwd: repository, env: fixtureEnv, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, new RegExp(`Skipping historical exception ${historicalMerge}`));
});

test('history lint rejects the historical message copied into a different merge commit', (t) => {
  const { merge, git, lint } = fixture(t);
  const message = execFileSync('git', ['show', '--no-patch', '--format=%B', historicalMerge], {
    cwd: repository,
    env: fixtureEnv,
    encoding: 'utf8',
  });
  merge(message);
  assert.notEqual(git('rev-parse', 'HEAD'), historicalMerge);
  const result = lint();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /body-max-line-length/);
});

test('history lint rejects an invalid header on a single-parent implementation commit', (t) => {
  const { commit, lint } = fixture(t);
  commit('implement feature (#14)');
  const result = lint();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /type-empty/);
});

test('history lint rejects a long body on a single-parent implementation commit', (t) => {
  const { commit, lint } = fixture(t);
  commit(`feat: add feature (#14)\n\n${longBody}`);
  const result = lint();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /body-max-line-length/);
});

test('history lint accepts an empty range', (t) => {
  const { base, lint } = fixture(t);
  const result = lint('--to', base);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /No commits/);
});

test('history lint rejects missing revisions', (t) => {
  const { lint } = fixture(t);
  for (const option of ['--from', '--to']) {
    const result = lint(option, 'missing-revision');
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /bad revision/);
  }
});

test('history lint rejects invalid CLI arguments', (t) => {
  const { lint } = fixture(t);
  for (const args of [['--unknown'], ['--from'], ['--from', '']]) {
    const result = lint(...args);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
  }
});

test('history lint rejects shallow clones even for an empty range', (t) => {
  const { cwd, git } = fixture(t);
  const shallow = join(cwd, 'shallow');
  git('clone', '--quiet', '--depth=1', pathToFileURL(cwd).href, shallow);
  const result = spawnSync(process.execPath, [cli, '--from', 'HEAD', '--to', 'HEAD'], {
    cwd: shallow,
    env: fixtureEnv,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /requires a full clone/);
});

test('history lint rejects invocation outside a Git repository', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'calendar-no-git-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [cli], { cwd, env: fixtureEnv, encoding: 'utf8' });
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /not a git repository/);
});

test('fixtures ignore inherited Git settings without modifying another repository', (t) => {
  const { cwd, git } = fixture(t);
  const snapshot = () => ({
    head: git('rev-parse', 'HEAD'),
    refs: git('show-ref'),
    config: readFileSync(join(cwd, '.git/config')),
    index: readFileSync(join(cwd, '.git/index')),
    status: git('status', '--porcelain'),
  });
  const before = snapshot();
  // A nested runner otherwise skips its files when it inherits node:test's worker context.
  const runnerEnv = { ...fixtureEnv };
  delete runnerEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(
    process.execPath,
    [
      '--test',
      '--test-reporter=tap',
      '--test-name-pattern=^history lint accepts valid implementation commits',
      fileURLToPath(import.meta.url),
    ],
    {
      cwd,
      env: {
        ...runnerEnv,
        GIT_DIR: join(cwd, '.git'),
        GIT_COMMON_DIR: join(cwd, '.git'),
        GIT_WORK_TREE: cwd,
        GIT_INDEX_FILE: join(cwd, '.git/index'),
        GIT_CONFIG: join(cwd, '.git/config'),
        GIT_CONFIG_PARAMETERS: "'user.name'='Inherited identity'",
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'user.email',
        GIT_CONFIG_VALUE_0: 'inherited@example.test',
      },
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /history lint accepts valid implementation commits/);
  assert.match(result.stdout, /^# pass 1$/m);
  assert.deepEqual(snapshot(), before);
});
