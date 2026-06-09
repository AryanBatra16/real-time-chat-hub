# Real-Time Chat Hub

A modern, high-performance real-time chat application with a sleek dark theme. This application supports multi-user group chat rooms and private direct messaging, powered by a Node.js + Socket.IO server and Supabase for authentication and message persistence.

## Features

- **Supabase Integration**: Secure user registration, logins, and real-time message database persistence.
- **Rich Message Actions**: Supports replies (tagging messages), forwarding, copying, editing, starring, and deleting messages.
- **Real-Time Delivery & Read Receipts**: Single check for sent, double check for delivered, and double blue check for read status.
- **Typing Indicators**: Interactive display for active room typers.
- **Responsive Layout**: Designed with a slide-in navigation sidebar for smaller devices.

## Running Locally

### Prerequisites
- Node.js (v18+)

### Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your Supabase connection parameters:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-api-key
   ```

3. **Start the Application**:
   ```bash
   npm run dev
   ```

4. **Access the Chat Client**:
   Open **[http://localhost:3000](http://localhost:3000)** in your browser.
