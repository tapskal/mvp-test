# Remindly MVP 🚀

A lightweight, full-stack appointment reminder system designed for small businesses. Built during an airport layover to demonstrate rapid MVP development with AI.

## Features

- **Appointment Management**: Create and track client appointments with ease.
- **WhatsApp Automation**: One-click trigger to send reminders via n8n webhooks.
- **AI Video Generation**: Integrated with Google's Veo model to generate cinematic "Airport Coding" videos.
- **Full-Stack Architecture**: React frontend with an Express/SQLite backend.

## Database Options

Since this app is designed to be deployed to static hosting like **Netlify** or **GitHub Pages**, it supports two database modes:

1.  **LocalStorage (Default)**: Data is stored in your browser. It works instantly without any setup but is limited to your current device/browser.
2.  **GitHub Database (Recommended for Sync)**: Stores your data as a JSON file in your GitHub repository. This allows you to sync your appointments across different devices.

### How to enable GitHub Database:
1.  Go to **GitHub Settings > Developer Settings > Personal Access Tokens**.
2.  Generate a new token (classic) with the `repo` scope.
3.  In the Remindly app, open the **GitHub Database** settings.
4.  Enter your Token, Repository (e.g., `username/my-repo`), and click **Save**.

## Getting Started

### Prerequisites

- Node.js (v18+)
- A Google Gemini API Key (for video generation)
- An n8n instance (for WhatsApp automation)

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd remindly-mvp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   npm start
   ```

## n8n Workflow Setup

To enable WhatsApp reminders:

1. Create a new workflow in n8n.
2. Add a **Webhook** node (Method: POST).
3. Add a **WhatsApp** node (via Twilio or Meta API).
4. Map the incoming JSON data (`client_name`, `phone_number`, `appointment_date`, `appointment_time`) to your WhatsApp message template.
5. Copy the Webhook URL and paste it into the **Automation Settings** within the Remindly app.

## License

Apache-2.0
