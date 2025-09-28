// Type declarations for optional modules used in scrapers
declare module 'puppeteer-extra' {
  import { Browser, Page } from 'puppeteer';
  
  const puppeteer: {
    launch(options?: any): Promise<Browser>;
    use(plugin: any): void;
  };
  export = puppeteer;
}

declare module 'puppeteer-extra-plugin-stealth' {
  const StealthPlugin: () => any;
  export = StealthPlugin;
}

declare module 'handlebars' {
  export function compile(template: string): (context: any) => string;
  export function registerHelper(name: string, helper: Function): void;
}