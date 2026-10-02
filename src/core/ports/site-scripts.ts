/** Browser runtimes are supplied by the composition layer; the document core never imports the DOM. */
export interface SiteScripts {
  forms(): string;
}
