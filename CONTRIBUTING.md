# 🤝 Contributing to InternPilot

Thank you for your interest in contributing to **InternPilot**!

InternPilot is an open-source project where contributors can collaborate, learn, and work on real-world features and improvements.

We follow an:

**Issue → Assignment → Development → Pull Request → Review → Merge**

workflow.

---

# 🚀 Contribution Workflow

All contributions should follow the workflow below:

```text
Issue Created
      ↓
Issue Reviewed by Admin
      ↓
Issue Assigned to Contributor
      ↓
Contributor Creates Branch
      ↓
Contributor Works on Issue
      ↓
Pull Request Created
      ↓
PR References Issue Number
      ↓
Admin/Maintainer Review
      ↓
Changes Requested / Approved
      ↓
PR Merged
```

---

# 📌 1. Choose an Issue

Before starting development, contributors should check the repository's **Issues** section.

Issues may include:

- 🐛 Bug fixes
- ✨ New features
- 🎨 UI/UX improvements
- 📚 Documentation
- ⚡ Performance improvements
- 🔐 Security improvements
- 🧹 Code cleanup
- 💡 Other project improvements

---

# 👤 2. Get the Issue Assigned

**Do not start working on an issue before it has been assigned to you.**

If you are interested in an issue:

1. Open the issue.
2. Read the issue description carefully.
3. Comment that you would like to work on it.
4. Wait for an admin/maintainer to assign the issue to you.
5. Start development only after the assignment.

### ⚠️ Important

Multiple contributors should not work on the same issue unless explicitly allowed by an admin/maintainer.

This helps prevent duplicate work and conflicting Pull Requests.

---

# 🌿 3. Create a Branch

After the issue has been assigned to you, create a separate branch.

Use a meaningful branch name related to the issue.

### Feature

```bash
git checkout -b feature/issue-123-login-improvement
```

### Bug Fix

```bash
git checkout -b fix/issue-123-login-error
```

### Documentation

```bash
git checkout -b docs/issue-123-update-readme
```

Replace `123` with your actual issue number.

---

# 💻 4. Make Your Changes

Work only on the functionality related to the assigned issue.

Please:

- Keep changes focused.
- Follow the existing project structure.
- Write clean and readable code.
- Avoid unnecessary changes to unrelated files.
- Test your changes before creating a Pull Request.
- Do not commit sensitive information.

---

# 🧪 5. Test Your Changes

Before submitting a Pull Request, make sure your changes work correctly.

Check for:

- Application errors.
- Broken functionality.
- Console errors.
- UI issues.
- Authentication problems.
- Database-related issues.
- Existing functionality being affected.

If applicable, include screenshots or testing details in your Pull Request.

---

# 📝 6. Commit Your Changes

Use clear and meaningful commit messages.

Example:

```bash
git add .
git commit -m "Fix: resolve issue with internship application"
```

You may also include the issue number:

```bash
git commit -m "Fix: resolve internship application issue #123"
```

Avoid unclear commit messages such as:

```text
update
changes
final
done
new code
```

---

# ⬆️ 7. Push Your Branch

Push your branch to your fork:

```bash
git push origin feature/issue-123-login-improvement
```

---

# 🔀 8. Create a Pull Request

After completing your work, create a Pull Request to the appropriate branch of the main repository.

Your Pull Request should clearly explain:

- What you changed.
- Why you made the change.
- How you tested it.
- The issue it addresses.

---

# 🔗 9. Issue Number is Mandatory

**Every Pull Request MUST include the issue number it addresses.**

This is required so that maintainers can easily track the relationship between an issue and its Pull Request.

For example, if you were assigned:

```text
Issue #123 - Improve Candidate Login
```

Your Pull Request description should contain:

```text
Closes #123
```

or:

```text
Fixes #123
```

or:

```text
Resolves #123
```

### ✅ Example Pull Request

```markdown
## Description

Improved the candidate login flow and handled invalid login credentials.

## Issue

Closes #123

## Changes Made

- Improved login validation
- Added error handling
- Updated login response messages
- Tested successful and failed login scenarios
```

Using `Closes #123`, `Fixes #123`, or `Resolves #123` also allows GitHub to automatically close the related issue when the Pull Request is merged.

---

# 🚫 Pull Requests Without an Issue Number

Pull Requests that do not reference a valid assigned issue may be:

- Asked to add the issue reference.
- Returned for modification.
- Closed if they do not follow the contribution workflow.

If you believe a change is necessary but there is no existing issue, create an issue first and wait for an admin/maintainer to review and assign it.

---

# 👀 10. Pull Request Review

Every Pull Request will be reviewed by the project administrators/maintainers.

During review, maintainers may:

- ✅ Approve the Pull Request.
- 💬 Request changes.
- ❌ Close the Pull Request.
- 🔄 Ask for additional testing or improvements.

Please respond respectfully to review comments and make the requested changes where appropriate.

If changes are requested, update your existing branch and push again:

```bash
git add .
git commit -m "Fix: address review feedback"
git push origin feature/issue-123-login-improvement
```

The Pull Request will automatically update.

---

# ❌ Do Not Create Multiple PRs for the Same Issue

Unless specifically requested by an administrator, do not create multiple Pull Requests for the same assigned issue.

If changes are requested on your Pull Request, continue working on the same branch and update the existing Pull Request.

---

# 🔐 Security

Never commit sensitive information such as:

- Passwords
- API keys
- Database credentials
- OAuth secrets
- Email credentials
- `.env` files
- Session secrets

Use environment variables for sensitive configuration.

---

# 📜 Code of Conduct

All contributors are expected to follow our **Code of Conduct**.

Please read:

[Code of Conduct](./CODE_OF_CONDUCT.md)

We expect all contributors to communicate respectfully and maintain a welcoming environment for everyone.

---

# 💡 Before You Contribute

Make sure you have:

- [ ] Selected an existing issue.
- [ ] Commented on the issue.
- [ ] Received assignment from an admin/maintainer.
- [ ] Created a separate branch.
- [ ] Worked only on the assigned issue.
- [ ] Tested your changes.
- [ ] Used a meaningful commit message.
- [ ] Pushed your branch.
- [ ] Created a Pull Request.
- [ ] Added the correct issue number to the Pull Request.
- [ ] Responded to review feedback if required.

---

# 🌱 Beginner Friendly

If you are new to Git and GitHub, don't worry!

The **START2CODE — Git, GitHub & Open Source Bootcamp** is designed to help beginners understand:

- Git
- GitHub
- Repositories
- Issues
- Branches
- Commits
- Pull Requests
- Code Reviews
- Open Source Contribution

You are encouraged to ask questions, learn from other contributors, and improve your skills through practical contribution.

---

# 🏛️ Community

This project is associated with the:

**GitHub Club**  
**under Technova Society**  
**SSCSE, Sharda University**

The goal is to provide students with an opportunity to:

**LEARN • BUILD • COLLABORATE • CONTRIBUTE**

---

<p align="center">
  <b>🚀 Happy Contributing!</b>
</p>

<p align="center">
  <b>LEARN • BUILD • CONTRIBUTE</b>
</p>
