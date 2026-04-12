// TypeScript 6 requires explicit module declarations for non-JS side-effect
// imports. Without this, `import "./globals.css"` in layout.tsx causes:
//   "Cannot find module or type declarations for side-effect import of '*.css'"
declare module "*.css";
