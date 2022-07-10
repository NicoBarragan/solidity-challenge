module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:node/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"] },
    ],
    "node/no-unpublished-import": [
      "error",
      {
        allowModules: [
          "chai",
          "hardhat",
          "@nomiclabs/hardhat-ethers",
          "ethers",
          "../typechain",
        ],
      },
    ],
    "node/no-unpublished-require": [
      "error",
      {
        allowModules: ["pino"],
      },
    ],
    "node/no-extraneous-import": [
      "error",
      {
        allowModules: ["@ethereum-waffle/chai"],
      },
    ],
    "node/no-missing-import": [
      "error",
      {
        allowModules: ["../typechain"],
      },
    ],
  },
};
