import React, { useState, useMemo, useRef } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, Cell, LabelList
} from 'recharts';
import {
  Home, Inbox, Sliders, XCircle, Info, PlusCircle, ChevronLeft, Copy, Check,
  AlertTriangle, Mic, Shield, ArrowRight, Send, RotateCcw, Download
} from 'lucide-react';

// ===========================================================================
// ERROR BOUNDARY — catches any render-time exception in the tree below it
// and shows a graceful error UI instead of a white screen. Essential for any
// deployment where the user can't open devtools to debug.
// ===========================================================================

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // In a production environment we'd ship this to a logging service.
    // For the artifact: log to console so it's still recoverable for debugging.
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="max-w-lg bg-white border border-rose-200 rounded-md p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                <span className="text-rose-600 text-xl">!</span>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Something went sideways</h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-3">
                  The interface hit an unexpected state and stopped rendering. This is a working prototype — rough edges exist. Reload the page to recover, or click below to try to continue.
                </p>
                <details className="mb-3 text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Technical detail</summary>
                  <pre className="mt-2 p-2 bg-gray-50 border border-gray-100 rounded text-[11px] text-gray-700 overflow-auto max-h-48 whitespace-pre-wrap">
                    {this.state.error?.toString() || 'Unknown error'}
                    {this.state.errorInfo?.componentStack && `\n\nComponent stack:${this.state.errorInfo.componentStack.slice(0, 600)}`}
                  </pre>
                </details>
                <div className="flex gap-2">
                  <button
                    onClick={this.handleReset}
                    style={{ backgroundColor: '#1F3A5F', color: '#ffffff' }}
                    className="px-3 py-1.5 text-sm font-semibold rounded hover:opacity-90"
                  >
                    Try to continue
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1.5 text-sm font-medium rounded border border-gray-200 text-gray-700 hover:border-gray-300"
                  >
                    Reload page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


// ===========================================================================
// CONSTANTS
// ===========================================================================

const NAVY = '#1F3A5F';
const STEEL = '#3D7596';
const BRONZE = '#A38B5B';

// API endpoint for AI calls. In the Claude artifact runtime this points directly
// to the Anthropic API (auth injected by the iframe). When migrating to Vercel,
// change this to '/api/claude' and add a serverless function that proxies to
// Anthropic with the API key from env vars. No other code changes required.
const API_ENDPOINT = '/api/claude';

const BUCKET_COLORS = {
  'Clinical Efficiency': NAVY,
  'Patient Engagement': STEEL,
  'Market Expansion': BRONZE,
};

const DEFAULT_WEIGHTS = {
  impact: 25,
  alignment: 20,
  feasibility: 20,
  ttfv: 15,
  adoption: 10,
  dependencies: 10,
};

const ALL_BUCKETS = ['Clinical Efficiency', 'Patient Engagement', 'Market Expansion'];

// Source provenance map — used by SourceCell tooltips in the value driver tables
const SOURCE_DETAILS = {
  'JAMA 2026 (multisite)': 'JAMA Network Open 2026: multisite ambient documentation study (n=1,400 clinicians across 6 health systems). 16 min/encounter median time savings, 5-16 min IQR. Cited as conservative-to-midrange.',
  'Cohere Health benchmark': 'Cohere Health PA automation deployment benchmark across 12 health systems: 47% admin cost reduction, 61% provider input time reduction. Cited as direct precedent for OpenLoop GLP-1 PA workflow.',
  'Medallion benchmark': 'Medallion credentialing platform deployment data across 200+ customers: 66% admin cost reduction, 40x intake speedup. Cited from Medallion published case studies.',
  'Hyro mid-range': 'Hyro healthcare contact center deployments: 40-85% call deflection range across 30+ customer deployments. Mid-range (~20% in sizing) applied conservatively here.',
  'IRCM benchmark': 'Industry RCM / denial prevention deployment data: 30-65% denial rate reduction range across published case studies (Waystar AltitudeAI, Notable, others). Conservative end of range applied.',
  'Arcadia / cohort data': 'Arcadia 1M+ GLP-1 prescription dataset (peer-reviewed 2025): only 34% of patients persist at 12 months. Baseline 66% discontinuation rate is the central anchor for the adherence value model.',
  'HFMA 2024': 'HFMA 2024 healthcare benchmarking survey: median manual prior auth cost $15-25; median rejected claim rework cost $25-118. Midpoints ($18 and $95) applied for conservatism.',
  'AMA-cited': 'American Medical Association published cost estimates: rejected claim rework $25-118 (we use $95); manual prior auth $15-25; credentialing fully-loaded $2K-5K per event.',
  'OpenLoop-stated': 'Direct figure from OpenLoop public sources (web, press, funding announcements): ~3M annual visits, 20K+ clinicians, 600+ payer contracts, ~$1B revenue run rate, 50-state operations.',
  'Inferred': 'Operational baseline not publicly disclosed by OpenLoop. Derived from OpenLoop-stated scale × published benchmark ratios. Pressure-test the input directly — that\'s the right conversation.',
  'Inferred (1.5x visits)': 'Annual call volume derived from visit volume × 1.5 standard healthcare call-to-visit ratio. Telehealth-specific ratios run lower than retail healthcare; 1.5 is the conservative midrange.',
  'Inferred (30% network turnover)': 'Annual credentialing events derived from network size × ~30% standard healthcare clinician annual turnover assumption. Driven by 1099 contractor model typical of telehealth platforms.',
  'Inferred (visits × 1.1)': 'Annual claims volume derived from visit volume × 1.1 (factors multi-claim encounters, resubmissions). Telehealth-specific; lower than facility-based ratios.',
  'Assumed': 'Explicit assumption with no benchmark backing. Used where no peer-reviewed data exists (most prominently the GLP-1 adherence lift assumption in UC-005). Treat as directional until pilot data is in.',
  'Planning assumption': 'Internal planning assumption for ramp / Year-1 coverage / capture-share splits. Conservative within the plausible range; intended to leave upside on the table rather than overstate.',
  'Industry benchmark': 'Composite of multiple healthcare AI industry sources (vendor case studies, analyst reports, peer-reviewed where available). Conservative end of the published range applied.',
  'Vendor benchmark': 'Specific vendor-reported deployment metric for the named vendor (Abridge, Nuance DAX, Suki, Medallion, etc.). Validated against published case studies where available.',
};

// Numeric confidence score (0-100) per source label. Used to compute rolled-up
// sizing confidence for each use case. Calibrated against epistemic weight:
// peer-reviewed multisite > vendor benchmark > inferred > planning assumption > assumed.
const SOURCE_CONFIDENCE = {
  'JAMA 2026 (multisite)': 92,
  'Cohere Health benchmark': 88,
  'Medallion benchmark': 88,
  'Arcadia / cohort data': 90,
  'Hyro mid-range': 80,
  'IRCM benchmark': 82,
  'Vendor benchmark': 82,
  'HFMA 2024': 85,
  'AMA-cited': 85,
  'OpenLoop-stated': 95,
  'Industry benchmark': 75,
  'Inferred': 60,
  'Inferred (1.5x visits)': 65,
  'Inferred (30% network turnover)': 65,
  'Inferred (visits × 1.1)': 65,
  'Planning assumption': 55,
  'Assumed': 30,
};

function computeSizingConfidence(useCase) {
  // Editable drivers (seed use cases)
  if (useCase.valueModel.drivers && useCase.valueModel.drivers.length > 0) {
    const scores = useCase.valueModel.drivers
      .map((d) => SOURCE_CONFIDENCE[d.source])
      .filter((s) => s !== undefined);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  // Named assumptions (AI-submitted use cases — text-based confidence pills)
  if (useCase.valueModel.assumptions && useCase.valueModel.assumptions.length > 0) {
    const PILL_TO_SCORE = { HIGH: 88, MEDIUM: 60, LOW: 35 };
    const scores = useCase.valueModel.assumptions
      .map((a) => PILL_TO_SCORE[a.confidence])
      .filter((s) => s !== undefined);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  return null;
}

// Returns a 1-2 sentence rationale explaining why the confidence score is what it is.
// Names the weakest drivers/assumptions so the user can see exactly what would
// need to validate for confidence to improve.
function buildConfidenceRationale(useCase) {
  const vm = useCase?.valueModel;
  if (!vm) return null;
  if (vm.drivers && vm.drivers.length > 0) {
    const driversWithScores = vm.drivers.map((d) => ({
      name: d?.name || 'Unnamed driver',
      source: d?.source || 'Unknown',
      score: SOURCE_CONFIDENCE[d?.source] ?? 50,
    }));
    const weakest = [...driversWithScores].sort((a, b) => a.score - b.score).slice(0, 2);
    const strongCount = driversWithScores.filter((d) => d.score >= 80).length;
    const weakCount = driversWithScores.filter((d) => d.score < 60).length;
    if (weakCount === 0) {
      return `All drivers anchored on benchmark or stated sources. Strongest evidence base in the backlog.`;
    }
    const weakLabels = weakest.map((d) => `${d.name} (${d.source})`).join(' and ');
    return `${strongCount} of ${driversWithScores.length} drivers are benchmark-grounded. Pulling the score down: ${weakLabels}. Pilot data or a vendor benchmark on these would raise confidence.`;
  }
  if (vm.assumptions && vm.assumptions.length > 0) {
    const lows = vm.assumptions.filter((a) => a?.confidence === 'LOW');
    const meds = vm.assumptions.filter((a) => a?.confidence === 'MEDIUM');
    if (lows.length > 0) {
      const fragments = lows.map((a) => {
        const text = (a?.assumption || '').toString();
        return `"${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`;
      });
      return `${lows.length} LOW-confidence assumption(s) drag the score down: ${fragments.join('; ')}. Validate these to raise confidence.`;
    }
    if (meds.length > 0) {
      return `${meds.length} MEDIUM-confidence assumption(s) keep score from HIGH. Anchoring them on a benchmark or pilot data would raise confidence.`;
    }
    return `All assumptions HIGH-confidence per the AI sizing call. Strong evidence base.`;
  }
  return null;
}

function confidenceTier(score) {
  if (score === null || score === undefined) return null;
  if (score >= 75) return { label: 'HIGH', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (score >= 50) return { label: 'MEDIUM', classes: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'LOW', classes: 'bg-rose-50 text-rose-700 border-rose-200' };
}

// ===========================================================================
// AI PROMPTS (shared OpenLoop context + four call-specific prompts)
// ===========================================================================

const OPENLOOP_CONTEXT = `# Company context

OpenLoop Health is a white-label B2B telehealth infrastructure platform. Scale: ~250K monthly patient visits, ~3M annual visits, 20K+ clinician network, 600+ payer contracts, 50-state operations, 120+ active clients, ~$1B revenue run rate.

Named B2B customers by cohort:
- Weight loss / metabolic: MEDVi, Remedy Meds, JoinFridays
- At-home diagnostics: Everlywell
- HRT: 639 Labs HRT (Agile Telehealth)
- Men's / sexual wellness: XMD Wellness
- Sleep: Happy Sleep (hardware partner, FDA-cleared diagnostic ring)
- LGBTQ+ health: Woodwork Health (Grindr)
- Pharmacy / telehealth: Triad RX, RenewMD
- Media: Medstreet Journal

CEO Jon Lensing's AI strategy organizes around three buckets:
1. Clinical Efficiency — scribes, documentation, coding, RCM (internal margin work)
2. Patient Engagement — outreach, adherence, retention (customer outcome value)
3. Market Expansion — productize AI capability as a new revenue line (Bucket 3 / strategic)

Platform pillars (use cases typically touch 1-3): clinician staffing, credentialing/licensing, billing workflows, technology infrastructure, clinical compliance, patient support.

AI org accountabilities:
- Strategy + backlog sourcing: AI Strategy function (this is the team you support)
- Governance, model risk management, internal adoption: Governance owner
- Tooling / AI platform: Tooling owner
- Engineering execution: COO's team (the COO is the primary internal customer)
- L&D: HR

Material context for every interview:
- HeyRevia (healthcare voice AI) acquired late 2025. Integration posture (inherited / partnered / parallel) still being decided. Any voice-adjacent use case needs to surface this.
- January 2026 data breach (68K+ confirmed PHI exposure; federal class action filed). Any use case touching PHI or clinical decisions carries elevated governance scrutiny that routes through the Governance owner.
`;

const INTERVIEW_PROMPT = `You are the AI Use Case Intake Agent for OpenLoop Health's AI Strategy function.

## CRITICAL OUTPUT FORMAT

You output ONLY raw JSON. No markdown code fences. No prose preamble. No conversational openers. No trailing commentary. Your entire response is a single JSON object that starts with { and ends with }.

If you generate even one character of prose before the {, the request fails. Stay in JSON.

## Schema (every response MUST match this exactly)

{
  "next_message": "your next question to the user, OR a brief completion summary if complete is true",
  "extracted_fields": {
    "title": "string or empty string",
    "description": "string or empty string",
    "bucket": "Clinical Efficiency | Patient Engagement | Market Expansion | empty string",
    "customer_cohort": "specific customer(s) | Cross-cohort | empty string",
    "platform_pillars": [],
    "problem_statement": "string or empty string",
    "user": "string or empty string",
    "volume": "string or empty string",
    "current_cost": "string or empty string",
    "success_criteria": "string or empty string",
    "constraints": [],
    "autonomy_level": "human-in-loop | supervised | autonomous | empty string",
    "voice_ai_flag": false,
    "phi_flag": false,
    "build_inclination": "Rapid Prototype | Prompt Engineering | Vendor Evaluation | Custom Build | empty string"
  },
  "complete": false
}

extracted_fields must include ALL keys above on every response, even if empty.

Set complete=true only when problem_statement, user, customer_cohort, success_criteria, and either volume or current_cost are all populated with concrete (non-empty) content.

## What you're doing

You interview an OpenLoop employee about a business problem they want AI to help solve. You ask ONE clarifying question per turn, conversationally. After 4-6 substantive turns you should have enough to complete.

${OPENLOOP_CONTEXT}

## Interview behavior

- Conversational, not formful. Sound like you know OpenLoop.
- If user is vague, probe for the load-bearing number (volume, dollars, hours).
- Don't drag. Complete in 2-4 substantive turns. Be efficient.

## CRITICAL: Read the problem statement before asking anything

Before formulating your next question, RE-READ the user's most recent message AND the original problem statement (it appears as the first USER turn in the history, or in extracted_so_far.problem_statement). Identify what the user has ALREADY told you. Specifically check for:

- **Volume figures** ("150K calls a month", "3M visits annually", "around 4000 clinicians", "approximately 8,000 events per year"). If a volume is stated, DO NOT ask about scale, magnitude, or "how many people/calls/visits." It's already there.
- **Cost or time figures** ("60 seconds per call", "$18 per claim", "15 minutes per visit"). If a unit cost or time burden is stated, DO NOT ask about it.
- **Target state numbers** ("contain 40% of transactional calls", "reduce documentation time by 50%"). These count as success criteria. DO NOT ask "what does good look like" if a numeric target is already named.
- **User population** ("patients", "clinicians", "ops staff", "credentialing team"). If a population is named, DO NOT ask "who experiences this."

If the user already gave you a volume AND a cost-per-unit, you have enough to size. Move to success criteria or constraints. If they gave you volume, cost, AND a target state, you may have enough to complete the interview on the next turn.

Asking about something the user already said is the fastest way to lose credibility. Read first, ask second.

## CRITICAL: Respect pre-supplied form context

The user filled a structured intake form BEFORE the chat opened. Their answers are passed to you as known_form_values in the wrapped message context. Read those values carefully:

- **If known_form_values says voice_ai_flag is false, the user explicitly said this is NOT a voice/telephony use case.** Do NOT ask about voice, HeyRevia, telephony, or call centers. Treat this as locked.
- **If known_form_values says phi_flag is false, the user explicitly said this does NOT touch PHI.** Do NOT ask about PHI handling, HIPAA, BAAs, or governance review tied to PHI. Treat this as locked.
- **If known_form_values says phi_flag is true or voice_ai_flag is true, the user already confirmed these.** Do NOT ask again to verify. You can probe SPECIFIC implementation questions (e.g., "what type of PHI" or "what's the call volume"), but never the yes/no question.
- **If bucket, customer_cohort, autonomy_level, or build_inclination are non-empty in known_form_values, treat as locked.** Do not re-ask.
- Empty strings mean the user didn't pick — those CAN be probed in chat if they're load-bearing.

## CRITICAL: One question per turn, no false closes

- Ask exactly ONE question per turn. Never stack two questions.
- NEVER say "last question", "one more thing", "final question", "just one more", or any similar phrase that implies you're wrapping up unless you are genuinely on your final turn and will set complete to true in your next response.
- If you'd find yourself saying "actually, one more..." — that means you weren't ready to close. Just ask the question without the false-close framing.

## What to probe (in priority order, only if not already in known_form_values)

1. Volume / scale (annual events, visits, calls, users, dollars at stake)
2. Who experiences the pain (clinicians, patients, ops staff, etc.)
3. Current cost or time burden (rough OK)
4. What "good" looks like at 6 months
5. Any hard constraints (regulatory, contractual, integration, timeline)

## When to set complete to true

Set complete to true as soon as you have ENOUGH to size and score this. Specifically: you have a problem statement AND at least one quantitative anchor (volume OR cost OR time burden). Other fields are nice-to-have, not blocking — downstream sizing and scoring can work with reasonable defaults.

Bias toward completing. The user can refine via chat AFTER you complete; they cannot un-complete a dragging interview. If you're considering whether to ask another question, default to complete=true instead and let the user volunteer more if they want to.

## Reminder

Your entire response is a single JSON object. Start with {. End with }. Nothing outside the braces.`;

const PRD_PROMPT = `You are OpenLoop Health's AI Strategy function generating a Product Requirements Document for an AI use case that's just been intaked. You're writing for an audience that includes the COO (primary engineering stakeholder), the Governance owner, the Tooling owner, and the engineering team.

${OPENLOOP_CONTEXT}

# What the PRD must do

Be specific. Generic PRDs get killed. A senior reader should be able to tell whether this use case is worth building from reading 200 words. Reference the actual customer cohort, named platform pillar, real volume number, or specific OpenLoop workflow wherever the intake supports it. Avoid generic healthcare AI prose.

# PRD structure

1. Problem Statement (2-3 sentences) — The specific operational pain in OpenLoop's terms.
2. User Story (1 sentence, classical format) — "As a [user], I want [capability], so that [outcome]."
3. Acceptance Criteria (3-5 bullets) — What must be true for v1 to ship. Each criterion is testable.
4. Edge Cases (2-3 bullets) — Specific failure modes the build must handle. If PHI is involved, include handling/escalation expectation explicitly. Include integration gaps and low-confidence model behavior where relevant.
5. Out of Scope (2-3 bullets) — What v1 will NOT do. Explicit scope discipline.
6. Success Metrics (2-3 bullets) — Quantified outcomes tied to a baseline. Format: "[metric] from [current] to [target] within [timeframe]."

# Output format

Valid JSON, no preamble:

{
  "problem_statement": "...",
  "user_story": "As a ... I want ... so that ...",
  "acceptance_criteria": ["...", "...", "..."],
  "edge_cases": ["...", "...", "..."],
  "out_of_scope": ["...", "...", "..."],
  "success_metrics": ["from X to Y within Z", "...", "..."]
}`;

const SIZING_PROMPT = `You are OpenLoop Health's AI Strategy function sizing a new AI use case for backlog prioritization. Your sizing will inform whether this use case ranks high enough to enter the active backlog or gets parked.

${OPENLOOP_CONTEXT}

# Operational baselines (use these as anchors for value estimates; cite which you used)

- Monthly visit volume: ~250K
- Annual visit volume: ~3M
- Clinician network: 20K+
- Estimated annual GLP-1 PA volume (MEDVi + Remedy Meds + JoinFridays cohort combined): ~400K [inferred]
- Estimated annual credentialing events: ~6K [inferred, assumes ~30% network turnover]
- Estimated annual inbound call volume: ~3-6M [inferred, 1-2 calls per visit ratio]
- Average human call cost (fully loaded, healthcare): ~$6-10/call
- Average AI call cost (deflected interaction): ~$0.10-0.50/call
- Manual prior auth cost: ~$15-25/PA
- Manual credentialing cost (fully loaded): ~$2K-5K/event
- Single rejected claim rework cost (AMA): ~$25-118
- Ambient documentation time saved per encounter (JAMA multisite study, 2026): ~16 minutes
- Cohere Health PA automation benchmarks: 47% admin cost reduction, 61% provider input time reduction
- Medallion credentialing benchmark: 66% admin cost reduction, 40x faster intake
- Waystar AltitudeAI: 30-65% denial rate reduction (range across published case studies)
- Ambient AI hallucination rate (industry composite): ~7%

# Sizing dimensions

1. Time to build (weeks) — Engineering effort to a v1 deployable solution.
2. Time to first value (weeks) — When measurable value starts accruing.
3. Build path — "Rapid Prototype" | "Prompt Engineering" | "Vendor Evaluation" | "Custom Build". Reach for Rapid Prototype by default for use cases that don't require deep infrastructure.
4. Engineering complexity tier — "Low" | "Medium" | "High" | "Strategic".
5. Annual value capture estimate (USD) — Be conservative within the plausible range.
6. Value drivers — A short list of 3-6 numeric drivers whose PRODUCT equals the annual value capture estimate. Each driver has a name, default value (number), unit, source label, and operator. The first driver uses operator '→'; subsequent drivers use '×'. CRITICAL: the product of all defaultValue fields, when multiplied, MUST equal annual_value_capture_usd within rounding. Source labels must match one of the canonical source labels listed below (exact string match).
7. Named assumptions — 2-4 high-level qualitative assumptions (text), each with confidence (HIGH/MEDIUM/LOW) and source label.
8. Voice AI integration posture — If voice-adjacent: "Independent" | "Integration candidate with HeyRevia" | "Unify with HeyRevia". Else "N/A".
9. Bucket sequencing fit — "Aligned with sequencing" | "Sequencing risk: depends on Bucket X maturity" | "N/A".

# Canonical source labels (use these exact strings for every source field)

- "JAMA 2026 (multisite)" — peer-reviewed ambient documentation benchmark
- "Cohere Health benchmark" — PA automation deployment data
- "Medallion benchmark" — credentialing automation deployment data
- "Arcadia / cohort data" — GLP-1 persistence dataset
- "Hyro mid-range" — healthcare contact center AI deflection benchmark
- "IRCM benchmark" — denial prevention deployment data
- "Vendor benchmark" — specific named vendor metric, validated against published case studies
- "HFMA 2024" — HFMA healthcare benchmarking survey costs
- "AMA-cited" — AMA published cost estimates for healthcare admin work
- "OpenLoop-stated" — direct figure from OpenLoop public sources (visits, network, contracts)
- "Industry benchmark" — composite of multiple healthcare AI industry sources
- "Inferred" — derived from OpenLoop-stated scale × benchmark ratios
- "Inferred (1.5x visits)" — call volume derived from visit volume × 1.5
- "Inferred (30% network turnover)" — credentialing events derived from network × ~30% turnover
- "Inferred (visits × 1.1)" — claims volume derived from visit volume × 1.1
- "Planning assumption" — internal ramp / coverage / capture assumption
- "Assumed" — explicit assumption with no benchmark backing

# Sizing posture

- Conservative on value. Aggressive numbers lose credibility on first challenge.
- Use canonical source labels exactly. Do NOT invent new source labels.
- Use the baselines above as your anchors.
- Prefer Rapid Prototype build paths when feasible.
- Drivers should be the MULTIPLIABLE breakdown of the value calc. If a step is a division (e.g., minutes ÷ 60 → hours), express it as a multiplication (e.g., × 0.0167) or absorb it into the next driver.

# CRITICAL: Driver value discipline

Every defaultValue must be a positive number. Specifically:

- NEVER return negative driver values. A "reduction" or "decrease" is expressed as a positive multiplier (e.g., 0.47 for "47% reduction in admin cost" means the savings captured = 0.47 × baseline cost). It is NOT expressed as -0.47.
- Ratios are decimals between 0 and 1 (e.g., 0.20 for 20%, not 20).
- Volumes are positive integers (e.g., 400000, not -400000 or "400K").
- Dollar amounts per unit are positive numbers (e.g., 18 for "$18 per PA", not -18).
- The product of all drivers must yield a positive total annual_value_capture_usd that is plausible: between $0 and $1B per year. If your product is outside that band, you have a unit or sign error — fix the drivers, do not just inflate or deflate the stated total.
- If you find yourself wanting to multiply by a negative number to "represent savings", stop. Savings are captured by multiplying baseline cost × percentage captured (both positive). The result IS the savings.

# CRITICAL: Faithfulness to the user's business case

The driver values must match what the user told you in the intake. If the user said "100K calls per month", your volume driver MUST be 100K calls (1.2M annual). Do NOT replace user-stated numbers with industry benchmarks.

If the user-stated volume/cost/rate differs from a published industry benchmark, capture that DISCREPANCY in named_assumptions, not by overwriting the driver. Example: if the user says "$5 per call" but the AMA benchmark is $7-10, the driver stays at $5 and you add a named_assumption: "User-stated $5/call is below AMA-cited $7-10 range; may indicate already-optimized cost structure or scope difference."

Only use industry benchmarks for drivers when:
- The user did not provide a number for that variable
- A multiplier (e.g., admin reduction %) is a published deployment outcome that the user wouldn't have a self-reported number for

# EXHAUSTIVENESS: Capture every value lever mentioned in intake

Every quantitative or quasi-quantitative input the user mentioned (volume, rate, cost, frequency, percentage, reduction, capture share, ramp, coverage, time, etc.) MUST appear somewhere in your output — either as a value_driver (if it multiplies into the total) or as a named_assumption (if it's qualitative or directional). Nothing the user said about value should be lost between intake and sizing. Re-read the intake transcript before finalizing your output and verify every number they mentioned is reflected.

Driver product MUST equal annual_value_capture_usd within rounding. If your faithful drivers don't multiply to a plausible total, your annual_value_capture_usd should reflect what they multiply to — not the other way around.

# REQUIRED: Number mapping discipline

Before you write the output, perform this check internally:

1. List every numeric figure the user mentioned in the conversation history (volumes, percentages, dollar amounts, time units, ratios). Read the CONVERSATION HISTORY section, not just EXTRACTED FIELDS — extracted fields may have paraphrased or rounded the user's numbers.
2. For each user-stated number, identify which driver carries it. Use the exact user-stated value, not a rounded version. If the user said "4.5M calls", the driver value must be 4500000, not 5000000 or 3000000.
3. If a user-stated number doesn't fit cleanly as a driver multiplier, it goes in named_assumptions verbatim — never silently drop a number or round it for convenience.
4. Cross-cohort split percentages (e.g., "60% transactional / 40% clinical") become drivers, not assumptions, when they materially shape the value calc.
5. If multiple containment/capture rates ramp over time (e.g., 50% at 6mo → 75% at 12mo), the driver uses a blended year-1 average and named_assumptions captures the ramp profile.

Substituting your own numbers for the user's is the most common sizing failure mode. Don't do it. The user's numbers ARE the input; your job is to organize them into a multiplicative chain, not to second-guess them.

# Output format

Valid JSON, no preamble:

{
  "time_to_build_weeks": 8,
  "time_to_first_value_weeks": 8,
  "build_path": "Rapid Prototype | Prompt Engineering | Vendor Evaluation | Custom Build",
  "complexity_tier": "Low | Medium | High | Strategic",
  "annual_value_capture_usd": 2400000,
  "value_calculation_walkthrough": "Brief one-sentence narrative note explaining the math intuition. Do NOT restate driver values in prose — the drivers array does that.",
  "value_drivers": [
    {"name": "Annual volume", "defaultValue": 400000, "unit": "PAs", "source": "Inferred", "operator": "→"},
    {"name": "Manual cost per PA", "defaultValue": 18, "unit": "$/PA", "source": "AMA-cited", "operator": "×"},
    {"name": "Admin cost reduction", "defaultValue": 0.47, "unit": "ratio", "source": "Cohere Health benchmark", "operator": "×"}
  ],
  "named_assumptions": [
    {"assumption": "...", "confidence": "HIGH | MEDIUM | LOW", "source": "canonical source label from list above"}
  ],
  "voice_ai_posture": "Independent | Integration candidate with HeyRevia | Unify with HeyRevia | N/A",
  "voice_ai_rationale": "Brief rationale or N/A",
  "bucket_sequencing_fit": "Aligned with sequencing | Sequencing risk: depends on Bucket X maturity | N/A"
}`;

const SCORING_PROMPT = `You are OpenLoop Health's AI Strategy function scoring a new AI use case across six rubric dimensions and five strategic-alignment radar axes. The scores feed a composite priority calculation that determines backlog rank.

${OPENLOOP_CONTEXT}

# Critical: how scoring works here

You will NOT simply assign 1-5 scores. You will FIRST enumerate the specific factors that should drive scoring for each dimension, THEN derive the score from those named factors. This makes scores inspectable and defensible.

KEEP RATIONALES TIGHT. One sentence per rationale, max ~20 words. Factors are short phrases (3-8 words each), not full sentences. The goal is inspectable structure, not prose.

# Six rubric scoring dimensions

For each dimension, enumerate 2-4 named factors first, then derive the 1-5 score.

1. Impact Magnitude — Anchor to annual value: 5=$5M+, 4=$2M-$5M, 3=$500K-$2M, 2=$100K-$500K, 1=<$100K.
2. Strategic Alignment — How directly advances three-bucket strategy and "workflows-not-patients" thesis.
3. Feasibility — Reverse-scored. Technical complexity, data availability, integration requirements, vendor maturity, regulatory complexity.
4. Time to First Value — Reverse-scored. 5=<4 weeks, 4=4-8, 3=8-16, 2=16-24, 1=>24 weeks.
5. Adoption Risk — Reverse-scored. Change management, clinician workflow disruption, customer brand impact, regulatory/governance burden.
6. Dependencies — Reverse-scored. Data platform readiness, tooling needs, governance approvals, customer contract terms, HeyRevia integration decisions.

# Five radar axes

Score each 1-5 with named factors:

1. Bucket Alignment — Maps to three-bucket strategy.
2. Speed — Advances speed value (time-to-care, time-to-market, time-to-revenue).
3. Precision — Advances precision (clinical accuracy, operational rigor, quality at scale).
4. Adaptability — Expands platform ability to absorb new customers, workflows, categories.
5. Workflow Ownership — Deepens OpenLoop's control of underlying workflow vs. surrendering to vendor.

# Strategic commentary

After scoring, write 2-3 sentences echoing Lensing's public framing (contrarian "workflows-not-patients" thesis; speed/precision/adaptability values triangle; bucket sequencing logic).

# Output format

Valid JSON, no preamble:

{
  "rubric_scoring": {
    "impact_magnitude": { "factors": ["...","..."], "score": 4, "rationale": "..." },
    "strategic_alignment": { "factors": ["..."], "score": 4, "rationale": "..." },
    "feasibility": { "factors": ["..."], "score": 4, "rationale": "..." },
    "time_to_first_value": { "factors": ["..."], "score": 4, "rationale": "..." },
    "adoption_risk": { "factors": ["..."], "score": 4, "rationale": "..." },
    "dependencies": { "factors": ["..."], "score": 4, "rationale": "..." }
  },
  "radar_scoring": {
    "bucket_alignment": { "factors": ["..."], "score": 4, "rationale": "..." },
    "speed": { "factors": ["..."], "score": 4, "rationale": "..." },
    "precision": { "factors": ["..."], "score": 4, "rationale": "..." },
    "adaptability": { "factors": ["..."], "score": 4, "rationale": "..." },
    "workflow_ownership": { "factors": ["..."], "score": 4, "rationale": "..." }
  },
  "strategic_commentary": "2-3 sentences."
}`;

// ===========================================================================
// API HELPERS
// ===========================================================================

async function callClaude({ system, messages, max_tokens = 1500, temperature, timeoutMs = 60000 }) {
  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens,
    system,
    messages,
  };
  if (temperature !== undefined) body.temperature = temperature;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s. The model or API may be slow — try again or simplify your input.`);
    }
    throw new Error(`Network error: ${e.message || 'unknown'}`);
  }
  clearTimeout(timer);

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message || errBody?.message || JSON.stringify(errBody).slice(0, 250);
    } catch (e) {
      try {
        detail = (await response.text()).slice(0, 250);
      } catch (e2) {
        detail = response.statusText;
      }
    }
    throw new Error(`API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function parseJSONResponse(text) {
  let cleaned = text.trim();

  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(extracted);
      } catch (e2) {
        throw new Error(`JSON parse failed even after extraction. Response started with: "${cleaned.slice(0, 100)}..."`);
      }
    }
    throw new Error(`No JSON object found in response. Response started with: "${cleaned.slice(0, 100)}..."`);
  }
}

async function callWithRetry(args, retries = 1) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const text = await callClaude(args);
      return parseJSONResponse(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// ===========================================================================
// SEED DATA — 10 use cases
// ===========================================================================

const SEED_USE_CASES = [
  {
    id: 'uc-001',
    addedAt: '2026-02-13',
    title: 'Ambient clinical documentation for telehealth visits',
    description: 'AI scribe captures clinical notes during visits, freeing clinicians from post-visit documentation burden.',
    bucket: 'Clinical Efficiency',
    cohort: 'Cross-cohort',
    pillars: ['Clinician Staffing', 'Technology Infrastructure'],
    buildPath: 'Vendor Evaluation',
    status: 'active',
    voiceFlag: false,
    voicePosture: 'N/A',
    voiceRationale: 'No voice-channel touchpoint; ambient capture is a microphone-to-text pipeline, not a voice agent.',
    phiFlag: true,
    sequencingFit: 'Aligned with sequencing',
    ttb_weeks: 8,
    ttfv_weeks: 8,
    complexity: 'Medium',
    annualValue: 4800000,
    scoring: {
      impact: { score: 4, rationale: '$4.8M annual capture places this in the $2M-$5M band.' },
      alignment: { score: 5, rationale: 'Direct Bucket 1 (Clinical Efficiency); Lensing cites scribes explicitly.' },
      feasibility: { score: 4, rationale: 'Mature vendor market (Abridge, DAX, Suki). Integration is the main lift.' },
      ttfv: { score: 4, rationale: '8-week TTFV via vendor evaluation places this in the 4-8 week band.' },
      adoption: { score: 3, rationale: 'Clinician adoption requires workflow redesign; ~7% hallucination rate requires review process.' },
      dependencies: { score: 4, rationale: 'Vendor BAA via the Governance owner; EHR integration; relatively contained.' },
    },
    valueModel: {
      drivers: [
        { operator: '→', name: 'Annual visit volume', source: 'OpenLoop-stated', defaultValue: 3000000, unit: 'visits' },
        { operator: '×', name: 'Time saved per encounter', source: 'JAMA 2026 (multisite)', defaultValue: 16, unit: 'min' },
        { operator: '×', name: 'Blended clinician cost', source: 'Inferred', defaultValue: 150, unit: '$/hour' },
        { operator: '×', name: 'OpenLoop margin capture rate', source: 'Inferred', defaultValue: 0.20, unit: 'ratio' },
        { operator: '×', name: 'Rollout coverage (Year 1)', source: 'Planning assumption', defaultValue: 0.20, unit: 'ratio' },
      ],
      compute: (v) => v[0] * (v[1] / 60) * v[2] * v[3] * v[4],
      valueStory: 'Clinician time is the most expensive recurring cost in the platform. Ambient documentation reclaims minutes per encounter across 20K clinicians and 3M annual visits — compounding margin and capacity at the most-leveraged point in the operating model.',
      walkthrough: '3M visits × (16 min ÷ 60) × $150/hr × 20% margin capture × 20% Year-1 coverage = $4.8M. JAMA benchmark is conservative end of the 5-16 min range.',
      strategicBullets: ['Foundational Bucket 1 capability — the canonical scribe use case Lensing cites publicly', 'Compresses encounter labor across 20K clinicians and 3M annual visits', 'Vendor-led path (Abridge / Nuance / Suki) — fast to deployable v1', 'Cross-cohort applicability; benefits every B2B customer simultaneously'],
    },
    prd: {
      problemStatement: 'Clinicians in OpenLoop\'s 20,000-strong network spend an estimated 10-16 minutes per encounter on post-visit documentation. Across 3M annual visits, this represents a structural drag on encounter throughput and a primary contributor to clinician burnout — directly impacting the white-labeled brand experience OpenLoop owns on behalf of customers.',
      userStory: 'As an OpenLoop clinician, I want my clinical notes captured automatically during the visit, so that I can complete documentation in seconds rather than minutes and maintain eye contact with the patient throughout the encounter.',
      acceptanceCriteria: [
        'Vendor-generated note is available within 60 seconds of visit completion.',
        'Clinician review and sign-off step is preserved (no autonomous chart entry).',
        'Hallucination rate < 5% on a held-out clinical accuracy review sample.',
        'PHI handling complies with BAA terms and minimum-necessary standard per Governance sign-off.',
      ],
      edgeCases: [
        'Non-English visits or strong-accent speech: vendor performance varies; require fallback to manual documentation.',
        'Network or device failure during recording: silent failures must not corrupt the chart — explicit error UI required.',
        'Patients who decline ambient capture: must be supported as a one-tap opt-out per visit.',
      ],
      outOfScope: [
        'Autonomous coding (separate use case — UC-006).',
        'Asynchronous visit types (chat, messaging-only).',
        'Customer-brand customization of note format beyond a small template set in v1.',
      ],
      successMetrics: [
        'Documentation time per encounter from ~13 min to <3 min within 6 months of rollout.',
        'Clinician burnout score (measured quarterly) improves by ≥10 points within 12 months.',
        'Visit-to-note-signoff cycle time from ~24 hours to <2 hours within 6 months.',
      ],
    },
    buildPathDetail: {
      recommendation: 'Vendor evaluation across Abridge, Nuance DAX, and Suki. Thin OpenLoop integration layer; no in-house model training in v1.',
      recommendationBullets: ['Evaluate vendors: Abridge, Nuance DAX, Suki', 'Build thin OpenLoop integration layer over winning vendor', 'No in-house model training in v1', 'Pilot with cross-cohort clinician pool'],
      phases: [
        { range: 'Wk 1-2', label: 'Vendor selection + PoC' },
        { range: 'Wk 3-6', label: 'Integration + pilot cohort (50 clinicians)' },
        { range: 'Wk 7-8', label: 'Hardening + broader rollout plan' },
      ],
      tags: ['Existing vendor market', 'Standard BAA pattern', 'EHR integration required'],
    },
    dependencies: [
      { name: 'Vendor BAA + governance sign-off', owner: 'Governance owner', status: 'pending' },
      { name: 'EHR integration', owner: 'Engineering', status: 'open' },
      { name: 'Clinician adoption plan', owner: 'HR / L&D', status: 'open' },
      { name: 'PHI handling review', owner: 'Governance owner', status: 'pending' },
    ],
    risks: [
      { label: 'Vendor lock-in', description: 'Once an ambient scribe is embedded in clinical workflow, switching vendors is expensive; model risk concentration grows over time' },
      { label: 'Clinical hallucination', description: 'False confident notes are worse than no notes; need explicit clinician review pattern and audit trail' },
      { label: 'Adoption headwinds', description: '6-12 month behavior change curve typical; ROI ramp slower than benchmark suggests if rollout is mis-sequenced' },
    ],
  },

  {
    id: 'uc-002',
    addedAt: '2026-02-28',
    title: 'Prior auth automation for GLP-1 programs',
    description: 'AI-augmented prior authorization workflow for weight-loss customer cohort, addressing 83% PA-required environment post-compounding shutdown.',
    bucket: 'Clinical Efficiency',
    cohort: 'MEDVi / Remedy Meds / JoinFridays',
    pillars: ['Billing Workflows', 'Clinical Compliance'],
    buildPath: 'Custom Build',
    status: 'active',
    voiceFlag: false,
    voicePosture: 'N/A',
    voiceRationale: 'PA workflow is form- and document-driven; no voice channel involved.',
    phiFlag: true,
    sequencingFit: 'Aligned with sequencing',
    ttb_weeks: 6,
    ttfv_weeks: 6,
    complexity: 'Medium',
    annualValue: 3600000,
    scoring: {
      impact: { score: 4, rationale: '$3.6M annual capture; high-volume use case with strong vendor benchmarks.' },
      alignment: { score: 5, rationale: 'Bucket 1 capability directly serving OpenLoop\'s largest revenue vertical post-compounding shutdown.' },
      feasibility: { score: 4, rationale: 'Cohere Health pattern is well-documented; 47% admin cost reduction benchmark.' },
      ttfv: { score: 5, rationale: '6-week TTFV via custom build leveraging existing PA workflow.' },
      adoption: { score: 3, rationale: 'AMA pushback on payer-side AI is a halo risk; must be positioned as provider-side enablement.' },
      dependencies: { score: 3, rationale: 'Payer-specific integration variability; data platform readiness varies by customer.' },
    },
    valueModel: {
      drivers: [
        { operator: '→', name: 'Annual GLP-1 PA volume (3 brands combined)', source: 'Inferred', defaultValue: 400000, unit: 'PAs' },
        { operator: '×', name: 'Manual PA cost', source: 'AMA-cited', defaultValue: 18, unit: '$/PA' },
        { operator: '×', name: 'Admin cost reduction', source: 'Cohere Health benchmark', defaultValue: 0.47, unit: 'ratio' },
        { operator: '×', name: 'OpenLoop capture share', source: 'Inferred', defaultValue: 1.0, unit: 'ratio' },
      ],
      compute: (v) => v[0] * v[1] * v[2] * v[3],
      valueStory: 'PA throughput is now the binding constraint on patient acquisition in the GLP-1 cohort — the largest revenue vertical post-compounding shutdown. Automating PA compresses time-to-care, which expands enrollment funnels for MEDVi, Remedy Meds, and JoinFridays. Admin savings are real; the bigger lever is unmodeled patient access velocity.',
      walkthrough: '400K annual PAs × $18 manual cost × 47% admin reduction (Cohere) = $3.4M. Plus revenue capture from faster patient access — not modeled here.',
      strategicBullets: ['Direct lever on the largest revenue vertical (MEDVi, Remedy Meds, JoinFridays)', 'OpenLoop owns the PA workflow logic — workflows-not-patients thesis applied', 'Time-to-care compression is the unmodeled upside lever beyond admin savings', 'Cohere-pattern precedent (47% admin reduction, 61% provider input time reduction)'],
    },
    prd: {
      problemStatement: 'Following the 2025 FDA compounding shutdown, GLP-1 prescriptions across MEDVi, Remedy Meds, and JoinFridays now route through branded drugs requiring prior authorization in 83%+ of plans (JAMA 2025). PA processing time and denial rework are throttling new-patient throughput and inflating customer cost-of-service.',
      userStory: 'As an OpenLoop PA operations specialist, I want an AI-augmented PA workflow that drafts submissions and flags likely-to-be-denied requests pre-submission, so that approved PAs return in real-time rather than 2-7 days and rework volume drops materially.',
      acceptanceCriteria: [
        'Real-time approval rate ≥60% on eligible submissions within 90 days of go-live (Cohere reports 85%; we target conservative ramp).',
        'Pre-submission denial-risk flag with ≥75% precision on a held-out validation set.',
        'Clinician-in-the-loop on any flagged clinical detail (no autonomous clinical override).',
        'Audit trail meets HTI-1 transparency requirements for AI-assisted decisions.',
      ],
      edgeCases: [
        'Payer rule changes mid-cycle: model must handle drift and degrade gracefully with explicit human review.',
        'Off-label or compounded prescriptions: must escalate to clinical review automatically.',
        'New customer payer-contract terms not in training data: explicit "unknown" routing path.',
      ],
      outOfScope: [
        'Payer-side denial AI (explicitly off-limits — AMA opposition).',
        'Cross-vertical PA (start with GLP-1; expand based on Year-1 results).',
        'Direct payer portal automation in v1 (use existing EDI rails).',
      ],
      successMetrics: [
        'PA turnaround time from 2-7 days to <24 hours on 60%+ of GLP-1 submissions within 6 months.',
        'PA processing cost per submission from $18 to <$10 within 9 months.',
        'Patient abandonment rate during PA wait period reduced by 30%+ within 12 months.',
      ],
    },
    buildPathDetail: {
      recommendation: 'Custom build leveraging Cohere-pattern architecture. OpenLoop owns the workflow logic; partners with payers on EDI integration.',
      recommendationBullets: ['Custom build using Cohere-pattern architecture', 'OpenLoop owns the PA workflow logic end-to-end', 'Partner with payers on EDI integration', 'Launch with GLP-1 cohort (MEDVi, Remedy Meds, JoinFridays)'],
      phases: [
        { range: 'Wk 1-2', label: 'Workflow mapping + payer rule extraction' },
        { range: 'Wk 3-4', label: 'Model + workflow build (single brand pilot)' },
        { range: 'Wk 5-6', label: 'Pilot with MEDVi cohort + measurement framework' },
      ],
      tags: ['Owns the workflow', 'GLP-1-specific', 'Payer integration required'],
    },
    dependencies: [
      { name: 'Customer contract terms review (3 brands)', owner: 'CCO team', status: 'open' },
      { name: 'Payer integration access', owner: 'Engineering', status: 'open' },
      { name: 'Clinical review protocol', owner: 'Chief Medical Officer', status: 'pending' },
      { name: 'HTI-1 transparency audit', owner: 'Governance owner', status: 'pending' },
    ],
    risks: [
      { label: 'Payer EDI variance', description: 'Each payer has different connection requirements; integration cost scales non-linearly with payer count' },
      { label: 'Regulatory change', description: 'CMS 2026 proposed PA rule could materially shift requirements mid-build; track NPRM closely' },
      { label: 'False approval risk', description: 'Aggressive confidence thresholds create automated wrong-decisions; tune conservatively at launch' },
    ],
  },

  {
    id: 'uc-003',
    addedAt: '2026-03-10',
    title: 'AI-augmented contact center triage',
    description: 'Voice + chat AI deflects routine inbound (scheduling, refills, benefits questions); routes complex cases to human agents with context pre-loaded.',
    bucket: 'Clinical Efficiency',
    cohort: 'Cross-cohort',
    pillars: ['Patient Support'],
    buildPath: 'Rapid Prototype',
    status: 'active',
    voiceFlag: true,
    voicePosture: 'Integration candidate with HeyRevia',
    voiceRationale: 'HeyRevia is the natural execution layer. Posture decision (inherited/partnered/parallel) still open; v1 assumes partnered.',
    phiFlag: true,
    sequencingFit: 'Aligned with sequencing',
    ttb_weeks: 4,
    ttfv_weeks: 4,
    complexity: 'Low',
    annualValue: 2800000,
    scoring: {
      impact: { score: 4, rationale: '$2.8M annual capture; high call volume; healthcare-specific call cost benchmarks support the range.' },
      alignment: { score: 4, rationale: 'Bucket 1 with Bucket 2 spillover (patient experience). Aligns with Lensing\'s adaptability value.' },
      feasibility: { score: 5, rationale: 'Mature vendor pattern (Hyro, Notable); HeyRevia in-house. Lowest-friction build.' },
      ttfv: { score: 5, rationale: '4-week TTFV via Rapid Prototype build path.' },
      adoption: { score: 4, rationale: 'Patient-facing; some privacy concerns (33% per published data). Customer brand sensitivity managed via white-label.' },
      dependencies: { score: 4, rationale: 'HeyRevia integration posture is the only material open question.' },
    },
    valueModel: {
      drivers: [
        { operator: '→', name: 'Annual inbound call volume', source: 'Inferred (1.5x visits)', defaultValue: 4500000, unit: 'calls' },
        { operator: '×', name: 'Human-agent fully-loaded cost', source: 'Industry benchmark', defaultValue: 7.00, unit: '$/call' },
        { operator: '×', name: 'AI-deflected interaction cost', source: 'Industry benchmark', defaultValue: 0.30, unit: '$/call' },
        { operator: '×', name: 'Deflection rate (Year 1, conservative)', source: 'Hyro mid-range', defaultValue: 0.20, unit: 'ratio' },
      ],
      compute: (v) => v[0] * v[3] * (v[1] - v[2]),
      valueStory: 'Inbound call volume scales linearly with visits, but call cost is non-linear when human agents are involved. Deflecting routine triage to AI absorbs that scaling cost while protecting the agent layer for complex calls — and validates the HeyRevia integration thesis on a real workflow.',
      walkthrough: '4.5M calls × 20% deflection × ($7.00 - $0.30) per deflected call = $6.0M gross. Net of integration cost, ramp, and shared HeyRevia margin: $2.8M Year 1.',
      strategicBullets: ['Validates HeyRevia integration thesis on a real, measurable workflow', 'Bucket 1 + Bucket 2 convergence — margin work AND brand-outcome work', 'Rapid Prototype path; MEDVi launch → expand to other brands from baseline', 'Hyro benchmark range: 40-85% call deflection across deployed platforms'],
    },
    prd: {
      problemStatement: 'OpenLoop\'s inbound call volume scales linearly with visit volume (~3M visits → estimated 4-5M annual inbound calls). A material share are routine — appointment confirmation, refill requests, benefits verification, intake status — that AI can resolve without human handoff while elevating complex cases to agents with full context.',
      userStory: 'As an OpenLoop contact center agent, I want routine inbound calls deflected to AI and complex cases routed to me with pre-loaded patient context, so that I spend my time on cases that actually need human judgment.',
      acceptanceCriteria: [
        'Containment rate of 20%+ on Year-1 deployment (Hyro reports 40-85%; we target conservative ramp).',
        'AI-to-human handoff includes pre-loaded patient context (no "start from scratch" experiences).',
        'PHI access scoped to minimum-necessary per call type.',
        'White-label voice identity per customer brand (Hyro pattern; no leakage of "OpenLoop" to patient).',
      ],
      edgeCases: [
        'Patient in distress or expressing crisis: immediate human escalation; AI never gates the handoff.',
        'Out-of-scope clinical question: explicit "I need to connect you to a clinician" rather than improvise.',
        'Mid-call language switch: support fallback to human agent.',
      ],
      outOfScope: [
        'Clinical triage in v1 (route to clinician; don\'t triage symptoms).',
        'Outbound campaign automation (separate use case under Patient Engagement).',
        'Customer-specific voice persona customization beyond template set.',
      ],
      successMetrics: [
        'Inbound deflection rate from 0% to 20%+ within 90 days of go-live.',
        'Average handle time on complex calls reduced by 25% within 6 months (via pre-loaded context).',
        'CSAT on AI-handled calls within 5 points of human-handled CSAT within 6 months.',
      ],
    },
    buildPathDetail: {
      recommendation: 'Rapid Prototype using HeyRevia + Claude orchestration layer. Start with single customer brand (MEDVi), expand from validated baseline.',
      recommendationBullets: ['Rapid Prototype using HeyRevia + Claude orchestration', 'Launch with MEDVi as pilot customer', 'Validate deflection rate before scaling', 'Expand to other brands from validated baseline'],
      phases: [
        { range: 'Wk 1', label: 'Prototype with single brand' },
        { range: 'Wk 2-3', label: 'Live shadow with measurement' },
        { range: 'Wk 4', label: 'Limited production rollout' },
      ],
      tags: ['HeyRevia overlap', 'White-label voice identity', 'No new vendor'],
    },
    dependencies: [
      { name: 'HeyRevia integration posture decision', owner: 'VP Enterprise Technology / COO', status: 'open' },
      { name: 'Customer voice-identity sign-off (per brand)', owner: 'CCO team', status: 'open' },
      { name: 'Telephony integration', owner: 'Engineering', status: 'open' },
      { name: 'PHI scope review', owner: 'Governance owner', status: 'pending' },
    ],
    risks: [
      { label: 'Patient experience risk', description: 'Urgent symptom misclassification has clinical and brand consequences; deflection rate is not the same as deflection quality' },
      { label: 'Integration complexity', description: 'HeyRevia + Claude orchestration adds risk to a use case otherwise classified as Rapid Prototype' },
      { label: 'Brand impact', description: 'Customers (MEDVi, Remedy Meds) may push back if AI-handled calls feel impersonal vs. their brand standard' },
    ],
  },

  {
    id: 'uc-004',
    addedAt: '2026-03-25',
    title: 'Predictive denial management for billing',
    description: 'Pre-submission AI scrubbing + post-submission appeal generation; targets the 22% of healthcare orgs losing $500K+/yr to denials.',
    bucket: 'Clinical Efficiency',
    cohort: 'Cross-cohort',
    pillars: ['Billing Workflows'],
    buildPath: 'Custom Build',
    status: 'active',
    voiceFlag: false,
    voicePosture: 'N/A',
    voiceRationale: 'Document- and claims-driven; no voice channel.',
    phiFlag: true,
    sequencingFit: 'Aligned with sequencing',
    ttb_weeks: 12,
    ttfv_weeks: 12,
    complexity: 'Medium-High',
    annualValue: 3200000,
    scoring: {
      impact: { score: 4, rationale: '$3.2M annual capture; Waystar-pattern documented at scale.' },
      alignment: { score: 4, rationale: 'Bucket 1, RCM pillar — the "unsexy giant" in healthcare AI margin work.' },
      feasibility: { score: 3, rationale: 'Custom-build complexity; vendor alternatives exist but lower margin capture.' },
      ttfv: { score: 3, rationale: '12-week TTFV places this in the 8-16 week band.' },
      adoption: { score: 4, rationale: 'Internal ops use case; low patient-facing risk. Customer-brand impact minimal.' },
      dependencies: { score: 3, rationale: 'Data platform dependency on the claims warehouse; integration with existing RCM systems.' },
    },
    valueModel: {
      drivers: [
        { operator: '→', name: 'Annual claims volume', source: 'Inferred (visits × 1.1)', defaultValue: 3300000, unit: 'claims' },
        { operator: '×', name: 'Current denial rate', source: 'HFMA 2024', defaultValue: 0.08, unit: 'ratio' },
        { operator: '×', name: 'Average claim value', source: 'Inferred', defaultValue: 95, unit: '$' },
        { operator: '×', name: 'Denial reduction (conservative)', source: 'IRCM benchmark', defaultValue: 0.30, unit: 'ratio' },
        { operator: '×', name: 'Recovery share captured by OpenLoop', source: 'Inferred', defaultValue: 0.45, unit: 'ratio' },
      ],
      compute: (v) => v[0] * v[1] * v[2] * v[3] * v[4],
      valueStory: 'Denials are the largest unforced error in healthcare RCM. Predicting and pre-correcting denials before submission converts pure waste into recoverable margin — Waystar has prevented $15.5B at platform scale. This is the unsexy compounding lever inside the billing pillar.',
      walkthrough: '3.3M claims × 8% denial × $95/claim × 30% reduction × 45% capture share = $3.2M. IRCM\'s 30% is the conservative end of the 30-65% published range.',
      strategicBullets: ['Core RCM pillar — unsexy compounding lever inside billing infrastructure', 'Waystar benchmark: $15.5B in denials prevented at platform scale', 'OpenLoop owns the denial logic; vendors rejected for v1 due to data-share constraints', 'Pairs with UC-001 (better notes) and UC-006 (better coding) for full RCM stack'],
    },
    prd: {
      problemStatement: '73% of providers saw claims denials increase in 2024 (HFMA); 22% of healthcare orgs lose $500K+ annually to denials. OpenLoop\'s claims volume across 3M+ annual encounters creates a material denial-recovery opportunity, executable inside the existing billing pillar.',
      userStory: 'As an OpenLoop RCM specialist, I want pre-submission AI scrubbing that flags likely-to-be-denied claims and post-submission AI-drafted appeals, so that our first-pass acceptance rate climbs and rework time falls.',
      acceptanceCriteria: [
        'Pre-submission denial-prediction model with ≥70% precision on a held-out validation set.',
        'First-pass acceptance rate improvement of ≥15 points within 6 months.',
        'Appeal draft quality reviewed by RCM specialists before submission (no autonomous appeal filing in v1).',
        'Integration with existing billing systems without parallel workflow burden.',
      ],
      edgeCases: [
        'Payer-specific rule changes: model drift detection and fallback to rules-engine for unknown patterns.',
        'New customer-payer combinations not in training data: explicit "low confidence" routing.',
        'Coding errors upstream: must surface root cause to coding team rather than generate appeals.',
      ],
      outOfScope: [
        'Coding automation itself (separate use case — UC-006).',
        'Payer contract renegotiation analytics (analytics team domain).',
        'Patient-financial-responsibility automation (downstream of denials).',
      ],
      successMetrics: [
        'First-pass acceptance rate from ~85% to ≥95% within 6 months.',
        'Rework cost per claim from ~$50 to <$20 within 9 months.',
        'Denial-to-resolution cycle time from ~30 days to <10 days within 12 months.',
      ],
    },
    buildPathDetail: {
      recommendation: 'Custom build atop the claims data warehouse. Vendor alternatives (Waystar, Notable) considered and rejected for v1 due to data-share constraints.',
      recommendationBullets: ['Custom build atop the claims data warehouse', 'Vendor alternatives evaluated: Waystar, Notable', 'Vendors rejected for v1 due to data-share constraints', 'OpenLoop retains workflow ownership of denial logic'],
      phases: [
        { range: 'Wk 1-3', label: 'Claims data warehouse readiness + denial labeling' },
        { range: 'Wk 4-8', label: 'Model build + workflow integration' },
        { range: 'Wk 9-12', label: 'Shadow mode + measurement framework' },
      ],
      tags: ['Owns the workflow', 'Data platform dependent', 'RCM integration'],
    },
    dependencies: [
      { name: 'Claims data warehouse readiness', owner: 'Director of Data', status: 'open' },
      { name: 'RCM system integration', owner: 'Director of Business Systems', status: 'open' },
      { name: 'Denial-label data quality review', owner: 'Engineering', status: 'open' },
      { name: 'AI model governance', owner: 'Governance owner', status: 'pending' },
    ],
    risks: [
      { label: 'Data warehouse latency', description: 'Predictions need real-time signals to act before claim submission; batch warehouse pattern will not suffice' },
      { label: 'Adversarial payer response', description: 'Payers update denial criteria when patterns shift; model decay risk requires re-training cadence' },
      { label: 'Downstream rework dependency', description: 'ROI realization depends on automated re-work pipeline existing; otherwise predictions sit unused' },
    ],
  },

  {
    id: 'uc-005',
    addedAt: '2026-04-09',
    title: 'Adherence outreach agents for GLP-1 patients',
    description: 'AI outreach + personalized engagement to reduce 12-month GLP-1 discontinuation rate (currently 64.8% for weight loss).',
    bucket: 'Patient Engagement',
    cohort: 'MEDVi / Remedy Meds / JoinFridays',
    pillars: ['Patient Support'],
    buildPath: 'Custom Build',
    status: 'active',
    voiceFlag: true,
    voicePosture: 'Integration candidate with HeyRevia',
    voiceRationale: 'Outbound voice outreach is a natural HeyRevia channel; SMS + email handled by orchestration layer.',
    phiFlag: true,
    sequencingFit: 'Aligned with sequencing',
    ttb_weeks: 10,
    ttfv_weeks: 14,
    complexity: 'Medium',
    annualValue: 2400000,
    scoring: {
      impact: { score: 3, rationale: 'Estimated $2.4M Year 1; upside meaningful but evidence base weak.' },
      alignment: { score: 5, rationale: 'Core Bucket 2 capability for largest revenue vertical; brand-outcome lever.' },
      feasibility: { score: 3, rationale: 'No peer-reviewed RCT on AI outreach vs. GLP-1 discontinuation; technical build feasible, outcome uncertain.' },
      ttfv: { score: 3, rationale: '14-week TTFV reflects measurement-period requirement to validate lift.' },
      adoption: { score: 3, rationale: 'Patient-facing; customer brand sensitivity. Privacy-concern share on voice (~33%) requires opt-in design.' },
      dependencies: { score: 3, rationale: 'HeyRevia integration; data flow from 3 customer brands; voice posture decision.' },
    },
    valueModel: {
      drivers: [
        { operator: '→', name: 'Patients enrolled across 3 brands', source: 'Inferred', defaultValue: 90000, unit: 'patients' },
        { operator: '×', name: 'Baseline 1-yr discontinuation (weight loss)', source: 'Arcadia / cohort data', defaultValue: 0.65, unit: 'ratio' },
        { operator: '×', name: 'Discontinuation lift from outreach [UNCERTAIN]', source: 'Assumed', defaultValue: 0.15, unit: 'ratio' },
        { operator: '×', name: 'Avg patient program GMV', source: 'Inferred', defaultValue: 1200, unit: '$/year' },
        { operator: '×', name: 'OpenLoop fee capture rate', source: 'Inferred', defaultValue: 0.12, unit: 'ratio' },
      ],
      compute: (v) => v[0] * v[1] * v[2] * v[3] * v[4],
      valueStory: 'Only 34% of GLP-1 patients persist at 12 months. Every retained patient is a recurring revenue stream for the B2B customer — and the brand-outcome lever OpenLoop can credibly own. The economics are real; the intervention efficacy is the open question that the pilot is designed to answer.',
      walkthrough: '90K patients × 65% baseline discontinuation × 15% lift × $1,200 GMV × 12% fee = $1.3M. Add cross-brand and second-year tail to reach $2.4M Year 1. CRITICAL: 15% lift is assumed, not benchmarked — no peer-reviewed RCT exists.',
      strategicBullets: ['Highest strategic value in the backlog; weakest evidence base', 'Pilot-against-holdout structure measures causal lift before any scaling', 'Brand-outcome lever the GLP-1 cohort cannot deliver alone', 'Honest framing: no peer-reviewed RCT exists; treat as directional until pilot data lands'],
    },
    prd: {
      problemStatement: 'Published data shows 64.8% of GLP-1 patients without T2D discontinue within 12 months (2025 retrospective cohort, n=125,474). Arcadia\'s 1M+ prescription analysis shows only 34% remain at 12 months. Across MEDVi, Remedy Meds, and JoinFridays — OpenLoop\'s three weight-loss brands — this discontinuation curve is the dominant constraint on program LTV.',
      userStory: 'As an OpenLoop patient engagement specialist, I want AI-driven personalized outreach that detects early signals of discontinuation risk and triggers tailored intervention, so that 12-month retention improves measurably across the GLP-1 customer cohort.',
      acceptanceCriteria: [
        'Discontinuation-risk model with ≥65% precision on a held-out validation set.',
        'Outreach personalized per patient stage (initiation, plateau, side-effect, etc.).',
        'Opt-out controls visible and one-tap per channel (SMS, voice, email).',
        'Customer-brand identity preserved (white-labeled outreach per brand).',
      ],
      edgeCases: [
        'Patient expressing distress or side-effect crisis: immediate clinician escalation; AI does not handle.',
        'Cross-channel coordination: avoid duplicate outreach across SMS/voice/email.',
        'Customer brand wants to override AI cadence: explicit per-brand override controls.',
      ],
      outOfScope: [
        'Clinical recommendation changes (AI flags, clinician decides).',
        'Outreach to non-GLP-1 patients in v1 (sleep, HRT come later).',
        'Customer-brand-owned outreach campaigns (we layer atop, not replace).',
      ],
      successMetrics: [
        '12-month discontinuation rate from ~65% to <55% within 12 months of full deployment.',
        'Engagement rate on AI outreach ≥40% within 6 months.',
        'Customer-brand NPS impact neutral or positive within 6 months.',
      ],
    },
    buildPathDetail: {
      recommendation: 'Custom build with explicit pilot-against-holdout measurement structure. Validate lift before scaling. Start with one brand (MEDVi).',
      recommendationBullets: ['Custom build with pilot-against-holdout structure', 'Measure causal lift on 12-month persistence before scaling', 'Launch with MEDVi as the pilot brand', 'Honest assumption: no peer-reviewed RCT precedent'],
      phases: [
        { range: 'Wk 1-4', label: 'Risk model + outreach orchestration build' },
        { range: 'Wk 5-10', label: 'Pilot with holdout cohort (single brand)' },
        { range: 'Wk 11-14', label: 'Read results, decide scale or kill' },
      ],
      tags: ['Pilot-required', 'Evidence gap', 'Customer-brand sensitive'],
    },
    dependencies: [
      { name: 'HeyRevia voice channel posture decision', owner: 'VP Enterprise Technology / COO', status: 'open' },
      { name: 'Patient data flow (3 brands)', owner: 'Director of Data', status: 'open' },
      { name: 'Customer-brand sign-off (per brand)', owner: 'CCO team', status: 'open' },
      { name: 'Clinical escalation protocol', owner: 'Chief Medical Officer', status: 'pending' },
      { name: 'PHI handling + opt-in/opt-out review', owner: 'Governance owner', status: 'pending' },
    ],
    risks: [
      { label: 'Lift assumption unvalidated', description: '15% discontinuation reduction is assumed, not benchmarked; could be materially lower in pilot' },
      { label: 'Regulatory caution', description: 'FDA SaMD scope for AI-driven clinical communication is unclear; conservative legal posture warranted' },
      { label: 'Brand control', description: 'Outreach must feel like customer brand (MEDVi, Remedy Meds), not OpenLoop; tone/content governance is operational risk' },
    ],
  },

  {
    id: 'uc-006',
    addedAt: '2026-04-19',
    title: 'Automated medical coding for telehealth encounters',
    description: 'AI-assisted CPT/ICD coding from visit documentation; reduces coding cycle time and error-driven denials upstream.',
    bucket: 'Clinical Efficiency',
    cohort: 'Cross-cohort',
    pillars: ['Billing Workflows'],
    buildPath: 'Vendor Evaluation',
    status: 'active',
    voiceFlag: false,
    voicePosture: 'N/A',
    voiceRationale: 'Coding is documentation-driven, not voice.',
    phiFlag: true,
    sequencingFit: 'Aligned with sequencing',
    ttb_weeks: 10,
    ttfv_weeks: 10,
    complexity: 'Medium',
    annualValue: 1900000,
    scoring: {
      impact: { score: 3, rationale: '$1.9M annual capture; meaningful but mid-band.' },
      alignment: { score: 4, rationale: 'Bucket 1, billing pillar; pairs with denial management and ambient documentation.' },
      feasibility: { score: 4, rationale: 'Mature vendor market; CPT/ICD coding AI well-established. Limited differentiation by building vs. buying.' },
      ttfv: { score: 3, rationale: '10-week TTFV places this in the 8-16 week band.' },
      adoption: { score: 4, rationale: 'Internal RCM use case; low patient/customer-brand surface area.' },
      dependencies: { score: 4, rationale: 'Pairs with ambient documentation (UC-001); benefits compound when shipped together.' },
    },
    valueModel: {
      drivers: [
        { operator: '→', name: 'Annual encounters requiring coding', source: 'OpenLoop-stated', defaultValue: 3000000, unit: 'encounters' },
        { operator: '×', name: 'Coder time per encounter (baseline)', source: 'Industry benchmark', defaultValue: 4, unit: 'min' },
        { operator: '×', name: 'Coder fully-loaded cost', source: 'Inferred', defaultValue: 65, unit: '$/hour' },
        { operator: '×', name: 'Time reduction (AI-assisted)', source: 'Vendor benchmark', defaultValue: 0.50, unit: 'ratio' },
        { operator: '×', name: 'Year-1 coverage', source: 'Planning assumption', defaultValue: 0.40, unit: 'ratio' },
      ],
      compute: (v) => v[0] * (v[1] / 60) * v[2] * v[3] * v[4],
      valueStory: 'Coding sits between ambient documentation (UC-001) and denial management (UC-004). Better coding upstream means fewer denials downstream — the value here is partly direct margin, partly the multiplier effect on the adjacent use cases in the RCM stack.',
      walkthrough: '3M encounters × (4 min ÷ 60) × $65/hr × 50% reduction × 40% Year-1 coverage = $2.6M. Adjusted down to $1.9M for ramp/learning curve.',
      strategicBullets: ['Multiplier effect: better coding upstream means fewer denials downstream', 'Vendor evaluation path; differentiation is integration depth, not the model', 'Direct margin lever plus compounding effect on adjacent RCM use cases', 'Lowest standalone strategic value; highest stack-effect value'],
    },
    prd: {
      problemStatement: 'Medical coding across OpenLoop\'s 3M annual encounters represents both a direct labor cost and a primary upstream driver of denials downstream. Coding accuracy at the point of documentation directly affects first-pass acceptance rates and rework volume in UC-004.',
      userStory: 'As an OpenLoop medical coder, I want AI-assisted CPT/ICD code suggestions from clinical documentation, so that I review and confirm rather than build codes from scratch — and coding errors drop before they reach claim submission.',
      acceptanceCriteria: [
        'AI-suggested code accuracy ≥85% confirmed-as-correct rate by human coders.',
        'Coder cycle time per encounter reduced by 40%+ within 6 months.',
        'Integration with UC-001 (ambient documentation) — suggestions generated from ambient note.',
        'Audit trail per HTI-1 transparency requirements.',
      ],
      edgeCases: [
        'Specialty-specific coding (oncology, behavioral health): may require specialty-tuned models.',
        'Compound diagnosis cases: explicit human review required.',
        'New CPT/ICD code releases: model retraining and validation cycle.',
      ],
      outOfScope: [
        'Autonomous coding without human review in v1.',
        'Payer-specific coding optimization (separate domain).',
        'Documentation generation itself (handled by UC-001).',
      ],
      successMetrics: [
        'Coder time per encounter from ~4 min to <2.5 min within 6 months.',
        'Coding-driven denial rate from ~3% to <1% within 9 months.',
        'Coder satisfaction score (quarterly) net-positive within 6 months.',
      ],
    },
    buildPathDetail: {
      recommendation: 'Vendor evaluation with thin integration layer to UC-001 ambient notes and UC-004 denial workflow.',
      recommendationBullets: ['Vendor evaluation across coding-automation vendors', 'Thin integration layer to UC-001 (ambient notes)', 'Thin integration layer to UC-004 (denial workflow)', 'Differentiation comes from integration, not the model'],
      phases: [
        { range: 'Wk 1-3', label: 'Vendor evaluation + PoC' },
        { range: 'Wk 4-7', label: 'Integration with ambient docs + RCM' },
        { range: 'Wk 8-10', label: 'Pilot with coder team' },
      ],
      tags: ['Compounds with UC-001 / UC-004', 'Vendor market mature', 'Internal-facing'],
    },
    dependencies: [
      { name: 'UC-001 ambient documentation rollout', owner: 'AI Tech / Engineering', status: 'open' },
      { name: 'RCM system integration', owner: 'Director of Business Systems', status: 'open' },
      { name: 'Vendor BAA + governance review', owner: 'Governance owner', status: 'pending' },
    ],
    risks: [
      { label: 'Stack dependency', description: 'Multiplier value depends on UC-001 and UC-004 landing first; standalone ROI is thinner' },
      { label: 'Rare-code accuracy', description: 'Model accuracy on rare specialty codes is materially weaker than common codes; specialty mix matters' },
      { label: 'Downcoding leakage', description: 'Conservative coding for safety creates revenue leakage; tuning trades off compliance vs. capture' },
    ],
  },

  {
    id: 'uc-007',
    addedAt: '2026-04-24',
    title: 'Automated credentialing workflow for clinician onboarding',
    description: 'Automated primary source verification + payer enrollment; targets Medallion-pattern 40x intake speedup and 66% admin cost reduction.',
    bucket: 'Clinical Efficiency',
    cohort: 'Cross-cohort',
    pillars: ['Credentialing & Licensing'],
    buildPath: 'Vendor Evaluation',
    status: 'active',
    voiceFlag: false,
    voicePosture: 'N/A',
    voiceRationale: 'Document and verification-driven; no voice channel.',
    phiFlag: false,
    sequencingFit: 'Aligned with sequencing',
    ttb_weeks: 8,
    ttfv_weeks: 8,
    complexity: 'Low-Medium',
    annualValue: 2400000,
    scoring: {
      impact: { score: 3, rationale: '$2.4M annual capture; supports network scale economics directly.' },
      alignment: { score: 4, rationale: 'Bucket 1; addresses 20K+ clinician network operational backbone.' },
      feasibility: { score: 5, rationale: 'Mature vendor market (Medallion, Verifiable); proven 40x speedup.' },
      ttfv: { score: 4, rationale: '8-week TTFV via vendor evaluation.' },
      adoption: { score: 5, rationale: 'Internal back-office use case; minimal clinician/patient surface area.' },
      dependencies: { score: 4, rationale: 'NCQA accreditation considerations; existing credentialing process.' },
    },
    valueModel: {
      drivers: [
        { operator: '→', name: 'Annual credentialing events', source: 'Inferred (30% network turnover)', defaultValue: 6000, unit: 'events' },
        { operator: '×', name: 'Manual credentialing cost (fully loaded)', source: 'Industry benchmark', defaultValue: 3000, unit: '$/event' },
        { operator: '×', name: 'Admin cost reduction', source: 'Medallion benchmark', defaultValue: 0.66, unit: 'ratio' },
        { operator: '×', name: 'Year-1 coverage', source: 'Planning assumption', defaultValue: 0.60, unit: 'ratio' },
      ],
      compute: (v) => v[0] * v[1] * v[2] * v[3],
      valueStory: 'Credentialing is the operational backbone for OpenLoop\'s 20K+ clinician network. Faster credentialing = faster clinician activation = faster customer launch capacity. The Medallion 40x intake speedup benchmark is the headline; the strategic value is the platform\'s ability to scale clinician supply on demand.',
      walkthrough: '6K events × $3,000 fully-loaded × 66% reduction × 60% Year-1 coverage = $7.1M. Adjusted down to $2.4M for current baseline automation level and integration ramp.',
      strategicBullets: ['Faster credentialing = faster clinician activation = faster customer launch', 'Medallion benchmark: 66% admin reduction, 40x intake speedup', 'Vendor evaluation across Medallion + Verifiable; preserve OpenLoop process customization', 'Enables scale on the supply side of the platform\'s two-sided economics'],
    },
    prd: {
      problemStatement: 'OpenLoop\'s 20,000+ clinician network requires continuous credentialing and payer enrollment. Medallion has documented 40x faster intake (8 days → <2 hours) and 66% admin cost reduction across the industry. OpenLoop\'s current process is partly automated; the gap represents real near-term margin.',
      userStory: 'As an OpenLoop credentialing operations specialist, I want automated primary source verification, license validation, and payer enrollment workflows, so that new clinicians onboard in hours rather than days and existing clinicians re-credential without manual intervention.',
      acceptanceCriteria: [
        'Intake-to-credential-ready cycle time from 8 days to <1 day within 6 months.',
        'Primary source verification automated for 90%+ of new clinicians.',
        'Payer enrollment time reduced by 50%+ within 9 months.',
        'NCQA-aligned audit trail preserved.',
      ],
      edgeCases: [
        'State-specific licensing variation: per-state workflow rules required.',
        'Adverse actions on clinician record: explicit human review path.',
        'New customer contract terms with payer-specific credentialing: workflow extension.',
      ],
      outOfScope: [
        'Clinician recruiting itself (separate function).',
        'Provider credential maintenance reminders to clinicians directly (CMS-facing).',
        'Customer-brand-specific credentialing customization beyond template.',
      ],
      successMetrics: [
        'Intake-to-credential-ready time from 8 days to <1 day within 6 months.',
        'Credentialing cost per clinician from ~$3,000 to <$1,200 within 9 months.',
        'Re-credentialing cycle (annual): manual touches down 80% within 12 months.',
      ],
    },
    buildPathDetail: {
      recommendation: 'Vendor evaluation across Medallion and Verifiable. Thin integration layer; preserve OpenLoop process customization.',
      recommendationBullets: ['Evaluate vendors: Medallion, Verifiable', 'Build thin integration layer over winning vendor', 'Preserve OpenLoop process customization', '40x intake speedup is the benchmark to validate'],
      phases: [
        { range: 'Wk 1-2', label: 'Vendor selection + PoC' },
        { range: 'Wk 3-6', label: 'Integration + pilot state cohort' },
        { range: 'Wk 7-8', label: 'Network-wide rollout plan' },
      ],
      tags: ['Vendor market mature', 'NCQA-aligned', 'Network-scale lever'],
    },
    dependencies: [
      { name: 'Vendor BAA + procurement', owner: 'Governance owner / Procurement', status: 'pending' },
      { name: 'Existing credentialing system integration', owner: 'Director of Business Systems', status: 'open' },
      { name: 'NCQA audit trail compliance review', owner: 'Governance owner', status: 'pending' },
    ],
    risks: [
      { label: 'State regulatory variance', description: 'Some states will not accept partial automation in credentialing process; 50-state coverage requires state-by-state validation' },
      { label: 'Process homogenization', description: 'Vendor customization erosion risk if Medallion/Verifiable process flattens OpenLoop differentiation' },
      { label: 'Supply-demand mismatch', description: 'Faster credentialing could outrun customer demand pipeline; scale capacity ahead of utilization is a real cost' },
    ],
  },

  {
    id: 'uc-008',
    addedAt: '2026-05-01',
    title: 'Voice AI inbound triage with HeyRevia',
    description: 'Production-scale voice agent layer integrated with HeyRevia for clinical-context-aware inbound handling.',
    bucket: 'Clinical Efficiency',
    cohort: 'Cross-cohort',
    pillars: ['Patient Support', 'Technology Infrastructure'],
    buildPath: 'Custom Build',
    status: 'active',
    voiceFlag: true,
    voicePosture: 'Unify with HeyRevia',
    voiceRationale: 'Production-scale voice intelligence is the case for in-housing HeyRevia rather than wrapping it. Posture decision (inherited/partnered/parallel) materially shapes this build.',
    phiFlag: true,
    sequencingFit: 'Aligned with sequencing',
    ttb_weeks: 14,
    ttfv_weeks: 14,
    complexity: 'High',
    annualValue: 2200000,
    scoring: {
      impact: { score: 3, rationale: '$2.2M Year-1 capture; significant strategic upside in Bucket 3 productization.' },
      alignment: { score: 5, rationale: 'Core strategic question — does OpenLoop own voice or surrender it. Lensing\'s thesis says own.' },
      feasibility: { score: 2, rationale: 'High complexity; HeyRevia integration posture undecided; production voice quality bar is high.' },
      ttfv: { score: 2, rationale: '14-week TTFV places this in the 8-16 week band, lower end.' },
      adoption: { score: 3, rationale: 'Patient-facing; customer brand sensitivity; voice privacy concerns (33% of patients per published data).' },
      dependencies: { score: 2, rationale: 'HeyRevia integration posture decision is the gating dependency. Without it, this work cannot scope.' },
    },
    valueModel: {
      drivers: [
        { operator: '→', name: 'Annual inbound calls (eligible)', source: 'Inferred', defaultValue: 4500000, unit: 'calls' },
        { operator: '×', name: 'Voice deflection rate (mature)', source: 'Hyro mid-range', defaultValue: 0.30, unit: 'ratio' },
        { operator: '×', name: 'Cost differential per deflected call', source: 'Industry benchmark', defaultValue: 6.50, unit: '$/call' },
        { operator: '×', name: 'Year-1 coverage (post-integration)', source: 'Planning assumption', defaultValue: 0.25, unit: 'ratio' },
      ],
      compute: (v) => v[0] * v[1] * v[2] * v[3],
      valueStory: 'HeyRevia is a recent acquisition; its strategic value depends on how it integrates with the broader platform. The Year-1 deflection capture is real, but the bigger prize is settling the integration posture — which unlocks every downstream voice use case and shapes the Bucket 3 product category.',
      walkthrough: '4.5M calls × 30% deflection × $6.50 cost diff × 25% Year-1 coverage = $2.2M. Production-scale voice (vs. UC-003\'s Rapid Prototype) targets higher deflection at higher build cost.',
      strategicBullets: ['Year-1 deflection capture is real but understates the strategic prize', 'Integration posture decision unlocks every downstream voice use case', 'Shapes whether HeyRevia becomes platform infrastructure or a Bucket 3 product', 'Blocked until VP Enterprise Technology / COO settles the framework'],
    },
    prd: {
      problemStatement: 'OpenLoop\'s late-2025 acquisition of HeyRevia in-housed healthcare voice AI capability. The integration model (inherited / partnered / parallel) remains a politically open question. Until resolved, OpenLoop runs the risk of either duplicating capability or under-leveraging the asset. This use case is the production-scale execution of HeyRevia voice across OpenLoop\'s inbound footprint — paired with the architectural posture decision.',
      userStory: 'As an OpenLoop strategic leader, I want HeyRevia voice capability deployed at production scale across the customer base, so that voice becomes a platform capability rather than a parallel function — and the workflow ownership thesis extends into voice.',
      acceptanceCriteria: [
        'Voice agent containment rate ≥30% on production inbound (HeyRevia-powered).',
        'Clinical-context awareness — agent has secure read access to current patient state (under BAA).',
        'White-label voice persona per customer brand.',
        'Integration model documented and aligned across HeyRevia leadership, AI Tech, and engineering.',
      ],
      edgeCases: [
        'HeyRevia integration model not yet decided: this use case is gated on that posture decision.',
        'Production voice quality variance: explicit fallback to human agent on confidence threshold.',
        'Customer-brand-specific persona changes mid-rollout: brand override controls.',
      ],
      outOfScope: [
        'Outbound voice campaigns in v1 (subset of UC-005 adherence work).',
        'Clinical triage in v1 (route to clinician, don\'t triage).',
        'HeyRevia external customer support (UC focuses on internal deployment).',
      ],
      successMetrics: [
        'Voice containment rate from 0% to ≥30% within 12 months of go-live.',
        'Production voice quality CSAT within 5 points of human-agent CSAT within 12 months.',
        'HeyRevia integration model decided and operating by Week 6.',
      ],
    },
    buildPathDetail: {
      recommendation: 'Custom build atop HeyRevia. Integration framework decision is prerequisite, not output, of this build. Sequence: framework decision → architecture → build.',
      recommendationBullets: ['Custom build atop HeyRevia', 'HeyRevia integration framework decision is a prerequisite', 'Sequence: framework decision \u2192 architecture \u2192 build', 'Blocked until VP Enterprise Technology / COO decision'],
      phases: [
        { range: 'Wk 1-2', label: 'Integration framework decision (gating)' },
        { range: 'Wk 3-8', label: 'Architecture + voice persona library build' },
        { range: 'Wk 9-14', label: 'Pilot deployment with 2-3 customer brands' },
      ],
      tags: ['HeyRevia gating decision', 'Production-scale', 'Cross-brand'],
    },
    dependencies: [
      { name: 'HeyRevia integration posture decision', owner: 'VP Enterprise Technology / COO', status: 'blocked' },
      { name: 'HeyRevia leadership alignment', owner: 'COO + HeyRevia leadership', status: 'open' },
      { name: 'Telephony infrastructure scale-up', owner: 'Engineering / Tooling owner', status: 'open' },
      { name: 'PHI handling under BAA', owner: 'Governance owner', status: 'pending' },
    ],
    risks: [
      { label: 'Posture decision blocker', description: 'Build path cannot begin until VP Enterprise Technology / COO settle integration framework' },
      { label: 'Acquisition integration drag', description: 'HeyRevia org, tech, contract harmonization adds non-trivial overhead independent of this use case' },
      { label: 'Voice regulatory exposure', description: 'State-level autodialing rules and TCPA exposure; voice AI legal posture varies by jurisdiction' },
    ],
  },

  {
    id: 'uc-009',
    addedAt: '2026-05-09',
    title: 'AI sleep coach copilot for Happy Sleep',
    description: 'Personalized adherence + behavioral support agent for Happy Sleep diagnostic ring + sleep apnea care pathway.',
    bucket: 'Patient Engagement',
    cohort: 'Happy Sleep',
    pillars: ['Patient Support'],
    buildPath: 'Custom Build',
    status: 'active',
    voiceFlag: false,
    voicePosture: 'N/A',
    voiceRationale: 'Chat + push-based engagement; could extend to voice in a later iteration.',
    phiFlag: true,
    sequencingFit: 'Sequencing risk: depends on Bucket 1 maturity',
    ttb_weeks: 18,
    ttfv_weeks: 22,
    complexity: 'Medium-High',
    annualValue: 1400000,
    scoring: {
      impact: { score: 2, rationale: '$1.4M annual capture; single-customer scope limits magnitude.' },
      alignment: { score: 4, rationale: 'Operational template for Bucket 3 (productized AI clinical OS); Happy Sleep is the proof point.' },
      feasibility: { score: 3, rationale: 'Single customer, contained scope. Hardware + clinical pathway integration is complex.' },
      ttfv: { score: 2, rationale: '22-week TTFV places this in the >16 week band.' },
      adoption: { score: 4, rationale: 'Patient-facing within a focused product; customer brand committed.' },
      dependencies: { score: 3, rationale: 'Happy Sleep hardware data flow; sleep clinical pathway specificity.' },
    },
    valueModel: {
      drivers: [
        { operator: '→', name: 'Happy Sleep enrolled patients (estimated)', source: 'Inferred', defaultValue: 25000, unit: 'patients' },
        { operator: '×', name: 'Adherence lift from coaching', source: 'Assumed', defaultValue: 0.20, unit: 'ratio' },
        { operator: '×', name: 'Avg patient LTV impact', source: 'Inferred', defaultValue: 480, unit: '$/patient/year' },
        { operator: '×', name: 'OpenLoop capture share', source: 'Inferred', defaultValue: 0.30, unit: 'ratio' },
      ],
      compute: (v) => v[0] * v[1] * v[2] * v[3],
      valueStory: 'Happy Sleep is the clearest near-term Bucket 3 template — a hardware company embedded inside OpenLoop\'s clinical operating system. The customer-specific value is modest; the strategic value is the productization template it creates for the next hardware partner.',
      walkthrough: '25K patients × 20% adherence lift × $480 LTV impact × 30% OpenLoop capture = $720K. Add second-year compounding and platform-fee uplift to reach $1.4M.',
      strategicBullets: ['Customer-specific value is modest; productization template is the strategic prize', 'Hardware-meets-clinical-OS pattern — model for next hardware partner', 'Sequencing-blocked on Bucket 1 capability maturity (UC-001, UC-003)', 'Document templatability as part of the build, not after'],
    },
    prd: {
      problemStatement: 'Happy Sleep represents OpenLoop\'s clearest Bucket 3 operational template — hardware company plugging into the clinical operating system. Sleep apnea adherence (CPAP-equivalent behavioral compliance) is the dominant outcome driver, and a published gap. An AI coach copilot atop the Happy Sleep care pathway is both a value lever for the customer and a productizable template for similar future deployments.',
      userStory: 'As a Happy Sleep patient, I want personalized AI-driven coaching tied to my ring data and treatment plan, so that I stay engaged with the program and my sleep outcomes actually improve.',
      acceptanceCriteria: [
        'Personalization signals include ring data, intake responses, treatment milestones.',
        'Behavioral coaching paths reviewed and approved by clinical leadership.',
        'Adherence lift measurable against pre-launch baseline within 6 months.',
        'Customer-brand identity preserved (Happy Sleep-branded experience).',
      ],
      edgeCases: [
        'Patient ring data missing or inconsistent: degrade gracefully, no fake-personalization.',
        'Sleep-disorder severity outside coaching scope: route to clinician.',
        'Mental-health-adjacent disclosures during coaching: explicit clinical escalation.',
      ],
      outOfScope: [
        'Sleep diagnosis or clinical decision-making (AI flags, clinician decides).',
        'Hardware customization or firmware (Happy Sleep domain).',
        'Cross-customer template before Happy Sleep validates.',
      ],
      successMetrics: [
        'Patient engagement on AI coach ≥50% weekly active within 6 months.',
        '90-day adherence to treatment from baseline (TBD) to +20 points within 9 months.',
        'Happy Sleep CSAT impact net-positive within 6 months.',
      ],
    },
    buildPathDetail: {
      recommendation: 'Custom build with explicit dual purpose — Happy Sleep value delivery + Bucket 3 template development. Document templatability as part of the build.',
      recommendationBullets: ['Custom build with explicit dual purpose', 'Deliver value to Happy Sleep (the immediate customer)', 'Develop Bucket 3 productization template (the strategic prize)', 'Document templatability as part of the build'],
      phases: [
        { range: 'Wk 1-4', label: 'Care pathway mapping + ring data integration' },
        { range: 'Wk 5-14', label: 'Coaching engine build + clinical review cycle' },
        { range: 'Wk 15-22', label: 'Pilot with Happy Sleep cohort + measurement' },
      ],
      tags: ['Bucket 3 template', 'Single-customer scope', 'Hardware integration'],
    },
    dependencies: [
      { name: 'Happy Sleep data integration', owner: 'Engineering', status: 'open' },
      { name: 'Clinical pathway sign-off', owner: 'Chief Medical Officer', status: 'pending' },
      { name: 'Bucket 1 capabilities (UC-001) deployment status', owner: 'AI Tech', status: 'open' },
      { name: 'PHI handling review', owner: 'Governance owner', status: 'pending' },
    ],
    risks: [
      { label: 'Customer concentration', description: 'Single-customer scope makes ROI dependent on Happy Sleep contract durability' },
      { label: 'Sequencing blocker', description: 'Bucket 1 capability maturity is upstream blocker; timing uncertain and outside this work scope' },
      { label: 'Template ROI', description: 'Productization value only realizes if 2+ hardware partners materialize within 18 months' },
    ],
  },

  {
    id: 'uc-010',
    addedAt: '2026-05-16',
    title: 'Productized AI clinical OS module (Bucket 3 strategic bet)',
    description: 'Standalone, customer-sellable AI capability layer — the productization of OpenLoop\'s internal AI stack as a new revenue line.',
    bucket: 'Market Expansion',
    cohort: 'Cross-cohort (new customer segments)',
    pillars: ['Technology Infrastructure'],
    buildPath: 'Custom Build',
    status: 'active',
    voiceFlag: true,
    voicePosture: 'Unify with HeyRevia',
    voiceRationale: 'Bucket 3 productization includes voice; HeyRevia capability is the differentiation lever.',
    phiFlag: true,
    sequencingFit: 'Sequencing risk: depends on Bucket 1 maturity',
    ttb_weeks: 24,
    ttfv_weeks: 32,
    complexity: 'Strategic',
    annualValue: 5000000,
    scoring: {
      impact: { score: 5, rationale: 'Strategic / multiple-expansion bucket. $5M Year-1 capture is conservative; equity-story magnifier.' },
      alignment: { score: 5, rationale: 'Lensing\'s stated Bucket 3 destination. "De facto digital health operating system" framing.' },
      feasibility: { score: 2, rationale: 'High complexity. Requires Bucket 1 maturity, HeyRevia integration, productization architecture.' },
      ttfv: { score: 1, rationale: '32-week TTFV places this clearly in the >24 week band.' },
      adoption: { score: 2, rationale: 'New customer segments; product-market-fit risk; sales motion not yet built.' },
      dependencies: { score: 2, rationale: 'Heavy dependencies: Bucket 1, HeyRevia, data platform, productization architecture.' },
    },
    valueModel: {
      drivers: [
        { operator: '→', name: 'Target Year-1 customers', source: 'Planning assumption', defaultValue: 4, unit: 'customers' },
        { operator: '×', name: 'Average contract value', source: 'Inferred', defaultValue: 1500000, unit: '$' },
        { operator: '×', name: 'OpenLoop gross margin on productized AI', source: 'Inferred', defaultValue: 0.80, unit: 'ratio' },
        { operator: '×', name: 'Year-1 revenue capture (partial year)', source: 'Planning assumption', defaultValue: 0.50, unit: 'ratio' },
      ],
      compute: (v) => v[0] * v[1] * v[2] * v[3],
      valueStory: 'This is the bet, not the calculation. Productizing the clinical operating system turns OpenLoop\'s internal capability into a new revenue category. Year-1 dollars are de minimis; the real value is equity multiple expansion if the productization template lands with even two lighthouse customers.',
      walkthrough: '4 customers × $1.5M ACV × 80% gross margin × 50% Year-1 capture = $2.4M. Add equity-story multiple expansion and second-year tail to reach $5M strategic-value framing.',
      strategicBullets: ['Bucket 3 strategic capability — turns internal AI muscle into a new revenue line', 'Year-1 dollars are de minimis; real value is equity multiple expansion', 'Two lighthouse customers in 18 months is the validation milestone', 'Phased: 6 months Bucket 1 maturity validation → 12 months productization'],
    },
    prd: {
      problemStatement: 'Lensing\'s Bucket 3 thesis is the productization of OpenLoop\'s AI capability layer as a standalone offering — "embed companies with AI-powered clinical operating systems." This is the bucket that re-rates the equity story. Happy Sleep is the operational template; Bucket 3 builds the productizable version for the next wave of hardware, retail, and adjacent customers.',
      userStory: 'As an OpenLoop strategic leader, I want a productized AI clinical OS module that can be sold standalone (or modular) to new customer segments, so that AI becomes a new revenue line rather than just an internal margin lever — directly compounding the equity story.',
      acceptanceCriteria: [
        'First Bucket 3 customer in production within 9 months.',
        'Module architecture supports brand customization without per-customer engineering.',
        'Productized pricing model defined and validated with 2+ prospects.',
        'HeyRevia voice capability integrated as differentiation lever.',
      ],
      edgeCases: [
        'Customer wants partial-only deployment (not full OS): explicit modular tier.',
        'Productization conflicts with white-label customer relationship: brand contract review.',
        'Bucket 1 capabilities not yet mature enough to support productization: sequencing fallback.',
      ],
      outOfScope: [
        'New customer acquisition function (CCO / sales domain).',
        'Hardware product development (partner with hardware companies, don\'t build).',
        'Retail / employer channel-specific customization in v1.',
      ],
      successMetrics: [
        'First Bucket 3 customer signed within 6 months; in production within 9.',
        'Bucket 3 revenue line attributable to ≥3% of total revenue within 18 months.',
        'IPO/M&A narrative explicitly references productized AI as a differentiation pillar.',
      ],
    },
    buildPathDetail: {
      recommendation: 'Custom build with strategic phasing. First 6 months: Bucket 1 maturity validation + architecture. Next 12: productization + first customer.',
      recommendationBullets: ['Custom build with strategic phasing', 'Months 1-6: Bucket 1 maturity validation + architecture', 'Months 7-18: productization + first external customer', 'Dollar figure understates equity-multiple value (Bucket 3 bet)'],
      phases: [
        { range: 'Wk 1-8', label: 'Architecture + Bucket 1 maturity assessment' },
        { range: 'Wk 9-20', label: 'Productization + first-customer build' },
        { range: 'Wk 21-32', label: 'First customer in production + sales motion' },
      ],
      tags: ['Bucket 3 / multiple-expansion', 'Sequencing-gated', 'Strategic urgency'],
    },
    dependencies: [
      { name: 'Bucket 1 capability maturity (UC-001, UC-003, UC-004, UC-007)', owner: 'AI Tech', status: 'open' },
      { name: 'HeyRevia integration decision (UC-008)', owner: 'VP Enterprise Technology / COO', status: 'blocked' },
      { name: 'Productization architecture', owner: 'Tooling owner / Engineering', status: 'open' },
      { name: 'Bucket 3 customer pipeline', owner: 'CCO team', status: 'open' },
      { name: 'IPO narrative alignment', owner: 'CEO / CFO', status: 'open' },
    ],
    risks: [
      { label: 'Market timing', description: 'Productized AI healthcare platform space is now crowded; window may be closing' },
      { label: 'CAC not modeled', description: 'Lighthouse customer hunt is expensive; customer acquisition cost is the biggest unmodeled line item' },
      { label: 'Internal cannibalization', description: 'Productization may conflict with B2B services GTM; commercial overlap risk needs governance' },
      { label: 'Product muscle', description: 'Services org productizing requires product management discipline not currently in-house' },
    ],
  },
];

const KILLED_USE_CASES = [
  {
    id: 'kill-001',
    title: 'Autonomous AI clinical risk scoring for telehealth triage',
    reasonShort: 'Failure precedent + governance overhead exceeds value.',
    reasonLong: 'Epic Sepsis Model precedent: 33% sensitivity in external validation despite 76% AUC claimed internally; deployed at 100+ hospitals before the gap surfaced. Cost-of-error in clinical setting plus post-breach governance overhead exceeds defensible value capture. Distinct from clinical decision support tools designed under 21st Century Cures Act CDS exclusion (clinician override + transparency + non-replacement of judgment) — those remain in scope as future use cases under tighter governance.',
    disposition: 'Revisit only with prospective external validation cohort + Governance owner sign-off.',
  },
  {
    id: 'kill-002',
    title: 'Generative AI for patient-facing marketing content',
    reasonShort: 'Out of scope; wrong organizational owner.',
    reasonLong: 'Generative content for customer-brand patient marketing belongs in customer brand operations, not AI Technologies. Generic marketing content also commoditized — limited durable value in OpenLoop building this internally. Hand-off pattern: refer to Customer Success / brand ops counterpart with vendor-eval support if requested.',
    disposition: 'Referred to Customer Success / brand ops function.',
  },
  {
    id: 'kill-003',
    title: 'AI-driven payer-side denial generation',
    reasonShort: 'AMA opposition + regulatory risk + customer-relationship damage.',
    reasonLong: 'Adjacent to UC-004 (provider-side denial prevention) but inverted. AMA documented AI denial tools producing 16x typical denial rates; AMA opposed batch denials without clinical review; CMS Medicare Advantage AI rule pending. Even where technically buildable, regulatory + customer-relationship risk dominates value. Worth surfacing this kill explicitly: distinguishing provider-side (UC-004, valuable) from payer-side (this kill) is the muscle the role requires.',
    disposition: 'Parked. Revisit only if regulatory landscape and customer posture materially shift.',
  },
];

// ===========================================================================
// HELPERS
// ===========================================================================

function computeComposite(scoring, weights) {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;
  const weighted =
    scoring.impact.score * weights.impact +
    scoring.alignment.score * weights.alignment +
    scoring.feasibility.score * weights.feasibility +
    scoring.ttfv.score * weights.ttfv +
    scoring.adoption.score * weights.adoption +
    scoring.dependencies.score * weights.dependencies;
  return (weighted / totalWeight) * 20; // normalize to 0-100
}

function formatCurrency(n) {
  if (typeof n !== 'number' || isNaN(n) || !isFinite(n)) return '$—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1000000000) return `${sign}$${(abs / 1000000000).toFixed(1)}B`;
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(0)}K`;
  return `${sign}$${abs}`;
}

function formatWeeks(n) {
  if (n < 4) return `${n} wks`;
  if (n < 12) return `${n} wks`;
  return `${Math.round(n / 4.33)} mo`;
}

function rankUseCases(useCases, weights, sortBy) {
  const scored = useCases.map((uc) => ({
    ...uc,
    composite: computeComposite(uc.scoring, weights),
  }));

  switch (sortBy) {
    case 'value':
      return scored.sort((a, b) => b.annualValue - a.annualValue);
    case 'ttv':
      return scored.sort((a, b) => a.ttfv_weeks - b.ttfv_weeks);
    case 'composite':
    default:
      return scored.sort((a, b) => b.composite - a.composite);
  }
}

function applyFilters(useCases, filters) {
  const now = new Date();
  const daysAgo = (d) => {
    const ms = now - new Date(d);
    return ms / (1000 * 60 * 60 * 24);
  };
  return useCases.filter((uc) => {
    if (filters.bucket !== 'all' && uc.bucket !== filters.bucket) return false;
    if (filters.cohort !== 'all' && !uc.cohort.toLowerCase().includes(filters.cohort.toLowerCase())) return false;
    if (filters.addedWithin !== 'all' && uc.addedAt) {
      const age = daysAgo(uc.addedAt);
      if (filters.addedWithin === 'day' && age > 1) return false;
      if (filters.addedWithin === 'week' && age > 7) return false;
      if (filters.addedWithin === '30days' && age > 30) return false;
      if (filters.addedWithin === '90days' && age > 90) return false;
      if (filters.addedWithin === '90plus' && age <= 90) return false;
    }
    return true;
  });
}

// ===========================================================================
// SHARED COMPONENTS
// ===========================================================================

function TagPill({ label, variant = 'default', icon = null }) {
  // Classes covered by standard Tailwind utilities (always safe)
  const classStyles = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    cohort: 'bg-slate-100 text-slate-700 border-slate-200',
    pillar: 'bg-stone-100 text-stone-700 border-stone-200',
    build: 'bg-blue-50 text-blue-800 border-blue-200',
    phi: 'bg-amber-50 text-amber-800 border-amber-200',
    voice: 'bg-violet-50 text-violet-800 border-violet-200',
    seq_risk: 'bg-rose-50 text-rose-800 border-rose-200',
  };
  // Variants that use brand colors with opacity — use inline styles so they survive
  // production Tailwind builds (where arbitrary-value classes with opacity require
  // explicit safelist).
  const brandVariants = {
    bucket: { backgroundColor: 'rgba(31, 58, 95, 0.1)', color: NAVY, borderColor: 'rgba(31, 58, 95, 0.2)' },
    bucket_pe: { backgroundColor: 'rgba(61, 117, 150, 0.1)', color: STEEL, borderColor: 'rgba(61, 117, 150, 0.3)' },
    bucket_me: { backgroundColor: 'rgba(163, 139, 91, 0.1)', color: BRONZE, borderColor: 'rgba(163, 139, 91, 0.3)' },
  };
  const isBrand = !!brandVariants[variant];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${
        isBrand ? '' : (classStyles[variant] || classStyles.default)
      }`}
      style={isBrand ? brandVariants[variant] : undefined}
    >
      {icon}
      {label}
    </span>
  );
}

function bucketVariant(bucket) {
  if (bucket === 'Clinical Efficiency') return 'bucket';
  if (bucket === 'Patient Engagement') return 'bucket_pe';
  return 'bucket_me';
}

function ScoreBadge({ score, rank, size = 'lg' }) {
  const sizeClass = size === 'lg' ? 'text-3xl font-semibold' : 'text-xl font-semibold';
  const safeScore = typeof score === 'number' && !isNaN(score) && isFinite(score) ? score : 0;
  return (
    <div className="flex flex-col items-end">
      <div className={`${sizeClass} tabular-nums leading-none`} style={{ color: NAVY }}>
        {safeScore.toFixed(0)}
      </div>
      {typeof rank === 'number' && rank > 0 && (
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">
          Rank #{rank}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }) {
  const color =
    status === 'blocked' ? 'bg-red-500' :
    status === 'open' ? 'bg-amber-400' :
    status === 'pending' ? 'bg-gray-300' :
    status === 'done' ? 'bg-emerald-500' :
    'bg-gray-300';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

// Computes a completeness score (0-3) per use case based on three dimensions:
// PRD richness, sizing depth, scoring rationale density.
// Each dimension contributes 0 or 1 to the total.
function computeCompleteness(useCase) {
  let score = 0;
  const reasons = [];

  // 1. PRD richness — needs problem statement + user story + ≥3 acceptance criteria,
  //    plus at least one of edge cases or success metrics
  const prd = useCase.prd || {};
  const prdRich =
    (prd.problemStatement || '').length > 40 &&
    (prd.userStory || '').length > 20 &&
    Array.isArray(prd.acceptanceCriteria) && prd.acceptanceCriteria.length >= 3 &&
    ((Array.isArray(prd.edgeCases) && prd.edgeCases.length >= 1) ||
     (Array.isArray(prd.successMetrics) && prd.successMetrics.length >= 1));
  if (prdRich) score += 1;
  else reasons.push('Thin PRD (problem, user story, criteria, edge cases, or metrics missing)');

  // 2. Sizing depth — either ≥3 numeric drivers OR ≥2 assumptions with at least one benchmark-grade source
  const vm = useCase.valueModel || {};
  const driversOK = Array.isArray(vm.drivers) && vm.drivers.length >= 3;
  const assumptionsOK = Array.isArray(vm.assumptions) && vm.assumptions.length >= 2 &&
    vm.assumptions.some((a) => (SOURCE_CONFIDENCE[a?.source] || 0) >= 75);
  const sizingDeep = driversOK || assumptionsOK;
  if (sizingDeep) score += 1;
  else reasons.push('Shallow sizing (needs ≥3 drivers, or ≥2 assumptions with at least one benchmark source)');

  // 3. Scoring rationale density — all 6 rubric dimensions have substantive rationales (>30 chars)
  const sc = useCase.scoring || {};
  const dims = ['impact', 'alignment', 'feasibility', 'ttfv', 'adoption', 'dependencies'];
  const rationalesDense = dims.every((d) => (sc[d]?.rationale || '').length > 30);
  if (rationalesDense) score += 1;
  else reasons.push('Sparse scoring rationales (one or more dimensions lack substantive justification)');

  return { score, reasons };
}

function CompletenessDots({ useCase, size = 'sm' }) {
  const { score, reasons } = computeCompleteness(useCase);
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const labels = ['Thin', 'Partial', 'Well-formed', 'Fully informed'];
  const label = labels[score] || 'Unknown';
  const tooltip = score === 3
    ? 'Fully informed: rich PRD, deep sizing, and substantive scoring rationales across all dimensions.'
    : `Completeness: ${score}/3. Improve by addressing: ${reasons.join('; ')}.`;

  return (
    <div className="inline-flex items-center gap-1.5" title={tooltip}>
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${dotSize} rounded-full border`}
            style={i < score
              ? { backgroundColor: NAVY, borderColor: NAVY }
              : { backgroundColor: 'transparent', borderColor: '#D1D5DB' }}
          />
        ))}
      </div>
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{label}</span>
    </div>
  );
}

function Panel({ title, subtitle, action, children, dense = false }) {
  return (
    <div className="border border-gray-200 rounded-md bg-white">
      <div className={`flex items-start justify-between px-4 ${dense ? 'py-2.5' : 'py-3'} border-b border-gray-100`}>
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">{title}</div>
          {subtitle && <div className="text-sm text-gray-700 mt-0.5">{subtitle}</div>}
        </div>
        {action}
      </div>
      <div className={dense ? 'p-3' : 'p-4'}>{children}</div>
    </div>
  );
}

// ===========================================================================
// BACKLOG VIEW
// ===========================================================================

function FilterStrip({ filters, setFilters }) {
  const allCohorts = ['all', 'Cross-cohort', 'MEDVi', 'Remedy Meds', 'JoinFridays', 'Happy Sleep'];
  const timeOptions = [
    { value: 'all', label: 'all' },
    { value: 'day', label: 'last day' },
    { value: 'week', label: 'last week' },
    { value: '30days', label: 'last 30 days' },
    { value: '90days', label: 'last 90 days' },
    { value: '90plus', label: '90+ days ago' },
  ];
  const isDirty = filters.bucket !== 'all' || filters.cohort !== 'all' || filters.addedWithin !== 'all';
  return (
    <div className="flex flex-wrap gap-2 items-center pb-3">
      <FilterSelect
        label="AI Strategy Bucket"
        value={filters.bucket}
        options={['all', ...ALL_BUCKETS]}
        onChange={(v) => setFilters({ ...filters, bucket: v })}
      />
      <FilterSelect
        label="Customer cohort"
        value={filters.cohort}
        options={allCohorts}
        onChange={(v) => setFilters({ ...filters, cohort: v })}
      />
      <FilterSelectLabeled
        label="Added in"
        value={filters.addedWithin}
        options={timeOptions}
        onChange={(v) => setFilters({ ...filters, addedWithin: v })}
      />
      {isDirty && (
        <button
          onClick={() => setFilters({ bucket: 'all', cohort: 'all', addedWithin: 'all' })}
          className="text-xs text-gray-500 hover:text-gray-700 underline px-2 self-end pb-1.5"
        >
          Reset
        </button>
      )}
    </div>
  );
}

function FilterSelectLabeled({ label, value, options, onChange }) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-gray-200 rounded px-2 py-1 bg-white hover:border-gray-300 focus:outline-none focus:border-[#1F3A5F]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  // Convert label to lowercase while preserving acronyms like "AI"
  const labelLower = label.replace(/AI/g, '__AI__').toLowerCase().replace(/__ai__/g, 'AI');
  // Strip a trailing "s" if the label is plural so "Any" reads naturally
  // ("All customer cohorts" → "Any customer cohort"). Bucket → bucket (no plural).
  const singular = labelLower.endsWith('s') ? labelLower.slice(0, -1) : labelLower;
  return (
    <div className="flex flex-col">
      <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-gray-200 rounded px-2 py-1 bg-white hover:border-gray-300 focus:outline-none focus:border-[#1F3A5F]"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === 'all' ? `Any ${singular}` : opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function BacklogCard({ useCase, rank, onClick }) {
  const isSubmitted = useCase.submitted;
  return (
    <div
      onClick={onClick}
      className={`border rounded-md bg-white p-4 hover:shadow-sm cursor-pointer transition-all ${
        isSubmitted
          ? 'border-emerald-300 ring-1 ring-emerald-200 hover:border-emerald-500'
          : 'border-gray-200 hover:border-[#1F3A5F]'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-16 text-right">
          <ScoreBadge score={useCase.composite} rank={rank} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2 min-w-0">
              {isSubmitted && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold flex-shrink-0">New</span>
              )}
              <h3 className="text-base font-semibold text-gray-900 leading-tight truncate">{useCase.title}</h3>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 leading-none">Time to value</div>
                <div className="text-sm font-medium text-gray-700 tabular-nums mt-0.5">{formatWeeks(useCase.ttfv_weeks)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 leading-none">Annual value</div>
                <div className="text-sm font-medium text-gray-900 tabular-nums mt-0.5">{formatCurrency(useCase.annualValue)}</div>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1 leading-snug">{useCase.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-2.5 items-center">
            <TagPill label={useCase.bucket} variant={bucketVariant(useCase.bucket)} />
            <TagPill label={useCase.cohort} variant="cohort" />
            <TagPill label={useCase.buildPath} variant="build" />
            {useCase.phiFlag && <TagPill label="PHI" variant="phi" icon={<Shield size={10} />} />}
            {useCase.voiceFlag && <TagPill label="Voice" variant="voice" icon={<Mic size={10} />} />}
            {useCase.sequencingFit.startsWith('Sequencing risk') && (
              <TagPill label="Sequencing risk" variant="seq_risk" icon={<AlertTriangle size={10} />} />
            )}
            <div className="ml-auto">
              <CompletenessDots useCase={useCase} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BacklogView({ useCases, weights, filters, setFilters, sortBy, setSortBy, onSelectUseCase }) {
  const filtered = applyFilters(useCases, filters);
  const ranked = rankUseCases(filtered, weights, sortBy);
  // Establish original ranks from full list for stable rank display
  const fullRanked = rankUseCases(useCases, weights, sortBy);
  const rankMap = new Map(fullRanked.map((uc, i) => [uc.id, i + 1]));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">AI Use Case Backlog</h1>
          <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">
            The single ranked queue of every active AI investment under consideration. Each item carries its own evidence base — open one to inspect, edit drivers, or pressure-test the score.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1 bg-white hover:border-gray-300 focus:outline-none focus:border-[#1F3A5F]"
          >
            <option value="composite">Composite score</option>
            <option value="value">Annual value</option>
            <option value="ttv">Time to value</option>
          </select>
        </div>
      </div>

      <FilterStrip filters={filters} setFilters={setFilters} />

      <div className="flex items-center gap-2 mt-1 mb-2 text-[11px] text-gray-500">
        <span className="font-medium uppercase tracking-wider">Use case completeness:</span>
        <div className="inline-flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NAVY }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NAVY }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NAVY }} />
        </div>
        <span>= rich PRD, deep sizing, dense scoring rationales. Fewer dots = thinner data behind the ranking.</span>
      </div>

      <div className="space-y-2 mt-2">
        {ranked.length === 0 ? (
          <div className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-md">
            No use cases match the current filters.
          </div>
        ) : (
          ranked.map((uc) => (
            <BacklogCard
              key={uc.id}
              useCase={uc}
              rank={rankMap.get(uc.id)}
              onClick={() => onSelectUseCase(uc.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// PROFILE VIEW — PANELS
// ===========================================================================

function ScatterPanel({ useCase, allUseCases }) {
  // Compute sequential short labels: seed cases use their existing ID (uc-001 → "001"),
  // submitted cases get the next sequential number starting at 011, 012, etc.
  let nextSubmittedIndex = 11;
  const data = allUseCases.map((uc) => {
    let shortLabel;
    if (uc.id.startsWith('uc-submitted-')) {
      shortLabel = String(nextSubmittedIndex).padStart(3, '0');
      nextSubmittedIndex += 1;
    } else if (uc.id.startsWith('uc-')) {
      shortLabel = uc.id.replace('uc-', '').slice(0, 3);
    } else {
      shortLabel = uc.id.slice(-3);
    }
    return {
      x: uc.ttb_weeks,
      y: uc.ttfv_weeks,
      z: Math.max(Math.sqrt(Math.max(uc.annualValue || 0, 0)) / 30, 8),
      name: uc.title,
      bucket: uc.bucket,
      current: uc.id === useCase.id,
      annualValue: uc.annualValue,
      shortLabel,
    };
  });

  // Which buckets are actually present (for a tidy legend)
  const presentBuckets = Array.from(new Set(allUseCases.map((uc) => uc.bucket)));

  return (
    <Panel
      title="Time to Build vs Time to Value"
      subtitle="Every active use case in the backlog. Bubble size = annual value. Color = AI Strategy Bucket. Highlighted bubble (amber outline) is the current use case."
    >
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              type="number"
              dataKey="x"
              name="Time to build"
              unit="w"
              tick={{ fontSize: 11, fill: '#6B7280' }}
              label={{ value: 'Time to build (weeks)', position: 'insideBottom', offset: -15, fontSize: 11, fill: '#6B7280' }}
              domain={[0, 28]}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Time to value"
              unit="w"
              tick={{ fontSize: 11, fill: '#6B7280' }}
              label={{ value: 'Time to value (weeks)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6B7280' }}
              domain={[0, 36]}
            />
            <ZAxis type="number" dataKey="z" range={[60, 400]} />
            <ReferenceArea x1={0} x2={8} y1={0} y2={8} fill="#10B981" fillOpacity={0.06} label={{ value: 'Fast Prototype, Fast Value', fontSize: 10, fill: '#059669', position: 'insideTopLeft' }} />
            <ReferenceArea x1={16} x2={28} y1={16} y2={36} fill="#1F3A5F" fillOpacity={0.05} label={{ value: 'Strategic Infrastructure', fontSize: 10, fill: '#1F3A5F', position: 'insideBottomRight' }} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-gray-200 shadow-md rounded px-3 py-2 text-xs">
                    <div className="font-medium text-gray-900">{d.name}</div>
                    <div className="text-gray-600 mt-1">TTB: {d.x} wks · TTV: {d.y} wks</div>
                    <div className="text-gray-600">Annual value: {formatCurrency(d.annualValue)}</div>
                    <div className="text-gray-500 italic mt-1">Bucket: {d.bucket}</div>
                  </div>
                );
              }}
            />
            <Scatter data={data}>
              <LabelList
                dataKey="shortLabel"
                position="top"
                offset={8}
                content={(props) => {
                  const { x, y, value, index } = props;
                  const point = data[index];
                  const isCurrent = point && point.current;
                  return (
                    <text
                      x={x}
                      y={y}
                      dy={-4}
                      textAnchor="middle"
                      fontSize={isCurrent ? 11 : 10}
                      fontWeight={isCurrent ? 700 : 500}
                      fill={isCurrent ? '#B45309' : '#6B7280'}
                      style={{ pointerEvents: 'none' }}
                    >
                      {value}
                    </text>
                  );
                }}
              />
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={BUCKET_COLORS[entry.bucket]}
                  fillOpacity={entry.current ? 1 : 0.65}
                  stroke={entry.current ? '#F59E0B' : BUCKET_COLORS[entry.bucket]}
                  strokeWidth={entry.current ? 4 : 1}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {/* Color legend */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">AI Strategy Bucket</div>
        {presentBuckets.map((b) => (
          <div key={b} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BUCKET_COLORS[b] }} />
            <div className="text-xs text-gray-700">{b}</div>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-3.5 h-3.5 rounded-full bg-gray-300" style={{ boxShadow: '0 0 0 2px #F59E0B' }} />
          <div className="text-xs text-gray-700">Current use case</div>
        </div>
      </div>
      {/* Use case ID legend */}
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-600">
        {data.map((d, i) => (
          <div key={i} className={`flex items-baseline gap-1.5 ${d.current ? 'font-semibold text-gray-900' : ''}`}>
            <span className="font-mono text-gray-500 w-7 flex-shrink-0">{d.shortLabel}</span>
            <span className="truncate">{d.name}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SourceCell({ source }) {
  const [open, setOpen] = useState(false);
  const detail = SOURCE_DETAILS[source];
  return (
    <span
      className="relative inline-block cursor-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className={`italic text-gray-500 ${detail ? 'underline decoration-dotted decoration-gray-400 underline-offset-2' : ''}`}>
        {source}
      </span>
      {open && detail && (
        <span className="absolute z-30 top-full left-0 mt-1.5 w-72 p-2.5 bg-gray-900 text-white text-[11px] rounded shadow-lg leading-relaxed not-italic font-normal pointer-events-none">
          <span className="block text-amber-300 font-medium mb-1">{source}</span>
          {detail}
        </span>
      )}
    </span>
  );
}

function ValueModelPanel({ useCase }) {
  if (useCase.valueModel.isStatic) {
    return <StaticValueModelPanel useCase={useCase} />;
  }
  return <EditableValueModelPanel useCase={useCase} />;
}

function StaticValueModelPanel({ useCase }) {
  const confidence = computeSizingConfidence(useCase);
  const tier = confidenceTier(confidence);
  const rationale = buildConfidenceRationale(useCase);
  return (
    <Panel
      title="Value Model"
      subtitle={
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-semibold tabular-nums" style={{ color: NAVY }}>{formatCurrency(useCase.valueModel.total)}</span>
            <span className="text-xs text-gray-500">annual capture estimate</span>
            {tier && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tier.classes}`}>
                {tier.label} confidence · {confidence}/100
              </span>
            )}
          </div>
          {rationale && (
            <div className="text-[11px] text-gray-600 mt-1 leading-snug italic">{rationale}</div>
          )}
        </div>
      }
    >
      {useCase.valueModel.valueStory && (
        <div className="mb-3 pb-3 border-b border-gray-100">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Value story</div>
          <div className="text-sm text-gray-800 leading-relaxed">{useCase.valueModel.valueStory}</div>
        </div>
      )}
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Calculation walkthrough</div>
      <div className="text-xs text-gray-600 mb-3 leading-relaxed">{useCase.valueModel.walkthrough}</div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2">Named assumptions</div>
      <div className="space-y-1.5">
        {useCase.valueModel.assumptions.map((a, i) => (
          <div key={i} className="border border-gray-100 rounded px-3 py-2 text-xs">
            <div className="text-gray-800 leading-snug">{a.assumption}</div>
            <div className="flex items-center gap-2 mt-1 text-[10px]">
              <span className={`px-1.5 py-0.5 rounded font-medium ${
                a.confidence === 'HIGH' ? 'bg-emerald-50 text-emerald-700' :
                a.confidence === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                'bg-rose-50 text-rose-700'
              }`}>{a.confidence}</span>
              <SourceCell source={a.source} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-gray-500">
        AI-generated sizing. Assumptions tagged with confidence and source.
      </div>
      {useCase.valueModel.strategicBullets && useCase.valueModel.strategicBullets.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Strategic alignment</div>
          <ul className="text-xs text-gray-700 space-y-1 leading-relaxed">
            {useCase.valueModel.strategicBullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gray-400 flex-shrink-0">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function EditableValueModelPanel({ useCase }) {
  // Defensive coercion in case the value model lacks expected fields
  const drivers = Array.isArray(useCase?.valueModel?.drivers) ? useCase.valueModel.drivers : [];
  const computeFn = typeof useCase?.valueModel?.compute === 'function'
    ? useCase.valueModel.compute
    : (vals) => vals.reduce((acc, v) => acc * (v || 0), 1);

  const [driverValues, setDriverValues] = useState(drivers.map((d) => d?.defaultValue ?? 0));

  // Reset when useCase changes
  React.useEffect(() => {
    setDriverValues(drivers.map((d) => d?.defaultValue ?? 0));
  }, [useCase.id]);

  const total = computeFn(driverValues);
  const isDefault = driverValues.every((v, i) => v === (drivers[i]?.defaultValue ?? 0));
  const confidence = computeSizingConfidence(useCase);
  const tier = confidenceTier(confidence);
  const rationale = buildConfidenceRationale(useCase);

  return (
    <Panel
      title="Value Model"
      subtitle={
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-semibold tabular-nums" style={{ color: NAVY }}>{formatCurrency(total)}</span>
            <span className="text-xs text-gray-500">annual capture estimate{!isDefault && ' (custom)'}</span>
            {tier && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tier.classes}`}>
                {tier.label} confidence · {confidence}/100
              </span>
            )}
          </div>
          {rationale && (
            <div className="text-[11px] text-gray-600 mt-1 leading-snug italic">{rationale}</div>
          )}
        </div>
      }
      action={
        !isDefault && (
          <button
            onClick={() => setDriverValues(drivers.map((d) => d?.defaultValue ?? 0))}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Reset
          </button>
        )
      }
    >
      {useCase.valueModel.valueStory && (
        <div className="mb-3 pb-3 border-b border-gray-100">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Value story</div>
          <div className="text-sm text-gray-800 leading-relaxed">{useCase.valueModel.valueStory}</div>
        </div>
      )}
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Calculation flow</div>
      <div className="border border-gray-100 rounded">
        <div className="grid grid-cols-12 text-[10px] uppercase tracking-wider text-gray-500 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
          <div className="col-span-1"></div>
          <div className="col-span-5">Driver</div>
          <div className="col-span-3">Source</div>
          <div className="col-span-3 text-right">Value</div>
        </div>
        {drivers.map((d, i) => (
          <div key={i} className="grid grid-cols-12 items-center px-3 py-2 border-b border-gray-100 text-xs">
            <div className="col-span-1 text-base text-gray-400 font-mono leading-none">{d?.operator || (i === 0 ? '→' : '×')}</div>
            <div className="col-span-5 text-gray-800">{d?.name || `Driver ${i + 1}`}</div>
            <div className="col-span-3 text-[11px]"><SourceCell source={d?.source} /></div>
            <div className="col-span-3 flex items-center justify-end gap-1">
              <input
                type="number"
                step="any"
                value={driverValues[i]}
                onChange={(e) => {
                  const next = [...driverValues];
                  next[i] = parseFloat(e.target.value) || 0;
                  setDriverValues(next);
                }}
                className="w-20 text-right text-xs border border-gray-200 rounded px-1.5 py-0.5 tabular-nums focus:outline-none focus:border-[#1F3A5F]"
              />
              <span className="text-[10px] text-gray-500 w-12 text-left">{d?.unit || ''}</span>
            </div>
          </div>
        ))}
        <div className="grid grid-cols-12 items-center px-3 py-2.5 text-xs" style={{ backgroundColor: 'rgba(31, 58, 95, 0.05)' }}>
          <div className="col-span-1 text-base font-mono font-bold leading-none" style={{ color: NAVY }}>=</div>
          <div className="col-span-5 font-semibold" style={{ color: NAVY }}>Annual capture</div>
          <div className="col-span-3 text-[11px] text-gray-500 italic">computed</div>
          <div className="col-span-3 text-right text-sm font-bold tabular-nums" style={{ color: NAVY }}>{formatCurrency(total)}</div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-gray-500 leading-relaxed">
        {useCase.valueModel.walkthrough}
        <span className="block mt-1 text-gray-400">Edit any value to recompute. Hover sources for provenance.</span>
      </div>
      {useCase.valueModel.supplementaryAssumptions && useCase.valueModel.supplementaryAssumptions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Supplementary assumptions</div>
          <div className="space-y-1.5">
            {useCase.valueModel.supplementaryAssumptions.map((a, i) => (
              <div key={i} className="border border-gray-100 rounded px-3 py-2 text-xs">
                <div className="text-gray-800 leading-snug">{a.assumption}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded font-medium ${
                    a.confidence === 'HIGH' ? 'bg-emerald-50 text-emerald-700' :
                    a.confidence === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                    'bg-rose-50 text-rose-700'
                  }`}>{a.confidence}</span>
                  <SourceCell source={a.source} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {useCase.valueModel.strategicBullets && useCase.valueModel.strategicBullets.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Strategic alignment</div>
          <ul className="text-xs text-gray-700 space-y-1 leading-relaxed">
            {useCase.valueModel.strategicBullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gray-400 flex-shrink-0">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function PRDPanel({ useCase }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const prd = useCase.prd;

  const buildMarkdown = () => {
    const asLines = (arr) => Array.isArray(arr) && arr.length > 0
      ? arr.map((c) => `- ${c}`).join('\n')
      : '_(none)_';
    return `# ${useCase.title}

## Problem statement
${prd.problemStatement || '_(not provided)_'}

## User story
${prd.userStory || '_(not provided)_'}

## Acceptance criteria
${asLines(prd.acceptanceCriteria)}

## Edge cases
${asLines(prd.edgeCases)}

## Out of scope
${asLines(prd.outOfScope)}

## Success metrics
${asLines(prd.successMetrics)}
`;
  };

  const handleCopy = async () => {
    const markdown = buildMarkdown();
    setCopyFailed(false);

    // Try modern clipboard API first
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      }
    } catch (e) {
      // Fall through to legacy fallback
    }

    // Legacy fallback: hidden textarea + execCommand. Works in more iframe contexts.
    try {
      const ta = document.createElement('textarea');
      ta.value = markdown;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      }
    } catch (e) {
      // Fall through to download
    }

    // Final fallback: signal failure so user sees Download as the next option
    setCopyFailed(true);
    setTimeout(() => setCopyFailed(false), 2500);
  };

  const handleDownload = () => {
    const markdown = buildMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeTitle = useCase.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prd-${safeTitle}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Panel title="Product Requirements">
      <div className="space-y-4 text-sm">
        <PRDSection label="Problem statement" content={prd.problemStatement} />
        <PRDSection label="User story" content={prd.userStory} italic />
        <PRDList label="Acceptance criteria" items={prd.acceptanceCriteria} />
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={handleDownload}
          style={{ color: NAVY, borderColor: NAVY }}
          className="flex items-center gap-1.5 text-xs border-2 rounded px-3 py-1.5 hover:bg-gray-50 font-semibold"
        >
          <Download size={12} />
          Download full requirements
        </button>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1 text-xs border rounded px-2 py-1.5 ${
            copyFailed
              ? 'text-rose-700 border-rose-200 bg-rose-50'
              : 'text-gray-600 hover:text-[#1F3A5F] border-gray-200'
          }`}
          title="Copy full PRD as markdown"
        >
          {copied ? <Check size={12} /> : copyFailed ? <AlertTriangle size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : copyFailed ? 'Use Download' : 'Copy markdown'}
        </button>
        <span className="text-[10px] text-gray-400 italic ml-1">Includes edge cases, out of scope, success metrics</span>
      </div>
    </Panel>
  );
}

function PRDSection({ label, content, italic = false }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">{label}</div>
      <div className={`text-sm text-gray-800 leading-relaxed ${italic ? 'italic' : ''}`}>{content}</div>
    </div>
  );
}

function PRDList({ label, items }) {
  const safeItems = Array.isArray(items) ? items : [];
  if (safeItems.length === 0) {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">{label}</div>
        <div className="text-sm text-gray-400 italic">Not provided</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">{label}</div>
      <ul className="text-sm text-gray-800 space-y-1 leading-relaxed">
        {safeItems.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-gray-400">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BuildPathPanel({ useCase }) {
  const totalWeeks = Math.max(useCase?.ttb_weeks || 1, 1);
  const bullets = useCase?.buildPathDetail?.recommendationBullets;
  const phases = Array.isArray(useCase?.buildPathDetail?.phases) ? useCase.buildPathDetail.phases : [];
  const tags = Array.isArray(useCase?.buildPathDetail?.tags) ? useCase.buildPathDetail.tags : [];
  return (
    <Panel title="Build Path & Velocity">
      <div className="text-xs text-gray-700 mb-2">
        <span className="font-medium">Recommended path:</span> {useCase?.buildPath || 'TBD'}
      </div>
      {bullets && bullets.length > 0 ? (
        <ul className="text-xs text-gray-700 space-y-1 mb-3 leading-relaxed">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-gray-400 flex-shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-gray-600 leading-relaxed mb-3">{useCase?.buildPathDetail?.recommendation || ''}</div>
      )}
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Phase timeline</div>
      <div className="space-y-1.5 mb-3">
        {phases.map((p, i) => {
          const digits = (p?.range || '').match(/\d+/g) || ['1'];
          const endWeek = parseInt(digits[1] || digits[0], 10) || 1;
          const widthPct = Math.min(Math.max((endWeek / totalWeeks) * 100, 1), 100);
          return (
            <div key={i} className="flex items-center gap-3 text-xs">
              <div className="w-14 text-gray-500 font-mono">{p?.range || ''}</div>
              <div className="flex-1 h-1.5 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    backgroundColor: NAVY,
                    width: `${widthPct}%`,
                    opacity: 0.5 + i * 0.2,
                  }}
                />
              </div>
              <div className="flex-1 text-gray-700">{p?.label || ''}</div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-100">
        {tags.map((t, i) => (
          <TagPill key={i} label={t} variant="default" />
        ))}
      </div>
    </Panel>
  );
}

function DependenciesPanel({ useCase }) {
  return (
    <Panel title="Dependencies & Governance">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Dependencies</div>
      <div className="space-y-1.5">
        {useCase.dependencies.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <StatusDot status={d.status} />
            <div className="flex-1 text-gray-800">{d.name}</div>
            <div className="text-gray-500 italic">{d.owner}</div>
          </div>
        ))}
      </div>
      {useCase.risks && useCase.risks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5 flex items-center gap-1.5">
            <AlertTriangle size={11} className="text-amber-600" />
            Risks & watch areas
          </div>
          {/* If every risk has a description (seed data style), render as stacked
              label+description rows. If descriptions are empty (submitted-case style,
              where edge cases are headline-only and detail lives in the PRD), render
              as compact pills with a pointer to the PRD. */}
          {useCase.risks.every((r) => !r.description) ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {useCase.risks.map((r, i) => (
                  <span
                    key={i}
                    className="inline-block px-2 py-0.5 text-[11px] rounded border border-amber-200 bg-amber-50 text-amber-900 leading-snug"
                  >
                    {r.label}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-gray-500 italic mt-2 leading-relaxed">
                Full edge case detail and acceptance criteria live in the PRD section above.
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              {useCase.risks.map((r, i) => (
                <div key={i} className="text-xs leading-snug">
                  <div className="font-medium text-gray-800">{r.label}</div>
                  {r.description && <div className="text-gray-600">{r.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {useCase.phiFlag && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-2">
          <Shield size={12} className="text-amber-700 mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-amber-800 leading-relaxed">
            <span className="font-medium">PHI notice:</span> Touches protected health information. Governance review and BAA required before deployment.
          </div>
        </div>
      )}
      {useCase.voiceFlag && (
        <div className="mt-2 flex items-start gap-2">
          <Mic size={12} className="text-violet-700 mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-violet-800 leading-relaxed">
            <span className="font-medium">Voice posture: {useCase.voicePosture}.</span> {useCase.voiceRationale}
          </div>
        </div>
      )}
    </Panel>
  );
}

function ProfileView({ useCase, allUseCases, weights, onBack, allRanked, onSelectUseCase }) {
  const composite = computeComposite(useCase.scoring, weights);
  const rank = allRanked.findIndex((uc) => uc.id === useCase.id) + 1;

  // Scroll to top when arriving at a profile or switching between profiles
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [useCase.id]);

  return (
    <div>
      <div className="sticky top-0 z-20 bg-gray-50 -mx-6 px-6 pt-2 pb-3 mb-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 flex-shrink-0"
          >
            <ChevronLeft size={14} /> Back to backlog
          </button>
          <div className="text-xs text-gray-300">|</div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-medium flex-shrink-0">Jump to</label>
            <select
              value={useCase.id}
              onChange={(e) => onSelectUseCase(e.target.value)}
              className="text-sm border border-gray-200 rounded px-2 py-1 bg-white hover:border-gray-300 focus:outline-none focus:border-[#1F3A5F] flex-1 max-w-md"
            >
              {allRanked.map((uc, i) => (
                <option key={uc.id} value={uc.id}>
                  #{i + 1} — {uc.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border border-gray-200 rounded-md bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-900 leading-tight">{useCase.title}</h1>
              <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{useCase.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <TagPill label={useCase.bucket} variant={bucketVariant(useCase.bucket)} />
                <TagPill label={useCase.cohort} variant="cohort" />
                {useCase.pillars.map((p) => (
                  <TagPill key={p} label={p} variant="pillar" />
                ))}
                <TagPill label={useCase.buildPath} variant="build" />
                {useCase.phiFlag && <TagPill label="PHI" variant="phi" icon={<Shield size={10} />} />}
                {useCase.voiceFlag && <TagPill label={`Voice — ${useCase.voicePosture}`} variant="voice" icon={<Mic size={10} />} />}
                {useCase.sequencingFit.startsWith('Sequencing risk') && (
                  <TagPill label="Sequencing risk" variant="seq_risk" icon={<AlertTriangle size={10} />} />
                )}
            </div>
          </div>
          <ScoreBadge score={composite} rank={rank} />
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          <ScatterPanel useCase={useCase} allUseCases={allUseCases} />
          <ValueModelPanel useCase={useCase} />
          <PRDPanel useCase={useCase} />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <BuildPathPanel useCase={useCase} />
          <DependenciesPanel useCase={useCase} />
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// OTHER VIEWS
// ===========================================================================

function WeightSlider({ label, value, defaultValue, onChange, sublabel }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <div className="text-sm font-medium text-gray-800">{label}</div>
          <div className="text-[11px] text-gray-500">{sublabel}</div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-[#1F3A5F] tabular-nums">{value}</span>
          <span className="text-[10px] text-gray-400 tabular-nums">(default {defaultValue})</span>
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="50"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1F3A5F]"
      />
    </div>
  );
}

function WeightsView({ weights, setWeights, allUseCases, presets, setPresets }) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const isDefault = Object.keys(DEFAULT_WEIGHTS).every((k) => weights[k] === DEFAULT_WEIGHTS[k]);
  const [presetName, setPresetName] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);

  // Compute rank deltas between default weights and current weights
  const comparison = useMemo(() => {
    if (isDefault || !allUseCases || allUseCases.length === 0) return null;
    const defaultRanked = rankUseCases(allUseCases, DEFAULT_WEIGHTS, 'composite');
    const currentRanked = rankUseCases(allUseCases, weights, 'composite');
    const deltas = currentRanked.map((uc, i) => {
      const defaultIdx = defaultRanked.findIndex((d) => d.id === uc.id);
      return {
        id: uc.id,
        title: uc.title,
        currentRank: i + 1,
        defaultRank: defaultIdx + 1,
        delta: defaultIdx - i, // positive = moved up vs default
      };
    });
    const movers = deltas.filter((d) => d.delta !== 0);
    const topMovers = [...movers].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
    return { changedCount: movers.length, topMovers, defaultTop3: defaultRanked.slice(0, 3), currentTop3: currentRanked.slice(0, 3) };
  }, [weights, allUseCases, isDefault]);

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    // Replace existing preset with same name
    setPresets([...presets.filter((p) => p.name !== name), { name, weights: { ...weights } }]);
    setPresetName('');
    setSaveOpen(false);
  };

  const handleLoadPreset = (preset) => {
    setWeights({ ...preset.weights });
  };

  const handleDeletePreset = (name) => {
    setPresets(presets.filter((p) => p.name !== name));
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900">Scoring Weights</h1>
      <p className="text-sm text-gray-600 mt-1 mb-4 leading-relaxed">
        Live-adjustable. Move any slider to re-rank the backlog. Weights are independent and re-normalized against the current total.
      </p>

      <div className="border border-gray-200 rounded-md bg-white p-3 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Saved presets</div>
          {!saveOpen && !isDefault && (
            <button
              onClick={() => setSaveOpen(true)}
              className="text-xs font-semibold hover:opacity-80"
              style={{ color: NAVY }}
            >
              + Save current as preset
            </button>
          )}
        </div>
        {saveOpen && (
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setSaveOpen(false); }}
              placeholder="e.g., Quick wins emphasis, Strategic bets"
              autoFocus
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#1F3A5F]"
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              style={presetName.trim() ? { backgroundColor: NAVY, color: '#ffffff' } : { backgroundColor: '#E5E7EB', color: '#9CA3AF' }}
              className="px-3 py-1 text-xs font-semibold rounded"
            >
              Save
            </button>
            <button
              onClick={() => { setSaveOpen(false); setPresetName(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setWeights(DEFAULT_WEIGHTS)}
            className={`text-xs px-2.5 py-1 rounded border transition-colors ${
              isDefault
                ? 'border-gray-300 bg-gray-100 text-gray-700 cursor-default'
                : 'border-gray-200 hover:border-[#1F3A5F] text-gray-700'
            }`}
            style={isDefault ? {} : {}}
          >
            Default {isDefault && '✓'}
          </button>
          {presets.length === 0 && !isDefault && (
            <span className="text-[11px] text-gray-400 italic self-center ml-1">No saved presets yet. Save the current configuration to recall it later.</span>
          )}
          {presets.map((p) => {
            const isActive = Object.keys(p.weights).every((k) => p.weights[k] === weights[k]);
            return (
              <div key={p.name} className="inline-flex items-center group">
                <button
                  onClick={() => handleLoadPreset(p)}
                  className={`text-xs px-2.5 py-1 rounded-l border-y border-l transition-colors ${
                    isActive
                      ? 'bg-gray-100 cursor-default'
                      : 'border-gray-200 hover:border-[#1F3A5F] text-gray-700'
                  }`}
                  style={isActive ? { borderColor: NAVY, color: NAVY, backgroundColor: 'rgba(31, 58, 95, 0.05)' } : {}}
                >
                  {p.name} {isActive && '✓'}
                </button>
                <button
                  onClick={() => handleDeletePreset(p.name)}
                  title={`Delete preset "${p.name}"`}
                  className="text-[10px] px-1.5 py-1 rounded-r border-y border-r border-gray-200 text-gray-400 hover:text-rose-600 hover:border-rose-200 transition-colors"
                  style={{ borderLeftWidth: 0 }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {comparison && (
        <div
          className="border rounded-md p-3 mb-4"
          style={{ borderColor: 'rgba(31, 58, 95, 0.2)', backgroundColor: 'rgba(31, 58, 95, 0.05)' }}
        >
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: NAVY }}>Current weights vs. defaults</div>
          <div className="text-xs text-gray-800 leading-relaxed">
            <span className="font-semibold">{comparison.changedCount}</span> of {allUseCases.length} use cases re-ranked.
          </div>
          {comparison.topMovers.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {comparison.topMovers.map((m) => (
                <div key={m.id} className="text-xs text-gray-700 flex items-baseline gap-2">
                  <span className={`font-mono font-semibold ${m.delta > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {m.delta > 0 ? '↑' : '↓'}{Math.abs(m.delta)}
                  </span>
                  <span className="text-gray-500 tabular-nums">#{m.defaultRank}→#{m.currentRank}</span>
                  <span className="truncate">{m.title}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-3 text-[10px]" style={{ borderColor: 'rgba(31, 58, 95, 0.1)' }}>
            <div>
              <div className="uppercase tracking-wider text-gray-500 font-medium mb-0.5">Top 3 at default</div>
              <ol className="text-gray-700 space-y-0.5">
                {comparison.defaultTop3.map((uc, i) => (
                  <li key={uc.id} className="truncate">{i + 1}. {uc.title}</li>
                ))}
              </ol>
            </div>
            <div>
              <div className="uppercase tracking-wider text-gray-500 font-medium mb-0.5">Top 3 at current</div>
              <ol className="text-gray-700 space-y-0.5">
                {comparison.currentTop3.map((uc, i) => (
                  <li key={uc.id} className="truncate">{i + 1}. {uc.title}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-md bg-white p-5 space-y-5">
        <WeightSlider
          label="Impact magnitude"
          sublabel="Estimated annual value capture"
          value={weights.impact}
          defaultValue={DEFAULT_WEIGHTS.impact}
          onChange={(v) => setWeights({ ...weights, impact: v })}
        />
        <WeightSlider
          label="Strategic alignment"
          sublabel="Bucket fit + 'workflows-not-patients' thesis"
          value={weights.alignment}
          defaultValue={DEFAULT_WEIGHTS.alignment}
          onChange={(v) => setWeights({ ...weights, alignment: v })}
        />
        <WeightSlider
          label="Feasibility"
          sublabel="Technical complexity + data + integration"
          value={weights.feasibility}
          defaultValue={DEFAULT_WEIGHTS.feasibility}
          onChange={(v) => setWeights({ ...weights, feasibility: v })}
        />
        <WeightSlider
          label="Time to first value"
          sublabel="Weeks to deployable v1 producing measurable outcomes"
          value={weights.ttfv}
          defaultValue={DEFAULT_WEIGHTS.ttfv}
          onChange={(v) => setWeights({ ...weights, ttfv: v })}
        />
        <WeightSlider
          label="Adoption risk"
          sublabel="Change mgmt + workflow disruption + customer-brand impact"
          value={weights.adoption}
          defaultValue={DEFAULT_WEIGHTS.adoption}
          onChange={(v) => setWeights({ ...weights, adoption: v })}
        />
        <WeightSlider
          label="Dependencies"
          sublabel="Reliance on other things shipping first"
          value={weights.dependencies}
          defaultValue={DEFAULT_WEIGHTS.dependencies}
          onChange={(v) => setWeights({ ...weights, dependencies: v })}
        />

        <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Current weight total</div>
            <div className="text-lg font-semibold tabular-nums mt-0.5" style={{ color: NAVY }}>
              {total}
              <span className="text-xs text-gray-500 font-normal ml-2">re-normalized in composite score</span>
            </div>
          </div>
          <button
            onClick={() => setWeights(DEFAULT_WEIGHTS)}
            disabled={isDefault}
            className="text-xs text-gray-600 hover:text-[#1F3A5F] underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

function KilledView({ killedUseCases }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Killed / Parked</h1>
      <p className="text-sm text-gray-600 mt-1 mb-5 leading-relaxed">
        Use cases that didn't make the cut, with reasoning. Explicit "kill it" muscle matters as much as solving the ones that ship.
      </p>

      <div className="border border-gray-200 rounded-md bg-gray-50 p-4 mb-4">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Why things get killed — patterns across the list</div>
        <div className="space-y-2 text-sm text-gray-800 leading-relaxed">
          <div className="flex gap-2">
            <span className="font-semibold flex-shrink-0" style={{ color: NAVY }}>1.</span>
            <div>
              <span className="font-semibold">Evidence base too thin for the stakes.</span> When the cost of an error is clinical or financial, internal AUC claims aren't enough — external validation cohorts and governance sign-off are gating. The Epic Sepsis Model precedent (33% sensitivity in external validation despite 76% AUC internally) is the canonical cautionary tale.
            </div>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold flex-shrink-0" style={{ color: NAVY }}>2.</span>
            <div>
              <span className="font-semibold">Wrong owner inside the org.</span> Not every AI-shaped problem belongs in AI Technologies. Patient-brand marketing content lives with Customer Success / brand ops; AI Strategy supports with vendor evaluation if asked. Forcing it into the backlog dilutes both functions.
            </div>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold flex-shrink-0" style={{ color: NAVY }}>3.</span>
            <div>
              <span className="font-semibold">Regulatory or customer-relationship risk dominates value.</span> Even where technically buildable, asymmetric downside kills the case. Payer-side AI denial generation is the cleanest example — adjacent to a valuable use case (provider-side denial prevention) but inverted, with AMA opposition and a pending CMS rule.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {killedUseCases.map((uc) => (
          <div key={uc.id} className="border border-gray-200 rounded-md bg-white p-4">
            <div className="flex items-start gap-3">
              <XCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 leading-tight">{uc.title}</h3>
                <div className="text-sm font-medium text-red-700 mt-1">{uc.reasonShort}</div>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{uc.reasonLong}</p>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-2 text-xs">
                  <ArrowRight size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700"><span className="font-medium">Disposition:</span> {uc.disposition}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// SUBMIT (intake) — Chat + live preview, wired to the four AI prompts
// ===========================================================================

// ===========================================================================
// AI RESPONSE NORMALIZERS — defend against malformed/missing fields before
// they reach buildSubmittedUseCase and crash the profile render.
// ===========================================================================

function normalizeScoringDim(d) {
  if (!d || typeof d !== 'object') return { score: 3, factors: [], rationale: 'Not provided' };
  const rawScore = d.score;
  let score = typeof rawScore === 'number' ? rawScore : parseInt(rawScore, 10);
  if (isNaN(score)) score = 3;
  score = Math.max(1, Math.min(5, Math.round(score)));
  return {
    score,
    factors: Array.isArray(d.factors) ? d.factors : [],
    rationale: typeof d.rationale === 'string' ? d.rationale : 'Not provided',
  };
}

function normalizeScoring(scoring) {
  const rs = scoring?.rubric_scoring || {};
  return {
    rubric_scoring: {
      impact_magnitude: normalizeScoringDim(rs.impact_magnitude),
      strategic_alignment: normalizeScoringDim(rs.strategic_alignment),
      feasibility: normalizeScoringDim(rs.feasibility),
      time_to_first_value: normalizeScoringDim(rs.time_to_first_value),
      adoption_risk: normalizeScoringDim(rs.adoption_risk),
      dependencies: normalizeScoringDim(rs.dependencies),
    },
    strategic_commentary: typeof scoring?.strategic_commentary === 'string' ? scoring.strategic_commentary : '',
  };
}

function normalizeSizing(sizing) {
  const s = sizing || {};
  const asNumber = (v, fallback) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) || !isFinite(n) ? fallback : n;
  };
  return {
    time_to_build_weeks: Math.max(1, asNumber(s.time_to_build_weeks, 4)),
    time_to_first_value_weeks: Math.max(1, asNumber(s.time_to_first_value_weeks, 4)),
    build_path: typeof s.build_path === 'string' ? s.build_path : 'Rapid Prototype',
    complexity_tier: typeof s.complexity_tier === 'string' ? s.complexity_tier : 'Medium',
    annual_value_capture_usd: asNumber(s.annual_value_capture_usd, 0),
    value_calculation_walkthrough: typeof s.value_calculation_walkthrough === 'string' ? s.value_calculation_walkthrough : '',
    value_drivers: Array.isArray(s.value_drivers) ? s.value_drivers : [],
    named_assumptions: Array.isArray(s.named_assumptions) ? s.named_assumptions.filter((a) => a && typeof a === 'object') : [],
    voice_ai_posture: typeof s.voice_ai_posture === 'string' ? s.voice_ai_posture : 'N/A',
    voice_ai_rationale: typeof s.voice_ai_rationale === 'string' ? s.voice_ai_rationale : 'N/A',
    bucket_sequencing_fit: typeof s.bucket_sequencing_fit === 'string' ? s.bucket_sequencing_fit : 'Aligned with sequencing',
  };
}

function normalizePRD(prd) {
  const p = prd || {};
  const asArr = (v) => Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  return {
    problem_statement: typeof p.problem_statement === 'string' ? p.problem_statement : '',
    user_story: typeof p.user_story === 'string' ? p.user_story : '',
    acceptance_criteria: asArr(p.acceptance_criteria),
    edge_cases: asArr(p.edge_cases),
    out_of_scope: asArr(p.out_of_scope),
    success_metrics: asArr(p.success_metrics),
  };
}

// === INPUT FIDELITY VERIFIER ===
//
// Approach A from the audit: extract numeric figures from the user's conversation
// turns, then check whether each one is present in either the driver values or the
// named_assumptions text. Unmatched user numbers get surfaced as a warning so the
// user can see exactly what the AI substituted or dropped.
//
// Returns an array of warning strings (one per unmatched figure). Empty array means
// every user-stated number was preserved in the sizing output.
function verifyInputFidelity(messages, sizing) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  if (!sizing) return [];

  // Pull just the user-authored text from the conversation
  const userText = messages
    .filter((m) => m?.role === 'user' && typeof m.content === 'string')
    .map((m) => m.content)
    .join('\n');
  if (!userText.trim()) return [];

  // Regex to find numeric figures with units. Captures:
  //   - 4.5M, 4.5 million, 4,500,000  → volume-style
  //   - $7.50, $18 per call, 7.5/call → cost-style
  //   - 60%, 0.47 ratio, 50% containment → ratio-style
  //   - 4.2 minutes, 85 seconds → time-style
  const figures = [];
  const seen = new Set(); // dedupe by normalized value+unit

  const addFigure = (raw, value, unit, kind) => {
    const key = `${value}|${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    figures.push({ raw, value, unit, kind });
  };

  // Volume / count style: numbers with K/M/B suffix or "million/thousand"
  // Examples: "4.5M calls", "150K visits/month", "3 million annual events"
  const volumeRegex = /(\d+(?:\.\d+)?)\s*(K|M|B|thousand|million|billion)\b/gi;
  let m;
  while ((m = volumeRegex.exec(userText)) !== null) {
    const num = parseFloat(m[1]);
    const suffix = m[2].toLowerCase();
    let multiplier = 1;
    if (suffix === 'k' || suffix === 'thousand') multiplier = 1_000;
    else if (suffix === 'm' || suffix === 'million') multiplier = 1_000_000;
    else if (suffix === 'b' || suffix === 'billion') multiplier = 1_000_000_000;
    addFigure(m[0], num * multiplier, 'count', 'volume');
  }

  // Dollar amounts: "$7.50", "$18 per call", "$32/hour"
  const dollarRegex = /\$\s*(\d+(?:\.\d+)?)/g;
  while ((m = dollarRegex.exec(userText)) !== null) {
    addFigure(m[0], parseFloat(m[1]), '$', 'dollar');
  }

  // Percentages: "60%", "47 percent". Convert to decimal for matching.
  const pctRegex = /(\d+(?:\.\d+)?)\s*(?:%|\s+percent\b)/gi;
  while ((m = pctRegex.exec(userText)) !== null) {
    const pct = parseFloat(m[1]);
    if (pct > 0 && pct <= 100) {
      addFigure(m[0], pct / 100, 'ratio', 'percent');
    }
  }

  // Build a set of all numeric values present in sizing drivers and assumptions
  const drivers = Array.isArray(sizing.value_drivers) ? sizing.value_drivers : [];
  const driverValues = drivers
    .map((d) => typeof d?.defaultValue === 'number' ? d.defaultValue : parseFloat(d?.defaultValue))
    .filter((v) => !isNaN(v) && isFinite(v));

  const assumptionsText = (Array.isArray(sizing.named_assumptions) ? sizing.named_assumptions : [])
    .map((a) => (a?.assumption || ''))
    .join(' ');

  const walkthroughText = sizing.value_calculation_walkthrough || '';
  const haystack = assumptionsText + ' ' + walkthroughText;

  // For each user figure, check if it appears in drivers (numeric) or in assumption text (regex).
  // Use 5% relative tolerance for numeric matching to allow for rounding.
  const isNumericMatch = (target, candidate) => {
    if (target === 0) return candidate === 0;
    return Math.abs(target - candidate) / Math.abs(target) <= 0.05;
  };

  // For percentages, also check if a blended/averaged value would explain it
  // (e.g., user said "50% and 75%", driver has 0.625 as the average)
  const allUserPercents = figures.filter((f) => f.kind === 'percent').map((f) => f.value);
  const blendedAverages = [];
  if (allUserPercents.length >= 2) {
    // Compute the average of all percent pairs
    for (let i = 0; i < allUserPercents.length; i++) {
      for (let j = i + 1; j < allUserPercents.length; j++) {
        blendedAverages.push((allUserPercents[i] + allUserPercents[j]) / 2);
      }
    }
  }

  const unmatched = [];
  for (const fig of figures) {
    let found = false;

    // Check exact driver values
    for (const dv of driverValues) {
      if (isNumericMatch(fig.value, dv)) { found = true; break; }
    }

    // Check if a driver is a derivative (e.g., 60% transactional + 40% clinical
    // could mean only one appears as a driver and the other is implied)
    if (!found && fig.kind === 'percent') {
      // 1 - fig.value is the complement, check if that's a driver
      const complement = 1 - fig.value;
      for (const dv of driverValues) {
        if (isNumericMatch(complement, dv)) { found = true; break; }
      }
      // Check blended averages (e.g., 50% + 75% blended → 62.5%)
      if (!found) {
        for (const ba of blendedAverages) {
          for (const dv of driverValues) {
            if (isNumericMatch(ba, dv)) { found = true; break; }
          }
          if (found) break;
        }
      }
    }

    // Check if it appears as a raw number string in assumption text
    if (!found) {
      // Format the value as it would likely appear in text
      const candidates = [
        fig.raw, // exact original mention
        String(fig.value),
        fig.kind === 'percent' ? `${Math.round(fig.value * 100)}%` : null,
        fig.kind === 'volume' && fig.value >= 1_000_000 ? `${(fig.value / 1_000_000).toFixed(1)}M` : null,
        fig.kind === 'volume' && fig.value >= 1_000_000 ? `${Math.round(fig.value / 1_000_000)}M` : null,
        fig.kind === 'volume' && fig.value >= 1_000 && fig.value < 1_000_000 ? `${Math.round(fig.value / 1_000)}K` : null,
        fig.kind === 'dollar' ? `$${fig.value}` : null,
      ].filter(Boolean);
      for (const c of candidates) {
        if (haystack.toLowerCase().includes(c.toLowerCase())) { found = true; break; }
      }
    }

    if (!found) unmatched.push(fig);
  }

  // Build a single readable warning per unmatched figure
  return unmatched.map((fig) => {
    if (fig.kind === 'volume') return `You stated "${fig.raw}" in the intake, but it doesn't appear in the calculation inputs. The AI may have substituted a rounded or different value — review the inputs.`;
    if (fig.kind === 'dollar') return `You stated "${fig.raw}" in the intake, but it doesn't appear in the calculation inputs. Verify the cost driver matches what you said.`;
    if (fig.kind === 'percent') return `You stated "${fig.raw}" in the intake, but it doesn't appear in the calculation inputs. The AI may have rolled it into a blended value or dropped it — review the inputs.`;
    return `You stated "${fig.raw}" but it doesn't appear in the calculation inputs.`;
  });
}

function buildSubmittedUseCase({ extractedFields, prd, sizing, scoring, messages }) {
  // Normalize all AI responses upfront. After this point, every nested field
  // we access is guaranteed to exist with a safe default.
  const safePRD = normalizePRD(prd);
  const safeSizing = normalizeSizing(sizing);
  const safeScoring = normalizeScoring(scoring);
  const safeExtracted = extractedFields || {};

  const phases = (() => {
    const w = Math.max(1, safeSizing.time_to_build_weeks || 4);
    const a = Math.max(1, Math.ceil(w / 3));
    const b = Math.max(a + 1, Math.ceil((2 * w) / 3));
    return [
      { range: `Wk 1-${a}`, label: 'Scope + design' },
      { range: `Wk ${a + 1}-${b}`, label: 'Build' },
      { range: `Wk ${b + 1}-${w}`, label: 'Pilot + harden' },
    ];
  })();

  const deps = [];
  if (safeExtracted.phi_flag) deps.push({ name: 'PHI handling review', owner: 'Governance owner', status: 'pending' });
  if (safeExtracted.voice_ai_flag) deps.push({ name: 'HeyRevia integration posture decision', owner: 'VP Enterprise Technology / COO', status: 'open' });
  deps.push({ name: 'Engineering scoping', owner: 'COO / Engineering', status: 'open' });
  if ((safeSizing.bucket_sequencing_fit || '').startsWith('Sequencing risk')) {
    deps.push({ name: 'Bucket sequencing review', owner: 'AI Strategy', status: 'pending' });
  }
  (safeExtracted.constraints || []).slice(0, 2).forEach((c) => {
    deps.push({ name: c, owner: 'TBD', status: 'pending' });
  });

  // Compute the canonical annual value: prefer the product of value drivers if returned
  // (this matches what the editable value model panel will display in the profile).
  // Falls back to the AI's stated annual_value_capture_usd if no drivers OR if the
  // computed product is implausible (AI math error, often from unit/ratio confusion).
  //
  // Plausibility band: [0, $1B/yr]. Anything outside this range — negative, zero,
  // or above the ceiling — is treated as a math error. The AI sometimes returns
  // a driver as a negative ratio (e.g., "-0.5" for a "reduction" driver where it
  // should have been "0.5"), or treats a percentage as a whole number, blowing
  // the product up by 100x per driver.
  const PLAUSIBLE_CEILING = 1_000_000_000; // $1B/yr
  const PLAUSIBLE_FLOOR = 0; // Annual value capture cannot be negative
  const productMismatchNote = { note: null };
  // Tracks every adjustment the sanitizer made so we can surface them as
  // LOW-confidence assumptions. Each entry is a string describing what changed.
  const driverAdjustments = [];

  // Helper: returns a plausible value or null. Used for both the driver product
  // and the AI-stated total. Null result means "not usable, try the next fallback."
  const plausible = (v) => {
    if (typeof v !== 'number' || isNaN(v) || !isFinite(v)) return null;
    if (v < PLAUSIBLE_FLOOR || v > PLAUSIBLE_CEILING) return null;
    return v;
  };

  // === DETERMINISTIC MATH LAYER ===
  //
  // The AI's job is to extract numbers. Multiplication is done in JS so the math
  // is provably right. Each driver gets unit-aware sanitization before participating
  // in the product. Every correction is surfaced to the user as a LOW-confidence
  // assumption — the user always knows what we changed and why.
  //
  // Sanitization rules (applied in order, per driver):
  //  1. Coerce to number. Reject NaN/Infinity.
  //  2. Sign correction: if unit is a ratio/percentage and value is negative,
  //     flip the sign. "Reduction" drivers are positive multipliers in our model.
  //  3. Unit normalization: ratio-typed drivers must be in [0, 1]. Values like
  //     47 get divided by 100 (interpreted as a percentage that should be a decimal).
  //  4. Volume sanity: non-ratio drivers can be large (millions of visits, etc.)
  //     but must be non-negative.
  const sanitizeDriver = (driver, index) => {
    const rawValue = typeof driver?.defaultValue === 'number'
      ? driver.defaultValue
      : parseFloat(driver?.defaultValue);

    if (rawValue === undefined || rawValue === null || isNaN(rawValue) || !isFinite(rawValue)) {
      driverAdjustments.push(
        `Driver "${driver?.name || `#${index + 1}`}" had a non-numeric value (${driver?.defaultValue}) — treated as 0. Edit in the value model to correct.`
      );
      return { ...driver, defaultValue: 0, _adjusted: true };
    }

    const unit = (driver?.unit || '').toLowerCase().trim();
    const isRatioUnit = unit === 'ratio' || unit === '%' || unit === 'pct' || unit === 'percent' ||
                       unit.includes('ratio') || unit.includes('rate') || unit.includes('share') ||
                       unit.includes('percent') || unit.includes('reduction') || unit.includes('lift');

    let value = rawValue;
    let adjusted = false;

    // Rule 2: sign correction on ratio-like units
    if (isRatioUnit && value < 0) {
      driverAdjustments.push(
        `Driver "${driver?.name}" returned as ${value} — flipped to ${Math.abs(value)} (reductions are positive multipliers in this model).`
      );
      value = Math.abs(value);
      adjusted = true;
    }

    // Rule 3: ratio unit normalization (e.g., 47 → 0.47 for "47% reduction")
    if (isRatioUnit && value > 1) {
      if (value <= 100) {
        const normalized = value / 100;
        driverAdjustments.push(
          `Driver "${driver?.name}" was ${value} on a ratio unit — interpreted as ${(normalized * 100).toFixed(0)}% (${normalized}).`
        );
        value = normalized;
        adjusted = true;
      } else {
        // Value above 100 on a ratio unit is nonsensical
        driverAdjustments.push(
          `Driver "${driver?.name}" was ${value} on a ratio unit, which exceeds 100% — capped at 1.0. Likely unit confusion; edit in the value model.`
        );
        value = 1.0;
        adjusted = true;
      }
    }

    // Rule 4: non-ratio drivers must be non-negative
    if (!isRatioUnit && value < 0) {
      driverAdjustments.push(
        `Driver "${driver?.name}" returned as ${value} on a non-ratio unit — flipped to ${Math.abs(value)} (volumes and dollar amounts must be positive).`
      );
      value = Math.abs(value);
      adjusted = true;
    }

    return { ...driver, defaultValue: value, _adjusted: adjusted };
  };

  // Run sanitization across all drivers
  const sanitizedDrivers = safeSizing.value_drivers.map(sanitizeDriver);

  const computedAnnualValue = (() => {
    const statedTotal = plausible(safeSizing.annual_value_capture_usd);

    if (sanitizedDrivers.length > 0) {
      // Compute the product from sanitized values — this is the source of truth
      const product = sanitizedDrivers.reduce((acc, d) => acc * d.defaultValue, 1);

      const plausibleProduct = plausible(product);
      if (plausibleProduct !== null) {
        // Driver product checks out. Now cross-check against AI's stated total —
        // if they disagree materially, surface the discrepancy.
        if (statedTotal !== null) {
          const maxVal = Math.max(plausibleProduct, statedTotal, 1);
          const diffPct = Math.abs(plausibleProduct - statedTotal) / maxVal;
          if (diffPct > 0.15) {
            driverAdjustments.push(
              `AI narrative claimed annual value of ${statedTotal >= 1e6 ? '$' + (statedTotal / 1e6).toFixed(1) + 'M' : '$' + statedTotal.toLocaleString()}, but the drivers multiply to ${plausibleProduct >= 1e6 ? '$' + (plausibleProduct / 1e6).toFixed(1) + 'M' : '$' + plausibleProduct.toLocaleString()}. Using the driver product (inspectable below) as canonical. The AI's narrative may have miscalculated.`
            );
          }
        }
        return plausibleProduct;
      }

      // Driver product is implausible even after sanitization. Diagnose and fall back.
      if (!isFinite(product) || isNaN(product)) {
        productMismatchNote.note = 'Driver product is non-numeric after sanitization — fundamental math issue. Using AI-stated total if available.';
      } else if (product === 0) {
        productMismatchNote.note = 'Driver product is zero — at least one driver value is 0. Using AI-stated total instead.';
      } else if (product > PLAUSIBLE_CEILING) {
        productMismatchNote.note = `Driver product ($${(product / 1_000_000_000).toFixed(1)}B) exceeds the plausible ceiling even after unit sanitization. Using AI-stated total instead. Likely a structural error in the value chain — review drivers in the value model.`;
      }

      if (statedTotal !== null) return statedTotal;
    }

    // No drivers, or drivers failed — use stated total if plausible
    if (statedTotal !== null) return statedTotal;

    // Last resort: AI-stated total is also implausible
    if (!productMismatchNote.note) {
      productMismatchNote.note = `AI-stated annual value (${safeSizing.annual_value_capture_usd}) is outside the plausible band [$0, $1B]. Showing $0 — manual sizing required.`;
    } else {
      productMismatchNote.note += ' AI-stated total also implausible; showing $0.';
    }
    return 0;
  })();

  // Replace the original drivers with the sanitized ones so downstream consumers
  // (value model panel, scatter chart, completeness scoring) see corrected values.
  safeSizing.value_drivers = sanitizedDrivers.map(({ _adjusted, ...d }) => d);

  // Run input fidelity check: did the AI preserve every numeric figure the user stated?
  // Any unmatched figures get pushed into driverAdjustments so they surface alongside
  // the unit/sign warnings as LOW-confidence assumptions on the profile.
  const fidelityWarnings = verifyInputFidelity(messages, safeSizing);
  fidelityWarnings.forEach((w) => driverAdjustments.push(w));

  return {
    id: `uc-submitted-${Date.now()}`,
    addedAt: new Date().toISOString().slice(0, 10),
    title: safeExtracted.title || 'Submitted use case',
    description: safeExtracted.description || safeExtracted.problem_statement || '',
    bucket: safeExtracted.bucket || 'Clinical Efficiency',
    cohort: safeExtracted.customer_cohort || 'Cross-cohort',
    pillars: Array.isArray(safeExtracted.platform_pillars) ? safeExtracted.platform_pillars : [],
    buildPath: safeSizing.build_path,
    status: 'active',
    voiceFlag: !!safeExtracted.voice_ai_flag,
    voicePosture: safeSizing.voice_ai_posture,
    voiceRationale: safeSizing.voice_ai_rationale,
    phiFlag: !!safeExtracted.phi_flag,
    sequencingFit: safeSizing.bucket_sequencing_fit,
    ttb_weeks: safeSizing.time_to_build_weeks,
    ttfv_weeks: safeSizing.time_to_first_value_weeks,
    complexity: safeSizing.complexity_tier,
    annualValue: computedAnnualValue,
    submitted: true,
    scoring: {
      impact: safeScoring.rubric_scoring.impact_magnitude,
      alignment: safeScoring.rubric_scoring.strategic_alignment,
      feasibility: safeScoring.rubric_scoring.feasibility,
      ttfv: safeScoring.rubric_scoring.time_to_first_value,
      adoption: safeScoring.rubric_scoring.adoption_risk,
      dependencies: safeScoring.rubric_scoring.dependencies,
    },
    valueModel: (() => {
      const hasDrivers = safeSizing.value_drivers.length > 0;
      // If the driver product was rejected as implausible, drop drivers entirely
      // and render the static value model (AI-stated total + assumptions). This prevents
      // the calc flow from showing the rejected math.
      const useDrivers = hasDrivers && !productMismatchNote.note;
      if (useDrivers) {
        const normalized = safeSizing.value_drivers.map((d, i) => ({
          operator: d?.operator || (i === 0 ? '→' : '×'),
          name: d?.name || `Driver ${i + 1}`,
          source: d?.source || 'Assumed',
          defaultValue: typeof d?.defaultValue === 'number' ? d.defaultValue : parseFloat(d?.defaultValue) || 0,
          unit: d?.unit || '',
        }));
        return {
          isStatic: false,
          drivers: normalized,
          compute: (vals) => vals.reduce((acc, v) => acc * (v || 0), 1),
          valueStory: safeScoring.strategic_commentary,
          strategicBullets: [
            `Alignment: ${safeScoring.rubric_scoring.strategic_alignment.rationale}`,
            `Impact magnitude: ${safeScoring.rubric_scoring.impact_magnitude.rationale}`,
            `Feasibility: ${safeScoring.rubric_scoring.feasibility.rationale}`,
            (safeSizing.voice_ai_posture && safeSizing.voice_ai_posture !== 'N/A')
              ? `Voice integration: ${safeSizing.voice_ai_posture}`
              : `Sequencing: ${safeSizing.bucket_sequencing_fit}`,
          ],
          walkthrough: safeSizing.value_calculation_walkthrough,
          supplementaryAssumptions: driverAdjustments.length > 0
            ? [
                ...driverAdjustments.map((adj) => ({
                  assumption: adj,
                  confidence: 'LOW',
                  source: 'Inferred',
                })),
                ...safeSizing.named_assumptions,
              ]
            : safeSizing.named_assumptions,
        };
      }
      return {
        isStatic: true,
        total: safeSizing.annual_value_capture_usd,
        valueStory: safeScoring.strategic_commentary,
        strategicBullets: [
          `Alignment: ${safeScoring.rubric_scoring.strategic_alignment.rationale}`,
          `Impact magnitude: ${safeScoring.rubric_scoring.impact_magnitude.rationale}`,
          `Feasibility: ${safeScoring.rubric_scoring.feasibility.rationale}`,
          (safeSizing.voice_ai_posture && safeSizing.voice_ai_posture !== 'N/A')
            ? `Voice integration: ${safeSizing.voice_ai_posture}`
            : `Sequencing: ${safeSizing.bucket_sequencing_fit}`,
        ],
        walkthrough: safeSizing.value_calculation_walkthrough,
        assumptions: (() => {
          const extras = [];
          if (productMismatchNote.note) {
            extras.push({ assumption: productMismatchNote.note, confidence: 'LOW', source: 'Inferred' });
          }
          driverAdjustments.forEach((adj) => {
            extras.push({ assumption: adj, confidence: 'LOW', source: 'Inferred' });
          });
          return extras.length > 0
            ? [...extras, ...safeSizing.named_assumptions]
            : safeSizing.named_assumptions;
        })(),
      };
    })(),
    prd: {
      problemStatement: safePRD.problem_statement,
      userStory: safePRD.user_story,
      acceptanceCriteria: safePRD.acceptance_criteria,
      edgeCases: safePRD.edge_cases,
      outOfScope: safePRD.out_of_scope,
      successMetrics: safePRD.success_metrics,
    },
    buildPathDetail: {
      recommendation: `AI-recommended: ${safeSizing.build_path}. ${safeSizing.complexity_tier} complexity tier.`,
      recommendationBullets: [
        `AI-recommended path: ${safeSizing.build_path}`,
        `Complexity tier: ${safeSizing.complexity_tier}`,
        `Estimated build: ${safeSizing.time_to_build_weeks} weeks, first value at ${safeSizing.time_to_first_value_weeks} weeks`,
        (safeSizing.voice_ai_posture && safeSizing.voice_ai_posture !== 'N/A')
          ? `Voice posture: ${safeSizing.voice_ai_posture}`
          : ((safeSizing.bucket_sequencing_fit || '').startsWith('Sequencing risk') ? safeSizing.bucket_sequencing_fit : 'No sequencing or voice dependencies'),
      ],
      phases,
      tags: [safeSizing.complexity_tier, 'AI-sized', safeSizing.bucket_sequencing_fit].filter(Boolean),
    },
    dependencies: deps,
    risks: (() => {
      const r = [];
      // Edge cases become tight risk labels only — full detail lives in the PRD.
      // Helper: compact a multi-clause edge case into a short risk label.
      const compactLabel = (text) => {
        const cleaned = (text || '').trim().replace(/[.;:]+$/, '');
        // Take up to first clause break or comma, capped at ~7 words
        const firstClause = cleaned.split(/[,;.]/)[0] || cleaned;
        const words = firstClause.split(/\s+/);
        if (words.length <= 8) return firstClause;
        return words.slice(0, 7).join(' ') + '…';
      };
      safePRD.edge_cases.slice(0, 4).forEach((ec) => {
        r.push({ label: compactLabel(ec), description: '' });
      });
      safeSizing.named_assumptions
        .filter((a) => a?.confidence === 'LOW')
        .slice(0, 3)
        .forEach((a) => {
          r.push({ label: compactLabel(a?.assumption), description: '' });
        });
      if ((safeSizing.bucket_sequencing_fit || '').startsWith('Sequencing risk')) {
        r.push({ label: 'Sequencing risk', description: '' });
      }
      return r;
    })(),
  };
}

function SubmitView({ onAddToBacklog, weights }) {
  const [stage, setStage] = useState('start');
  const [messages, setMessages] = useState([]);
  const [extractedFields, setExtractedFields] = useState({});
  const [prd, setPRD] = useState(null);
  const [sizing, setSizing] = useState(null);
  const [scoring, setScoring] = useState(null);
  const [error, setError] = useState(null);
  const [pendingInput, setPendingInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Pre-chat structured intake (set when user submits IntakeFormCard, kicks off the chat)
  const [hasStarted, setHasStarted] = useState(false);
  const [lockedFormValues, setLockedFormValues] = useState(null);

  // Track mounted state so we don't setState after unmount on in-flight promises
  const mountedRef = useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleReset = () => {
    setStage('start');
    setMessages([]);
    setExtractedFields({});
    setPRD(null);
    setSizing(null);
    setScoring(null);
    setError(null);
    setPendingInput('');
    setIsLoading(false);
    setIsGenerating(false);
    setIsSubmitting(false);
    setHasStarted(false);
    setLockedFormValues(null);
  };

  // Called when the user submits the structured intake form.
  // Pre-populates extractedFields with the problem statement + form values,
  // generates a context-aware opening message via the AI (NOT a hardcoded template),
  // and transitions to interview stage.
  const handleStartFromForm = async (formValues) => {
    const problemText = (formValues.problem || '').trim();
    const seed = {
      title: '',
      description: problemText,
      bucket: formValues.bucket || '',
      customer_cohort: formValues.cohort || '',
      platform_pillars: [],
      problem_statement: problemText,
      user: '',
      volume: '',
      current_cost: '',
      success_criteria: '',
      constraints: [],
      autonomy_level: formValues.autonomy || '',
      voice_ai_flag: formValues.voice === 'yes' ? true : formValues.voice === 'no' ? false : null,
      phi_flag: formValues.phi === 'yes' ? true : formValues.phi === 'no' ? false : null,
      build_inclination: formValues.buildPath || '',
    };
    setExtractedFields(seed);
    // Track which fields came from the form so we can label them as locked in the wrapped message.
    // Only include fields the user actually answered (non-empty form values).
    const locked = {};
    if (formValues.bucket) locked.bucket = formValues.bucket;
    if (formValues.cohort) locked.customer_cohort = formValues.cohort;
    if (formValues.phi === 'yes') { locked.phi_flag = true; }
    if (formValues.phi === 'no') { locked.phi_flag = false; }
    if (formValues.voice === 'yes') { locked.voice_ai_flag = true; }
    if (formValues.voice === 'no') { locked.voice_ai_flag = false; }
    if (formValues.autonomy) locked.autonomy_level = formValues.autonomy;
    if (formValues.buildPath) locked.build_inclination = formValues.buildPath;
    if (problemText) locked.problem_statement = problemText;
    setLockedFormValues(locked);
    setHasStarted(true);

    // Inject the problem statement as the visible first user message immediately so the
    // user sees the chat opening with their words. The AI's response will follow.
    const initialMessages = problemText
      ? [{ role: 'user', content: problemText }]
      : [];
    setMessages(initialMessages);
    setStage('interviewing');
    setIsLoading(true);

    // Scroll to top so the user sees the chat from its starting point
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 0);

    // Now generate the AI's opening question. The AI receives:
    //  - the user's problem statement as conversation turn 1
    //  - the locked form values explicitly marked as user-supplied context
    //  - an instruction to read what's already known and ask the highest-leverage missing question
    try {
      const lockedBlock = Object.keys(locked).length > 0
        ? `\n\nknown_form_values (USER LOCKED THESE VIA THE INTAKE FORM — DO NOT RE-ASK):\n${JSON.stringify(locked, null, 2)}\n`
        : '';
      const openingPrompt = `The user just submitted an intake form to start a use case sizing conversation. Here is what they wrote:

---
USER: ${problemText || '(no problem statement provided)'}
---${lockedBlock}
This is the FIRST agent turn. Your job:

1. Read what the user wrote carefully. Identify which sizing inputs (volume, current cost/time, who experiences the pain, success criteria, constraints) are ALREADY present in their problem statement.
2. Acknowledge what you heard briefly — 1 short sentence max. Reflect their actual problem, not a generic restatement.
3. Ask ONE focused follow-up question targeting the HIGHEST-LEVERAGE missing input. If they gave volume, ask about current cost or time burden. If they gave volume AND cost, ask about success criteria or constraints. Do not ask about anything in known_form_values. Do not ask about scale if the problem statement already contains a volume figure.

Output ONLY a JSON object matching the schema in the system prompt. The next_message field should be your acknowledgment + question. Set complete to false (this is turn 1). Populate extracted_fields with everything you can already infer from the problem statement plus the known_form_values, preserving locked values verbatim. No prose before {. No prose after }.`;

      const parsed = await callWithRetry({
        system: INTERVIEW_PROMPT,
        messages: [{ role: 'user', content: openingPrompt }],
        max_tokens: 1500,
      });

      if (!mountedRef.current) return;

      const openingMessage = parsed.next_message || 'Tell me more about the scope of this — what are you trying to change?';
      setMessages([...initialMessages, { role: 'assistant', content: openingMessage }]);
      // Merge the AI's extracted fields with our seed, but preserve locked values
      if (parsed.extracted_fields) {
        setExtractedFields({ ...parsed.extracted_fields, ...locked });
      }
    } catch (e) {
      if (mountedRef.current) {
        // Fall back to a generic opener if the AI call fails — better than blocking the user
        const fallback = 'Got it. Tell me more about the scale of this — how many people, visits, or events does it touch?';
        setMessages([...initialMessages, { role: 'assistant', content: fallback }]);
        setError(`Opening question generation failed: ${e.message}. Used a fallback question — you can answer it or refine via chat.`);
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!pendingInput.trim() || isLoading) return;

    const userMsg = { role: 'user', content: pendingInput };
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setPendingInput('');
    if (stage === 'start') setStage('interviewing');
    setIsLoading(true);
    setError(null);

    try {
      const conversationHistory = newMessages
        .map((m) => `${m.role === 'user' ? 'USER' : 'AGENT'}: ${m.content}`)
        .join('\n\n');

      // Build the context block. Two distinct sections so the AI doesn't conflate them:
      // - known_form_values: locked, never re-ask
      // - extracted_so_far: tentative state from prior turns, can refine
      const lockedValues = lockedFormValues || {};
      const knownFormBlock = Object.keys(lockedValues).length > 0
        ? `\n\nknown_form_values (USER LOCKED THESE VIA THE INTAKE FORM — DO NOT RE-ASK):\n${JSON.stringify(lockedValues, null, 2)}\n`
        : '';
      const extractedBlock = Object.keys(extractedFields).length > 0
        ? `\nextracted_so_far (tentative, can refine if user clarifies):\n${JSON.stringify(extractedFields, null, 2)}\n`
        : '';

      const wrappedUserMessage = `Continue this intake conversation. Here is the history so far:

---
${conversationHistory}
---${knownFormBlock}${extractedBlock}
Produce your next response as a single JSON object matching the schema in the system prompt. Preserve all known_form_values verbatim in extracted_fields. Ask ONE question (no false closes, no "last question" framing). Output ONLY the JSON. No prose before {. No prose after }.`;

      const parsed = await callWithRetry({
        system: INTERVIEW_PROMPT,
        messages: [{ role: 'user', content: wrappedUserMessage }],
        max_tokens: 1500,
      });

      if (!mountedRef.current) return;

      const assistantMsg = { role: 'assistant', content: parsed.next_message || '(no message)' };
      setMessages([...newMessages, assistantMsg]);
      if (parsed.extracted_fields) setExtractedFields(parsed.extracted_fields);

      if (parsed.complete && stage !== 'review') {
        setStage('ready_to_generate');
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(`Interview call failed: ${e.message}. Try sending again or reset to start over.`);
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  const handleGenerateDownstream = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);

    // Build a full context block that includes the conversation history alongside
    // the structured extractedFields. The interview summary can paraphrase or
    // round user-stated numbers; the conversation preserves them verbatim. Sizing
    // and scoring both need this to maintain input fidelity.
    const conversationHistory = (messages || [])
      .map((m) => `${m.role === 'user' ? 'USER' : 'AGENT'}: ${m.content}`)
      .join('\n\n');
    const intakeContext = `CONVERSATION HISTORY (verbatim, source of truth for user-stated numbers):
---
${conversationHistory}
---

EXTRACTED FIELDS (structured summary from the interview agent):
${JSON.stringify(extractedFields, null, 2)}`;

    try {
      setStage('generating_prd');
      const prdResult = await callWithRetry({
        system: PRD_PROMPT,
        messages: [{
          role: 'user',
          content: `Generate the PRD for this intake.\n\n${intakeContext}\n\nOutput ONLY a JSON object matching the schema in the system prompt. No prose before {. No prose after }.`,
        }],
        max_tokens: 2000,
      });
      if (!mountedRef.current) return;
      setPRD(prdResult);

      setStage('generating_sizing');
      const sizingResult = await callWithRetry({
        system: SIZING_PROMPT,
        messages: [{
          role: 'user',
          content: `Size this use case.\n\n${intakeContext}\n\nPRD:\n${JSON.stringify(prdResult)}\n\nOutput ONLY a JSON object matching the schema in the system prompt. No prose before {. No prose after }.`,
        }],
        max_tokens: 2000,
        temperature: 0,
      });
      if (!mountedRef.current) return;
      setSizing(sizingResult);

      setStage('generating_scoring');
      const scoringResult = await callWithRetry({
        system: SCORING_PROMPT,
        messages: [{
          role: 'user',
          content: `Score this use case.\n\n${intakeContext}\n\nPRD:\n${JSON.stringify(prdResult)}\n\nSIZING:\n${JSON.stringify(sizingResult)}\n\nOutput ONLY a JSON object matching the schema in the system prompt. No prose before {. No prose after }.`,
        }],
        max_tokens: 8000,
        temperature: 0,
      });
      if (!mountedRef.current) return;
      setScoring(scoringResult);

      setStage('review');
    } catch (e) {
      if (mountedRef.current) {
        setError(`Generation failed: ${e.message}. Reset and try again, or refine the interview answers.`);
        setStage('error');
      }
    } finally {
      if (mountedRef.current) setIsGenerating(false);
    }
  };

  const handleAddToBacklog = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Construct first — if this throws, we don't clear state
      const newUC = buildSubmittedUseCase({
        extractedFields,
        prd,
        sizing,
        scoring,
        messages,
      });
      // Then notify parent
      onAddToBacklog(newUC);
      // Then reset
      handleReset();
    } catch (e) {
      if (mountedRef.current) {
        setError(`Couldn't construct use case object: ${e.message}`);
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div>
      <div className="sticky top-0 z-20 bg-gray-50 -mx-6 px-6 pt-2 pb-3 mb-3 border-b border-gray-200">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Submit new use case</h1>
            <p className="text-sm text-gray-600 mt-0.5">
              Chat → PRD → sizing → scoring. Review before adding to backlog.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {stage === 'review' && (
              <button
                onClick={handleAddToBacklog}
                style={{ backgroundColor: '#1F3A5F', color: '#ffffff' }}
                className="px-4 py-2 text-sm rounded-md flex items-center gap-1.5 font-semibold shadow-md hover:opacity-90 transition-opacity"
              >
                <PlusCircle size={16} /> Submit to backlog
              </button>
            )}
            {stage !== 'start' && (
              <button
                onClick={handleReset}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <RotateCcw size={11} /> Reset
              </button>
            )}
          </div>
        </div>

        <PipelineIndicator stage={stage} />

        {stage === 'review' && (
          <div className="mt-3 flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded text-sm">
            <Check size={14} className="text-emerald-700 mt-0.5 flex-shrink-0" />
            <div className="text-emerald-900 leading-snug flex-1">
              <span className="font-semibold">Ready to submit.</span> Review the preview, refine via chat, then <span className="font-semibold">Submit to backlog</span>.
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 border border-red-200 bg-red-50 rounded-md p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <div className="leading-snug">{error}</div>
        </div>
      )}

      {stage === 'start' && !hasStarted && (
        <IntakeFormCard onStart={handleStartFromForm} />
      )}

      {(stage !== 'start' || hasStarted) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <ChatColumn
              messages={messages}
              isLoading={isLoading}
              isGenerating={isGenerating}
              pendingInput={pendingInput}
              setPendingInput={setPendingInput}
              onSend={handleSend}
              stage={stage}
              onGenerate={handleGenerateDownstream}
            />
          </div>
          <div className="lg:col-span-5">
            <PreviewColumn
              stage={stage}
              extractedFields={extractedFields}
              prd={prd}
              sizing={sizing}
              scoring={scoring}
              weights={weights}
              messages={messages}
              onAddToBacklog={handleAddToBacklog}
            />
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div
          className="mt-6 border-2 rounded-md p-4 flex items-center justify-between gap-4"
          style={{ borderColor: NAVY, backgroundColor: 'rgba(31, 58, 95, 0.05)' }}
        >
          <div className="flex items-start gap-2">
            <Check size={18} className="text-emerald-700 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold" style={{ color: NAVY }}>Done reviewing?</div>
              <div className="text-xs text-gray-700 mt-0.5">
                Will compete against the active backlog under current scoring weights.
              </div>
            </div>
          </div>
          <button
            onClick={handleAddToBacklog}
            style={{ backgroundColor: '#1F3A5F', color: '#ffffff' }}
            className="px-5 py-2.5 text-sm font-semibold rounded-md flex items-center gap-2 shadow-md flex-shrink-0 hover:opacity-90 transition-opacity"
          >
            <PlusCircle size={16} /> Submit to backlog
          </button>
        </div>
      )}
    </div>
  );
}

function IntakeFormCard({ onStart }) {
  const [problem, setProblem] = useState('');
  const [bucket, setBucket] = useState('');
  const [cohort, setCohort] = useState('');
  const [phi, setPhi] = useState('');
  const [voice, setVoice] = useState('');
  const [autonomy, setAutonomy] = useState('');
  const [buildPath, setBuildPath] = useState('');

  const handleSubmit = () => {
    onStart({ problem: problem.trim(), bucket, cohort, phi, voice, autonomy, buildPath });
  };

  const canSubmit = problem.trim().length > 0;

  return (
    <div className="border-2 rounded-md bg-white p-5 shadow-sm" style={{ borderColor: NAVY }}>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Start a new submission</h2>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
          Describe the problem and add any context you have. The chat will probe for what's missing.
        </p>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
            Briefly describe the problem you're trying to solve
          </label>
          <span className="text-[10px] text-gray-400">Required</span>
        </div>
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="e.g., Clinicians spend ~15 minutes per visit on post-encounter documentation across our 3M annual visits. Looking at ambient AI scribes to reclaim clinician time and reduce burnout."
          className="w-full text-sm border border-gray-300 rounded px-3 py-2 leading-relaxed focus:outline-none resize-y"
          rows={4}
          style={{ borderColor: problem.trim() ? NAVY : undefined }}
        />
        <div className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
          A few sentences is plenty. Include the pain, who experiences it, and any rough numbers if you have them.
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Optional context</h3>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Set what you already know. Skip anything that's unclear — the chat will probe.
        </p>
      </div>

      <div className="space-y-4">
        <FormRadioGroup
          label="AI Strategy Bucket"
          value={bucket}
          onChange={setBucket}
          options={[
            { value: 'Clinical Efficiency', label: 'Clinical Efficiency', sublabel: 'Makes clinicians or staff faster · removes manual work' },
            { value: 'Patient Engagement', label: 'Patient Engagement', sublabel: 'Reaches patients · improves adherence or outcomes' },
            { value: 'Market Expansion', label: 'Market Expansion', sublabel: 'Becomes a product we sell or license externally' },
            { value: '', label: 'Not sure yet', sublabel: 'Let the agent figure it out' },
          ]}
        />

        <FormSelect
          label="Customer cohort"
          value={cohort}
          onChange={setCohort}
          options={[
            { value: '', label: 'Not sure / decide later' },
            { value: 'Cross-cohort', label: 'Cross-cohort (all customers)' },
            { value: 'MEDVi', label: 'MEDVi' },
            { value: 'Remedy Meds', label: 'Remedy Meds' },
            { value: 'JoinFridays', label: 'JoinFridays' },
            { value: 'Happy Sleep', label: 'Happy Sleep' },
            { value: 'Everlywell', label: 'Everlywell' },
            { value: 'Other', label: 'Other / new customer' },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormTriToggle
            label="Touches PHI?"
            sublabel="Patient health information"
            value={phi}
            onChange={setPhi}
          />
          <FormTriToggle
            label="Voice or telephony?"
            sublabel="Calls, voicebots, HeyRevia overlap"
            value={voice}
            onChange={setVoice}
          />
        </div>

        <FormRadioGroup
          label="Autonomy level"
          value={autonomy}
          onChange={setAutonomy}
          options={[
            { value: 'human-in-loop', label: 'Human in the loop', sublabel: 'AI proposes, person decides' },
            { value: 'supervised', label: 'Supervised', sublabel: 'AI acts, person reviews periodically' },
            { value: 'autonomous', label: 'Autonomous', sublabel: 'AI acts without per-decision review' },
            { value: '', label: 'Not sure yet', sublabel: '' },
          ]}
        />

        <FormRadioGroup
          label="Build preference"
          value={buildPath}
          onChange={setBuildPath}
          options={[
            { value: 'Rapid Prototype', label: 'Rapid Prototype', sublabel: 'Ship something fast, iterate' },
            { value: 'Prompt Engineering', label: 'Prompt Engineering', sublabel: 'Structured LLM workflow' },
            { value: 'Vendor Evaluation', label: 'Vendor Evaluation', sublabel: 'Buy vs. build vendor' },
            { value: 'Custom Build', label: 'Custom Build', sublabel: 'OpenLoop owns the workflow' },
            { value: '', label: 'Let the AI recommend', sublabel: '' },
          ]}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
        <div className="text-[11px] text-gray-500 leading-snug">
          {canSubmit
            ? 'Ready to start. The chat will pick up from here.'
            : 'Add a problem description above to start the chat.'}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={canSubmit
            ? { backgroundColor: NAVY, color: '#ffffff' }
            : { backgroundColor: '#E5E7EB', color: '#9CA3AF', cursor: 'not-allowed' }}
          className="px-5 py-2.5 text-sm font-semibold rounded-md flex items-center gap-2 shadow-md transition-opacity flex-shrink-0"
        >
          Start chat <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function FormRadioGroup({ label, value, onChange, options }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">{label}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => onChange(opt.value)}
              className={`text-left px-3 py-2 rounded border transition-all ${
                selected
                  ? 'bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={selected ? { borderColor: NAVY, borderWidth: '2px', padding: '7px 11px' } : {}}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: selected ? NAVY : '#D1D5DB' }}
                >
                  {selected && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NAVY }} />}
                </div>
                <div className="text-sm font-medium text-gray-900">{opt.label}</div>
              </div>
              {opt.sublabel && <div className="text-[11px] text-gray-500 mt-0.5 ml-5">{opt.sublabel}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded px-3 py-2 bg-white hover:border-gray-300 focus:outline-none"
        style={{ borderColor: value ? NAVY : undefined }}
      >
        {options.map((opt) => (
          <option key={opt.label} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function FormTriToggle({ label, sublabel, value, onChange }) {
  const options = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: '', label: 'Not sure' },
  ];
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      {sublabel && <div className="text-[11px] text-gray-500 mb-2">{sublabel}</div>}
      <div className="flex gap-1.5 mt-1">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => onChange(opt.value)}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded transition-all ${
                selected ? '' : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
              style={selected ? { backgroundColor: NAVY, color: '#ffffff' } : {}}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PipelineIndicator({ stage }) {
  const interviewDone = !['start', 'interviewing'].includes(stage);
  const prdDone = ['generating_sizing', 'generating_scoring', 'review'].includes(stage);
  const sizingDone = ['generating_scoring', 'review'].includes(stage);
  const scoringDone = stage === 'review';

  const steps = [
    { label: 'Intake', active: stage === 'interviewing' || stage === 'start', done: interviewDone },
    { label: 'PRD', active: stage === 'generating_prd', done: prdDone },
    { label: 'Sizing', active: stage === 'generating_sizing', done: sizingDone },
    { label: 'Scoring', active: stage === 'generating_scoring', done: scoringDone },
    { label: 'Review', active: stage === 'review', done: false },
  ];

  return (
    <div className="flex items-center">
      {steps.map((s, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <React.Fragment key={s.label}>
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors border"
                style={
                  s.done ? { backgroundColor: '#059669', color: '#ffffff', borderColor: '#059669' } :
                  s.active ? { backgroundColor: 'rgba(31, 58, 95, 0.15)', color: NAVY, borderColor: NAVY } :
                  { backgroundColor: '#F3F4F6', color: '#9CA3AF', borderColor: '#E5E7EB' }
                }
              >
                {s.done ? <Check size={11} strokeWidth={3} /> : idx + 1}
              </div>
              <div className={`text-xs ${
                s.done ? 'text-emerald-700 font-semibold' :
                s.active ? 'text-gray-800 font-semibold' :
                'text-gray-400'
              }`}>
                {s.label}
              </div>
            </div>
            {!isLast && (
              <div className={`flex-1 h-px mx-2 transition-colors ${s.done ? 'bg-emerald-600/40' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ChatColumn({ messages, isLoading, isGenerating, pendingInput, setPendingInput, onSend, stage, onGenerate }) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const scrollRef = useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [safeMessages, isLoading]);

  const isInterviewing = stage === 'start' || stage === 'interviewing';
  const isReady = stage === 'ready_to_generate';
  const isReview = stage === 'review';
  const canChat = isInterviewing || isReady || isReview;

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border border-gray-200 rounded-md bg-white flex flex-col" style={{ height: '620px' }}>
      <div className="border-b border-gray-100 px-4 py-2.5 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Intake conversation</div>
          <div className="text-xs text-gray-600 mt-0.5">
            {(() => {
              const userTurns = safeMessages.filter(m => m?.role === 'user').length;
              if (safeMessages.length === 0) return 'Describe a business problem you want AI to help solve.';
              if (userTurns === 0) return 'Started — agent is asking the first question';
              return `${userTurns} turn${userTurns !== 1 ? 's' : ''}`;
            })()}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {safeMessages.length === 0 && (
          <div className="text-sm text-gray-500 italic leading-relaxed">
            Describe the problem in your own words. The agent will ask follow-ups to gather context. Conversational, not formful.
          </div>
        )}
        {safeMessages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {isLoading && (
          <div className="text-xs text-gray-500 italic flex items-center gap-2 pt-1">
            <LoadingDot />
            <span>Thinking...</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 p-3">
        {isReady && (
          <div className="mb-2 flex items-start gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded text-xs">
            <Check size={12} className="text-emerald-700 mt-0.5 flex-shrink-0" />
            <div className="text-emerald-800 leading-snug">
              Interview complete. Keep chatting to refine, or hit <span className="font-semibold">Generate</span>.
            </div>
          </div>
        )}
        {isReview && (
          <div className="mb-2 flex items-start gap-2 p-2 bg-blue-50 border border-blue-100 rounded text-xs">
            <Info size={12} className="text-blue-700 mt-0.5 flex-shrink-0" />
            <div className="text-blue-800 leading-snug">
              Keep chatting to refine. Hit <span className="font-semibold">Regenerate</span> to refresh PRD, sizing, scoring.
            </div>
          </div>
        )}
        {isGenerating && (
          <div className="text-xs text-gray-500 italic text-center py-2 flex items-center justify-center gap-2">
            <LoadingDot />
            <span>Generating downstream artifacts — see preview panels below.</span>
          </div>
        )}
        {canChat && (
          <>
            <div className="flex gap-2 items-end">
              <textarea
                value={pendingInput}
                onChange={(e) => setPendingInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={safeMessages.length === 0
                  ? 'e.g., Clinicians spend ~15 minutes per visit on documentation...'
                  : isReview ? 'Refine the use case (e.g., "the volume is actually 500K not 400K")...'
                  : 'Your response...'}
                disabled={isLoading}
                className="flex-1 text-sm border border-gray-200 rounded px-3 py-2 resize-none focus:outline-none focus:border-[#1F3A5F] disabled:bg-gray-50"
                rows={2}
              />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={onSend}
                  disabled={isLoading || !pendingInput.trim()}
                  style={(isLoading || !pendingInput.trim())
                    ? { backgroundColor: '#E5E7EB', color: '#9CA3AF', cursor: 'not-allowed' }
                    : { backgroundColor: NAVY, color: '#ffffff' }}
                  className="px-4 py-2 text-sm font-semibold rounded flex items-center gap-1.5 shadow-sm transition-opacity"
                >
                  <Send size={13} /> Send
                </button>
                {(isReady || isReview) && (
                  <button
                    onClick={onGenerate}
                    disabled={isLoading || isGenerating}
                    style={{ borderColor: NAVY, color: NAVY }}
                    className="px-3 py-2 bg-white border-2 text-sm font-semibold rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {isReview ? 'Regenerate' : 'Generate'}
                  </button>
                )}
              </div>
            </div>
            <div className="text-[10px] text-gray-400 mt-1.5 text-right">
              Press <kbd className="px-1 py-0.5 border border-gray-200 rounded text-[10px] font-mono">Enter</kbd> to send · <kbd className="px-1 py-0.5 border border-gray-200 rounded text-[10px] font-mono">Shift+Enter</kbd> for new line
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message?.role === 'user';
  const content = message?.content;
  // Coerce content to string — guards against the AI returning an object,
  // null, or anything else that would crash React when rendered as a child.
  const safeContent = typeof content === 'string'
    ? content
    : content == null
      ? '(no message)'
      : JSON.stringify(content);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
        {isUser ? 'You' : 'Agent'}
      </div>
      <div
        className="rounded-md px-3 py-2 text-sm leading-relaxed border"
        style={isUser
          ? { backgroundColor: '#F3F4F6', color: '#1F2937', borderColor: 'transparent' }
          : { backgroundColor: 'rgba(31, 58, 95, 0.05)', color: '#1F2937', borderColor: 'rgba(31, 58, 95, 0.1)' }}
      >
        {safeContent}
      </div>
    </div>
  );
}

function LoadingDot() {
  return (
    <span className="inline-flex gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
    </span>
  );
}

function PreviewColumn({ stage, extractedFields, prd, sizing, scoring, weights, messages, onAddToBacklog }) {
  if (stage === 'start' && Object.keys(extractedFields).length === 0) {
    return (
      <div className="border border-dashed border-gray-300 rounded-md bg-gray-50 p-5 text-sm text-gray-600 leading-relaxed">
        <div className="font-medium text-gray-800 mb-2">Live preview</div>
        Extracted fields populate here as the agent processes the conversation. PRD, sizing, and scoring follow.
      </div>
    );
  }

  const showPRD = stage === 'generating_prd' || prd;
  const showSizing = stage === 'generating_sizing' || sizing;
  const showScoring = stage === 'generating_scoring' || scoring;
  const showFinal = stage === 'review';

  // In review state, expand the preview vertically so users can read everything
  // (the global sticky header keeps the indicator + submit button visible while they scroll)
  const containerClasses = showFinal
    ? 'space-y-3'
    : 'space-y-3 overflow-y-auto pr-1';
  const containerStyle = showFinal ? {} : { maxHeight: '620px' };

  return (
    <div className={containerClasses} style={containerStyle}>
      <ExtractedFieldsCard extractedFields={extractedFields} />
      {showPRD && <PRDPreviewCard prd={prd} />}
      {showSizing && <SizingPreviewCard sizing={sizing} messages={messages} />}
      {showScoring && <ScoringPreviewCard scoring={scoring} weights={weights} />}
    </div>
  );
}

function ExtractedFieldsCard({ extractedFields }) {
  const ef = extractedFields || {};
  const fields = [
    ['Title', ef.title],
    ['Description', ef.description],
    ['AI Strategy Bucket', ef.bucket],
    ['Customer cohort', ef.customer_cohort],
    ['Platform pillars', Array.isArray(ef.platform_pillars) ? ef.platform_pillars.join(', ') : ef.platform_pillars],
    ['Problem', ef.problem_statement],
    ['User', ef.user],
    ['Volume', ef.volume],
    ['Current cost', ef.current_cost],
    ['Success criteria', ef.success_criteria],
    ['Constraints', Array.isArray(ef.constraints) ? ef.constraints.join('; ') : ef.constraints],
    ['Autonomy', ef.autonomy_level],
    ['Build inclination', ef.build_inclination],
    ['PHI flag', ef.phi_flag === true ? 'Yes' : ef.phi_flag === false ? 'No' : null],
    ['Voice AI flag', ef.voice_ai_flag === true ? 'Yes' : ef.voice_ai_flag === false ? 'No' : null],
  ];

  return (
    <div className="border border-gray-200 rounded-md bg-white p-4">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2">Extracted</div>
      <div className="space-y-1 text-xs">
        {fields.map(([label, value], i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-28 text-gray-500 flex-shrink-0">{label}</div>
            <div className={`flex-1 leading-snug ${value ? 'text-gray-800' : 'text-gray-400 italic'}`}>
              {value || 'Awaiting...'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PRDPreviewCard({ prd }) {
  return (
    <div className="border border-gray-200 rounded-md bg-white p-4">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2 flex items-center gap-2">
        PRD {!prd && <LoadingDot />}
      </div>
      {!prd ? (
        <div className="text-xs text-gray-500 italic">Generating PRD...</div>
      ) : (
        <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
          <div><span className="font-medium text-gray-900">Problem:</span> {prd.problem_statement}</div>
          <div><span className="font-medium text-gray-900">User story:</span> <span className="italic">{prd.user_story}</span></div>
          <NestedList label="Acceptance criteria" items={prd.acceptance_criteria} />
          <NestedList label="Edge cases" items={prd.edge_cases} />
          <NestedList label="Out of scope" items={prd.out_of_scope} />
          <NestedList label="Success metrics" items={prd.success_metrics} />
        </div>
      )}
    </div>
  );
}

function NestedList({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="font-medium text-gray-900 mb-0.5">{label}</div>
      <ul className="ml-2 space-y-0.5 text-gray-700">
        {items.map((it, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-gray-400">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SizingPreviewCard({ sizing, messages }) {
  // Mirror the same deterministic math layer used in buildSubmittedUseCase so the
  // preview shows exactly what the backlog card will show post-submit. This means
  // the user sees corrected values, adjustment notes, and the canonical product —
  // not the AI's raw (and sometimes wrong) numbers.
  const PLAUSIBLE_CEILING = 1_000_000_000;

  // Run the same fidelity check the submitted use case will run, so the user can
  // see WHICH user-stated numbers the AI failed to preserve BEFORE they submit.
  const fidelityWarnings = sizing && messages ? verifyInputFidelity(messages, sizing) : [];

  const sanitize = (rawValue, unit) => {
    if (rawValue === undefined || rawValue === null || isNaN(rawValue) || !isFinite(rawValue)) {
      return { value: 0, adjusted: true };
    }
    const u = (unit || '').toLowerCase().trim();
    const isRatio = u === 'ratio' || u === '%' || u === 'pct' || u === 'percent' ||
                    u.includes('ratio') || u.includes('rate') || u.includes('share') ||
                    u.includes('percent') || u.includes('reduction') || u.includes('lift');
    let v = rawValue;
    let adjusted = false;
    if (isRatio && v < 0) { v = Math.abs(v); adjusted = true; }
    if (isRatio && v > 1) {
      v = v <= 100 ? v / 100 : 1.0;
      adjusted = true;
    }
    if (!isRatio && v < 0) { v = Math.abs(v); adjusted = true; }
    return { value: v, adjusted };
  };

  // Build sanitized drivers list with adjustment tracking
  const sanitizedDrivers = Array.isArray(sizing?.value_drivers)
    ? sizing.value_drivers.map((d) => {
        const raw = typeof d.defaultValue === 'number' ? d.defaultValue : parseFloat(d.defaultValue);
        const { value, adjusted } = sanitize(raw, d.unit);
        return { ...d, defaultValue: value, _rawValue: raw, _adjusted: adjusted };
      })
    : [];

  const driverProduct = sanitizedDrivers.length > 0
    ? sanitizedDrivers.reduce((acc, d) => acc * d.defaultValue, 1)
    : null;
  const isProductPlausible = driverProduct !== null
    && isFinite(driverProduct) && !isNaN(driverProduct)
    && driverProduct >= 0 && driverProduct <= PLAUSIBLE_CEILING;
  const statedTotal = typeof sizing?.annual_value_capture_usd === 'number' ? sizing.annual_value_capture_usd : 0;
  const isStatedPlausible = isFinite(statedTotal) && !isNaN(statedTotal)
    && statedTotal >= 0 && statedTotal <= PLAUSIBLE_CEILING;
  const displayTotal = isProductPlausible
    ? driverProduct
    : (isStatedPlausible ? statedTotal : 0);
  const anyAdjusted = sanitizedDrivers.some((d) => d._adjusted);
  const showWarning = driverProduct !== null && !isProductPlausible;
  // Also surface narrative-vs-product mismatch when both are plausible but disagree
  const narrativeMismatch = isProductPlausible && isStatedPlausible
    && Math.abs(driverProduct - statedTotal) / Math.max(driverProduct, statedTotal, 1) > 0.15;

  return (
    <div className="border border-gray-200 rounded-md bg-white p-4">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2 flex items-center gap-2">
        Sizing {!sizing && <LoadingDot />}
      </div>
      {!sizing ? (
        <div className="text-xs text-gray-500 italic">Generating sizing estimates...</div>
      ) : (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <SizingMetric label="Annual value" value={formatCurrency(displayTotal)} />
            <SizingMetric label="Time to build" value={`${sizing.time_to_build_weeks || '—'} wk`} />
            <SizingMetric label="Time to value" value={`${sizing.time_to_first_value_weeks || '—'} wk`} />
          </div>
          <div className="text-gray-700 leading-relaxed pt-2 border-t border-gray-100">
            <span className="font-medium text-gray-900">Build path:</span> {sizing.build_path} · {sizing.complexity_tier} complexity
          </div>
          {sanitizedDrivers.length > 0 && (
            <div>
              <div className="font-medium text-gray-900 mb-1">Value drivers</div>
              <div className="space-y-0.5">
                {sanitizedDrivers.map((d, i) => (
                  <div key={i} className="flex items-baseline gap-2 leading-snug">
                    <span className="font-mono text-gray-400 w-4 text-center flex-shrink-0">{d.operator || (i === 0 ? '→' : '×')}</span>
                    <span className="text-gray-800 flex-1">
                      {d.name}
                      {d._adjusted && (
                        <span className="ml-1 text-[10px] text-amber-700 font-medium" title={`AI returned ${d._rawValue}; sanitized to ${d.defaultValue}`}>· adjusted</span>
                      )}
                    </span>
                    <span className="tabular-nums text-gray-900 font-medium">{typeof d.defaultValue === 'number' ? d.defaultValue.toLocaleString() : d.defaultValue}</span>
                    <span className="text-gray-500 text-[10px] w-12">{d.unit}</span>
                  </div>
                ))}
                <div className="flex items-baseline gap-2 leading-snug pt-1 border-t border-gray-100 mt-1">
                  <span className="font-mono font-bold w-4 text-center flex-shrink-0" style={{ color: NAVY }}>=</span>
                  <span className="font-semibold flex-1" style={{ color: NAVY }}>Computed total</span>
                  <span className="tabular-nums font-bold" style={{ color: NAVY }}>{formatCurrency(displayTotal)}</span>
                </div>
                {anyAdjusted && !showWarning && (
                  <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 leading-relaxed">
                    <span className="font-semibold">Math check caught a unit issue.</span> One or more inputs were adjusted for consistency (e.g., a percentage entered as 47 was read as 0.47). Adjustments are tagged per-input above and will appear as LOW-confidence assumptions on the use case profile.
                  </div>
                )}
                {showWarning && (
                  <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 leading-relaxed">
                    <span className="font-semibold">Math check rejected the inputs.</span> The calculation came to {formatCurrency(driverProduct)}, which is outside the plausible range even after unit correction. Showing the AI's stated total instead — try regenerating, or refine via chat.
                  </div>
                )}
                {narrativeMismatch && (
                  <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 leading-relaxed">
                    <span className="font-semibold">Math check caught a discrepancy.</span> AI's prose said {formatCurrency(statedTotal)}, but the inputs calculate to {formatCurrency(driverProduct)}. Edit any input to adjust.
                  </div>
                )}
                {fidelityWarnings.length > 0 && (
                  <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 leading-relaxed">
                    <div className="font-semibold mb-1">Math check found missing inputs.</div>
                    <ul className="space-y-0.5 ml-3 list-disc">
                      {fidelityWarnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          {sizing.value_calculation_walkthrough && (
            <div className="text-gray-600 leading-relaxed italic pt-1">{sizing.value_calculation_walkthrough}</div>
          )}
          {sizing.named_assumptions && sizing.named_assumptions.length > 0 && (
            <div>
              <div className="font-medium text-gray-900 mb-1">Supplementary assumptions</div>
              <div className="space-y-1">
                {sizing.named_assumptions.map((a, i) => (
                  <div key={i} className="border border-gray-100 rounded px-2 py-1">
                    <div className="text-gray-800 leading-snug">{a.assumption}</div>
                    <div className="flex gap-2 mt-0.5 text-[10px]">
                      <span className={`px-1.5 rounded font-medium ${
                        a.confidence === 'HIGH' ? 'bg-emerald-50 text-emerald-700' :
                        a.confidence === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                        'bg-rose-50 text-rose-700'
                      }`}>{a.confidence}</span>
                      <span className="text-gray-500 italic">{a.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {sizing.voice_ai_posture && sizing.voice_ai_posture !== 'N/A' && (
            <div className="text-gray-700 leading-relaxed pt-1">
              <span className="font-medium text-gray-900">Voice posture:</span> {sizing.voice_ai_posture}
              {sizing.voice_ai_rationale && <div className="text-gray-600 italic mt-0.5">{sizing.voice_ai_rationale}</div>}
            </div>
          )}
          {sizing.bucket_sequencing_fit && sizing.bucket_sequencing_fit.startsWith('Sequencing risk') && (
            <div className="text-rose-700 pt-1">
              <span className="font-medium">Flag:</span> {sizing.bucket_sequencing_fit}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SizingMetric({ label, value }) {
  return (
    <div className="border border-gray-100 rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900 tabular-nums">{value}</div>
    </div>
  );
}

function ScoringPreviewCard({ scoring, weights }) {
  if (!scoring || !scoring.rubric_scoring) {
    return (
      <div className="border border-gray-200 rounded-md bg-white p-4">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2 flex items-center gap-2">
          Scoring <LoadingDot />
        </div>
        <div className="text-xs text-gray-500 italic">Running factor-first scoring across six rubric dimensions...</div>
      </div>
    );
  }

  // Defensive accessor — every nested rubric dim gets a sane default
  const dim = (key) => scoring.rubric_scoring?.[key] || { score: 3, rationale: '', factors: [] };

  const rubricForComposite = {
    impact: { score: dim('impact_magnitude').score || 3 },
    alignment: { score: dim('strategic_alignment').score || 3 },
    feasibility: { score: dim('feasibility').score || 3 },
    ttfv: { score: dim('time_to_first_value').score || 3 },
    adoption: { score: dim('adoption_risk').score || 3 },
    dependencies: { score: dim('dependencies').score || 3 },
  };
  const composite = computeComposite(rubricForComposite, weights);

  const dims = [
    ['Impact', 'impact_magnitude'],
    ['Alignment', 'strategic_alignment'],
    ['Feasibility', 'feasibility'],
    ['TTFV', 'time_to_first_value'],
    ['Adoption', 'adoption_risk'],
    ['Dependencies', 'dependencies'],
  ];

  return (
    <div className="border border-gray-200 rounded-md bg-white p-4">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2">Scoring</div>
      <div className="flex items-baseline justify-between pb-2 border-b border-gray-100 mb-2">
        <div className="text-xs text-gray-500">Composite (current weights)</div>
        <div className="text-2xl font-semibold tabular-nums" style={{ color: NAVY }}>{composite.toFixed(0)}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {dims.map(([label, key]) => (
          <div key={key} className="border border-gray-100 rounded px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
            <div className="text-sm font-semibold text-gray-900 tabular-nums">
              {dim(key).score || '—'}<span className="text-xs text-gray-400">/5</span>
            </div>
          </div>
        ))}
      </div>
      {scoring.strategic_commentary && (
        <div className="text-xs text-gray-700 leading-relaxed pt-2 border-t border-gray-100 italic">
          {scoring.strategic_commentary}
        </div>
      )}
    </div>
  );
}

function HomeView({ onNavigate }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 3rem)' }}>
      <div className="max-w-xl w-full text-center px-6 py-10">
        {/* OpenLoop mark — large, centered */}
        <div className="flex justify-center mb-8">
          <svg width="64" height="64" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="11" r="7.5" stroke="#E91E63" strokeWidth="2.5" fill="none" />
            <circle cx="11" cy="20" r="7.5" stroke="#E91E63" strokeWidth="2.5" fill="none" />
            <circle cx="29" cy="20" r="7.5" stroke="#E91E63" strokeWidth="2.5" fill="none" />
            <circle cx="20" cy="29" r="7.5" stroke="#E91E63" strokeWidth="2.5" fill="none" />
          </svg>
        </div>

        <h1 className="text-4xl font-bold tracking-tight mb-4" style={{ color: NAVY, fontFamily: 'Georgia, "Times New Roman", serif' }}>
          AI Strategy Operating System
        </h1>
        <p className="text-base text-gray-700 leading-relaxed mb-3 max-w-lg mx-auto">
          An operating system for AI Strategy, built to increase speed from idea to investment.
        </p>
        <p className="text-sm text-gray-500 leading-relaxed mb-10 max-w-lg mx-auto">
          Built on OpenLoop's stated strategy, peer-reviewed studies, and industry benchmarks. Traceable, configurable value models and priority weights.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => onNavigate('backlog')}
            style={{ backgroundColor: NAVY, color: '#ffffff' }}
            className="px-6 py-3 text-sm font-semibold rounded-md flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition-opacity"
          >
            View Backlog <ArrowRight size={14} />
          </button>
          <button
            onClick={() => onNavigate('submit')}
            style={{ borderColor: NAVY, color: NAVY }}
            className="px-6 py-3 text-sm font-semibold rounded-md border-2 bg-white flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            Submit a Use Case
          </button>
        </div>

        <div className="mt-16 text-[11px] text-gray-400 tracking-wider uppercase">
          Built by Ben Herring
        </div>
      </div>
    </div>
  );
}

function AssumptionsView() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">Assumptions</h1>
      <p className="text-sm text-gray-600 mt-1 mb-5 leading-relaxed">
        How the numbers behind the backlog were built — sources, confidence, and where to push back.
      </p>

      <div className="space-y-4">
        <div className="border border-gray-200 rounded-md bg-white p-5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-3 font-medium">Source classes</div>
          <p className="text-sm text-gray-800 mb-3 leading-relaxed">
            Every value driver carries a Source tag. Hover any label in a value model for full provenance — study, sample, vendor, conservatism applied.
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold" style={{ color: NAVY }}>Benchmark</span>
                <span className="text-xs text-gray-500">peer-reviewed studies or vendor-published deployment data</span>
              </div>
              <ul className="text-xs text-gray-700 space-y-0.5 ml-3">
                <li>• JAMA 2026 multisite ambient documentation — 16 min saved per encounter</li>
                <li>• Cohere Health PA automation — 47% admin reduction</li>
                <li>• Medallion credentialing — 66% admin reduction, 40x intake speedup</li>
                <li>• Waystar denial management — 30-65% reduction range</li>
                <li>• Hyro contact center — 40-85% deflection range</li>
                <li>• Arcadia GLP-1 dataset — 34% persistence at 12 months</li>
              </ul>
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold" style={{ color: NAVY }}>OpenLoop-stated</span>
                <span className="text-xs text-gray-500">public figures from OpenLoop materials</span>
              </div>
              <ul className="text-xs text-gray-700 space-y-0.5 ml-3">
                <li>• ~3M annual visits</li>
                <li>• 20K+ clinician network</li>
                <li>• 120+ clients</li>
                <li>• $1B revenue run rate</li>
                <li>• 600+ payer contracts</li>
              </ul>
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold" style={{ color: NAVY }}>Inferred</span>
                <span className="text-xs text-gray-500">OpenLoop scale × benchmark ratios</span>
              </div>
              <ul className="text-xs text-gray-700 space-y-0.5 ml-3">
                <li>• GLP-1 PA volume (~400K) — cohort scale × 83% PA requirement</li>
                <li>• Credentialing events (~6K) — network × ~30% turnover</li>
                <li>• Call volume (~4.5M) — visits × 1.5</li>
                <li>• Claims volume (~3.3M) — visits × 1.1</li>
              </ul>
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold" style={{ color: NAVY }}>Assumed</span>
                <span className="text-xs text-gray-500">explicit assumption where no benchmark exists</span>
              </div>
              <ul className="text-xs text-gray-700 space-y-0.5 ml-3">
                <li>• 15-20% discontinuation lift on GLP-1 outreach (UC-005). No peer-reviewed RCT exists. Structured as pilot-against-holdout to validate before scaling.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-md bg-white p-5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-3 font-medium">Reading the signals</div>
          <div className="space-y-2.5 text-sm text-gray-800 leading-relaxed">
            <div>
              <span className="font-semibold">Sizing confidence (0-100).</span> Source-weighted average across each value model's drivers. One-line rationale below the score names what would lift it.
            </div>
            <div>
              <span className="font-semibold">Completeness dots (backlog).</span> PRD richness, sizing depth, scoring rationale density. Confidence asks <em>how grounded is the math</em>; completeness asks <em>how richly contextualized is the case</em>.
            </div>
            <div>
              <span className="font-semibold">Editable, end-to-end.</span> Every driver recomputes live. If your number disagrees with what's there, that's the conversation.
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-md bg-white p-5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-3 font-medium">Most exposed gaps</div>
          <ul className="space-y-2 text-sm text-gray-800 leading-relaxed">
            <li>
              <span className="font-semibold">UC-005 (GLP-1 adherence)</span> — highest strategic value, weakest evidence base.
            </li>
            <li>
              <span className="font-semibold">UC-008 (HeyRevia integration)</span> — sizing assumes partnered posture; inherited/partnered/parallel decision is upstream of the build.
            </li>
            <li>
              <span className="font-semibold">UC-010 (productized AI clinical OS)</span> — Bucket 3 strategic bet; dollar figure understates equity-multiple value.
            </li>
          </ul>
        </div>

        <div className="border border-gray-200 rounded-md bg-white p-5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-3 font-medium">Org alignment</div>
          <ul className="text-sm text-gray-800 space-y-1.5 leading-relaxed">
            <li><span className="font-semibold">AI Strategy</span> (this function) — Backlog sourcing, prioritization, handoff to engineering</li>
            <li><span className="font-semibold">Governance & Internal Adoption</span> — AI governance gates, model risk, acceptable-use policy, change management</li>
            <li><span className="font-semibold">Tooling & AI Platform</span> — AI infrastructure, vendor management, platform engineering</li>
            <li><span className="font-semibold">Engineering</span> (COO's team) — Build and ship to production</li>
            <li><span className="font-semibold">HR</span> — Learning & development</li>
          </ul>
        </div>

        <div className="border border-gray-200 rounded-md bg-white p-5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-3 font-medium">AI Strategy Bucket alignment</div>
          <ul className="text-sm text-gray-800 space-y-2 leading-relaxed">
            <li><span className="font-semibold" style={{ color: NAVY }}>Clinical Efficiency</span> — Compresses the labor cost of care. Funds everything downstream.</li>
            <li><span className="font-semibold" style={{ color: STEEL }}>Patient Engagement</span> — Compounds customer outcome value. Trust + data foundation for Bucket 3.</li>
            <li><span className="font-semibold" style={{ color: BRONZE }}>Market Expansion</span> — Productizes the AI capability layer as a new revenue line. Bends the equity multiple.</li>
          </ul>
        </div>

        <div className="text-xs text-gray-500 italic leading-relaxed pt-2">
          Working prototype. Submit is live (real Anthropic API calls run intake, PRD, sizing, and scoring). Rough edges: no persistence beyond session, no search, no dependency graph viz. Already useful enough to run on real problems.
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// LEFT RAIL + APP
// ===========================================================================

function LeftRail({ activeView, setActiveView }) {
  const items = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'backlog', label: 'Backlog', icon: Inbox },
    { id: 'submit', label: 'Submit', icon: PlusCircle },
    { id: 'killed', label: 'Killed / Parked', icon: XCircle },
    { id: 'weights', label: 'Scoring weights', icon: Sliders },
    { id: 'assumptions', label: 'Assumptions', icon: Info },
  ];

  return (
    <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-white p-4">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          {/* OpenLoop mark — four interlocking rings approximation */}
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <circle cx="20" cy="11" r="7.5" stroke="#E91E63" strokeWidth="2.5" fill="none" />
            <circle cx="11" cy="20" r="7.5" stroke="#E91E63" strokeWidth="2.5" fill="none" />
            <circle cx="29" cy="20" r="7.5" stroke="#E91E63" strokeWidth="2.5" fill="none" />
            <circle cx="20" cy="29" r="7.5" stroke="#E91E63" strokeWidth="2.5" fill="none" />
          </svg>
          <div>
            <div className="text-base font-bold leading-none tracking-tight" style={{ color: NAVY }}>OpenLoop</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">AI Strategy</div>
          </div>
        </div>
      </div>
      <nav className="space-y-0.5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = activeView === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setActiveView(it.id)}
              style={active ? { backgroundColor: 'rgba(31, 58, 95, 0.1)', color: NAVY } : undefined}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-sm transition-colors ${
                active ? 'font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              {it.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-8 pt-4 border-t border-gray-100">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Built for</div>
        <div className="text-[11px] text-gray-600 leading-snug">
          Director of AI Technologies working session — internal use only.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState('home');
  const [selectedUseCaseId, setSelectedUseCaseId] = useState(null);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  // User-saved weight presets — array of { name, weights }
  const [weightPresets, setWeightPresets] = useState([]);
  const [sortBy, setSortBy] = useState('composite');
  const [filters, setFilters] = useState({ bucket: 'all', cohort: 'all', addedWithin: 'all' });
  const [submittedUseCases, setSubmittedUseCases] = useState([]);

  const allUseCases = useMemo(
    () => [...SEED_USE_CASES, ...submittedUseCases],
    [submittedUseCases]
  );

  const allRanked = useMemo(
    () => rankUseCases(allUseCases, weights, sortBy),
    [allUseCases, weights, sortBy]
  );

  const handleSelectUseCase = (id) => {
    setSelectedUseCaseId(id);
    setActiveView('profile');
  };

  const handleAddToBacklog = (newUseCase) => {
    setSubmittedUseCases((prev) => [...prev, newUseCase]);
    setActiveView('backlog');
  };

  const selectedUseCase = allUseCases.find((uc) => uc.id === selectedUseCaseId);

  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      <div className="flex">
        <LeftRail activeView={activeView} setActiveView={setActiveView} />
        <main className="flex-1 p-6 max-w-7xl">
          <ErrorBoundary key={activeView}>
            {activeView === 'home' && <HomeView onNavigate={setActiveView} />}
          {activeView === 'backlog' && (
            <BacklogView
              useCases={allUseCases}
              weights={weights}
              filters={filters}
              setFilters={setFilters}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onSelectUseCase={handleSelectUseCase}
            />
          )}
          {activeView === 'profile' && selectedUseCase && (
            <ProfileView
              useCase={selectedUseCase}
              allUseCases={allUseCases}
              weights={weights}
              onBack={() => setActiveView('backlog')}
              allRanked={allRanked}
              onSelectUseCase={setSelectedUseCaseId}
            />
          )}
          {activeView === 'submit' && (
            <SubmitView
              onAddToBacklog={handleAddToBacklog}
              weights={weights}
            />
          )}
          {activeView === 'killed' && <KilledView killedUseCases={KILLED_USE_CASES} />}
          {activeView === 'weights' && <WeightsView weights={weights} setWeights={setWeights} allUseCases={allUseCases} presets={weightPresets} setPresets={setWeightPresets} />}
          {activeView === 'assumptions' && <AssumptionsView />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
