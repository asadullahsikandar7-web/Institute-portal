# Class Attendance Management System

## Quick Start

### Installation
npm install

### Run Development Server
npm run dev

Open http://localhost:5173 in your browser.

### Run Email Server (Optional)
To enable real email notifications:

1. Edit server.js and add your email credentials
2. Run: npm run server

## Features

- Add and manage students
- Mark daily attendance
- Automatic email notifications for absences
- Date-wise attendance tracking
- Real-time statistics
- Data persistence
- Export attendance data

## Email Setup

To send real emails, configure server.js with your email provider.

Gmail Setup:
1. Enable 2-factor authentication
2. Generate an App Password
3. Use that password in server.js

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Node.js + Express
- Nodemailer

Enjoy!