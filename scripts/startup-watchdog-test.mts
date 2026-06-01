import { readFileSync } from "node:fs";
import vm from "node:vm";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeElement {
  tagName: string;
  textContent = "";
  children: FakeElement[] = [];
  listeners = new Map<string, () => void>();
  classNames = new Set<string>();
  attributes = new Map<string, string>();

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  classList = {
    add: (name: string) => this.classNames.add(name),
  };

  appendChild(child: FakeElement) {
    this.children.push(child);
    return child;
  }

  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener);
  }

  querySelector(selector: string): FakeElement | null {
    if (selector === ":scope > .startup-fallback") {
      return this.children.find((child) => child.classNames.has("startup-fallback")) || null;
    }
    if (selector === "[data-startup-status]") {
      return this.children.find((child) => child.attributes.has("data-startup-status")) || null;
    }
    if (selector === "small" || selector === "button") {
      return this.children.find((child) => child.tagName === selector) || null;
    }
    return null;
  }
}

const root = new FakeElement("div");
const fallback = new FakeElement("div");
fallback.classNames.add("startup-fallback");
const status = new FakeElement("span");
status.attributes.set("data-startup-status", "");
status.textContent = "正在启动...";
fallback.appendChild(status);
root.appendChild(fallback);

let reloaded = false;
const context = {
  document: {
    getElementById(id: string) {
      return id === "root" ? root : null;
    },
    createElement(tagName: string) {
      return new FakeElement(tagName);
    },
  },
  window: {
    setTimeout(callback: () => void, delay: number) {
      assert(delay === 8000, "startup watchdog should wait long enough before showing recovery copy");
      callback();
      return 1;
    },
    location: {
      reload() {
        reloaded = true;
      },
    },
  },
};

vm.runInNewContext(readFileSync("public/startup-watchdog.js", "utf8"), context);

const detail = fallback.querySelector("small");
const button = fallback.querySelector("button");
assert(fallback.classNames.has("startup-fallback--slow"), "startup watchdog should mark a slow startup");
assert(status.textContent.includes("启动时间有点久"), "startup watchdog should replace the waiting copy");
assert(detail?.textContent.includes("重启当前开发服务") === true, "startup watchdog should explain the recovery path");
assert(button?.textContent === "刷新", "startup watchdog should add a refresh button");
button?.listeners.get("click")?.();
assert(reloaded, "startup watchdog refresh button should reload the page");

console.log("startup-watchdog-test: ok");
