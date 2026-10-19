# Linux packaging

Build on Ubuntu with `npm run dist:linux`. The output is AppImage and DEB. Smoke-test on Ubuntu 24.04 x86_64 first. Local screen preview and local input control are different capabilities: never start either on app launch. Keep Wayland input control disabled unless the portal/input implementation is fully verified; a screenshot alone does not authorize control. The initial client currently opens the hosted Whilo web app only.
