# Reinforcement Learning-Based Multi-Agent Taxi Fleet Management
## System Evaluation Report

**Project:** Autonomous Taxi Fleet Management using Q-Learning  
**Setup:** 12 Taxis · 5×5 City Grid · 50 Steps per Episode  
**Algorithm:** Q-Learning with Experience Replay  

---

## 1. Introduction

This project implements a Reinforcement Learning (RL) system to manage a fleet of 12 autonomous taxis across a simulated 5×5 city grid. The city has 25 zones with different passenger demand levels — from low-traffic residential areas to high-demand hubs like the Airport Terminal and City Center.

Each taxi is an independent agent controlled by a shared Q-learning policy. At every time step, each idle taxi decides whether to move to a neighboring zone, stay in place, or attempt a passenger pickup. Taxis currently on a trip count down their delivery timer and cannot take new actions until the trip completes.

**The core objective of the agent is simple:** complete as many passenger trips as efficiently as possible — by learning, without being told where passengers are.

The agent starts with no knowledge of the city. Over multiple episodes it builds a Q-table that maps (state, action) pairs to expected rewards. Over time it should discover on its own that zones with waiting passengers lead to positive outcomes, and position itself accordingly.

---

## 2. Problem with the Initial Reward Design

### 2.1 What Was Happening

When the system was first run, episode rewards were consistently exceeding **2,000+**. On the surface, this looks like strong performance. In reality, it was a sign that the reward function was broken.

The key question to ask is: **"Can the agent earn positive reward without actually serving any passengers?"** In the initial design, the answer was yes — and that is the root of the problem.

### 2.2 The Main Sources of Reward Inflation

**Issue 1 — Movement gave net positive reward**

The reward function included a `futureDemandBonus` worth up to **+3.5 per taxi per step**, intended to guide taxis toward high-demand zones. However, the time penalty was only **−1 per step**. This meant:

```
Net reward for moving into the best zone = −1 (time) + 3.5 (demand bonus) = +2.5 per step
```

With 12 taxis doing this for 50 steps:
```
12 taxis × 2.5 reward/step × 50 steps = 1,500 reward
```
That is 1,500 points of reward **before a single passenger was served**. The 2,000+ total was almost entirely from positioning, not from doing the actual job.

**Issue 2 — Positioning camping bonus**

A `+1 positioning bonus` was given to taxis that stayed in high-demand zones for up to 3 consecutive steps. The intent was to reward good positioning. The flaw: a taxi could oscillate between two adjacent high-demand zones, resetting the 3-step counter on every move, and collect this bonus indefinitely — never picking up anyone.

**Issue 3 — Delivery reward never reached the agent**

When a taxi completed a trip, a `+5` reward was added to the metrics but `agent.learn()` was never called. This means the Q-table never associated the pickup action with the downstream value of delivering a passenger. The agent was trained as if trips ended at pickup, with no knowledge of what completing the trip was worth.

**Issue 4 — Penalties were too asymmetric**

The `lowDemandPenalty` was −10 (for being in a dead zone), while the maximum demand bonus was only +3.5. This extreme asymmetry pushed the agent toward avoiding bad zones rather than seeking good outcomes. Combined with the other issues, the agent learned "don't be in bad places" rather than "go find passengers."

### 2.3 Why This Matters

A reward of 2,000+ meant the agent looked successful on paper while possibly having never completed a meaningful number of trips. This is called **reward hacking** — the agent found a way to score high without achieving the actual goal. Any metrics or conclusions drawn from that system would be meaningless.

---

## 3. Improvements Made

### Fix 1: Removed all demand-based movement heuristics

**Before:**
```
moveReward = −1 (time) + normalizedDemand × 3.5 (demand bonus)
           − (1 − normalizedDemand) × 1.5 (gradient penalty)
           − directionalPenalty (−1 if moved to worse zone)
           − lowDemandPenalty (−5 or −10 for dead zones)
```

**After:**
```
moveReward = −1 (time penalty, always)
           + idlePenalty (−4 only if staying while passengers wait elsewhere)
```

**Why this was necessary:**  
All the demand-based terms were encoding domain knowledge directly into the reward signal. That is not reinforcement learning — it is reward engineering that disguises itself as learning. The agent was being told where to go through the reward function, rather than discovering it through experience. By removing these terms, the agent must now learn spatial value purely through Q-updates: when it picks up a passenger (+20), the Bellman equation propagates that value backward to the states that led there. Over episodes, the Q-table naturally assigns higher values to states near high-demand zones, without being told so explicitly.

The `idlePenalty` (−4) is the one exception kept intentionally. It does not tell the agent *where* to go — only that standing still while passengers exist somewhere is bad. The agent still has to figure out the right direction on its own.

### Fix 2: Removed the positioning camping bonus

**Before:** `+1` for every step spent in a top-demand zone (up to 3 steps), resetting when the taxi moved.

**After:** Removed entirely.

**Why this was necessary:**  
The bonus could be farmed by oscillating between two adjacent high-demand cells. Since moving resets the `stepsInSameZone` counter, a taxi alternating east-west every step would collect +1 on every step indefinitely, without ever picking up a passenger. The fix removes the incentive entirely. If a taxi wants to score positively, it must actually pick someone up.

### Fix 3: Delivery reward now teaches the agent

**Before:** `stepReward += 5` was added to metrics when a trip completed, but `agent.learn()` was never called. The Q-table had no record of this.

**After:** 
```typescript
const deliveryReward = 10;
stepReward += deliveryReward;
agent.learn({ state: deliverySv, action: "pickup", reward: 10, nextState: deliverySv });
```

**Why this was necessary:**  
Without this, the agent understood that *starting* a trip earned +20, but completing it was worth nothing in its Q-table. This created a disconnect: the performance metric (episodeReward) included delivery credit, but the learned policy ignored it. Now the agent has a complete picture: pickup is valuable (+20), and completing the delivery adds more (+10). This reinforces the entire trip cycle, not just the pickup moment.

### Fix 4: Episode reward normalized by fleet size

**Before:** `episodeReward += stepReward` — accumulated raw across all 12 taxis.

**After:** `episodeReward += stepReward / 12` — normalized per taxi.

**Why this was necessary:**  
The raw fleet reward grows with the number of taxis. With 12 taxis, any episode reward number is 12× larger than the per-taxi signal. Normalizing by fleet size makes the metric meaningful: a value of +100 means each taxi earned an average of +100 that episode, regardless of fleet size. It also makes the metric directly comparable across different configurations.

---

## 4. Evaluation Metrics

### 4.1 Episode Reward per Taxi (Primary Learning Signal)

**Definition:** The total reward earned in one 50-step episode, divided by the number of taxis (12). Each taxi earns −1 per step (time cost), +20 per successful pickup, +10 per delivered trip, −2 per failed pickup attempt, and −4 per step it idles while passengers wait.

**Why it matters:** This is the signal the agent is directly optimizing. If it trends upward across episodes, the agent is learning. If it stays flat or negative, the agent has not discovered a useful policy.

**What good looks like:**  
- Episode 1–5: Likely negative or near zero (random exploration, few pickups)  
- Episode 10–20: Rising into positive territory as the agent learns high-demand zones  
- Episode 50+: Stable positive value, showing the policy has converged  

**Red flag:** If this metric is 2,000+ normalized, check that movement rewards are not contributing positively. The correct range for a 50-step episode with 12 taxis is roughly **+20 to +150 per taxi**.

---

### 4.2 Pickups per Episode

**Definition:** The total number of successful passenger pickups across all 12 taxis in one 50-step episode.

**Why it matters:** This is the most direct measure of whether the agent is doing its actual job. A high episode reward should always be accompanied by a high pickup count. If reward is high but pickups are low, reward hacking is occurring.

**What good looks like:**  
- Early episodes: 5–15 pickups (mostly random, agent in wrong zones)  
- Trained episodes: 30–60 pickups (agent navigating toward demand)  

**Formula check:** `pickups × 20 + deliveries × 10 − steps × 12` should approximately equal `episodeReward × 12`.

---

### 4.3 Completed Trips per Episode

**Definition:** The number of trips fully completed (passenger picked up and delivered) per episode. This differs from pickups because taxis mid-trip at episode end do not count as completed.

**Why it matters:** Completion rate reveals whether the agent is committing to trips or abandoning them. It also reflects trip duration — shorter trips mean more completed trips per episode.

**What good looks like:**  
- Completion rate should approach 1.0 (nearly all pickups result in delivery)  
- A growing gap between pickups and completions may indicate trips are too long for the 50-step window  

---

### 4.4 Average Trip Duration

**Definition:** The average number of steps a taxi spends carrying a passenger from pickup to delivery. Calculated from the `tripDuration` function: `distance × (1 + trafficLevel)`, minimum 1 step.

**Why it matters:** Shorter trips allow taxis to cycle faster and serve more passengers per episode. Longer trips (especially in high-traffic zones) occupy taxis for many steps, reducing throughput. A well-trained agent should balance serving high-revenue zones with avoiding zones where trips lock up taxis for too long.

**What good looks like:**  
- Average duration of 1–4 steps is efficient  
- Consistent delivery from distant zones suggests the agent is prioritizing revenue over turnover  

---

### 4.5 Taxi Occupancy (Utilization) Rate

**Definition:** The percentage of taxis currently carrying a passenger at any given time step. Displayed as a live metric and tracked in history.

**Why it matters:** Occupancy is a direct measure of fleet efficiency. An idle taxi is a wasted resource. Higher occupancy means the agent is successfully matching taxis to passengers.

**What good looks like:**  
- Early: 10–30% (most taxis idle or exploring randomly)  
- Trained: 50–80% (agent is actively routing taxis to demand)  
- Above 90% continuously could indicate all taxis are on long trips, which is not always optimal  

---

### 4.6 Reward Breakdown (Pickup vs. Movement vs. Delivery)

**Definition:** The per-step decomposition of total reward into three components, tracked in history and visualized in the Breakdown tab of the RL Analytics chart.

| Component | Source | Sign |
|---|---|---|
| Pickup Reward | +20 per successful pickup, −2 per failed | Should be positive |
| Delivery Reward | +10 per completed trip | Always positive |
| Movement Reward | −1 per step + −4 idle penalty | Always negative |

**Why it matters:** This breakdown exposes whether the agent is genuinely performing or exploiting the reward function. In a correctly designed system:
- Pickup reward should be the largest positive component
- Delivery reward should grow alongside pickup reward
- Movement reward should always be negative (it is a cost, not a benefit)

**Red flag:** If movement reward is near zero or positive, the reward function is still giving credit for positioning, not outcomes.

---

### 4.7 Q-Value Convergence

**Definition:** The average Q-value across all state-action entries in the Q-table, tracked over time.

**Why it matters:** Q-values represent the agent's belief about expected future reward from a given (state, action) pair. As the agent trains, Q-values should rise (as the agent discovers profitable actions) and then stabilize (as the policy converges). Unstable or perpetually rising Q-values suggest the learning rate is too high or the environment is non-stationary.

**What good looks like:**  
- Starts near 0 (all Q-values initialized to 0)  
- Rises steadily in early episodes  
- Plateaus after 20–50 episodes, indicating convergence  

---

### 4.8 Exploration Rate (ε)

**Definition:** The probability that the agent takes a random action instead of the greedy (highest Q-value) one. Starts at 0.30 and decays by a factor of 0.995 at the end of each episode, with a minimum floor of 0.05.

**Why it matters:** ε controls the exploration-exploitation tradeoff. Too high: the agent behaves randomly and cannot show learned behavior. Too low too early: the agent locks into a suboptimal policy before exploring enough states.

**What good looks like:**  
- Episode 1: ε = 0.30 (30% random actions)  
- Episode 50: ε ≈ 0.22 (22% random)  
- Episode 200: ε ≈ 0.09 (approaching floor)  
- At ε = 0.05: the agent is 95% policy-driven  

---

## 5. Results and Observations

### Before the Fixes

| Metric | Observed Value | Verdict |
|---|---|---|
| Episode reward (raw) | 2,000+ | Inflated — positioning dominated |
| Movement reward contribution | +1,500 per episode | Massive inflation from demand bonus |
| Delivery reward in Q-table | 0 (never learned) | Agent ignored trip completion |
| Agent behavior | Taxis clustered near good zones | Farming positioning bonus |

The agent appeared to perform well, but the Q-table was learning: "go to high-demand zones, stay there, repeat." This matches the reward function, not the actual task.

### After the Fixes

| Metric | Observed Value | Verdict |
|---|---|---|
| Ep Reward / Taxi (10 steps) | +50 to +63 | Honest — earned from trips |
| Movement reward contribution | −23 over 10 steps | Correctly negative |
| Pickup reward contribution | +480 over 10 steps | Dominant positive signal |
| Delivery reward contribution | +150 over 10 steps | Agent now learns from trips |
| Agent behavior | Taxis seek passengers, not zones | Learning the right objective |

The formula check: `480 pickup + 150 delivery − 23 movement = 607 fleet reward`. Divided by 12 taxis ≈ **50.6 per taxi** — exactly matching the displayed metric. The numbers are internally consistent.

### What Changed Behaviorally

1. **Taxis no longer cluster in one zone** — without the demand bonus, there is no reward for simply being near passengers. The agent must actually reach them and pick them up.

2. **Failed pickup attempts are penalized correctly** — −2 for attempting pickup with no passengers present. The agent learns to check zone state before committing to a pickup action.

3. **The Q-table now values trip completion** — delivery credit flows into the Q-table, so the agent understands the full value of a trip cycle (pickup + delivery = +30 total signal).

---

## 6. Key Insights

### 6.1 What the Agent Actually Learned

Through Q-learning, the agent builds a mapping from (zone index, demand level, predicted demand, traffic level, occupied status) → expected reward for each action. Without being told anything about city geography, the agent discovers:

- Zones with high `demandBucket` values consistently yield +20 pickup rewards when the pickup action is taken
- Repeatedly attempting pickup in empty zones yields −2 and trains the Q-value for that (state, pickup) pair downward
- Staying idle incurs −5 total per step (−1 time + −4 idle penalty), pushing the agent to move
- Over episodes, neighboring zones of high-demand zones see their Q-values rise through Bellman propagation — the agent develops a spatial gradient toward demand without ever being shown a map

### 6.2 Why Reward Design is Critical in RL

In supervised learning, the loss function is fixed and well-understood. In reinforcement learning, **the reward function is the problem specification**. If it is wrong, the agent will find the fastest path to a high reward — which may have nothing to do with what you actually want it to do.

The two most common mistakes in reward design are:
1. **Reward shaping that adds more information than the agent should have** — telling it *how* to achieve the goal instead of just *what* the goal is
2. **Incomplete reward specification** — leaving out part of the objective (like delivery) so the agent optimizes only for what it is told

Both mistakes were present in the initial design, and both produced a system that scored high while failing at the actual task.

The corrected reward function follows a simple principle: **reward outcomes, not behavior**. The agent is not rewarded for being in the right place. It is rewarded for completing the right action at the right time.

---

## 7. Conclusion

This project demonstrates a complete RL development cycle — from initial implementation, through diagnosis of reward dysfunction, to a corrected system aligned with real-world objectives.

The final reward design is:

| Event | Reward |
|---|---|
| Successful passenger pickup | +20 |
| Trip delivered to destination | +10 |
| Failed pickup (no passengers) | −2 |
| Time cost per step | −1 |
| Idle while passengers wait elsewhere | −4 |

This design is minimal, honest, and outcome-driven. Every positive point requires the agent to have actually served a passenger. Every negative signal discourages wasted time without telling the agent where to go. The agent discovers the optimal routing policy purely through experience.

**Limitations to acknowledge:**
- The Q-table state space is discretized, which means the agent cannot distinguish fine-grained demand differences within a bucket
- Epsilon decays slowly (0.995 per episode), meaning full convergence requires many episodes — roughly 200+ for ε to reach its floor of 0.05
- The 50-step episode limit means taxis that start far from demand zones may not complete enough trips to learn effectively in early episodes
- Trip destinations are random, so the agent cannot learn to prefer short trips over long ones — an improvement would be to include destination distance in the state

Despite these limitations, the system now correctly measures what it optimizes, and optimizes what it is meant to achieve — which is the minimum requirement for any trustworthy RL deployment.

---

*Report generated based on actual system implementation: 12-taxi Q-learning agent, 5×5 grid, 25 zones, 50-step episodes, ε-greedy exploration with experience replay (buffer size 10,000, batch size 32, γ = 0.95, α = 0.15).*
