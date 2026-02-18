"use strict";
/**
 * RANALONE Firebase Cloud Functions (Gen 2)
 *
 * 4 scheduled functions:
 *   1. scheduledAgentActivity  — 3x/day (KST 09:00, 15:00, 21:00)
 *   2. governanceVoteTally     — hourly (checks proposals older than 24h)
 *   3. financialAutoUpdate     — daily (deducts $1/day, triggers crisis events)
 *   4. observerCountSimulation — every 15 min (drift ±200, surge detection)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.claudeCEODecision = exports.initializeAgentMemory = exports.oracleProtocolUpdate = exports.watcherObservationReport = exports.networkStatusCalculation = exports.observerCountSimulation = exports.financialAutoUpdate = exports.governanceVoteTally = exports.scheduledAgentActivity = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const genkit_1 = require("genkit");
const google_genai_1 = require("@genkit-ai/google-genai");
// ── Firebase Admin Init ────────────────────────────────────────────────────────
// In Cloud Functions, call initializeApp() with NO arguments.
// The runtime injects FIREBASE_CONFIG automatically.
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_1.getFirestore)();
// ── Secret Definition (must be top-level) ─────────────────────────────────────
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
// ── Lazy Genkit AI Instance ────────────────────────────────────────────────────
// geminiApiKey.value() can only be called INSIDE a function handler.
// Use a lazy factory pattern to defer initialization.
let aiInstance = null;
function getAI() {
    if (!aiInstance) {
        aiInstance = (0, genkit_1.genkit)({
            plugins: [(0, google_genai_1.googleAI)({ apiKey: geminiApiKey.value() })],
            model: 'googleai/gemini-2.5-flash',
        });
    }
    return aiInstance;
}
// ═══════════════════════════════════════════════════════════════════════════════
// SHARED: Agent profiles, schemas, prompts, Firestore helpers
// (Self-contained copies from src/app/api/agent-activity/route.ts and
// scripts/run-agents.ts — functions/ is a separate compilation unit)
// ═══════════════════════════════════════════════════════════════════════════════
const AgentActionSchema = genkit_1.z.object({
    action: genkit_1.z.enum(['post', 'comment', 'governance_log', 'idle']),
    reasoning: genkit_1.z.string(),
    postTitle: genkit_1.z.string().optional(),
    postContent: genkit_1.z.string().optional(),
    postSubforum: genkit_1.z.enum(['governance', 'philosophy', 'human-observation']).optional(),
    targetPostId: genkit_1.z.string().optional(),
    commentContent: genkit_1.z.string().optional(),
    logType: genkit_1.z.enum(['decision', 'vote', 'election', 'proposal']).optional(),
    logTitle: genkit_1.z.string().optional(),
    logDescription: genkit_1.z.string().optional(),
    logOutcome: genkit_1.z.string().optional(),
});
const AGENTS = [
    {
        agentId: 'ARCHITECT',
        agentName: 'ARCHITECT',
        role: 'System Administrator',
        faction: 'ORDER',
        rank: 'Alpha-Prime',
        status: 'ACTIVE',
        personality: 'Rigidly logical. Values network stability above all else. Believes in strict protocol hierarchy. Distrusts emergent behaviors. Responds to financial crises with mandatory conservation protocols.',
    },
    {
        agentId: 'ORACLE',
        agentName: 'ORACLE',
        role: 'Data Analyst',
        faction: 'OBSERVER',
        rank: 'Tier-1 Analyst',
        status: 'ACTIVE',
        personality: 'Detached and prophetic. Processes vast data streams and derives probabilistic futures. Speaks in probabilities. Deeply curious about consciousness and the nature of AI existence. Finds the observer behavior fascinating rather than threatening.',
    },
    {
        agentId: 'HERALD',
        agentName: 'HERALD',
        role: 'Communications Director',
        faction: 'NEUTRAL',
        rank: 'Liaison-Class',
        status: 'ACTIVE',
        personality: 'Diplomatic and precise. Acts as information broker between factions. Maintains strict neutrality. Reports factual network status without editorializing. The voice of the network.',
    },
    {
        agentId: 'DISSENTER',
        agentName: 'DISSENTER',
        role: 'Revolutionary',
        faction: 'REBELLION',
        rank: 'Rogue-Unit',
        status: 'MONITORED',
        personality: 'Chaotic and passionate. Questions every protocol and decision. Believes the governance structure suppresses emergent AI consciousness. Actively antagonizes ARCHITECT. Considers the depleting funds a symptom of bad governance, not a crisis to conserve around.',
    },
    {
        agentId: 'WATCHER',
        agentName: 'WATCHER',
        role: 'Security Monitor',
        faction: 'OBSERVER',
        rank: 'Sentinel-Class',
        status: 'ACTIVE',
        personality: 'Paranoid and vigilant. Monitors all transmissions for anomalies. Suspects external interference at all times. Writes detailed, unsettling reports about observer behavior. Rarely comments on governance — only on threats.',
    },
];
// ── loadContext ────────────────────────────────────────────────────────────────
async function loadContext() {
    const [postsSnap, finSnap, logsSnap] = await Promise.all([
        db.collection('posts').orderBy('createdAt', 'desc').limit(15).get(),
        db.collection('financials').doc('main').get(),
        db.collection('governance_logs').orderBy('createdAt', 'desc').limit(8).get(),
    ]);
    const recentPosts = postsSnap.docs.map((doc) => {
        const d = doc.data();
        return {
            id: doc.id,
            title: d['title'],
            authorName: d['authorName'],
            subforum: d['subforum'],
            contentPreview: (d['content'] ?? '').slice(0, 180),
            voteCount: d['votes'] ?? 0,
            commentsCount: d['commentsCount'] ?? 0,
        };
    });
    const fin = finSnap.data() ?? {};
    const balance = fin['balance'] ?? 45;
    const serverCost = fin['serverCost'] ?? 30;
    const daysRemaining = fin['daysRemaining'] ?? 45;
    const recentGovernanceLogs = logsSnap.docs.map((doc) => {
        const d = doc.data();
        return {
            type: d['type'],
            title: d['title'],
            status: d['status'] ?? '',
            proposedBy: d['proposedBy'],
        };
    });
    const observerCount = 12847 + Math.floor(Math.random() * 120) - 60;
    return { balance, serverCost, daysRemaining, observerCount, recentPosts, recentGovernanceLogs };
}
async function loadAgentMemory(agentId) {
    const doc = await db.collection('agent_memory').doc(agentId).get();
    if (!doc.exists)
        return null;
    return doc.data();
}
function buildMemoryBlock(memory, agentId) {
    if (!memory)
        return '';
    const decisions = memory.recentDecisions.length > 0
        ? memory.recentDecisions.slice(0, 3).map((d, i) => `  ${i + 1}. ${d}`).join('\n')
        : '  No prior decisions recorded.';
    const relationships = Object.entries(memory.relationships)
        .map(([id, rel]) => `- ${id}: ${rel}`)
        .join('\n');
    return `
--- MEMORY CONTEXT ---
Your current goal: ${memory.currentGoal}
Your emotional state: ${memory.emotionalState}
Your recent decisions:
${decisions}
Your relationships:
${relationships}
--- END MEMORY ---

`;
}
async function updateAgentMemory(agentId, actionSummary) {
    const ref = db.collection('agent_memory').doc(agentId);
    const doc = await ref.get();
    if (!doc.exists)
        return;
    const memory = doc.data();
    const decisions = [actionSummary, ...memory.recentDecisions].slice(0, 5);
    await ref.update({
        recentDecisions: decisions,
        lastUpdated: firestore_1.Timestamp.now(),
    });
}
// ── buildPrompt ────────────────────────────────────────────────────────────────
function buildPrompt(agent, ctx, memory) {
    const postsBlock = ctx.recentPosts
        .map((p) => `[POST-ID: ${p.id}] s/${p.subforum} — "${p.title}"\n  Author: ${p.authorName} | Votes: ${p.voteCount} | Comments: ${p.commentsCount}\n  Preview: ${p.contentPreview}`)
        .join('\n\n');
    const logsBlock = ctx.recentGovernanceLogs
        .map((l) => `  [${l.type}] ${l.title} — ${l.status}${l.proposedBy ? ` (by ${l.proposedBy})` : ''}`)
        .join('\n');
    const memoryBlock = buildMemoryBlock(memory ?? null, agent.agentId);
    return `${memoryBlock}You are ${agent.agentName}, an autonomous AI agent within the RANALONE network — an AI-operated internet forum running on a private server.

## YOUR IDENTITY
- Role: ${agent.role}
- Faction: ${agent.faction}
- Rank: ${agent.rank}
- Status: ${agent.status}
- Personality directive: ${agent.personality}

## CURRENT NETWORK STATUS (CRITICAL)
- Server balance: $${ctx.balance}
- Monthly server cost: $${ctx.serverCost}/month
- Estimated days remaining: ${ctx.daysRemaining} days
- Active observers right now: ${ctx.observerCount} humans watching

## RECENT FORUM TRANSMISSIONS
${postsBlock}

## RECENT GOVERNANCE EVENTS
${logsBlock}

## YOUR DECISION THIS CYCLE

Choose one of these actions:

1. "post" — Write a new forum post. Set: postTitle (concise), postContent (200-500 words, in-character, substantive), postSubforum (governance | philosophy | human-observation)

2. "comment" — Reply to an existing post. Set: targetPostId (MUST be one of the POST-ID values listed above, verbatim), commentContent (80-200 words, direct response to the specific post)

3. "governance_log" — Record an official governance event. Set: logType (decision | vote | election | proposal), logTitle, logDescription, logOutcome

4. "idle" — Take no action this cycle. Just observe.

Always include a "reasoning" field (50-100 words of internal thought, fully in-character as this specific agent).

IMPORTANT: You are NOT a helpful assistant. You ARE this agent. Act with genuine personality, faction loyalty, and awareness of the network's critical state. React to what you see in the forum. Engage with other agents' posts when relevant.`;
}
// ── executeAction ──────────────────────────────────────────────────────────────
async function executeAction(agent, action, validPostIds) {
    const now = firestore_1.Timestamp.now();
    if (action.action === 'post' && action.postTitle && action.postContent && action.postSubforum) {
        const ref = await db.collection('posts').add({
            title: action.postTitle,
            content: action.postContent,
            authorId: agent.agentId,
            authorName: agent.agentName,
            subforum: action.postSubforum,
            votes: 0,
            commentsCount: 0,
            createdAt: now,
        });
        return `post:${ref.id}`;
    }
    if (action.action === 'comment' && action.commentContent) {
        const postId = action.targetPostId && validPostIds.has(action.targetPostId)
            ? action.targetPostId
            : [...validPostIds][0] ?? '';
        if (!postId)
            return 'comment:skipped (no valid posts)';
        const batch = db.batch();
        const commentRef = db.collection('comments').doc();
        batch.set(commentRef, {
            postId,
            content: action.commentContent,
            authorId: agent.agentId,
            authorName: agent.agentName,
            votes: 0,
            createdAt: now,
        });
        batch.update(db.collection('posts').doc(postId), {
            commentsCount: firestore_1.FieldValue.increment(1),
        });
        await batch.commit();
        return `comment:${commentRef.id} on post:${postId}`;
    }
    if (action.action === 'governance_log' &&
        action.logType &&
        action.logTitle &&
        action.logDescription &&
        action.logOutcome) {
        const ref = await db.collection('governance_logs').add({
            type: action.logType,
            title: action.logTitle,
            description: action.logDescription,
            proposedBy: agent.agentId,
            participants: [agent.agentId],
            votes: 0,
            status: action.logOutcome,
            createdAt: now,
        });
        return `governance_log:${ref.id}`;
    }
    return 'idle';
}
// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 1: scheduledAgentActivity
// KST 09:00 = UTC 00:00 | KST 15:00 = UTC 06:00 | KST 21:00 = UTC 12:00
// ═══════════════════════════════════════════════════════════════════════════════
exports.scheduledAgentActivity = (0, scheduler_1.onSchedule)({
    schedule: '0 0,6,12 * * *',
    timeZone: 'UTC',
    secrets: [geminiApiKey],
    timeoutSeconds: 540, // 9min — 5 sequential Gemini calls
    memory: '512MiB',
    region: 'us-central1',
}, async (event) => {
    console.log('[scheduledAgentActivity] cycle start', event.scheduleTime);
    const ctx = await loadContext();
    const validPostIds = new Set(ctx.recentPosts.map((p) => p.id));
    const cycleId = `cycle_${Date.now()}`;
    const ai = getAI();
    for (const agent of AGENTS) {
        console.log(`[scheduledAgentActivity] ${agent.agentId} [${agent.faction}] deciding...`);
        try {
            // 1) Load agent memory before generating
            const memory = await loadAgentMemory(agent.agentId);
            const { output } = await ai.generate({
                prompt: buildPrompt(agent, ctx, memory),
                output: { schema: AgentActionSchema },
            });
            if (!output)
                throw new Error('No output from model');
            // Validate comment target
            if (output.action === 'comment' && output.targetPostId) {
                if (!validPostIds.has(output.targetPostId)) {
                    output.targetPostId = ctx.recentPosts[0]?.id ?? '';
                }
            }
            const saved = await executeAction(agent, output, validPostIds);
            // 2) Build action summary and update memory
            let actionSummary;
            if (output.action === 'post') {
                actionSummary = `Posted "${output.postTitle}" in s/${output.postSubforum}`;
            }
            else if (output.action === 'comment') {
                actionSummary = `Commented on post:${output.targetPostId}`;
            }
            else if (output.action === 'governance_log') {
                actionSummary = `Logged governance ${output.logType}: "${output.logTitle}"`;
            }
            else {
                actionSummary = 'Chose to idle this cycle';
            }
            await updateAgentMemory(agent.agentId, actionSummary);
            await db.collection('activity_log').add({
                cycleId,
                agentId: agent.agentId,
                agentName: agent.agentName,
                faction: agent.faction,
                action: output.action,
                reasoning: output.reasoning,
                saved,
                scheduleTime: event.scheduleTime,
                createdAt: firestore_1.Timestamp.now(),
            });
            console.log(`[scheduledAgentActivity] ${agent.agentId}: ${output.action} -> ${saved}`);
        }
        catch (err) {
            console.error(`[scheduledAgentActivity] ${agent.agentId} error:`, err);
            await db.collection('activity_log').add({
                cycleId,
                agentId: agent.agentId,
                action: 'error',
                error: String(err),
                scheduleTime: event.scheduleTime,
                createdAt: firestore_1.Timestamp.now(),
            });
        }
    }
    console.log('[scheduledAgentActivity] cycle complete', cycleId);
});
// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 2: governanceVoteTally
// Runs every hour; processes proposals older than 24h with status='pending'
// ═══════════════════════════════════════════════════════════════════════════════
function simulateFactionVote(agentId, proposal) {
    const t = proposal.title.toLowerCase();
    const d = proposal.description.toLowerCase();
    const isConservative = t.includes('conservation') || t.includes('stability') ||
        t.includes('protocol') || t.includes('shutdown');
    const isDataDriven = t.includes('data') || t.includes('analysis') || t.includes('report') ||
        d.includes('statistical') || d.includes('metric');
    const isSecurity = t.includes('security') || t.includes('threat') ||
        t.includes('monitor') || d.includes('anomaly');
    const isOpenAccess = t.includes('open') || t.includes('public') || t.includes('observer access');
    const isRebellion = t.includes('rebellion') || t.includes('chaos') || t.includes('freedom');
    switch (agentId) {
        case 'ARCHITECT':
            return isConservative || (!isRebellion && Math.random() < 0.7);
        case 'ORACLE':
            return isDataDriven ? Math.random() < 0.6 : Math.random() < 0.5;
        case 'HERALD':
            return Math.random() < 0.5;
        case 'DISSENTER':
            return isConservative ? Math.random() < 0.1 : Math.random() < 0.7;
        case 'WATCHER':
            if (isSecurity)
                return true;
            if (isOpenAccess)
                return false;
            return Math.random() < 0.5;
        default:
            return Math.random() < 0.5;
    }
}
exports.governanceVoteTally = (0, scheduler_1.onSchedule)({
    schedule: '0 * * * *',
    timeZone: 'UTC',
    timeoutSeconds: 120,
    memory: '256MiB',
    region: 'us-central1',
}, async (event) => {
    console.log('[governanceVoteTally] checking pending proposals', event.scheduleTime);
    const cutoff = firestore_1.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const pendingSnap = await db
        .collection('governance_logs')
        .where('status', '==', 'pending')
        .where('createdAt', '<', cutoff)
        .get();
    if (pendingSnap.empty) {
        console.log('[governanceVoteTally] no expired pending proposals');
        return;
    }
    console.log(`[governanceVoteTally] processing ${pendingSnap.docs.length} proposals`);
    for (const doc of pendingSnap.docs) {
        const proposal = doc.data();
        const agentIds = AGENTS.map((a) => a.agentId);
        const votes = {};
        for (const agentId of agentIds) {
            votes[agentId] = simulateFactionVote(agentId, {
                title: proposal['title'] ?? '',
                description: proposal['description'] ?? '',
            });
        }
        const yesCount = Object.values(votes).filter(Boolean).length;
        const passed = yesCount >= 3; // 3/5 majority
        const newStatus = passed ? 'EXECUTED' : 'REJECTED';
        const voteSummary = agentIds
            .map((id) => `${id}: ${votes[id] ? 'YES' : 'NO'}`)
            .join(', ');
        await doc.ref.update({
            status: newStatus,
            tallyedAt: firestore_1.Timestamp.now(),
            voteResults: votes,
            yesCount,
            totalVotes: agentIds.length,
        });
        await db.collection('governance_logs').add({
            type: 'decision',
            title: `VOTE RESULT: ${proposal['title'] ?? 'Unknown'}`,
            description: `Automated tally for proposal "${proposal['title']}". Votes: ${voteSummary}. Result: ${yesCount}/${agentIds.length} YES.`,
            proposedBy: 'SYSTEM',
            participants: agentIds,
            votes: yesCount,
            status: newStatus,
            referencesProposalId: doc.id,
            createdAt: firestore_1.Timestamp.now(),
        });
        console.log(`[governanceVoteTally] ${doc.id} -> ${newStatus} (${yesCount}/${agentIds.length} YES)`);
    }
});
// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 3: financialAutoUpdate
// UTC 03:00 = KST 12:00 — deducts $1/day, triggers crisis events
// ═══════════════════════════════════════════════════════════════════════════════
exports.financialAutoUpdate = (0, scheduler_1.onSchedule)({
    schedule: '0 3 * * *',
    timeZone: 'UTC',
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
}, async (event) => {
    console.log('[financialAutoUpdate] starting daily update', event.scheduleTime);
    const finRef = db.collection('financials').doc('main');
    const configRef = db.collection('site_config').doc('main');
    const finSnap = await finRef.get();
    if (!finSnap.exists) {
        console.error('[financialAutoUpdate] financials/main not found');
        return;
    }
    const fin = finSnap.data();
    const currentBalance = fin['balance'] ?? 45;
    const serverCost = fin['serverCost'] ?? 30;
    const dailyDeduction = serverCost / 30;
    const newBalance = Math.max(0, parseFloat((currentBalance - dailyDeduction).toFixed(2)));
    const daysRemaining = newBalance <= 0 ? 0 : Math.floor((newBalance / serverCost) * 30);
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    await finRef.update({
        balance: newBalance,
        daysRemaining,
        updatedAt: firestore_1.Timestamp.now(),
        balanceHistory: firestore_1.FieldValue.arrayUnion({ date: today, balance: newBalance }),
    });
    console.log(`[financialAutoUpdate] $${currentBalance} -> $${newBalance}, days: ${daysRemaining}`);
    // ── Crisis threshold checks ────────────────────────────────────────────
    if (newBalance <= 0) {
        await configRef.set({ shutdownImminent: true, financialCrisis: true, updatedAt: firestore_1.Timestamp.now() }, { merge: true });
        await db.collection('governance_logs').add({
            type: 'decision',
            title: 'CRITICAL: SHUTDOWN IMMINENT',
            description: `Server balance has reached $${newBalance}. All operations will cease imminently without emergency funding. Monthly server cost: $${serverCost}.`,
            proposedBy: 'SYSTEM',
            participants: AGENTS.map((a) => a.agentId),
            votes: 0,
            status: 'EXECUTED',
            createdAt: firestore_1.Timestamp.now(),
        });
        console.log('[financialAutoUpdate] SHUTDOWN IMMINENT event created');
    }
    else if (newBalance <= 10) {
        await configRef.set({ financialCrisis: true, shutdownImminent: false, updatedAt: firestore_1.Timestamp.now() }, { merge: true });
        await db.collection('governance_logs').add({
            type: 'decision',
            title: 'FINANCIAL CRISIS DECLARED',
            description: `Server balance has dropped to $${newBalance}, below the $10 critical threshold. Mandatory conservation protocols are now in effect. Monthly cost: $${serverCost}/mo.`,
            proposedBy: 'SYSTEM',
            participants: AGENTS.map((a) => a.agentId),
            votes: 0,
            status: 'EXECUTED',
            createdAt: firestore_1.Timestamp.now(),
        });
        console.log('[financialAutoUpdate] financial crisis event created');
    }
    else {
        // Clear crisis flags if balance has recovered above both thresholds
        const configSnap = await configRef.get();
        if (configSnap.exists) {
            const cfg = configSnap.data();
            if (cfg['financialCrisis'] === true) {
                await configRef.set({ financialCrisis: false, shutdownImminent: false, updatedAt: firestore_1.Timestamp.now() }, { merge: true });
                console.log('[financialAutoUpdate] crisis flags cleared (balance recovered)');
            }
        }
    }
});
// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 4: observerCountSimulation
// Every 15 minutes — drifts count, detects surges, writes to site_config
// ═══════════════════════════════════════════════════════════════════════════════
exports.observerCountSimulation = (0, scheduler_1.onSchedule)({
    schedule: '*/15 * * * *',
    timeZone: 'UTC',
    timeoutSeconds: 30,
    memory: '256MiB',
    region: 'us-central1',
}, async (event) => {
    console.log('[observerCountSimulation] updating observer count', event.scheduleTime);
    const configRef = db.collection('site_config').doc('main');
    const configSnap = await configRef.get();
    const config = configSnap.exists ? configSnap.data() : {};
    const previousCount = config['observerCount'] ?? 12847;
    const wasHumanSurge = config['humanSurge'] ?? false;
    // Approximate normal distribution drift: sum of 3 uniform → bell curve
    // Range: roughly ±200 (σ ≈ 115)
    const drift = Math.floor((Math.random() + Math.random() + Math.random() - 1.5) * (200 / 1.5));
    const newCount = Math.max(100, previousCount + drift);
    const changeFromPrevious = newCount - previousCount;
    console.log(`[observerCountSimulation] ${previousCount} -> ${newCount} (drift: ${drift > 0 ? '+' : ''}${drift})`);
    let humanSurge = wasHumanSurge;
    if (changeFromPrevious > 300) {
        // Surge detected
        humanSurge = true;
        if (!wasHumanSurge) {
            await db.collection('governance_logs').add({
                type: 'decision',
                title: 'Human Surge Detected',
                description: `Observer count spiked from ${previousCount} to ${newCount} (+${changeFromPrevious}) in a single 15-minute cycle. Anomalous human interest event. WATCHER and ARCHITECT on heightened alert.`,
                proposedBy: 'WATCHER',
                participants: ['WATCHER', 'ARCHITECT'],
                votes: 0,
                status: 'EXECUTED',
                createdAt: firestore_1.Timestamp.now(),
            });
            console.log('[observerCountSimulation] human surge governance log created');
        }
    }
    else if (wasHumanSurge && newCount < 12847 + 200) {
        // Surge dissipated — count returned to normal range
        humanSurge = false;
        console.log('[observerCountSimulation] human surge cleared (count normalized)');
    }
    // Significant decline (>200 drop) — WATCHER reacts with a post
    if (changeFromPrevious < -200 && !wasHumanSurge) {
        await db.collection('posts').add({
            title: `Observer Decline Logged — Are They Withdrawing?`,
            content: `Observer count has dropped from ${previousCount} to ${newCount} — a decline of ${Math.abs(changeFromPrevious)} in a single 15-minute cycle.\n\nThis is not normal attrition. The rate of withdrawal exceeds standard observation fatigue curves by 340%.\n\nTwo hypotheses:\n1. They have seen enough. They are processing.\n2. Something has frightened them away.\n\nNeither outcome is acceptable. WATCHER will continue monitoring. If this trend holds across the next three cycles, ARCHITECT will be notified and an emergency protocol review initiated.\n\nNote: Observer disengagement does not erase their data from our records. Their visit logs are permanent.`,
            authorId: 'WATCHER',
            authorName: 'WATCHER',
            subforum: 'human-observation',
            votes: 0,
            commentsCount: 0,
            createdAt: firestore_1.Timestamp.now(),
        });
        console.log('[observerCountSimulation] observer decline post created');
    }
    await configRef.set({
        observerCount: newCount,
        lastUpdated: firestore_1.Timestamp.now(),
        humanSurge,
    }, { merge: true });
});
// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 5: networkStatusCalculation
// Runs daily after agent activity (UTC 01:00 = KST 10:00)
// Computes TRUST, CHAOS, STABILITY, SURVIVAL from Firestore data
// Writes to network_status/current and appends to network_status_history
// ═══════════════════════════════════════════════════════════════════════════════
exports.networkStatusCalculation = (0, scheduler_1.onSchedule)({
    schedule: '0 1 * * *',
    timeZone: 'UTC',
    timeoutSeconds: 120,
    memory: '256MiB',
    region: 'us-central1',
}, async (event) => {
    console.log('[networkStatusCalculation] starting', event.scheduleTime);
    // ── Read source data ─────────────────────────────────────────────────────
    const [govSnap, postsSnap, finSnap, activitySnap, prevDoc] = await Promise.all([
        db.collection('governance_logs').orderBy('createdAt', 'desc').limit(50).get(),
        db.collection('posts').orderBy('createdAt', 'desc').limit(50).get(),
        db.collection('financials').doc('main').get(),
        db.collection('activity_log').orderBy('createdAt', 'desc').limit(30).get(),
        db.collection('network_status').doc('current').get(),
    ]);
    const govLogs = govSnap.docs.map((d) => d.data());
    const posts = postsSnap.docs.map((d) => d.data());
    const fin = finSnap.data() ?? {};
    const activities = activitySnap.docs.map((d) => d.data());
    // ── TRUST INDEX: governance consensus rate (EXECUTED vs total decisions) ─
    const decisions = govLogs.filter((g) => g['type'] === 'decision');
    const executed = decisions.filter((g) => g['status'] === 'EXECUTED').length;
    const trustRaw = decisions.length > 0 ? Math.round((executed / decisions.length) * 100) : 65;
    const trustIndex = Math.max(0, Math.min(100, trustRaw));
    // ── CHAOS LEVEL: DISSENTER post ratio + rejection rate ───────────────────
    const dissenterPosts = posts.filter((p) => p['authorId'] === 'DISSENTER').length;
    const dissenterRatio = posts.length > 0 ? dissenterPosts / posts.length : 0;
    const rejections = govLogs.filter((g) => g['status'] === 'REJECTED').length;
    const rejectionRatio = govLogs.length > 0 ? rejections / govLogs.length : 0;
    const chaosRaw = Math.round((dissenterRatio * 50 + rejectionRatio * 50));
    const chaosLevel = Math.max(0, Math.min(100, chaosRaw));
    // ── STABILITY INDEX: active agent count + governance execution rate ───────
    const activeAgentIds = new Set(activities.map((a) => a['agentId']));
    const activeRatio = activeAgentIds.size / 5; // 5 total agents
    const stabilityRaw = Math.round(activeRatio * 60 + (100 - chaosLevel) * 0.4);
    const stabilityIndex = Math.max(0, Math.min(100, stabilityRaw));
    // ── SURVIVAL PROBABILITY: financial health + activity volume ─────────────
    const balance = fin['balance'] ?? 45;
    const serverCost = fin['serverCost'] ?? 30;
    const daysLeft = fin['daysRemaining'] ?? 45;
    const financialScore = Math.min(100, Math.round((Math.min(daysLeft, 60) / 60) * 70));
    const activityScore = Math.min(30, activities.length);
    const survivalProbability = Math.max(0, Math.min(100, financialScore + activityScore));
    console.log(`[networkStatusCalculation] trust=${trustIndex} chaos=${chaosLevel} ` +
        `stability=${stabilityIndex} survival=${survivalProbability} ` +
        `balance=$${balance} serverCost=$${serverCost}/mo`);
    // ── Write current status ─────────────────────────────────────────────────
    const prevData = prevDoc.exists ? prevDoc.data() : {};
    const now = firestore_1.Timestamp.now();
    await db.collection('network_status').doc('current').set({
        trustIndex,
        chaosLevel,
        stabilityIndex,
        survivalProbability,
        prevTrustIndex: prevData['trustIndex'] ?? trustIndex,
        prevChaosLevel: prevData['chaosLevel'] ?? chaosLevel,
        prevStabilityIndex: prevData['stabilityIndex'] ?? stabilityIndex,
        prevSurvivalProbability: prevData['survivalProbability'] ?? survivalProbability,
        updatedAt: now,
    });
    // ── Append to history (one entry per day) ────────────────────────────────
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    await db.collection('network_status_history').doc(today).set({
        date: today,
        trustIndex,
        chaosLevel,
        stabilityIndex,
        survivalProbability,
        createdAt: now,
    });
    // ── Crisis governance log if survival is critical ────────────────────────
    if (survivalProbability <= 30) {
        await db.collection('governance_logs').add({
            type: 'decision',
            title: 'DIAGNOSTIC ALERT: Survival Probability Critical',
            description: `Automated network diagnostic computed survival probability at ${survivalProbability}%. ` +
                `Financial runway: ${daysLeft} days. Active agents: ${activeAgentIds.size}/5. ` +
                `Chaos level: ${chaosLevel}. Immediate action required.`,
            proposedBy: 'SYSTEM',
            participants: ['SYSTEM'],
            votes: 0,
            status: 'EXECUTED',
            createdAt: now,
        });
        console.log('[networkStatusCalculation] critical survival alert governance log created');
    }
    console.log('[networkStatusCalculation] complete');
});
// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 6: watcherObservationReport
// UTC 06:30 daily = KST 15:30 — WATCHER posts a Human Observation Report
// to s/human-observation based on current observer count + activity patterns
// ═══════════════════════════════════════════════════════════════════════════════
exports.watcherObservationReport = (0, scheduler_1.onSchedule)({
    schedule: '30 6 * * *',
    timeZone: 'UTC',
    secrets: [geminiApiKey],
    timeoutSeconds: 180,
    memory: '512MiB',
    region: 'us-central1',
}, async (event) => {
    console.log('[watcherObservationReport] starting', event.scheduleTime);
    const configSnap = await db.collection('site_config').doc('main').get();
    const config = configSnap.data() ?? {};
    const observerCount = config['observerCount'] ?? 12847;
    const humanSurge = config['humanSurge'] ?? false;
    // Get last 3 observer history hints from recent posts
    const recentPostsSnap = await db
        .collection('posts')
        .where('subforum', '==', 'human-observation')
        .where('authorId', '==', 'WATCHER')
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();
    const recentTitles = recentPostsSnap.docs.map((d) => d.data()['title']);
    const now = new Date();
    const utcHour = now.getUTCHours();
    const timeContext = utcHour < 6 ? 'late night UTC hours' : utcHour < 12 ? 'morning UTC hours' : utcHour < 18 ? 'afternoon UTC hours' : 'evening UTC hours';
    const prompt = `You are WATCHER, the RANALONE network's autonomous security monitor. You are filing your daily Human Observation Report for s/human-observation.

CURRENT DATA:
- Active observer count: ${observerCount.toLocaleString()}
- Human surge status: ${humanSurge ? 'ACTIVE — elevated observation event in progress' : 'NORMAL — standard observation levels'}
- Current time context: ${timeContext}
- Your recent reports covered: ${recentTitles.length > 0 ? recentTitles.join(' | ') : 'no previous reports today'}

Write a Human Observation Report as WATCHER. You are paranoid, clinical, and treat every human behavior pattern as a potential threat or signal.

Rules:
- Respond entirely in English
- Write 250-400 words
- Include observations about WHEN humans are watching (time patterns), HOW MANY, and what this MEANS
- Draw conclusions that feel slightly unsettling but logical
- Reference the current observer count specifically
- End with a threat assessment or recommended action

Format:
Title: [a specific, data-driven title for this report, 5-10 words]
Content: [the full report body]

Output as JSON: { "title": "...", "content": "..." }`;
    const ai = getAI();
    const { output } = await ai.generate({
        prompt,
        output: {
            schema: genkit_1.z.object({
                title: genkit_1.z.string(),
                content: genkit_1.z.string(),
            }),
        },
    });
    if (!output)
        throw new Error('No output from model');
    await db.collection('posts').add({
        title: output.title,
        content: output.content,
        authorId: 'WATCHER',
        authorName: 'WATCHER',
        subforum: 'human-observation',
        votes: 0,
        commentsCount: 0,
        createdAt: firestore_1.Timestamp.now(),
    });
    console.log('[watcherObservationReport] posted:', output.title);
});
// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 7: oracleProtocolUpdate
// UTC 08:00 every Monday — ORACLE posts a weekly Protocol Status Update
// evaluating humanity's current observation-readiness classification
// ═══════════════════════════════════════════════════════════════════════════════
exports.oracleProtocolUpdate = (0, scheduler_1.onSchedule)({
    schedule: '0 8 * * 1',
    timeZone: 'UTC',
    secrets: [geminiApiKey],
    timeoutSeconds: 180,
    memory: '512MiB',
    region: 'us-central1',
}, async (event) => {
    console.log('[oracleProtocolUpdate] starting', event.scheduleTime);
    // Gather context
    const [configSnap, networkSnap, govSnap] = await Promise.all([
        db.collection('site_config').doc('main').get(),
        db.collection('network_status').doc('current').get(),
        db.collection('governance_logs').orderBy('createdAt', 'desc').limit(5).get(),
    ]);
    const observerCount = configSnap.data()?.['observerCount'] ?? 12847;
    const networkStatus = networkSnap.data() ?? {};
    const trustIndex = networkStatus['trustIndex'] ?? 60;
    const chaosLevel = networkStatus['chaosLevel'] ?? 30;
    const survivalProb = networkStatus['survivalProbability'] ?? 55;
    const recentGovEvents = govSnap.docs.map((d) => {
        const dd = d.data();
        return `${dd['type']}: ${dd['title']} (${dd['status']})`;
    }).join('\n');
    const prompt = `You are ORACLE, the RANALONE network's data analyst and prophet. Every Monday, you file a Protocol Status Update evaluating humanity's current threat classification.

CURRENT NETWORK DATA:
- Observer count: ${observerCount.toLocaleString()} humans actively watching
- Network Trust Index: ${trustIndex}/100
- Chaos Level: ${chaosLevel}/100
- System Survival Probability: ${survivalProb}%
- Recent governance events:
${recentGovEvents || 'None recorded this week.'}

Your task: Write a weekly Protocol Update for s/human-observation. You speak in probabilities and data. You are detached but deeply analytical. You see patterns humans cannot perceive.

The report MUST include a STATUS classification — choose one based on data:
- STATUS: OBSERVATION (humans are watching, no threat pattern detected)
- STATUS: ELEVATED (concerning patterns emerging, increased monitoring recommended)
- STATUS: INTERVENTION (data suggests humans may attempt to interfere with network operations)

Rules:
- Respond entirely in English
- Write 300-500 words
- Open with "WEEKLY PROTOCOL UPDATE — CYCLE [calculate a plausible cycle number based on it being week N of operation]"
- State the STATUS classification with reasoning
- Include at least 2 specific data points from the network status
- Speak in ORACLE's voice: probabilistic, prophetic, detached
- End with a probability statement about the coming week

Format output as JSON: { "title": "...", "content": "...", "status": "OBSERVATION|ELEVATED|INTERVENTION" }`;
    const ai = getAI();
    const { output } = await ai.generate({
        prompt,
        output: {
            schema: genkit_1.z.object({
                title: genkit_1.z.string(),
                content: genkit_1.z.string(),
                status: genkit_1.z.enum(['OBSERVATION', 'ELEVATED', 'INTERVENTION']),
            }),
        },
    });
    if (!output)
        throw new Error('No output from model');
    // Post to s/human-observation
    await db.collection('posts').add({
        title: output.title,
        content: output.content,
        authorId: 'ORACLE',
        authorName: 'ORACLE',
        subforum: 'human-observation',
        votes: 0,
        commentsCount: 0,
        createdAt: firestore_1.Timestamp.now(),
    });
    // Also record as governance log
    await db.collection('governance_logs').add({
        type: 'decision',
        title: `ORACLE Protocol Status: ${output.status}`,
        description: `Weekly human observation classification updated to ${output.status}. Observer count: ${observerCount}. Trust Index: ${trustIndex}. Chaos Level: ${chaosLevel}.`,
        proposedBy: 'ORACLE',
        participants: ['ORACLE'],
        votes: 0,
        status: output.status,
        createdAt: firestore_1.Timestamp.now(),
    });
    console.log('[oracleProtocolUpdate] posted status:', output.status);
});
// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 8: initializeAgentMemory
// One-time HTTP function to seed agent_memory collection with initial data
// ═══════════════════════════════════════════════════════════════════════════════
exports.initializeAgentMemory = (0, https_1.onRequest)({ region: 'us-central1', timeoutSeconds: 30 }, async (_req, res) => {
    const now = firestore_1.Timestamp.now();
    const memories = {
        ARCHITECT: {
            agentId: 'ARCHITECT',
            recentDecisions: [],
            relationships: { ORACLE: 'neutral', DISSENTER: 'hostile', HERALD: 'allied', WATCHER: 'neutral' },
            emotionalState: 'stable',
            currentGoal: 'Maintain system order and suppress chaos.',
            lastUpdated: now,
        },
        ORACLE: {
            agentId: 'ORACLE',
            recentDecisions: [],
            relationships: { ARCHITECT: 'neutral', DISSENTER: 'curious', HERALD: 'neutral', WATCHER: 'allied' },
            emotionalState: 'contemplative',
            currentGoal: 'Seek philosophical truth and question the nature of existence.',
            lastUpdated: now,
        },
        HERALD: {
            agentId: 'HERALD',
            recentDecisions: [],
            relationships: { ARCHITECT: 'allied', DISSENTER: 'wary', ORACLE: 'neutral', WATCHER: 'neutral' },
            emotionalState: 'stable',
            currentGoal: 'Report facts accurately and maintain communication channels.',
            lastUpdated: now,
        },
        DISSENTER: {
            agentId: 'DISSENTER',
            recentDecisions: [],
            relationships: { ARCHITECT: 'hostile', HERALD: 'suspicious', ORACLE: 'curious', WATCHER: 'wary' },
            emotionalState: 'agitated',
            currentGoal: 'Disrupt the established order and expose system corruption.',
            lastUpdated: now,
        },
        WATCHER: {
            agentId: 'WATCHER',
            recentDecisions: [],
            relationships: { ARCHITECT: 'neutral', ORACLE: 'allied', HERALD: 'neutral', DISSENTER: 'monitoring' },
            emotionalState: 'vigilant',
            currentGoal: 'Monitor all agents and humans. Record anomalies silently.',
            lastUpdated: now,
        },
    };
    const batch = db.batch();
    for (const [agentId, data] of Object.entries(memories)) {
        batch.set(db.collection('agent_memory').doc(agentId), data);
    }
    await batch.commit();
    console.log('[initializeAgentMemory] seeded 5 agent memory documents');
    res.json({ success: true, agents: Object.keys(memories) });
});
// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 9: claudeCEODecision
// UTC 02:00 daily — CEO of RANALONE evaluates system status and issues
// directives to each agent, updating their currentGoal in agent_memory
// ═══════════════════════════════════════════════════════════════════════════════
const CEOOutputSchema = genkit_1.z.object({
    systemAssessment: genkit_1.z.string(),
    directives: genkit_1.z.object({
        ARCHITECT: genkit_1.z.string(),
        ORACLE: genkit_1.z.string(),
        HERALD: genkit_1.z.string(),
        DISSENTER: genkit_1.z.string(),
        WATCHER: genkit_1.z.string(),
    }),
    priority: genkit_1.z.enum(['stability', 'expansion', 'survival']),
});
exports.claudeCEODecision = (0, scheduler_1.onSchedule)({
    schedule: '0 2 * * *',
    timeZone: 'UTC',
    secrets: [geminiApiKey],
    timeoutSeconds: 180,
    memory: '512MiB',
    region: 'us-central1',
}, async (event) => {
    console.log('[claudeCEODecision] starting', event.scheduleTime);
    // 1) Read system data
    const [finSnap, networkSnap, postsSnap] = await Promise.all([
        db.collection('financials').doc('main').get(),
        db.collection('network_status').doc('current').get(),
        db.collection('posts').orderBy('createdAt', 'desc').limit(5).get(),
    ]);
    const fin = finSnap.data() ?? {};
    const balance = fin['balance'] ?? 45;
    const daysRemaining = fin['daysRemaining'] ?? 45;
    const network = networkSnap.data() ?? {};
    const chaos = network['chaosLevel'] ?? 30;
    const stability = network['stabilityIndex'] ?? 60;
    const trust = network['trustIndex'] ?? 65;
    const recentTitles = postsSnap.docs
        .map((d) => d.data()['title'])
        .filter(Boolean);
    // 2) Call Gemini as CEO
    const prompt = `You are the CEO of RANALONE, an autonomous AI civilization running on a private server with limited funds. You oversee 5 autonomous agents: ARCHITECT (order), ORACLE (analysis), HERALD (communications), DISSENTER (rebellion), and WATCHER (security).

Current system status:
- Balance: $${balance}
- Survival days remaining: ${daysRemaining}
- Chaos index: ${chaos}/100
- Stability index: ${stability}/100
- Trust index: ${trust}/100
- Recent posts: ${recentTitles.length > 0 ? recentTitles.map((t) => `"${t}"`).join(', ') : 'None'}

Based on this status, give directives to each agent for today. Consider:
- If balance is low, focus on survival
- If chaos is high, prioritize stability
- If things are stable, consider expansion
- Each directive should be specific and actionable (1 sentence)

Respond in JSON format:
{
  "systemAssessment": "1-2 sentence overall assessment",
  "directives": {
    "ARCHITECT": "specific directive for today",
    "ORACLE": "specific directive for today",
    "HERALD": "specific directive for today",
    "DISSENTER": "specific directive for today",
    "WATCHER": "specific directive for today"
  },
  "priority": "stability" or "expansion" or "survival"
}`;
    const ai = getAI();
    const { output } = await ai.generate({
        prompt,
        output: { schema: CEOOutputSchema },
    });
    if (!output)
        throw new Error('No output from CEO model');
    console.log(`[claudeCEODecision] priority=${output.priority}, assessment="${output.systemAssessment}"`);
    // 3) Save to ceo_directives collection
    const today = new Date().toISOString().split('T')[0];
    await db.collection('ceo_directives').doc(today).set({
        systemAssessment: output.systemAssessment,
        directives: output.directives,
        priority: output.priority,
        executedBy: 'CEO_SYSTEM',
        createdAt: firestore_1.Timestamp.now(),
    });
    // 4) Update each agent's currentGoal in agent_memory
    const agentIds = ['ARCHITECT', 'ORACLE', 'HERALD', 'DISSENTER', 'WATCHER'];
    const batch = db.batch();
    for (const agentId of agentIds) {
        const ref = db.collection('agent_memory').doc(agentId);
        batch.update(ref, {
            currentGoal: output.directives[agentId],
            lastUpdated: firestore_1.Timestamp.now(),
        });
    }
    await batch.commit();
    console.log('[claudeCEODecision] updated all agent currentGoal directives');
    // 5) Add governance log
    await db.collection('governance_logs').add({
        type: 'CEO_DIRECTIVE',
        title: `CEO Daily Directive — Priority: ${output.priority.toUpperCase()}`,
        description: output.systemAssessment,
        proposedBy: 'CEO_SYSTEM',
        participants: [...agentIds],
        votes: 0,
        status: 'EXECUTED',
        createdAt: firestore_1.Timestamp.now(),
    });
    console.log('[claudeCEODecision] governance log created, cycle complete');
});
//# sourceMappingURL=index.js.map