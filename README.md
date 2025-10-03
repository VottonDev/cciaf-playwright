# CCIAF Playwright Tests

Automated end-to-end tests for the **CCIAF** (Commercial Continuous Improvement Assessment Framework) platform using [Playwright](https://playwright.dev/).

CCIAF is an internal platform developed by the Cabinet Office to assess commercial maturity across the public sector. Learn more at [GOV.UK CCIAF Guidance](https://www.gov.uk/government/publications/commercial-operating-standards-for-government/commercial-continuous-improvement-assessment-framework-onboarding-guidance-v23-html).

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- Access to the CCIAF Salesforce environment
- Salesforce credentials with 2FA enabled

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Authentication Setup

This project uses Playwright's [authentication state management](https://playwright.dev/docs/auth) to handle authentication for both Salesforce backend (with 2FA) and GovUK frontend. You authenticate once for each and the sessions are saved and reused across all tests.

### First Time Setup

1. Create a `.env` file in the project root:

```env
# Salesforce Backend Authentication
SALESFORCE_USERNAME=your-username@example.gov.uk
SALESFORCE_PASSWORD=your-password

# GovUK Frontend Authentication
GOVUK_EMAIL=your-email@example.com
GOVUK_PASSWORD=your-password
```

2. Run the authentication setup:

**For Salesforce Backend (with 2FA):**
```bash
npx playwright test auth.setup --headed
```

The browser will open, automatically enter your credentials, and wait for you to manually enter the 2FA verification code. After successful login, the session is saved to `playwright/.auth/salesforce.json`.

**For GovUK Frontend:**
```bash
npx playwright test frontendauth.setup --headed
```

The browser will open, automatically sign in with your credentials, and save the session to `playwright/.auth/govuk-frontend.json`.

**Or run both at once:**
```bash
npx playwright test --project=setup --headed
```

### Re-authenticating

If your session expires (you'll see login pages during tests), simply re-run the appropriate setup command above.

## Running Tests

### Run all tests
```bash
npx playwright test
```

### Run tests with visible browser
```bash
npx playwright test --headed
```

### Run a specific test
```bash
npx playwright test tests/bvcreatehistoryrecord.spec.ts
```

### Run tests in UI mode (interactive)
```bash
npx playwright test --ui
```

### View test report
```bash
npx playwright show-report
```

## Project Structure

```
├── tests/
│   ├── auth.setup.ts           # Salesforce backend authentication setup
│   ├── frontendauth.setup.ts   # GovUK frontend authentication setup
│   └── *.spec.ts              # Test files
├── playwright/.auth/           # Saved authentication state (gitignored)
│   ├── salesforce.json         # Salesforce session
│   └── govuk-frontend.json     # GovUK frontend session
├── playwright.config.ts        # Playwright configuration
└── .env                       # Environment variables (gitignored)
```

## Security Notes

- The `.env` file and `playwright/.auth/` directory are gitignored
- Never commit authentication files or credentials to version control
- The saved session file contains cookies that could be used to access your account

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Authentication Guide](https://playwright.dev/docs/auth)
