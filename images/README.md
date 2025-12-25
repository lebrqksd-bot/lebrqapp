This folder is a placeholder for any web-only static images (e.g., favicons or apple-touch icons) if referenced by meta tags or external links.

The app primarily uses assets from `assets/images/` via React Native's asset system. If you see ENOENT errors for `.../LebrqApp/images`, it means something tried to read from a root-level `images/` directory. Keeping this folder present avoids such development-time errors.
