export function clearElement(element: HTMLElement) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: {
    className?: string;
    textContent?: string;
    href?: string;
    type?: string;
    value?: string;
  } = {}
) {
  const element = document.createElement(tagName);
  if (options.className) {
    element.className = options.className;
  }
  if (options.textContent) {
    element.textContent = options.textContent;
  }
  if (options.href && "href" in element) {
    element.setAttribute("href", options.href);
  }
  if (options.type && "type" in element) {
    element.setAttribute("type", options.type);
  }
  if (options.value && "value" in element) {
    element.setAttribute("value", options.value);
  }
  return element;
}

export function createMetric(label: string, value: string | number) {
  const wrapper = createElement("div", { className: "metric" });
  wrapper.append(
    createElement("span", { className: "metric__label", textContent: label }),
    createElement("strong", { className: "metric__value", textContent: String(value) })
  );
  return wrapper;
}
