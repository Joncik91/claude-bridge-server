# Contributing to Claude Bridge

Thank you for your interest in contributing! Below are guidelines to help you get started.

## How to Contribute

### Reporting Bugs

Please use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) when opening a bug issue. Include:

- A clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Your environment (OS, Node.js version)

### Suggesting Features

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) to propose new functionality. Describe the use case and why it would benefit others.

### Submitting Pull Requests

1. **Fork** the repository and create your branch from `main`.
2. **Install dependencies** and build the project:
   ```bash
   cd server
   npm ci
   npm run build
   ```
3. **Make your changes** in the `server/src/` directory.
4. **Verify the build** succeeds:
   ```bash
   npm run build
   ```
5. **Open a pull request** using the [PR template](.github/PULL_REQUEST_TEMPLATE.md) and fill in all sections.

## Development Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/claude-bridge-server.git
cd claude-bridge-server

# Install and build
cd server
npm ci
npm run build

# Watch mode for development
npm run dev
```

## Code Style

- The project is written in **TypeScript** (strict mode).
- Follow the existing patterns in `server/src/`.
- Keep changes focused and minimal.

## Commit Messages

Use short, descriptive commit messages in the imperative mood:

- `Add pagination to bridge_list_tasks`
- `Fix session context not persisting across restarts`
- `Update README with new setup instructions`

## Versioning

This project follows [Semantic Versioning](https://semver.org/). Update [CHANGELOG.md](CHANGELOG.md) for any user-facing change.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
