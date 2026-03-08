# Contributing to India Civic Transparency Platform

Thanks for your interest in contributing to civic transparency!

## Getting Started

1. **Fork** this repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/<your-username>/india-civic-transparency.git
   cd india-civic-transparency
   ```
3. **Set up the environment:**
   ```bash
   make setup       # Install all dependencies
   make db-up       # Start PostgreSQL via Docker
   make db-schema   # Apply database schema
   make seed        # Load seed data
   make dev         # Start backend + frontend
   ```
4. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make changes**, test, and commit
6. **Open a Pull Request** against `main`

## Project Structure

- `frontend/` — React + Leaflet + Tailwind CSS
- `backend/` — Express API server
- `data_pipeline/` — Python ETL scripts (DuckDB, geopandas)
- `seed_data/` — Demo datasets
- `scripts/` — Developer automation

## Development Guidelines

- Follow existing code style and patterns
- Test both frontend and backend changes
- Update documentation if your change affects usage or architecture
- Do not commit `.env` files or credentials
- Run `npm audit` before submitting PRs

## Areas for Contribution

- Additional data layers (education, healthcare, election data)
- Improved data visualizations and charts
- Performance optimization for large datasets
- Accessibility improvements
- Mobile responsiveness
- Test coverage
- Documentation and tutorials

## Bug Reports

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser, Node.js version, and OS
