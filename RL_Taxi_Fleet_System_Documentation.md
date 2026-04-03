# Reinforcement Learning-Based Multi-Agent Taxi Fleet System
## Complete System Documentation

**Algorithm:** Q-Learning with Experience Replay  
**Grid:** 5×5 City Environment | **Agents:** 12 Autonomous Taxis | **Episode Length:** 50 Steps  
**Learning Rate (α):** 0.15 | **Discount Factor (γ):** 0.95 | **Exploration (ε):** 0.30 → 0.05  

---

## 1. System Overview

This system simulates an autonomous taxi fleet operating in a simplified city represented as a 5×5 grid of 25 distinct zones. Each zone has its own demand level (how many passengers are waiting), traffic conditions, and zone type — ranging from quiet residential areas to high-volume hubs like the Airport Terminal, City Center, and Financial District.

Twelve taxis operate simultaneously across this grid. Each taxi is an independent agent making its own movement and pickup decisions at every time step. Crucially, no taxi is told where to go. There is no dispatcher, no routing algorithm, and no hardcoded rules about which zones are valuable. The taxis learn purely from experience.

**The real-world goal is straightforward:** complete as many passenger trips as possible, as efficiently as possible, across a 50-step episode. A high score is only valid if it reflects actual passengers served — not clever manipulation of the reward function.

---

## 2. How the RL Agent Works

### 2.1 The Core Learning Loop

At every time step, each taxi goes through the following cycle:

```
Observe state → Choose action → Receive reward → Update Q-table → Repeat
```

This four-step loop, repeated thousands of times across episodes, is how the agent builds its understanding of the environment.

### 2.2 State: What the Agent Sees

Each taxi observes a state vector describing its current situation:

- **Zone index** — which of the 25 grid cells it currently occupies (0–24)
- **Demand bucket** — how many passengers are currently waiting (low / medium / high)
- **Predicted demand** — whether demand is expected to rise or fall
- **Traffic level** — how congested the zone is (affects trip duration)
- **Occupied status** — whether the taxi is currently carrying a passenger

This state is discretized into a finite number of combinations, each corresponding to a row in the Q-table.

### 2.3 Actions: What the Agent Can Do

At each step, a non-occupied taxi chooses one of six actions:

| Action | Description |
|---|---|
| **North** | Move one cell up |
| **South** | Move one cell down |
| **East** | Move one cell right |
| **West** | Move one cell left |
| **Stay** | Remain in the current zone |
| **Pickup** | Attempt to pick up a waiting passenger |

Boundary-checking prevents illegal moves (taxis cannot exit the grid). A taxi currently on a trip has no action to take — it simply counts down its remaining trip time each step.

### 2.4 Q-Learning in Plain Terms

Q-learning works by maintaining a table of values — called Q-values — that represent how much future reward the agent expects from taking a given action in a given state.

When the agent takes an action and receives a reward, it updates that Q-value using a weighted combination of:
1. What it just earned (immediate reward)
2. What it expects to earn next (the best Q-value from the next state, discounted by γ = 0.95)

```
Q(state, action) ← Q(state, action) + α × [reward + γ × max Q(next state) − Q(state, action)]
```

Over time, actions that consistently lead to good outcomes (pickups, deliveries) get higher Q-values. Actions that lead to wasted steps or failed pickups get lower ones. The agent naturally shifts toward actions with higher values.

### 2.5 Experience Replay

Rather than learning from each step once and discarding it, the system stores every experience (state, action, reward, next state) in a **replay buffer** with a capacity of 10,000 experiences. At each step, a random batch of 32 past experiences is sampled and used to update the Q-table.

This serves two purposes:
1. The agent learns from rare but important events (like a busy Airport zone) more than once
2. Randomly sampling past experiences prevents the agent from overfitting to the most recent pattern

### 2.6 Exploration vs. Exploitation (ε-Greedy)

Early in training, the agent needs to try different actions to discover what works. If it always picks the highest Q-value, it might never explore better options it hasn't seen yet.

The ε-greedy strategy handles this:
- With probability ε, the agent takes a **random action** (exploration)
- With probability 1−ε, the agent takes the **greedy action** (highest Q-value)

ε starts at 0.30, meaning 30% of decisions are random at the start. After each episode, it decays by a factor of 0.995, gradually reducing exploration as the agent becomes more confident. The floor of 0.05 ensures the agent never completely stops exploring.

---

## 3. Reward Mechanism

The reward function defines what the agent is optimizing for. Every design decision here shapes what behavior the agent learns.

### 3.1 Successful Pickup: +20

**What it is:** The agent receives +20 when it chooses the pickup action in a zone where at least one passenger is waiting, and the pickup succeeds.

**Why this reward:** Pickup is the core productive action in the system. A large positive signal here ensures the agent is strongly incentivized to find passengers. The magnitude (+20) must be large enough that the agent prefers seeking passengers over staying idle indefinitely.

**Behavior it creates:** The agent learns to navigate toward zones where pickup has historically succeeded. Through the Bellman equation, Q-values in neighboring zones gradually rise as the agent repeatedly finds that moving toward certain zones leads to this +20 reward.

### 3.2 Failed Pickup: −2

**What it is:** If the agent attempts a pickup action in a zone with no passengers, it receives −2.

**Why this reward:** Without this penalty, the agent might try pickup actions constantly without cost, since it earns +20 when passengers are present and nothing when they are not. The −2 penalty teaches the agent to read zone demand before committing to a pickup attempt.

**Behavior it creates:** The agent learns to avoid pickup actions in low-demand states. This is not hardcoded — the agent discovers which (zone, demand level) combinations tend to yield successful pickups versus failures.

### 3.3 Delivery Completion: +10

**What it is:** When a taxi completes a trip by reaching the passenger's destination, a +10 reward is issued and a Q-table update is triggered.

**Why this reward:** Pickup alone does not guarantee the passenger reaches their destination. Including a delivery reward completes the trip cycle in the agent's learning. Without it, the agent's Q-table has no reason to value the second half of a trip — only the moment of pickup matters to it.

**Behavior it creates:** The agent understands that beginning a trip and seeing it through to completion is worth +30 total (+20 pickup +10 delivery), versus +20 for a pickup that happens to run out of episode time. This reinforces committing to trips rather than circling high-demand zones.

### 3.4 Time Penalty: −1 per Step

**What it is:** Every taxi incurs a −1 cost at every time step, regardless of what action it takes.

**Why this reward:** This is the fundamental cost of operating. Without a time penalty, the agent has no reason to move efficiently or complete trips quickly — it could idle indefinitely at no cost. The −1 per step means every wasted step is a lost opportunity.

**Behavior it creates:** The agent learns to move with purpose. An agent that takes 5 steps to reach a zone 2 cells away has paid an unnecessary −3 penalty. Over enough episodes, the agent learns efficient paths.

### 3.5 Idle Penalty: −4 (conditional)

**What it is:** If a taxi chooses the Stay action while passengers are waiting in other zones, an additional −4 penalty is applied (on top of the −1 time penalty), for a total of −5 that step.

**Why this reward:** Without a specific idle penalty, the agent might stand still in a zone between passengers, waiting for demand to arrive. The −4 idle penalty makes that strategy costly. Importantly, this penalty does not tell the agent *where* to go — it only tells the agent that standing still when passengers exist elsewhere is a poor strategy. The agent still has to figure out the right direction through Q-learning.

**Behavior it creates:** Taxis actively search for passengers rather than camping in a single zone. The agent trades a guaranteed −5 per idle step for the chance to earn +20 by navigating to a productive zone.

### 3.6 Summary Table

| Event | Reward | Purpose |
|---|---|---|
| Successful pickup | +20 | Core productive signal |
| Failed pickup | −2 | Teaches demand awareness |
| Trip delivery | +10 | Completes the learning cycle |
| Time cost (per step) | −1 | Discourages waste |
| Idle while passengers wait | −4 additional | Discourages passivity |

**A key property of this design:** there is no positive reward for movement itself. Every positive signal requires an actual passenger transaction. This ensures the agent cannot farm rewards through positioning or cycling behavior.

---

## 4. Evaluation Methodology

### 4.1 Episode Reward (Normalized per Taxi)

**Definition:** The cumulative reward earned across all 12 taxis during one 50-step episode, divided by the number of taxis (12).

**Formula:**
```
episodeReward = Σ(all step rewards across all taxis) / 12
```

**Why normalization matters:** Without dividing by 12, the episode reward scales linearly with fleet size. A fleet of 12 taxis naturally produces 12× the reward of a single taxi — making the number hard to interpret and impossible to compare across differently-sized fleets. Dividing by 12 gives a per-taxi average that represents individual agent performance, regardless of fleet size.

**Interpretation scale:**
- Strongly negative (below −50): Agent is failing to find passengers
- Near zero: Agent is exploring with few productive actions
- Positive and rising (0–100): Agent is learning effective pickup routing
- Stable positive (100+): Agent has converged on a productive policy

### 4.2 Pickups per Episode

**Definition:** Total number of successful passenger pickups across all taxis in one 50-step episode.

**Why it matters:** This is the most direct behavioral indicator. A high episode reward should always correlate with a high pickup count. If the two diverge (high reward, low pickups), the reward function is not correctly aligned with the task.

**Verification check:** `pickups × 20 + deliveries × 10 − totalSteps × 1 − idleSteps × 4` should approximately equal `episodeReward × 12`. If not, the reward accounting has an error.

**What improvement looks like:** Pickup count rising across episodes means the agent is more reliably navigating to productive zones — not just by chance, but by learned policy.

### 4.3 Completed Trips per Episode

**Definition:** Number of trips fully completed in one episode — passenger both picked up and delivered to their destination.

**Why it matters:** Pickups that run out of episode time before delivery do not appear in the completed count. This metric reveals whether taxis are finishing what they start, and whether trip durations are manageable within the 50-step window.

**Gap analysis:** The difference between pickups and completed trips represents in-progress trips at episode end. A persistently large gap could indicate trips are too long (far destinations, high traffic) or episodes are too short for the current policy.

### 4.4 Average Trip Duration

**Definition:** The mean number of steps a taxi spends carrying a passenger. Calculated per trip as: `distance × (1 + trafficLevel)`, minimum 1 step.

**Why it matters:** Shorter trips allow taxis to cycle faster and serve more passengers within the fixed 50-step window. A taxi on a 10-step trip is unavailable for new pickups for 10 steps — opportunity cost matters.

**Interpretation:**
- Duration 1–3: Short, efficient trips; high throughput possible
- Duration 4–7: Medium trips; reasonable for high-demand destinations
- Duration 8+: Long-haul trips; taxi is tied up for a significant portion of the episode

**What improvement looks like:** Average duration staying low while completions rise indicates the agent is serving passengers efficiently. Duration creeping up while completions fall may indicate the agent is being assigned (or choosing) disproportionately long trips.

### 4.5 Taxi Occupancy Rate

**Definition:** The percentage of taxis currently carrying a passenger at any given time step. Tracked live and averaged over episode history.

**Why it matters:** Occupancy directly measures fleet efficiency. A taxi not carrying a passenger is either moving toward one (productive) or idle (wasted). High sustained occupancy means the agent has learned to keep taxis engaged with passengers continuously.

**Interpretation:**
- 0–20%: Most taxis are idle or searching; early-episode exploration
- 30–60%: Agent is finding passengers but routing still improving
- 60–80%: Strong performance; most taxis productively engaged at any moment
- Above 80% continuously: Agent may be accepting all trips including very long ones — worth monitoring trip duration alongside

### 4.6 Reward Breakdown (Pickup vs. Movement vs. Delivery)

**Definition:** At each time step, the total fleet reward is decomposed into three components tracked separately:
- **Pickup reward:** Sum of +20 (success) and −2 (failure) across all pickup actions that step
- **Delivery reward:** Sum of +10 for all trips completed that step
- **Movement reward:** Sum of time penalties (−1) and idle penalties (−4) across all taxis that step

**Why it matters:** This breakdown is the primary diagnostic for reward integrity. In a correctly functioning system:
- Pickup and delivery components are positive and growing over episodes
- Movement component is always negative (it is a cost, never a benefit)
- The magnitude of pickup reward should be the dominant driver of total reward

**Red flag:** If the movement component approaches zero or goes positive, the reward function is accidentally crediting movement, not outcomes. This was the core failure in early reward designs and is the first thing to check if episode reward looks implausibly high.

---

## 5. Results and Interpretation

### 5.1 What Healthy Results Look Like

The table below describes expected system behavior across three training phases:

| Phase | Episodes | ε | Pickup Rate | Ep Reward/Taxi | Occupancy |
|---|---|---|---|---|---|
| Random Exploration | 1–10 | 0.28–0.30 | Low (chance only) | Near zero or negative | 10–25% |
| Active Learning | 10–50 | 0.22–0.28 | Steadily rising | Entering positive range | 30–50% |
| Policy Convergence | 50–200 | 0.10–0.20 | High, stabilizing | Stable positive | 55–75% |
| Mature Policy | 200+ | 0.05–0.08 | Peak efficiency | Plateau reached | 65–80% |

### 5.2 How to Read the Metrics Together

**Scenario A — Agent is learning correctly:**
- Pickups rising episode over episode
- Delivery count tracking closely behind pickups
- Movement reward consistently negative but not worsening
- Occupancy rate trending upward
- Episode reward per taxi moving from negative into positive territory

**Scenario B — Possible reward exploitation (warning sign):**
- Episode reward is high but pickups are low
- Movement reward is near zero or positive
- Occupancy is low despite high reward
- This means the reward function is giving credit for something other than passenger service

**Scenario C — Agent has stalled:**
- Episode reward flat for many episodes
- ε still high (still exploring randomly)
- Q-values not converging (still near zero)
- Likely cause: state space is too sparse, batch size too small, or learning rate mistuned

### 5.3 Actual Observed Performance (Post-Fix Baseline)

After removing all demand heuristics, a 10-step run with 12 taxis produced:

| Component | Value |
|---|---|
| Fleet pickup reward | +480 |
| Fleet delivery reward | +150 |
| Fleet movement reward | −23 |
| Displayed Ep Reward / Taxi | +50.6 |
| Trips completed | 15 |

The movement reward being −23 while pickup and delivery are +630 combined confirms the reward signal is dominated by actual passenger service, not positioning. This is the correct behavior.

---

## 6. Behavioral Analysis

### 6.1 What Strategies the Agent Discovers

The agent begins with a uniform Q-table — all state-action pairs have equal expected value, so all actions are equally likely. Over the first few episodes, it tries actions randomly and observes outcomes.

As Q-updates accumulate, two patterns emerge:

**Pattern 1 — Zone preference learning:**  
Zones where the agent has successfully picked up passengers accumulate positive Q-value for the "pickup" action in those states. The Bellman equation also propagates this value to neighboring states: zones adjacent to productive zones develop higher Q-values for movement actions directed toward those productive zones. The agent effectively builds a spatial value gradient pointing toward demand, without ever being given a map.

**Pattern 2 — Demand-conditional behavior:**  
The state includes demand bucket level (low/medium/high). Over time, the agent learns that the pickup action in a "high demand" state consistently yields +20, while the same action in a "low demand" state yields −2. It learns to differentiate: attempt pickup in high-demand states, move in low-demand states.

### 6.2 High-Demand vs. Low-Demand Zone Behavior

**In high-demand zones (City Center, Airport, Financial District):**
- Agent chooses pickup action more frequently (high Q-value learned for that state)
- Multiple taxis may be directed toward the same zone — the system allows this and handles it through passenger queuing
- Successful pickups reinforce the path that led to this zone

**In low-demand zones (residential areas, peripheral zones):**
- Agent learns that pickup action here has a negative expected value (−2 is common)
- Agent shifts toward movement actions pointing toward historically productive zones
- Idle penalty (−5/step) prevents parking in dead zones indefinitely

### 6.3 How Inefficient Behavior Is Discouraged

| Inefficient behavior | How the system prevents it |
|---|---|
| Camping in one zone forever | Idle penalty (−4 per step) makes staying costly when passengers exist elsewhere |
| Attempting pickup in empty zones | Failed pickup (−2) teaches the agent to check demand state |
| Moving randomly without purpose | Time penalty (−1) makes every step a cost; the agent prefers paths leading to +20 |
| Ignoring delivery (just circling for pickups) | Delivery reward (+10) in the Q-table makes completing trips explicitly valuable |

---

## 7. Why This System Is Reliable

### 7.1 No Reward Inflation

The maximum reward a taxi can earn in one step, assuming a successful pickup and simultaneous delivery (separate events), is +20. Against the minimum time cost of −1, no single step contributes more than +20 to the per-taxi reward. Over 50 steps, the theoretical maximum is bounded — there is no compounding mechanism that allows rewards to spiral.

### 7.2 No Reward Hacking Loops

A reward hacking loop occurs when the agent finds a repeatable sequence of actions that generates positive reward without accomplishing the actual objective. The current design closes three historically exploited loops:

1. **Positioning loop (closed):** Movement reward is always ≤ −1. No amount of navigating can produce positive reward — only actual pickups can.
2. **Camping loop (closed):** Removed the consecutive-step bonus that previously rewarded taxis for staying in one zone.
3. **Phantom delivery (closed):** Delivery reward is now issued and learned by the agent. There is no step where reward is counted in metrics but not in the Q-table.

### 7.3 Learning Is Aligned with Real Objective

The agent's internal objective (maximize Q-table expected reward) and the real-world objective (complete as many trips as efficiently as possible) are directly aligned:
- Every point of positive reward requires a completed transaction (pickup or delivery)
- Every negative signal represents a real cost (time, wasted attempt, inactivity)
- The episode reward metric is a normalized, auditable number that can be cross-checked against pickup and delivery counts

### 7.4 Metrics Validate True Performance

Because the reward breakdown is tracked separately (pickup / movement / delivery), any result can be audited. A claim that the agent achieved episode reward +80 per taxi can be verified by checking that pickup and delivery rewards account for the majority of that number, and movement reward is negative.

---

## 8. Conclusion

This system implements a complete, honest reinforcement learning pipeline for multi-agent fleet management. Twelve taxis learn to serve passengers in a 5×5 city grid through pure Q-learning — without routing tables, without hardcoded zone preferences, and without reward signals that encode domain knowledge the agent should discover on its own.

The reward function follows a single principle: **reward outcomes, not behavior**. Every positive signal corresponds to a passenger served. Every negative signal represents a real cost. The agent's learned policy emerges entirely from repeated interaction with the environment, not from guidance baked into the reward structure.

The evaluation framework is equally honest. Episode reward is normalized per taxi so the number is interpretable regardless of fleet size. The breakdown chart makes it auditable — if the movement component is ever positive, something is wrong. If pickup count and episode reward diverge, something is wrong. These checks prevent a high-sounding metric from concealing poor actual performance.

**Real-world relevance:** The core problems this system addresses — multi-agent coordination, spatial demand prediction through experience, efficient resource allocation under uncertainty — are directly applicable to ride-sharing platforms (Uber, Lyft) and autonomous vehicle fleets. The challenge of designing a reward function that correctly captures operational objectives without exploitation is one of the central open problems in applied reinforcement learning. This project demonstrates both the problem and a principled approach to solving it.

---

*System parameters: Q-table initialized to zero, ε-greedy exploration (0.30 start, 0.995 decay per episode, 0.05 floor), experience replay buffer (10,000 capacity, batch size 32), Bellman update with γ = 0.95, α = 0.15.*
