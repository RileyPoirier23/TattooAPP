# InkSpace - Tattoo Booth & Artist Discovery

InkSpace is a dual-platform application for the tattoo industry. The B2B side allows tattoo artists to find and book booths at shops, like an Airbnb for tattoo spaces. The B2C side enables clients to discover and book sessions with artists who are available in their city.

This guide provides step-by-step instructions to set up and run the project locally on a Windows 11 machine.

---

## Prerequisites

Before you begin, ensure you have the following software installed on your system. Your NVIDIA 3060 is excellent for development, but these software prerequisites are the most important part.

1.  **Node.js:** This project requires Node.js to run. It's recommended to use the latest LTS (Long-Term Support) version.
    *   **To Install:** Download the Windows Installer from the [official Node.js website](https://nodejs.org/). Run the installer and follow the on-screen prompts.
    *   **To Verify:** Open a Command Prompt or PowerShell terminal and run `node -v` and `npm -v`. You should see version numbers for both.

2.  **Git:** You'll need Git to clone the project repository.
    *   **To Install:** Download the installer from the [Git for Windows website](https://git-scm.com/download/win). Run the installer, using the default options is usually fine.
    *   **To Verify:** In a new terminal, run `git --version`.

3.  **A Code Editor:** A modern code editor is highly recommended for working with the project files.
    *   **Recommendation:** [Visual Studio Code](https://code.visualstudio.com/) is a free, popular choice that works great for web development.

---

## Setup Instructions

Follow these steps carefully to get the application running on your local machine.

### Step 1: Clone the Repository

First, you need to get the project code onto your computer.

1.  Open your terminal (Command Prompt, PowerShell, or the terminal inside VS Code).
2.  Navigate to the directory where you want to store the project (e.g., `cd C:\Users\YourUser\Documents\Projects`).
3.  Clone the repository using the following command:
    ```bash
    git clone https://github.com/your-username/inkspace.git
    ```
    *(Note: Replace `https://github.com/your-username/inkspace.git` with the actual URL of the project's repository.)*

4.  Navigate into the newly created project directory:
    ```bash
    cd inkspace
    ```

### Step 2: Install Project Dependencies

The project uses several libraries (like React) which need to be installed.

1.  In the project's root directory (the `inkspace` folder), run the following command:
    ```bash
    npm install
    ```
    This will read the `package.json` file and download all the required packages into a `node_modules` folder.

### Step 3: Configure Environment Variables (Crucial!)

The application requires API keys for Google services to function correctly. You will store these keys in a special file that is kept private and not shared.

1.  In the root of the `inkspace` project folder, create a new file and name it exactly `.env`.

2.  Open the `.env` file and copy the following content into it:

    ```
    # Google Gemini API Key for AI features
    API_KEY=YOUR_GEMINI_API_KEY_HERE

    # Google Maps API Key for interactive maps
    MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE
    ```

3.  **Obtain your API Keys:**
    *   **For `API_KEY` (Gemini):**
        *   Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
        *   Sign in with your Google account.
        *   Click the "**Create API key**" button.
        *   Copy the generated key and paste it into the `.env` file in place of `YOUR_GEMINI_API_KEY_HERE`.

    *   **For `MAPS_API_KEY` (Google Maps):**
        *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
        *   Create a new project (or select an existing one).
        *   In the navigation menu, go to **APIs & Services > Credentials**.
        *   Click **+ CREATE CREDENTIALS** and select **API key**.
        *   Copy the generated key and paste it into the `.env` file.
        *   **Important:** You must enable the "**Maps JavaScript API**" for this key to work. In the navigation menu, go to **APIs & Services > Library**, search for "Maps JavaScript API", and click **Enable**.
        *   As you are in Canada, there should be no regional restrictions, but it's always good practice to review the terms of service.

    **Your `.env` file is now set up. The application will automatically read these keys when it runs.**

### Step 4: Run the Development Server

You're all set! The final step is to start the local web server.

1.  In your terminal, from the root `inkspace` directory, run the following command:
    ```bash
    npm run dev
    ```
    *(Note: This command might be `npm start` depending on the project's configuration in `package.json`).*

2.  The terminal will output a local address, usually `http://localhost:5173`.

3.  Open your web browser (like Chrome or Firefox) and navigate to that address. You should now see the InkSpace application running live!

---

## Project Structure

A brief overview of the main folders:

-   `/components`: Contains all the React components, organized by views, shared elements, and modals.
-   `/data`: Holds the static seed data that acts as a mock database.
-   `/hooks`: Contains custom React hooks for managing application state and logic.
-   `/services`: Includes modules for interacting with external APIs (like Gemini) and handling business logic (like authentication).
-   `/public`: Static assets like images or icons can be placed here.
-   `index.html`: The main entry point for the web application.
-   `App.tsx`: The root React component where the main application structure is defined.
