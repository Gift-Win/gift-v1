module.exports = {
  parserOptions: {
    ecmaFeatures: { },
    ecmaVersion: 11,
    sourceType: 'module'
  },
  plugins: [],
  extends: [
    'standard'
  ],
  env: {
    browser: true,
    es6: true,
    node: true,
    mocha: true
  },
  rules: { },
  globals: {
    ethers: true,
    artifacts: true,
    task: true,
    waffle: true
  },
  settings: { }
}
