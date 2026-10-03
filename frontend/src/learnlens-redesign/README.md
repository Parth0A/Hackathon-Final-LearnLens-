# LearnLens redesigned UI

This folder contains the isolated LearnLens home/workspace redesign.

## Files

- `LearnLensRedesignHome.tsx` — role-aware student, teacher and admin shell.
- `AsciiLearnLensLogo.tsx` — self-contained canvas ASCII wordmark with cursor physics.

## Integration

The existing Home page calls this UI only for the `home` view. Feature cards call the existing LearnLens views, APIs and components.

## Removal

To remove the redesign later, delete this folder and restore the `Home.tsx` home-view render to the previous `HomeLauncher`/admin layout. No backend files are required by this folder.
