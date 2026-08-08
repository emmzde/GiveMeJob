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
let profile = null;
let shortlist = [];
const emmyConversationId = "e".repeat(32);
const emmyConfirmationId = "f".repeat(32);
const emmyConfiguredProviders = new Set(["groq", "gemini", "openrouter", "cerebras"]);

function emmyConfiguration() {
  return {
    available: emmyConfiguredProviders.size > 0,
    customApi: null,
    providers: ["groq", "gemini", "openrouter", "cerebras"].map((provider) => ({
      provider,
      configured: emmyConfiguredProviders.has(provider),
      byokConfigured: emmyConfiguredProviders.has(provider),
      demoAvailable: false,
    })),
  };
}

function emmySnapshot(job) {
  return {
    summary: job,
    employmentType: "full_time",
    salaryUsdYear: job.salaryMin,
    skills: ["Rust", "SQLite", "TypeScript"],
    descriptionExcerpt: "Недоверенный фрагмент локальной вакансии для сравнения.",
  };
}

const emmyComparison = {
  rows: [jobs[0], jobs[1]].map((job) => ({
    job: emmySnapshot(job),
    matchBreakdown: null,
  })),
};
let emmyMessages = [
  {
    id: "1".repeat(32),
    conversationId: emmyConversationId,
    role: "user",
    content: { type: "user", text: "Найди и сравни две вакансии Rust" },
    createdAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "2".repeat(32),
    conversationId: emmyConversationId,
    role: "tool",
    content: {
      type: "tool",
      call: {
        name: "search_jobs",
        args: {
          text: "Rust",
          skills: [],
          locations: [],
          remoteModes: [],
          seniorities: [],
          employmentTypes: [],
          salaryMinUsdYear: null,
          salaryKnownOnly: false,
          sources: [],
          sort: "relevance",
          limit: 8,
        },
      },
      result: { type: "search_jobs", items: jobs.slice(0, 2), total: 240 },
    },
    createdAt: "2026-08-01T10:00:01Z",
  },
  {
    id: "3".repeat(32),
    conversationId: emmyConversationId,
    role: "assistant",
    content: {
      type: "assistant",
      text: "Нашла две вакансии в локальном каталоге и сравнила основные условия.",
      jobCards: jobs.slice(0, 2),
      quickReplies: ["Покажи совпадение", "Найди только remote"],
      comparison: emmyComparison,
    },
    createdAt: "2026-08-01T10:00:02Z",
  },
  {
    id: emmyConfirmationId,
    conversationId: emmyConversationId,
    role: "tool",
    content: {
      type: "tool",
      call: { name: "set_shortlist", args: { jobId: "1", saved: true } },
      result: {
        type: "set_shortlist",
        preview: {
          confirmationId: emmyConfirmationId,
          job: jobs[0],
          saved: true,
          status: "pending",
        },
      },
    },
    createdAt: "2026-08-01T10:00:03Z",
  },
];

function emmyConversation() {
  return {
    conversation: {
      id: emmyConversationId,
      title: "Сравнение Rust-вакансий",
      createdAt: "2026-08-01T10:00:00Z",
      updatedAt: "2026-08-01T10:00:03Z",
    },
    messages: emmyMessages,
  };
}

function matchFor(jobId) {
  return {
    jobId,
    breakdown: {
      score: 88,
      components: { skills: 100, role: 100, seniority: 100, location: 100, salary: 60 },
      strengths: [
        { component: "skills", code: "skills_overlap", values: ["Rust", "SQLite"] },
      ],
      gaps: [
        { component: "salary", code: "salary_below", values: ["90000", "100000"] },
      ],
    },
  };
}

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
    if (command === "get_profile") return profile;
    if (command === "save_profile") {
      const request = typeof args.request === "object" && args.request !== null ? args.request : {};
      const now = new Date().toISOString();
      profile = {
        ...request,
        version: profile === null ? 1 : profile.version + 1,
        createdAt: profile?.createdAt ?? now,
        updatedAt: now,
      };
      return profile;
    }
    if (command === "list_shortlist") return shortlist;
    if (command === "is_shortlisted") {
      return shortlist.some((record) => record.jobId === args.jobId);
    }
    if (command === "set_shortlist") {
      const request = typeof args.request === "object" && args.request !== null ? args.request : {};
      shortlist = shortlist.filter((record) => record.jobId !== request.jobId);
      const savedAt = request.saved ? new Date().toISOString() : null;
      if (request.saved) {
        shortlist.unshift({ jobId: request.jobId, catalogVersion: "1", savedAt });
      }
      return { jobId: request.jobId, saved: Boolean(request.saved), catalogVersion: "1", savedAt };
    }
    if (command === "get_match_breakdown") {
      return profile === null ? null : matchFor(args.jobId).breakdown;
    }
    if (command === "get_match_breakdowns") {
      return profile === null ? [] : (args.request?.jobIds ?? []).map(matchFor);
    }
    if (command === "emmy_configuration") return emmyConfiguration();
    if (command === "emmy_set_provider_key") {
      emmyConfiguredProviders.add(args.request?.provider);
      return emmyConfiguration();
    }
    if (command === "emmy_clear_provider_key") {
      emmyConfiguredProviders.delete(args.request?.provider);
      return emmyConfiguration();
    }
    if (command === "emmy_list_conversations") {
      return [emmyConversation().conversation];
    }
    if (command === "emmy_create_conversation") {
      emmyMessages = [];
      return emmyConversation();
    }
    if (command === "emmy_load_conversation") return emmyConversation();
    if (command === "emmy_send_message") {
      const text = args.request?.text ?? "Найди Rust вакансии";
      const suffix = String(emmyMessages.length + 4).padStart(32, "0");
      const userMessage = {
        id: suffix,
        conversationId: emmyConversationId,
        role: "user",
        content: { type: "user", text },
        createdAt: new Date().toISOString(),
      };
      const assistantMessage = {
        id: String(emmyMessages.length + 5).padStart(32, "0"),
        conversationId: emmyConversationId,
        role: "assistant",
        content: {
          type: "assistant",
          text: "Готово — использовала только локальный каталог.",
          jobCards: jobs.slice(2, 4),
          quickReplies: ["Сравни их"],
          comparison: null,
        },
        createdAt: new Date(Date.now() + 1).toISOString(),
      };
      emmyMessages.push(userMessage, assistantMessage);
      return {
        conversationId: emmyConversationId,
        messages: [userMessage, assistantMessage],
        state: "success",
        provider: "cerebras",
        error: null,
      };
    }
    if (command === "emmy_confirm_shortlist") {
      const confirmed = Boolean(args.request?.confirmed);
      emmyMessages = emmyMessages.map((message) => {
        if (message.id !== args.request?.confirmationId) return message;
        return {
          ...message,
          content: {
            ...message.content,
            result: {
              ...message.content.result,
              preview: {
                ...message.content.result.preview,
                status: confirmed ? "confirmed" : "cancelled",
              },
            },
          },
        };
      });
      if (confirmed) {
        shortlist = [{ jobId: "1", catalogVersion: "1", savedAt: new Date().toISOString() }];
      }
      return {
        conversationId: emmyConversationId,
        messages: emmyMessages.filter((message) => message.id === args.request?.confirmationId),
        state: "success",
        provider: null,
        error: null,
      };
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
