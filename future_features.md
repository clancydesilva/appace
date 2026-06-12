# Appace — Future Feature Ideas

> Based on research into the psychology of doom scrolling, dopamine-loop addiction, behavioral economics (nudge theory), and real user sentiment on what makes screen time apps actually work vs. get uninstalled.

---

## The Problem Appace Already Solves Well

Appace's **hourly accrual model** is genuinely clever and psychologically sound. Most screen time apps give you a flat daily limit (e.g. "2 hours of Instagram") which creates two failure modes:

1. **Morning binge** — burn the full budget by 10am, feel deprived all day
2. **Restriction resentment** — the hard block feels punitive, so users delete the app [1]

Appace avoids both. The drip-feed model means you always have *some* time coming, and the silent accrual avoids giving you a dopamine ping ("You just earned 5 minutes!") that would ironically train you to check your phone. Research shows that dopamine acts as a "seeking" chemical — the spike occurs *before* the reward during anticipation, not after [2][3]. Silent drops avoid hijacking this loop.

**What follows are features that would build on this foundation** — moving Appace from "a timer that blocks you" to "a tool that rewires the habit."

---

## Tier 1 — High-Impact, Architecture-Compatible

These features directly address the core psychology of doom scrolling and fit naturally into Appace's existing native module + Zustand architecture.

---

### 1. 🧘 Mindful Friction — "The Pause"

**The psychology:** Doom scrolling operates on autopilot — your thumb opens Instagram before your conscious brain even decides to. Neuroscience calls this **System 1 thinking** (fast, impulsive). The most effective intervention is forcing a switch to **System 2** (slow, deliberate) before the app opens [4].

A study published in *Proceedings of the National Academy of Sciences (PNAS)* in 2023, conducted by researchers at the Max Planck Institute and University of Heidelberg, found that the app *one sec* — which shows a mandatory breathing animation before opening a target app — **reduced actual app opens by 57%** in a six-week field experiment with 280 participants [5]. Furthermore, over the six weeks, users attempted to open their target apps **37% less often** than in the first week, suggesting genuine long-term habit change [5].

Social media platforms exploit **variable ratio reinforcement schedules** — the same psychological mechanism used in slot machines [6][7]. Because users never know if the next swipe will bring something rewarding, the brain stays in perpetual anticipation. A forced pause disrupts this loop.

**How it would work in Appace:**

When `AppWatcherService` detects a tracked app opening (and balance > 0), instead of immediately starting the deduction timer:

1. Launch a full-screen **"Pause" interstitial** (similar route to `/timesup` but different intent)
2. Show a simple breathing animation or countdown: *"Take a breath. Do you still want to open this?"*
3. After 5 seconds, show two buttons: **"Continue" → deduct normally** / **"Not now" → return to home screen**
4. Track how often the user chooses "Not now" — this becomes a powerful metric

**Why this matters for Appace specifically:** Your accrual model already creates a sense of earned value ("I waited for this time"). Adding a pause reinforces that value — *"Do I really want to spend my 5 minutes on this?"* — rather than letting it slip away unconsciously.

**Implementation touch-points:**
- New route: `app/pause.tsx`
- Modify `AppWatcherService.kt` to launch pause screen before tracked app
- New Room field or SharedPreferences counter for "pauses taken" / "pauses where user backed out"

---

### 2. 📊 Session Reflection — "How Did That Feel?"

**The psychology:** Research shows that doom scrolling leaves people feeling *worse* — more anxious, more restless, less satisfied — but they don't consciously register this because the dopamine loop masks it [8][9]. Studies published in *Computers in Human Behavior Reports* (2024) specifically linked doomscrolling to elevated **existential anxiety**, feelings of dread, and pessimism [10]. The term **"popcorn brain"** — coined by researcher David Levy and widely referenced in 2024–2025 — describes the cognitive fragmentation caused by constant digital overstimulation, impairing executive functions like planning and sustained attention [11][12].

**Post-session self-monitoring** is a core CBT technique. Research consistently shows that systematically recording the connection between behaviours, thoughts, and emotions is one of the most effective interventions for behavioral addiction [13][14]. It helps individuals identify triggers, increases self-awareness, and allows them to "empirically examine" their own beliefs and actions [13].

**How it would work in Appace:**

When the user exits a tracked app (i.e. `AppWatcherService` detects they've left), show a brief overlay:

```
You just spent 4m 32s on Instagram.

How do you feel?
😊 Good   😐 Meh   😞 Worse
```

- One tap dismisses it (< 1 second interaction)
- Store the response in Room alongside the session duration
- Over time, surface patterns: *"You've felt 'worse' after 8 of your last 10 Instagram sessions"*

**Why this matters:** Users start to notice "I always feel bad after scrolling but I keep doing it" — which is the cognitive dissonance that drives actual behavior change. Unlike blocking, this builds **awareness** without restriction.

**Implementation touch-points:**
- New Room entity: `SessionLog` (timestamp, app package, duration seconds, mood rating)
- Modify `AppWatcherService.kt` to launch reflection overlay on tracked app exit
- New route: `app/reflect.tsx` (lightweight overlay)
- Aggregate mood data in a new section on the Home screen or a dedicated insights tab

---

### 3. 🔥 Streaks & Saved Time — Positive Reinforcement

**The psychology:** Users overwhelmingly prefer apps that reward them for *not* using their phone over apps that *punish* them for using it [1]. The difference is between "I'm broken and need to be controlled" vs. "I'm building something."

This exploits **loss aversion** — rooted in **Prospect Theory** (Kahneman & Tversky), which states that the psychological pain of losing something is approximately **twice as powerful** as the joy of gaining something of equal value [15]. Duolingo has famously weaponised this: users with a streak of 7+ days are retained at **2.4x higher rates** than those without [16]. As a streak grows longer, the **sunk cost effect** increases — users become less willing to break a 100-day streak than a 3-day one [16].

**How it would work in Appace:**

Track two new metrics:

1. **Unused balance at midnight** — when balance resets, the leftover seconds are your "saved time" that day. This reframes unused balance from "wasted" to "won."
2. **Under-budget streak** — consecutive days where you didn't hit zero balance (i.e. you never saw the Time's Up screen)

Display on the Home screen:
```
🔥 7 day streak — never hit zero
⏱️ 3h 42m saved this week
```

**Why this matters for Appace specifically:** Your accrual model creates a natural tension: "I could use this 5 minutes... or save it." Adding a visible "saved" counter turns this into a powerful positive feedback loop.

**Implementation touch-points:**
- New Room entity or fields: `dailySavedSeconds`, `streakDays`, `lastStreakDate`
- Modify `tick()` reset logic: before wiping balance at midnight, log the remaining seconds to a `DailyStats` table
- New Zustand fields: `streakDays`, `savedSecondsThisWeek`
- Home screen UI additions

---

### 4. 📈 Weekly Insights — Awareness Over Guilt

**The psychology:** Research emphasises that the *quality* of screen time matters as much as the quantity [17]. Simply showing "you used 47 minutes today" is meaningless. Showing *trends* and *context* builds genuine self-understanding. NIH-indexed research supports the use of "nudges" and environmental design — providing objective data empowers users to make informed, conscious decisions rather than inducing guilt [18].

**How it would work in Appace:**

A new **Insights** section (could be a new tab, or a scrollable section below the balance on the Home screen):

- **Daily bar chart** — last 7 days, showing minutes used vs. minutes earned (two-tone bars)
- **App breakdown** — which tracked apps consumed the most time this week
- **Mood correlation** (if Session Reflection is implemented) — "Apps that make you feel worse" vs. "Apps you enjoy"
- **Peak usage hours** — "You scroll most between 9–10pm" (helps user set environmental cues)
- **Trend line** — "Your daily usage has dropped 23% over the last 2 weeks"

**Why this matters:** This transforms Appace from a reactive blocker into a proactive self-awareness tool. The trend line is especially powerful — seeing concrete evidence that your behavior is changing provides the motivation to keep going.

**Implementation touch-points:**
- New Room entity: `DailyStats` (date, total minutes used, total minutes earned, minutes saved, per-app breakdown as JSON)
- New Zustand actions: `fetchWeeklyStats()`
- New screen or component: `app/(tabs)/insights.tsx` or a collapsible section on Home

---

## Tier 2 — Medium-Impact, Moderate Effort

These features address secondary psychological factors and quality-of-life issues that users consistently request.

---

### 5. 🎯 Intention Setting — "Why Are You Opening This?"

**The psychology:** Research from the University of Michigan (*"InteractOut"* study) showed that friction-based interventions were **16% more effective** at reducing screen time and app opens compared to traditional hard-lockout strategies [19]. The key insight: strategies that make users more *aware* of their behaviour outperform strategies that simply block it [19]. Asking "what do you want to do on this app?" before opening it creates a **completion cue** — something infinite-scroll design deliberately removes [4][5].

**How it would work:**

Before launching a tracked app (or as part of the Pause screen from Feature 1), show:

```
What are you opening Instagram for?

[ ] Check messages
[ ] Post something
[ ] Browse/scroll
[ ] Other: _______
```

If they select "Browse/scroll", show a gentle nudge: *"You have 8 minutes of balance. Set a goal?"* with a mini-timer option (e.g. "Remind me in 5 minutes").

This gives the brain the **terminal marker** that infinite scroll removes — "I came here to do X. X is done. I can leave."

---

### 6. 🌿 Gradual Difficulty — Adaptive Budgeting

**The psychology:** Cold-turkey approaches often fail — research notes that sudden abstinence can trigger a "post-detox binge," where individuals return to old habits once the intervention ends [20]. Behavioral economics shows that **gradual reduction** with small, barely-noticeable decreases is far more sustainable. Experts recommend focusing on changes you can keep up long-term, framing it as a "digital diet" rather than a hard cleanse [20].

**How it would work:**

A new setting: **"Auto-tighten"** — reduces the hourly accrual by 1 minute per week automatically.

```
Week 1: 5 mins/hr → 90 min max
Week 2: 4 mins/hr → 73 min max
Week 3: 3 mins/hr → 56 min max
...until user-set floor (e.g. 2 mins/hr)
```

The user sets their target floor and Appace gradually ramps down. Each week, the new rate is so close to the old one that it doesn't trigger restriction resentment.

**Implementation:** A new Room field `autoTightenEnabled`, `autoTightenFloorMinutes`, `autoTightenStartDate`. The `tick()` function calculates the current week's accrual rate dynamically.

---

### 7. 🛡️ "Panic Button" — Emergency Override with Accountability

**The psychology:** Hard blocks that can't be bypassed cause users to uninstall the app entirely [1]. But easy bypasses make the app worthless. The sweet spot is a bypass that creates **cognitive friction** — moving the user from System 1 (impulsive) to System 2 (deliberate) thinking [4].

**How it would work:**

When balance hits zero and Time's Up appears, offer an **"Emergency 10 minutes"** button that:

1. Requires typing a sentence: *"I am choosing to use extra time because: ___"* (cognitive friction — you can't autopilot through this)
2. Logs the override with timestamp and reason to a visible "Override History" in Settings
3. Optionally: limits emergency overrides to 2 per day
4. The override time is visually distinct on the weekly insights chart (red bar segments)

This respects user autonomy while creating enough friction that most impulsive override attempts get abandoned.

---

### 8. 🌙 Wind-Down Mode — Evening Screen Hygiene

**The psychology:** Doom scrolling peaks in the 9pm–midnight window. The blue light + dopamine loop combination directly harms sleep quality [11]. Research recommends structured "wind-down" rituals, including establishing tech-free periods and replacing screen time with slower-paced offline activities, as one of the most effective interventions for sleep hygiene [18][21].

**How it would work:**

A configurable "wind-down period" (e.g. last 2 hours of the window) where:

- Accrual rate drops to half (or zero — configurable)
- Balance display shifts to a warm amber color scheme
- A gentle notification: *"Wind-down mode — 1 hour until reset. You have 12 minutes remaining."*
- Optionally: auto-reduce tracked app time to 2-minute micro-sessions during this period

This creates a natural taper rather than a hard cutoff at midnight.

---

## Tier 3 — Differentiating Features (Longer-Term)

These would make Appace genuinely unique in the market, but require more architectural work.

---

### 9. 👥 Shared Pool — "We're In This Together"

**The psychology:** This is the most powerful form of social accountability. Instead of one person managing their own willpower, a group shares a single collective resource. If one person scrolls too much, *everyone* suffers. This leverages **guilt as a prosocial motivator** — you're not letting yourself down, you're letting your friends down. It's the same mechanism behind team sports, group study sessions, and military unit cohesion.

Research on peer-based digital wellbeing interventions (e.g. the "NUGU" program) shows that collaborative environments where participants set shared usage goals and hold each other accountable produce stronger outcomes than solo approaches [22]. Peer commitments — making public or semi-public promises to reduce usage — significantly increase follow-through [22][23].

**Existing apps doing this:**
- **Snitch** — has a "Shared Time Pot" where group members pool screen time limits. When anyone uses time, it's visible to the group and drains the shared pot.
- **Friend Controls** — when your time runs out, you must send a request to your friends who approve or deny extra time. The social embarrassment of asking creates massive friction [24].
- **Habitica** — the RPG-style app where your party takes damage if you fail your habits. Your scrolling literally hurts your friends' characters.

**How it would work in Appace:**

The accrual model makes this especially interesting:

1. **Create a Pact** — 2-5 friends join via share code
2. **Shared accrual pool** — instead of each person earning 5 mins/hr individually, the *group* earns a larger shared pool (e.g. 15 mins/hr for 3 people). Everyone draws from the same balance.
3. **Visibility** — each member can see who used how much: *"You: 12 mins · Alex: 23 mins · Sam: 4 mins"*
4. **Social pressure** — if one person drains the pool, everyone gets the Time's Up screen. The group self-regulates.
5. **Daily recap** — push notification at end of day: *"Your group saved 42 minutes today. Alex used the most."*

**Why this is nuclear-grade effective:** The research shows that the #1 reason people bypass screen time apps is *"I only hurt myself."* [1] When scrolling hurts your friends, the calculus changes completely.

**Implementation complexity:** This is the highest-effort feature because it requires a backend (Firebase Realtime Database or similar) for syncing the shared pool state across devices. But the local architecture is already there — `BalanceRepository` would just read from a remote pool instead of a local one when pact mode is active.

**Variants (easier to implement):**
- **Lite version (no server):** Instead of a shared pool, each person tracks independently but shares a daily summary screenshot or in-app export with friends. Manual accountability, zero infrastructure.
- **Approve/deny mode:** When anyone hits zero, they can request extra time from the group. Group votes via push notification. Majority rules. (Requires push infra.)

---

### 10. 👤 Accountability Partner (1-on-1)

**The psychology:** A simpler version of the shared pool. Users consistently say "I can't trust myself" — they want one trusted person to see their stats [1]. Research confirms that simply knowing a peer can see your progress often creates enough social pressure to change behaviour [22][23].

**How it would work:**

- Pair with a friend (via a simple share code)
- Partner can see your daily stats (not app names — just "over budget" or "under budget")
- Partner gets a notification if you use 3+ emergency overrides in a day
- Lightweight: this doesn't need to be a social network. Just one trusted person.

---

### 11. 🏆 Challenges & Milestones

**The psychology:** Gamification works when it taps into **intrinsic motivation** (mastery, progress) rather than extrinsic rewards (points for points' sake) [16]. Milestones that celebrate *real behavioral change* are powerful. Over-gamification can lead to "performative" engagement, so milestones should reflect genuine habit shifts [16].

**Examples:**

| Milestone | Trigger |
|---|---|
| "First Save" | First day you didn't hit zero balance |
| "Week Warrior" | 7-day streak |
| "Mindful Opener" | Chose "Not now" on 5 pause screens |
| "Self-Aware" | Logged mood for 20 sessions |
| "Trend Setter" | Weekly usage decreased for 3 consecutive weeks |
| "Night Owl No More" | No tracked app usage in last 2 hours of window for 5 days |

Display these as unlockable badges on a profile/achievements screen. Simple, but taps into the same reward circuitry that social media exploits — redirected toward healthy behavior.

---

### 12. 📵 "Focus Mode" — Earn Bonus Time

**The psychology:** This flips the entire model from restrictive to **earning-based**. Users on Reddit consistently say they prefer tools that let them *earn* screen time through productive behavior [1]. Behavioral economics research suggests that rather than punishing screen time (which reinforces its perceived value), apps should reward **"attention endurance"** — making offline time feel like a win [25].

**How it would work:**

A manual "Focus Mode" button on the Home screen. When activated:

- A timer counts up (like a stopwatch)
- Phone must stay on a non-tracked app (or screen off)
- Every 30 minutes of focus earns 5 bonus minutes of tracked-app time
- Bonus time is visually distinct from regular accrual (gold vs. white)

This creates a positive feedback loop: *"If I put my phone down for an hour, I earn 10 extra minutes."* It replaces the dopamine hit of scrolling with the dopamine hit of *earning*.

---

## Summary — Prioritized Recommendations

| Priority | Feature | Effort | Psychological Mechanism |
|---|---|---|---|
| 🥇 | Mindful Friction (Pause) | Medium | Breaks autopilot → System 2 activation [4][5] |
| 🥇 | Session Reflection | Medium | CBT awareness building [13][14] |
| 🥇 | Streaks & Saved Time | Low | Loss aversion, positive reinforcement [15][16] |
| 🥈 | Weekly Insights | Medium | Self-awareness, trend visibility [17][18] |
| 🥈 | Intention Setting | Low | Creates completion cues [19] |
| 🥈 | Gradual Difficulty | Low | Behavioral tapering [20] |
| 🥉 | Panic Button Override | Low | Respects autonomy + cognitive friction [4] |
| 🥉 | Wind-Down Mode | Medium | Evening doom scrolling, sleep hygiene [21] |
| 🥉 | Shared Pool (Group) | High | Prosocial guilt, collective accountability [22][23] |
| 🥉 | Accountability Partner | Medium | Social friction [22] |
| 🥉 | Challenges & Milestones | Medium | Intrinsic gamification [16] |
| 🥉 | Focus Mode Bonus Time | Medium | Earning-based model, reward substitution [25] |

---

## Competitive Landscape — Apps Doing Similar Things

| App | Key Mechanic | What Appace Can Learn |
|---|---|---|
| **one sec** | Breathing pause before app opens [5] | Feature 1 (Mindful Friction) |
| **Forest** | Growing virtual trees during focus | Feature 12 (Focus Mode visual reward) |
| **Snitch** | Shared Time Pot across friends | Feature 9 (Shared Pool) |
| **Friend Controls** | Friends approve/deny extra time [24] | Feature 9 + 10 (Social accountability) |
| **Clearspace** | "Step to Scroll" physical challenges | Unique friction variant |
| **Habitica** | RPG party takes damage on failures | Feature 11 (Gamification with stakes) |
| **OffScreen** | Streak tracking + challenge system | Feature 3 + 11 (Streaks + Milestones) |
| **Screen Time Buddy** | Character system + coins + groups | Feature 11 + 10 (Gamification + social) |

---

## Key Insight from the Research

> **"Simple digital abstinence is often ineffective."** — NIH [20]

The research is clear: apps that just *block* you fail long-term. The apps that work are the ones that build **self-awareness** (you start noticing how you feel) [13], **self-regulation** (you pause before acting) [5], and **alternative reward pathways** (streaks, saved time, focus earnings replace the dopamine you were getting from scrolling) [25].

Appace's accrual model is already more sophisticated than most competitors. The features above would push it from "a smart timer" to **"a behavioral change tool"** — which is what users are actually searching for.

---

## References

[1] Reddit community sentiment on screen time apps (aggregated from r/digitalminimalism, r/nosurf, r/getdisciplined, 2024–2025). Key themes: users delete hard-block apps; prefer earning-based models; most-requested feature is social accountability.

[2] Berridge, K.C. & Robinson, T.E. — "Wanting" vs. "Liking" dopamine research. Dopamine functions primarily as an anticipation/seeking chemical, not a pleasure chemical. Referenced via NIH (pubmed.ncbi.nlm.nih.gov).

[3] Rowancenterla.com — "Doom Scrolling and the Dopamine Loop" (2024). Explains variable reinforcement and how dopamine spikes occur before reward, keeping users in perpetual anticipation.

[4] Kahneman, D. — *Thinking, Fast and Slow* (2011). System 1 (fast/automatic) vs. System 2 (slow/deliberate) thinking framework. Foundational to all friction-based digital wellbeing interventions.

[5] Lukoff, K. et al. — "Does Switching Costs Encourage Self-Regulation? Evidence from a Smartphone Self-nudging App" — Published in *Proceedings of the National Academy of Sciences (PNAS)*, 2023. Max Planck Institute & University of Heidelberg. Field experiment (n=280, 6 weeks): *one sec* app reduced app opens by **57%** and reduced open attempts by **37%** over 6 weeks. https://www.pnas.org/

[6] Psychology Today — "Social Media and Variable Ratio Reinforcement" (2024). Social media feeds operate on the same reinforcement schedule as slot machines. https://www.psychologytoday.com/

[7] NIH / PubMed — "The Emotional Reinforcement Mechanism of Social Media Addiction" (2024). Neural and behavioral patterns in problematic social media use mirror those in gambling disorders. https://pubmed.ncbi.nlm.nih.gov/

[8] Emerald Insight — Doomscrolling research (2024). Classifies doomscrolling as maladaptive digital engagement driven by poor emotion regulation and FOMO. https://www.emerald.com/

[9] The Guardian — "How doomscrolling is feeding your existential anxiety" (2024). Cross-cultural studies (US and Iran) link excessive negative news consumption to pessimism and diminished belief in a "just world." https://www.theguardian.com/

[10] Healthline — "Doomscrolling: Why We Do It and How to Stop" (2024). Links doomscrolling to existential anxiety, dread, and elevated cortisol. https://www.healthline.com/

[11] Harvard Health Publishing — "Popcorn Brain: Is Your Digital Life Rewiring Your Mind?" (2024). Describes cognitive fragmentation from digital overstimulation, impacting executive function, planning, and sustained attention. https://www.health.harvard.edu/

[12] Psychology Today — "Popcorn Brain: What It Is and How to Manage It" (2025). Term originally coined by researcher David Levy (2011), re-emerged in 2024–2025 to describe fragmented attention from constant digital overstimulation. https://www.psychologytoday.com/

[13] Psychology Tools — "Self-Monitoring in CBT: A Clinician's Guide." Self-monitoring is a core evidence-based CBT component that helps clients identify patterns between thoughts, emotions, and addictive behaviors. https://www.psychologytools.com/

[14] NIH / PubMed — Efficacy of self-monitoring and mood tracking in addiction recovery. Progress monitoring linked to significant improvements in mental health outcomes and reduced relapse rates. https://pubmed.ncbi.nlm.nih.gov/

[15] Kahneman, D. & Tversky, A. — "Prospect Theory: An Analysis of Decision under Risk" (1979). *Econometrica*, 47(2), 263–292. The psychological pain of losing is ~2x stronger than the pleasure of gaining. Foundation for loss aversion in gamification design.

[16] Duolingo streak effectiveness data (multiple sources, 2024–2025): Users with 7+ day streaks retained at 2.4x higher rates. Leverages loss aversion (Prospect Theory), sunk cost effect, and BJ Fogg's Behavior Model (motivation + ability + prompt). Sources: dev.to, medium.com, trypropel.ai.

[17] BYU / Parent.com — "Screen Time Quality vs. Quantity" (2024). Current research emphasizes that the *quality* of screen time (content, context, and how it makes the user feel) matters as much as the total hours. https://scholarsarchive.byu.edu/

[18] NIH / PubMed — "Digital Nudges for Reducing Screen Time" (2024). Supports environmental design and nudge-based interventions: disabling notifications, greyscale mode, physical barriers, and providing objective data rather than inducing guilt. https://pubmed.ncbi.nlm.nih.gov/

[19] University of Michigan — "InteractOut: Leveraging Interaction Proxies as Input Manipulation Strategies for Reducing Smartphone Overuse." Friction-based interventions were **16% more effective** at reducing screen time vs. traditional hard-lockout strategies. https://umich.edu/

[20] Georgetown University / NIH — Research on digital detox effectiveness (2024). Notes that sudden abstinence can trigger "post-detox binge." Gradual, sustainable changes — "digital diet" — are more effective long-term. Also source for NIH quote: "Simple digital abstinence is often ineffective." https://pubmed.ncbi.nlm.nih.gov/

[21] American Academy of Pediatrics (AAP) / NIH — Recommendations for structured wind-down periods and screen-free zones before bedtime. Blue light + dopamine loop combination directly harms sleep quality. https://www.aap.org/

[22] Behavioral Health News — "NUGU" peer-based digital wellbeing program. Collaborative environments with shared usage goals and peer accountability produce stronger outcomes than solo approaches. https://behavioralhealthnews.org/

[23] ResearchGate — Studies on peer commitments and social accountability in digital wellbeing. Making public/semi-public promises to reduce usage increases likelihood of follow-through. Positive peer dynamics normalize the effort to disconnect. https://www.researchgate.net/

[24] Friend Controls — iOS App Store listing. Social accountability app: friends approve or deny requests for extra screen time. https://apps.apple.com/

[25] UX Design Collective / Medium — "Designing for Digital Wellbeing: Reward Substitution" (2024–2025). Rather than punishing screen time (which reinforces its value), effective apps reward "attention endurance" — gamifying disconnection and encouraging offline activity logging. https://uxdesign.cc/
