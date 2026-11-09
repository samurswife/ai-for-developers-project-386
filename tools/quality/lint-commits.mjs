import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    from: { type: 'string', default: '636ea6b71be9fba1cf60975e5fce66e42d69dc57' },
    to: { type: 'string', default: 'HEAD' },
  },
});

try {
  if (!values.from || !values.to)
    throw new Error('--from and --to must be non-empty Git revisions.');
  if (
    execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim() ===
    'true'
  ) {
    throw new Error('Commit history lint requires a full clone; fetch the complete history first.');
  }
  const commits = execFileSync(
    'git',
    ['log', '--no-merges', '--format=%H', '--end-of-options', `${values.from}..${values.to}`, '--'],
    { encoding: 'utf8' },
  ).trim();
  if (!commits) console.log('No non-merge commits in the selected range.');
  for (const commit of commits ? commits.split('\n') : []) {
    const message = execFileSync('git', ['show', '--no-patch', '--format=format:%B', commit, '--']);
    execFileSync(
      process.execPath,
      [
        fileURLToPath(import.meta.resolve('@commitlint/cli/cli.js')),
        '--config',
        fileURLToPath(new URL('../../commitlint.config.cjs', import.meta.url)),
      ],
      { input: message, stdio: ['pipe', 'inherit', 'inherit'] },
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = error.status || 1;
}
