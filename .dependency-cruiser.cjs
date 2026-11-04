module.exports = {
  forbidden: [
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'backend-does-not-import-frontend',
      severity: 'error',
      from: { path: '^apps/backend/' },
      to: { path: '^apps/frontend/' },
    },
    {
      name: 'frontend-does-not-import-backend',
      severity: 'error',
      from: { path: '^apps/frontend/' },
      to: { path: '^apps/backend/' },
    },
    {
      name: 'sdk-does-not-import-applications',
      severity: 'error',
      from: { path: '^packages/api-sdk/' },
      to: { path: '^apps/' },
    },
  ],
  options: {
    doNotFollow: { path: '(^|/)(node_modules|dist|generated)/' },
    exclude: { path: '(^|/)(node_modules|dist|generated)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/frontend/tsconfig.app.json' },
  },
};
