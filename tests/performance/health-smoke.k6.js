/* global __ENV */
import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = String(__ENV.SONARA_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

export const options = {
  vus: 5,
  duration: "20s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    "http_req_duration{route:health}": ["p(95)<250"],
    "http_req_duration{route:home}": ["p(95)<500"],
    "http_req_duration{route:pricing}": ["p(95)<750"]
  }
};

export default function () {
  const health = http.get(`${baseUrl}/api/health`, { tags: { route: "health" } });
  check(health, {
    "health returns 200": (response) => response.status === 200,
    "health payload reports ok": (response) => {
      try {
        return response.json("ok") === true;
      } catch {
        return false;
      }
    }
  });

  const home = http.get(`${baseUrl}/`, { tags: { route: "home" } });
  check(home, { "home returns 200": (response) => response.status === 200 });

  const pricing = http.get(`${baseUrl}/pricing`, { tags: { route: "pricing" } });
  check(pricing, { "pricing returns 200": (response) => response.status === 200 });

  sleep(0.1);
}
