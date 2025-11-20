# Google Calendar Plugin Setup

For the Google Calendar plugin to work, you need a Google OAuth Client ID. This is a one-time setup that takes about 5 minutes.

## Finding Your Extension ID

Before you start, you'll need your Chrome extension ID. Here's how to find it:

1. **Open Chrome Extensions page:**
   - Type `chrome://extensions/` in the address bar and press Enter
   - Or: Menu (☰) → More Tools → Extensions

2. **Enable Developer mode:**
   - Toggle the **"Developer mode"** switch in the top-right corner (it should be blue/on)

3. **Find your extension:**
   - Look for **"Dashboard New Tab"** in the list of extensions

4. **Copy the Extension ID:**
   - The ID is displayed directly below the extension name and icon
   - It's a 32-character string like: `abcdefghijklmnopqrstuvwxyz123456`
   - You can also see it in the browser URL when you click "Details": 
     ```
     chrome://extensions/?id=abcdefghijklmnopqrstuvwxyz123456
     ```
   - Copy this entire ID (all 32 characters)

**Keep this ID handy** - you'll need it in Step 1 below!

## Quick Setup (5 minutes)

### Step 1: Create OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
   - Name it something like "Dashboard Extension"
   - Click **"Create"**
3. Once the project is created, select it from the project dropdown
4. Go to **"APIs & Services"** → **"Library"**
5. Search for **"Google Calendar API"** and click **"Enable"**
6. Go to **"APIs & Services"** → **"Credentials"**
7. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
8. If prompted, configure the OAuth consent screen:
   - User Type: **"External"** (unless you have a Google Workspace)
   - App name: **"Dashboard Extension"**
   - User support email: Your email
   - Developer contact: Your email
   - Click **"Save and Continue"** through the steps
9. Back to creating credentials:
   - Application type: **"Web application"** (NOT "Chrome App")
   - Name: **"Dashboard Extension"**
   - Authorized redirect URIs: Click **"+ ADD URI"** and add:
     ```
     https://YOUR_EXTENSION_ID.chromiumapp.org/
     ```
     
     **How to find your Extension ID:**
     
     1. Open Chrome and go to `chrome://extensions/`
     2. Make sure **"Developer mode"** is enabled (toggle in the top-right corner)
     3. Find your extension **"Dashboard New Tab"** in the list
     4. Look for the **"ID"** field below the extension name
       - It's a long string of 32 characters, like: `abcdefghijklmnopqrstuvwxyz123456`
       - You can also see it in the URL when you click "Details": `chrome://extensions/?id=abcdefghijklmnopqrstuvwxyz123456`
     5. Copy this ID and replace `YOUR_EXTENSION_ID` in the redirect URI above
     
     **Example:** If your extension ID is `abcdefghijklmnopqrstuvwxyz123456`, the redirect URI should be:
     ```
     https://abcdefghijklmnopqrstuvwxyz123456.chromiumapp.org/
     ```
     
     ⚠️ **Important:** Make sure to include the trailing slash `/` at the end!
10. Click **"Create"**
11. Copy the **Client ID** (looks like: `123456789-abc...apps.googleusercontent.com`)

### Step 2: Configure in Your Project

Create a `.env` file in the project root (or add to existing one):

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

Replace `your-client-id-here.apps.googleusercontent.com` with the Client ID you copied.

### Step 3: Rebuild

```bash
npm run build
```

Then reload the extension in Chrome.

## Alternative: Use a Shared Development Client ID

If you don't want to create your own, you can use a shared development Client ID (not recommended for production):

```bash
VITE_GOOGLE_CLIENT_ID=YOUR_SHARED_CLIENT_ID
```

**Note:** This is only for development. For production, create your own Client ID.

## Troubleshooting

### "Invalid oauth2 client ID"
- Make sure you created a **"Web application"** Client ID, not "Chrome App"
- Verify the redirect URI matches exactly: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
- Make sure the `.env` file is in the project root
- Rebuild after adding the Client ID

### "Redirect URI mismatch"
- Check that the redirect URI in Google Cloud Console matches exactly: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
- Make sure there's a trailing slash `/`

### Extension ID changes
- If you reload the extension, the ID might change
- Update the redirect URI in Google Cloud Console if needed
- Or create a new Client ID with the new extension ID

## Why is this needed?

Google requires OAuth Client IDs for security. Even for local development, you need to register your application with Google. This is a standard security practice and takes only a few minutes to set up.

