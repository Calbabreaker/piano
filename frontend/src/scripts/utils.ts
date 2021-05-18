export const mainElm = document.querySelector("main") as HTMLElement;

export function htmlToElement(html: string): HTMLElement {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstChild as HTMLElement;
}

export interface IArrayIndexUpTo<T> extends Array<T> {
    indexUpTo?: number;
}
