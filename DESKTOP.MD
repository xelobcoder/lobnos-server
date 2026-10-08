Absolutely. Here is the corrected, complete prompt using **Prime Laboratory System (PLS)** throughout, with the existing `lobnos` and `lobnos-server` repositories clearly identified as the frontend and backend.

# Prime Laboratory System (PLS)

## Electron Desktop Application, Packaging & Web Compatibility Implementation Specification

### Project Name

**Prime Laboratory System (PLS)**

### Existing Projects

The PLS system currently consists of two main projects:

* **`lobnos`** — PLS frontend
* **`lobnos-server`** — PLS backend

The objective is to package both into a single, professionally distributable **Electron desktop application**, while preserving the existing web deployment capability.

---

# 1. PRIMARY OBJECTIVE

Transform **Prime Laboratory System (PLS)** into a desktop-installable application using **Electron**.

The final desktop application must allow a user to:

> **Download → Install → Launch → Use PLS**

without manually installing Node.js, npm, pnpm, Next.js, or any development dependencies.

However, this implementation **must not replace or redesign the existing PLS web architecture**.

PLS must continue to be a normal web application capable of being deployed to an **Ubuntu/Linux server** and accessed through a browser.

The Electron version should therefore be treated as an **additional deployment target** for PLS.

---

# 2. CRITICAL REQUIREMENT — KEEP NEXT.JS SSR

The most important architectural requirement is:

> **The PLS frontend MUST remain a server-side-rendered Next.js application.**

Do not convert the application to:

* Static HTML
* `next export`
* Static hosting
* Client-only React
* SPA-only architecture
* A purely Electron-rendered frontend
* A bundled collection of static HTML files

The existing Next.js SSR architecture must remain intact.

The Electron application should simply run the PLS Next.js server locally and display it inside an Electron window.

Conceptually:

```text
Electron
   │
   ├── PLS Next.js SSR Frontend
   │
   └── PLS Node.js/Express Backend
```

Electron should therefore act as the **desktop shell and process manager**, not as a replacement for Next.js.

---

# 3. EXISTING PLS ARCHITECTURE

The existing architecture is:

```text
                  PRIME LABORATORY SYSTEM
                           PLS
                            │
             ┌──────────────┴──────────────┐
             │                             │
          Frontend                       Backend
          `lobnos`                  `lobnos-server`
             │                             │
          Next.js                     Node.js
          React                        Express
          SSR                          MySQL
          App Router                  Knex
             │                             │
             └──────────────┬──────────────┘
                            │
                         Database
```

This architecture must remain valid.

---

# 4. EXISTING FRONTEND — `lobnos`

The `lobnos` project is the PLS frontend.

It uses:

* Next.js
* React
* Next.js App Router
* Server-Side Rendering
* Node.js
* Existing PLS frontend functionality
* Existing authentication and application workflows

The Electron implementation must continue running this application as a **production Next.js server**.

The frontend should continue to use the same application architecture regardless of whether it is running:

### On the web

```text
Browser
   ↓
Nginx
   ↓
Next.js SSR
```

or:

### Inside Electron

```text
Electron
   ↓
Local Next.js SSR Server
```

---

# 5. EXISTING BACKEND — `lobnos-server`

The `lobnos-server` project is the PLS backend.

It uses:

* Node.js
* Express
* MySQL
* Knex
* REST APIs
* Existing PLS business logic
* Existing authentication
* Existing database architecture

Electron must be able to start this backend automatically when PLS Desktop launches.

The backend must remain independently deployable.

It must still be possible to run:

```text
lobnos-server
```

on an Ubuntu/Linux server without Electron.

---

# 6. ELECTRON'S ROLE

Electron should provide the **desktop runtime and distribution layer**.

Electron should be responsible for:

1. Starting the PLS backend.
2. Starting the PLS Next.js SSR frontend.
3. Managing the application lifecycle.
4. Waiting for the servers to become ready.
5. Opening the PLS application window.
6. Loading the local PLS URL.
7. Handling application shutdown.
8. Managing packaged resources.
9. Providing the desktop installer.
10. Supporting future automatic updates.

Electron should **not** contain a separate implementation of the PLS frontend.

There should not be a second desktop-specific React application unless absolutely necessary for native functionality.

The primary PLS interface should remain the existing Next.js application.

---

# 7. TARGET USER EXPERIENCE

The final PLS desktop experience should be similar to installing any normal commercial desktop application.

The user should be able to:

```text
Download PLS Installer
        ↓
Double-click installer
        ↓
Install PLS
        ↓
Launch PLS
        ↓
PLS starts automatically
        ↓
Login screen appears
        ↓
Use PLS
```

The user should not need to:

* Install Node.js
* Install npm
* Install pnpm
* Install Next.js
* Install Express
* Open Command Prompt
* Open PowerShell
* Run terminal commands
* Configure environment variables manually
* Start the backend manually
* Start the frontend manually

The application should handle these operations internally.

---

# 8. ONE-CLICK INSTALLATION

The desktop distribution should produce a normal installer.

For Windows, the preferred experience is something similar to:

```text
PLS Setup.exe
```

The user downloads the installer and runs it.

The installer should:

* Install PLS
* Create the required application directories
* Install bundled application files
* Register the application
* Create shortcuts where appropriate
* Allow PLS to be launched normally
* Not require a separate Node.js installation

The final user experience should be:

> **Install once and run PLS like any other desktop application.**

---

# 9. BUNDLE NODE.JS RUNTIME

The customer must not be required to install Node.js.

The packaged PLS application must contain or provide the required Node.js runtime necessary to run:

```text
Next.js
+
lobnos-server
```

The application should therefore be self-contained from the customer's perspective.

Conceptually:

```text
PLS Desktop
│
├── Electron
│
├── Node.js Runtime
│
├── PLS Frontend
│   └── Next.js SSR
│
├── PLS Backend
│   └── Node.js/Express
│
├── Configuration
│
└── Required Runtime Dependencies
```

---

# 10. PRODUCTION NEXT.JS EXECUTION

The PLS frontend must be built and executed as a production Next.js application.

During packaging, the appropriate production build process should be performed.

Conceptually:

```bash
npm run build
```

or the equivalent existing PLS production build command.

The resulting production application should then be started using the appropriate Next.js production server mechanism.

For example:

```bash
next start
```

or the project's equivalent production startup command.

The exact implementation should follow the existing PLS Next.js configuration.

Do not use:

```text
next dev
```

for the distributed production application.

---

# 11. DO NOT STATICALLY EXPORT PLS

Do not use:

```bash
next export
```

or any equivalent static export mechanism.

The application depends on server-side functionality and must continue to run through a Node.js-based Next.js server.

The Electron application should therefore load something conceptually similar to:

```text
http://127.0.0.1:<PLS-FRONTEND-PORT>
```

where the response is generated by the local Next.js server.

---

# 12. LOCAL APPLICATION ARCHITECTURE

When PLS Desktop starts, the architecture should be:

```text
                    PLS DESKTOP
                        │
                     Electron
                        │
             ┌──────────┴──────────┐
             │                     │
       Next.js SSR            PLS Backend
       `lobnos`             `lobnos-server`
             │                     │
             │                     │
             └──────────┬──────────┘
                        │
                      MySQL
```

The Electron window should load the local Next.js server.

For example:

```text
Electron
   ↓
http://127.0.0.1:<frontend-port>
   ↓
Next.js SSR
   ↓
PLS Frontend
   ↓
PLS API
   ↓
http://127.0.0.1:<backend-port>
   ↓
lobnos-server
   ↓
MySQL
```

---

# 13. STARTUP SEQUENCE

PLS Desktop should have a controlled startup process.

### Step 1 — Electron starts

Electron launches as the primary desktop process.

### Step 2 — Load configuration

Electron determines the required runtime configuration.

### Step 3 — Start backend

Electron starts:

```text
lobnos-server
```

### Step 4 — Wait for backend

Electron verifies that the backend is running and accepting requests.

### Step 5 — Start frontend

Electron starts the production Next.js server for:

```text
lobnos
```

### Step 6 — Wait for frontend

Electron waits until the Next.js application is responding.

### Step 7 — Create BrowserWindow

Electron creates the PLS application window.

### Step 8 — Load PLS

Electron loads:

```text
http://127.0.0.1:<frontend-port>
```

### Step 9 — User sees PLS

The user should see the normal PLS login/application interface.

The user should not see command prompt windows or server startup terminals.

---

# 14. HEALTH CHECKS

Electron should not immediately open the application before the backend and frontend are ready.

The startup mechanism should include health checks.

Conceptually:

```text
Start Backend
      ↓
Backend Ready?
      │
     YES
      ↓
Start Next.js
      ↓
Frontend Ready?
      │
     YES
      ↓
Open Electron Window
```

If startup fails, PLS should display a meaningful error.

Avoid simply displaying a blank Electron window.

---

# 15. PROCESS MANAGEMENT

Electron should manage the lifecycle of both application servers.

Conceptually:

```text
Electron Main Process
        │
        ├── PLS Backend Process
        │
        └── PLS Frontend Process
```

Electron should be able to:

* Start the processes.
* Monitor the processes.
* Detect crashes.
* Report startup errors.
* Shut them down when PLS closes.
* Prevent unnecessary orphaned Node.js processes.

---

# 16. APPLICATION SHUTDOWN

When the user closes PLS:

```text
User closes PLS
       ↓
Electron begins shutdown
       ↓
Stop Next.js
       ↓
Stop lobnos-server
       ↓
Close Electron
```

The application must not leave unnecessary Node.js server processes running after PLS has been closed.

---

# 17. PORT MANAGEMENT

The implementation should avoid unnecessary dependence on fixed ports.

For example, the current development ports may include:

```text
Frontend: 2377
Backend: 2300
```

However, the desktop application should be designed so that a port conflict does not prevent PLS from starting.

Possible approaches include:

* Detecting whether the preferred port is available.
* Selecting an available local port.
* Passing the selected port to the corresponding service.
* Ensuring the frontend knows the correct backend API URL.

The final implementation should choose the most reliable approach for PLS.

All local services should preferably bind to:

```text
127.0.0.1
```

rather than unnecessarily exposing the application to the local network.

---

# 18. FRONTEND → BACKEND CONFIGURATION

The PLS frontend must be able to communicate with the locally running PLS backend.

Electron should provide the appropriate runtime configuration.

The architecture should support:

```text
Desktop:

Next.js SSR
     ↓
Local PLS API
     ↓
lobnos-server
```

while still supporting:

```text
Web:

Next.js SSR
     ↓
Remote/Server PLS API
     ↓
lobnos-server
```

The codebase should not become permanently hard-coded to localhost.

---

# 19. DATABASE ARCHITECTURE

The Electron application must keep the database layer separate from the Electron UI.

The architecture should support the appropriate PLS database model.

Conceptually:

```text
PLS Desktop
     │
     ├── Next.js
     │
     ├── Backend
     │
     └── Database
```

The database connection information should be provided through production configuration.

Do not hard-code sensitive database credentials directly into Electron source code.

The final database strategy should support the PLS deployment model, including the possibility of local or remote database infrastructure as required.

---

# 20. WEB DEPLOYMENT MUST REMAIN FULLY FUNCTIONAL

Introducing Electron must **not break the existing PLS web deployment**.

PLS must continue to be deployable to Ubuntu/Linux.

The existing web architecture should remain:

```text
Internet
   ↓
Nginx
   ↓
Next.js SSR
   ↓
lobnos-server
   ↓
MySQL
```

The web application should continue to work in a standard browser.

For example:

```text
https://your-pls-domain.com
```

Electron is therefore an additional deployment option.

---

# 21. TWO PRODUCTION DEPLOYMENT MODES

PLS should support two primary production modes.

## Mode A — Web Deployment

```text
                  PLS WEB
                     │
                  Browser
                     │
                   Nginx
                     │
                Next.js SSR
                     │
              lobnos-server
                     │
                  MySQL
```

This can run on:

```text
Ubuntu Server
```

---

## Mode B — Desktop Deployment

```text
                 PLS DESKTOP
                      │
                   Electron
                      │
          ┌───────────┴───────────┐
          │                       │
      Next.js SSR            lobnos-server
          │                       │
          └───────────┬───────────┘
                      │
                    MySQL
```

Both deployment modes must use the same core PLS frontend/backend projects.

---

# 22. DEVELOPMENT WORKFLOW MUST REMAIN INTACT

Developers should still be able to develop PLS normally.

For example:

```text
Frontend:

npm run dev
```

and:

```text
Backend:

npm run dev
```

The Electron implementation should not interfere with the existing development workflow.

The project should support:

```text
Development
     ↓
Next.js + Node.js

Production Web
     ↓
Ubuntu + Nginx + Next.js SSR + Backend

Production Desktop
     ↓
Electron + Node.js + Next.js SSR + Backend
```

---

# 23. DO NOT CREATE A SECOND FRONTEND

Do not create a separate Electron-specific PLS interface.

Avoid:

```text
Web PLS Frontend
+
Electron PLS Frontend
```

unless a very specific native feature requires it.

Instead:

```text
                    PLS Frontend
                    Next.js SSR
                         │
                ┌────────┴────────┐
                │                 │
              Web             Electron
```

This reduces:

* duplicate code,
* duplicated UI logic,
* maintenance cost,
* inconsistent features,
* synchronization problems.

---

# 24. ELECTRON SECURITY

The Electron implementation must follow modern Electron security practices.

The renderer should not have unrestricted access to Node.js.

Use appropriate production security settings such as:

```text
contextIsolation: true
nodeIntegration: false
```

Where native functionality is required, use controlled Electron IPC.

The Next.js application should continue operating as a web application rather than receiving unrestricted operating-system access.

---

# 25. LOCALHOST SECURITY

The local PLS servers should preferably listen only on:

```text
127.0.0.1
```

unless there is a specific PLS requirement to expose them to the local network.

The desktop version should not unnecessarily expose the PLS API or Next.js server to other computers on the user's network.

---

# 26. ENVIRONMENT CONFIGURATION

The implementation should distinguish between:

```text
Development
Testing
Production Web
Production Desktop
```

Do not mix development environment variables with the packaged desktop configuration.

The Electron packaging process should provide the appropriate production configuration.

Sensitive values should not be embedded directly into publicly accessible frontend JavaScript.

---

# 27. BUILD PIPELINE

The project should have a clear production packaging pipeline.

Conceptually:

```text
1. Install dependencies
        ↓
2. Build lobnos-server
        ↓
3. Build lobnos
        ↓
4. Prepare production runtime
        ↓
5. Package Electron
        ↓
6. Generate installer
        ↓
7. Test installed application
        ↓
8. Distribute PLS
```

The exact implementation can use an appropriate Electron packaging framework such as:

```text
electron-builder
```

or an equivalent production-grade solution.

The packaging solution should support:

* Windows installer
* Application resources
* Bundled runtime
* Application icons
* Versioning
* Code signing where available
* Future updates

---

# 28. PROJECT STRUCTURE

The final architecture should clearly separate the Electron layer from the existing PLS projects.

A conceptual structure could be:

```text
PLS/
│
├── lobnos/
│   └── Next.js PLS frontend
│
├── lobnos-server/
│   └── Node.js/Express PLS backend
│
└── electron/
    ├── main process
    ├── preload
    ├── packaging configuration
    └── desktop configuration
```

The exact repository arrangement can be determined during implementation.

The important requirement is that Electron should **orchestrate** the existing applications rather than replace them.

---

# 29. PRODUCTION BUILD OUTPUT

The final installer should contain everything required to execute PLS.

Conceptually:

```text
PLS Installer
│
└── PLS Desktop
    │
    ├── Electron Runtime
    ├── Node Runtime
    ├── PLS Frontend
    │   ├── Next.js
    │   └── .next
    ├── PLS Backend
    ├── Required Dependencies
    └── Production Configuration
```

The end user should not need to understand this structure.

---

# 30. ERROR HANDLING

The application should gracefully handle:

### Backend startup failure

Show:

```text
PLS could not start its backend service.
Please restart the application or contact support.
```

### Frontend startup failure

Show:

```text
PLS could not start its application interface.
Please restart the application or contact support.
```

### Database connection failure

Display an appropriate PLS database/service error.

### Unexpected process termination

Electron should detect the failure and either:

* restart the process when safe, or
* present a meaningful error.

Do not leave the user with an unexplained blank screen.

---

# 31. LOGGING

PLS Desktop should maintain useful logs for troubleshooting.

Logs should make it possible to determine:

* Whether Electron started.
* Whether the backend started.
* Whether Next.js started.
* Which ports were selected.
* Whether the backend crashed.
* Whether the frontend crashed.
* Database connection failures.
* Startup errors.

Logs should be stored in an appropriate application data directory rather than inside the user's source/development directory.

---

# 32. FUTURE AUTO-UPDATE SUPPORT

The architecture should support future PLS desktop updates.

For example:

```text
PLS 1.0
   ↓
Update Available
   ↓
Download Update
   ↓
Install
   ↓
PLS 1.1
```

The update system should be designed so that future versions can update the:

* Electron shell,
* PLS frontend,
* PLS backend,
* bundled runtime,

as required.

Automatic updates do not have to be implemented in the first version, but the architecture should not prevent them.

---

# 33. APPLICATION IDENTITY

The desktop application should be branded as:

```text
Prime Laboratory System
```

with:

```text
PLS
```

as the application abbreviation.

The installer, desktop shortcut, application window, executable metadata, and application icon should use the PLS identity.

Do not expose internal project names such as `lobnos` to the end user unless technically necessary.

For example, the customer should see:

```text
Prime Laboratory System
```

rather than:

```text
lobnos
```

---

# 34. INTERNAL PROJECT NAMES

The existing repositories may continue to be named:

```text
lobnos
lobnos-server
```

for development and source-control purposes.

However, the production product must be branded:

```text
Prime Laboratory System (PLS)
```

This means:

```text
Developer/Internal:

lobnos
lobnos-server

Customer-facing:

Prime Laboratory System
PLS
```

---

# 35. INSTALLER EXPERIENCE

The installer should be designed for a non-technical laboratory user.

The user should not have to make technical decisions such as:

* Node.js installation
* npm configuration
* Port selection
* Next.js configuration
* Backend configuration
* Environment setup

The installation process should be as simple as possible.

Target:

```text
Download
   ↓
Install
   ↓
Finish
   ↓
Open PLS
```

---

# 36. WEB + DESKTOP COMPATIBILITY PRINCIPLE

The implementation must follow this principle:

> **One PLS application codebase, multiple deployment targets.**

The architecture should not become:

```text
PLS Web
+
PLS Desktop Rewrite
```

Instead:

```text
                 PLS
                  │
       ┌──────────┴──────────┐
       │                     │
      Web                 Desktop
       │                     │
    Browser              Electron
       │                     │
       └──────────┬──────────┘
                  │
          Same PLS Application
```

---

# 37. IMPORTANT: ELECTRON IS NOT THE SERVER

Electron must not become the business-logic layer.

The responsibilities should remain:

### Next.js

* UI
* SSR
* frontend routing
* server-rendered pages
* existing PLS frontend logic

### `lobnos-server`

* API
* business logic
* authentication
* database operations
* PLS backend services

### Electron

* desktop window
* application lifecycle
* process orchestration
* packaging
* native desktop integration
* distribution

This separation must be preserved.

---

# 38. FINAL ARCHITECTURAL MODEL

The target architecture is:

```text
                         PRIME LABORATORY SYSTEM
                                  PLS
                                   │
                  ┌────────────────┴────────────────┐
                  │                                 │
              WEB DEPLOYMENT                  DESKTOP DEPLOYMENT
                  │                                 │
               Browser                          Electron
                  │                                 │
                Nginx                         Local Runtime
                  │                                 │
             Next.js SSR                     Next.js SSR
                  │                                 │
            lobnos-server                    lobnos-server
                  │                                 │
               MySQL                            MySQL
```

The same core applications:

```text
lobnos
lobnos-server
```

must support both deployment modes.

---

# 39. FINAL ACCEPTANCE CRITERIA

The implementation is successful only if all of the following requirements are satisfied:

* [ ] Product is branded **Prime Laboratory System (PLS)**.
* [ ] `lobnos` remains the PLS Next.js frontend.
* [ ] `lobnos-server` remains the PLS Node.js/Express backend.
* [ ] PLS frontend remains **server-side rendered**.
* [ ] No static export is introduced.
* [ ] No client-only rewrite is introduced.
* [ ] Electron packages the PLS application into a desktop application.
* [ ] Frontend and backend can be distributed together.
* [ ] Node.js does not need to be separately installed by the customer.
* [ ] The user can install PLS using a normal installer.
* [ ] The user can launch PLS without using a terminal.
* [ ] Electron starts `lobnos-server` automatically.
* [ ] Electron starts the Next.js SSR server automatically.
* [ ] Electron waits for services to become ready.
* [ ] Electron opens the PLS application automatically.
* [ ] PLS can communicate with its local backend.
* [ ] Port conflicts are handled appropriately.
* [ ] Local services are not unnecessarily exposed to the network.
* [ ] Backend and frontend failures are handled gracefully.
* [ ] Server processes are properly shut down when PLS closes.
* [ ] PLS continues to work as a web application.
* [ ] PLS remains deployable to Ubuntu/Linux servers.
* [ ] Existing development workflows remain functional.
* [ ] No second Electron-specific frontend is created.
* [ ] Electron does not contain PLS business logic.
* [ ] Production configuration is separated from development configuration.
* [ ] Logging is available for troubleshooting.
* [ ] The packaging system supports future updates.
* [ ] The application is presented to users as **Prime Laboratory System (PLS)**.
* [ ] The final experience is effectively **one-click installation and launch**.

---

# 40. FINAL INSTRUCTION TO THE IMPLEMENTATION AGENT

Implement the Electron desktop distribution for **Prime Laboratory System (PLS)** using the existing:

```text
lobnos
```

Next.js SSR frontend and:

```text
lobnos-server
```

Node.js/Express backend.

**Do not rewrite the application.**

**Do not convert Next.js to static export.**

**Do not remove server-side rendering.**

**Do not create a separate desktop frontend.**

Instead, build an Electron layer that:

1. Packages the existing PLS frontend.
2. Packages the existing PLS backend.
3. Provides the required Node.js runtime.
4. Starts the backend automatically.
5. Starts the Next.js SSR frontend automatically.
6. Waits for both services to become ready.
7. Opens the PLS SSR application inside Electron.
8. Manages the lifecycle of the local services.
9. Provides a simple one-click installer.
10. Keeps the existing Ubuntu/web deployment completely functional.

The final product should behave like a normal installable desktop application to the customer while technically remaining the **same server-rendered PLS web application running locally under Electron**.

The fundamental principle is:

> **Electron should package and orchestrate PLS, not replace PLS's existing web architecture.**
