# Windows packaging

Build on Windows with `npm run dist:win`. The output is NSIS installer and portable build. Public distribution should use a trusted code-signing certificate. Keep auto-start and elevated access off by default. Any later computer-control integration must separate UI permissions from OS-level access and require explicit user approval.
