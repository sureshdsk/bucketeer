Next-Generation Rust S3 Browser: Feature & Requirements Document
Core Storage & File Management
Universal S3 Compatibility: Support for standard AWS S3 as well as S3-compatible endpoints such as Cloudflare R2, MinIO, Wasabi, and DigitalOcean Spaces.  

Advanced Data Transfer: Support for bulk uploading, downloading, and recursive folder deletion. The application must feature an "S3-compatible delete fallback" that downgrades to single-object deletion if the provider rejects multi-object bulk delete requests.  

Multipart Uploads: Automated chunking of large files (e.g., video assets, database dumps) via the S3 Multipart Upload API to ensure network resiliency and avoid timeouts.  

Mixed-Content Drag-and-Drop: Recursive, localized parsing of desktop folders dragged directly into the application window, automatically assigning MIME types and building corresponding S3 prefix paths.  

Security & Credential Handling
Zero-Configuration Onboarding: Automatic parsing of the host machine's AWS Credential Provider Chain (~/.aws/config and ~/.aws/credentials) so that users with an existing AWS CLI setup can use the app instantly.  

Modern Identity Support: Native support for AWS IAM Identity Center (formerly AWS SSO), including background handling and refreshing of OAuth 2.0 access tokens and dynamic role assumption.  

OS Keyring Integration: Secure storage for manually inputted third-party access keys and secret keys. Secrets must be pushed directly to the native operating system credential managers (Apple Keychain, Windows Credential Manager, Linux Secret Service) rather than stored in plain-text configuration files.  

Performance Architecture & Caching
Prefix-Indexed Memory Tree: An in-memory data structure that maps the flat S3 namespace into a simulated folder hierarchy, allowing instant sub-millisecond local navigation.  

Smart Invalidation: Cache auto-invalidation when a user mutates data, combined with a background Time-to-Live (TTL) refresh cycle (e.g., 30 minutes) to clear stale objects modified by external systems.  

Latency-Hiding Prefetching: Background prefetching of bucket directories and object previews triggered when a user hovers over an entry.  

Paginated IPC Bridge: Architectural separation where heavy binary I/O is handled purely by Rust threads, and only paginated metadata is passed across the Inter-Process Communication (IPC) bridge to the Tauri frontend, preventing the UI from freezing during massive data loads.  

User Experience & Interface
Virtualized UI Elements: Virtualized object tables optimized for massive listings, rendering only the rows currently visible on the screen.  

Multi-Workspace Management: A tabbed or dual-pane interface allowing side-by-side comparison of different buckets, alongside strict workspace isolation for different AWS profiles to prevent accidental operations in production.  

Direct Path Invocation: A manual path-entry bar enabling access to deeply nested objects even when the user's IAM policy lacks broad s3:ListAllMyBuckets permissions at the root level.  

Rich Media & Tooling
Presigned URL Streaming: Bypassing local memory bottlenecks by generating ephemeral, temporary presigned URLs to stream rich media (images, PDFs, video) directly to the Tauri webview.  

Integrated Code Editor: An embedded text engine (like Monaco) allowing developers to natively view, edit, and save JSON, YAML, and log files directly to S3 without initiating a manual download/upload cycle.  

On-the-Fly Decompression: The ability to stream and decode .gz and .zstd compressed files in real-time for quick data inspection.  

Shareable Links: A right-click context menu allowing users to generate and copy secure, time-limited presigned URLs to share files with external clients.  

Live System Monitor: A developer-focused overlay displaying API request throughput, success/failure rates, and raw HTTP logs.  

Deep Search: Recursive search capabilities scoped to specific prefixes with built-in concurrency limits to prevent triggering Amazon S3 rate-limiting algorithms.  

Distribution & Developer Experience
Automated Packaging: CI/CD pipelines configured to automatically generate standalone binaries using tools like cargo-dist or cargo-packager.  

Cross-Platform Targets: Deliverables should include universal macOS .dmg files (Intel and Apple Silicon), Windows .exe installers, and Linux .AppImage files to completely eliminate dependency and GLIBC compilation headaches for end-users.
