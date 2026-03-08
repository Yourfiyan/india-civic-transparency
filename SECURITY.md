# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public issue.** Instead, contact the maintainer directly:

- **Email:** yourfiyan@proton.me

### What to include

- A description of the vulnerability
- Steps to reproduce
- Potential impact

### Response time

You can expect an initial response within **48 hours**. Fixes for confirmed vulnerabilities will be prioritized.

## Security Considerations

### Data Sources
All datasets used are from **public, open-data sources** (Indian government portals, AWS Open Data, DataMeet). No personally identifiable information (PII) is collected or processed.

### API Security
- The backend Express API is intended for development and demo purposes
- For production deployment, add:
  - Rate limiting
  - CORS restrictions to specific origins
  - Input validation on all query parameters
  - Authentication for write operations

### Environment Variables
- Database credentials and API keys are loaded from `.env` files
- `.env` files are excluded from version control via `.gitignore`
- Use `backend/.env.example` as a template

### Database
- PostgreSQL with PostGIS — ensure the database is not exposed to public networks
- Use strong passwords and restrict access to trusted hosts
- Keep PostgreSQL and PostGIS updated

### Dependencies
- Run `npm audit` and `pip audit` periodically
- Keep all dependencies updated
