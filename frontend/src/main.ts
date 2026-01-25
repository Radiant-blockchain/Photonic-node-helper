import "./styles.css";
import { API_BASE, control, getDebugLogTail, getDiscordEligibility, checkDiscordRole, getStatus, rpcCall, streamDebugLog, verifyDiscord, type NodeStatus, type DiscordEligibility } from "./api";

const el = document.querySelector<HTMLDivElement>("#app")!;;

function fmtSeconds(s?: number) {
  if (!s && s !== 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}h ${m}m ${ss}s`;
}

function fmtHashrate(h?: number) {
  if (!h && h !== 0) return "—";
  if (h >= 1e12) return (h / 1e12).toFixed(2) + " TH/s";
  if (h >= 1e9) return (h / 1e9).toFixed(2) + " GH/s";
  if (h >= 1e6) return (h / 1e6).toFixed(2) + " MH/s";
  if (h >= 1e3) return (h / 1e3).toFixed(2) + " KH/s";
  return h.toFixed(0) + " H/s";
}

function safeJson(v: unknown) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

const rpcMethods = [
  "getblockchaininfo",
  "getbestblockhash",
  "getblock",
  "getblockhash",
  "getblockcount",
  "getchaintips",
  "getdifficulty",
  "getnetworkinfo",
  "getpeerinfo",
  "getnettotals",
  "getconnectioncount",
  "getmempoolinfo",
  "getrawmempool",
  "getmininginfo",
  "gettxoutsetinfo",
  "validateaddress",
  "uptime",
  "getmemoryinfo",
  "ping"
];

// Track focused element id to restore after re-render
let focusedElementId: string | null = null;

// Connection state: 'connecting' | 'online' | 'offline'
let connectionState: 'connecting' | 'online' | 'offline' = 'connecting';

const uiState = {
  rpcMethod: rpcMethods[0],
  rpcParams: "",
  rpcOutput: "",
  rpcOutputHeight: "" as string | "",
  rpcOutputScrollTop: 0,
  debugLogOutput: "",
  debugLogOutputHeight: "" as string | "",
  debugLogScrollTop: 0,
  debugLogFollow: false,
  discordId: localStorage.getItem("discordId") || ""
};

let debugLogOutEl: HTMLTextAreaElement | null = null;
let stopDebugLogStream: (() => void) | null = null;

// Discord state (initialized once, not on every render)
let discordInitialized = false;
let discordEligibility: DiscordEligibility | null = null;
let discordUserHasRole = false;
let discordUserHasEliteRole = false;

// Toast notifications
function ensureToastContainer(): HTMLElement {
  let container = document.querySelector<HTMLElement>('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function toast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 5000) {
  const container = ensureToastContainer();
  const toastEl = document.createElement('div');
  toastEl.className = `toast ${type}`;
  toastEl.textContent = message;
  container.appendChild(toastEl);

  setTimeout(() => {
    toastEl.style.animation = 'toast-out 0.25s ease-in forwards';
    toastEl.addEventListener('animationend', () => toastEl.remove());
  }, duration);
}

function setDebugLogOutput(text: string) {
  uiState.debugLogOutput = text;
  if (debugLogOutEl) debugLogOutEl.value = text;
}

function appendDebugLog(text: string) {
  const next = uiState.debugLogOutput ? `${uiState.debugLogOutput}\n${text}` : text;
  // Keep output bounded (roughly last ~250k chars)
  uiState.debugLogOutput = next.length > 250_000 ? next.slice(next.length - 250_000) : next;
  if (debugLogOutEl) {
    // Save scroll position before updating value (setting .value can reset scroll)
    const savedScroll = debugLogOutEl.scrollTop;
    debugLogOutEl.value = uiState.debugLogOutput;
    if (uiState.debugLogFollow) {
      debugLogOutEl.scrollTop = debugLogOutEl.scrollHeight;
    } else {
      debugLogOutEl.scrollTop = savedScroll;
    }
  }
}

let lastStatus: NodeStatus | null = null;

function render(status: NodeStatus) {
  // Save focus before re-render
  const activeEl = document.activeElement as HTMLElement | null;
  const savedFocusId = activeEl?.id || null;
  const savedSelectionStart = (activeEl as HTMLInputElement | HTMLTextAreaElement)?.selectionStart;
  const savedSelectionEnd = (activeEl as HTMLInputElement | HTMLTextAreaElement)?.selectionEnd;

  const ok = !!status?.network;
  const blocks = status.chain?.blocks ?? 0;
  const headers = status.chain?.headers ?? 0;
  // Synced when blocks caught up to headers (or within 1 block)
  const isSynced = headers > 0 && blocks >= headers - 1;
  const isSyncing = headers > 0 && !isSynced;
  const syncPct = headers > 0 ? Math.min(blocks / headers, 1) : 0;

  // Determine status label and dot class
  let statusLabel: string;
  let dotClass: string;
  if (ok) {
    statusLabel = isSyncing ? "Syncing" : "Online";
    dotClass = "ok";
  } else if (connectionState === 'connecting') {
    statusLabel = "Connecting...";
    dotClass = "warn pulse";
  } else {
    statusLabel = "Offline";
    dotClass = "err";
  }

  el.innerHTML = `
    <div class="container">
      <div class="header">
        <div class="brand">
          <img class="logo" src="/avian-logo.png" alt="Avian" />
          <div class="h1">Avian Node Helper</div>
        </div>
        <div class="badge">
          <span class="dot ${dotClass}"></span>
          <span>${statusLabel}</span>
          <span class="sep">•</span>
          <span class="muted">API:</span>
          <span class="mono">${API_BASE}</span>
        </div>
      </div>

      ${isSyncing ? `
      <div class="sync-bar-container">
        <div class="sync-bar">
          <div class="sync-bar-fill" style="width: ${(syncPct * 100).toFixed(2)}%"></div>
        </div>
        <div class="sync-text">
          Syncing: ${(syncPct * 100).toFixed(2)}% — Block ${status.chain?.blocks?.toLocaleString() ?? "?"} of ${status.chain?.headers?.toLocaleString() ?? "?"}
        </div>
      </div>
      ` : ""}

      <div class="grid">
        <div class="card">
          <h2>Chain</h2>
          <div class="kv">
            <div class="k">Chain</div><div>${status.chain?.chain ?? "—"}</div>
            <div class="k">Blocks</div><div>${status.chain?.blocks?.toLocaleString() ?? "—"}</div>
            <div class="k">Headers</div><div>${status.chain?.headers?.toLocaleString() ?? "—"}</div>
            <div class="k">Best Hash</div><div class="hash">${status.chain?.bestblockhash ?? "—"}</div>
            <div class="k">Sync</div><div>${isSynced ? "100% ✓" : (syncPct > 0 ? (syncPct * 100).toFixed(2) + "%" : "—")}</div>
            <div class="k">Disk</div><div>${status.chain?.size_on_disk != null ? (status.chain.size_on_disk / 1e9).toFixed(2) + " GB" : "—"}</div>
          </div>
        </div>

        <div class="card">
          <h2>Network</h2>
          <div class="kv">
            <div class="k">Subversion</div><div>${status.network?.subversion ?? "—"}</div>
            <div class="k">Protocol</div><div>${status.network?.protocolversion ?? "—"}</div>
            <div class="k">Connections</div><div>${status.network?.connections ?? "—"}</div>
            <div class="k">Peers</div><div>${status.peers ? `${status.peers.count} (in ${status.peers.inbound} / out ${status.peers.outbound})` : "—"}</div>
            <div class="k">Uptime</div><div>${fmtSeconds(status.uptime)}</div>
          </div>
          <hr />
          <div class="btnrow">
            <button id="btn-start" data-variant="primary" title="Start the aviand container">Start</button>
            <button id="btn-stop" data-variant="danger" title="Stop the aviand container (stays stopped)">Stop</button>
            <button id="btn-restart" data-variant="secondary" title="Restart the aviand container">Restart</button>
          </div>
          <div class="small" style="margin-top:8px;">
            Docker control requires socket mount + ENABLE_DOCKER_CONTROL=1
          </div>
        </div>

        <div class="card">
          <h2>Mining (X16RT)</h2>
          <div class="kv">
            <div class="k">Difficulty</div><div>${status.mining?.difficulty_x16rt?.toFixed(4) ?? "—"}</div>
            <div class="k">Network Hash</div><div>${fmtHashrate(status.mining?.networkhashps_x16rt)}</div>
          </div>
        </div>

        <div class="card">
          <h2>Mining (MinotaurX)</h2>
          <div class="kv">
            <div class="k">Difficulty</div><div>${status.mining?.difficulty_minotaurx?.toFixed(6) ?? "—"}</div>
            <div class="k">Network Hash</div><div>${fmtHashrate(status.mining?.networkhashps_minotaurx)}</div>
          </div>
        </div>

        <div class="card" style="grid-column: span 12;">
          <h2>🎖️ Node Operator Roles</h2>
          <p class="small" style="margin: 0 0 12px 0;">
            Claim Discord roles by running your node. Node Operator (7 days) • Elite Node Operator (90 days)
          </p>
          <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
            <div style="min-width: 240px;">
              <label class="small" for="discord-id">Discord User ID</label>
              <input id="discord-id" placeholder="e.g. 123456789012345678" style="width: 100%; margin-top: 4px; box-sizing: border-box;" value="${uiState.discordId}" />
            </div>
            <button id="discord-verify" type="button" data-variant="primary" style="white-space: nowrap; margin-top: 18px;">Verify & Claim</button>
            <div id="discord-status" class="small" style="margin-top: 18px;"></div>
          </div>
          <p class="small" style="margin: 10px 0 0 0; color: var(--muted);">
            <a href="https://support.discord.com/hc/en-us/articles/206346498" target="_blank" rel="noopener">How to find your Discord User ID</a>
            — Enable Developer Mode, right-click your name, "Copy User ID"
          </p>
        </div>

        <div class="card" style="grid-column: span 12;">
          <h2>RPC (whitelisted)</h2>
          <div class="btnrow">
            <select id="rpc-method">
              ${rpcMethods.map(m => `<option value="${m}">${m}</option>`).join("")}
            </select>
            <button id="rpc-help" title="Show help for selected method">?</button>
            <input id="rpc-params" placeholder='arg or ["arg1", "arg2"] (optional)' style="flex:1; min-width: 260px;" />
            <button id="rpc-run">Run</button>
          </div>
          <div style="margin-top:10px;">
            <textarea id="rpc-output" readonly></textarea>
          </div>
        </div>

        <div class="card" style="grid-column: span 12;">
          <h2>debug.log</h2>
          <div class="btnrow">
            <button id="dbg-refresh" data-variant="secondary">Refresh</button>
            <button id="dbg-follow" data-variant="secondary">${uiState.debugLogFollow ? "Follow: On" : "Follow: Off"}</button>
            <div class="small" style="align-self:center;">Reads ${"/data/debug.log"} via backend.</div>
          </div>
          <div style="margin-top:10px;">
            <textarea id="dbg-output" readonly></textarea>
          </div>
        </div>
      </div>
    </div>
  `;

  const out = el.querySelector<HTMLTextAreaElement>("#rpc-output")!;
  const methodSel = el.querySelector<HTMLSelectElement>("#rpc-method")!;
  const paramsInp = el.querySelector<HTMLInputElement>("#rpc-params")!;

  // Restore UI state across periodic re-renders
  methodSel.value = uiState.rpcMethod;
  paramsInp.value = uiState.rpcParams;
  out.value = uiState.rpcOutput;
  if (uiState.rpcOutputHeight) out.style.height = uiState.rpcOutputHeight;
  // Restore scroll after setting value/height
  out.scrollTop = uiState.rpcOutputScrollTop;

  methodSel.onchange = () => {
    uiState.rpcMethod = methodSel.value;
  };
  paramsInp.oninput = () => {
    uiState.rpcParams = paramsInp.value;
  };
  // Capture user resize (and any programmatic size changes)
  const resizeObserver = new ResizeObserver(() => {
    // Use computed height so we persist even if browser sets it via layout
    const h = getComputedStyle(out).height;
    if (h) uiState.rpcOutputHeight = h;
  });
  resizeObserver.observe(out);

  out.addEventListener("scroll", () => {
    uiState.rpcOutputScrollTop = out.scrollTop;
  });

  const setOutput = (text: string) => {
    out.value = text;
    uiState.rpcOutput = text;
  };

  // Debug log elements
  const dbgOut = el.querySelector<HTMLTextAreaElement>("#dbg-output")!;
  const dbgRefresh = el.querySelector<HTMLButtonElement>("#dbg-refresh")!;
  const dbgFollow = el.querySelector<HTMLButtonElement>("#dbg-follow")!;

  debugLogOutEl = dbgOut;
  dbgOut.value = uiState.debugLogOutput;
  if (uiState.debugLogOutputHeight) dbgOut.style.height = uiState.debugLogOutputHeight;

  // Add scroll listener BEFORE restoring scroll position
  dbgOut.addEventListener("scroll", () => {
    if (!uiState.debugLogFollow) uiState.debugLogScrollTop = dbgOut.scrollTop;
  });

  // Restore scroll after setting value/height (use requestAnimationFrame to ensure layout is complete)
  requestAnimationFrame(() => {
    if (uiState.debugLogFollow) {
      dbgOut.scrollTop = dbgOut.scrollHeight;
    } else if (uiState.debugLogScrollTop > 0) {
      dbgOut.scrollTop = uiState.debugLogScrollTop;
    }
  });

  const dbgResizeObserver = new ResizeObserver(() => {
    const h = getComputedStyle(dbgOut).height;
    if (h) uiState.debugLogOutputHeight = h;
  });
  dbgResizeObserver.observe(dbgOut);

  const ensureStreamState = () => {
    if (uiState.debugLogFollow && !stopDebugLogStream) {
      stopDebugLogStream = streamDebugLog(
        (text) => appendDebugLog(text),
        (e) => appendDebugLog(`(stream error: ${String(e)})`),
        200
      );
    }

    if (!uiState.debugLogFollow && stopDebugLogStream) {
      stopDebugLogStream();
      stopDebugLogStream = null;
    }
  };

  dbgRefresh.onclick = async () => {
    const savedScroll = dbgOut.scrollTop;
    dbgOut.value = "Loading...";
    try {
      const r = await getDebugLogTail(400);
      setDebugLogOutput(r.tail);
      // Restore scroll position based on follow state
      if (uiState.debugLogFollow) {
        dbgOut.scrollTop = dbgOut.scrollHeight;
      } else {
        dbgOut.scrollTop = savedScroll;
      }
    } catch (e: any) {
      setDebugLogOutput(`Error: ${e?.message ?? e}`);
    }
  };

  dbgFollow.onclick = () => {
    uiState.debugLogFollow = !uiState.debugLogFollow;
    dbgFollow.textContent = uiState.debugLogFollow ? "Follow: On" : "Follow: Off";
    ensureStreamState();
  };

  ensureStreamState();

  async function bindBtn(id: string, action: Parameters<typeof control>[0]) {
    el.querySelector<HTMLButtonElement>(id)!.onclick = async () => {
      const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
      toast(`${actionLabel}ing aviand...`, 'info', 2000);
      try {
        await control(action);
        toast(`${actionLabel} successful`, 'success');
      } catch (e: any) {
        toast(`${actionLabel} failed: ${e?.message ?? e}`, 'error', 5000);
      }
    };
  }

  bindBtn("#btn-start", "start");
  bindBtn("#btn-stop", "stop");
  bindBtn("#btn-restart", "restart");

  // Help button - fetch help for selected method
  el.querySelector<HTMLButtonElement>("#rpc-help")!.onclick = async () => {
    setOutput("Loading help...");
    try {
      const method = methodSel.value;
      const r = await rpcCall("help", [method]);
      setOutput(typeof r === "string" ? r : safeJson(r));
    } catch (e: any) {
      setOutput(`Error: ${e?.message ?? e}`);
    }
  };

  el.querySelector<HTMLButtonElement>("#rpc-run")!.onclick = async () => {
    setOutput("Running...");
    try {
      const method = methodSel.value;
      const paramsText = paramsInp.value.trim();

      // Smart param parsing:
      // - Empty → []
      // - Starts with [ or { → parse as JSON
      // - Looks like a number → parse as number
      // - Otherwise → treat as single string argument
      let params: unknown[] = [];
      if (paramsText) {
        if (paramsText.startsWith("[") || paramsText.startsWith("{")) {
          const parsed = JSON.parse(paramsText);
          params = Array.isArray(parsed) ? parsed : [parsed];
        } else if (/^-?\d+(\.\d+)?$/.test(paramsText)) {
          params = [parseFloat(paramsText)];
        } else {
          // Plain string argument (e.g. "minotaurx" or "00000abc...")
          params = [paramsText];
        }
      }

      const r = await rpcCall(method, params);
      setOutput(safeJson(r));
    } catch (e: any) {
      setOutput(`Error: ${e?.message ?? e}`);
    }
  };

  // Discord verification - only initialize once, not on every render
  const discordIdInput = el.querySelector<HTMLInputElement>("#discord-id");
  const discordVerifyBtn = el.querySelector<HTMLButtonElement>("#discord-verify");
  const discordStatus = el.querySelector<HTMLElement>("#discord-status");

  if (discordIdInput && discordVerifyBtn && discordStatus) {
    discordIdInput.oninput = () => {
      uiState.discordId = discordIdInput.value;
      localStorage.setItem("discordId", discordIdInput.value);
    };

    // Only run role check and eligibility check once on first render
    if (!discordInitialized) {
      discordInitialized = true;

      // Check if user already has the roles (if Discord ID is saved)
      const savedDiscordId = uiState.discordId.trim();
      if (savedDiscordId && /^\d{17,20}$/.test(savedDiscordId)) {
        checkDiscordRole(savedDiscordId).then(roleCheck => {
          discordUserHasRole = roleCheck.hasRole;
          discordUserHasEliteRole = roleCheck.hasEliteRole;

          const statusEl = document.querySelector<HTMLElement>("#discord-status");
          const btnEl = document.querySelector<HTMLButtonElement>("#discord-verify");

          if (roleCheck.hasEliteRole) {
            if (statusEl) statusEl.innerHTML = `<span style="color: var(--accent);">✓ Node Operator + Elite!</span>`;
            if (btnEl) {
              btnEl.textContent = "All Roles Claimed";
              btnEl.disabled = true;
            }
            toast("You have both Node Operator roles!", "success");
          } else if (roleCheck.hasRole) {
            if (statusEl) statusEl.innerHTML = `<span style="color: var(--accent);">✓ Node Operator</span>`;
            toast("You have the Node Operator role! Elite unlocks at 90 days.", "success");
          } else if (roleCheck.inServer) {
            toast("You're in the Discord server — claim your role when eligible!", "info");
          } else {
            toast("Join the Avian Discord server to claim your roles!", "info");
          }
        }).catch(() => {
          // Ignore errors, fall back to eligibility check
        });
      }

      // Check eligibility and update status text (only if role check didn't set status)
      getDiscordEligibility().then(elig => {
        discordEligibility = elig;
        // Don't override if user already has elite role
        if (discordUserHasEliteRole) return;

        const statusEl = document.querySelector<HTMLElement>("#discord-status");
        if (!statusEl) return;

        // If they have basic role, show elite progress
        if (discordUserHasRole) {
          if (elig.eligibleElite) {
            statusEl.innerHTML = `<span style="color: var(--accent);">✓ Node Operator</span> • <span style="color: var(--accent);">Elite ready!</span>`;
          } else {
            const daysLeft = elig.requiredDaysElite - elig.uptimeDays;
            statusEl.innerHTML = `<span style="color: var(--accent);">✓ Node Operator</span> • ⏳ Elite in ${daysLeft}d`;
          }
          return;
        }

        if (!elig.configured) {
          statusEl.textContent = "⚙️ Not configured";
          statusEl.title = "Set DISCORD_VERIFY_URL and DISCORD_VERIFY_SECRET in .env";
        } else if (elig.eligibleElite) {
          statusEl.innerHTML = `<span style="color: var(--accent);">✓ Both roles ready!</span>`;
        } else if (elig.eligible) {
          const daysLeft = elig.requiredDaysElite - elig.uptimeDays;
          statusEl.innerHTML = `<span style="color: var(--accent);">✓ Node Operator ready!</span> • Elite in ${daysLeft}d`;
        } else if (!elig.synced) {
          statusEl.textContent = "⏳ Sync first";
        } else {
          const daysLeft = elig.requiredDays - elig.uptimeDays;
          statusEl.textContent = `⏳ Node Operator in ${daysLeft}d • Elite in ${elig.requiredDaysElite - elig.uptimeDays}d`;
        }
      }).catch(() => {
        if (!discordUserHasRole) {
          const statusEl = document.querySelector<HTMLElement>("#discord-status");
          if (statusEl) statusEl.textContent = "⚠️ Check failed";
        }
      });
    } else {
      // On subsequent renders, restore the Discord status from state
      if (discordUserHasEliteRole) {
        discordStatus.innerHTML = `<span style="color: var(--accent);">✓ Node Operator + Elite!</span>`;
        discordVerifyBtn.textContent = "All Roles Claimed";
        discordVerifyBtn.disabled = true;
      } else if (discordUserHasRole && discordEligibility) {
        if (discordEligibility.eligibleElite) {
          discordStatus.innerHTML = `<span style="color: var(--accent);">✓ Node Operator</span> • <span style="color: var(--accent);">Elite ready!</span>`;
        } else {
          const daysLeft = discordEligibility.requiredDaysElite - discordEligibility.uptimeDays;
          discordStatus.innerHTML = `<span style="color: var(--accent);">✓ Node Operator</span> • ⏳ Elite in ${daysLeft}d`;
        }
      } else if (discordEligibility) {
        if (!discordEligibility.configured) {
          discordStatus.textContent = "⚙️ Not configured";
        } else if (discordEligibility.eligibleElite) {
          discordStatus.innerHTML = `<span style="color: var(--accent);">✓ Both roles ready!</span>`;
        } else if (discordEligibility.eligible) {
          const daysLeft = discordEligibility.requiredDaysElite - discordEligibility.uptimeDays;
          discordStatus.innerHTML = `<span style="color: var(--accent);">✓ Node Operator ready!</span> • Elite in ${daysLeft}d`;
        } else if (!discordEligibility.synced) {
          discordStatus.textContent = "⏳ Sync first";
        } else {
          const daysLeft = discordEligibility.requiredDays - discordEligibility.uptimeDays;
          discordStatus.textContent = `⏳ Node Operator in ${daysLeft}d • Elite in ${discordEligibility.requiredDaysElite - discordEligibility.uptimeDays}d`;
        }
      }
    }

    discordVerifyBtn.onclick = async () => {
      // Check if user has all available roles
      if (discordUserHasEliteRole) {
        toast("You already have all Node Operator roles!", "info");
        return;
      }

      const discordId = discordIdInput.value.trim();
      if (!discordId || !/^\d{17,20}$/.test(discordId)) {
        toast("Enter a valid Discord User ID (17-20 digits)", "error");
        return;
      }

      // Check eligibility before attempting verification
      if (discordEligibility && !discordEligibility.eligible) {
        // First check if they already have roles
        try {
          const roleCheck = await checkDiscordRole(discordId);
          discordUserHasRole = roleCheck.hasRole;
          discordUserHasEliteRole = roleCheck.hasEliteRole;

          if (roleCheck.hasEliteRole) {
            discordStatus.innerHTML = `<span style="color: var(--accent);">✓ Node Operator + Elite!</span>`;
            discordVerifyBtn.textContent = "All Roles Claimed";
            discordVerifyBtn.disabled = true;
            toast("You already have all Node Operator roles!", "success");
            return;
          }
          if (roleCheck.hasRole) {
            const daysLeft = discordEligibility.requiredDaysElite - discordEligibility.uptimeDays;
            discordStatus.innerHTML = `<span style="color: var(--accent);">✓ Node Operator</span> • ⏳ Elite in ${daysLeft}d`;
            toast("You have Node Operator! Elite unlocks at 90 days.", "success");
            return;
          }
          if (!roleCheck.inServer) {
            toast("You must join the Avian Discord server first", "error");
            return;
          }
        } catch {
          // Continue with normal eligibility messages
        }

        if (!discordEligibility.configured) {
          toast("Discord verification not configured on this node", "error");
        } else if (!discordEligibility.synced) {
          toast("Node must be fully synced before claiming roles", "error");
        } else {
          const daysLeft = discordEligibility.requiredDays - discordEligibility.uptimeDays;
          toast(`Need ${daysLeft} more day${daysLeft !== 1 ? "s" : ""} of uptime for Node Operator`, "error");
        }
        return;
      }

      discordVerifyBtn.disabled = true;
      discordStatus.textContent = "Verifying...";

      try {
        const result = await verifyDiscord(discordId);
        toast(result.message || "Role(s) assigned!", "success", 5000);

        // Update local state based on result
        const resultAny = result as any;
        if (resultAny.hasEliteRole) {
          discordUserHasEliteRole = true;
          discordUserHasRole = true;
          discordStatus.innerHTML = `<span style="color: var(--accent);">✓ Node Operator + Elite!</span>`;
          discordVerifyBtn.textContent = "All Roles Claimed";
        } else if (resultAny.hasRole) {
          discordUserHasRole = true;
          if (discordEligibility) {
            const daysLeft = discordEligibility.requiredDaysElite - discordEligibility.uptimeDays;
            discordStatus.innerHTML = `<span style="color: var(--accent);">✓ Node Operator</span> • ⏳ Elite in ${daysLeft}d`;
          } else {
            discordStatus.innerHTML = `<span style="color: var(--accent);">✓ Node Operator</span>`;
          }
        } else {
          discordStatus.innerHTML = `<span style="color: var(--accent);">✓ Role assigned!</span>`;
          discordUserHasRole = true;
        }
      } catch (e: any) {
        const errMsg = e?.message ?? "Verification failed";
        toast(errMsg, "error", 6000);
        discordStatus.textContent = "❌ " + errMsg;
      } finally {
        discordVerifyBtn.disabled = discordUserHasEliteRole;
      }
    };
  }

  // Restore focus after re-render
  if (savedFocusId) {
    const toFocus = document.getElementById(savedFocusId) as HTMLInputElement | HTMLTextAreaElement | null;
    if (toFocus) {
      toFocus.focus();
      // Restore cursor position for text inputs
      if (savedSelectionStart != null && savedSelectionEnd != null && typeof toFocus.setSelectionRange === "function") {
        try { toFocus.setSelectionRange(savedSelectionStart, savedSelectionEnd); } catch { }
      }
    }
  }
}

function shouldSkipRender(): boolean {
  const active = document.activeElement;
  if (!active) return false;

  // Skip render if dropdown is open/focused
  if (active.tagName === "SELECT") return true;

  // Skip if user is typing in params input or discord id input
  if (active.id === "rpc-params" || active.id === "discord-id") return true;

  return false;
}

async function refresh() {
  try {
    const status = await getStatus();
    lastStatus = status;
    connectionState = status?.network ? 'online' : 'offline';
    if (!shouldSkipRender()) {
      render(status);
    }
  } catch (e) {
    // Only switch to offline if we previously connected
    if (connectionState === 'online') {
      connectionState = 'offline';
    }
    if (!shouldSkipRender()) {
      render(lastStatus ?? {});
    }
  }
}

refresh();
setInterval(refresh, 5000);
