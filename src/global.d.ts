// global.d.ts

declare module '*.pcss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '@codexteam/shortcuts' {
  const shortcuts: any;
  export default shortcuts;
}
