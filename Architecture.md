# FixMate — Architecture

## Overview

FixMate is an AI-powered civic issue reporting platform designed to improve transparency and accountability across Pune.

## System Architecture

1. Frontend: HTML, CSS, and minimal JavaScript for reporting and tracking complaints.
2. Backend: Python and Django to handle authentication, complaints, verification, and rankings.
3. Database: PostgreSQL to store users, reports, departments, repair evidence, and complaint statuses.
4. AI Integration: Google Gemini API to analyze photos, estimate damage severity, suggest repairs, identify departments, and detect potential duplicates.

## Complaint Workflow

1. Citizens submit a photo, description, and locality.
2. Gemini analyzes the report and suggests a category and department.
3. Django processes the report and stores it in PostgreSQL.
4. Officials submit repair evidence for assigned complaints.
5. Gemini assists with evidence review, and the reporting citizen confirms the repair.
6. Monthly leaderboards rank performance using resolution rates, timeliness, issue importance, damage severity, and overdue complaints.

## Key Principles

- Manual reporting remains available if Gemini fails.
- AI suggestions can be corrected by citizens.
- Officials cannot independently mark complaints as completed.
- AI results are estimates, not professional engineering assessments.
- API keys remain private in environment variables.
