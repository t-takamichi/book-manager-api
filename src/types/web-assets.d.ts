// Path alias declarations for @web/* (assets & styles)
// This project is API-only, so we do not declare web UI components here.
// Avoid a broad `declare module '@web/*'` because that would collapse types to `any`.

declare module '@web/assets/*' {
  const src: string;
  export default src;
}

declare module '@web/images/*' {
  const src: string;
  export default src;
}

declare module '@web/*.svg' {
  const src: string;
  export default src;
}

declare module '@web/styles/*' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '@web/*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '@web/*.css' {
  const css: string;
  export default css;
}

// If in the future you add UI components under @web/, we can add a components
// declaration. For now, these targeted declarations are sufficient and keep
// TypeScript type checking intact for API-focused code.
