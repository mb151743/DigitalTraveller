# Digital Traveller — Technician Workflow & Manufacturing Traveller Application

A Digital 'Manufacturing Traveller(En-GB)/Traveler(En-US)' used to improve workflow efficiency, automate and speed up processes, designed for Renishaw spectroscopy manufacturing workflows (**inVia**, **Virsa**, **inLux**, **Strada**).

---

## 🚀 Running on Your Work PC

### Option 1: Standalone Windows App (`.exe`) — No Node.js Required (Recommended for Network Test PCs)
You **do not** need Node.js or any developer tools installed on your test PC. 

#### Method A: Download directly from GitHub Actions (Latest Automated Build)
1. Go to your repository on GitHub: `https://github.com/mikeb747/digital-traveller`
2. Click on the **Actions** tab at the top.
3. In the left sidebar, click **Build Windows Standalone Executable**.
4. Click on the latest workflow run (or click **Run workflow** $\to$ **Run workflow** to generate a fresh one anytime).
5. Once complete (green checkmark), scroll down to the **Artifacts** section at the bottom of the page.
6. Click **`digital-traveller-windows`** to download the zip file.
7. Unzip the file on your test PC. You will find:
   - **`Digital Traveller <version>.exe`** (Installer)
   - **`Digital Traveller <version>-portable.exe`** (Portable single-file executable — run directly with zero installation)
8. Double-click the `.exe` to run! It runs completely self-contained and natively executes background WiRE Key requests with Windows domain authentication.

#### Method B: Releases (Tag-based)
Whenever a version tag (e.g. `v1.006`) is pushed, GitHub Actions automatically compiles the `.exe` and attaches both the setup installer and the portable executable under **Releases** on GitHub.

---

### Option 2: Browser PWA (Instant, No Installation Required)
Open your shared cloud deployment link in Chrome or Microsoft Edge:
- In the URL bar, click the **Install App** icon (or Menu $\to$ **Install Digital Traveller**).
- It will run in its own standalone, frameless desktop window with local storage persistence.


---

## 📊 Network Share & Excel (`.xlsx`) Integration

The application features a built-in **Excel Hub** (accessed via the top title bar button **`📊 Excel Hub`**):

### Features:
- **Direct Multi-Sheet Excel Export**: Generates `.xlsx` files with sheets for:
  - **Overview**: System model, S/N, Work Order, Customer, Job, and Part Number.
  - **Workflow Steps**: Full procedure names, statuses, assigned technician, timestamps, and notes.
  - **Measurements**: Recorded laser powers, tolerances, wavelength checks, and pass/fail statuses.
  - **Checklists**: Quality checklist verification items.
  - **Audit Log**: Complete chronological event history.
- **Bi-Directional Synchronization**: Load an existing or edited `.xlsx` file from your network share (`\\nas-prod\Renishaw\...` or mapped drive `Z:\...`) to automatically sync test results and step completions back into the digital traveller.
- **Desktop File System Privileges**: When compiled as an Electron executable, it can directly read and write files over your local network share without browser prompt dialogs.

## 🔬 Laser & Grating Calibration Files

In the **Calibration** stage, enter each laser wavelength and grating density combination, then open **Create Extra Data Files** to create one blank `.txt` file per combination. Files are saved under `My Documents\<serial number>\Extra Data` using names such as `532nm_2400.txt`. If any target file already exists, the app asks before replacing it. A traveller serial number is required.

### Digital Test Sheets

The **Create Test Sheets** step follows **Select Laser and Grating Combinations**. It copies the configured read-only master workbook from **Settings → Network Shares → Master Test Sheet** into the system folder created by **Create System Folders**, under `Internal data\Digital Test Sheets`. The master workbook is never edited.

- **inLux** creates one file named `<Serial Number>_inLux Test Sheet PT-70151.xlsm`.
- **Virsa** and **inVia** create one copy per selected combination. Each file is named `<Serial Number>_<Wavelength>nm_<Grating>_<Master Sheet File Name>`.
- For **inVia**, each copy is populated with Job Number (C3), Customer Name (E3), and Serial Number (H3).
- For **Virsa**, each copy is populated with Job Number (C2), Customer Name (E2), Part Number (G2), Serial Number (I2), Power Meter Serial Number (C5), and Power Meter Head Serial Number (E5). Missing values are requested before copying. The power meter serial numbers are configurable and saved in Settings for reuse.
- For **inLux**, the single copy is populated with Customer Name (C2), Job Number (C3), Serial Number (F3), Power Meter Serial Number (E10), and Power Meter Head Serial Number (G10). Missing values are requested before copying. Its meter serial numbers use the same saved Settings defaults.
- The step also copies the configured system-specific `Test Acceptance Record.xlsm` and `Minor Deviation Record.xlsm` master files from the **Master Test Acceptance & Minor Deviation Records** folder in Settings into the root of the system folder. The source folder may use the generic filenames or system-prefixed filenames. These copies are not edited during this step.

If any destination file already exists, the app asks before replacing it. This operation is available in the Windows desktop app.

### Network Save Location and Motor Scan

The **Update Network Save Location** step searches the configured **Test Data Copies** network root for an existing system folder matching the traveller's Part Number and Customer Name. A matching folder is renamed to `<Serial Number>_<Part Number>_<Customer Name>`; if none exists, the correctly named folder is created. The step displays and records the child folder names it finds. If multiple folders match, the operator must resolve the ambiguity before continuing.

The **Pre System Test** step provides motor entries for the operator to record each motor, its instruction, and its test result, then saves them in a timestamped text file in the resolved network system folder. Motor discovery is currently manual; automatic controller scanning is not configured.

The **Rayleigh Cut-off Filter Calibration**, **CCD Detector Cooling & Dark Count Test**, **Laser Beam Alignment & Safety Interlocks**, and **Grating Turret & Slit Alignment** workflow steps appear in the **Calibration** stage.

### WiRE Keys and System Details

The **Save WiRE Passwords** step follows **Record System Details** and contains the **Get WiRE Key** action. Saving a generated key stores it with the traveller instead of adding it to step notes. Use the System Details panel beside the technician selector to review the system information in a two-column table and enter or update WiRE Passwords 1–4. The table also summarizes recorded motor names, network child folders, selected laser/grating combinations, and created extra-data file names.

The Windows desktop app stores application settings (including network locations, output location, workflow templates, registered systems, and meter defaults) in `%APPDATA%\DigitalTraveller\config.json`, so those settings can be retained across software versions. Traveller records remain in browser storage.

---

## 🧹 Final PC Cleanup

The Windows desktop app includes a **PC Cleanup** tab for end-of-test-PC cleanup. **Uninstall WiRE** is at the top of the page. **Kill WiRE** force-closes the listed WiRE subsystem processes before uninstall; it excludes `WiREDiagnosticService` and `WiREDiagnosticViewer` and asks for confirmation first. Searches and changes are separate actions: review the discovered folders or registry keys, select the targets, and confirm before deleting. Folder and registry deletion is permanent.

**Archive System Results** searches the current user’s Documents folder for system-result folders named `<Serial Number>_<Customer Name>`. Select the folders to move them into `Documents\Archive`; existing folders with the same name in Archive are not overwritten.

The WiRE folder search checks the listed Renishaw `wdfshell`, `WiRE*`, and per-user AppData locations. Registry search is limited to the specified WiRE keys under `HKCU\Software\Renishaw` / `HKCU\Software\Renishaw plc` and the `HKLM\SOFTWARE\WOW6432Node\Renishaw` key on 64-bit Windows (or `HKLM\SOFTWARE\Renishaw` on 32-bit Windows). WiRE uninstall is launched from its registered Windows uninstall entry.

Toolbar restore requires a discovered `WiREInterface.exe` registry key and a WiRE installation folder found by the folder search. The app updates the version-specific procedure-file paths in the supplied toolbar data. If `Custom toolbar\0` already has a `data` value, choose to add the value to slot 1, overwrite slot 0, or cancel.

---

## 🐛 Known Issues & Bug Tracker

| ID | Module | Issue | Status | Details |
|---|---|---|---|---|
| **BUG-001** | `WiRE Key Generator` | **Offline algorithm generates mismatched key** | **Logged / Pending Future Fix** | The client-side offline deterministic hash generator produces a key format that does not match the internal Renishaw proprietary encryption/hash used on `https://spd-apps/FeaturePermissions/generate`. Leave code intact as placeholder for when algorithm specs are provided. |
| **NOTE-001** | `WiRE Key / spd-apps` | **Initial POST redirects to dashboard (Session init)** | **By Design (IIS Windows Auth)** | `https://spd-apps` uses Windows Integrated Authentication (NTLM/Kerberos). On first contact, the server establishes the authenticated session cookie via `/dashboard`. On the second click, the session cookie is transmitted and the key is displayed immediately. |
| **NOTE-002** | `WiRE Key / spd-apps` | **HTTP 401.2 Unauthorized in InPrivate/Incognito mode** | **By Design (IIS Windows Auth)** | HTTP 401.2 indicates IIS Windows Integrated Authentication is rejected because InPrivate/Incognito browsing mode prevents automatic pass-through of your Windows domain login credentials (`RENA\...`). Regular browser mode is required to pass domain credentials to internal intranet servers. |
