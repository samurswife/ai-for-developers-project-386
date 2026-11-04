module.exports = {
  extends: ['stylelint-config-standard'],
  rules: {
    'at-rule-no-unknown': [true, { ignoreAtRules: ['theme', 'apply', 'custom-variant'] }],
    'at-rule-prelude-no-invalid': [true, { ignoreAtRules: ['apply'] }],
    'import-notation': 'string',
    'lightness-notation': 'number',
    'hue-degree-notation': 'number',
  },
};
