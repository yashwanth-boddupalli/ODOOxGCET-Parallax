# Git Workflow

This document defines the branching strategy and collaboration rules for the StockSense project.

---

## Branching Model

```
main  (stable, deployable)
  │
  ├── feature/frontend-dashboard
  ├── feature/backend-api
  ├── feature/database-schema
  └── feature/...
```

`main` is the **single source of truth**. All development happens on **feature branches** that branch off from `main` and merge back via **Pull Requests**.

---

## Rules

| #  | Rule                                                                                      |
| -- | ----------------------------------------------------------------------------------------- |
| 1  | `main` must always remain stable and buildable.                                           |
| 2  | Create feature branches from `main` for all new work.                                     |
| 3  | Never push unfinished or broken work directly to `main`.                                  |
| 4  | Make commits logical, focused, and descriptive.                                           |
| 5  | Use **Pull Requests** to merge completed features into `main`.                            |
| 6  | Before opening a PR, pull the latest `main` and rebase/merge to resolve conflicts.        |
| 7  | Build and test the project locally before requesting a review.                             |
| 8  | **Never commit secrets** (`.env`, API keys, passwords). Use `.env.example` for templates. |
| 9  | Avoid modifying files that belong to another developer's active feature branch.            |
| 10 | Keep commits focused — one logical change per commit.                                     |

---

## Workflow — Step by Step

### 1. Start from the latest `main`

```bash
git checkout main
git pull origin main
```

### 2. Create a feature branch

Use a descriptive name prefixed with `feature/`:

```bash
git checkout -b feature/frontend-dashboard
```

### 3. Do your work and commit

```bash
git add .
git commit -m "Build inventory dashboard"
```

Commit often with clear messages. Each commit should represent one logical change.

### 4. Stay up to date with `main`

Before pushing, synchronize with the latest `main`:

```bash
git checkout main
git pull origin main
git checkout feature/frontend-dashboard
git rebase main
```

Resolve any conflicts if they arise.

### 5. Push your feature branch

```bash
git push -u origin feature/frontend-dashboard
```

### 6. Open a Pull Request

1. Go to the repository on GitHub.
2. Open a **Pull Request** from your feature branch into `main`.
3. Add a clear title and description of what the PR contains.
4. Request a review from a teammate.

### 7. Merge after approval

Once the PR is reviewed and approved, merge it into `main` on GitHub. Delete the feature branch after merging to keep the repo clean.

---

## Branch Naming Conventions

| Pattern                        | Example                           |
| ------------------------------ | --------------------------------- |
| `feature/<module>-<detail>`    | `feature/frontend-dashboard`      |
| `fix/<module>-<detail>`        | `fix/backend-auth-token`          |
| `docs/<topic>`                 | `docs/api-reference`              |

---

## Commit Message Guidelines

Write commit messages in the imperative mood:

```
feat: add product listing page
fix: correct stock calculation logic
docs: update README with setup instructions
chore: configure ESLint rules
```

Keep the subject line under 72 characters. Add a body for complex changes.
