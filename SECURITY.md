# 🔐 Security Policy

Thank you for helping keep **InternPilot** secure.

InternPilot is an open-source internship management and recruitment portal. We take security issues seriously and encourage responsible reporting of vulnerabilities.

---

## 🛡️ Supported Versions

Security fixes are focused on the version of InternPilot currently under active development.

| Version | Supported |
| --- | --- |
| Current development version | ✅ Yes |
| Older versions | ⚠️ Limited |
| Unmaintained versions | ❌ No |

---

## 🚨 Reporting a Security Vulnerability

If you discover a security vulnerability in InternPilot, please **do not create a public GitHub Issue** containing sensitive security details.

Instead, report the issue privately to the project administrators/maintainers or the organizers of the GitHub Club under Technova Society, SSCSE, Sharda University.

When reporting a vulnerability, please provide as much relevant information as possible, including:

- A clear description of the vulnerability.
- The affected feature or component.
- Steps required to reproduce the issue.
- The potential impact, if known.
- Screenshots or logs where appropriate.
- Any suggested mitigation or fix, if available.

Please avoid including passwords, API keys, database credentials, personal information, or other sensitive data in the report.

---

## 🔎 Responsible Disclosure

We request that security researchers and contributors:

- Give maintainers reasonable time to investigate and address the issue.
- Avoid publicly disclosing the vulnerability before it has been reviewed.
- Do not access, modify, delete, or expose data that does not belong to you.
- Do not intentionally disrupt the application or its services.
- Do not use a security vulnerability to gain unauthorized access.

Security research should be performed responsibly and only within systems and environments where you have permission to test.

---

## 🔑 Sensitive Information

**Never commit sensitive credentials or secrets to this repository.**

This includes:

- Passwords
- MongoDB connection strings containing credentials
- API keys
- OAuth client secrets
- Gmail or SMTP credentials
- Session secrets
- Admin secrets
- `.env` files
- Private keys
- Tokens

Sensitive configuration should be stored using environment variables.

Example:

```env
MONGO_URI=your_database_connection
SESSION_SECRET=your_session_secret
ADMIN_SECRET=your_admin_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Use placeholder values in documentation and examples.

---

## 📦 Dependency Security

Contributors should keep project dependencies updated where practical.

Before submitting dependency-related changes:

- Check for known vulnerabilities.
- Avoid unnecessary dependencies.
- Use trusted and maintained packages.
- Review changes introduced by dependency updates.
- Test the application after updating dependencies.

---

## 🔐 Authentication & Authorization

InternPilot includes authentication and role-based access control.

Security-related changes involving:

- User authentication
- OTP verification
- Google OAuth
- Sessions
- Passwords
- Role-based access
- Admin access

should be carefully tested before being submitted as a Pull Request.

Do not bypass authentication or authorization controls while testing unless you have explicit permission to do so.

---

## 📧 Email & OTP Security

InternPilot uses email-based OTP verification.

Contributors working on OTP or email functionality should ensure that:

- OTPs are not exposed in URLs or public logs.
- Email credentials are never committed.
- OTP expiration is respected.
- Sensitive email information is handled carefully.
- Authentication flows cannot be bypassed through client-side manipulation.

---

## 🐛 Security Issues vs. Regular Issues

Use a **private security report** for vulnerabilities that could affect the security or privacy of the application.

Use a normal GitHub Issue for general:

- Bugs
- Feature requests
- Documentation improvements
- UI/UX improvements
- Performance improvements

If you are unsure whether something is a security vulnerability, contact the project maintainers privately before publicly reporting sensitive details.

---

## 🔄 Security Pull Requests

Security-related Pull Requests should:

- Reference the relevant issue or approved security report where appropriate.
- Clearly describe the security problem being addressed without exposing unnecessary sensitive details.
- Include testing information.
- Avoid introducing credentials or secrets.
- Follow the repository's contribution guidelines.

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before creating a Pull Request.

---

## 📜 Code of Conduct

All security reports and discussions must follow the project's **Code of Conduct**.

Please read:

[Code of Conduct](./CODE_OF_CONDUCT.md)

Security concerns should be communicated professionally and respectfully.

---

## 🏛️ Project Community

InternPilot is associated with the:

**GitHub Club**  
**under Technova Society**  
**SSCSE, Sharda University**

The project supports a learning-focused environment where students can:

**LEARN • BUILD • COLLABORATE • CONTRIBUTE**

---

<p align="center">
  <b>🔐 Build Securely • Report Responsibly • Contribute Safely</b>
</p>
