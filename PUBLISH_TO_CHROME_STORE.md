# Publishing to Chrome Web Store

Publishing your extension to the Chrome Web Store will solve the authentication issues and eliminate the need for manual OAuth configuration.

## Benefits

✅ **Automatic token refresh** - No more frequent disconnections  
✅ **No OAuth setup required** - Chrome handles the Client ID automatically  
✅ **Better user experience** - Users can install directly from the store  
✅ **Automatic updates** - Users get updates automatically  

## Prerequisites

1. **Google Developer Account**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Sign in with your Google account
   - Pay the one-time $5 registration fee (if not already paid)

2. **Prepare your extension**
   - Make sure your extension is working locally
   - Test all features thoroughly
   - Prepare screenshots and promotional materials

## Step-by-Step Publishing Guide

### Step 1: Prepare Your Extension Package

1. **Build your extension:**
   ```bash
   npm run build
   ```

2. **Create a ZIP file:**
   - Go to the `dist` folder
   - Create a ZIP file containing all files in `dist`
   - **Important:** Zip the contents of `dist`, not the `dist` folder itself
   - Name it something like `dashboard-newtab-extension.zip`

3. **Verify the ZIP structure:**
   ```
   dashboard-newtab-extension.zip
   ├── manifest.json
   ├── index.html
   ├── icons/
   │   ├── icon16.png
   │   ├── icon48.png
   │   └── icon128.png
   └── assets/
       ├── main-XXXXX.js
       └── main-XXXXX.css
   ```

### Step 2: Create Store Listing

1. **Go to Chrome Web Store Developer Dashboard:**
   - Visit: https://chrome.google.com/webstore/devconsole
   - Click **"New Item"**

2. **Upload your ZIP file:**
   - Click **"Upload"** and select your ZIP file
   - Wait for upload and validation to complete

3. **Fill in Store Listing Information:**

   **App Details:**
   - **Name:** Dashboard New Tab (or your preferred name)
   - **Summary:** A customizable, widget-based dashboard extension for Chrome
   - **Description:** (See template below)
   - **Category:** Productivity
   - **Language:** English (and others if you want)

   **Graphics:**
   - **Icon:** Upload a 128x128 PNG icon (use your existing icon)
   - **Screenshots:** 
     - At least 1 screenshot (1280x800 or 640x400)
     - Take screenshots of your dashboard in action
     - Show different widgets and configurations
   - **Promotional images:** (Optional but recommended)
     - Small promotional tile: 440x280
     - Large promotional tile: 920x680
     - Marquee promotional tile: 1400x560

   **Privacy:**
   - **Single purpose:** Yes
   - **Permission justifications:** Explain why you need each permission:
     - `storage`: To save dashboard configuration and widget settings
     - `tabs`: To override the new tab page
     - `identity`: To authenticate with Google Calendar API (for Google Calendar widget)
     - `host_permissions`: To fetch data from external APIs (Firefly, YouTrack, Tasktrove, Meteo, Google Calendar)
   - **Privacy Policy URL:** (See "Privacy Policy Setup" section below)

### Step 3: Configure OAuth for Published Extension

Once published, Chrome will automatically assign an OAuth Client ID to your extension. You'll need to:

1. **Get your Extension ID:**
   - After publishing, your extension will have a permanent ID
   - Find it in the Chrome Web Store Developer Dashboard
   - Format: `abcdefghijklmnopqrstuvwxyz123456`

2. **Configure Google Calendar API:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create or select a project
   - Enable **Google Calendar API**
   - Go to **APIs & Services** → **Credentials**
   - Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
   - Application type: **"Chrome App"**
   - Application ID: Enter your Chrome extension ID
   - Click **"Create"**

3. **Update your code (optional):**
   - The code already supports both methods (published and local)
   - `getAuthToken` will work automatically for published extensions
   - No code changes needed!

### Step 4: Submit for Review

1. **Review your listing:**
   - Check all information is correct
   - Verify screenshots are clear
   - Test the extension one more time

2. **Submit:**
   - Click **"Submit for review"**
   - Review can take a few hours to several days
   - You'll receive an email when approved

3. **After approval:**
   - Your extension will be live on the Chrome Web Store
   - Users can install it directly
   - Updates can be published automatically

## Description Template

```
Dashboard New Tab transforms your browser's new tab page into a fully customizable dashboard. Create your perfect workspace with drag-and-drop widgets.

Features:
• Drag & Drop Layout - Arrange widgets freely on a responsive grid
• Resizable Widgets - Customize the size of each widget
• Dark Mode - Toggle between light and dark themes
• Multiple Widgets - Bookmarks, Google Calendar, Finance (Firefly), YouTrack, Tasktrove, Weather, and more
• Persistent Storage - All configurations are saved automatically
• Export/Import - Save and restore your dashboard configuration

Available Widgets:
• Bookmarks - Manage your bookmarks with custom icons
• Google Calendar - View your upcoming events
• Finance (Firefly) - Track your financial summary
• YouTrack - Display and manage issues
• Tasktrove - View your tasks
• Weather - Check current weather conditions

Perfect for productivity enthusiasts who want to customize their browser experience.
```

## Important Notes

⚠️ **Extension ID changes:** Once published, your extension ID is permanent. Don't delete and re-upload, or you'll get a new ID.

⚠️ **Updates:** When you update your extension:
   - Build a new version
   - Increment version in `manifest.json`
   - Upload new ZIP file
   - Chrome Web Store will review updates (usually faster than initial review)

⚠️ **OAuth Client ID:** After publishing, you can configure the OAuth Client ID in Google Cloud Console. The extension will use `getAuthToken` automatically, which handles token refresh.

## Troubleshooting

**"Invalid oauth2 client ID" after publishing:**
- Make sure you've configured the OAuth Client ID in Google Cloud Console with your published extension ID
- Wait a few minutes for changes to propagate

**Review rejected:**
- Check the rejection reason in the dashboard
- Common issues: unclear permissions, missing privacy policy, insufficient description
- Fix issues and resubmit

## Privacy Policy Setup

The Chrome Web Store requires a Privacy Policy URL. Here are your options:

### Option 1: GitHub Pages (Recommended - Free)

1. **Create a GitHub repository** (if you don't have one already)
2. **Add the Privacy Policy file:**
   - Create a file `PRIVACY_POLICY.md` in your repository
   - Or use the template provided in this project: `PRIVACY_POLICY.md`
   - Update the placeholders (email, GitHub URL, date)

3. **Enable GitHub Pages:**
   - Go to your repository Settings → Pages
   - Select source: "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click Save

4. **Your Privacy Policy URL will be:**
   ```
   https://[your-username].github.io/[repository-name]/PRIVACY_POLICY.html
   ```
   Or if you name it `privacy-policy.md`:
   ```
   https://[your-username].github.io/[repository-name]/privacy-policy.html
   ```

5. **Alternative: Use GitHub's raw content:**
   - You can also use the raw markdown file:
   ```
   https://raw.githubusercontent.com/[your-username]/[repository-name]/main/PRIVACY_POLICY.md
   ```
   - But GitHub Pages is better as it renders the markdown nicely

### Option 2: Your Own Website

If you have a website:
1. Create a page at `https://yourwebsite.com/privacy-policy`
2. Copy the content from `PRIVACY_POLICY.md`
3. Convert to HTML or use a markdown renderer
4. Use this URL in the Chrome Web Store

### Option 3: Privacy Policy Generators

You can use online generators, but make sure to:
- Customize it for your extension
- Mention that all data is stored locally
- Explain each permission
- Update the contact information

**Recommended generators:**
- [Privacy Policy Generator](https://www.privacypolicygenerator.info/)
- [FreePrivacyPolicy](https://www.freeprivacypolicy.com/)

### Important Notes

⚠️ **The Privacy Policy URL must be:**
- Publicly accessible (no login required)
- HTTPS (secure connection)
- Accessible from the Chrome Web Store review process

⚠️ **Before submitting:**
- Update all placeholders in the template
- Add your contact email
- Add your GitHub repository URL (if applicable)
- Set the "Last updated" date

## After Publishing

Once published, users can:
- Install directly from Chrome Web Store
- Get automatic updates
- Use Google Calendar without manual OAuth setup
- Enjoy automatic token refresh (no more disconnections!)

You can share your extension with:
- Direct link from Chrome Web Store
- Extension ID for direct installation
- Embed code for websites



