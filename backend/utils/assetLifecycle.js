/**
 * Asset Lifecycle State Machine
 * 
 * Implements transition rules for asset lifecycle stages
 * Ensures only valid state transitions are allowed
 * 
 * States: new → active → maintenance → deprecated → archived
 */

class AssetLifecycle {
  static STATES = {
    NEW: "new",
    ACTIVE: "active",
    MAINTENANCE: "maintenance",
    DEPRECATED: "deprecated",
    ARCHIVED: "archived",
  };

  static TRANSITIONS = {
    // From NEW
    [this.STATES.NEW]: [this.STATES.ACTIVE, this.STATES.ARCHIVED],

    // From ACTIVE
    [this.STATES.ACTIVE]: [
      this.STATES.MAINTENANCE,
      this.STATES.DEPRECATED,
      this.STATES.ARCHIVED,
    ],

    // From MAINTENANCE
    [this.STATES.MAINTENANCE]: [
      this.STATES.ACTIVE,
      this.STATES.DEPRECATED,
      this.STATES.ARCHIVED,
    ],

    // From DEPRECATED
    [this.STATES.DEPRECATED]: [this.STATES.ARCHIVED],

    // From ARCHIVED (terminal state, no transitions)
    [this.STATES.ARCHIVED]: [],
  };

  static STATE_METADATA = {
    new: {
      displayName: "New",
      description: "Asset is new and not yet deployed",
      color: "#blue",
      icon: "📦",
    },
    active: {
      displayName: "Active",
      description: "Asset is in active use",
      color: "#green",
      icon: "✅",
    },
    maintenance: {
      displayName: "Under Maintenance",
      description: "Asset is undergoing maintenance",
      color: "#orange",
      icon: "🔧",
    },
    deprecated: {
      displayName: "Deprecated",
      description: "Asset is deprecated and no longer in use",
      color: "#red",
      icon: "⚠️",
    },
    archived: {
      displayName: "Archived",
      description: "Asset is archived (terminal state)",
      color: "#gray",
      icon: "📁",
    },
  };

  /**
   * Check if transition is valid
   */
  static isValidTransition(currentState, nextState) {
    if (!this.TRANSITIONS[currentState]) {
      return false;
    }
    return this.TRANSITIONS[currentState].includes(nextState);
  }

  /**
   * Get allowed next states for current state
   */
  static getValidNextStates(currentState) {
    return this.TRANSITIONS[currentState] || [];
  }

  /**
   * Validate and transition state
   * Throws error if transition is invalid
   */
  static validateTransition(currentState, nextState, reason = "") {
    if (!this.STATES[currentState.toUpperCase()]) {
      throw new Error(`Invalid current state: ${currentState}`);
    }

    if (!this.STATES[nextState.toUpperCase()]) {
      throw new Error(`Invalid next state: ${nextState}`);
    }

    if (!this.isValidTransition(currentState, nextState)) {
      const validStates = this.getValidNextStates(currentState);
      throw new Error(
        `Cannot transition from '${currentState}' to '${nextState}'. Valid transitions: ${validStates.join(", ")}`
      );
    }

    return {
      valid: true,
      from: currentState,
      to: nextState,
      reason,
      timestamp: new Date(),
    };
  }

  /**
   * Check if state is terminal
   */
  static isTerminalState(state) {
    return this.getValidNextStates(state).length === 0;
  }

  /**
   * Get state metadata (for UI rendering)
   */
  static getStateMetadata(state) {
    return this.STATE_METADATA[state] || null;
  }

  /**
   * Get state history context
   */
  static getStateContext(state) {
    const metadata = this.getStateMetadata(state);
    const validNextStates = this.getValidNextStates(state);
    const isTerminal = this.isTerminalState(state);

    return {
      current: state,
      metadata,
      validTransitions: validNextStates,
      isTerminal,
      nextStates: validNextStates.map((s) => ({
        state: s,
        metadata: this.getStateMetadata(s),
      })),
    };
  }

  /**
   * Lifecycle timeline (typical asset journey)
   */
  static getTypicalLifecycle() {
    return [
      this.STATES.NEW,
      this.STATES.ACTIVE,
      this.STATES.MAINTENANCE, // optional
      this.STATES.DEPRECATED,
      this.STATES.ARCHIVED,
    ];
  }

  /**
   * Duration recommendations (in days)
   */
  static getDurationRecommendations() {
    return {
      new: { min: 0, max: 30, description: "New assets should be deployed within 30 days" },
      active: { min: 1, max: 2555, description: "Active phase (5-7 years typical)" },
      maintenance: { min: 1, max: 180, description: "Maintenance phase (up to 6 months)" },
      deprecated: { min: 1, max: 365, description: "Deprecated phase (up to 1 year)" },
      archived: { min: 365, description: "Archived (permanent)" },
    };
  }

  /**
   * Calculate asset age from state
   */
  static getAssetAge(createdAt, currentState, lastStateChange) {
    const now = Date.now();
    const created = new Date(createdAt).getTime();
    const ageMs = now - created;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    const recommendations = this.getDurationRecommendations()[currentState];

    return {
      createdAt,
      currentState,
      ageDays,
      ageMonths: Math.floor(ageDays / 30),
      ageYears: Math.floor(ageDays / 365),
      lastStateChange,
      recommendations,
      shouldTransition: recommendations && ageDays > recommendations.max,
    };
  }
}

module.exports = AssetLifecycle;
