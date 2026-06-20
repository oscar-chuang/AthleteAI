import { beforeEach } from "vitest";
import { _resetAlertCounters } from "./lib/alerting";

beforeEach(() => {
  _resetAlertCounters();
});
