/** @type {import('jest').Config} */
const config = {
  projects: [
    "<rootDir>/jest.browser.config.cjs",
    "<rootDir>/jest.node.config.cjs",
  ],
  passWithNoTests: true,
};

module.exports = config;
