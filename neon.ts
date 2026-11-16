import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  // Branch policy: per-branch tuning (neon-postgres best practices)
  branch: (branch) => {
    if (branch.isDefault) {
      // Default production branch: keep defaults / avoid overriding manual compute settings
      return {};
    }
    if (!branch.exists) {
      // New non-default branches (dev / feat / preview):
      // 7-day auto-expiry + scale-to-zero compute profile to minimize idle cost
      return {
        ttl: "7d",
        postgres: {
          computeSettings: {
            autoscalingLimitMinCu: 0.25,
            autoscalingLimitMaxCu: 1,
            suspendTimeout: "5m",
          },
        },
      };
    }
    // Existing branch: no changes
    return {};
  },
});
