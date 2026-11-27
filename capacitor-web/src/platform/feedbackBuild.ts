const env = import.meta.env ?? {};
export const webFeedbackBuild = env.MODE === 'feedback-web';
export const feedbackBuild = env.MODE === 'feedback' || webFeedbackBuild;
export const localTestEntryEnabled = !!env.DEV || feedbackBuild;
