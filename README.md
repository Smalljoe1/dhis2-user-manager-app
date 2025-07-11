# DHIS2 User Manager App

A React-based application for managing user data in the DHIS2 system, allowing import/export of users via JSON or CSV files, with filtering, sorting, and batch processing capabilities.

- **Last Updated:** July 11, 2025, 03:25 PM WAT
- **License:** [MIT License](#license) (or specify your preferred license)

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

## Overview
The DHIS2 User Manager is a web application built with React that simplifies user management for DHIS2 instances. It supports importing users from local files, exporting users from the DHIS2 server with customizable filters, and performing batch operations with real-time activity logging. The application features a responsive UI with dark/light theme support and robust error handling.

## Features
- **Import Users:** Upload JSON or CSV files to import user data with validation.
- **Export Users:** Fetch users from DHIS2, filter by username or organization unit, and export as CSV or JSON.
- **Batch Processing:** Import users in configurable batch sizes with progress tracking.
- **Filtering & Sorting:** Filter exported users and sort columns interactively.
- **Theme Support:** Switch between dark and light modes.
- **Activity Log:** Real-time log of operations with success/error indicators.
- **Pagination:** Navigate through large user datasets efficiently.
- **Error Handling:** Robust retry mechanism for API calls and detailed error logging.

## Installation

### Prerequisites
- Node.js (v14.x or later)
- npm or yarn
- Git
- Access to a DHIS2 instance with API credentials

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/dhis2-user-manager.git
   cd dhis2-user-manager
   ```
2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
3. Create a `.env` file in the root directory and add your DHIS2 API configuration:
   ```
   REACT_APP_BASE_URL=https://your-dhis2-instance.org/dhis/api
   REACT_APP_API_TOKEN=your-api-token
   ```
   *Note: The `.env` file is gitignored to protect sensitive data.*

4. Start the development server:
   ```bash
   npm start
   # or
   yarn start
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## Usage
- **Import Tab:** Upload a JSON or CSV file containing user data. Use the sample files (`dhis2_users_template.csv` or `dhis2_users_sample.json`) as templates. Start the import process and monitor the activity log.
- **Export Tab:** Fetch users from the DHIS2 server, apply filters (username or organization unit), select columns to export, and download the results as CSV or JSON.
- **Theme Toggle:** Switch between dark and light modes via the header.
- **Help:** Access the help modal for usage tips.

## Configuration
- **API Configuration:** Update the `.env` file with your DHIS2 base URL and API token.
- **Batch Size:** Adjust the batch size for imports via the dropdown in the Import tab.
- **Columns:** Customize which columns to display/export using the checkbox options.

## Contributing
Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes and commit:
   ```bash
   git commit -m "Add your message here - 07/11/2025 03:25 PM WAT"
   ```
4. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a pull request with a clear description of your changes.

Please ensure your code follows the project’s style guidelines and includes appropriate tests.

## License
This project is licensed under the [MIT License](LICENSE). Feel free to use, modify, and distribute it as per the license terms.

---

### Notes
- **Customization:** Replace `your-username` and `dhis2-user-manager` with your actual GitHub username and repository name. Update the `REACT_APP_BASE_URL` and `REACT_APP_API_TOKEN` placeholders with your DHIS2 instance details.
- **License:** The MIT License is suggested, but you can change it or add a `LICENSE` file if needed.
- **Images:** If you have screenshots or a logo, add a section like `## Screenshots` with `![Alt Text](path-to-image.png)` to enhance the README.
- **Dependencies:** The README assumes React, axios, and other libraries are used based on the provided code. Adjust the prerequisites if your project uses different tools.

