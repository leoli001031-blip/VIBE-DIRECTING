# Morning Market MVP Demo

This is the checked-in MVP sample project for the local Project.vibe user path.

Use it to demonstrate:

- Opening a project folder from local disk.
- Reading `project.vibe` as the source of truth.
- Showing locked visual memory, shot order, and prior Agent Loop receipts.
- Running the owned Agent Loop prototype against project-local facts.
- Exporting a text-only MVP package under a project-local export root.

The sample is intentionally text-only. Files under `assets/` describe locked references without bundling generated media. It runs from local files and does not need live provider credentials.

Smoke test:

```sh
npm run mvp-demo-export:test
```
