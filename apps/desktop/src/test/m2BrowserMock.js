const benchmarkWindow = window;
const callbacks = new Map();
let nextCallback = 1;
const longAnimationFrames = [];
const telemetryElement = document.createElement("meta");
telemetryElement.name = "givemejob-m2-browser-telemetry";
document.head.append(telemetryElement);

function updateTelemetry() {
  telemetryElement.content = JSON.stringify({
    longAnimationFrameSupported:
      "PerformanceObserver" in window &&
      PerformanceObserver.supportedEntryTypes.includes("long-animation-frame"),
    longAnimationFrames,
    openOriginalCalls: benchmarkWindow.__M2_BROWSER_BENCHMARK__?.openOriginalCalls ?? 0,
    searchCalls: benchmarkWindow.__M2_BROWSER_BENCHMARK__?.searchCalls ?? 0,
  });
}

if (
  "PerformanceObserver" in window &&
  PerformanceObserver.supportedEntryTypes.includes("long-animation-frame")
) {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) longAnimationFrames.push(entry.duration);
    updateTelemetry();
  }).observe({ type: "long-animation-frame", buffered: true });
}

const jobs = Array.from({ length: 240 }, (_, index) => ({
  id: String(index + 1),
  title: `${index % 3 === 0 ? "Senior " : ""}Rust Engineer ${index + 1}`,
  company: `Offline Company ${String((index % 12) + 1).padStart(2, "0")}`,
  locationText: index % 2 === 0 ? "Remote" : "Berlin, DE",
  remoteMode: index % 2 === 0 ? "remote" : "hybrid",
  seniority: index % 3 === 0 ? "senior" : "middle",
  salaryMin: 90_000 + index * 100,
  salaryMax: 120_000 + index * 100,
  salaryCurrency: "USD",
  salaryPeriod: "year",
  postedAt: "2026-07-30T00:00:00Z",
  source: index % 2 === 0 ? "greenhouse" : "lever",
  attribution: index % 2 === 0 ? "Greenhouse" : "Lever",
}));

benchmarkWindow.__M2_BROWSER_BENCHMARK__ = {
  openOriginalCalls: 0,
  searchCalls: 0,
};
updateTelemetry();
benchmarkWindow.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  unregisterListener() {},
};
benchmarkWindow.__TAURI_INTERNALS__ = {
  callbacks,
  async invoke(command, args = {}) {
    if (command === "plugin:event|listen") return args.handler;
    if (command === "plugin:event|unlisten") return null;
    if (command === "catalog_status") {
      return {
        state: "ready",
        stage: null,
        progress: 100,
        catalogVersion: "1",
        sourceFrozenAt: "2026-07-29T20:30:03.846872Z",
        totalJobs: 78_719,
        message: null,
      };
    }
    if (command === "get_filter_options") {
      return {
        sources: [
          { source: "greenhouse", count: 120 },
          { source: "lever", count: 120 },
        ],
        remoteModes: ["remote", "hybrid", "onsite"],
        seniorities: [
          "intern",
          "junior",
          "middle",
          "senior",
          "lead",
          "staff",
          "principal",
          "manager",
          "director",
          "executive",
        ],
        employmentTypes: [
          "full_time",
          "contract",
          "part_time",
          "internship",
          "temporary",
          "volunteer",
          "other",
        ],
      };
    }
    if (command === "search_jobs") {
      benchmarkWindow.__M2_BROWSER_BENCHMARK__.searchCalls += 1;
      updateTelemetry();
      const request = typeof args.request === "object" && args.request !== null ? args.request : {};
      const cursor = typeof request.cursor === "string" ? request.cursor : null;
      const pageIndex = cursor === null ? 0 : Number(cursor.replace("m2-page-", "")) - 1;
      const start = pageIndex * 50;
      const items = jobs.slice(start, start + 50);
      const hasNext = start + items.length < jobs.length;
      return {
        items,
        nextCursor: hasNext ? `m2-page-${pageIndex + 2}` : null,
        ...(pageIndex === 0 ? { total: jobs.length } : {}),
      };
    }
    if (command === "get_job") {
      const id = typeof args.id === "string" ? args.id : "1";
      const job = jobs.find((candidate) => candidate.id === id) ?? jobs[0];
      if (!job) throw new Error("M2 browser fixture has no jobs");
      return {
        ...job,
        description: "Build fast, accessible offline search.\n\n- Rust\n- SQLite FTS5",
        skills: ["Rust", "SQLite"],
        employmentType: "full_time",
        salaryUsdYear: job.salaryMin,
        sourceUrl: `https://example.invalid/jobs/${job.id}`,
        applyUrl: null,
        snapshotVersion: "1",
      };
    }
    if (command === "open_original") {
      benchmarkWindow.__M2_BROWSER_BENCHMARK__.openOriginalCalls += 1;
      updateTelemetry();
      return null;
    }
    if (command === "autocomplete_skills" || command === "autocomplete_locations") return [];
    if (command === "recover_catalog") return null;
    throw new Error(`Unexpected M2 browser command: ${command}`);
  },
  runCallback(identifier, data) {
    return callbacks.get(identifier)?.(data);
  },
  transformCallback(callback, once = false) {
    const identifier = nextCallback;
    nextCallback += 1;
    callbacks.set(identifier, (data) => {
      if (once) callbacks.delete(identifier);
      return callback(data);
    });
    return identifier;
  },
  unregisterCallback(identifier) {
    callbacks.delete(identifier);
  },
};
