module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es6: true
  },
  extends: [
    'eslint:recommended'
  ],
  plugins: [],
  // add your custom rules here
  rules: {
    semi: ['warn', 'never'],
    camelcase: 'off',
    curly: 'off',
    'no-console': 'off',
    'arrow-parens': ['error', 'as-needed']
  }
}
